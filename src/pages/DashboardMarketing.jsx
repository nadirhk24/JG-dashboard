import React, { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
  injections: "Nombre total de nouveaux leads reçus — calculé depuis les leads bruts Call Center",
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
function getQuarterMkt(m) { return Math.floor(m / 3) + 1 }

function DrillNav({ data, onSelect, selected }) {
  const [expandedYear, setExpandedYear] = React.useState(null)
  const [expandedQ, setExpandedQ] = React.useState(null)
  const [expandedMonth, setExpandedMonth] = React.useState(null)
  const years = React.useMemo(() => {
    const ys = {}
    data.forEach(s => {
      const d = new Date(s.date)
      const y = d.getFullYear(), m = d.getMonth(), q = getQuarterMkt(m)
      if (!ys[y]) ys[y] = {}
      if (!ys[y][q]) ys[y][q] = new Set()
      ys[y][q].add(m)
    })
    return ys
  }, [data])
  const btnStyle = (active, color = '#C9A84C') => ({
    padding: '5px 12px', borderRadius: 14, fontSize: 12, cursor: 'pointer',
    border: `1.5px solid ${active ? color : 'rgba(201,168,76,0.2)'}`,
    background: active ? color : '#fff', color: active ? '#fff' : '#5A5A5A',
    fontWeight: active ? 500 : 400, transition: 'all 0.15s', whiteSpace: 'nowrap'
  })
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnStyle(!selected || selected.type === 'global')} onClick={() => { onSelect({ type: 'global', label: 'Global' }); setExpandedYear(null); setExpandedQ(null); setExpandedMonth(null) }}>Global</button>
        {Object.keys(years).sort().reverse().map(year => (
          <React.Fragment key={year}>
            <button style={btnStyle(selected?.type === 'year' && selected?.value === year)} onClick={() => { setExpandedYear(expandedYear === year ? null : year); setExpandedQ(null); setExpandedMonth(null); onSelect({ type: 'year', value: year, label: year }) }}>
              {year} {expandedYear === year ? '▼' : '▶'}
            </button>
            {expandedYear === year && Object.keys(years[year]).sort((a,b)=>a-b).map(q => (
              <React.Fragment key={q}>
                <button style={btnStyle(selected?.type === 'quarter' && selected?.value === `${year}-Q${q}`, '#534AB7')} onClick={() => { setExpandedQ(expandedQ === `${year}-Q${q}` ? null : `${year}-Q${q}`); setExpandedMonth(null); onSelect({ type: 'quarter', value: `${year}-Q${q}`, label: `T${q} ${year}` }) }}>
                  T{q} {expandedQ === `${year}-Q${q}` ? '▼' : '▶'}
                </button>
                {expandedQ === `${year}-Q${q}` && [...years[year][q]].sort((a,b)=>a-b).map(m => {
                  const mKey = `${year}-${String(m+1).padStart(2,'0')}`
                  return (
                    <React.Fragment key={m}>
                      <button style={btnStyle(selected?.type === 'month' && selected?.value === mKey, '#4CAF7D')} onClick={() => { setExpandedMonth(expandedMonth === mKey ? null : mKey); onSelect({ type: 'month', value: mKey, label: `${MOIS_SHORT[m]} ${year}` }) }}>
                        {MOIS_SHORT[m]} {expandedMonth === mKey ? '▼' : '▶'}
                      </button>
                      {expandedMonth === mKey && [...new Set(data.filter(s => s.date.startsWith(mKey)).map(s => s.date))].sort().map(date => (
                        <button key={date} style={btnStyle(selected?.type === 'day' && selected?.value === date, '#E07B30')} onClick={() => onSelect({ type: 'day', value: date, label: date.substring(8) + '/' + date.substring(5,7) })}>
                          {date.substring(8)}/{date.substring(5,7)}
                        </button>
                      ))}
                    </React.Fragment>
                  )
                })}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

const KPI_LIST = [
  { key: 'injections', label: 'Injections (CC)', color: '#C9A84C', info: 'injections' },
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
  { key: 'injections', label: 'Inject. (CC)', info: 'injections', color: '#2C2C2C' },
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
  const [saisiesCC, setSaisiesCC] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSaisie, setShowSaisie] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [selected, setSelected] = useState({ type: 'global', value: 'all', label: 'Global' })
  const [hiddenKpis, setHiddenKpis] = useState({})
  const [confirmModal, setConfirmModal] = useState(null)
  const [zoomedChart, setZoomedChart] = useState(null)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [showHistorique, setShowHistorique] = useState(false)
  const [hiddenG1, setHiddenG1] = useState({})
  const [hiddenG2, setHiddenG2] = useState({})
  const [hiddenCols, setHiddenCols] = useState({})
  const [showColMenu, setShowColMenu] = useState(false)
  const [saisieMode, setSaisieMode] = useState('jour')
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ date: today, date_debut: '', date_fin: '', non_exploitables: '', suivis: '', rdv: '', visites: '', ventes: '' })

  useEffect(() => { loadMarketing() }, [])

  async function loadMarketing() {
    setLoading(true)
    try {
      const [{ data: mktData }, { data: ccData }] = await Promise.all([
        supabase.from('marketing_saisies').select('*').order('date', { ascending: true }),
        supabase.from('saisies').select('date_debut, date_fin, leads_bruts, indispos')
      ])
      setMarketingData(mktData || [])
      setSaisiesCC(ccData || [])
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

  // Injections = leads_bruts CC pour la même période
  const injectionsBrutes = useMemo(() => {
    return saisiesCC.filter(s => {
      const d = s.date_debut
      if (!d) return false
      if (!selected || selected.type === 'global') return true
      if (selected.type === 'year') return d.startsWith(selected.value)
      if (selected.type === 'quarter') {
        const [y, q] = selected.value.split('-Q')
        const mois = parseInt(d.substring(5, 7))
        const startM = (parseInt(q) - 1) * 3 + 1
        const endM = parseInt(q) * 3
        return d.startsWith(y) && mois >= startM && mois <= endM
      }
      if (selected.type === 'month') return d.substring(0, 7) === selected.value
      if (selected.type === 'day') return d === selected.value
      return true
    }).reduce((sum, s) => sum + (s.leads_bruts || 0), 0)
  }, [saisiesCC, selected])

  // Indispos = somme des indispos CC pour la même période
  const indisposCC = useMemo(() => {
    return saisiesCC.filter(s => {
      const d = s.date_debut
      if (!d) return false
      if (!selected || selected.type === 'global') return true
      if (selected.type === 'year') return d.startsWith(selected.value)
      if (selected.type === 'quarter') {
        const [y, q] = selected.value.split('-Q')
        const mois = parseInt(d.substring(5, 7))
        const startM = (parseInt(q) - 1) * 3 + 1
        const endM = parseInt(q) * 3
        return d.startsWith(y) && mois >= startM && mois <= endM
      }
      if (selected.type === 'month') return d.substring(0, 7) === selected.value
      if (selected.type === 'day') return d === selected.value
      return true
    }).reduce((sum, s) => sum + (s.indispos || 0), 0)
  }, [saisiesCC, selected])

  const totaux = useMemo(() => {
    const agg = aggreger(dataFiltree)
    const base_nette = Math.max(0, injectionsBrutes - agg.non_exploitables - indisposCC)
    return {
      ...agg,
      injections: injectionsBrutes,
      indispos: indisposCC,
      base_nette,
      taux_non_exp: injectionsBrutes > 0 ? parseFloat(((agg.non_exploitables / injectionsBrutes) * 100).toFixed(1)) : 0,
      taux_indispos: injectionsBrutes > 0 ? parseFloat(((indisposCC / injectionsBrutes) * 100).toFixed(1)) : 0,
      taux_suivis: base_nette > 0 ? parseFloat(((agg.suivis / base_nette) * 100).toFixed(1)) : 0,
      taux_rdv: base_nette > 0 ? parseFloat(((agg.rdv / base_nette) * 100).toFixed(1)) : 0,
      taux_visites: base_nette > 0 ? parseFloat(((agg.visites / base_nette) * 100).toFixed(1)) : 0,
      taux_ventes: base_nette > 0 ? parseFloat(((agg.ventes / base_nette) * 100).toFixed(1)) : 0,
    }
  }, [dataFiltree, injectionsBrutes, indisposCC])

  // Injections CC par clé de période (pour chartData)
  const ccParPeriode = useMemo(() => {
    const map = {}
    saisiesCC.forEach(s => {
      const d = s.date_debut
      if (!d) return
      const key = (selected.type === 'day' || selected.type === 'month') ? d : d.substring(0, 7)
      if (!map[key]) map[key] = { injections: 0, indispos: 0 }
      map[key].injections += s.leads_bruts || 0
      map[key].indispos += s.indispos || 0
    })
    return map
  }, [saisiesCC, selected])

  const chartData = useMemo(() => {
    if (!dataFiltree.length) return []
    const groups = {}
    dataFiltree.forEach(s => {
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
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, { label, rows }]) => {
      const agg = aggreger(rows)
      const ccData = ccParPeriode[key] || { injections: 0, indispos: 0 }
      const inj = ccData.injections
      const indDispos = ccData.indispos
      const base_nette = Math.max(0, inj - agg.non_exploitables - indDispos)
      return {
        label, ...agg,
        injections: inj,
        indispos: indDispos,
        base_nette,
        taux_non_exp: inj > 0 ? parseFloat(((agg.non_exploitables / inj) * 100).toFixed(1)) : 0,
        taux_indispos: inj > 0 ? parseFloat(((indDispos / inj) * 100).toFixed(1)) : 0,
        taux_suivis: base_nette > 0 ? parseFloat(((agg.suivis / base_nette) * 100).toFixed(1)) : 0,
        taux_rdv: base_nette > 0 ? parseFloat(((agg.rdv / base_nette) * 100).toFixed(1)) : 0,
        taux_visites: base_nette > 0 ? parseFloat(((agg.visites / base_nette) * 100).toFixed(1)) : 0,
        taux_ventes: base_nette > 0 ? parseFloat(((agg.ventes / base_nette) * 100).toFixed(1)) : 0,
      }
    })
  }, [dataFiltree, selected, ccParPeriode])

  const cvs = useMemo(() => ({
    taux_non_exp: calcCV(chartData.map(r => r.taux_non_exp)),
    taux_indispos: calcCV(chartData.map(r => r.taux_indispos)),
    taux_suivis: calcCV(chartData.map(r => r.taux_suivis)),
    taux_rdv: calcCV(chartData.map(r => r.taux_rdv)),
    taux_visites: calcCV(chartData.map(r => r.taux_visites)),
    taux_ventes: calcCV(chartData.map(r => r.taux_ventes)),
  }), [chartData])

  async function checkAndSave(e) {
    e.preventDefault()
    const dateDebut = saisieMode === 'jour' ? form.date : form.date_debut
    const dateFin = saisieMode === 'jour' ? form.date : form.date_fin
    if (!dateDebut) { setMsg({ type: 'error', text: 'Sélectionne une date' }); return }
    if (saisieMode === 'periode' && !dateFin) { setMsg({ type: 'error', text: 'Sélectionne une date de fin' }); return }
    const existing = marketingData.filter(s => {
      const sD = s.date_debut || s.date; const sF = s.date_fin || s.date
      return sD <= dateFin && sF >= dateDebut
    })
    if (existing.length > 0) {
      // Charger la ligne existante complète pour la popup
      const { data: existingFull } = await supabase.from('marketing_saisies')
        .select('*').eq('id', existing[0].id).maybeSingle()
      setConfirmModal({ dateDebut, dateFin, existingData: existingFull })
    } else {
      await doSave(dateDebut, dateFin)
    }
  }

  async function doSave(dateDebut, dateFin) {
    setSaving(true)
    setConfirmModal(null)
    const base = (f) => parseInt(form[f]) || 0
    const oldData = marketingData.filter(s => {
      const sD = s.date_debut || s.date; const sF = s.date_fin || s.date
      return sD <= dateFin && sF >= dateDebut
    })
    if (oldData.length > 0) {
      const backups = oldData.map(d => ({ saisie_id: d.id, ancienne_valeur: JSON.stringify(d) }))
      await supabase.from('historique_marketing').upsert(backups, { onConflict: 'saisie_id' })
      await supabase.from('marketing_saisies').delete().in('id', oldData.map(d => d.id))
    }
    const existingData = oldData && oldData.length > 0 ? oldData[0] : null
    const payload = {
      date: dateDebut, date_debut: dateDebut, date_fin: dateFin, type_saisie: saisieMode,
      injections: 0, // Vient automatiquement des leads_bruts CC
      non_exploitables: form.non_exploitables !== '' ? base('non_exploitables') : (existingData?.non_exploitables ?? 0),
      indispos: 0, // Vient automatiquement des indispos CC
      suivis: form.suivis !== '' ? base('suivis') : (existingData?.suivis ?? 0),
      rdv: form.rdv !== '' ? base('rdv') : (existingData?.rdv ?? 0),
      visites: form.visites !== '' ? base('visites') : (existingData?.visites ?? 0),
      ventes: form.ventes !== '' ? base('ventes') : (existingData?.ventes ?? 0),
    }
    const { error } = await supabase.from('marketing_saisies').insert(payload)
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'success', text: dateDebut === dateFin ? `Données enregistrées pour le ${dateDebut} !` : `Données enregistrées du ${dateDebut} au ${dateFin} !` })
      loadMarketing()
      setForm(p => ({ ...p, non_exploitables: '', suivis: '', rdv: '', visites: '', ventes: '' }))
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function annulerMajMarketing(saisieId) {
    const { data: backup } = await supabase.from('historique_marketing').select('*').eq('saisie_id', saisieId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!backup) { setMsg({ type: 'error', text: 'Aucun historique disponible' }); return }
    const ancienne = JSON.parse(backup.ancienne_valeur)
    const { id, created_at, ...updateData } = ancienne
    const { error } = await supabase.from('marketing_saisies').update(updateData).eq('id', saisieId)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Mise à jour annulée !' }); loadMarketing(); setTimeout(() => setMsg(null), 3000) }
  }

  async function supprimerMktSaisie(id) {
    if (!window.confirm('Supprimer cette saisie ?')) return
    await supabase.from('marketing_saisies').delete().eq('id', id)
    loadMarketing()
  }

  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const thStyle = { fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, whiteSpace: 'nowrap' }
  const tdStyle = { padding: '9px 8px', fontSize: 11, borderBottom: '1px solid rgba(201,168,76,0.06)', whiteSpace: 'nowrap' }
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none' }
  const labelStyle = { fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 5, display: 'flex', alignItems: 'center' }
  const visibleCols = COHORT_COLS.filter(c => !hiddenCols[c.key])

  return (
    <div>
      <PageHeader title="Dashboard Marketing" subtitle={selected.label}>
        {confirmModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 540, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#E07B30' }}>⚠️ Données existantes</div>
                <button onClick={() => setConfirmModal(null)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.2)', background: '#fff', fontSize: 16, cursor: 'pointer', color: '#5A5A5A' }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 20 }}>
                Des données existent déjà pour <strong style={{ color: '#C9A84C' }}>{confirmModal.dateDebut}</strong>. Modifie directement les champs :
              </div>
              {confirmModal.existingData && (() => {
                const d = confirmModal.existingData
                const fields = [
                  { key: 'non_exploitables', label: 'Non exploitables', color: '#8A8A7A' },
                  { key: 'suivis', label: 'Suivis', color: '#C9A84C' },
                  { key: 'rdv', label: 'RDV', color: '#534AB7' },
                  { key: 'visites', label: 'Visites', color: '#4CAF7D' },
                  { key: 'ventes', label: 'Ventes', color: '#1a6b3c' },
                ]
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                    {fields.map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 5, fontWeight: 500 }}>{f.label}</div>
                        <input type="number" min="0"
                          defaultValue={d[f.key] ?? 0}
                          onChange={e => setConfirmModal(p => ({ ...p, editValues: { ...(p.editValues||{}), [f.key]: e.target.value } }))}
                          style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${f.color}30`, borderRadius: 8, fontSize: 13, background: '#F8F7F4', outline: 'none', borderLeft: `3px solid ${f.color}`, boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                )
              })()}
              <div style={{ padding: '8px 12px', background: 'rgba(201,168,76,0.06)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#8a6a1a' }}>
                ℹ️ Injections et Indispos sont calculées automatiquement depuis le Call Center
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={async () => {
                  const updates = confirmModal.editValues || {}
                  const d = confirmModal.existingData
                  await supabase.from('marketing_saisies').update({
                    non_exploitables: parseInt(updates.non_exploitables ?? d.non_exploitables ?? 0),
                    suivis: parseInt(updates.suivis ?? d.suivis ?? 0),
                    rdv: parseInt(updates.rdv ?? d.rdv ?? 0),
                    visites: parseInt(updates.visites ?? d.visites ?? 0),
                    ventes: parseInt(updates.ventes ?? d.ventes ?? 0),
                  }).eq('id', d.id)
                  setConfirmModal(null)
                  loadMarketing()
                  setMsg({ type: 'success', text: 'Données mises à jour !' })
                  setTimeout(() => setMsg(null), 3000)
                }} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  ✓ Enregistrer les modifications
                </button>
                <button onClick={() => setConfirmModal(null)} style={{ padding: '12px 20px', borderRadius: 8, background: '#fff', color: '#5A5A5A', border: '1.5px solid rgba(201,168,76,0.25)', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
              </div>
            </div>
          </div>
        )}
        <button onClick={() => setShowSaisie(!showSaisie)} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showSaisie ? '#C9A84C' : '#fff', color: showSaisie ? '#fff' : '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showSaisie ? '✕ Fermer' : '+ Saisir données'}
        </button>
      </PageHeader>

      {showSaisie && (
        <div style={{ ...cardStyle, borderColor: '#C9A84C' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#2C2C2C' }}>Saisie Marketing</div>
          <div style={{ padding: '8px 12px', background: 'rgba(201,168,76,0.06)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#8a6a1a', border: '1px solid rgba(201,168,76,0.2)' }}>
            ℹ️ <strong>Injections</strong> et <strong>Indispos</strong> = calculées automatiquement depuis le <strong>Call Center</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['jour','Par jour'],['periode','Par période']].map(([k,l]) => (
              <button key={k} onClick={() => setSaisieMode(k)} style={{ padding: '7px 18px', borderRadius: 16, border: `1.5px solid ${saisieMode===k?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: saisieMode===k?'#C9A84C':'#fff', color: saisieMode===k?'#fff':'#5A5A5A', fontSize: 12, cursor: 'pointer', fontWeight: saisieMode===k?500:400 }}>{l}</button>
            ))}
          </div>
          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500, background: msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}
          <form onSubmit={checkAndSave}>
            <div style={{ display: 'grid', gridTemplateColumns: saisieMode==='jour'?'200px':'200px 200px', gap: 16, marginBottom: 16 }}>
              {saisieMode==='jour'
                ? <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} style={inputStyle}/></div>
                : <><div><label style={labelStyle}>Date début</label><input type="date" value={form.date_debut} onChange={e=>setForm(p=>({...p,date_debut:e.target.value}))} style={inputStyle}/></div><div><label style={labelStyle}>Date fin</label><input type="date" value={form.date_fin} onChange={e=>setForm(p=>({...p,date_fin:e.target.value}))} style={inputStyle}/></div></>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              {[{key:'non_exploitables',label:'Non exploitables',color:'#8A8A7A'},{key:'suivis',label:'Suivis',color:'#C9A84C'},{key:'rdv',label:'RDV',color:'#534AB7'},{key:'visites',label:'Visites',color:'#4CAF7D'},{key:'ventes',label:'Ventes',color:'#1a6b3c'}].map(f => (
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

      <DrillNav data={marketingData} onSelect={setSelected} selected={selected} />

      <div>
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

        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C' }}>Volume des indicateurs</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
              <XAxis dataKey="label" tick={{fontSize:9}}/>
              <YAxis tick={{fontSize:9}} tickFormatter={v=>`${v}%`}/>
              <Tooltip contentStyle={tooltipStyle} formatter={v=>`${v}%`}/>
              {[...GRAPH1_SERIES, ...GRAPH2_SERIES].filter(s=>!hiddenG1[s.key]).map(s => <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[3,3,0,0]} name={s.label}/>)}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          {[...GRAPH1_SERIES, ...GRAPH2_SERIES].map(s => (
            <div key={s.key} style={{ ...cardStyle, cursor: 'pointer' }}
              onClick={() => setZoomedChart(s)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 20px ${s.color}30`}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: s.color }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#5A5A5A' }}>CV: <span style={{ color: s.color, fontWeight: 500 }}>{cvs[s.key] || 0}%</span></div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${s.color}15`}/>
                  <XAxis dataKey="label" tick={{fontSize:9}}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>`${v}%`}/>
                  <Line type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2.5} dot={{ r: 5, fill: s.color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} name={s.label}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:18, fontWeight:600, color:'#2C2C2C' }}>Vue Cohorte</div>
          <div style={{ position:'relative' }}>
            <button onClick={() => setShowColMenu(p=>!p)} style={{ padding:'6px 16px', borderRadius:16, border:'1.5px solid rgba(201,168,76,0.3)', background:'#fff', color:'#C9A84C', fontSize:12, cursor:'pointer', fontWeight:500 }}>Colonnes ▾</button>
            {showColMenu && (
              <div style={{ position:'absolute', right:0, top:'110%', background:'#fff', border:'1px solid rgba(201,168,76,0.2)', borderRadius:10, padding:'12px', zIndex:100, minWidth:200, boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
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
                  {visibleCols.map(c => <th key={c.key} style={{...thStyle, color:c.color}}>{c.label} <InfoBulle text={BULLES[c.info]}/></th>)}
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
                    {visibleCols.map(c => <td key={c.key} style={{...tdStyle, color:c.color, fontWeight:600}}>{c.small ? `${cvs[c.key]||0}%` : '—'}</td>)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistorique ? 16 : 0, marginTop: 8 }}>
        <div onClick={() => setShowHistorique(p=>!p)} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          Historique des saisies
          <span style={{ fontSize: 12, color: '#C9A84C', fontFamily: 'DM Sans' }}>{showHistorique ? '▲ Fermer' : '▼ Ouvrir'}</span>
        </div>
        {selectedRows.size > 0 && (
          <button onClick={async () => {
            if (!window.confirm(`Supprimer ${selectedRows.size} saisie(s) ?`)) return
            await supabase.from('marketing_saisies').delete().in('id', [...selectedRows])
            setSelectedRows(new Set()); loadMarketing()
          }} style={{ padding: '7px 16px', borderRadius: 8, background: '#E05C5C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            Supprimer la sélection ({selectedRows.size})
          </button>
        )}
      </div>
      {showHistorique && <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ fontSize: 10, color: '#5A5A5A', padding: '8px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>
                  <input type="checkbox" checked={selectedRows.size === marketingData.slice(0,30).length && marketingData.length > 0}
                    onChange={e => setSelectedRows(e.target.checked ? new Set(marketingData.slice(0,30).map(s=>s.id)) : new Set())}
                    style={{ accentColor: '#C9A84C' }}/>
                </th>
                {['Période','Non Expl.','Indispos','Suivis','RDV','Visites','Ventes','Actions'].map(h => (
                  <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...marketingData].sort((a,b) => (b.date_debut||b.date).localeCompare(a.date_debut||a.date)).slice(0, 30).map(s => {
                const periode = s.date_debut && s.date_fin && s.date_debut !== s.date_fin
                  ? `${s.date_debut.substring(8)}/${s.date_debut.substring(5,7)} → ${s.date_fin.substring(8)}/${s.date_fin.substring(5,7)}`
                  : (s.date_debut || s.date)
                const isSelected = selectedRows.has(s.id)
                return (
                  <tr key={s.id} style={{ background: isSelected ? '#F7F0DC' : 'transparent' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F7F0DC' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '9px 8px' }}>
                      <input type="checkbox" checked={isSelected}
                        onChange={e => { const next = new Set(selectedRows); e.target.checked ? next.add(s.id) : next.delete(s.id); setSelectedRows(next) }}
                        style={{ accentColor: '#C9A84C' }}/>
                    </td>
                    <td style={{ padding: '9px 8px', fontSize: 12, fontWeight: 500, color: '#C9A84C', whiteSpace: 'nowrap' }}>{periode}</td>
                    <td style={{ padding: '9px 8px', fontSize: 11, color: '#8A8A7A' }}>{s.non_exploitables}</td>
                    <td style={{ padding: '9px 8px', fontSize: 11, color: '#E05C5C' }}>{s.indispos}</td>
                    <td style={{ padding: '9px 8px', fontSize: 11, color: '#C9A84C' }}>{s.suivis}</td>
                    <td style={{ padding: '9px 8px', fontSize: 11, color: '#534AB7' }}>{s.rdv}</td>
                    <td style={{ padding: '9px 8px', fontSize: 11, color: '#4CAF7D' }}>{s.visites}</td>
                    <td style={{ padding: '9px 8px', fontSize: 11, color: '#1a6b3c' }}>{s.ventes}</td>
                    <td style={{ padding: '9px 8px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => annulerMajMarketing(s.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', background: 'transparent', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>↩ Annuler MàJ</button>
                        <button onClick={() => supprimerMktSaisie(s.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Suppr.</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {marketingData.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Aucune saisie</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}

      {zoomedChart && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setZoomedChart(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '90%', maxWidth: 900, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 600, color: zoomedChart.color }}>{zoomedChart.label}</div>
                <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 4 }}>CV: <span style={{ color: zoomedChart.color, fontWeight: 600 }}>{cvs[zoomedChart.key] || 0}%</span></div>
              </div>
              <button onClick={() => setZoomedChart(null)} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.3)', background: '#fff', color: '#C9A84C', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${zoomedChart.color}20`}/>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13 }} formatter={v => [`${v}%`, zoomedChart.label]} />
                <Line type="monotone" dataKey={zoomedChart.key} stroke={zoomedChart.color} strokeWidth={3} dot={{ r: 7, fill: zoomedChart.color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 9 }} name={zoomedChart.label}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
