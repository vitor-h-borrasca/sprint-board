import { SIZES, QUARTERS, PET_STATUSES, TYPE_LABELS } from '@/domain/constants'
import { countInitiativesInQuarter, validateInitiativeLimit } from '@/domain/initiatives'
import { Field } from '@/components/shared'

/**
 * Formulário de criação/edição de iniciativa PET.
 * Recebe form/setForm/onSubmit do hook usePET — zero lógica de negócio aqui.
 */
export function InitiativeForm({ form, setForm, onSubmit, onCancel, editId, initiatives, shr, allSprints }) {
  function handleIsInitiativeChange(e) {
    if (e.target.checked) {
      const error = validateInitiativeLimit(initiatives, form.quarter, editId)
      if (error) { alert(error); return }
    }
    setForm({ ...form, isInitiative: e.target.checked })
  }

  function handleQuarterChange(e) {
    setForm({ ...form, quarter: e.target.value })
  }

  function toggleSprint(sprintId, checked) {
    const ids = form.linkedSprintIds || []
    setForm({ ...form, linkedSprintIds: checked ? [...ids, sprintId] : ids.filter((x) => x !== sprintId) })
  }

  function toggleTask(taskId, checked) {
    const ids = form.linkedTaskIds || []
    setForm({ ...form, linkedTaskIds: checked ? [...ids, taskId] : ids.filter((x) => x !== taskId) })
  }

  // Tarefas das sprints vinculadas, agrupadas por sprint
  const linkedSprintObjs = allSprints.filter((s) => (form.linkedSprintIds || []).includes(s.id))
  const availableTasks   = linkedSprintObjs.flatMap((s) =>
    s.tasks.map((t) => ({ ...t, sprintName: s.sprint.name }))
  )

  const initiativeCountInQ = countInitiativesInQuarter(initiatives, form.quarter, editId)
  const atLimit = initiativeCountInQ >= 2

  return (
    <div style={{ background: 'var(--purple-bg)', border: '1px solid var(--purple-bd)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem' }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--navy)' }}>
        {editId ? 'EDITAR ITEM' : 'NOVO ITEM'}
      </div>

      <Field label="Título">
        <input
          autoFocus
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Descreva a iniciativa ou demanda priorizada"
        />
      </Field>

      {/* Linha 1: Quarter, Tag, Tamanho, Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
        <Field label="Quarter">
          <select value={form.quarter} onChange={handleQuarterChange}>
            {QUARTERS.map((q) => {
              const count = countInitiativesInQuarter(initiatives, q, editId)
              return <option key={q} value={q}>{q}{form.isInitiative ? ` (${count}/2)` : ''}</option>
            })}
          </select>
        </Field>
        <Field label="Tag">
          <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
            <option value="tec">Tec</option>
            <option value="prod">Prod</option>
          </select>
        </Field>
        <Field label="Tamanho">
          <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
            {SIZES.map((s) => <option key={s} value={s}>{s} — {shr[s]}h</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(PET_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
      </div>

      {/* Linha 2: Tipo e Priorização */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {/* Tipo */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Tipo</div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            padding: '8px 12px',
            border: '1px solid ' + (form.isInitiative ? 'var(--purple-bd)' : 'var(--border2)'),
            borderRadius: 'var(--radius)',
            background: form.isInitiative ? '#EDE9FE' : 'var(--surface)',
            transition: 'all .15s',
          }}>
            <input
              type="checkbox"
              checked={form.isInitiative}
              onChange={handleIsInitiativeChange}
              style={{ width: 'auto', cursor: 'pointer', accentColor: 'var(--purple)' }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: form.isInitiative ? 'var(--purple-tx)' : 'var(--text2)' }}>
                {form.isInitiative ? '🎯 Iniciativa estratégica' : '📌 Demanda priorizada'}
              </div>
              <div style={{ fontSize: 10, color: atLimit && form.isInitiative ? 'var(--red-tx)' : 'var(--text3)', marginTop: 2 }}>
                {form.isInitiative
                  ? (atLimit ? '⚠ Limite atingido neste Q' : `${initiativeCountInQ}/2 iniciativas no ${form.quarter}`)
                  : 'Demanda relevante sem ser iniciativa'}
              </div>
            </div>
          </label>
        </div>

        {/* Priorização */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Priorização</div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            padding: '8px 12px',
            border: '1px solid ' + (form.prioritized ? 'var(--teal-bd)' : 'var(--red-bd)'),
            borderRadius: 'var(--radius)',
            background: form.prioritized ? 'var(--teal-bg)' : 'var(--red-bg)',
            transition: 'all .15s',
          }}>
            <input
              type="checkbox"
              checked={form.prioritized}
              onChange={(e) => setForm({ ...form, prioritized: e.target.checked })}
              style={{ width: 'auto', cursor: 'pointer', accentColor: form.prioritized ? 'var(--teal)' : 'var(--red)' }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: form.prioritized ? 'var(--teal-tx)' : 'var(--red-tx)' }}>
                {form.prioritized ? '✓ Priorizada' : '✕ Despriorizada'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                {form.prioritized ? 'Ativa no quarter' : 'Removida da prioridade'}
              </div>
            </div>
          </label>
        </div>
      </div>

      <Field label="Descrição (opcional)">
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Contexto, objetivo..."
          style={{ minHeight: 56, resize: 'vertical' }}
        />
      </Field>

      {/* Sprints vinculadas */}
      {allSprints.length > 0 && (
        <Field label="Sprints vinculadas" hint="(progresso real calculado das tarefas)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '6px 8px', background: 'var(--surface)' }}>
            {allSprints.map((s) => {
              const linked = (form.linkedSprintIds || []).includes(s.id)
              return (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer', color: linked ? 'var(--blue-tx)' : 'var(--text2)' }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto', cursor: 'pointer' }}
                    checked={linked}
                    onChange={(e) => toggleSprint(s.id, e.target.checked)}
                  />
                  <i className="ti ti-run" style={{ fontSize: 12, color: 'var(--orange)' }} />
                  {s.sprint.name}
                  <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>{s.tasks.length} tarefas</span>
                </label>
              )
            })}
          </div>
        </Field>
      )}

      {/* Tarefas vinculadas (filtro de progresso) */}
      {availableTasks.length > 0 && (
        <Field label="Tarefas desta iniciativa" hint="(somente estas contarão no progresso)">
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            maxHeight: 180, overflowY: 'auto',
            border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
            padding: '6px 8px', background: 'var(--surface)',
          }}>
            {availableTasks.map((t) => {
              const linked = (form.linkedTaskIds || []).includes(t.id)
              return (
                <label key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  cursor: 'pointer', color: linked ? 'var(--blue-tx)' : 'var(--text2)',
                  padding: '3px 4px', borderRadius: 4,
                  background: linked ? 'var(--blue-bg)' : 'transparent',
                  transition: 'background .1s',
                }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto', cursor: 'pointer', flexShrink: 0 }}
                    checked={linked}
                    onChange={(e) => toggleTask(t.id, e.target.checked)}
                  />
                  {t.code && (
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{t.code}</span>
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>
                    {t.title || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>sem título</span>}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{t.sprintName}</span>
                </label>
              )
            })}
          </div>
          {(form.linkedTaskIds || []).length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
              {(form.linkedTaskIds || []).length} tarefa{(form.linkedTaskIds || []).length > 1 ? 's' : ''} selecionada{(form.linkedTaskIds || []).length > 1 ? 's' : ''} de {availableTasks.length}
            </div>
          )}
        </Field>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="primary" onClick={onSubmit}>
          <i className="ti ti-check" style={{ fontSize: 14 }} />
          {editId ? 'Salvar edição' : 'Adicionar'}
        </button>
        <button onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}
