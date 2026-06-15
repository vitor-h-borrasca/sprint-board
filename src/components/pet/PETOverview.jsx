import { useState, useRef, useEffect } from 'react'
import { QUARTERS, QUARTER_COLORS, PET_STATUSES } from '@/domain/constants'
import { Badge, Avatar } from '@/components/shared'
import { quarterStats } from '@/domain/initiatives'
import useBoardStore from '@/store/useBoardStore'

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

export function QuarterConfigModal({ quarter, qc, onClose }) {
  const store = useBoardStore()
  const members = store.board.members || []
  const activePetSlot = store.activePetSlot
  const cfg = activePetSlot?.pet?.quarterConfigs?.[quarter] || {}

  const [form, setForm] = useState({
    startDate: cfg.startDate || '',
    endDate: cfg.endDate || '',
    workingDays: cfg.workingDays ?? 60,
    generalAbsences: cfg.generalAbsences || [],
    memberAbsences: cfg.memberAbsences || {},
  })
  const [newAbsence, setNewAbsence] = useState({ startDate: '', endDate: '', reason: '' })
  const [expandedMember, setExpandedMember] = useState(null)
  const [newMemberAbsence, setNewMemberAbsence] = useState({})
  const modalRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function save() {
    store.updateQuarterConfig(quarter, form)
    onClose()
  }

  function addAbsence() {
    if (!newAbsence.startDate) return
    setForm((f) => ({
      ...f,
      generalAbsences: [...f.generalAbsences, { ...newAbsence, id: Date.now().toString() }],
    }))
    setNewAbsence({ startDate: '', endDate: '', reason: '' })
  }

  function removeAbsence(id) {
    setForm((f) => ({ ...f, generalAbsences: f.generalAbsences.filter((a) => a.id !== id) }))
  }

  function addMemberAbsence(memberId) {
    const abs = newMemberAbsence[memberId] || {}
    if (!abs.startDate) return
    setForm((f) => ({
      ...f,
      memberAbsences: {
        ...f.memberAbsences,
        [memberId]: [...(f.memberAbsences[memberId] || []), { ...abs, id: Date.now().toString() }],
      },
    }))
    setNewMemberAbsence((prev) => ({ ...prev, [memberId]: { startDate: '', endDate: '', reason: '' } }))
  }

  function removeMemberAbsence(memberId, absId) {
    setForm((f) => ({
      ...f,
      memberAbsences: {
        ...f.memberAbsences,
        [memberId]: (f.memberAbsences[memberId] || []).filter((a) => a.id !== absId),
      },
    }))
  }

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
      {children}
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div ref={modalRef} style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        width: 520,
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge bg={qc.bg} bd={qc.bd} tx={qc.tx} style={{ fontWeight: 700, fontSize: 13 }}>{quarter}</Badge>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Configuração do Quarter</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Datas */}
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Período</SectionLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>Início</span>
              <input type="date" value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                style={{ width: '100%', fontSize: 12 }} />
            </label>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>Fim</span>
              <input type="date" value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                style={{ width: '100%', fontSize: 12 }} />
            </label>
          </div>
        </div>

        {/* Dias úteis */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SectionLabel>Dias úteis no quarter</SectionLabel>
            <input type="number" min={1} max={90} value={form.workingDays}
              onChange={(e) => setForm((f) => ({ ...f, workingDays: Number(e.target.value) }))}
              style={{ width: 100, fontSize: 12 }} />
          </label>
        </div>

        {/* Integrantes */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Integrantes do time</SectionLabel>
          {members.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '10px 0' }}>
              Nenhum integrante cadastrado. Adicione na aba Configuração.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map((m) => {
                const mAbsences = form.memberAbsences[m.id] || []
                const isExpanded = expandedMember === m.id
                const mForm = newMemberAbsence[m.id] || { startDate: '', endDate: '', reason: '' }

                return (
                  <div key={m.id} style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                  }}>
                    {/* Linha do membro */}
                    <div
                      onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', cursor: 'pointer',
                        background: isExpanded ? 'var(--surface2)' : 'var(--surface)',
                        transition: 'background .1s',
                      }}
                    >
                      <Avatar name={m.name} idx={m.colorIdx} size={26} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.name}</span>
                      {mAbsences.length > 0 && (
                        <Badge bg="var(--amber-bg)" bd="var(--amber-bd)" tx="var(--amber-tx)" style={{ fontSize: 10 }}>
                          {mAbsences.length} ausência{mAbsences.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      <i className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 12, color: 'var(--text3)' }} />
                    </div>

                    {/* Ausências do membro (expandido) */}
                    {isExpanded && (
                      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                        {mAbsences.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                            {mAbsences.map((a) => (
                              <div key={a.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'var(--surface2)', borderRadius: 'var(--radius)',
                                padding: '5px 8px', fontSize: 11,
                              }}>
                                <i className="ti ti-calendar-off" style={{ fontSize: 11, color: 'var(--amber-tx)' }} />
                                <span style={{ flex: 1, color: 'var(--text2)' }}>
                                  {a.startDate}{a.endDate && a.endDate !== a.startDate ? ` → ${a.endDate}` : ''}
                                  {a.reason && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· {a.reason}</span>}
                                </span>
                                <button onClick={() => removeMemberAbsence(m.id, a.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                                  <i className="ti ti-x" style={{ fontSize: 11 }} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontSize: 10, color: 'var(--text3)' }}>De</span>
                            <input type="date" value={mForm.startDate}
                              onChange={(e) => setNewMemberAbsence((p) => ({ ...p, [m.id]: { ...mForm, startDate: e.target.value } }))}
                              style={{ fontSize: 11, padding: '4px 6px' }} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Até</span>
                            <input type="date" value={mForm.endDate}
                              onChange={(e) => setNewMemberAbsence((p) => ({ ...p, [m.id]: { ...mForm, endDate: e.target.value } }))}
                              style={{ fontSize: 11, padding: '4px 6px' }} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 90 }}>
                            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Motivo</span>
                            <input type="text" placeholder="ex: Férias"
                              value={mForm.reason}
                              onChange={(e) => setNewMemberAbsence((p) => ({ ...p, [m.id]: { ...mForm, reason: e.target.value } }))}
                              style={{ fontSize: 11, padding: '4px 6px' }} />
                          </label>
                          <button onClick={() => addMemberAbsence(m.id)} style={{ fontSize: 11, padding: '5px 10px' }}>
                            <i className="ti ti-plus" style={{ fontSize: 12 }} /> Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Ausências gerais */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Ausências / Feriados do quarter</SectionLabel>
          {form.generalAbsences.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {form.generalAbsences.map((a) => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--surface2)', borderRadius: 'var(--radius)',
                  padding: '6px 10px', fontSize: 12,
                }}>
                  <i className="ti ti-calendar-off" style={{ fontSize: 12, color: 'var(--text3)' }} />
                  <span style={{ flex: 1, color: 'var(--text2)' }}>
                    {a.startDate}{a.endDate && a.endDate !== a.startDate ? ` → ${a.endDate}` : ''}
                    {a.reason ? <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· {a.reason}</span> : null}
                  </span>
                  <button onClick={() => removeAbsence(a.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                    <i className="ti ti-x" style={{ fontSize: 11 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>De</span>
              <input type="date" value={newAbsence.startDate}
                onChange={(e) => setNewAbsence((a) => ({ ...a, startDate: e.target.value }))}
                style={{ fontSize: 11, padding: '4px 6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>Até</span>
              <input type="date" value={newAbsence.endDate}
                onChange={(e) => setNewAbsence((a) => ({ ...a, endDate: e.target.value }))}
                style={{ fontSize: 11, padding: '4px 6px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 100 }}>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>Motivo (opcional)</span>
              <input type="text" placeholder="ex: Feriado" value={newAbsence.reason}
                onChange={(e) => setNewAbsence((a) => ({ ...a, reason: e.target.value }))}
                style={{ fontSize: 11, padding: '4px 6px' }} />
            </label>
            <button onClick={addAbsence} style={{ fontSize: 11, padding: '5px 10px' }}>
              <i className="ti ti-plus" style={{ fontSize: 12 }} /> Adicionar
            </button>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ fontSize: 12 }}>Cancelar</button>
          <button className="primary" onClick={save} style={{ fontSize: 12 }}>
            <i className="ti ti-check" style={{ fontSize: 13 }} /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function calcCapacity(members, workingDays) {
  if (!members || members.length === 0 || !workingDays) return 0
  return members.reduce((s, m) => s + (m.hoursPerDay || 6), 0) * workingDays
}

function QuarterCard({ stat, selected, onClick, quarterCfg, members }) {
  const qc = QUARTER_COLORS[stat.quarter]
  const pct = stat.total > 0 ? Math.round(stat.done / stat.total * 100) : 0
  const [showConfig, setShowConfig] = useState(false)

  const label = stat.total === 0
    ? 'Vazio'
    : stat.done === stat.total
      ? 'Concluído'
      : stat.doing > 0
        ? 'Em andamento'
        : stat.late > 0
          ? 'Atrasado'
          : 'Não inic.'

  const cfg = quarterCfg || {}
  const hasConfig = cfg.startDate || cfg.endDate
  const capacityHrs = calcCapacity(members, cfg.workingDays)

  return (
    <>
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
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <Badge bg={qc.bg} bd={qc.bd} tx={qc.tx} style={{ fontWeight: 700, fontSize: 12 }}>
            {stat.quarter}
          </Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {stat.initiativeCount} iniciativa{stat.initiativeCount !== 1 ? 's' : ''}
            </span>
            {/* Botão três pontinhos */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowConfig(true) }}
              title="Configurar quarter"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text3)',
                padding: '2px 4px',
                borderRadius: 4,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <i className="ti ti-dots-vertical" style={{ fontSize: 14 }} />
            </button>
          </div>
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

        {/* Datas configuradas */}
        {hasConfig && (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="ti ti-calendar" style={{ fontSize: 10 }} />
            {cfg.startDate && <span>{cfg.startDate}</span>}
            {cfg.startDate && cfg.endDate && <span>→</span>}
            {cfg.endDate && <span>{cfg.endDate}</span>}
            {cfg.workingDays && <span style={{ marginLeft: 4 }}>· {cfg.workingDays}d úteis</span>}
          </div>
        )}

        {/* Barra de progresso */}
        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', width: pct + '%', background: qc.tx, borderRadius: 2, transition: 'width .4s' }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{stat.done}/{stat.total} concluídas</div>

        {/* Capacity */}
        {capacityHrs > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '4px 8px', background: qc.bg, borderRadius: 'var(--radius)', border: '1px solid ' + qc.bd }}>
            <i className="ti ti-bolt" style={{ fontSize: 11, color: qc.tx }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: qc.tx }}>{capacityHrs}h</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>capacity · {members.length} dev{members.length !== 1 ? 's' : ''} × {cfg.workingDays}d</span>
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
          clique para filtrar
        </div>
      </div>

      {showConfig && (
        <QuarterConfigModal
          quarter={stat.quarter}
          qc={qc}
          onClose={() => setShowConfig(false)}
        />
      )}
    </>
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
  const store = useBoardStore()
  const quarterConfigs = store.activePetSlot?.pet?.quarterConfigs || {}
  const members = store.board.members || []

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
            quarterCfg={quarterConfigs[stat.quarter]}
            members={members}
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
