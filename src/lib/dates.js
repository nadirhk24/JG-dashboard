import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subDays, subWeeks, subMonths, subQuarters, isWithinInterval, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function getDateRange(periode, dateDebut = null, dateFin = null) {
  const now = new Date()
  switch (periode) {
    case 'jour':
      return { debut: startOfDay(subDays(now, 30)), fin: endOfDay(now) }
    case 'semaine':
      return { debut: startOfWeek(subWeeks(now, 12), { weekStartsOn: 1 }), fin: endOfDay(now) }
    case 'mois':
      return { debut: startOfMonth(subMonths(now, 24)), fin: endOfDay(now) }
    case 'trimestre':
      return { debut: startOfQuarter(subQuarters(now, 8)), fin: endOfDay(now) }
    case 'perso':
      return {
        debut: dateDebut ? startOfDay(new Date(dateDebut)) : startOfMonth(now),
        fin: dateFin ? endOfDay(new Date(dateFin)) : endOfMonth(now)
      }
    default:
      return { debut: startOfMonth(subMonths(now, 24)), fin: endOfDay(now) }
  }
}

export function filtrerParPeriode(saisies, periode, dateDebut = null, dateFin = null) {
  const { debut, fin } = getDateRange(periode, dateDebut, dateFin)
  return saisies.filter(s => {
    const date = parseISO(s.date)
    return isWithinInterval(date, { start: debut, end: fin })
  })
}

export function formatDate(dateStr) {
  return format(parseISO(dateStr), 'dd MMM yyyy', { locale: fr })
}

export function formatDateShort(dateStr) {
  return format(parseISO(dateStr), 'dd/MM', { locale: fr })
}

export function groupByDay(saisies) {
  const groups = {}
  saisies.forEach(s => {
    const key = s.date.substring(0, 10)
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export function groupByWeek(saisies) {
  const groups = {}
  saisies.forEach(s => {
    const date = parseISO(s.date)
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
    const key = s.date.substring(0, 7)
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export function groupByQuarter(saisies) {
  const groups = {}
  saisies.forEach(s => {
    const date = parseISO(s.date)
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
