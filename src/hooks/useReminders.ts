import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Account, AppSettings, Person } from '../types'
import { db } from '../db'
import { requestNotificationPermission, rescheduleNotifications } from '../lib/notifications'

export function useReminders(people: Person[], settings: AppSettings, today: string, accounts: Account[] = []) {
  const [resume, setResume] = useState(0)
  const [error, setError] = useState(false)
  const permissionStarted = useRef(false)
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setResume((value) => value + 1) }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
  }, [])
  useEffect(() => {
    if (!settings.onboarded || !Capacitor.isNativePlatform() || settings.notificationPrompted || permissionStarted.current) return
    permissionStarted.current = true
    void requestNotificationPermission().then(() => db.settings.update('app-settings', { notificationPrompted: true }))
      .catch(() => { permissionStarted.current = false })
  }, [settings.onboarded, settings.notificationPrompted])
  useEffect(() => {
    if (!settings.onboarded) return
    const timer = window.setTimeout(() => {
      void rescheduleNotifications(people, settings, accounts).then(() => setError(false)).catch(() => setError(true))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [people, settings, accounts, today, resume])
  return error
}
