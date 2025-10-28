import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../utils/cx'
import './Toaster.css'

const ToastContext = createContext(null)

let toastId = 0

export function ToasterProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((toast) => {
    setToasts((current) => [
      ...current,
      {
        id: ++toastId,
        dismissAfter: 4000,
        intent: 'info',
        ...toast,
      },
    ])
  }, [])

  const value = useMemo(() => ({ push, remove }), [push, remove])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  )
}

export const useToasts = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToasts must be used inside ToasterProvider')
  return ctx
}

function ToastHost({ toasts, onDismiss }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="toast-host" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  )
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast.dismissAfter) return undefined
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.dismissAfter)
    return () => window.clearTimeout(timeout)
  }, [toast.dismissAfter, toast.id, onDismiss])

  return (
    <div className={cx('toast', `toast--${toast.intent}`)}>
      <div>
        <p className="toast__title">{toast.title}</p>
        {toast.description ? <p className="toast__description">{toast.description}</p> : null}
      </div>
      <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  )
}
