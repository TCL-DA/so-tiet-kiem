// Ngăn nhập / sửa giao dịch + mở/đóng ngăn kéo, hộp thoại có giữ tiêu điểm bên trong.
import { app, themGd, suaGd, xoaGd } from './app.js';
import { KIEU, doanNhom, chuanTen } from './store.js';
import { fmt, docTien, parseMoney, today, $, $$ } from './util.js';
import { fx, dongXuRoi, phaoGiay } from './effects.js';
import { napNhomForm, napGoiY } from './ui.js';

// ───────────── Mở / đóng ngăn + bẫy tiêu điểm ─────────────
const moStack = [];
export function moNgan(el, focusEl) {
  const truoc = document.activeElement;
  el.hidden = false;
  $('#man').classList.add('mo');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('mo')));
  moStack.push({ el, truoc });
  setTimeout(() => (focusEl || el.querySelector('input, select, button'))?.focus({ preventScroll: true }), fx('ngan-truot') ? 120 : 0);
  document.body.style.overflow = 'hidden';
}
export function dongNgan(el = moStack[moStack.length - 1]?.el) {
  if (!el) return;
  const i = moStack.findIndex((x) => x.el === el);
  if (i < 0) return;
  const { truoc } = moStack.splice(i, 1)[0];
  el.classList.remove('mo');
  if (!moStack.length) { $('#man').classList.remove('mo'); document.body.style.overflow = ''; }
  setTimeout(() => { if (!el.classList.contains('mo')) el.hidden = true; }, fx('ngan-truot') ? 430 : 0);
  truoc?.focus?.({ preventScroll: true });
}
export const dangMoNgan = () => moStack.length > 0;

document.addEventListener('keydown', (e) => {
  if (!moStack.length) return;
  const el = moStack[moStack.length - 1].el;
  if (e.key === 'Escape') { e.preventDefault(); dongNgan(el); return; }
  if (e.key !== 'Tab') return;
  const ds = $$('button:not([disabled]):not([hidden]), input:not([hidden]):not([type="hidden"]), select, a[href], [tabindex="0"]', el).filter((x) => x.offsetParent !== null);
  if (!ds.length) return;
  const dau = ds[0], cuoi = ds[ds.length - 1];
  if (e.shiftKey && document.activeElement === dau) { e.preventDefault(); cuoi.focus(); }
  else if (!e.shiftKey && document.activeElement === cuoi) { e.preventDefault(); dau.focus(); }
});
$('#man').addEventListener('click', () => dongNgan());
document.addEventListener('click', (e) => { const d = e.target.closest('[data-dong]'); if (d) dongNgan(d.closest('.ngan')); });

// ───────────── Ngăn giao dịch ─────────────
const F = {
  ngan: $('#ngan-gd'), tien: $('#gd-tien'), ngay: $('#gd-ngay'), ghi: $('#gd-ghi'), nhom: $('#gd-nhom'),
  nguoi: $('#gd-nguoi'), ngoai: $('#gd-ngoai-so'), kieu4: $('#kieu-4'),
};
let dangSua = null, kieu = 'vao', nhomTay = false;

function datKieu(k) {
  kieu = k;
  const nut = $$('button', F.kieu4);
  nut.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.k === k)));
  const i = nut.findIndex((b) => b.dataset.k === k);
  $('.bong', F.kieu4).style.transform = `translateX(calc(${i * 100}% + ${i * 4}px))`;
  const giuNhom = nhomTay ? F.nhom.value : doanNhom(F.ghi.value, k);
  napNhomForm(k, giuNhom);
  const coNguoi = k === 'muon' || k === 'tra';
  $('#truong-nguoi').hidden = !coNguoi;
  $('#o-ngoai-so').hidden = k !== 'muon';
}

function hienTien() {
  const v = parseMoney(F.tien.value);
  const ok = Number.isFinite(v) && v > 0;
  $('#gd-tien-chu').textContent = ok ? `${fmt(v)} đ — ${docTien(v)}` : '';
  if (ok) $('#gd-tien-loi').textContent = '';
  return ok ? v : 0;
}

/** Mở ngăn. gd = giao dịch để sửa; mau = giá trị điền sẵn khi thêm mới. */
export function moGiaoDich(gd = null, mau = {}) {
  dangSua = gd;
  nhomTay = !!gd;
  const p = gd || { kieu: mau.kieu || 'vao', ngay: today(), soTien: mau.soTien || 0, ghiChu: mau.ghiChu || '', nguoi: mau.nguoi || '', ngoaiSo: false, nhom: mau.nhom };
  $('#ngan-gd-tieu-de').textContent = gd ? 'Sửa giao dịch' : 'Thêm giao dịch';
  F.tien.value = p.soTien ? fmt(p.soTien) : '';
  F.ngay.value = p.ngay;
  F.ghi.value = p.ghiChu;
  F.nguoi.value = p.nguoi || '';
  F.ngoai.checked = !!p.ngoaiSo;
  $('#gd-tien-loi').textContent = $('#gd-nguoi-loi').textContent = '';
  datKieu(p.kieu);
  if (p.nhom) F.nhom.value = p.nhom;
  hienTien();
  $('#gd-xoa').hidden = $('#gd-chep').hidden = !gd;
  $('#gd-luu-tiep').hidden = !!gd;
  $('#gd-nguon').textContent = gd?.nguon ? `Nguồn: ${gd.nguon.replace('excel:', 'sổ Excel, ')}${gd.uocNgay ? ' · ngày ước (sổ gốc không ghi ngày)' : ''}` : '';
  napGoiY();
  moNgan(F.ngan, F.tien);
}

function rung(el) { if (!fx('rung-sai')) return; el.classList.remove('rung'); void el.offsetWidth; el.classList.add('rung'); }

function docForm() {
  const soTien = hienTien();
  let hong = false;
  if (!soTien) { $('#gd-tien-loi').textContent = 'Nhập số tiền lớn hơn 0 (vd 5tr, 500k, 1.500.000).'; rung(F.tien); hong = true; }
  if (!F.ngay.value) { rung(F.ngay); hong = true; }
  const coNguoi = kieu === 'muon' || kieu === 'tra';
  if (coNguoi && !F.nguoi.value.trim()) { $('#gd-nguoi-loi').textContent = 'Ghi tên người mượn / trả để web theo dõi nợ.'; rung(F.nguoi); hong = true; }
  if (hong) { (soTien ? (coNguoi && !F.nguoi.value.trim() ? F.nguoi : F.ngay) : F.tien).focus(); return null; }
  return { kieu, soTien, ngay: F.ngay.value, ghiChu: F.ghi.value.trim(), nhom: F.nhom.value, nguoi: coNguoi ? chuanTen(F.nguoi.value) : '', ngoaiSo: kieu === 'muon' && F.ngoai.checked };
}

function luu(tiep) {
  const p = docForm();
  if (!p) return;
  if (dangSua) {
    suaGd(dangSua.id, p);
    app.thongBao('Đã sửa giao dịch', { tich: true });
    dongNgan(F.ngan);
    return;
  }
  themGd(p);
  if (KIEU[p.kieu].tien > 0) { dongXuRoi(p.soTien >= 1e7 ? 28 : 14); if (p.soTien >= 2e7) phaoGiay(90); }
  app.thongBao(`Đã ghi ${KIEU[p.kieu].ten.toLowerCase()} ${fmt(p.soTien)} đ`, { tich: true });
  if (tiep) {
    F.tien.value = ''; F.ghi.value = ''; hienTien(); nhomTay = false; datKieu(kieu);
    F.tien.focus();
  } else dongNgan(F.ngan);
}

$('#form-gd').addEventListener('submit', (e) => { e.preventDefault(); luu(false); });
$('#gd-luu-tiep').addEventListener('click', () => luu(true));
F.kieu4.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) datKieu(b.dataset.k); });
F.kieu4.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const ds = ['vao', 'ra', 'muon', 'tra'];
  const i = (ds.indexOf(kieu) + (e.key === 'ArrowRight' ? 1 : 3)) % 4;
  datKieu(ds[i]); $(`[data-k="${ds[i]}"]`, F.kieu4).focus();
});
F.tien.addEventListener('input', hienTien);
F.tien.addEventListener('blur', () => { const v = hienTien(); if (v) F.tien.value = fmt(v); });
F.ghi.addEventListener('input', () => {
  if (nhomTay) return;
  napNhomForm(kieu, doanNhom(F.ghi.value, kieu));
});
F.nhom.addEventListener('change', () => { nhomTay = true; });
F.nguoi.addEventListener('input', () => { $('#gd-nguoi-loi').textContent = ''; });
$('#chips-tien').addEventListener('click', (e) => {
  const c = e.target.closest('[data-cong]');
  if (!c) return;
  const cong = +c.dataset.cong, cu = parseMoney(F.tien.value);
  F.tien.value = cong ? fmt((Number.isFinite(cu) ? cu : 0) + cong) : '';
  hienTien();
  if (fx('chip-nay')) { c.classList.remove('nay'); void c.offsetWidth; c.classList.add('nay'); }
});
$('#gd-xoa').addEventListener('click', () => {
  if (!dangSua) return;
  const t = dangSua;
  dongNgan(F.ngan);
  xoaGd(t.id);
  app.thongBao(`Đã xoá "${t.ghiChu || KIEU[t.kieu].ten}" ${fmt(t.soTien)} đ`, { hoanTac: true });
});
$('#gd-chep').addEventListener('click', () => {
  if (!dangSua) return;
  const t = dangSua;
  dongNgan(F.ngan);
  setTimeout(() => moGiaoDich(null, { ...t, ngay: today() }), fx('ngan-truot') ? 300 : 0);
});
