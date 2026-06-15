/**
 * SPRINT BOARD — Apps Script Completo
 * =====================================
 * Abas necessárias na planilha:
 *   - Usuarios    : A:email | B:hash | C:active | D:admin | E:reset_code | F:reset_expiry
 *   - Times       : A:nome  | B:areaPath | C:projetoIntegracao
 *   - sprint-data : A1 = JSON blob do board
 *   - sprint-history : histórico de saves
 *   - PET         : tabela de iniciativas por time
 *   - PET-Config  : configurações por quarter por time
 */

const SHEET       = "sprint-data";
const HIST        = "sprint-history";
const AUTH_SHEET  = "Usuarios";
const TEAMS_SHEET = "Times";
const PET_SHEET   = "PET";
const PET_CFG_SHEET = "PET-Config";

const RESET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutos

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || "load";
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === "login")          return handleLogin(e.parameter.user, e.parameter.pass);
  if (action === "set_password")   return handleSetPassword(e.parameter.user, e.parameter.pass);
  if (action === "get_teams")      return handleGetTeams();
  if (action === "request_reset")  return handleRequestReset(e.parameter.user);
  if (action === "verify_reset")   return handleVerifyReset(e.parameter.user, e.parameter.code, e.parameter.pass);
  if (action === "load_pet")       return handleLoadPet(e.parameter.team);

  if (action === "history") {
    const sheet = ss.getSheetByName(HIST);
    if (!sheet || sheet.getLastRow() < 2) return out(JSON.stringify([]));
    const rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 3).getValues();
    return out(JSON.stringify(rows.map(r => ({ ts:r[0], sprint:r[1], data:r[2] })).reverse()));
  }

  const sheet = ss.getSheetByName(SHEET);
  if (!sheet) return out("{}");
  return out(sheet.getRange("A1").getValue() || "{}");
}

function doPost(e) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const payload = JSON.parse(e.postData.contents);

  // Roteamento por action no payload
  if (payload.action === "save_pet") return handleSavePet(payload, ss);

  // Save padrão do board (sprint-data)
  const data = payload.data || payload;

  let sheet = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  sheet.getRange("A1").setValue(JSON.stringify(data));

  let hist = ss.getSheetByName(HIST) || ss.insertSheet(HIST);
  if (hist.getLastRow() === 0) hist.appendRow(["Timestamp","Sprint","Data"]);
  hist.appendRow([new Date().toISOString(), payload.sprintName || "—", JSON.stringify(data)]);
  const lastRow = hist.getLastRow();
  if (lastRow > 51) hist.deleteRows(2, lastRow - 51);

  return out(JSON.stringify({ ok: true }));
}

// ─── PET ─────────────────────────────────────────────────────────────────────

function handleSavePet(payload, ss) {
  const team    = String(payload.team || "").trim();
  const rows    = payload.rows    || [];   // iniciativas
  const configs = payload.configs || [];   // quarter configs

  // ── Aba PET (iniciativas) ──────────────────────────────────────────────────
  let petSheet = ss.getSheetByName(PET_SHEET) || ss.insertSheet(PET_SHEET);

  const PET_HEADERS = ["Time","Quarter","Título","Tag","Tamanho","Horas Est.","Status","Priorizado","É Iniciativa","Atualizado Em"];

  // Inicializa cabeçalho se vazio
  if (petSheet.getLastRow() === 0) {
    petSheet.appendRow(PET_HEADERS);
    petSheet.getRange(1, 1, 1, PET_HEADERS.length).setFontWeight("bold");
  }

  // Remove linhas antigas deste time (mantém cabeçalho na linha 1)
  if (petSheet.getLastRow() > 1) {
    const existing = petSheet.getRange(2, 1, petSheet.getLastRow() - 1, 1).getValues();
    for (let i = existing.length - 1; i >= 0; i--) {
      if (String(existing[i][0]).trim() === team) {
        petSheet.deleteRow(i + 2);
      }
    }
  }

  // Insere novas linhas
  const now = new Date().toISOString();
  rows.forEach(r => {
    petSheet.appendRow([
      team,
      r.quarter,
      r.title,
      r.tag || "",
      r.size || "",
      r.hrs || 0,
      r.status,
      r.prioritized ? "SIM" : "NÃO",
      r.isInitiative ? "Iniciativa" : "Demanda",
      now,
    ]);
  });

  // ── Aba PET-Config (configs por quarter) ───────────────────────────────────
  let cfgSheet = ss.getSheetByName(PET_CFG_SHEET) || ss.insertSheet(PET_CFG_SHEET);

  const CFG_HEADERS = ["Time","Quarter","Início","Fim","Dias Úteis","Ausências Gerais","Ausências Membros","Atualizado Em"];

  if (cfgSheet.getLastRow() === 0) {
    cfgSheet.appendRow(CFG_HEADERS);
    cfgSheet.getRange(1, 1, 1, CFG_HEADERS.length).setFontWeight("bold");
  }

  // Remove configs antigas deste time
  if (cfgSheet.getLastRow() > 1) {
    const existing = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 1).getValues();
    for (let i = existing.length - 1; i >= 0; i--) {
      if (String(existing[i][0]).trim() === team) {
        cfgSheet.deleteRow(i + 2);
      }
    }
  }

  // Insere configs atualizadas
  configs.forEach(c => {
    cfgSheet.appendRow([
      team,
      c.quarter,
      c.startDate || "",
      c.endDate   || "",
      c.workingDays ?? 60,
      c.generalAbsences || "[]",
      c.memberAbsences  || "{}",
      now,
    ]);
  });

  return out(JSON.stringify({ ok: true }));
}

function handleLoadPet(team) {
  if (!team) return out(JSON.stringify({ ok: false, error: "Time não informado" }));
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Iniciativas
  const petSheet = ss.getSheetByName(PET_SHEET);
  const rows = [];
  if (petSheet && petSheet.getLastRow() > 1) {
    const data = petSheet.getRange(2, 1, petSheet.getLastRow() - 1, 10).getValues();
    data.forEach(r => {
      if (String(r[0]).trim() === team) {
        rows.push({
          quarter: r[1], title: r[2], tag: r[3], size: r[4],
          hrs: r[5], status: r[6],
          prioritized: r[7] === "SIM",
          isInitiative: r[8] === "Iniciativa",
        });
      }
    });
  }

  // Configs
  const cfgSheet = ss.getSheetByName(PET_CFG_SHEET);
  const configs = {};
  if (cfgSheet && cfgSheet.getLastRow() > 1) {
    const data = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 8).getValues();
    data.forEach(r => {
      if (String(r[0]).trim() === team) {
        configs[r[1]] = {
          startDate: r[2] || "",
          endDate: r[3] || "",
          workingDays: r[4] || 60,
          generalAbsences: tryParse(r[5], []),
          memberAbsences:  tryParse(r[6], {}),
        };
      }
    });
  }

  return out(JSON.stringify({ ok: true, rows, configs }));
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

function handleLogin(email, password) {
  if (!email || !password) return out(JSON.stringify({ ok: false, error: "E-mail e senha são obrigatórios" }));

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUTH_SHEET);
  if (!sheet) return out(JSON.stringify({ ok: false, error: "Planilha de usuários não encontrada" }));

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const [storedUser, storedHash, active, admin] = data[i];
    if (String(storedUser).trim().toLowerCase() !== email.trim().toLowerCase()) continue;
    if (!isActive(active)) return out(JSON.stringify({ ok: false, error: "Usuário inativo. Solicite acesso ao administrador." }));

    if (!storedHash || String(storedHash).trim().length === 0) {
      return out(JSON.stringify({ ok: false, error: "first_access" }));
    }

    if (sha256(password) !== String(storedHash).trim()) {
      return out(JSON.stringify({ ok: false, error: "E-mail ou senha inválidos" }));
    }

    return out(JSON.stringify({ ok: true, user: email, isAdmin: isActive(admin) }));
  }

  return out(JSON.stringify({ ok: false, error: "E-mail não autorizado. Solicite acesso ao administrador." }));
}

function handleSetPassword(email, pass) {
  if (!email || !pass) return out(JSON.stringify({ ok: false, error: "Preencha todos os campos" }));
  if (pass.length < 6) return out(JSON.stringify({ ok: false, error: "A senha deve ter pelo menos 6 caracteres" }));

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUTH_SHEET);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const [storedUser, , active] = data[i];
    if (String(storedUser).trim().toLowerCase() !== email.trim().toLowerCase()) continue;
    if (!isActive(active)) return out(JSON.stringify({ ok: false, error: "Usuário inativo" }));
    sheet.getRange(i + 1, 2).setValue(sha256(pass));
    return out(JSON.stringify({ ok: true }));
  }

  return out(JSON.stringify({ ok: false, error: "E-mail não encontrado" }));
}

function handleRequestReset(email) {
  if (!email) return out(JSON.stringify({ ok: false, error: "Informe o e-mail." }));

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUTH_SHEET);
  if (!sheet) return out(JSON.stringify({ ok: false, error: "Planilha não encontrada." }));

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const [storedUser, , active] = data[i];
    if (String(storedUser).trim().toLowerCase() !== email.trim().toLowerCase()) continue;
    if (!isActive(active)) return out(JSON.stringify({ ok: false, error: "Usuário inativo." }));

    const code   = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date().getTime() + RESET_EXPIRY_MS;

    sheet.getRange(i + 1, 5).setValue(code);
    sheet.getRange(i + 1, 6).setValue(expiry);

    try {
      MailApp.sendEmail({
        to:      email.trim(),
        subject: "Sprint Board — Código de redefinição de senha",
        body:    "Olá!\n\nSeu código para redefinir a senha do Sprint Board é:\n\n" + code + "\n\nEste código expira em 15 minutos.\n\nSe você não solicitou isso, ignore este e-mail.",
      });
    } catch (err) {
      return out(JSON.stringify({ ok: false, error: "Erro ao enviar e-mail: " + err.message }));
    }

    return out(JSON.stringify({ ok: true }));
  }

  return out(JSON.stringify({ ok: true }));
}

function handleVerifyReset(email, code, newPassword) {
  if (!email || !code || !newPassword) return out(JSON.stringify({ ok: false, error: "Dados incompletos." }));
  if (newPassword.length < 6) return out(JSON.stringify({ ok: false, error: "A senha deve ter pelo menos 6 caracteres." }));

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUTH_SHEET);
  if (!sheet) return out(JSON.stringify({ ok: false, error: "Planilha não encontrada." }));

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const [storedUser, , active, , storedCode, storedExpiry] = data[i];
    if (String(storedUser).trim().toLowerCase() !== email.trim().toLowerCase()) continue;
    if (!isActive(active)) return out(JSON.stringify({ ok: false, error: "Usuário inativo." }));

    if (!storedCode || String(storedCode).trim() !== String(code).trim()) {
      return out(JSON.stringify({ ok: false, error: "Código inválido." }));
    }

    if (!storedExpiry || new Date().getTime() > Number(storedExpiry)) {
      return out(JSON.stringify({ ok: false, error: "Código expirado. Solicite um novo." }));
    }

    sheet.getRange(i + 1, 2).setValue(sha256(newPassword));
    sheet.getRange(i + 1, 5).setValue("");
    sheet.getRange(i + 1, 6).setValue("");

    return out(JSON.stringify({ ok: true }));
  }

  return out(JSON.stringify({ ok: false, error: "Usuário não encontrado." }));
}

// ─── TIMES ────────────────────────────────────────────────────────────────────

function handleGetTeams() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEAMS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return out(JSON.stringify({ ok: true, teams: [] }));
  const data = sheet.getDataRange().getValues();
  const teams = data.slice(1)
    .map(row => ({
      name: String(row[0] || '').trim(),
      areaPath: String(row[1] || '').trim(),
      projetoIntegracao: String(row[2] || '').trim()
    }))
    .filter(t => t.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return out(JSON.stringify({ ok: true, teams }));
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function isActive(val) {
  return val === true || String(val).trim().toUpperCase() === "TRUE";
}

function sha256(input) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8
  );
  return bytes.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function out(text) {
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
