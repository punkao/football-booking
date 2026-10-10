// BR-02 – BR-06 (+ closures): time rules for a booking. Pure functions.
import { HOUR_MS, addDays, slotStart, todayOf } from "./time.ts";

export type RuleError = { code: string; params?: Record<string, string | number> };

export const OPEN_HOUR = 8; // BR-02 first start 08:00
export const LAST_START_HOUR = 23; // BR-02 last start 23:00
export const CLOSE_HOUR = 24; // BR-03 must end by 24:00
export const MAX_ADVANCE_DAYS = 14; // BR-04
export const MIN_LEAD_MINUTES = 60; // BR-05

/** Statuses that hold the field (contract 1.2) */
export const BLOCKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "NO_SHOW"] as const;

export function isBlocking(status: string): boolean {
  return (BLOCKING_STATUSES as readonly string[]).includes(status);
}

/** BR-02: start on the hour, 08:00 – 23:00 */
export function checkStartHour(startHour: unknown): RuleError | null {
  if (typeof startHour !== "number" || !Number.isInteger(startHour) || startHour < OPEN_HOUR || startHour > LAST_START_HOUR) {
    return { code: "INVALID_START_HOUR" };
  }
  return null;
}

/** BR-03: at least 1 whole hour, must end by 24:00 */
export function checkHours(startHour: number, hours: unknown): RuleError | null {
  if (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1) return { code: "INVALID_HOURS" };
  if (startHour + hours > CLOSE_HOUR) return { code: "ENDS_AFTER_MIDNIGHT" };
  return null;
}

/** BR-04: from today up to today + 14 days (single bookings only) */
export function checkAdvanceWindow(date: string, now: Date): RuleError | null {
  const today = todayOf(now);
  if (date < today) return { code: "PAST_DATE" };
  if (date > addDays(today, MAX_ADVANCE_DAYS)) return { code: "TOO_FAR_AHEAD", params: { maxDate: addDays(today, MAX_ADVANCE_DAYS) } };
  return null;
}

export function maxBookableDate(now: Date): string {
  return addDays(todayOf(now), MAX_ADVANCE_DAYS);
}

/** BR-05: start must be at least 60 minutes after "now" */
export function checkLeadTime(date: string, startHour: number, now: Date): RuleError | null {
  const diff = slotStart(date, startHour).getTime() - now.getTime();
  if (diff < MIN_LEAD_MINUTES * 60 * 1000) return { code: "TOO_SOON" };
  return null;
}

export function overlaps(aStart: number, aHours: number, bStart: number, bHours: number): boolean {
  return aStart < bStart + bHours && bStart < aStart + aHours;
}

export type ExistingBooking = { startHour: number; hours: number; status: string; id?: number };

/** BR-06: no overlapping booking with a blocking status on the same field/date */
export function checkNoOverlap(startHour: number, hours: number, existing: ExistingBooking[], ignoreId?: number): RuleError | null {
  for (const b of existing) {
    if (ignoreId !== undefined && b.id === ignoreId) continue;
    if (isBlocking(b.status) && overlaps(startHour, hours, b.startHour, b.hours)) return { code: "SLOT_TAKEN" };
  }
  return null;
}

/** Rain closures (BR-14) also make the slot unavailable */
export function checkClosures(startHour: number, hours: number, closures: { fromHour: number; toHour: number }[]): RuleError | null {
  for (const c of closures) {
    if (overlaps(startHour, hours, c.fromHour, c.toHour - c.fromHour)) return { code: "FIELD_CLOSED" };
  }
  return null;
}

/** BR-02 → BR-03 → BR-04 → BR-05 in order. Series bookings skip BR-04 (BR-18). */
export function validateBookingTime(input: { date: string; startHour: unknown; hours: unknown; now: Date; series?: boolean }): RuleError | null {
  const e1 = checkStartHour(input.startHour);
  if (e1) return e1;
  const e2 = checkHours(input.startHour as number, input.hours);
  if (e2) return e2;
  if (!input.series) {
    const e3 = checkAdvanceWindow(input.date, input.now);
    if (e3) return e3;
  } else if (input.date < todayOf(input.now)) {
    return { code: "PAST_DATE" };
  }
  return checkLeadTime(input.date, input.startHour as number, input.now);
}

/** time-based slot state for the availability table */
export function slotTimeState(date: string, hour: number, now: Date): "ok" | "past" | "out-of-range" {
  const today = todayOf(now);
  if (date < today) return "past";
  if (date > addDays(today, MAX_ADVANCE_DAYS)) return "out-of-range";
  if (slotStart(date, hour).getTime() - now.getTime() < MIN_LEAD_MINUTES * 60 * 1000) return "past";
  return "ok";
}

export function hoursUntil(date: string, startHour: number, now: Date): number {
  return (slotStart(date, startHour).getTime() - now.getTime()) / HOUR_MS;
}
