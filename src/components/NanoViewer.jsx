import { useEffect } from 'react'

function formatMonth(ym) {
  if (!ym) return ''
  const [year, month] = ym.split('-')
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  return `${months[parseInt(month, 10) - 1] || month} ${year}`
}

function formatDateRange(entry) {
  const start = formatMonth(entry.startDate)
  const end = entry.endDate?.trim()
    ? formatMonth(entry.endDate)
    : 'Ongoing'

  if (!start) return end === 'Ongoing' ? '' : end
  return `${start} – ${end}`
}

function NanoViewer({ entry, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!entry) return null

  const folder = `/content/${entry.section}/${entry.slug}/`

  return (
    <div className="nano-overlay">
      <div className="nano-topbar">
        <span>
          GNU nano — <span className="nano-title">{entry.title}</span>
        </span>

        <button onClick={onClose}>
          ✕ close
        </button>
      </div>

      <div className="nano-body">
        <div className="nano-entry-title">
          {entry.title}
        </div>

        <div className="nano-meta">
          {formatDateRange(entry)}
          &nbsp;&nbsp;·&nbsp;&nbsp;

          {(entry.tags || []).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <div className="nano-description">
          {entry.description}
        </div>

        <hr />

        <div className="nano-content">
          {(entry.blocks || []).map((block, index) => {
            switch (block.type) {
              case 'text':
                return (
                  <div key={index}>
                    <p className="block-text">
                      {block.content || ''}
                    </p>
                    <br />
                  </div>
                )

              case 'image':
                return (
                  <div className="block-image" key={index}>
                    <img
                      src={folder + block.src}
                      alt={block.caption || block.src}
                      loading="lazy"
                    />

                    {block.caption && (
                      <div className="block-caption">
                        {block.caption}
                      </div>
                    )}
                  </div>
                )

              case 'video':
                return (
                  <div className="block-video" key={index}>
                    <video
                      src={folder + block.src}
                      controls
                      preload="metadata"
                    />

                    {block.caption && (
                      <div className="block-caption">
                        {block.caption}
                      </div>
                    )}
                  </div>
                )

              case 'doc':
                return (
                  <a
                    key={index}
                    href={folder + block.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block-doc"
                  >
                    <span className="block-doc-icon">📄</span>
                    <span className="block-doc-name">
                      {block.src}
                    </span>
                    <span className="block-doc-caption">
                      {block.caption || 'open'}
                    </span>
                  </a>
                )

              default:
                return null
            }
          })}
        </div>
      </div>

      <div className="nano-botbar">
        <span>
          <span className="nano-key">ESC</span>&nbsp;Close
        </span>
      </div>
    </div>
  )
}

export default NanoViewer