import { useState, useEffect, useRef } from 'react'
import { getScriptUrl } from '@/domain/board'

const EMPTY_LINK  = () => ({ id: Date.now() + Math.random(), label: '', url: '' })
const EMPTY_CANAL = () => ({ id: Date.now() + Math.random(), canal: '', links: [EMPTY_LINK()] })

async function fetchDocumentacoes() {
  const url = getScriptUrl()
  if (!url) return []
  const res = await fetch(`${url}?action=load_documentacoes`)
  const json = await res.json()
  if (!json.ok) return []
  return (json.canais || []).map(c => ({
    ...c,
    id: Date.now() + Math.random(),
    links: (c.links || []).map(l => ({ ...l, id: Date.now() + Math.random() })),
  }))
}

async function saveDocumentacoes(canais) {
  const url = getScriptUrl()
  if (!url) return
  await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'save_documentacoes', canais }),
  })
}

export default function DocumentacoesTab() {
  const [canais, setCanais]     = useState([])
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const inputRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    fetchDocumentacoes().then(data => {
      setCanais(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

  function scheduleSave(next) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setSaving(true)
      saveDocumentacoes(next).finally(() => setSaving(false))
    }, 1000)
  }

  function update(fn) {
    setCanais(prev => {
      const next = fn(prev)
      scheduleSave(next)
      return next
    })
  }

  function addCanal() {
    const novo = EMPTY_CANAL()
    update(prev => [...prev, novo])
    setEditingId(novo.id)
  }

  function removeCanal(id) {
    update(prev => prev.filter(c => c.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function updateCanal(id, field, value) {
    update(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function addLink(canalId) {
    update(prev => prev.map(c =>
      c.id === canalId ? { ...c, links: [...c.links, EMPTY_LINK()] } : c
    ))
  }

  function removeLink(canalId, linkId) {
    update(prev => prev.map(c =>
      c.id === canalId ? { ...c, links: c.links.filter(l => l.id !== linkId) } : c
    ))
  }

  function updateLink(canalId, linkId, field, value) {
    update(prev => prev.map(c =>
      c.id === canalId
        ? { ...c, links: c.links.map(l => l.id === linkId ? { ...l, [field]: value } : l) }
        : c
    ))
  }

  if (loading) return (
    <div style={{ color: 'var(--text3)', fontSize: 13, padding: 16 }}>
      <i className="ti ti-loader-2 ti-spin" style={{ marginRight: 6 }} />
      Carregando documentações...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>
          {saving
            ? <><i className="ti ti-loader-2 ti-spin" style={{ marginRight: 4 }} />Salvando...</>
            : canais.length === 0 ? 'Nenhum canal cadastrado.' : `${canais.length} canal${canais.length > 1 ? 'is' : ''}`
          }
        </span>
        <button
          onClick={addCanal}
          style={{ background: 'var(--navy)', color: '#fff', borderColor: 'var(--navy)', gap: 6, display: 'flex', alignItems: 'center' }}
        >
          <i className="ti ti-plus" style={{ fontSize: 14 }} />
          Novo canal
        </button>
      </div>

      {canais.map(canal => {
        const editing = editingId === canal.id
        return (
          <div key={canal.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Header do canal */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                background: 'var(--surface2)', borderBottom: '1px solid var(--border2)',
                cursor: 'pointer',
              }}
              onClick={() => setEditingId(editing ? null : canal.id)}
            >
              <i className="ti ti-world" style={{ fontSize: 15, color: 'var(--text2)' }} />
              {editing ? (
                <input
                  ref={inputRef}
                  value={canal.canal}
                  onChange={e => updateCanal(canal.id, 'canal', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="Nome do canal (ex: AliExpress)"
                  style={{ flex: 1, fontSize: 14, fontWeight: 600 }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: canal.canal ? 'var(--text)' : 'var(--text3)' }}>
                  {canal.canal || 'Canal sem nome'}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {canal.links.filter(l => l.url).length} link{canal.links.filter(l => l.url).length !== 1 ? 's' : ''}
              </span>
              <i
                className={`ti ti-chevron-${editing ? 'up' : 'down'}`}
                style={{ fontSize: 13, color: 'var(--text3)' }}
              />
              <button
                onClick={e => { e.stopPropagation(); removeCanal(canal.id) }}
                style={{ background: 'transparent', border: 'none', color: 'var(--danger, #e53e3e)', padding: '2px 4px', marginLeft: 4 }}
                title="Remover canal"
              >
                <i className="ti ti-trash" style={{ fontSize: 14 }} />
              </button>
            </div>

            {/* Links — modo edição */}
            {editing && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {canal.links.map((link, idx) => (
                  <div key={link.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', minWidth: 20, textAlign: 'right' }}>{idx + 1}.</span>
                    <input
                      value={link.label}
                      onChange={e => updateLink(canal.id, link.id, 'label', e.target.value)}
                      placeholder="Rótulo (ex: API v2)"
                      style={{ width: 160, fontSize: 13 }}
                    />
                    <input
                      value={link.url}
                      onChange={e => updateLink(canal.id, link.id, 'url', e.target.value)}
                      placeholder="URL da documentação"
                      style={{ flex: 1, fontSize: 13 }}
                    />
                    {link.url && (
                      <a href={link.url} target="_blank" rel="noreferrer" title="Abrir link">
                        <i className="ti ti-external-link" style={{ fontSize: 14, color: 'var(--navy)' }} />
                      </a>
                    )}
                    <button
                      onClick={() => removeLink(canal.id, link.id)}
                      disabled={canal.links.length === 1}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text3)', padding: '2px 4px' }}
                      title="Remover link"
                    >
                      <i className="ti ti-x" style={{ fontSize: 13 }} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addLink(canal.id)}
                  style={{ alignSelf: 'flex-start', background: 'transparent', color: 'var(--navy)', borderColor: 'var(--navy)', fontSize: 12, marginTop: 2 }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 12 }} /> Adicionar link
                </button>
              </div>
            )}

            {/* Links — modo leitura */}
            {!editing && canal.links.filter(l => l.url).length > 0 && (
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {canal.links.filter(l => l.url).map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 13, color: 'var(--navy)',
                      background: 'var(--surface2)', border: '1px solid var(--border2)',
                      borderRadius: 6, padding: '4px 10px', textDecoration: 'none',
                    }}
                  >
                    <i className="ti ti-file-text" style={{ fontSize: 13 }} />
                    {link.label || link.url}
                  </a>
                ))}
              </div>
            )}

          </div>
        )
      })}

    </div>
  )
}
