import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcLeadsNets } from '../lib/kpi'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'

export default function Saisie({ conseilleres, saisies, reload }) {
  const today = new Date().toISOString().split('T')[0]
  const [mode, setMode] = useState('jour')
  const [form, setForm] = useState({
    conseillere_id: '',
    date: today,
    date_debut: '',
    date_fin: '',
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

    setSaving(true)

    if (mode === 'jour') {
      if (!form.date) { setMsg({ type: 'error', text: 'Sélectionne une date' }); setSaving(false); return }
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
    } else {
      if (!form.date_debut || !form.date_fin) { setMsg({ type: 'error', text: 'Sélectionne une période' }); setSaving(false); return }
      const debut = new Date(form.date_debut)
      const fin = new Date(form.date_fin)
      const days = Math.round((fin - debut) / (1000 * 60 * 60 * 24)) + 1
      if (days <= 0) { setMsg({ type: 'error', text: 'La date de fin doit être après la date de début' }); setSaving(false); return }

      const leadsParJour = Math.round((parseInt(form.leads_bruts) || 0) / days)
      const indisposParJour = Math.round((parseInt(form.indispos) || 0) / days)
      const echangesParJour = Math.round((parseInt(form.echanges) || 0) / days)
      const rdvParJour = Math.round((parseInt(form.rdv) || 0) / days)
      const visitesParJour = Math.round((parseInt(form.visites) || 0) / days)
      const ventesParJour = Math.round((parseInt(form.ventes) || 0) / days)

      const rows = []
      for (let i = 0; i < days; i++) {
        const d = new Date(debut)
        d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        rows.push({
          conseillere_id: form.conseillere_id,
          date: dateStr,
          leads_bruts: leadsParJour,
          indispos: indisposParJour,
          leads_nets: calcLeadsNets(leadsParJour, indisposParJour),
          echanges: echangesParJour,
          rdv: rdvParJour,
          visites: visitesParJour,
          ventes: ventesParJour,
        })
      }

      const { error } = await supabase.from('saisies').upsert(rows, { onConflict: 'conseillere_id,date' })
      setSaving(false)
      if (error) {
        setMsg({ type: 'error', text: 'Erreur: ' + error.message })
      } else {
        setMsg({ type: 'success', text: `Données enregistrées sur ${days} jours !` })
        reload()
        setForm(prev => ({ ...prev, leads_bruts: '', indispos: '', echanges: '', rdv: '', visites: '', ventes: '', date_debut: '', date_fin: '' }))
        setTimeout(() => setMsg(null), 3000)
      }
    }
  }

  const recentSaisies = [...saisies].slice(0, 20)

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8,
    fontSize: 14, color: '#2C2C2C', background: '#F8F7F4', outline: 'none',
  }
  const labelStyle = { fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 6, display: 'block' }

  return (
    <div>
      <PageHeader title="Saisie des données" subtitle="Enregistre les chiffres par conseillère" />

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

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[['jour', 'Saisie par jour'], ['periode', 'Saisie par période']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{
              padding: '8px 20px', borderRadius: 20,
              border: `1.5px solid ${mode === k ? '#C9A84C' : 'rgba(201,168,76,0.25)'}`,
              background: mode === k ? '#C9A84C' : '#fff',
              color: mode === k ? '#fff' : '#5A5A5A',
              fontSize: 13, fontWeight: mode === k ? 500 : 400, cursor: 'pointer'
            }}>{l}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: mode === 'jour' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
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
            {mode === 'jour' ? (
              <div>
                <label style={labelStyle}>Date *</label>
                <input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)} style={inputStyle} />
              </div>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Date début *</label>
                  <input type="date" value={form.date_debut} onChange={e => handleChange('date_debut', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date fin *</label>
                  <input type="date" value={form.date_fin} onChange={e => handleChange('date_fin', e.target.value)} style={inputStyle} />
                </div>
              </>
            )}
          </div>

          {mode === 'periode' && (
            <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.08)', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#8a6a1a' }}>
              Les chiffres saisis seront répartis uniformément sur chaque jour de la période.
            </div>
          )}

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
              <input type="number" value={mode === 'jour' ? leadsNets : '—'} readOnly style={{ ...inputStyle, background: '#F7F0DC', borderColor: '#C9A84C', color: '#8a6a1a', fontWeight: 500 }} />
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
