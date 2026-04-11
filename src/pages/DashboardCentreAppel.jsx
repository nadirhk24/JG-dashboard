import React, { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import PeriodeFilter from '../components/PeriodeFilter'
import ConseillereFilter from '../components/ConseillereFilter'
import KpiCard from '../components/KpiCard'
import SectionTitle from '../components/SectionTitle'
import { filtrerParPeriode, groupByDay, groupByWeek, groupByMonth } from '../lib/dates'
import { agregerParPeriode, calcCV, couleurPerf } from '../lib/kpi'

function getStars(rank, total) {
  const maxStars = Math.min(total, 5)
  const stars = Math.max(0, maxStars - rank)
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

export default function DashboardCentreAppel({ conseilleres, saisies, reload }) {
  const [periode, setPeriode] = useState('mois')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreConseillere, setFiltreConseillere] = useState('all')
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

  const cvConvTel = useMemo(() => calcCV(kpisParConseillere.map(c => c.conversion_tel)), [kpisParConseillere])
  const cvPresence = useMemo(() => calcCV(kpisParConseillere.map(c => c.taux_presence)), [kpisParConseillere])
  const cvEfficacite = useMemo(() => calcCV(kpisParConseillere.map(c => c.efficacite_comm)), [kpisParConseillere])

  const chartData = useMemo(() => {
    let groups
    if (periode === 'jour') groups = groupByDay(saisiesFiltrees)
    else if (periode === 'semaine') groups = groupByWeek(saisiesFiltrees)
    else if (periode === 'mois') groups = groupByMonth(saisiesFiltrees)
    else groups = groupByMonth(saisiesFiltrees)

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      return {
        label: periode === 'jour' ? key.substring(5) : periode === 'semaine' ? 'S ' + key.substring(5) : key.substring(0, 7),
        conv: agg.conversion_tel,
        presence: agg.taux_presence,
        efficacite: agg.efficacite_comm,
      }
    })
  }, [saisiesFiltrees, periode])

  const rankingSorted = [...kpisParConseillere].sort((a, b) => b.conversion_tel - a.conversion_tel)

  const drillData = useMemo(() => {
    if (!drillConseillere) return null
    const c = conseilleres.find(c => c.id === drillConseillere)
    const data = filtrerParPeriode(saisies.filter(s => s.conseillere_id === drillConseillere), periode, dateDebut, dateFin)
    const groups = groupByDay(data)
    const chartItems = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      return { label: key.substring(5), conv: agg.conversion_tel, presence: agg.taux_presence }
    })
    return { conseillere: c, kpis: agregerParPeriode(data), chartItems }
  }, [drillConseillere, saisies, conseilleres, periode, dateDebut, dateFin])

  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }

  return (
    <div>
      <PageHeader title="Dashboard Centre d'Appel" subtitle={`Performance équipe · ${periode}`}>
        <PeriodeFilter value={periode} onChange={setPeriode} dateDebut={dateDebut} dateFin={dateFin} onDateChange={handleDateChange} />
        <ConseillereFilter conseilleres={conseilleres} value={filtreConseillere} onChange={setFiltreConseillere} />
      </PageHeader>

      {drillConseillere && drillData && (
        <div style={{ ...cardStyle, borderColor: '#C9A84C' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 4 }}>
                <span style={{ color: '#C9A84C', cursor: 'pointer' }} onClick={() => setDrillConseillere(null)}>← Retour équipe</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>Drill-down : {drillData.conseillere?.nom}</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Conv. Téléphonique', val: drillData.kpis.conversion_tel },
              { label: 'Taux de présence', val: drillData.kpis.taux_presence },
              { label: 'Productivité', val: drillData.kpis.productivite },
              { label: 'Eff. Commerciale', val: drillData.kpis.efficacite_comm },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--light)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{k.val}%</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={drillData.chartItems}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.1)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
              <Line type="monotone" dataKey="conv" stroke="#C9A84C" strokeWidth={2} dot={{ r: 3 }} name="Conv. Tél." />
              <Line type="monotone" dataKey="presence" stroke="#4CAF7D" strokeWidth={2} dot={{ r: 3 }} name="Présence" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <SectionTitle>KPIs Globaux — Équipe</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Productivité" value={kpisGlobal.productivite} sub="Échanges / Leads nets" badge={`Leads nets: ${kpisGlobal.leads_nets}`} />
        <KpiCard label="Joignabilité (indispos)" value={kpisGlobal.joignabilite} sub="Indispos / Leads bruts" badge={`${kpisGlobal.indispos} indispos`} />
        <KpiCard label="Conv. Téléphonique" value={kpisGlobal.conversion_tel} sub="RDV / Échanges" badge={`CV: ${cvConvTel}%`} />
        <KpiCard label="Taux de Présence" value={kpisGlobal.taux_presence} sub="Visites / RDV" badge={`CV: ${cvPresence}%`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Efficacité Commerciale" value={kpisGlobal.efficacite_comm} sub="Ventes / Visites" badge={`CV: ${cvEfficacite}%`} />
        <KpiCard label="Total RDV" value={kpisGlobal.rdv} unit="" sub="Période sélectionnée" />
        <KpiCard label="Total Visites" value={kpisGlobal.visites} unit="" sub="Période sélectionnée" />
        <KpiCard label="Total Ventes" value={kpisGlobal.ventes} unit="" sub="Période sélectionnée" />
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

      <SectionTitle>Ranking Conseillères</SectionTitle>
      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Étoiles', 'Conseillère', 'Leads Bruts', 'Leads Nets', 'Productivité', 'Joignabilité', 'Conv. Tél.', 'Présence', 'Eff. Comm.', 'Détail'].map(h => (
                <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rankingSorted.map((c, i) => {
              const rankColor = getRankColor(i, rankingSorted.length)
              const stars = getStars(i, rankingSorted.length)
              return (
                <tr key={c.id}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 10px', fontSize: 18, fontWeight: 700, color: rankColor, fontFamily: 'DM Sans, sans-serif' }}>{i + 1}</td>
                  <td style={{ padding: '12px 10px', fontSize: 13, color: '#C9A84C', letterSpacing: 1 }}>{stars}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 500, fontSize: 13, color: rankColor }}>{c.nom}</td>
                  <td style={{ padding: '12px 10px', fontSize: 13 }}>{c.leads_bruts}</td>
                  <td style={{ padding: '12px 10px', fontSize: 13 }}>{c.leads_nets}</td>
                  <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 500, color: rankColor }}>{c.productivite}%</td>
                  <td style={{ padding: '12px 10px', fontSize: 13, color: c.joignabilite > 30 ? '#E05C5C' : '#4CAF7D' }}>{c.joignabilite}%</td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(201,168,76,0.1)', borderRadius: 3, overflow: 'hidden', minWidth: 50 }}>
                        <div style={{ height: '100%', width: `${Math.min(c.conversion_tel, 100)}%`, background: rankColor, borderRadius: 3 }}></div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, minWidth: 38, color: rankColor }}>{c.conversion_tel}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: 13 }}>{c.taux_presence}%</td>
                  <td style={{ padding: '12px 10px', fontSize: 13 }}>{c.efficacite_comm}%</td>
                  <td style={{ padding: '12px 10px' }}>
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
        {rankingSorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#5A5A5A', fontSize: 13 }}>
            Aucune donnée pour cette période.<br />
            <a href="/saisie" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 500 }}>→ Saisir des données</a>
          </div>
        )}
      </div>
    </div>
  )
}
