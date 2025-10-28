import { cx } from '../../utils/cx'
import './Avatar.css'

export function Avatar({ src, alt, size = 40, initials, className }) {
  const dimension = typeof size === 'number' ? `${size}px` : size
  return (
    <span
      className={cx('avatar', className)}
      style={{ width: dimension, height: dimension }}
      aria-label={alt}
      role="img"
    >
      {src ? <img src={src} alt={alt} /> : <span className="avatar__initials">{initials}</span>}
    </span>
  )
}

export default Avatar
