import { describe, expect, it } from 'vitest'
import type { AppSettings, Person } from '../types'
import { buildNotificationSchedule } from './notifications'

const settings: AppSettings = { id: 'app-settings', reminderDaysBefore: 2, reminderTime: '10:00', onboarded: true }
const person = (id: string, name: string): Person => ({ id, accountId: 'a', personNumber: 1, displayName: name, phone: '', devices: [], joinDate: '2026-09-13', paidMonths: 0, manuallyUnpaid: false, needsReview: false, reviewNotes: [], createdAt: '', updatedAt: '' })

describe('notificaciones locales', () => {
  it('agrupa personas del mismo vencimiento y programa dos días antes', () => {
    const result = buildNotificationSchedule([person('1', 'Persona 1'), person('2', 'Persona 2')], settings, new Date(2026, 8, 1))
    expect(result).toHaveLength(1)
    expect(result[0]?.body).toContain('2 personas')
    expect(result[0]?.schedule?.at?.getDate()).toBe(11)
  })

  it('no programa una marca manual ni una fecha pasada', () => {
    expect(buildNotificationSchedule([{ ...person('1', 'Persona 1'), manuallyUnpaid: true }], settings, new Date(2026, 8, 1))).toHaveLength(0)
    expect(buildNotificationSchedule([{ ...person('1', 'Persona 1'), suspended: true }], settings, new Date(2026, 8, 1))).toHaveLength(0)
    expect(buildNotificationSchedule([person('1', 'Persona 1')], settings, new Date(2026, 8, 12))).toHaveLength(0)
  })
})
