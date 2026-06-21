// ============================================================
// VENTO POS — Inventory view
// ============================================================
let invSearchTerm = '';
let invCategoryFilter = 'all';
let invStockFilter = 'all'; // all | low | out

function renderInventoryView() {
  const products = DB.data.products;
  let filtered = products;
  if (invCategoryFilter !== 'all') filtered = filtered.filter(p => p.categoryId === invCategoryFilter);
  if (invStockFilter === 'low') filtered = filtered.filter(p => p.trackStock && p.stock > 0 && p.stock <= (DB.data.business.lowStockThreshold||5));
  if (invStockFilter === 'out') filtered = filtered.filter(p => p.trackStock && p.stock <= 0);
  if (invSearchTerm.trim()) {
    const t = invSearchTerm.trim().toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(t) || (p.sku||'').toLowerCase().includes(t));
  }

  const totalValue = products.reduce((s,p) => s + (p.trackStock ? p.cost * p.stock : 0), 0);
  const lowCount = products.filter(p => p.trackStock && p.stock > 0 && p.stock <= (DB.data.business.lowStockThreshold||5)).length;
  const outCount = products.filter(p => p.trackStock && p.stock <= 0).length;

  return `
  <div class="view-manage">
    <div class="view-head">
      <div>
        <h2>Inventario</h2>
        <div class="vh-sub">${products.length} productos en catálogo</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost" onclick="openCategoryManager()">${icon('tag')} Categorías</button>
        <button class="btn btn-primary" onclick="openProductForm()">${icon('plus')} Nuevo producto</button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card accent"><div class="sc-label">Valor de inventario</div><div class="sc-value mono">${fmtMoney(totalValue)}</div></div>
      <div class="stat-card"><div class="sc-label">Stock bajo</div><div class="sc-value" style="color:#93680F;">${lowCount}</div></div>
      <div class="stat-card"><div class="sc-label">Agotados</div><div class="sc-value" style="color:var(--red);">${outCount}</div></div>
      <div class="stat-card"><div class="sc-label">Categorías</div><div class="sc-value">${DB.data.categories.length}</div></div>
    </div>

    <div class="view-toolbar">
      <div class="search-wrap">
        ${icon('search')}
        <input class="input" placeholder="Buscar producto o SKU..." value="${escapeHtml(invSearchTerm)}" oninput="invSearchTerm=this.value; render();">
      </div>
      <select class="input" style="width:auto;" onchange="invCategoryFilter=this.value; render();">
        <option value="all" ${invCategoryFilter==='all'?'selected':''}>Todas las categorías</option>
        ${DB.data.categories.map(c => `<option value="${c.id}" ${invCategoryFilter===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <select class="input" style="width:auto;" onchange="invStockFilter=this.value; render();">
        <option value="all" ${invStockFilter==='all'?'selected':''}>Todo el stock</option>
        <option value="low" ${invStockFilter==='low'?'selected':''}>Stock bajo</option>
        <option value="out" ${invStockFilter==='out'?'selected':''}>Agotados</option>
      </select>
    </div>

    <div class="view-body">
      <div class="table-scroll">
        ${filtered.length === 0 ? `
          <div class="empty-state">${icon('inventory')}<h3>Sin productos</h3><p>Agrega tu primer producto para empezar a vender.</p>
          <button class="btn btn-primary" style="margin-top:8px;" onclick="openProductForm()">${icon('plus')} Nuevo producto</button></div>
        ` : `
        <table class="data-table">
          <thead><tr>
            <th>Producto</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th><th></th>
          </tr></thead>
          <tbody>
            ${filtered.map(p => renderProductRow(p)).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  </div>`;
}

function renderProductRow(p) {
  const cat = DB.data.categories.find(c => c.id === p.categoryId);
  let stockBadge = '';
  if (p.trackStock) {
    if (p.stock <= 0) stockBadge = `<span class="badge badge-danger">AGOTADO</span>`;
    else if (p.stock <= (DB.data.business.lowStockThreshold||5)) stockBadge = `<span class="badge badge-warn">${p.stock} ${p.unit||'pza'}</span>`;
    else stockBadge = `<span class="badge badge-ok">${p.stock} ${p.unit||'pza'}</span>`;
  } else {
    stockBadge = `<span class="badge badge-neutral">N/A</span>`;
  }
  return `
  <tr>
    <td>
      <div class="cell-with-thumb">
        <div class="row-thumb">${p.image ? `<img src="${p.image}">` : initials(p.name)}</div>
        <div><div class="cell-title">${escapeHtml(p.name)}</div><div class="cell-sub">${escapeHtml(p.sku||'Sin SKU')}</div></div>
      </div>
    </td>
    <td>${cat ? escapeHtml(cat.name) : '—'}</td>
    <td class="mono">${fmtMoney(p.price)}</td>
    <td class="mono">${fmtMoney(p.cost)}</td>
    <td>${stockBadge}</td>
    <td>
      <div class="action-icons">
        ${p.trackStock ? `<button title="Ajustar stock" onclick="openStockAdjust('${p.id}')">${icon('box')}</button>` : ''}
        <button title="Editar" onclick="openProductForm('${p.id}')">${icon('edit')}</button>
        <button title="Eliminar" class="danger" onclick="confirmDeleteProduct('${p.id}')">${icon('trash')}</button>
      </div>
    </td>
  </tr>`;
}

// ---------------- Product form ----------------
function openProductForm(productId) {
  const editing = productId ? DB.data.products.find(p => p.id === productId) : null;
  const cats = DB.data.categories;
  openModal(`
    <div class="modal modal-wide">
      <div class="modal-body">
        <h3 style="margin-bottom:16px;">${editing ? 'Editar producto' : 'Nuevo producto'}</h3>
        <div style="display:flex; gap:16px; margin-bottom:14px;">
          <div>
            <div class="logo-upload" id="productImgPreview" onclick="document.getElementById('productImgInput').click()">
              ${editing && editing.image ? `<img src="${editing.image}">` : icon('image')}
            </div>
            <input type="file" id="productImgInput" accept="image/*" style="display:none;" onchange="handleProductImageUpload(this)">
          </div>
          <div style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="field" style="grid-column:1/-1;">
              <label>Nombre del producto *</label>
              <input class="input" id="pf_name" value="${editing ? escapeHtml(editing.name) : ''}" placeholder="Ej. Refresco 600ml">
            </div>
            <div class="field">
              <label>SKU / código</label>
              <input class="input" id="pf_sku" value="${editing ? escapeHtml(editing.sku||'') : ''}" placeholder="Opcional">
            </div>
            <div class="field">
              <label>Categoría</label>
              <select class="input" id="pf_category">
                ${cats.map(c => `<option value="${c.id}" ${editing && editing.categoryId===c.id ? 'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:14px;">
          <div class="field"><label>Precio de venta *</label><input class="input" type="number" step="0.01" min="0" id="pf_price" value="${editing ? editing.price : ''}" placeholder="0.00"></div>
          <div class="field"><label>Costo</label><input class="input" type="number" step="0.01" min="0" id="pf_cost" value="${editing ? editing.cost : ''}" placeholder="0.00"></div>
          <div class="field"><label>Unidad</label><input class="input" id="pf_unit" value="${editing ? escapeHtml(editing.unit||'pza') : 'pza'}" placeholder="pza, kg, lt..."></div>
        </div>
        <div class="field" style="flex-direction:row; align-items:center; gap:8px; margin-bottom:10px;">
          <input type="checkbox" id="pf_trackstock" ${!editing || editing.trackStock ? 'checked' : ''} onchange="document.getElementById('pf_stockwrap').style.display = this.checked ? 'grid' : 'none';" style="width:auto;">
          <label style="margin:0;">Controlar inventario de este producto</label>
        </div>
        <div id="pf_stockwrap" style="display:${!editing || editing.trackStock ? 'grid' : 'none'}; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="field"><label>Stock actual</label><input class="input" type="number" step="1" id="pf_stock" value="${editing ? editing.stock : 0}"></div>
          <div class="field"><label>Stock mínimo (alerta)</label><input class="input" type="number" step="1" id="pf_minstock" value="${editing && editing.minStock !== undefined ? editing.minStock : (DB.data.business.lowStockThreshold||5)}"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveProduct('${editing ? editing.id : ''}')">${icon('check')} Guardar producto</button>
      </div>
    </div>
  `);
}

let pendingProductImage = null;
async function handleProductImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const dataUrl = await readFileAsDataURL(file);
  pendingProductImage = dataUrl;
  document.getElementById('productImgPreview').innerHTML = `<img src="${dataUrl}">`;
}

function saveProduct(existingId) {
  const name = document.getElementById('pf_name').value.trim();
  const price = parseFloat(document.getElementById('pf_price').value);
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }
  if (isNaN(price) || price < 0) { toast('Ingresa un precio válido', 'error'); return; }
  const trackStock = document.getElementById('pf_trackstock').checked;

  const productData = {
    name,
    sku: document.getElementById('pf_sku').value.trim(),
    categoryId: document.getElementById('pf_category').value,
    price,
    cost: parseFloat(document.getElementById('pf_cost').value) || 0,
    unit: document.getElementById('pf_unit').value.trim() || 'pza',
    trackStock,
    stock: trackStock ? (parseInt(document.getElementById('pf_stock').value) || 0) : 0,
    minStock: trackStock ? (parseInt(document.getElementById('pf_minstock').value) || 0) : 0,
    active: true,
  };
  if (pendingProductImage) productData.image = pendingProductImage;

  if (existingId) {
    const p = DB.data.products.find(x => x.id === existingId);
    Object.assign(p, productData);
    toast('Producto actualizado', 'success');
  } else {
    productData.id = uid('prod');
    productData.createdAt = Date.now();
    if (!productData.image) productData.image = null;
    DB.data.products.push(productData);
    toast('Producto creado', 'success');
  }
  pendingProductImage = null;
  DB.save();
  closeModal();
  render();
}

function confirmDeleteProduct(id) {
  const p = DB.data.products.find(x => x.id === id);
  openModal(`
    <div class="modal" style="max-width:360px;">
      <div class="modal-body" style="text-align:center; padding-top:24px;">
        ${icon('alertCircle')}
        <h3 style="margin:10px 0 4px;">¿Eliminar "${escapeHtml(p.name)}"?</h3>
        <p style="color:var(--ink-soft); font-size:13px;">Esta acción no se puede deshacer. El historial de ventas no se verá afectado.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="deleteProduct('${id}')">Eliminar</button>
      </div>
    </div>
  `);
}
function deleteProduct(id) {
  DB.data.products = DB.data.products.filter(p => p.id !== id);
  DB.save();
  closeModal();
  render();
  toast('Producto eliminado', 'success');
}

// ---------------- Stock adjust ----------------
function openStockAdjust(productId) {
  const p = DB.data.products.find(x => x.id === productId);
  openModal(`
    <div class="modal" style="max-width:380px;">
      <div class="modal-body">
        <h3 style="margin-bottom:4px;">Ajustar stock</h3>
        <p style="color:var(--ink-soft); font-size:13px; margin-bottom:16px;">${escapeHtml(p.name)} — Stock actual: <strong>${p.stock} ${escapeHtml(p.unit||'pza')}</strong></p>
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <button class="btn btn-ghost adjust-type-btn active" data-type="add" style="flex:1;" onclick="setAdjustType('add')">${icon('plus')} Entrada</button>
          <button class="btn btn-ghost adjust-type-btn" data-type="remove" style="flex:1;" onclick="setAdjustType('remove')">${icon('minus')} Salida</button>
          <button class="btn btn-ghost adjust-type-btn" data-type="set" style="flex:1;" onclick="setAdjustType('set')">Fijar</button>
        </div>
        <div class="field">
          <label id="adjustLabel">Cantidad a agregar</label>
          <input class="input" type="number" step="1" id="adjustQty" placeholder="0" autofocus>
        </div>
        <div class="field" style="margin-top:10px;">
          <label>Motivo (opcional)</label>
          <input class="input" id="adjustReason" placeholder="Ej. Compra a proveedor, merma, conteo físico...">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="applyStockAdjust('${productId}')">Aplicar ajuste</button>
      </div>
    </div>
  `);
}
let adjustType = 'add';
function setAdjustType(type) {
  adjustType = type;
  document.querySelectorAll('.adjust-type-btn').forEach(b => b.classList.toggle('btn-primary', b.dataset.type === type));
  document.querySelectorAll('.adjust-type-btn').forEach(b => b.classList.toggle('btn-ghost', b.dataset.type !== type));
  document.getElementById('adjustLabel').textContent = type === 'add' ? 'Cantidad a agregar' : type === 'remove' ? 'Cantidad a quitar' : 'Nuevo stock total';
}
function applyStockAdjust(productId) {
  const p = DB.data.products.find(x => x.id === productId);
  const qty = parseInt(document.getElementById('adjustQty').value);
  if (isNaN(qty) || qty < 0) { toast('Ingresa una cantidad válida', 'error'); return; }
  const reason = document.getElementById('adjustReason').value.trim();
  const before = p.stock;
  if (adjustType === 'add') p.stock += qty;
  else if (adjustType === 'remove') p.stock = Math.max(0, p.stock - qty);
  else p.stock = qty;

  DB.data.stockMovements.push({
    id: uid('mov'), productId: p.id, productName: p.name,
    type: adjustType, qty, before, after: p.stock, reason,
    userId: STATE.currentUser.id, userName: STATE.currentUser.name, createdAt: Date.now(),
  });
  DB.save();
  closeModal();
  render();
  toast('Stock actualizado', 'success');
}

// ---------------- Category manager ----------------
function openCategoryManager() {
  openModal(`
    <div class="modal">
      <div class="modal-body">
        <h3 style="margin-bottom:14px;">Categorías</h3>
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <input class="input" id="newCatName" placeholder="Nombre de nueva categoría">
          <button class="btn btn-primary" onclick="addCategory()">${icon('plus')}</button>
        </div>
        <div id="catList" style="display:flex; flex-direction:column; gap:6px; max-height:300px; overflow-y:auto;">
          ${renderCategoryListItems()}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal(); render();">Cerrar</button>
      </div>
    </div>
  `);
}
function renderCategoryListItems() {
  return DB.data.categories.map(c => {
    const count = DB.data.products.filter(p => p.categoryId === c.id).length;
    return `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border:1px solid var(--line); border-radius:8px;">
      <span style="font-size:13px; font-weight:600;">${escapeHtml(c.name)} <span style="color:var(--ink-soft); font-weight:400;">(${count})</span></span>
      ${c.id !== 'c_general' ? `<button class="btn btn-ghost btn-sm" onclick="deleteCategory('${c.id}')">${icon('trash')}</button>` : ''}
    </div>`;
  }).join('');
}
function addCategory() {
  const input = document.getElementById('newCatName');
  const name = input.value.trim();
  if (!name) return;
  DB.data.categories.push({ id: uid('cat'), name, color: '#1B2B22' });
  DB.save();
  input.value = '';
  document.getElementById('catList').innerHTML = renderCategoryListItems();
}
function deleteCategory(id) {
  DB.data.products.forEach(p => { if (p.categoryId === id) p.categoryId = 'c_general'; });
  DB.data.categories = DB.data.categories.filter(c => c.id !== id);
  DB.save();
  document.getElementById('catList').innerHTML = renderCategoryListItems();
  toast('Categoría eliminada', 'success');
}
