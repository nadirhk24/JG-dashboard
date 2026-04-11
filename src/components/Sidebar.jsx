import React from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { section: 'Tableaux de bord' },
  { path: '/centre-appel', label: 'Call Center' },
  { path: '/marketing', label: 'Performance Marketing' },
  { section: 'Gestion' },
  { path: '/saisie', label: 'Saisie des données' },
  { path: '/objectifs', label: 'Objectifs' },
  { path: '/conseilleres', label: 'Conseillères' },
  { section: 'Analyse' },
  { path: '/analyse-cv', label: 'Analyse CV' },
  { path: '/historique', label: 'Historique' },
]

export default function Sidebar() {
  return (
    <aside style={{ position: 'fixed', left: 0, top: 0, width: 'var(--sidebar-width)', height: '100vh', background: '#2C2C2C', display: 'flex', flexDirection: 'column', zIndex: 100, overflowY: 'auto' }}>
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', color: '#C9A84C', fontSize: 22, fontWeight: 600, letterSpacing: 1 }}>JG</span>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.6)', letterSpacing: 3, textTransform: 'uppercase' }}>Promoteur Immobilier</div>
      </div>
      <nav style={{ flex: 1, padding: '16px 0' }}>
        {navItems.map((item, i) => {
          if (item.section) return (
            <div key={i} style={{ padding: '12px 24px 4px', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: i === 0 ? 0 : 8 }}>{item.section}</div>
          )
          return (
            <NavLink key={item.path} to={item.path} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px',
              textDecoration: 'none', fontSize: 13, fontWeight: isActive ? 500 : 400,
              color: isActive ? '#C9A84C' : 'rgba(255,255,255,0.5)',
              borderLeft: isActive ? '3px solid #C9A84C' : '3px solid transparent',
              background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent', transition: 'all 0.2s'
            })}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}></span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
