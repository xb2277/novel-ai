import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import AdminPage from './pages/AdminPage'
import { restoreSession } from './services/authService'

// Restore existing session before rendering
restoreSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
