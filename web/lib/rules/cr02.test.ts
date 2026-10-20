// CR-02 (CHANGE-REQUESTS/CR-02.md · docs/impact/CR-02.md) — กฎล้วนที่ร้านตอบไว้ (node --test) · เขียนก่อนแก้โค้ด
// ค่าที่คาดหวัง: [D:CR-02] = CHANGE-REQUESTS/answers/README.md หัวข้อ CR-02 · [D A-43..A-46] = docs/01-INTERVIEW.md
import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "./index.ts";
import { checkReportRange, historyActorLabel, slotStart } from "./index.ts";

// ฟังก์ชันใหม่ของ CR-02 (ยังไม่มีบนโค้ดเดิม → เรียกผ่าน namespace เพื่อให้ล้มด้วยเหตุ "ยังไม่มีกฎ" ไม่ใช่ import พัง)
type RuleError = { code: string } | null;
const checkCheckin = (status: string, date: string, now: Date): RuleError =>
  (rules as unknown as { checkCheckin: (s: string, d: string, n: Date) => RuleError }).checkCheckin(status, date, now);
const finishedAt = (status: string, date: string, startHour: number, hours: number, now: Date): Date | null =>
  (rules as unknown as { finishedAt: (s: string, d: string, h: number, n: number, now: Date) => Date | null }).finishedAt(status, date, startHour, hours, now);
const at = (local: string) => new Date(`${local}+07:00`);

// ---------- (1) เช็กอินเฉพาะวันเตะ [D:CR-02] ข้อ 1 · A-45 ----------
test("CR-02 (1) เช็กอินได้ทุกเวลาของวันเตะ (เวลาไทย) · วันอื่นปฏิเสธ CHECKIN_NOT_PLAY_DAY", () => {
  // รอบ 12 ต.ค. 19:00 — ก่อนเวลาเริ่มในวันเดียวกันได้ · หลังเล่นจบในวันเดียวกันได้
  assert.equal(checkCheckin("CONFIRMED", "2026-10-12", at("2026-10-12T00:00:00")), null);
  assert.equal(checkCheckin("CONFIRMED", "2026-10-12", at("2026-10-12T08:00:00")), null);
  assert.equal(checkCheckin("CONFIRMED", "2026-10-12", at("2026-10-12T23:59:59")), null);
  // วันก่อน / วันถัดไป
  assert.equal(checkCheckin("CONFIRMED", "2026-10-12", at("2026-10-11T23:59:59"))?.code, "CHECKIN_NOT_PLAY_DAY");
  assert.equal(checkCheckin("CONFIRMED", "2026-10-12", at("2026-10-13T00:00:00"))?.code, "CHECKIN_NOT_PLAY_DAY");
  assert.equal(checkCheckin("CONFIRMED", "2026-10-21", at("2026-10-09T10:00:00"))?.code, "CHECKIN_NOT_PLAY_DAY");
});

test("CR-02 (1) นับวันตามเวลาไทย ไม่ใช่ UTC (12 ต.ค. 06:30 ไทย = 11 ต.ค. 23:30 UTC ยังเป็นวันเตะ)", () => {
  assert.equal(checkCheckin("CONFIRMED", "2026-10-12", new Date("2026-10-11T23:30:00Z")), null);
  assert.equal(checkCheckin("CONFIRMED", "2026-10-12", new Date("2026-10-12T17:00:00Z"))?.code, "CHECKIN_NOT_PLAY_DAY"); // 13 ต.ค. 00:00 ไทย
});

test("CR-02 (1) สถานะที่ไม่ใช่ CONFIRMED ยังได้ INVALID_STATUS เหมือนเดิม (ตรวจสถานะก่อนวัน)", () => {
  for (const s of ["CHECKED_IN", "PENDING_PAYMENT", "NO_SHOW", "CANCELLED", "EXPIRED", "RAIN_CLOSED"]) {
    assert.equal(checkCheckin(s, "2026-10-12", at("2026-10-12T10:00:00"))?.code, "INVALID_STATUS", s);
    assert.equal(checkCheckin(s, "2026-10-21", at("2026-10-12T10:00:00"))?.code, "INVALID_STATUS", s);
  }
});

// ---------- (2) "ใครกด" = ชื่อพนักงาน [D:CR-02] ข้อ 2 · A-44 ----------
test("CR-02 (2) ป้ายผู้ทำ: พนักงาน → ชื่อที่แสดง · ลูกค้า/แชทบอท/ระบบ เหมือนเดิม · หาชื่อไม่เจอ → ค่าที่บันทึก", () => {
  assert.equal(historyActorLabel("staff", "th", "น้องบอล"), "น้องบอล");
  assert.equal(historyActorLabel("staff", "en", "น้องบอล"), "น้องบอล");
  assert.equal(historyActorLabel("owner", "th", "คุณเอก"), "คุณเอก");
  assert.equal(historyActorLabel("CUSTOMER", "th", null), "ลูกค้า");
  assert.equal(historyActorLabel("BOT", "en", null), "Chatbot");
  assert.equal(historyActorLabel("SYSTEM", "th", undefined), "ระบบ");
  // คำของระบบมาก่อนชื่อเสมอ (ไม่ให้บัญชีชื่อ SYSTEM ปลอมเป็นระบบ)
  assert.equal(historyActorLabel("SYSTEM", "th", "ใครก็ได้"), "ระบบ");
  assert.equal(historyActorLabel("former", "th", null), "former");
  assert.equal(historyActorLabel("former", "th", ""), "former");
});

// ---------- (3) ขั้น "จบ" ที่คำนวณ [D:CR-02] ข้อ 3 · A-43 ----------
test("CR-02 (3) จบ = เช็กอินแล้ว และถึงเวลาจบรอบ · เวลาของขั้น = เวลาจบรอบ", () => {
  const end = slotStart("2026-10-12", 9);
  assert.equal(finishedAt("CHECKED_IN", "2026-10-12", 8, 1, at("2026-10-12T08:59:59")), null);
  assert.equal(finishedAt("CHECKED_IN", "2026-10-12", 8, 1, at("2026-10-12T09:00:00"))?.toISOString(), end.toISOString()); // TC-TRACK-01
  assert.equal(finishedAt("CHECKED_IN", "2026-10-12", 8, 1, at("2026-10-20T10:00:00"))?.toISOString(), end.toISOString());
  // รอบจบ 24:00 → 00:00 ของวันถัดไป
  assert.equal(finishedAt("CHECKED_IN", "2026-10-03", 22, 2, at("2026-10-04T00:00:00"))?.toISOString(), at("2026-10-04T00:00:00").toISOString());
  assert.equal(finishedAt("CHECKED_IN", "2026-10-03", 22, 2, at("2026-10-03T23:59:59")), null);
});

test("CR-02 (3) ไม่มา / ยกเลิก / ยังไม่เช็กอิน → ไม่มีขั้นจบ แม้เลยเวลาแล้ว", () => {
  for (const s of ["CONFIRMED", "NO_SHOW", "CANCELLED", "EXPIRED", "PENDING_PAYMENT", "RAIN_CLOSED"]) {
    assert.equal(finishedAt(s, "2026-10-03", 18, 2, at("2026-10-09T10:00:00")), null, s);
  }
});

// ---------- (4) "3 เดือน" [D:CR-02] ข้อ 4 · A-46 · BR-39 ----------
test("CR-02 (4) 30 พ.ย. → 28 ก.พ. ได้ · 30 พ.ย. → 1 มี.ค. ไม่ได้ · 1 ต.ค. → 31 ธ.ค. ได้ (เหมือนเดิม)", () => {
  assert.equal(checkReportRange("2026-11-30", "2027-02-28"), null);
  assert.equal(checkReportRange("2026-11-30", "2027-03-01")?.code, "REPORT_RANGE_TOO_LONG");
  assert.equal(checkReportRange("2026-10-01", "2026-12-31"), null);
});

test("CR-02 (4) เดือนปลายทางไม่มีวันที่นั้น → วันสุดท้ายของเดือน (31 ส.ค. → 30 พ.ย. · 31 ม.ค. → 30 เม.ย. · 29 พ.ย. → 28 ก.พ.)", () => {
  assert.equal(checkReportRange("2026-08-31", "2026-11-30"), null);
  assert.equal(checkReportRange("2026-08-31", "2026-12-01")?.code, "REPORT_RANGE_TOO_LONG");
  assert.equal(checkReportRange("2027-01-31", "2027-04-30"), null);
  assert.equal(checkReportRange("2026-11-29", "2027-02-28"), null);
  assert.equal(checkReportRange("2026-11-29", "2027-03-01")?.code, "REPORT_RANGE_TOO_LONG");
});

test("CR-02 (4) ไม่เปลี่ยนค่าที่ร้านยืนยันแล้ว: 1 ต.ค. → 1 ม.ค. ยังไม่ได้ (E141 · BR-39) · 30 ส.ค. → 29 พ.ย. ได้ / 30 พ.ย. ไม่ได้", () => {
  assert.equal(checkReportRange("2026-10-01", "2027-01-01")?.code, "REPORT_RANGE_TOO_LONG");
  assert.equal(checkReportRange("2026-08-30", "2026-11-29"), null);
  assert.equal(checkReportRange("2026-08-30", "2026-11-30")?.code, "REPORT_RANGE_TOO_LONG");
  assert.equal(checkReportRange("2026-11-30", "2027-02-27"), null);
});
