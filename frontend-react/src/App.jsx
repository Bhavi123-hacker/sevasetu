import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import CitizenUpload from './pages/CitizenUpload'
import ComingSoon from './pages/ComingSoon'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<CitizenUpload />} />
            <Route path="/status" element={<ComingSoon pageName="Check Status" />} />
            <Route path="/ask" element={<ComingSoon pageName="Ask a Question" />} />
            <Route path="/feedback" element={<ComingSoon pageName="Feedback" />} />
            <Route path="/staff" element={<ComingSoon pageName="Officer / Administrator" />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  )
}
