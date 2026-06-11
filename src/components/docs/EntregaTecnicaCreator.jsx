import { useState } from 'react'
import { createEntregaTecnica, updateWorkItemFields } from '@/domain/azureDevOps'

const TIPOS  = ['Melhoria Técnica', 'Bug', 'Refatoração']
const STATES = ['Em Análise', 'Em Desenvolvimento', 'Para Code Review', 'Em Code Review', 'Para Homologação', 'Em Homologação', 'Done']

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

function parseMarkdown(text) {
  const sections = {}
  const parts = text.split(/^### /m)
  for (const part of parts) {
    const nl = part.indexOf('\n')
    if (nl === -1) continue
    sections[part.slice(0, nl).trim()] = part.slice(nl + 1).trim()
  }
  return sections
}

function mdToHtml(text) {
  if (!text) return ''
  return '<div>' + text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .split('\n').map(l => l.trim() ? `<p>${l}</p>` : '').join('') + '</div>'
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

export default function EntregaTecnicaCreator() {
  const [mode, setMode]           = useState('criar')
  const [tipo, setTipo]           = useState('Melhoria Técnica')
  const [state, setState]         = useState('Em Análise')
  const [parentId, setParentId]   = useState('')
  const [workItemId, setWorkItemId] = useState('')
  const [files, setFiles]         = useState([])
  const [result, setResult]       = useState(null)
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
  }

  async function submit() {
    if (!files.length) return
    setLoading(true); setResult(null)
    const cfg = getAzureConfig()
    if (!cfg.org || !cfg.pat) {
      setResult({ ok: false, message: 'Configure org e PAT do Azure DevOps em Configuração.' })
      setLoading(false); return
    }
    try {
      const sections = parseMarkdown(await files[0].text())
      const title = sections['Título'] || files[0].name.replace('.md', '')
      const fields = [
        { path: '/fields/System.Title',                                   value: title },
        { path: '/fields/System.Description',                             value: mdToHtml(sections['System.Description'] || '') },
        { path: '/fields/Custom.9ee04e26',                                value: mdToHtml(sections['Solução Proposta'] || '') },
        { path: '/fields/Custom.STE',                                     value: sections['Sumário Técnico (STE)'] || '' },
        { path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',       value: mdToHtml(sections['Critérios de Aceite'] || '') },
        { path: '/fields/Custom.ANY_ValorEntrega',                        value: sections['Valor da Entrega'] || '' },
        { path: '/fields/Custom.ANALISE_IMPACTO_SI_PRIVACIDADE_ANYTOOLS', value: sections['Segurança e Privacidade'] || 'N/A' },
        { path: '/fields/Custom.ANY_Tipo_entrega_tecnica',                value: tipo },
        { path: '/fields/System.State',                                   value: state },
        { path: '/fields/System.AreaPath',                                value: `${cfg.project}\\Marketplace Global` },
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

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Card principal */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px' }}>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 18 }}>
          Entrega Técnica — Azure DevOps
        </div>

        {/* MODO */}
        <div style={{ marginBottom: 14 }}>
          <LBL>Modo</LBL>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setMode('criar')}
              className={mode === 'criar' ? 'primary' : ''}
              style={{ fontSize: 12 }}
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} /> Criar novo
            </button>
            <button
              onClick={() => setMode('atualizar')}
              className={mode === 'atualizar' ? 'primary' : ''}
              style={{ fontSize: 12 }}
            >
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
                    <button
                      className="ghost"
                      onClick={e => { e.stopPropagation(); setFiles(p => p.filter(x => x.name !== f.name)) }}
                      style={{ padding: '1px 5px', fontSize: 11, color: 'var(--red-tx)' }}
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ))}
                <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Clique para adicionar mais</span>
              </div>
            )}
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 12, marginBottom: 14,
            background: result.ok ? 'var(--green-bg)' : 'var(--red-bg)',
            border: '1px solid ' + (result.ok ? 'var(--green-bd)' : 'var(--red-bd)'),
            color: result.ok ? 'var(--green-tx)' : 'var(--red-tx)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <i className={'ti ' + (result.ok ? 'ti-circle-check' : 'ti-circle-x')} style={{ fontSize: 16, flexShrink: 0 }} />
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

        {/* Ações */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" onClick={submit} disabled={loading || !files.length} style={{ fontSize: 12 }}>
            {loading
              ? <><i className="ti ti-loader spin" style={{ fontSize: 13 }} /> Criando...</>
              : <><i className="ti ti-device-floppy" style={{ fontSize: 13 }} /> Preencher campos</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}
