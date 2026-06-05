import SetupTab from './SetupTab'
import StorageTab from '@/components/storage/StorageTab'
import { TabBtn, Card } from '@/components/shared'
import { isAdmin } from '@/domain/auth'
import { useState } from 'react'

const SUB_TABS = [
  { k: 'sprint',      icon: 'ti-run',           label: 'Sprint' },
  { k: 'integracoes', icon: 'ti-plug-connected', label: 'Integrações' },
]

function AdminGate() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320, padding: 32 }}>
      <Card style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <i className="ti ti-lock" style={{ fontSize: 32, color: 'var(--orange)', display: 'block', marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)', marginBottom: 6 }}>
          Acesso restrito
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
          Você não tem permissão para acessar as configurações.<br />
          Solicite acesso ao administrador.
        </div>
      </Card>
    </div>
  )
}

export default function ConfigTab() {
  const [sub, setSub] = useState('sprint')

  if (!isAdmin()) return <AdminGate />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="subtabs-bar">
        {SUB_TABS.map((t) => (
          <TabBtn
            key={t.k}
            active={sub === t.k}
            onClick={() => setSub(t.k)}
            icon={t.icon}
            label={t.label}
          />
        ))}
      </div>

      <div className="page-content" style={{ paddingTop: 16 }}>
        {sub === 'sprint'      && <SetupTab />}
        {sub === 'integracoes' && <StorageTab />}
      </div>
    </div>
  )
}
