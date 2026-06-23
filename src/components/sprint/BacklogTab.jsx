import { useState } from 'react'
import { useSprint } from '@/hooks/useSprint'
import useBoardStore, { filterByAreaPath } from '@/store/useBoardStore'
import FeaturesTab from '@/components/features/FeaturesTab'
import { SIZES, TYPES, TYPE_LABELS, PRIORITIES, DEFAULT_SIZE_HRS, STORY_POINTS } from '@/domain/constants'
import { fmtHrs, genId } from '@/domain/utils'
import { taskHrs } from '@/domain/capacity'
import { SectionTitle, TypeBadge, SizeBadge, Avatar, Badge } from '@/components/shared'

const EMPTY_TASK = () => ({
  code: '', title: '', type: 'pbi', size: 'P', priority: 2,
  description: '', assigneeId: '', qaAssigneeId: '',
  devHrs: '', qaHrs: '', customHrs: 0,
  devPoints: null, bizPoints: null,
  devStartDate: '', devEndDate: '', qaStartDate: '', qaEndDate: '',
  sprintId: '', petSlotId: '', initiativeId: '', featureId: '',
  areaPath: '',
})

// 'all' | 'backlog' | 'active' | 'sprints'
const FILTER_OPTS = [
  { k: 'all',     label: 'Todas' },
  { k: 'backlog', label: 'Backlog' },
  { k: 'active',  label: 'Sprint ativa' },
  { k: 'sprints', label: 'Em sprints' },
]

export default function BacklogTab() {
  const board   = useBoardStore((s) => s.board)
  const store   = useBoardStore()
  const { shr, allSprints, deleteTask, upsertTask } = useSprint()
  const switchSprint = store.switchSprint
  const teamAreaPath   = useBoardStore((s) => s.teamAreaPath)
  const backlogTasks   = filterByAreaPath(board.tasks || [], teamAreaPath)
  const members        = board.members || []
  const pets           = board.pets || []
  const features       = board.features || []
  const activeSprintId = board.activeSprintId
  const activeSlot     = allSprints.find((s) => s.id === activeSprintId) || allSprints[0]
  const sprintTasksAll = filterByAreaPath(allSprints.flatMap((s) => s.tasks || []), teamAreaPath)

  const allTasksFlat = [
    ...backlogTasks.map((t) => ({ ...t, _loc: 'backlog' })),
    ...sprintTasksAll.map((t) => ({ ...t, _loc: 'sprint' })),
  ]

  const [subTab, setSubTab]             = useState('tasks') // 'tasks' | 'features'
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(EMPTY_TASK())
  const [editId, setEditId]             = useState(null)
  const [search, setSearch]             = useState('')
  const [filterTab, setFilterTab]       = useState('backlog')
  const [groupByFeature, setGroupByFeature] = useState(false)

  const shown = allTasksFlat.filter((t) => {
    if (search) {
      const q = search.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !String(t.code || '').includes(q)) return false
    }
    if (filterTab === 'backlog') return !t.sprintId
    if (filterTab === 'active')  return t.sprintId === activeSprintId
    if (filterTab === 'sprints') return !!t.sprintId
    return true
  })

  const counts = {
    all:     allTasksFlat.length,
    backlog: allTasksFlat.filter((t) => !t.sprintId).length,
    active:  allTasksFlat.filter((t) => t.sprintId === activeSprintId).length,
    sprints: allTasksFlat.filter((t) => !!t.sprintId).length,
  }

  function openNew() {
    setForm(EMPTY_TASK())
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(t) {
    setForm({
      code: t.code || '', title: t.title, type: t.type, size: t.size, priority: t.priority,
      description: t.description || '', assigneeId: t.assigneeId || '',
      qaAssigneeId: t.qaAssigneeId || '',
      devHrs: t.devHrs != null && t.devHrs > 0 ? t.devHrs : '',
      qaHrs:  t.qaHrs  != null && t.qaHrs  > 0 ? t.qaHrs  : '',
      customHrs: t.customHrs || 0,
      devStartDate: t.devStartDate || '', devEndDate: t.devEndDate || '',
      qaStartDate:  t.qaStartDate  || '', qaEndDate:  t.qaEndDate  || '',
      devPoints:   t.devPoints  ?? null,
      bizPoints:   t.bizPoints  ?? null,
      sprintId:    t.sprintId    || '',
      petSlotId:   t.petSlotId   || '',
      initiativeId: t.initiativeId || '',
      featureId:   t.featureId   || '',
      areaPath:    t.areaPath    || '',
    })
    setEditId(t.id)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditId(null) }

  function submit() {
    if (!form.title.trim()) return
    const devHrs   = form.devHrs !== '' ? Number(form.devHrs) : undefined
    const qaHrs    = form.qaHrs  !== '' ? Number(form.qaHrs)  : undefined
    const sprintId = form.sprintId || null

    const task = {
      ...form,
      id: editId || genId(),
      devHrs, qaHrs,
      customHrs: form.customHrs || 0,
      sprintId,
      inSprint: !!sprintId,
      status: sprintId ? 'todo' : 'backlog',
      petSlotId:    form.petSlotId    || null,
      initiativeId: form.initiativeId || null,
      featureId:    form.featureId    || null,
      ...(editId ? {} : { createdAt: Date.now() }),
    }
    upsertTask(task)
    // Se tarefa foi vinculada a uma sprint diferente da ativa, muda a sprint ativa
    if (sprintId && sprintId !== board.activeSprintId) {
      switchSprint(sprintId)
    }
    closeForm()
  }

  function exportCSV() {
    const rows = [
      ['ID', 'Título', 'Tipo', 'Tamanho', 'Dev h', 'QA h', 'Total h', 'Prioridade', 'Dev Resp.', 'QA Resp.', 'Sprint', 'Dev Início', 'Dev Fim', 'QA Início', 'QA Fim'],
      ...allTasksFlat.map((t) => {
        const totalH = taskHrs(t, shr)
        const devName = members.find((m) => m.id === t.assigneeId)?.name || ''
        const qaName  = members.find((m) => m.id === t.qaAssigneeId)?.name || ''
        const spName  = allSprints.find((s) => s.id === t.sprintId)?.sprint?.name || ''
        const pri     = PRIORITIES.find((p) => p.v === t.priority)?.label || ''
        return [t.id, t.title, TYPE_LABELS[t.type] || t.type, t.size, t.devHrs || '', t.qaHrs || '', totalH, pri, devName, qaName, spName, t.devStartDate || '', t.devEndDate || '', t.qaStartDate || '', t.qaEndDate || '']
      }),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a   = document.createElement('a')
    a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'backlog.csv'
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Sub-abas */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { k: 'tasks',    icon: 'ti-stack',            label: `Tarefas (${allTasksFlat.length})` },
          { k: 'features', icon: 'ti-layers-subtract',  label: `Features (${features.length})` },
        ].map(({ k, icon, label }) => (
          <button
            key={k}
            onClick={() => { setSubTab(k); if (showForm) closeForm() }}
            style={{
              border: 'none', borderBottom: '2px solid ' + (subTab === k ? 'var(--orange)' : 'transparent'),
              borderRadius: 0, background: 'none', padding: '8px 16px', fontSize: 13, gap: 6,
              color: subTab === k ? 'var(--navy)' : 'var(--text3)',
              fontWeight: subTab === k ? 600 : 400,
            }}
          >
            <i className={'ti ' + icon} style={{ fontSize: 14 }} />{label}
          </button>
        ))}
      </div>

      {subTab === 'features' && <FeaturesTab />}

      {subTab === 'tasks' && <>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tarefas..." style={{ width: 220, fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTER_OPTS.map(({ k, label }) => (
            <Fbtn key={k} active={filterTab === k} onClick={() => setFilterTab(k)}>
              {label} ({counts[k]})
            </Fbtn>
          ))}
        </div>
        <Fbtn active={groupByFeature} onClick={() => setGroupByFeature((v) => !v)}>
          <i className="ti ti-layout-list" style={{ fontSize: 12 }} /> Agrupar por Feature
        </Fbtn>
        <button style={{ fontSize: 12, gap: 5 }} onClick={exportCSV}>
          <i className="ti ti-download" /> Exportar CSV
        </button>
        {showForm ? (
          <button className="danger" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={closeForm}>
            <i className="ti ti-x" /> Cancelar
          </button>
        ) : (
          <button className="primary" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={openNew}>
            <i className="ti ti-plus" /> Nova tarefa
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <TaskForm
          form={form} setForm={setForm}
          members={members} allSprints={allSprints}
          pets={pets} shr={shr} features={features}
          onSubmit={submit} onCancel={closeForm}
          editId={editId}
          onAddFeature={(name) => store.addFeature(name)}
        />
      )}

      {/* Stats */}
      {!showForm && (
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text3)' }}>
          <span><b style={{ color: 'var(--text)' }}>{shown.length}</b> tarefas</span>
          <span><b style={{ color: 'var(--text)' }}>{fmtHrs(shown.reduce((s, t) => s + taskHrs(t, shr), 0))}</b> estimadas</span>
        </div>
      )}

      {/* List */}
      {shown.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 13 }}>
          <i className="ti ti-stack" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: 0.3 }} />
          {allTasksFlat.length === 0 ? 'Backlog vazio. Crie a primeira tarefa!' : 'Nenhuma tarefa encontrada.'}
        </div>
      )}

      {groupByFeature
        ? <GroupedList tasks={shown} features={features} shr={shr} members={members} allSprints={allSprints} featuresList={features}
            onEdit={openEdit} onDelete={deleteTask} onMoveToSprint={(id, sid) => {
              store.setTaskSprint(id, sid)
              if (sid && sid !== board.activeSprintId) switchSprint(sid)
            }} />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map((t) => (
              <TaskRow
                key={t.id} task={t} shr={shr} members={members} allSprints={allSprints} features={features}
                onEdit={() => openEdit(t)}
                onDelete={() => deleteTask(t.id)}
                onMoveToSprint={(id, sprintId) => {
                  store.setTaskSprint(id, sprintId)
                  if (sprintId && sprintId !== board.activeSprintId) switchSprint(sprintId)
                }}
              />
            ))}
          </div>
      }
      </>}
    </div>
  )
}

// ── GroupedList ───────────────────────────────────────────────────────────────
function GroupedList({ tasks, features, featuresList, shr, members, allSprints, onEdit, onDelete, onMoveToSprint }) {
  const FEATURE_COLORS = [
    { bg: 'var(--blue-bg)',   bd: 'var(--blue-bd)',   tx: 'var(--blue-tx)' },
    { bg: 'var(--purple-bg)', bd: 'var(--purple-bd)', tx: 'var(--purple-tx)' },
    { bg: 'var(--teal-bg)',   bd: 'var(--teal-bd)',   tx: 'var(--teal-tx)' },
    { bg: 'var(--amber-bg)',  bd: 'var(--amber-bd)',  tx: 'var(--amber-tx)' },
  ]

  const grouped = {}
  tasks.forEach((t) => {
    const key = t.featureId || '__none__'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(t)
  })

  const featureOrder = [
    ...features.map((f) => f.id),
    '__none__',
  ].filter((k) => grouped[k])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {featureOrder.map((key, idx) => {
        const feature = features.find((f) => f.id === key)
        const col     = FEATURE_COLORS[idx % FEATURE_COLORS.length]
        const group   = grouped[key]
        return (
          <div key={key}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              padding: '6px 12px', borderRadius: 8,
              background: feature ? col.bg : 'var(--surface2)',
              border: '1px solid ' + (feature ? col.bd : 'var(--border)'),
            }}>
              <i className="ti ti-layers-subtract" style={{ fontSize: 13, color: feature ? col.tx : 'var(--text3)' }} />
              <span style={{ fontWeight: 600, fontSize: 12, color: feature ? col.tx : 'var(--text3)' }}>
                {feature ? feature.name : 'Sem feature'}
              </span>
              <span style={{ fontSize: 11, color: feature ? col.tx : 'var(--text3)', opacity: 0.7 }}>
                ({group.length} {group.length === 1 ? 'tarefa' : 'tarefas'})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 12, borderLeft: '2px solid ' + (feature ? col.bd : 'var(--border)') }}>
              {group.map((t) => (
                <TaskRow
                  key={t.id} task={t} shr={shr} members={members} allSprints={allSprints} features={featuresList}
                  onEdit={() => onEdit(t)}
                  onDelete={() => onDelete(t.id)}
                  onMoveToSprint={onMoveToSprint}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── TaskForm ──────────────────────────────────────────────────────────────────
function TaskForm({ form, setForm, members, allSprints, pets, shr, features, onSubmit, onCancel, editId, onAddFeature }) {
  const [newFeatureName, setNewFeatureName] = useState('')
  const [addingFeature, setAddingFeature]   = useState(false)
  const f = (field, val) => setForm((p) => ({ ...p, [field]: val }))

  const devH   = form.devHrs !== '' ? Number(form.devHrs) : 0
  const qaH    = form.qaHrs  !== '' ? Number(form.qaHrs)  : 0
  const totalH = devH + qaH > 0 ? devH + qaH : (shr[form.size] || DEFAULT_SIZE_HRS[form.size] || 0)

  const activePetInits = pets.find((p) => p.id === form.petSlotId)?.initiatives || []

  const LBL = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
      {children}
    </div>
  )

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14 }}>
        {editId ? 'Editar tarefa' : 'Nova tarefa'}
      </div>

      {/* Código + Título */}
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <LBL>Código</LBL>
          <input
            value={form.code}
            onChange={(e) => f('code', e.target.value)}
            placeholder="ex: 1968098"
            style={{ fontSize: 12, fontFamily: 'monospace' }}
          />
        </div>
        <div>
          <LBL>Título</LBL>
          <input
            value={form.title}
          onChange={(e) => f('title', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="Ex: [TIKTOK SHOP] — Descrição da tarefa"
          autoFocus
          style={{ fontSize: 13 }}
        />
        </div>
      </div>

      {/* Referência / Dev h / QA h / Total */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <LBL>Referência</LBL>
          <select value={form.size} onChange={(e) => f('size', e.target.value)} style={{ fontSize: 12 }}>
            {SIZES.map((s) => (
              <option key={s} value={s}>{s} — {shr[s] || DEFAULT_SIZE_HRS[s]}h</option>
            ))}
          </select>
        </div>
        <div>
          <LBL>Dev — Horas</LBL>
          <div style={{ position: 'relative' }}>
            <input
              type="number" min={0} value={form.devHrs}
              onChange={(e) => f('devHrs', e.target.value)}
              placeholder={String(shr[form.size] || DEFAULT_SIZE_HRS[form.size] || '')}
              style={{ fontSize: 12, paddingRight: 24 }}
            />
            <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text3)', pointerEvents: 'none' }}>h</span>
          </div>
        </div>
        <div>
          <LBL>QA — Horas</LBL>
          <div style={{ position: 'relative' }}>
            <input
              type="number" min={0} value={form.qaHrs}
              onChange={(e) => f('qaHrs', e.target.value)}
              placeholder="0"
              style={{ fontSize: 12, paddingRight: 24 }}
            />
            <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text3)', pointerEvents: 'none' }}>h</span>
          </div>
        </div>
        <div>
          <LBL>Total estimado</LBL>
          <div style={{
            border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
            padding: '7px 10px', background: 'var(--surface2)', fontSize: 13, fontWeight: 600, color: 'var(--text)',
          }}>
            {totalH}
            <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text3)', marginTop: 1 }}>
              {devH > 0 || qaH > 0 ? `Dev ${devH}h${qaH > 0 ? ` + QA ${qaH}h` : ''}` : `tamanho ${form.size}`}
            </div>
          </div>
        </div>
      </div>

      {/* Tipo / Dev Resp / QA Resp / Prioridade */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <LBL>Tipo</LBL>
          <select value={form.type} onChange={(e) => f('type', e.target.value)} style={{ fontSize: 12 }}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <LBL>Dev — Resp.</LBL>
          <select value={form.assigneeId} onChange={(e) => f('assigneeId', e.target.value)} style={{ fontSize: 12 }}>
            <option value="">— sem responsável</option>
            {members.filter((m) => m.role !== 'qa').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <LBL>QA — Resp.</LBL>
          <select value={form.qaAssigneeId} onChange={(e) => f('qaAssigneeId', e.target.value)} style={{ fontSize: 12 }}>
            <option value="">— sem responsável</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <LBL>Prioridade</LBL>
          <select value={form.priority} onChange={(e) => f('priority', Number(e.target.value))} style={{ fontSize: 12 }}>
            {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Story Points Dev + Negócio */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <LBL>Pontos Dev <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(story points)</span></LBL>
          <select value={form.devPoints ?? ''} onChange={(e) => f('devPoints', e.target.value === '' ? null : Number(e.target.value))} style={{ fontSize: 12 }}>
            <option value="">— sem estimativa</option>
            {STORY_POINTS.map((p) => <option key={p} value={p}>{p} {p === 1 ? 'pt' : 'pts'}</option>)}
          </select>
        </div>
        <div>
          <LBL>Pontos Negócio <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(story points)</span></LBL>
          <select value={form.bizPoints ?? ''} onChange={(e) => f('bizPoints', e.target.value === '' ? null : Number(e.target.value))} style={{ fontSize: 12 }}>
            <option value="">— sem estimativa</option>
            {STORY_POINTS.map((p) => <option key={p} value={p}>{p} {p === 1 ? 'pt' : 'pts'}</option>)}
          </select>
        </div>
      </div>

      {/* Datas Dev + QA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <LBL>Dev — Início</LBL>
          <input type="date" value={form.devStartDate} onChange={(e) => f('devStartDate', e.target.value)} style={{ fontSize: 12 }} />
        </div>
        <div>
          <LBL>Dev — Fim</LBL>
          <input type="date" value={form.devEndDate} onChange={(e) => f('devEndDate', e.target.value)} style={{ fontSize: 12 }} />
        </div>
        <div>
          <LBL>QA — Início</LBL>
          <input type="date" value={form.qaStartDate} onChange={(e) => f('qaStartDate', e.target.value)} style={{ fontSize: 12 }} />
        </div>
        <div>
          <LBL>QA — Fim</LBL>
          <input type="date" value={form.qaEndDate} onChange={(e) => f('qaEndDate', e.target.value)} style={{ fontSize: 12 }} />
        </div>
      </div>

      {/* Descrição */}
      <div style={{ marginBottom: 14 }}>
        <LBL>Descrição (opcional)</LBL>
        <textarea
          value={form.description}
          onChange={(e) => f('description', e.target.value)}
          placeholder="Detalhes sobre a tarefa..."
          rows={3}
          style={{ width: '100%', fontSize: 12, resize: 'vertical', fontFamily: 'inherit', padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', outline: 'none' }}
        />
      </div>

      {/* Area Path */}
      <div style={{ marginBottom: 14 }}>
        <LBL>Area Path <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(preenchido pelo sync com Azure DevOps)</span></LBL>
        <input
          value={form.areaPath}
          onChange={(e) => f('areaPath', e.target.value)}
          placeholder="Ex: ANYMARKET\Marketplace Global"
          style={{ fontSize: 12, width: '100%', color: form.areaPath ? 'var(--text1)' : 'var(--text3)' }}
        />
      </div>

      {/* Feature */}
      <div style={{ marginBottom: 10, background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue-tx)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="ti ti-layers-subtract" style={{ fontSize: 13 }} />
          Feature <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(opcional — agrupa PBIs sob uma feature)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {addingFeature ? (
            <>
              <input
                autoFocus
                value={newFeatureName}
                onChange={(e) => setNewFeatureName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFeatureName.trim()) {
                    const id = onAddFeature(newFeatureName)
                    f('featureId', id)
                    setNewFeatureName('')
                    setAddingFeature(false)
                  }
                  if (e.key === 'Escape') { setAddingFeature(false); setNewFeatureName('') }
                }}
                placeholder="Nome da nova feature..."
                style={{ fontSize: 12, flex: 1 }}
              />
              <button
                onClick={() => {
                  if (newFeatureName.trim()) {
                    const id = onAddFeature(newFeatureName)
                    f('featureId', id)
                  }
                  setNewFeatureName('')
                  setAddingFeature(false)
                }}
                style={{ fontSize: 11, padding: '5px 12px', background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', color: 'var(--blue-tx)', borderRadius: 'var(--radius)' }}
              >
                Criar
              </button>
              <button className="ghost" style={{ fontSize: 11 }} onClick={() => { setAddingFeature(false); setNewFeatureName('') }}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <select value={form.featureId} onChange={(e) => f('featureId', e.target.value)} style={{ fontSize: 12, flex: 1 }}>
                <option value="">— sem feature</option>
                {features.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
              </select>
              <button
                onClick={() => setAddingFeature(true)}
                style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap', flexShrink: 0, background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', color: 'var(--blue-tx)', borderRadius: 'var(--radius)' }}
              >
                <i className="ti ti-plus" style={{ fontSize: 11 }} /> Nova feature
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sprint */}
      <div style={{ marginBottom: 10, background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber-tx)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="ti ti-run" style={{ fontSize: 13 }} />
          Sprint <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(opcional — deixe em branco para manter no backlog)</span>
        </div>
        <select value={form.sprintId} onChange={(e) => f('sprintId', e.target.value)} style={{ fontSize: 12 }}>
          <option value="">— Backlog (sem sprint)</option>
          {allSprints.map((s) => <option key={s.id} value={s.id}>{s.sprint.name}</option>)}
        </select>
      </div>

      {/* Iniciativa PET */}
      {(() => {
        // Lista plana de todas as iniciativas de todos os slots, agrupadas por quarter
        const allInits = pets.flatMap((p) =>
          (p.initiatives || []).map((i) => ({ ...i, _petSlotId: p.id }))
        )
        const byQuarter = ['Q1','Q2','Q3','Q4'].reduce((acc, q) => {
          const qs = allInits.filter((i) => i.quarter === q && i.prioritized !== false)
          if (qs.length) acc[q] = qs
          return acc
        }, {})
        return (
          <div style={{ marginBottom: 16, background: 'var(--purple-bg)', border: '1px solid var(--purple-bd)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--purple-tx)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="ti ti-chart-bar" style={{ fontSize: 13 }} />
              Iniciativa PET <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(opcional)</span>
            </div>
            <select
              value={form.initiativeId}
              onChange={(e) => {
                const id = e.target.value
                const found = allInits.find((i) => i.id === id)
                f('initiativeId', id)
                f('petSlotId', found ? found._petSlotId : '')
              }}
              style={{ fontSize: 12, width: '100%' }}
            >
              <option value="">— sem vínculo</option>
              {Object.entries(byQuarter).map(([q, inits]) => (
                <optgroup key={q} label={q}>
                  {inits.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.isInitiative !== false ? '🎯 ' : '📌 '}{i.title || i.id}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )
      })()}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="primary" onClick={onSubmit}>
          <i className="ti ti-device-floppy" /> {editId ? 'Salvar edição' : 'Criar tarefa'}
        </button>
        <button className="ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

// ── TaskRow ───────────────────────────────────────────────────────────────────
function TaskRow({ task, shr, members, allSprints, features = [], onEdit, onDelete, onMoveToSprint }) {
  const assignee   = members.find((m) => m.id === task.assigneeId)
  const qaAssignee = members.find((m) => m.id === task.qaAssigneeId)
  const pri        = PRIORITIES.find((p) => p.v === task.priority)
  const sprint     = allSprints.find((s) => s.id === task.sprintId)
  const feature    = features.find((f) => f.id === task.featureId)

  const locBg = sprint ? 'var(--amber-bg)' : 'var(--gray-bg)'
  const locBd = sprint ? 'var(--amber-bd)' : 'var(--gray-bd)'
  const locTx = sprint ? 'var(--amber-tx)' : 'var(--gray-tx)'
  const locLabel = sprint ? sprint.sprint.name : 'Backlog'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Badge localização */}
      <span style={{
        flexShrink: 0, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
        padding: '3px 10px', borderRadius: 6,
        background: locBg, border: '1px solid ' + locBd, color: locTx,
      }}>
        {locLabel}
      </span>

      {/* Dropdown mover sprint */}
      <select
        value={task.sprintId || ''}
        onChange={(e) => onMoveToSprint(task.id, e.target.value || null)}
        style={{ fontSize: 11, padding: '3px 6px', flexShrink: 0, width: 140 }}
      >
        <option value="">Backlog</option>
        {allSprints.map((s) => <option key={s.id} value={s.id}>{s.sprint.name}</option>)}
      </select>

      {pri && <i className={'ti ' + pri.icon} style={{ color: pri.color, fontSize: 14, flexShrink: 0 }} />}
      <span style={{ flexShrink: 0 }}><TypeBadge type={task.type} /></span>

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
        <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
          {feature && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5, background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', color: 'var(--blue-tx)', whiteSpace: 'nowrap' }}>
              <i className="ti ti-layers-subtract" style={{ fontSize: 9, marginRight: 3 }} />{feature.name}
            </span>
          )}
          {task.description && (
            <span style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.description}
            </span>
          )}
        </div>
      </div>

      {/* Toggle ignorar horas */}
      <button
        className="ghost"
        title={task.ignored ? 'Horas desconsideradas — clique para reativar' : 'Desconsiderar horas no capacity'}
        onClick={() => store.patchTask(task.id, { ignored: !task.ignored })}
        style={{ padding: '3px 6px', fontSize: 12, flexShrink: 0, color: task.ignored ? 'var(--amber-tx)' : 'var(--text3)' }}
      >
        <i className={'ti ' + (task.ignored ? 'ti-clock-off' : 'ti-clock')} />
      </button>

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {assignee   && <Avatar name={assignee.name}   idx={assignee.colorIdx}   size={24} />}
        {qaAssignee && qaAssignee.id !== assignee?.id && (
          <Avatar name={qaAssignee.name} idx={qaAssignee.colorIdx} size={24} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button className="ghost" style={{ padding: '3px 7px', fontSize: 12 }} onClick={onEdit}>
          <i className="ti ti-pencil" />
        </button>
        <button className="ghost" style={{ padding: '3px 7px', fontSize: 12, color: 'var(--red-tx)' }} onClick={onDelete}>
          <i className="ti ti-trash" />
        </button>
      </div>
    </div>
  )
}

function Fbtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: '4px 10px',
      background: active ? 'var(--navy)' : 'var(--surface)',
      color: active ? '#fff' : 'var(--text2)',
      borderColor: active ? 'var(--navy)' : 'var(--border2)',
    }}>{children}</button>
  )
}
