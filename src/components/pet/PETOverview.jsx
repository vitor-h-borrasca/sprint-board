import { useState } from 'react'
import { QUARTERS, QUARTER_COLORS, PET_STATUSES } from '@/domain/constants'
import { Badge } from '@/components/shared'
import { quarterStats } from '@/domain/initiatives'

const STATUS_COLS = [
  { key: 'notstarted',   label: 'NÃO INICIADO',  icon: 'ti-circle' },
  { key: 'doing',        label: 'EM ANDAMENTO',  icon: 'ti-progress' },
  { key: 'done',         label: 'CONCLUÍDO',     icon: 'ti-circle-check' },
  { key: 'late',         label: 'ATRASADO',      icon: 'ti-alert-triangle' },
  { key: 'depriorized',  label: 'DESPRIORIZADOS', icon: 'ti-x' },
]

const DEPRIORIZED_STATUS = {
  bg: 'var(--gray-bg)', bd: 'var(--gray-bd)', tx: 'var(--gray-tx)',
}

function DonutChart({ pct, color, size = 60 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={7} />
      {pct > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .4s' }}
        />
      )}
    </svg>
  )
}

function QuarterCard({ stat, selected, onClick }) {
  const qc = QUARTER_COLORS[stat.quarter]
  const pct = stat.total > 0 ? Math.round(stat.done / stat.total * 100) : 0

  // label do estado predominante
  const label = stat.total === 0
    ? 'Vazio'
    : stat.done === stat.total
      ? 'Concluído'
      : stat.doing > 0
        ? 'Em andamento'
        : stat.late > 0
          ? 'Atrasado'
          : 'Não inic.'

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? qc.bg : 'var(--surface)',
        border: '1px solid ' + (selected ? qc.bd : 'var(--border)'),
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .15s',
        outline: selected ? `2px solid ${qc.bd}` : 'none',
        outlineOffset: 2,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <Badge bg={qc.bg} bd={qc.bd} tx={qc.tx} style={{ fontWeight: 700, fontSize: 12 }}>
          {stat.quarter}
        </Badge>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {stat.initiativeCount} iniciativa{stat.initiativeCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
          <DonutChart pct={pct} color={qc.tx} size={60} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', transform: 'none',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: qc.tx }}>{pct}%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{label}</div>
          {stat.late > 0 && (
            <Badge bg="var(--red-bg)" bd="var(--red-bd)" tx="var(--red-tx)" style={{ fontSize: 10, marginTop: 4 }}>
              {stat.late} atrasada{stat.late > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: pct + '%', background: qc.tx, borderRadius: 2, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{stat.done}/{stat.total} concluídas</div>

      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
        clique para filtrar
      </div>
    </div>
  )
}

function InitiativeOverviewCard({ initiative, qc }) {
  const st = PET_STATUSES[initiative.status] || PET_STATUSES.notstarted
  const tagColor = initiative.tag === 'prod'
    ? { bg: 'var(--amber-bg)', bd: 'var(--amber-bd)', tx: 'var(--amber-tx)' }
    : { bg: 'var(--blue-bg)', bd: 'var(--blue-bd)', tx: 'var(--blue-tx)' }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, color: 'var(--text)' }}>
        {initiative.isInitiative !== false && (
          <span style={{ marginRight: 4, color: 'var(--purple-tx)' }}>🎯</span>
        )}
        {initiative.prioritized === false && (
          <span style={{ marginRight: 4, color: 'var(--text3)', textDecoration: 'line-through' }}></span>
        )}
        {initiative.title}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Badge bg={qc.bg} bd={qc.bd} tx={qc.tx} style={{ fontSize: 10 }}>{initiative.quarter}</Badge>
          {initiative.tag && (
            <Badge bg={tagColor.bg} bd={tagColor.bd} tx={tagColor.tx} style={{ fontSize: 10, textTransform: 'capitalize' }}>
              {initiative.tag.charAt(0).toUpperCase() + initiative.tag.slice(1)}
            </Badge>
          )}
          {initiative.size && (
            <Badge bg="var(--surface2)" bd="var(--border)" tx="var(--text2)" style={{ fontSize: 10 }}>
              {initiative.size}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export function PETOverview({ initiatives, shr }) {
  const [selectedQ, setSelectedQ] = useState('all')

  const stats = quarterStats(initiatives, shr)

  const filtered = selectedQ === 'all'
    ? initiatives
    : initiatives.filter((i) => i.quarter === selectedQ)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Quarter cards */}
      <div className="grid-4">
        {stats.map((stat) => (
          <QuarterCard
            key={stat.quarter}
            stat={stat}
            selected={selectedQ === stat.quarter}
            onClick={() => setSelectedQ(selectedQ === stat.quarter ? 'all' : stat.quarter)}
          />
        ))}
      </div>

      {/* Colunas de status */}
      <div className="board-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(190px, 1fr))' }}>
        {STATUS_COLS.map(({ key, label, icon }) => {
          const st = key === 'depriorized' ? DEPRIORIZED_STATUS : PET_STATUSES[key]
          const items = key === 'depriorized'
            ? filtered.filter((i) => i.prioritized === false)
            : filtered.filter((i) => i.prioritized !== false && (i.status || 'notstarted') === key)

          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Header da coluna */}
              <div style={{
                background: st.bg,
                border: '1px solid ' + st.bd,
                borderRadius: 'var(--radius-lg)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className={'ti ' + icon} style={{ fontSize: 13, color: st.tx }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: st.tx }}>{label}</span>
                </div>
                <span style={{
                  background: st.bd, color: st.tx,
                  borderRadius: 20, padding: '1px 8px',
                  fontSize: 11, fontWeight: 600,
                }}>
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              {items.map((init) => {
                const qc = QUARTER_COLORS[init.quarter] || QUARTER_COLORS.Q1
                return (
                  <InitiativeOverviewCard key={init.id} initiative={init} qc={qc} />
                )
              })}

              {items.length === 0 && (
                <div style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px 0',
                  textAlign: 'center',
                  color: 'var(--text3)',
                  fontSize: 12,
                }}>
                  Vazio
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
