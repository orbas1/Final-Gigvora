import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './ModalRoot.css'

const ModalContext = createContext(null)

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null)

  const open = useCallback((content) => {
    setModal(() => content)
  }, [])

  const close = useCallback(() => setModal(null), [])

  const value = useMemo(() => ({ open, close, isOpen: Boolean(modal) }), [open, close, modal])

  return (
    <ModalContext.Provider value={value}>
      {children}
      {modal ? <ModalOverlay onClose={close}>{modal({ close })}</ModalOverlay> : null}
    </ModalContext.Provider>
  )
}

export const useModal = () => {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}

function ModalOverlay({ children, onClose }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-content">{children}</div>
    </div>,
    document.body
  )
}

export default ModalProvider
