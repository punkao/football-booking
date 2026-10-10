import { test, expect, open, waitReady, uniquePhone, createBooking, payBooking, getBooking, getJson, expectError, expectSuccess, fillBookingForm } from './fixtures';
import { TODAY } from './constants';

test.describe('BOOK', () => {
  test('TC-BOOK-01 E2E จองจนจ่ายจบผ่านหน้าเว็บ', {
    tag: ['@BOOK', '@P1'],
    annotation: { type: 'expected', description: 'แตะช่องว่าง → ฟอร์ม (PDPA ไม่ติ๊ก) → 2 ชม. ราคา 2,400 มัดจำ 50% จ่ายตอนนี้ 1,200 เก็บหน้าสนาม 1,200 → /pay/LN-xxxxxx จ่าย 1,200 → /booking/{code}?done=paid "ชำระเงินสำเร็จ การจองได้รับการยืนยันแล้ว" CONFIRMED จ่ายแล้ว 1,200 ค้าง 1,200 · consentAt ถูกบันทึก · ช่องเป็น booked' },
  }, async ({ page, pick, b, consoleErrors }) => {
    const [date, field] = pick([['2026-10-12', 'A'], ['2026-10-12', 'B'], ['2026-10-19', 'A']] as const);
    const phone = uniquePhone(b);
    let code = '';
    await test.step(`เปิดตารางว่าง ${date} แล้วแตะช่อง ${field} 19:00`, async () => {
      await open(page, `/book?date=${date}`);
      const slot = page.getByTestId(`slot-${field}-19`);
      await expect(slot).toHaveAttribute('data-status', 'free');
      await slot.click();
      await expect(page).toHaveURL(new RegExp(`/book/new\\?.*field=${field}`));
      await waitReady(page);
    });
    await test.step('ช่อง PDPA ไม่ติ๊กไว้ก่อน · เลือก 2 ชั่วโมง ราคาแยกบรรทัดถูกต้อง', async () => {
      await expect(page.getByTestId('pdpa-consent')).not.toBeChecked();
      await expect(page.getByTestId('book-start')).toHaveValue('19');
      await fillBookingForm(page, { hours: 2 });
      await expect(page.getByTestId('price-hour-19')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('price-hour-20')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '2400');
      await expect(page.getByTestId('price-plan')).toHaveAttribute('data-value', 'DEPOSIT_50');
      await expect(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('price-due-at-field')).toHaveAttribute('data-value', '1200');
    });
    await test.step('กรอกชื่อ เบอร์ ติ๊กยินยอม แล้วกดยืนยันการจอง → หน้าจ่าย', async () => {
      await fillBookingForm(page, { name: 'ทีม E2E', phone, consent: true });
      await page.getByTestId('book-submit').click();
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
      await waitReady(page);
      code = page.url().split('/pay/')[1];
      await expect(page.getByTestId('booking-code')).toHaveText(code);
      await expect(page.getByTestId('pay-qr')).toBeVisible();
      await expect(page.getByTestId('pay-now-amount')).toHaveAttribute('data-value', '1200');
    });
    await test.step('กดยืนยันการจ่าย → หน้าการจองสถานะ CONFIRMED', async () => {
      await page.getByTestId('pay-confirm').click();
      await expect(page).toHaveURL(new RegExp(`/booking/${code}\\?done=paid`));
      await waitReady(page);
      await expectSuccess(page, 'ชำระเงินสำเร็จ การจองได้รับการยืนยันแล้ว');
      await expect(page.getByTestId('booking-code')).toHaveText(code);
      await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '2400');
      await expect(page.getByTestId('amount-paid')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('due-at-field')).toHaveAttribute('data-value', '1200');
    });
    await test.step('บันทึกเวลายินยอม PDPA (consentAt) และช่องในตารางกลายเป็น booked', async () => {
      const r = await getBooking(page.request, code);
      expect(r.status).toBe(200);
      expect(r.body.booking.consentAt, 'consentAt ต้องถูกบันทึก').toBeTruthy();
      await open(page, `/book?date=${date}`);
      await expect(page.getByTestId(`slot-${field}-19`)).toHaveAttribute('data-status', 'booked');
      await expect(page.getByTestId(`slot-${field}-20`)).toHaveAttribute('data-status', 'booked');
    });
    expect(consoleErrors, 'console error ในหน้า').toEqual([]);
  });

  // TC-BOOK-02 (BR-02 + NFR-08) ย้ายไป tests/book.perf.spec.ts — รันใน project perf-* ทีละข้อ ไม่มี test อื่นรันพร้อมกัน (NFR-08 นิยามใหม่, Q-T6)

  test('TC-BOOK-03 จำนวนชั่วโมงและเวลาจบไม่เกิน 24:00', {
    tag: ['@BOOK', '@P1'],
    annotation: { type: 'expected', description: '21:00 × 4 → "การจองต้องจบไม่เกิน 24:00" · 0 ชม. → "จำนวนชั่วโมงต้องเป็นจำนวนเต็มอย่างน้อย 1 ชั่วโมง" · 20:00 × 4 (จบ 24:00) ราคา 4,800 จองได้ → /pay' },
  }, async ({ page, pick, b }) => {
    const [date, field] = pick([['2026-10-22', 'A'], ['2026-10-22', 'B'], ['2026-10-20', 'B']] as const);
    const phone = uniquePhone(b);
    await test.step(`${field} ${date} เริ่ม 21:00 × 4 ชม. (จบ 01:00) → ปฏิเสธ`, async () => {
      await open(page, `/book/new?field=${field}&date=${date}&start=21`);
      await fillBookingForm(page, { hours: 4, name: 'ทีมเที่ยงคืน', phone, consent: true });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'การจองต้องจบไม่เกิน 24:00');
      await expect(page).toHaveURL(/\/book\/new/);
    });
    await test.step('0 ชั่วโมง (= 1 − 1) → ปฏิเสธ', async () => {
      await fillBookingForm(page, { hours: 0 });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'จำนวนชั่วโมงต้องเป็นจำนวนเต็มอย่างน้อย 1 ชั่วโมง');
      await expect(page).toHaveURL(/\/book\/new/);
    });
    await test.step('เริ่ม 20:00 × 4 ชม. (จบ 24:00 พอดี) → ราคา 4,800 และจองได้', async () => {
      await page.getByTestId('book-start').selectOption('20');
      await fillBookingForm(page, { hours: 4 });
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '4800');
      await page.getByTestId('book-submit').click();
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
    });
  });

  test('TC-BOOK-04 จองล่วงหน้าได้ไม่เกิน 14 วัน (23 ต.ค. ได้ / 24 ต.ค. ไม่ได้)', {
    tag: ['@BOOK', '@P1'],
    annotation: { type: 'expected', description: 'มี date-chip-2026-10-23 ไม่มี date-chip-2026-10-24 · /book?date=2026-10-24 ช่อง out-of-range · ฟอร์ม 24 ต.ค. → "จองล่วงหน้าได้ไม่เกิน 14 วัน" · 23 ต.ค. (= 9 + 14) จองสำเร็จ → /pay' },
  }, async ({ page, pick, b }) => {
    const hour = pick([9, 10, 11] as const);
    const phone = uniquePhone(b);
    await test.step('ปุ่มวันมีถึง 23 ต.ค. (วันนี้ + 14) ไม่มี 24 ต.ค.', async () => {
      await open(page, '/book');
      await expect(page.getByTestId(`date-chip-${TODAY}`)).toBeVisible();
      await expect(page.getByTestId('date-chip-2026-10-23')).toBeVisible();
      await expect(page.getByTestId('date-chip-2026-10-24')).toHaveCount(0);
    });
    await test.step('ตารางวันที่ 24 ต.ค. (= 9 + 15) ทุกช่องเป็น out-of-range', async () => {
      await open(page, '/book?date=2026-10-24');
      await expect(page.getByTestId('slot-A-9')).toHaveAttribute('data-status', 'out-of-range');
      await expect(page.getByTestId('slot-C-23')).toHaveAttribute('data-status', 'out-of-range');
    });
    await test.step('ฟอร์มจองวันที่ 24 ต.ค. → ปฏิเสธ', async () => {
      await open(page, `/book/new?field=A&date=2026-10-24&start=${hour}`);
      await fillBookingForm(page, { name: 'ทีมล่วงหน้า', phone, consent: true });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'จองล่วงหน้าได้ไม่เกิน 14 วัน');
      await expect(page).toHaveURL(/\/book\/new/);
    });
    await test.step(`ฟอร์มจองวันที่ 23 ต.ค. A ${hour}:00 → จองได้`, async () => {
      await open(page, `/book/new?field=A&date=2026-10-23&start=${hour}`);
      await fillBookingForm(page, { name: 'ทีมล่วงหน้า', phone, consent: true });
      await page.getByTestId('book-submit').click();
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
    });
  });

  test('TC-BOOK-06 ห้ามจองทับเวลาในสนามเดียวกัน', {
    tag: ['@BOOK', '@P1'],
    annotation: { type: 'expected', description: 'A มีการจอง 2 ชม. แล้ว: A เริ่มชั่วโมงที่ 2 (ทับ 1 ชม.) → "ช่วงเวลานี้ถูกจองแล้ว" · A เริ่มต่อท้ายพอดี → จองได้ · B เวลาเดียวกัน → จองได้' },
  }, async ({ page, pick, b }) => {
    const base = pick([19, 12, 8] as const);
    const date = '2026-10-15';
    const phone = uniquePhone(b);
    await test.step(`มีการจอง A ${base}:00–${base + 2}:00 (จ่ายแล้ว)`, async () => {
      const bk = await createBooking(page.request, { fieldId: 'A', date, startHour: base, hours: 2, phone, name: 'ทีมจองก่อน' });
      await payBooking(page.request, bk.code);
    });
    await test.step(`A เริ่ม ${base + 1}:00 (ทับ 1 ชม.) → "ช่วงเวลานี้ถูกจองแล้ว"`, async () => {
      await open(page, `/book/new?field=A&date=${date}&start=${base + 1}`);
      await fillBookingForm(page, { name: 'ทีมทับ', phone: uniquePhone(b), consent: true });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'ช่วงเวลานี้ถูกจองแล้ว');
      await expect(page).toHaveURL(/\/book\/new/);
    });
    await test.step(`A เริ่ม ${base + 2}:00 (ต่อท้ายพอดี) → จองได้`, async () => {
      await open(page, `/book/new?field=A&date=${date}&start=${base + 2}`);
      await fillBookingForm(page, { name: 'ทีมต่อท้าย', phone: uniquePhone(b), consent: true });
      await page.getByTestId('book-submit').click();
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
    });
    await test.step(`B เริ่ม ${base}:00 (คนละสนาม) → จองได้`, async () => {
      await open(page, `/book/new?field=B&date=${date}&start=${base}`);
      await fillBookingForm(page, { name: 'ทีมสนามข้าง', phone: uniquePhone(b), consent: true });
      await page.getByTestId('book-submit').click();
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
    });
  });

  test('TC-BOOK-07 ฟอร์มลูกค้า: ชื่อ เบอร์ และช่องยินยอม PDPA', {
    tag: ['@BOOK', '@P2'],
    annotation: { type: 'expected', description: 'pdpa-consent ไม่ติ๊กตอนเปิด · ไม่กรอกชื่อ → "กรุณากรอกชื่อ" · เบอร์ 08123 → "เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0" · ไม่ติ๊ก → "กรุณายินยอมให้เก็บข้อมูลส่วนบุคคล (PDPA) ก่อนดำเนินการ" · ไม่มีการจองถูกสร้าง' },
  }, async ({ page, pick, b, consoleErrors }) => {
    const hour = pick([14, 15, 16] as const);
    const date = '2026-10-15';
    await test.step('เปิดฟอร์ม ช่องยินยอมต้องไม่ติ๊กไว้ก่อน', async () => {
      await open(page, `/book/new?field=C&date=${date}&start=${hour}`);
      await expect(page.getByTestId('pdpa-consent')).not.toBeChecked();
    });
    await test.step('ไม่กรอกชื่อ → "กรุณากรอกชื่อ"', async () => {
      await fillBookingForm(page, { name: '', phone: uniquePhone(b), consent: true });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'กรุณากรอกชื่อ');
    });
    await test.step('เบอร์ 08123 → "เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0"', async () => {
      await fillBookingForm(page, { name: 'ทีมฟอร์ม', phone: '08123' });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0');
    });
    await test.step('ไม่ติ๊กยินยอม → ข้อความ PDPA', async () => {
      await fillBookingForm(page, { phone: uniquePhone(b), consent: false });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'กรุณายินยอมให้เก็บข้อมูลส่วนบุคคล (PDPA) ก่อนดำเนินการ');
      await expect(page).toHaveURL(/\/book\/new/);
    });
    await test.step('ไม่มีการจองถูกสร้าง: ช่องยังว่าง', async () => {
      const r = await getJson(page.request, `/api/availability?date=${date}`);
      const slot = (r.body.slots as any[]).find((s) => s.fieldId === 'C' && s.hour === hour);
      expect(slot.status).toBe('free');
    });
    expect(consoleErrors, 'console error อื่นนอกจาก 4xx ที่ตั้งใจ').toEqual([]);
  });

  test('TC-BOOK-08 กรองรอบก่อน 17:00 และเรียงราคาถูกไปแพง', {
    tag: ['@BOOK', '@P3'],
    annotation: { type: 'expected', description: 'ติ๊ก filter-before-17 → ไม่มีช่อง 17:00–23:00 แต่มี 16:00 · sort-by=price → slot-list ราคาไม่ลดลง เริ่ม 800 จบ 1,800' },
  }, async ({ page }) => {
    await test.step('เปิด /book?date=2026-10-12 แล้วติ๊กเฉพาะรอบก่อน 17:00', async () => {
      await open(page, '/book?date=2026-10-12');
      await page.getByTestId('filter-before-17').check();
      await expect(page.getByTestId('slot-A-16')).toBeVisible();
      for (const f of ['A', 'B', 'C']) for (let h = 17; h <= 23; h++) await expect(page.getByTestId(`slot-${f}-${h}`)).toHaveCount(0);
    });
    await test.step('ยกเลิกกรอง แล้วเรียงตามราคา', async () => {
      await page.getByTestId('filter-before-17').uncheck();
      await page.getByTestId('sort-by').selectOption('price');
      await expect(page.getByTestId('slot-list')).toBeVisible();
      const prices = await page.getByTestId('slot-list').locator('[data-price]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-price'))));
      expect(prices.length).toBeGreaterThan(0);
      const sorted = [...prices].sort((x, y) => x - y);
      expect(prices).toEqual(sorted);
      expect(prices[0]).toBe(800);
      expect(prices[prices.length - 1]).toBe(1800);
    });
  });
});
