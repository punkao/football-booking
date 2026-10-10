import { test, expect, open } from './fixtures';
import { TODAY } from './constants';

test.describe('HOME', () => {
  test('TC-HOME-01 หน้าแรกพร้อมใช้ การ์ด 3 สนาม และไปตารางว่างวันนี้ใน 1 แตะ', {
    tag: ['@HOME', '@P2'],
    annotation: { type: 'expected', description: '<html data-ready="true" data-bug-mode="0|1"> · home-field-A/B/C แสดง · แตะ cta-today 1 ครั้ง → /book, date-chip-2026-10-09 aria-pressed=true, slot-grid แสดง (NFR-02 ≤ 3 แตะ) · ไม่มี console error' },
  }, async ({ page, consoleErrors }) => {
    await test.step('เปิดหน้าแรก /', async () => {
      await open(page, '/');
      await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-bug-mode', /^[01]$/);
    });
    await test.step('เห็นการ์ดสนาม A, B, C และปุ่มดูสนามว่างวันนี้', async () => {
      for (const f of ['A', 'B', 'C']) await expect(page.getByTestId(`home-field-${f}`)).toBeVisible();
      await expect(page.getByTestId('home-title')).toBeVisible();
      await expect(page.getByTestId('cta-today')).toBeVisible();
    });
    await test.step('แตะ cta-today 1 ครั้ง → ตารางว่างของวันนี้', async () => {
      await page.getByTestId('cta-today').click();
      await expect(page).toHaveURL(/\/book(\?.*)?$/);
      await page.locator('html[data-ready="true"]').waitFor({ state: 'attached' });
      await expect(page.getByTestId('slot-grid')).toBeVisible();
      await expect(page.getByTestId(`date-chip-${TODAY}`)).toHaveAttribute('aria-pressed', 'true');
    });
    await test.step('ไม่มี console error', async () => {
      expect(consoleErrors, 'console error ในหน้า').toEqual([]);
    });
  });

  test('TC-HOME-02 หน้าข้อมูลสนาม: ขนาด หลังคา ราคา รูปมีคำอธิบาย', {
    tag: ['@HOME', '@P2'],
    annotation: { type: 'expected', description: 'A,B: size 5 outdoor 800/1,200 · C: size 7 covered 1,200/1,800 · field-art-* มี aria-label' },
  }, async ({ page }) => {
    await test.step('เปิด /fields', async () => {
      await open(page, '/fields');
    });
    const exp = {
      A: { size: '5', covered: 'outdoor', day: '800', eve: '1200' },
      B: { size: '5', covered: 'outdoor', day: '800', eve: '1200' },
      C: { size: '7', covered: 'covered', day: '1200', eve: '1800' },
    } as const;
    for (const f of ['A', 'B', 'C'] as const) {
      await test.step(`สนาม ${f}: ขนาด ${exp[f].size} คน ${exp[f].covered} ราคา ${exp[f].day}/${exp[f].eve}`, async () => {
        await expect(page.getByTestId(`field-card-${f}`)).toBeVisible();
        await expect(page.getByTestId(`field-size-${f}`)).toHaveAttribute('data-value', exp[f].size);
        await expect(page.getByTestId(`field-covered-${f}`)).toHaveAttribute('data-value', exp[f].covered);
        await expect(page.getByTestId(`field-day-rate-${f}`)).toHaveAttribute('data-value', exp[f].day);
        await expect(page.getByTestId(`field-evening-rate-${f}`)).toHaveAttribute('data-value', exp[f].eve);
        const art = page.getByTestId(`field-card-${f}`).getByTestId(`field-art-${f}`);
        await expect(art).toHaveAttribute('aria-label', /\S+/);
      });
    }
  });
});
