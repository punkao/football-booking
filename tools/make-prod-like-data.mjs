#!/usr/bin/env node
// make-prod-like-data.mjs — เติมข้อมูล "เหมือนใช้งานจริง" ลงฐาน football-db เพื่อซ้อม migration (แผน L1 · บท 06 ข้อ 5)
//
//   node tools/make-prod-like-data.mjs              สร้างข้อมูล (ถ้ามีแล้วจะไม่ทำซ้ำ) + ตั้งนาฬิกาแอปเป็น 2026-10-20 10:00 (+07)
//   node tools/make-prod-like-data.mjs --no-clock   ไม่แตะนาฬิกาแอป (app_settings 'clock')
//   node tools/make-prod-like-data.mjs --dry-run    พิมพ์จำนวนแถวที่จะสร้าง + เขียน SQL ไว้ที่ --sql <ไฟล์> (ไม่แตะฐาน)
//   node tools/make-prod-like-data.mjs --sql out.sql  เก็บ SQL ที่ส่งเข้า psql ไว้ดูด้วย
//
// สร้างใหม่ทั้งชุด: POST /api/test/reset {} (กลับ seed ปกติ) → node tools/make-prod-like-data.mjs
// กลับ seed ปกติ (ให้ e2e ใช้ได้):  POST /api/test/reset {}
//
// กติกา
// * deterministic: PRNG mulberry32 seed คงที่ (SEED) · วันที่ตายตัว (ไม่อ่านเวลาเครื่อง) · ราคาใช้ตารางราคา ณ วันส่งมอบ v2
//   (A/B 800/1,200 · C 1,200/1,800) ที่เขียนไว้ในไฟล์นี้ ไม่อ่านจาก web/lib/rules หรือตาราง fields เพื่อให้รันซ้ำหลัง CR-05 ได้ยอดเดิม
// * idempotent: marker = การจองรหัส LN-7xxxxx · ถ้ามีอยู่แล้ว → พิมพ์ "มีอยู่แล้ว" แล้วจบ (exit 0) ไม่เพิ่มซ้ำ
// * ทั้งหมดอยู่ใน BEGIN … COMMIT เดียว (psql ON_ERROR_STOP) · ไม่ปิด trigger ไม่ปิด constraint: ทุกการเปลี่ยนสถานะตั้ง app.actor/app.now
//   ให้ trigger ของ migration 002 เขียนประวัติเอง · ช่องเวลาไม่ทับกัน (EXCLUDE bookings_no_overlap) รวมถึงการจองของ seed
// * ลูกค้าใหม่ใช้เบอร์ 090xxxxxxx (ไม่ชน seed 08x) · สมาชิกมีรหัสผ่านทดสอบ "Prodlike1234" (ข้อมูลทดสอบในเครื่องเท่านั้น)
// * อ่านชื่อผู้ใช้/ฐานจาก db/.env ผ่าน scripts/_db.mjs เท่านั้น (ไม่อ่านรหัสผ่าน)
import { spawnSync } from "node:child_process";
import { scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { counts, dbEnv } from "../scripts/_db.mjs";

const SEED = 25691101;
const CONTAINER = "football-db";
const NOW = "2026-10-20T10:00:00+07:00"; // "วันนี้" ของชุดข้อมูล = วันที่ร้านส่ง CR-01..05
const PAST_FROM = "2026-06-01";
const SINGLES_TO = "2026-11-03"; // จองเดี่ยวล่วงหน้าได้ 14 วันจาก NOW (BR-04)
const CODE_PREFIX = "LN-7";
const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(n);
  return i < 0 ? undefined : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};
const DRY = !!opt("--dry-run");
const SET_CLOCK = !opt("--no-clock");
const SQL_OUT = typeof opt("--sql") === "string" ? opt("--sql") : null;

// ---------- deterministic helpers ----------
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let x = rnd() * total;
  for (const [v, w] of pairs) if ((x -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
};

const DAY = 86400000;
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const weekday = (d) => new Date(d + "T00:00:00Z").getUTCDay();
const bkk = (date, hour, min = 0) => new Date(Date.parse(`${date}T00:00:00+07:00`) + hour * 3600000 + min * 60000);
const iso = (t) => new Date(t).toISOString();
const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const ts = (t) => sq(iso(t)) + "::timestamptz";
const NOW_T = new Date(NOW);

// ---------- price table at handover (BR-07 – BR-12, migration-test baseline) ----------
const RATES = { A: [800, 1200], B: [800, 1200], C: [1200, 1800] };
const EXTRA_HOLIDAYS = [
  ["2026-06-03", "วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี"],
  ["2026-07-28", "วันเฉลิมพระชนมพรรษา รัชกาลที่ 10"],
  ["2026-08-12", "วันแม่แห่งชาติ"],
];
const RENTAL_PRICE = { BIB: 50, BALL: 30 };

// ---------- read what is already there (seed) ----------
const { POSTGRES_USER, POSTGRES_DB } = dbEnv();
function psqlRun(sql, { input = false } = {}) {
  const base = ["exec", "-i", CONTAINER, "psql", "-U", POSTGRES_USER, "-d", POSTGRES_DB, "-X", "-q", "-v", "ON_ERROR_STOP=1"];
  const r = input
    ? spawnSync("docker", base, { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    : spawnSync("docker", [...base, "-At", "-F", "|", "-c", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`psql failed (${r.status}): ${(r.stderr || r.stdout).slice(0, 2000)}`);
  return r.stdout.trim();
}
const rows = (sql) => {
  const o = psqlRun(sql);
  return o ? o.split(/\r?\n/).map((l) => l.split("|")) : [];
};

{ // marker: a second run adds nothing (idempotent)
  const already = Number(psqlRun(`SELECT count(*) FROM bookings WHERE code LIKE '${CODE_PREFIX}%'`));
  if (already > 0) {
    console.log(`มีชุดข้อมูล prod-like อยู่แล้ว (${already} การจองรหัส ${CODE_PREFIX}xxxxx) — ไม่ทำซ้ำ · สร้างใหม่: POST /api/test/reset {} แล้วรันอีกครั้ง`);
    process.exit(0);
  }
}
const seedHolidays = rows("SELECT to_char(date,'YYYY-MM-DD') FROM holidays").map((r) => r[0]);
const holidays = new Set([...seedHolidays, ...EXTRA_HOLIDAYS.map((h) => h[0])]);
const occupied = new Set(); // `${field}|${date}|${hour}`
{
  for (const [f, d, s, h] of rows(
    "SELECT field_id, to_char(date,'YYYY-MM-DD'), start_hour, hours FROM bookings WHERE status IN ('PENDING_PAYMENT','CONFIRMED','CHECKED_IN','NO_SHOW')",
  )) {
    for (let x = Number(s); x < Number(s) + Number(h); x++) occupied.add(`${f}|${d}|${x}`);
  }
}
const stockNow = {};
for (const [item, loc, qty] of rows("SELECT item_id, location_id, qty FROM stock_levels")) stockNow[`${item}|${loc}`] = Number(qty);

const rate = (f, date, hour) => (weekday(date) === 0 || weekday(date) === 6 || holidays.has(date) || hour >= 17 ? RATES[f][1] : RATES[f][0]);
const fieldPrice = (f, date, s, h) => {
  let t = 0;
  for (let x = s; x < s + h; x++) t += rate(f, date, x);
  return t;
};
const planFor = (date, s) => ([5, 6].includes(weekday(date)) && s >= 17 ? "FULL_100" : "DEPOSIT_50");
const payNowOf = (total, plan) => Math.ceil((total * (plan === "FULL_100" ? 100 : 50)) / 100);
const isFree = (f, d, s, h) => {
  if (s < 8 || s + h > 24) return false;
  for (let x = s; x < s + h; x++) if (occupied.has(`${f}|${d}|${x}`)) return false;
  return true;
};
const take = (f, d, s, h) => {
  for (let x = s; x < s + h; x++) occupied.add(`${f}|${d}|${x}`);
};

// ---------- customers (40 new · ids assigned by the serial) ----------
const FIRST = ["ก้อง", "เก่ง", "ชาย", "ณัฐ", "ต่อ", "ตั้ม", "ทอม", "เบียร์", "ปอนด์", "ป๊อป", "พีท", "ฟลุ๊ค", "ภูมิ", "มาร์ค", "เอ็ม", "โอ๊ต", "อาร์ม", "เจ", "ไผ่", "บอส",
  "แบงก์", "กอล์ฟ", "นัท", "ปาล์ม", "เต้ย", "หนึ่ง", "เอก", "ตูน", "ภู", "เจมส์", "ไนซ์", "ดิว", "แชมป์", "เต้", "โฟร์", "นนท์", "บาส", "เฟิร์ส", "กัน", "ต้า"];
const TEAMS = ["ทีมออฟฟิศ", "ทีมรุ่นพี่", "ทีมวิศวะ", "ทีมหมู่บ้าน", "ทีมพ่อบ้าน", "FC", "ทีมเช้าวันเสาร์", "ทีมช่างไฟ"];
const PW_HASH = (i) => {
  const salt = (SEED + i).toString(16).padStart(32, "0").slice(-32);
  return `scrypt$${salt}$${scryptSync("Prodlike1234", salt, 32).toString("hex")}`;
};
const customers = FIRST.map((n, i) => ({
  key: i,
  name: chance(0.3) ? `${n} ${pick(TEAMS)}` : n,
  phone: "09" + String(10000101 + i * 37).padStart(8, "0"),
  member: chance(0.45),
  credit: 0,
  paidHours: 0,
  lastNoShow: null,
  bannedUntil: null,
}));
const memberCustomers = customers.filter((c) => c.member);
// regulars play more often
const custWeights = customers.map((c, i) => [c, i < 12 ? 4 : i < 25 ? 2 : 1]);

// ---------- SQL building ----------
const out = [];
const S = (s) => out.push(s);
const n = { bookings: 0, payments: 0, credit: 0, audit: 0, rentals: 0, series: 0, sales: 0, saleItems: 0, movements: 0, customers: customers.length, holidays: EXTRA_HOLIDAYS.length };
const statusCount = {};
let codeNo = 700001;
const custRef = (c) => `(SELECT id FROM customers WHERE phone = ${sq(c.phone)})`;
const STAFF = { owner: 1, manager: 2, staff: 3 };
const actorNow = (actor, t) => S(`SELECT set_config('app.actor', ${sq(actor)}, true), set_config('app.now', ${sq(iso(t))}, true);`);
const audit = (who, action, target, detail, t) => {
  n.audit++;
  S(`INSERT INTO audit_logs(staff_user_id, action, target, detail, created_at) VALUES (${STAFF[who]}, ${sq(action)}, ${sq(target)}, ${sq(JSON.stringify(detail))}, ${ts(t)});`);
};

S("BEGIN;");
S("-- prod-like dataset (tools/make-prod-like-data.mjs) · marker: bookings.code LIKE 'LN-7%'");
for (const [d, name] of EXTRA_HOLIDAYS) S(`INSERT INTO holidays(date, name) VALUES (${sq(d)}, ${sq(name)}) ON CONFLICT (date) DO NOTHING;`);
for (const c of customers) {
  S(`INSERT INTO customers(name, phone, password_hash) VALUES (${sq(c.name)}, ${sq(c.phone)}, ${c.member ? sq(PW_HASH(c.key)) : "NULL"});`);
}

/** one booking with its whole life · returns the code */
function booking({ c, f, d, s, h, outcome, createdAt, seriesSql = null, discount = 0, rentals = [], payTime = null, nameOnBooking = null }) {
  const code = `LN-${codeNo++}`;
  n.bookings++;
  statusCount[outcome] = (statusCount[outcome] ?? 0) + 1;
  const fp = fieldPrice(f, d, s, h);
  const rentalPrice = rentals.reduce((t, r) => t + RENTAL_PRICE[r.item] * r.qty, 0);
  const total = fp - discount + rentalPrice;
  const plan = planFor(d, s);
  const payNow = payNowOf(total, plan);
  const due = total - payNow;
  const start = bkk(d, s);
  const deadline = new Date(createdAt.getTime() + 15 * 60000);
  actorNow("CUSTOMER", createdAt);
  S(
    `INSERT INTO bookings(code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount, rental_price,` +
      ` credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, series_id, created_at)` +
      ` VALUES (${sq(code)}, ${custRef(c)}, ${sq(nameOnBooking ?? c.name)}, ${sq(f)}, ${sq(d)}, ${s}, ${h}, 'PENDING_PAYMENT', ${sq(plan)}, ${fp}, ${discount}, ${rentalPrice},` +
      ` 0, false, ${total}, ${payNow}, 0, ${due}, ${ts(deadline)}, ${ts(createdAt)}, 0, ${seriesSql ?? "NULL"}, ${ts(createdAt)});`,
  );
  const bid = `(SELECT id FROM bookings WHERE code = ${sq(code)})`;
  for (const r of rentals) {
    n.rentals++;
    const returned = outcome === "CHECKED_IN" ? r.qty : 0;
    S(`INSERT INTO booking_rentals(booking_id, item_id, qty, returned_qty) VALUES (${bid}, ${sq(r.item)}, ${r.qty}, ${returned});`);
  }
  if (outcome === "EXPIRED") {
    // lazy expiry (ADR-03) happened at the next request after the deadline, never later than NOW
    actorNow("SYSTEM", new Date(Math.min(deadline.getTime() + int(1, 120) * 60000, NOW_T.getTime())));
    S(`UPDATE bookings SET status = 'EXPIRED' WHERE code = ${sq(code)};`);
    return code;
  }
  const paidAt = payTime ?? new Date(createdAt.getTime() + int(1, 12) * 60000);
  actorNow("CUSTOMER", paidAt);
  n.payments++;
  S(`INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (${bid}, ${payNow}, 'PROMPTPAY', ${ts(paidAt)});`);
  S(`UPDATE bookings SET status = 'CONFIRMED', amount_paid = ${payNow} WHERE code = ${sq(code)};`);
  if (outcome === "CANCELLED") {
    // BR-13: cancelled ≥ 24 h before the start → everything paid comes back as credit
    const lo = paidAt.getTime() + 60000;
    const hi = Math.min(start.getTime() - 60000, NOW_T.getTime() - 60000);
    const target = start.getTime() - (chance(0.7) ? int(25, 96) : int(2, 20)) * 3600000;
    const t = new Date(Math.max(lo, Math.min(hi, target)));
    actorNow("CUSTOMER", t);
    S(`UPDATE bookings SET status = 'CANCELLED' WHERE code = ${sq(code)};`);
    if (start.getTime() - t.getTime() >= 24 * 3600000) {
      c.credit += payNow;
      n.credit++;
      S(`UPDATE customers SET credit_balance = credit_balance + ${payNow} WHERE phone = ${sq(c.phone)};`);
      S(`INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) VALUES (${custRef(c)}, ${payNow}, 'CANCEL', ${bid}, ${ts(t)});`);
    }
    return code;
  }
  if (outcome === "CONFIRMED") return code;
  const who = chance(0.8) ? "staff" : "manager";
  if (outcome === "NO_SHOW") {
    const t = new Date(start.getTime() + int(15, 40) * 60000);
    actorNow(who, t);
    S(`UPDATE bookings SET status = 'NO_SHOW', no_show_at = ${ts(t)} WHERE code = ${sq(code)};`);
    audit(who, "NO_SHOW", code, { bannedUntil: null }, t);
    c.lastNoShow = d;
    return code;
  }
  // CHECKED_IN: the rest is paid in cash at the field (FR-24 · BR-23 paid hours)
  const t = new Date(start.getTime() - int(0, 20) * 60000);
  actorNow(who, t);
  if (due > 0) {
    n.payments++;
    S(`INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (${bid}, ${due}, 'CASH_AT_FIELD', ${ts(t)});`);
  }
  S(`UPDATE bookings SET status = 'CHECKED_IN', amount_paid = ${total}, due_at_field = 0, checked_in_at = ${ts(t)} WHERE code = ${sq(code)};`);
  S(`UPDATE customers SET paid_hours = paid_hours + ${h} WHERE phone = ${sq(c.phone)};`);
  c.paidHours += h;
  audit(who, "CHECKIN", code, { collected: due }, t);
  return code;
}

// ---------- 2 recurring series that cross 1 Nov 2569 (CR-05: prices already agreed must not change) ----------
function series({ c, f, startDate, s, h, weeks, createdAt }) {
  n.series++;
  const dates = Array.from({ length: weeks }, (_, i) => addDays(startDate, i * 7));
  for (const d of dates) if (!isFree(f, d, s, h)) throw new Error(`series slot taken ${f} ${d} ${s}`);
  const percent = weeks >= 8 ? 10 : 0;
  const ref = `(SELECT max(id) FROM recurring_series WHERE customer_id = ${custRef(c)})`;
  S(
    `INSERT INTO recurring_series(customer_id, field_id, weekday, start_hour, hours, weeks_requested, weeks_booked, discount_percent, created_at)` +
      ` VALUES (${custRef(c)}, ${sq(f)}, ${weekday(startDate)}, ${s}, ${h}, ${weeks}, ${weeks}, ${percent}, ${ts(createdAt)});`,
  );
  const payTime = new Date(createdAt.getTime() + 4 * 60000);
  for (const d of dates) {
    take(f, d, s, h);
    const fp = fieldPrice(f, d, s, h);
    const discount = Math.ceil((fp * percent) / 100);
    const past = bkk(d, s + h) <= NOW_T;
    booking({ c, f, d, s, h, outcome: past ? "CHECKED_IN" : "CONFIRMED", createdAt, seriesSql: ref, discount, payTime });
  }
}
const seriesOwner1 = memberCustomers[0];
const seriesOwner2 = memberCustomers[1];
series({ c: seriesOwner1, f: "B", startDate: "2026-10-27", s: 19, h: 1, weeks: 8, createdAt: bkk("2026-10-19", 20, 5) }); // Tue → 15 Dec
series({ c: seriesOwner2, f: "C", startDate: "2026-10-17", s: 18, h: 2, weeks: 10, createdAt: bkk("2026-10-12", 21, 30) }); // Sat → 19 Dec

// ---------- single bookings 1 Jun → 3 Nov 2569 ----------
for (let d = PAST_FROM; d <= SINGLES_TO; d = addDays(d, 1)) {
  const wkend = [0, 6].includes(weekday(d)) || holidays.has(d);
  const future = bkk(d, 0) > NOW_T;
  // future days are only partly booked yet (the further away, the emptier)
  const daysAhead = future ? Math.round((bkk(d, 0) - NOW_T) / DAY) : 0;
  let want = wkend ? int(5, 9) : int(2, 6);
  if (future) want = Math.max(0, Math.round(want * (1 - daysAhead / 16)));
  for (let k = 0; k < want; k++) {
    const f = weighted([["A", 4], ["B", 4], ["C", 3]]);
    const s = wkend ? weighted([[9, 1], [10, 1], [14, 1], [16, 2], [17, 3], [18, 4], [19, 4], [20, 3], [21, 2]]) : weighted([[10, 1], [15, 1], [17, 2], [18, 4], [19, 5], [20, 4], [21, 2], [22, 1]]);
    const h = weighted([[1, 5], [2, 4], [3, 1]]);
    if (!isFree(f, d, s, h)) continue;
    const start = bkk(d, s);
    // created 0–13 days before (never before BR-04's 14-day window, never < 1 h before start · BR-05)
    const createdAt = new Date(Math.min(start.getTime() - int(2, 13 * 24) * 3600000 - int(0, 59) * 60000, NOW_T.getTime() - int(1, 48) * 3600000));
    if (createdAt.getTime() < start.getTime() - 14 * DAY || createdAt.getTime() > start.getTime() - 3600000) continue;
    let c = weighted(custWeights);
    if (c.bannedUntil && createdAt < c.bannedUntil) c = customers[(c.key + 17) % customers.length];
    if (c.bannedUntil && createdAt < c.bannedUntil) continue;
    const ended = bkk(d, s + h) <= NOW_T;
    let outcome;
    if (ended) outcome = weighted([["CHECKED_IN", 84], ["NO_SHOW", 4], ["CANCELLED", 7], ["EXPIRED", 5]]);
    else outcome = weighted([["CONFIRMED", 88], ["CANCELLED", 6], ["EXPIRED", 6]]);
    if (!ended && bkk(d, s) <= NOW_T) continue; // in progress at NOW → skip (keeps the picture simple)
    if (outcome === "NO_SHOW" && c.lastNoShow && Date.parse(d) - Date.parse(c.lastNoShow) <= 40 * DAY) outcome = "CHECKED_IN"; // no BR-16 ban in this data
    const blocking = ["CHECKED_IN", "NO_SHOW", "CONFIRMED"].includes(outcome);
    if (blocking) take(f, d, s, h);
    const rentals = [];
    if (outcome !== "EXPIRED" && chance(0.15)) {
      if (chance(0.6)) rentals.push({ item: "BIB", qty: int(1, 2) });
      if (chance(0.7)) rentals.push({ item: "BALL", qty: int(1, 2) });
    }
    booking({ c, f, d, s, h, outcome, createdAt, rentals, nameOnBooking: chance(0.1) ? `${c.name.split(" ")[0]} (${pick(TEAMS)})` : null });
  }
}

// ---------- counter sales + stock (receive → transfer → sale · damage · adjust) ----------
const level = { ...stockNow };
const lv = (item, loc) => level[`${item}|${loc}`] ?? 0;
const setLv = (item, loc, v) => {
  if (v < 0) throw new Error(`stock below 0: ${item} ${loc}`);
  level[`${item}|${loc}`] = v;
};
const SALE_PRICE = { WATER: 10, ORS: 20, TOWEL: 10 };
let saleNo = 0;
const mv = (item, type, qty, from, to, reason, who, saleRef, t) => {
  n.movements++;
  S(
    `INSERT INTO stock_movements(item_id, type, qty, from_location_id, to_location_id, reason, staff_user_id, counter_sale_id, created_at)` +
      ` VALUES (${sq(item)}, ${sq(type)}, ${qty}, ${from ? sq(from) : "NULL"}, ${to ? sq(to) : "NULL"}, ${reason ? sq(reason) : "NULL"}, ${STAFF[who]}, ${saleRef ?? "NULL"}, ${ts(t)});`,
  );
};
for (const month of ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]) {
  const first = `${month}-01`;
  const recvT = bkk(first, 10, 30);
  for (const [item, qty] of [["WATER", 240], ["ORS", 96], ["TOWEL", 100]]) {
    mv(item, "RECEIVE", qty, null, "STORE", "รับของประจำเดือน", "manager", null, recvT);
    setLv(item, "STORE", lv(item, "STORE") + qty);
    audit("manager", "STOCK_RECEIVE", item, { locationId: "STORE", qty }, recvT);
  }
  const trT = bkk(first, 11, 0);
  for (const [item, qty] of [["WATER", 200], ["ORS", 80], ["TOWEL", 80]]) {
    mv(item, "TRANSFER", qty, "STORE", "COUNTER", null, "staff", null, trT);
    setLv(item, "STORE", lv(item, "STORE") - qty);
    setLv(item, "COUNTER", lv(item, "COUNTER") + qty);
    audit("staff", "STOCK_TRANSFER", item, { from: "STORE", to: "COUNTER", qty }, trT);
  }
  const salesThisMonth = month === "2026-10" ? 6 : int(10, 14);
  for (let i = 0; i < salesThisMonth; i++) {
    const day = `${month}-${String(int(2, month === "2026-10" ? 7 : 28)).padStart(2, "0")}`;
    const t = bkk(day, int(17, 22), int(0, 59));
    const lines = [];
    for (const item of ["WATER", "ORS", "TOWEL"]) if (chance(item === "WATER" ? 0.8 : 0.4)) lines.push({ item, qty: int(1, 6) });
    if (!lines.length) lines.push({ item: "WATER", qty: int(2, 6) });
    if (lines.some((l) => lv(l.item, "COUNTER") < l.qty)) continue;
    const total = lines.reduce((t2, l) => t2 + l.qty * SALE_PRICE[l.item], 0);
    const method = chance(0.55) ? "CASH" : "PROMPTPAY";
    const who = chance(0.85) ? "staff" : "manager";
    saleNo++;
    n.sales++;
    const ref = `(SELECT max(id) FROM counter_sales WHERE created_at = ${ts(t)} AND total_amount = ${total})`;
    S(`INSERT INTO counter_sales(total_amount, method, staff_user_id, created_at) VALUES (${total}, ${sq(method)}, ${STAFF[who]}, ${ts(t)});`);
    for (const l of lines) {
      n.saleItems++;
      S(`INSERT INTO counter_sale_items(sale_id, item_id, qty, unit_price) VALUES (${ref}, ${sq(l.item)}, ${l.qty}, ${SALE_PRICE[l.item]});`);
      mv(l.item, "SALE", l.qty, "COUNTER", null, null, who, ref, t);
      setLv(l.item, "COUNTER", lv(l.item, "COUNTER") - l.qty);
    }
    audit(who, "STOCK_SALE", `sale-${saleNo}`, { total, method, items: lines }, t);
  }
}
// damage + adjust (BR-36: reason required)
{
  const t1 = bkk("2026-08-20", 21, 15);
  mv("BALL", "DAMAGE", 1, "COUNTER", null, "ลูกบอลรั่ว", "manager", null, t1);
  setLv("BALL", "COUNTER", lv("BALL", "COUNTER") - 1);
  audit("manager", "STOCK_DAMAGE", "BALL", { locationId: "COUNTER", qty: 1, reason: "ลูกบอลรั่ว" }, t1);
  const t2 = bkk("2026-09-30", 23, 30);
  mv("WATER", "ADJUST", 3, "STORE", null, "นับสต็อกสิ้นเดือน ขาด 3 ขวด", "manager", null, t2);
  setLv("WATER", "STORE", lv("WATER", "STORE") - 3);
  audit("manager", "STOCK_ADJUST", "WATER", { locationId: "STORE", delta: -3, reason: "นับสต็อกสิ้นเดือน ขาด 3 ขวด" }, t2);
  const t3 = bkk("2026-09-30", 23, 40);
  mv("TOWEL", "ADJUST", 2, null, "COUNTER", "นับสต็อกสิ้นเดือน เกิน 2 ผืน", "manager", null, t3);
  setLv("TOWEL", "COUNTER", lv("TOWEL", "COUNTER") + 2);
  audit("manager", "STOCK_ADJUST", "TOWEL", { locationId: "COUNTER", delta: 2, reason: "นับสต็อกสิ้นเดือน เกิน 2 ผืน" }, t3);
}
for (const [k, v] of Object.entries(level)) {
  const [item, loc] = k.split("|");
  if (stockNow[k] !== v) S(`UPDATE stock_levels SET qty = ${v} WHERE item_id = ${sq(item)} AND location_id = ${sq(loc)};`);
}
// rental_items (v1 table kept for rollback, ADR-18) follows the rental total
S(`UPDATE rental_items r SET stock = (SELECT sum(qty) FROM stock_levels l WHERE l.item_id = r.id) WHERE r.id IN ('BIB', 'BALL');`);
if (SET_CLOCK) {
  S("DELETE FROM app_settings WHERE key = 'clock';");
  S(`INSERT INTO app_settings(key, value) VALUES ('clock', ${sq(iso(NOW_T))});`);
}
S("SELECT set_config('app.actor', '', true), set_config('app.now', '', true);");
S("COMMIT;");

const sql = out.join("\n") + "\n";
if (SQL_OUT) writeFileSync(SQL_OUT, sql, "utf8");
console.log(`ชุดข้อมูล (SEED ${SEED} · NOW ${NOW}): ` + JSON.stringify({ ...n, statusCount }));
if (DRY) process.exit(0);

const before = counts(CONTAINER);
const t0 = Date.now();
psqlRun(sql, { input: true });
const after = counts(CONTAINER);
console.log(`เขียนลงฐานแล้วใน ${Date.now() - t0} ms · นาฬิกาแอป ${SET_CLOCK ? "ตั้งเป็น " + NOW : "ไม่แตะ"}`);
console.log("ตาราง | ก่อน | หลัง | เพิ่ม");
for (const k of Object.keys(after)) console.log(`${k} | ${before[k]} | ${after[k]} | ${after[k] - (before[k] ?? 0)}`);
