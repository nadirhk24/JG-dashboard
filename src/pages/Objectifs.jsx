import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
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
    if (dayOfWeek === 0) continue // Dimanche
    if (!nonOuvrables.has(dateStr)) count++
  }
  return count
}

const KPI_FIELDS = [
  { key: 'productivite', label: 'Productivité', sub: 'Nb échanges', pctKey: 'obj_productivite_pct', nbKey: 'obj_echanges_nb', jourKey: 'obj_echanges_jour', color: '#378ADD' },
  { key: 'conv_tel', label: 'Conv. Téléphonique', sub: 'Nb RDV', pctKey: 'obj_conv_tel_pct', nbKey: 'obj_rdv_nb', jourKey: 'obj_rdv_jour', color: '#C9A84C' },
  { key: 'presence', label: 'Taux de Présence', sub: 'Nb visites', pctKey: 'obj_presence_pct', nbKey: 'obj_visites_nb', jourKey: 'obj_visites_jour', color: '#4CAF7D' },
  { key: 'efficacite', label: 'Efficacité Commerciale', sub: 'Nb ventes', pctKey: 'obj_efficacite_pct', nbKey: 'obj_ventes_nb', jourKey: 'obj_ventes_jour', color: '#534AB7' },
]


// ── Section Objectifs Ventes/Délais ─────────────────────────────────────────

function SectionVentesDelais() {
  const [projets, setProjets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProjet, setEditProjet] = useState(null)
  const [showMethodo, setShowMethodo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const emptyProjet = {
    nom_projet: '', commerciaux: '', delai_mois: 4,
    tx_vente: 30, tx_presence: 20, tx_conv_tel: 35, tx_joignabilite: 78,
    biens: [{ type_bien: '', stock: 0, obj_total: 0 }]
  }
  const [form, setForm] = useState(emptyProjet)

  useEffect(() => { loadProjets() }, [])

  async function loadProjets() {
    setLoading(true)
    const { data: ps } = await supabase.from('objectifs_vente_projets').select('*').order('created_at')
    const result = []
    for (const p of (ps || [])) {
      const { data: biens } = await supabase.from('objectifs_vente_biens')
        .select('*').eq('projet_id', p.id).order('created_at')
      result.push({ ...p, biens: biens || [] })
    }
    setProjets(result)
    setLoading(false)
  }

  function calcFunnel(obj_mois, tx_vente, tx_presence, tx_conv_tel, tx_joignabilite) {
    const tv = parseFloat(tx_vente) / 100
    const tp = parseFloat(tx_presence) / 100
    const tc = parseFloat(tx_conv_tel) / 100
    const tj = parseFloat(tx_joignabilite) / 100
    if (!obj_mois || !tv || !tp || !tc || !tj) return {}
    const visites = Math.ceil(obj_mois / tv)
    const rdv = Math.ceil(visites / tp)
    const echanges = Math.ceil(rdv / tc)
    const leads = Math.ceil(echanges / tj)
    return { visites, rdv, echanges, leads }
  }

  async function handleSave() {
    if (!form.nom_projet.trim()) return setMsg({ type: 'error', text: 'Nom du projet requis' })
    setSaving(true)
    const payload = {
      nom_projet: form.nom_projet,
      commerciaux: form.commerciaux,
      delai_mois: parseInt(form.delai_mois) || 1,
      tx_vente: parseFloat(form.tx_vente) || 0,
      tx_presence: parseFloat(form.tx_presence) || 0,
      tx_conv_tel: parseFloat(form.tx_conv_tel) || 0,
      tx_joignabilite: parseFloat(form.tx_joignabilite) || 0,
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
    const biens = form.biens.filter(b => b.type_bien.trim())
    if (biens.length > 0) {
      await supabase.from('objectifs_vente_biens').insert(
        biens.map(b => ({ projet_id: projetId, type_bien: b.type_bien, stock: parseInt(b.stock) || 0, obj_total: parseInt(b.obj_total) || 0 }))
      )
    }
    setSaving(false)
    setMsg({ type: 'success', text: editProjet ? 'Projet mis à jour !' : 'Projet créé !' })
    setShowForm(false); setEditProjet(null); setForm(emptyProjet)
    loadProjets()
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce projet et tous ses biens ?')) return
    await supabase.from('objectifs_vente_projets').delete().eq('id', id)
    loadProjets()
  }

  function openEdit(p) {
    setForm({ ...p, biens: p.biens.length > 0 ? p.biens : [{ type_bien: '', stock: 0, obj_total: 0 }] })
    setEditProjet(p); setShowForm(true)
  }

  function addBien() { setForm(p => ({ ...p, biens: [...p.biens, { type_bien: '', stock: 0, obj_total: 0 }] })) }
  function removeBien(i) { setForm(p => ({ ...p, biens: p.biens.filter((_, idx) => idx !== i) })) }
  function updateBien(i, key, val) { setForm(p => ({ ...p, biens: p.biens.map((b, idx) => idx === i ? { ...b, [key]: val } : b) })) }

  const sty = {
    card: { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 },
    label: { fontSize: 11, color: '#8A8A7A', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block' },
    input: { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none', boxSizing: 'border-box' },
    th: { fontSize: 11, color: '#5A5A5A', fontWeight: 500, padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', textAlign: 'center', background: '#FAFAF8' },
    td: { padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.06)', fontSize: 13, color: '#2C2C2C', textAlign: 'center' },
    tdTotal: { padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#C9A84C', background: 'rgba(201,168,76,0.06)', textAlign: 'center' },
    btn: (bg, col) => ({ background: bg, color: col, border: 'none', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }),
    kpiBox: (color) => ({ textAlign: 'center', padding: '10px 8px', background: `${color}08`, borderRadius: 8, border: `1px solid ${color}20` }),
  }

  if (loading) return <div style={{ textAlign: 'center', color: '#8A8A7A', padding: 40 }}>Chargement...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2C' }}>Objectifs Ventes / Délais</div>
          <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 3 }}>Par projet · Funnel commercial calculé automatiquement</div>
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

      {/* Note Méthodologique */}
      {showMethodo && (
        <div style={{ ...sty.card, background: 'rgba(55,138,221,0.04)', border: '1px solid rgba(55,138,221,0.15)', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#378ADD', marginBottom: 12 }}>Méthodologie — Calcul du funnel inversé</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { step: 'Leads bruts', formula: '= Échanges ÷ Joignabilité', color: '#E8A040' },
              { step: 'Échanges', formula: '= RDV ÷ Tx Conv. Tél', color: '#378ADD' },
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
            Joignabilité équipe CC : 78% · Entre 55 et 75 leads nécessaires par vente selon la conseillère.
            Pour 19 ventes/mois (avec 30% vente / 20% présence / 35% conv. tél) → 1 160 leads nécessaires.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={sty.label}>Nom du projet *</label>
              <input style={sty.input} value={form.nom_projet}
                onChange={e => setForm(p => ({ ...p, nom_projet: e.target.value }))}
                placeholder="ex: JIRARI MALL" />
            </div>
            <div>
              <label style={sty.label}>Commerciaux assignés</label>
              <input style={sty.input} value={form.commerciaux}
                onChange={e => setForm(p => ({ ...p, commerciaux: e.target.value }))}
                placeholder="ex: Nawfal, Hajar" />
            </div>
            <div>
              <label style={sty.label}>Délai global (mois)</label>
              <input style={sty.input} type="number" value={form.delai_mois}
                onChange={e => setForm(p => ({ ...p, delai_mois: e.target.value }))} min={1} />
            </div>
          </div>

          {/* Taux */}
          <div style={{ padding: '14px 16px', background: 'rgba(201,168,76,0.05)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#C9A84C', marginBottom: 12 }}>
              Taux commerciaux (communs à tous les types de biens)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
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

          {/* Types de biens */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2C', marginBottom: 10 }}>Types de biens</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Type de bien', 'Unités en stock', 'Objectif total', ''].map(h => (
                    <th key={h} style={{ ...sty.th, textAlign: h === 'Type de bien' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.biens.map((b, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px' }}>
                      <input style={sty.input} value={b.type_bien}
                        onChange={e => updateBien(i, 'type_bien', e.target.value)}
                        placeholder="ex: Appartement" />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input style={{ ...sty.input, textAlign: 'center' }} type="number" value={b.stock}
                        onChange={e => updateBien(i, 'stock', e.target.value)} min={0} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input style={{ ...sty.input, textAlign: 'center' }} type="number" value={b.obj_total}
                        onChange={e => updateBien(i, 'obj_total', e.target.value)} min={0} />
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
            <button onClick={addBien}
              style={{ marginTop: 8, ...sty.btn('rgba(201,168,76,0.08)', '#C9A84C'), border: '1px dashed rgba(201,168,76,0.3)', fontSize: 12 }}>
              + Ajouter un type de bien
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving}
              style={sty.btn(saving ? '#E8D5A3' : '#C9A84C', '#fff')}>
              {saving ? 'Enregistrement...' : editProjet ? 'Mettre à jour' : 'Créer le projet'}
            </button>
            <button onClick={() => { setShowForm(false); setEditProjet(null); setForm(emptyProjet) }}
              style={sty.btn('#F0EEE8', '#5A5A5A')}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste projets */}
      {projets.length === 0 && !showForm ? (
        <div style={{ ...sty.card, textAlign: 'center', color: '#8A8A7A', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏗</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Aucun projet configuré</div>
          <div style={{ fontSize: 12, marginTop: 5 }}>Cliquez sur "+ Nouveau projet" pour commencer</div>
        </div>
      ) : (
        projets.map(p => {
          const totalStock = p.biens.reduce((s, b) => s + (parseInt(b.stock) || 0), 0)
          const totalObjTotal = p.biens.reduce((s, b) => s + (parseInt(b.obj_total) || 0), 0)
          const objMoisTotal = p.delai_mois > 0 ? Math.ceil(totalObjTotal / p.delai_mois) : 0
          const totFunnel = calcFunnel(objMoisTotal, p.tx_vente, p.tx_presence, p.tx_conv_tel, p.tx_joignabilite)
          const lastUpdate = new Date(p.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

          return (
            <div key={p.id} style={sty.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2C2C2C' }}>{p.nom_projet}</div>
                  {p.commerciaux && <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 3 }}>Commerciaux : {p.commerciaux}</div>}
                  <div style={{ fontSize: 11, color: '#B0AEA8', marginTop: 3 }}>Dernière mise à jour : {lastUpdate}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#C9A84C', background: 'rgba(201,168,76,0.1)' }}>
                    {p.delai_mois} mois
                  </span>
                  <button onClick={() => openEdit(p)} style={sty.btn('rgba(55,138,221,0.08)', '#378ADD')}>Modifier</button>
                  <button onClick={() => handleDelete(p.id)} style={sty.btn('rgba(224,92,92,0.08)', '#E05C5C')}>Supprimer</button>
                </div>
              </div>

              {/* Taux */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Tx Vente', val: `${p.tx_vente}%`, color: '#534AB7' },
                  { label: 'Tx Présence', val: `${p.tx_presence}%`, color: '#4CAF7D' },
                  { label: 'Conv. Tél', val: `${p.tx_conv_tel}%`, color: '#C9A84C' },
                  { label: 'Joignabilité', val: `${p.tx_joignabilite}%`, color: '#378ADD' },
                ].map(k => (
                  <div key={k.label} style={sty.kpiBox(k.color)}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: k.color }}>{k.val}</div>
                    <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Tableau */}
              {p.biens.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Type de bien', 'Stock', 'Obj. total', 'Délai', 'Obj/mois', 'Visites/mois', 'RDV/mois', 'Échanges/mois', 'Leads/mois'].map(h => (
                        <th key={h} style={{ ...sty.th, textAlign: h === 'Type de bien' ? 'left' : 'center' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.biens.map((b, i) => {
                      const objMois = p.delai_mois > 0 ? Math.ceil(parseInt(b.obj_total) / p.delai_mois) : 0
                      const f = calcFunnel(objMois, p.tx_vente, p.tx_presence, p.tx_conv_tel, p.tx_joignabilite)
                      return (
                        <tr key={i}>
                          <td style={{ ...sty.td, textAlign: 'left', fontWeight: 500 }}>{b.type_bien}</td>
                          <td style={sty.td}>{b.stock}</td>
                          <td style={sty.td}>{b.obj_total}</td>
                          <td style={sty.td}>{p.delai_mois} mois</td>
                          <td style={{ ...sty.td, fontWeight: 600, color: '#C9A84C' }}>{objMois}</td>
                          <td style={{ ...sty.td, color: '#534AB7' }}>{f.visites || '—'}</td>
                          <td style={{ ...sty.td, color: '#4CAF7D' }}>{f.rdv || '—'}</td>
                          <td style={{ ...sty.td, color: '#C9A84C' }}>{f.echanges || '—'}</td>
                          <td style={{ ...sty.td, fontWeight: 600, color: '#E8A040' }}>{f.leads || '—'}</td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td style={{ ...sty.tdTotal, textAlign: 'left' }}>TOTAL</td>
                      <td style={sty.tdTotal}>{totalStock}</td>
                      <td style={sty.tdTotal}>{totalObjTotal}</td>
                      <td style={sty.tdTotal}>{p.delai_mois} mois</td>
                      <td style={sty.tdTotal}>{objMoisTotal}</td>
                      <td style={{ ...sty.tdTotal, color: '#534AB7' }}>{totFunnel.visites || '—'}</td>
                      <td style={{ ...sty.tdTotal, color: '#4CAF7D' }}>{totFunnel.rdv || '—'}</td>
                      <td style={{ ...sty.tdTotal, color: '#C9A84C' }}>{totFunnel.echanges || '—'}</td>
                      <td style={{ ...sty.tdTotal, color: '#E8A040' }}>{totFunnel.leads || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )
        })
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
      getJoursOuvrables(mois, calendrier).then(j => setJoursOuvrables(j))
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
                {joursOuvrables} jours ouvrables ce mois
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
            <strong style={{ color: '#C9A84C' }}>Note :</strong> L'objectif journalier = objectif mensuel ÷ {joursOuvrables} jours ouvrables. Les couleurs des KPIs dans le dashboard s'adaptent automatiquement.
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