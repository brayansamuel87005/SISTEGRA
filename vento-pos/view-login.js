// ============================================================
// VENTO POS — Login view (user select + PIN pad)
// ============================================================
let loginSelectedUser = null;
let loginPinBuffer = '';
let loginError = '';

function renderLoginView() {
  const users = DB.data.users.filter(u => u.active);
  const biz = DB.data.business;

  if (!loginSelectedUser) {
    return `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <div class="brand-mark">${ICONS.logoMark}</div>
          <h1>${escapeHtml(biz.name || 'Vento')}</h1>
          <p>Selecciona tu usuario para continuar</p>
        </div>
        <div class="user-select-row">
          ${users.map(u => `
            <button class="user-select-btn" onclick="loginPickUser('${u.id}')">
              <span class="user-avatar">${initials(u.name)}</span>
              <span>
                <div class="usb-name">${escapeHtml(u.name)}</div>
                <div class="usb-role">${u.role === 'admin' ? 'Administrador' : 'Cajero'}</div>
              </span>
            </button>
          `).join('')}
        </div>
        ${users.length === 0 ? `<p style="text-align:center;color:var(--ink-soft);font-size:13px;">No hay usuarios activos.</p>` : ''}
      </div>
    </div>`;
  }

  const dots = [0, 1, 2, 3].map(i => `<div class="pin-dot ${i < loginPinBuffer.length ? 'filled' : ''}"></div>`).join('');
  return `
  <div class="login-screen">
    <div class="login-card">
      <div class="login-brand">
        <div class="user-avatar" style="width:52px;height:52px;font-size:18px;">${initials(loginSelectedUser.name)}</div>
        <h1>${escapeHtml(loginSelectedUser.name)}</h1>
        <p>Ingresa tu PIN</p>
      </div>
      <div class="pin-display">${dots}</div>
      <div class="login-error">${loginError}</div>
      <div class="pin-pad">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button onclick="loginPinPress('${n}')">${n}</button>`).join('')}
        <button class="pin-action" onclick="loginBack()">Cambiar</button>
        <button onclick="loginPinPress('0')">0</button>
        <button class="pin-action" onclick="loginPinDel()">⌫</button>
      </div>
    </div>
  </div>`;
}

function loginPickUser(id) {
  loginSelectedUser = DB.data.users.find(u => u.id === id);
  loginPinBuffer = '';
  loginError = '';
  render();
}
function loginBack() {
  loginSelectedUser = null;
  loginPinBuffer = '';
  loginError = '';
  render();
}
function loginPinDel() {
  loginPinBuffer = loginPinBuffer.slice(0, -1);
  render();
}
function loginPinPress(d) {
  if (loginPinBuffer.length >= 4) return;
  loginPinBuffer += d;
  if (loginPinBuffer.length === 4) {
    if (loginPinBuffer === loginSelectedUser.pin) {
      STATE.currentUser = loginSelectedUser;
      DB.data.session.currentUserId = loginSelectedUser.id;
      DB.save();
      const su = loginSelectedUser, sb = loginPinBuffer;
      loginSelectedUser = null; loginPinBuffer = ''; loginError = '';
      STATE.route = 'pos';
      render();
      return;
    } else {
      loginError = 'PIN incorrecto, intenta de nuevo';
      loginPinBuffer = '';
    }
  }
  render();
}
