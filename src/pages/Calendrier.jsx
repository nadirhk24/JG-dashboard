import React, { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const TYPES_ABSENCE = [
  { id: 'conge_paye', label: 'Congé payé', color: '#534AB7', bg: 'rgba(83,74,183,0.08)' },
  { id: 'conge_sans_solde', label: 'Congé sans solde', color: '#378ADD', bg: 'rgba(55,138,221,0.08)' },
  { id: 'maladie', label: 'Maladie', color: '#E05C5C', bg: 'rgba(224,92,92,0.08)' },
  { id: 'formation', label: 'Formation', color: '#4CAF7D', bg: 'rgba(76,175,125,0.08)' },
  { id: 'urgence', label: 'Urgence', color: '#E8A040', bg: 'rgba(232,160,64,0.08)' },
  { id: 'depart_autorise', label: 'Départ autorisé', color: '#C9A84C', bg: 'rgba(201,168,76,0.08)' },
  { id: 'depart_non_autorise', label: 'Départ non autorisé', color: '#E05C5C', bg: 'rgba(224,92,92,0.12)' },
]

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year, month) { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1 }

export default function Calendrier() {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'
  const isConseillere = profil?.role === 'conseillere'
  const myConseillereId = profil?.conseillere_id || null
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [joursSpeciaux, setJoursSpeciaux] = useState([])
  const [absences, setAbsences] = useState([])
  const [conseilleresList, setConseilleresList] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)
  const [activeTab, setActiveTab] = useState('calendrier')
  const [newJour, setNewJour] = useState({ date: '', type: 'conge', label: '' })
  const [newAbsence, setNewAbsence] = useState({ conseillere_id: '', date_debut: '', date_fin: '', type: 'conge_paye', motif: '' })
  const [filterConseillere, setFilterConseillere] = useState('all')

  useEffect(() => {
    loadCalendrier()
    loadAbsences()
    loadConseilleres()
  }, [])

  async function loadCalendrier() {
    const { data } = await supabase.from('calendrier').select('*').order('date')
    setJoursSpeciaux(data || [])
  }

  async function loadAbsences() {
    const { data } = await supabase.from('absences_conseilleres')
      .select('*, conseilleres(nom)').order('date_debut', { ascending: false })
    setAbsences(data || [])
  }

  async function loadConseilleres() {
    const { data } = await supabase.from('conseilleres').select('id, nom').eq('actif', true).order('nom')
    setConseilleresList(data || [])
  }

  async function addJour() {
    if (!newJour.date) { setMsg({ type: 'error', text: 'Date obligatoire' }); return }
    setSaving(true)
    const { error } = await supabase.from('calendrier').upsert({ date: newJour.date, type: newJour.type, label: newJour.label }, { onConflict: 'date' })
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Jour ajouté !' }); loadCalendrier(); setNewJour({ date: '', type: 'conge', label: '' }); setShowAddForm(false); setTimeout(() => setMsg(null), 3000) }
  }

  async function removeJour(id) {
    await supabase.from('calendrier').delete().eq('id', id)
    loadCalendrier()
  }

  async function addAbsence() {
    if (!newAbsence.conseillere_id || !newAbsence.date_debut || !newAbsence.date_fin) {
      setMsg({ type: 'error', text: 'Conseillère, date début et date fin obligatoires' }); return
    }
    if (newAbsence.date_fin < newAbsence.date_debut) {
      setMsg({ type: 'error', text: 'La date de fin doit être après la date de début' }); return
    }
    setSaving(true)
    const { error } = await supabase.from('absences_conseilleres').insert({
      conseillere_id: newAbsence.conseillere_id,
      date_debut: newAbsence.date_debut,
      date_fin: newAbsence.date_fin,
      type: newAbsence.type,
      motif: newAbsence.motif
    })
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'success', text: 'Absence enregistrée !' })
      loadAbsences()
      setNewAbsence({ conseillere_id: '', date_debut: '', date_fin: '', type: 'conge_paye', motif: '' })
      setShowAbsenceForm(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function removeAbsence(id) {
    if (!confirm('Supprimer cette absence ?')) return
    await supabase.from('absences_conseilleres').delete().eq('id', id)
    loadAbsences()
  }

  // Calculer les jours off par conseillère sur le mois affiché
  const absencesDuMois = useMemo(() => {
    const result = {}
    const firstDay = `${year}-${String(month+1).padStart(2,'0')}-01`
    const lastDay = `${year}-${String(month+1).padStart(2,'0')}-${String(getDaysInMonth(year, month)).padStart(2,'0')}`
    absences.forEach(a => {
      if (a.date_fin < firstDay || a.date_debut > lastDay) return
      if (!result[a.conseillere_id]) result[a.conseillere_id] = []
      // Générer tous les jours de l'absence dans le mois
      const start = new Date(Math.max(new Date(a.date_debut), new Date(firstDay)))
      const end = new Date(Math.min(new Date(a.date_fin), new Date(lastDay)))
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0) { // Exclure dimanches
          result[a.conseillere_id].push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
        }
      }
    })
    return result
  }, [absences, year, month])

  const joursNonOuvrables = useMemo(() => {
    const set = new Set()
    joursSpeciaux.forEach(j => { if (j.type === 'ferie' || j.type === 'conge') set.add(j.date) })
    return set
  }, [joursSpeciaux])

  const joursMap = useMemo(() => {
    const map = {}
    joursSpeciaux.forEach(j => { map[j.date] = j })
    return map
  }, [joursSpeciaux])

  const statsMonth = useMemo(() => {
    const days = getDaysInMonth(year, month)
    let ouvrables = 0, feries = 0, conges = 0, repos = 0
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d)
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dayOfWeek = date.getDay()
      if (dayOfWeek === 0) { repos++; continue }
      const special = joursMap[dateStr]
      if (special?.type === 'ferie') feries++
      else if (special?.type === 'conge') conges++
      else ouvrables++
    }
    return { ouvrables, feries, conges, repos, total: days }
  }, [year, month, joursMap])

  const calendarDays = useMemo(() => {
    const days = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d)
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dayOfWeek = date.getDay()
      const special = joursMap[dateStr]
      let type = 'ouvrable'
      if (dayOfWeek === 0) type = 'repos'
      else if (special?.type === 'ferie') type = 'ferie'
      else if (special?.type === 'conge') type = 'conge'
      // Compter combien de conseillères sont absentes ce jour
      const absentes = conseilleresList.filter(c =>
        absencesDuMois[c.id]?.includes(dateStr)
      )
      cells.push({ day: d, date: dateStr, type, label: special?.label, id: special?.id, isSamedi: dayOfWeek === 6, absentes })
    }
    return cells
  }, [year, month, joursMap, absencesDuMois, conseilleresList])

  const typeColors = {
    ouvrable: { bg: '#F8F7F4', color: '#2C2C2C', border: 'rgba(201,168,76,0.1)' },
    ferie: { bg: 'rgba(224,92,92,0.08)', color: '#E05C5C', border: 'rgba(224,92,92,0.2)' },
    conge: { bg: 'rgba(83,74,183,0.08)', color: '#534AB7', border: 'rgba(83,74,183,0.2)' },
    repos: { bg: '#F0EEE8', color: '#8A8A7A', border: 'rgba(0,0,0,0.05)' },
  }

  const inputStyle = { padding: '8px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none', fontFamily: 'DM Sans, sans-serif' }
  const labelStyle = { fontSize: 11, color: '#5A5A5A', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }

  const filteredAbsences = useMemo(() => {
    let base = absences
    if (isConseillere && myConseillereId) base = base.filter(a => a.conseillere_id === myConseillereId)
    else if (filterConseillere !== 'all') base = base.filter(a => a.conseillere_id === filterConseillere)
    return base
  }, [absences, isConseillere, myConseillereId, filterConseillere])

  // Stats absences du mois par conseillère
  const statsAbsences = useMemo(() => {
    return conseilleresList.map(c => ({
      ...c,
      jours: absencesDuMois[c.id]?.length || 0,
      absencesActives: absences.filter(a =>
        a.conseillere_id === c.id &&
        a.date_debut <= `${year}-${String(month+1).padStart(2,'0')}-${String(getDaysInMonth(year,month)).padStart(2,'0')}` &&
        a.date_fin >= `${year}-${String(month+1).padStart(2,'0')}-01`
      )
    })).filter(c => c.jours > 0)
  }, [conseilleresList, absencesDuMois, absences, year, month])

  return (
    <div>
      <PageHeader title="Calendrier" subtitle="Jours ouvrables, fériés, congés équipe & absences conseillères" />

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>
          {msg.text}
        </div>
      )}

      {/* ONGLETS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid rgba(201,168,76,0.15)', paddingBottom: 0 }}>
        {[
          { id: 'calendrier', label: 'Calendrier équipe' },
          ...(!isConseillere ? [{ id: 'absences', label: `Absences conseillères${statsAbsences.length > 0 ? ` (${statsAbsences.length} ce mois)` : ''}` }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === t.id ? 500 : 400,
            color: activeTab === t.id ? '#C9A84C' : '#5A5A5A',
            borderBottom: `2px solid ${activeTab === t.id ? '#C9A84C' : 'transparent'}`,
            marginBottom: -1, fontFamily: 'DM Sans, sans-serif'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ONGLET CALENDRIER ÉQUIPE ── */}
      {activeTab === 'calendrier' && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Jours ouvrables', val: statsMonth.ouvrables, color: '#C9A84C' },
              { label: 'Jours fériés', val: statsMonth.feries, color: '#E05C5C' },
              { label: 'Congés équipe', val: statsMonth.conges, color: '#534AB7' },
              { label: 'Repos (dim.)', val: statsMonth.repos, color: '#8A8A7A' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid rgba(201,168,76,0.15)', borderTop: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: 'DM Sans' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Calendrier */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => { if (month === 0) { setMonth(11); setYear(y=>y-1) } else setMonth(m=>m-1) }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)', background: '#fff', color: '#C9A84C', cursor: 'pointer', fontSize: 16 }}>‹</button>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: '#2C2C2C', minWidth: 160, textAlign: 'center' }}>{MOIS[month]} {year}</div>
                <button onClick={() => { if (month === 11) { setMonth(0); setYear(y=>y+1) } else setMonth(m=>m+1) }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)', background: '#fff', color: '#C9A84C', cursor: 'pointer', fontSize: 16 }}>›</button>
              </div>
              {isSuperAdmin && <button onClick={() => setShowAddForm(p=>!p)} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showAddForm ? '#C9A84C' : '#fff', color: showAddForm ? '#fff' : '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                {showAddForm ? '✕ Annuler' : '+ Ajouter jour'}
              </button>}
            </div>

            {showAddForm && (
              <div style={{ background: 'rgba(201,168,76,0.05)', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid rgba(201,168,76,0.15)', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div><div style={labelStyle}>Date</div><input type="date" value={newJour.date} onChange={e=>setNewJour(p=>({...p,date:e.target.value}))} style={inputStyle}/></div>
                <div><div style={labelStyle}>Type</div>
                  <select value={newJour.type} onChange={e=>setNewJour(p=>({...p,type:e.target.value}))} style={{ ...inputStyle }}>
                    <option value="conge">Congé équipe</option>
                    <option value="ferie">Jour férié</option>
                    <option value="repos">Repos</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}><div style={labelStyle}>Description</div><input type="text" value={newJour.label} onChange={e=>setNewJour(p=>({...p,label:e.target.value}))} placeholder="ex: Congé Aïd" style={{ ...inputStyle, width: '100%' }}/></div>
                <button onClick={addJour} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }}>Ajouter</button>
              </div>
            )}

            {/* Grille calendrier */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
              {JOURS.map(j => <div key={j} style={{ textAlign: 'center', fontSize: 11, color: '#5A5A5A', fontWeight: 500, padding: '4px 0' }}>{j}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarDays.map((cell, i) => {
                if (!cell) return <div key={`empty-${i}`}></div>
                const { bg, color, border } = typeColors[cell.type]
                return (
                  <div key={cell.date} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 4px', minHeight: 56, position: 'relative' }}>
                    <div style={{ fontSize: 13, fontWeight: cell.type === 'ouvrable' ? 400 : 600, color, textAlign: 'center' }}>{cell.day}</div>
                    {cell.label && <div style={{ fontSize: 8, color, textAlign: 'center', marginTop: 1, lineHeight: 1.2 }}>{cell.label.substring(0, 12)}</div>}
                    {cell.absentes.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', marginTop: 2 }}>
                        {cell.absentes.slice(0, 3).map(c => (
                          <div key={c.id} title={c.nom} style={{ width: 14, height: 14, borderRadius: '50%', background: '#E8A040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff', fontWeight: 600 }}>
                            {c.nom.charAt(0)}
                          </div>
                        ))}
                        {cell.absentes.length > 3 && <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#8A8A7A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff' }}>+{cell.absentes.length - 3}</div>}
                      </div>
                    )}
                    {cell.id && cell.type !== 'ferie' && (
                      <button onClick={() => removeJour(cell.id)} style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: 'rgba(224,92,92,0.2)', border: 'none', color: '#E05C5C', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Légende */}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              {[['#C9A84C','Ouvrable'],['#E05C5C','Férié'],['#534AB7','Congé équipe'],['#8A8A7A','Repos (Dim.)'],['#E8A040','Absences conseillères']].map(([c,l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5A5A5A' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block', opacity: 0.8 }}></span>{l}
                </span>
              ))}
            </div>
          </div>

          {/* Tableau jours spéciaux */}
          <SectionTitle>Jours spéciaux — {year}</SectionTitle>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date','Type','Description','Action'].map(h => (
                    <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {joursSpeciaux.filter(j => j.date.startsWith(String(year))).map(j => (
                  <tr key={j.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 500, color: '#C9A84C' }}>{j.date}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12 }}>
                      <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: j.type==='ferie'?'rgba(224,92,92,0.1)':j.type==='conge'?'rgba(83,74,183,0.1)':'rgba(138,138,122,0.1)', color: j.type==='ferie'?'#E05C5C':j.type==='conge'?'#534AB7':'#8A8A7A' }}>
                        {j.type === 'ferie' ? 'Férié' : j.type === 'conge' ? 'Congé' : 'Repos'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: '#5A5A5A' }}>{j.label}</td>
                    <td style={{ padding: '9px 10px' }}>
                      {j.type !== 'ferie' && (
                        <button onClick={() => removeJour(j.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Supprimer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ONGLET ABSENCES CONSEILLÈRES ── */}
      {activeTab === 'absences' && (
        <>
          {/* Résumé du mois */}
          {statsAbsences.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 12 }}>Absences — {MOIS[month]} {year}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {statsAbsences.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(232,160,64,0.08)', borderRadius: 8, border: '1px solid rgba(232,160,64,0.2)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E8A040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff' }}>
                      {c.nom.split(' ').map(n=>n[0]).join('').substring(0,2)}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#2C2C2C' }}>{c.nom.split(' ')[0]}</div>
                      <div style={{ fontSize: 10, color: '#E8A040' }}>{c.jours} jour{c.jours > 1 ? 's' : ''} off</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header + filtres */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isConseillere ? (
                <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(201,168,76,0.1)', border: '1.5px solid rgba(201,168,76,0.3)', fontSize: 12, fontWeight: 500, color: '#C9A84C' }}>
                  {conseilleresList?.find(c => c.id === myConseillereId)?.nom || 'Mes absences'}
                </div>
              ) : (
                <select value={filterConseillere} onChange={e => setFilterConseillere(e.target.value)} style={{ ...inputStyle, fontSize: 12 }}>
                  <option value="all">Toutes les conseillères</option>
                  {conseilleresList.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              )}
            </div>
            {isSuperAdmin && <button onClick={() => setShowAbsenceForm(p=>!p)} style={{ padding: '9px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showAbsenceForm ? '#C9A84C' : '#fff', color: showAbsenceForm ? '#fff' : '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              {showAbsenceForm ? '✕ Annuler' : '+ Déclarer une absence'}
            </button>}
          </div>

          {/* Formulaire absence - super admin uniquement */}
          {isSuperAdmin && showAbsenceForm && (
            <div style={{ background: 'rgba(201,168,76,0.05)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1.5px solid rgba(201,168,76,0.25)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', marginBottom: 16 }}>Nouvelle absence</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={labelStyle}>Conseillère *</div>
                  <select value={newAbsence.conseillere_id} onChange={e=>setNewAbsence(p=>({...p,conseillere_id:e.target.value}))} style={{ ...inputStyle, width: '100%' }}>
                    <option value="">-- Choisir --</option>
                    {conseilleresList.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Date début *</div>
                  <input type="date" value={newAbsence.date_debut} onChange={e=>setNewAbsence(p=>({...p,date_debut:e.target.value}))} style={{ ...inputStyle, width: '100%' }}/>
                </div>
                <div>
                  <div style={labelStyle}>Date fin *</div>
                  <input type="date" value={newAbsence.date_fin} onChange={e=>setNewAbsence(p=>({...p,date_fin:e.target.value}))} style={{ ...inputStyle, width: '100%' }}/>
                </div>
                <div>
                  <div style={labelStyle}>Type</div>
                  <select value={newAbsence.type} onChange={e=>setNewAbsence(p=>({...p,type:e.target.value}))} style={{ ...inputStyle, width: '100%' }}>
                    {TYPES_ABSENCE.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={labelStyle}>Motif (optionnel)</div>
                <input type="text" value={newAbsence.motif} onChange={e=>setNewAbsence(p=>({...p,motif:e.target.value}))} placeholder="Précisions..." style={{ ...inputStyle, width: '100%' }}/>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={addAbsence} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button onClick={() => setShowAbsenceForm(false)} style={{ padding: '9px 20px', borderRadius: 8, background: '#F0EEE8', color: '#5A5A5A', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans' }}>Annuler</button>
              </div>
            </div>
          )}

          {/* Liste absences */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)' }}>
            {filteredAbsences.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#8A8A7A', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
                Aucune absence enregistrée
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Conseillère','Période','Durée','Type','Motif','Action'].map(h => (
                      <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAbsences.map(a => {
                    const typeInfo = TYPES_ABSENCE.find(t => t.id === a.type) || { label: a.type, color: '#8A8A7A', bg: '#F0EEE8' }
                    const debut = new Date(a.date_debut)
                    const fin = new Date(a.date_fin)
                    const dureeMs = fin - debut
                    const dureeJours = Math.round(dureeMs / (1000*60*60*24)) + 1
                    return (
                      <tr key={a.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding: '10px 10px', fontSize: 12 }}>
                          <div style={{ fontWeight: 500, color: '#2C2C2C' }}>{a.conseilleres?.nom || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>
                          {a.date_debut} → {a.date_fin}
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: '#2C2C2C' }}>
                          {dureeJours} jour{dureeJours > 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: typeInfo.bg, color: typeInfo.color }}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: '#8A8A7A' }}>{a.motif || '—'}</td>
                        <td style={{ padding: '10px 10px' }}>
                          {isSuperAdmin && <button onClick={() => removeAbsence(a.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Supprimer</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}