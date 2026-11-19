/* ↕️ Sort priority by tapping, the same control on every page (house list, drill list, families, castes, wards).
   Open the sort box → the 1st chip you tap becomes ①, the 2nd ②, the 3rd ③ (a 4th tap replaces ③).
   Tapping a chip that is already picked reverses it (▲ ↔ ▼). "↺ మళ్ళీ" starts over.
   Every time the sort box is opened again, the next tap starts a fresh order (① again).
   state = [{k:key, d:1|-1}, {k:'' | key, d}, {k:'' | key, d}]   (k '' = not used)
   fns   = {key: function(a,b){ ... }}   d = 1 is each key's natural order (e.g. most voters first, house no. 1→9, A→Z);
   last  = {key: function(x){ return 1 when x has no value }}   those rows stay at the bottom in both directions. */
var MultiSort = (function () {
  var css = '.msort{width:100%;flex:1 1 100%;margin:4px 0 10px}.msort .mchips{display:flex;flex-wrap:wrap;gap:8px}' +
    '.msc{min-height:44px;border:2px solid #e5dfd2;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-weight:600;font-size:.95rem;display:inline-flex;align-items:center;gap:6px}' +
    '.msc.on{background:#1c1917;border-color:#1c1917;color:#fff}.msn{width:22px;height:22px;border-radius:50%;background:#fde047;color:#1c1917;' +
    'display:inline-flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:800}.msud{display:inline-flex;flex-direction:column;line-height:.8;margin-left:2px}.msud i{font-style:normal;font-size:.62rem;padding:1px 4px;opacity:.4;cursor:pointer}.msud i.on{opacity:1;color:#fde047}' +
    '.msr0{border-style:dashed}.msl{font-size:.74rem;color:#78716c;margin-top:6px}';
  try { var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); } catch (e) {}
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(st, def) {
    var a = Array.isArray(st) ? st.slice(0, 3) : [];
    if (!a.length || !a[0] || !a[0].k) a[0] = { k: def, d: 1 };
    for (var i = 0; i < 3; i++) { var x = a[i] || {}; a[i] = { k: x.k || '', d: x.d === -1 ? -1 : 1 }; }
    return a;
  }
  function lab(opts, k) { var o = opts.filter(function (x) { return x[0] === k; })[0]; return o ? o[1] : k; }
  function html(st, opts) {
    return '<div class="msort"><div class="mchips">' + opts.map(function (o) {
      var i = -1; for (var j = 0; j < 3; j++) if (st[j].k === o[0]) i = j;
      return '<button type="button" class="msc' + (i >= 0 ? ' on' : '') + '" data-msc="' + esc(o[0]) + '">' +
        (i >= 0 ? '<b class="msn">' + (i + 1) + '</b>' : '') + esc(o[1]) + (i >= 0 ? '<span class="msud"><i data-msdir="1" class="' + (st[i].d === 1 ? 'on' : '') + '">▲</i><i data-msdir="-1" class="' + (st[i].d === -1 ? 'on' : '') + '">▼</i></span>' : '') + '</button>';
    }).join('') + (st[1].k || st[0].d !== 1 ? '<button type="button" class="msc msr0" data-msr="1">↺ మళ్ళీ</button>' : '') + '</div>' +
      '<div class="msl">నొక్కిన క్రమంలో ① ② ③ · ▲ ▼ తో తిప్పండి</div></div>';
  }
  function summary(st, opts) {
    return st.filter(function (s) { return s.k; }).map(function (s, i) { return '①②③'.charAt(i) + ' ' + lab(opts, s.k) + (s.d === 1 ? '' : ' ▼'); }).join(' → ');
  }
  function cmp(st, fns, tie, last) {
    var use = st.filter(function (s) { return s.k && fns[s.k]; });
    return function (a, b) {
      for (var i = 0; i < use.length; i++) {
        var k = use[i].k;
        if (last && last[k]) { var n = last[k](a) - last[k](b); if (n) return n; }
        var c = fns[k](a, b) * use[i].d; if (c) return c;
      }
      return tie ? tie(a, b) : 0;
    };
  }
  /* el: the container holding html(); get(): current state; after(state): save + redraw.
     el.msFresh = true means "the next tap starts a new order"; it is set again whenever the box is hidden. */
  function bind(el, get, after) {
    el.msFresh = true;
    try { new MutationObserver(function () { if (el.classList.contains('hide')) el.msFresh = true; }).observe(el, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    el.addEventListener('click', function (e) {
      var r = e.target.closest && e.target.closest('[data-msr]'), b = e.target.closest && e.target.closest('[data-msc]');
      var st = get(), ud = e.target.closest && e.target.closest('[data-msdir]');
      if (ud && b){ for (var q = 0; q < 3; q++) if (st[q].k === b.dataset.msc) st[q].d = Number(ud.dataset.msdir); el.msFresh = false; after(st); return; }   // small ▲ / ▼
      if (r) { el.msFresh = true; after([{ k: st[0].k, d: 1 }, { k: '', d: 1 }, { k: '', d: 1 }]); return; }
      if (!b) return;
      var k = b.dataset.msc, i = -1; for (var j = 0; j < 3; j++) if (st[j].k === k) i = j;
      if (el.msFresh) { el.msFresh = false; st = [{ k: k, d: 1 }, { k: '', d: 1 }, { k: '', d: 1 }]; }   // first tap → ①
      else if (i >= 0) st[i].d = -st[i].d;                                                             // picked again → reverse
      else { var n = 0; while (n < 3 && st[n].k) n++; st[Math.min(n, 2)] = { k: k, d: 1 }; }           // next free place (4th replaces ③)
      after(st);
    });
  }
  return { norm: norm, html: html, summary: summary, cmp: cmp, bind: bind };
})();
