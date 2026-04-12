import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calcLeadsNets } from '../lib/kpi'
import SectionTitle from '../components/SectionTitle'
import PageHeader from '../components/PageHeader'

export default function Saisie({ conseilleres, saisies, reload }) {
  const today = new Date().toISOString().split('T')[0]
  const [mode, setMode] = useState('jour')
  const [form, setForm] = useState({
    conseillere_id: '', date: today, date_debut: '', date_fin: '',
    leads_bruts: '', indispos: '', echanges: '', rdv: '', visites: '', ventes: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [historique, setHistorique] = useState([])

  useEffect(() => { loadHistorique() }, [saisies])

  function loadHistorique() {
    // Grouper par batch (conseillere + periode)
    const recent = [...saisies].slice(0, 50)
    setHistorique(recent)
  }

  const leadsNets = calcLeadsNets(parseInt(form.leads_bruts) || 0, parseInt(form.indispos) || 0)

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function checkExistingData() {
    if (!form.conseillere_id) { setMsg({ type: 'error', text: 'Sélectionne une conseillère' }); return }
    
    let dates = []
    if (mode === 'jour') {
      dates = [form.date]
    } else {
      const debut = new Date(form.date_debut)
      const fin = new Date(form.date_fin)
      const days = Math.round((fin - debut) / 86400000) + 1
      if (days <= 0) { setMsg({ type: 'error', text: 'Dates invalides' }); return }
      for (let i = 0; i < days; i++) {
        const d = new Date(debut); d.setDate(d.getDate() + i)
        dates.push(d.toISOString().split('T')[0])
      }
    }

    // Verifier si des donnees existent
    const { data: existing } = await supabase
      .from('saisies')
      .select('date')
      .eq('conseillere_id', form.conseillere_id)
      .in('date', dates)

    if (existing && existing.length > 0) {
      setConfirmModal({
        dates,
        existingDates: existing.map(e => e.date),
        message: `Des données existent déjà pour ${existing.length} jour(s) sur cette période.`
      })
    } else {
      await saveData(dates)
    }
  }

  async function saveData(dates) {
    setSaving(true)
    setConfirmModal(null)

    const base = f => parseInt(form[f]) || 0
    const totalDays = dates.length

    // Sauvegarder historique avant ecrasement
    const { data: oldData } = await supabase
      .from('saisies')
      .select('*')
      .eq('conseillere_id', form.conseillere_id)
      .in('date', dates)

    if (oldData && oldData.length > 0) {
      // Sauvegarder dans historique_saisies
      const backups = oldData.map(d => ({
        saisie_id: d.id,
        conseillere_id: d.conseillere_id,
        date: d.date,
        ancienne_valeur: JSON.stringify(d),
        created_at: new Date().toISOString()
      }))
      await supabase.from('historique_saisies').upsert(backups, { onConflict: 'saisie_id' })
    }

    const rows = dates.map(dateStr => ({
      conseillere_id: form.conseillere_id,
      date: dateStr,
      leads_bruts: Math.round(base('leads_bruts') / totalDays),
      indispos: Math.round(base('indispos') / totalDays),
      leads_nets: Math.round(leadsNets / totalDays),
      echanges: Math.round(base('echanges') / totalDays),
      rdv: Math.round(base('rdv') / totalDays),
      visites: Math.round(base('visites') / totalDays),
      ventes: Math.round(base('ventes') / totalDays),
    }))

    const { error } = await supabase
      .from('saisies')
      .upsert(rows, { onConflict: 'conseillere_id,date' })

    setSaving(false)

    if (error) {
      setMsg({ type: 'error', text: 'Erreur: ' + error.message })
    } else {
      setMsg({ type: 'success', text: totalDays === 1 ? 'Données enregistrées !' : `Données enregistrées sur ${totalDays} jours !` })
      reload()
      setForm(prev => ({ ...prev, leads_bruts: '', indispos: '', echanges: '', rdv: '', visites: '', ventes: '' }))
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function annulerMiseAJour(saisieId) {
    const { data: backup } = await supabase
      .from('historique_saisies')
      .select('*')
      .eq('saisie_id', saisieId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!backup) { setMsg({ type: 'error', text: 'Aucun historique disponible pour cette saisie' }); return }

    const ancienne = JSON.parse(backup.ancienne_valeur)
    delete ancienne.id
    const { error } = await supabase
      .from('saisies')
      .update(ancienne)
      .eq('id', saisieId)

    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'success', text: 'Mise à jour annulée — données restaurées !' })
      reload()
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function supprimerSaisie(id) {
    if (!window.confirm('Supprimer cette saisie ?')) return
    await supabase.from('saisies').delete().eq('id', id)
    reload()
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8,
    fontSize: 14, color: '#2C2C2C', background: '#F8F7F4', outline: 'none',
  }
  const labelStyle = { fontSize: 11, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 6, display: 'block' }

  const conseillereNom = (id) => conseilleres.find(c => c.id === id)?.nom || '—'

  return (
    <div>
      <PageHeader title="Saisie des données" subtitle="Enregistre les chiffres par conseillère" />

      {/* Modal confirmation mise a jour */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 460, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#2C2C2C', marginBottom: 12 }}>
              Mise à jour ?
            </div>
            <div style={{ fontSize: 14, color: '#5A5A5A', marginBottom: 8, lineHeight: 1.6 }}>
              {confirmModal.message}
            </div>
            <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 500, marginBottom: 20 }}>
              S'agit-il d'une mise à jour des données existantes ?
            </div>
            <div style={{ padding: '12px 16px', background: 'rgba(201,168,76,0.05)', borderRadius: 10, border: '1px solid rgba(201,168,76,0.2)', marginBottom: 24, fontSize: 12, color: '#8A8A7A' }}>
              Les données actuelles seront sauvegardées dans l'historique. Tu pourras annuler la mise à jour depuis le tableau en bas.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => saveData(confirmModal.dates)} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                Oui, mettre à jour
              </button>
              <button onClick={() => setConfirmModal(null)} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#fff', color: '#5A5A5A', border: '1.5px solid rgba(201,168,76,0.25)', fontSize: 14, cursor: 'pointer' }}>
                Non, annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030', border: `1px solid ${msg.type === 'success' ? 'rgba(76,175,125,0.3)' : 'rgba(224,92,92,0.3)'}` }}>
          {msg.text}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 14, padding: 28, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[['jour','Saisie par jour'],['periode','Saisie par période']].map(([k,l]) => (
            <button key={k} onClick={() => setMode(k)} style={{ padding: '8px 20px', borderRadius: 20, border: `1.5px solid ${mode===k?'#C9A84C':'rgba(201,168,76,0.25)'}`, background: mode===k?'#C9A84C':'#fff', color: mode===k?'#fff':'#5A5A5A', fontSize: 13, fontWeight: mode===k?500:400, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mode === 'jour' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Conseillère *</label>
            <div style={{ position: 'relative' }}>
              <select value={form.conseillere_id} onChange={e => handleChange('conseillere_id', e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 32 }}>
                <option value="">Sélectionner...</option>
                {conseilleres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', fontSize: 11 }}>▼</span>
            </div>
          </div>
          {mode === 'jour' ? (
            <div><label style={labelStyle}>Date *</label><input type="date" value={form.date} onChange={e => handleChange('date', e.target.value)} style={inputStyle}/></div>
          ) : (
            <>
              <div><label style={labelStyle}>Date début *</label><input type="date" value={form.date_debut} onChange={e => handleChange('date_debut', e.target.value)} style={inputStyle}/></div>
              <div><label style={labelStyle}>Date fin *</label><input type="date" value={form.date_fin} onChange={e => handleChange('date_fin', e.target.value)} style={inputStyle}/></div>
            </>
          )}
        </div>

        {mode === 'periode' && (
          <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.08)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#8a6a1a' }}>
            Les chiffres saisis seront répartis uniformément sur chaque jour de la période.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <div><label style={labelStyle}>Leads Bruts</label><input type="number" min="0" value={form.leads_bruts} onChange={e => handleChange('leads_bruts', e.target.value)} placeholder="ex: 120" style={inputStyle}/></div>
          <div><label style={labelStyle}>Indispos (injoignables)</label><input type="number" min="0" value={form.indispos} onChange={e => handleChange('indispos', e.target.value)} placeholder="ex: 20" style={inputStyle}/></div>
          <div><label style={labelStyle}>Leads Nets (auto)</label><input type="number" value={mode === 'jour' ? leadsNets : '—'} readOnly style={{ ...inputStyle, background: '#F7F0DC', borderColor: '#C9A84C', color: '#8a6a1a', fontWeight: 500 }}/></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[['echanges','Échanges'],['rdv','RDV fixés'],['visites','Visites (présences)'],['ventes','Ventes']].map(([k,l]) => (
            <div key={k}><label style={labelStyle}>{l}</label><input type="number" min="0" value={form[k]} onChange={e => handleChange(k, e.target.value)} placeholder="0" style={inputStyle}/></div>
          ))}
        </div>

        <button onClick={checkExistingData} disabled={saving} style={{ background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Enregistrement...' : 'Enregistrer les données'}
        </button>
      </div>

      <SectionTitle>Historique des saisies</SectionTitle>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date','Conseillère','Leads Bruts','Indispos','Leads Nets','Échanges','RDV','Visites','Ventes','Actions'].map(h => (
                <th key={h} style={{ fontSize: 10, color: '#5A5A5A', padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historique.map(s => (
              <tr key={s.id} onMouseEnter={e => e.currentTarget.style.background = '#F7F0DC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px', fontSize: 12, fontWeight: 500, color: '#C9A84C' }}>{s.date}</td>
                <td style={{ padding: '10px', fontSize: 13, fontWeight: 500 }}>{conseillereNom(s.conseillere_id)}</td>
                <td style={{ padding: '10px', fontSize: 12 }}>{s.leads_bruts}</td>
                <td style={{ padding: '10px', fontSize: 12, color: '#E05C5C' }}>{s.indispos}</td>
                <td style={{ padding: '10px', fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>{s.leads_nets}</td>
                <td style={{ padding: '10px', fontSize: 12 }}>{s.echanges}</td>
                <td style={{ padding: '10px', fontSize: 12 }}>{s.rdv}</td>
                <td style={{ padding: '10px', fontSize: 12 }}>{s.visites}</td>
                <td style={{ padding: '10px', fontSize: 12 }}>{s.ventes}</td>
                <td style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => annulerMiseAJour(s.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', background: 'transparent', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      ↩ Annuler MàJ
                    </button>
                    <button onClick={() => supprimerSaisie(s.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(224,92,92,0.3)', color: '#E05C5C', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>
                      Suppr.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {historique.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px 0', color: '#5A5A5A', fontSize: 13 }}>Aucune saisie pour l'instant</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
