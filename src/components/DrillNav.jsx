import React, { useState, useMemo } from 'react'

export const MOIS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function getQuarter(month) { return Math.floor(month / 3) + 1 }

export default function DrillNav({ data, onSelect, selected, dateField = 'date' }) {
  const [expandedYear, setExpandedYear] = useState(null)
  const [expandedQ, setExpandedQ] = useState(null)
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const years = useMemo(() => {
    const ys = {}
    data.forEach(s => {
      const dateVal = s[dateField] || s.date || s.date_debut
      if (!dateVal) return
      const d = new Date(String(dateVal).substring(0, 10) + 'T12:00:00')
      const y = d.getFullYear(), m = d.getMonth(), q = getQuarter(m)
      if (!ys[y]) ys[y] = {}
      if (!ys[y][q]) ys[y][q] = new Set()
      ys[y][q].add(m)
    })
    return ys
  }, [data, dateField])

  const btnStyle = (active, color = '#C9A84C') => ({
    padding: '5px 12px', borderRadius: 14, fontSize: 12, cursor: 'pointer',
    border: `1.5px solid ${active ? color : 'rgba(201,168,76,0.2)'}`,
    background: active ? color : '#fff', color: active ? '#fff' : '#5A5A5A',
    fontWeight: active ? 500 : 400, transition: 'all 0.15s', whiteSpace: 'nowrap'
  })

  function applyCustom() {
    if (!customFrom || !customTo) return
    if (customFrom > customTo) return
    onSelect({
      type: 'custom',
      from: customFrom,
      to: customTo,
      label: `${customFrom} → ${customTo}`
    })
    setShowCustom(false)
  }

  function resetDrill() {
    setExpandedYear(null)
    setExpandedQ(null)
    setExpandedMonth(null)
  }

  const isCustomActive = selected?.type === 'custom'

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(201,168,76,0.15)', marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Global */}
        <button style={btnStyle(!selected || selected.type === 'global')}
          onClick={() => { onSelect({ type: 'global', label: 'Global' }); resetDrill() }}>
          Global
        </button>

        {/* Années */}
        {Object.keys(years).sort().reverse().map(year => (
          <React.Fragment key={year}>
            <button style={btnStyle(selected?.type === 'year' && selected?.value === year)}
              onClick={() => {
                setExpandedYear(expandedYear === year ? null : year)
                setExpandedQ(null); setExpandedMonth(null)
                onSelect({ type: 'year', value: year, label: year })
              }}>
              {year} {expandedYear === year ? '▼' : '▶'}
            </button>

            {expandedYear === year && Object.keys(years[year]).sort((a,b)=>a-b).map(q => (
              <React.Fragment key={q}>
                <button style={btnStyle(selected?.type === 'quarter' && selected?.value === `${year}-Q${q}`, '#534AB7')}
                  onClick={() => {
                    setExpandedQ(expandedQ === `${year}-Q${q}` ? null : `${year}-Q${q}`)
                    setExpandedMonth(null)
                    onSelect({ type: 'quarter', value: `${year}-Q${q}`, label: `T${q} ${year}` })
                  }}>
                  T{q} {expandedQ === `${year}-Q${q}` ? '▼' : '▶'}
                </button>

                {expandedQ === `${year}-Q${q}` && [...years[year][q]].sort((a,b)=>a-b).map(m => {
                  const mKey = `${year}-${String(m+1).padStart(2,'0')}`
                  return (
                    <React.Fragment key={m}>
                      <button style={btnStyle(selected?.type === 'month' && selected?.value === mKey, '#4CAF7D')}
                        onClick={() => {
                          setExpandedMonth(expandedMonth === mKey ? null : mKey)
                          onSelect({ type: 'month', value: mKey, label: `${MOIS_SHORT[m]} ${year}` })
                        }}>
                        {MOIS_SHORT[m]} {expandedMonth === mKey ? '▼' : '▶'}
                      </button>

                      {expandedMonth === mKey && (() => {
                        // Générer TOUS les jours du mois (pas seulement ceux avec données)
                        const [y, mo] = mKey.split('-')
                        const daysInMonth = new Date(parseInt(y), parseInt(mo), 0).getDate()
                        const allDays = []
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${mKey}-${String(d).padStart(2, '0')}`
                          // Exclure les dimanches (jour 0 = dimanche)
                          const dayOfWeek = new Date(dateStr).getDay()
                          if (dayOfWeek !== 0) {
                            allDays.push(dateStr)
                          }
                        }
                        return allDays.map(date => (
                          <button key={date} style={btnStyle(selected?.type === 'day' && selected?.value === date, '#E07B30')}
                            onClick={() => onSelect({ type: 'day', value: date, label: date })}>
                            {new Date(date).getDate()}
                          </button>
                        ))
                      })()}
                    </React.Fragment>
                  )
                })}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}

        {/* Séparateur */}
        <div style={{ width: 1, height: 20, background: 'rgba(201,168,76,0.2)', margin: '0 4px' }} />

        {/* Bouton période personnalisée */}
        <button
          style={btnStyle(isCustomActive || showCustom, '#E07B30')}
          onClick={() => setShowCustom(p => !p)}>
          📅 Personnalisé {isCustomActive ? `(${selected.from} → ${selected.to})` : ''}
        </button>
      </div>

      {/* Sélecteur de dates */}
      {showCustom && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid rgba(201,168,76,0.1)' }}>
          <span style={{ fontSize: 12, color: '#5A5A5A' }}>Du</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.3)', fontSize: 12, background: '#F8F7F4', outline: 'none', color: '#2C2C2C' }} />
          <span style={{ fontSize: 12, color: '#5A5A5A' }}>au</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid rgba(201,168,76,0.3)', fontSize: 12, background: '#F8F7F4', outline: 'none', color: '#2C2C2C' }} />
          <button onClick={applyCustom}
            style={{ padding: '5px 16px', borderRadius: 8, background: '#C9A84C', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            Appliquer
          </button>
          {isCustomActive && (
            <button onClick={() => { onSelect({ type: 'global', label: 'Global' }); setCustomFrom(''); setCustomTo('') }}
              style={{ padding: '5px 12px', borderRadius: 8, background: 'transparent', color: '#E05C5C', border: '1px solid rgba(224,92,92,0.3)', fontSize: 12, cursor: 'pointer' }}>
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}