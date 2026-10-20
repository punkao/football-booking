#!/usr/bin/env node
// Golden master ของ POST /api/quote (บท 05 LAB 4 · บท 06 LAB 5) — ล็อก "ระบบทำอะไรอยู่" ไม่ใช่ตัดสินว่าถูก
//   node tests/golden/quote-golden.mjs            → เทียบกับ quote.golden.json · ต่าง = exit 1
//   node tests/golden/quote-golden.mjs --update   → เขียนใหม่ (อ่านก่อนว่าอะไรเปลี่ยน ไม่งั้นอบพฤติกรรมใหม่ลง golden)
//   BASE_URL=http://localhost:3000 (ค่าเริ่ม)
//
// ก่อนยิง: POST /api/test/reset {} → seed + "ตอนนี้" ศ 9 ต.ค. 2569 10:00 · ทำงานแบบลำดับ (ไม่ขนาน) · ยิงเสร็จ reset อีกครั้ง
// กริด (ค่าที่กำหนดตายตัว ไม่สุ่ม):
//   ① ไม่ล็อกอิน: สนาม A/B/C × วัน 6 วัน (จ 12 · อ 13 วันหยุด · ศ 16 · ส 17 · อา 18 · ศ 23 วันหยุดและวันสุดท้ายของ 14 วัน)
//      × เริ่ม 15/16/17/18 × 1–3 ชม. = 216 + วันเลยกรอบ ส 24 × 3 สนาม = 3
//   ② สมาชิกมีเครดิต (ต้น ฿1,200) useCredit: สนาม A/C × จ 12 / ศ 16 / ส 17 × เริ่ม 16/17 × 2 ชม. = 12
//   ③ สมาชิกมีชั่วโมงฟรี (มิว 10 ชม.) useFreeHour: สนาม A/B × จ 12 / อ 13 / ศ 16 × เริ่ม 15/16/17 × 1 ชม. = 18
//   ④ ของเช่า (ไม่ล็อกอิน): สนาม B × จ 12 / ส 17 × เริ่ม 16/17 × [BIB 2 · BIB 6 + BALL 1 · BIB 7] = 12
//   แผนจ่าย (DEPOSIT_50 / FULL_100) ไม่ใช่ค่าที่ส่งเข้า API — ระบบเลือกจากวัน+ชั่วโมง กริดนี้ครอบทั้ง 2 แบบ (ศ/ส ≥ 17:00 = FULL_100)
//
// การทำให้นิ่ง (normalize):
//   - เก็บเฉพาะ HTTP status + content-type + body · ตัด header อื่นทั้งหมด (date · set-cookie · etag) เพราะเปลี่ยนตามนาฬิกาจริง/ลายเซ็น cookie
//   - body ของ /api/quote ไม่มีฟิลด์ที่เปลี่ยนเอง (ไม่มี id ที่รัน ไม่มีเวลาสร้าง) — ยืนยันด้วยรัน 2 รอบติดได้ไฟล์เดียวกัน จึงไม่ตัดฟิลด์ใดใน body
//   - cookie ของการเข้าสู่ระบบไม่ถูกเก็บ (ใช้แค่ส่งต่อ)
//   - key เรียงตามตัวอักษรทุกชั้น (lib.canonical) → sha8 คงที่
import { call, login, reset, seedCredential, writeOrCompare } from "./lib.mjs";

const FIELDS = ["A", "B", "C"];
const DATES = ["2026-10-12", "2026-10-13", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-23"];
const STARTS = [15, 16, 17, 18];
const HOURS = [1, 2, 3];

function grid() {
  const cases = [];
  for (const f of FIELDS)
    for (const d of DATES)
      for (const s of STARTS)
        for (const h of HOURS) cases.push({ id: `anon/${f}/${d}/${s}/${h}`, who: "anon", req: { fieldId: f, date: d, startHour: s, hours: h } });
  for (const f of FIELDS) cases.push({ id: `anon/${f}/2026-10-24/16/1`, who: "anon", req: { fieldId: f, date: "2026-10-24", startHour: 16, hours: 1 } });
  for (const f of ["A", "C"])
    for (const d of ["2026-10-12", "2026-10-16", "2026-10-17"])
      for (const s of [16, 17]) cases.push({ id: `credit/${f}/${d}/${s}/2`, who: "ton", req: { fieldId: f, date: d, startHour: s, hours: 2, useCredit: true } });
  for (const f of ["A", "B"])
    for (const d of ["2026-10-12", "2026-10-13", "2026-10-16"])
      for (const s of [15, 16, 17]) cases.push({ id: `freehour/${f}/${d}/${s}/1`, who: "mew", req: { fieldId: f, date: d, startHour: s, hours: 1, useFreeHour: true } });
  const RENT = {
    bib2: [{ itemId: "BIB", qty: 2 }],
    bib6ball1: [{ itemId: "BIB", qty: 6 }, { itemId: "BALL", qty: 1 }],
    bib7: [{ itemId: "BIB", qty: 7 }],
  };
  for (const d of ["2026-10-12", "2026-10-17"])
    for (const s of [16, 17])
      for (const [k, rentals] of Object.entries(RENT))
        cases.push({ id: `rent/B/${d}/${s}/2/${k}`, who: "anon", req: { fieldId: "B", date: d, startHour: s, hours: 2, rentals } });
  return cases;
}

async function main() {
  await reset();
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
      label: "[E] ล็อกพฤติกรรมของระบบที่รับมอบ (v2-handover) ไม่ใช่ค่าที่ถูกตามร้าน",
      resetBody: {},
      count: out.length,
    },
    cases: out,
  };
  const ok200 = out.filter((c) => c.status === 200).length;
  console.log(`[golden] quote: ${out.length} เคส (200 = ${ok200} · error = ${out.length - ok200})`);
  process.exit(writeOrCompare("quote", doc));
}

main().catch((e) => {
  console.error(`[golden] ล้มก่อนเทียบ: ${e.message}`);
  process.exit(2);
});
