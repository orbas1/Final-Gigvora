import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../utils/apiClient'
import { extractNextCursor, normaliseComment, unwrapList } from '../utils/feedTransforms'

const PAGE_SIZE = 20

export function useCommentThread(postId, { autoLoad = false } = {}) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const cursorRef = useRef(null)

  const applyPage = useCallback((records, nextCursor, { reset = false } = {}) => {
    setComments((current) => {
      if (reset) {
        return records
      }
      const map = new Map(current.map((item) => [item.id, item]))
      records.forEach((item) => {
        if (item?.id) {
          map.set(item.id, { ...map.get(item.id), ...item })
        }
      })
      return Array.from(map.values())
    })
    cursorRef.current = nextCursor
    setHasMore(Boolean(nextCursor) || records.length === PAGE_SIZE)
  }, [])

  const fetchPage = useCallback(
    async ({ reset = false } = {}) => {
      if (!postId) return
      setError(null)
      if (reset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
        const cursorValue = reset ? null : cursorRef.current
        if (cursorValue) {
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
        }
        const response = await apiRequest(`/posts/${postId}/comments?${params.toString()}`)
        const records = unwrapList(response?.data || response)
          .map(normaliseComment)
          .filter(Boolean)
        const nextCursor = extractNextCursor(response)
        applyPage(records, nextCursor, { reset })
      } catch (fetchError) {
        setError(fetchError)
      } finally {
        if (reset) {
          setLoading(false)
        } else {
          setLoadingMore(false)
        }
      }
    },
    [postId, applyPage],
  )

  const refresh = useCallback(() => fetchPage({ reset: true }), [fetchPage])

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    fetchPage({ reset: false })
  }, [fetchPage, hasMore, loading, loadingMore])

  const submitComment = useCallback(
    async ({ content, parentId = null }) => {
      if (!postId || !content?.trim()) return null
      const body = { body: content.trim() }
      if (parentId) body.parent_id = parentId
      const response = await apiRequest(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const payload = response?.data || response
      const normalised = normaliseComment(payload)
      if (normalised) {
        setComments((current) => {
          if (parentId) {
            return current.map((item) => {
              if (item.id !== parentId) return item
              return {
                ...item,
                replies: [...item.replies, normalised],
              }
            })
          }
          return [normalised, ...current]
        })
      }
      return normalised
    },
    [postId],
  )

  useEffect(() => {
    if (autoLoad && postId) {
      refresh()
    } else {
      setComments([])
      cursorRef.current = null
      setHasMore(false)
    }
  }, [autoLoad, postId, refresh])

  const value = useMemo(
    () => ({
      comments,
      loading,
      loadingMore,
      error,
      hasMore,
      refresh,
      loadMore,
      submitComment,
    }),
    [comments, loading, loadingMore, error, hasMore, refresh, loadMore, submitComment],
  )

  return value
}

export default useCommentThread
