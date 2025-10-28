import { useState } from 'react'
import Button from '../primitives/Button'
import Icon from '../primitives/Icon'
import { Avatar } from '../primitives/Avatar'
import { PopoverMenu } from '../interactive/PopoverMenu'
import { useTheme } from '../../design-system/ThemeProvider'
import { useToasts } from '../feedback/Toaster'
import { useModal } from '../overlays/ModalRoot'
import './Topbar.css'

export function Topbar({
  onSearch,
  onCreate,
  notifications = [],
  profile = {},
  roles = [],
  currentRole,
  onRoleChange,
  primaryNavItems = [],
  activeNav,
  onNavSelect,
}) {
  const [query, setQuery] = useState('')
  const { theme, toggleTheme } = useTheme()
  const { push } = useToasts()
  const modal = useModal()

  const formatRole = (value) =>
    value
      .split(/[-_/\s]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    onSearch(trimmed)
    push({ title: 'Search executed', description: `Showing results for “${trimmed}”` })
  }

  const unreadCount = notifications.filter((item) => item.read === false || !item.read_at).length

  const showNav = primaryNavItems.length > 0 && typeof onNavSelect === 'function'

  const quickCreateItems = [
    { label: 'Post update', icon: <Icon name="feed" size={18} />, onSelect: () => onCreate('post') },
    { label: 'New project', icon: <Icon name="projects" size={18} />, onSelect: () => onCreate('project') },
    { label: 'Gig offering', icon: <Icon name="marketplace" size={18} />, onSelect: () => onCreate('gig') },
    { label: 'Job requisition', icon: <Icon name="jobs" size={18} />, onSelect: () => onCreate('job') },
    { label: 'Create group', icon: <Icon name="groups" size={18} />, onSelect: () => onCreate('group') },
  ]

  const notificationItems = notifications.slice(0, 5).map((item) => ({
    label: item.title,
    icon: <span className="topbar__notification-dot" aria-hidden="true" />,
    onSelect: () => push({ title: item.title, description: item.description }),
  }))

  const profileItems = [
    ...roles.map((role) => ({
      label: formatRole(role.name),
      icon: role.name === currentRole ? <Icon name="grid" size={18} /> : null,
      onSelect: () => onRoleChange(role.name),
    })),
    {
      label: 'Account settings',
      icon: <Icon name="settings" size={18} />,
      onSelect: () =>
        modal.open(({ close }) => <AccountModal close={close} />),
    },
    { label: 'Sign out', danger: true, icon: <Icon name="support" size={18} />, onSelect: () => push({ title: 'Signed out securely' }) },
  ]

  const AccountModal = ({ close }) => (
    <div className="topbar__account-modal">
      <header>
        <h2>Account Centre</h2>
        <p>Manage security, authentication factors, and data portability from a single control hub.</p>
      </header>
      <section>
        <article>
          <h3>Security posture</h3>
          <ul>
            <li>Multi-factor authentication: Active</li>
            <li>Session trust score: 98</li>
            <li>API token status: 2 active</li>
          </ul>
        </article>
        <article>
          <h3>Data controls</h3>
          <ul>
            <li>Download activity ledger</li>
            <li>Manage consent preferences</li>
            <li>Request verified badge review</li>
          </ul>
        </article>
      </section>
      <footer>
        <Button variant="glass" size="md" onClick={close}>
          Close control centre
        </Button>
      </footer>
    </div>
  )

  return (
    <header className="topbar" role="banner">
      <div className="topbar__left">
        <div className="topbar__brand">
          <img src="/logo.png" alt="Gigvora" className="topbar__logo" />
          <span className="topbar__wordmark">Gigvora</span>
        </div>
        <form className="topbar__search" onSubmit={handleSubmit} role="search" aria-label="Global search">
          <label htmlFor="global-search" className="visually-hidden">
            Search Gigvora
          </label>
          <Icon name="search" size={18} className="topbar__search-icon" />
          <input
            id="global-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, work, and intelligence"
            autoComplete="off"
          />
        </form>
      </div>
      {showNav ? (
        <nav className="topbar__nav" aria-label="Primary">
          {primaryNavItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`topbar__nav-item ${activeNav === item.key ? 'topbar__nav-item--active' : ''}`}
              onClick={() => onNavSelect(item.key)}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {item.badge ? <span className="topbar__nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
      ) : null}
      <div className="topbar__actions">
        <PopoverMenu
          align="start"
          trigger={({ toggle }) => (
            <Button variant="glass" size="md" onClick={toggle}>
              <Icon name="grid" size={18} />
              Quick create
            </Button>
          )}
          items={quickCreateItems}
        />
        <PopoverMenu
          trigger={({ toggle }) => (
            <button type="button" className="topbar__icon-button" onClick={toggle} aria-label="View notifications">
              <Icon name="bell" />
              {unreadCount ? <span className="topbar__badge" aria-hidden="true">{unreadCount}</span> : null}
            </button>
          )}
          items={notificationItems.length ? notificationItems : [{ label: 'All caught up', onSelect: () => {} }]}
        />
        <button
          type="button"
          className="topbar__icon-button"
          onClick={() => {
            toggleTheme()
            push({
              title: `Theme switched to ${theme === 'light' ? 'dark' : 'light'} mode`,
              description: 'Design tokens and layout grid responded instantly.',
            })
          }}
          aria-label="Toggle theme"
        >
          <Icon name="theme" />
        </button>
        <PopoverMenu
          align="end"
          width={260}
          trigger={({ toggle }) => (
            <button type="button" className="topbar__profile" onClick={toggle} aria-haspopup="menu">
              <Avatar src={profile.avatarUrl} initials={profile.initials} alt={`${profile.name} profile`} size={40} />
              <div className="topbar__profile-details">
                <span className="topbar__profile-name">{profile.name}</span>
                <span className="topbar__profile-role">{formatRole(currentRole)}</span>
              </div>
              <Icon name="chevronDown" size={16} />
            </button>
          )}
          items={profileItems}
        />
      </div>
    </header>
  )
}

export default Topbar
