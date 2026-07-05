import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import DashboardCentreAppel from './pages/DashboardCentreAppel'
import PilotageCC from './pages/PilotageCC'
import QualiteEvaluation from './pages/QualiteEvaluation'
import DashboardMarketing from './pages/DashboardMarketing'
import Conseilleres from './pages/Conseilleres'
import Objectifs from './pages/Objectifs'
import Calendrier from './pages/Calendrier'
import Responsables from './pages/Responsables'
import Commerciaux from './pages/Commerciaux'
import FluxRDV from './pages/FluxRDV'
import PerfCommercial from './pages/PerfCommercial'
import AnalyseCV from './pages/AnalyseCV'
import GestionUsers from './pages/GestionUsers'
import Etudes from './pages/Etudes'
import EtudeCommerciale2026 from './pages/EtudeCommerciale2026'
import ImportAgent from './pages/ImportAgent'
import Login from './pages/Login'
import { supabase } from './lib/supabase'
import BulleNotes from './components/BulleNotes'
import TopBar from './components/TopBar'
import Stock from './pages/Stock'
import Primes from './pages/Primes'
import Passagers from './pages/Passagers'
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
      // Charger conseillères
      const { data: cons } = await supabase.from('conseilleres').select('*').order('nom')

      // Charger saisies — filtre année en cours uniquement, max 5000 lignes
      const currentYear = new Date().getFullYear()
      const dateFrom = `${currentYear}-01-01`
      const dateTo   = `${currentYear}-12-31`

      // Charger saisies journalières (champ date) + saisies période (champ date_debut)
      const [{ data: saisiesJour }, { data: saisiesPeriode }] = await Promise.all([
        supabase.from('saisies').select('*')
          .gte('date', dateFrom).lte('date', dateTo)
          .order('date', { ascending: false }).limit(5000),
        supabase.from('saisies').select('*')
          .gte('date_debut', dateFrom).lte('date_debut', dateTo)
          .order('date_debut', { ascending: false }).limit(1000),
      ])
      // Fusionner et dédupliquer par id
      const seen = new Set()
      let allSaisies = []
      for (const s of [...(saisiesJour || []), ...(saisiesPeriode || [])]) {
        if (!seen.has(s.id)) { seen.add(s.id); allSaisies.push(s) }
      }

      setConseilleres(cons || [])
      setSaisies(allSaisies)
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
  const conseilleresActives = conseilleres.filter(c => c.actif !== false)
  const sharedProps = { conseilleres, conseilleresActives, saisies, reload: loadData }

  return (
    <BrowserRouter>
      <TopBar />
      <div style={{ display: 'flex', minHeight: '100vh', paddingTop: 52 }}>
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
              <Route path="/centre-appel" element={<ProtectedRoute permKey="centre_appel"><DashboardCentreAppel {...sharedProps} conseilleresActives={conseilleresActives} /></ProtectedRoute>} />
              <Route path="/pilotage-cc" element={<ProtectedRoute permKey="pilotage_cc"><PilotageCC saisies={saisies} /></ProtectedRoute>} />
              <Route path="/qualite" element={<ProtectedRoute permKey="qualite"><QualiteEvaluation /></ProtectedRoute>} />
              <Route path="/marketing" element={<ProtectedRoute permKey="marketing"><DashboardMarketing /></ProtectedRoute>} />
              <Route path="/objectifs" element={<ProtectedRoute permKey="objectifs"><Objectifs conseilleres={conseilleresActives} /></ProtectedRoute>} />
              <Route path="/conseilleres" element={<ProtectedRoute permKey="conseilleres"><Conseilleres {...sharedProps} /></ProtectedRoute>} />
              <Route path="/calendrier" element={<ProtectedRoute permKey="calendrier"><Calendrier /></ProtectedRoute>} />
              <Route path="/responsables" element={<ProtectedRoute permKey="conseilleres"><Responsables /></ProtectedRoute>} />
              <Route path="/commerciaux" element={<ProtectedRoute permKey="commerciaux"><Commerciaux /></ProtectedRoute>} />
              <Route path="/stock" element={<ProtectedRoute permKey="stock"><Stock /></ProtectedRoute>} />
              <Route path="/primes" element={<ProtectedRoute permKey="primes"><Primes /></ProtectedRoute>} />
              <Route path="/passagers" element={<ProtectedRoute permKey="passagers"><Passagers /></ProtectedRoute>} />
              <Route path="/perf-commercial" element={<ProtectedRoute permKey="perf_commercial"><PerfCommercial /></ProtectedRoute>} />
              <Route path="/flux-rdv" element={<ProtectedRoute permKey="flux_rdv"><FluxRDV conseilleres={conseilleresActives} /></ProtectedRoute>} />
              <Route path="/analyse-cv" element={<ProtectedRoute permKey="analyse_cv"><AnalyseCV {...sharedProps} conseilleresActives={conseilleresActives} /></ProtectedRoute>} />
              <Route path="/gestion-users" element={<ProtectedRoute permKey="gestion_users"><GestionUsers /></ProtectedRoute>} />
              <Route path="/import" element={<ImportAgent />} />
              <Route path="/etudes" element={<ProtectedRoute permKey={null}><Etudes /></ProtectedRoute>} />
              <Route path="/etudes/commerciale-2026" element={<ProtectedRoute permKey={null}><EtudeCommerciale2026 /></ProtectedRoute>} />
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