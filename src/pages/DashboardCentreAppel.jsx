// JG Dashboard - DashboardCentreAppel - v20260517103406 - joursExclus-fix
import React, { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import ConseillereFilter from '../components/ConseillereFilter'
import KpiCard from '../components/KpiCard'
import { getColorFromObjectif, getObjectifsPourPeriode, getObjectifsConseillere, clearObjectifsCache } from '../lib/objectifs'
import SectionTitle from '../components/SectionTitle'
import { getGroupFunction, formatGroupLabel, filtrerParSelection } from '../lib/dates'
import { useJoursExclus, normaliserSaisies, filtrerJoursOuvrables } from '../lib/dates'
import { agregerParPeriode, calcCV, calcConversionTel, calcTauxPresence, calcEfficaciteComm } from '../lib/kpi'
import DrillNav from '../components/DrillNav'
import { exportToXlsx, labelToFilename } from '../lib/useExportXlsx'
import { supabase } from '../lib/supabase'
import { syncMarketing } from '../lib/sync'

// Filtrer les données selon la sélection DrillNav (inclut période custom)
function filterBySelected(items, selected, dateField = 'date') {
  if (!selected || selected.type === 'global') return items
  if (selected.type === 'custom') {
    return items.filter(s => {
      const d = s[dateField] || s.date || s.date_debut
      return d && d >= selected.from && d <= selected.to
    })
  }
  if (selected.type === 'year') return items.filter(s => { const d = s[dateField] || s.date || s.date_debut; return d && d.startsWith(String(selected.value)) })
  if (selected.type === 'quarter') {
    const [y, q] = selected.value.split('-Q')
    const startM = (parseInt(q)-1)*3
    return items.filter(s => { const raw = s[dateField] || s.date || s.date_debut; if (!raw) return false; const d = new Date(String(raw).substring(0,10) + 'T12:00:00'); return d.getFullYear() === parseInt(y) && Math.floor(d.getMonth()/3) === parseInt(q)-1 })
  }
  if (selected.type === 'month') return items.filter(s => { const d = s[dateField] || s.date || s.date_debut; return d && d.startsWith(selected.value) })
  if (selected.type === 'day') return items.filter(s => { const d = s[dateField] || s.date || s.date_debut; return d && d.startsWith(selected.value) })
  return items
}

function getStars(rank, total) {
  const stars = Math.max(0, Math.min(5, total) - rank)
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars))
}

function getRankColor(rank, total) {
  if (total <= 1) return '#C9A84C'
  const ratio = rank / (total - 1)
  if (ratio <= 0.2) return '#1a6b3c'
  if (ratio <= 0.4) return '#2E9455'
  if (ratio <= 0.6) return '#C9A84C'
  if (ratio <= 0.8) return '#E07B30'
  return '#E05C5C'
}

function cvSerie(valeurs) {
  const vals = valeurs.filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0)
  if (vals.length < 2) return 0
  const moy = vals.reduce((a, b) => a + b, 0) / vals.length
  if (moy === 0) return 0
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0) / vals.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

function getMoisCourant() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
}

const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

const ALL_RANK_COLS = [
  { key: 'leads_bruts',     label: 'Injections',      hideForConseillere: true,  color: '#C9A84C' },
  { key: 'indispos',        label: 'Indispos',         hideForConseillere: true,  color: '#E05C5C' },
  { key: 'leads_nets',      label: 'L.exploitables',   hideForConseillere: false, color: '#2E9455' },
  { key: 'echanges',        label: 'Échanges' },
  { key: 'echanges_nettes', label: 'Éch. Nettes',      hideForConseillere: true,  color: '#534AB7' },
  { key: 'productivite',    label: 'Productivité',     color: '#378ADD' },
  { key: 'joignabilite',    label: 'Joignabilité',     color: '#2E9455' },
  { key: 'rdv',             label: 'RDV',              color: '#534AB7' },
  { key: 'conv_tel',        label: 'Conv. Tél.',       color: '#C9A84C' },
  { key: 'visites',         label: 'Visites',          color: '#4CAF7D' },
  { key: 'presence',        label: 'Tx Présence',      color: '#4CAF7D' },
  { key: 'ventes',          label: 'Ventes',           color: '#1a6b3c' },
  { key: 'efficacite_comm', label: 'Eff. Comm.',       color: '#534AB7' },
]

export default function DashboardCallCenter({ conseilleres, conseilleresActives, saisies: props_saisies, reload }) {
  const { profil } = useAuth()
  const { joursFeries, absences } = useJoursExclus()
  // Normaliser : dimanches/fériés → jour ouvré d'avant
  const saisies = React.useMemo(
    () => normaliserSaisies(props_saisies, joursFeries),
    [props_saisies, joursFeries]
  )
  const isSuperAdmin = profil?.role === 'super_admin'
  const isConseillere = profil?.role === 'conseillere'
  // Mon propre ID conseillère (pour vue restreinte)
  const myConseillereId = profil?.conseillere_id || null
  // Conseillères visibles selon permissions
  const conseillerePerms = profil?.permissions?.centre_appel_conseilleres || {}
  // conseilleresActives = sans les masquées (pour l'affichage)
  // conseilleres = toutes (pour les calculs globaux)
  const baseConseilleres = conseilleresActives || conseilleres
  const conseilleresFiltrees = useMemo(() => {
    if (isSuperAdmin || !isConseillere) return baseConseilleres
    return baseConseilleres.filter(c => c.id === myConseillereId)
  }, [baseConseilleres, isSuperAdmin, isConseillere, myConseillereId])

  const [selected, setSelected] = useState(() => {
    const now = new Date()
    const saved = localStorage.getItem('jg_selected_cc')
    if (saved) try { return JSON.parse(saved) } catch(e) {}
    const mKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
    return { type: 'month', value: mKey, label: `${MOIS[now.getMonth()]} ${now.getFullYear()}` }
  })
  const [filtreConseillere, setFiltreConseillere] = useState(() => {
    // Pour une conseillère : filtrer sur ses données dès le départ
    const p = null // sera résolu via useEffect
    return 'all'
  })
  const [drillConseillere, setDrillConseillere] = useState(null)
  const [objectifs, setObjectifs] = useState({})
  const [objectifsIndiv, setObjectifsIndiv] = useState({}) // Objectifs individuels par conseillère
  const [hiddenRankCols, setHiddenRankCols] = useState({})
  const [showRankCols, setShowRankCols] = useState(false)
  const [showSaisie, setShowSaisie] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [showHistorique, setShowHistorique] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [chartType, setChartType] = useState('bar')
  const [saisieMode, setSaisieMode] = useState('jour')
  const [ccView, setCcView] = useState('global') // 'global' | 'details'
  const [fluxDetails, setFluxDetails] = useState([])
  const [commerciaux, setCommerciaux] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [seuilVisites, setSeuilVisites] = useState({ sale: 0, kenitra: 0 })
  const [savingSeuilEq, setSavingSeuilEq] = useState(null) // 'sale' | 'kenitra' | null

  // Charger les seuils depuis Supabase pour le mois sélectionné
  async function loadSeuils(moisKey) {
    if (!moisKey) return
    const { data } = await supabase.from('seuils_visites').select('equipe, valeur').eq('mois', moisKey)
    if (data && data.length > 0) {
      const s = { sale: 0, kenitra: 0 }
      data.forEach(d => { s[d.equipe] = d.valeur })
      setSeuilVisites(s)
    } else {
      setSeuilVisites({ sale: 0, kenitra: 0 })
    }
  }

  // Sauvegarder un seuil dans Supabase
  async function saveSeuil(equipe, valeur, moisKey) {
    if (!moisKey) return
    setSavingSeuilEq(equipe)
    await supabase.from('seuils_visites').upsert(
      { equipe, mois: moisKey, valeur, updated_at: new Date().toISOString() },
      { onConflict: 'equipe,mois' }
    )
    setSavingSeuilEq(null)
  }
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ conseillere_id: '', date: today, date_debut: '', date_fin: '', leads_bruts: '', indispos: '', non_exploitables: '', echanges: '', rdv: '', visites: '', ventes: '' })

  useEffect(() => {
    loadObjectifsPeriode()
    localStorage.setItem('jg_selected_cc', JSON.stringify(selected))
  }, [selected])

  // Charger flux_rdv + commerciaux pour la vue details
  useEffect(() => {
    if (ccView !== 'details') return
    async function loadDetails() {
      setLoadingDetails(true)

      // Plage de dates selon la periode selectionnee
      let dateFrom = '2026-01-01'
      let dateTo   = '2030-12-31'
      if (selected?.type === 'month' && selected?.value) {
        const [y, m] = selected.value.split('-')
        dateFrom = selected.value + '-01'
        dateTo   = selected.value + '-' + String(new Date(parseInt(y), parseInt(m), 0).getDate()).padStart(2,'0')
      } else if (selected?.type === 'year' && selected?.value) {
        dateFrom = selected.value + '-01-01'
        dateTo   = selected.value + '-12-31'
      } else if (selected?.type === 'quarter' && selected?.value) {
        const [y, q] = selected.value.split('-Q')
        const startM = (parseInt(q) - 1) * 3 + 1
        const endM   = startM + 2
        dateFrom = `${y}-${String(startM).padStart(2,'0')}-01`
        dateTo   = `${y}-${String(endM).padStart(2,'0')}-${String(new Date(parseInt(y), endM, 0).getDate()).padStart(2,'0')}`
      } else if (selected?.type === 'custom' && selected?.from) {
        dateFrom = selected.from
        dateTo   = selected.to || selected.from
      }

      const [{ data: comms }, { data: flux }] = await Promise.all([
        supabase.from('commerciaux').select('id, nom, equipe').eq('actif', true).order('equipe').order('nom'),
        supabase.from('flux_rdv')
          .select('conseillere_id, commercial_id, date_debut, rdv, visites, ventes, type_saisie')
          .gte('date_debut', dateFrom)
          .lte('date_debut', dateTo)
          .order('date_debut')
          .limit(5000),
      ])
      setCommerciaux(comms || [])
      setFluxDetails(flux || [])
      setLoadingDetails(false)
    }
    loadDetails()
    // Charger les seuils pour la periode selectionnee
    const moisKey = selected?.type === 'month' ? selected.value : null
    if (moisKey) loadSeuils(moisKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccView, selected])

  // Pour une conseillère : bloquer le filtre sur son propre ID
  useEffect(() => {
    if (isConseillere && myConseillereId) {
      setFiltreConseillere(myConseillereId)
    }
  }, [isConseillere, myConseillereId])

  async function loadObjectifsPeriode() {
    clearObjectifsCache()
    const obj = await getObjectifsPourPeriode(selected)
    setObjectifs(obj)
    // Si une conseillère est sélectionnée → charger aussi ses objectifs individuels
    if (filtreConseillere && filtreConseillere !== 'all') {
      const objIndiv = await getObjectifsConseillere(filtreConseillere, selected)
      if (objIndiv && objIndiv.obj_echanges_nb > 0) {
        setObjectifsIndiv(objIndiv)
      } else {
        setObjectifsIndiv({})
      }
    } else {
      setObjectifsIndiv({})
    }
  }

  const saisiesFiltrees = useMemo(() => {
    let data = filtrerParSelection(saisies, selected)
    if (filtreConseillere !== 'all') data = data.filter(s => s.conseillere_id === filtreConseillere)
    return data
  }, [saisies, selected, filtreConseillere])

  // Saisies filtrées par période uniquement (sans filtre par conseillère)
  // Utilisé pour le ranking afin que toutes les conseillères aient leurs données visibles
  const saisiesParPeriode = useMemo(() => filtrerParSelection(saisies, selected), [saisies, selected])

  // Toujours diviser par l'équipe complète (pas par la vue filtrée) pour avoir les bons objectifs individuels
  const nbConseilleres = conseilleres.length || 6
  const objParConseillere = useMemo(() => ({
    obj_echanges_nb: objectifs.obj_echanges_nb ? Math.round(objectifs.obj_echanges_nb / nbConseilleres) : 0,
    obj_rdv_nb:      objectifs.obj_rdv_nb      ? Math.round(objectifs.obj_rdv_nb      / nbConseilleres) : 0,
    obj_visites_nb:  objectifs.obj_visites_nb  ? Math.round(objectifs.obj_visites_nb  / nbConseilleres) : 0,
    obj_ventes_nb:   objectifs.obj_ventes_nb   ? Math.round(objectifs.obj_ventes_nb   / nbConseilleres) : 0,
  }), [objectifs, nbConseilleres])

  // ── Prorata jours ouvrés pour le mois en cours ──────────────────────────────
  // Si on est en train de regarder le mois en cours → objectif proratisé
  // selon les jours ouvrés écoulés vs total jours ouvrés du mois
  const prorataFactor = useMemo(() => {
    const now = new Date()
    const moisCourant = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    if (selected?.type !== 'month' || selected?.value !== moisCourant) return 1

    const year = now.getFullYear()
    const month = now.getMonth() // 0-indexed
    const today = now.getDate()
    const lastDay = new Date(year, month + 1, 0).getDate()

    // Jours ouvrés = tous les jours sauf dimanches (et fériés qu'on ignore ici pour la simplicité)
    function countJoursOuvres(from, to) {
      let count = 0
      for (let d = from; d <= to; d++) {
        const dow = new Date(year, month, d).getDay()
        if (dow !== 0) count++ // exclure dimanches
      }
      return count
    }

    const joursEcoules = countJoursOuvres(1, today)
    const joursTotaux  = countJoursOuvres(1, lastDay)

    if (joursTotaux === 0) return 1
    return joursEcoules / joursTotaux
  }, [selected])

  // Appliquer le prorata à l'objectif
  function applyProrata(objNb) {
    if (!objNb || prorataFactor === 1) return objNb
    return Math.round(objNb * prorataFactor)
  }

  const kpisGlobal = useMemo(() => {
    const objEchIndiv = objectifsIndiv?.obj_echanges_nb || 0
    const objEchEquipe = objParConseillere.obj_echanges_nb
    const objEchBase = (isConseillere || filtreConseillere !== 'all')
      ? (objEchIndiv > 0 ? objEchIndiv : objEchEquipe)
      : objectifs.obj_echanges_nb
    const objEch = applyProrata(objEchBase)
    if (isConseillere && myConseillereId) return agregerParPeriode(saisiesFiltrees, myConseillereId, { objEchangesNb: objEch })
    return agregerParPeriode(saisiesFiltrees, null, { objEchangesNb: objEch })
  }, [saisiesFiltrees, isConseillere, myConseillereId, filtreConseillere, objParConseillere, objectifs, objectifsIndiv, prorataFactor])
  const [objectifsParConseillere, setObjectifsParConseillere] = useState({}) // { conseillere_id: obj_echanges_nb }

  // Charger les objectifs individuels pour toutes les conseillères (pour le ranking)
  useEffect(() => {
    async function loadAllObjIndiv() {
      if (!conseilleres.length || !selected) return
      const results = {}
      await Promise.all(conseilleres.map(async c => {
        const obj = await getObjectifsConseillere(c.id, selected)
        results[c.id] = obj?.obj_echanges_nb > 0 ? obj.obj_echanges_nb : objParConseillere.obj_echanges_nb
      }))
      setObjectifsParConseillere(results)
    }
    loadAllObjIndiv()
  }, [conseilleres, selected, objParConseillere])

  // Ranking : uniquement les conseillères actives (masquées = exclues du ranking)
  // Mais saisiesParPeriode inclut tout le monde → KPIs globaux corrects
  const kpisParConseillere = useMemo(() => (conseilleresActives || conseilleres).map(c => ({ ...c, ...agregerParPeriode(
    saisiesParPeriode,
    c.id,
    { objEchangesNb: applyProrata(objectifsParConseillere[c.id] || objParConseillere.obj_echanges_nb) }
  ) })), [conseilleres, conseilleresActives, saisiesParPeriode, objParConseillere, objectifsParConseillere, prorataFactor])
  const cvConvTel = useMemo(() => calcCV(kpisParConseillere.map(c => c.conversion_tel)), [kpisParConseillere])
  const cvPresence = useMemo(() => calcCV(kpisParConseillere.map(c => c.taux_presence)), [kpisParConseillere])
  const cvEfficacite = useMemo(() => calcCV(kpisParConseillere.map(c => c.efficacite_comm)), [kpisParConseillere])

  const groupFn = useMemo(() => {
    if (selected.type === 'day' || selected.type === 'month' || selected.type === 'custom') return getGroupFunction('jour')
    return getGroupFunction('mois')
  }, [selected])

  const periodeForLabel = useMemo(() => {
    if (selected.type === 'day' || selected.type === 'month' || selected.type === 'custom') return 'jour'
    return 'mois'
  }, [selected])

  const tableData = useMemo(() => {
    const groups = groupFn(saisiesFiltrees)
    return Object.entries(groups).sort(([a],[b]) => b.localeCompare(a)).map(([key, items]) => {
      const agg = agregerParPeriode(items, null, { objEchangesNb: filtreConseillere !== 'all' ? objParConseillere.obj_echanges_nb : objectifs.obj_echanges_nb })
      const convParC = conseilleres.map(c => calcConversionTel(items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+(s.rdv||0),0), items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+(s.echanges||0),0)))
      const presParC = conseilleres.map(c => calcTauxPresence(items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.visites,0), items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.rdv,0)))
      const effParC = conseilleres.map(c => calcEfficaciteComm(items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.ventes,0), items.filter(s=>s.conseillere_id===c.id).reduce((a,s)=>a+s.visites,0)))
      return { label: formatGroupLabel(key, periodeForLabel), key, ...agg, cv_conv: cvSerie(convParC), cv_presence: cvSerie(presParC), cv_efficacite: cvSerie(effParC) }
    })
  }, [saisiesFiltrees, groupFn, conseilleres, periodeForLabel])

  const chartData = useMemo(() => [...tableData].reverse().map(r => ({ label: r.label, conv: r.conversion_tel, presence: r.taux_presence, efficacite: r.efficacite_comm })), [tableData])
  const rankingSorted = useMemo(() => [...kpisParConseillere].sort((a,b) => (Math.min(b.productivite,100)*0.3+b.conversion_tel*0.3+b.taux_presence*0.3+b.efficacite_comm*0.1) - (Math.min(a.productivite,100)*0.3+a.conversion_tel*0.3+a.taux_presence*0.3+a.efficacite_comm*0.1)), [kpisParConseillere])

  const leadsNetsForm = Math.max(0, (parseFloat(form.leads_bruts)||0) - (parseFloat(form.indispos)||0))
  const echangesNetsForm = Math.max(0, (parseFloat(form.echanges)||0) - (parseFloat(form.non_exploitables)||0))

  async function checkAndSave(e) {
    e.preventDefault()
    if (!form.conseillere_id) { setMsg({ type: 'error', text: 'Sélectionne une conseillère' }); return }
    const dateDebut = saisieMode === 'jour' ? form.date : form.date_debut
    const dateFin = saisieMode === 'jour' ? form.date : form.date_fin
    if (!dateDebut) { setMsg({ type: 'error', text: 'Sélectionne une date' }); return }
    if (saisieMode === 'periode' && !dateFin) { setMsg({ type: 'error', text: 'Sélectionne une date de fin' }); return }
    if (dateDebut > dateFin) { setMsg({ type: 'error', text: 'La date de fin doit être après la date de début' }); return }

    // Verifier si une saisie existe deja pour cette periode/conseillere
    const { data: existing } = await supabase.from('saisies')
      .select('id, date_debut, date_fin')
      .eq('conseillere_id', form.conseillere_id)
      .lte('date_debut', dateFin)
      .gte('date_fin', dateDebut)

    if (existing && existing.length > 0) {
      // Charger les données existantes pour les afficher dans la popup
      const { data: existingFull } = await supabase.from('saisies')
        .select('*')
        .eq('id', existing[0].id)
        .maybeSingle()
      setConfirmModal({ dateDebut, dateFin, existingIds: existing.map(e => e.id), existingData: existingFull })
    } else {
      await doSave(dateDebut, dateFin)
    }
  }

  async function doSave(dateDebut, dateFin) {
    setSaving(true)
    setConfirmModal(null)
    const base = f => parseFloat(form[f]) || 0

    // Backup des saisies existantes avant ecrasement
    const { data: oldData } = await supabase.from('saisies').select('*')
      .eq('conseillere_id', form.conseillere_id)
      .lte('date_debut', dateFin)
      .gte('date_fin', dateDebut)

    if (oldData && oldData.length > 0) {
      const backups = oldData.map(d => ({ saisie_id: d.id, conseillere_id: d.conseillere_id, date: d.date_debut, ancienne_valeur: JSON.stringify(d) }))
      await supabase.from('historique_saisies').upsert(backups, { onConflict: 'saisie_id' })
      // Supprimer les anciennes saisies qui chevauchent
      await supabase.from('saisies').delete().in('id', oldData.map(d => d.id))
    }

    // Construire le payload - seulement les champs renseignes
    const existingData = oldData && oldData.length > 0 ? oldData[0] : null

    // Recuperer RDV/Visites/Ventes depuis flux_rdv pour cette conseillere et cette periode
    const { data: fluxData } = await supabase.from('flux_rdv')
      .select('rdv, visites, ventes')
      .eq('conseillere_id', form.conseillere_id)
      .gte('date_debut', dateDebut)
      .lte('date_fin', dateFin)
    
    const fluxRDV = (fluxData || []).reduce((acc, f) => ({
      rdv: acc.rdv + parseFloat(f.rdv || 0),
      visites: acc.visites + parseFloat(f.visites || 0),
      ventes: acc.ventes + parseFloat(f.ventes || 0),
    }), { rdv: 0, visites: 0, ventes: 0 })

    const indisposVal = form.indispos !== '' ? base('indispos') : (existingData?.indispos ?? 0)
    const leadsBrutsVal = form.leads_bruts !== '' ? base('leads_bruts') : (existingData?.leads_bruts ?? 0)
    const echangesBrutsVal = form.echanges !== '' ? base('echanges') : (existingData?.echanges ?? 0)
    const nonExplVal = form.non_exploitables !== '' ? base('non_exploitables') : (existingData?.non_exploitables ?? 0)
    
    const payload = {
      conseillere_id: form.conseillere_id,
      date: dateDebut,
      date_debut: dateDebut,
      date_fin: dateFin,
      type_saisie: saisieMode,
      leads_bruts: leadsBrutsVal,
      indispos: indisposVal,
      leads_nets: Math.max(0, leadsBrutsVal - indisposVal),
      echanges: Math.max(0, echangesBrutsVal - nonExplVal),
      rdv: fluxRDV.rdv > 0 ? fluxRDV.rdv : (existingData?.rdv ?? 0),
      visites: fluxRDV.visites > 0 ? fluxRDV.visites : (existingData?.visites ?? 0),
      ventes: fluxRDV.ventes > 0 ? fluxRDV.ventes : (existingData?.ventes ?? 0),
    }

    const { error } = await supabase.from('saisies').insert(payload)
    
    // Sync CC → Marketing : leads_bruts → injections, indispos → indispos
    if (!error) {
      // Calculer les totaux CC pour ce jour (toutes conseillères)
      const { data: allSaisiesJour } = await supabase.from('saisies')
        .select('leads_bruts, indispos')
        .eq('date_debut', dateDebut)
        .eq('date_fin', dateFin)
      
      // Sync centralisée CC → Marketing (leads_bruts + indispos uniquement)
      await syncMarketing(dateDebut)
    }

    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      const label = saisieMode === 'jour' ? `Données enregistrées pour le ${dateDebut} !` : `Données enregistrées du ${dateDebut} au ${dateFin} !`
      setMsg({ type: 'success', text: label })
      reload()
      setForm(p => ({ ...p, leads_bruts: '', indispos: '', echanges: '', rdv: '', visites: '', ventes: '' }))
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function annulerMiseAJour(saisieId) {
    const { data: backup } = await supabase.from('historique_saisies').select('*').eq('saisie_id', saisieId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!backup) { setMsg({ type: 'error', text: 'Aucun historique disponible' }); return }
    const ancienne = JSON.parse(backup.ancienne_valeur)
    const { id, created_at, ...updateData } = ancienne
    const { error } = await supabase.from('saisies').update(updateData).eq('id', saisieId)
    if (!error) await syncMarketing(updateData.date_debut || updateData.date)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'success', text: 'Mise à jour annulée — données restaurées !' }); reload(); setTimeout(() => setMsg(null), 3000) }
  }

  async function supprimerSaisie(id) {
    if (!window.confirm('Supprimer cette saisie définitivement ?')) return
    // Recuperer la saisie avant suppression
    const { data: saisie } = await supabase.from('saisies').select('*').eq('id', id).maybeSingle()
    const { data: saisieASuppr } = await supabase.from('saisies').select('date_debut, date').eq('id', id).maybeSingle()
    await supabase.from('saisies').delete().eq('id', id)
    if (saisieASuppr) await syncMarketing(saisieASuppr.date_debut || saisieASuppr.date)
    // Sync: mettre indispos a 0 dans marketing si periode correspondante
    if (saisie) {
      const { data: mkt } = await supabase.from('marketing_saisies')
        .select('id').eq('conseillere_id', saisie.conseillere_id)
        .gte('date_debut', saisie.date_debut)
        .lte('date_debut', saisie.date_fin || saisie.date_debut)
        .maybeSingle()
      if (mkt) await supabase.from('marketing_saisies').update({ indispos: 0 }).eq('id', mkt.id)
    }
    reload()
  }

  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }
  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const thStyle = { fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, whiteSpace: 'nowrap' }
  const tdStyle = { padding: '9px 8px', fontSize: 11, borderBottom: '1px solid rgba(201,168,76,0.06)', whiteSpace: 'nowrap' }
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none' }
  const labelStyle = { fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 5, display: 'block' }
  const periodeLabel = selected.type === 'jour' || selected.type === 'day' || selected.type === 'month' ? 'jour' : 'mois'


  // ── Export XLSX ──────────────────────────────────────────────────────────────
  function exportCC() {
    const periodLabel = selected?.label || 'Global'
    const filename = `CC_${labelToFilename(periodLabel)}`

    // Onglet 1 : KPIs par période
    const sheet1 = tableData.map(r => ({
      'Période':           r.label,
      'Leads Bruts':       r.leads_bruts ?? '',
      'Leads Exploitables':        r.leads_nets ?? '',
      'Échanges':          r.echanges ?? '',
      'Non Explo. CC':     r.non_exploitables_cc ?? '',
      'Productivité %':    r.productivite ?? '',
      'Joignabilité %':    r.joignabilite ?? '',
      'Conv. Tél. %':      r.conversion_tel ?? '',
      'CV Conv. %':        r.cv_conv ?? '',
      'RDV':               r.rdv ?? '',
      'Présence %':        r.taux_presence ?? '',
      'CV Présence %':     r.cv_presence ?? '',
      'Visites':           r.visites ?? '',
      'Eff. Comm. %':      r.efficacite_comm ?? '',
      'CV Eff. %':         r.cv_efficacite ?? '',
      'Ventes':            r.ventes ?? '',
    }))

    // Onglet 2 : Ranking par conseillère
    const sheet2 = rankingSorted.map((c, i) => ({
      '#':                 i + 1,
      'Conseillère':       c.nom,
      'Leads Bruts':       c.leads_bruts ?? '',
      'Leads Exploitables':        c.leads_nets ?? '',
      'Échanges':          c.echanges ?? '',
      'Productivité %':    c.productivite ?? '',
      'Joignabilité %':    c.joignabilite ?? '',
      'Conv. Tél. %':      c.conversion_tel ?? '',
      'RDV':               c.rdv ?? '',
      'Présence %':        c.taux_presence ?? '',
      'Visites':           c.visites ?? '',
      'Eff. Comm. %':      c.efficacite_comm ?? '',
      'Ventes':            c.ventes ?? '',
      'Score':             parseFloat(((Math.min(c.productivite||0,100)*0.3)+(c.conversion_tel||0)*0.3+(c.taux_presence||0)*0.3+(c.efficacite_comm||0)*0.1).toFixed(1)),
    }))

    // Onglet 3 : détail par date × conseillère
    const sheet3 = []
    const datesInPeriod = [...new Set(saisiesParPeriode.map(s => s.date || s.date_debut))].sort().reverse()
    datesInPeriod.forEach(date => {
      conseilleres.forEach(c => {
        const rows = saisiesParPeriode.filter(s => s.conseillere_id === c.id && (s.date === date || s.date_debut === date))
        if (rows.length === 0) return
        const agg = agregerParPeriode(rows, c.id, { objEchangesNb: objParConseillere.obj_echanges_nb })
        sheet3.push({
          'Date':            date,
          'Conseillere':     c.nom,
          'Leads Bruts':     agg.leads_bruts ?? '',
          'Leads Exploitables':      agg.leads_nets ?? '',
          'Echanges':        agg.echanges ?? '',
          'Non Explo. CC':   agg.non_exploitables_cc ?? '',
          'Productivite %':  agg.productivite ?? '',
          'Joignabilite %':  agg.joignabilite ?? '',
          'Conv. Tel. %':    agg.conversion_tel ?? '',
          'RDV':             agg.rdv ?? '',
          'Presence %':      agg.taux_presence ?? '',
          'Visites':         agg.visites ?? '',
          'Eff. Comm. %':    agg.efficacite_comm ?? '',
          'Ventes':          agg.ventes ?? '',
        })
      })
    })

    exportToXlsx([
      { name: `KPIs - ${periodLabel}`.substring(0,31), rows: sheet1 },
      { name: 'Ranking Conseilleres', rows: sheet2 },
      { name: 'Detail par Conseillere', rows: sheet3 },
    ], filename)
  }

  return (
    <div>
      {/* Modal confirmation */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 540, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#E07B30' }}>⚠️ Données existantes</div>
              <button onClick={() => setConfirmModal(null)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.2)', background: '#fff', fontSize: 16, cursor: 'pointer', color: '#5A5A5A' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 20 }}>
              Des données existent déjà pour <strong style={{ color: '#C9A84C' }}>{confirmModal.dateDebut}</strong>. Modifie directement les champs ci-dessous :
            </div>
            {confirmModal.existingData && (() => {
              const d = confirmModal.existingData
              const fields = [
                { key: 'leads_bruts', label: 'Leads Bruts', color: '#C9A84C' },
                { key: 'indispos', label: 'Indispos', color: '#E05C5C' },
                { key: 'echanges', label: 'Échanges Bruts', color: '#534AB7' },
                { key: 'non_exploitables', label: 'Non Expl. CC', color: '#E07B30' },
                { key: 'rdv', label: 'RDV', color: '#4CAF7D' },
                { key: 'visites', label: 'Visites', color: '#2E9455' },
                { key: 'ventes', label: 'Ventes', color: '#1a6b3c' },
              ]
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  {fields.map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', marginBottom: 5, fontWeight: 500 }}>{f.label}</div>
                      <input
                        type="number" min="0"
                        defaultValue={d[f.key] ?? 0}
                        onChange={e => setConfirmModal(p => ({ ...p, editValues: { ...(p.editValues||{}), [f.key]: e.target.value } }))}
                        style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${f.color}30`, borderRadius: 8, fontSize: 13, background: '#F8F7F4', outline: 'none', borderLeft: `3px solid ${f.color}` }}
                      />
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={async () => {
                const updates = confirmModal.editValues || {}
                const d = confirmModal.existingData
                const lb = parseFloat(updates.leads_bruts ?? d.leads_bruts ?? 0)
                const ind = parseFloat(updates.indispos ?? d.indispos ?? 0)
                const ech = parseFloat(updates.echanges ?? d.echanges ?? 0)
                const ne = parseFloat(updates.non_exploitables ?? d.non_exploitables ?? 0)
                await supabase.from('saisies').update({
                  leads_bruts: lb,
                  indispos: ind,
                  leads_nets: Math.max(0, lb - ind),
                  non_exploitables: ne,
                  echanges: Math.max(0, ech - ne),
                  rdv: parseFloat(updates.rdv ?? d.rdv ?? 0),
                  visites: parseFloat(updates.visites ?? d.visites ?? 0),
                  ventes: parseFloat(updates.ventes ?? d.ventes ?? 0),
                }).eq('id', d.id)
                // Sync CC → Marketing
                const { data: allSaisiesJ } = await supabase.from('saisies')
                  .select('leads_bruts, indispos')
                  .eq('date_debut', d.date_debut)
                  .eq('date_fin', d.date_fin)
                const totalL = (allSaisiesJ || []).reduce((s, x) => s + parseFloat(x.leads_bruts||0), 0)
                const totalI = (allSaisiesJ || []).reduce((s, x) => s + parseFloat(x.indispos||0), 0)
                const { data: mktL } = await supabase.from('marketing_saisies')
                  .select('id').eq('date_debut', d.date_debut).eq('date_fin', d.date_fin).maybeSingle()
                if (mktL) {
                  await supabase.from('marketing_saisies').update({ injections: totalL, indispos: totalI }).eq('id', mktL.id)
                } else {
                  await supabase.from('marketing_saisies').insert({
                    date: d.date_debut, date_debut: d.date_debut, date_fin: d.date_fin, type_saisie: 'jour',
                    injections: totalL, indispos: totalI, non_exploitables: 0, suivis: 0, rdv: 0, visites: 0, ventes: 0,
                  })
                }
                setConfirmModal(null)
                reload()
                setMsg({ type: 'success', text: 'Données mises à jour !' })
                setTimeout(() => setMsg(null), 3000)
              }} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                ✓ Enregistrer les modifications
              </button>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '12px 20px', borderRadius: 8, background: '#fff', color: '#5A5A5A', border: '1.5px solid rgba(201,168,76,0.25)', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      <PageHeader title="Call Center" subtitle={selected.label}>
        {/* Toggle Global / Détails */}
        {(isSuperAdmin || isConseillere) && (
          <div style={{ display: 'flex', gap: 4, background: '#F8F7F4', borderRadius: 20, padding: 3, border: '1px solid rgba(201,168,76,0.2)' }}>
            {[['global','Global CC'],['details','Détails CC']].map(([k,l]) => (
              <button key={k} onClick={() => setCcView(k)} style={{ padding: '5px 14px', borderRadius: 16, border: 'none', background: ccView===k?'#C9A84C':'transparent', color: ccView===k?'#fff':'#5A5A5A', fontSize: 12, fontWeight: ccView===k?500:400, cursor: 'pointer', transition: 'all 0.15s' }}>{l}</button>
            ))}
          </div>
        )}
        {isConseillere ? (
          <div style={{ padding: '6px 16px', borderRadius: 20, background: 'rgba(201,168,76,0.1)', border: '1.5px solid rgba(201,168,76,0.3)', fontSize: 13, fontWeight: 500, color: '#C9A84C' }}>
            {conseilleres.find(c => c.id === myConseillereId)?.nom || ''}
          </div>
        ) : (
          <ConseillereFilter conseilleres={conseilleres} value={filtreConseillere} onChange={setFiltreConseillere} />
        )}
        {isSuperAdmin && <button onClick={() => setShowSaisie(p => !p)} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C', background: showSaisie ? '#C9A84C' : '#fff', color: showSaisie ? '#fff' : '#C9A84C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showSaisie ? '✕ Fermer' : '+ Saisir données'}
        </button>}
        <button onClick={exportCC} style={{ padding: '8px 18px', borderRadius: 20, border: '1.5px solid #4CAF7D', background: '#fff', color: '#4CAF7D', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          ⬇ Export Excel
        </button>
      </PageHeader>

      {isSuperAdmin && showSaisie && ccView === 'global' && (
        <div style={{ ...cardStyle, borderColor: '#C9A84C' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['jour','Par jour'],['periode','Par période']].map(([k,l]) => (
              <button key={k} onClick={() => setSaisieMode(k)} style={{ padding: '7px 18px', borderRadius: 16, border: `1.5px solid ${saisieMode===k?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: saisieMode===k?'#C9A84C':'#fff', color: saisieMode===k?'#fff':'#5A5A5A', fontSize: 12, cursor: 'pointer', fontWeight: saisieMode===k?500:400 }}>{l}</button>
            ))}
          </div>
          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500, background: msg.type==='success'?'rgba(76,175,125,0.1)':'rgba(224,92,92,0.1)', color: msg.type==='success'?'#2d7a54':'#a03030' }}>{msg.text}</div>}
          <form onSubmit={checkAndSave}>
            <div style={{ display: 'grid', gridTemplateColumns: saisieMode==='jour'?'1fr 1fr':'1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Conseillère *</label>
                <select value={form.conseillere_id} onChange={e => setForm(p=>({...p,conseillere_id:e.target.value}))} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Sélectionner...</option>
                  {conseilleres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              {saisieMode==='jour' ? (
                <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inputStyle}/></div>
              ) : (
                <>
                  <div><label style={labelStyle}>Date début</label><input type="date" value={form.date_debut} onChange={e=>setForm(p=>({...p,date_debut:e.target.value}))} style={inputStyle}/></div>
                  <div><label style={labelStyle}>Date fin</label><input type="date" value={form.date_fin} onChange={e=>setForm(p=>({...p,date_fin:e.target.value}))} style={inputStyle}/></div>
                </>
              )}
            </div>
            {saisieMode === 'periode' && (
              <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.08)', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#8a6a1a' }}>
                Les chiffres seront répartis uniformément sur chaque jour de la période.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
              <div><label style={labelStyle}>Leads Bruts</label><input type="number" min="0" value={form.leads_bruts} onChange={e=>setForm(p=>({...p,leads_bruts:e.target.value}))} placeholder="ex: 120" style={inputStyle}/></div>
              <div><label style={labelStyle}>Indispos</label><input type="number" min="0" value={form.indispos} onChange={e=>setForm(p=>({...p,indispos:e.target.value}))} placeholder="ex: 20" style={inputStyle}/></div>
              <div><label style={labelStyle}>Leads Exploitables (auto)</label><input type="number" value={saisieMode==='jour'?leadsNetsForm:'—'} readOnly style={{ ...inputStyle, background: '#F7F0DC', borderColor: '#C9A84C', color: '#8a6a1a', fontWeight: 500 }}/></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
              <div><label style={labelStyle}>Échanges Bruts</label><input type="number" min="0" step="0.5" value={form.echanges} onChange={e=>setForm(p=>({...p,echanges:e.target.value}))} placeholder="0" style={inputStyle}/></div>
              <div><label style={labelStyle}>Non Expl. CC</label><input type="number" min="0" value={form.non_exploitables} onChange={e=>setForm(p=>({...p,non_exploitables:e.target.value}))} placeholder="0" style={inputStyle}/></div>
              <div><label style={labelStyle}>Échanges Nets (auto)</label><input type="number" value={echangesNetsForm} readOnly style={{ ...inputStyle, background: '#F7F0DC', borderColor: '#534AB7', color: '#534AB7', fontWeight: 500 }}/></div>
            </div>
            <div style={{ padding: '10px 14px', background: 'rgba(83,74,183,0.05)', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#534AB7', border: '1px solid rgba(83,74,183,0.15)' }}>
              ℹ️ RDV, Visites et Ventes sont automatiquement calculés depuis le <strong>Flux RDV</strong>
            </div>
            <button type="submit" disabled={saving} style={{ background: saving?'#E8D5A3':'#C9A84C', color:'#fff', border:'none', padding:'11px 28px', borderRadius:8, fontSize:13, fontWeight:500, cursor:saving?'wait':'pointer' }}>
              {saving?'Enregistrement...':'Enregistrer'}
            </button>
          </form>
        </div>
      )}

      {/* ── CONTENU GLOBAL CC ── */}
      {ccView === 'global' && <>
      <DrillNav data={saisies} onSelect={setSelected} selected={selected} />

      <SectionTitle>KPIs Globaux — {selected.label}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Productivité" value={kpisGlobal.productivite}
          sub={`${kpisGlobal.echanges || 0} échanges nets`}
          badge={`Obj: ${isConseillere
            ? (objectifsIndiv?.obj_echanges_nb > 0 ? objectifsIndiv.obj_echanges_nb : objParConseillere.obj_echanges_nb)
            : filtreConseillere !== 'all'
              ? (objectifsIndiv?.obj_echanges_nb > 0 ? objectifsIndiv.obj_echanges_nb : objParConseillere.obj_echanges_nb)
              : objectifs.obj_echanges_nb}`}
          objectifPct={objectifs.obj_productivite_pct} />
        <KpiCard label="Conv. Téléphonique" value={kpisGlobal.conversion_tel} sub="RDV / Échanges" badge={`CV: ${cvConvTel}%`} objectifPct={objectifs.obj_conv_tel_pct} objectifNb={objectifs.obj_conv_tel_nb} valeurNb={kpisGlobal.rdv} />
        <KpiCard label="Taux de Présence" value={kpisGlobal.taux_presence} sub="Visites / RDV" badge={`CV: ${cvPresence}%`} objectifPct={objectifs.obj_presence_pct} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Efficacité Commerciale" value={kpisGlobal.efficacite_comm} sub="Ventes / Visites" badge={`CV: ${cvEfficacite}%`} objectifPct={objectifs.obj_efficacite_pct} objectifNb={objectifs.obj_efficacite_nb} valeurNb={kpisGlobal.ventes} />
        <KpiCard label="Total RDV" value={kpisGlobal.rdv} unit="" sub="Période sélectionnée" objectifNb={filtreConseillere !== 'all' ? objParConseillere.obj_rdv_nb : objectifs.obj_rdv_nb} valeurNb={kpisGlobal.rdv} />
        <KpiCard label="Total Visites" value={kpisGlobal.visites} unit="" sub="Période sélectionnée" />
        <KpiCard label="Total Ventes" value={kpisGlobal.ventes} unit="" sub="Période sélectionnée" objectifNb={filtreConseillere !== 'all' ? objParConseillere.obj_ventes_nb : objectifs.obj_ventes_nb} valeurNb={kpisGlobal.ventes} />
      </div>

      {/* Toggle graphe/courbe + 3 graphiques */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6, background: '#F8F7F4', borderRadius: 20, padding: 3, border: '1px solid rgba(201,168,76,0.15)' }}>
          {[{ val: 'bar', label: '▬ Barres' }, { val: 'line', label: '〰 Courbes' }].map(opt => (
            <button key={opt.val} onClick={() => setChartType(opt.val)}
              style={{ padding: '5px 14px', borderRadius: 16, border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: chartType === opt.val ? '#C9A84C' : 'transparent',
                color: chartType === opt.val ? '#fff' : '#8A8A7A',
                transition: 'all 0.15s' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 28 }}>
        {[
          { title: 'Conv. Téléphonique', cv: cvConvTel, cvColor: '#C9A84C', dataKey: 'conv', color: '#C9A84C', label: 'Conv. Tél.' },
          { title: 'Taux de Présence',   cv: cvPresence,  cvColor: '#4CAF7D', dataKey: 'presence', color: '#4CAF7D', label: 'Présence' },
          { title: 'Efficacité Commerciale', cv: cvEfficacite, cvColor: '#534AB7', dataKey: 'efficacite', color: '#534AB7', label: 'Eff. Comm.' },
        ].map(cfg => (
          <div key={cfg.dataKey} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{cfg.title}</div>
              <div style={{ fontSize: 11, color: '#5A5A5A' }}>CV: <span style={{ color: cfg.cvColor, fontWeight: 500 }}>{cfg.cv}%</span></div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              {chartType === 'bar' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${cfg.color}15`} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, cfg.label]} />
                  <Bar dataKey={cfg.dataKey} fill={cfg.color} radius={[4,4,0,0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${cfg.color}15`} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, cfg.label]} />
                  <Line type="monotone" dataKey={cfg.dataKey} stroke={cfg.color} strokeWidth={2.5} dot={{ r: 4, fill: cfg.color }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>
          Ranking Conseillères <span style={{ fontSize: 11, color: '#5A5A5A', fontWeight: 400, fontFamily: 'DM Sans' }}>(Prod. 30% · Conv. 30% · Présence 30% · Eff. 10%)</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowRankCols(p=>!p)} style={{ padding: '6px 16px', borderRadius: 16, border: '1.5px solid rgba(201,168,76,0.3)', background: '#fff', color: '#C9A84C', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Colonnes ▾</button>
          {showRankCols && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: '12px', zIndex: 100, minWidth: 180, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Masquer / Afficher</div>
              {ALL_RANK_COLS.filter(c => !isConseillere || !c.hideForConseillere).map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 12, color: hiddenRankCols[c.key]?'#8A8A7A':'#2C2C2C' }}>
                  <input type="checkbox" checked={!hiddenRankCols[c.key]} onChange={() => setHiddenRankCols(p=>({...p,[c.key]:!p[c.key]}))} style={{ accentColor: '#C9A84C' }}/>
                  {c.label}
                </label>
              ))}
              <button onClick={() => setHiddenRankCols({})} style={{ marginTop: 8, width: '100%', padding: '5px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: '#C9A84C', fontSize: 11, cursor: 'pointer' }}>Tout afficher</button>
            </div>
          )}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Conseillère</th>
                {ALL_RANK_COLS.filter(col => !hiddenRankCols[col.key] && (!isConseillere || !col.hideForConseillere)).map(c => <th key={c.key} style={{...thStyle,color:c.color||'#5A5A5A'}}>{c.label}</th>)}
                <th style={thStyle}>Score</th>
                {!isConseillere && <th style={thStyle}>Détail</th>}
              </tr>
            </thead>
            <tbody>
              {rankingSorted.map((c,i) => {
                const rankColor = getRankColor(i, rankingSorted.length)
                const stars = getStars(i, rankingSorted.length)
                const score = parseFloat((Math.min(c.productivite,100)*0.3+c.conversion_tel*0.3+c.taux_presence*0.3+c.efficacite_comm*0.1).toFixed(1))
                const colValues = {
                  leads_bruts: { val: c.leads_bruts,  style: {...tdStyle, color:'#C9A84C', fontWeight:700, fontSize:13} },
                  indispos:    { val: c.indispos,     style: {...tdStyle, color:'#E05C5C', fontWeight:700, fontSize:13} },
                  leads_nets:  { val: c.leads_nets,   style: {...tdStyle, color:'#2E9455', fontWeight:700, fontSize:13} },
                  echanges: { val: c.echanges, style: tdStyle },
                  echanges_nettes: { val: c.echanges_exploitables, style: {...tdStyle, color: '#534AB7', fontWeight: 500} },
                  productivite: { val: `${c.productivite}%`, style: {...tdStyle,fontWeight:500,color:getColorFromObjectif(c.productivite,objectifs.obj_productivite_pct)} },
                  joignabilite: { val: `${c.joignabilite}%`, style: {...tdStyle,color:c.joignabilite<70?'#E05C5C':'#4CAF7D'} },
                  conv_tel: { val: null, isBar: true, value: c.conversion_tel, color: rankColor, objColor: getColorFromObjectif(c.conversion_tel,objectifs.obj_conv_tel_pct) },
                  rdv: { val: c.rdv, style: {...tdStyle,color:'#534AB7'} },
                  presence: { val: null, isBar: true, value: c.taux_presence, color: rankColor, objColor: getColorFromObjectif(c.taux_presence,objectifs.obj_presence_pct) },
                  visites: { val: c.visites, style: {...tdStyle,color:'#4CAF7D'} },
                  efficacite_comm: { val: `${c.efficacite_comm}%`, style: tdStyle },
                  ventes: { val: c.ventes, style: {...tdStyle,color:'#1a6b3c'} },
                }
                return (
                  <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{...tdStyle,fontSize:16,fontWeight:700,color:rankColor}}>{i+1}</td>
                    <td style={{...tdStyle,fontWeight:500,color:rankColor,fontSize:12}}>{c.nom}</td>
                    {ALL_RANK_COLS.filter(col => !hiddenRankCols[col.key] && (!isConseillere || !col.hideForConseillere)).map(col => {
                      const cv = colValues[col.key]
                      if (!cv) return <td key={col.key} style={tdStyle}>—</td>
                      if (cv.isBar) return (
                        <td key={col.key} style={{...tdStyle,minWidth:110}}>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <div style={{flex:1,height:8,background:'rgba(201,168,76,0.15)',borderRadius:4,overflow:'hidden',minWidth:50}}>
                              <div style={{height:'100%',width:`${Math.min(cv.value,100)}%`,background:cv.color,borderRadius:4}}></div>
                            </div>
                            <span style={{fontSize:11,fontWeight:600,minWidth:36,color:cv.objColor}}>{cv.value}%</span>
                          </div>
                        </td>
                      )
                      return <td key={col.key} style={cv.style}>{cv.val}</td>
                    })}
                    <td style={{...tdStyle,fontWeight:600,color:rankColor,fontSize:13}}>{score}%</td>
                    {!isConseillere && <td style={tdStyle}>
                      <button onClick={()=>setDrillConseillere(drillConseillere===c.id?null:c.id)} style={{padding:'4px 10px',borderRadius:8,border:'1px solid rgba(201,168,76,0.3)',background:drillConseillere===c.id?'#C9A84C':'transparent',color:drillConseillere===c.id?'#fff':'#C9A84C',fontSize:11,cursor:'pointer'}}>
                        {drillConseillere===c.id?'Fermer':'Détail ↗'}
                      </button>
                    </td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drillConseillere && (() => {
        const c = conseilleres.find(c=>c.id===drillConseillere)
        const data = saisiesFiltrees.filter(s=>s.conseillere_id===drillConseillere)
        const groups = groupFn(data)
        const items = Object.entries(groups).sort(([a],[b])=>b.localeCompare(a)).map(([key,items])=>({ label:formatGroupLabel(key,periodeForLabel), ...agregerParPeriode(items) }))
        const kpis = agregerParPeriode(data)
        return (
          <>
            <SectionTitle>Drill-down : {c?.nom}</SectionTitle>
            <div style={cardStyle}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
                {[{label:'Conv. Tél.',val:kpis.conversion_tel},{label:'Présence',val:kpis.taux_presence},{label:'Productivité',val:kpis.productivite},{label:'Eff. Comm.',val:kpis.efficacite_comm}].map(k => (
                  <div key={k.label} style={{background:'#F8F7F4',borderRadius:10,padding:'14px 16px'}}>
                    <div style={{fontSize:10,color:'#5A5A5A',textTransform:'uppercase',marginBottom:6}}>{k.label}</div>
                    <div style={{fontSize:26,fontWeight:600}}>{k.val}%</div>
                  </div>
                ))}
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Période','Leads Bruts','Leads Exploitables','Échanges','RDV','Visites','Ventes','Productivité','Conv. Tél.','Présence','Eff. Comm.'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>
                    {items.map((row,i) => (
                      <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{...tdStyle,fontWeight:500,color:'#C9A84C'}}>{row.label}</td>
                        <td style={tdStyle}>{row.leads_bruts}</td>
                        <td style={tdStyle}>{row.leads_nets}</td>
                        <td style={tdStyle}>{row.echanges}</td>
                        <td style={tdStyle}>{row.rdv}</td>
                        <td style={tdStyle}>{row.visites}</td>
                        <td style={tdStyle}>{row.ventes}</td>
                        <td style={{...tdStyle,fontWeight:500}}>{row.productivite}%</td>
                        <td style={{...tdStyle,color:'#C9A84C',fontWeight:500}}>{row.conversion_tel}%</td>
                        <td style={{...tdStyle,color:'#4CAF7D'}}>{row.taux_presence}%</td>
                        <td style={{...tdStyle,color:'#534AB7'}}>{row.efficacite_comm}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      })()}

      {/* Détail par période — replié par défaut pour tous */}
      <div style={{ marginBottom: showDetail ? 16 : 0, marginTop: 8 }}>
        <div onClick={() => setShowDetail(p => !p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', display: 'flex', alignItems: 'center', gap: 12 }}>
            Détail par période
            <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,0.2)', width: 200 }}></div>
          </div>
          <span style={{ fontSize: 12, color: '#C9A84C' }}>{showDetail ? '▲ Fermer' : '▼ Ouvrir'}</span>
        </div>
      </div>
      {showDetail && <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>{['Période','Leads Bruts','Leads Exploitables','Indispos','Échanges','RDV','Visites','Ventes','Productivité','Conv. Tél.','CV Conv.','Présence','CV Prés.','Eff. Comm.','CV Eff.'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(isConseillere ? tableData.filter((_, i) => {
                // Pour les conseillères : garder seulement les lignes mensuelles (pas jour/semaine)
                const label = tableData[i]?.label || ''
                return label.length <= 8 // ex: "avr. 26" = 7 chars, "janv. 26" = 8 chars
              }) : tableData).map((row,i) => (
                <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='#F7F0DC'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{...tdStyle,fontWeight:500,color:'#C9A84C'}}>{row.label}</td>
                  <td style={tdStyle}>{row.leads_bruts}</td>
                  <td style={tdStyle}>{row.leads_nets}</td>
                  <td style={{...tdStyle,color:'#E05C5C'}}>{row.indispos}</td>
                  <td style={tdStyle}>{row.echanges}</td>
                  <td style={tdStyle}>{row.rdv}</td>
                  <td style={tdStyle}>{row.visites}</td>
                  <td style={tdStyle}>{row.ventes}</td>
                  <td style={{...tdStyle,fontWeight:500,color:getColorFromObjectif(row.productivite,objectifs.obj_productivite_pct)}}>{row.productivite}%</td>
                  <td style={{...tdStyle,fontWeight:500,color:getColorFromObjectif(row.conversion_tel,objectifs.obj_conv_tel_pct)}}>{row.conversion_tel}%</td>
                  <td style={{...tdStyle,color:'#8a6a1a',fontSize:10}}>{row.cv_conv}%</td>
                  <td style={{...tdStyle,color:getColorFromObjectif(row.taux_presence,objectifs.obj_presence_pct)}}>{row.taux_presence}%</td>
                  <td style={{...tdStyle,color:'#2d7a54',fontSize:10}}>{row.cv_presence}%</td>
                  <td style={{...tdStyle,color:getColorFromObjectif(row.efficacite_comm,objectifs.obj_efficacite_pct)}}>{row.efficacite_comm}%</td>
                  <td style={{...tdStyle,color:'#3a3480',fontSize:10}}>{row.cv_efficacite}%</td>
                </tr>
              ))}
              {tableData.length===0 && <tr><td colSpan={15} style={{textAlign:'center',padding:'32px',color:'#5A5A5A',fontSize:13}}>Aucune donnée pour la période sélectionnée</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}

      {isSuperAdmin && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistorique ? 16 : 0, marginTop: 8 }}>
        <div onClick={() => setShowHistorique(p=>!p)} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: '#2C2C2C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          Historique des saisies
          <span style={{ fontSize: 12, color: '#C9A84C', fontFamily: 'DM Sans' }}>{showHistorique ? '▲ Fermer' : '▼ Ouvrir'}</span>
        </div>
        {selectedRows.size > 0 && (
          <button onClick={async () => {
            if (!window.confirm(`Supprimer ${selectedRows.size} saisie(s) ?`)) return
            // Recuperer les saisies avant suppression pour sync marketing
            const { data: saisiesASuppr } = await supabase.from('saisies').select('*').in('id', [...selectedRows])
            await supabase.from('saisies').delete().in('id', [...selectedRows])
            // Sync indispos vers marketing
            for (const s of (saisiesASuppr || [])) {
              const { data: mkt } = await supabase.from('marketing_saisies')
                .select('id').eq('conseillere_id', s.conseillere_id)
                .gte('date_debut', s.date_debut)
                .lte('date_debut', s.date_fin || s.date_debut)
                .maybeSingle()
              if (mkt) await supabase.from('marketing_saisies').update({ indispos: 0 }).eq('id', mkt.id)
            }
            setSelectedRows(new Set())
            reload()
          }} style={{ padding: '7px 16px', borderRadius: 8, background: '#E05C5C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            Supprimer la sélection ({selectedRows.size})
          </button>
        )}
      </div>}
      {isSuperAdmin && showHistorique && <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>
                  <input type="checkbox" checked={selectedRows.size === saisies.slice(0,30).length && saisies.length > 0}
                    onChange={e => setSelectedRows(e.target.checked ? new Set(saisies.slice(0,30).map(s=>s.id)) : new Set())}
                    style={{ accentColor: '#C9A84C' }}/>
                </th>
                {['Période','Conseillère','Leads Bruts','Indispos','Leads Exploitables','Échanges','RDV','Visites','Ventes','Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...saisies].slice(0, 30).map(s => {
                const c = conseilleres.find(c => c.id === s.conseillere_id)
                const periode = s.date_debut && s.date_fin && s.date_debut !== s.date_fin
                  ? `${s.date_debut.substring(8)}/${s.date_debut.substring(5,7)} → ${s.date_fin.substring(8)}/${s.date_fin.substring(5,7)}`
                  : (s.date_debut || s.date)
                const isSelected = selectedRows.has(s.id)
                return (
                  <tr key={s.id} style={{ background: isSelected ? '#F7F0DC' : 'transparent' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F7F0DC' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={isSelected}
                        onChange={e => {
                          const next = new Set(selectedRows)
                          e.target.checked ? next.add(s.id) : next.delete(s.id)
                          setSelectedRows(next)
                        }} style={{ accentColor: '#C9A84C' }}/>
                    </td>
                    <td style={{...tdStyle,fontWeight:500,color:'#C9A84C',whiteSpace:'nowrap'}}>{periode}</td>
                    <td style={{...tdStyle,fontWeight:500}}>{c?.nom || '—'}</td>
                    <td style={tdStyle}>{s.leads_bruts}</td>
                    <td style={{...tdStyle,color:'#E05C5C'}}>{s.indispos}</td>
                    <td style={{...tdStyle,color:'#C9A84C',fontWeight:500}}>{s.leads_nets}</td>
                    <td style={tdStyle}>{s.echanges}</td>
                    <td style={tdStyle}>{s.rdv}</td>
                    <td style={tdStyle}>{s.visites}</td>
                    <td style={tdStyle}>{s.ventes}</td>
                    <td style={{...tdStyle,minWidth:160}}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => annulerMiseAJour(s.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', background: 'transparent', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>↩ Annuler MàJ</button>
                        <button onClick={() => supprimerSaisie(s.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Suppr.</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {saisies.length === 0 && <tr><td colSpan={11} style={{textAlign:'center',padding:'32px',color:'#5A5A5A',fontSize:13}}>Aucune saisie</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}
      </> /* fin ccView === 'global' */}

      {/* DrillNav toujours visible */}
      {ccView === 'details' && <DrillNav data={saisies} onSelect={setSelected} selected={selected} />}

      {/* ── VUE DÉTAILS CC ── */}
      {(isSuperAdmin || isConseillere) && ccView === 'details' && (() => {
        if (loadingDetails) return <div style={{ padding: 32, textAlign: 'center', color: '#8A8A7A' }}>Chargement détails...</div>

        // Filtrer flux par période sélectionnée
        const fluxFiltres = filterBySelected(fluxDetails, selected, 'date_debut')

        // ── Taux de présence par région (calculé depuis flux_rdv filtré) ──
        const statsByEquipe = { sale: { rdv: 0, visites: 0 }, kenitra: { rdv: 0, visites: 0 } }
        fluxFiltres.forEach(f => {
          const comm = commerciaux.find(c => c.id === f.commercial_id)
          const eq = comm?.equipe
          if (eq !== 'sale' && eq !== 'kenitra') return
          const vis = parseFloat(f.visites || 0)
          const ven = parseFloat(f.ventes  || 0)
          statsByEquipe[eq].visites += vis + ven
          statsByEquipe[eq].rdv     += parseFloat(f.rdv || 0) + vis + ven
        })
        // Taux présence = visites / rdv (si rdv = 0 → utiliser 20% par défaut)
        const tauxPresence = {
          sale:    statsByEquipe.sale.rdv    > 0 ? statsByEquipe.sale.visites    / statsByEquipe.sale.rdv    : 0.2,
          kenitra: statsByEquipe.kenitra.rdv > 0 ? statsByEquipe.kenitra.visites / statsByEquipe.kenitra.rdv : 0.2,
        }
        // RDV nécessaires pour 1 visite = 1 / taux_presence
        const rdvParVisite = {
          sale:    tauxPresence.sale    > 0 ? Math.round(1 / tauxPresence.sale)    : 5,
          kenitra: tauxPresence.kenitra > 0 ? Math.round(1 / tauxPresence.kenitra) : 5,
        }

        // ── Totaux visites par conseillère × commercial ──
        const totaux = {}
        fluxFiltres.forEach(f => {
          if (!f.conseillere_id || !f.commercial_id) return
          const vis = parseFloat(f.visites || 0)
          const ven = parseFloat(f.ventes  || 0)
          const visTotal = vis + ven
          if (!totaux[f.conseillere_id]) totaux[f.conseillere_id] = {}
          totaux[f.conseillere_id][f.commercial_id] = (totaux[f.conseillere_id][f.commercial_id] || 0) + visTotal
        })

        // ── Total visites par commercial ──
        const visParComm = {}
        fluxFiltres.forEach(f => {
          if (!f.commercial_id) return
          const vis = parseFloat(f.visites || 0)
          const ven = parseFloat(f.ventes  || 0)
          visParComm[f.commercial_id] = (visParComm[f.commercial_id] || 0) + (vis + ven)
        })

        // ── NR par équipe par conseillère ──
        const nrTotaux = {}
        fluxFiltres.filter(f => !f.commercial_id).forEach(f => {
          if (!f.conseillere_id) return
          const vis = parseFloat(f.visites || 0)
          const ven = parseFloat(f.ventes  || 0)
          const visTotal = vis + ven
          const commNR = commerciaux.find(c => c.id === f.commercial_id)
          const eq = commNR?.equipe || 'sale'
          if (!nrTotaux[f.conseillere_id]) nrTotaux[f.conseillere_id] = { sale: 0, kenitra: 0 }
          nrTotaux[f.conseillere_id][eq] = (nrTotaux[f.conseillere_id][eq] || 0) + visTotal
        })

        const commsSale    = commerciaux.filter(c => c.equipe === 'sale'    && !c.nom.includes('Non reconnu'))
        const commsKenitra = commerciaux.filter(c => c.equipe === 'kenitra' && !c.nom.includes('Non reconnu'))

        // ── Calcul RDV nécessaires par commercial ──
        // Part par conseillère : Hala + Siham = 1 part (0.5 chacune), les 4 autres = 1 part chacune → total 5 parts
        // IDs Hala et Siham
        const HALA_NOM  = 'Hala'
        const SIHAM_NOM = 'Siham'
        function getPartConseillere(c) {
          const nom = c.nom.toUpperCase()
          if (nom.includes('HALA') || nom.includes('SIHAM')) return 0.5
          return 1
        }
        const totalParts = conseilleres.reduce((s, c) => s + getPartConseillere(c), 0) // = 5

        function calcRdvNecessaires(commId, equipe) {
          if (!seuilVisites[equipe] || seuilVisites[equipe] <= 0) return null
          const visActuelles = Math.round(visParComm[commId] || 0)
          const manque = seuilVisites[equipe] - visActuelles
          if (manque <= 0) return null
          const rdvTotal = manque * rdvParVisite[equipe]
          return { manque, rdvTotal, rdvParVisite: rdvParVisite[equipe] }
        }

        function getRdvPourConseillere(commId, equipe, conseillere) {
          const calc = calcRdvNecessaires(commId, equipe)
          if (!calc) return null
          const part = getPartConseillere(conseillere)
          return Math.ceil((calc.rdvTotal / totalParts) * part)
        }

        // ── Fonction rendu liste commerciaux dans une carte ──
        function renderEquipeInCard(comms, equipe, consId, equipeColor) {
          const nrVal = Math.round(nrTotaux[consId]?.[equipe] || 0)
          return (
            <div style={{ marginBottom: 8 }}>
              {/* Header équipe */}
              <div style={{ fontSize: 10, fontWeight: 700, color: equipeColor, textTransform: 'uppercase', letterSpacing: 0.5, padding: '5px 0 4px', borderBottom: `1px solid ${equipeColor}20`, marginBottom: 4 }}>
                {equipe === 'sale' ? 'Équipe Sale' : 'Équipe Kenitra'}
              </div>
              {/* Commerciaux */}
              {comms.map(comm => {
                const val = Math.round(totaux[consId]?.[comm.id] || 0)
                const rdvNec = calc => calc ? getRdvPourConseillere(comm.id, equipe, conseilleresFiltrees.find(c => c.id === consId)) : null
                const calcResult = calcRdvNecessaires(comm.id, equipe)
                const rdv = calcResult ? getRdvPourConseillere(comm.id, equipe, conseilleres.find(c => c.id === consId)) : null
                return (
                  <div key={comm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 0', borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
                    <div style={{ fontSize: 11, color: '#2C2C2C', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comm.nom}</div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 6 }}>
                      <div style={{ fontWeight: 700, color: val > 0 ? equipeColor : '#8A8A7A', fontSize: 12 }}>{val}</div>
                      {rdv !== null && <div style={{ fontSize: 9, color: '#E07B30' }}>📅 {rdv} RDV</div>}
                    </div>
                  </div>
                )
              })}
              {/* NR */}
              {nrVal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px dashed rgba(224,92,92,0.2)', marginTop: 2 }}>
                  <div style={{ fontSize: 10, color: '#E05C5C', fontStyle: 'italic' }}>⚠️ Non reconnu</div>
                  <div style={{ fontWeight: 700, color: '#E05C5C', fontSize: 11 }}>{nrVal}</div>
                </div>
              )}
            </div>
          )
        }

        return (
          <div style={{ marginTop: 8 }}>
            {/* ── Saisie seuils (admin) ou info seuils (conseillère) ── */}
            {isSuperAdmin ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(201,168,76,0.2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2C' }}>Seuil visites/mois</div>
              {['sale', 'kenitra'].map(eq => (
                <div key={eq} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: eq === 'sale' ? '#C9A84C' : '#534AB7', fontWeight: 500 }}>{eq === 'sale' ? 'Sale' : 'Kenitra'}</span>
                  <input type="number" min="0" value={seuilVisites[eq] || ''}
                    onChange={e => setSeuilVisites(p => ({ ...p, [eq]: parseInt(e.target.value) || 0 }))}
                    onBlur={e => {
                      const moisKey = selected?.type === 'month' ? selected.value : null
                      if (moisKey) saveSeuil(eq, parseInt(e.target.value) || 0, moisKey)
                    }}
                    placeholder="ex: 20"
                    style={{ width: 60, padding: '4px 8px', border: `1.5px solid ${eq === 'sale' ? 'rgba(201,168,76,0.3)' : 'rgba(83,74,183,0.3)'}`, borderRadius: 6, fontSize: 12, textAlign: 'center', outline: 'none' }} />
                  {savingSeuilEq === eq && <span style={{ fontSize: 9, color: '#8A8A7A' }}>...</span>}
                  {savingSeuilEq !== eq && seuilVisites[eq] > 0 && (
                    <span style={{ fontSize: 9, color: '#2E9455' }}>✓</span>
                  )}
                  <span style={{ fontSize: 11, color: '#8A8A7A' }}>vis. · <strong style={{ color: eq === 'sale' ? '#C9A84C' : '#534AB7' }}>{Math.round(tauxPresence[eq]*100)}%</strong> présence → <strong>{rdvParVisite[eq]} RDV/vis.</strong></span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: '#8A8A7A', marginLeft: 'auto', fontStyle: 'italic' }}>
                Hala + Siham = ½ objectif · 4 autres = 1 objectif
              </div>
            </div>
            ) : (
            <div style={{ background: 'rgba(201,168,76,0.06)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {['sale', 'kenitra'].map(eq => seuilVisites[eq] > 0 && (
                <div key={eq} style={{ fontSize: 12, color: '#5A5A5A' }}>
                  <strong style={{ color: eq === 'sale' ? '#C9A84C' : '#534AB7' }}>{eq === 'sale' ? 'Sale' : 'Kenitra'}</strong>
                  {' · '}{seuilVisites[eq]} vis. objectif · {Math.round(tauxPresence[eq]*100)}% présence → <strong>{rdvParVisite[eq]} RDV/visite</strong>
                </div>
              ))}
            </div>
            )}

            {/* ── 6 cartes conseillères (ou 1 seule si conseillère connectée) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isConseillere ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
              {conseilleres
                .filter(cons => !isConseillere || cons.id === myConseillereId)
                .map(cons => {
                const isHalaOrSiham = cons.nom.toUpperCase().includes('HALA') || cons.nom.toUpperCase().includes('SIHAM')
                const totalVis = Math.round(Object.values(totaux[cons.id] || {}).reduce((s,v) => s+v, 0) + (nrTotaux[cons.id]?.sale||0) + (nrTotaux[cons.id]?.kenitra||0))
                return (
                  <div key={cons.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #C9A84C', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    {/* Header conseillère */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                      <div>
                        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, fontWeight: 600, color: '#C9A84C' }}>{cons.nom.split(' ')[0]}</div>
                        <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 1 }}>{cons.nom}</div>
                        {isHalaOrSiham && <div style={{ fontSize: 9, color: '#534AB7', marginTop: 2 }}>½ objectif partagé</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#C9A84C' }}>{totalVis}</div>
                        <div style={{ fontSize: 9, color: '#8A8A7A' }}>Total visites</div>
                      </div>
                    </div>
                    {/* Équipe Sale */}
                    {renderEquipeInCard(commsSale, 'sale', cons.id, '#C9A84C')}
                    {/* Équipe Kenitra */}
                    {renderEquipeInCard(commsKenitra, 'kenitra', cons.id, '#534AB7')}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

    </div>
  )
}