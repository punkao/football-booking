// Review round (docs/08e-FIX-PROMPT-review.md) — tests written before the fixes. R2 R3 R4 R5 R6 R12.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_MAX_ROOMS_PER_HOUR_PER_IP,
  CHAT_MAX_PER_MINUTE_PER_IP,
  chatIpLimitOk,
  checkOrigin,
  checkRentalDecrease,
  maskPhone,
  maxReserved,
  redactText,
  redactionDue,
  PHONE_IN_TEXT,
} from "./index.ts";

test("R2 per-IP limits: ≤ 10 new rooms per hour and ≤ 20 messages per minute", () => {
  assert.equal(CHAT_MAX_ROOMS_PER_HOUR_PER_IP, 10);
  assert.equal(CHAT_MAX_PER_MINUTE_PER_IP, 20);
  assert.equal(chatIpLimitOk({ roomsLastHour: 9, messagesLastMinute: 0, newRoom: true }), true); // 10th room
  assert.equal(chatIpLimitOk({ roomsLastHour: 10, messagesLastMinute: 0, newRoom: true }), false); // 11th room
  assert.equal(chatIpLimitOk({ roomsLastHour: 10, messagesLastMinute: 0, newRoom: false }), true); // existing room
  assert.equal(chatIpLimitOk({ roomsLastHour: 1, messagesLastMinute: 19, newRoom: false }), true); // 20th message
  assert.equal(chatIpLimitOk({ roomsLastHour: 1, messagesLastMinute: 20, newRoom: false }), false); // 21st message
});

test("R3 redaction runs at most once an hour (by the app clock; a clock moved back runs again)", () => {
  const t = new Date("2026-10-09T10:00:00+07:00");
  assert.equal(redactionDue(null, t), true);
  assert.equal(redactionDue(t, new Date(t.getTime() + 59 * 60_000)), false);
  assert.equal(redactionDue(t, new Date(t.getTime() + 60 * 60_000)), true);
  assert.equal(redactionDue(t, new Date(t.getTime() - 60_000)), true);
});

test("R4 rentals already booked by bookings that have not ended can't be removed from stock", () => {
  const uses = [
    { date: "2026-10-14", startHour: 19, hours: 2, qty: 4, returnedQty: 0 },
    { date: "2026-10-14", startHour: 20, hours: 2, qty: 2, returnedQty: 0 },
    { date: "2026-10-15", startHour: 9, hours: 1, qty: 5, returnedQty: 0 },
  ];
  assert.equal(maxReserved(uses), 6); // 20:00 on 14 Oct: 4 + 2
  assert.equal(maxReserved([{ date: "2026-10-14", startHour: 19, hours: 1, qty: 3, returnedQty: 3 }]), 0);
  assert.equal(maxReserved([]), 0);
  assert.equal(checkRentalDecrease(6, 6), null);
  assert.equal(checkRentalDecrease(5, 6)?.code, "STOCK_RESERVED");
  assert.equal(checkRentalDecrease(5, 6)?.params?.reserved, 6);
});

test("R5 names are removed only as whole words, ≥ 2 letters, never shop words", () => {
  assert.equal(redactText("จองสนามบอลกับน้องบอลครับ", ["บอล"]), "จองสนามบอลกับน้องบอลครับ");
  assert.equal(redactText("ต้นไม้ข้างสนาม", ["ต้น"]), "ต้นไม้ข้างสนาม"); // part of another word
  assert.equal(redactText("ชื่อ ต้น ครับ", ["ต้น"]), "ชื่อ [ลบชื่อแล้ว] ครับ");
  assert.equal(redactText("my name is A ok", ["A"]), "my name is A ok"); // 1 letter
  assert.equal(redactText("ชื่อ แนน ทดลอง เบอร์ 084-444-4444", ["แนน ทดลอง"]), "ชื่อ [ลบชื่อแล้ว] เบอร์ [ลบเบอร์แล้ว]");
  assert.equal(redactText("ลูกหนัง อารีน่า", ["ลูกหนัง"]), "ลูกหนัง อารีน่า");
});

test("R6 a data-changing request with Origin: null is refused; no Origin at all still passes", () => {
  assert.equal(checkOrigin("POST", "null", "localhost:3000"), false);
  assert.equal(checkOrigin("POST", "http://evil.example", "localhost:3000"), false);
  assert.equal(checkOrigin("POST", "http://localhost:3000", "localhost:3000"), true);
  assert.equal(checkOrigin("POST", null, "localhost:3000"), true);
  assert.equal(checkOrigin("GET", "null", "localhost:3000"), true);
});

test("R12 Thai phone numbers in every common format are found (and masked)", () => {
  const formats = ["0812345678", "081-234-5678", "08-1234-5678", "081 234 5678", "+66 81 234 5678", "+66812345678"];
  for (const f of formats) {
    const found = `โทร ${f} ครับ`.match(PHONE_IN_TEXT);
    assert.deepEqual(found, [f], f);
    assert.equal(redactText(`โทร ${f} ครับ`, []), "โทร [ลบเบอร์แล้ว] ครับ", f);
  }
  assert.deepEqual("บ้าน 02-123-4567".match(PHONE_IN_TEXT), ["02-123-4567"]); // 9-digit landline
  assert.equal("LN-100001 วันที่ 2026-10-14 ราคา 1,800".match(PHONE_IN_TEXT), null);
  assert.equal(maskPhone("+66 81 234 5678"), "08x-xxx-5678");
  // the shop's own number is not a customer's personal data
  assert.equal(redactText("โทร 02-345-6789 ครับ", []), "โทร 02-345-6789 ครับ");
});
