import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Account, ISODate, Person } from '../types'
import type { PersonInput } from '../db'
import { Stepper } from './Stepper'
import { todayISO } from '../lib/dates'
import { personReviewNotes } from '../lib/personReview'

interface PersonFormProps {
  accounts: Account[]
  initial?: Person
  suggestedAccountId?: string
  suggestedNumber?: number
  submitLabel?: string
  onSubmit: (input: PersonInput) => Promise<void>
  onCancel: () => void
}

export function PersonForm({ accounts, initial, suggestedAccountId, suggestedNumber = 1, submitLabel = 'Guardar persona', onSubmit, onCancel }: PersonFormProps) {
  const [accountId, setAccountId] = useState(initial?.accountId ?? suggestedAccountId ?? accounts[0]?.id ?? '')
  const [personNumber, setPersonNumber] = useState(initial?.personNumber ?? suggestedNumber)
  const [displayName, setDisplayName] = useState(initial?.displayName ?? `Persona ${suggestedNumber}`)
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [devices, setDevices] = useState<string[]>(initial?.devices.length ? initial.devices : [''])
  const [joinDate, setJoinDate] = useState<ISODate>(initial?.joinDate ?? todayISO())
  const [paidMonths, setPaidMonths] = useState(initial?.paidMonths ?? 0)
  const [manuallyUnpaid, setManuallyUnpaid] = useState(initial?.manuallyUnpaid ?? false)
  const [suspended] = useState(initial?.suspended ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initial && displayName === `Persona ${personNumber}` && personNumber !== suggestedNumber) {
      setPersonNumber(suggestedNumber)
      setDisplayName(`Persona ${suggestedNumber}`)
    }
  }, [suggestedNumber])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setError('')
    if (!accountId || !displayName.trim() || !joinDate) {
      setError('Completa la cuenta, el nombre y la fecha de ingreso.')
      return
    }
    const reviewNotes = personReviewNotes(phone, joinDate, paidMonths)
    if (reviewNotes.length) {
      setError(reviewNotes[0]!)
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        accountId,
        personNumber: Number.isFinite(personNumber) ? personNumber : null,
        displayName: displayName.trim(),
        phone: phone.trim(),
        devices: devices.map((item) => item.trim()).filter(Boolean),
        joinDate,
        paidMonths,
        manuallyUnpaid,
        suspended,
        needsReview: false,
        reviewNotes: [],
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label>Cuenta<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <div className="form-row">
        <label>Número<input type="number" min="1" inputMode="numeric" value={personNumber ?? ''} onChange={(event) => setPersonNumber(Number(event.target.value))} /></label>
        <label>Nombre<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Persona 1" /></label>
      </div>
      <label>Teléfono<input type="tel" inputMode="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setError('') }} placeholder="Número celular" /></label>
      <fieldset className="device-fieldset">
        <legend>Dispositivos</legend>
        {devices.map((device, index) => (
          <div className="device-row" key={index}>
            <input value={device} onChange={(event) => setDevices((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="iPhone, computadora, tableta…" />
            {devices.length > 1 && <button type="button" aria-label="Eliminar dispositivo" onClick={() => setDevices((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={18} /></button>}
          </div>
        ))}
        <button className="text-button" type="button" onClick={() => setDevices((current) => [...current, ''])}><Plus size={16} />Agregar dispositivo</button>
      </fieldset>
      <label>Fecha de ingreso<input type="date" value={joinDate} onChange={(event) => { setJoinDate(event.target.value as ISODate); setError('') }} /></label>
      <div className="field-label">Meses pagados</div>
      <Stepper label="Meses pagados" value={paidMonths} onChange={setPaidMonths} />
      <label className="check-row"><input type="checkbox" checked={manuallyUnpaid} onChange={(event) => setManuallyUnpaid(event.target.checked)} /><span>Marcar como “No ha pagado”</span></label>
      {error && <p className="error-message">{error}</p>}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : submitLabel}</button></div>
    </form>
  )
}
