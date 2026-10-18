#!/usr/bin/env node
// v2 screenshots (BUILD-PROMPT v2 step 9.6): every new page at 1280 px and 375 px → selfcheck/screens/v2-*.png
// Checks: no console errors · no horizontal scroll · <html data-ready="true"> reached.
//
//   node selfcheck/screens-v2.mjs            (BASE_URL defaults to http://localhost:3000)
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "D:/ms-playwright";
const here = path.dirname(fileURLToPath(import.meta.url));
const tools = path.resolve(here, "../../tools/node_modules/@playwright/test/index.mjs");
const { chromium } = await import(pathToFileURL(tools).href);

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(here, "screens");
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];
let shots = 0;

async function post(ctx, p, data) {
  const r = await ctx.request.post(BASE + p, { data, headers: { "content-type": "application/json" } });
  return { status: r.status(), json: await r.json().catch(() => null) };
}

// deterministic data: reset, a few stock actions, a chat that books, a report download
const setup = await browser.newContext();
await post(setup, "/api/test/reset", {});
await post(setup, "/api/staff/login", { username: "manager", password: "Manager1234" });
await post(setup, "/api/staff/stock/sale", { items: [{ itemId: "WATER", qty: 2 }, { itemId: "ORS", qty: 1 }], method: "CASH" });
await post(setup, "/api/staff/stock/transfer", { itemId: "WATER", qty: 24, fromLocationId: "STORE", toLocationId: "COUNTER" });
await post(setup, "/api/manager/stock/adjust", { itemId: "TOWEL", locationId: "STORE", countedQty: 2, reason: "นับจริง" });
const chat = await browser.newContext();
for (const t of ["อยากจองสนาม B พุธ 14 ต.ค. 10:00 1 ชั่วโมง", "ชื่อ ทดสอบแชท", "เบอร์ 0891234567", "ยินยอมครับ"]) {
  const r = await post(chat, "/api/chat", { text: t });
  const card = r.json?.cards?.find((c) => c.type === "confirm");
  if (card) await post(chat, "/api/chat/book", { draftToken: card.draftToken, consent: true });
}
const chats = (await (await setup.request.get(BASE + "/api/owner/chats")).json()).chats;
const chatId = chats.find((c) => c.bookingCodes.length)?.id ?? chats[0].id;

async function shoot(name, user, url, after, before) {
  for (const width of [1280, 375]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    if (user) await post(ctx, "/api/staff/login", user);
    if (before) await before(ctx);
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + url);
    await page.waitForSelector('html[data-ready="true"]', { timeout: 15000 }).catch(() => problems.push(`${name}@${width}: data-ready never true`));
    if (after) await after(page);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollW > width) problems.push(`${name}@${width}: horizontal scroll (${scrollW}px)`);
    if (errors.length) problems.push(`${name}@${width}: console errors: ${errors.join(" | ").slice(0, 300)}`);
    await page.screenshot({ path: path.join(OUT, `v2-${name}-${width}.png`), fullPage: true });
    shots++;
    await ctx.close();
  }
}

const OWNER = { username: "owner", password: "Owner1234" };
const MANAGER = { username: "manager", password: "Manager1234" };
const STAFF = { username: "staff", password: "Staff1234" };

await shoot("staff-stock", MANAGER, "/staff/stock");
await shoot("staff-stock-sale", STAFF, "/staff/stock/sale");
await shoot("staff-stock-transfer", STAFF, "/staff/stock/transfer");
await shoot("manager-stock", MANAGER, "/manager/stock");
await shoot("manager-stock-staff-forbidden", STAFF, "/manager/stock");
await shoot("owner-dashboard", OWNER, "/owner/dashboard");
await shoot("owner-bookings", MANAGER, "/owner/bookings");
await shoot("owner-booking-history", OWNER, "/owner/bookings/LN-900008");
await shoot("owner-reports", OWNER, "/owner/reports", async (p) => {
  await p.fill('[data-testid="report-from"]', "2026-10-03");
  await p.fill('[data-testid="report-to"]', "2026-10-09");
  await p.click('[data-testid="report-submit"]');
  await p.waitForSelector('[data-testid="report-table"]');
});
await shoot("owner-reports-manager-forbidden", MANAGER, "/owner/reports");
await shoot("owner-chats", OWNER, "/owner/chats");
await shoot("owner-chat-detail", MANAGER, `/owner/chats/${chatId}`);
await shoot("owner-audit", OWNER, "/owner/audit");
await shoot(
  "booking-timeline",
  null,
  "/booking/LN-100001",
  async (p) => {
    await p.waitForSelector('[data-testid="booking-timeline"]', { timeout: 10000 }).catch(() => problems.push("booking-timeline not shown"));
  },
  // the customer opened it with code + phone once (FR-09) → this browser may see it
  async (ctx) => ctx.request.get(BASE + "/api/bookings/LN-100001?phone=0891234567"),
);
await shoot("chat-widget", null, "/book", async (p) => {
  await p.click('[data-testid="chat-open"]');
  await p.fill('[data-testid="chat-input"]', "เสาร์ 10 ต.ค. 18:00 สนาม C ราคาเท่าไร");
  await p.click('[data-testid="chat-send"]');
  await p.waitForSelector('[data-testid="chat-card-quote"]');
  await p.fill('[data-testid="chat-input"]', "อยากจองสนาม A พุธ 14 ต.ค. 9:00 1 ชั่วโมง ชื่อ ลองจอง เบอร์ 0890000077 ยินยอม");
  await p.click('[data-testid="chat-send"]');
  await p.waitForSelector('[data-testid="chat-card-confirm"]');
});

await browser.close();
console.log(`screens: ${shots} · problems: ${problems.length}`);
for (const p of problems) console.log("  - " + p);
process.exit(problems.length ? 1 : 0);
