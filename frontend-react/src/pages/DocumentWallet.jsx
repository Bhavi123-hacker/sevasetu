import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'

export default function DocumentWallet() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState('aadhaar')
  const [file, setFile] = useState(null)
  const [uploadFeedback, setUploadFeedback] = useState(null)

  const DOC_TYPE_OPTIONS = [
    { value: 'aadhaar', label: 'Aadhaar Card (Identity & Proof of Age)' },
    { value: 'ration_card', label: 'Ration Card (Family & Residence Proof)' },
    { value: 'income_proof', label: 'Income Certificate / Salary Slip' },
    { value: 'residence_proof', label: 'Electricity Bill / Domicile Certificate' },
    { value: 'caste_proof', label: 'Caste Certificate / Community Proof' },
    { value: 'birth_certificate', label: 'Birth Certificate / Age Proof' },
    { value: 'disability_certificate', label: 'Disability Certificate (UDID)' },
  ]

  useEffect(() => {
    loadWallet()
  }, [])

  async function loadWallet() {
    setLoading(true)
    try {
      const res = await api.getWallet()
      setDocuments(res.data)
    } catch (err) {
      console.error('Failed to load wallet:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setUploadFeedback(null)

    const formData = new FormData()
    formData.append('doc_type', selectedDocType)
    formData.append('file', file)

    try {
      const res = await api.uploadWalletDoc(formData)
      setUploadFeedback({
        type: 'success',
        data: res.data,
      })
      setFile(null)
      loadWallet()
    } catch (err) {
      console.error('Failed to upload document to wallet:', err)
      setUploadFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Document pre-verification failed. Please check file format and size.',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId) => {
    if (!window.confirm('Remove this document from your private wallet?')) return
    try {
      await api.deleteWalletDoc(docId)
      setDocuments(documents.filter((d) => d.id !== docId))
    } catch (err) {
      console.error('Failed to delete doc:', err)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface)',
          padding: '20px 24px',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>📁</span>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Citizen Document Wallet</h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-muted)' }}>
            Your secure, private document vault. Store pre-verified documents to reuse across civic service applications.
          </p>
        </div>

        <Link to="/apply-wizard" className="btn btn-primary">
          📝 Build Application from Wallet
        </Link>
      </div>

      {/* Upload & Pre-Verification Card */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
          ➕ Add & Pre-Verify Document
        </h3>

        <form onSubmit={handleUpload}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 14, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Document Category / Type:
              </label>
              <select
                className="input-field"
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 6 }}
              >
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Select File (PDF, PNG, JPG, WebP max 10MB):
              </label>
              <input
                type="file"
                className="input-field"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6 }}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={uploading || !file}>
              {uploading ? 'Pre-Verifying...' : '⚡ Upload & Pre-Verify'}
            </button>
          </div>
        </form>

        {/* Upload Feedback Result */}
        {uploadFeedback && (
          <div
            className={`alert-card ${uploadFeedback.type === 'success' ? 'alert-success' : 'alert-danger'}`}
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 8,
            }}
          >
            {uploadFeedback.type === 'success' ? (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✅</span> Document Successfully Pre-Verified & Stored!
                </div>
                <div style={{ fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>Detected Type: <strong>{uploadFeedback.data.detected_type}</strong></span>
                  <span>Type Match: <strong>{uploadFeedback.data.type_status}</strong></span>
                  <span>Quality Score: <strong>{uploadFeedback.data.quality_status}</strong></span>
                  <span>Validity: <strong>{uploadFeedback.data.validity_status}</strong></span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600 }}>⚠️ {uploadFeedback.message}</div>
            )}
          </div>
        )}
      </div>

      {/* Stored Documents List */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Stored Documents ({documents.length})
      </h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>Loading wallet documents...</div>
      ) : documents.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>
          <span style={{ fontSize: 32 }}>📁</span>
          <p style={{ margin: '12px 0 0 0', fontSize: 14 }}>Your wallet is currently empty.</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>Upload your Aadhaar or residence documents above to reuse them anytime.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {documents.map((doc) => (
            <div key={doc.id} className="card" style={{ padding: 18, border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{doc.original_filename}</h4>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{doc.doc_type?.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ color: '#b91c1c', padding: '2px 8px' }}
                  onClick={() => handleDelete(doc.id)}
                  title="Remove from wallet"
                >
                  🗑️
                </button>
              </div>

              {/* Status Tags */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
                <span className={`badge ${doc.type_status === 'DOCUMENT_TYPE_MATCH' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                  {doc.type_status === 'DOCUMENT_TYPE_MATCH' ? '✓ Type Matched' : '⚠ Type Mismatch'}
                </span>
                <span className={`badge ${doc.quality_status === 'GOOD' ? 'badge-success' : doc.quality_status === 'UNCERTAIN' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                  Quality: {doc.quality_status}
                </span>
                <span className={`badge ${doc.validity_status === 'VALID' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                  {doc.validity_status}
                </span>
              </div>

              {/* Extraction Preview */}
              {doc.ocr_text && (
                <div
                  style={{
                    background: 'var(--color-bg-subtle)',
                    padding: 8,
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--color-muted)',
                    maxHeight: 60,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: 10,
                  }}
                >
                  {doc.ocr_text.slice(0, 120)}...
                </div>
              )}

              {/* Provenance Disclaimer */}
              <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                {doc.authenticity_disclaimer || 'Automated pre-verification only. Official authenticity is determined during statutory review.'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
