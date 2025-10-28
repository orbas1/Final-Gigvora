import { useCallback, useMemo } from 'react'
import Surface from '../primitives/Surface'
import Button from '../primitives/Button'
import Icon from '../primitives/Icon'
import { useToasts } from '../feedback/Toaster'
import { apiRequest } from '../../utils/apiClient'
import { normaliseFeedItem } from '../../utils/feedTransforms'
import { useFeedStream } from '../../hooks/useFeedStream'
import FeedComposer from './FeedComposer'
import FeedFilters from './FeedFilters'
import FeedTimeline from './FeedTimeline'
import './FeedView.css'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'following', label: 'Following' },
  { key: 'groups', label: 'Groups' },
  { key: 'companies', label: 'Companies' },
]

function FeedView({
  profile,
  filter,
  onFilterChange,
  role,
  initialItems = [],
  initialCursor = null,
  suggestions = {},
  isGlobalLoading = false,
  globalError = null,
  onRefreshAll,
  onConnectSuggestion,
  onSaveOpportunity,
}) {
  const { push } = useToasts()
  const {
    items,
    error,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    updateItem,
    prependItem,
  } = useFeedStream({ filter, role, initialItems, initialCursor })

  const mergedError = globalError || error
  const busy = (isGlobalLoading && !initialItems.length) || loading

  const handleRefresh = useCallback(async () => {
    await refresh()
    if (onRefreshAll) onRefreshAll()
  }, [refresh, onRefreshAll])

  const handleComposerSuccess = useCallback(
    (payload) => {
      const normalised = normaliseFeedItem(payload)
      if (normalised) {
        prependItem(normalised)
        push({ title: 'Post published', description: 'Your update is live.' })
        if (onRefreshAll) onRefreshAll()
      }
    },
    [prependItem, push, onRefreshAll],
  )

  const handleReaction = useCallback(
    async (postId, type, currentReaction) => {
      try {
        if (currentReaction === type) {
          await apiRequest(`/posts/${postId}/reactions/${type}`, { method: 'DELETE' })
          updateItem(postId, (item) => ({
            ...item,
            stats: {
              ...item.stats,
              reactions: Math.max(0, (item.stats?.reactions || 0) - 1),
            },
            viewer: { ...item.viewer, reaction: null },
          }))
          return
        }
        await apiRequest(`/posts/${postId}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ type }),
        })
        updateItem(postId, (item) => ({
          ...item,
          stats: {
            ...item.stats,
            reactions:
              (item.stats?.reactions || 0) + (currentReaction ? 0 : 1),
          },
          viewer: { ...item.viewer, reaction: type },
        }))
      } catch (reactionError) {
        push({
          title: 'Reaction failed',
          description: reactionError.body?.message || reactionError.message,
          intent: 'danger',
        })
      }
    },
    [updateItem, push],
  )

  const handleSave = useCallback(
    async (postId, saved) => {
      try {
        if (saved) {
          await apiRequest(`/posts/${postId}/save`, { method: 'DELETE' })
        } else {
          await apiRequest(`/posts/${postId}/save`, { method: 'POST' })
        }
        updateItem(postId, (item) => ({
          ...item,
          stats: {
            ...item.stats,
            saves: Math.max(0, (item.stats?.saves || 0) + (saved ? -1 : 1)),
          },
          viewer: { ...item.viewer, saved: !saved },
        }))
      } catch (saveError) {
        push({
          title: 'Save failed',
          description: saveError.body?.message || saveError.message,
          intent: 'danger',
        })
      }
    },
    [updateItem, push],
  )

  const handleShare = useCallback(
    async (postId) => {
      try {
        await apiRequest(`/posts/${postId}/share`, { method: 'POST' })
        updateItem(postId, (item) => ({
          ...item,
          stats: {
            ...item.stats,
            shares: (item.stats?.shares || 0) + 1,
          },
        }))
        push({ title: 'Shared', description: 'Post shared with your network.' })
      } catch (shareError) {
        push({
          title: 'Unable to share',
          description: shareError.body?.message || shareError.message,
          intent: 'danger',
        })
      }
    },
    [updateItem, push],
  )

  const handleReport = useCallback(
    async (postId) => {
      try {
        await apiRequest(`/posts/${postId}/report`, { method: 'POST' })
        push({
          title: 'Report submitted',
          description: 'Our trust team will review this update.',
        })
      } catch (reportError) {
        push({
          title: 'Report failed',
          description: reportError.body?.message || reportError.message,
          intent: 'danger',
        })
      }
    },
    [push],
  )

  const handleCommentAdded = useCallback(
    (postId, delta = 1) => {
      updateItem(postId, (item) => ({
        ...item,
        stats: {
          ...item.stats,
          comments: Math.max(0, (item.stats?.comments || 0) + delta),
        },
      }))
    },
    [updateItem],
  )

  const timelineItems = useMemo(() => items, [items])

  return (
    <div className="feed-view">
      <FeedComposer
        profile={profile}
        onPublish={handleComposerSuccess}
        suggestions={suggestions}
      />
      <Surface className="feed-view__controls" padding="sm" elevation="sm">
        <FeedFilters
          value={filter}
          options={FILTERS}
          onChange={onFilterChange}
          disabled={busy}
        />
        <Button
          variant="outline"
          size="sm"
          icon={<Icon name="refresh" size={16} />}
          onClick={handleRefresh}
          disabled={busy}
        >
          Refresh
        </Button>
      </Surface>
      <FeedTimeline
        items={timelineItems}
        suggestions={suggestions}
        loading={busy}
        loadingMore={loadingMore}
        error={mergedError}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onReact={handleReaction}
        onSave={handleSave}
        onShare={handleShare}
        onReport={handleReport}
        onCommentAdded={handleCommentAdded}
        onConnect={onConnectSuggestion}
        onSaveOpportunity={onSaveOpportunity}
      />
    </div>
  )
}

export default FeedView
