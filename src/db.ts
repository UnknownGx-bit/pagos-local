import Dexie, { type EntityTable } from 'dexie'
import type { Account, AppSettings, Payment, Person } from './types'
import { isISODate, nextPaymentDate, todayISO } from './lib/dates'
import { firstAvailablePersonNumber } from './lib/people'
import { upgradeReminderSettings } from './lib/settings'

export class PagosDatabase extends Dexie {
  accounts!: EntityTable<Account, 'id'>
  people!: EntityTable<Person, 'id'>
  payments!: EntityTable<Payment, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor(name = 'pagos-local') {
    super(name)
    this.version(1).stores({
      accounts: 'id, order',
      people: 'id, accountId, displayName, phone, createdAt, updatedAt, [accountId+displayName+phone]',
      payments: 'id, personId, paidAt',
      settings: 'id',
    })
  }
}

export const db = new PagosDatabase()

export const defaultSettings: AppSettings = {
  id: 'app-settings',
  reminderDaysBefore: 1,
  reminderTime: '10:00',
  onboarded: false,
  reminderPolicyVersion: 1,
}

export const defaultAccounts: Account[] = Array.from({ length: 4 }, (_, index) => ({
  id: `account-${index + 1}`,
  name: `Cuenta ${index + 1}`,
  order: index + 1,
}))

export async function initializeDatabase(database = db) {
  await database.transaction('rw', database.accounts, database.settings, async () => {
    if ((await database.accounts.count()) === 0) await database.accounts.bulkAdd(defaultAccounts)
    const settings = await database.settings.get('app-settings')
    if (!settings) await database.settings.add(defaultSettings)
    else if (settings.reminderPolicyVersion !== 1) await database.settings.put(upgradeReminderSettings(settings))
  })
}

export async function createAccount(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Escribe un nombre para la cuenta.')
  return db.transaction('rw', db.accounts, async () => {
    const accounts = await db.accounts.toArray()
    if (accounts.some((account) => account.name.trim().toLocaleLowerCase('es') === trimmed.toLocaleLowerCase('es'))) throw new Error('Ya existe una cuenta con ese nombre.')
    const account: Account = { id: newId(), name: trimmed, order: Math.max(0, ...accounts.map((item) => item.order)) + 1 }
    await db.accounts.add(account)
    return account
  })
}

export function newId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export type PersonInput = Pick<Person, 'accountId' | 'personNumber' | 'displayName' | 'phone' | 'devices' | 'joinDate' | 'paidMonths' | 'manuallyUnpaid' | 'needsReview' | 'reviewNotes'> & Pick<Person, 'suspended'>

export async function createPerson(input: PersonInput) {
  return db.transaction('rw', db.accounts, db.people, async () => {
    if (!(await db.accounts.get(input.accountId))) throw new Error('No se encontró la cuenta.')
    const people = await db.people.where('accountId').equals(input.accountId).toArray()
    const number = input.personNumber ?? firstAvailablePersonNumber(people)
    if (!Number.isInteger(number) || number < 1) throw new Error('El número de persona debe ser un entero mayor que cero.')
    if (people.some((person) => person.personNumber === number)) throw new Error(`El lugar ${number} ya está ocupado en esta cuenta. Usa el ${firstAvailablePersonNumber(people)}.`)
    const stamp = new Date().toISOString()
    const person: Person = { ...input, personNumber: number, suspended: input.suspended ?? false, id: newId(), createdAt: stamp, updatedAt: stamp }
    await db.people.add(person)
    return person
  })
}

export async function updatePerson(id: string, input: Partial<PersonInput>) {
  return db.transaction('rw', db.accounts, db.people, async () => {
    const current = await db.people.get(id)
    if (!current) throw new Error('No se encontró la persona.')
    const next = { ...current, ...input, updatedAt: new Date().toISOString() }
    if (!(await db.accounts.get(next.accountId))) throw new Error('No se encontró la cuenta.')
    if (next.accountId !== current.accountId || next.personNumber !== current.personNumber) {
      if (next.personNumber !== null && (!Number.isInteger(next.personNumber) || next.personNumber < 1)) throw new Error('Indica un número de persona válido.')
      const people = await db.people.where('accountId').equals(next.accountId).toArray()
      if (next.personNumber !== null && people.some((person) => person.id !== id && person.personNumber === next.personNumber)) throw new Error('Ese número ya está ocupado en la cuenta de destino.')
    }
    await db.people.put(next)
    return next
  })
}

export async function registerPayment(person: Person, months: number, paidAt = todayISO()) {
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new Error('Indica entre 1 y 120 meses.')
  if (!isISODate(paidAt)) throw new Error('Indica una fecha de pago válida.')
  return db.transaction('rw', db.people, db.payments, async () => {
  const current = await db.people.get(person.id)
  if (!current) throw new Error('No se encontró la persona. Vuelve a abrir su perfil.')
  const safeMonths = months
  const previousDueDate = nextPaymentDate(current.joinDate, current.paidMonths)
  const paidMonths = current.paidMonths + safeMonths
  const newDueDate = nextPaymentDate(current.joinDate, paidMonths)
  const payment: Payment = {
    id: newId(),
    personId: person.id,
    paidAt: new Date(`${paidAt}T12:00:00`).toISOString(),
    months: safeMonths,
    previousDueDate,
    newDueDate,
  }
    await db.people.update(person.id, { paidMonths, manuallyUnpaid: false, suspended: false, updatedAt: new Date().toISOString() })
    await db.payments.add(payment)
  return payment
  })
}

export async function deletePerson(id: string) {
  await db.transaction('rw', db.people, db.payments, async () => {
    await db.payments.where('personId').equals(id).delete()
    await db.people.delete(id)
  })
}

export async function nextPersonNumber(accountId: string) {
  return firstAvailablePersonNumber(await db.people.where('accountId').equals(accountId).toArray())
}
