// BR-01, BR-10, BR-13, BR-14, BR-15, BR-16, BR-17, BR-25, BR-26: booking lifecycle rules. Pure functions.
import type { RuleError } from "./schedule.ts";
import { DAY_MS, HOUR_MS, MINUTE_MS, bkkParts, daysBetween } from "./time.ts";

// ---------- BR-01 ----------
export const FIELDS_RAIN_CLOSABLE = ["A", "B"]; // outdoor fields only

/** BR-01 / BR-14: only uncovered fields can be closed for rain */
export function checkRainClosable(field: { id: string; covered: boolean }): RuleError | null {
  if (field.covered) return { code: "RAIN_COVERED_FIELD", params: { field: field.id } };
  return null;
}

// ---------- BR-10 ----------
export const PAY_WINDOW_MINUTES = 15;

export function payDeadlineFrom(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PAY_WINDOW_MINUTES * MINUTE_MS);
}

/** BR-10: paying exactly at the deadline is in time; one second later is not */
export function isPaymentInTime(payDeadline: Date, now: Date): boolean {
  return now.getTime() <= payDeadline.getTime();
}

// ---------- BR-13 ----------
export const CANCEL_CREDIT_MIN_HOURS = 24;

/**
 * BR-13: the customer can cancel up to 1 minute before the start; at the start time or later → CANCEL_TOO_LATE (A-22)
 * BR-28: a booking whose challenge is MATCHED can't be cancelled by its owner (A-18)
 */
export function checkCancel(status: string, start: Date, now: Date, challengeMatched = false): RuleError | null {
  if (status !== "CONFIRMED" && status !== "PENDING_PAYMENT") return { code: "INVALID_STATUS" };
  if (challengeMatched) return { code: "CHALLENGE_MATCHED" };
  if (now.getTime() >= start.getTime()) return { code: "CANCEL_TOO_LATE" };
  return null;
}

/** BR-13: credit back = paid + credit used when at least 24 hours remain, otherwise 0 */
export function cancelCredit(input: { start: Date; now: Date; amountPaid: number; creditUsed: number; bugMode?: boolean }): number {
  const remaining = input.start.getTime() - input.now.getTime();
  const limit = CANCEL_CREDIT_MIN_HOURS * HOUR_MS;
  const ok = input.bugMode ? remaining > limit : remaining >= limit;
  return ok ? input.amountPaid + input.creditUsed : 0;
}

/** BR-14 / BR-15: rain closure gives back everything that was paid (money + credit) */
export function rainCredit(input: { amountPaid: number; creditUsed: number }): number {
  return input.amountPaid + input.creditUsed;
}

/**
 * BR-14 / BR-15 (A-27): rain closure of a booking whose challenge is MATCHED — everyone gets back what they really paid.
 * team = what the accepting team paid · owner = paid + credit used − CHALLENGE credit already received (not below 0)
 */
export function rainCreditSplit(input: { amountPaid: number; creditUsed: number; challengePaid: number; challengeCreditReceived: number }): {
  owner: number;
  team: number;
} {
  return {
    owner: Math.max(0, rainCredit(input) - input.challengeCreditReceived),
    team: Math.max(0, input.challengePaid),
  };
}

// ---------- BR-16 / BR-17 ----------
export const NO_SHOW_GRACE_MINUTES = 15;
export const BAN_WINDOW_DAYS = 30;
export const BAN_DAYS = 30;

/** BR-17: only CONFIRMED and at least 15 minutes after the start */
export function checkNoShow(status: string, start: Date, now: Date): RuleError | null {
  if (status !== "CONFIRMED") return { code: "INVALID_STATUS" };
  if (now.getTime() - start.getTime() < NO_SHOW_GRACE_MINUTES * MINUTE_MS) return { code: "NO_SHOW_TOO_EARLY" };
  return null;
}

/**
 * BR-16: when a NO_SHOW is recorded at `now`, ban for 30 days if another NO_SHOW of the same
 * customer was recorded within 30 days before (compared by Bangkok calendar date).
 */
export function banAfterNoShow(now: Date, previousNoShowAt: Date[]): Date | null {
  const today = bkkParts(now).date;
  const hit = previousNoShowAt.some((d) => {
    const diff = daysBetween(bkkParts(d).date, today);
    return diff >= 0 && diff <= BAN_WINDOW_DAYS;
  });
  return hit ? new Date(now.getTime() + BAN_DAYS * DAY_MS) : null;
}

export function isBanned(bannedUntil: Date | null | undefined, now: Date): boolean {
  return !!bannedUntil && bannedUntil.getTime() > now.getTime();
}

// ---------- BR-25 ----------
export const RESCHEDULE_MIN_HOURS = 24;
export const RESCHEDULE_LIMIT = 1;

/**
 * BR-25: CONFIRMED, challenge not MATCHED (A-21) and not AWAITING_PAYMENT (A-28), ≥ 24 hours before the original start,
 * once per booking
 */
export function checkReschedule(input: {
  status: string;
  start: Date;
  now: Date;
  rescheduleCount: number;
  challengeMatched?: boolean;
  challengePending?: boolean;
}): RuleError | null {
  if (input.status !== "CONFIRMED") return { code: "INVALID_STATUS" };
  if (input.challengeMatched) return { code: "CHALLENGE_MATCHED" };
  if (input.challengePending) return { code: "CHALLENGE_PENDING" };
  if (input.rescheduleCount >= RESCHEDULE_LIMIT) return { code: "RESCHEDULE_LIMIT" };
  if (input.start.getTime() - input.now.getTime() < RESCHEDULE_MIN_HOURS * HOUR_MS) return { code: "RESCHEDULE_TOO_LATE" };
  return null;
}

/** BR-25: more expensive → pay the difference now · cheaper → difference back as credit */
export function rescheduleDifference(oldTotal: number, newTotal: number): { extraPay: number; creditBack: number } {
  const diff = newTotal - oldTotal;
  return { extraPay: diff > 0 ? diff : 0, creditBack: diff < 0 ? -diff : 0 };
}

// ---------- BR-26 / customer input ----------
export function normalizePhone(phone: unknown): string {
  return typeof phone === "string" ? phone.replace(/[\s-]/g, "") : "";
}

/** team design: Thai phone, 10 digits starting with 0 */
export function checkPhone(phone: string): RuleError | null {
  return /^0\d{9}$/.test(phone) ? null : { code: "INVALID_PHONE" };
}

export const PASSWORD_MIN_LENGTH = 8;
export function checkPassword(pw: unknown): RuleError | null {
  return typeof pw === "string" && pw.length >= PASSWORD_MIN_LENGTH ? null : { code: "PASSWORD_TOO_SHORT" };
}
