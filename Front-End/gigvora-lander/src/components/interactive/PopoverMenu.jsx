import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../utils/cx'
import './PopoverMenu.css'

export function PopoverMenu({ trigger, items, align = 'end', width = 240 }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const toggle = () => setOpen((prev) => !prev)

  const handleSelect = (item) => {
    if (item.onSelect) item.onSelect()
    if (!item.keepOpen) setOpen(false)
  }

  const menu = open ? (
    <div className="popover-menu" ref={menuRef} style={{ width }} role="menu">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={cx('popover-menu__item', item.danger && 'popover-menu__item--danger')}
          onClick={() => handleSelect(item)}
          role="menuitem"
        >
          {item.icon ? <span className="popover-menu__icon">{item.icon}</span> : null}
          <span className="popover-menu__label">{item.label}</span>
        </button>
      ))}
    </div>
  ) : null

  return (
    <div className="popover-menu__root" ref={triggerRef}>
      {trigger({ open, toggle })}
      {open && menu ?
        createPortal(
          <div
            className={cx('popover-menu__content', `popover-menu__content--${align}`)}
            style={computePosition(triggerRef.current, width, align)}
          >
            {menu}
          </div>,
          document.body
        )
      : null}
    </div>
  )
}

function computePosition(triggerEl, width, align) {
  if (!triggerEl) return {}
  const rect = triggerEl.getBoundingClientRect()
  const top = rect.bottom + 12
  const base = {
    top: `${top + window.scrollY}px`,
  }
  if (align === 'start') {
    return { ...base, left: `${rect.left + window.scrollX}px` }
  }
  if (align === 'center') {
    return {
      ...base,
      left: `${rect.left + rect.width / 2 - width / 2 + window.scrollX}px`,
    }
  }
  return { ...base, left: `${rect.right - width + window.scrollX}px` }
}

export default PopoverMenu
