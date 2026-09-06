import { daysBetween, nextPaymentDate, todayISO } from './dates'
import type { AppSettings, PaymentStatus, Person } from '../types'

export function getPaymentStatus(
  person: Person,
  settings: Pick<AppSettings, 'reminderDaysBefore'>,
  today = todayISO(),
): PaymentStatus {
  if (person.suspended) return 'suspended'
  if (person.manuallyUnpaid) return 'manual-unpaid'
  const due = nextPaymentDate(person.joinDate, person.paidMonths)
  const remaining = daysBetween(today, due)
  if (remaining < 0) return 'overdue'
  if (remaining === 0) return 'due-today'
  if (remaining <= settings.reminderDaysBefore) return 'upcoming'
  return 'current'
}

export const statusLabels: Record<PaymentStatus, string> = {
  suspended: 'Suspendido',
  current: 'Al corriente',
  upcoming: 'Próximo a pagar',
  'due-today': 'Vence hoy',
  overdue: 'Atrasado',
  'manual-unpaid': 'No ha pagado',
}

export function statusPriority(status: PaymentStatus) {
  return { 'manual-unpaid': 0, overdue: 1, 'due-today': 2, upcoming: 3, current: 4, suspended: 5 }[status]
}
