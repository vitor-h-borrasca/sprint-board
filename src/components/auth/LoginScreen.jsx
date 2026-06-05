import { useState } from 'react'
import { checkUser, setPassword, login, getAuthUrl } from '@/domain/auth'

// step: 'email' | 'set_password' | 'login'

export default function LoginScreen({ onLogin }) {
  const [step, setStep]         = useState('email')
  const [email, setEmail]       = useState('')
  const [pass, setPass]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const hasUrl = !!getAuthUrl()

  async function handleEmailSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Informe o e-mail.'); return }
    setLoading(true); setError('')
    try {
      const res = await checkUser(email.trim())
      setStep(res.hasPassword ? 'login' : 'set_password')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    if (!pass || !confirm) { setError('Preencha os dois campos.'); return }
    if (pass !== confirm)  { setError('As senhas não coincidem.'); return }
    if (pass.length < 6)   { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true); setError('')
    try {
      await setPassword(email.trim(), pass, confirm)
      // Senha criada — faz login direto
      await login(email.trim(), pass)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!pass) { setError('Informe a senha.'); return }
    setLoading(true); setError('')
    try {
      await login(email.trim(), pass)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function back() {
    setStep('email'); setPass(''); setConfirm(''); setError('')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '36px 32px',
        boxShadow: '0 8px 32px rgba(0,0,0,.35)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 13, letterSpacing: '.12em', color: 'var(--orange)', fontWeight: 700, marginBottom: 4 }}>
            ANYMARKET
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)' }}>Sprint Planning Board</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            {step === 'email'        && 'Informe seu e-mail para continuar'}
            {step === 'set_password' && 'Primeiro acesso — defina sua senha'}
            {step === 'login'        && 'Bem-vindo de volta'}
          </div>
        </div>

        {!hasUrl && (
          <div style={{
            background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)',
            borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#FCD34D',
            marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 7,
          }}>
            <i className="ti ti-alert-triangle" style={{ marginTop: 1 }} />
            <span>Ferramenta não configurada. Solicite acesso ao administrador.</span>
          </div>
        )}

        {/* STEP: email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" autoComplete="email" autoFocus
                disabled={loading || !hasUrl}
              />
            </div>
            <ErrorBox msg={error} />
            <SubmitBtn loading={loading} disabled={!hasUrl} label="Continuar" icon="ti-arrow-right" />
          </form>
        )}

        {/* STEP: definir senha (primeiro acesso) */}
        {step === 'set_password' && (
          <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.2)',
              borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#93C5FD',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <i className="ti ti-mail" />
              {email}
            </div>
            <div>
              <label style={labelStyle}>Nova senha</label>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                placeholder="mínimo 6 caracteres" autoComplete="new-password" autoFocus
                disabled={loading}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirmar senha</label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="repita a senha" autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <ErrorBox msg={error} />
            <SubmitBtn loading={loading} label="Definir senha e entrar" icon="ti-lock" />
            <BackBtn onClick={back} />
          </form>
        )}

        {/* STEP: login normal */}
        {step === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.2)',
              borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#93C5FD',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <i className="ti ti-mail" />
              {email}
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" autoFocus
                disabled={loading}
              />
            </div>
            <ErrorBox msg={error} />
            <SubmitBtn loading={loading} label="Entrar" icon="ti-login" />
            <BackBtn onClick={back} />
          </form>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '.06em',
  display: 'block', marginBottom: 5,
}

function ErrorBox({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#FCA5A5',
      display: 'flex', alignItems: 'center', gap: 7,
    }}>
      <i className="ti ti-alert-circle" />{msg}
    </div>
  )
}

function SubmitBtn({ loading, disabled, label, icon }) {
  return (
    <button type="submit" className="primary" disabled={loading || disabled}
      style={{ marginTop: 4, justifyContent: 'center', padding: '9px 0', fontSize: 13 }}>
      {loading
        ? <><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> Aguarde...</>
        : <><i className={`ti ${icon}`} /> {label}</>
      }
    </button>
  )
}

function BackBtn({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ justifyContent: 'center', fontSize: 11, color: 'var(--text3)', border: 'none', background: 'none' }}>
      <i className="ti ti-arrow-left" /> Usar outro e-mail
    </button>
  )
}
