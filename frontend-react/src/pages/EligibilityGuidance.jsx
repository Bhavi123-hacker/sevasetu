import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'

export default function EligibilityGuidance() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialService = searchParams.get('service') || 'income_certificate'

  const [activeTab, setActiveTab] = useState(searchParams.get('service') === 'passport' ? 'passport_advisor' : 'general_eligibility')
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(initialService)
  
  // General Eligibility Criteria
  const [criteria, setCriteria] = useState({
    annual_income: 180000,
    state: 'Gujarat',
    category: 'OBC',
    is_resident: true,
    is_student: false,
    disability_percentage: 0,
    age: 32,
  })
  const [generalResult, setGeneralResult] = useState(null)
  const [loadingGeneral, setLoadingGeneral] = useState(false)

  // Passport Advisor Questionnaire Answers
  const [passportAnswers, setPassportAnswers] = useState({
    application_type: 'fresh',
    applicant_category: 'adult',
    has_address_changed: 'yes',
    special_circumstance: 'none',
    non_ecr_eligible: 'yes',
  })
  const [passportChecklistResult, setPassportChecklistResult] = useState(null)
  const [loadingPassport, setLoadingPassport] = useState(false)

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await api.getServices()
        setServices(res.data)
      } catch (err) {
        console.error('Failed to load services:', err)
      }
    }
    loadServices()
  }, [])

  useEffect(() => {
    if (activeTab === 'passport_advisor' || selectedService === 'passport') {
      handleEvaluatePassport()
    } else if (selectedService) {
      handleEvaluateGeneral()
    }
  }, [activeTab, selectedService])

  const handleEvaluateGeneral = async () => {
    setLoadingGeneral(true)
    try {
      const res = await api.checkEligibility(selectedService, criteria)
      setGeneralResult(res.data)
    } catch (err) {
      console.error('Failed to check general eligibility:', err)
    } finally {
      setLoadingGeneral(false)
    }
  }

  const handleEvaluatePassport = async () => {
    setLoadingPassport(true)
    try {
      const res = await api.evaluatePassportRequirements(passportAnswers)
      setPassportChecklistResult(res.data)
    } catch (err) {
      console.error('Failed to evaluate passport requirements:', err)
    } finally {
      setLoadingPassport(false)
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 20px' }}>
      {/* Navigation Header & Mode Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 22, fontWeight: 700 }}>
            Indicative Eligibility Guidance
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
            Authoritative pre-verification guidance grounded in statutory rules and verified government sources.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${activeTab === 'passport_advisor' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveTab('passport_advisor')
              setSelectedService('passport')
            }}
          >
            🛂 Passport Document Advisor (Reference Service)
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'general_eligibility' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('general_eligibility')}
          >
            📋 Indicative Eligibility Guidance
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PASSPORT REFERENCE SERVICE ADVISOR (SECTION 7)                     */}
      {/* ========================================================================= */}
      {activeTab === 'passport_advisor' && (
        <div>
          <div
            className="alert-card alert-success"
            style={{
              padding: 24,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="badge badge-success" style={{ fontWeight: 700 }}>
                    ✓ OFFICIAL SOURCE
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    Ministry of External Affairs / Passport Seva
                  </span>
                </div>
                <h3 style={{ margin: '4px 0 6px 0', fontSize: 18, fontWeight: 700 }}>
                  Indian Passport Document Advisor (Passports Act, 1967)
                </h3>
                <p style={{ margin: 0, fontSize: 13, maxWidth: 750 }}>
                  Answer the interactive questionnaire below to dynamically generate your exact applicable document checklist with valid alternatives and conditional requirements.
                </p>
              </div>

              <a
                href="https://passportindia.gov.in"
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-secondary"
                style={{ backgroundColor: '#ffffff', color: '#0d9488', border: '1px solid #0d9488' }}
              >
                Official Portal ↗
              </a>
            </div>
          </div>

          {/* Interactive Passport Questionnaire */}
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 700 }}>
              1. Passport Application Parameters Questionnaire
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
              {/* Question 1: Application Type */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Application Type:
                </label>
                <select
                  className="input-field"
                  value={passportAnswers.application_type}
                  onChange={(e) => {
                    setPassportAnswers({ ...passportAnswers, application_type: e.target.value })
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
                >
                  <option value="fresh">Fresh Passport (Never held an Indian passport)</option>
                  <option value="reissue">Reissue of Passport (Already have / had an Indian passport)</option>
                </select>
              </div>

              {/* Question 2: Applicant Category */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Applicant Age Category:
                </label>
                <select
                  className="input-field"
                  value={passportAnswers.applicant_category}
                  onChange={(e) => {
                    setPassportAnswers({ ...passportAnswers, applicant_category: e.target.value })
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
                >
                  <option value="adult">Adult (18 Years of age or older)</option>
                  <option value="minor">Minor (Below 18 Years of age)</option>
                </select>
              </div>

              {/* Question 3: Address Change */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Present Residential Address Status:
                </label>
                <select
                  className="input-field"
                  value={passportAnswers.has_address_changed}
                  onChange={(e) => {
                    setPassportAnswers({ ...passportAnswers, has_address_changed: e.target.value })
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
                >
                  <option value="yes">Yes, present address requires verification</option>
                  <option value="no">No change (same as existing passport records)</option>
                </select>
              </div>

              {/* Question 4: Special Circumstances */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Special Case / Circumstances:
                </label>
                <select
                  className="input-field"
                  value={passportAnswers.special_circumstance}
                  onChange={(e) => {
                    setPassportAnswers({ ...passportAnswers, special_circumstance: e.target.value })
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
                >
                  <option value="none">Standard Application (Normal process)</option>
                  <option value="name_change">Change in Name / Surname (Gazette / Marriage)</option>
                  <option value="lost_stolen">Lost / Stolen / Damaged Passport Booklet</option>
                </select>
              </div>

              {/* Question 5: Non-ECR Eligibility */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Non-ECR (Emigration Check Not Required) Qualification:
                </label>
                <p style={{ margin: '0 0 6px 0', fontSize: 12, color: 'var(--color-muted)' }}>
                  Matriculation (10th standard) pass certificate holders, graduates, taxpayers, and persons over 50 years are eligible for Non-ECR.
                </p>
                <select
                  className="input-field"
                  value={passportAnswers.non_ecr_eligible}
                  onChange={(e) => {
                    setPassportAnswers({ ...passportAnswers, non_ecr_eligible: e.target.value })
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
                >
                  <option value="yes">Yes, applicant is eligible for Non-ECR (Pass 10th standard or higher)</option>
                  <option value="no">No, standard ECR category applies</option>
                </select>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleEvaluatePassport}
              disabled={loadingPassport}
              style={{ width: '100%', padding: '12px 16px', fontWeight: 600 }}
            >
              {loadingPassport ? 'Evaluating Passport Rules...' : '⚡ Generate Tailored Passport Document Checklist'}
            </button>
          </div>

          {/* Generated Applicable Passport Document Checklist */}
          {passportChecklistResult && (
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    2. Applicable Passport Document Bundle ({passportChecklistResult.total_documents_expected} Groups Required)
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                    Requirements evaluated against <strong>Passport Seva Version {passportChecklistResult.requirement_version}</strong>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/apply-wizard?service=passport`)}
                >
                  Upload & Pre-Verify Documents →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {passportChecklistResult.applicable_checklist?.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      backgroundColor: item.requirement_type === 'Required' ? '#f8fafc' : '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>
                          {item.requirement_type === 'Required' ? '📌' : item.requirement_type === 'Alternative' ? '🔄' : 'ℹ️'}
                        </span>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-ink)' }}>
                          {item.category}
                        </h4>
                      </div>
                      <span
                        className={`badge ${item.requirement_type === 'Required' ? 'badge-danger' : item.requirement_type === 'Alternative' ? 'badge-info' : 'badge-warning'}`}
                        style={{ fontSize: 11 }}
                      >
                        {item.requirement_type.toUpperCase()} ({item.alternative_group || 'SLOT'})
                      </span>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f766e', marginBottom: 6 }}>
                      Primary Option: {item.primary_document}
                    </div>

                    {item.allowed_alternatives?.length > 1 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4 }}>
                          Accepted Statutory Alternatives (Provide any ONE):
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--color-ink)', lineHeight: 1.5 }}>
                          {item.allowed_alternatives.map((alt, altIdx) => (
                            <li key={altIdx}>{alt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.4, borderTop: '1px dashed var(--color-border)', paddingTop: 6, marginTop: 6 }}>
                      <div><strong>Statutory Reason:</strong> {item.reason}</div>
                      <div><strong>Issuing Authority:</strong> {item.issuing_authority}</div>
                      {item.verification_note && (
                        <div style={{ color: '#0369a1', marginTop: 2 }}>
                          💡 <em>Notice: {item.verification_note}</em>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Honest Civic Notice */}
              <div
                style={{
                  marginTop: 20,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: 'var(--color-bg-subtle)',
                  fontSize: 12,
                  color: 'var(--color-muted)',
                  lineHeight: 1.5,
                }}
              >
                ℹ️ <strong>SevaSetu Pre-Verification Notice:</strong> This checklist reflects the Ministry of External Affairs (MEA) Passport Seva rules. SevaSetu assists in validating document quality, legibility, and demographic consistency before submission. Official travel documents and biometric issuance are processed exclusively by authorized Regional Passport Offices.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GENERAL CIVIC SERVICES ELIGIBILITY                                 */}
      {/* ========================================================================= */}
      {activeTab === 'general_eligibility' && (
        <div>
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Select Government Service / Scheme:
              </label>
              <select
                className="input-field"
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.department}) - {s.verification_status === 'OFFICIAL_VERIFIED' ? '✓ OFFICIAL' : 'CONFIGURED'}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Criteria Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Annual Household Income (₹):
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={criteria.annual_income}
                  onChange={(e) => setCriteria({ ...criteria, annual_income: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  State of Residence:
                </label>
                <select
                  className="input-field"
                  value={criteria.state}
                  onChange={(e) => setCriteria({ ...criteria, state: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
                >
                  <option value="Gujarat">Gujarat</option>
                  <option value="Rajasthan">Rajasthan</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Other">Other State</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Social Category:
                </label>
                <select
                  className="input-field"
                  value={criteria.category}
                  onChange={(e) => setCriteria({ ...criteria, category: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
                >
                  <option value="General">General</option>
                  <option value="OBC">OBC (Other Backward Classes)</option>
                  <option value="SC">SC (Scheduled Caste)</option>
                  <option value="ST">ST (Scheduled Tribe)</option>
                  <option value="EWS">EWS (Economically Weaker Section)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Age (Years):
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={criteria.age}
                  onChange={(e) => setCriteria({ ...criteria, age: parseInt(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6 }}
                />
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleEvaluateGeneral} disabled={loadingGeneral} style={{ width: '100%' }}>
              {loadingGeneral ? 'Evaluating configured criteria...' : '🔍 Evaluate Eligibility Match'}
            </button>
          </div>

          {/* General Evaluation Results Box */}
          {generalResult && (
            <div
              className="card"
              style={{
                padding: 24,
                borderLeft: generalResult.is_indicatively_matched ? '4px solid #10b981' : '4px solid #f59e0b',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Evaluation Summary</h3>
                <span
                  className={`badge ${generalResult.is_indicatively_matched ? 'badge-success' : 'badge-warning'}`}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  {generalResult.guidance_status}
                </span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px 0' }}>Criteria Verification Breakdown:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {generalResult.matching_criteria?.map((item, idx) => (
                    <div key={idx} style={{ fontSize: 13, color: '#047857', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✅</span>
                      <span>{item}</span>
                    </div>
                  ))}
                  {generalResult.unmatched_criteria?.map((item, idx) => (
                    <div key={idx} style={{ fontSize: 13, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚠️</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {generalResult.guidance_notes?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px 0' }}>Guidance Notes:</h4>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                    {generalResult.guidance_notes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/apply-wizard?service=${selectedService}`)}
                  style={{ flex: 1 }}
                >
                  Proceed to Upload Documents
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
