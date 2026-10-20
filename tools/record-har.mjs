#!/usr/bin/env node
// record-har.mjs — เดินเส้นทางหลักของร้านแบบ headless แล้วเก็บ HAR (แผน L2 · บท 05 LAB 3 · ไอเดียจาก rea/record-har.mjs ของบทเรียน)
//
//   node tools/record-har.mjs [--base http://127.0.0.1:3000] [--raw <ไฟล์ HAR ดิบ>] [--out legacy/har/journey.stripped.har]
//
// เส้นทาง (หลัง POST /api/test/reset {} · ตอนนี้ของระบบ = ศ 9 ต.ค. 2569 10:00):
//   01 ลูกค้าดูตาราง → 02 จองสนาม B วันนี้ 18:00 → 03 จ่าย (QR จำลอง) → 04 สมาชิก ต้น เข้าสู่ระบบ /my แล้วออก
//   05 ถามน้องบอลในแชท → 06 พนักงานเข้าสู่ระบบ ค้นรหัส เช็กอิน แล้วออก → 07 เจ้าของเปิดแดชบอร์ด + รายงาน + CSV แล้วออก
// ผลลัพธ์:
//   * HAR ดิบ (มีรหัสผ่าน + cookie จริง) → ค่าเริ่มต้นอยู่ใน os.tmpdir() นอก repo · ถ้าส่ง --raw ใน repo ต้องลงท้าย .raw.har (.gitignore กันไว้)
//   * HAR ที่ตัดความลับแล้ว → legacy/har/journey.stripped.har (cookie / set-cookie / authorization / รหัสผ่าน / draftToken / split token → "REDACTED")
//   * legacy/har/har-steps.json เวลาแต่ละขั้น
// รหัสผ่านของบัญชีทดสอบอ่านจาก seed ที่ร้านยืนยัน (web/SPEC.md ส่วน 1) ผ่าน env ได้: TON_PW / STAFF_PW / OWNER_PW
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "D:/ms-playwright";
const require = createRequire(join(HERE, "package.json"));
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
// 127.0.0.1 (not localhost): on Windows localhost may resolve to [::1] and REA rejects that HAR (lesson 05 LAB 3)
const BASE = opt("--base", "http://127.0.0.1:3000").replace(/\/+$/, "").replace("//localhost", "//127.0.0.1");
const RAW = resolve(opt("--raw", join(tmpdir(), "football-journey.raw.har")));
const OUT = resolve(ROOT, opt("--out", "legacy/har/journey.stripped.har"));
if (RAW.startsWith(ROOT) && !RAW.endsWith(".raw.har")) throw new Error("a raw HAR inside the repo must end with .raw.har (git-ignored)");
const PW = { ton: process.env.TON_PW ?? "Ton12345", staff: process.env.STAFF_PW ?? "Staff1234", owner: process.env.OWNER_PW ?? "Owner1234" };
mkdirSync(dirname(OUT), { recursive: true });

const r = await fetch(`${BASE}/api/test/reset`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
if (!r.ok) throw new Error(`reset failed ${r.status} (ALLOW_TEST_RESET=1 ?)`);

const steps = [];
const t0 = Date.now();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL: BASE,
  acceptDownloads: true,
  locale: "th-TH",
  recordHar: { path: RAW, content: "embed", mode: "full", urlFilter: /^(?!.*(\.(woff2?|png|jpe?g|svg|ico|webp|css)(\?|$)|\/_next\/image)).*$/ },
});
const page = await context.newPage();
const ready = () => page.locator('html[data-ready="true"]').waitFor({ timeout: 15000 });
async function step(name, fn) {
  const s = Date.now();
  try {
    await fn();
  } catch (e) {
    console.error(`✗ ${name}: ${e?.message ?? e}`);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    process.exit(1);
  }
  steps.push({ step: name, ms: Date.now() - s, url: page.url().replace(BASE, "") });
  console.log(`✓ ${name} (${Date.now() - s} ms) ${page.url().replace(BASE, "")}`);
}

let code = "";
await step("01 customer: availability /book", async () => {
  await page.goto("/book?date=2026-10-09");
  await ready();
  await page.getByTestId("slot-B-18").waitFor();
});
await step("02 customer: book B 9 Oct 18:00", async () => {
  await page.goto("/book/new?field=B&date=2026-10-09&start=18");
  await ready();
  await page.getByTestId("price-total").waitFor();
  await page.getByTestId("customer-name").fill("ลูกค้า HAR");
  await page.getByTestId("customer-phone").fill("0891234567");
  await page.getByTestId("pdpa-consent").check();
  await page.getByTestId("book-submit").click();
  await page.waitForURL(/\/pay\//);
  code = decodeURIComponent(page.url().split("/pay/")[1].split("?")[0]);
});
await step("03 customer: pay", async () => {
  await ready();
  await page.getByTestId("pay-confirm").click();
  await page.waitForURL(/\/booking\/.*done=paid/);
  await ready();
});
await step("04 member: /my login → logout", async () => {
  await page.goto("/my");
  await ready();
  await page.getByTestId("login-phone").fill("0811111111");
  await page.getByTestId("login-password").fill(PW.ton);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("credit-balance").waitFor();
  await page.getByTestId("logout").click();
  await page.getByTestId("login-submit").waitFor();
});
await step("05 customer: chat with Nong Ball", async () => {
  await page.goto("/");
  await ready();
  await page.getByTestId("chat-open").click();
  await page.getByTestId("chat-input").fill("พรุ่งนี้ 19:00 สนาม A ว่างไหม");
  const answered = page.waitForResponse((x) => x.url().endsWith("/api/chat") && x.request().method() === "POST");
  await page.getByTestId("chat-send").click();
  await answered;
  await page.getByTestId("chat-msg-bot").last().waitFor();
});
await step("06 staff: login → search → check-in → logout", async () => {
  await page.goto("/staff/login");
  await ready();
  await page.getByTestId("staff-username").fill("staff");
  await page.getByTestId("staff-password").fill(PW.staff);
  await page.getByTestId("staff-login-submit").click();
  await page.waitForURL((u) => u.pathname === "/staff");
  await ready();
  await page.getByTestId("staff-search-code").fill(code);
  await page.getByTestId("staff-search-submit").click();
  await page.getByTestId("staff-booking-code").waitFor();
  await page.getByTestId("staff-checkin").click();
  await page.locator('[data-testid="staff-booking-status"][data-value="CHECKED_IN"]').waitFor();
  await page.getByTestId("staff-logout").click();
  await page.waitForURL(/\/staff\/login/);
});
await step("07 owner: dashboard → report → CSV → logout", async () => {
  await page.getByTestId("staff-username").fill("owner");
  await page.getByTestId("staff-password").fill(PW.owner);
  await page.getByTestId("staff-login-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith("/owner"));
  await page.goto("/owner/dashboard");
  await ready();
  await page.goto("/owner/reports");
  await ready();
  await page.getByTestId("report-from").fill("2026-10-01");
  await page.getByTestId("report-to").fill("2026-10-09");
  await page.getByTestId("report-submit").click();
  await page.getByTestId("report-table").waitFor();
  const dl = page.waitForEvent("download");
  await page.getByTestId("report-csv").click();
  await (await dl).path();
  await page.goto("/staff/login");
  await ready();
  await page.getByTestId("staff-logout").click();
  await page.getByTestId("staff-username").waitFor();
});
await context.close(); // HAR is written on close
await browser.close();

// ---------- strip secrets ----------
const SECRET_KEYS = /^(password|draftToken|token|sessionId)$/i;
const SECRET_VALUES = [PW.ton, PW.staff, PW.owner];
const har = JSON.parse(readFileSync(RAW, "utf8"));
let redacted = 0;
const red = () => (redacted++, "REDACTED");
const scrubJson = (txt) => {
  try {
    const walk = (v) => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET_KEYS.test(k) && typeof x === "string" ? red() : walk(x)]));
      return v;
    };
    return JSON.stringify(walk(JSON.parse(txt)));
  } catch {
    return txt;
  }
};
const scrubText = (s) => {
  let o = s;
  for (const v of SECRET_VALUES) if (v && o.includes(v)) o = o.split(v).join(red());
  // split links /split/<token> and signed cookie values that leak into bodies
  o = o.replace(/(\/split\/)[A-Za-z0-9_-]{8,}/g, (_, p) => p + red());
  return o;
};
const scrubHeaders = (hs) =>
  hs.map((h) =>
    /^(cookie|set-cookie|authorization)$/i.test(h.name)
      ? { ...h, value: h.name.toLowerCase() === "set-cookie" ? h.value.replace(/^([^=]+)=[^;]*/, (_, n) => `${n}=${red()}`) : red() }
      : h,
  );
for (const e of har.log.entries) {
  e.request.headers = scrubHeaders(e.request.headers);
  e.response.headers = scrubHeaders(e.response.headers);
  e.request.cookies = (e.request.cookies ?? []).map((c) => ({ ...c, value: red() }));
  e.response.cookies = (e.response.cookies ?? []).map((c) => ({ ...c, value: red() }));
  e.request.url = scrubText(e.request.url);
  if (e.request.postData?.text) e.request.postData.text = scrubText(scrubJson(e.request.postData.text));
  if (e.response.content?.text && !e.response.content.encoding) e.response.content.text = scrubText(scrubJson(e.response.content.text));
  if (e.response.redirectURL) e.response.redirectURL = scrubText(e.response.redirectURL);
}
const stripped = JSON.stringify(har, null, 1);
for (const v of SECRET_VALUES) if (stripped.includes(v)) throw new Error("a password survived stripping");
writeFileSync(OUT, stripped, "utf8");
writeFileSync(join(dirname(OUT), "har-steps.json"), JSON.stringify({ base: BASE, booking: code, totalMs: Date.now() - t0, redacted, entries: har.log.entries.length, steps }, null, 2));
console.log(`HAR ดิบ: ${RAW} (ห้าม commit) · HAR ตัดความลับ: ${OUT} · entries ${har.log.entries.length} · ปิดค่า ${redacted} จุด · รวม ${Date.now() - t0} ms`);
