import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { Icon } from '../components/Icon'

export default function CitizenHome() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedService, setSelectedService] = useState(null)
  const [checklist, setChecklist] = useState(null)
  const [loadingChecklist, setLoadingChecklist] = useState(false)

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await api.getServices()
        setServices(res.data)
      } catch (err) {
        console.error('Failed to load services:', err)
      } finally {
        setLoading(false)
      }
    }
    loadServices()
  }, [])

  const handleInspectService = async (service) => {
    setSelectedService(service)
    setLoadingChecklist(true)
    try {
      const res = await api.getServiceChecklist(service.id)
      setChecklist(res.data)
    } catch (err) {
      console.error('Failed to load checklist:', err)
    } finally {
      setLoadingChecklist(false)
    }
  }

  const categories = ['ALL', 'Certificates', 'Revenue & Welfare', 'Travel & Citizenship', 'Identity & National Registry', 'Transport & Licensing', 'Social Welfare']

  const filteredServices = (Array.isArray(services) ? services : []).filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.department && s.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.authority && s.authority.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())

    if (selectedCategory === 'ALL') return matchesSearch
    return matchesSearch && (s.category === selectedCategory || s.department?.includes(selectedCategory))
  })

  return (
    <div className="space-y-8">
      {/* 1. Hero Civic Banner */}
      <div className="card p-6 sm:p-10 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white border-teal-900/40 shadow-xl space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 bg-teal-900/60 border border-teal-500/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Civic Document Infrastructure</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white m-0">
            Civic Document Services, Simplified.
          </h1>
        </div>
        <p className="text-xs sm:text-base text-slate-300 max-w-3xl leading-relaxed m-0">
          Submit documents, track verification, communicate with officers, and receive accountable digital decisions through one secure civic-service workflow.
        </p>

        <div className="flex gap-3 flex-wrap pt-2">
          <Link to="/apply-wizard" className="btn btn-primary btn-md font-bold shadow-md">
            <Icon name="file-text" size={16} />
            <span>Start Application</span>
          </Link>
          <Link to="/status" className="btn btn-secondary btn-md font-bold">
            <Icon name="search" size={16} />
            <span>Track Application</span>
          </Link>
          <Link to="/eligibility" className="btn btn-secondary btn-md font-bold">
            <Icon name="check-circle" size={16} />
            <span>Requirements Advisor</span>
          </Link>
        </div>
      </div>

      {/* 2. Four Core Value Propositions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 space-y-2 border-l-4 border-l-teal-600">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
            <Icon name="shield" size={18} />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-ink)] m-0">Document Pre-Verification</h3>
          <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed m-0">
            Automated document classification, OCR extraction, and data integrity checks.
          </p>
        </div>

        <div className="card p-5 space-y-2 border-l-4 border-l-teal-600">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
            <Icon name="activity" size={18} />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-ink)] m-0">Transparent Case Tracking</h3>
          <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed m-0">
            End-to-end statutory stage progression with immutable audit trail.
          </p>
        </div>

        <div className="card p-5 space-y-2 border-l-4 border-l-teal-600">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
            <Icon name="user" size={18} />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-ink)] m-0">Human Officer Review</h3>
          <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed m-0">
            Accountable statutory decisions rendered exclusively by authorized officers.
          </p>
        </div>

        <div className="card p-5 space-y-2 border-l-4 border-l-teal-600">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold">
            <Icon name="message" size={18} />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-ink)] m-0">Grievance Redressal</h3>
          <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed m-0">
            Built-in citizen dispute resolution under monitored service-level agreements.
          </p>
        </div>
      </div>

      {/* 3. Search & Category Filter Bar */}
      <div className="flex gap-4 flex-wrap items-center justify-between">
        <div className="flex-1 min-w-[280px]">
          <div className="relative">
            <input
              type="text"
              className="input-field text-xs sm:text-sm pl-9"
              placeholder="Search certificates, revenue services, departments, or authorities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-3 top-2.5 text-slate-400">
              <Icon name="search" size={15} />
            </span>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`btn btn-sm text-xs rounded-full whitespace-nowrap ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid & Checklist Inspector */}
      <div className={`grid gap-6 ${selectedService ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        <div className={selectedService ? 'lg:col-span-2' : ''}>
          {loading ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Loading civic services catalog...
              </p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="card p-12 text-center text-slate-500 text-xs sm:text-sm">
              No matching services found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredServices.map((service) => {
                const isOfficial = service.verification_status === 'OFFICIAL_VERIFIED'
                return (
                  <div
                    key={service.id}
                    className={`card p-5 cursor-pointer flex flex-col justify-between hover:border-teal-600 dark:hover:border-teal-500 transition space-y-4 ${
                      selectedService?.id === service.id ? 'ring-2 ring-teal-500 border-teal-500' : ''
                    }`}
                    onClick={() => handleInspectService(service)}
                  >
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0">
                          {service.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                            isOfficial
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {isOfficial ? 'Official Source' : 'Configured'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <div><strong>Authority:</strong> {service.authority || service.department}</div>
                        <div><strong>Version:</strong> {service.requirement_version || '2026-08'}</div>
                        <div><strong>Statutory SLA:</strong> {service.sla_days || 7} Working Days</div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed m-0">
                        {service.description}
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>Verified: {service.last_verified_at || '2026-08-24'}</span>
                        {service.source_url && (
                          <a
                            href={service.source_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                          >
                            Source ↗
                          </a>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="btn btn-secondary btn-sm flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/eligibility?service=${service.id}`)
                          }}
                        >
                          View Requirements
                        </button>
                        <button
                          className="btn btn-primary btn-sm flex-1 text-xs font-bold"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/apply-wizard?service=${service.id}`)
                          }}
                        >
                          Apply Now
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected Service Checklist Drawer */}
        {selectedService && (
          <div className="card p-6 space-y-4 h-fit sticky top-20 border-teal-500/40">
            <div className="flex justify-between items-start gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0">
                {selectedService.name}
              </h3>
              <button
                className="btn btn-ghost btn-sm p-1 text-slate-400 hover:text-slate-600"
                onClick={() => setSelectedService(null)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* Provenance Badge Card */}
            <div
              className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1 ${
                selectedService.verification_status === 'OFFICIAL_VERIFIED'
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                  : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <Icon name="shield" size={14} />
                <span>{selectedService.verification_status === 'OFFICIAL_VERIFIED' ? 'Official Statutory Source' : 'Configured Guidance'}</span>
              </div>
              <div><strong>Authority:</strong> {selectedService.authority || selectedService.department}</div>
              <div><strong>Version:</strong> {selectedService.requirement_version || '2026-08'}</div>
              <div><strong>Effective Date:</strong> {selectedService.effective_from || '2024-01-01'}</div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider m-0">
                Required Document Checklist
              </h4>

              {loadingChecklist ? (
                <div className="text-xs text-slate-400 py-2">Loading requirements...</div>
              ) : checklist ? (
                <ul className="text-xs space-y-1.5 pl-4 list-disc text-slate-700 dark:text-slate-300">
                  {checklist.required_documents?.map((doc, idx) => (
                    <li key={idx} className="font-semibold">
                      {doc.replace(/_/g, ' ').toUpperCase()}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-400">Standard identity, address, and proof documents.</div>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border border-slate-200 dark:border-slate-700">
              <strong>Civic Disclaimer:</strong> Automated pre-verification checklist. Final application processing and document acceptance rests exclusively with designated government authorities.
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                className="btn btn-primary btn-sm font-bold"
                onClick={() => navigate(`/apply-wizard?service=${selectedService.id}`)}
              >
                Proceed with Application
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(`/eligibility?service=${selectedService.id}`)}
              >
                Evaluate Indicative Requirements
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
