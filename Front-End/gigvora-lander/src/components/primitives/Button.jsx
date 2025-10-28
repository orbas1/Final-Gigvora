import { forwardRef } from 'react'
import { cx } from '../../utils/cx'
import './Button.css'

const variantClasses = {
  primary: 'button--primary',
  glass: 'button--glass',
  outline: 'button--outline',
  ghost: 'button--ghost',
  subtle: 'button--subtle',
}

const sizeClasses = {
  sm: 'button--size-sm',
  md: 'button--size-md',
  lg: 'button--size-lg',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className, icon, children, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cx('button', variantClasses[variant], sizeClasses[size], className)}
      type={type}
      {...props}
    >
      {icon ? <span className="button__icon">{icon}</span> : null}
      {children}
    </button>
  )
})

export default Button
