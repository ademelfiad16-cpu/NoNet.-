const CACHE = 'p2p-group-v22';
const ASSETS = ['./', './index.html', './manifest.json', './icon-512.png'];
const LIB = 'https://esm.sh/trystero@0.21.6/nostr';

// تحميل المكتبة وكل ما تستورده وحفظها للعمل بدون نت
async function prefetch(c, url, seen, depth){
  if (seen.has(url) || depth > 6) return;
  seen.add(url);
  try{
    const res = await fetch(url);
    if (!res.ok) return;
    await c.put(url, res.clone());
    const txt = await res.text();
    const re = /(?:from|import)\s*["']([^"']+)["']|import\(["']([^"']+)["']\)/g; let m;
    while ((m = re.exec(txt))){
      const p = m[1] || m[2];
      if (p.startsWith('/') || p.startsWith('https://esm.sh/')) await prefetch(c, new URL(p, url).href, seen, depth + 1);
    }
  }catch(e){}
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(ASSETS);
    await prefetch(c, LIB, new Set(), 0);
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (!url.startsWith('http')) return;
  e.respondWith(
    caches.match(e.request, {ignoreVary: true, ignoreSearch: e.request.mode === 'navigate'}).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && (url.startsWith(self.location.origin) || url.includes('esm.sh'))){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    })
  );
});
