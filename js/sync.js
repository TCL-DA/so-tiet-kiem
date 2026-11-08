// Bản sổ trên web: file ĐÃ MÃ HOÁ `du-lieu.enc.json` nằm ngay trong repo của web.
// Ai mở link + gõ đúng mật khẩu là xem được (đọc không cần tài khoản).
// Máy nào muốn LƯU thay đổi lên web thì dán token GitHub một lần (chỉ quyền Contents của repo này).

const LS = 'stk.dongbo';
const API = 'https://api.github.com';
export const FILE = 'du-lieu.enc.json';
export const REPO_MAC_DINH = 'TCL-DA/so-tiet-kiem';

export function docCauHinh() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { /* bỏ qua */ }
  if (!c.repo || c.repo === 'TCL-DA/so-tiet-kiem-du-lieu') { c.repo = REPO_MAC_DINH; c.sha = ''; }
  return { token: '', sha: '', lanCuoi: 0, ...c };
}
export function ghiCauHinh(c) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch { /* bỏ qua */ } }
export const coQuyenDang = () => !!docCauHinh().token;

const b64utf8 = (s) => btoa(unescape(encodeURIComponent(s)));
const unb64utf8 = (s) => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));

async function layCoHanGio(url, opt = {}, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opt, cache: 'no-store', signal: ctl.signal }); } finally { clearTimeout(t); }
}

const tieuDe = (cfg) => ({
  Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
  ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
});

/**
 * Kéo bản trên web về. Trả {blob, sha} | null (chưa đăng gì).
 * Không có token: đọc qua API công khai (mới nhất), API hết lượt thì đọc file trên chính trang web.
 */
export async function keo(cfg = docCauHinh()) {
  try {
    const r = await layCoHanGio(`${API}/repos/${cfg.repo}/contents/${FILE}`, { headers: tieuDe(cfg) });
    if (r.status === 404 && cfg.token) return null;
    if (r.status === 401) throw new Error('Token sai hoặc đã hết hạn (401).');
    if (r.ok) { const d = await r.json(); return { blob: JSON.parse(unb64utf8(d.content)), sha: d.sha }; }
    if (cfg.token) throw new Error(`GitHub báo lỗi ${r.status}.`);
  } catch (e) {
    if (cfg.token || /Token/.test(e.message)) throw e;
  }
  // Dự phòng: file tĩnh trên trang (chậm hơn tối đa ~10 phút do bộ đệm của GitHub Pages)
  const r = await layCoHanGio(`${FILE}?t=${Date.now()}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Không tải được bản trên web (${r.status}).`);
  return { blob: await r.json(), sha: '' };
}

/** Đăng bản mã hoá lên. Trả {sha} hoặc {xungDot:true} nếu trên web vừa có bản mới hơn. */
export async function day(blob, sha, cfg = docCauHinh()) {
  if (!cfg.token) throw new Error('Máy này chưa có quyền đăng lên web (chưa dán token).');
  const body = { message: `cap nhat so ${new Date().toISOString()}`, content: b64utf8(JSON.stringify(blob)) };
  if (sha) body.sha = sha;
  const r = await layCoHanGio(`${API}/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', headers: tieuDe(cfg), body: JSON.stringify(body) }, 15000);
  if (r.status === 409 || r.status === 422) return { xungDot: true };
  if (r.status === 401) throw new Error('Token sai hoặc đã hết hạn (401).');
  if (r.status === 403 || r.status === 404) throw new Error('Token không có quyền ghi repo này. Cần quyền "Contents: Read and write" cho repo so-tiet-kiem.');
  if (!r.ok) throw new Error(`GitHub báo lỗi ${r.status}.`);
  const d = await r.json();
  return { sha: d.content.sha };
}

/** Kiểm token có ghi được repo không. */
export async function kiemTra(cfg) {
  const r = await layCoHanGio(`${API}/repos/${cfg.repo}`, { headers: tieuDe(cfg) });
  if (r.status === 401) throw new Error('Token sai hoặc đã hết hạn.');
  if (r.status === 404) throw new Error(`Không thấy repo ${cfg.repo}.`);
  if (!r.ok) throw new Error(`GitHub báo lỗi ${r.status}.`);
  const j = await r.json();
  if (j.permissions && !j.permissions.push) throw new Error('Token chỉ có quyền đọc — cần quyền ghi (Contents: Read and write).');
  return `Máy này đã được quyền đăng lên web (${j.full_name}).`;
}
