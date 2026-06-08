import { useState, useEffect } from 'react'
import { getSession, clearSession, getSessionTeam, getSessionTeamAreaPath, saveSessionTeam } from '@/domain/auth'
import LoginScreen from '@/components/auth/LoginScreen'
import TeamSelectScreen from '@/components/auth/TeamSelectScreen'
import useBoardStore from '@/store/useBoardStore'
import { getScriptUrl } from '@/domain/board'
import { cloudLoad } from '@/domain/sync'
import { saveBoardData } from '@/domain/board'
import { totalCapacity, taskHrs } from '@/domain/capacity'
import { fmtHrs } from '@/domain/utils'
import { SyncBadge, TabBtn, CapacityBar, SprintSelector } from '@/components/shared'
import { PETTab } from '@/components/pet/PETTab'
import { DocsTab } from '@/components/docs/DocsTab'

// Lazy imports das abas que ainda não foram migradas
// (durante a migração, mantemos compatibilidade)
import ConfigTab   from '@/components/setup/ConfigTab'
import FeaturesTab from '@/components/features/FeaturesTab'
import BacklogTab  from '@/components/sprint/BacklogTab'
import SprintTab   from '@/components/sprint/SprintTab'
import BoardTab    from '@/components/board/BoardTab'

export default function App() {
  const [session, setSession]         = useState(() => getSession())
  const [team, setTeam]               = useState(() => getSessionTeam())
  const [teamAreaPath, setTeamAreaPath] = useState(() => getSessionTeamAreaPath())

  if (!session) {
    return <LoginScreen onLogin={() => setSession(getSession())} />
  }

  if (!team) {
    return (
      <TeamSelectScreen onSelect={(teamName, areaPath) => {
        saveSessionTeam(teamName, areaPath)
        setTeam(teamName)
        setTeamAreaPath(areaPath)
      }} />
    )
  }

  return (
    <AppContent
      team={team}
      teamAreaPath={teamAreaPath}
      onLogout={() => { clearSession(); setSession(null); setTeam(null); setTeamAreaPath(null) }}
      onSwitchTeam={() => { saveSessionTeam('', ''); setTeam(null); setTeamAreaPath(null) }}
    />
  )
}

function AppContent({ team, teamAreaPath, onLogout, onSwitchTeam }) {
  const store      = useBoardStore()
  const board      = useBoardStore((s) => s.board)

  // Garante que o store carregue os dados do time correto ao montar
  useEffect(() => {
    store.initTeam(team, teamAreaPath)
  }, [team])
  const syncStatus = useBoardStore((s) => s.syncStatus)
  const lastCloud  = useBoardStore((s) => s.lastCloud)
  const { retrySync, loadFromCloud } = store
  const pendingSprintCreate = useBoardStore((s) => s.pendingSprintCreate)
  const [tab, setTab] = useState('board')

  const activeSlot    = board.sprints.find((s) => s.id === board.activeSprintId) || board.sprints[0]
  const shr           = { ...activeSlot?.sprint?.sizeHrs }
  const sprintTasks   = activeSlot?.tasks || []
  const members       = board.members || []
  const activePetSlot = board.pets?.find((s) => s.id === board.activePetId) || board.pets?.[0]

  // Cloud load desabilitado no auto-mount: o Drive armazena dados sem isolamento por time.
  // Use o botão "Carregar do Drive" na aba Integrações para sincronizar manualmente.

  // Métricas header sprint
  const usedHrs = sprintTasks.reduce((s, t) => s + taskHrs(t, shr), 0)
  const capTotal = totalCapacity(members, activeSlot?.sprint || {})
  const donePct  = sprintTasks.length > 0
    ? Math.round(sprintTasks.filter((t) => t.status === 'done').length / sprintTasks.length * 100)
    : 0

  // Métricas header PET
  const petInits = activePetSlot?.initiatives || []
  const petLate  = petInits.filter((i) => i.status === 'late').length

  const isSprintTab = ['setup', 'backlog', 'sprint', 'board', 'config'].includes(tab)
  const isDocsTab = tab === 'docs'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <h1 className="sr-only">Sprint Planning Board</h1>

      {/* Header */}
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--orange)', fontWeight: 700, fontSize: 17, letterSpacing: '.08em' }}>ANYMARKET</span>
          <span style={{ color: '#3A4460', fontSize: 14 }}>|</span>
          <span style={{ color: '#8892AA', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>Sprint Planning</span>
        </div>

        {isSprintTab && (
          <>
            <SprintSelector
              sprints={board.sprints}
              activeId={board.activeSprintId}
              onSwitch={store.switchSprint}
              onCreate={store.createSprint}
            />
            <div style={{ flex: 1, maxWidth: 320 }}>
              <CapacityBar used={usedHrs} total={capTotal} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { l: 'Dias úteis', v: (activeSlot?.sprint?.workingDays || 0) + 'd' },
                { l: 'Capacity',   v: fmtHrs(capTotal) },
                { l: 'Alocado',    v: fmtHrs(usedHrs) },
                { l: 'Tarefas',    v: sprintTasks.length },
                { l: 'Concluído',  v: donePct + '%' },
              ].map((k) => (
                <div key={k.l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EBF3' }}>{k.v}</div>
                  <div style={{ fontSize: 10, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.l}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'pet' && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { l: 'Itens',       v: petInits.length },
              { l: 'Iniciativas', v: petInits.filter((i) => i.isInitiative !== false).length },
              { l: 'Concluídas',  v: petInits.filter((i) => i.status === 'done').length },
              { l: 'Atrasadas',   v: petLate },
            ].map((k) => (
              <div key={k.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: k.l === 'Atrasadas' && petLate > 0 ? '#FCA5A5' : '#E8EBF3' }}>{k.v}</div>
                <div style={{ fontSize: 10, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.l}</div>
              </div>
            ))}
          </div>
        )}

        <SyncBadge status={syncStatus} onRetry={retrySync} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="ti ti-users" />
            {team}
          </span>
          <button
            onClick={onSwitchTeam}
            title="Trocar time"
            style={{ padding: '5px 8px', fontSize: 11, color: 'var(--text3)' }}
          >
            <i className="ti ti-switch-horizontal" />
          </button>
          <button
            onClick={onLogout}
            title="Sair"
            style={{ padding: '5px 8px', fontSize: 11, color: 'var(--text3)' }}
          >
            <i className="ti ti-logout" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-bar">
        <TabBtn active={tab === 'board'}   onClick={() => setTab('board')}   icon="ti-layout-columns" label="Board" />
        <TabBtn active={tab === 'pet'}     onClick={() => setTab('pet')}     icon="ti-chart-bar"      label="PET"   accent="var(--purple)" />
        <TabBtn active={tab === 'backlog'} onClick={() => setTab('backlog')} icon="ti-stack"          label="Backlog" />
        <TabBtn active={tab === 'sprint'}  onClick={() => setTab('sprint')}  icon="ti-run"            label="Sprint" />
        <TabBtn active={tab === 'config'}  onClick={() => setTab('config')}  icon="ti-settings"       label="Configuração" />
        <TabBtn active={tab === 'docs'}    onClick={() => setTab('docs')}    icon="ti-book-2"         label="Docs"         accent="var(--teal)" />
      </div>

      {/* Modal — limite de sprints */}
      {pendingSprintCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 28, maxWidth: 420, width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 22, color: 'var(--amber)' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Limite de sprints atingido</span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.6 }}>
              O board já possui <strong>4 sprints</strong>. Para criar uma nova, a sprint mais antiga será removida:
            </p>

            <div style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>
                <i className="ti ti-run" style={{ marginRight: 6, color: 'var(--orange)' }} />
                {pendingSprintCreate.oldestSlot.sprint.name}
              </div>
              {pendingSprintCreate.incompleteTasks.length > 0 ? (
                <div style={{ fontSize: 12, color: 'var(--amber-tx)', marginTop: 6 }}>
                  <i className="ti ti-arrow-right" style={{ marginRight: 4 }} />
                  {pendingSprintCreate.incompleteTasks.length} tarefa{pendingSprintCreate.incompleteTasks.length > 1 ? 's' : ''} incompleta{pendingSprintCreate.incompleteTasks.length > 1 ? 's' : ''} será{pendingSprintCreate.incompleteTasks.length > 1 ? 'ão' : ''} movida{pendingSprintCreate.incompleteTasks.length > 1 ? 's' : ''} para o backlog.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                  <i className="ti ti-circle-check" style={{ marginRight: 4, color: 'var(--green)' }} />
                  Todas as tarefas estão concluídas.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={store.cancelCreateSprint}>Cancelar</button>
              <button className="primary" onClick={store.confirmCreateSprint}>
                <i className="ti ti-trash" /> Remover antiga e criar nova
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="page-content">
        {tab === 'board'   && <BoardTab />}
        {tab === 'pet'     && <PETTab />}
        {tab === 'backlog' && <BacklogTab />}
        {tab === 'sprint'  && <SprintTab />}
        {tab === 'config'  && <ConfigTab />}
        {tab === 'docs'    && <DocsTab />}
      </div>
    </div>
  )
}
