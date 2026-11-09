import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import type { Account, AppSettings, Person } from '../types'
import { addDays, formatDate, localDateTime, nextPaymentDate } from './dates'

function notificationId(date: string) {
  return 700_000_000 + Number(date.replaceAll('-', ''))
}

export function buildNotificationSchedule(
  people: Person[],
  settings: AppSettings,
  now = new Date(),
  accounts: Account[] = [],
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
    const names = duePeople.map((person) => {
      const account = accounts.find((item) => item.id === person.accountId)
      return account ? `${person.displayName} (${account.name})` : person.displayName
    })
    const when = settings.reminderDaysBefore === 1 ? 'mañana' : settings.reminderDaysBefore === 0 ? 'hoy' : `en ${settings.reminderDaysBefore} días`
    const body = duePeople.length === 1
      ? `${names[0]} vence ${when}. Fecha: ${formatDate(dueDate as never, { day: 'numeric', month: 'long' })}.`
      : `${duePeople.length} personas vencen ${when}: ${names.join(', ')}. Fecha: ${formatDate(dueDate as never, { day: 'numeric', month: 'long' })}.`
    return {
      id: notificationId(dueDate),
      title: 'Pagos próximos',
      body,
      schedule: { at: localDateTime(addDays(dueDate as never, -settings.reminderDaysBefore), settings.reminderTime), allowWhileIdle: true },
      extra: { dueDate, personIds: duePeople.map((person) => person.id) },
      smallIcon: 'ic_stat_payments',
      channelId: 'pagos-vencimientos',
    }
  })
}

export async function requestNotificationPermission(exact = true) {
  if (!Capacitor.isNativePlatform()) return { display: 'unsupported' as const }
  const permission = await LocalNotifications.requestPermissions()
  if (exact && permission.display === 'granted' && Capacitor.getPlatform() === 'android') {
    const exact = await LocalNotifications.checkExactNotificationSetting()
    if (exact.exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting()
  }
  return permission
}

let scheduleQueue: Promise<unknown> = Promise.resolve()
let latestRevision = 0
let lastSignature = ''

export function rescheduleNotifications(people: Person[], settings: AppSettings, accounts: Account[] = []) {
  const revision = ++latestRevision
  const task = scheduleQueue.then(() => revision === latestRevision ? applyNotificationSchedule(people, settings, accounts) : { native: Capacitor.isNativePlatform(), scheduled: 0 })
  scheduleQueue = task.catch(() => undefined)
  return task
}

async function applyNotificationSchedule(people: Person[], settings: AppSettings, accounts: Account[]) {
  if (!Capacitor.isNativePlatform()) return { native: false, scheduled: 0 }
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') { lastSignature = ''; return { native: true, scheduled: 0 } }
  if (Capacitor.getPlatform() === 'android') await LocalNotifications.createChannel({ id: 'pagos-vencimientos', name: 'Vencimientos de suscripciones', description: 'Avisos de próximos pagos', importance: 4, visibility: 0, vibration: true })
  const pending = await LocalNotifications.getPending()
  const notifications = buildNotificationSchedule(people, settings, new Date(), accounts)
  const signature = JSON.stringify(notifications)
  const desiredIds = new Set(notifications.map((item) => item.id))
  const existingIds = new Set(pending.notifications.map((item) => item.id))
  const obsolete = pending.notifications.filter((item) => item.id >= 700_000_000 && item.id < 800_000_000 && !desiredIds.has(item.id))
  if (signature !== lastSignature || notifications.some((item) => !existingIds.has(item.id))) {
    // Replace desired alarms first; a scheduling failure must not wipe the old plan.
    if (notifications.length) await LocalNotifications.schedule({ notifications })
    lastSignature = signature
  }
  if (obsolete.length) await LocalNotifications.cancel({ notifications: obsolete })
  return { native: true, scheduled: notifications.length }
}

export async function getNotificationStatus() {
  if (!Capacitor.isNativePlatform()) return { display: 'unsupported', exact: false }
  const permission = await LocalNotifications.checkPermissions()
  const exact = Capacitor.getPlatform() !== 'android' || (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'
  return { display: permission.display, exact }
}

export function notificationCapabilityLabel() {
  return Capacitor.isNativePlatform()
    ? 'Las notificaciones locales están disponibles en este dispositivo.'
    : 'La PWA funciona sin internet, pero las notificaciones programadas con la app cerrada requieren la versión Android.'
}
