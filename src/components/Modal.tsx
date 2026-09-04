import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  size?: 'small' | 'large'
}

export function Modal({ open, title, description, children, onClose, size = 'small' }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-panel modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <div><span className="eyebrow">PAGOS LOCAL</span><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
