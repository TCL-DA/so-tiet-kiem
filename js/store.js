// Mô hình dữ liệu sổ tiết kiệm + phân loại tự động + mọi phép tính thống kê.
import { norm, uid, monthKey, today } from './util.js';

/** Bốn kiểu giao dịch. tien = ảnh hưởng tiền trong sổ, no = ảnh hưởng tiền người khác còn nợ. */
export const KIEU = {
  vao:  { ten: 'Gửi vào',  ngan: 'Vào',  dau: '+', tien: +1, no: 0 },
  ra:   { ten: 'Rút ra',   ngan: 'Ra',   dau: '−', tien: -1, no: 0 },
  muon: { ten: 'Cho mượn', ngan: 'Mượn', dau: '−', tien: -1, no: +1 },
  tra:  { ten: 'Được trả', ngan: 'Trả',  dau: '+', tien: +1, no: -1 },
};

/** Nhóm. kieu: 'vao' | 'ra' | 'ca' (cả hai). */
export const NHOM = [
  { id: 'luong',    ten: 'Lương · thưởng',          kieu: 'vao' },
  { id: 'gui',      ten: 'Gửi tiết kiệm',           kieu: 'vao' },
  { id: 'thukhac',  ten: 'Thu khác',                kieu: 'vao' },
  { id: 'hui',      ten: 'Hụi',                     kieu: 'ca' },
  { id: 'congty',   ten: 'Công ty · quyết toán',    kieu: 'ca' },
  { id: 'doitien',  ten: 'Đổi tiền · ngoại tệ',     kieu: 'ca' },
  { id: 'hoc',      ten: 'Học hành',                kieu: 'ca' },
  { id: 'chovay',   ten: 'Cho mượn · thu nợ',       kieu: 'ca' },
  { id: 'chitieu',  ten: 'Chi tiêu cá nhân',        kieu: 'ra' },
  { id: 'muasam',   ten: 'Mua sắm',                 kieu: 'ra' },
  { id: 'congnghe', ten: 'Điện thoại · máy tính',   kieu: 'ra' },
  { id: 'xe',       ten: 'Xe cộ',                   kieu: 'ra' },
  { id: 'nha',      ten: 'Nhà cửa · đồ dùng',       kieu: 'ra' },
  { id: 'dulich',   ten: 'Đi chơi · du lịch',       kieu: 'ra' },
  { id: 'nhau',     ten: 'Ăn uống · nhậu',          kieu: 'ra' },
  { id: 'hieuhi',   ten: 'Hiếu hỉ · lì xì · biếu',  kieu: 'ra' },
  { id: 'giadinh',  ten: 'Gia đình',                kieu: 'ra' },
  { id: 'suckhoe',  ten: 'Sức khoẻ · làm đẹp',      kieu: 'ra' },
  { id: 'baohiem',  ten: 'Bảo hiểm',                kieu: 'ra' },
  { id: 'vang',     ten: 'Mua vàng',                kieu: 'ra' },
  { id: 'khac',     ten: 'Khác',                    kieu: 'ca' },
];
export const NHOM_BY_ID = Object.fromEntries(NHOM.map((n) => [n.id, n]));
export const tenNhom = (id) => NHOM_BY_ID[id]?.ten || 'Khác';

// Luật đoán nhóm theo ghi chú (đã bỏ dấu). Thứ tự quan trọng: luật đứng trước thắng.
const LUAT_VAO = [
  ['luong', /luong|thuong/],
  ['congty', /quyet toan|\bqt\b|cong ty|\bcty\b/],
  ['hui', /\bhui\b/],
  ['doitien', /\bdoi\b/],
  ['hoc', /\bhoc\b/],
  ['thukhac', /ca phe|\bban\b|lai suat|tien lai/],
];
const LUAT_RA = [
  ['vang', /\bvang\b/],
  ['hui', /\bhui\b/],
  ['congty', /\bcty\b|cong ty|vat tu|loadcell|quyet toan/],
  ['baohiem', /bao hiem/],
  ['hieuhi', /li xi|\bdam\b|cuoi|thoi noi|bieu|\btet\b|cho ba\b/],
  ['giadinh', /\bme\b|\bcha\b|\bbo\b|\bba\b/],
  ['nhau', /nhau|\bbia\b|ruou|an uong/],
  ['xe', /\bxe\b|\bpo\b|\bnon\b|xang/],
  ['congnghe', /laptop|may tinh|dien thoai|iphone|ipad|\d+ ?pro\b/],
  ['nha', /giuong|\bban\b.*\btu\b|nuoc nong|tu lanh|may giat|nem\b/],
  ['hoc', /\bhoc\b/],
  ['suckhoe', /thuoc|\btoc\b|kham|benh|nha khoa/],
  ['doitien', /doi tien/],
  ['dulich', /\bdi\b|ve may bay|du lich|choi le|khach san/],
  ['muasam', /\bmua\b|shopee|lazada|tiki|lay do/],
];

/** Đoán nhóm từ ghi chú + kiểu. */
export function doanNhom(ghiChu, kieu) {
  if (kieu === 'muon' || kieu === 'tra') return 'chovay';
  const s = norm(ghiChu);
  const luat = kieu === 'vao' ? LUAT_VAO : LUAT_RA;
  for (const [id, re] of luat) if (re.test(s)) return id;
  return kieu === 'vao' ? 'gui' : 'chitieu';
}

/** Viết hoa chữ đầu mỗi từ dài hơn 1 ký tự ("an" → "An", giữ "a Tú"). */
export function chuanTen(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').split(' ')
    .map((w) => (w.length > 1 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

/** Tìm tên người mượn trong ghi chú: "cho An mượn", "Bình mượn hụi", "cho an vay". */
export function timNguoiMuon(ghiChu) {
  const s = String(ghiChu || '').trim();
  let m = s.match(/cho\s+(.+?)\s+(mượn|vay)/i);
  if (m) return chuanTen(m[1]);
  m = s.match(/^(.+?)\s+(mượn|vay)(?=\s|$)/i);
  if (m && !/^(rút|mượn|vay|ứng)$/i.test(m[1])) return chuanTen(m[1].replace(/^rút\s+/i, ''));
  return '';
}

// ───────────────────────── Trạng thái ─────────────────────────

export function trangThaiMoi() {
  return {
    v: 1,
    tx: [],
    vang: [],
    giaVang: { nguon: 'tu-dong', loai: 'nhan', coSo: 'mua', thuCong: 0, moiNhat: null, lichSu: [] },
    caiDat: { mucTieu: 200_000_000, tinhNoVaoTong: true },
    sua: Date.now(),
  };
}

export function taoGiaoDich(p) {
  const now = Date.now();
  const kieu = KIEU[p.kieu] ? p.kieu : 'ra';
  return {
    id: p.id || uid(),
    ngay: p.ngay || today(),
    kieu,
    soTien: Math.max(0, Math.round(+p.soTien || 0)),
    ghiChu: String(p.ghiChu || '').trim(),
    nhom: p.nhom || doanNhom(p.ghiChu, kieu),
    nguoi: kieu === 'muon' || kieu === 'tra' ? chuanTen(p.nguoi) : '',
    ngoaiSo: kieu === 'muon' ? !!p.ngoaiSo : false,
    uocNgay: !!p.uocNgay,
    nguon: p.nguon || '',
    tao: p.tao || now,
    sua: now,
  };
}

export function taoVang(p) {
  return {
    id: p.id || uid(),
    ngay: p.ngay || today(),
    soChi: Math.max(0, +p.soChi || 0),
    loai: ['nhan', 'mieng', 'nutrang'].includes(p.loai) ? p.loai : 'nhan',
    giaMua: Math.max(0, Math.round(+p.giaMua || 0)),
    ghiChu: String(p.ghiChu || '').trim(),
    tao: p.tao || Date.now(),
    sua: Date.now(),
  };
}

export const conSong = (x) => !x.xoa;

// ───────────────────────── Tính toán ─────────────────────────

const TEN_LOAI_VANG = { nhan: 'Nhẫn 999,9', mieng: 'Miếng SJC', nutrang: 'Nữ trang 999,9' };
export const tenLoaiVang = (l) => TEN_LOAI_VANG[l] || l;

/** Giá 1 chỉ đang dùng để quy tiền cho từng loại. */
export function giaChi(gv, loai) {
  if (gv.thuCong > 0) return gv.thuCong;
  const g = gv.moiNhat?.[loai] || gv.moiNhat?.nhan;
  if (!g) return 0;
  return gv.coSo === 'ban' ? g.ban : g.mua;
}

export const anhHuongTien = (t) => (t.kieu === 'muon' && t.ngoaiSo ? 0 : KIEU[t.kieu].tien * t.soTien);

/** Sắp theo ngày; cùng ngày giữ thứ tự tạo. */
export const sapTheoNgay = (a, b) => (a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : a.tao - b.tao);

export function tinh(st) {
  const tx = st.tx.filter(conSong).sort(sapTheoNgay);
  const vang = st.vang.filter(conSong);
  let tien = 0, vao = 0, ra = 0;
  const soDu = new Map();          // id → số dư tiền sổ sau giao dịch
  const ngay = [];                 // [{ngay, tien}] số dư cuối mỗi ngày
  const thang = new Map();         // 'YYYY-MM' → {vao, ra, n}
  const nam = new Map();
  const theoNhom = new Map();      // chỉ khoản Rút ra
  const nguoi = new Map();         // tên → {muon, tra, lan, cuoi}
  for (const t of tx) {
    const d = anhHuongTien(t);
    tien += d;
    soDu.set(t.id, tien);
    if (ngay.length && ngay[ngay.length - 1].ngay === t.ngay) ngay[ngay.length - 1].tien = tien;
    else ngay.push({ ngay: t.ngay, tien });
    const mk = monthKey(t.ngay), yk = t.ngay.slice(0, 4);
    const tm = thang.get(mk) || { vao: 0, ra: 0, n: 0 };
    const ny = nam.get(yk) || { vao: 0, ra: 0, n: 0 };
    if (d > 0) { vao += d; tm.vao += d; ny.vao += d; }
    if (d < 0) { ra -= d; tm.ra -= d; ny.ra -= d; }
    tm.n++; ny.n++;
    thang.set(mk, tm); nam.set(yk, ny);
    if (t.kieu === 'ra') theoNhom.set(t.nhom, (theoNhom.get(t.nhom) || 0) + t.soTien);
    if (t.kieu === 'muon' || t.kieu === 'tra') {
      const p = nguoi.get(t.nguoi || '?') || { ten: t.nguoi || '?', muon: 0, tra: 0, lan: 0, cuoi: t.ngay };
      if (t.kieu === 'muon') p.muon += t.soTien; else p.tra += t.soTien;
      p.lan++; p.cuoi = t.ngay;
      nguoi.set(p.ten, p);
    }
  }
  const dsNguoi = [...nguoi.values()].map((p) => ({ ...p, con: p.muon - p.tra }))
    .sort((a, b) => b.con - a.con);
  const dangChoMuon = dsNguoi.reduce((s, p) => s + Math.max(0, p.con), 0);

  const gv = st.giaVang;
  let vangChi = 0, vangGiaTri = 0, vangVon = 0;
  for (const v of vang) {
    vangChi += v.soChi;
    vangGiaTri += v.soChi * giaChi(gv, v.loai);
    vangVon += v.giaMua;
  }
  const tinhNo = st.caiDat.tinhNoVaoTong !== false;
  const tong = tien + vangGiaTri + (tinhNo ? dangChoMuon : 0);

  // Danh sách tháng liên tục từ tháng đầu tới tháng cuối (tháng trống = 0)
  const dsThang = [];
  if (tx.length) {
    let [y, m] = tx[0].ngay.split('-').map(Number);
    const [y2, m2] = tx[tx.length - 1].ngay.split('-').map(Number);
    while (y < y2 || (y === y2 && m <= m2)) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      dsThang.push({ k, ...(thang.get(k) || { vao: 0, ra: 0, n: 0 }) });
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  const coHoatDong = dsThang.filter((x) => x.n);
  const tbVao = coHoatDong.length ? vao / dsThang.length : 0;
  const tbRa = coHoatDong.length ? ra / dsThang.length : 0;
  const thangTot = [...dsThang].sort((a, b) => (b.vao - b.ra) - (a.vao - a.ra))[0];
  const ruiLon = tx.filter((t) => t.kieu === 'ra').sort((a, b) => b.soTien - a.soTien);
  const nhom = [...theoNhom.entries()].map(([id, v]) => ({ id, ten: tenNhom(id), v })).sort((a, b) => b.v - a.v);

  return {
    tx, vang, soDu, ngay, dsThang, nam: [...nam.entries()].sort().map(([k, v]) => ({ k, ...v })),
    nhom, dsNguoi, dangChoMuon, tien, vao, ra, vangChi, vangGiaTri, vangVon, tong, tinhNo,
    tbVao, tbRa, thangTot, ruiLon, soGd: tx.length,
    dau: tx[0]?.ngay, cuoi: tx[tx.length - 1]?.ngay,
  };
}

/**
 * Gộp hai bản dữ liệu (máy này + bản trên GitHub): từng giao dịch lấy bản sửa sau cùng,
 * giao dịch đã xoá giữ dấu xoá để máy khác cũng xoá theo.
 */
export function gop(a, b) {
  const gopDs = (x, y) => {
    const m = new Map(x.map((r) => [r.id, r]));
    for (const r of y) { const o = m.get(r.id); if (!o || (r.sua || 0) > (o.sua || 0)) m.set(r.id, r); }
    return [...m.values()];
  };
  const lichSu = new Map([...(a.giaVang.lichSu || []), ...(b.giaVang.lichSu || [])].map((p) => [p.ngay, p]));
  const moiHon = (a.sua || 0) >= (b.sua || 0) ? a : b;
  return {
    ...moiHon,
    tx: gopDs(a.tx, b.tx),
    vang: gopDs(a.vang, b.vang),
    giaVang: { ...moiHon.giaVang, lichSu: [...lichSu.values()].sort((p, q) => (p.ngay < q.ngay ? -1 : 1)).slice(-400) },
    sua: Math.max(a.sua || 0, b.sua || 0),
  };
}

/** Dọn dấu xoá cũ hơn 60 ngày cho dữ liệu gọn. */
export function donDauXoa(st) {
  const han = Date.now() - 60 * 864e5;
  st.tx = st.tx.filter((t) => !t.xoa || t.xoa > han);
  st.vang = st.vang.filter((t) => !t.xoa || t.xoa > han);
  return st;
}
