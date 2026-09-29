// Offline cache. Game code (html/js/json) is network-first so updates arrive right away;
// heavy files (model, textures, fonts, three.js) are cache-first.
const CACHE = 'daggie-v3';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.searchParams.has('check')) return;
  const heavy = /\.(bin|jpe?g|png|webp|woff2?|ttf)$/i.test(u.pathname) || /jsdelivr|gstatic|googleapis/.test(u.hostname);
  e.respondWith(heavy ? cacheFirst(req) : networkFirst(req));
});
async function cacheFirst(req) {
  const c = await caches.open(CACHE), hit = await c.match(req); if (hit) return hit;
  const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res;
}
async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
  catch (e) { const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit; throw e; }
}
