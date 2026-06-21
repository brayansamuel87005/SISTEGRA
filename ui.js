// ============================================================
// VENTO POS — UI shell: state, router, toasts, modal helper
// ============================================================
const STATE = {
  route: 'login', // login | pos | inventory | customers | shift | reports | users | settings
  currentUser: null,
  posCart: [], // {productId, name, price, qty, unit}
  posCustomerId: 'cust_general',
  posDiscount: { type: 'none', value: 0 }, // type: none|percent|amount
};

function toast(msg, type) {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.innerHTML = `${type === 'error' ? icon('alertCircle') : icon('checkCircle')}<span>${escapeHtml(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 250); }, 2600);
}

function navigate(route) {
  STATE.route = route;
  render();
}

function logout() {
  STATE.currentUser = null;
  DB.data.session.currentUserId = null;
  DB.save();
  STATE.route = 'login';
  render();
}

// ---------- Modal helper ----------
let modalCloseHandler = null;
function openModal(html, opts) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'activeModalOverlay';
  overlay.innerHTML = html;
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay && !(opts && opts.persistent)) closeModal();
  });
  document.body.appendChild(overlay);
  modalCloseHandler = opts && opts.onClose;
  // focus first input
  setTimeout(() => {
    const f = overlay.querySelector('input,select,textarea,button');
    if (f) f.focus();
  }, 30);
  return overlay;
}
function closeModal() {
  const existing = document.getElementById('activeModalOverlay');
  if (existing) existing.remove();
  if (modalCloseHandler) { const h = modalCloseHandler; modalCloseHandler = null; h(); }
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ---------- Top shell ----------
const NAV_ITEMS = [
  { route: 'pos', label: 'Venta', icon: 'pos', roles: ['admin', 'cashier'] },
  { route: 'inventory', label: 'Inventario', icon: 'inventory', roles: ['admin', 'cashier'] },
  { route: 'customers', label: 'Clientes', icon: 'customers', roles: ['admin', 'cashier'] },
  { route: 'shift', label: 'Caja', icon: 'shift', roles: ['admin', 'cashier'] },
  { route: 'reports', label: 'Reportes', icon: 'reports', roles: ['admin'] },
  { route: 'users', label: 'Usuarios', icon: 'users', roles: ['admin'] },
  { route: 'settings', label: 'Configuración', icon: 'settings', roles: ['admin'] },
];

function renderTopbar() {
  const user = STATE.currentUser;
  const shift = DB.data.activeShift;
  const items = NAV_ITEMS.filter(i => !user || i.roles.includes(user.role));
  return `
  <div class="topbar">
    <div class="brand">
      <div class="brand-mark">${ICONS.logoMark}</div>
      <div class="brand-name">Vento</div>
    </div>
    <div class="nav-tabs">
      ${items.map(i => `
        <button class="nav-tab ${STATE.route === i.route ? 'active' : ''}" onclick="navigate('${i.route}')">
          ${icon(i.icon)}<span>${i.label}</span>
        </button>
      `).join('')}
    </div>
    <div class="topbar-right">
      <button class="shift-pill" onclick="navigate('shift')" title="Estado de caja">
        <span class="shift-dot ${shift ? '' : 'off'}"></span>
        ${shift ? 'Caja abierta' : 'Caja cerrada'}
      </button>
      <button class="user-pill" onclick="handleUserMenu()">
        <span class="user-avatar">${initials(user ? user.name : '?')}</span>
        <span>${user ? user.name : ''}</span>
      </button>
    </div>
  </div>`;
}

function handleUserMenu() {
  openModal(`
    <div class="modal" style="max-width:280px;">
      <div class="modal-body" style="text-align:center; padding-top:26px;">
        <div class="user-avatar" style="width:54px;height:54px;font-size:18px;margin:0 auto 10px;">${initials(STATE.currentUser.name)}</div>
        <h3 style="margin-bottom:2px;">${escapeHtml(STATE.currentUser.name)}</h3>
        <div class="eyebrow">${STATE.currentUser.role === 'admin' ? 'Administrador' : 'Cajero'}</div>
        <button class="btn btn-danger btn-block" style="margin-top:18px;" onclick="closeModal(); logout();">${icon('logout')} Cerrar sesión</button>
      </div>
    </div>
  `);
}

// ---------- Root render ----------
function render() {
  const app = document.getElementById('app');
  if (!STATE.currentUser || STATE.route === 'login') {
    app.innerHTML = renderLoginView();
    return;
  }
  let body = '';
  switch (STATE.route) {
    case 'pos': body = renderPosView(); break;
    case 'inventory': body = renderInventoryView(); break;
    case 'customers': body = renderCustomersView(); break;
    case 'shift': body = renderShiftView(); break;
    case 'reports': body = renderReportsView(); break;
    case 'users': body = renderUsersView(); break;
    case 'settings': body = renderSettingsView(); break;
    default: body = renderPosView();
  }
  app.innerHTML = `${renderTopbar()}<div class="view-root">${body}</div>`;
  if (typeof afterRender === 'function') afterRender();
}

let afterRender = null; // each view can set this hook before/after render if needed
