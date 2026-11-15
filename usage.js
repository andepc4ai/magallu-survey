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
})();
