import { absWorkDaysInPeriod, buildAbsDatesSet } from './utils'
import { DEFAULT_SIZE_HRS } from './constants'

// ── Ausências gerais (feriados) ───────────────────────────────────────────────

export function periodGenAbsDays(cfg) {
  if (!cfg.startDate || !cfg.endDate || !cfg.generalAbsences?.length) return 0
  return cfg.generalAbsences.reduce(
    (tot, a) =>
      a.startDate
        ? tot + absWorkDaysInPeriod(a.startDate, a.endDate || a.startDate, cfg.startDate, cfg.endDate)
        : tot,
    0
  )
}

export function genAbsDatesSet(cfg) {
  return buildAbsDatesSet(cfg.generalAbsences || [], cfg.startDate, cfg.endDate)
}

// ── Ausências individuais ─────────────────────────────────────────────────────

export function memberAbsDays(member, cfg) {
  if (!cfg.startDate || !cfg.endDate || !member.absences?.length) return 0
  return member.absences.reduce(
    (tot, a) =>
      a.startDate
        ? tot + absWorkDaysInPeriod(a.startDate, a.endDate || a.startDate, cfg.startDate, cfg.endDate)
        : tot,
    0
  )
}

export function memberAbsDatesSet(member, cfg) {
  return buildAbsDatesSet(member.absences || [], cfg.startDate, cfg.endDate)
}

// ── Dias efetivos ─────────────────────────────────────────────────────────────

export function memberEffDays(member, cfg) {
  const genSet = genAbsDatesSet(cfg)
  const memSet = memberAbsDatesSet(member, cfg)
  const union = new Set([...genSet, ...memSet])
  return Math.max(0, (cfg.workingDays || 0) - union.size)
}

// ── Capacity total ────────────────────────────────────────────────────────────

export function totalCapacity(members, cfg) {
  return members.reduce((s, m) => s + (m.hoursPerDay || 6) * memberEffDays(m, cfg), 0)
}

// ── Horas de tarefas ──────────────────────────────────────────────────────────

export function taskHrs(task, shr) {
  if (task.ignored) return 0
  const devOn = task.sprintExec?.dev !== false
  const qaOn  = task.sprintExec?.qa  !== false
  const dh = devOn && task.devHrs != null && task.devHrs > 0 ? task.devHrs : 0
  const qh = qaOn  && task.qaHrs  != null && task.qaHrs  > 0 ? task.qaHrs  : 0
  if (task.devHrs > 0 || task.qaHrs > 0) return dh + qh
  if (task.customHrs != null && task.customHrs > 0) return task.customHrs
  return (shr ? shr[task.size] : DEFAULT_SIZE_HRS[task.size]) || 0
}

export function taskHrsForMember(task, shr, memberRole) {
  if (task.ignored) return 0
  const devOn = task.sprintExec?.dev !== false
  const qaOn  = task.sprintExec?.qa  !== false
  const dh = devOn && task.devHrs != null && task.devHrs > 0 ? task.devHrs : 0
  const qh = qaOn  && task.qaHrs  != null && task.qaHrs  > 0 ? task.qaHrs  : 0
  if (task.devHrs > 0 || task.qaHrs > 0) {
    if (memberRole === 'dev') return dh
    if (memberRole === 'qa') return qh
    return dh + qh
  }
  if (task.customHrs != null && task.customHrs > 0) return task.customHrs
  return (shr ? shr[task.size] : DEFAULT_SIZE_HRS[task.size]) || 0
}

// ── Uso de capacity por membro na sprint ─────────────────────────────────────

export function memberUsedHrs(member, sprintTasks, shr) {
  return sprintTasks
    .filter((t) => t.assigneeId === member.id || t.qaAssigneeId === member.id)
    .reduce((s, t) => {
      const asDev = t.assigneeId === member.id
      const asQA  = t.qaAssigneeId === member.id
      const devOn = t.sprintExec?.dev !== false
      const qaOn  = t.sprintExec?.qa  !== false
      const dh = devOn && t.devHrs != null && t.devHrs > 0 ? t.devHrs : 0
      const qh = qaOn  && t.qaHrs  != null && t.qaHrs  > 0 ? t.qaHrs  : 0
      if (t.devHrs > 0 || t.qaHrs > 0) return s + (asDev && asQA ? dh + qh : asQA ? qh : dh)
      return s + taskHrs(t, shr)
    }, 0)
}
