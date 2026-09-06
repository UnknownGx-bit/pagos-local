import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HashRouter, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAppNavigation } from './useAppNavigation'
import { Modal } from '../components/Modal'

function Harness() {
  useAppNavigation()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  return <><output>{pathname}</output><Link to="/persona/test">Persona</Link><button onClick={() => setOpen(true)}>Editar</button><Modal open={open} title="Edición" onClose={() => setOpen(false)}>Formulario</Modal></>
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('navegación Android', () => {
  it('abre el perfil desde arriba y Atrás cierra el diálogo antes de volver', async () => {
    window.history.replaceState({ idx: 0 }, '', '/#/')
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(<HashRouter><Harness /></HashRouter>)
    scroll.mockClear()
    fireEvent.click(screen.getByText('Persona'))
    expect(screen.getByRole('status')).toHaveTextContent('/persona/test')
    expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
    fireEvent.click(screen.getByText('Editar'))
    expect(document.body.style.overflow).toBe('hidden')
    const back = new Event('pagos-native-back', { cancelable: true })
    act(() => { window.dispatchEvent(back) })
    expect(back.defaultPrevented).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(screen.getByRole('status')).toHaveTextContent('/persona/test')
    await act(async () => {
      window.dispatchEvent(new Event('pagos-native-back', { cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(screen.getByRole('status').textContent).toBe('/')
    const homeBack = new Event('pagos-native-back', { cancelable: true })
    act(() => { window.dispatchEvent(homeBack) })
    expect(homeBack.defaultPrevented).toBe(false)
  })

  it('vuelve a inicio si el perfil se abrió sin historial', () => {
    window.history.replaceState({ idx: 0 }, '', '/#/persona/test')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(<HashRouter><Harness /></HashRouter>)
    act(() => { window.dispatchEvent(new Event('pagos-native-back', { cancelable: true })) })
    expect(screen.getByRole('status').textContent).toBe('/')
  })
})
