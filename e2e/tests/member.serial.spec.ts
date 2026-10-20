import { test, expect, open, waitReady, uniquePhone, createBooking, payBooking, postJson, registerCustomer, expectSuccess, setCheckedStable, resetData, setClock } from './fixtures';
import { LOCKED_NOW } from './constants';

/**
 * TC-MEMBER-03 ย้ายมาจาก member.spec.ts (CR-02 · ORACLE-CHANGES.md · lead อนุมัติ 2026-10-21)
 * เหตุ: [D:CR-02] ข้อ 1 / A-45 เช็กอินได้เฉพาะวันเตะ → เดิมจองวันที่ 19 ต.ค. แล้วเช็กอินตอน ศ 9 ต.ค. ใช้ไม่ได้แล้ว
 * เปลี่ยนแค่ "ตั้งนาฬิกาเป็นวันเตะก่อนเช็กอินแต่ละครั้ง แล้วคืนนาฬิกา 9 ต.ค. 10:00" · ค่าชั่วโมงสะสม / สิทธิ์ฟรี / ยอดเงินเท่าเดิม
 * project "serial" (Chromium ทีละข้อ หลัง 3 เบราว์เซอร์จบ) · reset ก่อนและหลังทุกข้อ
 */
test.beforeEach(async ({ request }) => { await resetData(request); });
test.afterEach(async ({ request }) => { await resetData(request); });

test.describe('MEMBER', () => {
  test('TC-MEMBER-03 ชั่วโมงสะสม 9/10 ได้สิทธิ์ฟรี และใช้สิทธิ์แล้วยอด ฿0 ยืนยันทันที', {
    tag: ['@MEMBER', '@P1'],
    annotation: { type: 'expected', description: 'เช็กอิน 9 ชม. (ในวันเตะ A-45) → paid-hours 9, free-hours-available 0, free-hours-next 1 · ครบ 10 → free-hours-available 1 · จอง C 1 ชม. ใช้สิทธิ์: price-free-hour 1,200 price-total 0 → /booking/{code}?done=free "ยืนยันการจองแล้ว (ยอดที่ต้องจ่าย ฿0)" CONFIRMED · สิทธิ์เหลือ 0' },
  }, async ({ page, pick, b, staffApi, request }) => {
    const [date9, field9] = pick([['2026-10-19', 'B'], ['2026-10-19', 'C'], ['2026-10-22', 'C']] as const);
    const freeHour = pick([8, 9, 10] as const);
    const phone = uniquePhone(b);
    const staff = await staffApi('staff');
    await test.step('สมัครสมาชิกใหม่', async () => {
      await registerCustomer(page.request, { name: 'นักเตะสะสม', phone });
    });
    await test.step(`จอง ${field9} ${date9} 08:00 × 9 ชม. จ่าย แล้ววันเตะ ${date9} 08:00 พนักงานเช็กอิน`, async () => {
      const bk = await createBooking(page.request, { fieldId: field9, date: date9, startHour: 8, hours: 9, phone, name: 'นักเตะสะสม' });
      await payBooking(page.request, bk.code);
      await setClock(request, `${date9}T08:00:00+07:00`);
      const r = await postJson(staff, `/api/staff/bookings/${bk.code}/checkin`, {});
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      await setClock(request, LOCKED_NOW);
    });
    await test.step('สะสม 9 (= 10 − 1) → ยังไม่มีสิทธิ์ อีก 1 ชั่วโมง', async () => {
      await open(page, '/my');
      await expect(page.getByTestId('paid-hours')).toHaveAttribute('data-value', '9');
      await expect(page.getByTestId('free-hours-available')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('free-hours-next')).toHaveAttribute('data-value', '1');
    });
    await test.step(`จองเพิ่ม 1 ชม. (${field9} 17:00) จ่าย วันเตะเช็กอิน → สะสม 10 ได้ 1 สิทธิ์`, async () => {
      const bk = await createBooking(page.request, { fieldId: field9, date: date9, startHour: 17, hours: 1, phone, name: 'นักเตะสะสม' });
      await payBooking(page.request, bk.code);
      await setClock(request, `${date9}T17:00:00+07:00`);
      const r = await postJson(staff, `/api/staff/bookings/${bk.code}/checkin`, {});
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      await setClock(request, LOCKED_NOW);
      await open(page, '/my');
      await expect(page.getByTestId('paid-hours')).toHaveAttribute('data-value', '10');
      await expect(page.getByTestId('free-hours-available')).toHaveAttribute('data-value', '1');
    });
    await test.step(`ใช้สิทธิ์ฟรีจอง C อ. 20 ต.ค. ${freeHour}:00 1 ชม. → ยอด ฿0 ยืนยันทันที`, async () => {
      await open(page, `/book/new?field=C&date=2026-10-20&start=${freeHour}`);
      await expect(page.getByTestId('use-free-hour')).toBeEnabled();
      await setCheckedStable(page.getByTestId('use-free-hour'), true);
      await expect(page.getByTestId('price-free-hour')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', '0');
      await setCheckedStable(page.getByTestId('pdpa-consent'), true);
      await page.getByTestId('book-submit').click();
      await expect(page).toHaveURL(/\/booking\/LN-\d{6}\?done=free/);
      await waitReady(page);
      await expectSuccess(page, 'ยืนยันการจองแล้ว (ยอดที่ต้องจ่าย ฿0)');
      await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
    });
    await test.step('สิทธิ์ชั่วโมงฟรีเหลือ 0', async () => {
      await open(page, '/my');
      await expect(page.getByTestId('free-hours-available')).toHaveAttribute('data-value', '0');
    });
  });
});
