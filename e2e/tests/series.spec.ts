import { test, expect, open, waitReady, uniquePhone, registerCustomer, createBooking, expectError, getJson, type Json } from './fixtures';
import type { Page } from '@playwright/test';

async function fillSeries(page: Page, o: { field: string; startDate: string; start: number; hours: number; weeks: number }) {
  await page.getByTestId('series-field').selectOption(o.field);
  await page.getByTestId('series-start-date').fill(o.startDate);
  await page.getByTestId('series-start').selectOption(String(o.start));
  await page.getByTestId('series-hours').fill(String(o.hours));
  await page.getByTestId('series-weeks').fill(String(o.weeks));
  await page.getByTestId('series-preview').click();
}

test.describe('SERIES', () => {
  test('TC-SERIES-01 จองประจำ: ต้องเป็นสมาชิก · 4–12 สัปดาห์ · ไม่ติดเพดาน 14 วัน · สัปดาห์แรกผ่าน BR-05', {
    tag: ['@SERIES', '@P1'],
    annotation: { type: 'expected', description: 'ไม่เข้าสู่ระบบ → series-login-required · 3 สัปดาห์ → "จองประจำได้ 4–12 สัปดาห์" · 4 → series-weeks-booked 4 · 12 → 12 (สัปดาห์ที่ 12 = 2026-12-30) · 13 → "จองประจำได้ 4–12 สัปดาห์" · เริ่มวันนี้ 10:00 → "ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง"' },
  }, async ({ page, b }) => {
    const base = { field: 'A', startDate: '2026-10-14', start: 19, hours: 2 };
    await test.step('ยังไม่เข้าสู่ระบบ → ต้องเข้าสู่ระบบสมาชิกก่อน', async () => {
      await open(page, '/series');
      await expect(page.getByTestId('series-login-required')).toBeVisible();
      await expect(page.getByTestId('series-go-login')).toBeVisible();
      await expect(page.getByTestId('series-preview')).toHaveCount(0);
    });
    await test.step('สมัครสมาชิกใหม่แล้วเปิด /series', async () => {
      await registerCustomer(page.request, { name: 'สมาชิกประจำ', phone: uniquePhone(b) });
      await open(page, '/series');
      await expect(page.getByTestId('series-preview')).toBeVisible();
    });
    await test.step('3 สัปดาห์ (= 4 − 1) → ปฏิเสธ', async () => {
      await fillSeries(page, { ...base, weeks: 3 });
      await expectError(page, 'จองประจำได้ 4–12 สัปดาห์');
    });
    await test.step('4 สัปดาห์ → ตรวจได้ 4 สัปดาห์', async () => {
      await fillSeries(page, { ...base, weeks: 4 });
      await expect(page.getByTestId('series-weeks-booked')).toHaveAttribute('data-value', '4');
    });
    await test.step('12 สัปดาห์ → ได้ 12 สัปดาห์ (เกิน 14 วันได้)', async () => {
      await fillSeries(page, { ...base, weeks: 12 });
      await expect(page.getByTestId('series-weeks-booked')).toHaveAttribute('data-value', '12');
      await expect(page.getByTestId('series-week-12')).toHaveAttribute('data-date', '2026-12-30');
      await expect(page.getByTestId('series-week-12')).toHaveAttribute('data-status', 'free');
    });
    await test.step('13 สัปดาห์ (= 12 + 1) → ปฏิเสธ', async () => {
      await fillSeries(page, { ...base, weeks: 13 });
      await expectError(page, 'จองประจำได้ 4–12 สัปดาห์');
    });
    await test.step('สัปดาห์แรกเริ่มวันนี้ 10:00 (ห่าง 0 นาที) → ปฏิเสธตาม BR-05', async () => {
      await fillSeries(page, { field: 'B', startDate: '2026-10-09', start: 10, hours: 1, weeks: 4 });
      await expectError(page, 'ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง');
    });
  });

  test('TC-SERIES-02 ราคาจองประจำ ส่วนลด 10% เมื่อ ≥ 8 สัปดาห์ และยอดจ่ายรวม', {
    tag: ['@SERIES', '@P1'],
    annotation: { type: 'expected', description: 'พุธ A 19:00 × 2: 10 สัปดาห์ → ค่าสนาม 24,000 ส่วนลด 10% = 2,400 ยอดรวม 21,600 จ่ายตอนนี้ 10,800 · 7 สัปดาห์ (= 8 − 1) → ส่วนลด 0% จ่าย 8,400 · 8 สัปดาห์ → ส่วนลด 10% (1,920) จ่าย 8,640' },
  }, async ({ page, b }) => {
    const base = { field: 'A', startDate: '2026-10-14', start: 19, hours: 2 };
    await registerCustomer(page.request, { name: 'สมาชิกส่วนลด', phone: uniquePhone(b) });
    await open(page, '/series');
    const cases = [
      { weeks: 10, field: 24000, pct: '10', disc: 2400, total: 21600, pay: 10800 },
      { weeks: 7, field: 16800, pct: '0', disc: 0, total: 16800, pay: 8400 },
      { weeks: 8, field: 19200, pct: '10', disc: 1920, total: 17280, pay: 8640 },
    ];
    for (const c of cases) {
      await test.step(`${c.weeks} สัปดาห์ → ส่วนลด ${c.pct}% จ่ายตอนนี้ ${c.pay}`, async () => {
        await fillSeries(page, { ...base, weeks: c.weeks });
        await expect(page.getByTestId('series-weeks-booked')).toHaveAttribute('data-value', String(c.weeks));
        await expect(page.getByTestId('series-field-price')).toHaveAttribute('data-value', String(c.field));
        await expect(page.getByTestId('series-discount-percent')).toHaveAttribute('data-value', c.pct);
        await expect(page.getByTestId('series-discount')).toHaveAttribute('data-value', String(c.disc));
        await expect(page.getByTestId('series-total-price')).toHaveAttribute('data-value', String(c.total));
        await expect(page.getByTestId('series-pay-now')).toHaveAttribute('data-value', String(c.pay));
      });
    }
  });

  test('TC-SERIES-03 สัปดาห์ที่ชน: แสดงวันที่ จองเฉพาะสัปดาห์ว่าง ส่วนลดคิดจากที่จองได้จริง', {
    tag: ['@SERIES', '@P1'],
    annotation: { type: 'expected', description: 'ศุกร์ C 1 ชม. เริ่ม 16 ต.ค. มีคนจอง 23 ต.ค. แล้ว: ขอ 4 → จองได้ 3 · ขอ 8 → series-conflicts "2026-10-23", week-2 conflict, จองได้ 7, ส่วนลด 0%, จ่ายตอนนี้ 12,600 (1,800 × 7 จ่ายเต็มทุกสัปดาห์) · ยืนยัน → /pay 12,600 → จ่ายแล้ว 7 การจอง CONFIRMED' },
  }, async ({ page, pick, b, anonApi }) => {
    const hour = pick([21, 22, 23] as const);
    let firstCode = '';
    await test.step(`มีคนอื่นจอง C ศ. 23 ต.ค. ${hour}:00 ไว้แล้ว (สัปดาห์ที่ 2)`, async () => {
      await createBooking(await anonApi(), { fieldId: 'C', date: '2026-10-23', startHour: hour, phone: uniquePhone(b), name: 'ทีมจองก่อน' });
    });
    await test.step('สมาชิกใหม่เปิด /series', async () => {
      await registerCustomer(page.request, { name: 'สมาชิกชนสัปดาห์', phone: uniquePhone(b) });
      await open(page, '/series');
    });
    await test.step('ขอ 4 สัปดาห์ ชนสัปดาห์ที่ 2 → จองได้ 3 (= 4 − 1)', async () => {
      await fillSeries(page, { field: 'C', startDate: '2026-10-16', start: hour, hours: 1, weeks: 4 });
      await expect(page.getByTestId('series-weeks-booked')).toHaveAttribute('data-value', '3');
      await expect(page.getByTestId('series-week-2')).toHaveAttribute('data-status', 'conflict');
    });
    await test.step('ขอ 8 สัปดาห์ ชน 1 → ได้ 7 (= 8 − 1) ไม่ลด จ่าย 12,600', async () => {
      await fillSeries(page, { field: 'C', startDate: '2026-10-16', start: hour, hours: 1, weeks: 8 });
      await expect(page.getByTestId('series-conflicts')).toHaveAttribute('data-value', '2026-10-23');
      await expect(page.getByTestId('series-week-2')).toHaveAttribute('data-status', 'conflict');
      await expect(page.getByTestId('series-week-2')).toHaveAttribute('data-date', '2026-10-23');
      await expect(page.getByTestId('series-weeks-booked')).toHaveAttribute('data-value', '7');
      await expect(page.getByTestId('series-discount-percent')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('series-field-price')).toHaveAttribute('data-value', '12600');
      await expect(page.getByTestId('series-pay-now')).toHaveAttribute('data-value', '12600');
    });
    await test.step('ยินยอมและยืนยันจองเฉพาะสัปดาห์ที่ว่าง → หน้าจ่ายรวม 12,600', async () => {
      await page.getByTestId('series-consent').check();
      await page.getByTestId('series-submit').click();
      await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
      await waitReady(page);
      firstCode = page.url().split('/pay/')[1];
      await expect(page.getByTestId('pay-now-amount')).toHaveAttribute('data-value', '12600');
    });
    await test.step('จ่าย → ทั้ง 7 สัปดาห์เป็น CONFIRMED', async () => {
      await page.getByTestId('pay-confirm').click();
      await expect(page).toHaveURL(new RegExp(`/booking/${firstCode}\\?done=paid`));
      const me = await getJson(page.request, '/api/me');
      const mine = (me.body.bookings as Json[]).filter((x) => x.fieldId === 'C' && x.startHour === hour);
      expect(mine.length).toBe(7);
      expect(mine.map((x) => x.status)).toEqual(Array(7).fill('CONFIRMED'));
      expect(mine.map((x) => x.date)).not.toContain('2026-10-23');
    });
  });

  test('TC-SERIES-04 ส่วนลดจองประจำมีเศษ → ปัดส่วนลดขึ้นเป็นบาทเต็ม (A-24)', {
    tag: ['@SERIES', '@P1'],
    annotation: { type: 'expected', description: 'ส่วนลด = ⌈ค่าสนาม × 10%⌉ เมื่อมีเศษสตางค์ (BR-19, A-24) · ถ้าราคาจริงทุกสนาม/ช่วงเวลา (dayRate, eveningRate) ทำให้ 10% ลงตัวทุกกรณี → ทดสอบผ่านหน้าเว็บไม่ได้ ข้าม (ไม่เดา)' },
  }, async ({ page, b }) => {
    let fields: Json[] = [];
    await test.step('อ่านราคาจริงจาก /api/fields แล้วหากรณีที่ 10% ของค่าสนามมีเศษ', async () => {
      fields = (await getJson(page.request, '/api/fields')).body.fields;
      expect(fields.length).toBe(3);
    });
    // ค่าสนามจองประจำ = ผลรวมราคารายชั่วโมง × จำนวนสัปดาห์ → 10% มีเศษได้ก็ต่อเมื่อมีราคาต่อชั่วโมงที่ไม่ใช่ทวีคูณของ 10
    const odd = fields.flatMap((f) => [
      { field: f.id as string, rate: Number(f.dayRate), start: 9 },
      { field: f.id as string, rate: Number(f.eveningRate), start: 19 },
    ]).find((x) => x.rate % 10 !== 0);
    const rates = fields.map((f) => `${f.id} ${f.dayRate}/${f.eveningRate}`).join(', ');
    test.info().annotations.push({ type: 'rates', description: rates });
    test.skip(!odd, `ทดสอบไม่ได้ผ่านหน้าเว็บ: ราคาจริง (${rates}) เป็นทวีคูณของ 10 ทุกช่วง → ส่วนลด 10% ลงตัวทุกกรณี ไม่มีเศษให้ปัด (A-24)`);
    // ถ้าวันหนึ่งราคามีเศษ: ตรวจ 8 สัปดาห์ (พุธ เริ่ม 4 พ.ย.) ส่วนลด = ⌈ค่าสนาม × 10%⌉
    await test.step(`พบราคาที่มีเศษ (${odd!.field} ${odd!.rate}) → ส่วนลด = ปัดขึ้น`, async () => {
      await registerCustomer(page.request, { name: 'สมาชิกปัดเศษ', phone: uniquePhone(b) });
      const prev = await page.request.post('/api/series/preview', { data: { fieldId: odd!.field, startDate: '2026-11-04', startHour: odd!.start, hours: 1, weeks: 8 } });
      const body = await prev.json();
      const fp = body.preview.totals.fieldPrice;
      expect(body.preview.totals.discount).toBe(Math.ceil(fp / 10));
    });
  });
});
