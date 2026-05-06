// ── useAbsences.js ───────────────────────────────────────────
// Hook partagé pour récupérer les jours off des conseillères
// Utilisé par : CC, FluxRDV, AnalyseCV
// Usage:
//   const { isJourOff, joursOffSet } = useAbsences()
//   isJourOff(conseillereId, '2026-05-06') → true/false
// ────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

export function useAbsences() {
  const [absences, setAbsences] = useState([])
  const [joursSpeciaux, setJoursSpeciaux] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: abs }, { data: jours }] = await Promise.all([
        supabase.from('absences_conseilleres').select('*'),
        supabase.from('calendrier').select('*')
      ])
      setAbsences(abs || [])
      setJoursSpeciaux(jours || [])
      setLoading(false)
    }
    load()
  }, [])

  // Set des jours fériés/congés équipe
  const joursEquipeOff = new Set(
    joursSpeciaux
      .filter(j => j.type === 'ferie' || j.type === 'conge')
      .map(j => j.date)
  )

  // Vérifie si un jour est off pour une conseillère donnée
  const isJourOff = useCallback((conseillereId, dateStr) => {
    // Dimanche → off
    const d = new Date(dateStr)
    if (d.getDay() === 0) return true
    // Férié/Congé équipe → off
    if (joursEquipeOff.has(dateStr)) return true
    // Absence individuelle → off
    return absences.some(a =>
      a.conseillere_id === conseillereId &&
      dateStr >= a.date_debut &&
      dateStr <= a.date_fin
    )
  }, [absences, joursEquipeOff])

  // Retourne le Set des jours off pour une conseillère sur une période
  const getJoursOff = useCallback((conseillereId, dateDebut, dateFin) => {
    const set = new Set()
    const start = new Date(dateDebut)
    const end = new Date(dateFin)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      if (isJourOff(conseillereId, dateStr)) set.add(dateStr)
    }
    return set
  }, [isJourOff])

  // Compte les jours travaillés pour une conseillère sur une période
  const getJoursTravailles = useCallback((conseillereId, dateDebut, dateFin) => {
    let count = 0
    const start = new Date(dateDebut)
    const end = new Date(dateFin)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      if (!isJourOff(conseillereId, dateStr)) count++
    }
    return count
  }, [isJourOff])

  return { absences, joursSpeciaux, isJourOff, getJoursOff, getJoursTravailles, loading }
}
