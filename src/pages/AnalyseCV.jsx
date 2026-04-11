import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'
import { supabase } from '../lib/supabase'
import { filtrerParPeriode, getGroupFunction, formatGroupLabel } from '../lib/dates'
import { agregerParPeriode } from '../lib/kpi'

const CC_KPIS = [
  { key: 'conversion_tel', label: 'Conv. Téléphonique', color: '#C9A84C', unit: '%' },
  { key: 'taux_presence', label: 'Taux de Présence', color: '#4CAF7D', unit: '%' },
  { key: 'efficacite_comm', label: 'Efficacité Commerciale', color: '#534AB7', unit: '%' },
  { key: 'productivite', label: 'Productivité', color: '#378ADD', unit: '%' },
  { key: 'joignabilite', label: 'Joignabilité', color: '#2E9455', unit: '%' },
]

const MKT_KPIS = [
  { key: 'taux_rdv', label: 'Taux RDV', color: '#534AB7', unit: '%' },
  { key: 'taux_visites', label: 'Taux Visites', color: '#4CAF7D', unit: '%' },
  { key: 'taux_ventes', label: 'Taux Ventes', color: '#1a6b3c', unit: '%' },
  { key: 'taux_suivis', label: 'Taux Suivis', color: '#C9A84C', unit: '%' },
  { key: 'taux_indispos', label: 'Taux Indispos', color: '#E05C5C', unit: '%' },
  { key: 'taux_non_exp', label: 'Taux Non exploit.', color: '#8A8A7A', unit: '%' },
]

function calcCV(valeurs) {
  const vals = valeurs.filter(v => v > 0)
  if (vals.length < 2) return 0
  const moy = vals.reduce((a, b) => a + b, 0) / vals.length
  if (moy === 0) return 0
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0) / vals.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

function calcTaux(val, base) {
  if (!base || base === 0) return 0
  return parseFloat(((val / base) * 100).toFixed(1))
}

const CustomBarLabel = ({ x, y, width, value }) => {
  if (!value) return null
  return <text x={x + width / 2} y={y - 4} fill="#5A5A5A" textAnchor="middle" fontSize={10}>{value}%</text>
}

const CustomDotLabel = ({ cx, cy, value }) => {
  if (!value) return null
  return <text x={cx} y={cy - 10} fill="#C9A84C" textAnchor="middle" fontSize={10} fontWeight={500}>{value}%</text>
}

export default function AnalyseCV({ conseilleres, saisies }) {
  const [segment, setSegment] = useState('callcenter')
  const [kpiKey, setKpiKey] = useState('conversion_tel')
  const [periode, setPeriode] = useState('mois')
  const [marketingData, setMarketingData] = useState([])

  useEffect(() => {
    loadMarketing()
  }, [])

  async function loadMarketing() {
    const { data } = await supabase.from('marketing_saisies').select('*').order('date', { ascending: true })
    setMarketingData(data || [])
  }

  useEffect(() => {
    if (segment === 'callcenter') setKpiKey('conversion_tel')
    else setKpiKey('taux_rdv')
  }, [segment])

  const kpis = segment === 'callcenter' ? CC_KPIS : MKT_KPIS
  const selectedKpi = kpis.find(k => k.key === kpiKey) || kpis[0]

  const groupFn = useMemo(() => getGroupFunction(periode), [periode])

  const chartData = useMemo(() => {
    if (segment === 'callcenter') {
      const filtered = filtrerParPeriode(saisies, periode)
      const groups = groupFn(filtered)
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
        const agg = agregerParPeriode(items)
        return { label: formatGroupLabel(key, periode), taux: agg[kpiKey] || 0 }
      })
    } else {
      const filtered = filtrerParPeriode(marketingData, periode)
      const groups = groupFn(filtered)
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

  const cvData = useMemo(() => {
    if (chartData.length < 2) return []
    const result = []
    for (let i = 1; i < chartData.length; i++) {
      const slice = chartData.slice(0, i + 1)
      const cv = calcCV(slice.map(r => r.taux))
      result.push({ label: chartData[i].label, cv })
    }
    return result
  }, [chartData])

  const cvGlobal = useMemo(() => calcCV(chartData.map(r => r.taux)), [chartData])

  const periodes = [
    { key: 'jour', label: 'Jour' },
    { key: 'semaine', label: 'Semaine' },
    { key: 'mois', label: 'Mois' },
    { key: 'trimestre', label: 'Trimestre' },
  ]

  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)' }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const btnStyle = (active, color = '#C9A84C') => ({
    padding: '7px 16px', borderRadius: 20,
    border: `1.5px solid ${active ? color : 'rgba(201,168,76,0.2)'}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : '#5A5A5A',
    fontSize: 12, fontWeight: active ? 500 : 400, cursor: 'pointer', transition: 'all 0.2s'
  })

  return (
    <div>
      <PageHeader title="Analyse CV" subtitle="Coefficient de variation par segment et KPI" />

      <div style={{ display: 'flex', gap: 20, marginBottom: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Segment</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnStyle(segment === 'callcenter')} onClick={() => setSegment('callcenter')}>Call Center</button>
            <button style={btnStyle(segment === 'marketing')} onClick={() => setSegment('marketing')}>Marketing</button>
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

      <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 500 }}>KPI</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {kpis.map(k => (
          <button key={k.key} style={btnStyle(kpiKey === k.key, k.color)} onClick={() => setKpiKey(k.key)}>{k.label}</button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(201,168,76,0.15)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>KPI sélectionné</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: selectedKpi.color }}>{selectedKpi.label}</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>CV Global</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: cvGlobal > 50 ? '#E05C5C' : cvGlobal > 25 ? '#C9A84C' : '#4CAF7D', fontFamily: 'DM Sans' }}>{cvGlobal}%</div>
        </div>
        <div style={{ width: 1, height: 40, background: 'rgba(201,168,76,0.2)' }}></div>
        <div>
          <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Interprétation</div>
          <div style={{ fontSize: 13, color: '#5A5A5A' }}>
            {cvGlobal === 0 ? 'Pas assez de données' :
             cvGlobal < 15 ? '✅ Très stable' :
             cvGlobal < 30 ? '🟡 Modérément variable' :
             cvGlobal < 50 ? '🟠 Variable — surveiller' :
             '🔴 Très variable — action requise'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4 }}>{selectedKpi.label}</div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16 }}>Taux par {periode}</div>
          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#5A5A5A', fontSize: 13 }}>Pas de données pour cette période</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, selectedKpi.label]} />
                <Bar dataKey="taux" fill={selectedKpi.color} radius={[4, 4, 0, 0]} name={selectedKpi.label}>
                  <LabelList dataKey="taux" content={<CustomBarLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 4 }}>CV — {selectedKpi.label}</div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16 }}>Évolution du coefficient de variation</div>
          {cvData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#5A5A5A', fontSize: 13 }}>Pas assez de données pour calculer le CV</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
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

      <SectionTitle>Tableau détaillé</SectionTitle>
      <div style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>Période</th>
                <th style={{ fontSize: 10, color: selectedKpi.color, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{selectedKpi.label}</th>
                <th style={{ fontSize: 10, color: '#C9A84C', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>CV cumulé</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => {
                const cvRow = cvData.find(c => c.label === row.label)
                return (
                  <tr key={i} onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, color: '#C9A84C', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{row.label}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: selectedKpi.color, fontWeight: 500, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{row.taux}%</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: cvRow ? (cvRow.cv > 50 ? '#E05C5C' : cvRow.cv > 25 ? '#C9A84C' : '#4CAF7D') : '#8A8A7A', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                      {cvRow ? `${cvRow.cv}%` : '—'}
                    </td>
                  </tr>
                )
              })}
              {chartData.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Aucune donnée disponible</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
