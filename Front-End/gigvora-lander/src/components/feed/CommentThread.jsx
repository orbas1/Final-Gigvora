import { useCallback, useState } from 'react'
import Button from '../primitives/Button'
import Icon from '../primitives/Icon'
import { Avatar } from '../primitives/Avatar'
import { useToasts } from '../feedback/Toaster'
import { useCommentThread } from '../../hooks/useCommentThread'
import './CommentThread.css'

function CommentItem({ comment, onReply, replyingTo, onSubmitReply }) {
  const [replyValue, setReplyValue] = useState('')

  const handleReply = (event) => {
    event.preventDefault()
    if (!replyValue.trim()) return
    onSubmitReply(comment.id, replyValue)
    setReplyValue('')
  }

  return (
    <article className="comment-item">
      <Avatar
        src={comment.author?.avatarUrl}
        initials={comment.author?.initials}
        alt={`${comment.author?.name || 'Comment'} avatar`}
        size={40}
      />
      <div className="comment-item__body">
        <header>
          <strong>{comment.author?.name}</strong>
          <span>{comment.timestamp}</span>
        </header>
        <p>{comment.content}</p>
        <footer>
          <button type="button" onClick={() => onReply(comment.id)}>
            Reply
          </button>
        </footer>
        {replyingTo === comment.id ? (
          <form className="comment-item__reply" onSubmit={handleReply}>
            <label className="visually-hidden" htmlFor={`reply-${comment.id}`}>
              Reply
            </label>
            <textarea
              id={`reply-${comment.id}`}
              value={replyValue}
              onChange={(event) => setReplyValue(event.target.value)}
              rows={2}
              placeholder="Write a reply"
            />
            <Button size="sm" type="submit">
              Send
            </Button>
          </form>
        ) : null}
        {comment.replies?.length ? (
          <div className="comment-item__replies">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onReply={onReply}
                replyingTo={replyingTo}
                onSubmitReply={onSubmitReply}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function CommentThread({ postId, onCommentAdded }) {
  const { push } = useToasts()
  const { comments, loading, loadingMore, error, hasMore, loadMore, submitComment } = useCommentThread(postId, {
    autoLoad: true,
  })
  const [replyingTo, setReplyingTo] = useState(null)

  const handleCommentSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      const form = event.target
      const value = form.comment?.value
      if (!value || !value.trim()) {
        push({ title: 'Add a message', description: 'Write a quick note before posting.', intent: 'warning' })
        return
      }
      try {
        await submitComment({ content: value })
        form.reset()
        onCommentAdded?.(postId, 1)
      } catch (submitError) {
        push({ title: 'Unable to comment', description: submitError.body?.message || submitError.message, intent: 'danger' })
      }
    },
    [submitComment, onCommentAdded, postId, push],
  )

  const handleReplySubmit = useCallback(
    async (parentId, value) => {
      try {
        await submitComment({ content: value, parentId })
        setReplyingTo(null)
        onCommentAdded?.(postId, 1)
      } catch (submitError) {
        push({ title: 'Reply failed', description: submitError.body?.message || submitError.message, intent: 'danger' })
      }
    },
    [submitComment, onCommentAdded, postId, push],
  )

  return (
    <section className="comment-thread" aria-label="Comments">
      <header className="comment-thread__header">
        <h4>Conversation</h4>
        <button type="button" onClick={loadMore} disabled={!hasMore || loadingMore}>
          {loadingMore ? 'Loading…' : hasMore ? 'Load more' : 'All caught up'}
        </button>
      </header>
      {error ? <p className="comment-thread__error">{error.body?.message || error.message}</p> : null}
      <div className="comment-thread__list">
        {loading && !comments.length ? (
          <div className="comment-thread__loading">
            <span className="skeleton skeleton--avatar" />
            <span className="skeleton skeleton--text" />
            <span className="skeleton skeleton--text" />
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={setReplyingTo}
              replyingTo={replyingTo}
              onSubmitReply={handleReplySubmit}
            />
          ))
        )}
      </div>
      <form className="comment-thread__composer" onSubmit={handleCommentSubmit}>
        <label className="visually-hidden" htmlFor={`comment-${postId}`}>
          Comment
        </label>
        <textarea id={`comment-${postId}`} name="comment" rows={3} placeholder="Add a comment" />
        <Button type="submit" icon={<Icon name="send" size={16} />}>
          Send
        </Button>
      </form>
    </section>
  )
}

export default CommentThread
