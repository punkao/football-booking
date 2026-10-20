// Back office (FR-36, FR-42 – FR-44, FR-47 · BR-39 – BR-41, BR-44, BR-45 · NFR-22 · ADR-19).
// BR-44: dashboard / all bookings + history / chats / low-stock → OWNER + MANAGER · reports + AuditLog → OWNER only.
import {
  AUDIT_ACTIONS,
  PHONE_IN_TEXT,
  addDays,
  canAccess,
  chatNeedsRedaction,
  checkReportRange,
  historyActorLabel,
  isBelowReorder,
  isBlocking,
  isValidDateStr,
  maskPhone,
  popularHours,
  redactText,
  redactionDue,
  isCustomerPhone,
  summarizeMoney,
  toCsv,
  todayOf,
  utilizationPercent,
  CHAT_RETENTION_DAYS,
  DAY_MS,
} from "@/lib/rules";
import type { Area, MoneyRow } from "@/lib/rules";
import { extractName } from "@/lib/chat/mock";
import { AppError, fail, requireStaff, str } from "./core";
import type { Ctx, StaffRow } from "./core";
import { audit, q, tx } from "./db";
import { chatRef } from "./crypto";
import { loadFields } from "./data";

async function requireArea(ctx: Ctx, area: Area): Promise<StaffRow> {
  const s = await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  if (!canAccess(s.role, area)) throw new AppError("FORBIDDEN_ROLE");
  return s;
}

const BKK_DAY = (col: string) => `to_char(${col} AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD')`;

async function moneyRows(from: string, to: string): Promise<{ payments: MoneyRow[]; sales: MoneyRow[] }> {
  const payments = await q<MoneyRow>(
    `SELECT ${BKK_DAY("paid_at")} AS day, amount, method FROM payments
      WHERE (paid_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date`,
    [from, to],
  );
  const sales = await q<MoneyRow>(
    `SELECT ${BKK_DAY("created_at")} AS day, total_amount AS amount, method FROM counter_sales
      WHERE (created_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date`,
    [from, to],
  );
  return { payments, sales };
}

/** credit customers spent (not money, shown as "หักเครดิต" · BR-40 / A-37), by the day it was used */
async function creditUsedByDay(from: string, to: string): Promise<Map<string, number>> {
  const rows = await q<{ day: string; s: number }>(
    `SELECT ${BKK_DAY("created_at")} AS day, -sum(amount)::int AS s FROM credit_entries
      WHERE reason = 'USED' AND (created_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date GROUP BY 1`,
    [from, to],
  );
  return new Map(rows.map((r) => [r.day, r.s]));
}

// ---------- FR-42 dashboard ----------
export async function dashboard(ctx: Ctx, dateParam: string | null) {
  await requireArea(ctx, "DASHBOARD");
  const today = dateParam && isValidDateStr(dateParam) ? dateParam : todayOf(ctx.now);
  const from = addDays(today, -6);
  const { payments, sales } = await moneyRows(from, today);
  const week = summarizeMoney(from, today, payments, sales, ctx.bug);
  const credit = await creditUsedByDay(today, today);
  const fields = await loadFields(null);
  const dayBookings = await q<{ field_id: string; hours: number; status: string; start_hour: number }>(
    "SELECT field_id, hours, status, start_hour FROM bookings WHERE date = $1",
    [today],
  );
  const weekBookings = await q<{ start_hour: number; status: string }>("SELECT start_hour, status FROM bookings WHERE date BETWEEN $1 AND $2", [from, today]);
  const lowStock = await q<{ id: string; total: number; reorder_point: number | null }>(
    "SELECT i.id, COALESCE(sum(l.qty), 0)::int AS total, i.reorder_point FROM stock_items i LEFT JOIN stock_levels l ON l.item_id = i.id GROUP BY i.id",
  );
  const counts: Record<string, number> = {};
  for (const b of dayBookings) counts[b.status] = (counts[b.status] ?? 0) + 1;
  return {
    date: today,
    from,
    today: { ...week.days[week.days.length - 1], creditUsed: credit.get(today) ?? 0 },
    week: week.days,
    weekTotal: week.total,
    utilization: fields.map((f) => {
      const hours = dayBookings.filter((b) => b.field_id === f.id && isBlocking(b.status)).reduce((s, b) => s + b.hours, 0);
      return { fieldId: f.id, hours, percent: utilizationPercent(hours) };
    }),
    popularHours: popularHours(weekBookings.map((b) => ({ startHour: b.start_hour, status: b.status }))),
    bookingsByStatus: counts,
    lowStockCount: lowStock.filter((i) => isBelowReorder(i.total, i.reorder_point, ctx.bug)).length,
  };
}

// ---------- FR-43 all bookings + status history ----------
export async function bookingsSearch(ctx: Ctx, f: { code?: string | null; phone?: string | null; date?: string | null }) {
  await requireArea(ctx, "BOOKINGS");
  const where: string[] = [];
  const params: unknown[] = [];
  const code = str(f.code).toUpperCase();
  const phone = str(f.phone).replace(/[\s-]/g, "");
  if (code) {
    params.push(`%${code}%`);
    where.push(`b.code ILIKE $${params.length}`);
  }
  if (phone) {
    params.push(`%${phone}%`);
    where.push(`c.phone LIKE $${params.length}`);
  }
  if (f.date && isValidDateStr(f.date)) {
    params.push(f.date);
    where.push(`b.date = $${params.length}`);
  }
  const rows = await q<Record<string, unknown>>(
    `SELECT b.code, b.field_id, b.date, b.start_hour, b.hours, b.status, b.total_price, b.amount_paid, b.due_at_field, b.credit_used,
            COALESCE(NULLIF(b.customer_name, ''), c.name) AS customer_name, c.phone
       FROM bookings b JOIN customers c ON c.id = b.customer_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY b.date DESC, b.start_hour DESC, b.id DESC LIMIT 100`,
    params,
  );
  return {
    bookings: rows.map((r) => ({
      code: r.code,
      fieldId: r.field_id,
      date: r.date,
      startHour: r.start_hour,
      hours: r.hours,
      status: r.status,
      totalPrice: r.total_price,
      amountPaid: r.amount_paid,
      dueAtField: r.due_at_field,
      creditUsed: r.credit_used,
      customerName: r.customer_name,
      phone: r.phone,
    })),
  };
}

export async function bookingHistory(ctx: Ctx, code: string) {
  await requireArea(ctx, "BOOKINGS");
  const b = (
    await q<Record<string, unknown>>(
      `SELECT b.id, b.code, b.field_id, b.date, b.start_hour, b.hours, b.status, b.total_price, b.amount_paid, b.due_at_field, b.credit_used,
              b.payment_plan, COALESCE(NULLIF(b.customer_name, ''), c.name) AS customer_name, c.phone
         FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.code = $1`,
      [code],
    )
  )[0];
  if (!b) throw new AppError("BOOKING_NOT_FOUND");
  // CR-02 (2) / A-44: the staff display name is looked up when reading (history rows are append-only and keep the username)
  const h = await q<{ from_status: string | null; to_status: string; actor: string; created_at: Date; staff_name: string | null }>(
    `SELECT h.from_status, h.to_status, h.actor, h.created_at, s.name AS staff_name
       FROM booking_status_history h LEFT JOIN staff_users s ON s.username = h.actor
      WHERE h.booking_id = $1 ORDER BY h.created_at, h.id`,
    [b.id],
  );
  const payments = await q<{ amount: number; method: string; paid_at: Date }>("SELECT amount, method, paid_at FROM payments WHERE booking_id = $1 ORDER BY paid_at, id", [b.id]);
  return {
    booking: {
      code: b.code, fieldId: b.field_id, date: b.date, startHour: b.start_hour, hours: b.hours, status: b.status, paymentPlan: b.payment_plan,
      totalPrice: b.total_price, amountPaid: b.amount_paid, dueAtField: b.due_at_field, creditUsed: b.credit_used,
      customerName: b.customer_name, phone: b.phone,
    },
    payments: payments.map((p) => ({ amount: p.amount, method: p.method, paidAt: p.paid_at })),
    history: h.map((x) => ({ fromStatus: x.from_status, toStatus: x.to_status, actor: x.actor, actorLabel: historyActorLabel(x.actor, ctx.lang, x.staff_name), at: x.created_at })),
  };
}

// ---------- FR-44 reports (BR-39, BR-40, T-20) ----------
export async function report(ctx: Ctx, from: string | null, to: string | null) {
  await requireArea(ctx, "REPORTS");
  fail(checkReportRange(from, to));
  const f = from as string;
  const t = to as string;
  const { payments, sales } = await moneyRows(f, t);
  const money = summarizeMoney(f, t, payments, sales, ctx.bug);
  const credit = await creditUsedByDay(f, t);
  // counted by the day of play (BR-40 / T-20)
  const bk = await q<{ day: string; status: string; n: number; discount: number; rental: number; free: number }>(
    `SELECT to_char(date, 'YYYY-MM-DD') AS day, status, count(*)::int AS n, sum(discount)::int AS discount, sum(rental_price)::int AS rental,
            count(*) FILTER (WHERE free_hour_used)::int AS free
       FROM bookings WHERE date BETWEEN $1 AND $2 GROUP BY 1, 2`,
    [f, t],
  );
  const days = money.days.map((d) => {
    const rows = bk.filter((x) => x.day === d.date);
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = r.n;
    return {
      ...d,
      creditUsed: credit.get(d.date) ?? 0,
      bookings: rows.reduce((s, r) => s + r.n, 0),
      byStatus,
      noShow: byStatus.NO_SHOW ?? 0,
      discount: rows.reduce((s, r) => s + r.discount, 0),
      rentalPrice: rows.reduce((s, r) => s + r.rental, 0),
      freeHours: rows.reduce((s, r) => s + r.free, 0),
    };
  });
  const sum = (k: "creditUsed" | "bookings" | "noShow" | "discount" | "rentalPrice" | "freeHours") => days.reduce((s, d) => s + d[k], 0);
  return {
    from: f,
    to: t,
    days,
    totals: {
      bookingMoney: money.bookingMoney,
      salesCash: money.salesCash,
      salesPromptpay: money.salesPromptpay,
      salesMoney: money.salesMoney,
      total: money.total,
      creditUsed: sum("creditUsed"),
      bookings: sum("bookings"),
      noShow: sum("noShow"),
      discount: sum("discount"),
      rentalPrice: sum("rentalPrice"),
      freeHours: sum("freeHours"),
    },
  };
}

const CSV_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "NO_SHOW", "CANCELLED", "EXPIRED", "RAIN_CLOSED"];

/** NFR-22 / ADR-19: same numbers as the JSON report, UTF-8 BOM, Thai headers, escaped text · AuditLog REPORT_EXPORT */
export async function reportCsv(ctx: Ctx, from: string | null, to: string | null): Promise<Response> {
  const staff = await requireArea(ctx, "REPORTS");
  const r = await report(ctx, from, to);
  const header = [
    "วันที่", "ยอดจอง (บาท)", "ขายเงินสด (บาท)", "ขายพร้อมเพย์ (บาท)", "ยอดขายรวม (บาท)", "รวมรับเงิน (บาท)", "หักเครดิต (บาท)",
    "จำนวนการจอง (วันเตะ)", ...CSV_STATUSES.map((s) => `สถานะ ${s}`), "ส่วนลด (บาท)", "ค่าของเช่า (บาท)", "ชั่วโมงฟรีที่ใช้",
  ];
  const rows = r.days.map((d) => [
    d.date, d.bookingMoney, d.salesCash, d.salesPromptpay, d.salesMoney, d.total, d.creditUsed, d.bookings,
    ...CSV_STATUSES.map((s) => d.byStatus[s] ?? 0), d.discount, d.rentalPrice, d.freeHours,
  ]);
  rows.push([
    "รวม", r.totals.bookingMoney, r.totals.salesCash, r.totals.salesPromptpay, r.totals.salesMoney, r.totals.total, r.totals.creditUsed, r.totals.bookings,
    ...CSV_STATUSES.map((s) => r.days.reduce((a, d) => a + (d.byStatus[s] ?? 0), 0)), r.totals.discount, r.totals.rentalPrice, r.totals.freeHours,
  ]);
  const csv = toCsv(header, rows);
  await tx(async (c) => audit(c, staff.id, "REPORT_EXPORT", `${r.from}..${r.to}`, { from: r.from, to: r.to, rows: r.days.length }, ctx.now));
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="report-${r.from}-${r.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}

// ---------- FR-36 / BR-45 chats ----------
type RedactState = { __lnRedactAt?: Date | null };
const rg = globalThis as unknown as RedactState;

/**
 * BR-45: messages older than 90 days lose names and phone numbers (lazy, like the payment expiry · ADR-03).
 * R3: each message is handled once (`redacted_at`), and the job runs at most once an hour of the app clock.
 */
export async function redactOldChats(now: Date): Promise<number> {
  if (!redactionDue(rg.__lnRedactAt ?? null, now)) return 0;
  rg.__lnRedactAt = now;
  const limit = new Date(now.getTime() - CHAT_RETENTION_DAYS * DAY_MS);
  const todo = (
    await q<{ id: number; session_id: string; text: string; created_at: Date }>(
      "SELECT id, session_id, text, created_at FROM chat_messages WHERE redacted_at IS NULL AND created_at < $1 ORDER BY session_id, id",
      [limit],
    )
  ).filter((r) => chatNeedsRedaction(new Date(r.created_at), now));
  if (!todo.length) return 0;
  const sessions = [...new Set(todo.map((r) => r.session_id))];
  const names = new Map<string, string[]>();
  const booked = await q<{ session_id: string; name: string }>(
    `SELECT DISTINCT m.session_id, b.customer_name AS name FROM chat_messages m JOIN bookings b ON b.code = m.booking_code
      WHERE m.session_id = ANY($1::uuid[])`,
    [sessions],
  );
  const typed = await q<{ session_id: string; text: string }>("SELECT session_id, text FROM chat_messages WHERE role = 'USER' AND session_id = ANY($1::uuid[])", [sessions]);
  for (const sid of sessions) {
    names.set(sid, [
      ...booked.filter((x) => x.session_id === sid).map((x) => x.name),
      ...typed.filter((x) => x.session_id === sid).map((t) => extractName(t.text) ?? "").filter(Boolean),
    ]);
  }
  let changed = 0;
  await tx(async (c) => {
    await c.query("SELECT set_config('app.redact', 'on', true)");
    for (const r of todo) {
      const next = redactText(r.text, names.get(r.session_id) ?? []);
      await c.query("UPDATE chat_messages SET text = $2, redacted_at = $3 WHERE id = $1", [r.id, next, now]);
      if (next !== r.text) changed++;
    }
  });
  return changed;
}

/** R3: test reset empties the chat tables — the next request may run the job again */
export function forgetRedactionRun(): void {
  rg.__lnRedactAt = null;
}

const maskText = (s: string) => s.replace(PHONE_IN_TEXT, (m) => (isCustomerPhone(m) ? maskPhone(m) : m));

export async function chatsList(ctx: Ctx, from: string | null, to: string | null) {
  await requireArea(ctx, "CHATS");
  await redactOldChats(ctx.now);
  const where: string[] = [];
  const params: unknown[] = [];
  if (from && isValidDateStr(from)) {
    params.push(from);
    where.push(`(s.last_message_at AT TIME ZONE 'Asia/Bangkok')::date >= $${params.length}::date`);
  }
  if (to && isValidDateStr(to)) {
    params.push(to);
    where.push(`(s.last_message_at AT TIME ZONE 'Asia/Bangkok')::date <= $${params.length}::date`);
  }
  const rows = await q<Record<string, unknown>>(
    `SELECT s.id, s.lang, s.created_at, s.last_message_at, c.phone,
            (SELECT count(*)::int FROM chat_messages m WHERE m.session_id = s.id) AS messages,
            (SELECT text FROM chat_messages m WHERE m.session_id = s.id AND m.role = 'USER' ORDER BY m.id LIMIT 1) AS first_text,
            (SELECT array_agg(DISTINCT m.booking_code) FROM chat_messages m WHERE m.session_id = s.id AND m.booking_code IS NOT NULL) AS codes
       FROM chat_sessions s LEFT JOIN customers c ON c.id = s.customer_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY s.last_message_at DESC LIMIT 100`,
    params,
  );
  return {
    // R11: the back office never sees the room id (= the customer's cookie value), only an HMAC reference
    chats: rows.map((r) => ({
      ref: chatRef(String(r.id)),
      lang: r.lang,
      createdAt: r.created_at,
      lastMessageAt: r.last_message_at,
      messages: r.messages,
      firstText: maskText(String(r.first_text ?? "")).slice(0, 80),
      bookingCodes: (r.codes as string[] | null) ?? [],
      customerPhone: r.phone ? maskPhone(String(r.phone)) : null,
    })),
  };
}

export async function chatDetail(ctx: Ctx, ref: string) {
  await requireArea(ctx, "CHATS");
  await redactOldChats(ctx.now);
  if (!/^[0-9a-f]{32}$/.test(ref)) throw new AppError("CHAT_SESSION_NOT_FOUND");
  const ids = await q<{ id: string }>("SELECT id FROM chat_sessions");
  const id = ids.find((x) => chatRef(String(x.id)) === ref)?.id;
  if (!id) throw new AppError("CHAT_SESSION_NOT_FOUND");
  const s = (await q<Record<string, unknown>>("SELECT s.id, s.lang, s.created_at, s.last_message_at, c.phone FROM chat_sessions s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = $1", [id]))[0];
  if (!s) throw new AppError("CHAT_SESSION_NOT_FOUND");
  const msgs = await q<{ id: number; role: string; text: string; booking_code: string | null; created_at: Date }>(
    "SELECT id, role, text, booking_code, created_at FROM chat_messages WHERE session_id = $1 ORDER BY id",
    [id],
  );
  return {
    chat: { ref, lang: s.lang, createdAt: s.created_at, lastMessageAt: s.last_message_at, customerPhone: s.phone ? maskPhone(String(s.phone)) : null },
    messages: msgs.map((m) => ({ id: m.id, role: m.role, text: maskText(m.text), bookingCode: m.booking_code, createdAt: m.created_at })),
  };
}

// ---------- FR-47 AuditLog (read only) ----------
export async function auditList(ctx: Ctx, f: { from?: string | null; to?: string | null; staffUserId?: string | null; action?: string | null }) {
  await requireArea(ctx, "AUDIT");
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.from && isValidDateStr(f.from)) {
    params.push(f.from);
    where.push(`(a.created_at AT TIME ZONE 'Asia/Bangkok')::date >= $${params.length}::date`);
  }
  if (f.to && isValidDateStr(f.to)) {
    params.push(f.to);
    where.push(`(a.created_at AT TIME ZONE 'Asia/Bangkok')::date <= $${params.length}::date`);
  }
  if (f.staffUserId && /^\d+$/.test(f.staffUserId)) {
    params.push(Number(f.staffUserId));
    where.push(`a.staff_user_id = $${params.length}`);
  }
  if (f.action && (AUDIT_ACTIONS as readonly string[]).includes(f.action)) {
    params.push(f.action);
    where.push(`a.action = $${params.length}`);
  }
  const rows = await q<Record<string, unknown>>(
    `SELECT a.id, a.action, a.target, a.detail, a.created_at, s.id AS staff_id, s.username, s.name
       FROM audit_logs a JOIN staff_users s ON s.id = a.staff_user_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY a.created_at DESC, a.id DESC LIMIT 300`,
    params,
  );
  const staff = await q<{ id: number; username: string; name: string; role: string }>("SELECT id, username, name, role FROM staff_users ORDER BY id");
  return {
    actions: AUDIT_ACTIONS,
    staff,
    entries: rows.map((r) => ({ id: r.id, action: r.action, target: r.target, detail: r.detail, at: r.created_at, staffUserId: r.staff_id, username: r.username, staffName: r.name })),
  };
}
