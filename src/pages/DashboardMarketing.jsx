import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'

function InfoBulle({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 5, zIndex: 50 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(201,168,76,0.25)', color: '#C9A84C', fontSize: 10, fontWeight: 700, cursor: 'pointer', userSelect: 'none', border: '1px solid rgba(201,168,76,0.4)' }}>
        i
      </span>
      {show && (
        <span style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: '#2C2C2C', color: '#fff', fontSize: 11, padding: '8px 12px', borderRadius: 8, zIndex: 9999, width: 200, whiteSpace: 'normal', lineHeight: 1.5, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
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

function DrillTree({ data, onSelect, selected }) {
  const [expanded, setExpanded] = useState({})
  const years = useMemo(() => {
    const ys = {}
    data.forEach(s => {
      const d = new Date(s.date)
      const y = d.getFullYear(), m = d.getMonth(), q = getQuarter(m), day = d.getDate()
      if (!ys[y]) ys[y] = {}
      if (!ys[y][q]) ys[y][q] = {}
      if (!ys[y][q][m]) ys[y][q][m] = new Set()
      ys[y][q][m].add(day)
    })
    return ys
  }, [data])

  function toggle(key) { setExpanded(prev => ({ ...prev, [key]: !prev[key] })) }
  function isSelected(type, value) { return selected && selected.type === type && selected.value === value }

  const item = (label, type, value, level, hasChildren) => {
    const active = isSelected(type, value)
    return (
      <div style={{ padding: `5px ${8 + level * 12}px`, fontSize: Math.max(10, 12 - level), cursor: 'pointer', borderRadius: 6, background: active ? '#C9A84C' : 'transparent', color: active ? '#fff' : level === 0 ? '#2C2C2C' : '#5A5A5A', fontWeight: active ? 600 : level === 0 ? 500 : 400, display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.15s', userSelect: 'none' }}
        onClick={() => { if (hasChildren) toggle(`${type}${value}`); onSelect({ type, value, label }) }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F7F0DC' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        {hasChildren && <span style={{ fontSize: 8 }}>{expanded[`${type}${value}`] ? '▼' : '▶'}</span>}
        {label}
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(201,168,76,0.15)', padding: '12px 8px', minWidth: 190, maxHeight: 520, overflowY: 'auto', position: 'sticky', top: 0 }}>
      <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, padding: '0 8px 8px', fontWeight: 500 }}>Navigation</div>
      {item('Toutes les données', 'global', 'all', 0, false)}
      {Object.keys(years).sort().reverse().map(year => (
        <div key={year}>
          {item(year, 'year', year, 0, true)}
          {expanded[`yearyear`] || expanded[`year${year}`] ? Object.keys(years[year]).sort((a,b) => a-b).map(q => (
            <div key={q}>
              {item(`T${q} ${year}`, 'quarter', `${year}-Q${q}`, 1, true)}
              {expanded[`quarter${year}-Q${q}`] ? Object.keys(years[year][q]).sort((a,b) => a-b).map(m => {
                const mKey = `${year}-${String(parseInt(m)+1).padStart(2,'0')}`
                return (
                  <div key={m}>
                    {item(MOIS[m], 'month', mKey, 2, true)}
                    {expanded[`month${mKey}`] ? [...years[year][q][m]].sort((a,b)=>a-b).map(day => {
                      const dKey = `${mKey}-${String(day).padStart(2,'0')}`
                      return <div key={day}>{item(`${day} ${MOIS_SHORT[m]}`, 'day', dKey, 3, false)}</div>
                    }) : null}
                  </div>
                )
              }) : null}
            </div>
          )) : null}
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

const GRAPH1_SERIES = [
  { key: 'taux_non_exp', label: 'Non exploitables', color: '#8A8A7A' },
  { key: 'taux_indispos', label: 'Indispos', color: '#E05C5C' },
]

const GRAPH2_SERIES = [
  { key: 'taux_suivis', label: 'Suivis', color: '#C9A84C' },
  { key: 'taux_rdv', label: 'RDV', color: '#534AB7' },
  { key: 'taux_visites', label: 'Visites', color: '#4CAF7D' },
  { key: 'taux_ventes', label: 'Ventes', color: '#1a6b3c' },
]

const COHORT_COLS = [
  { key: 'injections', label: 'Inject.', info: 'injections', color: '#2C2C2C' },
  { key: 'non_exploitables', label: 'Non Expl.', info: 'non_exploitables', color: '#8A8A7A' },
  { key: 'taux_non_exp', label: 'Taux', info: 'taux_non_exploitables', color: '#8A8A7A', small: true },
  { key: 'indispos', label: 'Indispos', info: 'indispos', color: '#E05C5C' },
  { key: 'taux_indispos', label: 'Taux', info: 'taux_indispos', color: '#E05C5C', small: true },
  { key: 'base_nette', label: 'Base Nette', info: 'base_nette', color: '#378ADD', bold: true },
  { key: 'suivis', label: 'Suivis', info: 'suivis', color: '#C9A84C' },
  { key: 'taux_suivis', label: 'Taux', info: 'taux_suivis', color: '#C9A84C', small: true },
  { key: 'rdv', label: 'RDV', info: 'rdv', color: '#534AB7' },
  { key: 'taux_rdv', label: 'Taux', info: 'taux_rdv', color: '#534AB7', small: true },
  { key: 'visites', label: 'Visites', info: 'visites', color: '#4CAF7D' },
  { key: 'taux_visites', label: 'Taux', info: 'taux_visites', color: '#4CAF7D', small: true },
  { key: 'ventes', label: 'Ventes', info: 'ventes', color: '#1a6b3c' },
  { key: 'taux_ventes', label: 'Taux', info: 'taux_ventes', color: '#1a6b3c', small: true },
]

export default function DashboardMarketing() {
  const [marketingData, setMarketingData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSaisie, setShowSaisie] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [selected, setSelected] = useState({ type: 'global', value: 'all', label: 'Global' })
  const [hiddenKpis, setHiddenKpis] = useState({})
  const [hiddenG1, setHiddenG1] = useState({})
  const [hiddenG2, setHiddenG2] = useState({})
  const [hiddenCols, setHiddenCols] = useState({})
  const [showColMenu, setShowColMenu] = useState(false)
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

  const chartData = useMemo(() => {
    if (!dataFiltree.length) return []
    const groups = {}
    dataFiltree.forEach(s => {
      const d = new Date(s.date)
      let key, label
      if (selected.type === 'day' || selected.type === 'month') {
        key = s.date; label = s.date.substring(8) + '/' + s.date.substring(5, 7)
      } else {
        key = s.date.substring(0, 7)
        const [y, m] = key.split('-')
        label = MOIS_SHORT[parseInt(m) - 1] + ' ' + y.substring(2)
      }
      if (!groups[key]) groups[key] = { label, rows: [] }
      groups[key].rows.push(s)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, { label, rows }]) => ({ label, ...aggreger(rows) }))
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
      const debut = new Date(form.date_debut), fin = new Date(form.date_fin)
      const days = Math.round((fin - debut) / 86400000) + 1
      if (days <= 0) { setMsg({ type: 'error', text: 'Dates invalides' }); setSaving(false); return }
      const rows = []
      for (let i = 0; i < days; i++) {
        const d = new Date(debut); d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        const ex = marketingData.find(s => s.date === dateStr)
        rows.push({ date: dateStr, injections: (ex?.injections||0)+Math.round(base('injections')/days), non_exploitables: (ex?.non_exploitables||0)+Math.round(base('non_exploitables')/days), indispos: (ex?.indispos||0)+Math.round(base('indispos')/days), suivis: (ex?.suivis||0)+Math.round(base('suivis')/days), rdv: (ex?.rdv||0)+Math.round(base('rdv')/days), visites: (ex?.visites||0)+Math.round(base('visites')/days), ventes: (ex?.ventes||0)+Math.round(base('ventes')/days) })
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

  const visibleCols = COHORT_COLS.filter(c => !hiddenCols[c.key])

  function toggleSeries(set, key) {
    set(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div>
      <PageHeader title="Dashboard Marketing" subtitle={selected.label}>
        <button onClick={() => setShowSaisie(!showSaisie)} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showSaisie ? '#C9A84C' : '#fff', color: showSaisie ? '#fff' : '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showSaisie ? '✕ Fermer' : '+ Saisir données'}
        </button>
      </PageHeader>

      {showSaisie && (
        <div style={{ ...cardStyle, borderColor: '#C9A84C' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#2C2C2C' }}>Saisie rétroactive</div>
          <div style={{ fontSize: 12, color: '#8A8A7A', marginBottom: 16 }}>Les valeurs s'ajoutent aux données existantes de la date choisie</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['jour','Par jour'],['periode','Par période']].map(([k,l]) => (
              <button key={k} onClick={() => setSaisieMode(k)} style={{ padding: '7px 18px', borderRadius: 16, border: `1.5px solid ${saisieMode===k?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: saisieMode===k?'#C9A84C':'#fff', color: saisieMode===k?'#fff':'#5A5A5A', fontSize: 12, cursor: 'pointer', fontWeight: saisieMode===k?500:400 }}>{l}</button>
            ))}
          </div>
          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500, background: msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: saisieMode==='jour'?'200px':'200px 200px', gap: 16, marginBottom: 16 }}>
              {saisieMode==='jour' ? <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} style={inputStyle}/></div>
              : <><div><label style={labelStyle}>Date début</label><input type="date" value={form.date_debut} onChange={e=>setForm(p=>({...p,date_debut:e.target.value}))} style={inputStyle}/></div><div><label style={labelStyle}>Date fin</label><input type="date" value={form.date_fin} onChange={e=>setForm(p=>({...p,date_fin:e.target.value}))} style={inputStyle}/></div></>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              {[{key:'injections',label:'Injections',color:'#C9A84C'},{key:'non_exploitables',label:'Non exploitables',color:'#8A8A7A'},{key:'indispos',label:'Indispos',color:'#E05C5C'},{key:'suivis',label:'Suivis',color:'#C9A84C'},{key:'rdv',label:'RDV',color:'#534AB7'},{key:'visites',label:'Visites',color:'#4CAF7D'},{key:'ventes',label:'Ventes',color:'#1a6b3c'}].map(f => (
                <div key={f.key}>
                  <label style={{...labelStyle,color:f.color}}>{f.label}<InfoBulle text={BULLES[f.key]}/></label>
                  <input type="number" min="0" value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder="0" style={{...inputStyle,borderColor:`${f.color}50`}}/>
                </div>
              ))}
            </div>
            <button type="submit" disabled={saving} style={{ background: saving?'#E8D5A3':'#C9A84C', color:'#fff', border:'none', padding:'11px 28px', borderRadius:8, fontSize:13, fontWeight:500, cursor:saving?'wait':'pointer' }}>
              {saving?'Enregistrement...':'Enregistrer'}
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        <DrillTree data={marketingData} onSelect={setSelected} selected={selected} />
        <div>
          {/* KPIs toggle + cards */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>KPIs — {selected.label}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {KPI_LIST.map(k => (
                <button key={k.key} onClick={() => setHiddenKpis(p=>({...p,[k.key]:!p[k.key]}))} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, border: `1px solid ${hiddenKpis[k.key]?'rgba(201,168,76,0.2)':k.color}`, background: hiddenKpis[k.key]?'#F8F7F4':`${k.color}15`, color: hiddenKpis[k.key]?'#8A8A7A':k.color, cursor: 'pointer', textDecoration: hiddenKpis[k.key]?'line-through':'none' }}>{k.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
            {KPI_LIST.filter(k => !hiddenKpis[k.key]).map(k => (
              <div key={k.key} style={{ background:'#fff', borderRadius:12, padding:'16px 18px', border:'1px solid rgba(201,168,76,0.15)', borderTop:`3px solid ${k.color}` }}>
                <div style={{ fontSize:10, color:'#5A5A5A', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, display:'flex', alignItems:'center' }}>
                  {k.label}<InfoBulle text={BULLES[k.info]}/>
                </div>
                <div style={{ fontSize:26, fontWeight:700, color:k.color, lineHeight:1 }}>{totaux[k.key]}</div>
                {k.taux && (
                  <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:600, color:k.color }}>{totaux[k.taux]}%</span>
                    <InfoBulle text={BULLES[k.taux_info]}/>
                    <span style={{ fontSize:10, color:'#8A8A7A' }}>CV: {cvs[k.taux]||0}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Graphes */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <div style={cardStyle}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>Qualité des leads</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {GRAPH1_SERIES.map(s => (
                  <button key={s.key} onClick={() => toggleSeries(setHiddenG1, s.key)} style={{ padding:'3px 10px', borderRadius:12, fontSize:11, border:`1px solid ${hiddenG1[s.key]?'rgba(0,0,0,0.1)':s.color}`, background: hiddenG1[s.key]?'#F8F7F4':`${s.color}15`, color: hiddenG1[s.key]?'#8A8A7A':s.color, cursor:'pointer', textDecoration: hiddenG1[s.key]?'line-through':'none' }}>{s.label}</button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
                  <XAxis dataKey="label" tick={{fontSize:9}}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>`${v}%`}/>
                  {GRAPH1_SERIES.filter(s=>!hiddenG1[s.key]).map(s => <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[3,3,0,0]} name={s.label}/>)}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>Pipeline conversion</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {GRAPH2_SERIES.map(s => (
                  <button key={s.key} onClick={() => toggleSeries(setHiddenG2, s.key)} style={{ padding:'3px 10px', borderRadius:12, fontSize:11, border:`1px solid ${hiddenG2[s.key]?'rgba(0,0,0,0.1)':s.color}`, background: hiddenG2[s.key]?'#F8F7F4':`${s.color}15`, color: hiddenG2[s.key]?'#8A8A7A':s.color, cursor:'pointer', textDecoration: hiddenG2[s.key]?'line-through':'none' }}>{s.label}</button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
                  <XAxis dataKey="label" tick={{fontSize:9}}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>`${v}%`}/>
                  {GRAPH2_SERIES.filter(s=>!hiddenG2[s.key]).map(s => <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{r:3}} name={s.label}/>)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cohorte */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:18, fontWeight:600, color:'#2C2C2C', display:'flex', alignItems:'center', gap:12 }}>
              Vue Cohorte
              <div style={{ flex:1, height:1, background:'rgba(201,168,76,0.2)', width:60 }}></div>
            </div>
            <div style={{ position:'relative' }}>
              <button onClick={() => setShowColMenu(p=>!p)} style={{ padding:'6px 16px', borderRadius:16, border:'1.5px solid rgba(201,168,76,0.3)', background:'#fff', color:'#C9A84C', fontSize:12, cursor:'pointer', fontWeight:500 }}>
                Colonnes ▾
              </button>
              {showColMenu && (
                <div style={{ position:'absolute', right:0, top:'110%', background:'#fff', border:'1px solid rgba(201,168,76,0.2)', borderRadius:10, padding:'12px', zIndex:100, minWidth:200, boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize:10, color:'#5A5A5A', textTransform:'uppercase', letterSpacing:1, marginBottom:8, fontWeight:500 }}>Masquer / Afficher</div>
                  {COHORT_COLS.map(c => (
                    <label key={c.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', cursor:'pointer', fontSize:12, color: hiddenCols[c.key]?'#8A8A7A':c.color }}>
                      <input type="checkbox" checked={!hiddenCols[c.key]} onChange={() => setHiddenCols(p=>({...p,[c.key]:!p[c.key]}))} style={{ accentColor:'#C9A84C' }}/>
                      {c.label}
                    </label>
                  ))}
                  <button onClick={() => setHiddenCols({})} style={{ marginTop:8, width:'100%', padding:'5px', borderRadius:6, border:'1px solid rgba(201,168,76,0.3)', background:'transparent', color:'#C9A84C', fontSize:11, cursor:'pointer' }}>Tout afficher</button>
                </div>
              )}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Période</th>
                    {visibleCols.map(c => (
                      <th key={c.key} style={{...thStyle, color:c.color}}>{c.label} <InfoBulle text={BULLES[c.info]}/></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...chartData].reverse().map((row, i) => (
                    <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{...tdStyle, fontWeight:500, color:'#C9A84C'}}>{row.label}</td>
                      {visibleCols.map(c => (
                        <td key={c.key} style={{...tdStyle, color:c.color, fontWeight:c.bold?600:400, fontSize:c.small?10:11}}>
                          {c.small ? `${row[c.key]}%` : row[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {chartData.length === 0 && <tr><td colSpan={visibleCols.length+1} style={{textAlign:'center',padding:'32px',color:'#5A5A5A',fontSize:13}}>Aucune donnée. Cliquez sur "+ Saisir données".</td></tr>}
                </tbody>
                {chartData.length > 1 && (
                  <tfoot>
                    <tr style={{ background:'#F8F7F4' }}>
                      <td style={{...tdStyle, fontWeight:600, color:'#2C2C2C'}}>CV</td>
                      {visibleCols.map(c => (
                        <td key={c.key} style={{...tdStyle, color:c.color, fontWeight:600}}>
                          {c.small ? `${cvs[c.key]||0}%` : '—'}
                        </td>
                      ))}
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
