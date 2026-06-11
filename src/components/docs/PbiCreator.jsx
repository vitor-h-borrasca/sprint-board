import { useState, useMemo } from 'react'
import { marked } from 'marked'
import useBoardStore from '@/store/useBoardStore'

// ── Constantes ────────────────────────────────────────────────────────────────

const PBI_STATES     = ['Em Análise', 'Backlog', 'Em Desenvolvimento', 'Em Revisão', 'Done']
const FEATURE_STATES = ['New', 'In Progress', 'Done', 'Removed']
const CLASSIFICACOES = ['Negócio', 'Técnico']

// ── Templates ─────────────────────────────────────────────────────────────────

const PBI_TEMPLATE = `# [NOME DO MARKETPLACE] [MÓDULO] — Título do PBI

### 🔗 Referências
- API do Marketplace: \`GET /endpoint/exemplo\`
- API do ANYMARKET: \`POST /endpoint/exemplo\`

### 🔎 Pontos de atenção
- Regra crítica 1
- Comportamento especial 2

### 🎯 O que estamos resolvendo?
Descrição objetiva do problema que este PBI resolve.

### 👤 User Story
Como [perfil], quero [ação], para [benefício esperado].

### 🚫 Anti-Story
Este PBI NÃO resolve [descrever o que está fora de escopo].

### 🤔 Por que estamos resolvendo isso?
Justificativa de negócio e impacto ao seller.

### 📌 Premissas
- Condição que deve existir para o fluxo funcionar

### 📋 Requisitos
- Requisito funcional 1
- Requisito técnico 2

### ⚙️ Solução Proposta
Descreva o fluxo de execução, payloads, mapeamento de status e estratégia de retry.

### 🔄 Comportamento Esperado
Descrição do fluxo feliz em produção.

### ⚠️ Tratativas de Exceção
**Indisponibilidade de API:** Descreva retentativas, fila e log.

### ✅ Critérios de Aceite

**Cenário 1 — Sucesso**
- **Dado** contexto inicial
- **Quando** ação executada
- **Então** resultado esperado

### 💼 Valor da Entrega
Resultado de valor gerado pelo desenvolvimento deste PBI.
`

const FEATURE_TEMPLATE = `# [NOME DO MARKETPLACE] [MÓDULO] — Título da Feature

### 🧩 Descrição
Descreva o contexto técnico do problema e o impacto em negócio, GMV e tecnologia.

### 🎯 Objetivo
O que esta feature entrega ao seller e à plataforma.

### 🔗 Dependências
- Features, PBIs ou sistemas dependentes

### 💼 Valor de negócio
Descreva o GMV impactado, eficiência operacional, aquisição ou retenção de sellers.

### 🎯 Resultado esperado
Descrição detalhada do resultado esperado após a implementação desta feature.

### 🛠️ Solução Proposta
Detalhamento da solução técnica, riscos e pontos de atenção identificados.

### ⚙️ Escopo da Feature
- Funcionalidade 1 coberta por esta feature
- Funcionalidade 2 coberta por esta feature

### 🔄 Fluxo resumido
1. Passo 1 — Marketplace → ANYMARKET
2. Passo 2

### 📌 Regras principais
- Regra de negócio 1

### 🔒 Critérios de segurança
Não foram identificados possíveis riscos para esse fluxo.

### 🔐 Critérios de privacidade
Não foram identificados possíveis riscos para esse fluxo.
`

// ── Parser helpers ─────────────────────────────────────────────────────────────

function normalizeHeading(text) {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[☀-➿]/gu, '')
    .replace(/[^\w\sáàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractSection(md, headingPattern) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let inside = false
  let level = 0
  const captured = []
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*)/)
    if (m) {
      const currentLevel = m[1].length
      const headingText  = normalizeHeading(m[2])
      if (!inside) {
        if (headingPattern.test(headingText)) { inside = true; level = currentLevel }
      } else {
        if (currentLevel <= level) break
        captured.push(line)
      }
    } else if (inside) {
      captured.push(line)
    }
  }
  return captured.join('\n').trim()
}

function extractTitle(md, fileName) {
  const h1 = md.match(/^#\s+(.+)/m)
  if (h1) return h1[1].trim()
  if (fileName) return fileName.replace(/\.md$/i, '').replace(/[-_]/g, ' ')
  return 'Novo item'
}

function toHtml(md) {
  if (!md || !md.trim()) return ''
  return marked.parse(md)
}

// ── Parser PBI ────────────────────────────────────────────────────────────────

function markdownToPbi(md, fileName) {
  const referencias = extractSection(md, /refer.ncias?|apis?\s+envolvidas?/i)
  const atencao     = extractSection(md, /aten..o|pontos?\s+de\s+aten/i)
  const problema    = extractSection(md, /o\s+que\s+estamos\s+resolv|o\s+que\s+resolver|problema|objetivo/i)
  const userStory   = extractSection(md, /user.?story|hist.ria\s+de\s+usu/i)
  const antiStory   = extractSection(md, /anti.?story|fora\s+d[eo]\s+escopo|n.o\s+cobre|n.o\s+resolve/i)
  const porque      = extractSection(md, /por\s+que|justificativa|motiva..o/i)
  const premissas   = extractSection(md, /premissas?/i)
  const requisitos  = extractSection(md, /requisitos?/i)
  const solucao     = extractSection(md, /solu..o\s+proposta|solu..o|implementa..o/i)
  const esperado    = extractSection(md, /comportamento\s+esperado|resultado\s+esperado/i)
  const excecoes    = extractSection(md, /tratativas?\s+de\s+exce|exce..es?|tratativas?/i)
  const criterios   = extractSection(md, /crit.rios?\s+de\s+aceite|crit.rios?|acceptance|bdd/i)
  const valor       = extractSection(md, /valor\s+da\s+entrega|valor|benef.cio|impacto/i)

  const description = [
    `<h3>🔗 Referências</h3>${referencias     ? toHtml(referencias) : '<ul><li>[APIs envolvidas]</li></ul>'}`,
    `<h3>🔎 Pontos de atenção</h3>${atencao    ? toHtml(atencao)    : '<ul><li>[preencher]</li></ul>'}`,
    `<h3>🎯 O que estamos resolvendo?</h3>${problema ? toHtml(problema)  : '<p>[preencher]</p>'}`,
    `<h3>👤 User Story</h3>${userStory         ? toHtml(userStory)  : '<p>Como <strong>[perfil]</strong>, quero <strong>[ação]</strong>, para <strong>[benefício]</strong>.</p>'}`,
    `<h3>🚫 Anti-Story</h3>${antiStory         ? toHtml(antiStory)  : '<ul><li>[o que este PBI NÃO resolve]</li></ul>'}`,
    `<h3>🤔 Por que estamos resolvendo isso?</h3>${porque ? toHtml(porque) : '<p>[justificativa]</p>'}`,
  ].join('\n')

  const solution = [
    `<h3>📌 Premissas</h3>${premissas  ? toHtml(premissas)  : '<ul><li>[preencher]</li></ul>'}`,
    `<h3>📋 Requisitos</h3>${requisitos ? toHtml(requisitos) : '<ul><li>[preencher]</li></ul>'}`,
    `<h3>⚙️ Solução Proposta</h3>${solucao   ? toHtml(solucao)   : '<ol><li>[descrever fluxo]</li></ol>'}`,
    `<h3>🔄 Comportamento Esperado</h3>${esperado  ? toHtml(esperado)  : '<p>[preencher]</p>'}`,
    `<h3>⚠️ Tratativas de Exceção</h3>${excecoes  ? toHtml(excecoes)  : '<ul><li>[preencher]</li></ul>'}`,
  ].join('\n')

  const acceptanceCriteria = criterios ? toHtml(criterios) : `<p><strong>Cenário 1 — Sucesso</strong></p><ul><li>Dado [contexto]</li><li>Quando [ação]</li><li>Então [resultado esperado]</li></ul>`
  const deliveryValue = `<h3>💼 Valor da Entrega</h3>${valor ? toHtml(valor) : '<p>[descrever o valor gerado ao seller / plataforma]</p>'}`

  return { title: extractTitle(md, fileName), description, solution, acceptanceCriteria, deliveryValue }
}

// ── Parser Feature ────────────────────────────────────────────────────────────

function markdownToFeature(md, fileName) {
  const descricao    = extractSection(md, /^descri..o$/i)
  const objetivo     = extractSection(md, /^objetivo$/i)
  const dependencias = extractSection(md, /depend.ncias?/i)
  const solucao      = extractSection(md, /solu..o\s+proposta|solu..o/i)
  const escopo       = extractSection(md, /escopo\s+da\s+feature|escopo/i)
  const fluxo        = extractSection(md, /fluxo\s+resumido|fluxo/i)
  const regras       = extractSection(md, /regras?\s+principais?|regras?/i)
  const security     = extractSection(md, /seguran.a|crit.rios?\s+de\s+seguran/i)
  const privacy      = extractSection(md, /privacidade|crit.rios?\s+de\s+privacidade/i)
  const valor        = extractSection(md, /valor\s+de\s+neg.cio|valor\s+do\s+neg.cio/i)
  const resultado    = extractSection(md, /resultado\s+esperado/i)

  const description = [
    descricao    ? `<h3>🧩 Descrição</h3>${toHtml(descricao)}`       : `<h3>🧩 Descrição</h3><p>[descrever o contexto]</p>`,
    objetivo     ? `<h3>🎯 Objetivo</h3>${toHtml(objetivo)}`         : `<h3>🎯 Objetivo</h3><p>[descrever o objetivo]</p>`,
    dependencias ? `<h3>🔗 Dependências</h3>${toHtml(dependencias)}` : `<h3>🔗 Dependências</h3><ul><li>[preencher]</li></ul>`,
  ].join('\n')

  const solution = [
    solucao ? `<h3>🛠️ Solução Proposta</h3>${toHtml(solucao)}` : `<h3>🛠️ Solução Proposta</h3><p>[preencher]</p>`,
    escopo  ? `<h3>⚙️ Escopo da Feature</h3>${toHtml(escopo)}` : `<h3>⚙️ Escopo da Feature</h3><ul><li>[preencher]</li></ul>`,
    fluxo   ? `<h3>🔄 Fluxo resumido</h3>${toHtml(fluxo)}`     : `<h3>🔄 Fluxo resumido</h3><ol><li>[descrever fluxo de alto nível]</li></ol>`,
    regras  ? `<h3>📌 Regras principais</h3>${toHtml(regras)}` : `<h3>📌 Regras principais</h3><ul><li>[preencher]</li></ul>`,
  ].join('\n')

  const securityHtml = security ? toHtml(security) : '<p>Não foram identificados riscos de segurança para este fluxo.</p>'
  const privacyHtml  = privacy  ? toHtml(privacy)  : '<p>Não foram identificados riscos de privacidade para este fluxo.</p>'

  const businessValue = [
    valor     ? `<h3>💼 Valor de negócio</h3>${toHtml(valor)}`         : `<h3>💼 Valor de negócio</h3><p>[descrever o valor]</p>`,
    resultado ? `<h3>🎯 Resultado esperado</h3>${toHtml(resultado)}`   : `<h3>🎯 Resultado esperado</h3><p>[preencher]</p>`,
  ].join('\n')

  return { title: extractTitle(md, fileName), description, solution, security: securityHtml, privacy: privacyHtml, businessValue }
}

// ── Azure config ──────────────────────────────────────────────────────────────

function getAzureConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('sprint-board-config') || '{}')
    return { org: cfg.azureOrg || '', project: cfg.azureProject || 'ANYMARKET', pat: cfg.azurePat || '' }
  } catch {
    return { org: '', project: 'ANYMARKET', pat: '' }
  }
}

const ADO = (org, project) => `/azure-api/${org}/${project}/_apis/wit`

function adoHeaders(pat) {
  return { Authorization: 'Basic ' + btoa(':' + pat), 'Content-Type': 'application/json-patch+json' }
}

async function adoPost(url, pat, patch) {
  const res = await fetch(url, { method: 'POST', headers: adoHeaders(pat), body: JSON.stringify(patch) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `Erro ${res.status}`
    try { const j = JSON.parse(text); msg = j.message || msg } catch { msg = text.slice(0, 300) || msg }
    throw new Error(msg)
  }
  return res.json()
}

async function adoPatch(url, pat, patch) {
  const res = await fetch(url, { method: 'PATCH', headers: adoHeaders(pat), body: JSON.stringify(patch) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `Erro ${res.status}`
    try { const j = JSON.parse(text); msg = j.message || msg } catch { msg = text.slice(0, 300) || msg }
    throw new Error(msg)
  }
  return res.json()
}

// ── Componentes UI ────────────────────────────────────────────────────────────

const LBL = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
    {children}
  </div>
)

function FieldReview({ label, value }) {
  const empty = !value || !value.trim()
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</span>
        {empty && <span style={{ fontSize: 10, color: 'var(--amber-tx)', background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', borderRadius: 4, padding: '1px 6px' }}>vazio</span>}
      </div>
      <div style={{
        background: empty ? 'var(--surface2)' : 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        padding: '8px 12px', fontSize: 12,
        color: empty ? 'var(--text3)' : 'var(--text2)',
        fontStyle: empty ? 'italic' : 'normal',
        whiteSpace: 'pre-wrap', lineHeight: 1.6,
        maxHeight: 120, overflowY: 'auto',
      }}>
        {empty ? '(não preenchido no .md)' : value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PbiCreator({ defaultType = 'pbi' }) {
  const boardMembers  = useBoardStore(s => s.board?.members || [])
  const currentTeam   = useBoardStore(s => s.team || '')
  const teamAreaPath  = useBoardStore(s => s.teamAreaPath || '')
  const members       = useMemo(
    () => boardMembers.filter(m => m.email && (!m.team || !currentTeam || m.team === currentTeam)),
    [boardMembers, currentTeam]
  )

  const workItemType = defaultType                              // fixo pela aba
  const [mode, setMode]                 = useState('criar')     // 'criar' | 'atualizar'
  const [state, setState]               = useState('Em Análise')
  const [assignedTo, setAssignedTo]     = useState('')
  const [classificacao, setClassificacao] = useState('Negócio') // feature only
  const [parentId, setParentId]         = useState('')
  const [workItemId, setWorkItemId]     = useState('')
  const [files, setFiles]               = useState([])
  const [review, setReview]             = useState(null)
  const [result, setResult]             = useState(null)
  const [loading, setLoading]           = useState(false)

  const states = workItemType === 'pbi' ? PBI_STATES : FEATURE_STATES

  function downloadTemplate() {
    const content = workItemType === 'pbi' ? PBI_TEMPLATE : FEATURE_TEMPLATE
    const name    = workItemType === 'pbi' ? 'pbi-template.md' : 'feature-template.md'
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  function handleFiles(incoming) {
    const mds = Array.from(incoming).filter(f => f.name.endsWith('.md'))
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...mds.filter(f => !names.has(f.name))]
    })
    setReview(null); setResult(null)
  }

  async function preencherCampos() {
    if (!files.length) return
    setLoading(true)
    try {
      const text = files[0].text ? await files[0].text() : await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsText(files[0])
      })
      const parsed = workItemType === 'pbi'
        ? markdownToPbi(text, files[0].name)
        : markdownToFeature(text, files[0].name)
      setReview(parsed); setResult(null)
    } catch (err) {
      setResult({ ok: false, message: 'Erro ao ler o arquivo: ' + err.message })
    }
    setLoading(false)
  }

  async function confirmarCriacao() {
    if (!review) return
    setLoading(true); setResult(null)
    const cfg = getAzureConfig()
    if (!cfg.org || !cfg.pat) {
      setResult({ ok: false, message: 'Configure org e PAT do Azure DevOps em Configuração.' })
      setLoading(false); return
    }

    try {
      const area = teamAreaPath || `${cfg.project}\\Marketplace Global`

      if (mode === 'criar') {
        let patch
        if (workItemType === 'pbi') {
          patch = [
            { op: 'add', path: '/fields/System.Title',       value: review.title },
            { op: 'add', path: '/fields/System.Description', value: review.description },
            { op: 'add', path: '/fields/Custom.9ee04e26-297a-4523-a62d-0e6b433c9ed7', value: review.solution },
            { op: 'add', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',    value: review.acceptanceCriteria },
            { op: 'add', path: '/fields/Custom.ANY_ValorEntrega', value: review.deliveryValue },
            { op: 'add', path: '/fields/System.State',        value: state },
            { op: 'add', path: '/fields/System.AreaPath',     value: area },
            { op: 'add', path: '/fields/System.IterationPath',value: area },
            { op: 'add', path: '/fields/Custom.ANY_Pais',     value: 'Brasil' },
            { op: 'add', path: '/fields/Custom.79a46532-b84a-4cac-8bf8-48dabf09c76c', value: 'Negócio' },
            ...(assignedTo ? [{ op: 'add', path: '/fields/System.AssignedTo', value: assignedTo }] : []),
          ]
        } else {
          patch = [
            { op: 'add', path: '/fields/System.Title',       value: review.title },
            { op: 'add', path: '/fields/System.Description', value: review.description },
            { op: 'add', path: '/fields/Custom.9ee04e26-297a-4523-a62d-0e6b433c9ed7', value: review.solution },
            { op: 'add', path: '/fields/Custom.80a2bd5d-0e53-41ba-b68b-b5ea4ea8f25d', value: review.security },
            { op: 'add', path: '/fields/Custom.f274e7b7-9636-49ef-91ff-047ba3a01fdf', value: review.privacy },
            { op: 'add', path: '/fields/Custom.Any_resultados_esperados',              value: review.businessValue },
            { op: 'add', path: '/fields/System.State',         value: state },
            { op: 'add', path: '/fields/System.AreaPath',      value: area },
            { op: 'add', path: '/fields/System.IterationPath', value: area },
            { op: 'add', path: '/fields/Custom.79a46532-b84a-4cac-8bf8-48dabf09c76c', value: classificacao },
            { op: 'add', path: '/fields/Custom.ANY_Valor_Avaliador', value: 'Interno' },
            { op: 'add', path: '/fields/Custom.ANY_IMPACTA_API',     value: 'Não Impacta' },
            ...(assignedTo ? [{ op: 'add', path: '/fields/System.AssignedTo', value: assignedTo }] : []),
          ]
        }

        const wiType = workItemType === 'pbi' ? 'Product%20Backlog%20Item' : 'Feature'
        const data = await adoPost(`${ADO(cfg.org, cfg.project)}/workitems/$${wiType}?api-version=7.1`, cfg.pat, patch)
        const newId = data.id

        if (parentId.trim()) {
          const numId = parseInt(parentId.trim(), 10)
          if (numId) {
            await adoPatch(
              `${ADO(cfg.org, cfg.project)}/workitems/${newId}?api-version=7.1`,
              cfg.pat,
              [{ op: 'add', path: '/relations/-', value: {
                rel: 'System.LinkTypes.Hierarchy-Reverse',
                url: `https://dev.azure.com/${cfg.org}/${cfg.project}/_apis/wit/workItems/${numId}`,
                attributes: { comment: 'Vinculado via Sprint Board' },
              }}]
            )
          }
        }

        const url = `https://dev.azure.com/${cfg.org}/${cfg.project}/_workitems/edit/${newId}`
        setResult({ ok: true, message: `${workItemType === 'pbi' ? 'PBI' : 'Feature'} #${newId} criado com sucesso!`, url })

      } else {
        const id = parseInt(workItemId.trim(), 10)
        if (!id) throw new Error('ID do work item inválido.')
        let patch
        if (workItemType === 'pbi') {
          patch = [
            { op: 'replace', path: '/fields/System.Title',       value: review.title },
            { op: 'replace', path: '/fields/System.Description', value: review.description },
            { op: 'replace', path: '/fields/Custom.9ee04e26-297a-4523-a62d-0e6b433c9ed7', value: review.solution },
            { op: 'replace', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',    value: review.acceptanceCriteria },
            { op: 'replace', path: '/fields/Custom.ANY_ValorEntrega', value: review.deliveryValue },
          ]
        } else {
          patch = [
            { op: 'replace', path: '/fields/System.Title',       value: review.title },
            { op: 'replace', path: '/fields/System.Description', value: review.description },
            { op: 'replace', path: '/fields/Custom.9ee04e26-297a-4523-a62d-0e6b433c9ed7', value: review.solution },
            { op: 'replace', path: '/fields/Custom.80a2bd5d-0e53-41ba-b68b-b5ea4ea8f25d', value: review.security },
            { op: 'replace', path: '/fields/Custom.f274e7b7-9636-49ef-91ff-047ba3a01fdf', value: review.privacy },
            { op: 'replace', path: '/fields/Custom.Any_resultados_esperados',              value: review.businessValue },
          ]
        }
        await adoPatch(`${ADO(cfg.org, cfg.project)}/workitems/${id}?api-version=7.1`, cfg.pat, patch)
        const url = `https://dev.azure.com/${cfg.org}/${cfg.project}/_workitems/edit/${id}`
        setResult({ ok: true, message: `${workItemType === 'pbi' ? 'PBI' : 'Feature'} #${id} atualizado com sucesso!`, url })
      }

    } catch (err) {
      console.error('[PbiCreator]', err)
      setResult({ ok: false, message: err.message || 'Erro desconhecido.' })
    } finally {
      setLoading(false)
    }
  }

  // ── Review fields por tipo ────────────────────────────────────────────────
  const reviewFields = review
    ? workItemType === 'pbi'
      ? [
          { label: 'Descrição',          value: review.description },
          { label: 'Solução Proposta',   value: review.solution },
          { label: 'Critérios de Aceite',value: review.acceptanceCriteria },
          { label: 'Valor da Entrega',   value: review.deliveryValue },
        ]
      : [
          { label: 'Descrição',          value: review.description },
          { label: 'Solução Proposta',   value: review.solution },
          { label: 'Segurança',          value: review.security },
          { label: 'Privacidade',        value: review.privacy },
          { label: 'Valor de Negócio',   value: review.businessValue },
        ]
    : []

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Etapa 1: formulário ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 18 }}>
          {workItemType === 'pbi' ? 'PBI' : 'Feature'} — Azure DevOps
        </div>

        {/* Modo */}
        <div style={{ marginBottom: 14 }}>
          <LBL>Modo</LBL>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setMode('criar'); setReview(null); setResult(null) }} className={mode === 'criar' ? 'primary' : ''} style={{ fontSize: 12 }}>
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Criar novo
            </button>
            <button onClick={() => { setMode('atualizar'); setReview(null); setResult(null) }} className={mode === 'atualizar' ? 'primary' : ''} style={{ fontSize: 12 }}>
              <i className="ti ti-pencil" style={{ fontSize: 13 }} /> Atualizar existente
            </button>
          </div>
        </div>

        {/* IDs */}
        <div style={{ marginBottom: 14 }}>
          {mode === 'criar' ? (
            <>
              <LBL>{workItemType === 'pbi' ? 'ID da Feature Pai' : 'ID do Épico Pai'} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></LBL>
              <input value={parentId} onChange={e => setParentId(e.target.value)} placeholder="ex: 1923444" style={{ maxWidth: 260, fontSize: 12, fontFamily: 'monospace' }} />
            </>
          ) : (
            <>
              <LBL>ID do Work Item</LBL>
              <input value={workItemId} onChange={e => setWorkItemId(e.target.value)} placeholder="ex: 2041337" style={{ maxWidth: 260, fontSize: 12, fontFamily: 'monospace' }} />
            </>
          )}
        </div>

        {/* State + Classificação (feature) */}
        <div style={{ display: 'grid', gridTemplateColumns: workItemType === 'feature' && mode === 'criar' ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 14, maxWidth: 480 }}>
          <div>
            <LBL>State</LBL>
            <select value={state} onChange={e => setState(e.target.value)} style={{ fontSize: 12 }}>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {workItemType === 'feature' && mode === 'criar' && (
            <div>
              <LBL>Classificação</LBL>
              <select value={classificacao} onChange={e => setClassificacao(e.target.value)} style={{ fontSize: 12 }}>
                {CLASSIFICACOES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Responsável */}
        <div style={{ marginBottom: 14 }}>
          <LBL>Responsável <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Assigned To)</span></LBL>
          {members.length > 0 ? (
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={{ fontSize: 12, maxWidth: 340 }}>
              <option value="">— sem atribuição —</option>
              {members.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
            </select>
          ) : (
            <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
              placeholder="email@empresa.com (ou cadastre membros em Configuração)"
              style={{ maxWidth: 400, fontSize: 12 }} />
          )}
        </div>

        {/* Template */}
        <div style={{ marginBottom: 14 }}>
          <LBL>Template de exemplo</LBL>
          <button onClick={downloadTemplate} style={{ fontSize: 12 }}>
            <i className="ti ti-download" style={{ fontSize: 13 }} /> Baixar template {workItemType === 'pbi' ? 'PBI' : 'Feature'} (.md)
          </button>
        </div>

        {/* Upload */}
        <div style={{ marginBottom: 16 }}>
          <LBL>Arquivo Markdown (.md)</LBL>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            onClick={() => {
              const inp = document.createElement('input')
              inp.type = 'file'; inp.accept = '.md'; inp.multiple = true
              inp.onchange = e => handleFiles(e.target.files); inp.click()
            }}
            style={{
              border: '2px dashed var(--border2)', borderRadius: 'var(--radius-lg)',
              padding: '24px 16px', cursor: 'pointer', textAlign: 'center',
              background: files.length ? 'var(--green-bg)' : 'var(--surface2)',
              transition: 'background .15s',
            }}
          >
            {files.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                <i className="ti ti-upload" style={{ fontSize: 16, display: 'block', marginBottom: 6, opacity: 0.4 }} />
                Clique para selecionar ou arraste um arquivo .md
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start', textAlign: 'left' }}>
                {files.map(f => (
                  <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="ti ti-file-text" style={{ color: 'var(--green-tx)', fontSize: 13 }} />
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{f.name}</span>
                    <button className="ghost" onClick={e => { e.stopPropagation(); setFiles(p => p.filter(x => x.name !== f.name)); setReview(null) }} style={{ padding: '1px 5px', fontSize: 11, color: 'var(--red-tx)' }}>
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ))}
                <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Clique para adicionar mais</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" onClick={preencherCampos} disabled={loading || !files.length} style={{ fontSize: 12 }}>
            {loading && !review
              ? <><i className="ti ti-loader spin" style={{ fontSize: 13 }} /> Lendo...</>
              : <>Preencher campos <i className="ti ti-arrow-right" style={{ fontSize: 13 }} /></>
            }
          </button>
        </div>
      </div>

      {/* ── Etapa 2: review ── */}
      {review && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 16 }}>
            Review dos campos
          </div>

          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--blue-tx)', marginBottom: 4 }}>Título</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{review.title}</div>
          </div>

          {reviewFields.map(({ label, value }) => (
            <FieldReview key={label} label={label} value={value} />
          ))}

          {result && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 12, marginBottom: 14,
              background: result.ok ? 'var(--green-bg)' : 'var(--red-bg)',
              border: '1px solid ' + (result.ok ? 'var(--green-bd)' : 'var(--red-bd)'),
              color: result.ok ? 'var(--green-tx)' : 'var(--red-tx)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <i className={'ti ' + (result.ok ? 'ti-circle-check' : 'ti-circle-x')} style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} />
              <div>
                <span style={{ fontWeight: 600 }}>{result.message}</span>
                {result.url && (
                  <a href={result.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 11, color: 'var(--green-tx)', marginTop: 2 }}>
                    Abrir no Azure DevOps ↗
                  </a>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={confirmarCriacao} disabled={loading || !!result?.ok} style={{ fontSize: 12 }}>
              {loading
                ? <><i className="ti ti-loader spin" style={{ fontSize: 13 }} /> {mode === 'criar' ? 'Criando...' : 'Atualizando...'}</>
                : <><i className="ti ti-device-floppy" style={{ fontSize: 13 }} /> {mode === 'criar' ? `Criar ${workItemType === 'pbi' ? 'PBI' : 'Feature'} no Azure DevOps` : 'Atualizar no Azure DevOps'}</>
              }
            </button>
            <button className="ghost" onClick={() => { setReview(null); setResult(null) }} style={{ fontSize: 12 }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 13 }} /> Voltar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
