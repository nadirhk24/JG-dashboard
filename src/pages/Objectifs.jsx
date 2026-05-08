import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAbsences } from '../lib/useAbsences'
import PageHeader from '../components/PageHeader'

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function getMoisOptions() {
  const now = new Date()
  const options = []
  for (let i = -3; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
    const label = `${MOIS_LABELS[d.getMonth()]} ${d.getFullYear()}`
    options.push({ val, label })
  }
  return options
}

async function getJoursOuvrables(mois, calendrier) {
  const [year, month] = mois.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const nonOuvrables = new Set(calendrier.filter(j => j.type === 'ferie' || j.type === 'conge').map(j => j.date))
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0) continue
    if (!nonOuvrables.has(dateStr)) count++
  }
  return count
}

// Calcule les jours de présence = jours ouvrables - absences conseillère
async function getJoursPresence(mois, calendrier, conseillereId) {
  const [year, month] = mois.split('-').map(Number)
  const dateDebut = `${year}-${String(month).padStart(2,'0')}-01`
  const dateFin = `${year}-${String(month).padStart(2,'0')}-${String(new Date(year, month, 0).getDate()).padStart(2,'0')}`
  const daysInMonth = new Date(year, month, 0).getDate()
  const nonOuvrables = new Set(calendrier.filter(j => j.type === 'ferie' || j.type === 'conge').map(j => j.date))

  // Charger les absences de cette conseillère sur ce mois
  let absencesSet = new Set()
  if (conseillereId && conseillereId !== 'equipe') {
    const { data: abs } = await supabase
      .from('absences_conseilleres')
      .select('*')
      .eq('conseillere_id', conseillereId)
      .lte('date_debut', dateFin)
      .gte('date_fin', dateDebut)
    for (const a of (abs || [])) {
      const start = new Date(Math.max(new Date(a.date_debut), new Date(dateDebut)))
      const end = new Date(Math.min(new Date(a.date_fin), new Date(dateFin)))
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        absencesSet.add(d.toISOString().split('T')[0])
      }
    }
  }

  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dateStr = date.toISOString().split('T')[0]
    if (date.getDay() === 0) continue // Dimanche
    if (nonOuvrables.has(dateStr)) continue // Férié/Congé équipe
    if (absencesSet.has(dateStr)) continue // Absence individuelle
    count++
  }
  return count
}

const KPI_FIELDS = [
  { key: 'productivite', label: 'Productivité', sub: 'Nb échanges', pctKey: 'obj_productivite_pct', nbKey: 'obj_echanges_nb', jourKey: 'obj_echanges_jour', color: '#378ADD' },
  { key: 'conv_tel', label: 'Conv. Téléphonique', sub: 'Nb RDV', pctKey: 'obj_conv_tel_pct', nbKey: 'obj_rdv_nb', jourKey: 'obj_rdv_jour', color: '#C9A84C' },
  { key: 'presence', label: 'Taux de Présence', sub: 'Nb visites', pctKey: 'obj_presence_pct', nbKey: 'obj_visites_nb', jourKey: 'obj_visites_jour', color: '#4CAF7D' },
  { key: 'efficacite', label: 'Efficacité Commerciale', sub: 'Nb ventes', pctKey: 'obj_efficacite_pct', nbKey: 'obj_ventes_nb', jourKey: 'obj_ventes_jour', color: '#534AB7' },
]


// ── Rythme réel/mois par projet (données avril 2026) ─────────────────────────
const RYTHME_REEL = {
  'RIAD EL KHEIR I':           { stock: 150, rythme: 5.2 },
  'La Cascade':                { stock: 235, rythme: 9.2 },
  'La Capitale':               { stock: 329, rythme: 7.0 },
  'RESIDENCE LA DEFENSE':      { stock: 112, rythme: 4.5 },
  'JIRARI MALL':               { stock: 77,  rythme: 0.5 },
  'Résidence Marina Square':   { stock: 26,  rythme: 4.8 },
  'Résidence Cleopatra':       { stock: 16,  rythme: 2.2 },
  'RESIDENCE EL JIRARI PRESTIGE': { stock: 19, rythme: 0.8 },
}

function SectionVentesDelais() {
  const TYPES_BIENS = ['Appartement', 'Bureau', 'Magasin', 'Boutique']
  const REGIONS = ['Kenitra', 'Sale']

  const emptyProjet = {
    nom_projet: '', commerciaux: '', region: 'Kenitra', delai_mois: 4,
    tx_vente: 30, tx_presence: 20, tx_conv_tel: 35, tx_joignabilite: 78,
    biens: [{ type_bien: '', stock: 0 }]
  }

  const [projets, setProjets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProjet, setEditProjet] = useState(null)
  const [showMethodo, setShowMethodo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [form, setForm] = useState(emptyProjet)
  // Expand/collapse state
  const [expandedRegions, setExpandedRegions] = useState({})
  const [expandedProjets, setExpandedProjets] = useState({})
  const [globalExpanded, setGlobalExpanded] = useState(false)

  useEffect(() => { loadProjets() }, [])

  async function loadProjets() {
    setLoading(true)
    const { data: ps } = await supabase
      .from('objectifs_vente_projets')
      .select('*')
      .order('region')
      .order('nom_projet')
    const result = []
    for (const p of (ps || [])) {
      const { data: biens } = await supabase
        .from('objectifs_vente_biens')
        .select('*')
        .eq('projet_id', p.id)
        .order('created_at')
      result.push({ ...p, biens: biens || [] })
    }
    setProjets(result)
    setLoading(false)
  }

  function calcFunnel(stock, delai_mois, tx_vente, tx_presence, tx_conv_tel, tx_joignabilite) {
    const tv = parseFloat(tx_vente) / 100
    const tp = parseFloat(tx_presence) / 100
    const tc = parseFloat(tx_conv_tel) / 100
    const tj = parseFloat(tx_joignabilite) / 100
    const s = parseInt(stock) || 0
    const d = parseInt(delai_mois) || 1
    if (!s || !tv || !tp || !tc || !tj) return {}
    const obj_mois = Math.round(s / d)
    const obj_semaine = Math.round(obj_mois / 4)
    const liquide_avant = (obj_mois * d) > s
    const mois_reel = +(s / obj_mois).toFixed(1)
    const visites = Math.ceil(obj_mois / tv)
    const rdv = Math.ceil(visites / tp)
    const echanges = Math.ceil(rdv / tc)
    const leads = Math.ceil(echanges / tj)
    return { obj_mois, obj_semaine, visites, rdv, echanges, leads, liquide_avant, mois_reel }
  }

  // Calcul totaux pour une liste de projets
  function calcTotauxProjets(liste) {
    let stock = 0, obj_mois = 0, obj_sem = 0, visites = 0, rdv = 0, echanges = 0, leads = 0
    for (const p of liste) {
      const totalStock = p.biens.reduce((s, b) => s + (parseInt(b.stock) || 0), 0)
      const f = calcFunnel(totalStock, p.delai_mois, p.tx_vente, p.tx_presence, p.tx_conv_tel, p.tx_joignabilite)
      stock += totalStock
      obj_mois += f.obj_mois || 0
      obj_sem += f.obj_semaine || 0
      visites += f.visites || 0
      rdv += f.rdv || 0
      echanges += f.echanges || 0
      leads += f.leads || 0
    }
    return { stock, obj_mois, obj_sem, visites, rdv, echanges, leads }
  }

  async function handleSave() {
    if (!form.nom_projet.trim()) return setMsg({ type: 'error', text: 'Nom du projet requis' })
    setSaving(true)
    const payload = {
      nom_projet: form.nom_projet, commerciaux: form.commerciaux,
      region: form.region || 'Kenitra', delai_mois: parseInt(form.delai_mois) || 1,
      tx_vente: parseFloat(form.tx_vente) || 0, tx_presence: parseFloat(form.tx_presence) || 0,
      tx_conv_tel: parseFloat(form.tx_conv_tel) || 0, tx_joignabilite: parseFloat(form.tx_joignabilite) || 0,
      updated_at: new Date().toISOString()
    }
    let projetId
    if (editProjet) {
      await supabase.from('objectifs_vente_projets').update(payload).eq('id', editProjet.id)
      projetId = editProjet.id
      await supabase.from('objectifs_vente_biens').delete().eq('projet_id', projetId)
    } else {
      const { data } = await supabase.from('objectifs_vente_projets').insert(payload).select().single()
      projetId = data.id
    }
    const biens = form.biens.filter(b => b.type_bien.trim() && parseInt(b.stock) > 0)
    if (biens.length > 0) {
      await supabase.from('objectifs_vente_biens').insert(
        biens.map(b => ({ projet_id: projetId, type_bien: b.type_bien, stock: parseInt(b.stock) || 0 }))
      )
    }
    setSaving(false)
    setMsg({ type: 'success', text: editProjet ? 'Projet mis à jour !' : 'Projet créé !' })
    setShowForm(false); setEditProjet(null); setForm(emptyProjet)
    loadProjets()
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce projet ?')) return
    await supabase.from('objectifs_vente_projets').delete().eq('id', id)
    loadProjets()
  }

  function openEdit(p) {
    setForm({ ...p, biens: p.biens.length > 0 ? p.biens : [{ type_bien: '', stock: 0 }] })
    setEditProjet(p)
    setShowForm(true)
    // Scroll vers le formulaire en haut
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }

  function addBien() { setForm(p => ({ ...p, biens: [...p.biens, { type_bien: '', stock: 0 }] })) }
  function removeBien(i) { setForm(p => ({ ...p, biens: p.biens.filter((_, idx) => idx !== i) })) }
  function updateBien(i, key, val) { setForm(p => ({ ...p, biens: p.biens.map((b, idx) => idx === i ? { ...b, [key]: val } : b) })) }

  function toggleRegion(region) {
    setExpandedRegions(prev => ({ ...prev, [region]: !prev[region] }))
  }
  function toggleProjet(id) {
    setExpandedProjets(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const sty = {
    card: { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 12 },
    label: { fontSize: 11, color: '#8A8A7A', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none', boxSizing: 'border-box' },
    th: { fontSize: 11, color: '#5A5A5A', fontWeight: 500, padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', textAlign: 'center', background: '#FAFAF8' },
    td: { padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', fontSize: 13, color: '#2C2C2C', textAlign: 'center' },
    btn: (bg, col) => ({ background: bg, color: col, border: 'none', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }),
  }

  // Composant Carte Totaux (réutilisable)
  function CarteTotaux({ totaux, color = '#C9A84C', size = 'md' }) {
    const fs = size === 'lg' ? 28 : size === 'md' ? 22 : 16
    const items = [
      { label: 'Stock', val: totaux.stock, color: '#2C2C2C' },
      { label: 'Obj/mois', val: totaux.obj_mois, color },
      { label: 'Obj/sem.', val: totaux.obj_sem, color },
      { label: 'Visites/mois', val: totaux.visites, color: '#534AB7' },
      { label: 'RDV/mois', val: totaux.rdv, color: '#4CAF7D' },
      { label: 'Échanges/mois', val: totaux.echanges, color },
      { label: 'Leads/mois', val: totaux.leads, color: '#E8A040' },
    ]
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        {items.map(k => (
          <div key={k.label} style={{ textAlign: 'center', flex: 1, minWidth: 60 }}>
            <div style={{ fontSize: fs, fontWeight: 800, color: k.color }}>{k.val || '—'}</div>
            <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div style={{ textAlign: 'center', color: '#8A8A7A', padding: 40 }}>Chargement...</div>

  const totauxGlobaux = calcTotauxProjets(projets)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C' }}>Objectifs Ventes / Délais</div>
          <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 3 }}>{projets.length} projets · {totauxGlobaux.stock} unités au total</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowMethodo(!showMethodo)}
            style={{ ...sty.btn('rgba(55,138,221,0.08)', '#378ADD'), border: '1px solid rgba(55,138,221,0.15)' }}>
            Méthodologie
          </button>
          <button onClick={() => { setForm(emptyProjet); setEditProjet(null); setShowForm(true) }}
            style={sty.btn('#C9A84C', '#fff')}>
            + Nouveau projet
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500,
          background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)',
          color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>
          {msg.text}
        </div>
      )}

      {/* TAUX GLOBAUX - 1 FOIS EN HAUT */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 20px', border: '1px solid rgba(201,168,76,0.15)', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Taux commerciaux appliqués
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Tx Vente', val: '30%', color: '#534AB7', hint: 'Ventes / Visites' },
            { label: 'Tx Présence', val: '20%', color: '#4CAF7D', hint: 'Visites / RDV' },
            { label: 'Conv. Tél', val: '35%', color: '#C9A84C', hint: 'RDV / Échanges' },
            { label: 'Joignabilité', val: '78%', color: '#378ADD', hint: 'Échanges / Leads' },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: `${k.color}08`, borderRadius: 8, border: `1px solid ${k.color}20` }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#5A5A5A', marginTop: 2 }}>{k.label}</div>
              <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 1 }}>{k.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Note Méthodologique */}
      {showMethodo && (
        <div style={{ background: 'rgba(55,138,221,0.04)', border: '1px solid rgba(55,138,221,0.15)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#378ADD', marginBottom: 12 }}>Méthodologie — Funnel inversé</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { step: 'Leads bruts', formula: '= Échanges ÷ Joignabilité', color: '#E8A040' },
              { step: 'Échanges', formula: '= RDV ÷ Conv. Tél', color: '#378ADD' },
              { step: 'RDV', formula: '= Visites ÷ Tx Présence', color: '#4CAF7D' },
              { step: 'Visites', formula: '= Ventes ÷ Tx Vente', color: '#534AB7' },
            ].map((f, i) => (
              <div key={i} style={{ flex: 1, minWidth: 140, padding: '10px 14px', background: `${f.color}10`, borderRadius: 8, border: `1px solid ${f.color}25` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: f.color }}>{f.step}</div>
                <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3 }}>{f.formula}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#5A5A5A', padding: '10px 14px', background: 'rgba(201,168,76,0.06)', borderRadius: 8, borderLeft: '3px solid #C9A84C' }}>
            <strong style={{ color: '#C9A84C' }}>Analyse Avril 2026 · </strong>
            Joignabilité équipe CC : 78% · Entre 55 et 75 leads/vente. Pour 19 ventes/mois → 1 160 leads.
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { cons: 'Rajaa', joign: '86.2%', leads: 55, color: '#4CAF7D' },
              { cons: 'Kaoutar', joign: '77.5%', leads: 61, color: '#4CAF7D' },
              { cons: 'Ghizlane', joign: '81.8%', leads: 58, color: '#4CAF7D' },
              { cons: 'Fatima', joign: '79.2%', leads: 60, color: '#E8A040' },
              { cons: 'Hala', joign: '75.9%', leads: 63, color: '#E8A040' },
              { cons: 'Siham', joign: '63.5%', leads: 75, color: '#E05C5C' },
            ].map(c => (
              <div key={c.cons} style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: c.color }}>{c.cons}</span>
                <span style={{ color: '#8A8A7A' }}> · {c.joign} · </span>
                <span style={{ fontWeight: 600 }}>{c.leads} leads/vente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div style={{ ...sty.card, border: '1.5px solid rgba(201,168,76,0.3)', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C', marginBottom: 20 }}>
            {editProjet ? `Modifier — ${editProjet.nom_projet}` : 'Nouveau projet'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={sty.label}>Nom du projet *</label>
              <input style={sty.input} value={form.nom_projet}
                onChange={e => setForm(p => ({ ...p, nom_projet: e.target.value }))}
                placeholder="ex: JIRARI MALL" />
            </div>
            <div>
              <label style={sty.label}>Commerciaux</label>
              <input style={sty.input} value={form.commerciaux}
                onChange={e => setForm(p => ({ ...p, commerciaux: e.target.value }))}
                placeholder="ex: Nawfal, Hajar" />
            </div>
            <div>
              <label style={sty.label}>Région</label>
              <select style={sty.input} value={form.region}
                onChange={e => setForm(p => ({ ...p, region: e.target.value }))}>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={sty.label}>Délai (mois)</label>
              <input style={sty.input} type="number" value={form.delai_mois}
                onChange={e => setForm(p => ({ ...p, delai_mois: e.target.value }))} min={1} />
            </div>
          </div>
          <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.05)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#C9A84C', marginBottom: 12 }}>Taux (communs à tous les types de biens)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
              {[
                { key: 'tx_vente', label: 'Tx Vente %', color: '#534AB7', hint: 'Ventes / Visites' },
                { key: 'tx_presence', label: 'Tx Présence %', color: '#4CAF7D', hint: 'Visites / RDV' },
                { key: 'tx_conv_tel', label: 'Conv. Tél %', color: '#C9A84C', hint: 'RDV / Échanges' },
                { key: 'tx_joignabilite', label: 'Joignabilité %', color: '#378ADD', hint: 'Échanges / Leads' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ ...sty.label, color: f.color }}>{f.label}</label>
                  <input style={{ ...sty.input, borderColor: `${f.color}40`, textAlign: 'center' }}
                    type="number" value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} min={0} max={100} />
                  <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 3, textAlign: 'center' }}>{f.hint}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2C', marginBottom: 10 }}>Types de biens</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Type de bien', 'Unités en stock', ''].map(h => (
                    <th key={h} style={{ ...sty.th, textAlign: h === 'Type de bien' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.biens.map((b, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px' }}>
                      <select style={sty.input} value={b.type_bien}
                        onChange={e => updateBien(i, 'type_bien', e.target.value)}>
                        <option value="">-- Choisir --</option>
                        {TYPES_BIENS.filter(t =>
                          t === b.type_bien || !form.biens.some((other, oi) => oi !== i && other.type_bien === t)
                        ).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input style={{ ...sty.input, textAlign: 'center' }} type="number" value={b.stock}
                        onChange={e => updateBien(i, 'stock', e.target.value)} min={0} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      {form.biens.length > 1 && (
                        <button onClick={() => removeBien(i)}
                          style={{ background: 'none', border: 'none', color: '#E05C5C', cursor: 'pointer', fontSize: 18 }}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {form.biens.length < TYPES_BIENS.length && (
              <button onClick={addBien}
                style={{ marginTop: 8, ...sty.btn('rgba(201,168,76,0.08)', '#C9A84C'), border: '1px dashed rgba(201,168,76,0.3)', fontSize: 12 }}>
                + Ajouter un type de bien
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={sty.btn(saving ? '#E8D5A3' : '#C9A84C', '#fff')}>
              {saving ? 'Enregistrement...' : editProjet ? 'Mettre à jour' : 'Créer le projet'}
            </button>
            <button onClick={() => { setShowForm(false); setEditProjet(null); setForm(emptyProjet) }}
              style={sty.btn('#F0EEE8', '#5A5A5A')}>Annuler</button>
          </div>
        </div>
      )}

      {/* TOTAUX GLOBAUX CLIQUABLES */}
      {projets.length > 0 && (
        <div>
          {/* Carte Totaux ALL */}
          <div onClick={() => setGlobalExpanded(!globalExpanded)}
            style={{ background: '#fff', borderRadius: 14, padding: '16px 24px', border: '2px solid rgba(201,168,76,0.25)', marginBottom: 12, cursor: 'pointer',
              boxShadow: globalExpanded ? '0 4px 20px rgba(201,168,76,0.12)' : 'none',
              transition: 'box-shadow 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C' }}>Tous les projets</div>
                <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>{projets.length} projets · {REGIONS.filter(r => projets.some(p => p.region === r)).length} régions</div>
              </div>
              <div style={{ fontSize: 18, color: '#C9A84C', transition: 'transform 0.2s', transform: globalExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
            </div>
            <CarteTotaux totaux={totauxGlobaux} color="#C9A84C" size="lg" />
          </div>

          {/* Régions (visibles quand global expanded) */}
          {globalExpanded && REGIONS.map(region => {
            const projetsRegion = projets.filter(p => p.region === region)
            if (projetsRegion.length === 0) return null
            const totauxRegion = calcTotauxProjets(projetsRegion)
            const isExpanded = expandedRegions[region]
            const regionColor = region === 'Kenitra' ? '#534AB7' : '#C9A84C'

            return (
              <div key={region} style={{ marginLeft: 16, marginBottom: 12 }}>
                {/* Carte Région */}
                <div onClick={() => toggleRegion(region)}
                  style={{ background: '#fff', borderRadius: 12, padding: '14px 20px',
                    border: `1.5px solid ${regionColor}30`, marginBottom: 8, cursor: 'pointer',
                    boxShadow: isExpanded ? `0 4px 16px ${regionColor}15` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: regionColor }}>Équipe {region}</div>
                      <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>{projetsRegion.length} projets · {totauxRegion.stock} unités</div>
                    </div>
                    <div style={{ fontSize: 16, color: regionColor, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                  </div>
                  <CarteTotaux totaux={totauxRegion} color={regionColor} size="md" />
                </div>

                {/* Projets de la région */}
                {isExpanded && projetsRegion.map(p => {
                  const totalStock = p.biens.reduce((s, b) => s + (parseInt(b.stock) || 0), 0)
                  const totFunnel = calcFunnel(totalStock, p.delai_mois, p.tx_vente, p.tx_presence, p.tx_conv_tel, p.tx_joignabilite)
                  const isProjetExpanded = expandedProjets[p.id]
                  const lastUpdate = new Date(p.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

                  return (
                    <div key={p.id} style={{ marginLeft: 16, marginBottom: 8 }}>
                      {/* Carte Projet cliquable */}
                      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(201,168,76,0.15)' }}>
                        {/* Header projet */}
                        <div onClick={() => toggleProjet(p.id)}
                          style={{ padding: '14px 20px', cursor: 'pointer', borderBottom: isProjetExpanded ? '1px solid rgba(201,168,76,0.1)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2C' }}>{p.nom_projet}</div>
                              <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>
                                {p.commerciaux && <span>{p.commerciaux} · </span>}
                                {p.delai_mois} mois · Mise à jour : {lastUpdate}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button onClick={e => { e.stopPropagation(); openEdit(p) }}
                                style={sty.btn('rgba(55,138,221,0.08)', '#378ADD')}>Modifier</button>
                              <button onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
                                style={sty.btn('rgba(224,92,92,0.08)', '#E05C5C')}>Supprimer</button>
                              <div style={{ fontSize: 14, color: '#C9A84C', transition: 'transform 0.2s', transform: isProjetExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                            </div>
                          </div>
                          {/* Totaux projet (toujours visibles) */}
                          <CarteTotaux totaux={{ stock: totalStock, obj_mois: totFunnel.obj_mois, obj_sem: totFunnel.obj_semaine, visites: totFunnel.visites, rdv: totFunnel.rdv, echanges: totFunnel.echanges, leads: totFunnel.leads }} color="#C9A84C" size="sm" />
                        </div>

                        {/* Détail expandable */}
                        {isProjetExpanded && (
                          <div style={{ padding: '16px 20px' }}>
                            {/* Note rythme réel */}
                            {(() => {
                              const reel = Object.entries(RYTHME_REEL).find(([k]) =>
                                p.nom_projet.toLowerCase().includes(k.toLowerCase()) ||
                                k.toLowerCase().includes(p.nom_projet.toLowerCase())
                              )
                              if (!reel) return null
                              const [, { stock: stockRef, rythme }] = reel
                              const totalStock = p.biens.reduce((s, b) => s + (parseInt(b.stock) || 0), 0)
                              const delaiReel = rythme > 0 ? Math.round(totalStock / rythme) : null
                              const obj_mois_cible = p.delai_mois > 0 ? Math.ceil(totalStock / p.delai_mois) : null
                              const ecart = obj_mois_cible && rythme ? (rythme - obj_mois_cible) : null
                              const ecartColor = ecart === null ? '#8A8A7A' : ecart >= 0 ? '#4CAF7D' : '#E05C5C'
                              return (
                                <div style={{
                                  background: '#FFF9EC', border: '1.5px solid #C9A84C40',
                                  borderLeft: '4px solid #C9A84C', borderRadius: 8,
                                  padding: '12px 16px', marginBottom: 14
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <span style={{ fontSize: 14 }}>⚠️</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      Note importante — Rythme réel (Avril 2026)
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    <div>
                                      <div style={{ fontSize: 10, color: '#8A8A7A', marginBottom: 2 }}>Stock de référence</div>
                                      <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C' }}>{stockRef} unités</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 10, color: '#8A8A7A', marginBottom: 2 }}>Rythme réel/mois</div>
                                      <div style={{ fontSize: 15, fontWeight: 700, color: '#534AB7' }}>{rythme} ventes</div>
                                    </div>
                                    {delaiReel && (
                                      <div>
                                        <div style={{ fontSize: 10, color: '#8A8A7A', marginBottom: 2 }}>Délai réel estimé</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#E05C5C' }}>{delaiReel} mois</div>
                                      </div>
                                    )}
                                    {obj_mois_cible && (
                                      <div>
                                        <div style={{ fontSize: 10, color: '#8A8A7A', marginBottom: 2 }}>Obj/mois cible</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A84C' }}>{obj_mois_cible} ventes</div>
                                      </div>
                                    )}
                                    {ecart !== null && (
                                      <div>
                                        <div style={{ fontSize: 10, color: '#8A8A7A', marginBottom: 2 }}>Écart rythme vs objectif</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: ecartColor }}>
                                          {ecart >= 0 ? '+' : ''}{ecart} ventes/mois
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })()}
                            {p.biens.length > 0 && (
                                <thead>
                                  <tr>
                                    {['Type de bien', 'Stock', 'Délai', 'Obj/mois', 'Obj/sem.', 'Visites/mois', 'RDV/mois', 'Échanges/mois', 'Leads/mois'].map(h => (
                                      <th key={h} style={{ ...sty.th, textAlign: h === 'Type de bien' ? 'left' : 'center' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.biens.map((b, i) => {
                                    const f = calcFunnel(b.stock, p.delai_mois, p.tx_vente, p.tx_presence, p.tx_conv_tel, p.tx_joignabilite)
                                    return (
                                      <tr key={i}>
                                        <td style={{ ...sty.td, textAlign: 'left', fontWeight: 500 }}>{b.type_bien}</td>
                                        <td style={sty.td}>{b.stock}</td>
                                        <td style={sty.td}>{p.delai_mois} mois</td>
                                        <td style={{ ...sty.td, fontWeight: 600, color: '#C9A84C' }}>{f.obj_mois || '—'}</td>
                                        <td style={{ ...sty.td, color: '#C9A84C' }}>{f.obj_semaine || '—'}</td>
                                        <td style={{ ...sty.td, color: '#534AB7' }}>{f.visites || '—'}</td>
                                        <td style={{ ...sty.td, color: '#4CAF7D' }}>{f.rdv || '—'}</td>
                                        <td style={{ ...sty.td, color: '#C9A84C' }}>{f.echanges || '—'}</td>
                                        <td style={{ ...sty.td, fontWeight: 600, color: '#E8A040' }}>{f.leads || '—'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            )}
                            {totFunnel.liquide_avant && (
                              <div style={{ padding: '8px 14px', background: 'rgba(76,175,125,0.08)', borderRadius: 8, border: '1px solid rgba(76,175,125,0.2)' }}>
                                <span style={{ fontSize: 12, color: '#2d7a54', fontWeight: 500 }}>
                                  Avec ces taux, le projet sera liquidé en <strong>{totFunnel.mois_reel} mois</strong> — avant le délai de {p.delai_mois} mois !
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {projets.length === 0 && !showForm && (
        <div style={{ ...sty.card, textAlign: 'center', color: '#8A8A7A', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏗</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Aucun projet configuré</div>
          <div style={{ fontSize: 12, marginTop: 5 }}>Cliquez sur "+ Nouveau projet" pour commencer</div>
        </div>
      )}
    </div>
  )
}

export default function Objectifs({ conseilleres }) {
  const [tab, setTab] = useState('callcenter')
  const moisOptions = getMoisOptions()
  const currentMois = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`
  const [mois, setMois] = useState(currentMois)
  const [selectedConseillere, setSelectedConseillere] = useState('equipe')
  const [objectifs, setObjectifs] = useState({})
  const [calendrier, setCalendrier] = useState([])
  const [joursOuvrables, setJoursOuvrables] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [verrouille, setVerrouille] = useState(false)
  const [champsVerrouilles, setChampsVerrouilles] = useState({})

  useEffect(() => {
    loadCalendrier()
  }, [])

  useEffect(() => {
    if (calendrier.length > 0) {
      getJoursPresence(mois, calendrier, selectedConseillere === 'equipe' ? null : selectedConseillere).then(j => setJoursOuvrables(j))
    }
    loadObjectifs()
  }, [mois, selectedConseillere, calendrier])

  async function loadCalendrier() {
    const { data } = await supabase.from('calendrier').select('*')
    setCalendrier(data || [])
  }

  async function loadObjectifs() {
    const query = supabase.from('objectifs_callcenter').select('*').eq('mois', mois)
    if (selectedConseillere === 'equipe') {
      query.is('conseillere_id', null)
    } else {
      query.eq('conseillere_id', selectedConseillere)
    }
    const { data } = await query.maybeSingle()
    if (data) {
      setObjectifs(data)
      setVerrouille(data.verrouille || false)
      const verr = {}
      KPI_FIELDS.forEach(f => {
        if (data[f.pctKey] > 0) verr[f.pctKey] = true
        if (data[f.nbKey] > 0) verr[f.nbKey] = true
      })
      setChampsVerrouilles(verr)
    } else {
      setObjectifs({})
      setVerrouille(false)
      setChampsVerrouilles({})
    }
  }

  function handleChange(key, value) {
    if (verrouille && champsVerrouilles[key]) return
    const cleaned = value.replace(/[^0-9.]/g, '')
    const numVal = parseFloat(cleaned) || 0
    setObjectifs(prev => {
      const updated = { ...prev, [key]: cleaned }
      // Auto-calcul objectif journalier
      KPI_FIELDS.forEach(f => {
        if (key === f.nbKey && joursOuvrables > 0) {
          updated[f.jourKey] = parseFloat((numVal / joursOuvrables).toFixed(2))
        }
      })
      return updated
    })
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      mois,
      conseillere_id: selectedConseillere === 'equipe' ? null : selectedConseillere,
      jours_ouvrables: joursOuvrables,
      verrouille,
    }
    KPI_FIELDS.forEach(f => {
      payload[f.pctKey] = parseFloat(objectifs[f.pctKey]) || 0
      payload[f.nbKey] = parseFloat(objectifs[f.nbKey]) || 0
      payload[f.jourKey] = joursOuvrables > 0 ? parseFloat(((parseFloat(objectifs[f.nbKey])||0) / joursOuvrables).toFixed(2)) : 0
    })
    let error
    if (selectedConseillere === 'equipe') {
      // Pour l'equipe : supprimer puis inserer (gere les NULL)
      await supabase.from('objectifs_callcenter').delete().eq('mois', mois).is('conseillere_id', null)
      const { error: e } = await supabase.from('objectifs_callcenter').insert(payload)
      error = e
    } else {
      const { error: e } = await supabase.from('objectifs_callcenter').upsert(payload, { onConflict: 'conseillere_id,mois' })
      error = e
    }
    setSaving(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'success', text: 'Objectifs enregistrés !' })
      loadObjectifs()
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function toggleVerrouillage() {
    const newVal = !verrouille
    setVerrouille(newVal)
    if (newVal) {
      const verr = {}
      KPI_FIELDS.forEach(f => {
        if (parseFloat(objectifs[f.pctKey]) > 0) verr[f.pctKey] = true
        if (parseFloat(objectifs[f.nbKey]) > 0) verr[f.nbKey] = true
      })
      setChampsVerrouilles(verr)
    } else {
      setChampsVerrouilles({})
    }
  }

  const moisLabel = moisOptions.find(m => m.val === mois)?.label || mois
  const inputStyle = (key, color) => ({
    width: '100%', padding: '9px 12px',
    border: `1.5px solid ${(verrouille && champsVerrouilles[key]) ? 'rgba(138,138,122,0.3)' : `${color}40`}`,
    borderRadius: 8, fontSize: 13,
    color: (verrouille && champsVerrouilles[key]) ? '#8A8A7A' : '#2C2C2C',
    background: (verrouille && champsVerrouilles[key]) ? '#F0EEE8' : '#F8F7F4',
    outline: 'none', textAlign: 'center',
    cursor: (verrouille && champsVerrouilles[key]) ? 'not-allowed' : 'text'
  })

  return (
    <div>
      <PageHeader title="Objectifs" subtitle="Objectifs mensuels par KPI et par conseillère" />

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['callcenter','Call Center'],['marketing','Marketing'],['ventes','Ventes / Délais']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 20px', borderRadius: 20, border: `1.5px solid ${tab===k?'#C9A84C':'rgba(201,168,76,0.2)'}`, background: tab===k?'#C9A84C':'#fff', color: tab===k?'#fff':'#5A5A5A', fontSize: 13, fontWeight: tab===k?500:400, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <select value={mois} onChange={e => setMois(e.target.value)} style={{ padding: '8px 32px 8px 14px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.25)', background: '#fff', fontSize: 13, color: '#2C2C2C', cursor: 'pointer', outline: 'none', appearance: 'none' }}>
            {moisOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', fontSize: 11 }}>▼</span>
        </div>

        <div style={{ position: 'relative' }}>
          <select value={selectedConseillere} onChange={e => setSelectedConseillere(e.target.value)} style={{ padding: '8px 32px 8px 14px', borderRadius: 20, border: '1.5px solid rgba(201,168,76,0.25)', background: '#fff', fontSize: 13, color: '#2C2C2C', cursor: 'pointer', outline: 'none', appearance: 'none' }}>
            <option value="equipe">Objectif Équipe</option>
            {conseilleres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', fontSize: 11 }}>▼</span>
        </div>
      </div>

      {tab === 'callcenter' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, border: '1px solid rgba(201,168,76,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#2C2C2C' }}>
                Call Center — <span style={{ color: '#C9A84C' }}>{moisLabel}</span>
                {selectedConseillere !== 'equipe' && <span style={{ color: '#5A5A5A', fontSize: 13, fontWeight: 400 }}> · {conseilleres.find(c=>c.id===selectedConseillere)?.nom}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 4 }}>
                {joursOuvrables} jours {selectedConseillere !== 'equipe' ? 'de présence' : 'ouvrables'} ce mois
                <span style={{ color: '#C9A84C', marginLeft: 8 }}>→ objectif journalier calculé automatiquement</span>
              </div>
            </div>
            <button onClick={toggleVerrouillage} style={{
              padding: '8px 18px', borderRadius: 20,
              border: `1.5px solid ${verrouille ? '#E05C5C' : '#4CAF7D'}`,
              background: verrouille ? 'rgba(224,92,92,0.08)' : 'rgba(76,175,125,0.08)',
              color: verrouille ? '#E05C5C' : '#4CAF7D',
              fontSize: 12, fontWeight: 500, cursor: 'pointer'
            }}>
              {verrouille ? '🔒 Verrouillé' : '🔓 Déverrouillé'}
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>KPI</th>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Indicateur chiffre</th>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Objectif %</th>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Objectif mensuel</th>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', fontWeight: 500 }}>Objectif / jour</th>
              </tr>
            </thead>
            <tbody>
              {KPI_FIELDS.map(f => {
                const jourVal = joursOuvrables > 0 && objectifs[f.nbKey] ? parseFloat((parseFloat(objectifs[f.nbKey]) / joursOuvrables).toFixed(2)) : 0
                return (
                  <tr key={f.key}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: f.color }}>{f.label}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                      <div style={{ fontSize: 12, color: '#8A8A7A' }}>{f.sub}</div>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', width: '20%' }}>
                      <input type="text" inputMode="decimal"
                        value={objectifs[f.pctKey] || ''}
                        onChange={e => handleChange(f.pctKey, e.target.value)}
                        placeholder="ex: 25%"
                        readOnly={verrouille && champsVerrouilles[f.pctKey]}
                        style={inputStyle(f.pctKey, f.color)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', width: '20%' }}>
                      <input type="text" inputMode="decimal"
                        value={objectifs[f.nbKey] || ''}
                        onChange={e => handleChange(f.nbKey, e.target.value)}
                        placeholder="ex: 500"
                        readOnly={verrouille && champsVerrouilles[f.nbKey]}
                        style={inputStyle(f.nbKey, f.color)}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', width: '20%' }}>
                      <div style={{ textAlign: 'center', padding: '9px 12px', background: jourVal > 0 ? `${f.color}10` : '#F8F7F4', borderRadius: 8, fontSize: 13, fontWeight: jourVal > 0 ? 600 : 400, color: jourVal > 0 ? f.color : '#8A8A7A', border: `1.5px solid ${jourVal > 0 ? `${f.color}30` : 'rgba(201,168,76,0.1)'}` }}>
                        {jourVal > 0 ? jourVal : '—'}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, alignItems: 'center' }}>
            <button onClick={handleSave} disabled={saving} style={{ background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Enregistrement...' : `Sauvegarder — ${moisLabel}`}
            </button>
            {verrouille && (
              <div style={{ fontSize: 12, color: '#E05C5C' }}>🔒 Les champs renseignés sont verrouillés</div>
            )}
          </div>

          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(201,168,76,0.05)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.15)', fontSize: 12, color: '#5A5A5A' }}>
            <strong style={{ color: '#C9A84C' }}>Note :</strong> L'objectif journalier = objectif mensuel ÷ {joursOuvrables} jours {selectedConseillere !== 'equipe' ? 'de présence (absences déduites)' : 'ouvrables'}. Les couleurs des KPIs dans le dashboard s'adaptent automatiquement.
          </div>
        </div>
      )}

      {tab === 'ventes' && <SectionVentesDelais />}

      {tab === 'marketing' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, border: '1px solid rgba(201,168,76,0.15)', color: '#5A5A5A', textAlign: 'center', fontSize: 13 }}>
          Les objectifs Marketing seront disponibles prochainement.
        </div>
      )}
    </div>
  )
}