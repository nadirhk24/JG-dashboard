import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function getMoisOptions() {
  const now = new Date()
  const options = []
  for (let i = -3; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
    const label = `${MOIS_LABELS[d.getMonth()]} ${d.getFullYear()}`
    options.push({ val, label })
  }
  return options
}

const CC_FIELDS = [
  { key: 'obj_conv_tel', label: 'Conv. Téléphonique', color: '#C9A84C', hasPct: true, hasNb: true },
  { key: 'obj_presence', label: 'Taux de Présence', color: '#4CAF7D', hasPct: true, hasNb: false },
  { key: 'obj_efficacite', label: 'Efficacité Commerciale', color: '#534AB7', hasPct: true, hasNb: true },
  { key: 'obj_productivite', label: 'Productivité', color: '#378ADD', hasPct: true, hasNb: false },
  { key: 'obj_joignabilite', label: 'Joignabilité', color: '#2E9455', hasPct: true, hasNb: false },
  { key: 'obj_rdv', label: 'Total RDV', color: '#C9A84C', hasPct: false, hasNb: true },
  { key: 'obj_ventes', label: 'Total Ventes', color: '#1a6b3c', hasPct: false, hasNb: true },
]

const MKT_FIELDS = [
  { key: 'obj_injections', label: 'Injections', color: '#C9A84C', hasPct: false, hasNb: true },
  { key: 'obj_rdv', label: 'RDV', color: '#534AB7', hasPct: true, hasNb: true },
  { key: 'obj_visites', label: 'Visites', color: '#4CAF7D', hasPct: true, hasNb: true },
  { key: 'obj_ventes', label: 'Ventes', color: '#1a6b3c', hasPct: true, hasNb: true },
  { key: 'obj_suivis', label: 'Suivis', color: '#C9A84C', hasPct: true, hasNb: false },
  { key: 'obj_indispos', label: 'Indispos max', color: '#E05C5C', hasPct: true, hasNb: false },
  { key: 'obj_non_exp', label: 'Non exploit. max', color: '#8A8A7A', hasPct: true, hasNb: false },
]

export default function Objectifs() {
  const [tab, setTab] = useState('callcenter')
  const moisOptions = getMoisOptions()
  const currentMois = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`
  const [mois, setMois] = useState(currentMois)
  const [formCC, setFormCC] = useState({})
  const [formMkt, setFormMkt] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { loadObjectifs() }, [mois])

  async function loadObjectifs() {
    const [{ data: cc }, { data: mkt }] = await Promise.all([
      supabase.from('objectifs_callcenter').select('*').eq('mois', mois).maybeSingle(),
      supabase.from('objectifs_marketing').select('*').eq('mois', mois).maybeSingle()
    ])
    setFormCC(cc || {})
    setFormMkt(mkt || {})
  }

  async function handleSave() {
    setSaving(true)
    const table = tab === 'callcenter' ? 'objectifs_callcenter' : 'objectifs_marketing'
    const form = tab === 'callcenter' ? formCC : formMkt
    const payload = { ...form, mois }
    // Nettoyer les valeurs non numeriques
    Object.keys(payload).forEach(k => {
      if (k !== 'mois' && k !== 'id' && k !== 'created_at') {
        payload[k] = parseFloat(payload[k]) || 0
      }
    })
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'mois' })
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Objectifs enregistrés !' }); setTimeout(() => setMsg(null), 3000) }
  }

  function handleChange(setForm, key, type, value) {
    // Bloquer les lettres — accepter uniquement chiffres et point decimal
    const cleaned = value.replace(/[^0-9.]/g, '')
    setForm(prev => ({ ...prev, [`${key}_${type}`]: cleaned }))
  }

  const inputStyle = (color) => ({
    width: '100%', padding: '9px 12px',
    border: `1.5px solid ${color}30`,
    borderRadius: 8, fontSize: 13, color: '#2C2C2C',
    background: '#F8F7F4', outline: 'none', textAlign: 'center',
    fontFamily: 'DM Sans, sans-serif'
  })

  const fields = tab === 'callcenter' ? CC_FIELDS : MKT_FIELDS
  const form = tab === 'callcenter' ? formCC : formMkt
  const setForm = tab === 'callcenter' ? setFormCC : setFormMkt
  const moisLabel = moisOptions.find(m => m.val === mois)?.label || mois

  return (
    <div>
      <PageHeader title="Objectifs" subtitle="Fixe les objectifs mensuels par KPI" />

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030', border: `1px solid ${msg.type === 'success' ? 'rgba(76,175,125,0.3)' : 'rgba(224,92,92,0.3)'}` }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['callcenter','Call Center'],['marketing','Marketing']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 20px', borderRadius: 20, border: `1.5px solid ${tab===k?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: tab===k?'#C9A84C':'#fff', color: tab===k?'#fff':'#5A5A5A', fontSize: 13, fontWeight: tab===k?500:400, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <select value={mois} onChange={e => setMois(e.target.value)} style={{ padding: '8px 32px 8px 14px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.25)', background: '#fff', fontSize: 13, color: '#2C2C2C', cursor: 'pointer', outline: 'none', appearance: 'none' }}>
            {moisOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', fontSize: 11 }}>▼</span>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 28, border: '1px solid rgba(201,168,76,0.15)' }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#2C2C2C', marginBottom: 20 }}>
          Objectifs {tab === 'callcenter' ? 'Call Center' : 'Marketing'} — <span style={{ color: '#C9A84C' }}>{moisLabel}</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>KPI</th>
              <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Objectif %</th>
              <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Objectif chiffre</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.key}>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: f.color, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{f.label}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', width: '30%' }}>
                  {f.hasPct ? (
                    <input
                      type="text" inputMode="decimal"
                      value={form[`${f.key}_pct`] || ''}
                      onChange={e => handleChange(setForm, f.key, 'pct', e.target.value)}
                      placeholder="ex: 25"
                      style={inputStyle(f.color)}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#8A8A7A', fontSize: 12 }}>—</div>
                  )}
                </td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', width: '30%' }}>
                  {f.hasNb ? (
                    <input
                      type="text" inputMode="decimal"
                      value={form[`${f.key}_nb`] || ''}
                      onChange={e => handleChange(setForm, f.key, 'nb', e.target.value)}
                      placeholder="ex: 50"
                      style={inputStyle(f.color)}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#8A8A7A', fontSize: 12 }}>—</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button onClick={handleSave} disabled={saving} style={{ marginTop: 24, background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Enregistrement...' : `Sauvegarder — ${moisLabel}`}
        </button>

        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(201,168,76,0.05)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.15)', fontSize: 12, color: '#5A5A5A' }}>
          <strong style={{ color: '#C9A84C' }}>Note :</strong> Les couleurs des KPIs s'adaptent automatiquement selon ces objectifs. Rouge = en dessous, vert = atteint ou dépassé.
        </div>
      </div>
    </div>
  )
}
