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

function getPrimeCouleur(prime) {
  if (prime < 1000)  return { color: '#E05C5C', bg: 'rgba(224,92,92,0.06)',  border: 'rgba(224,92,92,0.2)',  isGold: false }
  if (prime < 2000)  return { color: '#E07B30', bg: 'rgba(224,123,48,0.06)', border: 'rgba(224,123,48,0.2)', isGold: false }
  if (prime < 3000)  return { color: '#4CAF7D', bg: 'rgba(76,175,125,0.06)', border: 'rgba(76,175,125,0.2)', isGold: false }
  if (prime < 5000)  return { color: '#1a6b3c', bg: 'rgba(26,107,60,0.06)',  border: 'rgba(26,107,60,0.2)',  isGold: false }
  return { color: '#B8860B', bg: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(184,134,11,0.08))', border: 'rgba(201,168,76,0.5)', isGold: true }
}

function getTrendArrow(chartDataConseillere) {
  if (!chartDataConseillere || chartDataConseillere.length < 2) return null
  const last  = chartDataConseillere[chartDataConseillere.length - 1]?.prime || 0
  const prev  = chartDataConseillere[chartDataConseillere.length - 2]?.prime || 0
  if (last === prev) return { dir: '→', color: '#8A8A7A' }
  return last > prev
    ? { dir: '↑', color: '#2E9455' }
    : { dir: '↓', color: '#E05C5C' }
}

function calcPrime(visites, ventes) {
  return Math.round((visites || 0) * 15 + (ventes || 0) * 300)
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

  // Calcul flèche tendance (2ème moitié vs 1ère moitié)
  const trend = useMemo(() => {
    if (!data || data.length < 2) return null
    const mid = Math.floor(data.length / 2)
    const avg1 = data.slice(0, mid).reduce((s, d) => s + d.prime, 0) / mid
    const avg2 = data.slice(mid).reduce((s, d) => s + d.prime, 0) / (data.length - mid)
    return avg2 - avg1
  }, [data])

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    return data
  }, [data])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#2C2C2C' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{formatDh(p.value)}</strong></div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(201,168,76,0.1)' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>{title}</div>
          {trend !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: trend >= 0 ? 'rgba(46,148,85,0.1)' : 'rgba(224,92,92,0.1)', color: trend >= 0 ? '#2E9455' : '#E05C5C', fontSize: 12, fontWeight: 600 }}>
              <span style={{ fontSize: 16 }}>{trend >= 0 ? '↑' : '↓'}</span>
              {trend >= 0 ? 'En hausse' : 'En baisse'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 16, border: `1.5px solid ${color}`, background: `${color}15`, color, fontSize: 11, fontWeight: 500 }}>
          <span style={{ width: 20, height: 2, background: color, display: 'inline-block', borderRadius: 1 }} />
          Prime
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
            <YAxis tick={{ fontSize: 10, fill: '#8A8A7A' }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="prime" name="Prime" stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Primes', value: formatDh(totalPrime), color: getPrimeCouleur(totalPrime).color },
            { label: 'Total Visites', value: totalVisites, color: '#4CAF7D' },
            { label: 'Total Ventes', value: totalVentes, color: '#1a6b3c' },
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
  const [detailVentes, setDetailVentes] = useState({}) // { conseillere_id_mois: { appt, bureau, magasin } }
  const [popupVentes, setPopupVentes] = useState(null)  // { consId, mois, totalVentes }
  const [popupForm, setPopupForm] = useState({ appt: '', bureau: '', magasin: '' })
  const [savingPopup, setSavingPopup] = useState(false)
  const [managerMode, setManagerMode]     = useState(false)  // courbe manager active

  useEffect(() => { loadData() }, [])

  // Realtime : recalcul live à chaque modif flux_rdv
  useEffect(() => {
    const channel = supabase
      .channel('flux_rdv_primes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'flux_rdv',
      }, () => {
        loadData()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: cons } = await supabase.from('conseilleres').select('*').order('nom')

    // Pagination pour charger TOUT flux_rdv (>1000 lignes)
    let allFlux = []
    let from = 0
    const PAGE_SIZE = 1000
    while (true) {
      const { data: page, error } = await supabase
        .from('flux_rdv')
        .select('conseillere_id, date_debut, visites, ventes, type_saisie')
        .gte('date_debut', '2026-01-01')
        .order('date_debut')
        .range(from, from + PAGE_SIZE - 1)
      if (error || !page || page.length === 0) break
      allFlux = [...allFlux, ...page]
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    // Charger détails ventes
    const { data: details } = await supabase.from('primes_detail_ventes').select('*')
    const detailMap = {}
    ;(details || []).forEach(d => { detailMap[`${d.conseillere_id}_${d.mois}`] = d })

    setConseilleres(cons || [])
    setFluxData(allFlux)
    setDetailVentes(detailMap)
    setLoading(false)
  }

  // Agréger visites+ventes par conseillère par mois
  // T1 (jan-mar) : type_saisie = 'periode' → cumul mensuel
  // Avril+ : toutes saisies sauf 'periode' pure (jour + non_reconnue)
  const aggParConseillereParMois = useMemo(() => {
    const res = {}
    fluxData.forEach(f => {
      if (!f.conseillere_id) return
      const mois = (f.date_debut || '').substring(0, 7)
      if (!mois) return

      const isPeriode = f.type_saisie === 'periode'
      const isAvrilPlus = mois >= '2026-04'

      // Avril+ : exclure seulement les saisies 'periode'
      if (isAvrilPlus && isPeriode) return
      // T1 : exclure les saisies 'jour'
      if (!isAvrilPlus && f.type_saisie === 'jour') return

      const vis = parseFloat(f.visites || 0)
      const ven = parseFloat(f.ventes  || 0)
      // Pour type période/non_reconnue : visites inclut déjà les ventes
      // Pour type jour : visites brutes + ventes (1 vente = 1 visite)
      const visTotal = isPeriode || f.type_saisie === 'non_reconnue' ? vis : vis + ven

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

  // Calcul prime ventes avec détail types de biens
  function calcPrimeVentes(totalVentes, consId, mois) {
    const key = `${consId}_${mois}`
    const detail = detailVentes[key]
    if (!detail) return totalVentes * 300
    const magasin = detail.magasin || 0
    const autres = (detail.appt || 0) + (detail.bureau || 0)
    // Si total déclaré ne correspond pas → fallback 300 dh/vente
    if (magasin + autres !== totalVentes && magasin + autres > 0) return totalVentes * 300
    return (magasin * 600) + (autres * 300)
  }

  async function saveDetailVentes() {
    const { consId, mois, totalVentes } = popupVentes
    const appt = parseInt(popupForm.appt) || 0
    const bureau = parseInt(popupForm.bureau) || 0
    const magasin = parseInt(popupForm.magasin) || 0
    if (appt + bureau + magasin !== totalVentes) return // validation
    setSavingPopup(true)
    await supabase.from('primes_detail_ventes').upsert({
      conseillere_id: consId, mois, appt, bureau, magasin, updated_at: new Date().toISOString()
    }, { onConflict: 'conseillere_id,mois' })
    setSavingPopup(false)
    setPopupVentes(null)
    loadData()
  }

  function getPrimeMois(consId, mois) {
    const d = aggParConseillereParMois[consId]?.[mois] || { visites: 0, ventes: 0 }
    const visites = Math.round(d.visites)
    const ventes  = Math.round(d.ventes)
    return { prime: Math.round(visites * TARIFS.visite + calcPrimeVentes(ventes, consId, mois)), visites, ventes }
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
    if (mois < '2026-04') return null
    const total = primeTotaleParMois[mois] || 0
    return Math.round(total * 0.5)
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
  const [selectedMois, setSelectedMois] = useState(moisCourant)
  const moisCourantLabel = MOIS_LABELS[parseInt(selectedMois.split('-')[1]) - 1]

  // ── Vue conseillère ───────────────────────────────────────────────────────
  if (isConseillere && myConseillereId) {
    const chartData = getChartDataConseillere(myConseillereId)
    const cons = conseilleres.find(c => c.id === myConseillereId)
    const primeCeMois = getPrimeMois(myConseillereId, selectedMois)
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
        {(() => {
          const { color, isGold } = getPrimeCouleur(primeCeMois.prime)
          const trend = getTrendArrow(chartData)
          return (
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
              {/* Carte prime mois — avec couleur + sélecteur mois */}
              <div style={{ flex: 1, minWidth: 180, background: '#fff', borderRadius: 14, padding: '18px 20px', border: `1.5px solid ${color}40`, borderTop: `3px solid ${color}`, boxShadow: isGold ? '0 4px 16px rgba(201,168,76,0.2)' : undefined }}>
                <div style={{ fontSize: 11, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Prime {moisCourantLabel}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: isGold ? 26 : 24, fontWeight: 700, color, fontFamily: isGold ? 'Cormorant Garamond, serif' : 'inherit' }}>{formatDh(primeCeMois.prime)}</div>
                  {trend && <span style={{ fontSize: 20, fontWeight: 700, color: trend.color }}>{trend.dir}</span>}
                </div>
                {/* Sélecteur mois */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {moisDisponibles.map(m => (
                    <button key={m} onClick={() => setSelectedMois(m)}
                      style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer', fontWeight: selectedMois === m ? 600 : 400, border: `1px solid ${selectedMois === m ? color : 'rgba(0,0,0,0.1)'}`, background: selectedMois === m ? color : '#F8F7F4', color: selectedMois === m ? '#fff' : '#5A5A5A' }}>
                      {MOIS_SHORT[parseInt(m.split('-')[1])-1]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Prime annuelle" value={formatDh(totalAnnee)} unit="" sub="Cumul 2026" /></div>
              <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Total Visites" value={totalVisites} unit="" sub="Cumul 2026" /></div>
              <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Total Ventes" value={totalVentes} unit="" sub="Cumul 2026" /></div>
            </div>
          )
        })()}
        <PrimeChart data={chartData} title="Évolution de mes primes" color="#C9A84C" loading={loading} />
      </div>
    )
  }

  // ── Vue super admin ───────────────────────────────────────────────────────
  const totalEquipeCeMois = primeTotaleParMois[selectedMois] || 0
  const primeManagerCeMois = getPrimeManager(selectedMois)
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

      {/* KPIs globaux - 2 cartes seulement */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #C9A84C' }}>
          <div style={{ fontSize: 11, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Total Équipe</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#C9A84C', marginBottom: 10 }}>{formatDh(totalEquipeCeMois)}</div>
          {/* Sélecteur mois */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {moisDisponibles.map(m => (
              <button key={m} onClick={() => setSelectedMois(m)}
                style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', fontWeight: selectedMois === m ? 600 : 400, border: `1.5px solid ${selectedMois === m ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`, background: selectedMois === m ? '#C9A84C' : '#F8F7F4', color: selectedMois === m ? '#fff' : '#5A5A5A', transition: 'all 0.15s' }}>
                {MOIS_SHORT[parseInt(m.split('-')[1])-1]}
              </button>
            ))}
          </div>
        </div>
        {primeManagerCeMois !== null && (
          <div style={{ flex: 1, minWidth: 140 }}><KpiCard label="Prime Manager" value={formatDh(primeManagerCeMois)} unit="" sub="50% du total mensuel" /></div>
        )}
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
          const d = getPrimeMois(c.id, selectedMois)
          const totalAnnee = moisDisponibles.reduce((s, m) => s + getPrimeMois(c.id, m).prime, 0)
          const chartData  = getChartDataConseillere(c.id)
          const trend      = getTrendArrow(chartData)
          const { color, bg, border, isGold } = getPrimeCouleur(d.prime)
          const moisPrev   = moisDisponibles[moisDisponibles.length - 2]
          const prevPrime  = moisPrev ? getPrimeMois(c.id, moisPrev).prime : 0
          const diff       = d.prime - prevPrime

          return (
            <div key={c.id} onClick={() => setSelectedPopup(c)}
              style={{
                background: isGold ? bg : '#fff',
                borderRadius: 14, padding: '16px 18px',
                border: `1.5px solid ${border}`,
                borderTop: `3px solid ${color}`,
                cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: isGold ? `0 4px 16px rgba(201,168,76,0.2)` : '0 2px 8px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>{c.nom}</div>
                {trend && <span style={{ fontSize: 18, fontWeight: 700, color: trend.color, lineHeight: 1 }}>{trend.dir}</span>}
              </div>
              <div style={{
                fontSize: isGold ? 24 : 22, fontWeight: 700, color,
                marginBottom: 6,
                fontFamily: isGold ? 'Cormorant Garamond, serif' : 'inherit',
                letterSpacing: isGold ? 1 : 0,
              }}>
                {formatDh(d.prime)}
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#4CAF7D' }}>👁 {d.visites}</div>
                <div style={{ fontSize: 11, color: '#1a6b3c', cursor: 'pointer', textDecoration: 'underline dotted' }}
                  onClick={e => { e.stopPropagation(); const key = `${c.id}_${selectedMois}`; const detail = detailVentes[key]; setPopupForm({ appt: detail?.appt ?? '', bureau: detail?.bureau ?? '', magasin: detail?.magasin ?? '' }); setPopupVentes({ consId: c.id, mois: selectedMois, totalVentes: d.ventes, nomCons: c.nom }) }}>
                  ✓ {d.ventes}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: '#8A8A7A' }}>Annuel: <span style={{ color, fontWeight: 600 }}>{formatDh(totalAnnee)}</span></div>
                {diff !== 0 && moisPrev && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: diff > 0 ? '#4CAF7D' : '#E05C5C' }}>
                    {diff > 0 ? '↑' : '↓'} {formatDh(Math.abs(diff))}
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

      {/* Popup détail ventes */}
      {popupVentes && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setPopupVentes(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '90%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: '#C9A84C' }}>{popupVentes.nomCons}</div>
                <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 2 }}>Détail des {popupVentes.totalVentes} ventes — {MOIS_LABELS[parseInt(popupVentes.mois.split('-')[1])-1]}</div>
              </div>
              <button onClick={() => setPopupVentes(null)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.2)', background: '#fff', fontSize: 16, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'rgba(201,168,76,0.06)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#8a6a1a' }}>
              💡 Total déclaré doit être égal à <strong>{popupVentes.totalVentes}</strong> ventes · Appt/Bureau = 300 dh · Magasin = 600 dh
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              {[['appt','🏠 Appt.','#C9A84C'],['bureau','🏢 Bureau','#534AB7'],['magasin','🏪 Magasin','#2E9455']].map(([k,l,c]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5, fontWeight: 500 }}>{l}</div>
                  <input type="number" min="0" value={popupForm[k]}
                    onChange={e => setPopupForm(p => ({ ...p, [k]: e.target.value }))}
                    placeholder="0"
                    style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${c}40`, borderRadius: 8, fontSize: 14, textAlign: 'center', outline: 'none', fontWeight: 600, color: c }} />
                </div>
              ))}
            </div>

            {/* Total déclaré */}
            {(() => {
              const total = (parseInt(popupForm.appt)||0) + (parseInt(popupForm.bureau)||0) + (parseInt(popupForm.magasin)||0)
              const ok = total === popupVentes.totalVentes
              const prime = (parseInt(popupForm.magasin)||0) * 600 + ((parseInt(popupForm.appt)||0) + (parseInt(popupForm.bureau)||0)) * 300
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: ok ? 'rgba(46,148,85,0.08)' : 'rgba(224,92,92,0.08)', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: ok ? '#2E9455' : '#E05C5C' }}>
                      {ok ? '✅ Total correct' : `⚠️ Total: ${total} / ${popupVentes.totalVentes}`}
                    </span>
                    {ok && <span style={{ fontSize: 12, fontWeight: 700, color: '#2E9455' }}>Prime ventes: {formatDh(prime)}</span>}
                  </div>
                  <button onClick={saveDetailVentes} disabled={!ok || savingPopup}
                    style={{ width: '100%', padding: '11px', borderRadius: 8, background: ok ? '#C9A84C' : '#eee', color: ok ? '#fff' : '#aaa', border: 'none', fontSize: 13, fontWeight: 500, cursor: ok ? 'pointer' : 'not-allowed' }}>
                    {savingPopup ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}
        <PopupCourbe
          conseillere={selectedPopup}
          chartData={getChartDataConseillere(selectedPopup.id)}
          onClose={() => setSelectedPopup(null)}
        />
      )}
    </div>
  )
}