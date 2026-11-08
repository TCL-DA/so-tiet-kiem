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
    const hw = await napArgon();
    const raw = await hw.argon2id({
      password: matKhau, salt: unb64(th.salt), parallelism: th.p, iterations: th.t,
      memorySize: th.m, hashLength: 32, outputType: 'binary',
    });
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
