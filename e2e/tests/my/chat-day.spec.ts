import type { Page } from '@playwright/test';
import { test, expect, open } from '../fixtures';
import { asCustomer } from '../chat-helpers';

/**
 * S2b-2 · ชิป "รอบว่างวันนี้" ต้องตอบเป็นรายการเวลาเริ่มที่ว่างของวันนี้ทุกสนาม (การ์ด chat-card-day) ไม่ใช่แค่ราคา
 * ข้อมูลมาจาก availability() เดียวกับหน้าเว็บ · ไม่มีตัวเลขเงินในคำตอบ · ไม่แก้ข้อมูลของร้าน (วันล็อก ศ 9 ต.ค. 2026 10:00 · seed: A 19:00 ถูกจอง LN-900001)
 */

const TODAY = '2026-10-09';

async function openChat(page: Page) {
  await page.getByTestId('chat-open').click();
  await expect(page.getByTestId('chat-panel')).toBeVisible();
}

async function waitIdle(page: Page) {
  await expect(page.getByTestId('chat-widget')).toHaveAttribute('data-chat-state', 'idle', { timeout: 60_000 });
}

test.describe('แชท · รอบว่างวันนี้', () => {
  for (const lang of ['th', 'en'] as const) {
    test(`ชิปรอบว่างวันนี้ → การ์ดเวลาเริ่มที่ว่างของทุกสนาม ตรงกับตารางว่าง (${lang})`, {
      annotation: [{ type: 'expected', description: 'กดชิป → ข้อความผู้ใช้ = คำถามของชิป · คำตอบ 1 ข้อความ + การ์ด chat-card-day วันที่ 2026-10-09 มีสนาม A B C · ช่วงที่ผ่านแล้ว (08:00) ไม่มี · A 19:00 (จองแล้ว) ไม่มี · B 19:00 มี · เวลาเริ่ม 17:00 ขึ้นไปอยู่กลุ่ม "ราคาเย็น" · ไม่มี ฿/THB ในคำตอบและการ์ด · ตรงกับ /api/availability' }],
    }, async ({ page, b, context }) => {
      await asCustomer(page, b);
      await context.addCookies([{ name: 'lang', value: lang, url: 'http://localhost:3000' }]);
      await open(page, '/');
      await openChat(page);
      await page.getByTestId('chat-quick-avail').click();
      await expect(page.getByTestId('chat-msg-user')).toHaveText(lang === 'th' ? 'วันนี้มีรอบว่างไหม' : 'Any free slots today?');
      const card = page.getByTestId('chat-card-day');
      await expect(card).toBeVisible({ timeout: 60_000 });
      await waitIdle(page);
      await expect(card).toHaveAttribute('data-date', TODAY);
      for (const f of ['A', 'B', 'C']) await expect(card.getByTestId(`chat-day-field-${f}`)).toBeVisible();
      await expect(card.getByTestId('chat-day-slot-A-8')).toHaveCount(0);
      await expect(card.getByTestId('chat-day-slot-A-19')).toHaveCount(0);
      await expect(card.getByTestId('chat-day-slot-B-19')).toBeVisible();
      await expect(card.getByTestId('chat-day-slot-B-19').locator('xpath=ancestor::*[contains(@class,"chat-day-group")][1]')).toHaveClass(/evening/);
      await expect(card.locator('.chat-day-group.evening .chat-day-k').first()).toHaveText(lang === 'th' ? 'ราคาเย็น' : 'Evening rate');
      const reply = await page.getByTestId('chat-msg-bot').last().innerText();
      expect(reply, 'ไม่มีจำนวนเงิน').not.toMatch(/฿|THB|บาท/);
      expect(await card.innerText(), 'การ์ดไม่มีจำนวนเงิน').not.toMatch(/฿|THB|บาท/);
      if (lang === 'th') expect(reply).toMatch(/สนาม A/);
      else {
        expect(reply).toMatch(/Field A/);
        expect(reply + (await card.innerText()), 'EN ไม่มีอักษรไทย').not.toMatch(/[฀-๿]/);
      }
      // ตรงกับตารางว่างของเว็บ (ตัวเดียวกับ /book)
      const av = await (await page.request.get(`/api/availability?date=${TODAY}`)).json();
      for (const f of ['A', 'B', 'C']) {
        const web = new Set<number>(av.slots.filter((s: { fieldId: string; status: string }) => s.fieldId === f && s.status === 'free').map((s: { hour: number }) => s.hour));
        const shown = (await card.locator(`[data-testid^="chat-day-slot-${f}-"]`).evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-testid')!.split('-').pop()))));
        expect(new Set(shown), `สนาม ${f}: การ์ดตรงกับ /api/availability`).toEqual(web);
      }
    });
  }

  test('พิมพ์เองก็ได้การ์ดเดียวกัน: "วันนี้ว่างไหม" · "free slots today" · "พรุ่งนี้มีรอบว่างไหม"', {
    annotation: [{ type: 'expected', description: 'ข้อความที่ไม่ระบุสนาม/เวลาเริ่ม แต่ถามรอบว่าง → การ์ดรอบว่างของวันนั้น (วันนี้ 2026-10-09 · พรุ่งนี้ 2026-10-10) · ส่วนที่ระบุเวลา (19:00 สนาม A ว่างไหม) ยังเป็นการ์ดตรวจรอบเดิม' }],
  }, async ({ page, b }) => {
    await asCustomer(page, b);
    await open(page, '/');
    await openChat(page);
    const ask = async (t: string) => {
      const n = await page.getByTestId('chat-msg-bot').count();
      await page.getByTestId('chat-input').fill(t);
      await page.getByTestId('chat-send').click();
      await expect(page.getByTestId('chat-msg-bot')).toHaveCount(n + 1, { timeout: 60_000 });
      await waitIdle(page);
    };
    await ask('วันนี้ว่างไหม');
    await expect(page.getByTestId('chat-card-day').last()).toHaveAttribute('data-date', TODAY);
    await ask('free slots today');
    await expect(page.getByTestId('chat-card-day').last()).toHaveAttribute('data-date', TODAY);
    await ask('พรุ่งนี้มีรอบว่างไหม');
    await expect(page.getByTestId('chat-card-day').last()).toHaveAttribute('data-date', '2026-10-10');
    await ask('วันนี้ 19:00 สนาม A ว่างไหม');
    await expect(page.getByTestId('chat-card-check').last()).toHaveAttribute('data-available', 'false');
    await expect(page.getByTestId('chat-card-day')).toHaveCount(3);
  });

  test('แตะเวลาในการ์ด → ไปฟอร์มจองของสนาม/วัน/เวลานั้น · ลิงก์ "ดูตารางทั้งหมด" → /book ของวันนั้น', {
    annotation: [{ type: 'expected', description: '1280: แตะ B 19:00 → /book/new?field=B&date=2026-10-09&start=19 และช่องเลือกเป็น B / 19 · แผงแชทยังเปิดอยู่ (ไม่บังเนื้อหา)' }],
  }, async ({ page, b }) => {
    await asCustomer(page, b);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/');
    await openChat(page);
    await page.getByTestId('chat-quick-avail').click();
    await expect(page.getByTestId('chat-card-day')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('chat-day-slot-B-19').click();
    await expect(page).toHaveURL(/\/book\/new\?field=B&date=2026-10-09&start=19/);
    await expect(page.getByTestId('book-field')).toHaveValue('B');
    await expect(page.getByTestId('book-start')).toHaveValue('19');
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    await page.getByTestId('chat-day-all').click();
    await expect(page).toHaveURL(/\/book\?date=2026-10-09/);
  });

  test('375: การ์ดอยู่ในจอ ไม่เกิด scroll แนวนอน · แตะเวลาแล้วแผงเต็มจอปิดและเห็นฟอร์มจอง', {
    annotation: [{ type: 'expected', description: '375: scrollWidth ≤ 375 ตอนมีการ์ด · แตะ B 19:00 → แผงปิด (หน้าใหม่ไม่ถูกแผงบัง) · อยู่ที่ /book/new' }],
  }, async ({ page, b }) => {
    await asCustomer(page, b);
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/');
    await openChat(page);
    await page.getByTestId('chat-quick-avail').click();
    const card = page.getByTestId('chat-card-day');
    await expect(card).toBeVisible({ timeout: 60_000 });
    await waitIdle(page);
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))).toBeLessThanOrEqual(375);
    await card.getByTestId('chat-day-slot-B-19').click();
    await expect(page).toHaveURL(/\/book\/new\?field=B&date=2026-10-09&start=19/);
    await expect(page.getByTestId('chat-panel')).toHaveCount(0);
    await expect(page.getByTestId('book-field')).toBeVisible();
  });
});
