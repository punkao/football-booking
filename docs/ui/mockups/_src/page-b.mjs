import { page, header, icoCheck, icoX, icoBot, miniPitch } from "./lib.mjs";

const css = `
body { overflow-x: hidden; }
.behind { padding: var(--s6) 0 var(--s8); }
.behind h1 { font-size: var(--t-2xl); }
.behind .grid { display: grid; gap: var(--s4); margin-top: var(--s4); }
.behind .mini { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--s4); display: flex; gap: var(--s3); align-items: center; }
.behind .mini b { font: 600 var(--t-lg)/1.3 var(--font-head); color: var(--night); display: block; }
.chat-dock { position: fixed; z-index: 50; inset: 0; background: var(--paper); display: flex; flex-direction: column; }
.chat-head { display: flex; align-items: center; gap: var(--s3); background: var(--night); color: var(--on-night); padding: var(--s3) var(--s3) var(--s3) var(--s4); }
.chat-head h2 { color: #fff; margin: 0; font-size: var(--t-lg); line-height: 1.2; }
.chat-head p { margin: 0; font-size: var(--t-sm); color: var(--on-night-2); }
.chat-head .grow { flex: 1; }
.chat-head .botflag { margin-left: 0; display: inline-flex; align-items: center; gap: 6px; font-size: var(--t-sm); font-weight: 600; color: var(--night); background: var(--flood); border-radius: var(--r-pill); padding: 2px 10px; vertical-align: 2px; }
.x-btn { width: 44px; height: 44px; border-radius: var(--r-sm); border: 1.5px solid var(--on-night-2); background: transparent; color: var(--on-night); display: grid; place-items: center; }
.chat-log { flex: 1; overflow-y: auto; padding: var(--s4); background: var(--mist); display: flex; flex-direction: column; gap: var(--s3); }
.msg { max-width: 92%; padding: var(--s3) var(--s4); border-radius: 16px; font-size: var(--t-md); line-height: 1.55; }
.msg.bot { align-self: flex-start; background: var(--paper); border: 1px solid var(--line); border-bottom-left-radius: 4px; color: var(--ink); }
.msg.user { align-self: flex-end; background: var(--turf); color: #fff; border-bottom-right-radius: 4px; }
.who { font-size: var(--t-sm); color: var(--ink-2); margin: 0 0 2px var(--s1); }
.caps { display: grid; gap: var(--s3); margin-top: var(--s3); border-top: 1px solid var(--line); padding-top: var(--s3); }
.caps h3 { font: 600 var(--t-md)/1.3 var(--font-body); margin: 0 0 var(--s1); color: var(--night); }
.caps ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; font-size: var(--t-sm); }
.caps li { display: flex; gap: var(--s2); align-items: flex-start; }
.caps li svg { flex: none; margin-top: 4px; }
.caps .yes svg { color: var(--turf-dark); } .caps .no svg { color: var(--alert); }
.chips { display: flex; flex-wrap: wrap; gap: var(--s2); }
.chip { display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--s4); border-radius: var(--r-pill); border: 1.5px solid var(--edge); background: var(--paper); color: var(--night); font: 600 var(--t-sm)/1.2 var(--font-body); }
.chip.primary { border-color: var(--turf); color: var(--turf-dark); }
.quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s2); width: 100%; margin-top: var(--s3); }
.quick-grid .chip { text-align: left; border-radius: var(--r-sm); min-height: 56px; justify-content: flex-start; padding: 0 var(--s3); font-size: var(--t-md); }
.quick-grid .chip small { display: block; font: 400 var(--t-xs)/1.2 var(--font-body); color: var(--ink-2); }
.chat-foot { border-top: 1px solid var(--line); background: var(--paper); padding: var(--s3) var(--s4) var(--s3); display: grid; gap: var(--s2); }
.rail { display: flex; gap: var(--s2); overflow-x: auto; padding-bottom: 2px; }
.rail .chip { flex: none; min-height: 40px; padding: 0 14px; }
.chat-foot form { display: flex; gap: var(--s2); }
.chat-foot input { flex: 1; }
.chat-note { font-size: var(--t-sm); color: var(--ink-2); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 var(--s3); }
.chat-log .ticket { align-self: stretch; max-width: 100%; }
.avail { display: inline-flex; margin-top: 2px; }
body[data-state="welcome"] .only-chat, body[data-state="chat"] .only-welcome { display: none !important; }
details.caps-d { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); }
details.caps-d summary { min-height: 44px; display: flex; align-items: center; padding: 0 var(--s4); font-weight: 600; color: var(--night); cursor: pointer; }
details.caps-d .caps { margin: 0; padding: 0 var(--s4) var(--s3); border: 0; }
.chat-fab { position: fixed; right: 16px; bottom: 16px; z-index: 20; display: inline-flex; align-items: center; gap: var(--s2); min-height: 56px; padding: 0 var(--s5) 0 var(--s3); border-radius: var(--r-pill); border: 2px solid var(--flood); background: var(--night); color: #fff; font: 600 var(--t-md)/1 var(--font-body); box-shadow: var(--lift); }
@media (min-width: 768px) {
  .behind .grid { grid-template-columns: repeat(3, 1fr); }
}
/* >= 1100px: แผงติดขวาสูงเต็มจอใต้หัวเว็บ, เนื้อหาถอยซ้ายไม่ถูกบัง */
@media (min-width: 1100px) {
  .chat-dock { inset: var(--hh) 0 0 auto; width: 400px; border-left: 1.5px solid var(--night); }
  .page-wrap { margin-right: 400px; }
  .chat-head { border-radius: 0; }
}
/* 768-1099px: แผงลอยขวา 380px ทับเนื้อหา (ปิดได้) */
@media (min-width: 768px) and (max-width: 1099px) {
  .chat-dock { inset: var(--hh) 0 0 auto; width: 380px; box-shadow: var(--lift); }
}
/* < 768px: เต็มจอ ไม่มีหัวเว็บ ปุ่มปิดชัด */
@media (max-width: 767px) {
  .chat-fab { display: none; }
}
`;

const priceCard = `
<div class="ticket mini" data-testid="chat-card-quote" data-ok="true">
  <div class="ticket-head">
    <div class="where">สนาม A</div>
    <div class="when">ส. 10 ต.ค. 2026, 17:00–19:00 (2 ชั่วโมง)</div>
    <span class="tag avail">รอบนี้ว่าง</span>
  </div>
  <dl class="rows"><div class="sum"><dt>ราคารวม</dt><dd data-testid="chat-quote-total">฿2,400</dd></div></dl>
  <div class="perf"></div>
  <div class="stub">
    <div class="now"><span class="k">จ่ายตอนนี้ (มัดจำ 50%)</span><span class="v" data-testid="chat-quote-pay-now">฿1,200</span></div>
    <div class="later"><span class="k">จ่ายหน้าสนาม</span><span class="v">฿1,200</span></div>
  </div>
</div>`;

const dock = `
<aside class="chat-dock" data-testid="chat-panel" aria-label="น้องบอล ผู้ช่วยจองสนาม (บอท)">
  <div class="chat-head">
    ${icoBot(40)}
    <div class="grow"><div style="display:flex;align-items:center;gap:8px"><h2>น้องบอล</h2><span class="botflag">บอท</span></div><p>ผู้ช่วยจองสนาม ตอบเร็ว ไม่ใช่เจ้าหน้าที่</p></div>
    <button class="x-btn" data-testid="chat-close" aria-label="ปิดแชท"><svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
  </div>
  <div class="chat-log" role="log" aria-live="polite" data-testid="chat-log">
    <details class="caps-d only-chat">
      <summary>น้องบอลทำอะไรได้บ้าง</summary>
      <div class="caps">
        <div class="yes"><h3>ทำได้</h3><ul><li>${icoCheck}บอกราคาและโปรโมชันชั่วโมงฟรี</li><li>${icoCheck}ตรวจรอบว่างตามวันและเวลา</li><li>${icoCheck}จองสนามพื้นฐาน (ไม่รวมของเช่าและเครดิต)</li></ul></div>
        <div class="no"><h3>ทำไม่ได้</h3><ul><li>${icoX}ยกเลิกหรือเลื่อนการจอง</li><li>${icoX}คืนเงินหรือลดราคา</li><li>${icoX}ใช้เครดิตหรือจองประจำ ต้องทำที่หน้าเว็บ</li></ul></div>
      </div>
    </details>

    <div class="msg bot only-welcome" data-testid="chat-welcome">
      <p class="who" style="margin-bottom:4px">น้องบอล, บอทผู้ช่วย</p>
      สวัสดีครับ ผมเป็นบอท ไม่ใช่เจ้าหน้าที่ ถามเรื่องราคาและรอบว่าง หรือให้ช่วยจองสนามได้ครับ
      <div class="caps">
        <div class="yes"><h3>น้องบอลทำได้</h3><ul><li>${icoCheck}บอกราคาและเวลาเปิด</li><li>${icoCheck}ตรวจรอบว่างตามวันและเวลา</li><li>${icoCheck}จองสนามพื้นฐาน</li></ul></div>
        <div class="no"><h3>น้องบอลทำไม่ได้</h3><ul><li>${icoX}ยกเลิกหรือเลื่อนการจอง (ทำเองที่หน้าการจองของฉัน)</li><li>${icoX}คืนเงิน ลดราคา</li></ul></div>
      </div>
    </div>
    <div class="only-welcome">
      <p class="who">เลือกคำถามด่วน หรือพิมพ์ถามได้เลย</p>
      <div class="quick-grid">
        <button class="chip"><span>ราคา<small>ราคาแต่ละสนาม</small></span></button>
        <button class="chip"><span>รอบว่างวันนี้<small>ดูเวลาที่ยังจองได้</small></span></button>
        <button class="chip"><span>จองสนาม<small>ให้น้องบอลช่วยจอง</small></span></button>
        <button class="chip"><span>เวลาเปิด<small>เปิด-ปิดกี่โมง</small></span></button>
      </div>
    </div>

    <div class="msg user only-chat" data-testid="chat-msg-user">ราคาสนาม A เสาร์นี้ 17:00 สองชั่วโมง</div>
    <div class="msg bot only-chat" data-testid="chat-msg-bot">ขอคิดราคาให้นะครับ ราคานี้เป็นอัตราเย็นเพราะเป็นวันเสาร์ครับ</div>
    <div class="only-chat" style="display:contents">${priceCard}</div>
    <div class="chips only-chat"><button class="chip primary">จองรอบนี้</button><button class="chip">ดูสนาม B ช่วงเดียวกัน</button></div>
  </div>
  <div class="chat-foot">
    <div class="rail only-chat" aria-label="คำถามด่วน"><button class="chip">ราคา</button><button class="chip">รอบว่างวันนี้</button><button class="chip">จองสนาม</button><button class="chip">เวลาเปิด</button></div>
    <form onsubmit="return false"><label class="sr-only" for="ci">พิมพ์ข้อความถึงน้องบอล</label><input id="ci" data-testid="chat-input" type="text" placeholder="ถามรอบว่าง ราคา หรือจองสนาม" autocomplete="off"><button class="btn" type="submit" data-testid="chat-send" disabled>ส่ง</button></form>
    <div class="chat-note" data-testid="chat-count"><span>0/500</span><span>บอทนี้ยกเลิกหรือเลื่อนการจองไม่ได้</span></div>
  </div>
</aside>`;

export function build() {
  const body = `
${header("ตารางว่าง")}
<div class="page-wrap"><main class="behind"><div class="container">
  <h1>สนามของเรา</h1>
  <p class="muted">เนื้อหาหน้าเว็บถอยไปทางซ้ายเมื่อเปิดแชท ไม่ถูกแผงแชทบัง</p>
  <div class="grid">
    <div class="mini">${miniPitch(72)}<div><b>สนาม A</b><span class="muted small">5 คน, กลางแจ้ง</span></div></div>
    <div class="mini">${miniPitch(72)}<div><b>สนาม B</b><span class="muted small">5 คน, กลางแจ้ง</span></div></div>
    <div class="mini">${miniPitch(72, true)}<div><b>สนาม C</b><span class="muted small">7 คน, มีหลังคา</span></div></div>
  </div>
</div></main></div>
${dock}
`;
  const script = `
const h = location.hash.slice(1) || "chat";
document.body.dataset.state = h === "welcome" ? "welcome" : "chat";
`;
  return { "b-chat.html": page("b · แชทน้องบอล (ร่าง)", css, body, script) };
}
