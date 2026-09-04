import { describe, expect, it } from 'vitest'
import type { Person } from '../types'
import { getPaymentStatus } from './status'

const base: Person = { id: 'p', accountId: 'a', personNumber: 1, displayName: 'Persona 1', phone: '', devices: [], joinDate: '2026-09-05', paidMonths: 0, manuallyUnpaid: false, needsReview: false, reviewNotes: [], createdAt: '', updatedAt: '' }

describe('estado de pago', () => {
  it('distingue vencido, próximo y marca manual', () => {
    expect(getPaymentStatus({ ...base, joinDate: '2026-09-02' }, { reminderDaysBefore: 2 }, '2026-09-03')).toBe('overdue')
    expect(getPaymentStatus(base, { reminderDaysBefore: 2 }, '2026-09-03')).toBe('upcoming')
    expect(getPaymentStatus({ ...base, joinDate: '2026-09-03' }, { reminderDaysBefore: 2 }, '2026-09-03')).toBe('due-today')
    expect(getPaymentStatus({ ...base, manuallyUnpaid: true }, { reminderDaysBefore: 2 }, '2026-09-03')).toBe('manual-unpaid')
  })
})
