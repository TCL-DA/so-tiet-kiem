// Đồng bộ qua GitHub: file đã MÃ HOÁ nằm trong repo RIÊNG TƯ (mặc định TCL-DA/so-tiet-kiem-du-lieu).
// Mỗi máy dán token (fine-grained, chỉ quyền Contents của repo đó) một lần; token chỉ nằm trên máy đó.

const LS = 'stk.dongbo';
const API = 'https://api.github.com';
export const FILE = 'du-lieu.enc.json';

export function docCauHinh() {
  try { return { repo: 'TCL-DA/so-tiet-kiem-du-lieu', token: '', sha: '', lanCuoi: 0, ...JSON.parse(localStorage.getItem(LS) || '{}') }; }
  catch { return { repo: 'TCL-DA/so-tiet-kiem-du-lieu', token: '', sha: '', lanCuoi: 0 }; }
}
export function ghiCauHinh(c) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch { /* bỏ qua */ } }
export const coDongBo = () => !!docCauHinh().token;

const b64utf8 = (s) => btoa(unescape(encodeURIComponent(s)));
const unb64utf8 = (s) => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));

async function goi(cfg, path, opt = {}) {
  const r = await fetch(`${API}/repos/${cfg.repo}/contents/${path}`, {
    ...opt,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) },
  });
  if (r.status === 404) return { khongCo: true };
  if (r.status === 401) throw new Error('Token sai hoặc đã hết hạn (401).');
  if (r.status === 403) throw new Error('Token không có quyền ghi repo này (403). Cần quyền "Contents: Read and write".');
  if (r.status === 409 || r.status === 422) return { xungDot: true };
  if (!r.ok) throw new Error(`GitHub báo lỗi ${r.status}.`);
  return r.json();
}

/** Kéo bản mã hoá trên GitHub về. Trả {blob, sha} hoặc null nếu chưa có. */
export async function keo(cfg = docCauHinh()) {
  const d = await goi(cfg, FILE);
  if (d.khongCo) return null;
  return { blob: JSON.parse(unb64utf8(d.content)), sha: d.sha };
}

/** Đẩy bản mã hoá lên. Trả sha mới; {xungDot:true} nếu trên GitHub vừa có bản mới hơn. */
export async function day(blob, sha, cfg = docCauHinh()) {
  const body = { message: `cap nhat ${new Date().toISOString()}`, content: b64utf8(JSON.stringify(blob)) };
  if (sha) body.sha = sha;
  const d = await goi(cfg, FILE, { method: 'PUT', body: JSON.stringify(body) });
  if (d.xungDot) return d;
  return { sha: d.content.sha };
}

/** Kiểm token + repo: trả thông báo dễ hiểu. */
export async function kiemTra(cfg) {
  const r = await fetch(`${API}/repos/${cfg.repo}`, { headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json' } });
  if (r.status === 401) throw new Error('Token sai hoặc đã hết hạn.');
  if (r.status === 404) throw new Error(`Không thấy repo ${cfg.repo} (sai tên, hoặc token chưa được cấp repo này).`);
  if (!r.ok) throw new Error(`GitHub báo lỗi ${r.status}.`);
  const j = await r.json();
  if (!j.private) throw new Error(`Repo ${cfg.repo} đang CÔNG KHAI — dữ liệu dù đã mã hoá cũng nên để repo riêng tư.`);
  if (j.permissions && !j.permissions.push) throw new Error('Token chỉ có quyền đọc — cần thêm quyền ghi (Contents: Read and write).');
  return `Kết nối được ${j.full_name} (riêng tư).`;
}
