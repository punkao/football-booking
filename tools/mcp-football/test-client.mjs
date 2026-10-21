#!/usr/bin/env node
// test-client.mjs · Lab 7.2 (C1+C2): MCP client ทดสอบ server.mjs โดยไม่ใช้ LLM + บันทึกข้อความ JSON-RPC บนสาย
//   node tools/mcp-football/test-client.mjs            (จากโฟลเดอร์ football-booking/ · เว็บต้องเปิดที่ FOOTBALL_BASE_URL)
// ผล: docs/mcp/football-wire.log (1 บรรทัด = 1 ข้อความ JSON-RPC) · exit 0 = ผ่านทุกข้อ
// ใช้ฐานทดสอบ: reset ก่อน/หลังด้วย POST /api/test/reset {} (ต้อง ALLOW_TEST_RESET=1 — เครื่องนี้เปิดอยู่)
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SERVER = path.join(import.meta.dirname, "server.mjs");
const BASE = (process.env.FOOTBALL_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const WIRE = path.join(ROOT, "docs", "mcp", "football-wire.log");
fs.mkdirSync(path.dirname(WIRE), { recursive: true });
fs.writeFileSync(WIRE, `# football MCP wire log · ${new Date().toISOString()} · 1 บรรทัด = 1 ข้อความ JSON-RPC (-> client ส่ง · <- server ตอบ)\n`);

const results = [];
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { results.push([name, true]); console.log(`PASS  ${name}`); })
    .catch((e) => { results.push([name, false]); console.log(`FAIL  ${name}\n      ${e.message.split("\n")[0]}`); });
}

async function connect(label, baseUrl) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    env: { ...process.env, FOOTBALL_BASE_URL: baseUrl },
    stderr: "pipe",
  });
  const seen = {};
  const log = (dir, msg) => {
    if (msg?.result?.protocolVersion) seen.protocol = msg.result.protocolVersion;
    fs.appendFileSync(WIRE, JSON.stringify({ server: label, dir, msg }) + "\n");
  };
  const origSend = transport.send.bind(transport);
  transport.send = (m, o) => { log("->", m); return origSend(m, o); };
  let om;
  Object.defineProperty(transport, "onmessage", { get: () => om, set: (fn) => { om = fn && ((m, x) => { log("<-", m); fn(m, x); }); } });
  const client = new Client({ name: "football-test-client", version: "1.0.0" });
  await client.connect(transport);
  transport.stderr?.on("data", (d) => process.stderr.write(`  [server:${label}] ${d}`));
  return { client, transport, seen };
}

const web = async (method, p, body) => {
  const r = await fetch(BASE + p, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json() };
};
const textOf = (r) => r.content.map((c) => c.text).join("\n");

await web("POST", "/api/test/reset", {});

const DATE = "2026-10-14"; // พุธ · หลังวันล็อก 9 ต.ค. 2026 · อยู่ในช่วงจองได้
const slot = { fieldId: "B", date: DATE, startHour: 19, hours: 1 };
const phone = "0899990042";

const { client, seen } = await connect("local", BASE);
const info = client.getServerVersion();
console.log(`connected · server=${info?.name}@${info?.version} · protocol=${seen.protocol}`);

await check("tools/list มี 3 tool พร้อม inputSchema + description ไทย/อังกฤษ", async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["book", "check_availability", "quote"]);
  for (const t of tools) {
    assert.equal(t.inputSchema.type, "object");
    assert.match(t.description, /[฀-๿]/, `${t.name}: ไม่มีไทย`);
    assert.match(t.description, /[A-Za-z]{4}/, `${t.name}: ไม่มีอังกฤษ`);
  }
  const book = tools.find((t) => t.name === "book");
  for (const k of ["fieldId", "date", "startHour", "hours", "name", "phone", "consent", "confirm"]) assert.ok(book.inputSchema.required.includes(k), `book ต้อง required ${k}`);
  assert.ok(!book.inputSchema.required.includes("rentals"));
  console.log("      tools =", tools.map((t) => t.name).join(", "));
});

await check("resources: football://prices ตรงกับ GET /api/fields", async () => {
  const { resources } = await client.listResources();
  assert.ok(resources.some((r) => r.uri === "football://prices"));
  const r = await client.readResource({ uri: "football://prices" });
  assert.deepEqual(JSON.parse(r.contents[0].text), (await web("GET", "/api/fields")).json);
});

await check("check_availability ตรงกับ GET /api/availability (จำนวนช่วงว่าง + ราคา)", async () => {
  const r = await client.callTool({ name: "check_availability", arguments: { date: DATE } });
  assert.ok(!r.isError, textOf(r));
  const direct = (await web("GET", `/api/availability?date=${DATE}`)).json;
  for (const f of r.structuredContent.fields) {
    const want = direct.slots.filter((s) => s.fieldId === f.id && s.available).map((s) => ({ hour: s.hour, price: s.price }));
    assert.deepEqual(f.freeSlots, want, `สนาม ${f.id}`);
  }
  assert.ok(r.structuredContent.fields.find((f) => f.id === "B").freeSlots.some((s) => s.hour === 19));
  console.log("      " + textOf(r).split("\n").slice(0, 2).join(" | "));
});

await check("quote ตรงกับ POST /api/quote ทุกตัวเลข (ไม่มี/มีของเช่า)", async () => {
  for (const rentals of [undefined, [{ itemId: "BIB", qty: 2 }, { itemId: "BALL", qty: 1 }]]) {
    const args = { ...slot, ...(rentals ? { rentals } : {}) };
    const r = await client.callTool({ name: "quote", arguments: args });
    assert.ok(!r.isError, textOf(r));
    assert.deepEqual(r.structuredContent, (await web("POST", "/api/quote", args)).json);
    console.log(`      rentals=${rentals ? "BIB2+BALL1" : "-"} -> total ฿${r.structuredContent.quote.totalPrice} (field ${r.structuredContent.quote.fieldPrice} + rental ${r.structuredContent.quote.rentalPrice})`);
  }
});

await check("quote สนามที่ไม่มี -> MCP tool error รหัส INVALID_FIELD (รหัสเดียวกับ API)", async () => {
  const r = await client.callTool({ name: "quote", arguments: { ...slot, fieldId: "Z" } });
  assert.equal(r.isError, true);
  assert.equal(r.structuredContent.error.code, "INVALID_FIELD");
  assert.match(textOf(r), /INVALID_FIELD/);
});

await check("input ผิด schema (date ไม่ใช่ YYYY-MM-DD) -> ถูกปฏิเสธ", async () => {
  const r = await client.callTool({ name: "check_availability", arguments: { date: "10/10/2026" } }).catch((e) => ({ isError: true, content: [{ text: e.message }] }));
  assert.equal(r.isError, true);
});

await check("book ไม่มี confirm / confirm:false -> ปฏิเสธ CONFIRM_REQUIRED และไม่สร้างการจอง", async () => {
  const base = { ...slot, name: "ทดสอบ MCP", phone, consent: true };
  const r1 = await client.callTool({ name: "book", arguments: { ...base, confirm: false } });
  assert.equal(r1.isError, true);
  assert.equal(r1.structuredContent.error.code, "CONFIRM_REQUIRED");
  const r2 = await client.callTool({ name: "book", arguments: base }).catch((e) => ({ isError: true, content: [{ text: e.message }] }));
  assert.equal(r2.isError, true); // ขาด confirm = ผิด schema
  const av = (await web("GET", `/api/availability?date=${DATE}`)).json;
  assert.equal(av.slots.find((s) => s.fieldId === "B" && s.hour === 19).available, true, "ช่วงต้องยังว่าง");
});

await check("book ไม่ติ๊ก consent (confirm:true) -> API ตอบ CONSENT_REQUIRED ผ่านเป็น tool error", async () => {
  const r = await client.callTool({ name: "book", arguments: { ...slot, name: "ทดสอบ MCP", phone, consent: false, confirm: true } });
  assert.equal(r.isError, true);
  assert.equal(r.structuredContent.error.code, "CONSENT_REQUIRED");
});

let code;
await check("book confirm:true บนเว็บ localhost -> ได้ LN-… PENDING_PAYMENT และ API ยืนยันว่ามีจริง", async () => {
  const r = await client.callTool({ name: "book", arguments: { ...slot, name: "ทดสอบ MCP", phone, consent: true, confirm: true } });
  assert.ok(!r.isError, textOf(r));
  code = r.structuredContent.booking.code;
  assert.match(code, /^LN-\d+$/);
  assert.equal(r.structuredContent.paid, false);
  assert.match(r.structuredContent.booking.status, /PENDING_PAYMENT/);
  const d = await web("GET", `/api/bookings/${code}?phone=${phone}`);
  assert.equal(d.status, 200);
  assert.equal(d.json.booking.status, "PENDING_PAYMENT");
  assert.equal(d.json.booking.fieldId, "B");
  const av = (await web("GET", `/api/availability?date=${DATE}`)).json;
  assert.equal(av.slots.find((s) => s.fieldId === "B" && s.hour === 19).available, false, "ช่วงต้องถูกจองแล้ว");
  console.log(`      booking ${code} · amount_paid=${d.json.booking.amountPaid ?? "n/a"} · payUrl=${r.structuredContent.payUrl}`);
});

await check("book ซ้ำช่วงเดิม -> tool error รหัสจาก API (ไม่จองซ้อน)", async () => {
  const r = await client.callTool({ name: "book", arguments: { ...slot, name: "คนที่สอง", phone: "0899990043", consent: true, confirm: true } });
  assert.equal(r.isError, true);
  console.log(`      code=${r.structuredContent.error.code}`);
});

await client.close();

// server ตัวที่สอง: ชี้ไปโฮสต์ที่ไม่ใช่เครื่องนี้ -> book ต้องถูกปฏิเสธก่อนยิงเครือข่ายใด ๆ
const remote = await connect("non-localhost", "http://shop.example.com");
await check("book + confirm:true แต่ FOOTBALL_BASE_URL ไม่ใช่ localhost -> LOCAL_ONLY (ไม่ยิงเครือข่าย)", async () => {
  const r = await remote.client.callTool({ name: "book", arguments: { ...slot, name: "ทดสอบ MCP", phone, consent: true, confirm: true } });
  assert.equal(r.isError, true);
  assert.equal(r.structuredContent.error.code, "LOCAL_ONLY");
  console.log("      " + textOf(r));
});
await check("(อ่านอย่างเดียวบน non-local ยังเรียกได้ แต่ติดต่อไม่ได้ -> WEB_UNREACHABLE ไม่ crash)", async () => {
  const r = await remote.client.callTool({ name: "check_availability", arguments: { date: DATE } });
  assert.equal(r.isError, true);
  assert.ok(["WEB_UNREACHABLE", "BAD_RESPONSE"].some((c) => r.structuredContent.error.code === c) || r.structuredContent.error.code.startsWith("HTTP_"));
});
await remote.client.close();

await web("POST", "/api/test/reset", {});
const back = (await web("GET", `/api/availability?date=${DATE}`)).json;
await check("หลัง reset {} ช่วงที่จองกลับมาว่าง", () => assert.equal(back.slots.find((s) => s.fieldId === "B" && s.hour === 19).available, true));

const failed = results.filter(([, p]) => !p).length;
console.log(`\n${results.length - failed}/${results.length} ผ่าน · wire log: ${path.relative(ROOT, WIRE)} (${fs.readFileSync(WIRE, "utf8").split("\n").length - 2} ข้อความ)`);
process.exit(failed ? 1 : 0);
