import { create } from 'zustand'
import { loadBoardData, saveBoardData, getBoardDefault, getScriptUrl, setScriptUrl as persistScriptUrl, makeSprint, makePetSlot, getSizeHrs, getActiveSprint, getActivePet } from '@/domain/board'
import { cloudSave, cloudLoad } from '@/domain/sync'
import { genId } from '@/domain/utils'
import { getSessionTeam, getSessionTeamAreaPath } from '@/domain/auth'

/**
 * Store central. Regra: mutations sempre chamam _persist() no final.
 *
 * Por que Zustand e não useReducer?
 * - Acesso ao estado fora de componentes (ex: sync, export)
 * - Sem prop drilling — qualquer componente subscreve só o que precisa
 * - Mutations atômicas com immer-like spread — sem boilerplate de action/reducer
 */
export function filterByAreaPath(tasks, teamAreaPath) {
  if (!teamAreaPath) return tasks
  const ap = teamAreaPath.toLowerCase()
  return tasks.filter((t) => {
    if (!t.areaPath) return true
    const tp = t.areaPath.toLowerCase()
    return tp === ap || tp.startsWith(ap + '\\')
  })
}

export function matchesTeamAreaPath(areaPath, teamAreaPath) {
  if (!teamAreaPath || !areaPath) return true
  const ap = teamAreaPath.toLowerCase()
  const tp = areaPath.toLowerCase()
  return tp === ap || tp.startsWith(ap + '\\')
}

const useBoardStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  team: getSessionTeam(),
  teamAreaPath: getSessionTeamAreaPath() || '',
  board: loadBoardData(getSessionTeam()),
  scriptUrl: getScriptUrl(),
  syncStatus: 'idle',   // idle | loading | saving | saved | nofile | error
  lastCloud: null,
  pendingSprintCreate: null, // { oldestSlot, incompleteTasks } — aguarda confirmação

  // ── Init por time ──────────────────────────────────────────────────────────
  initTeam(teamName, teamAreaPath) {
    if (get().team === teamName && get().teamAreaPath === (teamAreaPath || '')) return
    const board = loadBoardData(teamName)
    set({ team: teamName, teamAreaPath: teamAreaPath || '', board, syncStatus: 'idle' })
  },

  resetTeamBoard() {
    const board = getBoardDefault()
    saveBoardData(board, get().team)
    set({ board, syncStatus: 'idle' })
  },

  // ── Helpers internos ───────────────────────────────────────────────────────
  _persist(board) {
    saveBoardData(board, get().team)
    const url = get().scriptUrl
    if (!url) return
    set({ syncStatus: 'saving' })
    const active = getActiveSprint(board)
    cloudSave(board, active?.sprint?.name || '', url)
      .then(() => set({ syncStatus: 'saved', lastCloud: new Date() }))
      .catch(() => set({ syncStatus: 'error' }))
  },

  // ── Selectors (computed) ───────────────────────────────────────────────────
  get activeSlot()    { return getActiveSprint(get().board) },
  get activePetSlot() { return getActivePet(get().board) },
  get shr()           { return getSizeHrs(get().board) },
  get members()       { return get().board.members || [] },

  // ── Script URL ─────────────────────────────────────────────────────────────
  setScriptUrl(url) {
    persistScriptUrl(url)
    set({ scriptUrl: url })
  },

  // ── Cloud sync ─────────────────────────────────────────────────────────────
  async loadFromCloud() {
    const url = get().scriptUrl
    if (!url) return
    set({ syncStatus: 'loading' })
    try {
      const d = await cloudLoad(url)
      if (!d) { set({ syncStatus: 'nofile' }); return }
      saveBoardData(d, get().team)
      set({ board: d, syncStatus: 'saved', lastCloud: new Date() })
    } catch {
      set({ syncStatus: 'error' })
    }
  },

  retrySync() {
    const { board, scriptUrl } = get()
    if (!scriptUrl) return
    set({ syncStatus: 'saving' })
    const active = getActiveSprint(board)
    cloudSave(board, active?.sprint?.name || '', scriptUrl)
      .then(() => set({ syncStatus: 'saved', lastCloud: new Date() }))
      .catch(() => set({ syncStatus: 'error' }))
  },

  // ── Mutations de board (genéricas) ─────────────────────────────────────────
  _setBoard(board) {
    set({ board })
    get()._persist(board)
  },

  // ── Sprint CRUD ────────────────────────────────────────────────────────────
  switchSprint(id) {
    get()._setBoard({ ...get().board, activeSprintId: id })
  },

  createSprint() {
    const { board } = get()
    const MAX_SPRINTS = 4
    if (board.sprints.length >= MAX_SPRINTS) {
      const oldestSlot = board.sprints[0]
      const incompleteTasks = (oldestSlot.tasks || []).filter((t) => t.status !== 'done')
      set({ pendingSprintCreate: { oldestSlot, incompleteTasks } })
      return
    }
    const n = board.sprints.length + 1
    const slot = makeSprint('Sprint ' + n)
    get()._setBoard({ ...board, activeSprintId: slot.id, sprints: [...board.sprints, slot] })
  },

  confirmCreateSprint() {
    const { board, pendingSprintCreate } = get()
    if (!pendingSprintCreate) return
    const { oldestSlot, incompleteTasks } = pendingSprintCreate
    const migratedTasks = incompleteTasks.map((t) => ({ ...t, sprintId: null, inSprint: false, status: 'backlog' }))
    const remaining = board.sprints.filter((s) => s.id !== oldestSlot.id)
    const n = remaining.length + 1
    const newSlot = makeSprint('Sprint ' + n)
    const newActive = newSlot.id
    const newBacklog = [...(board.tasks || []), ...migratedTasks]
    get()._setBoard({ ...board, activeSprintId: newActive, sprints: [...remaining, newSlot], tasks: newBacklog })
    set({ pendingSprintCreate: null })
  },

  cancelCreateSprint() {
    set({ pendingSprintCreate: null })
  },

  duplicateSprint(id) {
    const src = get().board.sprints.find((s) => s.id === id)
    if (!src) return
    const newSlot = {
      id: genId(),
      sprint: { ...src.sprint, name: src.sprint.name + ' (cópia)' },
      tasks: src.tasks.map((t) => ({ ...t, id: genId(), status: 'todo' })),
    }
    newSlot.tasks = newSlot.tasks.map((t) => ({ ...t, sprintId: newSlot.id }))
    const board = { ...get().board, activeSprintId: newSlot.id, sprints: [...get().board.sprints, newSlot] }
    get()._setBoard(board)
  },

  deleteSprint(id) {
    const { board } = get()
    if (board.sprints.length <= 1) return
    const deletedTasks = (board.sprints.find((s) => s.id === id)?.tasks || []).map((t) => ({
      ...t, sprintId: null, inSprint: false, status: 'backlog',
    }))
    const remaining = board.sprints.filter((s) => s.id !== id)
    const newActive = board.activeSprintId === id ? remaining[remaining.length - 1].id : board.activeSprintId
    get()._setBoard({ ...board, activeSprintId: newActive, sprints: remaining, tasks: [...(board.tasks || []), ...deletedTasks] })
  },

  renameSprint(id, name) {
    if (!name.trim()) return
    get()._setBoard({ ...get().board, sprints: get().board.sprints.map((s) => s.id === id ? { ...s, sprint: { ...s.sprint, name: name.trim() } } : s) })
  },

  updateSprintCfg(cfg) {
    const { board } = get()
    const sprints = board.sprints.map((s) => s.id === board.activeSprintId ? { ...s, sprint: cfg } : s)
    get()._setBoard({ ...board, sprints })
  },

  // ── PET CRUD ───────────────────────────────────────────────────────────────
  switchPet(id) {
    get()._setBoard({ ...get().board, activePetId: id })
  },

  createPet() {
    const pets = get().board.pets || []
    const n = pets.length + 1
    const qIdx = (n - 1) % 4
    const yr = new Date().getFullYear() + Math.floor((n - 1) / 4)
    const slot = makePetSlot('Q' + (qIdx + 1) + ' ' + yr)
    const board = { ...get().board, activePetId: slot.id, pets: [...pets, slot] }
    get()._setBoard(board)
  },

  duplicatePet(id) {
    const src = (get().board.pets || []).find((s) => s.id === id)
    if (!src) return
    const newSlot = {
      id: genId(),
      pet: { ...src.pet, name: src.pet.name + ' (cópia)' },
      initiatives: src.initiatives.map((i) => ({ ...i, id: genId() })),
    }
    const board = { ...get().board, activePetId: newSlot.id, pets: [...(get().board.pets || []), newSlot] }
    get()._setBoard(board)
  },

  deletePet(id) {
    const pets = get().board.pets || []
    if (pets.length <= 1) return
    const remaining = pets.filter((s) => s.id !== id)
    const newActive = get().board.activePetId === id ? remaining[remaining.length - 1].id : get().board.activePetId
    get()._setBoard({ ...get().board, activePetId: newActive, pets: remaining })
  },

  renamePet(id, name) {
    if (!name.trim()) return
    get()._setBoard({ ...get().board, pets: (get().board.pets || []).map((s) => s.id === id ? { ...s, pet: { ...s.pet, name: name.trim() } } : s) })
  },

  updatePetCfg(cfg) {
    const { board } = get()
    const pets = (board.pets || []).map((s) => s.id === board.activePetId ? { ...s, pet: cfg } : s)
    get()._setBoard({ ...board, pets })
  },

  // ── Initiatives CRUD ───────────────────────────────────────────────────────
  upsertInitiative(initiative) {
    const { board } = get()
    const pets = (board.pets || []).map((s) => {
      if (s.id !== board.activePetId) return s
      const exists = s.initiatives.find((i) => i.id === initiative.id)
      const initiatives = exists
        ? s.initiatives.map((i) => i.id === initiative.id ? { ...i, ...initiative } : i)
        : [...s.initiatives, { id: genId(), createdAt: Date.now(), ...initiative }]
      return { ...s, initiatives }
    })
    get()._setBoard({ ...board, pets })
  },

  deleteInitiative(id) {
    const { board } = get()
    const pets = (board.pets || []).map((s) => s.id === board.activePetId
      ? { ...s, initiatives: s.initiatives.filter((i) => i.id !== id) }
      : s
    )
    get()._setBoard({ ...board, pets })
  },

  patchInitiative(id, patch) {
    const { board } = get()
    const pets = (board.pets || []).map((s) => s.id === board.activePetId
      ? { ...s, initiatives: s.initiatives.map((i) => i.id === id ? { ...i, ...patch } : i) }
      : s
    )
    get()._setBoard({ ...board, pets })
  },

  // ── Members ────────────────────────────────────────────────────────────────
  addMember(member) {
    const { board } = get()
    get()._setBoard({ ...board, members: [...board.members, { id: genId(), colorIdx: board.members.length, ...member }] })
  },

  removeMember(id) {
    get()._setBoard({ ...get().board, members: get().board.members.filter((m) => m.id !== id) })
  },

  updateMember(id, patch) {
    get()._setBoard({ ...get().board, members: get().board.members.map((m) => m.id === id ? { ...m, ...patch } : m) })
  },

  // ── Tasks ──────────────────────────────────────────────────────────────────
  upsertTask(task) {
    const { board } = get()
    const sprintId = task.sprintId || null
    const allTasks = [...(board.tasks || []), ...(board.sprints.flatMap((s) => s.tasks || []))]
    const exists = allTasks.find((t) => t.id === task.id)

    if (!exists) {
      // nova task
      if (sprintId) {
        const sprints = board.sprints.map((s) => s.id === sprintId
          ? { ...s, tasks: [...(s.tasks || []), { ...task, sprintId }] }
          : s
        )
        get()._setBoard({ ...board, sprints })
      } else {
        get()._setBoard({ ...board, tasks: [...(board.tasks || []), task] })
      }
      return
    }

    // update existente — pode ter mudado de sprint/backlog
    const updatedTask = { ...exists, ...task }
    const backlog = (board.tasks || []).filter((t) => t.id !== task.id)
    const sprints = board.sprints.map((s) => ({
      ...s,
      tasks: (s.tasks || []).filter((t) => t.id !== task.id),
    }))

    if (sprintId) {
      const finalSprints = sprints.map((s) => s.id === sprintId
        ? { ...s, tasks: [...s.tasks, { ...updatedTask, sprintId }] }
        : s
      )
      get()._setBoard({ ...board, tasks: backlog, sprints: finalSprints })
    } else {
      get()._setBoard({ ...board, tasks: [...backlog, { ...updatedTask, sprintId: null, inSprint: false }], sprints })
    }
  },

  deleteTask(id) {
    const { board } = get()
    const tasks = (board.tasks || []).filter((t) => t.id !== id)
    const sprints = board.sprints.map((s) => ({ ...s, tasks: (s.tasks || []).filter((t) => t.id !== id) }))
    get()._setBoard({ ...board, tasks, sprints })
  },

  patchTask(id, patch) {
    const { board } = get()
    const allTasks = [...(board.tasks || []), ...board.sprints.flatMap((s) => s.tasks || [])]
    const existing = allTasks.find((t) => t.id === id)
    // Registra a data de entrada em Avaliação de Entrega na primeira transição
    if (patch.status === 'avalentrega' && existing?.status !== 'avalentrega' && !existing?.evalEnteredAt) {
      patch = { ...patch, evalEnteredAt: Date.now() }
    }
    const inBacklog = (board.tasks || []).find((t) => t.id === id)
    if (inBacklog) {
      get()._setBoard({ ...board, tasks: board.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) })
      return
    }
    const sprints = board.sprints.map((s) => ({
      ...s,
      tasks: (s.tasks || []).map((t) => t.id === id ? { ...t, ...patch } : t),
    }))
    get()._setBoard({ ...board, sprints })
  },

  setTaskSprint(id, sprintId) {
    const status = sprintId ? 'todo' : 'backlog'
    get().upsertTask({ id, sprintId: sprintId || null, inSprint: !!sprintId, status })
  },

  // ── Features ───────────────────────────────────────────────────────────────
  addFeature(name, code, areaPath = '') {
    const { board } = get()
    const feature = { id: genId(), code: (code || '').trim(), name: name.trim(), areaPath: areaPath || '' }
    get()._setBoard({ ...board, features: [...(board.features || []), feature] })
    return feature.id
  },

  recodeFeature(id, code) {
    const { board } = get()
    get()._setBoard({ ...board, features: (board.features || []).map((f) => f.id === id ? { ...f, code: code.trim() } : f) })
  },

  removeFeature(id) {
    const { board } = get()
    // desvincula tarefas que usavam essa feature
    const tasks = (board.tasks || []).map((t) => t.featureId === id ? { ...t, featureId: null } : t)
    const sprints = board.sprints.map((s) => ({
      ...s,
      tasks: (s.tasks || []).map((t) => t.featureId === id ? { ...t, featureId: null } : t),
    }))
    get()._setBoard({ ...board, features: (board.features || []).filter((f) => f.id !== id), tasks, sprints })
  },

  renameFeature(id, name) {
    if (!name.trim()) return
    const { board } = get()
    get()._setBoard({ ...board, features: (board.features || []).map((f) => f.id === id ? { ...f, name: name.trim() } : f) })
  },

  // ── Restore from history ───────────────────────────────────────────────────
  restoreBoard(board) {
    saveBoardData(board, get().team)
    set({ board })
  },
}))

export default useBoardStore
