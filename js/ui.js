// Vẽ các mục: tổng quan, ô chỉ số, biểu đồ, vàng, cho mượn, bảng giao dịch.
import { app, tien, tienD, tienDau } from './app.js';
import { KIEU, NHOM, tenNhom, giaChi, tenLoaiVang, NHOM_BY_ID } from './store.js';
import { fmt, fmtShort, fmtDate, fmtMonth, monthKey, docTien, esc, norm, parseMoney, fmtTime, $, $$ } from './util.js';
import { fx, demSo, odo, goChu, theoDoiHien, phaoGiay } from './effects.js';
import * as BD from './charts.js';
import { TEN_NGUON } from './gold.js';

BD.datAnSo(() => app.anSo);
const svg = (id, cls = '') => `<svg class="i ${cls}"><use href="#i-${id}"/></svg>`;
const VONG = 2 * Math.PI * 24;

// ───────────────────────── Tổng quan ─────────────────────────
let tongTruoc = null;
export function veTongQuan() {
  const k = app.kq, st = app.st;
  $('#hero-moc').textContent = k.soGd
    ? `Sổ ghi từ ${fmtDate(k.dau)} · ${fmt(k.soGd)} giao dịch`
    : 'Sổ tiết kiệm · chưa có giao dịch';
  const chuoi = app.anSo ? '•••.•••.•••' : fmt(k.tong);
  odo($('#tong'), chuoi, tongTruoc === null);
  const chu = app.anSo ? 'Đang ẩn số tiền — bấm biểu tượng con mắt để hiện.' : docTien(k.tong);
  if ($('#bang-chu').dataset.chu !== chu) { $('#bang-chu').dataset.chu = chu; goChu($('#bang-chu'), chu); }

  const gia = giaChi(st.giaVang, 'nhan');
  const tach = [
    { href: '#giao-dich', mau: '#2b7fff', nhan: 'Tiền trong sổ', so: tienD(k.tien), phu: `${fmt(k.soGd)} giao dịch` },
    { href: '#vang', mau: '#c9a45c', nhan: 'Vàng quy tiền', so: tienD(k.vangGiaTri), phu: k.vangChi ? `${fmt(k.vangChi)} chỉ × ${gia ? fmtShort(gia) : '?'}/chỉ` : 'Chưa có vàng' },
    { href: '#cho-muon', mau: '#7f9cc4', nhan: 'Đang cho mượn', so: tienD(k.dangChoMuon), phu: `${k.dsNguoi.filter((p) => p.con > 0).length} người${k.tinhNo ? '' : ' · chưa cộng vào tổng'}` },
  ];
  $('#hero-tach').innerHTML = tach.map((t, i) => `<a class="tach" href="${t.href}" style="--i:${i}">
    <span class="tach__nhan"><span class="cham-mau" style="background:${t.mau}"></span>${t.nhan}</span>
    <span class="tach__so num money">${t.so}</span><span class="tach__phu">${t.phu}</span></a>`).join('');

  const muc = st.caiDat.mucTieu || 0;
  if (muc > 0) {
    const p = Math.max(0, Math.min(1, k.tong / muc));
    $('#muc-tieu').innerHTML = `<svg class="vong" viewBox="0 0 56 56" aria-hidden="true"><circle class="nen" cx="28" cy="28" r="24"/><circle class="chay" cx="28" cy="28" r="24" stroke-dasharray="${VONG}" stroke-dashoffset="${VONG}"/></svg>
      <div>Mục tiêu <b class="money">${tienD(muc)}</b><br>Đạt <b>${Math.floor(p * 100)}%</b>${p < 1 ? ` · còn <span class="money">${tienD(muc - k.tong)}</span>` : ' · đã vượt mục tiêu'} · <button class="btn--link" data-muc-tieu style="color:#fff;text-decoration:underline 1px;text-underline-offset:3px;min-height:32px">đổi</button></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const c = $('#muc-tieu .chay'); if (c) c.style.strokeDashoffset = VONG * (1 - p); }));
    if (tongTruoc !== null && tongTruoc < muc && k.tong >= muc) phaoGiay(200);
  } else $('#muc-tieu').innerHTML = '';
  tongTruoc = k.tong;
}

// ───────────────────────── Ô chỉ số ─────────────────────────
export function veChiSo() {
  const k = app.kq;
  const thangN = k.dsThang.length || 1;
  const lon = k.ruiLon[0];
  const tot = k.thangTot;
  const laiVang = k.vangGiaTri - k.vangVon;
  const o = [
    { nhan: 'Tiền trong sổ', icon: 'vi', v: k.tien, phu: `Gửi − rút, sau ${fmt(k.soGd)} giao dịch`, act: 'bang' },
    { nhan: 'Vàng quy tiền', icon: 'vang', v: k.vangGiaTri, phu: k.vangVon ? `${laiVang >= 0 ? 'Lãi' : 'Lỗ'} <b class="${laiVang >= 0 ? 'len' : 'xuong'} money">${tienDau(laiVang)}</b> so với giá mua` : 'Chưa nhập giá mua', act: 'vang' },
    { nhan: 'Đang cho mượn', icon: 'nguoi', v: k.dangChoMuon, phu: `${k.dsNguoi.filter((p) => p.con > 0).length} người còn nợ`, act: 'no' },
    { nhan: 'Tổng gửi vào', icon: 'len', v: k.vao, phu: `TB <b class="money">${app.anSo ? '•••' : fmtShort(k.vao / thangN)}</b> mỗi tháng`, act: 'loc-vao' },
    { nhan: 'Tổng rút ra', icon: 'ha', v: k.ra, phu: `TB <b class="money">${app.anSo ? '•••' : fmtShort(k.ra / thangN)}</b> mỗi tháng`, act: 'loc-ra' },
    { nhan: 'Dư ròng mỗi tháng', icon: (k.vao - k.ra) >= 0 ? 'tang' : 'giam', v: (k.vao - k.ra) / thangN, phu: `Trung bình ${fmt(thangN)} tháng`, act: 'bieu-do', dau: true },
    { nhan: 'Tháng để dành nhiều nhất', icon: 'lich', chu: tot ? fmtMonth(tot.k, true) : '—', phu: tot ? `Dư <b class="money">${tienDau(tot.vao - tot.ra)}</b>` : '', act: tot ? `thang:${tot.k}` : '' },
    { nhan: 'Khoản rút lớn nhất', icon: 'dich', v: lon?.soTien || 0, phu: lon ? `${esc(lon.ghiChu || 'Không ghi chú')} · ${fmtDate(lon.ngay)}` : '', act: lon ? `mo:${lon.id}` : '' },
  ];
  const luoi = $('#o-grid');
  if (luoi.childElementCount !== o.length) {
    luoi.innerHTML = o.map((x, i) => `<button class="card card--re o rv nghieng" style="--i:${i}" data-act="${x.act}">
      <span class="o__nhan">${svg(x.icon)}${x.nhan}</span><span class="o__so num money"></span><span class="o__phu"></span></button>`).join('');
    theoDoiHien(luoi);
  }
  [...luoi.children].forEach((el, i) => {
    const x = o[i];
    el.dataset.act = x.act;
    const so = el.querySelector('.o__so');
    if (x.chu) so.textContent = x.chu;
    else if (app.anSo) { so.textContent = '•••••• đ'; so.dataset.v = x.v; }
    else demSo(so, x.v, (n) => `${x.dau && n > 0 ? '+' : x.dau && n < 0 ? '−' : ''}${fmt(Math.abs(n))} đ`);
    el.querySelector('.o__phu').innerHTML = x.phu;
  });
}

// ───────────────────────── Biểu đồ ─────────────────────────
let bdDaVe = false, bdIo = null;
export function veBieuDo(epBuoc = false) {
  const sec = $('#bieu-do');
  if (!bdDaVe && !epBuoc) {
    // Chỉ vẽ khi cuộn gần tới (để hiệu ứng vẽ dần chạy đúng lúc nhìn thấy)
    bdIo ||= new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { bdIo.disconnect(); bdIo = null; bdDaVe = true; veBieuDo(true); } }, { rootMargin: '200px 0px' });
    bdIo.observe(sec);
    return;
  }
  bdDaVe = true;
  const k = app.kq;
  if (!k.soGd) {
    for (const id of ['c-sodu', 'c-thang', 'c-nam']) $(`#${id}`).closest('.bd-khung').innerHTML = `<canvas id="${id}"></canvas><p class="trong">Chưa có giao dịch để vẽ.</p>`;
    $('#ds-nhom').innerHTML = $('#ds-lon').innerHTML = '<p class="trong">Chưa có dữ liệu.</p>';
    $('#lich').innerHTML = '';
    return;
  }
  BD.veSoDu($('#c-sodu'), k, app.khoang);
  $$('#cg-sodu button').forEach((b) => { b.setAttribute('aria-pressed', 'true'); });
  if (k.dangChoMuon <= 0) $('#cg-sodu [data-ds="1"]').setAttribute('aria-pressed', 'false');
  const dinh = k.ngay.reduce((a, b) => (b.tien > a.tien ? b : a), k.ngay[0]);
  $('#sub-sodu').innerHTML = `Hiện <b class="money">${tienD(k.tien)}</b> · cao nhất <span class="money">${tienD(dinh.tien)}</span> ngày ${fmtDate(dinh.ngay)}`;

  BD.veThang($('#c-thang'), k, app.khoang, (thang) => locThang(thang));
  $$('#cg-thang button').forEach((b) => b.setAttribute('aria-pressed', 'true'));
  const dsT = app.khoang ? k.dsThang.slice(-app.khoang) : k.dsThang;
  const tv = dsT.reduce((s, x) => s + x.vao, 0), tr = dsT.reduce((s, x) => s + x.ra, 0);
  $('#sub-thang').innerHTML = `${dsT.length} tháng · vào <span class="money">${tienD(tv)}</span> · ra <span class="money">${tienD(tr)}</span> · dư <b class="money">${tienDau(tv - tr)}</b>`;

  BD.veNam($('#c-nam'), k);
  const namCuoi = k.nam[k.nam.length - 1];
  $('#sub-nam').innerHTML = namCuoi ? `Năm ${namCuoi.k}: dư <b class="money">${tienDau(namCuoi.vao - namCuoi.ra)}</b>` : '';

  const maxN = k.nhom[0]?.v || 1, tongRa = k.nhom.reduce((s, x) => s + x.v, 0) || 1;
  $('#ds-nhom').innerHTML = k.nhom.map((n, i) => `<button class="thanh" style="--i:${i}" data-nhom="${n.id}">
    <span class="thanh__ten">${esc(n.ten)}</span><span class="thanh__so num money">${tienD(n.v)}</span>
    <span class="thanh__ray"><i style="--p:${n.v / maxN}"></i></span>
    <span class="thanh__phu">${Math.round((n.v / tongRa) * 1000) / 10}% tổng rút</span></button>`).join('');
  const top = k.ruiLon.slice(0, 10), maxL = top[0]?.soTien || 1;
  $('#ds-lon').innerHTML = top.map((t, i) => `<button class="thanh" style="--i:${i}" data-mo="${t.id}">
    <span class="thanh__ten">${esc(t.ghiChu || tenNhom(t.nhom))}</span><span class="thanh__so num money">${tienD(t.soTien)}</span>
    <span class="thanh__ray"><i style="--p:${t.soTien / maxL}"></i></span>
    <span class="thanh__phu">${fmtDate(t.ngay)} · ${esc(tenNhom(t.nhom))}</span></button>`).join('');
  $('#lich').innerHTML = BD.lichHtml(k);
  theoDoiHien(sec);
}
export const datLaiBieuDo = () => { bdDaVe = false; };

function locThang(thang) {
  const [y, m] = thang.split('-').map(Number);
  const cuoi = new Date(y, m, 0).getDate();
  datLoc({ tu: `${thang}-01`, den: `${thang}-${String(cuoi).padStart(2, '0')}`, kieu: '', nhom: '', chu: '' });
  denBang();
}

// ───────────────────────── Vàng ─────────────────────────
export function veVang(dangTai = false, loiTai = '') {
  const st = app.st, gv = st.giaVang, k = app.kq;
  const g = gv.moiNhat;
  const loai = gv.loai || 'nhan';
  const giaDung = giaChi(gv, loai);
  const ls = gv.lichSu || [];
  const truoc = ls.length >= 2 ? ls[ls.length - 2][loai === 'mieng' ? 'mieng' : 'nhan'] : 0;
  const nay = ls.length ? ls[ls.length - 1][loai === 'mieng' ? 'mieng' : 'nhan'] : 0;
  const chenh = truoc && nay ? nay - truoc : 0;
  const cho = dangTai && !g;
  const hang = (l, ten) => {
    const x = g?.[l];
    return `<tr class="${l === loai ? 'dang-dung' : ''}"><td>${ten}</td><td class="num ${cho ? 'cho-xuong' : ''}">${x ? fmt(x.mua) : '—'}</td><td class="num ${cho ? 'cho-xuong' : ''}">${x ? fmt(x.ban) : '—'}</td></tr>`;
  };
  $('#the-gia').innerHTML = `
    <div class="gia-dau">
      <div class="nhan3d" aria-hidden="true"><div class="nhan3d__vong"></div></div>
      <div>
        <div class="card__sub">${gv.thuCong > 0 ? 'Giá tự nhập' : `${tenLoaiVang(loai)} · tiệm ${gv.coSo === 'ban' ? 'bán ra' : 'mua vào'}`} / 1 chỉ</div>
        <div class="gia-to num ${cho ? 'cho-xuong' : ''}">${giaDung ? fmt(giaDung) : '—'} <small>đ</small></div>
        <div class="card__sub">${chenh ? `<span class="mui moi ${chenh > 0 ? 'len' : 'xuong'}">${svg(chenh > 0 ? 'len' : 'ha')}${fmt(Math.abs(chenh))} so với lần trước</span> · ` : ''}${g ? `${esc(g.nguon)} · lấy lúc ${fmtTime(g.luc)}` : dangTai ? 'Đang lấy giá…' : 'Chưa lấy được giá'}</div>
      </div>
      <button class="btn btn--ink btn--icon" id="vang-tai" aria-label="Lấy giá mới" title="Lấy giá mới" style="margin-left:auto">${svg('tai-lai')}</button>
    </div>
    ${loiTai ? `<p class="canh-bao">${esc(loiTai)} ${g ? 'Đang dùng giá lấy được lần trước.' : 'Nhập giá tay bên dưới để quy tiền.'}</p>` : ''}
    <table class="bang-gia"><thead><tr><th>Loại (1 chỉ)</th><th>Tiệm mua vào</th><th>Tiệm bán ra</th></tr></thead>
      <tbody>${hang('nhan', 'Nhẫn 999,9')}${hang('mieng', 'Miếng SJC')}${hang('nutrang', 'Nữ trang 999,9')}</tbody></table>
    <div class="hang-chon">
      <div class="truong"><label for="vang-nguon">Nguồn giá</label><div class="chon"><select class="inp" id="vang-nguon">${Object.entries(TEN_NGUON).map(([k2, v]) => `<option value="${k2}" ${gv.nguon === k2 ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <div class="truong"><label for="vang-coso">Quy tiền theo</label><div class="chon"><select class="inp" id="vang-coso"><option value="mua" ${gv.coSo !== 'ban' ? 'selected' : ''}>Giá tiệm mua vào</option><option value="ban" ${gv.coSo === 'ban' ? 'selected' : ''}>Giá tiệm bán ra</option></select></div></div>
      <div class="truong"><label for="vang-tay">Giá tay / chỉ (trống = tự động)</label><input class="inp num" id="vang-tay" inputmode="decimal" value="${gv.thuCong > 0 ? fmt(gv.thuCong) : ''}" placeholder="vd 13tr6"></div>
    </div>
    <div class="bd-khung" style="height:160px;margin-top:14px" id="khung-gia-vang">${ls.length < 2 ? '<p class="trong" style="padding:24px 8px">Biểu đồ giá sẽ hiện sau khi web ghi được giá từ 2 ngày trở lên (mỗi lần mở web ghi 1 điểm / ngày).</p>' : '<canvas id="c-vang" role="img" aria-label="Giá vàng theo ngày"></canvas>'}</div>`;
  if (ls.length >= 2) BD.veGiaVang($('#c-vang'), ls, loai);

  const ds = k.vang;
  const lai = k.vangGiaTri - k.vangVon;
  $('#the-vang').innerHTML = `
    <div class="card__head"><div><h3 class="card__title">Vàng đang giữ</h3><p class="card__sub">Bấm một dòng để sửa · quy theo ${gv.thuCong > 0 ? 'giá tay' : `giá ${gv.coSo === 'ban' ? 'bán ra' : 'mua vào'} từng loại`}</p></div>
      <button class="btn btn--ink btn--nho" id="vang-them">${svg('plus')}Thêm vàng</button></div>
    <div class="vang-tong">
      <div><span>Tổng số chỉ</span><b class="num">${k.vangChi.toLocaleString('vi-VN')}</b></div>
      <div><span>Giá trị hôm nay</span><b class="num money">${tienD(k.vangGiaTri)}</b></div>
      <div><span>${lai >= 0 ? 'Lãi' : 'Lỗ'} so với lúc mua</span><b class="num money ${lai >= 0 ? 'len' : 'xuong'}">${k.vangVon ? tienDau(lai) : '—'}</b></div>
    </div>
    <div class="vang-ds">${ds.length ? ds.map((v) => {
      const gt = v.soChi * giaChi(gv, v.loai), l = gt - v.giaMua;
      return `<button class="vang-dong" data-vang="${v.id}" style="text-align:left;width:100%;color:inherit">
        <span><b>${v.soChi.toLocaleString('vi-VN')} chỉ</b> · ${tenLoaiVang(v.loai)}<br><span class="phu">Mua ${fmtDate(v.ngay)} · <span class="money">${tienD(v.giaMua)}</span>${v.ghiChu ? ` · ${esc(v.ghiChu)}` : ''}</span></span>
        <span style="text-align:right"><b class="num money">${tienD(gt)}</b><br><span class="phu num money ${l >= 0 ? 'len' : 'xuong'}">${v.giaMua ? tienDau(l) : ''}</span></span></button>`;
    }).join('') : '<p class="trong">Chưa ghi vàng nào. Bấm "Thêm vàng".</p>'}</div>`;
}

// ───────────────────────── Cho mượn ─────────────────────────
export function veNo() {
  const k = app.kq;
  const con = k.dsNguoi.filter((p) => p.con > 0);
  $('#tinh-no').checked = k.tinhNo;
  $('#no-ghi-chu').innerHTML = k.dsNguoi.length
    ? `${con.length} người đang nợ tổng <b class="money">${tienD(k.dangChoMuon)}</b>. Tính từ các dòng "Cho mượn" và "Được trả" trong sổ — ai đã trả mà sổ chưa ghi thì bấm "Ghi khoản trả".`
    : 'Chưa ghi khoản cho mượn nào.';
  if (!k.dsNguoi.length) { $('#no-grid').innerHTML = '<div class="card trong-lon"><h3>Chưa cho ai mượn</h3><p>Khi thêm giao dịch, chọn kiểu "Cho mượn" và gõ tên người mượn — web sẽ tự theo dõi ai còn nợ bao nhiêu.</p></div>'; return; }
  $('#no-grid').innerHTML = k.dsNguoi.map((p, i) => {
    const pt = p.muon ? Math.min(1, p.tra / p.muon) : 1;
    const chu = (p.ten.split(' ').pop() || '?').charAt(0).toUpperCase();
    return `<article class="card no-the rv nghieng" style="--i:${i}">
      <div class="no-the__dau"><span class="chu-cai" aria-hidden="true">${esc(chu)}</span><div><div class="no-the__ten">${esc(p.ten)}</div><div class="card__sub">${p.lan} lần · gần nhất ${fmtDate(p.cuoi)}</div></div></div>
      <div><div class="card__sub">${p.con > 0 ? 'Còn nợ' : p.con < 0 ? 'Trả dư' : 'Đã trả đủ'}</div><div class="no-the__con num money">${tienD(Math.abs(p.con))}</div></div>
      <div class="no-the__vong"><svg class="vong" viewBox="0 0 56 56" aria-hidden="true"><circle class="nen" cx="28" cy="28" r="24"/><circle class="chay" cx="28" cy="28" r="24" stroke-dasharray="${VONG}" stroke-dashoffset="${VONG}" data-p="${pt}"/></svg>
        <span>Đã trả ${Math.round(pt * 100)}%<br>Mượn <span class="money">${app.anSo ? '•••' : fmtShort(p.muon)}</span> · đã trả <span class="money">${app.anSo ? '•••' : fmtShort(p.tra)}</span></span></div>
      <div class="thanh__ray"><i style="--p:${pt};background:var(--twilight)"></i></div>
      <div class="no-the__nut">
        ${p.con > 0 ? `<button class="btn btn--ink btn--nho" data-tra="${esc(p.ten)}" data-con="${p.con}">${svg('plus')}Ghi khoản trả</button>` : ''}
        <button class="btn btn--ink btn--nho" data-xem-nguoi="${esc(p.ten)}">Xem giao dịch</button>
      </div></article>`;
  }).join('');
  theoDoiHien($('#no-grid'));
  // Vòng % chạy khi thẻ hiện
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#no-grid .chay').forEach((c) => { c.style.strokeDashoffset = VONG * (1 - +c.dataset.p); })));
}

// ───────────────────────── Bảng giao dịch ─────────────────────────
export function datLoc(p, ve = true) {
  Object.assign(app.loc, p);
  app.gioiHan = 150;
  $('#loc-chu').value = app.loc.chu;
  $('#loc-nhom').value = app.loc.nhom;
  $('#loc-tu').value = app.loc.tu;
  $('#loc-den').value = app.loc.den;
  $$('#loc-kieu .pill').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === app.loc.kieu)));
  dichBong($('#loc-kieu'));
  if (ve) veBang(true);
}

export function denBang() {
  $('#giao-dich').scrollIntoView({ behavior: fx('cuon-muot') ? 'smooth' : 'auto', block: 'start' });
}

/** Nền viên thuốc trượt dưới mục đang chọn. */
export function dichBong(nhom) {
  const bong = nhom?.querySelector('.bong');
  const on = nhom?.querySelector('[aria-pressed="true"], [aria-checked="true"]');
  if (!bong || !on) return;
  if (!fx('vien-loc')) bong.style.transition = 'none';
  bong.style.width = `${on.offsetWidth}px`;
  bong.style.transform = `translateX(${on.offsetLeft}px)`;
  if (!fx('vien-loc')) requestAnimationFrame(() => { bong.style.transition = ''; });
}

export function napNhomLoc() {
  const dangDung = new Set(app.kq.tx.map((t) => t.nhom));
  $('#loc-nhom').innerHTML = `<option value="">Mọi nhóm</option>${NHOM.filter((n) => dangDung.has(n.id)).map((n) => `<option value="${n.id}">${esc(n.ten)}</option>`).join('')}`;
  $('#loc-nhom').value = app.loc.nhom;
}

function khop(t, q, qTien) {
  if (!q) return true;
  if (qTien && t.soTien === qTien) return true;
  const s = norm(`${t.ghiChu} ${tenNhom(t.nhom)} ${t.nguoi} ${KIEU[t.kieu].ten} ${t.soTien} ${fmtDate(t.ngay)}`);
  return q.split(/\s+/).every((w) => s.includes(w));
}

function giaTriCot(t, cot) {
  switch (cot) {
    case 'ghiChu': return norm(t.ghiChu);
    case 'nhom': return norm(tenNhom(t.nhom));
    case 'vao': return KIEU[t.kieu].tien > 0 ? t.soTien : -1;
    case 'ra': return KIEU[t.kieu].tien < 0 ? t.soTien : -1;
    case 'du': return app.kq.soDu.get(t.id);
    default: return t.ngay + String(t.tao).padStart(15, '0');
  }
}

export function veBang(hieuUng = false) {
  const k = app.kq, L = app.loc;
  const q = norm(L.chu), qTien = parseMoney(L.chu);
  let ds = k.tx.filter((t) => (!L.kieu || t.kieu === L.kieu) && (!L.nhom || t.nhom === L.nhom)
    && (!L.tu || t.ngay >= L.tu) && (!L.den || t.ngay <= L.den) && khop(t, q, Number.isFinite(qTien) ? qTien : 0));
  const { cot, chieu } = app.sap;
  const h = chieu === 'asc' ? 1 : -1;
  ds = ds.sort((a, b) => { const x = giaTriCot(a, cot), y = giaTriCot(b, cot); return x < y ? -h : x > y ? h : 0; });
  $$('#bang th[data-cot]').forEach((th) => { if (th.dataset.cot === cot) th.setAttribute('aria-sort', chieu === 'asc' ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort'); });

  const dangLoc = L.kieu || L.nhom || L.tu || L.den || L.chu;
  const vao = ds.reduce((s, t) => s + (KIEU[t.kieu].tien > 0 ? t.soTien : 0), 0);
  const ra = ds.reduce((s, t) => s + (KIEU[t.kieu].tien < 0 && !t.ngoaiSo ? t.soTien : 0), 0);
  $('#tom-loc').innerHTML = `<span><b>${fmt(ds.length)}</b> giao dịch</span><span>vào <b class="money vao" style="color:var(--signal-dam)">${tienDau(vao)}</b></span><span>ra <b class="money">${tienDau(-ra)}</b></span>${dangLoc ? '<button class="btn btn--ink btn--nho" id="bo-loc">Bỏ lọc</button>' : ''}`;

  const nhomThang = cot === 'ngay';
  const thangTong = new Map();
  if (nhomThang) for (const t of ds) {
    const mk = monthKey(t.ngay), x = thangTong.get(mk) || { vao: 0, ra: 0, n: 0 };
    if (KIEU[t.kieu].tien > 0) x.vao += t.soTien; else if (!t.ngoaiSo) x.ra += t.soTien;
    x.n++; thangTong.set(mk, x);
  }
  const hien = ds.slice(0, app.gioiHan);
  let html = '', thangTruoc = '', i = 0;
  for (const t of hien) {
    if (nhomThang) {
      const mk = monthKey(t.ngay);
      if (mk !== thangTruoc) {
        const x = thangTong.get(mk);
        html += `<tr class="thang"><td colspan="7"><b>${fmtMonth(mk, true)}</b> vào <span class="money">${tienDau(x.vao)}</span> · ra <span class="money">${tienDau(-x.ra)}</span> · ${x.n} giao dịch</td></tr>`;
        thangTruoc = mk;
      }
    }
    const kv = KIEU[t.kieu], laVao = kv.tien > 0;
    const the = [`<span class="nhan-nho nhan-nhom">${esc(tenNhom(t.nhom))}</span>`];
    if (t.kieu === 'muon') the.push(`<span class="nhan-nho muon">Cho ${esc(t.nguoi || '?')} mượn${t.ngoaiSo ? ' · tiền ngoài' : ''}</span>`);
    if (t.kieu === 'tra') the.push(`<span class="nhan-nho tra">${esc(t.nguoi || '?')} trả</span>`);
    if (t.uocNgay) the.push('<span class="nhan-nho uoc" title="Sổ gốc không ghi ngày — đã lấy ngày dòng phía trên">ngày ước</span>');
    if (t.nguon.includes('đã sửa năm')) the.push(`<span class="nhan-nho uoc" title="${esc(t.nguon)}">đã sửa năm</span>`);
    const tienCot = `${laVao ? '+' : '−'}${tien(t.soTien)}`;
    html += `<tr class="dong${app.moiSua === t.id ? ' moi' : ''}" data-id="${t.id}" tabindex="0" style="--i:${Math.min(i++, 30)}" aria-label="${esc(`${fmtDate(t.ngay)} ${kv.ten} ${app.anSo ? '' : fmt(t.soTien) + ' đồng'} ${t.ghiChu}`)}">
      <td class="ngay num">${fmtDate(t.ngay)}</td>
      <td class="ghi">${esc(t.ghiChu) || `<span style="color:var(--chu-sang-phu)">${kv.ten}</span>`}<div class="the">${the.join('')}</div></td>
      <td class="nhom-cot">${esc(tenNhom(t.nhom))}</td>
      <td class="so num ${laVao ? 'vao money' : 'trong-o'}">${laVao ? tienCot : ''}</td>
      <td class="so num ${laVao ? 'trong-o' : 'ra money'}">${laVao ? '' : tienCot}</td>
      <td class="so num du money">${t.ngoaiSo ? '<span title="Tiền ngoài, không trừ sổ">—</span>' : tien(k.soDu.get(t.id))}</td>
      <td class="nut"><button data-xoa="${t.id}" aria-label="Xoá giao dịch ${esc(t.ghiChu || kv.ten)} ngày ${fmtDate(t.ngay)}" title="Xoá">${svg('xoa')}</button></td></tr>`;
  }
  const than = $('#than-bang');
  than.innerHTML = html || `<tr><td colspan="7"><div class="trong-lon"><h3>${k.soGd ? 'Không có giao dịch khớp bộ lọc' : 'Sổ đang trống'}</h3><p>${k.soGd ? 'Thử bỏ bớt điều kiện lọc.' : 'Bấm "Thêm" để ghi khoản đầu tiên, hoặc vào Cài đặt → Dữ liệu để nhập file Excel cũ.'}</p></div></td></tr>`;
  than.classList.toggle('hien', hieuUng && fx('dong-hien'));
  if (hieuUng) setTimeout(() => than.classList.remove('hien'), 1200);
  $('#xem-them').innerHTML = ds.length > hien.length ? `<button class="btn btn--ink" id="nut-xem-them">Xem thêm ${fmt(Math.min(150, ds.length - hien.length))} dòng (còn ${fmt(ds.length - hien.length)})</button>` : '';
  if (app.moiSua) setTimeout(() => { app.moiSua = null; }, 50);
}

// ───────────────────────── Ngăn nhập giao dịch ─────────────────────────
export function napNhomForm(kieu, chon) {
  const ds = NHOM.filter((n) => (kieu === 'muon' || kieu === 'tra' ? n.id === 'chovay' : n.id !== 'chovay' && (n.kieu === 'ca' || n.kieu === kieu)));
  $('#gd-nhom').innerHTML = ds.map((n) => `<option value="${n.id}">${esc(n.ten)}</option>`).join('');
  $('#gd-nhom').value = ds.some((n) => n.id === chon) ? chon : ds[0].id;
}

export function napGoiY() {
  const ghi = new Map();
  for (const t of app.kq.tx) if (t.ghiChu) ghi.set(t.ghiChu, (ghi.get(t.ghiChu) || 0) + 1);
  $('#ds-ghi-chu').innerHTML = [...ghi.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([g]) => `<option value="${esc(g)}">`).join('');
  $('#ds-nguoi').innerHTML = app.kq.dsNguoi.map((p) => `<option value="${esc(p.ten)}">`).join('');
}

export { NHOM_BY_ID };
