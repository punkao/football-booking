// K3 (docs/handover/KNOWN-ISSUES.md · docs/handover/RELEASE-NOTES.md ส่วน K3) — "ตอนนี้" ของแอป: อ่านแถวนาฬิกาล็อก (app_settings.clock) เฉพาะเมื่อเปิดช่องทดสอบ
// (ALLOW_TEST_RESET=1) เท่านั้น · ปิดช่องทดสอบแล้วต้องใช้เวลาจริงเสมอ แม้แถวนั้นค้างอยู่ในฐาน (ไม่งั้นเครื่องจริงติดวันที่ 9 ต.ค. 2569)
// ค่าที่คาดหวัง: [D] docs/handover/RELEASE-NOTES.md K3 (เครื่องจริงต้องไม่คิดว่าเป็น 9 ต.ค.) · ADR-04 (เวลาเดียวของแอป) — เขียนก่อนแก้โค้ด
import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "./index.ts";

const REAL = new Date("2026-10-21T03:00:00Z");
const LOCKED = "2026-10-09T10:00:00+07:00";

test("K3 ช่องทดสอบเปิด + มีแถวนาฬิกา → ใช้เวลาที่ล็อก (e2e ผูกวันที่ 9 ต.ค. 10:00 ต้องคงเดิม)", () => {
  const n = rules.nowFrom(LOCKED, true, REAL);
  assert.equal(n.toISOString(), new Date(LOCKED).toISOString());
});

test("K3 ช่องทดสอบเปิด + ไม่มีแถว → เวลาจริง", () => {
  assert.equal(rules.nowFrom(undefined, true, REAL).getTime(), REAL.getTime());
  assert.equal(rules.nowFrom(null, true, REAL).getTime(), REAL.getTime());
  assert.equal(rules.nowFrom("", true, REAL).getTime(), REAL.getTime());
});

test("K3 ช่องทดสอบปิด + แถวนาฬิกายังค้าง → ไม่สนแถว ใช้เวลาจริง", () => {
  assert.equal(rules.nowFrom(LOCKED, false, REAL).getTime(), REAL.getTime());
});

test("K3 ช่องทดสอบปิด + ไม่มีแถว → เวลาจริง", () => {
  assert.equal(rules.nowFrom(undefined, false, REAL).getTime(), REAL.getTime());
});

test("K3 seamOn อ่านจาก env: เฉพาะค่า '1' เท่านั้นที่เปิด (ว่าง/0/true = ปิด)", () => {
  assert.equal(rules.testSeamOn({ ALLOW_TEST_RESET: "1" }), true);
  for (const v of [undefined, "", "0", "true", "yes", " 1"]) assert.equal(rules.testSeamOn({ ALLOW_TEST_RESET: v }), false, String(v));
});
