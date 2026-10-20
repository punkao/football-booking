// ของใช้ร่วมของ golden master (Node ≥ 22 · ไม่มี dependency)
// - reset ระบบกลับ seed + ล็อกเวลา ศ 9 ต.ค. 2569 10:00 (POST /api/test/reset {})
// - เข้าสู่ระบบด้วยค่าทดสอบจาก e2e/tests/constants.ts (ไฟล์ fixture ของโปรเจกต์ · ไม่เขียนรหัสซ้ำในไฟล์นี้)
// - เขียน JSON แบบเรียง key คงที่ → sha256 ย่อ 8 ตัว = ป้าย [E golden/<ชื่อ>:<sha8>]
// - โหมดเทียบ: ต่างแม้ 1 เคส → exit 1 พร้อมบอกเคสและฟิลด์ที่ต่าง
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..", "..");
export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const UPDATE = process.argv.includes("--update");

/** เรียง key ทุกชั้น → JSON เดียวกันได้ไบต์เดียวกันเสมอ */
export function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = canonical(v[k]);
    return o;
  }
  return v;
}

export function serialize(doc) {
  return JSON.stringify(canonical(doc), null, 2) + "\n";
}

export function sha8(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 8);
}

export async function reset() {
  const r = await fetch(`${BASE_URL}/api/test/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = await r.json().catch(() => ({}));
  if (r.status !== 200 || body.ok !== true) {
    throw new Error(`reset ไม่สำเร็จ HTTP ${r.status} ${JSON.stringify(body)} (ต้องเปิด ALLOW_TEST_RESET=1)`);
  }
  return body;
}

/** ค่าทดสอบจาก e2e/tests/constants.ts (SEED) */
export function seedCredential(key) {
  const src = readFileSync(join(ROOT, "e2e", "tests", "constants.ts"), "utf8");
  const m = src.match(new RegExp(`\\b${key}:\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`ไม่เจอ SEED.${key} ใน e2e/tests/constants.ts`);
  const get = (f) => m[1].match(new RegExp(`${f}:\\s*'([^']*)'`))?.[1];
  return { phone: get("phone"), username: get("username"), password: get("password") };
}

/** POST login แล้วคืน header Cookie (ไม่พิมพ์ ไม่เก็บลง golden) */
export async function login(path, data) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (r.status !== 200) throw new Error(`login ${path} ได้ HTTP ${r.status}`);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

export async function call(method, path, { body, cookie, text = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  const r = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  // อ่านเป็นไบต์เอง: r.text() ตัด BOM ทิ้งเงียบ ๆ (TextDecoder ค่าเริ่ม) → ignoreBOM เพื่อให้เห็น EF BB BF จริง
  const raw = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await r.arrayBuffer());
  let parsed = raw;
  if (!text) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { nonJson: raw.slice(0, 200) };
    }
  }
  return { status: r.status, contentType: (r.headers.get("content-type") ?? "").split(";")[0], body: parsed };
}

/** ฟิลด์ที่ต่างระหว่าง 2 ค่า (path แบบ a.b[0].c) */
export function diffPaths(a, b, path = "", out = []) {
  if (out.length > 12) return out;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || a === null || b === null || typeof a !== "object") {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path || "(ทั้งค่า)"}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) diffPaths(a[k], b[k], Array.isArray(a) ? `${path}[${k}]` : path ? `${path}.${k}` : k, out);
  return out;
}

/**
 * เขียน (--update) หรือเทียบกับไฟล์ golden
 * @returns {number} exit code (0 = เท่ากัน / เขียนแล้ว · 1 = ต่าง หรือยังไม่มีไฟล์)
 */
export function writeOrCompare(name, doc) {
  const file = join(HERE, `${name}.golden.json`);
  const text = serialize(doc);
  const now8 = sha8(text);
  if (UPDATE) {
    writeFileSync(file, text);
    console.log(`[golden] เขียน ${name}.golden.json · ${doc.cases.length} เคส · [E golden/${name}:${now8}]`);
    return 0;
  }
  if (!existsSync(file)) {
    console.error(`[golden] ยังไม่มี ${name}.golden.json → รัน --update ครั้งแรก`);
    return 1;
  }
  const oldText = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const old8 = sha8(oldText);
  if (oldText === text) {
    console.log(`[golden] ${name}: เท่ากัน ${doc.cases.length}/${doc.cases.length} เคส · [E golden/${name}:${now8}]`);
    return 0;
  }
  const old = JSON.parse(oldText);
  const byId = new Map(old.cases.map((c) => [c.id, c]));
  const changed = [];
  for (const c of doc.cases) {
    const o = byId.get(c.id);
    if (!o) changed.push({ id: c.id, diffs: ["(เคสใหม่ ไม่มีใน golden)"] });
    else {
      const d = diffPaths(canonical(o), canonical(c));
      if (d.length) changed.push({ id: c.id, diffs: d });
      byId.delete(c.id);
    }
  }
  for (const id of byId.keys()) changed.push({ id, diffs: ["(หายไปจากรอบนี้)"] });
  console.error(`[golden] ${name}: ต่าง ${changed.length}/${old.cases.length} เคส · golden ${old8} → รอบนี้ ${now8}`);
  for (const c of changed.slice(0, 25)) console.error(`  ✗ ${c.id}\n      ${c.diffs.slice(0, 6).join("\n      ")}`);
  if (changed.length > 25) console.error(`  … อีก ${changed.length - 25} เคส`);
  if (!changed.length) console.error("  (ทุกเคสเท่ากัน แต่ส่วน meta ต่าง)");
  return 1;
}
