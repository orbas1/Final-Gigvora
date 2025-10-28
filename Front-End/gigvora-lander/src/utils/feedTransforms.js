const ensureArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  return []
}

export const unwrapList = (payload) => {
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

export const toInitials = (name = '') => {
  const parts = String(name)
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return name.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const formatRelativeTime = (value) => {
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
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        Math.round(duration),
        division.unit,
      )
    }
    duration /= division.amount
  }
  return ''
}

const normaliseMedia = (item) => {
  if (!item) return null
  const url = item.url || item.source || item.href || item.link
  if (!url) return null
  const type = item.type || item.media_type || (url.endsWith('.mp4') ? 'video' : 'image')
  return {
    id: item.id || item.media_id || url,
    type,
    url,
    preview: item.preview || item.thumbnail_url || item.preview_url || null,
    alt: item.alt || item.description || item.title || '',
  }
}

const normaliseEntityShare = (attachment) => {
  if (!attachment) return null
  return {
    type: attachment.type || attachment.entity_type,
    id: attachment.id || attachment.entity_id || attachment.reference_id || null,
    title: attachment.title || attachment.name || attachment.headline || '',
    subtitle:
      attachment.subtitle ||
      attachment.role ||
      attachment.company ||
      attachment.location ||
      attachment.status ||
      '',
    description: attachment.description || attachment.summary || '',
    url: attachment.url || attachment.link || attachment.href || null,
  }
}

export const normaliseFeedItem = (post) => {
  if (!post) return null
  const authorProfile =
    post.author?.profile || post.author?.profile_snapshot || post.profile || post.author_profile || {}
  const authorName =
    authorProfile.display_name ||
    post.author?.name ||
    post.author?.full_name ||
    post.author?.email?.split('@')[0] ||
    'Member'
  const attachments = ensureArray(post.attachments)
  const mediaAttachments = [
    ...ensureArray(post.media),
    ...attachments.filter((attachment) => ['image', 'video', 'media'].includes(attachment.type)),
  ]
    .map(normaliseMedia)
    .filter(Boolean)

  const linkAttachment =
    attachments.find((attachment) => attachment.type === 'link') ||
    (post.link ? { url: post.link } : null)
  const entityAttachment = attachments.find((attachment) =>
    ['project', 'gig', 'job', 'profile', 'company'].includes(attachment.type),
  )

  const tags = Array.isArray(post.tags)
    ? post.tags
    : typeof post.tags === 'string'
      ? post.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : []

  const createdAt = post.created_at || post.published_at || post.inserted_at || post.updated_at

  return {
    id: post.id || post.post_id || post.uuid,
    author: {
      id: post.author?.id || authorProfile.id || null,
      name: authorName,
      headline: authorProfile.headline || authorProfile.title || post.author?.headline || '',
      location: authorProfile.location || authorProfile.city || '',
      avatarUrl: authorProfile.avatar_url || post.author?.avatar_url || null,
      initials: authorProfile.avatar_url ? '' : toInitials(authorName),
      verified: Boolean(authorProfile.verified || post.author?.verified),
    },
    headline: post.title || '',
    content: post.content || post.body || post.text || '',
    createdAt,
    timestamp: formatRelativeTime(createdAt),
    link: linkAttachment?.url || linkAttachment?.href || null,
    media: mediaAttachments,
    entityShare: normaliseEntityShare(entityAttachment),
    tags,
    stats: {
      reactions: Number(post.reaction_count ?? post.metrics?.reactions ?? post.reactions_count ?? 0),
      comments: Number(post.comment_count ?? post.metrics?.comments ?? 0),
      shares: Number(post.share_count ?? post.metrics?.shares ?? 0),
      saves: Number(post.save_count ?? post.metrics?.saves ?? 0),
    },
    viewer: {
      reaction: post.viewer_reaction || post.user_reaction || null,
      saved: Boolean(post.viewer_has_saved || post.is_saved || post.saved),
    },
    visibility: post.visibility || post.scope || 'public',
    topics: Array.isArray(post.topics) ? post.topics : [],
  }
}

export const normaliseComment = (comment) => {
  if (!comment) return null
  const authorProfile =
    comment.author?.profile || comment.author_profile || comment.user?.profile || comment.profile || {}
  const authorName =
    authorProfile.display_name ||
    comment.author?.name ||
    comment.author?.full_name ||
    comment.author?.email?.split('@')[0] ||
    'Member'
  const createdAt = comment.created_at || comment.inserted_at || comment.updated_at
  return {
    id: comment.id || comment.comment_id || comment.uuid,
    postId: comment.post_id || comment.postId,
    parentId: comment.parent_id || comment.parentId || null,
    content: comment.body || comment.content || comment.text || '',
    createdAt,
    timestamp: formatRelativeTime(createdAt),
    author: {
      id: comment.author?.id || authorProfile.id || null,
      name: authorName,
      headline: authorProfile.headline || authorProfile.title || '',
      avatarUrl: authorProfile.avatar_url || comment.author?.avatar_url || null,
      initials: authorProfile.avatar_url ? '' : toInitials(authorName),
    },
    reactions: Number(comment.reaction_count ?? comment.metrics?.reactions ?? 0),
    viewer: {
      reaction: comment.viewer_reaction || null,
    },
    replies: unwrapList(comment.replies).map(normaliseComment).filter(Boolean),
  }
}

export const normaliseSuggestionName = (record) =>
  record?.display_name || record?.name || record?.title || record?.headline || record?.company?.name || 'Untitled'

export const extractNextCursor = (payload) => {
  if (!payload) return null
  const pagination = payload.pagination || payload.meta || payload.page || {}
  if (payload.next_cursor) return { cursor: payload.next_cursor }
  if (payload.next) return { cursor: payload.next }
  if (payload.cursor?.next) return { cursor: payload.cursor.next }
  if (pagination.next_cursor) return { cursor: pagination.next_cursor }
  if (pagination.next) return { cursor: pagination.next }
  if (pagination.next_page) return { page: pagination.next_page }
  if (pagination.current_page && pagination.total_pages) {
    const nextPage = pagination.current_page + 1
    if (nextPage <= pagination.total_pages) {
      return { page: nextPage }
    }
    return null
  }
  if (pagination.offset !== undefined) {
    const limit = pagination.limit || pagination.per_page || pagination.page_size
    if (limit !== undefined) {
      const nextOffset = Number(pagination.offset || 0) + Number(limit)
      const total = pagination.total || pagination.total_count
      if (total !== undefined && nextOffset >= Number(total)) {
        return null
      }
      return { offset: nextOffset }
    }
  }
  if (payload.links?.next) return { cursor: payload.links.next }
  return null
}

export default {
  unwrapList,
  toInitials,
  formatRelativeTime,
  normaliseFeedItem,
  normaliseComment,
  normaliseSuggestionName,
  extractNextCursor,
}
