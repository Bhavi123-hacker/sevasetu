import { useState, useEffect } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'
import { DOCUMENT_TYPE_LABELS, DEFAULT_SERVICE_CATALOG } from '../config'

const ALL_KNOWN_DOCS = Object.keys(DOCUMENT_TYPE_LABELS)

function AdminSettingsContent() {
  const { staffUser } = useAuth()
  const [services, setServices] = useState(DEFAULT_SERVICE_CATALOG)
  const [selections, setSelections] = useState({})
  const [error, setError] = useState(null)
  const [savedMessage, setSavedMessage] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load full admin services and requirements
    Promise.all([
      client.get('/api/admin/services'),
      client.get('/api/service-requirements'),
    ])
      .then(([srvRes, reqRes]) => {
        if (Array.isArray(srvRes.data)) setServices(srvRes.data)
        setSelections(reqRes.data || {})
      })
      .catch(() => {
        setError('Could not reach SevaSetu\u2019s backend. Using local defaults.')
      })
  }, [])

  function toggleDoc(serviceKey, doc) {
    setSelections((prev) => {
      const existing = prev[serviceKey] || []
      const next = existing.includes(doc) ? existing.filter((d) => d !== doc) : [...existing, doc]
      return { ...prev, [serviceKey]: next }
    })
  }

  async function handleToggleActive(serviceId) {
    try {
      const res = await client.patch(`/api/admin/services/${serviceId}/toggle`)
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, is_active: res.data.is_active } : s))
      )
    } catch (err) {
      alert('Could not change service status.')
    }
  }

  async function handleSave(serviceKey) {
    try {
      await client.put(`/api/service-requirements/${serviceKey}`, {
        document_types: selections[serviceKey] || [],
      })
      setSavedMessage((prev) => ({ ...prev, [serviceKey]: 'Saved successfully.' }))
    } catch (err) {
      setSavedMessage((prev) => ({ ...prev, [serviceKey]: 'Could not save.' }))
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Admin Settings & Service Rules Engine</h2>
            <p>Configure civic service catalog, mandatory document policies, and validation rules.</p>
          </div>
          <div className="badge badge-info" style={{ padding: '6px 12px', fontSize: 13 }}>
            Administrator: <strong>{staffUser.name}</strong>
          </div>
        </div>
      </div>

      <div className="status-banner info" style={{ marginBottom: 20 }}>
        <span>⚙️</span>
        <div>
          <strong>Document Rules Policy:</strong> Edit which documents are mandatory for each citizen service. Changes take effect immediately across all citizen uploads and consistency checks.
        </div>
      </div>

      {error && <div className="status-banner danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {services.map((srv) => {
          const serviceKey = srv.id
          const currentDocs = selections[serviceKey] || (srv.required_documents ? srv.required_documents.map(d => d.key) : [])
          return (
            <div className="card" key={serviceKey} style={{ borderLeft: srv.is_active ? '4px solid var(--color-primary)' : '4px solid var(--color-ink-muted)' }}>
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{srv.name}</h3>
                    <span className={`badge ${srv.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {srv.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                    id: {serviceKey} • Category: {srv.category || 'General'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleToggleActive(srv.id)}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    {srv.is_active ? 'Deactivate Service' : 'Activate Service'}
                  </button>
                  <span className="badge badge-neutral">
                    {currentDocs.length} Required
                  </span>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', margin: '4px 0 12px' }}>
                {srv.description}
              </p>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-ink-muted)', marginBottom: 8 }}>
                MANDATORY DOCUMENT CHECKLIST:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, margin: '8px 0 16px' }}>
                {ALL_KNOWN_DOCS.map((doc) => {
                  const checked = currentDocs.includes(doc)
                  return (
                    <label
                      key={doc}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 500,
                        fontSize: 13,
                        padding: '8px 10px',
                        background: checked ? 'var(--color-primary-light, #f0f7f6)' : 'var(--color-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: checked ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDoc(serviceKey, doc)}
                      />
                      <span>{DOCUMENT_TYPE_LABELS[doc] || doc}</span>
                    </label>
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn btn-sm" onClick={() => handleSave(serviceKey)}>
                  Save Requirements for {srv.name}
                </button>
                {savedMessage[serviceKey] && (
                  <span className={`badge ${savedMessage[serviceKey].includes('success') ? 'badge-success' : 'badge-danger'}`}>
                    {savedMessage[serviceKey]}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminSettings() {
  return (
    <StaffGate requireRole="Administrator">
      <AdminSettingsContent />
    </StaffGate>
  )
}
