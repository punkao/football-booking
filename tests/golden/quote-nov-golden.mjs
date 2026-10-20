#!/usr/bin/env node
// Golden master ของ POST /api/quote "หลัง CR-05" — ล็อกราคาที่มีวันมีผล 1 พ.ย. 2569 (A/B เย็น ฿1,200 → ฿1,300)
//   node tests/golden/quote-nov-golden.mjs            → เทียบกับ quote-nov.golden.json · ต่าง = exit 1
//   node tests/golden/quote-nov-golden.mjs --update   → เขียนใหม่ (เฉพาะเมื่อมี CR เปลี่ยนราคาอีก และอ่าน diff แล้ว)
//   BASE_URL=http://localhost:3000 (ค่าเริ่ม)
//
// ต่างจาก quote.golden.json: ไฟล์นั้นล็อก "พฤติกรรมของระบบที่รับมอบ" ([E]) ที่วันล็อก 9 ต.ค. (วันที่ 12–23 ต.ค. ต้องไม่เปลี่ยนเลย = พิสูจน์ว่าราคาเดิมไม่ถูกแตะ)
// ไฟล์นี้ล็อกราคาที่ร้านสั่งใน CR-05 ([D:CR-05]) — กรอบจอง 14 วันจากวันล็อกไม่ถึง 1 พ.ย. จึงตั้งนาฬิกา ส 25 ต.ค. 10:00 ผ่าน POST /api/test/clock
// (หน้าต่างจองเลื่อนเป็น 25 ต.ค. – 8 พ.ย.) · ยิงเสร็จ reset {} กลับ
//
// กริด (กำหนดตายตัว ไม่สุ่ม):
//   ① ไม่ล็อกอิน: สนาม A/B/C × วัน [ส 31 ต.ค. (ก่อนวันมีผล) · อา 1 พ.ย. (วันมีผล) · อ 3 พ.ย. · ศ 6 พ.ย. · ส 7 พ.ย.] × เริ่ม 9/16/17/19 × 1–2 ชม. = 120
//   ② เลยกรอบ 14 วัน (อา 9 พ.ย.) × 3 สนาม = 3
//   ③ สมาชิกมีเครดิต (ต้น) useCredit: A/C × อ 3 พ.ย. / ส 7 พ.ย. × เริ่ม 17 × 2 ชม. = 4
//   ④ สมาชิกมีชั่วโมงฟรี (มิว) useFreeHour: A/B × อ 3 พ.ย. / ศ 6 พ.ย. × เริ่ม 16 × 1 ชม. = 4 · A อ 3 พ.ย. 17:00 (ใช้ชั่วโมงฟรีหลัง 17:00 → ปฏิเสธ) = 1
import { BASE_URL, call, login, reset, seedCredential, writeOrCompare } from "./lib.mjs";

const FIELDS = ["A", "B", "C"];
const DATES = ["2026-10-31", "2026-11-01", "2026-11-03", "2026-11-06", "2026-11-07"];
const STARTS = [9, 16, 17, 19];
const HOURS = [1, 2];
const NOW = "2026-10-25T10:00:00+07:00";

function grid() {
  const cases = [];
  for (const f of FIELDS)
    for (const d of DATES)
      for (const s of STARTS)
        for (const h of HOURS) cases.push({ id: `anon/${f}/${d}/${s}/${h}`, who: "anon", req: { fieldId: f, date: d, startHour: s, hours: h } });
  for (const f of FIELDS) cases.push({ id: `anon/${f}/2026-11-09/16/1`, who: "anon", req: { fieldId: f, date: "2026-11-09", startHour: 16, hours: 1 } });
  for (const f of ["A", "C"])
    for (const d of ["2026-11-03", "2026-11-07"]) cases.push({ id: `credit/${f}/${d}/17/2`, who: "ton", req: { fieldId: f, date: d, startHour: 17, hours: 2, useCredit: true } });
  for (const f of ["A", "B"])
    for (const d of ["2026-11-03", "2026-11-06"]) cases.push({ id: `freehour/${f}/${d}/16/1`, who: "mew", req: { fieldId: f, date: d, startHour: 16, hours: 1, useFreeHour: true } });
  cases.push({ id: "freehour/A/2026-11-03/17/1", who: "mew", req: { fieldId: "A", date: "2026-11-03", startHour: 17, hours: 1, useFreeHour: true } });
  return cases;
}

async function setClock(now) {
  const r = await fetch(`${BASE_URL}/api/test/clock`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ now }) });
  if (r.status !== 200) throw new Error(`ตั้งนาฬิกาไม่สำเร็จ HTTP ${r.status}`);
}

async function main() {
  await reset();
  await setClock(NOW);
  const cookies = {
    anon: undefined,
    ton: await login("/api/customers/login", { phone: seedCredential("ton").phone, password: seedCredential("ton").password }),
    mew: await login("/api/customers/login", { phone: seedCredential("mew").phone, password: seedCredential("mew").password }),
  };
  const out = [];
  for (const c of grid()) {
    const r = await call("POST", "/api/quote", { body: c.req, cookie: cookies[c.who] });
    out.push({ id: c.id, who: c.who, req: c.req, status: r.status, contentType: r.contentType, body: r.body });
  }
  await reset();
  const doc = {
    meta: {
      endpoint: "POST /api/quote",
      label: "[D:CR-05] ล็อกราคาหลัง CR-05 (A/B เย็น ฿1,300 ตั้งแต่ 1 พ.ย. 2569) ที่นาฬิกา ส 25 ต.ค. 2569 10:00 — ไม่ใช่ค่าของระบบที่รับมอบ",
      resetBody: {},
      clock: NOW,
      count: out.length,
    },
    cases: out,
  };
  const ok200 = out.filter((c) => c.status === 200).length;
  console.log(`[golden] quote-nov: ${out.length} เคส (200 = ${ok200} · error = ${out.length - ok200})`);
  process.exit(writeOrCompare("quote-nov", doc));
}

main().catch((e) => {
  console.error(`[golden] ล้มก่อนเทียบ: ${e.message}`);
  process.exit(2);
});
