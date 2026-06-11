import { useState, useEffect } from 'react'
import useBoardStore from '@/store/useBoardStore'
import { SIZES, AVATAR_PAL } from '@/domain/constants'
import { calcWorkingDays, fmtHrs } from '@/domain/utils'
import { memberEffDays, totalCapacity } from '@/domain/capacity'
import { Card, SectionTitle, Field, Avatar, AbsenceBlock } from '@/components/shared'
import { fetchTeams } from '@/domain/auth'

export default function SetupTab() {
  const board = useBoardStore((s) => s.board)
  const store = useBoardStore()

  const activeSlot = board.sprints.find((s) => s.id === board.activeSprintId) || board.sprints[0]
  const sprint     = activeSlot?.sprint || {}
  const members    = board.members || []

  const [cfg, setCfg] = useState(sprint)
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'dev', hoursPerDay: 6, team: '' })
  const [teams, setTeams] = useState([])

  useEffect(() => { setCfg(sprint) }, [board.activeSprintId, JSON.stringify(sprint)])
  useEffect(() => {
    fetchTeams().then(setTeams).catch(() => {})
  }, [])

  function handleSprintField(field, value) {
    const updated = { ...cfg, [field]: value }
    if (field === 'startDate' || field === 'endDate')
      updated.workingDays = calcWorkingDays(updated.startDate, updated.endDate)
    setCfg(updated)
    store.updateSprintCfg(updated)
  }

  function handleSizeHr(size, val) {
    const updated = { ...cfg, sizeHrs: { ...cfg.sizeHrs, [size]: Number(val) } }
    setCfg(updated)
    store.updateSprintCfg(updated)
  }

  function handleAbsences(list) {
    const updated = { ...cfg, generalAbsences: list }
    setCfg(updated)
    store.updateSprintCfg(updated)
  }

  function addMember() {
    if (!newMember.name.trim()) return
    store.addMember({ ...newMember, hoursPerDay: Number(newMember.hoursPerDay) || 6 })
    setNewMember({ name: '', email: '', role: 'dev', hoursPerDay: 6, team: '' })
  }

  return (
    <div className="grid-2">

      {/* ── Coluna esquerda: config da sprint ── */}
      <Card>
        {/* Header com seletor de sprint */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <SectionTitle icon="ti-run" label="Configuração da Sprint" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={board.activeSprintId}
              onChange={(e) => store.switchSprint(e.target.value)}
              style={{ fontSize: 12 }}
            >
              {board.sprints.map((s) => (
                <option key={s.id} value={s.id}>{s.sprint.name}</option>
              ))}
            </select>
            <button className="ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={store.createSprint}>
              <i className="ti ti-plus" /> Nova
            </button>
          </div>
        </div>

        <Field label="Nome da Sprint">
          <input value={cfg.name || ''} onChange={(e) => handleSprintField('name', e.target.value)} />
        </Field>

        <Field label="Time">
          <select
            value={cfg.team || ''}
            onChange={(e) => handleSprintField('team', e.target.value)}
            style={{ fontSize: 12 }}
          >
            <option value="">— Selecione um time —</option>
            {teams.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Início">
            <input type="date" value={cfg.startDate || ''} onChange={(e) => handleSprintField('startDate', e.target.value)} />
          </Field>
          <Field label="Fim">
            <input type="date" value={cfg.endDate || ''} onChange={(e) => handleSprintField('endDate', e.target.value)} />
          </Field>
          <Field label="Dias úteis">
            <input type="number" min={1} value={cfg.workingDays || 10} onChange={(e) => handleSprintField('workingDays', Number(e.target.value))} />
          </Field>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <SectionTitle icon="ti-clock" label="Horas por tamanho" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {SIZES.map((sz) => (
            <div key={sz}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 4, textAlign: 'center' }}>{sz}</div>
              <input
                type="number" min={1}
                value={(cfg.sizeHrs || {})[sz] || ''}
                onChange={(e) => handleSizeHr(sz, e.target.value)}
                style={{ fontSize: 12, textAlign: 'center', padding: '6px 4px' }}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <AbsenceBlock absences={cfg.generalAbsences || []} onChange={handleAbsences} />
        </div>

        {members.length > 0 && (
          <CapacityPreview members={members} cfg={cfg} />
        )}

        <button className="primary" style={{ marginTop: 16 }} onClick={() => store.updateSprintCfg(cfg)}>
          <i className="ti ti-device-floppy" /> Salvar sprint
        </button>
      </Card>

      {/* ── Coluna direita: membros ── */}
      <Card>
        <SectionTitle icon="ti-users" label="Membros" count={members.length} />

        {/* Formulário novo membro */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto auto', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
          <Field label="Nome">
            <input
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addMember()}
              placeholder="João Silva"
            />
          </Field>
          <Field label="E-mail">
            <input
              value={newMember.email || ''}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addMember()}
              placeholder="joao@empresa.com"
              style={{ fontSize: 12 }}
            />
          </Field>
          <Field label="Time">
            <select value={newMember.team || ''} onChange={(e) => setNewMember({ ...newMember, team: e.target.value })} style={{ fontSize: 12 }}>
              <option value="">— Time —</option>
              {teams.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })} style={{ fontSize: 12 }}>
              <option value="dev">Dev</option>
              <option value="qa">QA</option>
              <option value="fullstack">Full Stack</option>
              <option value="design">Design</option>
              <option value="po">PO</option>
            </select>
          </Field>
          <Field label="h/dia">
            <input type="number" min={1} max={12} value={newMember.hoursPerDay}
              onChange={(e) => setNewMember({ ...newMember, hoursPerDay: e.target.value })}
              style={{ width: 60, fontSize: 12 }} />
          </Field>
          <button className="primary" style={{ marginBottom: 12 }} onClick={addMember}>
            <i className="ti ti-user-plus" /> Add
          </button>
        </div>

        {/* Lista de membros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 12 }}>
              <i className="ti ti-users" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.3 }} />
              Nenhum membro cadastrado.
            </div>
          )}
          {members.map((m) => (
            <MemberRow key={m.id} member={m} sprint={cfg} teams={teams}
              onUpdate={(patch) => store.updateMember(m.id, patch)}
              onRemove={() => store.removeMember(m.id)} />
          ))}
        </div>
      </Card>

    </div>
  )
}

function CapacityPreview({ members, cfg }) {
  const total = totalCapacity(members, cfg)
  const ROLE_LABEL = { dev: 'DEV', qa: 'QA', fullstack: 'Full', design: 'Design', po: 'PO' }

  return (
    <div style={{
      marginTop: 16, borderRadius: 8,
      background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)',
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue-tx)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
        Preview de capacity
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {members.map((m) => {
          const effDays = memberEffDays(m, cfg)
          const hrs = (m.hoursPerDay || 6) * effDays
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text2)' }}>
                {m.name}
                <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>
                  ({ROLE_LABEL[m.role] || m.role})
                </span>
              </span>
              <span style={{ color: 'var(--blue-tx)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {m.hoursPerDay || 6}h × {effDays}d = {fmtHrs(hrs)}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ borderTop: '1px solid var(--blue-bd)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
        <span style={{ color: 'var(--text2)' }}>Total</span>
        <span style={{ color: 'var(--blue-tx)' }}>{fmtHrs(total)}</span>
      </div>
    </div>
  )
}

function MemberRow({ member, sprint, teams = [], onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <Avatar name={member.name} idx={member.colorIdx} size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{member.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            {member.team && <span style={{ marginRight: 4 }}>{member.team} ·</span>}
            {member.role} · {member.hoursPerDay || 6}h/dia
            {member.email && <span style={{ marginLeft: 4 }}>· {member.email}</span>}
          </div>
        </div>
        <i className={'ti ' + (expanded ? 'ti-chevron-up' : 'ti-chevron-down')} style={{ fontSize: 13, color: 'var(--text3)' }} />
        <button className="ghost" style={{ color: 'var(--red-tx)', padding: '2px 6px' }}
          onClick={(e) => { e.stopPropagation(); onRemove() }}>
          <i className="ti ti-trash" style={{ fontSize: 13 }} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 8, marginBottom: 8 }}>
            <Field label="Nome">
              <input value={member.name} onChange={(e) => onUpdate({ name: e.target.value })} style={{ fontSize: 12 }} />
            </Field>
            <Field label="E-mail">
              <input value={member.email || ''} onChange={(e) => onUpdate({ email: e.target.value })} placeholder="joao@empresa.com" style={{ fontSize: 12 }} />
            </Field>
            <Field label="Time">
              <select value={member.team || ''} onChange={(e) => onUpdate({ team: e.target.value })} style={{ fontSize: 12 }}>
                <option value="">— Time —</option>
                {teams.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Role">
              <select value={member.role} onChange={(e) => onUpdate({ role: e.target.value })} style={{ fontSize: 12 }}>
                <option value="dev">Dev</option>
                <option value="qa">QA</option>
                <option value="fullstack">Full Stack</option>
                <option value="design">Design</option>
                <option value="po">PO</option>
              </select>
            </Field>
            <Field label="h/dia">
              <input type="number" min={1} max={12} value={member.hoursPerDay || 6}
                onChange={(e) => onUpdate({ hoursPerDay: Number(e.target.value) })}
                style={{ width: 56, fontSize: 12 }} />
            </Field>
          </div>
          <AbsenceBlock
            absences={member.absences || []}
            onChange={(list) => onUpdate({ absences: list })}
            compact
          />
        </div>
      )}
    </div>
  )
}
