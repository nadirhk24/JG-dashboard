import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TYPE_BIENS  = ['appt', 'magasin', 'bureaux', 'boutique']
const TYPE_LABELS = { appt: 'Appartement', magasin: 'Magasin', bureaux: 'Bureaux', boutique: 'Boutique' }
const TYPE_ICONS  = { appt: '🏠', magasin: '🏪', bureaux: '🏢', boutique: '🛍️' }
const STATUT_LABELS = { actif: 'Actif', liquide: 'Liquide', rupture: 'Rupture' }
const STATUT_COLORS = { actif: '#2E9455', liquide: '#C9A84C', rupture: '#E05C5C' }

function formatPrix(val) {
  if (!val && val !== 0) return '—'
  return parseInt(val).toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' MAD'
}

// Parse "4 Mois" → 4
function parseMois(str) {
  if (!str) return 0
  const m = str.match(/(\d+)/)
  return m ? parseInt(m[1]) : 0
}

// Ajouter N mois à une date
function addMonths(dateStr, months) {
  if (!dateStr || !months) return null
  const d = new Date(dateStr + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return d
}

// Calculer le statut objectif
function calcObjectif(projet) {
  const duree = parseMois(projet.duree_objectif)
  if (!duree || !projet.date_debut_objectif || !projet.objectif_nombre) return null
  const today    = new Date()
  const debut    = new Date(projet.date_debut_objectif + 'T12:00:00')
  const fin      = addMonths(projet.date_debut_objectif, duree)
  const totalMs  = fin - debut
  const ecouleMs = today - debut
  const restantMs= fin - today
  const pctTemps = Math.min(100, Math.max(0, (ecouleMs / totalMs) * 100))
  const joursRestants = Math.max(0, Math.ceil(restantMs / 86400000))
  const moisRestants  = Math.max(0, (restantMs / (30.44 * 86400000)))
  const rythmeNecess  = moisRestants > 0 ? (projet.objectif_nombre / duree).toFixed(1) : 0
  // Alerte urgence : < 30% temps restant
  const pctRestant = 100 - pctTemps
  let alerte = 'ok'
  if (pctRestant < 15) alerte = 'critique'
  else if (pctRestant < 30) alerte = 'urgent'
  else if (pctRestant < 50) alerte = 'attention'
  return { debut, fin, pctTemps, joursRestants, moisRestants: moisRestants.toFixed(1), rythmeNecess, alerte, duree }
}

const ALERTE_CONFIG = {
  ok:        { color: '#2E9455', bg: '#2E945510', label: null,       icon: null },
  attention: { color: '#C9A84C', bg: '#C9A84C15', label: 'Attention', icon: '⚠️' },
  urgent:    { color: '#E07B30', bg: '#E07B3015', label: 'Urgent',    icon: '🔶' },
  critique:  { color: '#E05C5C', bg: '#E05C5C15', label: '❗ URGENT', icon: '🚨' },
}

export default function Stock() {
  const { user, profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'
  const [regions, setRegions]               = useState([])
  const [projets, setProjets]               = useState([])
  const [commerciaux, setCommerciaux]       = useState([])
  const [projetsCommerciaux, setProjetsCommerciaux] = useState([])
  const [stock, setStock]                   = useState([])
  const [notes, setNotes]                   = useState([])
  const [refreshKey, setRefreshKey]         = useState(0)
  const [selectedProjet, setSelectedProjet] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [showAddRegion, setShowAddRegion]   = useState(false)
  const [showAddProjet, setShowAddProjet]   = useState(false)
  const [showAddStock, setShowAddStock]     = useState(false)
  const [showAddNote, setShowAddNote]       = useState(false)
  const [showCommerciaux, setShowCommerciaux] = useState(false)
  const [newRegion, setNewRegion]   = useState('')
  const [newProjet, setNewProjet]   = useState({ nom: '', region_id: '' })
  const [newStock, setNewStock]     = useState({ type_bien: 'appt', superficie_min: '', prix_min: '', unites_dispo: '' })
  const [newNote, setNewNote]       = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [r, p, c, pc, s, n] = await Promise.all([
      supabase.from('regions').select('*').order('nom'),
      supabase.from('projets').select('*, regions(nom)').order('ordre').order('nom'),
      supabase.from('commerciaux').select('id, nom, equipe').eq('actif', true).order('nom'),
      supabase.from('projets_commerciaux').select('projet_id, commercial_id, commerciaux(id, nom, equipe)'),
      supabase.from('stock').select('*').order('type_bien'),
      supabase.from('stock_notes').select('id, projet_id, texte, user_id, created_at, user_profils(nom)').order('created_at', { ascending: false }),
    ])
    setRegions(r.data || [])
    setProjets(p.data || [])
    setCommerciaux(c.data || [])
    setProjetsCommerciaux(pc.data || [])
    setStock(s.data || [])
    setNotes([...(n.data || [])])
    if (selectedProjet) {
      const updated = (p.data || []).find(x => x.id === selectedProjet.id)
      if (updated) setSelectedProjet(updated)
    }
  }

  async function addRegion() {
    if (!newRegion.trim()) return
    await supabase.from('regions').insert({ nom: newRegion.trim() })
    setNewRegion(''); setShowAddRegion(false); loadAll()
  }
  async function addProjet() {
    if (!newProjet.nom.trim() || !newProjet.region_id) return
    const dans = projets.filter(p => p.region_id === newProjet.region_id)
    const max = dans.reduce((m, p) => Math.max(m, p.ordre || 0), 0)
    await supabase.from('projets').insert({ nom: newProjet.nom.trim(), region_id: newProjet.region_id, statut: 'actif', ordre: max + 1 })
    setNewProjet({ nom: '', region_id: '' }); setShowAddProjet(false); loadAll()
  }
  async function updateStatutProjet(projetId, statut) {
    await supabase.from('projets').update({ statut }).eq('id', projetId); loadAll()
  }
  async function moveProjet(projetId, direction) {
    const liste = projets.filter(p => p.region_id === selectedProjet?.region_id).sort((a,b) => (a.ordre||0) - (b.ordre||0))
    const idx = liste.findIndex(p => p.id === projetId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= liste.length) return
    await Promise.all([
      supabase.from('projets').update({ ordre: liste[swapIdx].ordre }).eq('id', liste[idx].id),
      supabase.from('projets').update({ ordre: liste[idx].ordre }).eq('id', liste[swapIdx].id),
    ])
    loadAll()
  }
  async function addStock() {
    if (!newStock.type_bien || !newStock.unites_dispo || !selectedProjet) return
    await supabase.from('stock').insert({ projet_id: selectedProjet.id, type_bien: newStock.type_bien, superficie_min: newStock.superficie_min || null, prix_min: newStock.prix_min || null, unites_dispo: parseInt(newStock.unites_dispo) })
    setNewStock({ type_bien: 'appt', superficie_min: '', prix_min: '', unites_dispo: '' }); setShowAddStock(false); loadAll()
  }
  async function updateStockField(id, field, value) {
    const parsed = field === 'unites_dispo' ? parseInt(value) : parseFloat(value)
    await supabase.from('stock').update({ [field]: isNaN(parsed) ? null : parsed }).eq('id', id); loadAll()
  }
  async function deleteStock(id) {
    if (!window.confirm('Supprimer ?')) return
    await supabase.from('stock').delete().eq('id', id); loadAll()
  }
  async function addNote() {
    if (!newNote.trim() || !selectedProjet) return
    await supabase.from('stock_notes').insert({ projet_id: selectedProjet.id, texte: newNote.trim(), user_id: user.id })
    setNewNote(''); setShowAddNote(false); await loadAll(); setRefreshKey(k => k + 1)
  }
  async function deleteNote(id) {
    await supabase.from('stock_notes').delete().eq('id', id); await loadAll(); setRefreshKey(k => k + 1)
  }
  async function toggleCommercial(projetId, commercialId) {
    const exists = projetsCommerciaux.find(pc => pc.projet_id === projetId && pc.commercial_id === commercialId)
    if (exists) await supabase.from('projets_commerciaux').delete().eq('projet_id', projetId).eq('commercial_id', commercialId)
    else await supabase.from('projets_commerciaux').insert({ projet_id: projetId, commercial_id: commercialId })
    loadAll()
  }

  const projetsFiltres  = projets.filter(p => selectedRegion === 'all' || p.region_id === selectedRegion).sort((a,b) => (a.ordre||0) - (b.ordre||0))
  const stockProjet     = stock.filter(s => s.projet_id === selectedProjet?.id)
  const notesProjet     = notes.filter(n => n.projet_id === selectedProjet?.id)
  const commerciauxProjet = projetsCommerciaux.filter(pc => pc.projet_id === selectedProjet?.id)
  const totalUnites     = stockProjet.reduce((s, x) => s + (x.unites_dispo || 0), 0)
  const objStatus       = selectedProjet ? calcObjectif(selectedProjet) : null

  const cardStyle = { background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.12)', overflow: 'hidden' }
  const inputSm   = { padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.25)', fontSize: 13, background: '#fff', outline: 'none', color: '#2C2C2C', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ padding: '28px 32px', background: '#F8F7F4', minHeight: '100vh' }}>

      {/* Header page */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 30, fontWeight: 600, color: '#2C2C2C' }}>Gestion du Stock</div>
          <div style={{ fontSize: 14, color: '#8A8A7A', marginTop: 3 }}>Déclaration et suivi par région et projet</div>
        </div>
        {isSuperAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowAddRegion(true)} style={{ padding: '9px 18px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.3)', background: '#fff', color: '#C9A84C', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Région</button>
            <button onClick={() => setShowAddProjet(true)} style={{ padding: '9px 18px', borderRadius: 20, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Projet</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 180px)' }}>

        {/* ── Colonne projets ── */}
        <div style={{ ...cardStyle, width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
            <select value={selectedRegion} onChange={e => { setSelectedRegion(e.target.value); setSelectedProjet(null) }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)', fontSize: 13, background: '#F8F7F4', color: '#2C2C2C', outline: 'none' }}>
              <option value="all">Toutes les régions</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {projetsFiltres.map((p, idx) => {
              const total   = stock.filter(s => s.projet_id === p.id).reduce((s, x) => s + (x.unites_dispo || 0), 0)
              const isSelected = selectedProjet?.id === p.id
              const color   = STATUT_COLORS[p.statut] || '#2E9455'
              const obj     = calcObjectif(p)
              const alCfg   = obj ? ALERTE_CONFIG[obj.alerte] : null
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid rgba(201,168,76,0.06)', borderLeft: `3px solid ${isSelected ? '#C9A84C' : 'transparent'}`, background: isSelected ? 'rgba(201,168,76,0.06)' : 'transparent', opacity: p.statut === 'rupture' ? 0.5 : 1, transition: 'all 0.15s' }}>
                  {isSuperAdmin && (
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '0 4px', gap: 0, justifyContent: 'center' }}>
                      <button onClick={() => moveProjet(p.id, 'up')} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#ddd' : '#C9A84C', fontSize: 9, padding: '2px 3px', lineHeight: 1 }}>▲</button>
                      <button onClick={() => moveProjet(p.id, 'down')} disabled={idx === projetsFiltres.length - 1} style={{ background: 'none', border: 'none', cursor: idx === projetsFiltres.length - 1 ? 'default' : 'pointer', color: idx === projetsFiltres.length - 1 ? '#ddd' : '#C9A84C', fontSize: 9, padding: '2px 3px', lineHeight: 1 }}>▼</button>
                    </div>
                  )}
                  <div onClick={() => setSelectedProjet(p)} style={{ flex: 1, padding: '11px 10px 11px 4px', cursor: 'pointer' }}>
                    {/* Nom + statut */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: '#2C2C2C', flex: 1, lineHeight: 1.3 }}>{p.nom}</div>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: `${color}18`, color, whiteSpace: 'nowrap', marginLeft: 6 }}>{STATUT_LABELS[p.statut]}</span>
                    </div>
                    {/* Région + stock */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: '#8A8A7A' }}>{p.regions?.nom}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: total > 0 ? '#2E9455' : '#E05C5C' }}>{total} u.</span>
                    </div>
                    {/* Mini objectif + alerte */}
                    {obj && (
                      <div style={{ marginTop: 5 }}>
                        {/* Barre de progression temps */}
                        <div style={{ height: 4, borderRadius: 3, background: '#E8E4DA', overflow: 'hidden', marginBottom: 3 }}>
                          <div style={{ height: '100%', width: `${obj.pctTemps}%`, borderRadius: 3, background: alCfg?.color || '#2E9455', transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: '#8A8A7A' }}>
                            {p.delai_livraison ? `📅 ${p.delai_livraison}` : `Obj: ${p.objectif_nombre} ventes`}
                          </span>
                          {alCfg?.icon && obj.alerte !== 'ok' ? (
                            <span style={{ fontSize: 10, color: alCfg.color, fontWeight: 600 }}>{alCfg.icon} {obj.joursRestants}j</span>
                          ) : (
                            <span style={{ fontSize: 10, color: '#8A8A7A' }}>{obj.joursRestants}j rest.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Détail projet ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
          {!selectedProjet ? (
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8A8A7A', fontSize: 15 }}>← Sélectionne un projet</div>
          ) : <>

            {/* ── HEADER PROJET ── */}
            <div style={{ ...cardStyle, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {/* Nom + statut */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 600, color: '#2C2C2C' }}>{selectedProjet.nom}</span>
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 10, background: `${STATUT_COLORS[selectedProjet.statut]}18`, color: STATUT_COLORS[selectedProjet.statut] }}>{STATUT_LABELS[selectedProjet.statut]}</span>
                    {/* Badge délai de livraison */}
                    {selectedProjet.delai_livraison && (
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 10, background: 'rgba(83,74,183,0.1)', color: '#534AB7', border: '1px solid rgba(83,74,183,0.2)', fontWeight: 500 }}>
                        🏗️ Livraison : {selectedProjet.delai_livraison}
                      </span>
                    )}
                  </div>
                  {/* Région + stock + délai */}
                  <div style={{ fontSize: 13, color: '#8A8A7A', marginTop: 5, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>{selectedProjet.regions?.nom}</span>
                    <span>·</span>
                    <span style={{ fontWeight: 600, color: totalUnites > 0 ? '#2E9455' : '#E05C5C' }}>{totalUnites} unité{totalUnites > 1 ? 's' : ''} disponible{totalUnites > 1 ? 's' : ''}</span>
                    {selectedProjet.delai_livraison && <>
                      <span>·</span>
                      <span style={{ color: '#534AB7', fontWeight: 500 }}>🏗️ Livraison : {selectedProjet.delai_livraison}</span>
                    </>}
                  </div>
                  {/* Commerciaux liés (tags) */}
                  {commerciauxProjet.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {commerciauxProjet.map(pc => (
                        <span key={pc.commercial_id} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 10, background: 'rgba(83,74,183,0.08)', color: '#534AB7', border: '1px solid rgba(83,74,183,0.15)' }}>👤 {pc.commerciaux?.nom}</span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Boutons actions */}
                {isSuperAdmin && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {['actif','liquide','rupture'].filter(s => s !== selectedProjet.statut).map(s => (
                      <button key={s} onClick={() => updateStatutProjet(selectedProjet.id, s)} style={{ padding: '6px 13px', borderRadius: 8, border: `1px solid ${STATUT_COLORS[s]}40`, background: 'transparent', color: STATUT_COLORS[s], fontSize: 12, cursor: 'pointer' }}>→ {STATUT_LABELS[s]}</button>
                    ))}
                    <button onClick={() => setShowCommerciaux(true)} style={{ padding: '6px 13px', borderRadius: 8, border: '1px solid rgba(83,74,183,0.3)', background: 'transparent', color: '#534AB7', fontSize: 12, cursor: 'pointer' }}>👥 Commerciaux ({commerciauxProjet.length})</button>
                    <button onClick={() => setShowAddStock(true)} style={{ padding: '6px 16px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Stock</button>
                  </div>
                )}
              </div>
            </div>

            {/* ── BLOC OBJECTIF + COMPTEUR ── */}
            {objStatus && selectedProjet.objectif_nombre > 0 && (() => {
              const alCfg = ALERTE_CONFIG[objStatus.alerte]
              const finDate = objStatus.fin ? objStatus.fin.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
              return (
                <div style={{ ...cardStyle, border: `1.5px solid ${alCfg.color}30`, background: alCfg.bg }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${alCfg.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: alCfg.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Objectif de ventes
                      </span>
                      {objStatus.alerte !== 'ok' && (
                        <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: alCfg.color, color: '#fff', fontWeight: 600 }}>
                          {alCfg.icon} {alCfg.label}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: alCfg.color, fontWeight: 500 }}>
                      {selectedProjet.duree_objectif} · débuté le 01/05/2026
                    </span>
                  </div>

                  <div style={{ padding: '16px 20px' }}>
                    {/* KPIs en ligne */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center', padding: '12px', borderRadius: 10, background: '#fff', border: `1px solid ${alCfg.color}20` }}>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 700, color: alCfg.color }}>{selectedProjet.objectif_nombre}</div>
                        <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>Ventes objectif</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px', borderRadius: 10, background: '#fff', border: `1px solid ${alCfg.color}20` }}>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 700, color: alCfg.color }}>{objStatus.joursRestants}</div>
                        <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>Jours restants</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px', borderRadius: 10, background: '#fff', border: `1px solid ${alCfg.color}20` }}>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 700, color: alCfg.color }}>{objStatus.moisRestants}</div>
                        <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>Mois restants</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px', borderRadius: 10, background: '#fff', border: `1px solid ${alCfg.color}20` }}>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 700, color: alCfg.color }}>{objStatus.rythmeNecess}</div>
                        <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>Ventes / mois cibles</div>
                      </div>
                    </div>

                    {/* Barre de progression temps */}
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5A5A5A' }}>
                      <span>01 mai 2026</span>
                      <span style={{ fontWeight: 500, color: alCfg.color }}>Échéance : {finDate}</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 6, background: '#E8E4DA', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${objStatus.pctTemps}%`, borderRadius: 6, background: `linear-gradient(90deg, ${alCfg.color}99, ${alCfg.color})`, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 12 }}>
                      <span style={{ color: '#5A5A5A' }}>Temps écoulé : <strong style={{ color: alCfg.color }}>{objStatus.pctTemps.toFixed(0)}%</strong></span>
                      <span style={{ color: '#5A5A5A' }}>Temps restant : <strong style={{ color: alCfg.color }}>{(100 - objStatus.pctTemps).toFixed(0)}%</strong></span>
                    </div>

                    {/* Message alerte */}
                    {objStatus.alerte !== 'ok' && (
                      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: alCfg.color + '18', border: `1px solid ${alCfg.color}30`, fontSize: 13, color: alCfg.color, fontWeight: 500 }}>
                        {objStatus.alerte === 'critique' && `🚨 Moins de 15% du temps restant ! Seulement ${objStatus.joursRestants} jours pour atteindre l'objectif de ${selectedProjet.objectif_nombre} ventes.`}
                        {objStatus.alerte === 'urgent'   && `🔶 Moins de 30% du temps restant. Il faut accélérer : ${objStatus.moisRestants} mois pour ${selectedProjet.objectif_nombre} ventes.`}
                        {objStatus.alerte === 'attention' && `⚠️ La moitié du temps est écoulée. Maintenir un rythme de ${objStatus.rythmeNecess} ventes/mois.`}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── STOCK PAR TYPE ── */}
            <div style={cardStyle}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)', fontSize: 12, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1 }}>Stock par type de bien</div>
              {stockProjet.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: '#8A8A7A' }}>Aucun stock déclaré</div>
              ) : (
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.5fr 100px 36px', gap: 8, padding: '0 14px 6px', fontSize: 11, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <span>Type</span><span>Superficie min</span><span>Prix min</span><span style={{ textAlign: 'center' }}>Unités</span><span></span>
                  </div>
                  {stockProjet.map(s => (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.5fr 100px 36px', gap: 8, alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: '#F8F7F4', border: '1px solid rgba(201,168,76,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{TYPE_ICONS[s.type_bien] || '🏗️'}</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#2C2C2C' }}>{TYPE_LABELS[s.type_bien] || s.type_bien}</span>
                      </div>
                      {isSuperAdmin ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" key={`sup-${s.id}`} defaultValue={s.superficie_min || ''} placeholder="m²" onBlur={e => updateStockField(s.id, 'superficie_min', e.target.value)} style={{ ...inputSm, width: 65 }} />
                          <span style={{ fontSize: 11, color: '#8A8A7A', whiteSpace: 'nowrap' }}>m²</span>
                        </div>
                      ) : <span style={{ fontSize: 13, color: '#5A5A5A' }}>{s.superficie_min ? `${s.superficie_min} m²` : '—'}</span>}
                      {isSuperAdmin ? (
                        <div>
                          <input type="number" key={`prix-${s.id}`} defaultValue={s.prix_min || ''} placeholder="MAD" onBlur={e => updateStockField(s.id, 'prix_min', e.target.value)} style={inputSm} />
                          {s.prix_min ? <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>{formatPrix(s.prix_min)}</div> : null}
                        </div>
                      ) : <span style={{ fontSize: 13, color: '#5A5A5A' }}>{formatPrix(s.prix_min)}</span>}
                      {isSuperAdmin ? (
                        <input type="number" min={0} key={`uni-${s.id}`} defaultValue={s.unites_dispo} onBlur={e => updateStockField(s.id, 'unites_dispo', e.target.value)} style={{ ...inputSm, textAlign: 'center', fontWeight: 700, fontSize: 16, fontFamily: 'Cormorant Garamond, serif', color: s.unites_dispo > 0 ? '#2E9455' : '#E05C5C' }} />
                      ) : (
                        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Cormorant Garamond, serif', color: s.unites_dispo > 0 ? '#2E9455' : '#E05C5C', textAlign: 'center' }}>{s.unites_dispo}</div>
                      )}
                      {isSuperAdmin && <button onClick={() => deleteStock(s.id)} style={{ background: 'none', border: 'none', color: '#E05C5C', cursor: 'pointer', fontSize: 18, textAlign: 'center' }}>×</button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px 0', borderTop: '1px solid rgba(201,168,76,0.1)', marginTop: 4 }}>
                    <span style={{ fontSize: 14, color: '#5A5A5A' }}>Total : <strong style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: '#2C2C2C' }}>{totalUnites} unités</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* ── NOTES ── */}
            <div style={cardStyle}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1 }}>Notes importantes</span>
                <button onClick={() => setShowAddNote(true)} style={{ padding: '5px 14px', borderRadius: 8, background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)', fontSize: 12, cursor: 'pointer' }}>+ Note</button>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notesProjet.length === 0
                  ? <div style={{ textAlign: 'center', fontSize: 14, color: '#8A8A7A', padding: '8px 0' }}>Aucune note</div>
                  : notesProjet.map(n => (
                    <div key={n.id} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', position: 'relative' }}>
                      <div style={{ fontSize: 14, color: '#2C2C2C', lineHeight: 1.6, paddingRight: 24 }}>{n.texte}</div>
                      <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 5 }}>{n.user_profils?.nom} · {new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      {(isSuperAdmin || n.user_id === user?.id) && <button onClick={() => deleteNote(n.id)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: '#E05C5C', cursor: 'pointer', fontSize: 16 }}>×</button>}
                    </div>
                  ))}
              </div>
            </div>
          </>}
        </div>
      </div>

      {/* ── MODALS ── */}
      {showAddRegion && <Modal title="Nouvelle région" onClose={() => setShowAddRegion(false)} onConfirm={addRegion}><input value={newRegion} onChange={e => setNewRegion(e.target.value)} placeholder="Nom de la région" autoFocus style={MI} onKeyDown={e => e.key === 'Enter' && addRegion()} /></Modal>}
      {showAddProjet && <Modal title="Nouveau projet" onClose={() => setShowAddProjet(false)} onConfirm={addProjet}><input value={newProjet.nom} onChange={e => setNewProjet(p => ({ ...p, nom: e.target.value }))} placeholder="Nom du projet" style={{ ...MI, marginBottom: 8 }} /><select value={newProjet.region_id} onChange={e => setNewProjet(p => ({ ...p, region_id: e.target.value }))} style={MI}><option value="">Sélectionner une région</option>{regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}</select></Modal>}
      {showAddStock && selectedProjet && (
        <Modal title={`Ajouter stock — ${selectedProjet.nom}`} onClose={() => setShowAddStock(false)} onConfirm={addStock}>
          <select value={newStock.type_bien} onChange={e => setNewStock(p => ({ ...p, type_bien: e.target.value }))} style={{ ...MI, marginBottom: 8 }}>{TYPE_BIENS.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {TYPE_LABELS[t]}</option>)}</select>
          <input type="number" value={newStock.unites_dispo} onChange={e => setNewStock(p => ({ ...p, unites_dispo: e.target.value }))} placeholder="Unités disponibles" style={{ ...MI, marginBottom: 8 }} />
          <input type="number" value={newStock.superficie_min} onChange={e => setNewStock(p => ({ ...p, superficie_min: e.target.value }))} placeholder="Superficie min (m²)" style={{ ...MI, marginBottom: 8 }} />
          <input type="number" value={newStock.prix_min} onChange={e => setNewStock(p => ({ ...p, prix_min: e.target.value }))} placeholder="Prix min (MAD)" style={MI} />
          {newStock.prix_min && <div style={{ fontSize: 12, color: '#C9A84C', marginTop: 4 }}>{formatPrix(newStock.prix_min)}</div>}
        </Modal>
      )}
      {showAddNote && selectedProjet && <Modal title={`Note — ${selectedProjet.nom}`} onClose={() => setShowAddNote(false)} onConfirm={addNote}><textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Note importante..." rows={4} autoFocus style={{ ...MI, resize: 'vertical', fontFamily: 'DM Sans' }} /></Modal>}
      {showCommerciaux && selectedProjet && (
        <Modal title={`Commerciaux — ${selectedProjet.nom}`} onClose={() => setShowCommerciaux(false)} onConfirm={() => setShowCommerciaux(false)} confirmLabel="Fermer">
          <div style={{ maxHeight: 340, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['sale','kenitra'].map(eq => (
              <div key={eq}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 0 4px' }}>Équipe {eq === 'sale' ? 'Sale' : 'Kenitra'}</div>
                {commerciaux.filter(c => c.equipe === eq).map(c => {
                  const on = projetsCommerciaux.some(pc => pc.projet_id === selectedProjet.id && pc.commercial_id === c.id)
                  return (
                    <div key={c.id} onClick={() => toggleCommercial(selectedProjet.id, c.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: on ? 'rgba(83,74,183,0.08)' : 'transparent', border: `1px solid ${on ? 'rgba(83,74,183,0.2)' : 'transparent'}`, transition: 'all 0.15s' }}>
                      <span style={{ fontSize: 13, color: on ? '#534AB7' : '#2C2C2C', fontWeight: on ? 500 : 400 }}>👤 {c.nom}</span>
                      <span style={{ fontSize: 14 }}>{on ? '✅' : '○'}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

const MI = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.25)', fontSize: 13, background: '#F8F7F4', outline: 'none', color: '#2C2C2C', boxSizing: 'border-box' }

function Modal({ title, children, onClose, onConfirm, confirmLabel = 'Ajouter' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '26px', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: '#2C2C2C', marginBottom: 18 }}>{title}</div>
        <div style={{ marginBottom: 20 }}>{children}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {confirmLabel !== 'Fermer' && <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)', background: '#fff', color: '#5A5A5A', fontSize: 13, cursor: 'pointer' }}>Annuler</button>}
          <button onClick={onConfirm} style={{ padding: '9px 22px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}