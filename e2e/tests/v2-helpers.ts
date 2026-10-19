import { spawnSync } from 'node:child_process';
import { expect, type Locator, type Page } from '@playwright/test';
import { open, waitReady } from './fixtures';
import { SEED } from './constants';

/**
 * ตัวช่วยของ test รอบ 2 (โมดูลใหม่ STOCK SALE DASH REPORT TRACK DATA ROLE + TC 🆕v2 ในโมดูลเดิม)
 * เฉลยทุกค่ามาจาก docs/TEST-CASES.md (+ 04-REQUIREMENTS / TEST-DATA [D] และคำตอบร้าน A-41–A-50) เท่านั้น
 */

export type Meta = { tc: string; level: 'P1' | 'P2' | 'P3'; source: string; expected: string };

/** annotation มาตรฐาน: expected (ให้ reporter เดิมอ่าน) + เฉลย / ที่มา / ระดับ */
export function ann(m: Meta) {
  return [
    { type: 'expected', description: m.expected },
    { type: 'เฉลย', description: m.expected },
    { type: 'ที่มา', description: m.source },
    { type: 'ระดับ', description: m.level },
  ];
}

// ---------------------------------------------------------------- SQL (อ่านอย่างเดียว · ป้าย [E sql:<ชื่อ>])
/** รัน SELECT บน football-db ผ่าน docker exec (ห้ามคำสั่งเขียน) */
export function sql(q: string): string {
  if (!/^\s*(select|with)\b/i.test(q) || /;\s*\S/.test(q)) throw new Error(`ใช้ได้เฉพาะ SELECT คำสั่งเดียว: ${q}`);
  const r = spawnSync('docker', ['exec', 'football-db', 'psql', '-U', 'football', '-d', 'football', '-At', '-c', q], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql ล้ม: ${r.stderr || r.error?.message}`);
  return (r.stdout ?? '').trim();
}
export function sqlNum(q: string): number {
  return Number(sql(q).split('\n')[0] || '0');
}
/** [E sql:count_slot] จำนวนการจองที่เริ่มตรงช่องนี้ (ทุกสถานะ) */
export function countSlot(field: string, date: string, hour: number) {
  return sqlNum(`select count(*) from bookings where field_id='${field}' and date='${date}' and start_hour=${hour}`);
}
/** การจองที่ยังกันสนาม (ไม่ยกเลิก/หมดอายุ) ที่ทับชั่วโมง [from, to) — ใช้ตรวจว่าช่องที่ test จะใช้ยังว่าง */
export function activeOverlap(field: string, date: string, from: number, to: number) {
  return sqlNum(`select count(*) from bookings where field_id='${field}' and date='${date}' and status in ('PENDING_PAYMENT','CONFIRMED','CHECKED_IN','NO_SHOW') and start_hour < ${to} and start_hour + hours > ${from}`);
}
export function expectFree(field: string, date: string, from: number, to: number) {
  expect(activeOverlap(field, date, from, to), `ช่อง ${field} ${date} ${from}:00–${to}:00 ต้องว่างก่อนเริ่ม (ข้อมูลชนกับ test อื่น)`).toBe(0);
}
/** [E sql:money_by_day] (แผนหัวข้อ 7.3) */
export function moneyByDay(day: string) {
  return sqlNum(`select coalesce(sum(a),0) from (select amount a from payments where method<>'CREDIT' and (paid_at at time zone 'Asia/Bangkok')::date='${day}' union all select total_amount from counter_sales where (created_at at time zone 'Asia/Bangkok')::date='${day}') x`);
}

// ---------------------------------------------------------------- อ่านตัวเลขบนจอ
/** ตัวเลขจาก data-value (ถ้ามี) ไม่งั้นจากข้อความ (ตัด ฿ , % และช่องว่าง) */
export async function num(loc: Locator): Promise<number> {
  await expect(loc).toBeAttached();
  const v = await loc.getAttribute('data-value');
  const s = v ?? (await loc.innerText());
  const m = s.replace(/[,\s฿%]/g, '').match(/[-+]?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}
/** ตรวจตัวเลขแบบ soft (หลายค่าบนจอเดียวกัน) */
export async function softNum(loc: Locator, want: number, label: string) {
  let got = NaN;
  try { got = await num(loc); } catch { got = NaN; }
  expect.soft(got, `${label} ต้องเป็น ${want}`).toBe(want);
}

// ---------------------------------------------------------------- เข้าสู่ระบบ
export async function staffLoginUi(page: Page, role: 'owner' | 'manager' | 'staff') {
  await open(page, '/staff/login');
  if (await page.getByTestId('staff-logout').count()) {
    await page.getByTestId('staff-logout').click();
    await expect(page.getByTestId('staff-username')).toBeVisible();
  }
  await page.getByTestId('staff-username').fill(SEED[role].username);
  await page.getByTestId('staff-password').fill(SEED[role].password);
  await page.getByTestId('staff-login-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/staff/login'));
  await waitReady(page);
}

/** สมาชิกเข้าสู่ระบบผ่านหน้า /my */
export async function memberLoginUi(page: Page, phone: string, password: string) {
  await open(page, '/my');
  if (await page.getByTestId('logout').count()) {
    await page.getByTestId('logout').click();
    await expect(page.getByTestId('login-phone')).toBeVisible();
  }
  await page.getByTestId('login-phone').fill(phone);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('my-name')).toBeVisible();
  await waitReady(page);
}

/** ข้อความ success/error ที่ปรากฏ (รออันใดอันหนึ่ง) */
export async function outcome(page: Page): Promise<{ kind: 'success' | 'error'; text: string }> {
  const ok = page.getByTestId('success-message');
  const err = page.getByTestId('error-message');
  await expect(ok.or(err).first()).toBeVisible();
  if (await err.isVisible()) return { kind: 'error', text: (await err.innerText()).trim() };
  return { kind: 'success', text: (await ok.innerText()).trim() };
}

export const T = (local: string) => `${local}+07:00`;
