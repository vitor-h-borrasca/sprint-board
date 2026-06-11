/**
 * SPRINT BOARD — Apps Script de Autenticação
 * ============================================
 * Instruções de deploy:
 *
 * 1. Abra script.google.com e crie/edite o projeto.
 * 2. Cole este código inteiro.
 * 3. Na planilha associada, crie uma aba chamada "Usuarios" com as colunas:
 *    A: username | B: password_hash | C: active | D: admin | E: reset_code | F: reset_expiry
 *    (active = TRUE para liberar o usuário)
 *    (admin  = TRUE para dar acesso de administrador)
 *    (reset_code e reset_expiry são gerenciados automaticamente)
 * 4. Deploy > New deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copie a URL gerada e cole no campo "Apps Script URL" na tela de login.
 *
 * AÇÕES DISPONÍVEIS (parâmetro GET "action"):
 *   login           → user, pass
 *   set_password    → user, pass
 *   get_teams       → (sem parâmetros extras)
 *   request_reset   → user
 *   verify_reset    → user, code, pass
 */

const SHEET_NAME       = 'Usuarios'
const TEAMS_SHEET_NAME = 'Teams'
const RESET_EXPIRY_MS  = 15 * 60 * 1000 // 15 minutos

// ---------------------------------------------------------------------------
// Endpoint principal
// ---------------------------------------------------------------------------

function doGet(e) {
  const p = e.parameter
  switch (p.action) {
    case 'login':          return handleLogin(p.user, p.pass)
    case 'set_password':   return handleSetPassword(p.user, p.pass)
    case 'get_teams':      return handleGetTeams()
    case 'request_reset':  return handleRequestReset(p.user)
    case 'verify_reset':   return handleVerifyReset(p.user, p.code, p.pass)
    default:               return jsonResponse({ ok: false, error: 'Ação desconhecida' })
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function handleLogin(username, password) {
  if (!username || !password) {
    return jsonResponse({ ok: false, error: 'Usuário e senha são obrigatórios' })
  }

  const sheet = getSheet()
  if (!sheet) return jsonResponse({ ok: false, error: 'Planilha de usuários não encontrada' })

  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    const [storedUser, storedHash, active, admin] = data[i]
    if (String(storedUser).trim().toLowerCase() !== username.trim().toLowerCase()) continue
    if (active !== true) return jsonResponse({ ok: false, error: 'Usuário inativo. Fale com o administrador.' })

    // Usuário existe mas não tem senha ainda (primeiro acesso)
    if (!storedHash || String(storedHash).trim() === '') {
      return jsonResponse({ ok: false, error: 'first_access' })
    }

    if (sha256(password) === String(storedHash).trim()) {
      return jsonResponse({ ok: true, isAdmin: admin === true })
    }

    return jsonResponse({ ok: false, error: 'Senha incorreta.' })
  }

  return jsonResponse({ ok: false, error: 'Usuário não encontrado.' })
}

// ---------------------------------------------------------------------------
// Definir senha (primeiro acesso)
// ---------------------------------------------------------------------------

function handleSetPassword(username, password) {
  if (!username || !password) {
    return jsonResponse({ ok: false, error: 'Dados incompletos.' })
  }
  if (password.length < 6) {
    return jsonResponse({ ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' })
  }

  const sheet = getSheet()
  if (!sheet) return jsonResponse({ ok: false, error: 'Planilha não encontrada.' })

  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    const [storedUser, , active] = data[i]
    if (String(storedUser).trim().toLowerCase() !== username.trim().toLowerCase()) continue
    if (active !== true) return jsonResponse({ ok: false, error: 'Usuário inativo.' })

    sheet.getRange(i + 1, 2).setValue(sha256(password))
    return jsonResponse({ ok: true })
  }

  return jsonResponse({ ok: false, error: 'Usuário não encontrado.' })
}

// ---------------------------------------------------------------------------
// Solicitar reset de senha — gera código de 6 dígitos e envia por e-mail
// ---------------------------------------------------------------------------

function handleRequestReset(username) {
  if (!username) return jsonResponse({ ok: false, error: 'Informe o e-mail.' })

  const sheet = getSheet()
  if (!sheet) return jsonResponse({ ok: false, error: 'Planilha não encontrada.' })

  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    const [storedUser, , active] = data[i]
    if (String(storedUser).trim().toLowerCase() !== username.trim().toLowerCase()) continue
    if (active !== true) return jsonResponse({ ok: false, error: 'Usuário inativo.' })

    const code   = String(Math.floor(100000 + Math.random() * 900000))
    const expiry = new Date().getTime() + RESET_EXPIRY_MS

    // Salva código e expiração nas colunas E e F
    sheet.getRange(i + 1, 5).setValue(code)
    sheet.getRange(i + 1, 6).setValue(expiry)

    try {
      MailApp.sendEmail({
        to:      username.trim(),
        subject: 'Sprint Board — Código de redefinição de senha',
        body:    `Olá!\n\nSeu código para redefinir a senha do Sprint Board é:\n\n${code}\n\nEste código expira em 15 minutos.\n\nSe você não solicitou isso, ignore este e-mail.`,
      })
    } catch (err) {
      return jsonResponse({ ok: false, error: 'Erro ao enviar e-mail: ' + err.message })
    }

    return jsonResponse({ ok: true })
  }

  // Retorna ok mesmo assim para não revelar se o e-mail existe ou não
  return jsonResponse({ ok: true })
}

// ---------------------------------------------------------------------------
// Verificar código e redefinir senha
// ---------------------------------------------------------------------------

function handleVerifyReset(username, code, newPassword) {
  if (!username || !code || !newPassword) {
    return jsonResponse({ ok: false, error: 'Dados incompletos.' })
  }
  if (newPassword.length < 6) {
    return jsonResponse({ ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' })
  }

  const sheet = getSheet()
  if (!sheet) return jsonResponse({ ok: false, error: 'Planilha não encontrada.' })

  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    const [storedUser, , active, , storedCode, storedExpiry] = data[i]
    if (String(storedUser).trim().toLowerCase() !== username.trim().toLowerCase()) continue
    if (active !== true) return jsonResponse({ ok: false, error: 'Usuário inativo.' })

    if (!storedCode || String(storedCode).trim() !== String(code).trim()) {
      return jsonResponse({ ok: false, error: 'Código inválido.' })
    }

    const now = new Date().getTime()
    if (!storedExpiry || now > Number(storedExpiry)) {
      return jsonResponse({ ok: false, error: 'Código expirado. Solicite um novo.' })
    }

    // Atualiza senha e limpa o código
    sheet.getRange(i + 1, 2).setValue(sha256(newPassword))
    sheet.getRange(i + 1, 5).setValue('')
    sheet.getRange(i + 1, 6).setValue('')

    return jsonResponse({ ok: true })
  }

  return jsonResponse({ ok: false, error: 'Usuário não encontrado.' })
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

function handleGetTeams() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(TEAMS_SHEET_NAME)
  if (!sheet) return jsonResponse({ ok: true, teams: [] })

  const data = sheet.getDataRange().getValues()
  const teams = []
  for (let i = 1; i < data.length; i++) {
    const [name, areaPath, active] = data[i]
    if (name && active !== false) {
      teams.push({ name: String(name).trim(), areaPath: String(areaPath || '').trim() })
    }
  }
  return jsonResponse({ ok: true, teams })
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
}

function sha256(input) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    input,
    Utilities.Charset.UTF_8
  )
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('')
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// ---------------------------------------------------------------------------
// Helper: rode no editor para gerar hash de uma senha
// ---------------------------------------------------------------------------

function hashPassword() {
  const senha = 'COLOQUE_A_SENHA_AQUI'
  Logger.log('Hash: ' + sha256(senha))
}
