#!/usr/bin/env node
// Screenshots of the main pages at 1280 px and 375 px (BUILD-PROMPT step 7.4) with Playwright from ../tools.
// Also checks: no console errors, no horizontal scroll at 375 px, EN mode without Thai text on customer pages.
//
//   node selfcheck/screens.mjs            (BASE_URL defaults to http://localhost:3000)
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

// The default browser path under the Windows user folder contains a space and breaks Chrome launch.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "D:/ms-playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const tools = path.resolve(here, "../../tools/node_modules/@playwright/test/index.mjs");
const { chromium } = await import(pathToFileURL(tools).href);

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(here, "screens");
await mkdir(OUT, { recursive: true });

const NOW = "2026-10-09T10:00:00+07:00";
const browser = await chromium.launch();
const problems = [];

async function api(ctx, method, p, data) {
  const r = await ctx.request.fetch(BASE + p, { method, data, headers: { "content-type": "application/json" } });
  return { status: r.status(), json: await r.json().catch(() => null) };
}

// ---- deterministic data ----
const setup = await browser.newContext();
await api(setup, "POST", "/api/test/reset", { now: NOW });

async function makeContext(lang, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 812 : 900 }, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: "lang", value: lang, url: BASE }]);
  return ctx;
}

const pages = [
  { name: "home", url: "/", who: "guest", customer: true },
  { name: "book", url: "/book", who: "guest", customer: true },
  { name: "book-new", url: "/book/new?field=A&date=2026-10-14&start=19", who: "member", customer: true },
  { name: "pay", url: "/pay/{pending}", who: "creator", customer: true },
  { name: "booking", url: "/booking/LN-900001", who: "member", customer: true },
  { name: "my", url: "/my", who: "member", customer: true },
  { name: "series", url: "/series", who: "member", customer: true },
  { name: "challenges", url: "/challenges", who: "guest", customer: true },
  { name: "staff", url: "/staff?code=LN-900001", who: "owner", customer: false },
  { name: "staff-today", url: "/staff/today", who: "owner", customer: false },
  { name: "owner", url: "/owner", who: "owner", customer: false },
];

// names typed by users are allowed to be Thai in EN mode (NFR-03 exception)
const USER_TEXT = ["ต้น", "มิว", "โจ้", "แนน", "คุณเอก", "คุณฝ้าย", "น้องบอล", "ทีมต้น", "วันคล้ายวันสวรรคต รัชกาลที่ 9", "วันปิยมหาราช", "วันพ่อแห่งชาติ", "วันรัฐธรรมนูญ", "วันสิ้นปี"];

let pendingCode = null;
let creatorRun = 0;
const summary = [];
for (const lang of ["th", "en"]) {
  for (const width of [1280, 375]) {
    if (lang === "en" && width === 1280) continue; // EN checked at 375 only (text check)
    for (const pg of pages) {
      const ctx = await makeContext(lang, width);
      if (pg.who === "member") {
        await api(ctx, "POST", "/api/customers/login", { phone: "0811111111", password: "Ton12345" });
      } else if (pg.who === "owner") {
        await api(ctx, "POST", "/api/staff/login", { username: "owner", password: "Owner1234" });
      } else if (pg.who === "creator") {
        const r = await api(ctx, "POST", "/api/bookings", { fieldId: "B", date: "2026-10-14", startHour: 9 + creatorRun++ * 2, hours: 2, name: "Screen", phone: "0890000000", consent: true, rentals: { BIB: 2 } });
        pendingCode = r.json?.booking?.code;
      }
      if (pg.name === "challenges" && lang === "th" && width === 1280) {
        const owner = await browser.newContext();
        await api(owner, "POST", "/api/customers/login", { phone: "0811111111", password: "Ton12345" });
        await api(owner, "POST", "/api/challenges", { code: "LN-900001", teamName: "ทีมต้น", level: "INTERMEDIATE" });
        await owner.close();
      }
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(String(e)));
      const url = pg.url.replace("{pending}", pendingCode ?? "LN-100001");
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      await page.waitForSelector('html[data-ready="true"]', { timeout: 15000 }).catch(() => errors.push("data-ready never became true"));
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const file = `${pg.name}-${lang}-${width}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      let thai = [];
      if (lang === "en" && pg.customer) {
        let text = await page.evaluate(() => document.body.innerText);
        for (const u of [...USER_TEXT].sort((a, b) => b.length - a.length)) text = text.split(u).join("");
        thai = [...new Set(text.split(/\n/).filter((l) => /[\u0E00-\u0E7F]/.test(l)))];
      }
      const row = { page: pg.name, lang, width, consoleErrors: errors.length, overflowPx: Math.max(0, overflow), thaiLinesInEn: thai.length };
      summary.push(row);
      if (errors.length) problems.push(`${file}: console errors: ${errors.join(" | ")}`);
      if (width === 375 && overflow > 0) problems.push(`${file}: horizontal overflow ${overflow}px`);
      if (thai.length) problems.push(`${file}: Thai text in EN mode: ${thai.slice(0, 5).join(" / ")}`);
      await ctx.close();
    }
  }
}
await setup.close();
await browser.close();

console.table(summary);
if (problems.length) {
  console.log("PROBLEMS:\n" + problems.join("\n"));
  process.exit(1);
}
console.log(`OK — ${summary.length} screenshots in ${OUT}; no console errors, no horizontal scroll at 375 px, no Thai text in EN customer pages`);
