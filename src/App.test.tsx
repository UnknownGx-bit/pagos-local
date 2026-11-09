import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { createPerson, db, initializeDatabase } from './db'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await initializeDatabase()
  await db.settings.update('app-settings', { onboarded: true })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('flujo de cuenta y alta', () => {
  it('el + inferior toma la cuenta abierta y recalcula el lugar al cambiar de cuenta', async () => {
    const input = { accountId: 'account-2', personNumber: 1, displayName: 'Persona 1', phone: '', devices: [], joinDate: '2026-08-06' as const, paidMonths: 1, manuallyUnpaid: false, needsReview: false, reviewNotes: [] }
    await createPerson(input)
    await createPerson({ ...input, personNumber: 3 })
    await createPerson({ ...input, accountId: 'account-3', personNumber: 2 })
    window.history.replaceState({ idx: 0 }, '', '/#/cuenta/account-2')
    render(<App />)
    await screen.findByRole('heading', { name: 'Cuenta 2' })
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Agregar persona' }))
    const form = within(screen.getByRole('dialog'))
    expect(form.getByLabelText('Cuenta')).toHaveValue('account-2')
    expect(form.getByLabelText('Número')).toHaveValue(2)
    expect(form.getByLabelText('Nombre')).toHaveValue('Persona 2')
    fireEvent.change(form.getByLabelText('Cuenta'), { target: { value: 'account-3' } })
    await waitFor(() => expect(form.getByLabelText('Número')).toHaveValue(1))
    expect(form.getByLabelText('Nombre')).toHaveValue('Persona 1')
    fireEvent.click(form.getByRole('button', { name: 'Guardar persona' }))
    await waitFor(async () => expect(await db.people.count()).toBe(4))
    expect(await db.people.where('accountId').equals('account-3').count()).toBe(2)
    expect(await db.people.where('accountId').equals('account-2').count()).toBe(2)
  })

  it('crea una quinta cuenta desde Configuración y aparece inmediatamente en el alta', async () => {
    window.history.replaceState({ idx: 0 }, '', '/#/configuracion')
    render(<App />)
    await screen.findByRole('heading', { name: 'Configuración' })
    fireEvent.change(screen.getByLabelText('Nombre de la nueva cuenta'), { target: { value: 'Clientes nuevos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    await waitFor(async () => expect(await db.accounts.count()).toBe(5))
    await screen.findByDisplayValue('Clientes nuevos')
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Agregar persona' }))
    expect(within(screen.getByRole('dialog')).getByRole('option', { name: 'Clientes nuevos' })).toBeInTheDocument()
  })
})
