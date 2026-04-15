export function calcProductivite(echanges, leadsNets) {
  if (!leadsNets || leadsNets === 0) return 0
  return parseFloat(((echanges / leadsNets) * 100).toFixed(1))
}

export function calcJoignabilite(indispos, leadsBruts) {
  if (!leadsBruts || leadsBruts === 0) return 0
  const joints = leadsBruts - indispos
  return parseFloat(((joints / leadsBruts) * 100).toFixed(1))
}

export function calcConversionTel(rdv, echangesExploitables) {
  if (!echangesExploitables || echangesExploitables === 0) return 0
  return parseFloat(((rdv / echangesExploitables) * 100).toFixed(1))
}

export function calcTauxPresence(visites, rdv) {
  if (!rdv || rdv === 0) return 0
  return parseFloat(((visites / rdv) * 100).toFixed(1))
}

export function calcEfficaciteComm(ventes, visites) {
  if (!visites || visites === 0) return 0
  return parseFloat(((ventes / visites) * 100).toFixed(1))
}

export function calcLeadsNets(leadsBruts, nonExploitablesCC, indispos) {
  return Math.max(0, (leadsBruts || 0) - (nonExploitablesCC || 0) - (indispos || 0))
}

export function calcCV(valeurs) {
  const vals = valeurs.filter(v => v !== null && v !== undefined && !isNaN(v))
  if (vals.length < 2) return 0
  const moyenne = vals.reduce((a, b) => a + b, 0) / vals.length
  if (moyenne === 0) return 0
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - moyenne, 2), 0) / vals.length
  return parseFloat(((Math.sqrt(variance) / moyenne) * 100).toFixed(1))
}

export function couleurPerf(valeur, objectif) {
  if (!objectif) return '#C9A84C'
  const ratio = valeur / objectif
  if (ratio >= 1) return '#4CAF7D'
  if (ratio >= 0.8) return '#C9A84C'
  return '#E05C5C'
}

export function filtrerSaisiesParDate(saisies, dateDebut, dateFin) {
  return saisies.filter(s => {
    const sDebut = s.date_debut || s.date
    const sFin = s.date_fin || s.date
    return sDebut <= dateFin && sFin >= dateDebut
  })
}

export function agregerParPeriode(saisies, conseillereId = null) {
  let data = saisies
  if (conseillereId) {
    data = saisies.filter(s => s.conseillere_id === conseillereId)
  }

  const totaux = data.reduce((acc, s) => ({
    leads_bruts: acc.leads_bruts + (s.leads_bruts || 0),
    non_exploitables_cc: acc.non_exploitables_cc + (s.non_exploitables_cc || 0),
    indispos: acc.indispos + (s.indispos || 0),
    echanges: acc.echanges + (s.echanges || 0),
    echanges_exploitables: acc.echanges_exploitables + (s.echanges_exploitables || 0),
    rdv: acc.rdv + (s.rdv || 0),
    visites: acc.visites + (s.visites || 0),
    ventes: acc.ventes + (s.ventes || 0),
  }), { leads_bruts: 0, non_exploitables_cc: 0, indispos: 0, echanges: 0, echanges_exploitables: 0, rdv: 0, visites: 0, ventes: 0 })

  const leadsNets = calcLeadsNets(totaux.leads_bruts, totaux.non_exploitables_cc, totaux.indispos)
  // Utiliser echanges_exploitables si dispo, sinon fallback sur echanges - non_exploitables_cc
  const echangesExpl = totaux.echanges_exploitables > 0
    ? totaux.echanges_exploitables
    : Math.max(0, totaux.echanges - totaux.non_exploitables_cc)

  return {
    ...totaux,
    leads_nets: leadsNets,
    echanges_exploitables: echangesExpl,
    productivite: calcProductivite(totaux.echanges, leadsNets),
    joignabilite: calcJoignabilite(totaux.indispos, totaux.leads_bruts),
    conversion_tel: calcConversionTel(totaux.rdv, echangesExpl),
    taux_presence: calcTauxPresence(totaux.visites, totaux.rdv),
    efficacite_comm: calcEfficaciteComm(totaux.ventes, totaux.visites),
  }
}
