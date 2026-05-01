import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts'

const FUNNEL_MOIS = [
  { mois: 'Jan', injections: 3023, non_expl: 1019, non_expl_pct: 33.7, indispos: 698, indispos_pct: 23.1, base_nette: 1306, suivis: 605, suivis_pct: 46.3, rdv: 372, rdv_pct: 28.5, visites: 279, visites_pct: 21.4, ventes: 21, ventes_pct: 1.6 },
  { mois: 'Fev', injections: 3559, non_expl: 796, non_expl_pct: 22.4, indispos: 484, indispos_pct: 13.6, base_nette: 2279, suivis: 515, suivis_pct: 22.6, rdv: 464, rdv_pct: 20.4, visites: 149, visites_pct: 6.5, ventes: 8, ventes_pct: 0.4 },
  { mois: 'Mar', injections: 5046, non_expl: 1935, non_expl_pct: 38.3, indispos: 476, indispos_pct: 9.4, base_nette: 2635, suivis: 699, suivis_pct: 26.5, rdv: 522, rdv_pct: 19.8, visites: 209, visites_pct: 7.9, ventes: 13, ventes_pct: 0.5 },
  { mois: 'Avr', injections: 5346, non_expl: 945, non_expl_pct: 17.7, indispos: 1175, indispos_pct: 22.0, base_nette: 3226, suivis: 560, suivis_pct: 17.4, rdv: 701, rdv_pct: 21.7, visites: 118, visites_pct: 3.7, ventes: 20, ventes_pct: 0.6 },
]

const RDV_MOIS = [
  { mois: 'Jan', total: 1055 },
  { mois: 'Fev', total: 592 },
  { mois: 'Mar', total: 1201 },
  { mois: 'Avr', total: 1434 },
]

const PERF_SALE = [
  { nom: 'Saad Fellah', rdv: 318, visites: 72, ventes: 6, tv: 8.3 },
  { nom: 'Abdelhak L.', rdv: 183, visites: 69, ventes: 4, tv: 5.8 },
  { nom: 'Nouhaila Belhadj', rdv: 212, visites: 54, ventes: 8, tv: 14.8 },
  { nom: 'Yasmina Souaq', rdv: 99, visites: 17, ventes: 0, tv: 0 },
  { nom: 'Khalid Amghoud', rdv: 111, visites: 21, ventes: 7, tv: 33.3 },
  { nom: 'Najlaa Maarouf', rdv: 65, visites: 14, ventes: 2, tv: 14.3 },
]

const PERF_KENITRA = [
  { nom: 'Alae Elmoussaid', rdv: 31, visites: 15, ventes: 0, tv: 0 },
  { nom: 'Ismail Hammouch', rdv: 97, visites: 9, ventes: 1, tv: 11.1 },
  { nom: 'Meryem Elbouchikhi', rdv: 54, visites: 15, ventes: 1, tv: 6.7 },
  { nom: 'Oumaima Belbacha', rdv: 94, visites: 11, ventes: 0, tv: 0 },
  { nom: 'Samia Ahalay', rdv: 23, visites: 6, ventes: 2, tv: 33.3 },
  { nom: 'Nawfal Jdia', rdv: 30, visites: 7, ventes: 0, tv: 0 },
]

const EFF_COMM = [
  { conseillere: 'Rajaa', jan: 4.1, fev: 2.1, mar: 3.4, avr: 9.6 },
  { conseillere: 'Hala', jan: 16.1, fev: 10.5, mar: 3.7, avr: 18.8 },
  { conseillere: 'Ghizlane', jan: 10.6, fev: 0, mar: 4.3, avr: 9.1 },
  { conseillere: 'Siham', jan: 29.8, fev: 9.1, mar: 2.6, avr: 12.9 },
  { conseillere: 'Kaoutar', jan: null, fev: 5.6, mar: 10.8, avr: 7.1 },
  { conseillere: 'Fatima', jan: 4.0, fev: 0, mar: 1.2, avr: 1.8 },
]

const CV_REGULARITE = [
  { nom: 'Khalid', tv: 33.3, cv: 167.9, tier: 'regulier' },
  { nom: 'Nouhaila', tv: 14.8, cv: 189.5, tier: 'regulier' },
  { nom: 'Saad', tv: 8.3, cv: 220.6, tier: 'variable' },
  { nom: 'Abdelhak', tv: 5.8, cv: 222.3, tier: 'variable' },
  { nom: 'Samia (K)', tv: 33.3, cv: 249.4, tier: 'variable' },
  { nom: 'Najlaa', tv: 14.3, cv: 320.2, tier: 'tres_variable' },
  { nom: 'Meryem (K)', tv: 6.7, cv: 458.3, tier: 'tres_variable' },
  { nom: 'Ismail (K)', tv: 11.1, cv: 469, tier: 'tres_variable' },
]

const SEGMENTATION = {
  sale: {
    seuils: 'Tier 1 >= 12% · Tier 2 5-11.9% · Tier 3 < 5%',
    tiers: [
      { tier: 1, nom: 'Khalid Amghoud', tv: 17, delai: '1j' },
      { tier: 1, nom: 'Najlaa Maarouf', tv: 14.3, delai: '2j' },
      { tier: 2, nom: 'Saad Fellah', tv: 8.7, delai: '5j' },
      { tier: 2, nom: 'Nouhaila Belhadj', tv: 8, delai: '1j' },
      { tier: 2, nom: 'Abdelhak L.', tv: 6.2, delai: '2.5j' },
      { tier: 3, nom: 'Yasmina Souaq', tv: 1.4, delai: '5j' },
    ]
  },
  kenitra: {
    seuils: 'Tier 1 >= 15% · Tier 2 5-14.9% · Tier 3 < 5%',
    tiers: [
      { tier: 1, nom: 'Samia Ahalay', tv: 36.4, delai: '10j', warn: true },
      { tier: 1, nom: 'Nissrine Irfden', tv: 22.2, delai: '11.5j', warn: true },
      { tier: 1, nom: 'Ismail Hammouch', tv: 16.7, delai: '2j' },
      { tier: 2, nom: 'Alae Elmoussaid', tv: 5.9, delai: '2j' },
      { tier: 3, nom: 'Meryem E.', tv: 2.7, delai: '1j' },
      { tier: 3, nom: 'Autres (10)', tv: 0, delai: '-' },
    ]
  }
}

const COHORTE = [
  { nom: 'Khalid', tv: 17, vtes: 8, moy: 10.1, med: 1, j3: 5, j14: 3 },
  { nom: 'Najlaa', tv: 14.3, vtes: 2, moy: 2, med: 2, j3: 2, j14: 0 },
  { nom: 'Nouhaila', tv: 8, vtes: 8, moy: 1.5, med: 1, j3: 7, j14: 0 },
  { nom: 'Saad', tv: 8.7, vtes: 9, moy: 3.8, med: 5, j3: 4, j14: 0 },
  { nom: 'Abdelhak', tv: 6.2, vtes: 4, moy: 2, med: 2.5, j3: 4, j14: 0 },
  { nom: 'Samia (K)', tv: 36.4, vtes: 4, moy: 10, med: 10, j3: 1, j14: 1 },
  { nom: 'Nissrine (K)', tv: 22.2, vtes: 2, moy: 11.5, med: 11.5, j3: 1, j14: 1 },
  { nom: 'Ismail (K)', tv: 16.7, vtes: 3, moy: 2.7, med: 2, j3: 2, j14: 0 },
  { nom: 'Alae (K)', tv: 5.9, vtes: 2, moy: 2, med: 2, j3: 2, j14: 0 },
]

const MESSAGES_CLES = [
  { icon: 'up', color: '#4CAF7D', titre: 'Avril : meilleur mois', texte: '31 ventes operationnelles · TV% 9.0% · +108% vs Fev' },
  { icon: 'star', color: '#C9A84C', titre: 'Sale domine', texte: '27/31 ventes · TV% 10.9% vs 4.3% Kenitra · Khalid #1 (33.3%)' },
  { icon: 'alert', color: '#E05C5C', titre: 'Funnel : tension amont', texte: 'Indispos avril +132% vs mars · Base nette +22% · Volume injections en hausse' },
  { icon: 'time', color: '#534AB7', titre: 'Delais courts = meilleures ventes', texte: '72.7% des ventes realisees en <=3j · Mediane globale = 2j' },
  { icon: 'warn', color: '#E8A040', titre: 'Kenitra : potentiel a activer', texte: 'Samia 36.4% TV% · Nissrine 22.2% · mais delais >10j a corriger' },
  { icon: 'cv', color: '#8A8A7A', titre: 'Regularite a ameliorer', texte: 'CV JJ > 300% pour Najlaa, Ismail, Meryem · pics isoles, pas de rythme stable' },
]

const S = {
  section: { marginBottom: 48 },
  h2: { fontSize: 18, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 },
  sub: { fontSize: 12, color: '#8A8A7A', marginBottom: 20 },
  card: { background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, padding: '20px 24px' },
  kpiCard: { background: '#F8F7F4', border: '1px solid #E8E6DF', borderRadius: 10, padding: '14px 18px', textAlign: 'center' },
  kpiVal: { fontSize: 26, fontWeight: 700, color: '#2C2C2C', lineHeight: 1.1 },
  kpiLabel: { fontSize: 11, color: '#8A8A7A', marginTop: 3 },
  th: { fontSize: 11, color: '#8A8A7A', fontWeight: 500, padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid #E8E6DF', background: '#F8F7F4' },
  td: { fontSize: 13, color: '#2C2C2C', padding: '8px 12px', borderBottom: '1px solid #F0EEE9' },
}

function TierBadge({ tier }) {
  const cfg = { 1: ['#4CAF7D', '#E6F7EF'], 2: ['#C9A84C', '#FDF6E3'], 3: ['#E05C5C', '#FEF0F0'] }
  const [color, bg] = cfg[tier] || ['#8A8A7A', '#F8F7F4']
  return (
    <span style={{ background: bg, color, border: '1px solid ' + color + '33', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      T{tier}
    </span>
  )
}

function CvBadge({ cv }) {
  const color = cv <= 200 ? '#4CAF7D' : cv <= 300 ? '#E8A040' : '#E05C5C'
  return <span style={{ color, fontWeight: 600 }}>{cv}%</span>
}

const SLIDES = [
  { id: 'funnel', label: 'Funnel Marketing' },
  { id: 'flux', label: 'Flux RDV' },
  { id: 'perf', label: 'Perf. Avril' },
  { id: 'efficacite', label: 'Eff. Conseilleres' },
  { id: 'cv', label: 'CV Regularite' },
  { id: 'segmentation', label: 'Segmentation' },
  { id: 'cohorte', label: 'Cohorte Delais' },
  { id: 'synthese', label: 'Synthese' },
]

export default function EtudeCommerciale2026() {
  const navigate = useNavigate()
  const [active, setActive] = useState('funnel')

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <button onClick={() => navigate('/etudes')} style={{ background: 'none', border: 'none', color: '#8A8A7A', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            &larr; Retour aux etudes
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Etude Commerciale 2026</h1>
          <div style={{ fontSize: 13, color: '#8A8A7A', marginTop: 4 }}>Janvier - Avril 2026 · Sale + Kenitra · Lecture seule</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[{v: 31, l: 'Ventes Avr'}, {v: '4', l: 'Mois'}, {v: '2', l: 'Equipes'}].map(k => (
            <div key={k.l} style={S.kpiCard}><div style={S.kpiVal}>{k.v}</div><div style={S.kpiLabel}>{k.l}</div></div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
        {SLIDES.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            padding: '7px 16px', borderRadius: 20,
            border: '1px solid ' + (active === s.id ? '#C9A84C' : '#E8E6DF'),
            background: active === s.id ? '#C9A84C' : '#fff',
            color: active === s.id ? '#fff' : '#5A5A5A',
            fontSize: 12, fontWeight: active === s.id ? 500 : 400, cursor: 'pointer',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {active === 'funnel' && (
        <div style={S.section}>
          <div style={S.h2}>Funnel Marketing - Evolution 2026</div>
          <div style={S.sub}>Cohorte par date d injection · Jan - Avr 2026</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {FUNNEL_MOIS.map(m => (
              <div key={m.mois} style={{ ...S.card, borderTop: '3px solid #C9A84C' }}>
                <div style={{ fontWeight: 600, color: '#C9A84C', marginBottom: 10 }}>{m.mois} 2026</div>
                {[
                  ['Injections', m.injections, null, false],
                  ['Non Explo.', m.non_expl, m.non_expl_pct, false],
                  ['Indispos', m.indispos, m.indispos_pct, false],
                  ['Base nette', m.base_nette, null, true],
                  ['Suivis', m.suivis, m.suivis_pct, false],
                  ['RDV', m.rdv, m.rdv_pct, false],
                  ['Visites', m.visites, m.visites_pct, false],
                  ['Ventes', m.ventes, m.ventes_pct, false],
                ].map(function(row) {
                  var label = row[0], val = row[1], pct = row[2], bold = row[3]
                  return (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #F0EEE9' }}>
                      <span style={{ fontSize: 12, color: bold ? '#2C2C2C' : '#5A5A5A', fontWeight: bold ? 600 : 400 }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: bold ? 700 : 500, color: '#2C2C2C' }}>
                        {val.toLocaleString('fr-FR')}{pct ? ' (' + pct + '%)' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 14 }}>Injections vs Base nette vs RDV vs Ventes</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={FUNNEL_MOIS} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="injections" name="Injections" fill="#E8D5A3" radius={[4,4,0,0]} />
                <Bar dataKey="base_nette" name="Base nette" fill="#C9A84C" radius={[4,4,0,0]} />
                <Bar dataKey="rdv" name="RDV" fill="#4CAF7D" radius={[4,4,0,0]} />
                <Bar dataKey="ventes" name="Ventes" fill="#534AB7" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...S.card, marginTop: 14, background: '#F8F7F4' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#5A5A5A', marginBottom: 8 }}>CV Avril (JJ)</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[['Non Expl.', 63.8], ['Indispos', 34.0], ['Suivis', 64.5], ['RDV', 55.5], ['Visites', 101.5], ['Ventes', 251.7]].map(function(row) {
                var l = row[0], v = row[1]
                return (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: v > 100 ? '#E05C5C' : v > 60 ? '#E8A040' : '#4CAF7D' }}>{v}%</div>
                    <div style={{ fontSize: 11, color: '#8A8A7A' }}>{l}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {active === 'flux' && (
        <div style={S.section}>
          <div style={S.h2}>Flux RDV - Distribution par commercial 2026</div>
          <div style={S.sub}>RDV recus par mois · Equipe Sale et Kenitra</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[{l: 'Total RDV Jan', v: '1 055'}, {l: 'Total RDV Fev', v: '592'}, {l: 'Total RDV Mar', v: '1 201'}, {l: 'Total RDV Avr', v: '1 434'}].map(k => (
              <div key={k.l} style={S.kpiCard}><div style={S.kpiVal}>{k.v}</div><div style={S.kpiLabel}>{k.l}</div></div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {[{l: 'Sale Avr', v: '988', color: '#C9A84C'}, {l: 'Kenitra Avr', v: '446', color: '#534AB7'}].map(k => (
              <div key={k.l} style={{ ...S.kpiCard, borderTop: '3px solid ' + k.color }}>
                <div style={{ ...S.kpiVal, color: k.color }}>{k.v}</div><div style={S.kpiLabel}>{k.l}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Evolution RDV mensuels</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={RDV_MOIS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 12 }} />
                <Bar dataKey="total" name="Total RDV" radius={[4,4,0,0]}>
                  {RDV_MOIS.map(function(entry, i) { return <Cell key={i} fill={i === 3 ? '#C9A84C' : '#E8D5A3'} /> })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {active === 'perf' && (
        <div style={S.section}>
          <div style={S.h2}>Flux RDV et Performance · Avril 2026</div>
          <div style={S.sub}>Visites et ventes par commercial</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[{l: 'Total Visites', v: 345}, {l: 'Total Ventes', v: 31}, {l: 'TV% Global', v: '9.0%'}, {l: 'Sale 27/31', v: '87%'}].map(k => (
              <div key={k.l} style={S.kpiCard}><div style={S.kpiVal}>{k.v}</div><div style={S.kpiLabel}>{k.l}</div></div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[{ label: 'Equipe Sale', data: PERF_SALE, color: '#C9A84C', tvg: '10.9%' }, { label: 'Equipe Kenitra', data: PERF_KENITRA, color: '#534AB7', tvg: '4.3%' }].map(eq => (
              <div key={eq.label} style={{ ...S.card, borderTop: '3px solid ' + eq.color }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, color: eq.color, fontSize: 14 }}>{eq.label}</span>
                  <span style={{ fontSize: 12, color: '#8A8A7A' }}>TV% : <strong style={{ color: eq.color }}>{eq.tvg}</strong></span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Commercial','RDV','Visites','Ventes','TV%'].map(h => <th key={h} style={{ ...S.th, textAlign: h === 'Commercial' ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {eq.data.map(c => (
                      <tr key={c.nom}>
                        <td style={S.td}>{c.nom}</td>
                        <td style={{ ...S.td, textAlign: 'right', color: '#8A8A7A' }}>{c.rdv}</td>
                        <td style={{ ...S.td, textAlign: 'right' }}>{c.visites}</td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: c.ventes > 0 ? 600 : 400, color: c.ventes > 0 ? '#4CAF7D' : '#8A8A7A' }}>{c.ventes}</td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: c.tv >= 15 ? '#4CAF7D' : c.tv >= 5 ? '#C9A84C' : '#E05C5C' }}>{c.tv}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div style={{ ...S.card, marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>TV% par commercial</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[...PERF_SALE, ...PERF_KENITRA].filter(c => c.tv > 0)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} domain={[0, 40]} unit="%" />
                <YAxis type="category" dataKey="nom" tick={{ fontSize: 11, fill: '#2C2C2C' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip formatter={v => v + '%'} contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 12 }} />
                <ReferenceLine x={10} stroke="#C9A84C" strokeDasharray="4 2" />
                <Bar dataKey="tv" name="TV%" radius={[0,4,4,0]}>
                  {[...PERF_SALE, ...PERF_KENITRA].filter(c => c.tv > 0).map((c, i) => (
                    <Cell key={i} fill={c.tv >= 15 ? '#4CAF7D' : c.tv >= 5 ? '#C9A84C' : '#E05C5C'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {active === 'efficacite' && (
        <div style={S.section}>
          <div style={S.h2}>Efficacite commerciale par conseillere · 2026</div>
          <div style={S.sub}>Taux Ventes / Visites par mois</div>
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>Conseillere</th>
                  {['Jan','Fev','Mar','Avr'].map(m => <th key={m} style={{ ...S.th, textAlign: 'center' }}>{m}</th>)}
                  <th style={{ ...S.th, textAlign: 'center' }}>Tendance</th>
                </tr>
              </thead>
              <tbody>
                {EFF_COMM.map(c => {
                  const trend = (c.avr || 0) > (c.mar || 0) ? 'up' : (c.avr || 0) < (c.mar || 0) ? 'down' : 'flat'
                  const tc = trend === 'up' ? '#4CAF7D' : trend === 'down' ? '#E05C5C' : '#8A8A7A'
                  return (
                    <tr key={c.conseillere}>
                      <td style={{ ...S.td, fontWeight: 500 }}>{c.conseillere}</td>
                      {[c.jan, c.fev, c.mar, c.avr].map((v, i) => (
                        <td key={i} style={{ ...S.td, textAlign: 'center', fontWeight: 500, color: v === null ? '#D0CEC7' : v >= 10 ? '#4CAF7D' : v >= 3 ? '#C9A84C' : '#E05C5C' }}>
                          {v === null ? '-' : v + '%'}
                        </td>
                      ))}
                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: tc, fontSize: 16 }}>
                        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ ...S.card, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Evolution mensuelle</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={['Jan','Fev','Mar','Avr'].map((m, mi) => {
                const obj = { mois: m }
                EFF_COMM.forEach(c => { obj[c.conseillere] = [c.jan, c.fev, c.mar, c.avr][mi] })
                return obj
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={v => v ? v + '%' : '-'} contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {EFF_COMM.map((c, i) => (
                  <Line key={c.conseillere} type="monotone" dataKey={c.conseillere} stroke={['#C9A84C','#4CAF7D','#534AB7','#E05C5C','#E8A040','#8A8A7A'][i]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {active === 'cv' && (
        <div style={S.section}>
          <div style={S.h2}>CV Taux de vente - Regularite · Avril 2026 JJ</div>
          <div style={S.sub}>Coefficient de variation du taux journalier</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[{l: '<= 200%', label: 'Regulier', color: '#4CAF7D', bg: '#E6F7EF'}, {l: '200-300%', label: 'Variable', color: '#E8A040', bg: '#FDF6E3'}, {l: '> 300%', label: 'Tres variable', color: '#E05C5C', bg: '#FEF0F0'}].map(t => (
              <div key={t.l} style={{ background: t.bg, border: '1px solid ' + t.color + '33', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.color }}>{t.l}</div>
                <div style={{ fontSize: 12, color: t.color }}>{t.label}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Commercial','TV%','CV%','Profil'].map(h => <th key={h} style={{ ...S.th, textAlign: h === 'Commercial' ? 'left' : 'center' }}>{h}</th>)}</tr></thead>
              <tbody>
                {CV_REGULARITE.map(c => (
                  <tr key={c.nom}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{c.nom}</td>
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: 600, color: c.tv >= 15 ? '#4CAF7D' : '#C9A84C' }}>{c.tv}%</td>
                    <td style={{ ...S.td, textAlign: 'center' }}><CvBadge cv={c.cv} /></td>
                    <td style={{ ...S.td, textAlign: 'center', fontSize: 12, color: c.tier === 'regulier' ? '#4CAF7D' : c.tier === 'variable' ? '#E8A040' : '#E05C5C' }}>
                      {c.tier === 'regulier' ? 'Regulier' : c.tier === 'variable' ? 'Variable' : 'Tres variable'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...S.card, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>CV% par commercial (barres colorees par profil)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={CV_REGULARITE}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="nom" tick={{ fontSize: 11, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => v + '%'} contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 12 }} />
                <ReferenceLine y={200} stroke="#E8A040" strokeDasharray="4 2" />
                <ReferenceLine y={300} stroke="#E05C5C" strokeDasharray="4 2" />
                <Bar dataKey="cv" name="CV%" radius={[4,4,0,0]}>
                  {CV_REGULARITE.map((c, i) => <Cell key={i} fill={c.tier === 'regulier' ? '#4CAF7D' : c.tier === 'variable' ? '#E8A040' : '#E05C5C'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {active === 'segmentation' && (
        <div style={S.section}>
          <div style={S.h2}>Segmentation Commerciaux - 3 Tiers · Fev+Mar+Avr</div>
          <div style={S.sub}>TV% visites vers ventes · ajuste par delai median · par equipe</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[{ key: 'sale', label: 'Equipe Sale', color: '#C9A84C' }, { key: 'kenitra', label: 'Equipe Kenitra', color: '#534AB7' }].map(eq => (
              <div key={eq.key} style={{ ...S.card, borderTop: '3px solid ' + eq.color }}>
                <div style={{ fontWeight: 600, color: eq.color, marginBottom: 4 }}>{eq.label}</div>
                <div style={{ fontSize: 11, color: '#8A8A7A', marginBottom: 14 }}>{SEGMENTATION[eq.key].seuils}</div>
                {SEGMENTATION[eq.key].tiers.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F0EEE9' }}>
                    <TierBadge tier={t.tier} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {t.nom} {t.warn && <span style={{ color: '#E8A040', fontSize: 11 }}>delai!</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#8A8A7A' }}>Delai med. {t.delai}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: t.tier === 1 ? '#4CAF7D' : t.tier === 2 ? '#C9A84C' : '#E05C5C' }}>{t.tv}%</div>
                    <div style={{ width: 70, height: 6, background: '#F0EEE9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: Math.min(100, (t.tv / 40) * 100) + '%', height: '100%', background: t.tier === 1 ? '#4CAF7D' : t.tier === 2 ? '#C9A84C' : '#E05C5C', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {active === 'cohorte' && (
        <div style={S.section}>
          <div style={S.h2}>Analyse Cohorte - Delais Visite vers Vente · Fev+Mar+Avr</div>
          <div style={S.sub}>Source : Odoo · Jan exclu · 44 ventes analysees sur 45</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[{l: 'Ventes analysees', v: '44/45'}, {l: 'Delai moyen global', v: '5.0j'}, {l: 'Mediane globale', v: '2j'}, {l: 'Ventes <= 3j', v: '72.7%'}].map(k => (
              <div key={k.l} style={S.kpiCard}><div style={{ ...S.kpiVal, fontSize: 20 }}>{k.v}</div><div style={S.kpiLabel}>{k.l}</div></div>
            ))}
          </div>
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Commercial','TV%','Ventes','Moy.','Med.','<=3j','>14j'].map(h => <th key={h} style={{ ...S.th, textAlign: h === 'Commercial' ? 'left' : 'center' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {COHORTE.map(c => (
                  <tr key={c.nom}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{c.nom}</td>
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: 600, color: c.tv >= 15 ? '#4CAF7D' : '#C9A84C' }}>{c.tv}%</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{c.vtes}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: c.moy > 7 ? '#E05C5C' : '#2C2C2C' }}>{c.moy}j</td>
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: 600 }}>{c.med}j</td>
                    <td style={{ ...S.td, textAlign: 'center', color: '#4CAF7D', fontWeight: 500 }}>{c.j3}</td>
                    <td style={{ ...S.td, textAlign: 'center', color: c.j14 > 0 ? '#E05C5C' : '#8A8A7A' }}>{c.j14}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...S.card, marginTop: 14, background: '#FEF8ED', borderLeft: '3px solid #E8A040', fontSize: 12, color: '#5A5A5A' }}>
            Flux entrant (CC) : 27% des ventes analysees - delai moyen 2.2j vs 6.0j flux sortant
          </div>
        </div>
      )}

      {active === 'synthese' && (
        <div style={S.section}>
          <div style={S.h2}>Synthese et Messages Cles · 2026</div>
          <div style={S.sub}>Avril 2026 · JG Groupe</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {MESSAGES_CLES.map((m, i) => (
              <div key={i} style={{ ...S.card, borderLeft: '4px solid ' + m.color, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, color: m.color, fontSize: 13 }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#2C2C2C', fontSize: 14, marginBottom: 4 }}>{m.titre}</div>
                  <div style={{ fontSize: 12, color: '#5A5A5A', lineHeight: 1.7 }}>{m.texte}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
