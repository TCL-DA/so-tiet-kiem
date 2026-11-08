// Trạng thái chung của app + các thao tác ghi (thêm / sửa / xoá / hoàn tác) — mọi thay đổi đi qua đây
// để được: tính lại, vẽ lại, mã hoá + lưu máy, đẩy GitHub.
import { tinh, taoGiaoDich, taoVang } from './store.js';
import { fmt } from './util.js';

export const app = {
  st: null,          // dữ liệu (đã giải mã)
  kq: null,          // kết quả tính toán
  anSo: false,
  khoang: 12,
  loc: { chu: '', nhom: '', kieu: '', tu: '', den: '' },
  sap: { cot: 'ngay', chieu: 'desc' },
  gioiHan: 150,
  moiSua: null,      // id dòng vừa thêm/sửa (để nháy sáng)
  // Gắn từ main.js:
  luu: async () => {},
  veLai: () => {},
  thongBao: () => {},
};

/** Định dạng tiền tôn trọng chế độ Ẩn số. */
export const tien = (n) => (app.anSo ? '••••••' : fmt(n));
export const tienD = (n) => (app.anSo ? '•••••• đ' : `${fmt(n)} đ`);
export const tienDau = (n) => (app.anSo ? '••••••' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`);

const hoanTac = [];

function ghiNhan(loai, ds, truoc, sau) {
  hoanTac.push({ loai, ds, truoc: truoc && { ...truoc }, sau: sau && { ...sau } });
  if (hoanTac.length > 30) hoanTac.shift();
}

export function capNhat(opt = {}) {
  app.st.sua = Date.now();
  app.kq = tinh(app.st);
  app.veLai(opt);
  app.luu();
}

export function themGd(p) {
  const t = taoGiaoDich(p);
  app.st.tx.push(t);
  ghiNhan('them', 'tx', null, t);
  app.moiSua = t.id;
  capNhat({ gd: t });
  return t;
}

export function suaGd(id, p) {
  const i = app.st.tx.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const cu = app.st.tx[i];
  const moi = taoGiaoDich({ ...cu, ...p, id, tao: cu.tao, nguon: cu.nguon });
  app.st.tx[i] = moi;
  ghiNhan('sua', 'tx', cu, moi);
  app.moiSua = id;
  capNhat();
  return moi;
}

export function xoaGd(id) {
  const i = app.st.tx.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const cu = app.st.tx[i];
  app.st.tx[i] = { ...cu, xoa: Date.now(), sua: Date.now() };
  ghiNhan('xoa', 'tx', cu, app.st.tx[i]);
  capNhat();
  return cu;
}

export function luuVang(p) {
  if (p.id) {
    const i = app.st.vang.findIndex((v) => v.id === p.id);
    const cu = app.st.vang[i];
    const moi = taoVang({ ...cu, ...p, tao: cu.tao });
    app.st.vang[i] = moi;
    ghiNhan('sua', 'vang', cu, moi);
  } else {
    const v = taoVang(p);
    app.st.vang.push(v);
    ghiNhan('them', 'vang', null, v);
  }
  capNhat();
}

export function xoaVang(id) {
  const i = app.st.vang.findIndex((v) => v.id === id);
  if (i < 0) return;
  const cu = app.st.vang[i];
  app.st.vang[i] = { ...cu, xoa: Date.now(), sua: Date.now() };
  ghiNhan('xoa', 'vang', cu, app.st.vang[i]);
  capNhat();
}

/** Hoàn tác thao tác gần nhất. Trả câu mô tả hoặc '' nếu không còn gì. */
export function hoanTacCuoi() {
  const h = hoanTac.pop();
  if (!h) return '';
  const ds = app.st[h.ds];
  const i = ds.findIndex((r) => r.id === (h.sau || h.truoc).id);
  const now = Date.now();
  if (h.loai === 'them' && i >= 0) ds[i] = { ...ds[i], xoa: now, sua: now };
  if (h.loai === 'sua' && i >= 0) { ds[i] = { ...h.truoc, sua: now }; app.moiSua = h.truoc.id; }
  if (h.loai === 'xoa' && i >= 0) { const { xoa, ...con } = h.truoc; ds[i] = { ...con, sua: now }; app.moiSua = h.truoc.id; }
  capNhat();
  return { them: 'Đã bỏ khoản vừa thêm', sua: 'Đã trả lại bản trước khi sửa', xoa: 'Đã khôi phục khoản vừa xoá' }[h.loai];
}

export const conHoanTac = () => hoanTac.length > 0;
export const xoaLichSuHoanTac = () => { hoanTac.length = 0; };
