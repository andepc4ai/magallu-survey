/* Magallu family engine: builds family links from the voter roll.
 * Voter row: [epic, name, relType, relName, surname, house, booth, street, age, gender, support, visited]
 * overrides: { epic: { to: 'EPIC' | 'X:key' | 'none', ok: true, as: 'Father'|'Mother'|'Husband'|'Wife'|'Son'|'Daughter'|'Brother'|'Sister'|'Relative' } }
 * extras:    { epic: [ { to: 'EPIC', as: <same list>, slot: 'x1' } ] }  (more relations added by volunteers)
 */
var FamilyEngine = (function () {
  function canon(s) {
    s = String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ');
    s = s.replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/ou/g, 'u')
      .replace(/th/g, 't').replace(/dh/g, 'd').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/bh/g, 'b')
      .replace(/ph/g, 'p').replace(/sh/g, 's').replace(/ch/g, 'c').replace(/w/g, 'v').replace(/z/g, 'j')
      .replace(/y/g, 'i').replace(/([a-z])\1+/g, '$1');
    return s.replace(/\s+/g, ' ').trim();
  }
  // name without the surname, spaces removed, so "China Subba Rao" == "Chinasubbarao Gunti"
  function key(name, surname) {
    var sc = canon(surname), toks = canon(name).split(' ').filter(Boolean);
    var rest = sc ? toks.filter(function (t) { return t !== sc; }) : toks;
    var k = (rest.length ? rest : toks).join('');
    return k.replace(/(a|u)$/,'');   // venkaiah/venkaia, raju/raj
  }
  function editDist1(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return d + (a.length - i) + (b.length - j) <= 1;
  }

  // relation of p's relative r, as seen from p: Father/Mother/Husband/Wife/Other/Son/Daughter/Brother/Sister
  function linkRel(P, p, r, as) {
    if (!r || r.id === p.id) return;
    if (as === 'Father') { p.father = r.id; push(r.kids, p.id); }
    else if (as === 'Mother') { p.mother = r.id; push(r.kids, p.id); }
    else if (as === 'Husband' || as === 'Wife' || as === 'Other') { push(p.spouses, r.id); push(r.spouses, p.id); }
    else if (as === 'Son' || as === 'Daughter') { if (p.g === 'Female') { if (!r.mother) r.mother = p.id; } else if (!r.father) r.father = p.id; push(p.kids, r.id); }
    else if (as === 'Brother' || as === 'Sister') { push(p.sibs, r.id); push(r.sibs, p.id); }
    else { push(p.rels, r.id); push(r.rels, p.id); }                       // 'Relative': same family, no fixed place
  }
  function push(a, x) { if (a.indexOf(x) < 0) a.push(x); }

  function build(rows, overrides, extras) {
    overrides = overrides || {}; extras = extras || {};
    var P = {}, list = [];
    rows.forEach(function (r) {
      var p = { id: String(r[0]), name: r[1], rt: r[2], rn: String(r[3] || '').trim(), sur: String(r[4] || '').trim(),
        house: String(r[5] || ''), booth: ({207: 204, 208: 205, 209: 206})[r[6]] || r[6], street: r[7] || '', age: Number(r[8]) || 0, g: r[9],
        support: r[10] || '', visited: r[11] || '', caste: String(r[12] || ''), mobile: String(r[13] || ''), leader: String(r[14] || ''), fhead: String(r[15] || '') === 'Yes', gone: '', r26: '', vote: true };
      var rm = String(r[16] || '');   // removed in 2026: dead / duplicate lose the vote, others still vote on the 2025 list
      if (rm) { if (/expired/i.test(rm)) { p.gone = rm; p.vote = false; } else p.r26 = rm; }
      p.sc = canon(p.sur); p.k = key(p.name, p.sur); p.hk = p.booth + '|' + p.house + (r[17] ? '|' + r[17] : '');   // a split household is its own house
      P[p.id] = p; list.push(p);
    });
    // index by surname + name key
    var idx = {}, idxKey = {};
    list.forEach(function (p) {
      (idx[p.sc + '|' + p.k] = idx[p.sc + '|' + p.k] || []).push(p);
      (idxKey[p.k] = idxKey[p.k] || []).push(p);
    });
    function fits(p, c) {
      if (c.id === p.id) return false;
      if (p.rt === 'Husband') return c.g === 'Male' && (!p.age || !c.age || (c.age - p.age >= -12 && c.age - p.age <= 35));
      if (p.rt === 'Father') return c.g === 'Male' && (!p.age || !c.age || c.age - p.age >= 15);
      if (p.rt === 'Mother') return c.g === 'Female' && (!p.age || !c.age || c.age - p.age >= 15);
      if (p.rt === 'Other') return c.g !== p.g && c.hk === p.hk && (!p.age || !c.age || Math.abs(c.age - p.age) <= 25);
      return false;
    }
    function score(p, c) { return (c.hk === p.hk ? 5 : 0) + (c.street && c.street === p.street ? 2 : 0) + (c.booth === p.booth ? 1 : 0); }

    // 1) automatic matches
    var unmatched = [];
    list.forEach(function (p) {
      p.relKey = key(p.rn, p.sur);
      if (['Husband', 'Father', 'Mother', 'Other'].indexOf(p.rt) < 0 || !p.relKey) return;
      var cands = (idx[p.sc + '|' + p.relKey] || []).filter(function (c) { return fits(p, c); }), fuzzy = false;
      if (!cands.length) cands = (idxKey[p.relKey] || []).filter(function (c) { return fits(p, c) && c.hk === p.hk; });
      if (!cands.length && p.relKey.length >= 6) {
        cands = list.filter(function (c) { return c.sc === p.sc && fits(p, c) && editDist1(c.k, p.relKey); }); fuzzy = true;
      }
      if (!cands.length) { unmatched.push(p); return; }
      cands.sort(function (a, b) { return score(p, b) - score(p, a); });
      var top = cands[0], tie = cands[1] && score(p, cands[1]) === score(p, top);
      if (tie && score(p, top) < 5) { unmatched.push(p); p.ambiguous = cands.length; return; }
      p.rel = top.id;
      p.sure = score(p, top) >= 5 || (!fuzzy && cands.length === 1);
    });
    // 1b) a man gets only one auto-matched wife: the one in his house (others keep their own husband)
    var wivesOf = {};
    list.forEach(function (p) { if (p.rt === 'Husband' && p.rel) (wivesOf[p.rel] = wivesOf[p.rel] || []).push(p); });
    Object.keys(wivesOf).forEach(function (h) {
      var ws = wivesOf[h], H = P[h]; if (ws.length < 2) return;
      ws.sort(function (a, b) { return score(b, H) - score(a, H); });
      ws.slice(1).forEach(function (w) { if (score(w, H) >= 5 && score(ws[0], H) >= 5) return; w.rel = null; w.sure = false; unmatched.push(w); });
    });
    // 1c) a child whose matched father lives elsewhere, but whose mother (in the same house) names the same
    //     husband and was not matched -> the father is not on the roll; keep mother and children together
    list.forEach(function (c) {
      if (c.rt !== 'Father' || !c.rel || score(c, P[c.rel]) >= 5) return;
      var mom = list.filter(function (w) { return w.rt === 'Husband' && !w.rel && w.hk === c.hk && w.relKey === c.relKey; })[0];
      if (mom) { c.rel = null; c.sure = false; unmatched.push(c); }
    });
    // 2) relatives without a vote, shared by 2+ voters -> one "no vote" person
    var groups = {};
    unmatched.forEach(function (p) {
      if (p.rt === 'Other') return;
      var gk = p.sc + '|' + p.relKey + '|' + (p.rt === 'Mother' ? 'F' : 'M') + '|' + p.booth;
      (groups[gk] = groups[gk] || []).push(p);
    });
    Object.keys(groups).forEach(function (gk) {
      var g = groups[gk];
      if (g.length < 2) return;
      var id = 'X:' + gk;
      var x = { id: id, name: g[0].rn + (g[0].sur && canon(g[0].rn).indexOf(g[0].sc) < 0 ? ' ' + g[0].sur : ''), g: gk.split('|')[2] === 'F' ? 'Female' : 'Male',
        sur: g[0].sur, sc: g[0].sc, vote: false, house: '', booth: g[0].booth, street: g[0].street, age: 0 };
      P[id] = x;
      g.forEach(function (p) { p.rel = id; p.sure = true; });
    });
    // 3) manual corrections win
    Object.keys(overrides).forEach(function (id) {
      var p = P[id], o = overrides[id]; if (!p || !o) return;
      if (o.to === 'none') { p.rel = null; p.manual = true; }
      else if (o.to && P[o.to]) { p.rel = o.to; p.manual = true; p.sure = true; }
      if (o.as) p.as = o.as;
      if (o.ok) p.sure = true;
    });
    // 4) derive parents / spouse / children / siblings
    Object.keys(P).forEach(function (id) { var p = P[id]; p.kids = []; p.spouses = []; p.sibs = []; p.rels = []; p.father = p.mother = null; p.extra = []; });
    Object.keys(P).forEach(function (id) {
      var p = P[id], r = p.rel && P[p.rel]; if (!r) return;
      linkRel(P, p, r, p.as || p.rt);
    });
    Object.keys(extras).forEach(function (id) {
      var p = P[id]; if (!p) return;
      extras[id].forEach(function (x) { var r = P[x.to]; if (!r) return; linkRel(P, p, r, x.as); p.extra.push({ to: x.to, as: x.as, slot: x.slot }); });
    });
    // mother = father's only wife (when not given)
    Object.keys(P).forEach(function (id) {
      var p = P[id];
      if (p.father && !p.mother) { var f = P[p.father]; if (f.spouses.length === 1) { p.mother = f.spouses[0]; push(P[p.mother].kids, p.id); } }
    });
    // brothers / sisters share parents
    for (var pass = 0; pass < 2; pass++) Object.keys(P).forEach(function (id) {
      var p = P[id];
      p.sibs.forEach(function (sid) { var s = P[sid];
        if (p.father && !s.father) { s.father = p.father; push(P[p.father].kids, sid); }
        if (p.mother && !s.mother) { s.mother = p.mother; push(P[p.mother].kids, sid); }
      });
    });
    // 5) families = connected groups
    var fam = {}, fid = 0;
    Object.keys(P).forEach(function (id) {
      if (fam[id] !== undefined) return;
      var stack = [id]; fam[id] = fid;
      while (stack.length) {
        var c = P[stack.pop()];
        [c.father, c.mother].concat(c.spouses, c.kids, c.sibs, c.rels).forEach(function (n) { if (n && fam[n] === undefined) { fam[n] = fid; stack.push(n); } });
      }
      fid++;
    });
    var families = [];
    Object.keys(P).forEach(function (id) {
      var f = families[fam[id]] || (families[fam[id]] = { id: fam[id], members: [], voters: 0, houses: {}, support: {}, castes: {}, check: 0 });
      var p = P[id]; p.fam = fam[id]; f.members.push(id);
      if (p.vote) { f.voters++; f.houses[p.hk] = 1; f.support[p.support || '-'] = (f.support[p.support || '-'] || 0) + 1;
        if (p.caste) f.castes[p.caste] = (f.castes[p.caste] || 0) + 1;
        if (p.rel && !p.sure) f.check++; }
    });
    families.forEach(function (f) {
      f.houseCount = Object.keys(f.houses).length;
      f.caste = Object.keys(f.castes).sort(function (a, b) { return f.castes[b] - f.castes[a]; })[0] || '';
      // head: top generation, prefer male, then oldest; no-vote elders count
      var roots = f.members.map(function (id) { return P[id]; }).filter(function (p) { return !p.father && !p.mother && !(p.g === 'Female' && p.spouses.some(function (s) { return P[s].father || P[s].mother || P[s].g === 'Male'; })); });
      roots.sort(function (a, b) { return (b.g === 'Male') - (a.g === 'Male') || (b.kids.length - a.kids.length) || (b.age - a.age); });
      f.roots = roots.map(function (p) { return p.id; });
      f.head = f.roots[0] || f.members[0];
    });
    families.sort(function (a, b) { return b.voters - a.voters; });
    return { P: P, families: families, key: key, canon: canon };
  }
  return { build: build, key: key, canon: canon };
})();
if (typeof module !== 'undefined') module.exports = FamilyEngine;
