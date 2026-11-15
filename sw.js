// Keeps the app's own files on the phone so it opens with no internet. No data passes through here.
const CACHE = `app:${self.registration.scope}`;
const HOME = self.registration.scope;
// The app's big files come from a faster host (it serves them straight from the GitHub repo).
const FILES = 'https://cdn.jsdelivr.net/gh/Arjunsingh-Rajpurohit/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !(req.url.startsWith(HOME) || req.url.startsWith(FILES))) return;
  if (req.mode === 'navigate') {
    // Always the newest page when online; the kept one when not.
    e.respondWith(fetch(HOME, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(HOME, copy));
      }
      return res;
    }).catch(() => caches.match(HOME)));
    return;
  }
  // The app's files carry their version in their name, so a kept one is never stale.
  e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
