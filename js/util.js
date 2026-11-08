// Tiện ích chung: định dạng tiền, đọc số tiền gõ tắt, đọc số bằng chữ, ngày tháng.

const NF = new Intl.NumberFormat('vi-VN');

export const fmt = (n) => NF.format(Math.round(n || 0));
export const fmtD = (n) => `${fmt(n)} đ`;
export const fmtSigned = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

/** Số gọn: 13,6 tr · 1,25 tỷ · 850 k */
export function fmtShort(n) {
  const a = Math.abs(n || 0), s = n < 0 ? '−' : '';
  const one = (v) => v.toLocaleString('vi-VN', { maximumFractionDigits: v < 10 ? 2 : 1 });
  if (a >= 1e9) return `${s}${one(a / 1e9)} tỷ`;
  if (a >= 1e6) return `${s}${one(a / 1e6)} tr`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)} k`;
  return `${s}${a}`;
}

/** Bỏ dấu + chữ thường để so khớp. */
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

/**
 * Đọc số tiền người gõ: "5tr", "1tr5", "1,5 triệu", "500k", "5 xị", "1.500.000", "2 tỷ".
 * Trả về số nguyên đồng, hoặc NaN nếu không đọc được.
 */
export function parseMoney(input) {
  let s = norm(input).replace(/\s+/g, '').replace(/đ$|d$|vnd$/, '');
  if (!s) return NaN;
  const units = [
    [/^(\d+(?:[.,]\d+)?)(ty|b)(\d*)$/, 1e9],
    [/^(\d+(?:[.,]\d+)?)(trieu|tr|m)(\d*)$/, 1e6],
    [/^(\d+(?:[.,]\d+)?)(xi)(\d*)$/, 1e5],
    [/^(\d+(?:[.,]\d+)?)(nghin|ngan|k)(\d*)$/, 1e3],
  ];
  for (const [re, mul] of units) {
    const m = s.match(re);
    if (!m) continue;
    const base = parseFloat(m[1].replace(',', '.'));
    // "1tr5" = 1,5 tr ; "1tr25" = 1,25 tr
    const tail = m[3] ? parseFloat(`0.${m[3]}`) : 0;
    return Math.round((base + tail) * mul);
  }
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''), 10);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/^\d+[.,]\d{1,2}$/.test(s)) return Math.round(parseFloat(s.replace(',', '.')));
  return NaN;
}

const SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function docBaSo(n, full) {
  const tram = Math.floor(n / 100), chuc = Math.floor((n % 100) / 10), dv = n % 10;
  const out = [];
  if (full || tram) out.push(`${SO[tram]} trăm`);
  if (chuc > 1) out.push(`${SO[chuc]} mươi`);
  else if (chuc === 1) out.push('mười');
  else if ((full || tram) && dv) out.push('linh');
  if (dv) {
    if (dv === 1 && chuc > 1) out.push('mốt');
    else if (dv === 5 && chuc > 0) out.push('lăm');
    else if (dv === 4 && chuc > 1) out.push('tư');
    else out.push(SO[dv]);
  }
  return out.join(' ');
}

/** Đọc số tiền bằng chữ: 1.500.000 → "Một triệu năm trăm nghìn đồng". */
export function docTien(n) {
  n = Math.round(Math.abs(n || 0));
  if (!n) return 'Không đồng';
  const donVi = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const nhom = [];
  while (n > 0) { nhom.push(n % 1000); n = Math.floor(n / 1000); }
  const parts = [];
  for (let i = nhom.length - 1; i >= 0; i--) {
    if (!nhom[i]) continue;
    parts.push(`${docBaSo(nhom[i], i < nhom.length - 1)} ${donVi[i]}`.trim());
  }
  const s = parts.join(' ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} đồng`;
}

export const pad2 = (n) => String(n).padStart(2, '0');

/** Ngày hôm nay theo giờ máy, dạng YYYY-MM-DD. */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function fmtDate(iso, short = false) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return short ? `${d}/${m}` : `${d}/${m}/${y}`;
}

const THANG = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
export const monthKey = (iso) => iso.slice(0, 7);
export function fmtMonth(key, long = false) {
  const [y, m] = key.split('-');
  return long ? `Tháng ${parseInt(m, 10)}/${y}` : `${THANG[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
