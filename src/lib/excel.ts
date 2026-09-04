import { db, newId } from '../db'
import type { Account, ImportPersonDraft, ImportPreview, ISODate, Person } from '../types'
import { isISODate, toISODate } from './dates'

type Cell = string | number | boolean | Date | null | undefined
type XlsxModule = typeof import('xlsx')

function compact(value: Cell) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalized(value: Cell) {
  return compact(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function normalizedKey(value: string) {
  return normalized(value).replace(/[^a-z0-9]/g, '')
}

function phoneValue(value: Cell) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value))
  return compact(value).replace(/\s+/g, '')
}

function splitDevices(value: Cell) {
  return compact(value).split(/\s*\+\s*|\r?\n/).map((item) => item.trim()).filter(Boolean)
}

function parseDate(value: Cell, XLSX: XlsxModule): ISODate | '' {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toISODate(value.getFullYear(), value.getMonth() + 1, value.getDate())
  }
  if (typeof value === 'number' && value >= 20_000 && value <= 80_000) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return toISODate(parsed.y, parsed.m, parsed.d)
  }
  const raw = compact(value)
  if (isISODate(raw)) return raw
  const isoTimestamp = /^(\d{4})-(\d{2})-(\d{2})T/.exec(raw)
  if (isoTimestamp) {
    const candidate = `${isoTimestamp[1]}-${isoTimestamp[2]}-${isoTimestamp[3]}`
    return isISODate(candidate) ? candidate : ''
  }
  const local = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(raw)
  if (local) {
    const candidate = toISODate(Number(local[3]), Number(local[2]), Number(local[1]))
    return isISODate(candidate) ? candidate : ''
  }
  return ''
}

function findHeaderRow(rows: Cell[][]) {
  return rows.findIndex((row) => {
    const values = row.map(normalized)
    return values.some((item) => item === 'nombre') && values.some((item) => item.includes('telefono'))
  })
}

function columnByHeader(headers: Cell[], candidates: RegExp[]) {
  return headers.findIndex((header) => candidates.some((candidate) => candidate.test(normalized(header))))
}

function findDateColumn(headers: Cell[], rows: Cell[][], headerIndex: number, XLSX: XlsxModule) {
  let winner = -1
  let winnerScore = 0
  headers.forEach((header, column) => {
    const headerName = normalized(header)
    const headerWeight = /fecha|ingreso|precio mensual/.test(headerName) ? 2 : 0
    const dateCount = rows.slice(headerIndex + 1).filter((row) => parseDate(row[column], XLSX)).length
    const score = dateCount * 3 + headerWeight
    if (score > winnerScore) {
      winner = column
      winnerScore = score
    }
  })
  return winner
}

function extractPersonNumber(name: string, rawNumber: Cell) {
  if (typeof rawNumber === 'number' && Number.isFinite(rawNumber)) return Math.trunc(rawNumber)
  const fromNumber = /\d+/.exec(compact(rawNumber))
  if (fromNumber) return Number(fromNumber[0])
  const fromName = /persona\s*(\d+)/i.exec(name)
  return fromName ? Number(fromName[1]) : null
}

function matchesPerson(name: string) {
  return /(?:^|\b)(?:n\s*)?persona\s*\d+/i.test(normalized(name))
}

function duplicateOf(draft: ImportPersonDraft, existing: Person[]) {
  const display = normalizedKey(draft.displayName)
  const phone = normalizedKey(draft.phone)
  return existing.find((person) => {
    if (person.accountId !== draft.accountId) return false
    const primary = normalizedKey(person.displayName) === display && normalizedKey(person.phone) === phone
    const devices = person.devices.map(normalizedKey)
    const supporting = person.joinDate === draft.joinDate && draft.devices.some((device) => devices.includes(normalizedKey(device)))
    return primary || supporting
  })
}

function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}

export async function analyzeExcel(file: File, accounts: Account[]): Promise<ImportPreview> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await readArrayBuffer(file), { type: 'array', cellDates: true })
  const existing = await db.people.toArray()
  const people: ImportPersonDraft[] = []
  const sheets = []
  const selectedNames = workbook.SheetNames.slice(0, accounts.length)

  for (let sheetIndex = 0; sheetIndex < selectedNames.length; sheetIndex += 1) {
    const sheetName = selectedNames[sheetIndex]!
    const account = accounts[sheetIndex]!
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue
    const rows = XLSX.utils.sheet_to_json<Cell[]>(worksheet, { header: 1, raw: true, defval: null })
    const headerIndex = findHeaderRow(rows)
    if (headerIndex < 0) {
      sheets.push({ sheetName, accountId: account.id, accountName: account.name, found: 0, safe: 0, needsReview: 0 })
      continue
    }
    const headers = rows[headerIndex] ?? []
    const numberColumn = columnByHeader(headers, [/^#$/, /numero/])
    const nameColumn = columnByHeader(headers, [/^nombre$/, /persona/])
    const phoneColumn = columnByHeader(headers, [/telefono/, /celular/])
    const deviceColumn = columnByHeader(headers, [/dispositivo/])
    const dateColumn = findDateColumn(headers, rows, headerIndex, XLSX)
    const monthColumns = headers
      .map((header, column) => ({ header: normalized(header), column }))
      .filter(({ header }) => /^mes\s*\d+/.test(header))
      .map(({ column }) => column)
    const before = people.length

    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      const displayName = compact(row[nameColumn])
      if (!matchesPerson(displayName)) continue
      const phone = phoneValue(row[phoneColumn])
      const joinDate = parseDate(row[dateColumn], XLSX)
      const reviewNotes: string[] = []
      const unknownPaymentValues: string[] = []
      let paidMonths = 0
      for (const column of monthColumns) {
        const status = normalized(row[column])
        if (status === 'pagado') paidMonths += 1
        else if (status && status !== 'pendiente') unknownPaymentValues.push(compact(row[column]))
      }
      if (!joinDate) reviewNotes.push('Falta una fecha de ingreso válida.')
      if (phone && !/^\+?\d+$/.test(phone)) reviewNotes.push(`El teléfono contiene texto: “${phone}”.`)
      if (unknownPaymentValues.length) reviewNotes.push(`Pago no interpretado: ${[...new Set(unknownPaymentValues)].join(', ')}.`)
      const draft: ImportPersonDraft = {
        sourceRow: rowIndex + 1,
        accountId: account.id,
        accountName: account.name,
        personNumber: extractPersonNumber(displayName, row[numberColumn]),
        displayName,
        phone,
        devices: splitDevices(row[deviceColumn]),
        joinDate,
        paidMonths,
        reviewNotes,
        duplicateAction: 'skip',
        include: reviewNotes.length === 0,
      }
      const duplicate = duplicateOf(draft, existing)
      if (duplicate) draft.duplicatePersonId = duplicate.id
      people.push(draft)
    }

    const foundPeople = people.slice(before)
    sheets.push({
      sheetName,
      accountId: account.id,
      accountName: account.name,
      found: foundPeople.length,
      safe: foundPeople.filter((person) => person.reviewNotes.length === 0).length,
      needsReview: foundPeople.filter((person) => person.reviewNotes.length > 0).length,
    })
  }

  return { fileName: file.name, sheets, people, ignoredSheetNames: workbook.SheetNames.slice(accounts.length) }
}

export async function commitExcelImport(preview: ImportPreview) {
  const stamp = new Date().toISOString()
  let added = 0
  let updated = 0
  let skipped = 0
  await db.transaction('rw', db.people, async () => {
    for (const draft of preview.people) {
      if (!draft.include || !draft.joinDate) { skipped += 1; continue }
      if (draft.duplicatePersonId && draft.duplicateAction === 'skip') { skipped += 1; continue }
      const personData = {
        accountId: draft.accountId,
        personNumber: draft.personNumber,
        displayName: draft.displayName.trim(),
        phone: draft.phone.trim(),
        devices: draft.devices.map((item) => item.trim()).filter(Boolean),
        joinDate: draft.joinDate,
        paidMonths: Math.max(0, Math.trunc(draft.paidMonths)),
        manuallyUnpaid: false,
        needsReview: draft.reviewNotes.length > 0,
        reviewNotes: draft.reviewNotes,
        updatedAt: stamp,
      }
      if (draft.duplicatePersonId && draft.duplicateAction === 'update') {
        await db.people.update(draft.duplicatePersonId, personData)
        updated += 1
      } else {
        await db.people.add({ ...personData, id: newId(), createdAt: stamp })
        added += 1
      }
    }
  })
  return { added, updated, skipped }
}
