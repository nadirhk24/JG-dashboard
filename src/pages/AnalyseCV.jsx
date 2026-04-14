import React, { useState, useMemo, useEffect } from 'react'
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
  { key: 'conversion_tel', label: 'Conv. Téléphonique', color: '#C9A84C', unit: '%' },
  { key: 'taux_presence', label: 'Taux de Présence', color: '#4CAF7D', unit: '%' },
  { key: 'efficacite_comm', label: 'Efficacité Commerciale', color: '#534AB7', unit: '%' },
  { key: 'productivite', label: 'Productivité', color: '#378ADD', unit: '%' },
  { key: 'joignabilite', label: 'Joignabilité', color: '#2E9455', unit: '%' },
]

const FLUX_KPIS = [
  { key: 'flux_rdv', label: 'RDV fixés', color: '#C9A84C', unit: '', isAbsolute: true },
  { key: 'flux_visites', label: 'Visites', color: '#4CAF7D', unit: '', isAbsolute: true },
  { key: 'flux_ventes', label: 'Ventes', color: '#1a6b3c', unit: '', isAbsolute: true },
  { key: 'flux_taux_presence', label: 'Tx présence', color: '#534AB7', unit: '%', isAbsolute: false },
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

// Genere les points de la courbe normale
function generateBellCurve(mean, stdDev, numPoints = 100) {
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

export default function AnalyseCV({ conseilleres, saisies }) {
  const [segment, setSegment] = useState('callcenter')
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

      // Grouper flux bruts par mois et par commercial
      const fluxByMois = {}
      fluxData.forEach(f => {
        const m = f.date_debut?.substring(0, 7)
        if (!m || !f.commercial_id) return
        if (!fluxByMois[m]) fluxByMois[m] = {}
        if (!fluxByMois[m][f.commercial_id]) fluxByMois[m][f.commercial_id] = { rdv: 0, visites: 0, ventes: 0 }
        fluxByMois[m][f.commercial_id].rdv += parseFloat(f.rdv || 0)
        fluxByMois[m][f.commercial_id].visites += parseFloat(f.visites || 0)
        fluxByMois[m][f.commercial_id].ventes += parseFloat(f.ventes || 0)
      })

      // Fonction pour calculer la valeur d'un commercial selon le KPI
      // Applique les regles: visites = vis+ventes, rdv = rdv+vis+ventes
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

      // Pour chaque mois: valeur par commercial → CV inter-commerciaux
      return Object.entries(fluxByMois).sort(([a],[b]) => a.localeCompare(b)).map(([mois, commData]) => {
        const valsParComm = filteredComms
          .map(c => getCommVal(commData[c.id] || { rdv:0, visites:0, ventes:0 }, kpiKey))
          .filter(v => v > 0)

        const moy = valsParComm.length > 0
          ? parseFloat((valsParComm.reduce((a,b)=>a+b,0) / valsParComm.length).toFixed(1))
          : 0

        const cvMois = valsParComm.length >= 2 ? (() => {
          if (moy === 0) return 0
          const ecart = Math.sqrt(valsParComm.reduce((s,v)=>s+Math.pow(v-moy,2),0) / valsParComm.length)
          return parseFloat(((ecart/moy)*100).toFixed(1))
        })() : 0

        const label = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][parseInt(mois.split('-')[1])-1] + ' ' + mois.split('-')[0].substring(2)
        // taux = CV inter-commerciaux de ce mois (pour tous les KPIs)
        return { label, taux: cvMois, moy, cv_intercomm: cvMois }
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
  }, [segment, saisies, marketingData, kpiKey, periode, groupFn])

  // CV cumulatif - inclut le premier point avec CV=0
  const cvData = useMemo(() => {
    if (chartData.length === 0) return []
    const result = []
    // Premier point = CV 0 (pas assez de données)
    result.push({ label: chartData[0].label, cv: 0 })
    for (let i = 1; i < chartData.length; i++) {
      const slice = chartData.slice(0, i + 1)
      const cv = calcCV(slice.map(r => r.taux))
      result.push({ label: chartData[i].label, cv })
    }
    return result
  }, [chartData])

  const cvGlobal = useMemo(() => calcCV(chartData.map(r => r.taux)), [chartData])

  // Statistiques pour la courbe en cloche
  const stats = useMemo(() => {
    const vals = chartData.map(r => r.taux).filter(v => v > 0)
    const moy = calcMoyenne(vals)
    const ecart = calcEcartType(vals)
    const ucl = parseFloat((moy + 2 * ecart).toFixed(2))
    const lcl = parseFloat(Math.max(0, moy - 2 * ecart).toFixed(2))
    const cv = vals.length >= 2 ? parseFloat(((ecart/moy)*100).toFixed(1)) : 0
    return { moy: parseFloat(moy.toFixed(2)), ecart: parseFloat(ecart.toFixed(2)), ucl, lcl, cv }
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
  const btnStyle = (active, color = '#C9A84C') => ({
    padding: '7px 16px', borderRadius: 20,
    border: `1.5px solid ${active ? color : 'rgba(201,168,76,0.2)'}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : '#5A5A5A',
    fontSize: 12, fontWeight: active ? 500 : 400, cursor: 'pointer', transition: 'all 0.2s'
  })

  const maitrise = cvGlobal === 0 ? { label: 'Pas assez de données', color: '#8A8A7A', dot: '⚪' } :
    cvGlobal < 15 ? { label: 'Processus maîtrisé', color: '#1a6b3c', dot: '🟢' } :
    cvGlobal < 30 ? { label: 'Modérément variable', color: '#C9A84C', dot: '🟡' } :
    cvGlobal < 50 ? { label: 'Variable — à surveiller', color: '#E07B30', dot: '🟠' } :
    { label: 'Hors contrôle — action requise', color: '#E05C5C', dot: '🔴' }

  return (
    <div>
      <PageHeader title="Analyse de la capabilité" subtitle="Coefficient de variation & maîtrise des procédés" />

      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Segment</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnStyle(segment === 'callcenter')} onClick={() => setSegment('callcenter')}>Call Center</button>
            <button style={btnStyle(segment === 'marketing')} onClick={() => setSegment('marketing')}>Marketing</button>
            <button style={btnStyle(segment === 'flux', '#534AB7')} onClick={() => setSegment('flux')}>Flux RDV</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Période</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {periodes.map(p => (
              <button key={p.key} style={btnStyle(periode === p.key)} onClick={() => setPeriode(p.key)}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {segment === 'flux' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Équipe</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['all','Toutes'],['sale','Sale'],['kenitra','Kenitra']].map(([k,l]) => (
              <button key={k} onClick={() => setFluxEquipe(k)} style={btnStyle(fluxEquipe===k)}>{l}</button>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#5A5A5A', padding: '8px 12px', background: 'rgba(201,168,76,0.05)', borderRadius: 8, border: '1px solid rgba(201,168,76,0.1)' }}>
            ℹ️ Le graphe montre l'évolution du <strong>CV inter-commerciaux</strong> mois par mois — si la courbe descend, l'équipe s'homogénéise ✅
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 500 }}>KPI</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {kpis.map(k => (
          <button key={k.key} style={btnStyle(kpiKey === k.key, k.color)} onClick={() => setKpiKey(k.key)}>{k.label}</button>
        ))}
      </div>

      {/* Bandeau synthese */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 24px', border: '1px solid rgba(201,168,76,0.15)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>KPI</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: selectedKpi.color }}>{selectedKpi.label}</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>CV Global</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: maitrise.color, fontFamily: 'DM Sans' }}>{cvGlobal}%</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Moyenne</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#2C2C2C' }}>{stats.moy}{selectedKpi?.isAbsolute ? '' : '%'}</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>UCL / LCL</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#2C2C2C' }}>{stats.ucl}{selectedKpi?.isAbsolute ? '' : '%'} / {stats.lcl}{selectedKpi?.isAbsolute ? '' : '%'}</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Maîtrise</div>
          <div style={{ fontSize: 13, color: maitrise.color, fontWeight: 500 }}>{maitrise.dot} {maitrise.label}</div>
        </div>
      </div>

      {/* Graphes taux + CV */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4 }}>{selectedKpi.label}</div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16, display: 'flex', alignItems: 'center' }}>
            {segment === 'flux' ? `CV inter-commerciaux par mois · UCL: ${stats.ucl}% · LCL: ${stats.lcl}%` : `Valeur par ${periode} · UCL: ${stats.ucl}${selectedKpi?.isAbsolute?'':'%'} · LCL: ${stats.lcl}${selectedKpi?.isAbsolute?'':'%'}`}
            <InfoBulle text={segment === 'flux' ? `Chaque barre = CV inter-commerciaux de ce mois pour ${selectedKpi?.label}. Les lignes UCL/LCL délimitent la zone normale. Une barre hors limites signale une anomalie.` : `Chaque barre représente la valeur du KPI pour la période. Les lignes UCL/LCL délimitent la zone de variation normale.`}/>
          </div>
          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#5A5A5A', fontSize: 13 }}>Pas de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => selectedKpi?.isAbsolute ? v : `${v}%`} domain={[0, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [selectedKpi?.isAbsolute ? v : `${v}%`, selectedKpi.label]} />
                {stats.ucl > 0 && <ReferenceLine y={stats.ucl} stroke="#E05C5C" strokeDasharray="4 4" label={{ value: `UCL ${stats.ucl}${selectedKpi?.isAbsolute?'':'%'}`, fill: '#E05C5C', fontSize: 10, position: 'right' }} />}
                {stats.lcl > 0 && <ReferenceLine y={stats.lcl} stroke="#4CAF7D" strokeDasharray="4 4" label={{ value: `LCL ${stats.lcl}${selectedKpi?.isAbsolute?'':'%'}`, fill: '#4CAF7D', fontSize: 10, position: 'right' }} />}
                {stats.moy > 0 && <ReferenceLine y={stats.moy} stroke="#C9A84C" strokeDasharray="2 2" label={{ value: `Moy ${stats.moy}${selectedKpi?.isAbsolute?'':'%'}`, fill: '#C9A84C', fontSize: 10, position: 'right' }} />}
                {segment === 'flux' && chartData.some(d => d.moy > 0) && chartData.map((d, i) => null)}
                <Bar dataKey="taux" fill={selectedKpi.color} radius={[4, 4, 0, 0]} name={selectedKpi.label}>
                  <LabelList dataKey="taux" content={<CustomBarLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}><span style={{ width: 14, height: 2, background: '#E05C5C', display: 'inline-block', borderTop: '2px dashed #E05C5C' }}></span>UCL</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}><span style={{ width: 14, height: 2, background: '#C9A84C', display: 'inline-block', borderTop: '2px dashed #C9A84C' }}></span>Moyenne</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}><span style={{ width: 14, height: 2, background: '#4CAF7D', display: 'inline-block', borderTop: '2px dashed #4CAF7D' }}></span>LCL</span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4 }}>CV — {selectedKpi.label}</div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16 }}>Évolution du coefficient de variation</div>
          {cvData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#5A5A5A', fontSize: 13 }}>Pas assez de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cvData} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, 'CV']} />
                <Line type="monotone" dataKey="cv" stroke="#C9A84C" strokeWidth={2.5} dot={{ r: 5, fill: '#C9A84C' }} name="CV">
                  <LabelList dataKey="cv" content={<CustomDotLabel />} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Courbe en cloche */}
      {bellCurveData.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Loi normale */}
            <div style={{ cursor: 'pointer' }} onClick={() => setExpandedChart(expandedChart === 'bell' ? null : 'bell')}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                Distribution — Loi normale
                <InfoBulle text="Représentation de la distribution des valeurs selon une loi normale. La zone verte (entre LCL et UCL) représente 95% des valeurs attendues."/>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#C9A84C' }}>{expandedChart === 'bell' ? '▲' : '▼'}</span>
              </div>
              <div style={{ fontSize: 10, color: '#5A5A5A', marginBottom: 8 }}>
                Moy: <strong>{stats.moy}{selectedKpi?.isAbsolute?'':'%'}</strong> · UCL: <strong style={{ color: '#E05C5C' }}>{stats.ucl}{selectedKpi?.isAbsolute?'':'%'}</strong> · LCL: <strong style={{ color: '#4CAF7D' }}>{stats.lcl}{selectedKpi?.isAbsolute?'':'%'}</strong>
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
                  <XAxis dataKey="x" tick={{ fontSize: 9 }} tickFormatter={v => `${v}${selectedKpi?.isAbsolute?'':'%'}`} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v.toFixed(3)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${p.payload.x}${selectedKpi?.isAbsolute?'':'%'}`, 'Valeur']} labelFormatter={() => ''} />
                  {stats.ucl > 0 && <ReferenceLine x={stats.ucl} stroke="#E05C5C" strokeDasharray="4 4" label={{ value: 'UCL', fill: '#E05C5C', fontSize: 10 }} />}
                  {stats.lcl > 0 && <ReferenceLine x={stats.lcl} stroke="#4CAF7D" strokeDasharray="4 4" label={{ value: 'LCL', fill: '#4CAF7D', fontSize: 10 }} />}
                  {stats.moy > 0 && <ReferenceLine x={stats.moy} stroke="#C9A84C" strokeWidth={2} label={{ value: `μ`, fill: '#C9A84C', fontSize: 10 }} />}
                  <Area type="monotone" dataKey="y" stroke={selectedKpi.color} strokeWidth={2.5} fill="url(#bellGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Courbe evolution CV */}
            {chartData.length > 0 && (
              <div style={{ cursor: 'pointer' }} onClick={() => setExpandedChart(expandedChart === 'cv' ? null : 'cv')}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                  Évolution du CV
                  <InfoBulle text="Évolution du coefficient de variation mois par mois. Si la courbe descend → le processus se stabilise ✅. Lignes de référence : 15% (maîtrisé) et 30% (variable)."/>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#C9A84C' }}>{expandedChart === 'cv' ? '▲' : '▼'}</span>
                </div>
                <div style={{ fontSize: 10, color: '#5A5A5A', marginBottom: 8 }}>CV Global: <strong style={{ color: cvGlobal < 15 ? '#1a6b3c' : cvGlobal < 30 ? '#C9A84C' : '#E07B30' }}>{cvGlobal}%</strong></div>
                <div style={{ fontSize: 11, color: maitrise.color, marginBottom: 8, fontWeight: 500 }}>{maitrise.dot} {maitrise.label}</div>
                <ResponsiveContainer width="100%" height={expandedChart === 'cv' ? 300 : 180}>
                  <LineChart data={chartData.map((d,i) => ({ ...d, cvCumul: cvData[i]?.cv || 0 }))} margin={{ top: 10, right: 40, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }}/>
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`}/>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${v}%`, name]}/>
                    <ReferenceLine y={15} stroke="#4CAF7D" strokeDasharray="4 4" label={{ value: '15%', fill: '#4CAF7D', fontSize: 9, position: 'right' }}/>
                    <ReferenceLine y={30} stroke="#E07B30" strokeDasharray="4 4" label={{ value: '30%', fill: '#E07B30', fontSize: 9, position: 'right' }}/>
                    {segment === 'flux' ? (
                      <>
                        <Line type="monotone" dataKey="cv_intercomm" stroke={selectedKpi?.color || '#C9A84C'} strokeWidth={2.5}
                          dot={{ r: 4, fill: selectedKpi?.color || '#C9A84C', stroke: '#fff', strokeWidth: 2 }} name="CV inter-commerciaux"/>
                        <Line type="monotone" dataKey="moy" stroke="#8A8A7A" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3 }} name="Moyenne"/>
                      </>
                    ) : (
                      <Line type="monotone" dataKey="cvCumul" stroke={selectedKpi?.color || '#C9A84C'} strokeWidth={2.5}
                        dot={{ r: 4, fill: selectedKpi?.color || '#C9A84C', stroke: '#fff', strokeWidth: 2 }} name="CV"/>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, marginTop: 24 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>Tableau détaillé</div>
        <InfoBulle text={segment === 'flux' ? "Moy. = moyenne du KPI par commercial ce mois. CV inter-commerciaux = dispersion entre les commerciaux. Plus le CV est élevé, plus les performances sont hétérogènes." : "Valeur du KPI par période avec le CV cumulé (calculé sur toutes les périodes jusqu'à celle-ci) et le statut de maîtrise correspondant."}/>
      </div>
      <div style={{ ...cardStyle, marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {segment === 'flux'
                ? ['Période', `Moy. ${selectedKpi.label}`, 'CV inter-commerciaux', 'Statut'].map(h => (
                    <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                  ))
                : ['Période', selectedKpi.label, 'CV cumulé', 'Statut'].map(h => (
                    <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                  ))
              }
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => {
              const cvVal = segment === 'flux' ? (row.cv_intercomm || 0) : (cvData.find(c => c.label === row.label)?.cv || 0)
              const statut = cvVal === 0 ? { label: '—', color: '#8A8A7A' } :
                cvVal < 15 ? { label: '✅ Maîtrisé', color: '#1a6b3c' } :
                cvVal < 30 ? { label: '🟡 Modéré', color: '#C9A84C' } :
                cvVal < 50 ? { label: '🟠 Variable', color: '#E07B30' } :
                { label: '🔴 Hors contrôle', color: '#E05C5C' }
              const horsLimite = !selectedKpi?.isAbsolute && (row.taux > stats.ucl || (stats.lcl > 0 && row.taux < stats.lcl))
              const displayVal = segment === 'flux' ? row.moy : row.taux
              const displayUnit = selectedKpi?.isAbsolute ? '' : '%'
              return (
                <tr key={i} onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, color: '#C9A84C', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{row.label}</td>
                  <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, color: horsLimite ? '#E05C5C' : selectedKpi.color, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                    {displayVal}{displayUnit} {horsLimite && <span style={{ fontSize: 10, marginLeft: 4 }}>⚠️ hors limites</span>}
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: 12, color: statut.color, fontWeight: 500, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{cvVal > 0 ? `${cvVal}%` : '—'}</td>
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

