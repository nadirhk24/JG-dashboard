import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'
import { supabase } from '../lib/supabase'

const EQUIPES = {
  sale: { label: 'Équipe Sale', color: '#C9A84C', responsable: 'Abdelhakim Rhalmi' },
  kenitra: { label: 'Équipe Kenitra', color: '#534AB7', responsable: 'Karima Snaiki' },
}

const KPIS = [
  { key: 'rdv', label: 'RDV Fixés', color: '#C9A84C' },
  { key: 'visites', label: 'Visites', color: '#4CAF7D' },
  { key: 'ventes', label: 'Ventes', color: '#1a6b3c' },
  { key: 'taux_presence', label: 'Taux Présence', color: '#378ADD', isRate: true },
  { key: 'taux_vente', label: 'Taux Vente', color: '#534AB7', isRate: true },
]

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function getMoisOptions() {
  const now = new Date()
  const options = []
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = `${MOIS_LABELS[d.getMonth()]} ${d.getFullYear()}`
    options.push({ val, label })
  }
  return options
}

function calcCV(vals) {
  const v = vals.filter(x => x > 0)
  if (v.length < 2) return 0
  const moy = v.reduce((a, b) => a + b, 0) / v.length
  if (moy === 0) return 0
  const variance = v.reduce((sum, x) => sum + Math.pow(x - moy, 2), 0) / v.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

function getKpiValue(data, kpi) {
  if (kpi === 'taux_presence') {
    return data.rdv > 0 ? parseFloat(((data.visites / data.rdv) * 100).toFixed(1)) : 0
  }
  if (kpi === 'taux_vente') {
    return data.visites > 0 ? parseFloat(((data.ventes / data.visites) * 100).toFixed(1)) : 0
  }
  return parseFloat((data[kpi] || 0).toFixed(1))
}

function getColorFromValue(value, max, kpi) {
  if (!value || value === 0) return { bg: '#F8F7F4', color: '#8A8A7A', border: 'rgba(0,0,0,0.06)' }
  const ratio = max > 0 ? value / max : 0
  const baseColor = KPIS.find(k => k.key === kpi)?.color || '#C9A84C'
  if (ratio >= 0.8) return { bg: `${baseColor}20`, color: baseColor, border: `${baseColor}40` }
  if (ratio >= 0.5) return { bg: `${baseColor}10`, color: baseColor, border: `${baseColor}25` }
  return { bg: '#F8F7F4', color: '#8A8A7A', border: 'rgba(0,0,0,0.06)' }
}

export default function FluxRDV({ conseilleres }) {
  const [commerciaux, setCommerciaux] = useState([])
  const [fluxData, setFluxData] = useState([])
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState('rdv')
  const [kpiCompare, setKpiCompare] = useState('visites')
  const [showCompare, setShowCompare] = useState(false)
  const [showSaisie, setShowSaisie] = useState(false)
  const [saisieConseillere, setSaisieConseillere] = useState('')
  const moisOptions = getMoisOptions()
  const currentMois = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
  const [saisieMois, setSaisieMois] = useState(currentMois)
  const [saisieForm, setSaisieForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [filterEquipe, setFilterEquipe] = useState('all')
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

  // Aggrger flux par commercial pour la periode selectionnee
  const fluxParCommercial = useMemo(() => {
    const filtered = fluxData.filter(f => {
      const moisDebut = f.date_debut?.substring(0, 7)
      return moisDebut === selectedPeriod || f.date_debut?.startsWith(selectedPeriod)
    })
    const agg = {}
    filtered.forEach(f => {
      if (!agg[f.commercial_id]) agg[f.commercial_id] = { rdv: 0, visites: 0, ventes: 0 }
      agg[f.commercial_id].rdv += parseFloat(f.rdv || 0)
      agg[f.commercial_id].visites += parseFloat(f.visites || 0)
      agg[f.commercial_id].ventes += parseFloat(f.ventes || 0)
    })
    return agg
  }, [fluxData, selectedPeriod])

  // Stats par equipe pour comparaison
  const statsParEquipe = useMemo(() => {
    const result = {}
    Object.keys(EQUIPES).forEach(eq => {
      const comms = commerciaux.filter(c => c.equipe === eq)
      const totaux = comms.reduce((acc, c) => {
        const d = fluxParCommercial[c.id] || { rdv: 0, visites: 0, ventes: 0 }
        return { rdv: acc.rdv + d.rdv, visites: acc.visites + d.visites, ventes: acc.ventes + d.ventes }
      }, { rdv: 0, visites: 0, ventes: 0 })
      result[eq] = {
        ...totaux,
        taux_presence: totaux.rdv > 0 ? parseFloat(((totaux.visites / totaux.rdv) * 100).toFixed(1)) : 0,
        taux_vente: totaux.visites > 0 ? parseFloat(((totaux.ventes / totaux.visites) * 100).toFixed(1)) : 0,
        cv_rdv: calcCV(comms.map(c => (fluxParCommercial[c.id] || {}).rdv || 0)),
        cv_visites: calcCV(comms.map(c => (fluxParCommercial[c.id] || {}).visites || 0)),
        cv_ventes: calcCV(comms.map(c => (fluxParCommercial[c.id] || {}).ventes || 0)),
      }
    })
    return result
  }, [commerciaux, fluxParCommercial])

  // Donnees pour graphe comparaison
  const compareData = useMemo(() => {
    return Object.keys(EQUIPES).map(eq => ({
      label: EQUIPES[eq].label,
      [kpi]: statsParEquipe[eq]?.[kpi] || 0,
      [kpiCompare]: statsParEquipe[eq]?.[kpiCompare] || 0,
    }))
  }, [statsParEquipe, kpi, kpiCompare])

  const maxKpiVal = useMemo(() => {
    const vals = commerciaux.map(c => getKpiValue(fluxParCommercial[c.id] || {rdv:0,visites:0,ventes:0}, kpi))
    return Math.max(...vals, 1)
  }, [commerciaux, fluxParCommercial, kpi])

  async function handleSaisie() {
    if (!saisieConseillere) { setMsg({ type: 'error', text: 'Sélectionne une conseillère' }); return }
    const entries = Object.entries(saisieForm).filter(([_, v]) => v.rdv || v.visites || v.ventes)
    if (entries.length === 0) { setMsg({ type: 'error', text: 'Saisis au moins une donnée' }); return }
    setSaving(true)
    const dateDebut = `${saisieMois}-01`
    const lastDay = new Date(parseInt(saisieMois.split('-')[0]), parseInt(saisieMois.split('-')[1]), 0).getDate()
    const dateFin = `${saisieMois}-${String(lastDay).padStart(2,'0')}`

    // Supprimer les anciennes saisies pour cette periode/conseillere
    await supabase.from('flux_rdv').delete()
      .eq('conseillere_id', saisieConseillere)
      .gte('date_debut', dateDebut).lte('date_fin', dateFin)

    const rows = entries.map(([commercialId, vals]) => ({
      conseillere_id: saisieConseillere,
      commercial_id: commercialId,
      date_debut: dateDebut,
      date_fin: dateFin,
      type_saisie: 'periode',
      rdv: parseFloat(vals.rdv) || 0,
      visites: parseFloat(vals.visites) || 0,
      ventes: parseFloat(vals.ventes) || 0,
    }))

    const { error } = await supabase.from('flux_rdv').insert(rows)
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'success', text: `${rows.length} saisie(s) enregistrée(s) !` })
      loadData()
      setSaisieForm({})
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const inputStyle = { width: '60px', padding: '5px 8px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 6, fontSize: 12, textAlign: 'center', background: '#F8F7F4', outline: 'none' }
  const selectedKpi = KPIS.find(k => k.key === kpi)
  const selectedKpiCompare = KPIS.find(k => k.key === kpiCompare)
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }

  if (loading) return <div style={{ padding: 32, color: '#5A5A5A' }}>Chargement...</div>

  return (
    <div>
      <PageHeader title="Flux de Rendez-vous" subtitle="Performance commerciale par équipe et par commercial" />

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} style={{ padding: '8px 32px 8px 14px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.25)', background: '#fff', fontSize: 13, color: '#2C2C2C', outline: 'none', appearance: 'none', cursor: 'pointer' }}>
            {moisOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', fontSize: 11 }}>▼</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all','Toutes'], ['sale','Sale'], ['kenitra','Kenitra']].map(([k, l]) => (
            <button key={k} onClick={() => setFilterEquipe(k)} style={{ padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${filterEquipe===k?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: filterEquipe===k?'#C9A84C':'#fff', color: filterEquipe===k?'#fff':'#5A5A5A', fontSize: 12, fontWeight: filterEquipe===k?500:400, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <button onClick={() => setShowSaisie(p=>!p)} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showSaisie?'#C9A84C':'#fff', color: showSaisie?'#fff':'#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer', marginLeft: 'auto' }}>
          {showSaisie ? '✕ Fermer' : '+ Saisir données'}
        </button>
      </div>

      {/* Saisie */}
      {showSaisie && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1.5px solid #C9A84C', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#2C2C2C', marginBottom: 16 }}>Saisie des RDV par conseillère</div>
          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500, background: msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conseillère</div>
              <select value={saisieConseillere} onChange={e => setSaisieConseillere(e.target.value)} style={{ padding: '8px 32px 8px 12px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.25)', background: '#F8F7F4', fontSize: 13, outline: 'none', appearance: 'none', minWidth: 200 }}>
                <option value="">Sélectionner...</option>
                {conseilleres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mois</div>
              <select value={saisieMois} onChange={e => setSaisieMois(e.target.value)} style={{ padding: '8px 32px 8px 12px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.25)', background: '#F8F7F4', fontSize: 13, outline: 'none', appearance: 'none' }}>
                {moisOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {Object.keys(EQUIPES).map(eq => (
            <div key={eq} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: EQUIPES[eq].color, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: EQUIPES[eq].color, display: 'inline-block' }}></span>
                {EQUIPES[eq].label} — {EQUIPES[eq].responsable}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500, minWidth: 160 }}>Commercial</th>
                      <th style={{ fontSize: 10, color: '#C9A84C', textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>RDV Fixés</th>
                      <th style={{ fontSize: 10, color: '#4CAF7D', textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Visites</th>
                      <th style={{ fontSize: 10, color: '#1a6b3c', textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Ventes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commerciaux.filter(c => c.equipe === eq).map(c => (
                      <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 500 }}>{c.nom}</td>
                        {['rdv','visites','ventes'].map(field => (
                          <td key={field} style={{ padding: '5px 10px', textAlign: 'center' }}>
                            <input type="number" min="0" step="0.5"
                              value={saisieForm[c.id]?.[field] || ''}
                              onChange={e => setSaisieForm(prev => ({ ...prev, [c.id]: { ...(prev[c.id]||{}), [field]: e.target.value } }))}
                              placeholder="0" style={inputStyle}/>
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(201,168,76,0.05)', fontWeight: 600 }}>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: EQUIPES[eq].color }}>Total {EQUIPES[eq].label}</td>
                      {['rdv','visites','ventes'].map(field => (
                        <td key={field} style={{ padding: '8px 10px', fontSize: 12, textAlign: 'center', color: '#2C2C2C' }}>
                          {commerciaux.filter(c => c.equipe === eq).reduce((sum, c) => sum + (parseFloat(saisieForm[c.id]?.[field]) || 0), 0)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
            <button onClick={handleSaisie} disabled={saving} style={{ background: saving?'#E8D5A3':'#C9A84C', color:'#fff', border:'none', padding:'11px 28px', borderRadius:8, fontSize:13, fontWeight:500, cursor:saving?'wait':'pointer' }}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <div style={{ fontSize: 12, color: '#5A5A5A' }}>
              Total global — RDV: <strong>{commerciaux.reduce((s,c) => s+(parseFloat(saisieForm[c.id]?.rdv)||0),0)}</strong> · Visites: <strong>{commerciaux.reduce((s,c) => s+(parseFloat(saisieForm[c.id]?.visites)||0),0)}</strong> · Ventes: <strong>{commerciaux.reduce((s,c) => s+(parseFloat(saisieForm[c.id]?.ventes)||0),0)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Sélecteur KPI */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginRight: 4 }}>KPI affiché :</div>
        {KPIS.map(k => (
          <button key={k.key} onClick={() => setKpi(k.key)} style={{ padding: '6px 14px', borderRadius: 16, border: `1.5px solid ${kpi===k.key?k.color:'rgba(201,168,76,0.2)'}`, background: kpi===k.key?k.color:'#fff', color: kpi===k.key?'#fff':'#5A5A5A', fontSize: 12, fontWeight: kpi===k.key?500:400, cursor: 'pointer' }}>{k.label}</button>
        ))}
      </div>

      {/* Cartes stats equipes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {Object.keys(EQUIPES).filter(eq => filterEquipe === 'all' || filterEquipe === eq).map(eq => {
          const stats = statsParEquipe[eq] || {}
          const comms = commerciaux.filter(c => c.equipe === eq)
          return (
            <div key={eq} style={{ background: '#fff', borderRadius: 14, padding: 20, border: `1px solid rgba(201,168,76,0.15)`, borderTop: `4px solid ${EQUIPES[eq].color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: EQUIPES[eq].color }}>{EQUIPES[eq].label}</div>
                  <div style={{ fontSize: 11, color: '#5A5A5A' }}>Resp: {EQUIPES[eq].responsable} · {comms.length} commerciaux</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 2 }}>CV RDV</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: stats.cv_rdv > 30 ? '#E05C5C' : '#4CAF7D' }}>{stats.cv_rdv || 0}%</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                {[['rdv','RDV','#C9A84C'],['visites','Visites','#4CAF7D'],['ventes','Ventes','#1a6b3c']].map(([k,l,c]) => (
                  <div key={k} style={{ background: `${c}10`, borderRadius: 8, padding: '10px 12px', border: `1px solid ${c}25` }}>
                    <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{stats[k] || 0}</div>
                  </div>
                ))}
              </div>
              {/* Mini grille commerciaux */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {comms.map(c => {
                  const d = fluxParCommercial[c.id] || { rdv: 0, visites: 0, ventes: 0 }
                  const val = getKpiValue(d, kpi)
                  const { bg, color, border } = getColorFromValue(val, maxKpiVal, kpi)
                  return (
                    <div key={c.id} style={{ background: bg, borderRadius: 8, padding: '8px 10px', border: `1px solid ${border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#5A5A5A', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.nom}>{c.nom.split(' ')[0]}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}{selectedKpi?.isRate ? '%' : ''}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparaison inter-équipes */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>Comparaison inter-équipes</div>
        <button onClick={() => setShowCompare(p=>!p)} style={{ padding: '7px 16px', borderRadius: 16, border: `1.5px solid ${showCompare?'#C9A84C':'rgba(201,168,76,0.25)'}`, background: showCompare?'#C9A84C':'#fff', color: showCompare?'#fff':'#C9A84C', fontSize: 12, cursor: 'pointer' }}>
          {showCompare ? '▲ Fermer' : '▼ Comparer 2 KPIs'}
        </button>
      </div>
      {showCompare && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>KPI 1</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {KPIS.map(k => <button key={k.key} onClick={() => setKpi(k.key)} style={{ padding: '5px 12px', borderRadius: 12, border: `1.5px solid ${kpi===k.key?k.color:'rgba(201,168,76,0.2)'}`, background: kpi===k.key?k.color:'#fff', color: kpi===k.key?'#fff':'#5A5A5A', fontSize: 11, cursor: 'pointer' }}>{k.label}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>KPI 2</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {KPIS.map(k => <button key={k.key} onClick={() => setKpiCompare(k.key)} style={{ padding: '5px 12px', borderRadius: 12, border: `1.5px solid ${kpiCompare===k.key?k.color:'rgba(201,168,76,0.2)'}`, background: kpiCompare===k.key?k.color:'#fff', color: kpiCompare===k.key?'#fff':'#5A5A5A', fontSize: 11, cursor: 'pointer' }}>{k.label}</button>)}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 8 }}>{selectedKpi?.label} par équipe</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => selectedKpi?.isRate ? `${v}%` : v}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [selectedKpi?.isRate ? `${v}%` : v, selectedKpi?.label]}/>
                  <Bar dataKey={kpi} fill={selectedKpi?.color} radius={[4,4,0,0]} name={selectedKpi?.label}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 8 }}>{selectedKpiCompare?.label} par équipe</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)"/>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => selectedKpiCompare?.isRate ? `${v}%` : v}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [selectedKpiCompare?.isRate ? `${v}%` : v, selectedKpiCompare?.label]}/>
                  <Bar dataKey={kpiCompare} fill={selectedKpiCompare?.color} radius={[4,4,0,0]} name={selectedKpiCompare?.label}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tableau détaillé */}
      <SectionTitle>Détail par commercial</SectionTitle>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Équipe','Commercial','RDV Fixés','Visites','Ventes','Tx Présence','Tx Vente'].map(h => (
                  <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(EQUIPES).filter(eq => filterEquipe === 'all' || filterEquipe === eq).flatMap(eq =>
                commerciaux.filter(c => c.equipe === eq).map((c, i, arr) => {
                  const d = fluxParCommercial[c.id] || { rdv: 0, visites: 0, ventes: 0 }
                  const txPresence = d.rdv > 0 ? parseFloat(((d.visites/d.rdv)*100).toFixed(1)) : 0
                  const txVente = d.visites > 0 ? parseFloat(((d.ventes/d.visites)*100).toFixed(1)) : 0
                  return (
                    <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      {i === 0 ? <td rowSpan={arr.length} style={{ padding: '10px', fontSize: 12, fontWeight: 600, color: EQUIPES[eq].color, borderBottom: '1px solid rgba(201,168,76,0.15)', verticalAlign: 'top', borderLeft: `3px solid ${EQUIPES[eq].color}` }}>{EQUIPES[eq].label}</td> : null}
                      <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{c.nom}</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, color: '#C9A84C', fontWeight: 500, borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{d.rdv}</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, color: '#4CAF7D', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{d.visites}</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, color: '#1a6b3c', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{d.ventes}</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, color: txPresence > 20 ? '#4CAF7D' : '#E05C5C', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{txPresence}%</td>
                      <td style={{ padding: '9px 10px', fontSize: 12, color: txVente > 5 ? '#1a6b3c' : '#8A8A7A', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>{txVente}%</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
