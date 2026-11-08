// Mạng trước, hỏng mạng thì lấy bản đã lưu — mở được cả khi mất mạng, không bao giờ kẹt bản cũ khi có mạng.
const KHO = 'so-tiet-kiem-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const cungGoc = u.origin === location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!cungGoc && !font) return;   // API giá vàng, GitHub: luôn đi mạng
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const sao = r.clone(); caches.open(KHO).then((c) => c.put(e.request, sao)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
