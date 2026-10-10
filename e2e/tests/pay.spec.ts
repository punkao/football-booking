import { test, expect, open, waitReady, uniquePhone, createBooking, postJson } from './fixtures';

test.describe('PAY', () => {
  test('TC-PAY-01 หน้าจ่ายจำลอง PromptPay และสถานะหลังจ่าย (รีโหลด/จ่ายซ้ำ)', {
    tag: ['@PAY', '@P2'],
    annotation: { type: 'expected', description: 'booking-code ตรง · pay-qr แสดง · pay-now-amount 400 (สนาม C 600) · pay-countdown data-value 1–900 วินาที ข้อความ mm:ss ≤ 15:00 · จ่ายแล้วเปิด /pay ซ้ำ → pay-already · API จ่ายซ้ำ → 409 INVALID_STATUS "สถานะการจองนี้ทำรายการนี้ไม่ได้"' },
  }, async ({ page, pick, b }) => {
    const field = pick(['A', 'B', 'C'] as const);
    const expectPay = field === 'C' ? 600 : 400;
    let code = '';
    await test.step(`สร้างการจอง ${field} จ. 12 ต.ค. 08:00 1 ชม.`, async () => {
      const bk = await createBooking(page.request, { fieldId: field, date: '2026-10-12', startHour: 8, hours: 1, phone: uniquePhone(b), name: 'ทีมจ่าย' });
      code = bk.code;
      expect(code).toMatch(/^LN-\d{6}$/);
    });
    await test.step('หน้า /pay แสดงรหัส QR ยอด และเวลานับถอยหลัง 15 นาที', async () => {
      await open(page, `/pay/${code}`);
      await expect(page.getByTestId('booking-code')).toHaveText(code);
      await expect(page.getByTestId('pay-qr')).toBeVisible();
      await expect(page.getByTestId('pay-now-amount')).toHaveAttribute('data-value', String(expectPay));
      const cd = page.getByTestId('pay-countdown');
      const secs = Number(await cd.getAttribute('data-value'));
      expect(secs).toBeGreaterThan(0);
      expect(secs).toBeLessThanOrEqual(900);
      const text = (await cd.innerText()).trim();
      expect(text).toMatch(/^\d{2}:\d{2}$/);
      expect(text <= '15:00', `นับถอยหลัง ${text}`).toBeTruthy();
    });
    await test.step('กดยืนยันการจ่าย → CONFIRMED', async () => {
      await page.getByTestId('pay-confirm').click();
      await expect(page).toHaveURL(new RegExp(`/booking/${code}\\?done=paid`));
      await waitReady(page);
      await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
      await expect(page.getByTestId('go-pay')).toHaveCount(0);
    });
    await test.step('เปิด /pay ซ้ำ → แจ้งว่าไม่ต้องจ่ายแล้ว ไม่มีปุ่มจ่าย', async () => {
      await open(page, `/pay/${code}`);
      await expect(page.getByTestId('pay-already')).toBeVisible();
      await expect(page.getByTestId('pay-confirm')).toHaveCount(0);
    });
    await test.step('เรียก API จ่ายซ้ำ → 409 INVALID_STATUS', async () => {
      const r = await postJson(page.request, `/api/bookings/${code}/pay`, {});
      expect(r.status).toBe(409);
      expect(r.body?.error?.code).toBe('INVALID_STATUS');
      expect(r.body?.error?.message).toBe('สถานะการจองนี้ทำรายการนี้ไม่ได้');
    });
  });
});
