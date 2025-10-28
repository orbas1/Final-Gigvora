import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../utils/apiClient'

const unwrapList = (payload) => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.rows)) return payload.rows
  const firstArrayKey = Object.keys(payload).find((key) => Array.isArray(payload[key]))
  if (firstArrayKey) return payload[firstArrayKey]
  return []
}

const toInitials = (name = '') => {
  const parts = String(name)
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return name.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const formatDateLabel = (value) => {
  if (!value) return '—'
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date)
  } catch (error) {
    return '—'
  }
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

const normaliseNotification = (notification) => ({
  id: notification.id,
  title: notification.title || notification.subject || 'Notification',
  description: notification.description || notification.preview || '',
  read: Boolean(notification.read || notification.read_at),
})

const normaliseFeedItem = (post) => {
  const authorProfile = post.author?.profile || post.author?.profile_snapshot || {}
  const authorName = authorProfile.display_name || post.author?.email || 'Unknown author'
  return {
    id: post.id,
    author: authorName,
    avatar: toInitials(authorName),
    avatarUrl: authorProfile.avatar_url || post.author?.avatar_url || null,
    timestamp: formatRelativeTime(post.created_at || post.published_at),
    headline: post.title || post.content?.slice(0, 240) || 'Untitled update',
    media: post.media?.[0]?.url || post.cover_image || null,
    reactions: Number(post.reaction_count ?? post.metrics?.reactions ?? 0),
    comments: Number(post.comment_count ?? post.metrics?.comments ?? 0),
    shares: Number(post.share_count ?? post.metrics?.shares ?? 0),
    tags: Array.isArray(post.tags) ? post.tags : [],
  }
}

const normaliseSuggestionName = (record) =>
  record.display_name || record.name || record.title || record.headline || record.company?.name || 'Untitled'

const buildOpportunity = (item, type) => {
  const title = normaliseSuggestionName(item)
  const currency = item.currency || item.budget_currency || item.salary_currency || 'USD'
  const min = item.salary_min || item.budget_min || item.hourly_rate || item.price || item.rate_min
  const max = item.salary_max || item.budget_max || item.rate_max
  let rate = 'Rate TBD'
  if (min && max) {
    rate = `${currency} ${Number(min).toLocaleString()} - ${Number(max).toLocaleString()}`
  } else if (min) {
    rate = `${currency} ${Number(min).toLocaleString()}`
  } else if (max) {
    rate = `${currency} ${Number(max).toLocaleString()}`
  } else if (item.rate) {
    rate = item.rate
  }
  return {
    id: item.id || item.entity_id || item.entity_ref_id,
    title,
    type,
    rate,
  }
}

const mapMetrics = (payload) => {
  if (!payload) {
    return []
  }
  const totals = payload.totals || {}
  const latency = payload.latency || {}
  const feeds = payload.feeds || {}
  const topFeedKey = Object.keys(feeds).sort((a, b) => (feeds[b]?.requests || 0) - (feeds[a]?.requests || 0))[0]
  return [
    {
      label: 'Feed requests',
      value: (totals.requests || 0).toLocaleString(),
      delta: `${((payload.error_rate || 0) * 100).toFixed(1)}% error rate`,
    },
    {
      label: 'Avg latency',
      value: `${Math.round(latency.avg_ms || 0)} ms`,
      delta: `p95 ${Math.round(latency.p95_ms || 0)} ms`,
    },
    {
      label: 'Top surface',
      value: topFeedKey ? topFeedKey : 'n/a',
      delta: `${feeds[topFeedKey]?.requests || 0} requests`,
    },
  ]
}

const normaliseRole = (role) => ({ name: role })

export function useDashboardResources(activeRole, options = {}) {
  const [state, setState] = useState({ loading: true, error: null, data: null, warnings: [] })
  const { feedFilter = 'all' } = options

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    const warnings = []
    try {
      const me = await apiRequest('/auth/me')
      const user = me?.user || me
      if (!user?.id) {
        throw new Error('Unable to resolve signed-in user.')
      }

      let profile = null
      try {
        profile = await apiRequest(`/profiles/${user.id}`)
      } catch (error) {
        warnings.push({ key: 'profile', message: error.body?.message || error.message })
      }

      const feedParams = new URLSearchParams({ limit: '20', expand: 'author' })
      if (feedFilter && feedFilter !== 'all') {
        feedParams.append('scope', feedFilter)
      }
      if (activeRole && activeRole !== 'user') {
        feedParams.append('role', activeRole)
      }

      const results = await Promise.allSettled([
        apiRequest('/notifications?limit=20'),
        apiRequest(`/posts?${feedParams.toString()}`),
        apiRequest('/feed/analytics/health').catch((error) => {
          warnings.push({ key: 'metrics', message: error.body?.message || error.message })
          return null
        }),
        apiRequest('/suggestions?for=people&limit=6'),
        apiRequest('/suggestions?for=groups&limit=6'),
        apiRequest('/suggestions?for=companies&limit=6'),
        apiRequest('/suggestions?for=projects&limit=4'),
        apiRequest('/suggestions?for=gigs&limit=4'),
        apiRequest('/suggestions?for=jobs&limit=4'),
        apiRequest('/connections?limit=50&analytics=true'),
      ])

      const [
        notificationsResult,
        feedResult,
        metricsResult,
        peopleResult,
        groupsResult,
        companiesResult,
        projectsResult,
        gigsResult,
        jobsResult,
        connectionsResult,
      ] = results

      const capture = (result, key) => {
        if (result?.status === 'fulfilled') return result.value
        if (result?.status === 'rejected' && result.reason) {
          const reason = result.reason
          warnings.push({ key, message: reason.body?.message || reason.message || `Unable to load ${key}.` })
        }
        return null
      }

      const notificationsResponse = capture(notificationsResult, 'notifications')
      const feedResponse = capture(feedResult, 'feed')
      const metricsResponse = capture(metricsResult, 'metrics')
      const peopleResponse = capture(peopleResult, 'people suggestions')
      const groupsResponse = capture(groupsResult, 'group suggestions')
      const companiesResponse = capture(companiesResult, 'company suggestions')
      const projectsResponse = capture(projectsResult, 'project suggestions')
      const gigsResponse = capture(gigsResult, 'gig suggestions')
      const jobsResponse = capture(jobsResult, 'job suggestions')
      const connectionsResponse = capture(connectionsResult, 'connections')

      const notifications = unwrapList(notificationsResponse).map(normaliseNotification)
      const feedItems = unwrapList(feedResponse?.data || feedResponse).map(normaliseFeedItem)
      const metrics = mapMetrics(metricsResponse)

      const whoToFollow = unwrapList(peopleResponse).map((item) => ({
        id: item.id || item.entity_id || item.entity_ref_id,
        name: normaliseSuggestionName(item),
        role: item.headline || item.location || item.title || '',
        mutuals: Number(item.mutual_connections || item.mutuals || 0),
      }))

      const groupNames = unwrapList(groupsResponse).map((group) => group.name || normaliseSuggestionName(group))
      const companyNames = unwrapList(companiesResponse).map((company) => company.brand_name || company.legal_name || normaliseSuggestionName(company))

      const opportunities = [
        ...unwrapList(projectsResponse).map((project) => buildOpportunity(project, 'Project')),
        ...unwrapList(gigsResponse).map((gig) => buildOpportunity(gig, 'Gig')),
        ...unwrapList(jobsResponse).map((job) => buildOpportunity(job, 'Job')),
      ].slice(0, 6)

      const connectionsList = unwrapList(connectionsResponse?.data || connectionsResponse)
      const connectionAnalytics = connectionsResponse?.analytics
      const followerCount = Number(connectionAnalytics?.accepted || connectionsList.length || 0)
      const followingCount = Number(connectionAnalytics?.total || connectionsList.length || 0)

      const headline = profile?.headline || profile?.freelancer_overlay?.headline || ''
      const name = profile?.display_name || user.name || user.full_name || user.email?.split('@')[0] || 'Account'
      const location = profile?.location || user.metadata?.location || ''
      const analytics = profile?.analytics_snapshot || {}

      const mappedProfile = {
        id: profile?.id || user.id,
        userId: user.id,
        name,
        initials: profile?.avatar_url ? '' : toInitials(name),
        avatarUrl: profile?.avatar_url || null,
        headline: headline || 'Complete your profile to increase trust.',
        location: location || 'Location unavailable',
        accountAge: `Joined ${formatDateLabel(user.created_at)}`,
        followers: followerCount,
        following: followingCount,
        projects: Number(analytics.projects || analytics.active_projects || 0),
        gigs: Number(analytics.gigs || analytics.active_gigs || 0),
        jobs: Number(analytics.jobs || analytics.active_jobs || 0),
      }

      const availableRoles = new Set()
      if (user.role) availableRoles.add(user.role)
      if (user.active_role) availableRoles.add(user.active_role)
      const metadataRoles = Array.isArray(user.metadata?.roles) ? user.metadata.roles : []
      metadataRoles.forEach((role) => availableRoles.add(role))
      if (!availableRoles.size) {
        ;['user', 'freelancer', 'agency', 'company', 'headhunter', 'admin'].forEach((role) => availableRoles.add(role))
      }

      const data = {
        profile: mappedProfile,
        metrics,
        whoToFollow,
        collections: {
          groups: groupNames.slice(0, 6),
          companies: companyNames.slice(0, 6),
          opportunities,
        },
        feed: feedItems,
        notifications,
        roles: Array.from(availableRoles).map(normaliseRole),
      }

      setState({ loading: false, error: null, data, warnings })
    } catch (error) {
      setState({ loading: false, error, data: null, warnings })
    }
  }, [activeRole, feedFilter])

  useEffect(() => {
    load()
  }, [load])

  const refresh = useCallback(() => {
    load()
  }, [load])

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh])

  return value
}

export default useDashboardResources
