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

/** BR-39 / T-09: end not before start · at most 3 calendar months counting both days (1 Oct – 31 Dec ok) */
export function checkReportRange(from: unknown, to: unknown): RuleError | null {
  if (!isValidDateStr(from) || !isValidDateStr(to)) return { code: "INVALID_DATE" };
  if (to < from) return { code: "REPORT_RANGE_ORDER" };
  if (to >= addMonths(from, REPORT_MAX_MONTHS)) return { code: "REPORT_RANGE_TOO_LONG", params: { months: REPORT_MAX_MONTHS } };
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
