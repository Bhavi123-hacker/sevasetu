import { useState, useEffect } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import StaffGate from '../components/StaffGate'
import { SERVICE_TYPES } from '../config'

const ALL_KNOWN_DOCS = ['aadhaar', 'ration_card', 'electricity_bill', 'residence_proof', 'birth_certificate']

function AdminSettingsContent() {
  const { staffUser } = useAuth()
  const [current, setCurrent] = useState({})
  const [selections, setSelections] = useState({})
  const [error, setError] = useState(null)
  const [savedMessage, setSavedMessage] = useState({})

  useEffect(() => {
    client.get('/api/service-requirements')
      .then((res) => {
        setCurrent(res.data)
        setSelections(res.data)
      })
      .catch(() => setError('Could not reach SevaSetu\u2019s backend.'))
  }, [])

  function toggleDoc(serviceKey, doc) {
    setSelections((prev) => {
      const existing = prev[serviceKey] || []
      const next = existing.includes(doc) ? existing.filter((d) => d !== doc) : [...existing, doc]
      return { ...prev, [serviceKey]: next }
    })
  }

  async function handleSave(serviceKey) {
    try {
      await client.put(`/api/service-requirements/${serviceKey}`, {
        document_types: selections[serviceKey] || [],
      })
      setSavedMessage((prev) => ({ ...prev, [serviceKey]: 'Saved.' }))
    } catch (err) {
      setSavedMessage((prev) => ({ ...prev, [serviceKey]: 'Could not save.' }))
    }
  }

  if (error) return <div className="status-banner danger">{error}</div>

  return (
    <div>
      <h2>Admin Settings</h2>
      <p style={{ color: 'var(--color-ink-muted)' }}>Logged in as {staffUser.name} (Administrator)</p>
      <p>Edit which documents are required per service. Changes apply immediately.</p>

      {Object.entries(SERVICE_TYPES).map(([serviceKey, serviceInfo]) => (
        <div className="card" key={serviceKey}>
          <h3>{serviceInfo.label}</h3>
          {ALL_KNOWN_DOCS.map((doc) => (
            <label key={doc} style={{ display: 'block', fontWeight: 400, marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={(selections[serviceKey] || []).includes(doc)}
                onChange={() => toggleDoc(serviceKey, doc)}
              /> {doc.replace('_', ' ')}
            </label>
          ))}
          <button className="btn" style={{ marginTop: 12 }} onClick={() => handleSave(serviceKey)}>
            Save {serviceInfo.label}
          </button>
          {savedMessage[serviceKey] && (
            <div className="status-banner success" style={{ marginTop: 8 }}>{savedMessage[serviceKey]}</div>
          )}
        </div>
      ))}
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
