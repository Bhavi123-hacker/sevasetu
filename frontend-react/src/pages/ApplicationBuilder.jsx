import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import CitizenAuthModal from '../components/CitizenAuthModal'
import VerificationResultsView from '../components/VerificationResultsView'
import { Icon } from '../components/Icon'

export default function ApplicationBuilder() {
  const { t } = useLanguage()
  const { citizenUser, logoutCitizen } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const defaultService = searchParams.get('service') || 'income_certificate'

  // Wizard Step State: 1: Service, 2: Applicant Info, 3: Documents, 4: Declaration & Submit, 5: Pre-Verification Result
  const [step, setStep] = useState(1)

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authNotice, setAuthNotice] = useState('')

  // Form State - Starts completely clean / empty
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(defaultService)
  const [checklist, setChecklist] = useState([])

  const [applicant, setApplicant] = useState({
    citizen_name: '',
    date_of_birth: '',
    address: '',
    district: '',
    state: 'Gujarat',
    pincode: '',
    phone: '',
    email: '',
  })
  const [profileLoadedNotice, setProfileLoadedNotice] = useState(false)

  // Files: Explicit fresh uploads per slot ONLY
  const [attachedFiles, setAttachedFiles] = useState({}) // { slotKey: File }

  // Statutory Declaration
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false)

  // Submission Status & Result
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [submissionReceipt, setSubmissionReceipt] = useState(null)
  const [resubmitting, setResubmitting] = useState(false)
  const [replacementFiles, setReplacementFiles] = useState({})


  useEffect(() => {
    async function loadServices() {
      try {
        const srvRes = await api.getServices()
        setServices(srvRes.data || [])
      } catch (err) {
        console.error('Failed to load services:', err)
      }
    }
    loadServices()
  }, [])

  useEffect(() => {
    async function loadChecklist() {
      if (!selectedService) return
      try {
        const res = await api.getServiceChecklist(selectedService)
        setChecklist(res.data?.required_documents || ['aadhaar', 'income_proof', 'residence_proof'])
      } catch (err) {
        console.error('Failed to load checklist:', err)
        setChecklist(['aadhaar', 'income_proof', 'residence_proof'])
      }
    }
    loadChecklist()
  }, [selectedService])

  const handleUseSavedProfile = async () => {
    const token = localStorage.getItem('sevasetu_citizen_token')
    if (!token) {
      setAuthNotice('Please sign in or register to load your saved profile.')
      setShowAuthModal(true)
      return
    }

    try {
      const profRes = await api.getProfile()
      if (profRes.data) {
        setApplicant({
          citizen_name: profRes.data.citizen_name || '',
          date_of_birth: profRes.data.date_of_birth || '',
          address: profRes.data.address || '',
          district: profRes.data.district || '',
          state: profRes.data.state || 'Gujarat',
          pincode: profRes.data.pincode || '',
          phone: profRes.data.phone || profRes.data.phone_number || '',
          email: profRes.data.email || '',
        })
        setProfileLoadedNotice(true)
        setTimeout(() => setProfileLoadedNotice(false), 4000)
      }
    } catch (err) {
      console.error('Failed to load profile:', err)
      if (err.response?.status === 401) {
        logoutCitizen()
        setAuthNotice('Session expired. Please sign in again to load your profile.')
        setShowAuthModal(true)
      } else {
        alert('Could not load saved profile. Please enter details manually.')
      }
    }
  }

  const handleInitialSubmit = async () => {
    setSubmissionError('')

    if (!declarationConfirmed) {
      setSubmissionError('Please check the statutory citizen declaration before submitting.')
      return
    }

    if (!applicant.citizen_name.trim()) {
      setSubmissionError('Please enter the applicant full legal name.')
      setStep(2)
      return
    }

    // Verify token exists BEFORE attempting submission
    const citizenToken = localStorage.getItem('sevasetu_citizen_token')
    const staffToken = localStorage.getItem('sevasetu_staff_token')
    if (!citizenToken && !staffToken) {
      setSubmissionError('Citizen authentication required or session expired. Please sign in to submit.')
      setAuthNotice('Please sign in or register with your mobile number to submit this application.')
      setShowAuthModal(true)
      return
    }

    setSubmitting(true)
    const formData = new FormData()
    formData.append('service_type', selectedService)
    formData.append('citizen_name', applicant.citizen_name.trim())
    if (applicant.date_of_birth) formData.append('date_of_birth', applicant.date_of_birth)
    if (applicant.phone) formData.append('phone', applicant.phone)
    if (applicant.address) formData.append('address', applicant.address)
    formData.append('notes', `Declared Address: ${applicant.address || 'N/A'}, District: ${applicant.district || 'N/A'}, State: ${applicant.state}`)

    // Attach fresh files matching required slots
    checklist.forEach((slot) => {
      if (attachedFiles[slot]) {
        formData.append(slot, attachedFiles[slot])
      }
    })

    try {
      const res = await api.submitApplication(formData)
      setSubmissionReceipt(res.data)
      setStep(5) // Only advance to Pre-Verification Result on successful response
    } catch (err) {
      console.error('Submission failed:', err)
      if (err.response?.status === 401) {
        logoutCitizen()
        setSubmissionError('Citizen authentication required or session expired. Please sign in to submit.')
        setAuthNotice('Your session is missing or expired. Please sign in or register below to proceed.')
        setShowAuthModal(true)
      } else if (err.response?.status === 403) {
        setSubmissionError(err.response.data?.detail || 'Unauthorized: Ownership validation failed.')
      } else {
        setSubmissionError(err.response?.data?.detail || 'Application submission failed. Please verify files and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleResubmitCorrections = async () => {
    if (!submissionReceipt?.application_id || !submissionReceipt?.tracking_token) {
      alert('Missing application reference for resubmission.')
      return
    }

    setResubmitting(true)
    const formData = new FormData()
    formData.append('notes', 'Citizen resubmitted corrected documents.')

    Object.keys(replacementFiles).forEach((slot) => {
      if (replacementFiles[slot]) {
        formData.append(slot, replacementFiles[slot])
      }
    })

    try {
      const res = await api.resubmitApplication(
        submissionReceipt.application_id,
        formData,
        submissionReceipt.tracking_token
      )
      setSubmissionReceipt(res.data)
      setReplacementFiles({})
      alert('Replacement documents submitted successfully. Pre-verification refreshed!')
    } catch (err) {
      console.error('Resubmission failed:', err)
      alert(err.response?.data?.detail || 'Resubmission failed. Please verify files and try again.')
    } finally {
      setResubmitting(false)
    }
  }

  const isAuthenticated = Boolean(citizenUser || localStorage.getItem('sevasetu_citizen_token'))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Citizen Authentication Status Header */}
      <div className={`p-3.5 sm:p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm ${
        isAuthenticated
          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
          : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
      }`}>
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <Icon name="check-circle" size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span><strong>Authenticated Citizen:</strong> {citizenUser?.citizen_name || 'Citizen'} <span className="text-[var(--color-ink-muted)]">({citizenUser?.phone || 'Verified Mobile'})</span></span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon name="alert-triangle" size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span><strong>Sign In Required:</strong> Please authenticate with mobile/OTP or password before final submission.</span>
          </div>
        )}

        {!isAuthenticated && (
          <button
            type="button"
            className="btn btn-primary btn-sm text-xs font-bold"
            onClick={() => { setAuthNotice(''); setShowAuthModal(true) }}
          >
            <Icon name="user" size={13} />
            <span>Citizen Sign In / Register</span>
          </button>
        )}
      </div>

      {/* 5-Step Horizontal Stepper */}
      <div className="card p-3 sm:p-4 bg-[var(--color-surface)] border-[var(--color-border)] shadow-xs">
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {[
            { num: 1, label: 'Service' },
            { num: 2, label: 'Applicant' },
            { num: 3, label: 'Documents' },
            { num: 4, label: 'Declaration' },
            { num: 5, label: 'Verification' },
          ].map((s) => {
            const isActive = step === s.num
            const isDone = step > s.num
            return (
              <div
                key={s.num}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg transition-all ${
                  isActive
                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold'
                    : isDone
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-[var(--color-ink-muted)]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-extrabold shrink-0 ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white'
                    : isDone
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-ink-muted)]'
                }`}>
                  {isDone ? <Icon name="check" size={12} /> : s.num}
                </span>
                <span className="truncate hidden sm:inline">{s.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* STEP 1: Select Service */}
      {step === 1 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] m-0">Step 1: Select Government Service</h2>
            <p className="text-xs sm:text-sm text-[var(--color-ink-muted)] m-0">
              Choose the certificate, license, or civic scheme you wish to apply for.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {services.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedService(s.id)}
                className={`p-4 rounded-xl cursor-pointer border transition-all space-y-1.5 ${
                  selectedService === s.id
                    ? 'ring-2 ring-[var(--color-primary)] border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]'
                }`}
              >
                <div className="font-bold text-sm text-[var(--color-ink)]">{s.name}</div>
                <div className="text-xs text-[var(--color-ink-muted)]">{s.department || s.authority}</div>
                <div className="text-[11px] font-semibold text-[var(--color-primary)]">{s.jurisdiction || 'All Districts'} • SLA: {s.sla_days || 7} Days</div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--color-border-subtle)]">
            <button className="btn btn-primary" onClick={() => setStep(2)}>
              <span>Next: Applicant Information</span>
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Applicant Information */}
      {step === 2 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] m-0">Step 2: Applicant Information</h2>
              <p className="text-xs sm:text-sm text-[var(--color-ink-muted)] m-0">
                Enter personal demographics exactly as they appear on statutory documents.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleUseSavedProfile}
            >
              <Icon name="user" size={13} />
              <span>Use Saved Profile</span>
            </button>
          </div>

          {profileLoadedNotice && (
            <div className="status-banner success text-xs">
              <Icon name="check-circle" size={16} className="text-emerald-600" />
              <span>Profile information loaded. Please verify details before continuing.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Full Legal Name *</label>
              <input
                type="text"
                className="input-field text-sm"
                required
                placeholder="e.g. Ramesh Kumar Patel"
                value={applicant.citizen_name}
                onChange={(e) => setApplicant({ ...applicant, citizen_name: e.target.value })}
              />
              <span className="text-[11px] text-[var(--color-ink-muted)] mt-1 block">Must match the primary identity document.</span>
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Date of Birth</label>
              <input
                type="date"
                className="input-field text-sm"
                value={applicant.date_of_birth || ''}
                onChange={(e) => setApplicant({ ...applicant, date_of_birth: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Mobile Phone Number</label>
              <input
                type="tel"
                className="input-field text-sm"
                placeholder="+919876543210"
                value={applicant.phone || ''}
                onChange={(e) => setApplicant({ ...applicant, phone: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2 field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Residential Address</label>
              <input
                type="text"
                className="input-field text-sm"
                placeholder="House / Flat No., Street, Area"
                value={applicant.address || ''}
                onChange={(e) => setApplicant({ ...applicant, address: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">District</label>
              <input
                type="text"
                className="input-field text-sm"
                placeholder="e.g. Ahmedabad"
                value={applicant.district || ''}
                onChange={(e) => setApplicant({ ...applicant, district: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">State</label>
              <input
                type="text"
                className="input-field text-sm"
                value={applicant.state || 'Gujarat'}
                onChange={(e) => setApplicant({ ...applicant, state: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="text-xs font-bold text-[var(--color-ink)] block mb-1">Postal PIN Code (6 digits)</label>
              <input
                type="text"
                className="input-field text-sm"
                placeholder="e.g. 380001"
                maxLength={6}
                value={applicant.pincode || ''}
                onChange={(e) => setApplicant({ ...applicant, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border-subtle)]">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <Icon name="arrow-left" size={16} />
              <span>Back</span>
            </button>
            <button
              className="btn btn-primary"
              disabled={!applicant.citizen_name.trim()}
              onClick={() => {
                if (applicant.pincode && applicant.pincode.length !== 6) {
                  alert('Please enter a valid 6-digit Indian PIN code.')
                  return
                }
                setStep(3)
              }}
            >
              <span>Next: Attach Documents</span>
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Attach Documents */}
      {step === 3 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] m-0">Step 3: Attach Required Documents</h2>
            <p className="text-xs sm:text-sm text-[var(--color-ink-muted)] m-0">
              Upload the required documents for <strong>{selectedService.replace(/_/g, ' ').toUpperCase()}</strong>.
              Each document is pre-verified using OCR, type classification, and quality checks.
            </p>
          </div>

          <div className="space-y-4">
            {checklist.map((slotKey) => (
              <div
                key={slotKey}
                className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon name="file-text" size={16} className="text-[var(--color-primary)]" />
                    <span className="font-bold text-sm text-[var(--color-ink)]">
                      {slotKey.replace(/_/g, ' ').toUpperCase()} *
                    </span>
                  </div>
                  {attachedFiles[slotKey] ? (
                    <span className="badge badge-success text-xs flex items-center gap-1">
                      <Icon name="check-circle" size={12} />
                      <span>Attached: {attachedFiles[slotKey].name}</span>
                    </span>
                  ) : (
                    <span className="badge badge-warning text-xs flex items-center gap-1">
                      <Icon name="alert-circle" size={12} />
                      <span>Required — Not uploaded</span>
                    </span>
                  )}
                </div>

                <div>
                  <input
                    type="file"
                    className="input-field text-xs sm:text-sm"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        setAttachedFiles({ ...attachedFiles, [slotKey]: e.target.files[0] })
                      }
                    }}
                  />
                  <span className="text-[11px] text-[var(--color-ink-muted)] mt-1 block">Supported formats: PDF, PNG, JPG, JPEG, WEBP (Max: 10MB)</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border-subtle)]">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>
              <Icon name="arrow-left" size={16} />
              <span>Back</span>
            </button>
            <button
              className="btn btn-primary"
              disabled={checklist.some((slot) => !attachedFiles[slot])}
              onClick={() => setStep(4)}
            >
              <span>Next: Statutory Declaration</span>
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Statutory Declaration & Submit */}
      {step === 4 && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] m-0">Step 4: Statutory Citizen Declaration</h2>
            <p className="text-xs sm:text-sm text-[var(--color-ink-muted)] m-0">
              Review your submission details and statutory legal declaration.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-xs sm:text-sm space-y-2">
            <div><strong>Applicant Name:</strong> {applicant.citizen_name}</div>
            {applicant.date_of_birth && <div><strong>Date of Birth:</strong> {applicant.date_of_birth}</div>}
            {applicant.phone && <div><strong>Mobile Phone:</strong> {applicant.phone}</div>}
            <div><strong>Service:</strong> {selectedService.replace(/_/g, ' ').toUpperCase()}</div>
            <div><strong>Attached Files:</strong> {Object.keys(attachedFiles).length} document(s) uploaded</div>
          </div>

          {/* Submission Error Banner */}
          {submissionError && (
            <div className="status-banner danger text-xs sm:text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="alert-circle" size={16} className="text-red-600 shrink-0" />
                <span><strong>Submission Error:</strong> {submissionError}</span>
              </div>
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  <Icon name="user" size={12} />
                  <span>Sign In Now</span>
                </button>
              )}
            </div>
          )}

          {/* Statutory Declaration Checkbox */}
          <div className="statutory-declaration-card p-4 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/20 text-xs sm:text-sm">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={declarationConfirmed}
                onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="leading-relaxed">
                <strong className="declaration-title text-[var(--color-ink)]">Statutory Citizen Declaration:</strong> I hereby declare that the personal information and uploaded
                documents submitted for <strong className="declaration-service-name">{selectedService.replace(/_/g, ' ').toUpperCase()}</strong> are true and accurate
                to the best of my knowledge. I understand that <span className="declaration-warning">misrepresentation of facts may lead to statutory cancellation</span> under
                applicable laws.
              </span>
            </label>
          </div>

          {submitting ? (
            <div className="p-8 text-center bg-[var(--color-surface-muted)] rounded-xl border border-[var(--color-border)] space-y-4">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-base font-bold text-[var(--color-ink)] m-0">
                Running Automated Document Pre-Verification...
              </h3>
              <div className="max-w-md mx-auto text-left text-xs space-y-1.5 text-[var(--color-ink-muted)]">
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ File signature & magic-bytes validation</div>
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Tesseract OCR text extraction</div>
                <div className="text-teal-600 dark:text-teal-400 font-semibold">● Document classification & slot matching</div>
                <div>○ Image quality & blur analysis</div>
                <div>○ Cross-document demographic consistency</div>
                <div>○ Statutory readiness scoring & risk tiering</div>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border-subtle)]">
              <button className="btn btn-secondary" onClick={() => setStep(3)}>
                <Icon name="arrow-left" size={16} />
                <span>Back</span>
              </button>
              <button
                className="btn btn-primary"
                disabled={!declarationConfirmed || submitting}
                onClick={handleInitialSubmit}
              >
                <Icon name="file-text" size={16} />
                <span>Submit for Automated Pre-Verification</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 5: Automated Pre-Verification Result & Case Status */}
      {step === 5 && submissionReceipt && (
        <VerificationResultsView
          result={submissionReceipt}
          checklist={checklist}
          onStartNew={() => {
            setStep(1)
            setAttachedFiles({})
            setSubmissionReceipt(null)
            setDeclarationConfirmed(false)
          }}
          onResubmit={handleResubmitCorrections}
          resubmitting={resubmitting}
          replacementFiles={replacementFiles}
          setReplacementFiles={setReplacementFiles}
        />
      )}

      {/* Citizen Authentication Modal */}
      {showAuthModal && (
        <CitizenAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(profile) => {
            setShowAuthModal(false)
            setSubmissionError('')
            if (profile) {
              setApplicant((prev) => ({
                ...prev,
                citizen_name: profile.citizen_name || profile.name || prev.citizen_name || '',
                phone: profile.phone_number || profile.phone || prev.phone || '',
              }))
            }
          }}
          initialName={applicant.citizen_name}
          initialPhone={applicant.phone}
        />
      )}
    </div>
  )
}
