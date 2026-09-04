import { describe, expect, it } from 'vitest'
import { addCalendarMonths, coveredPeriod, nextPaymentDate } from './dates'

describe('ciclos mensuales', () => {
  it('mantiene el día del ciclo para cero, uno y tres meses', () => {
    expect(nextPaymentDate('2026-08-06', 0)).toBe('2026-08-06')
    expect(nextPaymentDate('2026-08-06', 1)).toBe('2026-09-06')
    expect(nextPaymentDate('2026-08-06', 3)).toBe('2026-11-06')
    expect(coveredPeriod('2026-08-06', 1)).toEqual({ start: '2026-08-06', end: '2026-09-05' })
  })

  it('usa el último día válido sin perder el ancla del día 31', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addCalendarMonths('2026-01-31', 2)).toBe('2026-03-31')
  })

  it('maneja el 29 de febrero en año bisiesto', () => {
    expect(addCalendarMonths('2024-02-29', 12)).toBe('2025-02-28')
    expect(addCalendarMonths('2024-02-29', 48)).toBe('2028-02-29')
  })
})
