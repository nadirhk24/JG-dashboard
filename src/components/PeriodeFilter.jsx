import React, { useState } from 'react'

const periodes = [
  { key: 'jour', label: 'Jour' },
  { key: 'semaine', label: 'Semaine' },
  { key: 'mois', label: 'Mois' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'perso', label: 'Personnalisé' },
]

export default function PeriodeFilter({ value, onChange, dateDebut, dateFin, onDateChange }) {
  const btnStyle = (active) => ({
    padding: '7px 16px', borderRadius: 20,
    border: `1.5px solid ${active ? '#C9A84C' : 'rgba(201,168,76,0.2)'}`,
    background: active ? '#F7F0DC' : '#fff',
    color: active ? '#C9A84C' : '#5A5A5A',
    fontSize: 12, fontWeight: active ? 500 : 400,
    cursor: 'pointer', transition: 'all 0.2s'
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {periodes.map(p => (
        <button key={p.key} style={btnStyle(value === p.key)} onClick={() => onChange(p.key)}>
          {p.label}
        </button>
      ))}
      {value === 'perso' && (
        <>
          <input type="date" value={dateDebut || ''} onChange={e => onDateChange('debut', e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.3)', fontSize: 12, color: '#2C2C2C', background: '#fff' }} />
          <span style={{ fontSize: 12, color: '#5A5A5A' }}>→</span>
          <input type="date" value={dateFin || ''} onChange={e => onDateChange('fin', e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.3)', fontSize: 12, color: '#2C2C2C', background: '#fff' }} />
        </>
      )}
    </div>
  )
}
