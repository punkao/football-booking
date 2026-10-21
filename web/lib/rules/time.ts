// Time helpers — the shop runs on Asia/Bangkok (UTC+7, no DST).
// All functions are pure: "now" is always passed in (ADR-04).

export const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export type BkkParts = { date: string; hour: number; minute: number; second: number; weekday: number };

/** Calendar parts of an instant, in Bangkok time. weekday: 0 = Sunday … 6 = Saturday */
export function bkkParts(d: Date): BkkParts {
  const t = new Date(d.getTime() + BKK_OFFSET_MS);
  return {
    date: t.toISOString().slice(0, 10),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    second: t.getUTCSeconds(),
    weekday: t.getUTCDay(),
  };
}

export function todayOf(now: Date): string {
  return bkkParts(now).date;
}

export function isValidDateStr(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + "T00:00:00Z");
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** Instant at which hour `hour` (0–24) of Bangkok date `date` begins */
export function slotStart(date: string, hour: number): Date {
  return new Date(Date.parse(date + "T00:00:00+07:00") + hour * HOUR_MS);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}

/** whole days from a to b (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
}

export function weekdayOf(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

export function hhmm(hour: number): string {
  return String(hour).padStart(2, "0") + ":00";
}

/** K3: เปิดช่องทดสอบ (POST /api/test/*) เฉพาะเมื่อ ALLOW_TEST_RESET เป็น "1" เท่านั้น */
export function testSeamOn(env: Record<string, string | undefined>): boolean {
  return env.ALLOW_TEST_RESET === "1";
}

/**
 * K3 · ADR-04: "ตอนนี้" ของแอป — ใช้แถวนาฬิกาที่ล็อก (app_settings.clock) เฉพาะเมื่อเปิดช่องทดสอบ
 * ปิดช่องทดสอบแล้วต้องใช้เวลาจริงเสมอ แม้แถวนั้นค้างอยู่ในฐาน (กันเครื่องจริงติดวันที่ 9 ต.ค. 2569)
 */
export function nowFrom(clockRow: string | null | undefined, seamOn: boolean, realNow: Date): Date {
  return seamOn && clockRow ? new Date(clockRow) : realNow;
}
