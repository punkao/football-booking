// BR-18 – BR-24, BR-27, BR-28: series, rentals, loyalty, split, challenge. Pure functions.
import type { RuleError } from "./schedule.ts";
import { overlaps } from "./schedule.ts";
import { EVENING_START_HOUR, ceilBaht, computePrice } from "./pricing.ts";
import type { PaymentPlan, PriceBreakdown } from "./pricing.ts";
import { addDays, weekdayOf } from "./time.ts";

// ---------- BR-18 / BR-19 / BR-20 / BR-21: recurring series ----------
export const SERIES_MIN_WEEKS = 4;
export const SERIES_MAX_WEEKS = 12;
export const SERIES_DISCOUNT_MIN_WEEKS = 8;
export const SERIES_DISCOUNT_PERCENT = 10;

/** BR-18: 4 – 12 consecutive weeks */
export function checkSeriesWeeks(weeks: unknown): RuleError | null {
  if (typeof weeks !== "number" || !Number.isInteger(weeks) || weeks < SERIES_MIN_WEEKS || weeks > SERIES_MAX_WEEKS) {
    return { code: "SERIES_WEEKS_RANGE" };
  }
  return null;
}

export function seriesDates(startDate: string, weeks: number): string[] {
  return Array.from({ length: weeks }, (_, i) => addDays(startDate, i * 7));
}

/** BR-19: 10% off field price when the number of weeks actually booked ≥ 8 */
export function seriesDiscountPercent(weeksBooked: number): number {
  return weeksBooked >= SERIES_DISCOUNT_MIN_WEEKS ? SERIES_DISCOUNT_PERCENT : 0;
}

/** BR-19 (A-24): a discount with satang is rounded UP to a whole baht */
export function discountAmount(fieldPrice: number, percent: number): number {
  return ceilBaht((fieldPrice * percent) / 100);
}

/** BR-19 + BR-20: per-week prices (each week uses its own BR-11 plan); pay now = sum of weekly payNow */
export function seriesQuote(weeks: { date: string; fieldPrice: number; paymentPlan: PaymentPlan }[]): {
  discountPercent: number;
  weeks: (PriceBreakdown & { date: string })[];
  fieldPrice: number;
  discount: number;
  totalPrice: number;
  payNow: number;
  dueAtField: number;
} {
  const percent = seriesDiscountPercent(weeks.length);
  const rows = weeks.map((w) => ({
    date: w.date,
    ...computePrice({ fieldPrice: w.fieldPrice, discount: discountAmount(w.fieldPrice, percent), paymentPlan: w.paymentPlan }),
  }));
  const sum = (k: "fieldPrice" | "discount" | "totalPrice" | "payNow" | "dueAtField") => rows.reduce((s, r) => s + r[k], 0);
  return {
    discountPercent: percent,
    weeks: rows,
    fieldPrice: sum("fieldPrice"),
    discount: sum("discount"),
    totalPrice: sum("totalPrice"),
    payNow: sum("payNow"),
    dueAtField: sum("dueAtField"),
  };
}

// ---------- BR-22: rentals ----------
export type RentalUse = { startHour: number; hours: number; qty: number; returnedQty: number };

/**
 * BR-22: remaining for a time range = stock − qty rented by overlapping bookings
 *        − qty not yet returned by bookings that already ended earlier the same day
 */
export function rentalRemaining(stock: number, startHour: number, hours: number, uses: RentalUse[]): number {
  let used = 0;
  for (const u of uses) {
    if (overlaps(startHour, hours, u.startHour, u.hours)) used += u.qty;
    else if (u.startHour + u.hours <= startHour) used += Math.max(0, u.qty - u.returnedQty);
  }
  return Math.max(0, stock - used);
}

/** highest quantity that may be rented given what remains */
export function maxRentable(_itemId: string, remaining: number): number {
  return remaining;
}

export function checkRentalQty(itemId: string, qty: number, remaining: number): RuleError | null {
  if (!Number.isInteger(qty) || qty < 0) return { code: "INVALID_QTY" };
  if (qty > maxRentable(itemId, remaining)) return { code: "RENTAL_OUT_OF_STOCK", params: { item: itemId, remaining } };
  return null;
}

// ---------- BR-23 / BR-24: loyalty hours ----------
export const HOURS_PER_FREE_HOUR = 10;

/** BR-23: one free hour per 10 paid hours */
export function freeHoursAvailable(paidHours: number, freeHoursUsed: number): number {
  return Math.max(0, Math.floor(paidHours / HOURS_PER_FREE_HOUR) - freeHoursUsed);
}

/** BR-23: "N more hours" until the next free hour */
export function hoursToNextFree(paidHours: number): number {
  return HOURS_PER_FREE_HOUR - (paidHours % HOURS_PER_FREE_HOUR);
}

/** BR-23: hours that count = booked hours minus the free hour */
export function countedHours(hours: number, freeHourUsed: boolean): number {
  return Math.max(0, hours - (freeHourUsed ? 1 : 0));
}

/** BR-24: free hour only for slots starting before 17:00 Monday–Friday (holidays included, A-15) */
export function isFreeHourSlot(date: string, startHour: number): boolean {
  const w = weekdayOf(date);
  return w >= 1 && w <= 5 && startHour < EVENING_START_HOUR;
}

/** BR-24: members only, needs an available free hour, slot must qualify. 1 free hour per booking. */
export function checkFreeHour(input: { isMember: boolean; paidHours: number; freeHoursUsed: number; date: string; startHour: number }): RuleError | null {
  if (!input.isMember) return { code: "MEMBER_REQUIRED" };
  if (!isFreeHourSlot(input.date, input.startHour)) return { code: "FREE_HOUR_NOT_ELIGIBLE" };
  if (freeHoursAvailable(input.paidHours, input.freeHoursUsed) < 1) return { code: "FREE_HOUR_NONE" };
  return null;
}

// ---------- BR-27: split link ----------
export const SPLIT_MIN_PEOPLE = 2;
export const SPLIT_MAX_PEOPLE = 30;

export function checkSplitCount(n: number): RuleError | null {
  if (!Number.isInteger(n) || n < SPLIT_MIN_PEOPLE || n > SPLIT_MAX_PEOPLE) return { code: "SPLIT_COUNT" };
  return null;
}

/** BR-27: per person = net ÷ people, rounded up to a whole baht */
export function splitPerPerson(netPrice: number, people: number): number {
  return ceilBaht(netPrice / people);
}

// ---------- BR-28: challenge ----------
export const CHALLENGE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export const CHALLENGE_PAY_MINUTES = 15;

/** BR-28: only the owner's CONFIRMED booking that has not started yet */
export function checkChallengeCreate(status: string, start: Date, now: Date): RuleError | null {
  if (status !== "CONFIRMED" || now.getTime() >= start.getTime()) return { code: "CHALLENGE_NOT_ALLOWED" };
  return null;
}

/** BR-28 / A-23: the accepting team pays in time up to exactly 15 minutes after accepting (15 min 1 s is late) */
export function challengeDeadlineFrom(acceptedAt: Date): Date {
  return new Date(acceptedAt.getTime() + CHALLENGE_PAY_MINUTES * 60 * 1000);
}

/** BR-28: the accepting team pays (field price − discount) × 50% */
export function challengeAmount(fieldPrice: number, discount: number): number {
  return ceilBaht((fieldPrice - discount) * 0.5);
}
