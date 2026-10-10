import { test, expect, open, uniquePhone, createBooking, getJson, expectError, fillBookingForm } from './fixtures';
import type { Page } from '@playwright/test';

const SHOP = 'ลูกหนัง อารีน่า';
const THAI = /[฀-๿]+/g;

/** ข้อความภาษาไทยที่เหลือในหน้า (ตัดชื่อร้าน ชื่อที่ผู้ใช้กรอก และป้าย GIF ออก) */
async function thaiLeftovers(page: Page, userNames: string[]): Promise<string[]> {
  const text = await page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('#__pw_label, script, style, noscript, [data-testid^="challenge-team-"], [data-testid="booking-customer"], [data-testid="my-name"]').forEach((n) => n.remove());
    // ใช้ textContent ของทุก element ที่มองเห็น (option/select รวมด้วย)
    return clone.innerText || clone.textContent || '';
  });
  let t = text.split(SHOP).join(' ');
  for (const n of userNames.filter(Boolean).sort((a, b) => b.length - a.length)) t = t.split(n).join(' ');
  return [...new Set(t.match(THAI) ?? [])];
}

test.describe('I18N', () => {
  test('TC-I18N-01 สลับภาษา ไทย/English และจำภาษาเมื่อเปลี่ยนหน้า', {
    tag: ['@I18N', '@P2'],
    annotation: { type: 'expected', description: 'กด lang-en → <html lang="en">, lang-en aria-pressed=true · ไปหน้าสนามและตารางยังเป็น en · เงินแสดง "THB 1,200" · กด lang-th → กลับ th และ "฿1,200"' },
  }, async ({ page }) => {
    await test.step('หน้าแรกเริ่มเป็นภาษาไทย แล้วกด EN', async () => {
      await open(page, '/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'th');
      await page.getByTestId('lang-en').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByTestId('lang-en')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('lang-th')).toHaveAttribute('aria-pressed', 'false');
    });
    await test.step('ไปหน้าสนาม: ยังเป็น English และเงินเป็น THB', async () => {
      await page.getByTestId('nav-fields').click();
      await expect(page).toHaveURL(/\/fields/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByTestId('field-evening-rate-A')).toHaveText('THB 1,200');
    });
    await test.step('ไปหน้าตารางว่าง (โหลดใหม่ทั้งหน้า) ยังเป็น English', async () => {
      await open(page, '/book');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByTestId('lang-en')).toHaveAttribute('aria-pressed', 'true');
    });
    await test.step('กด TH กลับเป็นภาษาไทยและ ฿', async () => {
      await page.getByTestId('lang-th').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'th');
      await open(page, '/fields');
      await expect(page.getByTestId('field-evening-rate-A')).toHaveText('฿1,200');
    });
  });

  test('TC-I18N-02 โหมด English หน้าฝั่งลูกค้าไม่มีภาษาไทยหลง', {
    tag: ['@I18N', '@P3'],
    annotation: { type: 'expected', description: 'โหมด EN: /, /book, /book/new, /fields, /challenges, /my, /series, /pay/{code}, /booking/{code} ไม่มีอักษรไทย (ยกเว้นชื่อร้านและชื่อที่ผู้ใช้กรอก) · ไม่กรอกชื่อ → "Please enter your name"' },
  }, async ({ page, pick, b }) => {
    const hour = pick([8, 9, 10] as const);
    let code = '';
    await test.step(`สร้างการจอง A ศ. 16 ต.ค. ${hour}:00 (ชื่อภาษาอังกฤษ)`, async () => {
      code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-16', startHour: hour, phone: uniquePhone(b), name: 'Tester EN' })).code;
    });
    await test.step('เปลี่ยนเป็น English', async () => {
      await open(page, '/');
      await page.getByTestId('lang-en').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
    const ch = await getJson(page.request, '/api/challenges');
    const userNames = ((ch.body?.challenges ?? []) as any[]).flatMap((c) => [c.teamName, c.ownerName]);
    const pages = ['/', '/book', '/book/new?field=A&date=2026-10-20&start=12', '/fields', '/challenges', '/my', '/series', `/pay/${code}`, `/booking/${code}`];
    const found: Record<string, string[]> = {};
    for (const p of pages) {
      await test.step(`เปิด ${p} ในโหมด EN`, async () => {
        await open(page, p);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        const left = await thaiLeftovers(page, userNames);
        if (left.length) found[p] = left;
      });
    }
    await test.step('ข้อความ error เป็นภาษาอังกฤษ', async () => {
      await open(page, '/book/new?field=A&date=2026-10-20&start=12');
      await fillBookingForm(page, { name: '', phone: uniquePhone(b), consent: true });
      await page.getByTestId('book-submit').click();
      await expectError(page, 'Please enter your name');
    });
    await test.step('สรุป: ต้องไม่มีภาษาไทยหลงเหลือ', async () => {
      expect(found, 'ข้อความภาษาไทยที่เหลือในโหมด English (หน้า → คำ)').toEqual({});
    });
  });
});
