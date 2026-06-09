import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

// ── Helpers ──────────────────────────────────────────────────────────────────
const MOIS = [
  { label: 'Jan', value: '2026-01' },
  { label: 'Fév', value: '2026-02' },
  { label: 'Mar', value: '2026-03' },
  { label: 'Avr', value: '2026-04' },
  { label: 'Mai', value: '2026-05' },
  { label: 'Juin', value: '2026-06' },
]

function calcCV(vals) {
  const v = vals.filter(x => x !== null && x !== undefined && !isNaN(x) && x > 0)
  if (v.length < 2) return null
  const moy = v.reduce((a, b) => a + b, 0) / v.length
  if (moy === 0) return null
  const variance = v.reduce((s, x) => s + Math.pow(x - moy, 2), 0) / v.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

function pct(a, b) {
  if (!b || b === 0) return null
  return parseFloat(((a / b) * 100).toFixed(1))
}

function cvColor(cv) {
  if (cv === null) return '#8A8A7A'
  if (cv <= 20) return '#4CAF7D'
  if (cv <= 35) return '#C9A84C'
  return '#E05C5C'
}

function trendColor(vals) {
  const v = vals.filter(x => x !== null)
  if (v.length < 2) return '#C9A84C'
  return v[v.length - 1] >= v[0] ? '#4CAF7D' : '#E05C5C'
}

// ── Tooltip personnalisé ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#2C2C2C' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name} : <strong>{p.value !== null ? `${p.value}%` : '—'}</strong>
        </div>
      ))}
    </div>
  )
}

// ── Graphe tendance ───────────────────────────────────────────────────────────
function TrendChart({ data, lines, title, subtitle, refLine }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE6" />
          <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#8A8A7A' }} />
          <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} unit="%" domain={[0, 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {refLine && <ReferenceLine y={refLine} stroke="#E8D5A3" strokeDasharray="4 4" />}
          {lines.map((l, i) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name}
              stroke={l.color}
              strokeWidth={2.5}
              dot={{ r: 4, fill: l.color }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* Tableau valeurs + CV sous le graphe */}
      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8F7F4' }}>
              <th style={{ padding: '6px 12px', textAlign: 'left', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>Indicateur</th>
              {MOIS.map(m => (
                <th key={m.value} style={{ padding: '6px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>{m.label}</th>
              ))}
              <th style={{ padding: '6px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>CV</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const vals = MOIS.map(m => data.find(d => d.mois === m.label)?.[l.key] ?? null)
              const cv = calcCV(vals)
              return (
                <tr key={l.key} style={{ borderBottom: '1px solid #F0EDE6' }}>
                  <td style={{ padding: '6px 12px', color: l.color, fontWeight: 500 }}>{l.name}</td>
                  {vals.map((v, i) => (
                    <td key={i} style={{ padding: '6px 10px', textAlign: 'center', color: v !== null ? '#2C2C2C' : '#C8C5BC', fontWeight: v !== null ? 500 : 400 }}>
                      {v !== null ? `${v}%` : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, color: cvColor(cv) }}>
                    {cv !== null ? `${cv}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tableau CV par entité × mois ──────────────────────────────────────────────
function CvTable({ title, rows, metricLabel }) {
  if (!rows.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C', marginBottom: 16 }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8F7F4' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF', whiteSpace: 'nowrap' }}>{metricLabel || 'Entité'}</th>
              {MOIS.map(m => (
                <th key={m.value} style={{ padding: '8px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>{m.label}</th>
              ))}
              <th style={{ padding: '8px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>CV Global</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const allVals = MOIS.map(m => row.mois[m.value] ?? null)
              const globalCV = calcCV(allVals)
              return (
                <tr key={ri} style={{ borderBottom: '1px solid #F0EDE6', background: ri % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ padding: '7px 12px', fontWeight: 500, color: '#2C2C2C', whiteSpace: 'nowrap' }}>{row.nom}</td>
                  {allVals.map((v, i) => (
                    <td key={i} style={{ padding: '7px 10px', textAlign: 'center', color: v !== null ? cvColor(v) : '#C8C5BC', fontWeight: v !== null ? 600 : 400 }}>
                      {v !== null ? `${v}%` : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: cvColor(globalCV) }}>
                    {globalCV !== null ? `${globalCV}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Légende couleurs CV */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#8A8A7A' }}>
        <span><span style={{ color: '#4CAF7D', fontWeight: 600 }}>■</span> CV ≤ 20% — Régulier</span>
        <span><span style={{ color: '#C9A84C', fontWeight: 600 }}>■</span> CV 20–35% — Modéré</span>
        <span><span style={{ color: '#E05C5C', fontWeight: 600 }}>■</span> CV {'>'} 35% — Variable</span>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EtudeEvolutions2026() {
  const navigate = useNavigate()
  const [segment, setSegment] = useState('marketing')
  const [cvSub, setCvSub] = useState('cc')
  const [loading, setLoading] = useState(true)

  // Données brutes
  const [mktData, setMktData] = useState([])       // marketing_saisies par jour
  const [ccData, setCcData] = useState([])          // saisies par jour (CC)
  const [fluxData, setFluxData] = useState([])      // flux_rdv par jour
  const [conseilleres, setConseilleres] = useState([])
  const [commerciaux, setCommerciaux] = useState([])

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: mkt },
      { data: cc },
      { data: flux },
      { data: cons },
      { data: comms },
    ] = await Promise.all([
      supabase.from('marketing_saisies').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('saisies').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('flux_rdv').select('*').gte('date_debut', '2026-01-01').lte('date_debut', '2026-06-30'),
      supabase.from('conseilleres').select('id, nom').eq('actif', true).order('nom'),
      supabase.from('commerciaux').select('id, nom, equipe').eq('actif', true).order('nom'),
    ])
    setMktData(mkt || [])
    setCcData(cc || [])
    setFluxData(flux || [])
    setConseilleres(cons || [])
    setCommerciaux(comms || [])
    setLoading(false)
  }

  // ── Agréger par mois ──────────────────────────────────────────────────────
  const mktParMois = useMemo(() => {
    return MOIS.map(m => {
      const rows = mktData.filter(r => (r.date_debut || r.date || '').startsWith(m.value))
      const inj = rows.reduce((s, r) => s + (r.injections || 0), 0)
      const ne = rows.reduce((s, r) => s + (r.non_exploitables || 0), 0)
      const ind = rows.reduce((s, r) => s + (r.indispos || 0), 0)
      const suivi = rows.reduce((s, r) => s + (r.suivis || 0), 0)
      const rdv = rows.reduce((s, r) => s + (r.rdv || 0), 0)
      const vis = rows.reduce((s, r) => s + ((r.visites || 0) + (r.ventes || 0)), 0)
      const ven = rows.reduce((s, r) => s + (r.ventes || 0), 0)
      // Taux exploitables = (inj - ne) / inj
      const txExpl = pct(inj - ne, inj)
      // Taux joignabilité = (inj - ind) / inj
      const txJoign = pct(inj - ind, inj)
      // CV jour par jour pour chaque taux
      const dayExpl = rows.map(r => pct((r.injections || 0) - (r.non_exploitables || 0), r.injections || 0)).filter(v => v !== null)
      const dayJoign = rows.map(r => pct((r.injections || 0) - (r.indispos || 0), r.injections || 0)).filter(v => v !== null)
      return {
        mois: m.label,
        moisVal: m.value,
        injections: inj,
        txExpl,
        txJoign,
        cvExpl: calcCV(dayExpl),
        cvJoign: calcCV(dayJoign),
        hasData: inj > 0,
      }
    })
  }, [mktData])

  const ccParMois = useMemo(() => {
    return MOIS.map(m => {
      const rows = ccData.filter(r => (r.date_debut || r.date || '').startsWith(m.value))
      const echanges = rows.reduce((s, r) => s + (r.echanges || 0), 0)
      const rdv = rows.reduce((s, r) => s + (r.rdv || 0), 0)
      const vis = rows.reduce((s, r) => s + (r.visites || 0), 0)
      const ven = rows.reduce((s, r) => s + (r.ventes || 0), 0)
      const lb = rows.reduce((s, r) => s + (r.leads_bruts || 0), 0)
      const ne = rows.reduce((s, r) => s + (r.non_exploitables_cc || 0), 0)
      const ind = rows.reduce((s, r) => s + (r.indispos || 0), 0)
      // Leads nets = lb - ind
      const ln = Math.max(0, lb - ind)
      // Taux exploitation = echanges / ln
      const txExpl = pct(echanges, ln)
      // Taux conversion = rdv / echanges
      const txConv = pct(rdv, echanges)
      // Taux présence = vis / rdv
      const txPres = pct(vis, rdv)
      // CV jour par jour
      const dayConv = rows.filter(r => r.type_saisie !== 'periode').map(r => pct(r.rdv || 0, r.echanges || 0)).filter(v => v !== null)
      const dayPres = rows.filter(r => r.type_saisie !== 'periode').map(r => pct(r.visites || 0, r.rdv || 0)).filter(v => v !== null)
      const dayExpl = rows.filter(r => r.type_saisie !== 'periode').map(r => {
        const lnJ = Math.max(0, (r.leads_bruts || 0) - (r.indispos || 0))
        return pct(r.echanges || 0, lnJ)
      }).filter(v => v !== null)
      return {
        mois: m.label,
        moisVal: m.value,
        txExpl,
        txConv,
        txPres,
        cvExpl: calcCV(dayExpl),
        cvConv: calcCV(dayConv),
        cvPres: calcCV(dayPres),
        hasData: echanges > 0,
      }
    })
  }, [ccData])

  const venteParMois = useMemo(() => {
    return MOIS.map(m => {
      const rows = fluxData.filter(r => (r.date_debut || '').startsWith(m.value))
      const vis = rows.reduce((s, r) => s + (r.visites || 0) + (r.ventes || 0), 0)
      const ven = rows.reduce((s, r) => s + (r.ventes || 0), 0)
      const txVente = pct(ven, vis)
      // CV jour par jour taux vente
      const dayVente = rows.filter(r => r.type_saisie !== 'periode').map(r => {
        const v = (r.visites || 0) + (r.ventes || 0)
        return pct(r.ventes || 0, v)
      }).filter(v => v !== null)
      return {
        mois: m.label,
        moisVal: m.value,
        txVente,
        cvVente: calcCV(dayVente),
        hasData: vis > 0,
      }
    })
  }, [fluxData])

  // ── CV par conseillère × mois ──────────────────────────────────────────────
  const cvConseillereConv = useMemo(() => {
    return conseilleres.map(c => {
      const moisMap = {}
      MOIS.forEach(m => {
        const rows = ccData.filter(r =>
          r.conseillere_id === c.id &&
          (r.date_debut || r.date || '').startsWith(m.value) &&
          r.type_saisie !== 'periode'
        )
        const vals = rows.map(r => pct(r.rdv || 0, r.echanges || 0)).filter(v => v !== null)
        moisMap[m.value] = calcCV(vals)
      })
      return { nom: c.nom, mois: moisMap }
    })
  }, [conseilleres, ccData])

  const cvConseillerePresence = useMemo(() => {
    return conseilleres.map(c => {
      const moisMap = {}
      MOIS.forEach(m => {
        const rows = ccData.filter(r =>
          r.conseillere_id === c.id &&
          (r.date_debut || r.date || '').startsWith(m.value) &&
          r.type_saisie !== 'periode'
        )
        const vals = rows.map(r => pct(r.visites || 0, r.rdv || 0)).filter(v => v !== null)
        moisMap[m.value] = calcCV(vals)
      })
      return { nom: c.nom, mois: moisMap }
    })
  }, [conseilleres, ccData])

  const cvCommVente = useMemo(() => {
    const sale = commerciaux.filter(c => c.equipe === 'sale')
    const kenitra = commerciaux.filter(c => c.equipe === 'kenitra')
    function buildRows(comms) {
      return comms.map(c => {
        const moisMap = {}
        MOIS.forEach(m => {
          const rows = fluxData.filter(r =>
            r.commercial_id === c.id &&
            (r.date_debut || '').startsWith(m.value) &&
            r.type_saisie !== 'periode'
          )
          const vals = rows.map(r => {
            const v = (r.visites || 0) + (r.ventes || 0)
            return pct(r.ventes || 0, v)
          }).filter(v => v !== null)
          moisMap[m.value] = calcCV(vals)
        })
        return { nom: c.nom, mois: moisMap }
      })
    }
    return { sale: buildRows(sale), kenitra: buildRows(kenitra) }
  }, [commerciaux, fluxData])

  // ── Données graphes ───────────────────────────────────────────────────────
  const mktChartData = mktParMois.filter(m => m.hasData).map(m => ({
    mois: m.label,
    'Exploitables': m.txExpl,
    'Joignabilité': m.txJoign,
  }))

  const ccExplData = ccParMois.filter(m => m.hasData).map(m => ({
    mois: m.label,
    'Taux exploitation': m.txExpl,
  }))

  const ccConvPresData = ccParMois.filter(m => m.hasData).map(m => ({
    mois: m.label,
    'Conv. Tél.': m.txConv,
    'Taux Présence': m.txPres,
  }))

  const venteChartData = venteParMois.filter(m => m.hasData).map(m => ({
    mois: m.label,
    'Taux de vente': m.txVente,
  }))

  // ── Styles ────────────────────────────────────────────────────────────────
  const SEGMENTS = [
    { key: 'marketing', label: 'Marketing' },
    { key: 'cc', label: 'Centre d\'Appel' },
    { key: 'vente', label: 'Vente' },
    { key: 'cv', label: 'CV' },
  ]
  const CV_SUBS = [
    { key: 'cc', label: 'CC' },
    { key: 'sale', label: 'Vente Salé' },
    { key: 'kenitra', label: 'Vente Kénitra' },
  ]

  const segStyle = (active) => ({
    padding: '8px 20px',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    background: active ? '#C9A84C' : '#F8F7F4',
    color: active ? '#fff' : '#5A5A5A',
    transition: 'all 0.15s',
  })

  const subStyle = (active) => ({
    padding: '6px 16px',
    borderRadius: 16,
    border: `1px solid ${active ? '#C9A84C' : '#E8E6DF'}`,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    background: active ? '#FBF5E6' : '#fff',
    color: active ? '#C9A84C' : '#5A5A5A',
    transition: 'all 0.15s',
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button onClick={() => navigate('/etudes')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C9A84C', fontSize: 13, fontWeight: 500, padding: 0 }}>
          ← Études
        </button>
      </div>

      <PageHeader
        title="Étude d'Évolutions — Juin 2026"
        subtitle="Tendances Jan → Juin 2026 · Marketing · CC · Vente · Analyse CV"
      />

      {/* Segments */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        {SEGMENTS.map(s => (
          <button key={s.key} style={segStyle(segment === s.key)} onClick={() => setSegment(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── MARKETING ── */}
      {segment === 'marketing' && (
        <div>
          <TrendChart
            data={mktChartData}
            title="Qualité des leads — Évolution mensuelle"
            subtitle="Taux exploitables = (Injections − Non exploitables) / Injections · Taux joignabilité = (Injections − Indispos) / Injections"
            refLine={80}
            lines={[
              { key: 'Exploitables', name: 'Exploitables', color: '#4CAF7D' },
              { key: 'Joignabilité', name: 'Joignabilité', color: '#5B6FC4' },
            ]}
          />
          {/* Résumé CV mensuel */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '20px 28px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C', marginBottom: 14 }}>CV mensuel — Variabilité jour par jour</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8F7F4' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>Indicateur</th>
                    {MOIS.map(m => <th key={m.value} style={{ padding: '6px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'CV Exploitables', key: 'cvExpl', color: '#4CAF7D' },
                    { label: 'CV Joignabilité', key: 'cvJoign', color: '#5B6FC4' },
                  ].map(row => (
                    <tr key={row.key} style={{ borderBottom: '1px solid #F0EDE6' }}>
                      <td style={{ padding: '7px 12px', color: row.color, fontWeight: 500 }}>{row.label}</td>
                      {MOIS.map(m => {
                        const d = mktParMois.find(x => x.moisVal === m.value)
                        const cv = d?.[row.key]
                        return (
                          <td key={m.value} style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: cvColor(cv) }}>
                            {cv !== null && cv !== undefined ? `${cv}%` : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTRE D'APPEL ── */}
      {segment === 'cc' && (
        <div>
          <TrendChart
            data={ccExplData}
            title="Taux d'exploitation — Évolution mensuelle"
            subtitle="Échanges / Leads nets (Leads bruts − Indispos)"
            lines={[{ key: 'Taux exploitation', name: "Taux d'exploitation", color: '#C9A84C' }]}
          />
          <TrendChart
            data={ccConvPresData}
            title="Conversion téléphonique & Taux de présence — Évolution mensuelle"
            subtitle="Conv. Tél. = RDV / Échanges · Taux Présence = Visites / RDV"
            lines={[
              { key: 'Conv. Tél.', name: 'Conv. Tél.', color: '#5B6FC4' },
              { key: 'Taux Présence', name: 'Taux Présence', color: '#4CAF7D' },
            ]}
          />
          {/* CV mensuel CC */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '20px 28px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C', marginBottom: 14 }}>CV mensuel — Variabilité jour par jour</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8F7F4' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>Indicateur</th>
                    {MOIS.map(m => <th key={m.value} style={{ padding: '6px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "CV Taux d'exploitation", key: 'cvExpl', color: '#C9A84C' },
                    { label: 'CV Conv. Tél.', key: 'cvConv', color: '#5B6FC4' },
                    { label: 'CV Taux Présence', key: 'cvPres', color: '#4CAF7D' },
                  ].map(row => (
                    <tr key={row.key} style={{ borderBottom: '1px solid #F0EDE6' }}>
                      <td style={{ padding: '7px 12px', color: row.color, fontWeight: 500 }}>{row.label}</td>
                      {MOIS.map(m => {
                        const d = ccParMois.find(x => x.moisVal === m.value)
                        const cv = d?.[row.key]
                        return (
                          <td key={m.value} style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: cvColor(cv) }}>
                            {cv !== null && cv !== undefined ? `${cv}%` : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── VENTE ── */}
      {segment === 'vente' && (
        <div>
          <TrendChart
            data={venteChartData}
            title="Taux de vente — Évolution mensuelle"
            subtitle="Ventes / Visites (visites + ventes)"
            lines={[{ key: 'Taux de vente', name: 'Taux de vente', color: '#E05C5C' }]}
          />
          {/* CV mensuel vente */}
          <div style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '20px 28px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C', marginBottom: 14 }}>CV mensuel — Variabilité jour par jour</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8F7F4' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>Indicateur</th>
                    {MOIS.map(m => <th key={m.value} style={{ padding: '6px 10px', textAlign: 'center', color: '#8A8A7A', fontWeight: 500, borderBottom: '1px solid #E8E6DF' }}>{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #F0EDE6' }}>
                    <td style={{ padding: '7px 12px', color: '#E05C5C', fontWeight: 500 }}>CV Taux de vente</td>
                    {MOIS.map(m => {
                      const d = venteParMois.find(x => x.moisVal === m.value)
                      const cv = d?.cvVente
                      return (
                        <td key={m.value} style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: cvColor(cv) }}>
                          {cv !== null && cv !== undefined ? `${cv}%` : '—'}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CV ── */}
      {segment === 'cv' && (
        <div>
          {/* Sous-onglets */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {CV_SUBS.map(s => (
              <button key={s.key} style={subStyle(cvSub === s.key)} onClick={() => setCvSub(s.key)}>
                {s.label}
              </button>
            ))}
          </div>

          {cvSub === 'cc' && (
            <div>
              <CvTable
                title="CV Taux de conversion téléphonique — Par conseillère × mois"
                rows={cvConseillereConv}
                metricLabel="Conseillère"
              />
              <CvTable
                title="CV Taux de présence (visites/RDV) — Par conseillère × mois"
                rows={cvConseillerePresence}
                metricLabel="Conseillère"
              />
            </div>
          )}

          {cvSub === 'sale' && (
            <CvTable
              title="CV Taux de vente — Commerciaux Salé × mois"
              rows={cvCommVente.sale}
              metricLabel="Commercial"
            />
          )}

          {cvSub === 'kenitra' && (
            <CvTable
              title="CV Taux de vente — Commerciaux Kénitra × mois"
              rows={cvCommVente.kenitra}
              metricLabel="Commercial"
            />
          )}
        </div>
      )}
    </div>
  )
}
