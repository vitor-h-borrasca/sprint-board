import { useState, useEffect, useCallback } from 'react'
import { getAzureConfig, setEvalAreaPath } from '@/domain/board'
import { fetchDeliveryEvalItems, fetchProjectTeams } from '@/domain/azureDevOps'
import { DELIVERY_EVAL_DEADLINE_DAYS } from '@/domain/constants'

const DEADLINE = DELIVERY_EVAL_DEADLINE_DAYS

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysElapsed(isoDate) {
  if (!isoDate) return null
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
}

function fmtDate(isoDate) {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function deadlineDate(isoDate) {
  if (!isoDate) return '—'
  const d = new Date(isoDate)
  d.setDate(d.getDate() + DEADLINE)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function urgency(days) {
  if (days === null) return 'unknown'
  if (days >= DEADLINE)                          return 'overdue'
  if (days >= DEADLINE - 10)                     return 'critical'
  if (days >= Math.floor(DEADLINE / 2))          return 'warning'
  return 'ok'
}

const URGENCY = {
  overdue:  { bg: 'var(--red-bg)',    bd: 'var(--red-bd)',    tx: 'var(--red-tx)',    bar: 'var(--red)',     label: 'Vencido'  },
  critical: { bg: 'var(--orange-bg)', bd: 'var(--orange-bd)', tx: 'var(--orange-tx)', bar: 'var(--orange)',  label: 'Crítico'  },
  warning:  { bg: 'var(--amber-bg)',  bd: 'var(--amber-bd)',  tx: 'var(--amber-tx)',  bar: 'var(--amber)',   label: 'Atenção'  },
  ok:       { bg: 'var(--teal-bg)',   bd: 'var(--teal-bd)',   tx: 'var(--teal-tx)',   bar: 'var(--teal)',    label: 'OK'       },
  unknown:  { bg: 'var(--gray-bg)',   bd: 'var(--gray-bd)',   tx: 'var(--gray-tx)',   bar: 'var(--border2)', label: '?'        },
}

const URGENCY_ORDER = ['overdue', 'critical', 'warning', 'ok', 'unknown']

// ── Sub-componentes ───────────────────────────────────────────────────────────

function UrgencyBadge({ days }) {
  const st = URGENCY[urgency(days)]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: st.bg, color: st.tx, border: '1px solid ' + st.bd,
    }}>{st.label}</span>
  )
}

function DeadlineBar({ days }) {
  const u = urgency(days)
  const st = URGENCY[u]
  const pct = days === null ? 0 : Math.min(100, Math.round((days / DEADLINE) * 100))
  const remaining = days !== null ? DEADLINE - days : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: st.bar, borderRadius: 3, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11, color: st.tx, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 170 }}>
        {days === null
          ? 'Sem data de estado'
          : u === 'overdue'
            ? `${days}d — ${Math.abs(remaining ?? 0)}d além do prazo`
            : `${days}d / ${DEADLINE}d · ${remaining}d restantes`}
      </span>
    </div>
  )
}

function ItemCard({ item }) {
  const days = daysElapsed(item.stateChangedAt)
  const u = urgency(days)
  const st = URGENCY[u]
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid ' + st.bd,
      borderLeft: '4px solid ' + st.bar,
      borderRadius: 'var(--radius-lg)', padding: '12px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
            background: item.type === 'feature' ? 'var(--blue-bg)' : 'var(--purple-bg)',
            color: item.type === 'feature' ? 'var(--blue-tx)' : 'var(--purple-tx)',
            border: '1px solid ' + (item.type === 'feature' ? 'var(--blue-bd)' : 'var(--purple-bd)'),
          }}>
            {item.workItemType}
          </span>
          <a href={item.azureUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)', textDecoration: 'none' }}
            title="Abrir no Azure DevOps">
            #{item.id} <i className="ti ti-external-link" style={{ fontSize: 10 }} />
          </a>
          <UrgencyBadge days={days} />
          {item.assignedTo && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              <i className="ti ti-user" style={{ fontSize: 10, marginRight: 2 }} />
              {item.assignedTo}
            </span>
          )}
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>
          {item.title}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
          <i className="ti ti-folder" style={{ fontSize: 10, marginRight: 4 }} />
          {item.areaPath}
        </div>

        <DeadlineBar days={days} />
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 110 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Entrada</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          {fmtDate(item.stateChangedAt)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Prazo</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: u === 'overdue' ? 'var(--red-tx)' : u === 'critical' ? 'var(--orange-tx)' : 'var(--text2)' }}>
          {deadlineDate(item.stateChangedAt)}
        </div>
      </div>
    </div>
  )
}

function ItemList({ items, label, icon, color }) {
  const [sort, setSort] = useState('urgency')
  const sorted = [...items].sort((a, b) => {
    if (sort === 'urgency') return new Date(a.stateChangedAt || 0) - new Date(b.stateChangedAt || 0)
    if (sort === 'title')   return a.title.localeCompare(b.title)
    return b.id - a.id
  })
  const overdue  = items.filter((i) => daysElapsed(i.stateChangedAt) >= DEADLINE).length
  const critical = items.filter((i) => { const d = daysElapsed(i.stateChangedAt); return d !== null && d >= DEADLINE - 10 && d < DEADLINE }).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 'var(--radius-lg)',
        background: 'var(--surface2)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={'ti ' + icon} style={{ fontSize: 16, color }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: 'var(--border)', color: 'var(--text2)' }}>
            {items.length}
          </span>
          {overdue > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: 'var(--red-bg)', color: 'var(--red-tx)', border: '1px solid var(--red-bd)' }}>
              {overdue} vencido{overdue > 1 ? 's' : ''}
            </span>
          )}
          {critical > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: 'var(--orange-bg)', color: 'var(--orange-tx)', border: '1px solid var(--orange-bd)' }}>
              {critical} crítico{critical > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Ordenar:</span>
          {[
            { v: 'urgency', label: 'Mais urgente' },
            { v: 'title',   label: 'Título' },
            { v: 'id',      label: 'ID' },
          ].map(({ v, label: l }) => (
            <button key={v} onClick={() => setSort(v)} style={{
              fontSize: 10, padding: '2px 8px',
              background: sort === v ? 'var(--navy)' : 'var(--surface)',
              color: sort === v ? '#fff' : 'var(--text2)',
              borderColor: sort === v ? 'var(--navy)' : 'var(--border2)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 12,
        }}>
          <i className="ti ti-circle-check" style={{ fontSize: 20, display: 'block', marginBottom: 6, color: 'var(--teal)' }} />
          Nenhum item
        </div>
      ) : (
        sorted.map((item) => <ItemCard key={item.id} item={item} />)
      )}
    </div>
  )
}

// ── View principal ────────────────────────────────────────────────────────────

export function DeliveryEvalView() {
  const azCfg = getAzureConfig()
  const azureReady = !!(azCfg.org && azCfg.project && azCfg.pat)

  const [teams, setTeams]               = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamsError, setTeamsError]     = useState(null)
  const [selectedTeam, setSelectedTeam] = useState(azCfg.evalAreaPath || '')

  const [items, setItems]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // filtros locais (não disparam nova query)
  const [activeUrgencies, setActiveUrgencies] = useState(new Set())
  const [minDaysInput, setMinDaysInput]       = useState('')

  const minDays = minDaysInput !== '' ? parseInt(minDaysInput, 10) : null

  function applyFilters(list) {
    return list.filter((item) => {
      const days = daysElapsed(item.stateChangedAt)
      if (activeUrgencies.size > 0 && !activeUrgencies.has(urgency(days))) return false
      if (minDays !== null && !isNaN(minDays) && (days === null || days < minDays)) return false
      return true
    })
  }

  const allFiltered = applyFilters(items || [])
  const features    = allFiltered.filter((i) => i.type === 'feature')
  const pbis        = allFiltered.filter((i) => i.type === 'pbi')

  function toggleUrgency(key) {
    setActiveUrgencies((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Contagem por urgência (sobre todos os itens, antes dos filtros de urgência)
  function countByUrgency(key) {
    return (items || []).filter((i) => urgency(daysElapsed(i.stateChangedAt)) === key).length
  }

  useEffect(() => {
    if (!azureReady) return
    setTeamsLoading(true)
    setTeamsError(null)
    fetchProjectTeams(azCfg)
      .then((list) => setTeams(list))
      .catch((e) => setTeamsError(e.message))
      .finally(() => setTeamsLoading(false))
  }, [azCfg.org, azCfg.project, azCfg.pat])

  const runQuery = useCallback(async (teamName) => {
    if (!azureReady) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchDeliveryEvalItems(teamName, azCfg)
      setItems(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [azCfg.org, azCfg.project, azCfg.pat])

  function handleTeamChange(e) {
    const name = e.target.value
    setSelectedTeam(name)
    setEvalAreaPath(name)
  }

  function handleSearch(e) {
    e.preventDefault()
    runQuery(selectedTeam)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Banner */}
      <div style={{
        background: 'var(--orange-bg)', border: '1px solid var(--orange-bd)',
        borderRadius: 'var(--radius-lg)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <i className="ti ti-clock-check" style={{ fontSize: 20, color: 'var(--orange-tx)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange-tx)' }}>
            Avaliação de Entrega — Responsabilidade do PO
          </div>
          <div style={{ fontSize: 12, color: 'var(--orange-tx)', opacity: 0.85, marginTop: 2 }}>
            Prazo máximo de <strong>{DEADLINE} dias</strong> para realizar a avaliação com o seller.
            Dados consultados diretamente do Azure DevOps.
          </div>
        </div>
        {items !== null && (
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            {[
              { l: 'Features', v: (items || []).filter((i) => i.type === 'feature').length, color: 'var(--blue-tx)' },
              { l: 'PBIs',     v: (items || []).filter((i) => i.type === 'pbi').length,     color: 'var(--purple-tx)' },
              { l: 'Total',    v: items.length,                                              color: 'var(--orange-tx)' },
              { l: 'Vencidos', v: items.filter((i) => daysElapsed(i.stateChangedAt) >= DEADLINE).length, color: 'var(--red-tx)' },
            ].map((k) => (
              <div key={k.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.v}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aviso sem config Azure */}
      {!azureReady && (
        <div style={{
          border: '1px solid var(--amber-bd)', background: 'var(--amber-bg)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: 'var(--amber-tx)',
        }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 18 }} />
          Configure a integração com o <strong style={{ margin: '0 4px' }}>Azure DevOps</strong> na aba <strong style={{ margin: '0 4px' }}>Configuração → Integrações</strong> para usar essa visão.
        </div>
      )}

      {/* Filtro de time + consultar */}
      {azureReady && (
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Time
            </div>
            {teamsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, fontSize: 12, color: 'var(--text3)' }}>
                <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} />
                Carregando times...
              </div>
            ) : teamsError ? (
              <div style={{ fontSize: 12, color: 'var(--red-tx)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-alert-circle" />
                {teamsError}
              </div>
            ) : (
              <select value={selectedTeam} onChange={handleTeamChange} style={{ width: '100%', fontSize: 13, height: 36 }}>
                <option value="">— Todos os times —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <button type="submit" className="primary" disabled={loading || teamsLoading} style={{ height: 36, whiteSpace: 'nowrap' }}>
            <i className={'ti ' + (loading ? 'ti-loader' : 'ti-search')}
              style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? 'Consultando...' : 'Consultar'}
          </button>

          {items !== null && !loading && (
            <button type="button" className="ghost" onClick={() => runQuery(selectedTeam)} style={{ height: 36 }} title="Recarregar">
              <i className="ti ti-refresh" />
            </button>
          )}
        </form>
      )}

      {/* Erro na consulta */}
      {error && (
        <div style={{
          fontSize: 12, padding: '10px 14px', borderRadius: 8,
          background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red-tx)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className="ti ti-alert-circle" />
          {error}
        </div>
      )}

      {/* Filtros locais — só aparecem após consulta */}
      {items !== null && !loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '10px 14px', borderRadius: 'var(--radius-lg)',
          background: 'var(--surface2)', border: '1px solid var(--border)',
        }}>
          {/* Botões de urgência */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Status
            </span>
            {URGENCY_ORDER.filter((key) => countByUrgency(key) > 0).map((key) => {
              const st      = URGENCY[key]
              const active  = activeUrgencies.has(key)
              const count   = countByUrgency(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleUrgency(key)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, cursor: 'pointer',
                    background: active ? st.tx        : st.bg,
                    color:      active ? '#fff'       : st.tx,
                    border:     '1px solid ' + st.bd,
                    opacity:    activeUrgencies.size > 0 && !active ? 0.5 : 1,
                    transition: 'all .15s',
                  }}
                >
                  {st.label} <span style={{ opacity: 0.8 }}>({count})</span>
                </button>
              )
            })}
            {activeUrgencies.size > 0 && (
              <button
                type="button"
                onClick={() => setActiveUrgencies(new Set())}
                style={{ fontSize: 10, padding: '2px 8px', color: 'var(--text3)', background: 'transparent', border: '1px solid var(--border2)' }}
              >
                Limpar
              </button>
            )}
          </div>

          {/* Separador */}
          <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

          {/* Filtro por dias */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Mín. dias
            </span>
            <input
              type="number"
              min={0}
              placeholder="Ex: 30"
              value={minDaysInput}
              onChange={(e) => setMinDaysInput(e.target.value)}
              style={{ width: 72, fontSize: 12, height: 28, padding: '0 8px' }}
            />
            {minDaysInput !== '' && (
              <button
                type="button"
                onClick={() => setMinDaysInput('')}
                style={{ fontSize: 10, padding: '2px 8px', color: 'var(--text3)', background: 'transparent', border: '1px solid var(--border2)' }}
              >
                Limpar
              </button>
            )}
          </div>

          {/* Contagem de resultados filtrados */}
          {(activeUrgencies.size > 0 || minDaysInput !== '') && (
            <>
              <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                {allFiltered.length} de {items.length} itens
              </span>
            </>
          )}
        </div>
      )}

      {/* Estado inicial */}
      {items === null && !loading && azureReady && (
        <div style={{
          border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '48px 0', textAlign: 'center', color: 'var(--text3)',
        }}>
          <i className="ti ti-search" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Selecione um time e clique em Consultar</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Deixe "Todos os times" para ver o projeto inteiro.</div>
        </div>
      )}

      {/* Resultados */}
      {items !== null && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ItemList items={features} label="Features"            icon="ti-puzzle"      color="var(--blue)" />
          <ItemList items={pbis}     label="PBIs / User Stories" icon="ti-list-check"  color="var(--purple)" />
        </div>
      )}
    </div>
  )
}
