import React from 'react'

function getPctColor(value) {
  const v = parseFloat(value)
  if (isNaN(v) || v === 0) return '#2C2C2C'
  if (v < 100) return '#E05C5C'
  if (v < 120) return '#4CAF7D'
  if (v < 150) return '#2E9455'
  return '#1a6b3c'
}

export default function KpiCard({ label, value, unit = '%', sub, badge, badgeType = 'neutral', objectif, onClick }) {
  const bgColors = { neutral: 'rgba(201,168,76,0.1)', up: 'rgba(76,175,125,0.1)', down: 'rgba(224,92,92,0.1)' }
  const textColors = { neutral: '#8a6a1a', up: '#2d7a54', down: '#a03030' }
  const objPct = objectif ? Math.min((parseFloat(value) / objectif) * 100, 100) : null
  const valueColor = unit === '%' ? getPctColor(value) : '#2C2C2C'

  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 14, padding: '20px',
      border: '1px solid rgba(201,168,76,0.15)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s'
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
    onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 600, color: valueColor, lineHeight: 1, fontFamily: 'DM Sans, sans-serif' }}>
        {value}<span style={{ fontSize: 18 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 6 }}>{sub}</div>}
      {badge && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
          marginTop: 8, background: bgColors[badgeType], color: textColors[badgeType]
        }}>
          {badge}
        </div>
      )}
      {objPct !== null && (
        <div style={{ height: 4, background: 'rgba(201,168,76,0.15)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${objPct}%`, background: valueColor, borderRadius: 2, transition: 'width 0.6s ease' }}></div>
        </div>
      )}
    </div>
  )
}
