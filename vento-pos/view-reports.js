// ============================================================
// VENTO POS — Reports view
// ============================================================
let reportRange = 'today'; // today | week | month | all

function reportDateBounds() {
  const now = Date.now();
  if (reportRange === 'today') {
    const [s,e] = todayRange();
    return [s,e];
  }
  if (reportRange === 'week') return [now - 7*24*60*60*1000, now];
  if (reportRange === 'month') return [now - 30*24*60*60*1000, now];
  return [0, now];
}

function renderReportsView() {
  const bounds = reportDateBounds();
  const start = bounds[0], end = bounds[1];
  const sales = DB.data.sales.filter(s => s.createdAt >= start && s.createdAt <= end);
  const totalRevenue = sales.reduce((s,sale) => s + sale.total, 0);
  const totalDiscount = sales.reduce((s,sale) => s + sale.discount, 0);
  const avgTicket = sales.length ? totalRevenue / sales.length : 0;

  const productTotals = {};
  sales.forEach(sale => sale.items.forEach(it => {
    if (!productTotals[it.productId]) productTotals[it.productId] = { name: it.name, qty: 0, revenue: 0 };
    productTotals[it.productId].qty += it.qty;
    productTotals[it.productId].revenue += it.price * it.qty;
  }));
  const topProducts = Object.values(productTotals).sort((a,b) => b.revenue - a.revenue).slice(0, 8);
  const maxQty = topProducts.length ? Math.max(...topProducts.map(p=>p.revenue)) : 1;

  const byMethod = { cash: 0, card: 0, transfer: 0 };
  sales.forEach(s => { byMethod[s.paymentMethod] = (byMethod[s.paymentMethod]||0) + s.total; });

  const byUser = {};
  sales.forEach(s => { byUser[s.userName] = (byUser[s.userName]||0) + s.total; });

  return `
  <div class="view-manage">
    <div class="view-head">
      <div>
        <h2>Reportes</h2>
        <div class="vh-sub">${sales.length} ventas en el periodo seleccionado</div>
      </div>
      <button class="btn btn-ghost" onclick="exportSalesCSV()">${icon('download')} Exportar CSV</button>
    </div>

    <div class="cat-chip-row" style="margin-bottom:16px;">
      <button class="cat-chip ${reportRange==='today'?'active':''}" onclick="reportRange='today'; render();">Hoy</button>
      <button class="cat-chip ${reportRange==='week'?'active':''}" onclick="reportRange='week'; render();">Últimos 7 días</button>
      <button class="cat-chip ${reportRange==='month'?'active':''}" onclick="reportRange='month'; render();">Últimos 30 días</button>
      <button class="cat-chip ${reportRange==='all'?'active':''}" onclick="reportRange='all'; render();">Todo</button>
    </div>

    <div class="stat-row">
      <div class="stat-card accent"><div class="sc-label">Ingresos totales</div><div class="sc-value mono">${fmtMoney(totalRevenue)}</div></div>
      <div class="stat-card"><div class="sc-label">Ventas</div><div class="sc-value">${sales.length}</div></div>
      <div class="stat-card"><div class="sc-label">Ticket promedio</div><div class="sc-value mono">${fmtMoney(avgTicket)}</div></div>
      <div class="stat-card"><div class="sc-label">Descuentos otorgados</div><div class="sc-value mono">${fmtMoney(totalDiscount)}</div></div>
    </div>

    <div class="view-body" style="overflow-y:auto; display:block;">
      <div style="display:grid; grid-template-columns:1.3fr 1fr; gap:14px; margin-bottom:14px; align-items:start;">
        <div class="card" style="padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px;">Productos más vendidos</h3>
          ${topProducts.length === 0 ? `<p style="color:var(--ink-soft); font-size:13px;">Sin datos en este periodo.</p>` : topProducts.map(p => `
            <div style="margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
                <span style="font-weight:600;">${escapeHtml(p.name)}</span>
                <span class="mono">${fmtMoney(p.revenue)} · ${p.qty} und.</span>
              </div>
              <div style="height:7px; background:var(--surface-2); border-radius:4px; overflow:hidden;">
                <div style="height:100%; width:${(p.revenue/maxQty*100).toFixed(1)}%; background:var(--amber);"></div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="card" style="padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px;">Métodos de pago</h3>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div class="sum-row"><span>${icon('cash')} Efectivo</span><span class="mono">${fmtMoney(byMethod.cash)}</span></div>
            <div class="sum-row"><span>${icon('card')} Tarjeta</span><span class="mono">${fmtMoney(byMethod.card)}</span></div>
            <div class="sum-row"><span>${icon('transfer')} Transferencia</span><span class="mono">${fmtMoney(byMethod.transfer)}</span></div>
          </div>
          <h3 style="font-size:14px; margin:18px 0 12px; padding-top:14px; border-top:1px solid var(--line);">Ventas por usuario</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${Object.keys(byUser).length === 0 ? `<p style="color:var(--ink-soft); font-size:13px;">Sin datos.</p>` : Object.entries(byUser).map(([name, total]) => `
              <div class="sum-row"><span>${escapeHtml(name)}</span><span class="mono">${fmtMoney(total)}</span></div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="panel-header"><h3 style="font-size:14px;">Historial de ventas</h3></div>
        <div style="max-height:320px; overflow-y:auto;">
          <table class="data-table">
            <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Cajero</th><th>Método</th><th>Total</th></tr></thead>
            <tbody>
              ${[...sales].sort((a,b)=>b.createdAt-a.createdAt).map(s => `
                <tr style="cursor:pointer;" onclick="openSaleDetail('${s.id}')">
                  <td class="mono">#${s.folio}</td>
                  <td>${fmtDateTime(s.createdAt)}</td>
                  <td>${escapeHtml(s.customerName)}</td>
                  <td>${escapeHtml(s.userName)}</td>
                  <td>${s.paymentMethod==='cash'?'Efectivo':s.paymentMethod==='card'?'Tarjeta':'Transferencia'}</td>
                  <td class="mono">${fmtMoney(s.total)}</td>
                </tr>
              `).join('') || `<tr><td colspan="6" style="text-align:center; color:var(--ink-soft); padding:24px;">Sin ventas en este periodo</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
}

function openSaleDetail(saleId) {
  const sale = DB.data.sales.find(s => s.id === saleId);
  if (!sale) return;
  posShowReceipt(sale);
}

function exportSalesCSV() {
  const bounds = reportDateBounds();
  const start = bounds[0], end = bounds[1];
  const sales = DB.data.sales.filter(s => s.createdAt >= start && s.createdAt <= end);
  const rows = [['Folio','Fecha','Cliente','Cajero','Metodo de pago','Subtotal','Descuento','Impuesto','Total']];
  sales.forEach(s => rows.push([s.folio, fmtDateTime(s.createdAt), s.customerName, s.userName, s.paymentMethod, s.subtotal.toFixed(2), s.discount.toFixed(2), s.tax.toFixed(2), s.total.toFixed(2)]));
  downloadFile(`ventas_${reportRange}_${Date.now()}.csv`, toCSV(rows), 'text/csv');
  toast('Reporte exportado', 'success');
}
