import { useState, useRef } from 'react'
import { marked } from 'marked'

// ── Config helpers ────────────────────────────────────────────────────────────

function getAzureConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('sprint-board-config') || '{}')
    return { org: cfg.azureOrg || '', project: cfg.azureProject || 'ANYMARKET', pat: cfg.azurePat || '' }
  } catch {
    return { org: '', project: 'ANYMARKET', pat: '' }
  }
}

function getAnthropicKey() {
  try { return JSON.parse(localStorage.getItem('sprint-board-config') || '{}').anthropicKey || '' } catch { return '' }
}

function adoHeaders(pat) {
  return { Authorization: 'Basic ' + btoa(':' + pat), 'Content-Type': 'application/json-patch+json' }
}

function adoGetHeaders(pat) {
  return { Authorization: 'Basic ' + btoa(':' + pat) }
}

async function fetchWorkItem(org, project, pat, id) {
  const url = `/azure-api/${org}/${project}/_apis/wit/workitems/${id}?api-version=7.0&$expand=fields`
  const res = await fetch(url, { headers: adoGetHeaders(pat) })
  if (!res.ok) throw new Error(`Erro ${res.status} ao buscar work item`)
  return res.json()
}

async function fetchFieldAllowedValues(org, project, pat, fieldName) {
  // 1. Busca a definição do campo — pode ter allowedValues ou picklistId
  const url1 = `/azure-api/${org}/_apis/wit/fields/${fieldName}?api-version=7.0`
  const res1 = await fetch(url1, { headers: adoGetHeaders(pat) })
  if (res1.ok) {
    const f = await res1.json()
    if (f.allowedValues?.length > 0) return f.allowedValues
    if (f.picklistId) {
      const url2 = `/azure-api/${org}/_apis/work/processes/lists/${f.picklistId}?api-version=7.2-preview.1`
      const res2 = await fetch(url2, { headers: adoGetHeaders(pat) })
      if (res2.ok) {
        const pl = await res2.json()
        return (pl.items || []).map(i => i.value ?? i).filter(Boolean)
      }
    }
  }
  // 2. Fallback: tenta via work item type do projeto
  const url3 = `/azure-api/${org}/${project}/_apis/wit/workitemtypes/Product%20Backlog%20Item/fields/${fieldName}?api-version=7.0`
  const res3 = await fetch(url3, { headers: adoGetHeaders(pat) })
  if (res3.ok) {
    const f3 = await res3.json()
    if (f3.allowedValues?.length > 0) return f3.allowedValues
  }
  return []
}

async function patchWorkItem(org, project, pat, id, ops) {
  const url = `/azure-api/${org}/${project}/_apis/wit/workitems/${id}?api-version=7.0`
  const res = await fetch(url, { method: 'PATCH', headers: adoHeaders(pat), body: JSON.stringify(ops) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `Erro ${res.status}`
    try { const j = JSON.parse(text); msg = j.message || msg } catch { msg = text.slice(0, 300) || msg }
    throw new Error(msg)
  }
  return res.json()
}

// ── MD Parser ─────────────────────────────────────────────────────────────────

function normalizeHeading(text) {
  return text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[^\w\sáàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ?.)/]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractSection(md, pattern) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let inside = false, level = 0
  const captured = []
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*)/)
    if (m) {
      const lvl = m[1].length
      const txt = normalizeHeading(m[2])
      if (!inside) { if (pattern.test(txt)) { inside = true; level = lvl } }
      else { if (lvl <= level) break; captured.push(line) }
    } else if (inside) { captured.push(line) }
  }
  return captured.join('\n').trim()
}

function toHtml(md) {
  if (!md || !md.trim()) return ''
  return marked.parse(md)
}

function parseMd(md) {
  return {
    impactoPartes:      extractSection(md, /partes.+any|partes.+impactadas|impactadas/i),
    riscos:             extractSection(md, /riscos.+impacto|como.+riscos/i),
    planoImpl:          extractSection(md, /plano\s+de\s+implementa/i),
    planoRetorno:       extractSection(md, /plano\s+de\s+retorno|monitoramento/i),
    planoRollback:      extractSection(md, /plano\s+de\s+rollback|rollback/i),
    comunicacaoDetalhe: extractSection(md, /plano\s+de\s+comunica/i),
    mitigarImpacto:     extractSection(md, /mitigar|eliminar\s+impacto|plano\s+de\s+a..o/i),
    pessoas:            extractSection(md, /pessoas\s+envolvidas|pessoas/i),
    timesImpactados:    extractSection(md, /times\s+impactados/i),
    funcCriticas:       extractSection(md, /funcionalidades\s+cr.ticas/i),
    alteracaoCampos:    extractSection(md, /altera..o\s+de\s+campos/i),
  }
}

// ── Campos GMUD → ADO ─────────────────────────────────────────────────────────

const DROPDOWN_FIELDS = [
  { key: 'criterio',    field: 'Custom.Any_gmud_criterio_critico',  label: 'A alteração pode afetar ou gerar' },
  { key: 'impacto',     field: 'Custom.Any_gmud_impacto_esperado',  label: '2.1) Nível de impacto esperado', required: true },
  { key: 'comunicacao', field: 'Custom.Any_gmud_comunicacao',       label: '4) Sobre a comunicação da mudança' },
]

const TEXT_FIELDS = [
  { key: 'impactoPartes',      field: 'Custom.any_gmud_impacto_partes_any',              label: '2) Quais partes do ANY serão impactadas?' },
  { key: 'riscos',             field: 'Custom.Any_gmud_riscos_impacto',                  label: '2.2) Como os riscos serão tratados?' },
  { key: 'planoImpl',          field: 'Custom.49cce830-46a6-47b7-83f9-5bcf15a7fabb',    label: 'Plano de Implementação' },
  { key: 'planoRetorno',       field: 'Custom.c587645d-edbe-43a9-8e67-40b8c0950914',    label: 'Plano de Retorno (Monitoramento e riscos)' },
  { key: 'planoRollback',      field: 'Custom.a77f61e2-3ce8-442d-a08a-cec6045c4eab',    label: 'Plano de Rollback' },
  { key: 'comunicacaoDetalhe', field: 'Custom.Any_gmud_comunicacao_detalhamento_',       label: '4.1) Plano de comunicação' },
  { key: 'mitigarImpacto',     field: 'Custom.any_gmud_detalhamento_impacto',            label: '5.1) Plano de ação — mitigar impacto negativo' },
  { key: 'pessoas',            field: 'Custom.any_gmud_time_necessario',                 label: '6) Pessoas envolvidas' },
  { key: 'timesImpactados',    field: 'Custom.any_gmud_times_impacto',                   label: 'Times impactados' },
  { key: 'funcCriticas',       field: 'Custom.any_gmud_funcionalidades_criticas',        label: 'Funcionalidades críticas' },
  { key: 'alteracaoCampos',    field: 'Custom.Any_gmud_alteracao_campos',                label: 'Alteração de campos' },
]

// ── UI helpers ────────────────────────────────────────────────────────────────

const LBL = ({ children, required }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
    {children}{required && <span style={{ color: 'var(--danger, #e53e3e)', marginLeft: 3 }}>*</span>}
  </div>
)

// ── Componente principal ──────────────────────────────────────────────────────

export default function GmudCreator() {
  const [wiId, setWiId]           = useState('')
  const [workItem, setWorkItem]   = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')

  const [dropdownOpts, setDropdownOpts] = useState({})   // { criterio: [], impacto: [], comunicacao: [] }
  const [dropdownSel, setDropdownSel]   = useState({})   // { criterio: '', impacto: '', comunicacao: '' }

  const [mdFields, setMdFields]   = useState(null)       // parsed from uploaded .md
  const [fileName, setFileName]   = useState('')
  const [mdErr, setMdErr]         = useState('')

  const [taskExpanded, setTaskExpanded] = useState(false)
  const [review, setReview]       = useState(null)
  const [sending, setSending]     = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genErr, setGenErr]       = useState('')
  const [result, setResult]       = useState(null)
  const fileRef = useRef(null)

  // ── Buscar work item ────────────────────────────────────────────────────────

  async function handleSearch() {
    const id = wiId.trim()
    if (!id) return
    setSearching(true)
    setSearchErr('')
    setWorkItem(null)
    setDropdownOpts({})
    setDropdownSel({})
    setMdFields(null)
    setResult(null)

    const { org, project, pat } = getAzureConfig()
    if (!org || !pat) { setSearchErr('Configure o Azure DevOps em Configuração antes de continuar.'); setSearching(false); return }

    try {
      const wi = await fetchWorkItem(org, project, pat, id)
      setWorkItem(wi)

      const wiType = wi.fields?.['System.WorkItemType'] || 'Product Backlog Item'

      const [criterioOpts, impactoOpts, comunicacaoOpts] = await Promise.all([
        fetchFieldAllowedValues(org, project, pat, 'Custom.Any_gmud_criterio_critico', wiType),
        fetchFieldAllowedValues(org, project, pat, 'Custom.Any_gmud_impacto_esperado', wiType),
        fetchFieldAllowedValues(org, project, pat, 'Custom.Any_gmud_comunicacao', wiType),
      ])

      setDropdownOpts({ criterio: criterioOpts, impacto: impactoOpts, comunicacao: comunicacaoOpts })

      const existing = wi.fields || {}
      setDropdownSel({
        criterio:    existing['Custom.Any_gmud_criterio_critico']  || '',
        impacto:     existing['Custom.Any_gmud_impacto_esperado']  || '',
        comunicacao: existing['Custom.Any_gmud_comunicacao']       || '',
      })
    } catch (err) {
      setSearchErr(err.message)
    } finally {
      setSearching(false)
    }
  }

  // ── Upload .md ──────────────────────────────────────────────────────────────

  function handleFile(file) {
    if (!file) return
    setMdErr('')
    if (!file.name.endsWith('.md')) { setMdErr('Selecione um arquivo .md'); return }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target.result
      const parsed = parseMd(text)
      setMdFields(parsed)
    }
    reader.readAsText(file)
  }

  // ── Gerar GMUD por IA ───────────────────────────────────────────────────────

  async function handleGenerateAI() {
    if (!workItem) return
    const apiKey = getAnthropicKey()
    if (!apiKey) { setGenErr('Configure a chave da API Anthropic em Configuração → Integrações.'); return }

    setGenerating(true)
    setGenErr('')
    setMdFields(null)
    setFileName('')

    const fields = workItem.fields || {}
    const pbiContent = [
      `Título: ${fields['System.Title'] || ''}`,
      `Tipo: ${fields['System.WorkItemType'] || ''}`,
      `Estado: ${fields['System.State'] || ''}`,
      fields['System.Description'] ? `\nDescrição:\n${fields['System.Description'].replace(/<[^>]*>/g, ' ')}` : '',
      fields['Custom.9ee04e26-297a-4523-a62d-0e6b433c9ed7'] ? `\nSolução Proposta:\n${fields['Custom.9ee04e26-297a-4523-a62d-0e6b433c9ed7'].replace(/<[^>]*>/g, ' ')}` : '',
      fields['Microsoft.VSTS.Common.AcceptanceCriteria'] ? `\nCritérios de Aceite:\n${fields['Microsoft.VSTS.Common.AcceptanceCriteria'].replace(/<[^>]*>/g, ' ')}` : '',
      fields['Custom.ANY_ValorEntrega'] ? `\nValor da Entrega:\n${fields['Custom.ANY_ValorEntrega'].replace(/<[^>]*>/g, ' ')}` : '',
    ].filter(Boolean).join('\n')

    const prompt = `Você é um especialista em documentação de mudanças (GMUD) para sistemas de marketplace.

Com base nas informações do PBI abaixo, preencha cada seção da GMUD em formato Markdown.
Retorne APENAS um JSON válido com as chaves abaixo, sem texto adicional antes ou depois.
Para cada campo, escreva o conteúdo em Markdown puro (sem HTML).
Se não houver informação suficiente para um campo, retorne string vazia "".

Campos esperados no JSON:
- impactoPartes: Quais partes do ANYMARKET serão impactadas (sistemas, APIs, tabelas, migrations)
- riscos: Como os riscos do impacto serão tratados (tabela risco x mitigação)
- planoImpl: Plano de implementação (pré-condições e sequência de deploy)
- planoRetorno: Plano de retorno — monitoramento, métricas de sucesso e riscos pós-deploy
- planoRollback: Plano de rollback (condição para acionar e passos)
- comunicacaoDetalhe: Plano de comunicação (tabela: quem, quando, o que comunicar)
- mitigarImpacto: Plano de ação para mitigar/eliminar impacto negativo (tabela)
- pessoas: Pessoas envolvidas (PO: Vitor Hugo Borrasca; dev e homologador se disponíveis)
- timesImpactados: Times impactados pela mudança
- funcCriticas: Funcionalidades críticas afetadas
- alteracaoCampos: Alteração de campos no sistema

PBI:
${pbiContent}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `Erro ${res.status}`)
      }

      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Resposta inesperada da IA — tente novamente.')
      const parsed = JSON.parse(jsonMatch[0])
      setMdFields(parsed)
      setFileName('Gerado por IA')
    } catch (err) {
      setGenErr(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Montar review ───────────────────────────────────────────────────────────

  function handlePreview() {
    if (!workItem) return
    if (!dropdownSel.impacto) { alert('O campo "Nível de impacto esperado" é obrigatório.'); return }

    const ops = []

    for (const df of DROPDOWN_FIELDS) {
      const val = dropdownSel[df.key]
      if (val) ops.push({ field: df.field, label: df.label, value: val, type: 'dropdown' })
    }

    if (mdFields) {
      for (const tf of TEXT_FIELDS) {
        const raw = mdFields[tf.key]
        ops.push({ field: tf.field, label: tf.label, value: raw || '', type: 'text' })
      }
    }

    setReview(ops)
    setResult(null)
  }

  // ── Confirmar e enviar para ADO ─────────────────────────────────────────────

  async function handleConfirm() {
    if (!review || !workItem) return
    setSending(true)
    setResult(null)
    const { org, project, pat } = getAzureConfig()

    try {
      const ops = review
        .filter(op => op.value)
        .map(op => ({
          op: 'add',
          path: `/fields/${op.field}`,
          value: op.type === 'text' ? toHtml(op.value) : op.value,
        }))

      if (ops.length === 0) { alert('Nenhum campo para preencher.'); setSending(false); return }

      await patchWorkItem(org, project, pat, workItem.id, ops)
      setResult({ ok: true, count: ops.length })
      setReview(null)
    } catch (err) {
      setResult({ ok: false, error: err.message })
    } finally {
      setSending(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const title = workItem?.fields?.['System.Title'] || ''
  const wiUrl = workItem
    ? (() => { try { const { org, project } = getAzureConfig(); return `https://dev.azure.com/${org}/${project}/_workitems/edit/${workItem.id}` } catch { return '' } })()
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, borderBottom: '1px solid var(--border2)', paddingBottom: 10 }}>
          GMUD — AZURE DEVOPS
        </div>

        {/* Busca por ID */}
        <div style={{ marginBottom: 16 }}>
          <LBL>ID DO WORK ITEM</LBL>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={wiId}
              onChange={e => setWiId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="ex: 2041337"
              style={{ width: 180, fontSize: 13 }}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !wiId.trim()}
              style={{ background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {searching
                ? <><i className="ti ti-loader-2 ti-spin" style={{ fontSize: 14 }} /> Buscando...</>
                : <><i className="ti ti-search" style={{ fontSize: 14 }} /> Buscar</>
              }
            </button>
            <button
              onClick={handleGenerateAI}
              disabled={!workItem || generating}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                background: workItem ? 'var(--surface)' : 'var(--surface2)',
                color: workItem ? 'var(--navy)' : 'var(--text3)',
                borderColor: workItem ? 'var(--navy)' : 'var(--border2)',
              }}
              title={!workItem ? 'Busque uma tarefa primeiro' : 'Gerar campos da GMUD automaticamente com IA'}
            >
              {generating
                ? <><i className="ti ti-loader-2 ti-spin" style={{ fontSize: 14 }} /> Gerando...</>
                : <><i className="ti ti-sparkles" style={{ fontSize: 14 }} /> Gerar GMUD por IA</>
              }
            </button>
          </div>
          {searchErr && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger, #e53e3e)', background: 'var(--danger-bg, #fff5f5)', border: '1px solid var(--danger-bd, #fed7d7)', borderRadius: 6, padding: '8px 12px' }}>
              {searchErr}
            </div>
          )}
          {genErr && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger, #e53e3e)', background: 'var(--danger-bg, #fff5f5)', border: '1px solid var(--danger-bd, #fed7d7)', borderRadius: 6, padding: '8px 12px' }}>
              <i className="ti ti-alert-circle" style={{ marginRight: 4 }} />{genErr}
            </div>
          )}
        </div>

        {/* Título confirmado */}
        {workItem && (
          <div style={{ marginBottom: 16, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ti ti-circle-check" style={{ fontSize: 16, color: 'var(--green, #38a169)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>#{workItem.id}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
            </div>
            {wiUrl && (
              <a href={wiUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--navy)', fontSize: 12 }}>
                <i className="ti ti-external-link" style={{ fontSize: 14 }} />
              </a>
            )}
          </div>
        )}

        {/* Conteúdo da task */}
        {workItem && (() => {
          const f = workItem.fields || {}
          const strip = html => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          const TASK_FIELDS = [
            { label: 'Descrição',         value: strip(f['System.Description']) },
            { label: 'Solução Proposta',  value: strip(f['Custom.9ee04e26-297a-4523-a62d-0e6b433c9ed7']) },
            { label: 'Critérios de Aceite', value: strip(f['Microsoft.VSTS.Common.AcceptanceCriteria']) },
            { label: 'Valor da Entrega',  value: strip(f['Custom.ANY_ValorEntrega']) },
          ].filter(tf => tf.value)

          if (!TASK_FIELDS.length) return null

          return (
            <div style={{ marginBottom: 16, border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden' }}>
              <div
                onClick={() => setTaskExpanded(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'var(--surface2)', cursor: 'pointer', userSelect: 'none' }}
              >
                <i className="ti ti-file-description" style={{ fontSize: 14, color: 'var(--text3)' }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Conteúdo da task</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{TASK_FIELDS.length} campo{TASK_FIELDS.length > 1 ? 's' : ''} carregado{TASK_FIELDS.length > 1 ? 's' : ''}</span>
                <i className={`ti ti-chevron-${taskExpanded ? 'up' : 'down'}`} style={{ fontSize: 13, color: 'var(--text3)' }} />
              </div>
              {taskExpanded && (
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {TASK_FIELDS.map(tf => (
                    <div key={tf.label}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>{tf.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', maxHeight: 120, overflowY: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {tf.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Dropdowns */}
        {workItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            {DROPDOWN_FIELDS.map(df => (
              <div key={df.key}>
                <LBL required={df.required}>{df.label}</LBL>
                {dropdownOpts[df.key]?.length > 0 ? (
                  <select
                    value={dropdownSel[df.key] || ''}
                    onChange={e => setDropdownSel(prev => ({ ...prev, [df.key]: e.target.value }))}
                    style={{ width: '100%', fontSize: 13 }}
                  >
                    <option value="">— selecionar —</option>
                    {dropdownOpts[df.key].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    value={dropdownSel[df.key] || ''}
                    onChange={e => setDropdownSel(prev => ({ ...prev, [df.key]: e.target.value }))}
                    placeholder="Não foi possível carregar as opções — digitar manualmente"
                    style={{ width: '100%', fontSize: 13 }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload MD */}
        {workItem && (
          <div style={{ marginBottom: 20 }}>
            <LBL>ARQUIVO MARKDOWN (.MD)</LBL>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
              style={{
                border: '2px dashed var(--border2)', borderRadius: 8, padding: '24px 16px',
                textAlign: 'center', cursor: 'pointer', background: mdFields ? 'var(--surface2)' : 'transparent',
                transition: 'background .15s',
              }}
            >
              {mdFields ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <i className="ti ti-file-check" style={{ fontSize: 18, color: 'var(--green, #38a169)' }} />
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{fileName}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>— {Object.values(mdFields).filter(v => v).length} campos extraídos</span>
                </div>
              ) : (
                <div>
                  <i className="ti ti-upload" style={{ fontSize: 22, color: 'var(--text3)', display: 'block', marginBottom: 6 }} />
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>Clique para selecionar ou arraste um arquivo .md</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".md" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            {mdErr && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger, #e53e3e)' }}>{mdErr}</div>}
            {mdFields && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TEXT_FIELDS.map(tf => {
                  const filled = !!mdFields[tf.key]
                  return (
                    <span key={tf.key} style={{
                      fontSize: 11, borderRadius: 4, padding: '2px 8px', border: '1px solid',
                      color: filled ? 'var(--green, #276749)' : 'var(--text3)',
                      background: filled ? 'var(--green-bg, #f0fff4)' : 'var(--surface2)',
                      borderColor: filled ? 'var(--green-bd, #9ae6b4)' : 'var(--border2)',
                    }}>
                      {filled ? '✓' : '—'} {tf.label}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Botão revisar */}
        {workItem && !review && (
          <button
            onClick={handlePreview}
            disabled={!dropdownSel.impacto}
            style={{ background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
          >
            <i className="ti ti-eye" style={{ fontSize: 14 }} /> Revisar campos →
          </button>
        )}

        {/* Resultado */}
        {result && (
          <div style={{
            marginTop: 14, borderRadius: 8, padding: '12px 16px', fontSize: 13,
            background: result.ok ? 'var(--green-bg, #f0fff4)' : 'var(--danger-bg, #fff5f5)',
            border: `1px solid ${result.ok ? 'var(--green-bd, #9ae6b4)' : 'var(--danger-bd, #fed7d7)'}`,
            color: result.ok ? 'var(--green, #276749)' : 'var(--danger, #c53030)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <i className={`ti ${result.ok ? 'ti-circle-check' : 'ti-alert-circle'}`} style={{ fontSize: 16 }} />
            {result.ok
              ? `${result.count} campo${result.count > 1 ? 's' : ''} preenchido${result.count > 1 ? 's' : ''} com sucesso no ADO!`
              : `Erro: ${result.error}`
            }
          </div>
        )}
      </div>

      {/* Review */}
      {review && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, borderBottom: '1px solid var(--border2)', paddingBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Revisão dos campos
            <button onClick={() => setReview(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>
              <i className="ti ti-x" style={{ fontSize: 13 }} /> Voltar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {review.map((op, i) => {
              const empty = !op.value || !op.value.trim()
              const preview = op.type === 'text'
                ? op.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                : op.value
              return (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                      {op.type === 'dropdown' && <i className="ti ti-chevron-down" style={{ fontSize: 10, marginRight: 3 }} />}
                      {op.label}
                    </span>
                    {empty && <span style={{ fontSize: 10, color: 'var(--amber-tx, #744210)', background: 'var(--amber-bg, #fffbeb)', border: '1px solid var(--amber-bd, #f6e05e)', borderRadius: 4, padding: '1px 6px' }}>vazio — não será enviado</span>}
                  </div>
                  <div style={{
                    background: empty ? 'var(--surface2)' : 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius, 6px)',
                    padding: '8px 12px', fontSize: 12,
                    color: empty ? 'var(--text3)' : 'var(--text2)',
                    fontStyle: empty ? 'italic' : 'normal',
                    whiteSpace: 'pre-wrap', lineHeight: 1.6,
                    maxHeight: 100, overflowY: 'auto',
                  }}>
                    {empty ? '(não preenchido)' : preview}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={handleConfirm}
              disabled={sending}
              style={{ background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
            >
              {sending
                ? <><i className="ti ti-loader-2 ti-spin" style={{ fontSize: 14 }} /> Enviando...</>
                : <><i className="ti ti-send" style={{ fontSize: 14 }} /> Confirmar e enviar ao ADO</>
              }
            </button>
            <button onClick={() => setReview(null)} style={{ fontSize: 14 }}>
              Voltar e editar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
