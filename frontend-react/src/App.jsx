import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import CitizenHome from './pages/CitizenHome'
import CitizenUpload from './pages/CitizenUpload'
import ApplicationBuilder from './pages/ApplicationBuilder'
import EligibilityGuidance from './pages/EligibilityGuidance'
import CitizenProfile from './pages/CitizenProfile'
import VerificationInterview from './pages/VerificationInterview'
import NotificationCenter from './pages/NotificationCenter'
import CheckStatus from './pages/CheckStatus'
import AskQuestion from './pages/AskQuestion'
import Feedback from './pages/Feedback'
import OfficerQueue from './pages/OfficerQueue'
import OfficerDashboard from './pages/OfficerDashboard'
import AdminSettings from './pages/AdminSettings'
import ManageStaff from './pages/ManageStaff'
import CitizenGrievances from './pages/CitizenGrievances'
import GrievanceDetails from './pages/GrievanceDetails'
import OfficerGrievanceQueue from './pages/OfficerGrievanceQueue'
import GrievanceReview from './pages/GrievanceReview'
import PrivacyConsentCenter from './pages/PrivacyConsentCenter'
import AdminOperations from './pages/AdminOperations'
import AboutProduct from './pages/AboutProduct'
import ImpactDashboard from './pages/ImpactDashboard'
import CertificateVerification from './pages/CertificateVerification'
import ExecutiveCommandCenter from './pages/ExecutiveCommandCenter'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Layout>
              <Routes>
                <Route path="/" element={<CitizenHome />} />
                <Route path="/apply" element={<CitizenUpload />} />
                <Route path="/apply-wizard" element={<ApplicationBuilder />} />
                <Route path="/eligibility" element={<EligibilityGuidance />} />
                <Route path="/profile" element={<CitizenProfile />} />
                <Route path="/wallet" element={<Navigate to="/apply-wizard" replace />} />
                <Route path="/verification-interview" element={<VerificationInterview />} />
                <Route path="/notifications" element={<NotificationCenter />} />
                <Route path="/status" element={<CheckStatus />} />
                <Route path="/verify" element={<CertificateVerification />} />
                <Route path="/grievances" element={<CitizenGrievances />} />
                <Route path="/grievances/:id" element={<GrievanceDetails />} />
                <Route path="/privacy" element={<PrivacyConsentCenter />} />
                <Route path="/operations" element={<AdminOperations />} />
                <Route path="/admin-operations" element={<AdminOperations />} />
                <Route path="/command-center" element={<ExecutiveCommandCenter />} />
                <Route path="/ask" element={<AskQuestion />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/officer-queue" element={<OfficerQueue />} />
                <Route path="/queue" element={<OfficerQueue />} />
                <Route path="/officer-grievance-queue" element={<OfficerGrievanceQueue />} />
                <Route path="/officer/grievances/:id" element={<GrievanceReview />} />
                <Route path="/officer-dashboard" element={<OfficerDashboard />} />
                <Route path="/dashboard" element={<OfficerDashboard />} />
                <Route path="/about" element={<AboutProduct />} />
                <Route path="/support" element={<AboutProduct />} />
                <Route path="/impact" element={<ImpactDashboard />} />
                <Route path="/admin-settings" element={<AdminSettings />} />
                <Route path="/manage-staff" element={<ManageStaff />} />
                <Route path="/staff" element={<ManageStaff />} />
                <Route path="/audit" element={<CheckStatus />} />
              </Routes>
            </Layout>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}
