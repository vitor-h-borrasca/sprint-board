import { useState } from 'react'
import { useSprint } from '@/hooks/useSprint'
import useBoardStore, { filterByAreaPath } from '@/store/useBoardStore'
import { useAzureSync } from '@/hooks/useAzureSync'
import { STATUSES } from '@/domain/constants'
import { fmtHrs } from '@/domain/utils'
import { taskHrs } from '@/domain/capacity'
import { TypeBadge, SizeBadge, Avatar } from '@/components/shared'
import { GanttView } from './GanttView'
import { DeliveryEvalView } from './DeliveryEvalView'

const BOARD_COLUMNS = ['todo', 'inprogress', 'inqa', 'done']

export default function BoardTab() {
  const board = useBoardStore((s) => s.board)
  const teamAreaPath = useBoardStore((s) => s.teamAreaPath)
  const { shr, setTaskStatus, sprint, allSprints } = useSprint()
  const members = board.members || []
  const activeSlot  = board.sprints.find((s) => s.id === board.activeSprintId)
  const sprintTasks = filterByAreaPath(activeSlot?.tasks || [], teamAreaPath)
  const [view, setView] = useState('kanban')
  const { syncing, syncResult, azureReady, syncStatus } = useAzureSync()

  const byStatus = BOARD_COLUMNS.reduce((acc, k) => {
    acc[k] = sprintTasks.filter((t) => t.status === k)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Switcher Kanban / Gantt / Avaliação de Entrega */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { v: 'kanban',      icon: 'ti-layout-columns', label: 'Kanban' },
            { v: 'gantt',       icon: 'ti-chart-gantt',    label: 'Gantt'  },
            { v: 'avalentrega', icon: 'ti-clock-check',    label: 'Avaliação de Entrega', accent: 'var(--orange-tx)' },
          ].map(({ v, icon, label, accent }) => {
            const active = view === v
            return (
              <button key={v} onClick={() => setView(v)}
                style={{
                  background: active ? (accent ? 'var(--orange-bg)' : 'var(--navy)') : 'var(--surface)',
                  color: active ? (accent || '#fff') : 'var(--text2)',
                  borderColor: active ? (accent ? 'var(--orange-bd)' : 'var(--navy)') : 'var(--border2)',
                  fontWeight: active && accent ? 700 : undefined,
                }}>
                <i className={'ti ' + icon} style={{ fontSize: 14 }} />{label}
              </button>
            )
          })}
        </div>

        {sprint?.name && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            <b style={{ color: 'var(--text)' }}>{sprint.name}</b>
            {sprint.startDate && sprint.endDate && (
              ' · ' + sprint.startDate.slice(5).replace('-', '/') + ' → ' + sprint.endDate.slice(5).replace('-', '/')
            )}
          </span>
        )}

        {/* Botão sync Azure */}
        {azureReady && (
          <button
            className="ghost"
            style={{ fontSize: 12, marginLeft: 'auto' }}
            onClick={syncStatus}
            disabled={syncing}
            title="Sincroniza o status das tarefas com o Azure DevOps e atualiza as colunas do Kanban"
          >
            <i className={'ti ' + (syncing ? 'ti-loader' : 'ti-refresh')}
              style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
            {syncing ? 'Sincronizando...' : 'Sync Azure'}
          </button>
        )}
      </div>

      {/* Feedback do sync */}
      {syncResult && (
        <div style={{
          fontSize: 12, padding: '8px 12px', borderRadius: 8,
          background: syncResult.ok ? 'var(--teal-bg)' : 'var(--red-bg)',
          border: '1px solid ' + (syncResult.ok ? 'var(--teal-bd)' : 'var(--red-bd)'),
          color: syncResult.ok ? 'var(--teal-tx)' : 'var(--red-tx)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className={'ti ' + (syncResult.ok ? 'ti-circle-check' : 'ti-alert-circle')} />
            {syncResult.msg}
          </div>
          {syncResult.unmapped?.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--teal-bd)' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--amber-tx)' }}>
                <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
                Status do Azure sem mapeamento no board:
              </div>
              {syncResult.unmapped.map((u) => (
                <div key={u.code} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 0', borderBottom: '1px dashed var(--teal-bd)',
                }}>
                  <span style={{ fontFamily: 'monospace', background: 'var(--surface)', padding: '1px 6px', borderRadius: 4, color: 'var(--text2)', fontSize: 11 }}>#{u.code}</span>
                  <span style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.title}</span>
                  <span style={{ background: 'var(--amber-bg)', color: 'var(--amber-tx)', padding: '1px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>{u.azureStatus}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Avaliação de Entrega */}
      {view === 'avalentrega' && <DeliveryEvalView />}

      {/* Gantt */}
      {view === 'gantt' && (
        <GanttView
          allSprints={allSprints.map((s) => ({ ...s, tasks: filterByAreaPath(s.tasks || [], teamAreaPath) }))}
          members={members}
          activeSprint={sprint}
          shr={shr}
        />
      )}

      {/* Kanban */}
      {view === 'kanban' && <div className="board-grid">
        {BOARD_COLUMNS.map((col) => {
          const st = STATUSES[col]
          const tasks = byStatus[col]
          const hrs = tasks.reduce((s, t) => s + taskHrs(t, shr), 0)

          return (
            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Column header */}
              <div style={{
                background: st.bg, border: '1px solid ' + st.bd, borderRadius: 'var(--radius-lg)',
                padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: st.tx }}>{st.label}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: st.tx, opacity: 0.7 }}>{fmtHrs(hrs)}</span>
                  <span style={{ background: st.bd, color: st.tx, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
                    {tasks.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              {tasks.map((t) => (
                <BoardCard
                  key={t.id}
                  task={t}
                  shr={shr}
                  members={members}
                  onMove={(newStatus) => setTaskStatus(t.id, newStatus)}
                />
              ))}

              {tasks.length === 0 && (
                <div style={{
                  border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
                  padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 12
                }}>
                  Vazio
                </div>
              )}
            </div>
          )
        })}
      </div>}

    </div>
  )
}

function BoardCard({ task, shr, members, onMove }) {
  const assignee = members.find((m) => m.id === task.assigneeId)
  const qaAssignee = members.find((m) => m.id === task.qaAssigneeId)

  const colIdx = BOARD_COLUMNS.indexOf(task.status)
  const canPrev = colIdx > 0
  const canNext = colIdx < BOARD_COLUMNS.length - 1

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <TypeBadge type={task.type} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>
          {task.title}
        </div>
      </div>

      {task.description && (
        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.description}
        </div>
      )}

      {/* Size + avatares */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SizeBadge size={task.size} shr={shr} task={task} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {assignee && <Avatar name={assignee.name} idx={assignee.colorIdx} size={22} />}
          {qaAssignee && qaAssignee.id !== task.assigneeId && (
            <Avatar name={qaAssignee.name} idx={qaAssignee.colorIdx} size={22} />
          )}
        </div>
      </div>

      {/* Move buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        {canPrev && (
          <button className="ghost" style={{ flex: 1, fontSize: 10, padding: '3px 0' }}
            onClick={() => onMove(BOARD_COLUMNS[colIdx - 1])}>
            <i className="ti ti-arrow-left" style={{ fontSize: 11 }} /> {STATUSES[BOARD_COLUMNS[colIdx - 1]].label}
          </button>
        )}
        {canNext && (
          <button className="primary" style={{ flex: 1, fontSize: 10, padding: '3px 0' }}
            onClick={() => onMove(BOARD_COLUMNS[colIdx + 1])}>
            {STATUSES[BOARD_COLUMNS[colIdx + 1]].label} <i className="ti ti-arrow-right" style={{ fontSize: 11 }} />
          </button>
        )}
      </div>
    </div>
  )
}
