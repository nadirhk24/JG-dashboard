import React, { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

// Lundi-Samedi = ouvrable (dimanche = repos)
function isOuvrable(date, joursNonOuvrables) {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  if (dayOfWeek === 0) return false // Dimanche
  const dateStr = d.toISOString().split('T')[0]
  return !joursNonOuvrables.has(dateStr)
}

export default function Calendrier() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [joursSpeciaux, setJoursSpeciaux] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newJour, setNewJour] = useState({ date: '', type: 'conge', label: '' })

  useEffect(() => { loadCalendrier() }, [])

  async function loadCalendrier() {
    const { data } = await supabase.from('calendrier').select('*').order('date')
    setJoursSpeciaux(data || [])
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
      const dateStr = date.toISOString().split('T')[0]
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
      const dateStr = date.toISOString().split('T')[0]
      const dayOfWeek = date.getDay()
      const special = joursMap[dateStr]
      let type = 'ouvrable'
      if (dayOfWeek === 0) type = 'repos'
      else if (special?.type === 'ferie') type = 'ferie'
      else if (special?.type === 'conge') type = 'conge'
      cells.push({ day: d, date: dateStr, type, label: special?.label, id: special?.id, isSamedi: dayOfWeek === 6 })
    }
    return cells
  }, [year, month, joursMap])

  const typeColors = {
    ouvrable: { bg: '#F8F7F4', color: '#2C2C2C', border: 'rgba(201,168,76,0.1)' },
    ferie: { bg: 'rgba(224,92,92,0.08)', color: '#E05C5C', border: 'rgba(224,92,92,0.2)' },
    conge: { bg: 'rgba(83,74,183,0.08)', color: '#534AB7', border: 'rgba(83,74,183,0.2)' },
    repos: { bg: '#F0EEE8', color: '#8A8A7A', border: 'rgba(0,0,0,0.05)' },
  }

  const inputStyle = { padding: '8px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none' }

  return (
    <div>
      <PageHeader title="Calendrier" subtitle="Jours ouvrables, fériés et congés équipe" />

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, marginBottom: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flex: 1 }}>
          {[
            { label: 'Jours ouvrables', val: statsMonth.ouvrables, color: '#C9A84C' },
            { label: 'Jours fériés', val: statsMonth.feries, color: '#E05C5C' },
            { label: 'Congés', val: statsMonth.conges, color: '#534AB7' },
            { label: 'Repos (dim.)', val: statsMonth.repos, color: '#8A8A7A' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px', border: `1px solid rgba(201,168,76,0.15)`, borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: 'DM Sans' }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => { if (month === 0) { setMonth(11); setYear(y=>y-1) } else setMonth(m=>m-1) }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)', background: '#fff', color: '#C9A84C', cursor: 'pointer', fontSize: 16 }}>‹</button>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 600, color: '#2C2C2C', minWidth: 160, textAlign: 'center' }}>{MOIS[month]} {year}</div>
            <button onClick={() => { if (month === 11) { setMonth(0); setYear(y=>y+1) } else setMonth(m=>m+1) }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.2)', background: '#fff', color: '#C9A84C', cursor: 'pointer', fontSize: 16 }}>›</button>
          </div>
          <button onClick={() => setShowAddForm(p=>!p)} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showAddForm ? '#C9A84C' : '#fff', color: showAddForm ? '#fff' : '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            {showAddForm ? '✕ Annuler' : '+ Ajouter jour'}
          </button>
        </div>

        {showAddForm && (
          <div style={{ background: 'rgba(201,168,76,0.05)', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid rgba(201,168,76,0.15)', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5 }}>Date</div><input type="date" value={newJour.date} onChange={e=>setNewJour(p=>({...p,date:e.target.value}))} style={inputStyle}/></div>
            <div><div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5 }}>Type</div>
              <select value={newJour.type} onChange={e=>setNewJour(p=>({...p,type:e.target.value}))} style={{ ...inputStyle, appearance: 'none', paddingRight: 28 }}>
                <option value="conge">Congé équipe</option>
                <option value="ferie">Jour férié</option>
                <option value="repos">Repos</option>
              </select>
            </div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 5 }}>Description</div><input type="text" value={newJour.label} onChange={e=>setNewJour(p=>({...p,label:e.target.value}))} placeholder="ex: Congé Aïd" style={{ ...inputStyle, width: '100%' }}/></div>
            <button onClick={addJour} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Ajouter</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {JOURS.map(j => <div key={j} style={{ textAlign: 'center', fontSize: 11, color: '#5A5A5A', fontWeight: 500, padding: '4px 0' }}>{j}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {calendarDays.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`}></div>
            const { bg, color, border } = typeColors[cell.type]
            return (
              <div key={cell.date} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 4px', minHeight: 52, position: 'relative', cursor: cell.type !== 'repos' && cell.type !== 'ferie' ? 'default' : 'default' }}>
                <div style={{ fontSize: 13, fontWeight: cell.type === 'ouvrable' ? 400 : 600, color, textAlign: 'center' }}>{cell.day}</div>
                {cell.isSamedi && cell.type === 'ouvrable' && <div style={{ fontSize: 8, color: '#C9A84C', textAlign: 'center', marginTop: 2 }}>½ jour</div>}
                {cell.label && <div style={{ fontSize: 8, color, textAlign: 'center', marginTop: 2, lineHeight: 1.2, overflow: 'hidden' }}>{cell.label.substring(0, 12)}</div>}
                {cell.id && cell.type !== 'ferie' && (
                  <button onClick={() => removeJour(cell.id)} style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: 'rgba(224,92,92,0.2)', border: 'none', color: '#E05C5C', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {[['#C9A84C','Ouvrable (Lun-Sam)'],['#E05C5C','Férié'],['#534AB7','Congé équipe'],['#8A8A7A','Repos (Dimanche)']].map(([c,l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5A5A5A' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block', opacity: 0.7 }}></span>{l}
            </span>
          ))}
        </div>
      </div>

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
    </div>
  )
}
