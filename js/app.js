// =====================================================
// app.js — AAA Election System Main Logic
// =====================================================

// ===== STATE =====
const STATE = {
  currentVoter: null,
  candidates: [],
  positions: [],
  votes: {},        // { position: candidate_id }
  isVerified: false,
};

// ===== NAVIGATION =====
function goToStep(stepId) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(stepId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (stepId === 'stepCandidates') renderCandidates(false);
  if (stepId === 'stepBallot') renderBallot();
}

function proceedToVote() {
  if (!STATE.isVerified) {
    goToStep('stepVerify');
    return;
  }
  goToStep('stepBallot');
}

// ===== VOTER VERIFICATION =====
async function verifyVoter() {
  clearErrors();

  const studentId = document.getElementById('studentId').value.trim();
  const schoolEmail = document.getElementById('schoolEmail').value.trim().toLowerCase();

  // --- Client-side validation ---
  let hasError = false;

  if (!studentId) {
    showFieldError('studentIdError', 'Please enter your Student ID.');
    hasError = true;
  }

  if (!schoolEmail) {
    showFieldError('schoolEmailError', 'Please enter your school email.');
    hasError = true;
  } else if (!schoolEmail.endsWith(CONFIG.ALLOWED_EMAIL_DOMAIN)) {
    showFieldError('schoolEmailError', `Email must end with ${CONFIG.ALLOWED_EMAIL_DOMAIN}`);
    hasError = true;
  }

  if (hasError) return;

  // --- Show loading ---
  setVerifyLoading(true);
  showFormMessage('verifyMessage', 'Verifying your credentials...', 'info');

  try {
    let result;

    if (CONFIG.USE_SAMPLE_DATA) {
      result = await verifySampleData(studentId, schoolEmail);
    } else {
      result = await verifyWithSheets(studentId, schoolEmail);
    }

    if (result.success) {
      STATE.currentVoter = result.voter;
      STATE.isVerified = true;

      // Update UI with voter name
      document.getElementById('voterName').textContent = result.voter.full_name;
      updateHeaderStatus(`✓ Verified: ${result.voter.full_name}`);

      showFormMessage('verifyMessage', `Welcome, ${result.voter.full_name}! Identity verified. You may now proceed to vote.`, 'success');

      // Load candidates and go to ballot after short delay
      await loadCandidates();
      setTimeout(() => goToStep('stepCandidates'), 1200);

    } else {
      showFormMessage('verifyMessage', result.message, 'error');
    }
  } catch (err) {
    showFormMessage('verifyMessage', 'Connection error. Please check your internet and try again.', 'error');
    console.error('Verification error:', err);
  } finally {
    setVerifyLoading(false);
  }
}

// --- Verify against sample data (for testing) ---
function verifySampleData(studentId, email) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const voter = SAMPLE_DATA.voters.find(
        v => v.student_id === studentId &&
             v.school_email.toLowerCase() === email &&
             v.eligible === true
      );

      if (!voter) {
        return resolve({ success: false, message: 'No matching record found. Please check your Student ID and email, or contact the election committee.' });
      }

      if (voter.has_voted) {
        return resolve({ success: false, message: 'You have already voted. Each student may only vote once.' });
      }

      resolve({ success: true, voter });
    }, 1000);
  });
}

// --- Verify against Google Sheets via Apps Script ---
async function verifyWithSheets(studentId, email) {
  const url = `${CONFIG.APPS_SCRIPT_URL}?action=verify&student_id=${encodeURIComponent(studentId)}&email=${encodeURIComponent(email)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Network response error');
  return await response.json();
}

// ===== LOAD CANDIDATES =====
async function loadCandidates() {
  if (STATE.candidates.length > 0) return; // already loaded

  try {
    let candidates;
    if (CONFIG.USE_SAMPLE_DATA) {
      candidates = SAMPLE_DATA.candidates;
    } else {
      const url = `${CONFIG.APPS_SCRIPT_URL}?action=getCandidates`;
      const response = await fetch(url);
      const data = await response.json();
      candidates = data.candidates;
    }

    STATE.candidates = candidates;
    STATE.positions = [...new Set(candidates.map(c => c.position))];
  } catch (err) {
    console.error('Failed to load candidates:', err);
  }
}

// ===== RENDER CANDIDATES (preview mode) =====
let activeFilter = 'all'; // 'all', 'independent', or party name

function renderCandidates(showVoteButton = false) {
  const wrapper = document.getElementById('candidatesDisplay');
  const footer = document.getElementById('candidatesFooter');
  const backBtn = document.getElementById('candidatesBackBtn');

  if (STATE.candidates.length === 0) {
    loadCandidates().then(() => renderCandidates(showVoteButton));
    return;
  }

  backBtn.onclick = () => goToStep(STATE.isVerified ? 'stepBallot' : 'stepLanding');
  if (footer) footer.style.display = STATE.isVerified ? 'block' : 'none';

  // Collect unique parties
  const parties = [...new Set(STATE.candidates.map(c => c.party).filter(p => p && p.trim() !== ''))];
  const hasIndependent = STATE.candidates.some(c => !c.party || c.party.trim() === '');

  // Filter buttons HTML
  let filterHtml = `<div class="party-filters">
    <button class="party-filter-btn ${activeFilter === 'all' ? 'active' : ''}" onclick="setPartyFilter('all')">All</button>
    ${parties.map(p => `<button class="party-filter-btn ${activeFilter === p ? 'active' : ''}" onclick="setPartyFilter('${p}')">${p}</button>`).join('')}
    ${hasIndependent ? `<button class="party-filter-btn ${activeFilter === 'independent' ? 'active' : ''}" onclick="setPartyFilter('independent')">Independent</button>` : ''}
  </div>`;

  // Filter candidates
  let filtered = STATE.candidates;
  if (activeFilter === 'independent') filtered = STATE.candidates.filter(c => !c.party || c.party.trim() === '');
  else if (activeFilter !== 'all') filtered = STATE.candidates.filter(c => c.party === activeFilter);

  // Group by position — always follow original position order
  const positions = STATE.positions.filter(p => filtered.some(c => c.position === p));
  let html = filterHtml;

  if (filtered.length === 0) {
    html += `<div class="loading-state"><p>No candidates found for this filter.</p></div>`;
  } else {
    positions.forEach(position => {
      const positionCandidates = filtered.filter(c => c.position === position);
      html += `
        <div class="position-group">
          <div class="position-label">${position}</div>
          <div class="candidate-cards">
            ${positionCandidates.map(c => renderCandidateCard(c)).join('')}
          </div>
        </div>
      `;
    });
  }

  wrapper.innerHTML = html;
}

function setPartyFilter(filter) {
  activeFilter = filter;
  renderCandidates();
}

function renderCandidateCard(c) {
  const initials = getInitials(c.full_name);
  const photo = c.photo_url
    ? `<img src="${c.photo_url}" alt="${c.full_name}" onerror="this.parentElement.innerHTML='<div class=&quot;candidate-photo-placeholder&quot;>${initials}</div>'" />`
    : `<div class="candidate-photo-placeholder">${initials}</div>`;
  const partyHtml = c.party && c.party.trim() !== ''
    ? `<span class="party-badge" style="--party-color:${getPartyColor(c.party)}">🏛 ${c.party}</span>`
    : `<span class="party-badge party-independent">Independent</span>`;

  return `
    <div class="candidate-card" onclick="openCandidateModal('${c.candidate_id}')">
      <div class="candidate-photo-wrap">${photo}</div>
      <div class="candidate-info">
        <p class="candidate-name">${c.full_name}</p>
        <span class="candidate-position-badge">${c.position}</span>
        ${partyHtml}
        <p class="candidate-meta">${c.course} · ${c.year_level}</p>
        <p class="candidate-platform-preview">${c.platform}</p>
      </div>
    </div>
  `;
}

// ===== CANDIDATE MODAL =====
function openCandidateModal(candidateId) {
  const c = STATE.candidates.find(c => c.candidate_id === candidateId);
  if (!c) return;

  const initials = getInitials(c.full_name);
  const photoHtml = c.photo_url
    ? `<img class="modal-photo" src="${c.photo_url}" alt="${c.full_name}" onerror="this.outerHTML='<div class=&quot;modal-photo-placeholder&quot;>${initials}</div>'" />`
    : `<div class="modal-photo-placeholder">${initials}</div>`;

  const partyModalHtml = c.party && c.party.trim() !== ''
    ? `<span class="party-badge" style="--party-color:${getPartyColor(c.party)}">🏛 ${c.party}</span>`
    : `<span class="party-badge party-independent">Independent</span>`;

  document.getElementById('modalContent').innerHTML = `
    ${photoHtml}
    <div class="modal-body">
      <span class="modal-position-badge">${c.position}</span>
      <h2 class="modal-name">${c.full_name}</h2>
      <p class="modal-course">${c.course} · ${c.year_level}</p>
      ${partyModalHtml}
      <br/>
      <p class="modal-section-label">Platform</p>
      <p class="modal-platform">${c.platform}</p>
    </div>
  `;

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== RENDER BALLOT =====
function renderBallot() {
  if (STATE.candidates.length === 0) {
    loadCandidates().then(() => renderBallot());
    return;
  }

  const wrapper = document.getElementById('ballotDisplay');
  let html = '';

  STATE.positions.forEach(position => {
    const positionCandidates = STATE.candidates.filter(c => c.position === position);
    html += `
      <div class="ballot-position-group" id="ballot-${sanitizeId(position)}">
        <div class="ballot-position-header">
          <h3>${position}</h3>
          <p>Choose one candidate</p>
        </div>
        <div class="ballot-candidates">
          ${positionCandidates.map(c => renderBallotOption(c, position)).join('')}
        </div>
      </div>
    `;
  });

  wrapper.innerHTML = html;
  updateProgress();
}

function renderBallotOption(c, position) {
  const initials = getInitials(c.full_name);
  const photo = c.photo_url
    ? `<img src="${c.photo_url}" alt="${c.full_name}" onerror="this.parentElement.innerHTML='<div class=&quot;ballot-cand-initials&quot;>${initials}</div>'" />`
    : `<div class="ballot-cand-initials">${initials}</div>`;

  const isSelected = STATE.votes[position] === c.candidate_id;

  return `
    <div class="ballot-option ${isSelected ? 'selected' : ''}"
         id="option-${c.candidate_id}"
         onclick="selectCandidate('${position}', '${c.candidate_id}')">
      <div class="ballot-radio"></div>
      <div class="ballot-cand-photo">${photo}</div>
      <div class="ballot-cand-info">
        <p class="ballot-cand-name">${c.full_name}</p>
        <p class="ballot-cand-meta">${c.course} · ${c.year_level}</p>
      </div>
    </div>
  `;
}

function selectCandidate(position, candidateId) {
  STATE.votes[position] = candidateId;

  // Update UI for this position group
  const group = document.getElementById(`ballot-${sanitizeId(position)}`);
  if (group) {
    group.querySelectorAll('.ballot-option').forEach(opt => opt.classList.remove('selected'));
    const selected = document.getElementById(`option-${candidateId}`);
    if (selected) selected.classList.add('selected');
  }

  updateProgress();
}

function updateProgress() {
  const total = STATE.positions.length;
  const filled = Object.keys(STATE.votes).length;
  document.getElementById('progressCount').textContent = `${filled} / ${total}`;
  const pct = total > 0 ? (filled / total) * 100 : 0;
  document.getElementById('progressFill').style.width = `${pct}%`;

  const reviewBtn = document.getElementById('reviewBtn');
  reviewBtn.disabled = filled < total;
}

// ===== REVIEW =====
function goToReview() {
  if (Object.keys(STATE.votes).length < STATE.positions.length) return;

  const wrapper = document.getElementById('reviewDisplay');
  let html = '';

  STATE.positions.forEach(position => {
    const candidateId = STATE.votes[position];
    const c = STATE.candidates.find(c => c.candidate_id === candidateId);
    if (!c) return;

    const initials = getInitials(c.full_name);
    const photo = c.photo_url
      ? `<img src="${c.photo_url}" alt="${c.full_name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div class=&quot;review-photo-init&quot;>${initials}</div>'" />`
      : `<div class="review-photo-init">${initials}</div>`;

    html += `
      <div class="review-item">
        <div class="review-position">
          <p class="review-position-label">Position</p>
          <p class="review-position-name">${position}</p>
        </div>
        <div class="review-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="review-candidate">
          <div class="review-photo">${photo}</div>
          <div>
            <p class="review-name">${c.full_name}</p>
            <p class="review-meta">${c.course} · ${c.year_level}</p>
          </div>
        </div>
      </div>
    `;
  });

  wrapper.innerHTML = html;
  goToStep('stepReview');
}

// ===== SUBMIT VOTE =====
async function submitVote() {
  if (!STATE.isVerified || !STATE.currentVoter) {
    alert('Session expired. Please verify your identity again.');
    goToStep('stepVerify');
    return;
  }

  setSubmitLoading(true);

  try {
    let result;

    if (CONFIG.USE_SAMPLE_DATA) {
      result = await submitSampleVote();
    } else {
      result = await submitToSheets();
    }

    if (result.success) {
      // Mark voter as voted in sample data too
      if (CONFIG.USE_SAMPLE_DATA) {
        const voter = SAMPLE_DATA.voters.find(v => v.student_id === STATE.currentVoter.student_id);
        if (voter) voter.has_voted = true;
      }

      // Generate reference number
      const refNum = result.reference || generateRefNumber();
      document.getElementById('refNumber').textContent = refNum;

      // Build success summary (same as review items)
      const summaryWrapper = document.getElementById('successSummary');
      let summaryHtml = '';
      STATE.positions.forEach(position => {
        const candidateId = STATE.votes[position];
        const c = STATE.candidates.find(c => c.candidate_id === candidateId);
        if (!c) return;
        const initials = getInitials(c.full_name);
        summaryHtml += `
          <div class="review-item">
            <div class="review-position">
              <p class="review-position-label">Position</p>
              <p class="review-position-name">${position}</p>
            </div>
            <div class="review-candidate" style="margin-left:auto;">
              <div class="review-photo">
                ${c.photo_url
                  ? `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div class=&quot;review-photo-init&quot;>${initials}</div>'" />`
                  : `<div class="review-photo-init">${initials}</div>`}
              </div>
              <div>
                <p class="review-name">${c.full_name}</p>
                <p class="review-meta">${c.course}</p>
              </div>
            </div>
          </div>
        `;
      });
      summaryWrapper.innerHTML = summaryHtml;

      goToStep('stepSuccess');
    } else {
      alert('Failed to submit vote: ' + result.message);
    }
  } catch (err) {
    alert('Submission error. Please try again or contact the election committee.');
    console.error('Submit error:', err);
  } finally {
    setSubmitLoading(false);
  }
}

function submitSampleVote() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, reference: generateRefNumber() });
    }, 1500);
  });
}

async function submitToSheets() {
  const votesEncoded = encodeURIComponent(JSON.stringify(STATE.votes));
  const timestamp = encodeURIComponent(new Date().toISOString());
  const url = `${CONFIG.APPS_SCRIPT_URL}?action=submitVote&student_id=${encodeURIComponent(STATE.currentVoter.student_id)}&votes=${votesEncoded}&timestamp=${timestamp}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Network error');
  return await response.json();
}

// ===== HELPERS =====
function generateRefNumber() {
  const now = new Date();
  const ts = now.getFullYear().toString().slice(-2)
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `AAA-${ts}-${rand}`;
}

// Party color map — assign consistent colors per party name
const PARTY_COLORS = {};
const PARTY_COLOR_PALETTE = ['#4a90d9','#e07b39','#27ae60','#8e44ad','#e74c3c','#16a085','#d4ac0d'];
function getPartyColor(party) {
  if (!PARTY_COLORS[party]) {
    const idx = Object.keys(PARTY_COLORS).length % PARTY_COLOR_PALETTE.length;
    PARTY_COLORS[party] = PARTY_COLOR_PALETTE[idx];
  }
  return PARTY_COLORS[party];
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function sanitizeId(str) {
  return str.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
  const inputId = id.replace('Error', '');
  const input = document.getElementById(inputId);
  if (input) input.classList.add('error');
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
  const msg = document.getElementById('verifyMessage');
  if (msg) { msg.className = 'form-message'; msg.textContent = ''; msg.style.display = 'none'; }
}

function showFormMessage(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `form-message ${type}`;
  el.style.display = 'block';
}

function setVerifyLoading(isLoading) {
  const btn = document.getElementById('verifyBtn');
  const text = document.getElementById('verifyBtnText');
  const spinner = document.getElementById('verifySpinner');
  if (isLoading) {
    btn.disabled = true;
    text.textContent = 'Verifying...';
    spinner.classList.remove('hidden');
  } else {
    btn.disabled = false;
    text.textContent = 'Verify Identity';
    spinner.classList.add('hidden');
  }
}

function setSubmitLoading(isLoading) {
  const btn = document.getElementById('submitBtn');
  const text = document.getElementById('submitBtnText');
  const spinner = document.getElementById('submitSpinner');
  if (isLoading) {
    btn.disabled = true;
    text.textContent = 'Submitting...';
    spinner.classList.remove('hidden');
  } else {
    btn.disabled = false;
    text.textContent = 'Submit Vote';
    spinner.classList.add('hidden');
  }
}

function updateHeaderStatus(msg) {
  const el = document.getElementById('headerStatus');
  if (el) el.textContent = msg;
}

// ===== KEYBOARD: close modal on Escape =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadCandidates(); // preload in background
});

// ===== BACK TO TOP =====
function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', () => {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  if (window.scrollY > 300) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
});

// ===== ELECTION GUIDELINES MODAL =====
function openGuidelinesModal() {
  document.getElementById('guidelinesOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeGuidelinesModal() {
  document.getElementById('guidelinesOverlay').classList.remove('open');
  document.body.style.overflow = '';
}