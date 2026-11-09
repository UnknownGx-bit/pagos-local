import type { Account, Person } from '../types'

export function firstAvailablePersonNumber(people: Pick<Person, 'personNumber'>[]) {
  const occupied = new Set(people.map((person) => person.personNumber).filter((value): value is number => Number.isInteger(value) && Number(value) > 0))
  let number = 1
  while (occupied.has(number)) number += 1
  return number
}

export function accountForNewPerson(pathname: string, accounts: Account[], people: Person[]) {
  const [, section, id] = pathname.split('/')
  const candidate = section === 'cuenta' ? id : section === 'persona' ? people.find((person) => person.id === id)?.accountId : undefined
  return accounts.find((account) => account.id === candidate)?.id ?? accounts[0]?.id ?? ''
}
