/* Clipper service worker — lets the Home Screen app open with no network.
   Cache-first for the page itself (and refreshed in the background). The app's own
   live-version probe (?u=…) is passed straight to the network, and an update load
   (?v=…) is fetched fresh and replaces the cached copy. Everything else is untouched. */
const CACHE = 'clipper-page-v1';
const PAGE = new URL(new URL(self.location.href).searchParams.get('p') || './', self.location.href);
const pageKey = PAGE.origin + PAGE.pathname;
const isPage = (u) => { const b = u.origin + u.pathname; return b === pageKey || b === pageKey + 'index.html' || b + 'index.html' === pageKey || b === pageKey.replace(/\/index\.html$/, '/'); };

self.addEventListener('install', (e) => {
  e.waitUntil((async () => { try { const c = await caches.open(CACHE); const r = await fetch(pageKey, { cache: 'reload' }); if (r.ok) await c.put(pageKey, r.clone()); } catch {} await self.skipWaiting(); })());
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (!isPage(u) || u.searchParams.has('u')) return;                       // not the page, or the live-version probe: network, untouched
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (u.searchParams.has('v')) {                                         // an update load: fresh copy, then remember it
      try { const r = await fetch(e.request, { cache: 'reload' }); if (r.ok) await c.put(pageKey, r.clone()); return r; }
      catch { const hit = await c.match(pageKey); if (hit) return hit; throw new Error('offline'); }
    }
    const hit = await c.match(pageKey);
    const net = fetch(e.request).then((r) => { if (r && r.ok) c.put(pageKey, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net; if (r) return r;
    return new Response('Clipper is offline and not cached yet. Open it once while online.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
