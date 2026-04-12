import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { section: 'Tableaux de bord' },
  { path: '/centre-appel', label: 'Call Center' },
  { path: '/marketing', label: 'Performance Marketing' },
  { section: 'Gestion' },
  { path: '/objectifs', label: 'Objectifs' },
  { section: 'Équipe' },
  { path: '/conseilleres', label: 'Conseillères' },
  { path: '/calendrier', label: 'Calendrier' },
  { section: 'Commercial' },
  { path: '/flux-rdv', label: 'Flux de Rendez-vous' },
  { section: 'Analyse' },
  { path: '/analyse-cv', label: 'Analyse de la capabilité' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      <aside style={{ position: 'fixed', left: 0, top: 0, width: collapsed ? 60 : 'var(--sidebar-width)', height: '100vh', background: '#2C2C2C', display: 'flex', flexDirection: 'column', zIndex: 100, overflowY: 'auto', transition: 'width 0.25s ease', overflowX: 'hidden' }}>
        <div style={{ padding: collapsed ? '20px 0' : '28px 24px 20px', borderBottom: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          {!collapsed ? (
            <div>
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', color: '#C9A84C', fontSize: 22, fontWeight: 600, letterSpacing: 1 }}>JG</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.6)', letterSpacing: 3, textTransform: 'uppercase' }}>Promoteur Immobilier</div>
            </div>
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', color: '#C9A84C', fontSize: 14, fontWeight: 600 }}>JG</span>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '16px 0' }}>
          {navItems.map((item, i) => {
            if (item.section) {
              if (collapsed) return null
              return <div key={i} style={{ padding: '12px 24px 4px', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: i === 0 ? 0 : 8 }}>{item.section}</div>
            }
            return (
              <NavLink key={item.path} to={item.path} title={collapsed ? item.label : ''} style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '12px 0' : '10px 24px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                textDecoration: 'none', fontSize: 13, fontWeight: isActive ? 500 : 400,
                color: isActive ? '#C9A84C' : 'rgba(255,255,255,0.5)',
                borderLeft: collapsed ? 'none' : isActive ? '3px solid #C9A84C' : '3px solid transparent',
                background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent', transition: 'all 0.2s'
              })}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}></span>
                {!collapsed && item.label}
              </NavLink>
            )
          })}
        </nav>

        <div style={{ padding: collapsed ? '12px 0' : '12px 16px', borderTop: '1px solid rgba(201,168,76,0.15)', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <button onClick={() => setCollapsed(p => !p)} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </aside>
      <style>{`main { margin-left: ${collapsed ? '60px' : '230px'} !important; transition: margin-left 0.25s ease; }`}</style>
    </>
  )
}
