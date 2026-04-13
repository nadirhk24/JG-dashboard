import React, { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'

export default function Responsables() {
  const [responsables, setResponsables] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nom: '', equipe: '', email: '', telephone: '', date_entree: '', date_sortie: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('responsables').select('*').order('nom')
    setResponsables(data || [])
  }

  function openForm(resp = null) {
    if (resp) {
      setEditing(resp)
      setForm({ nom: resp.nom, equipe: resp.equipe || '', email: resp.email || '', telephone: resp.telephone || '', date_entree: resp.date_entree || '', date_sortie: resp.date_sortie || '' })
    } else {
      setEditing(null)
      setForm({ nom: '', equipe: '', email: '', telephone: '', date_entree: '', date_sortie: '' })
    }
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.nom) { setMsg({ type: 'error', text: 'Nom obligatoire' }); return }
    setSaving(true)
    const payload = { ...form, actif: !form.date_sortie, date_entree: form.date_entree || null, date_sortie: form.date_sortie || null }
    const { error } = editing
      ? await supabase.from('responsables').update(payload).eq('id', editing.id)
      : await supabase.from('responsables').insert(payload)
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Sauvegardé !' }); loadData(); setShowForm(false); setTimeout(() => setMsg(null), 3000) }
  }

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none' }
  const labelStyle = { fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 5, display: 'block' }

  return (
    <div>
      <PageHeader title="Responsables" subtitle="Gestion des responsables d'équipe">
        <button onClick={() => openForm()} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: '#C9A84C', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          + Ajouter responsable
        </button>
      </PageHeader>

      {msg && <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1.5px solid #C9A84C', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>{editing ? 'Modifier' : 'Ajouter'} un responsable</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Nom complet *</label><input value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))} placeholder="Ex: Karima Snaiki" style={inputStyle}/></div>
            <div><label style={labelStyle}>Équipe</label><input value={form.equipe} onChange={e=>setForm(p=>({...p,equipe:e.target.value}))} placeholder="Ex: Kenitra" style={inputStyle}/></div>
            <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={inputStyle}/></div>
            <div><label style={labelStyle}>Téléphone</label><input value={form.telephone} onChange={e=>setForm(p=>({...p,telephone:e.target.value}))} style={inputStyle}/></div>
            <div><label style={labelStyle}>Date d'entrée</label><input type="date" value={form.date_entree} onChange={e=>setForm(p=>({...p,date_entree:e.target.value}))} style={inputStyle}/></div>
            <div><label style={labelStyle}>Date de sortie</label><input type="date" value={form.date_sortie} onChange={e=>setForm(p=>({...p,date_sortie:e.target.value}))} style={inputStyle}/></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ background: '#C9A84C', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{saving ? 'Enregistrement...' : 'Sauvegarder'}</button>
            <button onClick={() => setShowForm(false)} style={{ background: '#fff', color: '#5A5A5A', border: '1.5px solid rgba(201,168,76,0.25)', padding: '10px 24px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Nom','Équipe','Email','Téléphone','Date entrée','Date sortie','Statut','Actions'].map(h => (
              <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {responsables.map(r => (
              <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500 }}>{r.nom}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>{r.equipe || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: '#5A5A5A' }}>{r.email || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: '#5A5A5A' }}>{r.telephone || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: '#5A5A5A' }}>{r.date_entree || '—'}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: r.date_sortie ? '#E05C5C' : '#5A5A5A' }}>{r.date_sortie || '—'}</td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, background: r.actif!==false?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: r.actif!==false?'#2d7a54':'#a03030' }}>
                    {r.actif !== false ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <button onClick={() => openForm(r)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Modifier</button>
                </td>
              </tr>
            ))}
            {responsables.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Aucun responsable</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
