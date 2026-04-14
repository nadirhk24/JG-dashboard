import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import ConseillereFilter from '../components/ConseillereFilter'
import KpiCard from '../components/KpiCard'
import { getColorFromObjectif, getObjectifsPourPeriode, clearObjectifsCache } from '../lib/objectifs'
import SectionTitle from '../components/SectionTitle'
import { getGroupFunction, formatGroupLabel, filtrerParSelection } from '../lib/dates'
import { agregerParPeriode, calcCV, calcConversionTel, calcTauxPresence, calcEfficaciteComm } from '../lib/kpi'
import { supabase } from '../lib/supabase'

function getStars(rank, total) {
  const stars = Math.max(0, Math.min(5, total) - rank)
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars))
}

function getRankColor(rank, total) {
  if (total <= 1) return '#C9A84C'
  const ratio = rank / (total - 1)
  if (ratio <= 0.2) return '#1a6b3c'
  if (ratio <= 0.4) return '#2E9455'
  if (ratio <= 0.6) return '#C9A84C'
  if (ratio <= 0.8) return '#E07B30'
  return '#E05C5C'
}

function cvSerie(valeurs) {
  const vals = valeurs.filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0)
  if (vals.length < 2) return 0
  const moy = vals.reduce((a, b) => a + b, 0) / vals.length
  if (moy === 0) return 0
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0) / vals.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
function getQuarter(m) { return Math.floor(m / 3) + 1 }

// ─── VUE JOUR CALENDAR ────────────────────────────────────────────────────────
function VueJourCalendar({ selectedJour, conseilleres }) {
  const [calData, setCalData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('calendar_rdv')
        .select('*')
        .eq('date_creation', selectedJour)
      setCalData(data || [])
      setLoading(false)
    }
    load()
  }, [selectedJour])

  // Agréger par conseillère
  const parConseillere = useMemo(() => {
    const agg = {}
    calData.forEach(r => {
      if (!agg[r.conseillere]) agg[r.conseillere] = { conseillere: r.conseillere, rdv: 0, commerciaux: new Set() }
      agg[r.conseillere].rdv++
      agg[r.conseillere].commerciaux.add(r.commercial)
    })
    return Object.values(agg).sort((a, b) => b.rdv - a.rdv)
  }, [calData])

  const thStyle = { fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', fontWeight: 500 }
  const tdStyle = { padding: '10px 12px', fontSize: 12, borderBottom: '1px solid rgba(201,168,76,0.06)' }

  if (loading) return <div style={{ padding: 24, color: '#5A5A5A', fontSize: 13 }}>Chargement...</div>

  if (calData.length === 0) return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 32, border: '1px solid rgba(201,168,76,0.15)', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
      <div style={{ fontSize: 14, color: '#5A5A5A' }}>Aucun RDV créé le {selectedJour}</div>
      <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 6 }}>Les RDV de ce jour apparaîtront ici automatiquement</div>
    </div>
  )

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'RDV créés', val: calData.length, color: '#C9A84C', sub: `Le ${selectedJour}` },
          { label: 'Conseillères actives', val: new Set(calData.map(r => r.conseillere)).size, color: '#534AB7', sub: 'Organisatrices' },
          { label: 'Commerciaux contactés', val: new Set(calData.map(r => r.commercial)).size, color: '#4CAF7D', sub: 'Participants' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(201,168,76,0.15)', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tableau par conseillère */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)', borderTop: '3px solid #C9A84C' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, fontWeight: 600, color: '#C9A84C' }}>RDV par Conseillère — {selectedJour}</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Conseillère</th>
              <th style={{ ...thStyle, color: '#C9A84C' }}>RDV créés</th>
              <th style={thStyle}>Commerciaux</th>
              <th style={thStyle}>Barre</th>
            </tr>
          </thead>
          <tbody>
            {parConseillere.map((row, i) => {
              const max = parConseillere[0]?.rdv || 1
              const rankColor = getRankColor(i, parConseillere.length)
              return (
                <tr key={row.conseillere}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: rankColor, width: 30 }}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 500, color: '#2C2C2C' }}>{row.conseillere}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#C9A84C', fontSize: 16 }}>{row.rdv}</td>
                  <td style={{ ...tdStyle, color: '#8A8A7A', fontSize: 11 }}>{row.commerciaux.size} commercial(aux)</td>
                  <td style={{ ...tdStyle, minWidth: 120 }}>
                    <div style={{ height: 8, background: 'rgba(201,168,76,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(row.rdv / max) * 100}%`, background: rankColor, borderRadius: 4 }}></div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Tableau détail */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, fontWeight: 600, color: '#2C2C2C' }}>Détail — {calData.length} RDV créés</div>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <tr>
                <th style={thStyle}>Conseillère</th>
                <th style={thStyle}>Commercial</th>
              </tr>
            </thead>
            <tbody>
              {calData.map((row, i) => (
                <tr key={row.id}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...tdStyle, color: '#C9A84C', fontWeight: 500 }}>{row.conseillere}</td>
                  <td style={{ ...tdStyle, color: '#2C2C2C' }}>{row.commercial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── DRILL NAV ────────────────────────────────────────────────────────────────
function DrillNav({ data, onSelect, selected }) {
  const [expandedYear, setExpandedYear] = useState(null)
  const [expandedQ, setExpandedQ] = useState(null)
  const [expandedMonth, setExpandedMonth] = useState(null)

  const years = useMemo(() => {
    const ys = {}
    data.forEach(s => {
      const d = new Date(s.date)
      const y = d.getFullYear(), m = d.getMonth(), q = getQuarter(m)
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
            {expandedYear === year && Object.keys(years[year]).sort((a, b) => a - b).map(q => (
              <React.Fragment key={q}>
                <button style={btnStyle(selected?.type === 'quarter' && selected?.value === `${year}-Q${q}`, '#534AB7')} onClick={() => { setExpandedQ(expandedQ === `${year}-Q${q}` ? null : `${year}-Q${q}`); setExpandedMonth(null); onSelect({ type: 'quarter', value: `${year}-Q${q}`, label: `T${q} ${year}` }) }}>
                  T{q} {expandedQ === `${year}-Q${q}` ? '▼' : '▶'}
                </button>
                {expandedQ === `${year}-Q${q}` && [...years[year][q]].sort((a, b) => a - b).map(m => {
                  const mKey = `${year}-${String(m + 1).padStart(2, '0')}`
                  return (
                    <React.Fragment key={m}>
                      <button style={btnStyle(selected?.type === 'month' && selected?.value === mKey, '#4CAF7D')} onClick={() => { setExpandedMonth(expandedMonth === mKey ? null : mKey); onSelect({ type: 'month', value: mKey, label: `${MOIS_SHORT[m]} ${year}` }) }}>
                        {MOIS_SHORT[m]} {expandedMonth === mKey ? '▼' : '▶'}
                      </button>
                      {expandedMonth === mKey && [...new Set(data.filter(s => s.date.startsWith(mKey)).map(s => s.date))].sort().map(date => (
                        <button key={date} style={btnStyle(selected?.type === 'day' && selected?.value === date, '#E07B30')} onClick={() => onSelect({ type: 'day', value: date, label: date.substring(8) + '/' + date.substring(5, 7) })}>
                          {date.substring(8)}/{date.substring(5, 7)}
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

const RANK_COLS = [
  { key: 'leads_bruts', label: 'Leads Bruts' },
  { key: 'leads_nets', label: 'Leads Nets' },
  { key: 'echanges', label: 'Échanges' },
  { key: 'productivite', label: 'Productivité', color: '#378ADD' },
  { key: 'joignabilite', label: 'Joignabilité', color: '#2E9455' },
  { key: 'conv_tel', label: 'Conv. Tél.', color: '#C9A84C' },
  { key: 'rdv', label: 'RDV', color: '#534AB7' },
  { key: 'presence', label: 'Présence', color: '#4CAF7D' },
  { key: 'visites', label: 'Visites', color: '#4CAF7D' },
  { key: 'efficacite_comm', label: 'Eff. Comm.', color: '#534AB7' },
  { key: 'ventes', label: 'Ventes', color: '#1a6b3c' },
]

export default function DashboardCallCenter({ conseilleres, saisies, reload }) {
  const [selected, setSelected] = useState({ type: 'global', label: 'Global' })
  const [filtreConseillere, setFiltreConseillere] = useState('all')
  const [drillConseillere, setDrillConseillere] = useState(null)
  const [objectifs, setObjectifs] = useState({})
  const [calendarRdv, setCalendarRdv] = useState([])
  const [fluxRdvData, setFluxRdvData] = useState([])
  const [hiddenRankCols, setHiddenRankCols] = useState({})
  const [showRankCols, setShowRankCols] = useState(false)
  const [showSaisie, setShowSaisie] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [showHistorique, setShowHistorique] = useState(false)
  const [saisieMode, setSaisieMode] = useState('jour')
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ conseillere_id: '', date: today, date_debut: '', date_fin: '', leads_bruts: '', indispos: '', echanges: '', rdv: '', visites: '', ventes: '' })

  useEffect(() => { loadObjectifsPeriode() }, [selected])
  useEffect(() => { loadExternalData() }, [])

  async function loadExternalData() {
    const [{ data: calRdv }, { data: fluxRdv }] = await Promise.all([
      supabase.from('calendar_rdv').select('*'),
      supabase.from('flux_rdv').select('*')
    ])
    setCalendarRdv(calRdv || [])
    setFluxRdvData(fluxRdv || [])
  }

  async function loadObjectifsPeriode() {
    clearObjectifsCache()
    const obj = await getObjectifsPourPeriode(selected)
    setObjectifs(obj)
  }

  // Filtrer calendar_rdv par période sélectionnée
  const calendarFiltres = useMemo(() => {
    return calendarRdv.filter(r => {
      const d = r.date_creation
      if (!d) return false
      if (selected.type === 'global') return true
      if (selected.type === 'year') return d.startsWith(selected.value)
      if (selected.type === 'quarter') {
        const [y, q] = selected.value.split('-Q')
        const qNum = parseInt(q)
        const startM = (qNum - 1) * 3 + 1
        const endM = qNum * 3
        const mois = parseInt(d.substring(5, 7))
        return d.startsWith(y) && mois >= startM && mois <= endM
      }
      if (selected.type === 'month') return d.substring(0, 7) === selected.value
      if (selected.type === 'day') return d === selected.value
      return true
    })
  }, [calendarRdv, selected])

  // Filtrer flux_rdv par période
  const fluxFiltres = useMemo(() => {
    return fluxRdvData.filter(f => {
      const mD = f.date_debut?.substring(0, 7)
      if (selected.type === 'global') return true
      if (selected.type === 'year') return mD?.startsWith(selected.value)
      if (selected.type === 'quarter') {
        const [y, q] = selected.value.split('-Q')
        const qNum = parseInt(q)
        const startM = (qNum - 1) * 3 + 1
        const endM = qNum * 3
        const mois = parseInt(mD?.split('-')[1] || 0)
        return mD?.startsWith(y) && mois >= startM && mois <= endM
      }
      if (selected.type === 'month') return mD === selected.value || f.date_fin?.substring(0,7) === selected.value
      if (selected.type === 'day') return f.date_debut <= selected.value && f.date_fin >= selected.value
      return true
    })
  }, [fluxRdvData, selected])

  // Calculer rdv/visites/ventes par conseillere depuis calendar+flux
  const rdvParConseillere = useMemo(() => {
    const agg = {}
    // RDV depuis calendar_rdv (par nom conseillere)
    calendarFiltres.forEach(r => {
      const cons = conseilleres.find(c =>
        c.nom.toLowerCase().trim() === r.conseillere.toLowerCase().trim()
      )
      if (!cons) return
      if (!agg[cons.id]) agg[cons.id] = { rdv: 0, visites: 0, ventes: 0 }
      agg[cons.id].rdv += 1
    })
    // Visites + Ventes depuis flux_rdv (par conseillere_id)
    fluxFiltres.forEach(f => {
      if (!agg[f.conseillere_id]) agg[f.conseillere_id] = { rdv: 0, visites: 0, ventes: 0 }
      agg[f.conseillere_id].visites += parseFloat(f.visites || 0)
      agg[f.conseillere_id].ventes += parseFloat(f.ventes || 0)
    })
    return agg
  }, [calendarFiltres, fluxFiltres, conseilleres])

  const saisiesFiltrees = useMemo(() => {
    let data = filtrerParSelection(saisies, selected)
    if (filtreConseillere !== 'all') data = data.filter(s => s.conseillere_id === filtreConseillere)
    // Override rdv/visites/ventes avec les données calendar+flux
    return data.map(s => ({
      ...s,
      rdv: rdvParConseillere[s.conseillere_id]?.rdv ?? s.rdv,
      visites: rdvParConseillere[s.conseillere_id]?.visites ?? s.visites,
      ventes: rdvParConseillere[s.conseillere_id]?.ventes ?? s.ventes,
    }))
  }, [saisies, selected, filtreConseillere, rdvParConseillere])

  // Pour la vue Jour : construire saisies virtuelles depuis calendar_rdv si saisiesFiltrees vide
  const saisiesEffectives = useMemo(() => {
    if (saisiesFiltrees.length > 0) return saisiesFiltrees
    // Pas de saisies pour ce jour → construire depuis rdvParConseillere
    return conseilleres
      .filter(c => rdvParConseillere[c.id])
      .map(c => ({
        conseillere_id: c.id,
        date: selected.type === 'day' ? selected.value : new Date().toISOString().split('T')[0],
        date_debut: selected.type === 'day' ? selected.value : new Date().toISOString().split('T')[0],
        date_fin: selected.type === 'day' ? selected.value : new Date().toISOString().split('T')[0],
        leads_bruts: 0, indispos: 0, leads_nets: 0, echanges: 0,
        rdv: rdvParConseillere[c.id]?.rdv || 0,
        visites: rdvParConseillere[c.id]?.visites || 0,
        ventes: rdvParConseillere[c.id]?.ventes || 0,
      }))
  }, [saisiesFiltrees, conseilleres, rdvParConseillere, selected])

  const kpisGlobal = useMemo(() => agregerParPeriode(saisiesEffectives), [saisiesEffectives])
  const kpisParConseillere = useMemo(() => conseilleres.map(c => ({ ...c, ...agregerParPeriode(saisiesEffectives, c.id) })), [conseilleres, saisiesEffectives])
  const cvConvTel = useMemo(() => calcCV(kpisParConseillere.map(c => c.conversion_tel)), [kpisParConseillere])
  const cvPresence = useMemo(() => calcCV(kpisParConseillere.map(c => c.taux_presence)), [kpisParConseillere])
  const cvEfficacite = useMemo(() => calcCV(kpisParConseillere.map(c => c.efficacite_comm)), [kpisParConseillere])

  const groupFn = useMemo(() => {
    if (selected.type === 'day' || selected.type === 'month') return getGroupFunction('jour')
    return getGroupFunction('mois')
  }, [selected])

  const periodeForLabel = useMemo(() => {
    if (selected.type === 'day' || selected.type === 'month') return 'jour'
    return 'mois'
  }, [selected])

  const tableData = useMemo(() => {
    const groups = groupFn(saisiesEffectives)
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      const convParC = conseilleres.map(c => calcConversionTel(items.filter(s => s.conseillere_id === c.id).reduce((a, s) => a + s.rdv, 0), items.filter(s => s.conseillere_id === c.id).reduce((a, s) => a + s.echanges, 0)))
      const presParC = conseilleres.map(c => calcTauxPresence(items.filter(s => s.conseillere_id === c.id).reduce((a, s) => a + s.visites, 0), items.filter(s => s.conseillere_id === c.id).reduce((a, s) => a + s.rdv, 0)))
      const effParC = conseilleres.map(c => calcEfficaciteComm(items.filter(s => s.conseillere_id === c.id).reduce((a, s) => a + s.ventes, 0), items.filter(s => s.conseillere_id === c.id).reduce((a, s) => a + s.visites, 0)))
      return { label: formatGroupLabel(key, periodeForLabel), key, ...agg, cv_conv: cvSerie(convParC), cv_presence: cvSerie(presParC), cv_efficacite: cvSerie(effParC) }
    })
  }, [saisiesFiltrees, groupFn, conseilleres, periodeForLabel])

  const chartData = useMemo(() => [...tableData].reverse().map(r => ({ label: r.label, conv: r.conversion_tel, presence: r.taux_presence, efficacite: r.efficacite_comm })), [tableData])
  const rankingSorted = useMemo(() => [...kpisParConseillere].sort((a, b) => ((b.conversion_tel + b.taux_presence) / 2) - ((a.conversion_tel + a.taux_presence) / 2)), [kpisParConseillere])

  const leadsNetsForm = Math.max(0, (parseFloat(form.leads_bruts) || 0) - (parseFloat(form.indispos) || 0))

  async function checkAndSave(e) {
    e.preventDefault()
    if (!form.conseillere_id) { setMsg({ type: 'error', text: 'Sélectionne une conseillère' }); return }
    const dateDebut = saisieMode === 'jour' ? form.date : form.date_debut
    const dateFin = saisieMode === 'jour' ? form.date : form.date_fin
    if (!dateDebut) { setMsg({ type: 'error', text: 'Sélectionne une date' }); return }
    if (saisieMode === 'periode' && !dateFin) { setMsg({ type: 'error', text: 'Sélectionne une date de fin' }); return }
    if (dateDebut > dateFin) { setMsg({ type: 'error', text: 'La date de fin doit être après la date de début' }); return }
    const { data: existing } = await supabase.from('saisies').select('id, date_debut, date_fin').eq('conseillere_id', form.conseillere_id).lte('date_debut', dateFin).gte('date_fin', dateDebut)
    if (existing && existing.length > 0) {
      setConfirmModal({ dateDebut, dateFin, existingIds: existing.map(e => e.id), message: `Des données existent déjà pour cette période (${existing.length} saisie(s)).` })
    } else {
      await doSave(dateDebut, dateFin)
    }
  }

  async function doSave(dateDebut, dateFin) {
    setSaving(true)
    setConfirmModal(null)
    const base = f => parseFloat(form[f]) || 0
    const { data: oldData } = await supabase.from('saisies').select('*').eq('conseillere_id', form.conseillere_id).lte('date_debut', dateFin).gte('date_fin', dateDebut)
    if (oldData && oldData.length > 0) {
      const backups = oldData.map(d => ({ saisie_id: d.id, conseillere_id: d.conseillere_id, date: d.date_debut, ancienne_valeur: JSON.stringify(d) }))
      await supabase.from('historique_saisies').upsert(backups, { onConflict: 'saisie_id' })
      await supabase.from('saisies').delete().in('id', oldData.map(d => d.id))
    }
    const existingData = oldData && oldData.length > 0 ? oldData[0] : null
    const { data: fluxData } = await supabase.from('flux_rdv').select('rdv, visites, ventes').eq('conseillere_id', form.conseillere_id).gte('date_debut', dateDebut).lte('date_fin', dateFin)
    const fluxRDV = (fluxData || []).reduce((acc, f) => ({ rdv: acc.rdv + parseFloat(f.rdv || 0), visites: acc.visites + parseFloat(f.visites || 0), ventes: acc.ventes + parseFloat(f.ventes || 0) }), { rdv: 0, visites: 0, ventes: 0 })
    const indisposVal = form.indispos !== '' ? base('indispos') : (existingData?.indispos ?? 0)
    const leadsBrutsVal = form.leads_bruts !== '' ? base('leads_bruts') : (existingData?.leads_bruts ?? 0)
    const payload = {
      conseillere_id: form.conseillere_id, date: dateDebut, date_debut: dateDebut, date_fin: dateFin, type_saisie: saisieMode,
      leads_bruts: leadsBrutsVal, indispos: indisposVal, leads_nets: Math.max(0, leadsBrutsVal - indisposVal),
      echanges: form.echanges !== '' ? base('echanges') : (existingData?.echanges ?? 0),
      rdv: fluxRDV.rdv > 0 ? fluxRDV.rdv : (existingData?.rdv ?? 0),
      visites: fluxRDV.visites > 0 ? fluxRDV.visites : (existingData?.visites ?? 0),
      ventes: fluxRDV.ventes > 0 ? fluxRDV.ventes : (existingData?.ventes ?? 0),
    }
    const { error } = await supabase.from('saisies').insert(payload)
    if (!error && indisposVal > 0) {
      const { data: mktExist } = await supabase.from('marketing_saisies').select('id, indispos').gte('date_debut', dateDebut).lte('date_fin', dateFin).maybeSingle()
      if (mktExist) await supabase.from('marketing_saisies').update({ indispos: indisposVal }).eq('id', mktExist.id)
    }
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'success', text: saisieMode === 'jour' ? `Données enregistrées pour le ${dateDebut} !` : `Données enregistrées du ${dateDebut} au ${dateFin} !` })
      reload()
      setForm(p => ({ ...p, leads_bruts: '', indispos: '', echanges: '', rdv: '', visites: '', ventes: '' }))
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function annulerMiseAJour(saisieId) {
    const { data: backup } = await supabase.from('historique_saisies').select('*').eq('saisie_id', saisieId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!backup) { setMsg({ type: 'error', text: 'Aucun historique disponible' }); return }
    const ancienne = JSON.parse(backup.ancienne_valeur)
    const { id, created_at, ...updateData } = ancienne
    const { error } = await supabase.from('saisies').update(updateData).eq('id', saisieId)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Mise à jour annulée — données restaurées !' }); reload(); setTimeout(() => setMsg(null), 3000) }
  }

  async function supprimerSaisie(id) {
    if (!window.confirm('Supprimer cette saisie définitivement ?')) return
    const { data: saisie } = await supabase.from('saisies').select('*').eq('id', id).maybeSingle()
    await supabase.from('saisies').delete().eq('id', id)
    if (saisie) {
      const { data: mkt } = await supabase.from('marketing_saisies').select('id').eq('conseillere_id', saisie.conseillere_id).gte('date_debut', saisie.date_debut).lte('date_debut', saisie.date_fin || saisie.date_debut).maybeSingle()
      if (mkt) await supabase.from('marketing_saisies').update({ indispos: 0 }).eq('id', mkt.id)
    }
    reload()
  }

  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const thStyle = { fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, whiteSpace: 'nowrap' }
  const tdStyle = { padding: '9px 8px', fontSize: 11, borderBottom: '1px solid rgba(201,168,76,0.06)', whiteSpace: 'nowrap' }
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none' }
  const labelStyle = { fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 5, display: 'block' }
  const periodeLabel = selected.type === 'jour' || selected.type === 'day' || selected.type === 'month' ? 'jour' : 'mois'

  // Détecter si la sélection est un jour précis (type 'day')
  const isJourView = selected.type === 'day'

  return (
    <div>
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 460, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#2C2C2C', marginBottom: 12 }}>Mise à jour ?</div>
            <div style={{ fontSize: 14, color: '#5A5A5A', marginBottom: 8, lineHeight: 1.6 }}>{confirmModal.message}</div>
            <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 500, marginBottom: 20 }}>S'agit-il d'une mise à jour des données existantes ?</div>
            <div style={{ padding: '12px 16px', background: 'rgba(201,168,76,0.05)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.2)', marginBottom: 24, fontSize: 12, color: '#8A8A7A' }}>
              Les données actuelles seront sauvegardées. Tu pourras annuler depuis l'historique en bas de page.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => doSave(confirmModal.dateDebut, confirmModal.dateFin)} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Oui, mettre à jour</button>
              <button onClick={() => setConfirmModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#fff', color: '#5A5A5A', border: '1.5px solid rgba(201,168,76,0.25)', fontSize: 14, cursor: 'pointer' }}>Non, annuler</button>
            </div>
          </div>
        </div>
      )}

      <PageHeader title="Call Center" subtitle={selected.label}>
        <ConseillereFilter conseilleres={conseilleres} value={filtreConseillere} onChange={setFiltreConseillere} />
        <button onClick={() => setShowSaisie(p => !p)} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showSaisie ? '#C9A84C' : '#fff', color: showSaisie ? '#fff' : '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showSaisie ? '✕ Fermer' : '+ Saisir données'}
        </button>
      </PageHeader>

      {showSaisie && (
        <div style={{ ...cardStyle, borderColor: '#C9A84C' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['jour', 'Par jour'], ['periode', 'Par période']].map(([k, l]) => (
              <button key={k} onClick={() => setSaisieMode(k)} style={{ padding: '7px 18px', borderRadius: 16, border: `1.5px solid ${saisieMode === k ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`, background: saisieMode === k ? '#C9A84C' : '#fff', color: saisieMode === k ? '#fff' : '#5A5A5A', fontSize: 12, cursor: 'pointer', fontWeight: saisieMode === k ? 500 : 400 }}>{l}</button>
            ))}
          </div>
          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>{msg.text}</div>}
          <form onSubmit={checkAndSave}>
            <div style={{ display: 'grid', gridTemplateColumns: saisieMode === 'jour' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Conseillère *</label>
                <select value={form.conseillere_id} onChange={e => setForm(p => ({ ...p, conseillere_id: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Sélectionner...</option>
                  {conseilleres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              {saisieMode === 'jour' ? (
                <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></div>
              ) : (
                <>
                  <div><label style={labelStyle}>Date début</label><input type="date" value={form.date_debut} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Date fin</label><input type="date" value={form.date_fin} onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))} style={inputStyle} /></div>
                </>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
              <div><label style={labelStyle}>Leads Bruts</label><input type="number" min="0" value={form.leads_bruts} onChange={e => setForm(p => ({ ...p, leads_bruts: e.target.value }))} placeholder="ex: 120" style={inputStyle} /></div>
              <div><label style={labelStyle}>Indispos</label><input type="number" min="0" value={form.indispos} onChange={e => setForm(p => ({ ...p, indispos: e.target.value }))} placeholder="ex: 20" style={inputStyle} /></div>
              <div><label style={labelStyle}>Leads Nets (auto)</label><input type="number" value={saisieMode === 'jour' ? leadsNetsForm : '—'} readOnly style={{ ...inputStyle, background: '#F7F0DC', borderColor: '#C9A84C', color: '#8a6a1a', fontWeight: 500 }} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 14, marginBottom: 14 }}>
              <div><label style={labelStyle}>Échanges</label><input type="number" min="0" step="0.5" value={form.echanges} onChange={e => setForm(p => ({ ...p, echanges: e.target.value }))} placeholder="0" style={inputStyle} /></div>
            </div>
            <div style={{ padding: '10px 14px', background: 'rgba(83,74,183,0.05)', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#534AB7', border: '1px solid rgba(83,74,183,0.15)' }}>
              ℹ️ RDV, Visites et Ventes sont automatiquement calculés depuis le <strong>Flux RDV</strong>
            </div>
            <button type="submit" disabled={saving} style={{ background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '11px 28px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </div>
      )}

      <DrillNav data={saisies} onSelect={setSelected} selected={selected} />

      {/* ── VUE JOUR : affiche calendar_rdv ── */}
      {isJourView && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontFamily: 'Cormorant Garamond, serif', fontWeight: 600, color: '#E07B30' }}>
              📅 RDV créés le {selected.value}
            </div>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'rgba(224,123,48,0.1)', color: '#E07B30', border: '1px solid rgba(224,123,48,0.3)' }}>Depuis Google Calendar</span>
          </div>
          <VueJourCalendar selectedJour={selected.value} conseilleres={conseilleres} />
          <div style={{ height: 24 }} />
        </>
      )}

      <SectionTitle>KPIs Globaux — {selected.label}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Productivité" value={kpisGlobal.productivite} sub="Échanges / Leads nets" badge={`Leads nets: ${kpisGlobal.leads_nets}`} objectifPct={objectifs.obj_productivite_pct} />
        <KpiCard label="Conv. Téléphonique" value={kpisGlobal.conversion_tel} sub="RDV / Échanges" badge={`CV: ${cvConvTel}%`} objectifPct={objectifs.obj_conv_tel_pct} objectifNb={objectifs.obj_conv_tel_nb} valeurNb={kpisGlobal.rdv} />
        <KpiCard label="Taux de Présence" value={kpisGlobal.taux_presence} sub="Visites / RDV" badge={`CV: ${cvPresence}%`} objectifPct={objectifs.obj_presence_pct} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Efficacité Commerciale" value={kpisGlobal.efficacite_comm} sub="Ventes / Visites" badge={`CV: ${cvEfficacite}%`} objectifPct={objectifs.obj_efficacite_pct} objectifNb={objectifs.obj_efficacite_nb} valeurNb={kpisGlobal.ventes} />
        <KpiCard label="Total RDV" value={kpisGlobal.rdv} unit="" sub="Période sélectionnée" objectifNb={objectifs.obj_rdv_nb} valeurNb={kpisGlobal.rdv} />
        <KpiCard label="Total Visites" value={kpisGlobal.visites} unit="" sub="Période sélectionnée" />
        <KpiCard label="Total Ventes" value={kpisGlobal.ventes} unit="" sub="Période sélectionnée" objectifNb={objectifs.obj_ventes_nb} valeurNb={kpisGlobal.ventes} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 28 }}>
        {[
          { title: 'Conv. Téléphonique', cv: cvConvTel, cvColor: '#C9A84C', dataKey: 'conv', chartType: 'bar', color: '#C9A84C' },
          { title: 'Taux de Présence', cv: cvPresence, cvColor: '#4CAF7D', dataKey: 'presence', chartType: 'line', color: '#4CAF7D' },
          { title: 'Efficacité Commerciale', cv: cvEfficacite, cvColor: '#534AB7', dataKey: 'efficacite', chartType: 'line', color: '#534AB7' },
        ].map(({ title, cv, cvColor, dataKey, chartType, color }) => (
          <div key={title} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
              <div style={{ fontSize: 11, color: '#5A5A5A' }}>CV: <span style={{ color: cvColor, fontWeight: 500 }}>{cv}%</span></div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              {chartType === 'bar' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${color}15`} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, title]} />
                  <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${color}15`} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, title]} />
                  <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      <SectionTitle>Détail par période</SectionTitle>
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>{['Période', 'Leads Bruts', 'Leads Nets', 'Indispos', 'Échanges', 'RDV', 'Visites', 'Ventes', 'Productivité', 'Conv. Tél.', 'CV Conv.', 'Présence', 'CV Prés.', 'Eff. Comm.', 'CV Eff.'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i} onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...tdStyle, fontWeight: 500, color: '#C9A84C' }}>{row.label}</td>
                  <td style={tdStyle}>{row.leads_bruts}</td>
                  <td style={tdStyle}>{row.leads_nets}</td>
                  <td style={{ ...tdStyle, color: '#E05C5C' }}>{row.indispos}</td>
                  <td style={tdStyle}>{row.echanges}</td>
                  <td style={tdStyle}>{row.rdv}</td>
                  <td style={tdStyle}>{row.visites}</td>
                  <td style={tdStyle}>{row.ventes}</td>
                  <td style={{ ...tdStyle, fontWeight: 500, color: getColorFromObjectif(row.productivite, objectifs.obj_productivite_pct) }}>{row.productivite}%</td>
                  <td style={{ ...tdStyle, fontWeight: 500, color: getColorFromObjectif(row.conversion_tel, objectifs.obj_conv_tel_pct) }}>{row.conversion_tel}%</td>
                  <td style={{ ...tdStyle, color: '#8a6a1a', fontSize: 10 }}>{row.cv_conv}%</td>
                  <td style={{ ...tdStyle, color: getColorFromObjectif(row.taux_presence, objectifs.obj_presence_pct) }}>{row.taux_presence}%</td>
                  <td style={{ ...tdStyle, color: '#2d7a54', fontSize: 10 }}>{row.cv_presence}%</td>
                  <td style={{ ...tdStyle, color: getColorFromObjectif(row.efficacite_comm, objectifs.obj_efficacite_pct) }}>{row.efficacite_comm}%</td>
                  <td style={{ ...tdStyle, color: '#3a3480', fontSize: 10 }}>{row.cv_efficacite}%</td>
                </tr>
              ))}
              {tableData.length === 0 && <tr><td colSpan={15} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Aucune donnée — cliquez sur "+ Saisir données"</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>
          Ranking Conseillères <span style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 400, fontFamily: 'DM Sans' }}>(Conv. Tél. + Présence)</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowRankCols(p => !p)} style={{ padding: '6px 16px', borderRadius: 16, border: '1.5px solid rgba(201,168,76,0.3)', background: '#fff', color: '#C9A84C', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Colonnes ▾</button>
          {showRankCols && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: '12px', zIndex: 100, minWidth: 180, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Masquer / Afficher</div>
              {RANK_COLS.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 12, color: hiddenRankCols[c.key] ? '#8A8A7A' : '#2C2C2C' }}>
                  <input type="checkbox" checked={!hiddenRankCols[c.key]} onChange={() => setHiddenRankCols(p => ({ ...p, [c.key]: !p[c.key] }))} style={{ accentColor: '#C9A84C' }} />
                  {c.label}
                </label>
              ))}
              <button onClick={() => setHiddenRankCols({})} style={{ marginTop: 8, width: '100%', padding: '5px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: '#C9A84C', fontSize: 11, cursor: 'pointer' }}>Tout afficher</button>
            </div>
          )}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Étoiles</th>
                <th style={thStyle}>Conseillère</th>
                {RANK_COLS.filter(c => !hiddenRankCols[c.key]).map(c => <th key={c.key} style={{ ...thStyle, color: c.color || '#5A5A5A' }}>{c.label}</th>)}
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Détail</th>
              </tr>
            </thead>
            <tbody>
              {rankingSorted.map((c, i) => {
                const rankColor = getRankColor(i, rankingSorted.length)
                const stars = getStars(i, rankingSorted.length)
                const score = parseFloat(((c.conversion_tel + c.taux_presence) / 2).toFixed(1))
                const colValues = {
                  leads_bruts: { val: c.leads_bruts, style: tdStyle },
                  leads_nets: { val: c.leads_nets, style: tdStyle },
                  echanges: { val: c.echanges, style: tdStyle },
                  productivite: { val: `${c.productivite}%`, style: { ...tdStyle, fontWeight: 500, color: getColorFromObjectif(c.productivite, objectifs.obj_productivite_pct) } },
                  joignabilite: { val: `${c.joignabilite}%`, style: { ...tdStyle, color: c.joignabilite < 70 ? '#E05C5C' : '#4CAF7D' } },
                  conv_tel: { val: null, isBar: true, value: c.conversion_tel, color: rankColor, objColor: getColorFromObjectif(c.conversion_tel, objectifs.obj_conv_tel_pct) },
                  rdv: { val: c.rdv, style: { ...tdStyle, color: '#534AB7' } },
                  presence: { val: null, isBar: true, value: c.taux_presence, color: rankColor, objColor: getColorFromObjectif(c.taux_presence, objectifs.obj_presence_pct) },
                  visites: { val: c.visites, style: { ...tdStyle, color: '#4CAF7D' } },
                  efficacite_comm: { val: `${c.efficacite_comm}%`, style: tdStyle },
                  ventes: { val: c.ventes, style: { ...tdStyle, color: '#1a6b3c' } },
                }
                return (
                  <tr key={c.id} onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...tdStyle, fontSize: 16, fontWeight: 700, color: rankColor }}>{i + 1}</td>
                    <td style={{ ...tdStyle, color: '#C9A84C', letterSpacing: 2, fontSize: 16 }}>{stars}</td>
                    <td style={{ ...tdStyle, fontWeight: 500, color: rankColor, fontSize: 12 }}>{c.nom}</td>
                    {RANK_COLS.filter(col => !hiddenRankCols[col.key]).map(col => {
                      const cv = colValues[col.key]
                      if (!cv) return <td key={col.key} style={tdStyle}>—</td>
                      if (cv.isBar) return (
                        <td key={col.key} style={{ ...tdStyle, minWidth: 110 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ flex: 1, height: 8, background: 'rgba(201,168,76,0.15)', borderRadius: 4, overflow: 'hidden', minWidth: 50 }}>
                              <div style={{ height: '100%', width: `${Math.min(cv.value, 100)}%`, background: cv.color, borderRadius: 4 }}></div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 36, color: cv.objColor }}>{cv.value}%</span>
                          </div>
                        </td>
                      )
                      return <td key={col.key} style={cv.style}>{cv.val}</td>
                    })}
                    <td style={{ ...tdStyle, fontWeight: 600, color: rankColor, fontSize: 13 }}>{score}%</td>
                    <td style={tdStyle}>
                      <button onClick={() => setDrillConseillere(drillConseillere === c.id ? null : c.id)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.3)', background: drillConseillere === c.id ? '#C9A84C' : 'transparent', color: drillConseillere === c.id ? '#fff' : '#C9A84C', fontSize: 11, cursor: 'pointer' }}>
                        {drillConseillere === c.id ? 'Fermer' : 'Détail ↗'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drillConseillere && (() => {
        const c = conseilleres.find(c => c.id === drillConseillere)
        const data = saisiesEffectives.filter(s => s.conseillere_id === drillConseillere)
        const groups = groupFn(data)
        const items = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([key, items]) => ({ label: formatGroupLabel(key, periodeLabel), ...agregerParPeriode(items) }))
        const kpis = agregerParPeriode(data)
        return (
          <>
            <SectionTitle>Drill-down : {c?.nom}</SectionTitle>
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[{ label: 'Conv. Tél.', val: kpis.conversion_tel }, { label: 'Présence', val: kpis.taux_presence }, { label: 'Productivité', val: kpis.productivite }, { label: 'Eff. Comm.', val: kpis.efficacite_comm }].map(k => (
                  <div key={k.label} style={{ background: '#F8F7F4', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 600 }}>{k.val}%</div>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Période', 'Leads Bruts', 'Leads Nets', 'Échanges', 'RDV', 'Visites', 'Ventes', 'Productivité', 'Conv. Tél.', 'Présence', 'Eff. Comm.'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>
                    {items.map((row, i) => (
                      <tr key={i} onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...tdStyle, fontWeight: 500, color: '#C9A84C' }}>{row.label}</td>
                        <td style={tdStyle}>{row.leads_bruts}</td>
                        <td style={tdStyle}>{row.leads_nets}</td>
                        <td style={tdStyle}>{row.echanges}</td>
                        <td style={tdStyle}>{row.rdv}</td>
                        <td style={tdStyle}>{row.visites}</td>
                        <td style={tdStyle}>{row.ventes}</td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{row.productivite}%</td>
                        <td style={{ ...tdStyle, color: '#C9A84C', fontWeight: 500 }}>{row.conversion_tel}%</td>
                        <td style={{ ...tdStyle, color: '#4CAF7D' }}>{row.taux_presence}%</td>
                        <td style={{ ...tdStyle, color: '#534AB7' }}>{row.efficacite_comm}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      })()}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistorique ? 16 : 0, marginTop: 8 }}>
        <div onClick={() => setShowHistorique(p => !p)} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          Historique des saisies
          <span style={{ fontSize: 12, color: '#C9A84C', fontFamily: 'DM Sans' }}>{showHistorique ? '▲ Fermer' : '▼ Ouvrir'}</span>
        </div>
        {selectedRows.size > 0 && (
          <button onClick={async () => {
            if (!window.confirm(`Supprimer ${selectedRows.size} saisie(s) ?`)) return
            const { data: saisiesASuppr } = await supabase.from('saisies').select('*').in('id', [...selectedRows])
            await supabase.from('saisies').delete().in('id', [...selectedRows])
            for (const s of (saisiesASuppr || [])) {
              const { data: mkt } = await supabase.from('marketing_saisies').select('id').eq('conseillere_id', s.conseillere_id).gte('date_debut', s.date_debut).lte('date_debut', s.date_fin || s.date_debut).maybeSingle()
              if (mkt) await supabase.from('marketing_saisies').update({ indispos: 0 }).eq('id', mkt.id)
            }
            setSelectedRows(new Set())
            reload()
          }} style={{ padding: '7px 16px', borderRadius: 8, background: '#E05C5C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            Supprimer la sélection ({selectedRows.size})
          </button>
        )}
      </div>
      {showHistorique && <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>
                  <input type="checkbox" checked={selectedRows.size === saisies.slice(0, 30).length && saisies.length > 0}
                    onChange={e => setSelectedRows(e.target.checked ? new Set(saisies.slice(0, 30).map(s => s.id)) : new Set())}
                    style={{ accentColor: '#C9A84C' }} />
                </th>
                {['Période', 'Conseillère', 'Leads Bruts', 'Indispos', 'Leads Nets', 'Échanges', 'RDV', 'Visites', 'Ventes', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...saisies].slice(0, 30).map(s => {
                const c = conseilleres.find(c => c.id === s.conseillere_id)
                const periode = s.date_debut && s.date_fin && s.date_debut !== s.date_fin
                  ? `${s.date_debut.substring(8)}/${s.date_debut.substring(5, 7)} → ${s.date_fin.substring(8)}/${s.date_fin.substring(5, 7)}`
                  : (s.date_debut || s.date)
                const isSelected = selectedRows.has(s.id)
                return (
                  <tr key={s.id} style={{ background: isSelected ? '#F7F0DC' : 'transparent' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F7F0DC' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={isSelected}
                        onChange={e => {
                          const next = new Set(selectedRows)
                          e.target.checked ? next.add(s.id) : next.delete(s.id)
                          setSelectedRows(next)
                        }} style={{ accentColor: '#C9A84C' }} />
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500, color: '#C9A84C', whiteSpace: 'nowrap' }}>{periode}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{c?.nom || '—'}</td>
                    <td style={tdStyle}>{s.leads_bruts}</td>
                    <td style={{ ...tdStyle, color: '#E05C5C' }}>{s.indispos}</td>
                    <td style={{ ...tdStyle, color: '#C9A84C', fontWeight: 500 }}>{s.leads_nets}</td>
                    <td style={tdStyle}>{s.echanges}</td>
                    <td style={tdStyle}>{s.rdv}</td>
                    <td style={tdStyle}>{s.visites}</td>
                    <td style={tdStyle}>{s.ventes}</td>
                    <td style={{ ...tdStyle, minWidth: 160 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => annulerMiseAJour(s.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', background: 'transparent', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>↩ Annuler MàJ</button>
                        <button onClick={() => supprimerSaisie(s.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Suppr.</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {saisies.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Aucune saisie</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  )
}
