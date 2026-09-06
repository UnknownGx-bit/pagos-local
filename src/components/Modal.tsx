import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { dismissTopDialog, registerDialogDismiss } from '../lib/navigation'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  size?: 'small' | 'large'
}

export function Modal({ open, title, description, children, onClose, size = 'small' }: ModalProps) {
  const titleId = useId()
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const unregister = registerDialogDismiss(() => close.current())
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        dismissTopDialog()
      }
    }
    window.addEventListener('keydown', escape)
    return () => {
      unregister()
      document.body.style.overflow = previous
      window.removeEventListener('keydown', escape)
    }
  }, [open])
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-panel modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-header">
          <div><span className="eyebrow">PAGOS LOCAL</span><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
