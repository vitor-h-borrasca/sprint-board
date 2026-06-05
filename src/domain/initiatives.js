import { MAX_INITIATIVES_PER_QUARTER } from './constants'

// ── Validação ─────────────────────────────────────────────────────────────────

/**
 * Conta quantas iniciativas (isInitiative=true) existem num quarter,
 * opcionalmente excluindo um ID (útil no edit).
 */
export function countInitiativesInQuarter(initiatives, quarter, excludeId = null) {
  return initiatives.filter(
    (i) => i.isInitiative !== false && i.quarter === quarter && i.id !== excludeId
  ).length
}

/**
 * Retorna erro string se a adição violaria o limite, ou null se ok.
 */
export function validateInitiativeLimit(initiatives, quarter, excludeId = null) {
  const count = countInitiativesInQuarter(initiatives, quarter, excludeId)
  if (count >= MAX_INITIATIVES_PER_QUARTER) {
    return `Limite de ${MAX_INITIATIVES_PER_QUARTER} iniciativas por quarter atingido no ${quarter}.\nDesmarque uma existente ou escolha outro quarter.`
  }
  return null
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export function newInitiativeDefaults(quarter = 'Q1') {
  return {
    title: '',
    size: 'M',
    tag: 'tec',
    quarter,
    status: 'notstarted',
    description: '',
    linkedSprintIds: [],
    isInitiative: true,
    prioritized: true,
  }
}

// ── Queries de resumo por quarter ─────────────────────────────────────────────

export function quarterStats(initiatives, shr) {
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
  return QUARTERS.map((q) => {
    const qi = initiatives.filter((i) => i.quarter === q)
    return {
      quarter: q,
      total: qi.length,
      done: qi.filter((i) => i.status === 'done').length,
      late: qi.filter((i) => i.status === 'late').length,
      doing: qi.filter((i) => i.status === 'doing').length,
      initiativeCount: qi.filter((i) => i.isInitiative !== false).length,
      depriorizedCount: qi.filter((i) => i.prioritized === false).length,
      totalHrs: qi.reduce((s, i) => s + ((shr || {})[i.size] || 0), 0),
      items: qi,
    }
  })
}

// ── Toggle priorização ────────────────────────────────────────────────────────

export function togglePrioritized(initiatives, id) {
  return initiatives.map((i) =>
    i.id === id ? { ...i, prioritized: i.prioritized === false ? true : false } : i
  )
}

export function setInitiativeStatus(initiatives, id, status) {
  return initiatives.map((i) => (i.id === id ? { ...i, status } : i))
}
