/* ==============================================
   nsMovies v2 – Frontend Application
   ============================================== */

// ─── CONFIG ─────────────────────────────────────
// Auto-detects local vs production
const API_BASE = (
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname === '0.0.0.0'
) ? 'http://localhost:3001'
  : 'https://your-project.vercel.app'; // ← Replace with Vercel URL for production

const TMDB_API_KEY = 'YOUR_TMDB_API_KEY'; // ← Replace with your TMDB key
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// ─── STATE ──────────────────────────────────────
let movies = [];
let series = [];
let accountToken = null;
let profileToken = null;
let currentAccount = null;
let currentProfile = null;
let currentFilter = 'all';
let currentSort = 'added';
let searchQuery = '';
let selectedRating = 0;
let selectedProfileEmoji = '🎬';
let selectedProfileColor = '#4f8ef7';
let selectedProfileAvatarUrl = null;

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

function enterApp() {
  showScreen('app');
  updateProfileHeader();
  loadMovies();
  loadSeries();
}

function updateProfileHeader() {
  if (!currentProfile) return;
  const btn = document.getElementById('active-profile-btn');
  const emoji = document.getElementById('active-profile-emoji');
  const img = document.getElementById('active-profile-img');
  btn.style.background = hexToRgba(currentProfile.color || '#4f8ef7', 0.25);
  btn.style.borderColor = hexToRgba(currentProfile.color || '#4f8ef7', 0.5);
  if (currentProfile.avatarUrl) {
    img.src = currentProfile.avatarUrl;
    img.style.display = 'block';
    emoji.style.display = 'none';
  } else {
    emoji.textContent = currentProfile.avatarEmoji || '🎬';
    emoji.style.display = '';
    img.style.display = 'none';
  }
}

// ─── AUTH FORMS ──────────────────────────────────
function toggleAuthMode() {
  const isLogin = document.getElementById('login-form').style.display !== 'none';
  document.getElementById('login-form').style.display = isLogin ? 'none' : 'flex';
  document.getElementById('register-form').style.display = isLogin ? 'flex' : 'none';
  document.getElementById('auth-title').textContent = isLogin ? 'Create Account' : 'Sign In';
  document.getElementById('auth-sub').textContent = isLogin
    ? 'Create your nsMovies account to start tracking.'
    : 'Welcome back. Sign in to your account.';
  document.getElementById('auth-toggle-msg').textContent = isLogin ? 'Already have an account?' : "Don't have an account?";
  document.getElementById('auth-toggle-btn').textContent = isLogin ? 'Sign in' : 'Create one';
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent = '';
}

// Password show/hide toggle
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.querySelector('.eye-icon').style.display = isPass ? 'none' : '';
  btn.querySelector('.eye-off-icon').style.display = isPass ? '' : 'none';
  btn.title = isPass ? 'Hide password' : 'Show password';
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  errEl.textContent = '';
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    accountToken = data.accountToken;
    currentAccount = data.account;
    localStorage.setItem('ns_account_token', accountToken);
    localStorage.setItem('ns_account', JSON.stringify(currentAccount));
    localStorage.removeItem('ns_profile_token');
    localStorage.removeItem('ns_current_profile');
    profileToken = null; currentProfile = null;
    document.getElementById('profiles-account-name').textContent = currentAccount.accountName;
    showScreen('profiles');
    renderProfiles(data.profiles);
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const accountName = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = 'Creating…';
  errEl.textContent = '';
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    accountToken = data.accountToken;
    currentAccount = data.account;
    localStorage.setItem('ns_account_token', accountToken);
    localStorage.setItem('ns_account', JSON.stringify(currentAccount));
    document.getElementById('profiles-account-name').textContent = currentAccount.accountName;
    showScreen('profiles');
    renderProfiles(data.profiles);
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

function logout() {
  localStorage.removeItem('ns_account_token');
  localStorage.removeItem('ns_profile_token');
  localStorage.removeItem('ns_current_profile');
  localStorage.removeItem('ns_account');
  accountToken = profileToken = currentAccount = currentProfile = null;
  movies = []; series = [];
  showScreen('login');
  document.getElementById('login-form').style.display = 'flex';
  document.getElementById('register-form').style.display = 'none';
}

function switchProfile() {
  localStorage.removeItem('ns_profile_token');
  localStorage.removeItem('ns_current_profile');
  profileToken = null; currentProfile = null;
  movies = []; series = [];
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
    renderProfiles(profiles);
  } catch {
    showToast('Failed to load profiles', 'error');
  }
}

function renderProfiles(profiles) {
  const grid = document.getElementById('profiles-grid');
  grid.innerHTML = profiles.map(p => {
    const avatarInner = p.avatarUrl
      ? `<img src="${escHtml(p.avatarUrl)}" alt="${escHtml(p.name)}" />`
      : escHtml(p.avatarEmoji || '🎬');
    return `
      <div class="profile-card" onclick="selectProfile('${p._id}')">
        <div class="profile-avatar" style="background:${hexToRgba(p.color||'#4f8ef7',0.2)};border:2px solid ${hexToRgba(p.color||'#4f8ef7',0.4)}">
          ${avatarInner}
          <div class="profile-avatar-actions" onclick="event.stopPropagation()">
            <button class="profile-action-mini" title="Edit" onclick="openProfileModal('${p._id}','${escHtml(p.name)}','${escHtml(p.avatarEmoji||'🎬')}','${escHtml(p.color||'#4f8ef7')}','${p.avatarUrl ? '1' : '0'}')">✏️</button>
            <button class="profile-action-mini" title="Delete" onclick="confirmDeleteProfile('${p._id}','${escHtml(p.name)}')">🗑</button>
          </div>
        </div>
        <div class="profile-card-name">${escHtml(p.name)}</div>
      </div>`;
  }).join('') + `
    <div class="profile-card profile-add-card" onclick="openProfileModal()">
      <div class="profile-avatar" style="background:var(--bg-elevated);border:2px dashed var(--border-strong)">＋</div>
      <div class="profile-card-name">Add Profile</div>
    </div>`;
}

async function selectProfile(profileId) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/select-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accountToken}` },
      body: JSON.stringify({ profileId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to select profile');
    profileToken = data.profileToken;
    currentProfile = data.profile;
    localStorage.setItem('ns_profile_token', profileToken);
    localStorage.setItem('ns_current_profile', JSON.stringify(currentProfile));
    enterApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── PROFILE MODAL ───────────────────────────────
function openProfileModal(id = null, name = '', emoji = '🎬', color = '#4f8ef7', hasPhoto = '0') {
  document.getElementById('profile-modal-title').textContent = id ? 'Edit Profile' : 'Add Profile';
  document.getElementById('profile-edit-id').value = id || '';
  document.getElementById('profile-form').reset();
  document.getElementById('profile-image-input').value = '';
  selectedProfileAvatarUrl = null;
  selectedProfileEmoji = emoji;
  selectedProfileColor = color;
  document.getElementById('profile-emoji').value = emoji;
  document.getElementById('profile-color').value = color;
  document.getElementById('profile-avatar-url').value = '';
  document.getElementById('clear-avatar-btn').style.display = 'none';

  // Reset preview
  const preview = document.getElementById('avatar-upload-preview');
  document.getElementById('avatar-preview-emoji').textContent = emoji;
  preview.innerHTML = `<span id="avatar-preview-emoji">${emoji}</span>`;

  // Mark selected emoji and color
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.toggle('selected', e.dataset.emoji === emoji));
  document.querySelectorAll('.color-opt').forEach(c => c.classList.toggle('selected', c.dataset.color === color));

  if (id) document.getElementById('profile-name').value = name;
  openModal('profile-modal');
}

function selectEmoji(emoji) {
  selectedProfileEmoji = emoji;
  document.getElementById('profile-emoji').value = emoji;
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.toggle('selected', e.dataset.emoji === emoji));
  // Update preview only if no photo uploaded
  if (!selectedProfileAvatarUrl) {
    const preview = document.getElementById('avatar-upload-preview');
    preview.innerHTML = `<span id="avatar-preview-emoji">${emoji}</span>`;
  }
}

function selectColor(color) {
  selectedProfileColor = color;
  document.getElementById('profile-color').value = color;
  document.querySelectorAll('.color-opt').forEach(c => c.classList.toggle('selected', c.dataset.color === color));
}

// ─── PROFILE PHOTO UPLOAD ────────────────────────
function handleProfileImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be under 5MB', 'error');
    return;
  }
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
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
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
  document.getElementById('profile-avatar-url').value = '';
  document.getElementById('profile-image-input').value = '';
  document.getElementById('clear-avatar-btn').style.display = 'none';
  const preview = document.getElementById('avatar-upload-preview');
  preview.innerHTML = `<span id="avatar-preview-emoji">${selectedProfileEmoji}</span>`;
}

async function saveProfile(e) {
  e.preventDefault();
  const id = document.getElementById('profile-edit-id').value;
  const avatarUrl = document.getElementById('profile-avatar-url').value || null;
  const payload = {
    name: document.getElementById('profile-name').value.trim(),
    avatarEmoji: selectedProfileEmoji,
    color: selectedProfileColor,
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
  document.getElementById('confirm-msg').textContent = `"${name}" and all its watch data will be permanently deleted.`;
  document.getElementById('confirm-ok-btn').onclick = () => deleteProfile(id);
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

// ─── VIEW SWITCHING ──────────────────────────────
function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById(`nav-${view}`).classList.add('active');
  const addBtn = document.getElementById('add-movie-btn');
  if (view === 'series') {
    addBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Series';
    addBtn.onclick = () => openSeriesModal();
  } else {
    addBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Movie';
    addBtn.onclick = () => openMovieModal();
  }
}

// ─── SEARCH ──────────────────────────────────────
function toggleSearch() {
  const bar = document.getElementById('search-bar');
  bar.classList.toggle('open');
  if (bar.classList.contains('open')) setTimeout(() => document.getElementById('search-input').focus(), 200);
  else clearSearch();
}
function handleSearch(val) { searchQuery = val.trim().toLowerCase(); renderMovies(); }
function clearSearch() { searchQuery = ''; document.getElementById('search-input').value = ''; renderMovies(); }

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
    renderMovies();
    updateStats();
  } catch (err) {
    showToast('Could not load movies. Is the backend running?', 'error');
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('empty-state').style.display = 'block';
  }
}

async function loadSeries() {
  try {
    const res = await apiFetch('/api/series');
    if (!res.ok) throw new Error();
    series = await res.json();
    renderSeries();
    populateSeriesDropdown();
  } catch {
    document.getElementById('series-loading-state').style.display = 'none';
  }
}

// ─── RENDER MOVIES ───────────────────────────────
function renderMovies() {
  const grid = document.getElementById('movies-grid');
  const empty = document.getElementById('empty-state');
  document.getElementById('loading-state').style.display = 'none';

  let filtered = movies.filter(m => {
    const status = m.profileStatus || 'unwatched';
    const matchFilter = currentFilter === 'all' || status === currentFilter;
    const matchSearch = !searchQuery ||
      (m.title || '').toLowerCase().includes(searchQuery) ||
      (m.director || '').toLowerCase().includes(searchQuery) ||
      (m.genre || []).some(g => g.toLowerCase().includes(searchQuery));
    return matchFilter && matchSearch;
  });

  filtered.sort((a, b) => {
    if (currentSort === 'title') return (a.title || '').localeCompare(b.title || '');
    if (currentSort === 'year') return (b.year || 0) - (a.year || 0);
    if (currentSort === 'rating') return (b.profileRating || 0) - (a.profileRating || 0);
    if (currentSort === 'watched') return new Date(b.profileWatchedAt || 0) - new Date(a.profileWatchedAt || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  if (filtered.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = filtered.map(movieCardHTML).join('');
}

function movieCardHTML(m) {
  const status = m.profileStatus || 'unwatched';
  const statusLabel = { unwatched: 'Unwatched', watched: 'Watched', unfinished: 'Unfinished' }[status];
  const genres = (m.genre || []).slice(0, 2).map(g => `<span class="genre-pill">${escHtml(g)}</span>`).join('');
  const seriesBadge = m.series?.name ? `<div class="card-series-badge">🎞 ${escHtml(m.series.name)}</div>` : '';
  const ratingBadge = m.profileRating ? `<div class="card-rating-badge">★ ${m.profileRating}<span class="rating-num">/10</span></div>` : '';
  const poster = m.posterUrl
    ? `<img class="card-poster" src="${escHtml(m.posterUrl)}" alt="${escHtml(m.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-poster-placeholder\\'><span>🎬</span><span>${escHtml(m.title)}</span></div>'" />`
    : `<div class="card-poster-placeholder"><span>🎬</span><span>${escHtml(m.title)}</span></div>`;
  return `
    <div class="movie-card" onclick="openDetailModal('${m._id}')">
      <div class="card-poster-wrap">
        ${poster}
        <div class="card-status-badge badge-${status}">${statusLabel}</div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="card-action-btn" title="Edit" onclick="openMovieModal('${m._id}')">✏️</button>
          <button class="card-action-btn danger" title="Delete" onclick="confirmDelete('${m._id}','movie','${escHtml(m.title)}')">🗑</button>
        </div>
      </div>
      <div class="card-body">
        ${seriesBadge}
        <div class="card-title">${escHtml(m.title)}</div>
        <div class="card-meta">${m.year ? `<span>${m.year}</span>` : ''}${m.runtime ? `<span>· ${m.runtime}m</span>` : ''}</div>
        ${genres ? `<div class="card-genre">${genres}</div>` : ''}
        ${ratingBadge}
      </div>
    </div>`;
}

function updateStats() {
  const total = movies.length;
  const watched = movies.filter(m => (m.profileStatus || 'unwatched') === 'watched').length;
  const unwatched = movies.filter(m => (m.profileStatus || 'unwatched') === 'unwatched').length;
  const unfinished = movies.filter(m => (m.profileStatus || 'unwatched') === 'unfinished').length;
  document.getElementById('stat-total').innerHTML = `<strong>${total}</strong> Movies`;
  document.getElementById('stat-watched').innerHTML = `<strong>${watched}</strong> Watched`;
  document.getElementById('stat-unwatched').innerHTML = `<strong>${unwatched}</strong> Unwatched`;
  document.getElementById('stat-unfinished').innerHTML = `<strong>${unfinished}</strong> Unfinished`;
}

// ─── RENDER SERIES ───────────────────────────────
function renderSeries() {
  const grid = document.getElementById('series-grid');
  const empty = document.getElementById('series-empty-state');
  document.getElementById('series-loading-state').style.display = 'none';
  if (series.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = series.map(s => {
    const sm = movies.filter(m => m.series?._id === s._id || m.series === s._id);
    const watched = sm.filter(m => (m.profileStatus || 'unwatched') === 'watched').length;
    const progress = sm.length > 0 ? Math.round((watched / sm.length) * 100) : 0;
    return `
      <div class="series-card" onclick="openSeriesDetail('${s._id}')">
        <div class="series-actions" onclick="event.stopPropagation()">
          <button class="card-action-btn" onclick="openSeriesModal('${s._id}')">✏️</button>
          <button class="card-action-btn danger" onclick="confirmDelete('${s._id}','series','${escHtml(s.name)}')">🗑</button>
        </div>
        <div class="series-name">${escHtml(s.name)}</div>
        ${s.description ? `<div class="series-desc">${escHtml(s.description)}</div>` : ''}
        <div class="series-movie-count">🎬 ${sm.length} movie${sm.length !== 1 ? 's' : ''} · ${watched} watched</div>
        <div class="series-progress"><div class="series-progress-fill" style="width:${progress}%"></div></div>
      </div>`;
  }).join('');
}

function populateSeriesDropdown() {
  const sel = document.getElementById('movie-series');
  const val = sel.value;
  sel.innerHTML = '<option value="">— None —</option>' + series.map(s => `<option value="${s._id}">${escHtml(s.name)}</option>`).join('');
  if (val) sel.value = val;
}

// ─── FILTER / SORT ───────────────────────────────
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`filter-${filter}`).classList.add('active');
  renderMovies();
}
function setSort(sort) { currentSort = sort; renderMovies(); }

// ─── MOVIE MODAL ─────────────────────────────────
function openMovieModal(id = null) {
  document.getElementById('movie-modal-title').textContent = id ? 'Edit Movie' : 'Add Movie';
  document.getElementById('movie-id').value = '';
  document.getElementById('movie-form').reset();
  document.getElementById('tmdb-results').innerHTML = '';
  document.getElementById('tmdb-search-input').value = '';
  selectedRating = 0;
  updateStarPicker(0);
  toggleRatingField();
  document.getElementById('poster-preview-wrap').style.display = 'none';
  document.getElementById('tmdb-search-wrap').style.display = id ? 'none' : '';
  if (id) { const movie = movies.find(m => m._id === id); if (movie) fillMovieForm(movie); }
  openModal('movie-modal');
}

function fillMovieForm(m) {
  document.getElementById('movie-id').value = m._id;
  document.getElementById('movie-title').value = m.title || '';
  document.getElementById('movie-year').value = m.year || '';
  document.getElementById('movie-runtime').value = m.runtime || '';
  document.getElementById('movie-director').value = m.director || '';
  document.getElementById('movie-genre').value = (m.genre || []).join(', ');
  document.getElementById('movie-status').value = m.profileStatus || 'unwatched';
  document.getElementById('movie-synopsis').value = m.synopsis || '';
  document.getElementById('movie-poster').value = m.posterUrl || '';
  document.getElementById('movie-notes').value = m.profileNotes || '';
  document.getElementById('movie-series').value = m.series?._id || m.series || '';
  document.getElementById('movie-series-order').value = m.seriesOrder || '';
  selectedRating = m.profileRating || 0;
  document.getElementById('movie-rating').value = selectedRating;
  updateStarPicker(selectedRating);
  toggleRatingField();
  if (m.posterUrl) previewPoster(m.posterUrl);
}

async function saveMovie(e) {
  e.preventDefault();
  const id = document.getElementById('movie-id').value;
  const genreStr = document.getElementById('movie-genre').value;
  const payload = {
    title: document.getElementById('movie-title').value.trim(),
    year: parseInt(document.getElementById('movie-year').value) || undefined,
    runtime: parseInt(document.getElementById('movie-runtime').value) || undefined,
    director: document.getElementById('movie-director').value.trim() || undefined,
    genre: genreStr ? genreStr.split(',').map(g => g.trim()).filter(Boolean) : [],
    synopsis: document.getElementById('movie-synopsis').value.trim() || undefined,
    posterUrl: document.getElementById('movie-poster').value.trim() || undefined,
    series: document.getElementById('movie-series').value || undefined,
    seriesOrder: parseInt(document.getElementById('movie-series-order').value) || undefined,
    profileStatus: document.getElementById('movie-status').value,
    profileRating: selectedRating || undefined,
    profileNotes: document.getElementById('movie-notes').value.trim() || undefined,
  };
  const btn = document.getElementById('movie-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const url = id ? `/api/movies/${id}` : '/api/movies';
    const res = await apiFetch(url, { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
    const saved = await res.json();
    movies = id ? movies.map(m => m._id === id ? saved : m) : [saved, ...movies];
    renderMovies(); updateStats(); renderSeries();
    closeModal('movie-modal');
    showToast(id ? 'Movie updated!' : 'Movie added!', 'success');
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Movie';
  }
}

// ─── TMDB ────────────────────────────────────────
async function searchTMDB() {
  const query = document.getElementById('tmdb-search-input').value.trim();
  if (!query) return;
  const btn = document.getElementById('tmdb-search-btn');
  btn.disabled = true; btn.textContent = '…';
  const resultsEl = document.getElementById('tmdb-results');
  resultsEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Searching…</p>';
  try {
    const res = await fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (!data.results?.length) { resultsEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No results found.</p>'; return; }
    resultsEl.innerHTML = data.results.slice(0, 8).map(r => {
      const year = r.release_date ? r.release_date.slice(0, 4) : '';
      const poster = r.poster_path ? `${TMDB_IMG}${r.poster_path}` : '';
      return `
        <div class="tmdb-result-item" onclick="fillFromTMDB(${r.id})">
          ${poster ? `<img class="tmdb-result-poster" src="${poster}" alt="" loading="lazy"/>` : '<div class="tmdb-result-poster" style="display:flex;align-items:center;justify-content:center">🎬</div>'}
          <div><div class="tmdb-result-title">${escHtml(r.title)}</div><div class="tmdb-result-year">${year}${r.vote_average ? ` · ⭐ ${r.vote_average.toFixed(1)}` : ''}</div></div>
        </div>`;
    }).join('');
  } catch {
    resultsEl.innerHTML = '<p style="color:var(--danger);font-size:13px">TMDB search failed. Check your API key.</p>';
  } finally {
    btn.disabled = false; btn.textContent = 'Search';
  }
}

async function fillFromTMDB(tmdbId) {
  try {
    const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits&language=en-US`);
    const d = await res.json();
    document.getElementById('movie-title').value = d.title || '';
    document.getElementById('movie-year').value = d.release_date ? d.release_date.slice(0, 4) : '';
    document.getElementById('movie-runtime').value = d.runtime || '';
    document.getElementById('movie-synopsis').value = d.overview || '';
    document.getElementById('movie-genre').value = (d.genres || []).map(g => g.name).join(', ');
    const director = (d.credits?.crew || []).find(c => c.job === 'Director');
    if (director) document.getElementById('movie-director').value = director.name;
    const poster = d.poster_path ? `${TMDB_IMG}${d.poster_path}` : '';
    document.getElementById('movie-poster').value = poster;
    if (poster) previewPoster(poster);
    document.getElementById('tmdb-results').innerHTML = `<p style="color:var(--status-watched);font-size:13px">✓ Filled from TMDB: ${escHtml(d.title)}</p>`;
    showToast('Details filled from TMDB!', 'success');
  } catch { showToast('Failed to fetch from TMDB.', 'error'); }
}

function previewPoster(url) {
  const wrap = document.getElementById('poster-preview-wrap');
  const img = document.getElementById('poster-preview');
  if (url) { img.src = url; wrap.style.display = 'block'; img.onerror = () => { wrap.style.display = 'none'; }; }
  else { wrap.style.display = 'none'; }
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
  else { display.textContent = 'Not rated'; display.classList.remove('has-value'); }
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
    (status === 'watched' || status === 'unfinished') ? 'flex' : 'none';
}

// ─── SERIES MODAL ────────────────────────────────
function openSeriesModal(id = null) {
  document.getElementById('series-modal-title').textContent = id ? 'Edit Series' : 'Create Series';
  document.getElementById('series-id').value = '';
  document.getElementById('series-form').reset();
  if (id) {
    const s = series.find(s => s._id === id);
    if (s) { document.getElementById('series-id').value = s._id; document.getElementById('series-name').value = s.name || ''; document.getElementById('series-description').value = s.description || ''; }
  }
  openModal('series-modal');
}
async function saveSeries(e) {
  e.preventDefault();
  const id = document.getElementById('series-id').value;
  const payload = { name: document.getElementById('series-name').value.trim(), description: document.getElementById('series-description').value.trim() || undefined };
  const btn = document.getElementById('series-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const res = await apiFetch(id ? `/api/series/${id}` : '/api/series', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Failed');
    const saved = await res.json();
    series = id ? series.map(s => s._id === id ? saved : s) : [...series, saved];
    renderSeries(); populateSeriesDropdown(); closeModal('series-modal');
    showToast(id ? 'Series updated!' : 'Series created!', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Series'; }
}

// ─── DETAIL MODAL ────────────────────────────────
function openDetailModal(id) {
  const m = movies.find(m => m._id === id);
  if (!m) return;
  const status = m.profileStatus || 'unwatched';
  const statusLabel = { unwatched: 'Unwatched', watched: 'Watched', unfinished: 'Unfinished' }[status];
  const backdrop = m.backdropUrl || m.posterUrl;
  const seriesLine = m.series?.name ? `<div class="detail-series-row">🎞 Part of <strong>${escHtml(m.series.name)}</strong>${m.seriesOrder ? ` · #${m.seriesOrder}` : ''}</div>` : '';
  const rating = m.profileRating || 0;
  const starsHtml = [1,2,3,4,5,6,7,8,9,10].map(i => `<span class="detail-star ${i <= rating ? 'on' : 'off'}">★</span>`).join('');
  const ratingHtml = rating ? `<div class="detail-rating-row">${starsHtml}<span class="detail-rating-num">&nbsp;${rating}</span><span class="detail-rating-max">/10</span></div>` : '';
  const inlineStars = [1,2,3,4,5,6,7,8,9,10].map(i =>
    `<span class="inline-star ${i <= rating ? 'on' : 'off'}" data-val="${i}"
      onclick="quickRatingChange('${m._id}',${i})"
      onmouseenter="hoverInlineStars(${i},'${m._id}')"
      onmouseleave="resetInlineStars(${rating},'${m._id}')">★</span>`
  ).join('');
  const content = document.getElementById('detail-content');
  content.innerHTML = `
    ${backdrop ? `<img class="detail-backdrop" src="${escHtml(backdrop)}" alt="" onerror="this.style.display='none'" />` : ''}
    <div class="detail-body">
      <div class="detail-hero">
        ${m.posterUrl ? `<img class="detail-poster" src="${escHtml(m.posterUrl)}" alt="${escHtml(m.title)}" onerror="this.outerHTML='<div class=\\'detail-poster-ph\\'>🎬</div>'" />` : `<div class="detail-poster-ph">🎬</div>`}
        <div class="detail-info">
          <h2 class="detail-title">${escHtml(m.title)}</h2>
          <div class="detail-meta-row">
            ${m.year ? `<span>${m.year}</span>` : ''}
            ${m.runtime ? `<span class="detail-sep">·</span><span>${m.runtime} min</span>` : ''}
            ${m.director ? `<span class="detail-sep">·</span><span>Dir. ${escHtml(m.director)}</span>` : ''}
          </div>
          ${m.genre?.length ? `<div class="detail-genres">${m.genre.map(g => `<span class="detail-genre-pill">${escHtml(g)}</span>`).join('')}</div>` : ''}
          <span class="card-status-badge badge-${status}" style="position:static;display:inline-block">${statusLabel}</span>
          ${ratingHtml}
        </div>
      </div>
      ${seriesLine}
      ${m.synopsis ? `<p class="detail-synopsis">${escHtml(m.synopsis)}</p>` : ''}
      <div class="detail-profile-section">
        <div class="detail-profile-section-title">📋 ${escHtml(currentProfile?.name || 'My')} Tracking</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Status:</div>
        <div class="detail-status-btns">
          ${['unwatched','unfinished','watched'].map(s =>
            `<button class="detail-status-btn detail-status-btn-${s} ${status===s?'active':''}" onclick="quickStatusChange('${m._id}','${s}')">${s}</button>`
          ).join('')}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">My Rating:</div>
        <div class="inline-rating">
          <div class="inline-stars" id="inline-stars-${m._id}">${inlineStars}</div>
          <span style="font-size:13px;color:var(--text-muted)" id="inline-rating-num-${m._id}">${rating ? `${rating}/10` : 'Not rated'}</span>
        </div>
      </div>
      ${m.profileNotes ? `<div class="detail-notes-wrap"><div class="detail-notes-label">My Notes</div><div class="detail-notes">${escHtml(m.profileNotes)}</div></div>` : ''}
      <div class="detail-actions">
        <button class="btn-primary" onclick="closeModal('detail-modal');openMovieModal('${m._id}')">✏️ Edit</button>
        <button class="btn-ghost" onclick="confirmDelete('${m._id}','movie','${escHtml(m.title)}')">🗑 Delete</button>
      </div>
    </div>`;
  openModal('detail-modal');
}

function hoverInlineStars(val, movieId) {
  document.querySelectorAll(`#inline-stars-${movieId} .inline-star`).forEach((s, i) => {
    s.classList.toggle('on', i < val); s.classList.toggle('off', i >= val);
  });
}
function resetInlineStars(currentRating, movieId) {
  document.querySelectorAll(`#inline-stars-${movieId} .inline-star`).forEach((s, i) => {
    s.classList.toggle('on', i < currentRating); s.classList.toggle('off', i >= currentRating);
  });
}
async function quickStatusChange(id, status) {
  try {
    const res = await apiFetch(`/api/movies/${id}/profile`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (!res.ok) throw new Error();
    const pd = await res.json();
    movies = movies.map(m => m._id === id ? { ...m, profileStatus: pd.status, profileWatchedAt: pd.watchedAt } : m);
    renderMovies(); updateStats(); closeModal('detail-modal');
    showToast(`Marked as ${status}!`, 'success');
  } catch { showToast('Failed to update status.', 'error'); }
}
async function quickRatingChange(id, rating) {
  try {
    const res = await apiFetch(`/api/movies/${id}/profile`, { method: 'PUT', body: JSON.stringify({ rating }) });
    if (!res.ok) throw new Error();
    movies = movies.map(m => m._id === id ? { ...m, profileRating: rating } : m);
    renderMovies();
    const numEl = document.getElementById(`inline-rating-num-${id}`);
    if (numEl) numEl.textContent = `${rating}/10`;
    showToast(`Rated ${rating}/10!`, 'success');
  } catch { showToast('Failed to save rating.', 'error'); }
}

// ─── SERIES DETAIL ───────────────────────────────
function openSeriesDetail(id) {
  const s = series.find(s => s._id === id);
  if (!s) return;
  const sm = movies.filter(m => m.series?._id === id || m.series === id).sort((a, b) => (a.seriesOrder || 999) - (b.seriesOrder || 999));
  const watched = sm.filter(m => (m.profileStatus || 'unwatched') === 'watched').length;
  const progress = sm.length > 0 ? Math.round((watched / sm.length) * 100) : 0;
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-body">
      <h2 class="detail-title">${escHtml(s.name)}</h2>
      ${s.description ? `<p class="detail-synopsis" style="margin-top:8px">${escHtml(s.description)}</p>` : ''}
      <div class="series-movie-count" style="margin-top:10px">🎬 ${sm.length} movies · ${watched} watched</div>
      <div class="series-progress" style="margin-top:8px"><div class="series-progress-fill" style="width:${progress}%"></div></div>
      <div class="movies-grid" style="margin-top:20px;grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">${sm.map(movieCardHTML).join('')}</div>
      ${sm.length === 0 ? `<p style="color:var(--text-muted);text-align:center;padding:30px">No movies linked yet.</p>` : ''}
      <div class="detail-actions" style="margin-top:20px">
        <button class="btn-primary" onclick="closeModal('detail-modal');openSeriesModal('${s._id}')">✏️ Edit</button>
        <button class="btn-ghost" onclick="confirmDelete('${s._id}','series','${escHtml(s.name)}')">🗑 Delete</button>
      </div>
    </div>`;
  openModal('detail-modal');
}

// ─── DELETE ──────────────────────────────────────
function confirmDelete(id, type, name) {
  document.getElementById('confirm-title').textContent = `Delete ${type === 'series' ? 'Series' : 'Movie'}?`;
  document.getElementById('confirm-msg').textContent = type === 'series'
    ? `"${name}" will be deleted and movies will be unlinked.`
    : `"${name}" will be permanently removed from the account.`;
  document.getElementById('confirm-ok-btn').onclick = () => deleteItem(id, type);
  openModal('confirm-modal');
}
async function deleteItem(id, type) {
  closeModal('confirm-modal'); closeModal('detail-modal');
  try {
    const res = await apiFetch(`/api/${type === 'series' ? 'series' : 'movies'}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    if (type === 'series') {
      series = series.filter(s => s._id !== id);
      movies = movies.map(m => (m.series?._id === id || m.series === id) ? { ...m, series: null } : m);
      renderSeries();
    } else { movies = movies.filter(m => m._id !== id); renderMovies(); updateStats(); }
    showToast('Deleted.', 'success');
  } catch { showToast('Failed to delete.', 'error'); }
}

// ─── MODAL HELPERS ───────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = ''; }
function closeOnBackdrop(e, id) { if (e.target.id === id) closeModal(id); }
function showLoading(id, show) { document.getElementById(id).style.display = show ? 'flex' : 'none'; }

// ─── TOAST ───────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type]}</span><span>${escHtml(String(msg))}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ─── UTIL ────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
