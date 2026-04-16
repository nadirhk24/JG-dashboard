import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function BulleNotes() {
  const [open, setOpen] = useState(false)
  const [onglet, setOnglet] = useState('notes')
  const [pos, setPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Notes
  const [notes, setNotes] = useState([])
  const [noteTexte, setNoteTexte] = useState('')
  const [editNote, setEditNote] = useState(null)
  const [editTexte, setEditTexte] = useState('')

  // Plans
  const [plans, setPlans] = useState([])
  const [planTexte, setPlanTexte] = useState('')
  const [planResp, setPlanResp] = useState('')
  const [planDebut, setPlanDebut] = useState('')
  const [planFin, setPlanFin] = useState('')
  const [notifPlans, setNotifPlans] = useState([])
  const [showNotif, setShowNotif] = useState(false)

  useEffect(() => { loadNotes(); loadPlans() }, [])

  async function loadNotes() {
    const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
    setNotes(data || [])
  }

  async function loadPlans() {
    const { data } = await supabase.from('plans_actions').select('*').order('date_fin', { ascending: true })
    setPlans(data || [])
    // Notifier les plans en retard non clôturés
    const today = new Date().toISOString().split('T')[0]
    const enRetard = (data || []).filter(p => !p.cloture && p.date_fin < today)
    if (enRetard.length > 0) { setNotifPlans(enRetard); setShowNotif(true) }
  }

  // Drag
  function onMouseDown(e) {
    if (e.target.closest('.bulle-panel')) return
    setDragging(true)
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }
  useEffect(() => {
    function onMove(e) {
      if (!dragging) return
      setPos({
        x: Math.min(Math.max(0, e.clientX - dragOffset.current.x), window.innerWidth - 56),
        y: Math.min(Math.max(0, e.clientY - dragOffset.current.y), window.innerHeight - 56),
      })
    }
    function onUp() { setDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  async function saveNote() {
    if (!noteTexte.trim()) return
    await supabase.from('notes').insert({ texte: noteTexte.trim() })
    setNoteTexte('')
    loadNotes()
  }

  async function updateNote() {
    if (!editTexte.trim()) return
    await supabase.from('notes').update({ texte: editTexte.trim(), updated_at: new Date().toISOString() }).eq('id', editNote)
    setEditNote(null); setEditTexte('')
    loadNotes()
  }

  async function deleteNote(id) {
    if (!window.confirm('Supprimer cette note ?')) return
    await supabase.from('notes').delete().eq('id', id)
    loadNotes()
  }

  async function savePlan() {
    if (!planTexte.trim() || !planDebut || !planFin) return
    await supabase.from('plans_actions').insert({ texte: planTexte.trim(), responsable: planResp.trim(), date_debut: planDebut, date_fin: planFin })
    setPlanTexte(''); setPlanResp(''); setPlanDebut(''); setPlanFin('')
    loadPlans()
  }

  async function cloturerPlan(id) {
    if (!window.confirm('Clôturer ce plan d\'action ?')) return
    await supabase.from('plans_actions').update({ cloture: true, cloture_at: new Date().toISOString() }).eq('id', id)
    loadPlans()
  }

  const today = new Date().toISOString().split('T')[0]
  const inputStyle = { width: '100%', padding: '8px 10px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 12, background: '#F8F7F4', outline: 'none', boxSizing: 'border-box' }
  const btnStyle = { padding: '7px 16px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }

  return (
    <>
      {/* Notification plans en retard */}
      {showNotif && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '2px solid #E07B30', maxWidth: 360 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#E07B30' }}>⚠️ Plans d'actions en retard</div>
            <button onClick={() => setShowNotif(false)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#8A8A7A' }}>✕</button>
          </div>
          {notifPlans.map(p => (
            <div key={p.id} style={{ fontSize: 12, color: '#2C2C2C', padding: '6px 0', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
              <strong>{p.texte}</strong>
              <div style={{ color: '#8A8A7A', fontSize: 11 }}>{p.responsable && `${p.responsable} · `}Échéance: {p.date_fin}</div>
            </div>
          ))}
          <button onClick={() => { setShowNotif(false); setOpen(true); setOnglet('plans') }} style={{ ...btnStyle, marginTop: 12, background: '#E07B30', width: '100%' }}>
            Voir les plans d'actions
          </button>
        </div>
      )}

      {/* Bulle draggable */}
      <div
        onMouseDown={onMouseDown}
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9998, cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      >
        <button
          onClick={() => setOpen(p => !p)}
          style={{ width: 52, height: 52, borderRadius: '50%', background: open ? '#C9A84C' : '#2C2C2C', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
          title="Notes & Plans d'actions"
        >
          {open ? '✕' : '📝'}
        </button>

        {/* Panel */}
        {open && (
          <div className="bulle-panel" style={{
            position: 'absolute',
            bottom: 64, right: 0,
            width: 420, maxHeight: '70vh',
            background: '#fff', borderRadius: 16,
            boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
            border: '1px solid rgba(201,168,76,0.2)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header onglets */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
              {[['notes', '📝 Notes'], ['plans', '🎯 Plans d\'actions']].map(([k, l]) => (
                <button key={k} onClick={() => setOnglet(k)} style={{
                  flex: 1, padding: '12px', border: 'none', background: onglet === k ? '#F7F0DC' : '#fff',
                  color: onglet === k ? '#C9A84C' : '#5A5A5A', fontSize: 12, fontWeight: onglet === k ? 600 : 400,
                  cursor: 'pointer', borderBottom: onglet === k ? '2px solid #C9A84C' : '2px solid transparent',
                }}>{l}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

              {/* ── NOTES ── */}
              {onglet === 'notes' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <input value={noteTexte} onChange={e => setNoteTexte(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveNote()}
                      placeholder="Nouvelle note..." style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={saveNote} style={btnStyle}>+ Ajouter</button>
                  </div>
                  {notes.length === 0 && <div style={{ textAlign: 'center', color: '#8A8A7A', fontSize: 12, padding: 20 }}>Aucune note</div>}
                  {notes.map(n => (
                    <div key={n.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 8, background: '#F8F7F4' }}>
                      {editNote === n.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input value={editTexte} onChange={e => setEditTexte(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && updateNote()}
                            style={{ ...inputStyle, flex: 1 }} autoFocus />
                          <button onClick={updateNote} style={{ ...btnStyle, padding: '6px 10px' }}>✓</button>
                          <button onClick={() => setEditNote(null)} style={{ ...btnStyle, background: '#8A8A7A', padding: '6px 10px' }}>✕</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 12, color: '#2C2C2C', marginBottom: 4 }}>{n.texte}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 10, color: '#8A8A7A' }}>
                              {new Date(n.created_at).toLocaleDateString('fr-FR')} {new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              {n.updated_at !== n.created_at && ' · modifiée'}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => { setEditNote(n.id); setEditTexte(n.texte) }}
                                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: '#C9A84C', cursor: 'pointer' }}>✏️</button>
                              <button onClick={() => deleteNote(n.id)}
                                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', background: 'transparent', color: '#E05C5C', cursor: 'pointer' }}>🗑️</button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── PLANS D'ACTIONS ── */}
              {onglet === 'plans' && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <input value={planTexte} onChange={e => setPlanTexte(e.target.value)} placeholder="Plan d'action..." style={inputStyle} />
                    <input value={planResp} onChange={e => setPlanResp(e.target.value)} placeholder="Responsable..." style={inputStyle} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#5A5A5A', marginBottom: 3 }}>Début</div>
                        <input type="date" value={planDebut} onChange={e => setPlanDebut(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#5A5A5A', marginBottom: 3 }}>Fin</div>
                        <input type="date" value={planFin} onChange={e => setPlanFin(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <button onClick={savePlan} style={{ ...btnStyle, width: '100%', padding: '9px' }}>+ Ajouter le plan</button>
                  </div>

                  {plans.length === 0 && <div style={{ textAlign: 'center', color: '#8A8A7A', fontSize: 12, padding: 20 }}>Aucun plan d'action</div>}
                  {plans.map(p => {
                    const enRetard = !p.cloture && p.date_fin < today
                    const encours = !p.cloture && p.date_debut <= today && p.date_fin >= today
                    const statusColor = p.cloture ? '#4CAF7D' : enRetard ? '#E05C5C' : encours ? '#C9A84C' : '#8A8A7A'
                    const statusLabel = p.cloture ? '✅ Clôturé' : enRetard ? '🔴 En retard' : encours ? '🟡 En cours' : '⚪ À venir'
                    return (
                      <div key={p.id} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${statusColor}30`, marginBottom: 8, background: p.cloture ? 'rgba(76,175,125,0.05)' : enRetard ? 'rgba(224,92,92,0.05)' : '#F8F7F4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#2C2C2C', flex: 1, textDecoration: p.cloture ? 'line-through' : 'none' }}>{p.texte}</div>
                          {!p.cloture && (
                            <button onClick={() => cloturerPlan(p.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(76,175,125,0.4)', background: 'transparent', color: '#4CAF7D', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 8 }}>Clôturer</button>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#8A8A7A', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {p.responsable && <span>👤 {p.responsable}</span>}
                          <span>📅 {p.date_debut} → {p.date_fin}</span>
                          <span style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
