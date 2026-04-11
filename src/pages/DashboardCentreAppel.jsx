import React, { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import PageHeader from '../components/PageHeader'
import PeriodeFilter from '../components/PeriodeFilter'
import ConseillereFilter from '../components/ConseillereFilter'
import KpiCard from '../components/KpiCard'
import SectionTitle from '../components/SectionTitle'
import { filtrerParPeriode, groupByDay, groupByWeek, groupByMonth } from '../lib/dates'
import { agregerParPeriode, calcCV, calcConversionTel, calcTauxPresence, calcEfficaciteComm, couleurPerf } from '../lib/kpi'

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

  const kpisParConseillere = useMemo(() => {
    return conseilleres.map(c => {
      const k = agregerParPeriode(saisiesFiltrees, c.id)
      return { ...c, ...k }
    })
  }, [conseilleres, saisiesFiltrees])

  const cvConvTel = useMemo(() => calcCV(kpisParConseillere.map(c => c.conversion_tel)), [kpisParConseillere])
  const cvPresence = useMemo(() => calcCV(kpisParConseillere.map(c => c.taux_presence)), [kpisParConseillere])
  const cvEfficacite = useMemo(() => calcCV(kpisParConseillere.map(c => c.efficacite_comm)), [kpisParConseillere])

  const chartData = useMemo(() => {
    let groups
    if (periode === 'jour') groups = groupByDay(saisiesFiltrees)
    else if (periode === 'semaine' || periode === 'mois') groups = groupByWeek(saisiesFiltrees)
    else groups = groupByMonth(saisiesFiltrees)

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      return {
        label: key.substring(5),
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
    const data = saisies.filter(s => s.conseillere_id === drillConseillere)
    const filtered = filtrerParPeriode(data, periode, dateDebut, dateFin)
    const groups = groupByDay(filtered)
    const chartItems = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      return { label: key.substring(5), conv: agg.conversion_tel, presence: agg.taux_presence }
    })
    return { conseillere: c, kpis: agregerParPeriode(filtered), chartItems }
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
        <div style={{ ...cardStyle, borderColor: '#C9A84C', marginBottom: 24 }}>
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
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 600 }}>{k.val}%</div>
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
        <KpiCard label="Joignabilité (indispos)" value={kpisGlobal.joignabilite} sub="Indispos / Leads bruts" accentColor="#E05C5C" badgeType="down" badge={`${kpisGlobal.indispos} indispos`} />
        <KpiCard label="Conv. Téléphonique" value={kpisGlobal.conversion_tel} sub="RDV / Échanges" badge={`CV: ${cvConvTel}%`} badgeType="neutral" accentColor="#4CAF7D" />
        <KpiCard label="Taux de Présence" value={kpisGlobal.taux_presence} sub="Visites / RDV" badge={`CV: ${cvPresence}%`} badgeType="neutral" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Efficacité Commerciale" value={kpisGlobal.efficacite_comm} sub="Ventes / Visites" badge={`CV: ${cvEfficacite}%`} badgeType="up" accentColor="#4CAF7D" />
        <KpiCard label="Total RDV" value={kpisGlobal.rdv} unit="" sub="Période sélectionnée" />
        <KpiCard label="Total Ventes" value={kpisGlobal.ventes} unit="" sub="Période sélectionnée" accentColor="#C9A84C" />
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
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
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
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
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
              {['#', 'Conseillère', 'Leads Bruts', 'Leads Nets', 'Productivité', 'Joignabilité', 'Conv. Tél.', 'Présence', 'Eff. Comm.', 'Détail'].map(h => (
                <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rankingSorted.map((c, i) => {
              const obj = c.objectif_conv || 65
              const convColor = couleurPerf(c.conversion_tel, obj)
              return (
                <tr key={c.id} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 10px', fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#C9A84C' }}>{i + 1}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 500, fontSize: 13 }}>{c.nom}</td>
                  <td style={{ padding: '12px 10px', fontSize: 13 }}>{c.leads_bruts}</td>
                  <td style={{ padding: '12px 10px', fontSize: 13 }}>{c.leads_nets}</td>
                  <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 500 }}>{c.productivite}%</td>
                  <td style={{ padding: '12px 10px', fontSize: 13, color: c.joignabilite > 30 ? '#E05C5C' : '#4CAF7D' }}>{c.joignabilite}%</td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(201,168,76,0.1)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                        <div style={{ height: '100%', width: `${Math.min(c.conversion_tel, 100)}%`, background: convColor, borderRadius: 3 }}></div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, minWidth: 38, color: convColor }}>{c.conversion_tel}%</span>
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
