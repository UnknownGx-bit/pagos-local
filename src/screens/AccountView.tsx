import { ArrowLeft, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import type { Account, AppSettings, PaymentStatus, Person } from '../types'
import { formatDate, nextPaymentDate } from '../lib/dates'
import { getPaymentStatus, statusLabels, statusPriority } from '../lib/status'

interface AccountViewProps {
  accounts: Account[]
  people: Person[]
  settings: AppSettings
  onAdd: (accountId: string) => void
}

type Filter = 'all' | 'paid' | 'upcoming' | 'overdue' | 'manual-unpaid'
type Sort = 'smart' | 'number' | 'name' | 'due' | 'recent'

export function AccountView({ accounts, people, settings, onAdd }: AccountViewProps) {
  const { accountId = '' } = useParams()
  const navigate = useNavigate()
  const account = accounts.find((item) => item.id === accountId)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('smart')

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return people.filter((person) => person.accountId === accountId).filter((person) => {
      if (search && ![person.displayName, person.phone, ...person.devices].join(' ').toLowerCase().includes(search)) return false
      const status = getPaymentStatus(person, settings)
      if (filter === 'paid') return status === 'current'
      if (filter === 'upcoming') return status === 'upcoming' || status === 'due-today'
      if (filter === 'overdue') return status === 'overdue'
      if (filter === 'manual-unpaid') return person.manuallyUnpaid
      return true
    }).sort((a, b) => {
      if (sort === 'number') return (a.personNumber ?? Number.MAX_SAFE_INTEGER) - (b.personNumber ?? Number.MAX_SAFE_INTEGER)
      if (sort === 'name') return a.displayName.localeCompare(b.displayName, 'es', { numeric: true })
      if (sort === 'due') return nextPaymentDate(a.joinDate, a.paidMonths).localeCompare(nextPaymentDate(b.joinDate, b.paidMonths))
      if (sort === 'recent') return b.createdAt.localeCompare(a.createdAt)
      const statusDifference = statusPriority(getPaymentStatus(a, settings)) - statusPriority(getPaymentStatus(b, settings))
      return statusDifference || nextPaymentDate(a.joinDate, a.paidMonths).localeCompare(nextPaymentDate(b.joinDate, b.paidMonths))
    })
  }, [accountId, filter, people, query, settings, sort])

  if (!account) return <div className="empty-state">No se encontró esta cuenta.</div>

  return (
    <main>
      <header className="page-header"><button className="icon-button" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={20} /></button><div><span className="eyebrow">CUENTA</span><h1>{account.name}</h1><p>{people.filter((person) => person.accountId === accountId).length} personas</p></div><button className="icon-button" onClick={() => onAdd(accountId)} aria-label="Agregar persona"><Plus size={21} /></button></header>
      <div className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar persona, teléfono o dispositivo" /></div>
      <div className="filter-strip" role="group" aria-label="Filtros">
        {([['all', 'Todos'], ['paid', 'Pagados'], ['upcoming', 'Próximos'], ['overdue', 'Vencidos'], ['manual-unpaid', 'No ha pagado']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <label className="sort-control"><SlidersHorizontal size={16} /><span>Ordenar</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="smart">Atrasados y próximos</option><option value="number">Número de persona</option><option value="name">Nombre</option><option value="due">Próximo pago</option><option value="recent">Más recientes</option></select></label>
      <section className="person-list">
        {filtered.map((person) => {
          const status = getPaymentStatus(person, settings)
          const due = nextPaymentDate(person.joinDate, person.paidMonths)
          return <Link className={`person-card status-${status}`} key={person.id} to={`/persona/${person.id}`}><div className="person-card-main"><div><h3 className={person.manuallyUnpaid || status === 'overdue' ? 'unpaid-name' : ''}>{person.displayName}</h3><p>{person.phone || 'Sin teléfono'}</p><small>{person.devices.join(' · ') || 'Sin dispositivo'}</small></div><div className="due-block"><span>Próximo pago</span><strong>{formatDate(due, { day: '2-digit', month: 'short' })}</strong></div></div><div className="person-card-footer"><span className={`status-pill ${status}`}>{statusLabels[status as PaymentStatus]}</span><span>{person.paidMonths} {person.paidMonths === 1 ? 'mes pagado' : 'meses pagados'}</span></div></Link>
        })}
        {!filtered.length && <div className="empty-state">No hay personas que coincidan con esta búsqueda o filtro.</div>}
      </section>
    </main>
  )
}
