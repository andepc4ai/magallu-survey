/* Quiet usage log: who opened which page, when, on what phone, and — only if the phone ALREADY allows
   location for this site — where. Never asks for permission itself, never blocks the page:
   it waits 3 s after the page is drawn, and sends at most once every 30 minutes per person per page.
   Rows land in the "Login Log" sheet; admins see them on the dashboard (👥 యాప్ వాడకం). */
(function(){
"use strict";
function devName(){
  var u = navigator.userAgent || '', m = u.match(/Android [\d.]+; ([^;)]+)/);
  if (m) return ('Android · ' + m[1].replace(/ Build.*$/, '')).slice(0, 60);
  if (/iPhone/.test(u)) return 'iPhone'; if (/iPad/.test(u)) return 'iPad';
  if (/Windows/.test(u)) return 'Windows PC'; if (/Mac/.test(u)) return 'Mac';
  return u.slice(0, 60);
}
// callFn(fnName, argsArray) -> Promise
window.logOpen = function(page, user, callFn){
  try {
    if (!user || !user.name || !user.pin || !callFn) return;
    var key = 'mvs_lo_' + page + '_' + user.name, last = Number(localStorage.getItem(key)) || 0;
    if (Date.now() - last < 30 * 60000) return;
    localStorage.setItem(key, String(Date.now()));
    var send = function(pos){
      var info = {page: page, dev: devName()};
      if (pos && pos.coords){ info.lat = +pos.coords.latitude.toFixed(5); info.lng = +pos.coords.longitude.toFixed(5); info.acc = Math.round(pos.coords.accuracy); }
      callFn('logOpen', [user.name, user.pin, info]).catch(function(){ try { localStorage.removeItem(key); } catch(e){} });
    };
    setTimeout(function(){
      if (navigator.permissions && navigator.permissions.query && navigator.geolocation){
        navigator.permissions.query({name:'geolocation'}).then(function(p){
          if (p.state === 'granted') navigator.geolocation.getCurrentPosition(send, function(){ send(null); }, {maximumAge:600000, timeout:8000});
          else send(null);
        }).catch(function(){ send(null); });
      } else send(null);
    }, 3000);
  } catch(e){}
};
// 28 Nov: Viewer logins — location is tracked. Asks the phone for permission, logs a row (with location) when the
// page opens and every 10 minutes while it is on screen; shows a red banner while location is blocked.
window.trackLoc = function(page, user, callFn){
  try {
    if (!user || !user.viewer || !user.name || !user.pin || !callFn || window.__trk) return;
    window.__trk = true;
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b91c1c;color:#fff;padding:10px 12px;font:600 15px sans-serif;text-align:center;display:none';
    bar.innerHTML = '📍 లొకేషన్ ఆన్ చేయండి — ఫోన్ సెట్టింగ్స్‌లో ఈ సైట్‌కు Location అనుమతించండి<br><small>Location is required for this login</small>';
    document.body.appendChild(bar);
    var send = function(pos, note){
      var info = {page: page + (note ? ' · ' + note : ' · track'), dev: devName()};
      if (pos && pos.coords){ info.lat = +pos.coords.latitude.toFixed(5); info.lng = +pos.coords.longitude.toFixed(5); info.acc = Math.round(pos.coords.accuracy); }
      callFn('logOpen', [user.name, user.pin, info]).catch(function(){});
    };
    var tick = function(){
      if (document.hidden) return;
      if (!navigator.geolocation){ bar.style.display = 'block'; send(null, 'no location'); return; }
      navigator.geolocation.getCurrentPosition(function(p){ bar.style.display = 'none'; send(p); },
        function(err){ bar.style.display = 'block'; send(null, err && err.code === 1 ? 'location blocked' : 'location failed'); },
        {enableHighAccuracy: true, maximumAge: 60000, timeout: 20000});
    };
    setTimeout(tick, 1500);
    setInterval(tick, 10 * 60000);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) tick(); });
  } catch(e){}
};
})();
