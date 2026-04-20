import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'

// ─── DrillNav ────────────────────────────────────────────────────────────────
const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function DrillNav({ data, onSelect, selected }) {
  const [expandedYear, setExpandedYear] = useState(null)
  const [expandedQ, setExpandedQ] = useState(null)
  const [expandedMonth, setExpandedMonth] = useState(null)

  const years = useMemo(() => {
    const s = new Set(data.map(r => new Date(r.date_debut).getFullYear()))
    return [...s].sort((a,b) => b-a)
  }, [data])

  const btnStyle = (active, color='#C9A84C') => ({
    padding: '4px 12px', borderRadius: 16, border: `1.5px solid ${active ? color : 'rgba(201,168,76,0.2)'}`,
    background: active ? color : 'transparent', color: active ? '#fff' : '#5A5A5A',
    fontSize: 11, cursor: 'pointer', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap'
  })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <button style={btnStyle(!selected || selected.type === 'global')} onClick={() => { onSelect({ type: 'global', label: 'Global' }); setExpandedYear(null); setExpandedQ(null); setExpandedMonth(null) }}>Global</button>
      {years.map(year => (
        <React.Fragment key={year}>
          <button style={btnStyle(selected?.type === 'year' && selected?.value === year)} onClick={() => { setExpandedYear(expandedYear === year ? null : year); setExpandedQ(null); setExpandedMonth(null); onSelect({ type: 'year', value: year, label: `${year}` }) }}>{year}</button>
          {expandedYear === year && [1,2,3,4].map(q => {
            const qKey = `${year}-Q${q}`
            return (
              <React.Fragment key={qKey}>
                <button style={btnStyle(selected?.type === 'quarter' && selected?.value === qKey, '#8a6a1a')} onClick={() => { setExpandedQ(expandedQ === qKey ? null : qKey); setExpandedMonth(null); onSelect({ type: 'quarter', value: qKey, label: `T${q} ${year}` }) }}>T{q}</button>
                {expandedQ === qKey && [0,1,2].map(mi => {
                  const m = (q-1)*3 + mi
                  const mKey = `${year}-${String(m+1).padStart(2,'0')}`
                  return (
                    <React.Fragment key={mKey}>
                      <button style={btnStyle(selected?.type === 'month' && selected?.value === mKey, '#4CAF7D')} onClick={() => { setExpandedMonth(expandedMonth === mKey ? null : mKey); onSelect({ type: 'month', value: mKey, label: `${MOIS_SHORT[m]} ${year}` }) }}>{MOIS_SHORT[m]}</button>
                    </React.Fragment>
                  )
                })}
              </React.Fragment>
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Calcul CV ────────────────────────────────────────────────────────────────
function calcCV(values) {
  if (!values || values.length < 2) return 0
  const mean = values.reduce((s,v) => s+v, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((s,v) => s+(v-mean)**2, 0) / values.length
  return (Math.sqrt(variance) / mean) * 100
}

// ─── Signal ────────────────────────────────────────────────────────────────────
function Signal({ moyenneTrend, cvTrend }) {
  if (moyenneTrend === null || cvTrend === null) return null
  let color, icon, title, desc
  if (moyenneTrend >= 0 && cvTrend <= 0) {
    color = '#2E9455'; icon = '🟢'; title = 'Bon signal'; desc = 'Performance stable et croissante'
  } else if (moyenneTrend < 0 && cvTrend <= 0) {
    color = '#E07B30'; icon = '🟠'; title = 'Revoir le process'; desc = 'Pas de variabilité et pas de résultats'
  } else if (moyenneTrend >= 0 && cvTrend > 0) {
    color = '#C9A84C'; icon = '🟡'; title = 'Attention'; desc = 'Résultats de coïncidence — agir pour consolider'
  } else {
    color = '#E05C5C'; icon = '🔴'; title = 'Alerte'; desc = 'Performance en chute avec instabilité'
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderRadius: 12, background: `${color}15`, border: `1.5px solid ${color}40` }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color, fontFamily: 'DM Sans' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#5A5A5A' }}>{desc}</div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PerfCommercial() {
  const { profil } = useAuth()
  const [fluxData, setFluxData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => {
    const saved = localStorage.getItem('jg_selected_perf')
    if (saved) try { return JSON.parse(saved) } catch(e) {}
    const now = new Date()
    const mKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    return { type: 'month', value: mKey, label: `${MOIS_SHORT[now.getMonth()]} ${now.getFullYear()}` }
  })
  const [equipe, setEquipe] = useState('toutes')

  const canSeeSale = profil?.role === 'super_admin' || profil?.permissions?.flux_rdv_sale
  const canSeeKenitra = profil?.role === 'super_admin' || profil?.permissions?.flux_rdv_kenitra

  useEffect(() => {
    localStorage.setItem('jg_selected_perf', JSON.stringify(selected))
  }, [selected])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('flux_rdv')
        .select('date_debut, date_fin, visites, ventes, commerciaux(nom, equipe)')
        .not('commercial_id', 'is', null)
        .order('date_debut', { ascending: true })
      setFluxData(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Filtrer par équipe
  const fluxFiltres = useMemo(() => {
    let data = fluxData
    if (equipe === 'sale') data = data.filter(r => r.commerciaux?.equipe === 'sale')
    else if (equipe === 'kenitra') data = data.filter(r => r.commerciaux?.equipe === 'kenitra')
    return data
  }, [fluxData, equipe])

  // Grouper par période selon selected
  const chartData = useMemo(() => {
    if (!fluxFiltres.length) return []

    // Filtrer selon la sélection
    let filtered = fluxFiltres
    if (selected.type === 'year') {
      filtered = filtered.filter(r => new Date(r.date_debut).getFullYear() === selected.value)
    } else if (selected.type === 'quarter') {
      const [year, q] = selected.value.split('-Q')
      const startM = (parseInt(q)-1)*3
      filtered = filtered.filter(r => {
        const d = new Date(r.date_debut)
        return d.getFullYear() === parseInt(year) && Math.floor(d.getMonth()/3) === parseInt(q)-1
      })
    } else if (selected.type === 'month') {
      filtered = filtered.filter(r => r.date_debut.startsWith(selected.value))
    }

    // Grouper par jour ou par mois selon le niveau
    const isJour = selected.type === 'month'
    const groups = {}
    for (const r of filtered) {
      const d = new Date(r.date_debut)
      const key = isJour
        ? r.date_debut
        : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if (!groups[key]) groups[key] = { visites: 0, ventes: 0, taux: [] }
      const v = parseFloat(r.visites||0) + parseFloat(r.ventes||0)
      const ve = parseFloat(r.ventes||0)
      groups[key].visites += v
      groups[key].ventes += ve
      if (v > 0) groups[key].taux.push((ve/v)*100)
    }

    // Calculer CV cumulatif
    const keys = Object.keys(groups).sort()
    const allTaux = []
    return keys.map(key => {
      const g = groups[key]
      allTaux.push(...g.taux)
      const moyenne = allTaux.length ? allTaux.reduce((s,v)=>s+v,0)/allTaux.length : 0
      const cv = calcCV(allTaux)
      const label = isJour
        ? new Date(key).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : `${MOIS_SHORT[new Date(key+'-01').getMonth()]} ${new Date(key+'-01').getFullYear()}`
      return { key, label, visites: g.visites, ventes: g.ventes, moyenne: parseFloat(moyenne.toFixed(1)), cv: parseFloat(cv.toFixed(1)) }
    })
  }, [fluxFiltres, selected])

  // Totaux KPIs
  const totalVisites = chartData.reduce((s,r) => s + r.visites, 0)
  const totalVentes = chartData.reduce((s,r) => s + r.ventes, 0)
  const txConv = totalVisites > 0 ? ((totalVentes/totalVisites)*100).toFixed(1) : '0.0'
  const cvGlobal = calcCV(chartData.map(r => r.moyenne)).toFixed(1)

  // Signal : tendance (comparer première moitié vs deuxième moitié)
  const { moyenneTrend, cvTrend } = useMemo(() => {
    if (chartData.length < 2) return { moyenneTrend: null, cvTrend: null }
    const mid = Math.floor(chartData.length / 2)
    const first = chartData.slice(0, mid)
    const second = chartData.slice(mid)
    // Moyenne du taux de conversion
    const m1 = first.reduce((s,r)=>s+r.moyenne,0)/first.length
    const m2 = second.reduce((s,r)=>s+r.moyenne,0)/second.length
    // Moyenne du CV (pas le dernier point)
    const c1 = first.reduce((s,r)=>s+r.cv,0)/first.length
    const c2 = second.reduce((s,r)=>s+r.cv,0)/second.length
    // moyenneTrend > 0 = hausse, cvTrend > 0 = hausse CV (instabilité)
    return { moyenneTrend: m2 - m1, cvTrend: c2 - c1 }
  }, [chartData])

  const cardStyle = { background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(201,168,76,0.1)' }
  const kpiCard = (label, value, sub, color='#2C2C2C') => (
    <div style={{ ...cardStyle, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'Cormorant Garamond, serif' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#2C2C2C' }}>{label}</div>
        {payload.map((p,i) => (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{p.value}%</strong></div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', background: '#F8F7F4', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>
          Performance Commerciale
        </div>
        <div style={{ fontSize: 13, color: '#8A8A7A' }}>Taux de conversion visites → ventes & stabilité</div>
      </div>

      {/* Filtres */}
      <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <DrillNav data={fluxData} onSelect={setSelected} selected={selected} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {['toutes', ...(canSeeSale ? ['sale'] : []), ...(canSeeKenitra ? ['kenitra'] : [])].map(eq => (
            <button key={eq} onClick={() => setEquipe(eq)} style={{
              padding: '5px 14px', borderRadius: 16, fontSize: 12, cursor: 'pointer', fontWeight: equipe===eq ? 600 : 400,
              border: `1.5px solid ${equipe===eq ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
              background: equipe===eq ? '#C9A84C' : 'transparent', color: equipe===eq ? '#fff' : '#5A5A5A'
            }}>
              {eq === 'toutes' ? 'Toutes' : eq === 'sale' ? 'Sale' : 'Kenitra'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {kpiCard('Total Visites', totalVisites.toLocaleString('fr-FR'), selected.label)}
        {kpiCard('Total Ventes', totalVentes.toLocaleString('fr-FR'), 'sur la période')}
        {kpiCard('Taux Conversion', `${txConv}%`, 'Ventes / Visites', txConv >= 10 ? '#2E9455' : txConv >= 5 ? '#C9A84C' : '#E05C5C')}
        {kpiCard('CV Global', `${cvGlobal}%`, 'Coefficient de variation', cvGlobal <= 30 ? '#2E9455' : cvGlobal <= 50 ? '#C9A84C' : '#E05C5C')}
        <div style={{ ...cardStyle, flex: 1, minWidth: 200, display: 'flex', alignItems: 'center' }}>
          <Signal moyenneTrend={moyenneTrend} cvTrend={cvTrend} />
        </div>
      </div>

      {/* Graphe */}
      <div style={{ ...cardStyle }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>
            Tendance Conversion & Stabilité
          </div>
          <div style={{ fontSize: 11, color: '#8A8A7A' }}>CV cumulatif · Moyenne cumulée</div>
        </div>
        {loading ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A7A', fontSize: 13 }}>Chargement...</div>
        ) : chartData.length === 0 ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A7A', fontSize: 13 }}>Aucune donnée pour cette période</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.1)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A8A7A' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#8A8A7A' }} unit="%" domain={[0, 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#8A8A7A' }} unit="%" domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="moyenne" name="Moyenne Tx Conv. (cumulée)" stroke="#C9A84C" strokeWidth={2.5} dot={{ r: 3, fill: '#C9A84C' }} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="cv" name="CV Cumulatif" stroke="#534AB7" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#534AB7' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}