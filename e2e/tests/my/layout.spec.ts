import type { Page } from '@playwright/test';
import { test, expect, open } from '../fixtures';

/**
 * โครงหน้า (docs/UI-REDESIGN.md · S1/S2b): (1) ปุ่มแชทอยู่ในหัวเว็บ (sticky) ไม่ทับเนื้อหาที่ตำแหน่งเลื่อนทุกจุด ที่ 1280 และ 375
 * (2) หัวเว็บที่ 375 เป็นแถวเดียว (ไม่ตกหลายบรรทัด) และเปิดเมนูแล้วลิงก์ครบ (3) ไม่มี scroll แนวนอนระดับหน้า
 * อ่านอย่างเดียว ไม่แก้ข้อมูล
 */

const PAGES = ['/', '/fields', '/book', '/book/new?field=A&date=2026-10-14&start=17', '/my', '/series', '/challenges'];
const SIZES = [{ w: 1280, h: 800 }, { w: 375, h: 812 }];

/**
 * ปุ่มเปิดแชทอยู่ในหัวเว็บ (sticky · พื้นที่สงวนของโครงหน้า ไม่ใช่ปุ่มลอยทับเนื้อหา) ตรวจที่ตำแหน่งเลื่อนหลายจุด:
 *  (ก) ปุ่มอยู่ในกรอบหัวเว็บ · หัวเว็บติดบนสุด · ไม่ใช่ position:fixed · ไม่มีอะไรทับปุ่มเอง
 *  (ข) เนื้อหาเริ่มใต้หัวเว็บที่ scrollY=0 (ไม่มีเนื้อหาถูกหัวเว็บ/ปุ่มบังตั้งแต่เปิดหน้า)
 *  (ค) ทุกลิงก์/ปุ่ม/ช่องกรอก/ข้อความที่อยู่ในจอใต้หัวเว็บ มีตัวมันเองอยู่บนสุดที่จุดกึ่งกลาง (ไม่มี fixed/sticky อื่นทับ)
 */
async function auditAt(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('header.site-header')!;
    const hb = header.getBoundingClientRect();
    const btn = document.querySelector('[data-testid="chat-open"]');
    if (!btn) return { error: 'ไม่พบ chat-open' };
    const br = btn.getBoundingClientRect();
    const out: string[] = [];
    if (getComputedStyle(btn).position === 'fixed') out.push('ปุ่มแชทเป็น position:fixed');
    if (!(br.left >= hb.left && br.right <= hb.right && br.top >= hb.top - 0.5 && br.bottom <= hb.bottom + 0.5)) out.push('ปุ่มแชทอยู่นอกกรอบหัวเว็บ');
    if (Math.abs(hb.top) > 0.5) out.push('หัวเว็บไม่ติดบนสุด top=' + hb.top);
    const hit = document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2);
    if (hit !== btn && !btn.contains(hit)) out.push('มีของอื่นทับปุ่มแชท');
    const overlay = (e: Element | null) => {
      for (let n: Element | null = e; n && n !== document.body; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === 'fixed' || p === 'sticky') return n;
      }
      return null;
    };
    for (const el of document.querySelectorAll('#main *, footer *')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const interactive = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
      if (!interactive && !ownText) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cy < hb.bottom || cy > innerHeight || cx < 0 || cx > innerWidth) continue; // นอกจอ หรือเลื่อนอยู่ใต้หัวเว็บ (ปกติของหัวเว็บ sticky)
      const h = document.elementFromPoint(cx, cy);
      const o = overlay(h);
      if (o && o !== overlay(el)) {
        out.push(`${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''} ถูกทับโดย ${o.tagName.toLowerCase()}.${String(o.className).slice(0, 30)}`);
      }
    }
    return { hits: out, headerBottom: hb.bottom, mainTop: document.getElementById('main')!.getBoundingClientRect().top + scrollY };
  });
}

for (const size of SIZES) {
  test.describe(`โครงหน้า @${size.w}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: size.w, height: size.h });
    });

    test(`ปุ่มแชทอยู่ในหัวเว็บ ไม่ทับเนื้อหาที่ตำแหน่งเลื่อนทุกจุด @${size.w}`, {
      annotation: [{ type: 'expected', description: 'ทุกหน้าหลัก เลื่อนที่ 0/25/50/75/100%: ปุ่ม chat-open อยู่ในหัวเว็บ sticky (ไม่ fixed) · เนื้อหาเริ่มใต้หัวเว็บ · ไม่มีลิงก์/ปุ่ม/ช่องกรอก/ข้อความในจอถูก fixed/sticky ทับ' }],
    }, async ({ page }) => {
      for (const route of PAGES) {
        await test.step(`${route}`, async () => {
          await open(page, route);
          const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
          for (const f of [0, 0.25, 0.5, 0.75, 1]) {
            await page.evaluate((y) => window.scrollTo(0, y), Math.round(total * f));
            await page.waitForTimeout(80);
            const r = await auditAt(page);
            expect(r.error, route).toBeUndefined();
            expect(r.hits, `${route} @${Math.round(f * 100)}%`).toEqual([]);
            if (f === 0) expect(r.mainTop, `${route}: เนื้อหาเริ่มใต้หัวเว็บ`).toBeGreaterThanOrEqual(r.headerBottom! - 1);
          }
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
  await expect(page.getByTestId('chat-open')).toBeVisible();
  await expect(page.getByTestId('nav-book')).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  for (const id of ['nav-home', 'nav-book', 'nav-fields', 'nav-challenges', 'nav-series', 'nav-my', 'nav-staff-login']) {
    await expect(page.getByTestId(id), id).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
});

test('หัวเว็บที่ 1280 แสดงเมนูเต็ม ไม่มีปุ่มเมนู · ปุ่มแชทเห็นพร้อมข้อความเต็ม', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '/');
  await expect(page.locator('.menu-btn')).toBeHidden();
  for (const id of ['nav-home', 'nav-book', 'nav-fields', 'nav-challenges', 'nav-series', 'nav-my', 'nav-staff-login']) {
    await expect(page.getByTestId(id), id).toBeVisible();
  }
  await expect(page.getByTestId('chat-open')).toBeVisible();
  await expect(page.getByTestId('chat-open')).toContainText('แชทกับน้องบอล');
  const h = await page.locator('header.site-header').evaluate((el) => el.getBoundingClientRect().height);
  expect(h, 'หัวเว็บแถวเดียว').toBeLessThanOrEqual(80);
});
