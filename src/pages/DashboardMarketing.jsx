import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'

function InfoBulle({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 5 }}>
      <span onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(201,168,76,0.2)', color: '#C9A84C', fontSize: 10, fontWeight: 700, cursor: 'help', userSelect: 'none' }}>i</span>
      {show && (
        <span style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: '#2C2C2C', color: '#fff', fontSize: 11, padding: '8px 12px', borderRadius: 8, zIndex: 999, maxWidth: 220, whiteSpace: 'normal', lineHeight: 1.5, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: 5, borderStyle: 'solid', borderColor: '#2C2C2C transparent transparent transparent' }}></span>
        </span>
      )}
    </span>
  )
}

const BULLES = {
  injections: "Nombre total de nouveaux leads reçus sur la période",
  non_exploitables: "Leads inutilisables : faux numéros, doublons, hors cible...",
  indispos: "Leads qui n'ont pas répondu après plusieurs tentatives d'appel",
  base_nette: "Leads exploitables après exclusion des non exploitables et indispos",
  suivis: "Prospects qui montrent de l'intérêt sans avoir pu fixer un RDV",
  rdv: "Leads exploitables qui ont accepté un rendez-vous",
  visites: "Leads qui se sont présentés au rendez-vous fixé",
  ventes: "Leads qui ont abouti à une vente",
  taux_non_exploitables: "Non exploitables sur le total des injections brutes",
  taux_indispos: "Indispos sur le total des injections brutes",
  taux_suivis: "Suivis sur la base nette (hors non exploitables et indispos)",
  taux_rdv: "RDV fixés sur la base nette (hors non exploitables et indispos)",
  taux_visites: "Présences sur la base nette (hors non exploitables et indispos)",
  taux_ventes: "Ventes sur la base nette (hors non exploitables et indispos)",
}

function calcTaux(val, base) {
  if (!base || base === 0) return 0
  return parseFloat(((val / base) * 100).toFixed(1))
}

function calcCV(valeurs) {
  const vals = valeurs.filter(v => v > 0)
  if (vals.length < 2) return 0
  const moy = vals.reduce((a, b) => a + b, 0) / vals.length
  if (moy === 0) return 0
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0) / vals.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

function aggreger(rows) {
  const t = rows.reduce((acc, s) => ({
    injections: acc.injections + (s.injections || 0),
    non_exploitables: acc.non_exploitables + (s.non_exploitables || 0),
    indispos: acc.indispos + (s.indispos || 0),
    suivis: acc.suivis + (s.suivis || 0),
    rdv: acc.rdv + (s.rdv || 0),
    visites: acc.visites + (s.visites || 0),
    ventes: acc.ventes + (s.ventes || 0),
  }), { injections: 0, non_exploitables: 0, indispos: 0, suivis: 0, rdv: 0, visites: 0, ventes: 0 })
  const base_nette = Math.max(0, t.injections - t.non_exploitables - t.indispos)
  return {
    ...t, base_nette,
    taux_non_exp: calcTaux(t.non_exploitables, t.injections),
    taux_indispos: calcTaux(t.indispos, t.injections),
    taux_suivis: calcTaux(t.suivis, base_nette),
    taux_rdv: calcTaux(t.rdv, base_nette),
    taux_visites: calcTaux(t.visites, base_nette),
    taux_ventes: calcTaux(t.ventes, base_nette),
  }
}

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function getQuarter(month) { return Math.floor(month / 3) + 1 }

// Composant arbre navigation
function DrillTree({ data, onSelect, selected }) {
  const [expanded, setExpanded] = useState({})

  const years = useMemo(() => {
    const ys = {}
    data.forEach(s => {
      const d = new Date(s.date)
      const y = d.getFullYear()
      const m = d.getMonth()
      const q = getQuarter(m)
      const day = d.getDate()
      if (!ys[y]) ys[y] = {}
      if (!ys[y][q]) ys[y][q] = {}
      if (!ys[y][q][m]) ys[y][q][m] = new Set()
      ys[y][q][m].add(day)
    })
    return ys
  }, [data])

  function toggle(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function isSelected(type, value) {
    return selected && selected.type === type && selected.value === value
  }

  const itemStyle = (active, level) => ({
    padding: `5px ${8 + level * 14}px`,
    fontSize: 12 - level,
    cursor: 'pointer',
    borderRadius: 6,
    background: active ? '#C9A84C' : 'transparent',
    color: active ? '#fff' : level === 0 ? '#2C2C2C' : level === 1 ? '#5A5A5A' : '#8A8A7A',
    fontWeight: active ? 600 : level === 0 ? 500 : 400,
    display: 'flex', alignItems: 'center', gap: 6,
    userSelect: 'none',
    transition: 'background 0.15s'
  })

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(201,168,76,0.15)', padding: '12px 8px', minWidth: 200, maxHeight: 500, overflowY: 'auto' }}>
      <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, padding: '0 8px 8px', fontWeight: 500 }}>Navigation</div>
      {/* Global */}
      <div style={itemStyle(isSelected('global', 'all'), 0)} onClick={() => onSelect({ type: 'global', value: 'all', label: 'Global' })}>
        Toutes les données
      </div>
      {Object.keys(years).sort().reverse().map(year => (
        <div key={year}>
          <div style={itemStyle(isSelected('year', year), 0)} onClick={() => { toggle(`y${year}`); onSelect({ type: 'year', value: year, label: year }) }}>
            <span style={{ fontSize: 10 }}>{expanded[`y${year}`] ? '▼' : '▶'}</span> {year}
          </div>
          {expanded[`y${year}`] && Object.keys(years[year]).sort((a,b) => a-b).map(q => (
            <div key={q}>
              <div style={itemStyle(isSelected('quarter', `${year}-Q${q}`), 1)} onClick={() => { toggle(`q${year}${q}`); onSelect({ type: 'quarter', value: `${year}-Q${q}`, label: `Q${q} ${year}` }) }}>
                <span style={{ fontSize: 9 }}>{expanded[`q${year}${q}`] ? '▼' : '▶'}</span> T{q} {year}
              </div>
              {expanded[`q${year}${q}`] && Object.keys(years[year][q]).sort((a,b) => a-b).map(m => (
                <div key={m}>
                  <div style={itemStyle(isSelected('month', `${year}-${String(parseInt(m)+1).padStart(2,'0')}`), 2)} onClick={() => { toggle(`m${year}${q}${m}`); onSelect({ type: 'month', value: `${year}-${String(parseInt(m)+1).padStart(2,'0')}`, label: `${MOIS[m]} ${year}` }) }}>
                    <span style={{ fontSize: 8 }}>{expanded[`m${year}${q}${m}`] ? '▼' : '▶'}</span> {MOIS[m]}
                  </div>
                  {expanded[`m${year}${q}${m}`] && [...years[year][q][m]].sort((a,b) => a-b).map(day => (
                    <div key={day} style={itemStyle(isSelected('day', `${year}-${String(parseInt(m)+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`), 3)}
                      onClick={() => onSelect({ type: 'day', value: `${year}-${String(parseInt(m)+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`, label: `${day} ${MOIS_SHORT[m]} ${year}` })}>
                      {day} {MOIS_SHORT[m]}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const KPI_LIST = [
  { key: 'injections', label: 'Injections', color: '#C9A84C', info: 'injections' },
  { key: 'non_exploitables', label: 'Non exploitables', color: '#8A8A7A', info: 'non_exploitables', taux: 'taux_non_exp', taux_info: 'taux_non_exploitables' },
  { key: 'indispos', label: 'Indispos', color: '#E05C5C', info: 'indispos', taux: 'taux_indispos', taux_info: 'taux_indispos' },
  { key: 'base_nette', label: 'Base nette', color: '#378ADD', info: 'base_nette' },
  { key: 'suivis', label: 'Suivis', color: '#C9A84C', info: 'suivis', taux: 'taux_suivis', taux_info: 'taux_suivis' },
  { key: 'rdv', label: 'RDV', color: '#534AB7', info: 'rdv', taux: 'taux_rdv', taux_info: 'taux_rdv' },
  { key: 'visites', label: 'Visites', color: '#4CAF7D', info: 'visites', taux: 'taux_visites', taux_info: 'taux_visites' },
  { key: 'ventes', label: 'Ventes', color: '#1a6b3c', info: 'ventes', taux: 'taux_ventes', taux_info: 'taux_ventes' },
]

export default function DashboardMarketing() {
  const [marketingData, setMarketingData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSaisie, setShowSaisie] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [selected, setSelected] = useState({ type: 'global', value: 'all', label: 'Global' })
  const [hiddenKpis, setHiddenKpis] = useState({})
  const [saisieMode, setSaisieMode] = useState('jour')
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ date: today, date_debut: '', date_fin: '', injections: '', non_exploitables: '', indispos: '', suivis: '', rdv: '', visites: '', ventes: '' })

  useEffect(() => { loadMarketing() }, [])

  async function loadMarketing() {
    setLoading(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase.from('marketing_saisies').select('*').order('date', { ascending: true })
      setMarketingData(data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function toggleKpi(key) {
    setHiddenKpis(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Filtrer selon sélection arbre
  const dataFiltree = useMemo(() => {
    if (!selected || selected.type === 'global') return marketingData
    return marketingData.filter(s => {
      if (selected.type === 'year') return s.date.startsWith(selected.value)
      if (selected.type === 'quarter') {
        const [y, q] = selected.value.split('-Q')
        const d = new Date(s.date)
        return d.getFullYear() === parseInt(y) && getQuarter(d.getMonth()) === parseInt(q)
      }
      if (selected.type === 'month') return s.date.startsWith(selected.value)
      if (selected.type === 'day') return s.date === selected.value
      return true
    })
  }, [marketingData, selected])

  const totaux = useMemo(() => aggreger(dataFiltree), [dataFiltree])

  // Données pour graphes (groupées selon niveau sélectionné)
  const chartData = useMemo(() => {
    if (!dataFiltree.length) return []
    const groups = {}
    dataFiltree.forEach(s => {
      const d = new Date(s.date)
      let key, label
      if (selected.type === 'day') { key = s.date; label = s.date.substring(8) }
      else if (selected.type === 'month') { key = s.date; label = s.date.substring(8) + '/' + s.date.substring(5,7) }
      else if (selected.type === 'quarter') { key = s.date.substring(0,7); const [y,m] = key.split('-'); label = MOIS_SHORT[parseInt(m)-1] + ' ' + y.substring(2) }
      else { key = s.date.substring(0,7); const [y,m] = key.split('-'); label = MOIS_SHORT[parseInt(m)-1] + ' ' + y.substring(2) }
      if (!groups[key]) groups[key] = { label, rows: [] }
      groups[key].rows.push(s)
    })
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([key, { label, rows }]) => {
      const agg = aggreger(rows)
      return { label, ...agg }
    })
  }, [dataFiltree, selected])

  const cvs = useMemo(() => ({
    taux_non_exp: calcCV(chartData.map(r => r.taux_non_exp)),
    taux_indispos: calcCV(chartData.map(r => r.taux_indispos)),
    taux_suivis: calcCV(chartData.map(r => r.taux_suivis)),
    taux_rdv: calcCV(chartData.map(r => r.taux_rdv)),
    taux_visites: calcCV(chartData.map(r => r.taux_visites)),
    taux_ventes: calcCV(chartData.map(r => r.taux_ventes)),
  }), [chartData])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { supabase } = await import('../lib/supabase')
    const base = (f) => parseInt(form[f]) || 0

    if (saisieMode === 'jour') {
      const existing = marketingData.find(s => s.date === form.date)
      const payload = {
        date: form.date,
        injections: (existing?.injections || 0) + base('injections'),
        non_exploitables: (existing?.non_exploitables || 0) + base('non_exploitables'),
        indispos: (existing?.indispos || 0) + base('indispos'),
        suivis: (existing?.suivis || 0) + base('suivis'),
        rdv: (existing?.rdv || 0) + base('rdv'),
        visites: (existing?.visites || 0) + base('visites'),
        ventes: (existing?.ventes || 0) + base('ventes'),
      }
      const { error } = await supabase.from('marketing_saisies').upsert(payload, { onConflict: 'date' })
      if (error) setMsg({ type: 'error', text: error.message })
      else { setMsg({ type: 'success', text: 'Données ajoutées !' }); loadMarketing(); setForm(p => ({ ...p, injections: '', non_exploitables: '', indispos: '', suivis: '', rdv: '', visites: '', ventes: '' })); setTimeout(() => setMsg(null), 3000) }
    } else {
      const debut = new Date(form.date_debut)
      const fin = new Date(form.date_fin)
      const days = Math.round((fin - debut) / 86400000) + 1
      if (days <= 0) { setMsg({ type: 'error', text: 'Dates invalides' }); setSaving(false); return }
      const rows = []
      for (let i = 0; i < days; i++) {
        const d = new Date(debut); d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        const existing = marketingData.find(s => s.date === dateStr)
        rows.push({
          date: dateStr,
          injections: (existing?.injections || 0) + Math.round(base('injections') / days),
          non_exploitables: (existing?.non_exploitables || 0) + Math.round(base('non_exploitables') / days),
          indispos: (existing?.indispos || 0) + Math.round(base('indispos') / days),
          suivis: (existing?.suivis || 0) + Math.round(base('suivis') / days),
          rdv: (existing?.rdv || 0) + Math.round(base('rdv') / days),
          visites: (existing?.visites || 0) + Math.round(base('visites') / days),
          ventes: (existing?.ventes || 0) + Math.round(base('ventes') / days),
        })
      }
      const { error } = await supabase.from('marketing_saisies').upsert(rows, { onConflict: 'date' })
      if (error) setMsg({ type: 'error', text: error.message })
      else { setMsg({ type: 'success', text: `Données ajoutées sur ${days} jours !` }); loadMarketing(); setTimeout(() => setMsg(null), 3000) }
    }
    setSaving(false)
  }

  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const thStyle = { fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, whiteSpace: 'nowrap' }
  const tdStyle = { padding: '9px 8px', fontSize: 11, borderBottom: '1px solid rgba(201,168,76,0.06)', whiteSpace: 'nowrap' }
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none' }
  const labelStyle = { fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 5, display: 'flex', alignItems: 'center' }

  const visibleKpis = KPI_LIST.filter(k => !hiddenKpis[k.key])

  return (
    <div>
      <PageHeader title="Dashboard Marketing" subtitle={selected.label}>
        <button onClick={() => setShowSaisie(!showSaisie)} style={{
          padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C',
          background: showSaisie ? '#C9A84C' : '#fff', color: showSaisie ? '#fff' : '#C9A84C',
          fontSize: 12, fontWeight: 500, cursor: 'pointer'
        }}>
          {showSaisie ? '✕ Fermer' : '+ Saisir données'}
        </button>
      </PageHeader>

      {showSaisie && (
        <div style={{ ...cardStyle, borderColor: '#C9A84C' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16, color: '#2C2C2C' }}>
            Saisie rétroactive — les valeurs s'ajoutent aux données existantes de la date choisie
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['jour', 'Par jour'], ['periode', 'Par période']].map(([k, l]) => (
              <button key={k} onClick={() => setSaisieMode(k)} style={{
                padding: '7px 18px', borderRadius: 16,
                border: `1.5px solid ${saisieMode === k ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
                background: saisieMode === k ? '#C9A84C' : '#fff',
                color: saisieMode === k ? '#fff' : '#5A5A5A',
                fontSize: 12, cursor: 'pointer', fontWeight: saisieMode === k ? 500 : 400
              }}>{l}</button>
            ))}
          </div>
          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>{msg.text}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: saisieMode === 'jour' ? '200px' : '200px 200px', gap: 16, marginBottom: 16 }}>
              {saisieMode === 'jour' ? (
                <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></div>
              ) : (
                <>
                  <div><label style={labelStyle}>Date début</label><input type="date" value={form.date_debut} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Date fin</label><input type="date" value={form.date_fin} onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))} style={inputStyle} /></div>
                </>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { key: 'injections', label: 'Injections', info: 'injections', color: '#C9A84C' },
                { key: 'non_exploitables', label: 'Non exploitables', info: 'non_exploitables', color: '#8A8A7A' },
                { key: 'indispos', label: 'Indispos', info: 'indispos', color: '#E05C5C' },
                { key: 'suivis', label: 'Suivis', info: 'suivis', color: '#C9A84C' },
                { key: 'rdv', label: 'RDV', info: 'rdv', color: '#534AB7' },
                { key: 'visites', label: 'Visites', info: 'visites', color: '#4CAF7D' },
                { key: 'ventes', label: 'Ventes', info: 'ventes', color: '#1a6b3c' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ ...labelStyle, color: f.color }}>{f.label}<InfoBulle text={BULLES[f.info]} /></label>
                  <input type="number" min="0" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder="0" style={{ ...inputStyle, borderColor: `${f.color}50` }} />
                </div>
              ))}
            </div>
            <button type="submit" disabled={saving} style={{ background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '11px 28px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        <DrillTree data={marketingData} onSelect={setSelected} selected={selected} />

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>KPIs — {selected.label}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {KPI_LIST.map(k => (
                <button key={k.key} onClick={() => toggleKpi(k.key)} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 11,
                  border: `1px solid ${hiddenKpis[k.key] ? 'rgba(201,168,76,0.2)' : k.color}`,
                  background: hiddenKpis[k.key] ? '#F8F7F4' : `${k.color}15`,
                  color: hiddenKpis[k.key] ? '#8A8A7A' : k.color,
                  cursor: 'pointer', textDecoration: hiddenKpis[k.key] ? 'line-through' : 'none'
                }}>{k.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
            {visibleKpis.map(k => (
              <div key={k.key} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(201,168,76,0.15)', borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                  {k.label}<InfoBulle text={BULLES[k.info]} />
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: k.color, lineHeight: 1 }}>{totaux[k.key]}</div>
                {k.taux && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: k.color }}>{totaux[k.taux]}%</span>
                    <InfoBulle text={BULLES[k.taux_info]} />
                    <span style={{ fontSize: 10, color: '#8A8A7A' }}>CV: {cvs[k.taux] || 0}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Qualité des leads</div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 14 }}>CV Non exploit.: <span style={{ color: '#8A8A7A', fontWeight: 500 }}>{cvs.taux_non_exp}%</span> · Indispos: <span style={{ color: '#E05C5C', fontWeight: 500 }}>{cvs.taux_indispos}%</span></div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
                  <Bar dataKey="taux_non_exp" fill="#8A8A7A" radius={[3,3,0,0]} name="Non exploit." />
                  <Bar dataKey="taux_indispos" fill="#E05C5C" radius={[3,3,0,0]} name="Indispos" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#8A8A7A', display: 'inline-block' }}></span>Non exploitables</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#E05C5C', display: 'inline-block' }}></span>Indispos</span>
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Pipeline conversion</div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 14 }}>CV RDV: <span style={{ color: '#534AB7', fontWeight: 500 }}>{cvs.taux_rdv}%</span> · Visites: <span style={{ color: '#4CAF7D', fontWeight: 500 }}>{cvs.taux_visites}%</span></div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
                  <Line type="monotone" dataKey="taux_suivis" stroke="#C9A84C" strokeWidth={2} dot={{ r: 3 }} name="Suivis" />
                  <Line type="monotone" dataKey="taux_rdv" stroke="#534AB7" strokeWidth={2} dot={{ r: 3 }} name="RDV" />
                  <Line type="monotone" dataKey="taux_visites" stroke="#4CAF7D" strokeWidth={2} dot={{ r: 3 }} name="Visites" />
                  <Line type="monotone" dataKey="taux_ventes" stroke="#1a6b3c" strokeWidth={2} dot={{ r: 3 }} name="Ventes" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                {[['#C9A84C','Suivis'],['#534AB7','RDV'],['#4CAF7D','Visites'],['#1a6b3c','Ventes']].map(([c,l]) => (
                  <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}>
                    <span style={{ width: 14, height: 2, background: c, display: 'inline-block' }}></span>{l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <SectionTitle>Vue Cohorte</SectionTitle>
          <div style={cardStyle}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Période</th>
                    <th style={thStyle}>Inject. <InfoBulle text={BULLES.injections} /></th>
                    <th style={{ ...thStyle, color: '#8A8A7A' }}>Non Expl. <InfoBulle text={BULLES.non_exploitables} /></th>
                    <th style={{ ...thStyle, color: '#8A8A7A' }}>Taux <InfoBulle text={BULLES.taux_non_exploitables} /></th>
                    <th style={thStyle}>Indispos <InfoBulle text={BULLES.indispos} /></th>
                    <th style={thStyle}>Taux <InfoBulle text={BULLES.taux_indispos} /></th>
                    <th style={{ ...thStyle, color: '#378ADD' }}>Base Nette <InfoBulle text={BULLES.base_nette} /></th>
                    <th style={thStyle}>Suivis <InfoBulle text={BULLES.suivis} /></th>
                    <th style={thStyle}>Taux <InfoBulle text={BULLES.taux_suivis} /></th>
                    <th style={{ ...thStyle, color: '#534AB7' }}>RDV <InfoBulle text={BULLES.rdv} /></th>
                    <th style={{ ...thStyle, color: '#534AB7' }}>Taux <InfoBulle text={BULLES.taux_rdv} /></th>
                    <th style={{ ...thStyle, color: '#4CAF7D' }}>Visites <InfoBulle text={BULLES.visites} /></th>
                    <th style={{ ...thStyle, color: '#4CAF7D' }}>Taux <InfoBulle text={BULLES.taux_visites} /></th>
                    <th style={{ ...thStyle, color: '#1a6b3c' }}>Ventes <InfoBulle text={BULLES.ventes} /></th>
                    <th style={{ ...thStyle, color: '#1a6b3c' }}>Taux <InfoBulle text={BULLES.taux_ventes} /></th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartData].reverse().map((row, i) => (
                    <tr key={i} onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...tdStyle, fontWeight: 500, color: '#C9A84C' }}>{row.label}</td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{row.injections}</td>
                      <td style={{ ...tdStyle, color: '#8A8A7A' }}>{row.non_exploitables}</td>
                      <td style={{ ...tdStyle, color: '#8A8A7A', fontSize: 10 }}>{row.taux_non_exp}%</td>
                      <td style={{ ...tdStyle, color: '#E05C5C' }}>{row.indispos}</td>
                      <td style={{ ...tdStyle, color: '#E05C5C', fontSize: 10 }}>{row.taux_indispos}%</td>
                      <td style={{ ...tdStyle, color: '#378ADD', fontWeight: 500 }}>{row.base_nette}</td>
                      <td style={{ ...tdStyle, color: '#C9A84C' }}>{row.suivis}</td>
                      <td style={{ ...tdStyle, color: '#C9A84C', fontSize: 10 }}>{row.taux_suivis}%</td>
                      <td style={{ ...tdStyle, color: '#534AB7' }}>{row.rdv}</td>
                      <td style={{ ...tdStyle, color: '#534AB7', fontSize: 10 }}>{row.taux_rdv}%</td>
                      <td style={{ ...tdStyle, color: '#4CAF7D' }}>{row.visites}</td>
                      <td style={{ ...tdStyle, color: '#4CAF7D', fontSize: 10 }}>{row.taux_visites}%</td>
                      <td style={{ ...tdStyle, color: '#1a6b3c' }}>{row.ventes}</td>
                      <td style={{ ...tdStyle, color: '#1a6b3c', fontSize: 10 }}>{row.taux_ventes}%</td>
                    </tr>
                  ))}
                  {chartData.length === 0 && (
                    <tr><td colSpan={15} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Aucune donnée. Cliquez sur "+ Saisir données" pour commencer.</td></tr>
                  )}
                </tbody>
                {chartData.length > 1 && (
                  <tfoot>
                    <tr style={{ background: '#F8F7F4', fontWeight: 600 }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#2C2C2C' }}>CV</td>
                      <td style={tdStyle}>—</td>
                      <td style={tdStyle}>—</td>
                      <td style={{ ...tdStyle, color: '#8A8A7A', fontWeight: 600 }}>{cvs.taux_non_exp}%</td>
                      <td style={tdStyle}>—</td>
                      <td style={{ ...tdStyle, color: '#E05C5C', fontWeight: 600 }}>{cvs.taux_indispos}%</td>
                      <td style={tdStyle}>—</td>
                      <td style={tdStyle}>—</td>
                      <td style={{ ...tdStyle, color: '#C9A84C', fontWeight: 600 }}>{cvs.taux_suivis}%</td>
                      <td style={tdStyle}>—</td>
                      <td style={{ ...tdStyle, color: '#534AB7', fontWeight: 600 }}>{cvs.taux_rdv}%</td>
                      <td style={tdStyle}>—</td>
                      <td style={{ ...tdStyle, color: '#4CAF7D', fontWeight: 600 }}>{cvs.taux_visites}%</td>
                      <td style={tdStyle}>—</td>
                      <td style={{ ...tdStyle, color: '#1a6b3c', fontWeight: 600 }}>{cvs.taux_ventes}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
