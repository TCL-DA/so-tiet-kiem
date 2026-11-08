// Giá vàng trực tiếp: vang.today → PNJ → SJC (SJC hay chặn trình duyệt gọi thẳng nên để cuối).
// Chuẩn hoá về giá 1 CHỈ: { nhan:{mua,ban}, mieng:{mua,ban}, nutrang:{mua,ban}, nguon, luc }.

const HET_GIO = 9000;

async function layJson(url, opt = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), HET_GIO);
  try {
    const r = await fetch(url, { ...opt, signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const chi = (luong) => Math.round(luong / 10);
const hop = (g) => g && g.mua > 1e6 && g.ban >= g.mua * 0.9;

async function tuSjc() {
  const d = await layJson('https://sjc.com.vn/GoldPrice/Services/PriceService.ashx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'method=GetCurrentGoldPricesByBranch&BranchId=1',
  });
  const tim = (re) => d.data.find((x) => re.test(x.TypeName));
  const nhan = tim(/nhẫn SJC 99,99% 1 chỉ/i), mieng = tim(/SJC 1L/i), nt = tim(/^Nữ trang 99,99%/i);
  const g = (x) => x && { mua: chi(x.BuyValue), ban: chi(x.SellValue) };
  return { nhan: g(nhan), mieng: g(mieng), nutrang: g(nt), nguon: 'SJC', capNhatNguon: d.latestDate };
}

async function tuVangToday() {
  const d = await layJson('https://www.vang.today/api/prices');
  const g = (x) => x && { mua: chi(x.buy), ban: chi(x.sell) };
  return { nhan: g(d.prices.SJ9999), mieng: g(d.prices.SJL1L10), nutrang: g(d.prices.DOJINHTV), nguon: 'vang.today', capNhatNguon: `${d.time} ${d.date}` };
}

async function tuPnj() {
  const d = await layJson('https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price?zone=00');
  const tim = (ma) => d.data.find((x) => x.masp === ma);
  const g = (x) => x && { mua: x.giamua * 1000, ban: x.giaban * 1000 };
  return { nhan: g(tim('N24K')), mieng: g(tim('SJC')), nutrang: g(tim('24K')), nguon: 'PNJ', capNhatNguon: '' };
}

const NGUON = { sjc: tuSjc, vangtoday: tuVangToday, pnj: tuPnj };
export const TEN_NGUON = { 'tu-dong': 'Tự động', vangtoday: 'vang.today', pnj: 'PNJ', sjc: 'SJC' };

/** Lấy giá; nguon = 'tu-dong' thì thử lần lượt. Ném lỗi nếu mọi nguồn hỏng. */
export async function layGiaVang(nguon = 'tu-dong') {
  const thu = nguon === 'tu-dong' ? ['vangtoday', 'pnj', 'sjc'] : [nguon];
  const loi = [];
  for (const k of thu) {
    try {
      const g = await NGUON[k]();
      if (!hop(g.nhan) && !hop(g.mieng)) throw new Error('dữ liệu lạ');
      g.nhan ||= g.mieng; g.mieng ||= g.nhan; g.nutrang ||= g.nhan;
      return { ...g, luc: Date.now() };
    } catch (e) { loi.push(`${k}: ${e.message}`); }
  }
  throw new Error(`Không lấy được giá vàng (${loi.join('; ')})`);
}

/** Ghi giá mới vào lịch sử (1 điểm / ngày, giữ 400 ngày). */
export function ghiLichSu(gv, g) {
  const ngay = new Date(g.luc).toISOString().slice(0, 10);
  const ls = (gv.lichSu || []).filter((p) => p.ngay !== ngay);
  ls.push({ ngay, nhan: g.nhan.mua, mieng: g.mieng.mua, nhanBan: g.nhan.ban, miengBan: g.mieng.ban });
  gv.lichSu = ls.slice(-400);
}
