// ============================================================
// VENTO POS — Shift (cash register cut) view
// ============================================================
function renderShiftView() {
  const shift = DB.data.activeShift;
  const history = [...DB.data.shifts].sort((a,b) => b.closedAt - a.closedAt);

  return `
  <div class="view-manage">
    <div class="view-head">
      <div>
        <h2>Caja</h2>
        <div class="vh-sub">${shift ? 'Turno en curso' : 'No hay turno abierto'}</div>
      </div>
      ${shift
        ? `<button class="btn btn-danger" onclick="openCloseShiftModal()">${icon('lock')} Cerrar caja</button>`
        : `<button class="btn btn-primary" onclick="openOpenShiftModal()">${icon('shift')} Abrir caja</button>`}
    </div>

    ${shift ? renderActiveShiftCard(shift) : ''}

    <div class="view-head" style="margin-top: ${shift ? '18px' : '0'};">
      <h3 style="font-size:15px;">Historial de cortes</h3>
    </div>
    <div class="view-body">
      <div class="table-scroll">
        ${history.length === 0 ? `
          <div class="empty-state">${icon('shift')}<h3>Sin cortes registrados</h3><p>Cuando cierres un turno, aparecerá aquí.</p></div>
        ` : `
        <table class="data-table">
          <thead><tr><th>Cajero</th><th>Apertura</th><th>Cierre</th><th>Ventas</th><th>Efectivo esperado</th><th>Diferencia</th><th></th></tr></thead>
          <tbody>
            ${history.map(s => renderShiftRow(s)).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  </div>`;
}

function shiftSalesData(shiftId) {
  const sales = DB.data.sales.filter(s => s.shiftId === shiftId);
  const byMethod = { cash: 0, card: 0, transfer: 0 };
  sales.forEach(s => { byMethod[s.paymentMethod] = (byMethod[s.paymentMethod]||0) + s.total; });
  const totalSales = sales.reduce((s,sale) => s + sale.total, 0);
  return { sales, byMethod, totalSales };
}

function renderActiveShiftCard(shift) {
  const { sales, byMethod, totalSales } = shiftSalesData(shift.id);
  const expectedCash = shift.openingCash + byMethod.cash;
  return `
  <div class="card" style="padding:18px; margin-bottom:18px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px;">
      <div>
        <div class="eyebrow">Abierto por</div>
        <div style="font-weight:700; font-size:15px; margin-top:2px;">${escapeHtml(shift.userName)}</div>
        <div style="color:var(--ink-soft); font-size:12.5px; margin-top:2px;">${fmtDateTime(shift.openedAt)}</div>
      </div>
      <div class="shift-summary-grid" style="margin:0; grid-template-columns:repeat(4,auto); gap:18px;">
        <div class="ss-item" style="background:none; padding:0;"><div class="ss-label">Fondo inicial</div><div class="ss-value">${fmtMoney(shift.openingCash)}</div></div>
        <div class="ss-item" style="background:none; padding:0;"><div class="ss-label">Ventas</div><div class="ss-value">${sales.length}</div></div>
        <div class="ss-item" style="background:none; padding:0;"><div class="ss-label">Total vendido</div><div class="ss-value">${fmtMoney(totalSales)}</div></div>
        <div class="ss-item" style="background:none; padding:0;"><div class="ss-label">Efectivo esperado</div><div class="ss-value">${fmtMoney(expectedCash)}</div></div>
      </div>
    </div>
    <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
      <span class="badge badge-ok">${icon('cash')} Efectivo ${fmtMoney(byMethod.cash)}</span>
      <span class="badge badge-info">${icon('card')} Tarjeta ${fmtMoney(byMethod.card)}</span>
      <span class="badge badge-neutral">${icon('transfer')} Transferencia ${fmtMoney(byMethod.transfer)}</span>
    </div>
  </div>`;
}

function renderShiftRow(s) {
  const diff = s.countedCash - s.expectedCash;
  return `
  <tr>
    <td>${escapeHtml(s.userName)}</td>
    <td>${fmtDateTime(s.openedAt)}</td>
    <td>${fmtDateTime(s.closedAt)}</td>
    <td>${s.salesCount} (${fmtMoney(s.totalSales)})</td>
    <td class="mono">${fmtMoney(s.expectedCash)}</td>
    <td><span class="badge ${Math.abs(diff) < 0.01 ? 'badge-ok' : diff > 0 ? 'badge-info' : 'badge-danger'}">${diff >= 0 ? '+' : ''}${fmtMoney(diff)}</span></td>
    <td><div class="action-icons"><button title="Ver detalle" onclick="openShiftDetail('${s.id}')">${icon('receipt')}</button></div></td>
  </tr>`;
}

function openOpenShiftModal() {
  openModal(`
    <div class="modal" style="max-width:380px;">
      <div class="modal-body">
        <h3 style="margin-bottom:4px;">Abrir caja</h3>
        <p style="color:var(--ink-soft); font-size:13px; margin-bottom:16px;">Indica el fondo inicial de efectivo en caja para comenzar el turno.</p>
        <div class="field">
          <label>Fondo inicial de efectivo</label>
          <input class="input" type="number" step="0.01" min="0" id="openingCashInput" placeholder="0.00" autofocus>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="confirmOpenShift()">${icon('check')} Abrir caja</button>
      </div>
    </div>
  `);
}
function confirmOpenShift() {
  const val = parseFloat(document.getElementById('openingCashInput').value);
  if (isNaN(val) || val < 0) { toast('Ingresa un monto válido', 'error'); return; }
  DB.data.activeShift = {
    id: uid('shift'),
    userId: STATE.currentUser.id,
    userName: STATE.currentUser.name,
    openedAt: Date.now(),
    openingCash: val,
  };
  DB.save();
  closeModal();
  render();
  toast('Caja abierta', 'success');
}

function openCloseShiftModal() {
  const shift = DB.data.activeShift;
  const { byMethod, totalSales, sales } = shiftSalesData(shift.id);
  const expectedCash = shift.openingCash + byMethod.cash;
  openModal(`
    <div class="modal" style="max-width:420px;">
      <div class="modal-body">
        <h3 style="margin-bottom:4px;">Cerrar caja</h3>
        <p style="color:var(--ink-soft); font-size:13px; margin-bottom:14px;">Cuenta el efectivo físico en caja para hacer el corte.</p>
        <div class="shift-summary-grid">
          <div class="ss-item"><div class="ss-label">Fondo inicial</div><div class="ss-value">${fmtMoney(shift.openingCash)}</div></div>
          <div class="ss-item"><div class="ss-label">Ventas en efectivo</div><div class="ss-value">${fmtMoney(byMethod.cash)}</div></div>
          <div class="ss-item"><div class="ss-label">Ventas con tarjeta</div><div class="ss-value">${fmtMoney(byMethod.card)}</div></div>
          <div class="ss-item"><div class="ss-label">Transferencias</div><div class="ss-value">${fmtMoney(byMethod.transfer)}</div></div>
        </div>
        <div class="field" style="margin-top:6px;">
          <label>Efectivo contado en caja</label>
          <input class="input" type="number" step="0.01" min="0" id="countedCashInput" placeholder="0.00"
                 oninput="updateClosingDiff(${expectedCash})" autofocus>
        </div>
        <div class="change-display" id="closingDiffDisplay" style="margin-top:12px;">
          <span class="cd-label">Efectivo esperado</span>
          <span class="cd-value mono">${fmtMoney(expectedCash)}</span>
        </div>
        <div class="field" style="margin-top:12px;">
          <label>Notas del corte (opcional)</label>
          <textarea class="input" id="closeShiftNotes" placeholder="Observaciones..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="confirmCloseShift(${expectedCash}, ${totalSales}, ${sales.length}, ${byMethod.cash}, ${byMethod.card}, ${byMethod.transfer})">${icon('lock')} Confirmar cierre</button>
      </div>
    </div>
  `);
}
function updateClosingDiff(expected) {
  const counted = parseFloat(document.getElementById('countedCashInput').value) || 0;
  const diff = counted - expected;
  const el = document.getElementById('closingDiffDisplay');
  if (!document.getElementById('countedCashInput').value) {
    el.className = 'change-display';
    el.innerHTML = `<span class="cd-label">Efectivo esperado</span><span class="cd-value mono">${fmtMoney(expected)}</span>`;
    return;
  }
  el.className = 'change-display' + (Math.abs(diff) < 0.01 ? '' : diff < 0 ? ' insufficient' : '');
  el.innerHTML = `<span class="cd-label">${diff === 0 ? 'Cuadra exacto' : diff > 0 ? 'Sobrante' : 'Faltante'}</span><span class="cd-value mono">${fmtMoney(Math.abs(diff))}</span>`;
}
function confirmCloseShift(expectedCash, totalSales, salesCount, cashTotal, cardTotal, transferTotal) {
  const counted = parseFloat(document.getElementById('countedCashInput').value);
  if (isNaN(counted) || counted < 0) { toast('Ingresa el efectivo contado', 'error'); return; }
  const notes = document.getElementById('closeShiftNotes').value.trim();
  const shift = DB.data.activeShift;
  const closedShift = Object.assign({}, shift, {
    closedAt: Date.now(),
    expectedCash: expectedCash, countedCash: counted,
    totalSales: totalSales, salesCount: salesCount, cashTotal: cashTotal, cardTotal: cardTotal, transferTotal: transferTotal,
    notes: notes,
  });
  DB.data.shifts.push(closedShift);
  DB.data.activeShift = null;
  DB.save();
  closeModal();
  render();
  toast('Caja cerrada correctamente', 'success');
}

function openShiftDetail(shiftId) {
  const s = DB.data.shifts.find(x => x.id === shiftId);
  const diff = s.countedCash - s.expectedCash;
  const sales = DB.data.sales.filter(sale => sale.shiftId === shiftId);
  openModal(`
    <div class="modal modal-wide">
      <div class="modal-body">
        <h3 style="margin-bottom:2px;">Corte de caja — ${escapeHtml(s.userName)}</h3>
        <p style="color:var(--ink-soft); font-size:13px; margin-bottom:14px;">${fmtDateTime(s.openedAt)} → ${fmtDateTime(s.closedAt)}</p>
        <div class="shift-summary-grid">
          <div class="ss-item"><div class="ss-label">Fondo inicial</div><div class="ss-value">${fmtMoney(s.openingCash)}</div></div>
          <div class="ss-item"><div class="ss-label">Total vendido</div><div class="ss-value">${fmtMoney(s.totalSales)}</div></div>
          <div class="ss-item"><div class="ss-label">Efectivo esperado</div><div class="ss-value">${fmtMoney(s.expectedCash)}</div></div>
          <div class="ss-item"><div class="ss-label">Efectivo contado</div><div class="ss-value">${fmtMoney(s.countedCash)}</div></div>
        </div>
        <div class="badge ${Math.abs(diff)<0.01?'badge-ok':diff>0?'badge-info':'badge-danger'}" style="margin-bottom:14px;">
          ${diff===0?'Cuadre exacto':diff>0?'Sobrante':'Faltante'}: ${fmtMoney(Math.abs(diff))}
        </div>
        ${s.notes ? `<p style="font-size:13px; background:var(--surface-2); padding:10px; border-radius:8px; margin-bottom:14px;">${escapeHtml(s.notes)}</p>` : ''}
        <div style="font-size:13px; font-weight:700; margin-bottom:8px;">Ventas del turno (${sales.length})</div>
        <div style="max-height:220px; overflow-y:auto;">
          <table class="data-table">
            <thead><tr><th>Folio</th><th>Hora</th><th>Método</th><th>Total</th></tr></thead>
            <tbody>
              ${sales.map(sale => `<tr><td class="mono">#${sale.folio}</td><td>${fmtTime(sale.createdAt)}</td><td>${sale.paymentMethod==='cash'?'Efectivo':sale.paymentMethod==='card'?'Tarjeta':'Transferencia'}</td><td class="mono">${fmtMoney(sale.total)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
      </div>
    </div>
  `);
}
