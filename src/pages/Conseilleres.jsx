import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'

export default function Conseilleres({ conseilleres, reload }) {
  const [form, setForm] = useState({ nom: '', email: '', telephone: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [editId, setEditId] = useState(null)

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8,
    fontSize: 14, color: '#2C2C2C', background: '#F8F7F4', outline: 'none'
  }
  const labelStyle = {
    fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase',
    letterSpacing: '0.5px', fontWeight: 500, marginBottom: 6, display: 'block'
  }

  function initials(nom) {
    return nom.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
  }

  function avatarColor(nom) {
    const colors = ['#C9A84C', '#4CAF7D', '#378ADD', '#D85A30', '#D4537E', '#7F77DD']
    const idx = nom.charCodeAt(0) % colors.length
    return colors[idx]
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nom.trim()) { setMsg({ type: 'error', text: 'Le nom est obligatoire' }); return }
    setSaving(true)
    let error
    if (editId) {
      ({ error } = await supabase.from('conseilleres').update({ nom: form.nom, email: form.email, telephone: form.telephone }).eq('id', editId))
    } else {
      ({ error } = await supabase.from('conseilleres').insert({ nom: form.nom, email: form.email, telephone: form.telephone }))
    }
    setSaving(false)
    if (error) {
      setMsg({ type: 'error', text: 'Erreur: ' + error.message })
    } else {
      setMsg({ type: 'success', text: editId ? 'Conseillère modifiée !' : 'Conseillère ajoutée !' })
      setForm({ nom: '', email: '', telephone: '' })
      setEditId(null)
      reload()
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function handleDelete(id, nom) {
    if (!window.confirm(`Supprimer ${nom} ? Toutes ses saisies seront conservées.`)) return
    await supabase.from('conseilleres').delete().eq('id', id)
    reload()
  }

  function startEdit(c) {
    setEditId(c.id)
    setForm({ nom: c.nom, email: c.email || '', telephone: c.telephone || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <PageHeader
        title="Conseillères"
        subtitle={`${conseilleres.length} conseillère${conseilleres.length > 1 ? 's' : ''} dans l'équipe`}
      />

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500,
          background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)',
          color: msg.type === 'success' ? '#2d7a54' : '#a03030',
          border: `1px solid ${msg.type === 'success' ? 'rgba(76,175,125,0.3)' : 'rgba(224,92,92,0.3)'}`
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 14, padding: 28, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 20, color: '#2C2C2C' }}>
          {editId ? 'Modifier la conseillère' : 'Ajouter une conseillère'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Nom complet *</label>
              <input
                type="text" value={form.nom}
                onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
                placeholder="ex: Sara Benali" style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="ex: sara@jg.ma" style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input
                type="text" value={form.telephone}
                onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))}
                placeholder="ex: 06 12 34 56 78" style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving} style={{
              background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff',
              border: 'none', padding: '11px 28px', borderRadius: 8,
              fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer'
            }}>
              {saving ? 'Enregistrement...' : editId ? 'Modifier' : 'Ajouter'}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm({ nom: '', email: '', telephone: '' }) }}
                style={{ background: 'transparent', color: '#5A5A5A', border: '1.5px solid rgba(201,168,76,0.2)', padding: '11px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      <SectionTitle>Équipe ({conseilleres.length})</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {conseilleres.map(c => (
          <div key={c.id} style={{
            background: '#fff', borderRadius: 14, padding: 20,
            border: '1px solid rgba(201,168,76,0.15)',
            display: 'flex', alignItems: 'center', gap: 14
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: avatarColor(c.nom), display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 500, color: '#fff', flexShrink: 0
            }}>
              {initials(c.nom)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: '#2C2C2C', marginBottom: 2 }}>{c.nom}</div>
              {c.email && <div style={{ fontSize: 12, color: '#5A5A5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>}
              {c.telephone && <div style={{ fontSize: 12, color: '#5A5A5A' }}>{c.telephone}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => startEdit(c)} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)',
                color: '#C9A84C', background: 'transparent', fontSize: 11, cursor: 'pointer'
              }}>Modifier</button>
              <button onClick={() => handleDelete(c.id, c.nom)} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)',
                color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer'
              }}>Supprimer</button>
            </div>
          </div>
        ))}
        {conseilleres.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#5A5A5A', fontSize: 13 }}>
            Aucune conseillère. Ajoutez-en une ci-dessus.
          </div>
        )}
      </div>
    </div>
  )
}
