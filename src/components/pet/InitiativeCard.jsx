import { QUARTER_COLORS, PET_STATUSES } from '@/domain/constants'
import { Badge } from '@/components/shared'
import { fmtHrs } from '@/domain/utils'

/**
 * Card de uma iniciativa PET.
 * Props puras — zero lógica de negócio, zero estado local.
 */
export function InitiativeCard({ initiative: init, shr, linkedSprints = [], onEdit, onDelete, onTogglePrioritized, onSetStatus }) {
  const qc = QUARTER_COLORS[init.quarter || 'Q1']
  const st = PET_STATUSES[init.status] || PET_STATUSES.notstarted
  const tagC = init.tag === 'prod'
    ? { bg: 'var(--purple-bg)', bd: 'var(--purple-bd)', tx: 'var(--purple-tx)' }
    : { bg: 'var(--blue-bg)',   bd: 'var(--blue-bd)',   tx: 'var(--blue-tx)' }

  const isInitiative = init.isInitiative !== false
  const isPrioritized = init.prioritized !== false
  const hrs = shr[init.size] || 0

  const allLinkedTasks   = linkedSprints.flatMap((s) => s.tasks)
  const hasTaskFilter    = init.linkedTaskIds?.length > 0
  const linkedTasks      = hasTaskFilter
    ? allLinkedTasks.filter((t) => init.linkedTaskIds.includes(t.id))
    : allLinkedTasks
  const linkedDone  = linkedTasks.filter((t) => t.status === 'done').length
  const linkedPct   = linkedTasks.length > 0 ? Math.round(linkedDone / linkedTasks.length * 100) : null

  return (
    <div style={{
      background: !isPrioritized ? 'var(--gray-bg)' : 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid ' + (!isPrioritized ? 'var(--text3)' : isInitiative ? 'var(--purple)' : qc.tx),
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      opacity: !isPrioritized ? 0.65 : 1,
      transition: 'opacity .2s, background .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>

        {/* Conteúdo principal */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{init.title}</span>
            {!isPrioritized && (
              <Badge bg="var(--red-bg)" bd="var(--red-bd)" tx="var(--red-tx)" style={{ fontSize: 10 }}>✕ Despriorizada</Badge>
            )}
          </div>

          {init.description && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, lineHeight: 1.4 }}>
              {init.description}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge bg={qc.bg} bd={qc.bd} tx={qc.tx} style={{ fontWeight: 700 }}>{init.quarter}</Badge>
            <Badge bg={tagC.bg} bd={tagC.bd} tx={tagC.tx}>{init.tag === 'prod' ? 'Prod' : 'Tec'}</Badge>
            <Badge bg="var(--gray-bg)" bd="var(--gray-bd)" tx="var(--gray-tx)">{init.size} · {fmtHrs(hrs)}</Badge>
            {isInitiative
              ? <Badge bg="var(--purple-bg)" bd="var(--purple-bd)" tx="var(--purple-tx)" style={{ fontSize: 10 }}>🎯 Iniciativa</Badge>
              : <Badge bg="var(--blue-bg)"   bd="var(--blue-bd)"   tx="var(--blue-tx)"   style={{ fontSize: 10 }}>📌 Demanda</Badge>
            }
            {linkedSprints.length > 0 && (
              <Badge bg="var(--orange)22" bd="var(--orange)44" tx="var(--orange)" style={{ fontSize: 10 }}>
                <i className="ti ti-run" style={{ fontSize: 10 }} />
                {linkedSprints.map((s) => s.sprint.name).join(', ')}
              </Badge>
            )}
          </div>

          {/* Barra de progresso real */}
          {linkedPct !== null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>
                <span>Progresso real ({linkedDone}/{linkedTasks.length} tarefas{hasTaskFilter && allLinkedTasks.length > linkedTasks.length ? ` de ${allLinkedTasks.length} na sprint` : ''})</span>
                <span style={{ fontWeight: 700, color: linkedPct === 100 ? 'var(--teal-tx)' : 'var(--blue-tx)' }}>{linkedPct}%</span>
              </div>
              <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ height: '100%', width: linkedPct + '%', background: linkedPct === 100 ? 'var(--teal)' : 'var(--blue)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <button
            onClick={() => onTogglePrioritized(init.id)}
            style={{
              fontSize: 10, padding: '3px 8px',
              background: isPrioritized ? 'var(--teal-bg)' : 'var(--red-bg)',
              borderColor: isPrioritized ? 'var(--teal-bd)' : 'var(--red-bd)',
              color: isPrioritized ? 'var(--teal-tx)' : 'var(--red-tx)',
            }}
            title={isPrioritized ? 'Clique para despriorizar' : 'Clique para priorizar'}
          >
            {isPrioritized ? '✓ Priorizada' : '✕ Despriorizada'}
          </button>

          <select
            value={init.status}
            onChange={(e) => onSetStatus(init.id, e.target.value)}
            style={{ fontSize: 11, padding: '3px 6px', border: '1px solid ' + st.bd, borderRadius: 5, background: st.bg, color: st.tx, width: 'auto', cursor: 'pointer' }}
          >
            {Object.entries(PET_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <button style={{ padding: '4px 8px' }} onClick={() => onEdit(init)}>
            <i className="ti ti-edit" style={{ fontSize: 12 }} />
          </button>
          <button className="danger" style={{ padding: '4px 8px' }} onClick={() => onDelete(init.id)}>
            <i className="ti ti-trash" style={{ fontSize: 12 }} />
          </button>
        </div>
      </div>
    </div>
  )
}
