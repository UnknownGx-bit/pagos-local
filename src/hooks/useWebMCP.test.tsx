import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPerson, db, initializeDatabase } from '../db'
import { useWebMCP } from './useWebMCP'

interface RegisteredTool {
  name: string
  annotations?: { readOnlyHint?: boolean }
  execute(input: unknown): unknown | Promise<unknown>
}

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await initializeDatabase()
})

describe('WebMCP', () => {
  it('registra herramientas, ejecuta un pago y rechaza entradas inválidas', async () => {
    const tools: RegisteredTool[] = []
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool(tool: RegisteredTool) { tools.push(tool) } } })
    const person = await createPerson({ accountId: 'account-1', personNumber: 1, displayName: 'Persona 1', phone: '', devices: [], joinDate: '2026-08-06', paidMonths: 0, manuallyUnpaid: false, needsReview: false, reviewNotes: [] })
    const hook = renderHook(() => useWebMCP())
    await waitFor(() => expect(tools).toHaveLength(2))
    expect(tools.find((tool) => tool.name === 'list_due_payments')?.annotations?.readOnlyHint).toBe(true)
    const paymentTool = tools.find((tool) => tool.name === 'register_payment')
    await expect(paymentTool?.execute({ personId: person.id, months: 2 })).resolves.toMatchObject({ months: 2, nextDueDate: '2026-10-06' })
    expect((await db.people.get(person.id))?.paidMonths).toBe(2)
    await expect(paymentTool?.execute({ personId: person.id, months: 0 })).rejects.toThrow()
    hook.unmount()
    Object.defineProperty(document, 'modelContext', { configurable: true, value: undefined })
  })
})
