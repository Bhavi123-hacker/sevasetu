import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import CitizenUpload from './pages/CitizenUpload'
import CheckStatus from './pages/CheckStatus'
import AskQuestion from './pages/AskQuestion'
import Feedback from './pages/Feedback'
import OfficerQueue from './pages/OfficerQueue'
import OfficerDashboard from './pages/OfficerDashboard'
import AdminSettings from './pages/AdminSettings'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<CitizenUpload />} />
            <Route path="/status" element={<CheckStatus />} />
            <Route path="/ask" element={<AskQuestion />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/officer-queue" element={<OfficerQueue />} />
            <Route path="/officer-dashboard" element={<OfficerDashboard />} />
            <Route path="/admin-settings" element={<AdminSettings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  )
}
