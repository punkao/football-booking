import { test, expect, open, uniquePhone, createBooking, payBooking, staffLoginPage, expectError, expectSuccess, fillBookingForm } from './fixtures';

test.describe('RENT', () => {
  test('TC-RENT-01 ราคาของเช่าและจำนวนคงเหลือ', {
    tag: ['@RENT', '@P1'],
    annotation: { type: 'expected', description: 'อ. 20 ต.ค. B 08:00: เอี๊ยมเหลือ 6 บอลเหลือ 10 · เอี๊ยม 2 + บอล 1 → price-rental 130 (= 50 × 2 + 30) · price-total 930' },
  }, async ({ page }) => {
    await test.step('เปิดฟอร์ม B 08:00 อ. 20 ต.ค. เห็นคงเหลือเต็ม', async () => {
      await open(page, '/book/new?field=B&date=2026-10-20&start=8');
      await expect(page.getByTestId('rental-BIB-remaining')).toHaveAttribute('data-value', '6');
      await expect(page.getByTestId('rental-BALL-remaining')).toHaveAttribute('data-value', '10');
    });
    await test.step('เช่าเอี๊ยม 2 บอล 1 → ค่าของเช่า 130', async () => {
      await page.getByTestId('rental-BIB-qty').fill('2');
      await page.getByTestId('rental-BALL-qty').fill('1');
      await expect(page.getByTestId('price-rental')).toHaveAttribute('data-value', '130');
      await expect(page.getByTestId('price-field')).toHaveAttribute('data-value', '800');
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '930');
    });
  });

  test('TC-RENT-02 เช่าเกินจำนวนไม่ได้ (เอี๊ยมชุดที่ 7, บอลลูกที่ 11)', {
    tag: ['@RENT', '@P2'],
    annotation: { type: 'expected', description: 'จองเอี๊ยม 6 ชุดได้ · อีกสนามเวลาเดียวกัน เอี๊ยมเหลือ 0 ขอ 1 (ชุดที่ 7) → "ของเช่าไม่พอ (เอี๊ยม เหลือ 0)" · บอล 11 ลูก → "ของเช่าไม่พอ (ลูกบอล เหลือ 10)"' },
  }, async ({ page, pick, b }) => {
    const [date, baseField, other] = pick([['2026-10-18', 'B', 'C'], ['2026-10-17', 'B', 'C'], ['2026-10-10', 'A', 'B']] as const);
    await test.step(`จอง ${baseField} 10:00 ${date} เช่าเอี๊ยม 6 ชุด (ครบ stock) → ได้`, async () => {
      const bk = await createBooking(page.request, { fieldId: baseField, date, startHour: 10, phone: uniquePhone(b), name: 'ทีมเอี๊ยมครบ', rentals: { BIB: 6 } });
      expect(bk.code).toMatch(/^LN-\d{6}$/);
    });
    await test.step(`${other} 10:00 เวลาเดียวกัน: เอี๊ยมเหลือ 0 ขอชุดที่ 7 → ปฏิเสธ`, async () => {
      await open(page, `/book/new?field=${other}&date=${date}&start=10`);
      await expect(page.getByTestId('rental-BIB-remaining')).toHaveAttribute('data-value', '0');
      await page.getByTestId('rental-BIB-qty').fill('1');
      await fillBookingForm(page, { name: 'ทีมเอี๊ยมชุด7', phone: uniquePhone(b), consent: true });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'ของเช่าไม่พอ (เอี๊ยม เหลือ 0)');
      await expect(page).toHaveURL(/\/book\/new/);
    });
    await test.step(`${other} 14:00 ขอบอล 11 ลูก (= 10 + 1) → ปฏิเสธ`, async () => {
      await open(page, `/book/new?field=${other}&date=${date}&start=14`);
      await expect(page.getByTestId('rental-BALL-remaining')).toHaveAttribute('data-value', '10');
      await page.getByTestId('rental-BALL-qty').fill('11');
      await fillBookingForm(page, { name: 'ทีมบอล11', phone: uniquePhone(b), consent: true });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'ของเช่าไม่พอ (ลูกบอล เหลือ 10)');
      await expect(page).toHaveURL(/\/book\/new/);
    });
  });

  test('TC-RENT-03 ของที่ยังไม่คืนจากรอบก่อนหน้า และพนักงานบันทึกคืน', {
    tag: ['@RENT', '@P2'],
    annotation: { type: 'expected', description: 'รอบ 19:00 เช่าเอี๊ยม 6 ยังไม่คืน → รอบ 20:00 เหลือ 0 (= 6 − 6) · รอบ 18:00 (ก่อนหน้า) เหลือ 6 · พนักงานคืน 6 → "บันทึกคืนของเช่าแล้ว" → รอบ 20:00 เหลือ 6' },
  }, async ({ page, pick, b }) => {
    const [date, field] = pick([['2026-10-22', 'C'], ['2026-10-11', 'C'], ['2026-10-13', 'B']] as const);
    let code = '';
    await test.step(`จอง ${field} 19:00 ${date} เช่าเอี๊ยม 6 ชุด จ่ายแล้ว`, async () => {
      code = (await createBooking(page.request, { fieldId: field, date, startHour: 19, phone: uniquePhone(b), name: 'ทีมยืมเอี๊ยม', rentals: { BIB: 6 } })).code;
      await payBooking(page.request, code);
    });
    await test.step('รอบ 20:00 (ถัดไป) เอี๊ยมเหลือ 0', async () => {
      await open(page, `/book/new?field=${field}&date=${date}&start=20`);
      await expect(page.getByTestId('rental-BIB-remaining')).toHaveAttribute('data-value', '0');
    });
    await test.step('รอบ 18:00 (ก่อนการจองที่เช่า) เอี๊ยมยังเหลือ 6', async () => {
      await open(page, `/book/new?field=${field}&date=${date}&start=18`);
      await expect(page.getByTestId('rental-BIB-remaining')).toHaveAttribute('data-value', '6');
    });
    await test.step('พนักงานค้นรหัสแล้วบันทึกคืนเอี๊ยม 6', async () => {
      await staffLoginPage(page, 'staff');
      await open(page, `/staff?code=${code}`);
      await expect(page.getByTestId('staff-booking-code')).toHaveText(code);
      await page.getByTestId('staff-return-BIB').fill('6');
      await page.getByTestId('staff-return-submit').click();
      await expectSuccess(page, 'บันทึกคืนของเช่าแล้ว');
    });
    await test.step('รอบ 20:00 เอี๊ยมกลับมาเหลือ 6', async () => {
      await open(page, `/book/new?field=${field}&date=${date}&start=20`);
      await expect(page.getByTestId('rental-BIB-remaining')).toHaveAttribute('data-value', '6');
    });
  });
});
