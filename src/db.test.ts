import { beforeEach, describe, expect, it } from 'vitest'
import { PagosDatabase, createPerson, db, deletePerson, initializeDatabase, registerPayment, updatePerson } from './db'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await initializeDatabase()
})

describe('persistencia de personas y pagos', () => {
  it('acumula pagos concurrentes usando el registro actual y rechaza personas eliminadas', async () => {
    const person = await createPerson({ accountId: 'account-1', personNumber: 1, displayName: 'Prueba', phone: '', devices: [], joinDate: '2026-08-06', paidMonths: 0, manuallyUnpaid: false, needsReview: false, reviewNotes: [] })
    await Promise.all([registerPayment(person, 1), registerPayment(person, 2)])
    expect((await db.people.get(person.id))?.paidMonths).toBe(3)
    expect(await db.payments.count()).toBe(2)
    await expect(registerPayment(person, NaN)).rejects.toThrow()
    await deletePerson(person.id)
    await expect(registerPayment(person, 1)).rejects.toThrow()
    expect(await db.payments.count()).toBe(0)
  })
  it('registra varios meses, mueve de cuenta y elimina el historial', async () => {
    const person = await createPerson({ accountId: 'account-1', personNumber: 1, displayName: 'Persona 1', phone: '555', devices: ['iPhone'], joinDate: '2026-08-06', paidMonths: 1, manuallyUnpaid: false, suspended: true, needsReview: false, reviewNotes: [] })
    const payment = await registerPayment(person, 2, '2026-09-03')
    expect(payment.previousDueDate).toBe('2026-09-06')
    expect(payment.newDueDate).toBe('2026-11-06')
    expect((await db.people.get(person.id))?.paidMonths).toBe(3)
    expect((await db.people.get(person.id))?.suspended).toBe(false)
    await updatePerson(person.id, { accountId: 'account-2', joinDate: '2026-01-31' })
    expect((await db.people.get(person.id))?.accountId).toBe('account-2')
    await deletePerson(person.id)
    expect(await db.people.count()).toBe(0)
    expect(await db.payments.count()).toBe(0)
  })

  it('abre una base versionada sin perder registros', async () => {
    const isolated = new PagosDatabase('pagos-version-test')
    await isolated.open()
    await isolated.accounts.put({ id: 'a', name: 'Cuenta', order: 1 })
    isolated.close()
    const reopened = new PagosDatabase('pagos-version-test')
    expect((await reopened.accounts.get('a'))?.name).toBe('Cuenta')
    await reopened.delete()
  })
})
