import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcLeadsNets } from '../lib/kpi'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'

export default function Saisie({ conseilleres, saisies, reload }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    conseillere_id: '',
    date: today,
    leads_bruts: '',
    indispos: '',
    echanges: '',
    rdv: '',
    visites: '',
    ventes: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const leadsNets = calcLeadsNets(parseInt(form.leads_bruts) || 0, parseInt(form.indispos) || 0)

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.conseillere_id) { setMsg({ type: 'error', text: 'Sélectionne une conseillère' }); return }
    if (!form.date) { setMsg({ type: 'error', text: 'Sélectionne une date' }); return }
    setSaving(true)
    const payload = {
      conseillere_id: form.conseillere_id,
      date: form.date,
      leads_bruts: parseInt(form.leads_bruts) || 0,
      indispos: parseInt(form.indispos) || 0,
      leads_nets: leadsNets,
      echanges: parseInt(form.echanges) || 0,
      rdv: parseInt(form.rdv) || 0,
      visites: parseInt(form.visites) || 0,
      ventes: parseInt(form.ventes) || 0,
    }
    const { error } = await supabase.from('saisies').upsert(payload, { onConflict: 'conseillere_id,date' })
    setSaving(false)
    if (error) {
      setMsg({ type: 'error', text: 'Erreur: ' + error.message })
    } else {
      setMsg({ type: 'success', text: 'Données enregistrées !' })
      reload()
      setForm(prev => ({ ...prev, leads_bruts: '', indispos: '', echanges: '', rdv: '', visites: '', ventes: '' }))
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const recentSaisies = [...saisies].slice(0, 20)

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8,
    fontSize: 14, color: '#2C2C2C', background: '#F8F7F4', outline: 'none',
    transition: 'border-color 0.2s'
  }
  const labelStyle = { fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 6, display: 'block' }

  return (
    <div>
      <PageHeader title="Saisie des données" subtitle="Enregistre les chiffres quotidiens par conseillère" />

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
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Conseillère *</label>
              <div style={{ position: 'relative' }}>
                <select value={form.conseillere_id} onChange={e => handleChange('conseillere_id', e.target.value)}
                  style={{ ...inputStyle, appearance: 'none', paddingRight: 32 }}>
                  <option value="">Sélectionner...</option>
                  {conseilleres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', fontSize: 11 }}>▼</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Leads Bruts</label>
              <input type="number" min="0" value={form.leads_bruts} onChange={e => handleChange('leads_bruts', e.target.value)} placeholder="ex: 120" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Indispos (injoignables)</label>
              <input type="number" min="0" value={form.indispos} onChange={e => handleChange('indispos', e.target.value)} placeholder="ex: 20" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Leads Nets (automatique)</label>
              <input type="number" value={leadsNets} readOnly style={{ ...inputStyle, background: '#F7F0DC', borderColor: '#C9A84C', color: '#8a6a1a', fontWeight: 500 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            <div>
              <label style={labelStyle}>Échanges</label>
              <input type="number" min="0" value={form.echanges} onChange={e => handleChange('echanges', e.target.value)} placeholder="ex: 150" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>RDV fixés</label>
              <input type="number" min="0" value={form.rdv} onChange={e => handleChange('rdv', e.target.value)} placeholder="nouveaux + reprogrammés" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Visites (présences)</label>
              <input type="number" min="0" value={form.visites} onChange={e => handleChange('visites', e.target.value)} placeholder="ex: 18" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Ventes</label>
              <input type="number" min="0" value={form.ventes} onChange={e => handleChange('ventes', e.target.value)} placeholder="ex: 5" style={inputStyle} />
            </div>
          </div>

          <button type="submit" disabled={saving} style={{
            background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff',
            border: 'none', padding: '12px 32px', borderRadius: 8,
            fontSize: 14, fontWeight: 500, cursor: saving ? 'wait' : 'pointer',
            transition: 'all 0.2s'
          }}>
            {saving ? 'Enregistrement...' : 'Enregistrer les données'}
          </button>
        </form>
      </div>

      <SectionTitle>Saisies récentes</SectionTitle>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date', 'Conseillère', 'Leads Bruts', 'Indispos', 'Leads Nets', 'Échanges', 'RDV', 'Visites', 'Ventes', 'Action'].map(h => (
                <th key={h} style={{ fontSize: 10, color: '#5A5A5A', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentSaisies.map(s => {
              const c = conseilleres.find(c => c.id === s.conseillere_id)
              return (
                <tr key={s.id}>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{s.date}</td>
                  <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 500 }}>{c?.nom || '—'}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{s.leads_bruts}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12, color: '#E05C5C' }}>{s.indispos}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>{s.leads_nets}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{s.echanges}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{s.rdv}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{s.visites}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>{s.ventes}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <button onClick={async () => {
                      if (window.confirm('Supprimer cette saisie ?')) {
                        await supabase.from('saisies').delete().eq('id', s.id)
                        reload()
                      }
                    }} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>
                      Suppr.
                    </button>
                  </td>
                </tr>
              )
            })}
            {recentSaisies.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px 0', color: '#5A5A5A', fontSize: 13 }}>Aucune saisie pour l'instant</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
