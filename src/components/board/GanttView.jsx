import { useRef, useState } from 'react'
import { PRIORITIES, TYPE_COLORS } from '@/domain/constants'
import { genAbsDatesSet, memberAbsDatesSet } from '@/domain/capacity'
import { TypeBadge, Avatar } from '@/components/shared'

const DAY_W  = 36
const LEFT_W = 280

function isoAdd(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function isoMin(a, b) { return a < b ? a : b }
function isoMax(a, b) { return a > b ? a : b }

export function GanttView({ allSprints, members, activeSprint, shr }) {
  const [tooltip, setTooltip] = useState(null)
  const tooltipRef = useRef()

  const todayIso = new Date().toISOString().slice(0, 10)

  // Sprints com datas válidas, ordenadas por início
  const validSprints = (allSprints || [])
    .filter((s) => s.sprint?.startDate && s.sprint?.endDate)
    .sort((a, b) => a.sprint.startDate.localeCompare(b.sprint.startDate))

  if (validSprints.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
        <i className="ti ti-calendar-off" style={{ fontSize: 32, display: 'block', marginBottom: 10, opacity: 0.3 }} />
        Configure as datas das sprints em <b>Configuração</b> para visualizar o Gantt.
      </div>
    )
  }

  const activeSp = activeSprint || validSprints[0]?.sprint || {}

  // Range do timeline:
  // início = min(hoje, início da sprint ativa) para garantir sprint ativa completa
  // fim    = max(fim de todas as sprints) + 15 dias extras
  const rangeStart = activeSp.startDate
    ? isoMin(todayIso, activeSp.startDate)
    : todayIso

  const lastEnd = validSprints.reduce((max, s) => isoMax(max, s.sprint.endDate), todayIso)
  const rangeEnd = isoAdd(lastEnd, 15)

  const start    = new Date(rangeStart + 'T12:00:00')
  const end      = new Date(rangeEnd   + 'T12:00:00')
  const totalDays = Math.round((+end - +start) / (1000 * 60 * 60 * 24)) + 1
  const timelineW = totalDays * DAY_W

  function dayIdx(isoDate) {
    const d = new Date(isoDate + 'T12:00:00')
    return Math.round((+d - +start) / (1000 * 60 * 60 * 24))
  }
  function dayPx(dateStr) {
    if (!dateStr) return null
    const idx = dayIdx(dateStr)
    if (idx < 0 || idx >= totalDays) return null
    return idx * DAY_W
  }
  function dayW(s, e) {
    if (!s || !e) return null
    const diff = Math.max(1, Math.round((+new Date(e + 'T12:00:00') - +new Date(s + 'T12:00:00')) / (1000 * 60 * 60 * 24)) + 1)
    return diff * DAY_W
  }

  // Todos os dias do range
  const allDays = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    allDays.push({
      idx: i, iso,
      label: d.getDate(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isActiveSprint: activeSp.startDate && activeSp.endDate && iso >= activeSp.startDate && iso <= activeSp.endDate,
    })
  }

  // Agrupamento de meses para header
  const monthGroups = []
  allDays.forEach((d) => {
    const key = d.iso.slice(0, 7)
    if (!monthGroups.length || monthGroups[monthGroups.length - 1].key !== key) {
      const label = new Date(d.iso + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      monthGroups.push({ key, label, start: d.idx, count: 1 })
    } else {
      monthGroups[monthGroups.length - 1].count++
    }
  })

  const todayPx    = dayIdx(todayIso) >= 0 && dayIdx(todayIso) < totalDays ? dayIdx(todayIso) * DAY_W : null
  const ROW_H      = 52
  const HEADER_H   = 30  // altura dos headers de sprint

  // Agrupa tarefas por sprint (só sprints a partir de hoje ou com sprint ativa)
  const sprintGroups = validSprints
    .filter((s) => s.sprint.endDate >= rangeStart || s.id === (activeSp && allSprints?.find((x) => x.sprint === activeSp)?.id))
    .map((s) => ({
      slot: s,
      sp: s.sprint,
      tasks: s.tasks || [],
      genAbsSet: genAbsDatesSet(s.sprint),
    }))

  if (sprintGroups.every((g) => g.tasks.length === 0)) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text3)', fontSize: 13 }}>
        <i className="ti ti-chart-gantt" style={{ fontSize: 40, display: 'block', marginBottom: 12, opacity: 0.25 }} />
        Nenhuma tarefa nas sprints.
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>

      {/* Legenda */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface2)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Legenda:</span>
        {[
          { color: 'var(--blue)',             label: 'Dev' },
          { color: 'var(--purple)',           label: 'QA' },
          { color: 'var(--teal)',             label: 'Concluído' },
          { color: 'rgba(220,38,38,.18)',     label: 'Ausência' },
          { color: 'rgba(148,163,184,.3)',    label: 'Fim de semana' },
          { color: 'rgba(241,90,36,.15)',     label: 'Hoje' },
          { color: 'rgba(234,179,8,.12)',     label: 'Sprint ativa' },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 22, height: 8, borderRadius: 3, background: l.color, border: '1px solid rgba(0,0,0,.08)' }} />
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
          {rangeStart} → {rangeEnd}
        </span>
      </div>

      {/* Layout: coluna esquerda fixa + área scrollável */}
      <div style={{ display: 'flex' }}>

        {/* ── Coluna esquerda ── */}
        <div style={{ width: LEFT_W, flexShrink: 0, borderRight: '2px solid var(--border)' }}>
          <div style={{ height: 22, background: 'var(--navy)', borderBottom: '1px solid rgba(255,255,255,.1)' }} />
          <div style={{ height: 28, background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '0 14px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Tarefa</span>
          </div>

          {sprintGroups.map(({ slot, sp, tasks }) => (
            <div key={slot.id}>
              {/* Sprint header label */}
              <div style={{
                height: HEADER_H, borderBottom: '1px solid var(--border)',
                background: slot.id === allSprints?.find((s) => s.sprint === activeSp)?.id
                  ? 'rgba(234,179,8,.10)' : 'var(--navy)',
                padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <i className="ti ti-run" style={{ fontSize: 11, color: '#8892AA' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#E8EBF3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sp.name}
                </span>
                <span style={{ fontSize: 9, color: '#6B7A99', whiteSpace: 'nowrap' }}>
                  {sp.startDate?.slice(5).replace('-', '/')} → {sp.endDate?.slice(5).replace('-', '/')}
                </span>
              </div>

              {tasks.map((t, idx) => {
                const assignee   = members.find((m) => m.id === t.assigneeId)
                const qaAssignee = members.find((m) => m.id === t.qaAssigneeId)
                const pri        = PRIORITIES.find((p) => p.v === t.priority) || PRIORITIES[1]
                const typeAccent = TYPE_COLORS[t.type] || 'var(--gray-tx)'
                return (
                  <div key={t.id} style={{
                    height: ROW_H,
                    borderBottom: '1px solid var(--border)',
                    borderLeft: `3px solid ${typeAccent}`,
                    background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                    padding: '5px 12px',
                    display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden',
                  }}>
                    <i className={'ti ' + pri.icon} style={{ fontSize: 12, color: pri.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                        {t.code && <span style={{ fontFamily: 'monospace', color: 'var(--text3)', marginRight: 4 }}>{t.code}</span>}
                        {t.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'nowrap', overflow: 'hidden' }}>
                        <TypeBadge type={t.type} />
                        {assignee && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>
                            <Avatar name={assignee.name} idx={assignee.colorIdx ?? 0} size={12} />
                            <span style={{ fontSize: 9, color: 'var(--blue-tx)', whiteSpace: 'nowrap' }}>{assignee.name}</span>
                          </div>
                        )}
                        {qaAssignee && qaAssignee.id !== assignee?.id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--teal-bg)', border: '1px solid var(--teal-bd)', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>
                            <Avatar name={qaAssignee.name} idx={qaAssignee.colorIdx ?? 0} size={12} />
                            <span style={{ fontSize: 9, color: 'var(--teal-tx)', whiteSpace: 'nowrap' }}>{qaAssignee.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* ── Área de barras com scroll ── */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'visible' }}>
          <div style={{ width: timelineW, position: 'relative' }}>

            {/* Header meses */}
            <div style={{ height: 22, background: 'var(--navy)', display: 'flex' }}>
              {monthGroups.map((mg, i) => (
                <div key={i} style={{
                  width: mg.count * DAY_W, flexShrink: 0,
                  borderRight: '1px solid rgba(255,255,255,.1)',
                  display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#8892AA', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {mg.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Header dias */}
            <div style={{ height: 28, background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex' }}>
              {allDays.map((d) => {
                const isToday = d.iso === todayIso
                const bg = isToday
                  ? 'rgba(241,90,36,.18)'
                  : d.isActiveSprint && d.isWeekend ? 'rgba(234,179,8,.18)'
                  : d.isActiveSprint ? 'rgba(234,179,8,.10)'
                  : d.isWeekend ? 'rgba(148,163,184,.12)'
                  : 'transparent'
                return (
                  <div key={d.idx} style={{
                    width: DAY_W, flexShrink: 0,
                    borderRight: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: bg,
                  }}>
                    <span style={{
                      fontSize: 10, userSelect: 'none',
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? 'var(--orange)' : d.isActiveSprint ? '#B45309' : d.isWeekend ? 'var(--text3)' : 'var(--text2)',
                    }}>
                      {d.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Grupos de sprint */}
            {sprintGroups.map(({ slot, sp, tasks, genAbsSet }) => {
              const isActive = activeSp && sp === activeSp

              return (
                <div key={slot.id}>
                  {/* Sprint header row */}
                  <div style={{ height: HEADER_H, borderBottom: '1px solid var(--border)', position: 'relative', background: isActive ? 'rgba(234,179,8,.06)' : 'rgba(15,23,42,.5)' }}>
                    {/* Faixa da sprint destacada */}
                    {sp.startDate && sp.endDate && (
                      <div style={{
                        position: 'absolute',
                        left: Math.max(0, dayIdx(sp.startDate)) * DAY_W,
                        width: (() => {
                          const s = Math.max(0, dayIdx(sp.startDate))
                          const e = Math.min(totalDays - 1, dayIdx(sp.endDate))
                          return (e - s + 1) * DAY_W
                        })(),
                        top: 4, bottom: 4,
                        borderRadius: 4,
                        background: isActive ? 'rgba(234,179,8,.22)' : 'rgba(99,102,241,.18)',
                        border: '1px solid ' + (isActive ? 'rgba(234,179,8,.5)' : 'rgba(99,102,241,.4)'),
                        pointerEvents: 'none',
                      }} />
                    )}
                    {/* Linha de hoje */}
                    {todayPx !== null && (
                      <div style={{ position: 'absolute', left: todayPx + DAY_W / 2, top: 0, bottom: 0, borderLeft: '2px dashed var(--orange)', zIndex: 4, pointerEvents: 'none' }} />
                    )}
                    {/* Grid vertical */}
                    {allDays.map((d) => (
                      <div key={d.idx} style={{ position: 'absolute', left: d.idx * DAY_W, top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,.04)', pointerEvents: 'none' }} />
                    ))}
                  </div>

                  {/* Linhas de tarefa */}
                  {tasks.map((t, idx) => {
                    const assignee   = members.find((m) => m.id === t.assigneeId)
                    const qaAssignee = members.find((m) => m.id === t.qaAssigneeId)
                    const isDone     = t.status === 'done'

                    const devAbsSet = assignee   ? memberAbsDatesSet(assignee,   sp) : new Set()
                    const qaAbsSet  = qaAssignee ? memberAbsDatesSet(qaAssignee, sp) : new Set()
                    const memAbsSet = new Set([...devAbsSet, ...qaAbsSet])

                    const devPx = dayPx(t.devStartDate)
                    const devWd = dayW(t.devStartDate, t.devEndDate)
                    const qaPx  = dayPx(t.qaStartDate)
                    const qaWd  = dayW(t.qaStartDate, t.qaEndDate)
                    const hasNoDates = !t.devStartDate && !t.qaStartDate

                    return (
                      <div
                        key={t.id}
                        style={{
                          height: ROW_H,
                          borderBottom: '1px solid var(--border)',
                          background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                          position: 'relative',
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {/* Faixas de fundo */}
                        {allDays.map((d) => {
                          const isGenAbs  = genAbsSet.has(d.iso)
                          const isMemAbs  = memAbsSet.has(d.iso)
                          const isToday   = d.iso === todayIso
                          const inActive  = d.isActiveSprint
                          if (!d.isWeekend && !isGenAbs && !isMemAbs && !isToday && !inActive) return null
                          const bg = isToday
                            ? 'rgba(241,90,36,.08)'
                            : isGenAbs ? 'rgba(220,38,38,.18)'
                            : isMemAbs ? 'rgba(220,38,38,.10)'
                            : d.isWeekend ? 'rgba(148,163,184,.15)'
                            : inActive ? 'rgba(234,179,8,.06)'
                            : 'transparent'
                          return (
                            <div key={d.idx} style={{ position: 'absolute', left: d.idx * DAY_W, width: DAY_W, top: 0, bottom: 0, background: bg, pointerEvents: 'none' }} />
                          )
                        })}

                        {/* Grid vertical */}
                        {allDays.map((d) => (
                          <div key={d.idx} style={{ position: 'absolute', left: d.idx * DAY_W, top: 0, bottom: 0, borderLeft: '1px solid var(--border)', pointerEvents: 'none' }} />
                        ))}

                        {/* Hoje */}
                        {todayPx !== null && (
                          <div style={{ position: 'absolute', left: todayPx + DAY_W / 2, top: 0, bottom: 0, borderLeft: '2px dashed var(--orange)', zIndex: 4, pointerEvents: 'none' }} />
                        )}

                        {/* Sem datas */}
                        {hasNoDates && (
                          <div style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>
                            sem datas
                          </div>
                        )}

                        {/* Barra Dev */}
                        {devPx !== null && devWd !== null && (
                          <div
                            onMouseEnter={(e) => {
                              const r = e.currentTarget.getBoundingClientRect()
                              setTooltip({ task: t, assignee, qaAssignee,
                                devDates: `${t.devStartDate} → ${t.devEndDate || '?'}`,
                                qaDates: t.qaStartDate ? `${t.qaStartDate} → ${t.qaEndDate || '?'}` : null,
                                x: r.left, y: r.bottom + 6 })
                            }}
                            style={{
                              position: 'absolute', left: devPx, width: devWd,
                              top: qaWd ? '8%' : '12%', height: qaWd ? '38%' : '76%',
                              background: isDone ? 'var(--teal)' : 'var(--blue)',
                              borderRadius: 4, opacity: 0.9,
                              display: 'flex', alignItems: 'center', overflow: 'hidden', minWidth: 4, zIndex: 2, cursor: 'pointer',
                            }}
                          >
                            {devWd > 32 && <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, paddingLeft: 5, whiteSpace: 'nowrap' }}>Dev</span>}
                          </div>
                        )}

                        {/* Barra QA */}
                        {qaPx !== null && qaWd !== null && (
                          <div
                            onMouseEnter={(e) => {
                              const r = e.currentTarget.getBoundingClientRect()
                              setTooltip({ task: t, assignee, qaAssignee,
                                devDates: t.devStartDate ? `${t.devStartDate} → ${t.devEndDate || '?'}` : null,
                                qaDates: `${t.qaStartDate} → ${t.qaEndDate || '?'}`,
                                x: r.left, y: r.bottom + 6 })
                            }}
                            style={{
                              position: 'absolute', left: qaPx, width: qaWd,
                              top: devWd ? '54%' : '12%', height: devWd ? '38%' : '76%',
                              background: isDone ? 'var(--teal)' : 'var(--purple)',
                              borderRadius: 4, opacity: 0.9,
                              display: 'flex', alignItems: 'center', overflow: 'hidden', minWidth: 4, zIndex: 2, cursor: 'pointer',
                            }}
                          >
                            {qaWd > 32 && <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, paddingLeft: 5, whiteSpace: 'nowrap' }}>QA</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div ref={tooltipRef} style={{
          position: 'fixed',
          left: Math.min(tooltip.x, window.innerWidth - 270),
          top: tooltip.y,
          zIndex: 9999,
          background: 'var(--navy)', color: '#E8EBF3',
          borderRadius: 'var(--radius)', padding: '10px 14px',
          fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.28)',
          pointerEvents: 'none', maxWidth: 260, lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13, lineHeight: 1.3 }}>{tooltip.task.title}</div>
          {tooltip.devDates && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--blue)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#8892AA' }}>Dev: {tooltip.devDates}</span>
            </div>
          )}
          {tooltip.qaDates && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--purple)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#8892AA' }}>QA: {tooltip.qaDates}</span>
            </div>
          )}
          {tooltip.assignee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Avatar name={tooltip.assignee.name} idx={tooltip.assignee.colorIdx ?? 0} size={18} />
              <span style={{ fontSize: 11 }}>{tooltip.assignee.name} <span style={{ color: '#8892AA' }}>(Dev)</span></span>
            </div>
          )}
          {tooltip.qaAssignee && tooltip.qaAssignee.id !== tooltip.assignee?.id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Avatar name={tooltip.qaAssignee.name} idx={tooltip.qaAssignee.colorIdx ?? 0} size={18} />
              <span style={{ fontSize: 11 }}>{tooltip.qaAssignee.name} <span style={{ color: '#8892AA' }}>(QA)</span></span>
            </div>
          )}
          {!tooltip.devDates && !tooltip.qaDates && (
            <div style={{ fontSize: 11, color: '#8892AA' }}>Sem datas cadastradas.</div>
          )}
        </div>
      )}
    </div>
  )
}
