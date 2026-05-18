// JG Dashboard - Primes - v1
import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import PageHeader from '../components/PageHeader'

const TARIFS = { visite: 15, vente: 300 }
const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MOIS_SHORT  = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const MOIS_KEYS   = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12']

function calcPrime(visites, ventes) {
  return (visites || 0) * TARIFS.visite + (ventes || 0) * TARIFS.vente
}

function formatDh(val) {
  return val.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' dh'
}

function Badge({ children, color }) {
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {children}
    </span>
  )
}

export default function Primes() {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'
  const isConseillere = profil?.role === 'conseillere'
  const myConseillereId = profil?.conseillere_id || null

  const [conseilleres, setConseilleres] = useState([])
  const [fluxData, setFluxData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMois, setSelectedMois] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  })
  const [viewMode, setViewMode] = useState('mensuel') // mensuel | evolution

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cons }, { data: flux }] = await Promise.all([
      supabase.from('conseilleres').select('*').order('nom'),
      supabase.from('flux_rdv').select('conseillere_id, date_debut, visites, ventes, type_saisie')
        .gte('date_debut', '2026-01-01').order('date_debut')
    ])
    setConseilleres(cons || [])
    setFluxData(flux || [])
    setLoading(false)
  }

  // Calcul visites+ventes par conseillère par mois depuis flux_rdv
  const primesParConseillereParMois = useMemo(() => {
    const result = {}
    fluxData.forEach(f => {
      if (!f.conseillere_id) return
      const mois = (f.date_debut || '').substring(0, 7)
      if (!mois) return
      const isPeriode = f.type_saisie === 'periode' || f.type_saisie === 'non_reconnue'
      const vis = parseFloat(f.visites || 0)
      const ven = parseFloat(f.ventes || 0)
      // Même règle que FluxRDV : période → visites inclut ventes, jour → visites+ventes
      const visTotal = isPeriode ? vis : vis + ven

      if (!result[f.conseillere_id]) result[f.conseillere_id] = {}
      if (!result[f.conseillere_id][mois]) result[f.conseillere_id][mois] = { visites: 0, ventes: 0 }
      result[f.conseillere_id][mois].visites += visTotal
      result[f.conseillere_id][mois].ventes  += ven
    })
    return result
  }, [fluxData])

  // Mois disponibles (qui ont des données)
  const moisDisponibles = useMemo(() => {
    const set = new Set()
    Object.values(primesParConseillereParMois).forEach(byMois => Object.keys(byMois).forEach(m => set.add(m)))
    return MOIS_KEYS.filter(m => set.has(m))
  }, [primesParConseillereParMois])

  // Conseillères visibles
  const conseilleresFiltrees = useMemo(() => {
    if (isSuperAdmin) return conseilleres
    if (isConseillere && myConseillereId) return conseilleres.filter(c => c.id === myConseillereId)
    return []
  }, [conseilleres, isSuperAdmin, isConseillere, myConseillereId])

  // Prime totale par mois (toutes conseillères)
  const primeTotaleParMois = useMemo(() => {
    const res = {}
    MOIS_KEYS.forEach(mois => {
      const total = conseilleres.reduce((s, c) => {
        const d = primesParConseillereParMois[c.id]?.[mois] || { visites: 0, ventes: 0 }
        return s + calcPrime(d.visites, d.ventes)
      }, 0)
      res[mois] = total
    })
    return res
  }, [conseilleres, primesParConseillereParMois])

  // Prime manager = 50% du total mensuel, seulement à partir d'avril
  function getPrimeManager(mois) {
    if (mois < '2026-04') return null
    return primeTotaleParMois[mois] * 0.5
  }

  // Données pour graphe évolution
  const evolutionData = useMemo(() => {
    return moisDisponibles.map(mois => {
      const row = { mois: MOIS_SHORT[parseInt(mois.split('-')[1])-1] }
      conseilleresFiltrees.forEach(c => {
        const d = primesParConseillereParMois[c.id]?.[mois] || { visites: 0, ventes: 0 }
        row[c.nom] = calcPrime(d.visites, d.ventes)
      })
      if (isSuperAdmin) {
        row['Total équipe'] = primeTotaleParMois[mois]
        const pm = getPrimeManager(mois)
        if (pm !== null) row['Prime manager'] = pm
      }
      return row
    })
  }, [moisDisponibles, conseilleresFiltrees, primesParConseillereParMois, primeTotaleParMois, isSuperAdmin])

  const COLORS = ['#C9A84C','#4CAF7D','#534AB7','#E07B30','#378ADD','#E05C5C','#2E9455','#8A5CF5']

  if (loading) return <div style={{ padding: 32, color: '#5A5A5A', fontSize: 14 }}>Chargement...</div>

  const moisLabel = MOIS_LABELS[parseInt(selectedMois.split('-')[1])-1] + ' 2026'
  const primeManagerMois = getPrimeManager(selectedMois)

  return (
    <div>
      <PageHeader title="Module Primes" subtitle="Calcul des primes mensuelles — conseillères & manager" />

      {/* Sélecteur vue */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['mensuel','Vue mensuelle'],['evolution','Évolution 2026']].map(([k,l]) => (
          <button key={k} onClick={() => setViewMode(k)}
            style={{ padding: '7px 18px', borderRadius: 16, border: `1.5px solid ${viewMode===k?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: viewMode===k?'#C9A84C':'#fff', color: viewMode===k?'#fff':'#5A5A5A', fontSize: 12, fontWeight: viewMode===k?500:400, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── VUE MENSUELLE ── */}
      {viewMode === 'mensuel' && (
        <>
          {/* Sélecteur mois */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {moisDisponibles.map(m => (
              <button key={m} onClick={() => setSelectedMois(m)}
                style={{ padding: '5px 14px', borderRadius: 14, border: `1.5px solid ${selectedMois===m?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: selectedMois===m?'#C9A84C':'#fff', color: selectedMois===m?'#fff':'#5A5A5A', fontSize: 12, fontWeight: selectedMois===m?500:400, cursor: 'pointer' }}>
                {MOIS_SHORT[parseInt(m.split('-')[1])-1]}
              </button>
            ))}
          </div>

          {/* KPIs globaux du mois */}
          {isSuperAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: primeManagerMois !== null ? '1fr 1fr 1fr' : '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #C9A84C' }}>
                <div style={{ fontSize: 11, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Total primes équipe</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#C9A84C' }}>{formatDh(primeTotaleParMois[selectedMois] || 0)}</div>
                <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{moisLabel}</div>
              </div>
              {primeManagerMois !== null && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid rgba(83,74,183,0.2)', borderTop: '3px solid #534AB7' }}>
                  <div style={{ fontSize: 11, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Prime manager (50%)</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#534AB7' }}>{formatDh(primeManagerMois)}</div>
                  <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{moisLabel}</div>
                </div>
              )}
              <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid rgba(76,175,125,0.2)', borderTop: '3px solid #4CAF7D' }}>
                <div style={{ fontSize: 11, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Nb conseillères actives</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#4CAF7D' }}>
                  {conseilleres.filter(c => (primesParConseillereParMois[c.id]?.[selectedMois]?.visites || 0) + (primesParConseillereParMois[c.id]?.[selectedMois]?.ventes || 0) > 0).length}
                </div>
                <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{moisLabel}</div>
              </div>
            </div>
          )}

          {/* Tableau primes par conseillère */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '4px solid #C9A84C' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#C9A84C' }}>
                Primes conseillères — {moisLabel}
              </div>
              <div style={{ fontSize: 11, color: '#8A8A7A' }}>
                {TARIFS.visite} dh/visite · {TARIFS.vente} dh/vente
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F7F4' }}>
                  {['Conseillère','Visites','Ventes','Prime visites','Prime ventes','Total prime'].map(h => (
                    <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: h === 'Conseillère' ? 'left' : 'right', padding: '10px 16px', borderBottom: '1px solid rgba(201,168,76,0.1)', textTransform: 'uppercase', fontWeight: 500, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conseilleresFiltrees.map((c, i) => {
                  const d = primesParConseillereParMois[c.id]?.[selectedMois] || { visites: 0, ventes: 0 }
                  const pVis = d.visites * TARIFS.visite
                  const pVen = d.ventes  * TARIFS.vente
                  const total = pVis + pVen
                  const isTop = isSuperAdmin && i === 0
                  return (
                    <tr key={c.id}
                      onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      style={{ borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#2C2C2C' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.nom}
                          {total === 0 && <Badge color="#8A8A7A">Inactif</Badge>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', color: '#4CAF7D', fontWeight: 500 }}>{Math.round(d.visites)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', color: '#1a6b3c', fontWeight: 500 }}>{Math.round(d.ventes)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'right', color: '#5A5A5A' }}>{formatDh(pVis)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'right', color: '#5A5A5A' }}>{formatDh(pVen)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, textAlign: 'right', fontWeight: 700, color: total > 0 ? '#C9A84C' : '#8A8A7A' }}>{formatDh(total)}</td>
                    </tr>
                  )
                })}
                {/* Ligne total */}
                {isSuperAdmin && (
                  <tr style={{ background: 'rgba(201,168,76,0.06)', borderTop: '1.5px solid rgba(201,168,76,0.2)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#C9A84C' }}>TOTAL ÉQUIPE</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#4CAF7D' }}>
                      {Math.round(conseilleresFiltrees.reduce((s,c) => s + (primesParConseillereParMois[c.id]?.[selectedMois]?.visites || 0), 0))}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#1a6b3c' }}>
                      {Math.round(conseilleresFiltrees.reduce((s,c) => s + (primesParConseillereParMois[c.id]?.[selectedMois]?.ventes || 0), 0))}
                    </td>
                    <td colSpan={2} />
                    <td style={{ padding: '12px 16px', fontSize: 15, textAlign: 'right', fontWeight: 700, color: '#C9A84C' }}>
                      {formatDh(primeTotaleParMois[selectedMois] || 0)}
                    </td>
                  </tr>
                )}
                {/* Ligne prime manager */}
                {isSuperAdmin && primeManagerMois !== null && (
                  <tr style={{ background: 'rgba(83,74,183,0.05)', borderTop: '1px solid rgba(83,74,183,0.15)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#534AB7' }}>
                      PRIME MANAGER <span style={{ fontSize: 11, fontWeight: 400, color: '#8A8A7A' }}>(50% du total)</span>
                    </td>
                    <td colSpan={4} />
                    <td style={{ padding: '12px 16px', fontSize: 15, textAlign: 'right', fontWeight: 700, color: '#534AB7' }}>
                      {formatDh(primeManagerMois)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── VUE ÉVOLUTION 2026 ── */}
      {viewMode === 'evolution' && (
        <>
          {/* Graphe évolution primes par conseillère */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#C9A84C', marginBottom: 16 }}>
              Évolution des primes 2026
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolutionData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                <Tooltip
                  contentStyle={{ background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11 }}
                  formatter={(val) => [formatDh(val)]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {conseilleresFiltrees.map((c, i) => (
                  <Line key={c.id} type="monotone" dataKey={c.nom}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                    dot={{ r: 4, fill: COLORS[i % COLORS.length], stroke: '#fff', strokeWidth: 2 }}
                    connectNulls />
                ))}
                {isSuperAdmin && (
                  <Line type="monotone" dataKey="Prime manager"
                    stroke="#534AB7" strokeWidth={2.5} strokeDasharray="6 3"
                    dot={{ r: 5, fill: '#534AB7', stroke: '#fff', strokeWidth: 2 }}
                    connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tableau récap annuel */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)', borderTop: '4px solid #C9A84C' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#C9A84C' }}>Récapitulatif annuel</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#F8F7F4' }}>
                    <th style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid rgba(201,168,76,0.1)', textTransform: 'uppercase', fontWeight: 500, position: 'sticky', left: 0, background: '#F8F7F4' }}>Conseillère</th>
                    {moisDisponibles.map(m => (
                      <th key={m} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.1)', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {MOIS_SHORT[parseInt(m.split('-')[1])-1]}
                      </th>
                    ))}
                    <th style={{ fontSize: 10, color: '#C9A84C', textAlign: 'right', padding: '10px 16px', borderBottom: '1px solid rgba(201,168,76,0.1)', textTransform: 'uppercase', fontWeight: 700 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {conseilleresFiltrees.map(c => {
                    const totalAnnee = moisDisponibles.reduce((s,m) => {
                      const d = primesParConseillereParMois[c.id]?.[m] || { visites: 0, ventes: 0 }
                      return s + calcPrime(d.visites, d.ventes)
                    }, 0)
                    return (
                      <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'} style={{ borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#2C2C2C', position: 'sticky', left: 0, background: 'inherit' }}>{c.nom}</td>
                        {moisDisponibles.map(m => {
                          const d = primesParConseillereParMois[c.id]?.[m] || { visites: 0, ventes: 0 }
                          const p = calcPrime(d.visites, d.ventes)
                          return (
                            <td key={m} style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: p > 0 ? '#C9A84C' : '#D5D2CA', fontWeight: p > 0 ? 500 : 400 }}>
                              {p > 0 ? formatDh(p) : '—'}
                            </td>
                          )
                        })}
                        <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: '#C9A84C' }}>{formatDh(totalAnnee)}</td>
                      </tr>
                    )
                  })}
                  {/* Ligne prime manager */}
                  {isSuperAdmin && (
                    <tr style={{ background: 'rgba(83,74,183,0.05)', borderTop: '1.5px solid rgba(83,74,183,0.15)' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#534AB7', position: 'sticky', left: 0, background: 'rgba(83,74,183,0.05)' }}>Prime manager</td>
                      {moisDisponibles.map(m => {
                        const pm = getPrimeManager(m)
                        return (
                          <td key={m} style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: pm !== null ? '#534AB7' : '#D5D2CA', fontWeight: pm !== null ? 600 : 400 }}>
                            {pm !== null ? formatDh(pm) : '—'}
                          </td>
                        )
                      })}
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: '#534AB7' }}>
                        {formatDh(moisDisponibles.filter(m => m >= '2026-04').reduce((s,m) => s + (primeTotaleParMois[m] * 0.5), 0))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
