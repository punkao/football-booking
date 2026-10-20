// CR-03 (CHANGE-REQUESTS/CR-03.md · docs/impact/CR-03.md) — กฎล้วนของรายงานแยกช่องทางเงิน + ชั่วโมงใช้สนาม (node --test) · เขียนก่อนแก้โค้ด
// ค่าที่คาดหวัง: [D:CR-03] = CHANGE-REQUESTS/answers/README.md หัวข้อ CR-03 · [D A-41/A-42] = docs/01-INTERVIEW.md
import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "./index.ts";
import { summarizeMoney } from "./index.ts";

// ฟังก์ชันใหม่ของ CR-03 (ยังไม่มีบนโค้ดเดิม → เรียกผ่าน namespace เพื่อให้ล้มด้วยเหตุ "ยังไม่มีกฎ" ไม่ใช่ import พัง)
type MoneyRow = { day: string; amount: number; method: string };
type Split = { days: { date: string; bookingPromptpay: number; bookingCash: number }[]; bookingPromptpay: number; bookingCash: number };
const splitBookingMoney = (from: string, to: string, p: MoneyRow[]): Split =>
  (rules as unknown as { splitBookingMoney: (f: string, t: string, p: MoneyRow[]) => Split }).splitBookingMoney(from, to, p);
type Booking = { date: string; fieldId: string; hours: number; status: string };
type Use = { fields: { fieldId: string; hours: number; percent: number }[]; days: { date: string; fieldHours: Record<string, number> }[] };
const fieldUse = (ids: string[], from: string, to: string, b: Booking[]): Use =>
  (rules as unknown as { fieldUse: (i: string[], f: string, t: string, b: Booking[]) => Use }).fieldUse(ids, from, to, b);

// seed ช่วง 3–9 ต.ค. [E TEST-DATA 5.4 · ตรงตัวอย่างร้าน [D:CR-03]]
const SEED_PAY: MoneyRow[] = [
  { day: "2026-10-03", amount: 600, method: "PROMPTPAY" },
  { day: "2026-10-05", amount: 600, method: "PROMPTPAY" },
  { day: "2026-10-06", amount: 600, method: "PROMPTPAY" },
  { day: "2026-10-06", amount: 600, method: "CASH_AT_FIELD" },
  { day: "2026-10-08", amount: 600, method: "PROMPTPAY" },
  { day: "2026-10-08", amount: 2400, method: "PROMPTPAY" },
  { day: "2026-10-08", amount: 1800, method: "PROMPTPAY" },
];

test("CR-03 (1) แยกพร้อมเพย์ / เก็บหน้าสนาม ตามวันรับเงิน · 3–9 ต.ค. = ฿6,600 / ฿600 [D:CR-03]", () => {
  const r = splitBookingMoney("2026-10-03", "2026-10-09", SEED_PAY);
  assert.equal(r.bookingPromptpay, 6600);
  assert.equal(r.bookingCash, 600);
  assert.equal(r.days.length, 7);
  const d6 = r.days.find((d) => d.date === "2026-10-06");
  assert.deepEqual([d6?.bookingPromptpay, d6?.bookingCash], [600, 600]);
});

test("CR-03 (1) สองช่องรวมกัน = ยอดจองเดิม (summarizeMoney) · เครดิตไม่นับทั้งสองช่อง · แถวนอกช่วงไม่นับ [D:CR-03]", () => {
  const rows: MoneyRow[] = [...SEED_PAY, { day: "2026-10-07", amount: 500, method: "CREDIT" }, { day: "2026-10-02", amount: 2400, method: "PROMPTPAY" }];
  const old = summarizeMoney("2026-10-03", "2026-10-09", rows, []);
  const split = splitBookingMoney("2026-10-03", "2026-10-09", rows);
  assert.equal(split.bookingPromptpay + split.bookingCash, old.bookingMoney);
  assert.equal(split.bookingPromptpay, 6600);
  for (const d of split.days) assert.equal(d.bookingPromptpay + d.bookingCash, old.days.find((x) => x.date === d.date)?.bookingMoney);
});

// การจอง seed 3–9 ต.ค.: LN-900005 A 3 ต.ค. 2 ชม. CHECKED_IN · 900003 B 4 ต.ค. 1 ชม. NO_SHOW · 900006 B 6 ต.ค. 1 ชม. CHECKED_IN
//                       900008 A 7 ต.ค. 1 ชม. NO_SHOW · 900001 A 9 ต.ค. 2 ชม. CONFIRMED
const SEED_BK: Booking[] = [
  { date: "2026-10-03", fieldId: "A", hours: 2, status: "CHECKED_IN" },
  { date: "2026-10-04", fieldId: "B", hours: 1, status: "NO_SHOW" },
  { date: "2026-10-06", fieldId: "B", hours: 1, status: "CHECKED_IN" },
  { date: "2026-10-07", fieldId: "A", hours: 1, status: "NO_SHOW" },
  { date: "2026-10-09", fieldId: "A", hours: 2, status: "CONFIRMED" },
];

test("CR-03 (2) ชั่วโมงใช้สนามต่อสนาม · % = ชั่วโมง ÷ (16 × วัน) ปัด 1 ตำแหน่ง · 3–9 ต.ค.: A 5 ชม. 4.5% · B 2 ชม. 1.8% · C 0 [D:CR-03]", () => {
  const r = fieldUse(["A", "B", "C"], "2026-10-03", "2026-10-09", SEED_BK);
  assert.deepEqual(r.fields, [
    { fieldId: "A", hours: 5, percent: 4.5 }, // 5 ÷ 112 = 4.464…
    { fieldId: "B", hours: 2, percent: 1.8 }, // 2 ÷ 112 = 1.785…
    { fieldId: "C", hours: 0, percent: 0 },
  ]);
  assert.equal(r.days.find((d) => d.date === "2026-10-03")?.fieldHours.A, 2);
  assert.equal(r.days.length, 7);
});

test("CR-03 (2) นับเฉพาะ จ่ายแล้ว (CONFIRMED) · เช็กอินแล้ว · ไม่มา — รอจ่าย / ยกเลิก / หมดเวลา / ปิดฝน ไม่นับ [D:CR-03]", () => {
  const mk = (status: string): Booking => ({ date: "2026-10-12", fieldId: "A", hours: 1, status });
  const r = fieldUse(["A", "B", "C"], "2026-10-12", "2026-10-12", ["CONFIRMED", "CHECKED_IN", "NO_SHOW", "PENDING_PAYMENT", "CANCELLED", "EXPIRED", "RAIN_CLOSED"].map(mk));
  assert.equal(r.fields[0].hours, 3);
  assert.equal(r.fields[0].percent, 18.8); // 3 ÷ 16 = 18.75 → 18.8
});

test("CR-03 (2) ฐาน % = 16 × จำนวนวันในช่วง (วันเดียว = 16 ชม.) · การจองนอกช่วงไม่นับ [D:CR-03]", () => {
  const bk: Booking[] = [{ date: "2026-10-08", fieldId: "C", hours: 4, status: "CONFIRMED" }, { date: "2026-10-09", fieldId: "C", hours: 8, status: "CONFIRMED" }];
  const one = fieldUse(["A", "B", "C"], "2026-10-08", "2026-10-08", bk);
  assert.deepEqual(one.fields[2], { fieldId: "C", hours: 4, percent: 25 });
  const two = fieldUse(["A", "B", "C"], "2026-10-08", "2026-10-09", bk);
  assert.deepEqual(two.fields[2], { fieldId: "C", hours: 12, percent: 37.5 }); // 12 ÷ 32
});
