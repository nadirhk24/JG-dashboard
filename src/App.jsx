import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import DashboardCentreAppel from './pages/DashboardCentreAppel'
import DashboardMarketing from './pages/DashboardMarketing'
import Conseilleres from './pages/Conseilleres'
import Objectifs from './pages/Objectifs'
import Calendrier from './pages/Calendrier'
import Responsables from './pages/Responsables'
import Commerciaux from './pages/Commerciaux'
import FluxRDV from './pages/FluxRDV'
import AnalyseCV from './pages/AnalyseCV'
import GestionUsers from './pages/GestionUsers'
import Login from './pages/Login'
import { supabase } from './lib/supabase'
import BulleNotes from './components/BulleNotes'
import { AuthProvider, useAuth } from './context/AuthContext'


// Composant qui bloque l'accès si permission manquante
function ProtectedRoute({ permKey, children }) {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'
  if (isSuperAdmin) return children
  if (!permKey) return children
  if (profil?.permissions?.[permKey] === true) return children
  return <Navigate to="/centre-appel" replace />
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F8F7F4' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '3px solid #E8D5A3', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
        <p style={{ color: '#5A5A5A', fontSize: 13 }}>Chargement...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function AppContent() {
  const { user, loading: authLoading } = useAuth()
  const [conseilleres, setConseilleres] = useState([])
  const [saisies, setSaisies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: cons }, { data: sais }] = await Promise.all([
        supabase.from('conseilleres').select('*').order('nom'),
        supabase.from('saisies').select('*').order('date', { ascending: false })
      ])
      setConseilleres(cons || [])
      setSaisies(sais || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  // 1. Auth en cours de vérification
  if (authLoading) return <Spinner />

  // 2. Non connecté → Login
  if (!user) {
    return (
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    )
  }

  // 3. Connecté → app normale
  const sharedProps = { conseilleres, saisies, reload: loadData }

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ marginLeft: 'var(--sidebar-width)', flex: 1, padding: '32px', minWidth: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, border: '3px solid #E8D5A3', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
                <p style={{ color: '#5A5A5A', fontSize: 13 }}>Chargement...</p>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/centre-appel" />} />
              <Route path="/centre-appel" element={<ProtectedRoute permKey="centre_appel"><DashboardCentreAppel {...sharedProps} /></ProtectedRoute>} />
              <Route path="/marketing" element={<ProtectedRoute permKey="marketing"><DashboardMarketing /></ProtectedRoute>} />
              <Route path="/objectifs" element={<ProtectedRoute permKey="objectifs"><Objectifs conseilleres={conseilleres} /></ProtectedRoute>} />
              <Route path="/conseilleres" element={<ProtectedRoute permKey="conseilleres"><Conseilleres {...sharedProps} /></ProtectedRoute>} />
              <Route path="/calendrier" element={<ProtectedRoute permKey="calendrier"><Calendrier /></ProtectedRoute>} />
              <Route path="/responsables" element={<ProtectedRoute permKey="conseilleres"><Responsables /></ProtectedRoute>} />
              <Route path="/commerciaux" element={<ProtectedRoute permKey="commerciaux"><Commerciaux /></ProtectedRoute>} />
              <Route path="/flux-rdv" element={<ProtectedRoute permKey="flux_rdv"><FluxRDV conseilleres={conseilleres} /></ProtectedRoute>} />
              <Route path="/analyse-cv" element={<ProtectedRoute permKey="analyse_cv"><AnalyseCV {...sharedProps} /></ProtectedRoute>} />
              <Route path="/gestion-users" element={<ProtectedRoute permKey="gestion_users"><GestionUsers /></ProtectedRoute>} />
            </Routes>
          )}
        </main>
      </div>
      <BulleNotes />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}