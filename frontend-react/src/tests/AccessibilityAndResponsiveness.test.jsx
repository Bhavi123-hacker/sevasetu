import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CitizenAuthModal from '../components/CitizenAuthModal'
import CitizenApplicationTimeline from '../components/CitizenApplicationTimeline'
import { LanguageProvider } from '../context/LanguageContext'
import { BrowserRouter } from 'react-router-dom'
import client from '../api/client'

vi.mock('../api/client')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Accessibility & Responsive UI Audit Tests', () => {
  it('CitizenAuthModal has correct dialog role, aria attributes, and closes on Escape key', () => {
    const handleClose = vi.fn()
    render(
      <LanguageProvider>
        <CitizenAuthModal isOpen={true} onClose={handleClose} />
      </LanguageProvider>
    )

    // Check ARIA attributes
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'citizen-auth-title')

    // Check accessible close button
    const closeBtn = screen.getByLabelText(/close authentication modal/i)
    expect(closeBtn).toBeInTheDocument()

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('CitizenApplicationTimeline renders accessible milestone progression list', async () => {
    client.get.mockResolvedValueOnce({
      data: {
        application_id: 'SS-2026-TEST',
        current_status: 'READY_FOR_REVIEW',
        timeline: [
          {
            timestamp: '2026-08-30T10:00:00Z',
            title: 'Application Submitted',
            action: 'APPLICATION_SUBMITTED',
            detail: 'Application received and pre-verified.',
            actor_role: 'Citizen',
          },
        ],
      },
    })

    render(
      <BrowserRouter>
        <LanguageProvider>
          <CitizenApplicationTimeline applicationId="SS-2026-TEST" />
        </LanguageProvider>
      </BrowserRouter>
    )

    // Timeline component renders title and milestone
    expect(await screen.findByText(/Application Processing Timeline/i)).toBeInTheDocument()
    expect(await screen.findByText(/Application Submitted/i)).toBeInTheDocument()
    expect(screen.getByText(/1 Recorded Milestones/i)).toBeInTheDocument()
  })
})
