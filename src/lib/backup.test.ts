import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup'

describe('compatibilidad de copias', () => {
  it('acepta copias anteriores y activa el nuevo campo de suspensión de forma segura', () => {
    const payload = {
      format: 'pagos-local-backup',
      version: 1,
      exportedAt: '2026-09-05T12:00:00.000Z',
      accounts: [{ id: 'a', name: 'Cuenta 1', order: 1 }],
      people: [{ id: 'p', accountId: 'a', personNumber: 1, displayName: 'Persona 1', phone: '', devices: [], joinDate: '2026-09-02', paidMonths: 0, manuallyUnpaid: false, needsReview: false, reviewNotes: [], createdAt: '', updatedAt: '' }],
      payments: [],
      settings: { id: 'app-settings', reminderDaysBefore: 2, reminderTime: '10:00', onboarded: true },
    }

    expect(parseBackup(JSON.stringify(payload)).people[0]?.suspended).toBe(false)
    expect(() => parseBackup(JSON.stringify({ ...payload, settings: { ...payload.settings, reminderTime: '' } }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...payload, accounts: [] }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...payload, people: [{ ...payload.people[0], devices: null }] }))).toThrow()
  })
})
