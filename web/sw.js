const C="tpn-v4",SHELL=["./","index.html","style.css","model.js","live.js","app.js","manifest.json","icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET")return;
 if(u.origin!==location.origin){ // fotky hráčů: cache-first; ostatní živá data vždy ze sítě
  if(/\/team\/\d+\/image/.test(u.pathname))e.respondWith(caches.open(C+"-img").then(async c=>(await c.match(e.request))||fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r})));return}
 if(/\/data\/.+\.json$/.test(u.pathname)){ // data modelu: stale-while-revalidate – okamžitý start z cache, na pozadí aktualizace
  e.respondWith(caches.open(C).then(async c=>{const hit=await c.match(e.request);const net=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>hit);return hit||net}));return}
 e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});
