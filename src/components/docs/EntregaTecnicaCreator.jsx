import { useState, useRef } from 'react'
import { createEntregaTecnica, updateWorkItemFields } from '@/domain/azureDevOps'

const TIPOS = ['Melhoria Técnica', 'Bug', 'Refatoração']

const ET_STATES = [
  'Em Análise',
  'Em Desenvolvimento',
  'Para Code Review',
  'Em Code Review',
  'Para Homologação',
  'Em Homologação',
  'Done',
]

// ── Template .md para download ────────────────────────────────────────────────
const TEMPLATE_MD = `---
tipo: Melhoria Técnica
---

### Título
[MARKETPLACE] [MÓDULO] — descrição objetiva da entrega

### System.Description
🔗 Referências
- Classes/métodos envolvidos:
- APIs ou endpoints relacionados:
- PRs ou issues de referência:

🎯 O que estamos resolvendo?
- Descrição objetiva do problema técnico

🔎 Pontos de atenção
- Riscos, impactos colaterais, dependências

### Solução Proposta
📌 Premissas
- Condições técnicas que devem existir

📋 Requisitos
- Requisito 1
- Requisito 2

⚙️ Solução Proposta
- Descrição detalhada da implementação

🔄 Comportamento Esperado
- Como o sistema deve se comportar após a entrega

⚠️ Tratativas de Exceção
- Cenário de falha: recuperável ou irrecuperável

### Sumário Técnico (STE)
Texto objetivo e direto descrevendo o que será feito.
Sem estrutura de tópicos — máximo 5 linhas.

### Critérios de Aceite
✅ Critérios de Aceite

Cenário 1 — [Nome do cenário de sucesso]
- Dado [contexto]
- Quando [ação executada]
- Então [resultado esperado]

Cenário 2 — [Nome do cenário de regressão]
- Dado [contexto]
- Quando [condição]
- Então [comportamento esperado]

### Valor da Entrega
💼 Valor da Entrega
Impacto técnico gerado: performance, manutenibilidade,
redução de débito técnico, estabilidade, etc.

### Segurança e Privacidade
🔒 Análise de Impacto — Segurança e Privacidade
N/A
`

// ── Parsing do markdown ───────────────────────────────────────────────────────
function parseMarkdown(text) {
  const sections = {}
  const parts = text.split(/^### /m)
  for (const part of parts) {
    const nl = part.indexOf('\n')
    if (nl === -1) continue
    const header = part.slice(0, nl).trim()
    const content = part.slice(nl + 1).trim()
    sections[header] = content
  }
  return sections
}

function mdToHtml(text) {
  if (!text) return ''
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const lines = escaped.split('\n')
  return '<div>' + lines.map(l => l.trim() ? `<p>${l}</p>` : '').join('') + '</div>'
}

function getAzureConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('sprint-board-config') || '{}')
    return { org: cfg.azureOrg || '', project: cfg.azureProject || 'ANYMARKET', pat: cfg.azurePat || '' }
  } catch {
    return { org: '', project: 'ANYMARKET', pat: '' }
  }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function EntregaTecnicaCreator() {
  const [mode, setMode]           = useState('criar')   // 'criar' | 'atualizar'
  const [tipo, setTipo]           = useState('Melhoria Técnica')
  const [state, setState]         = useState('Em Análise')
  const [parentId, setParentId]   = useState('')
  const [workItemId, setWorkItemId] = useState('')
  const [files, setFiles]         = useState([])
  const [result, setResult]       = useState(null)      // { ok, message, url }
  const [loading, setLoading]     = useState(false)
  const dropRef = useRef(null)

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_MD], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'entrega-tecnica-template.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFiles(incoming) {
    const mds = Array.from(incoming).filter(f => f.name.endsWith('.md'))
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...mds.filter(f => !names.has(f.name))]
    })
  }

  function removeFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  async function submit() {
    if (!files.length) return
    setLoading(true)
    setResult(null)
    const cfg = getAzureConfig()
    if (!cfg.org || !cfg.pat) {
      setResult({ ok: false, message: 'Configure org e PAT do Azure DevOps em Configuração.' })
      setLoading(false)
      return
    }

    try {
      const text = await files[0].text()
      const sections = parseMarkdown(text)

      const title = sections['Título'] || files[0].name.replace('.md', '')
      const fields = [
        { path: '/fields/System.Title',                                          value: title },
        { path: '/fields/System.Description',                                    value: mdToHtml(sections['System.Description'] || '') },
        { path: '/fields/Custom.9ee04e26',                                       value: mdToHtml(sections['Solução Proposta'] || '') },
        { path: '/fields/Custom.STE',                                            value: sections['Sumário Técnico (STE)'] || '' },
        { path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',              value: mdToHtml(sections['Critérios de Aceite'] || '') },
        { path: '/fields/Custom.ANY_ValorEntrega',                               value: sections['Valor da Entrega'] || '' },
        { path: '/fields/Custom.ANALISE_IMPACTO_SI_PRIVACIDADE_ANYTOOLS',        value: sections['Segurança e Privacidade'] || 'N/A' },
        { path: '/fields/Custom.ANY_Tipo_entrega_tecnica',                       value: tipo },
        { path: '/fields/System.State',                                          value: state },
        { path: '/fields/System.AreaPath',                                       value: `${cfg.project}\\Marketplace Global` },
      ]

      let url
      if (mode === 'criar') {
        const numId = parentId.trim() ? parseInt(parentId.trim(), 10) : null
        const wi = await createEntregaTecnica(fields, numId, cfg)
        url = `https://dev.azure.com/${cfg.org}/${cfg.project}/_workitems/edit/${wi.id}`
        setResult({ ok: true, message: `Work item #${wi.id} criado com sucesso!`, url })
      } else {
        const id = parseInt(workItemId.trim(), 10)
        if (!id) throw new Error('ID do work item inválido.')
        await updateWorkItemFields(id, fields, cfg)
        url = `https://dev.azure.com/${cfg.org}/${cfg.project}/_workitems/edit/${id}`
        setResult({ ok: true, message: `Work item #${id} atualizado com sucesso!`, url })
      }
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Erro desconhecido.' })
    }
    setLoading(false)
  }

  const LBL = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
      {children}
    </div>
  )

  const SegBtn = ({ active, onClick, icon, children }) => (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px', fontSize: 13, borderRadius: 8, border: '1.5px solid',
        borderColor: active ? 'var(--navy)' : 'var(--border2)',
        background: active ? 'var(--navy)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text2)',
        fontWeight: active ? 600 : 400,
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      }}
    >
      {icon && <i className={'ti ' + icon} style={{ fontSize: 14 }} />}
      {children}
    </button>
  )

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* MODO */}
      <div>
        <LBL>Modo</LBL>
        <div style={{ display: 'flex', gap: 8 }}>
          <SegBtn active={mode === 'criar'}     onClick={() => setMode('criar')}     icon="ti-plus">+ Criar novo</SegBtn>
          <SegBtn active={mode === 'atualizar'} onClick={() => setMode('atualizar')} icon="ti-pencil">✎ Atualizar existente</SegBtn>
        </div>
      </div>

      {/* IDs */}
      {mode === 'criar' ? (
        <div>
          <LBL>ID da Feature Pai <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span></LBL>
          <input
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            placeholder="ex: 1923444"
            style={{ maxWidth: 300 }}
          />
        </div>
      ) : (
        <div>
          <LBL>ID do Work Item</LBL>
          <input
            value={workItemId}
            onChange={(e) => setWorkItemId(e.target.value)}
            placeholder="ex: 2041337"
            style={{ maxWidth: 300 }}
          />
        </div>
      )}

      {/* TIPO + STATE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <LBL>Tipo da Entrega</LBL>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: '100%' }}>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <LBL>State</LBL>
          <select value={state} onChange={(e) => setState(e.target.value)} style={{ width: '100%' }}>
            {ET_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* TEMPLATE */}
      <div>
        <LBL>Template de Exemplo</LBL>
        <button
          onClick={downloadTemplate}
          style={{
            padding: '7px 16px', fontSize: 12, borderRadius: 8,
            border: '1px solid var(--border2)', background: 'var(--surface)',
            color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}
        >
          <i className="ti ti-download" style={{ fontSize: 13 }} />
          Baixar template Entrega Técnica (.md)
        </button>
      </div>

      {/* UPLOAD */}
      <div>
        <LBL>Arquivos Markdown (.md)</LBL>
        <div
          ref={dropRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => {
            const inp = document.createElement('input')
            inp.type = 'file'
            inp.accept = '.md'
            inp.multiple = true
            inp.onchange = (e) => handleFiles(e.target.files)
            inp.click()
          }}
          style={{
            border: '2px dashed var(--border2)', borderRadius: 10,
            padding: '32px 20px', cursor: 'pointer',
            background: files.length ? 'var(--green-bg)' : 'var(--surface2)',
            transition: 'background .2s',
            textAlign: 'center',
          }}
        >
          {files.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>
              Clique para selecionar ou arraste um ou mais arquivos .md
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', textAlign: 'left' }}>
              {files.map(f => (
                <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-file-text" style={{ color: 'var(--green-tx)', fontSize: 14 }} />
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{f.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.name) }}
                    style={{ background: 'none', border: 'none', color: 'var(--red-tx)', cursor: 'pointer', padding: '0 4px', fontSize: 13 }}
                  >
                    <i className="ti ti-x" />
                  </button>
                </div>
              ))}
              <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Clique para adicionar mais</span>
            </div>
          )}
        </div>
      </div>

      {/* RESULTADO */}
      {result && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, fontSize: 13,
          background: result.ok ? 'var(--green-bg)' : 'var(--red-bg)',
          border: '1px solid ' + (result.ok ? 'var(--green-bd)' : 'var(--red-bd)'),
          color: result.ok ? 'var(--green-tx)' : 'var(--red-tx)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <i className={'ti ' + (result.ok ? 'ti-circle-check' : 'ti-circle-x')} style={{ fontSize: 18, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600 }}>{result.message}</div>
            {result.url && (
              <a href={result.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--green-tx)', marginTop: 2, display: 'block' }}>
                Abrir no Azure DevOps ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* BOTÃO */}
      <button
        onClick={submit}
        disabled={loading || files.length === 0}
        style={{
          padding: '12px 0', fontSize: 14, fontWeight: 700,
          borderRadius: 10, border: 'none', cursor: files.length ? 'pointer' : 'not-allowed',
          background: files.length ? 'var(--navy)' : 'var(--border2)',
          color: files.length ? '#fff' : 'var(--text3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background .2s',
        }}
      >
        {loading
          ? <><i className="ti ti-loader spin" style={{ fontSize: 16 }} /> Criando no Azure DevOps...</>
          : <>Preencher campos <i className="ti ti-arrow-right" style={{ fontSize: 15 }} /></>
        }
      </button>

    </div>
  )
}
