// Service Worker لـ PWA + Web Push
// بوت كلية الصماد للقرآن الكريم
const CACHE_NAME = 'samad-bot-v3';
const APP_SHELL = [
  '/admin',
  '/static/admin.js',
  '/static/admin-extra.js',
  '/static/admin-texts.js',
  '/static/styles.css',
  '/manifest.json',
  '/static/icon.svg',
  '/static/icon-72.png',
  '/static/icon-96.png',
  '/static/icon-144.png',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/icon-maskable-192.png',
  '/static/icon-maskable-512.png',
  '/static/apple-touch-icon.png',
  '/static/favicon-16.png',
  '/static/favicon-32.png',
  '/static/favicon-64.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL).catch(() => null))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// استراتيجية: Network-first للـ API، Cache-first لباقي الموارد
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/admin/api') || url.pathname.startsWith('/webhook')) return;
  if (url.pathname.startsWith('/static/') || url.pathname === '/manifest.json' || url.pathname === '/sw.js' || url.pathname === '/admin') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fresh = fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone).catch(() => {}));
          }
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});

// استقبال إشعار Web Push
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (_) {
    data = { title: 'إشعار', body: event.data?.text() || '' };
  }
  const title = data.title || 'بوت الصماد';
  const options = {
    body: data.body || '',
    icon: data.icon || '/static/icon-192.png',
    badge: data.badge || '/static/icon-192.png',
    tag: data.tag || 'samad-bot',
    data: data.data || { url: data.url || '/admin' },
    requireInteraction: !!data.requireInteraction,
    dir: 'rtl',
    lang: 'ar',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// رسائل من الصفحة
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
