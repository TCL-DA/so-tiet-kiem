// Mạng trước (luôn hỏi lại máy chủ — không dùng bản đệm cũ của trình duyệt), mất mạng mới lấy bản đã lưu.
const KHO = 'so-tiet-kiem-v2';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ds) => Promise.all(ds.filter((k) => k !== KHO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const cungGoc = u.origin === location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!cungGoc && !font) return;   // API giá vàng, GitHub: luôn đi mạng, không đụng tới
  const req = cungGoc
    ? (e.request.mode === 'navigate' ? new Request(u.href, { cache: 'no-cache' }) : new Request(e.request, { cache: 'no-cache' }))
    : e.request;
  e.respondWith(fetch(req).then((r) => {
    if (r.ok) { const sao = r.clone(); caches.open(KHO).then((c) => c.put(e.request, sao)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
