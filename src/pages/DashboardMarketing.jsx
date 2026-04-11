import React, { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import PeriodeFilter from '../components/PeriodeFilter'
import SectionTitle from '../components/SectionTitle'

// Tooltip bulle (i)
function InfoBulle({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 5 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(201,168,76,0.2)', color: '#C9A84C',
          fontSize: 10, fontWeight: 700, cursor: 'help', userSelect: 'none'
        }}
      >i</span>
      {show && (
        <span style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: '#2C2C2C', color: '#fff', fontSize: 11, padding: '8px 12px',
          borderRadius: 8, whiteSpace: 'nowrap', zIndex: 999, maxWidth: 260,
          whiteSpace: 'normal', lineHeight: 1.5, minWidth: 180,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: 5, borderStyle: 'solid', borderColor: '#2C2C2C transparent transparent transparent' }}></span>
        </span>
      )}
    </span>
  )
}

function calcTaux(val, base) {
  if (!base || base === 0) return 0
  return parseFloat(((val / base) * 100).toFixed(1))
}

function calcCV(valeurs) {
  const vals = valeurs.filter(v => v > 0)
  if (vals.length < 2) return 0
  const moy = vals.reduce((a, b) => a + b, 0) / vals.length
  if (moy === 0) return 0
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0) / vals.length
  return parseFloat(((Math.sqrt(variance) / moy) * 100).toFixed(1))
}

const BULLES = {
  injections: "Nombre total de nouveaux leads reçus sur la période",
  non_exploitables: "Leads inutilisables : faux numéros, doublons, hors cible...",
  indispos: "Leads qui n'ont pas répondu après plusieurs tentatives d'appel",
  base_nette: "Leads réellement exploitables après exclusion des non exploitables et indispos",
  suivis: "Prospects qui montrent de l'intérêt sans avoir pu fixer un RDV",
  rdv: "Leads exploitables qui ont accepté un rendez-vous",
  visites: "Leads qui se sont présentés au rendez-vous fixé",
  ventes: "Leads qui ont abouti à une vente",
  taux_non_exploitables: "Non exploitables sur le total des injections brutes",
  taux_indispos: "Indispos sur le total des injections brutes",
  taux_suivis: "Suivis sur la base nette (hors non exploitables et indispos)",
  taux_rdv: "RDV fixés sur la base nette (hors non exploitables et indispos)",
  taux_visites: "Présences sur la base nette (hors non exploitables et indispos)",
  taux_ventes: "Ventes sur la base nette (hors non exploitables et indispos)",
}

function LabelWithInfo({ label, infoKey, style = {} }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
      {label}<InfoBulle text={BULLES[infoKey]} />
    </span>
  )
}

const periodeLabels = { jour: '30 derniers jours', semaine: '12 dernières semaines', mois: '24 derniers mois', trimestre: '8 derniers trimestres', perso: 'Période personnalisée' }

export default function DashboardMarketing({ conseilleres, saisies, reload }) {
  const [periode, setPeriode] = useState('mois')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [showSaisie, setShowSaisie] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const today = new Date().toISOString().split('T')[0]
  const [saisieMode, setSaisieMode] = useState('jour')
  const [form, setForm] = useState({
    date: today, date_debut: '', date_fin: '',
    injections: '', non_exploitables: '', indispos: '',
    suivis: '', rdv: '', visites: '', ventes: ''
  })

  // Données marketing depuis table marketing_saisies (Supabase)
  const [marketingData, setMarketingData] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  // Charger les données marketing au montage
  React.useEffect(() => {
    loadMarketing()
  }, [])

  async function loadMarketing() {
    setLoadingData(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase.from('marketing_saisies').select('*').order('date', { ascending: false })
      setMarketingData(data || [])
    } catch (e) { console.error(e) }
    setLoadingData(false)
  }

  function handleChange(field, val) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { supabase } = await import('../lib/supabase')
    const base = (f) => parseInt(form[f]) || 0

    if (saisieMode === 'jour') {
      const payload = {
        date: form.date,
        injections: base('injections'),
        non_exploitables: base('non_exploitables'),
        indispos: base('indispos'),
        suivis: base('suivis'),
        rdv: base('rdv'),
        visites: base('visites'),
        ventes: base('ventes'),
      }
      const { error } = await supabase.from('marketing_saisies').upsert(payload, { onConflict: 'date' })
      if (error) { setMsg({ type: 'error', text: error.message }) }
      else { setMsg({ type: 'success', text: 'Données enregistrées !' }); loadMarketing(); setTimeout(() => setMsg(null), 3000) }
    } else {
      const debut = new Date(form.date_debut)
      const fin = new Date(form.date_fin)
      const days = Math.round((fin - debut) / (1000 * 60 * 60 * 24)) + 1
      if (days <= 0) { setMsg({ type: 'error', text: 'Dates invalides' }); setSaving(false); return }
      const rows = []
      for (let i = 0; i < days; i++) {
        const d = new Date(debut); d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        rows.push({
          date: dateStr,
          injections: Math.round(base('injections') / days),
          non_exploitables: Math.round(base('non_exploitables') / days),
          indispos: Math.round(base('indispos') / days),
          suivis: Math.round(base('suivis') / days),
          rdv: Math.round(base('rdv') / days),
          visites: Math.round(base('visites') / days),
          ventes: Math.round(base('ventes') / days),
        })
      }
      const { error } = await supabase.from('marketing_saisies').upsert(rows, { onConflict: 'date' })
      if (error) { setMsg({ type: 'error', text: error.message }) }
      else { setMsg({ type: 'success', text: `Données enregistrées sur ${days} jours !` }); loadMarketing(); setTimeout(() => setMsg(null), 3000) }
    }
    setSaving(false)
  }

  // Filtrer par période
  const dataFiltree = useMemo(() => {
    if (!marketingData.length) return []
    const now = new Date()
    let debut, fin = now
    if (periode === 'jour') debut = new Date(now - 30 * 86400000)
    else if (periode === 'semaine') debut = new Date(now - 84 * 86400000)
    else if (periode === 'mois') debut = new Date(now.getFullYear() - 2, now.getMonth(), 1)
    else if (periode === 'trimestre') debut = new Date(now.getFullYear() - 2, 0, 1)
    else if (periode === 'perso') {
      debut = dateDebut ? new Date(dateDebut) : new Date(now.getFullYear(), 0, 1)
      fin = dateFin ? new Date(dateFin) : now
    } else debut = new Date(2000, 0, 1)
    return marketingData.filter(s => {
      const d = new Date(s.date)
      return d >= debut && d <= fin
    })
  }, [marketingData, periode, dateDebut, dateFin])

  // Agréger toutes les données
  const totaux = useMemo(() => {
    const t = dataFiltree.reduce((acc, s) => ({
      injections: acc.injections + (s.injections || 0),
      non_exploitables: acc.non_exploitables + (s.non_exploitables || 0),
      indispos: acc.indispos + (s.indispos || 0),
      suivis: acc.suivis + (s.suivis || 0),
      rdv: acc.rdv + (s.rdv || 0),
      visites: acc.visites + (s.visites || 0),
      ventes: acc.ventes + (s.ventes || 0),
    }), { injections: 0, non_exploitables: 0, indispos: 0, suivis: 0, rdv: 0, visites: 0, ventes: 0 })
    const base_nette = Math.max(0, t.injections - t.non_exploitables - t.indispos)
    return {
      ...t, base_nette,
      taux_non_exp: calcTaux(t.non_exploitables, t.injections),
      taux_indispos: calcTaux(t.indispos, t.injections),
      taux_suivis: calcTaux(t.suivis, base_nette),
      taux_rdv: calcTaux(t.rdv, base_nette),
      taux_visites: calcTaux(t.visites, base_nette),
      taux_ventes: calcTaux(t.ventes, base_nette),
    }
  }, [dataFiltree])

  // Grouper par période pour tableau et graphes
  const groupedData = useMemo(() => {
    const groups = {}
    dataFiltree.forEach(s => {
      let key
      if (periode === 'jour') key = s.date
      else if (periode === 'semaine') {
        const d = new Date(s.date)
        const day = d.getDay() || 7
        const mon = new Date(d); mon.setDate(d.getDate() - day + 1)
        key = mon.toISOString().split('T')[0]
      } else if (periode === 'mois' || periode === 'perso') key = s.date.substring(0, 7)
      else { const d = new Date(s.date); key = `${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}` }
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
      const t = items.reduce((acc, s) => ({
        injections: acc.injections + (s.injections || 0),
        non_exploitables: acc.non_exploitables + (s.non_exploitables || 0),
        indispos: acc.indispos + (s.indispos || 0),
        suivis: acc.suivis + (s.suivis || 0),
        rdv: acc.rdv + (s.rdv || 0),
        visites: acc.visites + (s.visites || 0),
        ventes: acc.ventes + (s.ventes || 0),
      }), { injections: 0, non_exploitables: 0, indispos: 0, suivis: 0, rdv: 0, visites: 0, ventes: 0 })
      const base_nette = Math.max(0, t.injections - t.non_exploitables - t.indispos)
      let label = key
      if (periode === 'jour') label = key.substring(5)
      else if (periode === 'semaine') label = 'S ' + key.substring(5)
      else if (periode === 'mois' || periode === 'perso') {
        const [y, m] = key.split('-')
        const mois = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
        label = `${mois[parseInt(m)-1]} ${y.substring(2)}`
      }
      return {
        key, label, ...t, base_nette,
        taux_non_exp: calcTaux(t.non_exploitables, t.injections),
        taux_indispos: calcTaux(t.indispos, t.injections),
        taux_suivis: calcTaux(t.suivis, base_nette),
        taux_rdv: calcTaux(t.rdv, base_nette),
        taux_visites: calcTaux(t.visites, base_nette),
        taux_ventes: calcTaux(t.ventes, base_nette),
      }
    })
  }, [dataFiltree, periode])

  // CV par indicateur
  const cvs = useMemo(() => ({
    taux_non_exp: calcCV(groupedData.map(r => r.taux_non_exp)),
    taux_indispos: calcCV(groupedData.map(r => r.taux_indispos)),
    taux_suivis: calcCV(groupedData.map(r => r.taux_suivis)),
    taux_rdv: calcCV(groupedData.map(r => r.taux_rdv)),
    taux_visites: calcCV(groupedData.map(r => r.taux_visites)),
    taux_ventes: calcCV(groupedData.map(r => r.taux_ventes)),
  }), [groupedData])

  const tooltipStyle = { background: '#2C2C2C', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }
  const cardStyle = { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }
  const thStyle = { fontSize: 10, color: '#5A5A5A', textAlign: 'left', padding: '8px 8px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, whiteSpace: 'nowrap' }
  const tdStyle = { padding: '9px 8px', fontSize: 11, borderBottom: '1px solid rgba(201,168,76,0.06)', whiteSpace: 'nowrap' }
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none' }
  const labelStyle = { fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 5, display: 'flex', alignItems: 'center' }

  const kpiCards = [
    { key: 'injections', label: 'Injections', val: totaux.injections, unit: '', color: '#C9A84C', info: 'injections' },
    { key: 'non_exploitables', label: 'Non exploitables', val: totaux.non_exploitables, unit: '', color: '#8A8A7A', info: 'non_exploitables', taux: totaux.taux_non_exp, taux_info: 'taux_non_exploitables' },
    { key: 'indispos', label: 'Indispos', val: totaux.indispos, unit: '', color: '#E05C5C', info: 'indispos', taux: totaux.taux_indispos, taux_info: 'taux_indispos' },
    { key: 'base_nette', label: 'Base nette', val: totaux.base_nette, unit: '', color: '#378ADD', info: 'base_nette' },
    { key: 'suivis', label: 'Suivis', val: totaux.suivis, unit: '', color: '#C9A84C', info: 'suivis', taux: totaux.taux_suivis, taux_info: 'taux_suivis' },
    { key: 'rdv', label: 'RDV', val: totaux.rdv, unit: '', color: '#534AB7', info: 'rdv', taux: totaux.taux_rdv, taux_info: 'taux_rdv' },
    { key: 'visites', label: 'Visites', val: totaux.visites, unit: '', color: '#4CAF7D', info: 'visites', taux: totaux.taux_visites, taux_info: 'taux_visites' },
    { key: 'ventes', label: 'Ventes', val: totaux.ventes, unit: '', color: '#1a6b3c', info: 'ventes', taux: totaux.taux_ventes, taux_info: 'taux_ventes' },
  ]

  return (
    <div>
      <PageHeader title="Dashboard Marketing" subtitle={periodeLabels[periode] || 'Période personnalisée'}>
        <PeriodeFilter value={periode} onChange={setPeriode} dateDebut={dateDebut} dateFin={dateFin} onDateChange={(t, v) => t === 'debut' ? setDateDebut(v) : setDateFin(v)} />
        <button onClick={() => setShowSaisie(!showSaisie)} style={{
          padding: '8px 18px', borderRadius: 20, border: '1.5px solid #C9A84C',
          background: showSaisie ? '#C9A84C' : '#fff', color: showSaisie ? '#fff' : '#C9A84C',
          fontSize: 12, fontWeight: 500, cursor: 'pointer'
        }}>
          {showSaisie ? '✕ Fermer saisie' : '+ Saisir données'}
        </button>
      </PageHeader>

      {showSaisie && (
        <div style={{ ...cardStyle, borderColor: '#C9A84C' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[['jour', 'Par jour'], ['periode', 'Par période']].map(([k, l]) => (
              <button key={k} onClick={() => setSaisieMode(k)} style={{
                padding: '7px 18px', borderRadius: 16,
                border: `1.5px solid ${saisieMode === k ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
                background: saisieMode === k ? '#C9A84C' : '#fff',
                color: saisieMode === k ? '#fff' : '#5A5A5A',
                fontSize: 12, fontWeight: saisieMode === k ? 500 : 400, cursor: 'pointer'
              }}>{l}</button>
            ))}
          </div>

          {msg && (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030' }}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: saisieMode === 'jour' ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16, maxWidth: 400 }}>
              {saisieMode === 'jour' ? (
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)} style={inputStyle} />
                </div>
              ) : (
                <>
                  <div>
                    <label style={labelStyle}>Date début</label>
                    <input type="date" value={form.date_debut} onChange={e => handleChange('date_debut', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date fin</label>
                    <input type="date" value={form.date_fin} onChange={e => handleChange('date_fin', e.target.value)} style={inputStyle} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { key: 'injections', label: 'Injections', info: 'injections', color: '#C9A84C' },
                { key: 'non_exploitables', label: 'Non exploitables', info: 'non_exploitables', color: '#8A8A7A' },
                { key: 'indispos', label: 'Indispos', info: 'indispos', color: '#E05C5C' },
                { key: 'suivis', label: 'Suivis', info: 'suivis', color: '#C9A84C' },
                { key: 'rdv', label: 'RDV', info: 'rdv', color: '#534AB7' },
                { key: 'visites', label: 'Visites', info: 'visites', color: '#4CAF7D' },
                { key: 'ventes', label: 'Ventes', info: 'ventes', color: '#1a6b3c' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ ...labelStyle, color: f.color }}>
                    {f.label}<InfoBulle text={BULLES[f.info]} />
                  </label>
                  <input type="number" min="0" value={form[f.key]} onChange={e => handleChange(f.key, e.target.value)}
                    placeholder="0" style={{ ...inputStyle, borderColor: `${f.color}40` }} />
                </div>
              ))}
            </div>

            <button type="submit" disabled={saving} style={{
              background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff',
              border: 'none', padding: '11px 28px', borderRadius: 8,
              fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer'
            }}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </div>
      )}

      <SectionTitle>KPIs Globaux Marketing</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 28 }}>
        {kpiCards.map(k => (
          <div key={k.key} style={{
            background: '#fff', borderRadius: 12, padding: '18px 20px',
            border: `1px solid rgba(201,168,76,0.15)`,
            borderTop: `3px solid ${k.color}`
          }}>
            <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
              {k.label}<InfoBulle text={BULLES[k.info]} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}>
              {k.val}
            </div>
            {k.taux !== undefined && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: k.color }}>{k.taux}%</span>
                <InfoBulle text={BULLES[k.taux_info]} />
                {k.key !== 'non_exploitables' && k.key !== 'indispos' && (
                  <span style={{ fontSize: 10, color: '#8A8A7A', marginLeft: 4 }}>CV: {cvs[`taux_${k.key === 'rdv' ? 'rdv' : k.key}`] || 0}%</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Qualité des leads</div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16 }}>Non exploitables & Indispos / Injections — CV: <span style={{ color: '#C9A84C', fontWeight: 500 }}>{cvs.taux_non_exp}%</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={groupedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
              <Bar dataKey="taux_non_exp" fill="#8A8A7A" radius={[3,3,0,0]} name="Non exploit." />
              <Bar dataKey="taux_indispos" fill="#E05C5C" radius={[3,3,0,0]} name="Indispos" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#8A8A7A', display: 'inline-block' }}></span>Non exploitables</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#E05C5C', display: 'inline-block' }}></span>Indispos</span>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Conversion pipeline</div>
          <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 16 }}>Suivis, RDV, Visites, Ventes / Base nette — CV RDV: <span style={{ color: '#534AB7', fontWeight: 500 }}>{cvs.taux_rdv}%</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={groupedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
              <Line type="monotone" dataKey="taux_suivis" stroke="#C9A84C" strokeWidth={2} dot={{ r: 3 }} name="Suivis" />
              <Line type="monotone" dataKey="taux_rdv" stroke="#534AB7" strokeWidth={2} dot={{ r: 3 }} name="RDV" />
              <Line type="monotone" dataKey="taux_visites" stroke="#4CAF7D" strokeWidth={2} dot={{ r: 3 }} name="Visites" />
              <Line type="monotone" dataKey="taux_ventes" stroke="#1a6b3c" strokeWidth={2} dot={{ r: 3 }} name="Ventes" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {[['#C9A84C','Suivis'],['#534AB7','RDV'],['#4CAF7D','Visites'],['#1a6b3c','Ventes']].map(([c,l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5A5A5A' }}>
                <span style={{ width: 10, height: 2, background: c, display: 'inline-block' }}></span>{l}
              </span>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle>Vue Cohorte Marketing</SectionTitle>
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={thStyle}>Période</th>
                <th style={thStyle}><LabelWithInfo label="Injections" infoKey="injections" /></th>
                <th style={{ ...thStyle, color: '#8A8A7A' }}><LabelWithInfo label="Non Exploit." infoKey="non_exploitables" /></th>
                <th style={{ ...thStyle, color: '#8A8A7A' }}>Taux <InfoBulle text={BULLES.taux_non_exploitables} /></th>
                <th style={thStyle}><LabelWithInfo label="Indispos" infoKey="indispos" /></th>
                <th style={thStyle}>Taux <InfoBulle text={BULLES.taux_indispos} /></th>
                <th style={thStyle}><LabelWithInfo label="Base Nette" infoKey="base_nette" /></th>
                <th style={thStyle}><LabelWithInfo label="Suivis" infoKey="suivis" /></th>
                <th style={thStyle}>Taux <InfoBulle text={BULLES.taux_suivis} /></th>
                <th style={thStyle}><LabelWithInfo label="RDV" infoKey="rdv" /></th>
                <th style={thStyle}>Taux <InfoBulle text={BULLES.taux_rdv} /></th>
                <th style={thStyle}><LabelWithInfo label="Visites" infoKey="visites" /></th>
                <th style={thStyle}>Taux <InfoBulle text={BULLES.taux_visites} /></th>
                <th style={thStyle}><LabelWithInfo label="Ventes" infoKey="ventes" /></th>
                <th style={thStyle}>Taux <InfoBulle text={BULLES.taux_ventes} /></th>
              </tr>
            </thead>
            <tbody>
              {[...groupedData].reverse().map((row, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, fontWeight: 500, color: '#C9A84C' }}>{row.label}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{row.injections}</td>
                  <td style={{ ...tdStyle, color: '#8A8A7A' }}>{row.non_exploitables}</td>
                  <td style={{ ...tdStyle, color: '#8A8A7A', fontSize: 10 }}>{row.taux_non_exp}%</td>
                  <td style={{ ...tdStyle, color: '#E05C5C' }}>{row.indispos}</td>
                  <td style={{ ...tdStyle, color: '#E05C5C', fontSize: 10 }}>{row.taux_indispos}%</td>
                  <td style={{ ...tdStyle, color: '#378ADD', fontWeight: 500 }}>{row.base_nette}</td>
                  <td style={{ ...tdStyle, color: '#C9A84C' }}>{row.suivis}</td>
                  <td style={{ ...tdStyle, color: '#C9A84C', fontSize: 10 }}>{row.taux_suivis}%</td>
                  <td style={{ ...tdStyle, color: '#534AB7' }}>{row.rdv}</td>
                  <td style={{ ...tdStyle, color: '#534AB7', fontSize: 10 }}>{row.taux_rdv}%</td>
                  <td style={{ ...tdStyle, color: '#4CAF7D' }}>{row.visites}</td>
                  <td style={{ ...tdStyle, color: '#4CAF7D', fontSize: 10 }}>{row.taux_visites}%</td>
                  <td style={{ ...tdStyle, color: '#1a6b3c' }}>{row.ventes}</td>
                  <td style={{ ...tdStyle, color: '#1a6b3c', fontSize: 10 }}>{row.taux_ventes}%</td>
                </tr>
              ))}
              {groupedData.length === 0 && (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>
                  Aucune donnée. Cliquez sur "+ Saisir données" pour commencer.
                </td></tr>
              )}
            </tbody>
            {groupedData.length > 1 && (
              <tfoot>
                <tr style={{ background: '#F8F7F4' }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#2C2C2C' }}>CV</td>
                  <td style={tdStyle}>—</td>
                  <td style={{ ...tdStyle, color: '#8A8A7A' }}>—</td>
                  <td style={{ ...tdStyle, color: '#8A8A7A', fontWeight: 600 }}>{cvs.taux_non_exp}%</td>
                  <td style={tdStyle}>—</td>
                  <td style={{ ...tdStyle, color: '#E05C5C', fontWeight: 600 }}>{cvs.taux_indispos}%</td>
                  <td style={tdStyle}>—</td>
                  <td style={tdStyle}>—</td>
                  <td style={{ ...tdStyle, color: '#C9A84C', fontWeight: 600 }}>{cvs.taux_suivis}%</td>
                  <td style={tdStyle}>—</td>
                  <td style={{ ...tdStyle, color: '#534AB7', fontWeight: 600 }}>{cvs.taux_rdv}%</td>
                  <td style={tdStyle}>—</td>
                  <td style={{ ...tdStyle, color: '#4CAF7D', fontWeight: 600 }}>{cvs.taux_visites}%</td>
                  <td style={tdStyle}>—</td>
                  <td style={{ ...tdStyle, color: '#1a6b3c', fontWeight: 600 }}>{cvs.taux_ventes}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
