// =====================================================
// Code.gs — Google Apps Script Backend
// AAA Election System
//
// HOW TO SET UP:
// 1. Go to script.google.com and create a new project
// 2. Paste this entire code into Code.gs
// 3. Replace SPREADSHEET_ID with your Google Sheets ID
// 4. Deploy as Web App (see README for instructions)
// =====================================================

// 🔗 REPLACE THIS with your Google Sheets ID
// (found in the URL: docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit)
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";

// Sheet names (must match exactly)
const SHEETS = {
  VOTERS: "Voters",
  CANDIDATES: "Candidates",
  VOTES: "Votes",
  SETTINGS: "Settings",
};

// ===== SETTINGS HELPERS =====
function getSetting(key) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  const data = sheet.getDataRange().getValues();
  const row = data.find(r => r[0] === key);
  return row ? row[1] : null;
}

function setSetting(key, value) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.SETTINGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
}

function isValidAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const adminUser = getSetting("admin_username");
    return decoded.startsWith(adminUser + ":");
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
    } else if (action === "getCandidates") {
      result = getCandidates();
    } else if (action === "registerVoter") {
      result = registerVoter(
        e.parameter.student_id,
        e.parameter.last_name,
        e.parameter.first_name,
        e.parameter.email,
        e.parameter.course,
        e.parameter.year_level
      );
    } else if (action === "adminLogin") {
      result = adminLogin(e.parameter.username, e.parameter.password);
    } else if (action === "getVoters") {
      result = getVoters(e.parameter.token);
    } else if (action === "setElectionStatus") {
      result = setElectionStatus(e.parameter.token, e.parameter.active);
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
function registerVoter(studentId, lastName, firstName, email, course, yearLevel) {
  if (!studentId || !lastName || !firstName || !email) {
    return { success: false, message: "All required fields must be filled in." };
  }

  if (!email.toLowerCase().endsWith("@sjp2cd.edu.ph")) {
    return { success: false, message: "Email must end with @sjp2cd.edu.ph." };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.VOTERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  const idIdx    = headers.indexOf("student_id");
  const emailIdx = headers.indexOf("school_email");

  const duplicate = rows.find(r =>
    r[idIdx].toString().trim() === studentId.trim() ||
    r[emailIdx].toString().trim().toLowerCase() === email.trim().toLowerCase()
  );
  if (duplicate) {
    return { success: false, message: "A voter with this Student ID or email is already registered." };
  }

  const fullName = firstName.trim() + " " + lastName.trim();
  sheet.appendRow([
    studentId.trim(),
    fullName,
    email.trim().toLowerCase(),
    (course || "").trim(),
    (yearLevel || "").trim(),
    true,
    false,
    "",
  ]);

  return { success: true, message: "Registration successful! You are now in the voter masterlist." };
}

// ===== ADMIN LOGIN =====
function adminLogin(username, password) {
  if (!username || !password) {
    return { success: false, message: "Credentials required." };
  }
  const storedUser = getSetting("admin_username");
  const storedPass = getSetting("admin_password");

  if (username.trim() === storedUser && password.trim() === storedPass) {
    const token = Utilities.base64Encode(username + ":" + Date.now());
    return { success: true, token: token };
  }
  return { success: false, message: "Invalid username or password." };
}

// ===== GET VOTERS (admin) =====
function getVoters(token) {
  if (!isValidAdminToken(token)) {
    return { success: false, message: "Unauthorized." };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.VOTERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  const voters = rows
    .filter(r => r[0] !== "")
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });

  const electionActive = getSetting("election_active");
  const total    = voters.length;
  const voted    = voters.filter(v => v.has_voted === true || v.has_voted === "TRUE").length;

  return {
    success: true,
    election_active: (electionActive === true || electionActive === "TRUE"),
    stats: { total, voted, not_voted: total - voted },
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

// ===== VERIFY VOTER =====
function verifyVoter(studentId, email) {
  if (!studentId || !email) {
    return { success: false, message: "Missing student ID or email." };
  }

  // Check if election is currently open
  const electionActive = getSetting("election_active");
  if (electionActive !== true && electionActive !== "TRUE") {
    return { success: false, message: "The election is not currently open. Please check back during the election period." };
  }

  // Validate email domain
  if (!email.toLowerCase().endsWith("@sjp2cd.edu.ph")) {
    return { success: false, message: "Email must end with @sjp2cd.edu.ph." };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.VOTERS);
  const data = sheet.getDataRange().getValues();

  // Row 0 = headers: student_id, full_name, school_email, course, year_level, eligible, has_voted, voted_at
  const headers = data[0];
  const rows = data.slice(1);

  const idIdx = headers.indexOf("student_id");
  const nameIdx = headers.indexOf("full_name");
  const emailIdx = headers.indexOf("school_email");
  const courseIdx = headers.indexOf("course");
  const yearIdx = headers.indexOf("year_level");
  const eligibleIdx = headers.indexOf("eligible");
  const votedIdx = headers.indexOf("has_voted");

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
  if (eligible === false || eligible === "FALSE" || eligible === "No") {
    return { success: false, message: "You are not eligible to vote. Please contact the election committee." };
  }

  // Check if already voted
  const hasVoted = voter[votedIdx];
  if (hasVoted === true || hasVoted === "TRUE" || hasVoted === "Yes") {
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

// ===== GET CANDIDATES =====
function getCandidates() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CANDIDATES);
  const data = sheet.getDataRange().getValues();

  const headers = data[0];
  const rows = data.slice(1);

  const candidates = rows
    .filter(row => row[0] !== "") // skip empty rows
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

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // --- Lock to prevent concurrent writes ---
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "Server is busy. Please try again." };
  }

  try {
    // 1. Double-check voter hasn't already voted
    const votersSheet = ss.getSheetByName(SHEETS.VOTERS);
    const voterData = votersSheet.getDataRange().getValues();
    const vHeaders = voterData[0];
    const idIdx = vHeaders.indexOf("student_id");
    const votedIdx = vHeaders.indexOf("has_voted");
    const votedAtIdx = vHeaders.indexOf("voted_at");

    let voterRowIndex = -1;
    for (let i = 1; i < voterData.length; i++) {
      if (voterData[i][idIdx].toString().trim() === studentId.trim()) {
        voterRowIndex = i + 1; // 1-indexed for Sheets
        if (voterData[i][votedIdx] === true || voterData[i][votedIdx] === "TRUE") {
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
    const votesSheet = ss.getSheetByName(SHEETS.VOTES);
    const voteTimestamp = timestamp || new Date().toISOString();

    // Generate sequential vote IDs
    const lastRow = votesSheet.getLastRow();
    let voteCounter = lastRow; // 1 row = header, so starts at 1

    Object.entries(votes).forEach(([position, candidateId]) => {
      voteCounter++;
      votesSheet.appendRow([
        "V" + String(voteCounter).padStart(5, "0"), // vote_id
        studentId,                                   // student_id
        position,                                    // position
        candidateId,                                 // candidate_id
        voteTimestamp,                               // timestamp
        refNum,                                      // reference_number
      ]);
    });

    // 4. Mark voter as has_voted in Voters sheet
    votersSheet.getRange(voterRowIndex, votedIdx + 1).setValue(true);
    votersSheet.getRange(voterRowIndex, votedAtIdx + 1).setValue(voteTimestamp);

    return { success: true, reference: refNum };

  } finally {
    lock.releaseLock();
  }
}
