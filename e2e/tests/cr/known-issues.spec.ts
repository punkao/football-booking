import type { APIRequestContext } from '@playwright/test';
import { test, expect, open, uniquePhone, payBooking, getJson, postJson, registerCustomer, loginCustomer, staffLoginPage } from '../fixtures';
import { BASE_URL, TODAY } from '../constants';

/**
 * ล็อก known issue (บท 05 ข้อ 15 · บท 06 LAB 5): บั๊กเว็บที่ยังไม่แก้ 1 ข้อต่อ 1 TC ใน e2e/triage.json (class "เว็บผิด")
 *
 * - แต่ละข้อ assert พฤติกรรมที่ "ถูกตามร้าน" ([D] คำตอบร้าน / [R] หลักสากล) จึงล้มวันนี้ → ห่อด้วย test.fail() = ชุดเขียว
 * - วันที่ CR แก้บั๊กนั้นสำเร็จ ข้อนั้นจะ "ผ่านโดยไม่คาด" (Playwright นับเป็นล้ม) → CR ต้องถอด test.fail() ข้อนั้นเอง
 *   (ย้ายเป็น test ปกติ หรือลบเพราะมีเทสต์ CR ครอบแล้ว) — ล็อกคู่กับ TC เดิมที่ล้มอยู่ใน e2e/tests/*.ts
 * - เป็น "ตัวทำซ้ำขั้นต่ำ" ของ TC เดิม (ไม่ลอกทุกขั้น) · แท็ก @known-issue @CR-0N ตาม CHANGE-REQUESTS/REGISTER.md
 * - ไม่ reset / ไม่เลื่อนเวลา (ไฟล์นี้รันพร้อม 3 เบราว์เซอร์และ spec อื่น) · ใช้ข้อมูล seed แบบอ่านอย่างเดียว หรือข้อมูลใหม่ที่ไม่ชน
 * - นับผล: บรรทัดสรุปของ Playwright รวม expected-fail ไว้ใน "passed" → นับด้วย --grep @known-issue (10 ข้อต่อเบราว์เซอร์ · หลัง CR-01 เหลือ 9: KI TC-ROLE-03 เป็น test ปกติแท็ก @fixed · หลัง CR-02 เหลือ 4: KI TC-BOOK-11 / TC-STAFF-06 / TC-REPORT-01 / TC-TRACK-01 / TC-DATA-01 เป็น test ปกติแท็ก @fixed · หลัง CR-03 KI TC-REPORT-04 · หลัง CR-04 KI TC-CHAT-14/15/16 เป็น test ปกติแท็ก @fixed)
 */

const SYS = 'เกิดข้อผิดพลาดในระบบ';

function ki(tc: string, cr: string, source: string, expected: string) {
  return {
    tag: ['@known-issue', `@${cr}`],
    annotation: [
      { type: 'known-issue', description: `${tc} · ${cr} · ที่มาของบั๊ก: e2e/triage.json (เว็บผิด) · legacy/SYSTEM-MAP.md ส่วน L` },
      { type: 'ที่มา', description: source },
      { type: 'expected', description: expected },
    ],
  };
}

/** context ใหม่ที่ใช้ cookie ชุดเดิม (หลังออกจากระบบ) */
async function withOldCookies(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }, from: APIRequestContext) {
  const state = await from.storageState();
  return playwright.request.newContext({ baseURL: BASE_URL, storageState: state });
}

/** ห้องแชทใหม่ (cookie แยก) + IP ของตัวเอง (กันชนเพดานต่อ IP) */
async function chatRoom(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }, b: number) {
  const ip = `10.${200 + b}.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
  const send = async (text: string) => {
    const r = await postJson(ctx, '/api/chat', { text });
    expect(r.status, `POST /api/chat "${text}" → ${JSON.stringify(r.body)}`).toBe(200);
    return String(r.body.reply ?? '');
  };
  return { ctx, send };
}

test.describe('known issues (ล็อกคู่ · test.fail)', () => {
  // CR-01 แก้แล้ว (docs/impact/CR-01.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก (ไม่นับเป็น expected-fail อีก)
  test('KI TC-ROLE-03 ออกจากระบบแล้ว cookie เดิมต้องใช้ไม่ได้', {
    ...ki(
      'TC-ROLE-03', 'CR-01',
      '[R] OWASP Session Management · NFR-05 · CHANGE-REQUESTS/CR-01.md',
      'สมาชิก logout แล้ว cookie เดิม GET /api/me → 401 · staff logout แล้ว cookie เดิม GET /api/staff/bookings/LN-900004 → 401',
    ),
    tag: ['@CR-01', '@fixed'],
  }, async ({ anonApi, staffApi, playwright, b }) => {
    await test.step('สมาชิกใหม่เข้าสู่ระบบ เก็บ cookie แล้วออกจากระบบ → cookie เดิมต้องได้ 401', async () => {
      const api = await anonApi();
      const phone = uniquePhone(b);
      await registerCustomer(api, { name: 'ล็อก ROLE-03', phone, password: 'Lock12345' });
      await loginCustomer(api, phone, 'Lock12345');
      const old = await withOldCookies(playwright, api);
      await postJson(api, '/api/customers/logout', {});
      expect.soft((await getJson(old, '/api/me')).status, 'cookie สมาชิกหลัง logout').toBe(401);
      await old.dispose();
    });
    await test.step('staff เข้าสู่ระบบ เก็บ cookie แล้วออกจากระบบ → cookie เดิมต้องได้ 401', async () => {
      const s = await staffApi('staff');
      const old = await withOldCookies(playwright, s);
      await postJson(s, '/api/staff/logout', {});
      expect.soft((await getJson(old, '/api/staff/bookings/LN-900004')).status, 'cookie ร้านหลัง logout').toBe(401);
      await old.dispose();
    });
  });

  // CR-02 แก้แล้ว (docs/impact/CR-02.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-BOOK-11 ค้นการจองโดยไม่กรอก → ข้อความบอกให้กรอก (ไม่ใช่ error ระบบ)', {
    ...ki(
      'TC-BOOK-11', 'CR-02',
      '[R] ข้อความ error ต้องบอกสิ่งที่ผู้ใช้ต้องแก้ · FR-09 · CHANGE-REQUESTS/CR-02.md ข้อ 5',
      '/my กด lookup-submit ทันที → ข้อความพูดถึงรหัส/เบอร์ที่ต้องกรอก และไม่ใช่ "เกิดข้อผิดพลาดในระบบ"',
    ),
    tag: ['@CR-02', '@fixed'],
  }, async ({ page }) => {
    await test.step('เปิด /my กดค้นทั้งที่ช่องว่าง', async () => {
      await open(page, '/my');
      await page.getByTestId('lookup-submit').click();
    });
    await test.step('ข้อความต้องบอกให้กรอก ไม่ใช่ error ระบบ', async () => {
      const msg = page.getByTestId('error-message').or(page.locator('[data-testid^="field-error"]')).first();
      await expect(msg).toBeVisible();
      const t = (await msg.innerText()).trim();
      expect.soft(t).not.toContain(SYS);
      expect.soft(t).toMatch(/รหัส|เบอร์|กรอก|โทร/);
    });
  });

  // CR-02 แก้แล้ว (docs/impact/CR-02.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-STAFF-06 เช็กอินการจองที่ยังไม่ถึงวันเตะ → ต้องถูกปฏิเสธ', {
    ...ki(
      'TC-STAFF-06', 'CR-02',
      '[D A-45] เช็กอินได้เฉพาะวันเตะ · CHANGE-REQUESTS/CR-02.md ข้อ 1',
      'วันนี้ 9 ต.ค. · การจองวันที่ 21 ต.ค. ที่จ่ายแล้ว → staff POST checkin ได้ 4xx และสถานะยัง CONFIRMED',
    ),
    tag: ['@CR-02', '@fixed'],
  }, async ({ anonApi, staffApi, b }) => {
    const date = '2026-10-21';
    let code = '';
    await test.step(`จองสนาม C วันที่ ${date} ช่องที่ยังว่าง (12:00–20:00 เท่านั้น) แล้วจ่าย (ลูกค้าใหม่)`, async () => {
      // 12–20 เท่านั้น: ไม่แตะ 09:00 / 23:00 ที่ TC-API-03 (api.spec.ts) ใช้ quote บน C 21 ต.ค. (เดิมสุ่มทุกชั่วโมง → SLOT_TAKEN เป็นบางครั้งบน firefox/webkit)
      // ลองใหม่เมื่อชนกับ cr-02.spec (สุ่มช่วง 12–20 เหมือนกัน) หรือเบราว์เซอร์อื่น
      const api = await anonApi();
      for (let attempt = 0; attempt < 8 && !code; attempt++) {
        const av = await getJson(api, `/api/availability?date=${date}`);
        const free: number[] = (av.body?.slots ?? []).filter((s: { fieldId: string; status: string; hour: number }) => s.fieldId === 'C' && s.status === 'free' && s.hour >= 12 && s.hour <= 20).map((s: { hour: number }) => s.hour);
        expect(free.length, 'สนาม C 21 ต.ค. 12:00–20:00 ต้องมีช่องว่าง').toBeGreaterThan(0);
        const start = free[(b * 3 + Math.floor(Math.random() * free.length)) % free.length];
        const r = await postJson(api, '/api/bookings', { fieldId: 'C', date, startHour: start, hours: 1, name: 'ล็อก STAFF-06', phone: uniquePhone(b), consent: true });
        if (r.status === 201) code = r.body.booking.code;
        else expect(r.status, `จอง C ${date} ${start}:00 → ${JSON.stringify(r.body)}`).toBe(409);
      }
      expect(code, 'ต้องจองช่องว่างได้').not.toBe('');
      await payBooking(api, code);
    });
    await test.step('staff กดเช็กอินวันนี้ (ยังไม่ถึงวันเตะ) → ต้องถูกปฏิเสธ', async () => {
      const s = await staffApi('staff');
      const r = await postJson(s, `/api/staff/bookings/${code}/checkin`, {});
      expect.soft(r.status, `เช็กอินก่อนวันเตะ: ${JSON.stringify(r.body)}`).toBeGreaterThanOrEqual(400);
      const v = await getJson(s, `/api/staff/bookings/${code}`);
      expect.soft(v.body?.booking?.status, 'สถานะหลังกดเช็กอินก่อนวันเตะ').toBe('CONFIRMED');
    });
  });

  // CR-04 แก้แล้ว (docs/impact/CR-04.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-CHAT-14 "ช่วงไหนถูกสุด" → "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ" ต้องตอบ 1,600', {
    ...ki(
      'TC-CHAT-14', 'CR-04',
      '[D] US-39 · FR-35 · CHANGE-REQUESTS/CR-04.md',
      'ห้องเดียวกัน: คำตอบ 1 มี 800 · คำตอบ 2 มี 1,600 · ไม่มี "ไม่มีข้อมูล"',
    ),
    tag: ['@CR-04', '@fixed'],
  }, async ({ playwright, b }) => {
    const room = await chatRoom(playwright, b);
    const a1 = await room.send('ช่วงไหนถูกสุด');
    const a2 = await room.send('ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ');
    await test.step('ตรวจคำตอบ 2 ข้อความ', async () => {
      expect.soft(a1, 'คำตอบ 1').toMatch(/(?<![\d,])800(?!\d)/);
      expect.soft(a2, 'คำตอบ 2').toContain('1,600');
      expect.soft(`${a1} | ${a2}`).not.toContain('ไม่มีข้อมูล');
    });
    await room.ctx.dispose();
  });

  // CR-04 แก้แล้ว (docs/impact/CR-04.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-CHAT-15 "วันนี้ 19:00 สนาม A ว่างไหม" → "งั้นสนาม B ล่ะ" ต้องตอบเรื่องสนาม B', {
    ...ki(
      'TC-CHAT-15', 'CR-04',
      '[D] FR-35 "จำบทสนทนาในห้องเดียวกัน" · US-39 · CHANGE-REQUESTS/CR-04.md',
      'คำตอบ 2 พูดถึง "สนาม B" (ใช้วัน/เวลาจากข้อความแรก) และไม่มี "ไม่มีข้อมูล"',
    ),
    tag: ['@CR-04', '@fixed'],
  }, async ({ playwright, b }) => {
    const room = await chatRoom(playwright, b);
    await room.send(`วันนี้ 19:00 สนาม A ว่างไหม`);
    const a2 = await room.send('งั้นสนาม B ล่ะ');
    await test.step(`ตรวจคำตอบ 2 (วันนี้ = ${TODAY})`, async () => {
      expect.soft(a2).toContain('สนาม B');
      expect.soft(a2).not.toContain('ไม่มีข้อมูล');
    });
    await room.ctx.dispose();
  });

  // CR-04 แก้แล้ว (docs/impact/CR-04.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-CHAT-16 "Is pitch C covered?" → "How much is it on Saturday night?" ต้องตอบราคาสนาม C', {
    ...ki(
      'TC-CHAT-16', 'CR-04',
      '[D] US-39 เกณฑ์ข้อ 2 · FR-35 · BR-07/08 · CHANGE-REQUESTS/CR-04.md',
      'คำตอบ 2 มี 1,800 และไม่ตอบราคาสนาม A ("Field A") เพราะ "it" = สนาม C',
    ),
    tag: ['@CR-04', '@fixed'],
  }, async ({ playwright, b }) => {
    const room = await chatRoom(playwright, b);
    await room.send('Is pitch C covered?');
    const a2 = await room.send('How much is it on Saturday night?');
    await test.step('ตรวจคำตอบ 2', async () => {
      expect.soft(a2).toContain('1,800');
      expect.soft(a2).not.toMatch(/field\s+A\b/i);
    });
    await room.ctx.dispose();
  });

  // CR-02 แก้แล้ว (docs/impact/CR-02.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-REPORT-01 รายงาน 30 พ.ย. 2569 → 28 ก.พ. 2570 ต้องดูได้', {
    ...ki(
      'TC-REPORT-01', 'CR-02',
      '[D A-46] 30 พ.ย. → 28 ก.พ. ดูได้ · BR-39 · CHANGE-REQUESTS/CR-02.md ข้อ 4',
      'owner GET /api/owner/reports?from=2026-11-30&to=2027-02-28 → 200 และ 91 วัน',
    ),
    tag: ['@CR-02', '@fixed'],
  }, async ({ staffApi }) => {
    const o = await staffApi('owner');
    const r = await getJson(o, '/api/owner/reports?from=2026-11-30&to=2027-02-28');
    expect.soft(r.status, JSON.stringify(r.body?.error ?? {})).toBe(200);
    expect.soft((r.body?.days ?? []).length, 'จำนวนวันในรายงาน').toBe(91);
  });

  // CR-03 แก้แล้ว (docs/impact/CR-03.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-REPORT-04 รายงาน CSV ต้องแยก "เก็บหน้าสนาม" และมีชั่วโมงต่อสนาม', {
    ...ki(
      'TC-REPORT-04', 'CR-03',
      '[D A-41] มัดจำพร้อมเพย์ / เก็บหน้าสนาม 2 คอลัมน์ · [D A-42] ชั่วโมงต่อสนาม · CHANGE-REQUESTS/CR-03.md',
      'owner GET /api/owner/reports.csv 3–9 ต.ค. → หัวคอลัมน์มี "หน้าสนาม" และชั่วโมงของสนาม A/B/C',
    ),
    tag: ['@CR-03', '@fixed'],
  }, async ({ staffApi }) => {
    const o = await staffApi('owner');
    const r = await o.get('/api/owner/reports.csv?from=2026-10-03&to=2026-10-09');
    expect(r.status()).toBe(200);
    const head = (await r.text()).replace(/^﻿/, '').split(/\r?\n/)[0] ?? '';
    expect.soft(head, 'หัว CSV มีคอลัมน์เก็บหน้าสนาม').toMatch(/หน้าสนาม/);
    for (const f of ['A', 'B', 'C']) expect.soft(head, `หัว CSV มีชั่วโมงสนาม ${f}`).toMatch(new RegExp(`(ชั่วโมง|ชม).*สนาม\\s*${f}|สนาม\\s*${f}.*(ชั่วโมง|ชม)`));
  });

  // CR-02 แก้แล้ว (docs/impact/CR-02.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-TRACK-01 การจองที่เช็กอินแล้วและเล่นจบแล้ว → ขั้นสุดท้ายคือ "จบ"', {
    ...ki(
      'TC-TRACK-01', 'CR-02',
      '[D A-43] ขั้น "จบ" หลังเวลาเล่นจบเป็นขั้นสุดท้าย · US-49 · CHANGE-REQUESTS/CR-02.md ข้อ 3 · seed LN-900005 (CHECKED_IN 3 ต.ค. 18:00–20:00)',
      '/booking/LN-900005 (วันนี้ 9 ต.ค. เล่นจบไปแล้ว) → ขั้นสุดท้ายของ timeline มีคำว่า "จบ"',
    ),
    tag: ['@CR-02', '@fixed'],
  }, async ({ page }) => {
    await test.step('ปลดล็อกการจองด้วยรหัส + เบอร์ (seed ทีมเก่า) แล้วเปิดหน้า', async () => {
      const r = await page.request.get('/api/bookings/LN-900005?phone=0877777777');
      expect(r.status()).toBe(200);
      await open(page, '/booking/LN-900005');
    });
    await test.step('ขั้นสุดท้ายคือ "จบ"', async () => {
      const steps = await page.locator('[data-testid^="timeline-step-"]').allInnerTexts();
      expect(steps.length, 'มี timeline').toBeGreaterThan(0);
      expect.soft(steps[steps.length - 1] ?? '', `ขั้นทั้งหมด: ${steps.join(' → ')}`).toMatch(/จบ/);
    });
  });

  // CR-02 แก้แล้ว (docs/impact/CR-02.md) → ถอด test.fail: เป็น test ปกติที่ต้องผ่าน · แท็ก @known-issue ออก
  test('KI TC-DATA-01 ประวัติการจองต้องแสดงชื่อพนักงาน ไม่ใช่ username', {
    ...ki(
      'TC-DATA-01', 'CR-02',
      '[D A-44] ประวัติแสดงชื่อพนักงาน · BR-42 · CHANGE-REQUESTS/CR-02.md ข้อ 2 · seed LN-900008 แถวที่ 3 ทำโดย staff (ชื่อ น้องบอล)',
      'owner เปิด /owner/bookings/LN-900008 → history-actor-2 = "น้องบอล"',
    ),
    tag: ['@CR-02', '@fixed'],
  }, async ({ page }) => {
    await staffLoginPage(page, 'owner');
    await open(page, '/owner/bookings/LN-900008');
    await expect(page.getByTestId('history-table')).toHaveAttribute('data-count', '3');
    await expect.soft(page.getByTestId('history-actor-2')).toHaveText('น้องบอล');
  });
});
