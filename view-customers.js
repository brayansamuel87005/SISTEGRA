// ============================================================
// VENTO POS — Customers view
// ============================================================
let custSearchTerm = '';

function renderCustomersView() {
  let customers = DB.data.customers.filter(c => !c.isGeneric);
  if (custSearchTerm.trim()) {
    const t = custSearchTerm.trim().toLowerCase();
    customers = customers.filter(c => c.name.toLowerCase().includes(t) || (c.phone||'').includes(t) || (c.email||'').toLowerCase().includes(t));
  }
  return `
  <div class="view-manage">
    <div class="view-head">
      <div>
        <h2>Clientes</h2>
        <div class="vh-sub">${DB.data.customers.filter(c=>!c.isGeneric).length} clientes registrados</div>
      </div>
      <button class="btn btn-primary" onclick="openCustomerForm()">${icon('plus')} Nuevo cliente</button>
    </div>
    <div class="view-toolbar">
      <div class="search-wrap">
        ${icon('search')}
        <input class="input" placeholder="Buscar por nombre, teléfono o correo..." value="${escapeHtml(custSearchTerm)}" oninput="custSearchTerm=this.value; render();">
      </div>
    </div>
    <div class="view-body">
      <div class="table-scroll">
        ${customers.length === 0 ? `
          <div class="empty-state">${icon('customers')}<h3>Sin clientes</h3><p>Registra clientes para llevar su historial de compras.</p>
          <button class="btn btn-primary" style="margin-top:8px;" onclick="openCustomerForm()">${icon('plus')} Nuevo cliente</button></div>
        ` : `
        <table class="data-table">
          <thead><tr><th>Cliente</th><th>Teléfono</th><th>Correo</th><th>Compras</th><th>Total gastado</th><th></th></tr></thead>
          <tbody>
            ${customers.map(c => renderCustomerRow(c)).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  </div>`;
}

function renderCustomerRow(c) {
  const sales = DB.data.sales.filter(s => s.customerId === c.id);
  const total = sales.reduce((s,sale) => s + sale.total, 0);
  return `
  <tr>
    <td>
      <div class="cell-with-thumb">
        <span class="user-avatar" style="background:var(--surface-2); color:var(--ink-soft);">${initials(c.name)}</span>
        <div class="cell-title">${escapeHtml(c.name)}</div>
      </div>
    </td>
    <td>${escapeHtml(c.phone || '—')}</td>
    <td>${escapeHtml(c.email || '—')}</td>
    <td>${sales.length}</td>
    <td class="mono">${fmtMoney(total)}</td>
    <td>
      <div class="action-icons">
        <button title="Historial" onclick="openCustomerHistory('${c.id}')">${icon('history')}</button>
        <button title="Editar" onclick="openCustomerForm('${c.id}')">${icon('edit')}</button>
        <button title="Eliminar" class="danger" onclick="confirmDeleteCustomer('${c.id}')">${icon('trash')}</button>
      </div>
    </td>
  </tr>`;
}

function openCustomerForm(custId) {
  const editing = custId ? DB.data.customers.find(c => c.id === custId) : null;
  openModal(`
    <div class="modal">
      <div class="modal-body">
        <h3 style="margin-bottom:16px;">${editing ? 'Editar cliente' : 'Nuevo cliente'}</h3>
        <div class="field" style="margin-bottom:12px;"><label>Nombre completo *</label><input class="input" id="cf_name" value="${editing ? escapeHtml(editing.name) : ''}" placeholder="Nombre del cliente"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="field"><label>Teléfono</label><input class="input" id="cf_phone" value="${editing ? escapeHtml(editing.phone||'') : ''}" placeholder="Opcional"></div>
          <div class="field"><label>Correo</label><input class="input" id="cf_email" value="${editing ? escapeHtml(editing.email||'') : ''}" placeholder="Opcional"></div>
        </div>
        <div class="field"><label>Notas</label><textarea class="input" id="cf_notes" placeholder="Notas adicionales...">${editing ? escapeHtml(editing.notes||'') : ''}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveCustomer('${editing ? editing.id : ''}')">${icon('check')} Guardar</button>
      </div>
    </div>
  `);
}

function saveCustomer(existingId) {
  const name = document.getElementById('cf_name').value.trim();
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }
  const data = {
    name,
    phone: document.getElementById('cf_phone').value.trim(),
    email: document.getElementById('cf_email').value.trim(),
    notes: document.getElementById('cf_notes').value.trim(),
  };
  if (existingId) {
    Object.assign(DB.data.customers.find(c => c.id === existingId), data);
    toast('Cliente actualizado', 'success');
  } else {
    data.id = uid('cust');
    data.createdAt = Date.now();
    DB.data.customers.push(data);
    toast('Cliente creado', 'success');
  }
  DB.save();
  closeModal();
  render();
}

function confirmDeleteCustomer(id) {
  openModal(`
    <div class="modal" style="max-width:340px;">
      <div class="modal-body" style="text-align:center; padding-top:24px;">
        ${icon('alertCircle')}
        <h3 style="margin:10px 0 4px;">¿Eliminar cliente?</h3>
        <p style="color:var(--ink-soft); font-size:13px;">Su historial de ventas se mantendrá, pero ya no podrá asignarse a nuevas ventas.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="deleteCustomer('${id}')">Eliminar</button>
      </div>
    </div>
  `);
}
function deleteCustomer(id) {
  DB.data.customers = DB.data.customers.filter(c => c.id !== id);
  DB.save();
  closeModal();
  render();
  toast('Cliente eliminado', 'success');
}

function openCustomerHistory(custId) {
  const c = DB.data.customers.find(x => x.id === custId);
  const sales = DB.data.sales.filter(s => s.customerId === custId).sort((a,b) => b.createdAt - a.createdAt);
  const total = sales.reduce((s,sale) => s + sale.total, 0);
  openModal(`
    <div class="modal modal-wide">
      <div class="modal-body">
        <h3 style="margin-bottom:2px;">${escapeHtml(c.name)}</h3>
        <p style="color:var(--ink-soft); font-size:13px; margin-bottom:14px;">${sales.length} compras · ${fmtMoney(total)} en total</p>
        ${sales.length === 0 ? `<div class="empty-state">${icon('receipt')}<p>Este cliente aún no tiene compras.</p></div>` : `
        <div style="max-height:360px; overflow-y:auto;">
          <table class="data-table">
            <thead><tr><th>Folio</th><th>Fecha</th><th>Productos</th><th>Total</th></tr></thead>
            <tbody>
              ${sales.map(s => `
                <tr>
                  <td class="mono">#${s.folio}</td>
                  <td>${fmtDateTime(s.createdAt)}</td>
                  <td>${s.items.length} artículo(s)</td>
                  <td class="mono">${fmtMoney(s.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
      </div>
    </div>
  `);
}
