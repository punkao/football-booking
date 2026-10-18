import type { Db } from "./db";
import { pool } from "./db";

export type FieldRow = { id: string; name: string; size: number; covered: boolean; dayRate: number; eveningRate: number; photo: string };
export type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  passwordHash: string | null;
  creditBalance: number;
  paidHours: number;
  freeHoursUsed: number;
  bannedUntil: Date | null;
};
export type BookingRow = {
  id: number;
  code: string;
  customerId: number;
  /** BR-26 / A-20: name typed for this booking ("" only for rows created before phase 7.5) */
  customerName: string;
  fieldId: string;
  date: string;
  startHour: number;
  hours: number;
  status: string;
  paymentPlan: "DEPOSIT_50" | "FULL_100";
  fieldPrice: number;
  discount: number;
  rentalPrice: number;
  creditUsed: number;
  freeHourUsed: boolean;
  totalPrice: number;
  payNow: number;
  amountPaid: number;
  dueAtField: number;
  payDeadline: Date;
  consentAt: Date;
  rescheduleCount: number;
  seriesId: number | null;
  createdAt: Date;
  checkedInAt: Date | null;
  noShowAt: Date | null;
  splitToken: string | null;
};
export type RentalItemRow = { id: string; name: string; price: number; stock: number };

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
export function toCamel<T>(row: Record<string, unknown>): T {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) o[camel(k)] = v;
  return o as T;
}

async function rows<T>(db: Db | null, sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await (db ?? pool()).query(sql, params);
  return r.rows.map((x: Record<string, unknown>) => toCamel<T>(x));
}

export const loadFields = (db: Db | null) => rows<FieldRow>(db, "SELECT * FROM fields ORDER BY id");
export async function loadField(db: Db | null, id: unknown): Promise<FieldRow | null> {
  if (typeof id !== "string") return null;
  return (await rows<FieldRow>(db, "SELECT * FROM fields WHERE id = $1", [id]))[0] ?? null;
}
export async function loadHolidays(db: Db | null): Promise<{ date: string; name: string }[]> {
  return rows(db, "SELECT date, name FROM holidays ORDER BY date");
}
export async function holidayDates(db: Db | null): Promise<string[]> {
  return (await loadHolidays(db)).map((h) => h.date);
}
/**
 * BR-38 / ADR-18 / T-17: rental price = StockItem.unitPrice and rentable total = stock of every place
 * (rental_items.stock is kept for rollback only and is no longer read).
 */
export const loadRentalItems = (db: Db | null) =>
  rows<RentalItemRow>(
    db,
    `SELECT r.id, r.name, si.unit_price AS price, COALESCE((SELECT sum(l.qty) FROM stock_levels l WHERE l.item_id = r.id), 0)::int AS stock
       FROM rental_items r JOIN stock_items si ON si.id = r.id
      ORDER BY si.unit_price DESC, r.id`,
  );

export async function loadCustomerById(db: Db | null, id: number | null, forUpdate = false): Promise<CustomerRow | null> {
  if (!id) return null;
  return (await rows<CustomerRow>(db, `SELECT * FROM customers WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`, [id]))[0] ?? null;
}
export async function loadCustomerByPhone(db: Db | null, phone: string): Promise<CustomerRow | null> {
  return (await rows<CustomerRow>(db, "SELECT * FROM customers WHERE phone = $1", [phone]))[0] ?? null;
}
/** BR-26: one Customer per phone number */
export async function upsertCustomer(db: Db, name: string, phone: string): Promise<CustomerRow> {
  return (
    await rows<CustomerRow>(
      db,
      `INSERT INTO customers(name, phone) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET name = CASE WHEN customers.name = '' THEN EXCLUDED.name ELSE customers.name END
       RETURNING *`,
      [name, phone],
    )
  )[0];
}

/** BR-26: the booking's own name; falls back to Customer.name only for rows created before phase 7.5 */
export function bookingCustomerName(b: { customerName?: string | null }, customer: { name: string } | null | undefined): string {
  return b.customerName || customer?.name || "";
}

export async function loadBookingByCode(db: Db | null, code: string, forUpdate = false): Promise<BookingRow | null> {
  return (await rows<BookingRow>(db, `SELECT * FROM bookings WHERE code = $1${forUpdate ? " FOR UPDATE" : ""}`, [code]))[0] ?? null;
}
export async function loadDayBookings(db: Db | null, fieldId: string | null, date: string): Promise<BookingRow[]> {
  if (fieldId) return rows<BookingRow>(db, "SELECT * FROM bookings WHERE field_id = $1 AND date = $2 ORDER BY start_hour", [fieldId, date]);
  return rows<BookingRow>(db, "SELECT * FROM bookings WHERE date = $1 ORDER BY field_id, start_hour", [date]);
}
export async function loadClosures(db: Db | null, fieldId: string | null, date: string) {
  return rows<{ id: number; fieldId: string; date: string; fromHour: number; toHour: number; createdAt: Date }>(
    db,
    fieldId ? "SELECT * FROM field_closures WHERE field_id = $1 AND date = $2" : "SELECT * FROM field_closures WHERE date = $1",
    fieldId ? [fieldId, date] : [date],
  );
}
export async function loadBookingRentals(db: Db | null, bookingId: number) {
  return rows<{ bookingId: number; itemId: string; qty: number; returnedQty: number }>(
    db,
    "SELECT * FROM booking_rentals WHERE booking_id = $1 ORDER BY item_id DESC",
    [bookingId],
  );
}
/** rentals of bookings that hold items on a date (BR-22) */
export async function loadDayRentalUses(db: Db | null, date: string, ignoreBookingId?: number) {
  return rows<{ itemId: string; startHour: number; hours: number; qty: number; returnedQty: number }>(
    db,
    `SELECT br.item_id, b.start_hour, b.hours, br.qty, br.returned_qty
       FROM booking_rentals br JOIN bookings b ON b.id = br.booking_id
      WHERE b.date = $1 AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN') AND b.id <> $2`,
    [date, ignoreBookingId ?? -1],
  );
}

export function mapBookingPublic(b: BookingRow) {
  return {
    id: b.id,
    code: b.code,
    customerId: b.customerId,
    customerName: b.customerName ?? "",
    fieldId: b.fieldId,
    date: b.date,
    startHour: b.startHour,
    hours: b.hours,
    status: b.status,
    paymentPlan: b.paymentPlan,
    fieldPrice: b.fieldPrice,
    discount: b.discount,
    freeHourValue: Math.max(0, b.fieldPrice - b.discount + b.rentalPrice - b.totalPrice),
    rentalPrice: b.rentalPrice,
    creditUsed: b.creditUsed,
    freeHourUsed: b.freeHourUsed,
    totalPrice: b.totalPrice,
    netPrice: b.totalPrice - b.creditUsed,
    payNow: b.payNow,
    amountPaid: b.amountPaid,
    dueAtField: b.dueAtField,
    payDeadline: b.payDeadline,
    consentAt: b.consentAt,
    rescheduleCount: b.rescheduleCount,
    seriesId: b.seriesId,
    createdAt: b.createdAt,
    checkedInAt: b.checkedInAt,
    noShowAt: b.noShowAt,
  };
}
