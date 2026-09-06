import Dexie, { type EntityTable } from 'dexie'
import type { Account, AppSettings, Payment, Person } from './types'
import { nextPaymentDate, todayISO } from './lib/dates'

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
  reminderDaysBefore: 2,
  reminderTime: '10:00',
  onboarded: false,
}

export const defaultAccounts: Account[] = Array.from({ length: 4 }, (_, index) => ({
  id: `account-${index + 1}`,
  name: `Cuenta ${index + 1}`,
  order: index + 1,
}))

export async function initializeDatabase() {
  await db.transaction('rw', db.accounts, db.settings, async () => {
    if ((await db.accounts.count()) === 0) await db.accounts.bulkAdd(defaultAccounts)
    if (!(await db.settings.get('app-settings'))) await db.settings.add(defaultSettings)
  })
}

export function newId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export type PersonInput = Pick<Person, 'accountId' | 'personNumber' | 'displayName' | 'phone' | 'devices' | 'joinDate' | 'paidMonths' | 'manuallyUnpaid' | 'needsReview' | 'reviewNotes'> & Pick<Person, 'suspended'>

export async function createPerson(input: PersonInput) {
  const stamp = new Date().toISOString()
  const person: Person = { ...input, suspended: input.suspended ?? false, id: newId(), createdAt: stamp, updatedAt: stamp }
  await db.people.add(person)
  return person
}

export async function updatePerson(id: string, input: Partial<PersonInput>) {
  await db.people.update(id, { ...input, updatedAt: new Date().toISOString() })
  return db.people.get(id)
}

export async function registerPayment(person: Person, months: number, paidAt = todayISO()) {
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new Error('Indica entre 1 y 120 meses.')
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
  const values = (await db.people.where('accountId').equals(accountId).toArray())
    .map((person) => person.personNumber ?? 0)
  return Math.max(0, ...values) + 1
}
