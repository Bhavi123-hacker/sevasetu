import axios from 'axios'

// Vite exposes env vars prefixed VITE_ to the browser bundle.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const client = axios.create({ baseURL: API_BASE_URL, timeout: 15000 })

// Every request automatically gets the active token matching current role, with graceful fallback
client.interceptors.request.use((config) => {
  const staffToken = localStorage.getItem('sevasetu_staff_token')
  const citizenToken = localStorage.getItem('sevasetu_citizen_token')
  const activeRole = localStorage.getItem('sevasetu_active_role')

  const token = activeRole === 'citizen'
    ? (citizenToken || staffToken)
    : (staffToken || citizenToken)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Civic Platform API Helper Methods

export const api = {
  // Citizen Authentication & Profile
  citizenFirebasePhoneLogin: (idToken, citizenName = null) => client.post('/api/auth/firebase-phone', { id_token: idToken, citizen_name: citizenName }),
  citizenSendOtp: (phoneNumber) => client.post('/api/auth/citizen/send-otp', { phone_number: phoneNumber }),
  citizenVerifyOtp: (phoneNumber, otp, citizenName = null) => client.post('/api/auth/citizen/verify-otp', { phone_number: phoneNumber, otp, citizen_name: citizenName }),
  citizenRegister: (data) => client.post('/api/auth/citizen/register', data),
  citizenLogin: (data) => client.post('/api/auth/citizen/login', data),
  citizenMe: () => client.get('/api/auth/citizen/me'),
  getCitizenApplications: () => client.get('/api/citizen/applications'),

  // Services & Eligibility
  getServices: () => client.get('/api/services'),
  getServicesProvenance: () => client.get('/api/services-provenance'),
  getServiceProvenance: (serviceId) => client.get(`/api/services/${serviceId}/provenance`),
  getServiceChecklist: (serviceId) => client.get(`/api/services/${serviceId}/checklist`),
  checkEligibility: (serviceId, criteria) => client.post(`/api/services/${serviceId}/check-eligibility`, { criteria }),
  getPassportQuestionnaire: () => client.get('/api/services/passport/questionnaire'),
  evaluatePassportRequirements: (answers) => client.post('/api/services/passport/evaluate-requirements', answers),

  // Citizen Profile & Phone Verification
  getProfile: (profileId) => client.get('/api/profile', { params: profileId ? { profile_id: profileId } : {} }),
  updateProfile: (data) => client.put('/api/profile', data),
  sendPhoneOtp: (phone_number, profile_id) => client.post('/api/profile/phone/send-otp', { phone_number, profile_id }),
  verifyPhoneOtp: (phone_number, otp, profile_id) => client.post('/api/profile/phone/verify-otp', { phone_number, otp, profile_id }),
  clearPhoneVerification: (profile_id) => client.delete('/api/profile/phone', { params: profile_id ? { profile_id } : {} }),

  // Notification Preferences
  getNotificationPreferences: (profile_id) => client.get('/api/notification-preferences', { params: profile_id ? { profile_id } : {} }),
  updateNotificationPreferences: (data) => client.put('/api/notification-preferences', data),

  // Document Wallet
  getWallet: (profileId) => client.get('/api/wallet', { params: profileId ? { profile_id: profileId } : {} }),
  uploadWalletDoc: (formData) => client.post('/api/wallet/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteWalletDoc: (walletId) => client.delete(`/api/wallet/${walletId}`),

  // AI Verification Interview
  startInterview: (data) => client.post('/api/interviews/start', data),
  getInterview: (sessionId) => client.get(`/api/interviews/${sessionId}`),
  answerInterview: (sessionId, data) => client.post(`/api/interviews/${sessionId}/answer`, data),
  completeInterview: (sessionId) => client.post(`/api/interviews/${sessionId}/complete`),

  // MFA & OTP Confirmation
  sendOtp: (destination, channel = 'SMS') => client.post('/api/mfa/send-otp', { destination, channel }),
  verifyOtp: (destination, code) => client.post('/api/mfa/verify-otp', { destination, code }),

  // Notifications
  getNotifications: (recipient = 'citizen', profile_id = null) => client.get('/api/notifications', { params: { recipient, ...(profile_id ? { citizen_profile_id: profile_id } : {}) } }),
  getUnreadNotificationCount: (recipient = 'citizen', profile_id = null) => client.get('/api/notifications/unread-count', { params: { recipient, ...(profile_id ? { citizen_profile_id: profile_id } : {}) } }),
  markNotificationRead: (notifId) => client.post(`/api/notifications/${notifId}/read`),
  markAllNotificationsRead: (recipient = 'citizen', profile_id = null) => client.post('/api/notifications/read-all', null, { params: { recipient, ...(profile_id ? { citizen_profile_id: profile_id } : {}) } }),

  // Applications Workflow
  submitApplication: (formData) => client.post('/api/applications', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getApplication: (appId, token) => client.get(`/api/applications/${appId}`, {
    params: token ? { token } : {},
    headers: token ? { 'X-Tracking-Token': token } : {},
  }),
  resubmitApplication: (appId, formData, token) => client.post(`/api/applications/${appId}/resubmit`, formData, {
    params: token ? { token } : {},
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { 'X-Tracking-Token': token } : {}),
    },
  }),
  requestCorrection: (appId, data) => client.post(`/api/applications/${appId}/request-correction`, data),
  passDocumentReview: (appId, data) => client.post(`/api/applications/${appId}/document-review-pass`, data),
  approveApplication: (appId, data) => client.post(`/api/applications/${appId}/approve`, data),
  rejectApplication: (appId, data) => client.post(`/api/applications/${appId}/reject`, data),
  assignOfficer: (appId, data) => client.post(`/api/applications/${appId}/assign`, data),
  getDocumentVersions: (appId, docType) => client.get(`/api/applications/${appId}/documents/${docType}/versions`),
  downloadDocument: (docId) => client.get(`/api/documents/${docId}/download`),
  getApplications: (params) => client.get('/api/applications', { params }),
  getDashboardStats: () => client.get('/api/analytics/dashboard'),
  getDashboardMetrics: () => client.get('/api/officer/dashboard-metrics'),
  getAuditTrail: (appId) => client.get(`/api/applications/${appId}/audit`),
  getSystemAuditTrail: (params) => client.get('/api/audit-trail', { params }),
  getApplicationHistory: (appId) => client.get(`/api/applications/${appId}/history`),

  // Civic Grievance & Escalation
  createGrievance: (formData) => client.post('/api/grievances', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  listGrievances: (params) => client.get('/api/grievances', { params }),
  getGrievanceDetails: (id) => client.get(`/api/grievances/${id}`),
  getGrievanceHistory: (id) => client.get(`/api/grievances/${id}/history`),
  acknowledgeGrievance: (id) => client.post(`/api/grievances/${id}/acknowledge`),
  assignGrievance: (id, data) => client.post(`/api/grievances/${id}/assign`, data),
  startGrievanceReview: (id) => client.post(`/api/grievances/${id}/start-review`),
  requestGrievanceInformation: (id, data) => client.post(`/api/grievances/${id}/request-information`, data),
  respondToGrievance: (id, data) => client.post(`/api/grievances/${id}/respond`, data),
  addGrievanceInternalNote: (id, data) => client.post(`/api/grievances/${id}/internal-note`, data),
  escalateGrievance: (id, data) => client.post(`/api/grievances/${id}/escalate`, data),
  resolveGrievance: (id, data) => client.post(`/api/grievances/${id}/resolve`, data),
  reopenGrievance: (id, data) => client.post(`/api/grievances/${id}/reopen`, data),
  closeGrievance: (id, data) => client.post(`/api/grievances/${id}/close`, data),
  getApplicationGrievances: (applicationId, token) => client.get(`/api/applications/${applicationId}/grievances`, {
    params: token ? { token } : {},
    headers: token ? { 'X-Tracking-Token': token } : {},
  }),

  // Privacy & Consent Governance
  getPrivacyPolicy: () => client.get('/api/privacy/policy'),
  getMyConsents: () => client.get('/api/privacy/consents'),
  recordConsent: (data) => client.post('/api/privacy/consents', data),
  withdrawConsent: (data) => client.post('/api/privacy/consents/withdraw', data),

  // System Operations & Monitoring
  getSystemHealth: () => client.get('/api/operations/system-health'),
  getOperationsMetrics: () => client.get('/api/operations/metrics'),
  getImpactMetrics: () => client.get('/api/impact/metrics'),
  getCommandCenterMetrics: (params) => client.get('/api/command-center/metrics', { params }),
  getIntegrationStatus: () => client.get('/api/integration/status'),

  // Decoupled Integration Sandbox
  verifyIdentitySandbox: (data) => client.post('/api/integration/identity-verify', data),

  // Certificate Public Verification
  verifyCertificate: (certificateId) => client.get(`/api/public/verify-certificate/${encodeURIComponent(certificateId)}`),
}

export const apiGet = async (url, config) => (await client.get(url, config)).data
export const apiPost = async (url, data, config) => (await client.post(url, data, config)).data
export const apiPut = async (url, data, config) => (await client.put(url, data, config)).data
export const apiPatch = async (url, data, config) => (await client.patch(url, data, config)).data

export default client
