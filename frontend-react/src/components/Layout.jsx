import { useState, useEffect } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { auth } from '../firebase'
import CitizenAuthModal from './CitizenAuthModal'
import { Icon } from './Icon'

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
  const { activeRole, staffUser, logout, citizenUser, logoutCitizen } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showCitizenAuth, setShowCitizenAuth] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

  const isStaff = activeRole === 'staff' && staffUser != null
  const isCitizen = activeRole === 'citizen' && citizenUser != null
  const isEmailVerified = Boolean(citizenUser?.email_verified || auth?.currentUser?.emailVerified)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const refreshUnreadCount = () => {
    if (isCitizen) {
      import('../api/client').then(({ api }) => {
        const profileId = citizenUser?.profile_id || citizenUser?.id
        api.getUnreadNotificationCount('citizen', profileId)
          .then((res) => setUnreadCount(res.data?.unread_count || 0))
          .catch(() => setUnreadCount(0))
      })
    } else if (isStaff) {
      import('../api/client').then(({ api }) => {
        api.getUnreadNotificationCount('staff', null)
          .then((res) => setUnreadCount(res.data?.unread_count || 0))
          .catch(() => setUnreadCount(0))
      })
    } else {
      setUnreadCount(0)
    }
  }

  useEffect(() => {
    refreshUnreadCount()
    window.addEventListener('sevasetu_notifications_updated', refreshUnreadCount)
    return () => window.removeEventListener('sevasetu_notifications_updated', refreshUnreadCount)
  }, [isCitizen, isStaff, citizenUser?.id, citizenUser?.profile_id, location.pathname])

  // Navigation Data - Citizen Services
  const CITIZEN_SERVICES = [
    { to: '/', label: 'Home', icon: 'building', exact: true },
    { to: '/apply-wizard', label: 'Start Application', icon: 'file-text' },
    { to: '/eligibility', label: 'Requirements Advisor', icon: 'check-circle' },
    { to: '/status', label: 'Track Status', icon: 'search' },
    { to: '/grievances', label: 'Grievance Redressal', icon: 'message' },
    { to: '/notifications', label: 'Notifications', icon: 'bell', badge: unreadCount },
    { to: '/profile', label: 'My Profile', icon: 'user' },
  ]

  const CITIZEN_INFO = [
    { to: '/about', label: 'About & Platform', icon: 'info' },
    { to: '/impact', label: 'Impact Telemetry', icon: 'activity' },
    { to: '/privacy', label: 'Privacy & Data', icon: 'shield' },
    { to: '/ask', label: 'Citizen Assistant', icon: 'help-circle' },
    { to: '/feedback', label: 'Citizen Feedback', icon: 'star' },
  ]

  // Navigation Data - Staff Operations
  const STAFF_OPERATIONS = [
    { to: '/officer-queue', label: 'Officer Queue', icon: 'inbox' },
    { to: '/officer-grievance-queue', label: 'Grievance Queue', icon: 'message' },
    { to: '/command-center', label: 'Command Center', icon: 'sliders' },
    { to: '/operations', label: 'System Operations', icon: 'activity' },
    { to: '/status', label: 'Audit Trail', icon: 'search' },
  ]

  const STAFF_ADMIN = staffUser?.role === 'Administrator' ? [
    { to: '/admin-settings', label: 'Admin Settings', icon: 'sliders' },
    { to: '/manage-staff', label: 'Manage Staff', icon: 'users' },
  ] : []

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-ink)] antialiased">
      {/* 1. Global Compact Desktop/Mobile Header (66px height) */}
      <header className="global-header sticky top-0 z-40 w-full border-b border-[var(--color-border)] bg-[var(--color-surface)] transition-colors duration-200">
        <div className="header-inner max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-[66px] gap-2 sm:gap-3">
          
          {/* Left: Mobile Toggle & Brand Identity */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              className="lg:hidden p-2 -ml-2 rounded-xl text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] transition-colors"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation drawer"
            >
              <Icon name="sliders" size={20} />
            </button>

            <Link to="/" className="brand-block flex items-center gap-2 sm:gap-2.5 group no-underline shrink-0">
              <div className="brand-logo-badge w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black text-xs sm:text-sm tracking-tight shadow-sm shrink-0">
                SS
              </div>
              <div className="brand-text flex flex-col justify-center">
                <span className="brand-title font-extrabold text-[15px] sm:text-[16px] leading-tight tracking-tight text-[var(--color-ink)] group-hover:text-[var(--color-primary)] transition-colors whitespace-nowrap">
                  SevaSetu
                </span>
                <span className="brand-subtitle text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase text-[var(--color-ink-muted)] mt-0.5 whitespace-nowrap hidden sm:inline">
                  Civic Document Services
                </span>
              </div>
            </Link>
          </div>

          {/* Center Context / Pill (Desktop Optional Context) */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-[var(--color-ink-muted)] bg-[var(--color-surface-muted)] px-3.5 py-1.5 rounded-full border border-[var(--color-border-subtle)] shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate max-w-[280px]">
              {isStaff ? `Officer Workspace • ${staffUser?.role}` : isCitizen ? `Citizen Portal • Verified Session` : `Civic Document Pre-Verification`}
            </span>
          </div>

          {/* Right Controls: Language, Theme, Auth */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            
            {/* Language Selector */}
            <div className="relative inline-flex items-center">
              <div className="h-9 px-2.5 flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-ink)] shadow-xs hover:border-[var(--color-primary)] transition-all">
                <select
                  aria-label="Select Interface Language"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[var(--color-ink)] focus:outline-none cursor-pointer pr-1"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                  <option value="ta">தமிழ்</option>
                </select>
              </div>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="h-9 w-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-primary)] flex items-center justify-center shadow-xs transition-all shrink-0"
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
            </button>

            {/* Authenticated Citizen Experience */}
            {isCitizen ? (
              <div className="flex items-center gap-2">
                {/* Notification Bell */}
                <Link
                  to="/notifications"
                  title="Notifications"
                  className="relative h-9 w-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-primary)] flex items-center justify-center shadow-xs transition-all"
                >
                  <Icon name="bell" size={15} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-extrabold h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center ring-2 ring-[var(--color-surface)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* User Pill with Status */}
                <div className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs">
                  <Icon name="user" size={13} className="text-[var(--color-primary)]" />
                  <span className="font-bold text-[var(--color-ink)] truncate max-w-[120px]">
                    {citizenUser.citizen_name || citizenUser.name || 'Citizen'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isEmailVerified
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {isEmailVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={() => {
                    logoutCitizen()
                    navigate('/')
                  }}
                  className="h-9 px-3 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold transition-all"
                >
                  Sign Out
                </button>
              </div>
            ) : isStaff ? (
              /* Authenticated Staff Experience */
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 text-xs">
                  <Icon name="shield" size={13} className="text-teal-700 dark:text-teal-400" />
                  <span className="font-extrabold text-teal-950 dark:text-teal-200 truncate max-w-[130px]">
                    {staffUser.name || staffUser.username}
                  </span>
                  <span className="badge badge-neutral text-[10px] font-bold">
                    {staffUser.role}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/')
                  }}
                  className="h-9 px-3 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold transition-all"
                >
                  Staff Logout
                </button>
              </div>
            ) : (
              /* Public / Unauthenticated Header Buttons */
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCitizenAuth(true)}
                  className="btn btn-primary btn-sm h-9 px-3.5 text-xs font-bold shadow-xs"
                >
                  <Icon name="user" size={13} />
                  <span>Sign In / Register</span>
                </button>

                <Link
                  to="/officer-queue"
                  className="hidden sm:inline-flex btn btn-secondary btn-sm h-9 px-3 text-xs font-bold"
                >
                  <Icon name="lock" size={12} />
                  <span>Staff Portal</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main App Shell Layout (Sidebar + Content Workspace) */}
      <div className="app-shell flex-1 flex relative">
        
        {/* Mobile Backdrop Overlay */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Unified Sidebar Navigation (252px Width) */}
        <aside
          className={`sidebar fixed lg:sticky top-[66px] left-0 bottom-0 z-30 w-[252px] bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col justify-between overflow-y-auto transition-transform duration-200 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
          }`}
          style={{ height: 'calc(100vh - 66px)' }}
        >
          <div className="p-4 space-y-6">
            
            {/* Role-Specific Navigation Groups */}
            {isStaff ? (
              <>
                {/* Staff Operations Group */}
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-ink-subtle)]">
                    Staff Operations
                  </div>
                  <nav className="space-y-1">
                    {STAFF_OPERATIONS.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `sidebar-nav-link flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'active-nav-item bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold shadow-xs border-l-4 border-[var(--color-primary)]'
                              : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]'
                          }`
                        }
                      >
                        <Icon name={item.icon} size={16} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </div>

                {/* Administration Group */}
                {STAFF_ADMIN.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-[var(--color-border-subtle)]">
                    <div className="px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-ink-subtle)]">
                      Administration
                    </div>
                    <nav className="space-y-1">
                      {STAFF_ADMIN.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            `sidebar-nav-link flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              isActive
                                ? 'active-nav-item bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold shadow-xs border-l-4 border-[var(--color-primary)]'
                                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]'
                            }`
                          }
                        >
                          <Icon name={item.icon} size={16} />
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </nav>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Citizen Services Group */}
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-ink-subtle)]">
                    Citizen Services
                  </div>
                  <nav className="space-y-1">
                    {CITIZEN_SERVICES.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.exact}
                        className={({ isActive }) =>
                          `sidebar-nav-link flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'active-nav-item bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold shadow-xs border-l-4 border-[var(--color-primary)]'
                              : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]'
                          }`
                        }
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Icon name={item.icon} size={16} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge > 0 && (
                          <span className="bg-[var(--color-primary)] text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </nav>
                </div>

                {/* Information & Redressal Group */}
                <div className="space-y-1 pt-2 border-t border-[var(--color-border-subtle)]">
                  <div className="px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-ink-subtle)]">
                    Information & Support
                  </div>
                  <nav className="space-y-1">
                    {CITIZEN_INFO.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `sidebar-nav-link flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'active-nav-item bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold shadow-xs border-l-4 border-[var(--color-primary)]'
                              : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]'
                          }`
                        }
                      >
                        <Icon name={item.icon} size={16} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </div>
              </>
            )}
          </div>

          {/* Sidebar Bottom Status */}
          <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[11px] text-[var(--color-ink-subtle)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate font-medium">
                {isStaff ? staffUser.role : isCitizen ? citizenUser.citizen_name || 'Citizen Verified' : 'Portal Online'}
              </span>
            </div>
          </div>
        </aside>

        {/* 3. Main Body & Content Canvas */}
        <main className="main-content-wrapper flex-1 flex flex-col min-w-0 bg-[var(--color-bg)]">
          <div className="content-container flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </div>

          {/* 4. Structured Enterprise 4-Column Footer */}
          <footer className="global-footer border-t border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] text-xs transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 pb-8 border-b border-[var(--color-border-subtle)]">
                
                {/* Column 1: Brand & Statutory Mission */}
                <div className="space-y-3 lg:col-span-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
                      SS
                    </div>
                    <span className="font-extrabold text-sm text-[var(--color-ink)] tracking-tight">
                      SevaSetu
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
                    Civic Document Pre-Verification & Decision-Support System for transparent public services.
                  </p>
                  <div className="p-2.5 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border-subtle)] text-[11px] leading-relaxed text-[var(--color-ink-subtle)]">
                    <strong className="text-[var(--color-ink)] block mb-0.5">Statutory Principle:</strong>
                    AI assists verification. Final statutory decisions remain with authorized government officers.
                  </div>
                </div>

                {/* Column 2: Product & Services */}
                <div className="space-y-2.5">
                  <h4 className="text-[11.5px] font-extrabold uppercase tracking-wider text-[var(--color-ink)]">
                    Product & Services
                  </h4>
                  <ul className="space-y-2 text-[12.5px] list-none p-0 m-0">
                    <li>
                      <Link to="/about" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        About Platform & Architecture
                      </Link>
                    </li>
                    <li>
                      <Link to="/apply-wizard" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Start New Application
                      </Link>
                    </li>
                    <li>
                      <Link to="/eligibility" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Requirements Advisor
                      </Link>
                    </li>
                    <li>
                      <Link to="/status" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Application Status Tracker
                      </Link>
                    </li>
                    <li>
                      <Link to="/verify" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Verify Decision Certificate
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Column 3: Support & Redressal */}
                <div className="space-y-2.5">
                  <h4 className="text-[11.5px] font-extrabold uppercase tracking-wider text-[var(--color-ink)]">
                    Support & Redressal
                  </h4>
                  <ul className="space-y-2 text-[12.5px] list-none p-0 m-0">
                    <li>
                      <Link to="/grievances" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Grievance Redressal Portal
                      </Link>
                    </li>
                    <li>
                      <Link to="/ask" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Citizen Assistant (RAG AI)
                      </Link>
                    </li>
                    <li>
                      <Link to="/feedback" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Citizen Feedback & Ratings
                      </Link>
                    </li>
                    <li>
                      <Link to="/impact" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Impact & SLA Telemetry
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Column 4: Governance & Security */}
                <div className="space-y-2.5">
                  <h4 className="text-[11.5px] font-extrabold uppercase tracking-wider text-[var(--color-ink)]">
                    Security & Governance
                  </h4>
                  <ul className="space-y-2 text-[12.5px] list-none p-0 m-0">
                    <li>
                      <Link to="/privacy" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Privacy Policy & Consent
                      </Link>
                    </li>
                    <li>
                      <Link to="/officer-queue" className="hover:text-[var(--color-primary)] transition-colors no-underline block">
                        Staff & Officer Portal
                      </Link>
                    </li>
                    <li>
                      <span className="text-[11.5px] text-[var(--color-ink-subtle)] block">
                        SHA-256 Audit Trail: <strong className="text-emerald-600 dark:text-emerald-400">ACTIVE</strong>
                      </span>
                    </li>
                    <li>
                      <span className="text-[11.5px] text-[var(--color-ink-subtle)] block">
                        Version: <strong className="font-mono text-[var(--color-ink)]">v1.1.0-release</strong>
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Sub-Footer Bar */}
              <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11.5px] text-[var(--color-ink-subtle)]">
                <div>
                  © 2026 SevaSetu Civic Document Platform • Government Digital Service Standards
                </div>
                <div className="flex items-center gap-4">
                  <Link to="/privacy" className="hover:text-[var(--color-primary)] transition-colors">
                    Privacy Policy
                  </Link>
                  <span>•</span>
                  <Link to="/about" className="hover:text-[var(--color-primary)] transition-colors">
                    Documentation
                  </Link>
                  <span>•</span>
                  <span className="font-mono">SSL / TLS 1.3</span>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* 5. Citizen Authentication Modal */}
      {showCitizenAuth && (
        <CitizenAuthModal
          isOpen={showCitizenAuth}
          onClose={() => setShowCitizenAuth(false)}
          onSuccess={() => {
            setShowCitizenAuth(false)
          }}
        />
      )}
    </div>
  )
}
