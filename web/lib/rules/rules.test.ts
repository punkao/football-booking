// Unit tests for lib/rules (node --test). Boundary values from docs/04-REQUIREMENTS.md section 3.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  banAfterNoShow,
  cancelCredit,
  challengeAmount,
  challengeDeadlineFrom,
  checkAdvanceWindow,
  checkCancel,
  checkCredit,
  checkFreeHour,
  checkHours,
  checkLeadTime,
  checkNoOverlap,
  checkNoShow,
  checkRainClosable,
  checkRentalQty,
  checkReschedule,
  checkSeriesWeeks,
  checkStartHour,
  computePrice,
  discountAmount,
  fieldPriceFor,
  freeHoursAvailable,
  hoursToNextFree,
  isPaymentInTime,
  payDeadlineFrom,
  paymentPlanFor,
  rentalPriceFor,
  rentalRemaining,
  rainCreditSplit,
  rescheduleDifference,
  seriesDiscountPercent,
  seriesQuote,
  slotStart,
  splitPerPerson,
} from "./index.ts";

const FIVE = { dayRate: 800, eveningRate: 1200 };
const SEVEN = { dayRate: 1200, eveningRate: 1800 };
const HOLIDAYS = ["2026-10-13", "2026-10-23", "2026-12-05", "2026-12-10", "2026-12-31"];
const NOW = new Date("2026-10-09T10:00:00+07:00"); // Friday
const at = (iso: string) => new Date(iso);

test("BR-02 start hour", () => {
  assert.equal(checkStartHour(7)?.code, "INVALID_START_HOUR");
  assert.equal(checkStartHour(8), null);
  assert.equal(checkStartHour(23), null);
  assert.equal(checkStartHour(8.5)?.code, "INVALID_START_HOUR");
});

test("BR-03 hours", () => {
  assert.equal(checkHours(20, 4), null);
  assert.equal(checkHours(21, 4)?.code, "ENDS_AFTER_MIDNIGHT");
  assert.equal(checkHours(10, 0)?.code, "INVALID_HOURS");
});

test("BR-04 advance window", () => {
  assert.equal(checkAdvanceWindow("2026-10-23", NOW), null);
  assert.equal(checkAdvanceWindow("2026-10-24", NOW)?.code, "TOO_FAR_AHEAD");
  assert.equal(checkAdvanceWindow("2026-10-08", NOW)?.code, "PAST_DATE");
});

test("BR-05 lead time", () => {
  assert.equal(checkLeadTime("2026-10-09", 16, at("2026-10-09T15:00:00+07:00")), null);
  assert.equal(checkLeadTime("2026-10-09", 16, at("2026-10-09T15:01:00+07:00"))?.code, "TOO_SOON");
});

test("BR-06 overlap", () => {
  const existing = [{ startHour: 19, hours: 2, status: "CONFIRMED" }];
  assert.equal(checkNoOverlap(20, 1, existing)?.code, "SLOT_TAKEN");
  assert.equal(checkNoOverlap(21, 1, existing), null);
  assert.equal(checkNoOverlap(20, 1, [{ startHour: 19, hours: 2, status: "CANCELLED" }]), null);
});

test("BR-07 / BR-08 / BR-09 prices", () => {
  assert.equal(fieldPriceFor(FIVE, "2026-10-14", 16, 1, HOLIDAYS), 800);
  assert.equal(fieldPriceFor(FIVE, "2026-10-14", 17, 1, HOLIDAYS), 1200);
  assert.equal(fieldPriceFor(SEVEN, "2026-10-14", 16, 1, HOLIDAYS), 1200);
  assert.equal(fieldPriceFor(SEVEN, "2026-10-14", 17, 1, HOLIDAYS), 1800);
  assert.equal(fieldPriceFor(FIVE, "2026-10-10", 9, 1, HOLIDAYS), 1200); // Saturday
  assert.equal(fieldPriceFor(FIVE, "2026-10-13", 9, 1, HOLIDAYS), 1200); // holiday
  assert.equal(fieldPriceFor(FIVE, "2026-10-20", 9, 1, HOLIDAYS), 800);
  assert.equal(fieldPriceFor(FIVE, "2026-10-14", 16, 2, HOLIDAYS), 2000); // BR-09
});

test("BR-10 payment window", () => {
  const created = at("2026-10-09T10:00:00+07:00");
  const deadline = payDeadlineFrom(created);
  assert.equal(isPaymentInTime(deadline, at("2026-10-09T10:15:00+07:00")), true);
  assert.equal(isPaymentInTime(deadline, at("2026-10-09T10:15:01+07:00")), false);
});

test("BR-11 payment plan", () => {
  assert.equal(paymentPlanFor("2026-10-16", 17), "FULL_100"); // Fri
  assert.equal(paymentPlanFor("2026-10-16", 16), "DEPOSIT_50");
  assert.equal(paymentPlanFor("2026-10-15", 17), "DEPOSIT_50"); // Thu
  assert.equal(paymentPlanFor("2026-10-13", 17), "DEPOSIT_50"); // holiday Tue
  assert.equal(paymentPlanFor("2026-10-17", 17), "FULL_100"); // Sat
});

test("BR-12 totals", () => {
  const a = computePrice({ fieldPrice: 2400, paymentPlan: "DEPOSIT_50" });
  assert.equal(a.payNow, 1200);
  const b = computePrice({ fieldPrice: 2000, creditUsed: 1200, paymentPlan: "DEPOSIT_50" });
  assert.equal(b.netPrice, 800);
  assert.equal(b.payNow, 400);
  assert.equal(b.dueAtField, 400);
  const c = computePrice({ fieldPrice: 1250, paymentPlan: "DEPOSIT_50" });
  assert.equal(c.payNow, 625);
  const d = computePrice({ fieldPrice: 1230, rentalPrice: 30, paymentPlan: "DEPOSIT_50" });
  assert.equal(d.payNow, 630);
  const e = computePrice({ fieldPrice: 1200, rentalPrice: 50, creditUsed: 1250, paymentPlan: "DEPOSIT_50" });
  assert.equal(e.netPrice, 0);
  assert.equal(e.payNow, 0);
});

test("BR-13 cancel credit", () => {
  const start = slotStart("2026-10-10", 19);
  const exactly24 = new Date(start.getTime() - 24 * 3600e3);
  const minus1 = new Date(start.getTime() - (24 * 60 - 1) * 60e3);
  assert.equal(cancelCredit({ start, now: exactly24, amountPaid: 600, creditUsed: 100 }), 700);
  assert.equal(cancelCredit({ start, now: minus1, amountPaid: 600, creditUsed: 100 }), 0);
});

test("BR-14 rain closable", () => {
  assert.equal(checkRainClosable({ id: "A", covered: false }), null);
  assert.equal(checkRainClosable({ id: "C", covered: true })?.code, "RAIN_COVERED_FIELD");
});

test("BR-15 credit limits", () => {
  assert.equal(checkCredit(2100, 5000, 2000)?.code, "CREDIT_EXCEEDS_TOTAL");
  assert.equal(checkCredit(1300, 1200, 2000)?.code, "CREDIT_INSUFFICIENT");
  assert.equal(checkCredit(1200, 1200, 2000), null);
});

test("BR-16 ban window", () => {
  const first = at("2026-09-09T19:15:00+07:00");
  assert.ok(banAfterNoShow(at("2026-10-09T19:15:00+07:00"), [first])); // 30 days
  assert.equal(banAfterNoShow(at("2026-10-10T19:15:00+07:00"), [first]), null); // 31 days
  assert.equal(banAfterNoShow(at("2026-10-10T19:15:00+07:00"), []), null);
});

test("BR-17 no-show grace", () => {
  const start = slotStart("2026-10-09", 19);
  assert.equal(checkNoShow("CONFIRMED", start, new Date(start.getTime() + 14 * 60e3))?.code, "NO_SHOW_TOO_EARLY");
  assert.equal(checkNoShow("CONFIRMED", start, new Date(start.getTime() + 15 * 60e3)), null);
});

test("BR-18 / BR-19 / BR-20 series", () => {
  assert.equal(checkSeriesWeeks(3)?.code, "SERIES_WEEKS_RANGE");
  assert.equal(checkSeriesWeeks(4), null);
  assert.equal(checkSeriesWeeks(12), null);
  assert.equal(checkSeriesWeeks(13)?.code, "SERIES_WEEKS_RANGE");
  assert.equal(seriesDiscountPercent(7), 0);
  assert.equal(seriesDiscountPercent(8), 10);
  const weeks = Array.from({ length: 10 }, () => ({ date: "2026-10-14", fieldPrice: 2400, paymentPlan: "DEPOSIT_50" as const }));
  assert.equal(seriesQuote(weeks).payNow, 10800);
});

test("BR-22 rentals", () => {
  assert.equal(rentalPriceFor([{ itemId: "BIB", qty: 2 }, { itemId: "BALL", qty: 1 }], [{ id: "BIB", price: 50 }, { id: "BALL", price: 30 }]), 130);
  assert.equal(checkRentalQty("BIB", 7, 6)?.code, "RENTAL_OUT_OF_STOCK");
  assert.equal(checkRentalQty("BIB", 6, 6), null);
  assert.equal(checkRentalQty("BALL", 11, 10)?.code, "RENTAL_OUT_OF_STOCK");
  assert.equal(rentalRemaining(6, 20, 1, [{ startHour: 19, hours: 1, qty: 6, returnedQty: 0 }]), 0);
  assert.equal(rentalRemaining(6, 20, 1, [{ startHour: 19, hours: 1, qty: 6, returnedQty: 6 }]), 6);
});

test("BR-23 / BR-24 loyalty", () => {
  assert.equal(freeHoursAvailable(9, 0), 0);
  assert.equal(freeHoursAvailable(10, 0), 1);
  assert.equal(hoursToNextFree(7), 3);
  const base = { isMember: true, paidHours: 10, freeHoursUsed: 0 };
  assert.equal(checkFreeHour({ ...base, date: "2026-10-16", startHour: 16 }), null);
  assert.equal(checkFreeHour({ ...base, date: "2026-10-16", startHour: 17 })?.code, "FREE_HOUR_NOT_ELIGIBLE");
  assert.equal(checkFreeHour({ ...base, date: "2026-10-17", startHour: 9 })?.code, "FREE_HOUR_NOT_ELIGIBLE");
});

test("BR-25 reschedule", () => {
  const start = slotStart("2026-10-12", 9);
  assert.equal(checkReschedule({ status: "CONFIRMED", start, now: NOW, rescheduleCount: 1 })?.code, "RESCHEDULE_LIMIT");
  const late = new Date(start.getTime() - (24 * 60 - 1) * 60e3);
  assert.equal(checkReschedule({ status: "CONFIRMED", start, now: late, rescheduleCount: 0 })?.code, "RESCHEDULE_TOO_LATE");
  assert.deepEqual(rescheduleDifference(800, 1200), { extraPay: 400, creditBack: 0 });
});

test("BR-27 split", () => {
  assert.equal(splitPerPerson(2400, 12), 200);
  assert.equal(splitPerPerson(1000, 3), 334);
});

test("BR-28 challenge amount", () => {
  assert.equal(challengeAmount(1800, 0), 900);
});

// ---------- phase 7.5 ----------
test("BR-13 / A-22 cancel until 1 minute before the start", () => {
  const start = slotStart("2026-10-12", 19);
  assert.equal(checkCancel("CONFIRMED", start, new Date(start.getTime() - 60e3)), null); // 1 minute before
  assert.equal(checkCancel("CONFIRMED", start, start)?.code, "CANCEL_TOO_LATE"); // exactly the start
  assert.equal(checkCancel("CONFIRMED", start, new Date(start.getTime() + 1000))?.code, "CANCEL_TOO_LATE");
});

test("BR-28 / A-18 / A-21 MATCHED blocks cancel and reschedule", () => {
  const start = slotStart("2026-10-16", 18);
  assert.equal(checkCancel("CONFIRMED", start, NOW, true)?.code, "CHALLENGE_MATCHED");
  assert.equal(checkCancel("CONFIRMED", start, NOW, false), null);
  assert.equal(checkReschedule({ status: "CONFIRMED", start, now: NOW, rescheduleCount: 0, challengeMatched: true })?.code, "CHALLENGE_MATCHED");
  assert.equal(checkReschedule({ status: "CONFIRMED", start, now: NOW, rescheduleCount: 0, challengeMatched: false }), null);
});

test("BR-28 / A-23 opponent pays in time at exactly 15 minutes", () => {
  const accepted = at("2026-10-09T10:15:01+07:00");
  const deadline = challengeDeadlineFrom(accepted);
  assert.equal(isPaymentInTime(deadline, at("2026-10-09T10:30:01+07:00")), true); // 15 min 0 s
  assert.equal(isPaymentInTime(deadline, at("2026-10-09T10:30:02+07:00")), false); // 15 min 1 s
});

test("BR-19 / A-24 discount with satang is rounded up", () => {
  assert.equal(discountAmount(2400, 10), 240);
  assert.equal(discountAmount(805, 10), 81); // 80.5 → 81
  assert.equal(discountAmount(801, 10), 81); // 80.1 → 81
  assert.equal(discountAmount(800, 0), 0);
});

// ---------- phase 7.5 round 2 ----------
test("BR-14 / A-27 rain on a MATCHED booking: everyone gets back what they paid", () => {
  // A Fri 18:00 paid 1,200 · team paid 600 → team 600, owner 1,200 − 600 = 600
  assert.deepEqual(rainCreditSplit({ amountPaid: 1200, creditUsed: 0, challengePaid: 600, challengeCreditReceived: 600 }), { owner: 600, team: 600 });
  // owner paid exactly what the challenge gave → 0
  assert.deepEqual(rainCreditSplit({ amountPaid: 600, creditUsed: 0, challengePaid: 600, challengeCreditReceived: 600 }), { owner: 0, team: 600 });
  // never below 0
  assert.deepEqual(rainCreditSplit({ amountPaid: 600, creditUsed: 0, challengePaid: 1000, challengeCreditReceived: 1000 }), { owner: 0, team: 1000 });
  // no challenge → plain BR-14
  assert.deepEqual(rainCreditSplit({ amountPaid: 1000, creditUsed: 200, challengePaid: 0, challengeCreditReceived: 0 }), { owner: 1200, team: 0 });
});

test("BR-25 / A-28 AWAITING_PAYMENT blocks reschedule", () => {
  const start = slotStart("2026-10-16", 18);
  assert.equal(checkReschedule({ status: "CONFIRMED", start, now: NOW, rescheduleCount: 0, challengePending: true })?.code, "CHALLENGE_PENDING");
  assert.equal(checkReschedule({ status: "CONFIRMED", start, now: NOW, rescheduleCount: 0, challengeMatched: true, challengePending: false })?.code, "CHALLENGE_MATCHED");
  assert.equal(checkReschedule({ status: "CONFIRMED", start, now: NOW, rescheduleCount: 0, challengePending: false }), null);
});
