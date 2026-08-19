/* ==============================================
   nsMovies — Frontend Application
   ============================================== */

// ─── CONFIG ─────────────────────────────────────
const API_BASE = (
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname === '0.0.0.0'
) ? 'http://localhost:3001'
  : 'https://nsmovies-backend.fly.dev'; // ← Replace with your Vercel URL

// TMDB v3 API — uses api_key param (classic method, still supported)
const TMDB_API_KEY = '06f14c402a5fe56202221384f42b44f6';
const TMDB_IMG     = 'https://image.tmdb.org/t/p/w500';
const TMDB_BASE    = 'https://api.themoviedb.org/3';

// ─── STATE ──────────────────────────────────────
let movies               = [];
let accountToken         = null;
let profileToken         = null;
let currentAccount       = null;
let currentProfile       = null;
let currentFilter        = 'all';
let currentGenreFilter = 'all';
let currentRatedFilter = 'all';
let currentSort          = 'added';
let sortDir              = 'desc'; // 'asc' or 'desc'
let searchQuery          = '';
let selectedRating       = 0;
let selectedProfileColor = '#3b82f6';
let selectedProfileAvatarUrl = null;
let globalProfiles       = [];
let multiSelectMode      = false;
let selectedMovieIds     = new Set();

// ─── INIT ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initStarHover();
});

// ─── AUTH INIT ───────────────────────────────────
function initAuth() {
  accountToken = localStorage.getItem('ns_account_token');
  profileToken = localStorage.getItem('ns_profile_token');
  const profileData = localStorage.getItem('ns_current_profile');
  const accountData = localStorage.getItem('ns_account');
  if (profileToken && profileData && accountData) {
    currentProfile = JSON.parse(profileData);
    currentAccount = JSON.parse(accountData);
    enterApp();
  } else if (accountToken && accountData) {
    currentAccount = JSON.parse(accountData);
    showScreen('profiles');
    refreshProfiles();
  } else {
    showScreen('login');
  }
}

// ─── SCREENS ─────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

async function enterApp() {
  showScreen('app');
  updateProfileHeader();
  await refreshProfiles();
  loadMovies();
}

function updateProfileHeader() {
  if (!currentProfile) return;
  const btn      = document.getElementById('active-profile-btn');
  const initials = document.getElementById('active-profile-initials');
  const img      = document.getElementById('active-profile-img');
  const nameEl   = document.getElementById('active-profile-name');
  btn.style.background   = hexToRgba(currentProfile.color || '#3b82f6', 0.25);
  btn.style.borderColor  = hexToRgba(currentProfile.color || '#3b82f6', 0.6);
  if (nameEl) nameEl.textContent = currentProfile.name || '';
  if (currentProfile.avatarUrl) {
    img.src = currentProfile.avatarUrl;
    img.style.display = 'block';
    initials.style.display = 'none';
  } else {
    initials.textContent = getInitials(currentProfile.name);
    initials.style.display = '';
    img.style.display = 'none';
  }
}

function getInitials(name) {
  if (!name) return 'U';
  return name.charAt(0).toUpperCase();
}

// ─── AUTH PANEL SWITCHING ────────────────────────
function showAuthPanel(panel) {
  document.getElementById('auth-panel-login').style.display    = panel === 'login'    ? '' : 'none';
  document.getElementById('auth-panel-register').style.display = panel === 'register' ? '' : 'none';
  // Clear errors
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent   = '';
}

function togglePw(inputId, btn) {
  const input  = document.getElementById(inputId);
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.querySelector('.eye-icon').style.display     = isPass ? 'none' : '';
  btn.querySelector('.eye-off-icon').style.display = isPass ? ''     : 'none';
  btn.title = isPass ? 'Hide password' : 'Show password';
}

// ─── AUTH FORMS ──────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  errEl.textContent = '';
  try {
    const res  = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    accountToken   = data.accountToken;
    currentAccount = data.account;
    localStorage.setItem('ns_account_token', accountToken);
    localStorage.setItem('ns_account', JSON.stringify(currentAccount));
    localStorage.removeItem('ns_profile_token');
    localStorage.removeItem('ns_current_profile');
    profileToken = null; currentProfile = null;
    document.getElementById('profiles-account-name').textContent = currentAccount.accountName;
    showScreen('profiles');
    refreshProfiles();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const accountName = document.getElementById('reg-name').value.trim();
  const email       = document.getElementById('reg-email').value.trim();
  const password    = document.getElementById('reg-password').value;
  const errEl       = document.getElementById('reg-error');
  const btn         = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = 'Creating…';
  errEl.textContent = '';
  try {
    const res  = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    accountToken   = data.accountToken;
    currentAccount = data.account;
    localStorage.setItem('ns_account_token', accountToken);
    localStorage.setItem('ns_account', JSON.stringify(currentAccount));
    document.getElementById('profiles-account-name').textContent = currentAccount.accountName;
    showScreen('profiles');
    refreshProfiles();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

function performLogout() {
  localStorage.removeItem('ns_account_token');
  localStorage.removeItem('ns_profile_token');
  localStorage.removeItem('ns_current_profile');
  localStorage.removeItem('ns_account');
  accountToken = profileToken = currentAccount = currentProfile = null;
  movies = [];
  showScreen('login');
  showAuthPanel('login');
}

function logout() {
  document.getElementById('confirm-title').textContent = 'Sign Out';
  document.getElementById('confirm-msg').textContent   = 'Are you sure you want to sign out of your account?';
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.className = 'btn-danger';
  okBtn.textContent = 'Sign Out';
  okBtn.onclick = () => {
    closeModal('confirm-modal');
    performLogout();
  };
  openModal('confirm-modal');
}

function switchProfile() {
  localStorage.removeItem('ns_profile_token');
  localStorage.removeItem('ns_current_profile');
  profileToken = null; currentProfile = null;
  movies = [];
  document.getElementById('profiles-account-name').textContent = currentAccount?.accountName || '';
  showScreen('profiles');
  refreshProfiles();
}

// ─── PROFILES ────────────────────────────────────
async function refreshProfiles() {
  try {
    const res = await apiFetch('/api/profiles');
    if (!res.ok) throw new Error();
    const profiles = await res.json();
    globalProfiles = profiles;
    renderProfiles(profiles);
  } catch {
    showToast('Failed to load profiles', 'error');
  }
}

const editIconSvg   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
const deleteIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const starIconSvg   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

function renderProfiles(profiles) {
  const grid = document.getElementById('profiles-grid');
  // Each profile card: click on the avatar/name zone selects the profile.
  // Edit/delete buttons are separate elements below, so they never overlap the click zone.
  let html = profiles.map(p => {
    const avatarInner = p.avatarUrl
      ? `<img src="${escHtml(p.avatarUrl)}" alt="${escHtml(p.name)}" />`
      : `<span class="profile-initials">${escHtml(getInitials(p.name))}</span>`;
    return `
      <div class="profile-card" draggable="true" ondragstart="handleProfileDragStart(event, '${p._id}')" ondragover="handleProfileDragOver(event)" ondrop="handleProfileDrop(event, '${p._id}')" ondragend="handleProfileDragEnd(event)" ondragenter="event.preventDefault()">
        <div class="profile-card-select-zone" onclick="selectProfile('${p._id}')" title="Select ${escHtml(p.name)}">
          <div class="profile-avatar" style="background:${p.color||'#3b82f6'};border:2px solid ${p.color||'#3b82f6'}">
            ${avatarInner}
          </div>
          <div class="profile-card-name">${escHtml(p.name)}</div>
        </div>
        <div class="profile-card-actions" onclick="event.stopPropagation()">
          <button class="profile-action-mini" title="Edit" onclick="event.stopPropagation(); openProfileModal('${p._id}')">${editIconSvg}</button>
          <button class="profile-action-mini danger" title="Delete" onclick="event.stopPropagation(); confirmDeleteProfile('${p._id}','${escJs(p.name)}')">${deleteIconSvg}</button>
        </div>
      </div>`;
  }).join('');

  if (profiles.length < 6) {
    html += `
      <div class="profile-card profile-add-card" onclick="openProfileModal()">
        <div class="profile-card-select-zone">
          <div class="profile-avatar" style="background:var(--bg-elevated);border:2px dashed var(--border-strong)">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <div class="profile-card-name">Add Profile</div>
        </div>
      </div>`;
  }

  grid.innerHTML = html;
}

async function selectProfile(profileId) {
  try {
    const res  = await fetch(`${API_BASE}/api/auth/select-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accountToken}` },
      body: JSON.stringify({ profileId })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    profileToken   = data.profileToken;
    currentProfile = data.profile;
    localStorage.setItem('ns_profile_token', profileToken);
    localStorage.setItem('ns_current_profile', JSON.stringify(currentProfile));
    document.getElementById('active-profile-name').textContent = currentProfile.name;
    document.getElementById('active-profile-initials').textContent = getInitials(currentProfile.name);
    if (currentProfile.avatarUrl) {
      document.getElementById('active-profile-initials').style.display = 'none';
      const img = document.getElementById('active-profile-img');
      img.src = currentProfile.avatarUrl;
      img.style.display = 'block';
    } else {
      document.getElementById('active-profile-initials').style.display = 'flex';
      document.getElementById('active-profile-img').style.display = 'none';
    }
    showScreen('app');
    await loadMovies();
  } catch {
    showToast('Failed to switch profile', 'error');
  }
}

// ─── PROFILE MODAL ───────────────────────────────
function updateProfileInitials(name) {
  if (!selectedProfileAvatarUrl) {
    document.getElementById('avatar-preview-initials').textContent = getInitials(name);
  }
}

function openProfileModal(id = null) {
  const profile = id ? globalProfiles.find(p => p._id === id) : null;
  const name = profile ? profile.name : '';
  const color = profile ? (profile.color || '#3b82f6') : '#3b82f6';
  const avatarUrl = profile ? profile.avatarUrl : null;

  document.getElementById('profile-modal-title').textContent = id ? 'Edit Profile' : 'Add Profile';
  document.getElementById('profile-edit-id').value   = id || '';
  document.getElementById('profile-form').reset();
  document.getElementById('profile-image-input').value = '';
  
  selectedProfileColor = color;
  document.getElementById('profile-color').value = color;
  document.querySelectorAll('.color-opt').forEach(c => c.classList.toggle('selected', c.dataset.color === color));
  if (id) document.getElementById('profile-name').value = name;

  const preview = document.getElementById('avatar-upload-preview');
  if (avatarUrl) {
    selectedProfileAvatarUrl = avatarUrl;
    document.getElementById('profile-avatar-url').value = avatarUrl;
    document.getElementById('clear-avatar-btn').style.display = '';
    preview.innerHTML = `<img src="${escHtml(avatarUrl)}" alt="Preview" style="width:100%; height:100%; object-fit:cover;" />`;
  } else {
    selectedProfileAvatarUrl = null;
    document.getElementById('profile-avatar-url').value = '';
    document.getElementById('clear-avatar-btn').style.display = 'none';
    preview.innerHTML = `<span id="avatar-preview-initials">${getInitials(name)}</span>`;
  }
  
  openModal('profile-modal');
}

function selectColor(color) {
  selectedProfileColor = color;
  document.getElementById('profile-color').value = color;
  document.querySelectorAll('.color-opt').forEach(c => c.classList.toggle('selected', c.dataset.color === color));
}

function handleProfileImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return; }
  resizeImage(file, 300, 300, (dataUrl) => {
    selectedProfileAvatarUrl = dataUrl;
    document.getElementById('profile-avatar-url').value = dataUrl;
    const preview = document.getElementById('avatar-upload-preview');
    preview.innerHTML = `<img src="${dataUrl}" alt="Preview" />`;
    document.getElementById('clear-avatar-btn').style.display = '';
  });
}

function resizeImage(file, maxW, maxH, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearProfileImage() {
  selectedProfileAvatarUrl = null;
  document.getElementById('profile-avatar-url').value   = '';
  document.getElementById('profile-image-input').value  = '';
  document.getElementById('clear-avatar-btn').style.display = 'none';
  const name    = document.getElementById('profile-name').value;
  const preview = document.getElementById('avatar-upload-preview');
  preview.innerHTML = `<span id="avatar-preview-initials">${getInitials(name)}</span>`;
}

async function saveProfile(e) {
  e.preventDefault();
  const id        = document.getElementById('profile-edit-id').value;
  const avatarUrl = document.getElementById('profile-avatar-url').value || null;
  const payload   = {
    name:      document.getElementById('profile-name').value.trim(),
    color:     selectedProfileColor,
    avatarUrl: avatarUrl,
  };
  try {
    const url = id ? `/api/profiles/${id}` : '/api/profiles';
    const res = await apiFetch(url, { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    closeModal('profile-modal');
    refreshProfiles();
    showToast(id ? 'Profile updated!' : 'Profile created!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmDeleteProfile(id, name) {
  document.getElementById('confirm-title').textContent = 'Delete Profile?';
  document.getElementById('confirm-msg').textContent   = `"${name}" and all its watch data will be permanently deleted.`;
  document.getElementById('confirm-ok-btn').onclick    = () => deleteProfile(id);
  openModal('confirm-modal');
}

async function deleteProfile(id) {
  closeModal('confirm-modal');
  try {
    const res = await apiFetch(`/api/profiles/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    refreshProfiles();
    showToast('Profile deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── PROFILE REORDERING (DRAG & DROP) ────────────
let draggedProfileId = null;

function handleProfileDragStart(e, id) {
  draggedProfileId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.5';
}

function handleProfileDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleProfileDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  draggedProfileId = null;
}

async function handleProfileDrop(e, targetId) {
  e.preventDefault();
  if (!draggedProfileId || draggedProfileId === targetId) return;

  const oldIdx = globalProfiles.findIndex(p => p._id === draggedProfileId);
  const newIdx = globalProfiles.findIndex(p => p._id === targetId);
  
  if (oldIdx === -1 || newIdx === -1) return;

  const [movedProfile] = globalProfiles.splice(oldIdx, 1);
  globalProfiles.splice(newIdx, 0, movedProfile);
  
  renderProfiles(globalProfiles);
  
  try {
    const profileIds = globalProfiles.map(p => p._id);
    await apiFetch('/api/profiles/reorder', {
      method: 'PUT',
      body: JSON.stringify({ profileIds })
    });
  } catch (err) {
    showToast('Failed to save profile order', 'error');
    refreshProfiles(); // revert
  }
}

// ─── VIEW SWITCHING ──────────────────────────────
function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
}

// ─── SEARCH ──────────────────────────────────────
function handleSearch(val) {
  searchQuery = val.trim().toLowerCase();
  document.getElementById('search-clear-btn').style.display = searchQuery ? 'flex' : 'none';
  renderMovies();
}
function clearSearch() {
  searchQuery = '';
  const input = document.getElementById('search-input');
  input.value = ''; input.focus();
  document.getElementById('search-clear-btn').style.display = 'none';
  renderMovies();
}

// ─── FILTER & SORT ───────────────────────────────
function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`filter-${f}`)?.classList.add('active');
  renderMovies();
}
function setSort(s) { currentSort = s; renderMovies(); }
function toggleSortDir() {
  sortDir = sortDir === 'desc' ? 'asc' : 'desc';
  document.getElementById('sort-dir-icon').style.transform = sortDir === 'asc' ? 'rotate(180deg)' : 'none';
  renderMovies();
}

function toggleMultiSelect() {
  multiSelectMode = !multiSelectMode;
  if (!multiSelectMode) selectedMovieIds.clear();
  document.getElementById('multiselect-toggle-btn').classList.toggle('active', multiSelectMode);
  document.getElementById('multiselect-bar').style.display = multiSelectMode ? 'flex' : 'none';
  updateMultiSelectCount();
  renderMovies();
}
function toggleMovieSelect(id, event) {
  if (event) event.stopPropagation();
  if (selectedMovieIds.has(id)) selectedMovieIds.delete(id);
  else selectedMovieIds.add(id);
  updateMultiSelectCount();
  renderMovies();
}
function updateMultiSelectCount() {
  const el = document.getElementById('multiselect-count');
  if (el) el.textContent = `${selectedMovieIds.size} selected`;
}
function clearMultiSelect() {
  selectedMovieIds.clear();
  updateMultiSelectCount();
  renderMovies();
}
function selectAllMovies() {
  const visibleCards = Array.from(document.querySelectorAll('.movie-card'));
  // Extract IDs from the onclick handlers (e.g., toggleMovieSelect('ID', ...))
  visibleCards.forEach(card => {
    const match = card.getAttribute('onclick').match(/toggleMovieSelect\(['"]([^'"]+)['"]/);
    if (match && match[1]) {
      selectedMovieIds.add(match[1]);
    }
  });
  updateMultiSelectCount();
  renderMovies();
}

function invertSelection() {
  const visibleCards = Array.from(document.querySelectorAll('.movie-card'));
  visibleCards.forEach(card => {
    const match = card.getAttribute('onclick').match(/toggleMovieSelect\(['"]([^'"]+)['"]/);
    if (match && match[1]) {
      const id = match[1];
      if (selectedMovieIds.has(id)) selectedMovieIds.delete(id);
      else selectedMovieIds.add(id);
    }
  });
  updateMultiSelectCount();
  renderMovies();
}

async function bulkSetStatus(newStatus) {
  if (selectedMovieIds.size === 0) return;
  const ids = Array.from(selectedMovieIds);
  try {
    for (const movieId of ids) {
      await apiFetch(`/api/movies/${movieId}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
    }
    await loadMovies(); // Refresh all
    selectedMovieIds.clear();
    updateMultiSelectCount();
    toggleMultiSelect(); // Turn off multi-select
  } catch (err) {
    showToast('Failed to bulk update status.', 'error');
  }
}

// ─── API HELPER ──────────────────────────────────
function apiFetch(path, options = {}) {
  const token = profileToken || accountToken;
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

// ─── LOAD DATA ───────────────────────────────────
async function loadMovies() {
  document.getElementById('loading-state').style.display = 'flex';
  try {
    const res = await apiFetch('/api/movies');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    movies = await res.json();
    updateGenreDropdown();
    renderMovies();
    updateStats();
  } catch (err) {
    showToast('Could not load movies. Is the backend running?', 'error');
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('empty-state').style.display  = 'block';
  }
}

// ─── RENDER MOVIES ───────────────────────────────
function setGenreFilter(val) { currentGenreFilter = val; renderMovies(); }
function setRatedFilter(val) { currentRatedFilter = val; renderMovies(); }
function updateGenreDropdown() {
  const select = document.getElementById('genre-select');
  if (!select) return;
  const genres = new Set();
  movies.forEach(m => (m.genre || []).forEach(g => genres.add(g)));
  const sorted = Array.from(genres).sort();
  const currentVal = select.value;
  select.innerHTML = '<option value="all">All Genres</option>';
  sorted.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g; select.appendChild(opt);
  });
  if (sorted.includes(currentVal)) select.value = currentVal;
}

function renderMovies() {
  const grid  = document.getElementById('movies-grid');
  const empty = document.getElementById('empty-state');
  document.getElementById('loading-state').style.display = 'none';

  let filtered = movies.filter(m => {
    const status      = m.profileStatus || 'unwatched';
    const matchFilter = currentFilter === 'all' || status === currentFilter;
    const matchGenre = currentGenreFilter === 'all' || (m.genre || []).includes(currentGenreFilter);
    const isRated = m.profileRating != null;
    let matchRated = true;
    if (currentRatedFilter === 'rated') matchRated = isRated;
    if (currentRatedFilter === 'unrated') matchRated = !isRated;

    const matchSearch = !searchQuery ||
      (m.title   || '').toLowerCase().includes(searchQuery) ||
      (m.director|| '').toLowerCase().includes(searchQuery) ||
      (m.genre   || []).some(g => g.toLowerCase().includes(searchQuery));
    return matchFilter && matchGenre && matchRated && matchSearch;
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    if (currentSort === 'title')   cmp = (a.title  || '').localeCompare(b.title  || '');
    else if (currentSort === 'year')    cmp = (a.year   || 0)  - (b.year   || 0);
    else if (currentSort === 'rating')  cmp = (a.averageRating || 0) - (b.averageRating || 0);
    else if (currentSort === 'watched') cmp = new Date(a.profileWatchedAt || 0) - new Date(b.profileWatchedAt || 0);
    else cmp = new Date(a.createdAt || 0) - new Date(b.createdAt || 0); // added
    return sortDir === 'asc' ? cmp : -cmp;
  });

  if (filtered.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML      = filtered.map(movieCardHTML).join('');
}

function movieCardHTML(m) {
  const status      = m.profileStatus || 'unwatched';
  const statusLabel = { unwatched: 'Unwatched', watched: 'Watched', unfinished: 'Unfinished' }[status];
  const genres      = (m.genre || []).slice(0, 2).map(g => `<span class="genre-pill">${escHtml(g)}</span>`).join('');
  const avgRating   = m.averageRating ? `<div class="card-avg-rating-badge">${starIconSvg} ${m.averageRating}</div>` : '';
  const poster      = m.posterUrl
    ? `<img class="card-poster" src="${escHtml(m.posterUrl)}" alt="${escHtml(m.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-poster-placeholder\\'><span></span><span>${escHtml(m.title)}</span></div>'" />`
    : `<div class="card-poster-placeholder"><span></span><span>${escHtml(m.title)}</span></div>`;
  const editBtn = (!m.tmdbId)
    ? `<button class="card-action-btn" title="Edit" onclick="event.stopPropagation(); openMovieModal('${m._id}')">${editIconSvg}</button>`
    : '';

  const isSelected = selectedMovieIds.has(m._id);
  const selectOverlayHtml = multiSelectMode ? `
    <div class="multiselect-overlay ${isSelected ? 'selected' : ''}">
      <div class="multiselect-checkbox">
        ${isSelected ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>
    </div>
  ` : '';

  const clickHandler = multiSelectMode ? `toggleMovieSelect('${m._id}', event)` : `openDetailModal('${m._id}')`;
  const extraClasses = multiSelectMode && isSelected ? 'selected' : '';

  return `
    <div class="movie-card ${extraClasses}" onclick="${clickHandler}">
      <div class="card-poster-wrap">
        ${poster}
        ${selectOverlayHtml}
        <div class="card-status-badge badge-${status}">${statusLabel}</div>
        ${avgRating}
        <div class="card-actions" onclick="event.stopPropagation()">
          ${editBtn}
          <button class="card-action-btn danger" title="Delete" onclick="event.stopPropagation(); confirmDelete('${m._id}','movie','${escJs(m.title)}')">${deleteIconSvg}</button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${escHtml(m.title)}</div>
        <div class="card-meta">${m.year ? `<span>${m.year}</span>` : ''}${m.runtime ? `<span>· ${m.runtime}m</span>` : ''}</div>
        ${genres ? `<div class="card-genre">${genres}</div>` : ''}
      </div>
    </div>`;
}

function updateStats() {
  const total = movies.length;
  const watched = movies.filter(m => (m.profileStatus || 'unwatched') === 'watched').length;
  const pct = total === 0 ? 0 : Math.round((watched / total) * 100);
  
  const ratedMovies = movies.filter(m => m.profileRating > 0);
  const avgProfileRating = ratedMovies.length > 0 
    ? (ratedMovies.reduce((sum, m) => sum + m.profileRating, 0) / ratedMovies.length).toFixed(1)
    : 0;

  const highestMovie = [...movies].filter(m => m.averageRating > 0).sort((a, b) => b.averageRating - a.averageRating)[0];
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-watched').innerHTML = `${watched} <span style="font-size:14px; color:var(--text-muted); font-weight:500;">(${pct}%)</span>`;
  document.getElementById('stat-avg-score').innerHTML = `${avgProfileRating} <span style="font-size:14px; color:var(--text-muted); font-weight:500;">/10</span>`;
  
  document.getElementById('stat-top-rated').innerHTML = highestMovie 
    ? escHtml(highestMovie.title)
    : `<span style="color:var(--text-muted); font-size:15px;">None</span>`;
    
  document.getElementById('stat-top-rated-score').innerHTML = highestMovie
    ? `<span style="display:flex; width:12px;">${starIconSvg}</span> ${highestMovie.averageRating}`
    : '';
}

let pendingMovies        = []; // For bulk add from TMDB

// ─── MOVIE MODAL ─────────────────────────────────
function openMovieModal(id = null) {
  document.getElementById('movie-modal-title').textContent = id ? 'Edit Movie' : 'Add Movie';
  document.getElementById('movie-id').value     = '';
  document.getElementById('movie-tmdb-id').value = '';
  document.getElementById('movie-form').reset();
  document.getElementById('tmdb-results').innerHTML      = '';
  document.getElementById('tmdb-search-input').value     = '';
  document.getElementById('tmdb-search-spinner').style.display = 'none';
  selectedRating = 0;
  pendingMovies = [];
  updateStarPicker(0);
  toggleRatingField();
  document.getElementById('poster-preview-wrap').style.display = 'none';
  document.getElementById('movie-review-section').style.display = 'none';
  
  // Reset bulk add buttons
  document.getElementById('review-back-btn').style.display = 'none';
  document.getElementById('confirm-bulk-btn').style.display = 'none';
  document.getElementById('review-movies-btn').style.display = 'none';

  updatePendingMoviesBar();

  if (id) {
    document.getElementById('back-to-search-btn').style.display = 'none';
    document.getElementById('movie-search-section').style.display = 'none';
    document.getElementById('movie-form').style.display = 'block';
    document.getElementById('movie-save-btn').style.display = 'block';
    document.getElementById('modal-cancel-btn').style.display = 'block';
    const movie = movies.find(m => m._id === id);
    if (movie) fillMovieForm(movie);
  } else {
    document.getElementById('back-to-search-btn').style.display = 'block';
    document.getElementById('movie-search-section').style.display = 'block';
    document.getElementById('movie-form').style.display = 'none';
    document.getElementById('movie-save-btn').style.display = 'none';
    document.getElementById('modal-cancel-btn').style.display = 'block';
    document.getElementById('add-manual-wrap').style.display = 'none';
    removeReadonly();
  }
  openModal('movie-modal');
  if (!id) {
    setTimeout(() => document.getElementById('tmdb-search-input').focus(), 50);
  }
}

function backToSearch() {
  document.getElementById('movie-form').style.display = 'none';
  document.getElementById('movie-save-btn').style.display = 'none';
  document.getElementById('movie-search-section').style.display = 'block';
  updatePendingMoviesBar();
  setTimeout(() => {
    const input = document.getElementById('tmdb-search-input');
    input.focus();
    if (input.value.trim() !== '') {
      searchTMDB();
    }
  }, 50);
}

function showManualForm() {
  document.getElementById('movie-search-section').style.display = 'none';
  document.getElementById('movie-form').style.display = 'block';
  document.getElementById('movie-save-btn').style.display = 'block';
  document.getElementById('movie-tmdb-id').value = '';
  // hide pending items
  document.getElementById('pending-movies-count').style.visibility = 'hidden';
  document.getElementById('review-movies-btn').style.display = 'none';
  removeReadonly();
}

function removeReadonly() {
  document.getElementById('movie-form').querySelectorAll('.form-input:not(#movie-status):not(#movie-notes)')
    .forEach(i => i.removeAttribute('readonly'));
}

function fillMovieForm(m) {
  document.getElementById('movie-id').value       = m._id;
  document.getElementById('movie-tmdb-id').value  = m.tmdbId || '';
  document.getElementById('movie-title').value    = m.title  || '';
  document.getElementById('movie-year').value     = m.year   || '';
  document.getElementById('movie-runtime').value  = m.runtime || '';
  document.getElementById('movie-director').value = m.director || '';
  document.getElementById('movie-genre').value    = (m.genre || []).join(', ');
  document.getElementById('movie-status').value   = m.profileStatus || 'unwatched';
  document.getElementById('movie-synopsis').value = m.synopsis || '';
  document.getElementById('movie-poster').value   = m.posterUrl || '';
  document.getElementById('movie-notes').value    = m.profileNotes || '';
  selectedRating = m.profileRating || 0;
  document.getElementById('movie-rating').value   = selectedRating;
  updateStarPicker(selectedRating);
  toggleRatingField();
  if (m.posterUrl) previewPoster(m.posterUrl);
  if (m.tmdbId) {
    document.getElementById('movie-form').querySelectorAll('.form-input:not(#movie-status):not(#movie-notes)')
      .forEach(i => i.setAttribute('readonly', true));
  } else {
    removeReadonly();
  }
}

async function saveMovie(e) {
  e.preventDefault();
  const id       = document.getElementById('movie-id').value;
  const genreStr = document.getElementById('movie-genre').value;
  const payload  = {
    title:         document.getElementById('movie-title').value.trim(),
    year:          parseInt(document.getElementById('movie-year').value)    || undefined,
    runtime:       parseInt(document.getElementById('movie-runtime').value) || undefined,
    director:      document.getElementById('movie-director').value.trim()  || undefined,
    genre:         genreStr ? genreStr.split(',').map(g => g.trim()).filter(Boolean) : [],
    synopsis:      document.getElementById('movie-synopsis').value.trim()  || undefined,
    posterUrl:     document.getElementById('movie-poster').value.trim()    || undefined,
    profileStatus: document.getElementById('movie-status').value,
    profileRating: document.getElementById('movie-status').value === 'watched' ? (selectedRating || null) : null,
    profileNotes:  document.getElementById('movie-notes').value.trim()     || undefined,
    tmdbId:        parseInt(document.getElementById('movie-tmdb-id').value) || undefined,
  };

  if (!id) {
    const isDuplicate = movies.some(m => 
      (payload.tmdbId && m.tmdbId === payload.tmdbId) || 
      (m.title.toLowerCase() === payload.title.toLowerCase())
    );
    if (isDuplicate) {
      showToast('This movie is already on your list.', 'error');
      return;
    }
  }

  const btn = document.getElementById('movie-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const url = id ? `/api/movies/${id}` : '/api/movies';
    const res = await apiFetch(url, { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    const saved = await res.json();
    movies = id ? movies.map(m => m._id === id ? saved : m) : [saved, ...movies];
    renderMovies(); updateStats();
    closeModal('movie-modal');
    showToast(id ? 'Movie updated!' : 'Movie added!', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Movie';
  }
}

// ─── TMDB SEARCH ─────────────────────────────────
let tmdbSearchTimeout = null;

function debouncedSearchTMDB() {
  clearTimeout(tmdbSearchTimeout);
  const query     = document.getElementById('tmdb-search-input').value.trim();
  const resultsEl = document.getElementById('tmdb-results');
  if (!query) {
    resultsEl.innerHTML = '';
    document.getElementById('add-manual-wrap').style.display = 'none';
    document.getElementById('tmdb-search-spinner').style.display = 'none';
    return;
  }
  document.getElementById('tmdb-search-spinner').style.display = 'flex';
  resultsEl.innerHTML = '';
  tmdbSearchTimeout = setTimeout(() => searchTMDB(), 450);
}

async function searchTMDB() {
  const query     = document.getElementById('tmdb-search-input').value.trim();
  const resultsEl = document.getElementById('tmdb-results');
  if (!query) return;
  try {
    // Using api_key param (v3 classic — still works with a valid key)
    const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.status_message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    document.getElementById('tmdb-search-spinner').style.display = 'none';
    if (!data.results?.length) {
      resultsEl.innerHTML = `<p class="tmdb-status-msg">No results found for "${escHtml(query)}".</p>`;
      document.getElementById('add-manual-wrap').style.display = 'block';
      return;
    }
    document.getElementById('add-manual-wrap').style.display = 'block';
    resultsEl.innerHTML = `<div class="tmdb-results-grid">` + data.results.slice(0, 12).map(r => {
      const year   = r.release_date ? r.release_date.slice(0, 4) : '';
      const poster = r.poster_path  ? `${TMDB_IMG}${r.poster_path}` : '';
      const isSelected = pendingMovies.some(p => p.id === r.id);
      return `
        <div class="tmdb-grid-item ${isSelected ? 'selected' : ''}" onclick="togglePendingTMDB(${r.id}, '${escJs(r.title)}', '${year}', '${poster}', this)">
          <div class="tmdb-grid-poster-wrap">
            ${poster
              ? `<img class="tmdb-grid-poster" src="${poster}" alt="${escHtml(r.title)}" loading="lazy"/>`
              : `<div class="tmdb-grid-ph"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="20" height="20" rx="3"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div>`
            }
            <div class="multiselect-overlay ${isSelected ? 'selected' : ''}">
              <div class="multiselect-checkbox">
                ${isSelected ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
              </div>
            </div>
          </div>
          <div class="tmdb-grid-title" title="${escHtml(r.title)}">${escHtml(r.title)}</div>
          <div class="tmdb-grid-year">${year}</div>
        </div>`;
    }).join('') + `</div>`;
  } catch (err) {
    document.getElementById('tmdb-search-spinner').style.display = 'none';
    resultsEl.innerHTML = `<p class="tmdb-status-msg error">Search failed: ${escHtml(err.message)}. Check your TMDB API key.</p>`;
    document.getElementById('add-manual-wrap').style.display = 'block';
  }
}

function togglePendingTMDB(id, title, year, poster, el) {
  const existingIdx = pendingMovies.findIndex(p => p.id === id);
  if (existingIdx >= 0) {
    pendingMovies.splice(existingIdx, 1);
    el.classList.remove('selected');
    el.querySelector('.multiselect-overlay').classList.remove('selected');
    el.querySelector('.multiselect-checkbox').innerHTML = '';
  } else {
    // Check for duplicates in DB
    if (movies.some(m => m.tmdbId === id)) {
      showToast('Already in your list.', 'error');
      return;
    }
    pendingMovies.push({ id, title, year, poster });
    el.classList.add('selected');
    el.querySelector('.multiselect-overlay').classList.add('selected');
    el.querySelector('.multiselect-checkbox').innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
  }
  updatePendingMoviesBar();
}

function updatePendingMoviesBar() {
  const countEl = document.getElementById('pending-movies-count');
  const reviewBtn = document.getElementById('review-movies-btn');
  if (!countEl || !reviewBtn) return;
  
  // Only show the count and review button if we're in the search section. 
  // If we're already in review section, showReviewSection handles it.
  const isSearchVisible = document.getElementById('movie-search-section').style.display !== 'none';
  
  if (pendingMovies.length > 0) {
    countEl.style.visibility = 'visible';
    countEl.textContent = `${pendingMovies.length} selected`;
    if (isSearchVisible) reviewBtn.style.display = 'block';
  } else {
    countEl.style.visibility = 'hidden';
    reviewBtn.style.display = 'none';
    // if we emptied the list while in review section, maybe go back to search?
    if (!isSearchVisible && document.getElementById('movie-review-section').style.display === 'block') {
      backToSearchFromReview();
    }
  }
}

function showReviewSection() {
  document.getElementById('movie-search-section').style.display = 'none';
  document.getElementById('movie-review-section').style.display = 'block';
  document.getElementById('review-movies-btn').style.display = 'none';
  document.getElementById('modal-cancel-btn').style.display = 'none';
  document.getElementById('review-back-btn').style.display = 'block';
  document.getElementById('confirm-bulk-btn').style.display = 'block';
  renderReviewMovies();
}

function backToSearchFromReview() {
  document.getElementById('movie-review-section').style.display = 'none';
  document.getElementById('movie-search-section').style.display = 'block';
  document.getElementById('review-back-btn').style.display = 'none';
  document.getElementById('confirm-bulk-btn').style.display = 'none';
  document.getElementById('modal-cancel-btn').style.display = 'block';
  updatePendingMoviesBar();
}

function renderReviewMovies() {
  const listEl = document.getElementById('review-movies-list');
  if (pendingMovies.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No movies selected.</p>';
    document.getElementById('confirm-bulk-btn').disabled = true;
    return;
  }
  document.getElementById('confirm-bulk-btn').disabled = false;
  listEl.innerHTML = pendingMovies.map((p, idx) => `
    <div style="display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
      ${p.poster 
        ? `<img src="${escHtml(p.poster)}" style="width:36px; height:54px; border-radius:4px; object-fit:cover;" />` 
        : `<div style="width:36px; height:54px; border-radius:4px; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"/></svg></div>`
      }
      <div style="flex:1;">
        <div style="font-weight:600; font-size:14px; color:var(--text-primary);">${escHtml(p.title)}</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${escHtml(p.year)}</div>
      </div>
      <button onclick="removePendingMovie(${p.id})" style="color:#ef4444; background:rgba(239,68,68,0.1); padding:6px; border:none; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');
}

function removePendingMovie(id) {
  pendingMovies = pendingMovies.filter(p => p.id !== id);
  renderReviewMovies();
  updatePendingMoviesBar();
  // Update search UI if visible under
  const searchItems = document.querySelectorAll('.tmdb-grid-item');
  searchItems.forEach(el => {
    if (el.getAttribute('onclick').includes(`togglePendingTMDB(${id}`)) {
      el.classList.remove('selected');
      const overlay = el.querySelector('.multiselect-overlay');
      if(overlay) {
        overlay.classList.remove('selected');
        el.querySelector('.multiselect-checkbox').innerHTML = '';
      }
    }
  });
}

async function confirmBulkAdd() {
  if (pendingMovies.length === 0) return;
  const btn = document.getElementById('confirm-bulk-btn');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Adding...';

  try {
    // We add them one by one, fetching full details from TMDB so we have all data (genres, director, etc)
    let addedCount = 0;
    for (const p of pendingMovies) {
      try {
        const dRes = await fetch(`${TMDB_BASE}/movie/${p.id}?api_key=${TMDB_API_KEY}&append_to_response=credits&language=en-US`);
        const d = await dRes.json();
        const payload = {
          title: d.title,
          year: d.release_date ? parseInt(d.release_date.slice(0,4)) : undefined,
          runtime: d.runtime || undefined,
          synopsis: d.overview || undefined,
          genre: (d.genres || []).map(g => g.name),
          director: ((d.credits?.crew || []).find(c => c.job === 'Director') || {}).name,
          posterUrl: d.poster_path ? `${TMDB_IMG}${d.poster_path}` : '',
          profileStatus: 'unwatched', // Default status
          tmdbId: p.id
        };
        const res = await apiFetch('/api/movies', { method: 'POST', body: JSON.stringify(payload) });
        if (res.ok) addedCount++;
      } catch (e) {
        console.error("Failed to add movie", p.title, e);
      }
    }
    await loadMovies();
    closeModal('movie-modal');
    showToast(`Successfully added ${addedCount} movie(s)!`, 'success');
  } catch (err) {
    showToast('An error occurred while bulk adding.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}


async function fillFromTMDB(tmdbId) {
  // Check for duplicates before fetching
  if (movies.some(m => m.tmdbId === tmdbId)) {
    closeModal('movie-modal');
    showToast('This movie is already on your list.', 'error');
    return;
  }

  const resultsEl = document.getElementById('tmdb-results');
  resultsEl.innerHTML = `<p class="tmdb-status-msg">Loading movie details…</p>`;
  try {
    const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits&language=en-US`;
    const res = await fetch(url);
    const d   = await res.json();
    document.getElementById('movie-tmdb-id').value  = tmdbId;
    document.getElementById('movie-title').value    = d.title    || '';
    document.getElementById('movie-year').value     = d.release_date ? d.release_date.slice(0, 4) : '';
    document.getElementById('movie-runtime').value  = d.runtime  || '';
    document.getElementById('movie-synopsis').value = d.overview || '';
    document.getElementById('movie-genre').value    = (d.genres || []).map(g => g.name).join(', ');
    const director = (d.credits?.crew || []).find(c => c.job === 'Director');
    if (director) document.getElementById('movie-director').value = director.name;
    const poster = d.poster_path ? `${TMDB_IMG}${d.poster_path}` : '';
    document.getElementById('movie-poster').value = poster;
    if (poster) previewPoster(poster);

    document.getElementById('movie-search-section').style.display = 'none';
    document.getElementById('movie-form').style.display = 'block';
    // Mark TMDB fields as readonly
    document.getElementById('movie-form').querySelectorAll('.form-input:not(#movie-status):not(#movie-notes)')
      .forEach(i => i.setAttribute('readonly', true));
    showToast('Details filled from TMDB!', 'success');
  } catch { showToast('Failed to fetch movie details from TMDB.', 'error'); }
}

function previewPoster(url) {
  const wrap = document.getElementById('poster-preview-wrap');
  const img  = document.getElementById('poster-preview');
  if (url) {
    img.src = url; wrap.style.display = 'block';
    img.onerror = () => { wrap.style.display = 'none'; };
  } else {
    wrap.style.display = 'none';
  }
}

// ─── RATING (1–10) ───────────────────────────────
function setRating(val) {
  selectedRating = val;
  document.getElementById('movie-rating').value = val;
  updateStarPicker(val);
}
function updateStarPicker(val) {
  const display = document.getElementById('rating-display');
  document.querySelectorAll('#star-picker .star').forEach((s, i) => s.classList.toggle('active', i < val));
  if (val) { display.textContent = `${val} / 10`; display.classList.add('has-value'); }
  else     { display.textContent = 'Not rated';   display.classList.remove('has-value'); }
}
function initStarHover() {
  const stars = document.querySelectorAll('#star-picker .star');
  stars.forEach((s, idx) => {
    s.addEventListener('mouseenter', () => stars.forEach((st, i) => st.classList.toggle('active', i <= idx)));
    s.addEventListener('mouseleave', () => updateStarPicker(selectedRating));
  });
}
function toggleRatingField() {
  const status = document.getElementById('movie-status').value;
  document.getElementById('rating-group').style.display =
    (status === 'watched') ? '' : 'none';
}

// ─── DETAIL MODAL ────────────────────────────────
function openDetailModal(id) {
  const m = movies.find(m => m._id === id);
  if (!m) return;
  const status      = m.profileStatus || 'unwatched';
  const statusLabel = { unwatched: 'Unwatched', watched: 'Watched', unfinished: 'Unfinished' }[status];
  const backdrop    = m.backdropUrl || m.posterUrl;
  const rating      = m.profileRating || 0;
  const avgRating   = m.averageRating || 0;
  const starsHtml   = [1,2,3,4,5,6,7,8,9,10].map(i =>
    `<span class="detail-star ${i <= Math.round(avgRating) ? 'on' : ''}">${starIconSvg}</span>`
  ).join('');
  const ratingHtml = avgRating
    ? `<div class="detail-rating-row">${starsHtml}<span class="detail-rating-num">&nbsp;${avgRating}</span><span class="detail-rating-max">/10</span></div>`
    : '';
  const inlineStars = status === 'watched' ? [1,2,3,4,5,6,7,8,9,10].map(i =>
    `<span class="inline-star ${i <= rating ? 'on' : ''}" data-val="${i}"
      onclick="quickRatingChange('${m._id}',${i})"
      onmouseenter="hoverInlineStars(${i},'${m._id}')"
      onmouseleave="resetInlineStars(${rating},'${m._id}')">${starIconSvg}</span>`
  ).join('') : '<span style="color: var(--text-muted); font-size: 0.8rem;">Mark as Watched to rate</span>';
  const editBtn = (!m.tmdbId)
    ? `<button class="btn-primary" onclick="closeModal('detail-modal');openMovieModal('${m._id}')">Edit Movie</button>`
    : '';

  let breakdownHtml = '';
  if (m.allRatings && m.allRatings.length > 0) {
    breakdownHtml = `<div class="detail-breakdown" style="margin-top:24px;">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">Community Ratings</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${m.allRatings.map(r => {
          const p = globalProfiles.find(p => p._id === r.profileId);
          const pName = p ? p.name : 'A Profile';
          const pAvatar = p?.avatarUrl 
            ? `<img src="${escHtml(p.avatarUrl)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`
            : `<div style="width:24px;height:24px;border-radius:50%;background:${p?.color||'#3b82f6'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:#fff;">${getInitials(pName)}</div>`;
            
          const tenStars = [1,2,3,4,5,6,7,8,9,10].map(i => 
            `<span style="color:${i <= r.rating ? '#f0ba4a' : 'rgba(255,255,255,0.15)'}; display:flex; width:12px; margin-right:2px; transition:color 0.2s;">${starIconSvg}</span>`
          ).join('');
            
          return `<div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; align-items:center; gap:10px;">
              ${pAvatar}
              <span style="font-size:13px; font-weight:500; color:var(--text-primary);">${escHtml(pName)}</span>
            </div>
            <div style="display:flex; align-items:center; color:var(--text-primary); font-weight:600; font-size:13px;">
              <div style="display:flex; align-items:center; margin-right:12px;">${tenStars}</div>
              <div style="width:38px; text-align:right; font-variant-numeric:tabular-nums; display:flex; justify-content:flex-end; align-items:baseline; color:var(--text-muted); font-weight:500;">
                ${r.rating}<span style="font-size:11px; font-weight:400; margin-left:2px;">/10</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    ${backdrop ? `<img class="detail-backdrop" src="${escHtml(backdrop)}" alt="" onerror="this.style.display='none'" />` : ''}
    <div class="detail-body">
      <!-- Actions: edit pinned to top-right of body -->
      <div style="position:absolute; top:16px; right:16px; display:flex; gap:8px; z-index:2;">
        ${editBtn}
      </div>
      <div class="detail-hero">
        ${m.posterUrl
          ? `<img class="detail-poster" src="${escHtml(m.posterUrl)}" alt="${escHtml(m.title)}" onerror="this.style.display='none'" />`
          : `<div class="detail-poster-ph"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="20" height="20" rx="3"/></svg></div>`
        }
        <div class="detail-info">
          <h2 class="detail-title">${escHtml(m.title)}</h2>
          <div class="detail-meta-row">
            ${m.year    ? `<span>${m.year}</span>` : ''}
            ${m.runtime ? `<span class="detail-sep">·</span><span>${m.runtime} min</span>` : ''}
            ${m.director? `<span class="detail-sep">·</span><span>Dir. ${escHtml(m.director)}</span>` : ''}
          </div>
          ${m.genre?.length ? `<div class="detail-genres">${m.genre.map(g => `<span class="detail-genre-pill">${escHtml(g)}</span>`).join('')}</div>` : ''}
          <div style="display:flex; gap:10px; align-items:center; margin-top:16px; flex-wrap:wrap;">
            <span class="card-status-badge badge-${status}" style="position:static;display:inline-block">${statusLabel}</span>
            ${ratingHtml}
          </div>
        </div>
      </div>
      ${m.synopsis ? `<p class="detail-synopsis">${escHtml(m.synopsis)}</p>` : ''}
      <div class="detail-profile-section">
        <div class="detail-profile-section-title">Tracking — ${escHtml(currentProfile?.name || 'My Profile')}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Status</div>
        <div class="detail-status-btns">
          ${['unwatched','unfinished','watched'].map(s =>
            `<button class="detail-status-btn detail-status-btn-${s} ${status===s?'active':''}" onclick="quickStatusChange('${m._id}','${s}')">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`
          ).join('')}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">My Rating</div>
          ${rating ? `<button class="btn-ghost" style="padding:2px 6px; font-size:11px; color:var(--text-muted);" onclick="quickRatingChange('${m._id}', null)">Clear Rating</button>` : ''}
        </div>
        <div class="inline-rating">
          <div class="inline-stars" id="inline-stars-${m._id}">${inlineStars}</div>
          <span style="font-size:13px;color:var(--text-muted)" id="inline-rating-num-${m._id}">${status === 'watched' ? (rating ? `${rating}/10` : 'Not rated') : ''}</span>
        </div>
        ${breakdownHtml}
      </div>
      ${m.profileNotes ? `<div class="detail-notes-wrap"><div class="detail-notes-label">My Notes</div><div class="detail-notes">${escHtml(m.profileNotes)}</div></div>` : ''}
    </div>`;
  openModal('detail-modal');
}

function hoverInlineStars(val, movieId) {
  document.querySelectorAll(`#inline-stars-${movieId} .inline-star`).forEach((s, i) => {
    s.classList.toggle('on', i < val);
  });
}
function resetInlineStars(currentRating, movieId) {
  document.querySelectorAll(`#inline-stars-${movieId} .inline-star`).forEach((s, i) => {
    s.classList.toggle('on', i < currentRating);
  });
}
async function quickStatusChange(id, status) {
  try {
    const res = await apiFetch(`/api/movies/${id}/profile`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (!res.ok) throw new Error();
    await loadMovies();
    renderMovies(); updateStats();
    openDetailModal(id);
    showToast(`Marked as ${status}`, 'success');
  } catch { showToast('Failed to update status', 'error'); }
}

async function quickRatingChange(id, rating) {
  try {
    const res = await apiFetch(`/api/movies/${id}/profile`, { method: 'PUT', body: JSON.stringify({ rating }) });
    if (!res.ok) throw new Error();
    await loadMovies();
    renderMovies();
    openDetailModal(id);
    showToast(rating ? `Rated ${rating}/10` : 'Rating cleared', 'success');
  } catch { showToast('Failed to save rating', 'error'); }
}

// ─── DELETE ──────────────────────────────────────
function confirmDelete(id, type, name) {
  document.getElementById('confirm-title').textContent = `Delete Movie?`;
  document.getElementById('confirm-msg').textContent   = `"${name}" will be permanently removed from the account.`;
  document.getElementById('confirm-ok-btn').onclick    = () => deleteItem(id);
  openModal('confirm-modal');
}
async function deleteItem(id) {
  closeModal('confirm-modal'); closeModal('detail-modal');
  try {
    const res = await apiFetch(`/api/movies/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    movies = movies.filter(m => m._id !== id);
    renderMovies(); updateStats();
    showToast('Deleted', 'success');
  } catch { showToast('Failed to delete', 'error'); }
}

// ─── MODAL HELPERS ───────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (id === 'settings-modal') {
    // Populate account info
    document.getElementById('settings-account-name-input').value = currentAccount?.accountName || '';
    document.getElementById('settings-account-email').textContent = currentAccount?.email || '';
    // Reset form
    document.getElementById('settings-current-pw').value = '';
    document.getElementById('settings-new-pw').value = '';
    document.getElementById('settings-confirm-pw').value = '';
    document.getElementById('settings-error').style.display = 'none';
    document.getElementById('settings-success').style.display = 'none';
  }
  el.showModal();
  document.documentElement.style.overflow = 'hidden';
}


async function changeAccountName() {
  const newName = document.getElementById('settings-account-name-input').value.trim();
  if (!newName) return showToast('Account name cannot be empty', 'error');
  try {
    const res = await apiFetch('/api/auth/update-account', { method: 'PUT', body: JSON.stringify({ accountName: newName }) });
    if (!res.ok) throw new Error();
    const updatedAccount = await res.json();
    currentAccount = updatedAccount;
    localStorage.setItem('ns_account', JSON.stringify(currentAccount));
    showToast('Account name updated successfully', 'success');
    const nameEl = document.getElementById('profiles-account-name');
    if (nameEl) nameEl.textContent = updatedAccount.accountName;
  } catch (e) {
    showToast('Failed to update account name', 'error');
  }
}

async function changePassword() {
  const currentPw  = document.getElementById('settings-current-pw').value.trim();
  const newPw      = document.getElementById('settings-new-pw').value.trim();
  const confirmPw  = document.getElementById('settings-confirm-pw').value.trim();
  const errEl      = document.getElementById('settings-error');
  const successEl  = document.getElementById('settings-success');
  
  errEl.style.display = 'none';
  successEl.style.display = 'none';
  
  const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };
  
  if (!currentPw || !newPw || !confirmPw) return showErr('All fields are required.');
  if (newPw !== confirmPw) return showErr('New passwords do not match.');
  if (newPw.length < 6) return showErr('New password must be at least 6 characters.');
  
  try {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accountToken}`
      },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
    });
    const data = await res.json();
    if (!res.ok) return showErr(data.error || 'Failed to update password.');
    successEl.textContent = 'Password updated successfully.';
    successEl.style.display = 'block';
    document.getElementById('settings-current-pw').value = '';
    document.getElementById('settings-new-pw').value = '';
    document.getElementById('settings-confirm-pw').value = '';
  } catch (err) {
    showErr(err.message);
  }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el && el.open) el.close();
  if (!document.querySelector('dialog.modal-dlg[open]')) {
    document.documentElement.style.overflow = '';
  }
}
// Close when user clicks the backdrop area (outside the .modal card)
function closeOnBackdrop(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}
// Restore scroll if user closes dialog with Escape key
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('dialog.modal-dlg').forEach(dlg => {
    dlg.addEventListener('close', () => {
      if (!document.querySelector('dialog.modal-dlg[open]')) {
        document.documentElement.style.overflow = '';
      }
    });
    // Cancel (Escape) — allow default close but restore scroll
    dlg.addEventListener('cancel', () => {
      setTimeout(() => {
        if (!document.querySelector('dialog.modal-dlg[open]')) {
          document.documentElement.style.overflow = '';
        }
      }, 0);
    });
  });
});

// ─── TOAST ───────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escHtml(String(msg))}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ─── UTIL ────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escJs(str) {
  if (!str) return '';
  // Escapes backslashes, single quotes (for JS), and double quotes (for HTML attribute)
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
