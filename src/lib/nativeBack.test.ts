import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Execute the actual Java-embedded script, including the legacy-UI fallback.
const java = readFileSync('android/app/src/main/java/com/pagolocal/app/MainActivity.java', 'utf8')
const source = java.split('// Never interpret')[1]!.split('handled ->')[0]!
const script = [...source.matchAll(/"(?:\\.|[^"\\])*"/g)].map(([literal]) => JSON.parse(literal)).join('')
const back = () => window.eval(script)

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('puente nativo Atrás', () => {
  it('usa el historial aunque no exista el listener de React', () => {
    window.history.replaceState({ idx: 1 }, '', '/#/persona/test')
    const previous = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    expect(back()).toBe('handled')
    expect(previous).toHaveBeenCalledOnce()
  })
  it('vuelve a Inicio sin historial, nunca sale desde un perfil', () => {
    window.history.replaceState({ idx: 0 }, '', '/#/persona/test')
    expect(back()).toBe('handled')
    expect(window.location.hash).toBe('#/')
  })
  it('cierra un formulario antiguo antes de navegar', () => {
    window.history.replaceState({ idx: 0 }, '', '/#/')
    document.body.innerHTML = '<main></main><section role="dialog"><button aria-label="Cerrar">Cerrar</button></section>'
    const close = vi.fn()
    document.querySelector('button')!.addEventListener('click', close)
    expect(back()).toBe('handled')
    expect(close).toHaveBeenCalledOnce()
  })
  it('solo permite salir desde Inicio cargado y respeta a React', () => {
    window.history.replaceState({ idx: 0 }, '', '/#/')
    expect(back()).toBe('loading')
    document.body.innerHTML = '<main></main>'
    expect(back()).toBe('home')
    const listener = (event: Event) => event.preventDefault()
    window.addEventListener('pagos-native-back', listener)
    try { expect(back()).toBe('handled') }
    finally { window.removeEventListener('pagos-native-back', listener) }
  })
})
