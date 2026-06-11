import useBoardStore, { filterByAreaPath } from '@/store/useBoardStore'
import { taskHrs, totalCapacity, memberEffDays, memberUsedHrs } from '@/domain/capacity'

export function useSprint() {
  const store  = useBoardStore()
  const board  = useBoardStore((s) => s.board)
  const teamAreaPath = useBoardStore((s) => s.teamAreaPath)

  const members     = (board.members || []).filter((m) => m.role !== 'po')
  const activeSlot  = board.sprints.find((s) => s.id === board.activeSprintId) || board.sprints[0]
  const backlogTasks = filterByAreaPath(board.tasks || [], teamAreaPath)
  const sprintTasks  = filterByAreaPath(activeSlot?.tasks || [], teamAreaPath)
  const shr         = { ...activeSlot?.sprint?.sizeHrs }
  const sprint      = activeSlot?.sprint

  const usedHrs = sprintTasks.reduce((s, t) => s + taskHrs(t, shr), 0)
  const capTotal = totalCapacity(members, sprint || {})
  const donePct = sprintTasks.length > 0
    ? Math.round(sprintTasks.filter((t) => t.status === 'done').length / sprintTasks.length * 100)
    : 0

  const memberStats = members.map((m) => ({
    ...m,
    effDays: memberEffDays(m, sprint || {}),
    cap: (m.hoursPerDay || 6) * memberEffDays(m, sprint || {}),
    used: memberUsedHrs(m, sprintTasks, shr),
  }))

  return {
    sprint,
    sprintTasks,
    backlogTasks,
    members,
    memberStats,
    shr,
    usedHrs,
    capTotal,
    donePct,
    allSprints: board.sprints,
    setTaskStatus: (id, status) => store.patchTask(id, { status }),
    removeFromSprint: (id) => store.setTaskSprint(id, null),
    addToSprint: (id) => store.setTaskSprint(id, board.activeSprintId),
    upsertTask: store.upsertTask,
    deleteTask: store.deleteTask,
    setTaskSprint: store.setTaskSprint,
  }
}
