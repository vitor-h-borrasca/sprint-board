import { useState, useMemo, useEffect } from 'react'
import { marked } from 'marked'
import useBoardStore from '@/store/useBoardStore'
import { fetchTeams } from '@/domain/auth'

// ── Constantes ─────────────────────────────────────────────────────────────────

const PRIORIDADE_OPTS  = ['1 - Crítico', '2 - Alto', '3 - Médio', '4 - Baixo']
const TECNICO_OPTS     = ['NÃO', 'SIM']
const MARKETPLACE_OPTS = ['Shopee', 'TikTok', 'Shein', 'Dafiti', 'AliExpress', 'TEMU']
const DOMINIO_OPTS     = ['Configurações', 'Pedido', 'Catálogo', 'Estoque', 'Frete', 'Transmissão', 'Preço', 'Monitoramento', 'Menu']

const DOMINIO_SUBS = {
  'Pedido':   { field: 'Custom.DominioPedido_Any',   opts: ['Importaçao de Pedido', 'Atualizaçao de Pedido', 'Etiquetas', 'Auditoria', 'Consulta/Busca/Filtro/Resultados'] },
  'Catálogo': { field: 'Custom.DominioCatalogo_Any', opts: ['Marca', 'Atributos', 'Categoria'] },
  'Estoque':  { field: 'Custom.DominioEstoque_Any',  opts: ['Gestão de Estoque'] },
  'Frete':    { field: 'Custom.DominioFrete_Any',    opts: [] },
}
const ORIGEM_HOT_OPTS  = ['Homologador', 'Automation', 'Desenvolvedor']
const CAUSA_RAIZ_OPTS  = ['Falha de codificação - Backend', 'Falha de codificação - Frontend', 'Regra de negócio', 'Infraestrutura', 'Outros']

const BUG_HOM_TEMPLATE = `# [MARKETPLACE] [MÓDULO] — descrição curta do bug

---

## 🎯 Resumo do problema

**O que acontece:**
<descreva o comportamento incorreto observado>

**Frequência:**
\`sempre\` / \`intermitente\` / \`esporádico\`

**Evidências:**
<link ou anexo de gif / print / log>

---

## 🔎 Pontos de atenção

- <riscos, impacto para o seller, dependências de outros componentes>
- <comportamento esperado vs. comportamento atual>

---

## 🔄 Como simular o problema

1. Acesse \`<módulo/tela>\`
2. Execute \`<ação>\`
3. Observe que \`<comportamento errado>\`

**Resultado atual:** <o que acontece>
**Resultado esperado:** <o que deveria acontecer>

---

## ✅ Critérios de aceite

**Cenário 1 — Correção aplicada com sucesso**
- Dado \`<contexto>\`
- Quando \`<ação executada>\`
- Então \`<resultado esperado>\`

**Cenário 2 — Regressão / cenário de falha**
- Dado \`<contexto>\`
- Quando \`<condição de falha>\`
- Então \`<comportamento esperado do sistema>\`
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
  return 'Novo Bug Hom'
}

function toHtml(md) {
  if (!md || !md.trim()) return ''
  return marked.parse(md)
}

function markdownToBugHom(md, fileName) {
  const resumo    = extractSection(md, /resumo\s+do\s+problema/i)
  const atencao   = extractSection(md, /pontos?\s+de\s+aten/i)
  const simular   = extractSection(md, /como\s+simular|simular\s+o\s+problema/i)
  const criterios = extractSection(md, /crit.rios?\s+de\s+aceite|crit.rios?/i)

  const description = [
    resumo  ? `<h3>🎯 Resumo do problema</h3>${toHtml(resumo)}`   : `<h3>🎯 Resumo do problema</h3><p>[descrever o comportamento incorreto observado, frequência e evidências]</p>`,
    atencao ? `<h3>🔎 Pontos de atenção</h3>${toHtml(atencao)}` : `<h3>🔎 Pontos de atenção</h3><ul><li>[riscos, impacto para o seller, dependências]</li></ul>`,
  ].join('\n')

  const comoSimular = simular
    ? toHtml(simular)
    : `<ol><li>Acesse [módulo/tela]</li><li>Execute [ação]</li><li>Observe que [comportamento errado]</li></ol>` +
      `<p><strong>Resultado atual:</strong> [o que acontece]<br><strong>Resultado esperado:</strong> [o que deveria acontecer]</p>`

  const acceptanceCriteria = criterios
    ? toHtml(criterios)
    : `<p><strong>Cenário 1 — Correção aplicada com sucesso</strong></p>` +
      `<ul><li>Dado [contexto]</li><li>Quando [ação executada]</li><li>Então [resultado esperado]</li></ul>` +
      `<p><strong>Cenário 2 — Regressão / cenário de falha</strong></p>` +
      `<ul><li>Dado [contexto]</li><li>Quando [condição de falha]</li><li>Então [comportamento esperado do sistema]</li></ul>`

  return { title: extractTitle(md, fileName), description, comoSimular, acceptanceCriteria }
}

// ── Azure helpers ──────────────────────────────────────────────────────────────

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

// ── UI helpers ─────────────────────────────────────────────────────────────────

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

// ── Componente principal ───────────────────────────────────────────────────────

export default function BugHomCreator() {
  const boardMembers          = useBoardStore(s => s.board?.members || [])
  const currentTeam           = useBoardStore(s => s.team || '')
  const teamProjetoIntegracao = useBoardStore(s => s.teamProjetoIntegracao || '')

  const [projetoIntegracaoOpts, setProjetoIntegracaoOpts] = useState([])
  const [projetoIntegracao, setProjetoIntegracao]         = useState('ANY_GLOBAL')

  useEffect(() => {
    fetchTeams().then(list => {
      const opts = [...new Set(list.map(t => t.projetoIntegracao).filter(Boolean))]
      setProjetoIntegracaoOpts(opts)
      setProjetoIntegracao(teamProjetoIntegracao || opts[0] || 'ANY_GLOBAL')
    }).catch(() => {})
  }, [teamProjetoIntegracao])

  const members = useMemo(
    () => boardMembers.filter(m => m.email && (!m.team || !currentTeam || m.team === currentTeam)),
    [boardMembers, currentTeam]
  )

  const [file, setFile]       = useState(null)
  const [review, setReview]   = useState(null)
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  // Vínculo com outro card
  const [vinculo, setVinculo]     = useState('novo') // 'novo' | 'relacionado' | 'filho'
  const [cardRefId, setCardRefId] = useState('')

  // Responsável
  const [assignedTo, setAssignedTo] = useState('')

  // Classificação
  const [prioridade, setPrioridade]   = useState('2 - Alto')
  const [tecnicoPerf, setTecnicoPerf] = useState('NÃO')
  const [marketplace, setMarketplace] = useState(MARKETPLACE_OPTS[0])
  const [dominio, setDominio]         = useState(DOMINIO_OPTS[0])
  const [subDominio, setSubDominio]   = useState('')
  const [origemHom, setOrigemHom]     = useState(ORIGEM_HOT_OPTS[0])
  const [causaRaiz, setCausaRaiz]     = useState(CAUSA_RAIZ_OPTS[0])

  const dominioSub = DOMINIO_SUBS[dominio] || null

  function handleDominioChange(val) {
    setDominio(val)
    const sub = DOMINIO_SUBS[val]
    setSubDominio(sub?.opts?.[0] || '')
  }

  function downloadTemplate() {
    const blob = new Blob([BUG_HOM_TEMPLATE], { type: 'text/markdown;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'bug-hom-template.md'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(incoming) {
    const f = Array.from(incoming).find(f => f.name.endsWith('.md'))
    if (!f) return
    setFile(f); setReview(null); setResult(null)
  }

  async function preencherCampos() {
    if (!file) return
    setLoading(true)
    try {
      const text = file.text
        ? await file.text()
        : await new Promise((res, rej) => {
            const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsText(file)
          })
      setReview(markdownToBugHom(text, file.name))
      setResult(null)
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
      const area = (() => {
        try { return JSON.parse(localStorage.getItem('sprint_board_session') || '{}').teamAreaPath || `${cfg.project}\\Marketplace Global` }
        catch { return `${cfg.project}\\Marketplace Global` }
      })()

      const prioridadeNum = parseInt(prioridade.match(/\d/)?.[0] || '2', 10)

      const patch = [
        { op: 'add', path: '/fields/System.Title',       value: review.title },
        { op: 'add', path: '/fields/System.Description', value: review.description },
        { op: 'add', path: '/fields/Custom.Comosimularoproblema',                  value: review.comoSimular },
        { op: 'add', path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',     value: review.acceptanceCriteria },
        { op: 'add', path: '/fields/Custom.Prioridade',                            value: prioridadeNum },
        { op: 'add', path: '/fields/Custom.ANY_TECNICO_PERFORMANCE_ESTABILIDADE',  value: tecnicoPerf },
        { op: 'add', path: '/fields/Custom.08289694-b2cc-4329-bd08-1481b39afa8f',  value: marketplace },
        { op: 'add', path: '/fields/Custom.Dominio_Any',                           value: dominio },
        ...(dominioSub && subDominio ? [{ op: 'add', path: '/fields/' + dominioSub.field, value: subDominio }] : []),
        { op: 'add', path: '/fields/Custom.c275abe4-37d0-475c-8bdf-ed551c63b585', value: origemHom },
        { op: 'add', path: '/fields/Custom.Causadoproblema',                       value: causaRaiz },
        { op: 'add', path: '/fields/Custom.Origemdeentrada',                       value: 'Engenharia' },
        { op: 'add', path: '/fields/Custom.Time',                                  value: 'Integrations - Marketplace' },
        { op: 'add', path: '/fields/Custom.Projeto_integracao',                    value: projetoIntegracao || 'ANY_GLOBAL' },
        { op: 'add', path: '/fields/System.State',         value: 'New' },
        { op: 'add', path: '/fields/System.AreaPath',      value: area },
        { op: 'add', path: '/fields/System.IterationPath', value: area },
        ...(assignedTo ? [{ op: 'add', path: '/fields/System.AssignedTo', value: assignedTo }] : []),
      ]

      const data  = await adoPost(`${ADO(cfg.org, cfg.project)}/workitems/$Bug%20Hom?api-version=7.1`, cfg.pat, patch)
      const newId = data.id

      // Vínculo com outro card
      const refId = parseInt(cardRefId.trim(), 10)
      if (refId && (vinculo === 'filho' || vinculo === 'relacionado')) {
        const rel = vinculo === 'filho'
          ? 'System.LinkTypes.Hierarchy-Reverse'
          : 'System.LinkTypes.Related'
        await adoPatch(
          `${ADO(cfg.org, cfg.project)}/workitems/${newId}?api-version=7.1`,
          cfg.pat,
          [{ op: 'add', path: '/relations/-', value: {
            rel,
            url: `https://dev.azure.com/${cfg.org}/${cfg.project}/_apis/wit/workItems/${refId}`,
            attributes: { comment: 'Vinculado via Sprint Board' },
          }}]
        )
      }

      const url = `https://dev.azure.com/${cfg.org}/${cfg.project}/_workitems/edit/${newId}`
      setResult({ ok: true, message: `Bug Hom #${newId} criado com sucesso!`, url })
    } catch (err) {
      console.error('[BugHomCreator]', err)
      setResult({ ok: false, message: err.message || 'Erro desconhecido.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Etapa 1: formulário ─────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 18 }}>
          Bug Hom — Azure DevOps
        </div>

        {/* Vínculo com outro card */}
        <div style={{ marginBottom: 14 }}>
          <LBL>Vínculo com outro card</LBL>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setVinculo('novo')}
              className={vinculo === 'novo' ? 'primary' : ''}
              style={{ fontSize: 12 }}
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Novo
            </button>
            <button
              onClick={() => setVinculo('relacionado')}
              className={vinculo === 'relacionado' ? 'primary' : ''}
              style={{ fontSize: 12 }}
            >
              <i className="ti ti-link" style={{ fontSize: 13 }} /> Somente relatar
            </button>
            <button
              onClick={() => setVinculo('filho')}
              className={vinculo === 'filho' ? 'primary' : ''}
              style={{ fontSize: 12 }}
            >
              <i className="ti ti-git-branch" style={{ fontSize: 13 }} /> Filho de outro card
            </button>
          </div>
          {(vinculo === 'filho' || vinculo === 'relacionado') && (
            <div style={{ marginTop: 10 }}>
              <LBL>{vinculo === 'filho' ? 'ID do card pai' : 'ID do card relacionado'}</LBL>
              <input
                value={cardRefId}
                onChange={e => setCardRefId(e.target.value)}
                placeholder="ex: 1923444"
                style={{ maxWidth: 260, fontSize: 12, fontFamily: 'monospace' }}
              />
            </div>
          )}
        </div>

        {/* Responsável + Projeto Integração */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <LBL>Responsável <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Assigned To)</span></LBL>
            {members.length > 0 ? (
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={{ fontSize: 12 }}>
                <option value="">— sem atribuição —</option>
                {members.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
              </select>
            ) : (
              <input
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                placeholder="email@empresa.com"
                style={{ fontSize: 12 }}
              />
            )}
          </div>
          <div>
            <LBL>Projeto Integração</LBL>
            <select value={projetoIntegracao} onChange={e => setProjetoIntegracao(e.target.value)} style={{ fontSize: 12 }}>
              {projetoIntegracaoOpts.length === 0
                ? <option value={projetoIntegracao}>{projetoIntegracao}</option>
                : projetoIntegracaoOpts.map(p => <option key={p} value={p}>{p}</option>)
              }
            </select>
          </div>
        </div>

        {/* Classificação */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <LBL>Prioridade</LBL>
            <select value={prioridade} onChange={e => setPrioridade(e.target.value)} style={{ fontSize: 12 }}>
              {PRIORIDADE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <LBL>Técnico / Performance / Estabilidade</LBL>
            <select value={tecnicoPerf} onChange={e => setTecnicoPerf(e.target.value)} style={{ fontSize: 12 }}>
              {TECNICO_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <LBL>Marketplace</LBL>
            <select value={marketplace} onChange={e => setMarketplace(e.target.value)} style={{ fontSize: 12 }}>
              {MARKETPLACE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <LBL>Domínio</LBL>
            <select value={dominio} onChange={e => handleDominioChange(e.target.value)} style={{ fontSize: 12 }}>
              {DOMINIO_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {dominioSub && (
            <div>
              <LBL>Sub-domínio <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({dominio})</span></LBL>
              {dominioSub.opts.length > 0 ? (
                <select value={subDominio} onChange={e => setSubDominio(e.target.value)} style={{ fontSize: 12 }}>
                  {dominioSub.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={subDominio} onChange={e => setSubDominio(e.target.value)} placeholder="Sub-domínio" style={{ fontSize: 12 }} />
              )}
            </div>
          )}
          <div>
            <LBL>Origem na homologação</LBL>
            <select value={origemHom} onChange={e => setOrigemHom(e.target.value)} style={{ fontSize: 12 }}>
              {ORIGEM_HOT_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <LBL>Causa raiz</LBL>
            <select value={causaRaiz} onChange={e => setCausaRaiz(e.target.value)} style={{ fontSize: 12 }}>
              {CAUSA_RAIZ_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Template */}
        <div style={{ marginBottom: 14 }}>
          <LBL>Template de exemplo</LBL>
          <button onClick={downloadTemplate} style={{ fontSize: 12 }}>
            <i className="ti ti-download" style={{ fontSize: 13 }} /> Baixar template Bug Hom (.md)
          </button>
        </div>

        {/* Upload */}
        <div style={{ marginBottom: 16 }}>
          <LBL>Arquivo Markdown (.md)</LBL>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files) }}
            onClick={() => {
              const inp = document.createElement('input')
              inp.type = 'file'; inp.accept = '.md'
              inp.onchange = e => handleFile(e.target.files); inp.click()
            }}
            style={{
              border: '2px dashed var(--border2)', borderRadius: 'var(--radius-lg)',
              padding: '24px 16px', cursor: 'pointer', textAlign: 'center',
              background: file ? 'var(--green-bg)' : 'var(--surface2)',
              transition: 'background .15s',
            }}
          >
            {!file ? (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                <i className="ti ti-upload" style={{ fontSize: 16, display: 'block', marginBottom: 6, opacity: 0.4 }} />
                Clique para selecionar ou arraste o arquivo .md
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <i className="ti ti-file-text" style={{ color: 'var(--green-tx)', fontSize: 13 }} />
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{file.name}</span>
                <button className="ghost" onClick={e => { e.stopPropagation(); setFile(null); setReview(null) }} style={{ padding: '1px 5px', fontSize: 11, color: 'var(--red-tx)' }}>
                  <i className="ti ti-x" />
                </button>
              </div>
            )}
          </div>
        </div>

        <button className="primary" onClick={preencherCampos} disabled={loading || !file} style={{ fontSize: 12 }}>
          {loading && !review
            ? <><i className="ti ti-loader spin" style={{ fontSize: 13 }} /> Lendo...</>
            : <>Preencher campos <i className="ti ti-arrow-right" style={{ fontSize: 13 }} /></>
          }
        </button>
      </div>

      {/* ── Etapa 2: review ─────────────────────────────────────────────── */}
      {review && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 16 }}>
            Review dos campos
          </div>

          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--blue-tx)', marginBottom: 4 }}>Título</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{review.title}</div>
          </div>

          <FieldReview label="Descrição (Resumo + Pontos de atenção)" value={review.description} />
          <FieldReview label="Como simular o problema" value={review.comoSimular} />
          <FieldReview label="Critérios de aceite" value={review.acceptanceCriteria} />

          {/* Classificação + metadados resumidos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              ['Prioridade',    prioridade],
              ['Técnico/Perf',  tecnicoPerf],
              ['Marketplace',   marketplace],
              ['Domínio',       dominio],
              ['Origem Hom.',   origemHom],
              ['Causa raiz',    causaRaiz],
              ['Responsável',   assignedTo || '—'],
              ['Projeto',       projetoIntegracao],
              ['Vínculo', vinculo === 'filho' ? `Filho de #${cardRefId || '?'}` : vinculo === 'relacionado' ? `Relacionado #${cardRefId || '?'}` : 'Novo (sem vínculo)'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

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
                ? <><i className="ti ti-loader spin" style={{ fontSize: 13 }} /> Criando...</>
                : <><i className="ti ti-device-floppy" style={{ fontSize: 13 }} /> Criar Bug Hom no Azure DevOps</>
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
