import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { LanguageProvider } from '../context/LanguageContext'
import CitizenProfile from '../pages/CitizenProfile'
import NotificationCenter from '../pages/NotificationCenter'
import { api } from '../api/client'

// Mock api
vi.mock('../api/client', () => ({
  api: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    sendPhoneOtp: vi.fn(),
    verifyPhoneOtp: vi.fn(),
    clearPhoneVerification: vi.fn(),
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
  },
}))

describe('Citizen Email Verification & Notification Center Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders CitizenProfile with email verification status and notification preferences', async () => {
    api.getProfile.mockResolvedValueOnce({
      data: {
        id: 'prof-test',
        citizen_name: 'Priya Sharma',
        email: 'priya@example.com',
        phone_number: '+91 98765 43210',
        email_verified: false,
      },
    })
    api.getNotificationPreferences.mockResolvedValueOnce({
      data: {
        preferences: {
          application_updates: true,
          correction_requests: true,
          decision_alerts: true,
          interview_reminders: true,
          security_alerts: true,
          email_enabled: true,
        },
      },
    })

    render(
      <BrowserRouter>
        <LanguageProvider>
          <CitizenProfile />
        </LanguageProvider>
      </BrowserRouter>
    )

    expect(await screen.findByText('Account & Email Verification')).toBeInTheDocument()
    expect(screen.getByText(/Email Not Verified/i)).toBeInTheDocument()
    expect(screen.getByText('Demographic Profile')).toBeInTheDocument()
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
  })

  it('saves citizen profile and notification preferences successfully', async () => {
    api.getProfile.mockResolvedValueOnce({
      data: {
        id: 'prof-test',
        citizen_name: 'Priya Sharma',
        email: 'priya@example.com',
        phone_number: '+91 98765 43210',
        email_verified: true,
      },
    })
    api.getNotificationPreferences.mockResolvedValueOnce({
      data: { preferences: { application_updates: true, email_enabled: true } },
    })
    api.updateProfile.mockResolvedValueOnce({ data: { success: true } })
    api.updateNotificationPreferences.mockResolvedValueOnce({ data: { success: true } })

    render(
      <BrowserRouter>
        <LanguageProvider>
          <CitizenProfile />
        </LanguageProvider>
      </BrowserRouter>
    )

    expect(await screen.findByText('Account & Email Verification')).toBeInTheDocument()
    expect(screen.getByText(/Email Verified/i)).toBeInTheDocument()

    const saveProfileBtn = screen.getByText(/Save Profile Data/i)
    fireEvent.click(saveProfileBtn)
    expect(api.updateProfile).toHaveBeenCalled()

    const savePrefsBtn = screen.getByText('Save Notification Preferences')
    fireEvent.click(savePrefsBtn)
    expect(api.updateNotificationPreferences).toHaveBeenCalled()
  })

  it('renders NotificationCenter and marks all notifications read', async () => {
    api.getNotifications.mockResolvedValueOnce({
      data: [
        {
          id: 'notif-1',
          notification_type: 'APPLICATION_SUBMITTED',
          title: 'Application Submitted',
          message: 'Your application has been received.',
          is_read: false,
          created_at: new Date().toISOString(),
          delivery_channel: 'IN_APP',
          delivery_status: 'DELIVERED_IN_APP',
        },
        {
          id: 'notif-2',
          notification_type: 'APPLICATION_APPROVED',
          title: 'Application Approved',
          message: 'Your application has been approved by authorized officer.',
          is_read: false,
          created_at: new Date().toISOString(),
          delivery_channel: 'IN_APP',
          delivery_status: 'DELIVERED_IN_APP',
        },
      ],
    })
    api.markAllNotificationsRead.mockResolvedValueOnce({ data: { updated: 2 } })

    render(
      <BrowserRouter>
        <LanguageProvider>
          <NotificationCenter />
        </LanguageProvider>
      </BrowserRouter>
    )

    expect(await screen.findByText('Notification Center')).toBeInTheDocument()
    expect(screen.getByText('Application Submitted')).toBeInTheDocument()
    expect(screen.getByText('Application Approved')).toBeInTheDocument()

    const markAllBtn = screen.getByText('✓ Mark All Read')
    fireEvent.click(markAllBtn)

    expect(api.markAllNotificationsRead).toHaveBeenCalledWith('citizen')
  })

  it('filters notifications by unread category in NotificationCenter', async () => {
    api.getNotifications.mockResolvedValueOnce({
      data: [
        {
          id: 'notif-1',
          notification_type: 'APPLICATION_SUBMITTED',
          title: 'Application Submitted',
          message: 'Your application has been received.',
          is_read: false,
          created_at: new Date().toISOString(),
          delivery_channel: 'IN_APP',
          delivery_status: 'DELIVERED_IN_APP',
        },
        {
          id: 'notif-2',
          notification_type: 'SECURITY_EVENT',
          title: 'Security Alert',
          message: 'Contact detail updated.',
          is_read: true,
          created_at: new Date().toISOString(),
          delivery_channel: 'IN_APP',
          delivery_status: 'DELIVERED_IN_APP',
        },
      ],
    })

    render(
      <BrowserRouter>
        <LanguageProvider>
          <NotificationCenter />
        </LanguageProvider>
      </BrowserRouter>
    )

    expect(await screen.findByText('Notification Center')).toBeInTheDocument()
    const unreadTab = await screen.findByText(/Unread \(1\)/i)
    fireEvent.click(unreadTab)

    expect(screen.getByText('Application Submitted')).toBeInTheDocument()
    expect(screen.queryByText('Security Alert')).not.toBeInTheDocument()
  })
})
