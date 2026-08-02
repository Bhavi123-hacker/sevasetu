import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'
import { SERVICE_TYPES } from '../config'

function OfficerQueueContent() {
  const { staffUser } = useAuth()
  const [applications, setApplications] = useState([])
  const [error, setError] = useState(null)
  const [serviceFilter, setServiceFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [detailCache, setDetailCache] = useState({})

  const loadApplications = useCallback(async () => {
    try {
      const response = await client.get('/api/applications')
      setApplications(response.data)
    } catch (err) {
      setError('Could not reach SevaSetu\u2019s backend.')
    }
  }, [])

  useEffect(() => { loadApplications() }, [loadApplications])

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!detailCache[id]) {
      const response = await client.get(`/api/applications/${id}`)
      setDetailCache((prev) => ({ ...prev, [id]: response.data }))
    }
  }

  async function handleResolve(id) {
    try {
      await client.post(`/api/applications/${id}/resolve`)
      setDetailCache((prev) => ({ ...prev, [id]: undefined }))
      await loadApplications()
      const response = await client.get(`/api/applications/${id}`)
      setDetailCache((prev) => ({ ...prev, [id]: response.data }))
    } catch (err) {
      setError(err.response?.status === 403
        ? 'Server rejected this \u2014 your token doesn\u2019t have Officer rights for this action.'
        : 'Could not resolve this application.')
    }
  }

  let filtered = applications
  if (serviceFilter !== 'All') {
    filtered = filtered.filter((a) => SERVICE_TYPES[a.service_type]?.label === serviceFilter)
  }
  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    filtered = filtered.filter((a) => a.citizen_name.toLowerCase().includes(term) || a.id.toLowerCase().includes(term))
  }
  if (!showResolved) {
    filtered = filtered.filter((a) => a.status !== 'resolved')
  }

  const cleanCount = filtered.filter((a) => a.readiness_score >= 90).length
  const flaggedCount = filtered.length - cleanCount
  const duplicateCount = filtered.filter((a) => a.duplicate_suspected).length

  return (
    <div>
      <h2>Officer Queue</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>Logged in as {staffUser.name} ({staffUser.role})</p>

      {error && <div className="status-banner danger">{error}</div>}

      <div className="card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
          <label>Filter by service</label>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
            <option>All</option>
            {Object.values(SERVICE_TYPES).map((s) => <option key={s.label}>{s.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <label>Search by citizen name or ID</label>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <label style={{ fontWeight: 400, marginBottom: 8 }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
        </label>
      </div>

      <div className="card" style={{ display: 'flex', gap: 32 }}>
        <div><div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Clean</div><div style={{ fontSize: 22, fontWeight: 600 }}>{cleanCount}</div></div>
        <div><div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Flagged</div><div style={{ fontSize: 22, fontWeight: 600 }}>{flaggedCount}</div></div>
        <div><div style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>Duplicates suspected</div><div style={{ fontSize: 22, fontWeight: 600 }}>{duplicateCount}</div></div>
      </div>

      {filtered.length === 0 && <p style={{ color: 'var(--color-ink-muted)' }}>No applications match the current filters.</p>}

      {filtered.map((app) => {
        const score = app.readiness_score || 0
        const icon = score >= 90 ? '\u2705' : score >= 60 ? '\u26a0\ufe0f' : '\ud83d\uded1'
        const detail = detailCache[app.id]

        return (
          <div className="card" key={app.id}>
            <button
              onClick={() => toggleExpand(app.id)}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', fontSize: 15, padding: 0 }}
            >
              {icon} {app.citizen_name} — {score}% — {SERVICE_TYPES[app.service_type]?.label || app.service_type}
              {app.duplicate_suspected && ' · duplicate suspected'}
            </button>

            {expandedId === app.id && detail && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <p><strong>Application ID:</strong> {detail.id} | <strong>Status:</strong> {detail.status}</p>
                {detail.field_checks.map((check) => (
                  <div className="check-row" key={check.field}>
                    <span className={`check-icon ${check.status}`}>{check.status === 'pass' ? '\u2713' : '\u2717'}</span>
                    {check.field.replace('_', ' ')} — {check.detail}
                  </div>
                ))}
                {detail.missing_documents.length > 0 && (
                  <p><strong>Missing documents:</strong> {detail.missing_documents.map((d) => d.replace('_', ' ')).join(', ')}</p>
                )}
                <p><strong>Estimated delay:</strong> {detail.estimated_delay_days} days</p>
                <p><strong>Recommendation shown to citizen:</strong> {detail.recommendation}</p>
                {detail.status !== 'resolved' ? (
                  staffUser.role === 'Officer' && (
                    <button className="btn" onClick={() => handleResolve(app.id)}>Mark as reviewed / resolved</button>
                  )
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}>
                    Resolved{detail.resolved_by ? ` by ${detail.resolved_by}` : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function OfficerQueue() {
  return (
    <StaffGate>
      <OfficerQueueContent />
    </StaffGate>
  )
}
