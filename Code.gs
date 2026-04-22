// =====================================================
// COPY FROM HERE INTO APPS SCRIPT
// Delete the default Apps Script code, then paste everything in this file.
// =====================================================
// =====================================================
// Code.gs — Google Apps Script Backend
// AAA Election System
//
// HOW TO SET UP:
// 1. Go to script.google.com and create a new project
// 2. Paste this entire code into Code.gs
// 3. Replace SPREADSHEET_ID with your Google Sheets ID
// 4. In Apps Script Script Properties, set ADMIN_USERNAME, AUTH_SECRET,
//    and either ADMIN_PASSWORD_HASH or ADMIN_PASSWORD
// 5. Deploy as Web App (see README for instructions)
// =====================================================

// Set your Google Sheets ID via Apps Script → Project Settings → Script Properties
// (key: SPREADSHEET_ID). Do NOT hardcode it here.
const SPREADSHEET_ID = "";

// Sheet names (must match exactly)
const SHEETS = {
  REGISTERED_VOTERS: "Registered Voters",
  VOTERS: "Voters",
  CANDIDATES: "Candidates",
  VOTES: "Votes",
  SETTINGS: "Settings",
};

const ADMIN_AUTH = {
  DEFAULT_ELECTION_ACTIVE: false,
  DEFAULT_REGISTRATION_OPEN: true,
  TOKEN_TTL_MS: 8 * 60 * 60 * 1000,
};

function getSheetOrThrow(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Missing required sheet: ${sheetName}`);
  }
  return sheet;
}

function getSpreadsheetId_() {
  const configuredId =
    (typeof SPREADSHEET_ID !== "undefined" && SPREADSHEET_ID) ||
    PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");

  if (!configuredId || configuredId === "YOUR_SPREADSHEET_ID_HERE") {
    throw new Error("Set SPREADSHEET_ID in Code.gs to your Google Sheet ID.");
  }

  return configuredId;
}

function openSpreadsheet_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

function getHeaderMap(headers) {
  const map = {};
  headers.forEach((header, index) => {
    map[String(header).trim()] = index;
  });
  return map;
}

function requireHeader(headerMap, headerName, sheetName) {
  const index = headerMap[headerName];
  if (index === undefined) {
    throw new Error(`Missing required column "${headerName}" in "${sheetName}" sheet.`);
  }
  return index;
}

function buildRowFromHeaders(headers, valuesByHeader) {
  return headers.map(header => (
    Object.prototype.hasOwnProperty.call(valuesByHeader, header)
      ? valuesByHeader[header]
      : ""
  ));
}

function isTruthyValue(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

// ===== SETTINGS HELPERS =====
function getSettingsSheet_(ss) {
  return ss.getSheetByName(SHEETS.SETTINGS);
}

function ensureSettingsSheet_(ss) {
  const sheet = getSettingsSheet_(ss) || ss.insertSheet(SHEETS.SETTINGS);
  const header = sheet.getRange(1, 1, 1, 2).getValues()[0];
  if (String(header[0]).trim() !== "key" || String(header[1]).trim() !== "value") {
    sheet.getRange(1, 1, 1, 2).setValues([["key", "value"]]);
  }
  return sheet;
}

function getSetting(key, defaultValue) {
  const ss = openSpreadsheet_();
  const sheet = getSettingsSheet_(ss);
  if (!sheet) return defaultValue;
  const data = sheet.getDataRange().getValues();
  const row = data.find(r => r[0] === key);
  return row ? row[1] : defaultValue;
}

function setSetting(key, value) {
  const ss = openSpreadsheet_();
  const sheet = ensureSettingsSheet_(ss);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getAdminConfig_() {
  const props = PropertiesService.getScriptProperties();
  const username = props.getProperty("ADMIN_USERNAME");
  const authSecret = props.getProperty("AUTH_SECRET");
  const storedHash = props.getProperty("ADMIN_PASSWORD_HASH");
  const legacyPassword = props.getProperty("ADMIN_PASSWORD");

  if (!username || !authSecret || (!storedHash && !legacyPassword)) {
    throw new Error(
      "Configure ADMIN_USERNAME, AUTH_SECRET, and either ADMIN_PASSWORD_HASH or ADMIN_PASSWORD in Apps Script Script Properties."
    );
  }

  return {
    username: username,
    authSecret: authSecret,
    passwordHash: storedHash || hashPasswordWithSecret_(legacyPassword, authSecret),
  };
}

function toHex_(bytes) {
  return bytes
    .map(byte => {
      const normalized = byte < 0 ? byte + 256 : byte;
      return normalized.toString(16).padStart(2, "0");
    })
    .join("");
}

function hashPasswordWithSecret_(password, secret) {
  return toHex_(Utilities.computeHmacSha256Signature(password, secret, Utilities.Charset.UTF_8));
}

function secureEquals_(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function createAdminToken_(username) {
  const config = getAdminConfig_();
  const payload = JSON.stringify({
    u: username,
    exp: Date.now() + ADMIN_AUTH.TOKEN_TTL_MS,
    n: Utilities.getUuid(),
  });
  const encodedPayload = Utilities.base64EncodeWebSafe(payload);
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(encodedPayload, config.authSecret, Utilities.Charset.UTF_8)
  );
  return encodedPayload + "." + signature;
}

function decodeAdminToken_(token) {
  const config = getAdminConfig_();
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;

  const encodedPayload = parts[0];
  const providedSignature = parts[1];
  const expectedSignature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(encodedPayload, config.authSecret, Utilities.Charset.UTF_8)
  );

  if (!secureEquals_(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(encodedPayload)).getDataAsString()
    );
    if (!payload || payload.u !== config.username || Number(payload.exp) <= Date.now()) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function isValidAdminToken(token) {
  try {
    return !!decodeAdminToken_(token);
  } catch (e) {
    return false;
  }
}

// ===== MAIN ENTRY POINT =====
function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    if (action === "verify") {
      result = verifyVoter(e.parameter.student_id, e.parameter.email);
    } else if (action === "getElectionStatus") {
      result = {
        success: true,
        election_active: isTruthyValue(getSetting("election_active", ADMIN_AUTH.DEFAULT_ELECTION_ACTIVE)),
        candidates_visible: isTruthyValue(getSetting("candidates_visible", true)),
        registration_open: isTruthyValue(getSetting("registration_open", ADMIN_AUTH.DEFAULT_REGISTRATION_OPEN)),
      };
    } else if (action === "getCandidates") {
      result = getCandidates();
    } else if (action === "registerVoter") {
      result = registerVoter(
        e.parameter.student_id,
        e.parameter.full_name,
        e.parameter.email,
        e.parameter.course,
        e.parameter.year_level,
        e.parameter.scholarship_type
      );
    } else {
      result = { success: false, message: "Unknown action." };
    }
  } catch (err) {
    result = { success: false, message: "Server error: " + err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result;

  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.action === "submitVote") {
      result = submitVote(payload.student_id, payload.votes, payload.timestamp);
    } else if (payload.action === "adminLogin") {
      result = adminLogin(payload.username, payload.password);
    } else if (payload.action === "getVoters") {
      result = getVoters(payload.token);
    } else if (payload.action === "setElectionStatus") {
      result = setElectionStatus(payload.token, payload.active);
    } else if (payload.action === "setCandidatesVisibility") {
      result = setCandidatesVisibility(payload.token, payload.visible);
    } else if (payload.action === "setRegistrationStatus") {
      result = setRegistrationStatus(payload.token, payload.open);
    } else if (payload.action === "addCandidate") {
      result = addCandidate(payload.token, payload.candidate);
    } else if (payload.action === "getVoteResults") {
      result = getVoteResults(payload.token);
    } else if (payload.action === "deleteCandidate") {
      result = deleteCandidate(payload.token, payload.candidate_id);
    } else if (payload.action === "resetVoterStatus") {
      result = resetVoterStatus(payload.token, payload.student_id);
    } else {
      result = { success: false, message: "Unknown action." };
    }
  } catch (err) {
    result = { success: false, message: "Server error: " + err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== REGISTER VOTER =====
function registerVoter(studentId, fullName, email, course, yearLevel, scholarshipType) {
  if (!studentId || !fullName || !email || !course || !yearLevel || !scholarshipType) {
    return { success: false, message: "All required fields must be filled in." };
  }

  if (!isTruthyValue(getSetting("registration_open", ADMIN_AUTH.DEFAULT_REGISTRATION_OPEN))) {
    return { success: false, message: "Registration is currently closed. Please check back later." };
  }

  if (!email.toLowerCase().endsWith("@sjp2cd.edu.ph")) {
    return { success: false, message: "Email must end with @sjp2cd.edu.ph." };
  }

  const ss = openSpreadsheet_();
  const votersSheet = ss.getSheetByName(SHEETS.VOTERS);
  const registrationSheet = ss.getSheetByName(SHEETS.REGISTERED_VOTERS);

  if (!registrationSheet && !votersSheet) {
    throw new Error(`Missing required sheet: ${SHEETS.VOTERS}`);
  }

  const sheetsToCheck = [registrationSheet, votersSheet]
    .filter(sheet => !!sheet)
    .filter((sheet, index, arr) => arr.findIndex(other => other.getSheetId() === sheet.getSheetId()) === index);

  for (let i = 0; i < sheetsToCheck.length; i++) {
    const currentSheet = sheetsToCheck[i];
    const currentData = currentSheet.getDataRange().getValues();
    const currentHeaders = currentData[0].map(h => String(h).trim());
    const currentHeaderMap = getHeaderMap(currentHeaders);
    const idIdx = requireHeader(currentHeaderMap, "student_id", currentSheet.getName());
    const emailIdx = requireHeader(currentHeaderMap, "school_email", currentSheet.getName());
    const rows = currentData.slice(1);

    const duplicate = rows.find(row =>
      String(row[idIdx] || "").trim() === studentId.trim() ||
      String(row[emailIdx] || "").trim().toLowerCase() === email.trim().toLowerCase()
    );

    if (duplicate) {
      return { success: false, message: "A voter with this Student ID or email is already registered." };
    }
  }

  const voterRecord = {
    student_id: studentId.trim(),
    full_name: fullName.trim(),
    school_email: email.trim().toLowerCase(),
    course: course.trim(),
    year_level: yearLevel.trim(),
    scholarship_type: scholarshipType.trim(),
    eligible: true,
    has_voted: false,
    voted_at: "",
  };

  if (registrationSheet) {
    const registrationHeaders = registrationSheet.getDataRange().getValues()[0].map(h => String(h).trim());
    registrationSheet.appendRow(buildRowFromHeaders(registrationHeaders, voterRecord));
  }

  if (votersSheet && (!registrationSheet || votersSheet.getSheetId() !== registrationSheet.getSheetId())) {
    const voterHeaders = votersSheet.getDataRange().getValues()[0].map(h => String(h).trim());
    votersSheet.appendRow(buildRowFromHeaders(voterHeaders, voterRecord));
  }

  const successMessage = votersSheet
    ? "Registration successful! You have been added to the voter masterlist and may vote when the election is open."
    : "Registration submitted successfully. Your details were recorded.";

  return { success: true, message: successMessage };
}

// ===== ADMIN LOGIN =====
function adminLogin(username, password) {
  if (!username || !password) {
    return { success: false, message: "Credentials required." };
  }

  const config = getAdminConfig_();
  const providedUser = username.trim();
  const providedHash = hashPasswordWithSecret_(password.trim(), config.authSecret);

  if (providedUser === config.username && secureEquals_(providedHash, config.passwordHash)) {
    return { success: true, token: createAdminToken_(config.username) };
  }
  return { success: false, message: "Invalid username or password." };
}

// ===== GET VOTERS (admin) =====
function getVoters(token) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }

  const ss = openSpreadsheet_();
  const sheet = getSheetOrThrow(ss, SHEETS.VOTERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const headerMap = getHeaderMap(headers);
  const studentIdIdx = requireHeader(headerMap, "student_id", SHEETS.VOTERS);
  const rows = data.slice(1);

  const voters = rows
    .filter(r => String(r[studentIdIdx] || "").trim() !== "")
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });

  const registrationSheet = ss.getSheetByName(SHEETS.REGISTERED_VOTERS);
  let registeredVoters = [];
  if (registrationSheet) {
    const registrationData = registrationSheet.getDataRange().getValues();
    const registrationHeaders = registrationData[0].map(h => String(h).trim());
    const registrationHeaderMap = getHeaderMap(registrationHeaders);
    const registrationIdIdx = requireHeader(registrationHeaderMap, "student_id", SHEETS.REGISTERED_VOTERS);
    registeredVoters = registrationData
      .slice(1)
      .filter(row => String(row[registrationIdIdx] || "").trim() !== "")
      .map(row => {
        const obj = {};
        registrationHeaders.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
  }

  const electionActive = getSetting("election_active", ADMIN_AUTH.DEFAULT_ELECTION_ACTIVE);
  const total    = voters.length;
  const voted    = voters.filter(v => isTruthyValue(v.has_voted)).length;

  return {
    success: true,
    election_active: isTruthyValue(electionActive),
    candidates_visible: isTruthyValue(getSetting("candidates_visible", true)),
    registration_open: isTruthyValue(getSetting("registration_open", ADMIN_AUTH.DEFAULT_REGISTRATION_OPEN)),
    stats: { total, voted, not_voted: total - voted },
    registered_voters: registeredVoters,
    voters,
  };
}

// ===== SET ELECTION STATUS (admin) =====
function setElectionStatus(token, active) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }
  const val = (active === "true" || active === true);
  setSetting("election_active", val);
  return { success: true, election_active: val };
}

// ===== SET CANDIDATES VISIBILITY (admin) =====
function setCandidatesVisibility(token, visible) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }
  const val = (visible === "true" || visible === true);
  setSetting("candidates_visible", val);
  return { success: true, candidates_visible: val };
}

// ===== SET REGISTRATION STATUS (admin) =====
function setRegistrationStatus(token, open) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }
  const val = (open === "true" || open === true);
  setSetting("registration_open", val);
  return { success: true, registration_open: val };
}

// ===== VERIFY VOTER =====
function verifyVoter(studentId, email) {
  if (!studentId || !email) {
    return { success: false, message: "Missing student ID or email." };
  }

  // Check if election is currently open
  const electionActive = getSetting("election_active", ADMIN_AUTH.DEFAULT_ELECTION_ACTIVE);
  if (!isTruthyValue(electionActive)) {
    return { success: false, message: "The election is not currently open. Please check back during the election period." };
  }

  // Validate email domain
  if (!email.toLowerCase().endsWith("@sjp2cd.edu.ph")) {
    return { success: false, message: "Email must end with @sjp2cd.edu.ph." };
  }

  const ss = openSpreadsheet_();
  const sheet = getSheetOrThrow(ss, SHEETS.VOTERS);
  const data = sheet.getDataRange().getValues();

  // Row 0 = headers from the Voters tab.
  const headers = data[0].map(h => String(h).trim());
  const headerMap = getHeaderMap(headers);
  const rows = data.slice(1);

  const idIdx = requireHeader(headerMap, "student_id", SHEETS.VOTERS);
  const nameIdx = requireHeader(headerMap, "full_name", SHEETS.VOTERS);
  const emailIdx = requireHeader(headerMap, "school_email", SHEETS.VOTERS);
  const courseIdx = requireHeader(headerMap, "course", SHEETS.VOTERS);
  const yearIdx = requireHeader(headerMap, "year_level", SHEETS.VOTERS);
  const eligibleIdx = requireHeader(headerMap, "eligible", SHEETS.VOTERS);
  const votedIdx = requireHeader(headerMap, "has_voted", SHEETS.VOTERS);

  // Find matching voter
  const voter = rows.find(row =>
    row[idIdx].toString().trim() === studentId.trim() &&
    row[emailIdx].toString().trim().toLowerCase() === email.trim().toLowerCase()
  );

  if (!voter) {
    return { success: false, message: "No matching record found. Please check your Student ID and email, or contact the election committee." };
  }

  // Check eligibility
  const eligible = voter[eligibleIdx];
  if (!isTruthyValue(eligible)) {
    return { success: false, message: "You are not eligible to vote. Please contact the election committee." };
  }

  // Check if already voted
  const hasVoted = voter[votedIdx];
  if (isTruthyValue(hasVoted)) {
    return { success: false, message: "You have already cast your vote. Each student may only vote once." };
  }

  return {
    success: true,
    voter: {
      student_id: voter[idIdx],
      full_name: voter[nameIdx],
      school_email: voter[emailIdx],
      course: voter[courseIdx],
      year_level: voter[yearIdx],
    }
  };
}

function getAdminPasswordHashForSetup(password) {
  const secret = PropertiesService.getScriptProperties().getProperty("AUTH_SECRET");
  if (!secret) {
    throw new Error("Set AUTH_SECRET in Script Properties before generating an admin password hash.");
  }
  const hash = hashPasswordWithSecret_(String(password || ""), secret);
  Logger.log(hash);
  return hash;
}

function logAdminPasswordHashForSetup() {
  const password = "CHANGE_ME_TO_A_STRONG_PASSWORD";
  if (password === "CHANGE_ME_TO_A_STRONG_PASSWORD") {
    throw new Error(
      "Edit logAdminPasswordHashForSetup() with your real admin password, run it once, then copy the logged hash into Script Properties as ADMIN_PASSWORD_HASH."
    );
  }
  return getAdminPasswordHashForSetup(password);
}

// ===== ADD CANDIDATE (admin) =====
function addCandidate(token, candidate) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }

  if (!candidate || !candidate.full_name || !candidate.position || !candidate.course || !candidate.year_level || !candidate.platform) {
    return { success: false, message: "Full name, position, course, year level, and platform are required." };
  }

  const ss = openSpreadsheet_();
  const sheet = getSheetOrThrow(ss, SHEETS.CANDIDATES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  // Auto-generate candidate_id: find the highest existing C-number and increment
  const headerMap = getHeaderMap(headers);
  const idIdx = requireHeader(headerMap, "candidate_id", SHEETS.CANDIDATES);
  const existingIds = data.slice(1)
    .map(r => String(r[idIdx] || ""))
    .filter(id => /^C\d+$/.test(id))
    .map(id => parseInt(id.slice(1), 10));
  const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  const candidateId = "C" + String(nextNum).padStart(3, "0");

  sheet.appendRow(buildRowFromHeaders(headers, {
    candidate_id: candidateId,
    full_name:    candidate.full_name.trim(),
    position:     candidate.position.trim(),
    course:       candidate.course.trim(),
    year_level:   candidate.year_level.trim(),
    platform:     candidate.platform.trim(),
    photo_url:    (candidate.photo_url || "").trim(),
    party:        (candidate.party || "").trim(),
  }));

  return { success: true, candidate_id: candidateId, message: `${candidate.full_name.trim()} added successfully as ${candidate.position.trim()}.` };
}

// ===== GET VOTE RESULTS (admin) =====
function getVoteResults(token) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }

  const ss = openSpreadsheet_();
  const votesSheet = ss.getSheetByName(SHEETS.VOTES);
  const candidatesSheet = getSheetOrThrow(ss, SHEETS.CANDIDATES);
  const votersSheet = getSheetOrThrow(ss, SHEETS.VOTERS);

  // Build candidate lookup: id → { full_name, position, party }
  const candData = candidatesSheet.getDataRange().getValues();
  const candHeaders = candData[0].map(h => String(h).trim());
  const candMap = getHeaderMap(candHeaders);
  const candidateLookup = {};
  candData.slice(1).forEach(row => {
    const id = String(row[candMap["candidate_id"]] || "").trim();
    if (id) {
      candidateLookup[id] = {
        full_name: String(row[candMap["full_name"]] || ""),
        position:  String(row[candMap["position"]]  || ""),
        party:     String(row[candMap["party"]]     || ""),
      };
    }
  });

  // Build position order from candidates sheet
  const positionOrder = [];
  candData.slice(1).forEach(row => {
    const pos = String(row[candMap["position"]] || "").trim();
    if (pos && !positionOrder.includes(pos)) positionOrder.push(pos);
  });

  // Count votes per candidate
  const voteCounts = {}; // { candidate_id: count }
  if (votesSheet) {
    const voteData = votesSheet.getDataRange().getValues();
    if (voteData.length > 1) {
      const voteHeaders = voteData[0].map(h => String(h).trim());
      const voteMap = getHeaderMap(voteHeaders);
      const candIdIdx = voteMap["candidate_id"];
      voteData.slice(1).forEach(row => {
        const cid = String(row[candIdIdx] || "").trim();
        if (cid) voteCounts[cid] = (voteCounts[cid] || 0) + 1;
      });
    }
  }

  // Turnout
  const voterData = votersSheet.getDataRange().getValues();
  const voterHeaders = voterData[0].map(h => String(h).trim());
  const voterMap = getHeaderMap(voterHeaders);
  const votedIdx = voterMap["has_voted"];
  const allVoters = voterData.slice(1).filter(r => String(r[voterMap["student_id"]] || "").trim() !== "");
  const totalVoters = allVoters.length;
  const totalVoted  = allVoters.filter(r => isTruthyValue(r[votedIdx])).length;

  // Group candidates by position with vote counts
  const byPosition = {};
  Object.entries(candidateLookup).forEach(([id, cand]) => {
    const pos = cand.position;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push({
      candidate_id: id,
      full_name:    cand.full_name,
      party:        cand.party,
      votes:        voteCounts[id] || 0,
    });
  });

  // Sort candidates within each position by votes descending
  Object.values(byPosition).forEach(arr => arr.sort((a, b) => b.votes - a.votes));

  const positions = positionOrder
    .filter(pos => byPosition[pos])
    .map(pos => ({
      position:   pos,
      candidates: byPosition[pos],
      total_votes: byPosition[pos].reduce((s, c) => s + c.votes, 0),
    }));

  return {
    success: true,
    turnout: { total: totalVoters, voted: totalVoted },
    positions,
  };
}

// ===== GET CANDIDATES =====
function getCandidates() {
  const ss = openSpreadsheet_();
  const sheet = getSheetOrThrow(ss, SHEETS.CANDIDATES);
  const data = sheet.getDataRange().getValues();

  const headers = data[0].map(h => String(h).trim());
  const headerMap = getHeaderMap(headers);
  const candidateIdIdx = requireHeader(headerMap, "candidate_id", SHEETS.CANDIDATES);
  const rows = data.slice(1);

  const candidates = rows
    .filter(row => String(row[candidateIdIdx] || "").trim() !== "") // skip empty rows
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

  return { success: true, candidates };
}

// ===== SUBMIT VOTE =====
function submitVote(studentId, votes, timestamp) {
  if (!studentId || !votes) {
    return { success: false, message: "Invalid vote data." };
  }

  const ss = openSpreadsheet_();

  // --- Lock to prevent concurrent writes ---
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "Server is busy. Please try again." };
  }

  try {
    // 1. Double-check voter hasn't already voted
    const votersSheet = getSheetOrThrow(ss, SHEETS.VOTERS);
    const voterData = votersSheet.getDataRange().getValues();
    const vHeaders = voterData[0].map(h => String(h).trim());
    const voterHeaderMap = getHeaderMap(vHeaders);
    const idIdx = requireHeader(voterHeaderMap, "student_id", SHEETS.VOTERS);
    const votedIdx = requireHeader(voterHeaderMap, "has_voted", SHEETS.VOTERS);
    const votedAtIdx = requireHeader(voterHeaderMap, "voted_at", SHEETS.VOTERS);

    let voterRowIndex = -1;
    for (let i = 1; i < voterData.length; i++) {
      if (voterData[i][idIdx].toString().trim() === studentId.trim()) {
        voterRowIndex = i + 1; // 1-indexed for Sheets
        if (isTruthyValue(voterData[i][votedIdx])) {
          return { success: false, message: "You have already voted." };
        }
        break;
      }
    }

    if (voterRowIndex === -1) {
      return { success: false, message: "Voter not found." };
    }

    // 2. Generate reference number
    const now = new Date();
    const refNum = "AAA-" +
      now.getFullYear().toString().slice(-2) +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      "-" +
      Math.random().toString(36).substring(2, 7).toUpperCase();

    // 3. Record each vote in Votes sheet
    const votesSheet = getSheetOrThrow(ss, SHEETS.VOTES);
    const voteData = votesSheet.getDataRange().getValues();
    const voteHeaders = voteData[0].map(h => String(h).trim());
    const voteTimestamp = timestamp || new Date().toISOString();

    // Generate sequential vote IDs
    let voteCounter = votesSheet.getLastRow(); // 1 row = header, so starts at 1

    Object.entries(votes).forEach(([position, candidateId]) => {
      voteCounter++;
      votesSheet.appendRow(buildRowFromHeaders(voteHeaders, {
        vote_id: "V" + String(voteCounter).padStart(5, "0"),
        student_id: studentId,
        position: position,
        candidate_id: candidateId,
        timestamp: voteTimestamp,
        reference_number: refNum,
      }));
    });

    // 4. Mark voter as has_voted in Voters sheet
    votersSheet.getRange(voterRowIndex, votedIdx + 1).setValue(true);
    votersSheet.getRange(voterRowIndex, votedAtIdx + 1).setValue(voteTimestamp);

    return { success: true, reference: refNum };

  } finally {
    lock.releaseLock();
  }
}

// ===== DELETE CANDIDATE (admin) =====
function deleteCandidate(token, candidateId) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }
  if (!candidateId) {
    return { success: false, message: "Candidate ID is required." };
  }

  const ss = openSpreadsheet_();
  const sheet = getSheetOrThrow(ss, SHEETS.CANDIDATES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const headerMap = getHeaderMap(headers);
  const idIdx = requireHeader(headerMap, "candidate_id", SHEETS.CANDIDATES);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx] || "").trim() === String(candidateId).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Candidate deleted." };
    }
  }

  return { success: false, message: "Candidate not found." };
}

// ===== RESET VOTER STATUS (admin) =====
function resetVoterStatus(token, studentId) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }
  if (!studentId) {
    return { success: false, message: "Student ID is required." };
  }

  const ss = openSpreadsheet_();
  const sheet = getSheetOrThrow(ss, SHEETS.VOTERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const headerMap = getHeaderMap(headers);
  const idIdx = requireHeader(headerMap, "student_id", SHEETS.VOTERS);
  const votedIdx = requireHeader(headerMap, "has_voted", SHEETS.VOTERS);
  const votedAtIdx = requireHeader(headerMap, "voted_at", SHEETS.VOTERS);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx] || "").trim() === String(studentId).trim()) {
      sheet.getRange(i + 1, votedIdx + 1).setValue(false);
      sheet.getRange(i + 1, votedAtIdx + 1).setValue("");
      return { success: true, message: "Voter status reset." };
    }
  }

  return { success: false, message: "Voter not found." };
}

// =====================================================
// COPY UNTIL HERE
// End of Code.gs
// =====================================================
