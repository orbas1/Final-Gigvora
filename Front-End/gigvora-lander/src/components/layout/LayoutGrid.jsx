import { cx } from '../../utils/cx'
import './LayoutGrid.css'

export function LayoutGrid({ left, main, right, hideLeft = false }) {
  return (
    <div className={cx('layout-grid', hideLeft && 'layout-grid--no-left')}>
      {!hideLeft ? (
        <aside className="layout-grid__left" aria-label="Profile overview">
          {left}
        </aside>
      ) : null}
      <section className="layout-grid__main" aria-label="Primary content">
        {main}
      </section>
      <aside className="layout-grid__right" aria-label="Recommendations">
        {right}
      </aside>
    </div>
  )
}

export default LayoutGrid
