import { useCallback, useEffect, useMemo, useState } from 'react'
import Surface from '../primitives/Surface'
import Button from '../primitives/Button'
import { Avatar } from '../primitives/Avatar'
import Icon from '../primitives/Icon'
import { useToasts } from '../feedback/Toaster'
import { apiRequest } from '../../utils/apiClient'
import { normaliseSuggestionName, unwrapList } from '../../utils/feedTransforms'
import './FeedComposer.css'

const SHARE_MODES = [
  { key: 'update', label: 'Update', icon: 'feed' },
  { key: 'media', label: 'Media', icon: 'media' },
  { key: 'link', label: 'Link', icon: 'link' },
  { key: 'project', label: 'Project', icon: 'projects' },
  { key: 'gig', label: 'Gig', icon: 'marketplace' },
  { key: 'job', label: 'Job', icon: 'jobs' },
  { key: 'profile', label: 'Profile', icon: 'network' },
]

const entityConfig = {
  project: { endpoint: '/projects', label: 'Project' },
  gig: { endpoint: '/gigs', label: 'Gig' },
  job: { endpoint: '/jobs', label: 'Job' },
  profile: { endpoint: '/profiles', label: 'Profile' },
}

function FeedComposer({ profile, onPublish, suggestions = {} }) {
  const [mode, setMode] = useState('update')
  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState(null)
  const [entity, setEntity] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { push } = useToasts()

  const currentConfig = entityConfig[mode]

  useEffect(() => {
    if (!currentConfig) return
    if (!searchTerm || searchTerm.trim().length < 2) {
      const seeded = suggestions.opportunities || []
      const filtered = seeded.filter((item) => item.type?.toLowerCase() === currentConfig.label.toLowerCase())
      setSearchResults(filtered)
      return
    }
    let cancelled = false
    setSearching(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '6', q: searchTerm.trim() })
        const response = await apiRequest(`${currentConfig.endpoint}?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!cancelled) {
          const items = unwrapList(response?.data || response).map((item) => ({
            id: item.id || item.entity_id || item.uuid,
            name: normaliseSuggestionName(item),
            subtitle: item.headline || item.company?.brand_name || item.location || item.status || '',
          }))
          setSearchResults(items)
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSearchResults([])
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 240)
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [currentConfig, searchTerm, suggestions.opportunities])

  useEffect(() => {
    setEntity(null)
    setSearchTerm('')
    setSearchResults([])
    setFile(null)
    if (mode === 'link') {
      setLink('')
    }
  }, [mode])

  const characterCount = content.trim().length
  const characterHint = characterCount ? `${characterCount} characters` : 'Share what is top of mind'

  const primaryActionLabel = useMemo(() => {
    switch (mode) {
      case 'media':
        return 'Post media'
      case 'link':
        return 'Share link'
      case 'project':
        return 'Share project'
      case 'gig':
        return 'Promote gig'
      case 'job':
        return 'Announce job'
      case 'profile':
        return 'Highlight profile'
      default:
        return 'Share update'
    }
  }, [mode])

  const handleFileChange = useCallback((event) => {
    const selected = event.target.files?.[0]
    if (selected) {
      setFile(selected)
    } else {
      setFile(null)
    }
  }, [])

  const handleEntitySelect = useCallback((item) => {
    setEntity(item)
  }, [])

  const buildRequestBody = useCallback(() => {
    const baseContent = content.trim()
    if (!baseContent && mode !== 'media') {
      return null
    }
    if (mode === 'media' && !file) {
      return null
    }

    if (file) {
      const formData = new FormData()
      if (baseContent) formData.append('content', baseContent)
      formData.append('type', mode)
      formData.append('visibility', 'public')
      formData.append('media', file)
      if (link.trim()) formData.append('link', link.trim())
      if (entity?.id) {
        formData.append('entity_type', mode)
        formData.append('entity_id', entity.id)
      }
      return formData
    }

    const payload = {
      content: baseContent,
      type: mode,
      visibility: 'public',
    }
    if (link.trim()) payload.link = link.trim()
    if (entity?.id) {
      payload.entity_type = mode
      payload.entity_id = entity.id
    }
    return JSON.stringify(payload)
  }, [content, mode, file, link, entity])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      const body = buildRequestBody()
      if (!body) {
        push({ title: 'Add details', description: 'Share more context before posting.', intent: 'warning' })
        return
      }
      setSubmitting(true)
      try {
        const response = await apiRequest('/posts', {
          method: 'POST',
          body,
        })
        if (onPublish) {
          onPublish(response?.data || response)
        }
        setContent('')
        setLink('')
        setFile(null)
        setEntity(null)
        setSearchTerm('')
      } catch (error) {
        push({ title: 'Publish failed', description: error.body?.message || error.message, intent: 'danger' })
      } finally {
        setSubmitting(false)
      }
    },
    [buildRequestBody, onPublish, push],
  )

  const quickOptions = useMemo(() => SHARE_MODES, [])

  return (
    <Surface className="feed-composer" elevation="md" padding="lg">
      <header className="feed-composer__header">
        <Avatar
          src={profile?.avatarUrl}
          initials={profile?.initials}
          alt={`${profile?.name || 'Profile'} avatar`}
          size={64}
        />
        <div>
          <strong>{profile?.name || 'Share with your network'}</strong>
          <span>{profile?.headline || 'Publish updates for your connections.'}</span>
        </div>
      </header>
      <div className="feed-composer__toolbar" role="tablist" aria-label="Share type">
        {quickOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={option.key === mode ? 'active' : ''}
            onClick={() => setMode(option.key)}
            aria-pressed={option.key === mode}
          >
            <Icon name={option.icon} size={18} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <form className="feed-composer__form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="feed-composer-content">
          Post content
        </label>
        <textarea
          id="feed-composer-content"
          placeholder="Start a conversation"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={4}
        />
        {mode === 'link' ? (
          <label className="feed-composer__field" htmlFor="feed-composer-link">
            <span>Attach a link</span>
            <input
              id="feed-composer-link"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
          </label>
        ) : null}
        {mode === 'media' ? (
          <label className="feed-composer__field" htmlFor="feed-composer-media">
            <span>Upload media</span>
            <input id="feed-composer-media" type="file" accept="image/*,video/*" onChange={handleFileChange} />
          </label>
        ) : null}
        {currentConfig ? (
          <div className="feed-composer__entity-picker">
            <label htmlFor="feed-composer-entity">Select {currentConfig.label.toLowerCase()}</label>
            <input
              id="feed-composer-entity"
              type="search"
              placeholder={`Search ${currentConfig.label.toLowerCase()}s`}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <ul>
              {searching ? (
                <li className="feed-composer__loading">Searching…</li>
              ) : searchResults.length ? (
                searchResults.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={entity?.id === item.id ? 'active' : ''}
                      onClick={() => handleEntitySelect(item)}
                    >
                      <strong>{item.name}</strong>
                      {item.subtitle ? <span>{item.subtitle}</span> : null}
                    </button>
                  </li>
                ))
              ) : (
                <li className="feed-composer__empty">No matches yet.</li>
              )}
            </ul>
          </div>
        ) : null}
        <footer className="feed-composer__footer">
          <span>{characterHint}</span>
          <Button type="submit" disabled={submitting} icon={<Icon name="share" size={16} />}>
            {submitting ? 'Publishing…' : primaryActionLabel}
          </Button>
        </footer>
      </form>
    </Surface>
  )
}

export default FeedComposer
