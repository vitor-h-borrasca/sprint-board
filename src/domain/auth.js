import { getScriptUrl } from './board'

const SESSION_KEY         = 'sprint_board_session'
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 horas

export function getAuthUrl() {
  return getScriptUrl() || import.meta.env.VITE_SCRIPT_URL || ''
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session.expiry || Date.now() > session.expiry) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(email, isAdmin = false) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    email,
    isAdmin,
    expiry: Date.now() + SESSION_DURATION_MS,
  }))
}

export function getSessionTeam() {
  return getSession()?.team || null
}

export function getSessionTeamAreaPath() {
  return getSession()?.teamAreaPath || null
}

export function getSessionTeamProjetoIntegracao() {
  return getSession()?.teamProjetoIntegracao || null
}

export function saveSessionTeam(teamName, teamAreaPath = '', teamProjetoIntegracao = '') {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return
    const session = JSON.parse(raw)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, team: teamName, teamAreaPath, teamProjetoIntegracao }))
  } catch { /* noop */ }
}

export function isAdmin() {
  return getSession()?.isAdmin === true
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

async function callAuth(params) {
  const base = getAuthUrl()
  if (!base) throw new Error('URL do Apps Script não configurada.')
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`${base}?${qs}`, { method: 'GET' })
  if (!res.ok) throw new Error('Erro de conexão com o servidor')
  const data = JSON.parse(await res.text())
  if (!data.ok) throw new Error(data.error || 'Erro desconhecido')
  return data
}

export async function setPassword(email, pass) {
  return callAuth({ action: 'set_password', user: email, pass })
}

export async function login(email, password) {
  const data = await callAuth({ action: 'login', user: email, pass: password })
  saveSession(email, data.isAdmin === true)
  return data
}

export async function requestReset(email) {
  return callAuth({ action: 'request_reset', user: email })
}

export async function verifyReset(email, code, pass) {
  return callAuth({ action: 'verify_reset', user: email, code, pass })
}

export async function fetchTeams() {
  const data = await callAuth({ action: 'get_teams' })
  return data.teams || []
}
