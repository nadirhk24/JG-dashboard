// JG Dashboard - Évaluation Qualité des appels - v1
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ════════════════════════════════════════════════════════════════════════════
// GRILLE D'ÉVALUATION (structure fixe validée)
// categorie: 'soft' = Soft Skills, 'process' = Process & Produit
// ════════════════════════════════════════════════════════════════════════════
const GRILLE = [
  {
    section: 'Accueil & Identification', poids: 15,
    items: [
      { item: 'Accroche',                     categorie: 'soft' },
      { item: 'Identification',               categorie: 'process' },
      { item: 'Présentation',                 categorie: 'process' },
      { item: 'Validation de disponibilité',  categorie: 'process' },
      { item: 'Autorisation du questionnement',categorie: 'soft' },
    ]
  },
  {
    section: 'Questionnement & Découverte', poids: 25,
    items: [
      { item: 'Questionnement',                    categorie: 'soft' },
      { item: 'Utilisation des infos formulaire',  categorie: 'process' },
      { item: 'Écoute active',                     categorie: 'soft' },
      { item: 'Détection du besoin',               categorie: 'soft' },
      { item: 'Reformulation',                     categorie: 'process' },
    ]
  },
  {
    section: 'Proposition', poids: 25,
    items: [
      { item: 'Réponse au besoin',                          categorie: 'soft' },
      { item: 'Argumentation adaptée',                      categorie: 'soft' },
      { item: 'Qualité de la réponse',                      categorie: 'soft' },
      { item: 'Traitement des objections & insatisfactions',categorie: 'soft' },
    ]
  },
  {
    section: 'Conclusion', poids: 20,
    items: [
      { item: 'Proposition de RDV',                    categorie: 'soft' },
      { item: 'Respect des rebonds',                   categorie: 'process' },
      { item: 'Verrouillage (WhatsApp + confirmation)',categorie: 'process' },
      { item: 'Reformulation du RDV',                  categorie: 'process' },
      { item: 'Prise de congé professionnelle',        categorie: 'process' },
    ]
  },
  {
    section: 'Consignes & Règles CRM', poids: 15,
    items: [
      { item: "Création de l'activité",       categorie: 'process' },
      { item: 'Affectation au commercial',    categorie: 'process' },
      { item: 'Historisation',                categorie: 'process' },
      { item: 'Respect du workflow',          categorie: 'process' },
    ]
  },
]

const STATUTS = [
  { val: 'acquis',        label: 'Acquis',        score: 100, color: '#2E9455' },
  { val: 'en_cours',      label: 'En cours',      score: 50,  color: '#C9A84C' },
  { val: 'non_acquis',    label: 'Non acquis',    score: 0,   color: '#E05C5C' },
  { val: 'non_evaluable', label: 'Non évaluable', score: null,color: '#8A8A7A' },
]

function scoreOf(statut) {
  const s = STATUTS.find(x => x.val === statut)
  return s ? s.score : null
}

// Calcule les 3 notes à partir de l'état {"section-item": statut}
function calcNotes(etat) {
  // Score par section (pour note globale pondérée)
  let totalPondere = 0, totalPoids = 0
  const scoresSections = {}
  GRILLE.forEach(sec => {
    const scores = sec.items.map(it => scoreOf(etat[`${sec.section}||${it.item}`])).filter(v => v !== null)
    if (scores.length > 0) {
      const moy = scores.reduce((a,b)=>a+b,0) / scores.length
      scoresSections[sec.section] = moy
      totalPondere += moy * sec.poids
      totalPoids   += sec.poids
    } else {
      scoresSections[sec.section] = null
    }
  })
  const globale = totalPoids > 0 ? Math.round(totalPondere / totalPoids) : 0

  // Note Soft Skills : moyenne de tous les items 'soft' évaluables
  const softScores = []
  const procScores = []
  GRILLE.forEach(sec => sec.items.forEach(it => {
    const sc = scoreOf(etat[`${sec.section}||${it.item}`])
    if (sc !== null) {
      if (it.categorie === 'soft') softScores.push(sc)
      else procScores.push(sc)
    }
  }))
  const soft = softScores.length > 0 ? Math.round(softScores.reduce((a,b)=>a+b,0)/softScores.length) : 0
  const proc = procScores.length > 0 ? Math.round(procScores.reduce((a,b)=>a+b,0)/procScores.length) : 0

  return { globale, soft, proc, scoresSections }
}

function couleurNote(v) {
  if (v >= 80) return '#2E9455'
  if (v >= 50) return '#C9A84C'
  return '#E05C5C'
}

function badgeConformite(globale, seuil) {
  if (globale >= seuil)        return { label: 'Conforme',      color: '#2E9455', bg: 'rgba(46,148,85,0.1)',  icon: '✅' }
  if (globale >= seuil - 15)   return { label: 'À améliorer',   color: '#C9A84C', bg: 'rgba(201,168,76,0.1)', icon: '⚠️' }
  return { label: 'Non conforme', color: '#E05C5C', bg: 'rgba(224,92,92,0.1)', icon: '❌' }
}

export default function QualiteEvaluation() {
  const { profil } = useAuth()
  const isSuperAdmin  = profil?.role === 'super_admin'
  const isConseillere = profil?.role === 'conseillere'

  const [section, setSection] = useState('evaluations') // 'evaluations' | 'dashboard' | 'referentiel'
  const [evaluations, setEvaluations] = useState([])
  const [conseilleres, setConseilleres] = useState([])
  const [loading, setLoading] = useState(true)

  // Vue : 'liste' | 'form' | 'detail'
  const [vue, setVue] = useState('liste')
  const [evalActive, setEvalActive] = useState(null) // évaluation en cours d'édition/consultation

  // ── Chargement ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: evals }, { data: cons }] = await Promise.all([
      supabase.from('evaluations_qualite').select('*').order('date_appel', { ascending: false }),
      supabase.from('conseilleres').select('id, nom').order('nom'),
    ])
    // Une conseillère ne voit que ses évals publiées
    let visibles = evals || []
    if (isConseillere) {
      const myId = profil?.conseillere_id
      visibles = visibles.filter(e => e.conseillere_id === myId && e.statut === 'publiee')
    }
    setEvaluations(visibles)
    setConseilleres(cons || [])
    setLoading(false)
  }, [isConseillere, profil])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Styles communs ────────────────────────────────────────────────────────
  const card = { background:'#fff', borderRadius:14, padding:'20px 24px', border:'1px solid rgba(201,168,76,0.15)', marginBottom:20 }
  const inp  = { width:'100%', padding:'9px 12px', border:'1.5px solid rgba(201,168,76,0.25)', borderRadius:8, fontSize:13, background:'#F8F7F4', outline:'none', boxSizing:'border-box' }
  const lab  = { fontSize:10, color:'#5A5A5A', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:500, marginBottom:5, display:'block' }
  const th   = { fontSize:10, color:'#5A5A5A', textAlign:'left', padding:'9px 12px', borderBottom:'1px solid rgba(201,168,76,0.15)', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:500, whiteSpace:'nowrap' }
  const td   = { padding:'11px 12px', fontSize:13, borderBottom:'1px solid rgba(201,168,76,0.06)' }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#8A8A7A' }}>Chargement...</div>

  return (
    <div>
      {/* En-tête page */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:28, fontWeight:600, color:'#2C2C2C', margin:0 }}>Évaluation Qualité</h1>
        <p style={{ fontSize:13, color:'#8A8A7A', margin:'2px 0 0' }}>Évaluation des appels du centre d'appel</p>
      </div>

      {/* Onglets du module */}
      <div style={{ display:'flex', gap:2, marginBottom:24, borderBottom:'2px solid rgba(201,168,76,0.1)' }}>
        {[['evaluations','📋 Évaluations'],['dashboard','📊 Dashboard Qualité'],['referentiel','📖 Référentiel']].map(([k,l])=>(
          <button key={k} onClick={()=>{ setSection(k); setVue('liste') }}
            style={{ padding:'10px 18px', border:'none', borderBottom:`2px solid ${section===k?'#C9A84C':'transparent'}`, background:'transparent', color:section===k?'#C9A84C':'#5A5A5A', fontSize:13, fontWeight:section===k?600:400, cursor:'pointer', marginBottom:-2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* ════════════ SECTION ÉVALUATIONS ════════════ */}
      {section === 'evaluations' && (
        <SectionEvaluations
          vue={vue} setVue={setVue}
          evalActive={evalActive} setEvalActive={setEvalActive}
          evaluations={evaluations} conseilleres={conseilleres}
          isSuperAdmin={isSuperAdmin} isConseillere={isConseillere}
          reload={loadAll}
          styles={{ card, inp, lab, th, td }}
        />
      )}

      {/* ════════════ SECTION DASHBOARD ════════════ */}
      {section === 'dashboard' && (
        <SectionDashboard evaluations={evaluations} conseilleres={conseilleres} styles={{ card }} />
      )}

      {/* ════════════ SECTION RÉFÉRENTIEL ════════════ */}
      {section === 'referentiel' && (
        <SectionReferentiel styles={{ card }} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION ÉVALUATIONS : liste + formulaire + détail
// ════════════════════════════════════════════════════════════════════════════
function SectionEvaluations({ vue, setVue, evalActive, setEvalActive, evaluations, conseilleres, isSuperAdmin, isConseillere, reload, styles }) {
  const { card, inp, lab, th, td } = styles

  // ── VUE LISTE ──────────────────────────────────────────────────────────────
  if (vue === 'liste') {
    return (
      <div>
        {isSuperAdmin && (
          <button onClick={()=>{ setEvalActive(null); setVue('form') }}
            style={{ marginBottom:16, padding:'10px 22px', borderRadius:22, background:'#C9A84C', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>
            + Nouvelle évaluation
          </button>
        )}
        <div style={card}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Date','Conseillère','Prospect','Note globale','Soft Skills','Process','Statut'].map(h=><th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {evaluations.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'#8A8A7A' }}>Aucune évaluation pour le moment</td></tr>
                )}
                {evaluations.map(ev => {
                  const cons = conseilleres.find(c => c.id === ev.conseillere_id)
                  const badge = badgeConformite(ev.note_globale||0, ev.seuil_conformite||70)
                  return (
                    <tr key={ev.id}
                      onClick={()=>{ setEvalActive(ev); setVue('detail') }}
                      onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      style={{ cursor:'pointer' }}>
                      <td style={{...td, color:'#C9A84C', fontWeight:500}}>{ev.date_appel || '—'}</td>
                      <td style={td}>{cons?.nom || '—'}</td>
                      <td style={td}>{ev.nom_prospect || '—'}</td>
                      <td style={{...td, fontWeight:700, color:couleurNote(ev.note_globale||0)}}>{ev.note_globale ?? '—'}%</td>
                      <td style={{...td, color:'#C9A84C'}}>{ev.note_soft_skills ?? '—'}%</td>
                      <td style={{...td, color:'#534AB7'}}>{ev.note_process ?? '—'}%</td>
                      <td style={td}>
                        {ev.statut === 'brouillon'
                          ? <span style={{ fontSize:11, padding:'3px 10px', borderRadius:12, background:'rgba(138,138,122,0.12)', color:'#8A8A7A' }}>📝 Brouillon</span>
                          : <span style={{ fontSize:11, padding:'3px 10px', borderRadius:12, background:badge.bg, color:badge.color }}>{badge.icon} {badge.label}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── VUE FORMULAIRE / DÉTAIL ─────────────────────────────────────────────────
  return (
    <FormulaireEvaluation
      evalActive={evalActive}
      lectureSeule={vue === 'detail' && !isSuperAdmin}
      isSuperAdmin={isSuperAdmin}
      conseilleres={conseilleres}
      onRetour={()=>{ setVue('liste'); reload() }}
      styles={styles}
    />
  )
}

// ════════════════════════════════════════════════════════════════════════════
// FORMULAIRE D'ÉVALUATION (création / édition / consultation)
// ════════════════════════════════════════════════════════════════════════════
function FormulaireEvaluation({ evalActive, lectureSeule, isSuperAdmin, conseilleres, onRetour, styles }) {
  const { card, inp, lab } = styles

  const [entete, setEntete] = useState({
    conseillere_id: evalActive?.conseillere_id || '',
    nom_prospect:   evalActive?.nom_prospect   || '',
    numero_prospect:evalActive?.numero_prospect|| '',
    lien_appel:     evalActive?.lien_appel     || '',
    date_appel:     evalActive?.date_appel     || new Date().toISOString().slice(0,10),
    seuil_conformite: evalActive?.seuil_conformite ?? 70,
    observation:    evalActive?.observation    || '',
  })
  const [etat, setEtat] = useState({})       // {"section||item": statut}
  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  // Charger les critères existants si édition/consultation
  useEffect(() => {
    if (!evalActive) return
    async function loadCriteres() {
      const { data } = await supabase.from('evaluations_qualite_criteres').select('*').eq('evaluation_id', evalActive.id)
      const e = {}
      ;(data||[]).forEach(c => { e[`${c.section}||${c.item}`] = c.statut })
      setEtat(e)
      // Audio signé (privé)
      if (evalActive.audio_url) {
        const { data: signed } = await supabase.storage.from('evaluations-audio').createSignedUrl(evalActive.audio_url, 3600)
        if (signed) setAudioUrl(signed.signedUrl)
      }
    }
    loadCriteres()
  }, [evalActive])

  const notes = useMemo(() => calcNotes(etat), [etat])
  const badge = badgeConformite(notes.globale, entete.seuil_conformite)

  // Plan d'action auto : items mal notés
  const pointsATravailler = useMemo(() => {
    const pts = []
    GRILLE.forEach(sec => sec.items.forEach(it => {
      const st = etat[`${sec.section}||${it.item}`]
      if (st === 'non_acquis' || st === 'en_cours') pts.push(`${sec.section} — ${it.item}`)
    }))
    return pts
  }, [etat])

  function setItem(sectionNom, itemNom, statut) {
    if (lectureSeule) return
    setEtat(prev => ({ ...prev, [`${sectionNom}||${itemNom}`]: statut }))
  }

  async function enregistrer(statutPublication) {
    if (!entete.conseillere_id) { setMsg({ type:'error', text:'Choisis une conseillère' }); return }
    setSaving(true)

    // 1. Upload audio si nouveau fichier
    let audioPath = evalActive?.audio_url || null
    if (audioFile) {
      const ext = audioFile.name.split('.').pop()
      const path = `${entete.conseillere_id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('evaluations-audio').upload(path, audioFile)
      if (upErr) { setMsg({ type:'error', text:'Erreur upload audio : '+upErr.message }); setSaving(false); return }
      audioPath = path
    }

    // 2. Enregistrer l'évaluation
    const payload = {
      ...entete,
      audio_url: audioPath,
      note_globale: notes.globale,
      note_soft_skills: notes.soft,
      note_process: notes.proc,
      statut: statutPublication,
      updated_at: new Date().toISOString(),
    }
    let evalId = evalActive?.id
    if (evalId) {
      await supabase.from('evaluations_qualite').update(payload).eq('id', evalId)
    } else {
      const { data, error } = await supabase.from('evaluations_qualite').insert(payload).select().single()
      if (error) { setMsg({ type:'error', text:error.message }); setSaving(false); return }
      evalId = data.id
    }

    // 3. Enregistrer les critères (on efface et réinsère)
    await supabase.from('evaluations_qualite_criteres').delete().eq('evaluation_id', evalId)
    const criteres = []
    GRILLE.forEach(sec => sec.items.forEach(it => {
      const st = etat[`${sec.section}||${it.item}`]
      if (st) criteres.push({ evaluation_id: evalId, section: sec.section, item: it.item, categorie: it.categorie, statut: st })
    }))
    if (criteres.length > 0) await supabase.from('evaluations_qualite_criteres').insert(criteres)

    setSaving(false)
    setMsg({ type:'success', text: statutPublication === 'publiee' ? 'Évaluation publiée !' : 'Brouillon enregistré !' })
    setTimeout(() => onRetour(), 1000)
  }

  const btnStatut = (courant, cible, coul) => ({
    flex:1, padding:'6px 4px', fontSize:11, borderRadius:6, cursor: lectureSeule?'default':'pointer',
    border:`1.5px solid ${courant===cible ? coul : 'rgba(201,168,76,0.2)'}`,
    background: courant===cible ? coul : '#fff',
    color: courant===cible ? '#fff' : '#8A8A7A',
    fontWeight: courant===cible ? 600 : 400,
    transition:'all 0.15s',
  })

  return (
    <div>
      {/* Bouton retour */}
      <button onClick={onRetour} style={{ marginBottom:16, padding:'7px 16px', borderRadius:20, border:'1.5px solid rgba(201,168,76,0.3)', background:'#fff', color:'#C9A84C', fontSize:12, cursor:'pointer' }}>
        ← Retour à la liste
      </button>

      {msg && <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:13, background: msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}

      {/* ── EN-TÊTE ── */}
      <div style={card}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:17, fontWeight:600, color:'#C9A84C', marginBottom:16 }}>Informations de l'appel</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          <div>
            <label style={lab}>Conseillère</label>
            <select value={entete.conseillere_id} disabled={lectureSeule} onChange={e=>setEntete(p=>({...p,conseillere_id:e.target.value}))} style={{...inp, appearance:'none'}}>
              <option value="">Sélectionner...</option>
              {conseilleres.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div><label style={lab}>Nom du prospect</label><input value={entete.nom_prospect} disabled={lectureSeule} onChange={e=>setEntete(p=>({...p,nom_prospect:e.target.value}))} style={inp} placeholder="Nom du prospect"/></div>
          <div><label style={lab}>Numéro du prospect</label><input value={entete.numero_prospect} disabled={lectureSeule} onChange={e=>setEntete(p=>({...p,numero_prospect:e.target.value}))} style={inp} placeholder="06..."/></div>
          <div><label style={lab}>Lien de l'appel</label><input value={entete.lien_appel} disabled={lectureSeule} onChange={e=>setEntete(p=>({...p,lien_appel:e.target.value}))} style={inp} placeholder="https://..."/></div>
          <div><label style={lab}>Date de l'appel</label><input type="date" value={entete.date_appel} disabled={lectureSeule} onChange={e=>setEntete(p=>({...p,date_appel:e.target.value}))} style={inp}/></div>
          <div>
            <label style={lab}>Enregistrement audio</label>
            {isSuperAdmin && !lectureSeule
              ? <input type="file" accept="audio/*" onChange={e=>setAudioFile(e.target.files[0])} style={{...inp, padding:'6px'}}/>
              : <div style={{ fontSize:12, color:'#8A8A7A', paddingTop:8 }}>{audioUrl ? '🎵 Disponible ci-dessous' : 'Aucun'}</div>}
          </div>
        </div>
        {/* Lecteur audio */}
        {audioUrl && (
          <div style={{ marginTop:16 }}>
            <audio controls controlsList={isSuperAdmin ? '' : 'nodownload'} src={audioUrl} style={{ width:'100%' }} />
          </div>
        )}
      </div>

      {/* ── LES 3 NOTES (live) ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        {[
          ['Note Globale', notes.globale, couleurNote(notes.globale), '📊'],
          ['Soft Skills', notes.soft, '#C9A84C', '🟡'],
          ['Process & Produit', notes.proc, '#534AB7', '🔵'],
        ].map(([l,v,c,ic])=>(
          <div key={l} style={{ background:'#fff', borderRadius:12, padding:'16px 20px', border:'1px solid rgba(201,168,76,0.15)', borderTop:`3px solid ${c}` }}>
            <div style={{ fontSize:11, color:'#8A8A7A', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>{ic} {l}</div>
            <div style={{ fontSize:30, fontWeight:700, color:c }}>{v}%</div>
          </div>
        ))}
      </div>

      {/* Badge conformité */}
      <div style={{ ...card, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:13, color:'#5A5A5A' }}>Statut de conformité (seuil {entete.seuil_conformite}%)</div>
        <span style={{ fontSize:14, padding:'6px 16px', borderRadius:14, background:badge.bg, color:badge.color, fontWeight:600 }}>{badge.icon} {badge.label}</span>
      </div>

      {/* ── LA GRILLE ── */}
      {GRILLE.map(sec => {
        const scoreSec = notes.scoresSections[sec.section]
        return (
          <div key={sec.section} style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, paddingBottom:10, borderBottom:'1px solid rgba(201,168,76,0.1)' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:16, fontWeight:600, color:'#2C2C2C' }}>
                {sec.section} <span style={{ fontSize:12, color:'#8A8A7A', fontFamily:'DM Sans' }}>({sec.poids}%)</span>
              </div>
              <div style={{ fontSize:18, fontWeight:700, color: scoreSec===null ? '#8A8A7A' : couleurNote(scoreSec) }}>
                {scoreSec===null ? '—' : Math.round(scoreSec)+'%'}
              </div>
            </div>
            {sec.items.map(it => {
              const courant = etat[`${sec.section}||${it.item}`]
              const catColor = it.categorie === 'soft' ? '#C9A84C' : '#534AB7'
              const catIcon  = it.categorie === 'soft' ? '🟡' : '🔵'
              return (
                <div key={it.item} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'0.5px solid rgba(201,168,76,0.06)' }}>
                  <div style={{ flex:1, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                    <span title={it.categorie==='soft'?'Soft Skills':'Process & Produit'} style={{ fontSize:10 }}>{catIcon}</span>
                    {it.item}
                  </div>
                  <div style={{ display:'flex', gap:4, width:320 }}>
                    {STATUTS.map(st => (
                      <button key={st.val} onClick={()=>setItem(sec.section, it.item, st.val)} style={btnStatut(courant, st.val, st.color)}>
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* ── BAS : observation + seuil + plan d'action ── */}
      <div style={card}>
        <label style={lab}>Observation</label>
        <textarea value={entete.observation} disabled={lectureSeule} onChange={e=>setEntete(p=>({...p,observation:e.target.value}))}
          rows={4} style={{...inp, resize:'vertical', fontFamily:'inherit'}} placeholder="Ton observation générale sur l'appel..."/>

        {isSuperAdmin && !lectureSeule && (
          <div style={{ marginTop:14, width:200 }}>
            <label style={lab}>Seuil de conformité (%)</label>
            <input type="number" min="0" max="100" value={entete.seuil_conformite} onChange={e=>setEntete(p=>({...p,seuil_conformite:parseInt(e.target.value)||0}))} style={inp}/>
          </div>
        )}

        {/* Plan d'action auto */}
        {pointsATravailler.length > 0 && (
          <div style={{ marginTop:16, padding:'12px 16px', background:'rgba(224,92,92,0.05)', borderRadius:10, border:'1px solid rgba(224,92,92,0.15)' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#a03030', marginBottom:8 }}>🎯 Points à travailler</div>
            <ul style={{ margin:0, paddingLeft:18, fontSize:12, color:'#5A5A5A' }}>
              {pointsATravailler.map((p,i)=><li key={i} style={{ marginBottom:3 }}>{p}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* ── BOUTONS ── */}
      {isSuperAdmin && !lectureSeule && (
        <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginBottom:40 }}>
          <button onClick={()=>enregistrer('brouillon')} disabled={saving}
            style={{ padding:'11px 24px', borderRadius:22, border:'1.5px solid #8A8A7A', background:'#fff', color:'#5A5A5A', fontSize:13, fontWeight:500, cursor:'pointer' }}>
            💾 {saving?'...':'Enregistrer (brouillon)'}
          </button>
          <button onClick={()=>enregistrer('publiee')} disabled={saving}
            style={{ padding:'11px 24px', borderRadius:22, border:'none', background:'#2E9455', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>
            👁️ {saving?'...':'Afficher à la conseillère'}
          </button>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION DASHBOARD QUALITÉ
// ════════════════════════════════════════════════════════════════════════════
function SectionDashboard({ evaluations, conseilleres, styles }) {
  const { card } = styles

  // Uniquement les évals publiées comptent pour les stats
  const publiees = evaluations.filter(e => e.statut === 'publiee')

  const moisCourant = new Date().toISOString().slice(0,7)
  const publieesMois = publiees.filter(e => (e.date_appel||'').startsWith(moisCourant))

  const moy = (arr, champ) => arr.length ? Math.round(arr.reduce((s,e)=>s+(e[champ]||0),0)/arr.length) : 0

  const noteGlobale     = moy(publiees, 'note_globale')
  const noteGlobaleMois = moy(publieesMois, 'note_globale')
  const noteSoft        = moy(publiees, 'note_soft_skills')
  const noteProc        = moy(publiees, 'note_process')

  // Courbe d'évolution par mois
  const parMois = {}
  publiees.forEach(e => {
    const m = (e.date_appel||'').slice(0,7)
    if (!m) return
    if (!parMois[m]) parMois[m] = { mois:m, notes:[], soft:[], proc:[] }
    parMois[m].notes.push(e.note_globale||0)
    parMois[m].soft.push(e.note_soft_skills||0)
    parMois[m].proc.push(e.note_process||0)
  })
  const courbe = Object.values(parMois).sort((a,b)=>a.mois.localeCompare(b.mois)).map(m => ({
    mois: MOIS_LABELS[parseInt(m.mois.slice(5,7))-1]?.slice(0,3) || m.mois,
    Globale: Math.round(m.notes.reduce((a,b)=>a+b,0)/m.notes.length),
    'Soft Skills': Math.round(m.soft.reduce((a,b)=>a+b,0)/m.soft.length),
    'Process': Math.round(m.proc.reduce((a,b)=>a+b,0)/m.proc.length),
  }))

  // Note moyenne par conseillère
  const parConseillere = conseilleres.map(c => {
    const evs = publiees.filter(e => e.conseillere_id === c.id)
    return { nom: c.nom, note: moy(evs,'note_globale'), nb: evs.length }
  }).filter(x => x.nb > 0).sort((a,b)=>b.note-a.note)

  const kpiCard = (label, val, color, icon, sub) => (
    <div style={{ background:'#fff', borderRadius:12, padding:'18px 22px', border:'1px solid rgba(201,168,76,0.15)', borderTop:`3px solid ${color}` }}>
      <div style={{ fontSize:11, color:'#8A8A7A', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>{icon} {label}</div>
      <div style={{ fontSize:30, fontWeight:700, color }}>{val}%</div>
      {sub && <div style={{ fontSize:11, color:'#8A8A7A', marginTop:2 }}>{sub}</div>}
    </div>
  )

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {kpiCard('Note qualité globale', noteGlobale, couleurNote(noteGlobale), '📊', `${publiees.length} évaluations`)}
        {kpiCard('Mois en cours', noteGlobaleMois, couleurNote(noteGlobaleMois), '📅', `${publieesMois.length} ce mois`)}
        {kpiCard('Soft Skills', noteSoft, '#C9A84C', '🟡', 'Moyenne globale')}
        {kpiCard('Process & Produit', noteProc, '#534AB7', '🔵', 'Moyenne globale')}
      </div>

      {/* Courbe évolution */}
      {courbe.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:16, fontWeight:600, color:'#2C2C2C', marginBottom:16 }}>Évolution des notes</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={courbe}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.1)" />
              <XAxis dataKey="mois" tick={{ fontSize:12, fill:'#8A8A7A' }} />
              <YAxis domain={[0,100]} tick={{ fontSize:12, fill:'#8A8A7A' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Globale" stroke="#2E9455" strokeWidth={2.5} />
              <Line type="monotone" dataKey="Soft Skills" stroke="#C9A84C" strokeWidth={2} />
              <Line type="monotone" dataKey="Process" stroke="#534AB7" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Classement conseillères */}
      {parConseillere.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:16, fontWeight:600, color:'#2C2C2C', marginBottom:16 }}>Note moyenne par conseillère</div>
          {parConseillere.map((c,i) => (
            <div key={c.nom} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'0.5px solid rgba(201,168,76,0.06)' }}>
              <div style={{ width:24, fontSize:14, fontWeight:700, color:'#C9A84C' }}>{i+1}</div>
              <div style={{ flex:1, fontSize:13 }}>{c.nom}</div>
              <div style={{ width:120, height:8, background:'rgba(201,168,76,0.1)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${c.note}%`, background:couleurNote(c.note), borderRadius:4 }}/>
              </div>
              <div style={{ width:50, textAlign:'right', fontSize:14, fontWeight:700, color:couleurNote(c.note) }}>{c.note}%</div>
              <div style={{ width:70, textAlign:'right', fontSize:11, color:'#8A8A7A' }}>{c.nb} éval.</div>
            </div>
          ))}
        </div>
      )}

      {publiees.length === 0 && (
        <div style={{ ...card, textAlign:'center', color:'#8A8A7A', padding:40 }}>
          Aucune évaluation publiée pour le moment. Les statistiques apparaîtront ici.
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION RÉFÉRENTIEL
// ════════════════════════════════════════════════════════════════════════════
function SectionReferentiel({ styles }) {
  const { card } = styles

  return (
    <div>
      {/* Pondération */}
      <div style={card}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'#C9A84C', marginBottom:12 }}>⚖️ La pondération</div>
        <p style={{ fontSize:13, color:'#5A5A5A', lineHeight:1.6, marginTop:0 }}>
          Chaque section a un poids différent dans la note globale. Les sections les plus importantes pour la vente (Questionnement et Proposition) pèsent le plus. La note globale est la somme des scores de section multipliés par leur poids.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:12 }}>
          {GRILLE.map(sec => (
            <div key={sec.section} style={{ padding:'8px 14px', borderRadius:10, background:'rgba(201,168,76,0.06)', fontSize:12 }}>
              <strong style={{ color:'#C9A84C' }}>{sec.poids}%</strong> — {sec.section}
            </div>
          ))}
        </div>
      </div>

      {/* Statuts */}
      <div style={card}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'#C9A84C', marginBottom:12 }}>🎯 Les statuts</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
          {[
            ['Acquis', '#2E9455', 'Le critère est parfaitement maîtrisé (100 points).'],
            ['En cours', '#C9A84C', 'Le critère est partiellement maîtrisé, à améliorer (50 points).'],
            ['Non acquis', '#E05C5C', 'Le critère n\'est pas maîtrisé (0 point).'],
            ['Non évaluable', '#8A8A7A', 'Le critère ne s\'applique pas à cet appel. Il est exclu du calcul (ni pénalisé, ni compté).'],
          ].map(([l,c,d])=>(
            <div key={l} style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${c}30`, background:`${c}08` }}>
              <div style={{ fontSize:13, fontWeight:600, color:c, marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:12, color:'#5A5A5A', lineHeight:1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Les 2 catégories */}
      <div style={card}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'#C9A84C', marginBottom:12 }}>🟡🔵 Les deux notes complémentaires</div>
        <p style={{ fontSize:13, color:'#5A5A5A', lineHeight:1.6, marginTop:0 }}>
          En plus de la note globale, chaque appel reçoit deux notes qui aident à cibler le coaching :
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:10 }}>
          <div style={{ padding:'14px 16px', borderRadius:10, background:'rgba(201,168,76,0.06)' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#C9A84C', marginBottom:6 }}>🟡 Soft Skills</div>
            <div style={{ fontSize:12, color:'#5A5A5A', lineHeight:1.5 }}>Les compétences relationnelles : accroche, écoute, argumentation, détection du besoin, traitement des objections...</div>
          </div>
          <div style={{ padding:'14px 16px', borderRadius:10, background:'rgba(83,74,183,0.06)' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#534AB7', marginBottom:6 }}>🔵 Process & Produit</div>
            <div style={{ fontSize:12, color:'#5A5A5A', lineHeight:1.5 }}>Le respect des procédures et la maîtrise du CRM : identification, verrouillage, création d'activité, workflow...</div>
          </div>
        </div>
      </div>

      {/* Détail de la grille */}
      <div style={card}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'#C9A84C', marginBottom:12 }}>📋 Le détail de la grille</div>
        {GRILLE.map(sec => (
          <div key={sec.section} style={{ marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#2C2C2C', marginBottom:6 }}>{sec.section} <span style={{ fontSize:11, color:'#8A8A7A' }}>({sec.poids}%)</span></div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {sec.items.map(it => (
                <span key={it.item} style={{ fontSize:11, padding:'4px 10px', borderRadius:8, background: it.categorie==='soft' ? 'rgba(201,168,76,0.08)' : 'rgba(83,74,183,0.08)', color: it.categorie==='soft' ? '#C9A84C' : '#534AB7' }}>
                  {it.categorie==='soft'?'🟡':'🔵'} {it.item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
