// ============================================================
// VENTO POS — Sale (POS) view
// ============================================================
let posSearchTerm = '';
let posActiveCategory = 'all';

function renderPosView() {
  if (!DB.data.activeShift) {
    return `
    <div style="flex:1;display:flex;align-items:center;justify-content:center;">
      <div class="empty-state" style="max-width:340px;">
        ${icon('shift')}
        <h3>La caja está cerrada</h3>
        <p>Abre la caja para empezar a registrar ventas del día.</p>
        <button class="btn btn-primary" style="margin-top:8px;" onclick="navigate('shift')">Ir a abrir caja</button>
      </div>
    </div>`;
  }

  const products = DB.data.products.filter(p => p.active !== false);
  const cats = DB.data.categories;
  let filtered = products;
  if (posActiveCategory !== 'all') filtered = filtered.filter(p => p.categoryId === posActiveCategory);
  if (posSearchTerm.trim()) {
    const t = posSearchTerm.trim().toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(t) || (p.sku || '').toLowerCase().includes(t) || (p.barcode || '').includes(t));
  }

  return `
  <div class="pos-layout">
    <div class="pos-catalog">
      <div class="pos-catalog-toolbar">
        <div class="search-wrap">
          ${icon('search')}
          <input class="input" placeholder="Buscar producto, SKU o código..." value="${escapeHtml(posSearchTerm)}"
                 oninput="posSearchTerm=this.value; renderPosCatalogOnly();" id="posSearchInput" autofocus>
        </div>
      </div>
      <div class="cat-chip-row">
        <button class="cat-chip ${posActiveCategory==='all'?'active':''}" onclick="posSetCategory('all')">Todos</button>
        ${cats.map(c => `<button class="cat-chip ${posActiveCategory===c.id?'active':''}" onclick="posSetCategory('${c.id}')">${escapeHtml(c.name)}</button>`).join('')}
      </div>
      <div class="product-grid" id="posProductGrid">
        ${renderProductGridItems(filtered)}
      </div>
    </div>
    ${renderCartPanel()}
  </div>`;
}

function renderProductGridItems(filtered) {
  if (filtered.length === 0) {
    return `<div class="empty-state" style="grid-column:1/-1;">${icon('box')}<h3>Sin productos</h3><p>No se encontraron productos con esos filtros.</p></div>`;
  }
  return filtered.map(p => {
    const outOfStock = p.trackStock && p.stock <= 0;
    return `
    <button class="product-card" ${outOfStock ? 'disabled' : ''} onclick="posAddToCart('${p.id}')">
      ${p.trackStock && p.stock <= (DB.data.business.lowStockThreshold||5) ? `<span class="pc-stock-flag">${outOfStock ? 'AGOTADO' : 'BAJO'}</span>` : ''}
      <div class="pc-thumb">${p.image ? `<img src="${p.image}" alt="">` : escapeHtml(initials(p.name))}</div>
      <div class="pc-name">${escapeHtml(p.name)}</div>
      <div class="pc-price">${fmtMoney(p.price)}</div>
    </button>`;
  }).join('');
}

function renderPosCatalogOnly() {
  const grid = document.getElementById('posProductGrid');
  if (!grid) return;
  const products = DB.data.products.filter(p => p.active !== false);
  let filtered = products;
  if (posActiveCategory !== 'all') filtered = filtered.filter(p => p.categoryId === posActiveCategory);
  if (posSearchTerm.trim()) {
    const t = posSearchTerm.trim().toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(t) || (p.sku || '').toLowerCase().includes(t) || (p.barcode || '').includes(t));
  }
  grid.innerHTML = renderProductGridItems(filtered);
}

function posSetCategory(catId) {
  posActiveCategory = catId;
  render();
}

// ---------------- Cart logic ----------------
function posAddToCart(productId) {
  const p = DB.data.products.find(x => x.id === productId);
  if (!p) return;
  if (p.trackStock && p.stock <= 0) { toast('Sin existencias', 'error'); return; }
  const existing = STATE.posCart.find(l => l.productId === productId);
  if (existing) {
    if (p.trackStock && existing.qty + 1 > p.stock) { toast('No hay suficiente stock', 'error'); return; }
    existing.qty += 1;
  } else {
    STATE.posCart.push({ productId: p.id, name: p.name, price: p.price, qty: 1, unit: p.unit || 'pza' });
  }
  renderCartOnly();
}

function posChangeQty(productId, delta) {
  const line = STATE.posCart.find(l => l.productId === productId);
  if (!line) return;
  const p = DB.data.products.find(x => x.id === productId);
  const newQty = line.qty + delta;
  if (newQty <= 0) {
    STATE.posCart = STATE.posCart.filter(l => l.productId !== productId);
  } else {
    if (p && p.trackStock && newQty > p.stock) { toast('No hay suficiente stock', 'error'); return; }
    line.qty = newQty;
  }
  renderCartOnly();
}

function posRemoveLine(productId) {
  STATE.posCart = STATE.posCart.filter(l => l.productId !== productId);
  renderCartOnly();
}

function posClearCart() {
  STATE.posCart = [];
  STATE.posDiscount = { type: 'none', value: 0 };
  STATE.posCustomerId = 'cust_general';
  renderCartOnly();
}

function posCartTotals() {
  const subtotal = STATE.posCart.reduce((s, l) => s + l.price * l.qty, 0);
  let discount = 0;
  if (STATE.posDiscount.type === 'percent') discount = subtotal * (STATE.posDiscount.value / 100);
  else if (STATE.posDiscount.type === 'amount') discount = Math.min(STATE.posDiscount.value, subtotal);
  const afterDiscount = subtotal - discount;
  const taxRate = DB.data.business.taxRate || 0;
  let tax = 0, total = afterDiscount;
  if (taxRate > 0) {
    if (DB.data.business.taxIncluded) {
      tax = afterDiscount - (afterDiscount / (1 + taxRate / 100));
      total = afterDiscount;
    } else {
      tax = afterDiscount * (taxRate / 100);
      total = afterDiscount + tax;
    }
  }
  return { subtotal, discount, tax, total };
}

function renderCartPanel() {
  const cart = STATE.posCart;
  const totals = posCartTotals();
  const customer = DB.data.customers.find(c => c.id === STATE.posCustomerId) || DB.data.customers[0];

  return `
  <div class="pos-cart">
    <div class="cart-header">
      <h3>Venta actual</h3>
      ${cart.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="posConfirmClearCart()">Vaciar</button>` : ''}
    </div>
    <div class="cart-customer">
      ${icon('customers')}
      <button class="btn btn-ghost btn-sm btn-block" style="justify-content:flex-start;" onclick="posOpenCustomerPicker()">
        ${escapeHtml(customer.name)}
      </button>
    </div>
    ${cart.length === 0 ? `
      <div class="cart-empty">${icon('cart')}<p>El carrito está vacío.<br>Toca un producto para agregarlo.</p></div>
    ` : `
      <div class="cart-items" id="cartItemsList">
        ${cart.map(l => renderCartLine(l)).join('')}
      </div>
    `}
    <div class="cart-summary">
      <div class="sum-row"><span>Subtotal</span><span class="mono">${fmtMoney(totals.subtotal)}</span></div>
      <div class="sum-row discount-row">
        <span>Descuento</span>
        <span style="display:flex; align-items:center; gap:6px;">
          <span class="mono">${totals.discount > 0 ? '-' + fmtMoney(totals.discount) : fmtMoney(0)}</span>
          <button class="btn btn-ghost btn-sm" onclick="posOpenDiscountModal()">${icon('percent')}</button>
        </span>
      </div>
      ${DB.data.business.taxRate > 0 ? `<div class="sum-row"><span>IVA (${DB.data.business.taxRate}%)</span><span class="mono">${fmtMoney(totals.tax)}</span></div>` : ''}
      <div class="sum-row total"><span>Total</span><span class="mono">${fmtMoney(totals.total)}</span></div>
    </div>
    <div class="cart-actions">
      <button class="btn btn-amber btn-lg btn-block" ${cart.length===0?'disabled':''} onclick="posOpenPaymentModal()">${icon('cash')} Cobrar ${cart.length>0?fmtMoney(totals.total):''}</button>
    </div>
  </div>`;
}

function renderCartLine(l) {
  return `
  <div class="cart-line" data-pid="${l.productId}">
    <div class="cl-main">
      <div class="cl-name">${escapeHtml(l.name)}</div>
      <div class="cl-unit">${fmtMoney(l.price)} / ${escapeHtml(l.unit)}</div>
    </div>
    <div class="qty-stepper">
      <button onclick="posChangeQty('${l.productId}', -1)">${icon('minus')}</button>
      <span class="qty-val">${l.qty}</span>
      <button onclick="posChangeQty('${l.productId}', 1)">${icon('plus')}</button>
    </div>
    <div class="cl-linetotal mono">${fmtMoney(l.price * l.qty)}</div>
    <button class="cl-remove" onclick="posRemoveLine('${l.productId}')">${icon('close')}</button>
  </div>`;
}

function renderCartOnly() {
  const searchEl = document.getElementById('posSearchInput');
  const hadFocus = document.activeElement === searchEl;
  const caret = searchEl ? searchEl.selectionStart : null;
  render();
  if (hadFocus) {
    const el = document.getElementById('posSearchInput');
    if (el) { el.focus(); if (caret !== null) el.setSelectionRange(caret, caret); }
  }
}

function posConfirmClearCart() {
  openModal(`
    <div class="modal" style="max-width:340px;">
      <div class="modal-body" style="text-align:center; padding-top:24px;">
        ${icon('alertCircle')}
        <h3 style="margin:10px 0 4px;">¿Vaciar el carrito?</h3>
        <p style="color:var(--ink-soft); font-size:13px;">Se eliminarán todos los productos de esta venta.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="closeModal(); posClearCart();">Vaciar</button>
      </div>
    </div>
  `);
}

// ---------------- Discount modal ----------------
function posOpenDiscountModal() {
  const d = STATE.posDiscount;
  openModal(`
    <div class="modal" style="max-width:360px;">
      <div class="modal-body">
        <h3 style="margin-bottom:14px;">Aplicar descuento</h3>
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <button class="btn ${d.type==='none'?'btn-primary':'btn-ghost'}" style="flex:1;" onclick="posSetDiscountType('none')">Ninguno</button>
          <button class="btn ${d.type==='percent'?'btn-primary':'btn-ghost'}" style="flex:1;" onclick="posSetDiscountType('percent')">Porcentaje</button>
          <button class="btn ${d.type==='amount'?'btn-primary':'btn-ghost'}" style="flex:1;" onclick="posSetDiscountType('amount')">Monto fijo</button>
        </div>
        ${d.type !== 'none' ? `
          <div class="field">
            <label>${d.type === 'percent' ? 'Porcentaje de descuento (%)' : 'Monto de descuento'}</label>
            <input class="input" type="number" min="0" step="0.01" id="discountValueInput" value="${d.value || ''}" placeholder="0">
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="posApplyDiscount()">Aplicar</button>
      </div>
    </div>
  `);
}
function posSetDiscountType(type) {
  STATE.posDiscount.type = type;
  posOpenDiscountModal();
}
function posApplyDiscount() {
  if (STATE.posDiscount.type !== 'none') {
    const input = document.getElementById('discountValueInput');
    let v = parseFloat(input.value) || 0;
    if (STATE.posDiscount.type === 'percent') v = clamp(v, 0, 100);
    STATE.posDiscount.value = v;
  } else {
    STATE.posDiscount.value = 0;
  }
  closeModal();
  renderCartOnly();
}

// ---------------- Customer picker ----------------
function posOpenCustomerPicker() {
  const customers = DB.data.customers;
  openModal(`
    <div class="modal" style="max-width:400px;">
      <div class="modal-body">
        <h3 style="margin-bottom:12px;">Seleccionar cliente</h3>
        <div class="search-wrap" style="margin-bottom:10px;">
          ${icon('search')}
          <input class="input" placeholder="Buscar cliente..." oninput="posFilterCustomerPicker(this.value)" id="custPickerSearch">
        </div>
        <div id="custPickerList" style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
          ${customers.map(c => `
            <button class="user-select-btn" style="padding:9px 11px;" onclick="posSelectCustomer('${c.id}')">
              <span class="user-avatar" style="background:var(--surface-2); color:var(--ink-soft);">${initials(c.name)}</span>
              <span><div class="usb-name">${escapeHtml(c.name)}</div>${c.phone ? `<div class="usb-role">${escapeHtml(c.phone)}</div>` : ''}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal(); navigate('customers');">+ Nuevo cliente</button>
      </div>
    </div>
  `);
}
function posFilterCustomerPicker(term) {
  const t = term.trim().toLowerCase();
  const filtered = DB.data.customers.filter(c => c.name.toLowerCase().includes(t) || (c.phone||'').includes(t));
  document.getElementById('custPickerList').innerHTML = filtered.map(c => `
    <button class="user-select-btn" style="padding:9px 11px;" onclick="posSelectCustomer('${c.id}')">
      <span class="user-avatar" style="background:var(--surface-2); color:var(--ink-soft);">${initials(c.name)}</span>
      <span><div class="usb-name">${escapeHtml(c.name)}</div>${c.phone ? `<div class="usb-role">${escapeHtml(c.phone)}</div>` : ''}</span>
    </button>
  `).join('');
}
function posSelectCustomer(id) {
  STATE.posCustomerId = id;
  closeModal();
  renderCartOnly();
}

// ---------------- Payment ----------------
let paymentMethod = 'cash';
let cashReceivedValue = '';

function posOpenPaymentModal() {
  if (STATE.posCart.length === 0) return;
  paymentMethod = 'cash';
  cashReceivedValue = '';
  const totals = posCartTotals();
  openModal(`
    <div class="modal" id="paymentModal">
      <div class="modal-body">
        <h3 style="margin-bottom:14px;">Cobrar venta</h3>
        <div class="pay-total-display">
          <div class="ptd-label">Total a pagar</div>
          <div class="ptd-value mono">${fmtMoney(totals.total)}</div>
        </div>
        <div class="pay-methods">
          <button class="pay-method-btn active" data-method="cash" onclick="posSetPayMethod('cash')">${icon('cash')}Efectivo</button>
          <button class="pay-method-btn" data-method="card" onclick="posSetPayMethod('card')">${icon('card')}Tarjeta</button>
          <button class="pay-method-btn" data-method="transfer" onclick="posSetPayMethod('transfer')">${icon('transfer')}Transferencia</button>
        </div>
        <div id="paymentMethodBody">${renderCashPaymentBody(totals.total)}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-amber btn-lg" id="confirmPayBtn" onclick="posConfirmPayment()">${icon('check')} Confirmar venta</button>
      </div>
    </div>
  `);
}

function renderCashPaymentBody(total) {
  const received = parseFloat(cashReceivedValue) || 0;
  const change = received - total;
  const quick = [total, Math.ceil(total/50)*50, Math.ceil(total/100)*100, Math.ceil(total/200)*200].filter((v,i,a)=>a.indexOf(v)===i).slice(0,4);
  return `
    <div class="field">
      <label>Efectivo recibido</label>
      <input class="input" type="number" step="0.01" min="0" id="cashReceivedInput" value="${cashReceivedValue}"
             oninput="cashReceivedValue=this.value; posUpdateChangeDisplay(${total});" placeholder="0.00" autofocus>
    </div>
    <div class="quick-cash-row">
      ${quick.map(v => `<button class="btn btn-ghost btn-sm" onclick="posSetQuickCash(${v}, ${total})">${fmtMoney(v)}</button>`).join('')}
    </div>
    <div class="change-display ${change < 0 ? 'insufficient' : ''}" id="changeDisplay">
      <span class="cd-label">${change < 0 ? 'Falta' : 'Cambio'}</span>
      <span class="cd-value mono">${fmtMoney(Math.abs(change))}</span>
    </div>
  `;
}
function posSetQuickCash(v, total) {
  cashReceivedValue = String(v);
  document.getElementById('cashReceivedInput').value = v;
  posUpdateChangeDisplay(total);
}
function posUpdateChangeDisplay(total) {
  const received = parseFloat(cashReceivedValue) || 0;
  const change = received - total;
  const el = document.getElementById('changeDisplay');
  if (!el) return;
  el.className = 'change-display' + (change < 0 ? ' insufficient' : '');
  el.innerHTML = `<span class="cd-label">${change < 0 ? 'Falta' : 'Cambio'}</span><span class="cd-value mono">${fmtMoney(Math.abs(change))}</span>`;
}
function posSetPayMethod(method) {
  paymentMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.toggle('active', b.dataset.method === method));
  const totals = posCartTotals();
  const body = document.getElementById('paymentMethodBody');
  if (method === 'cash') {
    body.innerHTML = renderCashPaymentBody(totals.total);
  } else {
    body.innerHTML = `
      <div class="empty-state" style="padding:24px 10px;">
        ${icon(method === 'card' ? 'card' : 'transfer')}
        <p>Confirma cuando el pago por ${method === 'card' ? 'tarjeta' : 'transferencia'} se haya completado.</p>
      </div>`;
  }
}

function posConfirmPayment() {
  const totals = posCartTotals();
  if (paymentMethod === 'cash') {
    const received = parseFloat(cashReceivedValue) || 0;
    if (received < totals.total) { toast('El efectivo recibido es menor al total', 'error'); return; }
  }
  const customer = DB.data.customers.find(c => c.id === STATE.posCustomerId);
  const sale = {
    id: uid('sale'),
    folio: (DB.data.sales.length + 1).toString().padStart(5, '0'),
    items: STATE.posCart.map(l => ({ productId: l.productId, name: l.name, price: l.price, qty: l.qty, unit: l.unit })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    paymentMethod,
    cashReceived: paymentMethod === 'cash' ? (parseFloat(cashReceivedValue) || 0) : null,
    change: paymentMethod === 'cash' ? (parseFloat(cashReceivedValue) || 0) - totals.total : 0,
    customerId: customer.id,
    customerName: customer.name,
    userId: STATE.currentUser.id,
    userName: STATE.currentUser.name,
    shiftId: DB.data.activeShift.id,
    createdAt: Date.now(),
  };
  sale.items.forEach(item => {
    const p = DB.data.products.find(x => x.id === item.productId);
    if (p && p.trackStock) {
      p.stock = Math.max(0, p.stock - item.qty);
    }
  });
  DB.data.sales.push(sale);
  DB.save();
  closeModal();
  STATE.posCart = [];
  STATE.posDiscount = { type: 'none', value: 0 };
  STATE.posCustomerId = 'cust_general';
  posShowReceipt(sale);
}

function posShowReceipt(sale) {
  const biz = DB.data.business;
  openModal(`
    <div class="modal" style="max-width:380px;">
      <div class="modal-body">
        <div class="receipt-paper">
          <div class="r-center">
            ${biz.logo ? `<img src="${biz.logo}" style="width:44px;height:44px;object-fit:contain;margin-bottom:6px;">` : ''}
            <div class="r-biz-name">${escapeHtml(biz.name)}</div>
            ${biz.address ? `<div>${escapeHtml(biz.address)}</div>` : ''}
            ${biz.phone ? `<div>${escapeHtml(biz.phone)}</div>` : ''}
          </div>
          <hr>
          <div class="r-row"><span>Folio</span><span>#${sale.folio}</span></div>
          <div class="r-row"><span>Fecha</span><span>${fmtDateTime(sale.createdAt)}</span></div>
          <div class="r-row"><span>Atendió</span><span>${escapeHtml(sale.userName)}</span></div>
          <div class="r-row"><span>Cliente</span><span>${escapeHtml(sale.customerName)}</span></div>
          <hr>
          ${sale.items.map(it => `
            <div class="r-row"><span class="r-item-name">${it.qty} x ${escapeHtml(it.name)}</span><span>${fmtMoney(it.price * it.qty)}</span></div>
          `).join('')}
          <hr>
          <div class="r-row"><span>Subtotal</span><span>${fmtMoney(sale.subtotal)}</span></div>
          ${sale.discount > 0 ? `<div class="r-row"><span>Descuento</span><span>-${fmtMoney(sale.discount)}</span></div>` : ''}
          ${sale.tax > 0 ? `<div class="r-row"><span>IVA</span><span>${fmtMoney(sale.tax)}</span></div>` : ''}
          <div class="r-row r-total-row"><span>TOTAL</span><span>${fmtMoney(sale.total)}</span></div>
          <div class="r-row"><span>Pago (${sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'})</span><span></span></div>
          ${sale.paymentMethod === 'cash' ? `
            <div class="r-row"><span>Recibido</span><span>${fmtMoney(sale.cashReceived)}</span></div>
            <div class="r-row"><span>Cambio</span><span>${fmtMoney(sale.change)}</span></div>
          ` : ''}
          <hr>
          <div class="r-center">${escapeHtml(biz.receiptFooter || '')}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.print()">${icon('printer')} Imprimir</button>
        <button class="btn btn-primary" onclick="closeModal(); render();">Nueva venta</button>
      </div>
    </div>
  `, { persistent: true });
}
