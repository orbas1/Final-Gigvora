import { useCallback, useEffect, useMemo, useState } from 'react'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import LayoutGrid from './LayoutGrid'
import Surface from '../primitives/Surface'
import Button from '../primitives/Button'
import Icon from '../primitives/Icon'
import { Avatar } from '../primitives/Avatar'
import { useToasts } from '../feedback/Toaster'
import { useModal } from '../overlays/ModalRoot'
import { apiRequest } from '../../utils/apiClient'
import { useDashboardResources } from '../../hooks/useDashboardResources'
import { useResource } from '../../hooks/useResource'
import { cx } from '../../utils/cx'
import './AppShell.css'

const quickCreateConfig = {
  post: {
    title: 'Publish post',
    endpoint: '/posts',
    fields: [
      { name: 'headline', label: 'Headline', type: 'text', required: true },
      { name: 'body', label: 'Content', type: 'textarea', required: true },
      { name: 'tags', label: 'Tags', type: 'text' },
    ],
  },
  project: {
    title: 'New project',
    endpoint: '/projects',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'budget_min', label: 'Budget (min)', type: 'number' },
      { name: 'budget_max', label: 'Budget (max)', type: 'number' },
    ],
  },
  gig: {
    title: 'New gig',
    endpoint: '/gigs',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'price', label: 'Price', type: 'number', required: true },
      { name: 'currency', label: 'Currency', type: 'text' },
    ],
  },
  job: {
    title: 'New job',
    endpoint: '/jobs',
    fields: [
      { name: 'title', label: 'Role', type: 'text', required: true },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'job_type', label: 'Type', type: 'text' },
      { name: 'salary_min', label: 'Salary (min)', type: 'number' },
    ],
  },
  group: {
    title: 'Create group',
    endpoint: '/groups',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'visibility', label: 'Visibility', type: 'text', required: true },
    ],
  },
}

const unwrapList = (payload) => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.rows)) return payload.rows
  const firstArrayKey = Object.keys(payload || {}).find((key) => Array.isArray(payload[key]))
  if (firstArrayKey) return payload[firstArrayKey]
  return []
}

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

const formatRelativeTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = date.getTime() - Date.now()
  const diffSeconds = Math.round(diffMs / 1000)
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ]
  let duration = diffSeconds
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return ''
}

const FEED_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'following', label: 'Following' },
  { key: 'groups', label: 'Groups' },
  { key: 'companies', label: 'Companies' },
]

const PRIMARY_NAV_ITEMS = [
  { key: 'feed', label: 'Feed', icon: 'feed' },
  { key: 'search', label: 'Explore', icon: 'search' },
  { key: 'marketplace', label: 'Marketplace', icon: 'marketplace' },
  { key: 'jobs', label: 'Jobs', icon: 'jobs' },
  { key: 'live', label: 'Live', icon: 'live' },
  { key: 'groups', label: 'Groups', icon: 'groups' },
  { key: 'messages', label: 'Messages', icon: 'messages' },
  { key: 'network', label: 'Network', icon: 'network' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'support', label: 'Support', icon: 'support' },
]

const getFeedFilterLabel = (value) => {
  const match = FEED_FILTERS.find((filter) => filter.key === value)
  return match ? match.label : 'All'
}
const detailViewDefinitions = {
  projects: {
    title: 'Projects Command Centre',
    description: 'Live marketplace projects',
    columns: ['Project', 'Status', 'Budget', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/projects?limit=12&expand=client')
      return unwrapList(response?.data || response).map((project) => [
        project.title || 'Untitled project',
        project.status || project.project_type || '—',
        formatCurrency(project.budget_max || project.budget_min, project.budget_currency || 'USD'),
        formatDateTime(project.updated_at || project.created_at),
      ])
    },
  },
  hires: {
    title: 'Hires',
    description: 'Roles converting to hires',
    columns: ['Role', 'Company', 'Hires', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/jobs?limit=12&expand=company')
      return unwrapList(response?.data || response).map((job) => [
        job.title || 'Untitled role',
        job.company?.brand_name || job.company?.legal_name || '—',
        Number(job.hires_count || 0).toLocaleString(),
        formatDateTime(job.updated_at || job.created_at),
      ])
    },
  },
  documents: {
    title: 'CV & Cover Letters',
    description: 'Personal documents',
    columns: ['Document', 'Updated', 'Type', 'Visibility'],
    loader: async ({ profile }) => {
      if (!profile?.userId) return []
      const response = await apiRequest(`/profiles/${profile.userId}/portfolio?limit=12`)
      return unwrapList(response?.data || response).map((doc) => [
        doc.title || 'Untitled asset',
        formatDateTime(doc.updated_at || doc.created_at),
        doc.format || doc.media?.type || '—',
        doc.visibility || doc.status || 'Private',
      ])
    },
  },
  applications: {
    title: 'Applications',
    description: 'Application flow per role',
    columns: ['Role', 'Company', 'Applications', 'Status'],
    loader: async () => {
      const response = await apiRequest('/jobs?limit=12&expand=company')
      return unwrapList(response?.data || response).map((job) => [
        job.title || 'Untitled role',
        job.company?.brand_name || job.company?.legal_name || '—',
        Number(job.applications_count || 0).toLocaleString(),
        job.status || 'draft',
      ])
    },
  },
  escrow: {
    title: 'Escrow accounts',
    description: 'Funds in motion',
    columns: ['Reference', 'Status', 'Amount', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/escrow?limit=12&analytics=true')
      return unwrapList(response?.data || response).map((intent) => [
        intent.reference_id || intent.id,
        intent.status || (intent.is_on_hold ? 'on_hold' : 'open'),
        formatCurrency(intent.amount || intent.expected_amount, intent.currency || intent.expected_currency || 'USD'),
        formatDateTime(intent.updated_at || intent.created_at),
      ])
    },
  },
  disputes: {
    title: 'Disputes',
    description: 'Open resolution cases',
    columns: ['Case', 'Status', 'Owner', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/disputes?limit=12')
      return unwrapList(response?.data || response).map((dispute) => [
        dispute.case_number || dispute.id,
        dispute.status || 'open',
        dispute.owner?.name || dispute.mediator?.name || '—',
        formatDateTime(dispute.updated_at || dispute.created_at),
      ])
    },
  },
  'my-gigs': {
    title: 'My gigs',
    description: 'Productised offers',
    columns: ['Gig', 'Price', 'Orders', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/gigs?limit=12')
      return unwrapList(response?.data || response).map((gig) => [
        gig.title || 'Untitled gig',
        formatCurrency(gig.base_price || gig.price || gig.price_min, gig.currency || gig.price_currency || 'USD'),
        Number(gig.orders_count || gig.completed_orders || 0).toLocaleString(),
        formatDateTime(gig.updated_at || gig.created_at),
      ])
    },
  },
  proposals: {
    title: 'Proposals',
    description: 'Active bids',
    columns: ['Project', 'Status', 'Bids', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/projects?limit=12')
      return unwrapList(response?.data || response).map((project) => [
        project.title || 'Untitled project',
        project.status || project.project_type || '—',
        Number(project.bids_count || project.proposals_count || 0).toLocaleString(),
        formatDateTime(project.updated_at || project.created_at),
      ])
    },
  },
  portfolio: {
    title: 'Portfolio',
    description: 'Published work',
    columns: ['Title', 'Type', 'URL', 'Updated'],
    loader: async ({ profile }) => {
      if (!profile?.userId) return []
      const response = await apiRequest(`/profiles/${profile.userId}/portfolio?limit=12`)
      return unwrapList(response?.data || response).map((item) => [
        item.title || 'Untitled asset',
        item.media?.type || item.format || '—',
        item.url || item.media?.url || '—',
        formatDateTime(item.updated_at || item.created_at),
      ])
    },
  },
  earnings: {
    title: 'Earnings',
    description: 'Ledger summary',
    columns: ['Entry', 'Amount', 'Direction', 'Created'],
    loader: async () => {
      const response = await apiRequest('/payments/ledger?limit=12')
      return unwrapList(response?.data || response).map((entry) => [
        entry.description || entry.reference || entry.type || 'Ledger entry',
        formatCurrency(entry.amount, entry.currency || 'USD'),
        entry.direction || entry.status || '—',
        formatDateTime(entry.created_at || entry.updated_at),
      ])
    },
  },
  'agency-page': {
    title: 'Agencies',
    description: 'Agency footprint',
    columns: ['Agency', 'Timezone', 'Team size', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/agencies?limit=12')
      return unwrapList(response?.data || response).map((agency) => [
        agency.name || 'Agency',
        agency.timezone || agency.industry || '—',
        Number(agency.team_size || 0).toLocaleString(),
        formatDateTime(agency.updated_at || agency.created_at),
      ])
    },
  },
  team: {
    title: 'Team',
    description: 'Agency team view',
    columns: ['Agency', 'Owner', 'Team size', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/agencies?limit=12')
      return unwrapList(response?.data || response).map((agency) => [
        agency.name || 'Agency',
        agency.owner?.name || agency.owner_user_id || '—',
        Number(agency.team_size || 0).toLocaleString(),
        formatDateTime(agency.updated_at || agency.created_at),
      ])
    },
  },
  pipeline: {
    title: 'Pipeline',
    description: 'Pipeline momentum',
    columns: ['Project', 'Stage', 'Budget', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/projects?limit=12')
      return unwrapList(response?.data || response).map((project) => [
        project.title || 'Untitled project',
        project.status || 'draft',
        formatCurrency(project.budget_max || project.budget_min, project.budget_currency || 'USD'),
        formatDateTime(project.updated_at || project.created_at),
      ])
    },
  },
  'project-mgmt': {
    title: 'Project management',
    description: 'Delivery focus',
    columns: ['Project', 'Type', 'Timeline', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/projects?limit=12')
      return unwrapList(response?.data || response).map((project) => [
        project.title || 'Untitled project',
        project.project_type || project.type || '—',
        project.timeline || project.requirements || '—',
        formatDateTime(project.updated_at || project.created_at),
      ])
    },
  },
  'company-page': {
    title: 'Companies',
    description: 'Company profiles',
    columns: ['Company', 'Industry', 'Team size', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/companies?limit=12')
      return unwrapList(response?.data || response).map((company) => [
        company.brand_name || company.legal_name || 'Company',
        company.industry || '—',
        Number(company.team_size || 0).toLocaleString(),
        formatDateTime(company.updated_at || company.created_at),
      ])
    },
  },
  ats: {
    title: 'ATS',
    description: 'Job funnels',
    columns: ['Role', 'Type', 'Stage', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/jobs?limit=12')
      return unwrapList(response?.data || response).map((job) => [
        job.title || 'Untitled role',
        job.job_type || job.type || '—',
        job.status || 'draft',
        formatDateTime(job.updated_at || job.created_at),
      ])
    },
  },
  interviews: {
    title: 'Interviews',
    description: 'Interview load',
    columns: ['Candidate', 'Role', 'Status', 'Scheduled'],
    loader: async () => {
      const response = await apiRequest('/interviews?limit=12')
      return unwrapList(response?.data || response).map((interview) => [
        interview.candidate_name || interview.candidate?.name || 'Candidate',
        interview.role || interview.job_title || '—',
        interview.status || 'scheduled',
        formatDateTime(interview.start_time || interview.scheduled_at || interview.created_at),
      ])
    },
  },
  talent: {
    title: 'Talent pools',
    description: 'Suggested talent',
    columns: ['Name', 'Headline', 'Location', 'Score'],
    loader: async () => {
      const response = await apiRequest('/suggestions?for=people&limit=12')
      return unwrapList(response?.data || response).map((person) => [
        person.display_name || person.name || 'Profile',
        person.headline || person.title || '—',
        person.location || '—',
        person.score ? Number(person.score).toFixed(2) : '—',
      ])
    },
  },
  billing: {
    title: 'Billing',
    description: 'Invoice ledger',
    columns: ['Invoice', 'Status', 'Total', 'Due'],
    loader: async () => {
      const response = await apiRequest('/invoices?limit=12')
      return unwrapList(response?.data || response).map((invoice) => [
        invoice.number || invoice.id,
        invoice.status || 'draft',
        formatCurrency(invoice.total || invoice.amount_due, invoice.currency || 'USD'),
        formatDateTime(invoice.due_at || invoice.created_at),
      ])
    },
  },
  candidates: {
    title: 'Candidates',
    description: 'Role applicants',
    columns: ['Role', 'Company', 'Applicants', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/jobs?limit=12&expand=company')
      return unwrapList(response?.data || response).map((job) => [
        job.title || 'Untitled role',
        job.company?.brand_name || job.company?.legal_name || '—',
        Number(job.applications_count || 0).toLocaleString(),
        formatDateTime(job.updated_at || job.created_at),
      ])
    },
  },
  mandates: {
    title: 'Mandates',
    description: 'Active mandates',
    columns: ['Agency', 'Focus', 'Fee model', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/agencies?limit=12')
      return unwrapList(response?.data || response).map((agency) => [
        agency.name || 'Agency',
        agency.overview || '—',
        agency.rate_card?.model || agency.metadata?.model || '—',
        formatDateTime(agency.updated_at || agency.created_at),
      ])
    },
  },
  submissions: {
    title: 'Submissions',
    description: 'Recent submissions',
    columns: ['Project', 'Status', 'Owner', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/projects?limit=12')
      return unwrapList(response?.data || response).map((project) => [
        project.title || 'Untitled project',
        project.status || 'draft',
        project.owner?.name || project.owner_id || '—',
        formatDateTime(project.updated_at || project.created_at),
      ])
    },
  },
  commissions: {
    title: 'Commissions',
    description: 'Payout tracking',
    columns: ['Payout', 'Status', 'Amount', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/payouts?limit=12')
      return unwrapList(response?.data || response).map((payout) => [
        payout.id,
        payout.status || 'pending',
        formatCurrency(payout.amount, payout.currency || 'USD'),
        formatDateTime(payout.updated_at || payout.created_at),
      ])
    },
  },
  overview: {
    title: 'Platform overview',
    description: 'KPI snapshot',
    columns: ['Metric', 'Value', 'Delta', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/admin/analytics/kpis')
      const items = Array.isArray(response?.metrics)
        ? response.metrics
        : Object.entries(response || {}).map(([key, value]) => ({ name: key, value }))
      return items.map((metric) => [
        metric.name || metric.metric || 'Metric',
        metric.value || metric.current || '—',
        metric.delta || metric.change || '—',
        formatDateTime(metric.updated_at || Date.now()),
      ])
    },
  },
  users: {
    title: 'Users',
    description: 'User directory',
    columns: ['Name', 'Email', 'Role', 'Joined'],
    loader: async () => {
      const response = await apiRequest('/users?limit=12')
      return unwrapList(response?.data || response).map((user) => [
        user.name || user.full_name || user.email || 'User',
        user.email || '—',
        user.role || 'user',
        formatDateTime(user.created_at),
      ])
    },
  },
  orgs: {
    title: 'Organisations',
    description: 'Company roster',
    columns: ['Organisation', 'Type', 'Seats', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/admin/orgs?limit=12')
      const rows = unwrapList(response?.data || response)
      if (rows.length) {
        return rows.map((org) => [
          org.name || 'Organisation',
          org.type || org.tier || '—',
          Number(org.seats || org.team_size || 0).toLocaleString(),
          formatDateTime(org.updated_at || org.created_at),
        ])
      }
      const fallback = await apiRequest('/companies?limit=12')
      return unwrapList(fallback?.data || fallback).map((company) => [
        company.brand_name || company.legal_name || 'Company',
        company.industry || '—',
        Number(company.team_size || 0).toLocaleString(),
        formatDateTime(company.updated_at || company.created_at),
      ])
    },
  },
  content: {
    title: 'Content moderation',
    description: 'Recent posts',
    columns: ['Author', 'Headline', 'Status', 'Published'],
    loader: async () => {
      const response = await apiRequest('/posts?limit=12&expand=author')
      return unwrapList(response?.data || response).map((post) => [
        post.author?.profile?.display_name || post.author?.email || 'Author',
        post.title || post.content?.slice(0, 60) || 'Untitled',
        post.visibility || 'public',
        formatDateTime(post.created_at),
      ])
    },
  },
  'jobs-ats': {
    title: 'Jobs & ATS',
    description: 'Job health',
    columns: ['Role', 'Company', 'Applicants', 'Stage'],
    loader: async () => {
      const response = await apiRequest('/jobs?limit=12&expand=company')
      return unwrapList(response?.data || response).map((job) => [
        job.title || 'Untitled role',
        job.company?.brand_name || job.company?.legal_name || '—',
        Number(job.applications_count || 0).toLocaleString(),
        job.status || 'draft',
      ])
    },
  },
  payments: {
    title: 'Payments',
    description: 'Ledger activity',
    columns: ['Entry', 'Amount', 'Status', 'Created'],
    loader: async () => {
      const response = await apiRequest('/payments/ledger?limit=12')
      return unwrapList(response?.data || response).map((entry) => [
        entry.description || entry.reference || 'Ledger entry',
        formatCurrency(entry.amount, entry.currency || 'USD'),
        entry.status || entry.direction || '—',
        formatDateTime(entry.created_at || entry.updated_at),
      ])
    },
  },
  moderation: {
    title: 'Moderation',
    description: 'Reported items',
    columns: ['Report', 'Type', 'Status', 'Updated'],
    loader: async () => {
      const response = await apiRequest('/admin/reports?limit=12')
      return unwrapList(response?.data || response).map((report) => [
        report.id,
        report.reason || report.category || '—',
        report.status || 'open',
        formatDateTime(report.updated_at || report.created_at),
      ])
    },
  },
  audit: {
    title: 'Audit trail',
    description: 'System audit logs',
    columns: ['Event', 'Actor', 'Scope', 'Timestamp'],
    loader: async () => {
      const response = await apiRequest('/admin/audit?limit=12')
      return unwrapList(response?.data || response).map((entry) => [
        entry.event || entry.action || 'Event',
        entry.actor?.name || entry.actor_id || '—',
        entry.scope || entry.target || '—',
        formatDateTime(entry.created_at || entry.timestamp),
      ])
    },
  },
}

function QuickCreateForm({ type, onSuccess, onClose }) {
  const { push } = useToasts()
  const config = quickCreateConfig[type]

  if (!config) {
    push({ title: 'Unsupported', description: `No quick-create flow for ${type}`, intent: 'danger' })
    onClose()
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.target)
    const payload = {}
    formData.forEach((value, key) => {
      payload[key] = value
    })

    try {
      await apiRequest(config.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      push({ title: `${config.title} created`, description: 'The record is now live.' })
      onSuccess(payload)
      onClose()
    } catch (error) {
      push({ title: 'Action failed', description: error.body?.message || error.message, intent: 'danger' })
    }
  }

  return (
    <form className="quick-create" onSubmit={handleSubmit}>
      <header>
        <h2>{config.title}</h2>
      </header>
      <div className="quick-create__fields">
        {config.fields.map((field) => (
          <label key={field.name}>
            <span>{field.label}</span>
            {field.type === 'textarea' ? (
              <textarea name={field.name} required={field.required} rows={4} />
            ) : (
              <input name={field.name} type={field.type} required={field.required} />
            )}
          </label>
        ))}
      </div>
      <footer>
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Submit</Button>
      </footer>
    </form>
  )
}

function ProfileCard({ profile, loading }) {
  if (loading) {
    return (
      <Surface>
        <div className="profile-card profile-card--loading">
          <div className="skeleton avatar" />
          <div className="skeleton skeleton--text" />
          <div className="skeleton skeleton--text" />
        </div>
      </Surface>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <Surface>
      <div className="profile-card">
        <Avatar src={profile.avatarUrl} initials={profile.initials} alt={`${profile.name} avatar`} size={72} />
        <h2>{profile.name}</h2>
        <p>{profile.headline}</p>
        <dl>
          <div>
            <dt>Location</dt>
            <dd>{profile.location}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{profile.accountAge}</dd>
          </div>
        </dl>
        <div className="profile-card__metrics">
          <div>
            <span>Followers</span>
            <strong>{profile.followers.toLocaleString()}</strong>
          </div>
          <div>
            <span>Following</span>
            <strong>{profile.following.toLocaleString()}</strong>
          </div>
        </div>
        <div className="profile-card__links">
          <span>Projects {profile.projects}</span>
          <span>Gigs {profile.gigs}</span>
          <span>Jobs {profile.jobs}</span>
        </div>
      </div>
    </Surface>
  )
}

function MetricStack({ metrics, loading }) {
  return (
    <Surface>
      <div className="metric-stack">
        <h3>Performance</h3>
        <ul>
          {loading
            ? [1, 2, 3].map((index) => (
                <li key={index}>
                  <span className="skeleton skeleton--text" />
                  <strong className="skeleton skeleton--text" />
                  <em className="skeleton skeleton--text" />
                </li>
              ))
            : metrics.map((metric) => (
                <li key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <em>{metric.delta}</em>
                </li>
              ))}
        </ul>
      </div>
    </Surface>
  )
}

function RightRail({ whoToFollow, collections, loading, onConnect, onSaveOpportunity }) {
  return (
    <div className="right-rail">
      <Surface>
        <h3>Who to follow</h3>
        <ul className="right-rail__follow">
          {loading
            ? [1, 2, 3].map((index) => (
                <li key={index} className="right-rail__loading">
                  <div className="skeleton skeleton--text" />
                  <div className="skeleton skeleton--button" />
                </li>
              ))
            : whoToFollow.map((item) => (
                <li key={item.id || item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.role}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onConnect(item)}>
                    Connect
                  </Button>
                </li>
              ))}
        </ul>
      </Surface>
      <Surface>
        <h3>Opportunities</h3>
        <ul className="right-rail__opportunities">
          {loading
            ? [1, 2, 3].map((index) => (
                <li key={index} className="right-rail__loading">
                  <div className="skeleton skeleton--text" />
                  <div className="skeleton skeleton--text" />
                </li>
              ))
            : collections.opportunities.map((item) => (
                <li key={item.id || `${item.title}-${item.type}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.type}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onSaveOpportunity(item)}>
                    Save
                  </Button>
                  <em>{item.rate}</em>
                </li>
              ))}
        </ul>
      </Surface>
      <Surface>
        <h3>Groups</h3>
        <ul className="right-rail__list">
          {loading
            ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
            : collections.groups.map((group) => <li key={group}>{group}</li>)}
        </ul>
        <h3>Companies</h3>
        <ul className="right-rail__list">
          {loading
            ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
            : collections.companies.map((company) => <li key={company}>{company}</li>)}
        </ul>
      </Surface>
    </div>
  )
}

function FeedView({ feed, loading, error, onRefresh, activeFilter, onFilterChange, profile }) {
  const { push } = useToasts()
  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleFilterClick = (key) => {
    if (key === activeFilter) return
    onFilterChange(key)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      push({ title: 'Add a message', description: 'Write a quick update before sharing.' })
      return
    }
    setSubmitting(true)
    try {
      const payload = { content: trimmed }
      if (link.trim()) {
        payload.link = link.trim()
      }
      await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      push({ title: 'Post published', description: 'Your update is live for your network.' })
      setContent('')
      setLink('')
      onRefresh()
    } catch (postError) {
      push({ title: 'Unable to publish', description: postError.body?.message || postError.message, intent: 'danger' })
    } finally {
      setSubmitting(false)
    }
  }

  const characterHint = content.trim().length
    ? `${content.trim().length} characters`
    : 'Plain text update'

  return (
    <Surface className="feed-view" elevation="md">
      <header>
        <div>
          <h2>Community feed</h2>
          <p>Live intelligence from across your network.</p>
        </div>
        <div className="feed-view__toolbar">
          <div className="feed-filters" role="tablist" aria-label="Feed filters">
            {FEED_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={filter.key === activeFilter ? 'active' : undefined}
                aria-pressed={filter.key === activeFilter}
                onClick={() => handleFilterClick(filter.key)}
                disabled={loading && filter.key !== activeFilter}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            icon={<Icon name="refresh" size={16} />}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </header>
      <section className="composer" aria-label="Share an update">
        <div className="composer__author">
          <Avatar
            src={profile?.avatarUrl}
            initials={profile?.initials}
            alt={`${profile?.name || 'Account'} avatar`}
            size={56}
          />
          <div>
            <strong>{profile?.name || 'Share an update'}</strong>
            <span>{profile?.headline || 'Tell your network what you are working on.'}</span>
          </div>
        </div>
        <form className="composer__form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="composer-content">
            Post content
          </label>
          <textarea
            id="composer-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share progress, wins, or opportunities"
            required
            rows={4}
            maxLength={2800}
          />
          <label className="composer__field" htmlFor="composer-link">
            <span>Link (optional)</span>
            <input
              id="composer-link"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
          </label>
          <div className="composer__actions">
            <span className="composer__hint">{characterHint}</span>
            <Button
              type="submit"
              icon={<Icon name="feed" size={16} />}
              disabled={submitting || !content.trim()}
            >
              {submitting ? 'Posting…' : 'Share update'}
            </Button>
          </div>
        </form>
      </section>
      {error ? (
        <div className="feed-view__status feed-view__status--error" role="alert">
          <p>{error.body?.message || error.message}</p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      ) : null}
      <ul className="feed-view__list">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <li key={index} className="feed-view__item feed-view__item--loading">
                <span className="skeleton skeleton--avatar" />
                <div className="feed-view__loading-lines">
                  <span className="skeleton skeleton--text" />
                  <span className="skeleton skeleton--text" />
                </div>
              </li>
            ))
          : feed.map((item) => (
              <li key={item.id} className="feed-view__item">
                <article className="feed-card">
                  <header>
                    <Avatar src={item.avatarUrl} initials={item.avatar} alt={`${item.author} avatar`} size={48} />
                    <div>
                      <strong>{item.author}</strong>
                      <span>{item.timestamp || 'Just now'}</span>
                    </div>
                  </header>
                  <p>{item.headline}</p>
                  {item.media ? <img src={item.media} alt="Post attachment" loading="lazy" /> : null}
                  {item.tags?.length ? (
                    <div className="feed-card__tags" aria-label="Post tags">
                      {item.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <footer>
                    <span aria-label="Reactions">
                      <Icon name="like" size={16} /> {item.reactions}
                    </span>
                    <span aria-label="Comments">
                      <Icon name="messages" size={16} /> {item.comments}
                    </span>
                    <span aria-label="Shares">
                      <Icon name="share" size={16} /> {item.shares}
                    </span>
                  </footer>
                </article>
              </li>
            ))}
      </ul>
      {!loading && !feed.length ? (
        <div className="feed-view__empty">No updates yet. Share something to spark the conversation.</div>
      ) : null}
    </Surface>
  )
}

function SearchView({ results, searching, lastQuery }) {
  return (
    <Surface className="search-view" elevation="md">
      <header>
        <h2>Search results</h2>
        {lastQuery ? <span>for “{lastQuery}”</span> : null}
      </header>
      {searching ? <p>Searching…</p> : null}
      <ul>
        {results.map((result) => (
          <li key={result.id || result.slug || result.email}>
            <strong>{result.title || result.name || result.email}</strong>
            <span>{result.description || result.headline || ''}</span>
          </li>
        ))}
      </ul>
      {!results.length && !searching ? <p>No results yet.</p> : null}
    </Surface>
  )
}
function MessagesView() {
  const { push } = useToasts()
  const [activeId, setActiveId] = useState(null)

  const fetchThreads = useCallback(() => apiRequest('/conversations/conversations?limit=25&expand=participants'), [])
  const {
    data: threadsData,
    loading: threadsLoading,
    error: threadsError,
    refresh: refreshThreads,
  } = useResource(fetchThreads, [])

  const threads = useMemo(() => {
    return unwrapList(threadsData?.data || threadsData).map((thread) => ({
      id: thread.id,
      name:
        thread.title ||
        thread.topic ||
        unwrapList(thread.participants)
          .map((participant) => participant.user?.profile?.display_name || participant.user?.email)
          .filter(Boolean)
          .join(', ') || 'Conversation',
      snippet: thread.last_message?.body || thread.preview || '',
      updated_at: thread.updated_at,
    }))
  }, [threadsData])

  useEffect(() => {
    if (threads.length && !activeId) {
      setActiveId(threads[0].id)
    }
  }, [threads, activeId])

  const activeThread = threads.find((thread) => thread.id === activeId) || threads[0] || null

  const fetchMessages = useCallback(() => {
    if (!activeThread) return Promise.resolve([])
    return apiRequest(`/conversations/conversations/${activeThread.id}/messages?limit=50`)
  }, [activeThread?.id])

  const {
    data: messagesData,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
  } = useResource(fetchMessages, [activeThread?.id])

  const messages = useMemo(
    () =>
      unwrapList(messagesData?.data || messagesData).map((message) => ({
        id: message.id,
        author: message.sender?.profile?.display_name || message.sender?.email || 'Member',
        body: message.body || message.content || '',
        created_at: message.created_at,
      })),
    [messagesData]
  )

  const handleSend = async (event) => {
    event.preventDefault()
    if (!activeThread) return
    const formData = new FormData(event.target)
    const body = formData.get('message')?.toString().trim()
    if (!body) {
      push({ title: 'Add a message', intent: 'warning' })
      return
    }
    try {
      await apiRequest(`/conversations/conversations/${activeThread.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      push({ title: 'Message sent' })
      event.target.reset()
      refreshMessages()
    } catch (error) {
      push({ title: 'Send failed', description: error.body?.message || error.message, intent: 'danger' })
    }
  }

  return (
    <div className="messages-view">
      <Surface className="messages-view__list">
        <header>
          <h3>Conversations</h3>
          <Button variant="ghost" size="sm" onClick={refreshThreads}>
            Refresh
          </Button>
        </header>
        {threadsError ? <p>{threadsError.body?.message || threadsError.message}</p> : null}
        <ul>
          {threadsLoading
            ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
            : threads.map((thread) => (
                <li key={thread.id}>
                  <button type="button" onClick={() => setActiveId(thread.id)} className={thread.id === activeThread?.id ? 'active' : ''}>
                    <strong>{thread.name}</strong>
                    <span>{thread.snippet}</span>
                    <em>{formatRelativeTime(thread.updated_at)}</em>
                  </button>
                </li>
              ))}
        </ul>
      </Surface>
      <Surface className="messages-view__thread" elevation="md">
        {activeThread ? (
          <>
            <header>
              <h3>{activeThread.name}</h3>
              <span>{formatRelativeTime(activeThread.updated_at)}</span>
            </header>
            {messagesError ? <p>{messagesError.body?.message || messagesError.message}</p> : null}
            <div className="messages-view__body">
              {messagesLoading
                ? [1, 2, 3].map((index) => <article key={index} className="skeleton skeleton--text" />)
                : messages.map((message) => (
                    <article key={message.id}>
                      <h4>{message.author}</h4>
                      <time>{formatRelativeTime(message.created_at)}</time>
                      <p>{message.body}</p>
                    </article>
                  ))}
            </div>
            <form className="messages-view__composer" onSubmit={handleSend}>
              <textarea name="message" rows={3} placeholder="Message" />
              <div>
                <Button variant="ghost" size="sm" type="button" onClick={refreshMessages}>
                  Refresh
                </Button>
                <Button type="submit">Send</Button>
              </div>
            </form>
          </>
        ) : (
          <p>Select a conversation</p>
        )}
      </Surface>
    </div>
  )
}
function GroupsView() {
  const fetchGroups = useCallback(() => apiRequest('/groups?limit=12'), [])
  const { data, loading, error, refresh } = useResource(fetchGroups, [])
  const groups = unwrapList(data?.data || data)

  return (
    <Surface className="groups-view" elevation="md">
      <header>
        <h2>Groups</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      {error ? <p>{error.body?.message || error.message}</p> : null}
      <ul>
        {loading
          ? [1, 2, 3].map((index) => (
              <li key={index} className="skeleton skeleton--text" />
            ))
          : groups.map((group) => (
              <li key={group.id}>
                <div>
                  <strong>{group.name}</strong>
                  <span>{group.member_count ? `${group.member_count.toLocaleString()} members` : ''}</span>
                </div>
                <Button variant="outline" size="sm">
                  Open
                </Button>
              </li>
            ))}
      </ul>
    </Surface>
  )
}

function LiveView() {
  const fetchLobbies = useCallback(() => apiRequest('/networking/lobbies?limit=12'), [])
  const { data, loading, error, refresh } = useResource(fetchLobbies, [])
  const lobbies = unwrapList(data?.data || data)

  return (
    <Surface className="live-view" elevation="md">
      <header>
        <h2>Live networking</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      {error ? <p>{error.body?.message || error.message}</p> : null}
      <ul>
        {loading
          ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
          : lobbies.map((lobby) => (
              <li key={lobby.id}>
                <div>
                  <strong>{lobby.name || 'Lobby'}</strong>
                  <span>{lobby.type || lobby.topic || '—'}</span>
                </div>
                <Button variant="outline" size="sm">
                  Join
                </Button>
              </li>
            ))}
      </ul>
    </Surface>
  )
}

function MarketplaceView() {
  const fetchMarketplace = useCallback(async () => {
    const [projects, gigs] = await Promise.all([
      apiRequest('/projects?limit=6'),
      apiRequest('/gigs?limit=6'),
    ])
    return { projects: unwrapList(projects?.data || projects), gigs: unwrapList(gigs?.data || gigs) }
  }, [])

  const { data, loading, error, refresh } = useResource(fetchMarketplace, [])

  return (
    <Surface className="marketplace-view" elevation="md">
      <header>
        <h2>Marketplace</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      {error ? <p>{error.body?.message || error.message}</p> : null}
      <section>
        <h3>Projects</h3>
        <ul>
          {loading
            ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
            : data?.projects.map((project) => (
                <li key={project.id}>
                  <strong>{project.title || 'Untitled project'}</strong>
                  <span>{project.status || project.project_type || '—'}</span>
                </li>
              ))}
        </ul>
      </section>
      <section>
        <h3>Gigs</h3>
        <ul>
          {loading
            ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
            : data?.gigs.map((gig) => (
                <li key={gig.id}>
                  <strong>{gig.title || 'Untitled gig'}</strong>
                  <span>{formatCurrency(gig.base_price || gig.price || gig.price_min, gig.currency || gig.price_currency || 'USD')}</span>
                </li>
              ))}
        </ul>
      </section>
    </Surface>
  )
}

function JobsView() {
  const fetchJobs = useCallback(() => apiRequest('/jobs?limit=12&expand=company'), [])
  const { data, loading, error, refresh } = useResource(fetchJobs, [])
  const jobs = unwrapList(data?.data || data)

  return (
    <Surface className="jobs-view" elevation="md">
      <header>
        <h2>Jobs</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      {error ? <p>{error.body?.message || error.message}</p> : null}
      <ul>
        {loading
          ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
          : jobs.map((job) => (
              <li key={job.id}>
                <div>
                  <strong>{job.title || 'Untitled role'}</strong>
                  <span>{job.company?.brand_name || job.company?.legal_name || '—'}</span>
                </div>
                <em>{formatRelativeTime(job.updated_at || job.created_at)}</em>
              </li>
            ))}
      </ul>
    </Surface>
  )
}

function NetworkView() {
  const fetchConnections = useCallback(() => apiRequest('/connections?limit=25&analytics=true'), [])
  const { data, loading, error, refresh } = useResource(fetchConnections, [])
  const connections = unwrapList(data?.data || data)
  const analytics = data?.analytics

  return (
    <Surface className="network-view" elevation="md">
      <header>
        <h2>Network</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      {analytics ? (
        <div className="network-view__analytics">
          <span>Accepted: {analytics.accepted || 0}</span>
          <span>Pending: {analytics.pending || 0}</span>
        </div>
      ) : null}
      {error ? <p>{error.body?.message || error.message}</p> : null}
      <ul>
        {loading
          ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
          : connections.map((connection) => (
              <li key={connection.id}>
                <div>
                  <strong>{connection.other_user?.profile?.display_name || connection.other_user?.email || 'User'}</strong>
                  <span>{connection.status}</span>
                </div>
              </li>
            ))}
      </ul>
    </Surface>
  )
}

function CalendarView() {
  const fetchEvents = useCallback(() => apiRequest('/calendar/events?limit=20&sort=start_at'), [])
  const { data, loading, error, refresh } = useResource(fetchEvents, [])
  const events = unwrapList(data?.data || data)

  return (
    <Surface className="calendar-view" elevation="md">
      <header>
        <h2>Calendar</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      {error ? <p>{error.body?.message || error.message}</p> : null}
      <ul>
        {loading
          ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
          : events.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{event.title || 'Event'}</strong>
                  <span>{formatDateTime(event.start_at || event.start_at)}</span>
                </div>
              </li>
            ))}
      </ul>
    </Surface>
  )
}

function SupportView() {
  const fetchTickets = useCallback(() => apiRequest('/support/tickets?limit=12'), [])
  const { data, loading, error, refresh } = useResource(fetchTickets, [])
  const tickets = unwrapList(data?.data || data)

  return (
    <Surface className="support-view" elevation="md">
      <header>
        <h2>Support</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      {error ? <p>{error.body?.message || error.message}</p> : null}
      <ul>
        {loading
          ? [1, 2, 3].map((index) => <li key={index} className="skeleton skeleton--text" />)
          : tickets.map((ticket) => (
              <li key={ticket.id}>
                <div>
                  <strong>{ticket.subject || 'Ticket'}</strong>
                  <span>{ticket.status}</span>
                </div>
              </li>
            ))}
      </ul>
    </Surface>
  )
}
function SettingsView() {
  const fetchSettings = useCallback(
    () =>
      Promise.all([
        apiRequest('/settings/account'),
        apiRequest('/settings/security'),
        apiRequest('/settings/notifications'),
      ]).then(([account, security, notifications]) => ({ account, security, notifications })),
    []
  )

  const { data, loading, error, refresh } = useResource(fetchSettings, [])

  return (
    <Surface className="settings-view" elevation="md">
      <header>
        <h2>Settings</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      {error ? <p>{error.body?.message || error.message}</p> : null}
      {loading ? (
        <div className="skeleton skeleton--text" />
      ) : (
        <div className="settings-view__grid">
          <section>
            <h3>Account</h3>
            <ul>
              <li>Email: {data?.account?.email}</li>
              <li>Name: {data?.account?.name}</li>
            </ul>
          </section>
          <section>
            <h3>Security</h3>
            <ul>
              <li>Two-factor: {data?.security?.two_factor_enabled ? 'Enabled' : 'Disabled'}</li>
              <li>Last change: {formatDateTime(data?.security?.updated_at)}</li>
            </ul>
          </section>
          <section>
            <h3>Notifications</h3>
            <ul>
              {(data?.notifications?.channels || []).map((channel) => (
                <li key={channel.name}>{`${channel.name}: ${channel.enabled ? 'On' : 'Off'}`}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Surface>
  )
}

function DetailBoard({ definition, context }) {
  const fetchDetail = useCallback(() => definition.loader(context), [definition, context])
  const { data, loading, error, refresh } = useResource(fetchDetail, [definition, context])

  return (
    <Surface className="detail-board" elevation="md">
      <header>
        <h2>{definition.title}</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </header>
      <p>{definition.description}</p>
      <div className="detail-board__table" role="region" aria-live="polite">
        <table>
          <thead>
            <tr>
              {definition.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={definition.columns.length}>
                  <div className="skeleton skeleton--text" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={definition.columns.length}>{error.body?.message || error.message}</td>
              </tr>
            ) : data?.length ? (
              data.map((row, index) => (
                <tr key={definition.columns[0] + index}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${definition.columns[cellIndex]}-${index}`}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={definition.columns.length}>No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Surface>
  )
}

const viewMap = {
  feed: FeedView,
  search: SearchView,
  messages: MessagesView,
  groups: GroupsView,
  live: LiveView,
  marketplace: MarketplaceView,
  jobs: JobsView,
  network: NetworkView,
  calendar: CalendarView,
  support: SupportView,
  settings: SettingsView,
}

export function AppShell() {
  const [role, setRole] = useState('user')
  const [active, setActive] = useState('feed')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const [feedFilter, setFeedFilter] = useState('all')
  const { push } = useToasts()
  const modal = useModal()

  const { data, loading, error, warnings, refresh } = useDashboardResources(role, { feedFilter })

  useEffect(() => {
    if (!data?.roles?.length) return
    if (!data.roles.find((item) => item.name === role)) {
      setRole(data.roles[0].name)
    }
  }, [data?.roles, role])

  useEffect(() => {
    setFeedFilter('all')
  }, [role])

  const handleSearch = useCallback(
    async (query) => {
      setActive('search')
      setLastQuery(query)
      setSearching(true)
      try {
        const results = await apiRequest(`/search?q=${encodeURIComponent(query)}`)
        const normalized = Array.isArray(results) ? results : results?.items || []
        setSearchResults(normalized)
        push({ title: 'Search completed', description: `Results for “${query}” ready.` })
      } catch (searchError) {
        push({ title: 'Search failed', description: searchError.body?.message || searchError.message, intent: 'danger' })
      } finally {
        setSearching(false)
      }
    },
    [push]
  )

  const handleCreate = useCallback(
    (type) => {
      modal.open(({ close }) => (
        <QuickCreateForm
          type={type}
          onSuccess={() => refresh()}
          onClose={close}
        />
      ))
    },
    [modal, refresh]
  )

  const handleFeedFilterChange = useCallback(
    (nextFilter) => {
      setFeedFilter((current) => {
        if (current === nextFilter) {
          return current
        }
        push({
          title: 'Feed updated',
          description: `Showing ${getFeedFilterLabel(nextFilter)} stories.`,
        })
        return nextFilter
      })
    },
    [push]
  )

  const handleConnect = useCallback(
    async (item) => {
      if (!item.id) {
        push({ title: 'Connection queued', description: `Saved ${item.name} for follow-up.` })
        return
      }
      try {
        await apiRequest('/connections/request', {
          method: 'POST',
          body: JSON.stringify({ to_user_id: item.id }),
        })
        push({ title: 'Invite sent', description: `Connection invite sent to ${item.name}.` })
      } catch (connectError) {
        push({ title: 'Invite failed', description: connectError.body?.message || connectError.message, intent: 'danger' })
      }
    },
    [push]
  )

  const handleSaveOpportunity = useCallback(
    async (item) => {
      if (!item.id) {
        push({ title: 'Saved', description: `${item.title} added to saved opportunities.` })
        return
      }
      try {
        await apiRequest(`/suggestions/${item.id}/events`, {
          method: 'POST',
          body: JSON.stringify({ event_type: 'save' }),
        })
        push({ title: 'Saved', description: `${item.title} stored in saved opportunities.` })
      } catch (saveError) {
        push({ title: 'Save failed', description: saveError.body?.message || saveError.message, intent: 'danger' })
      }
    },
    [push]
  )

  const leftColumn = useMemo(
    () => (
      <>
        <ProfileCard profile={data?.profile} loading={loading} />
        <MetricStack metrics={data?.metrics || []} loading={loading} />
      </>
    ),
    [data?.profile, data?.metrics, loading]
  )

  const rightColumn = useMemo(
    () => (
      <RightRail
        whoToFollow={data?.whoToFollow || []}
        collections={data?.collections || { groups: [], companies: [], opportunities: [] }}
        loading={loading}
        onConnect={handleConnect}
        onSaveOpportunity={handleSaveOpportunity}
      />
    ),
    [data?.whoToFollow, data?.collections, loading, handleConnect, handleSaveOpportunity]
  )

  const detailContext = useMemo(() => ({ profile: data?.profile }), [data?.profile])

  const feedProps = {
    feed: data?.feed || [],
    loading,
    error,
    onRefresh: refresh,
    activeFilter: feedFilter,
    onFilterChange: handleFeedFilterChange,
    profile: data?.profile,
  }

  const mainContent = useMemo(() => {
    if (active === 'feed') {
      return <FeedView {...feedProps} />
    }
    if (active === 'search') {
      return <SearchView results={searchResults} searching={searching} lastQuery={lastQuery} />
    }
    if (detailViewDefinitions[active]) {
      return <DetailBoard definition={detailViewDefinitions[active]} context={detailContext} />
    }
    const Component = viewMap[active]
    if (Component) return <Component />
    return <FeedView {...feedProps} />
  }, [active, feedProps, searchResults, searching, lastQuery, data?.profile])

  const unreadNotifications = useMemo(
    () => (data?.notifications || []).filter((notification) => notification.read === false || !notification.read_at).length,
    [data?.notifications],
  )

  const primaryNavItems = useMemo(() => {
    const opportunityCount = data?.collections?.opportunities?.length || 0
    const followSuggestions = data?.whoToFollow?.length || 0
    const messageAlerts = (data?.notifications || []).filter((notification) =>
      (notification.category && notification.category.toLowerCase() === 'message') ||
      notification.title?.toLowerCase()?.includes('message'),
    ).length

    return PRIMARY_NAV_ITEMS.map((item) => {
      if (item.key === 'jobs' && opportunityCount) {
        return { ...item, badge: opportunityCount > 9 ? '9+' : `${opportunityCount}` }
      }
      if (item.key === 'network' && followSuggestions) {
        return { ...item, badge: `+${followSuggestions}` }
      }
      if (item.key === 'messages' && messageAlerts) {
        return { ...item, badge: messageAlerts > 9 ? '9+' : `${messageAlerts}` }
      }
      if (item.key === 'feed' && unreadNotifications) {
        return { ...item, badge: unreadNotifications > 9 ? '9+' : `${unreadNotifications}` }
      }
      return item
    })
  }, [data?.collections?.opportunities, data?.notifications, data?.whoToFollow, unreadNotifications])

  const isFeedExperience = active === 'feed' || active === 'search'

  return (
    <div className={cx('app-shell', isFeedExperience && 'app-shell--feed')}>
      <Topbar
        onSearch={handleSearch}
        onCreate={handleCreate}
        notifications={data?.notifications || []}
        profile={data?.profile || { initials: '', name: '', headline: '' }}
        roles={data?.roles || []}
        currentRole={role}
        onRoleChange={setRole}
        primaryNavItems={primaryNavItems}
        activeNav={active}
        onNavSelect={setActive}
      />
      <div className={cx('app-shell__body', isFeedExperience && 'app-shell__body--feed')}>
        {!isFeedExperience ? (
          <Sidebar currentRole={role} onSelect={(item) => setActive(item.key)} activeKey={active} />
        ) : null}
        <main className={cx('app-shell__content', isFeedExperience && 'app-shell__content--feed')}>
          {warnings?.length ? (
            <div className="app-shell__warnings">
              {warnings.map((warning) => (
                <p key={warning.key}>{warning.message}</p>
              ))}
            </div>
          ) : null}
          {error && !data ? <p>{error.body?.message || error.message}</p> : null}
          <LayoutGrid
            left={leftColumn}
            main={mainContent}
            right={rightColumn}
            hideLeft={Boolean(detailViewDefinitions[active])}
          />
        </main>
      </div>
    </div>
  )
}

export default AppShell
