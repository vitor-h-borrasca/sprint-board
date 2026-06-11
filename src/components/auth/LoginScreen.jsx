import { useState } from 'react'
import { setPassword, login, requestReset, verifyReset, getAuthUrl } from '@/domain/auth'

// steps: 'login' | 'set_password' | 'reset_request' | 'reset_verify' | 'reset_newpass'

export default function LoginScreen({ onLogin }) {
  const [step, setStep]       = useState('login')
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode]       = useState('')
  const [error, setError]     = useState('')
  const [info, setInfo]       = useState('')
  const [loading, setLoading] = useState(false)

  const hasUrl = !!getAuthUrl()

  // ── Login principal (e-mail + senha juntos) ──────────────────────────────

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Informe o e-mail.'); return }
    if (!pass)         { setError('Informe a senha.'); return }
    setLoading(true); setError('')
    try {
      await login(email.trim(), pass)
      onLogin()
    } catch (err) {
      if (err.message === 'first_access') {
        setPass(''); setStep('set_password')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Primeiro acesso — definir senha ──────────────────────────────────────

  async function handleSetPassword(e) {
    e.preventDefault()
    if (!pass || !confirm)  { setError('Preencha os dois campos.'); return }
    if (pass !== confirm)   { setError('As senhas não coincidem.'); return }
    if (pass.length < 6)    { setError('Mínimo 6 caracteres.'); return }
    setLoading(true); setError('')
    try {
      await setPassword(email.trim(), pass)
      await login(email.trim(), pass)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Reset: solicitar código ───────────────────────────────────────────────

  async function handleResetRequest(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Informe o e-mail.'); return }
    setLoading(true); setError(''); setInfo('')
    try {
      await requestReset(email.trim())
      setInfo(`Código enviado para ${email.trim()}. Verifique sua caixa de entrada.`)
      setStep('reset_verify')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Reset: verificar código ───────────────────────────────────────────────

  async function handleResetVerify(e) {
    e.preventDefault()
    if (code.length !== 6) { setError('O código deve ter 6 dígitos.'); return }
    setStep('reset_newpass'); setError('')
  }

  // ── Reset: nova senha ─────────────────────────────────────────────────────

  async function handleResetNewPass(e) {
    e.preventDefault()
    if (!pass || !confirm) { setError('Preencha os dois campos.'); return }
    if (pass !== confirm)  { setError('As senhas não coincidem.'); return }
    if (pass.length < 6)   { setError('Mínimo 6 caracteres.'); return }
    setLoading(true); setError('')
    try {
      await verifyReset(email.trim(), code, pass)
      await login(email.trim(), pass)
      onLogin()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Helpers de navegação ──────────────────────────────────────────────────

  function goLogin() {
    setStep('login'); setPass(''); setConfirm(''); setCode(''); setError(''); setInfo('')
  }

  function goResetRequest() {
    setStep('reset_request'); setPass(''); setConfirm(''); setCode(''); setError(''); setInfo('')
  }

  // ── Subtítulos por step ───────────────────────────────────────────────────

  const subtitle = {
    login:          'Entre com seu e-mail e senha',
    set_password:   'Primeiro acesso — defina sua senha',
    reset_request:  'Informe seu e-mail para receber o código',
    reset_verify:   'Digite o código de 6 dígitos enviado',
    reset_newpass:  'Escolha sua nova senha',
  }[step]

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
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{subtitle}</div>
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

        {/* ── STEP: login ── */}
        {step === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" autoComplete="email" autoFocus
                disabled={loading || !hasUrl}
              />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                disabled={loading || !hasUrl}
              />
            </div>
            <ErrorBox msg={error} />
            <SubmitBtn loading={loading} disabled={!hasUrl} label="Entrar" icon="ti-login" />
            <button type="button" onClick={goResetRequest}
              style={{ justifyContent: 'center', fontSize: 11, color: 'var(--text3)', border: 'none', background: 'none', marginTop: -4 }}>
              <i className="ti ti-lock-question" /> Esqueci minha senha
            </button>
          </form>
        )}

        {/* ── STEP: definir senha (primeiro acesso) ── */}
        {step === 'set_password' && (
          <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <EmailChip email={email} />
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
            <BackBtn onClick={goLogin} />
          </form>
        )}

        {/* ── STEP: reset — solicitar código ── */}
        {step === 'reset_request' && (
          <form onSubmit={handleResetRequest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" autoComplete="email" autoFocus
                disabled={loading}
              />
            </div>
            <ErrorBox msg={error} />
            <SubmitBtn loading={loading} label="Enviar código" icon="ti-send" />
            <BackBtn onClick={goLogin} label="Voltar para o login" />
          </form>
        )}

        {/* ── STEP: reset — digitar código ── */}
        {step === 'reset_verify' && (
          <form onSubmit={handleResetVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <EmailChip email={email} />
            {info && (
              <div style={{
                background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
                borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#86EFAC',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <i className="ti ti-mail-check" />{info}
              </div>
            )}
            <div>
              <label style={labelStyle}>Código de 6 dígitos</label>
              <input
                type="text" value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" autoFocus maxLength={6}
                style={{ letterSpacing: '0.3em', fontSize: 18, textAlign: 'center' }}
                disabled={loading}
              />
            </div>
            <ErrorBox msg={error} />
            <SubmitBtn loading={loading} label="Confirmar código" icon="ti-check" />
            <button type="button" onClick={() => { setStep('reset_request'); setError(''); setInfo('') }}
              style={{ justifyContent: 'center', fontSize: 11, color: 'var(--text3)', border: 'none', background: 'none' }}>
              <i className="ti ti-refresh" /> Reenviar código
            </button>
          </form>
        )}

        {/* ── STEP: reset — nova senha ── */}
        {step === 'reset_newpass' && (
          <form onSubmit={handleResetNewPass} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <EmailChip email={email} />
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
            <SubmitBtn loading={loading} label="Redefinir senha e entrar" icon="ti-lock-check" />
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

function EmailChip({ email }) {
  return (
    <div style={{
      background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.2)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#93C5FD',
      display: 'flex', alignItems: 'center', gap: 7,
    }}>
      <i className="ti ti-mail" />{email}
    </div>
  )
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

function BackBtn({ onClick, label = 'Usar outro e-mail' }) {
  return (
    <button type="button" onClick={onClick}
      style={{ justifyContent: 'center', fontSize: 11, color: 'var(--text3)', border: 'none', background: 'none' }}>
      <i className="ti ti-arrow-left" /> {label}
    </button>
  )
}
