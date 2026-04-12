import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import DashboardCentreAppel from './pages/DashboardCentreAppel'
import DashboardMarketing from './pages/DashboardMarketing'
import Conseilleres from './pages/Conseilleres'
import Objectifs from './pages/Objectifs'
import Calendrier from './pages/Calendrier'
import FluxRDV from './pages/FluxRDV'
import AnalyseCV from './pages/AnalyseCV'
import { supabase } from './lib/supabase'

export default function App() {
  const [conseilleres, setConseilleres] = useState([])
  const [saisies, setSaisies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

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
              <Route path="/centre-appel" element={<DashboardCentreAppel {...sharedProps} />} />
              <Route path="/marketing" element={<DashboardMarketing />} />
              <Route path="/objectifs" element={<Objectifs conseilleres={conseilleres} />} />
              <Route path="/conseilleres" element={<Conseilleres {...sharedProps} />} />
              <Route path="/calendrier" element={<Calendrier />} />
              <Route path="/flux-rdv" element={<FluxRDV conseilleres={conseilleres} />} />
              <Route path="/analyse-cv" element={<AnalyseCV {...sharedProps} />} />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  )
}
