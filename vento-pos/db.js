// ============================================================
// VENTO POS — Data layer (localStorage)
// ============================================================
const DB_KEY = 'vento_pos_data_v1';

function uid(prefix) {
  return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultData() {
  const now = Date.now();
  return {
    version: 1,
    business: {
      name: 'Mi Negocio',
      logo: null, // base64
      currency: 'MXN',
      currencySymbol: '$',
      taxRate: 0, // percentage, 0 = disabled
      taxIncluded: true,
      address: '',
      phone: '',
      receiptFooter: '¡Gracias por tu compra!',
      lowStockThreshold: 5,
    },
    users: [
      { id: 'u_admin', name: 'Administrador', role: 'admin', pin: '1234', active: true, createdAt: now },
    ],
    categories: [
      { id: 'c_general', name: 'General', color: '#1B2B22' },
    ],
    products: [],
    customers: [
      { id: 'cust_general', name: 'Cliente general', phone: '', email: '', notes: '', createdAt: now, isGeneric: true },
    ],
    sales: [],
    shifts: [], // closed shifts history
    activeShift: null, // { id, userId, userName, openedAt, openingCash, status:'open' }
    stockMovements: [], // manual adjustments log
    session: {
      currentUserId: null,
    },
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const fresh = defaultData();
      saveData(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    // basic shape safety
    const def = defaultData();
    return Object.assign(def, parsed, {
      business: Object.assign(def.business, parsed.business || {}),
    });
  } catch (e) {
    console.error('Error loading data, resetting', e);
    const fresh = defaultData();
    saveData(fresh);
    return fresh;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Error saving data', e);
    return false;
  }
}

// Global in-memory store, persisted on every mutation via DB.save()
const DB = {
  data: loadData(),
  save() { saveData(this.data); },
  reset() { this.data = defaultData(); this.save(); },
};
