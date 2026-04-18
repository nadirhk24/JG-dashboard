import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_STRUCTURE = [
  {
    section: 'Tableaux de bord',
    items: [
      {
        path: '/centre-appel', label: 'Call Center',
        children: [{ path: '/flux-rdv', label: 'Flux RDV' }]
      },
      { path: '/marketing', label: 'Performance Marketing' },
      { path: '/analyse-cv', label: 'Analyse Capabilité' },
    ]
  },
  {
    section: 'Gestion',
    items: [
      { path: '/objectifs', label: 'Objectifs' },
    ]
  },
  {
    section: 'Équipe',
    items: [
      { path: '/responsables', label: 'Responsables' },
      { path: '/conseilleres', label: 'Conseillères' },
      { path: '/commerciaux', label: 'Commerciaux' },
      { path: '/calendrier', label: 'Calendrier' },
    ]
  },
]

export default function Sidebar() {
  const { profil } = useAuth()
  const isSuperAdmin = profil?.role === 'super_admin'
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState({ 'Tableaux de bord': true, 'Gestion': true, 'Équipe': true })
  const [expandedItems, setExpandedItems] = useState({ '/centre-appel': false })
  const location = useLocation()

  function toggleSection(section) {
    setExpandedSections(p => ({ ...p, [section]: !p[section] }))
  }

  function toggleItem(path) {
    setExpandedItems(p => ({ ...p, [path]: !p[path] }))
  }

  const linkStyle = (isActive, level = 0) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: collapsed ? '10px 0' : `9px ${level === 1 ? '32px' : '20px'}`,
    justifyContent: collapsed ? 'center' : 'flex-start',
    textDecoration: 'none', fontSize: level === 1 ? 12 : 13,
    fontWeight: isActive ? 500 : 400,
    color: isActive ? '#C9A84C' : level === 1 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.55)',
    borderLeft: collapsed ? 'none' : isActive ? '3px solid #C9A84C' : '3px solid transparent',
    background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent',
    transition: 'all 0.15s',
  })

  return (
    <>
      <aside style={{ position: 'fixed', left: 0, top: 0, width: collapsed ? 60 : 230, height: '100vh', background: '#2C2C2C', display: 'flex', flexDirection: 'column', zIndex: 100, overflowY: 'auto', overflowX: 'hidden', transition: 'width 0.25s ease' }}>

        <div style={{ padding: collapsed ? '20px 0' : '24px 20px 16px', borderBottom: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          {!collapsed ? (
            <div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', color: '#C9A84C', fontSize: 20, fontWeight: 600 }}>JG</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.6)', letterSpacing: 3, textTransform: 'uppercase' }}>Promoteur Immobilier</div>
            </div>
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', color: '#C9A84C', fontSize: 13, fontWeight: 600 }}>JG</span>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, paddingTop: 12 }}>
          {NAV_STRUCTURE.map(({ section, items }) => (
            <div key={section}>
              {!collapsed && (
                <button onClick={() => toggleSection(section)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>
                  {section}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{expandedSections[section] ? '▼' : '▶'}</span>
                </button>
              )}
              {(collapsed || expandedSections[section]) && items.map(item => {
                const isActive = location.pathname === item.path || (item.children && item.children.some(c => location.pathname === c.path))
                const isExpanded = expandedItems[item.path]
                return (
                  <div key={item.path}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <NavLink to={item.path} style={({ isActive }) => ({ ...linkStyle(isActive), flex: 1 })} title={collapsed ? item.label : ''}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}></span>
                        {!collapsed && item.label}
                      </NavLink>
                      {!collapsed && item.children && (
                        <button onClick={() => toggleItem(item.path)} style={{ padding: '0 12px 0 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      )}
                    </div>
                    {!collapsed && item.children && isExpanded && item.children.map(child => (
                      <NavLink key={child.path} to={child.path} style={({ isActive }) => linkStyle(isActive, 1)}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}></span>
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}

        {/* Section Admin - super_admin uniquement */}
        {isSuperAdmin && (
          <div>
            {!collapsed && (
              <div style={{ padding: '8px 20px 4px', color: 'rgba(255,255,255,0.3)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>
                Admin
              </div>
            )}
            <NavLink to="/gestion-users" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 8,
              padding: collapsed ? '10px 0' : '9px 20px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              textDecoration: 'none', fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? '#C9A84C' : 'rgba(201,168,76,0.6)',
              borderLeft: collapsed ? 'none' : isActive ? '3px solid #C9A84C' : '3px solid transparent',
              background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent',
              transition: 'all 0.15s',
            })} title={collapsed ? 'Gestion Utilisateurs' : ''}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}></span>
              {!collapsed && '🔐 Gestion Utilisateurs'}
            </NavLink>
          </div>
        )}
        </nav>

        <div style={{ padding: collapsed ? '12px 0' : '12px 14px', borderTop: '1px solid rgba(201,168,76,0.15)', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <button onClick={() => setCollapsed(p => !p)} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </aside>
      <style>{`main { margin-left: ${collapsed ? '60px' : '230px'} !important; transition: margin-left 0.25s ease; }`}</style>
    </>
  )
}
