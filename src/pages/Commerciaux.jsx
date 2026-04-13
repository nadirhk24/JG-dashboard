import React, { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import { supabase } from '../lib/supabase'

const EQUIPES_OPTIONS = [
  { val: 'sale', label: 'Équipe Sale', color: '#C9A84C' },
  { val: 'kenitra', label: 'Équipe Kenitra', color: '#534AB7' },
]

export default function Commerciaux() {
  const [commerciaux, setCommerciaux] = useState([])
  const [responsables, setResponsables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nom: '', equipe: 'sale', responsable: '', date_entree: '', date_sortie: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [filterEquipe, setFilterEquipe] = useState('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: comms }, { data: resps }] = await Promise.all([
      supabase.from('commerciaux').select('*').order('equipe').order('nom'),
      supabase.from('responsables').select('*').order('nom')
    ])
    setCommerciaux(comms || [])
    setResponsables(resps || [])
    setLoading(false)
  }

  function openForm(comm = null) {
    if (comm) {
      setEditing(comm)
      setForm({ nom: comm.nom, equipe: comm.equipe, responsable: comm.responsable, date_entree: comm.date_entree || '', date_sortie: comm.date_sortie || '' })
    } else {
      setEditing(null)
      setForm({ nom: '', equipe: 'sale', responsable: '', date_entree: '', date_sortie: '' })
    }
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.nom) { setMsg({ type: 'error', text: 'Nom obligatoire' }); return }
    setSaving(true)
    const payload = { nom: form.nom, equipe: form.equipe, responsable: form.responsable, date_entree: form.date_entree || null, date_sortie: form.date_sortie || null, actif: !form.date_sortie }
    const { error } = editing
      ? await supabase.from('commerciaux').update(payload).eq('id', editing.id)
      : await supabase.from('commerciaux').insert(payload)
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: editing ? 'Commercial mis à jour !' : 'Commercial ajouté !' }); loadData(); setShowForm(false); setTimeout(() => setMsg(null), 3000) }
  }

  async function toggleActif(comm) {
    await supabase.from('commerciaux').update({ actif: !comm.actif }).eq('id', comm.id)
    loadData()
  }

  const filteredComms = filterEquipe === 'all' ? commerciaux : commerciaux.filter(c => c.equipe === filterEquipe)
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none' }
  const labelStyle = { fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 5, display: 'block' }

  return (
    <div>
      <PageHeader title="Commerciaux" subtitle="Gestion des équipes commerciales">
        <button onClick={() => openForm()} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: '#C9A84C', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          + Ajouter commercial
        </button>
      </PageHeader>

      {msg && <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1.5px solid #C9A84C', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>{editing ? 'Modifier' : 'Ajouter'} un commercial</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={labelStyle}>Nom complet *</label><input value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))} placeholder="Ex: Khalid Amghoud" style={inputStyle}/></div>
            <div>
              <label style={labelStyle}>Équipe *</label>
              <select value={form.equipe} onChange={e=>setForm(p=>({...p,equipe:e.target.value}))} style={{ ...inputStyle, appearance: 'none' }}>
                {EQUIPES_OPTIONS.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Responsable</label>
              <select value={form.responsable} onChange={e=>setForm(p=>({...p,responsable:e.target.value}))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Sélectionner...</option>
                {responsables.map(r => <option key={r.id} value={r.nom}>{r.nom}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Date d'entrée</label><input type="date" value={form.date_entree} onChange={e=>setForm(p=>({...p,date_entree:e.target.value}))} style={inputStyle}/></div>
            <div><label style={labelStyle}>Date de sortie</label><input type="date" value={form.date_sortie} onChange={e=>setForm(p=>({...p,date_sortie:e.target.value}))} style={inputStyle}/></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{ background: '#C9A84C', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{saving ? 'Enregistrement...' : 'Sauvegarder'}</button>
            <button onClick={() => setShowForm(false)} style={{ background: '#fff', color: '#5A5A5A', border: '1.5px solid rgba(201,168,76,0.25)', padding: '10px 24px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['all','Tous'],['sale','Sale'],['kenitra','Kenitra']].map(([k,l]) => (
          <button key={k} onClick={()=>setFilterEquipe(k)} style={{ padding: '7px 16px', borderRadius: 16, border: `1.5px solid ${filterEquipe===k?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: filterEquipe===k?'#C9A84C':'#fff', color: filterEquipe===k?'#fff':'#5A5A5A', fontSize: 12, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Nom','Équipe','Responsable','Date entrée','Date sortie','Statut','Actions'].map(h => (
              <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filteredComms.map(c => {
              const eq = EQUIPES_OPTIONS.find(e=>e.val===c.equipe)
              return (
                <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500 }}>{c.nom}</td>
                  <td style={{ padding: '11px 14px' }}><span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, background: `${eq?.color}15`, color: eq?.color, fontWeight: 500 }}>{eq?.label}</span></td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#5A5A5A' }}>{c.responsable || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#5A5A5A' }}>{c.date_entree || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: c.date_sortie ? '#E05C5C' : '#5A5A5A' }}>{c.date_sortie || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, background: c.actif ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: c.actif ? '#2d7a54' : '#a03030' }}>
                      {c.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openForm(c)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Modifier</button>
                      <button onClick={() => toggleActif(c)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${c.actif?'rgba(224,92,92,0.3)':'rgba(76,175,125,0.3)'}`, color: c.actif?'#E05C5C':'#4CAF7D', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>
                        {c.actif ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredComms.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Aucun commercial</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
