import { useState, useEffect, useCallback } from 'react'
import useBoardStore from '@/store/useBoardStore'
import { getAzureConfig } from '@/domain/board'
import { fetchBugClients } from '@/domain/azureDevOps'

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

export default function BugClientView() {
  const teamAreaPath = useBoardStore((s) => s.teamAreaPath)
  const azureConfig  = getAzureConfig()
  const azureReady   = !!(azureConfig.org && azureConfig.project && azureConfig.pat)

  const [bugs, setBugs]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [areaWarn, setAreaWarn]   = useState('')

  const load = useCallback(async () => {
    if (!azureReady) return
    setLoading(true)
    setError('')
    setAreaWarn('')
    try {
      const data = await fetchBugClients(teamAreaPath, azureConfig)
      setBugs(data)
    } catch (e) {
      // TF51011 = area path não existe no ADO → tenta sem filtro de área
      if (e.message.includes('TF51011') || e.message.includes('area path')) {
        setAreaWarn(`Area Path "${teamAreaPath}" não encontrado no Azure DevOps. Exibindo bugs sem filtro de área.`)
        try {
          const data = await fetchBugClients('', azureConfig)
          setBugs(data)
        } catch (e2) {
          setError(e2.message)
        }
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [teamAreaPath, azureConfig.org, azureConfig.project, azureConfig.pat])

  useEffect(() => { load() }, [load])

  const filtered = bugs.filter((b) =>
    !search ||
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    String(b.id).includes(search) ||
    b.assignedTo.toLowerCase().includes(search.toLowerCase())
  )

  if (!azureReady) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 13 }}>
        <i className="ti ti-plug-connected-x" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: 0.25 }} />
        Configure o Azure DevOps na aba <b>Integrações</b> para visualizar os Bug Clients.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

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
          {!loading && bugs.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {filtered.length} de {bugs.length} bug{bugs.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            className="ghost"
            style={{ fontSize: 12 }}
            onClick={load}
            disabled={loading}
            title="Recarregar Bug Clients do Azure DevOps"
          >
            <i className={'ti ' + (loading ? 'ti-loader' : 'ti-refresh')}
              style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Aviso area path */}
      {areaWarn && (
        <div style={{
          fontSize: 12, padding: '8px 12px', borderRadius: 8,
          background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', color: 'var(--amber-tx)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className="ti ti-alert-triangle" />
          {areaWarn}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{
          fontSize: 12, padding: '8px 12px', borderRadius: 8,
          background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red-tx)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className="ti ti-alert-circle" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && bugs.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              height: 44, borderRadius: 8, background: 'var(--surface2)',
              border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite',
              opacity: 1 - i * 0.15,
            }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 13 }}>
          <i className="ti ti-bug-off" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: 0.25 }} />
          {search ? 'Nenhum bug encontrado para essa busca.' : 'Nenhum Bug Client ativo para este time.'}
        </div>
      )}

      {/* Tabela */}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {[
                  { l: 'ID',                    w: 80  },
                  { l: 'Título',                w: null },
                  { l: 'Status',                w: 180 },
                  { l: 'Desenvolvedor',         w: 180 },
                  { l: 'Prioridade',            w: 90  },
                  { l: 'Criado em',             w: 160 },
                  { l: 'Integração',            w: 120 },
                ].map(({ l, w }) => (
                  <th key={l} style={{
                    padding: '9px 12px', textAlign: 'left', fontWeight: 600,
                    fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
                    letterSpacing: '.05em', whiteSpace: 'nowrap',
                    width: w || undefined,
                  }}>
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((bug, idx) => (
                <tr key={bug.id} style={{
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                  transition: 'background .1s',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--navy-hover, rgba(59,130,246,.06))'}
                  onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)'}
                >
                  {/* ID */}
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <a
                      href={bug.azureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                      title="Abrir no Azure DevOps"
                    >
                      #{bug.id}
                    </a>
                  </td>

                  {/* Título */}
                  <td style={{ padding: '9px 12px', color: 'var(--text)', lineHeight: 1.4, maxWidth: 420 }}>
                    <a
                      href={bug.azureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                      title={bug.title}
                    >
                      {bug.title}
                    </a>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    {stateBadge(bug.state)}
                  </td>

                  {/* Desenvolvedor */}
                  <td style={{ padding: '9px 12px', color: 'var(--text2)', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bug.assignedTo || <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>

                  {/* Prioridade */}
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    {bug.priority != null
                      ? <PriorityBadge priority={bug.priority} />
                      : <span style={{ color: 'var(--text3)' }}>—</span>
                    }
                  </td>

                  {/* Criado em */}
                  <td style={{ padding: '9px 12px', color: 'var(--text3)', whiteSpace: 'nowrap', fontSize: 11 }}>
                    {fmtDate(bug.createdDate)}
                  </td>

                  {/* Integração */}
                  <td style={{ padding: '9px 12px' }}>
                    {bug.integracoesMarketplace
                      ? <span style={{ fontSize: 11, background: 'var(--purple-bg)', color: 'var(--purple-tx)', border: '1px solid var(--purple-bd)', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{bug.integracoesMarketplace}</span>
                      : <span style={{ color: 'var(--text3)' }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50%       { opacity: .4 }
        }
      `}</style>
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
      background: s.bg, color: s.tx, border: `1px solid ${s.bd}`,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}
