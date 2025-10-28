import { cx } from '../../utils/cx'
import './Surface.css'

export function Surface({ as: Component = 'div', elevation = 'sm', padding = 'md', className, children, interactive = false, ...props }) {
  const paddingMap = {
    none: 'surface--padding-none',
    sm: 'surface--padding-sm',
    md: 'surface--padding-md',
    lg: 'surface--padding-lg',
  }

  return (
    <Component
      className={cx(
        'surface',
        `surface--${elevation}`,
        paddingMap[padding],
        interactive && 'surface--interactive',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export default Surface
