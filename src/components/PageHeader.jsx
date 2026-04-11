import React from 'react'

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: '#5A5A5A' }}>{subtitle}</p>}
      </div>
      {children && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}
