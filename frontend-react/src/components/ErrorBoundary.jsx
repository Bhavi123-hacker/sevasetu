import React from 'react'
import { Icon } from './Icon'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('SevaSetu ErrorBoundary caught an exception:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px 20px', maxWidth: 640, margin: '40px auto', textAlign: 'center' }}>
          <div className="card" style={{ padding: 32, border: '1px solid var(--color-danger-solid, #ef4444)' }}>
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Icon name="alert-triangle" size={26} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-ink)' }}>
              Something went wrong loading this section
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 20 }}>
              An unexpected display issue occurred. Your application data and server state are safe.
            </p>
            {this.state.error && (
              <div style={{ background: 'var(--color-bg-subtle)', padding: 12, borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#dc2626', marginBottom: 20, textAlign: 'left', wordBreak: 'break-all' }}>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { window.location.href = '/' }}
              >
                Go to Home
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
