import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="dialog-overlay">
      <div className="dialog-backdrop" onClick={onCancel} />
      <div className="dialog-panel">
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button ref={cancelRef} onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}