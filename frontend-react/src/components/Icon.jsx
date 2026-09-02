import React from 'react'

/**
 * SevaSetu Unified Icon System
 * Standardized SVG icon components with strict bounding dimensions.
 * Sizing Tokens:
 *  - 'xs': 14px (fine inline indicators)
 *  - 'sm': 16px (inline metadata, tables, status indicators)
 *  - 'md': 18px (buttons, sidebar navigation)
 *  - 'lg': 20px (cards, form inputs, primary actions)
 *  - 'xl': 24px (section headers, modal titles)
 *  - '2xl': 32px (empty state cards, modal headers)
 *  - 'hero': 40px (hero decorative elements max)
 */

const SIZES = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 32,
  hero: 40,
}

export function Icon({
  name,
  size = 'md',
  className = '',
  color = 'currentColor',
  strokeWidth = 2,
  ariaLabel,
  ...props
}) {
  const pixelSize = typeof size === 'number' ? size : SIZES[size] || 18

  const renderPath = () => {
    switch (name) {
      case 'paperclip':
      case 'attachment':
        return (
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        )

      case 'file':
      case 'file-text':
      case 'document':
        return (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </>
        )

      case 'shield':
      case 'security':
        return (
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        )

      case 'shield-check':
        return (
          <>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </>
        )

      case 'check-circle':
      case 'success':
        return (
          <>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </>
        )

      case 'check':
        return <polyline points="20 6 9 17 4 12" />

      case 'alert-circle':
      case 'error':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </>
        )

      case 'alert-triangle':
      case 'warning':
        return (
          <>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        )

      case 'info':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </>
        )

      case 'clock':
      case 'time':
      case 'sla':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </>
        )

      case 'user':
      case 'citizen':
        return (
          <>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </>
        )

      case 'users':
      case 'staff':
        return (
          <>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </>
        )

      case 'lock':
        return (
          <>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </>
        )

      case 'search':
        return (
          <>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </>
        )

      case 'filter':
        return <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />

      case 'refresh':
      case 'refresh-cw':
        return (
          <>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </>
        )

      case 'download':
        return (
          <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </>
        )

      case 'upload':
        return (
          <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </>
        )

      case 'eye':
        return (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )

      case 'message':
      case 'message-square':
      case 'grievance':
        return (
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        )

      case 'messages':
        return (
          <>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </>
        )

      case 'star':
        return (
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        )

      case 'chevron-down':
        return <polyline points="6 9 12 15 18 9" />

      case 'chevron-up':
        return <polyline points="18 15 12 9 6 15" />

      case 'chevron-right':
        return <polyline points="9 18 15 12 9 6" />

      case 'chevron-left':
        return <polyline points="15 18 9 12 15 6" />

      case 'arrow-left':
        return (
          <>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </>
        )

      case 'arrow-right':
        return (
          <>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </>
        )

      case 'external-link':
        return (
          <>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </>
        )

      case 'sliders':
      case 'settings':
        return (
          <>
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </>
        )

      case 'activity':
      case 'metrics':
      case 'chart':
        return (
          <>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </>
        )

      case 'building':
      case 'institution':
      case 'government':
        return (
          <>
            <line x1="3" y1="21" x2="21" y2="21" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <polyline points="12 3 2 10 22 10" />
            <line x1="6" y1="10" x2="6" y2="21" />
            <line x1="10" y1="10" x2="10" y2="21" />
            <line x1="14" y1="10" x2="14" y2="21" />
            <line x1="18" y1="10" x2="18" y2="21" />
          </>
        )

      case 'bell':
      case 'notification':
        return (
          <>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </>
        )

      case 'inbox':
      case 'queue':
        return (
          <>
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </>
        )

      case 'help':
      case 'help-circle':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        )

      case 'camera':
      case 'video':
        return (
          <>
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </>
        )

      case 'mic':
      case 'audio':
        return (
          <>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </>
        )

      case 'send':
        return (
          <>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </>
        )

      case 'sparkles':
      case 'ai':
        return (
          <>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </>
        )

      case 'trash':
        return (
          <>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </>
        )

      case 'x':
      case 'close':
        return (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        )

      case 'sun':
        return (
          <>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </>
        )

      case 'moon':
        return <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />

      default:
        return <circle cx="12" cy="12" r="10" />
    }
  }

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`Icon Icon--${size} inline-block shrink-0 align-middle ${className}`}
      style={{
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
        maxWidth: `${pixelSize}px`,
        maxHeight: `${pixelSize}px`,
        flexShrink: 0,
      }}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      {...props}
    >
      {renderPath()}
    </svg>
  )
}

// Reusable Empty State Card with controlled icon dimensions
export function EmptyState({
  icon = 'inbox',
  title = 'No items found',
  description = 'There are no records to display at this time.',
  action,
  className = '',
}) {
  return (
    <div className={`card p-8 sm:p-12 text-center max-w-md mx-auto my-6 space-y-4 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto shadow-inner">
        <Icon name={icon} size={28} />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

// Reusable Error State Card with controlled icon dimensions and technical error collapse
export function ErrorState({
  title = 'Something went wrong',
  description = 'We encountered an error while processing your request.',
  errorDetails,
  onRetry,
  className = '',
}) {
  const [showDetails, setShowDetails] = React.useState(false)

  return (
    <div className={`card p-6 sm:p-8 text-center max-w-lg mx-auto my-6 border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 space-y-4 ${className}`}>
      <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
        <Icon name="alert-circle" size={22} />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-red-900 dark:text-red-300">{title}</h3>
        <p className="text-xs sm:text-sm text-red-700/80 dark:text-red-400 leading-relaxed">{description}</p>
      </div>

      {errorDetails && (
        <div className="text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 mx-auto"
          >
            <span>{showDetails ? 'Hide Details' : 'Show Error Details'}</span>
            <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={12} />
          </button>
          {showDetails && (
            <pre className="mt-2 p-3 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl text-[11px] font-mono text-red-800 dark:text-red-300 overflow-x-auto whitespace-pre-wrap max-h-40">
              {typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}
            </pre>
          )}
        </div>
      )}

      {onRetry && (
        <div className="pt-2">
          <button type="button" onClick={onRetry} className="btn btn-sm btn-secondary">
            <Icon name="refresh" size={14} />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </div>
  )
}

// Reusable Document / Evidence Card
export function DocumentCard({
  filename,
  fileUrl,
  sizeFormatted,
  mimeType,
  isDownload = false,
  className = '',
}) {
  return (
    <div className={`flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 transition ${className}`}>
      <div className="flex items-center space-x-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0">
          <Icon name="file-text" size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{filename || 'Evidence Document'}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            {mimeType ? `${mimeType} • ` : ''}{sizeFormatted || 'Attached Evidence'}
          </div>
        </div>
      </div>
      {fileUrl && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          download={isDownload}
          className="btn btn-sm btn-secondary shrink-0 text-xs"
        >
          <Icon name={isDownload ? 'download' : 'external-link'} size={14} />
          <span>{isDownload ? 'Download' : 'View'}</span>
        </a>
      )}
    </div>
  )
}

export default Icon
