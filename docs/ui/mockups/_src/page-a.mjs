import { page, header, icoCheck, icoChat, miniPitch, icoBot } from "./lib.mjs";

const css = `
.hero { background: var(--night); color: var(--on-night); position: relative; overflow: hidden; }
.hero .lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.hero-in { position: relative; display: grid; gap: var(--s6); padding-top: var(--s6); padding-bottom: var(--s7); }
.hero h1 { color: #fff; font-size: 30px; line-height: 1.25; margin-bottom: var(--s3); }
.hero .lead { color: var(--on-night-2); font-size: var(--t-lg); max-width: 34em; margin-bottom: var(--s5); }
.cta { display: flex; flex-wrap: wrap; gap: var(--s3); }
.facts { list-style: none; margin: var(--s5) 0 0; padding: 0; display: grid; gap: var(--s2); color: var(--on-night); font-size: var(--t-md); }
.facts li { display: flex; gap: var(--s2); align-items: center; }
.facts svg { color: var(--flood); flex: none; }
.today { background: var(--paper); color: var(--ink); border-radius: var(--r-lg); padding: var(--s4) var(--s4) var(--s3); }
.today h2 { font-size: var(--t-xl); margin-bottom: 2px; }
.today .sub { color: var(--ink-2); font-size: var(--t-sm); margin-bottom: var(--s3); }
.trow { display: grid; grid-template-columns: 92px 1fr; gap: var(--s3); padding: var(--s3) 0; border-top: 1px solid var(--line); align-items: start; }
.trow b { font: 600 var(--t-md)/1.3 var(--font-head); color: var(--night); display: block; }
.trow span.m { font-size: var(--t-sm); color: var(--ink-2); }
.hrs { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.hrs a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 var(--s3); border-radius: var(--r-sm); border: 1.5px solid #9cc7ad; background: var(--turf-tint); color: var(--night); font-weight: 600; text-decoration: none; font-variant-numeric: tabular-nums; }
.hrs a.eve { background: var(--flood-tint); border-color: #d9b52c; }
.hrs .more { color: var(--turf-dark); background: transparent; border-color: transparent; text-decoration: underline; }
.today .foot { border-top: 1px solid var(--line); padding-top: var(--s3); margin-top: 0; font-size: var(--t-sm); color: var(--ink-2); display: flex; gap: var(--s3); flex-wrap: wrap; }
.foot i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid #9cc7ad; background: var(--turf-tint); vertical-align: -1px; margin-right: 5px; }
.foot i.eve { background: var(--flood-tint); border-color: #d9b52c; }
section.block { padding: var(--s7) 0 0; }
section.block > .container > h2 { margin-bottom: var(--s4); }
.fields { display: grid; gap: var(--s4); }
.fcard { align-content: start; background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--s4); display: grid; gap: var(--s3); grid-template-columns: auto 1fr; align-items: center; }
.fcard .head { display: contents; }
.fcard h3 { margin: 0; font-size: var(--t-xl); }
.fcard .chips { display: flex; gap: var(--s2); flex-wrap: wrap; margin-top: 4px; }
.fcard dl { grid-column: 1 / -1; margin: 0; display: grid; gap: var(--s2); }
.fcard dl div { display: flex; justify-content: space-between; gap: var(--s3); border-top: 1px solid var(--line); padding-top: var(--s2); align-items: baseline; }
.fcard dt { color: var(--ink-2); font-size: var(--t-sm); }
.fcard dd { margin: 0; font: 600 var(--t-lg)/1.2 var(--font-head); color: var(--night); }
.fcard dd small { display: block; text-align: right; font: 400 var(--t-sm)/1.3 var(--font-body); color: var(--ink-2); }
.fcard dt b { display: block; font: 600 var(--t-md)/1.3 var(--font-body); color: var(--night); }
.fcard .eve-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--flood); border: 1.5px solid #b08c00; margin-right: 6px; }
.fcard .next { grid-column: 1 / -1; margin: 0; font-size: var(--t-sm); color: var(--amber-ink); background: var(--flood-tint); border-radius: var(--r-sm); padding: 6px var(--s3); }
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s4); counter-reset: s; }
.steps li { align-content: start; display: grid; grid-template-columns: 40px 1fr; gap: var(--s3); align-items: start; }
.steps .n { width: 40px; height: 40px; border-radius: 50%; background: var(--night); color: var(--flood); display: grid; place-items: center; font: 600 var(--t-lg)/1 var(--font-head); }
.steps b { display: block; font: 600 var(--t-lg)/1.3 var(--font-head); color: var(--night); }
.steps span { color: var(--ink-2); }
.cta-band { margin-top: var(--s7); background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--s5); display: grid; gap: var(--s3); }
footer.site { margin-top: var(--s8); background: var(--night); color: var(--on-night-2); padding: var(--s5) 0 88px; font-size: var(--t-sm); }
footer.site .container { display: flex; justify-content: space-between; gap: var(--s4); flex-wrap: wrap; }
footer.site a { color: var(--flood); }
.chat-fab { position: fixed; right: 16px; bottom: 16px; z-index: 20; display: inline-flex; align-items: center; gap: var(--s2); min-height: 56px; padding: 0 var(--s5) 0 var(--s3); border-radius: var(--r-pill); border: 2px solid var(--flood); background: var(--night); color: #fff; font: 600 var(--t-md)/1 var(--font-body); box-shadow: var(--lift); }

@media (min-width: 768px) {
  .hero h1 { font-size: var(--t-3xl); }
  .fields { grid-template-columns: repeat(3, 1fr); }
  .fcard { grid-template-columns: 1fr; align-items: start; }
  .fcard .head { display: flex; gap: var(--s3); align-items: center; }
  .steps { grid-template-columns: repeat(4, 1fr); }
  .steps li { grid-template-columns: 1fr; }
  .cta-band { grid-template-columns: 1fr auto; align-items: center; }
}
@media (min-width: 1000px) {
  .hero-in { grid-template-columns: 1.05fr 0.95fr; align-items: center; padding-top: var(--s8); padding-bottom: var(--s8); gap: var(--s7); }
}
`;

const field = (id, label, size, cov, day, eve, next) => `
<article class="fcard" data-testid="home-field-${id}">
  <div class="head">${miniPitch(88, cov)}
  <div><h3>${label}</h3><div class="chips"><span class="tag plain">${size} คน</span><span class="tag plain">${cov ? "มีหลังคา" : "กลางแจ้ง"}</span></div></div></div>
  <dl>
    <div><dt><b>ก่อน 17:00</b>วันจันทร์–ศุกร์</dt><dd>${day} <small>ต่อชั่วโมง</small></dd></div>
    <div><dt><b><span class="eve-dot"></span>ตั้งแต่ 17:00 (เปิดไฟสนาม)</b>เสาร์–อาทิตย์และวันหยุดทั้งวัน</dt><dd>${eve} <small>ต่อชั่วโมง</small></dd></div>
  </dl>
  ${next ? `<p class="next" data-testid="home-field-${id}-next-rate">ตั้งแต่ 1 พ.ย. 2026 ราคาเย็นเป็น ${next}</p>` : ""}
</article>`;

const hr = (t, eve) => `<li><a href="#"${eve ? ' class="eve"' : ""}>${t}</a></li>`;

export function build() {
  const lines = `<svg class="lines" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#1e5a46" stroke-width="3"><path d="M600 0v520"/><circle cx="600" cy="260" r="120"/><rect x="-6" y="150" width="190" height="220"/><rect x="1016" y="150" width="190" height="220"/></g></svg>`;
  const body = `
${header("หน้าแรก")}
<main>
<section class="hero on-night">
  ${lines}
  <div class="container hero-in">
    <div>
      <h1 data-testid="home-title">จองสนามบอลหญ้าเทียม<br>ไม่ต้องสมัครสมาชิก</h1>
      <p class="lead">เลือกรอบที่ว่าง กรอกชื่อกับเบอร์โทร จ่ายมัดจำ 50% ผ่านพร้อมเพย์ แล้วรับรหัสจองทันที เปิดทุกวัน 08:00–24:00</p>
      <div class="cta">
        <a class="btn flood" href="#" data-testid="cta-today">ดูรอบว่างวันนี้</a>
        <a class="btn ghost on-night" href="#" data-testid="cta-my">ดูการจองของฉัน</a>
      </div>
      <ul class="facts">
        <li>${icoCheck}จองล่วงหน้าได้ 14 วัน</li>
        <li>${icoCheck}มัดจำ 50% ที่เหลือจ่ายหน้าสนาม</li>
        <li>${icoCheck}เล่นครบ 10 ชั่วโมง ฟรี 1 ชั่วโมง</li>
      </ul>
    </div>
    <section class="today" aria-labelledby="tp">
      <h2 id="tp">รอบว่างวันนี้</h2>
      <p class="sub">วันศุกร์ที่ 9 ต.ค. 2026 แตะเวลาเพื่อจองรอบนั้นได้เลย</p>
      <div class="trow"><div><b>สนาม A</b><span class="m">5 คน, กลางแจ้ง</span></div><ul class="hrs">${["11:00", "12:00", "13:00", "14:00", "15:00"].map((t) => hr(t)).join("")}${hr("17:00", 1)}${hr("18:00", 1)}<li><a class="more" href="#">ดูทั้งหมด</a></li></ul></div>
      <div class="trow"><div><b>สนาม B</b><span class="m">5 คน, กลางแจ้ง</span></div><ul class="hrs">${["11:00", "12:00", "13:00", "14:00", "15:00"].map((t) => hr(t)).join("")}${hr("17:00", 1)}${hr("18:00", 1)}<li><a class="more" href="#">ดูทั้งหมด</a></li></ul></div>
      <div class="trow"><div><b>สนาม C</b><span class="m">7 คน, มีหลังคา</span></div><ul class="hrs">${["11:00", "12:00", "13:00", "14:00", "15:00"].map((t) => hr(t)).join("")}${hr("17:00", 1)}${hr("18:00", 1)}<li><a class="more" href="#">ดูทั้งหมด</a></li></ul></div>
      <div class="foot"><span><i></i>ก่อน 17:00</span><span><i class="eve"></i>ตั้งแต่ 17:00 (เปิดไฟสนาม)</span></div>
    </section>
  </div>
</section>

<section class="block"><div class="container">
  <h2>สนามของเรา</h2>
  <div class="fields">
    ${field("A", "สนาม A", 5, false, "฿800", "฿1,200", "฿1,300")}
    ${field("B", "สนาม B", 5, false, "฿800", "฿1,200", "฿1,300")}
    ${field("C", "สนาม C", 7, true, "฿1,200", "฿1,800", "")}
  </div>
</div></section>

<section class="block"><div class="container">
  <h2>จองใน 4 ขั้น</h2>
  <ol class="steps">
    <li><span class="n">1</span><div><b>เลือกวันและสนาม</b><span>ดูตารางว่างของทั้ง 3 สนามพร้อมกัน</span></div></li>
    <li><span class="n">2</span><div><b>เลือกรอบ</b><span>แตะช่องว่างเพื่อเลือกเวลาเริ่ม</span></div></li>
    <li><span class="n">3</span><div><b>กรอกชื่อและเบอร์โทร</b><span>ไม่ต้องสมัครสมาชิก ติ๊กยินยอม PDPA</span></div></li>
    <li><span class="n">4</span><div><b>จ่ายมัดจำพร้อมเพย์</b><span>สแกนจ่ายภายใน 15 นาที รับรหัสจองทันที</span></div></li>
  </ol>
  <div class="cta-band">
    <div><h3 style="margin-bottom:4px">ไม่แน่ใจเรื่องราคาหรือรอบว่าง</h3><p class="muted" style="margin:0">ถามน้องบอลได้ น้องบอลเป็นบอทผู้ช่วย ตอบราคา รอบว่าง และจองสนามพื้นฐานให้ได้</p></div>
  </div>
</div></section>
</main>
<footer class="site"><div class="container"><span>© 2026 ลูกหนัง อารีน่า, เปิด 08:00–24:00 ทุกวัน</span><a href="#">เอกสารโครงการ</a></div></footer>
<button class="chat-fab" type="button" data-testid="chat-open" aria-expanded="false">${icoBot(36)}<span>แชทกับน้องบอล</span></button>
`;
  return { "a-home.html": page("a · หน้าแรก (ร่าง)", css, body) };
}
