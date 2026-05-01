import React from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

const ETUDES = [
  {
    id: 'commerciale-2026',
    titre: 'Étude Commerciale 2026',
    periode: 'Janvier — Avril 2026',
    description: 'Funnel Marketing · Flux RDV · CV Commerciaux · Segmentation · Cohorte Odoo',
    date: '2026-04-30',
    equipes: 'Sale + Kénitra',
    ventes: 31,
    path: '/etudes/commerciale-2026',
  },
]

export default function Etudes() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader title="Études" subtitle="Analyses approfondies · lecture seule" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginTop: 28 }}>
        {ETUDES.map(e => (
          <div
            key={e.id}
            onClick={() => navigate(e.path)}
            style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 14, padding: '24px 28px', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={el => { el.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.12)'; el.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={el => { el.currentTarget.style.boxShadow = 'none'; el.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3, background: 'linear-gradient(90deg, #C9A84C, #E8D5A3)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>{e.titre}</div>
                <div style={{ fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>{e.periode}</div>
              </div>
              <div style={{ background: '#F8F7F4', border: '1px solid #E8E6DF', borderRadius: 8, padding: '4px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>{e.ventes}</div>
                <div style={{ fontSize: 10, color: '#8A8A7A' }}>ventes</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#5A5A5A', lineHeight: 1.7, marginBottom: 14 }}>{e.description}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ background: '#F8F7F4', border: '1px solid #E8E6DF', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#5A5A5A' }}>{e.equipes}</span>
              <span style={{ background: '#F8F7F4', border: '1px solid #E8E6DF', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#5A5A5A' }}>{new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>
              Voir l'étude <span style={{ fontSize: 14 }}>→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
