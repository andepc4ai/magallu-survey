/* Shared voter survey — ONE list of questions and ONE compact editor, used by the house screen (index.html)
   and the families page (family/index.html). Answers go to the same sheet columns from both places.

   To add a question later:
     1. add an entry to Survey.Q below (k = field name the server knows),
     2. server/Code.gs: add the sheet column to FIELD_TO_HEADER and send it in getVoters (row slot),
     3. index.html toObj() + family survey row mapping: read that slot into v[k].
   Both screens then show it automatically.

   Types: seg  = a few big choices in one row (support)
          one  = pick one chip (tap again to clear)
          many = tick several chips (+ optional status per ticked item)
          phone / text = typed value with a ✓ save button */
(function(){
"use strict";
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

var CASTE_TE = {Vaddera:'వడ్డెర',Yadav:'యాదవ్',Rajaka:'రజక',Brahmin:'బ్రాహ్మణ',Kummari:'కుమ్మరి',Vysya:'వైశ్యులు',Mala:'మాల',
  Muslim:'ముస్లిం',Madiga:'మాదిగ','Nayee Brahmin':'నాయి బ్రాహ్మణ',ST:'ఎస్టీ',Padmashali:'పద్మశాలి',Gouds:'గౌడ్స్',
  Vadrangi:'వడ్రంగి',Kamma:'కమ్మ',Kapu:'కాపు',Others:'ఇతరులు'};
var OCC_TE = {Farmer:'🌾 రైతు','Agri Labour':'వ్యవసాయ కూలీ','Daily Wage':'రోజు కూలీ',Business:'🏪 వ్యాపారం','Govt Job':'ప్రభుత్వ ఉద్యోగం',
  'Private Job':'ప్రైవేట్ ఉద్యోగం',Student:'🎓 విద్యార్థి',Homemaker:'🏠 గృహిణి',Retired:'రిటైర్డ్',Unemployed:'నిరుద్యోగి',
  'Abroad / Outside':'✈️ బయట ఊరు',Other:'ఇతర'};
var ISS = [['Water','💧 నీరు'],['Road','🛣️ రోడ్డు'],['Drainage','🚰 డ్రైనేజీ'],['Pensions','👵 పింఛన్'],['Govt Schemes','📋 పథకాలు'],['Other','➕ ఇతర']];
var IST = [['Open','తెరిచి','#d97706'],['In Progress','పనిలో','#2563eb'],['Solved','పూర్తి ✓','#15803d']];

var Q = [
  {k:'support', te:'మద్దతు', en:'Support', type:'seg',
   opts:[['Strong','పూర్తి మద్దతు','#15803d'],['Leaning','మొగ్గు','#65a30d'],['Undecided','తేల్చలేదు','#ea580c'],['Opposed','వ్యతిరేకం','#b91c1c']]},
  // can this person come and vote on 29 Nov? (separate from support: a strong supporter may live far away)
  {k:'avail', te:'ఓటు వేయగలరా?', en:'Can vote', type:'seg',
   opts:[['Yes','✅ వస్తారు','#15803d'],['Far','🚌 దూరం · రప్పించాలి','#2563eb'],['No','❌ రాలేరు','#57534e'],
         ['Expired','మరణించారు · Expired','#78716c']]},   // Expired = grey everywhere, out of every count
  {k:'caste', icon:'🏷', te:'కులం', en:'Caste', type:'one', list:'castes', te_map:CASTE_TE, empty:'నమోదు కాలేదు'},
  {k:'mobile', icon:'📱', te:'మొబైల్', en:'Mobile', type:'phone', empty:'నంబర్ లేదు'},
  {k:'issue', icon:'⚠️', te:'సమస్యలు', en:'Needs', type:'many', opts:ISS, status:'issueStatus', empty:'లేవు'},
  {k:'occupation', icon:'💼', te:'వృత్తి', en:'Occupation', type:'one', list:'occupations', te_map:OCC_TE, empty:'—'},
  {k:'notes', icon:'📝', te:'వివరాలు', en:'Notes', type:'text', empty:'—'},
  // 25 Nov: contributions the voter / family gives to the campaign (shown only when ui.contrib — the 💰 list)
  {k:'tc', icon:'💰', te:'TC Amount', en:'TC', type:'num', money:true, contrib:true, empty:'₹ —'},
  {k:'c', icon:'💰', te:'C Amount', en:'C', type:'num', money:true, contrib:true, empty:'₹ —'},
  {k:'cppl', icon:'👥', te:'ఎంత మంది', en:'People', type:'num', max:99, contrib:true, empty:'—'},
  {k:'cfor', icon:'🧾', te:'దేనికి', en:'For what', type:'text', ph:'ఉదా: పోస్టర్లు, మీటింగ్', contrib:true, empty:'—'}
];
function rupees(n){ n=Number(n)||0; return '₹ '+n.toLocaleString('en-IN'); }

function optsOf(q, ui){
  if (q.opts) return q.opts;
  var l = (ui.lists && ui.lists[q.list]) || Object.keys(q.te_map||{});
  return l.map(function(o){ return [o, (q.te_map&&q.te_map[o])||o]; });
}
function many(v, k){ return String(v[k]||'').split(',').map(function(x){ return x.trim(); }).filter(Boolean); }
function stMap(v, k){ var o={}; String(v[k]||'').split(';').forEach(function(x){ var p=x.split(':'); if (p.length===2) o[p[0].trim()]=p[1].trim(); }); return o; }
function label(q, val){ var o=(q.opts||[]).filter(function(x){ return x[0]===val; })[0]; return o ? o[1] : ((q.te_map&&q.te_map[val])||val); }

function valueHtml(q, v){
  var x = v[q.k];
  if (q.type==='many'){ var a=many(v,q.k); if (!a.length) return ''; var sm=q.status?stMap(v,q.status):{};
    return a.map(function(i){ var s=sm[i]||'Open', st=IST.filter(function(t){ return t[0]===s; })[0]; return esc(label(q,i))+(q.status&&st?' <i class="svst" style="color:'+st[2]+'">'+st[1]+'</i>':''); }).join(', '); }
  if (!x) return '';
  if (q.type==='text') return esc(String(x).length>36?String(x).slice(0,36)+'…':x);
  if (q.type==='phone') return '<span style="letter-spacing:.03em">'+esc(x)+'</span>';
  if (q.type==='num') return q.money ? '<b>'+rupees(x)+'</b>' : '<b>'+esc(x)+'</b> మంది';
  return esc(label(q, x));
}

// the whole survey for one voter. ui = {open:'caste'|'', lists:{castes,occupations}, hint:{caste:'Kamma'}, ro:false}
function render(v, ui, id){
  ui = ui || {};
  var h = '<div class="sv" data-svid="'+esc(id)+'">';
  var QQ = ui.contrib ? Q.filter(function(q){ return q.contrib; }).concat(Q.filter(function(q){ return q.k==='mobile'; }), Q.filter(function(q){ return !q.contrib && q.k!=='mobile'; })) : Q;   // 💰 list: contribution + phone first
  QQ.forEach(function(q){
    if (q.contrib && !ui.contrib) return;
    if (q.k==='tc') h += '<div class="svch">💰 విరాళం <small>Contribution</small></div>'+(ui.cnote||'');
    if (ui.contrib && q.k==='support') h += '<button class="svmore" data-svmore="1">📝 సర్వే <small>మద్దతు, కులం, సమస్యలు… · Survey</small><span>'+(ui.more?'▴ మూసివేయి':'▾ తెరవండి')+'</span></button>';
    if (ui.contrib && !ui.more && !q.contrib && q.k!=='mobile') return;   // 💰 screen stays short: rest of the survey folded
    if (q.type==='seg'){
      h += '<div class="svq"><span class="svk">'+q.te+'</span><div class="seg" style="grid-template-columns:repeat('+q.opts.length+',1fr)">'+q.opts.map(function(o){
        return '<button class="sg'+(v[q.k]===o[0]?' on':'')+'" style="--c:'+o[2]+'" data-svf="'+q.k+'" data-svv="'+esc(o[0])+'">'+o[1]+'</button>'; }).join('')+'</div></div>';
      return;
    }
    var open = ui.open===q.k, val = valueHtml(q, v);
    h += '<button class="svr'+(open?' open':'')+(val?'':' empty')+'" data-svo="'+q.k+'"><span class="svk">'+(q.icon||'')+' '+q.te+'</span>'+
      '<span class="svv">'+(val||'<span class="svph">'+q.empty+'</span>')+'</span><span class="svc">'+(open?'▴':(val?'✎':'＋'))+'</span></button>';
    if (q.type==='phone' && v[q.k] && !open) h += '<a class="svcall" href="tel:'+esc(v[q.k])+'">📞 కాల్ చేయండి</a>';
    if (!open) return;
    h += '<div class="sved">';
    if (q.type==='one'){
      var hint = ui.hint && ui.hint[q.k];
      if (hint && !v[q.k]) h += '<button class="ch hint" data-svf="'+q.k+'" data-svv="'+esc(hint)+'">💡 '+esc(label(q,hint))+'</button>';
      h += optsOf(q, ui).map(function(o){ return '<button class="ch'+(v[q.k]===o[0]?' on':'')+'" data-svf="'+q.k+'" data-svv="'+esc(o[0])+'">'+esc(o[1])+'</button>'; }).join('');
    } else if (q.type==='many'){
      var cur = many(v, q.k), sm = q.status ? stMap(v, q.status) : {};
      h += optsOf(q, ui).map(function(o){ return '<button class="ch'+(cur.indexOf(o[0])>=0?' on':'')+'" data-svm="'+q.k+'" data-svv="'+esc(o[0])+'">'+esc(o[1])+'</button>'; }).join('');
      if (q.status && cur.length) h += '<div class="svsts">'+cur.map(function(i){ var s=sm[i]||'Open';
        return '<div class="svstr"><span>'+esc(label(q,i))+'</span>'+IST.map(function(t){ return '<button class="stb'+(s===t[0]?' on':'')+'" style="--c:'+t[2]+'" data-svs="'+q.k+'" data-svi="'+esc(i)+'" data-svv="'+t[0]+'">'+t[1]+'</button>'; }).join('')+'</div>'; }).join('')+'</div>';
      h += '<button class="svok" data-svo="'+q.k+'">✓ అయింది</button>';
    } else if (q.type==='phone'){
      h += '<div class="svin"><input data-svin="'+q.k+'" type="tel" inputmode="numeric" maxlength="14" placeholder="10 అంకెలు" value="'+esc(v[q.k]||'')+'"><button class="svok" data-svsave="'+q.k+'">✓ సేవ్</button></div><div class="svmsg" data-svmsg="'+q.k+'"></div>';
    } else if (q.type==='num'){
      h += '<div class="svin"><input data-svin="'+q.k+'" type="tel" inputmode="numeric" maxlength="'+(q.money?9:2)+'" placeholder="'+(q.money?'₹ మొత్తం · Amount':'మంది · People')+'" value="'+esc(v[q.k]||'')+'"><button class="svok" data-svsave="'+q.k+'">✓ సేవ్</button></div><div class="svmsg" data-svmsg="'+q.k+'"></div>';
    } else if (q.type==='text'){
      h += '<div class="svin"><textarea data-svin="'+q.k+'" rows="2" placeholder="'+esc(q.ph||'ఉదా: హైదరాబాద్‌లో పని చేస్తున్నారు')+'">'+esc(v[q.k]||'')+'</textarea><button class="svok" data-svsave="'+q.k+'">✓ సేవ్</button></div>';
    }
    h += '</div>';
  });
  return h + '</div>';
}

// handle a tap inside a survey. edit(fields) saves; returns true when the survey should be drawn again
function click(e, v, ui, edit){
  var t;
  if (e.target.closest('[data-svmore]')){ ui.more = !ui.more; ui.open=''; return true; }
  if ((t = e.target.closest('[data-svo]'))){ var k=t.dataset.svo; if (ui.ro && ui.open!==k){ edit(null); return false; } ui.open = ui.open===k ? '' : k; return true; }
  if ((t = e.target.closest('[data-svf]'))){
    var f={}, k2=t.dataset.svf, val=t.dataset.svv; f[k2] = v[k2]===val ? '' : val;
    if (f[k2] && !v.visited) f.visited='Visited';      // answering for someone never met counts as a visit
    if (edit(f)===false) return true;
    var q = Q.filter(function(x){ return x.k===k2; })[0]; if (q && q.type==='one') ui.open='';
    return true;
  }
  if ((t = e.target.closest('[data-svm]'))){
    var k3=t.dataset.svm, cur=many(v,k3), i=cur.indexOf(t.dataset.svv);
    if (i>=0) cur.splice(i,1); else cur.push(t.dataset.svv);
    var f3={}; f3[k3]=cur.join(', '); if (cur.length && !v.visited) f3.visited='Visited'; edit(f3); return true;
  }
  if ((t = e.target.closest('[data-svs]'))){
    var q4 = Q.filter(function(x){ return x.k===t.dataset.svs; })[0], sm = stMap(v, q4.status); sm[t.dataset.svi] = t.dataset.svv;
    var f4={}; f4[q4.status] = many(v, q4.k).map(function(x){ return x+':'+(sm[x]||'Open'); }).join(';'); edit(f4); return true;
  }
  if ((t = e.target.closest('[data-svsave]'))){
    var k5=t.dataset.svsave, root=t.closest('.sv'), inp=root.querySelector('[data-svin="'+k5+'"]'), val5=inp?inp.value.trim():'';
    if (k5==='mobile'){ val5=val5.replace(/\D/g,''); if (val5 && val5.length!==10){ var m=root.querySelector('[data-svmsg="mobile"]'); if (m) m.textContent='⚠️ 10 అంకెలు ఉండాలి · 10 digits'; return false; } }
    var q5 = Q.filter(function(x){ return x.k===k5; })[0];
    if (q5 && q5.type==='num'){ val5=val5.replace(/\D/g,'').replace(/^0+(?=\d)/,''); if (q5.max && Number(val5)>q5.max){ var m5=root.querySelector('[data-svmsg="'+k5+'"]'); if (m5) m5.textContent='⚠️ 1–'+q5.max; return false; } if (k5==='cppl' && val5==='0') val5=''; }
    if (String(v[k5]||'')!==val5){ var f5={}; f5[k5]=val5; edit(f5); }
    ui.open=''; return true;
  }
  return false;
}

// one line under a name: ● support · caste · 📞
function summary(v){
  var s = Q[0].opts.filter(function(o){ return o[0]===v.support; })[0];
  return (s ? '<i class="svdot" style="background:'+s[2]+'"></i>'+s[1] : '<i class="svdot"></i>మద్దతు ?') +
    (v.avail==='Far' ? ' · 🚌 దూరం' : v.avail==='No' ? ' · ❌ రాలేరు' : v.avail==='Expired' ? ' · మరణించారు' : '') +
    (v.caste ? ' · '+esc(CASTE_TE[v.caste]||v.caste) : '') + (v.mobile ? ' · 📞 '+esc(v.mobile) : '');
}

var css = '.sv{margin-top:6px}'+
'.svq{display:flex;align-items:center;gap:8px;margin:6px 0}.svk{flex:none;font-weight:700;font-size:.85rem;color:#44403c;min-width:84px}'+
'.svq .svk{min-width:0;width:70px;font-size:.8rem;white-space:normal;line-height:1.2}'+   /* question in 2 lines (ఓటు / వేయగలరా?) so the 4 answer boxes get the room */
'.seg{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:4px}'+
'.sg{min-height:48px;border:2px solid #e7e5e4;background:#fff;border-radius:10px;font-size:.78rem;font-weight:700;line-height:1.15;padding:2px;color:#44403c}'+
'.sg.on{background:var(--c);border-color:var(--c);color:#fff}'+
'.svr{display:flex;align-items:center;gap:8px;width:100%;min-height:42px;border:0;border-top:1px solid #f0ebe1;background:none;text-align:left;padding:6px 2px;font:inherit;color:inherit;cursor:pointer}'+
'.svr .svv{flex:1;min-width:0;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.svph{color:#a8a29e;font-size:.82rem}'+
'.svr .svc{flex:none;width:26px;height:26px;border-radius:50%;background:#f5f5f4;display:flex;align-items:center;justify-content:center;font-size:.8rem;color:#57534e}'+
'.svr.open{background:#fefce8}.svr.open .svc{background:#FACC15;color:#1c1917}'+
'.svcall{display:inline-block;margin:0 0 6px 92px;background:#dcfce7;color:#166534;border-radius:999px;padding:3px 10px;font-size:.8rem;font-weight:700;text-decoration:none}'+
'.sved{display:flex;flex-wrap:wrap;gap:5px;padding:6px 0 10px;background:#fefce8;border-radius:0 0 10px 10px}'+
'.ch{border:1.5px solid #e7e5e4;background:#fff;border-radius:999px;padding:5px 11px;font-size:.84rem;font-weight:700;color:#292524}'+
'.ch.on{background:#1c1917;border-color:#1c1917;color:#FACC15}.ch.hint{border-color:#ca8a04;background:#fef9c3}'+
'.svsts{width:100%;display:flex;flex-direction:column;gap:4px;margin-top:2px}.svstr{display:flex;align-items:center;gap:4px;font-size:.8rem}.svstr span{flex:1;font-weight:700}'+
'.stb{border:1.5px solid #e7e5e4;background:#fff;border-radius:8px;padding:3px 7px;font-size:.74rem;font-weight:700}.stb.on{background:var(--c);border-color:var(--c);color:#fff}'+
'.svst{font-style:normal;font-size:.75rem;font-weight:700}'+
'.svin{display:flex;gap:6px;width:100%}.svin input,.svin textarea{flex:1;min-width:0;border:2px solid #e7e5e4;border-radius:10px;padding:8px 10px;font:inherit;font-size:1rem;background:#fff}'+
'.svok{flex:none;border:0;border-radius:10px;background:#1c1917;color:#FACC15;font-weight:700;padding:0 14px;min-height:40px}'+
'.sved>.svok{margin-left:auto}.svmsg{width:100%;font-size:.8rem;color:#b91c1c}'+
'.svch{margin:12px 0 2px;padding:6px 8px;border-radius:10px;background:#fef9c3;font-weight:800;font-size:.9rem;color:#713f12}.svch small{font-weight:600;color:#a16207;margin-left:4px}'+
'.svmore{display:flex;align-items:center;gap:6px;width:100%;margin:12px 0 2px;padding:10px 10px;border:2px solid #e7e5e4;border-radius:10px;background:#fafaf9;font:inherit;font-weight:800;font-size:.9rem;color:#44403c;text-align:left}'+
'.svmore small{flex:1;font-weight:600;color:#78716c;font-size:.75rem}.svmore span{font-size:.8rem;color:#57534e}'+
'.svdot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#cbd5e1;margin-right:4px;vertical-align:0}';
if (typeof document!=='undefined'){ var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st); }

window.Survey = {Q:Q, render:render, click:click, summary:summary, rupees:rupees, CASTE_TE:CASTE_TE, OCC_TE:OCC_TE, ISS:ISS};
})();
