// Offline cache. Game code (html/js/json) is network-first so updates arrive right away;
// heavy files (model, textures, fonts, three.js) are cache-first.
const CACHE = 'daggie-v3.2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.searchParams.has('check')) return;
  const heavy = /\.(bin|glb|hdr|jpe?g|png|webp|woff2?|ttf)$/i.test(u.pathname) || /jsdelivr|gstatic|googleapis/.test(u.hostname);
  e.respondWith(heavy ? cacheFirst(req) : networkFirst(req));
});
async function cacheFirst(req) {
  const c = await caches.open(CACHE), hit = await c.match(req); if (hit) return hit;
  const res = await fetchRetry(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res;
}
async function fetchRetry(req) { // a dropped mobile connection: try again twice, then answer 504 (the game falls back) instead of throwing into the page
  for (let i = 0; i < 3; i++) { try { return await fetch(req); } catch (e) { await new Promise(r => setTimeout(r, 600 * (i + 1))); } }
  return new Response('', { status: 504, statusText: 'offline' });
}
async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try { const res = await fetch(req.mode === 'navigate' ? req.url : req, req.mode === 'navigate' ? { cache: 'no-cache' } : undefined); if (res.ok) c.put(req, res.clone()); return res; }
  catch (e) { const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit; if (req.mode === 'navigate') throw e; return new Response('', { status: 504, statusText: 'offline' }); }
}
