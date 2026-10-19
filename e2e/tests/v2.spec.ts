import { test, expect, open, waitReady, uniquePhone, createBooking, payBooking, getJson, postJson, registerCustomer, expectError, expectSuccess, fillBookingForm, staffLoginPage } from './fixtures';
import { BASE_URL, SEED } from './constants';
import { ann, sql, sqlNum, countSlot, expectFree, softNum, staffLoginUi, memberLoginUi, outcome } from './v2-helpers';
import type { Page } from '@playwright/test';

/**
 * TC รอบ 2 ที่ "ไม่ต้อง reset" — รันพร้อมกัน 3 เบราว์เซอร์ (Chromium / Firefox / WebKit)
 * เฉลยมาจาก docs/TEST-CASES.md เท่านั้น (+ คำตอบร้าน A-41–A-50 ที่แก้ลง TEST-CASES แล้ว)
 *
 * test ในไฟล์นี้ไม่ reset เอง (3 เบราว์เซอร์และ spec อื่นรันพร้อมกัน — global-setup reset ครั้งเดียว) จึงแยกข้อมูลแทน:
 *   - ช่องเวลาแยกต่อเบราว์เซอร์ (pick) ราคา/แผนจ่ายกลุ่มเดียวกับข้อมูลใน TEST-CASES · Chromium ใช้ข้อมูลตาม TEST-CASES พอดีเมื่อทำได้
 *   - ก่อนจองตรวจด้วย SQL ว่าช่องยังว่าง (ถ้าชน test อื่นจะล้มพร้อมบอกเหตุ ไม่ใช่ล้มแบบงง)
 *   - ข้อที่ต้องการตัวเลขจาก seed ตรง ๆ (คลัง แดชบอร์ด รายงาน เครดิตของต้น) หรือเลื่อนเวลา อยู่ใน v2.serial.spec.ts (reset ก่อน/หลังทุกข้อ)
 */

/** คลิกเมาส์จริง 2 ครั้งติดกันที่ปุ่ม (ไม่ใช่ dblclick) */
async function clickTwice(page: Page, testid: string) {
  const btn = page.getByTestId(testid);
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
  const box = await btn.boundingBox();
  if (!box) throw new Error(`หา ${testid} บนจอไม่เจอ`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
}

/** รอราคาในฟอร์มคิดเสร็จ (price-total มีค่า และ data-ready = true) */
async function priceReady(page: Page) {
  await waitReady(page);
  await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', /\d/);
  await waitReady(page);
}

test.describe('BOOK v2', () => {
  test('TC-BOOK-09 กดยืนยันจอง 2 ครั้งติดกันจริง → การจอง 1 รายการ', {
    tag: ['@BOOK', '@P1'],
    annotation: ann({
      tc: 'TC-BOOK-09', level: 'P1', source: '[R] การกดซ้ำต้องไม่สร้างรายการซ้ำ + [D] BR-06 · [E sql:count_slot]',
      expected: 'คลิกเมาส์ 2 ครั้งติดกันที่ book-submit → ไป /pay/LN-… รหัสเดียว · [E sql:count_slot] = 1 การจอง (PENDING_PAYMENT) · กดยืนยันจ่ายต่อได้ปกติ (CONFIRMED)',
    }),
  }, async ({ page, pick, b }) => {
    const date = '2026-10-15';
    const hour = pick([19, 20, 18] as const); // พฤ 15 ต.ค. B ≥ 17:00 = ฿1,200 มัดจำ 50% (Chromium = ข้อมูลตาม TEST-CASES)
    let code = '';
    await test.step(`ช่อง B ${date} ${hour}:00 ยังว่าง`, async () => { expectFree('B', date, hour, hour + 1); });
    await test.step('เปิดฟอร์ม กรอกชื่อ เบอร์ใหม่ ติ๊ก PDPA รอราคา', async () => {
      await open(page, `/book/new?field=B&date=${date}&start=${hour}`);
      await fillBookingForm(page, { name: 'ทีมกดซ้ำ', phone: uniquePhone(b), consent: true });
      await priceReady(page);
      await expect.soft(page.getByTestId('price-total')).toHaveAttribute('data-value', '1200');
      await expect.soft(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', '600');
    });
    await test.step('คลิก book-submit 2 ครั้งติดกัน (เมาส์จริง)', async () => {
      await clickTwice(page, 'book-submit');
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
      code = page.url().match(/LN-\d{6}/)![0];
      await waitReady(page);
    });
    await test.step('[E sql:count_slot] ช่องนี้มีการจอง 1 รายการ สถานะ PENDING_PAYMENT', async () => {
      await page.waitForTimeout(1500); // เผื่อคำขอที่ 2 ที่ยังวิ่งอยู่
      expect(countSlot('B', date, hour), 'จำนวนการจองในช่องนี้ (กดยืนยัน 2 ครั้ง)').toBe(1);
      expect(sql(`select status from bookings where code='${code}'`)).toBe('PENDING_PAYMENT');
    });
    await test.step('กดยืนยันจ่ายต่อได้ปกติ → CONFIRMED', async () => {
      await page.getByTestId('pay-confirm').click();
      await expect(page).toHaveURL(new RegExp(`/booking/${code}\\?done=paid`));
      await waitReady(page);
      await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
      await expect.soft(page.getByTestId('amount-paid')).toHaveAttribute('data-value', '600');
      await expect.soft(page.getByTestId('due-at-field')).toHaveAttribute('data-value', '600');
    });
  });

  test('TC-BOOK-11 ค้นการจองโดยไม่กรอกอะไร / ไม่กรอกเบอร์ → ข้อความบอกให้กรอก (ไม่ใช่ error ระบบ)', {
    tag: ['@BOOK', '@P3'],
    annotation: ann({
      tc: 'TC-BOOK-11', level: 'P3', source: '[R] ข้อความ error ต้องบอกสิ่งที่ผู้ใช้ต้องแก้ ไม่ใช่ "ระบบผิดพลาด" · FR-09',
      expected: '/my กด lookup-submit ทันที และใส่เฉพาะรหัส LN-900004 → error-message บอกให้กรอกรหัส/เบอร์ (ไม่ผูกคำ) · ไม่ใช่ "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่"',
    }),
  }, async ({ page }) => {
    const SYS = 'เกิดข้อผิดพลาดในระบบ';
    await test.step('เปิด /my กด lookup-submit ทันที (ช่องว่าง)', async () => {
      await open(page, '/my');
      await page.getByTestId('lookup-submit').click();
      const msg = page.getByTestId('error-message').or(page.getByTestId('field-error-phone')).or(page.locator('[data-testid^="field-error"]')).first();
      await expect(msg).toBeVisible();
      const t = (await msg.innerText()).trim();
      expect.soft(t, 'ข้อความต้องบอกให้กรอก ไม่ใช่ error ระบบ').not.toContain(SYS);
      expect.soft(t, 'ข้อความต้องพูดถึงรหัส/เบอร์ที่ต้องกรอก').toMatch(/รหัส|เบอร์|กรอก|โทร/);
    });
    await test.step('ใส่เฉพาะรหัส LN-900004 (ไม่มีเบอร์) กด lookup-submit', async () => {
      await open(page, '/my');
      await page.getByTestId('lookup-code').fill('LN-900004');
      await page.getByTestId('lookup-submit').click();
      const msg = page.getByTestId('error-message').or(page.locator('[data-testid^="field-error"]')).first();
      await expect(msg).toBeVisible();
      const t = (await msg.innerText()).trim();
      expect.soft(t, 'ข้อความต้องบอกให้กรอก ไม่ใช่ error ระบบ').not.toContain(SYS);
      expect.soft(t, 'ข้อความต้องบอกให้กรอกเบอร์').toMatch(/เบอร์|โทร|กรอก/);
      await expect(page).not.toHaveURL(/\/booking\/LN-900004/);
    });
  });
});

test.describe('PRICE v2', () => {
  test('TC-PRICE-05 ราคาทุกแถว E22–E33 (ขนาด/ช่วงเวลา/วันหยุด/คร่อม 17:00)', {
    tag: ['@PRICE', '@P1'],
    annotation: ann({
      tc: 'TC-PRICE-05', level: 'P1', source: '[D] TEST-DATA E22–E33 · BR-07–BR-09',
      expected: 'E22 ฿800 · E23 ฿1,200 · E24 ฿1,200 · E25 ฿1,200 · E26 ฿1,800 · E27 ฿800 · E28 ฿1,200 · E29 ฿800 · E30 ฿1,200 · E31 ฿1,600 · E32 ฿2,000 · E33 ฿2,400',
    }),
  }, async ({ page }) => {
    const grid: [string, string, string, string][] = [
      // [แถว, วันที่, ช่อง, ราคา]
      ['E22', '2026-10-14', 'A-16', '800'], ['E23', '2026-10-14', 'A-17', '1200'], ['E24', '2026-10-14', 'A-18', '1200'],
      ['E25', '2026-10-14', 'C-16', '1200'], ['E26', '2026-10-14', 'C-17', '1800'], ['E29', '2026-10-14', 'A-9', '800'],
      ['E27', '2026-10-12', 'A-9', '800'], ['E28', '2026-10-13', 'A-9', '1200'], ['E30', '2026-10-10', 'A-9', '1200'],
    ];
    for (const date of ['2026-10-14', '2026-10-12', '2026-10-13', '2026-10-10']) {
      await test.step(`ตาราง ${date}: ${grid.filter((g) => g[1] === date).map((g) => `${g[0]} slot-${g[2]} ฿${g[3]}`).join(' · ')}`, async () => {
        await open(page, `/book?date=${date}`);
        for (const [row, , slot, price] of grid.filter((g) => g[1] === date)) {
          await expect.soft(page.getByTestId(`slot-${slot}`), `${row} slot-${slot}`).toHaveAttribute('data-price', price);
        }
      });
    }
    for (const [row, start, total] of [['E31', 15, '1600'], ['E32', 16, '2000'], ['E33', 17, '2400']] as const) {
      await test.step(`${row} ฟอร์ม A พ 14 ${start}:00 × 2 → price-field ฿${total}`, async () => {
        await open(page, `/book/new?field=A&date=2026-10-14&start=${start}`);
        await fillBookingForm(page, { hours: 2 });
        await waitReady(page);
        await expect.soft(page.getByTestId('price-field'), `${row} price-field`).toHaveAttribute('data-value', total);
        await expect.soft(page.getByTestId('price-total'), `${row} price-total (ไม่มีของเช่า/ส่วนลด)`).toHaveAttribute('data-value', total);
      });
    }
  });

  test('TC-PRICE-06 แผนจ่ายทุกแถว E37–E43', {
    tag: ['@PRICE', '@P1'],
    annotation: ann({
      tc: 'TC-PRICE-06', level: 'P1', source: '[D] TEST-DATA E37–E43, A-16 · BR-11',
      expected: 'E37 DEPOSIT_50 ฿400 · E38 FULL_100 ฿1,200 · E39 FULL_100 ฿1,200 · E40 FULL_100 ฿1,200 · E41 DEPOSIT_50 ฿600 · E42 DEPOSIT_50 ฿600 · E43 DEPOSIT_50 ฿600 (price-plan + price-pay-now + price-due-at-field: DEPOSIT เก็บหน้าสนามเท่าจ่ายตอนนี้ · FULL เก็บหน้าสนาม ฿0)',
    }),
  }, async ({ page }) => {
    const rows = [
      { row: 'E37', date: '2026-10-16', start: 16, plan: 'DEPOSIT_50', now: '400', due: '400' },
      { row: 'E38', date: '2026-10-16', start: 17, plan: 'FULL_100', now: '1200', due: '0' },
      { row: 'E39', date: '2026-10-16', start: 18, plan: 'FULL_100', now: '1200', due: '0' },
      { row: 'E40', date: '2026-10-17', start: 17, plan: 'FULL_100', now: '1200', due: '0' },
      { row: 'E41', date: '2026-10-18', start: 17, plan: 'DEPOSIT_50', now: '600', due: '600' },
      { row: 'E42', date: '2026-10-15', start: 17, plan: 'DEPOSIT_50', now: '600', due: '600' },
      { row: 'E43', date: '2026-10-13', start: 17, plan: 'DEPOSIT_50', now: '600', due: '600' },
    ];
    for (const r of rows) {
      await test.step(`${r.row} A ${r.date} ${r.start}:00 × 1 → ${r.plan} จ่ายตอนนี้ ฿${r.now} เก็บหน้าสนาม ฿${r.due}`, async () => {
        await open(page, `/book/new?field=A&date=${r.date}&start=${r.start}`);
        await priceReady(page);
        await expect.soft(page.getByTestId('price-plan'), `${r.row} price-plan`).toHaveAttribute('data-value', r.plan);
        await expect.soft(page.getByTestId('price-pay-now'), `${r.row} price-pay-now`).toHaveAttribute('data-value', r.now);
        await expect.soft(page.getByTestId('price-due-at-field'), `${r.row} price-due-at-field`).toHaveAttribute('data-value', r.due);
      });
    }
  });
});

test.describe('PAY v2', () => {
  test('TC-PAY-03 กดยืนยันจ่าย 2 ครั้งติดกันจริง → Payment 1 แถว', {
    tag: ['@PAY', '@P1'],
    annotation: ann({
      tc: 'TC-PAY-03', level: 'P1', source: '[R] จ่ายซ้ำต้องไม่เก็บเงิน 2 ครั้ง · FR-06, BR-10 · [E sql:payments_of]',
      expected: 'จอง พฤ B 19:00 × 1 (฿1,200 มัดจำ ฿600) · คลิก pay-confirm 2 ครั้งติดกัน → [E sql:payments_of] = 1 แถว PROMPTPAY ฿600 · amount-paid 600 · due-at-field 600 · CONFIRMED',
    }),
  }, async ({ page, pick, b }) => {
    // Chromium ใช้ พฤ 22 ต.ค. (พฤ 15 B 19 ใช้ใน TC-BOOK-09 ที่รันพร้อมกัน) ราคา/แผนเดียวกับ TEST-CASES: พฤ B ≥ 17:00 ฿1,200 มัดจำ 50%
    const date = '2026-10-22';
    const hour = pick([19, 20, 18] as const);
    let code = '';
    await test.step(`ช่อง B ${date} ${hour}:00 ยังว่าง · จองผ่านฟอร์มจนถึง /pay`, async () => {
      expectFree('B', date, hour, hour + 1);
      await open(page, `/book/new?field=B&date=${date}&start=${hour}`);
      await fillBookingForm(page, { name: 'ทีมจ่ายซ้ำ', phone: uniquePhone(b), consent: true });
      await priceReady(page);
      await page.getByTestId('book-submit').click();
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
      code = page.url().match(/LN-\d{6}/)![0];
      await waitReady(page);
      await expect.soft(page.getByTestId('pay-now-amount')).toHaveAttribute('data-value', '600');
    });
    await test.step('คลิก pay-confirm 2 ครั้งติดกัน (เมาส์จริง)', async () => {
      await clickTwice(page, 'pay-confirm');
      await expect(page).toHaveURL(new RegExp(`/booking/${code}`));
      await waitReady(page);
      await page.waitForTimeout(1500);
    });
    await test.step('[E sql:payments_of] 1 แถว PROMPTPAY ฿600 · หน้าการจอง CONFIRMED จ่ายแล้ว 600 ค้าง 600', async () => {
      const rows = sql(`select p.method || ':' || p.amount from payments p join bookings b on b.id=p.booking_id where b.code='${code}' order by p.id`);
      expect(rows.split('\n').filter(Boolean), 'Payment ของการจองนี้').toEqual(['PROMPTPAY:600']);
      await open(page, `/booking/${code}`);
      await expect.soft(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
      await expect.soft(page.getByTestId('amount-paid')).toHaveAttribute('data-value', '600');
      await expect.soft(page.getByTestId('due-at-field')).toHaveAttribute('data-value', '600');
      await expect.soft(page.getByTestId('price-total')).toHaveAttribute('data-value', '1200');
    });
  });
});

test.describe('CANCEL v2', () => {
  test('TC-CANCEL-10 เลื่อนไปช่วงถูกลง: เครดิตส่วนต่าง และยอดเก็บหน้าสนาม', {
    tag: ['@CANCEL', '@P2'],
    annotation: ann({
      tc: 'TC-CANCEL-10', level: 'P2', source: '[D] BR-25 (เครดิต ฿400) · ยอดเก็บหน้าสนาม [D A-50] (= ยอดใหม่ − ที่จ่ายสุทธิ)',
      expected: 'จองวันธรรมดา ≥ 17:00 ฿1,200 จ่าย ฿600 → เลื่อนไปก่อน 17:00 (฿800): "เลื่อนการจองแล้ว ได้รับส่วนต่างเป็นเครดิต ฿400" · price-total 800 · due-at-field 600 [D A-50: ฿800 − (฿600 − ฿400)] · /my credit-balance 400 รายการ RESCHEDULE +400',
    }),
  }, async ({ page, pick, b }) => {
    // Chromium = A พ 14 ต.ค. (B พ 14 ช่วงเย็นใช้ใน TEAM/CHAT ที่รันพร้อมกัน) ราคาเหมือน TEST-CASES: ฿1,200 → ฿800
    const [field, date, from, to] = pick([['A', '2026-10-14', 17, 10], ['A', '2026-10-14', 18, 11], ['B', '2026-10-20', 18, 14]] as const);
    const phone = uniquePhone(b);
    let code = '';
    await test.step(`สมาชิกใหม่จอง ${field} ${date} ${from}:00 × 1 (฿1,200) จ่าย ฿600`, async () => {
      expectFree(field, date, from, from + 1);
      expectFree(field, date, to, to + 1);
      await registerCustomer(page.request, { name: 'ทีมเลื่อนถูกลง', phone });
      const bk = await createBooking(page.request, { fieldId: field, date, startHour: from, phone, name: 'ทีมเลื่อนถูกลง' });
      code = bk.code;
      expect(bk.totalPrice ?? 1200).toBe(1200);
      const paid = await payBooking(page.request, code);
      expect(paid.amount).toBe(600);
    });
    await test.step(`เลื่อนไป ${to}:00 (฿800) บนหน้าการจอง`, async () => {
      await open(page, `/booking/${code}`);
      await page.getByTestId('reschedule-date').fill(date);
      await page.getByTestId('reschedule-start').selectOption(String(to));
      await page.getByTestId('reschedule-submit').click();
      await expectSuccess(page, 'เลื่อนการจองแล้ว ได้รับส่วนต่างเป็นเครดิต ฿400');
    });
    await test.step('รีโหลด: ยอดรวม 800 · เก็บหน้าสนาม 600 (A-50) · เวลาใหม่', async () => {
      await open(page, `/booking/${code}`);
      await expect.soft(page.getByTestId('booking-time')).toContainText(`${String(to).padStart(2, '0')}:00`);
      await expect.soft(page.getByTestId('price-total')).toHaveAttribute('data-value', '800');
      await expect.soft(page.getByTestId('due-at-field'), 'ค้างหน้าสนาม = ฿800 − (฿600 − ฿400) = ฿600 [D A-50]').toHaveAttribute('data-value', '600');
    });
    await test.step('/my เครดิต 400 และรายการ RESCHEDULE +400', async () => {
      await open(page, '/my');
      await expect.soft(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '400');
      await expect.soft(page.getByTestId('credit-history').locator('[data-reason="RESCHEDULE"]').first()).toHaveAttribute('data-value', /^\+?400$/);
    });
  });
});

test.describe('CREDIT v2', () => {
  test('TC-CREDIT-04 แนน (ขาจร) ขอใช้เครดิต → MEMBER_REQUIRED · จองด้วยเบอร์เดิมเป็นลูกค้าคนเดิม', {
    tag: ['@CREDIT', '@P1'],
    annotation: ann({
      tc: 'TC-CREDIT-04', level: 'P1', source: '[D] TEST-DATA E59, E99, A-17 · BR-15, BR-26 · [E sql:customer_of]',
      expected: 'ฟอร์มไม่มี use-credit · API quote useCredit:true → 401 MEMBER_REQUIRED "ต้องเข้าสู่ระบบสมาชิกก่อน" ไม่มีการจองใหม่ · จองปกติด้วยเบอร์แนน → [E sql:customer_of] customerId เดียวกับ LN-900004',
    }),
  }, async ({ page, pick, anonApi }) => {
    const date = '2026-10-14';
    const hour = pick([9, 12, 13] as const); // Chromium = A พ 14 09:00 ตาม TEST-CASES
    const anon = await anonApi();
    const q = { fieldId: 'A', date, startHour: hour, hours: 1 };
    await test.step(`ฟอร์ม A ${date} ${hour}:00 ใส่เบอร์แนน → ไม่มีช่อง use-credit`, async () => {
      expectFree('A', date, hour, hour + 1);
      await open(page, `/book/new?field=A&date=${date}&start=${hour}`);
      await fillBookingForm(page, { name: SEED.nan.name, phone: SEED.nan.phone });
      await priceReady(page);
      await expect(page.getByTestId('use-credit')).toHaveCount(0);
    });
    await test.step('API quote / bookings ส่ง useCredit → 401 MEMBER_REQUIRED · ไม่มีการจองใหม่', async () => {
      const before = countSlot('A', date, hour);
      const r1 = await postJson(anon, '/api/quote', { ...q, useCredit: true, creditUsed: 100 });
      expect.soft(r1.status).toBe(401);
      expect.soft(r1.body?.error?.code).toBe('MEMBER_REQUIRED');
      expect.soft(r1.body?.error?.message).toBe('ต้องเข้าสู่ระบบสมาชิกก่อน');
      const r2 = await postJson(anon, '/api/bookings', { ...q, useCredit: true, creditUsed: 100, name: SEED.nan.name, phone: SEED.nan.phone, consent: true });
      expect.soft(r2.status).toBe(401);
      expect.soft(r2.body?.error?.code).toBe('MEMBER_REQUIRED');
      expect(countSlot('A', date, hour), 'การจองใหม่ต้องเป็น 0').toBe(before);
    });
    await test.step('จองปกติด้วยเบอร์แนน → [E sql:customer_of] ลูกค้าคนเดิมของ LN-900004', async () => {
      const bk = await createBooking(anon, { fieldId: 'A', date, startHour: hour, phone: SEED.nan.phone, name: SEED.nan.name });
      const ids = sql(`select distinct customer_id from bookings where code in ('LN-900004','${bk.code}')`).split('\n').filter(Boolean);
      expect(ids, 'customer_id ของ LN-900004 กับการจองใหม่').toHaveLength(1);
    });
  });
});

test.describe('SERIES v2', () => {
  test('TC-SERIES-05 จองประจำ E77 + สัปดาห์ที่ตรงวันหยุด (10, 31 ธ.ค. / 5 ธ.ค.)', {
    tag: ['@SERIES', '@P1'],
    annotation: ann({
      tc: 'TC-SERIES-05', level: 'P1', source: '[D] TEST-DATA E77, วันหยุดข้อ 3 · BR-08, BR-11, BR-19, BR-20',
      expected: 'E77 A ศ 17:00 4 สัปดาห์: series-total-price 4,800 series-discount-percent 0 series-pay-now 4,800 · C พฤ 10:00 12 สัปดาห์: series-field-price 15,600 ส่วนลด 1,560 รวม 14,040 จ่าย 7,020 · B ส 09:00 8 สัปดาห์: ค่าสนาม 9,600 ส่วนลด 960 รวม 8,640 จ่าย 4,320',
    }),
  }, async ({ page, b }) => {
    const sets = [
      { label: 'E77 A ศ 16 ต.ค. 17:00 × 4 สัปดาห์', field: 'A', startDate: '2026-10-16', start: 17, weeks: 4, fieldPrice: 4800, pct: 0, disc: 0, total: 4800, now: 4800 },
      { label: 'C พฤ 15 ต.ค. 10:00 × 12 สัปดาห์ (10, 31 ธ.ค. วันหยุด)', field: 'C', startDate: '2026-10-15', start: 10, weeks: 12, fieldPrice: 15600, pct: 10, disc: 1560, total: 14040, now: 7020 },
      { label: 'B ส 17 ต.ค. 09:00 × 8 สัปดาห์ (5 ธ.ค. วันหยุดซ้อนเสาร์)', field: 'B', startDate: '2026-10-17', start: 9, weeks: 8, fieldPrice: 9600, pct: 10, disc: 960, total: 8640, now: 4320 },
    ];
    await test.step('สมัครสมาชิกใหม่ เปิด /series', async () => {
      await registerCustomer(page.request, { name: 'สมาชิกประจำ v2', phone: uniquePhone(b) });
      await open(page, '/series');
      await expect(page.getByTestId('series-preview')).toBeVisible();
    });
    for (const s of sets) {
      await test.step(`${s.label} → ค่าสนาม ${s.fieldPrice} ลด ${s.pct}% (${s.disc}) รวม ${s.total} จ่าย ${s.now}`, async () => {
        await page.getByTestId('series-field').selectOption(s.field);
        await page.getByTestId('series-start-date').fill(s.startDate);
        await page.getByTestId('series-start').selectOption(String(s.start));
        await page.getByTestId('series-hours').fill('1');
        await page.getByTestId('series-weeks').fill(String(s.weeks));
        await page.getByTestId('series-preview').click();
        await expect(page.getByTestId('series-weeks-booked')).toHaveAttribute('data-value', String(s.weeks));
        await waitReady(page);
        await softNum(page.getByTestId('series-field-price'), s.fieldPrice, 'series-field-price');
        await softNum(page.getByTestId('series-discount-percent'), s.pct, 'series-discount-percent');
        await softNum(page.getByTestId('series-discount'), s.disc, 'series-discount');
        await softNum(page.getByTestId('series-total-price'), s.total, 'series-total-price');
        await softNum(page.getByTestId('series-pay-now'), s.now, 'series-pay-now');
      });
    }
  });
});

test.describe('MEMBER v2', () => {
  test('TC-MEMBER-06 ชั่วโมงสะสมของลูกค้าใน TEST-DATA: ต้น 7 · ฟ้า 9 · มิว 10', {
    tag: ['@MEMBER', '@P1'],
    annotation: ann({
      tc: 'TC-MEMBER-06', level: 'P1', source: '[D] TEST-DATA E85, E86, E89 · BR-23',
      expected: 'ต้น paid-hours 7 free-hours-available 0 free-hours-next 3 · ฟ้า 9 / 0 / 1 · มิว 10 / 1 / 10 · รีโหลดแล้วเท่าเดิม',
    }),
  }, async ({ page }) => {
    const people = [
      { who: 'ต้น', phone: SEED.ton.phone, pw: SEED.ton.password, hours: '7', avail: '0', next: '3' },
      { who: 'ฟ้า', phone: '0855555555', pw: 'Fah12345', hours: '9', avail: '0', next: '1' },
      { who: 'มิว', phone: SEED.mew.phone, pw: SEED.mew.password, hours: '10', avail: '1', next: '10' },
    ];
    for (const p of people) {
      await test.step(`${p.who} เข้าสู่ระบบ /my → ${p.hours} / ${p.avail} / ${p.next} (และหลังรีโหลด)`, async () => {
        await memberLoginUi(page, p.phone, p.pw);
        for (const round of ['ครั้งแรก', 'หลังรีโหลด']) {
          if (round === 'หลังรีโหลด') { await page.reload(); await waitReady(page); }
          await expect.soft(page.getByTestId('paid-hours'), `${p.who} paid-hours ${round}`).toHaveAttribute('data-value', p.hours);
          await expect.soft(page.getByTestId('free-hours-available'), `${p.who} free-hours-available ${round}`).toHaveAttribute('data-value', p.avail);
          await expect.soft(page.getByTestId('free-hours-next'), `${p.who} free-hours-next ${round}`).toHaveAttribute('data-value', p.next);
        }
        await page.getByTestId('logout').click();
        await expect(page.getByTestId('login-phone')).toBeVisible();
      });
    }
  });

  test('TC-MEMBER-07 บีม (ถูกระงับถึง 6 พ.ย. 19:15) เห็นประกาศระงับ และจองออนไลน์ไม่ได้', {
    tag: ['@MEMBER', '@P1'],
    annotation: ann({
      tc: 'TC-MEMBER-07', level: 'P1', source: '[D] TEST-DATA E63, 2.2 บีม · BR-16',
      expected: '/my banned-notice มี "6 พ.ย. 2026 19:15" banned-until data-value 2026-11-06T12:15:00.000Z · ฟอร์มจองด้วยเบอร์บีม → "เบอร์นี้ถูกระงับการจองออนไลน์ จองได้อีกครั้ง 6 พ.ย. 2026 19:15" ไม่สร้างการจอง',
    }),
  }, async ({ page, pick }) => {
    const beam = { phone: '0866666666', pw: 'Beam12345' };
    // ช่องแยกต่อเบราว์เซอร์ (A พ 14 09:00 ใช้ใน TC-CREDIT-04 ที่รันพร้อมกัน) — ผลไม่ขึ้นกับช่อง
    const hour = pick([14, 15, 16] as const);
    await test.step('บีมเข้าสู่ระบบ /my อ่านประกาศระงับ', async () => {
      await memberLoginUi(page, beam.phone, beam.pw);
      await expect(page.getByTestId('banned-notice')).toBeVisible();
      await expect.soft(page.getByTestId('banned-notice')).toContainText('6 พ.ย. 2026 19:15');
      await expect.soft(page.getByTestId('banned-until')).toHaveAttribute('data-value', '2026-11-06T12:15:00.000Z');
      await page.getByTestId('logout').click();
      await expect(page.getByTestId('login-phone')).toBeVisible();
    });
    await test.step(`ฟอร์ม A พ 14 ${hour}:00 ใส่เบอร์บีม ติ๊ก PDPA กดยืนยัน → ถูกปฏิเสธ ไม่สร้างการจอง`, async () => {
      const before = sqlNum(`select count(*) from bookings b join customers c on c.id=b.customer_id where c.phone='${beam.phone}'`);
      await open(page, `/book/new?field=A&date=2026-10-14&start=${hour}`);
      await fillBookingForm(page, { name: 'บีม', phone: beam.phone, consent: true });
      await waitReady(page);
      await page.getByTestId('book-submit').click();
      await expectError(page, 'เบอร์นี้ถูกระงับการจองออนไลน์ จองได้อีกครั้ง 6 พ.ย. 2026 19:15');
      await expect(page).toHaveURL(/\/book\/new/);
      expect(sqlNum(`select count(*) from bookings b join customers c on c.id=b.customer_id where c.phone='${beam.phone}'`), 'การจองของบีมต้องไม่เพิ่ม').toBe(before);
    });
  });
});

test.describe('STAFF v2', () => {
  test('TC-STAFF-06 เช็กอินการจองที่ยังไม่ถึงวันเตะ → ไม่ได้ (A-45)', {
    tag: ['@STAFF', '@P2'],
    annotation: ann({
      tc: 'TC-STAFF-06', level: 'P2', source: '[D A-45] เช็กอินได้เฉพาะวันเตะ · ชั่วโมงสะสมนับตอนเช็กอิน · [R] CHECKED_IN = "ลูกค้ามาถึง" (04 ตาราง 1.2) · FR-23, BR-23',
      expected: 'วันนี้ ศ 9 · สมาชิกใหม่จอง อ 20 B 10–13 จ่าย · staff กด staff-checkin → ถูกปฏิเสธ (error-message) สถานะยัง CONFIRMED · /my paid-hours ยัง 0 (ไม่เพิ่ม 3)',
    }),
  }, async ({ page, pick, b }) => {
    const [field, date] = pick([['B', '2026-10-20'], ['A', '2026-10-20'], ['A', '2026-10-19']] as const); // Chromium = B อ 20 ตาม TEST-CASES
    const phone = uniquePhone(b);
    let code = '';
    await test.step(`สมาชิกใหม่จอง ${field} ${date} 10:00–13:00 แล้วจ่าย`, async () => {
      expectFree(field, date, 10, 13);
      await registerCustomer(page.request, { name: 'สมาชิกมาก่อนวัน', phone });
      code = (await createBooking(page.request, { fieldId: field, date, startHour: 10, hours: 3, phone, name: 'สมาชิกมาก่อนวัน' })).code;
      await payBooking(page.request, code);
    });
    await test.step('staff ค้นรหัสแล้วกด staff-checkin (วันนี้ยังไม่ถึงวันเตะ) → ถูกปฏิเสธ', async () => {
      await staffLoginPage(page, 'staff');
      await open(page, '/staff');
      await page.getByTestId('staff-search-code').fill(code);
      await page.getByTestId('staff-search-submit').click();
      await expect(page.getByTestId('staff-booking-code')).toHaveText(code);
      await page.getByTestId('staff-checkin').click();
      const res = await outcome(page);
      expect.soft(res.kind, `ผลการกดเช็กอินก่อนวันเตะ: "${res.text}"`).toBe('error');
      await expect.soft(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
    });
    await test.step('สมาชิกเปิด /my → paid-hours ยัง 0', async () => {
      await open(page, '/my');
      await expect.soft(page.getByTestId('paid-hours'), 'ชั่วโมงสะสมก่อนวันเตะ').toHaveAttribute('data-value', '0');
      expect(sql(`select status from bookings where code='${code}'`), 'สถานะในฐานข้อมูล').toBe('CONFIRMED');
    });
  });
});

test.describe('MOB v2', () => {
  test('TC-MOB-02 แชทบนจอ 375 px ใช้ได้ ไม่มีแถบเลื่อนแนวนอน', {
    tag: ['@MOB', '@P3'],
    annotation: ann({
      tc: 'TC-MOB-02', level: 'P3', source: '[D] NFR-01 · FR-32',
      expected: '375 × 812 เปิด /book กด chat-open ส่ง "เปิดกี่โมงครับ" ได้คำตอบมี 08:00 · scrollWidth ≤ 375 (ก่อนและหลังเปิดแชท)',
    }),
  }, async ({ page, b }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `10.${60 + b}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
    const sw = () => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
    await test.step('เปิด /book ที่ 375 px', async () => {
      await open(page, '/book');
      expect.soft(await sw(), 'scrollWidth ก่อนเปิดแชท').toBeLessThanOrEqual(375);
    });
    await test.step('กด chat-open ส่ง "เปิดกี่โมงครับ" → คำตอบมี 08:00', async () => {
      await page.getByTestId('chat-open').click();
      await expect(page.getByTestId('chat-panel')).toBeVisible();
      const bots = page.getByTestId('chat-msg-bot');
      const before = await bots.count();
      await page.getByTestId('chat-input').fill('เปิดกี่โมงครับ');
      await page.getByTestId('chat-send').click();
      await expect(bots).toHaveCount(before + 1, { timeout: 60_000 });
      await expect(bots.last()).toContainText('08:00');
    });
    await test.step('scrollWidth ≤ 375 ขณะแชทเปิดอยู่ และช่องพิมพ์/ปุ่มส่งอยู่ในจอ', async () => {
      expect.soft(await sw(), 'scrollWidth หลังเปิดแชท').toBeLessThanOrEqual(375);
      for (const id of ['chat-input', 'chat-send']) {
        const box = await page.getByTestId(id).boundingBox();
        expect.soft(box && box.x >= 0 && box.x + box.width <= 375, `${id} อยู่ในความกว้าง 375 px`).toBeTruthy();
      }
    });
  });
});

test.describe('ROLE', () => {
  test('TC-ROLE-01 สิทธิ์หลังบ้านตามบทบาท (BR-44) + E143', {
    tag: ['@ROLE', '@P1'],
    annotation: ann({
      tc: 'TC-ROLE-01', level: 'P1', source: '[D] BR-44, TEST-DATA E143, A-33 · FR-31, BR-39',
      expected: 'MANAGER: /owner/dashboard /owner/bookings /owner/chats เปิดได้ · /owner/reports (E143) และ /owner/audit → forbidden-message · แท็บไม่มี tab-reports/tab-audit · STAFF: /owner/dashboard /owner/bookings /owner/chats → forbidden · API ตรงกัน 403 FORBIDDEN_ROLE',
    }),
  }, async ({ page, staffApi }) => {
    await test.step('MANAGER เปิด 3 หน้าได้ · ไม่มีแท็บรายงาน/บันทึกการกระทำ', async () => {
      await staffLoginPage(page, 'manager');
      for (const p of ['/owner/dashboard', '/owner/bookings', '/owner/chats']) {
        await open(page, p);
        await expect.soft(page.getByTestId('forbidden-message'), `MANAGER ${p}`).toHaveCount(0);
        await expect.soft(page, `MANAGER ${p} ไม่ถูกส่งไปหน้าเข้าสู่ระบบ`).toHaveURL(new RegExp(p.replace(/\//g, '\\/')));
      }
      await open(page, '/owner/dashboard');
      await expect.soft(page.getByTestId('dash-today-total')).toBeVisible();
      await expect.soft(page.getByTestId('tab-dashboard')).toBeVisible();
      await expect.soft(page.getByTestId('tab-reports')).toHaveCount(0);
      await expect.soft(page.getByTestId('tab-audit')).toHaveCount(0);
    });
    await test.step('MANAGER เปิด /owner/reports (E143) และ /owner/audit → forbidden', async () => {
      for (const p of ['/owner/reports', '/owner/audit']) {
        await open(page, p);
        await expect.soft(page.getByTestId('forbidden-message'), `MANAGER ${p}`).toBeVisible();
      }
      await expect.soft(page.getByTestId('report-submit')).toHaveCount(0);
    });
    await test.step('STAFF เปิด 3 หน้าหลังบ้าน → forbidden', async () => {
      await staffLoginPage(page, 'staff');
      for (const p of ['/owner/dashboard', '/owner/bookings', '/owner/chats']) {
        await open(page, p);
        await expect.soft(page.getByTestId('forbidden-message'), `STAFF ${p}`).toBeVisible();
      }
      await expect.soft(page.getByTestId('dash-today-total')).toHaveCount(0);
    });
    await test.step('API: MANAGER รายงาน/audit → 403 · STAFF dashboard/bookings/chats → 403 FORBIDDEN_ROLE · MANAGER 3 เส้นได้ 200', async () => {
      const m = await staffApi('manager');
      const s = await staffApi('staff');
      for (const [who, ctx, url, want] of [
        ['MANAGER', m, '/api/owner/reports?from=2026-10-03&to=2026-10-09', 403],
        ['MANAGER', m, '/api/owner/reports.csv?from=2026-10-03&to=2026-10-09', 403],
        ['MANAGER', m, '/api/owner/audit', 403],
        ['MANAGER', m, '/api/owner/dashboard', 200],
        ['MANAGER', m, '/api/owner/bookings', 200],
        ['MANAGER', m, '/api/owner/chats', 200],
        ['STAFF', s, '/api/owner/dashboard', 403],
        ['STAFF', s, '/api/owner/bookings', 403],
        ['STAFF', s, '/api/owner/chats', 403],
      ] as const) {
        const r = await getJson(ctx, url);
        expect.soft(r.status, `${who} GET ${url}`).toBe(want);
        if (want === 403) expect.soft(r.body?.error?.code, `${who} GET ${url} code`).toBe('FORBIDDEN_ROLE');
      }
    });
  });

  test('TC-ROLE-03 ออกจากระบบแล้ว cookie เดิมต้องใช้ไม่ได้ (สมาชิก + ร้าน)', {
    tag: ['@ROLE', '@P1'],
    annotation: ann({
      tc: 'TC-ROLE-03', level: 'P1', source: '[R] ออกจากระบบต้องยกเลิก session (OWASP Session Management) · NFR-05, FR-13, FR-31',
      expected: 'หลังกด logout / staff-logout แล้วใช้ cookie เดิมเรียก /api/me → 401 · /api/staff/bookings/LN-900004 → 401',
    }),
  }, async ({ page, b, playwright }) => {
    const phone = uniquePhone(b);
    await test.step('สมาชิกเข้าสู่ระบบผ่านหน้าเว็บ เก็บ cookie แล้วกด logout', async () => {
      await registerCustomer(page.request, { name: 'สมาชิกออกจากระบบ', phone, password: 'Logout1234' });
      await postJson(page.request, '/api/customers/logout', {});
      await memberLoginUi(page, phone, 'Logout1234');
    });
    const memberCookies = await page.context().cookies();
    await test.step('กด logout บน /my แล้วใช้ cookie เดิมเรียก /api/me → 401', async () => {
      const resp = page.waitForResponse((r) => r.url().includes('/api/customers/logout'));
      await page.getByTestId('logout').click();
      await resp;
      await expect(page.getByTestId('login-phone')).toBeVisible();
      const old = await playwright.request.newContext({ baseURL: BASE_URL, storageState: { cookies: memberCookies, origins: [] } });
      const r = await getJson(old, '/api/me');
      expect.soft(r.status, 'cookie สมาชิกเดิมหลังออกจากระบบ GET /api/me').toBe(401);
      await old.dispose();
    });
    await test.step('staff เข้าสู่ระบบผ่านหน้าเว็บ เก็บ cookie กด staff-logout แล้วใช้ cookie เดิม → 401', async () => {
      await page.context().clearCookies();
      await staffLoginUi(page, 'staff');
      const staffCookies = await page.context().cookies();
      await open(page, '/staff');
      const resp = page.waitForResponse((r) => r.url().includes('/api/staff/logout'));
      await page.getByTestId('staff-logout').click();
      await resp;
      const old = await playwright.request.newContext({ baseURL: BASE_URL, storageState: { cookies: staffCookies, origins: [] } });
      const r = await getJson(old, '/api/staff/bookings/LN-900004');
      expect.soft(r.status, 'cookie ร้านเดิมหลังออกจากระบบ GET /api/staff/bookings/LN-900004').toBe(401);
      await old.dispose();
    });
  });

  test('TC-ROLE-04 ไม่เข้าสู่ระบบเปิดหน้าหลังบ้าน v2 → ไปหน้าเข้าสู่ระบบ', {
    tag: ['@ROLE', '@P2'],
    annotation: ann({
      tc: 'TC-ROLE-04', level: 'P2', source: '[D] NFR-05 · FR-31',
      expected: '/owner/dashboard, /owner/reports, /owner/audit, /owner/chats, /staff/stock, /manager/stock → /staff/login?next=<path> + login-required · API → 401',
    }),
  }, async ({ page, anonApi }) => {
    for (const p of ['/owner/dashboard', '/owner/reports', '/owner/audit', '/owner/chats', '/staff/stock', '/manager/stock']) {
      await test.step(`ไม่มี cookie เปิด ${p} → /staff/login?next=${encodeURIComponent(p)}`, async () => {
        await open(page, p);
        await expect.soft(page).toHaveURL(new RegExp(`/staff/login\\?next=${encodeURIComponent(p).replace(/%/g, '%')}`));
        await expect.soft(page.getByTestId('login-required')).toBeVisible();
      });
    }
    await test.step('API ไม่มี cookie → 401', async () => {
      const anon = await anonApi();
      for (const url of ['/api/owner/dashboard', '/api/owner/reports?from=2026-10-03&to=2026-10-09', '/api/owner/audit', '/api/owner/chats', '/api/staff/stock', '/api/manager/stock/alerts']) {
        const r = await getJson(anon, url);
        expect.soft(r.status, `GET ${url}`).toBe(401);
      }
    });
  });
});

