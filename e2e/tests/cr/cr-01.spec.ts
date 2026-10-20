import { createHash } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { test, expect, open, uniquePhone, getJson, postJson, registerCustomer, loginCustomer } from '../fixtures';
import { BASE_URL } from '../constants';
import { ann, sql, memberLoginUi, staffLoginUi } from '../v2-helpers';

/**
 * CR-01 ออกจากระบบแล้วยังเข้าใช้ต่อได้ (CHANGE-REQUESTS/CR-01.md · impact docs/impact/CR-01.md)
 *
 * ค่าที่คาดหวังมาจากคำตอบร้าน CHANGE-REQUESTS/answers/README.md หัวข้อ CR-01 = [D:CR-01]
 * - ยกเลิกเฉพาะ session ที่กดออกจากระบบ · เครื่องอื่นที่ยังเข้าสู่ระบบอยู่ใช้ต่อได้
 * - หลังออกจากระบบ cookie เดิมเรียกหน้าหรือ API ที่ต้องเข้าสู่ระบบ → เหมือนไม่ได้เข้าสู่ระบบ (API 401 · หน้าเว็บพาไปหน้าเข้าสู่ระบบ)
 * - ไม่ต้องทำ "ออกจากทุกเครื่อง" · ไม่เปลี่ยนเวลาหมดอายุ session เดิม
 * ("คนที่เข้าสู่ระบบอยู่ตอนอัปเดตไม่ต้องเข้าใหม่" พิสูจน์ด้วย unit web/lib/server/session.test.ts + ซ้อมอัปเดตจริงใน impact ข้อ 5
 *  เพราะ e2e สร้าง cookie แบบเดิมเองไม่ได้ถ้าไม่รู้ SESSION_SECRET)
 *
 * ไม่ reset / ไม่เลื่อนเวลา (รันพร้อม 3 เบราว์เซอร์) · สมาชิกใหม่ใช้ uniquePhone(b) · บัญชีร้านใช้ seed แบบเข้าสู่ระบบแยกต่อ context
 */

const ANSWER = 'CHANGE-REQUESTS/answers/README.md หัวข้อ CR-01';
type PW = { request: { newContext: (o: object) => Promise<APIRequestContext> } };

/** อีกเครื่องที่ถือ cookie ชุดเดียวกับ ctx ตอนนี้ (เหมือนคนที่แอบเก็บ cookie ไว้) */
async function copyOf(playwright: PW, ctx: APIRequestContext) {
  return playwright.request.newContext({ baseURL: BASE_URL, storageState: await ctx.storageState() });
}

async function cookieValue(ctx: APIRequestContext, name: string): Promise<string> {
  const c = (await ctx.storageState()).cookies.find((x) => x.name === name);
  expect(c, `ต้องมี cookie ${name}`).toBeTruthy();
  return c!.value;
}

test.describe('CR-01 ออกจากระบบแล้วต้องใช้ต่อไม่ได้จริง', () => {
  test('CR-01-01 สมาชิกกดออกจากระบบแล้ว cookie เดิมดูข้อมูลสมาชิกไม่ได้ (API 401 · หน้า /my ให้เข้าสู่ระบบ)', {
    tag: ['@CR-01', '@P1'],
    annotation: ann({
      tc: 'CR-01-01', level: 'P1', source: `[D:CR-01] ${ANSWER} ข้อ 2 · CHANGE-REQUESTS/CR-01.md ("ดูข้อมูลสมาชิก เครดิต ชั่วโมงสะสมได้") · TC-ROLE-03`,
      expected: 'หลังกด logout บน /my: cookie เดิม GET /api/me → 401 UNAUTHORIZED · เปิด /my ด้วย cookie เดิม → เห็นฟอร์มเข้าสู่ระบบ (login-phone) ไม่เห็น my-name',
    }),
  }, async ({ page, playwright, anonApi, newUserPage, b }) => {
    const phone = uniquePhone(b);
    const password = 'Cr01Member1';
    await test.step('สมัครสมาชิกใหม่ แล้วเข้าสู่ระบบผ่านหน้า /my', async () => {
      await registerCustomer(await anonApi(), { name: 'สมาชิก CR-01', phone, password });
      await memberLoginUi(page, phone, password);
    });
    const kept = await page.context().cookies();
    await test.step('กด "ออกจากระบบ" บนหน้า /my', async () => {
      const resp = page.waitForResponse((r) => r.url().includes('/api/customers/logout'));
      await page.getByTestId('logout').click();
      expect((await resp).status()).toBe(200);
      await expect(page.getByTestId('login-phone')).toBeVisible();
    });
    await test.step('คนที่เก็บ cookie เดิมไว้ ขอข้อมูลสมาชิก เครดิต ชั่วโมงสะสม (/api/me) → 401', async () => {
      const old = await playwright.request.newContext({ baseURL: BASE_URL, storageState: { cookies: kept, origins: [] } });
      const r = await getJson(old, '/api/me');
      expect(r.status, `cookie สมาชิกเดิมหลังออกจากระบบ GET /api/me → ${JSON.stringify(r.body)}`).toBe(401);
      expect(r.body?.error?.code).toBe('UNAUTHORIZED');
      await old.dispose();
    });
    await test.step('เปิดหน้า /my ด้วย cookie เดิม → เห็นฟอร์มเข้าสู่ระบบ ไม่เห็นชื่อสมาชิก', async () => {
      const p2 = await newUserPage();
      await p2.context().addCookies(kept);
      await open(p2, '/my');
      await expect(p2.getByTestId('login-phone')).toBeVisible();
      await expect(p2.getByTestId('my-name')).toHaveCount(0);
    });
  });

  test('CR-01-02 พนักงานกดออกจากระบบแล้ว cookie เดิมเปิดหลังบ้านและข้อมูลการจองไม่ได้ (API 401 · หน้าเว็บไปหน้าเข้าสู่ระบบ)', {
    tag: ['@CR-01', '@P1'],
    annotation: ann({
      tc: 'CR-01-02', level: 'P1', source: `[D:CR-01] ${ANSWER} ข้อ 2 · CHANGE-REQUESTS/CR-01.md ("ยังเปิดหน้าร้านและข้อมูลการจองได้อยู่") · TC-ROLE-03`,
      expected: 'staff กด staff-logout แล้ว cookie เดิม: GET /api/staff/bookings/LN-900004 · /api/staff/me · /api/staff/stock → 401 · เปิด /staff → /staff/login?next=%2Fstaff + login-required · owner ออกแล้ว cookie เดิม GET /api/owner/dashboard → 401',
    }),
  }, async ({ page, playwright, staffApi, newUserPage }) => {
    await test.step('พนักงาน (staff) เข้าสู่ระบบผ่านหน้าเว็บ แล้วกด "ออกจากระบบ"', async () => {
      await staffLoginUi(page, 'staff');
    });
    const kept = await page.context().cookies();
    await test.step('กด staff-logout บนหน้า /staff', async () => {
      await open(page, '/staff');
      const resp = page.waitForResponse((r) => r.url().includes('/api/staff/logout'));
      await page.getByTestId('staff-logout').click();
      expect((await resp).status()).toBe(200);
    });
    await test.step('cookie เดิมเรียก API หลังบ้าน (ข้อมูลการจอง · ผู้ใช้ปัจจุบัน · คลัง) → 401 ทุกเส้น', async () => {
      const old = await playwright.request.newContext({ baseURL: BASE_URL, storageState: { cookies: kept, origins: [] } });
      for (const url of ['/api/staff/bookings/LN-900004', '/api/staff/me', '/api/staff/stock']) {
        const r = await getJson(old, url);
        expect.soft(r.status, `cookie ร้านเดิมหลังออกจากระบบ GET ${url} → ${JSON.stringify(r.body)}`).toBe(401);
      }
      await old.dispose();
    });
    await test.step('เปิดหน้า /staff ด้วย cookie เดิม → ไปหน้าเข้าสู่ระบบร้าน', async () => {
      const p2 = await newUserPage();
      await p2.context().addCookies(kept);
      await open(p2, '/staff');
      expect(new URL(p2.url()).pathname).toBe('/staff/login');
      await expect(p2.getByTestId('login-required')).toBeVisible();
      await expect(p2.getByTestId('staff-logout')).toHaveCount(0);
    });
    await test.step('เจ้าของร้าน (owner) ออกจากระบบแล้ว cookie เดิมเปิดแดชบอร์ดไม่ได้ → 401', async () => {
      const owner = await staffApi('owner');
      const old = await copyOf(playwright, owner);
      expect((await getJson(old, '/api/owner/dashboard')).status, 'ก่อนออก owner เปิดแดชบอร์ดได้').toBe(200);
      expect((await postJson(owner, '/api/staff/logout', {})).status).toBe(200);
      const r = await getJson(old, '/api/owner/dashboard');
      expect(r.status, `cookie owner เดิมหลังออกจากระบบ → ${JSON.stringify(r.body)}`).toBe(401);
      await old.dispose();
    });
  });

  test('CR-01-03 ออกจากระบบเฉพาะเครื่องที่กด เครื่องอื่นของบัญชีเดียวกันใช้ต่อได้ และเข้าสู่ระบบใหม่ได้', {
    tag: ['@CR-01', '@P1'],
    annotation: ann({
      tc: 'CR-01-03', level: 'P1', source: `[D:CR-01] ${ANSWER} ข้อ 1 + ข้อ 3 (ไม่ทำ "ออกจากทุกเครื่อง") · CHANGE-REQUESTS/CR-01.md ("คนที่ไม่ได้กดออกจากระบบ ใช้งานต่อได้ตามปกติ")`,
      expected: 'สมาชิก: เครื่อง A ออก → cookie A เดิม 401 · เครื่อง B 200 · A เข้าสู่ระบบใหม่ → 200 · ร้าน: staff เครื่อง A ออก → cookie A เดิม 401 · เครื่อง B GET /api/staff/bookings/LN-900004 → 200',
    }),
  }, async ({ playwright, anonApi, staffApi, b }) => {
    const phone = uniquePhone(b);
    const password = 'Cr01Device1';
    const A = await anonApi();
    const B = await anonApi();
    await test.step('สมาชิกเข้าสู่ระบบ 2 เครื่อง (A = คอมเคาน์เตอร์ · B = มือถือ)', async () => {
      await registerCustomer(A, { name: 'สมาชิกสองเครื่อง', phone, password });
      await loginCustomer(B, phone, password);
      expect((await getJson(A, '/api/me')).status).toBe(200);
      expect((await getJson(B, '/api/me')).status).toBe(200);
    });
    await test.step('เครื่อง A กดออก → cookie A เดิมใช้ไม่ได้ · เครื่อง B ยังเห็นข้อมูลสมาชิก', async () => {
      const oldA = await copyOf(playwright, A);
      expect((await postJson(A, '/api/customers/logout', {})).status).toBe(200);
      expect((await getJson(oldA, '/api/me')).status, 'cookie A เดิมหลังออก').toBe(401);
      const rb = await getJson(B, '/api/me');
      expect(rb.status, 'เครื่อง B ที่ไม่ได้กดออก').toBe(200);
      expect(rb.body?.customer?.phone).toBe(phone);
      await oldA.dispose();
    });
    await test.step('เครื่อง A เข้าสู่ระบบใหม่ → ใช้ได้ (การออกครั้งก่อนไม่ล็อกบัญชี)', async () => {
      await loginCustomer(A, phone, password);
      expect((await getJson(A, '/api/me')).status).toBe(200);
      expect((await getJson(B, '/api/me')).status).toBe(200);
    });
    await test.step('ร้าน: staff เข้าสู่ระบบ 2 เครื่อง · เครื่อง A ออก → A เดิม 401 · B ยังเปิดข้อมูลการจองได้', async () => {
      const sA = await staffApi('staff');
      const sB = await staffApi('staff');
      const oldA = await copyOf(playwright, sA);
      expect((await postJson(sA, '/api/staff/logout', {})).status).toBe(200);
      expect((await getJson(oldA, '/api/staff/bookings/LN-900004')).status, 'cookie staff A เดิมหลังออก').toBe(401);
      expect((await getJson(sB, '/api/staff/bookings/LN-900004')).status, 'staff เครื่อง B ที่ไม่ได้กดออก').toBe(200);
      await oldA.dispose();
    });
  });

  test('CR-01-04 ระบบจำ cookie ที่ออกแล้วเป็น hash เท่านั้น ไม่เก็บ cookie ตัวจริงในฐานข้อมูล', {
    tag: ['@CR-01', '@P2'],
    annotation: ann({
      tc: 'CR-01-04', level: 'P2', source: '[R] OWASP Session Management (server-side invalidation · ไม่เก็บ token ดิบ) · NFR-18 · docs/impact/CR-01.md ข้อ 3.1 · [E sql:revoked_sessions]',
      expected: 'หลังออกจากระบบ มีแถว revoked_sessions ที่ token_hash = sha256(cookie) 1 แถว · ไม่มีแถวที่ token_hash ไม่ใช่ hex 64 ตัว',
    }),
  }, async ({ anonApi, b }) => {
    const phone = uniquePhone(b);
    const api = await anonApi();
    await registerCustomer(api, { name: 'สมาชิก hash', phone, password: 'Cr01Hash12' });
    const token = await cookieValue(api, 'ln_customer');
    const hash = createHash('sha256').update(token).digest('hex');
    await test.step('ออกจากระบบ', async () => {
      expect((await postJson(api, '/api/customers/logout', {})).status).toBe(200);
    });
    await test.step('[E sql:revoked_sessions] มี hash ของ cookie นี้ 1 แถว · ทุกแถวเป็น hex 64 ตัว (ไม่ใช่ cookie ดิบ)', async () => {
      expect(sql(`select count(*) from revoked_sessions where token_hash = '${hash}'`)).toBe('1');
      expect(sql(`select count(*) from revoked_sessions where token_hash !~ '^[0-9a-f]{64}$'`)).toBe('0');
    });
  });
});
