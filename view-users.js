// ============================================================
// VENTO POS — Users view (manage staff, roles, PIN)
// ============================================================
function renderUsersView() {
  const users = DB.data.users;
  return `
  <div class="view-manage">
    <div class="view-head">
      <div>
        <h2>Usuarios</h2>
        <div class="vh-sub">${users.filter(u=>u.active).length} usuarios activos</div>
      </div>
      <button class="btn btn-primary" onclick="openUserForm()">${icon('plus')} Nuevo usuario</button>
    </div>
    <div class="view-body">
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Usuario</th><th>Rol</th><th>Ventas atendidas</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${users.map(u => renderUserRow(u)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function renderUserRow(u) {
  const salesCount = DB.data.sales.filter(s => s.userId === u.id).length;
  const isSelf = STATE.currentUser && STATE.currentUser.id === u.id;
  return `
  <tr>
    <td>
      <div class="cell-with-thumb">
        <span class="user-avatar">${initials(u.name)}</span>
        <div class="cell-title">${escapeHtml(u.name)}${isSelf ? ' <span style="color:var(--ink-soft); font-weight:400;">(tú)</span>' : ''}</div>
      </div>
    </td>
    <td><span class="role-tag ${u.role}">${u.role === 'admin' ? 'Administrador' : 'Cajero'}</span></td>
    <td>${salesCount}</td>
    <td>${u.active ? '<span style="color:var(--green-ok); font-weight:600; font-size:13px;">Activo</span>' : '<span style="color:var(--ink-soft); font-size:13px;">Inactivo</span>'}</td>
    <td>
      <div class="action-icons">
        <button title="Editar" onclick="openUserForm('${u.id}')">${icon('edit')}</button>
        ${!isSelf ? `<button title="${u.active ? 'Desactivar' : 'Activar'}" onclick="toggleUserActive('${u.id}')">${icon(u.active ? 'lock' : 'check')}</button>` : ''}
        ${!isSelf ? `<button title="Eliminar" class="danger" onclick="confirmDeleteUser('${u.id}')">${icon('trash')}</button>` : ''}
      </div>
    </td>
  </tr>`;
}

function openUserForm(userId) {
  const editing = userId ? DB.data.users.find(u => u.id === userId) : null;
  openModal(`
    <div class="modal">
      <div class="modal-body">
        <h3 style="margin-bottom:16px;">${editing ? 'Editar usuario' : 'Nuevo usuario'}</h3>
        <div class="field" style="margin-bottom:12px;"><label>Nombre completo *</label><input class="input" id="uf_name" value="${editing ? escapeHtml(editing.name) : ''}" placeholder="Nombre del usuario"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="field">
            <label>Rol</label>
            <select class="input" id="uf_role">
              <option value="cashier" ${editing && editing.role === 'cashier' ? 'selected' : ''}>Cajero</option>
              <option value="admin" ${editing && editing.role === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </div>
          <div class="field">
            <label>PIN (4 dígitos) *</label>
            <input class="input" id="uf_pin" maxlength="4" inputmode="numeric" pattern="[0-9]*" value="${editing ? escapeHtml(editing.pin) : ''}" placeholder="0000">
          </div>
        </div>
        <p style="font-size:12px; color:var(--ink-soft);">El cajero puede vender, ver inventario y clientes, y abrir/cerrar su caja. El administrador además ve reportes, usuarios y configuración.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveUser('${editing ? editing.id : ''}')">${icon('check')} Guardar</button>
      </div>
    </div>
  `);
}

function saveUser(existingId) {
  const name = document.getElementById('uf_name').value.trim();
  const role = document.getElementById('uf_role').value;
  const pin = document.getElementById('uf_pin').value.trim();
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }
  if (!/^\d{4}$/.test(pin)) { toast('El PIN debe ser de 4 dígitos', 'error'); return; }

  const dupe = DB.data.users.find(u => u.pin === pin && u.id !== existingId);
  if (dupe) { toast('Ese PIN ya lo usa otro usuario', 'error'); return; }

  if (existingId) {
    Object.assign(DB.data.users.find(u => u.id === existingId), { name, role, pin });
    if (STATE.currentUser && STATE.currentUser.id === existingId) {
      STATE.currentUser = DB.data.users.find(u => u.id === existingId);
    }
    toast('Usuario actualizado', 'success');
  } else {
    DB.data.users.push({ id: uid('u'), name, role, pin, active: true, createdAt: Date.now() });
    toast('Usuario creado', 'success');
  }
  DB.save();
  closeModal();
  render();
}

function toggleUserActive(id) {
  const u = DB.data.users.find(x => x.id === id);
  u.active = !u.active;
  DB.save();
  render();
  toast(u.active ? 'Usuario activado' : 'Usuario desactivado', 'success');
}

function confirmDeleteUser(id) {
  const hasSales = DB.data.sales.some(s => s.userId === id);
  openModal(`
    <div class="modal" style="max-width:340px;">
      <div class="modal-body" style="text-align:center; padding-top:24px;">
        ${icon('alertCircle')}
        <h3 style="margin:10px 0 4px;">¿Eliminar usuario?</h3>
        <p style="color:var(--ink-soft); font-size:13px;">${hasSales ? 'Tiene ventas registradas; su historial se conservará, pero el usuario dejará de existir.' : 'Esta acción no se puede deshacer.'}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="deleteUser('${id}')">Eliminar</button>
      </div>
    </div>
  `);
}
function deleteUser(id) {
  if (DB.data.users.filter(u => u.role === 'admin' && u.active).length <= 1 && DB.data.users.find(u=>u.id===id).role === 'admin') {
    toast('Debe quedar al menos un administrador activo', 'error');
    closeModal();
    return;
  }
  DB.data.users = DB.data.users.filter(u => u.id !== id);
  DB.save();
  closeModal();
  render();
  toast('Usuario eliminado', 'success');
}
