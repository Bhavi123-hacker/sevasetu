import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'
import { DOCUMENT_TYPE_LABELS } from '../config'
import { Icon, ErrorState } from '../components/Icon'

const ALL_KNOWN_DOCS = Object.keys(DOCUMENT_TYPE_LABELS)

function AdminSettingsContent() {
  const { staffUser } = useAuth()
  const [activeTab, setActiveTab] = useState('services') // 'services' | 'integrations'
  const [services, setServices] = useState([])
  const [selections, setSelections] = useState({})
  const [editingConfig, setEditingConfig] = useState({})
  const [integrationData, setIntegrationData] = useState(null)
  const [error, setError] = useState(null)
  const [savedMessage, setSavedMessage] = useState({})
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [srvRes, reqRes, intRes] = await Promise.all([
        client.get('/api/admin/services'),
        client.get('/api/service-requirements'),
        client.get('/api/integration/status').catch(() => ({ data: null })),
      ])
      if (Array.isArray(srvRes.data)) {
        setServices(srvRes.data)
        const initialEdit = {}
        srvRes.data.forEach((s) => {
          initialEdit[s.id] = {
            name: s.name,
            description: s.description,
            category: s.category || 'Certificates',
            sla_days: s.sla_days || 7,
            interview_required: Boolean(s.interview_required),
            requirement_version: s.requirement_version || '2026-v1.0',
          }
        })
        setEditingConfig(initialEdit)
      } else {
        setServices([])
      }
      setSelections(reqRes.data || {})
      if (intRes.data) {
        setIntegrationData(intRes.data)
      }
    } catch (err) {
      console.error('Failed to load admin settings:', err)
      const detail = err.response?.data?.detail
      if (err.response?.status === 403) {
        setError('Access denied: Administrator privileges required to configure service catalog.')
      } else if (err.response?.status === 401) {
        setError('Session expired or unauthorized. Please re-authenticate as Administrator.')
      } else {
        setError(detail || 'Backend unavailable. Unable to connect to authoritative service catalog.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      alert('Could not change service status: ' + (err.response?.data?.detail || 'Network error.'))
    }
  }

  async function handleSave(serviceKey) {
    try {
      const config = editingConfig[serviceKey] || {}
      // Update requirements
      await client.put(`/api/service-requirements/${serviceKey}`, {
        document_types: selections[serviceKey] || [],
      })
      // Update service metadata
      await client.put(`/api/admin/services/${serviceKey}`, {
        name: config.name,
        description: config.description,
        category: config.category,
        sla_days: parseInt(config.sla_days || 7, 10),
        interview_required: config.interview_required,
        requirement_version: config.requirement_version,
      })
      setSavedMessage((prev) => ({ ...prev, [serviceKey]: 'Configuration & Requirements saved successfully.' }))
    } catch (err) {
      setSavedMessage((prev) => ({ ...prev, [serviceKey]: 'Could not save: ' + (err.response?.data?.detail || 'Error') }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-start flex-wrap gap-4">
        <div>
          <h2>Admin Settings & Service Configuration Engine</h2>
          <p>Manage civic service catalog, statutory SLA targets, versioning, and integration gateways.</p>
        </div>
        <div className="badge badge-info text-xs py-1 px-3">
          Administrator: <strong>{staffUser?.name || 'Admin'}</strong>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className={`btn btn-sm ${activeTab === 'services' ? 'btn-primary' : 'btn-ghost'}`}
        >
          <Icon name="building" size={14} />
          <span>Service Definitions & Rules ({services.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('integrations')}
          className={`btn btn-sm ${activeTab === 'integrations' ? 'btn-primary' : 'btn-ghost'}`}
        >
          <Icon name="sliders" size={14} />
          <span>Integration Gateway Status</span>
        </button>
      </div>

      {error && (
        <div className="status-banner danger flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" size={16} />
            <span><strong>Backend Error:</strong> {error}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            <Icon name="refresh" size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading authoritative configuration catalog...
          </p>
        </div>
      ) : activeTab === 'integrations' ? (
        <div className="space-y-6">
          <div className="status-banner info">
            <Icon name="shield" size={16} />
            <div>
              <strong>Integration Governance:</strong> {integrationData?.disclaimer || 'External government production integrations require official departmental credentials and bilateral authorizations.'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(integrationData?.providers || [
              {
                id: 'identity_verification',
                name: 'Identity Verification Gateway',
                environment: 'SANDBOX / INTEGRATION_READY',
                status: 'AVAILABLE',
                capabilities: ['Format Checksum Validation', 'Verhoeff Check', 'Structure Verification'],
                notes: 'Sandbox mode active. Production requires UIDAI ASA credentials.',
              },
              {
                id: 'document_verification',
                name: 'Digital Document Repository',
                environment: 'SANDBOX / INTEGRATION_READY',
                status: 'AVAILABLE',
                capabilities: ['MIME Screening', 'Local Object Storage', 'Metadata Check'],
                notes: 'DigiLocker adapter ready for enterprise authorization tokens.',
              },
              {
                id: 'eligibility_rules',
                name: 'Statutory Eligibility Engine',
                environment: 'AUTHORITATIVE_INTERNAL',
                status: 'AVAILABLE',
                capabilities: ['84 Requirement Items', 'Rule Versioning', 'Alternative Proofs'],
                notes: 'Grounded in state & central service gazettes.',
              },
            ]).map((prov) => (
              <div key={prov.id} className="card p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{prov.name}</h4>
                    <span className="badge badge-success text-[10px]">{prov.status}</span>
                  </div>
                  <div className="text-[11px] font-mono text-teal-700 dark:text-teal-400 font-bold">
                    ENV: {prov.environment}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>Capabilities:</strong> {prov.capabilities ? prov.capabilities.join(', ') : 'Standard'}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                  {prov.notes}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : services.length === 0 && !error ? (
        <div className="card p-8 text-center text-slate-500 text-xs">
          No services configured in backend catalog.
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((srv) => {
            const serviceKey = srv.id
            const currentDocs = selections[serviceKey] || (srv.required_documents ? srv.required_documents.map((d) => d.key) : [])
            const config = editingConfig[serviceKey] || {
              name: srv.name,
              description: srv.description,
              category: srv.category || 'Certificates',
              sla_days: srv.sla_days || 7,
              interview_required: Boolean(srv.interview_required),
              requirement_version: srv.requirement_version || '2026-v1.0',
            }

            return (
              <div className={`card p-6 space-y-4 border-l-4 ${srv.is_active ? 'border-l-teal-600' : 'border-l-slate-400'}`} key={serviceKey}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{srv.name}</h3>
                      <span className={`badge ${srv.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {srv.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      ID: {serviceKey} • Category: {srv.category || 'General'} • Version: {srv.requirement_version || '2026-v1.0'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm text-xs"
                      onClick={() => handleToggleActive(srv.id)}
                    >
                      {srv.is_active ? 'Deactivate Service' : 'Activate Service'}
                    </button>
                    <span className="badge badge-neutral text-xs">
                      {currentDocs.length} Mandatory Docs
                    </span>
                  </div>
                </div>

                {/* Configuration Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      STATUTORY SLA (DAYS)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={config.sla_days || 7}
                      onChange={(e) =>
                        setEditingConfig((prev) => ({
                          ...prev,
                          [serviceKey]: { ...prev[serviceKey], sla_days: parseInt(e.target.value, 10) || 1 },
                        }))
                      }
                      className="input-field text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      REQUIREMENT VERSION
                    </label>
                    <input
                      type="text"
                      value={config.requirement_version || '2026-v1.0'}
                      onChange={(e) =>
                        setEditingConfig((prev) => ({
                          ...prev,
                          [serviceKey]: { ...prev[serviceKey], requirement_version: e.target.value },
                        }))
                      }
                      className="input-field text-xs"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={config.interview_required}
                        onChange={(e) =>
                          setEditingConfig((prev) => ({
                            ...prev,
                            [serviceKey]: { ...prev[serviceKey], interview_required: e.target.checked },
                          }))
                        }
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>Verification Interview Gate Required</span>
                    </label>
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  MANDATORY DOCUMENT CHECKLIST:
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {ALL_KNOWN_DOCS.map((doc) => {
                    const checked = currentDocs.includes(doc)
                    return (
                      <label
                        key={doc}
                        className={`flex items-center gap-2 text-xs p-2 rounded-xl border cursor-pointer transition ${
                          checked
                            ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200 font-semibold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDoc(serviceKey, doc)}
                          className="rounded text-teal-600"
                        />
                        <span className="truncate">{DOCUMENT_TYPE_LABELS[doc] || doc}</span>
                      </label>
                    )
                  })}
                </div>

                <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button className="btn btn-primary btn-sm" onClick={() => handleSave(serviceKey)}>
                    <Icon name="check" size={14} />
                    <span>Save Requirements for {srv.name}</span>
                  </button>
                  {savedMessage[serviceKey] && (
                    <span className={`badge text-xs ${savedMessage[serviceKey].includes('successfully') ? 'badge-success' : 'badge-danger'}`}>
                      {savedMessage[serviceKey]}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
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
