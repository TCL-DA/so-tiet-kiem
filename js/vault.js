// Két sắt: mã hoá AES-GCM 256. Khoá dẫn từ mật khẩu bằng Argon2id (64 MB, 4 vòng — tốn bộ nhớ nên
// máy dò mật khẩu chạy rất chậm); bản cũ dùng PBKDF2-SHA256 vẫn mở được.
// Lưu trên máy (localStorage); "nhớ máy này" = khoá không xuất được, cất trong IndexedDB.

const LS_BLOB = 'stk.blob';
const LS_CU = 'stk.blob.cu';
const ARGON = { m: 65536, t: 4, p: 1 };
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const taoMuoi = () => b64(crypto.getRandomValues(new Uint8Array(16)));

let hwPromise = null;
function napArgon() {
  if (window.hashwasm?.argon2id) return Promise.resolve(window.hashwasm);
  hwPromise ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'lib/argon2.umd.min.js';
    s.onload = () => res(window.hashwasm);
    s.onerror = () => { hwPromise = null; rej(new Error('Không tải được bộ mã hoá — kiểm tra mạng rồi thử lại.')); };
    document.head.appendChild(s);
  });
  return hwPromise;
}

// Argon2id chạy trong Worker (tốn ~1 s CPU) để trang không khựng khi đang gõ mật khẩu.
let worker = null, soLuot = 0;
const choKq = new Map();
function layWorker() {
  if (worker !== null) return worker;
  try {
    const thuVien = new URL('lib/argon2.umd.min.js', location.href).href;
    const ma = `importScripts(${JSON.stringify(thuVien)});
self.onmessage = async (e) => {
  const d = e.data;
  try {
    const raw = await self.hashwasm.argon2id({ password: d.mk, salt: new Uint8Array(d.salt), parallelism: d.p, iterations: d.t, memorySize: d.m, hashLength: 32, outputType: 'binary' });
    self.postMessage({ id: d.id, raw: raw.buffer }, [raw.buffer]);
  } catch (er) { self.postMessage({ id: d.id, loi: String(er && er.message || er) }); }
};`;
    worker = new Worker(URL.createObjectURL(new Blob([ma], { type: 'text/javascript' })));
    worker.onmessage = (e) => {
      const c = choKq.get(e.data.id);
      if (!c) return;
      choKq.delete(e.data.id);
      if (e.data.loi) c.rej(new Error(e.data.loi)); else c.res(new Uint8Array(e.data.raw));
    };
    worker.onerror = () => { worker = false; choKq.forEach((c) => c.rej(new Error('worker'))); choKq.clear(); };
  } catch { worker = false; }
  return worker;
}
/** Dựng sẵn Worker (nạp thư viện trước) để lượt thử mật khẩu đầu tiên không phải chờ. */
export const lamNong = () => { layWorker(); };
function argonTrongWorker(mk, th) {
  const w = layWorker();
  if (!w) return Promise.reject(new Error('worker'));
  const id = ++soLuot;
  return new Promise((res, rej) => {
    choKq.set(id, { res, rej });
    w.postMessage({ id, mk, salt: [...unb64(th.salt)], m: th.m, t: th.t, p: th.p });
  });
}

/** Tham số dẫn khoá cho một sổ mới. */
export const thamMoi = () => ({ kdf: 'argon2id', salt: taoMuoi(), ...ARGON });

/** Rút tham số dẫn khoá từ một bản mã hoá (mới hoặc cũ). */
export const thamCua = (blob) => (blob.kdf === 'argon2id'
  ? { kdf: 'argon2id', salt: blob.salt, m: blob.m, t: blob.t, p: blob.p }
  : { kdf: 'PBKDF2-SHA256', salt: blob.salt, iter: blob.iter || 310_000 });

/** Dẫn khoá AES từ mật khẩu + tham số (nhận cả bản mã hoá làm tham số). */
export async function danKhoa(matKhau, tham) {
  const th = tham.ct ? thamCua(tham) : tham;
  if (th.kdf === 'argon2id') {
    let raw;
    try { raw = await argonTrongWorker(matKhau, th); } catch {
      // Trình duyệt không cho Worker → tính ngay trên trang (vẫn đúng, chỉ khựng ~1 s)
      const hw = await napArgon();
      raw = await hw.argon2id({
        password: matKhau, salt: unb64(th.salt), parallelism: th.p, iterations: th.t,
        memorySize: th.m, hashLength: 32, outputType: 'binary',
      });
    }
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const goc = await crypto.subtle.importKey('raw', enc.encode(matKhau), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(th.salt), iterations: th.iter },
    goc, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function maHoa(obj, khoa, tham) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, khoa, enc.encode(JSON.stringify(obj)));
  return { v: 2, alg: 'AES-GCM-256', ...tham, iv: b64(iv), ct: b64(ct), luc: Date.now() };
}

/** Giải mã; sai mật khẩu thì ném lỗi. */
export async function giaiMa(blob, khoa) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, khoa, unb64(blob.ct));
  return JSON.parse(dec.decode(pt));
}

export function docMay() {
  try { const s = localStorage.getItem(LS_BLOB); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function ghiMay(blob) {
  try { localStorage.setItem(LS_BLOB, JSON.stringify(blob)); return true; } catch { return false; }
}
export function xoaMay() { try { localStorage.removeItem(LS_BLOB); } catch { /* bỏ qua */ } }
/** Cất bản trên máy sang chỗ dự phòng trước khi thay bằng bản trên web. */
export function catDuPhong() {
  try { const s = localStorage.getItem(LS_BLOB); if (s) localStorage.setItem(LS_CU, s); } catch { /* bỏ qua */ }
}

// ── IndexedDB: nhớ khoá trên máy này ──
function moDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('so-tiet-kiem', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('k');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb(mode, fn) {
  const db = await moDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('k', mode);
    const req = fn(tx.objectStore('k'));
    tx.oncomplete = () => { db.close(); res(req?.result); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}

export async function nhoKhoa(khoa, muoi, ngay = 30) {
  try { await idb('readwrite', (s) => s.put({ khoa, muoi, het: Date.now() + ngay * 864e5 }, 'khoa')); } catch { /* trình duyệt chặn thì thôi */ }
}
export async function layKhoaDaNho() {
  try {
    const v = await idb('readonly', (s) => s.get('khoa'));
    if (!v || v.het < Date.now()) return null;
    return v;
  } catch { return null; }
}
export async function quenKhoa() {
  try { await idb('readwrite', (s) => s.delete('khoa')); } catch { /* bỏ qua */ }
}

/** Độ mạnh mật khẩu 0–4 (thô, đủ để nhắc). */
export function doManh(mk) {
  let d = 0;
  if (mk.length >= 8) d++;
  if (mk.length >= 12) d++;
  if (/[a-zà-ỹ]/.test(mk) && /[A-ZÀ-Ỹ]/.test(mk)) d++;
  if (/\d/.test(mk) && /[^\p{L}\d]/u.test(mk)) d++;
  return Math.min(4, d);
}
