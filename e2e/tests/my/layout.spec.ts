import type { Page } from '@playwright/test';
import { test, expect, open } from '../fixtures';

/**
 * โครงหน้า (docs/UI-REDESIGN.md · S1): (1) ปุ่มแชทลอยไม่บังเนื้อหา/ลิงก์ท้ายหน้า ที่ 1280 และ 375
 * (2) หัวเว็บที่ 375 เป็นแถวเดียว (ไม่ตกหลายบรรทัด) และเปิดเมนูแล้วลิงก์ครบ (3) ไม่มี scroll แนวนอนระดับหน้า
 * อ่านอย่างเดียว ไม่แก้ข้อมูล
 */

const PAGES = ['/', '/fields', '/book', '/book/new?field=A&date=2026-10-14&start=17', '/my', '/series', '/challenges'];
const SIZES = [{ w: 1280, h: 800 }, { w: 375, h: 812 }];

/** ชนิดของ element ที่นับเป็น "เนื้อหา": ตัวที่มีข้อความตรง ๆ หรือควบคุมที่กดได้ */
async function overlapsWithFab(page: Page) {
  return page.evaluate(() => {
    const fab = document.querySelector('[data-testid="chat-open"]');
    if (!fab) return { error: 'ไม่พบ chat-open' };
    const f = fab.getBoundingClientRect();
    const hits: string[] = [];
    const roots = [document.getElementById('main'), document.querySelector('footer')];
    for (const root of roots) {
      if (!root) continue;
      for (const el of root.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const interactive = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
        if (!interactive && !ownText) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top) {
          hits.push(`${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`);
        }
      }
    }
    return { hits, fab: { x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.width), h: Math.round(f.height) } };
  });
}

for (const size of SIZES) {
  test.describe(`โครงหน้า @${size.w}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: size.w, height: size.h });
    });

    test(`ปุ่มแชทไม่บังเนื้อหาเมื่อเลื่อนถึงท้ายหน้า @${size.w}`, {
      annotation: [{ type: 'expected', description: 'ท้ายหน้าทุกหน้าหลัก ไม่มีข้อความ/ลิงก์/ปุ่ม/ช่องกรอกอยู่ใต้ปุ่ม chat-open' }],
    }, async ({ page }) => {
      for (const route of PAGES) {
        await test.step(`${route}`, async () => {
          await open(page, route);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(150);
          const r = await overlapsWithFab(page);
          expect(r.error, route).toBeUndefined();
          expect(r.hits, `${route}: ปุ่มแชท ${JSON.stringify(r.fab)} บังเนื้อหา`).toEqual([]);
        });
      }
    });

    test(`ไม่มี scroll แนวนอนระดับหน้า @${size.w}`, async ({ page }) => {
      for (const route of PAGES) {
        await open(page, route);
        const sw = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
        expect(sw, route).toBeLessThanOrEqual(size.w);
      }
    });
  });
}

test('หัวเว็บที่ 375 เป็นแถวเดียว · เมนูพับเปิดแล้วลิงก์ครบ', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, '/');
  const h = await page.locator('header.site-header').evaluate((el) => el.getBoundingClientRect().height);
  expect(h, 'หัวเว็บไม่ตกหลายแถว').toBeLessThanOrEqual(80);
  const btn = page.locator('.menu-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('lang-th')).toBeVisible();
  await expect(page.getByTestId('nav-book')).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  for (const id of ['nav-home', 'nav-book', 'nav-fields', 'nav-challenges', 'nav-series', 'nav-my', 'nav-staff-login']) {
    await expect(page.getByTestId(id), id).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
});

test('หัวเว็บที่ 1280 แสดงเมนูเต็ม ไม่มีปุ่มเมนู', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '/');
  await expect(page.locator('.menu-btn')).toBeHidden();
  for (const id of ['nav-home', 'nav-book', 'nav-fields', 'nav-challenges', 'nav-series', 'nav-my', 'nav-staff-login']) {
    await expect(page.getByTestId(id), id).toBeVisible();
  }
});
