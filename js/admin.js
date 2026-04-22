// =====================================================
// admin.js — AAA Election System Admin Features
// Handles: voter registration, admin login, dashboard
// =====================================================

// ===== ADMIN STATE =====
const ADMIN_STATE = {
  token: sessionStorage.getItem("adminToken") || null,
  electionActive: false,
  candidatesVisible: true,
  registrationOpen: true,
  voters: [],
  activeTab: 'overview',
  voteAnalytics: null,
};

const ADMIN_ACTION_MODAL = {
  resolver: null,
  activeTrigger: null,
};

function explainAdminApiMessage(message) {
  if (message === 'Unknown action.') {
    return 'This Apps Script deployment is outdated. Re-deploy the latest Code.gs and update APPS_SCRIPT_URL if the web app URL changed.';
  }
  if (message && message.includes('Configure ADMIN_USERNAME, AUTH_SECRET')) {
    return 'Admin security is not configured yet. In Apps Script Script Properties, set ADMIN_USERNAME, AUTH_SECRET, and either ADMIN_PASSWORD_HASH or ADMIN_PASSWORD.';
  }
  if (message && message.includes('SPREADSHEET_ID is not defined')) {
    return 'The Apps Script deployment has no spreadsheet ID configured. Set SPREADSHEET_ID in Code.gs, then deploy a new web app version.';
  }
  if (message && message.includes('Set SPREADSHEET_ID in Code.gs')) {
    return 'The Apps Script deployment has no spreadsheet ID configured. Set SPREADSHEET_ID in Code.gs, then deploy a new web app version.';
  }
  return message;
}

function getAdminActionElements() {
  return {
    overlay: document.getElementById('adminActionOverlay'),
    modal: document.getElementById('adminActionModal'),
    closeBtn: document.getElementById('adminActionCloseBtn'),
    eyebrow: document.getElementById('adminActionEyebrow'),
    tonePill: document.getElementById('adminActionTonePill'),
    icon: document.getElementById('adminActionIcon'),
    title: document.getElementById('adminActionTitle'),
    message: document.getElementById('adminActionMessage'),
    state: document.getElementById('adminActionState'),
    currentValue: document.getElementById('adminActionCurrentValue'),
    nextValue: document.getElementById('adminActionNextValue'),
    cancelBtn: document.getElementById('adminActionCancelBtn'),
    confirmBtn: document.getElementById('adminActionConfirmBtn'),
  };
}

function getAdminActionIcon(tone) {
  if (tone === 'success') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v18"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>`;
  }
  if (tone === 'danger') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M12 15h.01"/></svg>`;
}

function closeAdminActionModal(result = false) {
  const { overlay } = getAdminActionElements();
  if (!overlay || !overlay.classList.contains('open')) return;

  overlay.classList.remove('open');

  const resolver = ADMIN_ACTION_MODAL.resolver;
  const activeTrigger = ADMIN_ACTION_MODAL.activeTrigger;
  ADMIN_ACTION_MODAL.resolver = null;
  ADMIN_ACTION_MODAL.activeTrigger = null;

  if (activeTrigger && typeof activeTrigger.focus === 'function') {
    setTimeout(() => activeTrigger.focus(), 0);
  }

  if (typeof resolver === 'function') {
    resolver(Boolean(result));
  }
}

function openAdminActionModal(options = {}) {
  const {
    tone = 'primary',
    toneLabel = 'Review',
    eyebrow = 'Admin Action',
    title = 'Confirm action',
    message = 'Choose how you want to continue.',
    currentValue = '',
    nextValue = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    mode = 'confirm',
  } = options;

  const elements = getAdminActionElements();
  if (!elements.overlay || !elements.modal) {
    if (mode === 'notice') {
      window.alert(`${title}\n\n${message}`);
      return Promise.resolve(true);
    }
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  if (ADMIN_ACTION_MODAL.resolver) {
    ADMIN_ACTION_MODAL.resolver(false);
    ADMIN_ACTION_MODAL.resolver = null;
  }

  ADMIN_ACTION_MODAL.activeTrigger = document.activeElement;

  elements.modal.dataset.tone = tone;
  elements.eyebrow.textContent = eyebrow;
  elements.tonePill.textContent = toneLabel;
  elements.icon.innerHTML = getAdminActionIcon(tone);
  elements.title.textContent = title;
  elements.message.textContent = message;
  elements.currentValue.textContent = currentValue;
  elements.nextValue.textContent = nextValue;
  elements.state.hidden = !(currentValue || nextValue);
  elements.cancelBtn.hidden = mode === 'notice';
  elements.cancelBtn.textContent = cancelText;
  elements.confirmBtn.textContent = confirmText;
  elements.confirmBtn.dataset.tone = tone;
  elements.closeBtn.setAttribute('aria-label', mode === 'notice' ? 'Close notice' : 'Close dialog');

  elements.overlay.classList.add('open');
  setTimeout(() => elements.confirmBtn.focus(), 60);

  return new Promise(resolve => {
    ADMIN_ACTION_MODAL.resolver = resolve;
  });
}

function showAdminNotice(options = {}) {
  return openAdminActionModal({
    mode: 'notice',
    tone: options.tone || 'primary',
    toneLabel: options.toneLabel || 'Notice',
    eyebrow: options.eyebrow || 'Admin Notice',
    title: options.title || 'Please review this message',
    message: options.message || '',
    confirmText: options.confirmText || 'Got it',
    currentValue: options.currentValue || '',
    nextValue: options.nextValue || '',
  });
}

document.addEventListener('keydown', (event) => {
  const { overlay } = getAdminActionElements();
  if (event.key === 'Escape' && overlay && overlay.classList.contains('open')) {
    event.preventDefault();
    closeAdminActionModal(false);
  }
});

// =====================================================
// ADMIN NAV TABS
// =====================================================

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab-panel').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.admin-sidebar-item[data-tab]').forEach(el => el.classList.remove('active'));

  const panel = document.getElementById('adminTab-' + tab);
  if (panel) panel.classList.remove('hidden');

  const btn = document.querySelector(`.admin-sidebar-item[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');

  ADMIN_STATE.activeTab = tab;

  const adminContent = document.querySelector('.admin-content');
  if (adminContent) {
    adminContent.scrollTop = 0;
  }

  const adminSidebar = document.getElementById('adminSidebar');
  if (adminSidebar) {
    adminSidebar.scrollTop = 0;
  }
}

// =====================================================
// ADMIN LOGIN
// =====================================================

function adminLogin() {
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value.trim();

  ['adminUsername', 'adminPassword'].forEach(id => {
    const err = document.getElementById(id + 'Error');
    if (err) err.textContent = '';
    const inp = document.getElementById(id);
    if (inp) inp.classList.remove('error');
  });

  let hasError = false;
  if (!username) { showFieldError('adminUsernameError', 'Username is required.'); hasError = true; }
  if (!password) { showFieldError('adminPasswordError', 'Password is required.'); hasError = true; }
  if (hasError) return;

  setAdminLoginLoading(true);
  showFormMessage('adminLoginMessage', 'Authenticating...', 'info');

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'adminLogin',
      username,
      password,
    }),
  })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        ADMIN_STATE.token = result.token;
        sessionStorage.setItem('adminToken', result.token);
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
        enterAdminMode();
        goToStep('stepAdminDashboard');
        loadAdminDashboard();
      } else {
        showFormMessage('adminLoginMessage', explainAdminApiMessage(result.message), 'error');
      }
    })
    .catch(() => showFormMessage('adminLoginMessage', 'Connection error. Please try again.', 'error'))
    .finally(() => setAdminLoginLoading(false));
}

function adminAccess() {
  if (ADMIN_STATE.token) {
    enterAdminMode();
    goToStep('stepAdminDashboard');
    loadAdminDashboard();
  } else {
    goToStep('stepAdminLogin');
  }
}

function enterAdminMode() {
  document.body.classList.add('admin-mode');
}

function exitAdminMode() {
  document.body.classList.remove('admin-mode');
}

function clearAdminSession() {
  ADMIN_STATE.token = null;
  ADMIN_STATE.voters = [];
  ADMIN_STATE.voteAnalytics = null;
  sessionStorage.removeItem('adminToken');
  exitAdminMode();
  goToStep('stepLanding');
}

async function adminLogout(options = {}) {
  if (options.force) {
    clearAdminSession();
    return;
  }

  const confirmed = await openAdminActionModal({
    tone: 'danger',
    toneLabel: 'Session',
    eyebrow: 'Admin Access',
    title: 'Log out of the dashboard?',
    message: 'This device will lose access to election controls until you sign in again.',
    currentValue: 'Signed In',
    nextValue: 'Logged Out',
    confirmText: 'Log Out',
    cancelText: 'Stay Here',
  });

  if (!confirmed) return;
  clearAdminSession();
}

function setAdminLoginLoading(isLoading) {
  const btn     = document.getElementById('adminLoginBtn');
  const text    = document.getElementById('adminLoginBtnText');
  const spinner = document.getElementById('adminLoginSpinner');
  btn.disabled = isLoading;
  text.textContent = isLoading ? 'Signing in...' : 'Sign In';
  spinner.classList.toggle('hidden', !isLoading);
}

// =====================================================
// ADMIN DASHBOARD
// =====================================================

function loadAdminDashboard() {
  if (!ADMIN_STATE.token) {
    goToStep('stepAdminLogin');
    return;
  }

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'getVoters', token: ADMIN_STATE.token }),
  })
    .then(r => r.json())
    .then(result => {
      if (!result.success) {
        showAdminNotice({
          tone: 'danger',
          toneLabel: 'Access',
          eyebrow: 'Admin Session',
          title: 'Dashboard access ended',
          message: explainAdminApiMessage(result.message || 'Your admin session is no longer valid.'),
          confirmText: 'Return to Login',
        }).finally(() => adminLogout({ force: true }));
        return;
      }
      ADMIN_STATE.electionActive = result.election_active;
      ADMIN_STATE.candidatesVisible = result.candidates_visible;
      ADMIN_STATE.registrationOpen = result.registration_open !== false;
      ADMIN_STATE.voters = result.voters;
      renderDashboard(result);
    })
    .catch(() => {
      showAdminNotice({
        tone: 'danger',
        toneLabel: 'Offline',
        eyebrow: 'Dashboard Refresh',
        title: 'Could not load dashboard data',
        message: 'The admin dashboard could not reach the server. Check your connection and try refresh again.',
        confirmText: 'Close',
      });
    });
}

function renderDashboard(data) {
  document.getElementById('statTotal').textContent    = data.stats.total;
  document.getElementById('statVoted').textContent    = data.stats.voted;
  document.getElementById('statNotVoted').textContent = data.stats.not_voted;
  updateStatusUI(data.election_active);
  updateCandidatesUI(data.candidates_visible !== false);
  updateRegistrationUI(data.registration_open !== false);
  renderVotersTable(data.voters);
  renderRegisteredVotersTable(data.registered_voters || []);
  renderCandidatesList();
  loadVoteResults();
  switchAdminTab(ADMIN_STATE.activeTab || 'overview');
}

function updateStatusUI(isActive) {
  const dot    = document.getElementById('adminStatusDot');
  const label  = document.getElementById('adminStatusLabel');
  const btnTxt = document.getElementById('adminToggleBtnText');
  const btn    = document.getElementById('adminToggleBtn');

  if (isActive) {
    dot.style.background = 'var(--success)';
    dot.style.boxShadow  = '0 0 0 4px var(--success-glow)';
    label.textContent    = 'Election is OPEN';
    label.style.color    = 'var(--success)';
    btnTxt.textContent   = 'End Election';
    btn.style.background = 'linear-gradient(135deg, var(--danger), #c0392b)';
  } else {
    dot.style.background = 'var(--danger)';
    dot.style.boxShadow  = '0 0 0 4px var(--danger-glow)';
    label.textContent    = 'Election is CLOSED';
    label.style.color    = 'var(--danger)';
    btnTxt.textContent   = 'Start Election';
    btn.style.background = 'linear-gradient(135deg, var(--success), #1e8449)';
  }
}

async function toggleElectionStatus() {
  if (!ADMIN_STATE.token) return;

  const newStatus = !ADMIN_STATE.electionActive;
  const confirmed = await openAdminActionModal({
    tone: newStatus ? 'success' : 'danger',
    toneLabel: newStatus ? 'Live Control' : 'Critical',
    eyebrow: 'Election Status',
    title: newStatus ? 'Open the election now?' : 'End the election now?',
    message: newStatus
      ? 'Verified voters will be able to access the ballot immediately after this change.'
      : 'Voting will be locked right away for all students until you open the election again.',
    currentValue: ADMIN_STATE.electionActive ? 'Open' : 'Closed',
    nextValue: newStatus ? 'Open' : 'Closed',
    confirmText: newStatus ? 'Open Election' : 'End Election',
    cancelText: 'Keep Current Status',
  });
  if (!confirmed) return;

  const btn     = document.getElementById('adminToggleBtn');
  const spinner = document.getElementById('adminToggleSpinner');
  btn.disabled  = true;
  spinner.classList.remove('hidden');

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'setElectionStatus', token: ADMIN_STATE.token, active: newStatus }),
  })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        ADMIN_STATE.electionActive = result.election_active;
        updateStatusUI(result.election_active);
        // Sync voter-facing landing page
        STATE.electionActive = result.election_active;
        updateVotingUI();
      } else {
        showAdminNotice({
          tone: 'danger',
          toneLabel: 'Update Failed',
          eyebrow: 'Election Status',
          title: 'Election status was not updated',
          message: explainAdminApiMessage(result.message),
          confirmText: 'Close',
        });
      }
    })
    .catch(() => {
      showAdminNotice({
        tone: 'danger',
        toneLabel: 'Offline',
        eyebrow: 'Election Status',
        title: 'Connection error',
        message: 'The election status could not be updated because the server did not respond.',
        confirmText: 'Close',
      });
    })
    .finally(() => {
      btn.disabled = false;
      spinner.classList.add('hidden');
    });
}

function updateCandidatesUI(isVisible) {
  const dot    = document.getElementById('adminCandidatesDot');
  const label  = document.getElementById('adminCandidatesLabel');
  const btnTxt = document.getElementById('adminCandidatesBtnText');
  const btn    = document.getElementById('adminCandidatesBtn');

  if (isVisible) {
    dot.style.background = 'var(--success)';
    dot.style.boxShadow  = '0 0 0 4px var(--success-glow)';
    label.textContent    = 'Candidates page is VISIBLE';
    label.style.color    = 'var(--success)';
    btnTxt.textContent   = 'Hide Candidates';
    btn.style.background = 'linear-gradient(135deg, var(--danger), #c0392b)';
  } else {
    dot.style.background = 'var(--danger)';
    dot.style.boxShadow  = '0 0 0 4px var(--danger-glow)';
    label.textContent    = 'Candidates page is HIDDEN';
    label.style.color    = 'var(--danger)';
    btnTxt.textContent   = 'Show Candidates';
    btn.style.background = 'linear-gradient(135deg, var(--success), #1e8449)';
  }
}

function updateRegistrationUI(isOpen) {
  const dot    = document.getElementById('adminRegistrationDot');
  const label  = document.getElementById('adminRegistrationLabel');
  const btnTxt = document.getElementById('adminRegistrationBtnText');
  const btn    = document.getElementById('adminRegistrationBtn');

  if (isOpen) {
    dot.style.background = 'var(--success)';
    dot.style.boxShadow  = '0 0 0 4px var(--success-glow)';
    label.textContent    = 'Registration is OPEN';
    label.style.color    = 'var(--success)';
    btnTxt.textContent   = 'Close Registration';
    btn.style.background = 'linear-gradient(135deg, var(--danger), #c0392b)';
  } else {
    dot.style.background = 'var(--danger)';
    dot.style.boxShadow  = '0 0 0 4px var(--danger-glow)';
    label.textContent    = 'Registration is CLOSED';
    label.style.color    = 'var(--danger)';
    btnTxt.textContent   = 'Open Registration';
    btn.style.background = 'linear-gradient(135deg, var(--success), #1e8449)';
  }
}

async function toggleCandidatesVisibility() {
  if (!ADMIN_STATE.token) return;

  const newVisible = !ADMIN_STATE.candidatesVisible;
  const confirmed = await openAdminActionModal({
    tone: newVisible ? 'success' : 'danger',
    toneLabel: newVisible ? 'Public Access' : 'Visibility',
    eyebrow: 'Candidates Page',
    title: newVisible ? 'Show candidates to voters?' : 'Hide candidates from voters?',
    message: newVisible
      ? 'Students will be able to browse candidate profiles before casting their votes.'
      : 'The candidates page will be hidden from the public until you turn it back on.',
    currentValue: ADMIN_STATE.candidatesVisible ? 'Visible' : 'Hidden',
    nextValue: newVisible ? 'Visible' : 'Hidden',
    confirmText: newVisible ? 'Show Candidates' : 'Hide Candidates',
    cancelText: 'Keep Current View',
  });
  if (!confirmed) return;

  const btn     = document.getElementById('adminCandidatesBtn');
  const spinner = document.getElementById('adminCandidatesSpinner');
  btn.disabled  = true;
  spinner.classList.remove('hidden');

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'setCandidatesVisibility', token: ADMIN_STATE.token, visible: newVisible }),
  })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        ADMIN_STATE.candidatesVisible = result.candidates_visible;
        updateCandidatesUI(result.candidates_visible);
        // Sync voter-facing landing page
        STATE.candidatesVisible = result.candidates_visible;
        updateVotingUI();
      } else {
        showAdminNotice({
          tone: 'danger',
          toneLabel: 'Update Failed',
          eyebrow: 'Candidates Page',
          title: 'Candidates visibility was not updated',
          message: explainAdminApiMessage(result.message),
          confirmText: 'Close',
        });
      }
    })
    .catch(() => {
      showAdminNotice({
        tone: 'danger',
        toneLabel: 'Offline',
        eyebrow: 'Candidates Page',
        title: 'Connection error',
        message: 'The candidates page setting could not be updated because the server did not respond.',
        confirmText: 'Close',
      });
    })
    .finally(() => {
      btn.disabled = false;
      spinner.classList.add('hidden');
    });
}

async function toggleRegistrationStatus() {
  if (!ADMIN_STATE.token) return;

  const newStatus = !ADMIN_STATE.registrationOpen;
  const confirmed = await openAdminActionModal({
    tone: newStatus ? 'success' : 'danger',
    toneLabel: newStatus ? 'Admissions' : 'Registration',
    eyebrow: 'Voter Registration',
    title: newStatus ? 'Open registration now?' : 'Close registration now?',
    message: newStatus
      ? 'Students will be able to submit new voter registrations immediately.'
      : 'New voter registrations will be blocked until you open registration again.',
    currentValue: ADMIN_STATE.registrationOpen ? 'Open' : 'Closed',
    nextValue: newStatus ? 'Open' : 'Closed',
    confirmText: newStatus ? 'Open Registration' : 'Close Registration',
    cancelText: 'Keep Current Status',
  });
  if (!confirmed) return;

  const btn     = document.getElementById('adminRegistrationBtn');
  const spinner = document.getElementById('adminRegistrationSpinner');
  btn.disabled  = true;
  spinner.classList.remove('hidden');

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'setRegistrationStatus', token: ADMIN_STATE.token, open: newStatus }),
  })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        ADMIN_STATE.registrationOpen = result.registration_open;
        updateRegistrationUI(result.registration_open);
        STATE.registrationOpen = result.registration_open;
        updateVotingUI();
      } else {
        showAdminNotice({
          tone: 'danger',
          toneLabel: 'Update Failed',
          eyebrow: 'Voter Registration',
          title: 'Registration setting was not updated',
          message: explainAdminApiMessage(result.message),
          confirmText: 'Close',
        });
      }
    })
    .catch(() => {
      showAdminNotice({
        tone: 'danger',
        toneLabel: 'Offline',
        eyebrow: 'Voter Registration',
        title: 'Connection error',
        message: 'The registration setting could not be updated because the server did not respond.',
        confirmText: 'Close',
      });
    })
    .finally(() => {
      btn.disabled = false;
      spinner.classList.add('hidden');
    });
}

// =====================================================
// ADD CANDIDATE
// =====================================================

function toggleAddCandidateForm() {
  const form = document.getElementById('addCandidateForm');
  const isHidden = form.classList.toggle('hidden');
  document.getElementById('addCandidateToggleBtn').innerHTML = isHidden
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Candidate`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="5" y1="12" x2="19" y2="12"/></svg> Cancel`;
  if (!isHidden) {
    populatePositionSuggestions();
    document.getElementById('addCandidateMessage').classList.add('hidden');
  }
}

function populatePositionSuggestions() {
  const datalist = document.getElementById('positionSuggestions');
  if (!datalist) return;
  const positions = [...new Set(ADMIN_STATE.voters
    ? STATE.positions || []
    : [])];
  // Also pull from already-rendered candidates if available
  const existing = [...new Set(
    (typeof STATE !== 'undefined' && STATE.positions ? STATE.positions : [])
  )];
  const all = [...new Set([...existing, 'President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'Public Relations Officer'])];
  datalist.innerHTML = all.map(p => `<option value="${escHtml(p)}"/>`).join('');
}

function submitAddCandidate() {
  // Clear errors
  ['candFullName','candPosition','candCourse','candYearLevel','candPlatform'].forEach(id => {
    const err = document.getElementById(id + 'Error');
    if (err) err.textContent = '';
  });

  const fullName  = document.getElementById('candFullName').value.trim();
  const position  = document.getElementById('candPosition').value.trim();
  const course    = document.getElementById('candCourse').value.trim();
  const yearLevel = document.getElementById('candYearLevel').value.trim();
  const party     = document.getElementById('candParty').value.trim();
  const photoUrl  = document.getElementById('candPhotoUrl').value.trim();
  const platform  = document.getElementById('candPlatform').value.trim();

  let hasError = false;
  if (!fullName)  { document.getElementById('candFullNameError').textContent  = 'Full name is required.';   hasError = true; }
  if (!position)  { document.getElementById('candPositionError').textContent  = 'Position is required.';    hasError = true; }
  if (!course)    { document.getElementById('candCourseError').textContent    = 'Course is required.';      hasError = true; }
  if (!yearLevel) { document.getElementById('candYearLevelError').textContent = 'Year level is required.';  hasError = true; }
  if (!platform)  { document.getElementById('candPlatformError').textContent  = 'Platform is required.';    hasError = true; }
  if (hasError) return;

  const btn     = document.getElementById('addCandidateBtn');
  const spinner = document.getElementById('addCandidateSpinner');
  const msgEl   = document.getElementById('addCandidateMessage');
  btn.disabled  = true;
  spinner.classList.remove('hidden');
  msgEl.classList.add('hidden');

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'addCandidate',
      token: ADMIN_STATE.token,
      candidate: { full_name: fullName, position, course, year_level: yearLevel, party, photo_url: photoUrl, platform },
    }),
  })
    .then(r => r.json())
    .then(result => {
      msgEl.classList.remove('hidden');
      if (result.success) {
        msgEl.className = 'admin-form-message admin-form-message--success';
        msgEl.textContent = result.message;
        // Clear form fields
        ['candFullName','candPosition','candCourse','candYearLevel','candParty','candPhotoUrl','candPlatform']
          .forEach(id => { document.getElementById(id).value = ''; });
        // Invalidate candidate cache so ballot/candidates page reloads fresh
        if (typeof STATE !== 'undefined') { STATE.candidates = []; STATE.positions = []; }
        loadAdminDashboard();
      } else {
        msgEl.className = 'admin-form-message admin-form-message--error';
        msgEl.textContent = explainAdminApiMessage(result.message);
      }
    })
    .catch(() => {
      msgEl.classList.remove('hidden');
      msgEl.className = 'admin-form-message admin-form-message--error';
      msgEl.textContent = 'Connection error. Please try again.';
    })
    .finally(() => {
      btn.disabled = false;
      spinner.classList.add('hidden');
    });
}

// =====================================================
// CANDIDATES LIST
// =====================================================

function renderCandidatesList() {
  const container = document.getElementById('candidatesListContent');
  if (!container) return;

  const candidates = CONFIG.USE_SAMPLE_DATA
    ? SAMPLE_DATA.candidates
    : (typeof STATE !== 'undefined' ? STATE.candidates : []);

  if (!candidates || candidates.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);padding:8px 0;">No candidates found. Add one below.</p>`;
    return;
  }

  // Group by position, preserving order of first appearance
  const positionOrder = [];
  const byPosition = {};
  candidates.forEach(c => {
    const pos = c.position || 'Unknown';
    if (!byPosition[pos]) { byPosition[pos] = []; positionOrder.push(pos); }
    byPosition[pos].push(c);
  });

  let html = `<div class="admin-cand-list">`;
  positionOrder.forEach(pos => {
    html += `<div class="admin-cand-position-group">
      <p class="admin-cand-position-label">${escHtml(pos)}</p>`;
    byPosition[pos].forEach(c => {
      const initials = c.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const avatarHtml = c.photo_url
        ? `<img class="admin-cand-avatar" src="${escHtml(c.photo_url)}" alt="${escHtml(c.full_name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="admin-cand-avatar-initials" style="display:none">${escHtml(initials)}</div>`
        : `<div class="admin-cand-avatar-initials">${escHtml(initials)}</div>`;
      html += `
        <div class="admin-cand-row">
          ${avatarHtml}
          <div class="admin-cand-info">
            <div class="admin-cand-name">${escHtml(c.full_name)}</div>
            <div class="admin-cand-meta">${escHtml(c.course || '')}${c.year_level ? ' · ' + escHtml(c.year_level) : ''}${c.party ? ' · ' + escHtml(c.party) : ''}</div>
          </div>
          <span class="admin-cand-id-badge">${escHtml(c.candidate_id || '')}</span>
          <button class="admin-cand-delete-btn" data-cid="${escHtml(c.candidate_id || '')}" data-cname="${escHtml(c.full_name)}" onclick="deleteCandidate(this.dataset.cid,this.dataset.cname)" title="Delete candidate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

async function deleteCandidate(candidateId, candidateName) {
  if (!ADMIN_STATE.token) return;

  const confirmed = await openAdminActionModal({
    tone: 'danger',
    toneLabel: 'Destructive',
    eyebrow: 'Candidates',
    title: `Delete ${candidateName}?`,
    message: 'This will permanently remove the candidate from the election. Any votes already cast for them will remain in the database.',
    currentValue: 'In Election',
    nextValue: 'Deleted',
    confirmText: 'Delete Candidate',
    cancelText: 'Cancel',
  });
  if (!confirmed) return;

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'deleteCandidate', token: ADMIN_STATE.token, candidate_id: candidateId }),
  })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        if (typeof STATE !== 'undefined') { STATE.candidates = []; STATE.positions = []; }
        loadAdminDashboard();
      } else {
        showAdminNotice({
          tone: 'danger',
          toneLabel: 'Failed',
          eyebrow: 'Delete Candidate',
          title: 'Candidate could not be deleted',
          message: explainAdminApiMessage(result.message),
          confirmText: 'Close',
        });
      }
    })
    .catch(() => {
      showAdminNotice({
        tone: 'danger',
        toneLabel: 'Offline',
        eyebrow: 'Delete Candidate',
        title: 'Connection error',
        message: 'The candidate could not be deleted because the server did not respond.',
        confirmText: 'Close',
      });
    });
}

async function resetVoterStatus(studentId, voterName) {
  if (!ADMIN_STATE.token) return;

  const confirmed = await openAdminActionModal({
    tone: 'danger',
    toneLabel: 'Sensitive',
    eyebrow: 'Voter Status',
    title: `Reset vote status for ${voterName}?`,
    message: 'This will allow the voter to cast a new ballot. Their previous vote record will remain in the Votes sheet.',
    currentValue: 'Voted',
    nextValue: 'Not Yet Voted',
    confirmText: 'Reset Status',
    cancelText: 'Cancel',
  });
  if (!confirmed) return;

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'resetVoterStatus', token: ADMIN_STATE.token, student_id: studentId }),
  })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        loadAdminDashboard();
      } else {
        showAdminNotice({
          tone: 'danger',
          toneLabel: 'Failed',
          eyebrow: 'Reset Vote',
          title: 'Vote status could not be reset',
          message: explainAdminApiMessage(result.message),
          confirmText: 'Close',
        });
      }
    })
    .catch(() => {
      showAdminNotice({
        tone: 'danger',
        toneLabel: 'Offline',
        eyebrow: 'Reset Vote',
        title: 'Connection error',
        message: 'The vote status could not be reset because the server did not respond.',
        confirmText: 'Close',
      });
    });
}

// =====================================================
// VOTE ANALYTICS
// =====================================================

function loadVoteResults() {
  if (CONFIG.USE_SAMPLE_DATA) {
    ADMIN_STATE.voteAnalytics = SAMPLE_DATA.vote_results;
    renderVoteAnalytics(SAMPLE_DATA.vote_results);
    return;
  }

  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'getVoteResults', token: ADMIN_STATE.token }),
  })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        ADMIN_STATE.voteAnalytics = result;
        renderVoteAnalytics(result);
      } else {
        document.getElementById('voteAnalyticsContent').innerHTML =
          `<div class="analytics-empty-state analytics-empty-state--error"><strong>Analytics unavailable</strong><p>${escHtml(explainAdminApiMessage(result.message))}</p></div>`;
      }
    })
    .catch(() => {
      document.getElementById('voteAnalyticsContent').innerHTML =
        `<div class="analytics-empty-state analytics-empty-state--error"><strong>Connection problem</strong><p>Could not load analytics. Check your connection.</p></div>`;
    });
}

function isVoterMarkedAsVoted(voter) {
  return voter && (voter.has_voted === true || String(voter.has_voted).toUpperCase() === 'TRUE');
}

function getTurnoutTone(turnoutPct) {
  if (turnoutPct >= 80) return 'high';
  if (turnoutPct >= 45) return 'mid';
  return 'low';
}

function getTurnoutNarrative(turnoutPct, remaining) {
  if (turnoutPct >= 80) {
    return remaining > 0
      ? `${remaining} voter${remaining !== 1 ? 's are' : ' is'} still pending, but participation is already strong across the roster.`
      : 'Every registered voter has already submitted a ballot.';
  }
  if (turnoutPct >= 45) {
    return `${remaining} voter${remaining !== 1 ? 's are' : ' is'} still outstanding. This is the key window for reminder pushes.`;
  }
  if (remaining === 0) {
    return 'Voting is complete, but turnout stayed lower than expected.';
  }
  return `Participation is still building. ${remaining} voter${remaining !== 1 ? 's remain' : ' remains'} unsubmitted right now.`;
}

function normalizeGroupLabel(raw) {
  return String(raw)
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(' ');
}

function buildTurnoutGroups(voters, field, limit = 6) {
  const map = new Map();

  (voters || []).forEach(voter => {
    const raw = String(voter[field] || '').trim();
    const label = raw ? normalizeGroupLabel(raw) : 'Not specified';
    const key = label.toLowerCase();

    if (!map.has(key)) {
      map.set(key, { label, total: 0, voted: 0 });
    }

    const entry = map.get(key);
    entry.total += 1;
    if (isVoterMarkedAsVoted(voter)) {
      entry.voted += 1;
    }
  });

  return Array.from(map.values())
    .map(group => ({
      ...group,
      pct: group.total > 0 ? Math.round((group.voted / group.total) * 100) : 0,
    }))
    .sort((a, b) => {
      if (a.label === 'Not specified') return 1;
      if (b.label === 'Not specified') return -1;
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.voted !== a.voted) return b.voted - a.voted;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}

function getClosestRace(positions) {
  let closestRace = null;

  (positions || []).forEach(position => {
    const sorted = [...(position.candidates || [])].sort((a, b) => b.votes - a.votes);
    if (sorted.length < 2 || position.total_votes <= 0) return;

    const margin = sorted[0].votes - sorted[1].votes;
    const tiedLeaders = sorted.filter(candidate => candidate.votes === sorted[0].votes);
    const pctMargin = position.total_votes > 0 ? Math.round((margin / position.total_votes) * 100) : 0;

    const race = {
      position: position.position,
      margin,
      pctMargin,
      tied: tiedLeaders.length > 1,
    };

    if (
      !closestRace ||
      race.margin < closestRace.margin ||
      (race.margin === closestRace.margin && race.pctMargin < closestRace.pctMargin)
    ) {
      closestRace = race;
    }
  });

  return closestRace;
}

function renderAnalyticsBreakdownCard(title, subtitle, groups, fillClass, emptyMessage) {
  const rows = groups && groups.length
    ? groups.map(group => `
      <div class="analytics-breakdown-row">
        <div class="analytics-breakdown-meta">
          <span class="analytics-breakdown-name">${escHtml(group.label)}</span>
          <span class="analytics-breakdown-count">${group.voted}/${group.total}</span>
        </div>
        <div class="analytics-bar-group analytics-bar-group--stacked">
          <div class="analytics-bar-track analytics-bar-track--sm">
            <div class="analytics-bar-fill ${fillClass}" style="width:${group.pct}%"></div>
          </div>
          <span class="analytics-bar-label">${group.pct}%</span>
        </div>
      </div>
    `).join('')
    : `<div class="analytics-breakdown-empty">${escHtml(emptyMessage)}</div>`;

  return `
    <div class="analytics-breakdown-card">
      <div class="analytics-section-head">
        <span class="analytics-section-kicker">Participation</span>
        <h4 class="analytics-section-title">${escHtml(title)}</h4>
        <p class="analytics-section-subtitle">${escHtml(subtitle)}</p>
      </div>
      <div class="analytics-breakdown-list">
        ${rows}
      </div>
    </div>
  `;
}

function renderVoteAnalytics(data) {
  const container = document.getElementById('voteAnalyticsContent');
  if (!container) return;

  if (!data || !data.turnout) {
    container.innerHTML = `<div class="analytics-empty-state"><strong>No analytics yet</strong><p>No vote data is available yet.</p></div>`;
    return;
  }

  const turnout = data.turnout || { total: 0, voted: 0 };
  const positions = Array.isArray(data.positions) ? data.positions : [];
  const turnoutPct = turnout.total > 0 ? Math.round((turnout.voted / turnout.total) * 100) : 0;
  const remaining = Math.max(turnout.total - turnout.voted, 0);
  const turnoutTone = getTurnoutTone(turnoutPct);
  const contestedRaces = positions.filter(position => (position.candidates || []).length > 1).length;
  const reportingPositions = positions.filter(position => position.total_votes > 0).length;
  const closestRace = getClosestRace(positions);
  const courseGroups = buildTurnoutGroups(ADMIN_STATE.voters, 'course');
  const yearGroups = buildTurnoutGroups(ADMIN_STATE.voters, 'year_level');

  let positionsHtml = '';

  if (positions.length === 0) {
    positionsHtml = `<div class="analytics-empty-state"><strong>No candidate data</strong><p>The analytics feed did not return any ballot positions yet.</p></div>`;
  } else {
    positionsHtml = positions.map(position => {
      const candidates = [...(position.candidates || [])].sort((a, b) => b.votes - a.votes);
      const leader = candidates[0];
      const runnerUp = candidates[1];
      const leadMargin = leader && runnerUp ? leader.votes - runnerUp.votes : 0;
      let statusCopy = 'No votes recorded yet';

      if (leader && leader.votes > 0 && runnerUp) {
        statusCopy = leadMargin === 0
          ? `Tied at the top with ${leader.votes} vote${leader.votes !== 1 ? 's' : ''}`
          : `${escHtml(leader.full_name)} leads by ${leadMargin} vote${leadMargin !== 1 ? 's' : ''}`;
      } else if (leader && leader.votes > 0) {
        statusCopy = `${escHtml(leader.full_name)} is running unopposed with ${leader.votes} vote${leader.votes !== 1 ? 's' : ''}`;
      } else if ((position.candidates || []).length === 1) {
        statusCopy = 'Unopposed position waiting for votes';
      }

      const candidateRows = candidates.map((candidate, index) => {
        const pct = position.total_votes > 0 ? Math.round((candidate.votes / position.total_votes) * 100) : 0;
        const isLeading = leader && candidate.votes === leader.votes && candidate.votes > 0;

        return `
          <div class="analytics-candidate-row">
            <div class="analytics-candidate-meta">
              <span class="analytics-candidate-name">${escHtml(candidate.full_name)}</span>
              ${candidate.party ? `<span class="analytics-candidate-party">${escHtml(candidate.party)}</span>` : '<span class="analytics-candidate-party analytics-candidate-party--independent">Independent</span>'}
              ${isLeading && index === 0 ? '<span class="analytics-leading-badge">Front-runner</span>' : ''}
            </div>
            <div class="analytics-bar-group">
              <div class="analytics-bar-track analytics-bar-track--sm">
                <div class="analytics-bar-fill ${isLeading && index === 0 ? 'analytics-bar-fill--leading' : 'analytics-bar-fill--secondary'}" style="width:${pct}%"></div>
              </div>
              <span class="analytics-bar-label">${candidate.votes} <span class="analytics-bar-pct">(${pct}%)</span></span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <article class="analytics-position-card">
          <div class="analytics-position-header">
            <div>
              <span class="analytics-section-kicker">Race Snapshot</span>
              <h4 class="analytics-position-name">${escHtml(position.position)}</h4>
            </div>
            <span class="analytics-position-total">${position.total_votes} vote${position.total_votes !== 1 ? 's' : ''} cast</span>
          </div>
          <p class="analytics-position-summary">${statusCopy}</p>
          <div class="analytics-position-rows">
            ${candidateRows}
          </div>
        </article>
      `;
    }).join('');
  }

  const closestRaceValue = closestRace
    ? closestRace.tied
      ? 'Tie'
      : `${closestRace.margin} vote${closestRace.margin !== 1 ? 's' : ''}`
    : '—';

  const closestRaceDetail = closestRace
    ? `${escHtml(closestRace.position)}${closestRace.tied ? ' is currently tied at the top.' : ' has the smallest lead so far.'}`
    : 'Waiting for enough votes to compare races.';

  container.innerHTML = `
    <div class="analytics-shell">
      <section class="analytics-hero-card analytics-hero-card--${turnoutTone}">
        <div class="analytics-hero-copy">
          <span class="analytics-section-kicker">Election Pulse</span>
          <h3 class="analytics-hero-title">${turnoutPct}% turnout so far</h3>
          <p class="analytics-hero-text">${getTurnoutNarrative(turnoutPct, remaining)}</p>
          <div class="analytics-chip-row">
            <span class="analytics-chip analytics-chip--live">${turnout.voted} ballot${turnout.voted !== 1 ? 's' : ''} submitted</span>
            <span class="analytics-chip">${remaining} pending</span>
            <span class="analytics-chip">${reportingPositions}/${positions.length || 0} positions reporting</span>
          </div>
        </div>
        <div class="analytics-orb" style="--turnout:${turnoutPct}">
          <div class="analytics-orb__inner">
            <strong>${turnoutPct}%</strong>
            <span>turnout</span>
          </div>
        </div>
      </section>

      <section class="analytics-summary-grid">
        <div class="analytics-summary-card">
          <span class="analytics-summary-label">Eligible Voters</span>
          <strong class="analytics-summary-value">${turnout.total}</strong>
          <p class="analytics-summary-note">Verified voters currently in the masterlist.</p>
        </div>
        <div class="analytics-summary-card analytics-summary-card--accent">
          <span class="analytics-summary-label">Votes Cast</span>
          <strong class="analytics-summary-value">${turnout.voted}</strong>
          <p class="analytics-summary-note">Students who have already completed the ballot.</p>
        </div>
        <div class="analytics-summary-card analytics-summary-card--warning">
          <span class="analytics-summary-label">Still Pending</span>
          <strong class="analytics-summary-value">${remaining}</strong>
          <p class="analytics-summary-note">Voters who have not submitted yet.</p>
        </div>
        <div class="analytics-summary-card">
          <span class="analytics-summary-label">Closest Race</span>
          <strong class="analytics-summary-value analytics-summary-value--compact">${closestRace ? (closestRace.tied ? 'Tie' : `${closestRace.margin} vote${closestRace.margin !== 1 ? 's' : ''}`) : 'N/A'}</strong>
          <p class="analytics-summary-note">${closestRaceDetail}</p>
        </div>
      </section>

      <section class="analytics-breakdown-grid">
        ${renderAnalyticsBreakdownCard('Turnout by Course', 'Quick read on which academic programs are showing up.', courseGroups, 'analytics-bar-fill--course', 'Course data is not available for this voter list yet.')}
        ${renderAnalyticsBreakdownCard('Turnout by Year Level', 'Helps identify which year groups still need reminders.', yearGroups, 'analytics-bar-fill--year', 'Year-level data is not available for this voter list yet.')}
      </section>

      <section class="analytics-positions-stack">
        <div class="analytics-section-head analytics-section-head--positions">
          <span class="analytics-section-kicker">Race Board</span>
          <h4 class="analytics-section-title">Position-by-position standings</h4>
          <p class="analytics-section-subtitle">${contestedRaces} contested race${contestedRaces !== 1 ? 's' : ''} across ${positions.length} ballot position${positions.length !== 1 ? 's' : ''}.</p>
        </div>
        <div class="analytics-positions-grid">
          ${positionsHtml}
        </div>
      </section>
    </div>
  `;
}

function renderVotersTable(voters) {
  const tbody = document.getElementById('votersTableBody');
  if (!voters || voters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:28px;">No voters in the masterlist yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = voters.map(v => {
    const voted = (v.has_voted === true || v.has_voted === 'TRUE');
    const resetBtn = voted && !CONFIG.USE_SAMPLE_DATA
      ? `<button class="admin-reset-vote-btn" data-sid="${escHtml(String(v.student_id))}" data-sname="${escHtml(String(v.full_name))}" onclick="resetVoterStatus(this.dataset.sid,this.dataset.sname)" title="Reset vote status">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
         </button>`
      : '';
    return `<tr>
      <td>${escHtml(String(v.student_id))}</td>
      <td>${escHtml(String(v.full_name))}</td>
      <td>${escHtml(String(v.school_email))}</td>
      <td>${escHtml(String(v.course || ''))}</td>
      <td>${escHtml(String(v.year_level || ''))}</td>
      <td><span class="voter-status-badge ${voted ? 'voted' : 'not-voted'}">${voted ? 'Voted' : 'Not Yet'}</span></td>
      <td>${resetBtn}</td>
    </tr>`;
  }).join('');
}

function renderRegisteredVotersTable(registeredVoters) {
  const container = document.getElementById('registeredVotersContent');
  if (!container) return;

  if (!registeredVoters || registeredVoters.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);padding:8px 0;">No pending registrations.</p>`;
    return;
  }

  const rows = registeredVoters.map(v => `<tr>
    <td>${escHtml(String(v.student_id || ''))}</td>
    <td>${escHtml(String(v.full_name || ''))}</td>
    <td>${escHtml(String(v.school_email || ''))}</td>
    <td>${escHtml(String(v.course || ''))}</td>
    <td>${escHtml(String(v.year_level || ''))}</td>
  </tr>`).join('');

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Course</th>
            <th>Year</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function filterVotersTable() {
  const q = document.getElementById('voterSearch').value.toLowerCase();
  const filtered = ADMIN_STATE.voters.filter(v =>
    String(v.student_id || '').toLowerCase().includes(q) ||
    String(v.full_name || '').toLowerCase().includes(q) ||
    String(v.school_email || '').toLowerCase().includes(q) ||
    String(v.course || '').toLowerCase().includes(q) ||
    String(v.year_level || '').toLowerCase().includes(q)
  );
  renderVotersTable(filtered);
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Restore admin mode if a session token was saved (e.g. after page refresh)
if (ADMIN_STATE.token) {
  document.addEventListener('DOMContentLoaded', () => {
    enterAdminMode();
    goToStep('stepAdminDashboard');
    loadAdminDashboard();
  });
}
