import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'

const CORE_CAPABILITIES = [
  {
    icon: 'file-text',
    title: 'Document Intelligence',
    description: 'Automated OCR extraction, Laplacian blur quality scoring, and deterministic negative-constraint classification across Indian civic records.',
  },
  {
    icon: 'shield',
    title: 'Human-in-the-Loop Verification',
    description: 'Explainable AI decision support that surfaces risk indicators without autonomously approving or rejecting statutory civic applications.',
  },
  {
    icon: 'camera',
    title: 'Statutory Interview Gate',
    description: 'Dynamic browser-based audio/video verification interview with structured transcript consistency evaluation and accessible text fallback.',
  },
  {
    icon: 'inbox',
    title: 'Real-Time Case Management',
    description: 'Two-tier officer queue management with automated statutory SLA deadline tracking, officer assignment, and reassignment controls.',
  },
  {
    icon: 'clock',
    title: 'SLA & Deadline Monitoring',
    description: 'Rule-based statutory turnaround monitoring with automated status progression (Normal, Approaching SLA, Overdue).',
  },
  {
    icon: 'message',
    title: 'Civic Grievance Redressal',
    description: 'Formal 8-state escalation workflow with internal staff deliberation notes, citizen communication, and bounded reconsideration requests.',
  },
  {
    icon: 'database',
    title: 'Document Wallet & Versioning',
    description: 'Tamper-evident document repository supporting non-destructive correction versioning and strict citizen data isolation.',
  },
  {
    icon: 'lock',
    title: 'Cryptographic Audit Ledger',
    description: 'Immutable SHA-256 hash-chained event stream logging every state transition, officer action, and document replacement.',
  },
  {
    icon: 'shield',
    title: 'Privacy & Consent Governance',
    description: 'Purpose-bound citizen consent lifecycle management with verifiable retention redaction protecting immutable audit ledgers.',
  },
  {
    icon: 'users',
    title: 'Multi-Role RBAC & IDOR Defense',
    description: 'Server-side authorization enforcing strict boundary controls between Citizens, Verification Officers, Senior Officers, and Administrators.',
  },
  {
    icon: 'check-circle',
    title: 'Digital Decision Certificates',
    description: 'Automated issuance of verifiable decision certificates for approved applications and formal statutory notices for rejected cases.',
  },
  {
    icon: 'activity',
    title: 'Operational Impact Telemetry',
    description: 'Live performance metrics calculated entirely from active database records without synthetic estimates or fabricated numbers.',
  },
]

const INSTITUTIONAL_USERS = [
  {
    role: 'District & Tehsil Administration',
    benefit: 'Streamlines frontline certificate issuance, eliminates clerical bottlenecks, and provides real-time workload visibility across revenue desks.',
  },
  {
    role: 'Municipal Corporations & Urban Local Bodies',
    benefit: 'Automates document screening for civic schemes, welfare applications, and utility permissions while reducing counter queues.',
  },
  {
    role: 'State e-Governance Agencies',
    benefit: 'Standardizes document verification criteria, enforces statutory turnaround SLAs, and provides verifiable tamper-evident audit logs.',
  },
  {
    role: 'Public Service Centers (CSCs)',
    benefit: 'Guides citizen document submission with immediate pre-verification feedback, preventing repeat visits for missing or unreadable scans.',
  },
  {
    role: 'Public Interest NGOs & Welfare Foundations',
    benefit: 'Assists underserved citizens in verifying scheme prerequisites and lodging auditable grievances for delayed government services.',
  },
  {
    role: 'Government System Integrators',
    benefit: 'Offers decoupled integration gateway adapters ready to interface with enterprise departmental databases and citizen portals.',
  },
]

const FAQS = [
  {
    q: 'What role does AI play in SevaSetu?',
    a: 'AI functions exclusively as an explainable decision-support assistant. It extracts text via OCR, assesses scan quality (blur, contrast, brightness), checks demographic consistency between documents, and highlights potential risks. AI never autonomously approves or rejects an application.',
  },
  {
    q: 'Can an application be rejected automatically by the system?',
    a: 'No. All statutory decisions (approval, rejection, or correction request) must be made and cryptographically signed by authorized human verification officers.',
  },
  {
    q: 'What happens if a document scan is blurry or incorrect?',
    a: 'The pre-verification engine alerts the citizen during upload. If submitted, the reviewing officer can initiate a formal Correction Request with specific instructions, allowing the citizen to resubmit without losing their place in the queue.',
  },
  {
    q: 'How does the Verification Interview work?',
    a: 'When an application passes initial document screening, the officer unlocks the interview gate. The citizen answers 5 dynamically grounded statutory questions via browser audio/video or accessible text mode, confirming their declarations.',
  },
  {
    q: 'How are citizen documents and data protected?',
    a: 'Documents are stored in encrypted object storage with strict IDOR protections. Only the submitting citizen and assigned review officers can access them. Purpose-bound consents govern every processing step.',
  },
  {
    q: 'How does the Civic Grievance module work?',
    a: 'Citizens can raise a tracked grievance (SS-GRV-YYYY-XXXXXX) for delayed processing, rejected documents, or technical issues. Grievances follow a strict 8-state SLA-monitored lifecycle with multi-tier officer escalation.',
  },
  {
    q: 'How does SevaSetu handle government integrations?',
    a: 'The platform uses a Decoupled Integration Gateway. In sandbox/demonstration environments, it runs local format and checksum validators. For production deployments, it interfaces with official government gateways upon authorized credential provisioning.',
  },
  {
    q: 'Can the document checklist and statutory rules be customized?',
    a: 'Yes. Administrators can configure mandatory documents, alternative fulfillment rules (ONE_OF, ALL_OF), statutory SLA turnaround targets, and requirement versions from the Admin Settings center.',
  },
]

export default function AboutProduct() {
  const [activeFaq, setActiveFaq] = useState(null)

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index)
  }

  return (
    <div className="space-y-12 py-2 max-w-6xl mx-auto">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl border border-teal-800/40">
        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center space-x-2 bg-teal-900/60 backdrop-blur-md border border-teal-500/40 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-teal-200">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Civic Technology & Case Management Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white m-0">
            SevaSetu
          </h1>

          <p className="text-lg sm:text-xl text-teal-200 font-semibold m-0">
            Accountable Civic Service Verification & Decision Support
          </p>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed m-0">
            Digitize civic application verification, human-in-the-loop document screening, citizen communications, and structured grievance resolution in one accountable, tamper-evident workflow.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/"
              className="btn btn-primary btn-md font-bold shadow-lg"
            >
              <Icon name="user" size={16} />
              <span>Explore Citizen Portal</span>
            </Link>
            <Link
              to="/impact"
              className="btn btn-secondary btn-md font-bold text-white border-white/20 hover:bg-white/10"
            >
              <Icon name="activity" size={16} />
              <span>View Live Impact Metrics</span>
            </Link>
          </div>

          <div className="pt-4 border-t border-teal-800/60 flex items-center space-x-2 text-xs text-teal-200">
            <Icon name="shield" size={14} className="text-teal-400" />
            <span><strong>Statutory Principle:</strong> AI assists verification. Final statutory decisions remain with authorized officers.</span>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">The Problem</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 m-0">
            Operational Challenges in Public Service Intake
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm m-0">
            Government departments and civic organizations face severe administrative friction across manual verification lifecycles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 border-l-4 border-l-rose-500 space-y-3">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 w-fit">
              <Icon name="clock" size={20} />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base m-0">Clerical Screening Bottlenecks</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed m-0">
              Officers spend hundreds of manual hours per week checking document formatting, blur, and demographic name spellings, creating large processing backlogs.
            </p>
          </div>

          <div className="card p-6 border-l-4 border-l-amber-500 space-y-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 w-fit">
              <Icon name="refresh" size={20} />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base m-0">Repeated Citizen Visits</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed m-0">
              Minor clerical errors or missing secondary utility proofs require citizens to make multiple trips to physical administrative centers without clear upfront guidance.
            </p>
          </div>

          <div className="card p-6 border-l-4 border-l-indigo-500 space-y-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 w-fit">
              <Icon name="file-text" size={20} />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base m-0">Lack of Traceable Accountability</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed m-0">
              Disparate communication channels and untracked file movements make it difficult to enforce statutory turnaround deadlines or audit historical determinations.
            </p>
          </div>
        </div>
      </section>

      {/* The Solution Lifecycle */}
      <section className="card p-8 sm:p-10 space-y-8 bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">The Workflow</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 m-0">
            End-to-End Accountable Civic Case Lifecycle
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm m-0">
            From initial citizen submission to statutory determination, certificate issuance, and post-resolution grievance redressal.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { step: '01', title: 'Citizen Application', desc: 'Citizen selects civic service and uploads identity and supporting documents with immediate format screening.' },
            { step: '02', title: 'Explainable Pre-Verification', desc: 'Tesseract OCR, Laplacian quality checks, and demographic matching evaluate consistency and highlight exceptions.' },
            { step: '03', title: 'Officer Workbench Review', desc: 'Verification officer inspects evidence side-by-side, initiates structured corrections, or advances the case.' },
            { step: '04', title: 'Verification Interview Gate', desc: 'Citizen completes 5 dynamically grounded statutory confirmation questions via video/audio or accessible text.' },
            { step: '05', title: 'Statutory Determination', desc: 'Senior officer reviews interview consistency and issues digitally signed certificates or formal decision notices.' },
            { step: '06', title: 'Civic Redressal & Support', desc: 'Citizens can lodge tracked grievances with multi-tier escalation, bounded reconsideration, and real-time SLAs.' },
          ].map((item) => (
            <div key={item.step} className="card p-5 space-y-2.5 bg-white dark:bg-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-lg border border-teal-200 dark:border-teal-800">
                  STAGE {item.step}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm m-0">{item.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed m-0">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Platform Capabilities</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 m-0">
            Enterprise Civic Technology Architecture
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm m-0">
            12 integrated modules designed for institutional trust, compliance, security, and operational throughput.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CORE_CAPABILITIES.map((cap) => (
            <div key={cap.title} className="card p-5 space-y-2.5 hover:border-teal-500 transition">
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 w-fit">
                <Icon name={cap.icon} size={18} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm m-0">{cap.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed m-0">{cap.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Grounded FAQ & Civic Support */}
      <section id="support" className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Support & FAQ</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 m-0">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm m-0">
            Everything you need to know about SevaSetu governance, verification mechanisms, and case management.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 text-left font-bold text-slate-900 dark:text-slate-100 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition focus:outline-none"
              >
                <span className="text-xs sm:text-sm">{faq.q}</span>
                <span className="text-teal-600 dark:text-teal-400 text-base ml-3">
                  {activeFaq === idx ? '−' : '+'}
                </span>
              </button>
              {activeFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="bg-gradient-to-r from-teal-900 to-emerald-900 text-white rounded-3xl p-8 sm:p-10 text-center space-y-4 shadow-xl border border-teal-700/40">
        <h2 className="text-xl sm:text-3xl font-extrabold m-0 text-white">
          Ready to Modernize Civic Verification?
        </h2>
        <p className="text-teal-100 text-xs sm:text-sm max-w-xl mx-auto m-0 leading-relaxed">
          Experience the accountable, human-in-the-loop civic technology platform.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/"
            className="btn btn-primary btn-sm font-bold bg-white text-teal-900 hover:bg-slate-100 shadow"
          >
            Start Citizen Application
          </Link>
          <Link
            to="/officer-queue"
            className="btn btn-secondary btn-sm font-bold text-white border-white/30 hover:bg-white/10"
          >
            Staff Workbench
          </Link>
        </div>
      </section>
    </div>
  )
}
