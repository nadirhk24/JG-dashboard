import React from 'react'

export default function ConseillereFilter({ conseilleres, value, onChange, multiSelect = false }) {
  const selectStyle = {
    padding: '7px 14px', borderRadius: 20,
    border: '1.5px solid rgba(201,168,76,0.2)',
    background: '#fff', fontSize: 12, color: '#5A5A5A',
    cursor: 'pointer', outline: 'none', appearance: 'none',
    paddingRight: 28
  }

  if (multiSelect) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => onChange('all')}
          style={{
            padding: '6px 14px', borderRadius: 16,
            border: `1.5px solid ${value === 'all' || value?.length === 0 ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
            background: value === 'all' || value?.length === 0 ? '#C9A84C' : '#fff',
            color: value === 'all' || value?.length === 0 ? '#fff' : '#5A5A5A',
            fontSize: 12, cursor: 'pointer', fontWeight: 500
          }}
        >
          Toute l'équipe
        </button>
        {conseilleres.map(c => {
          const selected = Array.isArray(value) ? value.includes(c.id) : false
          return (
            <button key={c.id} onClick={() => onChange(c.id)}
              style={{
                padding: '6px 14px', borderRadius: 16,
                border: `1.5px solid ${selected ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
                background: selected ? '#C9A84C' : '#fff',
                color: selected ? '#fff' : '#5A5A5A',
                fontSize: 12, cursor: 'pointer'
              }}
            >
              {c.nom}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        <option value="all">Toute l'équipe</option>
        {conseilleres.map(c => (
          <option key={c.id} value={c.id}>{c.nom}</option>
        ))}
      </select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10, color: '#C9A84C' }}>▼</span>
    </div>
  )
}
