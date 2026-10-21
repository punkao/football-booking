#!/usr/bin/env node
// server.mjs · MCP server ของ "ลูกหนัง อารีน่า" (Lab 7 · บท 02_MCP/02 · stdio)
// ห่อ API เดิมของเว็บ (ไม่มีกติกาใหม่ในนี้ — ราคา/ช่องว่าง/การจอง ตัดสินที่เว็บทั้งหมด):
//   tool  check_availability {date}                         -> GET  /api/availability?date=
//   tool  quote {fieldId,date,startHour,hours,rentals?}      -> POST /api/quote
//   tool  book  {..., name, phone, consent, confirm}         -> POST /api/bookings   (ไม่ชำระเงิน · ไม่มี tool จ่ายเงิน)
//   resource football://prices                               -> GET  /api/fields     (ตารางราคา)
// env: FOOTBALL_BASE_URL (ค่าเริ่ม http://localhost:3000)
// ความปลอดภัยของ `book`: ต้อง confirm===true และ host ของ FOOTBALL_BASE_URL ต้องเป็น localhost/127.0.0.1/[::1] เท่านั้น
// stdio: ห้ามเขียนอะไรลง stdout นอกจาก JSON-RPC (log ลง stderr)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.FOOTBALL_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function baseHost() {
  try {
    return new URL(BASE).hostname.toLowerCase();
  } catch {
    return "";
  }
}
const isLocalBase = () => LOCAL_HOSTS.has(baseHost());

/** MCP tool error · text = "ERROR <CODE>: <message>" + structuredContent {error:{code,message}} (code เดียวกับ API) */
function toolError(code, message, extra = {}) {
  return {
    isError: true,
    content: [{ type: "text", text: `ERROR ${code}: ${message}` }],
    structuredContent: { error: { code, message, ...extra } },
  };
}

function ok(structured, text) {
  return { content: [{ type: "text", text: text ?? JSON.stringify(structured) }], structuredContent: structured };
}

/** เรียก API เดิมของเว็บ · คืน {res, json} หรือโยน {mcpError} */
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw { mcpError: toolError("WEB_UNREACHABLE", `ติดต่อ ${BASE} ไม่ได้ (เว็บเปิดอยู่ไหม?) / cannot reach the web app: ${e?.cause?.code ?? e?.message}`) };
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw { mcpError: toolError("BAD_RESPONSE", `${method} ${path} -> HTTP ${res.status} ไม่ใช่ JSON`, { status: res.status }) };
  }
  if (!res.ok) {
    const e = json?.error ?? {};
    throw { mcpError: toolError(e.code ?? `HTTP_${res.status}`, e.message ?? `HTTP ${res.status}`, { status: res.status }) };
  }
  return { res, json };
}

const wrap = (fn) => async (args) => {
  try {
    return await fn(args);
  } catch (e) {
    if (e?.mcpError) return e.mcpError;
    return toolError("INTERNAL", String(e?.message ?? e));
  }
};

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const rentalsSchema = z
  .array(z.object({ itemId: z.string().describe("รหัสของเช่า เช่น BIB (เอี๊ยม) · BALL (ลูกบอล) / rental item id"), qty: z.number().int().min(0) }))
  .optional()
  .describe("ของเช่า (ถ้ามี) เช่น [{itemId:'BIB',qty:2}] / optional rentals");
const slotShape = {
  fieldId: z.string().describe("รหัสสนาม A | B | C / field id"),
  date: dateStr.describe("วันที่เล่น รูปแบบ YYYY-MM-DD (ปีค.ศ.) / play date"),
  startHour: z.number().int().describe("ชั่วโมงเริ่ม 0-23 เช่น 18 = 18:00 / start hour"),
  hours: z.number().int().describe("จำนวนชั่วโมงที่เล่น / number of hours"),
  rentals: rentalsSchema,
};

const server = new McpServer(
  { name: "football", version: "1.0.0" },
  {
    instructions:
      "ลูกหนัง อารีน่า: ดูช่วงว่าง (check_availability) · คำนวณราคา (quote) · จองสนาม (book — ต้อง confirm:true และใช้ได้เฉพาะเว็บบนเครื่องนี้) / " +
      "football-field booking tools. Prices and rules come from the web API only. book never pays: a booking stays PENDING_PAYMENT until paid on the website.",
  },
);

server.registerTool(
  "check_availability",
  {
    title: "ดูช่วงเวลาว่างของสนาม",
    description:
      "ดูว่าวันที่กำหนดสนามไหน ชั่วโมงไหนว่าง พร้อมราคาต่อชั่วโมง (อ่านอย่างเดียว ไม่สร้างการจอง) / " +
      "List free hourly slots per field (A, B, C) with price per hour for a date. Read-only. " +
      "date = YYYY-MM-DD (ค.ศ.). วันที่เกินช่วงจองได้จะไม่มีช่องว่าง ดู maxDate ในผล.",
    inputSchema: { date: dateStr.describe("วันที่ YYYY-MM-DD (ค.ศ.) / date") },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  wrap(async ({ date }) => {
    const { json } = await api("GET", `/api/availability?date=${encodeURIComponent(date)}`);
    const fields = json.fields.map((f) => {
      const free = json.slots.filter((s) => s.fieldId === f.id && s.available).map((s) => ({ hour: s.hour, price: s.price }));
      return { id: f.id, name: f.name, size: f.size, covered: f.covered, freeSlots: free };
    });
    const out = {
      date: json.date,
      today: json.today,
      maxDate: json.maxDate,
      isHoliday: json.isHoliday,
      holidayName: json.holidayName,
      fields,
    };
    const lines = fields.map(
      (f) => `${f.name} (${f.size} คน${f.covered ? " มีหลังคา" : ""}): ` + (f.freeSlots.length ? f.freeSlots.map((s) => `${s.hour}:00=฿${s.price}`).join(", ") : "ไม่มีช่วงว่าง"),
    );
    return ok(out, `วันที่ ${out.date}${out.isHoliday ? ` (วันหยุด ${out.holidayName})` : ""} · จองได้ถึง ${out.maxDate}\n${lines.join("\n")}`);
  }),
);

server.registerTool(
  "quote",
  {
    title: "คำนวณราคา",
    description:
      "คำนวณราคาการจอง (ค่าสนามรายชั่วโมง + ของเช่า + มัดจำ/จ่ายเต็ม) โดยไม่สร้างการจอง คืนผลเดียวกับ POST /api/quote ทุกตัวเลข / " +
      "Price a booking without creating it. Returns exactly what POST /api/quote returns. Read-only.",
    inputSchema: slotShape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  wrap(async ({ fieldId, date, startHour, hours, rentals }) => {
    const { json } = await api("POST", "/api/quote", { fieldId, date, startHour, hours, ...(rentals ? { rentals } : {}) });
    const q = json.quote;
    return ok(json, `${q.fieldId} ${q.date} ${q.startHour}:00 x${q.hours}ชม. · ค่าสนาม ฿${q.fieldPrice} + ของเช่า ฿${q.rentalPrice} = ฿${q.totalPrice} · แผน ${q.paymentPlan} จ่ายตอนจอง ฿${q.payNow} · จ่ายที่สนาม ฿${q.dueAtField}\n` + JSON.stringify(json));
  }),
);

server.registerTool(
  "book",
  {
    title: "จองสนาม (ไม่ชำระเงิน)",
    description:
      "สร้างการจอง (สถานะ PENDING_PAYMENT) ผ่าน POST /api/bookings · ไม่ชำระเงินและไม่มี tool จ่ายเงิน ลูกค้าต้องจ่ายเองที่หน้าเว็บ /pay/<code> / " +
      "Create a booking (stays PENDING_PAYMENT; this server never pays). SAFETY: refused unless confirm===true AND FOOTBALL_BASE_URL host is localhost/127.0.0.1. " +
      "ต้องได้ยืนยันจากผู้ใช้ก่อนส่ง confirm:true · consent:true = ลูกค้ายอมรับเงื่อนไข PDPA.",
    inputSchema: {
      ...slotShape,
      name: z.string().describe("ชื่อผู้จอง / customer name"),
      phone: z.string().describe("เบอร์โทร 10 หลัก เช่น 0812345678 / phone"),
      consent: z.boolean().describe("ลูกค้ายินยอมเก็บข้อมูล (ต้อง true ไม่งั้น API ตอบ CONSENT_REQUIRED) / PDPA consent"),
      confirm: z.boolean().describe("ผู้ใช้ยืนยันให้จองจริงแล้ว ต้องเป็น true เท่านั้น / explicit user confirmation, must be true"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  wrap(async ({ confirm, fieldId, date, startHour, hours, rentals, name, phone, consent }) => {
    if (confirm !== true) {
      return toolError("CONFIRM_REQUIRED", "ปฏิเสธ: ต้องส่ง confirm:true หลังผู้ใช้ยืนยันการจองแล้ว / refused: confirm must be true");
    }
    if (!isLocalBase()) {
      return toolError("LOCAL_ONLY", `ปฏิเสธ: book ใช้ได้เฉพาะเว็บบนเครื่องนี้ (localhost/127.0.0.1) แต่ FOOTBALL_BASE_URL host = "${baseHost() || BASE}" / refused: non-local base URL`);
    }
    const { json } = await api("POST", "/api/bookings", { fieldId, date, startHour, hours, ...(rentals ? { rentals } : {}), name, phone, consent });
    const b = json.booking;
    const out = { booking: b, next: json.next, payUrl: BASE + json.next, paid: false };
    return ok(out, `จองแล้ว ${b.code} สถานะ ${b.status} · ยังไม่ชำระเงิน (server นี้ไม่จ่ายเงิน) · ชำระที่ ${out.payUrl}\n` + JSON.stringify(out));
  }),
);

server.registerResource(
  "prices",
  "football://prices",
  {
    title: "ตารางราคาสนาม",
    description: "ราคาต่อชั่วโมงของสนามทุกสนาม (กลางวัน/เย็น + วันมีผลของราคาใหม่) จาก GET /api/fields / price table per field",
    mimeType: "application/json",
  },
  async (uri) => {
    const { json } = await api("GET", "/api/fields");
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(json, null, 2) }] };
  },
);

await server.connect(new StdioServerTransport());
console.error(`[football-mcp] ready · base=${BASE} · book=${isLocalBase() ? "allowed (local)" : "BLOCKED (non-local base)"}`);
