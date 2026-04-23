import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TYPE_BIENS = ['appt', 'magasin', 'bureaux', 'boutique']
const TYPE_LABELS = { appt: 'Appartement', magasin: 'Magasin', bureaux: 'Bureaux', boutique: 'Boutique' }
const TYPE_ICONS  = { appt: '🏠', magasin: '🏪', bureaux: '🏢', boutique: '🛍️' }
const STATUT_LABELS = { actif: 'Actif', liquide: 'Liquide', rupture: 'Rupture' }
const STATUT_COLORS = { actif: '#2E9455', liquide: '#C9A84C', rupture: '#E05C5C' }

function formatPrix(val) {
  if (!val && val !== 0) return '—'
  return parseInt(val).toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' MAD'
}

export default function Stock() {
  const { user, profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'
  const [regions, setRegions] = useState([])
  const [projets, setProjets] = useState([])
  const [commerciaux, setCommerciaux] = useState([])
  const [projetsCommerciaux, setProjetsCommerciaux] = useState([])
  const [stock, setStock] = useState([])
  const [notes, setNotes] = useState([])
  const [selectedProjet, setSelectedProjet] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [showAddRegion, setShowAddRegion] = useState(false)
  const [showAddProjet, setShowAddProjet] = useState(false)
  const [showAddStock, setShowAddStock] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showCommerciaux, setShowCommerciaux] = useState(false)
  const [newRegion, setNewRegion] = useState('')
  const [newProjet, setNewProjet] = useState({ nom: '', region_id: '' })
  const [newStock, setNewStock] = useState({ type_bien: 'appt', superficie_min: '', prix_min: '', unites_dispo: '' })
  const [newNote, setNewNote] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [r, p, c, pc, s, n] = await Promise.all([
      supabase.from('regions').select('*').order('nom'),
      supabase.from('projets').select('*, regions(nom)').order('ordre').order('nom'),
      supabase.from('commerciaux').select('id, nom, equipe').eq('actif', true).order('nom'),
      supabase.from('projets_commerciaux').select('projet_id, commercial_id, commerciaux(id, nom, equipe)'),
      supabase.from('stock').select('*').order('type_bien'),
      supabase.from('stock_notes').select('*, user_profils(nom)').order('created_at', { ascending: false }),
    ])
    setRegions(r.data || [])
    setProjets(p.data || [])
    setCommerciaux(c.data || [])
    setProjetsCommerciaux(pc.data || [])
    setStock(s.data || [])
    setNotes(n.data || [])
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
    await supabase.from('projets').update({ statut }).eq('id', projetId)
    loadAll()
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
    await supabase.from('stock').update({ [field]: isNaN(parsed) ? null : parsed }).eq('id', id)
    loadAll()
  }

  async function deleteStock(id) {
    if (!window.confirm('Supprimer ?')) return
    await supabase.from('stock').delete().eq('id', id); loadAll()
  }

  async function addNote() {
    if (!newNote.trim() || !selectedProjet) return
    await supabase.from('stock_notes').insert({ projet_id: selectedProjet.id, texte: newNote.trim(), user_id: user.id })
    setNewNote(''); setShowAddNote(false); loadAll()
  }

  async function deleteNote(id) {
    await supabase.from('stock_notes').delete().eq('id', id); loadAll()
  }

  async function toggleCommercial(projetId, commercialId) {
    const exists = projetsCommerciaux.find(pc => pc.projet_id === projetId && pc.commercial_id === commercialId)
    if (exists) await supabase.from('projets_commerciaux').delete().eq('projet_id', projetId).eq('commercial_id', commercialId)
    else await supabase.from('projets_commerciaux').insert({ projet_id: projetId, commercial_id: commercialId })
    loadAll()
  }

  const projetsFiltres = projets.filter(p => selectedRegion === 'all' || p.region_id === selectedRegion).sort((a,b) => (a.ordre||0) - (b.ordre||0))
  const stockProjet = stock.filter(s => s.projet_id === selectedProjet?.id)
  const notesProjet = notes.filter(n => n.projet_id === selectedProjet?.id)
  const commerciauxProjet = projetsCommerciaux.filter(pc => pc.projet_id === selectedProjet?.id)
  const totalUnites = stockProjet.reduce((s, x) => s + (x.unites_dispo || 0), 0)
  const cardStyle = { background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.12)', overflow: 'hidden' }
  const inputSm = { padding: '4px 7px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.25)', fontSize: 12, background: '#fff', outline: 'none', color: '#2C2C2C', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ padding: '28px 32px', background: '#F8F7F4', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#2C2C2C' }}>Gestion du Stock</div>
          <div style={{ fontSize: 13, color: '#8A8A7A', marginTop: 2 }}>Déclaration et suivi par région et projet</div>
        </div>
        {isSuperAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowAddRegion(true)} style={{ padding: '8px 16px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.3)', background: '#fff', color: '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Région</button>
            <button onClick={() => setShowAddProjet(true)} style={{ padding: '8px 16px', borderRadius: 20, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Projet</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 180px)' }}>
        {/* Colonne projets */}
        <div style={{ ...cardStyle, width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
            <select value={selectedRegion} onChange={e => { setSelectedRegion(e.target.value); setSelectedProjet(null) }} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)', fontSize: 12, background: '#F8F7F4', color: '#2C2C2C', outline: 'none' }}>
              <option value="all">Toutes les régions</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {projetsFiltres.map((p, idx) => {
              const total = stock.filter(s => s.projet_id === p.id).reduce((s, x) => s + (x.unites_dispo || 0), 0)
              const isSelected = selectedProjet?.id === p.id
              const color = STATUT_COLORS[p.statut] || '#2E9455'
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(201,168,76,0.06)', borderLeft: `3px solid ${isSelected ? '#C9A84C' : 'transparent'}`, background: isSelected ? 'rgba(201,168,76,0.06)' : 'transparent', opacity: p.statut === 'rupture' ? 0.5 : 1, transition: 'all 0.15s' }}>
                  {isSuperAdmin && (
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '0 4px', gap: 0 }}>
                      <button onClick={() => moveProjet(p.id, 'up')} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#ddd' : '#C9A84C', fontSize: 9, padding: '2px 3px', lineHeight: 1 }}>▲</button>
                      <button onClick={() => moveProjet(p.id, 'down')} disabled={idx === projetsFiltres.length - 1} style={{ background: 'none', border: 'none', cursor: idx === projetsFiltres.length - 1 ? 'default' : 'pointer', color: idx === projetsFiltres.length - 1 ? '#ddd' : '#C9A84C', fontSize: 9, padding: '2px 3px', lineHeight: 1 }}>▼</button>
                    </div>
                  )}
                  <div onClick={() => setSelectedProjet(p)} style={{ flex: 1, padding: '10px 10px 10px 4px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: '#2C2C2C', flex: 1, lineHeight: 1.3 }}>{p.nom}</div>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: `${color}18`, color, whiteSpace: 'nowrap', marginLeft: 4 }}>{STATUT_LABELS[p.statut]}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: '#8A8A7A' }}>{p.regions?.nom}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: total > 0 ? '#2E9455' : '#E05C5C' }}>{total} u.</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Détail */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
          {!selectedProjet ? (
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8A8A7A', fontSize: 14 }}>← Sélectionne un projet</div>
          ) : <>
            {/* Header */}
            <div style={{ ...cardStyle, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: '#2C2C2C' }}>{selectedProjet.nom}</span>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: `${STATUT_COLORS[selectedProjet.statut]}18`, color: STATUT_COLORS[selectedProjet.statut] }}>{STATUT_LABELS[selectedProjet.statut]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 3 }}>{selectedProjet.regions?.nom} · {totalUnites} unité{totalUnites > 1 ? 's' : ''} disponible{totalUnites > 1 ? 's' : ''}</div>
                </div>
                {isSuperAdmin && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['actif','liquide','rupture'].filter(s => s !== selectedProjet.statut).map(s => (
                      <button key={s} onClick={() => updateStatutProjet(selectedProjet.id, s)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${STATUT_COLORS[s]}40`, background: 'transparent', color: STATUT_COLORS[s], fontSize: 11, cursor: 'pointer' }}>→ {STATUT_LABELS[s]}</button>
                    ))}
                    <button onClick={() => setShowCommerciaux(true)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(83,74,183,0.3)', background: 'transparent', color: '#534AB7', fontSize: 11, cursor: 'pointer' }}>👥 Commerciaux ({commerciauxProjet.length})</button>
                    <button onClick={() => setShowAddStock(true)} style={{ padding: '5px 14px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>+ Stock</button>
                  </div>
                )}
              </div>
              {commerciauxProjet.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {commerciauxProjet.map(pc => (
                    <span key={pc.commercial_id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'rgba(83,74,183,0.08)', color: '#534AB7', border: '1px solid rgba(83,74,183,0.15)' }}>👤 {pc.commerciaux?.nom}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Stock */}
            <div style={cardStyle}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)', fontSize: 11, fontWeight: 600, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1 }}>Stock par type de bien</div>
              {stockProjet.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#8A8A7A' }}>Aucun stock déclaré</div>
              ) : (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.5fr 90px 36px', gap: 8, padding: '0 14px 6px', fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <span>Type</span><span>Superficie min</span><span>Prix min</span><span style={{ textAlign: 'center' }}>Unités</span><span></span>
                  </div>
                  {stockProjet.map(s => (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.5fr 90px 36px', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: '#F8F7F4', border: '1px solid rgba(201,168,76,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{TYPE_ICONS[s.type_bien] || '🏗️'}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C' }}>{TYPE_LABELS[s.type_bien] || s.type_bien}</span>
                      </div>
                      {isSuperAdmin ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" key={`sup-${s.id}`} defaultValue={s.superficie_min || ''} placeholder="m²" onBlur={e => updateStockField(s.id, 'superficie_min', e.target.value)} style={{ ...inputSm, width: 65 }} />
                          <span style={{ fontSize: 10, color: '#8A8A7A', whiteSpace: 'nowrap' }}>m²</span>
                        </div>
                      ) : <span style={{ fontSize: 12, color: '#5A5A5A' }}>{s.superficie_min ? `${s.superficie_min} m²` : '—'}</span>}
                      {isSuperAdmin ? (
                        <div>
                          <input type="number" key={`prix-${s.id}`} defaultValue={s.prix_min || ''} placeholder="MAD" onBlur={e => updateStockField(s.id, 'prix_min', e.target.value)} style={inputSm} />
                          {s.prix_min ? <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 2 }}>{formatPrix(s.prix_min)}</div> : null}
                        </div>
                      ) : <span style={{ fontSize: 12, color: '#5A5A5A' }}>{formatPrix(s.prix_min)}</span>}
                      {isSuperAdmin ? (
                        <input type="number" min={0} key={`uni-${s.id}`} defaultValue={s.unites_dispo} onBlur={e => updateStockField(s.id, 'unites_dispo', e.target.value)} style={{ ...inputSm, textAlign: 'center', fontWeight: 700, fontSize: 15, fontFamily: 'Cormorant Garamond, serif', color: s.unites_dispo > 0 ? '#2E9455' : '#E05C5C' }} />
                      ) : (
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Cormorant Garamond, serif', color: s.unites_dispo > 0 ? '#2E9455' : '#E05C5C', textAlign: 'center' }}>{s.unites_dispo}</div>
                      )}
                      {isSuperAdmin && <button onClick={() => deleteStock(s.id)} style={{ background: 'none', border: 'none', color: '#E05C5C', cursor: 'pointer', fontSize: 16, textAlign: 'center' }}>×</button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px 0', borderTop: '1px solid rgba(201,168,76,0.1)', marginTop: 4 }}>
                    <span style={{ fontSize: 13, color: '#5A5A5A' }}>Total : <strong style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: '#2C2C2C' }}>{totalUnites} unités</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={cardStyle}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1 }}>Notes importantes</span>
                <button onClick={() => setShowAddNote(true)} style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)', fontSize: 11, cursor: 'pointer' }}>+ Note</button>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notesProjet.length === 0 ? <div style={{ textAlign: 'center', fontSize: 13, color: '#8A8A7A', padding: '8px 0' }}>Aucune note</div>
                : notesProjet.map(n => (
                  <div key={n.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', position: 'relative' }}>
                    <div style={{ fontSize: 13, color: '#2C2C2C', lineHeight: 1.5, paddingRight: 20 }}>{n.texte}</div>
                    <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 4 }}>{n.user_profils?.nom} · {new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    {(isSuperAdmin || n.user_id === user?.id) && <button onClick={() => deleteNote(n.id)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#E05C5C', cursor: 'pointer', fontSize: 14 }}>×</button>}
                  </div>
                ))}
              </div>
            </div>
          </>}
        </div>
      </div>

      {/* Modals */}
      {showAddRegion && <Modal title="Nouvelle région" onClose={() => setShowAddRegion(false)} onConfirm={addRegion}><input value={newRegion} onChange={e => setNewRegion(e.target.value)} placeholder="Nom de la région" autoFocus style={MI} onKeyDown={e => e.key === 'Enter' && addRegion()} /></Modal>}
      {showAddProjet && <Modal title="Nouveau projet" onClose={() => setShowAddProjet(false)} onConfirm={addProjet}><input value={newProjet.nom} onChange={e => setNewProjet(p => ({ ...p, nom: e.target.value }))} placeholder="Nom du projet" style={{ ...MI, marginBottom: 8 }} /><select value={newProjet.region_id} onChange={e => setNewProjet(p => ({ ...p, region_id: e.target.value }))} style={MI}><option value="">Sélectionner une région</option>{regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}</select></Modal>}
      {showAddStock && selectedProjet && (
        <Modal title={`Ajouter stock — ${selectedProjet.nom}`} onClose={() => setShowAddStock(false)} onConfirm={addStock}>
          <select value={newStock.type_bien} onChange={e => setNewStock(p => ({ ...p, type_bien: e.target.value }))} style={{ ...MI, marginBottom: 8 }}>{TYPE_BIENS.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {TYPE_LABELS[t]}</option>)}</select>
          <input type="number" value={newStock.unites_dispo} onChange={e => setNewStock(p => ({ ...p, unites_dispo: e.target.value }))} placeholder="Unités disponibles" style={{ ...MI, marginBottom: 8 }} />
          <input type="number" value={newStock.superficie_min} onChange={e => setNewStock(p => ({ ...p, superficie_min: e.target.value }))} placeholder="Superficie min (m²)" style={{ ...MI, marginBottom: 8 }} />
          <input type="number" value={newStock.prix_min} onChange={e => setNewStock(p => ({ ...p, prix_min: e.target.value }))} placeholder="Prix min (MAD)" style={MI} />
          {newStock.prix_min && <div style={{ fontSize: 11, color: '#C9A84C', marginTop: 4 }}>{formatPrix(newStock.prix_min)}</div>}
        </Modal>
      )}
      {showAddNote && selectedProjet && <Modal title={`Note — ${selectedProjet.nom}`} onClose={() => setShowAddNote(false)} onConfirm={addNote}><textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Note importante..." rows={4} autoFocus style={{ ...MI, resize: 'vertical', fontFamily: 'DM Sans' }} /></Modal>}
      {showCommerciaux && selectedProjet && (
        <Modal title={`Commerciaux — ${selectedProjet.nom}`} onClose={() => setShowCommerciaux(false)} onConfirm={() => setShowCommerciaux(false)} confirmLabel="Fermer">
          <div style={{ maxHeight: 340, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['sale','kenitra'].map(eq => (
              <div key={eq}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 0 4px' }}>Équipe {eq === 'sale' ? 'Sale' : 'Kenitra'}</div>
                {commerciaux.filter(c => c.equipe === eq).map(c => {
                  const on = projetsCommerciaux.some(pc => pc.projet_id === selectedProjet.id && pc.commercial_id === c.id)
                  return (
                    <div key={c.id} onClick={() => toggleCommercial(selectedProjet.id, c.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: on ? 'rgba(83,74,183,0.08)' : 'transparent', border: `1px solid ${on ? 'rgba(83,74,183,0.2)' : 'transparent'}`, transition: 'all 0.15s' }}>
                      <span style={{ fontSize: 12, color: on ? '#534AB7' : '#2C2C2C', fontWeight: on ? 500 : 400 }}>👤 {c.nom}</span>
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
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px', width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', marginBottom: 16 }}>{title}</div>
        <div style={{ marginBottom: 20 }}>{children}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {confirmLabel !== 'Fermer' && <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)', background: '#fff', color: '#5A5A5A', fontSize: 12, cursor: 'pointer' }}>Annuler</button>}
          <button onClick={onConfirm} style={{ padding: '8px 20px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}