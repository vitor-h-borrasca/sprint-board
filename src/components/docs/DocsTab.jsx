import { useState } from 'react'
import PbiCreator from './PbiCreator'
import EntregaTecnicaCreator from './EntregaTecnicaCreator'

const TABS = [
  { k: 'pbi',             icon: 'ti-layout-kanban', label: 'PBI / Feature'    },
  { k: 'entrega_tecnica', icon: 'ti-code',          label: 'Entrega Técnica'  },
]

export function DocsTab() {
  const [tab, setTab] = useState('pbi')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 'calc(100vh - 110px)' }}>
      <div style={{
        margin: 16, flex: 1, display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'stretch',
          borderBottom: '1px solid var(--border)',
          padding: '0 16px', flexShrink: 0,
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
                borderRadius: 0, background: 'none',
                padding: '11px 14px', fontSize: 13, gap: 6,
                display: 'inline-flex', alignItems: 'center',
                color: tab === k ? 'var(--navy)' : 'var(--text3)',
                fontWeight: tab === k ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <i className={'ti ' + icon} style={{ fontSize: 14 }} />
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        {tab === 'pbi' && (
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
            <PbiCreator />
          </div>
        )}
        {tab === 'entrega_tecnica' && (
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
            <EntregaTecnicaCreator />
          </div>
        )}

      </div>
    </div>
  )
}
