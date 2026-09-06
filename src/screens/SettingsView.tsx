import { ArrowLeft, BellRing, Download, FileDown, FileSpreadsheet, Info, RotateCcw, Save, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Account, AppSettings } from '../types'
import { db } from '../db'
import { exportBackup, exportToExcel, parseBackup, restoreBackup } from '../lib/backup'
import { notificationCapabilityLabel, requestNotificationPermission } from '../lib/notifications'
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
  const [names, setNames] = useState(Object.fromEntries(accounts.map((account) => [account.id, account.name])))
  const [days, setDays] = useState(settings.reminderDaysBefore)
  const [time, setTime] = useState(settings.reminderTime)
  const [restorePayload, setRestorePayload] = useState<ReturnType<typeof parseBackup> | null>(null)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState<'excel' | 'backup' | null>(null)

  async function save() {
    await db.transaction('rw', db.accounts, db.settings, async () => {
      await Promise.all(accounts.map((account) => db.accounts.update(account.id, { name: (names[account.id] || account.name).trim() })))
      await db.settings.update('app-settings', { reminderDaysBefore: Math.max(0, Math.trunc(days)), reminderTime: time })
    })
    afterMutation('Configuración guardada y recordatorios reprogramados.')
  }

  async function readBackup(file?: File) {
    if (!file) return
    setError('')
    try { setRestorePayload(parseBackup(await file.text())) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo leer la copia.') }
  }

  async function restore() {
    if (!restorePayload) return
    await restoreBackup(restorePayload)
    setRestorePayload(null)
    afterMutation('Copia restaurada correctamente.')
    navigate('/', { replace: true })
  }

  async function permissions() {
    const result = await requestNotificationPermission()
    afterMutation(result.display === 'granted' ? 'Permiso de notificaciones activado.' : notificationCapabilityLabel())
  }

  async function exportFile(kind: 'excel' | 'backup') {
    setError('')
    setExporting(kind)
    try {
      if (kind === 'excel') await exportToExcel(settings)
      else await exportBackup()
      afterMutation(kind === 'excel' ? 'Excel listo para guardar o compartir.' : 'Copia lista para guardar o compartir.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear el archivo.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <main>
      <header className="page-header"><button className="icon-button" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={20} /></button><div><span className="eyebrow">PAGOS LOCAL</span><h1>Configuración</h1><p>Cuenta, recordatorios y respaldo</p></div><span /></header>
      <section className="settings-section"><h2>Cuentas</h2><p>Cambia los nombres sin afectar a las personas.</p><div className="form-stack">{accounts.map((account, index) => <label key={account.id}>Cuenta {index + 1}<input value={names[account.id] ?? ''} onChange={(event) => setNames((current) => ({ ...current, [account.id]: event.target.value }))} /></label>)}</div></section>
      <section className="settings-section"><h2>Recordatorios</h2><p>Android reprograma las notificaciones locales después de cada cambio.</p><div className="form-row"><label>Días antes<input type="number" min="0" max="30" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label><label>Hora<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div><button className="settings-button" onClick={() => void permissions()}><BellRing /><span><strong>Permisos de notificaciones</strong><small>{notificationCapabilityLabel()}</small></span></button></section>
      <button className="primary-button large save-settings" onClick={() => void save()}><Save size={19} />Guardar configuración</button>
      <section className="settings-section"><h2>Importar y exportar</h2><div className="settings-actions"><button onClick={onImportExcel} disabled={Boolean(exporting)}><FileSpreadsheet /><span><strong>Importar Excel</strong><small>Vista previa y revisión de datos</small></span></button><button onClick={() => void exportFile('excel')} disabled={Boolean(exporting)}><FileDown /><span><strong>{exporting === 'excel' ? 'Preparando Excel…' : 'Exportar a Excel'}</strong><small>Personas, fechas y estados</small></span></button><button onClick={() => void exportFile('backup')} disabled={Boolean(exporting)}><Download /><span><strong>{exporting === 'backup' ? 'Preparando copia…' : 'Exportar copia'}</strong><small>Respaldo completo en JSON</small></span></button><button onClick={() => backupInput.current?.click()} disabled={Boolean(exporting)}><Upload /><span><strong>Importar copia</strong><small>Restaura todos los datos</small></span></button></div><input className="visually-hidden" ref={backupInput} type="file" accept="application/json,.json" onChange={(event) => void readBackup(event.target.files?.[0])} />{error && <p className="error-message">{error}</p>}</section>
      <section className="settings-section about-card"><Info /><div><h2>Pagos Local 1.2.1</h2><p>Los datos viven en IndexedDB y no se envían a ningún servidor. La PWA funciona sin conexión; las notificaciones programadas con la app cerrada están disponibles en Android.</p></div></section>
      <Modal open={Boolean(restorePayload)} title="¿Restaurar esta copia?" description="Esta acción reemplazará las cuentas, personas, pagos y configuración actuales." onClose={() => setRestorePayload(null)}><div className="confirm-actions"><button className="secondary-button" onClick={() => setRestorePayload(null)}>Cancelar</button><button className="danger-button" onClick={() => void restore()}><RotateCcw size={17} />Restaurar</button></div></Modal>
    </main>
  )
}
