import { useState } from 'react'
import { marked } from 'marked'
import { createEntregaTecnica, updateWorkItemFields } from '@/domain/azureDevOps'

const TIPOS  = ['Melhoria Técnica', 'Bug', 'Refatoração']
const STATES = ['Em Análise', 'Em Desenvolvimento', 'Para Code Review', 'Em Code Review', 'Para Homologação', 'Em Homologação', 'Done']

const TEMPLATE_MD = `# [MARKETPLACE] [MÓDULO] — descrição objetiva da entrega

## System.Description

### 🔗 Referências

- Classes/métodos envolvidos:
- APIs ou endpoints relacionados:
- PRs ou issues de referência:

---

### 🎯 O que estamos resolvendo?

- Descrição objetiva do problema técnico

---

### 🔎 Pontos de atenção

- Riscos, impactos colaterais, dependências

---

## Custom.9ee04e26 (Solução Proposta)

### 📌 Premissas

- Condições técnicas que devem existir

---

### 📋 Requisitos

- Requisito 1
- Requisito 2

---

### ⚙️ Solução Proposta

- Descrição detalhada da implementação

---

### 🔄 Comportamento Esperado

- Como o sistema deve se comportar após a entrega

---

### ⚠️ Tratativas de Exceção

- Cenário de falha: recuperável ou irrecuperável

---

## Custom.STE (Sumário Técnico da Entrega)

Texto objetivo e direto descrevendo o que será feito.
Sem estrutura de tópicos — máximo 5 linhas.

---

## Microsoft.VSTS.Common.AcceptanceCriteria

### ✅ Critérios de Aceite

**Cenário 1 — [Nome do cenário de sucesso]**
- Dado [contexto]
- Quando [ação executada]
- Então [resultado esperado]

**Cenário 2 — [Nome do cenário de regressão]**
- Dado [contexto]
- Quando [condição]
- Então [comportamento esperado]

---

## Custom.ANY_ValorEntrega

### 💼 Valor da Entrega

Impacto técnico gerado: performance, manutenibilidade,
redução de débito técnico, estabilidade, etc.

---

## Custom.ANALISE_IMPACTO_SI_PRIVACIDADE_ANYTOOLS

### 🔒 Análise de Impacto — Segurança e Privacidade

N/A
`

// Mapeamento: header H2 do .md → campo Azure DevOps
// Os headers seguem exatamente o nome do campo no Azure DevOps
const FIELD_MAP = [
  { section: 'System.Description',                            path: '/fields/System.Description',                             label: 'Descrição',              html: true  },
  { section: 'Custom.9ee04e26 (Solução Proposta)',             path: '/fields/Custom.9ee04e26',                                label: 'Solução Proposta',        html: true  },
  { section: 'Custom.STE (Sumário Técnico da Entrega)',        path: '/fields/Custom.STE',                                     label: 'Sumário Técnico (STE)',   html: false },
  { section: 'Microsoft.VSTS.Common.AcceptanceCriteria',       path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',       label: 'Critérios de Aceite',     html: true  },
  { section: 'Custom.ANY_ValorEntrega',                        path: '/fields/Custom.ANY_ValorEntrega',                        label: 'Valor da Entrega',        html: false },
  { section: 'Custom.ANALISE_IMPACTO_SI_PRIVACIDADE_ANYTOOLS', path: '/fields/Custom.ANALISE_IMPACTO_SI_PRIVACIDADE_ANYTOOLS', label: 'Segurança e Privacidade', html: false },
]

function parseMarkdown(raw) {
  // Normaliza CRLF → LF para garantir compatibilidade entre SOs
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const sections = {}
  // Título: primeira linha H1
  const h1 = text.match(/^# (.+)$/m)
  if (h1) sections['__title__'] = h1[1].trim()
  // Seções: headers H2 — cada um mapeia para um campo Azure DevOps
  const parts = text.split(/^## /m)
  for (const part of parts) {
    const nl = part.indexOf('\n')
    if (nl === -1) continue
    const key = part.slice(0, nl).trim()
    const content = part.slice(nl + 1).trim()
    if (key) sections[key] = content
  }
  return sections
}

function mdToHtml(text) {
  if (!text) return ''
  // Remove separadores --- que ficam sobrando entre seções do template
  const clean = text.replace(/^---+\s*$/gm, '').trim()
  return marked.parse(clean)
}

function mdToPlain(text) {
  if (!text) return ''
  // Remove separadores, headers markdown e retorna texto limpo
  return text
    .replace(/^---+\s*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()
}

function getAzureConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('sprint-board-config') || '{}')
    return { org: cfg.azureOrg || '', project: cfg.azureProject || 'ANYMARKET', pat: cfg.azurePat || '' }
  } catch {
    return { org: '', project: 'ANYMARKET', pat: '' }
  }
}

const LBL = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
    {children}
  </div>
)

// ── Componente de review de um campo ─────────────────────────────────────────
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
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '8px 12px',
        fontSize: 12, color: empty ? 'var(--text3)' : 'var(--text2)',
        fontStyle: empty ? 'italic' : 'normal',
        whiteSpace: 'pre-wrap', lineHeight: 1.6,
        maxHeight: 120, overflowY: 'auto',
      }}>
        {empty ? '(não preenchido no .md)' : value}
      </div>
    </div>
  )
}

export default function EntregaTecnicaCreator() {
  const [mode, setMode]           = useState('criar')
  const [tipo, setTipo]           = useState('Melhoria Técnica')
  const [state, setState]         = useState('Em Análise')
  const [parentId, setParentId]   = useState('')
  const [workItemId, setWorkItemId] = useState('')
  const [files, setFiles]         = useState([])
  const [review, setReview]       = useState(null)   // { title, sections } — etapa 2
  const [result, setResult]       = useState(null)   // { ok, message, url } — etapa 3
  const [loading, setLoading]     = useState(false)

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_MD], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'entrega-tecnica-template.md'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleFiles(incoming) {
    const mds = Array.from(incoming).filter(f => f.name.endsWith('.md'))
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...mds.filter(f => !names.has(f.name))]
    })
    setReview(null)
    setResult(null)
  }

  // Etapa 1 → parseia e mostra review
  async function preencherCampos() {
    if (!files.length) return
    setLoading(true)
    try {
      const text = await files[0].text()
      const sections = parseMarkdown(text)
      const title = sections['__title__'] || files[0].name.replace('.md', '')
      setReview({ title, sections })
      setResult(null)
    } catch (err) {
      setResult({ ok: false, message: 'Erro ao ler o arquivo: ' + err.message })
    }
    setLoading(false)
  }

  // Etapa 2 → cria/atualiza no Azure DevOps
  async function confirmarCriacao() {
    if (!review) return
    setLoading(true)
    setResult(null)
    const cfg = getAzureConfig()
    if (!cfg.org || !cfg.pat) {
      setResult({ ok: false, message: 'Configure org e PAT do Azure DevOps em Configuração.' })
      setLoading(false); return
    }
    try {
      let fields = [
        { path: '/fields/System.Title', value: review.title || files[0]?.name.replace('.md', '') },
        ...FIELD_MAP.map(({ section, path, html }) => ({
          path,
          value: html
            ? mdToHtml(review.sections[section] || '')
            : mdToPlain(review.sections[section] || ''),
        })),
      ]

      const skipped = []
      async function tryCall(retries = 0) {
        if (retries > 10) throw new Error('Muitas tentativas — verifique os campos e o PAT.')
        try {
          if (mode === 'criar') {
            const numId = parentId.trim() ? parseInt(parentId.trim(), 10) : null
            return await createEntregaTecnica(fields, numId, cfg)
          } else {
            const id = parseInt(workItemId.trim(), 10)
            if (!id) throw new Error('ID do work item inválido.')
            return await updateWorkItemFields(id, fields, cfg)
          }
        } catch (err) {
          // Só faz retry quando Azure diz explicitamente que o campo não existe (TF51535)
          const match = /TF51535[^"]*Cannot find field ([\w.]+)|Cannot find field ([\w.]+)\./i.exec(err.message || '')
          const badField = (match?.[1] || match?.[2])?.replace(/\.$/, '')
          if (badField) {
            const badPath = '/fields/' + badField
            if (fields.some(f => f.path === badPath)) {
              skipped.push(badField)
              fields = fields.filter(f => f.path !== badPath)
              if (fields.length === 0) throw new Error('Nenhum campo válido restou após remover campos inválidos.')
              return tryCall(retries + 1)
            }
          }
          throw err
        }
      }

      const wi = await tryCall()
      if (!wi || !wi.id) throw new Error('Azure DevOps não retornou o ID do work item criado.')
      const url = `https://dev.azure.com/${cfg.org}/${cfg.project}/_workitems/edit/${wi.id}`
      const skipMsg = skipped.length ? ` Campos ignorados (não existem neste projeto): ${skipped.join(', ')}.` : ''
      setResult({ ok: true, message: `Work item #${wi.id} ${mode === 'criar' ? 'criado' : 'atualizado'} com sucesso!${skipMsg}`, url })
    } catch (err) {
      console.error('[EntregaTecnica] erro ao criar/atualizar:', err)
      setResult({ ok: false, message: err.message || 'Erro desconhecido.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Etapa 1: formulário ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 18 }}>
          Entrega Técnica — Azure DevOps
        </div>

        {/* MODO */}
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
              <LBL>ID da Feature Pai <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></LBL>
              <input value={parentId} onChange={e => setParentId(e.target.value)} placeholder="ex: 1923444" style={{ maxWidth: 260, fontSize: 12, fontFamily: 'monospace' }} />
            </>
          ) : (
            <>
              <LBL>ID do Work Item</LBL>
              <input value={workItemId} onChange={e => setWorkItemId(e.target.value)} placeholder="ex: 2041337" style={{ maxWidth: 260, fontSize: 12, fontFamily: 'monospace' }} />
            </>
          )}
        </div>

        {/* Tipo + State */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <LBL>Tipo da entrega</LBL>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ fontSize: 12 }}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <LBL>State</LBL>
            <select value={state} onChange={e => setState(e.target.value)} style={{ fontSize: 12 }}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Template */}
        <div style={{ marginBottom: 14 }}>
          <LBL>Template de exemplo</LBL>
          <button onClick={downloadTemplate} style={{ fontSize: 12 }}>
            <i className="ti ti-download" style={{ fontSize: 13 }} /> Baixar template Entrega Técnica (.md)
          </button>
        </div>

        {/* Upload */}
        <div style={{ marginBottom: 16 }}>
          <LBL>Arquivos Markdown (.md)</LBL>
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
                Clique para selecionar ou arraste um ou mais arquivos .md
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

      {/* ── Etapa 2: review dos campos extraídos ── */}
      {review && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 16 }}>
            Review dos campos
          </div>

          {/* Título */}
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--blue-bg)', border: '1px solid var(--blue-bd)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--blue-tx)', marginBottom: 4 }}>Título</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{review.title}</div>
          </div>

          {/* Seções mapeadas */}
          {FIELD_MAP.map(({ section, label }) => (
            <FieldReview key={section} label={label} value={review.sections[section] || ''} />
          ))}

          {/* Resultado */}
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
                : <><i className="ti ti-device-floppy" style={{ fontSize: 13 }} /> {mode === 'criar' ? 'Criar no Azure DevOps' : 'Atualizar no Azure DevOps'}</>
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
