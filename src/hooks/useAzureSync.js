import { useState } from 'react'
import useBoardStore from '@/store/useBoardStore'
import { getAzureConfig } from '@/domain/board'
import { fetchWorkItemsStatus, mapAzureStatus } from '@/domain/azureDevOps'

/**
 * Hook compartilhado de sync com Azure DevOps.
 * Pode ser usado tanto na SprintTab quanto no BoardTab (Kanban).
 */
export function useAzureSync() {
  const board = useBoardStore((s) => s.board)
  const store = useBoardStore()

  const [syncing, setSyncing]       = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  const azureConfig = getAzureConfig()
  const azureReady  = !!(azureConfig.org && azureConfig.project && azureConfig.pat)

  async function syncStatus() {
    const sprintTasks = board.sprints.find((s) => s.id === board.activeSprintId)?.tasks || []
    const syncable    = sprintTasks.filter((t) => t.code && /^\d+$/.test(t.code.trim()))

    if (!syncable.length) {
      setSyncResult({ ok: false, msg: 'Nenhuma tarefa com código Azure DevOps na sprint.' })
      return
    }

    setSyncing(true)
    setSyncResult(null)

    try {
      const ids    = syncable.map((t) => Number(t.code))
      const wiList = await fetchWorkItemsStatus(ids, azureConfig)

      let updated = 0
      const unmapped = [] // { title, azureStatus }
      for (const wi of wiList) {
        const azureStatus = wi.fields?.['System.State'] || '?'
        const boardStatus = mapAzureStatus(azureStatus)
        const task        = syncable.find((t) => t.code === String(wi.id))
        if (!task) continue
        if (!boardStatus) {
          unmapped.push({ title: task.title || `#${wi.id}`, code: wi.id, azureStatus })
          continue
        }
        if (task.status !== boardStatus) {
          store.patchTask(task.id, { status: boardStatus })
          updated++
        }
      }

      setSyncResult({
        ok: true,
        updated,
        unmapped,
        msg: `✓ ${updated} tarefa${updated !== 1 ? 's' : ''} atualizada${updated !== 1 ? 's' : ''}` +
          (unmapped.length ? ` · ${unmapped.length} status não mapeado${unmapped.length !== 1 ? 's' : ''}` : ''),
      })
    } catch (e) {
      setSyncResult({ ok: false, msg: 'Erro: ' + e.message })
    } finally {
      setSyncing(false)
    }
  }

  function clearResult() { setSyncResult(null) }

  return { syncing, syncResult, azureReady, syncStatus, clearResult }
}
