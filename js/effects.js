// 63 hiệu ứng: danh sách, bật/tắt từng cái (lưu trên máy), và phần chạy bằng JS.
// Luật: KHÔNG giấu nội dung chờ hiệu ứng — tắt hết vẫn đọc được đủ (xem CSS .js.fx).
import { fmt, clamp } from './util.js';

export const DS_HIEU_UNG = [
  ['sao', 'Bầu trời sao lấp lánh', 'Trời đêm'],
  ['may', 'Mây đêm trôi chậm', 'Trời đêm'],
  ['saobang', 'Sao băng thỉnh thoảng vụt qua', 'Trời đêm'],
  ['parallax-chuot', 'Trời nghiêng theo chuột', 'Trời đêm'],
  ['parallax-cuon', 'Mây và sao trôi theo cuộn trang', 'Trời đêm'],
  ['duoi-sao', 'Vệt sao theo con trỏ ở đầu trang', 'Trời đêm'],
  ['gio-troi', 'Màu trời đổi theo giờ (rạng sáng, hoàng hôn)', 'Trời đêm'],
  ['dem-so', 'Số tổng tài sản lăn lên từ 0', 'Đầu trang'],
  ['chu-tieu-de', 'Tiêu đề hiện từng chữ', 'Đầu trang'],
  ['chu-viet-tay', 'Chữ viết tay "vẽ" ra', 'Đầu trang'],
  ['bang-chu', 'Dòng "bằng chữ" gõ dần', 'Đầu trang'],
  ['vong-muc-tieu', 'Vòng mục tiêu chạy tới %', 'Đầu trang'],
  ['dong-xu', 'Đồng xu rơi khi gửi tiền vào', 'Đầu trang'],
  ['phao-giay', 'Pháo giấy khi đạt mục tiêu / gửi khoản lớn', 'Đầu trang'],
  ['nav-an', 'Thanh trên tự ẩn khi cuộn xuống', 'Điều hướng'],
  ['nav-nen', 'Thanh trên đổi nền khi rời đầu trang', 'Điều hướng'],
  ['nav-dang-xem', 'Mục đang xem trên thanh trên đảo màu', 'Điều hướng'],
  ['cuon-muot', 'Cuộn mượt tới mục', 'Điều hướng'],
  ['tabbar-nay', 'Biểu tượng thanh dưới nảy khi chọn (điện thoại)', 'Điều hướng'],
  ['hien-dan', 'Khối hiện dần khi cuộn tới', 'Thẻ'],
  ['so-le', 'Các ô hiện so le từng ô', 'Thẻ'],
  ['nghieng-3d', 'Thẻ nghiêng 3D theo chuột', 'Thẻ'],
  ['noi-the', 'Thẻ nhích lên khi rê chuột', 'Thẻ'],
  ['lan-so', 'Số trong ô đếm lên khi đổi', 'Thẻ'],
  ['nhay-doi', 'Ô nháy nền khi số vừa đổi', 'Thẻ'],
  ['nhan-co', 'Nút co lại khi nhấn', 'Nút'],
  ['gon-song', 'Gợn sóng khi bấm nút', 'Nút'],
  ['nam-cham', 'Nút chính hút theo chuột (nam châm)', 'Nút'],
  ['con-tro', 'Vòng con trỏ đi theo chuột', 'Nút'],
  ['icon-xoay', 'Biểu tượng cài đặt xoay khi rê', 'Nút'],
  ['ve-duong', 'Đường số dư vẽ dần', 'Biểu đồ'],
  ['cot-moc', 'Cột tháng mọc lên lần lượt', 'Biểu đồ'],
  ['thanh-chay', 'Thanh nhóm chi / khoản lớn chạy ra', 'Biểu đồ'],
  ['truc-doc', 'Đường dóng dọc theo chuột trên biểu đồ', 'Biểu đồ'],
  ['tooltip-muot', 'Hộp số trên biểu đồ trượt mượt', 'Biểu đồ'],
  ['lich-hien', 'Ô lịch giao dịch hiện lần lượt', 'Biểu đồ'],
  ['lich-phong', 'Ô lịch phóng to khi rê', 'Biểu đồ'],
  ['doi-khoang', 'Đổi khoảng thời gian mờ chéo', 'Biểu đồ'],
  ['dong-hien', 'Dòng bảng hiện so le khi lọc', 'Bảng'],
  ['dong-moi', 'Dòng vừa thêm / sửa nháy sáng', 'Bảng'],
  ['dong-xoa', 'Dòng xoá trượt sang và mờ đi', 'Bảng'],
  ['mui-ten-sap', 'Mũi tên sắp xếp xoay', 'Bảng'],
  ['vien-loc', 'Nền bộ lọc trượt theo mục đang chọn', 'Bảng'],
  ['dong-re', 'Dòng nổi nền khi rê', 'Bảng'],
  ['ngan-truot', 'Ngăn nhập trượt vào', 'Nhập liệu'],
  ['man-toi', 'Nền tối dần khi mở ngăn', 'Nhập liệu'],
  ['rung-sai', 'Ô nhập rung khi gõ sai', 'Nhập liệu'],
  ['tich-ve', 'Dấu tích vẽ ra khi lưu', 'Nhập liệu'],
  ['chip-nay', 'Chip số tiền nhanh nảy khi bấm', 'Nhập liệu'],
  ['so-go', 'Số tiền gõ hiện "bằng chữ" ngay', 'Nhập liệu'],
  ['toast-truot', 'Thông báo trượt vào', 'Thông báo'],
  ['vong-hoan-tac', 'Vòng đếm ngược nút hoàn tác', 'Thông báo'],
  ['nhan-xoay', 'Nhẫn vàng xoay 3D', 'Vàng & nợ'],
  ['gia-nhay', 'Mũi tên giá vàng nảy khi đổi', 'Vàng & nợ'],
  ['xuong-xuong', 'Khung chờ nhấp nháy khi đang tải giá', 'Vàng & nợ'],
  ['vong-tra-no', 'Vòng % đã trả nợ chạy', 'Vàng & nợ'],
  ['thanh-tra-no', 'Thanh đã trả chạy dài', 'Vàng & nợ'],
  ['khoa-lac', 'Ổ khoá lắc khi sai mật khẩu', 'Bảo mật'],
  ['khoa-mo', 'Màn khoá mở tung khi đúng', 'Bảo mật'],
  ['an-so', 'Số mờ dần khi bật / tắt Ẩn số', 'Bảo mật'],
  ['giu-xoa', 'Giữ nút để xoá hết (thanh đầy dần)', 'Bảo mật'],
  ['dong-bo-quay', 'Biểu tượng đồng bộ quay khi đang đẩy', 'Bảo mật'],
  ['phim-tat', 'Gợi ý phím tắt bật lên', 'Bảo mật'],
].map(([id, ten, nhom]) => ({ id, ten, nhom }));

const LS = 'stk.fx';
const root = document.documentElement;

export function docFx() {
  try { return { bat: true, tat: [], ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch { return { bat: true, tat: [] }; }
}
export function apFx(cfg = docFx()) {
  root.classList.toggle('fx', cfg.bat);
  for (const h of DS_HIEU_UNG) root.classList.toggle(`no-${h.id}`, cfg.tat.includes(h.id));
}
export function luuFx(cfg) { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch { /* bỏ qua */ } apFx(cfg); }

/** Hiệu ứng `id` có đang bật không. */
export const fx = (id) => root.classList.contains('fx') && !root.classList.contains(`no-${id}`);

// ───────────── Hiện dần khi cuộn (có lưới an toàn) ─────────────
let io, ganCuon = false;
const CHO_HIEN = '.rv:not(.in), .lich:not(.in), .thanh-ds:not(.in)';
/** Nhảy cóc qua mục (bấm menu) thì khối nằm phía TRÊN khung nhìn không bao giờ "giao" khung → hiện luôn. */
function hienKhoiDaQua() {
  for (const e of document.querySelectorAll(CHO_HIEN)) if (e.getBoundingClientRect().top < innerHeight) e.classList.add('in');
}
export function theoDoiHien(scope = document) {
  if (!ganCuon) {
    ganCuon = true;
    let cho = false;
    addEventListener('scroll', () => { if (cho) return; cho = true; setTimeout(() => { cho = false; hienKhoiDaQua(); }, 120); }, { passive: true });
  }
  const els = [...scope.querySelectorAll(CHO_HIEN)];
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  io ||= new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach((e) => io.observe(e));
  // Lưới an toàn: phần tử đã trong khung nhìn mà 1,2 s sau vẫn chưa hiện → hiện luôn
  setTimeout(() => {
    for (const e of els) {
      if (e.classList.contains('in')) continue;
      const r = e.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) e.classList.add('in');
    }
  }, 1200);
}

// ───────────── Đếm số ─────────────
const dangDem = new WeakMap();
/** Đếm từ giá trị cũ tới mới; `dinhDang(n)` trả chuỗi. */
export function demSo(el, toi, dinhDang = fmt, ms = 900) {
  const tu = +(el.dataset.v ?? 0);
  el.dataset.v = toi;
  if (!fx('lan-so') || tu === toi || !isFinite(tu)) { el.textContent = dinhDang(toi); return; }
  cancelAnimationFrame(dangDem.get(el));
  const t0 = performance.now();
  const buoc = (t) => {
    const p = clamp((t - t0) / ms, 0, 1), e = 1 - (1 - p) ** 3;
    el.textContent = dinhDang(tu + (toi - tu) * e);
    if (p < 1) dangDem.set(el, requestAnimationFrame(buoc));
  };
  dangDem.set(el, requestAnimationFrame(buoc));
  if (fx('nhay-doi')) { const o = el.closest('.o'); if (o) { o.classList.remove('nhay'); void o.offsetWidth; o.classList.add('nhay'); } }
}

/** Đồng hồ số kiểu công-tơ-mét cho số tổng (mỗi chữ số là 1 cột 0–9 trượt dọc). */
export function odo(el, chuoi, tuDau = false) {
  const ky = [...chuoi];
  if (el.childElementCount !== ky.length || el.dataset.mau !== ky.map((c) => (/\d/.test(c) ? '0' : c)).join('')) {
    el.dataset.mau = ky.map((c) => (/\d/.test(c) ? '0' : c)).join('');
    el.innerHTML = ky.map((c) => (/\d/.test(c)
      ? `<span class="s"><span class="bang">${'0123456789'.split('').map((d) => `<span>${d}</span>`).join('')}</span></span>`
      : `<span class="s cham">${c}</span>`)).join('');
    el.setAttribute('aria-label', chuoi);
    tuDau = true;
  }
  const cot = [...el.children];
  const chay = () => ky.forEach((c, i) => {
    if (!/\d/.test(c)) return;
    const bang = cot[i].firstElementChild;
    bang.style.setProperty('--d', `${(ky.length - i) * 0.04}s`);
    bang.style.transform = `translateY(${-c * 1.06}em)`;
  });
  if (tuDau && fx('dem-so')) { cot.forEach((s) => { if (s.firstElementChild) s.firstElementChild.style.transform = 'translateY(0)'; }); void el.offsetWidth; requestAnimationFrame(chay); }
  else chay();
}

/** Gõ dần một dòng chữ. */
let goTimer;
export function goChu(el, chu) {
  clearInterval(goTimer);
  if (!fx('bang-chu')) { el.textContent = chu; return; }
  let i = 0;
  el.textContent = '';
  const cur = document.createElement('span'); cur.className = 'con-tro-go';
  const txt = document.createTextNode('');
  el.append(txt, cur);
  goTimer = setInterval(() => {
    i += 2; txt.data = chu.slice(0, i);
    if (i >= chu.length) { clearInterval(goTimer); setTimeout(() => cur.remove(), 1600); }
  }, 22);
}

// ───────────── Gợn sóng, nam châm, nghiêng 3D, con trỏ ─────────────
export function ganHieuUngChuot() {
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn, .chip, .pill, .tach');
    if (!b || !fx('gon-song')) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    const g = document.createElement('span');
    g.className = 'gon';
    g.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(g);
    setTimeout(() => g.remove(), 650);
  }, { passive: true });

  if (!matchMedia('(hover: hover)').matches) return;

  // Nam châm cho nút có class .nam-cham
  document.addEventListener('pointermove', (e) => {
    const b = e.target.closest?.('.nam-cham');
    document.querySelectorAll('.nam-cham.dang-hut').forEach((x) => { if (x !== b) { x.classList.remove('dang-hut'); x.style.transform = ''; } });
    if (!b || !fx('nam-cham')) return;
    const r = b.getBoundingClientRect();
    b.classList.add('dang-hut');
    b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
  }, { passive: true });

  // Nghiêng 3D cho thẻ .nghieng
  let hang = null;
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest?.('.nghieng');
    if (hang && hang !== c) { hang.style.transform = ''; hang = null; }
    if (!c || !fx('nghieng-3d')) return;
    hang = c;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `perspective(700px) rotateX(${-y * 7}deg) rotateY(${x * 9}deg) translateY(-2px)`;
  }, { passive: true });

  // Vòng con trỏ đi theo (đặt bằng transform trong rAF)
  const vong = document.querySelector('.con-tro-vong');
  if (!vong) return;
  let tx = -100, ty = -100, x = -100, y = -100, chay = false;
  const ve = () => {
    x += (tx - x) * 0.22; y += (ty - y) * 0.22;
    vong.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (Math.abs(tx - x) + Math.abs(ty - y) > 0.3) requestAnimationFrame(ve); else chay = false;
  };
  document.addEventListener('pointermove', (e) => {
    if (!fx('con-tro') || e.pointerType !== 'mouse') { vong.classList.remove('hien'); return; }
    tx = e.clientX; ty = e.clientY;
    vong.classList.add('hien');
    const t = e.target;
    vong.classList.toggle('to', !!t.closest?.('button, a, input, select, .dong, [role="button"]'));
    vong.classList.toggle('tren-sang', !!t.closest?.('.card, .ngan, .toast'));
    if (!chay) { chay = true; requestAnimationFrame(ve); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => vong.classList.remove('hien'));
}

// ───────────── Lớp canvas: pháo giấy + đồng xu ─────────────
let lop, ctx, hat = [], dangVe = false;
function batLop() {
  lop ||= document.getElementById('lop-fx');
  ctx ||= lop.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (lop.width !== innerWidth * dpr) { lop.width = innerWidth * dpr; lop.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
}
function veLop() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  hat = hat.filter((p) => p.song > 0 && p.y < innerHeight + 40);
  for (const p of hat) {
    p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.song--;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.song / 30);
    if (p.xu) {
      const sx = Math.abs(Math.cos(p.r * 2)) * 0.85 + 0.15;
      ctx.scale(sx, 1);
      ctx.fillStyle = '#c9a45c'; ctx.beginPath(); ctx.arc(0, 0, p.kt, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a6a1f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, p.kt * 0.68, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = p.mau; ctx.fillRect(-p.kt / 2, -p.kt / 4, p.kt, p.kt / 2);
    }
    ctx.restore();
  }
  if (hat.length) requestAnimationFrame(veLop); else { dangVe = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function chayLop() { if (!dangVe) { dangVe = true; requestAnimationFrame(veLop); } }

export function phaoGiay(soHat = 140) {
  if (!fx('phao-giay')) return;
  batLop();
  const mau = ['#ffffff', '#2b7fff', '#7f9cc4', '#c9a45c', '#f5f5f5'];
  for (let i = 0; i < soHat; i++) {
    const trai = i % 2 === 0;
    hat.push({ x: trai ? -10 : innerWidth + 10, y: innerHeight * 0.7, vx: (trai ? 1 : -1) * (6 + Math.random() * 9), vy: -(9 + Math.random() * 10),
      g: 0.28, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, kt: 7 + Math.random() * 7, mau: mau[i % mau.length], song: 220 + Math.random() * 80 });
  }
  chayLop();
}

export function dongXuRoi(soXu = 18) {
  if (!fx('dong-xu')) return;
  batLop();
  for (let i = 0; i < soXu; i++) {
    hat.push({ xu: true, x: innerWidth * (0.2 + Math.random() * 0.6), y: -30 - Math.random() * 200, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
      g: 0.22, r: Math.random() * 3, vr: 0.05 + Math.random() * 0.12, kt: 9 + Math.random() * 6, song: 260 });
  }
  chayLop();
}

/** Gợi ý phím tắt bật lên một lúc. */
let goiYTimer;
export function goiYPhim(html) {
  const el = document.querySelector('.goi-y-phim');
  if (!el || !fx('phim-tat')) return;
  el.innerHTML = html;
  el.classList.add('hien');
  clearTimeout(goiYTimer);
  goiYTimer = setTimeout(() => el.classList.remove('hien'), 3500);
}
