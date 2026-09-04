import { describe, expect, it } from 'vitest'
import { whatsappPhone, whatsappReminderMessage, whatsappReminderUrl } from './whatsapp'

describe('WhatsApp reminders', () => {
  it('adds the Mexico country code to ten-digit numbers', () => {
    expect(whatsappPhone('951 335 3760')).toBe('529513353760')
    expect(whatsappPhone('+52 221 438 0516')).toBe('522214380516')
  })

  it('uses the actual number of remaining days', () => {
    expect(whatsappReminderMessage('2026-09-05', '2026-09-03')).toContain('quedan 2 días de servicio')
    expect(whatsappReminderMessage('2026-09-04', '2026-09-03')).toContain('queda 1 día')
  })

  it('uses the expired message on and after the due date', () => {
    expect(whatsappReminderMessage('2026-09-03', '2026-09-03')).toContain('suscripción de ChatGPT venció')
    expect(whatsappReminderMessage('2026-09-02', '2026-09-03')).toContain('suscripción de ChatGPT venció')
  })

  it('encodes the message into the direct WhatsApp link', () => {
    const url = whatsappReminderUrl('9513353760', '2026-09-05', '2026-09-03')
    expect(url).toMatch(/^https:\/\/wa\.me\/529513353760\?text=/)
    expect(decodeURIComponent(url)).toContain('ChatGPT le quedan 2 días')
  })
})
