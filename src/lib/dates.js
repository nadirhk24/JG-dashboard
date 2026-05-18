// JG Dashboard - dates.js - v20260517 - joursExclus
import React from 'react'
import { startOfWeek, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from './supabase'

// ============================================================
// FONCTIONS EXISTANTES (inchangées)
// ============================================================

export function getDateRange(periode, dateDebut = null, dateFin = null) {
  const now = new Date()
  switch (periode) {
    case 'jour': return { debut: new Date(now - 30*86400000), fin: now }
    case 'semaine': return { debut: new Date(now - 84*86400000), fin: now }
    case 'mois': return { debut: new Date(now - 730*86400000), fin: now }
    case 'trimestre': return { debut: new Date(now - 730*86400000), fin: now }
    case 'perso': return {
      debut: dateDebut ? new Date(dateDebut) : new Date(now.getFullYear(), now.getMonth(), 1),
      fin: dateFin ? new Date(dateFin) : new Date(now.getFullYear(), now.getMonth()+1, 0)
    }
    default: return { debut: new Date(now - 730*86400000), fin: now }
  }
}

export function filtrerParSelection(saisies, selected) {
  if (!selected || selected.type === 'global') return saisies
  return saisies.filter(s => {
    const sDebut = s.date_debut || s.date
    const sFin = s.date_fin || s.date
    if (selected.type === 'custom') return sDebut <= selected.to && sFin >= selected.from
    if (selected.type === 'year') {
      return sDebut.startsWith(selected.value) || sFin.startsWith(selected.value) ||
             (sDebut <= selected.value + '-12-31' && sFin >= selected.value + '-01-01')
    }
    if (selected.type === 'quarter') {
      const [y, q] = selected.value.split('-Q')
      const qStart = `${y}-${String((parseInt(q)-1)*3+1).padStart(2,'0')}-01`
      const qEnd = `${y}-${String(parseInt(q)*3).padStart(2,'0')}-31`
      return sDebut <= qEnd && sFin >= qStart
    }
    if (selected.type === 'month') {
      const mEnd = selected.value + '-31'
      return sDebut <= mEnd && sFin >= selected.value + '-01'
    }
    if (selected.type === 'day') return sDebut <= selected.value && sFin >= selected.value
    return true
  })
}

export function filtrerParPeriode(saisies, periode, dateDebut = null, dateFin = null) {
  const { debut, fin } = getDateRange(periode, dateDebut, dateFin)
  const debutStr = debut.toISOString().split('T')[0]
  const finStr = fin.toISOString().split('T')[0]
  return saisies.filter(s => {
    const sDebut = s.date_debut || s.date
    const sFin = s.date_fin || s.date
    return sDebut <= finStr && sFin >= debutStr
  })
}

export function formatDate(dateStr) {
  try { return format(parseISO(dateStr), 'dd MMM yyyy', { locale: fr }) } catch { return dateStr }
}

export function formatDateShort(dateStr) {
  try { return format(parseISO(dateStr), 'dd/MM', { locale: fr }) } catch { return dateStr }
}

export function groupByDay(saisies) {
  const groups = {}
  saisies.forEach(s => {
    const key = (s.date_debut || s.date).substring(0, 10)
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export function groupByWeek(saisies) {
  const groups = {}
  saisies.forEach(s => {
    const raw = s.date_debut || s.date; if (!raw) return
    const date = parseISO(String(raw).substring(0,10) + 'T12:00:00')
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const key = format(weekStart, 'yyyy-MM-dd')
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export function groupByMonth(saisies) {
  const groups = {}
  saisies.forEach(s => {
    const key = (s.date_debut || s.date).substring(0, 7)
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export function groupByQuarter(saisies) {
  const groups = {}
  saisies.forEach(s => {
    const raw = s.date_debut || s.date; if (!raw) return
    const date = parseISO(String(raw).substring(0,10) + 'T12:00:00')
    const q = Math.floor(date.getMonth() / 3) + 1
    const key = `${date.getFullYear()}-Q${q}`
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export function getGroupFunction(periode) {
  switch (periode) {
    case 'jour': return groupByDay
    case 'semaine': return groupByWeek
    case 'trimestre': return groupByQuarter
    case 'custom': return groupByDay
    case 'mois':
    default: return groupByMonth
  }
}

export function formatGroupLabel(key, periode) {
  if (periode === 'jour') {
    try { return format(parseISO(key), 'dd/MM', { locale: fr }) } catch { return key }
  }
  if (periode === 'semaine') {
    try { return 'S ' + format(parseISO(key), 'dd/MM', { locale: fr }) } catch { return key }
  }
  if (periode === 'trimestre') return key
  if (periode === 'mois') {
    try { return format(parseISO(key + '-01'), 'MMM yy', { locale: fr }) } catch { return key }
  }
  return key
}

// ============================================================
// GESTION JOURS EXCLUS — Dimanches, Fériés, Congés individuels
// ============================================================

// Cache global (5 minutes)
let _cacheJoursExclus = null
let _cacheAbsences = null
let _cacheLoadedAt = null
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Charge les jours exclus depuis Supabase :
 * - table `calendrier` : fériés et congés collectifs
 * - table `absences_conseilleres` : congés individuels
 */
export async function chargerJoursExclus() {
  const now = Date.now()
  if (_cacheJoursExclus && _cacheLoadedAt && (now - _cacheLoadedAt) < CACHE_TTL_MS) {
    return { joursFeries: _cacheJoursExclus, absences: _cacheAbsences }
  }
  const [{ data: cal }, { data: abs }] = await Promise.all([
    supabase.from('calendrier').select('date, type').in('type', ['ferie', 'conge']),
    supabase.from('absences_conseilleres').select('conseillere_id, date_debut, date_fin')
  ])
  _cacheJoursExclus = new Set((cal || []).map(j => j.date))
  _cacheAbsences = abs || []
  _cacheLoadedAt = now
  return { joursFeries: _cacheJoursExclus, absences: _cacheAbsences }
}

/** Invalider le cache (ex: après modification du calendrier) */
export function invaliderCacheJoursExclus() {
  _cacheJoursExclus = null
  _cacheAbsences = null
  _cacheLoadedAt = null
}

/** Vérifie si une date est un dimanche */
export function estDimanche(dateStr) {
  try { return new Date(dateStr + 'T12:00:00').getDay() === 0 } catch { return false }
}

/** Vérifie si une date est exclue (dimanche ou férié) */
export function estJourExclu(dateStr, joursFeries) {
  if (estDimanche(dateStr)) return true
  if (joursFeries && joursFeries.has(dateStr)) return true
  return false
}

/**
 * Retourne le dernier jour ouvré ≤ dateStr
 * Dimanche → Samedi, Férié → jour ouvré précédent
 */
export function getJourOuvre(dateStr, joursFeries) {
  let d = new Date(dateStr + 'T12:00:00')
  for (let i = 0; i < 7; i++) {
    const str = d.toISOString().split('T')[0]
    if (!estJourExclu(str, joursFeries)) return str
    d.setDate(d.getDate() - 1)
  }
  return dateStr
}

/**
 * Normalise les saisies :
 * - Déplace les données des dimanches/fériés vers le jour ouvré d'avant
 * - Additionne si plusieurs jours tombent sur le même jour ouvré
 * À appliquer AVANT groupByDay dans les modules
 */
export function normaliserSaisies(saisies, joursFeries) {
  if (!joursFeries || joursFeries.size === 0) return saisies

  const CHAMPS = [
    'leads_bruts', 'non_exploitables_cc', 'indispos', 'echanges',
    'echanges_exploitables', 'rdv', 'visites', 'ventes', 'leads_nets'
  ]

  const map = {}
  saisies.forEach(s => {
    const dateRaw = s.date_debut || s.date || ''
    const dateNorm = estJourExclu(dateRaw, joursFeries)
      ? getJourOuvre(dateRaw, joursFeries)
      : dateRaw
    const key = `${s.conseillere_id || 'global'}_${dateNorm}`

    if (!map[key]) {
      map[key] = { ...s, date: dateNorm, date_debut: dateNorm, date_fin: dateNorm }
    } else {
      CHAMPS.forEach(c => {
        if (s[c] !== undefined) map[key][c] = (map[key][c] || 0) + (s[c] || 0)
      })
    }
  })
  return Object.values(map)
}

/**
 * Filtre les saisies pour le calcul du CV :
 * - Exclut dimanches et fériés
 * - Exclut les congés individuels de la conseillère si conseillereId fourni
 * Usage : avant calcCV() dans AnalyseCV et DashboardCC
 */
export function filtrerJoursOuvrables(saisies, joursFeries, absences, conseillereId = null) {
  return saisies.filter(s => {
    const dateStr = s.date_debut || s.date || ''
    // Exclure dimanches et fériés
    if (estJourExclu(dateStr, joursFeries)) return false
    // Exclure congés individuels
    if (conseillereId && absences && absences.length > 0) {
      const enConge = absences.some(a =>
        a.conseillere_id === conseillereId &&
        dateStr >= a.date_debut &&
        dateStr <= a.date_fin
      )
      if (enConge) return false
    }
    return true
  })
}

/**
 * Hook React pour utiliser les jours exclus dans les composants
 * Usage:
 *   const { joursFeries, absences, loading } = useJoursExclus()
 *   const saisiesNorm = normaliserSaisies(saisies, joursFeries)
 */
export function useJoursExclus() {
  const [joursFeries, setJoursFeries] = React.useState(new Set())
  const [absences, setAbsences] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    chargerJoursExclus().then(({ joursFeries: jf, absences: abs }) => {
      setJoursFeries(jf)
      setAbsences(abs)
      setLoading(false)
    })
  }, [])

  return { joursFeries, absences, loading }
}