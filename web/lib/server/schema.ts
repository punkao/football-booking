import type { Pool, PoolClient } from "pg";
import { addDays, computePrice, fieldPriceFor, payDeadlineFrom, paymentPlanFor, slotStart, todayOf, MINUTE_MS, DAY_MS } from "@/lib/rules";
import { hashPassword } from "./crypto";

type Q = Pick<PoolClient, "query">;

// 13 contract tables (07-SAD section 5) + app_settings for the locked clock (ADR-04)
export const DDL = `
CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text);
CREATE TABLE IF NOT EXISTS fields (
  id text PRIMARY KEY, name text NOT NULL, size int NOT NULL, covered boolean NOT NULL,
  day_rate int NOT NULL, evening_rate int NOT NULL, photo text NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY, name text NOT NULL, phone text NOT NULL UNIQUE, password_hash text,
  credit_balance int NOT NULL DEFAULT 0, paid_hours int NOT NULL DEFAULT 0, free_hours_used int NOT NULL DEFAULT 0,
  banned_until timestamptz
);
CREATE TABLE IF NOT EXISTS recurring_series (
  id serial PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id), field_id text NOT NULL REFERENCES fields(id),
  weekday int NOT NULL, start_hour int NOT NULL, hours int NOT NULL, weeks_requested int NOT NULL,
  weeks_booked int NOT NULL, discount_percent int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id serial PRIMARY KEY, code text NOT NULL UNIQUE, customer_id int NOT NULL REFERENCES customers(id),
  field_id text NOT NULL REFERENCES fields(id), date date NOT NULL, start_hour int NOT NULL, hours int NOT NULL,
  status text NOT NULL, payment_plan text NOT NULL, field_price int NOT NULL, discount int NOT NULL DEFAULT 0,
  rental_price int NOT NULL DEFAULT 0, credit_used int NOT NULL DEFAULT 0, free_hour_used boolean NOT NULL DEFAULT false,
  total_price int NOT NULL, pay_now int NOT NULL, amount_paid int NOT NULL DEFAULT 0, due_at_field int NOT NULL,
  pay_deadline timestamptz NOT NULL, consent_at timestamptz NOT NULL, reschedule_count int NOT NULL DEFAULT 0,
  series_id int REFERENCES recurring_series(id), created_at timestamptz NOT NULL,
  checked_in_at timestamptz, no_show_at timestamptz, split_token text UNIQUE
);
-- phase 7.5 (BR-26, A-20): the name typed for each booking; added in place on databases created before 7.5
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS bookings_field_date ON bookings(field_id, date);
CREATE INDEX IF NOT EXISTS bookings_customer ON bookings(customer_id);
CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY, booking_id int NOT NULL REFERENCES bookings(id), amount int NOT NULL,
  method text NOT NULL, paid_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS credit_entries (
  id serial PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id), amount int NOT NULL,
  reason text NOT NULL, booking_id int REFERENCES bookings(id), created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS holidays (date date PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS staff_users (
  id serial PRIMARY KEY, name text NOT NULL, username text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL
);
CREATE TABLE IF NOT EXISTS field_closures (
  id serial PRIMARY KEY, field_id text NOT NULL REFERENCES fields(id), date date NOT NULL, from_hour int NOT NULL,
  to_hour int NOT NULL, created_by int REFERENCES staff_users(id), created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS rental_items (id text PRIMARY KEY, name text NOT NULL, price int NOT NULL, stock int NOT NULL);
CREATE TABLE IF NOT EXISTS booking_rentals (
  booking_id int NOT NULL REFERENCES bookings(id), item_id text NOT NULL REFERENCES rental_items(id),
  qty int NOT NULL, returned_qty int NOT NULL DEFAULT 0, PRIMARY KEY (booking_id, item_id)
);
CREATE TABLE IF NOT EXISTS split_shares (
  id serial PRIMARY KEY, booking_id int NOT NULL REFERENCES bookings(id), member_name text NOT NULL,
  amount int NOT NULL, paid_at timestamptz
);
CREATE TABLE IF NOT EXISTS challenges (
  id serial PRIMARY KEY, booking_id int NOT NULL REFERENCES bookings(id), team_name text NOT NULL, level text NOT NULL,
  status text NOT NULL, accept_customer_id int REFERENCES customers(id), amount int NOT NULL, pay_deadline timestamptz,
  created_at timestamptz NOT NULL
);
CREATE SEQUENCE IF NOT EXISTS booking_code_seq START 100001;
`;

const ALL_TABLES =
  "booking_rentals, split_shares, challenges, payments, credit_entries, field_closures, bookings, recurring_series, customers, staff_users, holidays, rental_items, fields";

export async function initDatabase(pool: Pool): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("SELECT pg_advisory_lock(424242)");
    await c.query(DDL);
    const r = await c.query("SELECT count(*)::int AS n FROM fields");
    if (r.rows[0].n === 0) {
      const clock = await c.query("SELECT value FROM app_settings WHERE key = 'clock'");
      const now = clock.rows[0]?.value ? new Date(clock.rows[0].value) : new Date();
      await c.query("BEGIN");
      await seed(c, now);
      await c.query("COMMIT");
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.query("SELECT pg_advisory_unlock(424242)").catch(() => undefined);
    c.release();
  }
}

/** NFR-10: wipe everything, seed again relative to `now`, lock the clock */
export async function resetDatabase(c: Q, now: Date | null): Promise<void> {
  await c.query(`TRUNCATE ${ALL_TABLES} RESTART IDENTITY CASCADE`);
  await c.query("ALTER SEQUENCE booking_code_seq RESTART WITH 100001");
  await c.query("DELETE FROM app_settings WHERE key = 'clock'");
  if (now) await c.query("INSERT INTO app_settings(key, value) VALUES ('clock', $1)", [now.toISOString()]);
  await seed(c, now ?? new Date());
}

export const SEED_HOLIDAYS: [string, string][] = [
  ["2026-10-13", "วันคล้ายวันสวรรคต รัชกาลที่ 9"],
  ["2026-10-23", "วันปิยมหาราช"],
  ["2026-12-05", "วันพ่อแห่งชาติ"],
  ["2026-12-10", "วันรัฐธรรมนูญ"],
  ["2026-12-31", "วันสิ้นปี"],
];

export const SEED_FIELDS = [
  { id: "A", name: "สนาม A", size: 5, covered: false, dayRate: 800, eveningRate: 1200 },
  { id: "B", name: "สนาม B", size: 5, covered: false, dayRate: 800, eveningRate: 1200 },
  { id: "C", name: "สนาม C", size: 7, covered: true, dayRate: 1200, eveningRate: 1800 },
];

const hashCache = new Map<string, string>();
function cachedHash(pw: string): string {
  let h = hashCache.get(pw);
  if (!h) {
    h = hashPassword(pw);
    hashCache.set(pw, h);
  }
  return h;
}

async function seed(c: Q, now: Date): Promise<void> {
  for (const [date, name] of SEED_HOLIDAYS) await c.query("INSERT INTO holidays(date, name) VALUES ($1, $2)", [date, name]);
  for (const f of SEED_FIELDS) {
    await c.query("INSERT INTO fields(id, name, size, covered, day_rate, evening_rate, photo) VALUES ($1,$2,$3,$4,$5,$6,$7)", [
      f.id, f.name, f.size, f.covered, f.dayRate, f.eveningRate, `svg:field-${f.id}`,
    ]);
  }
  await c.query("INSERT INTO rental_items(id, name, price, stock) VALUES ('BIB', 'เอี๊ยม', 50, 6), ('BALL', 'ลูกบอล', 30, 10)");
  const staff: [string, string, string, string][] = [
    ["คุณเอก", "owner", "Owner1234", "OWNER"],
    ["คุณฝ้าย", "manager", "Manager1234", "MANAGER"],
    ["น้องบอล", "staff", "Staff1234", "STAFF"],
  ];
  for (const [name, username, pw, role] of staff) {
    await c.query("INSERT INTO staff_users(name, username, password_hash, role) VALUES ($1,$2,$3,$4)", [name, username, cachedHash(pw), role]);
  }
  // customers: ต้น(1) มิว(2) โจ้(3) แนน(4)
  const customers: [string, string, string | null, number, number][] = [
    ["ต้น", "0811111111", "Ton12345", 1200, 7],
    ["มิว", "0822222222", "Mew12345", 0, 10],
    ["โจ้", "0833333333", "Joe12345", 0, 0],
    ["แนน", "0844444444", null, 0, 0],
  ];
  for (const [name, phone, pw, credit, hours] of customers) {
    await c.query("INSERT INTO customers(name, phone, password_hash, credit_balance, paid_hours) VALUES ($1,$2,$3,$4,$5)", [
      name, phone, pw ? cachedHash(pw) : null, credit, hours,
    ]);
  }
  await c.query("INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) VALUES (1, 1200, 'RAIN', NULL, $1)", [
    new Date(now.getTime() - 10 * DAY_MS),
  ]);

  const holidays = SEED_HOLIDAYS.map((h) => h[0]);
  const today = todayOf(now);
  const seedBookings = [
    { code: "LN-900001", customerId: 1, fieldId: "A", date: today, startHour: 19, hours: 2, status: "CONFIRMED" },
    { code: "LN-900002", customerId: 3, fieldId: "C", date: addDays(today, 1), startHour: 18, hours: 1, status: "CONFIRMED" },
    { code: "LN-900003", customerId: 3, fieldId: "B", date: addDays(today, -5), startHour: 19, hours: 1, status: "NO_SHOW" },
    { code: "LN-900004", customerId: 4, fieldId: "B", date: addDays(today, 2), startHour: 9, hours: 1, status: "CONFIRMED" },
  ];
  const seedNames = Object.fromEntries(customers.map(([name], i) => [i + 1, name]));
  for (const b of seedBookings) {
    const field = SEED_FIELDS.find((f) => f.id === b.fieldId)!;
    const fieldPrice = fieldPriceFor(field, b.date, b.startHour, b.hours, holidays);
    // seed always uses the correct rules (bug mode off) so the seed is identical in both modes
    const price = computePrice({ fieldPrice, paymentPlan: paymentPlanFor(b.date, b.startHour, false) });
    const start = slotStart(b.date, b.startHour);
    const createdAt = new Date(Math.min(now.getTime(), start.getTime()) - DAY_MS);
    const noShowAt = b.status === "NO_SHOW" ? new Date(start.getTime() + 15 * MINUTE_MS) : null;
    const r = await c.query(
      `INSERT INTO bookings(code, customer_id, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
        rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at,
        reschedule_count, created_at, no_show_at, customer_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,0,false,$10,$11,$11,$12,$13,$14,0,$14,$15,$16) RETURNING id`,
      [b.code, b.customerId, b.fieldId, b.date, b.startHour, b.hours, b.status, price.paymentPlan, price.fieldPrice,
        price.totalPrice, price.payNow, price.dueAtField, payDeadlineFrom(createdAt), createdAt, noShowAt, seedNames[b.customerId]],
    );
    await c.query("INSERT INTO payments(booking_id, amount, method, paid_at) VALUES ($1, $2, 'PROMPTPAY', $3)", [
      r.rows[0].id, price.payNow, new Date(createdAt.getTime() + 5 * MINUTE_MS),
    ]);
  }
}
