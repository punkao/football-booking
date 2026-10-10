#!/usr/bin/env node
// Self-check of the business rules through the HTTP API (BUILD-PROMPT step 7.3).
// Every group starts with POST /api/test/reset and a locked clock.
//
//   node selfcheck/rules-check.mjs                 # expects BUG_MODE=0: every check must pass
//   node selfcheck/rules-check.mjs --expect-bugs   # expects BUG_MODE=1: only the planted-bug checks fail
//
// BASE_URL defaults to http://localhost:3000

const BASE = process.env.BASE_URL || "http://localhost:3000";
const EXPECT_BUGS = process.argv.includes("--expect-bugs");
// checks that the planted bugs (web/BUGS.md) are expected to break
const BUG_CHECKS = new Set(["BR-11.sat-17", "BR-13.exact-24h", "BR-22.bib-7"]);

const results = [];
function check(id, desc, ok, detail = "") {
  results.push({ id, desc, ok: !!ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${id.padEnd(22)} ${desc}${ok ? "" : `  -> ${detail}`}`);
}

class Client {
  constructor() {
    this.jar = new Map();
  }
  async call(method, path, body) {
    const headers = { "content-type": "application/json" };
    if (this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i);
      const v = kv.slice(i + 1);
      if (v === "") this.jar.delete(k);
      else this.jar.set(k, v);
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  }
  get(p) {
    return this.call("GET", p);
  }
  post(p, b = {}) {
    return this.call("POST", p, b);
  }
}

const sys = new Client();
const at = (iso) => iso; // readability
async function reset(now) {
  const r = await sys.post("/api/test/reset", { now });
  if (r.status !== 200) throw new Error(`reset failed ${r.status} ${JSON.stringify(r.json)}`);
}
async function clock(now) {
  const r = await sys.post("/api/test/clock", { now });
  if (r.status !== 200) throw new Error(`clock failed ${r.status}`);
}
const NOW = "2026-10-09T10:00:00+07:00"; // Friday

const errCode = (r) => r.json?.error?.code;
async function quote(c, b) {
  return c.post("/api/quote", { hours: 1, ...b });
}
let phoneSeq = 0;
const newPhone = () => `09${String(10000000 + ++phoneSeq).slice(-8)}`;
async function book(c, b) {
  return c.post("/api/bookings", { name: "Tester", phone: b.phone ?? newPhone(), consent: true, hours: 1, ...b });
}
async function bookPaid(c, b) {
  const r = await book(c, b);
  if (r.status !== 201) throw new Error(`booking failed ${r.status} ${JSON.stringify(r.json)}`);
  const code = r.json.booking.code;
  if (r.json.booking.status === "PENDING_PAYMENT") {
    const p = await c.post(`/api/bookings/${code}/pay`, {});
    if (p.status !== 200) throw new Error(`pay failed ${p.status} ${JSON.stringify(p.json)}`);
  }
  return code;
}
async function login(c, phone, password) {
  const r = await c.post("/api/customers/login", { phone, password });
  if (r.status !== 200) throw new Error("login failed " + phone);
}
async function staffLogin(c, username, password) {
  const r = await c.post("/api/staff/login", { username, password });
  if (r.status !== 200) throw new Error("staff login failed " + username);
}

async function group(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(`${name}.crash`, `group ${name} ran without exceptions`, false, e.message);
  }
}

async function main() {
  const h = await sys.get("/api/health");
  check("NFR-12.health", "GET /api/health → {ok:true, db:true}", h.status === 200 && h.json?.ok === true && h.json?.db === true, JSON.stringify(h.json));

  await group("BR-01", async () => {
    await reset(NOW);
    const a = await sys.get("/api/availability?date=2026-10-14");
    const f = Object.fromEntries(a.json.fields.map((x) => [x.id, x]));
    check("BR-01.fields", "A,B = 5-a-side outdoor · C = 7-a-side covered", f.A.size === 5 && !f.A.covered && f.B.size === 5 && !f.B.covered && f.C.size === 7 && f.C.covered);
    const o = new Client();
    await staffLogin(o, "owner", "Owner1234");
    const rc = await o.post("/api/owner/closures", { fieldId: "C", date: "2026-10-14", fromHour: 18, toHour: 20 });
    check("BR-01.rain-C", "rain closure on C is rejected", rc.status === 400 && errCode(rc) === "RAIN_COVERED_FIELD", `${rc.status} ${errCode(rc)}`);
    const ra = await o.post("/api/owner/closures", { fieldId: "A", date: "2026-10-14", fromHour: 18, toHour: 20 });
    check("BR-01.rain-A", "rain closure on A is allowed", ra.status === 200, `${ra.status}`);
  });

  await group("BR-02", async () => {
    await reset(NOW);
    const c = new Client();
    const a = await sys.get("/api/availability?date=2026-10-14");
    const hours = [...new Set(a.json.slots.map((s) => s.hour))];
    check("BR-02.grid", "availability has 08:00 … 23:00 and no 07:00", hours.includes(8) && hours.includes(23) && !hours.includes(7) && hours.length === 16);
    const r7 = await quote(c, { fieldId: "A", date: "2026-10-14", startHour: 7 });
    check("BR-02.07", "start 07:00 rejected", errCode(r7) === "INVALID_START_HOUR", errCode(r7));
    const r23 = await quote(c, { fieldId: "A", date: "2026-10-14", startHour: 23 });
    check("BR-02.23", "start 23:00 allowed", r23.status === 200, `${r23.status} ${errCode(r23)}`);
    const r85 = await quote(c, { fieldId: "A", date: "2026-10-14", startHour: 8.5 });
    check("BR-02.0830", "start 08:30 rejected", errCode(r85) === "INVALID_START_HOUR", errCode(r85));
  });

  await group("BR-03", async () => {
    await reset(NOW);
    const c = new Client();
    const r1 = await quote(c, { fieldId: "A", date: "2026-10-14", startHour: 20, hours: 4 });
    check("BR-03.20x4", "20:00 × 4 h allowed (ends 24:00)", r1.status === 200, errCode(r1));
    const r2 = await quote(c, { fieldId: "A", date: "2026-10-14", startHour: 21, hours: 4 });
    check("BR-03.21x4", "21:00 × 4 h rejected (ends 01:00)", errCode(r2) === "ENDS_AFTER_MIDNIGHT", errCode(r2));
    const r3 = await quote(c, { fieldId: "A", date: "2026-10-14", startHour: 10, hours: 0 });
    check("BR-03.0h", "0 hours rejected", errCode(r3) === "INVALID_HOURS", errCode(r3));
    const r4 = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 21, hours: 4 });
    check("BR-03.create", "booking 21:00 × 4 h is not created", r4.status === 400 && errCode(r4) === "ENDS_AFTER_MIDNIGHT", `${r4.status}`);
  });

  await group("BR-04", async () => {
    await reset(NOW);
    const c = new Client();
    const r1 = await book(c, { fieldId: "A", date: "2026-10-23", startHour: 10 });
    check("BR-04.+14", "23 Oct (today + 14) allowed", r1.status === 201, `${r1.status} ${errCode(r1)}`);
    const r2 = await book(c, { fieldId: "A", date: "2026-10-24", startHour: 10 });
    check("BR-04.+15", "24 Oct (today + 15) rejected", errCode(r2) === "TOO_FAR_AHEAD", errCode(r2));
  });

  await group("BR-05", async () => {
    await reset(NOW);
    const c = new Client();
    await clock("2026-10-09T15:00:00+07:00");
    const r1 = await book(c, { fieldId: "B", date: "2026-10-09", startHour: 16 });
    check("BR-05.60min", "now 15:00 → 16:00 allowed", r1.status === 201, `${r1.status} ${errCode(r1)}`);
    await clock("2026-10-09T15:01:00+07:00");
    const r2 = await book(c, { fieldId: "C", date: "2026-10-09", startHour: 16 });
    check("BR-05.59min", "now 15:01 → 16:00 rejected", errCode(r2) === "TOO_SOON", errCode(r2));
  });

  await group("BR-06", async () => {
    await reset(NOW);
    const c = new Client();
    await bookPaid(c, { fieldId: "A", date: "2026-10-14", startHour: 19, hours: 2 });
    const r1 = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 20 });
    check("BR-06.overlap", "A 20:00 over A 19–21 → 409 SLOT_TAKEN", r1.status === 409 && errCode(r1) === "SLOT_TAKEN", `${r1.status} ${errCode(r1)}`);
    check("BR-06.message", 'message is "ช่วงเวลานี้ถูกจองแล้ว"', r1.json?.error?.message === "ช่วงเวลานี้ถูกจองแล้ว", r1.json?.error?.message);
    const r2 = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 21 });
    check("BR-06.adjacent", "A 21:00 allowed (right after)", r2.status === 201, errCode(r2));
    const r3 = await book(c, { fieldId: "B", date: "2026-10-14", startHour: 19 });
    check("BR-06.otherfield", "B 19:00 allowed", r3.status === 201, errCode(r3));
    const en = new Client();
    en.jar.set("lang", "en");
    const r4 = await book(en, { fieldId: "A", date: "2026-10-14", startHour: 19 });
    check("BR-06.message-en", "EN message has no Thai", r4.status === 409 && !/[฀-๿]/.test(r4.json?.error?.message ?? "ก"), r4.json?.error?.message);
  });

  await group("BR-07-09", async () => {
    await reset(NOW);
    const c = new Client();
    const p = async (fieldId, date, startHour, hours = 1) => (await quote(c, { fieldId, date, startHour, hours })).json?.quote?.fieldPrice;
    check("BR-07.5-16", "5-a-side 16:00 = 800", (await p("A", "2026-10-14", 16)) === 800);
    check("BR-07.5-17", "5-a-side 17:00 = 1,200", (await p("A", "2026-10-14", 17)) === 1200);
    check("BR-07.7-16", "7-a-side 16:00 = 1,200", (await p("C", "2026-10-14", 16)) === 1200);
    check("BR-07.7-17", "7-a-side 17:00 = 1,800", (await p("C", "2026-10-14", 17)) === 1800);
    check("BR-08.sat", "Sat 10 Oct A 09:00 = 1,200", (await p("A", "2026-10-10", 9)) === 1200);
    check("BR-08.holiday", "Tue 13 Oct (holiday) A 09:00 = 1,200", (await p("A", "2026-10-13", 9)) === 1200);
    check("BR-08.normal", "Tue 20 Oct A 09:00 = 800", (await p("A", "2026-10-20", 9)) === 800);
    check("BR-09.cross17", "Wed A 16–18 = 2,000", (await p("A", "2026-10-14", 16, 2)) === 2000);
    const a = await sys.get("/api/availability?date=2026-10-14");
    const s16 = a.json.slots.find((s) => s.fieldId === "A" && s.hour === 16);
    const s17 = a.json.slots.find((s) => s.fieldId === "A" && s.hour === 17);
    check("FR-01.prices", "availability shows 800 at 16:00 and 1,200 at 17:00", s16.price === 800 && s17.price === 1200);
  });

  await group("BR-10", async () => {
    await reset(NOW);
    const c = new Client();
    const r1 = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 9 });
    const r2 = await book(c, { fieldId: "B", date: "2026-10-14", startHour: 9 });
    await clock("2026-10-09T10:15:00+07:00");
    const p1 = await c.post(`/api/bookings/${r1.json.booking.code}/pay`, {});
    check("BR-10.15m00s", "pay at 15 min 0 s → CONFIRMED", p1.status === 200, `${p1.status} ${errCode(p1)}`);
    await clock("2026-10-09T10:15:01+07:00");
    const p2 = await c.post(`/api/bookings/${r2.json.booking.code}/pay`, {});
    check("BR-10.15m01s", "pay at 15 min 1 s → PAYMENT_EXPIRED", p2.status === 409 && errCode(p2) === "PAYMENT_EXPIRED", `${p2.status} ${errCode(p2)}`);
    const d = await c.get(`/api/bookings/${r2.json.booking.code}`);
    check("FR-07.expired", "booking becomes EXPIRED", d.json?.booking?.status === "EXPIRED", d.json?.booking?.status);
    const a = await sys.get("/api/availability?date=2026-10-14");
    check("FR-07.free-again", "slot B 09:00 is free again", a.json.slots.find((s) => s.fieldId === "B" && s.hour === 9).status === "free");
  });

  await group("BR-11", async () => {
    await reset(NOW);
    const c = new Client();
    const plan = async (date, startHour) => (await quote(c, { fieldId: "A", date, startHour })).json?.quote?.paymentPlan;
    check("BR-11.fri-17", "Fri 17:00 → FULL_100", (await plan("2026-10-16", 17)) === "FULL_100");
    check("BR-11.fri-16", "Fri 16:00 → DEPOSIT_50", (await plan("2026-10-16", 16)) === "DEPOSIT_50");
    check("BR-11.thu-17", "Thu 17:00 → DEPOSIT_50", (await plan("2026-10-15", 17)) === "DEPOSIT_50");
    check("BR-11.hol-17", "Tue 13 Oct holiday 17:00 → DEPOSIT_50", (await plan("2026-10-13", 17)) === "DEPOSIT_50");
    const sat = await book(c, { fieldId: "B", date: "2026-10-17", startHour: 17 });
    check("BR-11.sat-17", "Sat 17:00 → FULL_100 (booking payNow = 100%)", sat.json?.booking?.paymentPlan === "FULL_100" && sat.json?.booking?.payNow === 1200, `${sat.json?.booking?.paymentPlan} ${sat.json?.booking?.payNow}`);
    const q16 = await quote(c, { fieldId: "A", date: "2026-10-16", startHour: 16, hours: 2 });
    check("BR-11.fri-16x2", "Fri 16:00 × 2 (crosses 17:00) → DEPOSIT_50 (A-16)", q16.json?.quote?.paymentPlan === "DEPOSIT_50");
  });

  await group("BR-12", async () => {
    await reset(NOW);
    const c = new Client();
    const q = await quote(c, { fieldId: "A", date: "2026-10-14", startHour: 19, hours: 2 });
    check("BR-12.paynow", "Wed A 19–21 = 2,400 → pay now 1,200 · due 1,200", q.json?.quote?.totalPrice === 2400 && q.json?.quote?.payNow === 1200 && q.json?.quote?.dueAtField === 1200);
    const ton = new Client();
    await login(ton, "0811111111", "Ton12345");
    const r = await ton.post("/api/bookings", { fieldId: "A", date: "2026-10-14", startHour: 16, hours: 2, name: "ต้น", phone: "0811111111", consent: true, useCredit: true });
    const b = r.json?.booking;
    check("BR-12.credit", "credit 1,200 on 2,000 → net 800 → pay now 400", r.status === 201 && b.creditUsed === 1200 && b.payNow === 400 && b.dueAtField === 400, JSON.stringify(b));
    const p = await ton.post(`/api/bookings/${b.code}/pay`, {});
    const me = await ton.get("/api/me");
    check("BR-12.credit-used", "credit balance 0 after paying", p.status === 200 && me.json?.customer?.creditBalance === 0, `${me.json?.customer?.creditBalance}`);
    // net 0 → confirmed immediately (C 10-15 09:00 = 1,200 with remaining... use a fresh reset)
    await reset(NOW);
    const ton2 = new Client();
    await login(ton2, "0811111111", "Ton12345");
    const z = await ton2.post("/api/bookings", { fieldId: "A", date: "2026-10-14", startHour: 19, hours: 1, name: "ต้น", phone: "0811111111", consent: true, useCredit: true });
    check("BR-12.zero", "net ฿0 → CONFIRMED immediately", z.status === 201 && z.json.booking.status === "CONFIRMED" && z.json.booking.payNow === 0, JSON.stringify(z.json?.booking?.status));
  });

  await group("BR-13", async () => {
    await reset(NOW);
    const c = new Client();
    const b1 = await bookPaid(c, { fieldId: "A", date: "2026-10-12", startHour: 19 }); // paid 600
    const b2 = await bookPaid(c, { fieldId: "B", date: "2026-10-12", startHour: 19 });
    await clock("2026-10-11T19:00:00+07:00");
    const r1 = await c.post(`/api/bookings/${b1}/cancel`, {});
    check("BR-13.exact-24h", "cancel exactly 24 h before → credit = paid (600)", r1.status === 200 && r1.json?.creditReturned === 600, `${r1.status} ${r1.json?.creditReturned}`);
    await clock("2026-10-11T19:01:00+07:00");
    const r2 = await c.post(`/api/bookings/${b2}/cancel`, {});
    check("BR-13.23h59", "cancel 23 h 59 min before → no credit", r2.status === 200 && r2.json?.creditReturned === 0, `${r2.status} ${r2.json?.creditReturned}`);
    const d = await c.get(`/api/bookings/${b2}`);
    check("BR-13.status", "booking is CANCELLED", d.json?.booking?.status === "CANCELLED");
    const a = await sys.get("/api/availability?date=2026-10-12");
    check("BR-13.freed", "cancelled slot is free again", a.json.slots.find((s) => s.fieldId === "B" && s.hour === 19).status === "free");
    await clock("2026-10-12T19:00:00+07:00");
    const b3 = await book(c, { fieldId: "C", date: "2026-10-13", startHour: 19 });
    await c.post(`/api/bookings/${b3.json.booking.code}/pay`, {});
    await clock("2026-10-13T19:00:00+07:00");
    const r3 = await c.post(`/api/bookings/${b3.json.booking.code}/cancel`, {});
    check("BR-13.after-start", "cannot cancel at/after the start", r3.status === 409 && errCode(r3) === "CANCEL_TOO_LATE", `${r3.status} ${errCode(r3)}`);
  });

  await group("BR-14", async () => {
    await reset(NOW);
    const c = new Client();
    const phone = newPhone();
    const b1 = await bookPaid(c, { fieldId: "A", date: "2026-10-16", startHour: 17, phone }); // Fri 17 → FULL 1,200
    const b2 = await bookPaid(c, { fieldId: "A", date: "2026-10-16", startHour: 20 });
    const o = new Client();
    await staffLogin(o, "owner", "Owner1234");
    const r = await o.post("/api/owner/closures", { fieldId: "A", date: "2026-10-16", fromHour: 17, toHour: 19 });
    const hit = r.json?.affected?.find((x) => x.code === b1);
    check("BR-14.credit", "rain on A over a 1,200 paid booking → credit 1,200", r.status === 200 && hit?.credit === 1200, JSON.stringify(r.json?.affected));
    const d1 = await c.get(`/api/bookings/${b1}`);
    check("BR-14.status", "booking becomes RAIN_CLOSED", d1.json?.booking?.status === "RAIN_CLOSED");
    const d2 = await c.get(`/api/bookings/${b2}`);
    check("BR-14.untouched", "booking outside the closure stays CONFIRMED", d2.json?.booking?.status === "CONFIRMED");
    const n = await book(c, { fieldId: "A", date: "2026-10-16", startHour: 18 });
    check("BR-14.blocked", "closed time cannot be booked", n.status === 409 && errCode(n) === "FIELD_CLOSED", errCode(n));
    const staff = new Client();
    await staffLogin(staff, "staff", "Staff1234");
    const f = await staff.post("/api/owner/closures", { fieldId: "A", date: "2026-10-16", fromHour: 9, toHour: 10 });
    check("BR-14.owner-only", "STAFF cannot close fields (403)", f.status === 403, `${f.status}`);
  });

  await group("BR-15", async () => {
    await reset(NOW);
    const ton = new Client();
    await login(ton, "0811111111", "Ton12345");
    const q1 = await ton.post("/api/quote", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, creditUsed: 900 });
    check("BR-15.over-total", "credit 900 on a 800 booking rejected", errCode(q1) === "CREDIT_EXCEEDS_TOTAL", errCode(q1));
    const q2 = await ton.post("/api/quote", { fieldId: "A", date: "2026-10-14", startHour: 19, hours: 2, creditUsed: 1300 });
    check("BR-15.over-balance", "credit 1,300 with balance 1,200 rejected", errCode(q2) === "CREDIT_INSUFFICIENT", errCode(q2));
    const guest = new Client();
    const q3 = await guest.post("/api/bookings", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, name: "x", phone: "0811111111", consent: true, useCredit: true });
    check("BR-15.login", "using credit needs the member login", errCode(q3) === "MEMBER_REQUIRED", errCode(q3));
  });

  await group("BR-16", async () => {
    await reset(NOW);
    const c = new Client();
    const staff = new Client();
    await staffLogin(staff, "staff", "Staff1234");
    // โจ้ already has a NO_SHOW 5 days ago
    const j = await bookPaid(c, { fieldId: "A", date: "2026-10-09", startHour: 12, phone: "0833333333", name: "โจ้" });
    await clock("2026-10-09T12:15:00+07:00");
    const ns = await staff.post(`/api/staff/bookings/${j}/no-show`, {});
    check("BR-16.ban", "2nd NO_SHOW within 30 days → banned", ns.status === 200 && !!ns.json?.bannedUntil, JSON.stringify(ns.json?.bannedUntil));
    const nb = await book(c, { fieldId: "B", date: "2026-10-10", startHour: 10, phone: "0833333333", name: "โจ้" });
    check("BR-16.blocked", "banned customer cannot book online", nb.status === 403 && errCode(nb) === "CUSTOMER_BANNED", `${nb.status} ${errCode(nb)}`);
    const joe = new Client();
    await login(joe, "0833333333", "Joe12345");
    const me = await joe.get("/api/me");
    check("FR-14.banned-until", "member page shows bannedUntil = +30 days", me.json?.customer?.isBanned === true && me.json.customer.bannedUntil?.startsWith("2026-11-08"), me.json?.customer?.bannedUntil);

    // boundary 30 / 31 days
    await reset(NOW);
    const p30 = newPhone();
    const p31 = newPhone();
    const x1 = await bookPaid(c, { fieldId: "A", date: "2026-10-10", startHour: 9, phone: p30 });
    const y1 = await bookPaid(c, { fieldId: "B", date: "2026-10-10", startHour: 9, phone: p31 });
    await clock("2026-10-10T09:15:00+07:00");
    await staff.post(`/api/staff/bookings/${x1}/no-show`, {});
    const first = await staff.post(`/api/staff/bookings/${y1}/no-show`, {});
    check("BR-16.first", "1st NO_SHOW → not banned", first.status === 200 && !first.json?.bannedUntil);
    const still = await book(c, { fieldId: "C", date: "2026-10-11", startHour: 10, phone: p31 });
    check("BR-16.first-can-book", "after the 1st NO_SHOW the customer can still book", still.status === 201, errCode(still));
    await clock("2026-11-08T10:00:00+07:00");
    const x2 = await bookPaid(c, { fieldId: "A", date: "2026-11-09", startHour: 9, phone: p30 });
    const y2 = await bookPaid(c, { fieldId: "B", date: "2026-11-10", startHour: 9, phone: p31 });
    await clock("2026-11-09T09:15:00+07:00");
    const s30 = await staff.post(`/api/staff/bookings/${x2}/no-show`, {});
    check("BR-16.30days", "2nd NO_SHOW 30 days after the 1st → banned", !!s30.json?.bannedUntil, JSON.stringify(s30.json?.bannedUntil));
    await clock("2026-11-10T09:15:00+07:00");
    const s31 = await staff.post(`/api/staff/bookings/${y2}/no-show`, {});
    check("BR-16.31days", "2nd NO_SHOW 31 days after the 1st → not banned", s31.status === 200 && !s31.json?.bannedUntil, JSON.stringify(s31.json?.bannedUntil));
  });

  await group("BR-17", async () => {
    await reset(NOW);
    const c = new Client();
    const staff = new Client();
    await staffLogin(staff, "staff", "Staff1234");
    const code = await bookPaid(c, { fieldId: "C", date: "2026-10-09", startHour: 12 });
    await clock("2026-10-09T12:14:00+07:00");
    const r1 = await staff.post(`/api/staff/bookings/${code}/no-show`, {});
    check("BR-17.14min", "no-show at +14 min rejected", r1.status === 409 && errCode(r1) === "NO_SHOW_TOO_EARLY", `${r1.status} ${errCode(r1)}`);
    await clock("2026-10-09T12:15:00+07:00");
    const r2 = await staff.post(`/api/staff/bookings/${code}/no-show`, {});
    check("BR-17.15min", "no-show at +15 min allowed", r2.status === 200 && r2.json?.booking?.status === "NO_SHOW", `${r2.status}`);
    const a = await sys.get("/api/availability?date=2026-10-09");
    check("BR-17.still-held", "NO_SHOW keeps the slot unavailable online", a.json.slots.find((s) => s.fieldId === "C" && s.hour === 12).status !== "free");
  });

  await group("BR-18-21", async () => {
    await reset(NOW);
    const mew = new Client();
    await login(mew, "0822222222", "Mew12345");
    const pv = (b) => mew.post("/api/series/preview", { fieldId: "A", startDate: "2026-10-14", startHour: 19, hours: 2, ...b });
    check("BR-18.3w", "3 weeks rejected", errCode(await pv({ weeks: 3 })) === "SERIES_WEEKS_RANGE");
    check("BR-18.4w", "4 weeks allowed", (await pv({ weeks: 4 })).status === 200);
    const w12 = await pv({ weeks: 12 });
    check("BR-18.12w", "12 weeks allowed (beyond 14 days)", w12.status === 200 && w12.json.preview.weeks[11].date === "2026-12-30");
    check("BR-18.13w", "13 weeks rejected", errCode(await pv({ weeks: 13 })) === "SERIES_WEEKS_RANGE");
    const first = await mew.post("/api/series/preview", { fieldId: "A", startDate: "2026-10-09", startHour: 10, hours: 1, weeks: 4 });
    check("BR-18.first-week-BR05", "first week still needs 1 hour lead time", errCode(first) === "TOO_SOON", errCode(first));
    const guest = new Client();
    const g = await guest.post("/api/series/preview", { fieldId: "A", startDate: "2026-10-14", startHour: 19, hours: 2, weeks: 4 });
    check("BR-18.member", "series needs a member login", errCode(g) === "MEMBER_REQUIRED", errCode(g));
    const w7 = await pv({ weeks: 7 });
    check("BR-19.7w", "7 weeks → no discount", w7.json.preview.discountPercent === 0 && w7.json.preview.totals.discount === 0);
    const w8 = await pv({ weeks: 8 });
    check("BR-19.8w", "8 weeks → 10% of field price", w8.json.preview.discountPercent === 10 && w8.json.preview.totals.discount === 1920);
    const w10 = await pv({ weeks: 10 });
    check("BR-20.10w", "Wed A 19–21 × 10 weeks → pay now 10,800", w10.json.preview.totals.payNow === 10800, `${w10.json?.preview?.totals?.payNow}`);
    // a conflict in week 2
    const other = new Client();
    await bookPaid(other, { fieldId: "A", date: "2026-10-21", startHour: 20 });
    const w8c = await pv({ weeks: 8 });
    check("BR-19.8-minus-1", "ask 8, 1 taken → 7 booked → no discount", w8c.json.preview.weeksBooked === 7 && w8c.json.preview.discountPercent === 0);
    const w4 = await pv({ weeks: 4 });
    check("BR-21.conflicts", "conflict dates listed", JSON.stringify(w4.json.preview.conflicts) === JSON.stringify(["2026-10-21"]) && w4.json.preview.weeks[1].status === "conflict");
    const noConfirm = await mew.post("/api/series", { fieldId: "A", startDate: "2026-10-14", startHour: 19, hours: 2, weeks: 4, consent: true });
    check("BR-21.need-confirm", "create with conflicts needs confirmPartial", noConfirm.status === 409 && errCode(noConfirm) === "SERIES_CONFLICT");
    const ok = await mew.post("/api/series", { fieldId: "A", startDate: "2026-10-14", startHour: 19, hours: 2, weeks: 4, consent: true, confirmPartial: true });
    check("BR-21.book-free", "ask 4, week 2 taken → 3 bookings", ok.status === 201 && ok.json.codes.length === 3, JSON.stringify(ok.json));
    const pay = await mew.post(`/api/bookings/${ok.json.codes[0]}/pay`, {});
    check("BR-20.pay-once", "series paid once for all weeks (3 × 1,200)", pay.status === 200 && pay.json.amount === 3600 && pay.json.bookings.length === 3, JSON.stringify(pay.json));
  });

  await group("BR-22", async () => {
    await reset(NOW);
    const c = new Client();
    const q = await quote(c, { fieldId: "A", date: "2026-10-14", startHour: 9, rentals: { BIB: 2, BALL: 1 } });
    check("BR-22.price", "2 bibs + 1 ball = 130", q.json?.quote?.rentalPrice === 130);
    const b7 = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 10, rentals: { BIB: 7 } });
    check("BR-22.bib-7", "7th bib rejected", b7.status === 409 && errCode(b7) === "RENTAL_OUT_OF_STOCK", `${b7.status} ${errCode(b7)}`);
    const b11 = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 11, rentals: { BALL: 11 } });
    check("BR-22.ball-11", "11th ball rejected", b11.status === 409 && errCode(b11) === "RENTAL_OUT_OF_STOCK", `${b11.status} ${errCode(b11)}`);
    await reset(NOW); // independent of the checks above
    await bookPaid(c, { fieldId: "B", date: "2026-10-14", startHour: 19, rentals: { BIB: 6 } });
    const r = await sys.get("/api/rentals/availability?date=2026-10-14&startHour=20&hours=1");
    check("BR-22.not-returned", "19:00 rented 6, not returned → 20:00 has 0 bibs", r.json?.items?.find((i) => i.id === "BIB")?.remaining === 0);
    const same = await sys.get("/api/rentals/availability?date=2026-10-14&startHour=19&hours=1");
    check("BR-22.overlap", "same time on another field → 0 bibs", same.json?.items?.find((i) => i.id === "BIB")?.remaining === 0);
  });

  await group("BR-23-24", async () => {
    await reset(NOW);
    const ton = new Client();
    await login(ton, "0811111111", "Ton12345");
    let me = (await ton.get("/api/me")).json.customer;
    check("BR-23.7", "7 hours → 'N more' = 3, no free hour", me.hoursToNextFree === 3 && me.freeHoursAvailable === 0);
    const staff = new Client();
    await staffLogin(staff, "staff", "Staff1234");
    const c2 = await bookPaid(ton, { fieldId: "A", date: "2026-10-12", startHour: 9, hours: 2, phone: "0811111111", name: "ต้น" });
    await staff.post(`/api/staff/bookings/${c2}/checkin`, {});
    me = (await ton.get("/api/me")).json.customer;
    check("BR-23.9", "9 hours → no free hour", me.paidHours === 9 && me.freeHoursAvailable === 0, JSON.stringify(me));
    const c1 = await bookPaid(ton, { fieldId: "A", date: "2026-10-12", startHour: 11, hours: 1, phone: "0811111111", name: "ต้น" });
    const ci = await staff.post(`/api/staff/bookings/${c1}/checkin`, {});
    check("FR-23.checkin", "check-in collects due and sets CHECKED_IN", ci.status === 200 && ci.json?.booking?.status === "CHECKED_IN" && ci.json?.booking?.dueAtField === 0 && ci.json?.collected === 400);
    me = (await ton.get("/api/me")).json.customer;
    check("BR-23.10", "10 hours → 1 free hour", me.paidHours === 10 && me.freeHoursAvailable === 1, JSON.stringify(me));

    const mew = new Client();
    await login(mew, "0822222222", "Mew12345");
    const f16 = await mew.post("/api/quote", { fieldId: "A", date: "2026-10-16", startHour: 16, hours: 2, useFreeHour: true });
    check("BR-24.fri-16", "Fri 16:00 free hour allowed (−800)", f16.status === 200 && f16.json.quote.freeHourValue === 800 && f16.json.quote.totalPrice === 1200);
    const f17 = await mew.post("/api/quote", { fieldId: "A", date: "2026-10-16", startHour: 17, hours: 1, useFreeHour: true });
    check("BR-24.fri-17", "Fri 17:00 free hour rejected", errCode(f17) === "FREE_HOUR_NOT_ELIGIBLE", errCode(f17));
    const s9 = await mew.post("/api/quote", { fieldId: "A", date: "2026-10-10", startHour: 9, hours: 1, useFreeHour: true });
    check("BR-24.sat-9", "Sat 09:00 free hour rejected", errCode(s9) === "FREE_HOUR_NOT_ELIGIBLE", errCode(s9));
    const hol = await mew.post("/api/quote", { fieldId: "A", date: "2026-10-13", startHour: 9, hours: 1, useFreeHour: true });
    check("BR-24.holiday", "weekday holiday before 17:00 allowed (A-15)", hol.status === 200 && hol.json.quote.freeHourValue === 1200);
    const guest = new Client();
    const g = await guest.post("/api/quote", { fieldId: "A", date: "2026-10-16", startHour: 16, hours: 1, useFreeHour: true });
    check("BR-24.member", "non-member cannot use a free hour", errCode(g) === "MEMBER_REQUIRED");
    const used = await mew.post("/api/bookings", { fieldId: "A", date: "2026-10-16", startHour: 16, hours: 1, name: "มิว", phone: "0822222222", consent: true, useFreeHour: true });
    check("BR-24.zero", "1 free hour on a 1-hour booking → ฿0, confirmed", used.status === 201 && used.json.booking.status === "CONFIRMED" && used.json.booking.totalPrice === 0);
    const again = await mew.post("/api/quote", { fieldId: "B", date: "2026-10-16", startHour: 16, hours: 1, useFreeHour: true });
    check("BR-24.used-up", "free hour can't be used twice", errCode(again) === "FREE_HOUR_NONE", errCode(again));
  });

  await group("BR-25", async () => {
    await reset(NOW);
    const c = new Client();
    const code = await bookPaid(c, { fieldId: "A", date: "2026-10-12", startHour: 9 }); // 800, paid 400
    const r1 = await c.post(`/api/bookings/${code}/reschedule`, { date: "2026-10-12", startHour: 17 });
    check("BR-25.pay-diff", "A 09:00 (800) → A 17:00 (1,200) → pay 400 more", r1.status === 200 && r1.json.extraPay === 400, JSON.stringify(r1.json));
    const r2 = await c.post(`/api/bookings/${code}/reschedule`, { date: "2026-10-12", startHour: 18 });
    check("BR-25.second", "2nd reschedule rejected", r2.status === 409 && errCode(r2) === "RESCHEDULE_LIMIT", errCode(r2));
    const late = await bookPaid(c, { fieldId: "B", date: "2026-10-10", startHour: 10 });
    await clock("2026-10-09T10:01:00+07:00");
    const r3 = await c.post(`/api/bookings/${late}/reschedule`, { date: "2026-10-12", startHour: 10 });
    check("BR-25.23h59", "23 h 59 min before → rejected", r3.status === 409 && errCode(r3) === "RESCHEDULE_TOO_LATE", errCode(r3));
    await clock(NOW);
    const cheap = await bookPaid(c, { fieldId: "C", date: "2026-10-14", startHour: 18 }); // 1,800
    const r4 = await c.post(`/api/bookings/${cheap}/reschedule`, { date: "2026-10-14", startHour: 10 });
    check("BR-25.credit-diff", "C 18:00 (1,800) → C 10:00 (1,200) → 600 credit", r4.status === 200 && r4.json.creditBack === 600, JSON.stringify(r4.json));
    const taken = await bookPaid(c, { fieldId: "B", date: "2026-10-15", startHour: 9 });
    const mine = await bookPaid(c, { fieldId: "B", date: "2026-10-15", startHour: 12 });
    const r5 = await c.post(`/api/bookings/${mine}/reschedule`, { date: "2026-10-15", startHour: 9 });
    check("BR-25.slot-rules", "new slot must pass BR-06", r5.status === 409 && errCode(r5) === "SLOT_TAKEN", `${errCode(r5)} ${taken}`);
  });

  await group("BR-26", async () => {
    await reset(NOW);
    const c = new Client();
    const phone = newPhone();
    const a = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 9, phone, name: "One" });
    const b = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 10, phone, name: "Two" });
    check("BR-26.same", "same phone twice → same Customer", a.json.booking.customerId === b.json.booking.customerId);
  });

  await group("BR-27", async () => {
    await reset(NOW);
    const c = new Client();
    const code = await bookPaid(c, { fieldId: "A", date: "2026-10-14", startHour: 19, hours: 2 });
    const s = await c.post(`/api/bookings/${code}/split`, { count: 12 });
    check("BR-27.per-person", "2,400 ÷ 12 = 200 per person", s.status === 200 && s.json.perPerson === 200);
    const g = await sys.get(`/api/split/${s.json.token}`);
    check("FR-19.status", "split page lists 12 unpaid shares", g.json.shares.length === 12 && g.json.paidCount === 0);
    const p = await sys.post(`/api/split/${s.json.token}/${g.json.shares[0].id}/paid`, { paid: true });
    check("FR-19.mark-paid", "a member can be marked paid", p.json.paidCount === 1);
  });

  await group("BR-28", async () => {
    await reset(NOW);
    const ton = new Client();
    await login(ton, "0811111111", "Ton12345");
    const code = await bookPaid(ton, { fieldId: "C", date: "2026-10-16", startHour: 18, phone: "0811111111", name: "ต้น" });
    const pending = await book(ton, { fieldId: "C", date: "2026-10-16", startHour: 20, phone: "0811111111", name: "ต้น" });
    const np = await ton.post("/api/challenges", { code: pending.json.booking.code, teamName: "X", level: "BEGINNER" });
    check("BR-28.confirmed-only", "challenge only for CONFIRMED bookings", np.status === 409 && errCode(np) === "CHALLENGE_NOT_ALLOWED", errCode(np));
    const cr = await ton.post("/api/challenges", { code, teamName: "Ton FC", level: "INTERMEDIATE" });
    check("BR-28.amount", "C Fri 18:00 1,800 → opponent pays 900", cr.status === 200 && cr.json.challenge.amount === 900, JSON.stringify(cr.json));
    const id = cr.json.challenge.id;
    const list = await sys.get("/api/challenges?level=INTERMEDIATE");
    check("NFR-04.no-phone", "challenge list never shows phone numbers", list.json.challenges.length === 1 && !JSON.stringify(list.json).includes("0811111111"));
    const lb = await sys.get("/api/challenges?level=BEGINNER");
    check("FR-20.filter", "level filter works", lb.json.challenges.length === 0);
    const opp = new Client();
    const acc = await opp.post(`/api/challenges/${id}/accept`, { name: "Rival", phone: "0855555555", consent: true });
    check("FR-21.accept", "accept → AWAITING_PAYMENT", acc.status === 200 && acc.json.challenge.status === "AWAITING_PAYMENT");
    await clock("2026-10-09T10:15:01+07:00");
    const late = await opp.post(`/api/challenges/${id}/pay`, { phone: "0855555555" });
    check("BR-28.expire", "not paid in 15 min → back to OPEN", late.status === 409 && errCode(late) === "CHALLENGE_PAYMENT_EXPIRED");
    const acc2 = await opp.post(`/api/challenges/${id}/accept`, { name: "Rival", phone: "0855555555", consent: true });
    await clock("2026-10-09T10:30:01+07:00");
    const pay = await opp.post(`/api/challenges/${id}/pay`, { phone: "0855555555" });
    check("BR-28.matched", "paid in time → MATCHED", acc2.status === 200 && pay.status === 200 && pay.json.challenge.status === "MATCHED", `${pay.status} ${errCode(pay)}`);
    const me = await ton.get("/api/me");
    check("BR-28.credit", "booking owner gets 900 credit", me.json.customer.creditBalance === 1200 + 900, `${me.json.customer.creditBalance}`);
    const again = await opp.post(`/api/challenges/${id}/accept`, { name: "Other", phone: "0866666666", consent: true });
    check("BR-28.locked", "MATCHED cannot be accepted again", errCode(again) === "CHALLENGE_NOT_OPEN");
  });

  await group("NFR-05/07", async () => {
    await reset(NOW);
    const anon = new Client();
    const s1 = await anon.get("/api/staff/today");
    check("NFR-05.anon", "shop API without login → 401", s1.status === 401);
    const st = new Client();
    await staffLogin(st, "staff", "Staff1234");
    const s2 = await st.get("/api/staff/today");
    check("NFR-05.role", "STAFF cannot open today overview → 403", s2.status === 403);
    const mg = new Client();
    await staffLogin(mg, "manager", "Manager1234");
    const s3 = await mg.get("/api/staff/today");
    check("FR-22.manager", "MANAGER sees today overview", s3.status === 200 && s3.json.rows.length === 16);
    const s4 = await mg.get("/api/owner/holidays");
    check("NFR-05.owner", "MANAGER cannot manage holidays → 403", s4.status === 403);
    const other = new Client();
    const s5 = await other.get("/api/bookings/LN-900001?phone=0899999999");
    check("NFR-05.phone", "wrong phone cannot see a booking", s5.status === 403);
    const s6 = await other.get("/api/bookings/LN-900001?phone=0811111111");
    check("FR-09.code+phone", "code + right phone shows the booking", s6.status === 200 && s6.json.booking.code === "LN-900001");
    const [x, y] = await Promise.all([
      book(new Client(), { fieldId: "B", date: "2026-10-14", startHour: 19 }),
      book(new Client(), { fieldId: "B", date: "2026-10-14", startHour: 19 }),
    ]);
    check("NFR-07.race", "2 simultaneous requests → exactly 1 created", [x.status, y.status].filter((s) => s === 201).length === 1, `${x.status} ${y.status}`);
  });

  await group("SEED", async () => {
    await reset(NOW);
    const a = await sys.get("/api/availability");
    const a19 = a.json.slots.find((s) => s.fieldId === "A" && s.hour === 19);
    check("SEED.LN-900001", "today A 19:00 is booked (LN-900001)", a19.status === "booked");
    const n = await book(new Client(), { fieldId: "C", date: "2026-10-14", startHour: 9 });
    check("SEED.code", "first new booking after reset is LN-100001", n.json?.booking?.code === "LN-100001", n.json?.booking?.code);
    const o = new Client();
    await staffLogin(o, "owner", "Owner1234");
    const hs = await o.get("/api/owner/holidays");
    check("SEED.holidays", "5 holidays", hs.json.holidays.length === 5);
  });

  // =====================================================================
  // phase 7.5 (docs/08b-FIX-PROMPT.md items 1–10) — boundary values from 04 BR-13/15/19/24/26/27/28
  // =====================================================================
  const TON = "0811111111";
  const challengeFor = async (owner, code, level = "INTERMEDIATE") => {
    const r = await owner.post("/api/challenges", { code, teamName: "Team " + code, level });
    if (r.status !== 200) throw new Error(`challenge failed ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.challenge.id;
  };
  const credit = async (c) => (await c.get("/api/me")).json?.customer?.creditBalance;

  await group("P75-1", async () => {
    // item 1 · BR-28 A-18 A-21: owner can't cancel or reschedule once MATCHED, no stacked credit
    await reset(NOW);
    const ton = new Client();
    await login(ton, TON, "Ton12345");
    const code = await bookPaid(ton, { fieldId: "C", date: "2026-10-16", startHour: 18, phone: TON, name: "ต้น" }); // Fri 18:00 → FULL 1,800
    const id = await challengeFor(ton, code);
    const opp = new Client();
    await opp.post(`/api/challenges/${id}/accept`, { name: "Rival", phone: "0855555555", consent: true });
    const pay = await opp.post(`/api/challenges/${id}/pay`, { phone: "0855555555" });
    check("P75-1.matched", "opponent paid → MATCHED, owner credit 1,200 + 900 = 2,100", pay.status === 200 && (await credit(ton)) === 2100, `${pay.status} ${await credit(ton)}`);
    const d = await ton.get(`/api/bookings/${code}`);
    const a = d.json?.actions ?? {};
    check(
      "P75-1.actions",
      "actions: canCancel=false canReschedule=false rescheduleBlockedBy=CHALLENGE_MATCHED",
      a.canCancel === false && a.canReschedule === false && a.rescheduleBlockedBy === "CHALLENGE_MATCHED" && a.cancelBlockedBy === "CHALLENGE_MATCHED",
      JSON.stringify(a),
    );
    const cn = await ton.post(`/api/bookings/${code}/cancel`, {});
    check("P75-1.cancel-409", "owner cancel after MATCHED → 409 CHALLENGE_MATCHED", cn.status === 409 && errCode(cn) === "CHALLENGE_MATCHED", `${cn.status} ${errCode(cn)}`);
    check("P75-1.cancel-th", "TH message word for word", cn.json?.error?.message === "มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้", cn.json?.error?.message);
    const en = new Client();
    en.jar.set("lang", "en");
    const cnEn = await en.post(`/api/bookings/${code}/cancel`, { phone: TON });
    check("P75-1.cancel-en", "EN message word for word", cnEn.status === 409 && cnEn.json?.error?.message === "A team has accepted the challenge. This booking can't be cancelled or rescheduled", cnEn.json?.error?.message);
    const rs = await ton.post(`/api/bookings/${code}/reschedule`, { date: "2026-10-15", startHour: 18 });
    check("P75-1.reschedule-409", "owner reschedule after MATCHED → 409 CHALLENGE_MATCHED", rs.status === 409 && errCode(rs) === "CHALLENGE_MATCHED", `${rs.status} ${errCode(rs)}`);
    const d2 = await ton.get(`/api/bookings/${code}`);
    check("P75-1.no-stack", "booking still CONFIRMED and credit still 2,100 (no 2,700)", d2.json?.booking?.status === "CONFIRMED" && (await credit(ton)) === 2100, `${d2.json?.booking?.status} ${await credit(ton)}`);

    // other path: owner cancels while the opponent is AWAITING_PAYMENT, opponent pays afterwards
    await reset(NOW);
    const ton2 = new Client();
    await login(ton2, TON, "Ton12345");
    const code2 = await bookPaid(ton2, { fieldId: "B", date: "2026-10-16", startHour: 18, phone: TON, name: "ต้น" }); // Fri 18:00 → FULL 1,200
    const id2 = await challengeFor(ton2, code2);
    const opp2 = new Client();
    await opp2.post(`/api/challenges/${id2}/accept`, { name: "Rival", phone: "0855555555", consent: true });
    const dA = await ton2.get(`/api/bookings/${code2}`);
    check("P75-1.awaiting-can-cancel", "AWAITING_PAYMENT (not MATCHED) → owner can still cancel", dA.json?.actions?.canCancel === true, JSON.stringify(dA.json?.actions));
    const c2 = await ton2.post(`/api/bookings/${code2}/cancel`, {});
    const late = await opp2.post(`/api/challenges/${id2}/pay`, { phone: "0855555555" });
    check("P75-1.awaiting-then-pay", "cancel during AWAITING_PAYMENT then opponent pays → 409 CHALLENGE_NOT_OPEN", c2.status === 200 && late.status === 409 && errCode(late) === "CHALLENGE_NOT_OPEN", `${c2.status} ${late.status} ${errCode(late)}`);
    const me2 = (await ton2.get("/api/me")).json;
    check(
      "P75-1.awaiting-no-stack",
      "owner credit = 1,200 seed + 1,200 cancel = 2,400 and no CHALLENGE entry",
      me2.customer.creditBalance === 2400 && !me2.creditEntries.some((e) => e.reason === "CHALLENGE"),
      `${me2.customer.creditBalance}`,
    );

    // race: owner cancel and opponent payment sent at the same moment → exactly one wins, never both (no stacked credit)
    let raceOk = true;
    const raceDetail = [];
    for (let i = 0; i < 5; i++) {
      await reset(NOW);
      const t = new Client();
      await login(t, TON, "Ton12345");
      const cd = await bookPaid(t, { fieldId: "C", date: "2026-10-16", startHour: 18, phone: TON, name: "ต้น" }); // 1,800 paid
      const cid = await challengeFor(t, cd);
      const o = new Client();
      await o.post(`/api/challenges/${cid}/accept`, { name: "Rival", phone: "0855555555", consent: true });
      const [cx, px] = await Promise.all([t.post(`/api/bookings/${cd}/cancel`, {}), o.post(`/api/challenges/${cid}/pay`, { phone: "0855555555" })]);
      const bal = await credit(t);
      // cancel won → 1,200 + 1,800 = 3,000 · payment won → 1,200 + 900 = 2,100 (and cancel refused)
      const ok = (cx.status === 200 && px.status === 409 && bal === 3000) || (px.status === 200 && cx.status === 409 && errCode(cx) === "CHALLENGE_MATCHED" && bal === 2100);
      raceDetail.push(`${cx.status}/${px.status}/${bal}`);
      raceOk &&= ok;
    }
    check("P75-1.race", "cancel ∥ opponent pay (5 runs) → one wins, credit never 3,900", raceOk, raceDetail.join(" "));

    // an OPEN challenge follows a reschedule with the new price (BR-28 amount = field price × 50%)
    await reset(NOW);
    const ton3 = new Client();
    await login(ton3, TON, "Ton12345");
    const code3 = await bookPaid(ton3, { fieldId: "A", date: "2026-10-12", startHour: 9, phone: TON, name: "ต้น" }); // Mon 09:00 = 800
    await challengeFor(ton3, code3);
    await ton3.post(`/api/bookings/${code3}/reschedule`, { date: "2026-10-12", startHour: 17 }); // 1,200
    const d3 = await ton3.get(`/api/bookings/${code3}`);
    check("P75-1.open-follows", "OPEN challenge after reschedule 800 → 1,200: amount 400 → 600", d3.json?.booking?.challenge?.amount === 600, JSON.stringify(d3.json?.booking?.challenge));
  });

  await group("P75-2", async () => {
    // item 2 · BR-26 A-20: the name typed for each booking
    await reset(NOW);
    const c = new Client();
    const r = await book(c, { fieldId: "A", date: "2026-10-14", startHour: 9, phone: "0844444444", name: "แนน ทดลอง" });
    const code = r.json?.booking?.code;
    check("P75-2.create", "POST /api/bookings → booking.customerName = 'แนน ทดลอง'", r.status === 201 && r.json.booking.customerName === "แนน ทดลอง", JSON.stringify(r.json?.booking?.customerName));
    const d = await new Client().get(`/api/bookings/${code}?phone=0844444444`);
    check("P75-2.detail", "GET booking → customerName 'แนน ทดลอง'", d.json?.booking?.customerName === "แนน ทดลอง", d.json?.booking?.customerName);
    const staff = new Client();
    await staffLogin(staff, "staff", "Staff1234");
    const s = await staff.get(`/api/staff/bookings/${code}`);
    check("P75-2.staff", "staff search → customerName 'แนน ทดลอง'", s.json?.booking?.customerName === "แนน ทดลอง", s.json?.booking?.customerName);
    const mg = new Client();
    await staffLogin(mg, "manager", "Manager1234");
    const t = await mg.get("/api/staff/today?date=2026-10-14");
    const cell = t.json?.rows?.find((x) => x.hour === 9)?.cells?.find((x) => x.fieldId === "A");
    check("P75-2.today", "today overview → 'แนน ทดลอง'", cell?.booking?.customerName === "แนน ทดลอง", JSON.stringify(cell?.booking));
    const old = await new Client().get("/api/bookings/LN-900004?phone=0844444444");
    check("P75-2.old-booking", "earlier booking LN-900004 still shows 'แนน'", old.json?.booking?.customerName === "แนน", old.json?.booking?.customerName);
    const ton = new Client();
    await login(ton, TON, "Ton12345");
    const tb = await ton.post("/api/bookings", { fieldId: "B", date: "2026-10-14", startHour: 9, hours: 1, name: "ต้น ทดลอง", phone: TON, consent: true });
    const me = await ton.get("/api/me");
    check("P75-2.customer-kept", "Customer.name is not overwritten ('ต้น')", tb.json?.booking?.customerName === "ต้น ทดลอง" && me.json?.customer?.name === "ต้น", `${tb.json?.booking?.customerName} / ${me.json?.customer?.name}`);
  });

  await group("P75-3", async () => {
    // item 3 · BR-28 A-19: level words มือใหม่ / กลาง / เก่ง
    await reset(NOW);
    const ton = new Client();
    await login(ton, TON, "Ton12345");
    const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
    for (let i = 0; i < 3; i++) {
      const code = await bookPaid(ton, { fieldId: "C", date: "2026-10-14", startHour: 9 + i, phone: TON, name: "ต้น" });
      await challengeFor(ton, code, levels[i]);
    }
    const th = await sys.get("/api/challenges");
    const words = Object.fromEntries(th.json.challenges.map((x) => [x.level, x.levelLabel]));
    check("P75-3.th", "TH: BEGINNER=มือใหม่ INTERMEDIATE=กลาง ADVANCED=เก่ง", words.BEGINNER === "มือใหม่" && words.INTERMEDIATE === "กลาง" && words.ADVANCED === "เก่ง", JSON.stringify(words));
    const en = new Client();
    en.jar.set("lang", "en");
    const e = await en.get("/api/challenges");
    const ew = Object.fromEntries(e.json.challenges.map((x) => [x.level, x.levelLabel]));
    check("P75-3.en", "EN: Beginner / Intermediate / Advanced", ew.BEGINNER === "Beginner" && ew.INTERMEDIATE === "Intermediate" && ew.ADVANCED === "Advanced", JSON.stringify(ew));
    const f = await sys.get("/api/challenges?level=ADVANCED");
    check("P75-3.filter", "filter ADVANCED → 1 (เก่ง)", f.json.challenges.length === 1 && f.json.challenges[0].levelLabel === "เก่ง");
  });

  await group("P75-4", async () => {
    // item 4 · BR-13 A-22: cancel until 1 minute before the start
    await reset(NOW);
    const c = new Client();
    const b1 = await bookPaid(c, { fieldId: "C", date: "2026-10-13", startHour: 19 });
    const b2 = await bookPaid(c, { fieldId: "B", date: "2026-10-13", startHour: 19 });
    await clock("2026-10-13T18:59:00+07:00");
    const d1 = await c.get(`/api/bookings/${b1}`);
    const r1 = await c.post(`/api/bookings/${b1}/cancel`, {});
    check("P75-4.minus-1min", "1 minute before the start → cancel OK, no credit", d1.json?.actions?.canCancel === true && r1.status === 200 && r1.json?.creditReturned === 0, `${r1.status} ${r1.json?.creditReturned}`);
    await clock("2026-10-13T19:00:00+07:00");
    const d2 = await c.get(`/api/bookings/${b2}`);
    const r2 = await c.post(`/api/bookings/${b2}/cancel`, {});
    check("P75-4.at-start", "exactly the start → 409 CANCEL_TOO_LATE (canCancel=false)", d2.json?.actions?.canCancel === false && d2.json?.actions?.cancelBlockedBy === "CANCEL_TOO_LATE" && r2.status === 409 && errCode(r2) === "CANCEL_TOO_LATE", `${r2.status} ${errCode(r2)}`);
  });

  await group("P75-5", async () => {
    // item 5 · BR-28 A-23: opponent pays at exactly 15 min = in time · 15 min 1 s = late
    await reset(NOW);
    const ton = new Client();
    await login(ton, TON, "Ton12345");
    const c1 = await bookPaid(ton, { fieldId: "C", date: "2026-10-16", startHour: 18, phone: TON, name: "ต้น" });
    const c2 = await bookPaid(ton, { fieldId: "C", date: "2026-10-16", startHour: 20, phone: TON, name: "ต้น" });
    const id1 = await challengeFor(ton, c1);
    const id2 = await challengeFor(ton, c2);
    const opp = new Client();
    await opp.post(`/api/challenges/${id1}/accept`, { name: "Rival", phone: "0855555555", consent: true }); // 10:00:00
    await clock("2026-10-09T10:15:00+07:00");
    const p1 = await opp.post(`/api/challenges/${id1}/pay`, { phone: "0855555555" });
    check("P75-5.15m00s", "pay at exactly 15 min → MATCHED", p1.status === 200 && p1.json?.challenge?.status === "MATCHED", `${p1.status} ${errCode(p1)}`);
    await opp.post(`/api/challenges/${id2}/accept`, { name: "Rival", phone: "0855555555", consent: true }); // 10:15:00
    await clock("2026-10-09T10:30:01+07:00");
    const p2 = await opp.post(`/api/challenges/${id2}/pay`, { phone: "0855555555" });
    const l = await sys.get("/api/challenges");
    check("P75-5.15m01s", "pay at 15 min 1 s → CHALLENGE_PAYMENT_EXPIRED, back to OPEN", p2.status === 409 && errCode(p2) === "CHALLENGE_PAYMENT_EXPIRED" && l.json.challenges.find((x) => x.id === id2)?.status === "OPEN", `${p2.status} ${errCode(p2)}`);
  });

  await group("P75-6", async () => {
    // item 6 · BR-19 A-24: discount rounded up to a whole baht (current prices always divide evenly → unit test covers 80.5 → 81)
    await reset(NOW);
    const mew = new Client();
    await login(mew, "0822222222", "Mew12345");
    const p = await mew.post("/api/series/preview", { fieldId: "C", startDate: "2026-10-14", startHour: 16, hours: 2, weeks: 8 });
    const weeks = p.json?.preview?.weeks ?? [];
    check(
      "P75-6.ceil",
      "every week: discount = ceil(field price × 10%)",
      weeks.length === 8 && weeks.every((w) => w.discount === Math.ceil(w.fieldPrice * 0.1)),
      JSON.stringify(weeks.map((w) => [w.fieldPrice, w.discount])),
    );
  });

  await group("P75-7", async () => {
    // item 7 · BR-27 A-25: one split link per booking
    await reset(NOW);
    const c = new Client();
    const code = await bookPaid(c, { fieldId: "A", date: "2026-10-14", startHour: 19, hours: 2 });
    const s1 = await c.post(`/api/bookings/${code}/split`, { count: 12 });
    const g1 = await sys.get(`/api/split/${s1.json.token}`);
    await sys.post(`/api/split/${s1.json.token}/${g1.json.shares[0].id}/paid`, { paid: true });
    const s2 = await c.post(`/api/bookings/${code}/split`, { count: 5 });
    check(
      "P75-7.same-link",
      "2nd create with 5 people → same token, 12 people, 200 each",
      s2.status === 200 && s2.json.token === s1.json.token && s2.json.people === 12 && s2.json.perPerson === 200 && s2.json.existing === true,
      JSON.stringify(s2.json),
    );
    check("P75-7.message", "message OK_SPLIT_EXISTS (TH)", s2.json?.message === "การจองนี้มีลิงก์หารค่าสนามแล้ว ใช้ลิงก์เดิม", s2.json?.message);
    const s3 = await c.post(`/api/bookings/${code}/split`, { names: ["a", "b", "c"] });
    const g2 = await sys.get(`/api/split/${s1.json.token}`);
    check("P75-7.kept", "shares and paid status are kept (12 shares, 1 paid)", s3.json?.token === s1.json.token && g2.json.shares.length === 12 && g2.json.paidCount === 1, `${g2.json.shares.length} ${g2.json.paidCount}`);
    const d = await c.get(`/api/bookings/${code}`);
    check("P75-7.detail", "booking page data keeps the same link", d.json?.booking?.split?.token === s1.json.token && d.json?.actions?.canSplit === false);
  });

  await group("P75-8", async () => {
    // item 8 · BR-15 A-26: credit without member login → MEMBER_REQUIRED 401
    await reset(NOW);
    const guest = new Client();
    const q1 = await guest.post("/api/quote", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, useCredit: true });
    check("P75-8.quote-useCredit", "guest quote useCredit=true → 401 MEMBER_REQUIRED", q1.status === 401 && errCode(q1) === "MEMBER_REQUIRED", `${q1.status} ${errCode(q1)}`);
    check("P75-8.message", "message unchanged 'ต้องเข้าสู่ระบบสมาชิกก่อน'", q1.json?.error?.message === "ต้องเข้าสู่ระบบสมาชิกก่อน", q1.json?.error?.message);
    const q2 = await guest.post("/api/quote", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, creditUsed: 1 });
    check("P75-8.quote-credit-1", "guest quote creditUsed=1 → 401 MEMBER_REQUIRED", q2.status === 401 && errCode(q2) === "MEMBER_REQUIRED", `${q2.status} ${errCode(q2)}`);
    const q3 = await guest.post("/api/quote", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, creditUsed: 0 });
    check("P75-8.quote-credit-0", "guest quote creditUsed=0 → 200 (no credit asked)", q3.status === 200, `${q3.status} ${errCode(q3)}`);
    const b1 = await guest.post("/api/bookings", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, name: "ต้น", phone: TON, consent: true, creditUsed: 100 });
    check("P75-8.book-member-phone", "guest booking with a member's phone + creditUsed → 401", b1.status === 401 && errCode(b1) === "MEMBER_REQUIRED", `${b1.status} ${errCode(b1)}`);
    const b2 = await guest.post("/api/bookings", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, name: "x", phone: newPhone(), consent: true, useCredit: true });
    check("P75-8.book-new-phone", "guest booking new phone + useCredit → 401", b2.status === 401 && errCode(b2) === "MEMBER_REQUIRED", `${b2.status} ${errCode(b2)}`);
    const o1 = await guest.post("/api/quote", { fieldId: "A", date: "2026-10-09", startHour: 19, hours: 1, useCredit: true });
    check("P75-8.order-br06", "order: BR-06 before BR-15 (taken slot + credit → SLOT_TAKEN)", errCode(o1) === "SLOT_TAKEN", errCode(o1));
    const o2 = await guest.post("/api/bookings", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, name: "", phone: newPhone(), consent: true, useCredit: true });
    check("P75-8.order-name", "order: BR-15 before name (no name + credit → MEMBER_REQUIRED)", errCode(o2) === "MEMBER_REQUIRED", errCode(o2));
    const ton = new Client();
    await login(ton, TON, "Ton12345");
    const o3 = await ton.post("/api/bookings", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, name: "มิว", phone: "0822222222", consent: true, useCredit: true });
    check("P75-8.other-phone", "member logged in but booking another phone + credit → 401", o3.status === 401 && errCode(o3) === "MEMBER_REQUIRED", `${o3.status} ${errCode(o3)}`);
    const ok = await ton.post("/api/quote", { fieldId: "A", date: "2026-10-14", startHour: 9, hours: 1, useCredit: true });
    check("P75-8.member-ok", "logged-in member + useCredit → 200, credit 800", ok.status === 200 && ok.json?.quote?.creditUsed === 800, `${ok.status} ${ok.json?.quote?.creditUsed}`);
  });

  await group("P75-9", async () => {
    // item 9 · BR-24 Q-T5: the page disables the box from freeHourSlot / free hours; the API still answers the old errors
    await reset(NOW);
    const mew = new Client();
    await login(mew, "0822222222", "Mew12345");
    const fs = async (date, startHour) => (await mew.post("/api/quote", { fieldId: "A", date, startHour, hours: 1 })).json?.quote?.freeHourSlot;
    check("P75-9.slot-flags", "freeHourSlot: Fri 16 true · Fri 17 false · Sat 09 false", (await fs("2026-10-16", 16)) === true && (await fs("2026-10-16", 17)) === false && (await fs("2026-10-17", 9)) === false);
    const api = await mew.post("/api/quote", { fieldId: "A", date: "2026-10-16", startHour: 17, hours: 1, useFreeHour: true });
    check("P75-9.api-still", "API still answers FREE_HOUR_NOT_ELIGIBLE when sent", errCode(api) === "FREE_HOUR_NOT_ELIGIBLE", errCode(api));
    const ton = new Client();
    await login(ton, TON, "Ton12345");
    const none = await ton.post("/api/quote", { fieldId: "A", date: "2026-10-16", startHour: 16, hours: 1, useFreeHour: true });
    check("P75-9.none", "7 paid hours (no free hour) → FREE_HOUR_NONE", errCode(none) === "FREE_HOUR_NONE", errCode(none));
  });

  await group("P75-12", async () => {
    // item 12 · F-02: the API tells the front desk why check-in / no-show can't be done yet
    await reset(NOW);
    const c = new Client();
    const staff = new Client();
    await staffLogin(staff, "staff", "Staff1234");
    const code = await bookPaid(c, { fieldId: "C", date: "2026-10-09", startHour: 12 });
    await clock("2026-10-09T12:14:00+07:00");
    const v1 = await staff.get(`/api/staff/bookings/${code}`);
    check("P75-12.no-show-early", "+14 min: noShowBlockedBy = NO_SHOW_TOO_EARLY", v1.json?.actions?.canNoShow === false && v1.json?.actions?.noShowBlockedBy === "NO_SHOW_TOO_EARLY", JSON.stringify(v1.json?.actions));
    await clock("2026-10-09T12:15:00+07:00");
    const v2 = await staff.get(`/api/staff/bookings/${code}`);
    check("P75-12.no-show-ok", "+15 min: canNoShow = true", v2.json?.actions?.canNoShow === true, JSON.stringify(v2.json?.actions));
    const ci = await staff.post(`/api/staff/bookings/${code}/checkin`, {});
    check("P75-12.checkin-done", "after check-in: canCheckin = false (INVALID_STATUS)", ci.json?.actions?.canCheckin === false && ci.json?.actions?.checkinBlockedBy === "INVALID_STATUS", JSON.stringify(ci.json?.actions));
  });

  await group("P75-A27", async () => {
    // A-27 · BR-14 / BR-15: rain closure of a booking whose challenge is MATCHED
    await reset(NOW);
    const ton = new Client();
    await login(ton, TON, "Ton12345");
    const owner = new Client();
    await staffLogin(owner, "owner", "Owner1234");
    const TEAM = "0855555555";
    // (a) 04 example: A Fri 18:00 1 h paid 1,200 (FULL_100) · team pays 600 → team 600, owner 600
    const a = await bookPaid(ton, { fieldId: "A", date: "2026-10-16", startHour: 18, phone: TON, name: "ต้น" });
    const ida = await challengeFor(ton, a);
    const opp = new Client();
    await opp.post(`/api/challenges/${ida}/accept`, { name: "Rival", phone: TEAM, consent: true });
    const pa = await opp.post(`/api/challenges/${ida}/pay`, { phone: TEAM });
    check("A27.setup", "team paid 600 → owner credit 1,200 + 600 = 1,800", pa.status === 200 && pa.json?.challenge?.amount === 600 && (await credit(ton)) === 1800, `${pa.status} ${await credit(ton)}`);
    // (b) boundary: owner paid exactly what the challenge gave → owner 0 (Mon A 18:00 1,200 deposit 600, team 600)
    const b = await bookPaid(ton, { fieldId: "A", date: "2026-10-12", startHour: 18, phone: TON, name: "ต้น" });
    const idb = await challengeFor(ton, b);
    await opp.post(`/api/challenges/${idb}/accept`, { name: "Rival", phone: TEAM, consent: true });
    await opp.post(`/api/challenges/${idb}/pay`, { phone: TEAM });
    // (c) OPEN challenge (no team payment) → plain BR-14, no team credit · (d) AWAITING_PAYMENT → team paid nothing, no credit
    const c = await bookPaid(ton, { fieldId: "B", date: "2026-10-16", startHour: 18, phone: TON, name: "ต้น" });
    await challengeFor(ton, c);
    const d = await bookPaid(ton, { fieldId: "B", date: "2026-10-12", startHour: 18, phone: TON, name: "ต้น" });
    const idd = await challengeFor(ton, d);
    await new Client().post(`/api/challenges/${idd}/accept`, { name: "Other", phone: "0866666666", consent: true });
    const before = await credit(ton); // 1,200 + 600 (a) + 600 (b) = 2,400

    const ra = await owner.post("/api/owner/closures", { fieldId: "A", date: "2026-10-16", fromHour: 18, toHour: 19 });
    const ea = ra.json?.affected?.find((x) => x.code === a);
    const ownerA = ea?.credits?.find((x) => x.role === "OWNER")?.amount;
    const teamA = ea?.credits?.find((x) => x.role === "CHALLENGER")?.amount;
    check("A27.example", "04 example: owner gets 1,200 − 600 = 600 · team gets 600", ea?.credit === 600 && ea?.challengeCredit === 600 && ownerA === 600 && teamA === 600, JSON.stringify(ea));
    check("A27.owner-balance", "owner balance 2,400 + 600 = 3,000 (never 3,600)", (await credit(ton)) === before + 600, `${await credit(ton)}`);
    const rb = await owner.post("/api/owner/closures", { fieldId: "A", date: "2026-10-12", fromHour: 18, toHour: 19 });
    const eb = rb.json?.affected?.find((x) => x.code === b);
    check("A27.owner-zero", "owner paid 600, challenge credit 600 → owner 0 · team 600", eb?.credit === 0 && eb?.challengeCredit === 600, JSON.stringify(eb));
    const rc = await owner.post("/api/owner/closures", { fieldId: "B", date: "2026-10-16", fromHour: 18, toHour: 19 });
    const ec = rc.json?.affected?.find((x) => x.code === c);
    check("A27.open", "OPEN challenge → owner full 1,200, no team credit", ec?.credit === 1200 && ec?.challengeCredit === 0 && ec?.credits?.length === 1, JSON.stringify(ec));
    const rd = await owner.post("/api/owner/closures", { fieldId: "B", date: "2026-10-12", fromHour: 18, toHour: 19 });
    const ed = rd.json?.affected?.find((x) => x.code === d);
    check("A27.awaiting", "AWAITING_PAYMENT → owner full 600, waiting team gets nothing", ed?.credit === 600 && ed?.challengeCredit === 0, JSON.stringify(ed));
    const late = await new Client().post(`/api/challenges/${idd}/pay`, { phone: "0866666666" });
    check("A27.awaiting-pay-after", "waiting team pays after the rain close → 409 CHALLENGE_NOT_OPEN", late.status === 409 && errCode(late) === "CHALLENGE_NOT_OPEN", `${late.status} ${errCode(late)}`);
    check("A27.owner-total", "owner balance = 2,400 + 600 + 0 + 1,200 + 600 = 4,800", (await credit(ton)) === 4800, `${await credit(ton)}`);
    const dl = await ton.get(`/api/bookings/${a}`);
    check("A27.challenge-closed", "booking RAIN_CLOSED, challenge CLOSED", dl.json?.booking?.status === "RAIN_CLOSED" && dl.json?.booking?.challenge?.status === "CLOSED", JSON.stringify(dl.json?.booking?.challenge));
    // the team's credit sits on its phone's Customer and is usable only after registering (A-17)
    const team = new Client();
    const use = await team.post("/api/quote", { fieldId: "C", date: "2026-10-14", startHour: 9, hours: 1, creditUsed: 100 });
    check("A27.team-needs-member", "team not registered → using the credit gives MEMBER_REQUIRED", errCode(use) === "MEMBER_REQUIRED", errCode(use));
    const reg = await team.post("/api/customers/register", { name: "Rival", phone: TEAM, password: "Rival1234", consent: true });
    const tm = (await team.get("/api/me")).json;
    const rainEntries = tm?.creditEntries?.filter((e) => e.reason === "RAIN") ?? [];
    check(
      "A27.team-credit",
      "after registering: team balance 1,200 = 2 RAIN entries of 600 with the booking codes",
      reg.status === 201 && tm.customer.creditBalance === 1200 && rainEntries.length === 2 && rainEntries.every((e) => e.amount === 600) && rainEntries.some((e) => e.bookingCode === a),
      JSON.stringify(tm?.creditEntries),
    );
    const useOk = await team.post("/api/quote", { fieldId: "C", date: "2026-10-14", startHour: 9, hours: 1, creditUsed: 600 });
    check("A27.team-use", "registered team can use its credit (600)", useOk.status === 200 && useOk.json?.quote?.creditUsed === 600, `${useOk.status} ${errCode(useOk)}`);
  });

  await group("P75-A28", async () => {
    // A-28 · BR-25: no reschedule while the opponent is paying (AWAITING_PAYMENT)
    await reset(NOW);
    const ton = new Client();
    await login(ton, TON, "Ton12345");
    const code = await bookPaid(ton, { fieldId: "A", date: "2026-10-12", startHour: 9, phone: TON, name: "ต้น" }); // Mon 09:00 = 800
    const id = await challengeFor(ton, code);
    const d0 = await ton.get(`/api/bookings/${code}`);
    check("A28.open-ok", "OPEN challenge → canReschedule = true", d0.json?.actions?.canReschedule === true, JSON.stringify(d0.json?.actions));
    await new Client().post(`/api/challenges/${id}/accept`, { name: "Rival", phone: "0855555555", consent: true }); // 10:00:00 → deadline 10:15:00
    const d1 = await ton.get(`/api/bookings/${code}`);
    check(
      "A28.actions",
      "AWAITING_PAYMENT → canReschedule=false, rescheduleBlockedBy=CHALLENGE_PENDING (cancel still allowed)",
      d1.json?.actions?.canReschedule === false && d1.json?.actions?.rescheduleBlockedBy === "CHALLENGE_PENDING" && d1.json?.actions?.canCancel === true,
      JSON.stringify(d1.json?.actions),
    );
    const r1 = await ton.post(`/api/bookings/${code}/reschedule`, { date: "2026-10-12", startHour: 17 });
    check("A28.409", "reschedule → 409 CHALLENGE_PENDING", r1.status === 409 && errCode(r1) === "CHALLENGE_PENDING", `${r1.status} ${errCode(r1)}`);
    check("A28.th", "TH message word for word", r1.json?.error?.message === "มีทีมกำลังชำระเงินรับคำท้า เลื่อนการจองได้หลังชำระเสร็จหรือหมดเวลา 15 นาที", r1.json?.error?.message);
    const en = new Client();
    en.jar.set("lang", "en");
    const r1e = await en.post(`/api/bookings/${code}/reschedule`, { date: "2026-10-12", startHour: 17, phone: TON });
    check("A28.en", "EN message word for word", r1e.json?.error?.message === "A team is paying for the challenge. You can reschedule after they pay or after 15 minutes", r1e.json?.error?.message);
    await clock("2026-10-09T10:15:00+07:00");
    const r2 = await ton.post(`/api/bookings/${code}/reschedule`, { date: "2026-10-12", startHour: 17 });
    check("A28.15m00s", "exactly 15 min after accepting (still in time to pay) → still CHALLENGE_PENDING", r2.status === 409 && errCode(r2) === "CHALLENGE_PENDING", `${r2.status} ${errCode(r2)}`);
    await clock("2026-10-09T10:15:01+07:00");
    const d3 = await ton.get(`/api/bookings/${code}`);
    const r3 = await ton.post(`/api/bookings/${code}/reschedule`, { date: "2026-10-12", startHour: 17 });
    const d4 = await ton.get(`/api/bookings/${code}`);
    check(
      "A28.15m01s",
      "15 min 1 s → back to OPEN, reschedule allowed, challenge amount 400 → 600",
      d3.json?.actions?.canReschedule === true && r3.status === 200 && d4.json?.booking?.challenge?.status === "OPEN" && d4.json?.booking?.challenge?.amount === 600,
      `${r3.status} ${errCode(r3)} ${JSON.stringify(d4.json?.booking?.challenge)}`,
    );
  });

  // ---- summary ----
  const bugFails = results.filter((r) => BUG_CHECKS.has(r.id) && !r.ok).map((r) => r.id);
  const otherFails = results.filter((r) => !BUG_CHECKS.has(r.id) && !r.ok).map((r) => r.id);
  const pass = results.filter((r) => r.ok).length;
  console.log("\n==============================================");
  console.log(`checks: ${results.length} · pass: ${pass} · fail: ${results.length - pass}`);
  if (EXPECT_BUGS) {
    console.log(`planted-bug checks failing: ${bugFails.length}/${BUG_CHECKS.size} (${bugFails.join(", ") || "-"})`);
    console.log(`other failures: ${otherFails.length} ${otherFails.join(", ")}`);
    const okRun = bugFails.length === BUG_CHECKS.size && otherFails.length === 0;
    console.log(okRun ? "RESULT: OK — all 3 planted bugs are present and nothing else broke" : "RESULT: NOT OK");
    process.exit(okRun ? 0 : 1);
  } else {
    console.log(results.length === pass ? "RESULT: OK — all checks pass" : `RESULT: NOT OK — failing: ${[...bugFails, ...otherFails].join(", ")}`);
    process.exit(results.length === pass ? 0 : 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
void at;
