const V = 'price-lookup-v4';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'prices.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(u.pathname.endsWith('prices.json') ? netFirst(r) : swr(e, r));
});

// Prices: always try the network first so devices get new data, fall back to the last copy offline.
async function netFirst(r) {
  const c = await caches.open(V);
  try {
    const x = await fetch(r, { cache: 'no-store' });
    if (x.ok) c.put(r, x.clone());
    return x;
  } catch (_) {
    return (await c.match(r)) || new Response('{}', { status: 503 });
  }
}

// App files: serve instantly from cache and refresh in the background.
async function swr(e, r) {
  const c = await caches.open(V);
  const hit = (await c.match(r, { ignoreSearch: true })) || (r.mode === 'navigate' ? await c.match('index.html') : null);
  const net = fetch(r).then(x => { if (x.ok) c.put(r, x.clone()); return x; }).catch(() => null);
  e.waitUntil(net);
  return hit || (await net) || new Response('offline', { status: 503 });
}
