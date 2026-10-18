import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MESSAGES, fmtDateTime, money, msg, normLang, rentalName } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { q, tx } from "./db";
import { dbErrorCode } from "@/lib/rules";
import type { Db } from "./db";
import { unsign } from "./crypto";

export class AppError extends Error {
  code: string;
  params?: Record<string, string | number>;
  status: number;
  constructor(code: string, params?: Record<string, string | number>, status?: number) {
    super(code);
    this.code = code;
    this.params = params;
    this.status = status ?? MESSAGES[code]?.status ?? 400;
  }
}

/** throw a rule error (from lib/rules) as an AppError */
export function fail(e: { code: string; params?: Record<string, string | number> } | null): void {
  if (e) throw new AppError(e.code, e.params);
}

export function bugMode(): boolean {
  return process.env.BUG_MODE === "1";
}

/** ADR-04: the one and only "now" of the application */
export async function getNow(db?: Db): Promise<Date> {
  const rows = db
    ? (await db.query("SELECT value FROM app_settings WHERE key = 'clock'")).rows
    : await q<{ value: string }>("SELECT value FROM app_settings WHERE key = 'clock'");
  const v = rows[0]?.value;
  return v ? new Date(v) : new Date();
}

/** ADR-03: lazy expiry before every request that reads / writes bookings (history actor SYSTEM, BR-42) */
export async function expireStale(now: Date): Promise<void> {
  const stale = await q<{ n: number }>(
    `SELECT (SELECT count(*) FROM bookings WHERE status = 'PENDING_PAYMENT' AND pay_deadline < $1)
          + (SELECT count(*) FROM challenges WHERE status = 'AWAITING_PAYMENT' AND pay_deadline < $1) AS n`,
    [now],
  );
  if (!stale[0]?.n) return;
  await tx(
    async (c) => {
      await c.query("UPDATE bookings SET status = 'EXPIRED' WHERE status = 'PENDING_PAYMENT' AND pay_deadline < $1", [now]);
      await c.query(
        "UPDATE challenges SET status = 'OPEN', accept_customer_id = NULL, pay_deadline = NULL WHERE status = 'AWAITING_PAYMENT' AND pay_deadline < $1",
        [now],
      );
    },
    { actor: "SYSTEM", now },
  );
}

export type Ctx = { now: Date; lang: Lang; bug: boolean; req: NextRequest };

export function localizeParams(lang: Lang, params?: Record<string, string | number>): Record<string, string | number> | undefined {
  if (!params) return params;
  const out: Record<string, string | number> = { ...params };
  if (typeof out.item === "string") out.item = rentalName(lang, out.item);
  if (typeof out.date === "string" && out.date.includes("T")) out.date = fmtDateTime(lang, out.date);
  if (typeof out.amount === "number") out.amount = money(lang, out.amount);
  return out;
}

export function errorJson(lang: Lang, code: string, params?: Record<string, string | number>, status?: number) {
  return NextResponse.json(
    { error: { code, message: msg(lang, code, localizeParams(lang, params)), ...(params ? { params } : {}) } },
    { status: status ?? MESSAGES[code]?.status ?? 400 },
  );
}

type Handler<P> = (ctx: Ctx, params: P) => Promise<Response | object>;

/** wraps a route handler: lang, now, lazy expiry and the single error format { error: { code, message } } */
export function route<P = Record<string, string>>(fn: Handler<P>, opts: { expire?: boolean } = {}) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const lang = normLang(req.cookies.get("lang")?.value);
    try {
      const now = await getNow();
      if (opts.expire !== false) await expireStale(now);
      const out = await fn({ now, lang, bug: bugMode(), req }, await context.params);
      if (out instanceof Response) return out;
      const o = out as { messageCode?: string; messageParams?: Record<string, string | number> };
      if (o.messageCode) Object.assign(o, { message: msg(lang, o.messageCode, localizeParams(lang, o.messageParams)) });
      return NextResponse.json(o);
    } catch (e) {
      if (e instanceof AppError) return errorJson(lang, e.code, e.params, e.status);
      // NFR-19: a database constraint caught what the app check missed (e.g. EXCLUDE = BR-06 "slot taken")
      const dbCode = dbErrorCode(e);
      if (dbCode) return errorJson(lang, dbCode);
      console.error("[api]", e);
      return errorJson(lang, "INTERNAL", undefined, 500);
    }
  };
}

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    const b = await req.json();
    return (b && typeof b === "object" ? b : {}) as T;
  } catch {
    return {} as T;
  }
}

export function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// ---------- sessions (ADR-07: httpOnly cookies) ----------
export const CUSTOMER_COOKIE = "ln_customer";
export const STAFF_COOKIE = "ln_staff";
export const ACCESS_COOKIE = "ln_access";

export type CookieGetter = (name: string) => string | undefined;

export function customerIdFrom(get: CookieGetter): number | null {
  return unsign<{ cid: number }>(get(CUSTOMER_COOKIE))?.cid ?? null;
}

export function accessCodesFrom(get: CookieGetter): string[] {
  return unsign<{ codes: string[] }>(get(ACCESS_COOKIE))?.codes ?? [];
}

export type StaffRow = { id: number; name: string; username: string; role: "OWNER" | "MANAGER" | "STAFF" };

export async function staffFrom(get: CookieGetter): Promise<StaffRow | null> {
  const sid = unsign<{ sid: number }>(get(STAFF_COOKIE))?.sid;
  if (!sid) return null;
  const rows = await q<StaffRow>("SELECT id, name, username, role FROM staff_users WHERE id = $1", [sid]);
  return rows[0] ?? null;
}

export async function requireStaff(ctx: Ctx, roles: StaffRow["role"][]): Promise<StaffRow> {
  const s = await staffFrom((n) => ctx.req.cookies.get(n)?.value);
  if (!s) throw new AppError("UNAUTHORIZED");
  if (!roles.includes(s.role)) throw new AppError("FORBIDDEN_ROLE");
  return s;
}

export const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };
