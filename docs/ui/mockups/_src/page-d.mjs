import { page, logo, icoCheck } from "./lib.mjs";

export const boCss = `
.masthead .row1 { display: flex; align-items: center; gap: var(--s4); min-height: 56px; }
.masthead .row2 { display: none; }
.who { margin-left: auto; display: none; align-items: center; gap: var(--s3); font-size: var(--t-sm); color: var(--on-night); }
.who b { color: #fff; }
.who a { color: var(--flood); }
.role { background: var(--flood); color: var(--night); border-radius: var(--r-pill); padding: 1px 10px; font-weight: 600; }
.masthead .row2 nav { display: flex; gap: var(--s1); align-items: stretch; border-top: 1px solid rgba(195, 214, 203, 0.25); }
.masthead .row2 a { color: var(--on-night-2); text-decoration: none; font-size: var(--t-sm); padding: 0 var(--s3); min-height: 44px; display: inline-flex; align-items: center; border-bottom: 3px solid transparent; }
.masthead .row2 a[aria-current="page"] { color: #fff; border-bottom-color: var(--flood); font-weight: 600; }
.masthead .row2 .sep { width: 1px; background: rgba(195, 214, 203, 0.35); margin: 8px var(--s3); }
.masthead .row2 .grp { color: var(--flood); font-size: var(--t-sm); font-weight: 600; display: inline-flex; align-items: center; padding: 0 var(--s2) 0 0; }
.bo { display: grid; gap: var(--s4); padding-top: var(--s4); padding-bottom: var(--s7); }
.bo-nav { display: flex; gap: var(--s2); overflow-x: auto; padding: 2px 2px var(--s2); }
.bo-nav a { flex: none; display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--s4); border: 1.5px solid var(--edge); border-radius: var(--r-pill); background: var(--paper); color: var(--night); text-decoration: none; font-size: var(--t-sm); font-weight: 600; }
.bo-nav a[aria-current="page"] { background: var(--night); border-color: var(--night); color: #fff; }
.bo-nav .g { display: none; }
.bo-main { min-width: 0; display: grid; gap: var(--s4); align-content: start; }
.bo-main h1 { margin: 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: var(--s3) var(--s4); align-items: end; justify-content: space-between; }
.toolbar .fld { min-width: 190px; }
.row-2 { display: grid; gap: var(--s4); }
.row-3 { display: grid; gap: var(--s4); }
.panel h2 { font-size: var(--t-lg); }
.panel .cap { font-size: var(--t-sm); color: var(--ink-2); margin: -4px 0 var(--s3); }
.stat .lab { font-size: var(--t-md); color: var(--ink-2); }
.stat .big { font: 600 48px/1.15 var(--font-head); color: var(--night); font-variant-numeric: tabular-nums; margin: 2px 0 var(--s3); }
.stat dl { margin: 0; display: grid; gap: var(--s2); }
.stat dl div { display: flex; justify-content: space-between; gap: var(--s3); border-top: 1px solid var(--line); padding-top: var(--s2); }
.stat dt { color: var(--ink-2); } .stat dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.stat .ok { margin-top: var(--s3); display: flex; align-items: center; justify-content: space-between; gap: var(--s3); border-top: 1px solid var(--line); padding-top: var(--s3); }
.chart { width: 100%; height: auto; display: block; }
.chart text { font-family: var(--font-body); font-size: 13px; fill: var(--ink); }
.chart .lab { fill: var(--ink-2); }
.chart .val { font-weight: 600; fill: var(--night); }
.util { display: grid; gap: var(--s4); }
.util .l { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.util .l b { font-family: var(--font-head); font-weight: 600; color: var(--night); }
.util .l span { font-variant-numeric: tabular-nums; font-weight: 600; }
.util small { color: var(--ink-2); font-size: var(--t-sm); display: block; margin-top: 4px; }
.wk { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--s3); align-items: end; height: 200px; border-bottom: 1.5px solid var(--edge); }
.wk .c { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; gap: 4px; font-size: var(--t-sm); color: var(--ink-2); }
.wk .c i { display: block; width: 100%; max-width: 56px; background: var(--turf); border-radius: var(--r-xs) var(--r-xs) 0 0; }
.wk .c em { font-style: normal; font-weight: 600; color: var(--night); font-variant-numeric: tabular-nums; }
.wk .c span { position: relative; top: 26px; margin-top: -22px; white-space: nowrap; }
.wk .c.today i { background: var(--flood); outline: 2px solid var(--night); outline-offset: -2px; }
.wk .c.today span { color: var(--night); font-weight: 600; }
.wk { margin-bottom: 30px; }
.hours { display: grid; grid-template-columns: repeat(16, 1fr); gap: 3px; align-items: end; height: 150px; }
.hours .c { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; font-size: 13px; color: var(--ink-2); gap: 4px; }
.hours .c i { display: block; width: 100%; min-height: 3px; border-radius: var(--r-xs) var(--r-xs) 0 0; background: var(--turf); }
.hours .c.max i { background: var(--flood); outline: 2px solid var(--night); outline-offset: -2px; }
.hours .c em { font-style: normal; font-weight: 600; color: var(--night); font-size: 13px; }
.hours .c span { font-variant-numeric: tabular-nums; }
.stat-chips { display: flex; flex-wrap: wrap; gap: var(--s2); }
.tag b { font-variant-numeric: tabular-nums; }
@media (min-width: 1000px) {
  .masthead .row2 { display: block; }
  .masthead .row1 .who { display: flex; }
  .bo { grid-template-columns: 228px minmax(0, 1fr); gap: var(--s6); padding-top: var(--s5); }
  .bo-nav { flex-direction: column; overflow: visible; gap: 2px; padding: 0; position: sticky; top: var(--s4); align-self: start; }
  .bo-nav a { border: 0; border-radius: var(--r-sm); border-left: 4px solid transparent; background: transparent; justify-content: flex-start; padding: 0 var(--s3); font-weight: 400; font-size: var(--t-md); }
  .bo-nav a:hover { background: var(--turf-tint); }
  .bo-nav a[aria-current="page"] { background: var(--turf-tint); color: var(--night); border-left-color: var(--flood); font-weight: 600; }
  .bo-nav .g { display: block; flex: none; margin: var(--s4) 0 var(--s1) var(--s3); font-size: var(--t-sm); font-weight: 600; color: var(--ink-2); }
  .bo-nav .g:first-child { margin-top: 0; }
  .row-2 { grid-template-columns: 5fr 7fr; }
  .row-3 { grid-template-columns: 1fr 1.25fr 1fr; }
}
footer.site { background: var(--night); color: var(--on-night-2); padding: var(--s5) 0; font-size: var(--t-sm); }
footer.site a { color: var(--flood); }
`;

export const boHeader = (activeRow2 = "หลังบ้าน") => `<header class="masthead"><div class="container">
  <div class="row1">
    <a class="brand" href="#" style="display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;font:600 18px/1 var(--font-head)">${logo(32)}<span>ลูกหนัง อารีน่า</span></a>
    <div class="who"><span><b>เจ้าของร้าน</b> <span class="role" data-testid="staff-whoami">OWNER</span></span><a href="#" data-testid="logout">ออกจากระบบ</a></div>
    <div class="lang" role="group" aria-label="ภาษา" style="margin-left:auto"><button aria-pressed="true">TH</button><button aria-pressed="false">EN</button></div>
    <button class="menu-btn" aria-expanded="false">เมนู</button>
  </div>
  <div class="row2"><nav aria-label="เมนูหลัก">
    ${["หน้าแรก", "ตารางว่าง", "สนาม", "หาคู่แข่ง", "จองประจำ", "การจองของฉัน"].map((t) => `<a href="#">${t}</a>`).join("")}
    <span class="sep"></span><span class="grp">พนักงาน</span>
    ${["หน้าสนาม", "คลังของ", "ภาพรวมวันนี้", "หลังบ้าน", "เจ้าของ"].map((t) => `<a href="#"${t === activeRow2 ? ' aria-current="page"' : ""}>${t}</a>`).join("")}
  </nav></div>
</div></header>`;

export const boNav = (active) => {
  const g = (t) => `<span class="g">${t}</span>`;
  const a = (t) => `<a href="#"${t === active ? ' aria-current="page"' : ""}>${t}</a>`;
  return `<nav class="bo-nav" aria-label="เมนูหลังบ้าน">${g("ภาพรวม")}${a("แดชบอร์ด")}${g("การจอง")}${a("การจองทั้งหมด")}${a("ประวัติแชท")}${g("คลังของ")}${a("คลังของ")}${a("ขายหน้าเคาน์เตอร์")}${a("ย้ายของ")}${a("รับเข้า/ชำรุด/ปรับยอด")}${g("รายงานและตรวจสอบ")}${a("รายงาน")}${a("บันทึกการกระทำ")}</nav>`;
};

const week = [["ส. 3", 600], ["อา. 4", 0], ["จ. 5", 600], ["อ. 6", 1200], ["พ. 7", 0], ["พฤ. 8", 4860], ["ศ. 9", 40]];
const weekChart = () => {
  let s = `<div class="wk" role="img" aria-label="กราฟยอดเงิน 7 วันล่าสุด" data-testid="dash-chart">`;
  week.forEach(([d, v], i) => {
    const today = i === 6;
    const h = Math.max((v / 4860) * 150, v > 0 ? 4 : 3);
    s += `<div class="c${today ? " today" : ""}" data-testid="dash-bar-${i}" data-value="${v}"><em>${v.toLocaleString("en-US")}</em><i style="height:${h}px"></i><span>${d}</span></div>`;
  });
  return s + "</div>";
};
const hoursChart = () => {
  const data = { 18: 1, 19: 4 };
  let s = `<div class="hours" role="img" aria-label="ช่วงเวลาที่จองมาก 7 วันล่าสุด มากสุด 19:00 จอง 4 ครั้ง">`;
  for (let h = 8; h <= 23; h++) {
    const n = data[h] ?? 0;
    s += `<div class="c${n === 4 ? " max" : ""}" data-testid="dash-hour-${h}" data-value="${n}">${n ? `<em>${n}</em>` : ""}<i style="height:${n ? (n / 4) * 100 : 0}px;${n ? "" : "min-height:3px"}"></i><span>${String(h).padStart(2, "0")}</span></div>`;
  }
  return s + "</div>";
};

const dashboard = `
<main class="container bo">
  ${boNav("แดชบอร์ด")}
  <div class="bo-main">
    <div class="toolbar">
      <h1>แดชบอร์ด</h1>
      <label class="fld"><span class="lbl">ดูข้อมูลของวันที่</span><input type="date" data-testid="dash-date" value="2026-10-09"></label>
    </div>

    <div class="row-2">
      <section class="panel stat" aria-labelledby="h-today">
        <h2 id="h-today" class="sr-only">เงินเข้าวันนี้</h2>
        <div class="lab">เงินเข้าวันนี้ (ศ. 9 ต.ค. 2026)</div>
        <div class="big" data-testid="dash-today-total" data-value="40">฿40</div>
        <dl>
          <div><dt>จากการจอง</dt><dd data-testid="dash-today-booking-money">฿0</dd></div>
          <div><dt>ขายหน้าเคาน์เตอร์</dt><dd data-testid="dash-today-sales">฿40</dd></div>
          <div><dt>ใช้เครดิตแทนเงิน (ไม่นับเป็นรายได้)</dt><dd data-testid="dash-today-credit">฿0</dd></div>
        </dl>
        <div class="ok"><span>ของใกล้หมด</span><span class="tag" data-testid="dash-low-stock" data-value="0">0 รายการ ปกติ</span></div>
      </section>
      <section class="panel" aria-labelledby="h-week">
        <h2 id="h-week">เงินเข้า 7 วันล่าสุด รวม <span data-testid="dash-week-total" data-value="7300">฿7,300</span></h2>
        <p class="cap">แท่งเหลืองคือวันที่เลือก</p>
        ${weekChart()}
      </section>
    </div>

    <div class="row-3">
      <section class="panel" aria-labelledby="h-util">
        <h2 id="h-util">การใช้สนามวันนี้</h2>
        <div class="util">
          ${[["A", 13, "2 จาก 16 ชั่วโมง"], ["B", 0, "ยังไม่มีการจอง"], ["C", 0, "ยังไม่มีการจอง"]].map(([f, p, t]) => `<div><div class="l"><b>สนาม ${f}</b><span data-testid="dash-util-${f}" data-value="${p}">${p}%</span></div><div class="meter" role="meter" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="สนาม ${f}"><i style="width:${p}%"></i></div><small>${t}</small></div>`).join("")}
        </div>
      </section>
      <section class="panel" aria-labelledby="h-hours">
        <h2 id="h-hours">ชั่วโมงที่จองมาก (7 วัน)</h2>
        <p class="cap">มากสุด 19:00 จอง 4 ครั้ง</p>
        ${hoursChart()}
      </section>
      <section class="panel" aria-labelledby="h-st">
        <h2 id="h-st">การจองของวันนี้</h2>
        <div class="stat-chips"><span class="tag" data-testid="dash-status-CONFIRMED"><b>1</b> ยืนยันแล้ว</span></div>
        <p class="muted small" style="margin:var(--s3) 0 0">ไม่มีรายการรอจ่ายเงิน ยกเลิก หรือไม่มา</p>
        <a class="btn ghost small" style="margin-top:var(--s4)" href="#">ดูการจองทั้งหมด</a>
      </section>
    </div>
  </div>
</main>`;

export function build() {
  const body = `${boHeader("หลังบ้าน")}${dashboard}<footer class="site"><div class="container">© 2026 ลูกหนัง อารีน่า</div></footer>`;
  return { "d-dashboard.html": page("d · แดชบอร์ดเจ้าของ (ร่าง)", boCss, body) };
}
