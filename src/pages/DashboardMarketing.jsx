import React, { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import PeriodeFilter from '../components/PeriodeFilter'
import SectionTitle from '../components/SectionTitle'
import { filtrerParPeriode, groupByMonth, groupByWeek } from '../lib/dates'
import { agregerParPeriode } from '../lib/kpi'

export default function DashboardMarketing({ conseilleres, saisies }) {
  const [periode, setPeriode] = useState('mois')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  function handleDateChange(type, val) {
    if (type === 'debut') setDateDebut(val)
    else setDateFin(val)
  }

  const saisiesFiltrees = useMemo(() =>
    filtrerParPeriode(saisies, periode, dateDebut, dateFin),
    [saisies, periode, dateDebut, dateFin]
  )

  const kpisGlobal = useMemo(() => agregerParPeriode(saisiesFiltrees), [saisiesFiltrees])

  const evolutionData = useMemo(() => {
    const groups = periode === 'jour' || periode === 'semaine'
      ? groupByWeek(saisiesFiltrees)
      : groupByMonth(saisiesFiltrees)

    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      const base = agg.leads_bruts || 1
      return {
        label: key.substring(5),
        leads: agg.leads_bruts,
        indispos_pct: parseFloat(((agg.indispos / base) * 100).toFixed(1)),
        conv_finale: parseFloat(((agg.ventes / base) * 100).toFixed(1)),
      }
    })
  }, [saisiesFiltrees, periode])

  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }

  const qualiteLeads = kpisGlobal.leads_bruts > 0
    ? (100 - ((kpisGlobal.indispos / kpisGlobal.leads_bruts) * 100)).toFixed(1)
    : 0

  return (
    <div>
      <PageHeader title="Performance Marketing" subtitle="Qualité des leads par date d'injection">
        <PeriodeFilter value={periode} onChange={setPeriode} dateDebut={dateDebut} dateFin={dateFin} onDateChange={handleDateChange} />
      </PageHeader>

      <SectionTitle>Vue d'ensemble</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total leads injectés', value: kpisGlobal.leads_bruts, unit: '', color: '#C9A84C' },
          { label: 'Qualité leads', value: qualiteLeads, unit: '%', color: '#4CAF7D', sub: 'Leads joignables' },
          { label: 'Taux indispos', value: kpisGlobal.joignabilite, unit: '%', color: '#E05C5C', sub: 'Leads injoignables' },
          { label: 'Conv. finale leads', value: kpisGlobal.leads_bruts > 0 ? ((kpisGlobal.ventes / kpisGlobal.leads_bruts) * 100).toFixed(1) : 0, unit: '%', color: '#534AB7', sub: 'Ventes / Leads bruts' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid rgba(201,168,76,0.15)', borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 30, fontWeight: 600, color: '#2C2C2C' }}>{k.value}{k.unit}</div>
            {k.sub && <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Volume leads injectés</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="leads" fill="#C9A84C" radius={[4,4,0,0]} name="Leads injectés" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Taux d'indispos vs Conv. finale</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
              <Bar dataKey="indispos_pct" fill="#E05C5C" radius={[4,4,0,0]} name="% Indispos" />
              <Bar dataKey="conv_finale" fill="#534AB7" radius={[4,4,0,0]} name="Conv. finale" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5A5A5A' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#E05C5C', display: 'inline-block' }}></span>% Indispos
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5A5A5A' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#534AB7', display: 'inline-block' }}></span>Conv. finale
            </span>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Note sur l'analyse marketing</div>
        <p style={{ fontSize: 13, color: '#5A5A5A', lineHeight: 1.6 }}>
          Ce dashboard mesure la qualité des leads selon leur date d'injection. Un fort taux d'indispos sur une période indique une campagne de faible qualité. La conversion finale (ventes / leads injectés) est l'indicateur clé pour décider de scaler ou d'arrêter une campagne. L'analyse par source de campagne est gérée directement dans Odoo.
        </p>
      </div>
    </div>
  )
}
