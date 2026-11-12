/* Forgiving search for Magallu pages: spelling variants, joined/split names, 1-2 typos, Telugu input. */
var Fuzzy = (function () {
  var V = {'అ':'a','ఆ':'a','ఇ':'i','ఈ':'i','ఉ':'u','ఊ':'u','ఋ':'ru','ఎ':'e','ఏ':'e','ఐ':'ai','ఒ':'o','ఓ':'o','ఔ':'au'};
  var C = {'క':'k','ఖ':'k','గ':'g','ఘ':'g','ఙ':'n','చ':'c','ఛ':'c','జ':'j','ఝ':'j','ఞ':'n','ట':'t','ఠ':'t','డ':'d','ఢ':'d','ణ':'n',
    'త':'t','థ':'t','ద':'d','ధ':'d','న':'n','ప':'p','ఫ':'p','బ':'b','భ':'b','మ':'m','య':'y','ర':'r','ఱ':'r','ల':'l','ళ':'l',
    'వ':'v','శ':'s','ష':'s','స':'s','హ':'h'};
  var M = {'ా':'a','ి':'i','ీ':'i','ు':'u','ూ':'u','ృ':'ru','ె':'e','ే':'e','ై':'ai','ొ':'o','ో':'o','ౌ':'au'};
  function teToLat(s) {
    var out = '', i, ch, nx;
    for (i = 0; i < s.length; i++) {
      ch = s[i]; nx = s[i + 1];
      if (C[ch]) { out += C[ch]; if (M[nx]) { out += M[nx]; i++; } else if (nx === '్') { i++; } else out += 'a'; }
      else if (V[ch]) out += V[ch];
      else if (ch === 'ం') out += 'n';
      else if (ch === 'ః') out += 'h';
      else if (M[ch]) out += M[ch];
      else out += ch;
    }
    return out;
  }
  function canon(s) {
    s = teToLat(String(s || '')).toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    s = s.replace(/x/g, 'ks').replace(/q/g, 'k').replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/ou/g, 'u')
      .replace(/th/g, 't').replace(/dh/g, 'd').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/bh/g, 'b')
      .replace(/ph/g, 'p').replace(/sh/g, 's').replace(/ch/g, 'c').replace(/w/g, 'v').replace(/z/g, 'j')
      .replace(/y/g, 'i').replace(/([a-z])\1+/g, '$1')
      .replace(/aia/g, 'ai').replace(/ia\b/g, 'i');           // ramaiah / ramayya -> ramai
    return s.replace(/\s+/g, ' ').trim();
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  // prepare the query once
  function query(q) {
    var c = canon(q);
    return { raw: String(q || '').trim().toLowerCase(), c: c, toks: c.split(' ').filter(Boolean), joined: c.replace(/ /g, '') };
  }
  // score text against a prepared query: 0 = no match, higher = nearer
  //   exact word 10 > word starts with 7 > inside a word 4 > 1 typo 3 > 2 typos 2; closer length scores higher
  function score(text, Q) {
    if (!Q.toks.length) return 1;
    var t = canon(text), tt = t.split(' ').filter(Boolean), tj = t.replace(/ /g, ''), total = 0, used = {};
    if (t === Q.c) total += 30;                                                // whole text is the query
    else if (String(text).toLowerCase().indexOf(Q.raw) >= 0) total += 8;     // typed exactly as written
    if (Q.joined.length >= 3 && tj.indexOf(Q.joined) >= 0) total += 4;       // joined / split names
    for (var i = 0; i < Q.toks.length; i++) {
      var q = Q.toks[i], best = 0, bk = -1;
      for (var k = 0; k < tt.length; k++) {
        var w = tt[k], sc = 0;
        if (w === q) sc = 10;
        else if (w.indexOf(q) === 0) sc = 7 - Math.min(3, (w.length - q.length) / 2);
        else if (q.length >= 3 && w.indexOf(q) > 0) sc = 4 - Math.min(2, (w.length - q.length) / 4);
        else if (q.length >= 4) {
          var max = q.length >= 8 ? 2 : 1, d = lev(q, w, max), dp = lev(q, w.slice(0, q.length), max);
          if (d <= max) sc = d === 1 ? 3.5 : 2.5;
          else if (dp <= max) sc = dp === 1 ? 2.5 : 1.5;
        }
        if (sc && used[k]) sc -= 1;                                           // same word reused
        if (k === i && sc) sc += 0.5;                                        // same word order
        if (sc > best) { best = sc; bk = k; }
      }
      if (!best && Q.joined.length >= 3 && tj.indexOf(q) >= 0) best = 3;
      if (!best && q.length >= 6) {                                           // typo inside joined names
        var mx = q.length >= 8 ? 2 : 1;
        for (var L = q.length - mx; L <= q.length + mx && !best; L++)
          for (var s = 0; s + L <= tj.length && !best; s++) if (lev(q, tj.substr(s, L), mx) <= mx) best = 1;
      }
      if (best <= 0) return 0;
      if (bk >= 0) used[bk] = 1;
      total += best;
    }
    total -= Math.min(3, Math.max(0, tt.length - Q.toks.length) * 0.5);     // fewer extra words = nearer
    return Math.max(0.1, total);
  }
  return { query: query, score: score, canon: canon, teToLat: teToLat };
})();
if (typeof module !== 'undefined') module.exports = Fuzzy;
