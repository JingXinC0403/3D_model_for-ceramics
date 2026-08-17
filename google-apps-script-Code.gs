/* ============================================================
   CARE Google Sheets Backend — Apps Script
   ------------------------------------------------------------
   1. Open each Google Sheet you supplied.
   2. Extensions -> Apps Script.
   3. Put this entire file into the Apps Script project attached
      to either sheet, OR use a standalone Apps Script project.
   4. Deploy -> New deployment -> Web app.
      Execute as: Me
      Who has access: Anyone
   5. Copy the /exec URL into CARE/sheets-config.js.

   The backend uses the two spreadsheet IDs below:
     USERS_SHEET_ID    = first link you supplied
     PROJECTS_SHEET_ID = second link you supplied

   It creates the required headers automatically in the first tab
   of each spreadsheet.

   IMPORTANT: This is suitable for a school/demo project. A Google
   Sheet is not a production-grade authentication database.
   Passwords are never stored as plain text here; they are salted
   and hashed before being written to the Users sheet.
   ============================================================ */

const USERS_SHEET_ID = "1ipgnqXbUFZQtiWHWw4rp7sA-sBHOa4fQk4ivo8FLneY";
const PROJECTS_SHEET_ID = "1qOpnMywYiM37ZHRlHCURI-n-BKCXpwSiEhnuQseql0k";
const SESSION_DAYS = 7;

const USER_HEADERS = [
  "userId", "email", "name", "passwordHash", "passwordSalt", "createdAt"
];

const PROJECT_HEADERS = [
  "projectId", "userId", "name", "coverImage", "camerasJson", "climateJson",
  "artifactJson", "createdAt", "updatedAt", "createdBy", "updatedBy"
];

function doGet() {
  return json({ success: true, service: "CARE Google Sheets backend", status: "online" });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    setupSheets_();

    switch (payload.action) {
      case "setup": return json({ success: true, message: "Sheets are ready." });
      case "signup": return json(signup_(payload));
      case "login": return json(login_(payload));
      case "session": return json(session_(payload));
      case "getProjects": return json(getProjects_(payload));
      case "getProject": return json(getProject_(payload));
      case "saveProject": return json(saveProject_(payload));
      case "deleteProject": return json(deleteProject_(payload));
      default: return json({ success: false, code: "care/bad-action", message: "Unknown action." });
    }
  } catch (err) {
    console.error(err);
    return json({
      success: false,
      code: "care/backend",
      message: err && err.message ? err.message : "Backend error."
    });
  }
}

function setupSheets_() {
  ensureHeaders_(SpreadsheetApp.openById(USERS_SHEET_ID).getSheets()[0], USER_HEADERS);
  ensureHeaders_(SpreadsheetApp.openById(PROJECTS_SHEET_ID).getSheets()[0], PROJECT_HEADERS);
}

function ensureHeaders_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  let changed = false;
  headers.forEach(function (h, i) {
    if (current[i] !== h) { current[i] = h; changed = true; }
  });
  if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([current]);
}

function signup_(p) {
  const name = String(p.name || "").trim();
  const email = String(p.email || "").trim().toLowerCase();
  const password = String(p.password || "");

  if (!name || !email || !password) return fail_("care/invalid-input", "Please complete all fields.");
  if (password.length < 6) return fail_("auth/weak-password", "Password should be at least 6 characters.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail_("auth/invalid-email", "Please enter a valid email address.");

  const sheet = SpreadsheetApp.openById(USERS_SHEET_ID).getSheets()[0];
  const rows = getRows_(sheet);
  if (rows.some(function (r) { return String(r.email).toLowerCase() === email; })) {
    return fail_("auth/email-already-in-use", "That email is already registered — try logging in instead.");
  }

  const userId = Utilities.getUuid();
  const salt = Utilities.getUuid();
  const hash = hashPassword_(password, salt);
  const createdAt = new Date().toISOString();

  sheet.appendRow([userId, email, name, hash, salt, createdAt]);
  return makeSessionResponse_(userId, email, name);
}

function login_(p) {
  const email = String(p.email || "").trim().toLowerCase();
  const password = String(p.password || "");
  const sheet = SpreadsheetApp.openById(USERS_SHEET_ID).getSheets()[0];
  const rows = getRows_(sheet);
  const user = rows.find(function (r) { return String(r.email).toLowerCase() === email; });

  if (!user) return fail_("auth/user-not-found", "No account found with that email.");
  if (hashPassword_(password, String(user.passwordSalt)) !== String(user.passwordHash)) {
    return fail_("auth/invalid-credential", "Incorrect email or password.");
  }

  return makeSessionResponse_(String(user.userId), String(user.email), String(user.name || ""));
}

function session_(p) {
  const user = requireUser_(p.token);
  return { success: true, user: publicUser_(user) };
}

function getProjects_(p) {
  const user = requireUser_(p.token);
  const sheet = SpreadsheetApp.openById(PROJECTS_SHEET_ID).getSheets()[0];
  const projects = getRows_(sheet)
    .filter(function (r) { return String(r.userId) === String(user.userId); })
    .map(projectFromRow_);
  return { success: true, projects: projects };
}

function getProject_(p) {
  const user = requireUser_(p.token);
  const id = String(p.id || "");
  const sheet = SpreadsheetApp.openById(PROJECTS_SHEET_ID).getSheets()[0];
  const row = getRows_(sheet).find(function (r) {
    return String(r.projectId) === id && String(r.userId) === String(user.userId);
  });
  return { success: true, project: row ? projectFromRow_(row) : null };
}

function saveProject_(p) {
  const user = requireUser_(p.token);
  const project = p.project || {};
  const sheet = SpreadsheetApp.openById(PROJECTS_SHEET_ID).getSheets()[0];
  const rows = getRows_(sheet);
  const now = new Date().toISOString();
  const id = String(project.id || Utilities.getUuid());
  const existing = rows.find(function (r) {
    return String(r.projectId) === id && String(r.userId) === String(user.userId);
  });

  if (project.id && !existing) {
    return fail_("care/not-found", "That artefact does not exist or does not belong to your account.");
  }

  const record = {
    projectId: id,
    userId: String(user.userId),
    name: String(project.name || ""),
    coverImage: String(project.coverImage || ""),
    camerasJson: JSON.stringify(project.cameras || {}),
    climateJson: JSON.stringify(project.climate || {}),
    artifactJson: JSON.stringify(project.artifact || {}),
    createdAt: existing ? String(existing.createdAt || project.createdAt || now) : String(project.createdAt || now),
    updatedAt: now,
    createdBy: existing ? String(existing.createdBy || user.email) : String(user.email),
    updatedBy: String(user.email)
  };

  const values = [
    record.projectId, record.userId, record.name, record.coverImage,
    record.camerasJson, record.climateJson, record.artifactJson,
    record.createdAt, record.updatedAt, record.createdBy, record.updatedBy
  ];

  if (existing) {
    sheet.getRange(existing._row, 1, 1, PROJECT_HEADERS.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  return { success: true, isNew: !existing, project: projectFromRow_(record) };
}

function deleteProject_(p) {
  const user = requireUser_(p.token);
  const id = String(p.id || "");
  const sheet = SpreadsheetApp.openById(PROJECTS_SHEET_ID).getSheets()[0];
  const rows = getRows_(sheet);
  const existing = rows.find(function (r) {
    return String(r.projectId) === id && String(r.userId) === String(user.userId);
  });
  if (!existing) return fail_("care/not-found", "Artefact not found.");
  sheet.deleteRow(existing._row);
  return { success: true };
}

function requireUser_(token) {
  const data = verifyToken_(String(token || ""));
  if (!data) throw new Error("Your session has expired. Please log in again.");

  const sheet = SpreadsheetApp.openById(USERS_SHEET_ID).getSheets()[0];
  const user = getRows_(sheet).find(function (r) { return String(r.userId) === String(data.userId); });
  if (!user) throw new Error("Account not found. Please sign up again.");
  return user;
}

function makeSessionResponse_(userId, email, name) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const token = createToken_(userId, expires);
  return { success: true, token: token, user: { userId: userId, email: email, name: name }, expiresAt: expires };
}

function createToken_(userId, expires) {
  const payload = userId + "|" + expires;
  const secret = getSecret_();
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, secret)
  );
  return Utilities.base64EncodeWebSafe(payload) + "." + signature;
}

function verifyToken_(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
    const bits = payload.split("|");
    if (bits.length !== 2 || Number(bits[1]) < Date.now()) return null;
    const expected = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(payload, getSecret_())
    );
    if (expected !== parts[1]) return null;
    return { userId: bits[0], expires: Number(bits[1]) };
  } catch (_) {
    return null;
  }
}

function getSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("CARE_SESSION_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("CARE_SESSION_SECRET", secret);
  }
  return secret;
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ":" + password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, "0");
  }).join("");
}

function getRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(function (row, index) {
    const obj = { _row: index + 2 };
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  }).filter(function (row) {
    return Object.keys(row).some(function (key) { return key !== "_row" && row[key] !== ""; });
  });
}

function projectFromRow_(r) {
  let cameras = {}, climate = {}, artifact = {};
  try { cameras = JSON.parse(r.camerasJson || "{}"); } catch (_) {}
  try { climate = JSON.parse(r.climateJson || "{}"); } catch (_) {}
  try { artifact = JSON.parse(r.artifactJson || "{}"); } catch (_) {}
  return {
    id: String(r.projectId),
    name: String(r.name || ""),
    coverImage: String(r.coverImage || ""),
    cameras: cameras,
    climate: climate,
    artifact: artifact,
    createdAt: String(r.createdAt || ""),
    updatedAt: String(r.updatedAt || ""),
    createdBy: String(r.createdBy || ""),
    createdByUid: String(r.userId || ""),
    updatedBy: String(r.updatedBy || ""),
    updatedByUid: String(r.userId || "")
  };
}

function publicUser_(r) {
  return { userId: String(r.userId), email: String(r.email), name: String(r.name || "") };
}

function fail_(code, message) {
  return { success: false, code: code, message: message };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
