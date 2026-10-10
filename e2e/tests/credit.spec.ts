import { test, expect, open, waitReady, uniquePhone, createBooking, payBooking, postJson, getJson, loginCustomer, registerCustomer, expectSuccess , setCheckedStable } from './fixtures';

/** ข้อความคำต่อคำจาก SPEC ข้อ 4 */
const MSG_MEMBER_REQUIRED = 'ต้องเข้าสู่ระบบสมาชิกก่อน';
import { SEED } from './constants';

test.describe('CREDIT', () => {
  test('TC-CREDIT-01 สมาชิกดูเครดิต ประวัติเครดิต และชั่วโมงสะสม', {
    tag: ['@CREDIT', '@P2'],
    annotation: { type: 'expected', description: 'ต้น: credit-balance 1,200 · credit-entry RAIN +1200 · paid-hours 7 · free-hours-available 0 · free-hours-next data-value 3 "อีก 3 ชั่วโมง" (= 10 − 7)' },
  }, async ({ page }) => {
    await test.step('ต้นเข้าสู่ระบบด้วยเบอร์+รหัสผ่านที่หน้า /my', async () => {
      await open(page, '/my');
      await page.getByTestId('login-phone').fill(SEED.ton.phone);
      await page.getByTestId('login-password').fill(SEED.ton.password);
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('my-name')).toHaveText(SEED.ton.name);
    });
    await test.step('เครดิตคงเหลือและประวัติ', async () => {
      await expect(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '1200');
      const rain = page.getByTestId('credit-history').locator('[data-reason="RAIN"]');
      await expect(rain).toHaveCount(1);
      await expect(rain).toHaveAttribute('data-value', /^\+?1200$/);
    });
    await test.step('ชั่วโมงสะสม 7 → ยังไม่มีสิทธิ์ อีก 3 ชั่วโมง', async () => {
      await expect(page.getByTestId('paid-hours')).toHaveAttribute('data-value', '7');
      await expect(page.getByTestId('free-hours-available')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('free-hours-next')).toHaveAttribute('data-value', '3');
      await expect(page.getByTestId('free-hours-next')).toContainText('อีก 3 ชั่วโมง');
    });
  });

  test('TC-CREDIT-02 เครดิตสะสมตามเบอร์ ใช้ได้หลังสมัครสมาชิกเท่านั้น', {
    tag: ['@CREDIT', '@P1'],
    annotation: { type: 'expected', description: 'ยกเลิกล่วงหน้า 7 วัน → "ยกเลิกแล้ว ได้รับเครดิตคืน ฿400" · ยังไม่สมัคร: ไม่มี use-credit และ API ไม่ยอมให้ใช้เครดิต · สมัครแล้ว credit-balance 400 (CANCEL +400) · จองใหม่ใช้เครดิต: เครดิต 400 สุทธิ 400 จ่ายตอนนี้ 200 · จ่ายแล้วเครดิต 0 มีรายการ USED −400' },
  }, async ({ page, pick, b }) => {
    const [h1, h2] = pick([[9, 10], [11, 12], [13, 14]] as const);
    const date = '2026-10-16';
    const phone = uniquePhone(b);
    const name = 'ลูกค้าเครดิต';
    let code1 = '';
    await test.step(`ลูกค้า (ไม่สมัคร) จอง B ${h1}:00 ศ. 16 ต.ค. จ่ายมัดจำ 400`, async () => {
      code1 = (await createBooking(page.request, { fieldId: 'B', date, startHour: h1, phone, name })).code;
      await payBooking(page.request, code1);
    });
    await test.step('ยกเลิก (เหลือ 7 วัน ≥ 24 ชม.) → ได้เครดิต 400', async () => {
      await open(page, `/booking/${code1}`);
      await page.getByTestId('cancel-booking').click();
      await expect(page.getByTestId('cancel-credit-preview')).toHaveAttribute('data-value', '400');
      await page.getByTestId('cancel-confirm').click();
      await expectSuccess(page, 'ยกเลิกแล้ว ได้รับเครดิตคืน ฿400');
      await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CANCELLED');
    });
    await test.step('ยังไม่สมัคร: ฟอร์มจองไม่มีช่องใช้เครดิต และ API ไม่ยอมให้ใช้เครดิต', async () => {
      await open(page, `/book/new?field=B&date=${date}&start=${h2}`);
      await expect(page.getByTestId('use-credit')).toHaveCount(0);
      const r = await postJson(page.request, '/api/quote', { fieldId: 'B', date, startHour: h2, hours: 1, useCredit: true, creditUsed: 400, phone });
      const applied = r.status === 200 ? r.body.quote.creditUsed : 0;
      expect(applied, `ไม่เข้าสู่ระบบแต่ใช้เครดิตได้ ${JSON.stringify(r.body)}`).toBe(0);
    });
    await test.step('สมัครสมาชิกด้วยเบอร์เดิม → เห็นเครดิต 400 (CANCEL)', async () => {
      await open(page, '/my');
      await page.getByTestId('register-name').fill(name);
      await page.getByTestId('register-phone').fill(phone);
      await page.getByTestId('register-password').fill('Credit1234');
      await page.getByTestId('register-consent').check();
      await page.getByTestId('register-submit').click();
      await expectSuccess(page, 'สมัครสมาชิกสำเร็จ');
      await expect(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '400');
      await expect(page.getByTestId('credit-history').locator('[data-reason="CANCEL"]')).toHaveAttribute('data-value', /^\+?400$/);
    });
    await test.step(`จองใหม่ B ${h2}:00 ติ๊กใช้เครดิต → เครดิต 400 สุทธิ 400 จ่าย 200`, async () => {
      await open(page, `/book/new?field=B&date=${date}&start=${h2}`);
      await setCheckedStable(page.getByTestId('use-credit'), true);
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '800');
      await expect(page.getByTestId('price-credit')).toHaveAttribute('data-value', '400');
      await expect(page.getByTestId('price-net')).toHaveAttribute('data-value', '400');
      await expect(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', '200');
      await expect(page.getByTestId('customer-phone')).toHaveValue(phone);
      await setCheckedStable(page.getByTestId('pdpa-consent'), true);
      await page.getByTestId('book-submit').click();
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
      await waitReady(page);
      await expect(page.getByTestId('pay-now-amount')).toHaveAttribute('data-value', '200');
      await page.getByTestId('pay-confirm').click();
      await expect(page).toHaveURL(/done=paid/);
    });
    await test.step('หลังจ่าย เครดิตเหลือ 0 มีรายการ USED −400', async () => {
      await open(page, '/my');
      await expect(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('credit-history').locator('[data-reason="USED"]')).toHaveAttribute('data-value', '-400');
    });
  });

  test('TC-CREDIT-03 ไม่ได้เข้าสู่ระบบสมาชิกของเบอร์นั้นแต่ขอใช้เครดิต → MEMBER_REQUIRED (A-26)', {
    tag: ['@CREDIT', '@P1'],
    annotation: { type: 'expected', description: 'เบอร์ใหม่ (ไม่สมัคร) มีเครดิต ฿400 จากการยกเลิก · ไม่เข้าสู่ระบบ: /api/quote useCredit=true → 401 MEMBER_REQUIRED "ต้องเข้าสู่ระบบสมาชิกก่อน" · /api/quote creditUsed=400 → 401 เดิม · /api/bookings useCredit+creditUsed=400 → 401 เดิม ไม่สร้างการจอง · creditUsed=0 ไม่นับว่าขอใช้ (200, creditUsed 0) · เข้าสู่ระบบเป็นสมาชิกคนอื่น (มิว) แล้วจองด้วยเบอร์นี้ขอใช้เครดิต → 401 เดิม · ฟอร์มไม่มี use-credit · เครดิตยัง ฿400 · หลังสมัคร+เข้าสู่ระบบเบอร์นี้ quote ใช้เครดิตได้ 400' },
  }, async ({ page, pick, b, anonApi }) => {
    const hour = pick([9, 10, 11] as const);
    const date = '2026-10-15';
    const phone = uniquePhone(b);
    const name = 'ลูกค้ายังไม่สมัคร';
    const quote = { fieldId: 'B', date, startHour: hour, hours: 1 };
    const expectMemberRequired = (r: { status: number; body: any }, label: string) => {
      expect(r.status, `${label}: ${JSON.stringify(r.body)}`).toBe(401);
      expect(r.body?.error?.code, label).toBe('MEMBER_REQUIRED');
      expect(r.body?.error?.message, label).toBe(MSG_MEMBER_REQUIRED);
    };
    await test.step(`ลูกค้า (ไม่สมัคร) จอง B ${date} ${hour}:00 จ่าย 400 แล้วยกเลิกล่วงหน้า → เครดิต 400`, async () => {
      const code = (await createBooking(page.request, { fieldId: 'B', date, startHour: hour, phone, name })).code;
      await payBooking(page.request, code);
      const c = await postJson(page.request, `/api/bookings/${code}/cancel`, {});
      expect(c.status, JSON.stringify(c.body)).toBe(200);
      expect(c.body.creditReturned).toBe(400);
    });
    await test.step('ไม่เข้าสู่ระบบ: quote ขอใช้เครดิต (useCredit / creditUsed) → MEMBER_REQUIRED', async () => {
      expectMemberRequired(await postJson(page.request, '/api/quote', { ...quote, useCredit: true }), 'quote useCredit=true');
      expectMemberRequired(await postJson(page.request, '/api/quote', { ...quote, creditUsed: 400 }), 'quote creditUsed=400');
    });
    await test.step('ไม่เข้าสู่ระบบ: จองพร้อมขอใช้เครดิต → MEMBER_REQUIRED และไม่สร้างการจอง', async () => {
      expectMemberRequired(await postJson(page.request, '/api/bookings', { ...quote, useCredit: true, creditUsed: 400, name, phone, consent: true }), 'bookings useCredit');
      const av = (await getJson(page.request, `/api/availability?date=${date}`)).body;
      expect(av.slots.find((x: any) => x.fieldId === 'B' && x.hour === hour)?.status, 'ต้องไม่มีการจองถูกสร้าง').toBe('free');
    });
    await test.step('creditUsed = 0 ไม่นับว่าขอใช้เครดิต → คิดราคาได้ตามปกติ', async () => {
      const r = await postJson(page.request, '/api/quote', { ...quote, creditUsed: 0 });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.quote.creditUsed).toBe(0);
      expect(r.body.quote.totalPrice).toBe(800);
    });
    await test.step('เข้าสู่ระบบเป็นสมาชิกคนอื่น (มิว) แล้วจองด้วยเบอร์นี้ขอใช้เครดิต → MEMBER_REQUIRED', async () => {
      const mew = await anonApi();
      await loginCustomer(mew, '0822222222', 'Mew12345');
      expectMemberRequired(await postJson(mew, '/api/bookings', { ...quote, useCredit: true, creditUsed: 400, name, phone, consent: true }), 'มิวจองด้วยเบอร์อื่น');
      const av = (await getJson(page.request, `/api/availability?date=${date}`)).body;
      expect(av.slots.find((x: any) => x.fieldId === 'B' && x.hour === hour)?.status, 'ต้องไม่มีการจองถูกสร้าง').toBe('free');
    });
    await test.step('หน้าฟอร์มจอง (ไม่เข้าสู่ระบบ) ไม่มีช่องใช้เครดิต', async () => {
      await open(page, `/book/new?field=B&date=${date}&start=${hour}`);
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '800');
      await expect(page.getByTestId('use-credit')).toHaveCount(0);
    });
    await test.step('สมัครด้วยเบอร์นี้ (เข้าสู่ระบบให้) → เครดิต 400 ยังอยู่ และ quote ใช้เครดิตได้ 400', async () => {
      await registerCustomer(page.request, { name, phone });
      const me = (await getJson(page.request, '/api/me')).body;
      expect(me.customer.creditBalance).toBe(400);
      const r = await postJson(page.request, '/api/quote', { ...quote, useCredit: true });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.quote.creditUsed).toBe(400);
      expect(r.body.quote.netPrice).toBe(400);
    });
  });
});

void loginCustomer;
