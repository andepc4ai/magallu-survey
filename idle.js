/* Auto log-off after 1 hour without any touch, on every page (app, families, castes, wards).
   "Last touch" is shared by all pages through localStorage 'mvs_act', so moving between pages counts as activity.
   Checked every minute and whenever the phone comes back to the page (timers sleep while the screen is off).
   A page may define window.mvsIdleLogout(msg) (the main app does: it sends unsaved edits first);
   otherwise the page goes to the main app with #logout, which logs out there. */
(function () {
  var LIMIT = 60 * 60000, KEY = 'mvs_act', mine = 0;
  var MSG = '';   // no message on the login screen (Anudeep, 18 Nov: keep it clean)
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function loggedIn() { var u = get('mvs_user'); return !!u && u !== 'null'; }
  function last() { return Math.max(mine, Number(get(KEY)) || 0); }
  function mark() {
    var t = Date.now(); if (t - mine < 10000) return;   // write at most every 10 s
    mine = t; try { localStorage.setItem(KEY, String(t)); } catch (e) {}
  }
  function check() {
    if (!loggedIn()) return;
    if (!last()) { mark(); return; }                    // first run after this update: start counting now
    if (Date.now() - last() < LIMIT) return;
    if (typeof window.mvsIdleLogout === 'function') { window.mvsIdleLogout(MSG); return; }
    var inApp = !!document.getElementById('vLogin') && !!document.getElementById('vHome');
    if (!inApp) location.href = '../#logout-idle';
  }
  window.mvsIdleMark = function () { mine = 0; mark(); };   // a fresh login starts a fresh hour
  ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, mark, { passive: true, capture: true });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  window.addEventListener('pageshow', check);
  setInterval(check, 60000);
  check();
})();
