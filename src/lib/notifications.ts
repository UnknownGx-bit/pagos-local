import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import type { AppSettings, Person } from '../types'
import { addDays, formatDate, localDateTime, nextPaymentDate, todayISO } from './dates'

function notificationId(date: string) {
  return 700_000_000 + Number(date.replaceAll('-', ''))
}

export function buildNotificationSchedule(
  people: Person[],
  settings: AppSettings,
  now = new Date(),
): LocalNotificationSchema[] {
  const grouped = new Map<string, Person[]>()
  for (const person of people) {
    if (person.manuallyUnpaid || person.suspended) continue
    const dueDate = nextPaymentDate(person.joinDate, person.paidMonths)
    const reminderDate = addDays(dueDate, -settings.reminderDaysBefore)
    const at = localDateTime(reminderDate, settings.reminderTime)
    if (at.getTime() <= now.getTime()) continue
    const group = grouped.get(dueDate) ?? []
    group.push(person)
    grouped.set(dueDate, group)
  }

  return [...grouped.entries()].map(([dueDate, duePeople]) => {
    const names = duePeople.map((person) => person.displayName)
    const body = duePeople.length === 1
      ? `${names[0]} debe pagar en ${settings.reminderDaysBefore} días. Fecha: ${formatDate(dueDate as never, { day: 'numeric', month: 'long' })}.`
      : `${duePeople.length} personas deben pagar en ${settings.reminderDaysBefore} días: ${names.join(', ')}. Fecha: ${formatDate(dueDate as never, { day: 'numeric', month: 'long' })}.`
    return {
      id: notificationId(dueDate),
      title: 'Pagos próximos',
      body,
      schedule: { at: localDateTime(addDays(dueDate as never, -settings.reminderDaysBefore), settings.reminderTime), allowWhileIdle: true },
      extra: { dueDate, personIds: duePeople.map((person) => person.id) },
      smallIcon: 'ic_stat_payments',
    }
  })
}

export async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return { display: 'unsupported' as const }
  const permission = await LocalNotifications.requestPermissions()
  if (permission.display === 'granted' && Capacitor.getPlatform() === 'android') {
    const exact = await LocalNotifications.checkExactNotificationSetting()
    if (exact.exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting()
  }
  return permission
}

export async function rescheduleNotifications(people: Person[], settings: AppSettings) {
  if (!Capacitor.isNativePlatform()) return { native: false, scheduled: 0 }
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return { native: true, scheduled: 0 }
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications })
  const notifications = buildNotificationSchedule(people, settings)
  if (notifications.length) await LocalNotifications.schedule({ notifications })
  return { native: true, scheduled: notifications.length }
}

export function notificationCapabilityLabel() {
  return Capacitor.isNativePlatform()
    ? 'Las notificaciones locales están disponibles en este dispositivo.'
    : 'La PWA funciona sin internet, pero las notificaciones programadas con la app cerrada requieren la versión Android.'
}
