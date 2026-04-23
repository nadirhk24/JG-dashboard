import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function formatPrix(val) {
  if (!val && val !== 0) return '—'
  return parseInt(val).toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' MAD'
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
export default function TopBar() {
  const { user, profil } = useAuth()
  const [showStock, setShowStock] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const stockRef = useRef(null)
  const profileRef = useRef(null)

  // Fermer les popups en cliquant dehors
  useEffect(() => {
    function handleClick(e) {
      if (stockRef.current && !stockRef.current.contains(e.target)) setShowStock(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initiales = profil?.nom
    ? profil.nom.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : profil?.username?.slice(0, 2).toUpperCase() || 'JG'

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, left: 0, zIndex: 100,
      height: 52, background: '#fff', borderBottom: '1px solid rgba(201,168,76,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      paddingRight: 20, gap: 12,
      boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
    }}>
      {/* Bouton Stock */}
      <div ref={stockRef} style={{ position: 'relative' }}>
        <button onClick={() => { setShowStock(p => !p); setShowProfile(false) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', borderRadius: 20,
            border: `1.5px solid ${showStock ? '#C9A84C' : 'rgba(201,168,76,0.25)'}`,
            background: showStock ? 'rgba(201,168,76,0.08)' : '#F8F7F4',
            color: '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s'
          }}>
          <span style={{ fontSize: 14 }}>🏗️</span>
          Stock
        </button>
        {showStock && <StockPopup onClose={() => setShowStock(false)} />}
      </div>

      {/* Avatar profil */}
      <div ref={profileRef} style={{ position: 'relative' }}>
        <button onClick={() => { setShowProfile(p => !p); setShowStock(false) }}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `2px solid ${showProfile ? '#C9A84C' : 'rgba(201,168,76,0.3)'}`,
            background: profil?.photo_url ? 'transparent' : '#E8D5A3',
            cursor: 'pointer', overflow: 'hidden', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 0.15s'
          }}>
          {profil?.photo_url
            ? <img src={profil.photo_url} alt="profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 13, fontWeight: 600, color: '#8a6a1a' }}>{initiales}</span>
          }
        </button>
        {showProfile && <ProfilePopup profil={profil} user={user} onClose={() => setShowProfile(false)} />}
      </div>
    </div>
  )
}

// ─── Profile Popup ─────────────────────────────────────────────────────────────
function ProfilePopup({ profil, user, onClose }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  async function uploadPhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('user_profils').update({ photo_url: data.publicUrl }).eq('id', user.id)
      window.location.reload()
    } catch(e) {
      console.error(e)
    }
    setUploading(false)
  }

  const roleLabel = { super_admin: 'Super Admin', responsable_sale: 'Responsable Sale', conseillere: 'Conseillère' }

  return (
    <div style={{
      position: 'absolute', top: 44, right: 0, width: 220,
      background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      border: '1px solid rgba(201,168,76,0.15)', padding: '16px', zIndex: 200
    }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2C' }}>{profil?.nom || profil?.username}</div>
        <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>{roleLabel[profil?.role] || profil?.role}</div>
      </div>
      <button onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          width: '100%', padding: '8px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.25)',
          background: '#F8F7F4', color: '#C9A84C', fontSize: 11, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
        {uploading ? '⏳ Upload...' : '📷 Changer la photo'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} style={{ display: 'none' }} />
    </div>
  )
}

// ─── Stock Popup ───────────────────────────────────────────────────────────────
function StockPopup({ onClose }) {
  const [regions, setRegions] = useState([])
  const [projets, setProjets] = useState([])
  const [stock, setStock] = useState([])
  const [notes, setNotes] = useState([])
  const [selectedProjet, setSelectedProjet] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [r, p, s, n] = await Promise.all([
        supabase.from('regions').select('*').order('nom'),
        supabase.from('projets').select('*, regions(nom)').order('nom'),
        supabase.from('stock').select('*').order('type_bien'),
        supabase.from('stock_notes').select('*, user_profils(nom)').order('created_at', { ascending: false }),
      ])
      setRegions(r.data || [])
      setProjets(p.data || [])
      setStock(s.data || [])
      setNotes(n.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const projetsFiltres = projets.filter(p => selectedRegion === 'all' || p.region_id === selectedRegion)
  const stockProjet = stock.filter(s => s.projet_id === selectedProjet?.id)
  const notesProjet = notes.filter(n => n.projet_id === selectedProjet?.id)
  const totalUnites = stockProjet.reduce((s, x) => s + (x.unites_dispo || 0), 0)

  const statutColor = { actif: '#2E9455', liquide: '#C9A84C', rupture: '#E05C5C' }
  const statutLabel = { actif: 'Actif', liquide: 'Liquide', rupture: 'Rupture' }
  const TYPE_LABELS = { appt: 'Appartement', magasin: 'Magasin', bureaux: 'Bureaux', boutique: 'Boutique' }
  const TYPE_ICONS  = { appt: '🏠', magasin: '🏪', bureaux: '🏢', boutique: '🛍️' }

  return (
    <div style={{
      position: 'fixed', top: 52, right: 20, width: 680, maxHeight: 'calc(100vh - 80px)',
      background: '#fff', borderRadius: 16, boxShadow: '0 12px 48px rgba(0,0,0,0.14)',
      border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden', zIndex: 200,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>
          🏗️ Stock disponible
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#8A8A7A' }}>×</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Colonne gauche — projets */}
        <div style={{ width: 220, borderRight: '1px solid rgba(201,168,76,0.1)', overflow: 'auto', flexShrink: 0 }}>
          {/* Filtre région */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
            <select value={selectedRegion} onChange={e => { setSelectedRegion(e.target.value); setSelectedProjet(null) }}
              style={{ width: '100%', padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(201,168,76,0.2)', fontSize: 11, background: '#F8F7F4', color: '#2C2C2C' }}>
              <option value="all">Toutes les régions</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#8A8A7A' }}>Chargement...</div>
          ) : projetsFiltres.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#8A8A7A' }}>Aucun projet</div>
          ) : projetsFiltres.map(p => {
            const stockP = stock.filter(s => s.projet_id === p.id)
            const total = stockP.reduce((s, x) => s + (x.unites_dispo || 0), 0)
            const isSelected = selectedProjet?.id === p.id
            const color = statutColor[p.statut] || '#2E9455'
            return (
              <div key={p.id} onClick={() => setSelectedProjet(p)}
                style={{
                  padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.06)',
                  background: isSelected ? 'rgba(201,168,76,0.07)' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? '#C9A84C' : 'transparent'}`,
                  opacity: p.statut === 'rupture' ? 0.5 : 1,
                  transition: 'all 0.15s'
                }}>
                <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: '#2C2C2C' }}>{p.nom}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: '#8A8A7A' }}>{p.regions?.nom}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: `${color}18`, color }}>{statutLabel[p.statut]}</span>
                  <span style={{ fontSize: 10, color: '#2C2C2C', fontWeight: 500, marginLeft: 'auto' }}>{total} u.</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Colonne droite — détail projet */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
          {!selectedProjet ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8A8A7A', fontSize: 13 }}>
              ← Sélectionne un projet
            </div>
          ) : (
            <>
              {/* Header projet */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, fontWeight: 600, color: '#2C2C2C' }}>{selectedProjet.nom}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: `${statutColor[selectedProjet.statut]}18`, color: statutColor[selectedProjet.statut] }}>
                    {statutLabel[selectedProjet.statut]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#8A8A7A' }}>{selectedProjet.regions?.nom} · {totalUnites} unité{totalUnites > 1 ? 's' : ''} disponible{totalUnites > 1 ? 's' : ''}</div>
              </div>

              {/* Stock par type */}
              {stockProjet.length === 0 ? (
                <div style={{ fontSize: 12, color: '#8A8A7A', padding: '12px 0' }}>Aucun stock déclaré</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {stockProjet.map(s => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderRadius: 10, background: '#F8F7F4', border: '1px solid rgba(201,168,76,0.1)'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>{TYPE_ICONS[s.type_bien] || '🏗️'}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#2C2C2C' }}>{TYPE_LABELS[s.type_bien] || s.type_bien}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>
                          {s.superficie_min ? `À partir de ${s.superficie_min} m²` : ''}
                          {s.superficie_min && s.prix_min ? ' · ' : ''}
                          {s.prix_min ? formatPrix(s.prix_min) : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Cormorant Garamond, serif', color: s.unites_dispo > 0 ? '#2E9455' : '#E05C5C' }}>{s.unites_dispo}</div>
                        <div style={{ fontSize: 10, color: '#8A8A7A' }}>unités</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {notesProjet.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Notes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {notesProjet.map(n => (
                      <div key={n.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', fontSize: 12, color: '#2C2C2C' }}>
                        <div>{n.texte}</div>
                        <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 4 }}>
                          {n.user_profils?.nom} · {new Date(n.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}