/*
 * Space Insulation offline support.
 *
 * - App files (hashed JS/CSS in /assets) are kept after the first visit, so the
 *   app opens with weak or no signal.
 * - Pages always try the network first and fall back to the saved app.
 * - A few read-only lists the crew needs on site (their jobs, the customers on
 *   them, their clock-ins) are saved each time they load and used only when
 *   the network fails. Sign-in requests and anything that changes data are
 *   never saved.
 * - The app asks this worker to clear saved data when someone signs out.
 */

const VERSION = 'v1';
const APP_CACHE = `si-app-${VERSION}`;
const DATA_CACHE = `si-data-${VERSION}`;
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/logo-mark.png', '/favicon.png'];

// Read-only tables the crew screens use; only GET requests for these are saved.
const OFFLINE_TABLES = ['jobs', 'job_crew', 'customers', 'profiles', 'time_entries', 'time_breaks'];
const NETWORK_TIMEOUT_MS = 6000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('si-') && k !== APP_CACHE && k !== DATA_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_DATA') {
    event.waitUntil(caches.delete(DATA_CACHE));
  }
});

/**
 * Network first. If the network is slow (over NETWORK_TIMEOUT_MS) and a saved
 * copy exists, show the saved copy; with no saved copy, keep waiting for the
 * network. If the network fails outright, use the saved copy when there is one.
 */
const networkThenSaved = (network, getSaved) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (!settled) {
        settled = true;
        fn(value);
      }
    };
    const timer = setTimeout(async () => {
      const saved = await getSaved();
      if (saved) finish(resolve, saved);
    }, NETWORK_TIMEOUT_MS);
    network.then(
      res => {
        clearTimeout(timer);
        finish(resolve, res);
      },
      async err => {
        clearTimeout(timer);
        const saved = await getSaved();
        if (saved) finish(resolve, saved);
        else finish(reject, err);
      },
    );
  });

const isOfflineData = url => {
  const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
  return !!m && OFFLINE_TABLES.includes(m[1]);
};

// Saved responses are keyed without the auth header, so drop anything sensitive from the key.
const dataKey = request => new Request(request.url, { method: 'GET' });

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never touch sign-in, storage uploads, functions or realtime.
  if (/\/(auth|storage|functions|realtime)\/v1\//.test(url.pathname)) return;

  // Crew data from the database: network first, saved copy if the network fails.
  if (url.pathname.includes('/rest/v1/')) {
    if (!isOfflineData(url) || request.headers.get('Accept')?.includes('vnd.pgrst.object')) return;
    const network = fetch(request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(DATA_CACHE).then(c => c.put(dataKey(request), copy));
      }
      return res;
    });
    event.respondWith(networkThenSaved(network, () => caches.match(dataKey(request), { cacheName: DATA_CACHE })));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Opening a page: try the network, fall back to the saved app.
  if (request.mode === 'navigate') {
    const network = fetch(request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(APP_CACHE).then(c => c.put('/index.html', copy));
      }
      return res;
    });
    event.respondWith(
      networkThenSaved(network, async () => (await caches.match('/index.html')) || (await caches.match('/'))).catch(() => Response.error()),
    );
    return;
  }

  // Hashed app files never change: use the saved copy, otherwise download and save it.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        hit =>
          hit ||
          fetch(request).then(res => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(APP_CACHE).then(c => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Images and other files: show the saved copy straight away and refresh it in the background.
  event.respondWith(
    caches.match(request).then(hit => {
      const network = fetch(request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(APP_CACHE).then(c => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
