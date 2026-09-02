import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import VerificationResultsView from '../components/VerificationResultsView'

describe('VerificationResultsView Comprehensive Verification UI Tests', () => {
  const sampleMismatchResult = {
    application_id: 'app-abc12345',
    citizen_name: 'Bhavy Garg',
    service_type: 'passport',
    status: 'NEEDS_CORRECTION',
    readiness_score: 55,
    risk_level: 'HIGH',
    risk_factors: ['Document mismatch in Aadhaar slot'],
    is_fast_track: false,
    average_ocr_confidence: 93.5,
    estimated_delay_days: 5,
    recommendation: 'Your Aadhaar slot contains a Birth Certificate. Please upload a valid Aadhaar document.',
    correction_reason: 'Document Type Mismatch in Aadhaar Card slot',
    correction_details: 'The document uploaded in the Aadhaar Card slot appears to be a Birth Certificate. Please upload a valid Aadhaar Card.',
    tracking_token: 'token-secret-1234567890abcdef',
    score_reasoning: [
      { points: 100, label: 'Base statutory application score' },
      { points: -30, label: 'Aadhaar slot document type mismatch' },
      { points: -15, label: 'Address mismatch across documents' },
    ],
    field_checks: [
      { field: 'name', status: 'pass', detail: 'Matches across all uploaded documents' },
      { field: 'date_of_birth', status: 'pass', detail: 'Consistent DOB detected' },
      { field: 'address', status: 'fail', detail: 'Aadhaar lists "Sector 14", Utility Bill lists "Sector 18"' },
    ],
    document_verifications: [
      {
        expected_type: 'aadhaar',
        detected_type: 'birth_certificate',
        confidence: 0.94,
        status: 'MISMATCH',
        is_valid_for_slot: false,
      },
      {
        expected_type: 'proof_of_address',
        detected_type: 'electricity_bill',
        confidence: 0.91,
        status: 'MATCH',
        is_valid_for_slot: true,
      },
    ],
    missing_documents: ['annexure_e'],
  }

  it('renders readiness score, review risk, and OCR confidence from backend', () => {
    render(
      <BrowserRouter>
        <VerificationResultsView result={sampleMismatchResult} />
      </BrowserRouter>
    )

    // Score & Risk
    expect(screen.getByText('55%')).toBeInTheDocument()
    expect(screen.getByText(/Review Risk: HIGH/i)).toBeInTheDocument()
    expect(screen.getByText(/OCR Confidence: 93.5%/i)).toBeInTheDocument()
    expect(screen.getByText(/Application Reference ID/i)).toBeInTheDocument()
    expect(screen.getByText('app-abc12345')).toBeInTheDocument()
    expect(screen.getAllByText('NEEDS_CORRECTION')[0]).toBeInTheDocument()
  })

  it('displays document classification status with MISMATCH and MATCH badges', () => {
    render(
      <BrowserRouter>
        <VerificationResultsView result={sampleMismatchResult} />
      </BrowserRouter>
    )

    expect(screen.getByText('Aadhaar Card')).toBeInTheDocument()
    expect(screen.getAllByText('MISMATCH')[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Birth Certificate/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText('MATCH')[0]).toBeInTheDocument()
    expect(screen.getByText('94%')).toBeInTheDocument()
  })

  it('displays cross-document consistency comparisons and missing documents', () => {
    render(
      <BrowserRouter>
        <VerificationResultsView result={sampleMismatchResult} />
      </BrowserRouter>
    )

    // Demographic checks
    expect(screen.getByText('Matches across all uploaded documents')).toBeInTheDocument()
    expect(screen.getByText(/Aadhaar lists "Sector 14"/i)).toBeInTheDocument()

    // Missing documents
    expect(screen.getByText(/Missing Required Documents/i)).toBeInTheDocument()
    expect(screen.getByText(/ANNEXURE E/i)).toBeInTheDocument()
  })

  it('displays score deduction breakdown ledger with points', () => {
    render(
      <BrowserRouter>
        <VerificationResultsView result={sampleMismatchResult} />
      </BrowserRouter>
    )

    expect(screen.getByText('Base statutory application score')).toBeInTheDocument()
    expect(screen.getByText('+100')).toBeInTheDocument()
    expect(screen.getByText('Aadhaar slot document type mismatch')).toBeInTheDocument()
    expect(screen.getByText('-30')).toBeInTheDocument()
  })

  it('displays 4-part civic correction guidance when in NEEDS_CORRECTION state', () => {
    render(
      <BrowserRouter>
        <VerificationResultsView result={sampleMismatchResult} />
      </BrowserRouter>
    )

    expect(screen.getByText(/1. WHAT IS WRONG:/i)).toBeInTheDocument()
    expect(screen.getByText(/2. WHY IT MATTERS:/i)).toBeInTheDocument()
    expect(screen.getByText(/3. WHAT TO UPLOAD:/i)).toBeInTheDocument()
    expect(screen.getByText(/4. WHAT HAPPENS NEXT:/i)).toBeInTheDocument()
  })

  it('gates interview when application is in READY_FOR_REVIEW and does NOT show interview button', () => {
    const readyResult = {
      ...sampleMismatchResult,
      status: 'READY_FOR_REVIEW',
      readiness_score: 85,
      risk_level: 'LOW',
      document_verifications: [
        { expected_type: 'aadhaar', detected_type: 'aadhaar', confidence: 0.98, status: 'MATCH', is_valid_for_slot: true },
      ],
      missing_documents: [],
    }

    render(
      <BrowserRouter>
        <VerificationResultsView result={readyResult} />
      </BrowserRouter>
    )

    expect(screen.getByText(/awaiting officer document review/i)).toBeInTheDocument()
    expect(screen.queryByText(/Start Verification Interview/i)).not.toBeInTheDocument()
  })

  it('enables and displays Start Verification Interview button ONLY when status is INTERVIEW_ELIGIBLE', () => {
    const eligibleResult = {
      ...sampleMismatchResult,
      status: 'INTERVIEW_ELIGIBLE',
      readiness_score: 95,
      risk_level: 'LOW',
      document_verifications: [
        { expected_type: 'aadhaar', detected_type: 'aadhaar', confidence: 0.98, status: 'MATCH', is_valid_for_slot: true },
      ],
      missing_documents: [],
    }

    render(
      <BrowserRouter>
        <VerificationResultsView result={eligibleResult} />
      </BrowserRouter>
    )

    expect(screen.getByText(/Document Review Passed!/i)).toBeInTheDocument()
    const interviewBtn = screen.getByText(/Start Verification Interview/i)
    expect(interviewBtn).toBeInTheDocument()
  })
})
