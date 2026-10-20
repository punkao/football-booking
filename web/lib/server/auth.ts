import { NextResponse } from "next/server";
import { checkPassword, checkPhone, normalizePhone } from "@/lib/rules";
import { msg } from "@/lib/i18n";
import { AppError, CUSTOMER_COOKIE, SESSION_MAX_AGE, STAFF_COOKIE, cookieOpts, fail, newSession, str } from "./core";
import type { Ctx } from "./core";
import { hashPassword, verifyPassword } from "./crypto";
import { q } from "./db";
import { loadCustomerByPhone } from "./data";

/** FR-13: register = set a password for a phone number (existing customer data is kept, BR-26) */
export async function register(ctx: Ctx, b: Record<string, unknown>) {
  const name = str(b.name);
  const phone = normalizePhone(b.phone);
  if (!name) throw new AppError("NAME_REQUIRED");
  fail(checkPhone(phone));
  fail(checkPassword(b.password));
  if (b.consent !== true) throw new AppError("CONSENT_REQUIRED");
  const existing = await loadCustomerByPhone(null, phone);
  if (existing?.passwordHash) throw new AppError("ALREADY_REGISTERED");
  const hash = hashPassword(String(b.password));
  const rows = await q<{ id: number }>(
    `INSERT INTO customers(name, phone, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`,
    [name, phone, hash],
  );
  const res = NextResponse.json({ ok: true, customerId: rows[0].id, message: msg(ctx.lang, "OK_REGISTERED") }, { status: 201 });
  res.cookies.set(CUSTOMER_COOKIE, newSession(CUSTOMER_COOKIE, rows[0].id), { ...cookieOpts, maxAge: SESSION_MAX_AGE[CUSTOMER_COOKIE] });
  return res;
}

export async function customerLogin(_ctx: Ctx, b: Record<string, unknown>) {
  const phone = normalizePhone(b.phone);
  const c = phone ? await loadCustomerByPhone(null, phone) : null;
  if (!c || !verifyPassword(String(b.password ?? ""), c.passwordHash)) throw new AppError("LOGIN_FAILED");
  const res = NextResponse.json({ ok: true, customer: { id: c.id, name: c.name, phone: c.phone } });
  res.cookies.set(CUSTOMER_COOKIE, newSession(CUSTOMER_COOKIE, c.id), { ...cookieOpts, maxAge: SESSION_MAX_AGE[CUSTOMER_COOKIE] });
  return res;
}

/** FR-31 */
export async function staffLogin(_ctx: Ctx, b: Record<string, unknown>) {
  const username = str(b.username);
  const rows = await q<{ id: number; name: string; role: string; password_hash: string }>(
    "SELECT id, name, role, password_hash FROM staff_users WHERE username = $1",
    [username],
  );
  const s = rows[0];
  if (!s || !verifyPassword(String(b.password ?? ""), s.password_hash)) throw new AppError("STAFF_LOGIN_FAILED");
  const home = s.role === "OWNER" ? "/owner" : s.role === "MANAGER" ? "/staff/today" : "/staff";
  const res = NextResponse.json({ ok: true, staff: { id: s.id, name: s.name, role: s.role }, next: home });
  res.cookies.set(STAFF_COOKIE, newSession(STAFF_COOKIE, s.id), { ...cookieOpts, maxAge: SESSION_MAX_AGE[STAFF_COOKIE] });
  return res;
}
