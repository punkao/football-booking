import {
  CHALLENGE_LEVELS,
  CHALLENGE_PAY_MINUTES,
  OPEN_HOUR,
  LAST_START_HOUR,
  banAfterNoShow,
  challengeAmount,
  challengeDeadlineFrom,
  checkChallengeCreate,
  checkCheckin,
  checkClosures,
  checkHours,
  checkLeadTime,
  checkNoOverlap,
  checkNoShow,
  checkPhone,
  checkRainClosable,
  checkSeriesWeeks,
  checkSplitCount,
  checkStartHour,
  countedHours,
  fieldPriceFor,
  freeHoursAvailable,
  hourlyRate,
  ratesOn,
  hoursToNextFree,
  isBanned,
  isHoliday,
  isPaymentInTime,
  isValidDateStr,
  maxBookableDate,
  normalizePhone,
  overlaps,
  payDeadlineFrom,
  paymentPlanFor,
  rainCreditSplit,
  seriesDates,
  seriesQuote,
  slotStart,
  slotTimeState,
  splitPerPerson,
  todayOf,
  weekdayOf,
  isBlocking,
  hasNul,
  isDbId,
} from "@/lib/rules";
import { AppError, fail, num, requireStaff, str } from "./core";
import { LEVEL_LABEL, label } from "@/lib/i18n";
import type { Ctx } from "./core";
import { randomToken } from "./crypto";
import { audit, lockKey, q, tx } from "./db";
import {
  bookingCustomerName,
  loadBookingByCode,
  holidayDates,
  loadBookingRentals,
  loadClosures,
  loadCustomerById,
  loadDayBookings,
  loadField,
  loadFields,
  loadHolidays,
  mapBookingPublic,
  toCamel,
  upsertCustomer,
} from "./data";
import { authorizeBooking, getBookingOr404, rentalAvailability, sessionCustomerId } from "./bookings";

// ---------- FR-01 / FR-28: availability ----------
export async function availability(ctx: Ctx, dateParam: string | null) {
  const today = todayOf(ctx.now);
  const date = dateParam && isValidDateStr(dateParam) ? dateParam : today;
  const fields = await loadFields(null);
  const holidaysAll = await loadHolidays(null);
  const holidays = holidaysAll.map((h) => h.date);
  const bookings = await loadDayBookings(null, null, date);
  const closures = await loadClosures(null, null, date);
  const slots = [];
  for (const f of fields) {
    for (let h = OPEN_HOUR; h <= LAST_START_HOUR; h++) {
      const taken = bookings.some((b) => b.fieldId === f.id && isBlocking(b.status) && overlaps(h, 1, b.startHour, b.hours));
      const closed = closures.some((c) => c.fieldId === f.id && overlaps(h, 1, c.fromHour, c.toHour - c.fromHour));
      const time = slotTimeState(date, h, ctx.now, ctx.bug);
      const status = taken ? "booked" : closed ? "closed" : time !== "ok" ? time : "free";
      slots.push({ fieldId: f.id, hour: h, price: hourlyRate(f, date, h, holidays), status, available: status === "free" });
    }
  }
  return {
    date,
    today,
    maxDate: maxBookableDate(ctx.now, ctx.bug),
    now: ctx.now,
    weekday: weekdayOf(date),
    isHoliday: isHoliday(date, holidays),
    holidayName: holidaysAll.find((h) => h.date === date)?.name ?? null,
    // CR-05: the rates of the day asked for (no new key → same JSON shape as before)
    fields: fields.map((f) => ({ id: f.id, name: f.name, size: f.size, covered: f.covered, ...ratesOn(f, date), photo: f.photo })),
    slots,
  };
}

// ---------- FR-12 / FR-14 / FR-18: me ----------
export async function me(ctx: Ctx) {
  const c = await loadCustomerById(null, await sessionCustomerId(ctx));
  if (!c) throw new AppError("UNAUTHORIZED");
  const entries = await q<{ id: number; amount: number; reason: string; booking_id: number | null; created_at: Date; code: string | null }>(
    `SELECT ce.id, ce.amount, ce.reason, ce.booking_id, ce.created_at, b.code
       FROM credit_entries ce LEFT JOIN bookings b ON b.id = ce.booking_id WHERE ce.customer_id = $1 ORDER BY ce.created_at DESC, ce.id DESC`,
    [c.id],
  );
  const bookings = await q<Record<string, unknown>>("SELECT * FROM bookings WHERE customer_id = $1 ORDER BY date DESC, start_hour DESC", [c.id]);
  return {
    customer: {
      id: c.id,
      name: c.name,
      phone: c.phone,
      isMember: !!c.passwordHash,
      creditBalance: c.creditBalance,
      paidHours: c.paidHours,
      freeHoursUsed: c.freeHoursUsed,
      freeHoursAvailable: freeHoursAvailable(c.paidHours, c.freeHoursUsed),
      hoursToNextFree: hoursToNextFree(c.paidHours),
      bannedUntil: c.bannedUntil,
      isBanned: isBanned(c.bannedUntil, ctx.now),
    },
    creditEntries: entries.map((e) => ({ id: e.id, amount: e.amount, reason: e.reason, bookingId: e.booking_id, bookingCode: e.code, createdAt: e.created_at })),
    bookings: bookings.map((r) => mapBookingPublic(toCamel(r))),
  };
}

// ---------- FR-15 / FR-16: recurring series (BR-18 – BR-21) ----------
type SeriesInput = { fieldId: string; startDate: string; startHour: number | undefined; hours: number | undefined; weeks: number | undefined };

function parseSeries(b: Record<string, unknown>): SeriesInput {
  return { fieldId: str(b.fieldId), startDate: str(b.startDate), startHour: num(b.startHour), hours: num(b.hours), weeks: num(b.weeks) };
}

async function seriesPlan(db: Parameters<typeof loadField>[0], ctx: Ctx, input: SeriesInput) {
  const customer = await loadCustomerById(db, await sessionCustomerId(ctx));
  if (!customer || !customer.passwordHash) throw new AppError("MEMBER_REQUIRED");
  const field = await loadField(db, input.fieldId);
  if (!field) throw new AppError("INVALID_FIELD");
  if (!isValidDateStr(input.startDate)) throw new AppError("INVALID_DATE");
  fail(checkSeriesWeeks(input.weeks));
  fail(checkStartHour(input.startHour));
  const startHour = input.startHour as number;
  fail(checkHours(startHour, input.hours));
  const hours = input.hours as number;
  if (input.startDate < todayOf(ctx.now)) throw new AppError("PAST_DATE");
  fail(checkLeadTime(input.startDate, startHour, ctx.now)); // BR-18: the first week still follows BR-05
  if (isBanned(customer.bannedUntil, ctx.now)) throw new AppError("CUSTOMER_BANNED", { date: customer.bannedUntil!.toISOString() });
  const holidays = await holidayDates(db);
  const dates = seriesDates(input.startDate, input.weeks as number);
  const weeks = [];
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const conflict =
      checkClosures(startHour, hours, await loadClosures(db, field.id, d)) ?? checkNoOverlap(startHour, hours, await loadDayBookings(db, field.id, d));
    weeks.push({
      week: i + 1,
      date: d,
      status: conflict ? "conflict" : "free",
      reason: conflict?.code ?? null,
      fieldPrice: fieldPriceFor(field, d, startHour, hours, holidays),
      paymentPlan: paymentPlanFor(d, startHour),
    });
  }
  const free = weeks.filter((w) => w.status === "free");
  const sq = seriesQuote(free.map((w) => ({ date: w.date, fieldPrice: w.fieldPrice, paymentPlan: w.paymentPlan })));
  return {
    customer,
    field,
    startHour,
    hours,
    weekday: weekdayOf(input.startDate),
    weeksRequested: input.weeks as number,
    weeksBooked: free.length,
    discountPercent: sq.discountPercent,
    weeks: weeks.map((w) => {
      const p = sq.weeks.find((x) => x.date === w.date);
      return { ...w, discount: p?.discount ?? 0, totalPrice: p?.totalPrice ?? 0, payNow: p?.payNow ?? 0, dueAtField: p?.dueAtField ?? 0 };
    }),
    conflicts: weeks.filter((w) => w.status === "conflict").map((w) => w.date),
    totals: { fieldPrice: sq.fieldPrice, discount: sq.discount, totalPrice: sq.totalPrice, payNow: sq.payNow, dueAtField: sq.dueAtField },
  };
}

export async function seriesPreview(ctx: Ctx, b: Record<string, unknown>) {
  const p = await seriesPlan(null, ctx, parseSeries(b));
  const { customer, field, ...rest } = p;
  void customer;
  return { preview: { ...rest, fieldId: field.id } };
}

export async function seriesCreate(ctx: Ctx, b: Record<string, unknown>) {
  const input = parseSeries(b);
  return tx(async (c) => {
    if (input.fieldId && isValidDateStr(input.startDate) && input.weeks && input.weeks > 0 && input.weeks <= 12) {
      for (const d of seriesDates(input.startDate, input.weeks)) await lockKey(c, `field:${input.fieldId}:${d}`);
    }
    const p = await seriesPlan(c, ctx, input);
    if (p.weeksBooked === 0) throw new AppError("SERIES_NONE_AVAILABLE");
    if (p.conflicts.length > 0 && b.confirmPartial !== true) throw new AppError("SERIES_CONFLICT", { dates: p.conflicts.join(", ") });
    if (b.consent !== true) throw new AppError("CONSENT_REQUIRED");
    const s = await c.query(
      `INSERT INTO recurring_series(customer_id, field_id, weekday, start_hour, hours, weeks_requested, weeks_booked, discount_percent, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [p.customer.id, p.field.id, p.weekday, p.startHour, p.hours, p.weeksRequested, p.weeksBooked, p.discountPercent, ctx.now],
    );
    const seriesId = s.rows[0].id as number;
    const codes: string[] = [];
    for (const w of p.weeks.filter((x) => x.status === "free")) {
      const n = (await c.query("SELECT nextval('booking_code_seq') AS n")).rows[0].n;
      const code = "LN-" + String(n);
      codes.push(code);
      await c.query(
        `INSERT INTO bookings(code, customer_id, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
           rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at,
           reschedule_count, series_id, created_at, customer_name)
         VALUES ($1,$2,$3,$4,$5,$6,'PENDING_PAYMENT',$7,$8,$9,0,0,false,$10,$11,0,$12,$13,$14,0,$15,$14,$16)`,
        [code, p.customer.id, p.field.id, w.date, p.startHour, p.hours, w.paymentPlan, w.fieldPrice, w.discount, w.totalPrice, w.payNow,
          w.dueAtField, payDeadlineFrom(ctx.now), ctx.now, seriesId, p.customer.name],
      );
    }
    return { ok: true, seriesId, codes, payNow: p.totals.payNow, next: `/pay/${codes[0]}`, messageCode: "OK_SERIES_CREATED" };
  }, { actor: "CUSTOMER", now: ctx.now });
}

// ---------- FR-17: rentals availability ----------
export async function rentalsAvailability(ctx: Ctx, date: string, startHour: number | undefined, hours: number | undefined) {
  if (!isValidDateStr(date)) throw new AppError("INVALID_DATE");
  fail(checkStartHour(startHour));
  fail(checkHours(startHour as number, hours));
  return { date, startHour, hours, items: await rentalAvailability(null, date, startHour as number, hours as number, ctx.bug) };
}

// ---------- FR-19 / BR-27: split link ----------
export async function splitCreate(ctx: Ctx, code: string, b: Record<string, unknown>) {
  return tx(async (c) => {
    const bk = await getBookingOr404(c, code, true);
    await authorizeBooking(bk, { phone: str(b.phone), ctx });
    if (bk.status !== "CONFIRMED" && bk.status !== "CHECKED_IN") throw new AppError("INVALID_STATUS");
    // BR-27 (A-25): one split link per booking — asking again returns the same link (token, people, per person) unchanged
    if (bk.splitToken) {
      const shares = (await c.query("SELECT amount FROM split_shares WHERE booking_id = $1 ORDER BY id", [bk.id])).rows as { amount: number }[];
      return {
        ok: true,
        existing: true,
        token: bk.splitToken,
        url: `/split/${bk.splitToken}`,
        perPerson: shares[0]?.amount ?? 0,
        people: shares.length,
        netPrice: bk.totalPrice - bk.creditUsed,
        messageCode: "OK_SPLIT_EXISTS",
      };
    }
    let names: string[] = Array.isArray(b.names) ? b.names.map((x) => String(x).trim()).filter(Boolean) : [];
    if (names.length === 0) {
      const n = num(b.count) ?? 0;
      fail(checkSplitCount(n));
      names = Array.from({ length: n }, (_, i) => `#${i + 1}`);
    }
    fail(checkSplitCount(names.length));
    const net = bk.totalPrice - bk.creditUsed;
    const per = splitPerPerson(net, names.length);
    const token = randomToken(9);
    await c.query("UPDATE bookings SET split_token = $2 WHERE id = $1", [bk.id, token]);
    for (const n of names) await c.query("INSERT INTO split_shares(booking_id, member_name, amount) VALUES ($1, $2, $3)", [bk.id, n, per]);
    return { ok: true, existing: false, token, url: `/split/${token}`, perPerson: per, people: names.length, netPrice: net, messageCode: "OK_SPLIT_CREATED" };
  });
}

export async function splitGet(token: string) {
  if (hasNul(token)) throw new AppError("SPLIT_NOT_FOUND");
  const r = await q<Record<string, unknown>>("SELECT * FROM bookings WHERE split_token = $1", [token]);
  if (!r[0]) throw new AppError("SPLIT_NOT_FOUND");
  const b = mapBookingPublic(toCamel(r[0]));
  const shares = await q<{ id: number; member_name: string; amount: number; paid_at: Date | null }>(
    "SELECT * FROM split_shares WHERE booking_id = $1 ORDER BY id",
    [b.id],
  );
  const owner = await loadCustomerById(null, b.customerId);
  return {
    booking: {
      code: b.code,
      fieldId: b.fieldId,
      date: b.date,
      startHour: b.startHour,
      hours: b.hours,
      status: b.status,
      netPrice: b.netPrice,
      ownerName: bookingCustomerName(b, owner),
    },
    perPerson: shares[0]?.amount ?? 0,
    people: shares.length,
    paidCount: shares.filter((s) => s.paid_at).length,
    shares: shares.map((s) => ({ id: s.id, memberName: s.member_name, amount: s.amount, paid: !!s.paid_at, paidAt: s.paid_at })),
  };
}

export async function splitMarkPaid(ctx: Ctx, token: string, shareId: number, paid: boolean) {
  if (hasNul(token) || !isDbId(shareId)) throw new AppError("SPLIT_NOT_FOUND");
  const r = await q<{ id: number }>(
    `UPDATE split_shares s SET paid_at = $3 FROM bookings b
      WHERE s.booking_id = b.id AND b.split_token = $1 AND s.id = $2 RETURNING s.id`,
    [token, shareId, paid ? ctx.now : null],
  );
  if (!r[0]) throw new AppError("SPLIT_NOT_FOUND");
  return splitGet(token);
}

// ---------- FR-20 / FR-21 / BR-28: challenges ----------
export async function challengeList(ctx: Ctx, level: string | null) {
  const params: unknown[] = [todayOf(ctx.now)];
  let where = "ch.status IN ('OPEN', 'AWAITING_PAYMENT', 'MATCHED') AND b.date >= $1";
  if (level && (CHALLENGE_LEVELS as readonly string[]).includes(level)) {
    params.push(level);
    where += " AND ch.level = $2";
  }
  const rows = await q<Record<string, unknown>>(
    `SELECT ch.id, ch.team_name, ch.level, ch.status, ch.amount, ch.pay_deadline, b.code, b.field_id, b.date, b.start_hour, b.hours,
            COALESCE(NULLIF(b.customer_name, ''), c.name) AS owner_name
       FROM challenges ch JOIN bookings b ON b.id = ch.booking_id JOIN customers c ON c.id = b.customer_id
      WHERE ${where} ORDER BY b.date, b.start_hour, ch.id`,
    params,
  );
  return {
    challenges: rows
      .filter((r) => slotStart(String(r.date), Number(r.start_hour)).getTime() > ctx.now.getTime())
      .map((r) => ({
        id: r.id,
        teamName: r.team_name,
        level: r.level,
        levelLabel: label(ctx.lang, LEVEL_LABEL, String(r.level)),
        status: r.status,
        amount: r.amount,
        fieldId: r.field_id,
        date: r.date,
        startHour: r.start_hour,
        hours: r.hours,
        // NFR-04: never expose the phone number
        ownerName: r.owner_name,
      })),
  };
}

export async function challengeCreate(ctx: Ctx, b: Record<string, unknown>) {
  const code = str(b.code);
  return tx(async (c) => {
    const bk = await getBookingOr404(c, code, true);
    await authorizeBooking(bk, { phone: str(b.phone), ctx });
    fail(checkChallengeCreate(bk.status, slotStart(bk.date, bk.startHour), ctx.now));
    const teamName = str(b.teamName);
    if (!teamName) throw new AppError("TEAM_REQUIRED");
    const level = str(b.level);
    if (!(CHALLENGE_LEVELS as readonly string[]).includes(level)) throw new AppError("INVALID_LEVEL");
    const active = await c.query("SELECT id FROM challenges WHERE booking_id = $1 AND status IN ('OPEN', 'AWAITING_PAYMENT', 'MATCHED')", [bk.id]);
    if (active.rows.length) throw new AppError("CHALLENGE_EXISTS");
    const amount = challengeAmount(bk.fieldPrice, bk.discount);
    const r = await c.query(
      "INSERT INTO challenges(booking_id, team_name, level, status, amount, created_at) VALUES ($1, $2, $3, 'OPEN', $4, $5) RETURNING id",
      [bk.id, teamName, level, amount, ctx.now],
    );
    return { ok: true, challenge: { id: r.rows[0].id, teamName, level, status: "OPEN", amount, code }, messageCode: "OK_CHALLENGE_CREATED" };
  });
}

async function loadChallenge(c: Parameters<typeof lockKey>[0], id: number) {
  const r = await c.query(
    `SELECT ch.*, b.customer_id AS owner_id, b.status AS booking_status, b.date, b.start_hour, b.id AS bid
       FROM challenges ch JOIN bookings b ON b.id = ch.booking_id WHERE ch.id = $1 FOR UPDATE OF ch`,
    [id],
  );
  if (!r.rows[0]) throw new AppError("CHALLENGE_NOT_FOUND");
  return r.rows[0] as Record<string, unknown>;
}

export async function challengeAccept(ctx: Ctx, id: number, b: Record<string, unknown>) {
  if (!isDbId(id)) throw new AppError("CHALLENGE_NOT_FOUND");
  return tx(async (c) => {
    const ch = await loadChallenge(c, id);
    if (ch.status !== "OPEN") throw new AppError("CHALLENGE_NOT_OPEN");
    if (checkChallengeCreate(String(ch.booking_status), slotStart(String(ch.date), Number(ch.start_hour)), ctx.now)) throw new AppError("CHALLENGE_NOT_OPEN");
    const name = str(b.name);
    const phone = normalizePhone(b.phone);
    if (!name) throw new AppError("NAME_REQUIRED");
    fail(checkPhone(phone));
    if (b.consent !== true) throw new AppError("CONSENT_REQUIRED");
    const cust = await upsertCustomer(c, name, phone);
    if (cust.id === ch.owner_id) throw new AppError("CHALLENGE_OWN");
    const deadline = challengeDeadlineFrom(ctx.now);
    await c.query("UPDATE challenges SET status = 'AWAITING_PAYMENT', accept_customer_id = $2, pay_deadline = $3 WHERE id = $1", [id, cust.id, deadline]);
    return { ok: true, challenge: { id, status: "AWAITING_PAYMENT", amount: ch.amount, payDeadline: deadline }, secondsLeft: CHALLENGE_PAY_MINUTES * 60, messageCode: "OK_CHALLENGE_ACCEPTED" };
  });
}

export async function challengePay(ctx: Ctx, id: number, b: Record<string, unknown>) {
  if (!isDbId(id)) throw new AppError("CHALLENGE_NOT_FOUND");
  return tx(async (c) => {
    // lock order booking → challenge (same as cancel / reschedule) so an owner's cancel and this payment are serialised
    const ref = (await c.query("SELECT booking_id FROM challenges WHERE id = $1", [id])).rows[0] as { booking_id: number } | undefined;
    if (!ref) throw new AppError("CHALLENGE_NOT_FOUND");
    const bk = (await c.query("SELECT status FROM bookings WHERE id = $1 FOR UPDATE", [ref.booking_id])).rows[0] as { status: string };
    const ch = await loadChallenge(c, id);
    if (ch.status === "OPEN") throw new AppError("CHALLENGE_PAYMENT_EXPIRED");
    if (ch.status !== "AWAITING_PAYMENT") throw new AppError("CHALLENGE_NOT_OPEN");
    // the booking must still hold the field (cancelled / rain-closed / no-show → challenge closed, no credit)
    if (bk.status !== "CONFIRMED" && bk.status !== "CHECKED_IN") throw new AppError("CHALLENGE_NOT_OPEN");
    const phone = normalizePhone(b.phone);
    const acceptor = await loadCustomerById(c, Number(ch.accept_customer_id));
    if (!acceptor || acceptor.phone !== phone) throw new AppError("CHALLENGE_WRONG_PHONE");
    if (!isPaymentInTime(new Date(String(ch.pay_deadline)), ctx.now)) throw new AppError("CHALLENGE_PAYMENT_EXPIRED");
    const amount = Number(ch.amount);
    await c.query("UPDATE challenges SET status = 'MATCHED' WHERE id = $1", [id]);
    // BR-28 / BR-15: the credit goes to the owner of the booking
    await c.query("UPDATE customers SET credit_balance = credit_balance + $2 WHERE id = $1", [ch.owner_id, amount]);
    await c.query("INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) VALUES ($1, $2, 'CHALLENGE', $3, $4)", [
      ch.owner_id, amount, ch.bid, ctx.now,
    ]);
    // CR-06: the team's transfer is PromptPay money the shop received (counted by the report on the day it was paid) — a row on the owner's booking,
    // tied to the challenge so it is written once (unique index, migration 009). The credit above is unchanged. A ฿0 challenge has no money (amount > 0 check).
    if (amount > 0) {
      await c.query("INSERT INTO payments(booking_id, amount, method, paid_at, challenge_id) VALUES ($1, $2, 'PROMPTPAY', $3, $4)", [ch.bid, amount, ctx.now, id]);
    }
    return { ok: true, challenge: { id, status: "MATCHED", amount }, messageCode: "OK_CHALLENGE_MATCHED" };
  });
}

// ---------- FR-23 – FR-25: staff ----------
async function staffBookingView(ctx: Ctx, code: string) {
  const bk = await getBookingOr404(null, code);
  const cust = await loadCustomerById(null, bk.customerId);
  const rentals = await loadBookingRentals(null, bk.id);
  // F-02: what the front desk can do now, and why not (same rules as the API) · CR-02 (1): only on the day of play
  const checkinBlockedBy = checkCheckin(bk.status, bk.date, ctx.now)?.code ?? null;
  const noShowBlockedBy = checkNoShow(bk.status, slotStart(bk.date, bk.startHour), ctx.now)?.code ?? null;
  return {
    booking: {
      ...mapBookingPublic(bk),
      customerName: bookingCustomerName(bk, cust),
      phone: cust?.phone ?? "",
      rentals,
      bannedUntil: cust?.bannedUntil ?? null,
    },
    actions: { canCheckin: checkinBlockedBy === null, checkinBlockedBy, canNoShow: noShowBlockedBy === null, noShowBlockedBy },
  };
}

export async function staffGet(ctx: Ctx, code: string) {
  await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  return staffBookingView(ctx, code);
}

export async function staffCheckin(ctx: Ctx, code: string) {
  const staff = await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  const collected = await tx(async (c) => {
    const bk = await getBookingOr404(c, code, true);
    fail(checkCheckin(bk.status, bk.date, ctx.now)); // CR-02 (1) / A-45: CONFIRMED and the day of play
    if (bk.dueAtField > 0) {
      await c.query("INSERT INTO payments(booking_id, amount, method, paid_at) VALUES ($1, $2, 'CASH_AT_FIELD', $3)", [bk.id, bk.dueAtField, ctx.now]);
    }
    await c.query("UPDATE bookings SET status = 'CHECKED_IN', amount_paid = amount_paid + due_at_field, due_at_field = 0, checked_in_at = $2 WHERE id = $1", [
      bk.id, ctx.now,
    ]);
    // BR-23: paid hours (free hour excluded)
    await c.query("UPDATE customers SET paid_hours = paid_hours + $2 WHERE id = $1", [bk.customerId, countedHours(bk.hours, bk.freeHourUsed)]);
    // BR-42 / T-16
    await audit(c, staff.id, "CHECKIN", bk.code, { collected: bk.dueAtField }, ctx.now);
    return bk.dueAtField;
  }, { actor: staff.username, now: ctx.now });
  return { ok: true, collected, ...(await staffBookingView(ctx, code)), messageCode: "OK_CHECKED_IN" };
}

export async function staffNoShow(ctx: Ctx, code: string) {
  const staff = await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  const ban = await tx(async (c) => {
    const bk = await getBookingOr404(c, code, true);
    fail(checkNoShow(bk.status, slotStart(bk.date, bk.startHour), ctx.now));
    const prev = await c.query("SELECT no_show_at FROM bookings WHERE customer_id = $1 AND status = 'NO_SHOW' AND no_show_at IS NOT NULL AND id <> $2", [
      bk.customerId, bk.id,
    ]);
    const until = banAfterNoShow(ctx.now, prev.rows.map((r: { no_show_at: Date }) => new Date(r.no_show_at)));
    await c.query("UPDATE bookings SET status = 'NO_SHOW', no_show_at = $2 WHERE id = $1", [bk.id, ctx.now]);
    await c.query("UPDATE challenges SET status = 'CLOSED' WHERE booking_id = $1 AND status IN ('OPEN', 'AWAITING_PAYMENT')", [bk.id]);
    if (until) {
      await c.query("UPDATE customers SET banned_until = GREATEST(COALESCE(banned_until, $2), $2) WHERE id = $1", [bk.customerId, until]);
    }
    await audit(c, staff.id, "NO_SHOW", bk.code, { bannedUntil: until ? until.toISOString() : null }, ctx.now);
    return until;
  }, { actor: staff.username, now: ctx.now });
  return {
    ok: true,
    bannedUntil: ban,
    ...(await staffBookingView(ctx, code)),
    messageCode: ban ? "OK_NO_SHOW_BANNED" : "OK_NO_SHOW",
    messageParams: ban ? { date: ban.toISOString() } : undefined,
  };
}

export async function staffReturn(ctx: Ctx, code: string, b: Record<string, unknown>) {
  const staff = await requireStaff(ctx, ["STAFF", "MANAGER", "OWNER"]);
  await tx(async (c) => {
    const bk = await getBookingOr404(c, code, true);
    const rentals = await loadBookingRentals(c, bk.id);
    const items: { itemId: string; returnedQty: number }[] = Array.isArray(b.items)
      ? b.items.map((x: { itemId?: unknown; returnedQty?: unknown }) => ({ itemId: String(x.itemId), returnedQty: num(x.returnedQty) ?? NaN }))
      : Object.entries((b.items as Record<string, unknown>) ?? {}).map(([k, v]) => ({ itemId: k, returnedQty: num(v) ?? NaN }));
    for (const it of items) {
      const r = rentals.find((x) => x.itemId === it.itemId);
      if (!r || !Number.isInteger(it.returnedQty) || it.returnedQty < 0) throw new AppError("INVALID_QTY");
      if (it.returnedQty > r.qty) throw new AppError("RETURN_EXCEEDS");
      await c.query("UPDATE booking_rentals SET returned_qty = $3 WHERE booking_id = $1 AND item_id = $2", [bk.id, it.itemId, it.returnedQty]);
    }
    await audit(c, staff.id, "RETURN_RENTALS", bk.code, { items }, ctx.now);
  });
  return { ok: true, ...(await staffBookingView(ctx, code)), messageCode: "OK_RETURNED" };
}

// ---------- FR-22: today overview ----------
export async function staffToday(ctx: Ctx, dateParam: string | null) {
  await requireStaff(ctx, ["MANAGER", "OWNER"]);
  const date = dateParam && isValidDateStr(dateParam) ? dateParam : todayOf(ctx.now);
  const fields = await loadFields(null);
  const bookings = await loadDayBookings(null, null, date);
  const closures = await loadClosures(null, null, date);
  const custs = await q<{ id: number; name: string }>("SELECT id, name FROM customers WHERE id = ANY($1::int[])", [bookings.map((b) => b.customerId)]);
  const rows = [];
  for (let h = OPEN_HOUR; h <= LAST_START_HOUR; h++) {
    const cells = fields.map((f) => {
      const b = bookings.find((x) => x.fieldId === f.id && isBlocking(x.status) && overlaps(h, 1, x.startHour, x.hours));
      const closed = closures.some((c) => c.fieldId === f.id && overlaps(h, 1, c.fromHour, c.toHour - c.fromHour));
      return {
        fieldId: f.id,
        closed,
        booking: b
          ? {
              code: b.code,
              status: b.status,
              customerName: bookingCustomerName(b, custs.find((c) => c.id === b.customerId)),
              amountPaid: b.amountPaid,
              dueAtField: b.dueAtField,
              startHour: b.startHour,
              hours: b.hours,
            }
          : null,
      };
    });
    const rentals = await rentalAvailability(null, date, h, 1, false);
    rows.push({ hour: h, cells, rentals: Object.fromEntries(rentals.map((r) => [r.id, r.remaining])) });
  }
  const active = bookings.filter((b) => isBlocking(b.status));
  return {
    date,
    fields: fields.map((f) => ({ id: f.id, size: f.size, covered: f.covered })),
    rows,
    totals: {
      bookings: active.length,
      amountPaid: active.reduce((s, b) => s + b.amountPaid, 0),
      dueAtField: active.filter((b) => b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT").reduce((s, b) => s + b.dueAtField, 0),
    },
    bookings: bookings.map((b) => ({ code: b.code, fieldId: b.fieldId, startHour: b.startHour, hours: b.hours, status: b.status, amountPaid: b.amountPaid, dueAtField: b.dueAtField })),
  };
}

// ---------- FR-26 / FR-27: owner ----------
export async function holidaysList(ctx: Ctx) {
  await requireStaff(ctx, ["OWNER"]);
  return { holidays: await loadHolidays(null) };
}

export async function holidayAdd(ctx: Ctx, b: Record<string, unknown>) {
  const staff = await requireStaff(ctx, ["OWNER"]);
  const date = str(b.date);
  const name = str(b.name);
  if (!isValidDateStr(date)) throw new AppError("INVALID_DATE");
  if (!name) throw new AppError("NAME_REQUIRED");
  await tx(async (c) => {
    const r = await c.query("INSERT INTO holidays(date, name) VALUES ($1, $2) ON CONFLICT (date) DO NOTHING RETURNING date", [date, name]);
    if (!r.rows.length) throw new AppError("HOLIDAY_EXISTS");
    await audit(c, staff.id, "HOLIDAY_ADD", date, { name }, ctx.now);
  });
  return { ok: true, holidays: await loadHolidays(null), messageCode: "OK_HOLIDAY_ADDED" };
}

export async function holidayDelete(ctx: Ctx, date: string) {
  const staff = await requireStaff(ctx, ["OWNER"]);
  await tx(async (c) => {
    const r = await c.query("DELETE FROM holidays WHERE date = $1 RETURNING date, name", [isValidDateStr(date) ? date : "1900-01-01"]);
    if (!r.rows.length) throw new AppError("HOLIDAY_NOT_FOUND");
    await audit(c, staff.id, "HOLIDAY_REMOVE", date, { name: r.rows[0].name }, ctx.now);
  });
  return { ok: true, holidays: await loadHolidays(null), messageCode: "OK_HOLIDAY_DELETED" };
}

export async function closuresList(ctx: Ctx) {
  await requireStaff(ctx, ["OWNER"]);
  const rows = await q<Record<string, unknown>>("SELECT id, field_id, date, from_hour, to_hour, created_at FROM field_closures ORDER BY date DESC, id DESC LIMIT 50");
  return { closures: rows.map((r) => ({ id: r.id, fieldId: r.field_id, date: r.date, fromHour: r.from_hour, toHour: r.to_hour, createdAt: r.created_at })) };
}

export async function closureCreate(ctx: Ctx, b: Record<string, unknown>) {
  const staff = await requireStaff(ctx, ["OWNER"]);
  const field = await loadField(null, str(b.fieldId));
  if (!field) throw new AppError("INVALID_FIELD");
  fail(checkRainClosable(field));
  const date = str(b.date);
  if (!isValidDateStr(date)) throw new AppError("INVALID_DATE");
  const from = num(b.fromHour);
  const to = num(b.toHour);
  if (from === undefined || to === undefined || !Number.isInteger(from) || !Number.isInteger(to) || from < OPEN_HOUR || to > 24 || from >= to) {
    throw new AppError("INVALID_RANGE");
  }
  return tx(async (c) => {
    await lockKey(c, `field:${field.id}:${date}`);
    const r = await c.query(
      "INSERT INTO field_closures(field_id, date, from_hour, to_hour, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [field.id, date, from, to, staff.id, ctx.now],
    );
    type CreditLine = { role: "OWNER" | "CHALLENGER"; customerId: number; amount: number };
    const affected: { code: string; credit: number; customerId: number; challengeCredit: number; credits: CreditLine[] }[] = [];
    const addCredit = async (customerId: number, amount: number, bookingId: number) => {
      if (amount <= 0) return;
      await c.query("UPDATE customers SET credit_balance = credit_balance + $2 WHERE id = $1", [customerId, amount]);
      await c.query("INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) VALUES ($1, $2, 'RAIN', $3, $4)", [
        customerId, amount, bookingId, ctx.now,
      ]);
    };
    for (const row of await loadDayBookings(c, field.id, date)) {
      if (!overlaps(row.startHour, row.hours, from, to - from)) continue;
      // lock order booking → challenge (same as cancel / reschedule / challenge payment)
      const bk = await loadBookingByCode(c, row.code, true);
      if (!bk || bk.status !== "CONFIRMED") continue;
      const chs = (await c.query("SELECT id, status, amount, accept_customer_id FROM challenges WHERE booking_id = $1 FOR UPDATE", [bk.id]))
        .rows as { id: number; status: string; amount: number; accept_customer_id: number | null }[];
      const matched = chs.find((x) => x.status === "MATCHED" && x.accept_customer_id);
      // A-27: CHALLENGE credit the owner already received for this booking
      const received = matched
        ? Number(
            (await c.query("SELECT COALESCE(SUM(amount), 0) AS s FROM credit_entries WHERE booking_id = $1 AND customer_id = $2 AND reason = 'CHALLENGE'", [
              bk.id, bk.customerId,
            ])).rows[0].s,
          )
        : 0;
      const split = rainCreditSplit({
        amountPaid: Math.max(0, bk.amountPaid),
        creditUsed: bk.creditUsed,
        challengePaid: matched ? Number(matched.amount) : 0,
        challengeCreditReceived: received,
      });
      await c.query("UPDATE bookings SET status = 'RAIN_CLOSED' WHERE id = $1", [bk.id]);
      // contract 1.3: CLOSED = the booking was cancelled / closed for rain (a MATCHED challenge too, after its refund)
      await c.query("UPDATE challenges SET status = 'CLOSED' WHERE booking_id = $1 AND status IN ('OPEN', 'AWAITING_PAYMENT', 'MATCHED')", [bk.id]);
      await addCredit(bk.customerId, split.owner, bk.id);
      const credits: CreditLine[] = [{ role: "OWNER", customerId: bk.customerId, amount: split.owner }];
      if (matched) {
        // BR-14 / BR-15 (A-27): the accepting team gets back what it paid, on its phone's Customer (usable after registering, A-17)
        await addCredit(Number(matched.accept_customer_id), split.team, bk.id);
        credits.push({ role: "CHALLENGER", customerId: Number(matched.accept_customer_id), amount: split.team });
      }
      if (bk.freeHourUsed) await c.query("UPDATE customers SET free_hours_used = GREATEST(0, free_hours_used - 1) WHERE id = $1", [bk.customerId]);
      affected.push({ code: bk.code, credit: split.owner, customerId: bk.customerId, challengeCredit: matched ? split.team : 0, credits });
    }
    await audit(
      c,
      staff.id,
      "RAIN_CLOSE",
      `${field.id} ${date} ${from}-${to}`,
      { closureId: r.rows[0].id, affected: affected.map((a) => ({ code: a.code, credits: a.credits.map((x) => ({ role: x.role, amount: x.amount })) })) },
      ctx.now,
    );
    return {
      ok: true,
      closure: { id: r.rows[0].id, fieldId: field.id, date, fromHour: from, toHour: to },
      affected,
      messageCode: "OK_CLOSED",
      messageParams: { count: affected.length },
    };
  }, { actor: staff.username, now: ctx.now });
}
