import React, { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'
import { supabase } from '../lib/supabase'
import { filtrerParSelection, getGroupFunction, formatGroupLabel } from '../lib/dates'
import { agregerParPeriode } from '../lib/kpi'
function InfoBulle({ text }) {
  const [show, setShow] = React.useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}>
      <span onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', flexShrink: 0 }}>i</span>
      {show && (
        <span style={{ position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)', background: '#2C2C2C', color: '#fff', fontSize: 11, padding: '8px 12px', borderRadius: 8, whiteSpace: 'normal', width: 220, zIndex: 999, lineHeight: 1.5, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: 5, borderStyle: 'solid', borderColor: '#2C2C2C transparent transparent transparent' }}></span>
        </span>
      )}
    </span>
  )
}
const CC_KPIS = [
  { key: 'conversion_tel', label: 'Conv. Telephonique', color: '#C9A84C', unit: '%' },
  { key: 'taux_presence', label: 'Taux de Presence', color: '#4CAF7D', unit: '%' },
  { key: 'efficacite_comm', label: 'Efficacite Commerciale', color: '#534AB7', unit: '%' },
  { key: 'productivite', label: 'Productivite', color: '#378ADD', unit: '%' },
  { key: 'joignabilite', label: 'Joignabilite', color: '#2E9455', unit: '%' },
]
const FLUX_KPIS = [
  { key: 'flux_rdv', label: 'RDV fixes', color: '#C9A84C', unit: '', isAbsolute: true },
  { key: 'flux_visites', label: 'Visites', color: '#4CAF7D', unit: '', isAbsolute: true },
  { key: 'flux_ventes', label: 'Ventes', color: '#1a6b3c', unit: '', isAbsolute: true },
  { key: 'flux_taux_presence', label: 'Tx presence', color: '#534AB7', unit: '%', isAbsolute: false },
  { key: 'flux_taux_vente', label: 'Tx vente', color: '#378ADD', unit: '%', isAbsolute: false },
]
const MKT_KPIS = [
  { key: 'taux_rdv', label: 'Taux RDV', color: '#534AB7', unit: '%' },
  { key: 'taux_visites', label: 'Taux Visites', color: '#4CAF7D', unit: '%' },
  { key: 'taux_ventes', label: 'Taux Ventes', color: '#1a6b3c', unit: '%' },
  { key: 'taux_suivis', label: 'Taux Suivis', color: '#C9A84C', unit: '%' },
  { key: 'taux_indispos', label: 'Taux Indispos', color: '#E05C5C', unit: '%' },
  { key: 'taux_non_exp', label: 'Taux Non exploit.', color: '#8A8A7A', unit: '%' },
]
function calcTaux(val, base) {
  if (!base || base === 0) return 0
  return parseFloat(((val / base) * 100).toFixed(1))
}
function calcMoyenne(vals) {
  const v = vals.filter(x => x > 0)
  if (v.length === 0) return 0
  return v.reduce((a, b) => a + b, 0) / v.length
}
function calcEcartType(vals) {
  const v = vals.filter(x => x > 0)
  if (v.length < 2) return 0
  const moy = calcMoyenne(v)
  const variance = v.reduce((sum, x) => sum + Math.pow(x - moy, 2), 0) / v.length
  return Math.sqrt(variance)
}
function calcCV(vals) {
  const moy = calcMoyenne(vals)
  if (moy === 0) return 0
  return parseFloat(((calcEcartType(vals) / moy) * 100).toFixed(1))
}
function generateBellCurve(mean, stdDev, numPoints) {
  if (!numPoints) numPoints = 100
  if (stdDev === 0) return []
  const points = []
  const min = mean - 4 * stdDev
  const max = mean + 4 * stdDev
  const step = (max - min) / numPoints
  for (let x = min; x <= max; x += step) {
    const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
    points.push({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(6)) })
  }
  return points
}
const CustomBarLabel = ({ x, y, width, value }) => {
  if (!value) return null
  return <text x={x + width / 2} y={y - 5} fill="#5A5A5A" textAnchor="middle" fontSize={10}>{value}%</text>
}
const CustomDotLabel = ({ cx, cy, value }) => {
  if (!value && value !== 0) return null
  return <text x={cx} y={cy - 10} fill="#C9A84C" textAnchor="middle" fontSize={10} fontWeight={500}>{value}%</text>
}
function CVBrutBloc({ fluxEquipe, fluxCommerciaux, fluxData, groupFn, InfoBulleComp }) {
  const filteredComms = fluxEquipe === 'all'
    ? fluxCommerciaux.filter(c => !c.nom.includes('Non reconnu'))
    : fluxCommerciaux.filter(c => c.equipe === fluxEquipe && !c.nom.includes('Non reconnu'))
  const fluxGroups = groupFn(fluxData.map(f => ({ ...f, date: f.date_debut })))
  const FLUX_KPIS_ALL = [
    { key: 'flux_rdv', label: 'RDV', color: '#C9A84C' },
    { key: 'flux_visites', label: 'Visites', color: '#4CAF7D' },
    { key: 'flux_ventes', label: 'Ventes', color: '#1a6b3c' },
    { key: 'flux_taux_presence', label: 'Tx Presence', color: '#534AB7', isRate: true },
    { key: 'flux_taux_vente', label: 'Tx Vente', color: '#378ADD', isRate: true },
  ]
  function getVal(dRaw, key) {
    const ventes = parseFloat(dRaw.ventes || 0)
    const vis = parseFloat(dRaw.visites || 0)
    const rdv = parseFloat(dRaw.rdv || 0)
    const visTotal = vis + ventes
    const rdvTotal = rdv + visTotal
    if (key === 'flux_rdv') return rdvTotal
    if (key === 'flux_visites') return visTotal
    if (key === 'flux_ventes') return ventes
    if (key === 'flux_taux_presence') return rdvTotal > 0 ? parseFloat(((visTotal/rdvTotal)*100).toFixed(1)) : 0
    if (key === 'flux_taux_vente') return visTotal > 0 ? parseFloat(((ventes/visTotal)*100).toFixed(1)) : 0
    return 0
  }
  const kpiStats = FLUX_KPIS_ALL.map(kpi => {
    const allVals = []
    Object.values(fluxGroups).forEach(items => {
      const commData = {}
      items.forEach(f => {
        if (!f.commercial_id) return
        if (!commData[f.commercial_id]) commData[f.commercial_id] = { rdv:0, visites:0, ventes:0 }
        commData[f.commercial_id].rdv += parseFloat(f.rdv||0)
        commData[f.commercial_id].visites += parseFloat(f.visites||0)
        commData[f.commercial_id].ventes += parseFloat(f.ventes||0)
      })
      filteredComms.forEach(c => {
        const v = getVal(commData[c.id] || {rdv:0,visites:0,ventes:0}, kpi.key)
        if (v > 0) allVals.push(v)
      })
    })
    if (allVals.length < 2) return { ...kpi, cv: 0, moy: 0, ecart: 0, ucl: 0, lcl: 0, n: allVals.length }
    const moy = allVals.reduce((a,b)=>a+b,0) / allVals.length
    const ecart = Math.sqrt(allVals.reduce((s,v)=>s+Math.pow(v-moy,2),0) / allVals.length)
    const cv = moy > 0 ? parseFloat(((ecart/moy)*100).toFixed(1)) : 0
    const ucl = parseFloat((moy + 2*ecart).toFixed(1))
    const lcl = parseFloat(Math.max(0, moy - 2*ecart).toFixed(1))
    return { ...kpi, cv, moy: parseFloat(moy.toFixed(1)), ecart: parseFloat(ecart.toFixed(1)), ucl, lcl, n: allVals.length }
  })
  const getMaitrise = cv => {
    if (cv === 0) return { label: 'Pas assez de donnees', color: '#8A8A7A', dot: 'o' }
    if (cv < 15) return { label: 'Maitrise', color: '#1a6b3c', dot: 'v' }
    if (cv < 30) return { label: 'Moderement variable', color: '#C9A84C', dot: '~' }
    if (cv < 50) return { label: 'Variable - a surveiller', color: '#E07B30', dot: '!' }
    return { label: 'Tres variable', color: '#E05C5C', dot: 'x' }
  }
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, marginTop: 24 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>
          Analyse CV - Dispersion brute inter-commerciaux
        </div>
        <InfoBulleComp text="CV calcule sur l'ensemble des valeurs brutes : chaque commercial x chaque jour de la periode. Mesure la dispersion globale des performances individuelles." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {kpiStats.map(k => {
          const m = getMaitrise(k.cv)
          return (
            <div key={k.key} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid ' + k.color }}>
              <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: k.cv > 30 ? '#E07B30' : k.cv > 15 ? '#C9A84C' : '#1a6b3c' }}>{k.cv}%</div>
              <div style={{ fontSize: 11, color: m.color, marginTop: 4, fontWeight: 500 }}>{m.dot} {m.label}</div>
              <div style={{ marginTop: 8, fontSize: 10, color: '#8A8A7A', lineHeight: 1.6 }}>
                <div>Moy: <strong style={{ color: '#2C2C2C' }}>{k.moy}{k.isRate ? '%' : ''}</strong></div>
                <div>Ecart: <strong style={{ color: '#2C2C2C' }}>{k.ecart}{k.isRate ? '%' : ''}</strong></div>
                <div>UCL: <strong style={{ color: '#E05C5C' }}>{k.ucl}{k.isRate ? '%' : ''}</strong> LCL: <strong style={{ color: '#4CAF7D' }}>{k.lcl}{k.isRate ? '%' : ''}</strong></div>
                <div>n = {k.n}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default function AnalyseCV({ conseilleres, saisies }) {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'
  const perms = profil?.permissions || {}
  // Permissions segments Analyse CV
  const canSeeCC      = isSuperAdmin || perms.analyse_cv_cc !== false
  const canSeeMkt     = isSuperAdmin || perms.analyse_cv_marketing !== false
  const canSeeFlux    = isSuperAdmin || perms.analyse_cv_flux !== false
  const canSeeFluxSale    = isSuperAdmin || perms.analyse_cv_flux_sale !== false
  const canSeeFluxKenitra = isSuperAdmin || perms.analyse_cv_flux_kenitra !== false

  // Segment par défaut : premier autorisé
  const defaultSegment = canSeeCC ? 'callcenter' : canSeeMkt ? 'marketing' : 'flux'
  const [segment, setSegment] = useState(defaultSegment)
  const [kpiKey, setKpiKey] = useState('conversion_tel')
  const [periode, setPeriode] = useState('mois')
  const [marketingData, setMarketingData] = useState([])
  const [fluxData, setFluxData] = useState([])
  const [fluxCommerciaux, setFluxCommerciaux] = useState([])
  const [fluxEquipe, setFluxEquipe] = useState('all')
  const [expandedChart, setExpandedChart] = useState(null)
  useEffect(() => { loadMarketing(); loadFlux() }, [])
  async function loadMarketing() {
    const { data } = await supabase.from('marketing_saisies').select('*').order('date', { ascending: true })
    setMarketingData(data || [])
  }
  async function loadFlux() {
    const [{ data: flux }, { data: comms }] = await Promise.all([
      supabase.from('flux_rdv').select('*'),
      supabase.from('commerciaux').select('*').eq('actif', true)
    ])
    setFluxData(flux || [])
    setFluxCommerciaux(comms || [])
  }
  useEffect(() => {
    if (segment === 'callcenter') setKpiKey('conversion_tel')
    else if (segment === 'marketing') setKpiKey('taux_rdv')
    else setKpiKey('flux_rdv')
  }, [segment])
  const kpis = segment === 'callcenter' ? CC_KPIS : segment === 'marketing' ? MKT_KPIS : FLUX_KPIS
  const selectedKpi = kpis.find(k => k.key === kpiKey) || kpis[0]
  const groupFn = useMemo(() => getGroupFunction(periode), [periode])
  const chartData = useMemo(() => {
    if (segment === 'callcenter') {
      const groups = groupFn(saisies)
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
        const agg = agregerParPeriode(items)
        return { label: formatGroupLabel(key, periode), taux: agg[kpiKey] || 0, cv_intercomm: agg[kpiKey] || 0, moy: agg[kpiKey] || 0 }
      })
    } else if (segment === 'flux') {
      const filteredComms = fluxEquipe === 'all'
        ? fluxCommerciaux.filter(c => !c.nom.includes('Non reconnu'))
        : fluxCommerciaux.filter(c => c.equipe === fluxEquipe && !c.nom.includes('Non reconnu'))
      const fluxGroups = groupFn(fluxData.map(f => ({ ...f, date: f.date_debut })))
      function getCommVal(dRaw, key) {
        const ventes = parseFloat(dRaw.ventes || 0)
        const visSaisies = parseFloat(dRaw.visites || 0)
        const rdvSaisis = parseFloat(dRaw.rdv || 0)
        const visTotal = visSaisies + ventes
        const rdvTotal = rdvSaisis + visTotal
        if (key === 'flux_rdv') return rdvTotal
        if (key === 'flux_visites') return visTotal
        if (key === 'flux_ventes') return ventes
        if (key === 'flux_taux_presence') return rdvTotal > 0 ? parseFloat(((visTotal/rdvTotal)*100).toFixed(1)) : 0
        if (key === 'flux_taux_vente') return visTotal > 0 ? parseFloat(((ventes/visTotal)*100).toFixed(1)) : 0
        return 0
      }
      return Object.entries(fluxGroups).sort(([a],[b]) => a.localeCompare(b)).map(([key, items]) => {
        const commData = {}
        items.forEach(f => {
          if (!f.commercial_id) return
          if (!commData[f.commercial_id]) commData[f.commercial_id] = { rdv: 0, visites: 0, ventes: 0 }
          commData[f.commercial_id].rdv += parseFloat(f.rdv || 0)
          commData[f.commercial_id].visites += parseFloat(f.visites || 0)
          commData[f.commercial_id].ventes += parseFloat(f.ventes || 0)
        })
        const valsParComm = filteredComms
          .map(c => getCommVal(commData[c.id] || { rdv:0, visites:0, ventes:0 }, kpiKey))
          .filter(v => v > 0)
        const moy = valsParComm.length > 0 ? parseFloat((valsParComm.reduce((a,b)=>a+b,0) / valsParComm.length).toFixed(1)) : 0
        const cvPeriode = valsParComm.length >= 2 ? (() => {
          if (moy === 0) return 0
          const ecart = Math.sqrt(valsParComm.reduce((s,v)=>s+Math.pow(v-moy,2),0) / valsParComm.length)
          return parseFloat(((ecart/moy)*100).toFixed(1))
        })() : 0
        return { label: formatGroupLabel(key, periode), taux: cvPeriode, moy, cv_intercomm: cvPeriode }
      })
    } else {
      const groups = groupFn(marketingData)
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
        const t = items.reduce((acc, s) => ({
          injections: acc.injections + (s.injections || 0),
          non_exploitables: acc.non_exploitables + (s.non_exploitables || 0),
          indispos: acc.indispos + (s.indispos || 0),
          suivis: acc.suivis + (s.suivis || 0),
          rdv: acc.rdv + (s.rdv || 0),
          visites: acc.visites + (s.visites || 0),
          ventes: acc.ventes + (s.ventes || 0),
        }), { injections: 0, non_exploitables: 0, indispos: 0, suivis: 0, rdv: 0, visites: 0, ventes: 0 })
        const base_nette = Math.max(0, t.injections - t.non_exploitables - t.indispos)
        const agg = {
          taux_rdv: calcTaux(t.rdv, base_nette),
          taux_visites: calcTaux(t.visites, base_nette),
          taux_ventes: calcTaux(t.ventes, base_nette),
          taux_suivis: calcTaux(t.suivis, base_nette),
          taux_indispos: calcTaux(t.indispos, t.injections),
          taux_non_exp: calcTaux(t.non_exploitables, t.injections),
        }
        return { label: formatGroupLabel(key, periode), taux: agg[kpiKey] || 0 }
      })
    }
  }, [segment, saisies, marketingData, kpiKey, periode, groupFn, fluxData, fluxCommerciaux, fluxEquipe])
  const cvData = useMemo(() => {
    if (chartData.length === 0) return []
    const result = []
    result.push({ label: chartData[0].label, cv: 0 })
    for (let i = 1; i < chartData.length; i++) {
      const slice = chartData.slice(0, i + 1)
      const cv = calcCV(slice.map(r => r.taux))
      result.push({ label: chartData[i].label, cv })
    }
    return result
  }, [chartData])
  const cvGlobal = useMemo(() => calcCV(chartData.map(r => r.taux)), [chartData])
  const stats = useMemo(() => {
    const vals = chartData.map(r => r.taux).filter(v => v > 0)
    const moy = calcMoyenne(vals)
    const ecart = calcEcartType(vals)
    const ucl = parseFloat((moy + 2 * ecart).toFixed(2))
    const lcl = parseFloat(Math.max(0, moy - 2 * ecart).toFixed(2))
    return { moy: parseFloat(moy.toFixed(2)), ecart: parseFloat(ecart.toFixed(2)), ucl, lcl }
  }, [chartData])
  const bellCurveData = useMemo(() => generateBellCurve(stats.moy, stats.ecart), [stats])
  const periodes = [
    { key: 'jour', label: 'Jour' },
    { key: 'semaine', label: 'Semaine' },
    { key: 'mois', label: 'Mois' },
    { key: 'trimestre', label: 'Trimestre' },
  ]
  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const btnStyle = (active, color) => {
    if (!color) color = '#C9A84C'
    return {
      padding: '7px 16px', borderRadius: 20,
      border: '1.5px solid ' + (active ? color : 'rgba(201,168,76,0.2)'),
      background: active ? color : '#fff',
      color: active ? '#fff' : '#5A5A5A',
      fontSize: 12, fontWeight: active ? 500 : 400, cursor: 'pointer', transition: 'all 0.2s'
    }
  }
  const maitrise = cvGlobal === 0 ? { label: 'Pas assez de donnees', color: '#8A8A7A', dot: 'o' } :
    cvGlobal < 15 ? { label: 'Processus maitrise', color: '#1a6b3c', dot: 'v' } :
    cvGlobal < 30 ? { label: 'Moderement variable', color: '#C9A84C', dot: '~' } :
    cvGlobal < 50 ? { label: 'Variable - a surveiller', color: '#E07B30', dot: '!' } :
    { label: 'Hors controle - action requise', color: '#E05C5C', dot: 'x' }
  return (
    <div>
      <PageHeader title="Analyse de la capabilite" subtitle="Coefficient de variation et maitrise des procedes" />
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Segment</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canSeeCC && <button style={btnStyle(segment === 'callcenter')} onClick={() => setSegment('callcenter')}>Call Center</button>}
            {canSeeMkt && <button style={btnStyle(segment === 'marketing')} onClick={() => setSegment('marketing')}>Marketing</button>}
            {canSeeFlux && <button style={btnStyle(segment === 'flux', '#534AB7')} onClick={() => setSegment('flux')}>Flux RDV</button>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Periode</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {periodes.map(p => (
              <button key={p.key} style={btnStyle(periode === p.key)} onClick={() => setPeriode(p.key)}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>
      {segment === 'flux' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Equipe</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(canSeeFluxSale && canSeeFluxKenitra) && <button onClick={() => setFluxEquipe('all')} style={btnStyle(fluxEquipe==='all')}>Toutes</button>}
            {canSeeFluxSale && <button onClick={() => setFluxEquipe('sale')} style={btnStyle(fluxEquipe==='sale')}>Sale</button>}
            {canSeeFluxKenitra && <button onClick={() => setFluxEquipe('kenitra')} style={btnStyle(fluxEquipe==='kenitra')}>Kenitra</button>}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#5A5A5A', padding: '8px 12px', background: 'rgba(201,168,76,0.05)', borderRadius: 8, border: '1px solid rgba(201,168,76,0.1)' }}>
            Le graphe montre l'evolution du CV inter-commerciaux par periode
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 500 }}>KPI</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {kpis.map(k => (
          <button key={k.key} style={btnStyle(kpiKey === k.key, k.color)} onClick={() => setKpiKey(k.key)}>{k.label}</button>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 24px', border: '1px solid rgba(201,168,76,0.15)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>KPI</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: selectedKpi.color }}>{selectedKpi.label}</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>CV Global</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: maitrise.color }}>{cvGlobal}%</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Moyenne</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#2C2C2C' }}>{stats.moy}{selectedKpi && selectedKpi.isAbsolute ? '' : '%'}</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>UCL / LCL</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#2C2C2C' }}>{stats.ucl}{selectedKpi && selectedKpi.isAbsolute ? '' : '%'} / {stats.lcl}{selectedKpi && selectedKpi.isAbsolute ? '' : '%'}</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Maitrise</div>
          <div style={{ fontSize: 13, color: maitrise.color, fontWeight: 500 }}>{maitrise.dot} {maitrise.label}</div>
        </div>
      </div>
      {segment === 'flux' && (
        <CVBrutBloc
          fluxEquipe={fluxEquipe}
          fluxCommerciaux={fluxCommerciaux}
          fluxData={fluxData}
          groupFn={groupFn}
          InfoBulleComp={InfoBulle}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4 }}>{selectedKpi.label}</div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16, display: 'flex', alignItems: 'center' }}>
            {segment === 'flux' ? 'CV inter-commerciaux par periode' : 'Valeur par ' + periode}
            <InfoBulle text={segment === 'flux' ? 'Chaque barre = CV inter-commerciaux de la periode. Les lignes UCL/LCL delimitent la zone normale.' : 'Chaque barre represente la valeur du KPI pour la periode.'} />
          </div>
          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#5A5A5A', fontSize: 13 }}>Pas de donnees</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => selectedKpi && selectedKpi.isAbsolute ? v : v + '%'} domain={[0, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [selectedKpi && selectedKpi.isAbsolute ? v : v + '%', selectedKpi.label]} />
                {stats.ucl > 0 && <ReferenceLine y={stats.ucl} stroke="#E05C5C" strokeDasharray="4 4" label={{ value: 'UCL ' + stats.ucl + (selectedKpi && selectedKpi.isAbsolute ? '' : '%'), fill: '#E05C5C', fontSize: 10, position: 'right' }} />}
                {stats.lcl > 0 && <ReferenceLine y={stats.lcl} stroke="#4CAF7D" strokeDasharray="4 4" label={{ value: 'LCL ' + stats.lcl + (selectedKpi && selectedKpi.isAbsolute ? '' : '%'), fill: '#4CAF7D', fontSize: 10, position: 'right' }} />}
                {stats.moy > 0 && <ReferenceLine y={stats.moy} stroke="#C9A84C" strokeDasharray="2 2" label={{ value: 'Moy ' + stats.moy + (selectedKpi && selectedKpi.isAbsolute ? '' : '%'), fill: '#C9A84C', fontSize: 10, position: 'right' }} />}
                <Bar dataKey="taux" fill={selectedKpi.color} radius={[4, 4, 0, 0]} name={selectedKpi.label}>
                  <LabelList dataKey="taux" content={<CustomBarLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
            CV inter-periodes
            <InfoBulle text="CV calcule periode par periode. Mesure la dispersion entre les periodes successives." />
          </div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16 }}>Evolution du CV par periode</div>
          {cvData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#5A5A5A', fontSize: 13 }}>Pas assez de donnees</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cvData} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v + '%'} domain={[0, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [v + '%', 'CV']} />
                <Line type="monotone" dataKey="cv" stroke="#C9A84C" strokeWidth={2.5} dot={{ r: 5, fill: '#C9A84C' }} name="CV">
                  <LabelList dataKey="cv" content={<CustomDotLabel />} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {bellCurveData.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ cursor: 'pointer' }} onClick={() => setExpandedChart(expandedChart === 'bell' ? null : 'bell')}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                Distribution - Loi normale
                <InfoBulle text="Distribution des valeurs selon une loi normale. La zone entre LCL et UCL represente 95% des valeurs attendues." />
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#C9A84C' }}>{expandedChart === 'bell' ? 'v' : '>'}</span>
              </div>
              <div style={{ fontSize: 10, color: '#5A5A5A', marginBottom: 8 }}>
                Moy: <strong>{stats.moy}{selectedKpi && selectedKpi.isAbsolute ? '' : '%'}</strong> UCL: <strong style={{ color: '#E05C5C' }}>{stats.ucl}</strong> LCL: <strong style={{ color: '#4CAF7D' }}>{stats.lcl}</strong>
              </div>
              <div style={{ fontSize: 11, color: maitrise.color, marginBottom: 8, fontWeight: 500 }}>{maitrise.dot} {maitrise.label}</div>
              <ResponsiveContainer width="100%" height={expandedChart === 'bell' ? 300 : 180}>
                <AreaChart data={bellCurveData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selectedKpi.color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={selectedKpi.color} stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                  <XAxis dataKey="x" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v.toFixed(3)} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {stats.ucl > 0 && <ReferenceLine x={stats.ucl} stroke="#E05C5C" strokeDasharray="4 4" label={{ value: 'UCL', fill: '#E05C5C', fontSize: 10 }} />}
                  {stats.lcl > 0 && <ReferenceLine x={stats.lcl} stroke="#4CAF7D" strokeDasharray="4 4" label={{ value: 'LCL', fill: '#4CAF7D', fontSize: 10 }} />}
                  {stats.moy > 0 && <ReferenceLine x={stats.moy} stroke="#C9A84C" strokeWidth={2} label={{ value: 'moy', fill: '#C9A84C', fontSize: 10 }} />}
                  <Area type="monotone" dataKey="y" stroke={selectedKpi.color} strokeWidth={2.5} fill="url(#bellGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {chartData.length > 0 && (
              <div style={{ cursor: 'pointer' }} onClick={() => setExpandedChart(expandedChart === 'cv' ? null : 'cv')}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                  CV cumulatif
                  <InfoBulle text="CV calcule de maniere cumulative : chaque point inclut toutes les donnees depuis le debut. Indique si le processus se stabilise dans le temps." />
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#C9A84C' }}>{expandedChart === 'cv' ? 'v' : '>'}</span>
                </div>
                <div style={{ fontSize: 10, color: '#5A5A5A', marginBottom: 8 }}>CV Global: <strong style={{ color: cvGlobal < 15 ? '#1a6b3c' : cvGlobal < 30 ? '#C9A84C' : '#E07B30' }}>{cvGlobal}%</strong></div>
                <div style={{ fontSize: 11, color: maitrise.color, marginBottom: 8, fontWeight: 500 }}>{maitrise.dot} {maitrise.label}</div>
                <ResponsiveContainer width="100%" height={expandedChart === 'cv' ? 300 : 180}>
                  <LineChart data={chartData.map((d,i) => ({ ...d, cvCumul: cvData[i] ? cvData[i].cv : 0 }))} margin={{ top: 10, right: 40, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }}/>
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v + '%'}/>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [v + '%', name]}/>
                    <ReferenceLine y={15} stroke="#4CAF7D" strokeDasharray="4 4" label={{ value: '15%', fill: '#4CAF7D', fontSize: 9, position: 'right' }}/>
                    <ReferenceLine y={30} stroke="#E07B30" strokeDasharray="4 4" label={{ value: '30%', fill: '#E07B30', fontSize: 9, position: 'right' }}/>
                    {segment === 'flux' ? (
                      <Line type="monotone" dataKey="cv_intercomm" stroke={selectedKpi ? selectedKpi.color : '#C9A84C'} strokeWidth={2.5} dot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} name="CV inter-commerciaux"/>
                    ) : (
                      <Line type="monotone" dataKey="cvCumul" stroke={selectedKpi ? selectedKpi.color : '#C9A84C'} strokeWidth={2.5} dot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} name="CV"/>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, marginTop: 24 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>Tableau detaille</div>
        <InfoBulle text={segment === 'flux' ? 'Moy. = moyenne du KPI par commercial. CV inter-commerciaux = dispersion entre les commerciaux.' : 'Valeur du KPI par periode avec le CV cumule et le statut de maitrise.'} />
      </div>
      <div style={{ ...cardStyle, marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {(segment === 'flux'
                ? ['Periode', 'Moy. ' + selectedKpi.label, 'CV inter-commerciaux', 'Statut']
                : ['Periode', selectedKpi.label, 'CV cumule', 'Statut']
              ).map(h => (
                <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => {
              const cvVal = segment === 'flux' ? (row.cv_intercomm || 0) : (cvData.find(c => c.label === row.label) ? cvData.find(c => c.label === row.label).cv : 0)
              const statut = cvVal === 0 ? { label: '-', color: '#8A8A7A' } :
                cvVal < 15 ? { label: 'Maitrise', color: '#1a6b3c' } :
                cvVal < 30 ? { label: 'Modere', color: '#C9A84C' } :
                cvVal < 50 ? { label: 'Variable', color: '#E07B30' } :
                { label: 'Hors controle', color: '#E05C5C' }
              const displayVal = segment === 'flux' ? row.moy : row.taux
              const displayUnit = selectedKpi && selectedKpi.isAbsolute ? '' : '%'
              return (
                <tr key={i} onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, color: '#C9A84C', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{row.label}</td>
                  <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, color: selectedKpi.color, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{displayVal}{displayUnit}</td>
                  <td style={{ padding: '9px 10px', fontSize: 12, color: statut.color, fontWeight: 500, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{cvVal > 0 ? cvVal + '%' : '-'}</td>
                  <td style={{ padding: '9px 10px', fontSize: 12, color: statut.color, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{statut.label}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
