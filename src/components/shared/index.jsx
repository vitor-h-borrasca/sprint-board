import { useState, useRef, useEffect } from 'react'
import { STATUSES, TYPE_LABELS, DEFAULT_SIZE_HRS, PRIORITIES, AVATAR_PAL } from '@/domain/constants'
import { taskHrs } from '@/domain/capacity'
import { fmtHrs, genId } from '@/domain/utils'
const fmt = fmtHrs

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ bg, bd, tx, children, style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: bg, color: tx,
      border: '1px solid ' + bd,
      borderRadius: 6, padding: '2px 8px',
      fontSize: 11, fontWeight: 500,
      whiteSpace: 'nowrap', ...style,
    }}>
      {children}
    </span>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const s = STATUSES[status] || STATUSES.backlog
  return <Badge bg={s.bg} bd={s.bd} tx={s.tx}>{s.label}</Badge>
}

// ── TypeBadge ─────────────────────────────────────────────────────────────────
export function TypeBadge({ type }) {
  const map = {
    feature:  { bg: 'var(--blue-bg)',   bd: 'var(--blue-bd)',   tx: 'var(--blue-tx)' },
    pbi:      { bg: 'var(--purple-bg)', bd: 'var(--purple-bd)', tx: 'var(--purple-tx)' },
    tecnica:  { bg: 'var(--teal-bg)',   bd: 'var(--teal-bd)',   tx: 'var(--teal-tx)' },
    bughom:   { bg: 'var(--amber-bg)',  bd: 'var(--amber-bd)',  tx: 'var(--amber-tx)' },
  }
  const s = map[type] || map.tecnica
  return <Badge bg={s.bg} bd={s.bd} tx={s.tx}>{TYPE_LABELS[type]}</Badge>
}

// ── SizeBadge ─────────────────────────────────────────────────────────────────
export function SizeBadge({ size, shr, task }) {
  const hrs = task ? taskHrs(task, shr) : (shr ? (shr[size] || DEFAULT_SIZE_HRS[size]) : DEFAULT_SIZE_HRS[size])
  const hasBreakdown = task && task.devHrs != null && task.devHrs > 0
  const isCustom = task && !hasBreakdown && task.customHrs != null && task.customHrs > 0
    && task.customHrs !== (shr ? shr[size] : DEFAULT_SIZE_HRS[size])

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
      <Badge
        bg={isCustom ? 'var(--amber-bg)' : hasBreakdown ? 'var(--blue-bg)' : 'var(--gray-bg)'}
        bd={isCustom ? 'var(--amber-bd)' : hasBreakdown ? 'var(--blue-bd)' : 'var(--gray-bd)'}
        tx={isCustom ? 'var(--amber-tx)' : hasBreakdown ? 'var(--blue-tx)' : 'var(--gray-tx)'}
      >
        {size} · {fmt(hrs)}{isCustom && ' ✎'}
      </Badge>
      {hasBreakdown && (
        <span style={{ fontSize: 9, color: 'var(--text3)', paddingLeft: 2, whiteSpace: 'nowrap' }}>
          Dev {fmt(task.devHrs)}{task.qaHrs > 0 ? ` · QA ${fmt(task.qaHrs)}` : ''}
        </span>
      )}
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({ name, idx, size = 28 }) {
  const [bg, fg] = AVATAR_PAL[(idx || 0) % AVATAR_PAL.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, flexShrink: 0,
    }}>
      {(name || '?').slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1rem 1.25rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── SectionTitle ──────────────────────────────────────────────────────────────
export function SectionTitle({ icon, label, count, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <i className={'ti ' + icon} style={{ fontSize: 16, color: 'var(--text3)' }} />
      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{label}</span>
      {count != null && (
        <span style={{ background: 'var(--surface2)', color: 'var(--text3)', borderRadius: 20, padding: '1px 9px', fontSize: 12 }}>
          {count}
        </span>
      )}
      {children && <div style={{ marginLeft: 'auto' }}>{children}</div>}
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────────────────────
export function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: 'var(--text3)', textTransform: 'uppercase',
        letterSpacing: '.05em', marginBottom: 5,
      }}>
        {label}
        {hint && <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 4, letterSpacing: 0, color: 'var(--text3)' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

// ── TabBtn ────────────────────────────────────────────────────────────────────
export function TabBtn({ active, onClick, icon, label, accent }) {
  return (
    <button onClick={onClick} style={{
      borderRadius: 0, border: 'none',
      borderBottom: '2px solid ' + (active ? (accent || 'var(--orange)') : 'transparent'),
      background: 'none',
      color: active ? 'var(--navy)' : 'var(--text3)',
      fontWeight: active ? 600 : 400,
      fontSize: 13, padding: '10px 18px', gap: 6,
    }}>
      <i className={'ti ' + icon} style={{ fontSize: 15 }} />{label}
    </button>
  )
}

// ── CapacityBar ───────────────────────────────────────────────────────────────
export function CapacityBar({ used, total }) {
  const pct = total > 0 ? Math.min(100, Math.round(used / total * 100)) : 0
  const over = used > total
  const barC = over ? 'var(--red)' : pct > 85 ? 'var(--amber)' : 'var(--blue)'
  const lblC = over ? 'var(--red-tx)' : pct > 85 ? 'var(--amber-tx)' : 'var(--blue-tx)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Utilização da capacity</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: lblC }}>
          {pct}% {over ? '⚠ acima' : pct > 85 ? '⚡ atenção' : '✓ ok'}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ height: '100%', width: pct + '%', background: barC, borderRadius: 4, transition: 'width .4s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text3)' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f}>{fmt(Math.round(total * f))}</span>)}
      </div>
    </div>
  )
}

// ── SyncBadge ─────────────────────────────────────────────────────────────────
export function SyncBadge({ status, onRetry }) {
  const cfgs = {
    idle:    { label: 'Somente local',  icon: 'ti-device-floppy', col: 'var(--text3)',    bg: 'var(--gray-bg)' },
    loading: { label: 'Carregando...',  icon: 'ti-loader',        col: 'var(--blue-tx)',  bg: 'var(--blue-bg)', spin: true },
    saving:  { label: 'Salvando...',    icon: 'ti-loader',        col: 'var(--amber-tx)', bg: 'var(--amber-bg)', spin: true },
    saved:   { label: 'Drive ✓',        icon: 'ti-cloud-check',   col: 'var(--teal-tx)',  bg: 'var(--teal-bg)' },
    nofile:  { label: 'Novo no Drive',  icon: 'ti-cloud-upload',  col: 'var(--purple-tx)',bg: 'var(--purple-bg)' },
    error:   { label: 'Erro — retry',   icon: 'ti-cloud-off',     col: 'var(--red-tx)',   bg: 'var(--red-bg)' },
  }
  const c = cfgs[status] || cfgs.idle
  return (
    <span
      onClick={status === 'error' ? onRetry : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 600,
        padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap',
        background: c.bg, color: c.col, border: '1px solid ' + c.col + '55',
        cursor: status === 'error' ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      <i className={'ti ' + c.icon + (c.spin ? ' spin' : '')} style={{ fontSize: 13 }} />
      {c.label}
    </span>
  )
}

// ── SprintSelector ────────────────────────────────────────────────────────────
export function SprintSelector({ sprints, activeId, onSwitch, onCreate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = sprints.find((s) => s.id === activeId) || sprints[0]

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none',
          border: '1.5px solid var(--orange)',
          borderRadius: 8,
          color: '#fff',
          fontWeight: 600,
          fontSize: 13,
          padding: '5px 12px',
          gap: 8,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <i className="ti ti-calendar-event" style={{ fontSize: 14, color: 'var(--orange)' }} />
        {active?.sprint?.name || 'Sprint'}
        <i className={'ti ' + (open ? 'ti-chevron-up' : 'ti-chevron-down')} style={{ fontSize: 12, opacity: 0.7 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          background: 'var(--navy)', border: '1px solid #2e3a55',
          borderRadius: 10, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          overflow: 'hidden',
        }}>
          {sprints.map((s) => (
            <div
              key={s.id}
              onClick={() => { onSwitch(s.id); setOpen(false) }}
              style={{
                padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                color: s.id === activeId ? 'var(--orange)' : '#c8cfdf',
                fontWeight: s.id === activeId ? 600 : 400,
                background: s.id === activeId ? 'rgba(255,110,54,.08)' : 'none',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={(e) => { if (s.id !== activeId) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
              onMouseLeave={(e) => { if (s.id !== activeId) e.currentTarget.style.background = 'none' }}
            >
              <i className={'ti ' + (s.id === activeId ? 'ti-check' : 'ti-calendar')} style={{ fontSize: 13 }} />
              {s.sprint.name}
            </div>
          ))}
          <div style={{ borderTop: '1px solid #2e3a55' }}>
            <div
              onClick={() => { onCreate(); setOpen(false) }}
              style={{
                padding: '8px 14px', fontSize: 12, cursor: 'pointer',
                color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Nova sprint
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AbsenceBlock ──────────────────────────────────────────────────────────────
export function AbsenceBlock({ absences, onChange, compact }) {
  const list = absences || []

  function add() { onChange([...list, { id: genId(), startDate: '', endDate: '', label: '' }]) }
  function remove(id) { onChange(list.filter((a) => a.id !== id)) }
  function upd(id, field, val) { onChange(list.map((a) => a.id === id ? { ...a, [field]: val } : a)) }

  return (
    <div style={{ marginTop: compact ? 6 : 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red-tx)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="ti ti-calendar-off" style={{ fontSize: 12 }} />Ausências {list.length > 0 && '(' + list.length + ')'}
        </span>
        <button onClick={add} style={{ padding: '2px 8px', fontSize: 10, borderColor: 'var(--red-bd)', color: 'var(--red-tx)', background: 'var(--red-bg)' }}>+ Ausência</button>
      </div>
      {list.map((a) => (
        <div key={a.id} style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr auto' : '1fr 1fr 1fr auto', gap: 6, marginBottom: 5, alignItems: 'center' }}>
          {!compact && <input value={a.label} onChange={(e) => upd(a.id, 'label', e.target.value)} placeholder="Motivo" style={{ fontSize: 11, padding: '4px 8px' }} />}
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.05em' }}>Início</div>
            <input type="date" value={a.startDate} onChange={(e) => upd(a.id, 'startDate', e.target.value)} style={{ fontSize: 11, padding: '4px 6px', width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.05em' }}>Fim</div>
            <input type="date" value={a.endDate} onChange={(e) => upd(a.id, 'endDate', e.target.value)} style={{ fontSize: 11, padding: '4px 6px', width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div style={{ paddingTop: 16 }}>
            <button className="ghost" style={{ padding: '3px 6px', color: 'var(--red-tx)' }} onClick={() => remove(a.id)}>
              <i className="ti ti-x" style={{ fontSize: 12 }} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
