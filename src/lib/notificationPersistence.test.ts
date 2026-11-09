import { Capacitor } from '@capacitor/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings, Person } from '../types'
import { rescheduleNotifications } from './notifications'

const native = vi.hoisted(() => ({ checkPermissions: vi.fn(), createChannel: vi.fn(), getPending: vi.fn(), schedule: vi.fn(), cancel: vi.fn() }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: native }))

const settings: AppSettings = { id: 'app-settings', reminderDaysBefore: 1, reminderTime: '10:00', onboarded: true }
const person: Person = { id: 'p', accountId: 'a', personNumber: 1, displayName: 'Persona 1', phone: '', devices: [], joinDate: '2026-11-11', paidMonths: 0, manuallyUnpaid: false, needsReview: false, reviewNotes: [], createdAt: '', updatedAt: '' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 9, 9))
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
  for (const mock of Object.values(native)) mock.mockReset()
  native.checkPermissions.mockResolvedValue({ display: 'granted' })
  native.getPending.mockResolvedValue({ notifications: [{ id: 700_000_001 }] })
  native.createChannel.mockResolvedValue(undefined)
  native.schedule.mockResolvedValue({ notifications: [] })
  native.cancel.mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('persistencia de avisos', () => {
  it('conserva el plan anterior si Android falla al programar uno nuevo', async () => {
    native.schedule.mockRejectedValueOnce(new Error('Fallo de Android'))
    await expect(rescheduleNotifications([person], settings)).rejects.toThrow('Fallo de Android')
    expect(native.cancel).not.toHaveBeenCalled()
    await rescheduleNotifications([person], settings)
    expect(native.schedule).toHaveBeenCalledTimes(2)
    expect(native.cancel).toHaveBeenCalledWith({ notifications: [{ id: 700_000_001 }] })
  })

  it('reprograma solo el estado más reciente y retira avisos de suspendidos', async () => {
    await Promise.all([
      rescheduleNotifications([person], settings),
      rescheduleNotifications([{ ...person, suspended: true }], settings),
    ])
    expect(native.schedule).not.toHaveBeenCalled()
    expect(native.cancel).toHaveBeenCalledOnce()
  })
})
