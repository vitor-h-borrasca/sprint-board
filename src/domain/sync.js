import { migrateData } from './board'

export async function cloudSave(boardData, name, url) {
  if (!url) throw new Error('URL não configurada')
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({ data: boardData, sprintName: name }),
  })
  const verify = await cloudLoad(url)
  if (!verify) throw new Error('Verificação pós-save falhou')
}

export async function cloudLoad(url) {
  if (!url) throw new Error('URL não configurada')
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const text = await res.text()
  if (!text || text === '{}') return null
  const parsed = JSON.parse(text)
  const raw = parsed.data || parsed
  if (raw.sprints && Array.isArray(raw.sprints)) return migrateData(raw)
  if (raw.sprint && Array.isArray(raw.tasks)) return migrateData(raw)
  return null
}

export async function cloudLoadHistory(url) {
  if (!url) throw new Error('URL não configurada')
  const res = await fetch(url + '?action=history', { method: 'GET' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return JSON.parse(await res.text())
}

export function exportJSON(boardData) {
  const active = boardData.sprints.find((s) => s.id === boardData.activeSprintId) || boardData.sprints[0]
  const name = (active?.sprint?.name || 'sprint').replace(/\s+/g, '-').toLowerCase()
  const blob = new Blob([JSON.stringify(boardData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sprint-board_${name}_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCSV(tasks, members, shr, sprintName) {
  const TYPE_LABELS = { feature: 'Feature', pbi: 'PBI', tecnica: 'Técnica', bughom: 'BugHom' }
  const PRIORITIES = [{ v: 1, label: 'Alta' }, { v: 2, label: 'Média' }, { v: 3, label: 'Baixa' }]
  const STATUSES = { backlog: { label: 'Backlog' }, todo: { label: 'A Fazer' }, inprogress: { label: 'Em Dev' }, inqa: { label: 'Em QA' }, done: { label: 'Concluído' } }
  const headers = ['Sprint','Título','Tipo','Tamanho','Horas','Prioridade','Status','Responsável','Role','Dev Início','Dev Fim','QA Início','QA Fim','Descrição']
  const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`
  const rows = tasks.map((t) => {
    const m = members.find((x) => x.id === t.assigneeId)
    const dh = t.devHrs > 0 ? t.devHrs : 0
    const qh = t.qaHrs > 0 ? t.qaHrs : 0
    const hrs = dh + qh > 0 ? dh + qh : t.customHrs || (shr[t.size] || 0)
    return [
      sprintName, t.title, TYPE_LABELS[t.type] || t.type, t.size, hrs,
      PRIORITIES.find((p) => p.v === t.priority)?.label || '',
      STATUSES[t.status]?.label || t.status,
      m?.name || '', m?.role || '',
      t.devStartDate || '', t.devEndDate || '',
      t.qaStartDate || '', t.qaEndDate || '',
      t.description || '',
    ].map(esc).join(',')
  })
  const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sprint-${(sprintName || 'export').replace(/\s+/g, '-').toLowerCase()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function importJSON(onSuccess, onError) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const p = JSON.parse(ev.target.result)
        const board = migrateData(p.sprints ? p : p.sprint && p.tasks ? p : null)
        if (!board) { onError('JSON inválido.'); return }
        onSuccess(board)
      } catch { onError('Erro ao ler o arquivo.') }
    }
    reader.readAsText(file)
  }
  input.click()
}
