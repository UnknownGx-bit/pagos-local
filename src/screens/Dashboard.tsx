import { Bell, ChevronRight, Plus, Settings as SettingsIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { Account, AppSettings, Person } from '../types'
import { getPaymentStatus } from '../lib/status'
import { formatDate, nextPaymentDate } from '../lib/dates'

interface DashboardProps {
  accounts: Account[]
  people: Person[]
  settings: AppSettings
  onAdd: (accountId?: string) => void
}

export function Dashboard({ accounts, people, settings, onAdd }: DashboardProps) {
  const navigate = useNavigate()
  const statuses = people.map((person) => ({ person, status: getPaymentStatus(person, settings) }))
  const current = statuses.filter(({ status }) => status === 'current').length
  const upcoming = statuses.filter(({ status }) => status === 'upcoming' || status === 'due-today').length
  const overdue = statuses.filter(({ status }) => status === 'overdue' || status === 'manual-unpaid').length
  const activePeople = people.filter((person) => !person.suspended)
  const nextPayments = [...activePeople]
    .sort((a, b) => nextPaymentDate(a.joinDate, a.paidMonths).localeCompare(nextPaymentDate(b.joinDate, b.paidMonths)))
    .slice(0, 5)

  return (
    <main>
      <header className="topbar">
        <div><span className="eyebrow">CONTROL MENSUAL</span><h1>Pagos Local</h1></div>
        <button className="icon-button" aria-label="Configuración" onClick={() => navigate('/configuracion')}><SettingsIcon size={21} /></button>
      </header>
      <section className="summary-card" aria-label="Resumen">
        <div><strong>{people.length}</strong><span>Personas</span></div>
        <div><strong>{current}</strong><span>Al corriente</span></div>
        <div><strong>{upcoming}</strong><span>Por pagar</span></div>
        <div><strong>{overdue}</strong><span>Atrasados</span></div>
      </section>
      <section className="section-heading"><div><span className="eyebrow">TUS CUENTAS</span><h2>Vista general</h2></div><Bell size={19} /></section>
      <section className="account-grid">
        {accounts.map((account, index) => {
          const accountPeople = people.filter((person) => person.accountId === account.id)
          const activeAccountPeople = accountPeople.filter((person) => !person.suspended)
          const suspended = accountPeople.length - activeAccountPeople.length
          const paid = activeAccountPeople.filter((person) => !['overdue', 'manual-unpaid'].includes(getPaymentStatus(person, settings))).length
          const closest = [...activeAccountPeople].sort((a, b) => nextPaymentDate(a.joinDate, a.paidMonths).localeCompare(nextPaymentDate(b.joinDate, b.paidMonths)))[0]
          return (
            <Link className="account-card" key={account.id} to={`/cuenta/${account.id}`}>
              <span className="account-number">0{index + 1}</span>
              <div className="account-card-title"><h3>{account.name}</h3><ChevronRight size={20} /></div>
              <p>{accountPeople.length} personas</p>
              <div className="account-stats"><span><i className="dot paid" />Pagados {paid}</span><span><i className="dot pending" />Pendientes {activeAccountPeople.length - paid}</span>{suspended > 0 && <span><i className="dot suspended" />Suspendidos {suspended}</span>}</div>
              {closest && <small className="next-account-payment">Próximo: {closest.displayName} · {formatDate(nextPaymentDate(closest.joinDate, closest.paidMonths), { day: 'numeric', month: 'short' })}</small>}
            </Link>
          )
        })}
      </section>
      <button className="inline-primary-action" onClick={() => onAdd()}><Plus size={20} />Agregar persona</button>
      <section className="upcoming-panel">
        <div className="section-heading compact"><div><span className="eyebrow">AGENDA</span><h2>Próximos pagos</h2></div>{activePeople.length > 5 && <Link className="view-all" to="/pagos">Ver todos</Link>}</div>
        {nextPayments.length ? nextPayments.map((person) => <Link key={person.id} to={`/persona/${person.id}`}><time>{formatDate(nextPaymentDate(person.joinDate, person.paidMonths), { day: '2-digit', month: 'short' })}</time><span>{person.displayName}<small>{accounts.find((item) => item.id === person.accountId)?.name}</small></span><ChevronRight size={18} /></Link>) : <div className="empty-state">Agrega o importa personas para ver sus próximos pagos.</div>}
      </section>
    </main>
  )
}
