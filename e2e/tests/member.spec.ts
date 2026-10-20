import { test, expect, open, waitReady, uniquePhone, createBooking, getBooking, getJson, postJson, loginCustomer, expectError, expectSuccess, setCheckedStable } from './fixtures';
import { SEED } from './constants';

test.describe('MEMBER', () => {
  test('TC-MEMBER-01 สมัครสมาชิกและเข้าสู่ระบบ', {
    tag: ['@MEMBER', '@P2'],
    annotation: { type: 'expected', description: 'รหัส 7 ตัว → "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" · ไม่ติ๊กยินยอม → "กรุณายินยอมให้เก็บข้อมูลส่วนบุคคล (PDPA) ก่อนดำเนินการ" · สำเร็จ → "สมัครสมาชิกสำเร็จ" + my-name · สมัครซ้ำ → "เบอร์นี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ" · รหัสผิด → "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง" · รหัสถูก → my-name' },
  }, async ({ page, b }) => {
    const phone = uniquePhone(b);
    const name = 'สมาชิกใหม่';
    const reg = async (pw: string, consent: boolean) => {
      await page.getByTestId('register-name').fill(name);
      await page.getByTestId('register-phone').fill(phone);
      await page.getByTestId('register-password').fill(pw);
      await page.getByTestId('register-consent').setChecked(consent);
      await page.getByTestId('register-submit').click();
    };
    await test.step('เปิด /my', async () => { await open(page, '/my'); });
    await test.step('รหัสผ่าน 7 ตัว (= 8 − 1) → ปฏิเสธ', async () => {
      await reg('Abc1234', true);
      await expectError(page, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    });
    await test.step('ไม่ติ๊กยินยอม → ปฏิเสธ', async () => {
      await reg('Abc12345', false);
      await expectError(page, 'กรุณายินยอมให้เก็บข้อมูลส่วนบุคคล (PDPA) ก่อนดำเนินการ');
    });
    await test.step('รหัส 8 ตัว + ยินยอม → สมัครสำเร็จและเข้าสู่ระบบให้', async () => {
      await reg('Abc12345', true);
      await expectSuccess(page, 'สมัครสมาชิกสำเร็จ');
      await expect(page.getByTestId('my-name')).toHaveText(name);
    });
    await test.step('ออกจากระบบ แล้วสมัครซ้ำเบอร์เดิม → ปฏิเสธ', async () => {
      await waitReady(page); // รอหน้าโหลดข้อมูลสมาชิกเสร็จก่อนกด (กันกดระหว่าง data-ready=false)
      const out = page.waitForResponse((r) => r.url().includes('/api/customers/logout'));
      await page.getByTestId('logout').click();
      expect((await out).status()).toBe(200);
      // เปิด /my ใหม่: ข้อสังเกต — ถ้ากดออกระหว่าง /api/me ที่ยิงก่อนหน้ายังไม่ตอบ หน้าเดิมอาจแสดงชื่อค้างไว้ (race ฝั่ง UI)
      await open(page, '/my');
      await expect(page.getByTestId('login-phone')).toBeVisible();
      await expect(page.getByTestId('my-name')).toHaveCount(0);
      await reg('Abc12345', true);
      await expectError(page, 'เบอร์นี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ');
    });
    await test.step('เข้าสู่ระบบรหัสผิด → ปฏิเสธ', async () => {
      await page.getByTestId('login-phone').fill(phone);
      await page.getByTestId('login-password').fill('Wrong12345');
      await page.getByTestId('login-submit').click();
      await expectError(page, 'เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง');
    });
    await test.step('เข้าสู่ระบบรหัสถูก → เห็นชื่อสมาชิก', async () => {
      await page.getByTestId('login-password').fill('Abc12345');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('my-name')).toHaveText(name);
    });
  });

  test('TC-MEMBER-02 ดูการจองด้วยรหัส+เบอร์ · ข้อมูลผูกเบอร์ ชื่อเก็บต่อการจอง · เห็นเฉพาะของตัวเอง', {
    tag: ['@MEMBER', '@P2'],
    annotation: { type: 'expected', description: 'LN-900004 + 0844444444 → /booking/LN-900004 ชื่อ "แนน" · LN-900001 + เบอร์แนน → "เบอร์โทรไม่ตรงกับการจองนี้" · เปิด /booking/LN-900001 ตรง ๆ → gate-phone · จองด้วยเบอร์แนนชื่อ "แนน ทดลอง" → แสดง "แนน ทดลอง" และ customerId เดียวกับ LN-900004 · มิวเรียกการจองของต้น → 403 BOOKING_FORBIDDEN' },
  }, async ({ page, pick, anonApi }) => {
    const hour = pick([20, 21, 22] as const);
    await test.step('ค้นด้วยรหัส LN-900004 + เบอร์แนน → เห็นการจอง', async () => {
      await open(page, '/my');
      await page.getByTestId('lookup-code').fill('LN-900004');
      await page.getByTestId('lookup-phone').fill(SEED.nan.phone);
      await page.getByTestId('lookup-submit').click();
      await expect(page).toHaveURL(/\/booking\/LN-900004/);
      await waitReady(page);
      await expect(page.getByTestId('booking-customer')).toHaveText(SEED.nan.name);
    });
    await test.step('ค้น LN-900001 (ของต้น) ด้วยเบอร์แนน → ปฏิเสธ', async () => {
      await open(page, '/my');
      await page.getByTestId('lookup-code').fill('LN-900001');
      await page.getByTestId('lookup-phone').fill(SEED.nan.phone);
      await page.getByTestId('lookup-submit').click();
      await expectError(page, 'เบอร์โทรไม่ตรงกับการจองนี้');
    });
    await test.step('เปิด /booking/LN-900001 ตรง ๆ → ต้องใส่เบอร์ก่อน ไม่เห็นรายละเอียด', async () => {
      await open(page, '/booking/LN-900001');
      await expect(page.getByTestId('gate-phone')).toBeVisible();
      await expect(page.getByTestId('booking-status')).toHaveCount(0);
    });
    let code = '';
    await test.step(`จองด้วยเบอร์แนน กรอกชื่อ "แนน ทดลอง" (อา. 18 ต.ค. C ${hour}:00)`, async () => {
      code = (await createBooking(page.request, { fieldId: 'C', date: '2026-10-18', startHour: hour, phone: SEED.nan.phone, name: 'แนน ทดลอง' })).code;
      await open(page, `/booking/${code}`);
      await expect(page.getByTestId('booking-customer')).toHaveText('แนน ทดลอง');
    });
    await test.step('การจองใหม่เป็นลูกค้าคนเดียวกับ LN-900004 (ผูกเบอร์)', async () => {
      const a = await getBooking(page.request, 'LN-900004', SEED.nan.phone);
      const n = await getBooking(page.request, code);
      expect(a.body.booking.customerId).toBeTruthy();
      expect(n.body.booking.customerId).toBe(a.body.booking.customerId);
    });
    await test.step('มิว (สมาชิกอื่น) เรียกดูการจองของต้น → 403', async () => {
      const mew = await anonApi();
      await loginCustomer(mew, SEED.mew.phone, SEED.mew.password);
      const r = await getBooking(mew, 'LN-900001');
      expect(r.status).toBe(403);
      expect(r.body?.error?.code).toBe('BOOKING_FORBIDDEN');
      const me = await getJson(mew, '/api/me');
      expect((me.body.bookings as any[]).map((x) => x.code)).not.toContain('LN-900001');
    });
  });

  // TC-MEMBER-03 ย้ายไป member.serial.spec.ts (CR-02 / A-45 เช็กอินได้เฉพาะวันเตะ → ต้อง setClock เป็นวันเตะ · ORACLE-CHANGES lead อนุมัติ 2026-10-21)

  test('TC-MEMBER-04 เงื่อนไขการใช้ชั่วโมงฟรี (จ.–ศ. ก่อน 17:00 เฉพาะสมาชิกที่มีสิทธิ์)', {
    tag: ['@MEMBER', '@P1'],
    annotation: { type: 'expected', description: 'มิว: ศ. 16 A 16:00 ใช้ได้ (ฟรี 800 ยอด 0) · ศ. 16 A 17:00 และ ส. 17 A 09:00 → 400 "ใช้ชั่วโมงฟรีได้เฉพาะรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์" · อ. 13 (วันหยุดวันธรรมดา) A 09:00 ใช้ได้ · ต้น (7 ชม.) → "ยังไม่มีสิทธิ์ชั่วโมงฟรี" และ use-free-hour กดไม่ได้' },
  }, async ({ page, anonApi }) => {
    await test.step('มิวเข้าสู่ระบบ (สะสม 10 ชม. = 1 สิทธิ์) ศ. 16 A 16:00 ใช้สิทธิ์ได้', async () => {
      await loginCustomer(page.request, SEED.mew.phone, SEED.mew.password);
      await open(page, '/book/new?field=A&date=2026-10-16&start=16');
      await expect(page.getByTestId('use-free-hour')).toBeEnabled();
      await setCheckedStable(page.getByTestId('use-free-hour'), true);
      await expect(page.getByTestId('price-free-hour')).toHaveAttribute('data-value', '800');
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '0');
    });
    const q = (date: string, startHour: number) => postJson(page.request, '/api/quote', { fieldId: 'A', date, startHour, hours: 1, useFreeHour: true });
    await test.step('ศ. 16 A 17:00 และ ส. 17 A 09:00 → ใช้ไม่ได้', async () => {
      for (const [d, h] of [['2026-10-16', 17], ['2026-10-17', 9]] as const) {
        const r = await q(d, h);
        expect(r.status, `${d} ${h}:00 ${JSON.stringify(r.body)}`).toBe(400);
        expect(r.body?.error?.code).toBe('FREE_HOUR_NOT_ELIGIBLE');
        expect(r.body?.error?.message).toBe('ใช้ชั่วโมงฟรีได้เฉพาะรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์');
      }
    });
    await test.step('อ. 13 ต.ค. (วันหยุดที่ตรงวันธรรมดา) A 09:00 → ใช้ได้ (A-15)', async () => {
      const r = await q('2026-10-13', 9);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.quote.freeHourValue).toBe(1200);
      expect(r.body.quote.totalPrice).toBe(0);
    });
    await test.step('ต้น (สะสม 7 ชม.) → ยังไม่มีสิทธิ์', async () => {
      const ton = await anonApi();
      await loginCustomer(ton, SEED.ton.phone, SEED.ton.password);
      const r = await postJson(ton, '/api/quote', { fieldId: 'A', date: '2026-10-16', startHour: 16, hours: 1, useFreeHour: true });
      expect(r.status).toBe(400);
      expect(r.body?.error?.code).toBe('FREE_HOUR_NONE');
      expect(r.body?.error?.message).toBe('ยังไม่มีสิทธิ์ชั่วโมงฟรี');
      await postJson(page.request, '/api/customers/logout', {});
      await loginCustomer(page.request, SEED.ton.phone, SEED.ton.password);
      await open(page, '/book/new?field=A&date=2026-10-16&start=16');
      await expect(page.getByTestId('use-free-hour')).toBeDisabled();
    });
  });

  test('TC-MEMBER-05 ช่องชั่วโมงฟรีปิด (disabled) พร้อมเหตุผล เมื่อรอบใช้สิทธิ์ไม่ได้หรือไม่มีสิทธิ์ (Q-T5)', {
    tag: ['@MEMBER', '@P2'],
    annotation: { type: 'expected', description: 'มิว (1 สิทธิ์): ศ. 16 A 16:00 → use-free-hour ใช้ได้ ไม่มี use-free-hour-reason · เปลี่ยนเป็น 17:00 → disabled + use-free-hour-reason data-value FREE_HOUR_NOT_ELIGIBLE "ใช้ชั่วโมงฟรีได้เฉพาะรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์" · ส. 17 A 09:00 → disabled + เหตุผลเดิม · API ส่ง useFreeHour กับ ส. 09:00 ยังได้ 400 FREE_HOUR_NOT_ELIGIBLE · ต้น (0 สิทธิ์) ศ. 16 A 16:00 → disabled + FREE_HOUR_NONE "ยังไม่มีสิทธิ์ชั่วโมงฟรี"' },
  }, async ({ page, anonApi }) => {
    const NOT_ELIGIBLE = 'ใช้ชั่วโมงฟรีได้เฉพาะรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์';
    const NONE = 'ยังไม่มีสิทธิ์ชั่วโมงฟรี';
    await test.step('มิวเข้าสู่ระบบ · ศ. 16 ต.ค. A 16:00 → ช่องชั่วโมงฟรีใช้ได้ ไม่มีเหตุผลปิด', async () => {
      await loginCustomer(page.request, SEED.mew.phone, SEED.mew.password);
      await open(page, '/book/new?field=A&date=2026-10-16&start=16');
      await expect(page.getByTestId('member-free-hours')).toHaveAttribute('data-value', '1');
      await expect(page.getByTestId('use-free-hour')).toBeEnabled();
      await expect(page.getByTestId('use-free-hour-reason')).toHaveCount(0);
    });
    await test.step('เปลี่ยนเวลาเริ่มเป็น 17:00 → ช่องปิด พร้อมเหตุผล FREE_HOUR_NOT_ELIGIBLE', async () => {
      await page.getByTestId('book-start').selectOption('17');
      await expect(page.getByTestId('use-free-hour')).toBeDisabled();
      await expect(page.getByTestId('use-free-hour-reason')).toHaveAttribute('data-value', 'FREE_HOUR_NOT_ELIGIBLE');
      await expect(page.getByTestId('use-free-hour-reason')).toContainText(NOT_ELIGIBLE);
    });
    await test.step('ส. 17 ต.ค. A 09:00 (เสาร์) → ช่องปิด พร้อมเหตุผลเดิม', async () => {
      await open(page, '/book/new?field=A&date=2026-10-17&start=9');
      await expect(page.getByTestId('use-free-hour')).toBeDisabled();
      await expect(page.getByTestId('use-free-hour-reason')).toHaveAttribute('data-value', 'FREE_HOUR_NOT_ELIGIBLE');
      await expect(page.getByTestId('use-free-hour-reason')).toContainText(NOT_ELIGIBLE);
    });
    await test.step('API ยังตอบ error เดิมถ้าส่ง useFreeHour มากับรอบที่ใช้ไม่ได้', async () => {
      const r = await postJson(page.request, '/api/quote', { fieldId: 'A', date: '2026-10-17', startHour: 9, hours: 1, useFreeHour: true });
      expect(r.status, JSON.stringify(r.body)).toBe(400);
      expect(r.body?.error?.code).toBe('FREE_HOUR_NOT_ELIGIBLE');
      expect(r.body?.error?.message).toBe(NOT_ELIGIBLE);
    });
    await test.step('ต้น (สะสม 7 ชม. ยังไม่มีสิทธิ์) ศ. 16 A 16:00 → ช่องปิด พร้อมเหตุผล FREE_HOUR_NONE', async () => {
      await postJson(page.request, '/api/customers/logout', {});
      await loginCustomer(page.request, SEED.ton.phone, SEED.ton.password);
      await open(page, '/book/new?field=A&date=2026-10-16&start=16');
      await expect(page.getByTestId('use-free-hour')).toBeDisabled();
      await expect(page.getByTestId('use-free-hour-reason')).toHaveAttribute('data-value', 'FREE_HOUR_NONE');
      await expect(page.getByTestId('use-free-hour-reason')).toContainText(NONE);
    });
    void anonApi;
  });
});
