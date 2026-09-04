import { Home, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface AppFrameProps {
  children: ReactNode
  onAddPerson: () => void
}

export function AppFrame({ children, onAddPerson }: AppFrameProps) {
  return (
    <div className="app-shell">
      {children}
      <nav className="bottom-nav" aria-label="Navegación principal">
        <NavLink to="/" end><Home size={20} /><span>Inicio</span></NavLink>
        <button className="nav-add" type="button" onClick={onAddPerson} aria-label="Agregar persona"><Plus size={26} /></button>
        <NavLink to="/configuracion"><Settings size={20} /><span>Ajustes</span></NavLink>
      </nav>
    </div>
  )
}
