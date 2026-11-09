import { ArrowLeft, BellRing, Download, FileDown, FileSpreadsheet, Info, Plus, RotateCcw, Save, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Account, AppSettings } from '../types'
import { createAccount, db } from '../db'
import { exportBackup, exportToExcel, parseBackup, restoreBackup } from '../lib/backup'
import { getNotificationStatus, requestNotificationPermission, rescheduleNotifications } from '../lib/notifications'
import { Modal } from '../components/Modal'

interface SettingsViewProps {
  accounts: Account[]
  settings: AppSettings
  onImportExcel: () => void
  afterMutation: (message: string) => void
}

export function SettingsView({ accounts, settings, onImportExcel, afterMutation }: SettingsViewProps) {
  const navigate = useNavigate()
  const backupInput = useRef<HTMLInputElement>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [newAccountName, setNewAccountName] = useState('')
  const [days, setDays] = useState(settings.reminderDaysBefore)
  const [time, setTime] = useState(settings.reminderTime)
  const [restorePayload, setRestorePayload] = useState<ReturnType<typeof parseBackup> | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const busyRef = useRef(false)
  const [notificationStatus, setNotificationStatus] = useState<Awaited<ReturnType<typeof getNotificationStatus>> | null>(null)

  useEffect(() => {
    let active = true
    const refresh = () => { void getNotificationStatus().then((status) => { if (active) setNotificationStatus(status) }).catch(() => undefined) }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  async function run(label: string, action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(label)
    setError('')
    try { await action() }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No se pudo completar la operación.'
      if (!/share cancel(?:ed|led)/i.test(message)) setError(message)
    } finally { busyRef.current = false; setBusy(null) }
  }

  async function save() {
    await run('save', async () => {
      if (!Number.isInteger(days) || days < 0 || days > 30 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Indica de 0 a 30 días y una hora válida.')
      await db.transaction('rw', db.accounts, db.settings, async () => {
        await Promise.all(accounts.map((account) => db.accounts.update(account.id, { name: (names[account.id] ?? account.name).trim() || account.name })))
        await db.settings.update('app-settings', { reminderDaysBefore: days, reminderTime: time, reminderPolicyVersion: 1 })
      })
      afterMutation('Configuración guardada.')
    })
  }

  let nextAccountNumber = 1
  while (accounts.some((account) => account.name.trim().toLowerCase() === `cuenta ${nextAccountNumber}`)) nextAccountNumber += 1
  const suggestedName = `Cuenta ${nextAccountNumber}`

  async function addAccount() {
    await run('account', async () => {
      const account = await createAccount(newAccountName.trim() || suggestedName)
      setNewAccountName('')
      afterMutation(`${account.name} creada. Ya puedes agregar personas.`)
    })
  }

  async function readBackup(file?: File) {
    if (!file) return
    setError('')
    try { setRestorePayload(parseBackup(await file.text())) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo leer la copia.') }
  }

  async function restore() {
    if (!restorePayload) return
    await run('restore', async () => {
      await restoreBackup(restorePayload)
      setRestorePayload(null)
      afterMutation('Copia restaurada correctamente.')
      navigate('/', { replace: true })
    })
  }

  async function permissions() {
    await run('permissions', async () => {
      await requestNotificationPermission()
      await db.settings.update('app-settings', { notificationPrompted: true })
      const status = await getNotificationStatus()
      setNotificationStatus(status)
      if (status.display === 'granted') {
        await rescheduleNotifications(await db.people.toArray(), settings, accounts)
        afterMutation(status.exact ? 'Avisos activados y programados.' : 'Activa también Alarmas y recordatorios para respetar la hora exacta.')
      } else afterMutation('Permite las notificaciones de Pagos Local en los ajustes de Android.')
    })
  }

  async function exportFile(kind: 'excel' | 'backup') {
    await run(kind, async () => {
      if (kind === 'excel') await exportToExcel(settings)
      else await exportBackup()
      afterMutation(kind === 'excel' ? 'Excel listo para guardar o compartir.' : 'Copia lista para guardar o compartir.')
    })
  }

  const notificationLabel = notificationStatus?.display === 'unsupported' ? 'Los avisos con la app cerrada están disponibles en el APK Android.'
    : notificationStatus?.display !== 'granted' ? 'Permite las notificaciones para recibir los avisos.'
      : !notificationStatus.exact ? 'Activa Alarmas y recordatorios para que lleguen a la hora indicada.' : 'Notificaciones y hora exacta activadas.'

  return (
    <main>
      <header className="page-header"><button className="icon-button" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={20} /></button><div><span className="eyebrow">PAGOS LOCAL</span><h1>Configuración</h1><p>Cuentas, recordatorios y respaldo</p></div><span /></header>
      {error && <p className="error-message" role="alert">{error}</p>}
      <section className="settings-section">
        <h2>Cuentas</h2><p>Cambia sus nombres o crea una cuenta nueva.</p>
        <div className="form-stack">{accounts.map((account, index) => <label key={account.id}>Cuenta {index + 1}<input value={names[account.id] ?? account.name} onChange={(event) => setNames((current) => ({ ...current, [account.id]: event.target.value }))} /></label>)}</div>
        <form className="account-create form-stack" onSubmit={(event) => { event.preventDefault(); void addAccount() }}>
          <label>Nombre de la nueva cuenta<input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} placeholder={suggestedName} maxLength={80} /></label>
          <button className="secondary-button large" disabled={Boolean(busy)} type="submit"><Plus size={19} />{busy === 'account' ? 'Creando cuenta…' : 'Crear cuenta'}</button>
        </form>
      </section>
      <section className="settings-section">
        <h2>Recordatorios</h2><p>Recibe un aviso un día antes del vencimiento, a las 10:00 de la mañana. Puedes cambiar este horario.</p>
        <div className="form-row"><label>Días antes<input type="number" min="0" max="30" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label><label>Hora<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div>
        <button className="settings-button" disabled={Boolean(busy)} onClick={() => void permissions()}><BellRing /><span><strong>Activar avisos y hora exacta</strong><small>{notificationLabel}</small></span></button>
      </section>
      <button className="primary-button large save-settings" disabled={Boolean(busy)} onClick={() => void save()}><Save size={19} />{busy === 'save' ? 'Guardando…' : 'Guardar configuración'}</button>
      <section className="settings-section"><h2>Importar y exportar</h2><div className="settings-actions">
        <button onClick={onImportExcel} disabled={Boolean(busy)}><FileSpreadsheet /><span><strong>Importar Excel</strong><small>Vista previa y revisión de datos</small></span></button>
        <button onClick={() => void exportFile('excel')} disabled={Boolean(busy)}><FileDown /><span><strong>{busy === 'excel' ? 'Preparando Excel…' : 'Exportar a Excel'}</strong><small>Personas, fechas y estados</small></span></button>
        <button onClick={() => void exportFile('backup')} disabled={Boolean(busy)}><Download /><span><strong>{busy === 'backup' ? 'Preparando copia…' : 'Exportar copia'}</strong><small>Cuentas, personas, pagos y configuración</small></span></button>
        <button onClick={() => backupInput.current?.click()} disabled={Boolean(busy)}><Upload /><span><strong>Importar copia</strong><small>Restaura todos los datos</small></span></button>
      </div><input className="visually-hidden" ref={backupInput} type="file" accept="application/json,.json" onChange={(event) => { void readBackup(event.target.files?.[0]); event.target.value = '' }} /></section>
      <section className="settings-section about-card"><Info /><div><h2>Pagos Local 1.4.0</h2><p>Tus datos se guardan en este dispositivo. Exporta una copia para conservar también un respaldo externo.</p></div></section>
      <Modal open={Boolean(restorePayload)} title="¿Restaurar esta copia?" description="Reemplazará las cuentas, personas, pagos y configuración actuales." onClose={() => { if (!busyRef.current) setRestorePayload(null) }}>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="confirm-actions"><button className="secondary-button" disabled={Boolean(busy)} onClick={() => setRestorePayload(null)}>Cancelar</button><button className="danger-button" disabled={Boolean(busy)} onClick={() => void restore()}><RotateCcw size={17} />{busy === 'restore' ? 'Restaurando…' : 'Restaurar'}</button></div>
      </Modal>
    </main>
  )
}
