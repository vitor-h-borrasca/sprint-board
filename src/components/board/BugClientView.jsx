import { useState, useEffect, useCallback } from 'react'
import useBoardStore from '@/store/useBoardStore'
import { getAzureConfig } from '@/domain/board'
import { fetchBugClients, fetchBugHoms, fetchServFabrica } from '@/domain/azureDevOps'
import { genId } from '@/domain/utils'

// Mapeamento de status → cor
const STATE_COLOR = {
  'Em Desenvolvimento':  { dot: '#3B82F6', bg: '#EFF6FF', tx: '#1D4ED8' },
  'Para Desenvolvimento':{ dot: '#8B5CF6', bg: '#F5F3FF', tx: '#6D28D9' },
  'Para Code Review':    { dot: '#F59E0B', bg: '#FFFBEB', tx: '#B45309' },
  'Em Code Review':      { dot: '#F59E0B', bg: '#FFFBEB', tx: '#B45309' },
  'Para Priorização':    { dot: '#6B7280', bg: '#F9FAFB', tx: '#374151' },
  'Observação':          { dot: '#10B981', bg: '#ECFDF5', tx: '#065F46' },
  'Em Homologação':      { dot: '#06B6D4', bg: '#ECFEFF', tx: '#0E7490' },
  'Para Homologação':    { dot: '#06B6D4', bg: '#ECFEFF', tx: '#0E7490' },
  'Em Análise':          { dot: '#F97316', bg: '#FFF7ED', tx: '#C2410C' },
  'New':                 { dot: '#6B7280', bg: '#F9FAFB', tx: '#374151' },
}

const SECTION_META = {
  client:  { label: '🐞 Bug Client',      accent: '#EF4444' },
  hom:     { label: '🧪 Bug Hom',         accent: '#8B5CF6' },
  fabrica: { label: '🏭 Serviço Fábrica', accent: '#F59E0B' },
}

function stateBadge(state) {
  const s = STATE_COLOR[state] || { dot: '#9CA3AF', bg: '#F3F4F6', tx: '#6B7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.tx,
      border: `1px solid ${s.dot}33`,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {state}
    </span>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function BugTable({ items, bugType, showClienteLiberado }) {
  const board      = useBoardStore((s) => s.board)
  const upsertTask = useBoardStore((s) => s.upsertTask)

  const sprintTasks = board.sprints.find((s) => s.id === board.activeSprintId)?.tasks || []
  const codesInSprint = new Set(sprintTasks.map((t) => t.code).filter(Boolean))

  function addToSprint(bug) {
    const typeMap = { client: 'bugclient', hom: 'bughom', fabrica: 'servico' }
    upsertTask({
      id:       genId(),
      code:     String(bug.id),
      title:    bug.title,
      type:     typeMap[bugType] || 'bugclient',
      status:   'todo',
      priority: 2,
      sprintId: board.activeSprintId,
      inSprint: true,
      areaPath: bug.areaPath || '',
    })
  }

  if (!items.length) return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>
      <i className="ti ti-circle-check" style={{ fontSize: 22, display: 'block', marginBottom: 6, opacity: 0.3 }} />
      Nenhum item ativo.
    </div>
  )

  const cols = [
    { l: 'ID',            w: 80  },
    { l: 'Título',        w: null },
    { l: 'Status',        w: 180 },
    { l: 'Desenvolvedor', w: 180 },
    { l: 'Prioridade',    w: 90  },
    { l: 'Criado em',     w: 160 },
    ...(showClienteLiberado ? [{ l: 'Cliente liberado', w: 160 }] : []),
    { l: 'Sprint',        w: 110 },
  ]

  return (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {cols.map(({ l, w }) => (
              <th key={l} style={{
                padding: '9px 12px', textAlign: 'left', fontWeight: 600,
                fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
                letterSpacing: '.05em', whiteSpace: 'nowrap',
                width: w || undefined,
              }}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((bug, idx) => {
            const inSprint = codesInSprint.has(String(bug.id))
            return (
              <tr key={bug.id}
                style={{
                  borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                  background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--navy-hover, rgba(59,130,246,.06))'}
                onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)'}
              >
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <a href={bug.azureUrl} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    #{bug.id}
                  </a>
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--text)', lineHeight: 1.4, maxWidth: 420 }}>
                  <a href={bug.azureUrl} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'none' }} title={bug.title}>
                    {bug.title}
                  </a>
                </td>
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{stateBadge(bug.state)}</td>
                <td style={{ padding: '9px 12px', color: 'var(--text2)', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {bug.assignedTo || <span style={{ color: 'var(--text3)' }}>—</span>}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                  {bug.priority != null ? <PriorityBadge priority={bug.priority} /> : <span style={{ color: 'var(--text3)' }}>—</span>}
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--text3)', whiteSpace: 'nowrap', fontSize: 11 }}>
                  {fmtDate(bug.createdDate)}
                </td>
                {showClienteLiberado && (
                  <td style={{ padding: '9px 12px', color: 'var(--text3)', whiteSpace: 'nowrap', fontSize: 11 }}>
                    {bug.clienteLiberado || <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                )}
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  {inSprint ? (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--teal-tx)',
                      background: 'var(--teal-bg)', border: '1px solid var(--teal-bd)',
                      borderRadius: 6, padding: '3px 10px',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <i className="ti ti-check" style={{ fontSize: 11 }} /> Na sprint
                    </span>
                  ) : (
                    <button
                      onClick={() => addToSprint(bug)}
                      style={{ fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap' }}
                    >
                      <i className="ti ti-circle-plus" style={{ fontSize: 11 }} /> Adicionar
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SectionHeader({ type, count, loading }) {
  const meta = SECTION_META[type]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0 6px',
      borderBottom: `2px solid ${meta.accent}22`,
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>{meta.label}</span>
      {loading
        ? <span style={{ fontSize: 11, color: 'var(--text3)' }}>carregando...</span>
        : <span style={{
            fontSize: 11, fontWeight: 600, background: `${meta.accent}18`,
            color: meta.accent, border: `1px solid ${meta.accent}44`,
            borderRadius: 20, padding: '1px 10px',
          }}>{count}</span>
      }
    </div>
  )
}

export default function BugClientView() {
  const teamAreaPath = useBoardStore((s) => s.teamAreaPath)
  const azureConfig  = getAzureConfig()
  const azureReady   = !!(azureConfig.org && azureConfig.project && azureConfig.pat)

  const [data, setData]       = useState({ client: [], hom: [], fabrica: [] })
  const [loading, setLoading] = useState({ client: false, hom: false, fabrica: false })
  const [errors, setErrors]   = useState({ client: '', hom: '', fabrica: '' })
  const [search, setSearch]   = useState('')

  const loadAll = useCallback(async () => {
    if (!azureReady) return
    setLoading({ client: true, hom: true, fabrica: true })
    setErrors({ client: '', hom: '', fabrica: '' })

    const safe = (fn, key) =>
      fn(teamAreaPath, azureConfig)
        .catch(async (e) => {
          if (e.message.includes('TF51011') || e.message.includes('area path')) {
            return fn('', azureConfig).catch((e2) => { setErrors((prev) => ({ ...prev, [key]: e2.message })); return [] })
          }
          setErrors((prev) => ({ ...prev, [key]: e.message }))
          return []
        })
        .finally(() => setLoading((prev) => ({ ...prev, [key]: false })))

    const [client, hom, fabrica] = await Promise.all([
      safe(fetchBugClients,  'client'),
      safe(fetchBugHoms,     'hom'),
      safe(fetchServFabrica, 'fabrica'),
    ])
    setData({ client, hom, fabrica })
  }, [teamAreaPath, azureConfig.org, azureConfig.project, azureConfig.pat])

  useEffect(() => { loadAll() }, [loadAll])

  const filter = (list) => !search ? list : list.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    String(b.id).includes(search) ||
    b.assignedTo.toLowerCase().includes(search.toLowerCase())
  )

  const isLoading = Object.values(loading).some(Boolean)
  const total     = data.client.length + data.hom.length + data.fabrica.length

  if (!azureReady) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 13 }}>
        <i className="ti ti-plug-connected-x" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: 0.25 }} />
        Configure o Azure DevOps na aba <b>Integrações</b> para visualizar os bugs.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, título ou responsável..."
            style={{ paddingLeft: 30, fontSize: 12, width: '100%' }}
          />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isLoading && total > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {filter([...data.client, ...data.hom, ...data.fabrica]).length} de {total} itens
            </span>
          )}
          <button className="ghost" style={{ fontSize: 12 }} onClick={loadAll} disabled={isLoading}>
            <i className={'ti ' + (isLoading ? 'ti-loader' : 'ti-refresh')}
              style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
            {isLoading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Seção Bug Client */}
      <div>
        <SectionHeader type="client" count={filter(data.client).length} loading={loading.client} />
        {errors.client && <ErrorBanner msg={errors.client} />}
        {loading.client
          ? <LoadingSkeleton />
          : <BugTable items={filter(data.client)} bugType="client" showClienteLiberado />
        }
      </div>

      {/* Seção Bug Hom */}
      <div>
        <SectionHeader type="hom" count={filter(data.hom).length} loading={loading.hom} />
        {errors.hom && <ErrorBanner msg={errors.hom} />}
        {loading.hom
          ? <LoadingSkeleton />
          : <BugTable items={filter(data.hom)} bugType="hom" />
        }
      </div>

      {/* Seção Serviço Fábrica */}
      <div>
        <SectionHeader type="fabrica" count={filter(data.fabrica).length} loading={loading.fabrica} />
        {errors.fabrica && <ErrorBanner msg={errors.fabrica} />}
        {loading.fabrica
          ? <LoadingSkeleton />
          : <BugTable items={filter(data.fabrica)} bugType="fabrica" />
        }
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
      `}</style>
    </div>
  )
}

function ErrorBanner({ msg }) {
  return (
    <div style={{
      fontSize: 12, padding: '8px 12px', borderRadius: 8, marginTop: 6,
      background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red-tx)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <i className="ti ti-alert-circle" />{msg}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          height: 40, borderRadius: 8, background: 'var(--surface2)',
          border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite',
          opacity: 1 - i * 0.2,
        }} />
      ))}
    </div>
  )
}

function PriorityBadge({ priority }) {
  const map = {
    1: { label: '1 - Crítica', bg: '#FEF2F2', tx: '#B91C1C', bd: '#FECACA' },
    2: { label: '2 - Alta',    bg: '#FFF7ED', tx: '#C2410C', bd: '#FED7AA' },
    3: { label: '3 - Média',   bg: '#FFFBEB', tx: '#B45309', bd: '#FDE68A' },
    4: { label: '4 - Baixa',   bg: '#F0FDF4', tx: '#166534', bd: '#BBF7D0' },
  }
  const s = map[priority] || { label: String(priority), bg: 'var(--surface2)', tx: 'var(--text3)', bd: 'var(--border)' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 10px',
      background: s.bg, color: s.tx, border: `1px solid ${s.bd}`, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}
