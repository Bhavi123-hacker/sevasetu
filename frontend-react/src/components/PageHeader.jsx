import React from 'react'
import { Icon } from './Icon'

/**
 * Standardized PageHeader Component for SevaSetu.
 * Provides unified, pitch-ready header styling across all pages.
 */
export default function PageHeader({
  badge,
  badgeIcon = 'shield',
  title,
  subtitle,
  actions = null,
  breadcrumbs = null,
  className = '',
}) {
  return (
    <div className={`page-header-card ${className}`}>
      {breadcrumbs && (
        <div className="page-header-breadcrumbs">
          {breadcrumbs}
        </div>
      )}
      <div className="page-header-body">
        <div className="page-header-main">
          {badge && (
            <div className="page-header-badge">
              <Icon name={badgeIcon} size={12} className="page-header-badge-icon" />
              <span>{badge}</span>
            </div>
          )}
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </div>
  )
}
