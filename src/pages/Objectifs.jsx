import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

export default function Objectifs({ conseilleres, reload }) {
  const [objectifs, setObjectifs] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    loadObjectifs()
  }, [conseilleres])

  async function loadObjectifs() {
    const { data } = await supabase.from('objectifs').select('*')
    if (data) {
      const map = {}
      data.forEach(o => { map[o.conseillere_id] = o })
      setObjectifs(map)
    }
  }

  function handleChange(cId, field, value) {
    setObjectifs(prev => ({
      ...prev,
      [cId]: { ...prev[cId], conseillere_id: cId, [field]: parseFloat(value) || 0 }
    }))
  }

  async function handleSave() {
    setSaving(true)
    const rows = Object.values(objectifs)
    if (rows.length === 0) { setSaving(false); return }
    const { error } = await supabase.from('objectifs').upsert(rows, { onConflict: 'conseillere_id' })
    setSaving(false)
    if (error) {
      setMsg({ type: 'error', text: 'Erreur: ' + error.message })
    } else {
      setMsg({ type: 'success', text: 'Objectifs enregistrés !' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 8,
    fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none',
    textAlign: 'center'
  }

  const kpiFields = [
    { key: 'obj_productivite', label: 'Productivité (%)' },
    { key: 'obj_conversion_tel', label: 'Conv. Tél. (%)' },
    { key: 'obj_taux_presence', label: 'Présence (%)' },
    { key: 'obj_efficacite_comm', label: 'Eff. Comm. (%)' },
  ]

  return (
    <div>
      <PageHeader title="Objectifs" subtitle="Fixe les objectifs personnalisés par conseillère" />

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500,
          background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)',
          color: msg.type === 'success' ? '#2d7a54' : '#a03030',
          border: `1px solid ${msg.type === 'success' ? 'rgba(76,175,125,0.3)' : 'rgba(224,92,92,0.3)'}`
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid rgba(201,168,76,0.15)', marginBottom: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                  Conseillère
                </th>
                {kpiFields.map(f => (
                  <th key={f.key} style={{ fontSize: 11, color: '#5A5A5A', textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conseilleres.map(c => {
                const obj = objectifs[c.id] || {}
                return (
                  <tr key={c.id}>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 500, borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                      {c.nom}
                    </td>
                    {kpiFields.map(f => (
                      <td key={f.key} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                        <input
                          type="number" min="0" max="200" step="0.5"
                          value={obj[f.key] || ''}
                          onChange={e => handleChange(c.id, f.key, e.target.value)}
                          placeholder="—" style={inputStyle}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
              {conseilleres.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#5A5A5A', fontSize: 13 }}>
                  Aucune conseillère. Ajoutez-en d'abord dans la page Conseillères.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {conseilleres.length > 0 && (
          <button onClick={handleSave} disabled={saving} style={{
            marginTop: 20, background: saving ? '#E8D5A3' : '#C9A84C', color: '#fff',
            border: 'none', padding: '11px 28px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer'
          }}>
            {saving ? 'Enregistrement...' : 'Sauvegarder les objectifs'}
          </button>
        )}
      </div>

      <div style={{ background: 'rgba(201,168,76,0.05)', borderRadius: 12, padding: 16, border: '1px solid rgba(201,168,76,0.15)', fontSize: 13, color: '#5A5A5A' }}>
        <strong style={{ color: '#C9A84C' }}>Note :</strong> Les objectifs sont en pourcentage (%). Par exemple, 130 signifie 130%. Si une case est vide, aucun objectif ne sera affiché pour ce KPI.
      </div>
    </div>
  )
}
