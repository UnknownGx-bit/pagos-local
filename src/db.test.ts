import { beforeEach, describe, expect, it } from 'vitest'
import { PagosDatabase, createAccount, createPerson, db, deletePerson, initializeDatabase, nextPersonNumber, registerPayment, updatePerson } from './db'
import { buildBackup, restoreBackup } from './lib/backup'
import type { Person } from './types'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await initializeDatabase()
})

describe('persistencia de personas y pagos', () => {
  it('reutiliza el primer lugar libre por cuenta sin liberar a los suspendidos', async () => {
    const input = { accountId: 'account-1', personNumber: 1, displayName: 'Persona 1', phone: '', devices: [], joinDate: '2026-08-06' as const, paidMonths: 1, manuallyUnpaid: false, needsReview: false, reviewNotes: [] }
    const first = await createPerson(input)
    await createPerson({ ...input, personNumber: 3, suspended: true })
    expect(await nextPersonNumber('account-1')).toBe(2)
    expect(await nextPersonNumber('account-2')).toBe(1)
    await deletePerson(first.id)
    expect(await nextPersonNumber('account-1')).toBe(1)
    await createPerson(input)
    const results = await Promise.allSettled([createPerson({ ...input, personNumber: 2 }), createPerson({ ...input, personNumber: 2 })])
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(await nextPersonNumber('account-1')).toBe(4)
    expect(await db.people.count()).toBe(3)
  })

  it('agrega cuentas, respalda y restaura pagos sin modificar registros existentes', async () => {
    const account = await createAccount('Cuenta 5')
    const person = await createPerson({ accountId: account.id, personNumber: 1, displayName: 'Nueva', phone: '', devices: [], joinDate: '2026-08-06', paidMonths: 1, manuallyUnpaid: false, needsReview: false, reviewNotes: [] })
    await registerPayment(person, 1)
    const snapshot = await buildBackup()
    await expect(createAccount(' CUENTA 5 ')).rejects.toThrow()
    await createAccount('Cuenta 6')
    await restoreBackup(snapshot)
    expect(await db.accounts.toArray()).toEqual(expect.arrayContaining(snapshot.accounts))
    expect(await db.accounts.count()).toBe(5)
    expect(await db.people.toArray()).toEqual(snapshot.people)
    expect(await db.payments.toArray()).toEqual(snapshot.payments)
    await expect(restoreBackup({ ...snapshot, people: [{ ...snapshot.people[0]!, accountId: 'no-existe' }] })).rejects.toThrow()
    expect(await db.people.toArray()).toEqual(snapshot.people)
    expect(await db.payments.toArray()).toEqual(snapshot.payments)
  })

  it('actualiza avisos de una base anterior conservando todos los datos y es idempotente', async () => {
    const isolated = new PagosDatabase('pagos-legacy-upgrade')
    await isolated.open()
    const legacy: Person = { id: 'old-person', accountId: 'custom-account', personNumber: 19, displayName: 'Persona importante', phone: '5512345678', devices: ['Equipo'], joinDate: '2026-08-01', paidMonths: 3, manuallyUnpaid: false, suspended: true, needsReview: false, reviewNotes: [], createdAt: '2026-08-01', updatedAt: '2026-09-01' }
    await isolated.accounts.add({ id: 'custom-account', name: 'Mi cuenta', order: 9 })
    await isolated.people.add(legacy)
    await isolated.settings.add({ id: 'app-settings', onboarded: true, reminderDaysBefore: 2, reminderTime: '09:00' })
    isolated.close()
    await isolated.open()
    await initializeDatabase(isolated)
    expect(await isolated.people.toArray()).toEqual([legacy])
    expect(await isolated.accounts.count()).toBe(1)
    expect(await isolated.settings.get('app-settings')).toMatchObject({ reminderDaysBefore: 1, reminderTime: '10:00', onboarded: true })
    await isolated.settings.update('app-settings', { reminderTime: '11:00' })
    await initializeDatabase(isolated)
    expect((await isolated.settings.get('app-settings'))?.reminderTime).toBe('11:00')
    await isolated.delete()
  })
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
