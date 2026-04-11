import { supabase } from './supabase'

// Cache des objectifs
let cache = {}

export async function getObjectifsCallCenter(mois) {
  const key = `cc_${mois}`
  if (cache[key]) return cache[key]
  const { data } = await supabase.from('objectifs_callcenter').select('*').eq('mois', mois + '-01').single()
  cache[key] = data || {}
  return cache[key]
}

export async function getObjectifsMarketing(mois) {
  const key = `mkt_${mois}`
  if (cache[key]) return cache[key]
  const { data } = await supabase.from('objectifs_marketing').select('*').eq('mois', mois + '-01').single()
  cache[key] = data || {}
  return cache[key]
}

export function clearCache() { cache = {} }

// Calcule la couleur selon valeur vs objectif
export function getColorFromObjectif(valeur, objectifPct, objectifNb = null, valeurNb = null) {
  let ratio = null

  // Priorité au % si défini
  if (objectifPct && objectifPct > 0) {
    ratio = valeur / objectifPct
  } else if (objectifNb && objectifNb > 0 && valeurNb !== null) {
    ratio = valeurNb / objectifNb
  }

  if (ratio === null) {
    // Pas d'objectif défini → couleur neutre
    if (valeur === 0) return '#2C2C2C'
    return '#C9A84C'
  }

  if (ratio < 1) return '#E05C5C'        // Rouge : en dessous
  if (ratio < 1.1) return '#4CAF7D'      // Vert clair : objectif atteint
  if (ratio < 1.2) return '#2E9455'      // Vert moyen : +10-20%
  return '#1a6b3c'                        // Vert foncé : +20% et plus
}
