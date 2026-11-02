/* Appetite for Contraction — offline shell.
 *
 * The point: the exercise photos and the catalog are precached, so a workout
 * works in a basement with no signal. Results queue in localStorage (see
 * src/lib/offline.ts) and post themselves when the network returns.
 */
const VERSION = 'afc-v2';
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

const PRECACHE = [
  '/',
  '/exercises',
  '/billboard',
  '/api/catalog.json',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Exercise photos and icons never change under a given name — cache first,
  // and keep them, because they're the thing you need when offline.
  if (url.pathname.startsWith('/ex/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(event, request));
    return;
  }

  event.respondWith(networkFirst(event, request, url));
});

async function cacheFirst(event, request) {
  const hit = await caches.match(request);
  if (hit) return hit;

  const res = await fetch(request);
  if (res.ok) {
    // waitUntil, not a floating promise: without it the worker can be killed
    // before the write lands and nothing is ever actually cached.
    const copy = res.clone();
    event.waitUntil(caches.open(MEDIA).then((c) => c.put(request, copy)));
  }
  return res;
}

async function networkFirst(event, request, url) {
  try {
    const res = await fetch(request);
    if (res.ok && (url.pathname === '/api/catalog.json' || request.mode === 'navigate')) {
      const copy = res.clone();
      event.waitUntil(caches.open(SHELL).then((c) => c.put(request, copy)));
    }
    return res;
  } catch {
    const hit = await caches.match(request);
    if (hit) return hit;
    if (request.mode === 'navigate') return (await caches.match('/')) ?? Response.error();
    return Response.error();
  }
}
