import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../utils/apiClient'
import { extractNextCursor, normaliseFeedItem, unwrapList } from '../utils/feedTransforms'

const PAGE_SIZE = 12

export function useFeedStream({
  filter,
  role,
  initialItems = [],
  initialCursor = null,
} = {}) {
  const [items, setItems] = useState(() => initialItems.filter(Boolean))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(Boolean(initialCursor))
  const cursorRef = useRef(initialCursor)
  const abortRef = useRef(null)

  const updateItems = useCallback((updater) => {
    setItems((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      return Array.isArray(next) ? next : current
    })
  }, [])

  const applyPage = useCallback((pageItems, nextCursor, { reset = false } = {}) => {
    setItems((current) => {
      const base = reset ? [] : current
      const map = new Map(base.map((item) => [item.id, item]))
      pageItems.forEach((item) => {
        if (item?.id) {
          map.set(item.id, { ...map.get(item.id), ...item })
        }
      })
      return Array.from(map.values())
    })
    cursorRef.current = nextCursor
    setHasMore(Boolean(nextCursor) || pageItems.length === PAGE_SIZE)
  }, [])

  const buildParams = useCallback(
    (cursorValue) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), expand: 'author,media' })
      if (filter && filter !== 'all') params.append('scope', filter)
      if (role && role !== 'user') params.append('role', role)
      if (!cursorValue) return params
      if (typeof cursorValue === 'string') {
        params.append('cursor', cursorValue)
      } else if (cursorValue.cursor) {
        params.append('cursor', cursorValue.cursor)
      } else if (cursorValue.token) {
        params.append('cursor', cursorValue.token)
      } else if (cursorValue.offset !== undefined) {
        params.append('offset', String(cursorValue.offset))
      } else if (cursorValue.page) {
        params.append('page', String(cursorValue.page))
      }
      return params
    },
    [filter, role],
  )

  const fetchPage = useCallback(
    async ({ reset = false } = {}) => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller
      setError(null)
      if (reset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const params = buildParams(reset ? null : cursorRef.current)
        const response = await apiRequest(`/posts?${params.toString()}`, { signal: controller.signal })
        const pageItems = unwrapList(response?.data || response)
          .map(normaliseFeedItem)
          .filter(Boolean)
        const nextCursor = extractNextCursor(response)
        applyPage(pageItems, nextCursor, { reset })
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          return
        }
        setError(fetchError)
      } finally {
        if (reset) {
          setLoading(false)
        } else {
          setLoadingMore(false)
        }
      }
    },
    [applyPage, buildParams],
  )

  const refresh = useCallback(async () => {
    await fetchPage({ reset: true })
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    fetchPage({ reset: false })
  }, [fetchPage, hasMore, loading, loadingMore])

  const updateItem = useCallback((postId, updater) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== postId) return item
        const next = typeof updater === 'function' ? updater(item) : { ...item, ...updater }
        return next
      }),
    )
  }, [])

  const prependItem = useCallback((item) => {
    if (!item?.id) return
    setItems((current) => {
      const filtered = current.filter((existing) => existing.id !== item.id)
      return [item, ...filtered]
    })
  }, [])

  useEffect(() => {
    updateItems(initialItems.filter(Boolean))
    cursorRef.current = initialCursor
    setHasMore(Boolean(initialCursor))
  }, [initialCursor, initialItems, updateItems])

  useEffect(() => {
    setItems([])
    cursorRef.current = null
    setHasMore(true)
    fetchPage({ reset: true })
  }, [filter, role, fetchPage])

  useEffect(() => () => abortRef.current?.abort(), [])

  const state = useMemo(
    () => ({
      items,
      error,
      loading,
      loadingMore,
      hasMore,
      loadMore,
      refresh,
      updateItem,
      prependItem,
    }),
    [items, error, loading, loadingMore, hasMore, loadMore, refresh, updateItem, prependItem],
  )

  return state
}

export default useFeedStream
