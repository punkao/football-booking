// NET-red (WT-03-RED / WT-04-RED) — รหัสจาก URL/ช่องค้นหาที่ผิดรูปต้องถูกกรองก่อนถึงฐานข้อมูล (ไม่ใช่ 500)
// ค่าที่คาดหวัง: รหัสแถวในฐานเป็น integer 4 ไบต์ (1..2147483647) · ข้อความที่มีไบต์ว่าง (\u0000) Postgres เก็บ/เทียบไม่ได้ → ถือว่า "ไม่พบ" · NFR-19
import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "./index.ts";

test("isDbId: จำนวนเต็ม 1..2147483647 เท่านั้น", () => {
  for (const ok of [1, 2, 99, 2147483647]) assert.equal(rules.isDbId(ok), true, String(ok));
  for (const bad of [0, -1, 1.5, NaN, Infinity, 2147483648, 99999999999, 9223372036854775808, Number("abc"), Number("1e3x"), Number("\u0000")]) {
    assert.equal(rules.isDbId(bad), false, String(bad));
  }
  for (const bad of ["1", null, undefined, {}, [1]]) assert.equal(rules.isDbId(bad as never), false, String(bad));
});

test("hasNul: ตรวจไบต์ว่างในข้อความ", () => {
  assert.equal(rules.hasNul("LN-\u0000"), true);
  assert.equal(rules.hasNul("\u0000"), true);
  assert.equal(rules.hasNul("LN-100001"), false);
  assert.equal(rules.hasNul(""), false);
});
