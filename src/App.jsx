import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import DashboardCentreAppel from './pages/DashboardCentreAppel'
import DashboardMarketing from './pages/DashboardMarketing'
import Saisie from './pages/Saisie'
import Conseilleres from './pages/Conseilleres'
import Objectifs from './pages/Objectifs'
import VueCohort from './pages/VueCohort'
import Historique from './pages/Historique'
import { supabase } from './lib/supabase'

export default function App() {
  const [conseilleres, setConseilleres] = useState([])
  const [saisies, setSaisies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: cons }, { data: sais }] = await Promise.all([
        supabase.from('conseilleres').select('*').order('nom'),
        supabase.from('saisies').select('*').order('date', { ascending: false })
      ])
      setConseilleres(cons || [])
      setSaisies(sais || [])
    } catch (err) {
      console.error('Erreur chargement:', err)
    }
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
                <div style={{ width: 48, height: 48, border: '3px solid var(--gold-light)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
                <p style={{ color: 'var(--mid)', fontSize: 13 }}>Chargement...</p>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/centre-appel" />} />
              <Route path="/centre-appel" element={<DashboardCentreAppel {...sharedProps} />} />
              <Route path="/marketing" element={<DashboardMarketing {...sharedProps} />} />
              <Route path="/saisie" element={<Saisie {...sharedProps} />} />
              <Route path="/conseilleres" element={<Conseilleres {...sharedProps} />} />
              <Route path="/objectifs" element={<Objectifs {...sharedProps} />} />
              <Route path="/cohort" element={<VueCohort {...sharedProps} />} />
              <Route path="/historique" element={<Historique {...sharedProps} />} />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  )
}
