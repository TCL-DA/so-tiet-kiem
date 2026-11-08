// Trời đêm vẽ bằng canvas (thay ảnh chụp mây của style Air): sao lấp lánh, mây trôi, sao băng,
// nghiêng theo chuột, trôi theo cuộn, vệt sao theo con trỏ. Chỉ dùng màu phẳng — không gradient.
import { fx } from './effects.js';

let cv, ctx, W = 0, H = 0, dpr = 1;
let sao = [], may = null, sb = null, sbHen = 0, vet = [];
let mx = 0, my = 0, tmx = 0, tmy = 0, cuon = 0;
let chay = false, an = false;

function nhieu(w, h, oGoc, seed) {
  // Nhiễu giá trị tuần hoàn theo chiều ngang (lát liền được) + fBm 5 tầng
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const luoi = (n) => { const g = []; for (let i = 0; i < n * n; i++) g.push(rnd()); return g; };
  const tang = [oGoc, oGoc * 2, oGoc * 4, oGoc * 8, oGoc * 16].map((n) => ({ n, g: luoi(n) }));
  const muot = (t) => t * t * (3 - 2 * t);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0, bien = 0.5, tong = 0;
      for (const { n, g } of tang) {
        const fx_ = (x / w) * n, fy = (y / h) * n * (h / w) * 2;
        const x0 = Math.floor(fx_), y0 = Math.floor(fy), tx = muot(fx_ - x0), ty = muot(fy - y0);
        const a = g[(y0 % n) * n + (x0 % n)], b = g[(y0 % n) * n + ((x0 + 1) % n)];
        const c = g[((y0 + 1) % n) * n + (x0 % n)], d = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
        v += bien * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
        tong += bien; bien *= 0.5;
      }
      out[y * w + x] = v / tong;
    }
  }
  return out;
}

function taoMay() {
  const w = 320, h = 160, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  const n = nhieu(w, h, 3, 20261108);
  for (let i = 0; i < n.length; i++) {
    const y = Math.floor(i / w) / h;
    const bo = Math.min(1, y * 3) * Math.min(1, (1 - y) * 2.2);   // mờ ở mép trên/dưới cho liền
    const a = Math.max(0, (n[i] - 0.48) * 2.6) * bo;
    img.data[i * 4] = 66; img.data[i * 4 + 1] = 97; img.data[i * 4 + 2] = 136;
    img.data[i * 4 + 3] = Math.min(255, a * 150);
  }
  g.putImageData(img, 0, 0);
  return c;
}

function taoSao() {
  const n = Math.min(320, Math.round((W * H) / 6500));
  sao = Array.from({ length: n }, () => ({
    x: Math.random(), y: Math.random() * 1.5, r: Math.random() ** 2.2 * 1.5 + 0.25,
    p: Math.random() * Math.PI * 2, t: 0.6 + Math.random() * 1.8, z: 0.3 + Math.random() * 0.7,
  }));
}

function doiCo() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  taoSao();
  ve(performance.now());
}

function mauNen() {
  if (!fx('gio-troi')) return '#000000';
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 4.8 && h < 6.6) return '#070b14';     // rạng sáng
  if (h >= 17.2 && h < 18.8) return '#0b0812';   // hoàng hôn
  return '#000000';
}

function ve(t) {
  ctx.fillStyle = mauNen();
  ctx.fillRect(0, 0, W, H);
  if (fx('parallax-chuot')) { mx += (tmx - mx) * 0.04; my += (tmy - my) * 0.04; } else { mx = my = 0; }
  const lech = fx('parallax-cuon') ? cuon : 0;

  // Sao
  ctx.fillStyle = '#ffffff';
  const nhap = fx('sao');
  for (const s of sao) {
    let y = (s.y * H - lech * 0.06 * s.z) % (H * 1.5);
    if (y < 0) y += H * 1.5;
    if (y > H) continue;
    const x = s.x * W + mx * 14 * s.z;
    ctx.globalAlpha = nhap ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.t + s.p)) * s.z : 0.75 * s.z;
    ctx.beginPath(); ctx.arc(x, y + my * 10 * s.z, s.r, 0, 6.2832); ctx.fill();
  }

  // Mây (2 lớp, lát ngang liền mạch)
  if (fx('may')) {
    may ||= taoMay();
    const ve1 = (toc, ty, cao, alpha, dichChuot) => {
      const rong = W * 1.6, h = H * cao;
      let x = (-(t / 1000) * toc - lech * 0.02 + mx * dichChuot) % rong;
      if (x > 0) x -= rong;
      const y = H * ty - lech * 0.12 + my * dichChuot;
      ctx.globalAlpha = alpha;
      ctx.drawImage(may, x, y, rong, h);
      ctx.drawImage(may, x + rong, y, rong, h);
    };
    ve1(6, 0.18, 0.75, 0.55, 22);
    ve1(11, 0.46, 0.6, 0.32, 40);
  }

  // Sao băng
  if (fx('saobang')) {
    if (!sb && t > sbHen) {
      const goc = Math.PI * (0.16 + Math.random() * 0.1);
      sb = { x: W * (0.15 + Math.random() * 0.7), y: H * Math.random() * 0.35, vx: Math.cos(goc) * 13, vy: Math.sin(goc) * 13, song: 0, dai: 60 };
    }
    if (sb) {
      sb.song++; sb.x += sb.vx; sb.y += sb.vy;
      const doan = 14;
      for (let i = 0; i < doan; i++) {
        const k = i / doan;
        ctx.globalAlpha = (1 - k) * Math.min(1, (sb.dai - sb.song) / 20) * 0.9;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(sb.x - sb.vx * k * 6, sb.y - sb.vy * k * 6);
        ctx.lineTo(sb.x - sb.vx * (k + 1 / doan) * 6, sb.y - sb.vy * (k + 1 / doan) * 6);
        ctx.stroke();
      }
      if (sb.song > sb.dai || sb.x > W + 100 || sb.y > H) { sb = null; sbHen = t + 5000 + Math.random() * 9000; }
    }
  }

  // Vệt sao theo con trỏ
  if (vet.length) {
    vet = vet.filter((p) => p.song > 0);
    for (const p of vet) {
      p.song -= 1; p.y += p.vy; p.x += p.vx;
      ctx.globalAlpha = p.song / 50;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.song / 50), 0, 6.2832); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function vong(t) {
  if (!chay) return;
  if (!an) ve(t);
  requestAnimationFrame(vong);
}

const conDong = () => fx('sao') || fx('may') || fx('saobang') || fx('parallax-chuot') || vet.length;

/** Bật trời đêm trên canvas #troi. Gọi lại `capNhatTroi()` khi đổi cài đặt hiệu ứng. */
export function batTroi(canvas) {
  cv = canvas; ctx = cv.getContext('2d', { alpha: false });
  doiCo();
  let hen;
  addEventListener('resize', () => { clearTimeout(hen); hen = setTimeout(doiCo, 150); });
  addEventListener('scroll', () => { cuon = scrollY; if (!chay) ve(performance.now()); }, { passive: true });
  addEventListener('pointermove', (e) => {
    tmx = e.clientX / W - 0.5; tmy = e.clientY / H - 0.5;
    if (fx('duoi-sao') && e.pointerType === 'mouse' && scrollY < H * 0.8 && !document.querySelector('.ngan.mo, .khoa:not([hidden])')) {
      if (vet.length < 60) vet.push({ x: e.clientX, y: e.clientY, r: 1 + Math.random() * 1.4, vx: (Math.random() - 0.5) * 0.6, vy: 0.3 + Math.random() * 0.6, song: 50 });
      if (!chay) capNhatTroi();
    }
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { an = document.hidden; });
  capNhatTroi();
}

export function capNhatTroi() {
  if (!cv) return;
  const can = conDong();
  if (can && !chay) { chay = true; requestAnimationFrame(vong); }
  if (!can) { chay = false; ve(performance.now()); }
}
