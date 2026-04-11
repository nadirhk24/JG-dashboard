export function calcProductivite(echanges, leadsNets) {
  if (!leadsNets || leadsNets === 0) return 0
  return parseFloat(((echanges / leadsNets) * 100).toFixed(1))
}

// CORRIGE : joignabilite = leads joints / leads bruts (pas indispos)
export function calcJoignabilite(indispos, leadsBruts) {
  if (!leadsBruts || leadsBruts === 0) return 0
  const joints = leadsBruts - indispos
  return parseFloat(((joints / leadsBruts) * 100).toFixed(1))
}

export function calcConversionTel(rdv, echanges) {
  if (!echanges || echanges === 0) return 0
  return parseFloat(((rdv / echanges) * 100).toFixed(1))
}

export function calcTauxPresence(visites, rdv) {
  if (!rdv || rdv === 0) return 0
  return parseFloat(((visites / rdv) * 100).toFixed(1))
}

export function calcEfficaciteComm(ventes, visites) {
  if (!visites || visites === 0) return 0
  return parseFloat(((ventes / visites) * 100).toFixed(1))
}

export function calcLeadsNets(leadsBruts, indispos) {
  return Math.max(0, (leadsBruts || 0) - (indispos || 0))
}

export function calcCV(valeurs) {
  const vals = valeurs.filter(v => v !== null && v !== undefined && !isNaN(v))
  if (vals.length < 2) return 0
  const moyenne = vals.reduce((a, b) => a + b, 0) / vals.length
  if (moyenne === 0) return 0
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - moyenne, 2), 0) / vals.length
  const ecartType = Math.sqrt(variance)
  return parseFloat(((ecartType / moyenne) * 100).toFixed(1))
}

export function moyenne(valeurs) {
  const vals = valeurs.filter(v => v !== null && v !== undefined && !isNaN(v))
  if (vals.length === 0) return 0
  return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
}

export function statutObjectif(valeur, objectif) {
  if (!objectif) return 'N/A'
  return valeur >= objectif ? 'Atteint' : 'En cours'
}

export function couleurPerf(valeur, objectif) {
  if (!objectif) return '#C9A84C'
  const ratio = valeur / objectif
  if (ratio >= 1) return '#4CAF7D'
  if (ratio >= 0.8) return '#C9A84C'
  return '#E05C5C'
}

export function agregerParPeriode(saisies, conseillereId = null) {
  let data = saisies
  if (conseillereId) {
    data = saisies.filter(s => s.conseillere_id === conseillereId)
  }

  const totaux = data.reduce((acc, s) => ({
    leads_bruts: acc.leads_bruts + (s.leads_bruts || 0),
    indispos: acc.indispos + (s.indispos || 0),
    echanges: acc.echanges + (s.echanges || 0),
    rdv: acc.rdv + (s.rdv || 0),
    visites: acc.visites + (s.visites || 0),
    ventes: acc.ventes + (s.ventes || 0),
  }), { leads_bruts: 0, indispos: 0, echanges: 0, rdv: 0, visites: 0, ventes: 0 })

  const leadsNets = calcLeadsNets(totaux.leads_bruts, totaux.indispos)

  return {
    ...totaux,
    leads_nets: leadsNets,
    productivite: calcProductivite(totaux.echanges, leadsNets),
    joignabilite: calcJoignabilite(totaux.indispos, totaux.leads_bruts),
    conversion_tel: calcConversionTel(totaux.rdv, totaux.echanges),
    taux_presence: calcTauxPresence(totaux.visites, totaux.rdv),
    efficacite_comm: calcEfficaciteComm(totaux.ventes, totaux.visites),
  }
}
