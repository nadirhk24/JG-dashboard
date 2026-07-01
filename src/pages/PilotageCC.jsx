// PilotageCC.jsx - v1.0 - Module Pilotage Centre d'Appel
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import DrillNav from '../components/DrillNav'
import { filtrerParSelection } from '../lib/dates'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MOIS_SHORT  = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function getMoisCourant() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
}

function getMoisLabel(mois) {
  const [y, m] = mois.split('-')
  return `${MOIS_LABELS[parseInt(m)-1]} ${y}`
}

function prorataFactor(selected) {
  const now = new Date()
  const mc = getMoisCourant()
  if (selected?.type !== 'month' || selected?.value !== mc) return 1
  const y = now.getFullYear(), mo = now.getMonth()
  const today = now.getDate()
  const last  = new Date(y, mo+1, 0).getDate()
  let ec = 0, tot = 0
  for (let d = 1; d <= last; d++) { if (new Date(y,mo,d).getDay()!==0) { tot++; if(d<=today) ec++ } }
  return tot > 0 ? ec/tot : 1
}

export default function PilotageCC({ saisies }) {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'

  // ── States ──────────────────────────────────────────────────────────────────
  const [projets,    setProjets]    = useState([])
  const [commerciaux,setCommerciaux]= useState([])
  const [sourcesRef, setSourcesRef] = useState([])
  const [leads,      setLeads]      = useState([])
  const [leadsSources,setLeadsSources]=useState([])
  const [visites,    setVisites]    = useState([])
  const [objCC,      setObjCC]      = useState([])
  const [fluxVentes, setFluxVentes] = useState([])
  const [objVentesProjets, setObjVentesProjets] = useState([])
  const [stockParProjet,   setStockParProjet]   = useState({})
  const [projetsCommerciaux, setProjetsCommerciaux] = useState([]) // { commercial_id, projet_id }

  const [selected,   setSelected]   = useState(() => {
    const n = new Date()
    const mk = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
    return { type:'month', value: mk, label: getMoisLabel(mk) }
  })
  const [selectedProjet, setSelectedProjet] = useState('all')
  const [activeTab,  setActiveTab]  = useState('tableau-bord') // 'tableau-bord'|'leads'|'visites'|'objectifs'|'sources'

  // Popups
  const [popupLeads,    setPopupLeads]    = useState(null) // { leadId, date, projetId, total }
  const [popupVisites,  setPopupVisites]  = useState(null) // { mois, commId, projetId }
  const [popupObjCC,    setPopupObjCC]    = useState(null) // { projetId, mois }
  const [popupSaisie,   setPopupSaisie]   = useState(null) // { date, projetId }

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState(null)

  // Forms
  const [formLead,   setFormLead]   = useState({ date: '', projet_id: '', leads_declares: '', rdv_declares: '' })
  const [formSources,setFormSources]= useState([]) // [{ source, nombre }]
  const [formVisites,setFormVisites]= useState({ visites_m_en_cours: '', visites_m1: '', visites_recuperees: '' })
  const [formObjCC,  setFormObjCC]  = useState({ pct_cc: 25, obj_leads: '', obj_rdv: '', obj_visites: '', obj_ventes: '' })
  const [newSource,  setNewSource]  = useState('')

  // ── Load data ────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: proj },
      { data: comm },
      { data: src  },
      { data: ld   },
      { data: ldsrc},
      { data: vis  },
      { data: obj  },
      { data: flux },
      { data: ovp  },
      { data: stk  },
      { data: pc   },
    ] = await Promise.all([
      supabase.from('projets').select('id,nom,objectif_nombre,delai_livraison').eq('statut','actif').order('nom'),
      supabase.from('commerciaux').select('id,nom,equipe').eq('actif',true).order('nom'),
      supabase.from('pilotage_sources_ref').select('*').eq('actif',true).order('ordre'),
      supabase.from('pilotage_leads').select('*').order('date',{ascending:false}),
      supabase.from('pilotage_leads_sources').select('*'),
      supabase.from('pilotage_visites').select('*'),
      supabase.from('pilotage_objectifs_cc').select('*'),
      supabase.from('flux_rdv').select('commercial_id,date_debut,rdv,visites,ventes,type_saisie').gte('date_debut','2026-01-01'),
      supabase.from('objectifs_vente_projets').select('id,nom_projet,delai_mois,tx_vente,tx_presence,tx_conv_tel,tx_joignabilite'),
      supabase.from('objectifs_vente_biens').select('projet_id,stock'),
      supabase.from('projets_commerciaux').select('commercial_id,projet_id'),
    ])
    const stockMap = {}
    ;(stk || []).forEach(s => { stockMap[s.projet_id] = (stockMap[s.projet_id]||0) + (s.stock||0) })
    setProjets(proj || [])
    setCommerciaux(comm || [])
    setSourcesRef(src || [])
    setLeads(ld || [])
    setLeadsSources(ldsrc || [])
    setVisites(vis || [])
    setObjCC(obj || [])
    setFluxVentes(flux || [])
    setObjVentesProjets(ovp || [])
    setStockParProjet(stockMap)
    setProjetsCommerciaux(pc || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Calculs ──────────────────────────────────────────────────────────────────

  // Leads filtrés par selected + projet
  const leadsFiltres = useMemo(() => {
    let data = leads
    if (selected?.type === 'month' && selected?.value) data = data.filter(l => l.date.startsWith(selected.value))
    else if (selected?.type === 'day'   && selected?.value) data = data.filter(l => l.date === selected.value)
    if (selectedProjet !== 'all') data = data.filter(l => l.projet_id === selectedProjet)
    return data
  }, [leads, selected, selectedProjet])

  // Totaux leads réalisés
  const totLeads   = useMemo(() => leadsFiltres.reduce((s,l) => s + (l.leads_declares||0), 0), [leadsFiltres])
  const totRdvCC   = useMemo(() => leadsFiltres.reduce((s,l) => s + (l.rdv_declares||0), 0), [leadsFiltres])

  // Ventes depuis flux_rdv par période
  const ventesFlux = useMemo(() => {
    let f = fluxVentes
    if (selected?.type === 'month' && selected?.value) f = f.filter(x => x.date_debut.startsWith(selected.value))
    else if (selected?.type === 'day' && selected?.value) f = f.filter(x => x.date_debut === selected.value)
    return f.reduce((s,x) => s + parseFloat(x.ventes||0), 0)
  }, [fluxVentes, selected])

  // Visites réelles mois (pour taux de récupération)
  const moisCourant = getMoisCourant()
  const moisM1 = (() => { const [y,m] = moisCourant.split('-'); const d = new Date(parseInt(y),parseInt(m)-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })()

  const visitesTotaux = useMemo(() => {
    const filtreMois = selected?.type === 'month' ? selected.value : moisCourant
    const rows = visites.filter(v => v.mois === filtreMois)
    if (selectedProjet !== 'all') rows.filter(v => v.projet_id === selectedProjet)
    const mc  = rows.reduce((s,v) => s+(v.visites_m_en_cours||0), 0)
    const m1  = rows.reduce((s,v) => s+(v.visites_m1||0), 0)
    const rec = rows.reduce((s,v) => s+(v.visites_recuperees||0), 0)
    const tot = mc + m1 + rec
    return { mc, m1, rec, tot, tauxRec: tot > 0 ? Math.round(((m1+rec)/tot)*100) : 0 }
  }, [visites, selected, selectedProjet, moisCourant])

  // Objectif CC pour le mois sélectionné
  const objCCMois = useMemo(() => {
    if (!selected?.value || selected?.type !== 'month') return null
    return objCC.find(o => o.mois === selected.value && (selectedProjet === 'all' || o.projet_id === selectedProjet)) || null
  }, [objCC, selected, selectedProjet])

  // Prorata pour taux d'atteinte
  const prorata = useMemo(() => prorataFactor(selected), [selected])

  // Taux d'atteinte proratisés
  const tauxAtteinte = useMemo(() => {
    if (!objCCMois) return null
    const objLeadsP  = (objCCMois.obj_leads||0)  * prorata
    const objRdvP    = (objCCMois.obj_rdv||0)    * prorata
    const objVisP    = (objCCMois.obj_visites||0) * prorata
    const objVentesP = (objCCMois.obj_ventes||0)  * prorata
    return {
      leads:  objLeadsP  > 0 ? Math.round((totLeads  / objLeadsP)  * 100) : null,
      rdv:    objRdvP    > 0 ? Math.round((totRdvCC  / objRdvP)    * 100) : null,
      visites:objVisP    > 0 ? Math.round((visitesTotaux.tot / objVisP) * 100) : null,
      ventes: objVentesP > 0 ? Math.round((ventesFlux / objVentesP) * 100) : null,
    }
  }, [objCCMois, prorata, totLeads, totRdvCC, visitesTotaux, ventesFlux])

  // Objectifs CC = KPIs du module Objectifs ÷ 4 (25%)
  function getObjCCAuto(projetId, pctCC = 25) {
    const proj = projets.find(p => p.id === projetId)
    if (!proj) return { obj_leads: 0, obj_rdv: 0, obj_visites: 0, obj_ventes: 0 }
    const ov = objVentesProjets.find(o => o.nom_projet === proj.nom)
    if (!ov || !ov.delai_mois || !ov.tx_vente || !ov.tx_presence || !ov.tx_conv_tel || !ov.tx_joignabilite)
      return { obj_leads: 0, obj_rdv: 0, obj_visites: 0, obj_ventes: 0 }
    // Même calcul que Objectifs.jsx calcFunnel
    const tv = parseFloat(ov.tx_vente)        / 100
    const tp = parseFloat(ov.tx_presence)     / 100
    const tc = parseFloat(ov.tx_conv_tel)     / 100
    const tj = parseFloat(ov.tx_joignabilite) / 100
    const stock = stockParProjet[ov.id] || 0
    const d     = parseInt(ov.delai_mois) || 1
    if (!stock || !tv || !tp || !tc || !tj) return { obj_leads: 0, obj_rdv: 0, obj_visites: 0, obj_ventes: 0 }
    const obj_mois = Math.round(stock / d)
    const visites  = Math.ceil(obj_mois / tv)
    const rdv      = Math.ceil(visites  / tp)
    const echanges = Math.ceil(rdv      / tc)
    const leads    = Math.ceil(echanges / tj)
    // Diviser chaque KPI isolément par 4 (25%)
    const div = pctCC / 100
    return {
      obj_ventes:  Math.round(obj_mois * div),
      obj_visites: Math.round(visites  * div),
      obj_rdv:     Math.round(rdv      * div),
      obj_leads:   Math.round(leads    * div),
    }
  }

  async function saveLead(e) {
    e.preventDefault()
    if (!formLead.date || !formLead.projet_id) { setMsg({type:'error',text:'Date et projet obligatoires'}); return }
    setSaving(true)
    const { data, error } = await supabase.from('pilotage_leads').upsert({
      date: formLead.date, projet_id: formLead.projet_id,
      leads_declares: parseInt(formLead.leads_declares)||0,
      rdv_declares: parseInt(formLead.rdv_declares)||0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'date,projet_id' }).select().single()
    setSaving(false)
    if (error) { setMsg({type:'error',text:error.message}); return }
    setMsg({type:'success',text:'Saisie enregistrée !'})
    setFormLead({ date:'', projet_id:'', leads_declares:'', rdv_declares:'' })
    setTimeout(() => setMsg(null), 3000)
    loadAll()
  }

  async function saveLeadSources() {
    if (!popupLeads) return
    setSaving(true)
    await supabase.from('pilotage_leads_sources').delete().eq('pilotage_lead_id', popupLeads.leadId)
    const rows = formSources.filter(s => s.source && parseInt(s.nombre||0) > 0)
      .map(s => ({ pilotage_lead_id: popupLeads.leadId, source: s.source, nombre: parseInt(s.nombre)||0 }))
    if (rows.length > 0) await supabase.from('pilotage_leads_sources').insert(rows)
    setSaving(false)
    setPopupLeads(null)
    loadAll()
  }

  async function saveVisites() {
    if (!popupVisites) return
    setSaving(true)
    await supabase.from('pilotage_visites').upsert({
      mois: popupVisites.mois, commercial_id: popupVisites.commId, projet_id: popupVisites.projetId,
      visites_m_en_cours: parseInt(formVisites.visites_m_en_cours)||0,
      visites_m1: parseInt(formVisites.visites_m1)||0,
      visites_recuperees: parseInt(formVisites.visites_recuperees)||0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'mois,commercial_id,projet_id' })
    setSaving(false)
    setPopupVisites(null)
    loadAll()
  }

  async function saveObjCC() {
    if (!popupObjCC) return
    setSaving(true)
    await supabase.from('pilotage_objectifs_cc').upsert({
      projet_id: popupObjCC.projetId, mois: popupObjCC.mois,
      pct_cc: parseFloat(formObjCC.pct_cc)||25,
      obj_leads: parseInt(formObjCC.obj_leads)||0,
      obj_rdv: parseInt(formObjCC.obj_rdv)||0,
      obj_visites: parseInt(formObjCC.obj_visites)||0,
      obj_ventes: parseInt(formObjCC.obj_ventes)||0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'projet_id,mois' })
    setSaving(false)
    setPopupObjCC(null)
    loadAll()
  }

  async function addSource() {
    if (!newSource.trim()) return
    await supabase.from('pilotage_sources_ref').insert({ nom: newSource.trim(), ordre: sourcesRef.length+1 })
    setNewSource('')
    loadAll()
  }

  async function deleteSource(id) {
    await supabase.from('pilotage_sources_ref').update({ actif: false }).eq('id', id)
    loadAll()
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const card = { background:'#fff', borderRadius:14, padding:'20px 24px', border:'1px solid rgba(201,168,76,0.15)', marginBottom:20 }
  const inp  = { width:'100%', padding:'9px 12px', border:'1.5px solid rgba(201,168,76,0.25)', borderRadius:8, fontSize:13, background:'#F8F7F4', outline:'none' }
  const lab  = { fontSize:10, color:'#5A5A5A', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:500, marginBottom:5, display:'block' }
  const btn  = (col='#C9A84C') => ({ padding:'8px 18px', borderRadius:20, border:`1.5px solid ${col}`, background:'#fff', color:col, fontSize:12, fontWeight:500, cursor:'pointer' })
  const th   = { fontSize:10, color:'#5A5A5A', textAlign:'left', padding:'8px 10px', borderBottom:'1px solid rgba(201,168,76,0.15)', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:500, whiteSpace:'nowrap' }
  const td   = { padding:'9px 10px', fontSize:12, borderBottom:'1px solid rgba(201,168,76,0.06)', whiteSpace:'nowrap' }

  function colorTA(v) {
    if (v === null || v === undefined) return '#8A8A7A'
    if (v >= 100) return '#2E9455'
    if (v >= 70)  return '#C9A84C'
    return '#E05C5C'
  }

  function KpiTA({ label, realise, objectif, taux, color }) {
    return (
      <div style={{ background:'#F8F7F4', borderRadius:12, padding:'14px 16px', borderTop:`3px solid ${color||'#C9A84C'}` }}>
        <div style={{ fontSize:10, color:'#8A8A7A', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>{label}</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
          <div style={{ fontSize:24, fontWeight:700, color:color||'#C9A84C' }}>{realise}</div>
          {objectif > 0 && <div style={{ fontSize:11, color:'#8A8A7A' }}>/ {Math.round(objectif * prorata)} obj.</div>}
        </div>
        {taux !== null && taux !== undefined && (
          <div style={{ marginTop:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:11, color:'#8A8A7A' }}>Taux d'atteinte</span>
              <span style={{ fontSize:12, fontWeight:700, color:colorTA(taux) }}>{taux}%</span>
            </div>
            <div style={{ height:6, background:'rgba(201,168,76,0.1)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${Math.min(taux,100)}%`, background:colorTA(taux), borderRadius:3, transition:'width 0.4s' }}/>
            </div>
          </div>
        )}
        {prorata < 1 && <div style={{ fontSize:9, color:'#8A8A7A', marginTop:4 }}>Prorata {Math.round(prorata*100)}% des jours écoulés</div>}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#8A8A7A' }}>Chargement...</div>

  const moisLabel = selected?.type === 'month' ? getMoisLabel(selected.value) : selected?.label || ''

  return (
    <div>
      {/* ── Popup Sources Leads ── */}
      {popupLeads && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={() => setPopupLeads(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'90%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:20, fontWeight:600, color:'#C9A84C' }}>Détail sources</div>
                <div style={{ fontSize:12, color:'#8A8A7A' }}>{popupLeads.date} · {projets.find(p=>p.id===popupLeads.projetId)?.nom}</div>
              </div>
              <button onClick={()=>setPopupLeads(null)} style={{ width:32, height:32, borderRadius:'50%', border:'1.5px solid rgba(201,168,76,0.2)', background:'#fff', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize:12, color:'#8A8A7A', marginBottom:12 }}>
              Total leads : <strong style={{color:'#C9A84C'}}>{popupLeads.total}</strong>
            </div>
            {formSources.map((s,i) => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                <input value={s.source} onChange={e=>{const n=[...formSources];n[i].source=e.target.value;setFormSources(n)}}
                  placeholder="Source" style={{...inp, flex:2}}/>
                <input type="number" min="0" value={s.nombre} onChange={e=>{const n=[...formSources];n[i].nombre=e.target.value;setFormSources(n)}}
                  placeholder="Nb" style={{...inp, width:70, flex:0}}/>
                <button onClick={()=>setFormSources(formSources.filter((_,j)=>j!==i))}
                  style={{ color:'#E05C5C', background:'none', border:'none', cursor:'pointer', fontSize:16 }}>×</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <select onChange={e=>{if(e.target.value){setFormSources([...formSources,{source:e.target.value,nombre:''}]);e.target.value=''}}}
                style={{...inp, flex:1}}>
                <option value="">+ Ajouter une source...</option>
                {sourcesRef.map(s=><option key={s.id} value={s.nom}>{s.nom}</option>)}
              </select>
            </div>
            {/* Total check */}
            {(() => {
              const tot = formSources.reduce((s,x) => s+(parseInt(x.nombre)||0), 0)
              const ok  = tot === popupLeads.total
              return tot > 0 && (
                <div style={{ padding:'6px 12px', borderRadius:8, marginBottom:12, background:ok?'rgba(46,148,85,0.08)':'rgba(224,92,92,0.08)', fontSize:12 }}>
                  <span style={{color:ok?'#2E9455':'#E05C5C'}}>{ok?'✅ Total correct':'⚠️ Total: '+tot+' / '+popupLeads.total}</span>
                </div>
              )
            })()}
            <button onClick={saveLeadSources} disabled={saving} style={{ width:'100%', padding:12, borderRadius:8, background:'#C9A84C', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>
              {saving?'...':'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* ── Popup Visites ── */}
      {popupVisites && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={() => setPopupVisites(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'90%', maxWidth:400 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'#C9A84C' }}>Saisie visites</div>
              <button onClick={()=>setPopupVisites(null)} style={{ width:32, height:32, borderRadius:'50%', border:'1.5px solid rgba(201,168,76,0.2)', background:'#fff', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize:12, color:'#8A8A7A', marginBottom:16 }}>
              {commerciaux.find(c=>c.id===popupVisites.commId)?.nom} · {getMoisLabel(popupVisites.mois)}
            </div>
            {[['visites_m_en_cours','🟢 Visites M en cours','Leads générés ce mois'],
              ['visites_m1','🟡 Visites M-1','Leads du mois dernier'],
              ['visites_recuperees','🔵 Visites récupérées','Leads des mois antérieurs']].map(([k,l,sub])=>(
              <div key={k} style={{ marginBottom:14 }}>
                <label style={lab}>{l} <span style={{fontSize:9,fontWeight:400,color:'#8A8A7A'}}>{sub}</span></label>
                <input type="number" min="0" value={formVisites[k]}
                  onChange={e=>setFormVisites(p=>({...p,[k]:e.target.value}))}
                  placeholder="0" style={inp}/>
              </div>
            ))}
            {(() => {
              const mc=parseInt(formVisites.visites_m_en_cours)||0
              const m1=parseInt(formVisites.visites_m1)||0
              const rc=parseInt(formVisites.visites_recuperees)||0
              const tot=mc+m1+rc
              const tauxRec=tot>0?Math.round(((m1+rc)/tot)*100):0
              return tot > 0 && (
                <div style={{ background:'rgba(201,168,76,0.06)', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:11, color:'#5A5A5A' }}>
                  Total : <strong>{tot}</strong> visites · Taux récupération : <strong style={{color:'#534AB7'}}>{tauxRec}%</strong>
                </div>
              )
            })()}
            <button onClick={saveVisites} disabled={saving} style={{ width:'100%', padding:12, borderRadius:8, background:'#C9A84C', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>
              {saving?'...':'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* ── Popup Objectifs CC ── */}
      {popupObjCC && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={()=>setPopupObjCC(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:'90%', maxWidth:440 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'#C9A84C' }}>Objectifs CC</div>
              <button onClick={()=>setPopupObjCC(null)} style={{ width:32, height:32, borderRadius:'50%', border:'1.5px solid rgba(201,168,76,0.2)', background:'#fff', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize:12, color:'#8A8A7A', marginBottom:16 }}>
              {projets.find(p=>p.id===popupObjCC.projetId)?.nom} · {getMoisLabel(popupObjCC.mois)}
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={lab}>% CC (part du CC sur les objectifs globaux)</label>
              <input type="number" min="1" max="100" value={formObjCC.pct_cc}
                onChange={e=>setFormObjCC(p=>({...p,pct_cc:e.target.value}))} style={inp}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['obj_leads','Objectif Leads','#C9A84C'],['obj_rdv','Objectif RDV','#534AB7'],
                ['obj_visites','Objectif Visites','#4CAF7D'],['obj_ventes','Objectif Ventes','#1a6b3c']].map(([k,l,c])=>(
                <div key={k}>
                  <label style={{...lab, color:c}}>{l}</label>
                  <input type="number" min="0" value={formObjCC[k]}
                    onChange={e=>setFormObjCC(p=>({...p,[k]:e.target.value}))} style={inp}/>
                </div>
              ))}
            </div>
            <button onClick={saveObjCC} disabled={saving} style={{ width:'100%', padding:12, marginTop:16, borderRadius:8, background:'#C9A84C', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>
              {saving?'...':'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* ── PageHeader ── */}
      <PageHeader title="Pilotage CC" subtitle={moisLabel}>
        <select value={selectedProjet} onChange={e=>setSelectedProjet(e.target.value)} style={{...inp, width:'auto', fontSize:12}}>
          <option value="all">Tous les projets</option>
          {projets.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      </PageHeader>

      {/* ── DrillNav ── */}
      <DrillNav data={leads.map(l=>({...l, date:l.date, date_debut:l.date}))} onSelect={setSelected} selected={selected}/>

      {/* ── Onglets ── */}
      <div style={{ display:'flex', gap:2, marginBottom:24, borderBottom:'2px solid rgba(201,168,76,0.1)', paddingBottom:0 }}>
        {[['tableau-bord','📊 Tableau de bord'],['leads','📋 Leads & RDV'],['visites','👁 Visites'],['objectifs','🎯 Objectifs CC'],['sources','⚙️ Sources']].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)} style={{ padding:'10px 18px', border:'none', borderBottom:`2px solid ${activeTab===k?'#C9A84C':'transparent'}`, background:'transparent', color:activeTab===k?'#C9A84C':'#5A5A5A', fontSize:13, fontWeight:activeTab===k?600:400, cursor:'pointer', marginBottom:-2 }}>{l}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          ONGLET : TABLEAU DE BORD
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tableau-bord' && (
        <div>
          {(() => {
            const moisSel = selected?.type === 'month' ? selected.value : moisCourant

            // Structure responsables → projets (hardcodé depuis la CE)
            const RESPONSABLES = [
              {
                nom: 'Karima SNAIKI', equipe: 'Kénitra', color: '#534AB7',
                groupes: [
                  { chef: 'Nissrine IRFDEN', projetsIds: [
                    'b1000000-0000-0000-0000-000000000005', // Riad I
                    'b1000000-0000-0000-0000-000000000006', // Riad II
                    'b1000000-0000-0000-0000-000000000011', // Ittihad
                    'b1000000-0000-0000-0000-000000000009', // Louay
                  ]},
                  { chef: 'Youssef SAADOUNI', projetsIds: [
                    'b1000000-0000-0000-0000-000000000008', // BC
                    'b1000000-0000-0000-0000-000000000001', // Mall
                    'b1000000-0000-0000-0000-000000000002', // Marina
                    'b1000000-0000-0000-0000-000000000007', // Camelia
                    'b1000000-0000-0000-0000-000000000010', // Parisien
                  ]},
                  { chef: 'Marouane CACHCHI', projetsIds: [
                    'b1000000-0000-0000-0000-000000000012', // Prestige
                    'b1000000-0000-0000-0000-000000000013', // Défense
                    'b1000000-0000-0000-0000-000000000004', // Cleopatra
                    'b1000000-0000-0000-0000-000000000003', // Nizar
                  ]},
                ]
              },
              {
                nom: 'Abdelhakim ELRHALMI', equipe: 'Salé', color: '#C9A84C',
                groupes: [
                  { chef: null, projetsIds: [
                    'b2000000-0000-0000-0000-000000000001', // La Cascade
                    '65e17a5b-5657-4ffe-86dd-58ae3214d40b', // La Capitale
                  ]},
                ]
              },
            ]

            // NR IDs
            const NR_KENITRA_ID = '00000000-0000-0000-0000-000000000002'
            const NR_SALE_ID    = '00000000-0000-0000-0000-000000000001'
            // Nb projets par région pour répartition NR
            const projetsKenitra = ['b1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000003']
            const projetsSale   = ['b2000000-0000-0000-0000-000000000001','65e17a5b-5657-4ffe-86dd-58ae3214d40b']
            // Visites/ventes NR par région
            const filtreDate = f => {
              if (!selected || selected.type === 'global') return true
              if (selected.type === 'month')   return f.date_debut.startsWith(selected.value)
              if (selected.type === 'year')    return f.date_debut.startsWith(String(selected.value))
              if (selected.type === 'quarter') {
                const [y,q] = selected.value.split('-Q')
                const sm = (parseInt(q)-1)*3+1
                const em = sm+2
                const m = parseInt(f.date_debut.substring(5,7))
                return f.date_debut.startsWith(y) && m >= sm && m <= em
              }
              if (selected.type === 'custom') return f.date_debut >= selected.from && f.date_debut <= selected.to
              return true
            }
            const nrKenVis = Math.round(fluxVentes.filter(f => f.commercial_id === NR_KENITRA_ID && filtreDate(f)).reduce((s,f)=>s+parseFloat(f.visites||0)+parseFloat(f.ventes||0),0))
            const nrKenVen = Math.round(fluxVentes.filter(f => f.commercial_id === NR_KENITRA_ID && filtreDate(f)).reduce((s,f)=>s+parseFloat(f.ventes||0),0))
            const nrSalVis = Math.round(fluxVentes.filter(f => f.commercial_id === NR_SALE_ID    && filtreDate(f)).reduce((s,f)=>s+parseFloat(f.visites||0)+parseFloat(f.ventes||0),0))
            const nrSalVen = Math.round(fluxVentes.filter(f => f.commercial_id === NR_SALE_ID    && filtreDate(f)).reduce((s,f)=>s+parseFloat(f.ventes||0),0))

            // Fonction calcul KPIs pour une liste de projet IDs
            function calcKpis(projetsIds) {
              const ldsP  = leads.filter(l => projetsIds.includes(l.projet_id) && (selected?.type !== 'month' || l.date.startsWith(selected.value)))
              const leadsR  = ldsP.reduce((s,l) => s+(l.leads_declares||0), 0)
              const rdvMois = ldsP.reduce((s,l) => s+(l.rdv_declares||0), 0)
              const rdvTot  = ldsP.reduce((s,l) => s+(l.rdv_total||0), 0)
              const rdvCum  = rdvTot - rdvMois
              // Sources
              const srcsP   = ldsP.flatMap(l => leadsSources.filter(s => s.pilotage_lead_id === l.id))
              const srcMeta  = srcsP.filter(s=>s.source==='Meta Ads').reduce((s,x)=>s+(x.nombre||0),0)
              const srcAppel = srcsP.filter(s=>s.source==='Appels entrants').reduce((s,x)=>s+(x.nombre||0),0)
              // Visites depuis pilotage_visites (saisie manuelle par projet)
              // Filtrer par mois selon la sélection - si global/T2/2026 → tous les mois disponibles
              const visRows = visites.filter(v => {
                if (!projetsIds.includes(v.projet_id)) return false
                if (selected?.type === 'month') return v.mois === selected.value
                if (selected?.type === 'global' || selected?.type === 'year') return true
                if (selected?.type === 'quarter') {
                  const [y,q] = selected.value.split('-Q')
                  const sm = (parseInt(q)-1)*3+1, em = sm+2
                  const m = parseInt(v.mois.split('-')[1])
                  return v.mois.startsWith(y) && m >= sm && m <= em
                }
                return true
              })
              let visR = visRows.reduce((s,v) => s+(v.visites_m_en_cours||0)+(v.visites_m1||0)+(v.visites_recuperees||0), 0)
              // Ventes depuis flux_rdv par commerciaux liés (dédupliqués)
              const commIds = [...new Set(projetsCommerciaux.filter(pc => projetsIds.includes(pc.projet_id)).map(pc => pc.commercial_id))]
              let ventesR = 0
              commIds.forEach(commId => {
                const nbProjComm = projetsCommerciaux.filter(pc => pc.commercial_id === commId).length || 1
                const nbProjDansCeGroupe = projetsCommerciaux.filter(pc => pc.commercial_id === commId && projetsIds.includes(pc.projet_id)).length
                const ratio = nbProjDansCeGroupe / nbProjComm
                const ven = fluxVentes.filter(f => f.commercial_id === commId && filtreDate(f)).reduce((s,f) => s+parseFloat(f.ventes||0), 0)
                ventesR += ven * ratio
              })
              ventesR = Math.round(ventesR)
              // NR ventes réparties
              const nbProjK = projetsIds.filter(id => projetsKenitra.includes(id)).length
              const nbProjS = projetsIds.filter(id => projetsSale.includes(id)).length
              if (nbProjK > 0 && projetsKenitra.length > 0) ventesR += Math.round(nrKenVen * nbProjK / projetsKenitra.length)
              if (nbProjS > 0 && projetsSale.length > 0)   ventesR += Math.round(nrSalVen * nbProjS / projetsSale.length)
              // Répartir NR en égalité par projet dans la région
              const nbProjK = projetsIds.filter(id => projetsKenitra.includes(id)).length
              const nbProjS = projetsIds.filter(id => projetsSale.includes(id)).length
              if (nbProjK > 0 && projetsKenitra.length > 0) { visR += Math.round(nrKenVis * nbProjK / projetsKenitra.length); ventesR += Math.round(nrKenVen * nbProjK / projetsKenitra.length) }
              if (nbProjS > 0 && projetsSale.length > 0)   { visR += Math.round(nrSalVis * nbProjS / projetsSale.length);   ventesR += Math.round(nrSalVen * nbProjS / projetsSale.length) }
              // Objectifs CC
              const objTot = projetsIds.reduce((acc, pid) => {
                const o = objCC.find(o => o.projet_id === pid && o.mois === moisSel)
                return { l: acc.l+(o?.obj_leads||0), r: acc.r+(o?.obj_rdv||0), v: acc.v+(o?.obj_visites||0), vt: acc.vt+(o?.obj_ventes||0) }
              }, {l:0,r:0,v:0,vt:0})
              const objL = objTot.l * prorata, objR = objTot.r * prorata
              const objV = objTot.v * prorata, objVt = objTot.vt * prorata
              const tL  = objL  > 0 ? Math.round((leadsR /objL) *100) : null
              const tR  = objR  > 0 ? Math.round((rdvMois/objR) *100) : null
              const tV  = objV  > 0 ? Math.round((visR   /objV) *100) : null
              const tVt = objVt > 0 ? Math.round((ventesR/objVt)*100) : null
              return { leadsR, rdvMois, rdvTot, rdvCum, srcMeta, srcAppel, visR, ventesR, objL, objR, objV, objVt, tL, tR, tV, tVt }
            }

            const thS = { ...th, padding:'7px 10px' }
            const tdS = { ...td, padding:'7px 10px' }

            return RESPONSABLES.map(resp => (
              <div key={resp.nom} style={{ ...card, marginBottom:20, borderTop:`3px solid ${resp.color}` }}>
                {/* Header responsable */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${resp.color}20` }}>
                  <div>
                    <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:16, fontWeight:600, color:resp.color }}>{resp.nom}</div>
                    <div style={{ fontSize:11, color:'#8A8A7A' }}>Équipe {resp.equipe}</div>
                  </div>
                  {/* Totaux responsable */}
                  {(() => {
                    const allPids = resp.groupes.flatMap(g => g.projetsIds)
                    const k = calcKpis(allPids)
                    return (
                      <div style={{ display:'flex', gap:20, fontSize:12 }}>
                        <span style={{ color:'#C9A84C', fontWeight:700 }}>{k.leadsR} leads</span>
                        <span style={{ color:'#534AB7', fontWeight:700 }}>{k.rdvTot} RDV</span>
                        <span style={{ color:'#4CAF7D', fontWeight:700 }}>{k.visR} visites</span>
                        <span style={{ color:'#1a6b3c', fontWeight:700 }}>{k.ventesR} ventes</span>
                      </div>
                    )
                  })()}
                </div>

                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{...thS, minWidth:140}}>Projet</th>
                        <th style={{...thS,color:'#C9A84C',borderLeft:`2px solid ${resp.color}20`}}>Leads</th>
                        <th style={{...thS,color:'#C9A84C'}}>Obj.</th>
                        <th style={{...thS,color:'#C9A84C'}}>Tx</th>
                        <th style={{...thS,color:'#534AB7',borderLeft:`2px solid ${resp.color}20`}}>RDV mois</th>
                        <th style={{...thS,color:'#534AB7'}}>RDV total</th>
                        <th style={{...thS,color:'#534AB7'}}>Cumulé</th>
                        <th style={{...thS,color:'#534AB7'}}>Obj.</th>
                        <th style={{...thS,color:'#534AB7'}}>Tx</th>
                        <th style={{...thS,color:'#4CAF7D',borderLeft:`2px solid ${resp.color}20`}}>Visites</th>
                        <th style={{...thS,color:'#4CAF7D'}}>Obj.</th>
                        <th style={{...thS,color:'#4CAF7D'}}>Tx</th>
                        <th style={{...thS,color:'#1a6b3c',borderLeft:`2px solid ${resp.color}20`}}>Ventes</th>
                        <th style={{...thS,color:'#1a6b3c'}}>Obj.</th>
                        <th style={{...thS,color:'#1a6b3c'}}>Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resp.groupes.map((groupe, gi) => {
                        // Ligne sous-total chef d'équipe
                        const kGrp = calcKpis(groupe.projetsIds)
                        return (
                          <React.Fragment key={gi}>
                            {/* Ligne chef d'équipe (sous-total) */}
                            {groupe.chef && (
                              <tr style={{ background:`${resp.color}08` }}>
                                <td style={{...tdS, fontWeight:600, color:resp.color, fontSize:11, textTransform:'uppercase', letterSpacing:0.5}} colSpan={1}>
                                  {groupe.chef}
                                </td>
                                <td style={{...tdS,fontWeight:700,color:'#C9A84C',borderLeft:`2px solid ${resp.color}10`}}>{kGrp.leadsR||'—'}</td>
                                <td style={{...tdS,color:'#8A8A7A',fontSize:10}}>{kGrp.objL>0?Math.round(kGrp.objL):'—'}</td>
                                <td style={{...tdS,fontWeight:600,color:kGrp.tL!==null?colorTA(kGrp.tL):'#8A8A7A'}}>{kGrp.tL!==null?kGrp.tL+'%':'—'}</td>
                                <td style={{...tdS,fontWeight:700,color:'#534AB7',borderLeft:`2px solid ${resp.color}10`}}>{kGrp.rdvMois||'—'}</td>
                                <td style={{...tdS,color:'#534AB7'}}>{kGrp.rdvTot||'—'}</td>
                                <td style={{...tdS,color:kGrp.rdvCum>0?'#2E9455':kGrp.rdvCum<0?'#E05C5C':'#8A8A7A',fontWeight:600}}>{kGrp.rdvTot>0?(kGrp.rdvCum>0?'+'+kGrp.rdvCum:kGrp.rdvCum):'—'}</td>
                                <td style={{...tdS,color:'#8A8A7A',fontSize:10}}>{kGrp.objR>0?Math.round(kGrp.objR):'—'}</td>
                                <td style={{...tdS,fontWeight:600,color:kGrp.tR!==null?colorTA(kGrp.tR):'#8A8A7A'}}>{kGrp.tR!==null?kGrp.tR+'%':'—'}</td>
                                <td style={{...tdS,fontWeight:700,color:'#4CAF7D',borderLeft:`2px solid ${resp.color}10`}}>{kGrp.visR||'—'}</td>
                                <td style={{...tdS,color:'#8A8A7A',fontSize:10}}>{kGrp.objV>0?Math.round(kGrp.objV):'—'}</td>
                                <td style={{...tdS,fontWeight:600,color:kGrp.tV!==null?colorTA(kGrp.tV):'#8A8A7A'}}>{kGrp.tV!==null?kGrp.tV+'%':'—'}</td>
                                <td style={{...tdS,fontWeight:700,color:'#1a6b3c',borderLeft:`2px solid ${resp.color}10`}}>{kGrp.ventesR||'—'}</td>
                                <td style={{...tdS,color:'#8A8A7A',fontSize:10}}>{kGrp.objVt>0?Math.round(kGrp.objVt):'—'}</td>
                                <td style={{...tdS,fontWeight:600,color:kGrp.tVt!==null?colorTA(kGrp.tVt):'#8A8A7A'}}>{kGrp.tVt!==null?kGrp.tVt+'%':'—'}</td>
                              </tr>
                            )}
                            {/* Lignes projets */}
                            {groupe.projetsIds.map(pid => {
                              const p = projets.find(x => x.id === pid)
                              if (!p) return null
                              const k = calcKpis([pid])
                              return (
                                <tr key={pid}
                                  onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'}
                                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                  <td style={{...tdS, paddingLeft:20, color:'#5A5A5A', fontSize:11}}>{p.nom}</td>
                                  <td style={{...tdS,color:'#C9A84C',fontWeight:600,borderLeft:`2px solid ${resp.color}08`}}>
                                    <button onClick={()=>{
                                      const ld = leads.find(l=>l.projet_id===pid)
                                      if (!ld) return
                                      const srcs = leadsSources.filter(s=>s.pilotage_lead_id===ld.id)
                                      setPopupLeads({leadId:ld.id,date:ld.date,projetId:pid,total:k.leadsR})
                                      setFormSources(srcs.map(s=>({source:s.source,nombre:String(s.nombre)})))
                                    }} style={{background:'none',border:'none',cursor:k.leadsR>0?'pointer':'default',color:'#C9A84C',fontSize:12,fontWeight:600,textDecoration:k.leadsR>0?'underline dotted':'none',padding:0}}>
                                      {k.leadsR||'—'}
                                    </button>
                                  </td>
                                  <td style={{...tdS,color:'#8A8A7A',fontSize:10}}>{k.objL>0?Math.round(k.objL):'—'}</td>
                                  <td style={{...tdS,fontWeight:600,color:k.tL!==null?colorTA(k.tL):'#8A8A7A',fontSize:11}}>{k.tL!==null?k.tL+'%':'—'}</td>
                                  <td style={{...tdS,color:'#534AB7',borderLeft:`2px solid ${resp.color}08`}}>{k.rdvMois||'—'}</td>
                                  <td style={{...tdS,color:'#534AB7'}}>{k.rdvTot||'—'}</td>
                                  <td style={{...tdS,color:k.rdvCum>0?'#2E9455':k.rdvCum<0?'#E05C5C':'#8A8A7A'}}>{k.rdvTot>0?(k.rdvCum>0?'+'+k.rdvCum:k.rdvCum):'—'}</td>
                                  <td style={{...tdS,color:'#8A8A7A',fontSize:10}}>{k.objR>0?Math.round(k.objR):'—'}</td>
                                  <td style={{...tdS,fontWeight:600,color:k.tR!==null?colorTA(k.tR):'#8A8A7A',fontSize:11}}>{k.tR!==null?k.tR+'%':'—'}</td>
                                  <td style={{...tdS,color:'#4CAF7D',borderLeft:`2px solid ${resp.color}08`}}>{k.visR||'—'}</td>
                                  <td style={{...tdS,color:'#8A8A7A',fontSize:10}}>{k.objV>0?Math.round(k.objV):'—'}</td>
                                  <td style={{...tdS,fontWeight:600,color:k.tV!==null?colorTA(k.tV):'#8A8A7A',fontSize:11}}>{k.tV!==null?k.tV+'%':'—'}</td>
                                  <td style={{...tdS,color:'#1a6b3c',borderLeft:`2px solid ${resp.color}08`}}>{k.ventesR||'—'}</td>
                                  <td style={{...tdS,color:'#8A8A7A',fontSize:10}}>{k.objVt>0?Math.round(k.objVt):'—'}</td>
                                  <td style={{...tdS,fontWeight:600,color:k.tVt!==null?colorTA(k.tVt):'#8A8A7A',fontSize:11}}>{k.tVt!==null?k.tVt+'%':'—'}</td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          })()}

          {/* Taux récupération */}
          {visitesTotaux.tot > 0 && (
            <div style={{...card, display:'flex', gap:32, alignItems:'center'}}>
              <div>
                <div style={{ fontSize:11, color:'#8A8A7A', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Taux de récupération global</div>
                <div style={{ fontSize:28, fontWeight:700, color:'#534AB7' }}>{visitesTotaux.tauxRec}%</div>
                <div style={{ fontSize:11, color:'#8A8A7A', marginTop:2 }}>Visites hors mois en cours / total visites</div>
              </div>
              <div style={{ display:'flex', gap:20 }}>
                {[['🟢 M en cours',visitesTotaux.mc,'#2E9455'],['🟡 M-1',visitesTotaux.m1,'#C9A84C'],['🔵 Récupérées',visitesTotaux.rec,'#534AB7']].map(([l,v,c])=>(
                  <div key={l}>
                    <div style={{ fontSize:10, color:'#8A8A7A', marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          ONGLET : LEADS & RDV
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'leads' && (
        <div>
          {/* Formulaire saisie */}
          {isSuperAdmin && (
            <div style={{...card, borderColor:'#C9A84C'}}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:17, fontWeight:600, color:'#C9A84C', marginBottom:16 }}>Nouvelle saisie</div>
              {msg && <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:12, background:msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color:msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                <div><label style={lab}>Date *</label><input type="date" value={formLead.date} onChange={e=>setFormLead(p=>({...p,date:e.target.value}))} style={inp}/></div>
                <div><label style={lab}>Projet *</label>
                  <select value={formLead.projet_id} onChange={e=>setFormLead(p=>({...p,projet_id:e.target.value}))} style={{...inp,appearance:'none'}}>
                    <option value="">Sélectionner...</option>
                    {projets.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>
                <div><label style={lab}>Leads déclarés</label><input type="number" min="0" value={formLead.leads_declares} onChange={e=>setFormLead(p=>({...p,leads_declares:e.target.value}))} placeholder="0" style={inp}/></div>
                <div><label style={lab}>RDV déclarés</label><input type="number" min="0" value={formLead.rdv_declares} onChange={e=>setFormLead(p=>({...p,rdv_declares:e.target.value}))} placeholder="0" style={inp}/></div>
              </div>
              <button onClick={saveLead} disabled={saving} style={{ marginTop:12, padding:'9px 24px', borderRadius:8, background:'#C9A84C', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                {saving?'...':'Enregistrer'}
              </button>
            </div>
          )}

          {/* Tableau */}
          <div style={card}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Date','Projet','Leads déclarés','RDV déclarés','Sources','Actions'].map(h=><th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {leadsFiltres.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#8A8A7A' }}>Aucune saisie pour cette période</td></tr>
                  )}
                  {[...leadsFiltres].sort((a,b)=>b.date.localeCompare(a.date)).map(l => {
                    const proj = projets.find(p=>p.id===l.projet_id)
                    const srcs = leadsSources.filter(s=>s.pilotage_lead_id===l.id)
                    return (
                      <tr key={l.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{...td,color:'#C9A84C',fontWeight:500}}>{l.date}</td>
                        <td style={td}>{proj?.nom||'—'}</td>
                        <td style={{...td,fontWeight:700,color:'#C9A84C'}}>
                          <button onClick={()=>{
                            setPopupLeads({leadId:l.id,date:l.date,projetId:l.projet_id,total:l.leads_declares})
                            setFormSources(srcs.map(s=>({source:s.source,nombre:String(s.nombre)})))
                          }} style={{ background:'none', border:'none', cursor:'pointer', color:'#C9A84C', fontSize:14, fontWeight:700, textDecoration:'underline dotted' }}>
                            {l.leads_declares}
                          </button>
                          {srcs.length > 0 && <span style={{ fontSize:9, color:'#8A8A7A', marginLeft:4 }}>({srcs.length} sources)</span>}
                        </td>
                        <td style={{...td,color:'#534AB7',fontWeight:600}}>{l.rdv_declares}</td>
                        <td style={td}>
                          {srcs.length > 0
                            ? srcs.map(s=>`${s.source}: ${s.nombre}`).join(' · ')
                            : <span style={{color:'#8A8A7A',fontSize:11}}>—</span>}
                        </td>
                        {isSuperAdmin && <td style={td}>
                          <button onClick={async()=>{ await supabase.from('pilotage_leads').delete().eq('id',l.id); loadAll() }}
                            style={{ color:'#E05C5C', background:'none', border:'none', cursor:'pointer', fontSize:11 }}>Suppr.</button>
                        </td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          ONGLET : VISITES
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'visites' && (
        <div>
          <div style={{ marginBottom:16, display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ fontSize:13, color:'#5A5A5A' }}>Mois affiché : <strong style={{color:'#C9A84C'}}>{moisLabel}</strong></div>
          </div>
          <div style={card}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Commercial','Projet','🟢 M en cours','🟡 M-1','🔵 Récupérées','Total','Tx Présence','Tx Récupération','Action'].map(h=><th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const moisVis = selected?.type === 'month' ? selected.value : moisCourant
                    const rows = visites.filter(v => v.mois === moisVis && (selectedProjet === 'all' || v.projet_id === selectedProjet))
                    const projIds = selectedProjet !== 'all' ? [selectedProjet] : projets.map(p=>p.id)
                    // Montrer les commerciaux qui ont des données OU tous si admin
                    const allComms = commerciaux.filter(c => !c.nom.includes('Non reconnu'))

                    return allComms.map(c => {
                      const visRow = rows.find(v => v.commercial_id === c.id)
                      const mc  = visRow?.visites_m_en_cours || 0
                      const m1  = visRow?.visites_m1 || 0
                      const rec = visRow?.visites_recuperees || 0
                      const tot = mc + m1 + rec
                      // RDV depuis flux pour ce commercial ce mois
                      const rdvComm = fluxVentes.filter(f => f.commercial_id === c.id && f.date_debut.startsWith(moisVis)).reduce((s,f)=>s+parseFloat(f.rdv||0),0)
                      const txPres  = rdvComm > 0 ? Math.round((tot/rdvComm)*100) : null
                      const txRec   = tot > 0 ? Math.round(((m1+rec)/tot)*100) : null
                      if (!isSuperAdmin && tot === 0) return null

                      return (
                        <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{...td,fontWeight:500}}>{c.nom}</td>
                          <td style={{...td,fontSize:11,color:'#8A8A7A'}}>{c.equipe === 'sale' ? 'Salé' : 'Kénitra'}</td>
                          <td style={{...td,color:'#2E9455',fontWeight:tot>0?600:400}}>{mc||'—'}</td>
                          <td style={{...td,color:'#C9A84C'}}>{m1||'—'}</td>
                          <td style={{...td,color:'#534AB7'}}>{rec||'—'}</td>
                          <td style={{...td,fontWeight:700}}>{tot||'—'}</td>
                          <td style={{...td,color:txPres?colorTA(txPres):'#8A8A7A'}}>{txPres!==null?txPres+'%':'—'}</td>
                          <td style={{...td,color:'#534AB7'}}>{txRec!==null?txRec+'%':'—'}</td>
                          {isSuperAdmin && <td style={td}>
                            <button onClick={()=>{
                              setPopupVisites({mois:moisVis,commId:c.id,projetId:selectedProjet!=='all'?selectedProjet:projets[0]?.id})
                              setFormVisites({visites_m_en_cours:String(mc||''),visites_m1:String(m1||''),visites_recuperees:String(rec||'')})
                            }} style={{...btn(), fontSize:11, padding:'4px 10px'}}>Saisir</button>
                          </td>}
                        </tr>
                      )
                    }).filter(Boolean)
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          ONGLET : OBJECTIFS CC
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'objectifs' && (
        <div>
          <div style={card}>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:17, fontWeight:600, color:'#2C2C2C', marginBottom:16 }}>
              Objectifs CC — {moisLabel}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Projet','% CC','Obj. Leads','Obj. RDV','Obj. Visites','Obj. Ventes','Action'].map(h=><th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {projets.map(p => {
                    const moisSel = selected?.type === 'month' ? selected.value : moisCourant
                    const obj = objCC.find(o => o.projet_id === p.id && o.mois === moisSel)
                    const auto = getObjCCAuto(p.id, obj?.pct_cc || 25)
                    const isAuto = !obj
                    const pctCC = obj?.pct_cc || 25
                    const oL  = obj?.obj_leads   || auto.obj_leads
                    const oR  = obj?.obj_rdv     || auto.obj_rdv
                    const oV  = obj?.obj_visites || auto.obj_visites
                    const oVt = obj?.obj_ventes  || auto.obj_ventes
                    return (
                      <tr key={p.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{...td,fontWeight:500}}>{p.nom}</td>
                        <td style={{...td,color:'#C9A84C',fontWeight:600}}>{pctCC}%</td>
                        <td style={{...td,color:isAuto?'#8A8A7A':'#C9A84C',fontStyle:isAuto?'italic':'normal'}}>{oL||'—'}{isAuto&&oL>0&&<span style={{fontSize:9,marginLeft:3,color:'#8A8A7A'}}>auto</span>}</td>
                        <td style={{...td,color:isAuto?'#8A8A7A':'#534AB7',fontStyle:isAuto?'italic':'normal'}}>{oR||'—'}{isAuto&&oR>0&&<span style={{fontSize:9,marginLeft:3,color:'#8A8A7A'}}>auto</span>}</td>
                        <td style={{...td,color:isAuto?'#8A8A7A':'#4CAF7D',fontStyle:isAuto?'italic':'normal'}}>{oV||'—'}{isAuto&&oV>0&&<span style={{fontSize:9,marginLeft:3,color:'#8A8A7A'}}>auto</span>}</td>
                        <td style={{...td,color:isAuto?'#8A8A7A':'#1a6b3c',fontStyle:isAuto?'italic':'normal',fontWeight:600}}>{oVt||'—'}{isAuto&&oVt>0&&<span style={{fontSize:9,marginLeft:3,color:'#8A8A7A'}}>auto</span>}</td>
                    {isSuperAdmin && <td style={td}>
                          <button onClick={()=>{
                            const moisSel2 = selected?.type === 'month' ? selected.value : moisCourant
                            setPopupObjCC({projetId:p.id,mois:moisSel2})
                            setFormObjCC({
                              pct_cc:     obj?.pct_cc     || 25,
                              obj_leads:  obj?.obj_leads  !== undefined ? obj.obj_leads  : (auto.obj_leads  || ''),
                              obj_rdv:    obj?.obj_rdv    !== undefined ? obj.obj_rdv    : (auto.obj_rdv    || ''),
                              obj_visites:obj?.obj_visites!== undefined ? obj.obj_visites: (auto.obj_visites|| ''),
                              obj_ventes: obj?.obj_ventes !== undefined ? obj.obj_ventes : (auto.obj_ventes || ''),
                            })
                          }} style={{...btn(),fontSize:11,padding:'4px 10px'}}>
                            {obj ? 'Modifier' : 'Valider auto'}
                          </button>
                        </td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          ONGLET : SOURCES
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sources' && isSuperAdmin && (
        <div style={card}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:17, fontWeight:600, color:'#2C2C2C', marginBottom:16 }}>Gestion des sources</div>
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            <input value={newSource} onChange={e=>setNewSource(e.target.value)} placeholder="Nouvelle source..." style={{...inp,width:'auto',flex:1}} onKeyDown={e=>e.key==='Enter'&&addSource()}/>
            <button onClick={addSource} style={{ padding:'9px 20px', borderRadius:8, background:'#C9A84C', color:'#fff', border:'none', fontSize:13, cursor:'pointer' }}>Ajouter</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sourcesRef.map(s=>(
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#F8F7F4', borderRadius:8 }}>
                <span style={{ fontSize:13 }}>{s.nom}</span>
                <button onClick={()=>deleteSource(s.id)} style={{ color:'#E05C5C', background:'none', border:'none', cursor:'pointer', fontSize:12 }}>Supprimer</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}