import './FeedFilters.css'

function FeedFilters({ value, options, onChange, disabled }) {
  return (
    <div className="feed-filters" role="tablist" aria-label="Feed filters">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={option.key === value ? 'active' : ''}
          aria-pressed={option.key === value}
          onClick={() => onChange(option.key)}
          disabled={disabled && option.key !== value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default FeedFilters
