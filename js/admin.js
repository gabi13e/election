// =====================================================
// admin.js — AAA Election System Admin Features
// Handles: voter registration, admin login, dashboard
// =====================================================

// ===== ADMIN STATE =====
const ADMIN_STATE = {
  token: sessionStorage.getItem("adminToken") || null,
  electionActive: false,
  voters: [],
};

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

  const url = `${CONFIG.APPS_SCRIPT_URL}?action=adminLogin` +
    `&username=${encodeURIComponent(username)}` +
    `&password=${encodeURIComponent(password)}`;

  fetch(url)
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        ADMIN_STATE.token = result.token;
        sessionStorage.setItem('adminToken', result.token);
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
        goToStep('stepAdminDashboard');
        loadAdminDashboard();
      } else {
        showFormMessage('adminLoginMessage', result.message, 'error');
      }
    })
    .catch(() => showFormMessage('adminLoginMessage', 'Connection error. Please try again.', 'error'))
    .finally(() => setAdminLoginLoading(false));
}

function adminLogout() {
  ADMIN_STATE.token = null;
  ADMIN_STATE.voters = [];
  sessionStorage.removeItem('adminToken');
  goToStep('stepLanding');
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

  const url = `${CONFIG.APPS_SCRIPT_URL}?action=getVoters&token=${encodeURIComponent(ADMIN_STATE.token)}`;

  fetch(url)
    .then(r => r.json())
    .then(result => {
      if (!result.success) {
        adminLogout();
        return;
      }
      ADMIN_STATE.electionActive = result.election_active;
      ADMIN_STATE.voters = result.voters;
      renderDashboard(result);
    })
    .catch(() => console.error('Failed to load admin dashboard'));
}

function renderDashboard(data) {
  document.getElementById('statTotal').textContent    = data.stats.total;
  document.getElementById('statVoted').textContent    = data.stats.voted;
  document.getElementById('statNotVoted').textContent = data.stats.not_voted;
  updateStatusUI(data.election_active);
  renderVotersTable(data.voters);
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

function toggleElectionStatus() {
  if (!ADMIN_STATE.token) return;

  const newStatus = !ADMIN_STATE.electionActive;
  const action    = newStatus ? 'open' : 'close';
  if (!confirm(`Are you sure you want to ${action} the election?`)) return;

  const btn     = document.getElementById('adminToggleBtn');
  const spinner = document.getElementById('adminToggleSpinner');
  btn.disabled  = true;
  spinner.classList.remove('hidden');

  const url = `${CONFIG.APPS_SCRIPT_URL}?action=setElectionStatus` +
    `&token=${encodeURIComponent(ADMIN_STATE.token)}` +
    `&active=${newStatus}`;

  fetch(url)
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        ADMIN_STATE.electionActive = result.election_active;
        updateStatusUI(result.election_active);
      } else {
        alert('Failed to update election status: ' + result.message);
      }
    })
    .catch(() => alert('Connection error. Could not update election status.'))
    .finally(() => {
      btn.disabled = false;
      spinner.classList.add('hidden');
    });
}

function renderVotersTable(voters) {
  const tbody = document.getElementById('votersTableBody');
  if (!voters || voters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:28px;">No voters registered yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = voters.map(v => {
    const voted = (v.has_voted === true || v.has_voted === 'TRUE');
    return `<tr>
      <td>${escHtml(String(v.student_id))}</td>
      <td>${escHtml(String(v.full_name))}</td>
      <td>${escHtml(String(v.school_email))}</td>
      <td>${escHtml(String(v.course || ''))}</td>
      <td>${escHtml(String(v.year_level || ''))}</td>
      <td><span class="voter-status-badge ${voted ? 'voted' : 'not-voted'}">${voted ? 'Voted' : 'Not Yet'}</span></td>
    </tr>`;
  }).join('');
}

function filterVotersTable() {
  const q = document.getElementById('voterSearch').value.toLowerCase();
  const filtered = ADMIN_STATE.voters.filter(v =>
    String(v.student_id).toLowerCase().includes(q) ||
    String(v.full_name).toLowerCase().includes(q) ||
    String(v.school_email).toLowerCase().includes(q)
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
