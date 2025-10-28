import { useEffect, useMemo, useRef, useState } from 'react'
import Surface from '../primitives/Surface'
import Button from '../primitives/Button'
import Icon from '../primitives/Icon'
import FeedPost from './FeedPost'
import './FeedTimeline.css'

function SuggestionModule({ title, items, actionLabel, onAction }) {
  return (
    <Surface className="feed-timeline__module" elevation="sm">
      <header>
        <h3>{title}</h3>
      </header>
      <ul>
        {items.map((item) => (
          <li key={item.id || item.name}>
            <div>
              <strong>{item.name}</strong>
              {item.subtitle ? <span>{item.subtitle}</span> : null}
            </div>
            {actionLabel && onAction ? (
              <Button size="sm" variant="outline" onClick={() => onAction(item)}>
                {actionLabel}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Surface>
  )
}

function OpportunityModule({ opportunities, onSave }) {
  return (
    <Surface className="feed-timeline__module" elevation="sm">
      <header>
        <h3>Trending gigs, jobs &amp; projects</h3>
      </header>
      <ul>
        {opportunities.map((item) => (
          <li key={item.id || item.title}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.type}</span>
            </div>
            <div className="feed-timeline__module-meta">
              <em>{item.rate}</em>
              {onSave ? (
                <Button size="sm" variant="ghost" onClick={() => onSave(item)}>
                  Save
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Surface>
  )
}

function FeedTimeline({
  items,
  suggestions = {},
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onReact,
  onSave,
  onShare,
  onReport,
  onCommentAdded,
  onConnect,
  onSaveOpportunity,
}) {
  const sentinelRef = useRef(null)
  const [expandedThreads, setExpandedThreads] = useState(new Set())

  useEffect(() => {
    if (!hasMore || loadingMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onLoadMore?.()
          }
        })
      },
      { rootMargin: '320px 0px 0px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, onLoadMore])

  const toggleComments = (postId) => {
    setExpandedThreads((current) => {
      const next = new Set(current)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      return next
    })
  }

  const timeline = useMemo(() => {
    const modules = []
    if (suggestions.people?.length) {
      modules.push({
        type: 'people',
        node: (
          <SuggestionModule
            key="module-people"
            title="Connection spotlight"
            items={suggestions.people.map((person) => ({
              id: person.id,
              name: person.name,
              subtitle: person.role,
            }))}
            actionLabel="Connect"
            onAction={onConnect}
          />
        ),
      })
    }
    if (suggestions.groups?.length) {
      modules.push({
        type: 'groups',
        node: (
          <SuggestionModule
            key="module-groups"
            title="Groups for you"
            items={suggestions.groups.map((group) => ({ id: group, name: group }))}
          />
        ),
      })
    }
    if (suggestions.companies?.length) {
      modules.push({
        type: 'companies',
        node: (
          <SuggestionModule
            key="module-companies"
            title="Companies to watch"
            items={suggestions.companies.map((company) => ({ id: company, name: company }))}
          />
        ),
      })
    }
    if (suggestions.opportunities?.length) {
      modules.push({
        type: 'opportunities',
        node: (
          <OpportunityModule
            key="module-opportunities"
            opportunities={suggestions.opportunities}
            onSave={onSaveOpportunity}
          />
        ),
      })
    }

    const assembled = []
    const positions = [1, 3, 5, 7]
    let insertedCount = 0
    items.forEach((item, index) => {
      assembled.push({ key: `post-${item.id}`, node: item, type: 'post' })
      const moduleIndex = positions.indexOf(index + 1)
      if (moduleIndex !== -1 && modules[moduleIndex]) {
        assembled.push({ key: `module-${modules[moduleIndex].type}`, node: modules[moduleIndex].node, type: 'module' })
        insertedCount += 1
      }
    })

    if (!items.length && modules[0]) {
      assembled.push({ key: 'module-initial', node: modules[0].node, type: 'module' })
    }

    modules.slice(insertedCount).forEach((module) => {
      assembled.push({ key: `module-${module.type}`, node: module.node, type: 'module' })
    })

    return assembled
  }, [items, suggestions, onConnect, onSaveOpportunity])

  return (
    <div className="feed-timeline">
      {error ? (
        <Surface className="feed-timeline__status feed-timeline__status--error" elevation="sm">
          <Icon name="notification" size={18} />
          <p>{error.body?.message || error.message}</p>
        </Surface>
      ) : null}

      {loading && !items.length ? (
        <ul className="feed-timeline__list" aria-live="polite">
          {[0, 1, 2].map((index) => (
            <li key={`skeleton-${index}`} className="feed-timeline__item">
              <Surface elevation="sm" className="feed-timeline__skeleton">
                <span className="skeleton skeleton--avatar" />
                <div className="feed-timeline__skeleton-lines">
                  <span className="skeleton skeleton--text" />
                  <span className="skeleton skeleton--text" />
                  <span className="skeleton skeleton--text" />
                </div>
              </Surface>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="feed-timeline__list">
        {timeline.map((entry) => (
          <li key={entry.key} className="feed-timeline__item">
            {entry.type === 'post' ? (
              <FeedPost
                post={entry.node}
                onReact={onReact}
                onSave={onSave}
                onShare={onShare}
                onReport={onReport}
                onToggleComments={() => toggleComments(entry.node.id)}
                showComments={expandedThreads.has(entry.node.id)}
                onCommentAdded={onCommentAdded}
              />
            ) : (
              entry.node
            )}
          </li>
        ))}
      </ul>

      {loadingMore ? (
        <div className="feed-timeline__status" aria-live="polite">
          <Icon name="refresh" size={16} className="feed-timeline__spinner" />
          <span>Loading more updates</span>
        </div>
      ) : null}

      {hasMore ? <div ref={sentinelRef} className="feed-timeline__sentinel" aria-hidden="true" /> : null}
    </div>
  )
}

export default FeedTimeline
