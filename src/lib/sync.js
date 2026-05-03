import { supabase } from './supabase'

// ============================================================
// SYNC CENTRALISÉE - JG Dashboard
// ============================================================
// Règles métier:
//   type 'jour'           → visites_CC = visites + ventes (1 vente = 1 visite)
//   type 'periode'        → visites_CC = visites (inclut déjà les ventes)
//   type 'non_reconnue'   → visites_CC = visites (inclut déjà les ventes)
//   rdv_CC = rdv_bruts + visites_CC (1 visite = 1 rdv)
// ============================================================

// ────────────────────────────────────────────────────────────
// syncCC : Flux RDV → Call Center
// Recalcule rdv/visites/ventes dans saisies pour (conseillereId, date)
// ────────────────────────────────────────────────────────────
export async function syncCC(conseillereId, date) {
  // 1. Lire TOUTES les lignes flux_rdv pour cette conseillère et date
  const { data: allFlux } = await supabase
    .from('flux_rdv')
    .select('rdv, visites, ventes, type_saisie')
    .eq('conseillere_id', conseillereId)
    .eq('date_debut', date)

  const rows = allFlux || []

  // 2. Calculer les totaux selon la règle métier
  let totalVisites = 0
  let totalVentes = 0
  let totalRdvBruts = 0

  for (const r of rows) {
    const vis = parseFloat(r.visites || 0)
    const ven = parseFloat(r.ventes || 0)
    const rdv = parseFloat(r.rdv || 0)
    const isPeriode = r.type_saisie === 'periode' || r.type_saisie === 'non_reconnue'

    // Période/non_reconnue : visites incluent déjà les ventes
    // Jour : visites + ventes (1 vente = 1 visite)
    totalVisites += isPeriode ? vis : vis + ven
    totalVentes += ven
    totalRdvBruts += rdv
  }

  // rdv_total = rdv_bruts + visites (1 visite = 1 rdv)
  const totalRdv = Math.round(totalRdvBruts + totalVisites)
  totalVisites = Math.round(totalVisites)
  totalVentes = Math.round(totalVentes)

  // 3. Mettre à jour ou créer la ligne dans saisies
  const { data: saisie } = await supabase
    .from('saisies')
    .select('id')
    .eq('conseillere_id', conseillereId)
    .eq('date_debut', date)
    .maybeSingle()

  if (saisie) {
    await supabase
      .from('saisies')
      .update({ rdv: totalRdv, visites: totalVisites, ventes: totalVentes })
      .eq('id', saisie.id)
  } else {
    await supabase
      .from('saisies')
      .insert({
        conseillere_id: conseillereId,
        date,
        date_debut: date,
        date_fin: date,
        type_saisie: 'jour',
        leads_bruts: 0,
        indispos: 0,
        echanges: 0,
        rdv: totalRdv,
        visites: totalVisites,
        ventes: totalVentes,
      })
  }
}

// ────────────────────────────────────────────────────────────
// syncMarketing : Call Center → Marketing
// Recalcule injections/indispos dans marketing_saisies pour une date
// SYNC: leads_bruts → injections | indispos → indispos
// PAS de sync des échanges (volontaire)
// ────────────────────────────────────────────────────────────
export async function syncMarketing(date) {
  // 1. Lire toutes les saisies CC du jour (toutes conseillères)
  const { data: allSaisies } = await supabase
    .from('saisies')
    .select('leads_bruts, indispos')
    .eq('date_debut', date)

  const rows = allSaisies || []

  // 2. Calculer les totaux
  const totalLeads = Math.round(
    rows.reduce((s, x) => s + parseFloat(x.leads_bruts || 0), 0)
  )
  const totalIndispos = Math.round(
    rows.reduce((s, x) => s + parseFloat(x.indispos || 0), 0)
  )

  // 3. Mettre à jour ou créer la ligne dans marketing_saisies
  const { data: mktLine } = await supabase
    .from('marketing_saisies')
    .select('id')
    .eq('date_debut', date)
    .maybeSingle()

  if (mktLine) {
    await supabase
      .from('marketing_saisies')
      .update({ injections: totalLeads, indispos: totalIndispos })
      .eq('id', mktLine.id)
  } else {
    await supabase
      .from('marketing_saisies')
      .insert({
        date,
        date_debut: date,
        date_fin: date,
        type_saisie: 'jour',
        injections: totalLeads,
        indispos: totalIndispos,
        non_exploitables: 0,
        suivis: 0,
        rdv: 0,
        visites: 0,
        ventes: 0,
      })
  }
}

// ────────────────────────────────────────────────────────────
// syncAll : Tout synchroniser pour (conseillereId, date)
// Appeler cette fonction après TOUTE modification de flux_rdv ou saisies
// ────────────────────────────────────────────────────────────
export async function syncAll(conseillereId, date) {
  await syncCC(conseillereId, date)
  await syncMarketing(date)
}
