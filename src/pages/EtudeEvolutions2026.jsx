import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
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
const MOIS_JOUR = ['2026-04', '2026-05', '2026-06'] // mois avec saisies jour

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(a, b) {
  if (!b || b === 0) return null
  return parseFloat(((a / b) * 100).toFixed(1))
}

// CV = σ/μ sur un tableau de valeurs (filtre nulls et zéros)
function calcCV(vals) {
  const v = vals.filter(x => x !== null && x !== undefined && !isNaN(x) && x >= 0)
  if (v.length < 2) return null
  const moy = v.reduce((a, b) => a + b, 0) / v.length
  if (moy === 0) return null
  const variance = v.reduce((s, x) => s + Math.pow(x - moy, 2), 0) / v.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

// CV mensuel global = σ des moyennes mensuelles / μ des moyennes mensuelles
function calcCVMensuel(moyennesMois) {
  const vals = moyennesMois.filter(x => x !== null && !isNaN(x))
  return calcCV(vals)
}

function cvColor(cv) {
  if (cv === null || cv === undefined) return '#8A8A7A'
  if (cv <= 20) return '#4CAF7D'
  if (cv <= 35) return '#C9A84C'
  return '#E05C5C'
}

function lineColor(val, refs) {
  if (!refs || !val) return '#5B6FC4'
  const [low, high] = refs
  if (val <= low) return '#E05C5C'
  if (val <= high) return '#C9A84C'
  return '#4CAF7D'
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#2C2C2C' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name} : <strong>{p.value !== null && p.value !== undefined ? `${p.value}%` : '—'}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Badge CV ──────────────────────────────────────────────────────────────────
function CvBadge({ cv, label }) {
  if (cv === null || cv === undefined) return null
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F8F7F4', border: `1px solid ${cvColor(cv)}`, borderRadius: 20, padding: '4px 12px', fontSize: 12 }}>
      <span style={{ color: '#5A5A5A' }}>{label || 'CV global'}</span>
      <span style={{ fontWeight: 700, color: cvColor(cv) }}>{cv}%</span>
    </div>
  )
}

// ── Graphe avec toggle courbes ────────────────────────────────────────────────
function TrendChart({ data, lines, title, subtitle, refLines, cvBadges }) {
  const [hidden, setHidden] = useState({})

  const toggleLine = (key) => setHidden(h => ({ ...h, [key]: !h[key] }))

  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cvBadges?.map((b, i) => <CvBadge key={i} cv={b.cv} label={b.label} />)}
        </div>
      </div>

      {/* Toggle courbes */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {lines.map(l => (
          <button key={l.key} onClick={() => toggleLine(l.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 16, border: `1px solid ${hidden[l.key] ? '#E8E6DF' : l.color}`,
            background: hidden[l.key] ? '#F8F7F4' : `${l.color}15`,
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
            color: hidden[l.key] ? '#8A8A7A' : l.color, transition: 'all 0.15s'
          }}>
            <span style={{ width: 20, height: 2, background: hidden[l.key] ? '#C8C5BC' : l.color, display: 'inline-block', borderRadius: 1 }} />
            {l.name}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE6" />
          <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#8A8A7A' }} />
          <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} unit="%" domain={[0, 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          {refLines?.map((r, i) => (
            <ReferenceLine key={i} y={r.value} stroke={r.color || '#E8D5A3'} strokeDasharray="4 4"
              label={{ value: `${r.value}%`, position: 'right', fontSize: 10, fill: r.color || '#C9A84C' }} />
          ))}
          {lines.map(l => (
            !hidden[l.key] && (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                stroke={l.color} strokeWidth={2.5} dot={{ r: 4, fill: l.color }}
                connectNulls={false} />
            )
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EtudeEvolutions2026() {
  const navigate = useNavigate()
  const [segment, setSegment] = useState('marketing')
  const [cvSub, setCvSub] = useState('cc')
  const [venteSub, setVenteSub] = useState('global')
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
      { data: cons }, { data: comms }, { data: cal },
      { data: abs }
    ] = await Promise.all([
      supabase.from('marketing_saisies').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('saisies').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('flux_rdv').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('conseilleres').select('id, nom').order('nom'),
      supabase.from('commerciaux').select('id, nom, equipe').order('nom'),
      supabase.from('calendrier').select('date, type'),
      supabase.from('absences_conseilleres').select('conseillere_id, date_debut, date_fin'),
    ])
    setMktData(mkt || [])
    setCcData(cc || [])
    setFluxData(flux || [])
    setConseilleres(cons || [])
    setCommerciaux(comms || [])
    // Jours exclus = fériés + congés équipe
    const exclus = (cal || []).filter(c => c.type === 'ferie' || c.type === 'conge').map(c => c.date)
    setJoursExclus(exclus)
    setLoading(false)
  }

  // ── MARKETING : agréger par mois ──────────────────────────────────────────
  const mktParMois = useMemo(() => {
    return MOIS.map(m => {
      const rows = mktData.filter(r => (r.date_debut || r.date || '').startsWith(m.value))
      const hasJour = rows.some(r => r.type_saisie !== 'periode')
      const inj = rows.reduce((s, r) => s + (r.injections || 0), 0)
      const ne = rows.reduce((s, r) => s + (r.non_exploitables || 0), 0)
      const ind = rows.reduce((s, r) => s + (r.indispos || 0), 0)
      const txExpl = pct(inj - ne, inj)
      const txJoign = pct(inj - ind, inj)
      // CV jour/jour uniquement pour mois avec saisies jour
      const dayRows = rows.filter(r => r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut || r.date))
      const cvExpl = hasJour ? calcCV(dayRows.map(r => pct((r.injections || 0) - (r.non_exploitables || 0), r.injections || 0))) : null
      const cvJoign = hasJour ? calcCV(dayRows.map(r => pct((r.injections || 0) - (r.indispos || 0), r.injections || 0))) : null
      return { mois: m.label, moisVal: m.value, txExpl, txJoign, cvExpl, cvJoign, hasData: inj > 0, hasJour }
    })
  }, [mktData, joursExclus])

  const mktCVGlobal = useMemo(() => ({
    expl: calcCVMensuel(mktParMois.map(m => m.txExpl)),
    joign: calcCVMensuel(mktParMois.map(m => m.txJoign)),
  }), [mktParMois])

  const mktChartData = mktParMois.filter(m => m.hasData).map(m => ({
    mois: m.label, 'Exploitables': m.txExpl, 'Joignabilité': m.txJoign,
  }))

  // ── CC : agréger par mois ─────────────────────────────────────────────────
  const ccParMois = useMemo(() => {
    return MOIS.map(m => {
      const rows = ccData.filter(r => (r.date_debut || r.date || '').startsWith(m.value))
      const hasJour = rows.some(r => r.type_saisie !== 'periode')
      const echanges = rows.reduce((s, r) => s + (r.echanges || 0), 0)
      const rdv = rows.reduce((s, r) => s + (r.rdv || 0), 0)
      const vis = rows.reduce((s, r) => s + (r.visites || 0), 0)
      const txConv = pct(rdv, echanges)
      const txPres = pct(vis, rdv)
      const dayRows = rows.filter(r => r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut || r.date))
      const cvConv = hasJour ? calcCV(dayRows.map(r => pct(r.rdv || 0, r.echanges || 0))) : null
      const cvPres = hasJour ? calcCV(dayRows.map(r => pct(r.visites || 0, r.rdv || 0))) : null
      return { mois: m.label, moisVal: m.value, txConv, txPres, cvConv, cvPres, hasData: echanges > 0, hasJour }
    })
  }, [ccData, joursExclus])

  const ccCVGlobal = useMemo(() => ({
    conv: calcCVMensuel(ccParMois.map(m => m.txConv)),
    pres: calcCVMensuel(ccParMois.map(m => m.txPres)),
  }), [ccParMois])

  const ccChartData = ccParMois.filter(m => m.hasData).map(m => ({
    mois: m.label, 'Conv. Tél.': m.txConv, 'Taux Présence': m.txPres,
  }))

  // CV CC pour le segment CV (courbe mensuelle)
  const cvCCCourbe = useMemo(() => {
    return MOIS_JOUR.map(mVal => {
      const mLabel = MOIS.find(m => m.value === mVal)?.label
      // Pour chaque conseillère : taux moyen du mois
      const moyConv = conseilleres.map(c => {
        const rows = ccData.filter(r => r.conseillere_id === c.id && (r.date_debut || r.date || '').startsWith(mVal) && r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut || r.date))
        const vals = rows.map(r => pct(r.rdv || 0, r.echanges || 0)).filter(v => v !== null)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }).filter(v => v !== null)

      const moyPres = conseilleres.map(c => {
        const rows = ccData.filter(r => r.conseillere_id === c.id && (r.date_debut || r.date || '').startsWith(mVal) && r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut || r.date))
        const vals = rows.map(r => pct(r.visites || 0, r.rdv || 0)).filter(v => v !== null)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }).filter(v => v !== null)

      return {
        mois: mLabel,
        'CV Conv. Tél.': calcCV(moyConv),
        'CV Taux Présence': calcCV(moyPres),
      }
    })
  }, [conseilleres, ccData, joursExclus])

  // ── VENTE : agréger par mois ──────────────────────────────────────────────
  const venteParMois = useMemo(() => {
    return MOIS.map(m => {
      const buildData = (rows) => {
        const hasJour = rows.some(r => r.type_saisie !== 'periode')
        const vis = rows.reduce((s, r) => s + (r.visites || 0) + (r.ventes || 0), 0)
        const ven = rows.reduce((s, r) => s + (r.ventes || 0), 0)
        const txVente = pct(ven, vis)
        return { txVente, hasData: vis > 0, hasJour }
      }
      const allRows = fluxData.filter(r => (r.date_debut || '').startsWith(m.value))
      const saleRows = allRows.filter(r => {
        const comm = commerciaux.find(c => c.id === r.commercial_id)
        return comm?.equipe === 'sale'
      })
      const kenRows = allRows.filter(r => {
        const comm = commerciaux.find(c => c.id === r.commercial_id)
        return comm?.equipe === 'kenitra'
      })
      return {
        mois: m.label, moisVal: m.value,
        global: buildData(allRows),
        sale: buildData(saleRows),
        kenitra: buildData(kenRows),
      }
    })
  }, [fluxData, commerciaux])

  const venteCVGlobal = useMemo(() => ({
    global: calcCVMensuel(venteParMois.map(m => m.global.txVente)),
    sale: calcCVMensuel(venteParMois.map(m => m.sale.txVente)),
    kenitra: calcCVMensuel(venteParMois.map(m => m.kenitra.txVente)),
  }), [venteParMois])

  const venteChartData = (sub) => venteParMois.filter(m => m[sub]?.hasData).map(m => ({
    mois: m.label, 'Taux de vente': m[sub]?.txVente,
  }))

  // CV Vente pour le segment CV (courbe mensuelle)
  const cvVenteCourbe = useMemo(() => {
    const buildCourbe = (comms) => MOIS_JOUR.map(mVal => {
      const mLabel = MOIS.find(m => m.value === mVal)?.label
      const moyVente = comms.map(c => {
        const rows = fluxData.filter(r => r.commercial_id === c.id && (r.date_debut || '').startsWith(mVal) && r.type_saisie !== 'periode' && !joursExclus.includes(r.date_debut))
        const vals = rows.map(r => {
          const v = (r.visites || 0) + (r.ventes || 0)
          return pct(r.ventes || 0, v)
        }).filter(v => v !== null)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }).filter(v => v !== null)
      return { mois: mLabel, cv: calcCV(moyVente) }
    })

    const sale = commerciaux.filter(c => c.equipe === 'sale')
    const ken = commerciaux.filter(c => c.equipe === 'kenitra')
    return {
      sale: buildCourbe(sale).map(d => ({ mois: d.mois, 'CV Vente Salé': d.cv })),
      kenitra: buildCourbe(ken).map(d => ({ mois: d.mois, 'CV Vente Kénitra': d.cv })),
    }
  }, [commerciaux, fluxData, joursExclus])

  // ── Styles ────────────────────────────────────────────────────────────────
  const SEGMENTS = [
    { key: 'marketing', label: 'Marketing' },
    { key: 'cc', label: "Centre d'Appel" },
    { key: 'vente', label: 'Vente' },
    { key: 'cv', label: 'CV' },
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
    fontSize: 13, fontWeight: 500, background: active ? '#C9A84C' : 'transparent',
    color: active ? '#fff' : '#5A5A5A', transition: 'all 0.15s',
  })
  const subStyle = (active) => ({
    padding: '6px 16px', borderRadius: 16,
    border: `1px solid ${active ? '#C9A84C' : '#E8E6DF'}`, cursor: 'pointer',
    fontSize: 12, fontWeight: 500, background: active ? '#FBF5E6' : '#fff',
    color: active ? '#C9A84C' : '#5A5A5A', transition: 'all 0.15s',
  })

  // ── CV mensuel : tableau compact sous chaque section ─────────────────────
  function CvMensuelRow({ label, color, data, moisKey, moisJourOnly }) {
    const moisList = moisJourOnly ? MOIS.filter(m => MOIS_JOUR.includes(m.value)) : MOIS
    return (
      <tr style={{ borderBottom: '1px solid #F0EDE6' }}>
        <td style={{ padding: '6px 12px', color, fontWeight: 500, fontSize: 12 }}>{label}</td>
        {moisList.map(m => {
          const d = data.find(x => x.moisVal === m.value)
          const cv = d?.[moisKey]
          return (
            <td key={m.value} style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: cvColor(cv) }}>
              {cv !== null && cv !== undefined ? `${cv}%` : '—'}
            </td>
          )
        })}
      </tr>
    )
  }

  function CvMensuelTable({ rows, moisJourOnly }) {
    const moisList = moisJourOnly ? MOIS.filter(m => MOIS_JOUR.includes(m.value)) : MOIS
    return (
      <div style={{ background: '#F8F7F4', borderRadius: 10, padding: '14px 20px', marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#5A5A5A', marginBottom: 8 }}>CV mensuel (variabilité jour/jour)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 12px', textAlign: 'left', color: '#8A8A7A', fontWeight: 500, fontSize: 11 }}>Indicateur</th>
              {moisList.map(m => <th key={m.value} style={{ padding: '4px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, fontSize: 11 }}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => <CvMensuelRow key={i} {...r} moisJourOnly={moisJourOnly} />)}
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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #E8D5A3', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#8A8A7A', fontSize: 13 }}>Chargement de l'étude...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button onClick={() => navigate('/etudes')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C9A84C', fontSize: 13, fontWeight: 500, padding: 0 }}>
          ← Études
        </button>
      </div>
      <PageHeader title="Étude d'Évolutions — Juin 2026" subtitle="Tendances Jan → Juin 2026 · Marketing · CC · Vente · Analyse CV" />

      {/* Segments */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: '#F8F7F4', borderRadius: 24, padding: '4px', width: 'fit-content' }}>
        {SEGMENTS.map(s => (
          <button key={s.key} style={segStyle(segment === s.key)} onClick={() => setSegment(s.key)}>{s.label}</button>
        ))}
      </div>

      {/* ── MARKETING ── */}
      {segment === 'marketing' && (
        <div>
          <TrendChart
            data={mktChartData}
            title="Qualité des leads — Évolution mensuelle"
            subtitle="Exploitables = (Injections − Non exploit.) / Injections · Joignabilité = (Injections − Indispos) / Injections"
            refLines={[{ value: 80, color: '#E8D5A3' }]}
            cvBadges={[
              { label: 'CV Exploitables', cv: mktCVGlobal.expl },
              { label: 'CV Joignabilité', cv: mktCVGlobal.joign },
            ]}
            lines={[
              { key: 'Exploitables', name: 'Exploitables', color: '#4CAF7D' },
              { key: 'Joignabilité', name: 'Joignabilité', color: '#5B6FC4' },
            ]}
          />
          <CvMensuelTable
            moisJourOnly={true}
            rows={[
              { label: 'CV Exploitables', color: '#4CAF7D', data: mktParMois, moisKey: 'cvExpl' },
              { label: 'CV Joignabilité', color: '#5B6FC4', data: mktParMois, moisKey: 'cvJoign' },
            ]}
          />
        </div>
      )}

      {/* ── CENTRE D'APPEL ── */}
      {segment === 'cc' && (
        <div>
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
          />
          <CvMensuelTable
            moisJourOnly={true}
            rows={[
              { label: 'CV Conv. Tél.', color: '#5B6FC4', data: ccParMois, moisKey: 'cvConv' },
              { label: 'CV Taux Présence', color: '#4CAF7D', data: ccParMois, moisKey: 'cvPres' },
            ]}
          />
        </div>
      )}

      {/* ── VENTE ── */}
      {segment === 'vente' && (
        <div>
          {/* Toggle Global/Salé/Kénitra */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {VENTE_SUBS.map(s => (
              <button key={s.key} style={subStyle(venteSub === s.key)} onClick={() => setVenteSub(s.key)}>{s.label}</button>
            ))}
          </div>
          <TrendChart
            data={venteChartData(venteSub)}
            title={`Taux de vente — ${VENTE_SUBS.find(s => s.key === venteSub)?.label}`}
            subtitle="Ventes / Visites (visites + ventes)"
            cvBadges={[{ label: 'CV Global', cv: venteCVGlobal[venteSub] }]}
            lines={[{ key: 'Taux de vente', name: 'Taux de vente', color: '#E05C5C' }]}
          />
          <CvMensuelTable
            moisJourOnly={true}
            rows={[
              { label: 'CV Taux de vente', color: '#E05C5C', data: venteParMois.map(m => ({ ...m, cvVente: calcCV(fluxData.filter(r => (r.date_debut || '').startsWith(m.moisVal) && r.type_saisie !== 'periode').map(r => pct(r.ventes || 0, (r.visites || 0) + (r.ventes || 0))).filter(v => v !== null)) })), moisKey: 'cvVente' },
            ]}
          />
        </div>
      )}

      {/* ── CV ── */}
      {segment === 'cv' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {CV_SUBS.map(s => (
              <button key={s.key} style={subStyle(cvSub === s.key)} onClick={() => setCvSub(s.key)}>{s.label}</button>
            ))}
          </div>

          {cvSub === 'cc' && (
            <TrendChart
              data={cvCCCourbe}
              title="Évolution du CV — Centre d'Appel"
              subtitle="CV = σ/μ des moyennes mensuelles par conseillère (jours ouvrables uniquement)"
              cvBadges={[
                { label: 'CV Conv.', cv: calcCV(cvCCCourbe.map(d => d['CV Conv. Tél.']).filter(v => v !== null)) },
                { label: 'CV Présence', cv: calcCV(cvCCCourbe.map(d => d['CV Taux Présence']).filter(v => v !== null)) },
              ]}
              lines={[
                { key: 'CV Conv. Tél.', name: 'CV Conv. Tél.', color: '#5B6FC4' },
                { key: 'CV Taux Présence', name: 'CV Taux Présence', color: '#4CAF7D' },
              ]}
            />
          )}

          {cvSub === 'sale' && (
            <TrendChart
              data={cvVenteCourbe.sale}
              title="Évolution du CV — Vente Salé"
              subtitle="CV = σ/μ des moyennes mensuelles des commerciaux Salé (jours ouvrables uniquement)"
              cvBadges={[
                { label: 'CV Global', cv: calcCV(cvVenteCourbe.sale.map(d => d['CV Vente Salé']).filter(v => v !== null)) },
              ]}
              lines={[{ key: 'CV Vente Salé', name: 'CV Vente Salé', color: '#C9A84C' }]}
            />
          )}

          {cvSub === 'kenitra' && (
            <TrendChart
              data={cvVenteCourbe.kenitra}
              title="Évolution du CV — Vente Kénitra"
              subtitle="CV = σ/μ des moyennes mensuelles des commerciaux Kénitra (jours ouvrables uniquement)"
              cvBadges={[
                { label: 'CV Global', cv: calcCV(cvVenteCourbe.kenitra.map(d => d['CV Vente Kénitra']).filter(v => v !== null)) },
              ]}
              lines={[{ key: 'CV Vente Kénitra', name: 'CV Vente Kénitra', color: '#9B59B6' }]}
            />
          )}
        </div>
      )}
    </div>
  )
}