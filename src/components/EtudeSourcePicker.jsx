import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { agregerParPeriode } from '../lib/kpi'

// ── Sources disponibles ───────────────────────────────────────────────────────
// Chaque source décrit : label, table, filtre, et comment extraire la valeur
const SOURCES = [
  {
    id: 'cc_conv_tel_mensuel',
    label: 'CC — Conv. Tél. mensuel par conseillère',
    description: 'RDV / Échanges · Jan→Avr 2026 · source: saisies',
    granularity: 'mensuel',
    kpi: 'conversion_tel',
  },
  {
    id: 'cc_conv_tel_jj',
    label: 'CC — Conv. Tél. jour par jour (Avril)',
    description: 'RDV / Échanges · JJ Avril 2026 · source: saisies',
    granularity: 'jj_avril',
    kpi: 'conversion_tel',
  },
  {
    id: 'cc_presence_mensuel',
    label: 'CC — Taux de présence mensuel',
    description: 'Visites / RDV · Jan→Avr 2026 · source: saisies',
    granularity: 'mensuel',
    kpi: 'taux_presence',
  },
  {
    id: 'cc_presence_jj',
    label: 'CC — Taux de présence jour par jour (Avril)',
    description: 'Visites / RDV · JJ Avril 2026 · source: saisies',
    granularity: 'jj_avril',
    kpi: 'taux_presence',
  },
  {
    id: 'cc_efficacite_mensuel',
    label: 'CC — Efficacité comm. mensuelle',
    description: 'Ventes / Visites · Jan→Avr 2026 · source: saisies',
    granularity: 'mensuel',
    kpi: 'efficacite_comm',
  },
  {
    id: 'flux_tv_mensuel',
    label: 'Flux RDV — Taux de vente mensuel par commercial',
    description: 'Ventes / Visites · Jan→Avr 2026 · source: flux_rdv',
    granularity: 'mensuel',
    kpi: 'tv',
    table: 'flux_rdv',
  },
  {
    id: 'flux_tv_jj',
    label: 'Flux RDV — Taux de vente JJ par commercial',
    description: 'Ventes / Visites · JJ Avril 2026 · source: flux_rdv',
    granularity: 'jj_avril',
    kpi: 'tv',
    table: 'flux_rdv',
  },
  {
    id: 'mkt_funnel_mensuel',
    label: 'Marketing — Funnel mensuel',
    description: 'Base nette / RDV / Visites / Ventes · Jan→Avr · source: marketing_saisies',
    granularity: 'mensuel',
    kpi: 'funnel',
    table: 'marketing_saisies',
  },
]

const MOIS = ['Jan', 'Fev', 'Mar', 'Avr']
const MOIS_STARTS = ['2026-01', '2026-02', '2026-03', '2026-04']

// ── Fetchers ──────────────────────────────────────────────────────────────────
const CONS_NAME_MAP = {
  'FATIMA ZAHRAA': 'Fatima Zahraa AAKIBA',
  'Fatima Zahraa AAKIBA': 'Fatima Zahraa AAKIBA',
  'GHIZLANE ELBAKARI': 'Ghizlane ELBAKARI',
  'Ghizlane ELBAKARI': 'Ghizlane ELBAKARI',
  'Hala ELAOUAD': 'Hala ELAOUAD',
  'HALA ELAOUAD': 'Hala ELAOUAD',
  'KAOUTAR HRARTI': 'Kaoutar HRARTI',
  'Kaoutar HRARTI': 'Kaoutar HRARTI',
  'Rajaa ELKHANCHAR': 'Rajaa ELKHANCHAR',
  'RAJAA ELKHANCHAR': 'Rajaa ELKHANCHAR',
  'IBNTABET SIHAM': 'Siham IBNTABET',
  'Siham IBNTABET': 'Siham IBNTABET',
}

function normalizeName(nom) {
  return CONS_NAME_MAP[nom] || nom
}

async function fetchCCSaisies() {
  const { data } = await supabase
    .from('saisies')
    .select('*, conseilleres(id, nom)')
    .gte('date', '2026-01-01')
    .lte('date', '2026-04-30')
    .order('date')
  return data || []
}

async function fetchFluxRDV() {
  const { data } = await supabase
    .from('flux_rdv')
    .select('*, commerciaux(id, nom, equipe)')
    .gte('date_debut', '2026-01-01')
    .lte('date_debut', '2026-04-30')
    .order('date_debut')
  return data || []
}

async function fetchMarketing() {
  const { data } = await supabase
    .from('marketing_saisies')
    .select('*')
    .gte('date', '2026-01-01')
    .lte('date', '2026-04-30')
    .order('date')
  return data || []
}

function calcKpi(kpi, row) {
  if (kpi === 'conversion_tel') {
    const exch = parseFloat(row.echanges || 0)
    return exch > 0 ? parseFloat(((parseFloat(row.rdv || 0) / exch) * 100).toFixed(1)) : null
  }
  if (kpi === 'taux_presence') {
    const rdv = parseFloat(row.rdv || 0)
    return rdv > 0 ? parseFloat(((parseFloat(row.visites || 0) / rdv) * 100).toFixed(1)) : null
  }
  if (kpi === 'efficacite_comm') {
    const vis = parseFloat(row.visites || 0)
    return vis > 0 ? parseFloat(((parseFloat(row.ventes || 0) / vis) * 100).toFixed(1)) : null
  }
  if (kpi === 'tv') {
    const vis = parseFloat(row.visites || 0)
    return vis > 0 ? parseFloat(((parseFloat(row.ventes || 0) / vis) * 100).toFixed(1)) : null
  }
  return null
}

function processCC(saisies, kpi, granularity) {
  const byConseillere = {}
  saisies.forEach(s => {
    const nom = normalizeName(s.conseilleres?.nom || s.conseillere_id)
    if (!byConseillere[nom]) byConseillere[nom] = []
    byConseillere[nom].push(s)
  })

  const result = {}
  Object.entries(byConseillere).forEach(([nom, rows]) => {
    if (granularity === 'mensuel') {
      result[nom] = MOIS_STARTS.map(prefix => {
        const allMonthRows = rows.filter(r => (r.date || r.date_debut || '').startsWith(prefix))
        if (!allMonthRows.length) return null
        // Saisies journalieres = type_saisie 'jour' ou null
        // Saisies periode = type_saisie 'periode'
        const jourRows = allMonthRows.filter(r => !r.type_saisie || r.type_saisie === 'jour')
        const periodeRows = allMonthRows.filter(r => r.type_saisie === 'periode')
        if (jourRows.length >= 2) {
          // Taux global du mois = sum(RDV) / sum(Echanges) comme CC vue 2026
          const tot = jourRows.reduce((acc, r) => ({
            rdv: acc.rdv + parseFloat(r.rdv || 0),
            echanges: acc.echanges + parseFloat(r.echanges || 0),
            visites: acc.visites + parseFloat(r.visites || 0),
            ventes: acc.ventes + parseFloat(r.ventes || 0),
          }), { rdv: 0, echanges: 0, visites: 0, ventes: 0 })
          const v = calcKpi(kpi, tot)
          return v != null ? parseFloat(Math.min(100, v).toFixed(1)) : null
        }
        // Fallback periode
        if (!periodeRows.length) return null
        const tot = periodeRows.reduce((acc, r) => ({
          rdv: acc.rdv + parseFloat(r.rdv || 0),
          echanges: acc.echanges + parseFloat(r.echanges || 0),
          visites: acc.visites + parseFloat(r.visites || 0),
          ventes: acc.ventes + parseFloat(r.ventes || 0),
        }), { rdv: 0, echanges: 0, visites: 0, ventes: 0 })
        return calcKpi(kpi, tot)
      })
    } else {
      // JJ avril
      const aprilRows = rows.filter(r => (r.date || r.date_debut || '').startsWith('2026-04'))
      const byDate = {}
      aprilRows.forEach(r => {
        const d = r.date || r.date_debut
        if (!byDate[d]) byDate[d] = []
        byDate[d].push(r)
      })
      result[nom] = Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, dayRows]) => {
        const tot = dayRows.reduce((acc, r) => ({
          rdv: acc.rdv + parseFloat(r.rdv || 0),
          visites: acc.visites + parseFloat(r.visites || 0),
          ventes: acc.ventes + parseFloat(r.ventes || 0),
          echanges: acc.echanges + parseFloat(r.echanges || 0),
        }), { rdv: 0, visites: 0, ventes: 0, echanges: 0 })
        return { date, val: calcKpi(kpi, tot), rdv: tot.rdv, ech: tot.echanges }
      })
    }
  })
  return result
}

function processFlux(flux, kpi, granularity) {
  const byComm = {}
  flux.forEach(f => {
    const nom = f.commerciaux?.nom || f.commercial_id
    if (!nom || nom.includes('Non reconnu')) return
    if (!byComm[nom]) byComm[nom] = { equipe: f.commerciaux?.equipe, rows: [] }
    byComm[nom].rows.push(f)
  })

  const result = {}
  Object.entries(byComm).forEach(([nom, { equipe, rows }]) => {
    if (granularity === 'mensuel') {
      result[nom] = { equipe, vals: MOIS_STARTS.map(prefix => {
        const monthRows = rows.filter(r => (r.date_debut || '').startsWith(prefix))
        if (!monthRows.length) return null
        const tot = monthRows.reduce((acc, r) => {
          const isPeriode = r.type_saisie === 'periode' || r.type_saisie === 'non_reconnue'
          const v = parseFloat(r.visites || 0), ve = parseFloat(r.ventes || 0)
          return {
            visites: acc.visites + (isPeriode ? v : v + ve),
            ventes: acc.ventes + ve,
          }
        }, { visites: 0, ventes: 0 })
        return tot.visites > 0 ? parseFloat(((tot.ventes / tot.visites) * 100).toFixed(1)) : null
      })}
    } else {
      const aprilRows = rows.filter(r => (r.date_debut || '').startsWith('2026-04'))
      const byDate = {}
      aprilRows.forEach(r => {
        const d = r.date_debut
        if (!byDate[d]) byDate[d] = []
        byDate[d].push(r)
      })
      result[nom] = { equipe, vals: Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, dayRows]) => {
        const tot = dayRows.reduce((acc, r) => {
          const isPeriode = r.type_saisie === 'periode' || r.type_saisie === 'non_reconnue'
          const v = parseFloat(r.visites || 0), ve = parseFloat(r.ventes || 0)
          return { visites: acc.visites + (isPeriode ? v : v + ve), ventes: acc.ventes + ve }
        }, { visites: 0, ventes: 0 })
        return { date, val: tot.visites > 0 ? parseFloat(((tot.ventes / tot.visites) * 100).toFixed(1)) : null }
      })}
    }
  })
  return result
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EtudeSourcePicker({ onClose, onApply, targetLabel }) {
  const [step, setStep] = useState(1) // 1=choisir source, 2=prévisualiser
  const [selectedSource, setSelectedSource] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  async function loadPreview(source) {
    setLoading(true)
    try {
      let data = {}
      if (!source.table || source.table === 'saisies') {
        const saisies = await fetchCCSaisies()
        data = processCC(saisies, source.kpi, source.granularity)
      } else if (source.table === 'flux_rdv') {
        const flux = await fetchFluxRDV()
        data = processFlux(flux, source.kpi, source.granularity)
      } else if (source.table === 'marketing_saisies') {
        const mkt = await fetchMarketing()
        // funnel
        data = { funnel: mkt.map(r => ({
          date: r.date,
          base_nette: parseFloat(r.injections||0) - parseFloat(r.non_exploitables||0) - parseFloat(r.indispos||0),
          rdv: parseFloat(r.rdv||0),
          visites: parseFloat(r.visites||0),
          ventes: parseFloat(r.ventes||0),
        }))}
      }
      setPreview(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function handleSelectSource(src) {
    setSelectedSource(src)
    loadPreview(src)
    setStep(2)
  }

  const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modal: { background: '#fff', borderRadius: 16, padding: 28, width: 640, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
    h2: { fontSize: 16, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 },
    sub: { fontSize: 12, color: '#8A8A7A', marginBottom: 20 },
    sourceCard: (active) => ({
      border: `1px solid ${active ? '#C9A84C' : '#E8E6DF'}`,
      borderRadius: 10, padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
      background: active ? '#FDF6E3' : '#fff',
      transition: 'all 0.15s',
    }),
    btn: (primary) => ({
      padding: '8px 18px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 500,
      border: `1px solid ${primary ? '#C9A84C' : '#E8E6DF'}`,
      background: primary ? '#C9A84C' : '#fff',
      color: primary ? '#fff' : '#5A5A5A',
    }),
    tableHead: { fontSize: 11, color: '#8A8A7A', padding: '5px 10px', borderBottom: '1px solid #E8E6DF', background: '#F8F7F4' },
    tableCell: { fontSize: 12, padding: '5px 10px', borderBottom: '1px solid #F0EEE9' },
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={S.h2}>{step === 1 ? 'Choisir une source de données' : `Aperçu — ${selectedSource?.label}`}</div>
            <div style={S.sub}>{targetLabel ? `Cible : ${targetLabel}` : 'Sélectionner la source à appliquer'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8A8A7A' }}>✕</button>
        </div>

        {/* Step 1 — Choisir source */}
        {step === 1 && (
          <div>
            {SOURCES.map(src => (
              <div key={src.id} style={S.sourceCard(selectedSource?.id === src.id)} onClick={() => handleSelectSource(src)}>
                <div style={{ fontWeight: 500, fontSize: 13, color: '#2C2C2C', marginBottom: 2 }}>{src.label}</div>
                <div style={{ fontSize: 11, color: '#8A8A7A' }}>{src.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Step 2 — Prévisualiser */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} style={{ ...S.btn(false), marginBottom: 16, fontSize: 12 }}>← Changer de source</button>

            {loading && <div style={{ textAlign: 'center', padding: 40, color: '#8A8A7A' }}>Chargement depuis Supabase...</div>}

            {!loading && preview && (
              <div style={{ overflow: 'auto' }}>
                {/* CC / Flux — tableau par entité */}
                {selectedSource?.granularity === 'mensuel' && !selectedSource?.table?.includes('marketing') && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={S.tableHead}>Nom</th>
                        {MOIS.map(m => <th key={m} style={{ ...S.tableHead, textAlign: 'right' }}>{m}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(preview).map(([nom, vals]) => {
                        const valsArr = Array.isArray(vals) ? vals : vals?.vals || []
                        return (
                          <tr key={nom}>
                            <td style={S.tableCell}>{nom}</td>
                            {valsArr.map((v, i) => (
                              <td key={i} style={{ ...S.tableCell, textAlign: 'right', fontWeight: 500, color: v != null ? '#2C2C2C' : '#D0CEC7' }}>
                                {v != null ? `${Math.min(100, v)}%` : '—'}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {selectedSource?.granularity === 'jj_avril' && !selectedSource?.table?.includes('marketing') && (
                  <div>
                    {Object.entries(preview).slice(0, 6).map(([nom, vals]) => {
                      const valsArr = Array.isArray(vals) ? vals : vals?.vals || []
                      return (
                        <div key={nom} style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#2C2C2C', marginBottom: 4 }}>{nom}</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {valsArr.map((entry, i) => {
                              const v = typeof entry === 'object' ? entry.val : entry
                              const d = typeof entry === 'object' ? entry.date?.slice(8) + '/' + entry.date?.slice(5,7) : i+1
                              return v != null ? (
                                <div key={i} style={{ background: '#F8F7F4', borderRadius: 6, padding: '3px 7px', fontSize: 11, textAlign: 'center' }}>
                                  <div style={{ color: '#8A8A7A', fontSize: 10 }}>{d}</div>
                                  <div style={{ fontWeight: 600, color: '#2C2C2C' }}>{Math.min(100, v)}%</div>
                                </div>
                              ) : null
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {!loading && preview && (
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button style={S.btn(false)} onClick={onClose}>Annuler</button>
                <button style={S.btn(true)} onClick={() => { onApply(selectedSource, preview); onClose() }}>
                  Appliquer cette source
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}