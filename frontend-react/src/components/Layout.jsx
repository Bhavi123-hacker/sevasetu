import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Apply' },
  { to: '/status', label: 'Check Status' },
  { to: '/ask', label: 'Ask a Question' },
  { to: '/feedback', label: 'Feedback' },
  { to: '/officer-queue', label: 'Officer Queue' },
  { to: '/officer-dashboard', label: 'Officer Dashboard' },
  { to: '/admin-settings', label: 'Admin Settings' },
  { to: '/manage-staff', label: 'Manage Staff' },
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>SevaSetu</h1>
          <button
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            style={{
              background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
              width: 32, height: 32, cursor: 'pointer', fontSize: 15, color: 'var(--color-ink)',
            }}
          >
            {theme === 'light' ? '\u{1F319}' : '\u2600\uFE0F'}
          </button>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  )
}
