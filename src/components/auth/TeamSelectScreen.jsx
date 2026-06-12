import { useState, useEffect } from 'react'
import { getSession, fetchTeams } from '@/domain/auth'

export default function TeamSelectScreen({ onSelect }) {
  const session = getSession()

  const [teams, setTeams]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchTeams()
      .then((list) => setTeams(list))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const team = teams.find((t) => t.name === selected)
    if (!team) return
    onSelect(team.name, team.areaPath || '', team.projetoIntegracao || '')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '36px 32px',
        boxShadow: '0 8px 32px rgba(0,0,0,.35)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 13, letterSpacing: '.12em', color: 'var(--orange)', fontWeight: 700, marginBottom: 4 }}>
            ANYMARKET
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)' }}>Sprint Planning Board</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            Olá, <strong style={{ color: 'var(--text2)' }}>{session?.email}</strong>. Selecione seu time para continuar.
          </div>
        </div>

        {/* Erro ao buscar times */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
            borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#FCA5A5',
            marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <i className="ti ti-alert-circle" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Time</label>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text3)', padding: '9px 0' }}>
                <i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} />
                Carregando times...
              </div>
            ) : (
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={!!error || loading}
                autoFocus
                style={{ width: '100%' }}
              >
                <option value="">— Selecione um time —</option>
                {teams.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <button
            type="submit"
            className="primary"
            disabled={!selected || loading}
            style={{ marginTop: 4, justifyContent: 'center', padding: '9px 0', fontSize: 13 }}
          >
            <i className="ti ti-door-enter" /> Entrar no board
          </button>
        </form>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '.06em',
  display: 'block', marginBottom: 5,
}
