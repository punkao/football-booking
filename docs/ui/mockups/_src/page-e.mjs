import { page, icoWarn } from "./lib.mjs";
import { boCss, boHeader, boNav } from "./page-d.mjs";

const css = `${boCss}
.filters { display: grid; gap: var(--s3); }
.filters .btns { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; }
.quick { display: flex; gap: var(--s2); flex-wrap: wrap; }
.quick .chip { display: inline-flex; align-items: center; min-height: 40px; padding: 0 var(--s4); border-radius: var(--r-pill); border: 1.5px solid var(--edge); background: var(--paper); font: 600 var(--t-sm)/1 var(--font-body); color: var(--night); }
.quick .chip[aria-pressed="true"] { background: var(--night); color: #fff; border-color: var(--night); }
.count { font-size: var(--t-sm); color: var(--ink-2); margin: 0; }
.tw { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
table.data { width: 100%; border-collapse: collapse; font-size: var(--t-md); }
table.data th { position: sticky; top: 0; background: #e3ece7; color: var(--night); font: 600 var(--t-sm)/1.3 var(--font-body); text-align: left; padding: var(--s3) var(--s4); border-bottom: 1.5px solid var(--edge); white-space: nowrap; }
table.data td { padding: var(--s3) var(--s4); border-bottom: 1px solid var(--line); vertical-align: top; }
table.data tr:last-child td { border-bottom: 0; }
table.data tbody tr:hover td { background: #f6faf7; }
table.data .num { text-align: right; font-variant-numeric: tabular-nums; }
table.data td .sub { display: block; color: var(--ink-2); font-size: var(--t-sm); }
table.data a { font-weight: 600; }
.cards-note { display: none; }
@media (max-width: 719px) {
  table.data, table.data tbody, table.data tr, table.data td { display: block; }
  table.data thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  table.data tr { display: grid; grid-template-columns: 1fr auto; gap: 2px var(--s3); padding: var(--s3) var(--s4); border-bottom: 1px solid var(--line); }
  table.data tr:last-child { border-bottom: 0; }
  table.data td { border: 0; padding: 0; }
  table.data td.c-code { grid-column: 1; font-size: var(--t-lg); }
  table.data td.c-status { grid-column: 2; grid-row: 1; justify-self: end; }
  table.data td.c-when { grid-column: 1 / -1; }
  table.data td.c-cust { grid-column: 1 / -1; }
  table.data td.num { grid-column: 1 / -1; text-align: left; display: flex; justify-content: space-between; border-top: 1px dashed var(--line); margin-top: var(--s2); padding-top: var(--s2); }
  table.data td.num::before { content: attr(data-label); color: var(--ink-2); font-size: var(--t-sm); }
  table.data td.num + td.num { border-top: 0; margin-top: 0; padding-top: 0; }
}
@media (min-width: 720px) { .filters { grid-template-columns: 1fr 1fr 1fr auto; align-items: end; } }
.narrow { max-width: 880px; margin: 0 auto; padding-top: var(--s5); padding-bottom: var(--s7); display: grid; gap: var(--s5); }
.hol { list-style: none; margin: 0 0 var(--s4); padding: 0; display: grid; }
.hol li { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); min-height: 52px; border-top: 1px solid var(--line); }
.hol li:first-child { border-top: 0; }
.hol b { font-weight: 600; }
.two { display: grid; gap: var(--s3); }
@media (min-width: 720px) { .two { grid-template-columns: 1fr 1fr; } .four { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s3); } }
.four { display: grid; gap: var(--s3); grid-template-columns: 1fr 1fr; }
.danger-zone { border: 2px solid var(--alert); border-radius: var(--r-md); background: var(--paper); overflow: hidden; }
.danger-zone .dz-head { background: var(--alert-tint); color: #9c1f18; padding: var(--s3) var(--s4); display: flex; gap: var(--s2); align-items: center; }
.danger-zone .dz-head h2 { margin: 0; color: #9c1f18; font-size: var(--t-lg); }
.danger-zone .dz-body { padding: var(--s4); display: grid; gap: var(--s4); }
.consequence { background: var(--alert-tint); border-radius: var(--r-sm); padding: var(--s3) var(--s4); color: #7d1913; font-size: var(--t-md); }
.dz-act { display: flex; justify-content: flex-end; border-top: 1px solid var(--line); padding-top: var(--s4); }
.empty { color: var(--ink-2); margin: 0; }
.view[hidden] { display: none; }
`;

const rows = [
  ["LN-100001", "สนาม B", "พ. 14 ต.ค. 2026 19:00–20:00", "แนน ทดลอง", "0844444444", "pending", "รอชำระเงิน", "฿1,200", "฿0"],
  ["LN-100002", "สนาม A", "ศ. 9 ต.ค. 2026 19:00–21:00", "ต้น ตัวอย่าง", "0811111111", "", "ยืนยันแล้ว", "฿2,400", "฿2,400"],
  ["LN-100003", "สนาม C", "ส. 10 ต.ค. 2026 17:00–18:00", "มิว ตัวอย่าง", "0822222222", "", "ยืนยันแล้ว", "฿1,800", "฿900"],
  ["LN-100004", "สนาม A", "อา. 11 ต.ค. 2026 10:00–11:00", "เก่ง ตัวอย่าง", "0833333333", "bad", "ยกเลิก", "฿1,200", "฿0"],
];
const table = `<div class="tw"><table class="data" data-testid="bk-results" data-count="4">
<thead><tr><th>รหัส</th><th>สนามและเวลา</th><th>ผู้จอง</th><th>สถานะ</th><th class="num">ยอดรวม</th><th class="num">จ่ายแล้ว</th></tr></thead><tbody>
${rows.map((r) => `<tr data-testid="bk-row-${r[0]}"><td class="c-code" data-label="รหัส"><a href="#" data-testid="bk-link-${r[0]}">${r[0]}</a></td><td class="c-when" data-label="สนามและเวลา"><b style="font-weight:600">${r[1]}</b><span class="sub">${r[2]}</span></td><td class="c-cust" data-label="ผู้จอง">${r[3]}<span class="sub">${r[4]}</span></td><td class="c-status" data-label="สถานะ"><span class="tag ${r[5]}" data-testid="bk-status-${r[0]}">${r[6]}</span></td><td class="num" data-label="ยอดรวม">${r[7]}</td><td class="num" data-label="จ่ายแล้ว">${r[8]}</td></tr>`).join("")}
</tbody></table></div>`;

const list = `
<main class="container bo view" id="v-list">
  ${boNav("การจองทั้งหมด")}
  <div class="bo-main">
    <h1>การจองทั้งหมด</h1>
    <form class="panel filters" onsubmit="return false" aria-label="ค้นหาการจอง">
      <label class="fld"><span class="lbl">รหัสการจอง</span><input type="text" data-testid="bk-search-code" placeholder="เช่น LN-100001"></label>
      <label class="fld"><span class="lbl">เบอร์โทร</span><input type="tel" data-testid="bk-search-phone" placeholder="10 หลัก"></label>
      <label class="fld"><span class="lbl">วันเตะ</span><input type="date" data-testid="bk-search-date"></label>
      <div class="btns"><button class="btn" data-testid="bk-search-submit">ค้นหา</button></div>
    </form>
    <div class="quick" role="group" aria-label="กรองตามสถานะ"><button class="chip" aria-pressed="true">ทั้งหมด</button><button class="chip" aria-pressed="false">รอชำระเงิน</button><button class="chip" aria-pressed="false">ยืนยันแล้ว</button><button class="chip" aria-pressed="false">ยกเลิก</button></div>
    <p class="count">พบ 4 รายการ ตัวอย่างข้อมูลสำหรับร่างหน้าตา</p>
    ${table}
  </div>
</main>`;

const owner = `
<main class="container narrow view" id="v-owner" hidden>
  <h1 style="margin:0">เจ้าของร้าน</h1>
  <section class="panel" aria-labelledby="h-hol">
    <h2 id="h-hol">วันหยุดนักขัตฤกษ์</h2>
    <p class="muted small" style="margin-top:-4px">วันหยุดคิดราคาเย็นทุกรอบ (มีผลกับการจองใหม่)</p>
    <ul class="hol" data-testid="holiday-list">
      <li data-testid="holiday-2026-10-13"><span><b>อ. 13 ต.ค. 2026</b> วันคล้ายวันสวรรคต ร.9</span><button class="btn ghost small" aria-label="ลบวันหยุด 13 ต.ค.">ลบ</button></li>
      <li><span><b>ศ. 23 ต.ค. 2026</b> วันปิยมหาราช</span><button class="btn ghost small" aria-label="ลบวันหยุด 23 ต.ค.">ลบ</button></li>
      <li><span><b>ส. 5 ธ.ค. 2026</b> วันพ่อแห่งชาติ</span><button class="btn ghost small" aria-label="ลบวันหยุด 5 ธ.ค.">ลบ</button></li>
    </ul>
    <form class="two" onsubmit="return false">
      <label class="fld"><span class="lbl">วันที่</span><input type="date" data-testid="holiday-date"></label>
      <label class="fld"><span class="lbl">ชื่อวันหยุด</span><input type="text" data-testid="holiday-name"></label>
      <div style="grid-column:1/-1"><button class="btn" data-testid="holiday-add">เพิ่มวันหยุด</button></div>
    </form>
  </section>

  <section class="danger-zone" aria-labelledby="h-dz">
    <div class="dz-head">${icoWarn}<h2 id="h-dz">โซนอันตราย: ปิดสนามเพราะฝน</h2></div>
    <form class="dz-body" onsubmit="return false">
      <p class="consequence"><b>ย้อนกลับไม่ได้</b> ปุ่มนี้ปิดรอบที่เลือกทันที และคืนเครดิตให้ผู้จองที่ยืนยันแล้วเต็มจำนวน ปิดได้เฉพาะสนามกลางแจ้ง A และ B</p>
      <div class="four">
        <label class="fld"><span class="lbl">สนาม</span><select data-testid="closure-field"><option>สนาม A</option></select></label>
        <label class="fld"><span class="lbl">วันที่</span><input type="date" data-testid="closure-date"></label>
        <label class="fld"><span class="lbl">ตั้งแต่</span><select data-testid="closure-from"><option>17:00</option></select></label>
        <label class="fld"><span class="lbl">ถึง</span><select data-testid="closure-to"><option>19:00</option></select></label>
      </div>
      <div class="dz-act"><button class="btn danger" data-testid="closure-submit">ปิดสนามและคืนเครดิต</button></div>
      <div><h3 style="font-size:var(--t-md)">ประวัติการปิด</h3><p class="empty">ยังไม่เคยปิดสนาม</p></div>
    </form>
  </section>
</main>`;

export function build() {
  const body = `${boHeader("หลังบ้าน")}${list}${owner}<footer class="site"><div class="container">© 2026 ลูกหนัง อารีน่า</div></footer>`;
  const script = `const h = location.hash.slice(1) || "list"; document.getElementById("v-list").hidden = h !== "list"; document.getElementById("v-owner").hidden = h !== "owner";`;
  return { "e-backoffice-parts.html": page("e · ตารางและโซนอันตราย (ร่าง)", css, body, script) };
}
