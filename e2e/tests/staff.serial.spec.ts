import { test, expect, open, uniquePhone, createBooking, payBooking, staffLoginPage, expectSuccess, resetData, setClock } from './fixtures';

/**
 * TC-STAFF-01 ย้ายมาจาก staff.spec.ts (CR-02 · ORACLE-CHANGES.md · lead อนุมัติ 2026-10-21)
 * เหตุ: [D:CR-02] ข้อ 1 / A-45 เช็กอินได้เฉพาะวันเตะ → เดิมจอง อา 11 ต.ค. แล้วเช็กอินตอน ศ 9 ต.ค. ใช้ไม่ได้แล้ว
 * เปลี่ยนแค่ "ตั้งนาฬิกาเป็นวันเตะก่อนกดเช็กอิน" · ค่าเงินและค่าคาดหวังทุกตัวเท่าเดิม
 * project "serial" (Chromium ทีละข้อ หลัง 3 เบราว์เซอร์จบ) · reset ก่อนและหลังทุกข้อ
 */
test.beforeEach(async ({ request }) => { await resetData(request); });
test.afterEach(async ({ request }) => { await resetData(request); });

test.describe('STAFF', () => {
  test('TC-STAFF-01 พนักงานค้นรหัส เห็นยอดเก็บหน้าสนาม และกดเก็บเงิน/เช็กอิน', {
    tag: ['@STAFF', '@P1'],
    annotation: { type: 'expected', description: 'อา. 11 ต.ค. A ฿1,200 มัดจำ 600: ค้นรหัส → CONFIRMED เก็บหน้าสนาม 600 จ่ายแล้ว 600 ชื่อลูกค้าตรง · (วันเตะ อา 11 ต.ค. ตาม A-45) กดเช็กอิน → "เก็บเงินและเช็กอินแล้ว" CHECKED_IN จ่ายแล้ว 1,200 ค้าง 0 · ลูกค้าเห็น CHECKED_IN' },
  }, async ({ page, pick, b, request }) => {
    const hour = pick([10, 11, 12] as const);
    const name = 'ลูกค้าหน้าสนาม';
    let code = '';
    await test.step(`ลูกค้าจอง A อา. 11 ต.ค. ${hour}:00 จ่ายมัดจำ`, async () => {
      code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-11', startHour: hour, phone: uniquePhone(b), name })).code;
      const paid = await payBooking(page.request, code);
      expect(paid.amount).toBe(600);
    });
    await test.step(`วันเตะ อา. 11 ต.ค. ${hour}:00 พนักงานเข้าสู่ระบบ แล้วค้นด้วยรหัสการจอง`, async () => {
      await setClock(request, `2026-10-11T${String(hour).padStart(2, '0')}:00:00+07:00`);
      await staffLoginPage(page, 'staff');
      await open(page, '/staff');
      await page.getByTestId('staff-search-code').fill(code);
      await page.getByTestId('staff-search-submit').click();
      await expect(page.getByTestId('staff-booking-code')).toHaveText(code);
      await expect(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
      await expect(page.getByTestId('staff-customer-name')).toHaveText(name);
      await expect(page.getByTestId('staff-due-at-field')).toHaveAttribute('data-value', '600');
      await expect(page.getByTestId('staff-amount-paid')).toHaveAttribute('data-value', '600');
    });
    await test.step('กด "เก็บเงินแล้ว / เช็กอิน"', async () => {
      await page.getByTestId('staff-checkin').click();
      await expectSuccess(page, 'เก็บเงินและเช็กอินแล้ว');
      await expect(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'CHECKED_IN');
      await expect(page.getByTestId('staff-amount-paid')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('staff-due-at-field')).toHaveAttribute('data-value', '0');
    });
    await test.step('ลูกค้าเปิดหน้าการจอง เห็น CHECKED_IN ค้าง 0', async () => {
      await open(page, `/booking/${code}`);
      await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CHECKED_IN');
      await expect(page.getByTestId('due-at-field')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('amount-paid')).toHaveAttribute('data-value', '1200');
    });
  });
});
