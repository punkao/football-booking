import { test, expect, open, postJson, loginCustomer, fillBookingForm , setCheckedStable } from './fixtures';
import { SEED } from './constants';

test.describe('PRICE', () => {
  test('TC-PRICE-01 ราคาต่อชั่วโมงตามขนาดและช่วงเวลา และจองคร่อม 17:00', {
    tag: ['@PRICE', '@P1'],
    annotation: { type: 'expected', description: 'พ. 14 ต.ค.: slot-A-16 ฿800 · A-17 ฿1,200 · C-16 ฿1,200 · C-17 ฿1,800 · ฟอร์ม A 16:00 × 2: price-hour-16 800, price-hour-17 1,200, price-field 2,000' },
  }, async ({ page }) => {
    await test.step('ตาราง พ. 14 ต.ค. ราคาในช่อง', async () => {
      await open(page, '/book?date=2026-10-14');
      const exp: [string, string][] = [['A-16', '800'], ['A-17', '1200'], ['C-16', '1200'], ['C-17', '1800']];
      for (const [s, v] of exp) {
        await expect(page.getByTestId(`slot-${s}`)).toHaveAttribute('data-price', v);
        await expect(page.getByTestId(`slot-${s}-price`)).toHaveAttribute('data-value', v);
      }
    });
    await test.step('ฟอร์ม A 16:00 × 2 ชม. คิดแยกทีละชั่วโมง', async () => {
      await open(page, '/book/new?field=A&date=2026-10-14&start=16');
      await fillBookingForm(page, { hours: 2 });
      await expect(page.getByTestId('price-hour-16')).toHaveAttribute('data-value', '800');
      await expect(page.getByTestId('price-hour-17')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('price-field')).toHaveAttribute('data-value', '2000');
    });
  });

  test('TC-PRICE-02 เสาร์ อาทิตย์ และวันหยุด คิดราคาเย็นทุกรอบ', {
    tag: ['@PRICE', '@P1'],
    annotation: { type: 'expected', description: 'A 09:00: ส. 10 ต.ค. ฿1,200 · อ. 13 ต.ค. (วันหยุด, มี holiday-badge) ฿1,200 · อ. 20 ต.ค. (ไม่ใช่วันหยุด) ฿800' },
  }, async ({ page }) => {
    await test.step('เสาร์ 10 ต.ค. A 09:00 = ฿1,200', async () => {
      await open(page, '/book?date=2026-10-10');
      await expect(page.getByTestId('slot-A-9')).toHaveAttribute('data-price', '1200');
    });
    await test.step('อังคาร 13 ต.ค. (วันหยุด) A 09:00 = ฿1,200 และมีป้ายวันหยุด', async () => {
      await open(page, '/book?date=2026-10-13');
      await expect(page.getByTestId('holiday-badge')).toBeVisible();
      await expect(page.getByTestId('slot-A-9')).toHaveAttribute('data-price', '1200');
    });
    await test.step('อังคาร 20 ต.ค. (= 13 + 7 ไม่ใช่วันหยุด) A 09:00 = ฿800', async () => {
      await open(page, '/book?date=2026-10-20');
      await expect(page.getByTestId('holiday-badge')).toHaveCount(0);
      await expect(page.getByTestId('slot-A-9')).toHaveAttribute('data-price', '800');
    });
  });

  test('TC-PRICE-03 แผนจ่าย มัดจำ 50% / จ่ายเต็ม 100%', {
    tag: ['@PRICE', '@P1'],
    annotation: { type: 'expected', description: 'ศ. 16 เริ่ม 17:00 → FULL_100 (จ่าย 1,200 = ยอดรวม) · ศ. 16 เริ่ม 16:00 × 2 → DEPOSIT_50 (2,000 → 1,000) · พฤ. 15 เริ่ม 17:00 → DEPOSIT_50 · อ. 13 (วันหยุด) เริ่ม 17:00 → DEPOSIT_50 · ส. 17 เริ่ม 17:00 → FULL_100' },
  }, async ({ page }) => {
    const cases = [
      { label: 'ศุกร์ 16 ต.ค. เริ่ม 17:00', date: '2026-10-16', start: 17, hours: 1, plan: 'FULL_100', total: 1200, payNow: 1200 },
      { label: 'ศุกร์ 16 ต.ค. เริ่ม 16:00 × 2 (คร่อม 17:00)', date: '2026-10-16', start: 16, hours: 2, plan: 'DEPOSIT_50', total: 2000, payNow: 1000 },
      { label: 'พฤหัส 15 ต.ค. เริ่ม 17:00', date: '2026-10-15', start: 17, hours: 1, plan: 'DEPOSIT_50', total: 1200, payNow: 600 },
      { label: 'อังคาร 13 ต.ค. (วันหยุด) เริ่ม 17:00', date: '2026-10-13', start: 17, hours: 1, plan: 'DEPOSIT_50', total: 1200, payNow: 600 },
      { label: 'เสาร์ 17 ต.ค. เริ่ม 17:00', date: '2026-10-17', start: 17, hours: 1, plan: 'FULL_100', total: 1200, payNow: 1200 },
    ];
    for (const c of cases) {
      await test.step(`${c.label} → ${c.plan} จ่ายตอนนี้ ${c.payNow}`, async () => {
        await open(page, `/book/new?field=A&date=${c.date}&start=${c.start}`);
        await fillBookingForm(page, { hours: c.hours });
        await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', String(c.total));
        await expect(page.getByTestId('price-plan')).toHaveAttribute('data-value', c.plan);
        await expect(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', String(c.payNow));
      });
    }
  });

  test('TC-PRICE-04 สูตรยอดรวม/สุทธิ/จ่ายตอนนี้ และใช้เครดิตไม่เกินยอดรวม', {
    tag: ['@PRICE', '@P1'],
    annotation: { type: 'expected', description: 'พ. A 19:00 × 2 = 2,400 → จ่ายตอนนี้ 1,200 เก็บหน้าสนาม 1,200 · ต้น (เครดิต 1,200) ราคา 2,000 ใช้เครดิต → เครดิต 1,200 สุทธิ 800 จ่ายตอนนี้ 400 เก็บหน้าสนาม 400 · เครดิต 1,000 กับยอดรวม 800 → 400 CREDIT_EXCEEDS_TOTAL "ใช้เครดิตเกินยอดรวมไม่ได้"' },
  }, async ({ page }) => {
    await test.step('ไม่เข้าสู่ระบบ: พ. 14 ต.ค. A 19:00 × 2 ชม.', async () => {
      await open(page, '/book/new?field=A&date=2026-10-14&start=19');
      await fillBookingForm(page, { hours: 2 });
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '2400');
      await expect(page.getByTestId('price-net')).toHaveAttribute('data-value', '2400');
      await expect(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('price-due-at-field')).toHaveAttribute('data-value', '1200');
    });
    await test.step('ต้นเข้าสู่ระบบ (เครดิต 1,200) จอง A 16:00 × 2 (฿2,000) ติ๊กใช้เครดิต', async () => {
      await loginCustomer(page.request, SEED.ton.phone, SEED.ton.password);
      await open(page, '/book/new?field=A&date=2026-10-14&start=16');
      await expect(page.getByTestId('member-credit-balance')).toHaveAttribute('data-value', '1200');
      await fillBookingForm(page, { hours: 2 });
      await setCheckedStable(page.getByTestId('use-credit'), true);
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '2000');
      await expect(page.getByTestId('price-credit')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('price-net')).toHaveAttribute('data-value', '800');
      await expect(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', '400');
      await expect(page.getByTestId('price-due-at-field')).toHaveAttribute('data-value', '400');
    });
    await test.step('API: ใช้เครดิต 1,000 กับยอดรวม 800 → ปฏิเสธ', async () => {
      const r = await postJson(page.request, '/api/quote', { fieldId: 'A', date: '2026-10-14', startHour: 16, hours: 1, useCredit: true, creditUsed: 1000 });
      expect(r.status, JSON.stringify(r.body)).toBe(400);
      expect(r.body?.error?.code).toBe('CREDIT_EXCEEDS_TOTAL');
      expect(r.body?.error?.message).toBe('ใช้เครดิตเกินยอดรวมไม่ได้');
    });
  });
});
