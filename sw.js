// Keeps the app's own files on the phone, so it opens at once and works with no internet.
// No data passes through here.
const CACHE = `app:${self.registration.scope}`;
const HOME = self.registration.scope;
// The app's big files come from a faster host (it serves them straight from the GitHub repo).
const FILES = 'https://cdn.jsdelivr.net/gh/Arjunsingh-Rajpurohit/';

const keep = async (key, res) => {
  if (res.ok) (await caches.open(CACHE)).put(key, res.clone());
  return res;
};

/** The page, then every file it names — so the second visit needs no network at all. */
async function fill() {
  const res = await fetch(HOME, { cache: 'no-cache' });
  if (!res.ok) return;
  const html = await res.clone().text();
  const cache = await caches.open(CACHE);
  const old = await cache.match(HOME);
  const changed = !old || (await old.text()) !== html;
  await cache.put(HOME, res);
  if (!changed) return;
  const urls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png|webmanifest))"/g)].map((m) => new URL(m[1], HOME).href);
  // The screens and forms not opened yet are listed in files.json, so they work offline too.
  const main = urls.find((u) => /\/main-[^/]+\.js$/.test(u));
  const rest = main ? await fetch(`${HOME}files.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []) : [];
  for (const name of rest) urls.push(new URL(name, main).href);
  await Promise.all([...new Set(urls)].map(async (url) => {
    if (!(await cache.match(url))) await fetch(url).then((r) => keep(url, r)).catch(() => undefined);
  }));
  // Files of older versions are no longer named by the page: let them go.
  const named = new Set([HOME, ...urls]);
  for (const req of await cache.keys()) {
    if (req.url.startsWith(FILES) && !named.has(req.url) && !html.includes(req.url.split('@')[1]?.split('/')[0] ?? '\0')) cache.delete(req);
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(fill().catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !(req.url.startsWith(HOME) || req.url.startsWith(FILES))) return;
  if (req.mode === 'navigate') {
    // The kept page at once; the newest one is fetched behind it for the next visit.
    e.respondWith(caches.match(HOME).then((hit) => {
      const fresh = fill().catch(() => undefined);
      if (hit) {
        e.waitUntil(fresh);
        return hit;
      }
      return fresh.then(() => caches.match(HOME)).then((r) => r ?? fetch(HOME));
    }));
    return;
  }
  // The app's files carry their version in their name, so a kept one is never stale.
  e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then((res) => keep(req, res))));
});
