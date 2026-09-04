import * as XLSX from 'xlsx'
import { beforeEach, describe, expect, it } from 'vitest'
import { analyzeExcel, commitExcelImport } from './excel'
import { db, initializeDatabase } from '../db'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await initializeDatabase()
})

function workbookFile() {
  const workbook = XLSX.utils.book_new()
  for (let index = 1; index <= 4; index += 1) {
    const rows = [
      ['#', 'Nombre', 'Teléfono', 'Nombre del dispositivo', 'Precio mensual', 'Mes 1', 'Mes 2'],
      [1, 'Persona 1', 5512345678, 'iPhone + Laptop', new Date(2026, 7, 6), 'Pagado', 'Pendiente'],
      ['TOTAL', '', '', '', '', '', ''],
    ]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), `Cuenta ${index}`)
  }
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return new File([bytes], 'registro.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

describe('importación de Excel', () => {
  it('detecta cuatro tablas, fechas bajo un encabezado incorrecto y pagos explícitos', async () => {
    const accounts = await db.accounts.orderBy('order').toArray()
    const preview = await analyzeExcel(workbookFile(), accounts)
    expect(preview.sheets).toHaveLength(4)
    expect(preview.people).toHaveLength(4)
    expect(preview.people[0]).toMatchObject({ joinDate: '2026-08-06', paidMonths: 1, devices: ['iPhone', 'Laptop'] })
  })

  it('evita duplicados al importar el mismo archivo dos veces', async () => {
    const accounts = await db.accounts.orderBy('order').toArray()
    await commitExcelImport(await analyzeExcel(workbookFile(), accounts))
    expect(await db.people.count()).toBe(4)
    const second = await analyzeExcel(workbookFile(), accounts)
    expect(second.people.every((person) => person.duplicatePersonId)).toBe(true)
    await commitExcelImport(second)
    expect(await db.people.count()).toBe(4)
  })
})
