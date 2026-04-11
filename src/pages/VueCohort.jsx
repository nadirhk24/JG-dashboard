import React, { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import PageHeader from '../components/PageHeader'
import PeriodeFilter from '../components/PeriodeFilter'
import ConseillereFilter from '../components/ConseillereFilter'
import SectionTitle from '../components/SectionTitle'
import { filtrerParPeriode, groupByDay, groupByWeek, groupByMonth } from '../lib/dates'
import { agregerParPeriode, calcCV } from '../lib/kpi'

export default function VueCohort({ conseilleres, saisies }) {
  const [periode, setPeriode] = useState('mois')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreConseillere, setFiltreConseillere] = useState('all')
  const [drillNiveau, setDrillNiveau] = useState('global')
  const [drillConseillere, setDrillConseillere] = useState(null)

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

  const cvRdv = useMemo(() => calcCV(kpisParConseillere.map(c => c.conversion_tel)), [kpisParConseillere])
  const cvVisites = useMemo(() => calcCV(kpisParConseillere.map(c => c.taux_presence)), [kpisParConseillere])
  const cvVentes = useMemo(() => calcCV(kpisParConseillere.map(c => c.efficacite_comm)), [kpisParConseillere])

  const chartData = useMemo(() => {
    let groups
    if (periode === 'jour') groups = groupByDay(saisiesFiltrees)
    else if (periode === 'semaine' || periode === 'mois') groups = groupByWeek(saisiesFiltrees)
    else groups = groupByMonth(saisiesFiltrees)

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      const base = agg.leads_bruts || 1
      return {
        label: key.substring(5),
        non_exploitables: parseFloat(((agg.indispos / base) * 100).toFixed(1)),
        indispos: parseFloat(((agg.indispos / base) * 100).toFixed(1)),
        suivis: parseFloat(((agg.echanges / base) * 100).toFixed(1)),
        rdv: parseFloat(((agg.rdv / base) * 100).toFixed(1)),
        visites: parseFloat(((agg.visites / base) * 100).toFixed(1)),
        ventes: parseFloat(((agg.ventes / base) * 100).toFixed(1)),
      }
    })
  }, [saisiesFiltrees, periode])

  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }

  const cohortKpis = [
    { label: 'Non exploitables', value: kpisGlobal.leads_bruts > 0 ? ((kpisGlobal.indispos / kpisGlobal.leads_bruts) * 100).toFixed(1) : 0, color: '#E05C5C' },
    { label: 'Indispos', value: kpisGlobal.leads_bruts > 0 ? ((kpisGlobal.indispos / kpisGlobal.leads_bruts) * 100).toFixed(1) : 0, color: '#F59E0B' },
    { label: 'Suivis', value: kpisGlobal.leads_bruts > 0 ? ((kpisGlobal.echanges / kpisGlobal.leads_bruts) * 100).toFixed(1) : 0, color: '#C9A84C' },
    { label: 'RDV', value: kpisGlobal.leads_bruts > 0 ? ((kpisGlobal.rdv / kpisGlobal.leads_bruts) * 100).toFixed(1) : 0, color: '#378ADD', cv: cvRdv },
    { label: 'Visites', value: kpisGlobal.leads_bruts > 0 ? ((kpisGlobal.visites / kpisGlobal.leads_bruts) * 100).toFixed(1) : 0, color: '#4CAF7D', cv: cvVisites },
    { label: 'Ventes', value: kpisGlobal.leads_bruts > 0 ? ((kpisGlobal.ventes / kpisGlobal.leads_bruts) * 100).toFixed(1) : 0, color: '#534AB7', cv: cvVentes },
  ]

  return (
    <div>
      <PageHeader title="Vue Cohorte" subtitle="Analyse complète basée sur les leads injectés">
        <PeriodeFilter value={periode} onChange={setPeriode} dateDebut={dateDebut} dateFin={dateFin} onDateChange={handleDateChange} />
        <ConseillereFilter conseilleres={conseilleres} value={filtreConseillere} onChange={setFiltreConseillere} />
      </PageHeader>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['global', 'Global équipe'], ['conseillere', 'Par conseillère'], ['jour', 'Par jour']].map(([key, label]) => (
          <button key={key} onClick={() => setDrillNiveau(key)} style={{
            padding: '7px 16px', borderRadius: 16,
            border: `1.5px solid ${drillNiveau === key ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
            background: drillNiveau === key ? '#C9A84C' : '#fff',
            color: drillNiveau === key ? '#fff' : '#5A5A5A',
            fontSize: 12, cursor: 'pointer', fontWeight: drillNiveau === key ? 500 : 400
          }}>
            {label}
          </button>
        ))}
      </div>

      <SectionTitle>Cohorte globale — base leads injectés</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 12, marginBottom: 24 }}>
        {cohortKpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid rgba(201,168,76,0.15)', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 600, color: '#2C2C2C' }}>{k.value}%</div>
            {k.cv !== undefined && (
              <div style={{ fontSize: 11, marginTop: 6, color: '#8A8A7A' }}>CV: <span style={{ color: k.color, fontWeight: 500 }}>{k.cv}%</span></div>
            )}
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Évolution cohorte dans le temps</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
            <Bar dataKey="suivis" fill="#C9A84C" name="Suivis" radius={[2,2,0,0]} />
            <Bar dataKey="rdv" fill="#378ADD" name="RDV" radius={[2,2,0,0]} />
            <Bar dataKey="visites" fill="#4CAF7D" name="Visites" radius={[2,2,0,0]} />
            <Bar dataKey="ventes" fill="#534AB7" name="Ventes" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[['#C9A84C','Suivis'],['#378ADD','RDV'],['#4CAF7D','Visites'],['#534AB7','Ventes']].map(([c,l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5A5A5A' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }}></span>{l}
            </span>
          ))}
        </div>
      </div>

      {drillNiveau === 'conseillere' && (
        <>
          <SectionTitle>Détail par conseillère</SectionTitle>
          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Conseillère', 'Leads Bruts', 'Non Exploit.', 'Indispos', 'Suivis', 'RDV', 'Visites', 'Ventes', 'Détail'].map(h => (
                    <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpisParConseillere.map(c => {
                  const base = c.leads_bruts || 1
                  const pct = v => `${((v / base) * 100).toFixed(1)}%`
                  return (
                    <tr key={c.id}
                      onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 10px', fontWeight: 500, fontSize: 13 }}>{c.nom}</td>
                      <td style={{ padding: '11px 10px', fontSize: 13 }}>{c.leads_bruts}</td>
                      <td style={{ padding: '11px 10px', fontSize: 13, color: '#E05C5C' }}>{pct(c.indispos)}</td>
                      <td style={{ padding: '11px 10px', fontSize: 13, color: '#F59E0B' }}>{pct(c.indispos)}</td>
                      <td style={{ padding: '11px 10px', fontSize: 13, color: '#C9A84C' }}>{pct(c.echanges)}</td>
                      <td style={{ padding: '11px 10px', fontSize: 13, color: '#378ADD' }}>{pct(c.rdv)}</td>
                      <td style={{ padding: '11px 10px', fontSize: 13, color: '#4CAF7D' }}>{pct(c.visites)}</td>
                      <td style={{ padding: '11px 10px', fontSize: 13, color: '#534AB7' }}>{pct(c.ventes)}</td>
                      <td style={{ padding: '11px 10px' }}>
                        <button
                          onClick={() => setDrillConseillere(drillConseillere === c.id ? null : c.id)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', background: drillConseillere === c.id ? '#C9A84C' : 'transparent', fontSize: 11, cursor: 'pointer', color: drillConseillere === c.id ? '#fff' : '#C9A84C' }}>
                          {drillConseillere === c.id ? 'Fermer' : 'Détail ↗'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {drillNiveau === 'jour' && (
        <>
          <SectionTitle>Détail par jour</SectionTitle>
          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Leads Bruts', 'Indispos', 'Suivis', 'RDV', 'Visites', 'Ventes'].map(h => (
                    <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupByDay(saisiesFiltrees)).sort(([a],[b]) => b.localeCompare(a)).map(([date, items]) => {
                  const agg = agregerParPeriode(items)
                  const base = agg.leads_bruts || 1
                  const pct = v => `${((v / base) * 100).toFixed(1)}%`
                  return (
                    <tr key={date}
                      onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px', fontSize: 13, fontWeight: 500 }}>{date}</td>
                      <td style={{ padding: '10px', fontSize: 13 }}>{agg.leads_bruts}</td>
                      <td style={{ padding: '10px', fontSize: 13, color: '#E05C5C' }}>{pct(agg.indispos)}</td>
                      <td style={{ padding: '10px', fontSize: 13, color: '#C9A84C' }}>{pct(agg.echanges)}</td>
                      <td style={{ padding: '10px', fontSize: 13, color: '#378ADD' }}>{pct(agg.rdv)}</td>
                      <td style={{ padding: '10px', fontSize: 13, color: '#4CAF7D' }}>{pct(agg.visites)}</td>
                      <td style={{ padding: '10px', fontSize: 13, color: '#534AB7' }}>{pct(agg.ventes)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
