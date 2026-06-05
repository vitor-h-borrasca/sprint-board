import { useState } from 'react'
import { usePET } from '@/hooks/usePET'
import useBoardStore from '@/store/useBoardStore'
import { QUARTERS, QUARTER_COLORS } from '@/domain/constants'
import { Badge } from '@/components/shared'
import { InitiativeForm } from './InitiativeForm'
import { InitiativeCard } from './InitiativeCard'
import { PETOverview } from './PETOverview'
import { fmtHrs } from '@/domain/utils'

export function PETTab() {
  const store = useBoardStore()
  const allSprints = store.board.sprints || []

  const {
    pet, initiatives, members, shr, stats,
    form, setForm, editId, showForm,
    openNew, openEdit, closeForm, submit,
    deleteInitiative, setStatus, togglePrioritized,
  } = usePET()

  const [view, setView] = useState('lista')
  const [filterQ, setFilterQ]         = useState('all')
  const [filterTag, setFilterTag]     = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType]   = useState('all')

  const shown = initiatives.filter((i) => {
    if (filterQ !== 'all' && i.quarter !== filterQ) return false
    if (filterTag !== 'all' && i.tag !== filterTag) return false
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterType === 'initiative' && i.isInitiative === false) return false
    if (filterType === 'demand'     && i.isInitiative !== false) return false
    if (filterType === 'depriorized' && i.prioritized !== false) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Switcher Lista / Overview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {[
          { v: 'lista',    icon: 'ti-list',          label: 'Lista'    },
          { v: 'overview', icon: 'ti-layout-columns', label: 'Overview' },
        ].map(({ v, icon, label }) => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? 'var(--navy)' : 'var(--surface)',
            color: view === v ? '#fff' : 'var(--text2)',
            borderColor: view === v ? 'var(--navy)' : 'var(--border2)',
          }}>
            <i className={'ti ' + icon} style={{ fontSize: 14 }} />{label}
          </button>
        ))}
      </div>

      {/* PET Overview */}
      {view === 'overview' && (
        <PETOverview initiatives={initiatives} shr={shr} />
      )}

      {/* Vista Lista */}
      {view === 'lista' && <>

      {/* Resumo por quarter */}
      <div className="grid-4">
        {stats.map(({ quarter: q, total, done, late, totalHrs, initiativeCount, depriorizedCount }) => {
          const qc = QUARTER_COLORS[q]
          const pct = total > 0 ? Math.round(done / total * 100) : 0
          return (
            <div key={q} onClick={() => setFilterQ(filterQ === q ? 'all' : q)}
              style={{ background: filterQ === q ? qc.bg : 'var(--surface)', border: '1px solid ' + (filterQ === q ? qc.bd : 'var(--border)'), borderRadius: 'var(--radius-lg)', padding: '14px 16px', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Badge bg={qc.bg} bd={qc.bd} tx={qc.tx} style={{ fontWeight: 700, fontSize: 12 }}>{q}</Badge>
                {late > 0 && <Badge bg="var(--red-bg)" bd="var(--red-bd)" tx="var(--red-tx)" style={{ fontSize: 10 }}>{late} atrasada{late > 1 ? 's' : ''}</Badge>}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: qc.tx }}>{total}</div>
                {initiativeCount > 0 && <Badge bg="var(--purple-bg)" bd="var(--purple-bd)" tx="var(--purple-tx)" style={{ fontSize: 10, padding: '1px 6px' }}>🎯 {initiativeCount}/2</Badge>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                {fmtHrs(totalHrs)}
                {depriorizedCount > 0 && <span style={{ color: 'var(--text3)', fontSize: 10 }}>· ✕ {depriorizedCount} despriorizad{depriorizedCount > 1 ? 'as' : 'a'}</span>}
              </div>
              <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: qc.tx, borderRadius: 2, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{done}/{total} concluídas ({pct}%)</div>
            </div>
          )
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Fbtn active={filterQ === 'all'} onClick={() => setFilterQ('all')}>Todos</Fbtn>
          {QUARTERS.map((q) => {
            const qc = QUARTER_COLORS[q]
            return <Fbtn key={q} active={filterQ === q} onClick={() => setFilterQ(filterQ === q ? 'all' : q)} bg={qc.bg} bdC={qc.bd} tx={qc.tx}>{q}</Fbtn>
          })}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', 'Todos'], ['tec', 'Tec'], ['prod', 'Prod']].map(([v, l]) => (
            <Fbtn key={v} active={filterTag === v} onClick={() => setFilterTag(v)}>{l}</Fbtn>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            ['all', 'Todos tipos'],
            ['initiative', '🎯 Iniciativas', 'var(--purple-bg)', 'var(--purple-bd)', 'var(--purple-tx)'],
            ['demand', '📌 Demandas'],
            ['depriorized', '✕ Despriorizadas', 'var(--red-bg)', 'var(--red-bd)', 'var(--red-tx)'],
          ].map(([v, l, bg, bd, tx]) => (
            <Fbtn key={v} active={filterType === v} onClick={() => setFilterType(v)} bg={bg} bdC={bd} tx={tx}>{l}</Fbtn>
          ))}
        </div>
        <button className="primary" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={showForm ? closeForm : openNew}>
          <i className={'ti ' + (showForm ? 'ti-x' : 'ti-plus')} style={{ fontSize: 13 }} />
          {showForm ? 'Cancelar' : 'Novo item'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <InitiativeForm
          form={form} setForm={setForm}
          onSubmit={submit} onCancel={closeForm}
          editId={editId} initiatives={initiatives}
          shr={shr} allSprints={allSprints}
        />
      )}

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 13 }}>
            <i className="ti ti-chart-bar" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: 0.3 }} />
            {initiatives.length === 0 ? 'Nenhum item cadastrado.' : 'Nenhum item com os filtros selecionados.'}
          </div>
        )}
        {shown.map((init) => {
          const linkedSprints = allSprints.filter((s) => (init.linkedSprintIds || []).includes(s.id))
          return (
            <InitiativeCard
              key={init.id}
              initiative={init}
              shr={shr}
              linkedSprints={linkedSprints}
              onEdit={openEdit}
              onDelete={deleteInitiative}
              onTogglePrioritized={togglePrioritized}
              onSetStatus={setStatus}
            />
          )
        })}
      </div>

      </>}
    </div>
  )
}

// Botão de filtro inline pequeno
function Fbtn({ active, onClick, children, bg, bdC, tx }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: '4px 10px',
      background: active ? (bg || 'var(--navy)') : 'var(--surface)',
      color: active ? (tx || '#fff') : 'var(--text2)',
      borderColor: active ? (bdC || 'var(--navy)') : 'var(--border2)',
    }}>
      {children}
    </button>
  )
}
