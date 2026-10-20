// Back-office rules (pure): BR-39 report range · BR-40 money by day · BR-41 field use · BR-44 access ·
// T-21 popular hours · NFR-22 / ADR-19 CSV.
import { addDays, isValidDateStr } from "./time.ts";
import { BLOCKING_STATUSES, LAST_START_HOUR, OPEN_HOUR } from "./schedule.ts";
import type { RuleError } from "./schedule.ts";

export const REPORT_MAX_MONTHS = 3;
export const OPEN_HOURS_PER_DAY = 16; // 08:00 – 24:00

/** date + n calendar months (day clamped to the month's last day) */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/**
 * BR-39 / CR-02 (4) / A-46: the last end date allowed for a report starting on `from` —
 * the day before the same day 3 months later (1 Oct → 31 Dec) · when that month has no such day,
 * the month's last day itself (30 Nov → 28 Feb · 31 Aug → 30 Nov)
 */
export function reportMaxEnd(from: string): string {
  const same = addMonths(from, REPORT_MAX_MONTHS); // day clamped to the month's last day
  return same.slice(8) === from.slice(8) ? addDays(same, -1) : same;
}

/** BR-39 / T-09: end not before start · at most 3 calendar months counting both days (1 Oct – 31 Dec ok · 30 Nov – 28 Feb ok) */
export function checkReportRange(from: unknown, to: unknown): RuleError | null {
  if (!isValidDateStr(from) || !isValidDateStr(to)) return { code: "INVALID_DATE" };
  if (to < from) return { code: "REPORT_RANGE_ORDER" };
  if (to > reportMaxEnd(from)) return { code: "REPORT_RANGE_TOO_LONG", params: { months: REPORT_MAX_MONTHS } };
  return null;
}

export type Area = "DASHBOARD" | "BOOKINGS" | "CHATS" | "ALERTS" | "REPORTS" | "AUDIT";

/** BR-44 / A-33 (+ BR-39 reports): OWNER and MANAGER see the back office, money reports and AuditLog are OWNER only */
export function canAccess(role: string, area: Area): boolean {
  if (role === "OWNER") return true;
  if (role === "MANAGER") return area === "DASHBOARD" || area === "BOOKINGS" || area === "CHATS" || area === "ALERTS";
  return false;
}

export function daysOf(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export type MoneyRow = { day: string; amount: number; method: string };
export type DayMoney = { date: string; bookingMoney: number; salesCash: number; salesPromptpay: number; salesMoney: number; total: number };

/**
 * BR-40 / T-10: money is counted on the Bangkok day it was received — booking payments (Payment.paidAt, credit is not
 * money) + counter sales (CounterSale.createdAt). Rows outside [from, to] are ignored.
 */
export function summarizeMoney(from: string, to: string, payments: MoneyRow[], sales: MoneyRow[], bug = false) {
  const days = new Map<string, DayMoney>(daysOf(from, to).map((d) => [d, { date: d, bookingMoney: 0, salesCash: 0, salesPromptpay: 0, salesMoney: 0, total: 0 }]));
  for (const p of payments) {
    const d = days.get(p.day);
    if (!d || p.method === "CREDIT") continue;
    d.bookingMoney += p.amount;
  }
  const lastSalesDay = bug ? addDays(to, -1) : to;
  for (const s of sales) {
    const d = days.get(s.day);
    if (!d || s.day > lastSalesDay) continue;
    if (s.method === "CASH") d.salesCash += s.amount;
    else d.salesPromptpay += s.amount;
  }
  const list = [...days.values()];
  for (const d of list) {
    d.salesMoney = d.salesCash + d.salesPromptpay;
    d.total = d.bookingMoney + d.salesMoney;
  }
  const sum = (k: keyof Omit<DayMoney, "date">) => list.reduce((s, d) => s + d[k], 0);
  return {
    days: list,
    bookingMoney: sum("bookingMoney"),
    salesCash: sum("salesCash"),
    salesPromptpay: sum("salesPromptpay"),
    salesMoney: sum("salesMoney"),
    total: sum("total"),
  };
}

/**
 * CR-03 (1) / A-41: booking money split by channel, counted on the Bangkok day it was received (same rule as BR-40).
 * PROMPTPAY → bookingPromptpay · CASH_AT_FIELD → bookingCash · CREDIT is not money (skipped) →
 * bookingPromptpay + bookingCash always equals summarizeMoney().bookingMoney
 */
export function splitBookingMoney(from: string, to: string, payments: MoneyRow[]) {
  const days = new Map(daysOf(from, to).map((d) => [d, { date: d, bookingPromptpay: 0, bookingCash: 0 }]));
  for (const p of payments) {
    const d = days.get(p.day);
    if (!d) continue;
    if (p.method === "PROMPTPAY") d.bookingPromptpay += p.amount;
    else if (p.method === "CASH_AT_FIELD") d.bookingCash += p.amount;
  }
  const list = [...days.values()];
  return {
    days: list,
    bookingPromptpay: list.reduce((s, d) => s + d.bookingPromptpay, 0),
    bookingCash: list.reduce((s, d) => s + d.bookingCash, 0),
  };
}

/** CR-03 (2): statuses that count as "used" for the hours report — paid · checked in · no-show (PENDING_PAYMENT is not paid yet) */
export const USED_STATUSES = ["CONFIRMED", "CHECKED_IN", "NO_SHOW"] as const;

/** CR-03 (2): hours ÷ (16 × days) × 100, rounded to 1 decimal (shop answer · differs from BR-41 whole percent on the dashboard) */
export function usePercent(hours: number, dayCount: number): number {
  const base = OPEN_HOURS_PER_DAY * dayCount;
  return base > 0 ? Math.round((hours / base) * 1000) / 10 : 0;
}

/**
 * CR-03 (2) / A-42: hours used per field by the day of play · percent = hours ÷ (16 × days in range), 1 decimal.
 * Rain-closed / cancelled / expired / pending bookings are not counted; the base is not reduced for closed days.
 */
export function fieldUse(fieldIds: string[], from: string, to: string, bookings: { date: string; fieldId: string; hours: number; status: string }[]) {
  const dayList = daysOf(from, to);
  const perDay = new Map<string, Record<string, number>>(dayList.map((d) => [d, Object.fromEntries(fieldIds.map((f) => [f, 0]))]));
  for (const b of bookings) {
    const day = perDay.get(b.date);
    if (!day || !(USED_STATUSES as readonly string[]).includes(b.status) || !(b.fieldId in day)) continue;
    day[b.fieldId] += b.hours;
  }
  return {
    days: dayList.map((date) => ({ date, fieldHours: perDay.get(date) as Record<string, number> })),
    fields: fieldIds.map((fieldId) => {
      const hours = dayList.reduce((s, d) => s + (perDay.get(d) as Record<string, number>)[fieldId], 0);
      return { fieldId, hours, percent: usePercent(hours, dayList.length) };
    }),
  };
}

/** BR-41: blocked hours ÷ 16 × 100, rounded to a whole percent */
export function utilizationPercent(blockedHours: number): number {
  return Math.round((blockedHours / OPEN_HOURS_PER_DAY) * 100);
}

/** T-21: number of field-blocking bookings per start hour 08:00 – 23:00 */
export function popularHours(bookings: { startHour: number; status: string }[]): { hour: number; count: number }[] {
  const out: { hour: number; count: number }[] = [];
  for (let h = OPEN_HOUR; h <= LAST_START_HOUR; h++) {
    out.push({ hour: h, count: bookings.filter((b) => b.startHour === h && (BLOCKING_STATUSES as readonly string[]).includes(b.status)).length });
  }
  return out;
}

/** ADR-19: one CSV cell. Text starting with = + - @ tab CR gets a leading ' · , " or a line break → quoted */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** NFR-22: UTF-8 BOM + CRLF */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
