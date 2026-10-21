#!/usr/bin/env node
// smoke.mjs · ตรวจหลังขึ้นระบบ/ถอยกลับ · อ่านอย่างเดียว (HTTP GET เท่านั้น: ไม่ reset · ไม่สร้าง · ไม่แก้ข้อมูล · ไม่ล็อกอิน)
// (บท 06 LAB 12 ข้อ 0 · ปรับเป็นของสนามบอล: ตรวจ schema/bugMode จาก /api/version · ราคาสนามมีวันมีผล CR-05 · endpoint หลังบ้านต้อง 401 ไม่ใช่ 404 · ช่องทดสอบ /api/test/* ต้องไม่ตอบ 200 เมื่อ GET)
//
//   node tests/smoke.mjs                         ตรวจ http://localhost:3000 (BASE_URL เปลี่ยนได้)
//   EXPECT_SCHEMA=007 node tests/smoke.mjs       schema ที่ต้องเห็น (ค่าเริ่ม = เลขล่าสุดใน db/migrations)
//   EXPECT_BUG_MODE=0                            ค่าเริ่ม 0 (ขึ้นระบบจริงต้อง 0)
//   SMOKE_LEVEL=core node tests/smoke.mjs        ข้ามข้อที่เป็นของ CR (ใช้ตรวจเว็บรุ่นเก่าตอนซ้อมถอยกลับ)
//
// exit 0 = ผ่านทุกข้อ · exit 1 = มีข้อไม่ผ่าน หรือติดต่อเว็บไม่ได้ (เช่นเว็บหยุด) · ต้องใช้ Node >= 18 (fetch) ไม่มี dependency
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const CORE_ONLY = process.env.SMOKE_LEVEL === "core";
const EXPECT_BUG_MODE = Number(process.env.EXPECT_BUG_MODE ?? 0);
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 8000);

function latestMigration() {
  try {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
    const v = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f) && !f.endsWith(".down.sql")).map((f) => f.slice(0, 3)).sort();
    return v[v.length - 1] ?? null;
  } catch {
    return null;
  }
}
const EXPECT_SCHEMA = process.env.EXPECT_SCHEMA || latestMigration();

async function get(path) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, { method: "GET", signal: ctl.signal, redirect: "manual", headers: { accept: "*/*" } });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, text, json };
  } finally {
    clearTimeout(t);
  }
}

const checks = [];
const check = (id, title, fn, { core = true } = {}) => checks.push({ id, title, fn, core });

check("S1", "health: db:true", async () => {
  const r = await get("/api/health");
  if (r.status !== 200 || r.json?.ok !== true || r.json?.db !== true) throw new Error(`status ${r.status} body ${r.text.slice(0, 80)}`);
  return "ok:true db:true";
});
check("S2", `version: schema ${EXPECT_SCHEMA} · bugMode ${EXPECT_BUG_MODE}`, async () => {
  const r = await get("/api/version");
  if (r.status !== 200 || !r.json) throw new Error(`status ${r.status}`);
  const { schemaVersion, chatMode, bugMode } = r.json;
  if (EXPECT_SCHEMA && schemaVersion !== EXPECT_SCHEMA) throw new Error(`schemaVersion ${schemaVersion} ไม่ใช่ ${EXPECT_SCHEMA}`);
  if (bugMode !== EXPECT_BUG_MODE) throw new Error(`bugMode ${bugMode} ไม่ใช่ ${EXPECT_BUG_MODE}`);
  return `schema ${schemaVersion} · chat ${chatMode} · bug ${bugMode}`;
});
check("S3", "หน้าแรก 200 มีชื่อร้าน", async () => {
  const r = await get("/");
  if (r.status !== 200 || !r.text.includes("ลูกหนัง อารีน่า")) throw new Error(`status ${r.status} ไม่มีชื่อร้าน`);
  return `200 · ${r.text.length} ไบต์`;
});
check("S4", "หน้า /book และ /fields ตอบ 200", async () => {
  const out = [];
  for (const p of ["/book", "/fields"]) {
    const r = await get(p);
    if (r.status !== 200) throw new Error(`${p} → ${r.status}`);
    out.push(`${p} 200`);
  }
  return out.join(" · ");
});
check("S5", "GET /api/fields: สนาม A B C มีราคา", async () => {
  const r = await get("/api/fields");
  const f = r.json?.fields;
  if (r.status !== 200 || !Array.isArray(f)) throw new Error(`status ${r.status}`);
  const ids = f.map((x) => x.id).sort().join("");
  if (ids !== "ABC") throw new Error(`สนามที่เห็น "${ids}" ไม่ใช่ ABC`);
  if (!f.every((x) => x.dayRate > 0 && x.eveningRate > 0)) throw new Error("ราคาสนามไม่ครบ");
  return f.map((x) => `${x.id} ${x.dayRate}/${x.eveningRate}`).join(" · ");
});
check("S6", "GET /api/availability: ตอบตารางว่างของวันนี้", async () => {
  const r = await get("/api/availability");
  if (r.status !== 200 || !r.json?.date || !Array.isArray(r.json?.fields)) throw new Error(`status ${r.status} รูปร่างไม่ตรง`);
  return `date ${r.json.date} · fields ${r.json.fields.length}`;
});
check("S7", "หลังบ้านไม่ล็อกอิน → 401 (ไม่ใช่ 404 = endpoint มีจริง)", async () => {
  const out = [];
  for (const p of ["/api/owner/reports", "/api/owner/dashboard", "/api/staff/today", "/api/me"]) {
    const r = await get(p);
    if (r.status !== 401) throw new Error(`${p} → ${r.status} (ต้อง 401)`);
    out.push(p.split("/").slice(2).join("/"));
  }
  return `401 × ${out.length}: ${out.join(" ")}`;
});
check("S8", "ช่องทดสอบ GET /api/test/reset ไม่ใช่ 200 (ไม่ถูกเรียกโดยบังเอิญ)", async () => {
  const r = await get("/api/test/reset");
  if (r.status === 200) throw new Error("ตอบ 200");
  return `${r.status}`;
});
check("S9", "CR-05: ราคาสนามมีวันมีผล (rateChanges 1 พ.ย.) ใน /api/fields", async () => {
  const r = await get("/api/fields");
  const a = r.json?.fields?.find((x) => x.id === "A");
  const rc = a?.rateChanges;
  if (!Array.isArray(rc) || !rc.some((x) => x.from === "2026-11-01" && x.eveningRate === 1300)) throw new Error("ไม่พบ rateChanges 2026-11-01 ฿1,300");
  return "A: 2026-11-01 เย็น ฿1,300";
}, { core: false });
check("S10", "CR-03/05: /api/owner/reports.csv ไม่ล็อกอิน → 401", async () => {
  const r = await get("/api/owner/reports.csv");
  if (r.status !== 401) throw new Error(`status ${r.status}`);
  return "401";
}, { core: false });

const rows = [];
let failed = 0;
const t0 = Date.now();
for (const c of checks) {
  if (CORE_ONLY && !c.core) { rows.push([c.id, "ข้าม", c.title, "SMOKE_LEVEL=core"]); continue; }
  const s = Date.now();
  try {
    const detail = await c.fn();
    rows.push([c.id, "ผ่าน", c.title, `${detail} (${Date.now() - s} ms)`]);
  } catch (e) {
    failed++;
    const msg = e?.name === "AbortError" ? `timeout ${TIMEOUT_MS} ms` : (e?.cause?.code || e?.message || String(e));
    rows.push([c.id, "ไม่ผ่าน", c.title, msg]);
  }
}
const ran = rows.filter((r) => r[1] !== "ข้าม").length;
console.log(`smoke ${BASE} · อ่านอย่างเดียว (GET)`);
console.log("ข้อ | ผล | ตรวจอะไร | รายละเอียด");
console.log("--- | --- | --- | ---");
for (const r of rows) console.log(r.join(" | "));
console.log(`\nสรุป ${ran - failed}/${ran} ผ่าน${rows.length - ran ? ` · ข้าม ${rows.length - ran}` : ""} · ${Date.now() - t0} ms · exit ${failed ? 1 : 0}`);
process.exit(failed ? 1 : 0);
