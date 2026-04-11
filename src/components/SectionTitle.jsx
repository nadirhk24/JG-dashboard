import React from 'react'

export default function SectionTitle({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 8 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2C2C2C', whiteSpace: 'nowrap' }}>{children}</h2>
      <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,0.2)' }}></div>
    </div>
  )
}
