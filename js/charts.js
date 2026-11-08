// Biểu đồ (Chart.js 4, vẽ trên thẻ Haze sáng). Màu: Signal Blue = tiền vào, Ink = tiền ra,
// Twilight = có tính tiền cho mượn, vàng đất = giá vàng. Kèm đường dóng dọc + vẽ dần theo hiệu ứng.
import { fx } from './effects.js';
import { fmt, fmtShort, fmtDate, fmtMonth } from './util.js';
import { KIEU, anhHuongTien } from './store.js';

const C = window.Chart;
const MAU = { vao: '#2b7fff', ra: '#1b1b1b', rong: '#426188', muon: '#426188', vang: '#a8842f', chuPhu: '#5c6370', luoi: 'rgba(0,0,0,.07)' };
let anSo = () => false;
export const datAnSo = (f) => { anSo = f; };
const tien = (v) => (anSo() ? '•••' : fmtShort(v));
const tienDu = (v) => (anSo() ? '••••••' : `${fmt(v)} đ`);

C.defaults.font.family = "'Inter', system-ui, sans-serif";
C.defaults.font.size = 12;
C.defaults.color = MAU.chuPhu;
C.defaults.borderColor = MAU.luoi;
C.defaults.maintainAspectRatio = false;

// Đường dóng dọc tại điểm đang rê
C.register({
  id: 'trucDoc',
  afterDatasetsDraw(chart) {
    if (!fx('truc-doc')) return;
    const act = chart.tooltip?.getActiveElements?.();
    if (!act?.length) return;
    const { ctx, chartArea: a } = chart, x = act[0].element.x;
    ctx.save(); ctx.strokeStyle = 'rgba(27,27,27,.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.restore();
  },
});

const tooltipChung = () => ({
  backgroundColor: '#1b1b1b', titleColor: '#fff', bodyColor: '#fff', footerColor: 'rgba(255,255,255,.7)',
  padding: 12, cornerRadius: 8, boxPadding: 4, usePointStyle: true, titleFont: { weight: '500' }, footerFont: { weight: '400', size: 12 },
  animation: fx('tooltip-muot') ? { duration: 220, easing: 'easeOutCubic' } : false,
});
const dongHoat = (id, ms = 1100) => (fx(id) ? { duration: ms, easing: 'easeOutQuart' } : false);

const ds = new Map();
function ve(id, canvas, cfg) {
  ds.get(id)?.destroy();
  const c = new C(canvas, cfg);
  ds.set(id, c);
  return c;
}
export function huyHet() { ds.forEach((c) => c.destroy()); ds.clear(); }

const tuThang = (kq, khoang) => {
  if (!khoang || !kq.cuoi) return '';
  const [y, m] = kq.cuoi.split('-').map(Number);
  const d = new Date(y, m - 1 - (khoang - 1), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

/** Đường số dư theo thời gian (bậc thang: giữ nguyên tới giao dịch kế tiếp). */
export function veSoDu(canvas, kq, khoang) {
  const tu = tuThang(kq, khoang);
  let no = 0;
  const diem = [], diemNo = [], gdNgay = new Map();
  for (const t of kq.tx) {
    no += t.kieu === 'muon' ? t.soTien : t.kieu === 'tra' ? -t.soTien : 0;
    const x = Date.parse(t.ngay);
    const cuoi = diem[diem.length - 1];
    if (cuoi && cuoi.x === x) { cuoi.y = kq.soDu.get(t.id); diemNo[diemNo.length - 1].y = cuoi.y + Math.max(0, no); }
    else { diem.push({ x, y: kq.soDu.get(t.id) }); diemNo.push({ x, y: kq.soDu.get(t.id) + Math.max(0, no) }); }
    if (!gdNgay.has(x)) gdNgay.set(x, []);
    gdNgay.get(x).push(t);
  }
  const loc = (a) => (tu ? a.filter((p) => p.x >= Date.parse(tu)) : a);
  const d1 = loc(diem), d2 = loc(diemNo);
  if (!d1.length) return null;
  // Mốc đầu mỗi tháng làm vạch trục ngang
  const moc = [];
  const dau = new Date(d1[0].x), cuoi = new Date(d1[d1.length - 1].x);
  for (let d = new Date(dau.getFullYear(), dau.getMonth() + 1, 1); d <= cuoi; d.setMonth(d.getMonth() + 1)) moc.push(+d);
  const buocNhan = Math.max(1, Math.ceil(moc.length / (canvas.parentElement.clientWidth < 500 ? 4 : 9)));
  const tong = Math.min(1600, 400 + d1.length * 8), moi = tong / d1.length;
  const veDan = fx('ve-duong') ? {
    x: { type: 'number', easing: 'linear', duration: moi, from: NaN, delay: (c) => (c.type !== 'data' || c.xS ? 0 : (c.xS = true, c.index * moi)) },
    y: { type: 'number', easing: 'linear', duration: moi, from: (c) => (c.index === 0 ? c.chart.scales.y.getPixelForValue(0) : c.chart.getDatasetMeta(c.datasetIndex).data[c.index - 1].getProps(['y'], true).y),
      delay: (c) => (c.type !== 'data' || c.yS ? 0 : (c.yS = true, c.index * moi)) },
  } : {};
  return ve('sodu', canvas, {
    type: 'line',
    data: { datasets: [
      { label: 'Tiền trong sổ', data: d1, borderColor: MAU.vao, backgroundColor: 'rgba(43,127,255,.09)', fill: 'origin', borderWidth: 2, stepped: 'after', pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: MAU.vao },
      { label: 'Sổ + tiền cho mượn', data: d2, borderColor: MAU.rong, borderDash: [6, 4], borderWidth: 1.6, stepped: 'after', pointRadius: 0, pointHoverRadius: 4, fill: false, hidden: kq.dangChoMuon <= 0 },
    ] },
    options: {
      parsing: false, normalized: true, interaction: { mode: 'nearest', axis: 'x', intersect: false },
      animation: fx('ve-duong') ? {} : false, animations: veDan,
      scales: {
        x: { type: 'linear', min: d1[0].x, max: d1[d1.length - 1].x, grid: { display: false },
          afterBuildTicks: (s) => { s.ticks = moc.filter((_, i) => i % buocNhan === 0).map((v) => ({ value: v })); },
          ticks: { callback: (v) => { const d = new Date(v); return fmtMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }, maxRotation: 0, autoSkip: false } },
        y: { beginAtZero: true, ticks: { callback: tien, maxTicksLimit: 6 }, border: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipChung(),
          callbacks: {
            title: (it) => fmtDate(new Date(it[0].parsed.x).toISOString().slice(0, 10)),
            label: (it) => ` ${it.dataset.label}: ${tienDu(it.parsed.y)}`,
            footer: (it) => {
              const g = gdNgay.get(it[0].parsed.x) || [];
              const dong = g.slice(0, 4).map((t) => `${KIEU[t.kieu].dau}${anSo() ? '•••' : fmtShort(t.soTien)}  ${t.ghiChu || KIEU[t.kieu].ten}`);
              if (g.length > 4) dong.push(`… và ${g.length - 4} giao dịch khác`);
              return dong;
            },
          } },
      },
    },
  });
}

/** Cột gửi vào / rút ra theo tháng + đường dư ròng. onChon(thang) khi bấm cột. */
export function veThang(canvas, kq, khoang, onChon) {
  const ds_ = khoang ? kq.dsThang.slice(-khoang) : kq.dsThang;
  if (!ds_.length) return null;
  const n = ds_.length;
  return ve('thang', canvas, {
    data: {
      labels: ds_.map((x) => fmtMonth(x.k)),
      datasets: [
        { type: 'bar', label: 'Gửi vào', data: ds_.map((x) => x.vao), backgroundColor: MAU.vao, borderRadius: 3, maxBarThickness: 22, order: 2 },
        { type: 'bar', label: 'Rút ra', data: ds_.map((x) => x.ra), backgroundColor: MAU.ra, borderRadius: 3, maxBarThickness: 22, order: 2 },
        { type: 'line', label: 'Dư ròng', data: ds_.map((x) => x.vao - x.ra), borderColor: MAU.rong, backgroundColor: MAU.rong, borderWidth: 1.6, borderDash: [5, 4], pointRadius: n > 24 ? 0 : 2.5, pointHoverRadius: 5, tension: 0.25, order: 1 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      animation: dongHoat('cot-moc', 900),
      animations: fx('cot-moc') ? { y: { from: (c) => c.chart.scales?.y?.getPixelForValue(0), delay: (c) => (c.type === 'data' && c.mode === 'default' ? c.dataIndex * Math.min(40, 900 / n) : 0) } } : {},
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } },
        y: { ticks: { callback: tien, maxTicksLimit: 6 }, border: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipChung(), callbacks: {
          title: (it) => fmtMonth(ds_[it[0].dataIndex].k, true),
          label: (it) => ` ${it.dataset.label}: ${tienDu(it.parsed.y)}`,
          footer: (it) => `${ds_[it[0].dataIndex].n} giao dịch · bấm để xem`,
        } },
      },
      onClick: (_, els) => { if (els.length) onChon?.(ds_[els[0].index].k); },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    },
  });
}

/** So sánh theo năm. */
export function veNam(canvas, kq) {
  if (!kq.nam.length) return null;
  return ve('nam', canvas, {
    type: 'bar',
    data: {
      labels: kq.nam.map((x) => `Năm ${x.k}`),
      datasets: [
        { label: 'Gửi vào', data: kq.nam.map((x) => x.vao), backgroundColor: MAU.vao, borderRadius: 4, maxBarThickness: 40 },
        { label: 'Rút ra', data: kq.nam.map((x) => x.ra), backgroundColor: MAU.ra, borderRadius: 4, maxBarThickness: 40 },
        { label: 'Dư ròng', data: kq.nam.map((x) => x.vao - x.ra), backgroundColor: 'rgba(66,97,136,.35)', borderColor: MAU.rong, borderWidth: 1.5, borderRadius: 4, maxBarThickness: 40 },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      animation: dongHoat('cot-moc'),
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: tien, maxTicksLimit: 6 }, border: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { ...tooltipChung(), callbacks: {
        label: (it) => ` ${it.dataset.label}: ${tienDu(it.parsed.y)}`,
        footer: (it) => `${kq.nam[it[0].dataIndex].n} giao dịch`,
      } } },
    },
  });
}

/** Giá vàng mua vào theo ngày (từ lịch sử ghi lại mỗi lần mở web). */
export function veGiaVang(canvas, lichSu, loai) {
  const k = loai === 'mieng' ? 'mieng' : 'nhan';
  const d = (lichSu || []).filter((p) => p[k]);
  if (d.length < 2) return null;
  return ve('vang', canvas, {
    type: 'line',
    data: { labels: d.map((p) => fmtDate(p.ngay, true)), datasets: [
      { label: 'Mua vào / chỉ', data: d.map((p) => p[k]), borderColor: MAU.vang, backgroundColor: 'rgba(168,132,47,.1)', fill: 'origin', borderWidth: 2, pointRadius: d.length > 30 ? 0 : 2.5, tension: 0.2 },
    ] },
    options: {
      interaction: { mode: 'index', intersect: false }, animation: dongHoat('ve-duong'),
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } }, y: { ticks: { callback: (v) => fmtShort(v), maxTicksLimit: 5 }, border: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { ...tooltipChung(), callbacks: { label: (it) => ` ${it.dataset.label}: ${fmt(it.parsed.y)} đ` } } },
    },
  });
}

/** Bật/tắt một đường từ chú giải. */
export function anHienDuong(id, i, hien) {
  const c = ds.get(id);
  if (!c) return;
  c.setDatasetVisibility(i, hien);
  c.update();
}

/** Lịch giao dịch 53 tuần (HTML). Trả chuỗi HTML; ô có data-ngay để bấm lọc. */
export function lichHtml(kq) {
  if (!kq.cuoi) return '';
  const net = new Map();
  for (const t of kq.tx) net.set(t.ngay, (net.get(t.ngay) || 0) + anhHuongTien(t));
  const cuoi = new Date(kq.cuoi + 'T00:00:00');
  const dau = new Date(cuoi); dau.setDate(dau.getDate() - 7 * 52 - ((cuoi.getDay() + 6) % 7));
  const muc = (v) => { const a = Math.abs(v); return a >= 2e7 ? 4 : a >= 8e6 ? 3 : a >= 3e6 ? 2 : 1; };
  let html = '', c = 0, thangTruoc = '';
  for (let d = new Date(dau), tuan = 0; d <= cuoi; tuan++) {
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    html += `<span class="th" style="grid-column:${tuan + 1}">${mk !== thangTruoc && d.getDate() <= 7 ? fmtMonth(mk).split('/')[0] : ''}</span>`;
    thangTruoc = mk;
    for (let thu = 0; thu < 7; thu++, d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const v = net.get(iso);
      const lop = d > cuoi ? 'rong' : v > 0 ? `v${muc(v)}` : v < 0 ? `r${muc(v)}` : '';
      const nhan = v ? `${fmtDate(iso)}: ${v > 0 ? 'vào' : 'ra'} ${anSo() ? '•••' : fmt(Math.abs(v))} đ` : fmtDate(iso);
      html += `<button type="button" class="n ${lop}" style="grid-column:${tuan + 1};grid-row:${thu + 2};--c:${c++ % 371}" data-ngay="${v ? iso : ''}" title="${nhan}" aria-label="${nhan}" ${v ? '' : 'tabindex="-1"'}></button>`;
    }
  }
  return html;
}
