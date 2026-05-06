import { supabase } from './supabase'

// Cache objectifs
let cache = {}

// Charge les objectifs pour une liste de mois
// Option A : objectifs équipe (conseillere_id IS NULL)
// Fallback  : si objectif équipe = 0 → somme des objectifs individuels
export async function getObjectifsPourPeriode(selected) {
  if (!selected || selected.type === 'global') return {}

  const mois = getMoisDePeriode(selected)
  if (mois.length === 0) return {}

  const cacheKey = mois.join(',')
  if (cache[cacheKey]) return cache[cacheKey]

  const moisSql = mois.map(m => m + '-01')

  // 1. Charger objectifs équipe (sans conseillere_id)
  const { data: equipeData } = await supabase
    .from('objectifs_callcenter')
    .select('*')
    .is('conseillere_id', null)
    .in('mois', moisSql)

  // Agréger les objectifs équipe
  function agregerObjectifs(data) {
    if (!data || data.length === 0) return null
    const cumul = data.reduce((acc, obj) => {
      acc.obj_productivite_pct = obj.obj_productivite_pct || acc.obj_productivite_pct
      acc.obj_conv_tel_pct     = obj.obj_conv_tel_pct     || acc.obj_conv_tel_pct
      acc.obj_presence_pct     = obj.obj_presence_pct     || acc.obj_presence_pct
      acc.obj_efficacite_pct   = obj.obj_efficacite_pct   || acc.obj_efficacite_pct
      acc.obj_joignabilite_pct = obj.obj_joignabilite_pct || acc.obj_joignabilite_pct
      acc.obj_echanges_nb  = (acc.obj_echanges_nb  || 0) + (obj.obj_echanges_nb  || 0)
      acc.obj_rdv_nb       = (acc.obj_rdv_nb       || 0) + (obj.obj_rdv_nb       || 0)
      acc.obj_visites_nb   = (acc.obj_visites_nb   || 0) + (obj.obj_visites_nb   || 0)
      acc.obj_ventes_nb    = (acc.obj_ventes_nb    || 0) + (obj.obj_ventes_nb    || 0)
      return acc
    }, { obj_productivite_pct: 0, obj_conv_tel_pct: 0, obj_presence_pct: 0,
         obj_efficacite_pct: 0, obj_joignabilite_pct: 0,
         obj_echanges_nb: 0, obj_rdv_nb: 0, obj_visites_nb: 0, obj_ventes_nb: 0 })
    // Moyenne des % si multi-mois
    if (data.length > 1) {
      cumul.obj_productivite_pct = data.reduce((a,o) => a+(o.obj_productivite_pct||0),0)/data.length
      cumul.obj_conv_tel_pct     = data.reduce((a,o) => a+(o.obj_conv_tel_pct||0),0)/data.length
      cumul.obj_presence_pct     = data.reduce((a,o) => a+(o.obj_presence_pct||0),0)/data.length
      cumul.obj_efficacite_pct   = data.reduce((a,o) => a+(o.obj_efficacite_pct||0),0)/data.length
      cumul.obj_joignabilite_pct = data.reduce((a,o) => a+(o.obj_joignabilite_pct||0),0)/data.length
    }
    return cumul
  }

  const equipe = agregerObjectifs(equipeData)

  // 2. Si objectif équipe défini et non nul → l'utiliser
  if (equipe && equipe.obj_echanges_nb > 0) {
    cache[cacheKey] = equipe
    return equipe
  }

  // 3. FALLBACK : objectif équipe = 0 → somme des objectifs individuels
  const { data: indivData } = await supabase
    .from('objectifs_callcenter')
    .select('*')
    .not('conseillere_id', 'is', null)
    .in('mois', moisSql)

  const indiv = agregerObjectifs(indivData)

  if (indiv && indiv.obj_echanges_nb > 0) {
    // Conserver les % de l'objectif équipe si définis, sinon ceux des individuels
    const result = {
      ...indiv,
      obj_productivite_pct: equipe?.obj_productivite_pct || indiv.obj_productivite_pct,
      obj_conv_tel_pct:     equipe?.obj_conv_tel_pct     || indiv.obj_conv_tel_pct,
      obj_presence_pct:     equipe?.obj_presence_pct     || indiv.obj_presence_pct,
      obj_efficacite_pct:   equipe?.obj_efficacite_pct   || indiv.obj_efficacite_pct,
      obj_joignabilite_pct: equipe?.obj_joignabilite_pct || indiv.obj_joignabilite_pct,
      _fallback: true // Indicateur pour l'UI
    }
    cache[cacheKey] = result
    return result
  }

  cache[cacheKey] = {}
  return {}
}

// Charge les objectifs individuels d'une conseillère pour une période
export async function getObjectifsConseillere(conseillereId, selected) {
  if (!selected || !conseillereId) return {}
  const mois = getMoisDePeriode(selected)
  if (mois.length === 0) return {}

  const { data } = await supabase
    .from('objectifs_callcenter')
    .select('*')
    .eq('conseillere_id', conseillereId)
    .in('mois', mois.map(m => m + '-01'))

  if (!data || data.length === 0) return {}

  return data.reduce((acc, obj) => {
    acc.obj_echanges_nb  = (acc.obj_echanges_nb  || 0) + (obj.obj_echanges_nb  || 0)
    acc.obj_rdv_nb       = (acc.obj_rdv_nb       || 0) + (obj.obj_rdv_nb       || 0)
    acc.obj_visites_nb   = (acc.obj_visites_nb   || 0) + (obj.obj_visites_nb   || 0)
    acc.obj_ventes_nb    = (acc.obj_ventes_nb    || 0) + (obj.obj_ventes_nb    || 0)
    acc.obj_productivite_pct = obj.obj_productivite_pct || acc.obj_productivite_pct || 0
    acc.obj_conv_tel_pct     = obj.obj_conv_tel_pct     || acc.obj_conv_tel_pct     || 0
    acc.obj_presence_pct     = obj.obj_presence_pct     || acc.obj_presence_pct     || 0
    acc.obj_efficacite_pct   = obj.obj_efficacite_pct   || acc.obj_efficacite_pct   || 0
    return acc
  }, {})
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
  // Nouvelle logique de couleur par palier
  if (ratio < 0.50) return '#9B1C1C'      // < 50%  → rouge foncé
  if (ratio < 0.65) return '#E05C5C'      // 50-65% → rouge clair
  if (ratio < 0.80) return '#E07B30'      // 65-80% → orange
  if (ratio < 0.95) return '#86EFAC'      // 80-95% → vert très clair
  if (ratio < 1.00) return '#4CAF7D'      // 95-100%→ vert clair
  return '#2E9455'                         // ≥ 100% → vert foncé
}
