const CACHE_VERSION='moneylog-cache-2.5.1';
const CORE=['./','./index.html','./demo.html','./manifest.json','./version.json','./assets/styles.css','./assets/app.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_VERSION);
  await Promise.all(CORE.map(url=>cache.add(new Request(url,{cache:'reload'}))));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET')return;
  if(url.pathname.endsWith('/version.json')){event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match('./version.json')));return;}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok&&url.origin===location.origin){const clone=response.clone();caches.open(CACHE_VERSION).then(c=>c.put(event.request,clone)).catch(()=>{});}
    return response;
  }).catch(()=>caches.match('./index.html'))));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus'in client)return client.focus();}if(clients.openWindow)return clients.openWindow('./');}));});
self.addEventListener('periodicsync',event=>{if(event.tag!=='moneylog-daily-reminder')return;event.waitUntil((async()=>{
  try{
    const d=await new Promise((resolve,reject)=>{const req=indexedDB.open('moneylog-secure-v2',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const p=await new Promise((resolve,reject)=>{const r=d.transaction('publicPrefs','readonly').objectStore('publicPrefs').get('reminder');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    if(!p?.enabled)return;const now=new Date();const [h,m]=String(p.time||'20:30').split(':').map(Number);const mins=now.getHours()*60+now.getMinutes();if(mins<h*60+m)return;
    const today=new Date().toISOString().slice(0,10);if(p.lastReminderDate===today)return;
    await self.registration.showNotification('MONEYLOG reminder',{body:'A quiet minute for today’s money log.',icon:'./assets/icon.svg',tag:'moneylog-daily-reminder',data:{url:'./'}});
    await new Promise((resolve,reject)=>{const r=d.transaction('publicPrefs','readwrite').objectStore('publicPrefs').put({...p,key:'reminder',lastReminderDate:today});r.onsuccess=resolve;r.onerror=reject;});
  }catch{}
})());});
