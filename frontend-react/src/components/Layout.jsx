import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Apply' },
  { to: '/status', label: 'Check Status' },
  { to: '/ask', label: 'Ask a Question' },
  { to: '/feedback', label: 'Feedback' },
  { to: '/staff', label: 'Officer / Admin' },
]

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>SevaSetu</h1>
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
