import * as XLSX from 'xlsx'

/**
 * Génère et télécharge un fichier Excel (.xlsx)
 * @param {Array} sheets  — [{ name: 'NomOnglet', rows: [{col1: val, col2: val}] }]
 * @param {string} filename — nom du fichier sans extension
 */
export function exportToXlsx(sheets, filename) {
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, rows }) => {
    if (!rows || rows.length === 0) return
    const ws = XLSX.utils.json_to_sheet(rows)
    // Largeur auto des colonnes
    const cols = Object.keys(rows[0])
    ws['!cols'] = cols.map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length), 10)
    }))
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31))
  })
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Formate un label de période pour le nom de fichier
 */
export function labelToFilename(label) {
  return (label || 'Global').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_')
}
