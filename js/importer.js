// Nhập / xuất dữ liệu: file Excel sổ cũ (bố cục Ngày · Ghi chú · Nhập · Rút · Cho mượn · Vàng),
// file Excel do web xuất ra, và file sao lưu JSON.
import { taoGiaoDich, taoVang, timNguoiMuon, chuanTen, tenNhom, KIEU, tenLoaiVang, conSong, sapTheoNgay } from './store.js';
import { toISO, norm, pad2 } from './util.js';

let xlsxPromise = null;
/** Nạp SheetJS khi cần (gần 1 MB, không nạp lúc mở trang). */
export function napXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'lib/xlsx.full.min.js';
    s.onload = () => res(window.XLSX);
    s.onerror = () => { xlsxPromise = null; rej(new Error('Không tải được thư viện đọc Excel')); };
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

const EXCEL_GOC = Date.UTC(1899, 11, 30);
const serialToIso = (n) => { const d = new Date(EXCEL_GOC + Math.round(n) * 864e5); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
const isoToSerial = (iso) => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - EXCEL_GOC) / 864e5; };
const so = (v) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && /^[\d.,\s]+$/.test(v) ? +v.replace(/[.,\s]/g, '') : 0);

function docNgay(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) return serialToIso(v);
  if (v instanceof Date && !isNaN(v)) return toISO(v);
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  }
  return null;
}

const lui1Nam = (iso) => `${+iso.slice(0, 4) - 1}${iso.slice(4)}`;
const giua = (a) => [...a].sort()[Math.floor(a.length / 2)];

/**
 * Sửa năm gõ nhầm: đi ngược từ dòng cuối lên, dòng nào trễ hơn các dòng ngay sau nó quá 150 ngày
 * thì lùi 1 năm (sổ ghi 06→12/2025 rồi quay lại 01/2025 → khối đầu thật ra là 2024).
 */
function suaNam(dong, canhBao) {
  const sau = [];
  for (let i = dong.length - 1; i >= 0; i--) {
    const r = dong[i];
    if (!r.ngay) continue;
    const goc = r.ngay;
    if (sau.length) {
      const moc = giua(sau.slice(0, 3));
      while (Date.parse(r.ngay) - Date.parse(moc) > 150 * 864e5) r.ngay = lui1Nam(r.ngay);
    }
    if (r.ngay !== goc) r.suaNam = goc;
    sau.unshift(r.ngay);
  }
  const n = dong.filter((r) => r.suaNam).length;
  if (n) canhBao.push(`${n} dòng ghi năm sau ngày của các dòng phía dưới — đã lùi 1 năm (vd ${dong.find((r) => r.suaNam).suaNam} → ${dong.find((r) => r.suaNam).ngay}). Dòng này có dấu "đã sửa năm".`);
}

/** Đọc sổ Excel bố cục cũ. Trả {tx, vang, canhBao, giaVangExcel} hoặc null nếu không đúng bố cục. */
function docSoCu(XLSX, ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const hdr = rows.findIndex((r, i) => i < 15 && r && norm(r[0]) === 'ngay' && norm(r[1]).includes('ghi chu'));
  if (hdr < 0) return null;
  const canhBao = [];
  // Cột vàng: ô tiêu đề có chữ "Vàng" ở các dòng trên; giá ở dòng 1, số chỉ ở dòng 2
  let giaVangExcel = 0, soChi = 0;
  for (let i = 0; i < hdr; i++) {
    const j = (rows[i] || []).findIndex((c) => typeof c === 'string' && norm(c).includes('vang'));
    if (j >= 0) { giaVangExcel = so(rows[0]?.[j]); soChi = so(rows[1]?.[j]); break; }
  }
  const dong = [];
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const [a, b, c, d, e] = r;
    const vao = so(c), ra = so(d), muon = so(e);
    if (!vao && !ra && !muon) continue;
    dong.push({ dong: i + 1, ngay: docNgay(a), chuNgay: a, ghiChu: String(b ?? '').trim(), vao, ra, muon });
  }
  suaNam(dong, canhBao);
  // Dòng thiếu ngày → lấy ngày dòng trước, đánh dấu "ngày ước"
  const thieu = [];
  dong.forEach((r, i) => {
    if (r.ngay) return;
    r.ngay = dong.slice(0, i).reverse().find((x) => x.ngay)?.ngay || dong.slice(i + 1).find((x) => x.ngay)?.ngay;
    r.uoc = true;
    thieu.push(`dòng ${r.dong} (${r.ghiChu || 'không ghi chú'}${r.chuNgay ? `, ô ngày ghi "${r.chuNgay}"` : ''})`);
  });
  if (thieu.length) canhBao.push(`Thiếu ngày, đã lấy ngày dòng phía trên: ${thieu.join('; ')}.`);

  // Ai mượn: gom tên, tên 1 chữ cái ("B") ghép vào người duy nhất cùng chữ đầu ("Bình")
  const tenMuon = new Set();
  for (const r of dong) if (r.muon || (r.ra && /mượn|vay/i.test(r.ghiChu))) { const t = timNguoiMuon(r.ghiChu); if (t) tenMuon.add(t); }
  const biDanh = {};
  for (const t of tenMuon) {
    if (t.length !== 1) continue;
    const cung = [...tenMuon].filter((x) => x.length > 1 && norm(x).startsWith(norm(t)));
    if (cung.length === 1) biDanh[t] = cung[0];
  }
  const ten = (t) => biDanh[t] || t;
  const nguoiCo = new Set([...tenMuon].map(ten).map(norm));

  const goc = Date.now() - dong.length * 10;
  const tx = [];
  let k = 0;
  const them = (r, kieu, soTien, ext = {}) => tx.push(taoGiaoDich({
    ngay: r.ngay, kieu, soTien, ghiChu: r.ghiChu, uocNgay: !!r.uoc, nguon: `excel:dòng ${r.dong}${r.suaNam ? ` · đã sửa năm từ ${r.suaNam}` : ''}`,
    tao: goc + (k++) * 10, ...ext,
  }));
  for (const r of dong) {
    if (r.vao) {
      const m = r.ghiChu.match(/^(.+?)\s+trả(?=\s|$)/i);
      const nguoi = m && nguoiCo.has(norm(chuanTen(m[1]))) ? ten(chuanTen(m[1])) : '';
      them(r, nguoi ? 'tra' : 'vao', r.vao, { nguoi });
    }
    if (r.ra) {
      const nguoi = /mượn|vay/i.test(r.ghiChu) ? ten(timNguoiMuon(r.ghiChu)) : '';
      them(r, nguoi ? 'muon' : 'ra', r.ra, { nguoi });
    }
    if (r.muon) them(r, 'muon', r.muon, { nguoi: ten(timNguoiMuon(r.ghiChu)) || 'Chưa rõ', ngoaiSo: true });
  }
  const ngoai = tx.filter((t) => t.ngoaiSo);
  if (ngoai.length) canhBao.push(`${ngoai.length} khoản ở cột "Cho bạn mượn" (${ngoai.map((t) => `${t.nguoi} ${t.soTien.toLocaleString('vi-VN')} đ`).join(', ')}) không trừ tiền trong sổ — đã ghi là "cho mượn không lấy từ sổ". Ô tổng cột này trong Excel để trống nên Excel chưa cộng.`);

  const vang = [];
  if (soChi > 0) {
    const mua = tx.filter((t) => t.nhom === 'vang' && t.kieu === 'ra');
    vang.push(taoVang({
      ngay: mua[0]?.ngay, soChi, loai: 'nhan',
      giaMua: mua.reduce((s, t) => s + t.soTien, 0) || soChi * giaVangExcel,
      ghiChu: mua[0]?.ghiChu || 'Nhập từ sổ Excel',
    }));
  }
  return { tx, vang, canhBao, giaVangExcel, kieuFile: 'Sổ Excel cũ' };
}

/** Đọc file Excel do chính web xuất ra (sheet "Giao dịch" + "Vàng"). */
function docFileWeb(XLSX, wb) {
  const ws = wb.Sheets['Giao dịch'];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });
  const kieuTheoTen = Object.fromEntries(Object.entries(KIEU).map(([k, v]) => [norm(v.ten), k]));
  const tx = rows.filter((r) => r['Ngày']).map((r, i) => taoGiaoDich({
    id: r['Mã'] || undefined, ngay: docNgay(r['Ngày']), kieu: kieuTheoTen[norm(r['Kiểu'])] || 'ra',
    soTien: so(r['Gửi vào']) || so(r['Rút ra']), ghiChu: r['Ghi chú'], nguoi: r['Người'],
    ngoaiSo: norm(r['Không lấy từ sổ']) === 'co', tao: Date.now() - (rows.length - i) * 10,
  }));
  const wv = wb.Sheets['Vàng'];
  const vang = wv ? XLSX.utils.sheet_to_json(wv, { raw: true, defval: '' }).filter((r) => r['Số chỉ']).map((r) => taoVang({
    ngay: docNgay(r['Ngày']), soChi: +r['Số chỉ'], loai: { 'nhan 999,9': 'nhan', 'mieng sjc': 'mieng', 'nu trang 999,9': 'nutrang' }[norm(r['Loại'])] || 'nhan',
    giaMua: so(r['Giá mua (tổng)']), ghiChu: r['Ghi chú'],
  })) : [];
  return { tx, vang, canhBao: [], kieuFile: 'File Excel của web' };
}

/** Đọc một file người dùng chọn (.xlsx/.xls/.json). */
export async function docFile(file) {
  if (/\.json$/i.test(file.name)) {
    const j = JSON.parse(await file.text());
    const d = j.app === 'so-tiet-kiem' ? j.data : j;
    if (!Array.isArray(d?.tx)) throw new Error('File JSON không phải bản sao lưu của sổ tiết kiệm.');
    return { tx: d.tx, vang: d.vang || [], giaVang: d.giaVang, caiDat: d.caiDat, canhBao: [], kieuFile: 'Bản sao lưu JSON' };
  }
  const XLSX = await napXlsx();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const tuWeb = docFileWeb(XLSX, wb);
  if (tuWeb) return tuWeb;
  for (const ten of wb.SheetNames) {
    const kq = docSoCu(XLSX, wb.Sheets[ten]);
    if (kq) return { ...kq, sheet: ten };
  }
  throw new Error('Không nhận ra bố cục file. Cần cột "Ngày", "Ghi chú", "Nhập", "Rút" như sổ cũ, hoặc file do web này xuất.');
}

// ───────────────────────── Xuất ─────────────────────────

const taiXuong = (blob, ten) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ten;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
const tem = () => { const d = new Date(); return `${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`; };

export function xuatJson(st) {
  const blob = new Blob([JSON.stringify({ app: 'so-tiet-kiem', v: 1, xuatLuc: new Date().toISOString(), data: st }, null, 1)], { type: 'application/json' });
  taiXuong(blob, `so-tiet-kiem-${tem()}.json`);
}

export async function xuatExcel(st, kq) {
  const XLSX = await napXlsx();
  const wb = XLSX.utils.book_new();
  const DATE = 'dd/mm/yyyy', TIEN = '#,##0';
  const datCot = (ws, rong) => { ws['!cols'] = rong.map((w) => ({ wch: w })); };
  const dinhDang = (ws, cotNgay, cotTien) => {
    const r = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= r.e.r; R++) {
      for (const C of cotNgay) { const c = ws[XLSX.utils.encode_cell({ r: R, c: C })]; if (c && typeof c.v === 'number') c.z = DATE; }
      for (const C of cotTien) { const c = ws[XLSX.utils.encode_cell({ r: R, c: C })]; if (c && typeof c.v === 'number') c.z = TIEN; }
    }
  };
  const tong = [
    ['Mục', 'Số tiền (đ)'],
    ['Tổng tài sản', kq.tong], ['Tiền trong sổ', kq.tien], ['Vàng quy tiền', kq.vangGiaTri],
    ['Đang cho mượn', kq.dangChoMuon], ['Tổng gửi vào', kq.vao], ['Tổng rút ra', kq.ra],
    ['Số giao dịch', kq.soGd], ['Xuất lúc', new Date().toLocaleString('vi-VN')],
  ];
  const ws0 = XLSX.utils.aoa_to_sheet(tong); datCot(ws0, [22, 18]); dinhDang(ws0, [], [1]);
  XLSX.utils.book_append_sheet(wb, ws0, 'Tổng quan');

  const dsTx = st.tx.filter(conSong).sort(sapTheoNgay);
  const gd = [['Ngày', 'Kiểu', 'Ghi chú', 'Nhóm', 'Người', 'Gửi vào', 'Rút ra', 'Số dư sổ', 'Không lấy từ sổ', 'Mã']];
  for (const t of dsTx) {
    const vao = KIEU[t.kieu].tien > 0;
    gd.push([isoToSerial(t.ngay), KIEU[t.kieu].ten, t.ghiChu, tenNhom(t.nhom), t.nguoi, vao ? t.soTien : '', vao ? '' : t.soTien, kq.soDu.get(t.id) ?? '', t.ngoaiSo ? 'Có' : '', t.id]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(gd); datCot(ws1, [12, 10, 34, 22, 12, 14, 14, 15, 10, 10]); dinhDang(ws1, [0], [5, 6, 7]);
  ws1['!autofilter'] = { ref: ws1['!ref'] };
  XLSX.utils.book_append_sheet(wb, ws1, 'Giao dịch');

  const vg = [['Ngày', 'Số chỉ', 'Loại', 'Giá mua (tổng)', 'Ghi chú']];
  for (const v of st.vang.filter(conSong)) vg.push([isoToSerial(v.ngay), v.soChi, tenLoaiVang(v.loai), v.giaMua, v.ghiChu]);
  const ws2 = XLSX.utils.aoa_to_sheet(vg); datCot(ws2, [12, 8, 16, 16, 30]); dinhDang(ws2, [0], [3]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Vàng');

  const no = [['Người', 'Đã cho mượn', 'Đã trả', 'Còn nợ', 'Lần cuối']];
  for (const p of kq.dsNguoi) no.push([p.ten, p.muon, p.tra, p.con, isoToSerial(p.cuoi)]);
  const ws3 = XLSX.utils.aoa_to_sheet(no); datCot(ws3, [16, 15, 15, 15, 12]); dinhDang(ws3, [4], [1, 2, 3]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Cho mượn');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  taiXuong(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `so-tiet-kiem-${tem()}.xlsx`);
}
