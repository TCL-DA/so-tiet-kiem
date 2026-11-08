// Hộp thoại: cài đặt (dữ liệu · bảo mật · đồng bộ · hiệu ứng · phím tắt), xem trước khi nhập file,
// sửa vàng, đổi mục tiêu.
import { app, tienD, luuVang, xoaVang, capNhat } from './app.js';
import { KIEU, tenLoaiVang, conSong } from './store.js';
import { fmt, fmtDate, fmtTime, esc, parseMoney, norm, today, $, $$ } from './util.js';
import { DS_HIEU_UNG, docFx, luuFx, fx } from './effects.js';
import { moNgan, dongNgan } from './form.js';
import { docFile, xuatExcel, xuatJson } from './importer.js';
import { docCauHinh, ghiCauHinh, kiemTra } from './sync.js';
import { doManh } from './vault.js';
import { capNhatTroi } from './sky.js';
import { dichBong } from './ui.js';

export const api = {};   // main.js gắn: apDung, doiMatKhau, dongBoNgay, xoaHet, khoa, quenMay
const H = { el: $('#hop'), tieuDe: $('#hop-tieu-de'), than: $('#hop-than'), chan: $('#hop-chan') };
const svg = (id) => `<svg class="i"><use href="#i-${id}"/></svg>`;

function mo(tieuDe, than, chan = '', focus) {
  H.tieuDe.textContent = tieuDe;
  H.than.innerHTML = than;
  H.chan.innerHTML = chan;
  H.chan.hidden = !chan;
  if (H.el.hidden) moNgan(H.el, focus && $(focus, H.el));
  else $(focus || 'input, button', H.el)?.focus();
}
const dong = () => dongNgan(H.el);

// ───────────────────────── Cài đặt ─────────────────────────
const TAB = [['du-lieu', 'Dữ liệu'], ['bao-mat', 'Bảo mật'], ['dong-bo', 'Đăng lên web'], ['hieu-ung', 'Hiệu ứng'], ['phim', 'Phím tắt']];

export function moCaiDat(tab = 'du-lieu') {
  const nav = `<div class="pills co-bong" role="tablist" aria-label="Mục cài đặt" id="tab-cd"><span class="bong" aria-hidden="true"></span>${TAB.map(([id, ten]) => `<button class="pill" role="tab" data-tab="${id}" aria-selected="${id === tab}" aria-pressed="${id === tab}">${ten}</button>`).join('')}</div>`;
  mo('Cài đặt', `${nav}<div id="tab-noi-dung" role="tabpanel"></div>`);
  veTab(tab);
  $('#tab-cd').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) veTab(b.dataset.tab); });
}

function veTab(tab) {
  $$('#tab-cd .pill').forEach((b) => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.setAttribute('aria-pressed', on); });
  requestAnimationFrame(() => dichBong($('#tab-cd')));
  const nd = $('#tab-noi-dung');
  nd.innerHTML = { 'du-lieu': tabDuLieu, 'bao-mat': tabBaoMat, 'dong-bo': tabDongBo, 'hieu-ung': tabHieuUng, phim: tabPhim }[tab]();
  ({ 'du-lieu': ganDuLieu, 'bao-mat': ganBaoMat, 'dong-bo': ganDongBo, 'hieu-ung': ganHieuUng, phim: () => {} })[tab](nd);
}

const tabDuLieu = () => `
  <div class="the-cai-dat"><h3>Nhập file</h3><p>Sổ Excel cũ (cột Ngày · Ghi chú · Nhập · Rút · Cho bạn mượn · Vàng), file Excel do web này xuất, hoặc file sao lưu .json. Có bước xem trước, chưa ghi gì cho tới khi bấm "Nhập".</p>
    <div class="hang-nut"><button class="btn btn--dac" id="cd-nhap">${svg('tai-len')}Chọn file…</button></div></div>
  <div class="the-cai-dat"><h3>Xuất file</h3><p>Excel để xem / in (4 sheet: Tổng quan, Giao dịch, Vàng, Cho mượn). JSON là bản sao lưu đầy đủ để nhập lại — <b>file xuất ra KHÔNG mã hoá</b>, cất cẩn thận.</p>
    <div class="hang-nut"><button class="btn btn--ink" id="cd-xuat-x">${svg('tai-ve')}Excel</button><button class="btn btn--ink" id="cd-xuat-j">${svg('tai-ve')}Sao lưu JSON</button></div></div>
  <div class="the-cai-dat"><h3>Mục tiêu tiết kiệm</h3><p>Vòng tiến độ ở đầu trang; chạm mục tiêu thì bắn pháo giấy.</p>
    <div class="hang-nut"><input class="inp num" id="cd-muc-tieu" inputmode="decimal" style="max-width:240px" value="${fmt(app.st.caiDat.mucTieu || 0)}" aria-label="Mục tiêu (đồng)"><button class="btn btn--ink" id="cd-luu-muc">Lưu</button></div></div>
  <div class="the-cai-dat"><h3>Xoá toàn bộ dữ liệu trên máy này</h3><p>Giữ nút 1,6 giây để xoá. Bản trên web (nếu có) vẫn còn — mở lại bằng mật khẩu là có.</p>
    <div class="hang-nut"><button class="btn btn--nguy hold" id="cd-xoa-het"><span class="vong-giu"></span>${svg('xoa')}Giữ để xoá hết</button></div></div>`;

function ganDuLieu() {
  $('#cd-nhap').onclick = () => $('#chon-file').click();
  $('#cd-xuat-x').onclick = async (e) => { const nut = e.currentTarget; nut.disabled = true; try { await xuatExcel(app.st, app.kq); app.thongBao('Đã xuất file Excel', { tich: true }); } catch (er) { app.thongBao(er.message, { loi: true }); } nut.disabled = false; };
  $('#cd-xuat-j').onclick = () => { xuatJson(app.st); app.thongBao('Đã xuất bản sao lưu JSON (không mã hoá — cất cẩn thận)', { tich: true }); };
  $('#cd-luu-muc').onclick = () => {
    const v = parseMoney($('#cd-muc-tieu').value);
    if (!Number.isFinite(v) || v < 0) { app.thongBao('Mục tiêu không hợp lệ', { loi: true }); return; }
    app.st.caiDat.mucTieu = v; capNhat(); app.thongBao(`Mục tiêu mới: ${fmt(v)} đ`, { tich: true });
  };
  giuDeXoa($('#cd-xoa-het'), () => { dong(); api.xoaHet(); });
}

function giuDeXoa(nut, xong) {
  let hen;
  const bat = (e) => { e.preventDefault(); nut.classList.add('giu'); hen = setTimeout(() => { nut.classList.remove('giu'); xong(); }, 1600); };
  const tha = () => { clearTimeout(hen); nut.classList.remove('giu'); };
  nut.addEventListener('pointerdown', bat);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => nut.addEventListener(ev, tha));
  nut.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) bat(e); });
  nut.addEventListener('keyup', tha);
}

const tabBaoMat = () => `
  <div class="the-cai-dat"><h3>Đổi mật khẩu</h3><p>Dữ liệu được mã hoá lại bằng mật khẩu mới, cả bản trên web (phải làm ở máy có quyền đăng lên web). Máy khác sẽ phải gõ mật khẩu mới.</p>
    <div class="truong"><label for="mk-cu">Mật khẩu đang dùng</label><input class="inp" type="password" id="mk-cu" autocomplete="current-password"></div>
    <div class="hai-cot"><div class="truong"><label for="mk-moi">Mật khẩu mới</label><input class="inp" type="password" id="mk-moi" autocomplete="new-password"></div>
    <div class="truong"><label for="mk-moi2">Gõ lại</label><input class="inp" type="password" id="mk-moi2" autocomplete="new-password"></div></div>
    <div class="do-manh" id="cd-do-manh" data-d="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <p class="loi-chu" id="mk-loi" role="alert"></p>
    <div class="hang-nut"><button class="btn btn--dac" id="mk-doi">Đổi mật khẩu</button></div></div>
  <div class="the-cai-dat"><h3>Máy này</h3><p>"Khoá" xoá khoá khỏi bộ nhớ và quên máy này — lần sau phải gõ mật khẩu. Tự khoá khi để yên (chỉ áp dụng khi không chọn "nhớ máy").</p>
    <div class="hang-nut"><button class="btn btn--ink" id="cd-khoa">${svg('khoa')}Khoá ngay</button>
    <div class="chon" style="min-width:200px"><select class="inp" id="cd-tu-khoa" aria-label="Tự khoá sau">${[[0, 'Không tự khoá'], [5, 'Tự khoá sau 5 phút'], [15, 'Tự khoá sau 15 phút'], [60, 'Tự khoá sau 60 phút']].map(([v, t]) => `<option value="${v}" ${+(app.st.caiDat.tuKhoa ?? 15) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div></div>`;

function ganBaoMat() {
  $('#mk-moi').oninput = () => { $('#cd-do-manh').dataset.d = doManh($('#mk-moi').value); };
  $('#mk-doi').onclick = async (e) => {
    const nut = e.currentTarget;
    const cu = $('#mk-cu').value, moi = $('#mk-moi').value, moi2 = $('#mk-moi2').value;
    const loi = (s) => { $('#mk-loi').textContent = s; };
    if (moi.length < 8) return loi('Mật khẩu mới cần ít nhất 8 ký tự.');
    if (moi !== moi2) return loi('Hai lần gõ mật khẩu mới không giống nhau.');
    nut.disabled = true;
    try { await api.doiMatKhau(cu, moi); loi(''); dong(); app.thongBao('Đã đổi mật khẩu và mã hoá lại dữ liệu', { tich: true }); }
    catch (er) { loi(er.message); }
    nut.disabled = false;
  };
  $('#cd-khoa').onclick = () => { dong(); api.khoa(); };
  $('#cd-tu-khoa').onchange = (e) => { app.st.caiDat.tuKhoa = +e.target.value; capNhat(); };
}

const tabDongBo = () => {
  const c = docCauHinh();
  const coWeb = api.coBanWeb?.();
  const link = `https://github.com/settings/personal-access-tokens/new?name=so-tiet-kiem&description=${encodeURIComponent('Dang so tiet kiem len web')}&target_name=${encodeURIComponent(c.repo.split('/')[0])}&expires_in=366&contents=write`;
  return `
  <div class="the-cai-dat"><h3>Sổ trên web</h3>
    <p>${coWeb ? 'Sổ <b>đã có trên web</b>' : 'Sổ <b>chưa đăng lên web</b>'}: ai mở link và gõ đúng mật khẩu là xem được, không cần tài khoản. Trên web chỉ có bản <b>đã mã hoá</b> — không có mật khẩu thì không đọc được.</p>
    <p><b>Máy này: ${c.token ? 'được đăng thay đổi lên web' : 'chỉ xem'}</b>. ${c.token ? `Lần đăng cuối: ${c.lanCuoi ? fmtTime(c.lanCuoi) : 'chưa'}.` : 'Sửa trên máy này vẫn lưu được, nhưng chỉ nằm trên máy này cho tới khi dán token bên dưới.'}</p></div>
  <div class="the-cai-dat"><h3>${c.token ? 'Quyền đăng lên web' : 'Cho máy này đăng thay đổi lên web (làm 1 lần)'}</h3>
    ${c.token ? '' : `<ol style="margin:0;padding-left:18px;font-size:13px;color:var(--chu-sang-phu);display:flex;flex-direction:column;gap:4px">
      <li>Mở <a href="${link}" target="_blank" rel="noopener">GitHub → tạo token</a> (đăng nhập tài khoản ${esc(c.repo.split('/')[0])}).</li>
      <li>Repository access: <b>Only select repositories</b> → chọn <b>${esc(c.repo.split('/')[1])}</b>.</li>
      <li>Permissions → Repository → <b>Contents: Read and write</b>. Hạn dùng tuỳ ý (vd 1 năm).</li>
      <li>Bấm Generate, chép token dán vào ô dưới → "Kiểm tra &amp; lưu".</li>
    </ol>`}
    <div class="truong"><label for="db-token">Token</label><div class="mat-khau"><input class="inp" id="db-token" type="password" value="${esc(c.token)}" autocomplete="off" spellcheck="false" placeholder="github_pat_…"><button type="button" data-hien-mk="db-token" aria-label="Hiện token">${svg('eye')}</button></div></div>
    <p class="loi-chu" id="db-loi" role="alert"></p>
    <p class="card__sub" id="db-tt"></p>
    <div class="hang-nut"><button class="btn btn--dac" id="db-luu">Kiểm tra &amp; lưu</button>${c.token ? `<button class="btn btn--ink" id="db-ngay">${svg('tai-lai')}Đăng / tải lại ngay</button><button class="btn btn--nguy" id="db-ngat">Gỡ quyền trên máy này</button>` : `<button class="btn btn--ink" id="db-ngay">${svg('tai-lai')}Tải lại bản trên web</button>`}</div></div>`;
};

function ganDongBo() {
  $('#db-luu').onclick = async (e) => {
    const nut = e.currentTarget;
    const cfg = { ...docCauHinh(), token: $('#db-token').value.trim() };
    if (!cfg.token) { $('#db-loi').textContent = 'Dán token vào.'; return; }
    nut.disabled = true; $('#db-tt').textContent = 'Đang kiểm tra…';
    try {
      const msg = await kiemTra(cfg);
      ghiCauHinh(cfg);
      $('#db-loi').textContent = ''; $('#db-tt').textContent = msg;
      await api.dongBoNgay();
      veTab('dong-bo');
    } catch (er) { if ($('#db-loi')) { $('#db-loi').textContent = er.message; $('#db-tt').textContent = ''; } }
    nut.disabled = false;
  };
  $('#db-ngay').onclick = async () => { await api.dongBoNgay(); veTab('dong-bo'); };
  if ($('#db-ngat')) $('#db-ngat').onclick = () => { ghiCauHinh({ ...docCauHinh(), token: '', sha: '' }); veTab('dong-bo'); api.dongBoNgay(); app.thongBao('Đã gỡ token khỏi máy này — máy này giờ chỉ xem'); };
}

const tabHieuUng = () => {
  const c = docFx();
  const nhom = [...new Set(DS_HIEU_UNG.map((h) => h.nhom))];
  const dem = DS_HIEU_UNG.filter((h) => !c.tat.includes(h.id)).length;
  return `
  <div class="the-cai-dat">
    <label class="cong-tac"><input type="checkbox" id="fx-tong" ${c.bat ? 'checked' : ''}> Bật hiệu ứng (${DS_HIEU_UNG.length} hiệu ứng · đang chọn ${dem})</label>
    <p>Máy đang đặt "giảm chuyển động" thì web vẫn chạy hiệu ứng theo công tắc này. Tắt hết vẫn đọc đủ nội dung.</p>
    <div class="hang-nut"><button class="btn btn--ink btn--nho" id="fx-bat-het">Chọn hết</button><button class="btn btn--ink btn--nho" id="fx-tat-het">Bỏ chọn hết</button></div></div>
  ${nhom.map((n) => `<div class="the-cai-dat"><h3>${n}</h3><div class="ds-hieu-ung">${DS_HIEU_UNG.map((h, i) => (h.nhom === n ? `<label><span class="so-tt num">${i + 1}</span><input type="checkbox" data-fx="${h.id}" ${c.tat.includes(h.id) ? '' : 'checked'}>${h.ten}</label>` : '')).join('')}</div></div>`).join('')}`;
};

function ganHieuUng(nd) {
  const luu = () => {
    const tat = $$('[data-fx]', nd).filter((x) => !x.checked).map((x) => x.dataset.fx);
    luuFx({ bat: $('#fx-tong').checked, tat });
    capNhatTroi();
  };
  nd.addEventListener('change', luu);
  $('#fx-bat-het').onclick = () => { $$('[data-fx]', nd).forEach((x) => { x.checked = true; }); luu(); veTab('hieu-ung'); };
  $('#fx-tat-het').onclick = () => { $$('[data-fx]', nd).forEach((x) => { x.checked = false; }); luu(); veTab('hieu-ung'); };
}

const tabPhim = () => `<div class="the-cai-dat"><div class="phim">
  <kbd>N</kbd><span>Thêm giao dịch</span><kbd>/</kbd><span>Tìm trong sổ</span><kbd>H</kbd><span>Ẩn / hiện số tiền</span>
  <kbd>Ctrl Z</kbd><span>Hoàn tác thao tác vừa làm</span><kbd>L</kbd><span>Khoá sổ</span><kbd>G</kbd><span>Lấy lại giá vàng</span>
  <kbd>1</kbd><span>Tới Tổng quan</span><kbd>2</kbd><span>Tới Biểu đồ</span><kbd>3</kbd><span>Tới Vàng</span><kbd>4</kbd><span>Tới Cho mượn</span><kbd>5</kbd><span>Tới Sổ ghi</span>
  <kbd>Enter</kbd><span>Trên một dòng sổ: mở để sửa</span><kbd>Esc</kbd><span>Đóng ngăn / hộp</span><kbd>?</kbd><span>Bảng này</span>
  <kbd>←</kbd><span>Trong ngăn nhập: đổi kiểu giao dịch (← →)</span></div></div>`;

// ───────────────────────── Nhập file: xem trước ─────────────────────────
export async function xemTruocFile(file) {
  let kq;
  try { kq = await docFile(file); } catch (e) { app.thongBao(e.message, { loi: true }); return; }
  const tx = kq.tx.filter(conSong);
  const vao = tx.reduce((s, t) => s + (KIEU[t.kieu].tien > 0 ? t.soTien : 0), 0);
  const ra = tx.reduce((s, t) => s + (KIEU[t.kieu].tien < 0 && !t.ngoaiSo ? t.soTien : 0), 0);
  const ngay = tx.map((t) => t.ngay).sort();
  const coSan = app.st.tx.some(conSong);
  const nguoi = [...new Set(tx.filter((t) => t.nguoi).map((t) => t.nguoi))];
  mo(`Nhập "${file.name}"`, `
    <div class="the-cai-dat"><h3>${esc(kq.kieuFile)}${kq.sheet ? ` · sheet "${esc(kq.sheet)}"` : ''}</h3>
      <div class="phim" style="grid-template-columns:auto 1fr">
        <span>Giao dịch</span><b class="num">${fmt(tx.length)}${ngay.length ? ` · ${fmtDate(ngay[0])} → ${fmtDate(ngay[ngay.length - 1])}` : ''}</b>
        <span>Gửi vào</span><b class="num">${fmt(vao)} đ</b>
        <span>Rút ra</span><b class="num">${fmt(ra)} đ</b>
        <span>Còn trong sổ</span><b class="num">${fmt(vao - ra)} đ</b>
        <span>Vàng</span><b>${kq.vang.length ? kq.vang.map((v) => `${v.soChi} chỉ ${tenLoaiVang(v.loai)}, mua ${fmt(v.giaMua)} đ`).join('; ') : 'không có'}</b>
        <span>Người mượn</span><b>${nguoi.length ? nguoi.map(esc).join(', ') : 'không có'}</b>
      </div></div>
    ${kq.canhBao.length ? `<div class="canh-bao"><b>Đã tự xử lý — xem lại giúp:</b><ul>${kq.canhBao.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    ${coSan ? `<div class="the-cai-dat"><h3>Sổ đang có ${fmt(app.kq.soGd)} giao dịch</h3>
      <label class="o-tick"><input type="radio" name="che-do" value="thay" checked> Thay toàn bộ bằng file này</label>
      <label class="o-tick"><input type="radio" name="che-do" value="gop"> Gộp thêm (bỏ qua dòng trùng ngày + số tiền + ghi chú)</label></div>` : ''}
    <p class="card__sub">Tiền vàng tính riêng theo giá thị trường, không cộng vào "Còn trong sổ".</p>`,
  `<button class="btn btn--ink" data-dong>Huỷ</button><button class="btn btn--dac" id="nhap-ok">${svg('tai-len')}Nhập ${fmt(tx.length)} giao dịch</button>`, '#nhap-ok');
  $('#nhap-ok').onclick = () => {
    const cheDo = $('input[name="che-do"]:checked')?.value || 'thay';
    api.apDung(kq, cheDo);
    dong();
  };
}

// ───────────────────────── Vàng: thêm / sửa ─────────────────────────
export function moVang(v = null) {
  const x = v || { ngay: today(), soChi: 1, loai: app.st.giaVang.loai || 'nhan', giaMua: 0, ghiChu: '' };
  mo(v ? 'Sửa vàng đang giữ' : 'Thêm vàng', `
    <div class="hai-cot">
      <div class="truong"><label for="v-chi">Số chỉ</label><input class="inp num" id="v-chi" inputmode="decimal" value="${String(x.soChi).replace('.', ',')}"></div>
      <div class="truong"><label for="v-loai">Loại</label><div class="chon"><select class="inp" id="v-loai">${['nhan', 'mieng', 'nutrang'].map((l) => `<option value="${l}" ${x.loai === l ? 'selected' : ''}>${tenLoaiVang(l)}</option>`).join('')}</select></div></div>
      <div class="truong"><label for="v-ngay">Ngày mua</label><input class="inp" type="date" id="v-ngay" value="${x.ngay}"></div>
      <div class="truong"><label for="v-gia">Tổng tiền lúc mua</label><input class="inp num" id="v-gia" inputmode="decimal" value="${x.giaMua ? fmt(x.giaMua) : ''}" placeholder="vd 33tr"></div>
    </div>
    <div class="truong"><label for="v-ghi">Ghi chú</label><input class="inp" id="v-ghi" value="${esc(x.ghiChu)}"></div>
    <p class="loi-chu" id="v-loi" role="alert"></p>
    <p class="card__sub">Mua vàng bằng tiền trong sổ thì ghi thêm 1 khoản "Rút ra" nhóm "Mua vàng" — web không tự trừ để khỏi trừ hai lần.</p>`,
  `${v ? `<button class="btn btn--nguy" id="v-xoa" style="margin-right:auto">${svg('xoa')}Xoá</button>` : ''}<button class="btn btn--ink" data-dong>Huỷ</button><button class="btn btn--dac" id="v-luu">Lưu</button>`, '#v-chi');
  $('#v-luu').onclick = () => {
    const soChi = parseFloat($('#v-chi').value.replace(',', '.'));
    const gia = $('#v-gia').value.trim() ? parseMoney($('#v-gia').value) : 0;
    if (!(soChi > 0)) { $('#v-loi').textContent = 'Số chỉ phải lớn hơn 0 (vd 2 hoặc 0,5).'; return; }
    if (!Number.isFinite(gia) || gia < 0) { $('#v-loi').textContent = 'Tổng tiền lúc mua không đọc được.'; return; }
    luuVang({ ...(v || {}), soChi, loai: $('#v-loai').value, ngay: $('#v-ngay').value || today(), giaMua: gia, ghiChu: $('#v-ghi').value });
    dong(); app.thongBao(v ? 'Đã sửa vàng' : `Đã thêm ${soChi} chỉ vàng`, { tich: true });
  };
  if (v) $('#v-xoa').onclick = () => { xoaVang(v.id); dong(); app.thongBao('Đã xoá dòng vàng', { hoanTac: true }); };
}

// ───────────────────────── Mục tiêu ─────────────────────────
export function moMucTieu() {
  mo('Mục tiêu tiết kiệm', `<div class="truong"><label for="mt-so">Muốn có tổng tài sản (gõ được 300tr, 1 tỷ)</label><input class="inp inp--tien num" id="mt-so" inputmode="decimal" value="${fmt(app.st.caiDat.mucTieu || 0)}"></div><p class="tien-chu" id="mt-chu"></p>`,
    '<button class="btn btn--ink" data-dong>Huỷ</button><button class="btn btn--dac" id="mt-luu">Lưu</button>', '#mt-so');
  const chu = () => { const v = parseMoney($('#mt-so').value); $('#mt-chu').textContent = Number.isFinite(v) ? `${fmt(v)} đ` : ''; };
  $('#mt-so').oninput = chu; chu();
  $('#mt-luu').onclick = () => {
    const v = parseMoney($('#mt-so').value);
    if (!Number.isFinite(v) || v < 0) return;
    app.st.caiDat.mucTieu = v; capNhat(); dong();
  };
}

/** Hỏi mật khẩu (khi bản trên GitHub được mã hoá bằng mật khẩu khác máy này đang nhớ). */
export function hoiMatKhau(lyDo) {
  return new Promise((res) => {
    mo('Cần mật khẩu', `<p class="card__sub">${esc(lyDo)}</p><div class="truong"><label for="hm-mk">Mật khẩu</label><input class="inp" type="password" id="hm-mk" autocomplete="current-password"></div>`,
      '<button class="btn btn--ink" data-dong id="hm-huy">Bỏ qua</button><button class="btn btn--dac" id="hm-ok">Mở</button>', '#hm-mk');
    let xong = false;
    const ket = (v) => { if (xong) return; xong = true; theoDoi.disconnect(); if (!H.el.hidden) dong(); res(v); };
    // Đóng bằng Esc / bấm nền tối cũng tính là "Bỏ qua" (không để đồng bộ treo chờ mãi)
    const theoDoi = new MutationObserver(() => { if (H.el.hidden || !H.el.classList.contains('mo')) ket(null); });
    setTimeout(() => theoDoi.observe(H.el, { attributes: true, attributeFilter: ['class', 'hidden'] }), 500);
    $('#hm-ok').onclick = () => ket($('#hm-mk').value);
    $('#hm-mk').onkeydown = (e) => { if (e.key === 'Enter') ket($('#hm-mk').value); };
    $('#hm-huy').addEventListener('click', () => ket(null));
  });
}

export { norm };
