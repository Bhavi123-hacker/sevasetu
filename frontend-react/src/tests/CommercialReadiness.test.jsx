import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AboutProduct from '../pages/AboutProduct'
import ImpactDashboard from '../pages/ImpactDashboard'
import client from '../api/client'

vi.mock('../api/client', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
    },
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiPatch: vi.fn(),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AboutProduct Page', () => {
  it('renders hero, statutory principle, problem section, and core capabilities', () => {
    render(
      <MemoryRouter>
        <AboutProduct />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1, name: /sevasetu/i })).toBeInTheDocument()
    expect(screen.getByText(/AI assists verification. Final statutory decisions remain with authorized officers/i)).toBeInTheDocument()
    expect(screen.getByText(/Operational Challenges in Public Service Intake/i)).toBeInTheDocument()
    expect(screen.getByText(/Document Intelligence/i)).toBeInTheDocument()
    expect(screen.getByText(/Human-in-the-Loop Verification/i)).toBeInTheDocument()
  })

  it('toggles grounded FAQ item on click', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AboutProduct />
      </MemoryRouter>
    )

    const faqButton = screen.getByRole('button', { name: /what role does ai play in sevasetu/i })
    expect(faqButton).toBeInTheDocument()

    // Click to open
    await user.click(faqButton)
    expect(await screen.findByText(/AI functions exclusively as an explainable decision-support assistant/i)).toBeInTheDocument()

    // Click to close
    await user.click(faqButton)
    expect(screen.queryByText(/AI functions exclusively as an explainable decision-support assistant/i)).not.toBeInTheDocument()
  })
})

describe('ImpactDashboard Page', () => {
  it('renders live operational impact metrics from backend API', async () => {
    const { apiGet } = await import('../api/client')
    apiGet.mockResolvedValueOnce({
      metadata: {
        data_freshness: '2026-09-01T12:00:00Z',
        data_source: 'Live Relational Database Ledger',
        total_sample_records: 42,
      },
      applications: {
        total_received: 10,
        completed: 6,
        approved: 5,
        rejected: 1,
        pending_officer_review: 2,
        interviews_pending: 1,
        corrections_pending: 1,
        final_statutory_review: 0,
      },
      performance: {
        average_duration_hours: 1.5,
        median_duration_hours: 1.2,
        sla_compliance_pct: 100,
        sla_normal: 10,
        sla_approaching: 0,
        sla_overdue: 0,
      },
      documents: {
        total_processed: 30,
        requiring_correction: 2,
        average_documents_per_case: 3.0,
        classification_distribution: { aadhaar: 10, ration_card: 10, income_proof: 10 },
      },
      officers: {
        active_officers: 2,
        assigned_workload: 3,
        unassigned_backlog: 1,
      },
      interviews: {
        started: 5,
        completed: 5,
        completion_rate_pct: 100,
      },
      grievances: {
        total: 4,
        open: 1,
        under_review: 1,
        escalated: 0,
        resolved: 2,
        closed: 0,
        reopened: 0,
        resolution_rate_pct: 100,
      },
      citizen_experience: {
        total_feedback: 8,
        average_rating: 4.8,
        sentiment_distribution: { positive: 7, neutral: 1, negative: 0 },
        category_distribution: { EASE_OF_APPLICATION: 8 },
      },
    })

    render(
      <MemoryRouter>
        <ImpactDashboard />
      </MemoryRouter>
    )

    expect(await screen.findByText(/Operational Impact & Metrics/i)).toBeInTheDocument()
    expect(screen.getByText(/Live Relational Telemetry/i)).toBeInTheDocument()
    expect(screen.getAllByText('10').length).toBeGreaterThan(0) // total applications & breakdown
    expect(screen.getAllByText(/100%/i).length).toBeGreaterThan(0) // SLA compliance & grievance resolution
  })
})
