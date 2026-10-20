import { test, expect, open, waitReady } from './fixtures';
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
  // TC-STAFF-01 ย้ายไป staff.serial.spec.ts (CR-02 / A-45 เช็กอินได้เฉพาะวันเตะ → ต้อง setClock เป็นวันเตะ · ORACLE-CHANGES lead อนุมัติ 2026-10-21)

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
