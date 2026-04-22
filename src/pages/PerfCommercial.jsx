import React, { useState, useEffect, useMemo } from 'react'
import DrillNav, { MOIS_SHORT } from '../components/DrillNav'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import KpiCard from '../components/KpiCard'

// Filtrer les données selon la sélection DrillNav (inclut période custom)
function filterBySelected(items, selected, dateField = 'date') {
  if (!selected || selected.type === 'global') return items
  if (selected.type === 'custom') {
    return items.filter(s => {
      const d = s[dateField] || s.date || s.date_debut
      return d && d >= selected.from && d <= selected.to
    })
  }
  if (selected.type === 'year') return items.filter(s => { const d = s[dateField] || s.date || s.date_debut; return d && d.startsWith(String(selected.value)) })
  if (selected.type === 'quarter') {
    const [y, q] = selected.value.split('-Q')
    const startM = (parseInt(q)-1)*3
    return items.filter(s => { const d = new Date(s[dateField] || s.date || s.date_debut); return d.getFullYear() === parseInt(y) && Math.floor(d.getMonth()/3) === parseInt(q)-1 })
  }
  if (selected.type === 'month') return items.filter(s => { const d = s[dateField] || s.date || s.date_debut; return d && d.startsWith(selected.value) })
  if (selected.type === 'day') return items.filter(s => { const d = s[dateField] || s.date || s.date_debut; return d && d.startsWith(selected.value) })
  return items
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
  let color, dot, title, lines

  if (moyenneTrend >= 0 && cvTrend <= 0) {
    color = '#2E9455'
    dot = '🟢'
    title = 'Performance stable'
    lines = ['Moyenne en hausse, variabilité en baisse', "L'équipe progresse de façon homogène"]
  } else if (moyenneTrend < 0 && cvTrend <= 0) {
    color = '#E07B30'
    dot = '🟠'
    title = 'Effort commercial nécessaire'
    lines = ['Résultats en baisse malgré une équipe homogène', "Le process est stable mais insuffisant — revoir l'approche"]
  } else if (moyenneTrend >= 0 && cvTrend > 0) {
    color = '#E05C5C'
    dot = '🔴'
    title = 'Alerte variabilité'
    lines = ['Bonne perf globale mais accidentelle', 'Un élément tire vers le haut ou vers le bas — action manager nécessaire']
  } else {
    color = '#9B1C1C'
    dot = '🔴'
    title = 'Alerte grave'
    lines = ['Performance en chute et variabilité en hausse', 'Plusieurs actions nécessaires en urgence']
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 12, background: `${color}12`, border: `1.5px solid ${color}35`, width: '100%' }}>
      <span style={{ fontSize: 18, marginTop: 2 }}>{dot}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color, fontFamily: 'DM Sans', marginBottom: 4 }}>{title}</div>
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: 11, color: '#5A5A5A', lineHeight: 1.5 }}>{l}</div>
        ))}
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
  const [visibleLines, setVisibleLines] = useState({ txJour: true, moyenne: true, cv: true })
  const toggleLine = (key) => setVisibleLines(p => ({ ...p, [key]: !p[key] }))

  const canSeeSale = profil?.role === 'super_admin' || profil?.permissions?.perf_commercial_sale || profil?.permissions?.flux_rdv_sale
  const canSeeKenitra = profil?.role === 'super_admin' || profil?.permissions?.perf_commercial_kenitra || profil?.permissions?.flux_rdv_kenitra

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
      const txJour = g.visites > 0 ? parseFloat(((g.ventes / g.visites) * 100).toFixed(1)) : 0
      return { key, label, visites: g.visites, ventes: g.ventes, moyenne: parseFloat(moyenne.toFixed(1)), cv: parseFloat(cv.toFixed(1)), txJour }
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
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column' }}><KpiCard label="Total Visites" value={totalVisites} unit="" sub={selected.label} /></div>
        <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column' }}><KpiCard label="Total Ventes" value={totalVentes} unit="" sub="sur la période" /></div>
        <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column' }}><KpiCard label="Taux Conversion" value={txConv} sub="Ventes / Visites" objectifPct={10} /></div>
        <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column' }}><KpiCard label="CV Global" value={cvGlobal} sub="Coefficient de variation" /></div>

      </div>

      {/* Graphe */}
      <div style={{ ...cardStyle }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>
            Tendance Conversion & Stabilité
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'txJour',  label: 'Tx Conv. (période)', color: '#C9A84C' },
              { key: 'moyenne', label: 'Moyenne cumulée',    color: '#2E9455' },
              { key: 'cv',      label: 'CV Cumulatif',       color: '#534AB7' },
            ].map(l => (
              <button key={l.key} onClick={() => toggleLine(l.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 16, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                border: `1.5px solid ${visibleLines[l.key] ? l.color : 'rgba(0,0,0,0.1)'}`,
                background: visibleLines[l.key] ? `${l.color}15` : '#F8F7F4',
                color: visibleLines[l.key] ? l.color : '#8A8A7A',
                opacity: visibleLines[l.key] ? 1 : 0.6,
                transition: 'all 0.2s'
              }}>
                <span style={{ width: 20, height: 2, background: visibleLines[l.key] ? l.color : '#ccc', display: 'inline-block', borderRadius: 1 }} />
                {l.label}
              </button>
            ))}
          </div>
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
              {visibleLines.txJour && <Line yAxisId="left" type="monotone" dataKey="txJour" name="Tx Conv. (période)" stroke="#C9A84C" strokeWidth={2.5} dot={{ r: 3, fill: '#C9A84C' }} activeDot={{ r: 5 }} />}
              {visibleLines.moyenne && <Line yAxisId="left" type="monotone" dataKey="moyenne" name="Moyenne cumulée" stroke="#2E9455" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#2E9455' }} activeDot={{ r: 5 }} />}
              {visibleLines.cv && <Line yAxisId="right" type="monotone" dataKey="cv" name="CV Cumulatif" stroke="#534AB7" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#534AB7' }} activeDot={{ r: 5 }} />}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
