import { useState } from 'react'
import useBoardStore from '@/store/useBoardStore'
import { exportJSON, exportCSV, importJSON, cloudLoadHistory } from '@/domain/sync'
import { fmtDateTime } from '@/domain/utils'
import { getAzureConfig, setAzureConfig } from '@/domain/board'
import { testConnection } from '@/domain/azureDevOps'
import { Card, SectionTitle, Field, SyncBadge } from '@/components/shared'

export default function StorageTab() {
  const store      = useBoardStore()
  const board      = useBoardStore((s) => s.board)
  const syncStatus = useBoardStore((s) => s.syncStatus)
  const lastCloud  = useBoardStore((s) => s.lastCloud)
  const scriptUrl  = useBoardStore((s) => s.scriptUrl)
  const teamName   = useBoardStore((s) => s.team)
  const { retrySync, loadFromCloud, restoreBoard } = store

  const [history, setHistory]           = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [importError, setImportError]   = useState('')

  const [azure, setAzure] = useState(() => getAzureConfig())
  const [azureSaved, setAzureSaved] = useState(false)
  const [testingConn, setTestingConn] = useState(false)
  const [connResult, setConnResult]   = useState(null) // { ok, msg }

  function saveAzure() {
    setAzureConfig(azure)
    setAzureSaved(true)
    setConnResult(null)
    setTimeout(() => setAzureSaved(false), 2000)
  }

  async function handleTestConn() {
    if (!azure.org || !azure.project || !azure.pat) {
      setConnResult({ ok: false, msg: 'Preencha todos os campos antes de testar.' })
      return
    }
    setTestingConn(true)
    setConnResult(null)
    // Salva antes de testar para garantir que o proxy usa os valores atuais
    setAzureConfig(azure)
    try {
      const user = await testConnection(azure)
      setConnResult({ ok: true, msg: `Conectado como: ${user}` })
    } catch (e) {
      setConnResult({ ok: false, msg: e.message })
    } finally {
      setTestingConn(false)
    }
  }

  const activeSlot  = board.sprints.find((s) => s.id === board.activeSprintId) || board.sprints[0]
  const sprintTasks = activeSlot?.tasks || []
  const shr         = { ...activeSlot?.sprint?.sizeHrs }
  const members     = board.members || []

  async function fetchHistory() {
    if (!scriptUrl) return
    setLoadingHistory(true)
    setHistoryError('')
    try {
      const h = await cloudLoadHistory(scriptUrl)
      setHistory(h)
    } catch (e) {
      setHistoryError('Erro ao carregar histórico: ' + e.message)
    } finally {
      setLoadingHistory(false)
    }
  }

  function handleImport() {
    setImportError('')
    importJSON(
      (b) => { restoreBoard(b); setImportError('') },
      (msg) => setImportError(msg),
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Linha 1: Sync + Stats ── */}
      <div className="grid-2">

        {/* Google Drive Sync */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <SectionTitle icon="ti-cloud" label="Google Drive Sync" />
            <SyncBadge status={syncStatus} onRetry={retrySync} />
          </div>

          <Field label="URL do Apps Script" hint="(opcional)">
            <input
              value={scriptUrl || ''}
              onChange={(e) => store.setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            />
          </Field>

          {scriptUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Último sync: <b style={{ color: 'var(--text)' }}>{lastCloud ? fmtDateTime(lastCloud.toISOString()) : '—'}</b>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ghost" style={{ fontSize: 12 }} onClick={loadFromCloud}>
                  <i className="ti ti-cloud-download" /> Carregar do Drive
                </button>
                <button className="ghost" style={{ fontSize: 12 }} onClick={retrySync}>
                  <i className="ti ti-refresh" /> Forçar save
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              Cole a URL do Web App publicado no Google Apps Script para habilitar o sync automático em nuvem.
            </p>
          )}
        </Card>

        {/* Estatísticas do board */}
        <Card>
          <SectionTitle icon="ti-chart-bar" label="Resumo do Board" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { l: 'Sprints',           v: board.sprints.length,          icon: 'ti-run',          color: 'var(--blue-tx)' },
              { l: 'Backlog',           v: (board.tasks || []).length,    icon: 'ti-stack',        color: 'var(--purple-tx)' },
              { l: 'Sprint ativa',      v: sprintTasks.length,            icon: 'ti-layout-kanban',color: 'var(--teal-tx)' },
              { l: 'Membros',           v: members.length,                icon: 'ti-users',        color: 'var(--amber-tx)' },
              { l: 'Quarters PET',      v: (board.pets || []).length,     icon: 'ti-chart-bar',    color: 'var(--orange)' },
              { l: 'Iniciativas PET',   v: (board.pets || []).reduce((s, p) => s + (p.initiatives?.filter(i => i.isInitiative !== false).length || 0), 0), icon: 'ti-target', color: 'var(--red-tx)' },
            ].map((k) => (
              <div key={k.l} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <i className={'ti ' + k.icon} style={{ fontSize: 14, color: k.color }} />
                  <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.l}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Azure DevOps ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <SectionTitle icon="ti-brand-azure" label="Azure DevOps" />
          {azureSaved && (
            <span style={{ fontSize: 11, color: 'var(--teal-tx)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-check" /> Salvo
            </span>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          Configure sua conexão com o Azure DevOps para importar Features e PBIs diretamente na aba PET e Backlog.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Organization" hint="Ex: minha-empresa">
            <input
              value={azure.org}
              onChange={(e) => setAzure((p) => ({ ...p, org: e.target.value }))}
              placeholder="https://dev.azure.com/{organization}"
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            />
          </Field>
          <Field label="Project" hint="Nome do projeto no Azure DevOps">
            <input
              value={azure.project}
              onChange={(e) => setAzure((p) => ({ ...p, project: e.target.value }))}
              placeholder="MeuProjeto"
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            />
          </Field>
        </div>

        <Field label="Personal Access Token (PAT)" hint="Permissão mínima: Work Items (Read)">
          <input
            type="password"
            value={azure.pat}
            onChange={(e) => setAzure((p) => ({ ...p, pat: e.target.value }))}
            placeholder="••••••••••••••••••••••••••••••••••••••••••••••••••"
            style={{ fontFamily: 'monospace', fontSize: 11 }}
          />
        </Field>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="primary" style={{ fontSize: 12 }} onClick={saveAzure}>
            <i className="ti ti-device-floppy" /> Salvar configuração
          </button>
          <button
            className="ghost"
            style={{ fontSize: 12 }}
            onClick={handleTestConn}
            disabled={testingConn}
          >
            {testingConn
              ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> Testando...</>
              : <><i className="ti ti-plug-connected" /> Testar conexão</>
            }
          </button>
          {azureSaved && (
            <span style={{ fontSize: 11, color: 'var(--teal-tx)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-check" /> Salvo
            </span>
          )}
        </div>

        {connResult && (
          <div style={{
            marginTop: 10, fontSize: 12, padding: '8px 12px', borderRadius: 8,
            background: connResult.ok ? 'var(--teal-bg)' : 'var(--red-bg)',
            border: '1px solid ' + (connResult.ok ? 'var(--teal-bd)' : 'var(--red-bd)'),
            color: connResult.ok ? 'var(--teal-tx)' : 'var(--red-tx)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <i className={'ti ' + (connResult.ok ? 'ti-circle-check' : 'ti-alert-circle')} />
            {connResult.msg}
          </div>
        )}

        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text2)' }}>Como gerar um PAT:</b> Azure DevOps → User Settings → Personal Access Tokens → New Token → Work Items (Read)
        </div>
      </Card>

      {/* ── Linha 2: Export/Import + Histórico ── */}
      <div className="grid-2">

        {/* Export / Import */}
        <Card>
          <SectionTitle icon="ti-file-export" label="Exportar / Importar" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Exportar</div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                Backup completo em JSON ou tarefas da sprint ativa em CSV.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="primary" style={{ fontSize: 12 }} onClick={() => exportJSON(board)}>
                  <i className="ti ti-download" /> JSON completo
                </button>
                <button className="ghost" style={{ fontSize: 12 }} onClick={() => exportCSV(sprintTasks, members, shr, activeSlot?.sprint?.name || 'sprint')}>
                  <i className="ti ti-table-export" /> CSV da sprint
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)' }} />

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Importar</div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                Restaura um backup JSON. <b style={{ color: 'var(--amber-tx)' }}>Os dados atuais serão sobrescritos.</b>
              </p>
              <button
                className="ghost"
                style={{ fontSize: 12, borderColor: 'var(--amber-bd)', color: 'var(--amber-tx)', background: 'var(--amber-bg)' }}
                onClick={handleImport}
              >
                <i className="ti ti-upload" /> Importar JSON
              </button>
              {importError && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--red-tx)', background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 6, padding: '6px 10px' }}>
                  {importError}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)' }} />

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Resetar board do time
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                Apaga <b style={{ color: 'var(--red-tx)' }}>todos os dados locais</b> do time <b style={{ color: 'var(--text2)' }}>{teamName}</b> e inicia um board em branco. Use para corrigir dados de outro time que aparecem aqui por engano.
              </p>
              <button
                className="ghost"
                style={{ fontSize: 12, borderColor: 'var(--red-bd)', color: 'var(--red-tx)', background: 'var(--red-bg)' }}
                onClick={() => {
                  if (confirm(`Tem certeza? Isso vai apagar TODOS os dados locais do time "${teamName}". Esta ação não pode ser desfeita.`))
                    store.resetTeamBoard()
                }}
              >
                <i className="ti ti-trash" /> Resetar dados do time
              </button>
            </div>

          </div>
        </Card>

        {/* Histórico de snapshots */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <SectionTitle icon="ti-history" label="Histórico de Snapshots" />
            <button
              className="ghost"
              style={{ fontSize: 11 }}
              onClick={fetchHistory}
              disabled={!scriptUrl || loadingHistory}
              title={!scriptUrl ? 'Configure a URL do Drive primeiro' : ''}
            >
              {loadingHistory
                ? <><i className="ti ti-loader spin" /> Carregando...</>
                : <><i className="ti ti-refresh" /> Atualizar</>
              }
            </button>
          </div>

          {!scriptUrl && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 12 }}>
              <i className="ti ti-cloud-off" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.3 }} />
              Configure a URL do Google Drive para acessar o histórico.
            </div>
          )}

          {historyError && (
            <div style={{ fontSize: 11, color: 'var(--red-tx)', background: 'var(--red-bg)', border: '1px solid var(--red-bd)', borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
              {historyError}
            </div>
          )}

          {history && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {(!history.snapshots || history.snapshots.length === 0) && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>
                  Nenhum snapshot encontrado.
                </div>
              )}
              {(history.snapshots || []).map((snap, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8,
                  border: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{snap.sprintName || 'Sprint'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{fmtDateTime(snap.savedAt)}</div>
                  </div>
                  <button className="ghost" style={{ fontSize: 11 }} onClick={() => {
                    if (confirm('Restaurar este snapshot? Os dados atuais serão perdidos.'))
                      restoreBoard(snap.data)
                  }}>
                    <i className="ti ti-restore" /> Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}

          {!history && scriptUrl && !loadingHistory && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 12 }}>
              <i className="ti ti-history" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.3 }} />
              Clique em "Atualizar" para carregar o histórico do Drive.
            </div>
          )}
        </Card>
      </div>

    </div>
  )
}
