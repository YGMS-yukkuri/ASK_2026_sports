import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import MainPage from './pages/MainPage'
import AdminPage from './pages/AdminPage'
import Navigation from './components/Navigation'

function App() {
  const [deviceId, setDeviceId] = useState(null)
  const [showPostModal, setShowPostModal] = useState(false)

  useEffect(() => {
    // Initialize device ID
    let id = localStorage.getItem('device_id')
    if (!id) {
      id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      localStorage.setItem('device_id', id)
    }
    setDeviceId(id)
  }, [])

  if (!deviceId) return <div>Loading...</div>

  return (
    <Router>
      <div className="app">
        <Navigation onPostClick={() => setShowPostModal(true)} />
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
      </div>
    </Router>
  )
}

export default App
