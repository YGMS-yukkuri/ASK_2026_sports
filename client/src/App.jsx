import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import MainPage from './pages/MainPage'
import AdminPage from './pages/AdminPage'
import Navigation from './components/Navigation'
import OnboardingOverlay from './components/OnboardingOverlay'
import HelpGuide from './components/HelpGuide'

function App() {
  const [deviceId, setDeviceId] = useState(null)
  const [showPostModal, setShowPostModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    // Initialize device ID
    let id = localStorage.getItem('device_id')
    if (!id) {
      id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      localStorage.setItem('device_id', id)
    }
    setDeviceId(id)

    // Show onboarding on first visit
    if (!localStorage.getItem('onboarding_done')) {
      setShowOnboarding(true)
    }
  }, [])

  function handleCloseOnboarding() {
    localStorage.setItem('onboarding_done', '1')
    setShowOnboarding(false)
  }

  if (!deviceId) return <div>Loading...</div>

  return (
    <Router>
      <div className="app">
        <Navigation
          onPostClick={() => setShowPostModal(true)}
          onHelpClick={() => setShowHelp(true)}
        />
        <main className="app-content">
          <Routes>
            <Route
              path="/"
              element={
                <MainPage
                  deviceId={deviceId}
                  showPostModal={showPostModal}
                  onCloseModal={() => setShowPostModal(false)}
                />
              }
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        {showOnboarding && (
          <OnboardingOverlay
            onClose={handleCloseOnboarding}
            onPostClick={() => setShowPostModal(true)}
          />
        )}
        {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}
      </div>
    </Router>
  )
}

export default App
