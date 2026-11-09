import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { flushSync } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { dismissTopDialog } from '../lib/navigation'

export function useAppNavigation(native = Capacitor.isNativePlatform()) {
  const location = useLocation()
  const navigate = useNavigate()
  const action = useNavigationType()
  const entries = useRef([location.key])
  const entryIndex = useRef(0)
  const current = useRef({ pathname: location.pathname, navigate, native })
  current.current = { pathname: location.pathname, navigate, native }

  useLayoutEffect(() => {
    if (entries.current[entryIndex.current] !== location.key) {
      if (action === 'PUSH') {
        entries.current = [...entries.current.slice(0, entryIndex.current + 1), location.key]
        entryIndex.current += 1
      } else if (action === 'REPLACE') entries.current[entryIndex.current] = location.key
      else entryIndex.current = Math.max(0, entries.current.indexOf(location.key))
    }
    document.documentElement.dataset.appRoute = location.pathname
    document.documentElement.dataset.appRouter = native ? 'memory' : 'hash'
  }, [action, location.key, location.pathname, native])

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])

  useEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])

  useLayoutEffect(() => {
    const back = (event: Event) => {
      // MemoryRouter updates synchronously; no WebView popstate round-trip.
      flushSync(() => {
        if (dismissTopDialog()) event.preventDefault()
        else if (current.current.pathname !== '/') {
          event.preventDefault()
          const hasPrevious = current.current.native ? entryIndex.current > 0 : Number(window.history.state?.idx) > 0
          if (hasPrevious) current.current.navigate(-1)
          else current.current.navigate('/', { replace: true })
        }
      })
    }
    window.addEventListener('pagos-native-back', back)
    return () => window.removeEventListener('pagos-native-back', back)
  }, [])
}
