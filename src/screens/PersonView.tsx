import { ArrowLeft, CalendarDays, Edit3, History, MessageCircle, Smartphone, Trash2, UserRound, WalletCards } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Account, AppSettings, Payment, Person } from '../types'
import { coveredPeriod, formatDate, nextPaymentDate } from '../lib/dates'
import { getPaymentStatus, statusLabels } from '../lib/status'
import { deletePerson, registerPayment, updatePerson, type PersonInput } from '../db'
import { Modal } from '../components/Modal'
import { Stepper } from '../components/Stepper'
import { PersonForm } from '../components/PersonForm'
import { whatsappReminderUrl } from '../lib/whatsapp'

interface PersonViewProps {
  accounts: Account[]
  people: Person[]
  payments: Payment[]
  settings: AppSettings
  afterMutation: (message: string) => void
}

export function PersonView({ accounts, people, payments, settings, afterMutation }: PersonViewProps) {
  const { personId = '' } = useParams()
  const navigate = useNavigate()
  const person = people.find((item) => item.id === personId)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [months, setMonths] = useState(1)
  const [saving, setSaving] = useState(false)

  if (!person) return <div className="empty-state">No se encontró esta persona.</div>
  const account = accounts.find((item) => item.id === person.accountId)
  const status = getPaymentStatus(person, settings)
  const due = nextPaymentDate(person.joinDate, person.paidMonths)
  const period = coveredPeriod(person.joinDate, person.paidMonths)
  const personPayments = payments.filter((payment) => payment.personId === person.id).sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  const whatsappUrl = whatsappReminderUrl(person.phone, due)

  async function pay() {
    setSaving(true)
    try {
      await registerPayment(person!, months)
      setPaymentOpen(false)
      setMonths(1)
      afterMutation(`Pago de ${months} ${months === 1 ? 'mes registrado' : 'meses registrados'}.`)
    } finally { setSaving(false) }
  }

  async function edit(input: PersonInput) {
    await updatePerson(person!.id, input)
    setEditOpen(false)
    afterMutation('Datos actualizados.')
  }

  async function toggleUnpaid() {
    await updatePerson(person!.id, { manuallyUnpaid: !person!.manuallyUnpaid })
    afterMutation(person!.manuallyUnpaid ? 'Marca de pago pendiente retirada.' : 'Marcado como “No ha pagado”.')
  }

  async function remove() {
    await deletePerson(person!.id)
    afterMutation('Persona e historial eliminados.')
    navigate(`/cuenta/${person!.accountId}`, { replace: true })
  }

  return (
    <main>
      <header className="page-header person-header"><button className="icon-button" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={20} /></button><div><span className="eyebrow">{account?.name ?? 'PERSONA'}</span><h1 className={person.manuallyUnpaid || status === 'overdue' ? 'unpaid-name' : ''}>{person.displayName}</h1><span className={`status-pill ${status}`}>{statusLabels[status]}</span></div><button className="icon-button" onClick={() => setEditOpen(true)} aria-label="Editar"><Edit3 size={20} /></button></header>
      {person.needsReview && <div className="review-banner"><strong>Requiere revisión</strong>{person.reviewNotes.map((note) => <span key={note}>{note}</span>)}</div>}
      <section className="profile-grid">
        <article><UserRound /><span>Teléfono</span><strong>{person.phone || 'Sin teléfono'}</strong></article>
        <article><CalendarDays /><span>Fecha de ingreso</span><strong>{formatDate(person.joinDate)}</strong></article>
        <article className="wide"><Smartphone /><span>Dispositivos</span><strong>{person.devices.join(' · ') || 'Sin dispositivos'}</strong></article>
      </section>
      <section className="due-hero"><div><span>Próximo vencimiento</span><strong>{formatDate(due, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>{period && <small>Periodo cubierto: {formatDate(period.start)} al {formatDate(period.end)}</small>}</div><div className="months-orb"><strong>{person.paidMonths}</strong><span>meses</span></div></section>
      <div className="profile-actions">
        <button className="primary-button large" onClick={() => setPaymentOpen(true)}><WalletCards size={20} />Registrar pago</button>
        <button className={`secondary-button large ${person.manuallyUnpaid ? 'danger-outline' : ''}`} onClick={() => void toggleUnpaid()}>{person.manuallyUnpaid ? 'Quitar “No ha pagado”' : 'Marcar “No ha pagado”'}</button>
        {whatsappUrl && <a className="whatsapp-button" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={20} />Enviar recordatorio</a>}
      </div>
      <section className="history-panel"><div className="inline-heading"><History size={19} /><div><h2>Historial de pagos</h2><p>{personPayments.length} movimientos</p></div></div>{personPayments.length ? personPayments.map((payment) => <article key={payment.id}><time>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(payment.paidAt))}</time><div><strong>Pago recibido: {payment.months} {payment.months === 1 ? 'mes' : 'meses'}</strong><span>Vencimiento anterior: {formatDate(payment.previousDueDate)}</span><span>Nuevo vencimiento: {formatDate(payment.newDueDate)}</span></div></article>) : <div className="empty-state compact">Aún no hay pagos registrados desde la app.</div>}</section>
      <button className="delete-link" onClick={() => setDeleteOpen(true)}><Trash2 size={17} />Eliminar persona</button>

      <Modal open={paymentOpen} title="Registrar pago" description="¿Cuántos meses pagó?" onClose={() => setPaymentOpen(false)}>
        <div className="payment-dialog"><Stepper label="Meses del pago" value={months} min={1} onChange={setMonths} /><div className="quick-options">{[1, 2, 3, 6, 12].map((value) => <button type="button" className={months === value ? 'active' : ''} key={value} onClick={() => setMonths(value)}>{value} {value === 1 ? 'mes' : 'meses'}</button>)}</div><div className="form-actions"><button className="secondary-button" onClick={() => setPaymentOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving} onClick={() => void pay()}>{saving ? 'Guardando…' : 'Registrar pago'}</button></div></div>
      </Modal>
      <Modal open={editOpen} title="Editar persona" onClose={() => setEditOpen(false)} size="large"><PersonForm accounts={accounts} initial={person} onSubmit={edit} onCancel={() => setEditOpen(false)} submitLabel="Guardar cambios" /></Modal>
      <Modal open={deleteOpen} title={`¿Eliminar a ${person.displayName}?`} description="Esta acción eliminará también su historial de pagos." onClose={() => setDeleteOpen(false)}><div className="confirm-actions"><button className="secondary-button" onClick={() => setDeleteOpen(false)}>Cancelar</button><button className="danger-button" onClick={() => void remove()}>Eliminar</button></div></Modal>
    </main>
  )
}
