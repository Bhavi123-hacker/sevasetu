import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CITIZEN_NAV = [
  { to: '/', label: 'Apply for Service', icon: '📝' },
  { to: '/status', label: 'Track Application', icon: '🔍' },
  { to: '/ask', label: 'Regulation Assistant', icon: '📖' },
  { to: '/feedback', label: 'Citizen Feedback', icon: '💬' },
]

const STAFF_NAV = [
  { to: '/officer-queue', label: 'Officer Queue', icon: '📋' },
  { to: '/officer-dashboard', label: 'Productivity Analytics', icon: '📊' },
  { to: '/admin-settings', label: 'Admin Settings', icon: '⚙️' },
  { to: '/manage-staff', label: 'Manage Staff', icon: '👥' },
]

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('sevasetu_theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sevasetu_theme', theme)
  }, [theme])

  return [theme, setTheme]
}

export default function Layout({ children }) {
  const [theme, setTheme] = useTheme()
  const { staffUser, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Official Civic Banner */}
      <header className="civic-topbar">
        <div className="civic-topbar-flag">
          <span style={{ fontSize: 14 }}>🏛️</span>
          <span>Digital Public Service Portal • Official Pre-Verification System</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="civic-topbar-badge">Secure AI-Assisted OCR</span>
          <span style={{ color: '#64748b' }}>v0.2.0</span>
        </div>
      </header>

      <div className="app-shell">
        <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
            <div className="sidebar-logo-icon">SS</div>
            <div className="sidebar-brand-text">
              <h1>SevaSetu</h1>
              <span>Public Service Bridge</span>
            </div>
          </div>

          <div className="sidebar-nav-section">Citizen Services</div>
          <nav>
            {CITIZEN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
                end={item.to === '/'}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-nav-section">Staff & Administration</div>
          <nav>
            {STAFF_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--color-ink)',
                }}
              >
                {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
              </button>
            </div>

            {staffUser && (
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-info" style={{ fontSize: 11 }}>{staffUser.role}</span>
                <button
                  onClick={logout}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-danger-solid)',
                    cursor: 'pointer', fontSize: 11, display: 'block', marginTop: 2, padding: 0,
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="main-content">
          {children}

          <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-ink-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>🏛️ SevaSetu Civic Services & Document Pre-Verification Platform</p>
            <p style={{ margin: 0, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
              <strong>Notice:</strong> Automated OCR and consistency checks provide algorithmic pre-verification metrics. All statutory legal decisions (approval, correction request, rejection) remain strictly under the authority of designated government verification officers.
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}
