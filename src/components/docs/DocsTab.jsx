import { useState, useEffect, useRef } from 'react'
import { fetchTeams } from '@/domain/auth'
import EntregaTecnicaCreator from './EntregaTecnicaCreator'

const PBI_CREATOR_URL = 'https://criador-de-pbis.vercel.app'

function getAzureConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('sprint-board-config') || '{}')
    return {
      org:     cfg.azureOrg     || '',
      project: cfg.azureProject || 'ANYMARKET',
      pat:     cfg.azurePat     || '',
    }
  } catch {
    return { org: '', project: 'ANYMARKET', pat: '' }
  }
}

export function DocsTab() {
  const [tab, setTab]       = useState('pbi')   // 'pbi' | 'entrega_tecnica'
  const [status, setStatus] = useState('checking')
  const iframeRef = useRef(null)
  const teamsRef  = useRef([])

  // Busca times e envia ao iframe assim que resolver (independente do load order)
  useEffect(() => {
    fetchTeams().then(list => {
      if (!list.length) return
      teamsRef.current = list
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'TEAMS_LIST', payload: list },
        PBI_CREATOR_URL
      )
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        await fetch(PBI_CREATOR_URL, { mode: 'no-cors', cache: 'no-store' })
        if (!cancelled) setStatus('online')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  function sendConfig() {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'AZURE_CONFIG', payload: getAzureConfig() },
      PBI_CREATOR_URL
    )
    if (teamsRef.current.length) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'TEAMS_LIST', payload: teamsRef.current },
        PBI_CREATOR_URL
      )
    }
  }

  // Responde pedidos vindos do iframe
  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== PBI_CREATOR_URL) return
      if (event.data?.type === 'REQUEST_AZURE_CONFIG') sendConfig()
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Quando o iframe carrega, envia as credenciais e times
  function handleIframeLoad() {
    sendConfig()
  }

  const TABS = [
    { k: 'pbi',              icon: 'ti-layout-kanban', label: 'PBI / Feature' },
    { k: 'entrega_tecnica',  icon: 'ti-code',          label: 'Entrega Técnica' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 110px)' }}>

      {/* Barra superior com abas integradas */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 0,
        padding: '0 20px 0 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', alignSelf: 'center', marginRight: 16, whiteSpace: 'nowrap' }}>
          🗂️ Criador de tarefas
        </span>

        {TABS.map(({ k, icon, label }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              border: 'none',
              borderBottom: '2px solid ' + (tab === k ? 'var(--orange)' : 'transparent'),
              borderRadius: 0,
              background: 'none',
              padding: '11px 16px',
              fontSize: 13,
              gap: 6,
              display: 'inline-flex', alignItems: 'center',
              color: tab === k ? 'var(--navy)' : 'var(--text3)',
              fontWeight: tab === k ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <i className={'ti ' + icon} style={{ fontSize: 14 }} />
            {label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {tab === 'pbi' && <>
          {status === 'checking' && (
            <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center' }}>⏳ verificando servidor...</span>
          )}
          {status === 'online' && (
            <span style={{ fontSize: 11, color: 'var(--green)', alignSelf: 'center' }}>● servidor online</span>
          )}
          {status === 'offline' && (
            <span style={{ fontSize: 11, color: 'var(--red, #ef4444)', alignSelf: 'center' }}>
              ● servidor offline —{' '}
              <code style={{ fontSize: 11, background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>
                npm run start
              </code>
            </span>
          )}
          <a
            href={PBI_CREATOR_URL}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, color: 'var(--teal, #2dd4bf)', textDecoration: 'none', alignSelf: 'center', marginLeft: 12 }}
          >
            ↗ abrir em nova aba
          </a>
        </>}
      </div>

      {/* Conteúdo da aba PBI/Feature */}
      {tab === 'pbi' && (
        status === 'offline' ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 16, color: 'var(--text3)',
          }}>
            <span style={{ fontSize: 40 }}>🔌</span>
            <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
              O servidor do Criador de PBIs não está rodando.<br />
              Abra um terminal na pasta <strong style={{ color: 'var(--text1)' }}>Criador de PBIs</strong> e execute:
            </p>
            <code style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 20px', fontSize: 13, color: 'var(--teal, #2dd4bf)',
            }}>
              npm run start
            </code>
            <button
              onClick={() => { setStatus('checking'); setTimeout(() => location.reload(), 300) }}
              style={{
                marginTop: 8, padding: '8px 20px', borderRadius: 8,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text2)', cursor: 'pointer', fontSize: 12,
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={PBI_CREATOR_URL}
            title="Criador de PBIs"
            onLoad={handleIframeLoad}
            style={{
              flex: 1, border: 'none', width: '100%',
              opacity: status === 'checking' ? 0.4 : 1,
              transition: 'opacity 0.3s',
            }}
          />
        )
      )}

      {/* Conteúdo da aba Entrega Técnica */}
      {tab === 'entrega_tecnica' && (
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          <EntregaTecnicaCreator />
        </div>
      )}
    </div>
  )
}
