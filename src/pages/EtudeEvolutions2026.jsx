import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'

// ── Constantes ────────────────────────────────────────────────────────────────
const MOIS = [
  { label: 'Jan', value: '2026-01' },
  { label: 'Fév', value: '2026-02' },
  { label: 'Mar', value: '2026-03' },
  { label: 'Avr', value: '2026-04' },
  { label: 'Mai', value: '2026-05' },
  { label: 'Juin', value: '2026-06' },
]
const MOIS_JOUR = ['2026-04', '2026-05', '2026-06']

// ── Données ventes passagers (fichier Excel statique) ─────────────────────────
const VENTES_PASSAGERS = {
  "2026-01": { total: 39, parCommercial: { "NAOUFEL": 10, "SALIMA": 6, "HAJAR": 4, "ISMAIL": 3, "SAAD": 3, "YOUSSEF": 2, "NISSRINE": 2, "RIM": 2, "SOUAD": 2, "MERYEM": 2, "ASMAE": 1, "YASSMINE": 1, "OUMAIMA": 1 } },
  "2026-02": { total: 21, parCommercial: { "ASMAE": 3, "SOUAD": 3, "ISMAIL": 2, "MERYEM": 2, "ALAA": 2, "NISSRINE": 2, "SAMIYA": 1, "HICHAM": 1, "MEROUANE": 1, "KHALID": 1, "NOUHAILA": 1, "YASSMINE": 1, "SAAD": 1 } },
  "2026-03": { total: 38, parCommercial: { "MEROUANE": 5, "KHALID": 5, "YASSMINE": 3, "ALAA": 3, "SAMIYA": 3, "NAJLAA": 3, "HAJAR": 2, "SAAD": 2, "RIM": 2, "ALAE": 2, "NAOUFEL": 2, "ISMAIL": 2, "SOUAD": 1, "YOUSSEF": 1, "ASMAE": 1, "NISSRINE": 1 } },
  "2026-04": { total: 64, parCommercial: { "KHALID": 11, "NISSRINE": 9, "SAAD": 8, "NOUHAILA": 8, "ABDELHAK": 6, "NAJLAA": 4, "ISMAIL": 2, "MERYEM": 2, "YASSMINE": 2, "RIM": 2, "SALIMA": 2, "SAMIYA": 2, "YOUSSEF": 2, "OUMAIMA": 1, "HAJAR": 1, "SOUAD": 1, "NAOUFEL": 1 } },
  "2026-05": { total: 52, parCommercial: { "YOUSSEF": 11, "SAAD": 9, "NAOUFEL": 6, "KHALID": 5, "NOUHAILA": 4, "ISMAIL": 2, "NISSRINE": 2, "OUMAIMA": 2, "YASSMINE": 2, "MERYEM": 2, "MEROUANE": 1, "ABDELHAK": 1, "HICHAM": 1, "HAJAR": 1, "SOUAD": 1, "SALIMA": 1, "NAJLAA": 1 } },
}

// Mapping nom fichier Excel → nom complet dans l'app
const NOM_MAP_COMPLET = {
  "NAOUFEL": "Nawfal Jdia",
  "NAWFEL": "Nawfal Jdia",
  "YOUSSEF": "Youssef Saadouni",
  "NISSRINE": "Nissrine Irfden",
  "OUMAIMA": "Oumaima Belbacha",
  "YASSMINE": "Yasmina Souaq",
  "SOUAD": "Souad Acoine",
  "RIM": "Rim Snaiki",
  "SALIMA": "Salima Fikri",
  "ASMAE": "Asmaa Radouli",
  "ISMAIL": "Ismail Hammouch",
  "MERYEM": "Meryem Elbouchikhi",
  "HAJAR": "Hajar Snaiki",
  "SAMIYA": "Samia Ahalay",
  "HICHAM": "Hicham Mechach",
  "ALAA": "Alae Elmoussaid",
  "ALAE": "Alae Elmoussaid",
  "MEROUANE": "Marouane Cachchi",
  "KHALID": "Khalid Amghoud",
  "SAAD": "Saad Fellah",
  "NOUHAILA": "Nouhaila Belhadj",
  "ABDELHAK": "Abdelhak Lakouissmi",
  "NAJLAA": "Najlaa Maarouf",
}

// Commerciaux avec date d'arrivée > Jan
const ARRIVEE_MARS = ["Abdelhak Lakouissmi", "Najlaa Maarouf"]
// Alae quitte fin avril
const ALAE_DEPART = "2026-05"
// Salima quitte fin mai
const SALIMA_DEPART = "2026-06"
// Hicham — inclure tous les mois (pas d'info départ)
// Yasmina Souaq : Kénitra en Jan, Salé à partir Fév
const YASMINA_SALE_FROM = "2026-02"
// Saad Fellah : Kénitra en Jan, Salé à partir Fév
const SAAD_SALE_FROM = "2026-02"

// Commerciaux actifs par mois (selon dates arrivée/départ)
function isActifCeMois(nomComplet, moisVal) {
  if (ARRIVEE_MARS.includes(nomComplet) && moisVal < "2026-03") return false
  if (nomComplet === "Alae Elmoussaid" && moisVal >= ALAE_DEPART) return false
  if (nomComplet === "Salima Fikri" && moisVal >= SALIMA_DEPART) return false
  return true
}

// Equipe du commercial pour un mois donné
function equipeCeMois(nomComplet, moisVal, equipeDefaut) {
  if (nomComplet === "Yasmina Souaq" && moisVal < YASMINA_SALE_FROM) return "kenitra"
  if (nomComplet === "Saad Fellah" && moisVal < SAAD_SALE_FROM) return "kenitra"
  return equipeDefaut
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(a, b) {
  if (!b || b === 0) return null
  return parseFloat(((a / b) * 100).toFixed(1))
}

function calcCV(vals) {
  const v = vals.filter(x => x !== null && x !== undefined && !isNaN(x) && x >= 0)
  if (v.length < 2) return null
  const moy = v.reduce((a, b) => a + b, 0) / v.length
  if (moy === 0) return null
  const variance = v.reduce((s, x) => s + Math.pow(x - moy, 2), 0) / v.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

function cvColor(cv) {
  if (cv === null || cv === undefined) return '#8A8A7A'
  if (cv <= 20) return '#4CAF7D'
  if (cv <= 35) return '#C9A84C'
  return '#E05C5C'
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#2C2C2C' }}>{label}</div>
      {payload.map((p, i) => {
        const isAbs = p.unit === '' || (!String(p.name).includes('%') && p.dataKey && !p.dataKey.includes('CV') && typeof p.value === 'number' && p.value > 100)
        const unit = p.name?.toString().startsWith('Nb ') ? '' : '%'
        return (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>
            {p.name} : <strong>{p.value !== null && p.value !== undefined ? `${p.value}${p.name?.toString().startsWith('Nb ') ? '' : '%'}` : '—'}</strong>
          </div>
        )
      })}
    </div>
  )
}

// ── Badge CV ──────────────────────────────────────────────────────────────────
function CvBadge({ cv, label }) {
  if (cv === null || cv === undefined) return null
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F8F7F4', border: `1px solid ${cvColor(cv)}`, borderRadius: 20, padding: '4px 12px', fontSize: 12 }}>
      <span style={{ color: '#5A5A5A' }}>{label}</span>
      <span style={{ fontWeight: 700, color: cvColor(cv) }}>{cv}%</span>
    </div>
  )
}

// ── Tick X cliquable ─────────────────────────────────────────────────────────
function ClickableTick({ x, y, payload, hiddenMois, toggleMois }) {
  const isHidden = hiddenMois[payload.value]
  return (
    <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} onClick={() => toggleMois(payload.value)}>
      <text
        x={0} y={0} dy={14} textAnchor="middle"
        fill={isHidden ? '#C8C5BC' : '#5A5A5A'}
        fontSize={12}
        fontWeight={isHidden ? 400 : 500}
        textDecoration={isHidden ? 'line-through' : 'none'}
      >
        {payload.value}
      </text>
    </g>
  )
}

// ── Graphe avec toggle courbes + toggle mois ──────────────────────────────────
function TrendChart({ data, lines, absLines, title, subtitle, refLines, cvBadges }) {
  const [hidden, setHidden] = useState({})
  const [hiddenMois, setHiddenMois] = useState({})
  const toggleLine = (key) => setHidden(h => ({ ...h, [key]: !h[key] }))
  const toggleMois = (mois) => setHiddenMois(h => ({ ...h, [mois]: !h[mois] }))

  // Filtrer les données selon les mois cachés
  const filteredData = data.map(d =>
    hiddenMois[d.mois]
      ? { ...d, ...Object.fromEntries(lines.map(l => [l.key, null])) }
      : d
  )

  const allLines = [...lines, ...(absLines || [])]

  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cvBadges?.map((b, i) => <CvBadge key={i} cv={b.cv} label={b.label} />)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {allLines.map(l => (
          <button key={l.key} onClick={() => toggleLine(l.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 16, border: `1px solid ${hidden[l.key] ? '#E8E6DF' : l.color}`,
            background: hidden[l.key] ? '#F8F7F4' : `${l.color}18`,
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
            color: hidden[l.key] ? '#8A8A7A' : l.color, transition: 'all 0.15s'
          }}>
            <span style={{ width: 20, height: 2, background: hidden[l.key] ? '#C8C5BC' : l.color, borderStyle: l.abs ? 'dashed' : 'solid', display: 'inline-block', borderRadius: 1 }} />
            {l.name}
          </button>
        ))}
      </div>
      {Object.values(hiddenMois).some(v => v) && (
        <div style={{ fontSize: 11, color: '#8A8A7A', marginBottom: 8 }}>
          Cliquez sur un mois pour le réactiver
        </div>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={filteredData} margin={{ top: 5, right: 50, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE6" />
          <XAxis dataKey="mois" tick={<ClickableTick hiddenMois={hiddenMois} toggleMois={toggleMois} />} />
          <YAxis yAxisId="pct" tick={{ fontSize: 11, fill: '#8A8A7A' }} unit="%" domain={[0, 'auto']} />
          {absLines?.length > 0 && (
            <YAxis yAxisId="abs" orientation="right" tick={{ fontSize: 11, fill: '#C8C5BC' }} />
          )}
          <Tooltip content={<CustomTooltip />} />
          {refLines?.map((r, i) => (
            <ReferenceLine key={i} yAxisId="pct" y={r.value} stroke={r.color || '#E8D5A3'} strokeDasharray="4 4"
              label={{ value: `${r.value}%`, position: 'right', fontSize: 10, fill: r.color || '#C9A84C' }} />
          ))}
          {lines.map(l => !hidden[l.key] && (
            <Line key={l.key} yAxisId="pct" type="monotone" dataKey={l.key} name={l.name}
              stroke={l.color} strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props
                if (hiddenMois[payload.mois]) return null
                return <circle key={props.key} cx={cx} cy={cy} r={4} fill={l.color} stroke={l.color} />
              }}
              connectNulls={false} />
          ))}
          {(absLines || []).map(l => !hidden[l.key] && (
            <Line key={l.key} yAxisId="abs" type="monotone" dataKey={l.key} name={l.name}
              stroke={l.color} strokeWidth={1.5} strokeDasharray="5 3"
              dot={(props) => {
                const { cx, cy, payload } = props
                if (hiddenMois[payload.mois]) return null
                return <circle key={props.key} cx={cx} cy={cy} r={3} fill={l.color} stroke={l.color} />
              }}
              connectNulls={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Tableau CV mensuel compact ────────────────────────────────────────────────
function CvMensuelTable({ rows, moisList }) {
  return (
    <div style={{ background: '#F8F7F4', borderRadius: 10, padding: '14px 20px', marginTop: 4, marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5A5A', marginBottom: 8 }}>CV mensuel (variabilité jour/jour)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 12px', textAlign: 'left', color: '#8A8A7A', fontWeight: 500, fontSize: 11 }}>Indicateur</th>
            {moisList.map(m => <th key={m.value} style={{ padding: '4px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, fontSize: 11 }}>{m.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #EAE8E2' }}>
              <td style={{ padding: '6px 12px', color: r.color, fontWeight: 500 }}>{r.label}</td>
              {moisList.map(m => {
                const cv = r.vals[m.value]
                return (
                  <td key={m.value} style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, color: cvColor(cv) }}>
                    {cv !== null && cv !== undefined ? `${cv}%` : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#8A8A7A' }}>
        <span><span style={{ color: '#4CAF7D', fontWeight: 600 }}>■</span> ≤20% Régulier</span>
        <span><span style={{ color: '#C9A84C', fontWeight: 600 }}>■</span> 20–35% Modéré</span>
        <span><span style={{ color: '#E05C5C', fontWeight: 600 }}>■</span> &gt;35% Variable</span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EtudeEvolutions2026() {
  const navigate = useNavigate()
  const [segment, setSegment] = useState('marketing')
  const [cvSub, setCvSub] = useState('cc')
  const [venteSub, setVenteSub] = useState('global')
  const [ventesDetailSub, setVentesDetailSub] = useState('global')
  const [loading, setLoading] = useState(true)

  const [mktData, setMktData] = useState([])
  const [ccData, setCcData] = useState([])
  const [fluxData, setFluxData] = useState([])
  const [conseilleres, setConseilleres] = useState([])
  const [commerciaux, setCommerciaux] = useState([])
  const [joursExclus, setJoursExclus] = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: mkt }, { data: cc }, { data: flux },
      { data: cons }, { data: comms }, { data: cal }
    ] = await Promise.all([
      supabase.from('marketing_saisies').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('saisies').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('flux_rdv').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('conseilleres').select('id, nom').order('nom'),
      supabase.from('commerciaux').select('id, nom, equipe').order('nom'),
      supabase.from('calendrier').select('date, type'),
    ])
    setMktData(mkt || [])
    setCcData(cc || [])
    setFluxData(flux || [])
    setConseilleres(cons || [])
    setCommerciaux(comms || [])
    setJoursExclus((cal || []).filter(c => c.type === 'ferie' || c.type === 'conge').map(c => c.date))
    setLoading(false)
  }

  // ── MARKETING ────────────────────────────────────────────────────────────
  const mktParMois = useMemo(() => MOIS.map(m => {
    const rows = mktData.filter(r => (r.date_debut || r.date || '').startsWith(m.value))
    const inj = rows.reduce((s, r) => s + (r.injections || 0), 0)
    const ne = rows.reduce((s, r) => s + (r.non_exploitables || 0), 0)
    const ind = rows.reduce((s, r) => s + (r.indispos || 0), 0)
    const nbExpl = Math.round(inj - ne)
    const txExpl = pct(inj - ne, inj)
    const txJoign = pct(inj - ind, inj)
    const dayRows = rows.filter(r => r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut || r.date))
    const cvExpl = MOIS_JOUR.includes(m.value) ? calcCV(dayRows.map(r => pct((r.injections||0)-(r.non_exploitables||0), r.injections||0))) : null
    const cvJoign = MOIS_JOUR.includes(m.value) ? calcCV(dayRows.map(r => pct((r.injections||0)-(r.indispos||0), r.injections||0))) : null
    return { mois: m.label, moisVal: m.value, txExpl, txJoign, nbExpl, cvExpl, cvJoign, hasData: inj > 0 }
  }), [mktData, joursExclus])

  const mktChartData = mktParMois.filter(m => m.hasData).map(m => ({
    mois: m.label,
    'Exploitables': m.txExpl,
    'Nb Exploitables': m.nbExpl,
  }))
  const mktCVGlobal = {
    expl: calcCV(mktParMois.map(m => m.txExpl).filter(v => v !== null)),
    joign: calcCV(mktParMois.map(m => m.txJoign).filter(v => v !== null)),
  }

  // ── CC ───────────────────────────────────────────────────────────────────
  const ccParMois = useMemo(() => MOIS.map(m => {
    const rows = ccData.filter(r => (r.date_debut || r.date || '').startsWith(m.value))
    const echanges = rows.reduce((s, r) => s + (r.echanges || 0), 0)
    const rdv = rows.reduce((s, r) => s + (r.rdv || 0), 0)
    const vis = rows.reduce((s, r) => s + (r.visites || 0), 0)
    const nbRdv = Math.round(rdv)
    const nbVis = Math.round(vis)
    const txConv = pct(rdv, echanges)
    const txPres = pct(vis, rdv)
    const dayRows = rows.filter(r => r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut || r.date))
    const cvConv = MOIS_JOUR.includes(m.value) ? calcCV(dayRows.map(r => pct(r.rdv||0, r.echanges||0))) : null
    const cvPres = MOIS_JOUR.includes(m.value) ? calcCV(dayRows.map(r => pct(r.visites||0, r.rdv||0))) : null
    return { mois: m.label, moisVal: m.value, txConv, txPres, nbRdv, nbVis, cvConv, cvPres, hasData: echanges > 0 }
  }), [ccData, joursExclus])

  const ccChartData = ccParMois.filter(m => m.hasData).map(m => ({
    mois: m.label,
    'Conv. Tél.': m.txConv,
    'Taux Présence': m.txPres,
    'Nb RDV': m.nbRdv,
    'Nb Visites': m.nbVis,
  }))
  const ccCVGlobal = {
    conv: calcCV(ccParMois.map(m => m.txConv).filter(v => v !== null)),
    pres: calcCV(ccParMois.map(m => m.txPres).filter(v => v !== null)),
  }

  // ── VENTES DETAIL : CC vs Passagers ─────────────────────────────────────────
  const ventesDetailParMois = useMemo(() => {
    const moisDetail = ['2026-01','2026-02','2026-03','2026-04','2026-05']
    return moisDetail.map(mVal => {
      const m = MOIS.find(x => x.value === mVal)
      // Ventes CC depuis flux_rdv
      const ccRows = fluxData.filter(r => (r.date_debut||'').startsWith(mVal))
      const ventesCC = Math.round(ccRows.reduce((s,r) => s+(r.ventes||0), 0))
      const ventesCCSale = Math.round(ccRows.filter(r => commerciaux.find(c=>c.id===r.commercial_id)?.equipe === 'sale' || (r.commercial_id && equipeCeMois(commerciaux.find(c=>c.id===r.commercial_id)?.nom||'', mVal, commerciaux.find(c=>c.id===r.commercial_id)?.equipe||'') === 'sale')).reduce((s,r)=>s+(r.ventes||0),0))
      const ventesCCKenitra = Math.round(ccRows.filter(r => equipeCeMois(commerciaux.find(c=>c.id===r.commercial_id)?.nom||'', mVal, commerciaux.find(c=>c.id===r.commercial_id)?.equipe||'') === 'kenitra').reduce((s,r)=>s+(r.ventes||0),0))
      const totalExcel = VENTES_PASSAGERS[mVal]?.total || 0
      // Total par équipe depuis Excel
      const totalSaleExcel = Object.entries(VENTES_PASSAGERS[mVal]?.parCommercial || {}).filter(([n]) => {
        const nom = NOM_MAP_COMPLET[n]||''
        return equipeCeMois(nom, mVal, commerciaux.find(c=>c.nom===nom)?.equipe||'kenitra') === 'sale'
      }).reduce((s,[,v])=>s+v,0)
      const totalKenitraExcel = Object.entries(VENTES_PASSAGERS[mVal]?.parCommercial || {}).filter(([n]) => {
        const nom = NOM_MAP_COMPLET[n]||''
        return equipeCeMois(nom, mVal, commerciaux.find(c=>c.nom===nom)?.equipe||'kenitra') === 'kenitra'
      }).reduce((s,[,v])=>s+v,0)
      const ventesPassagers = Math.max(0, totalExcel - ventesCC)
      const ventesPassagersSale = Math.max(0, totalSaleExcel - ventesCCSale)
      const ventesPassagersKenitra = Math.max(0, totalKenitraExcel - ventesCCKenitra)

      // Noms dans le fichier Excel ce mois → noms complets dans l'app
      const nomsFichierComplets = Object.keys(VENTES_PASSAGERS[mVal]?.parCommercial || {})
        .map(n => NOM_MAP_COMPLET[n] || null).filter(Boolean)

      // Tous les commerciaux actifs ce mois (hors Non reconnu)
      const commsActifsCeMois = commerciaux.filter(c => {
        if ((c.nom||'').toLowerCase().includes('non reconnu')) return false
        return isActifCeMois(c.nom, mVal)
      })

      // Séparation par équipe selon le mois
      const commsSale = commsActifsCeMois.filter(c => equipeCeMois(c.nom, mVal, c.equipe) === 'sale')
      const commsKenitra = commsActifsCeMois.filter(c => equipeCeMois(c.nom, mVal, c.equipe) === 'kenitra')

      const zeroSale = commsSale.filter(c => !nomsFichierComplets.includes(c.nom))
      const zeroKenitra = commsKenitra.filter(c => !nomsFichierComplets.includes(c.nom))

      return { moisVal: mVal, mois: m.label, totalExcel, totalSaleExcel, totalKenitraExcel, ventesCC, ventesCCSale, ventesCCKenitra, ventesPassagers, ventesPassagersSale, ventesPassagersKenitra, zeroSale, zeroKenitra }
    })
  }, [fluxData, commerciaux])

  // ── VENTE ────────────────────────────────────────────────────────────────
  const venteParMois = useMemo(() => MOIS.map(m => {
    const allRows = fluxData.filter(r => (r.date_debut || '').startsWith(m.value))
    const saleRows = allRows.filter(r => commerciaux.find(c => c.id === r.commercial_id)?.equipe === 'sale')
    const kenRows = allRows.filter(r => commerciaux.find(c => c.id === r.commercial_id)?.equipe === 'kenitra')

    const build = (rows) => {
      const vis = rows.reduce((s, r) => s + (r.visites||0) + (r.ventes||0), 0)
      const ven = rows.reduce((s, r) => s + (r.ventes||0), 0)
      const dayRows = rows.filter(r => r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut))
      // CV jour/jour uniquement pour MOIS_JOUR
      const cvJour = MOIS_JOUR.includes(m.value)
        ? calcCV(dayRows.filter(r => (r.visites||0)+(r.ventes||0) > 0).map(r => pct(r.ventes||0, (r.visites||0)+(r.ventes||0))))
        : null
      return { txVente: pct(ven, vis), cvJour, hasData: vis > 0 }
    }

    return { mois: m.label, moisVal: m.value, global: build(allRows), sale: build(saleRows), kenitra: build(kenRows) }
  }), [fluxData, commerciaux, joursExclus])

  const venteChartData = (sub) => venteParMois.filter(m => m[sub]?.hasData).map(m => ({
    mois: m.label,
    'Taux de vente': m[sub]?.txVente,
    'Nb Ventes': m[sub]?.nbVentes,
  }))
  const venteCVGlobal = {
    global: calcCV(venteParMois.map(m => m.global.txVente).filter(v => v !== null)),
    sale: calcCV(venteParMois.map(m => m.sale.txVente).filter(v => v !== null)),
    kenitra: calcCV(venteParMois.map(m => m.kenitra.txVente).filter(v => v !== null)),
  }

  // ── CV MENSUEL (σ/μ des moyennes mensuelles) ── tous les 6 mois ───────────
  const cvMensuelCC = useMemo(() => {
    return MOIS.map(m => {
      // Pour chaque conseillère : taux moyen du mois (toutes saisies confondues)
      const moyConv = conseilleres.map(c => {
        const rows = ccData.filter(r => r.conseillere_id === c.id && (r.date_debut||r.date||'').startsWith(m.value))
        const ech = rows.reduce((s,r) => s+(r.echanges||0), 0)
        const rdv = rows.reduce((s,r) => s+(r.rdv||0), 0)
        return pct(rdv, ech)
      }).filter(v => v !== null)
      const moyPres = conseilleres.map(c => {
        const rows = ccData.filter(r => r.conseillere_id === c.id && (r.date_debut||r.date||'').startsWith(m.value))
        const vis = rows.reduce((s,r) => s+(r.visites||0), 0)
        const rdv = rows.reduce((s,r) => s+(r.rdv||0), 0)
        return pct(vis, rdv)
      }).filter(v => v !== null)
      // CV = σ/μ des moyennes par conseillère
      return { mois: m.label, 'CV Conv. Tél.': calcCV(moyConv), 'CV Taux Présence': calcCV(moyPres) }
    })
  }, [conseilleres, ccData])

  const cvMensuelVente = useMemo(() => {
    const build = (comms) => MOIS.map(m => {
      // Pour chaque commercial : taux de vente agrégé du mois
      const moys = comms.map(c => {
        const rows = fluxData.filter(r => r.commercial_id === c.id && (r.date_debut||'').startsWith(m.value))
        const vis = rows.reduce((s,r) => s+(r.visites||0)+(r.ventes||0), 0)
        const ven = rows.reduce((s,r) => s+(r.ventes||0), 0)
        return pct(ven, vis)
      }).filter(v => v !== null)
      // CV = σ/μ des taux par commercial
      return { mois: m.label, cv: calcCV(moys) }
    })
    const sale = commerciaux.filter(c => c.equipe === 'sale')
    const ken = commerciaux.filter(c => c.equipe === 'kenitra')
    return {
      sale: build(sale).map(d => ({ mois: d.mois, 'CV Vente Salé': d.cv })),
      kenitra: build(ken).map(d => ({ mois: d.mois, 'CV Vente Kénitra': d.cv })),
    }
  }, [commerciaux, fluxData, joursExclus])

  // ── CV JOUR/JOUR (points = CV mensuel jour/jour, 0 si pas de données) ──────
  const cvJourCC = useMemo(() => {
    return MOIS_JOUR.map(mVal => {
      const m = MOIS.find(x => x.value === mVal)
      const dayRows = ccData.filter(r => (r.date_debut||r.date||'').startsWith(mVal) && r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut||r.date))
      const cvConv = calcCV(dayRows.map(r => pct(r.rdv||0, r.echanges||0)))
      const cvPres = calcCV(dayRows.map(r => pct(r.visites||0, r.rdv||0)))
      return { mois: m.label, 'CV Conv. Tél.': cvConv ?? 0, 'CV Taux Présence': cvPres ?? 0 }
    })
  }, [ccData, joursExclus])

  const cvJourVente = useMemo(() => {
    const buildJour = (comms) => MOIS_JOUR.map(mVal => {
      const m = MOIS.find(x => x.value === mVal)
      const rows = fluxData.filter(r =>
        (r.date_debut||'').startsWith(mVal) &&
        r.type_saisie !== 'periode' &&
        !joursExclus.includes(r.date_debut) &&
        comms.some(c => c.id === r.commercial_id)
      )
      const cv = calcCV(rows.filter(r => (r.visites||0)+(r.ventes||0) > 0).map(r => pct(r.ventes||0, (r.visites||0)+(r.ventes||0))))
      return { mois: m.label, cv: cv ?? 0 }
    })
    const sale = commerciaux.filter(c => c.equipe === 'sale')
    const ken = commerciaux.filter(c => c.equipe === 'kenitra')
    return {
      sale: buildJour(sale).map(d => ({ mois: d.mois, 'CV Vente Salé': d.cv })),
      kenitra: buildJour(ken).map(d => ({ mois: d.mois, 'CV Vente Kénitra': d.cv })),
    }
  }, [commerciaux, fluxData, joursExclus])

  // ── Styles ────────────────────────────────────────────────────────────────
  const SEGMENTS = [
    { key: 'marketing', label: 'Marketing' },
    { key: 'cc', label: "Centre d'Appel" },
    { key: 'vente', label: 'Vente' },
    { key: 'ventes_detail', label: 'Ventes Détail' },
    { key: 'cv_mensuel', label: 'CV Mensuel' },
    { key: 'cv_jour', label: 'CV Mensuel/Jour' },
  ]
  const CV_SUBS = [
    { key: 'cc', label: 'CC' },
    { key: 'sale', label: 'Vente Salé' },
    { key: 'kenitra', label: 'Vente Kénitra' },
  ]
  const VENTE_SUBS = [
    { key: 'global', label: 'Global' },
    { key: 'sale', label: 'Salé' },
    { key: 'kenitra', label: 'Kénitra' },
  ]

  const segStyle = (active) => ({
    padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
    background: active ? '#C9A84C' : 'transparent',
    color: active ? '#fff' : '#5A5A5A', transition: 'all 0.15s',
  })
  const subStyle = (active) => ({
    padding: '6px 16px', borderRadius: 16,
    border: `1px solid ${active ? '#C9A84C' : '#E8E6DF'}`, cursor: 'pointer',
    fontSize: 12, fontWeight: 500, background: active ? '#FBF5E6' : '#fff',
    color: active ? '#C9A84C' : '#5A5A5A', transition: 'all 0.15s',
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #E8D5A3', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#8A8A7A', fontSize: 13 }}>Chargement de l'étude...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  // Données CV mensuel vente selon le sous-onglet
  const venteCvMensuelData = {
    sale: cvMensuelVente.sale,
    kenitra: cvMensuelVente.kenitra,
  }
  const venteCvJourData = {
    sale: cvJourVente.sale,
    kenitra: cvJourVente.kenitra,
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => navigate('/etudes')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C9A84C', fontSize: 13, fontWeight: 500, padding: 0 }}>
          ← Études
        </button>
      </div>
      <PageHeader title="Étude d'Évolutions — Juin 2026" subtitle="Tendances Jan → Juin 2026 · Marketing · CC · Vente · Analyse CV" />

      {/* Segments */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#F8F7F4', borderRadius: 24, padding: '4px', width: 'fit-content', flexWrap: 'wrap' }}>
        {SEGMENTS.map(s => <button key={s.key} style={segStyle(segment === s.key)} onClick={() => setSegment(s.key)}>{s.label}</button>)}
      </div>

      {/* ── MARKETING ── */}
      {segment === 'marketing' && (
        <>
          <TrendChart
            data={mktChartData}
            title="Qualité des leads — Évolution mensuelle"
            subtitle="Exploitables = (Injections − Non exploit.) / Injections · Joignabilité = (Injections − Indispos) / Injections"
            refLines={[{ value: 80, color: '#E8D5A3' }]}
            cvBadges={[
              { label: 'CV Exploitables', cv: mktCVGlobal.expl },
            ]}
            lines={[
              { key: 'Exploitables', name: 'Exploitables', color: '#4CAF7D' },
            ]}
            absLines={[
              { key: 'Nb Exploitables', name: 'Nb Exploitables', color: '#A8D5BE' },
            ]}
          />
          <CvMensuelTable
            moisList={MOIS.filter(m => MOIS_JOUR.includes(m.value))}
            rows={[
              { label: 'CV Exploitables', color: '#4CAF7D', vals: Object.fromEntries(mktParMois.map(m => [m.moisVal, m.cvExpl])) },

            ]}
          />
        </>
      )}

      {/* ── CC ── */}
      {segment === 'cc' && (
        <>
          <TrendChart
            data={ccChartData}
            title="Conversion téléphonique & Taux de présence — Évolution mensuelle"
            subtitle="Conv. Tél. = RDV / Échanges · Taux Présence = Visites / RDV"
            refLines={[
              { value: 35, color: '#E05C5C' },
              { value: 25, color: '#C9A84C' },
              { value: 15, color: '#E05C5C' },
            ]}
            cvBadges={[
              { label: 'CV Conv. Tél.', cv: ccCVGlobal.conv },
              { label: 'CV Présence', cv: ccCVGlobal.pres },
            ]}
            lines={[
              { key: 'Conv. Tél.', name: 'Conv. Tél.', color: '#5B6FC4' },
              { key: 'Taux Présence', name: 'Taux Présence', color: '#4CAF7D' },
            ]}
            absLines={[
              { key: 'Nb RDV', name: 'Nb RDV', color: '#A0A8D8' },
              { key: 'Nb Visites', name: 'Nb Visites', color: '#A8D5BE' },
            ]}
          />
          <CvMensuelTable
            moisList={MOIS.filter(m => MOIS_JOUR.includes(m.value))}
            rows={[
              { label: 'CV Conv. Tél.', color: '#5B6FC4', vals: Object.fromEntries(ccParMois.map(m => [m.moisVal, m.cvConv])) },
              { label: 'CV Taux Présence', color: '#4CAF7D', vals: Object.fromEntries(ccParMois.map(m => [m.moisVal, m.cvPres])) },
            ]}
          />
        </>
      )}

      {/* ── VENTE ── */}
      {segment === 'vente' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {VENTE_SUBS.map(s => <button key={s.key} style={subStyle(venteSub === s.key)} onClick={() => setVenteSub(s.key)}>{s.label}</button>)}
          </div>
          <TrendChart
            data={venteChartData(venteSub)}
            title={`Taux de vente — ${VENTE_SUBS.find(s => s.key === venteSub)?.label}`}
            subtitle="Ventes / Visites (visites + ventes)"
            cvBadges={[{ label: 'CV Global', cv: venteCVGlobal[venteSub] }]}
            lines={[{ key: 'Taux de vente', name: 'Taux de vente', color: '#C9A84C' }]}
            absLines={[{ key: 'Nb Ventes', name: 'Nb Ventes', color: '#E8D5A3' }]}
          />
          <CvMensuelTable
            moisList={MOIS.filter(m => MOIS_JOUR.includes(m.value))}
            rows={[
              { label: 'CV Taux de vente', color: '#C9A84C', vals: Object.fromEntries(venteParMois.map(m => [m.moisVal, m[venteSub]?.cvJour])) },
            ]}
          />
        </>
      )}

      {/* ── VENTES DETAIL ── */}
      {segment === 'ventes_detail' && (() => {
        const ccKey = ventesDetailSub === 'global' ? 'ventesCC' : ventesDetailSub === 'sale' ? 'ventesCCSale' : 'ventesCCKenitra'
        const passKey = ventesDetailSub === 'global' ? 'ventesPassagers' : ventesDetailSub === 'sale' ? 'ventesPassagersSale' : 'ventesPassagersKenitra'
        const totalKey = ventesDetailSub === 'global' ? 'totalExcel' : ventesDetailSub === 'sale' ? 'totalSaleExcel' : 'totalKenitraExcel'
        const subLabel = ventesDetailSub === 'global' ? 'Global' : ventesDetailSub === 'sale' ? 'Salé' : 'Kénitra'
        return (
        <div>
          {/* Toggle Global/Salé/Kénitra */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[{k:'global',l:'Global'},{k:'sale',l:'Salé'},{k:'kenitra',l:'Kénitra'}].map(s => (
              <button key={s.k} onClick={() => setVentesDetailSub(s.k)} style={{
                padding: '6px 16px', borderRadius: 16, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                border: `1px solid ${ventesDetailSub===s.k ? '#C9A84C' : '#E8E6DF'}`,
                background: ventesDetailSub===s.k ? '#FBF5E6' : '#fff',
                color: ventesDetailSub===s.k ? '#C9A84C' : '#5A5A5A',
              }}>{s.l}</button>
            ))}
          </div>

          {/* Barres empilées */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C', marginBottom: 16 }}>Total ventes — {subLabel} — Jan → Mai 2026</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ventesDetailParMois} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE6" />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#8A8A7A' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} />
                <Tooltip formatter={(value, name) => [value, name === ccKey ? 'Ventes CC' : 'Passagers']} />
                <Bar dataKey={ccKey} name="Ventes CC" stackId="a" fill="#5B6FC4" radius={[0,0,0,0]} />
                <Bar dataKey={passKey} name="Passagers" stackId="a" fill="#C9A84C" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Donuts CC vs Passagers par mois */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C', marginBottom: 20 }}>Répartition CC vs Passagers — par mois</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-around' }}>
              {ventesDetailParMois.map(m => {
                const ccVal = m[ccKey] || 0
                const passVal = m[passKey] || 0
                const totalVal = m[totalKey] || 0
                const pieData = [
                  { name: 'CC', value: ccVal, color: '#5B6FC4' },
                  { name: 'Passagers', value: passVal, color: '#C9A84C' },
                ]
                const pctCC = totalVal > 0 ? Math.round((ccVal / totalVal) * 100) : 0
                return (
                  <div key={m.moisVal} style={{ textAlign: 'center', minWidth: 130 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>{m.mois}</div>
                    <div style={{ fontSize: 12, color: '#8A8A7A', marginBottom: 8 }}>{totalVal} ventes</div>
                    <PieChart width={130} height={130}>
                      <Pie data={pieData} cx={65} cy={55} innerRadius={35} outerRadius={55}
                        dataKey="value" startAngle={90} endAngle={-270}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                    </PieChart>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: '#5B6FC4', fontWeight: 600 }}>{pctCC}% CC</span>
                      <span style={{ color: '#8A8A7A', margin: '0 4px' }}>·</span>
                      <span style={{ color: '#C9A84C', fontWeight: 600 }}>{100-pctCC}% Pass.</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, fontSize: 11, marginTop: 4 }}>
                      <span style={{ color: '#5B6FC4' }}>CC: {ccVal}</span>
                      <span style={{ color: '#C9A84C' }}>Pass: {passVal}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Commerciaux à 0 vente par mois — séparé Sale / Kénitra */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C', marginBottom: 20 }}>Commerciaux à 0 vente — par mois</div>
            {ventesDetailParMois.map(m => (
              <div key={m.moisVal} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2C', marginBottom: 10, borderBottom: '1px solid #F0EDE6', paddingBottom: 6 }}>{m.mois}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Salé */}
                  <div style={{ background: '#F8F7F4', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#5B6FC4', marginBottom: 8 }}>
                      Équipe Salé
                      <span style={{ color: '#8A8A7A', fontWeight: 400, marginLeft: 6 }}>({m.zeroSale.length} à 0)</span>
                    </div>
                    {m.zeroSale.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#4CAF7D' }}>✓ Tous ont vendu</div>
                    ) : m.zeroSale.map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: '#2C2C2C' }}>{c.nom?.split(' ')[0]}</span>
                        <span style={{ color: '#E05C5C', fontWeight: 600, background: '#FEF0F0', padding: '1px 8px', borderRadius: 8 }}>0</span>
                      </div>
                    ))}
                  </div>
                  {/* Kénitra */}
                  <div style={{ background: '#F8F7F4', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#C9A84C', marginBottom: 8 }}>
                      Équipe Kénitra
                      <span style={{ color: '#8A8A7A', fontWeight: 400, marginLeft: 6 }}>({m.zeroKenitra.length} à 0)</span>
                    </div>
                    {m.zeroKenitra.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#4CAF7D' }}>✓ Tous ont vendu</div>
                    ) : m.zeroKenitra.map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: '#2C2C2C' }}>{c.nom?.split(' ')[0]}</span>
                        <span style={{ color: '#E05C5C', fontWeight: 600, background: '#FEF0F0', padding: '1px 8px', borderRadius: 8 }}>0</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )
      })()}

      {/* ── CV MENSUEL ── */}
      {segment === 'cv_mensuel' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {CV_SUBS.map(s => <button key={s.key} style={subStyle(cvSub === s.key)} onClick={() => setCvSub(s.key)}>{s.label}</button>)}
          </div>
          {cvSub === 'cc' && (
            <TrendChart
              data={cvMensuelCC}
              title="CV Mensuel — Centre d'Appel (Jan → Juin)"
              subtitle="CV = σ/μ des moyennes mensuelles par conseillère · jours ouvrables uniquement"
              cvBadges={[
                { label: 'CV Conv.', cv: calcCV(cvMensuelCC.map(d => d['CV Conv. Tél.']).filter(v => v !== null)) },
                { label: 'CV Présence', cv: calcCV(cvMensuelCC.map(d => d['CV Taux Présence']).filter(v => v !== null)) },
              ]}
              lines={[
                { key: 'CV Conv. Tél.', name: 'CV Conv. Tél.', color: '#5B6FC4' },
                { key: 'CV Taux Présence', name: 'CV Taux Présence', color: '#4CAF7D' },
              ]}
            />
          )}
          {cvSub === 'sale' && (
            <TrendChart
              data={venteCvMensuelData.sale}
              title="CV Mensuel — Vente Salé (Jan → Juin)"
              subtitle="CV = σ/μ des moyennes mensuelles par commercial Salé · jours ouvrables uniquement"
              cvBadges={[{ label: 'CV Global', cv: calcCV(venteCvMensuelData.sale.map(d => d['CV Vente Salé']).filter(v => v !== null)) }]}
              lines={[{ key: 'CV Vente Salé', name: 'CV Vente Salé', color: '#C9A84C' }]}
            />
          )}
          {cvSub === 'kenitra' && (
            <TrendChart
              data={venteCvMensuelData.kenitra}
              title="CV Mensuel — Vente Kénitra (Jan → Juin)"
              subtitle="CV = σ/μ des moyennes mensuelles par commercial Kénitra · jours ouvrables uniquement"
              cvBadges={[{ label: 'CV Global', cv: calcCV(venteCvMensuelData.kenitra.map(d => d['CV Vente Kénitra']).filter(v => v !== null)) }]}
              lines={[{ key: 'CV Vente Kénitra', name: 'CV Vente Kénitra', color: '#9B59B6' }]}
            />
          )}
        </>
      )}

      {/* ── CV JOUR/JOUR ── */}
      {segment === 'cv_jour' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {CV_SUBS.map(s => <button key={s.key} style={subStyle(cvSub === s.key)} onClick={() => setCvSub(s.key)}>{s.label}</button>)}
          </div>
          {cvSub === 'cc' && (
            <TrendChart
              data={cvJourCC}
              title="CV Mensuel/Jour — Centre d'Appel (Avr → Juin)"
              subtitle="CV = variabilité jour/jour au sein de chaque mois · 0 si aucune donnée"
              cvBadges={[
                { label: 'CV Conv.', cv: calcCV(cvJourCC.map(d => d['CV Conv. Tél.']).filter(v => v > 0)) },
                { label: 'CV Présence', cv: calcCV(cvJourCC.map(d => d['CV Taux Présence']).filter(v => v > 0)) },
              ]}
              lines={[
                { key: 'CV Conv. Tél.', name: 'CV Conv. Tél.', color: '#5B6FC4' },
                { key: 'CV Taux Présence', name: 'CV Taux Présence', color: '#4CAF7D' },
              ]}
            />
          )}
          {cvSub === 'sale' && (
            <TrendChart
              data={venteCvJourData.sale}
              title="CV Mensuel/Jour — Vente Salé (Avr → Juin)"
              subtitle="CV = variabilité jour/jour au sein de chaque mois · 0 si aucune donnée"
              cvBadges={[{ label: 'CV Global', cv: calcCV(venteCvJourData.sale.map(d => d['CV Vente Salé']).filter(v => v > 0)) }]}
              lines={[{ key: 'CV Vente Salé', name: 'CV Vente Salé', color: '#C9A84C' }]}
            />
          )}
          {cvSub === 'kenitra' && (
            <TrendChart
              data={venteCvJourData.kenitra}
              title="CV Mensuel/Jour — Vente Kénitra (Avr → Juin)"
              subtitle="CV = variabilité jour/jour au sein de chaque mois · 0 si aucune donnée"
              cvBadges={[{ label: 'CV Global', cv: calcCV(venteCvJourData.kenitra.map(d => d['CV Vente Kénitra']).filter(v => v > 0)) }]}
              lines={[{ key: 'CV Vente Kénitra', name: 'CV Vente Kénitra', color: '#9B59B6' }]}
            />
          )}
        </>
      )}
    </div>
  )
}