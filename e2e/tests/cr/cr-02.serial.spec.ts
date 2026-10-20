import type { Page } from '@playwright/test';
import { test, expect, open, uniquePhone, createBooking, payBooking, getJson, postJson, registerCustomer, staffLoginPage, resetData, setClock } from '../fixtures';
import { ann, sql, T } from '../v2-helpers';

/**
 * CR-02 ข้อที่ต้องเลื่อนเวลา / จองวันเตะ (CHANGE-REQUESTS/CR-02.md · impact docs/impact/CR-02.md)
 * project "serial" (Chromium ทีละข้อ หลัง 3 เบราว์เซอร์จบ) · reset ก่อนและหลังทุกข้อ
 * ค่าที่คาดหวัง: [D:CR-02] = CHANGE-REQUESTS/answers/README.md หัวข้อ CR-02 · SQL อ่านอย่างเดียวติดป้าย [E sql]
 * วันเตะที่ใช้: จ 12 ต.ค. 2569 (วันนี้ของ seed = ศ 9 ต.ค. 10:00)
 */

test.beforeEach(async ({ request }) => { await resetData(request); });
test.afterEach(async ({ request }) => { await resetData(request); });

const ANSWER = 'CHANGE-REQUESTS/answers/README.md หัวข้อ CR-02';
const NOT_PLAY_DAY = 'เช็กอินได้เฉพาะวันเตะ';

const steps = (page: Page) =>
  page.locator('[data-testid^="timeline-step-"]').evaluateAll((es) =>
    es.map((e) => ({ status: e.getAttribute('data-status') ?? '', current: e.getAttribute('aria-current') ?? '', text: (e.textContent ?? '').replace(/\s+/g, ' ').trim() })),
  );

test('CR-02-02 เช็กอินได้ทุกเวลาของวันเตะ (ก่อนเวลาเริ่ม · หลังเล่นจบวันเดียวกัน) · วันก่อนและวันถัดไปไม่ได้ · ชั่วโมงสะสมนับตอนเช็กอิน', {
  tag: ['@CR-02', '@P2'],
  annotation: ann({
    tc: 'CR-02-02', level: 'P2', source: `[D:CR-02] ${ANSWER} ข้อ 1 "เช็กอินได้ทุกเวลาของวันเตะ (นับวันตามเวลาไทย) · วันอื่น → ปฏิเสธ · ชั่วโมงสะสมยังนับตอนเช็กอิน" · [D A-45] · BR-23`,
    expected: 'สมาชิกใหม่จอง จ 12 ต.ค. A 19:00 · A 08:00 · C 10:00 (1 ชม. จ่ายแล้ว) · 11 ต.ค. 23:59:59 เช็กอิน A 19 → 409 CHECKIN_NOT_PLAY_DAY ชั่วโมงสะสม 0 · 12 ต.ค. 00:00 canCheckin true เช็กอิน A 19 → 200 สะสม 1 · 12 ต.ค. 23:59:59 (A 08 เล่นจบแล้ว) → 200 สะสม 2 · 13 ต.ค. 00:00 เช็กอิน C 10 → 409 สถานะ CONFIRMED สะสมยัง 2',
  }),
}, async ({ page, request, staffApi }) => {
  const phone = uniquePhone(3);
  const code: Record<string, string> = {};
  await test.step('สมาชิกใหม่จอง จ 12 ต.ค. 3 รอบ (A 19:00 · A 08:00 · C 10:00) แล้วจ่าย', async () => {
    await registerCustomer(page.request, { name: 'สมาชิกวันเตะ CR-02', phone });
    for (const [k, f, h] of [['A19', 'A', 19], ['A08', 'A', 8], ['C10', 'C', 10]] as const) {
      code[k] = (await createBooking(page.request, { fieldId: f, date: '2026-10-12', startHour: h, phone, name: 'สมาชิกวันเตะ CR-02' })).code;
      await payBooking(page.request, code[k]);
    }
  });
  const staff = await staffApi('staff');
  const paidHours = async () => (await getJson(page.request, '/api/me')).body?.customer?.paidHours;
  const checkin = (c: string) => postJson(staff, `/api/staff/bookings/${c}/checkin`, {});
  await test.step('11 ต.ค. 23:59:59 (คืนก่อนวันเตะ) เช็กอิน A 19:00 → ปฏิเสธ เช็กอินได้เฉพาะวันเตะ', async () => {
    await setClock(request, T('2026-10-11T23:59:59'));
    const r = await checkin(code.A19);
    expect.soft(r.status, JSON.stringify(r.body)).toBe(409);
    expect.soft(r.body?.error?.code).toBe('CHECKIN_NOT_PLAY_DAY');
    expect.soft(String(r.body?.error?.message ?? '')).toContain(NOT_PLAY_DAY);
    expect.soft(await paidHours(), 'ชั่วโมงสะสม').toBe(0);
  });
  await test.step('12 ต.ค. 00:00 (วันเตะ ยังไม่ถึงเวลาเริ่ม 19:00) → ปุ่มกดได้ เช็กอินได้ ชั่วโมงสะสม 1', async () => {
    await setClock(request, T('2026-10-12T00:00:00'));
    const v = await getJson(staff, `/api/staff/bookings/${code.A19}`);
    expect.soft(v.body?.actions?.canCheckin, JSON.stringify(v.body?.actions)).toBe(true);
    const r = await checkin(code.A19);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect.soft(r.body?.booking?.status).toBe('CHECKED_IN');
    expect.soft(await paidHours(), 'ชั่วโมงสะสม').toBe(1);
  });
  await test.step('12 ต.ค. 23:59:59 (A 08:00 เล่นจบไปแล้ว แต่ยังวันเตะ) → เช็กอินได้ ชั่วโมงสะสม 2', async () => {
    await setClock(request, T('2026-10-12T23:59:59'));
    const r = await checkin(code.A08);
    expect.soft(r.status, JSON.stringify(r.body)).toBe(200);
    expect.soft(await paidHours(), 'ชั่วโมงสะสม').toBe(2);
  });
  await test.step('13 ต.ค. 00:00 (ลืมกด มากดวันถัดไป) เช็กอิน C 10:00 → ปฏิเสธ · หน้าพนักงานบอกเหตุผล · สถานะยังยืนยันแล้ว', async () => {
    await setClock(request, T('2026-10-13T00:00:00'));
    const r = await checkin(code.C10);
    expect.soft(r.status, JSON.stringify(r.body)).toBe(409);
    expect.soft(r.body?.error?.code).toBe('CHECKIN_NOT_PLAY_DAY');
    await staffLoginPage(page, 'staff');
    await open(page, `/staff?code=${code.C10}`);
    await expect.soft(page.getByTestId('staff-checkin-hint')).toHaveAttribute('data-value', 'CHECKIN_NOT_PLAY_DAY');
    await expect.soft(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
    expect.soft(await paidHours(), 'ชั่วโมงสะสม').toBe(2);
    expect.soft(sql(`select status from bookings where code='${code.C10}'`), '[E sql] สถานะ').toBe('CONFIRMED');
  });
});

test('CR-02-08 กดหลังแก้: ประวัติแสดงชื่อพนักงานที่กด (เช็กอินโดยน้องบอล · ไม่มาโดยคุณเอก) · ฐานข้อมูลยังเก็บ username', {
  tag: ['@CR-02', '@P2'],
  annotation: ann({
    tc: 'CR-02-08', level: 'P2', source: `[D:CR-02] ${ANSWER} ข้อ 2 · [D A-44] · BR-42 · seed staff_users (staff = น้องบอล · owner = คุณเอก)`,
    expected: 'จอง จ 12 ต.ค. A 08:00 + B 10:00 จ่าย · 12 ต.ค. 07:50 staff เช็กอิน A · 10:15 owner กดไม่มา B · owner ประวัติ: แถวล่าสุด A = "น้องบอล" (data-value staff) · B = "คุณเอก" (data-value owner) · [E sql] actor = staff / owner',
  }),
}, async ({ page, request, staffApi }) => {
  const phone = uniquePhone(3);
  let a = '';
  let bk = '';
  await test.step('จอง จ 12 ต.ค. A 08:00 และ B 10:00 แล้วจ่าย', async () => {
    a = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-12', startHour: 8, phone, name: 'ทีมประวัติ CR-02' })).code;
    await payBooking(page.request, a);
    bk = (await createBooking(page.request, { fieldId: 'B', date: '2026-10-12', startHour: 10, phone, name: 'ทีมประวัติ CR-02' })).code;
    await payBooking(page.request, bk);
  });
  await test.step('12 ต.ค. 07:50 น้องบอล (staff) เช็กอิน A · 10:15 คุณเอก (owner) กดไม่มา B', async () => {
    await setClock(request, T('2026-10-12T07:50:00'));
    expect((await postJson(await staffApi('staff'), `/api/staff/bookings/${a}/checkin`, {})).status).toBe(200);
    await setClock(request, T('2026-10-12T10:15:00'));
    expect((await postJson(await staffApi('owner'), `/api/staff/bookings/${bk}/no-show`, {})).status).toBe(200);
  });
  await test.step('owner เปิดประวัติ → ผู้ทำแถวล่าสุดเป็นชื่อพนักงาน', async () => {
    await staffLoginPage(page, 'owner');
    for (const [c, name, user] of [[a, 'น้องบอล', 'staff'], [bk, 'คุณเอก', 'owner']] as const) {
      await open(page, `/owner/bookings/${c}`);
      const i = Number(await page.getByTestId('history-table').getAttribute('data-count')) - 1;
      await expect.soft(page.getByTestId(`history-actor-${i}`), `${c} ผู้ทำ`).toHaveText(name);
      await expect.soft(page.getByTestId(`history-actor-${i}`)).toHaveAttribute('data-value', user);
      expect.soft(sql(`select h.actor from booking_status_history h join bookings b on b.id=h.booking_id where b.code='${c}' order by h.created_at desc, h.id desc limit 1`), '[E sql] actor ที่บันทึก').toBe(user);
    }
  });
});

test('CR-02-09 ขั้น "จบ" ขึ้นเมื่อถึงเวลาจบรอบของการจองที่เช็กอินแล้วเท่านั้น · ไม่มา / ยกเลิก / ไม่ได้เช็กอิน ไม่มี "จบ"', {
  tag: ['@CR-02', '@P3'],
  annotation: ann({
    tc: 'CR-02-09', level: 'P3', source: `[D:CR-02] ${ANSWER} ข้อ 3 · [D A-43] · TC-TRACK-01 (09:00 พอดี = จบ · [สมมติฐาน Q9]) · [สมมติฐาน Q10] หน้าประวัติหลังบ้านไม่มีแถว "จบ"`,
    expected: 'จ 12 ต.ค. A/B/C 08–09 + A 10–11 จ่ายแล้ว · C ยกเลิก (9 ต.ค.) · 08:10 เช็กอิน A · 08:15 ไม่มา B · 08:59:59 A = 3 ขั้น (สุดท้าย CHECKED_IN) · 09:00 A = 4 ขั้น สุดท้าย "จบ" aria-current เวลา "12 ต.ค. 2026 09:00" · booking-status ยัง CHECKED_IN · ประวัติหลังบ้าน A ยัง 3 แถว · 12:00 B (NO_SHOW) · C (CANCELLED) · A 10–11 (CONFIRMED ไม่ได้เช็กอิน) ไม่มี "จบ"',
  }),
}, async ({ page, request, staffApi }) => {
  const phone = uniquePhone(3);
  const code: Record<string, string> = {};
  await test.step('จอง จ 12 ต.ค. A 08 · B 08 · C 08 · A 10 แล้วจ่าย · ยกเลิก C (วันนี้ 9 ต.ค.)', async () => {
    for (const [k, f, h] of [['A08', 'A', 8], ['B08', 'B', 8], ['C08', 'C', 8], ['A10', 'A', 10]] as const) {
      code[k] = (await createBooking(page.request, { fieldId: f, date: '2026-10-12', startHour: h, phone, name: 'ทีมจบ CR-02' })).code;
      await payBooking(page.request, code[k]);
    }
    const r = await postJson(page.request, `/api/bookings/${code.C08}/cancel`, {});
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  });
  const staff = await staffApi('staff');
  await test.step('12 ต.ค. 08:10 เช็กอิน A 08 · 08:15 บันทึกไม่มา B 08', async () => {
    await setClock(request, T('2026-10-12T08:10:00'));
    expect((await postJson(staff, `/api/staff/bookings/${code.A08}/checkin`, {})).status).toBe(200);
    await setClock(request, T('2026-10-12T08:15:00'));
    expect((await postJson(staff, `/api/staff/bookings/${code.B08}/no-show`, {})).status).toBe(200);
  });
  await test.step('08:59:59 ยังไม่ถึงเวลาจบ → 3 ขั้น สุดท้าย เช็กอินแล้ว', async () => {
    await setClock(request, T('2026-10-12T08:59:59'));
    await open(page, `/booking/${code.A08}`);
    const st = await steps(page);
    expect.soft(st.map((x) => x.status)).toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN']);
    expect.soft(st.map((x) => x.text).join(' | ')).not.toMatch(/จบ/);
  });
  await test.step('09:00 ถึงเวลาจบรอบ → ขั้นสุดท้าย "จบ" เวลา 12 ต.ค. 2026 09:00 · สถานะยังเช็กอินแล้ว', async () => {
    await setClock(request, T('2026-10-12T09:00:00'));
    await open(page, `/booking/${code.A08}`);
    const st = await steps(page);
    expect.soft(st.length, JSON.stringify(st)).toBe(4);
    expect.soft(st.slice(0, 3).map((x) => x.status)).toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN']);
    expect.soft(st[3]?.text ?? '').toMatch(/จบ/);
    expect.soft(st[3]?.current).toBe('step');
    expect.soft(st[2]?.current, 'ขั้นเช็กอินไม่ใช่ขั้นปัจจุบันแล้ว').toBe('');
    await expect.soft(page.getByTestId('timeline-time-3')).toContainText('12 ต.ค. 2026 09:00');
    await expect.soft(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CHECKED_IN');
    const api = await getJson(page.request, `/api/bookings/${code.A08}`);
    expect.soft(api.body?.booking?.status, 'API ไม่มีสถานะใหม่').toBe('CHECKED_IN');
  });
  await test.step('หน้าประวัติหลังบ้านยังเป็นแถวจริง 3 แถว (ไม่มีแถว "จบ")', async () => {
    const o = await staffApi('owner');
    const h = await getJson(o, `/api/owner/bookings/${code.A08}/history`);
    expect.soft((h.body?.history ?? []).map((x: { toStatus: string }) => x.toStatus)).toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN']);
  });
  await test.step('12:00 ไม่มา / ยกเลิก / ไม่ได้เช็กอิน (เลยเวลาจบแล้วทั้งหมด) → ไม่มีขั้น "จบ"', async () => {
    await setClock(request, T('2026-10-12T12:00:00'));
    for (const [k, last] of [['B08', 'NO_SHOW'], ['C08', 'CANCELLED'], ['A10', 'CONFIRMED']] as const) {
      await open(page, `/booking/${code[k]}`);
      const st = await steps(page);
      expect.soft(st[st.length - 1]?.status, `${k} ${JSON.stringify(st)}`).toBe(last);
      expect.soft(st.map((x) => x.text).join(' | '), `${k} ไม่มี "จบ"`).not.toMatch(/จบ/);
    }
  });
});
