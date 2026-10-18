// Unit tests for the v2 rules (node --test). Written before the code. Boundary values: docs/04-REQUIREMENTS.md
// section 3 (BR-29 – BR-45) and docs/TEST-DATA.md section 6 (E109 – E148).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_MAX_CHARS,
  CHAT_MAX_PER_MINUTE,
  SHOP_CONTACT,
  REAL_DISCOUNTS,
  adjustMovement,
  applyTransfer,
  canAccess,
  canStockAction,
  chatNeedsRedaction,
  checkChatText,
  checkReason,
  checkReportRange,
  checkSellable,
  checkStockOut,
  checkTransfer,
  chatRateOk,
  csvCell,
  isBelowReorder,
  maskPhone,
  neutralizeUserText,
  parseBotReply,
  popularHours,
  priceGuardOk,
  redactText,
  rentableTotal,
  saleTotal,
  summarizeMoney,
  toCsv,
  utilizationPercent,
  validateTag,
} from "./index.ts";

// ---------- BR-29 / BR-32 / NFR-16 / NFR-17: chat helpers ----------
test("BR-29 contacts and the only 2 real discounts", () => {
  assert.equal(SHOP_CONTACT.phone, "02-345-6789");
  assert.equal(SHOP_CONTACT.line, "@lookhnang");
  assert.equal(REAL_DISCOUNTS.length, 2);
});

test("NFR-17 message length ≤ 500, not empty", () => {
  assert.equal(CHAT_MAX_CHARS, 500);
  assert.equal(checkChatText("x".repeat(499)), null);
  assert.equal(checkChatText("x".repeat(500)), null);
  assert.equal(checkChatText("x".repeat(501))?.code, "CHAT_TOO_LONG");
  assert.equal(checkChatText("   ")?.code, "CHAT_EMPTY");
});

test("NFR-17 at most 20 messages per minute per room (the 21st is refused)", () => {
  assert.equal(CHAT_MAX_PER_MINUTE, 20);
  const now = new Date("2026-10-09T10:00:00+07:00");
  const at = (s: number) => new Date(now.getTime() - s * 1000);
  const nineteen = Array.from({ length: 19 }, (_, i) => at(i + 1));
  assert.equal(chatRateOk(nineteen, now), true); // this is message 20
  assert.equal(chatRateOk([...nineteen, at(30)], now), false); // message 21 within 60 s
  assert.equal(chatRateOk([...nineteen, at(61)], now), true); // older than a minute does not count
});

test("NFR-16 / ADR-15 bot reply: <think> and tags removed, first valid tag kept", () => {
  const r = parseBotReply('<think>ลองคิด</think>ขอตรวจรอบให้นะครับ [CHECK]{"fieldId":"A","date":"2026-10-09","startHour":19,"hours":1}');
  assert.equal(r.text, "ขอตรวจรอบให้นะครับ");
  assert.deepEqual(r.tag, { name: "CHECK", args: { fieldId: "A", date: "2026-10-09", startHour: 19, hours: 1 } });
  // broken JSON / unknown tag → no tag, still hidden
  assert.equal(parseBotReply('ok [QUOTE]{"fieldId":').tag, null);
  assert.equal(parseBotReply('ok [CANCEL]{"code":"LN-900004"}').tag, null);
  assert.equal(parseBotReply('ok [CANCEL]{"code":"LN-900004"}').text, "ok");
});

test("NFR-17 tags typed by the customer have no effect", () => {
  const t = neutralizeUserText('[BOOK]{"fieldId":"A"} และ [check]');
  assert.equal(parseBotReply(t).tag, null);
  assert.ok(!/\[(BOOK|CHECK|QUOTE|RESULT)\]/i.test(t));
});

test("ADR-15 tag schema: only allowed keys, whole numbers, real fields", () => {
  assert.ok(validateTag({ name: "QUOTE", args: { fieldId: "C", date: "2026-10-10", startHour: 18, hours: 1 } }));
  assert.equal(validateTag({ name: "QUOTE", args: { fieldId: "D", date: "2026-10-10", startHour: 18, hours: 1 } }), null);
  assert.equal(validateTag({ name: "QUOTE", args: { fieldId: "C", date: "2026-10-10", startHour: 18.5, hours: 1 } }), null);
  assert.equal(validateTag({ name: "QUOTE", args: { fieldId: "C", date: "2026-10-10", startHour: 18, hours: 1, price: 100 } }), null);
  assert.equal(validateTag({ name: "BOOK", args: { fieldId: "B", date: "2026-10-14", startHour: 10, hours: 1, name: "ทดสอบ" } }), null); // no phone
  assert.ok(validateTag({ name: "BOOK", args: { fieldId: "B", date: "2026-10-14", startHour: 10, hours: 1, name: "ทดสอบ", phone: "089-123-4567" } }));
});

test("BR-30 price guard: every ฿ amount in the answer must come from the functions", () => {
  assert.equal(priceGuardOk("ราคา ฿1,800 จ่ายตอนนี้ ฿1,800 ครับ", [1800]), true);
  assert.equal(priceGuardOk("ลดเหลือ ฿100 ครับ", [1200, 1800]), false);
  assert.equal(priceGuardOk("THB 400 now", [800, 400]), true);
  assert.equal(priceGuardOk("ไม่มีตัวเลขเงิน", []), true);
});

// ---------- BR-33 – BR-38: stock ----------
test("BR-33 counter has 24 water: sell 23 / 24 ok, 25 refused", () => {
  assert.equal(checkStockOut(24, 23), null);
  assert.equal(checkStockOut(24, 24), null);
  assert.equal(checkStockOut(24, 25)?.code, "STOCK_INSUFFICIENT");
  assert.equal(checkStockOut(24, 0)?.code, "INVALID_QTY");
});

test("BR-34 transfer keeps the total; 96 ok, 97 refused; same place refused", () => {
  assert.deepEqual(applyTransfer({ STORE: 96, COUNTER: 24 }, "STORE", "COUNTER", 24), { STORE: 72, COUNTER: 48 });
  assert.equal(checkTransfer("STORE", "COUNTER", 96, 96), null);
  assert.equal(checkTransfer("STORE", "COUNTER", 97, 96)?.code, "STOCK_INSUFFICIENT");
  assert.equal(checkTransfer("COUNTER", "COUNTER", 1, 24)?.code, "STOCK_SAME_LOCATION");
  assert.equal(checkTransfer("STORE", "SHELF", 1, 24)?.code, "INVALID_LOCATION");
});

test("BR-35 warn only below the reorder point (total of all places)", () => {
  assert.equal(isBelowReorder(49, 48), false);
  assert.equal(isBelowReorder(48, 48), false);
  assert.equal(isBelowReorder(47, 48), true);
  assert.equal(isBelowReorder(0, null), false); // bibs: no reorder point
});

test("BR-36 roles and reasons", () => {
  assert.equal(canStockAction("STAFF", "SALE"), true);
  assert.equal(canStockAction("STAFF", "TRANSFER"), true);
  for (const a of ["RECEIVE", "DAMAGE", "ADJUST", "REORDER_POINT"] as const) {
    assert.equal(canStockAction("STAFF", a), false);
    assert.equal(canStockAction("MANAGER", a), true);
    assert.equal(canStockAction("OWNER", a), true);
  }
  assert.equal(checkReason("")?.code, "STOCK_REASON_REQUIRED");
  assert.equal(checkReason("   ")?.code, "STOCK_REASON_REQUIRED");
  assert.equal(checkReason(undefined)?.code, "STOCK_REASON_REQUIRED");
  assert.equal(checkReason("นับจริง"), null);
});

test("BR-36 / T-14 adjust after counting: 96 → 95 is ADJUST −1 out of that place", () => {
  assert.deepEqual(adjustMovement("STORE", 96, 95), { delta: -1, qty: 1, fromLocationId: "STORE", toLocationId: null });
  assert.deepEqual(adjustMovement("STORE", 95, 96), { delta: 1, qty: 1, fromLocationId: null, toLocationId: "STORE" });
  assert.equal((adjustMovement("STORE", 96, 96) as { code: string }).code, "STOCK_NO_CHANGE");
  assert.equal((adjustMovement("STORE", 96, -1) as { code: string }).code, "INVALID_QTY");
});

test("BR-37 sale total, only items of the SALE category", () => {
  assert.equal(saleTotal([{ qty: 2, unitPrice: 10 }, { qty: 1, unitPrice: 20 }]), 40);
  assert.equal(checkSellable("SALE"), null);
  assert.equal(checkSellable("EQUIPMENT")?.code, "STOCK_NOT_FOR_SALE");
  assert.equal(checkSellable("RENTAL")?.code, "STOCK_NOT_FOR_SALE");
});

test("BR-38 rentable bibs = stock of all places: damage 1 → 5, receive 1 → 6", () => {
  assert.equal(rentableTotal([0, 6]), 6);
  assert.equal(rentableTotal([0, 5]), 5);
  assert.equal(rentableTotal([1, 5]), 6);
});

// ---------- BR-39 – BR-41, BR-44: back office ----------
test("BR-39 report range: 3 calendar months counting both ends", () => {
  assert.equal(checkReportRange("2026-10-01", "2026-12-31"), null);
  assert.equal(checkReportRange("2026-10-01", "2027-01-01")?.code, "REPORT_RANGE_TOO_LONG");
  assert.equal(checkReportRange("2026-10-10", "2026-10-09")?.code, "REPORT_RANGE_ORDER");
  assert.equal(checkReportRange("2026-10-08", "2026-10-08"), null);
  assert.equal(checkReportRange("2026-10-xx", "2026-10-08")?.code, "INVALID_DATE");
});

test("BR-39 / BR-44 who may open what", () => {
  for (const area of ["DASHBOARD", "BOOKINGS", "CHATS", "ALERTS"] as const) {
    assert.equal(canAccess("OWNER", area), true);
    assert.equal(canAccess("MANAGER", area), true);
    assert.equal(canAccess("STAFF", area), false);
  }
  for (const area of ["REPORTS", "AUDIT"] as const) {
    assert.equal(canAccess("OWNER", area), true);
    assert.equal(canAccess("MANAGER", area), false);
    assert.equal(canAccess("STAFF", area), false);
  }
});

// TEST-DATA 5.1 / 5.2 as rows (Bangkok days)
const PAYMENTS = [
  { day: "2026-10-08", amount: 2400, method: "PROMPTPAY" },
  { day: "2026-10-08", amount: 1800, method: "PROMPTPAY" },
  { day: "2026-10-03", amount: 600, method: "PROMPTPAY" },
  { day: "2026-10-08", amount: 600, method: "PROMPTPAY" },
  { day: "2026-10-02", amount: 2400, method: "PROMPTPAY" },
  { day: "2026-10-05", amount: 600, method: "PROMPTPAY" },
  { day: "2026-10-06", amount: 600, method: "CASH_AT_FIELD" },
  { day: "2026-09-24", amount: 1800, method: "PROMPTPAY" },
  { day: "2026-10-06", amount: 600, method: "PROMPTPAY" },
];
const SALES = [
  { day: "2026-10-08", amount: 60, method: "PROMPTPAY" },
  { day: "2026-10-09", amount: 40, method: "CASH" },
];

test("BR-40 money counted on the day it was received (TEST-DATA 5.4)", () => {
  assert.equal(summarizeMoney("2026-10-09", "2026-10-09", PAYMENTS, SALES).total, 40);
  const d8 = summarizeMoney("2026-10-08", "2026-10-08", PAYMENTS, SALES);
  assert.equal(d8.total, 4860);
  assert.equal(d8.bookingMoney, 4800);
  assert.equal(d8.salesMoney, 60);
  const week = summarizeMoney("2026-10-03", "2026-10-09", PAYMENTS, SALES);
  assert.equal(week.total, 7300);
  assert.deepEqual(
    week.days.map((d) => [d.date, d.total]),
    [
      ["2026-10-03", 600],
      ["2026-10-04", 0],
      ["2026-10-05", 600],
      ["2026-10-06", 1200],
      ["2026-10-07", 0],
      ["2026-10-08", 4860],
      ["2026-10-09", 40],
    ],
  );
  assert.equal(week.salesCash, 40);
  assert.equal(week.salesPromptpay, 60);
});

test("BR-41 field use = blocked hours ÷ 16 × 100, rounded", () => {
  assert.equal(utilizationPercent(2), 13); // 12.5 → 13
  assert.equal(utilizationPercent(4), 25);
  assert.equal(utilizationPercent(0), 0);
  assert.equal(utilizationPercent(16), 100);
});

test("T-21 popular start hours 08:00–23:00 count field-blocking bookings", () => {
  const p = popularHours([
    { startHour: 19, status: "CONFIRMED" },
    { startHour: 19, status: "NO_SHOW" },
    { startHour: 18, status: "CANCELLED" },
    { startHour: 9, status: "CHECKED_IN" },
  ]);
  assert.equal(p.length, 16);
  assert.equal(p.find((x) => x.hour === 19)?.count, 2);
  assert.equal(p.find((x) => x.hour === 18)?.count, 0);
  assert.equal(p.find((x) => x.hour === 9)?.count, 1);
});

// ---------- NFR-22 / ADR-19: CSV ----------
test("ADR-19 CSV: BOM, CRLF, quotes and formula escaping", () => {
  assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
  assert.equal(csvCell("+cmd"), "'+cmd");
  assert.equal(csvCell("-1+1"), "'-1+1");
  assert.equal(csvCell("@a"), "'@a");
  assert.equal(csvCell("\tx"), "'\tx");
  assert.equal(csvCell("a,b"), "\"a,b\"");
  assert.equal(csvCell("แนน"), "แนน");
  assert.equal(csvCell(-600), "-600"); // money is a number from the server, never escaped
  assert.equal(csvCell(4860), "4860");
  const csv = toCsv(["วันที่", "ยอดรวม"], [["2026-10-08", 4860]]);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(csv, "﻿วันที่,ยอดรวม\r\n2026-10-08,4860\r\n");
});

// ---------- BR-45: chat retention ----------
test("BR-45 phone masked in the back office: 08x-xxx-1234", () => {
  assert.equal(maskPhone("0811111111"), "08x-xxx-1111");
  assert.equal(maskPhone("0891234567"), "08x-xxx-4567");
});

test("BR-45 names and phones removed after 90 days (89 / 90 keep, 91 remove)", () => {
  const created = new Date("2026-10-09T10:00:00+07:00");
  const day = 86400e3;
  assert.equal(chatNeedsRedaction(created, new Date(created.getTime() + 89 * day)), false);
  assert.equal(chatNeedsRedaction(created, new Date(created.getTime() + 90 * day)), false);
  assert.equal(chatNeedsRedaction(created, new Date(created.getTime() + 91 * day)), true);
  const r = redactText("ชื่อ แนน ทดลอง เบอร์ 084-444-4444 ครับ", ["แนน ทดลอง"]);
  assert.ok(!r.includes("4444"));
  assert.ok(!r.includes("แนน"));
  assert.ok(r.includes("ครับ"));
  assert.equal(redactText("เปิดกี่โมงครับ", []), "เปิดกี่โมงครับ");
});
