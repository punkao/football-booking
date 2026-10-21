import { page, header, icoCheck, icoWarn, icoBot } from "./lib.mjs";

const css = `
main { padding: var(--s4) 0 var(--s7); }
.crumb { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--s1); }
h1 { margin-bottom: var(--s4); }
.stepper-wrap { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--s4) var(--s3) var(--s3); margin-bottom: var(--s4); }
.stepper-wrap .here { text-align: center; margin: var(--s3) 0 0; font-size: var(--t-sm); color: var(--ink-2); }
.stack { display: grid; gap: var(--s4); }
.stack > * { min-width: 0; }
.hint { display: flex; gap: var(--s3); background: var(--flood-tint); border-radius: var(--r-md); padding: var(--s3) var(--s4); color: var(--ink); font-size: var(--t-md); }
.hint svg { flex: none; margin-top: 4px; color: var(--amber-ink); }
.toolbar { display: flex; flex-wrap: wrap; gap: var(--s3) var(--s4); align-items: center; }
.toolbar select { width: auto; min-width: 160px; }
.sum-line { margin: 0 0 var(--s3); font-size: var(--t-md); }
.recap { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--s3); margin: 0 0 var(--s3); }
.recap div { background: var(--turf-tint); border-radius: var(--r-sm); padding: var(--s2) var(--s3); }
.recap dt { font-size: var(--t-xs); color: var(--ink-2); }
.recap dd { margin: 0; font: 600 var(--t-md)/1.3 var(--font-head); color: var(--night); }
.formgrid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
.formgrid .wide { grid-column: 1 / -1; }
.rent { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
.sec-h { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s3); margin-bottom: var(--s3); }
.sec-h h2 { margin: 0; font-size: var(--t-lg); }
.sec-h span { font-size: var(--t-sm); color: var(--ink-2); }
.form { display: grid; gap: var(--s3); }
.after { margin: var(--s3) 0 0; font-size: var(--t-sm); color: var(--ink-2); }
.cta-area { display: grid; gap: var(--s2); }
.paybar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; background: var(--paper); border-top: 1px solid var(--line); box-shadow: var(--lift); padding: var(--s2) var(--s4); display: flex; align-items: center; justify-content: space-between; gap: var(--s3); }
.paybar .k { font-size: var(--t-sm); color: var(--ink-2); display: block; line-height: 1.2; }
.paybar .v { font: 600 var(--t-xl)/1.2 var(--font-head); color: var(--night); }
.chat-fab-unused { position: sticky; z-index: 12; float: right; margin: 0 var(--s4) var(--s3) 0; display: inline-flex; align-items: center; gap: var(--s2); min-height: 48px; padding: 0 var(--s4) 0 var(--s2); border-radius: var(--r-pill); border: 2px solid var(--flood); background: var(--night); color: #fff; font: 600 var(--t-sm)/1 var(--font-body); box-shadow: var(--lift); }
footer.site { background: var(--night); color: var(--on-night-2); padding: var(--s5) 0 var(--s5); font-size: var(--t-sm); }
.slot-grid { margin-top: var(--s3); }
.rowlab { display: flex; justify-content: space-between; align-items: center; gap: var(--s3); }
.step[hidden] { display: none; }
`;

const grid = () => {
  let out = `<div class="slot-grid" data-testid="slot-grid"><div></div><div class="head">A<small>5 คน</small></div><div class="head">B<small>5 คน</small></div><div class="head">C<small>7 คน, หลังคา</small></div>`;
  for (let h = 8; h <= 23; h++) {
    const hh = String(h).padStart(2, "0") + ":00";
    out += `<div class="hour">${hh}</div>`;
    for (const f of ["A", "B", "C"]) {
      const price = h < 17 ? (f === "C" ? 1200 : 800) : f === "C" ? 1800 : 1200;
      const fmt = "฿" + price.toLocaleString("en-US");
      if (h < 11) out += `<span class="slot past" data-testid="slot-${f}-${h}" data-status="past">หมดเวลา</span>`;
      else if (f === "A" && (h === 19 || h === 20)) out += `<span class="slot booked" data-testid="slot-${f}-${h}" data-status="booked"><strong>${fmt}</strong>จองแล้ว</span>`;
      else out += `<a href="#" class="slot${h >= 17 ? " eve" : ""}" data-testid="slot-${f}-${h}" data-status="free"><strong>${fmt}</strong>ว่าง</a>`;
    }
  }
  return out + "</div>";
};

const stepper = (cur, note) => {
  const names = ["สนาม/วัน", "รอบ", "ข้อมูล", "จ่าย"];
  return `<div class="stepper-wrap"><ol class="stepper" aria-label="ขั้นตอนการจอง">${names
    .map((n, i) => {
      const k = i + 1;
      const cls = k < cur ? "done" : k === cur ? "current" : "";
      return `<li class="${cls}"${k === cur ? ' aria-current="step"' : ""}><span class="n">${k < cur ? "✓" : k}</span><span>${n}</span></li>`;
    })
    .join("")}</ol><p class="here">${note}</p></div>`;
};

const step2 = `
<div class="step" id="s2">
${stepper(2, "ขั้นที่ 2 จาก 4: เลือกรอบที่ว่าง")}
<div class="stack">
  <div>
    <div class="date-rail" role="group" aria-label="เลือกวัน">
      <button class="date-chip" aria-pressed="true" data-testid="date-chip-2026-10-09"><span>วันนี้</span><b>9/10</b></button>
      ${[["ส.", "10/10"], ["อา.", "11/10"], ["จ.", "12/10"], ["อ.", "13/10"], ["พ.", "14/10"], ["พฤ.", "15/10"]].map(([d, n]) => `<button class="date-chip" aria-pressed="false"><span>${d}</span><b>${n}</b></button>`).join("")}
    </div>
  </div>
  <div class="hint">${icoWarn}<span>แตะช่องที่ว่างเพื่อเลือกรอบ ตัวเลขในช่องคือราคาต่อชั่วโมง ช่องสีเหลืองคือรอบตั้งแต่ 17:00 ที่เปิดไฟสนาม</span></div>
  <div class="toolbar">
    <label class="check" style="min-height:44px"><input type="checkbox" data-testid="filter-before-17"><span>เฉพาะรอบก่อน 17:00</span></label>
    <label class="fld" style="grid-auto-flow:column;align-items:center;gap:8px"><span class="lbl">เรียงตาม</span><select data-testid="sort-by" style="min-width:150px"><option>เวลา (ตาราง)</option></select></label>
  </div>
  <div>
    ${grid()}
    <ul class="legend"><li><i></i>ว่าง ก่อน 17:00</li><li><i class="eve"></i>ว่าง ตั้งแต่ 17:00</li><li><i class="booked"></i>จองแล้ว</li><li>เส้นประ = เลยเวลาจองแล้ว</li></ul>
  </div>
</div>
</div>`;

const step3 = `
<div class="step" id="s3" hidden>
${stepper(3, "ขั้นที่ 3 จาก 4: กรอกชื่อและเบอร์โทร แล้วยืนยัน")}
<form class="stack" onsubmit="return false">
  <section class="panel" aria-labelledby="h-time">
    <div class="sec-h"><h2 id="h-time">รอบที่เลือก</h2><span class="tag">รอบนี้ว่าง</span></div>
    <p class="sum-line"><b>สนาม A</b> วันพุธที่ 14 ต.ค. 2026 เวลา 17:00–18:00 (1 ชั่วโมง)</p>
    <div class="formgrid">
      <label class="fld wide"><span class="lbl">สนาม</span><select data-testid="book-field"><option>สนาม A (5 คน กลางแจ้ง)</option></select></label>
      <label class="fld wide"><span class="lbl">วันที่</span><input type="date" data-testid="book-date" value="2026-10-14"></label>
      <label class="fld"><span class="lbl">เวลาเริ่ม</span><select data-testid="book-start"><option>17:00</option></select></label>
      <label class="fld"><span class="lbl">จำนวนชั่วโมง</span><input type="number" data-testid="book-hours" value="1"></label>
    </div>
  </section>

  <section class="panel" aria-labelledby="h-rent">
    <div class="sec-h"><h2 id="h-rent">เช่าอุปกรณ์</h2><span>ไม่บังคับ</span></div>
    <div class="rent">
      <label class="fld"><span class="lbl">เอี๊ยม ฿50/ชุด</span><input type="number" data-testid="rental-BIB-qty" value="0"><span class="help">เหลือช่วงนี้ 6 จาก 6</span></label>
      <label class="fld"><span class="lbl">ลูกบอล ฿30/ลูก</span><input type="number" data-testid="rental-BALL-qty" value="0"><span class="help">เหลือช่วงนี้ 10 จาก 10</span></label>
    </div>
  </section>

  <section class="panel" aria-labelledby="h-cust">
    <div class="sec-h"><h2 id="h-cust">ข้อมูลผู้จอง</h2><span>ไม่ต้องสมัครสมาชิก</span></div>
    <div class="form">
      <label class="fld"><span class="lbl">ชื่อ</span><input type="text" data-testid="customer-name" autocomplete="name" value="แนน ทดลอง"></label>
      <label class="fld"><span class="lbl">เบอร์โทร (10 หลัก)</span><input type="tel" data-testid="customer-phone" aria-invalid="true" aria-describedby="e-phone" value="08444"><span class="field-error" id="e-phone" data-testid="field-error-phone">${icoWarn}<span>เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0</span></span><span class="help" data-testid="fix-hint-phone">วิธีแก้: พิมพ์เบอร์มือถือ 10 หลักติดกัน ไม่ต้องใส่ขีดหรือเว้นวรรค เช่น 0812345678</span></label>
      <label class="check"><input type="checkbox" data-testid="pdpa-consent"><span>ยินยอมให้ร้านเก็บชื่อและเบอร์โทรเพื่อจัดการการจองนี้ (PDPA)</span></label>
    </div>
  </section>

  <aside data-testid="price-panel" aria-labelledby="h-price">
    <h2 id="h-price" style="font-size:var(--t-lg)">สรุปราคา</h2>
    <div class="ticket">
      <div class="ticket-head"><div class="where">สนาม A</div><div class="when">พ. 14 ต.ค. 2026, 17:00–18:00</div></div>
      <dl class="rows">
        <div><dt>17:00–18:00</dt><dd data-testid="price-hour-17" data-value="1200">฿1,200</dd></div>
        <div><dt>ค่าสนาม</dt><dd data-testid="price-field" data-value="1200">฿1,200</dd></div>
        <div class="zero"><dt>ส่วนลด</dt><dd data-testid="price-discount" data-value="0">฿0</dd></div>
        <div class="zero"><dt>ชั่วโมงฟรี</dt><dd data-testid="price-free-hour" data-value="0">฿0</dd></div>
        <div class="zero"><dt>ของเช่า</dt><dd data-testid="price-rental" data-value="0">฿0</dd></div>
        <div class="sum"><dt>ยอดรวม</dt><dd data-testid="price-total" data-value="1200">฿1,200</dd></div>
      </dl>
      <div class="perf"></div>
      <div class="stub">
        <div class="now"><span class="k">จ่ายตอนนี้ (มัดจำ 50%)</span><span class="v" data-testid="price-pay-now" data-value="600">฿600</span><span class="note">จ่ายพร้อมเพย์ภายใน 15 นาที</span></div>
        <div class="later"><span class="k">จ่ายหน้าสนาม</span><span class="v" data-testid="price-due-at-field" data-value="600">฿600</span><span class="note">วันที่มาเล่น</span></div>
      </div>
    </div>
    <div class="cta-area" style="margin-top:var(--s4)">
      <button class="btn block" type="submit" data-testid="book-submit">ยืนยันการจอง</button>
      <p class="after">กดแล้วจะไปหน้าจ่ายเงินพร้อมเพย์ ยังไม่มีการตัดเงิน ถ้าไม่จ่ายภายใน 15 นาที รอบนี้จะถูกปล่อยว่าง</p>
    </div>
  </aside>
</form>
<div class="paybar" aria-label="สรุปยอดที่ต้องจ่าย"><div><span class="k">จ่ายตอนนี้</span><span class="v">฿600</span></div><a class="btn small" href="#price-panel">ดูสรุปและยืนยัน</a></div>
</div>`;

export function build() {
  const body = `
${header("ตารางว่าง")}
<main><div class="container">
  <a class="crumb" href="#">กลับไปตารางว่าง</a>
  <h1>จองสนาม</h1>
  ${step2}
  ${step3}
</div></main>
<footer class="site"><div class="container">© 2026 ลูกหนัง อารีน่า</div></footer>
`;
  const script = `
const h0 = (location.hash.slice(1) || "3"); const h = h0 === "3full" ? "3" : h0;
if (h0 === "3full") document.querySelector(".paybar").style.display = "none";
document.getElementById("s2").hidden = h !== "2";
document.getElementById("s3").hidden = h === "2";
document.querySelector("h1").textContent = h === "2" ? "ตารางสนามว่าง" : "จองสนาม";
document.querySelector(".crumb").hidden = h === "2";
`;
  return { "c-booking-stepper.html": page("c · ขั้นตอนจอง (ร่าง)", css, body, script) };
}
