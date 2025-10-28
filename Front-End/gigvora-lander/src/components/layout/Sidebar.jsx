import { useMemo } from 'react'
import Icon from '../primitives/Icon'
import Surface from '../primitives/Surface'
import './Sidebar.css'

const globalNavKeys = new Set([
  'feed',
  'search',
  'messages',
  'groups',
  'live',
  'marketplace',
  'jobs',
  'network',
  'calendar',
  'support',
])

const roleExtensions = {
  user: [
    { key: 'projects', label: 'Projects', icon: 'projects' },
    { key: 'hires', label: 'Hires', icon: 'hires' },
    { key: 'documents', label: 'CV & Cover Letters', icon: 'documents' },
    { key: 'applications', label: 'Applications', icon: 'jobs' },
    { key: 'escrow', label: 'Escrow', icon: 'wallet' },
    { key: 'disputes', label: 'Disputes', icon: 'disputes' },
  ],
  freelancer: [
    { key: 'my-gigs', label: 'My Gigs', icon: 'marketplace' },
    { key: 'proposals', label: 'Proposals', icon: 'documents' },
    { key: 'projects', label: 'Projects', icon: 'projects' },
    { key: 'portfolio', label: 'Portfolio', icon: 'documents' },
    { key: 'earnings', label: 'Earnings', icon: 'earnings' },
    { key: 'escrow', label: 'Escrow', icon: 'wallet' },
    { key: 'disputes', label: 'Disputes', icon: 'disputes' },
  ],
  agency: [
    { key: 'agency-page', label: 'Agency Page', icon: 'agency' },
    { key: 'team', label: 'Team', icon: 'team' },
    { key: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
    { key: 'project-mgmt', label: 'Project Mgmt', icon: 'projects' },
    { key: 'jobs', label: 'Jobs', icon: 'jobs' },
    { key: 'earnings', label: 'Earnings', icon: 'earnings' },
    { key: 'escrow', label: 'Escrow', icon: 'wallet' },
    { key: 'disputes', label: 'Disputes', icon: 'disputes' },
  ],
  company: [
    { key: 'company-page', label: 'Company Page', icon: 'building' },
    { key: 'jobs', label: 'Jobs', icon: 'jobs' },
    { key: 'ats', label: 'ATS', icon: 'documents' },
    { key: 'interviews', label: 'Interviews', icon: 'calendar' },
    { key: 'talent', label: 'Talent Pools', icon: 'network' },
    { key: 'billing', label: 'Billing', icon: 'payments' },
    { key: 'escrow', label: 'Escrow', icon: 'wallet' },
    { key: 'disputes', label: 'Disputes', icon: 'disputes' },
  ],
  headhunter: [
    { key: 'candidates', label: 'Candidates', icon: 'candidates' },
    { key: 'mandates', label: 'Mandates', icon: 'mandates' },
    { key: 'submissions', label: 'Submissions', icon: 'submissions' },
    { key: 'commissions', label: 'Commissions', icon: 'commissions' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  ],
  admin: [
    { key: 'overview', label: 'Overview', icon: 'overview' },
    { key: 'users', label: 'Users', icon: 'users' },
    { key: 'orgs', label: 'Orgs', icon: 'orgs' },
    { key: 'content', label: 'Content', icon: 'content' },
    { key: 'marketplace', label: 'Marketplace', icon: 'marketplace' },
    { key: 'jobs-ats', label: 'Jobs/ATS', icon: 'jobs' },
    { key: 'payments', label: 'Payments', icon: 'payments' },
    { key: 'disputes', label: 'Disputes', icon: 'disputes' },
    { key: 'moderation', label: 'Moderation', icon: 'moderation' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
    { key: 'audit', label: 'Audit', icon: 'audit' },
    { key: 'earnings', label: 'Earnings', icon: 'earnings' },
  ],
}

const roleAliases = {
  'user/client/job-seeker': 'user',
}

const fallbackNav = [
  { key: 'projects', label: 'Projects', icon: 'projects' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

export function Sidebar({ currentRole, onSelect, activeKey, items: customItems }) {
  const resolvedRole = roleAliases[currentRole] || currentRole
  const navItems = useMemo(() => {
    if (Array.isArray(customItems) && customItems.length) {
      return customItems
    }
    const extended = (roleExtensions[resolvedRole] ?? []).filter((item) => !globalNavKeys.has(item.key))
    if (extended.length) return extended
    return fallbackNav
  }, [customItems, resolvedRole])

  return (
    <nav className="sidebar" aria-label="Primary">
      <Surface padding="none" className="sidebar__surface" elevation="md">
        <ul className="sidebar__list">
          {navItems.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`sidebar__link ${activeKey === item.key ? 'sidebar__link--active' : ''}`}
                onClick={() => onSelect(item)}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Surface>
    </nav>
  )
}

export default Sidebar
