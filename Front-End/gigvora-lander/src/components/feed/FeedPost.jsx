import { useMemo } from 'react'
import Surface from '../primitives/Surface'
import Button from '../primitives/Button'
import Icon from '../primitives/Icon'
import { Avatar } from '../primitives/Avatar'
import CommentThread from './CommentThread'
import './FeedPost.css'

const REACTIONS = [
  { key: 'like', label: 'Like', icon: 'like' },
  { key: 'celebrate', label: 'Celebrate', icon: 'celebrate' },
  { key: 'support', label: 'Support', icon: 'support' },
  { key: 'insightful', label: 'Insightful', icon: 'insight' },
  { key: 'love', label: 'Love', icon: 'heart' },
]

const numberFormatter = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })

function FeedPost({
  post,
  onReact,
  onSave,
  onShare,
  onReport,
  onToggleComments,
  showComments,
  onCommentAdded,
}) {
  const stats = post.stats || {}
  const viewer = post.viewer || {}

  const reactionButtons = useMemo(
    () =>
      REACTIONS.map((reaction) => ({
        ...reaction,
        active: viewer.reaction === reaction.key,
      })),
    [viewer.reaction],
  )

  const handleReaction = (type) => {
    onReact?.(post.id, type, viewer.reaction)
  }

  const handleSave = () => {
    onSave?.(post.id, viewer.saved)
  }

  const handleShare = () => {
    onShare?.(post.id)
  }

  const handleReport = () => {
    onReport?.(post.id)
  }

  const commentCountLabel = stats.comments ? `${numberFormatter.format(stats.comments)} comments` : 'Comments'

  return (
    <Surface className="feed-post" elevation="md" padding="lg">
      <header className="feed-post__header">
        <Avatar
          src={post.author?.avatarUrl}
          initials={post.author?.initials}
          alt={`${post.author?.name || 'Author'} avatar`}
          size={56}
        />
        <div>
          <div className="feed-post__author">
            <strong>{post.author?.name}</strong>
            {post.author?.headline ? <span>{post.author.headline}</span> : null}
          </div>
          <div className="feed-post__meta">
            <time>{post.timestamp}</time>
            {post.author?.location ? <span>{post.author.location}</span> : null}
            <span className={`feed-post__visibility feed-post__visibility--${post.visibility}`}>
              {post.visibility}
            </span>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={handleReport}>
          Report
        </Button>
      </header>
      {post.headline ? <h3 className="feed-post__headline">{post.headline}</h3> : null}
      {post.content ? <p className="feed-post__content">{post.content}</p> : null}
      {post.link ? (
        <a className="feed-post__link" href={post.link} target="_blank" rel="noreferrer">
          {post.link}
        </a>
      ) : null}
      {post.media?.length ? (
        <div className="feed-post__media">
          {post.media.map((item) =>
            item.type === 'video' ? (
              <video key={item.id} controls poster={item.preview || undefined}>
                <source src={item.url} />
                Your browser does not support embedded video.
              </video>
            ) : (
              <img key={item.id} src={item.url} alt={item.alt || post.headline || 'Post media'} />
            ),
          )}
        </div>
      ) : null}
      {post.entityShare ? (
        <div className="feed-post__entity">
          <div>
            <span>{post.entityShare.type}</span>
            <strong>{post.entityShare.title}</strong>
            {post.entityShare.subtitle ? <em>{post.entityShare.subtitle}</em> : null}
            {post.entityShare.description ? <p>{post.entityShare.description}</p> : null}
          </div>
          {post.entityShare.url ? (
            <a className="feed-post__entity-link" href={post.entityShare.url} target="_blank" rel="noreferrer">
              View
            </a>
          ) : null}
        </div>
      ) : null}
      {post.tags?.length || post.topics?.length ? (
        <div className="feed-post__tags">
          {[...(post.tags || []), ...(post.topics || [])].map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      ) : null}
      <footer className="feed-post__footer">
        <div className="feed-post__stats">
          <span>
            <Icon name="like" size={16} />
            {numberFormatter.format(stats.reactions || 0)}
          </span>
          <span>{numberFormatter.format(stats.shares || 0)} shares</span>
          <span>{numberFormatter.format(stats.saves || 0)} saves</span>
        </div>
        <div className="feed-post__actions">
          <div className="feed-post__reactions" role="group" aria-label="Reactions">
            {reactionButtons.map((reaction) => (
              <button
                key={reaction.key}
                type="button"
                className={reaction.active ? 'active' : ''}
                onClick={() => handleReaction(reaction.key)}
              >
                <Icon name={reaction.icon} size={18} />
                <span>{reaction.label}</span>
              </button>
            ))}
          </div>
          <div className="feed-post__shortcuts">
            <Button variant="ghost" size="sm" onClick={handleShare} icon={<Icon name="share" size={16} />}>
              Share
            </Button>
            <Button
              variant={viewer.saved ? 'outline' : 'ghost'}
              size="sm"
              onClick={handleSave}
              icon={<Icon name="bookmark" size={16} />}
            >
              {viewer.saved ? 'Saved' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleComments}>
              {commentCountLabel}
            </Button>
          </div>
        </div>
      </footer>
      {showComments ? <CommentThread postId={post.id} onCommentAdded={onCommentAdded} /> : null}
    </Surface>
  )
}

export default FeedPost
