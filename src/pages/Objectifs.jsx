import React, { useState, useEffect, useMemo } from 'react'
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

async function getJoursOuvrables(mois, calendrier) {
  const [year, month] = mois.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const nonOuvrables = new Set(calendrier.filter(j => j.type === 'ferie' || j.type === 'conge').map(j => j.date))
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0) continue // Dimanche
    if (!nonOuvrables.has(dateStr)) count++
  }
  return count
}

const KPI_FIELDS = [
  { key: 'productivite', label: 'Productivité', sub: 'Nb échanges', pctKey: 'obj_productivite_pct', nbKey: 'obj_echanges_nb', jourKey: 'obj_echanges_jour', color: '#378ADD' },
  { key: 'conv_tel', label: 'Conv. Téléphonique', sub: 'Nb RDV', pctKey: 'obj_conv_tel_pct', nbKey: 'obj_rdv_nb', jourKey: 'obj_rdv_jour', color: '#C9A84C' },
  { key: 'presence', label: 'Taux de Présence', sub: 'Nb visites', pctKey: 'obj_presence_pct', nbKey: 'obj_visites_nb', jourKey: 'obj_visites_jour', color: '#4CAF7D' },
  { key: 'efficacite', label: 'Efficacité Commerciale', sub: 'Nb ventes', pctKey: 'obj_efficacite_pct', nbKey: 'obj_ventes_nb', jourKey: 'obj_ventes_jour', color: '#534AB7' },
]

export default function Objectifs({ conseilleres }) {
  const [tab, setTab] = useState('callcenter')
  const moisOptions = getMoisOptions()
  const currentMois = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`
  const [mois, setMois] = useState(currentMois)
  const [selectedConseillere, setSelectedConseillere] = useState('equipe')
  const [objectifs, setObjectifs] = useState({})
  const [calendrier, setCalendrier] = useState([])
  const [joursOuvrables, setJoursOuvrables] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [verrouille, setVerrouille] = useState(false)
  const [champsVerrouilles, setChampsVerrouilles] = useState({})

  useEffect(() => {
    loadCalendrier()
  }, [])

  useEffect(() => {
    if (calendrier.length > 0) {
      getJoursOuvrables(mois, calendrier).then(j => setJoursOuvrables(j))
    }
    loadObjectifs()
  }, [mois, selectedConseillere, calendrier])

  async function loadCalendrier() {
    const { data } = await supabase.from('calendrier').select('*')
    setCalendrier(data || [])
  }

  async function loadObjectifs() {
    const query = supabase.from('objectifs_callcenter').select('*').eq('mois', mois)
    if (selectedConseillere === 'equipe') {
      query.is('conseillere_id', null)
    } else {
      query.eq('conseillere_id', selectedConseillere)
    }
    const { data } = await query.maybeSingle()
    if (data) {
      setObjectifs(data)
      setVerrouille(data.verrouille || false)
      const verr = {}
      KPI_FIELDS.forEach(f => {
        if (data[f.pctKey] > 0) verr[f.pctKey] = true
        if (data[f.nbKey] > 0) verr[f.nbKey] = true
      })
      setChampsVerrouilles(verr)
    } else {
      setObjectifs({})
      setVerrouille(false)
      setChampsVerrouilles({})
    }
  }

  function handleChange(key, value) {
    if (verrouille && champsVerrouilles[key]) return
    const cleaned = value.replace(/[^0-9.]/g, '')
    const numVal = parseFloat(cleaned) || 0
    setObjectifs(prev => {
      const updated = { ...prev, [key]: cleaned }
      // Auto-calcul objectif journalier
      KPI_FIELDS.forEach(f => {
        if (key === f.nbKey && joursOuvrables > 0) {
          updated[f.jourKey] = parseFloat((numVal / joursOuvrables).toFixed(2))
        }
      })
      return updated
    })
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      mois,
      conseillere_id: selectedConseillere === 'equipe' ? null : selectedConseillere,
      jours_ouvrables: joursOuvrables,
      verrouille,
    }
    KPI_FIELDS.forEach(f => {
      payload[f.pctKey] = parseFloat(objectifs[f.pctKey]) || 0
      payload[f.nbKey] = parseFloat(objectifs[f.nbKey]) || 0
      payload[f.jourKey] = joursOuvrables > 0 ? parseFloat(((parseFloat(objectifs[f.nbKey])||0) / joursOuvrables).toFixed(2)) : 0
    })
    const conflictKeys = selectedConseillere === 'equipe' ? 'mois' : 'conseillere_id,mois'
    const { error } = await supabase.from('objectifs_callcenter').upsert(payload, { onConflict: conflictKeys })
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'success', text: 'Objectifs enregistrés !' })
      loadObjectifs()
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function toggleVerrouillage() {
    const newVal = !verrouille
    setVerrouille(newVal)
    if (newVal) {
      const verr = {}
      KPI_FIELDS.forEach(f => {
        if (parseFloat(objectifs[f.pctKey]) > 0) verr[f.pctKey] = true
        if (parseFloat(objectifs[f.nbKey]) > 0) verr[f.nbKey] = true
      })
      setChampsVerrouilles(verr)
    } else {
      setChampsVerrouilles({})
    }
  }

  const moisLabel = moisOptions.find(m => m.val === mois)?.label || mois
  const inputStyle = (key, color) => ({
    width: '100%', padding: '9px 12px',
    border: `1.5px solid ${(verrouille && champsVerrouilles[key]) ? 'rgba(138,138,122,0.3)' : `${color}40`}`,
    borderRadius: 8, fontSize: 13,
    color: (verrouille && champsVerrouilles[key]) ? '#8A8A7A' : '#2C2C2C',
    background: (verrouille && champsVerrouilles[key]) ? '#F0EEE8' : '#F8F7F4',
    outline: 'none', textAlign: 'center',
    cursor: (verrouille && champsVerrouilles[key]) ? 'not-allowed' : 'text'
  })

  return (
    <div>
      <PageHeader title="Objectifs" subtitle="Objectifs mensuels par KPI et par conseillère" />

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
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

        <div style={{ position: 'relative' }}>
          <select value={selectedConseillere} onChange={e => setSelectedConseillere(e.target.value)} style={{ padding: '8px 32px 8px 14px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.25)', background: '#fff', fontSize: 13, color: '#2C2C2C', cursor: 'pointer', outline: 'none', appearance: 'none' }}>
            <option value="equipe">Objectif Équipe</option>
            {conseilleres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', fontSize: 11 }}>▼</span>
        </div>
      </div>

      {tab === 'callcenter' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, border: '1px solid rgba(201,168,76,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#2C2C2C' }}>
                Call Center — <span style={{ color: '#C9A84C' }}>{moisLabel}</span>
                {selectedConseillere !== 'equipe' && <span style={{ color: '#5A5A5A', fontSize: 13, fontWeight: 400 }}> · {conseilleres.find(c=>c.id===selectedConseillere)?.nom}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 4 }}>
                {joursOuvrables} jours ouvrables ce mois
                <span style={{ color: '#C9A84C', marginLeft: 8 }}>→ objectif journalier calculé automatiquement</span>
              </div>
            </div>
            <button onClick={toggleVerrouillage} style={{
              padding: '8px 18px', borderRadius: 20,
              border: `1.5px solid ${verrouille ? '#E05C5C' : '#4CAF7D'}`,
              background: verrouille ? 'rgba(224,92,92,0.08)' : 'rgba(76,175,125,0.08)',
              color: verrouille ? '#E05C5C' : '#4CAF7D',
              fontSize: 12, fontWeight: 500, cursor: 'pointer'
            }}>
              {verrouille ? '🔒 Verrouillé' : '🔓 Déverrouillé'}
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>KPI</th>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Indicateur chiffre</th>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Objectif %</th>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Objectif mensuel</th>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Objectif / jour</th>
              </tr>
            </thead>
            <tbody>
              {KPI_FIELDS.map(f => {
                const jourVal = joursOuvrables > 0 && objectifs[f.nbKey] ? parseFloat((parseFloat(objectifs[f.nbKey]) / joursOuvrables).toFixed(2)) : 0
                return (
                  <tr key={f.key}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: f.color }}>{f.label}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                      <div style={{ fontSize: 12, color: '#8A8A7A' }}>{f.sub}</div>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', width: '20%' }}>
                      <input type="text" inputMode="decimal"
                        value={objectifs[f.pctKey] || ''}
                        onChange={e => handleChange(f.pctKey, e.target.value)}
                        placeholder="ex: 25%"
                        readOnly={verrouille && champsVerrouilles[f.pctKey]}
                        style={inputStyle(f.pctKey, f.color)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', width: '20%' }}>
                      <input type="text" inputMode="decimal"
                        value={objectifs[f.nbKey] || ''}
                        onChange={e => handleChange(f.nbKey, e.target.value)}
                        placeholder="ex: 500"
                        readOnly={verrouille && champsVerrouilles[f.nbKey]}
                        style={inputStyle(f.nbKey, f.color)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', width: '20%' }}>
                      <div style={{ textAlign: 'center', padding: '9px 12px', background: jourVal > 0 ? `${f.color}10` : '#F8F7F4', borderRadius: 8, fontSize: 13, fontWeight: jourVal > 0 ? 600 : 400, color: jourVal > 0 ? f.color : '#8A8A7A', border: `1.5px solid ${jourVal > 0 ? `${f.color}30` : 'rgba(201,168,76,0.1)'}` }}>
                        {jourVal > 0 ? jourVal : '—'}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, alignItems: 'center' }}>
            <button onClick={handleSave} disabled={saving} style={{ background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Enregistrement...' : `Sauvegarder — ${moisLabel}`}
            </button>
            {verrouille && (
              <div style={{ fontSize: 12, color: '#E05C5C' }}>🔒 Les champs renseignés sont verrouillés</div>
            )}
          </div>

          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(201,168,76,0.05)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.15)', fontSize: 12, color: '#5A5A5A' }}>
            <strong style={{ color: '#C9A84C' }}>Note :</strong> L'objectif journalier = objectif mensuel ÷ {joursOuvrables} jours ouvrables. Les couleurs des KPIs dans le dashboard s'adaptent automatiquement.
          </div>
        </div>
      )}

      {tab === 'marketing' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, border: '1px solid rgba(201,168,76,0.15)', color: '#5A5A5A', textAlign: 'center', fontSize: 13 }}>
          Les objectifs Marketing seront disponibles prochainement.
        </div>
      )}
    </div>
  )
}
