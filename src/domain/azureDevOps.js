// Usa proxy local do Vite para evitar bloqueio de CORS do browser
const API = (org, project) => `/azure-api/${org}/${project}/_apis/wit`

function headers(pat) {
  return {
    Authorization: 'Basic ' + btoa(':' + pat),
    'Content-Type': 'application/json',
  }
}

export async function testConnection({ org, project, pat }) {
  // Usa o endpoint de work item types — requer exatamente Work Items (Read)
  const url = `${API(org, project)}/workitemtypes?api-version=7.0`
  const res = await fetch(url, { headers: headers(pat) })
  if (res.status === 401) throw new Error(
    'Token inválido ou expirado. Gere um novo PAT no Azure DevOps.'
  )
  if (res.status === 403) throw new Error(
    'Sem permissão. Verifique se o PAT tem escopo "Work Items → Read".'
  )
  if (res.status === 404) throw new Error(
    `Projeto não encontrado: "${project}" na org "${org}". Verifique o nome exato (case-sensitive).`
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Erro ${res.status}: ${res.statusText}${text ? ' — ' + text.slice(0, 150) : ''}`)
  }
  const data = await res.json()
  const count = data.count ?? (data.value?.length ?? '?')
  return `Conectado com sucesso! ${count} tipos de work item encontrados em "${project}".`
}

export async function fetchWorkItem(id, { org, project, pat }) {
  const res = await fetch(
    `${API(org, project)}/workitems/${id}?$expand=relations&api-version=7.0`,
    { headers: headers(pat) }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Erro ${res.status}: ${res.statusText}${text ? ' — ' + text.slice(0, 120) : ''}`)
  }
  return res.json()
}

export async function fetchWorkItemsBatch(ids, { org, project, pat }) {
  if (!ids.length) return []
  const chunks = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  const results = []
  for (const chunk of chunks) {
    const fields = 'System.Id,System.Title,System.WorkItemType,System.Description,System.State,System.AreaPath,System.AssignedTo'
    const res = await fetch(
      `${API(org, project)}/workitems?ids=${chunk.join(',')}&fields=${fields}&api-version=7.0`,
      { headers: headers(pat) }
    )
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar PBIs`)
    const data = await res.json()
    results.push(...(data.value || []))
  }
  return results
}

export function extractChildIds(workItem) {
  const relations = workItem.relations || []
  // Aceita qualquer variante de relação pai→filho do Azure DevOps
  const CHILD_RELS = [
    'System.LinkTypes.Hierarchy-Forward',
    'Microsoft.VSTS.Common.Affects-Forward',
    'Child',
  ]
  const children = relations.filter((r) =>
    CHILD_RELS.some((cr) => r.rel === cr) ||
    r.rel?.toLowerCase().includes('hierarchy-forward') ||
    r.rel?.toLowerCase().includes('child')
  )
  return children
    .map((r) => parseInt(r.url.split('/').pop(), 10))
    .filter((n) => !isNaN(n))
}

export function debugRelations(workItem) {
  const rels = workItem.relations || []
  const types = [...new Set(rels.map((r) => r.rel))]
  return { total: rels.length, types }
}

function stripHtml(html = '') {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function mapPbiToTask(wi, featureId) {
  const f = wi.fields || {}
  return {
    code: String(wi.id),
    title: f['System.Title'] || '',
    type: 'pbi',
    size: 'M',
    priority: 2,
    description: stripHtml(f['System.Description'] || ''),
    assigneeId: '',
    qaAssigneeId: '',
    devHrs: '',
    qaHrs: '',
    customHrs: 0,
    devStartDate: '',
    devEndDate: '',
    qaStartDate: '',
    qaEndDate: '',
    sprintId: null,
    petSlotId: null,
    initiativeId: null,
    featureId,
    inSprint: false,
    status: 'backlog',
    areaPath: f['System.AreaPath'] || '',
  }
}

// Mapeamento de status Azure DevOps → status do board
const AZURE_STATUS_MAP = {
  // A Fazer
  'New':                      'todo',
  'Approved':                 'todo',
  'Committed':                'todo',
  'Em Análise':               'todo',
  'En Analise':               'todo',
  // Em Dev
  'Em Desenvolvimento':       'inprogress',
  'Review':                   'inprogress',
  'Para Code Review':         'inprogress',
  'Em Code Review':           'inprogress',
  'Para Homologação':         'inprogress',
  // Em QA
  'Em Homologação':           'inqa',
  'Retirar WIP':              'inqa',
  'Em Merge Request':         'inqa',
  // Avaliação de Entrega — fluxo PO (prazo 60 dias)
  'Avaliação de Entrega':     'avalentrega',
  // Concluído
  'Monitoramento em Produção':'done',
  'Observação':               'done',
  'Done':                     'done',
  'Closed':                   'done',
  'Resolved':                 'done',
}

export function mapAzureStatus(azureStatus) {
  if (!azureStatus) return null
  // Correspondência exata
  if (AZURE_STATUS_MAP[azureStatus]) return AZURE_STATUS_MAP[azureStatus]
  // Fallback: se não reconhecido, mantém como está (retorna null)
  return null
}

export async function fetchWorkItemsStatus(ids, { org, project, pat }) {
  if (!ids.length) return []
  const chunks = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  const results = []
  for (const chunk of chunks) {
    const fields = 'System.Id,System.State,System.AreaPath'
    const res = await fetch(
      `${API(org, project)}/workitems?ids=${chunk.join(',')}&fields=${fields}&api-version=7.0`,
      { headers: headers(pat) }
    )
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar status dos PBIs`)
    const data = await res.json()
    results.push(...(data.value || []))
  }
  return results
}

/**
 * Retorna todos os times do projeto Azure DevOps.
 * Endpoint: GET /{org}/_apis/projects/{project}/teams
 */
export async function fetchProjectTeams({ org, project, pat }) {
  let all = []
  let skip = 0
  const top = 100
  while (true) {
    const res = await fetch(
      `/azure-api/${org}/_apis/projects/${project}/teams?$top=${top}&$skip=${skip}&api-version=7.0`,
      { headers: headers(pat) }
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Erro ${res.status} ao buscar times: ${text.slice(0, 150)}`)
    }
    const data = await res.json()
    const items = data.value || []
    all = [...all, ...items]
    if (items.length < top) break
    skip += top
  }
  return all.map((t) => ({ id: t.id, name: t.name, description: t.description || '' }))
}

/**
 * Busca as Area Paths configuradas para um time específico.
 * Endpoint: GET /{org}/{project}/{team}/_apis/work/teamsettings/teamfieldvalues
 */
async function fetchTeamAreaPaths(teamName, { org, project, pat }) {
  const encoded = encodeURIComponent(teamName)
  const res = await fetch(
    `/azure-api/${org}/${project}/${encoded}/_apis/work/teamsettings/teamfieldvalues?api-version=7.0`,
    { headers: headers(pat) }
  )
  if (!res.ok) return null
  const data = await res.json()
  return (data.values || []).map((v) => ({ path: v.value, includeChildren: v.includeChildren }))
}

/**
 * Busca via WIQL todos os work items com status "Avaliação de Entrega"
 * de um time específico (resolve as Area Paths do time antes da query).
 * Retorna objetos enriquecidos com título, tipo, AreaPath, assignee e data de mudança de estado.
 */
export async function fetchDeliveryEvalItems(teamName, { org, project, pat }) {
  let teamFilter = ''
  if (teamName) {
    const areaPaths = await fetchTeamAreaPaths(teamName, { org, project, pat })
    console.debug('[DeliveryEval] area paths do time:', areaPaths)
    if (areaPaths && areaPaths.length > 0) {
      const conditions = areaPaths.map((a) =>
        a.includeChildren
          ? `[System.AreaPath] UNDER '${a.path}'`
          : `[System.AreaPath] = '${a.path}'`
      )
      teamFilter = 'AND (' + conditions.join(' OR ') + ')'
    } else {
      teamFilter = `AND [System.AreaPath] UNDER '${project}\\${teamName}'`
    }
  }
  console.debug('[DeliveryEval] teamFilter:', teamFilter)

  const wiql = {
    query: `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.State] = 'Avaliação da entrega'
        ${teamFilter}
      ORDER BY [Microsoft.VSTS.Common.StateChangeDate] ASC
    `,
  }

  const wiqlRes = await fetch(
    `${API(org, project)}/wiql?api-version=7.0`,
    { method: 'POST', headers: headers(pat), body: JSON.stringify(wiql) }
  )
  if (!wiqlRes.ok) {
    const text = await wiqlRes.text().catch(() => '')
    throw new Error(`WIQL erro ${wiqlRes.status}: ${text.slice(0, 200)}`)
  }
  const wiqlData = await wiqlRes.json()
  const ids = (wiqlData.workItems || []).map((w) => w.id)
  if (!ids.length) return []

  const fields = [
    'System.Id',
    'System.Title',
    'System.WorkItemType',
    'System.State',
    'System.AreaPath',
    'System.AssignedTo',
    'Microsoft.VSTS.Common.StateChangeDate',
    'System.Parent',
  ].join(',')

  const chunks = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  const items = []
  for (const chunk of chunks) {
    const res = await fetch(
      `${API(org, project)}/workitems?ids=${chunk.join(',')}&fields=${fields}&api-version=7.0`,
      { headers: headers(pat) }
    )
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar detalhes`)
    const data = await res.json()
    items.push(...(data.value || []))
  }

  return items.map((wi) => {
    const f = wi.fields || {}
    const wiType = f['System.WorkItemType'] || ''
    return {
      id: wi.id,
      title: f['System.Title'] || '',
      type: wiType === 'Feature' ? 'feature' : 'pbi',
      workItemType: wiType,
      areaPath: f['System.AreaPath'] || '',
      assignedTo: f['System.AssignedTo']?.displayName || '',
      stateChangedAt: f['Microsoft.VSTS.Common.StateChangeDate'] || null,
      parentId: f['System.Parent'] || null,
      azureUrl: `https://dev.azure.com/${org}/${project}/_workitems/edit/${wi.id}`,
    }
  })
}

/**
 * Busca via WIQL todos os Bug Clients ativos do time (State <> Done, <> Removed).
 * Filtra pelo areaPath do board (UNDER para incluir sub-paths).
 */
export async function fetchBugClients(teamAreaPath, { org, project, pat }) {
  const areaFilter = teamAreaPath
    ? `AND [System.AreaPath] UNDER '${teamAreaPath}'`
    : ''

  const wiql = {
    query: `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.WorkItemType] CONTAINS 'Bug Client'
        ${areaFilter}
        AND [System.State] <> 'Done'
        AND [System.State] <> 'Removed'
        AND [System.State] <> 'Closed'
      ORDER BY [System.CreatedDate] DESC
    `,
  }

  const wiqlRes = await fetch(
    `${API(org, project)}/wiql?api-version=7.0`,
    { method: 'POST', headers: headers(pat), body: JSON.stringify(wiql) }
  )
  if (!wiqlRes.ok) {
    const text = await wiqlRes.text().catch(() => '')
    throw new Error(`WIQL erro ${wiqlRes.status}: ${text.slice(0, 200)}`)
  }
  const wiqlData = await wiqlRes.json()
  const ids = (wiqlData.workItems || []).map((w) => w.id)
  if (!ids.length) return []

  const FIELDS = [
    'System.Id',
    'System.Title',
    'System.State',
    'System.AreaPath',
    'System.AssignedTo',
    'System.CreatedDate',
    'Microsoft.VSTS.Common.Priority',
    'Custom.Prioridade',
    'Custom.Desenvolvedor',
  ].join(',')

  const chunks = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  const items = []
  for (const chunk of chunks) {
    const res = await fetch(
      `${API(org, project)}/workitems?ids=${chunk.join(',')}&fields=${FIELDS}&api-version=7.0`,
      { headers: headers(pat) }
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Erro ${res.status} ao buscar Bug Clients: ${text.slice(0, 200)}`)
    }
    const data = await res.json()
    items.push(...(data.value || []))
  }

  return items.map((wi) => {
    const f = wi.fields || {}

    // Desenvolvedor: campo customizado tem precedência sobre System.AssignedTo
    const desenvolvedorRaw = f['Custom.Desenvolvedor']
    const desenvolvedor = desenvolvedorRaw?.displayName || desenvolvedorRaw || f['System.AssignedTo']?.displayName || ''

    // clienteLiberado: pode ser datetime ISO — formata para pt-BR
    const clienteLiberadoRaw = f['Custom.any_clienteA'] ?? ''
    const clienteLiberado = clienteLiberadoRaw && typeof clienteLiberadoRaw === 'string' && clienteLiberadoRaw.includes('T')
      ? new Date(clienteLiberadoRaw).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : (clienteLiberadoRaw || '')

    return {
      id: wi.id,
      title: f['System.Title'] || '',
      state: f['System.State'] || '',
      areaPath: f['System.AreaPath'] || '',
      assignedTo: desenvolvedor,
      priority: f['Custom.Prioridade'] ?? f['Microsoft.VSTS.Common.Priority'] ?? null,
      createdDate: f['System.CreatedDate'] || null,
      clienteLiberado,
      integracoesMarketplace: f['Custom.Projeto_integracao'] || '',
      azureUrl: `https://dev.azure.com/${org}/${project}/_workitems/edit/${wi.id}`,
    }
  })
}

export async function importFeature(featureId, azureConfig) {
  const wi = await fetchWorkItem(featureId, azureConfig)
  const fields = wi.fields || {}
  const title = fields['System.Title'] || `Feature ${featureId}`
  const areaPath = fields['System.AreaPath'] || ''
  const { total: totalRelations, types: relationTypes } = debugRelations(wi)
  const childIds = extractChildIds(wi)
  const children = await fetchWorkItemsBatch(childIds, azureConfig)
  return { title, azureId: String(featureId), areaPath, children, totalRelations, relationTypes, childIds }
}
