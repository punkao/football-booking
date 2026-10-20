import {
  cancelCredit,
  challengeAmount,
  checkCancel,
  checkChallengeCreate,
  checkClosures,
  checkCredit,
  checkFreeHour,
  checkNoOverlap,
  checkPhone,
  checkRentalQty,
  checkReschedule,
  computePrice,
  discountAmount,
  fieldPriceFor,
  freeHoursAvailable,
  hourlyRate,
  isBanned,
  isFreeHourSlot,
  isHoliday,
  isPaymentInTime,
  isValidDateStr,
  maxRentable,
  normalizePhone,
  payDeadlineFrom,
  paymentPlanFor,
  rentalPriceFor,
  rentalRemaining,
  rescheduleDifference,
  rescheduleSettlement,
  slotStart,
  validateBookingTime,
} from "@/lib/rules";
import type { PriceBreakdown } from "@/lib/rules";
import { AppError, accessCodesFrom, customerIdFrom, fail, num, str } from "./core";
import { LEVEL_LABEL, label } from "@/lib/i18n";
import type { Ctx } from "./core";
import { lockKey, q, tx } from "./db";
import type { Db } from "./db";
import {
  bookingCustomerName,
  holidayDates,
  loadBookingByCode,
  loadBookingRentals,
  loadClosures,
  loadCustomerById,
  loadCustomerByPhone,
  loadDayBookings,
  loadDayRentalUses,
  loadField,
  loadRentalItems,
  mapBookingPublic,
  upsertCustomer,
} from "./data";
import type { BookingRow, CustomerRow, FieldRow } from "./data";

export type RentalReq = { itemId: string; qty: number };

export function parseRentals(v: unknown): RentalReq[] {
  const out: RentalReq[] = [];
  if (Array.isArray(v)) {
    for (const r of v) if (r && typeof r === "object") out.push({ itemId: String((r as RentalReq).itemId), qty: num((r as RentalReq).qty) ?? NaN });
  } else if (v && typeof v === "object") {
    for (const [k, qty] of Object.entries(v)) out.push({ itemId: k, qty: num(qty) ?? NaN });
  }
  return out.filter((r) => !(r.qty === 0));
}

/** BR-22 remaining per item for a range */
export async function rentalAvailability(db: Db | null, date: string, startHour: number, hours: number, bug: boolean, ignoreBookingId?: number) {
  const items = await loadRentalItems(db);
  const uses = await loadDayRentalUses(db, date, ignoreBookingId);
  return items.map((it) => {
    const remaining = rentalRemaining(
      it.stock,
      startHour,
      hours,
      uses.filter((u) => u.itemId === it.id),
    );
    return { id: it.id, name: it.name, price: it.price, stock: it.stock, remaining, maxQty: maxRentable(it.id, remaining) };
  });
}

export type Evaluation = PriceBreakdown & {
  field: FieldRow;
  date: string;
  startHour: number;
  hours: number;
  isHoliday: boolean;
  hourly: { hour: number; rate: number }[];
  rentals: { itemId: string; qty: number; price: number; remaining: number; maxQty: number }[];
  freeHourSlot: boolean;
};

/**
 * Server-side check of every rule for one booking (FR-03, FR-05). Throws AppError on the first failure.
 * Order: field/date → BR-02..05 → closures → BR-06 → BR-22 → BR-16 → BR-24 → BR-15
 */
export async function evaluateBooking(
  db: Db | null,
  ctx: Ctx,
  input: {
    fieldId: unknown;
    date: unknown;
    startHour: unknown;
    hours: unknown;
    rentals: RentalReq[];
    useFreeHour?: boolean;
    creditUsed?: number;
    useCredit?: boolean;
    discountPercent?: number;
    ignoreBookingId?: number;
  },
  customer: CustomerRow | null,
  isMember: boolean,
): Promise<Evaluation> {
  const field = await loadField(db, input.fieldId);
  if (!field) throw new AppError("INVALID_FIELD");
  if (!isValidDateStr(input.date)) throw new AppError("INVALID_DATE");
  const date = input.date;
  fail(validateBookingTime({ date, startHour: input.startHour, hours: input.hours, now: ctx.now, bug: ctx.bug }));
  const startHour = input.startHour as number;
  const hours = input.hours as number;

  fail(checkClosures(startHour, hours, await loadClosures(db, field.id, date)));
  fail(checkNoOverlap(startHour, hours, await loadDayBookings(db, field.id, date), input.ignoreBookingId));

  const avail = await rentalAvailability(db, date, startHour, hours, ctx.bug, input.ignoreBookingId);
  const rentals: Evaluation["rentals"] = [];
  for (const r of input.rentals) {
    const a = avail.find((x) => x.id === r.itemId);
    if (!a) throw new AppError("INVALID_QTY");
    fail(checkRentalQty(r.itemId, r.qty, a.remaining));
    if (r.qty > 0) rentals.push({ itemId: r.itemId, qty: r.qty, price: a.price, remaining: a.remaining, maxQty: a.maxQty });
  }

  if (customer && isBanned(customer.bannedUntil, ctx.now)) {
    throw new AppError("CUSTOMER_BANNED", { date: customer.bannedUntil!.toISOString() });
  }

  const holidays = await holidayDates(db);
  const fieldPrice = fieldPriceFor(field, date, startHour, hours, holidays);
  const discount = discountAmount(fieldPrice, input.discountPercent ?? 0);
  let freeHourValue = 0;
  if (input.useFreeHour) {
    if (!customer || !isMember) throw new AppError("MEMBER_REQUIRED");
    fail(checkFreeHour({ isMember, paidHours: customer.paidHours, freeHoursUsed: customer.freeHoursUsed, date, startHour }));
    freeHourValue = hourlyRate(field, date, startHour, holidays);
  }
  const rentalPrice = rentalPriceFor(rentals, avail);
  const totalBeforeCredit = Math.max(0, fieldPrice - discount - freeHourValue + rentalPrice);
  let creditUsed = 0;
  if (input.useCredit || (input.creditUsed ?? 0) > 0) {
    if (!customer || !isMember) throw new AppError("MEMBER_REQUIRED");
    creditUsed = input.useCredit && input.creditUsed === undefined ? Math.min(customer.creditBalance, totalBeforeCredit) : input.creditUsed ?? 0;
    fail(checkCredit(creditUsed, customer.creditBalance, totalBeforeCredit));
  }
  const price = computePrice({ fieldPrice, discount, freeHourValue, rentalPrice, creditUsed, paymentPlan: paymentPlanFor(date, startHour) });
  const hourly = [];
  for (let h = startHour; h < startHour + hours; h++) hourly.push({ hour: h, rate: hourlyRate(field, date, h, holidays) });
  return { ...price, field, date, startHour, hours, isHoliday: isHoliday(date, holidays), hourly, rentals, freeHourSlot: isFreeHourSlot(date, startHour) };
}

export async function sessionCustomerId(ctx: Ctx): Promise<number | null> {
  return customerIdFrom((n) => ctx.req.cookies.get(n)?.value);
}

/** quote for the price panel (FR-05) — no customer details needed */
export async function quote(ctx: Ctx, b: Record<string, unknown>) {
  const sessionCustomer = await loadCustomerById(null, await sessionCustomerId(ctx));
  const ev = await evaluateBooking(
    null,
    ctx,
    {
      fieldId: b.fieldId,
      date: b.date,
      startHour: num(b.startHour),
      hours: num(b.hours),
      rentals: parseRentals(b.rentals),
      useFreeHour: b.useFreeHour === true,
      useCredit: b.useCredit === true,
      creditUsed: num(b.creditUsed),
    },
    sessionCustomer,
    !!sessionCustomer?.passwordHash,
  );
  return { quote: publicEvaluation(ev) };
}

export function publicEvaluation(ev: Evaluation) {
  const { field, ...rest } = ev;
  return { ...rest, fieldId: field.id, field: { id: field.id, size: field.size, covered: field.covered } };
}

async function nextCode(db: Db): Promise<string> {
  const r = await db.query("SELECT nextval('booking_code_seq') AS n");
  return "LN-" + String(r.rows[0].n);
}

/** BR-12 / BR-15 / BR-23: moving a booking to CONFIRMED uses the reserved credit and free hour */
export async function confirmBooking(db: Db, b: BookingRow, now: Date, payAmount: number): Promise<void> {
  if (b.creditUsed > 0 || b.freeHourUsed) {
    const c = await loadCustomerById(db, b.customerId, true);
    if (!c) throw new AppError("NOT_FOUND");
    if (b.creditUsed > 0) {
      if (c.creditBalance < b.creditUsed) throw new AppError("CREDIT_INSUFFICIENT");
      await db.query("UPDATE customers SET credit_balance = credit_balance - $2 WHERE id = $1", [c.id, b.creditUsed]);
      await db.query("INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) VALUES ($1, $2, 'USED', $3, $4)", [
        c.id, -b.creditUsed, b.id, now,
      ]);
    }
    if (b.freeHourUsed) {
      if (freeHoursAvailable(c.paidHours, c.freeHoursUsed) < 1) throw new AppError("FREE_HOUR_NONE");
      await db.query("UPDATE customers SET free_hours_used = free_hours_used + 1 WHERE id = $1", [c.id]);
    }
  }
  if (payAmount > 0) {
    await db.query("INSERT INTO payments(booking_id, amount, method, paid_at) VALUES ($1, $2, 'PROMPTPAY', $3)", [b.id, payAmount, now]);
  }
  await db.query("UPDATE bookings SET status = 'CONFIRMED', amount_paid = amount_paid + $2 WHERE id = $1", [b.id, payAmount]);
}

/**
 * FR-02 – FR-05: create a booking (PENDING_PAYMENT, or CONFIRMED when nothing to pay).
 * `actor` is who the status history records (BR-42): CUSTOMER on the web.
 */
export async function createBooking(ctx: Ctx, b: Record<string, unknown>, actor = "CUSTOMER") {
  const name = str(b.name);
  const phone = normalizePhone(b.phone);
  const fieldId = str(b.fieldId);
  const date = str(b.date);
  const rentals = parseRentals(b.rentals);
  return tx(async (c) => {
    // ADR-02: one writer per field + date; rentals are shared by every field on the date
    if (fieldId && isValidDateStr(date)) {
      await lockKey(c, `field:${fieldId}:${date}`);
      if (rentals.some((r) => r.qty > 0)) await lockKey(c, `rent:${date}`);
    }
    const existing = phone ? await loadCustomerByPhone(c, phone) : null;
    const sessionId = await sessionCustomerId(ctx);
    const isMember = !!existing?.passwordHash && existing.id === sessionId;
    // validate time/slot/rentals first (FR-03), customer details after
    const ev = await evaluateBooking(
      c,
      ctx,
      {
        fieldId,
        date,
        startHour: num(b.startHour),
        hours: num(b.hours),
        rentals,
        useFreeHour: b.useFreeHour === true,
        useCredit: b.useCredit === true,
        creditUsed: num(b.creditUsed),
      },
      existing,
      isMember,
    );
    if (!name) throw new AppError("NAME_REQUIRED");
    fail(checkPhone(phone));
    if (b.consent !== true) throw new AppError("CONSENT_REQUIRED");

    // BR-26: one Customer per phone; Customer.name is never overwritten — the typed name is kept on the booking (A-20)
    const customer = existing ?? (await upsertCustomer(c, name, phone));
    const code = await nextCode(c);
    const status = ev.netPrice === 0 ? "CONFIRMED" : "PENDING_PAYMENT";
    const r = await c.query(
      `INSERT INTO bookings(code, customer_id, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
         rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at,
         reschedule_count, created_at, customer_name)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING_PAYMENT',$7,$8,$9,$10,$11,$12,$13,$14,0,$15,$16,$17,0,$17,$18) RETURNING id`,
      [code, customer.id, ev.field.id, ev.date, ev.startHour, ev.hours, ev.paymentPlan, ev.fieldPrice, ev.discount, ev.rentalPrice,
        ev.creditUsed, ev.freeHourValue > 0, ev.totalPrice, ev.payNow, ev.dueAtField, payDeadlineFrom(ctx.now), ctx.now, name],
    );
    const id = r.rows[0].id as number;
    for (const rr of ev.rentals) {
      await c.query("INSERT INTO booking_rentals(booking_id, item_id, qty, returned_qty) VALUES ($1, $2, $3, 0)", [id, rr.itemId, rr.qty]);
    }
    if (status === "CONFIRMED") {
      const row = (await loadBookingByCode(c, code))!;
      await confirmBooking(c, row, ctx.now, 0);
    }
    const saved = (await loadBookingByCode(c, code))!;
    return { booking: mapBookingPublic(saved), next: status === "CONFIRMED" ? `/booking/${code}?done=free` : `/pay/${code}` };
  }, { actor, now: ctx.now });
}

// ---------- access (FR-09, NFR-05) ----------
export type Access = { phone?: string; ctx: Ctx; allowStaff?: boolean };

export async function authorizeBooking(b: BookingRow, a: Access): Promise<void> {
  const get = (n: string) => a.ctx.req.cookies.get(n)?.value;
  const sid = await customerIdFrom(get);
  if (sid && sid === b.customerId) return;
  const phone = normalizePhone(a.phone);
  if (phone) {
    const owner = await loadCustomerById(null, b.customerId);
    if (owner?.phone === phone) return;
    throw new AppError("BOOKING_FORBIDDEN");
  }
  if (accessCodesFrom(get).includes(b.code)) return;
  throw new AppError("BOOKING_FORBIDDEN");
}

/**
 * BR-28 (A-18, A-21): is a challenge of this booking MATCHED? With forUpdate the challenge rows are locked
 * (always after the booking row) so a challenge payment can't slip in between the check and the change.
 */
export async function challengeState(db: Db | null, bookingId: number, forUpdate = false): Promise<{ matched: boolean; pending: boolean }> {
  const sql = `SELECT status FROM challenges WHERE booking_id = $1${forUpdate ? " FOR UPDATE" : ""}`;
  const rows = db ? ((await db.query(sql, [bookingId])).rows as { status: string }[]) : await q<{ status: string }>(sql, [bookingId]);
  // lazy expiry (ADR-03) already turned late AWAITING_PAYMENT back to OPEN before every request
  return { matched: rows.some((x) => x.status === "MATCHED"), pending: rows.some((x) => x.status === "AWAITING_PAYMENT") };
}

export async function isChallengeMatched(db: Db | null, bookingId: number, forUpdate = false): Promise<boolean> {
  return (await challengeState(db, bookingId, forUpdate)).matched;
}

export async function getBookingOr404(db: Db | null, code: string, forUpdate = false): Promise<BookingRow> {
  const b = await loadBookingByCode(db, code, forUpdate);
  if (!b) throw new AppError("BOOKING_NOT_FOUND");
  return b;
}

/** FR-08 / FR-09: full details + what the customer can do now */
export async function bookingDetail(ctx: Ctx, b: BookingRow) {
  const customer = await loadCustomerById(null, b.customerId);
  const rentals = await loadBookingRentals(null, b.id);
  const payments = await q<{ id: number; amount: number; method: string; paid_at: Date }>(
    "SELECT id, amount, method, paid_at FROM payments WHERE booking_id = $1 ORDER BY id",
    [b.id],
  );
  const challenge = (
    await q<Record<string, unknown>>("SELECT id, team_name, level, status, amount, pay_deadline FROM challenges WHERE booking_id = $1 ORDER BY id DESC LIMIT 1", [b.id])
  )[0];
  const series = b.seriesId
    ? (await q<Record<string, unknown>>("SELECT * FROM recurring_series WHERE id = $1", [b.seriesId]))[0]
    : null;
  const seriesBookings = b.seriesId
    ? await q<{ code: string; date: string; status: string; pay_now: number }>(
        "SELECT code, date, status, pay_now FROM bookings WHERE series_id = $1 ORDER BY date",
        [b.seriesId],
      )
    : [];
  const shares = b.splitToken
    ? await q<{ id: number; member_name: string; amount: number; paid_at: Date | null }>(
        "SELECT id, member_name, amount, paid_at FROM split_shares WHERE booking_id = $1 ORDER BY id",
        [b.id],
      )
    : [];
  // FR-45 / 07-SAD 4: status steps with time only (who did it is not shown to customers)
  const history = await q<{ to_status: string; created_at: Date }>(
    "SELECT to_status, created_at FROM booking_status_history WHERE booking_id = $1 ORDER BY created_at, id",
    [b.id],
  );
  const start = slotStart(b.date, b.startHour);
  const activeChallenge = challenge && ["OPEN", "AWAITING_PAYMENT", "MATCHED"].includes(String(challenge.status));
  const { matched, pending } = await challengeState(null, b.id);
  const pendingSeries = seriesBookings.filter((s) => s.status === "PENDING_PAYMENT");
  const cancelBlock = checkCancel(b.status, start, ctx.now, matched);
  const rescheduleBlock = checkReschedule({
    status: b.status,
    start,
    now: ctx.now,
    rescheduleCount: b.rescheduleCount,
    challengeMatched: matched,
    challengePending: pending,
  });
  return {
    booking: {
      ...mapBookingPublic(b),
      customerName: bookingCustomerName(b, customer),
      phone: customer?.phone ?? "",
      rentals,
      payments: payments.map((p) => ({ id: p.id, amount: p.amount, method: p.method, paidAt: p.paid_at })),
      challenge: challenge
        ? {
            id: challenge.id,
            teamName: challenge.team_name,
            level: challenge.level,
            levelLabel: label(ctx.lang, LEVEL_LABEL, String(challenge.level)),
            status: challenge.status,
            amount: challenge.amount,
          }
        : null,
      split: b.splitToken
        ? { token: b.splitToken, shares: shares.map((s) => ({ id: s.id, memberName: s.member_name, amount: s.amount, paid: !!s.paid_at })) }
        : null,
      series: series
        ? {
            id: series.id,
            weeksRequested: series.weeks_requested,
            weeksBooked: series.weeks_booked,
            discountPercent: series.discount_percent,
            bookings: seriesBookings.map((s) => ({ code: s.code, date: s.date, status: s.status })),
          }
        : null,
    },
    history: history.map((h) => ({ toStatus: h.to_status, at: h.created_at })),
    now: ctx.now,
    secondsLeft: b.status === "PENDING_PAYMENT" ? Math.max(0, Math.floor((new Date(b.payDeadline).getTime() - ctx.now.getTime()) / 1000)) : 0,
    payTotal: b.seriesId && b.status === "PENDING_PAYMENT" ? pendingSeries.reduce((s, x) => s + x.pay_now, 0) : b.payNow,
    actions: {
      canPay: b.status === "PENDING_PAYMENT",
      canCancel: cancelBlock === null,
      cancelBlockedBy: cancelBlock?.code ?? null,
      // a cancel that will be refused returns nothing → the confirm step previews ฿0
      cancelCreditNow:
        b.status === "CONFIRMED" && !cancelBlock ? cancelCredit({ start, now: ctx.now, amountPaid: b.amountPaid, creditUsed: b.creditUsed }) : 0,
      canReschedule: rescheduleBlock === null,
      rescheduleBlockedBy: rescheduleBlock?.code ?? null,
      canChallenge: checkChallengeCreate(b.status, start, ctx.now) === null && !activeChallenge,
      canSplit: (b.status === "CONFIRMED" || b.status === "CHECKED_IN") && !b.splitToken,
    },
  };
}

/** FR-06: simulated PromptPay payment (BR-10). Series bookings are paid together (BR-20). */
export async function payBooking(ctx: Ctx, code: string, phone?: string) {
  return tx(async (c) => {
    const b = await getBookingOr404(c, code, true);
    await authorizeBooking(b, { phone, ctx });
    if (b.status === "EXPIRED") throw new AppError("PAYMENT_EXPIRED");
    if (b.status !== "PENDING_PAYMENT") throw new AppError("INVALID_STATUS");
    if (!isPaymentInTime(new Date(b.payDeadline), ctx.now)) throw new AppError("PAYMENT_EXPIRED");
    const group = b.seriesId
      ? (
          await c.query("SELECT code FROM bookings WHERE series_id = $1 AND status = 'PENDING_PAYMENT' ORDER BY date FOR UPDATE", [b.seriesId])
        ).rows.map((r: { code: string }) => r.code)
      : [b.code];
    let paid = 0;
    for (const cd of group) {
      const row = (await loadBookingByCode(c, cd))!;
      await confirmBooking(c, row, ctx.now, row.payNow);
      paid += row.payNow;
    }
    return { ok: true, code: b.code, amount: paid, bookings: group, messageCode: "OK_PAID" };
  }, { actor: "CUSTOMER", now: ctx.now });
}

/** FR-10 / BR-13 */
export async function cancelBooking(ctx: Ctx, code: string, phone?: string) {
  return tx(async (c) => {
    const b = await getBookingOr404(c, code, true);
    await authorizeBooking(b, { phone, ctx });
    const start = slotStart(b.date, b.startHour);
    // BR-28: lock the challenge rows too, so a challenge payment can't turn MATCHED between this check and the update
    fail(checkCancel(b.status, start, ctx.now, await isChallengeMatched(c, b.id, true)));
    await c.query("UPDATE bookings SET status = 'CANCELLED' WHERE id = $1", [b.id]);
    await c.query("UPDATE challenges SET status = 'CLOSED' WHERE booking_id = $1 AND status IN ('OPEN', 'AWAITING_PAYMENT')", [b.id]);
    if (b.status === "PENDING_PAYMENT") return { ok: true, status: "CANCELLED", creditReturned: 0, messageCode: "OK_CANCEL_PENDING" };
    const credit = cancelCredit({ start, now: ctx.now, amountPaid: Math.max(0, b.amountPaid), creditUsed: b.creditUsed });
    const inWindow = cancelCredit({ start, now: ctx.now, amountPaid: 1, creditUsed: 0 }) > 0;
    if (credit > 0) {
      await c.query("UPDATE customers SET credit_balance = credit_balance + $2 WHERE id = $1", [b.customerId, credit]);
      await c.query("INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) VALUES ($1, $2, 'CANCEL', $3, $4)", [
        b.customerId, credit, b.id, ctx.now,
      ]);
    }
    if (b.freeHourUsed && inWindow) {
      await c.query("UPDATE customers SET free_hours_used = GREATEST(0, free_hours_used - 1) WHERE id = $1", [b.customerId]);
    }
    return {
      ok: true,
      status: "CANCELLED",
      creditReturned: credit,
      messageCode: credit > 0 ? "OK_CANCEL_CREDIT" : "OK_CANCEL_NO_CREDIT",
      messageParams: { amount: credit },
    };
  }, { actor: "CUSTOMER", now: ctx.now });
}

/** FR-11 / BR-25 */
export async function rescheduleBooking(ctx: Ctx, code: string, body: Record<string, unknown>) {
  const date = str(body.date);
  const startHour = num(body.startHour);
  return tx(async (c) => {
    const b = await getBookingOr404(c, code, true);
    await authorizeBooking(b, { phone: str(body.phone), ctx });
    const chState = await challengeState(c, b.id, true);
    fail(
      checkReschedule({
        status: b.status,
        start: slotStart(b.date, b.startHour),
        now: ctx.now,
        rescheduleCount: b.rescheduleCount,
        challengeMatched: chState.matched,
        challengePending: chState.pending,
      }),
    );
    if (!isValidDateStr(date)) throw new AppError("INVALID_DATE");
    if (date === b.date && startHour === b.startHour) throw new AppError("RESCHEDULE_SAME");
    await lockKey(c, `field:${b.fieldId}:${date}`);
    const rentals = (await loadBookingRentals(c, b.id)).map((r) => ({ itemId: r.itemId, qty: r.qty }));
    if (rentals.length) await lockKey(c, `rent:${date}`);
    const series = b.seriesId ? (await c.query("SELECT discount_percent FROM recurring_series WHERE id = $1", [b.seriesId])).rows[0] : null;
    const owner = await loadCustomerById(c, b.customerId);
    const ev = await evaluateBooking(
      c,
      ctx,
      { fieldId: b.fieldId, date, startHour, hours: b.hours, rentals, discountPercent: series?.discount_percent ?? 0, ignoreBookingId: b.id },
      owner,
      true,
    );
    if (b.freeHourUsed && !isFreeHourSlot(date, ev.startHour)) throw new AppError("FREE_HOUR_NOT_ELIGIBLE");
    const holidays = await holidayDates(c);
    const freeHourValue = b.freeHourUsed ? hourlyRate(ev.field, date, ev.startHour, holidays) : 0;
    const newFieldPrice = fieldPriceFor(ev.field, date, ev.startHour, b.hours, holidays);
    const newDiscount = discountAmount(newFieldPrice, series?.discount_percent ?? 0);
    const newTotal = Math.max(0, newFieldPrice - newDiscount - freeHourValue + b.rentalPrice);
    const diff0 = rescheduleDifference(b.totalPrice, newTotal);
    // NFR-19: a cheaper slot never takes amount_paid / credit_used / due_at_field below 0 (same as v1 when paid ≥ difference)
    const settle = rescheduleSettlement({ difference: diff0.creditBack, amountPaid: b.amountPaid, creditUsed: b.creditUsed, dueAtField: b.dueAtField });
    const diff = { extraPay: diff0.extraPay, creditBack: settle.creditBack };
    if (diff.extraPay > 0) {
      await c.query("INSERT INTO payments(booking_id, amount, method, paid_at) VALUES ($1, $2, 'PROMPTPAY', $3)", [b.id, diff.extraPay, ctx.now]);
    }
    if (diff.creditBack > 0) {
      await c.query("UPDATE customers SET credit_balance = credit_balance + $2 WHERE id = $1", [b.customerId, diff.creditBack]);
      await c.query("INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) VALUES ($1, $2, 'RESCHEDULE', $3, $4)", [
        b.customerId, diff.creditBack, b.id, ctx.now,
      ]);
    }
    await c.query(
      `UPDATE bookings SET date = $2, start_hour = $3, field_price = $4, discount = $5, total_price = $6,
         amount_paid = $7, credit_used = $8, due_at_field = $9, reschedule_count = reschedule_count + 1 WHERE id = $1`,
      [b.id, date, ev.startHour, newFieldPrice, newDiscount, newTotal, settle.amountPaid + diff.extraPay, settle.creditUsed, settle.dueAtField],
    );
    // BR-28: an OPEN challenge follows the booking — its amount is recalculated from the new field price
    await c.query("UPDATE challenges SET amount = $2 WHERE booking_id = $1 AND status = 'OPEN'", [b.id, challengeAmount(newFieldPrice, newDiscount)]);
    const saved = (await loadBookingByCode(c, code))!;
    return {
      ok: true,
      booking: mapBookingPublic(saved),
      oldTotal: b.totalPrice,
      newTotal,
      extraPay: diff.extraPay,
      creditBack: diff.creditBack,
      messageCode: diff.extraPay > 0 ? "OK_RESCHEDULED_PAY" : diff.creditBack > 0 ? "OK_RESCHEDULED_CREDIT" : "OK_RESCHEDULED",
      messageParams: { amount: diff.extraPay || diff.creditBack },
    };
  }, { actor: "CUSTOMER", now: ctx.now });
}

/** for the challenge / split helpers */
export function bookingStart(b: { date: string; startHour: number }): Date {
  return slotStart(b.date, b.startHour);
}
