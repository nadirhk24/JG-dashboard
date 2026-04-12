import { supabase } from './supabase'

// Cache objectifs
let cache = {}

// Charge les objectifs pour une liste de mois
export async function getObjectifsPourPeriode(selected) {
  if (!selected || selected.type === 'global') return {}
  
  // Determiner les mois couverts par la selection
  const mois = getMoisDePeriode(selected)
  if (mois.length === 0) return {}

  // Charger tous les objectifs des mois concernes
  const cacheKey = mois.join(',')
  if (cache[cacheKey]) return cache[cacheKey]

  const { data } = await supabase
    .from('objectifs_callcenter')
    .select('*')
    .is('conseillere_id', null)
    .in('mois', mois.map(m => m + '-01'))

  if (!data || data.length === 0) {
    cache[cacheKey] = {}
    return {}
  }

  // Cumuler les objectifs sur tous les mois
  const cumul = data.reduce((acc, obj) => {
    acc.obj_productivite_pct = obj.obj_productivite_pct || acc.obj_productivite_pct
    acc.obj_conv_tel_pct = obj.obj_conv_tel_pct || acc.obj_conv_tel_pct
    acc.obj_presence_pct = obj.obj_presence_pct || acc.obj_presence_pct
    acc.obj_efficacite_pct = obj.obj_efficacite_pct || acc.obj_efficacite_pct
    acc.obj_joignabilite_pct = obj.obj_joignabilite_pct || acc.obj_joignabilite_pct
    // Chiffres = somme des objectifs mensuels
    acc.obj_echanges_nb = (acc.obj_echanges_nb || 0) + (obj.obj_echanges_nb || 0)
    acc.obj_rdv_nb = (acc.obj_rdv_nb || 0) + (obj.obj_rdv_nb || 0)
    acc.obj_visites_nb = (acc.obj_visites_nb || 0) + (obj.obj_visites_nb || 0)
    acc.obj_ventes_nb = (acc.obj_ventes_nb || 0) + (obj.obj_ventes_nb || 0)
    return acc
  }, {
    obj_productivite_pct: 0, obj_conv_tel_pct: 0, obj_presence_pct: 0,
    obj_efficacite_pct: 0, obj_joignabilite_pct: 0,
    obj_echanges_nb: 0, obj_rdv_nb: 0, obj_visites_nb: 0, obj_ventes_nb: 0
  })

  // Pour les % : utiliser la moyenne si multi-mois
  if (data.length > 1) {
    cumul.obj_productivite_pct = data.reduce((a, o) => a + (o.obj_productivite_pct || 0), 0) / data.length
    cumul.obj_conv_tel_pct = data.reduce((a, o) => a + (o.obj_conv_tel_pct || 0), 0) / data.length
    cumul.obj_presence_pct = data.reduce((a, o) => a + (o.obj_presence_pct || 0), 0) / data.length
    cumul.obj_efficacite_pct = data.reduce((a, o) => a + (o.obj_efficacite_pct || 0), 0) / data.length
    cumul.obj_joignabilite_pct = data.reduce((a, o) => a + (o.obj_joignabilite_pct || 0), 0) / data.length
  }

  cache[cacheKey] = cumul
  return cumul
}

export function clearObjectifsCache() { cache = {} }

// Retourne la liste des mois (YYYY-MM) couverts par une selection
export function getMoisDePeriode(selected) {
  if (!selected || selected.type === 'global') return []
  const now = new Date()

  if (selected.type === 'day') {
    return [selected.value.substring(0, 7)]
  }
  if (selected.type === 'month') {
    return [selected.value]
  }
  if (selected.type === 'quarter') {
    const [year, q] = selected.value.split('-Q')
    const startMonth = (parseInt(q) - 1) * 3 + 1
    return [1, 2, 3].map(i => `${year}-${String(startMonth + i - 1).padStart(2, '0')}`)
  }
  if (selected.type === 'year') {
    return Array.from({ length: 12 }, (_, i) => `${selected.value}-${String(i + 1).padStart(2, '0')}`)
  }
  return []
}

// Calcule la couleur selon valeur vs objectif
export function getColorFromObjectif(valeur, objectifPct, objectifNb = null, valeurNb = null) {
  let ratio = null
  if (objectifPct && objectifPct > 0) {
    ratio = parseFloat(valeur) / objectifPct
  } else if (objectifNb && objectifNb > 0 && valeurNb !== null) {
    ratio = valeurNb / objectifNb
  }
  if (ratio === null) {
    if (!valeur || parseFloat(valeur) === 0) return '#2C2C2C'
    return '#C9A84C'
  }
  if (ratio < 1) return '#E05C5C'
  if (ratio < 1.1) return '#4CAF7D'
  if (ratio < 1.2) return '#2E9455'
  return '#1a6b3c'
}
