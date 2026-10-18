// BR-07 – BR-12, BR-15: price and payment plan. Pure functions.
import { weekdayOf } from "./time.ts";

export const EVENING_START_HOUR = 17; // BR-07
export type PaymentPlan = "DEPOSIT_50" | "FULL_100";
export type Rates = { dayRate: number; eveningRate: number };

export function ceilBaht(n: number): number {
  return Math.ceil(n - 1e-9) + 0; // "+ 0" turns -0 into 0
}

export function isWeekend(date: string): boolean {
  const w = weekdayOf(date);
  return w === 0 || w === 6;
}

export function isHoliday(date: string, holidays: Iterable<string>): boolean {
  for (const h of holidays) if (h === date) return true;
  return false;
}

/** BR-08: Saturday, Sunday and holidays use the evening rate all day */
export function isEveningPricedDay(date: string, holidays: Iterable<string>): boolean {
  return isWeekend(date) || isHoliday(date, holidays);
}

/** BR-07 / BR-08: rate of one hour */
export function hourlyRate(field: Rates, date: string, hour: number, holidays: Iterable<string>): number {
  if (isEveningPricedDay(date, holidays) || hour >= EVENING_START_HOUR) return field.eveningRate;
  return field.dayRate;
}

/** BR-09: price every hour separately */
export function fieldPriceFor(field: Rates, date: string, startHour: number, hours: number, holidays: Iterable<string>): number {
  const hs = [...holidays];
  let total = 0;
  for (let h = startHour; h < startHour + hours; h++) total += hourlyRate(field, date, h, hs);
  return total;
}

/** BR-11: FULL_100 when the booking starts at/after 17:00 on Friday or Saturday, otherwise DEPOSIT_50 */
export function paymentPlanFor(date: string, startHour: number): PaymentPlan {
  const w = weekdayOf(date);
  const fullDays = [5, 6];
  if (fullDays.includes(w) && startHour >= EVENING_START_HOUR) return "FULL_100";
  return "DEPOSIT_50";
}

export function planPercent(plan: PaymentPlan): number {
  return plan === "FULL_100" ? 100 : 50;
}

export type RentalLine = { itemId: string; qty: number };
export function rentalPriceFor(rentals: RentalLine[], items: { id: string; price: number }[]): number {
  let total = 0;
  for (const r of rentals) {
    const item = items.find((i) => i.id === r.itemId);
    if (item && r.qty > 0) total += item.price * r.qty;
  }
  return total;
}

export type PriceBreakdown = {
  fieldPrice: number;
  discount: number;
  freeHourValue: number;
  rentalPrice: number;
  totalPrice: number;
  creditUsed: number;
  netPrice: number;
  paymentPlan: PaymentPlan;
  payNow: number;
  dueAtField: number;
};

/**
 * BR-12: total = field − discount − free hour + rentals · net = total − credit
 *        payNow = ceil(net × 50% or 100%) · dueAtField = net − payNow
 * BR-15: credit can never exceed total (clamped here; callers report CREDIT_EXCEEDS_TOTAL)
 */
export function computePrice(input: {
  fieldPrice: number;
  discount?: number;
  freeHourValue?: number;
  rentalPrice?: number;
  creditUsed?: number;
  paymentPlan: PaymentPlan;
}): PriceBreakdown {
  const discount = input.discount ?? 0;
  const freeHourValue = input.freeHourValue ?? 0;
  const rentalPrice = input.rentalPrice ?? 0;
  const totalPrice = Math.max(0, input.fieldPrice - discount - freeHourValue + rentalPrice);
  const creditUsed = Math.max(0, Math.min(input.creditUsed ?? 0, totalPrice));
  const netPrice = totalPrice - creditUsed;
  const payNow = ceilBaht((netPrice * planPercent(input.paymentPlan)) / 100);
  return {
    fieldPrice: input.fieldPrice,
    discount,
    freeHourValue,
    rentalPrice,
    totalPrice,
    creditUsed,
    netPrice,
    paymentPlan: input.paymentPlan,
    payNow,
    dueAtField: netPrice - payNow,
  };
}

/** BR-15: credit used must be ≤ balance and ≤ total */
export function checkCredit(creditUsed: number, balance: number, totalPrice: number): { code: string } | null {
  if (!Number.isInteger(creditUsed) || creditUsed < 0) return { code: "INVALID_CREDIT" };
  if (creditUsed > totalPrice) return { code: "CREDIT_EXCEEDS_TOTAL" };
  if (creditUsed > balance) return { code: "CREDIT_INSUFFICIENT" };
  return null;
}
