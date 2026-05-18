// JG Dashboard - Primes - v2
import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import KpiCard from '../components/KpiCard'
import DrillNav, { MOIS_SHORT } from '../components/DrillNav'

const TARIFS = { visite: 15, vente: 300 }
const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MOIS_KEYS = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12']

function calcPrime(visites, ventes) {
  return Math.round((visites || 0) * TARIFS.visite + (ventes || 0) * TARIFS.vente)
}

function formatDh(val) {
  return Math.round(val).toLocaleString('fr-MA') + ' dh'
}

function calcCV(values) {
  const v = values.filter(x => x > 0)
  if (v.length < 2) return 0
  const mean = v.reduce((s, x) => s + x, 0) / v.length
  if (mean === 0) return 0
  const variance = v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length
  return parseFloat(((Math.sqrt(variance) / mean) * 100).toFixed(1))
}

// ─── Graphe prime style PerfCommercial ───────────────────────────────────────
function PrimeChart({ data, title, color = '#C9A84C', loading }) {
  const [visibleLines, setVisibleLines] = useState({ prime: true, moyenne: true, cv: true })
  const toggle = k => setVisibleLines(p => ({ ...p, [k]: !p[k] }))

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    const allPrimes = []
    return data.map(d => {
      allPrimes.push(d.prime)
      const moyenne = allPrimes.reduce((s, v) => s + v, 0) / allPrimes.length
      const cv = calcCV([...allPrimes])
      return { ...d, moyenne: parseFloat(moyenne.toFixed(0)), cv: parseFloat(cv.toFixed(1)) }
    })
  }, [data])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#2C2C2C' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{p.dataKey === 'cv' ? `${p.value}%` : formatDh(p.value)}</strong></div>
        ))}
      </div>
    )
  }

  const lines = [
    { key: 'prime',   label: 'Prime',           color },
    { key: 'moyenne', label: 'Moyenne cumulée',  color: '#2E9455' },
    { key: 'cv',      label: 'CV Cumulatif',     color: '#534AB7' },
  ]

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(201,168,76,0.1)' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>{title}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {lines.map(l => (
            <button key={l.key} onClick={() => toggle(l.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 16, cursor: 'pointer', fontSize: 11, fontWeight: 500,
              border: `1.5px solid ${visibleLines[l.key] ? l.color : 'rgba(0,0,0,0.1)'}`,
              background: visibleLines[l.key] ? `${l.color}15` : '#F8F7F4',
              color: visibleLines[l.key] ? l.color : '#8A8A7A', opacity: visibleLines[l.key] ? 1 : 0.6,
            }}>
              <span style={{ width: 20, height: 2, background: visibleLines[l.key] ? l.color : '#ccc', display: 'inline-block', borderRadius: 1 }} />
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A7A', fontSize: 13 }}>Chargement...</div>
      ) : chartData.length === 0 ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A7A', fontSize: 13 }}>Aucune donnée</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.1)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A8A7A' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#8A8A7A' }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#8A8A7A' }} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            {visibleLines.prime   && <Line yAxisId="left"  type="monotone" dataKey="prime"   name="Prime"           stroke={color}    strokeWidth={2.5} dot={{ r: 4, fill: color,     stroke: '#fff', strokeWidth: 2 }} />}
            {visibleLines.moyenne && <Line yAxisId="left"  type="monotone" dataKey="moyenne" name="Moyenne cumulée" stroke="#2E9455" strokeWidth={2}   strokeDasharray="5 3" dot={{ r: 3, fill: '#2E9455' }} />}
            {visibleLines.cv      && <Line yAxisId="right" type="monotone" dataKey="cv"      name="CV Cumulatif"    stroke="#534AB7" strokeWidth={2}   strokeDasharray="5 3" dot={{ r: 3, fill: '#534AB7' }} />}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Popup courbe conseillère ─────────────────────────────────────────────────
function PopupCourbe({ conseillere, chartData, onClose }) {
  const totalPrime = chartData.reduce((s, d) => s + d.prime, 0)
  const totalVisites = chartData.reduce((s, d) => s + d.visites, 0)
  const totalVentes = chartData.reduce((s, d) => s + d.ventes, 0)
  const cv = calcCV(chartData.map(d => d.prime))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ background: '#F8F7F4', borderRadius: 20, padding: 28, width: '90%', maxWidth: 780, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#C9A84C' }}>{conseillere.nom}</div>
            <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 2 }}>Évolution primes 2026</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.2)', background: '#fff', color: '#5A5A5A', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Primes', value: formatDh(totalPrime), color: '#C9A84C' },
            { label: 'Total Visites', value: totalVisites, color: '#4CAF7D' },
            { label: 'Total Ventes', value: totalVentes, color: '#1a6b3c' },
            { label: 'CV Primes', value: `${cv}%`, color: cv > 100 ? '#E05C5C' : cv > 50 ? '#E07B30' : '#4CAF7D' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(201,168,76,0.1)', borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
        {/* Graphe */}
        <PrimeChart data={chartData} title={`Évolution — ${conseillere.nom}`} color="#C9A84C" />
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Primes() {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'
  const isConseillere = profil?.role === 'conseillere'
  const myConseillereId = profil?.conseillere_id || null

  const [conseilleres, setConseilleres]   = useState([])
  const [fluxData, setFluxData]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [selectedPopup, setSelectedPopup] = useState(null)   // conseillère popup
  const [managerMode, setManagerMode]     = useState(false)  // courbe manager active

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cons }, { data: flux }] = await Promise.all([
      supabase.from('conseilleres').select('*').order('nom'),
      supabase.from('flux_rdv')
        .select('conseillere_id, date_debut, visites, ventes, type_saisie')
        .gte('date_debut', '2026-01-01').order('date_debut'),
    ])
    setConseilleres(cons || [])
    setFluxData(flux || [])
    setLoading(false)
  }

  // Agréger visites+ventes par conseillère par mois
  const aggParConseillereParMois = useMemo(() => {
    const res = {}
    fluxData.forEach(f => {
      if (!f.conseillere_id) return
      const mois = (f.date_debut || '').substring(0, 7)
      if (!mois) return
      const isPeriode = f.type_saisie === 'periode' || f.type_saisie === 'non_reconnue'
      const vis = parseFloat(f.visites || 0)
      const ven = parseFloat(f.ventes  || 0)
      const visTotal = isPeriode ? vis : vis + ven
      if (!res[f.conseillere_id])       res[f.conseillere_id] = {}
      if (!res[f.conseillere_id][mois]) res[f.conseillere_id][mois] = { visites: 0, ventes: 0 }
      res[f.conseillere_id][mois].visites += visTotal
      res[f.conseillere_id][mois].ventes  += ven
    })
    return res
  }, [fluxData])

  // Mois disponibles
  const moisDisponibles = useMemo(() => {
    const set = new Set()
    Object.values(aggParConseillereParMois).forEach(bm => Object.keys(bm).forEach(m => set.add(m)))
    return MOIS_KEYS.filter(m => set.has(m))
  }, [aggParConseillereParMois])

  // Prime par conseillère par mois
  function getPrimeMois(consId, mois) {
    const d = aggParConseillereParMois[consId]?.[mois] || { visites: 0, ventes: 0 }
    return { prime: calcPrime(d.visites, d.ventes), visites: Math.round(d.visites), ventes: Math.round(d.ventes) }
  }

  // Prime totale équipe par mois
  const primeTotaleParMois = useMemo(() => {
    const res = {}
    moisDisponibles.forEach(mois => {
      res[mois] = conseilleres.reduce((s, c) => s + getPrimeMois(c.id, mois).prime, 0)
    })
    return res
  }, [conseilleres, aggParConseillereParMois, moisDisponibles])

  // Prime manager (50% du total, seulement Avril+)
  function getPrimeManager(mois) {
    return mois >= '2026-04' ? Math.round(primeTotaleParMois[mois] * 0.5) : null
  }

  // Données graphe pour une conseillère
  function getChartDataConseillere(consId) {
    return moisDisponibles.map(mois => {
      const d = getPrimeMois(consId, mois)
      return { label: MOIS_SHORT[parseInt(mois.split('-')[1])-1], ...d }
    })
  }

  // Données graphe global (total équipe)
  const chartDataGlobal = useMemo(() => {
    return moisDisponibles.map(mois => ({
      label: MOIS_SHORT[parseInt(mois.split('-')[1])-1],
      prime: primeTotaleParMois[mois] || 0,
      visites: conseilleres.reduce((s,c) => s + getPrimeMois(c.id, mois).visites, 0),
      ventes:  conseilleres.reduce((s,c) => s + getPrimeMois(c.id, mois).ventes, 0),
    }))
  }, [moisDisponibles, primeTotaleParMois, conseilleres])

  // Données graphe manager (même que global × 0.5, seulement Avril+)
  const chartDataManager = useMemo(() => {
    return moisDisponibles.map(mois => {
      const pm = getPrimeManager(mois)
      return {
        label: MOIS_SHORT[parseInt(mois.split('-')[1])-1],
        prime:   pm !== null ? pm : 0,
        visites: 0,
        ventes:  0,
      }
    }).filter((_, i) => moisDisponibles[i] >= '2026-04')
  }, [moisDisponibles, primeTotaleParMois])

  // Mois courant
  const now = new Date()
  const moisCourant = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const moisCourantLabel = MOIS_LABELS[now.getMonth()]

  // ── Vue conseillère ───────────────────────────────────────────────────────
  if (isConseillere && myConseillereId) {
    const chartData = getChartDataConseillere(myConseillereId)
    const cons = conseilleres.find(c => c.id === myConseillereId)
    const primeCeMois = getPrimeMois(myConseillereId, moisCourant)
    const totalAnnee  = moisDisponibles.reduce((s, m) => s + getPrimeMois(myConseillereId, m).prime, 0)
    const totalVisites = moisDisponibles.reduce((s, m) => s + getPrimeMois(myConseillereId, m).visites, 0)
    const totalVentes  = moisDisponibles.reduce((s, m) => s + getPrimeMois(myConseillereId, m).ventes, 0)
    const cv = calcCV(chartData.map(d => d.prime))

    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>
            Mes Primes 2026
          </div>
          <div style={{ fontSize: 13, color: '#8A8A7A' }}>{cons?.nom}</div>
        </div>
        {/* KPIs */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}><KpiCard label={`Prime ${moisCourantLabel}`} value={formatDh(primeCeMois.prime)} unit="" sub="Mois en cours" /></div>
          <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Prime annuelle" value={formatDh(totalAnnee)} unit="" sub="Cumul 2026" /></div>
          <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Total Visites" value={totalVisites} unit="" sub="Cumul 2026" /></div>
          <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Total Ventes" value={totalVentes} unit="" sub="Cumul 2026" /></div>
          <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="CV Primes" value={`${cv}%`} unit="" sub="Coefficient de variation" /></div>
        </div>
        <PrimeChart data={chartData} title="Évolution de mes primes" color="#C9A84C" loading={loading} />
      </div>
    )
  }

  // ── Vue super admin ───────────────────────────────────────────────────────
  const totalEquipeCeMois = primeTotaleParMois[moisCourant] || 0
  const primeManagerCeMois = getPrimeManager(moisCourant)
  const cvGlobal = calcCV(chartDataGlobal.map(d => d.prime))

  const chartToShow = managerMode ? chartDataManager : chartDataGlobal
  const chartTitle  = managerMode ? 'Prime Manager — Évolution 2026' : 'Prime Équipe — Évolution globale 2026'
  const chartColor  = managerMode ? '#534AB7' : '#C9A84C'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>Module Primes</div>
        <div style={{ fontSize: 13, color: '#8A8A7A' }}>Primes conseillères & manager · {TARIFS.visite} dh/visite · {TARIFS.vente} dh/vente</div>
      </div>

      {/* KPIs globaux */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}><KpiCard label={`Total Équipe — ${moisCourantLabel}`} value={formatDh(totalEquipeCeMois)} unit="" sub="Mois en cours" /></div>
        {primeManagerCeMois !== null && (
          <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Prime Manager" value={formatDh(primeManagerCeMois)} unit="" sub="50% du total mensuel" /></div>
        )}
        <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="CV Primes" value={`${cvGlobal}%`} unit="" sub="Régularité équipe" /></div>
        <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Conseillères actives" value={conseilleres.filter(c => (aggParConseillereParMois[c.id]?.[moisCourant]?.visites || 0) > 0).length} unit="" sub={moisCourantLabel} /></div>
      </div>

      {/* Graphe global / manager */}
      <div style={{ marginBottom: 24 }}>
        <PrimeChart data={chartToShow} title={chartTitle} color={chartColor} loading={loading} />
      </div>

      {/* Grille cartes conseillères */}
      <div style={{ marginBottom: 12, fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>
        Primes par conseillère — {moisCourantLabel}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
        {conseilleres.map((c, i) => {
          const d = getPrimeMois(c.id, moisCourant)
          const totalAnnee = moisDisponibles.reduce((s, m) => s + getPrimeMois(c.id, m).prime, 0)
          const trend = moisDisponibles.length >= 2
            ? getPrimeMois(c.id, moisDisponibles[moisDisponibles.length-1]).prime - getPrimeMois(c.id, moisDisponibles[moisDisponibles.length-2]).prime
            : 0
          return (
            <div key={c.id} onClick={() => setSelectedPopup(c)}
              style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #C9A84C', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(201,168,76,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2C', marginBottom: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C', marginBottom: 6 }}>{formatDh(d.prime)}</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#4CAF7D' }}>👁 {d.visites} visites</div>
                <div style={{ fontSize: 11, color: '#1a6b3c' }}>✓ {d.ventes} ventes</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: '#8A8A7A' }}>Annuel: <span style={{ color: '#C9A84C', fontWeight: 600 }}>{formatDh(totalAnnee)}</span></div>
                {trend !== 0 && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: trend > 0 ? '#4CAF7D' : '#E05C5C' }}>
                    {trend > 0 ? '↑' : '↓'} {formatDh(Math.abs(trend))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Carte Prime Manager */}
        <div onClick={() => setManagerMode(m => !m)}
          style={{ background: managerMode ? 'rgba(83,74,183,0.08)' : '#F0EFEE', borderRadius: 14, padding: '16px 18px', border: `1px solid ${managerMode ? 'rgba(83,74,183,0.4)' : 'rgba(0,0,0,0.08)'}`, borderTop: `3px solid ${managerMode ? '#534AB7' : '#8A8A7A'}`, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(83,74,183,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}>👤</span>
            <div style={{ fontSize: 13, fontWeight: 600, color: managerMode ? '#534AB7' : '#5A5A5A' }}>Prime Manager</div>
            {managerMode && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'rgba(83,74,183,0.15)', color: '#534AB7' }}>Actif</span>}
          </div>
          {primeManagerCeMois !== null ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: managerMode ? '#534AB7' : '#8A8A7A', marginBottom: 6 }}>{formatDh(primeManagerCeMois)}</div>
              <div style={{ fontSize: 10, color: '#8A8A7A' }}>50% du total équipe · {moisCourantLabel}</div>
              <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 4 }}>
                Annuel: <span style={{ color: managerMode ? '#534AB7' : '#5A5A5A', fontWeight: 600 }}>
                  {formatDh(moisDisponibles.filter(m => m >= '2026-04').reduce((s, m) => s + (getPrimeManager(m) || 0), 0))}
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#8A8A7A', fontStyle: 'italic' }}>Disponible à partir d'Avril</div>
          )}
          <div style={{ fontSize: 10, color: managerMode ? '#534AB7' : '#8A8A7A', marginTop: 8 }}>
            {managerMode ? '← Cliquer pour revenir au global' : '→ Cliquer pour voir ma courbe'}
          </div>
        </div>
      </div>

      {/* Popup courbe conseillère */}
      {selectedPopup && (
        <PopupCourbe
          conseillere={selectedPopup}
          chartData={getChartDataConseillere(selectedPopup.id)}
          onClose={() => setSelectedPopup(null)}
        />
      )}
    </div>
  )
}