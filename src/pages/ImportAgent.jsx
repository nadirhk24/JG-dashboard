import React, { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import * as XLSX from 'xlsx'

// ─── Mapping dynamique — chargé depuis Supabase (odoo_mapping) ────────────
// Fallback statique au cas où la table n'est pas encore créée
const FALLBACK_MAP = {
  'IBNTABET SIHAM':       '05846018-a68b-4415-a429-3afafdb2b6b8',
  'SIHAM IBNTABET':       '05846018-a68b-4415-a429-3afafdb2b6b8',
  'KAOUTAR HRARTI':       '129090e2-d446-4424-934a-2f39d73a5954',
  'GHIZLANE ELBAKARI':    '1b7086c6-922a-42b2-95e8-f10cac431ba6',
  'FATIMA ZAHRAA':        '6adfe150-0752-4f5e-90ea-28d25d769b49',
  'FATIMA ZAHRAA AAKIBA': '6adfe150-0752-4f5e-90ea-28d25d769b49',
  'Hala ELAOUAD':         'cfb8af80-d40b-46dc-9519-78ba7567cda8',
  'HALA ELAOUAD':         'cfb8af80-d40b-46dc-9519-78ba7567cda8',
  'Rajaa ELKHANCHAR':     'dc5100ac-b5ad-4705-b3e6-45fb04d1ff64',
  'RAJAA ELKHANCHAR':     'dc5100ac-b5ad-4705-b3e6-45fb04d1ff64',
}
let CONSEILLERE_MAP = { ...FALLBACK_MAP }

let COMMERCIAL_MAP = {} // chargé dynamiquement depuis odoo_mapping

const NON_RECONNU_IDS = {
  sale:    '1b9201a1-9333-4725-8e38-e9297777745b',
  kenitra: 'e87e531e-820e-4f39-8fd7-5fa00cf0671e',
}

// Noms conseillères à ignorer dans les participants du calendrier
const CONSEILLERES_NOMS = [
  'IBNTABET SIHAM','SIHAM IBNTABET','KAOUTAR HRARTI','GHIZLANE ELBAKARI',
  'FATIMA ZAHRAA','FATIMA ZAHRAA AAKIBA','Hala ELAOUAD','HALA ELAOUAD',
  'Rajaa ELKHANCHAR','RAJAA ELKHANCHAR','NADIR HADRAK','N.HADRAK',
]

// ─── Détection du type de fichier depuis son nom ───────────────────────────
function detectFileType(filename) {
  const n = filename.toLowerCase().replace(/[_\-]/g, ' ')
  if (n.includes('injection') || n.includes('lead'))             return { type: 'injections',     label: 'Injections / Leads bruts', dest: 'CC + Marketing', color: '#C9A84C' }
  if (n.includes('indispo'))                                      return { type: 'indispos',        label: 'Indisponibles',            dest: 'CC + Marketing', color: '#E07B30' }
  if (n.includes('non expl') && n.includes('cc'))                return { type: 'non_expl_cc',     label: 'Non exploitables CC',      dest: 'CC',             color: '#E05C5C' }
  if (n.includes('non expl') && n.includes('market'))            return { type: 'non_expl_mkt',    label: 'Non exploitables Marketing',dest: 'Marketing',     color: '#534AB7' }
  if (n.includes('non expl'))                                    return { type: 'non_expl_cc',     label: 'Non exploitables CC',      dest: 'CC',             color: '#E05C5C' }
  if (n.includes('echange') || n.includes('échange'))            return { type: 'echanges',        label: 'Échanges bruts',           dest: 'CC',             color: '#378ADD' }
  if (n.includes('vente') && n.includes('cc'))                   return { type: 'ventes_cc',       label: 'Ventes CC',                dest: 'CC + Flux RDV',  color: '#1a6b3c', hasCommercial: true }
  if (n.includes('visite') && n.includes('cc'))                  return { type: 'visites_cc',      label: 'Visites CC',               dest: 'CC + Flux RDV',  color: '#2E9455', hasCommercial: true }
  if (n.includes('suivi'))                                       return { type: 'suivis_mkt',      label: 'Suivis Marketing',         dest: 'Marketing',      color: '#534AB7' }
  if (n.includes('rdv') && n.includes('market'))                 return { type: 'rdv_mkt',         label: 'RDV Marketing',            dest: 'Marketing',      color: '#C9A84C' }
  if (n.includes('vente') && n.includes('market'))               return { type: 'ventes_mkt',      label: 'Ventes Marketing',         dest: 'Marketing',      color: '#1a6b3c' }
  if (n.includes('visite') && n.includes('market'))              return { type: 'visites_mkt',     label: 'Visites Marketing',        dest: 'Marketing',      color: '#2E9455' }
  if (n.includes('rdv') || n.includes('calendrier'))             return { type: 'rdv_calendrier',  label: 'RDV Calendrier',           dest: 'Flux RDV',       color: '#534AB7' }
  return null
}

// Détection mode cohort depuis le nom
function detectMode(filename) {
  const n = filename.toLowerCase()
  const typeInfo = detectFileType(filename)
  const type = typeInfo?.type || ''

  // CC (y compris visites/ventes CC) → toujours jour par jour
  const isCC = ['injections','indispos','non_expl_cc','echanges','visites_cc','ventes_cc'].includes(type)
  if (isCC) return { mode: 'jour', label: 'Jour par jour' }

  // Marketing → toujours cohort mensuel, mois détecté depuis le nom
  const isMkt = ['non_expl_mkt','suivis_mkt','rdv_mkt','ventes_mkt','visites_mkt'].includes(type)
  if (isMkt) {
    const months = { 'janvier':1,'février':2,'fevrier':2,'mars':3,'avril':4,'mai':5,'juin':6,
                     'juillet':7,'août':8,'aout':8,'septembre':9,'octobre':10,'novembre':11,'décembre':12,'decembre':12 }
    for (const [m, num] of Object.entries(months)) {
      if (n.includes(m)) {
        const yearMatch = n.match(/20\d\d/)
        const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear()
        return { mode: 'cohort', month: num, year, label: `${m.charAt(0).toUpperCase()+m.slice(1)} ${year}` }
      }
    }
    // Pas de mois trouvé → mois courant par défaut
    const now = new Date()
    return { mode: 'cohort', month: now.getMonth()+1, year: now.getFullYear(), label: 'Mois courant' }
  }

  return { mode: 'jour', label: 'Jour par jour' }
}

// ─── Parsers ───────────────────────────────────────────────────────────────
function parseWithDatetime(rows) {
  // Format: col0=datetime, col1=vendeur — injections / indispos / non_expl_mkt
  const counts = {}
  for (const row of rows) {
    const dateVal = row[0], vendeur = row[1]
    if (!vendeur || typeof vendeur !== 'string') continue
    const nom = vendeur.trim().toUpperCase()
    // Ignorer les lignes de sous-total (contiennent "(")
    if (nom.includes('(')) continue
    let dateStr = null
    if (dateVal instanceof Date) {
      dateStr = dateVal.toISOString().split('T')[0]
    } else if (typeof dateVal === 'number') {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(dateVal)
      if (d) dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
    }
    if (!dateStr) continue
    const key = `${dateStr}|||${vendeur.trim()}`
    counts[key] = (counts[key] || 0) + 1
  }
  return Object.entries(counts).map(([key, count]) => {
    const [date, nom] = key.split('|||')
    return { date, nom, count }
  })
}

function parseWithTextDate(rows) {
  // Format: col0=date texte ou commercial, col1=conseillère (optionnel)
  // Gère 1 colonne (non_expl_cc, échanges) et 2 colonnes (ventes CC, visites CC)
  const MONTHS = { 'janv':1,'févr':2,'fevr':2,'mars':3,'avr':4,'mai':5,'juin':6,
                   'juil':7,'août':8,'aout':8,'sept':9,'oct':10,'nov':11,'déc':12,'dec':12 }
  const results = []
  let currentDate = null

  for (const row of rows) {
    const val0 = row[0]
    const val1 = row[1] // conseillère si 2 colonnes, null sinon
    if (val0 === null || val0 === undefined) continue
    const str0 = String(val0).trim()
    if (!str0) continue

    // Ligne de date groupe: "04 avr. 2026 (16)"
    const dateMatch = str0.match(/^(\d+)\s+(\w+)\.?\s+(\d{4})/)
    if (dateMatch && str0.includes('(')) {
      const day = parseInt(dateMatch[1])
      const monthKey = dateMatch[2].toLowerCase().replace('.','')
      const month = MONTHS[monthKey]
      const year = parseInt(dateMatch[3])
      if (month) currentDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      continue
    }
    // Ligne sous-groupe conseillère: "    Hala ELAOUAD (9)"
    if (str0.startsWith('    ') && str0.includes('(')) continue

    // Ligne individuelle
    if (currentDate && !str0.includes('(')) {
      // Si col1 existe → c'est le nom de la conseillère (format 2 colonnes : ventes/visites CC)
      // Si col1 null → col0 est le nom de la conseillère (format 1 colonne)
      const nomConseillere = (val1 && String(val1).trim()) ? String(val1).trim() : str0
      results.push({ date: currentDate, nom: nomConseillere, count: 1 })
    }
  }
  // Agréger
  const agg = {}
  for (const r of results) {
    const key = `${r.date}|||${r.nom}`
    agg[key] = (agg[key] || 0) + r.count
  }
  return Object.entries(agg).map(([key, count]) => {
    const [date, nom] = key.split('|||')
    return { date, nom, count }
  })
}

function parseVisitesVentesCC(rows) {
  // Format: col0=commercial concerné, col1=conseillère
  // Retourne: { normal: [{date, nomConseillere, nomCommercial, count}], nonReconnus: [{date, nomConseillere, count}] }
  const MONTHS = { 'janv':1,'févr':2,'fevr':2,'mars':3,'avr':4,'mai':5,'juin':6,
                   'juil':7,'août':8,'aout':8,'sept':9,'oct':10,'nov':11,'déc':12,'dec':12 }
  const normal = []
  const nonReconnus = []
  let currentDate = null

  for (const row of rows) {
    const val0 = row[0]
    const val1 = row[1]
    if (val0 === null && val1 === null) continue
    const str0 = val0 !== null && val0 !== undefined ? String(val0).trim() : ''
    const str1 = val1 !== null && val1 !== undefined ? String(val1).trim() : ''

    // Ligne date groupe: "18 avr. 2026 (6)"
    const dateMatch = str0.match(/^(\d+)\s+(\w+)\.?\s+(\d{4})/)
    if (dateMatch && str0.includes('(')) {
      const day = parseInt(dateMatch[1])
      const monthKey = dateMatch[2].toLowerCase().replace('.','')
      const month = MONTHS[monthKey]
      const year = parseInt(dateMatch[3])
      if (month) currentDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      continue
    }
    // Ligne sous-groupe conseillère: "    Hala ELAOUAD (9)"
    if (str0.startsWith('    ') && str0.includes('(')) continue
    if (!currentDate) continue

    // Ligne individuelle
    if (str1) {
      const nomConseillere = str1
      if (!str0) {
        // Commercial null → non reconnu
        nonReconnus.push({ date: currentDate, nomConseillere, count: 1 })
      } else {
        // Commercial identifié
        normal.push({ date: currentDate, nomConseillere, nomCommercial: str0, count: 1 })
      }
    }
  }

  // Agréger normal
  const aggNormal = {}
  for (const r of normal) {
    const key = `${r.date}|||${r.nomConseillere}|||${r.nomCommercial}`
    aggNormal[key] = (aggNormal[key] || 0) + r.count
  }
  const normalAgg = Object.entries(aggNormal).map(([key, count]) => {
    const [date, nomConseillere, nomCommercial] = key.split('|||')
    return { date, nomConseillere, nomCommercial, count }
  })

  // Agréger non reconnus
  const aggNR = {}
  for (const r of nonReconnus) {
    const key = `${r.date}|||${r.nomConseillere}`
    aggNR[key] = (aggNR[key] || 0) + r.count
  }
  const nonRecAgg = Object.entries(aggNR).map(([key, count]) => {
    const [date, nomConseillere] = key.split('|||')
    return { date, nomConseillere, count }
  })

  return { normal: normalAgg, nonReconnus: nonRecAgg }
}

function parseCohort(rows, month, year) {
  // Mode cohort: 1 seule valeur globale pour le mois
  let total = 0
  for (const row of rows) {
    const val = row[0]
    if (val === null || val === undefined) continue
    const str = String(val).trim()
    if (!str || str.includes('(') || !str || str === 'Vendeur' || str === 'Créé le') continue
    // Ligne individuelle
    if (row[1] !== null || (row[1] === null && str && !str.startsWith('    '))) {
      total++
    }
  }
  const dateStr = `${year}-${String(month).padStart(2,'0')}-01`
  return [{ date: dateStr, nom: 'GLOBAL', count: total, isCohort: true }]
}

// ─── Résolution ID conseillère ─────────────────────────────────────────────
function resolveConseillere(nom) {
  if (!nom || typeof nom !== 'string') return null
  const key = nom.trim().toUpperCase()
  return CONSEILLERE_MAP[key] || CONSEILLERE_MAP[nom.trim()] || null
}

// ─── Injection Supabase ────────────────────────────────────────────────────
async function injectData(parsed, fileType, modeInfo, dryRun = false, importId = null, fileName = '') {
  const results = { inserted: 0, updated: 0, errors: [], preview: [] }
  const { type } = fileType
  const { mode, month, year } = modeInfo

  const fieldMap = {
    injections:    'leads_bruts',
    indispos:      'indispos',
    non_expl_cc:   'non_exploitables_cc',
    echanges:      'echanges',
    ventes_cc:     'ventes',
    visites_cc:    'visites',
    non_expl_mkt:  'non_exploitables',
    suivis_mkt:    'suivis',
    rdv_mkt:       'rdv',
    ventes_mkt:    'ventes',
    visites_mkt:   'visites',
  }

  const isCC   = ['injections','indispos','non_expl_cc','echanges'].includes(type)
  const isMkt  = ['non_expl_mkt','suivis_mkt','rdv_mkt','ventes_mkt','visites_mkt'].includes(type)
  const isBoth = ['injections','indispos'].includes(type)
  const field  = fieldMap[type]

  for (const row of parsed) {
    try {

      // ── Cohort marketing ────────────────────────────────────────────────
      if (row.isCohort) {
        const dateDebut = `${year}-${String(month).padStart(2,'0')}-01`
        if (dryRun) {
          results.preview.push({ date: dateDebut, conseillere: 'GLOBAL', field, value: row.count, table: 'marketing_saisies', action: 'cohort' })
          results.inserted++
        } else {
          const { data: existing } = await supabase.from('marketing_saisies')
            .select('id,' + field).eq('date_debut', dateDebut).maybeSingle()
          if (importId) await supabase.from('import_historique').insert({ import_id: importId, fichier: fileName, type, table_cible: 'marketing_saisies', row_id: existing?.id || null, champ: field, valeur_avant: existing?.[field] ?? null, valeur_apres: row.count })
          if (existing) {
            await supabase.from('marketing_saisies').update({ [field]: row.count }).eq('id', existing.id)
            results.updated++
          } else {
            await supabase.from('marketing_saisies').insert({ date: dateDebut, date_debut: dateDebut, date_fin: dateDebut, type_saisie: 'mois', [field]: row.count })
            results.inserted++
          }
        }
        continue
      }

      // ── CC standard (injections, indispos, non_expl_cc, echanges) ───────
      if (isCC || isBoth) {
        const consId = resolveConseillere(row.nom)
        if (!consId) { results.errors.push(`Nom non reconnu: ${row.nom}`); continue }
        if (dryRun) {
          results.preview.push({ date: row.date, conseillere: row.nom, field, value: row.count, table: 'saisies', action: 'upsert' })
          results.inserted++
        } else {
          const { data: existing } = await supabase.from('saisies')
            .select('id,' + field).eq('conseillere_id', consId).eq('date', row.date).maybeSingle()
          if (importId) await supabase.from('import_historique').insert({ import_id: importId, fichier: fileName, type, table_cible: 'saisies', row_id: existing?.id || null, champ: field, valeur_avant: existing?.[field] ?? null, valeur_apres: row.count })
          if (existing) {
            await supabase.from('saisies').update({ [field]: row.count }).eq('id', existing.id)
            results.updated++
          } else {
            await supabase.from('saisies').insert({ conseillere_id: consId, date: row.date, date_debut: row.date, date_fin: row.date, type_saisie: 'jour', [field]: row.count })
            results.inserted++
          }
        }
      }

      // ── Sync CC → Marketing pour injections et indispos ─────────────────
      if (isBoth && !dryRun) {
        const { data: saisiesJour } = await supabase.from('saisies').select('leads_bruts, indispos').eq('date', row.date)
        const totalLeads = (saisiesJour || []).reduce((s,x) => s + (x.leads_bruts||0), 0)
        const totalIndispos = (saisiesJour || []).reduce((s,x) => s + (x.indispos||0), 0)
        const { data: mktLine } = await supabase.from('marketing_saisies').select('id').eq('date_debut', row.date).maybeSingle()
        if (mktLine) {
          await supabase.from('marketing_saisies').update({ injections: totalLeads, indispos: totalIndispos }).eq('id', mktLine.id)
        } else {
          await supabase.from('marketing_saisies').insert({ date: row.date, date_debut: row.date, date_fin: row.date, type_saisie: 'jour', injections: totalLeads, indispos: totalIndispos, non_exploitables: 0, suivis: 0, rdv: 0, visites: 0, ventes: 0 })
        }
      }

      // ── Visites / Ventes CC → flux_rdv ───────────────────────────────────
      if (['visites_cc','ventes_cc'].includes(type)) {
        const nomCons = row.nomConseillere || row.nom
        if (!nomCons) { results.errors.push(`Ligne sans conseillère: ${row.date}`); continue }
        if (!row.nomCommercial) continue
        const consId = resolveConseillere(nomCons)
        if (!consId) { results.errors.push(`Conseillère non reconnue: ${nomCons}`); continue }
        const fluxField = type === 'visites_cc' ? 'visites' : 'ventes'
        if (dryRun) {
          results.preview.push({ date: row.date, conseillere: `${nomCons} / ${row.nomCommercial}`, field: fluxField, value: row.count, table: 'flux_rdv', action: 'upsert' })
          results.inserted++
        } else {
          let commId = COMMERCIAL_MAP[row.nomCommercial?.trim().toUpperCase()] || COMMERCIAL_MAP[row.nomCommercial?.trim()]
          if (!commId) {
            const { data: comm } = await supabase.from('commerciaux').select('id').ilike('nom', `%${row.nomCommercial}%`).maybeSingle()
            commId = comm?.id
          }
          if (!commId) { results.errors.push(`COMM_NON_RECONNU:${row.nomCommercial}`); continue }
          const { data: ex } = await supabase.from('flux_rdv').select(`id,${fluxField}`).eq('conseillere_id', consId).eq('commercial_id', commId).eq('date_debut', row.date).maybeSingle()
          if (importId) await supabase.from('import_historique').insert({ import_id: importId, fichier: fileName, type, table_cible: 'flux_rdv', row_id: ex?.id || null, champ: fluxField, valeur_avant: ex?.[fluxField] ?? null, valeur_apres: row.count })
          if (ex) {
            await supabase.from('flux_rdv').update({ [fluxField]: (ex[fluxField] || 0) + row.count }).eq('id', ex.id)
            results.updated++
          } else {
            await supabase.from('flux_rdv').insert({ conseillere_id: consId, commercial_id: commId, date_debut: row.date, date_fin: row.date, type_saisie: 'jour', rdv: 0, visites: type === 'visites_cc' ? row.count : 0, ventes: type === 'ventes_cc' ? row.count : 0 })
            results.inserted++
          }
        }
        continue
      }

      // ── Marketing standard ───────────────────────────────────────────────
      if (isMkt) {
        const { data: existing } = await supabase.from('marketing_saisies').select('id,' + field).eq('date_debut', row.date).maybeSingle()
        if (dryRun) {
          results.preview.push({ date: row.date, conseillere: 'Marketing', field, value: row.count, table: 'marketing_saisies', action: 'upsert' })
          results.inserted++
        } else {
          if (importId) await supabase.from('import_historique').insert({ import_id: importId, fichier: fileName, type, table_cible: 'marketing_saisies', row_id: existing?.id || null, champ: field, valeur_avant: existing?.[field] ?? null, valeur_apres: row.count })
          if (existing) {
            await supabase.from('marketing_saisies').update({ [field]: row.count }).eq('id', existing.id)
            results.updated++
          } else {
            await supabase.from('marketing_saisies').insert({ date: row.date, date_debut: row.date, date_fin: row.date, type_saisie: 'jour', [field]: row.count, injections: 0, non_exploitables: 0, indispos: 0, suivis: 0, rdv: 0, visites: 0, ventes: 0 })
            results.inserted++
          }
        }
      }

    } catch(e) {
      results.errors.push(`Erreur ${row.date} ${row.nom || row.nomConseillere || ''}: ${e.message}`)
    }
  }
  return results
}

// ─── Composant FileSlot ────────────────────────────────────────────────────
function FileSlot({ index, fileInfo, onFile, onRemove }) {
  const inputRef = useRef()
  const [drag, setDrag] = useState(false)

  function handleDrop(e) {
    e.preventDefault(); setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(index, file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !fileInfo && inputRef.current.click()}
      style={{
        borderRadius: 12, border: `2px dashed ${drag ? '#C9A84C' : fileInfo ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.2)'}`,
        background: drag ? 'rgba(201,168,76,0.05)' : fileInfo ? 'rgba(201,168,76,0.04)' : '#FAFAF8',
        padding: '18px 20px', cursor: fileInfo ? 'default' : 'pointer',
        transition: 'all 0.15s', minHeight: 80, display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
        onChange={e => e.target.files[0] && onFile(index, e.target.files[0])} />

      {!fileInfo ? (
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>📂</div>
          <div style={{ fontSize: 12, color: '#8A8A7A' }}>Glisser un fichier ou cliquer</div>
          <div style={{ fontSize: 11, color: '#ABABAB', marginTop: 2 }}>.xlsx · .xls · .csv</div>
        </div>
      ) : (
        <>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: fileInfo.typeInfo?.color+'20' || 'rgba(201,168,76,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>📄</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileInfo.file.name}</div>
            {fileInfo.typeInfo ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: fileInfo.typeInfo.color+'20', color: fileInfo.typeInfo.color, fontWeight: 500 }}>{fileInfo.typeInfo.label}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(83,74,183,0.1)', color: '#534AB7' }}>→ {fileInfo.typeInfo.dest}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(138,138,122,0.1)', color: '#5A5A5A' }}>{fileInfo.modeInfo?.label}</span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#E05C5C', marginTop: 4 }}>⚠ Type non reconnu — vérifier le nom du fichier</div>
            )}
          </div>
          <button onClick={e => { e.stopPropagation(); onRemove(index) }}
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid rgba(224,92,92,0.3)', background: 'transparent', color: '#E05C5C', fontSize: 14, cursor: 'pointer', flexShrink: 0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>
        </>
      )}
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────
const NB_SLOTS = 6

export default function ImportAgent() {
  const [mappingLoaded, setMappingLoaded] = useState(false)
  const [conseilleresList, setConseilleresList] = useState([])
  const [commerciauxList, setCommerciauxList] = useState([])
  const [unmappedCommerciaux, setUnmappedCommerciaux] = useState([])
  const [pendingCommerciauxMapping, setPendingCommerciauxMapping] = useState({})
  const [showCommerciauxModal, setShowCommerciauxModal] = useState(false)
  const [historique, setHistorique] = useState([])
  const [showHistorique, setShowHistorique] = useState(false)
  const [annulationEnCours, setAnnulationEnCours] = useState(null)
  const [unmappedNoms, setUnmappedNoms] = useState([]) // noms Odoo non reconnus
  const [pendingMapping, setPendingMapping] = useState({}) // { nomOdoo: conseillereId }
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [slots, setSlots] = useState(Array(NB_SLOTS).fill(null))
  const [previews, setPreviews] = useState({})
  const [status, setStatus] = useState({}) // { slotIdx: { state: 'idle'|'parsing'|'preview'|'injecting'|'done'|'error', result, parsed } }
  const [globalMsg, setGlobalMsg] = useState(null)
  const [running, setRunning] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [dryRunResults, setDryRunResults] = useState([])

  // Charger le mapping Odoo depuis Supabase au démarrage
  React.useEffect(() => {
    async function loadMapping() {
      try {
        const { data } = await supabase.from('odoo_mapping').select('nom_odoo, conseillere_id')
        if (data && data.length > 0) {
          const map = {}
          data.forEach(r => { map[r.nom_odoo] = r.conseillere_id })
          CONSEILLERE_MAP = { ...FALLBACK_MAP, ...map }
        }
      } catch(e) { console.warn('odoo_mapping non disponible, fallback utilisé') }
      // Charger liste conseillères + commerciaux pour les sélecteurs
      const { data: cons } = await supabase.from('conseilleres').select('id, nom').order('nom')
      setConseilleresList(cons || [])
      const { data: comms } = await supabase.from('commerciaux').select('id, nom, equipe').eq('actif', true).order('nom')
      setCommerciauxList(comms || [])
      // Charger mapping commerciaux depuis Supabase
      try {
        const { data: mappingComm } = await supabase.from('odoo_mapping').select('nom_odoo, conseillere_id').eq('type', 'commercial')
        if (mappingComm) mappingComm.forEach(r => { COMMERCIAL_MAP[r.nom_odoo] = r.conseillere_id })
      } catch(e) {}
      setMappingLoaded(true)
      // Charger historique des imports
      const { data: hist } = await supabase.from('import_historique')
        .select('import_id, fichier, type, date_import')
        .order('date_import', { ascending: false })
        .limit(100)
      if (hist) {
        // Grouper par import_id
        const grouped = {}
        hist.forEach(r => {
          if (!grouped[r.import_id]) grouped[r.import_id] = { import_id: r.import_id, fichier: r.fichier, type: r.type, date_import: r.date_import, count: 0 }
          grouped[r.import_id].count++
        })
        setHistorique(Object.values(grouped).sort((a,b) => new Date(b.date_import) - new Date(a.date_import)))
      }
    }
    loadMapping()
  }, [])
  const [nonReconnus, setNonReconnus] = useState([]) // lignes sans commercial
  const [nonRecEquipes, setNonRecEquipes] = useState({}) // { 'date|||cons': 'sale'|'kenitra' }
  const [showNonRec, setShowNonRec] = useState(false)

  function handleFile(index, file) {
    const typeInfo = detectFileType(file.name)
    const modeInfo = detectMode(file.name)
    const newSlots = [...slots]
    newSlots[index] = { file, typeInfo, modeInfo }
    setSlots(newSlots)
    setStatus(p => ({ ...p, [index]: { state: 'idle' } }))
  }

  function removeFile(index) {
    const newSlots = [...slots]
    newSlots[index] = null
    setSlots(newSlots)
    const newStatus = { ...status }
    delete newStatus[index]
    setStatus(newStatus)
    const newPreviews = { ...previews }
    delete newPreviews[index]
    setPreviews(newPreviews)
  }

  async function parseFile(index, fileInfo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

          // Reparser avec cellDates pour avoir les vraies dates
          const wb2 = XLSX.read(e.target.result, { type: 'array', cellDates: true })
          const ws2 = wb2.Sheets[wb2.SheetNames[0]]
          const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1, raw: true })

          const { type } = fileInfo.typeInfo
          const { mode, month, year } = fileInfo.modeInfo
          let parsed = []

          if (mode === 'cohort') {
            parsed = parseCohort(rows2.slice(1), month, year)
          } else if (['injections','indispos','non_expl_mkt'].includes(type)) {
            parsed = parseWithDatetime(rows2.slice(1))
          } else if (['visites_cc','ventes_cc'].includes(type)) {
            parsed = parseVisitesVentesCC(rows2.slice(1))
          } else {
            parsed = parseWithTextDate(rows2.slice(1))
          }
          resolve(parsed)
        } catch(err) { reject(err) }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(fileInfo.file)
    })
  }

  async function lancerImport() {
    const filesToProcess = slots.map((s, i) => ({ slot: s, index: i })).filter(x => x.slot && x.slot.typeInfo)
    if (filesToProcess.length === 0) { setGlobalMsg({ type: 'error', text: 'Aucun fichier valide à importer' }); return }

    setRunning(true)
    setGlobalMsg(null)
    let totalInserted = 0, totalUpdated = 0, totalErrors = 0

    for (const { slot, index } of filesToProcess) {
      setStatus(p => ({ ...p, [index]: { state: 'parsing' } }))
      try {
        const parsed = await parseFile(index, slot)
        setStatus(p => ({ ...p, [index]: { state: 'injecting', count: parsed.length } }))
        // Séparer non reconnus si visites/ventes CC
      let parsedNormal = parsed
      if (slot.typeInfo.hasCommercial && parsed.nonReconnus) {
        parsedNormal = parsed.normal || []
        if (parsed.nonReconnus.length > 0) {
          setNonReconnus(prev => [...prev, ...parsed.nonReconnus.map(r => ({ ...r, fileType: slot.typeInfo.type }))])
          setShowNonRec(true)
        }
      }
      // Détecter noms non reconnus dans le mapping
      const rows = Array.isArray(parsedNormal) ? parsedNormal : []
      const unknown = []
      for (const row of rows) {
        const nom = row.nomConseillere || row.nom
        if (nom && nom !== 'GLOBAL' && !resolveConseillere(nom)) {
          if (!unknown.includes(nom)) unknown.push(nom)
        }
      }
      if (unknown.length > 0) {
        setUnmappedNoms(prev => [...new Set([...prev, ...unknown])])
        setShowMappingModal(true)
        setStatus(p => ({ ...p, [index]: { state: 'error', result: { errors: [`${unknown.length} nom(s) non reconnu(s) — définis le mapping d'abord`] } } }))
        continue
      }
      const importId = dryRun ? null : crypto.randomUUID()
      const result = await injectData(parsedNormal, slot.typeInfo, slot.modeInfo, dryRun, importId, slot.file.name)
      if (!dryRun && importId) {
        setHistorique(prev => [{ import_id: importId, fichier: slot.file.name, type: slot.typeInfo.type, date_import: new Date().toISOString(), count: result.inserted + result.updated }, ...prev].slice(0, 50))
      }
      if (dryRun && result.preview.length > 0) {
        setDryRunResults(prev => [...prev, { fileName: slot.file.name, typeInfo: slot.typeInfo, rows: result.preview }])
      }
        // Collecter commerciaux non reconnus
        const commNonReconnus = result.errors
          .filter(e => e.startsWith('COMM_NON_RECONNU:'))
          .map(e => e.replace('COMM_NON_RECONNU:', ''))
        if (commNonReconnus.length > 0) {
          setUnmappedCommerciaux(prev => [...new Set([...prev, ...commNonReconnus])])
          setShowCommerciauxModal(true)
        }
        const realErrors = result.errors.filter(e => !e.startsWith('COMM_NON_RECONNU:'))
        totalInserted += result.inserted
        totalUpdated += result.updated
        totalErrors += realErrors.length
        setStatus(p => ({ ...p, [index]: { state: realErrors.length > 0 ? 'error' : 'done', result: { ...result, errors: realErrors } } }))
      } catch(err) {
        setStatus(p => ({ ...p, [index]: { state: 'error', result: { errors: [err.message] } } }))
        totalErrors++
      }
    }

    setRunning(false)
    setGlobalMsg({
      type: totalErrors > 0 ? 'warning' : 'success',
      text: `Import terminé — ${totalInserted} insertions, ${totalUpdated} mises à jour${totalErrors > 0 ? `, ${totalErrors} erreurs` : ''}`
    })
  }

  const hasValidFiles = slots.some(s => s && s.typeInfo)
  async function annulerImport(importId) {
    setAnnulationEnCours(importId)
    try {
      const { data: rows } = await supabase.from('import_historique')
        .select('*').eq('import_id', importId)
      if (!rows || rows.length === 0) { setGlobalMsg({ type: 'error', text: 'Historique introuvable' }); return }

      for (const row of rows) {
        if (row.valeur_avant === null) {
          // Ligne créée par l'import → supprimer si row_id connu
          if (row.row_id) {
            await supabase.from(row.table_cible).delete().eq('id', row.row_id)
          }
        } else {
          // Ligne existante → remettre la valeur d'avant
          if (row.row_id) {
            await supabase.from(row.table_cible).update({ [row.champ]: row.valeur_avant }).eq('id', row.row_id)
          }
        }
      }
      // Supprimer l'historique de cet import
      await supabase.from('import_historique').delete().eq('import_id', importId)
      setHistorique(prev => prev.filter(h => h.import_id !== importId))
      setGlobalMsg({ type: 'success', text: 'Import annulé — données restaurées ✓' })
    } catch(e) {
      setGlobalMsg({ type: 'error', text: 'Erreur annulation: ' + e.message })
    }
    setAnnulationEnCours(null)
  }

  async function sauvegarderMappingCommerciaux() {
    const entries = Object.entries(pendingCommerciauxMapping).filter(([,v]) => v)
    if (entries.length === 0) return
    await supabase.from('odoo_mapping').upsert(
      entries.map(([nom_odoo, conseillere_id]) => ({ nom_odoo, conseillere_id, type: 'commercial' })),
      { onConflict: 'nom_odoo' }
    )
    entries.forEach(([nom, id]) => { COMMERCIAL_MAP[nom.toUpperCase()] = id; COMMERCIAL_MAP[nom] = id })
    setUnmappedCommerciaux([])
    setPendingCommerciauxMapping({})
    setShowCommerciauxModal(false)
    setGlobalMsg({ type: 'success', text: `${entries.length} commercial(aux) mappé(s) — relance l'import` })
  }

  async function sauvegarderMapping() {
    const entries = Object.entries(pendingMapping).filter(([,v]) => v)
    if (entries.length === 0) return
    // Sauvegarder dans Supabase
    await supabase.from('odoo_mapping').upsert(
      entries.map(([nom_odoo, conseillere_id]) => ({ nom_odoo, conseillere_id })),
      { onConflict: 'nom_odoo' }
    )
    // Mettre à jour le mapping local
    entries.forEach(([nom, id]) => { CONSEILLERE_MAP[nom] = id })
    setUnmappedNoms([])
    setPendingMapping({})
    setShowMappingModal(false)
    setGlobalMsg({ type: 'success', text: `${entries.length} mapping(s) sauvegardé(s) — relance l'import` })
  }

  async function injecterNonReconnus() {
    for (const row of nonReconnus) {
      const key = `${row.date}|||${row.nomConseillere}`
      const equipe = nonRecEquipes[key]
      if (!equipe) continue
      const consId = resolveConseillere(row.nomConseillere)
      if (!consId) continue
      const commId = NON_RECONNU_IDS[equipe]
      const fluxField = row.fileType === 'visites_cc' ? 'visites' : 'ventes'
      const { data: existing } = await supabase.from('flux_rdv')
        .select('id').eq('conseillere_id', consId).eq('commercial_id', commId)
        .eq('date_debut', row.date).maybeSingle()
      if (existing) {
        const { data: cur } = await supabase.from('flux_rdv').select(fluxField).eq('id', existing.id).maybeSingle()
        await supabase.from('flux_rdv').update({ [fluxField]: (cur?.[fluxField] || 0) + row.count }).eq('id', existing.id)
      } else {
        await supabase.from('flux_rdv').insert({
          conseillere_id: consId, commercial_id: commId,
          date_debut: row.date, date_fin: row.date, type_saisie: 'jour',
          rdv: 0, visites: fluxField === 'visites' ? row.count : 0, ventes: fluxField === 'ventes' ? row.count : 0,
        })
      }
    }
    setNonReconnus([])
    setNonRecEquipes({})
    setShowNonRec(false)
    setGlobalMsg({ type: 'success', text: 'Non reconnus injectés !' })
  }

  const allDone = hasValidFiles && slots.every((s, i) => !s || !s.typeInfo || (status[i] && (status[i].state === 'done' || status[i].state === 'error')))

  const stateIcon = (state) => ({ idle: '○', parsing: '⟳', injecting: '⟳', done: '✓', error: '✗' }[state] || '○')
  const stateColor = (state) => ({ idle: '#8A8A7A', parsing: '#C9A84C', injecting: '#534AB7', done: '#4CAF7D', error: '#E05C5C' }[state] || '#8A8A7A')

  return (
    <div>
      <PageHeader
        title={<span style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize: 28 }}>🤖</span> Agent d'import
        </span>}
        subtitle="Dépose les exports Odoo — l'agent détecte, parse et injecte dans Supabase"
      />

      {/* Message global */}
      {globalMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500,
          background: globalMsg.type === 'success' ? 'rgba(76,175,125,0.1)' : globalMsg.type === 'warning' ? 'rgba(224,123,48,0.1)' : 'rgba(224,92,92,0.1)',
          color: globalMsg.type === 'success' ? '#2d7a54' : globalMsg.type === 'warning' ? '#a05a1a' : '#a03030',
          border: `1px solid ${globalMsg.type === 'success' ? 'rgba(76,175,125,0.3)' : globalMsg.type === 'warning' ? 'rgba(224,123,48,0.3)' : 'rgba(224,92,92,0.3)'}`,
        }}>
          {globalMsg.text}
        </div>
      )}

      {/* Instructions */}
      {(() => {
        const [showGuide, setShowGuide] = React.useState(false)
        const cc = [
          { nom: 'injections [mois]',     dest: 'Leads bruts CC + sync Marketing', color: '#C9A84C' },
          { nom: 'indispos [mois]',        dest: 'Indispos CC + sync Marketing',    color: '#E07B30' },
          { nom: 'non expl cc [mois]',     dest: 'Non exploitables CC',             color: '#E05C5C' },
          { nom: 'echanges [mois]',        dest: 'Échanges bruts CC',               color: '#378ADD' },
          { nom: 'visites cc [mois]',      dest: 'Visites CC → Flux RDV',           color: '#2E9455' },
          { nom: 'ventes cc [mois]',       dest: 'Ventes CC → Flux RDV',            color: '#1a6b3c' },
        ]
        const mkt = [
          { nom: 'non expl marketing [mois]', dest: 'Non exploitables Marketing (cohort)', color: '#534AB7' },
          { nom: 'suivis marketing [mois]',    dest: 'Suivis Marketing (cohort)',           color: '#534AB7' },
          { nom: 'rdv marketing [mois]',       dest: 'RDV Marketing (cohort)',              color: '#534AB7' },
          { nom: 'visites marketing [mois]',   dest: 'Visites Marketing (cohort)',          color: '#534AB7' },
          { nom: 'ventes marketing [mois]',    dest: 'Ventes Marketing (cohort)',           color: '#534AB7' },
        ]
        return (
          <div style={{ marginBottom: 24 }}>
            <button onClick={() => setShowGuide(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(201,168,76,0.2)', background: showGuide ? 'rgba(201,168,76,0.08)' : '#F8F7F4', color: '#C9A84C', fontSize: 13, fontWeight: 500, cursor: 'pointer', width: '100%', justifyContent: 'space-between' }}>
              <span>📋 Guide de nommage des fichiers</span>
              <span style={{ fontSize: 11 }}>{showGuide ? '▲ Fermer' : '▼ Ouvrir'}</span>
            </button>
            {showGuide && (
              <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', border: '1px solid rgba(201,168,76,0.15)', borderTop: 'none', padding: '20px 20px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* CC */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#2C2C2C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                      📞 Call Center — jour par jour
                    </div>
                    <div style={{ fontSize: 11, color: '#8A8A7A', marginBottom: 10, fontStyle: 'italic' }}>
                      Le mois dans le nom est ignoré — c'est la date dans le fichier qui compte
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {cc.map(r => (
                        <div key={r.nom} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <code style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: r.color+'15', color: r.color, fontWeight: 600, whiteSpace: 'nowrap', border: `1px solid ${r.color}30` }}>{r.nom}</code>
                          <span style={{ fontSize: 11, color: '#5A5A5A', flex: 1 }}>→ {r.dest}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Marketing */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#2C2C2C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                      📊 Marketing — cohort mensuel
                    </div>
                    <div style={{ fontSize: 11, color: '#8A8A7A', marginBottom: 10, fontStyle: 'italic' }}>
                      Le mois dans le nom identifie la période de la cohort
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {mkt.map(r => (
                        <div key={r.nom} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <code style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(83,74,183,0.1)', color: '#534AB7', fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid rgba(83,74,183,0.2)' }}>{r.nom}</code>
                          <span style={{ fontSize: 11, color: '#5A5A5A', flex: 1 }}>→ {r.dest}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', fontSize: 11, color: '#8a6a1a' }}>
                  💡 Remplace <strong>[mois]</strong> par le mois concerné — ex: <em>injections avril</em>, <em>non expl marketing janvier</em>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Grille de slots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        {slots.map((slot, i) => (
          <div key={i}>
            <FileSlot index={i} fileInfo={slot} onFile={handleFile} onRemove={removeFile} />
            {/* Statut d'injection */}
            {status[i] && status[i].state !== 'idle' && (
              <div style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, background: '#F8F7F4', border: '1px solid rgba(201,168,76,0.1)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: stateColor(status[i].state), fontWeight: 600 }}>{stateIcon(status[i].state)}</span>
                <span style={{ color: stateColor(status[i].state) }}>
                  {status[i].state === 'parsing'   && 'Lecture du fichier...'}
                  {status[i].state === 'injecting' && `Injection (${status[i].count} lignes)...`}
                  {status[i].state === 'done'      && (dryRun ? `👁 ${status[i].result.inserted} lignes simulées` : `✓ ${status[i].result.inserted} insérés · ${status[i].result.updated} mis à jour`)}
                  {status[i].state === 'error'     && `Erreur: ${status[i].result?.errors?.[0] || 'inconnue'}`}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bouton lancer + toggle dry run */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        {/* Toggle mode test */}
        <div
          onClick={() => { setDryRun(p => !p); setDryRunResults([]); setStatus({}) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 20, cursor: 'pointer', border: `1.5px solid ${dryRun ? 'rgba(83,74,183,0.5)' : 'rgba(201,168,76,0.2)'}`, background: dryRun ? 'rgba(83,74,183,0.08)' : '#F8F7F4', transition: 'all 0.2s' }}
        >
          <div style={{ width: 36, height: 20, borderRadius: 10, background: dryRun ? '#534AB7' : '#D8D5CE', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: dryRun ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: dryRun ? 600 : 400, color: dryRun ? '#534AB7' : '#5A5A5A' }}>
            {dryRun ? '👁 Mode test activé — aucune donnée ne sera modifiée' : 'Mode test (simulation)'}
          </span>
        </div>

        <button
          onClick={() => { setDryRunResults([]); lancerImport() }}
          disabled={!hasValidFiles || running}
          style={{
            padding: '14px 48px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: (!hasValidFiles || running) ? 'not-allowed' : 'pointer',
            background: running ? '#E8D5A3' : dryRun ? '#534AB7' : allDone ? 'rgba(76,175,125,0.15)' : '#C9A84C',
            color: running ? '#8a6a1a' : allDone && !dryRun ? '#2d7a54' : '#fff',
            border: allDone && !dryRun ? '1.5px solid rgba(76,175,125,0.4)' : 'none',
            boxShadow: running || !hasValidFiles ? 'none' : `0 4px 20px ${dryRun ? 'rgba(83,74,183,0.3)' : 'rgba(201,168,76,0.3)'}`,
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          {running ? (
            <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display:'inline-block' }} />{dryRun ? 'Simulation...' : 'Importation en cours...'}</>
          ) : dryRun ? `👁 Simuler (${slots.filter(s => s && s.typeInfo).length} fichier${slots.filter(s => s && s.typeInfo).length > 1 ? 's' : ''})` : allDone ? '✓ Import terminé' : `🚀 Lancer l'import (${slots.filter(s => s && s.typeInfo).length} fichier${slots.filter(s => s && s.typeInfo).length > 1 ? 's' : ''})`}
        </button>
      </div>

      {/* Modal Mapping noms non reconnus */}
      {showMappingModal && unmappedNoms.length > 0 && (
        <div style={{ marginTop: 28, background: '#fff', borderRadius: 14, border: '1.5px solid rgba(83,74,183,0.3)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(83,74,183,0.06)', borderBottom: '1px solid rgba(83,74,183,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#534AB7' }}>🔗 Noms Odoo non reconnus ({unmappedNoms.length})</div>
              <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>Associe chaque nom à une conseillère — sauvegardé pour les prochains imports</div>
            </div>
            <button onClick={sauvegarderMapping}
              style={{ padding: '8px 18px', borderRadius: 8, background: '#534AB7', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Sauvegarder et relancer
            </button>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {unmappedNoms.map(nom => (
              <div key={nom} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, padding: '8px 14px', borderRadius: 8, background: '#F8F7F4', border: '1px solid rgba(83,74,183,0.2)', fontSize: 13, fontWeight: 500, color: '#534AB7' }}>{nom}</div>
                <span style={{ color: '#8A8A7A', fontSize: 16 }}>→</span>
                <select
                  value={pendingMapping[nom] || ''}
                  onChange={e => setPendingMapping(p => ({ ...p, [nom]: e.target.value }))}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.3)', fontSize: 13, background: '#F8F7F4', outline: 'none', color: '#2C2C2C' }}
                >
                  <option value=''>Sélectionner une conseillère...</option>
                  {conseilleresList.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Mapping commerciaux non reconnus */}
      {showCommerciauxModal && unmappedCommerciaux.length > 0 && (
        <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, border: '1.5px solid rgba(83,74,183,0.3)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(83,74,183,0.06)', borderBottom: '1px solid rgba(83,74,183,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#534AB7' }}>🔗 Commerciaux non reconnus ({unmappedCommerciaux.length})</div>
              <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>Associe chaque nom Odoo au bon commercial — sauvegardé pour les prochains imports</div>
            </div>
            <button onClick={sauvegarderMappingCommerciaux}
              style={{ padding: '8px 18px', borderRadius: 8, background: '#534AB7', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Sauvegarder et relancer
            </button>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {unmappedCommerciaux.map(nom => (
              <div key={nom} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, padding: '8px 14px', borderRadius: 8, background: '#F8F7F4', border: '1px solid rgba(83,74,183,0.2)', fontSize: 13, fontWeight: 500, color: '#534AB7' }}>{nom}</div>
                <span style={{ color: '#8A8A7A', fontSize: 16 }}>→</span>
                <select
                  value={pendingCommerciauxMapping[nom] || ''}
                  onChange={e => setPendingCommerciauxMapping(p => ({ ...p, [nom]: e.target.value }))}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.3)', fontSize: 13, background: '#F8F7F4', outline: 'none', color: '#2C2C2C' }}
                >
                  <option value=''>Sélectionner un commercial...</option>
                  {['sale','kenitra'].map(eq => (
                    <optgroup key={eq} label={eq === 'sale' ? 'Équipe Sale' : 'Équipe Kenitra'}>
                      {commerciauxList.filter(c => c.equipe === eq && !c.nom.includes('Non reconnu')).map(c => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panneau Non Reconnus */}
      {showNonRec && nonReconnus.length > 0 && (
        <div style={{ marginTop: 28, background: '#fff', borderRadius: 14, border: '1.5px solid rgba(224,123,48,0.3)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(224,123,48,0.06)', borderBottom: '1px solid rgba(224,123,48,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#a05a1a' }}>⚠ Visites / Ventes sans commercial ({nonReconnus.length} lignes)</div>
              <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>Assigne chaque ligne à Sale ou Kenitra avant injection</div>
            </div>
            <button onClick={() => injecterNonReconnus()}
              style={{ padding: '8px 18px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Injecter les assignées
            </button>
          </div>
          <div style={{ padding: '12px 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Date','Conseillère','Nb','Type','Équipe'].map(h => (
                  <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {nonReconnus.map((row, i) => {
                  const key = `${row.date}|||${row.nomConseillere}`
                  const equipe = nonRecEquipes[key]
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                      <td style={{ padding: '8px', fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>{row.date}</td>
                      <td style={{ padding: '8px', fontSize: 12 }}>{row.nomConseillere}</td>
                      <td style={{ padding: '8px', fontSize: 12, fontWeight: 600 }}>{row.count}</td>
                      <td style={{ padding: '8px', fontSize: 11, color: row.fileType === 'visites_cc' ? '#2E9455' : '#1a6b3c' }}>{row.fileType === 'visites_cc' ? 'Visite' : 'Vente'}</td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['sale','kenitra'].map(eq => (
                            <button key={eq} onClick={() => setNonRecEquipes(p => ({ ...p, [key]: eq }))}
                              style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: equipe === eq ? 600 : 400, cursor: 'pointer', border: `1.5px solid ${eq === 'sale' ? 'rgba(201,168,76,0.4)' : 'rgba(83,74,183,0.4)'}`, background: equipe === eq ? (eq === 'sale' ? '#C9A84C' : '#534AB7') : '#fff', color: equipe === eq ? '#fff' : eq === 'sale' ? '#C9A84C' : '#534AB7' }}>
                              {eq === 'sale' ? 'Sale' : 'Kenitra'}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Résultats Dry Run */}
      {dryRun && dryRunResults.length > 0 && (
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 14, border: '1.5px solid rgba(83,74,183,0.3)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(83,74,183,0.06)', borderBottom: '1px solid rgba(83,74,183,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#534AB7' }}>👁 Aperçu — ce qui serait injecté</div>
              <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>Aucune donnée modifiée — désactive le mode test pour injecter pour de vrai</div>
            </div>
            <div style={{ fontSize: 12, color: '#534AB7', fontWeight: 500 }}>{dryRunResults.reduce((s,r) => s + r.rows.length, 0)} lignes au total</div>
          </div>
          {dryRunResults.map((file, fi) => (
            <div key={fi} style={{ borderBottom: '1px solid rgba(83,74,183,0.08)' }}>
              <div style={{ padding: '10px 20px', fontSize: 12, fontWeight: 600, color: '#534AB7', background: 'rgba(83,74,183,0.03)' }}>
                {file.fileName} — {file.rows.length} lignes
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Date','Conseillère / dest.','Champ','Valeur','Table','Action'].map(h => (
                      <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '6px 12px', borderBottom: '1px solid rgba(83,74,183,0.1)', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {file.rows.map((row, ri) => (
                      <tr key={ri} onMouseEnter={e => e.currentTarget.style.background='rgba(83,74,183,0.03)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ padding: '7px 12px', fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>{row.date}</td>
                        <td style={{ padding: '7px 12px', fontSize: 12 }}>{row.conseillere}</td>
                        <td style={{ padding: '7px 12px', fontSize: 12, color: '#534AB7', fontWeight: 500 }}>{row.field}</td>
                        <td style={{ padding: '7px 12px', fontSize: 13, fontWeight: 700, color: '#2C2C2C' }}>{row.value}</td>
                        <td style={{ padding: '7px 12px', fontSize: 11, color: '#8A8A7A' }}>{row.table}</td>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: row.action === 'cohort' ? 'rgba(83,74,183,0.1)' : 'rgba(76,175,125,0.1)', color: row.action === 'cohort' ? '#534AB7' : '#2E9455', fontWeight: 500 }}>{row.action}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historique des imports */}
      <div style={{ marginTop: 28 }}>
        <button onClick={() => setShowHistorique(p => !p)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 18px', borderRadius: showHistorique ? '12px 12px 0 0' : 12, border: '1px solid rgba(201,168,76,0.2)', background: showHistorique ? 'rgba(201,168,76,0.08)' : '#F8F7F4', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#2C2C2C' }}>
          <span>🕓 Historique des imports ({historique.length})</span>
          <span style={{ fontSize: 11, color: '#8A8A7A' }}>{showHistorique ? '▲ Fermer' : '▼ Ouvrir'}</span>
        </button>
        {showHistorique && (
          <div style={{ background: '#fff', border: '1px solid rgba(201,168,76,0.15)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            {historique.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: '#8A8A7A' }}>Aucun import enregistré</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Date','Fichier','Type','Lignes','Action'].map(h => (
                    <th key={h} style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 14px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {historique.map(h => (
                    <tr key={h.import_id} onMouseEnter={e => e.currentTarget.style.background='#FAFAF8'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#C9A84C', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {new Date(h.date_import).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 500, color: '#2C2C2C' }}>{h.fichier}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(201,168,76,0.1)', color: '#C9A84C', fontWeight: 500 }}>{h.type}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#2C2C2C' }}>{h.count}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={() => annulerImport(h.import_id)}
                          disabled={annulationEnCours === h.import_id}
                          style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid rgba(224,92,92,0.3)', background: 'transparent', color: '#E05C5C', fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          {annulationEnCours === h.import_id ? (
                            <><span style={{ width: 12, height: 12, border: '2px solid rgba(224,92,92,0.3)', borderTopColor: '#E05C5C', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Annulation...</>
                          ) : '↩ Annuler'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}