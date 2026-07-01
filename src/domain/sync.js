import { migrateData } from './board'

export async function cloudSavePet(board, team, url) {
  if (!url) throw new Error('URL não configurada')
  const activePet = (board.pets || []).find((s) => s.id === board.activePetId) || (board.pets || [])[0]
  if (!activePet) return

  const initiatives = activePet.initiatives || []
  const quarterConfigs = activePet.pet?.quarterConfigs || {}
  const sizeHrs = activePet.pet?.sizeHrs || {}

  const rows = initiatives.map((i) => ({
    quarter: i.quarter || '',
    title: i.title || '',
    tag: i.tag || '',
    size: i.size || '',
    hrs: sizeHrs[i.size] || 0,
    status: i.status || 'notstarted',
    prioritized: i.prioritized !== false,
    isInitiative: i.isInitiative !== false,
  }))

  const configs = Object.entries(quarterConfigs).map(([q, c]) => ({
    quarter: q,
    startDate: c.startDate || '',
    endDate: c.endDate || '',
    workingDays: c.workingDays ?? 60,
    generalAbsences: JSON.stringify(c.generalAbsences || []),
    memberAbsences: JSON.stringify(c.memberAbsences || {}),
  }))

  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({ action: 'save_pet', team, rows, configs }),
  })
}

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

// Sheets converte "2026-07-01" em cédula de data; ao ler de volta o Apps
// Script devolve um datetime ISO completo, que <input type="date"> não aceita.
function toDateInputValue(v) {
  if (!v) return ''
  const s = String(v)
  return s.includes('T') ? s.slice(0, 10) : s
}

export async function cloudLoadPet(team, url) {
  if (!url) throw new Error('URL não configurada')
  if (!team) return null
  const res = await fetch(`${url}?action=load_pet&team=${encodeURIComponent(team)}`, { method: 'GET' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const json = JSON.parse(await res.text())
  if (!json.ok) return null
  const quarterConfigs = {}
  Object.entries(json.configs || {}).forEach(([q, c]) => {
    quarterConfigs[q] = { ...c, startDate: toDateInputValue(c.startDate), endDate: toDateInputValue(c.endDate) }
  })
  return { quarterConfigs }
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
  const TYPE_LABELS = { feature: 'Feature', pbi: 'PBI', tecnica: 'Técnica', entrega_tecnica: 'Entrega Técnica', bughom: 'BugHom' }
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
