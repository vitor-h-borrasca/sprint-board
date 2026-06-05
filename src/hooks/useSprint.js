import useBoardStore from '@/store/useBoardStore'
import { taskHrs, totalCapacity, memberEffDays, memberUsedHrs } from '@/domain/capacity'

export function useSprint() {
  const store  = useBoardStore()
  const board  = useBoardStore((s) => s.board)

  const members     = board.members || []
  const backlogTasks = board.tasks || []
  const activeSlot  = board.sprints.find((s) => s.id === board.activeSprintId) || board.sprints[0]
  const sprintTasks = activeSlot?.tasks || []
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
