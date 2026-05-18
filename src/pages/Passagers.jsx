// JG Dashboard - Passagers - v2
import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import PageHeader from '../components/PageHeader'
import DrillNav from '../components/DrillNav'
import { supabase } from '../lib/supabase'

const EQUIPES = {
  sale:    { label: 'Équipe Sale',    color: '#C9A84C', responsable: 'Abdelhakim Rhalmi' },
  kenitra: { label: 'Équipe Kenitra', color: '#534AB7', responsable: 'Karima Snaiki' },
}

function calcCV(vals) {
  const v = vals.filter(x => x > 0)
  if (v.length < 2) return 0
  const moy = v.reduce((a, b) => a + b, 0) / v.length
  if (moy === 0) return 0
  const variance = v.reduce((s, x) => s + Math.pow(x - moy, 2), 0) / v.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
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

function filterBySelected(items, selected, dateField = 'date') {
  if (!selected || selected.type === 'global') return items
  if (selected.type === 'custom') return items.filter(s => { const d = s[dateField]; return d && d >= selected.from && d <= selected.to })
  if (selected.type === 'year') return items.filter(s => { const d = s[dateField]; return d && d.startsWith(String(selected.value)) })
  if (selected.type === 'quarter') {
    const [y, q] = selected.value.split('-Q')
    return items.filter(s => { const raw = s[dateField]; if (!raw) return false; const d = new Date(String(raw).substring(0,10) + 'T12:00:00'); return d.getFullYear() === parseInt(y) && Math.floor(d.getMonth()/3) === parseInt(q)-1 })
  }
  if (selected.type === 'month') return items.filter(s => { const d = s[dateField]; return d && d.startsWith(selected.value) })
  if (selected.type === 'day')   return items.filter(s => { const d = s[dateField]; return d && d.startsWith(selected.value) })
  return items
}

const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export default function Passagers() {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'

  const [passagers, setPassagers]     = useState([])
  const [commerciaux, setCommerciaux] = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(() => {
    const saved = localStorage.getItem('jg_selected_passagers')
    if (saved) try { return JSON.parse(saved) } catch(e) {}
    const now = new Date()
    const mKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    return { type: 'month', value: mKey, label: `${MOIS_SHORT[now.getMonth()]} ${now.getFullYear()}` }
  })
  const [viewMode,     setViewMode]     = useState('separated')
  const [filterEquipe, setFilterEquipe] = useState('all')

  // Saisie
  const today = new Date().toISOString().split('T')[0]
  const [showSaisie, setShowSaisie] = useState(false)
  const [saisieDate, setSaisieDate] = useState(today)
  const [saisieForm, setSaisieForm] = useState({}) // { commercial_id: count }
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState(null)

  useEffect(() => { localStorage.setItem('jg_selected_passagers', JSON.stringify(selected)) }, [selected])
  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: comms }, { data: pass }] = await Promise.all([
      supabase.from('commerciaux').select('*').eq('actif', true).order('equipe').order('nom'),
      supabase.from('passagers').select('*, commerciaux(nom, equipe)').order('date', { ascending: true }),
    ])
    setCommerciaux(comms || [])
    setPassagers(pass || [])
    setLoading(false)
  }

  async function handleSaisie() {
    const entries = Object.entries(saisieForm).filter(([, v]) => parseInt(v) > 0)
    if (!entries.length) { setMsg({ type: 'error', text: 'Saisis au moins un passager' }); return }
    setSaving(true)
    try {
      for (const [commercial_id, count] of entries) {
        const comm = commerciaux.find(c => c.id === commercial_id)
        if (!comm) continue
        // Upsert sur (commercial_id, date)
        const { data: existing } = await supabase.from('passagers')
          .select('id, count').eq('commercial_id', commercial_id).eq('date', saisieDate).maybeSingle()
        if (existing) {
          await supabase.from('passagers').update({ count: parseInt(count), region: comm.equipe }).eq('id', existing.id)
        } else {
          await supabase.from('passagers').insert({ commercial_id, region: comm.equipe, date: saisieDate, count: parseInt(count) })
        }
      }
      setMsg({ type: 'success', text: `${entries.length} saisie(s) enregistrée(s) ✓` })
      setSaisieForm({})
      setTimeout(() => setMsg(null), 3000)
      loadData()
    } catch(e) {
      setMsg({ type: 'error', text: e.message })
    }
    setSaving(false)
  }

  // Filtrer selon DrillNav
  const passagersFiltres = useMemo(() => filterBySelected(passagers, selected, 'date'), [passagers, selected])

  // Totaux par commercial
  const totParCommercial = useMemo(() => {
    const res = {}
    passagersFiltres.forEach(p => {
      if (!p.commercial_id) return
      res[p.commercial_id] = (res[p.commercial_id] || 0) + (p.count || 0)
    })
    return res
  }, [passagersFiltres])

  // Totaux par équipe
  const totParEquipe = useMemo(() => {
    const res = { sale: 0, kenitra: 0 }
    passagersFiltres.forEach(p => {
      const eq = p.region || p.commerciaux?.equipe
      if (eq === 'sale' || eq === 'kenitra') res[eq] += (p.count || 0)
    })
    return res
  }, [passagersFiltres])

  const totalGlobal = totParEquipe.sale + totParEquipe.kenitra

  function getRanking(equipe) {
    return commerciaux
      .filter(c => c.equipe === equipe && !c.nom.includes('Non reconnu'))
      .map(c => ({ ...c, val: totParCommercial[c.id] || 0 }))
      .sort((a, b) => b.val - a.val)
  }

  // Courbe évolution
  const chartData = useMemo(() => {
    const isJour = selected.type === 'month' || selected.type === 'day' || selected.type === 'custom'
    const groups = {}
    passagers.forEach(p => {
      const d = new Date(p.date + 'T12:00:00')
      const key = isJour ? p.date : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if (!groups[key]) groups[key] = { sale: 0, kenitra: 0 }
      const eq = p.region || p.commerciaux?.equipe
      if (eq === 'sale' || eq === 'kenitra') groups[key][eq] += (p.count || 0)
    })
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([key, val]) => {
      const label = isJour
        ? new Date(key + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : `${MOIS_SHORT[new Date(key+'-02T12:00:00').getMonth()]} ${new Date(key+'-02T12:00:00').getFullYear()}`
      return { key, label, ...val }
    })
  }, [passagers, selected])

  // Donut
  const donutData = useMemo(() => [
    { name: 'Équipe Sale',    value: totParEquipe.sale,    color: '#C9A84C' },
    { name: 'Équipe Kenitra', value: totParEquipe.kenitra, color: '#534AB7' },
  ].filter(d => d.value > 0), [totParEquipe])

  const btnStyle = (active, color = '#C9A84C') => ({
    padding: '6px 14px', borderRadius: 16,
    border: `1.5px solid ${active ? color : 'rgba(201,168,76,0.2)'}`,
    background: active ? color : '#fff', color: active ? '#fff' : '#5A5A5A',
    fontSize: 12, fontWeight: active ? 500 : 400, cursor: 'pointer', transition: 'all 0.15s',
  })
  const inputStyle = { width: 70, padding: '5px 8px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 6, fontSize: 12, textAlign: 'center', background: '#F8F7F4', outline: 'none' }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const equipes = viewMode === 'separated' ? (filterEquipe === 'all' ? ['sale', 'kenitra'] : [filterEquipe]) : []

  if (loading) return <div style={{ padding: 32, color: '#5A5A5A' }}>Chargement...</div>

  return (
    <div>
      <PageHeader title="Module Passagers" subtitle="Suivi des passages par commercial et région">
        {isSuperAdmin && (
          <button onClick={() => setShowSaisie(p => !p)}
            style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showSaisie ? '#C9A84C' : '#fff', color: showSaisie ? '#fff' : '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            {showSaisie ? '✕ Fermer' : '+ Saisir passagers'}
          </button>
        )}
      </PageHeader>

      {/* ── Formulaire de saisie ── */}
      {isSuperAdmin && showSaisie && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1.5px solid #C9A84C', marginBottom: 24 }}>
          {msg && (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>
              {msg.text}
            </div>
          )}
          {/* Date + bouton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5, textTransform: 'uppercase' }}>Date</div>
              <input type="date" value={saisieDate} onChange={e => setSaisieDate(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.25)', background: '#F8F7F4', fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSaisie} disabled={saving}
                style={{ background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowSaisie(false)}
                style={{ background: '#fff', color: '#5A5A5A', border: '1.5px solid rgba(201,168,76,0.25)', padding: '9px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          </div>

          {/* Tableau Sale | Kenitra */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {['sale', 'kenitra'].map(eq => (
              <div key={eq}>
                <div style={{ fontSize: 13, fontWeight: 600, color: EQUIPES[eq].color, marginBottom: 10 }}>
                  {EQUIPES[eq].label}
                </div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>Commercial</th>
                      <th style={{ fontSize: 10, color: EQUIPES[eq].color, textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>Passagers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commerciaux.filter(c => c.equipe === eq && !c.nom.includes('Non reconnu')).map(c => (
                      <tr key={c.id}
                        onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '6px 8px', fontSize: 12, fontWeight: 500 }}>{c.nom}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <input type="number" min="0" value={saisieForm[c.id] || ''}
                            onChange={e => setSaisieForm(p => ({ ...p, [c.id]: e.target.value }))}
                            placeholder="0" style={inputStyle} />
                        </td>
                      </tr>
                    ))}
                    {/* Total */}
                    <tr style={{ background: `${EQUIPES[eq].color}08`, fontWeight: 600 }}>
                      <td style={{ padding: '7px 8px', fontSize: 12, color: EQUIPES[eq].color }}>Total</td>
                      <td style={{ padding: '7px 8px', fontSize: 12, textAlign: 'center' }}>
                        {commerciaux.filter(c => c.equipe === eq && !c.nom.includes('Non reconnu')).reduce((s, c) => s + (parseInt(saisieForm[c.id]) || 0), 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DrillNav */}
      <DrillNav data={passagers} onSelect={setSelected} selected={selected} dateField="date" />

      {/* Filtres vue */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#C9A84C', padding: '6px 14px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.25)', background: '#F8F7F4' }}>
          {selected?.label || 'Global'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setViewMode('separated')} style={btnStyle(viewMode === 'separated')}>Vue séparée</button>
          <button onClick={() => setViewMode('all')}       style={btnStyle(viewMode === 'all')}>Vue All</button>
        </div>
        {viewMode === 'separated' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all','Toutes'],['sale','Sale'],['kenitra','Kenitra']].map(([k,l]) => (
              <button key={k} onClick={() => setFilterEquipe(k)} style={btnStyle(filterEquipe === k)}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total passagers', value: totalGlobal, color: '#C9A84C', sub: selected?.label || 'Global' },
          { label: 'Équipe Sale',    value: totParEquipe.sale,    color: '#C9A84C', sub: totalGlobal > 0 ? `${Math.round(totParEquipe.sale/totalGlobal*100)}% du total` : '—' },
          { label: 'Équipe Kenitra', value: totParEquipe.kenitra, color: '#534AB7', sub: totalGlobal > 0 ? `${Math.round(totParEquipe.kenitra/totalGlobal*100)}% du total` : '—' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: `1px solid ${k.color}25`, borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Courbe + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(201,168,76,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', marginBottom: 16 }}>Évolution des passages</div>
          {chartData.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A7A', fontSize: 13 }}>Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A8A7A' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8A7A' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sale"    name="Équipe Sale"    stroke="#C9A84C" strokeWidth={2.5} dot={{ r: 4, fill: '#C9A84C', stroke: '#fff', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="kenitra" name="Équipe Kenitra" stroke="#534AB7" strokeWidth={2.5} dot={{ r: 4, fill: '#534AB7', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(201,168,76,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', marginBottom: 8 }}>Répartition</div>
          {donutData.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A7A', fontSize: 13 }}>Aucune donnée</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} passagers`]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {donutData.map(d => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                      <span style={{ color: '#5A5A5A' }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: d.color }}>{d.value} ({Math.round(d.value/totalGlobal*100)}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Vue All */}
      {viewMode === 'all' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '4px solid #C9A84C' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 600, color: '#C9A84C' }}>Ranking Global</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C' }}>{totalGlobal}</div>
          </div>
          <div>
            {[...commerciaux.filter(c => !c.nom.includes('Non reconnu'))]
              .map(c => ({ ...c, val: totParCommercial[c.id] || 0 }))
              .sort((a, b) => b.val - a.val)
              .map((c, i, arr) => {
                const pct = arr[0]?.val > 0 ? (c.val / arr[0].val) * 100 : 0
                const rankColor = getRankColor(i, arr.length)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid rgba(201,168,76,0.05)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 24, fontSize: 14, fontWeight: 700, color: rankColor, textAlign: 'center', flexShrink: 0 }}>{i+1}</div>
                    <div style={{ width: 160, fontSize: 13, fontWeight: 500, color: '#2C2C2C', flexShrink: 0 }}>{c.nom}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${EQUIPES[c.equipe]?.color}15`, color: EQUIPES[c.equipe]?.color, flexShrink: 0 }}>{EQUIPES[c.equipe]?.label}</span>
                    <div style={{ flex: 1, height: 7, background: 'rgba(201,168,76,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: rankColor, borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 44, fontSize: 13, fontWeight: 700, color: rankColor, textAlign: 'right', flexShrink: 0 }}>{c.val}</div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Vue séparée */}
      {viewMode === 'separated' && (
        <div style={{ display: 'grid', gridTemplateColumns: filterEquipe === 'all' ? '1fr 1fr' : '1fr', gap: 16 }}>
          {equipes.map(eq => {
            const ranking = getRanking(eq)
            const total   = totParEquipe[eq] || 0
            const maxVal  = Math.max(...ranking.map(c => c.val), 1)
            const cv      = calcCV(ranking.map(c => c.val))
            return (
              <div key={eq} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `4px solid ${EQUIPES[eq].color}` }}>
                  <div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 600, color: EQUIPES[eq].color }}>{EQUIPES[eq].label}</div>
                    <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 2 }}>
                      Resp: {EQUIPES[eq].responsable} · CV: <span style={{ color: cv > 50 ? '#E05C5C' : '#4CAF7D', fontWeight: 500 }}>{cv}%</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: EQUIPES[eq].color }}>{total}</div>
                  </div>
                </div>
                <div>
                  {ranking.map((c, i) => {
                    const pct = maxVal > 0 ? (c.val / maxVal) * 100 : 0
                    const rankColor = getRankColor(i, ranking.length)
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid rgba(201,168,76,0.05)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 22, fontSize: 14, fontWeight: 700, color: rankColor, textAlign: 'center', flexShrink: 0 }}>{i+1}</div>
                        <div style={{ width: 140, fontSize: 13, fontWeight: 500, color: '#2C2C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{c.nom}</div>
                        <div style={{ flex: 1, height: 7, background: 'rgba(201,168,76,0.1)', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: rankColor, borderRadius: 5, transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ width: 44, fontSize: 13, fontWeight: 700, color: rankColor, textAlign: 'right', flexShrink: 0 }}>{c.val}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import PageHeader from '../components/PageHeader'
import DrillNav from '../components/DrillNav'
import { supabase } from '../lib/supabase'

const EQUIPES = {
  sale:    { label: 'Équipe Sale',    color: '#C9A84C', responsable: 'Abdelhakim Rhalmi' },
  kenitra: { label: 'Équipe Kenitra', color: '#534AB7', responsable: 'Karima Snaiki' },
}

function calcCV(vals) {
  const v = vals.filter(x => x > 0)
  if (v.length < 2) return 0
  const moy = v.reduce((a, b) => a + b, 0) / v.length
  if (moy === 0) return 0
  const variance = v.reduce((s, x) => s + Math.pow(x - moy, 2), 0) / v.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
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

function filterBySelected(items, selected, dateField = 'date') {
  if (!selected || selected.type === 'global') return items
  if (selected.type === 'custom') return items.filter(s => { const d = s[dateField]; return d && d >= selected.from && d <= selected.to })
  if (selected.type === 'year') return items.filter(s => { const d = s[dateField]; return d && d.startsWith(String(selected.value)) })
  if (selected.type === 'quarter') {
    const [y, q] = selected.value.split('-Q')
    return items.filter(s => { const raw = s[dateField]; if (!raw) return false; const d = new Date(String(raw).substring(0,10) + 'T12:00:00'); return d.getFullYear() === parseInt(y) && Math.floor(d.getMonth()/3) === parseInt(q)-1 })
  }
  if (selected.type === 'month') return items.filter(s => { const d = s[dateField]; return d && d.startsWith(selected.value) })
  if (selected.type === 'day')   return items.filter(s => { const d = s[dateField]; return d && d.startsWith(selected.value) })
  return items
}

const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export default function Passagers() {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'

  const [passagers, setPassagers]     = useState([])
  const [commerciaux, setCommerciaux] = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(() => {
    const saved = localStorage.getItem('jg_selected_passagers')
    if (saved) try { return JSON.parse(saved) } catch(e) {}
    const now = new Date()
    const mKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    return { type: 'month', value: mKey, label: `${MOIS_SHORT[now.getMonth()]} ${now.getFullYear()}` }
  })
  const [viewMode,     setViewMode]     = useState('separated')
  const [filterEquipe, setFilterEquipe] = useState('all')

  useEffect(() => { localStorage.setItem('jg_selected_passagers', JSON.stringify(selected)) }, [selected])
  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: comms }, { data: pass }] = await Promise.all([
      supabase.from('commerciaux').select('*').eq('actif', true).order('equipe').order('nom'),
      supabase.from('passagers').select('*, commerciaux(nom, equipe)').order('date', { ascending: true }),
    ])
    setCommerciaux(comms || [])
    setPassagers(pass || [])
    setLoading(false)
  }

  // Filtrer selon DrillNav
  const passagersFiltres = useMemo(() => filterBySelected(passagers, selected, 'date'), [passagers, selected])

  // Totaux par commercial
  const totParCommercial = useMemo(() => {
    const res = {}
    passagersFiltres.forEach(p => {
      if (!p.commercial_id) return
      res[p.commercial_id] = (res[p.commercial_id] || 0) + (p.count || 0)
    })
    return res
  }, [passagersFiltres])

  // Totaux par équipe
  const totParEquipe = useMemo(() => {
    const res = { sale: 0, kenitra: 0 }
    passagersFiltres.forEach(p => {
      const eq = p.region || p.commerciaux?.equipe
      if (eq === 'sale' || eq === 'kenitra') res[eq] += (p.count || 0)
    })
    return res
  }, [passagersFiltres])

  const totalGlobal = totParEquipe.sale + totParEquipe.kenitra

  // Ranking par équipe
  function getRanking(equipe) {
    const comms = commerciaux.filter(c => c.equipe === equipe && !c.nom.includes('Non reconnu'))
    return comms
      .map(c => ({ ...c, val: totParCommercial[c.id] || 0 }))
      .sort((a, b) => b.val - a.val)
  }

  // Données graphe évolution par équipe (regroupé par mois ou jour)
  const chartData = useMemo(() => {
    const isJour = selected.type === 'month' || selected.type === 'day' || selected.type === 'custom'
    const groups = {}

    passagers.forEach(p => {
      const d = new Date(p.date + 'T12:00:00')
      const key = isJour
        ? p.date
        : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if (!groups[key]) groups[key] = { sale: 0, kenitra: 0 }
      const eq = p.region || p.commerciaux?.equipe
      if (eq === 'sale' || eq === 'kenitra') groups[key][eq] += (p.count || 0)
    })

    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([key, val]) => {
      const label = isJour
        ? new Date(key + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : `${MOIS_SHORT[new Date(key+'-02T12:00:00').getMonth()]} ${new Date(key+'-02T12:00:00').getFullYear()}`
      return { key, label, ...val }
    })
  }, [passagers, selected])

  // Données donut
  const donutData = useMemo(() => [
    { name: 'Équipe Sale',    value: totParEquipe.sale,    color: '#C9A84C' },
    { name: 'Équipe Kenitra', value: totParEquipe.kenitra, color: '#534AB7' },
  ].filter(d => d.value > 0), [totParEquipe])

  const btnStyle = (active, color = '#C9A84C') => ({
    padding: '6px 14px', borderRadius: 16,
    border: `1.5px solid ${active ? color : 'rgba(201,168,76,0.2)'}`,
    background: active ? color : '#fff', color: active ? '#fff' : '#5A5A5A',
    fontSize: 12, fontWeight: active ? 500 : 400, cursor: 'pointer', transition: 'all 0.15s',
  })

  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }

  const equipes = viewMode === 'separated'
    ? (filterEquipe === 'all' ? ['sale', 'kenitra'] : [filterEquipe])
    : []

  if (loading) return <div style={{ padding: 32, color: '#5A5A5A', fontSize: 14 }}>Chargement...</div>

  return (
    <div>
      <PageHeader title="Module Passagers" subtitle="Suivi des passages par commercial et région" />

      {/* DrillNav */}
      <DrillNav data={passagers} onSelect={setSelected} selected={selected} dateField="date" />

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#C9A84C', padding: '6px 14px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.25)', background: '#F8F7F4' }}>
          {selected?.label || 'Global'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setViewMode('separated')} style={btnStyle(viewMode === 'separated')}>Vue séparée</button>
          <button onClick={() => setViewMode('all')}       style={btnStyle(viewMode === 'all')}>Vue All</button>
        </div>
        {viewMode === 'separated' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all','Toutes'],['sale','Sale'],['kenitra','Kenitra']].map(([k,l]) => (
              <button key={k} onClick={() => setFilterEquipe(k)} style={btnStyle(filterEquipe === k)}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* KPIs globaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #C9A84C' }}>
          <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Total passagers</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#C9A84C' }}>{totalGlobal}</div>
          <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{selected?.label || 'Global'}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(201,168,76,0.15)', borderTop: `3px solid ${EQUIPES.sale.color}` }}>
          <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Équipe Sale</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: EQUIPES.sale.color }}>{totParEquipe.sale}</div>
          <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{totalGlobal > 0 ? `${Math.round(totParEquipe.sale/totalGlobal*100)}%` : '—'} du total</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(83,74,183,0.15)', borderTop: `3px solid ${EQUIPES.kenitra.color}` }}>
          <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Équipe Kenitra</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: EQUIPES.kenitra.color }}>{totParEquipe.kenitra}</div>
          <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>{totalGlobal > 0 ? `${Math.round(totParEquipe.kenitra/totalGlobal*100)}%` : '—'} du total</div>
        </div>
      </div>

      {/* Graphes courbe + donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Courbe évolution */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(201,168,76,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', marginBottom: 16 }}>
            Évolution des passages
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A7A', fontSize: 13 }}>Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A8A7A' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8A7A' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sale"    name="Équipe Sale"    stroke="#C9A84C" strokeWidth={2.5} dot={{ r: 4, fill: '#C9A84C',    stroke: '#fff', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="kenitra" name="Équipe Kenitra" stroke="#534AB7" strokeWidth={2.5} dot={{ r: 4, fill: '#534AB7', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(201,168,76,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', marginBottom: 16, alignSelf: 'flex-start' }}>
            Répartition
          </div>
          {donutData.length === 0 ? (
            <div style={{ color: '#8A8A7A', fontSize: 13 }}>Aucune donnée</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} passagers`]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {donutData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                      <span style={{ color: '#5A5A5A' }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: d.color }}>{d.value} ({Math.round(d.value/totalGlobal*100)}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Vue All */}
      {viewMode === 'all' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '4px solid #C9A84C' }}>
            <div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 600, color: '#C9A84C' }}>Ranking Global — Toutes équipes</div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 2 }}>CV: <span style={{ color: calcCV(Object.values(totParCommercial)) > 50 ? '#E05C5C' : '#4CAF7D', fontWeight: 500 }}>{calcCV(Object.values(totParCommercial))}%</span></div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C' }}>{totalGlobal}</div>
          </div>
          <div>
            {[...commerciaux.filter(c => !c.nom.includes('Non reconnu'))]
              .map(c => ({ ...c, val: totParCommercial[c.id] || 0 }))
              .sort((a, b) => b.val - a.val)
              .map((c, i, arr) => {
                const pct = arr[0]?.val > 0 ? (c.val / arr[0].val) * 100 : 0
                const rankColor = getRankColor(i, arr.length)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid rgba(201,168,76,0.05)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 24, fontSize: 14, fontWeight: 700, color: rankColor, textAlign: 'center', flexShrink: 0 }}>{i+1}</div>
                    <div style={{ width: 160, fontSize: 13, fontWeight: 500, color: '#2C2C2C', flexShrink: 0 }}>{c.nom}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${EQUIPES[c.equipe]?.color}15`, color: EQUIPES[c.equipe]?.color, flexShrink: 0 }}>{EQUIPES[c.equipe]?.label}</span>
                    <div style={{ flex: 1, height: 7, background: 'rgba(201,168,76,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: rankColor, borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 44, fontSize: 13, fontWeight: 700, color: rankColor, textAlign: 'right', flexShrink: 0 }}>{c.val}</div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Vue séparée */}
      {viewMode === 'separated' && (
        <div style={{ display: 'grid', gridTemplateColumns: filterEquipe === 'all' ? '1fr 1fr' : '1fr', gap: 16 }}>
          {equipes.map(eq => {
            const ranking = getRanking(eq)
            const total   = totParEquipe[eq] || 0
            const maxVal  = Math.max(...ranking.map(c => c.val), 1)
            const cv      = calcCV(ranking.map(c => c.val))
            return (
              <div key={eq} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `4px solid ${EQUIPES[eq].color}` }}>
                  <div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 600, color: EQUIPES[eq].color }}>{EQUIPES[eq].label}</div>
                    <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 2 }}>
                      Resp: {EQUIPES[eq].responsable} · CV: <span style={{ color: cv > 50 ? '#E05C5C' : '#4CAF7D', fontWeight: 500 }}>{cv}%</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase' }}>Total passagers</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: EQUIPES[eq].color }}>{total}</div>
                  </div>
                </div>
                <div>
                  {ranking.map((c, i) => {
                    const pct      = maxVal > 0 ? (c.val / maxVal) * 100 : 0
                    const rankColor = getRankColor(i, ranking.length)
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid rgba(201,168,76,0.05)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 22, fontSize: 14, fontWeight: 700, color: rankColor, textAlign: 'center', flexShrink: 0 }}>{i+1}</div>
                        <div style={{ width: 140, fontSize: 13, fontWeight: 500, color: '#2C2C2C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{c.nom}</div>
                        <div style={{ flex: 1, height: 7, background: 'rgba(201,168,76,0.1)', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: rankColor, borderRadius: 5, transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ width: 44, fontSize: 13, fontWeight: 700, color: rankColor, textAlign: 'right', flexShrink: 0 }}>{c.val}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
