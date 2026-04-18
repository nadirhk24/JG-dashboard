import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import SectionTitle from '../components/SectionTitle'

const VOLETS = [
  { key: 'centre_appel',  label: 'Call Center',           icon: '📞' },
  { key: 'flux_rdv',      label: 'Flux RDV',              icon: '📅' },
  { key: 'marketing',     label: 'Marketing',             icon: '📊' },
  { key: 'analyse_cv',    label: 'Analyse Capabilité',    icon: '📈' },
  { key: 'objectifs',     label: 'Objectifs',             icon: '🎯' },
  { key: 'conseilleres',  label: 'Conseillères',          icon: '👥' },
  { key: 'commerciaux',   label: 'Commerciaux',           icon: '🏢' },
  { key: 'calendrier',    label: 'Calendrier',            icon: '🗓️' },
  { key: 'gestion_users', label: 'Gestion Utilisateurs',  icon: '🔐' },
]

const ROLE_LABELS = {
  super_admin:      { label: 'Super Admin',  color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
  responsable_sale: { label: 'Responsable',  color: '#534AB7', bg: 'rgba(83,74,183,0.1)' },
  conseillere:      { label: 'Conseillère',  color: '#2E9455', bg: 'rgba(46,148,85,0.1)' },
}

function Toggle({ value, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, background: value ? '#C9A84C' : '#D8D5CE', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

function SmallToggle({ value, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!value)} style={{ width: 32, height: 18, borderRadius: 9, background: value ? '#4CAF7D' : '#D8D5CE', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

export default function GestionUsers() {
  const [users, setUsers] = useState([])
  const [conseilleres, setConseilleres] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [msg, setMsg] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from('user_profils').select('*').order('role'),
      supabase.from('conseilleres').select('id, nom').order('nom'),
    ])
    setUsers(u || [])
    setConseilleres(c || [])
    setLoading(false)
  }

  async function savePermissions(userId, permissions) {
    setSaving(p => ({ ...p, [userId]: true }))
    const { error } = await supabase.from('user_profils').update({ permissions }).eq('id', userId)
    setSaving(p => ({ ...p, [userId]: false }))
    if (error) {
      setMsg({ type: 'error', text: 'Erreur lors de la sauvegarde' })
    } else {
      setMsg({ type: 'success', text: 'Permissions mises à jour !' })
      setTimeout(() => setMsg(null), 2500)
      loadAll()
    }
  }

  function toggleVolet(user, key) {
    savePermissions(user.id, { ...user.permissions, [key]: !user.permissions[key] })
  }

  function toggleConseillere(user, consId) {
    const current = user.permissions?.centre_appel_conseilleres || {}
    savePermissions(user.id, { ...user.permissions, centre_appel_conseilleres: { ...current, [consId]: !current[consId] } })
  }

  function toggleEquipeFlux(user, equipe) {
    const key = `flux_rdv_${equipe}`
    savePermissions(user.id, { ...user.permissions, [key]: !user.permissions[key] })
  }

  function setAll(user, value) {
    const newPerms = {}
    VOLETS.forEach(v => { newPerms[v.key] = value })
    const consPerms = {}
    conseilleres.forEach(c => { consPerms[c.id] = value })
    newPerms.centre_appel_conseilleres = consPerms
    newPerms.flux_rdv_sale = value
    newPerms.flux_rdv_kenitra = value
    savePermissions(user.id, newPerms)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #E8D5A3', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div>
      <PageHeader title="Gestion des utilisateurs" subtitle="Contrôle des accès par volet et sous-niveaux" />

      {msg && (
        <div style={{ padding: '11px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 500, background: msg.type === 'success' ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)', color: msg.type === 'success' ? '#2d7a54' : '#a03030', border: `1px solid ${msg.type === 'success' ? 'rgba(76,175,125,0.3)' : 'rgba(224,92,92,0.3)'}` }}>
          {msg.text}
        </div>
      )}

      <SectionTitle>Utilisateurs ({users.length})</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {users.map(user => {
          const ri = ROLE_LABELS[user.role] || { label: user.role, color: '#8A8A7A', bg: 'rgba(138,138,122,0.1)' }
          const isExpanded = expanded === user.id
          const isSuperAdmin = user.role === 'super_admin'
          const activeCount = VOLETS.filter(v => user.permissions?.[v.key]).length

          return (
            <div key={user.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden' }}>
              {/* Header */}
              <div onClick={() => setExpanded(isExpanded ? null : user.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: ri.bg, border: `2px solid ${ri.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, fontWeight: 600, color: ri.color }}>{user.nom.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C' }}>{user.nom}</div>
                    <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>@{user.username}</div>
                  </div>
                  <div style={{ padding: '3px 10px', borderRadius: 20, background: ri.bg, color: ri.color, fontSize: 11, fontWeight: 500 }}>{ri.label}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#C9A84C' }}>{activeCount}</div>
                    <div style={{ fontSize: 10, color: '#8A8A7A' }}>/ {VOLETS.length} volets</div>
                  </div>
                  <span style={{ color: '#C9A84C', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Panneau */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(201,168,76,0.1)', padding: '16px 20px' }}>
                  {isSuperAdmin && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', fontSize: 12, color: '#8a6a1a', marginBottom: 16 }}>
                      🔐 Super Admin — accès complet non modifiable
                    </div>
                  )}
                  {!isSuperAdmin && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button onClick={() => setAll(user, true)} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid rgba(76,175,125,0.4)', background: 'rgba(76,175,125,0.08)', color: '#2E9455', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>✓ Tout activer</button>
                      <button onClick={() => setAll(user, false)} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid rgba(224,92,92,0.4)', background: 'rgba(224,92,92,0.08)', color: '#E05C5C', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>✕ Tout désactiver</button>
                      {saving[user.id] && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8A8A7A' }}><div style={{ width: 14, height: 14, border: '2px solid #E8D5A3', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>Sauvegarde...</div>}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {VOLETS.map(v => {
                      const active = user.permissions?.[v.key] ?? false
                      const hasSub = (v.key === 'centre_appel' || v.key === 'flux_rdv') && active && !isSuperAdmin
                          const hasAnalyseSub = v.key === 'analyse_cv' && active && !isSuperAdmin

                      return (
                        <div key={v.key}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: (hasSub || hasAnalyseSub) ? '10px 10px 0 0' : 10, background: active ? 'rgba(201,168,76,0.06)' : '#F8F7F4', border: `1.5px solid ${active ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.1)'}`, borderBottom: (hasSub || hasAnalyseSub) ? 'none' : undefined, transition: 'all 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 16 }}>{v.icon}</span>
                              <span style={{ fontSize: 12, fontWeight: active ? 500 : 400, color: active ? '#2C2C2C' : '#8A8A7A' }}>{v.label}</span>
                            </div>
                            <Toggle value={active} onChange={() => toggleVolet(user, v.key)} disabled={isSuperAdmin} />
                          </div>

                          {/* Sous-niveau conseillères */}
                          {v.key === 'centre_appel' && hasSub && (
                            <div style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.03)', border: '1.5px solid rgba(201,168,76,0.3)', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                              <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 8 }}>Conseillères visibles</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {conseilleres.map(c => {
                                  const on = user.permissions?.centre_appel_conseilleres?.[c.id] ?? false
                                  return (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 7, background: on ? 'rgba(76,175,125,0.07)' : 'transparent' }}>
                                      <span style={{ fontSize: 11, color: on ? '#2C2C2C' : '#8A8A7A', fontWeight: on ? 500 : 400 }}>{c.nom}</span>
                                      <SmallToggle value={on} onChange={() => toggleConseillere(user, c.id)} />
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Sous-niveau segments Analyse CV */}
                          {v.key === 'analyse_cv' && active && !isSuperAdmin && (
                            <div style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.03)', border: '1.5px solid rgba(201,168,76,0.3)', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                              <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 8 }}>Segments visibles</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {[
                                  { key: 'analyse_cv_cc',        label: 'Call Center',  color: '#C9A84C' },
                                  { key: 'analyse_cv_marketing', label: 'Marketing',    color: '#378ADD' },
                                  { key: 'analyse_cv_flux',      label: 'Flux RDV',     color: '#534AB7', children: [
                                    { key: 'analyse_cv_flux_sale',    label: 'Sale',    color: '#C9A84C' },
                                    { key: 'analyse_cv_flux_kenitra', label: 'Kenitra', color: '#534AB7' },
                                  ]},
                                ].map(seg => {
                                  const segOn = user.permissions?.[seg.key] !== false
                                  return (
                                    <div key={seg.key}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 7, background: segOn ? `${seg.color}10` : 'transparent' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color }} />
                                          <span style={{ fontSize: 11, color: segOn ? '#2C2C2C' : '#8A8A7A', fontWeight: segOn ? 500 : 400 }}>{seg.label}</span>
                                        </div>
                                        <SmallToggle value={segOn} onChange={() => savePermissions(user.id, { ...user.permissions, [seg.key]: !segOn })} />
                                      </div>
                                      {/* Sous-équipes Flux RDV */}
                                      {seg.children && segOn && seg.children.map(child => {
                                        const childOn = user.permissions?.[child.key] !== false
                                        return (
                                          <div key={child.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 8px 3px 24px', borderRadius: 7, background: childOn ? `${child.color}08` : 'transparent' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: child.color, opacity: 0.7 }} />
                                              <span style={{ fontSize: 11, color: childOn ? '#5A5A5A' : '#ABABAB' }}>{child.label}</span>
                                            </div>
                                            <SmallToggle value={childOn} onChange={() => savePermissions(user.id, { ...user.permissions, [child.key]: !childOn })} />
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Sous-niveau équipes Flux RDV */}
                          {v.key === 'flux_rdv' && hasSub && (
                            <div style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.03)', border: '1.5px solid rgba(201,168,76,0.3)', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                              <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 8 }}>Équipes visibles</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {[{ key: 'sale', label: 'Équipe Sale', color: '#C9A84C' }, { key: 'kenitra', label: 'Équipe Kenitra', color: '#534AB7' }].map(eq => {
                                  const on = user.permissions?.[`flux_rdv_${eq.key}`] ?? false
                                  return (
                                    <div key={eq.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 7, background: on ? `${eq.color}10` : 'transparent' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: eq.color }} />
                                        <span style={{ fontSize: 11, color: on ? '#2C2C2C' : '#8A8A7A', fontWeight: on ? 500 : 400 }}>{eq.label}</span>
                                      </div>
                                      <SmallToggle value={on} onChange={() => toggleEquipeFlux(user, eq.key)} />
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
