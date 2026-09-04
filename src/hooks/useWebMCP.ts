import { useEffect } from 'react'
import { db, registerPayment } from '../db'
import { formatDate, nextPaymentDate, todayISO } from '../lib/dates'
import { getPaymentStatus, statusLabels } from '../lib/status'

interface ModelContext {
  registerTool(tool: {
    name: string
    title?: string
    description: string
    inputSchema: object
    annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
    execute(input: unknown): unknown | Promise<unknown>
  }, options?: { signal?: AbortSignal }): void | Promise<void>
}

declare global {
  interface Document { readonly modelContext?: ModelContext }
}

export function useWebMCP() {
  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool) return
    const lifecycle = new AbortController()
    const register = async () => {
      await context.registerTool({
        name: 'list_due_payments',
        title: 'Listar pagos próximos',
        description: 'Lista las personas con pagos vencidos, para hoy o próximos, usando los datos locales visibles en la aplicación.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        async execute() {
          const [people, settings] = await Promise.all([db.people.toArray(), db.settings.get('app-settings')])
          if (!settings) throw new Error('Falta la configuración de la aplicación.')
          return people.map((person) => {
            const status = getPaymentStatus(person, settings)
            return { id: person.id, person: person.displayName, dueDate: nextPaymentDate(person.joinDate, person.paidMonths), status: statusLabels[status] }
          }).filter((item) => item.status !== 'Al corriente').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        },
      }, { signal: lifecycle.signal })
      await context.registerTool({
        name: 'register_payment',
        title: 'Registrar pago',
        description: 'Registra uno o más meses pagados para una persona existente y actualiza su vencimiento e historial.',
        inputSchema: { type: 'object', properties: { personId: { type: 'string' }, months: { type: 'integer', minimum: 1, maximum: 120 } }, required: ['personId', 'months'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const value = input as { personId?: unknown; months?: unknown }
          if (typeof value.personId !== 'string' || !Number.isInteger(value.months) || Number(value.months) < 1 || Number(value.months) > 120) throw new Error('Se requiere personId y una cantidad de meses entre 1 y 120.')
          const person = await db.people.get(value.personId)
          if (!person) throw new Error('No se encontró la persona.')
          const payment = await registerPayment(person, Number(value.months), todayISO())
          return { person: person.displayName, months: payment.months, nextDueDate: payment.newDueDate, nextDueLabel: formatDate(payment.newDueDate) }
        },
      }, { signal: lifecycle.signal })
    }
    void register().catch(() => undefined)
    return () => lifecycle.abort()
  }, [])
}
