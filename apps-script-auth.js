/**
 * SPRINT BOARD — Apps Script de Autenticação
 * ============================================
 * Instruções de deploy:
 *
 * 1. Abra script.google.com e crie um novo projeto.
 * 2. Cole este código inteiro.
 * 3. Na planilha associada, crie uma aba chamada "Usuarios" com as colunas:
 *    A: username | B: password_hash | C: active
 *    (active = TRUE para liberar o usuário)
 * 4. Para gerar o hash de uma senha, use a função hashPassword() no editor
 *    e copie o resultado para a coluna B.
 * 5. Deploy > New deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copie a URL gerada e cole no campo "Apps Script URL" na tela de login.
 *
 * IMPORTANTE: Este script NÃO lida com o board (save/load de dados).
 * Use uma planilha/script separado para o board se quiser manter separado,
 * ou adicione a planilha "Usuarios" na mesma planilha do board.
 */

const SHEET_NAME = 'Usuarios'

// ---------------------------------------------------------------------------
// Endpoint principal
// ---------------------------------------------------------------------------

function doGet(e) {
  const action = e.parameter.action

  if (action === 'login') {
    return handleLogin(e.parameter.user, e.parameter.pass)
  }

  return jsonResponse({ ok: false, error: 'Ação desconhecida' })
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function handleLogin(username, password) {
  if (!username || !password) {
    return jsonResponse({ ok: false, error: 'Usuário e senha são obrigatórios' })
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
  if (!sheet) {
    return jsonResponse({ ok: false, error: 'Planilha de usuários não encontrada' })
  }

  const data = sheet.getDataRange().getValues()
  // Pula cabeçalho (linha 0)
  for (let i = 1; i < data.length; i++) {
    const [storedUser, storedHash, active] = data[i]
    if (
      String(storedUser).trim().toLowerCase() === username.trim().toLowerCase() &&
      active === true
    ) {
      const inputHash = sha256(password)
      if (inputHash === String(storedHash).trim()) {
        return jsonResponse({ ok: true, user: username })
      }
    }
  }

  return jsonResponse({ ok: false, error: 'Usuário ou senha inválidos' })
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

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
// Helper: rode esta função no editor para gerar o hash de uma senha
// e copie o resultado para a coluna B da planilha.
// Exemplo: hashPassword() com "minhasenha123" imprime o hash no log.
// ---------------------------------------------------------------------------

function hashPassword() {
  const senha = 'COLOQUE_A_SENHA_AQUI' // ← troque aqui
  Logger.log('Hash: ' + sha256(senha))
}
