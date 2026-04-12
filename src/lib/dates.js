import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subDays, subWeeks, subMonths, subQuarters, isWithinInterval, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function getDateRange(periode, dateDebut = null, dateFin = null) {
  const now = new Date()
  switch (periode) {
    case 'jour': return { debut: subDays(now, 30), fin: now }
    case 'semaine': return { debut: subWeeks(now, 12), fin: now }
    case 'mois': return { debut: subMonths(now, 24), fin: now }
    case 'trimestre': return { debut: subQuarters(now, 8), fin: now }
    case 'perso': return {
      debut: dateDebut ? new Date(dateDebut) : startOfMonth(now),
      fin: dateFin ? new Date(dateFin) : endOfMonth(now)
    }
    default: return { debut: subMonths(now, 24), fin: now }
  }
}

// Filtre les saisies selon la selection drill-down
// Gere les saisies "par periode" qui couvrent plusieurs jours
export function filtrerParSelection(saisies, selected) {
  if (!selected || selected.type === 'global') return saisies
  return saisies.filter(s => {
    const sDebut = s.date_debut || s.date
    const sFin = s.date_fin || s.date
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
    if (selected.type === 'day') {
      return sDebut <= selected.value && sFin >= selected.value
    }
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

// Groupe les saisies par periode pour les graphes
// Pour les saisies "par periode", on les attribue a leur mois/semaine de debut
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
    const date = parseISO(s.date_debut || s.date)
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
    const date = parseISO(s.date_debut || s.date)
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
