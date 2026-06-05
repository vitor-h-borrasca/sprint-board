import { useState, useEffect, useRef } from 'react'

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
  const [status, setStatus] = useState('checking')
  const iframeRef = useRef(null)

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

  // Responde pedidos de credenciais vindos do iframe
  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== PBI_CREATOR_URL) return
      if (event.data?.type === 'REQUEST_AZURE_CONFIG') {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'AZURE_CONFIG', payload: getAzureConfig() },
          PBI_CREATOR_URL
        )
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Quando o iframe carrega, envia as credenciais via postMessage
  function handleIframeLoad() {
    const config = getAzureConfig()
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'AZURE_CONFIG', payload: config },
      PBI_CREATOR_URL
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 110px)' }}>

      {/* Barra superior */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>🗂️ Criador de PBIs</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px',
          borderRadius: 999, letterSpacing: '0.05em',
          background: 'var(--purple)', color: '#fff',
        }}>ANYMARKET</span>

        <div style={{ flex: 1 }} />

        {status === 'checking' && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>⏳ verificando servidor...</span>
        )}
        {status === 'online' && (
          <span style={{ fontSize: 11, color: 'var(--green)' }}>● servidor online</span>
        )}
        {status === 'offline' && (
          <span style={{ fontSize: 11, color: 'var(--red, #ef4444)' }}>
            ● servidor offline —{' '}
            <code style={{ fontSize: 11, background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>
              npm run start
            </code>
            {' '}na pasta <strong>Criador de PBIs</strong>
          </span>
        )}

        <a
          href={PBI_CREATOR_URL}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: 'var(--teal, #2dd4bf)', textDecoration: 'none' }}
        >
          ↗ abrir em nova aba
        </a>
      </div>

      {/* iframe ou tela offline */}
      {status === 'offline' ? (
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
      )}
    </div>
  )
}
