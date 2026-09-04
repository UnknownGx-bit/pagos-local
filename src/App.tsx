import { useLiveQuery } from 'dexie-react-hooks'
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { createPerson, db, defaultSettings, nextPersonNumber, type PersonInput } from './db'
import { rescheduleNotifications } from './lib/notifications'
import { AppFrame } from './components/AppFrame'
import { Modal } from './components/Modal'
import { PersonForm } from './components/PersonForm'
import { ImportExcelDialog } from './components/ImportExcelDialog'
import { Welcome } from './screens/Welcome'
import { Dashboard } from './screens/Dashboard'
import { AccountView } from './screens/AccountView'
import { PersonView } from './screens/PersonView'
import { SettingsView } from './screens/SettingsView'
import { PaymentsView } from './screens/PaymentsView'
import { useWebMCP } from './hooks/useWebMCP'

function Application() {
  const navigate = useNavigate()
  const accountRows = useLiveQuery(() => db.accounts.orderBy('order').toArray(), [])
  const personRows = useLiveQuery(() => db.people.toArray(), [])
  const paymentRows = useLiveQuery(() => db.payments.toArray(), [])
  const settingsRow = useLiveQuery(() => db.settings.get('app-settings'), [])
  const accounts = accountRows ?? []
  const people = personRows ?? []
  const payments = paymentRows ?? []
  const settings = settingsRow ?? defaultSettings
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [suggestedAccountId, setSuggestedAccountId] = useState('account-1')
  const [suggestedNumber, setSuggestedNumber] = useState(1)
  const [toast, setToast] = useState('')
  useWebMCP()

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3_200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (settings.onboarded) void rescheduleNotifications(people, settings).catch(() => undefined)
  }, [people, settings])

  const afterMutation = useCallback((message: string) => {
    setToast(message)
  }, [])

  async function openAdd(accountId?: string) {
    const target = accountId ?? accounts[0]?.id ?? 'account-1'
    setSuggestedAccountId(target)
    setSuggestedNumber(await nextPersonNumber(target))
    setAddOpen(true)
  }

  async function addPerson(input: PersonInput) {
    const person = await createPerson(input)
    setAddOpen(false)
    afterMutation('Persona agregada.')
    navigate(`/persona/${person.id}`)
  }

  async function startEmpty() {
    await db.settings.update('app-settings', { onboarded: true })
    setToast('Las cuatro cuentas están listas.')
  }

  if (!accountRows || !personRows || !paymentRows || !settingsRow) {
    return <div className="loading-screen"><div className="welcome-mark">PL</div><span>Cargando tus datos…</span></div>
  }

  if (!settings.onboarded) {
    return <><Welcome onImport={() => setImportOpen(true)} onStart={() => void startEmpty()} /><ImportExcelDialog open={importOpen} accounts={accounts} onClose={() => setImportOpen(false)} onImported={afterMutation} /></>
  }

  return (
    <AppFrame onAddPerson={() => void openAdd()}>
      <Routes>
        <Route path="/" element={<Dashboard accounts={accounts} people={people} settings={settings} onAdd={(accountId) => void openAdd(accountId)} />} />
        <Route path="/cuenta/:accountId" element={<AccountView accounts={accounts} people={people} settings={settings} onAdd={(accountId) => void openAdd(accountId)} />} />
        <Route path="/persona/:personId" element={<PersonView accounts={accounts} people={people} payments={payments} settings={settings} afterMutation={afterMutation} />} />
        <Route path="/pagos" element={<PaymentsView accounts={accounts} people={people} settings={settings} />} />
        <Route path="/configuracion" element={<SettingsView accounts={accounts} settings={settings} onImportExcel={() => setImportOpen(true)} afterMutation={afterMutation} />} />
      </Routes>
      <Modal open={addOpen} title="Agregar persona" description="La fecha de ingreso se completa automáticamente y puedes cambiarla." onClose={() => setAddOpen(false)} size="large"><PersonForm key={`${suggestedAccountId}-${suggestedNumber}`} accounts={accounts} suggestedAccountId={suggestedAccountId} suggestedNumber={suggestedNumber} onSubmit={addPerson} onCancel={() => setAddOpen(false)} /></Modal>
      <ImportExcelDialog open={importOpen} accounts={accounts} onClose={() => setImportOpen(false)} onImported={afterMutation} />
      {toast && <div className="toast" role="status"><CheckCircle2 size={19} />{toast}</div>}
    </AppFrame>
  )
}

export function App() {
  return <HashRouter><Application /></HashRouter>
}
