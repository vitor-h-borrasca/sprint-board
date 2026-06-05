import { useState } from 'react'
import useBoardStore from '@/store/useBoardStore'
import { genId } from '@/domain/utils'
import { getAzureConfig } from '@/domain/board'
import { importFeature, fetchWorkItem, extractChildIds, fetchWorkItemsBatch, mapPbiToTask, debugRelations } from '@/domain/azureDevOps'

export default function FeaturesTab() {
  const board    = useBoardStore((s) => s.board)
  const store    = useBoardStore()
  const features = board.features || []

  const allTasks = [
    ...(board.tasks || []),
    ...board.sprints.flatMap((s) => s.tasks || []),
  ]

  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState('')

  const azureConfig = getAzureConfig()
  const azureReady  = !!(azureConfig.org && azureConfig.project && azureConfig.pat)

  function add() {
    if (!newName.trim()) return
    store.addFeature(newName, newCode)
    setNewName('')
    setNewCode('')
  }

  async function handleImport() {
    const id = newCode.trim()
    if (!id) { setImportErr('Informe o ID da Feature no campo Código.'); return }
    if (!azureReady) { setImportErr('Configure as credenciais do Azure DevOps na aba Integrações.'); return }
    setImportErr('')
    setImporting(true)
    try {
      const { title, azureId, children, totalRelations, relationTypes, childIds } = await importFeature(id, azureConfig)
      const featureId = store.addFeature(title, azureId)
      let added = 0
      const existingCodes = new Set(allTasks.map((t) => t.code))
      for (const wi of children) {
        if (existingCodes.has(String(wi.id))) continue
        store.upsertTask({ id: genId(), createdAt: Date.now(), ...mapPbiToTask(wi, featureId) })
        added++
      }
      setNewCode('')
      setNewName('')
      const diag = totalRelations === 0
        ? ' (nenhuma relação encontrada no work item)'
        : childIds.length === 0
          ? ` (${totalRelations} relações encontradas, tipos: ${relationTypes.join(', ')} — nenhuma reconhecida como filho)`
          : ''
      setImportErr(`✓ Feature importada com ${added} PBI${added !== 1 ? 's' : ''} novos.${diag}`)
    } catch (e) {
      setImportErr('Erro: ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>

      {/* Header + Add */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Código</div>
          <input
            value={newCode}
            onChange={(e) => { setNewCode(e.target.value); setImportErr('') }}
            placeholder="ex: 1923444"
            style={{ width: 110, fontSize: 12 }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Nome da feature</div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Deixe em branco para buscar nome do Azure DevOps"
            style={{ fontSize: 12, width: '100%' }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        </div>
        <button className="primary" style={{ fontSize: 12, marginBottom: 1 }} onClick={add} disabled={!newName.trim()}>
          <i className="ti ti-plus" /> Adicionar
        </button>
        {azureReady && (
          <button
            style={{
              fontSize: 12, marginBottom: 1,
              background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', color: 'var(--blue-tx)',
              borderRadius: 'var(--radius)', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6,
              opacity: importing ? 0.7 : 1, cursor: importing ? 'not-allowed' : 'pointer',
            }}
            onClick={handleImport}
            disabled={importing}
            title="Importa a Feature e seus PBIs filhos do Azure DevOps"
          >
            {importing
              ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> Importando...</>
              : <><i className="ti ti-cloud-download" /> Importar do Azure</>
            }
          </button>
        )}
      </div>

      {/* Feedback import */}
      {importErr && (
        <div style={{
          fontSize: 12, padding: '8px 12px', borderRadius: 8,
          background: importErr.startsWith('✓') ? 'var(--teal-bg)' : 'var(--red-bg)',
          border: '1px solid ' + (importErr.startsWith('✓') ? 'var(--teal-bd)' : 'var(--red-bd)'),
          color: importErr.startsWith('✓') ? 'var(--teal-tx)' : 'var(--red-tx)',
        }}>
          {importErr}
        </div>
      )}

      {!azureReady && (
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <i className="ti ti-plug-connected-x" style={{ marginRight: 5 }} />
          Configure o Azure DevOps na aba <b>Integrações</b> para habilitar a importação automática.
        </div>
      )}

      {/* Empty */}
      {features.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 13 }}>
          <i className="ti ti-layers-subtract" style={{ fontSize: 40, display: 'block', marginBottom: 10, opacity: 0.25 }} />
          Nenhuma feature cadastrada. Adicione a primeira acima.
        </div>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {features.map((ft) => {
          const linked = allTasks.filter((t) => t.featureId === ft.id)
          return (
            <FeatureRow
              key={ft.id}
              feature={ft}
              linkedTasks={linked}
              allTasks={allTasks}
              azureConfig={azureConfig}
              azureReady={azureReady}
              onRename={(name) => store.renameFeature(ft.id, name)}
              onRecode={(code) => store.recodeFeature(ft.id, code)}
              onRemove={() => store.removeFeature(ft.id)}
              onAddTasks={(tasks) => tasks.forEach((t) => store.upsertTask(t))}
              onLinkTasks={(ids, featureId) => ids.forEach((id) => store.patchTask(id, { featureId }))}
            />
          )
        })}
      </div>
    </div>
  )
}

function FeatureRow({ feature, linkedTasks, allTasks, azureConfig, azureReady, onRename, onRecode, onRemove, onAddTasks, onLinkTasks }) {
  const [editName, setEditName] = useState(feature.name)
  const [editCode, setEditCode] = useState(feature.code || '')
  const [expanded, setExpanded] = useState(false)
  const [syncing, setSyncing]   = useState(false)
  const [syncMsg, setSyncMsg]   = useState('')

  function commitName() { if (editName.trim() && editName !== feature.name) onRename(editName) }
  function commitCode() { if (editCode !== (feature.code || '')) onRecode(editCode) }

  const codeIsNumeric = /^\d+$/.test((feature.code || '').trim())

  async function handleSync() {
    if (!azureReady || !codeIsNumeric) return
    setSyncing(true)
    setSyncMsg('')
    try {
      const wi = await fetchWorkItem(feature.code, azureConfig)
      const { total: totalRelations, types: relationTypes } = debugRelations(wi)
      const childIds = extractChildIds(wi)
      const children = await fetchWorkItemsBatch(childIds, azureConfig)
      const codeToTask = Object.fromEntries(allTasks.map((t) => [t.code, t]))
      const newTasks = []
      const toLink = []

      for (const wi of children) {
        const code = String(wi.id)
        const existing = codeToTask[code]
        if (!existing) {
          newTasks.push({ id: genId(), createdAt: Date.now(), ...mapPbiToTask(wi, feature.id) })
        } else if (existing.featureId !== feature.id) {
          toLink.push(existing)
        }
      }

      if (newTasks.length > 0) onAddTasks(newTasks)
      if (toLink.length > 0) onLinkTasks(toLink.map((t) => t.id), feature.id)

      if (childIds.length === 0 && totalRelations > 0) {
        setSyncMsg(`Nenhum filho encontrado. ${totalRelations} relações no work item, tipos: ${relationTypes.join(', ')}`)
      } else if (totalRelations === 0) {
        setSyncMsg('Work item sem relações. Verifique se a Feature tem PBIs filhos no Azure DevOps.')
      } else {
        const parts = []
        if (newTasks.length > 0) parts.push(`${newTasks.length} novo${newTasks.length > 1 ? 's' : ''}`)
        if (toLink.length > 0) parts.push(`${toLink.length} vinculado${toLink.length > 1 ? 's' : ''}`)
        setSyncMsg(`✓ ${parts.length ? parts.join(', ') + ' PBI(s).' : 'Tudo já sincronizado.'}`)
      }
    } catch (e) {
      setSyncMsg('Erro: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        {/* Código */}
        <input
          value={editCode}
          onChange={(e) => setEditCode(e.target.value)}
          onBlur={commitCode}
          onKeyDown={(e) => e.key === 'Enter' && commitCode()}
          placeholder="Código"
          style={{ width: 100, fontSize: 12, fontFamily: 'monospace', padding: '4px 8px', flexShrink: 0 }}
        />

        {/* Nome */}
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && commitName()}
          style={{ flex: 1, fontSize: 13, fontWeight: 600, background: 'none', border: '1px solid transparent', padding: '4px 8px', borderRadius: 'var(--radius)' }}
          onFocus={(e) => e.target.style.borderColor = 'var(--blue)'}
          onBlurCapture={(e) => e.target.style.borderColor = 'transparent'}
        />

        {/* Sincronizar Azure */}
        {azureReady && codeIsNumeric && (
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Buscar PBIs novos desta Feature no Azure DevOps"
            style={{
              fontSize: 11, padding: '4px 10px', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)',
              color: 'var(--blue-tx)', borderRadius: 'var(--radius)',
              opacity: syncing ? 0.7 : 1, cursor: syncing ? 'not-allowed' : 'pointer',
            }}
          >
            <i className={'ti ' + (syncing ? 'ti-loader' : 'ti-refresh')} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        )}

        {/* Tarefas vinculadas */}
        <span
          onClick={() => linkedTasks.length > 0 && setExpanded((v) => !v)}
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 20,
            background: linkedTasks.length > 0 ? 'var(--blue-bg)' : 'var(--surface2)',
            border: '1px solid ' + (linkedTasks.length > 0 ? 'var(--blue-bd)' : 'var(--border)'),
            color: linkedTasks.length > 0 ? 'var(--blue-tx)' : 'var(--text3)',
            cursor: linkedTasks.length > 0 ? 'pointer' : 'default',
            flexShrink: 0, fontWeight: 600,
          }}
        >
          {linkedTasks.length} {linkedTasks.length === 1 ? 'tarefa' : 'tarefas'}
          {linkedTasks.length > 0 && <i className={'ti ' + (expanded ? ' ti-chevron-up' : ' ti-chevron-down')} style={{ fontSize: 10, marginLeft: 4 }} />}
        </span>

        <button
          className="ghost"
          style={{ padding: '3px 7px', fontSize: 12, color: 'var(--red-tx)', flexShrink: 0 }}
          onClick={onRemove}
          title="Remover feature (desvincula tarefas)"
        >
          <i className="ti ti-trash" />
        </button>
      </div>

      {/* Mensagem sync */}
      {syncMsg && (
        <div style={{
          margin: '0 14px 10px',
          fontSize: 11, padding: '6px 10px', borderRadius: 6,
          background: syncMsg.startsWith('✓') ? 'var(--teal-bg)' : 'var(--red-bg)',
          border: '1px solid ' + (syncMsg.startsWith('✓') ? 'var(--teal-bd)' : 'var(--red-bd)'),
          color: syncMsg.startsWith('✓') ? 'var(--teal-tx)' : 'var(--red-tx)',
        }}>
          {syncMsg}
        </div>
      )}

      {/* Tarefas expandidas */}
      {expanded && linkedTasks.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {linkedTasks.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
              {t.code && (
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{t.code}</span>
              )}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                {t.title || <em style={{ color: 'var(--text3)' }}>sem título</em>}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0, textTransform: 'uppercase' }}>{t.type}</span>
              <span style={{ fontSize: 10, flexShrink: 0, padding: '1px 6px', borderRadius: 4, background: t.sprintId ? 'var(--amber-bg)' : 'var(--gray-bg)', color: t.sprintId ? 'var(--amber-tx)' : 'var(--text3)', border: '1px solid ' + (t.sprintId ? 'var(--amber-bd)' : 'var(--border)') }}>
                {t.sprintId ? 'Sprint' : 'Backlog'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
