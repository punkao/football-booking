import { test, expect, open, waitReady, uniquePhone, createBooking, payBooking, staffLoginPage, expectSuccess } from './fixtures';
import { SEED } from './constants';
import type { Page } from '@playwright/test';

async function staffLoginUi(page: Page, role: 'owner' | 'manager' | 'staff') {
  await open(page, '/staff/login');
  if (await page.getByTestId('staff-logout').count()) {
    await page.getByTestId('staff-logout').click();
    await expect(page.getByTestId('staff-username')).toBeVisible();
  }
  await page.getByTestId('staff-username').fill(SEED[role].username);
  await page.getByTestId('staff-password').fill(SEED[role].password);
  await page.getByTestId('staff-login-submit').click();
}

test.describe('STAFF', () => {
  test('TC-STAFF-01 พนักงานค้นรหัส เห็นยอดเก็บหน้าสนาม และกดเก็บเงิน/เช็กอิน', {
    tag: ['@STAFF', '@P1'],
    annotation: { type: 'expected', description: 'อา. 11 ต.ค. A ฿1,200 มัดจำ 600: ค้นรหัส → CONFIRMED เก็บหน้าสนาม 600 จ่ายแล้ว 600 ชื่อลูกค้าตรง · กดเช็กอิน → "เก็บเงินและเช็กอินแล้ว" CHECKED_IN จ่ายแล้ว 1,200 ค้าง 0 · ลูกค้าเห็น CHECKED_IN' },
  }, async ({ page, pick, b }) => {
    const hour = pick([10, 11, 12] as const);
    const name = 'ลูกค้าหน้าสนาม';
    let code = '';
    await test.step(`ลูกค้าจอง A อา. 11 ต.ค. ${hour}:00 จ่ายมัดจำ`, async () => {
      code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-11', startHour: hour, phone: uniquePhone(b), name })).code;
      const paid = await payBooking(page.request, code);
      expect(paid.amount).toBe(600);
    });
    await test.step('พนักงานเข้าสู่ระบบ แล้วค้นด้วยรหัสการจอง', async () => {
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

  test('TC-STAFF-05 สิทธิ์ตามบทบาทฝั่งร้าน และภาพรวมวันนี้ของผู้จัดการ', {
    tag: ['@STAFF', '@P2'],
    annotation: { type: 'expected', description: 'เข้าสู่ระบบแล้วไปหน้าหลัก: STAFF → /staff, MANAGER → /staff/today, OWNER → /owner · STAFF เปิด /staff/today และ /owner → forbidden-message · MANAGER เปิด /owner → forbidden-message · ภาพรวมวันนี้: today-slot-A-19 CONFIRMED, total-bookings 1, total-paid 2,400, total-due 0, today-rental-BIB-8 = 6' },
  }, async ({ page }) => {
    await test.step('STAFF เข้าสู่ระบบ → /staff', async () => {
      await staffLoginUi(page, 'staff');
      await expect(page).toHaveURL(/\/staff(\?.*)?$/);
      await waitReady(page);
      await expect(page.getByTestId('staff-whoami')).toContainText('STAFF');
    });
    await test.step('STAFF เปิด /staff/today และ /owner → ไม่มีสิทธิ์', async () => {
      await open(page, '/staff/today');
      await expect(page.getByTestId('forbidden-message')).toBeVisible();
      await expect(page.getByTestId('today-grid')).toHaveCount(0);
      await open(page, '/owner');
      await expect(page.getByTestId('forbidden-message')).toBeVisible();
      await expect(page.getByTestId('holiday-add')).toHaveCount(0);
    });
    await test.step('MANAGER เข้าสู่ระบบ → /staff/today เห็นภาพรวมวันนี้', async () => {
      await staffLoginUi(page, 'manager');
      await expect(page).toHaveURL(/\/staff\/today/);
      await waitReady(page);
      await expect(page.getByTestId('today-date')).toHaveValue('2026-10-09');
      await expect(page.getByTestId('today-slot-A-19')).toHaveAttribute('data-status', 'CONFIRMED');
      await expect(page.getByTestId('today-slot-A-20')).toHaveAttribute('data-status', 'CONFIRMED');
      await expect(page.getByTestId('today-slot-B-19')).toHaveAttribute('data-status', 'FREE');
      await expect(page.getByTestId('today-total-bookings')).toHaveAttribute('data-value', '1');
      await expect(page.getByTestId('today-total-paid')).toHaveAttribute('data-value', '2400');
      await expect(page.getByTestId('today-total-due')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('today-rental-BIB-8')).toHaveAttribute('data-value', '6');
      await expect(page.getByTestId('today-rental-BALL-8')).toHaveAttribute('data-value', '10');
    });
    await test.step('MANAGER เปิด /owner → ไม่มีสิทธิ์', async () => {
      await open(page, '/owner');
      await expect(page.getByTestId('forbidden-message')).toBeVisible();
    });
    await test.step('OWNER เข้าสู่ระบบ → /owner', async () => {
      await staffLoginUi(page, 'owner');
      await expect(page).toHaveURL(/\/owner/);
      await waitReady(page);
      await expect(page.getByTestId('holiday-list')).toBeVisible();
      await expect(page.getByTestId('forbidden-message')).toHaveCount(0);
    });
  });
});
