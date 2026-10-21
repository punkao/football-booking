// สแนปช็อต "สัญญา" ของหน้าเว็บสำหรับงานรีดีไซน์ UX/UI (docs/UI-REDESIGN.md §5)
// เปิดหน้า/บทบาท/ภาษา/ขนาดจอชุดเดียวกับ tools/ui-shots.mjs (+ สถานะเพิ่ม เช่น ฟอร์มจองที่ส่งว่าง) แล้วเก็บ
//   · ทุก data-testid  (มีกี่ตัว · เห็นไหม · tag · ข้อความ · data-* / aria-pressed / aria-current …)
//   · แอตทริบิวต์ราก <html> (lang, data-ready, data-bug-mode)
//   · วลี/ตัวเลขที่ e2e/tests/** ตรวจด้วย toHaveText/toContainText/getByText + รายการข้อความคงเดิมตาม §5.1 ข้อ 4 ว่า "โผล่ในหน้านี้ไหม"
//   · testid ที่เทสต์อ้างแต่สแนปช็อตไม่เคยเจอ (coverage)
// ใช้:
//   node tools/testid-snapshot.mjs                                   → เขียน docs/ui/testid-before.json (ก่อนแก้ UI)
//   node tools/testid-snapshot.mjs --out docs/ui/testid-after.json
//   node tools/testid-snapshot.mjs --compare docs/ui/testid-before.json   → สแนปใหม่ในหน่วยความจำ แล้วเทียบ · exit 1 ถ้าขาด
// กฎเทียบ (ต้องเป็นสับเซ็ต: เพิ่มได้ ลด/เปลี่ยนไม่ได้):
//   FAIL  testid ที่เคยมีหายไป · ค่า data-*/aria-* ของ testid เดิมเปลี่ยน · วลีที่เทสต์ตรวจหายจากหน้าเดิม · หน้าที่เคยโหลดได้กลับโหลดไม่ได้
//   FAIL  testid ที่เคยเห็นกลับมองไม่เห็นที่ 1280 (เทสต์รันที่ 1280) · ที่ 375 ให้เตือนเฉย ๆ (เมนูพับได้)
//   WARN  ข้อความ (innerText) ของ testid เปลี่ยน · จำนวนตัวซ้ำเปลี่ยน
// ตัวเลือก: --base http://localhost:3000 · --only home,book (กรองชื่อสถานะ) · --quiet
// ต้องรันเว็บอยู่ + ALLOW_TEST_RESET=1 · reset ข้อมูลก่อนเก็บ (ล็อกเวลา ศ 9 ต.ค. 2569 10:00) และ reset อีกครั้งตอนจบ
// รหัสผ่านอ่านจาก docs/TEST-DATA.md ตอนรัน (ไม่ฝังในไฟล์นี้ ไม่พิมพ์ลงผลลัพธ์)
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
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
const BASE = arg("--base", "http://localhost:3000");
const ONLY = arg("--only", "") ? arg("--only", "").split(",") : null;
const COMPARE = arg("--compare", null);
const OUT = resolve(root, arg("--out", "docs/ui/testid-before.json"));
const QUIET = argv.includes("--quiet");

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

// ---- pages: เหมือน ui-shots.mjs (n 01–19) + สถานะเพิ่ม (n 20+) ที่ให้ testid ของข้อความผิดพลาด/สมาชิก/หลังบ้านเพิ่มเติมโผล่
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
  // ---- สถานะเพิ่ม
  { n: "20", name: "book-chip2", route: "/book", role: "anon", prep: "bookChip2" },
  { n: "21", name: "book-new-errors", route: `/book/new?field=A&date=${DATE}&start=17`, role: "anon", prep: "bookNewSubmitEmpty" },
  { n: "22", name: "book-new-member", route: `/book/new?field=A&date=${DATE}&start=17`, role: "member" },
  { n: "23", name: "staff-login", route: "/staff/login", role: "anon" },
  { n: "24", name: "staff-stock", route: "/staff/stock", role: "manager" },
  { n: "25", name: "staff-stock-sale", route: "/staff/stock/sale", role: "staff" },
  { n: "26", name: "staff-stock-transfer", route: "/staff/stock/transfer", role: "manager" },
  { n: "27", name: "owner-audit", route: "/owner/audit", role: "owner" },
  { n: "28", name: "owner-chats", route: "/owner/chats", role: "owner" },
  { n: "29", name: "owner-booking-detail", route: "/owner/bookings/{code}", role: "owner" },
  { n: "30", name: "my-anon", route: "/my", role: "anon" },
  { n: "31", name: "series-anon", route: "/series", role: "anon" },
  { n: "32", name: "pay-paid", route: "/pay/{code2}", role: "anon" },
  { n: "33", name: "booking-paid", route: "/booking/{code2}", role: "anon" },
  { n: "34", name: "booking-paid-cancel", route: "/booking/{code2}", role: "anon", prep: "cancelOpen" },
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
  async bookNewSubmitEmpty(page) {
    await page.getByTestId("book-submit").click({ timeout: 8000 }).catch(() => {});
    await sleep(700);
  },
  async cancelOpen(page) {
    await page.getByTestId("cancel-booking").click({ timeout: 8000 }).catch(() => {});
    await sleep(600);
  },
  async bookChip2(page) {
    await page.locator('[data-testid^="date-chip-"]').nth(1).click({ timeout: 8000 }).catch(() => {});
    await sleep(700);
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

// ---- สัญญา: วลีที่ต้องคงเดิม (§5.1 ข้อ 4) + ข้อความที่ e2e/tests/** ตรวจ (สกัดจากไฟล์เทสต์ตอนรัน)
const CONTRACT_PHRASES = [
  "ช่วงเวลานี้ถูกจองแล้ว", "เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0", "กรุณากรอกชื่อ", "กรุณายินยอมให้เก็บข้อมูลส่วนบุคคล (PDPA)",
  "จองล่วงหน้าได้ไม่เกิน 14 วัน", "การจองต้องจบไม่เกิน 24:00", "ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น", "มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้",
  "ใช้ชั่วโมงฟรีได้เฉพาะรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์", "ยังไม่มีสิทธิ์ชั่วโมงฟรี", "เช็กอินได้เฉพาะวันเตะ", "บันทึกไม่มาแล้ว",
  "ส่งข้อความเร็วเกินไป (ไม่เกิน 20 ข้อความต่อนาที) กรุณารอสักครู่",
];
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "node_modules") walk(p, out); } else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function scanTests() {
  const files = walk(join(root, "e2e", "tests"));
  const phrases = new Set(CONTRACT_PHRASES);
  const idLits = new Set();
  const idPats = new Map(); // regex source -> label
  const reAssert = /(?:toHaveText|toContainText|getByText)\(\s*(['"`])((?:\\.|(?!\1)[^\\\n])+)\1/g;
  const reId = /getByTestId\(\s*(['"`])((?:\\.|(?!\1)[^\\\n])+)\1\s*\)/g;
  const reCss = /\[data-testid(\^|\$|\*)?=\\?["']?([^"'\]\\]+)/g;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    let m;
    while ((m = reAssert.exec(src))) { const s = m[2].replace(/\\(.)/g, "$1"); if (s.length >= 3 && !s.includes("${")) phrases.add(s); }
    while ((m = reId.exec(src))) {
      const s = m[2];
      if (s.includes("${")) idPats.set("^" + s.split(/\$\{[^}]*\}/).map(esc).join(".+") + "$", s);
      else idLits.add(s);
    }
    while ((m = reCss.exec(src))) {
      const op = m[1] || "="; const v = m[2];
      if (v.includes("${")) continue;
      if (op === "^") idPats.set("^" + esc(v), "[data-testid^=" + v + "]");
      else if (op === "$") idPats.set(esc(v) + "$", "[data-testid$=" + v + "]");
      else if (op === "*") idPats.set(esc(v), "[data-testid*=" + v + "]");
      else idLits.add(v);
    }
  }
  return { phrases: [...phrases].sort(), idLits: [...idLits].sort(), idPats: [...idPats.entries()].sort() };
}

async function collect(page, phrases) {
  return page.evaluate((phrases) => {
    const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
    const KEEP = ["aria-pressed", "aria-current", "aria-checked", "aria-invalid", "aria-expanded", "aria-busy"];
    const isVis = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
    };
    const ids = {};
    for (const el of document.querySelectorAll("[data-testid]")) {
      const id = el.getAttribute("data-testid").replace(/[0-9a-f]{32}/g, "{hex32}"); // id แชทสุ่มต่อรอบ
      const attrs = {};
      for (const a of el.attributes) if ((a.name.startsWith("data-") && a.name !== "data-testid") || KEEP.includes(a.name)) attrs[a.name] = a.value;
      const vis = isVis(el);
      const text = norm(vis ? el.innerText : el.textContent).slice(0, 160);
      const cur = ids[id];
      if (!cur) ids[id] = { n: 1, vis, tag: el.tagName.toLowerCase(), text, attrs };
      else { cur.n++; if (!cur.vis && vis) Object.assign(cur, { vis, tag: el.tagName.toLowerCase(), text, attrs }); }
    }
    const root = document.documentElement;
    const body = norm(document.body.innerText);
    return {
      html: { lang: root.getAttribute("lang"), "data-ready": root.getAttribute("data-ready"), "data-bug-mode": root.getAttribute("data-bug-mode") },
      scrollWidth: Math.max(root.scrollWidth, document.body.scrollWidth),
      ids,
      phrases: phrases.filter((p) => body.includes(norm(p))),
    };
  }, phrases);
}

async function snapshot() {
  const tests = scanTests();
  const api = await request.newContext({ baseURL: BASE });
  const rs = await post(api, "/api/test/reset", {});
  if (!rs.ok()) throw new Error("reset failed " + rs.status() + " (ต้องเปิด ALLOW_TEST_RESET=1)");
  const cb = await post(api, "/api/bookings", { name: "แนน ทดลอง", phone: "0844444444", fieldId: "B", date: DATE, startHour: 19, hours: 1, consent: true });
  if (!cb.ok()) throw new Error("create booking failed " + cb.status());
  const code = (await cb.json()).booking.code;
  // การจองที่สอง จ่ายแล้ว (CONFIRMED) → หน้า /pay แสดง pay-already · หน้า /booking แสดงปุ่มยกเลิก/เลื่อน/แบ่งจ่าย/คำท้า
  const cb2 = await post(api, "/api/bookings", { name: "แนน ทดลอง", phone: "0844444444", fieldId: "C", date: DATE, startHour: 20, hours: 1, consent: true });
  if (!cb2.ok()) throw new Error("create booking2 failed " + cb2.status());
  const code2 = (await cb2.json()).booking.code;
  const pr = await post(api, `/api/bookings/${code2}/pay`, { phone: "0844444444" });
  if (!pr.ok()) throw new Error("pay booking2 failed " + pr.status());
  const access = (await api.storageState()).cookies.find((c) => c.name === "ln_access");
  await api.dispose();

  const browser = await chromium.launch({ headless: true });
  const states = {};
  const seen = new Set();
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
        const key = `${p.name}|${lang}|${size.w}`;
        const route = p.route.replace("{code2}", code2).replace("{code}", code);
        const rec = { n: p.n, route: p.route, role: p.role, status: null, error: null };
        try {
          const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
          rec.status = resp?.status() ?? null;
          await settle(page);
          if (p.prep) await preps[p.prep](page, { lang, code, code2 });
          Object.assign(rec, await collect(page, tests.phrases));
          for (const id of Object.keys(rec.ids)) {
            seen.add(id);
            // ปิดบังรหัสจองที่สุ่มต่อรอบ เพื่อให้สแนปสองรอบเท่ากัน
            const mask = (t) => t.split(code).join("{code}").split(code2).join("{code2}");
            rec.ids[id].text = mask(rec.ids[id].text);
            for (const k of Object.keys(rec.ids[id].attrs)) rec.ids[id].attrs[k] = mask(rec.ids[id].attrs[k]);
          }
        } catch (e) {
          rec.error = String(e.message || e).split("\n")[0];
        }
        states[key] = rec;
        if (!QUIET) console.log(`${key.padEnd(34)} status=${rec.status} testids=${rec.ids ? Object.keys(rec.ids).length : 0} sw=${rec.scrollWidth ?? "-"}${rec.error ? " ERR " + rec.error : ""}`);
        await page.close();
      }
      for (const c of Object.values(contexts)) await c.close();
    }
  }
  await browser.close();
  const api2 = await request.newContext({ baseURL: BASE });
  await post(api2, "/api/test/reset", {});
  await api2.dispose();

  // coverage: testid ที่เทสต์อ้าง vs ที่สแนปช็อตเจอ
  const all = [...seen].sort();
  const unseenLits = tests.idLits.filter((x) => !seen.has(x));
  const unseenPats = tests.idPats.filter(([re]) => !all.some((id) => new RegExp(re).test(id))).map(([, t]) => t);
  const sorted = Object.fromEntries(Object.entries(states).sort(([a, x], [b, y]) => (x.n + a).localeCompare(y.n + b)));
  for (const s of Object.values(sorted)) if (s.ids) s.ids = Object.fromEntries(Object.entries(s.ids).sort(([a], [b]) => a.localeCompare(b)));
  return {
    base: BASE, date: DATE,
    summary: {
      states: Object.keys(sorted).length,
      distinctTestids: all.length,
      testsReferenceLiterals: tests.idLits.length,
      testsReferencePatterns: tests.idPats.length,
      assertPhrases: tests.phrases.length,
    },
    coverage: { unseenLiterals: unseenLits, unseenPatterns: unseenPats },
    testids: all,
    states: sorted,
  };
}

// ---- compare
function compare(before, after) {
  const fails = [], warns = [];
  const beforeIds = new Set(before.testids), afterIds = new Set(after.testids);
  const missingGlobal = [...beforeIds].filter((x) => !afterIds.has(x));
  const added = [...afterIds].filter((x) => !beforeIds.has(x));
  for (const id of missingGlobal) fails.push(`testid หาย (ทุกหน้า): ${id}`);
  for (const [key, b] of Object.entries(before.states)) {
    const a = after.states[key];
    if (!a) { fails.push(`[${key}] สถานะนี้ไม่มีในสแนปใหม่`); continue; }
    if (b.error == null && a.error != null) { fails.push(`[${key}] เคยโหลดได้ ตอนนี้ล้ม: ${a.error}`); continue; }
    if (b.error != null) continue;
    if (b.status !== a.status) fails.push(`[${key}] HTTP status ${b.status} → ${a.status}`);
    for (const k of Object.keys(b.html)) if (b.html[k] != null && b.html[k] !== a.html[k]) fails.push(`[${key}] <html ${k}> ${b.html[k]} → ${a.html[k]}`);
    const w = Number(key.split("|")[2]);
    for (const [id, bi] of Object.entries(b.ids)) {
      if (missingGlobal.includes(id)) continue; // รายงานไปแล้ว
      const ai = a.ids[id];
      if (!ai) { fails.push(`[${key}] testid หายจากหน้านี้: ${id}`); continue; }
      for (const [k, v] of Object.entries(bi.attrs)) {
        if (ai.attrs[k] !== v) fails.push(`[${key}] ${id} @${k}: ${JSON.stringify(v)} → ${JSON.stringify(ai.attrs[k] ?? null)}`);
      }
      if (bi.vis && !ai.vis) (w >= 1000 ? fails : warns).push(`[${key}] ${id} เคยมองเห็น ตอนนี้ซ่อน${w >= 1000 ? "" : " (375: เตือน)"}`);
      if (bi.n !== ai.n) warns.push(`[${key}] ${id} จำนวนตัว ${bi.n} → ${ai.n}`);
      if (bi.text !== ai.text) warns.push(`[${key}] ${id} ข้อความ ${JSON.stringify(bi.text.slice(0, 60))} → ${JSON.stringify(ai.text.slice(0, 60))}`);
    }
    for (const p of b.phrases) if (!a.phrases.includes(p)) fails.push(`[${key}] ข้อความที่เทสต์ตรวจหายไป: ${JSON.stringify(p)}`);
  }
  return { fails, warns, added, missingGlobal };
}

const main = async () => {
  const snap = await snapshot();
  const s = snap.summary;
  console.log(`\nสแนปช็อต: ${s.states} สถานะ · testid ไม่ซ้ำ ${s.distinctTestids} · เทสต์อ้าง testid ตรง ${s.testsReferenceLiterals} + รูปแบบ ${s.testsReferencePatterns} · วลีที่เทสต์ตรวจ ${s.assertPhrases}`);
  console.log(`ไม่เคยเจอในสแนป: ตรง ${snap.coverage.unseenLiterals.length} · รูปแบบ ${snap.coverage.unseenPatterns.length}`);
  if (COMPARE) {
    const before = JSON.parse(readFileSync(resolve(root, COMPARE), "utf8"));
    const { fails, warns, added } = compare(before, snap);
    console.log(`\nเทียบกับ ${COMPARE}: testid เดิม ${before.testids.length} → ใหม่ ${snap.testids.length} (เพิ่ม ${added.length})`);
    if (added.length) console.log("  เพิ่ม: " + added.slice(0, 40).join(", ") + (added.length > 40 ? ` … (+${added.length - 40})` : ""));
    if (warns.length) { console.log(`\nWARN ${warns.length} รายการ (ข้อความ/จำนวนตัว/ซ่อนที่ 375 เปลี่ยน — ไม่ทำให้ล้ม)`); for (const w of warns.slice(0, 60)) console.log("  ~ " + w); if (warns.length > 60) console.log(`  … (+${warns.length - 60})`); }
    if (fails.length) { console.log(`\nFAIL ${fails.length} รายการ`); for (const f of fails.slice(0, 200)) console.log("  x " + f); if (fails.length > 200) console.log(`  … (+${fails.length - 200})`); process.exit(1); }
    console.log("\nOK: สับเซ็ต — testid/แอตทริบิวต์/วลีเดิมครบ");
    return;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(snap, null, 1));
  console.log(`เขียน ${OUT}`);
};
main().catch((e) => { console.error(e); process.exit(1); });
