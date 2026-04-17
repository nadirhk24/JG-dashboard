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
import Login from './pages/Login'
import { supabase } from './lib/supabase'
import BulleNotes from './components/BulleNotes'
import { AuthProvider, useAuth } from './context/AuthContext'

function AppContent() {
  const { user, profil, loading: authLoading } = useAuth()
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

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F8F7F4' }}>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: '#C9A84C' }}>Chargement...</div>
    </div>
  )

  if (!user) return <Login />

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ marginLeft: 'var(--sidebar-width)', flex: 1, padding: '32px', minWidth: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, border: '3px solid #E8D5A3', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
                <p style={{ color: '#5A5A5A', fontSize: 13 }}>Cha