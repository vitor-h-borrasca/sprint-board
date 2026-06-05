// ── IDs ──────────────────────────────────────────────────────────────────────

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ── Formatação ────────────────────────────────────────────────────────────────

export function fmtHrs(h) {
  if (h === 0) return '0h'
  if (h < 1) return h + 'h'
  return Number.isInteger(h) ? h + 'h' : h.toFixed(1) + 'h'
}

export function fmtDate(d) {
  if (!d) return '?'
  const [, m, dd] = d.split('-')
  return dd + '/' + m
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

// ── Datas ─────────────────────────────────────────────────────────────────────

export function calcWorkingDays(start, end) {
  if (!start || !end) return 0
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  if (e < s) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export function absWorkDaysInPeriod(absStart, absEnd, pStart, pEnd) {
  if (!absStart || !pStart || !pEnd) return 0
  const aEnd = absEnd || absStart
  const s = new Date(Math.max(+new Date(absStart + 'T12:00:00'), +new Date(pStart + 'T12:00:00')))
  const e = new Date(Math.min(+new Date(aEnd + 'T12:00:00'), +new Date(pEnd + 'T12:00:00')))
  if (e < s) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/**
 * Retorna um Set com as datas ISO (YYYY-MM-DD) de ausência de uma lista
 * de absences intersectadas com o período [pStart, pEnd].
 */
export function buildAbsDatesSet(absences, pStart, pEnd) {
  const set = new Set()
  if (!pStart || !pEnd) return set
  ;(absences || []).forEach((a) => {
    if (!a.startDate) return
    const aEnd = a.endDate || a.startDate
    const s = new Date(Math.max(+new Date(a.startDate + 'T12:00:00'), +new Date(pStart + 'T12:00:00')))
    const e = new Date(Math.min(+new Date(aEnd + 'T12:00:00'), +new Date(pEnd + 'T12:00:00')))
    const cur = new Date(s)
    while (cur <= e) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6)
        set.add(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
  })
  return set
}
