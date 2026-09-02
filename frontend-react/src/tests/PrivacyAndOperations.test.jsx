import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../context/LanguageContext'
import { AuthProvider } from '../context/AuthContext'
import PrivacyConsentCenter from '../pages/PrivacyConsentCenter'
import AdminOperations from '../pages/AdminOperations'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  API_BASE_URL: 'http://localhost:8000',
  api: {
    getPrivacyPolicy: vi.fn(),
    getMyConsents: vi.fn(),
    recordConsent: vi.fn(),
    withdrawConsent: vi.fn(),
    getSystemHealth: vi.fn(),
    getOperationsMetrics: vi.fn(),
    verifyIdentitySandbox: vi.fn(),
  },
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('Privacy & System Operations Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders PrivacyConsentCenter and displays AI safety boundaries and policy categories', async () => {
    api.getPrivacyPolicy.mockResolvedValueOnce({
      data: {
        policy_version: '2026.1',
        statutory_principle: 'AI assists verification. Final statutory decisions remain with authorized officers.',
        what_we_collect: [
          { category: 'Identity & Profile', items: ['Citizen name', 'Date of birth'] },
        ],
        why_we_collect: ['Statutory verification of civic service eligibility'],
        who_can_access: ['The authenticated citizen', 'Designated Verification Officers'],
        ai_scope_and_boundaries: {
          what_ai_does: ['Extracts machine-readable text via OCR'],
          what_ai_never_does: ['Does NOT make final statutory approval or rejection decisions'],
        },
      },
    })
    api.getMyConsents.mockResolvedValueOnce({
      data: {
        citizen_id: 'cit-1',
        consents: [
          {
            purpose: 'APPLICATION_PROCESSING',
            title: 'Application Data Processing',
            description: 'Statutory review',
            is_required: true,
            is_granted: true,
          },
          {
            purpose: 'NOTIFICATIONS',
            title: 'Lifecycle Communications & Status Alerts',
            description: 'Status updates',
            is_required: false,
            is_granted: true,
          },
        ],
      },
    })

    render(
      <MemoryRouter>
        <LanguageProvider>
          <PrivacyConsentCenter />
        </LanguageProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Privacy & Citizen Data Governance/i)).toBeInTheDocument()
      expect(screen.getAllByText(/AI assists verification. Final statutory decisions remain with authorized officers./i)[0]).toBeInTheDocument()
      expect(screen.getByText(/What We Collect/i)).toBeInTheDocument()
      expect(screen.getByText(/AI Scope/i)).toBeInTheDocument()
      expect(screen.getByText(/Does NOT make final statutory approval or rejection decisions/i)).toBeInTheDocument()
    })
  })

  it('renders AdminOperations with live subsystem health and real metrics', async () => {
    api.getSystemHealth.mockResolvedValueOnce({
      data: {
        status: 'HEALTHY',
        subsystems: {
          api_server: { status: 'HEALTHY', protocol: 'HTTP/REST', version: '1.1.1' },
          database: { status: 'HEALTHY', engine: 'PostgreSQL', latency_ms: 1.2 },
          audit_ledger: { status: 'HEALTHY', algorithm: 'SHA-256 Hash Chain' },
        },
      },
    })
    api.getOperationsMetrics.mockResolvedValueOnce({
      data: {
        applications: {
          total: 42,
          pending_officer_review: 12,
          interviews_pending: 5,
          corrections_pending: 3,
          final_statutory_review: 4,
          approved: 15,
          rejected: 3,
        },
        sla_performance: {
          normal: 35,
          approaching_deadline: 5,
          overdue: 2,
        },
        grievances: {
          total: 8,
          open: 2,
          under_investigation: 3,
          escalated: 1,
          resolved: 2,
          closed: 0,
        },
      },
    })

    render(
      <MemoryRouter>
        <LanguageProvider>
          <AdminOperations />
        </LanguageProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/System Operations & Live Health/i)).toBeInTheDocument()
      expect(screen.getByText(/Subsystem/i)).toBeInTheDocument()
      expect(screen.getByText(/Application Pipeline Workload/i)).toBeInTheDocument()
      expect(screen.getByText(/42/)).toBeInTheDocument()
      expect(screen.getByText(/Total Received/i)).toBeInTheDocument()
    })
  })

  it('executes sandbox identity verification in AdminOperations', async () => {
    api.getSystemHealth.mockResolvedValueOnce({ data: { status: 'HEALTHY', subsystems: {} } })
    api.getOperationsMetrics.mockResolvedValueOnce({ data: { applications: { total: 0 }, sla_performance: {}, grievances: {} } })
    api.verifyIdentitySandbox.mockResolvedValueOnce({
      data: {
        provider: 'SevaSetu Sandbox Identity Gateway',
        is_verified: true,
        status: 'SANDBOX_VERIFIED',
        confidence: 0.95,
        disclaimer: 'Evaluation performed via local sandbox gateway.',
        discrepancies: [],
      },
    })

    render(
      <MemoryRouter>
        <LanguageProvider>
          <AdminOperations />
        </LanguageProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Decoupled Integration Gateway/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Evaluate Format/i }))

    await waitFor(() => {
      expect(api.verifyIdentitySandbox).toHaveBeenCalledWith({
        name: 'Aarav Sharma',
        dob: '1990-05-12',
        document_number: '1234 5678 9012',
      })
      expect(screen.getByText(/Evaluation performed via local sandbox gateway./i)).toBeInTheDocument()
    })
  })
})
