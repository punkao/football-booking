/**
 * project perf-chromium / perf-firefox / perf-webkit (PERF=1, workers 1) — รันหลังรอบหลัก (3 เบราว์เซอร์ + serial) จบ
 * NFR-08 (ตอบ Q-T6): วัดตอนรัน test นั้นเดี่ยว ไม่มี test อื่นรันพร้อมกัน ทั้ง 3 เบราว์เซอร์ · เกณฑ์ ≤ 2 วินาทีเท่าเดิม
 * ไม่ reset ข้อมูลใน test (global-setup ของรอบ perf reset ให้แล้ว) · อ่านอย่างเดียว ไม่สร้างการจอง
 */
import { test, expect, open, waitReady } from './fixtures';

test.describe('BOOK', () => {
  test('TC-BOOK-02 รอบเวลาเริ่มตรงชั่วโมง 08:00–23:00 และตารางโหลดเร็ว', {
    tag: ['@BOOK', '@P1'],
    annotation: { type: 'expected', description: 'ทุกสนามมี slot 8…23 = 16 ช่อง · ไม่มี slot-A-7 / slot-A-24 · book-start มีค่า 8…23 เท่านั้น (ไม่มี 7, 8.5) · ตารางโหลดจน data-ready ≤ 2 วินาที (NFR-08 วัดตอนรันเดี่ยว ทั้ง 3 เบราว์เซอร์)' },
  }, async ({ page }) => {
    let ms = 0;
    await test.step('เปิด /book?date=2026-10-12 จับเวลาจนพร้อม', async () => {
      const t0 = Date.now();
      await page.goto('/book?date=2026-10-12');
      await waitReady(page);
      await expect(page.getByTestId('slot-grid')).toBeVisible();
      ms = Date.now() - t0;
      test.info().annotations.push({ type: 'load-ms', description: String(ms) });
    });
    await test.step('ทุกสนามมีรอบ 08:00–23:00 ครบ 16 รอบ ไม่มี 07:00 / 24:00', async () => {
      for (const f of ['A', 'B', 'C']) {
        await expect(page.locator(`[data-testid^="slot-${f}-"][data-status]`)).toHaveCount(16);
        for (let h = 8; h <= 23; h++) await expect(page.getByTestId(`slot-${f}-${h}`)).toHaveCount(1);
        await expect(page.getByTestId(`slot-${f}-7`)).toHaveCount(0);
        await expect(page.getByTestId(`slot-${f}-24`)).toHaveCount(0);
      }
    });
    await test.step('ฟอร์มจอง: ตัวเลือกเวลาเริ่มมีแค่ 8…23 (ไม่มี 07:00, 08:30)', async () => {
      await open(page, '/book/new?field=A&date=2026-10-12&start=8');
      const values = await page.getByTestId('book-start').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ''));
      expect(values).toEqual(Array.from({ length: 16 }, (_, i) => String(i + 8)));
    });
    await test.step('NFR-08 ตารางว่างโหลดเสร็จ ≤ 2 วินาที', async () => {
      expect(ms, `โหลดตาราง ${ms} ms`).toBeLessThanOrEqual(2000);
    });
  });

});
