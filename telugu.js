/* Magallu: English voter names -> Telugu script, on the phone (nothing is sent anywhere).
 * Surnames come from family/te_surnames.json (checked list); other words are converted by sound rules.
 * TeName.full('Shiva Rani Cherukumalli') -> 'శివ రాణి చెరుకుమల్లి'   TeName.ready(fn) runs fn once surnames load. */
var TeName = (function () {
  var SUR = {}, cache = {}, waiting = [], loaded = false;
  // common name words written the usual Telugu way
  var WORDS = { rao: 'రావు', reddy: 'రెడ్డి', reddi: 'రెడ్డి', sri: 'శ్రీ', shri: 'శ్రీ', lakshmi: 'లక్ష్మి', laxmi: 'లక్ష్మి',
    venkata: 'వెంకట', venkat: 'వెంకట్', srinivasa: 'శ్రీనివాస', srinivas: 'శ్రీనివాస్', narayana: 'నారాయణ', ramana: 'రమణ',
    rama: 'రామ', ram: 'రామ్', krishna: 'కృష్ణ', kumar: 'కుమార్', kumari: 'కుమారి', devi: 'దేవి', rani: 'రాణి', bai: 'బాయి',
    babu: 'బాబు', naidu: 'నాయుడు', chowdary: 'చౌదరి', chowdhary: 'చౌదరి', prasad: 'ప్రసాద్', raju: 'రాజు', venkateswara: 'వెంకటేశ్వర',
    venkateswarlu: 'వెంకటేశ్వర్లు', subba: 'సుబ్బ', subbamma: 'సుబ్బమ్మ', mohammad: 'మహమ్మద్', mohammed: 'మహమ్మద్', md: 'ఎండి',
    begum: 'బేగం', bee: 'బీ', bi: 'బీ', shaik: 'షేక్', sheik: 'షేక్', shek: 'షేక్', khan: 'ఖాన్', jyothi: 'జ్యోతి', satya: 'సత్య',
    sathya: 'సత్య', durga: 'దుర్గ', siva: 'శివ', shiva: 'శివ', nagaraju: 'నాగరాజు', naga: 'నాగ', anjaneyulu: 'ఆంజనేయులు',
    ramesh: 'రమేష్', suresh: 'సురేష్', mahesh: 'మహేష్', ganesh: 'గణేష్', rajesh: 'రాజేష్', naresh: 'నరేష్', srinu: 'శ్రీను', sai: 'సాయి', sesha: 'శేష', seshagiri: 'శేషగిరి', tirupati: 'తిరుపతి', tirupathi: 'తిరుపతి', ratnam: 'రత్నం',
    ratna: 'రత్న', siva: 'శివ', goud: 'గౌడ్', gowd: 'గౌడ్', rajyam: 'రాజ్యం', narayan: 'నారాయణ్', john: 'జాన్', william: 'విలియం' };
  var PRE = ['lakshmi', 'venkata', 'venkateswara', 'srinivasa', 'naga', 'sri', 'rama', 'siva', 'shiva', 'sesha', 'seshagiri', 'tirupati', 'satya', 'durga', 'subba', 'krishna', 'narayana', 'rajya', 'ratna'].sort(function (a, b) { return b.length - a.length; });
  var V = { a: ['అ', ''], aa: ['ఆ', 'ా'], i: ['ఇ', 'ి'], ee: ['ఈ', 'ీ'], ii: ['ఈ', 'ీ'], u: ['ఉ', 'ు'], oo: ['ఊ', 'ూ'],
    e: ['ఏ', 'ే'], ou: ['ఔ', 'ౌ'], ai: ['ఐ', 'ై'], ay: ['ఐ', 'ై'], o: ['ఓ', 'ో'], au: ['ఔ', 'ౌ'], ow: ['ఔ', 'ౌ'], ru: ['ఋ', 'ృ'] };
  var C = [['ksh', 'క్ష'], ['cch', 'చ్చ'], ['chh', 'ఛ'], ['sh', 'ష'], ['ch', 'చ'], ['th', 'త'], ['dh', 'ధ'], ['bh', 'భ'], ['gh', 'ఘ'], ['kh', 'ఖ'],
    ['ph', 'ఫ'], ['jh', 'ఝ'], ['k', 'క'], ['g', 'గ'], ['c', 'క'], ['j', 'జ'], ['t', 'త'], ['d', 'ద'], ['n', 'న'], ['p', 'ప'],
    ['b', 'బ'], ['m', 'మ'], ['y', 'య'], ['r', 'ర'], ['l', 'ల'], ['v', 'వ'], ['w', 'వ'], ['s', 'స'], ['h', 'హ'], ['f', 'ఫ'],
    ['z', 'జ'], ['q', 'క'], ['x', 'క్స']];
  var VL = ['aa', 'ee', 'ii', 'oo', 'ai', 'au', 'ou', 'ow', 'a', 'i', 'u', 'e', 'o'];
  var VIR = '్';
  function word(w) {
    var lw = String(w || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!lw) return String(w || '');
    if (WORDS[lw]) return WORDS[lw];
    var key = lw.charAt(0).toUpperCase() + lw.slice(1);
    if (SUR[key]) return SUR[key];
    if (cache[lw]) return cache[lw];
    var pre;                                                               // Lakshmirajyam -> లక్ష్మి + రాజ్యం
    for (var q = 0; q < PRE.length; q++) if (lw.indexOf(PRE[q]) === 0 && lw.length - PRE[q].length >= 3) { pre = PRE[q]; break; }
    if (pre) return (cache[lw] = WORDS[pre] + word(lw.slice(pre.length)));
    if (/.{2,}rao$/.test(lw)) return (cache[lw] = word(lw.slice(0, -3)) + 'రావు');       // Seshagirirao -> శేషగిరిరావు
    if (/[a-z]{2,}aiah$|[a-z]{2,}ayya$/.test(lw)) return (cache[lw] = word(lw.replace(/(aiah|ayya)$/, '')).replace(/్$/, '') + 'య్య');   // Pullaiah -> పుల్లయ్య
    var out = '', i = 0, prevCons = false, n = lw.length;
    while (i < n) {
      var m = null, k;
      for (k = 0; k < VL.length; k++) if (lw.substr(i, VL[k].length) === VL[k]) { m = VL[k]; break; }
      if (m) {
        var vv = V[m];
        if (m === 'e' && i === n - 1 && prevCons) vv = ['ఎ', 'ె'];       // final -e is short: Kotte -> కొట్టె
        if (m === 'o' && prevCons && lw.substr(i + 1, 2).length === 2 && /^(tt|dd|ll|nn|mm|kk|pp)/.test(lw.substr(i + 1, 2))) vv = ['ఒ', 'ొ'];
        if (m === 'e' && prevCons && /^(tt|dd|ll|nn|mm|kk|pp|nk|nd|nt)/.test(lw.substr(i + 1, 2))) vv = ['ఎ', 'ె'];
        out += prevCons ? vv[1] : vv[0];
        prevCons = false; i += m.length; continue;
      }
      var c = null;
      for (k = 0; k < C.length; k++) if (lw.substr(i, C[k][0].length) === C[k][0]) { c = C[k]; break; }
      if (!c) { i++; continue; }
      var t = c[1], rest = lw.slice(i + c[0].length);
      if (c[0] === 'sh' && i === 0) t = 'శ';
      if (c[0] === 's' && i === 0 && rest.charAt(0) === 'r') t = 'శ';      // Sreekanth -> శ్రీకాంత్                                // Shiva / Seshagiri start with శ
      if (c[0] === 'n' && /^[kgcjtdpb]/.test(rest) && !/^(th|dh)/.test(rest.slice(0, 2)) && i > 0) { out += (prevCons ? '' : '') + 'ం'; prevCons = false; i += 1; continue; }
      if (c[0] === 'm' && /^[pb]/.test(rest) && i > 0) { out += 'ం'; prevCons = false; i += 1; continue; }
      if (c[0] === 'n' && /^th/.test(rest) && i > 0) { out += 'ం'; prevCons = false; i += 1; continue; }
      if (c[0] === 'y' && i === n - 1 && prevCons) { out += 'ి'; prevCons = false; i++; continue; }   // Durisetty -> దురిసెట్టి
      if (c[0] === 'm' && i === n - 1 && !prevCons && i > 0) { out += 'ం'; i++; continue; }          // Rajyam -> రాజ్యం
      if (c[0] === 't' && (rest.charAt(0) === 't' || (prevCons && out.slice(-1) === 'ట'))) t = 'ట';  // Kotte, Setti -> ట్ట
      if (prevCons) out += VIR;                                              // consonant cluster
      if (c[0] === 'd' && rest.charAt(0) === 'd' && /^(re|di|dy|da|du)/.test(rest.slice(1))) t = 'డ';
      if (c[0] === 'd' && prevCons && out.slice(-2) === 'డ' + VIR) t = 'డ';
      out += t; prevCons = true; i += c[0].length;
    }
    if (prevCons) out += VIR;
    cache[lw] = out;
    return out;
  }
  function full(name) {
    return String(name || '').trim().split(/\s+/).map(word).join(' ');
  }
  function ready(fn) { if (loaded) fn(); else waiting.push(fn); }
  // load the checked surname list next to this script (works from / and from /family/, /wards/)
  try {
    var src = (document.currentScript && document.currentScript.src) || '';
    var base = src ? src.replace(/[^/]*$/, '') : '';
    fetch(base + 'family/te_surnames.json').then(function (r) { return r.json(); }).then(function (j) {
      SUR = j || {}; cache = {}; loaded = true; waiting.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
    }).catch(function () { loaded = true; waiting.splice(0).forEach(function (f) { try { f(); } catch (e) {} }); });
  } catch (e) { loaded = true; }
  return { word: word, full: full, ready: ready, sur: function () { return SUR; } };
})();
if (typeof module !== 'undefined') module.exports = TeName;
