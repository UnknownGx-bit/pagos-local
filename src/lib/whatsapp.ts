import type { ISODate } from '../types'
import { daysBetween, todayISO } from './dates'

export function whatsappPhone(phone: string) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10) digits = `52${digits}`
  return digits
}

export function whatsappReminderMessage(dueDate: ISODate, today = todayISO()) {
  const remainingDays = daysBetween(today, dueDate)
  if (remainingDays > 0) {
    const remainingPhrase = remainingDays === 1 ? 'le queda 1 día' : `le quedan ${remainingDays} días`
    return `Hola, buen día 😃. Paso a recordarte que a tu suscripción de ChatGPT ${remainingPhrase} de servicio.\n¿Te gustaría renovar para el próximo mes? Me avisas para dejarlo listo de una vez. ¡Saludos!`
  }
  return 'Hola, buen día 😃. Paso a recordarte que tu suscripción de ChatGPT venció.\n¿Te gustaría renovar para el próximo mes? Me avisas para dejarlo listo de una vez. ¡Saludos!'
}

export function whatsappReminderUrl(phone: string, dueDate: ISODate, today = todayISO()) {
  const number = whatsappPhone(phone)
  if (!number) return ''
  return `https://wa.me/${number}?text=${encodeURIComponent(whatsappReminderMessage(dueDate, today))}`
}
