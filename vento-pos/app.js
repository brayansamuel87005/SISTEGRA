// ============================================================
// VENTO POS — App bootstrap
// ============================================================
(function init() {
  // Restore session if there's a logged-in user from last time
  const savedUserId = DB.data.session.currentUserId;
  if (savedUserId) {
    const u = DB.data.users.find(x => x.id === savedUserId && x.active);
    if (u) {
      STATE.currentUser = u;
      STATE.route = 'pos';
    } else {
      DB.data.session.currentUserId = null;
      DB.save();
    }
  }
  render();
})();
