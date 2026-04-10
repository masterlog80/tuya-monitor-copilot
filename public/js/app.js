/* global document, window, localStorage, fetch, setInterval, clearInterval */
'use strict';

// ===== State =====
const state = {
  token: localStorage.getItem('tm_token'),
  user: JSON.parse(localStorage.getItem('tm_user') || 'null'),
  devices: [],
  refreshInterval: 30,
  countdownValue: 30,
  refreshTimer: null,
  countdownTimer: null,
  currentView: 'dashboard'
};

// ===== API Client =====
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`/api${path}`, opts);

  if (res.status === 401) {
    logout();
    return null;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ===== Auth =====
async function login(username, password) {
  const data = await api('POST', '/auth/login', { username, password });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('tm_token', state.token);
  localStorage.setItem('tm_user', JSON.stringify(state.user));
}

function logout() {
  api('POST', '/auth/logout').catch(() => {});
  state.token = null;
  state.user = null;
  localStorage.removeItem('tm_token');
  localStorage.removeItem('tm_user');
  stopAutoRefresh();
  showPage('login');
}

// ===== Pages =====
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (page === 'login') {
    document.getElementById('login-page').classList.add('active');
  } else {
    document.getElementById('app-page').classList.add('active');
    initApp();
  }
}

// ===== Views =====
function showView(name) {
  state.currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const viewEl = document.getElementById(`view-${name}`);
  if (viewEl) viewEl.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard: 'Dashboard', devices: 'Devices', users: 'User Management', settings: 'Settings' };
  document.getElementById('page-title').textContent = titles[name] || name;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  // Load view data
  if (name === 'dashboard' || name === 'devices') {
    loadDevices();
  } else if (name === 'users') {
    loadUsers();
  } else if (name === 'settings') {
    loadSettings();
  }
}

// ===== Init App =====
async function initApp() {
  // Set user info in sidebar
  if (state.user) {
    document.getElementById('sidebar-username').textContent = state.user.username;
    document.getElementById('sidebar-role').textContent = state.user.role;
    document.getElementById('user-avatar').textContent = state.user.username[0].toUpperCase();

    // Show admin-only items
    if (state.user.role === 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
  }

  // Load refresh interval
  try {
    const config = await api('GET', '/devices/config/refresh-interval');
    if (config) state.refreshInterval = config.refreshInterval;
  } catch (e) { /* use default */ }

  startAutoRefresh();
  showView('dashboard');
}

// ===== Devices =====
async function loadDevices() {
  const gridEl = document.getElementById('devices-grid');
  const tableEl = document.getElementById('devices-table-container');

  showLoadingGrid();

  try {
    const devices = await api('GET', '/devices');
    if (!devices) return;
    state.devices = devices;
    renderDashboard();
    renderDevicesTable();
  } catch (err) {
    const errEl = document.getElementById('devices-error');
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    if (gridEl) gridEl.innerHTML = renderEmptyState('⚠️', 'Failed to load devices', err.message);
    if (tableEl) tableEl.innerHTML = renderEmptyState('⚠️', 'Failed to load devices', err.message);
  }
}

function showLoadingGrid() {
  const g = document.getElementById('devices-grid');
  if (g) g.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading devices...</p></div>`;
  const t = document.getElementById('devices-table-container');
  if (t) t.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading devices...</p></div>`;
}

function renderDashboard() {
  const devices = state.devices;
  const total = devices.length;
  const online = devices.filter(d => d.online).length;
  const offline = total - online;
  const active = devices.filter(d => d.online && isDeviceOn(d)).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-online').textContent = online;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-offline').textContent = offline;

  renderDevicesGrid(devices);
}

function isDeviceOn(device) {
  if (!device.status) return false;
  const sw = device.status.find(s => s.code === 'switch_1' || s.code === 'switch');
  return sw ? sw.value === true : false;
}

function getDeviceIcon(category) {
  const icons = {
    dj: '💡', tgkg: '🔌', kg: '🔌', cz: '🔌', fs: '💨', kt: '❄️',
    bh: '🫖', cl: '🪟', ms: '🚨', pir: '👁️', wk: '🔒', zns: '🌡️',
    mcs: '🚪', ywbj: '💧', default: '📱'
  };
  return icons[category] || icons.default;
}

function filterDevices(devices) {
  const search = (document.getElementById('device-search')?.value || '').toLowerCase();
  const filter = document.getElementById('device-filter')?.value || 'all';

  return devices.filter(d => {
    const matchSearch = !search ||
      (d.name || '').toLowerCase().includes(search) ||
      (d.category || '').toLowerCase().includes(search);

    let matchFilter = true;
    if (filter === 'online') matchFilter = d.online;
    else if (filter === 'offline') matchFilter = !d.online;
    else if (filter === 'on') matchFilter = d.online && isDeviceOn(d);
    else if (filter === 'off') matchFilter = !d.online || !isDeviceOn(d);

    return matchSearch && matchFilter;
  });
}

function renderDevicesGrid(devices) {
  const gridEl = document.getElementById('devices-grid');
  if (!gridEl) return;

  const errEl = document.getElementById('devices-error');
  if (errEl) errEl.classList.add('hidden');

  const filtered = filterDevices(devices);

  if (filtered.length === 0) {
    gridEl.innerHTML = renderEmptyState('📭', devices.length === 0 ? 'No devices found' : 'No matching devices',
      devices.length === 0
        ? 'Configure your Tuya credentials in Settings, then your devices will appear here.'
        : 'Try adjusting your search or filter.');
    return;
  }

  gridEl.innerHTML = filtered.map(device => {
    const isOn = isDeviceOn(device);
    const icon = getDeviceIcon(device.category);
    const online = device.online;

    return `
      <div class="device-card ${online ? 'online' : 'offline'}" data-id="${device.id}">
        <div class="device-card-header">
          <div>
            <div class="device-icon">${icon}</div>
          </div>
          <span class="device-status-badge ${online ? 'status-online' : 'status-offline'}">
            ${online ? '● Online' : '● Offline'}
          </span>
        </div>
        <div class="device-name" title="${escapeHtml(device.name || device.id)}">${escapeHtml(device.name || device.id)}</div>
        <div class="device-category">${escapeHtml(device.category || 'Unknown Type')}</div>
        <div class="device-card-footer">
          <span class="device-switch-label">${isOn ? 'On' : 'Off'}</span>
          <label class="toggle-switch" title="${online ? (isOn ? 'Turn Off' : 'Turn On') : 'Device offline'}">
            <input type="checkbox"
              ${isOn ? 'checked' : ''}
              ${!online ? 'disabled' : ''}
              data-device-id="${device.id}"
              data-device-on="${isOn}"
              class="device-toggle"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  // Attach toggle events
  gridEl.querySelectorAll('.device-toggle').forEach(input => {
    input.addEventListener('change', async (e) => {
      e.stopPropagation();
      const deviceId = input.dataset.deviceId;
      const on = input.checked;
      input.disabled = true;

      try {
        await api('POST', `/devices/${deviceId}/toggle`, { on });
        // Update local state
        const dev = state.devices.find(d => d.id === deviceId);
        if (dev && dev.status) {
          const sw = dev.status.find(s => s.code === 'switch_1' || s.code === 'switch');
          if (sw) sw.value = on;
        }
        // Update label
        const card = input.closest('.device-card');
        if (card) card.querySelector('.device-switch-label').textContent = on ? 'On' : 'Off';
        showToast(`${on ? '✅' : '⭕'} Device turned ${on ? 'on' : 'off'}`, 'success');
        renderDashboard();
      } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
        input.checked = !on;
      } finally {
        input.disabled = false;
      }
    });
  });

  // Click to open detail modal
  gridEl.querySelectorAll('.device-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.toggle-switch')) return;
      const deviceId = card.dataset.id;
      openDeviceModal(deviceId);
    });
  });
}

function renderDevicesTable() {
  const tableEl = document.getElementById('devices-table-container');
  if (!tableEl) return;

  const devices = state.devices;
  if (devices.length === 0) {
    tableEl.innerHTML = renderEmptyState('📭', 'No devices found', 'Configure Tuya credentials in Settings.');
    return;
  }

  tableEl.innerHTML = `
    <div class="table-wrapper">
      <table class="devices-table">
        <thead>
          <tr>
            <th>Device</th>
            <th>ID</th>
            <th>Category</th>
            <th>Status</th>
            <th>Switch</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${devices.map(device => {
            const isOn = isDeviceOn(device);
            const icon = getDeviceIcon(device.category);
            return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:0.75rem">
                    <span style="font-size:1.5rem">${icon}</span>
                    <strong>${escapeHtml(device.name || device.id)}</strong>
                  </div>
                </td>
                <td><code style="font-size:0.8rem;color:var(--text-muted)">${escapeHtml(device.id)}</code></td>
                <td>${escapeHtml(device.category || '-')}</td>
                <td>
                  <span class="device-status-badge ${device.online ? 'status-online' : 'status-offline'}">
                    ${device.online ? '● Online' : '● Offline'}
                  </span>
                </td>
                <td>${device.online ? (isOn ? '💡 On' : '⭕ Off') : '-'}</td>
                <td>
                  <button class="btn btn-ghost btn-sm table-detail-btn" data-device-id="${escapeHtml(device.id)}">Details</button>
                  ${device.online ? `
                    <button class="btn ${isOn ? 'btn-danger' : 'btn-success'} btn-sm table-toggle-btn"
                      data-device-id="${escapeHtml(device.id)}" data-device-on="${isOn}">
                      ${isOn ? 'Turn Off' : 'Turn On'}
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Event delegation for table buttons
  tableEl.querySelectorAll('.table-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => openDeviceModal(btn.dataset.deviceId));
  });
  tableEl.querySelectorAll('.table-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.dataset.deviceOn === 'true' ? false : true;
      quickToggle(btn.dataset.deviceId, on, btn);
    });
  });
}

async function quickToggle(deviceId, on, btn) {
  btn.disabled = true;
  try {
    await api('POST', `/devices/${deviceId}/toggle`, { on });
    const dev = state.devices.find(d => d.id === deviceId);
    if (dev && dev.status) {
      const sw = dev.status.find(s => s.code === 'switch_1' || s.code === 'switch');
      if (sw) sw.value = on;
    }
    showToast(`${on ? '✅' : '⭕'} Device turned ${on ? 'on' : 'off'}`, 'success');
    renderDevicesTable();
    renderDashboard();
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ===== Device Modal =====
async function openDeviceModal(deviceId) {
  const modal = document.getElementById('device-modal');
  const device = state.devices.find(d => d.id === deviceId);
  document.getElementById('modal-device-name').textContent = device ? (device.name || deviceId) : deviceId;
  document.getElementById('modal-body').innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;
  modal.classList.remove('hidden');

  try {
    const detail = await api('GET', `/devices/${deviceId}`);
    if (!detail) return;

    const isOn = detail.status ? detail.status.some(s => (s.code === 'switch_1' || s.code === 'switch') && s.value === true) : false;

    document.getElementById('modal-body').innerHTML = `
      <div class="device-detail-grid">
        <div class="device-detail-item">
          <label>Device ID</label>
          <span><code>${escapeHtml(detail.id || deviceId)}</code></span>
        </div>
        <div class="device-detail-item">
          <label>Name</label>
          <span>${escapeHtml(detail.name || '-')}</span>
        </div>
        <div class="device-detail-item">
          <label>Category</label>
          <span>${escapeHtml(detail.category || '-')}</span>
        </div>
        <div class="device-detail-item">
          <label>Status</label>
          <span class="device-status-badge ${detail.online ? 'status-online' : 'status-offline'}">
            ${detail.online ? '● Online' : '● Offline'}
          </span>
        </div>
        <div class="device-detail-item">
          <label>Model</label>
          <span>${escapeHtml(detail.model || '-')}</span>
        </div>
        <div class="device-detail-item">
          <label>UUID</label>
          <span><code style="font-size:0.8rem">${escapeHtml(detail.uuid || '-')}</code></span>
        </div>
      </div>

      ${detail.online ? `
        <div style="display:flex;gap:1rem;margin-bottom:1.5rem">
          <button class="btn btn-success modal-toggle-btn" data-device-id="${escapeHtml(deviceId)}" data-on="true">Turn On</button>
          <button class="btn btn-danger modal-toggle-btn" data-device-id="${escapeHtml(deviceId)}" data-on="false">Turn Off</button>
        </div>
      ` : ''}

      ${detail.status && detail.status.length > 0 ? `
        <div class="status-list">
          <h4>Device Status Properties</h4>
          ${detail.status.map(s => `
            <div class="status-item">
              <span class="status-code">${escapeHtml(String(s.code))}</span>
              <span class="status-value ${s.value === true ? 'on' : s.value === false ? 'off' : ''}">
                ${typeof s.value === 'boolean' ? (s.value ? '✅ true' : '❌ false') : escapeHtml(String(s.value))}
              </span>
            </div>
          `).join('')}
        </div>
      ` : '<p style="color:var(--text-muted);font-size:0.9rem">No status properties available.</p>'}
    `;

    // Attach toggle event listeners using event delegation (no inline onclick)
    document.getElementById('modal-body').querySelectorAll('.modal-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const on = btn.dataset.on === 'true';
        quickToggleModal(btn.dataset.deviceId, on, btn);
      });
    });
  } catch (err) {
    document.getElementById('modal-body').innerHTML = `
      <div class="alert alert-error">${escapeHtml(err.message)}</div>
    `;
  }
}

async function quickToggleModal(deviceId, on, btn) {
  btn.disabled = true;
  try {
    await api('POST', `/devices/${deviceId}/toggle`, { on });
    showToast(`${on ? '✅' : '⭕'} Device turned ${on ? 'on' : 'off'}`, 'success');
    openDeviceModal(deviceId); // Refresh modal
    loadDevices(); // Refresh list in background
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
    btn.disabled = false;
  }
}

// ===== Users =====
async function loadUsers() {
  const el = document.getElementById('users-list');
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>`;

  try {
    const users = await api('GET', '/users');
    if (!users) return;

    if (users.length === 0) {
      el.innerHTML = renderEmptyState('👥', 'No users found', '');
      return;
    }

    el.innerHTML = users.map(u => `
      <div class="user-item">
        <div class="user-avatar">${u.username[0].toUpperCase()}</div>
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(u.username)}</div>
          <div class="user-item-meta">
            Created: ${new Date(u.createdAt).toLocaleDateString()}
            ${u.id === state.user?.id ? ' <strong>(You)</strong>' : ''}
          </div>
        </div>
        <span class="role-badge role-${u.role}">${u.role}</span>
        <div class="user-item-actions">
          <button class="btn btn-ghost btn-sm user-edit-btn"
            data-user-id="${escapeHtml(u.id)}"
            data-username="${escapeHtml(u.username)}"
            data-role="${escapeHtml(u.role)}">Edit</button>
          ${u.id !== state.user?.id ? `<button class="btn btn-danger btn-sm user-delete-btn"
            data-user-id="${escapeHtml(u.id)}"
            data-username="${escapeHtml(u.username)}">Delete</button>` : ''}
        </div>
      </div>
    `).join('');

    // Attach event listeners via delegation (no inline onclick)
    el.querySelectorAll('.user-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editUser(btn.dataset.userId, btn.dataset.username, btn.dataset.role));
    });
    el.querySelectorAll('.user-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.dataset.userId, btn.dataset.username));
    });
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error" style="margin:1rem">${escapeHtml(err.message)}</div>`;
  }
}

function openAddUserModal() {
  document.getElementById('user-modal-title').textContent = 'Add User';
  document.getElementById('user-form').reset();
  document.getElementById('u-id').value = '';
  document.getElementById('u-password-hint').classList.remove('hidden');
  document.getElementById('u-password').required = true;
  document.getElementById('user-form-submit').textContent = 'Add User';
  document.getElementById('user-form-msg').classList.add('hidden');
  document.getElementById('user-modal').classList.remove('hidden');
}

function editUser(id, username, role) {
  document.getElementById('user-modal-title').textContent = 'Edit User';
  document.getElementById('u-username').value = username;
  document.getElementById('u-role').value = role;
  document.getElementById('u-id').value = id;
  document.getElementById('u-password').value = '';
  document.getElementById('u-password').required = false;
  document.getElementById('u-password-hint').classList.remove('hidden');
  document.getElementById('user-form-submit').textContent = 'Update User';
  document.getElementById('user-form-msg').classList.add('hidden');
  document.getElementById('user-modal').classList.remove('hidden');
}

async function deleteUser(id, username) {
  if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/users/${id}`);
    showToast('🗑️ User deleted', 'success');
    loadUsers();
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
  }
}

// ===== Settings =====
async function loadSettings() {
  try {
    const settings = await api('GET', '/settings');
    if (!settings) return;

    document.getElementById('s-access-id').value = settings.tuya.accessId || '';
    document.getElementById('s-access-secret').value = settings.tuya.accessSecret || '';
    document.getElementById('s-region').value = settings.tuya.region || 'eu';
    document.getElementById('s-user-id').value = settings.tuya.userId || '';
    document.getElementById('s-refresh-interval').value = settings.app.refreshInterval || 30;
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
  }
}

// ===== Auto Refresh =====
function startAutoRefresh() {
  stopAutoRefresh();

  state.countdownValue = state.refreshInterval;
  updateCountdown();

  state.countdownTimer = setInterval(() => {
    state.countdownValue--;
    updateCountdown();
    if (state.countdownValue <= 0) {
      state.countdownValue = state.refreshInterval;
      if (state.currentView === 'dashboard' || state.currentView === 'devices') {
        loadDevices();
      }
    }
  }, 1000);
}

function stopAutoRefresh() {
  if (state.countdownTimer) { clearInterval(state.countdownTimer); state.countdownTimer = null; }
}

function updateCountdown() {
  const el = document.getElementById('refresh-countdown');
  if (el) el.textContent = state.countdownValue;
}

// ===== Helpers =====
function renderEmptyState(icon, title, message) {
  return `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <h4>${escapeHtml(title)}</h4>
      ${message ? `<p>${escapeHtml(message)}</p>` : ''}
    </div>
  `;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Signing in...';
    errEl.classList.add('hidden');

    try {
      await login(username, password);
      showPage('app');
    } catch (err) {
      errEl.textContent = err.message || 'Login failed. Check your credentials.';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Sign In';
    }
  });

  // Toggle password visibility
  document.querySelector('.toggle-password').addEventListener('click', () => {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Log out?')) logout();
  });

  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      if (view) showView(view);
    });
  });

  // Sidebar toggle (mobile)
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('sidebar-close').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', () => {
    state.countdownValue = state.refreshInterval;
    loadDevices();
    showToast('🔄 Refreshing devices...', 'info', 1500);
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.getElementById('theme-toggle').textContent = next === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('tm_theme', next);
  });

  // Search/filter
  document.getElementById('device-search')?.addEventListener('input', () => renderDevicesGrid(state.devices));
  document.getElementById('device-filter')?.addEventListener('change', () => renderDevicesGrid(state.devices));

  // Modal close
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('device-modal').classList.add('hidden');
  });
  document.getElementById('modal-overlay').addEventListener('click', () => {
    document.getElementById('device-modal').classList.add('hidden');
  });

  // User modal
  document.getElementById('add-user-btn')?.addEventListener('click', openAddUserModal);
  document.getElementById('user-modal-close').addEventListener('click', () => {
    document.getElementById('user-modal').classList.add('hidden');
  });
  document.getElementById('user-modal-overlay').addEventListener('click', () => {
    document.getElementById('user-modal').classList.add('hidden');
  });
  document.getElementById('user-modal-cancel').addEventListener('click', () => {
    document.getElementById('user-modal').classList.add('hidden');
  });

  // User form submit
  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('user-form-msg');
    msgEl.classList.add('hidden');

    const id = document.getElementById('u-id').value;
    const username = document.getElementById('u-username').value.trim();
    const password = document.getElementById('u-password').value;
    const role = document.getElementById('u-role').value;

    try {
      if (id) {
        // Edit
        const body = { role };
        if (password) body.password = password;
        await api('PUT', `/users/${id}`, body);
        showToast('✅ User updated', 'success');
      } else {
        // Create
        await api('POST', '/users', { username, password, role });
        showToast('✅ User created', 'success');
      }
      document.getElementById('user-modal').classList.add('hidden');
      loadUsers();
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'alert alert-error';
      msgEl.classList.remove('hidden');
    }
  });

  // Change password form
  document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('password-msg');
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;

    try {
      await api('PUT', '/users/me/password', { currentPassword, newPassword });
      msgEl.textContent = '✅ Password changed successfully!';
      msgEl.className = 'alert alert-success';
      msgEl.classList.remove('hidden');
      document.getElementById('change-password-form').reset();
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'alert alert-error';
      msgEl.classList.remove('hidden');
    }
  });

  // Settings form
  document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('settings-msg');

    try {
      const interval = parseInt(document.getElementById('s-refresh-interval').value, 10);
      await api('PUT', '/settings', {
        tuya: {
          accessId: document.getElementById('s-access-id').value.trim(),
          accessSecret: document.getElementById('s-access-secret').value.trim(),
          region: document.getElementById('s-region').value,
          userId: document.getElementById('s-user-id').value.trim()
        },
        app: { refreshInterval: interval }
      });

      // Update auto-refresh interval
      state.refreshInterval = interval || 30;
      startAutoRefresh();

      msgEl.textContent = '✅ Settings saved successfully!';
      msgEl.className = 'alert alert-success';
      msgEl.classList.remove('hidden');
      showToast('✅ Settings saved', 'success');
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'alert alert-error';
      msgEl.classList.remove('hidden');
    }
  });

  // Keyboard shortcut: Escape closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('device-modal').classList.add('hidden');
      document.getElementById('user-modal').classList.add('hidden');
    }
  });

  // Restore theme
  const savedTheme = localStorage.getItem('tm_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('theme-toggle').textContent = savedTheme === 'dark' ? '🌙' : '☀️';

  // Check if already logged in
  if (state.token && state.user) {
    showPage('app');
  } else {
    showPage('login');
  }
});
