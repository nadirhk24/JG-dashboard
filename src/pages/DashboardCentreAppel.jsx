import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import PeriodeFilter from '../components/PeriodeFilter'
import ConseillereFilter from '../components/ConseillereFilter'
import KpiCard, { getColorFromObjectif } from '../components/KpiCard'
import SectionTitle from '../components/SectionTitle'
import { filtrerParPeriode, getGroupFunction, formatGroupLabel } from '../lib/dates'
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

function getPeriodeLabel(periode) {
  const labels = { jour: '30 derniers jours', semaine: '12 dernières semaines', mois: '24 derniers mois', trimestre: '8 derniers trimestres', perso: 'Période personnalisée' }
  return labels[periode] || periode
}

function cvSerie(valeurs) {
  const vals = valeurs.filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0)
  if (vals.length < 2) return 0
  const moy = vals.reduce((a, b) => a + b, 0) / vals.length
  if (moy === 0) return 0
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0) / vals.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

function getMoisCourant() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
}

const RANK_COLS = [
  { key: 'leads_bruts', label: 'Leads Bruts' },
  { key: 'leads_nets', label: 'Leads Nets' },
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
  const [periode, setPeriode] = useState('mois')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreConseillere, setFiltreConseillere] = useState('all')
  const [drillConseillere, setDrillConseillere] = useState(null)
  const [objectifs, setObjectifs] = useState({})
  const [hiddenRankCols, setHiddenRankCols] = useState({})
  const [showRankCols, setShowRankCols] = useState(false)

  useEffect(() => {
    loadObjectifs()
  }, [])

  async function loadObjectifs() {
    const mois = getMoisCourant()
    const { data } = await supabase.from('objectifs_callcenter').select('*').eq('mois', mois).single()
    setObjectifs(data || {})
  }

  function handleDateChange(type, val) {
    if (type === 'debut') setDateDebut(val)
    else setDateFin(val)
  }

  const saisiesFiltrees = useMemo(() => {
    let data = filtrerParPeriode(saisies, periode, dateDebut, dateFin)
    if (filtreConseillere !== 'all') data = data.filter(s => s.conseillere_id === filtreConseillere)
    return data
  }, [saisies, periode, dateDebut, dateFin, filtreConseillere])

  const kpisGlobal = useMemo(() => agregerParPeriode(saisiesFiltrees), [saisiesFiltrees])

  const kpisParConseillere = useMemo(() =>
    conseilleres.map(c => ({ ...c, ...agregerParPeriode(saisiesFiltrees, c.id) })),
    [conseilleres, saisiesFiltrees]
  )

  const cvConvTel = useMemo(() => calcCV(kpisParConseillere.map(c => c.conversion_tel)), [kpisParConseillere])
  const cvPresence = useMemo(() => calcCV(kpisParConseillere.map(c => c.taux_presence)), [kpisParConseillere])
  const cvEfficacite = useMemo(() => calcCV(kpisParConseillere.map(c => c.efficacite_comm)), [kpisParConseillere])

  const groupFn = useMemo(() => getGroupFunction(periode), [periode])

  const tableData = useMemo(() => {
    const groups = groupFn(saisiesFiltrees)
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      const convParC = conseilleres.map(c => calcConversionTel(items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.rdv,0), items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.echanges,0)))
      const presParC = conseilleres.map(c => calcTauxPresence(items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.visites,0), items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.rdv,0)))
      const effParC = conseilleres.map(c => calcEfficaciteComm(items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.ventes,0), items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.visites,0)))
      return { label: formatGroupLabel(key, periode), key, ...agg, cv_conv: cvSerie(convParC), cv_presence: cvSerie(presParC), cv_efficacite: cvSerie(effParC) }
    })
  }, [saisiesFiltrees, periode, groupFn, conseilleres])

  const chartData = useMemo(() => [...tableData].reverse().map(r => ({ label: r.label, conv: r.conversion_tel, presence: r.taux_presence, efficacite: r.efficacite_comm })), [tableData])

  const rankingSorted = useMemo(() => [...kpisParConseillere].sort((a, b) => ((b.conversion_tel + b.taux_presence) / 2) - ((a.conversion_tel + a.taux_presence) / 2)), [kpisParConseillere])

  const drillData = useMemo(() => {
    if (!drillConseillere) return null
    const c = conseilleres.find(c => c.id === drillConseillere)
    const data = filtrerParPeriode(saisies.filter(s => s.conseillere_id === drillConseillere), periode, dateDebut, dateFin)
    const groups = groupFn(data)
    const items = Object.entries(groups).sort(([a],[b])=>b.localeCompare(a)).map(([key,items])=>({ label:formatGroupLabel(key,periode), ...agregerParPeriode(items) }))
    return { conseillere: c, kpis: agregerParPeriode(data), items }
  }, [drillConseillere, saisies, conseilleres, periode, dateDebut, dateFin, groupFn])

  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const thStyle = { fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, whiteSpace: 'nowrap' }
  const tdStyle = { padding: '9px 8px', fontSize: 11, borderBottom: '1px solid rgba(201,168,76,0.06)', whiteSpace: 'nowrap' }
  const periodeLabel = periode === 'jour' ? 'jour' : periode === 'semaine' ? 'semaine' : periode === 'mois' ? 'mois' : 'trimestre'

  return (
    <div>
      <PageHeader title="Call Center" subtitle={getPeriodeLabel(periode)}>
        <PeriodeFilter value={periode} onChange={setPeriode} dateDebut={dateDebut} dateFin={dateFin} onDateChange={handleDateChange} />
        <ConseillereFilter conseilleres={conseilleres} value={filtreConseillere} onChange={setFiltreConseillere} />
      </PageHeader>

      <SectionTitle>KPIs Globaux — Équipe</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Productivité" value={kpisGlobal.productivite} sub="Échanges / Leads nets" badge={`Leads nets: ${kpisGlobal.leads_nets}`} objectifPct={objectifs.obj_productivite_pct} objectifNb={objectifs.obj_productivite_nb} valeurNb={kpisGlobal.echanges} />
        <KpiCard label="Joignabilité" value={kpisGlobal.joignabilite} sub="Leads joints / Leads bruts" badge={`${kpisGlobal.indispos} indispos`} objectifPct={objectifs.obj_joignabilite_pct} />
        <KpiCard label="Conv. Téléphonique" value={kpisGlobal.conversion_tel} sub="RDV / Échanges" badge={`CV: ${cvConvTel}%`} objectifPct={objectifs.obj_conv_tel_pct} objectifNb={objectifs.obj_conv_tel_nb} valeurNb={kpisGlobal.rdv} />
        <KpiCard label="Taux de Présence" value={kpisGlobal.taux_presence} sub="Visites / RDV" badge={`CV: ${cvPresence}%`} objectifPct={objectifs.obj_presence_pct} objectifNb={objectifs.obj_presence_nb} valeurNb={kpisGlobal.visites} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Efficacité Commerciale" value={kpisGlobal.efficacite_comm} sub="Ventes / Visites" badge={`CV: ${cvEfficacite}%`} objectifPct={objectifs.obj_efficacite_pct} objectifNb={objectifs.obj_efficacite_nb} valeurNb={kpisGlobal.ventes} />
        <KpiCard label="Total RDV" value={kpisGlobal.rdv} unit="" sub="Période sélectionnée" objectifNb={objectifs.obj_rdv_nb} valeurNb={kpisGlobal.rdv} />
        <KpiCard label="Total Visites" value={kpisGlobal.visites} unit="" sub="Période sélectionnée" objectifNb={objectifs.obj_visites_nb} valeurNb={kpisGlobal.visites} />
        <KpiCard label="Total Ventes" value={kpisGlobal.ventes} unit="" sub="Période sélectionnée" objectifNb={objectifs.obj_ventes_nb} valeurNb={kpisGlobal.ventes} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Conv. Téléphonique</div>
            <div style={{ fontSize: 11, color: '#5A5A5A' }}>CV: <span style={{ color: '#C9A84C', fontWeight: 500 }}>{cvConvTel}%</span></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Conv. Tél.']} />
              <Bar dataKey="conv" fill="#C9A84C" radius={[4, 4, 0, 0]} name="Conv. Tél." />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Taux de Présence</div>
            <div style={{ fontSize: 11, color: '#5A5A5A' }}>CV: <span style={{ color: '#4CAF7D', fontWeight: 500 }}>{cvPresence}%</span></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(76,175,125,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'Présence']} />
              <Line type="monotone" dataKey="presence" stroke="#4CAF7D" strokeWidth={2.5} dot={{ r: 4, fill: '#4CAF7D' }} name="Présence" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SectionTitle>Détail par {periodeLabel}</SectionTitle>
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>{['Période','Leads Bruts','Leads Nets','Indispos','Échanges','RDV','Visites','Ventes','Productivité','Conv. Tél.','CV Conv.','Présence','CV Prés.','Eff. Comm.','CV Eff.'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{...tdStyle,fontWeight:500,color:'#C9A84C'}}>{row.label}</td>
                  <td style={tdStyle}>{row.leads_bruts}</td>
                  <td style={tdStyle}>{row.leads_nets}</td>
                  <td style={{...tdStyle,color:'#E05C5C'}}>{row.indispos}</td>
                  <td style={tdStyle}>{row.echanges}</td>
                  <td style={tdStyle}>{row.rdv}</td>
                  <td style={tdStyle}>{row.visites}</td>
                  <td style={tdStyle}>{row.ventes}</td>
                  <td style={{...tdStyle,fontWeight:500,color:getColorFromObjectif(row.productivite,objectifs.obj_productivite_pct)}}>{row.productivite}%</td>
                  <td style={{...tdStyle,fontWeight:500,color:getColorFromObjectif(row.conversion_tel,objectifs.obj_conv_tel_pct)}}>{row.conversion_tel}%</td>
                  <td style={{...tdStyle,color:'#8a6a1a',fontSize:10}}>{row.cv_conv}%</td>
                  <td style={{...tdStyle,color:getColorFromObjectif(row.taux_presence,objectifs.obj_presence_pct)}}>{row.taux_presence}%</td>
                  <td style={{...tdStyle,color:'#2d7a54',fontSize:10}}>{row.cv_presence}%</td>
                  <td style={{...tdStyle,color:getColorFromObjectif(row.efficacite_comm,objectifs.obj_efficacite_pct)}}>{row.efficacite_comm}%</td>
                  <td style={{...tdStyle,color:'#3a3480',fontSize:10}}>{row.cv_efficacite}%</td>
                </tr>
              ))}
              {tableData.length === 0 && <tr><td colSpan={15} style={{textAlign:'center',padding:'32px',color:'#5A5A5A',fontSize:13}}>Aucune donnée pour cette période</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', display: 'flex', alignItems: 'center', gap: 12 }}>
          Ranking Conseillères
          <span style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 400, fontFamily: 'DM Sans' }}>(Conv. Tél. + Présence)</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,0.2)', width: 40 }}></div>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowRankCols(p => !p)} style={{ padding: '6px 16px', borderRadius: 16, border: '1.5px solid rgba(201,168,76,0.3)', background: '#fff', color: '#C9A84C', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Colonnes ▾</button>
          {showRankCols && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: '12px', zIndex: 100, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
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
                        <td key={col.key} style={{ ...tdStyle, minWidth: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 8, background: 'rgba(201,168,76,0.15)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                              <div style={{ height: '100%', width: `${Math.min(cv.value, 100)}%`, background: cv.color, borderRadius: 4 }}></div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 40, color: cv.objColor }}>{cv.value}%</span>
                          </div>
                        </td>
                      )
                      return <td key={col.key} style={cv.style}>{cv.val}</td>
                    })}
                    <td style={{ ...tdStyle, fontWeight: 600, color: rankColor, fontSize: 13 }}>{score}%</td>
                    <td style={tdStyle}>
                      <button onClick={() => setDrillConseillere(drillConseillere === c.id ? null : c.id)}
                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.3)', background: drillConseillere === c.id ? '#C9A84C' : 'transparent', color: drillConseillere === c.id ? '#fff' : '#C9A84C', fontSize: 11, cursor: 'pointer' }}>
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

      {drillConseillere && drillData && (
        <>
          <SectionTitle>Drill-down : {drillData.conseillere?.nom}</SectionTitle>
          <div style={cardStyle}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              {[{label:'Conv. Tél.',val:drillData.kpis.conversion_tel},{label:'Présence',val:drillData.kpis.taux_presence},{label:'Productivité',val:drillData.kpis.productivite},{label:'Eff. Comm.',val:drillData.kpis.efficacite_comm}].map(k => (
                <div key={k.label} style={{background:'#F8F7F4',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:10,color:'#5A5A5A',textTransform:'uppercase',marginBottom:6}}>{k.label}</div>
                  <div style={{fontSize:26,fontWeight:600}}>{k.val}%</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Période','Leads Bruts','Leads Nets','Échanges','RDV','Visites','Ventes','Productivité','Conv. Tél.','Présence','Eff. Comm.'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>
                  {drillData.items.map((row,i) => (
                    <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{...tdStyle,fontWeight:500,color:'#C9A84C'}}>{row.label}</td>
                      <td style={tdStyle}>{row.leads_bruts}</td>
                      <td style={tdStyle}>{row.leads_nets}</td>
                      <td style={tdStyle}>{row.echanges}</td>
                      <td style={tdStyle}>{row.rdv}</td>
                      <td style={tdStyle}>{row.visites}</td>
                      <td style={tdStyle}>{row.ventes}</td>
                      <td style={{...tdStyle,fontWeight:500}}>{row.productivite}%</td>
                      <td style={{...tdStyle,color:'#C9A84C',fontWeight:500}}>{row.conversion_tel}%</td>
                      <td style={{...tdStyle,color:'#4CAF7D'}}>{row.taux_presence}%</td>
                      <td style={{...tdStyle,color:'#534AB7'}}>{row.efficacite_comm}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
