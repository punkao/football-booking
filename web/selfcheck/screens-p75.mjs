#!/usr/bin/env node
// Phase 7.5: screenshots of the pages that changed (p75-*.png, 1280 + 375 px) and DOM checks of the UI items
// in docs/08b-FIX-PROMPT.md (hints, field errors, disabled free hour, data-value, accessible names, 375 px select).
// Also: no unexpected console errors, no horizontal scroll at 375 px, no Thai text left in EN customer pages.
//
//   node selfcheck/screens-p75.mjs            (BASE_URL defaults to http://localhost:3000)
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "D:/ms-playwright";
const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(path.resolve(here, "../../tools/node_modules/@playwright/test/index.mjs")).href);

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(here, "screens");
await mkdir(OUT, { recursive: true });
const NOW = "2026-10-09T10:00:00+07:00"; // Friday

const browser = await chromium.launch();
const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}${ok ? "" : `  -> ${detail}`}`);
};

async function api(ctx, method, p, data) {
  const r = await ctx.request.fetch(BASE + p, { method, data, headers: { "content-type": "application/json" } });
  return { status: r.status(), json: await r.json().catch(() => null) };
}

// ---------- deterministic data ----------
const setup = await browser.newContext();
await api(setup, "POST", "/api/test/reset", { now: NOW });
const ton = await browser.newContext();
await api(ton, "POST", "/api/customers/login", { phone: "0811111111", password: "Ton12345" });
const mk = async (b) => (await api(ton, "POST", "/api/bookings", { name: "ต้น", phone: "0811111111", consent: true, hours: 1, ...b })).json.booking.code;
const payB = (code) => api(ton, "POST", `/api/bookings/${code}/pay`, {});
// MATCHED booking (item 1)
const matched = await mk({ fieldId: "C", date: "2026-10-16", startHour: 18 });
await payB(matched);
const ch = (await api(ton, "POST", "/api/challenges", { code: matched, teamName: "ทีมต้น", level: "INTERMEDIATE" })).json.challenge.id;
await api(setup, "POST", `/api/challenges/${ch}/accept`, { name: "Rival", phone: "0855555555", consent: true });
await api(setup, "POST", `/api/challenges/${ch}/pay`, { phone: "0855555555" });
// an OPEN challenge at level ADVANCED for the list
const adv = await mk({ fieldId: "B", date: "2026-10-14", startHour: 19 });
await payB(adv);
await api(ton, "POST", "/api/challenges", { code: adv, teamName: "ทีมต้น", level: "ADVANCED" });
// split link (item 7, 10)
const splitCode = await mk({ fieldId: "A", date: "2026-10-14", startHour: 19, hours: 2 });
await payB(splitCode);
const token = (await api(ton, "POST", `/api/bookings/${splitCode}/split`, { count: 12 })).json.token;
const shares = (await api(setup, "GET", `/api/split/${token}`)).json.shares;
await api(setup, "POST", `/api/split/${token}/${shares[0].id}/paid`, { paid: true });
// AWAITING_PAYMENT challenge (A-28): reschedule blocked
const pendingCode = await mk({ fieldId: "B", date: "2026-10-15", startHour: 19 });
await payB(pendingCode);
const pch = (await api(ton, "POST", "/api/challenges", { code: pendingCode, teamName: "ทีมต้น", level: "BEGINNER" })).json.challenge.id;
await api(setup, "POST", `/api/challenges/${pch}/accept`, { name: "Other", phone: "0866666666", consent: true });
// today 12:00 booking for the front desk (item 12)
const today12 = await mk({ fieldId: "C", date: "2026-10-09", startHour: 12 });
await payB(today12);
await ton.close();

const MSG = {
  th: {
    SLOT_TAKEN: "ช่วงเวลานี้ถูกจองแล้ว",
    NAME_REQUIRED: "กรุณากรอกชื่อ",
    INVALID_PHONE: "เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0",
    CONSENT_REQUIRED: "กรุณายินยอมให้เก็บข้อมูลส่วนบุคคล (PDPA) ก่อนดำเนินการ",
    CHALLENGE_MATCHED: "มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้",
    CHALLENGE_PENDING: "มีทีมกำลังชำระเงินรับคำท้า เลื่อนการจองได้หลังชำระเสร็จหรือหมดเวลา 15 นาที",
    FREE_HOUR_NOT_ELIGIBLE: "ใช้ชั่วโมงฟรีได้เฉพาะรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์",
    FREE_HOUR_NONE: "ยังไม่มีสิทธิ์ชั่วโมงฟรี",
    NO_SHOW_TOO_EARLY: "บันทึกไม่มาได้เมื่อเลยเวลาเริ่มอย่างน้อย 15 นาที",
  },
  en: {
    SLOT_TAKEN: "This time slot is already booked",
    NAME_REQUIRED: "Please enter your name",
    INVALID_PHONE: "Phone number must be 10 digits starting with 0",
    CONSENT_REQUIRED: "Please give PDPA consent before continuing",
    CHALLENGE_MATCHED: "A team has accepted the challenge. This booking can't be cancelled or rescheduled",
    CHALLENGE_PENDING: "A team is paying for the challenge. You can reschedule after they pay or after 15 minutes",
  },
};
const USER_TEXT = ["ต้น", "มิว", "โจ้", "แนน", "ทีมต้น", "วันคล้ายวันสวรรคต รัชกาลที่ 9", "วันปิยมหาราช", "วันพ่อแห่งชาติ", "วันรัฐธรรมนูญ", "วันสิ้นปี"];

async function open(lang, width, who, url) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 812 : 900 }, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: "lang", value: lang, url: BASE }]);
  if (who === "ton") await api(ctx, "POST", "/api/customers/login", { phone: "0811111111", password: "Ton12345" });
  if (who === "mew") await api(ctx, "POST", "/api/customers/login", { phone: "0822222222", password: "Mew12345" });
  if (who === "owner") await api(ctx, "POST", "/api/staff/login", { username: "owner", password: "Owner1234" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    // F-07: 4xx answers that the page expects (rule errors) are logged by the browser as "Failed to load resource"
    if (m.type() === "error" && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await ready(page);
  return { ctx, page, errors };
}
const ready = (page) => page.waitForSelector('html[data-ready="true"]', { state: "attached", timeout: 15000 });
const text = (page, id) => page.getByTestId(id).innerText().catch(() => null);
const visible = (page, id) => page.getByTestId(id).isVisible().catch(() => false);
async function settle(page) {
  await page.waitForTimeout(150);
  await ready(page);
  await page.waitForTimeout(150);
}
async function finish(name, lang, width, o, customer = true) {
  const overflow = await o.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await o.page.screenshot({ path: path.join(OUT, `p75-${name}-${lang}-${width}.png`), fullPage: true });
  check(`${name}-${lang}-${width}.console`, o.errors.length === 0, o.errors.join(" | "));
  if (width === 375) check(`${name}-${lang}-${width}.no-hscroll`, overflow <= 0, `${overflow}px`);
  if (lang === "en" && customer) {
    let t = await o.page.evaluate(() => document.body.innerText);
    for (const u of [...USER_TEXT].sort((a, b) => b.length - a.length)) t = t.split(u).join("");
    const thai = t.split("\n").filter((l) => /[\u0E00-\u0E7F]/.test(l));
    check(`${name}-${lang}-${width}.no-thai`, thai.length === 0, thai.slice(0, 3).join(" / "));
  }
  await o.ctx.close();
}

for (const width of [1280, 375]) {
  for (const lang of ["th", "en"]) {
    if (lang === "en" && width === 1280) continue; // EN text check at 375 only
    const M = MSG[lang];
    const tag = `${lang}-${width}`;

    // ---- item 12 + 13: /book/new on a taken slot, submit an empty form
    {
      const o = await open(lang, width, "guest", "/book/new?field=A&date=2026-10-09&start=19");
      const p = o.page;
      check(`book-submit-hint.${tag}`, (await text(p, "book-submit-hint")) === M.SLOT_TAKEN, await text(p, "book-submit-hint"));
      check(`book-submit-enabled.${tag}`, await p.getByTestId("book-submit").isEnabled());
      check(`book-submit-describedby.${tag}`, (await p.getByTestId("book-submit").getAttribute("aria-describedby")) === "book-submit-hint");
      await p.getByTestId("book-submit").click();
      await settle(p);
      check(`book-submit-error-same-as-api.${tag}`, (await text(p, "error-message")) === M.SLOT_TAKEN, await text(p, "error-message"));
      const fe = [await text(p, "field-error-name"), await text(p, "field-error-phone"), await text(p, "field-error-consent")];
      check(`field-errors-all.${tag}`, fe[0] === M.NAME_REQUIRED && fe[1] === M.INVALID_PHONE && fe[2] === M.CONSENT_REQUIRED, JSON.stringify(fe));
      // F-06 / item 15: every option of the field select fits in the box (no cut words)
      const fit = await p.getByTestId("book-field").evaluate((sel) => {
        const cs = getComputedStyle(sel);
        const ctx2 = document.createElement("canvas").getContext("2d");
        ctx2.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const widest = Math.max(...[...sel.options].map((op) => ctx2.measureText(op.text).width));
        const room = sel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 24; // 24 px for the arrow
        return { widest: Math.round(widest), room: Math.round(room) };
      });
      check(`book-field-fits.${tag}`, fit.widest <= fit.room, JSON.stringify(fit));
      await finish("book-new-errors", lang, width, o);
    }
    // ---- item 13: free slot, empty form → first error NAME_REQUIRED + all three under the fields
    if (lang === "th") {
      const o = await open(lang, width, "guest", "/book/new?field=A&date=2026-10-14&start=9");
      const p = o.page;
      check(`book-submit-no-hint.${tag}`, !(await visible(p, "book-submit-hint")));
      await p.getByTestId("book-submit").click();
      await settle(p);
      check(`first-error-name.${tag}`, (await text(p, "error-message")) === M.NAME_REQUIRED, await text(p, "error-message"));
      const n = (await Promise.all(["field-error-name", "field-error-phone", "field-error-consent"].map((id) => visible(p, id)))).filter(Boolean).length;
      check(`three-field-errors.${tag}`, n === 3, `${n}`);
      await p.getByTestId("customer-name").fill("ทดสอบ");
      await p.getByTestId("book-submit").click();
      await settle(p);
      check(`next-error-phone.${tag}`, (await text(p, "error-message")) === M.INVALID_PHONE && !(await visible(p, "field-error-name")), await text(p, "error-message"));
      await o.ctx.close();
    }
    // ---- item 9: free hour box (มิว has 1 free hour, ต้น has none)
    if (lang === "th") {
      const o = await open(lang, width, "mew", "/book/new?field=A&date=2026-10-16&start=17");
      const p = o.page;
      check(`free-hour-disabled-17.${tag}`, await p.getByTestId("use-free-hour").isDisabled());
      check(`free-hour-reason-17.${tag}`, (await text(p, "use-free-hour-reason")) === M.FREE_HOUR_NOT_ELIGIBLE, await text(p, "use-free-hour-reason"));
      await finish("free-hour", lang, width, o);
      const o2 = await open(lang, width, "mew", "/book/new?field=A&date=2026-10-16&start=16");
      check(`free-hour-enabled-16.${tag}`, (await o2.page.getByTestId("use-free-hour").isEnabled()) && !(await visible(o2.page, "use-free-hour-reason")));
      await o2.ctx.close();
      const o3 = await open(lang, width, "ton", "/book/new?field=A&date=2026-10-16&start=16");
      check(`free-hour-none.${tag}`, (await o3.page.getByTestId("use-free-hour").isDisabled()) && (await text(o3.page, "use-free-hour-reason")) === M.FREE_HOUR_NONE);
      await o3.ctx.close();
    }
    // ---- item 1 + 12: MATCHED booking page
    {
      const o = await open(lang, width, "ton", `/booking/${matched}`);
      const p = o.page;
      check(`cancel-hint.${tag}`, (await text(p, "cancel-booking-hint")) === M.CHALLENGE_MATCHED, await text(p, "cancel-booking-hint"));
      check(`reschedule-hint.${tag}`, (await text(p, "reschedule-submit-hint")) === M.CHALLENGE_MATCHED, await text(p, "reschedule-submit-hint"));
      check(`cancel-describedby.${tag}`, (await p.getByTestId("cancel-booking").getAttribute("aria-describedby")) === "cancel-booking-hint");
      if (lang === "th") check(`level-word.${tag}`, (await text(p, "challenge-info"))?.includes("กลาง"), await text(p, "challenge-info"));
      // item 1 (round 2): cancel-booking always opens the same confirm step; blocked → preview ฿0 + reason
      await p.getByTestId("cancel-booking").click();
      check(`blocked-confirm-step.${tag}`, (await visible(p, "cancel-confirm")) && (await visible(p, "cancel-abort")), "no confirm step");
      check(`blocked-preview-0.${tag}`, (await p.getByTestId("cancel-credit-preview").getAttribute("data-value")) === "0");
      check(`blocked-confirm-reason.${tag}`, (await text(p, "cancel-confirm-reason")) === M.CHALLENGE_MATCHED, await text(p, "cancel-confirm-reason"));
      await p.getByTestId("cancel-confirm").click();
      await settle(p);
      check(`cancel-click-error.${tag}`, (await text(p, "error-message")) === M.CHALLENGE_MATCHED, await text(p, "error-message"));
      check(`still-confirmed.${tag}`, (await p.getByTestId("booking-status").getAttribute("data-value")) === "CONFIRMED");
      await finish("booking-matched", lang, width, o);
    }
    // ---- item 10: split page data-value · item 7: booking page keeps the link
    {
      const o = await open(lang, width, "guest", `/split/${token}`);
      const p = o.page;
      check(`split-people-value.${tag}`, (await p.getByTestId("split-people").getAttribute("data-value")) === "12");
      check(`split-paid-count-value.${tag}`, (await p.getByTestId("split-paid-count").getAttribute("data-value")) === "1");
      await finish("split", lang, width, o);
      const o2 = await open(lang, width, "ton", `/booking/${splitCode}`);
      check(`booking-split-link.${tag}`, (await o2.page.getByTestId("split-link").getAttribute("href")) === `/split/${token}` && !(await visible(o2.page, "split-create")));
      // item 1 (round 2): allowed case → same confirm step, preview = credit, no reason, abort keeps the booking
      const q = o2.page;
      check(`allowed-no-hint.${tag}`, !(await visible(q, "cancel-booking-hint")));
      await q.getByTestId("cancel-booking").click();
      check(
        `allowed-confirm-step.${tag}`,
        (await visible(q, "cancel-confirm")) && (await q.getByTestId("cancel-credit-preview").getAttribute("data-value")) === "1200" && !(await visible(q, "cancel-confirm-reason")),
      );
      await q.getByTestId("cancel-abort").click();
      check(`allowed-abort.${tag}`, (await visible(q, "cancel-booking")) && (await q.getByTestId("booking-status").getAttribute("data-value")) === "CONFIRMED");
      await finish("booking-split", lang, width, o2);
      // A-28: reschedule blocked while the opponent is paying
      const o3 = await open(lang, width, "ton", `/booking/${pendingCode}`);
      check(`pending-reschedule-hint.${tag}`, (await text(o3.page, "reschedule-submit-hint")) === M.CHALLENGE_PENDING && (await o3.page.getByTestId("reschedule-submit").isEnabled()), await text(o3.page, "reschedule-submit-hint"));
      check(`pending-cancel-no-hint.${tag}`, !(await visible(o3.page, "cancel-booking-hint")));
      await finish("booking-pending", lang, width, o3);
    }
    if (lang !== "th") continue;
    // ---- item 3: challenge list words
    {
      const o = await open(lang, width, "guest", "/challenges");
      const opts = await o.page.getByTestId("challenge-filter-level").locator("option").allInnerTexts();
      check(`levels-filter.${tag}`, JSON.stringify(opts) === JSON.stringify(["ทุกระดับ", "มือใหม่", "กลาง", "เก่ง"]), JSON.stringify(opts));
      await finish("challenges", lang, width, o);
    }
    // ---- item 12: front desk hints
    {
      const o = await open(lang, width, "owner", `/staff?code=${today12}`);
      const p = o.page;
      check(`no-show-hint.${tag}`, (await text(p, "staff-no-show-hint")) === M.NO_SHOW_TOO_EARLY && (await p.getByTestId("staff-no-show").isEnabled()), await text(p, "staff-no-show-hint"));
      check(`checkin-no-hint.${tag}`, !(await visible(p, "staff-checkin-hint")));
      await finish("staff-before", lang, width, o, false);
      const o2 = await open(lang, width, "owner", "/staff?code=LN-900001");
      await o2.page.getByTestId("staff-checkin").click();
      await settle(o2.page);
      check(`checkin-hint-after.${tag}`, (await visible(o2.page, "staff-checkin-hint")) && (await o2.page.getByTestId("staff-checkin").isEnabled()));
      await finish("staff-checked-in", lang, width, o2, false);
    }
    // ---- item 14: accessible names
    {
      const o = await open(lang, width, "guest", "/my");
      const names = await o.page.evaluate(() =>
        ["lookup-phone", "login-phone", "register-phone"].map((id) => document.querySelector(`[data-testid="${id}"]`)?.labels?.[0]?.innerText?.trim()),
      );
      check(`my-phone-labels.${tag}`, new Set(names).size === 3 && names.every(Boolean), JSON.stringify(names));
      await finish("my", lang, width, o);
      const o2 = await open(lang, width, "owner", "/owner");
      const labels = await o2.page.locator('[data-testid^="holiday-delete-"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      check(`holiday-delete-names.${tag}`, labels.length === 5 && new Set(labels).size === 5 && labels[0] === "ลบวันหยุด 13 ต.ค. 2026", JSON.stringify(labels));
      await finish("owner", lang, width, o2, false);
      const o3 = await open(lang, width, "guest", "/");
      const h1 = await o3.page.getByRole("heading", { level: 1 }).first();
      const name = (await h1.getAttribute("aria-label")) ?? "";
      check(`home-h1-name.${tag}`, name.length > 5 && (await o3.page.getByRole("heading", { level: 1, name }).count()) === 1, name);
      await finish("home", lang, width, o3);
    }
  }
}
await setup.close();
await browser.close();
const fail = results.filter((r) => !r.ok);
console.log(`\nchecks: ${results.length} · pass: ${results.length - fail.length} · fail: ${fail.length}`);
process.exit(fail.length ? 1 : 0);
