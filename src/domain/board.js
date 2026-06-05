import { genId } from './utils'
import { DEFAULT_SIZE_HRS, LS_KEY, CONFIG_KEY } from './constants'

// ── Defaults de config ────────────────────────────────────────────────────────

export const DEFAULT_SPRINT_CFG = () => ({
  name: 'Sprint 1',
  startDate: '',
  endDate: '',
  workingDays: 10,
  sizeHrs: { ...DEFAULT_SIZE_HRS },
  generalAbsences: [],
})

export const DEFAULT_PET_CFG = (name) => ({
  name: name || 'Q1 2026',
  year: new Date().getFullYear(),
  quarter: 'Q1',
  startDate: '',
  endDate: '',
  workingDays: 60,
  sizeHrs: { ...DEFAULT_SIZE_HRS },
  generalAbsences: [],
  capacityAlloc: { engineering: 40, product: 30, bugs: 20, security: 10 },
})

// ── Factories ─────────────────────────────────────────────────────────────────

export function makeSprint(name) {
  return { id: genId(), sprint: { ...DEFAULT_SPRINT_CFG(), name }, tasks: [] }
}

export function makePetSlot(name) {
  return { id: genId(), pet: DEFAULT_PET_CFG(name), initiatives: [] }
}

export function getBoardDefault() {
  const slot = makeSprint('Sprint 1')
  const petSlot = makePetSlot('Q1 2026')
  return {
    activeSprintId: slot.id,
    members: [],
    sprints: [slot],
    tasks: [],
    features: [],
    activePetId: petSlot.id,
    pets: [petSlot],
  }
}

// ── Migração de schema ────────────────────────────────────────────────────────

/**
 * Suporta 3 versões anteriores de schema e normaliza para o formato atual.
 * Regra: sempre retorna { activeSprintId, members, sprints, tasks, activePetId, pets }
 */
export function migrateData(old) {
  if (!old) return null

  // v1 → v2: sprint flat + tasks flat
  if (old.sprint && Array.isArray(old.tasks)) {
    const slot = { id: genId(), sprint: old.sprint, tasks: [] }
    const petSlot = makePetSlot('Q1 2026')
    slot.tasks = old.tasks.filter((t) => t.inSprint).map((t) => ({ ...t, sprintId: slot.id }))
    const backlog = old.tasks.filter((t) => !t.inSprint).map((t) => ({ ...t, sprintId: null, inSprint: false }))
    return { activeSprintId: slot.id, members: old.members || [], sprints: [slot], tasks: backlog, activePetId: petSlot.id, pets: [petSlot] }
  }

  // v2 → v3: sprints sem pets
  if (old.sprints && !old.pets) {
    const petSlot = makePetSlot('Q1 2026')
    return migrateData({ ...old, activePetId: petSlot.id, pets: [petSlot] })
  }

  // v3 → v4: tasks distribuídas por slot, sem backlog global
  if (old.sprints && old.pets && !old.tasks) {
    const globalBacklog = []
    const newSprints = old.sprints.map((slot) => {
      const sprintTasks = []
      ;(slot.tasks || []).forEach((t) => {
        if (t.inSprint) sprintTasks.push({ ...t, sprintId: slot.id })
        else globalBacklog.push({ ...t, sprintId: null, inSprint: false })
      })
      return { ...slot, tasks: sprintTasks }
    })
    return { ...old, sprints: newSprints, tasks: globalBacklog }
  }

  return old
}

// ── Persistência local ────────────────────────────────────────────────────────

export function loadBoardData() {
  try {
    const v4 = localStorage.getItem(LS_KEY)
    if (v4) {
      const p = JSON.parse(v4)
      if (p.sprints) return migrateData(p)
    }
    const v3 = localStorage.getItem('sprint-board-v3')
    if (v3) {
      const p = JSON.parse(v3)
      if (p.sprint) return migrateData(p)
    }
    return getBoardDefault()
  } catch {
    return getBoardDefault()
  }
}

export function saveBoardData(d) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)) } catch (e) { console.error(e) }
}

export function getScriptUrl() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}').scriptUrl || '' } catch { return '' }
}

export function setScriptUrl(url) {
  try {
    const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}')
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, scriptUrl: url }))
  } catch (e) { console.error(e) }
}

export function getAzureConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}')
    return {
      org: cfg.azureOrg || '',
      project: cfg.azureProject || '',
      pat: cfg.azurePat || '',
      evalAreaPath: cfg.evalAreaPath || '',
    }
  } catch { return { org: '', project: '', pat: '', evalAreaPath: '' } }
}

export function setAzureConfig({ org, project, pat }) {
  try {
    const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}')
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, azureOrg: org, azureProject: project, azurePat: pat }))
  } catch (e) { console.error(e) }
}

export function setEvalAreaPath(path) {
  try {
    const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}')
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, evalAreaPath: path }))
  } catch (e) { console.error(e) }
}

// ── Helpers de leitura ────────────────────────────────────────────────────────

export function getSizeHrs(boardData) {
  const active = boardData.sprints.find((s) => s.id === boardData.activeSprintId) || boardData.sprints[0]
  return { ...DEFAULT_SIZE_HRS, ...(active?.sprint?.sizeHrs || {}) }
}

export function getActiveSprint(boardData) {
  return boardData.sprints.find((s) => s.id === boardData.activeSprintId) || boardData.sprints[0]
}

export function getActivePet(boardData) {
  return (boardData.pets || []).find((s) => s.id === boardData.activePetId) || (boardData.pets || [])[0]
}
