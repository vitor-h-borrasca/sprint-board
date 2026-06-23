import { useState } from 'react'
import { useSprint } from '@/hooks/useSprint'
import useBoardStore from '@/store/useBoardStore'
import { STATUSES, SIZES, TYPES, TYPE_LABELS, PRIORITIES, STORY_POINTS } from '@/domain/constants'
import { fmtHrs, genId } from '@/domain/utils'
import { taskHrs } from '@/domain/capacity'
import { SectionTitle, TypeBadge, SizeBadge, StatusBadge, Avatar, CapacityBar } from '@/components/shared'
import { useAzureSync } from '@/hooks/useAzureSync'

export default function SprintTab() {
  const board = useBoardStore((s) => s.board)
  const store = useBoardStore()
  const {
    sprint, memberStats, shr,
    usedHrs, capTotal, donePct,
    allSprints, setTaskStatus, removeFromSprint, upsertTask, deleteTask,
  } = useSprint()
  const members = board.members || []
  const sprintTasks = board.sprints.find((s) => s.id === board.activeSprintId)?.tasks || []

  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMember, setFilterMember] = useState('all')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const { syncing, syncResult, azureReady, syncStatus: handleSyncStatus } = useAzureSync()

  const shown = sprintTasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterMember !== 'all' && t.assigneeId !== filterMember && t.qaAssigneeId !== filterMember) return false
    return true
  })

  function openEdit(t) {
    setEditTask(t)
    setShowTaskForm(true)
  }
  function closeForm() { setShowTaskForm(false); setEditTask(null) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Capacity por membro */}
      <div className="members-grid">
        {memberStats.map((m) => {
          const pct = m.cap > 0 ? Math.min(100, Math.round(m.used / m.cap * 100)) : 0
          const over = m.used > m.cap
          const barC = over ? 'var(--red)' : pct > 85 ? 'var(--amber)' : 'var(--teal)'
          return (
            <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Avatar name={m.name} idx={m.colorIdx} size={26} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{m.role} · {m.effDays}d efetivos</div>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: pct + '%', background: barC, borderRadius: 3, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 10, color: over ? 'var(--red-tx)' : 'var(--text3)' }}>
                {fmtHrs(m.used)} / {fmtHrs(m.cap)} ({pct}%)
              </div>
            </div>
          )
        })}
        {members.length === 0 && (
          <div style={{ gridColumn: '1/-1', color: 'var(--text3)', fontSize: 12, padding: '12px 0' }}>
            Nenhum membro na sprint. Configure na aba Configuração.
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <Fbtn active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>Todos</Fbtn>
          {Object.entries(STATUSES).filter(([k]) => k !== 'backlog').map(([k, v]) => (
            <Fbtn key={k} active={filterStatus === k} onClick={() => setFilterStatus(k)}
              bg={v.bg} bdC={v.bd} tx={v.tx}>{v.label}</Fbtn>
          ))}
        </div>
        <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)} style={{ fontSize: 11 }}>
          <option value="all">Todos membros</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {azureReady && (
            <button
              className="ghost"
              style={{ fontSize: 12 }}
              onClick={handleSyncStatus}
              disabled={syncing}
              title="Atualiza o status das tarefas com base no Azure DevOps"
            >
              <i className={'ti ' + (syncing ? 'ti-loader' : 'ti-refresh')}
                style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
              {syncing ? 'Sincronizando...' : 'Sync Azure'}
            </button>
          )}
          <button className="primary" style={{ fontSize: 12 }}
            onClick={showTaskForm ? closeForm : () => { setEditTask(null); setShowTaskForm(true) }}>
            <i className={'ti ' + (showTaskForm ? 'ti-x' : 'ti-plus')} /> {showTaskForm ? 'Cancelar' : 'Nova tarefa'}
          </button>
        </div>
      </div>

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

      {/* Form */}
      {showTaskForm && (
        <SprintTaskForm
          task={editTask} members={members} shr={shr} allSprints={allSprints}
          onSave={(task) => { upsertTask(task); closeForm() }}
          onCancel={closeForm}
        />
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text3)' }}>
        <span><b style={{ color: 'var(--text)' }}>{shown.length}</b> tarefas</span>
        <span><b style={{ color: 'var(--text)' }}>{fmtHrs(shown.reduce((s, t) => s + taskHrs(t, shr), 0))}</b> alocadas</span>
        <span><b style={{ color: 'var(--text)' }}>{donePct}%</b> concluído</span>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 13 }}>
            <i className="ti ti-run" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: 0.3 }} />
            {sprintTasks.length === 0 ? 'Sprint vazia. Mova tarefas do backlog.' : 'Nenhuma tarefa encontrada.'}
          </div>
        )}
        {shown.map((t) => (
          <SprintTaskRow
            key={t.id} task={t} shr={shr} members={members}
            onStatusChange={(s) => setTaskStatus(t.id, s)}
            onRemoveFromSprint={() => removeFromSprint(t.id)}
            onEdit={() => openEdit(t)}
            onDelete={() => deleteTask(t.id)}
            onToggleIgnored={() => store.patchTask(t.id, { ignored: !t.ignored })}
          />
        ))}
      </div>
    </div>
  )
}

function SprintTaskRow({ task, shr, members, onStatusChange, onRemoveFromSprint, onEdit, onDelete, onToggleIgnored }) {
  const assignee   = members.find((m) => m.id === task.assigneeId)
  const qaAssignee = members.find((m) => m.id === task.qaAssigneeId)
  const pri        = PRIORITIES.find((p) => p.v === task.priority)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Prioridade */}
      {pri && <i className={'ti ' + pri.icon} style={{ color: pri.color, fontSize: 13, flexShrink: 0 }} />}

      {/* Tipo */}
      <span style={{ flexShrink: 0 }}><TypeBadge type={task.type} /></span>

      {/* Título — ocupa espaço restante */}
      <div style={{ flex: 1, minWidth: 80, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, overflow: 'hidden' }}>
          {task.code && (
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
              {task.code}
            </span>
          )}
          <span style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
            {task.title || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>sem título</span>}
          </span>
        </div>
        {task.description && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.description}
          </div>
        )}
      </div>

      {/* Ignorar horas */}
      <button
        className="ghost"
        title={task.ignored ? 'Horas desconsideradas — clique para reativar' : 'Desconsiderar horas no capacity'}
        onClick={onToggleIgnored}
        style={{ padding: '3px 6px', fontSize: 12, flexShrink: 0, color: task.ignored ? 'var(--amber-tx)' : 'var(--text3)' }}
      >
        <i className={'ti ' + (task.ignored ? 'ti-clock-off' : 'ti-clock')} />
      </button>

      {/* Tamanho / horas */}
      <span style={{ flexShrink: 0, opacity: task.ignored ? 0.4 : 1, textDecoration: task.ignored ? 'line-through' : 'none' }}>
        <SizeBadge size={task.size} shr={shr} task={task} />
      </span>

      {task.devPoints != null && (
        <span title="Story points Dev" style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', color: 'var(--blue-tx)' }}>
          <i className="ti ti-code" style={{ fontSize: 10, marginRight: 3 }} />{task.devPoints}
        </span>
      )}
      {task.bizPoints != null && (
        <span title="Story points Negócio" style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'var(--purple-bg)', border: '1px solid var(--purple-bd)', color: 'var(--purple-tx)' }}>
          <i className="ti ti-briefcase" style={{ fontSize: 10, marginRight: 3 }} />{task.bizPoints}
        </span>
      )}

      {/* Avatares */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {assignee   && <Avatar name={assignee.name}   idx={assignee.colorIdx}   size={22} />}
        {qaAssignee && qaAssignee.id !== task.assigneeId && (
          <Avatar name={qaAssignee.name} idx={qaAssignee.colorIdx} size={22} />
        )}
      </div>

      {/* Status */}
      <select
        value={task.status}
        onChange={(e) => onStatusChange(e.target.value)}
        style={{ fontSize: 11, padding: '3px 6px', flexShrink: 0, width: 110 }}
      >
        {Object.entries(STATUSES).filter(([k]) => k !== 'backlog').map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        <button className="ghost" style={{ padding: '3px 7px', fontSize: 12 }} onClick={onEdit}><i className="ti ti-pencil" /></button>
        <button className="ghost" style={{ padding: '3px 7px', fontSize: 12 }} title="Mover para backlog" onClick={onRemoveFromSprint}><i className="ti ti-arrow-back-up" /></button>
        <button className="ghost" style={{ padding: '3px 7px', fontSize: 12, color: 'var(--red-tx)' }} onClick={onDelete}><i className="ti ti-trash" /></button>
      </div>
    </div>
  )
}

function SprintTaskForm({ task, members, shr, allSprints, onSave, onCancel }) {
  const activeSprintId = allSprints[0]?.id
  const [form, setForm] = useState(() => task ? {
    id: task.id, title: task.title, type: task.type, size: task.size,
    priority: task.priority, description: task.description || '',
    assigneeId: task.assigneeId || '', qaAssigneeId: task.qaAssigneeId || '',
    devHrs: task.devHrs || 0, qaHrs: task.qaHrs || 0, customHrs: task.customHrs || 0,
    devPoints: task.devPoints ?? null, bizPoints: task.bizPoints ?? null,
    status: task.status || 'todo', sprintId: task.sprintId,
    devStartDate: task.devStartDate || '', devEndDate: task.devEndDate || '',
    qaStartDate: task.qaStartDate || '', qaEndDate: task.qaEndDate || '',
    sprintExec: { dev: task.sprintExec?.dev ?? true, qa: task.sprintExec?.qa ?? true },
  } : {
    id: genId(), title: '', type: 'feature', size: 'M', priority: 2,
    description: '', assigneeId: '', qaAssigneeId: '',
    devHrs: 0, qaHrs: 0, customHrs: 0,
    devPoints: null, bizPoints: null,
    status: 'todo', sprintId: allSprints.find((s) => s.id)?.id || '',
    devStartDate: '', devEndDate: '', qaStartDate: '', qaEndDate: '',
    sprintExec: { dev: true, qa: true },
  })

  const f = (field, val) => setForm((p) => ({ ...p, [field]: val }))

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <LabeledField label="Título *">
          <input value={form.title} onChange={(e) => f('title', e.target.value)} placeholder="Título da tarefa" autoFocus />
        </LabeledField>
        <LabeledField label="Tipo">
          <select value={form.type} onChange={(e) => f('type', e.target.value)} style={{ fontSize: 12 }}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Tamanho">
          <select value={form.size} onChange={(e) => f('size', e.target.value)} style={{ fontSize: 12 }}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Prioridade">
          <select value={form.priority} onChange={(e) => f('priority', Number(e.target.value))} style={{ fontSize: 12 }}>
            {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Status">
          <select value={form.status} onChange={(e) => f('status', e.target.value)} style={{ fontSize: 12 }}>
            {Object.entries(STATUSES).filter(([k]) => k !== 'backlog').map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </LabeledField>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <LabeledField label="Dev">
          <select value={form.assigneeId} onChange={(e) => f('assigneeId', e.target.value)} style={{ fontSize: 12 }}>
            <option value="">—</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="QA">
          <select value={form.qaAssigneeId} onChange={(e) => f('qaAssigneeId', e.target.value)} style={{ fontSize: 12 }}>
            <option value="">—</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Horas Dev">
          <input type="number" min={0} value={form.devHrs} onChange={(e) => f('devHrs', Number(e.target.value))} style={{ fontSize: 12 }} />
        </LabeledField>
        <LabeledField label="Horas QA">
          <input type="number" min={0} value={form.qaHrs} onChange={(e) => f('qaHrs', Number(e.target.value))} style={{ fontSize: 12 }} />
        </LabeledField>
        <LabeledField label="Sprint">
          <select value={form.sprintId} onChange={(e) => f('sprintId', e.target.value)} style={{ fontSize: 12 }}>
            {allSprints.map((s) => <option key={s.id} value={s.id}>{s.sprint.name}</option>)}
          </select>
        </LabeledField>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <LabeledField label="Pontos Dev">
          <select value={form.devPoints ?? ''} onChange={(e) => f('devPoints', e.target.value === '' ? null : Number(e.target.value))} style={{ fontSize: 12 }}>
            <option value="">— sem estimativa</option>
            {STORY_POINTS.map((p) => <option key={p} value={p}>{p} {p === 1 ? 'pt' : 'pts'}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Pontos Negócio">
          <select value={form.bizPoints ?? ''} onChange={(e) => f('bizPoints', e.target.value === '' ? null : Number(e.target.value))} style={{ fontSize: 12 }}>
            <option value="">— sem estimativa</option>
            {STORY_POINTS.map((p) => <option key={p} value={p}>{p} {p === 1 ? 'pt' : 'pts'}</option>)}
          </select>
        </LabeledField>
      </div>

      <div style={{ marginBottom: 10 }}>
        <LabeledField label="Descrição">
          <input value={form.description} onChange={(e) => f('description', e.target.value)} placeholder="Opcional" />
        </LabeledField>
      </div>

      {/* Execução na Sprint */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Execução na Sprint
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { key: 'dev', label: 'Desenvolvimento', icon: 'ti-code' },
            { key: 'qa',  label: 'Homologação',     icon: 'ti-test-pipe' },
          ].map(({ key, label, icon }) => {
            const checked = form.sprintExec[key]
            return (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => f('sprintExec', { ...form.sprintExec, [key]: !checked })}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--navy)' }}
                />
                <i className={`ti ${icon}`} style={{ fontSize: 13, color: checked ? 'var(--navy)' : 'var(--text3)' }} />
                <span style={{ fontSize: 12, color: checked ? 'var(--text)' : 'var(--text3)', fontWeight: checked ? 500 : 400 }}>
                  {label}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="primary" onClick={() => onSave({ ...form, inSprint: true })}>
          {task ? 'Salvar' : 'Criar na Sprint'}
        </button>
        <button className="ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

function LabeledField({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function Fbtn({ active, onClick, children, bg, bdC, tx }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: '4px 10px',
      background: active ? (bg || 'var(--navy)') : 'var(--surface)',
      color: active ? (tx || '#fff') : 'var(--text2)',
      borderColor: active ? (bdC || 'var(--navy)') : 'var(--border2)',
    }}>{children}</button>
  )
}
