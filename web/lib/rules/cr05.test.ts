// CR-05 (CHANGE-REQUESTS/CR-05.md · docs/impact/CR-05.md) — กฎล้วนของราคาที่มีวันมีผล (node --test) · เขียนก่อนแก้โค้ด
// ค่าที่คาดหวัง: [D:CR-05] = CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05 · [CR-05] = หนังสือ · [E rules.test.ts] = ของเดิมที่ต้องคงไว้
import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "./index.ts";
import { computePrice, discountAmount, fieldPriceFor, hourlyRate, paymentPlanFor } from "./index.ts";

// โครงข้อมูลใหม่ของ CR-05: ราคาฐาน + จุดเปลี่ยนราคา (วันมีผล) · ยังไม่มีบนโค้ดเดิม → ส่งผ่าน cast เพื่อให้ล้มด้วยเหตุ "ราคายังเป็น 1,200" ไม่ใช่ type พัง
type Step = { from: string; dayRate: number; eveningRate: number };
type Field = { dayRate: number; eveningRate: number; rateChanges?: Step[] };
const A: Field = { dayRate: 800, eveningRate: 1200, rateChanges: [{ from: "2026-11-01", dayRate: 800, eveningRate: 1300 }] };
const C: Field = { dayRate: 1200, eveningRate: 1800, rateChanges: [] };
const asRates = (f: Field) => f as unknown as Parameters<typeof hourlyRate>[0];
const price = (f: Field, date: string, start: number, hours: number, holidays: string[] = []) => fieldPriceFor(asRates(f), date, start, hours, holidays);
const rate = (f: Field, date: string, hour: number, holidays: string[] = []) => hourlyRate(asRates(f), date, hour, holidays);

type RatesOn = (f: Field, date: string) => { dayRate: number; eveningRate: number };
type Upcoming = (f: Field, today: string) => Step[];
const ratesOn: RatesOn = (f, d) => (rules as unknown as { ratesOn: RatesOn }).ratesOn(f, d);
const upcomingRates: Upcoming = (f, d) => (rules as unknown as { upcomingRates: Upcoming }).upcomingRates(f, d);

test("CR-05 ราคาเย็นสนาม A ตามวันเตะ: 31 ต.ค. = ฿1,200 · 1 พ.ย. เป็นต้นไป = ฿1,300 [D:CR-05]", () => {
  assert.equal(rate(A, "2026-10-31", 19), 1200, "ส 31 ต.ค. 19:00 (ก่อนวันมีผล)");
  assert.equal(rate(A, "2026-11-01", 19), 1300, "อา 1 พ.ย. 19:00 (วันมีผล)");
  assert.equal(rate(A, "2026-11-03", 19), 1300, "อ 3 พ.ย. 19:00");
  assert.equal(rate(A, "2026-12-15", 17), 1300, "อ 15 ธ.ค. 17:00");
});

test("CR-05 เสาร์ อาทิตย์ วันหยุด หลัง 1 พ.ย. = ฿1,300 ทั้งวัน (กฎเดิม BR-08) [D:CR-05] [CR-05]", () => {
  assert.equal(rate(A, "2026-11-01", 9), 1300, "อา 1 พ.ย. 09:00");
  assert.equal(rate(A, "2026-11-07", 9), 1300, "ส 7 พ.ย. 09:00");
  assert.equal(rate(A, "2026-12-07", 9, ["2026-12-07"]), 1300, "วันหยุด จ 7 ธ.ค. 09:00");
  assert.equal(rate(A, "2026-10-31", 9), 1200, "ส 31 ต.ค. 09:00 ยังราคาเดิม");
});

test("CR-05 ราคากลางวันและสนาม C ไม่เปลี่ยน [CR-05]", () => {
  assert.equal(rate(A, "2026-11-03", 16), 800, "A อ 3 พ.ย. 16:00");
  assert.equal(rate(A, "2026-12-15", 8), 800);
  assert.equal(rate(C, "2026-11-03", 16), 1200, "C อ 3 พ.ย. 16:00");
  assert.equal(rate(C, "2026-11-03", 17), 1800, "C อ 3 พ.ย. 17:00");
  assert.equal(rate(C, "2026-11-07", 9), 1800, "C ส 7 พ.ย. 09:00");
});

test("CR-05 จองคร่อม 17:00 คิดทีละชั่วโมง: 16:00 ฿800 + 17:00 ฿1,300 = ฿2,100 [D:CR-05]", () => {
  assert.equal(price(A, "2026-11-03", 16, 2), 2100);
  assert.equal(price(A, "2026-10-27", 16, 2), 2000, "ก่อนวันมีผลยัง 800 + 1,200 [E rules.test.ts]");
  assert.equal(price(A, "2026-11-03", 19, 2), 2600);
});

test("CR-05 มัดจำ 50% ของ ฿1,300 = ฿650 · จ่ายเต็มเย็นศุกร์ = ฿1,300 [D:CR-05]", () => {
  const dep = computePrice({ fieldPrice: price(A, "2026-11-03", 19, 1), paymentPlan: paymentPlanFor("2026-11-03", 19) });
  assert.equal(dep.totalPrice, 1300);
  assert.equal(dep.payNow, 650);
  assert.equal(dep.dueAtField, 650);
  const full = computePrice({ fieldPrice: price(A, "2026-11-06", 19, 1), paymentPlan: paymentPlanFor("2026-11-06", 19) });
  assert.equal(full.paymentPlan, "FULL_100");
  assert.equal(full.payNow, 1300);
});

test("CR-05 จองประจำลด 10%: ฿1,300 ลด ฿130 = ฿1,170 ต่อชั่วโมงเย็น [D:CR-05]", () => {
  const fp = price(A, "2026-11-04", 19, 1);
  assert.equal(fp, 1300);
  assert.equal(discountAmount(fp, 10), 130);
  assert.equal(fp - discountAmount(fp, 10), 1170);
});

test("CR-05 ชั่วโมงฟรีใช้ก่อน 17:00 เท่านั้น: มูลค่า = ราคากลางวัน ฿800 ไม่เปลี่ยน [CR-05]", () => {
  assert.equal(rate(A, "2026-11-03", 16), 800);
  assert.equal(rules.isFreeHourSlot("2026-11-03", 16), true);
  assert.equal(rules.isFreeHourSlot("2026-11-03", 17), false);
});

test("CR-05 ratesOn: ราคา ณ วัน (ฐานก่อนจุดเปลี่ยนแรก · จุดเปลี่ยนล่าสุดที่ถึงวันแล้ว) [D:CR-05]", () => {
  assert.deepEqual(ratesOn(A, "2026-10-31"), { dayRate: 800, eveningRate: 1200 });
  assert.deepEqual(ratesOn(A, "2026-11-01"), { dayRate: 800, eveningRate: 1300 });
  assert.deepEqual(ratesOn(C, "2026-11-01"), { dayRate: 1200, eveningRate: 1800 });
});

test("CR-05 ratesOn: หลายจุดเปลี่ยน เรียงลำดับไหนก็ได้ · จุดหลังสุดที่ถึงวันแล้วชนะ", () => {
  const f: Field = {
    dayRate: 800,
    eveningRate: 1200,
    rateChanges: [
      { from: "2027-03-01", dayRate: 900, eveningRate: 1400 },
      { from: "2026-11-01", dayRate: 800, eveningRate: 1300 },
    ],
  };
  assert.equal(ratesOn(f, "2026-12-31").eveningRate, 1300);
  assert.equal(ratesOn(f, "2027-03-01").eveningRate, 1400);
  assert.equal(ratesOn(f, "2027-03-01").dayRate, 900);
  assert.equal(ratesOn(f, "2026-10-31").eveningRate, 1200);
});

test("CR-05 upcomingRates: ราคาที่ยังไม่ถึงวันมีผล (ใช้โชว์ \"฿1,300 ตั้งแต่ 1 พ.ย.\") · ถึงวันแล้วไม่ใช่ราคาล่วงหน้า", () => {
  assert.deepEqual(upcomingRates(A, "2026-10-21"), [{ from: "2026-11-01", dayRate: 800, eveningRate: 1300 }]);
  assert.deepEqual(upcomingRates(A, "2026-10-31"), [{ from: "2026-11-01", dayRate: 800, eveningRate: 1300 }]);
  assert.deepEqual(upcomingRates(A, "2026-11-01"), []);
  assert.deepEqual(upcomingRates(C, "2026-10-21"), []);
});
