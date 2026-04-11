import React, { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'
import ConseillereFilter from '../components/ConseillereFilter'
import { groupByMonth, groupByWeek } from '../lib/dates'
import { agregerParPeriode } from '../lib/kpi'

export default function Historique({ conseilleres, saisies }) {
  const [filtreConseillere, setFiltreConseillere] = useState('all')
  const [granularite, setGranularite] = useState('mois')

  const saisiesFiltrees = useMemo(() => {
    if (filtreConseillere === 'all') return saisies
    return saisies.filter(s => s.conseillere_id === filtreConseillere)
  }, [saisies, filtreConseillere])

  const historique = useMemo(() => {
    const groups = granularite === 'semaine'
      ? groupByWeek(saisiesFiltrees)
      : groupByMonth(saisiesFiltrees)

    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([key, items]) => {
      const agg = agregerParPeriode(items)
      return {
        label: granularite === 'semaine' ? `S ${key.substring(5)}` : key.substring(0, 7),
        productivite: agg.productivite,
        conv_tel: agg.conversion_tel,
        presence: agg.taux_presence,
        efficacite: agg.efficacite_comm,
        leads: agg.leads_bruts,
        ventes: agg.ventes,
      }
    })
  }, [saisiesFiltrees, granularite])

  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }

  return (
    <div>
      <PageHeader title="Historique & Comparaison" subtitle="Évolution des performances dans le temps">
        <ConseillereFilter conseilleres={conseilleres} value={filtreConseillere} onChange={setFiltreConseillere} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[['semaine','Semaine'],['mois','Mois']].map(([k,l]) => (
            <button key={k} onClick={() => setGranularite(k)} style={{
              padding: '7px 14px', borderRadius: 16,
              border: `1.5px solid ${granularite === k ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
              background: granularite === k ? '#F7F0DC' : '#fff',
              color: granularite === k ? '#C9A84C' : '#5A5A5A',
              fontSize: 12, cursor: 'pointer', fontWeight: granularite === k ? 500 : 400
            }}>{l}</button>
          ))}
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Conv. Téléphonique & Présence</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historique}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
              <Line type="monotone" dataKey="conv_tel" stroke="#C9A84C" strokeWidth={2} dot={{ r: 3 }} name="Conv. Tél." />
              <Line type="monotone" dataKey="presence" stroke="#4CAF7D" strokeWidth={2} dot={{ r: 3 }} name="Présence" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5A5A5A' }}>
              <span style={{ width: 10, height: 2, background: '#C9A84C', display: 'inline-block' }}></span>Conv. Tél.
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5A5A5A' }}>
              <span style={{ width: 10, height: 2, background: '#4CAF7D', display: 'inline-block' }}></span>Présence
            </span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Efficacité commerciale & Productivité</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historique}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
              <Line type="monotone" dataKey="efficacite" stroke="#534AB7" strokeWidth={2} dot={{ r: 3 }} name="Eff. Comm." />
              <Line type="monotone" dataKey="productivite" stroke="#378ADD" strokeWidth={2} dot={{ r: 3 }} name="Productivité" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <SectionTitle>Tableau historique détaillé</SectionTitle>
      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Période', 'Leads', 'Productivité', 'Conv. Tél.', 'Présence', 'Eff. Comm.', 'Ventes'].map(h => (
                <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...historique].reverse().map((row, i) => (
              <tr key={i}
                onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '11px 10px', fontWeight: 500, fontSize: 13 }}>{row.label}</td>
                <td style={{ padding: '11px 10px', fontSize: 13 }}>{row.leads}</td>
                <td style={{ padding: '11px 10px', fontSize: 13 }}>{row.productivite}%</td>
                <td style={{ padding: '11px 10px', fontSize: 13, color: '#C9A84C', fontWeight: 500 }}>{row.conv_tel}%</td>
                <td style={{ padding: '11px 10px', fontSize: 13, color: '#4CAF7D' }}>{row.presence}%</td>
                <td style={{ padding: '11px 10px', fontSize: 13, color: '#534AB7' }}>{row.efficacite}%</td>
                <td style={{ padding: '11px 10px', fontSize: 13, fontWeight: 500 }}>{row.ventes}</td>
              </tr>
            ))}
            {historique.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Pas encore de données historiques</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
