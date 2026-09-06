import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { dismissTopDialog } from '../lib/navigation'

export function useAppNavigation() {
  const location = useLocation()
  const navigate = useNavigate()

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])

  useEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])

  useEffect(() => {
    const back = (event: Event) => {
      if (dismissTopDialog()) {
        event.preventDefault()
      } else if (location.pathname !== '/') {
        event.preventDefault()
        if (Number(window.history.state?.idx) > 0) navigate(-1)
        else navigate('/', { replace: true })
      }
    }
    window.addEventListener('pagos-native-back', back)
    return () => window.removeEventListener('pagos-native-back', back)
  }, [location.pathname, navigate])
}
