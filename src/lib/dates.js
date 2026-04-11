import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, isWithinInterval, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function getDateRange(periode, dateDebut = null, dateFin = null) {
  const now = new Date()
  switch (periode) {
    case 'jour':
      return { debut: new Date('2000-01-01'), fin: new Date('2099-12-31') }
    case 'semaine':
      return { debut: new Date('2000-01-01'), fin: new Date('2099-12-31') }
    case 'mois':
      return { debut: new Date('2000-01-01'), fin: new Date('2099-12-31') }
    case 'trimestre':
      return { debut: startOfQuarter(now), fin: endOfQuarter(now) }
    case 'perso':
      return {
        debut: dateDebut ? startOfDay(new Date(dateDebut)) : startOfMonth(now),
        fin: dateFin ? endOfDay(new Date(dateFin)) : endOfMonth(now)
      }
    default:
      return { debut: new Date('2000-01-01'), fin: new Date('2099-12-31') }
  }
}

export function filtrerParPeriode(saisies, periode, dateDebut = null, dateFin = null) {
  if (periode === 'trimestre') {
    const { debut, fin } = getDateRange(periode, dateDebut, dateFin)
    return saisies.filter(s => {
      const date = parseISO(s.date)
      return isWithinInterval(date, { start: debut, end: fin })
    })
  }
  if (periode === 'perso') {
    const { debut, fin } = getDateRange(periode, dateDebut, dateFin)
    return saisies.filter(s => {
      const date = parseISO(s.date)
      return isWithinInterval(date, { start: debut, end: fin })
    })
  }
  return saisies
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
