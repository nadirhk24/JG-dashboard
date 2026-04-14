import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'
import { supabase } from '../lib/supabase'

const EQUIPES = {
  sale: { label: 'Équipe Sale', color: '#C9A84C', responsable: 'Abdelhakim Rhalmi' },
  kenitra: { label: 'Équipe Kenitra', color: '#534AB7', responsable: 'Karima Snaiki' },
}

const KPIS = [
  { key: 'rdv', label: 'RDV', color: '#C9A84C', unit: '' },
  { key: 'visites', label: 'Visites', color: '#4CAF7D', unit: '' },
  { key: 'ventes', label: 'Ventes', color: '#1a6b3c', unit: '' },
  { key: 'taux_presence', label: 'Tx présence', color: '#534AB7', unit: '%', isRate: true },
  { key: 'taux_vente', label: 'Tx vente', color: '#378ADD', unit: '%', isRate: true },
]

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function getMoisOptions() {
  const now = new Date()
  const options = []
  // Annees
  for (let y = now.getFullYear(); y >= now.getFullYear() - 1; y--) {
    options.push({ val: `year-${y}`, label: `${y}`, type: 'year' })
    for (let q = 1; q <= 4; q++) {
      options.push({ val: `quarter-${y}-Q${q}`, label: `T${q} ${y}`, type: 'quarter' })
    }
    for (let m = 11; m >= 0; m--) {
      const val = `${y}-${String(m+1).padStart(2,'0')}`
      options.push({ val, label: `${MOIS_LABELS[m]} ${y}`, type: 'month' })
    }
  }
  return options
}

function calcCV(vals) {
  const v = vals.filter(x => x > 0)
  if (v.length < 2) return 0
  const moy = v.reduce((a, b) => a + b, 0) / v.length
  if (moy === 0) return 0
  const variance = v.reduce((s, x) => s + Math.pow(x - moy, 2), 0) / v.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

function getKpiVal(d, kpi) {
  if (kpi === 'taux_presence') return d.rdv > 0 ? parseFloat(((d.visites / d.rdv) * 100).toFixed(1)) : 0
  if (kpi === 'taux_vente') return d.visites > 0 ? parseFloat(((d.ventes / d.visites) * 100).toFixed(1)) : 0
  return parseFloat((d[kpi] || 0).toFixed(1))
}

function getRankColor(rank, total) {
  if (total <= 1) return '#C9A84C'
  const r = rank / Math.max(total - 1, 1)
  if (r <= 0.2) return '#1a6b3c'
  if (r <= 0.4) return '#2E9455'
  if (r <= 0.6) return '#C9A84C'
  if (r <= 0.8) return '#E07B30'
  return '#E05C5C'
}

function StarRank({ rank, total, maxDisplay=5 }) {
  // rank est 0-indexed, on affiche 1-indexed
  const displayRank = rank + 1
  if (displayRank > maxDisplay) return <div style={{ width: 28, textAlign: 'center', fontSize: 11, color: '#8A8A7A' }}>{displayRank}</div>
  const color = rank === 0 ? '#C9A84C' : rank === 1 ? '#B8B8B8' : rank === 2 ? '#CD7F32' : rank < total*0.5 ? '#4CAF7D' : '#8A8A7A'
  return (
    <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 26, color, lineHeight: 1 }}>★</span>
      <span style={{ position: 'absolute', fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: 0 }}>{displayRank}</span>
    </div>
  )
}

export default function FluxRDV({ conseilleres }) {
  const [commerciaux, setCommerciaux] = useState([])
  const [fluxData, setFluxData] = useState([])
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState('rdv')
  const [filterEquipe, setFilterEquipe] = useState('all')
  const [viewMode, setViewMode] = useState('separated')
  const [hiddenKpis, setHiddenKpis] = useState({})
  const [compareMode, setCompareMode] = useState('bars')
  const [selectedCommercial, setSelectedCommercial] = useState(null)
  const [detailMode, setDetailMode] = useState('%')
  const [showSaisie, setShowSaisie] = useState(false)
  const [showHistorique, setShowHistorique] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [saisieConseillere, setSaisieConseillere] = useState('')
  const [saisieMois, setSaisieMois] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`)
  const [saisieForm, setSaisieForm] = useState({})

  const moisOptions = useMemo(() => getMoisOptions(), [])
  const currentMois = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
  const [selectedPeriod, setSelectedPeriod] = useState(currentMois)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: comms }, { data: flux }] = await Promise.all([
      supabase.from('commerciaux').select('*').eq('actif', true).order('equipe').order('nom'),
      supabase.from('flux_rdv').select('*')
    ])
    setCommerciaux(comms || [])
    setFluxData(flux || [])
    setLoading(false)
  }

  // Filtrer selon la periode selectionnee
  const fluxFiltres = useMemo(() => {
    return fluxData.filter(f => {
      const mD = f.date_debut?.substring(0, 7)
      const mF = f.date_fin?.substring(0, 7)
      if (selectedPeriod.startsWith('year-')) {
        const y = selectedPeriod.split('-')[1]
        return mD?.startsWith(y)
      }
      if (selectedPeriod.startsWith('quarter-')) {
        const [, y, q] = selectedPeriod.split('-')
        const qNum = parseInt(q.replace('Q',''))
        const startM = (qNum - 1) * 3 + 1
        const endM = qNum * 3
        const mois = parseInt(mD?.split('-')[1] || 0)
        return mD?.startsWith(y) && mois >= startM && mois <= endM
      }
      return mD === selectedPeriod || mF === selectedPeriod
    })
  }, [fluxData, selectedPeriod])

  // Agregger par commercial
  const fluxParCommercial = useMemo(() => {
    const agg = {}
    fluxFiltres.forEach(f => {
      if (!agg[f.commercial_id]) agg[f.commercial_id] = { rdv: 0, visites: 0, ventes: 0 }
      agg[f.commercial_id].rdv += parseFloat(f.rdv || 0)
      agg[f.commercial_id].visites += parseFloat(f.visites || 0)
      agg[f.commercial_id].ventes += parseFloat(f.ventes || 0)
    })
    return agg
  }, [fluxFiltres])

  // Stats par equipe
  const statsParEquipe = useMemo(() => {
    const res = {}
    Object.keys(EQUIPES).forEach(eq => {
      const comms = commerciaux.filter(c => c.equipe === eq)
      const tot = comms.reduce((acc, c) => {
        const d = fluxParCommercial[c.id] || { rdv: 0, visites: 0, ventes: 0 }
        return { rdv: acc.rdv + d.rdv, visites: acc.visites + d.visites, ventes: acc.ventes + d.ventes }
      }, { rdv: 0, visites: 0, ventes: 0 })
      const cv = calcCV(comms.map(c => (fluxParCommercial[c.id] || {}).rdv || 0))
      res[eq] = { ...tot, cv,
        taux_presence: tot.rdv > 0 ? parseFloat(((tot.visites/tot.rdv)*100).toFixed(1)) : 0,
        taux_vente: tot.visites > 0 ? parseFloat(((tot.ventes/tot.visites)*100).toFixed(1)) : 0,
      }
    })
    return res
  }, [commerciaux, fluxParCommercial])

  // Historique pour graphe du commercial selectionne
  const historique = useMemo(() => {
    if (!selectedCommercial) return []
    const byMois = {}
    fluxData.filter(f => f.commercial_id === selectedCommercial.id).forEach(f => {
      const m = f.date_debut?.substring(0, 7)
      if (!m) return
      if (!byMois[m]) byMois[m] = { rdv: 0, visites: 0, ventes: 0 }
      byMois[m].rdv += parseFloat(f.rdv || 0)
      byMois[m].visites += parseFloat(f.visites || 0)
      byMois[m].ventes += parseFloat(f.ventes || 0)
    })
    return Object.entries(byMois).sort(([a],[b]) => a.localeCompare(b)).map(([m, d]) => ({
      label: MOIS_LABELS[parseInt(m.split('-')[1])-1]?.substring(0,3) + ' ' + m.split('-')[0].substring(2),
      rdv: d.rdv, visites: d.visites, ventes: d.ventes,
      taux_presence: d.rdv > 0 ? parseFloat(((d.visites/d.rdv)*100).toFixed(1)) : 0,
      taux_vente: d.visites > 0 ? parseFloat(((d.ventes/d.visites)*100).toFixed(1)) : 0,
    }))
  }, [selectedCommercial, fluxData])

  // Ranking par equipe - toujours separe par equipe dans la vue separee
  function getRanking(equipe) {
    const comms = commerciaux.filter(c => c.equipe === equipe)
    return [...comms]
      .map(c => ({ ...c, val: getKpiVal(fluxParCommercial[c.id] || {rdv:0,visites:0,ventes:0}, kpi) }))
      .sort((a,b) => b.val - a.val)
  }

  async function handleSaisie() {
    if (!saisieConseillere) { setMsg({ type: 'error', text: 'Sélectionne une conseillère' }); return }
    const entries = Object.entries(saisieForm).filter(([_, v]) => v.rdv || v.visites || v.ventes)
    if (!entries.length) { setMsg({ type: 'error', text: 'Saisis au moins une donnée' }); return }
    setSaving(true)
    const year = parseInt(saisieMois.split('-')[0])
    const month = parseInt(saisieMois.split('-')[1])
    const lastDay = new Date(year, month, 0).getDate()
    const dd = `${saisieMois}-01`, df = `${saisieMois}-${String(lastDay).padStart(2,'0')}`
    await supabase.from('flux_rdv').delete().eq('conseillere_id', saisieConseillere).gte('date_debut', dd).lte('date_fin', df)
    const rows = entries.map(([cid, v]) => ({
      conseillere_id: saisieConseillere, commercial_id: cid,
      date_debut: dd, date_fin: df, type_saisie: 'periode',
      rdv: parseFloat(v.rdv)||0, visites: parseFloat(v.visites)||0, ventes: parseFloat(v.ventes)||0,
    }))
    const { error } = await supabase.from('flux_rdv').insert(rows)
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: `${rows.length} saisie(s) enregistrée(s) !` }); loadData(); setSaisieForm({}); setTimeout(() => setMsg(null), 3000) }
  }

  const selectedKpi = KPIS.find(k => k.key === kpi)
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const inputStyle = { width: '55px', padding: '5px 6px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 6, fontSize: 12, textAlign: 'center', background: '#F8F7F4', outline: 'none' }
  const btnStyle = (active, color='#C9A84C') => ({ padding: '6px 14px', borderRadius: 16, border: `1.5px solid ${active?color:'rgba(201,168,76,0.2)'}`, background: active?color:'#fff', color: active?'#fff':'#5A5A5A', fontSize: 12, fontWeight: active?500:400, cursor: 'pointer', transition: 'all 0.15s' })

  const equipes = viewMode === 'separated' ? (filterEquipe === 'all' ? ['sale','kenitra'] : [filterEquipe]) : []

  if (loading) return <div style={{ padding: 32, color: '#5A5A5A' }}>Chargement...</div>

  return (
    <div>
      <PageHeader title="Flux de Rendez-vous" subtitle="Performance commerciale par équipe et commercial">
        <button onClick={() => setShowSaisie(p=>!p)} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showSaisie?'#C9A84C':'#fff', color: showSaisie?'#fff':'#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showSaisie ? '✕ Fermer' : '+ Saisir données'}
        </button>
      </PageHeader>

      {/* Modal detail commercial */}
      {selectedCommercial && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setSelectedCommercial(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '90%', maxWidth: 900, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            {(() => {
              const currentList = viewMode === 'all'
                ? [...commerciaux].map(c=>({...c,val:getKpiVal(fluxParCommercial[c.id]||{rdv:0,visites:0,ventes:0},kpi)})).sort((a,b)=>b.val-a.val)
                : [...commerciaux.filter(c=>c.equipe===selectedCommercial.equipe)].map(c=>({...c,val:getKpiVal(fluxParCommercial[c.id]||{rdv:0,visites:0,ventes:0},kpi)})).sort((a,b)=>b.val-a.val)
              const idx = currentList.findIndex(c=>c.id===selectedCommercial.id)
              const prev = idx > 0 ? currentList[idx-1] : null
              const next = idx < currentList.length-1 ? currentList[idx+1] : null
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => prev && setSelectedCommercial(commerciaux.find(c=>c.id===prev.id))} disabled={!prev} style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.2)', background: '#fff', color: prev?'#C9A84C':'#ccc', fontSize: 16, cursor: prev?'pointer':'default' }}>‹</button>
                    <div>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: EQUIPES[selectedCommercial.equipe]?.color }}>{selectedCommercial.nom}</div>
                      <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 2 }}>{EQUIPES[selectedCommercial.equipe]?.label} · Rang #{idx+1}/{currentList.length}</div>
                    </div>
                    <button onClick={() => next && setSelectedCommercial(commerciaux.find(c=>c.id===next.id))} disabled={!next} style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.2)', background: '#fff', color: next?'#C9A84C':'#ccc', fontSize: 16, cursor: next?'pointer':'default' }}>›</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {[['%','%'],['📈','graph'],['123','num']].map(([icon, mode]) => (
                      <button key={mode} onClick={() => setDetailMode(mode)} style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${detailMode===mode?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: detailMode===mode?'#C9A84C':'#fff', color: detailMode===mode?'#fff':'#5A5A5A', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>{icon}</button>
                    ))}
                    <button onClick={() => setSelectedCommercial(null)} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.2)', background: '#fff', color: '#5A5A5A', fontSize: 16, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              )
            })()}

            {/* Toggle KPIs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {KPIS.map(k => (
                <button key={k.key} onClick={() => setHiddenKpis(p=>({...p,[k.key]:!p[k.key]}))} style={{ padding: '4px 12px', borderRadius: 12, border: `1.5px solid ${hiddenKpis[k.key]?'rgba(201,168,76,0.2)':k.color}`, background: hiddenKpis[k.key]?'#F8F7F4':`${k.color}15`, color: hiddenKpis[k.key]?'#8A8A7A':k.color, fontSize: 11, cursor: 'pointer', textDecoration: hiddenKpis[k.key]?'line-through':'none' }}>{k.label}</button>
              ))}
            </div>
            {/* KPIs */}
            {(() => {
              const d = fluxParCommercial[selectedCommercial.id] || { rdv: 0, visites: 0, ventes: 0 }
              const visibleKpis = KPIS.filter(k => !hiddenKpis[k.key])
              return visibleKpis.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleKpis.length},1fr)`, gap: 10, marginBottom: 20 }}>
                  {visibleKpis.map(k => {
                    const val = getKpiVal(d, k.key)
                    return (
                      <div key={k.key} style={{ background: '#F8F7F4', borderRadius: 10, padding: '16px', textAlign: 'center', borderTop: `3px solid ${k.color}` }}>
                        <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 600, color: k.color }}>{val}{k.unit}</div>
                      </div>
                    )
                  })}
                </div>
              ) : null
            })()}

            {/* Contenu selon mode */}
            {detailMode === '%' && (() => {
              const d = fluxParCommercial[selectedCommercial.id] || { rdv: 0, visites: 0, ventes: 0 }
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[{label:'Taux de présence',val:d.rdv>0?((d.visites/d.rdv)*100).toFixed(1):0,color:'#534AB7',desc:'Visites / RDV'},
                    {label:'Taux de vente',val:d.visites>0?((d.ventes/d.visites)*100).toFixed(1):0,color:'#1a6b3c',desc:'Ventes / Visites'}].map(r => (
                    <div key={r.label} style={{ background: '#F8F7F4', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 4 }}>{r.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: r.color }}>{r.val}%</div>
                      <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{r.desc}</div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {detailMode === 'graph' && historique.length > 0 && (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={historique} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }}/>
                  <YAxis tick={{ fontSize: 10 }}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Line type="monotone" dataKey="rdv" stroke="#C9A84C" strokeWidth={2.5} dot={{ r: 5, fill: '#C9A84C', stroke: '#fff', strokeWidth: 2 }} name="RDV"/>
                  <Line type="monotone" dataKey="visites" stroke="#4CAF7D" strokeWidth={2.5} dot={{ r: 5, fill: '#4CAF7D', stroke: '#fff', strokeWidth: 2 }} name="Visites"/>
                  <Line type="monotone" dataKey="ventes" stroke="#1a6b3c" strokeWidth={2.5} dot={{ r: 5, fill: '#1a6b3c', stroke: '#fff', strokeWidth: 2 }} name="Ventes"/>
                </LineChart>
              </ResponsiveContainer>
            )}

            {detailMode === 'num' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Mois','RDV','Visites','Ventes','Tx Présence','Tx Vente'].map(h => (
                      <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {historique.map((r,i) => (
                      <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding: '8px', fontSize: 12, fontWeight: 500, color: '#C9A84C' }}>{r.label}</td>
                        <td style={{ padding: '8px', fontSize: 12 }}>{r.rdv}</td>
                        <td style={{ padding: '8px', fontSize: 12, color: '#4CAF7D' }}>{r.visites}</td>
                        <td style={{ padding: '8px', fontSize: 12, color: '#1a6b3c' }}>{r.ventes}</td>
                        <td style={{ padding: '8px', fontSize: 12, color: '#534AB7' }}>{r.taux_presence}%</td>
                        <td style={{ padding: '8px', fontSize: 12, color: '#378ADD' }}>{r.taux_vente}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saisie */}
      {showSaisie && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1.5px solid #C9A84C', marginBottom: 24 }}>
          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500, background: msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5, textTransform: 'uppercase' }}>Conseillère</div>
              <select value={saisieConseillere} onChange={e=>setSaisieConseillere(e.target.value)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.25)', background: '#F8F7F4', fontSize: 13, outline: 'none', minWidth: 200 }}>
                <option value="">Sélectionner...</option>
                {conseilleres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5, textTransform: 'uppercase' }}>Mois</div>
              <select value={saisieMois} onChange={e=>setSaisieMois(e.target.value)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.25)', background: '#F8F7F4', fontSize: 13, outline: 'none' }}>
                {moisOptions.filter(m=>m.type==='month').slice(0,12).map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {Object.keys(EQUIPES).map(eq => (
            <div key={eq} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: EQUIPES[eq].color, marginBottom: 10 }}>
                {EQUIPES[eq].label} — {EQUIPES[eq].responsable}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', minWidth: 160 }}>Commercial</th>
                      <th style={{ fontSize: 10, color: '#C9A84C', textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>RDV</th>
                      <th style={{ fontSize: 10, color: '#4CAF7D', textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>Visites</th>
                      <th style={{ fontSize: 10, color: '#1a6b3c', textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>Ventes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commerciaux.filter(c=>c.equipe===eq).map(c => (
                      <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 500 }}>{c.nom}</td>
                        {['rdv','visites','ventes'].map(f => (
                          <td key={f} style={{ padding: '5px 10px', textAlign: 'center' }}>
                            <input type="number" min="0" step="0.5" value={saisieForm[c.id]?.[f]||''} onChange={e=>setSaisieForm(p=>({...p,[c.id]:{...(p[c.id]||{}),[f]:e.target.value}}))} placeholder="0" style={inputStyle}/>
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(201,168,76,0.05)', fontWeight: 600 }}>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: EQUIPES[eq].color }}>Total</td>
                      {['rdv','visites','ventes'].map(f => (
                        <td key={f} style={{ padding: '8px 10px', fontSize: 12, textAlign: 'center' }}>
                          {commerciaux.filter(c=>c.equipe===eq).reduce((s,c)=>s+(parseFloat(saisieForm[c.id]?.[f])||0),0)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 20, padding: 16, background: 'rgba(201,168,76,0.05)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.15)' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#C9A84C', marginBottom: 12 }}>Visites non reconnues</div>
            <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 12 }}>Visites récupérées sans commercial identifié — saisir par région</div>
            <div style={{ display: 'flex', gap: 20 }}>
              {Object.keys(EQUIPES).map(eq => (
                <div key={eq}>
                  <label style={{ fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5, display: 'block' }}>{EQUIPES[eq].label}</label>
                  <input type="number" min="0" step="0.5"
                    value={saisieForm[`__non_reconnue_${eq}`]?.visites || ''}
                    onChange={e => setSaisieForm(p => ({ ...p, [`__non_reconnue_${eq}`]: { visites: e.target.value, rdv: 0, ventes: 0, equipe: eq, non_reconnue: true } }))}
                    placeholder="0" style={{ width: '80px', padding: '8px 10px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 6, fontSize: 13, textAlign: 'center', background: '#F8F7F4', outline: 'none' }}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={handleSaisie} disabled={saving} style={{ background: saving?'#E8D5A3':'#C9A84C', color:'#fff', border:'none', padding:'11px 28px', borderRadius:8, fontSize:13, fontWeight:500, cursor:saving?'wait':'pointer' }}>
            {saving?'Enregistrement...':'Enregistrer'}
          </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedPeriod} onChange={e=>setSelectedPeriod(e.target.value)} style={{ padding: '7px 28px 7px 12px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.25)', background: '#fff', fontSize: 13, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
          {moisOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={()=>setViewMode('separated')} style={btnStyle(viewMode==='separated')}>Vue séparée</button>
          <button onClick={()=>setViewMode('all')} style={btnStyle(viewMode==='all')}>Vue All</button>
        </div>
        {viewMode === 'separated' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all','Toutes'],['sale','Sale'],['kenitra','Kenitra']].map(([k,l]) => (
              <button key={k} onClick={()=>setFilterEquipe(k)} style={btnStyle(filterEquipe===k)}>{l}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {KPIS.map(k => (
            <button key={k.key} onClick={()=>setKpi(k.key)} style={btnStyle(kpi===k.key, k.color)}>{k.label}</button>
          ))}
        </div>
      </div>

      {/* Vue All - ranking global */}
      {viewMode === 'all' && (() => {
        const allRanking = [...commerciaux]
          .map(c => ({ ...c, val: getKpiVal(fluxParCommercial[c.id] || {rdv:0,visites:0,ventes:0}, kpi) }))
          .sort((a,b) => b.val - a.val)
        const maxVal = Math.max(...allRanking.map(c=>c.val), 1)
        const cvAll = calcCV(allRanking.map(c=>c.val))
        return (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '4px solid #C9A84C' }}>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 600, color: '#C9A84C' }}>Ranking Global — Toutes équipes</div>
                <div style={{ fontSize: 11, color: '#5A5A5A' }}>{allRanking.length} commerciaux · CV: <span style={{ color: cvAll>30?'#E05C5C':'#4CAF7D', fontWeight: 500 }}>{cvAll}%</span></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase' }}>Total {selectedKpi?.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C' }}>{allRanking.reduce((s,c)=>s+c.val,0).toFixed(1)}{selectedKpi?.unit}</div>
              </div>
            </div>
            <div>
              {allRanking.map((c, i) => {
                const rankColor = getRankColor(i, allRanking.length)
                const pct = maxVal > 0 ? (c.val / maxVal) * 100 : 0
                const equipeColor = EQUIPES[c.equipe]?.color || '#C9A84C'
                return (
                  <div key={c.id} onClick={() => setSelectedCommercial(c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.05)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{ width: 24, fontSize: 14, fontWeight: 700, color: rankColor, textAlign: 'center', flexShrink: 0 }}>{i+1}</div>
                    <div style={{ width: 150, fontSize: 13, fontWeight: 500, color: '#2C2C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{c.nom}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${equipeColor}15`, color: equipeColor, flexShrink: 0 }}>{EQUIPES[c.equipe]?.label}</span>
                    <div style={{ flex: 1, height: 7, background: 'rgba(201,168,76,0.1)', borderRadius: 4, overflow: 'hidden', minWidth: 40 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: rankColor, borderRadius: 4 }}></div>
                    </div>
                    <div style={{ width: 44, fontSize: 13, fontWeight: 700, color: rankColor, textAlign: 'right', flexShrink: 0 }}>{c.val}{selectedKpi?.unit}</div>
                    <StarRank rank={i} total={allRanking.length} maxDisplay={allRanking.length} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Listes ranking séparées */}
      {viewMode === 'separated' && <div style={{ display: 'grid', gridTemplateColumns: filterEquipe==='all'?'1fr 1fr':'1fr', gap: 16, marginBottom: 24 }}>
        {equipes.map(eq => {
          const ranking = getRanking(eq)
          const stats = statsParEquipe[eq] || {}
          const maxVal = Math.max(...ranking.map(c=>c.val), 1)
          return (
            <div key={eq} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `4px solid ${EQUIPES[eq].color}` }}>
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 600, color: EQUIPES[eq].color }}>{EQUIPES[eq].label}</div>
                  <div style={{ fontSize: 11, color: '#5A5A5A' }}>Resp: {EQUIPES[eq].responsable} · CV: <span style={{ color: stats.cv>30?'#E05C5C':'#4CAF7D', fontWeight: 500 }}>{stats.cv||0}%</span></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase' }}>Total {selectedKpi?.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: EQUIPES[eq].color }}>{getKpiVal(stats, kpi)}{selectedKpi?.unit}</div>
                </div>
              </div>
              <div>
                {ranking.map((c, i) => {
                  const rankColor = getRankColor(i, ranking.length)
                  const pct = maxVal > 0 ? (c.val / maxVal) * 100 : 0
                  return (
                    <div key={c.id} onClick={() => setSelectedCommercial(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.05)', transition: 'background 0.15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{ width: 22, fontSize: 14, fontWeight: 700, color: rankColor, textAlign: 'center', flexShrink: 0 }}>{i+1}</div>
                      <div style={{ width: 130, fontSize: 13, fontWeight: 500, color: '#2C2C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{c.nom}</div>
                      <div style={{ flex: 1, height: 7, background: 'rgba(201,168,76,0.1)', borderRadius: 4, overflow: 'hidden', minWidth: 40 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: rankColor, borderRadius: 4, transition: 'width 0.3s' }}></div>
                      </div>
                      <div style={{ width: 44, fontSize: 13, fontWeight: 700, color: rankColor, textAlign: 'right', flexShrink: 0 }}>{c.val}{selectedKpi?.unit}</div>
                      <StarRank rank={i} total={ranking.length} maxDisplay={ranking.length} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>}

      {/* Comparaison equipes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>Comparaison inter-équipes</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['bars','Barres'],['graph','Graphe'],['pct','%'],['num','123']].map(([m,l]) => (
            <button key={m} onClick={()=>setCompareMode(m)} style={btnStyle(compareMode===m)}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 24 }}>
        {compareMode === 'bars' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[['rdv','RDV','#C9A84C'],['visites','Visites','#4CAF7D'],['ventes','Ventes','#1a6b3c']].map(([k,l,c]) => (
              <div key={k}>
                <div style={{ fontSize: 12, fontWeight: 500, color: c, marginBottom: 12 }}>{l}</div>
                {Object.keys(EQUIPES).map(eq => {
                  const stats = statsParEquipe[eq] || {}
                  const val = stats[k] || 0
                  const maxVal = Math.max(...Object.keys(EQUIPES).map(e => statsParEquipe[e]?.[k]||0), 1)
                  return (
                    <div key={eq} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize: 12, color: '#5A5A5A' }}>{EQUIPES[eq].label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: EQUIPES[eq].color }}>{val}</div>
                      </div>
                      <div style={{ height: 8, background: 'rgba(201,168,76,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(val/maxVal)*100}%`, background: EQUIPES[eq].color, borderRadius: 4 }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
        {compareMode === 'graph' && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Object.keys(EQUIPES).map(eq => ({ label: EQUIPES[eq].label, rdv: statsParEquipe[eq]?.rdv||0, visites: statsParEquipe[eq]?.visites||0, ventes: statsParEquipe[eq]?.ventes||0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
              <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
              <YAxis tick={{ fontSize: 10 }}/>
              <Tooltip contentStyle={{ background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}/>
              <Bar dataKey="rdv" fill="#C9A84C" radius={[4,4,0,0]} name="RDV"/>
              <Bar dataKey="visites" fill="#4CAF7D" radius={[4,4,0,0]} name="Visites"/>
              <Bar dataKey="ventes" fill="#1a6b3c" radius={[4,4,0,0]} name="Ventes"/>
            </BarChart>
          </ResponsiveContainer>
        )}
        {compareMode === 'pct' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {Object.keys(EQUIPES).map(eq => {
              const s = statsParEquipe[eq] || {}
              return (
                <div key={eq} style={{ background: '#F8F7F4', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: EQUIPES[eq].color, marginBottom: 12 }}>{EQUIPES[eq].label}</div>
                  {[['Tx Présence', s.taux_presence||0, '#534AB7'],['Tx Vente', s.taux_vente||0, '#378ADD']].map(([l,v,c]) => (
                    <div key={l} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: '#5A5A5A' }}>{l}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: c }}>{v}%</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(201,168,76,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(v,100)}%`, background: c, borderRadius: 3 }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
        {compareMode === 'num' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Équipe','Responsable','RDV','Visites','Ventes','Tx Présence','Tx Vente','CV RDV'].map(h => (
                <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {Object.keys(EQUIPES).map(eq => {
                const s = statsParEquipe[eq] || {}
                return (
                  <tr key={eq} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 500, color: EQUIPES[eq].color }}>{EQUIPES[eq].label}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: '#5A5A5A' }}>{EQUIPES[eq].responsable}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, color: '#C9A84C' }}>{s.rdv||0}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13, color: '#4CAF7D' }}>{s.visites||0}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13, color: '#1a6b3c' }}>{s.ventes||0}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13, color: '#534AB7' }}>{s.taux_presence||0}%</td>
                    <td style={{ padding: '10px 8px', fontSize: 13, color: '#378ADD' }}>{s.taux_vente||0}%</td>
                    <td style={{ padding: '10px 8px', fontSize: 13, color: s.cv>30?'#E05C5C':'#4CAF7D' }}>{s.cv||0}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Historique saisies */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistorique ? 12 : 0, marginTop: 8 }}>
        <div onClick={() => setShowHistorique(p=>!p)} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          Historique des saisies
          <span style={{ fontSize: 12, color: '#C9A84C', fontFamily: 'DM Sans' }}>{showHistorique ? '▲ Fermer' : '▼ Ouvrir'}</span>
        </div>
      </div>
      {showHistorique && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Période','Commercial','Équipe','RDV','Visites','Ventes','Actions'].map(h => (
                  <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {[...fluxData].sort((a,b)=>(b.date_debut||'').localeCompare(a.date_debut||'')).slice(0,50).map(f => {
                  const comm = commerciaux.find(c=>c.id===f.commercial_id)
                  const periode = f.date_debut && f.date_fin && f.date_debut !== f.date_fin
                    ? `${f.date_debut.substring(8)}/${f.date_debut.substring(5,7)} → ${f.date_fin.substring(8)}/${f.date_fin.substring(5,7)}`
                    : (f.date_debut || f.date_fin || '—')
                  const eq = comm ? EQUIPES[comm.equipe] : null
                  return (
                    <tr key={f.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, color: '#C9A84C' }}>{periode}</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500 }}>{comm?.nom || '—'}</td>
                      <td style={{ padding: '9px 10px' }}>{eq && <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, background: `${eq.color}15`, color: eq.color }}>{eq.label}</span>}</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>{f.rdv}</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, color: '#4CAF7D' }}>{f.visites}</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, color: '#1a6b3c' }}>{f.ventes}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <button onClick={async () => { if(!window.confirm('Supprimer ?')) return; await supabase.from('flux_rdv').delete().eq('id',f.id); loadData() }} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Suppr.</button>
                      </td>
                    </tr>
                  )
                })}
                {fluxData.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>Aucune saisie</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
