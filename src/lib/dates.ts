import type { ISODate } from '../types'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isISODate(value: string): value is ISODate {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(year, month - 1, day)
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day
}

export function dateParts(value: ISODate) {
  const match = DATE_PATTERN.exec(value)
  if (!match) throw new Error(`Fecha inválida: ${value}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as ISODate
}

export function todayISO(now = new Date()): ISODate {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

/**
 * Avanza meses desde la fecha original conservando su día como ancla.
 * Si el día no existe en el mes de destino, usa el último día válido.
 */
export function addCalendarMonths(anchor: ISODate, months: number): ISODate {
  const { year, month, day } = dateParts(anchor)
  const monthIndex = month - 1 + months
  const targetYear = year + Math.floor(monthIndex / 12)
  const normalizedMonthIndex = ((monthIndex % 12) + 12) % 12
  const targetMonth = normalizedMonthIndex + 1
  return toISODate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)))
}

export function addDays(value: ISODate, days: number): ISODate {
  const { year, month, day } = dateParts(value)
  const date = new Date(year, month - 1, day + days)
  return toISODate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function nextPaymentDate(joinDate: ISODate, paidMonths: number): ISODate {
  return addCalendarMonths(joinDate, Math.max(0, Math.trunc(paidMonths)))
}

export function coveredPeriod(joinDate: ISODate, paidMonths: number) {
  if (paidMonths <= 0) return null
  return { start: joinDate, end: addDays(nextPaymentDate(joinDate, paidMonths), -1) }
}

export function compareDates(left: ISODate, right: ISODate) {
  return left.localeCompare(right)
}

export function daysBetween(from: ISODate, to: ISODate) {
  const a = dateParts(from)
  const b = dateParts(to)
  const fromUtc = Date.UTC(a.year, a.month - 1, a.day)
  const toUtc = Date.UTC(b.year, b.month - 1, b.day)
  return Math.round((toUtc - fromUtc) / 86_400_000)
}

export function formatDate(value: ISODate, options?: Intl.DateTimeFormatOptions) {
  const { year, month, day } = dateParts(value)
  return new Intl.DateTimeFormat('es-MX', options ?? { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day))
    .replace('.', '')
}

export function localDateTime(value: ISODate, time: string) {
  const { year, month, day } = dateParts(value)
  const [hours = 10, minutes = 0] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}
