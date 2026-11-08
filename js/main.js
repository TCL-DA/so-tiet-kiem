// Điều phối: màn khoá → giải mã → vẽ; lưu (mã hoá) mỗi lần đổi; đồng bộ GitHub; giá vàng; phím tắt; thanh điều hướng.
import { app, hoanTacCuoi, capNhat, xoaLichSuHoanTac } from './app.js';
import { tinh, trangThaiMoi, gop, donDauXoa, conSong, KIEU } from './store.js';
import { $, $$, debounce, fmt, fmtTime, parseMoney, esc } from './util.js';
import * as V from './vault.js';
import * as SY from './sync.js';
import { layGiaVang, ghiLichSu } from './gold.js';
import { apFx, fx, ganHieuUngChuot, theoDoiHien, goiYPhim, phaoGiay } from './effects.js';
import { batTroi, capNhatTroi } from './sky.js';
import * as UI from './ui.js';
import { moGiaoDich, dangMoNgan, dongNgan } from './form.js';
import { api, moCaiDat, xemTruocFile, moVang, moMucTieu, hoiMatKhau } from './hop.js';
import { huyHet } from './charts.js';

const S = { khoa: null, muoi: null, mk: null, nho: false };   // khoá đang dùng (chỉ trong bộ nhớ)

// ───────────────────────── Thông báo ─────────────────────────
app.thongBao = (chu, o = {}) => {
  const t = document.createElement('div');
  t.className = `toast${o.loi ? ' loi' : ''}`;
  t.setAttribute('role', o.loi ? 'alert' : 'status');
  const thoiGian = o.hoanTac ? 6000 : o.loi ? 6000 : 3500;
  t.innerHTML = `${o.tich ? '<svg class="tich" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}<span class="toast__chu">${esc(chu)}</span>
    ${o.hoanTac ? `<button class="btn btn--ink btn--nho" data-hoan-tac><svg class="vong-dem" viewBox="0 0 22 22" style="--t:${thoiGian}ms" aria-hidden="true"><circle cx="11" cy="11" r="9"/></svg>Hoàn tác</button>` : ''}`;
  $('#toasts').appendChild(t);
  while ($('#toasts').childElementCount > 3) $('#toasts').firstElementChild.remove();
  const di = () => { t.classList.add('di'); setTimeout(() => t.remove(), fx('toast-truot') ? 260 : 0); };
  const hen = setTimeout(di, thoiGian);
  t.querySelector('[data-hoan-tac]')?.addEventListener('click', () => { clearTimeout(hen); di(); const m = hoanTacCuoi(); if (m) app.thongBao(m, { tich: true }); });
};

// ───────────────────────── Vẽ lại ─────────────────────────
app.veLai = () => {
  UI.veTongQuan();
  UI.veChiSo();
  UI.veVang();
  UI.veNo();
  UI.napNhomLoc();
  UI.veBang();
  UI.veBieuDo();
  $('#chan-tom').textContent = app.kq.soGd ? `${fmt(app.kq.soGd)} giao dịch · ${app.kq.dau.split('-').reverse().join('/')} → ${app.kq.cuoi.split('-').reverse().join('/')}` : '';
  theoDoiHien();
};

// ───────────────────────── Lưu (mã hoá) + đẩy GitHub ─────────────────────────
let dangLuu = Promise.resolve();
app.luu = () => {
  dangLuu = dangLuu.then(async () => {
    if (!S.khoa) return;
    const blob = await V.maHoa(app.st, S.khoa, S.muoi);
    if (!V.ghiMay(blob)) app.thongBao('Trình duyệt không cho lưu (bộ nhớ đầy hoặc chế độ ẩn danh) — nhớ xuất file sao lưu.', { loi: true });
    if (SY.coDongBo()) henDay();
  }).catch((e) => app.thongBao(`Lỗi khi lưu: ${e.message}`, { loi: true }));
  return dangLuu;
};

function ttDongBo(tt, chu) {
  const el = $('#dong-bo');
  el.classList.toggle('dang', tt === 'dang');
  el.classList.toggle('loi', tt === 'loi');
  el.querySelector('span').textContent = chu;
  el.title = chu;
  $('#chan-dong-bo').textContent = SY.coDongBo() ? ` và bản mã hoá trong repo riêng tư ${SY.docCauHinh().repo}` : '';
}

const henDay = debounce(() => dongBo(), 2500);
let dangDongBo = false, canLai = false;

/** Kéo về → gộp → đẩy lên nếu máy này có thay đổi. */
async function dongBo() {
  const cfg = SY.docCauHinh();
  if (!cfg.token) { ttDongBo('', 'Chỉ trên máy này'); return; }
  if (!S.khoa) return;
  if (dangDongBo) { canLai = true; return; }
  dangDongBo = true; ttDongBo('dang', 'Đang đồng bộ…');
  try {
    for (let lan = 0; lan < 3; lan++) {
      const xa = await SY.keo(cfg);
      let sha = xa?.sha || '';
      if (xa) {
        let khoaXa = S.khoa;
        if (xa.blob.salt !== S.muoi) {
          let mk = S.mk;
          if (!mk) mk = await hoiMatKhau('Bản trên GitHub được khoá bằng mật khẩu khác với máy này đang nhớ (có thể đã đổi mật khẩu ở máy khác). Gõ mật khẩu hiện tại để gộp.');
          if (!mk) throw new Error('Chưa gộp được — cần mật khẩu.');
          khoaXa = await V.danKhoa(mk, xa.blob.salt, xa.blob.iter);
        }
        let stXa;
        try { stXa = await V.giaiMa(xa.blob, khoaXa); } catch { throw new Error('Không giải mã được bản trên GitHub — mật khẩu khác.'); }
        if (xa.blob.salt !== S.muoi && S.mk) {
          // Máy khác đã đổi mật khẩu → máy này theo khoá mới
          S.khoa = khoaXa; S.muoi = xa.blob.salt;
          if (S.nho) await V.nhoKhoa(S.khoa, S.muoi);
        }
        const truoc = vanTay(app.st);
        const gopLai = gop(app.st, stXa);
        if (vanTay(gopLai) !== truoc) {
          app.st = donDauXoa(gopLai);
          app.kq = tinh(app.st);
          app.veLai();
          V.ghiMay(await V.maHoa(app.st, S.khoa, S.muoi));
        }
        if (vanTay(app.st) === vanTay(stXa) && xa.blob.salt === S.muoi) { SY.ghiCauHinh({ ...SY.docCauHinh(), sha, lanCuoi: Date.now() }); break; }
      }
      const r = await SY.day(await V.maHoa(app.st, S.khoa, S.muoi), sha, cfg);
      if (r.xungDot) continue;
      SY.ghiCauHinh({ ...SY.docCauHinh(), sha: r.sha, lanCuoi: Date.now() });
      break;
    }
    ttDongBo('', `Đã đồng bộ ${fmtTime(Date.now()).split(' ')[0]}`);
  } catch (e) {
    ttDongBo('loi', 'Lỗi đồng bộ');
    app.thongBao(`Đồng bộ GitHub: ${e.message}`, { loi: true });
  } finally {
    dangDongBo = false;
    if (canLai) { canLai = false; henDay(); }
  }
}
/** Dấu vân tay nội dung để biết có khác nhau không. */
const vanTay = (st) => JSON.stringify([st.tx.map((t) => `${t.id}:${t.sua}:${t.xoa || 0}`).sort(), st.vang.map((t) => `${t.id}:${t.sua}:${t.xoa || 0}`).sort(), st.caiDat, st.giaVang.thuCong, st.giaVang.loai, st.giaVang.coSo, st.giaVang.nguon]);

// ───────────────────────── Giá vàng ─────────────────────────
let dangLayGia = false;
async function capNhatGiaVang(ep = false) {
  const gv = app.st.giaVang;
  if (dangLayGia) return;
  if (!ep && gv.moiNhat && Date.now() - gv.moiNhat.luc < 20 * 60e3) return;
  dangLayGia = true;
  UI.veVang(true);
  try {
    const g = await layGiaVang(gv.nguon || 'tu-dong');
    gv.moiNhat = g;
    ghiLichSu(gv, g);
    capNhat();
    if (ep) app.thongBao(`Giá vàng mới từ ${g.nguon}`, { tich: true });
  } catch (e) {
    UI.veVang(false, e.message);
  } finally { dangLayGia = false; }
}

// ───────────────────────── Màn khoá ─────────────────────────
const K = { el: $('#khoa'), form: $('#form-khoa'), mk: $('#mk'), mk2: $('#mk2'), loi: $('#loi-khoa'), mota: $('#khoa-mo-ta'), nut: $('#nut-khoa'), phu: $('#khoa-phu') };
let cheDoKhoa = 'mo';   // 'mo' | 'tao'

function hienKhoa(cheDo, moTa) {
  cheDoKhoa = cheDo;
  K.el.hidden = false;
  K.el.classList.remove('dang-mo');
  document.body.style.overflow = 'hidden';
  $('#truong-mk2').hidden = cheDo !== 'tao';
  K.mk.autocomplete = cheDo === 'tao' ? 'new-password' : 'current-password';
  K.nut.textContent = cheDo === 'tao' ? 'Tạo sổ' : 'Mở sổ';
  K.mota.textContent = moTa || (cheDo === 'tao' ? 'Lần đầu dùng trên máy này. Đặt mật khẩu để mã hoá sổ.' : 'Gõ mật khẩu để mở.');
  K.loi.textContent = '';
  K.mk.value = K.mk2.value = '';
  const cfg = SY.docCauHinh();
  K.phu.innerHTML = cheDo === 'tao'
    ? `<button type="button" id="khoa-github">Đã có sổ trên máy khác? Lấy từ GitHub</button>`
    : `<button type="button" id="khoa-quen">Quên mật khẩu?</button>${cfg.token ? '' : ''}`;
  setTimeout(() => K.mk.focus(), 60);
}

function lacKhoa(chu) {
  K.loi.textContent = chu;
  const o = $('#o-khoa');
  if (fx('khoa-lac')) { o.classList.remove('lac'); void o.offsetWidth; o.classList.add('lac'); }
}

async function moSo(st, khoa, muoi, mk) {
  S.khoa = khoa; S.muoi = muoi; S.mk = mk;
  app.st = donDauXoa({ ...trangThaiMoi(), ...st, giaVang: { ...trangThaiMoi().giaVang, ...(st.giaVang || {}) }, caiDat: { ...trangThaiMoi().caiDat, ...(st.caiDat || {}) } });
  app.kq = tinh(app.st);
  xoaLichSuHoanTac();
  const xong = () => { K.el.hidden = true; K.el.classList.remove('dang-mo'); document.body.style.overflow = ''; };
  if (fx('khoa-mo')) { K.el.classList.add('dang-mo'); setTimeout(xong, 520); } else xong();
  $('#tieu-de-chinh').closest('.hero').classList.remove('in');
  app.veLai();
  requestAnimationFrame(() => $('#tong-quan').classList.add('in'));
  UI.dichBong($('#loc-kieu'));
  capNhatGiaVang();
  dongBo();
  if (!app.kq.soGd) setTimeout(() => goiYNhap(), 700);
  datHenTuKhoa();
}

function goiYNhap() {
  $('#than-bang').innerHTML = `<tr><td colspan="7"><div class="trong-lon"><h3>Sổ đang trống</h3><p>Nhập luôn sổ Excel cũ (file "Tiết kiệm.xlsx") — web tự đọc ngày, ghi chú, gửi / rút, cho mượn và số chỉ vàng, có bước xem trước.</p>
    <div class="hang-nut" style="justify-content:center"><button class="btn btn--dac" id="trong-nhap"><svg class="i"><use href="#i-tai-len"/></svg>Nhập file Excel…</button><button class="btn btn--ink" data-them>Ghi khoản đầu tiên</button></div></div></td></tr>`;
  $('#trong-nhap').onclick = () => $('#chon-file').click();
}

K.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mk = K.mk.value;
  K.nut.disabled = true;
  try {
    if (cheDoKhoa === 'tao') {
      if (mk.length < 8) return lacKhoa('Mật khẩu cần ít nhất 8 ký tự.');
      if (mk !== K.mk2.value) return lacKhoa('Hai lần gõ không giống nhau.');
      const muoi = V.taoMuoi();
      const khoa = await V.danKhoa(mk, muoi);
      const st = trangThaiMoi();
      V.ghiMay(await V.maHoa(st, khoa, muoi));
      S.nho = $('#nho-may').checked;
      if (S.nho) await V.nhoKhoa(khoa, muoi);
      await moSo(st, khoa, muoi, mk);
      return;
    }
    const blob = V.docMay();
    if (!blob) return hienKhoa('tao');
    K.nut.textContent = 'Đang mở…';
    const khoa = await V.danKhoa(mk, blob.salt, blob.iter);
    let st;
    try { st = await V.giaiMa(blob, khoa); } catch { return lacKhoa('Sai mật khẩu.'); }
    S.nho = $('#nho-may').checked;
    if (S.nho) await V.nhoKhoa(khoa, blob.salt); else await V.quenKhoa();
    await moSo(st, khoa, blob.salt, mk);
  } finally { K.nut.disabled = false; K.nut.textContent = cheDoKhoa === 'tao' ? 'Tạo sổ' : 'Mở sổ'; }
});
K.mk2.addEventListener('input', () => {});
K.mk.addEventListener('input', () => { if (cheDoKhoa === 'tao') $('#do-manh').dataset.d = V.doManh(K.mk.value); });
K.phu.addEventListener('click', async (e) => {
  if (e.target.id === 'khoa-quen') {
    K.mota.innerHTML = 'Mật khẩu không khôi phục được (dữ liệu mã hoá bằng chính mật khẩu đó). Cách làm lại: tạo sổ mới rồi nhập lại file Excel gốc hoặc file sao lưu JSON.';
    K.phu.innerHTML = '<button type="button" id="khoa-lam-lai">Xoá sổ trên máy này và tạo lại</button>';
  } else if (e.target.id === 'khoa-lam-lai') {
    if (!confirm('Xoá sổ đã mã hoá trên máy này? (File Excel / sao lưu của bạn không bị ảnh hưởng)')) return;
    V.xoaMay(); await V.quenKhoa(); hienKhoa('tao');
  } else if (e.target.id === 'khoa-github') {
    K.phu.innerHTML = `<div class="card" style="text-align:left;display:flex;flex-direction:column;gap:10px">
      <div class="truong"><label for="kg-repo">Repo dữ liệu</label><input class="inp" id="kg-repo" value="${esc(SY.docCauHinh().repo)}"></div>
      <div class="truong"><label for="kg-token">Token GitHub (fine-grained, quyền Contents)</label><input class="inp" id="kg-token" type="password" autocomplete="off"></div>
      <p class="loi-chu" id="kg-loi"></p><button type="button" class="btn btn--dac" id="kg-keo">Lấy sổ về</button></div>`;
  } else if (e.target.id === 'kg-keo') {
    const cfg = { ...SY.docCauHinh(), repo: $('#kg-repo').value.trim(), token: $('#kg-token').value.trim() };
    try {
      await SY.kiemTra(cfg);
      const xa = await SY.keo(cfg);
      if (!xa) throw new Error('Repo chưa có sổ nào — tạo sổ ở đây rồi bật đồng bộ là được.');
      SY.ghiCauHinh({ ...cfg, sha: xa.sha });
      V.ghiMay(xa.blob);
      hienKhoa('mo', 'Đã lấy sổ từ GitHub. Gõ mật khẩu của sổ để mở.');
    } catch (er) { $('#kg-loi').textContent = er.message; }
  }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-hien-mk]');
  if (!b) return;
  const inp = document.getElementById(b.dataset.hienMk);
  const hien = inp.type === 'password';
  inp.type = hien ? 'text' : 'password';
  b.innerHTML = `<svg class="i"><use href="#i-${hien ? 'eye-off' : 'eye'}"/></svg>`;
  b.setAttribute('aria-label', hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
});

function khoaSo() {
  S.khoa = S.muoi = S.mk = null;
  V.quenKhoa();
  app.st = null; app.kq = null;
  huyHet(); UI.datLaiBieuDo();
  if (dangMoNgan()) dongNgan();
  hienKhoa(V.docMay() ? 'mo' : 'tao');
}

let henKhoa;
function datHenTuKhoa() {
  clearTimeout(henKhoa);
  const phut = app.st?.caiDat.tuKhoa ?? 15;
  if (!phut || S.nho || !S.khoa) return;
  henKhoa = setTimeout(() => { if (S.khoa) { khoaSo(); } }, phut * 60e3);
}
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, debounce(datHenTuKhoa, 1000), { passive: true }));

// ───────────────────────── API cho hộp thoại ─────────────────────────
api.apDung = (kq, cheDo) => {
  const st = app.st;
  if (cheDo === 'gop') {
    const khoaTrung = (t) => `${t.ngay}|${t.soTien}|${t.ghiChu}|${t.kieu}`;
    const co = new Set(st.tx.filter(conSong).map(khoaTrung));
    const moi = kq.tx.filter((t) => !co.has(khoaTrung(t)));
    st.tx.push(...moi);
    st.vang.push(...kq.vang);
    app.thongBao(`Đã gộp ${fmt(moi.length)} giao dịch mới (bỏ ${fmt(kq.tx.length - moi.length)} dòng trùng)`, { tich: true });
  } else {
    const now = Date.now();
    st.tx = [...st.tx.map((t) => ({ ...t, xoa: t.xoa || now, sua: now })), ...kq.tx];
    st.vang = [...st.vang.map((v) => ({ ...v, xoa: v.xoa || now, sua: now })), ...kq.vang];
    if (kq.giaVang) st.giaVang = { ...st.giaVang, ...kq.giaVang };
    if (kq.caiDat) st.caiDat = { ...st.caiDat, ...kq.caiDat };
    app.thongBao(`Đã nhập ${fmt(kq.tx.length)} giao dịch`, { tich: true });
  }
  xoaLichSuHoanTac();
  app.moiSua = null;
  UI.datLaiBieuDo();
  capNhat();
  phaoGiay(160);
};

api.doiMatKhau = async (cu, moi) => {
  const blob = V.docMay();
  const kCu = await V.danKhoa(cu, blob.salt, blob.iter);
  try { await V.giaiMa(blob, kCu); } catch { throw new Error('Mật khẩu đang dùng không đúng.'); }
  S.muoi = V.taoMuoi();
  S.khoa = await V.danKhoa(moi, S.muoi);
  S.mk = moi;
  if (S.nho) await V.nhoKhoa(S.khoa, S.muoi);
  await app.luu();
  if (SY.coDongBo()) {
    // Ép ghi đè bản trên GitHub bằng khoá mới
    const cfg = SY.docCauHinh();
    const xa = await SY.keo(cfg).catch(() => null);
    const r = await SY.day(await V.maHoa(app.st, S.khoa, S.muoi), xa?.sha || '', cfg);
    if (r.sha) SY.ghiCauHinh({ ...SY.docCauHinh(), sha: r.sha, lanCuoi: Date.now() });
  }
};
api.dongBoNgay = () => dongBo();
api.khoa = () => khoaSo();
api.xoaHet = async () => {
  V.xoaMay(); await V.quenKhoa();
  app.thongBao('Đã xoá sổ trên máy này');
  S.khoa = null; app.st = null;
  huyHet(); UI.datLaiBieuDo();
  hienKhoa('tao');
};

// ───────────────────────── Sự kiện trang ─────────────────────────
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-them]')) { e.preventDefault(); if (app.st) moGiaoDich(); return; }
  if (t.closest('#btn-cai-dat')) { moCaiDat(); return; }
  if (t.closest('#btn-khoa')) { khoaSo(); return; }
  if (t.closest('#btn-an-so')) { doiAnSo(); return; }
  if (t.closest('[data-muc-tieu]')) { moMucTieu(); return; }
  if (t.closest('#bo-loc')) { UI.datLoc({ chu: '', nhom: '', kieu: '', tu: '', den: '' }); return; }
  if (t.closest('#nut-xem-them')) { app.gioiHan += 150; UI.veBang(); return; }
  if (t.closest('#vang-tai')) { capNhatGiaVang(true); return; }
  if (t.closest('#vang-them')) { moVang(); return; }
  const v = t.closest('[data-vang]'); if (v) { moVang(app.st.vang.find((x) => x.id === v.dataset.vang)); return; }
  const tra = t.closest('[data-tra]'); if (tra) { moGiaoDich(null, { kieu: 'tra', nguoi: tra.dataset.tra, soTien: +tra.dataset.con, ghiChu: `${tra.dataset.tra} trả` }); return; }
  const xn = t.closest('[data-xem-nguoi]'); if (xn) { UI.datLoc({ chu: xn.dataset.xemNguoi, kieu: '', nhom: 'chovay', tu: '', den: '' }); UI.denBang(); return; }
  const nh = t.closest('[data-nhom]'); if (nh) { UI.datLoc({ nhom: nh.dataset.nhom, kieu: 'ra', chu: '', tu: '', den: '' }); UI.denBang(); return; }
  const mo = t.closest('[data-mo]'); if (mo) { moGiaoDich(app.st.tx.find((x) => x.id === mo.dataset.mo)); return; }
  const o = t.closest('.o[data-act]'); if (o) { hanhDongO(o.dataset.act); return; }
  const lich = t.closest('.lich .n[data-ngay]'); if (lich && lich.dataset.ngay) { UI.datLoc({ tu: lich.dataset.ngay, den: lich.dataset.ngay, kieu: '', nhom: '', chu: '' }); UI.denBang(); return; }
  const xoa = t.closest('[data-xoa]'); if (xoa) { e.stopPropagation(); xoaDong(xoa.dataset.xoa); return; }
  const dong = t.closest('#than-bang tr.dong'); if (dong) { moGiaoDich(app.st.tx.find((x) => x.id === dong.dataset.id)); return; }
  const cg = t.closest('.chu-giai button[data-ds]');
  if (cg) {
    const hien = cg.getAttribute('aria-pressed') !== 'true';
    cg.setAttribute('aria-pressed', String(hien));
    import('./charts.js').then((BD) => BD.anHienDuong(cg.closest('#cg-sodu') ? 'sodu' : 'thang', +cg.dataset.ds, hien));
  }
});

function hanhDongO(act) {
  if (act === 'bang') { UI.datLoc({ chu: '', nhom: '', kieu: '', tu: '', den: '' }); UI.denBang(); }
  else if (act === 'vang') $('#vang').scrollIntoView({ behavior: fx('cuon-muot') ? 'smooth' : 'auto' });
  else if (act === 'no') $('#cho-muon').scrollIntoView({ behavior: fx('cuon-muot') ? 'smooth' : 'auto' });
  else if (act === 'bieu-do') $('#bieu-do').scrollIntoView({ behavior: fx('cuon-muot') ? 'smooth' : 'auto' });
  else if (act === 'loc-vao') { UI.datLoc({ kieu: 'vao', nhom: '', chu: '', tu: '', den: '' }); UI.denBang(); }
  else if (act === 'loc-ra') { UI.datLoc({ kieu: 'ra', nhom: '', chu: '', tu: '', den: '' }); UI.denBang(); }
  else if (act.startsWith('thang:')) {
    const k = act.slice(6), [y, m] = k.split('-').map(Number);
    UI.datLoc({ tu: `${k}-01`, den: `${k}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`, kieu: '', nhom: '', chu: '' }); UI.denBang();
  } else if (act.startsWith('mo:')) moGiaoDich(app.st.tx.find((x) => x.id === act.slice(3)));
}

function xoaDong(id) {
  const t = app.st.tx.find((x) => x.id === id);
  if (!t) return;
  const tr = $(`#than-bang tr[data-id="${id}"]`);
  const lam = () => {
    import('./app.js').then(({ xoaGd }) => {
      xoaGd(id);
      app.thongBao(`Đã xoá "${t.ghiChu || KIEU[t.kieu].ten}" ${fmt(t.soTien)} đ`, { hoanTac: true });
    });
  };
  if (tr && fx('dong-xoa')) { tr.classList.add('dang-xoa'); setTimeout(lam, 360); } else lam();
}

$('#than-bang').addEventListener('keydown', (e) => {
  const tr = e.target.closest('tr.dong');
  if (!tr) return;
  if (e.key === 'Enter') { e.preventDefault(); moGiaoDich(app.st.tx.find((x) => x.id === tr.dataset.id)); }
  if (e.key === 'Delete') { e.preventDefault(); xoaDong(tr.dataset.id); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    let n = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
    while (n && !n.classList.contains('dong')) n = e.key === 'ArrowDown' ? n.nextElementSibling : n.previousElementSibling;
    n?.focus();
  }
});

// Lọc + sắp xếp
$('#loc-chu').addEventListener('input', debounce(() => UI.datLoc({ chu: $('#loc-chu').value }), 180));
$('#loc-nhom').addEventListener('change', () => UI.datLoc({ nhom: $('#loc-nhom').value }));
$('#loc-tu').addEventListener('change', () => UI.datLoc({ tu: $('#loc-tu').value }));
$('#loc-den').addEventListener('change', () => UI.datLoc({ den: $('#loc-den').value }));
$('#loc-kieu').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) UI.datLoc({ kieu: b.dataset.k }); });
$('#bang thead').addEventListener('click', (e) => {
  const th = e.target.closest('th[data-cot]');
  if (!th) return;
  const cot = th.dataset.cot;
  app.sap = { cot, chieu: app.sap.cot === cot && app.sap.chieu === 'desc' ? 'asc' : 'desc' };
  UI.veBang(true);
});
$('#khoang').addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  app.khoang = +b.dataset.k;
  $$('#khoang .pill').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  $$('#bieu-do .bd-rong .bd-khung').forEach((k) => { k.classList.remove('doi'); void k.offsetWidth; k.classList.add('doi'); });
  UI.veBieuDo(true);
});
$('#tinh-no').addEventListener('change', (e) => { app.st.caiDat.tinhNoVaoTong = e.target.checked; capNhat(); });

// Vàng: chọn nguồn / cơ sở / giá tay
document.addEventListener('change', (e) => {
  if (!app.st) return;
  const gv = app.st.giaVang;
  if (e.target.id === 'vang-nguon') { gv.nguon = e.target.value; capNhatGiaVang(true); }
  if (e.target.id === 'vang-coso') { gv.coSo = e.target.value; capNhat(); }
  if (e.target.id === 'vang-tay') {
    const v = e.target.value.trim() ? parseMoney(e.target.value) : 0;
    if (!Number.isFinite(v) || v < 0) { app.thongBao('Giá tay không đọc được (vd 13tr6 hoặc 13.600.000)', { loi: true }); return; }
    gv.thuCong = v; capNhat();
    app.thongBao(v ? `Đang dùng giá tay ${fmt(v)} đ/chỉ` : 'Đã về giá tự động', { tich: true });
  }
});

$('#chon-file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f && app.st) xemTruocFile(f);
});

function doiAnSo() {
  if (!app.st) return;
  app.anSo = !app.anSo;
  const b = $('#btn-an-so');
  b.setAttribute('aria-pressed', String(app.anSo));
  b.innerHTML = `<svg class="i"><use href="#i-${app.anSo ? 'eye-off' : 'eye'}"/></svg>`;
  document.documentElement.classList.toggle('an-so', app.anSo);
  app.veLai();
  huyHet(); UI.datLaiBieuDo(); UI.veBieuDo();
  if (fx('an-so')) $$('.money').forEach((m) => { m.classList.remove('doi-an'); void m.offsetWidth; m.classList.add('doi-an'); });
}

// Phím tắt
addEventListener('keydown', (e) => {
  if (!app.st || !K.el.hidden) return;
  const go = e.target.closest?.('input, textarea, select, [contenteditable]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !go) {
    e.preventDefault();
    const m = hoanTacCuoi();
    app.thongBao(m || 'Không còn gì để hoàn tác', m ? { tich: true } : {});
    return;
  }
  if (go || e.ctrlKey || e.metaKey || e.altKey || dangMoNgan()) return;
  const k = e.key.toLowerCase();
  const toi = (id) => $(id).scrollIntoView({ behavior: fx('cuon-muot') ? 'smooth' : 'auto' });
  const map = {
    n: () => moGiaoDich(), '/': () => { UI.denBang(); setTimeout(() => $('#loc-chu').focus(), fx('cuon-muot') ? 450 : 0); },
    h: doiAnSo, l: khoaSo, g: () => capNhatGiaVang(true), '?': () => moCaiDat('phim'),
    1: () => toi('#tong-quan'), 2: () => toi('#bieu-do'), 3: () => toi('#vang'), 4: () => toi('#cho-muon'), 5: () => toi('#giao-dich'),
  };
  if (map[k]) { e.preventDefault(); map[k](); goiYPhim(`<kbd>${esc(e.key.toUpperCase())}</kbd> ${{ n: 'thêm giao dịch', '/': 'tìm', h: 'ẩn / hiện số', l: 'khoá', g: 'lấy giá vàng', '?': 'phím tắt' }[k] || 'chuyển mục'}`); }
});

// Thanh trên: đổi nền, tự ẩn, mục đang xem; cuộn mượt
let yTruoc = 0;
const nav = $('#nav');
addEventListener('scroll', () => {
  const y = scrollY;
  nav.classList.toggle('da-cuon', fx('nav-nen') ? y > 40 : true);
  nav.classList.toggle('an', y > 300 && y > yTruoc + 4 && !dangMoNgan());
  if (y < yTruoc - 4) nav.classList.remove('an');
  yTruoc = y;
}, { passive: true });
const muc = ['tong-quan', 'bieu-do', 'vang', 'cho-muon', 'giao-dich'];
const ioMuc = new IntersectionObserver((ents) => {
  for (const e of ents) {
    if (!e.isIntersecting) continue;
    const id = e.target.id === 'chi-so' ? 'tong-quan' : e.target.id;
    $$('.nav__links a, .tabbar a').forEach((a) => {
      const on = a.getAttribute('href') === `#${id}`;
      a.classList.toggle(fx('nav-dang-xem') ? 'dang-xem' : 'x', on);
      if (on && a.closest('.tabbar') && !a.classList.contains('nay')) { a.classList.add('nay'); setTimeout(() => a.classList.remove('nay'), 500); }
      if (!fx('nav-dang-xem')) a.classList.remove('dang-xem');
    });
  }
}, { rootMargin: '-45% 0px -50% 0px' });
[...muc, 'chi-so'].forEach((id) => ioMuc.observe(document.getElementById(id)));
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  const dich = document.getElementById(a.getAttribute('href').slice(1));
  if (!dich) return;
  e.preventDefault();
  dich.scrollIntoView({ behavior: fx('cuon-muot') ? 'smooth' : 'auto', block: 'start' });
  history.replaceState(null, '', a.getAttribute('href'));
});
addEventListener('resize', debounce(() => { UI.dichBong($('#loc-kieu')); }, 150));

// ───────────────────────── Khởi động ─────────────────────────
async function khoiDong() {
  apFx();
  batTroi($('#troi'));
  ganHieuUngChuot();
  if (!fx('nav-nen')) nav.classList.add('da-cuon');
  const blob = V.docMay();
  if (!blob) { hienKhoa('tao'); return; }
  const nho = await V.layKhoaDaNho();
  if (nho && nho.muoi === blob.salt) {
    try {
      const st = await V.giaiMa(blob, nho.khoa);
      S.nho = true;
      await moSo(st, nho.khoa, nho.muoi, null);
      return;
    } catch { await V.quenKhoa(); }
  }
  hienKhoa('mo');
}
khoiDong().catch((e) => { console.error(e); hienKhoa(V.docMay() ? 'mo' : 'tao', `Lỗi khởi động: ${e.message}`); });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('storage', (e) => { if (e.key === 'stk.fx') { apFx(); capNhatTroi(); } });
