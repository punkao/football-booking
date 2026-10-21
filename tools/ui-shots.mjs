// ถ่ายภาพหน้าหลักทุกหน้า (desktop 1280x800 + mobile 375x812 × ไทย/อังกฤษ) เพื่อเทียบก่อน/หลังรีดีไซน์ UX/UI
// ใช้: node tools/ui-shots.mjs --out docs/ui/before   (รอบหลังแก้: --out docs/ui/after)
// ตัวเลือก: --base http://localhost:3000 · --only home,fields (กรองตามชื่อหน้า) · --viewport-only (ถ่ายเฉพาะความสูงจอ ไม่เต็มหน้า)
// ต้องรันเว็บอยู่ + ALLOW_TEST_RESET=1 · จะ reset ข้อมูลก่อนถ่าย (ล็อกเวลา ศ 9 ต.ค. 2569 10:00) และ reset อีกครั้งตอนจบ
// รหัสผ่านอ่านจาก docs/TEST-DATA.md ตอนรัน (ไม่ฝังในไฟล์นี้ ไม่พิมพ์ลงผลลัพธ์)
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("D:/ms-playwright")) process.env.PLAYWRIGHT_BROWSERS_PATH = "D:/ms-playwright";
const require = createRequire(join(here, "package.json"));
let pw;
try { pw = require("playwright"); } catch { pw = createRequire(join(root, "e2e", "package.json"))("playwright"); }
const { chromium, request } = pw;

// ---- args
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = resolve(root, arg("--out", "docs/ui/before"));
const BASE = arg("--base", "http://localhost:3000");
const ONLY = arg("--only", "") ? arg("--only", "").split(",") : null;
const VIEWPORT_ONLY = argv.includes("--viewport-only");
mkdirSync(OUT, { recursive: true });

// ---- credentials from docs/TEST-DATA.md (never printed)
const td = readFileSync(join(root, "docs", "TEST-DATA.md"), "utf8");
const staffCred = (u) => { const m = td.match(new RegExp("\\|\\s*" + u + "\\s*\\|\\s*(\\S+)\\s*\\|")); if (!m) throw new Error("no cred for " + u); return { username: u, password: m[1] }; };
const memberCred = (phone) => { const m = td.match(new RegExp("\\|\\s*" + phone + "\\s*\\|\\s*(\\S+)\\s*\\|")); if (!m) throw new Error("no cred for " + phone); return { phone, password: m[1] }; };
const CREDS = { owner: staffCred("owner"), manager: staffCred("manager"), staff: staffCred("staff"), member: memberCred("0811111111") };

const DATE = "2026-10-14"; // พุธ (ไม่ใช่วันหยุด) — ระบบล็อกวันนี้ = ศ 9 ต.ค. 2569
const LANGS = ["th", "en"];
const SIZES = [{ w: 1280, h: 800 }, { w: 375, h: 812 }];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(api, path, data) { return api.post(path, { data, headers: { "content-type": "application/json" } }); }

// ---- pages: n = ลำดับ, name = ชื่อไฟล์, role = anon|member|staff|manager|owner
const PAGES = [
  { n: "01", name: "home", route: "/", role: "anon" },
  { n: "02", name: "fields", route: "/fields", role: "anon" },
  { n: "03", name: "book", route: "/book", role: "anon" },
  { n: "04", name: "book-new-empty", route: "/book/new", role: "anon" },
  { n: "05", name: "book-new-slot", route: `/book/new?field=A&date=${DATE}&start=17`, role: "anon", prep: "bookNewFilled" },
  { n: "06", name: "booking", route: "/booking/{code}", role: "anon" },
  { n: "07", name: "pay", route: "/pay/{code}", role: "anon" },
  { n: "08", name: "my", route: "/my", role: "member" },
  { n: "09", name: "challenges", route: "/challenges", role: "anon" },
  { n: "10", name: "series", route: "/series", role: "member" },
  { n: "11", name: "chat-open", route: "/", role: "anon", prep: "chat" },
  { n: "12", name: "staff", route: "/staff", role: "staff", prep: "staffLookup" },
  { n: "13", name: "staff-today", route: "/staff/today", role: "manager" },
  { n: "14", name: "manager-stock", route: "/manager/stock", role: "manager" },
  { n: "15", name: "owner", route: "/owner", role: "owner" },
  { n: "19", name: "owner-dashboard", route: "/owner/dashboard", role: "owner" },
  { n: "16", name: "owner-bookings", route: "/owner/bookings", role: "owner" },
  { n: "17", name: "owner-reports", route: "/owner/reports", role: "owner", prep: "report" },
  { n: "18", name: "project", route: "/project", role: "anon" },
];

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => document.documentElement.getAttribute("data-ready") === "true", null, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await sleep(400);
}

const preps = {
  async bookNewFilled(page) {
    await page.getByTestId("customer-name").fill("แนน ทดลอง").catch(() => {});
    await page.getByTestId("customer-phone").fill("0844444444").catch(() => {});
    await sleep(500);
  },
  async chat(page, ctx) {
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").waitFor({ timeout: 8000 });
    await page.getByTestId("chat-input").fill(ctx.lang === "en" ? "How much is field A?" : "ราคาสนาม A");
    await page.getByTestId("chat-send").click();
    await page.getByTestId("chat-msg-bot").first().waitFor({ timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector('[data-testid="chat-widget"]')?.getAttribute("data-chat-state") === "idle", null, { timeout: 20000 }).catch(() => {});
    await sleep(500);
  },
  async report(page) {
    await page.getByTestId("report-from").fill("2026-09-25");
    await page.getByTestId("report-to").fill("2026-10-09");
    await page.getByTestId("report-submit").click();
    await page.getByTestId("report-table").waitFor({ timeout: 10000 }).catch(() => {});
    await sleep(500);
  },
  async staffLookup(page, ctx) {
    await page.getByTestId("staff-search-code").fill(ctx.code);
    await page.getByTestId("staff-search-submit").click();
    await page.getByTestId("staff-booking-code").waitFor({ timeout: 10000 }).catch(() => {});
    await sleep(500);
  },
};

async function login(context, role) {
  if (role === "anon") return;
  const c = CREDS[role];
  const path = role === "member" ? "/api/customers/login" : "/api/staff/login";
  const r = await post(context.request, path, c);
  if (!r.ok()) throw new Error(`login ${role} failed: ${r.status()}`);
}

const main = async () => {
  const api = await request.newContext({ baseURL: BASE });
  const rs = await post(api, "/api/test/reset", {});
  if (!rs.ok()) throw new Error("reset failed " + rs.status() + " (ต้องเปิด ALLOW_TEST_RESET=1)");
  // booking ตัวอย่างสำหรับหน้า /booking, /pay, /staff (สร้างผ่าน API ครั้งเดียว แล้วแจก cookie ln_access ให้ทุก context)
  const cb = await post(api, "/api/bookings", { name: "แนน ทดลอง", phone: "0844444444", fieldId: "B", date: DATE, startHour: 19, hours: 1, consent: true });
  if (!cb.ok()) throw new Error("create booking failed " + cb.status());
  const code = (await cb.json()).booking.code;
  const access = (await api.storageState()).cookies.find((c) => c.name === "ln_access");
  await api.dispose();

  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const lang of LANGS) {
    for (const size of SIZES) {
      const contexts = {};
      const getCtx = async (role) => {
        if (contexts[role]) return contexts[role];
        const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, baseURL: BASE, locale: lang === "en" ? "en-US" : "th-TH", deviceScaleFactor: 1, isMobile: false });
        await context.addCookies([{ name: "lang", value: lang, url: BASE }, ...(access ? [{ name: access.name, value: access.value, url: BASE }] : [])]);
        await login(context, role);
        contexts[role] = context;
        return context;
      };
      for (const p of PAGES) {
        if (ONLY && !ONLY.includes(p.name)) continue;
        const context = await getCtx(p.role);
        const page = await context.newPage();
        const route = p.route.replace("{code}", code);
        const file = `${p.n}-${p.name}-${lang}-${size.w}.png`;
        const rec = { n: p.n, page: p.name, route: p.route, role: p.role, lang, width: size.w, file, hscroll: null, scrollWidth: null, status: null, error: null };
        try {
          const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
          rec.status = resp?.status() ?? null;
          await settle(page);
          if (p.prep) await preps[p.prep](page, { lang, code });
          await page.evaluate(() => window.scrollTo(0, 0));
          await sleep(200);
          const m = await page.evaluate((w) => {
            const out = [];
            for (const el of document.querySelectorAll("body *")) {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0 || getComputedStyle(el).position === "fixed") continue;
              if (r.right > w + 1) out.push((el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : "")) + ":" + Math.round(r.right));
            }
            return { sw: document.documentElement.scrollWidth, bsw: document.body.scrollWidth, over: out.slice(0, 5) };
          }, size.w);
          rec.scrollWidth = Math.max(m.sw, m.bsw);
          rec.overflowEls = m.over;
          rec.hscroll = rec.scrollWidth > size.w;
          await page.screenshot({ path: join(OUT, file), fullPage: !VIEWPORT_ONLY });
        } catch (e) {
          rec.error = String(e.message || e).split("\n")[0];
          await page.screenshot({ path: join(OUT, file), fullPage: false }).catch(() => {});
        }
        results.push(rec);
        console.log(`${file} status=${rec.status} sw=${rec.scrollWidth}${rec.hscroll ? " HSCROLL" : ""}${rec.overflowEls?.length ? " OVER[" + rec.overflowEls.join(",") + "]" : ""}${rec.error ? " ERR " + rec.error : ""}`);
        await page.close();
      }
      for (const c of Object.values(contexts)) await c.close();
    }
  }
  await browser.close();

  const api2 = await request.newContext({ baseURL: BASE });
  await post(api2, "/api/test/reset", {});
  await api2.dispose();

  writeFileSync(join(OUT, "shots.json"), JSON.stringify({ base: BASE, date: DATE, bookingCode: code, results }, null, 2));
  const files = readdirSync(OUT).filter((f) => f.endsWith(".png"));
  const bytes = files.reduce((s, f) => s + statSync(join(OUT, f)).size, 0);
  console.log(`\nshots=${files.length} size=${(bytes / 1048576).toFixed(1)}MB hscroll@375: ${results.filter((r) => r.width === 375 && r.hscroll).map((r) => r.page + "-" + r.lang).join(", ") || "none"}`);
};
main().catch((e) => { console.error(e); process.exit(1); });
