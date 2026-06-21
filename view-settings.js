// ============================================================
// VENTO POS — Settings view (business config + data backup)
// ============================================================
function renderSettingsView() {
  const b = DB.data.business;
  return `
  <div class="view-manage">
    <div class="view-head">
      <div>
        <h2>Configuración</h2>
        <div class="vh-sub">Datos del negocio, recibo y respaldo</div>
      </div>
    </div>
    <div class="view-body">
      <div class="settings-grid">

        <div class="settings-section">
          <h3>${icon('building')} Negocio</h3>
          <div style="display:flex; gap:16px; align-items:flex-start; margin-bottom:14px;">
            <label class="logo-upload" for="set_logo_input">
              ${b.logo ? `<img src="${b.logo}">` : icon('image')}
            </label>
            <input type="file" id="set_logo_input" accept="image/*" style="display:none;" onchange="settingsUploadLogo(this)">
            <div style="flex:1;">
              <div class="field" style="margin-bottom:10px;"><label>Nombre del negocio</label><input class="input" id="set_name" value="${escapeHtml(b.name)}"></div>
              <div class="field"><label>Pie de recibo</label><input class="input" id="set_footer" value="${escapeHtml(b.receiptFooter || '')}" placeholder="¡Gracias por tu compra!"></div>
            </div>
          </div>
          <div class="settings-form-grid">
            <div class="field"><label>Dirección</label><input class="input" id="set_address" value="${escapeHtml(b.address || '')}" placeholder="Opcional"></div>
            <div class="field"><label>Teléfono</label><input class="input" id="set_phone" value="${escapeHtml(b.phone || '')}" placeholder="Opcional"></div>
          </div>
        </div>

        <div class="settings-section">
          <h3>${icon('cash')} Moneda e impuestos</h3>
          <div class="settings-form-grid">
            <div class="field"><label>Símbolo de moneda</label><input class="input" id="set_symbol" value="${escapeHtml(b.currencySymbol || '$')}" maxlength="3"></div>
            <div class="field"><label>Código de moneda</label><input class="input" id="set_currency" value="${escapeHtml(b.currency || 'MXN')}" maxlength="6"></div>
            <div class="field"><label>Tasa de impuesto (%)</label><input class="input" id="set_tax" type="number" min="0" max="100" step="0.01" value="${b.taxRate || 0}"></div>
            <div class="field">
              <label>El impuesto ya está...</label>
              <select class="input" id="set_taxincluded">
                <option value="1" ${b.taxIncluded ? 'selected' : ''}>Incluido en el precio</option>
                <option value="0" ${!b.taxIncluded ? 'selected' : ''}>Se suma al cobrar</option>
              </select>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>${icon('box')} Inventario</h3>
          <div class="settings-form-grid">
            <div class="field"><label>Umbral de stock bajo</label><input class="input" id="set_lowstock" type="number" min="0" value="${b.lowStockThreshold ?? 5}"></div>
          </div>
          <p style="font-size:12px; color:var(--ink-soft); margin-top:6px;">Los productos con existencia igual o menor a este número se marcarán como stock bajo.</p>
        </div>

        <div class="settings-section">
          <button class="btn btn-primary" onclick="saveSettings()">${icon('check')} Guardar cambios</button>
        </div>

        <div class="settings-section">
          <h3>${icon('download')} Respaldo de datos</h3>
          <p style="font-size:13px; color:var(--ink-soft); margin-bottom:12px;">Toda tu información se guarda únicamente en este dispositivo. Exporta un respaldo regularmente para no perder tus datos.</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-ghost" onclick="exportBackup()">${icon('download')} Exportar respaldo</button>
            <button class="btn btn-ghost" onclick="document.getElementById('set_restore_input').click()">${icon('upload')} Restaurar respaldo</button>
            <input type="file" id="set_restore_input" accept="application/json" style="display:none;" onchange="importBackup(this)">
            <button class="btn btn-danger" onclick="confirmFactoryReset()">${icon('trash')} Borrar todo</button>
          </div>
        </div>

      </div>
    </div>
  </div>`;
}

function settingsUploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  readFileAsDataURL(file).then(dataUrl => {
    DB.data.business.logo = dataUrl;
    DB.save();
    render();
    toast('Logo actualizado', 'success');
  });
}

function saveSettings() {
  const b = DB.data.business;
  b.name = document.getElementById('set_name').value.trim() || 'Mi Negocio';
  b.receiptFooter = document.getElementById('set_footer').value.trim();
  b.address = document.getElementById('set_address').value.trim();
  b.phone = document.getElementById('set_phone').value.trim();
  b.currencySymbol = document.getElementById('set_symbol').value.trim() || '$';
  b.currency = document.getElementById('set_currency').value.trim() || 'MXN';
  b.taxRate = parseFloat(document.getElementById('set_tax').value) || 0;
  b.taxIncluded = document.getElementById('set_taxincluded').value === '1';
  b.lowStockThreshold = parseInt(document.getElementById('set_lowstock').value, 10) || 0;
  DB.save();
  render();
  toast('Configuración guardada', 'success');
}

function exportBackup() {
  const filename = `vento-respaldo-${new Date().toISOString().slice(0,10)}.json`;
  downloadFile(filename, JSON.stringify(DB.data, null, 2), 'application/json');
  toast('Respaldo exportado', 'success');
}

function importBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.products)) {
        throw new Error('Formato inválido');
      }
      openModal(`
        <div class="modal" style="max-width:360px;">
          <div class="modal-body" style="text-align:center; padding-top:24px;">
            ${icon('alertCircle')}
            <h3 style="margin:10px 0 4px;">¿Restaurar este respaldo?</h3>
            <p style="color:var(--ink-soft); font-size:13px;">Esto reemplazará todos los datos actuales (productos, ventas, clientes, usuarios) con los del archivo.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-danger" onclick="doImportBackup()">Restaurar</button>
          </div>
        </div>
      `);
      window._pendingRestore = parsed;
    } catch (e) {
      toast('El archivo no es un respaldo válido', 'error');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function doImportBackup() {
  if (!window._pendingRestore) return;
  DB.data = window._pendingRestore;
  DB.save();
  window._pendingRestore = null;
  closeModal();
  STATE.currentUser = null;
  STATE.route = 'login';
  render();
  toast('Respaldo restaurado correctamente', 'success');
}

function confirmFactoryReset() {
  openModal(`
    <div class="modal" style="max-width:360px;">
      <div class="modal-body" style="text-align:center; padding-top:24px;">
        ${icon('alertCircle')}
        <h3 style="margin:10px 0 4px;">¿Borrar todos los datos?</h3>
        <p style="color:var(--ink-soft); font-size:13px;">Se eliminarán productos, ventas, clientes y usuarios. Esta acción no se puede deshacer. Exporta un respaldo antes si no estás seguro.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="doFactoryReset()">Borrar todo</button>
      </div>
    </div>
  `);
}
function doFactoryReset() {
  DB.reset();
  closeModal();
  STATE.currentUser = null;
  STATE.route = 'login';
  render();
  toast('Todos los datos fueron borrados', 'success');
}
