import { db } from '../db'
import type { AppSettings, BackupPayload, ISODate } from '../types'
import { saveOrShareBlob } from './files'
import { formatDate, isISODate, nextPaymentDate, todayISO } from './dates'
import { getPaymentStatus, statusLabels } from './status'

export async function buildBackup(): Promise<BackupPayload> {
  const [accounts, people, payments, settings] = await Promise.all([
    db.accounts.orderBy('order').toArray(),
    db.people.toArray(),
    db.payments.toArray(),
    db.settings.get('app-settings'),
  ])
  if (!settings) throw new Error('No se encontró la configuración de la aplicación.')
  return { format: 'pagos-local-backup', version: 1, exportedAt: new Date().toISOString(), accounts, people, payments, settings }
}

export async function exportBackup() {
  const payload = await buildBackup()
  await saveOrShareBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    `pagos-local-respaldo-${todayISO()}.json`,
    'Copia de seguridad de Pagos Local',
  )
}

export function parseBackup(text: string): BackupPayload {
  const payload = JSON.parse(text) as Partial<BackupPayload>
  if (payload.format !== 'pagos-local-backup' || payload.version !== 1) throw new Error('El archivo no es una copia compatible de Pagos Local.')
  if (!Array.isArray(payload.accounts) || !Array.isArray(payload.people) || !Array.isArray(payload.payments) || !payload.settings) {
    throw new Error('La copia está incompleta.')
  }
  for (const person of payload.people) {
    if (!person.id || !person.accountId || !person.displayName || !isISODate(person.joinDate)) {
      throw new Error('La copia contiene una persona con datos inválidos.')
    }
  }
  return payload as BackupPayload
}

export async function restoreBackup(payload: BackupPayload) {
  await db.transaction('rw', db.accounts, db.people, db.payments, db.settings, async () => {
    await Promise.all([db.accounts.clear(), db.people.clear(), db.payments.clear(), db.settings.clear()])
    await db.accounts.bulkAdd(payload.accounts)
    await db.people.bulkAdd(payload.people)
    await db.payments.bulkAdd(payload.payments)
    await db.settings.add(payload.settings)
  })
}

export async function exportToExcel(settings: AppSettings) {
  const XLSX = await import('xlsx')
  const [accounts, people] = await Promise.all([db.accounts.toArray(), db.people.toArray()])
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
  const rows = people.map((person) => {
    const status = getPaymentStatus(person, settings)
    const nextDue = nextPaymentDate(person.joinDate, person.paidMonths)
    return {
      Cuenta: accountNames.get(person.accountId) ?? person.accountId,
      Persona: person.displayName,
      Teléfono: person.phone,
      Dispositivos: person.devices.join(' | '),
      'Fecha de ingreso': formatDate(person.joinDate),
      'Meses pagados': person.paidMonths,
      'Próximo vencimiento': formatDate(nextDue),
      Estado: statusLabels[status],
      'Requiere revisión': person.needsReview ? 'Sí' : 'No',
    }
  })
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Personas')
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  await saveOrShareBlob(
    new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `pagos-local-${todayISO()}.xlsx`,
    'Exportación de Pagos Local',
  )
}

export function dueDateAsISO(value: string): ISODate {
  if (!isISODate(value)) throw new Error('Fecha inválida')
  return value
}
