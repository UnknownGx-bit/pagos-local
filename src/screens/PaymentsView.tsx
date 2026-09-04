import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Account, AppSettings, Person } from '../types'
import { formatDate, nextPaymentDate } from '../lib/dates'
import { getPaymentStatus, statusLabels, statusPriority } from '../lib/status'

interface PaymentsViewProps {
  accounts: Account[]
  people: Person[]
  settings: AppSettings
}

export function PaymentsView({ accounts, people, settings }: PaymentsViewProps) {
  const navigate = useNavigate()
  const ordered = [...people].sort((a, b) => {
    const priority = statusPriority(getPaymentStatus(a, settings)) - statusPriority(getPaymentStatus(b, settings))
    return priority || nextPaymentDate(a.joinDate, a.paidMonths).localeCompare(nextPaymentDate(b.joinDate, b.paidMonths))
  })
  return (
    <main>
      <header className="page-header"><button className="icon-button" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={20} /></button><div><span className="eyebrow">AGENDA</span><h1>Todos los pagos</h1><p>Atrasados y próximos primero</p></div><span /></header>
      <section className="upcoming-panel all-payments">
        {ordered.map((person) => {
          const status = getPaymentStatus(person, settings)
          return <Link key={person.id} to={`/persona/${person.id}`}><time>{formatDate(nextPaymentDate(person.joinDate, person.paidMonths), { day: '2-digit', month: 'short' })}</time><span>{person.displayName}<small>{accounts.find((account) => account.id === person.accountId)?.name} · {statusLabels[status]}</small></span><ChevronRight size={18} /></Link>
        })}
        {!ordered.length && <div className="empty-state">No hay personas registradas.</div>}
      </section>
    </main>
  )
}
