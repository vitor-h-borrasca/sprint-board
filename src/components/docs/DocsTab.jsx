import { useState } from 'react'
import PbiCreator from './PbiCreator'
import EntregaTecnicaCreator from './EntregaTecnicaCreator'

const TABS = [
  { k: 'feature',         icon: 'ti-stack-2',       label: 'Feature'         },
  { k: 'pbi',             icon: 'ti-layout-kanban', label: 'PBI'             },
  { k: 'entrega_tecnica', icon: 'ti-code',          label: 'Entrega Técnica' },
]

export function DocsTab() {
  const [tab, setTab] = useState('feature')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div className="toolbar">
        {TABS.map(({ k, icon, label }) => {
          const active = tab === k
          return (
            <button key={k} onClick={() => setTab(k)} style={{
              background: active ? 'var(--navy)' : 'var(--surface)',
              color: active ? '#fff' : 'var(--text2)',
              borderColor: active ? 'var(--navy)' : 'var(--border2)',
            }}>
              <i className={'ti ' + icon} style={{ fontSize: 14 }} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      {tab === 'pbi'             && <PbiCreator defaultType="pbi" />}
      {tab === 'feature'         && <PbiCreator defaultType="feature" />}
      {tab === 'entrega_tecnica' && <EntregaTecnicaCreator />}

    </div>
  )
}
