import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, open } from '../fixtures';
import { asCustomer } from '../chat-helpers';

/**
 * แชทน้องบอล หน้าตาใหม่ (docs/UI-REDESIGN.md §4.1 · S2): แผงข้าง/เต็มจอ · ป้ายบอท · คำถามด่วน · การ์ดตั๋ว · คีย์บอร์ด · ลดการเคลื่อนไหว
 * ไม่แก้ข้อมูลของร้าน (แชทสร้างห้อง/ข้อความของลูกค้าสมมติ IP แยกต่อ test) · ไม่แก้ test เดิม
 */

const rect = (page: Page, tid: string) =>
  page.evaluate((id) => {
    const e = document.querySelector(`[data-testid="${id}"]`);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
  }, tid);

const scrollWidth = (page: Page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));

async function openChat(page: Page) {
  await page.getByTestId('chat-open').click();
  await expect(page.getByTestId('chat-panel')).toBeVisible();
}

async function ask(page: Page, text: string) {
  const bots = page.getByTestId('chat-msg-bot');
  const before = await bots.count();
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-send').click();
  await expect(bots).toHaveCount(before + 1, { timeout: 60_000 });
  await expect(page.getByTestId('chat-widget')).toHaveAttribute('data-chat-state', 'idle');
}

test.describe('แชท · เลย์เอาต์', () => {
  test('1280: แผงข้างเต็มสูง เนื้อหาถอยซ้าย ไม่ถูกแผงบัง', {
    annotation: [{ type: 'expected', description: 'เปิดแชทที่ 1280: ขอบซ้ายแผง ≥ ขอบขวาของ #main · แผงสูงจากใต้หัวเว็บถึงก้นจอ · ปุ่มเปิดไม่ทับแผง · ไม่มี scroll แนวนอน · ปิดแล้วเนื้อหากลับมาเต็มความกว้าง' }],
  }, async ({ page, b }) => {
    await asCustomer(page, b);
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const route of ['/', '/book', '/fields']) {
      await test.step(`เปิดแชทที่ ${route}`, async () => {
        await open(page, route);
        const wide = await rect(page, 'chat-open');
        await openChat(page);
        const panel = (await rect(page, 'chat-panel'))!;
        const main = await page.locator('#main').evaluate((e) => e.getBoundingClientRect().right);
        const header = await page.locator('header.site-header').evaluate((e) => e.getBoundingClientRect().bottom);
        expect(main, `${route}: #main ต้องไม่ล้ำเข้าแผง`).toBeLessThanOrEqual(panel.x + 1);
        expect(panel.w).toBeGreaterThanOrEqual(380);
        expect(panel.y, 'แผงเริ่มใต้หัวเว็บ').toBeGreaterThanOrEqual(header - 1);
        expect(panel.b, 'แผงสูงถึงก้นจอ').toBeGreaterThanOrEqual(799);
        const fab = (await rect(page, 'chat-open'))!;
        expect(fab.r, 'ปุ่มเปิดไม่ทับแผง').toBeLessThanOrEqual(panel.x + 1);
        expect(wide).not.toBeNull();
        expect(await scrollWidth(page)).toBeLessThanOrEqual(1280);
        // ท้ายหน้า: ไม่มีข้อความ/ลิงก์ใต้ปุ่มเปิด
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const hits = await page.evaluate(() => {
          const f = document.querySelector('[data-testid="chat-open"]')!.getBoundingClientRect();
          const out: string[] = [];
          for (const el of document.querySelectorAll('#main *, footer *')) {
            const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
            if (!own && !/^(A|BUTTON|INPUT|SELECT)$/.test(el.tagName)) continue;
            const r = el.getBoundingClientRect();
            if (r.width && r.height && r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top) out.push(el.tagName + ':' + (el.textContent ?? '').trim().slice(0, 20));
          }
          return out;
        });
        expect(hits, `${route}: ปุ่มเปิดทับเนื้อหาท้ายหน้า`).toEqual([]);
        await page.getByTestId('chat-close').click();
        await expect(page.getByTestId('chat-panel')).toHaveCount(0);
        const mainAfter = await page.locator('#main').evaluate((e) => e.getBoundingClientRect().right);
        expect(mainAfter, 'ปิดแล้วเนื้อหาเต็มกว้างอีกครั้ง').toBeGreaterThanOrEqual(1200);
      });
    }
  });

  test('375: เต็มจอ ปุ่มเปิดซ่อนขณะเปิด ช่องพิมพ์/ปุ่มส่ง/ปุ่มปิดอยู่ในจอ', {
    annotation: [{ type: 'expected', description: 'เปิดแชทที่ 375×812: แผงคลุมทั้งจอ · ปุ่มปิด ≥ 44×44 · scrollWidth ≤ 375 · หน้าหลังแผงเลื่อนไม่ได้ · ปิดแล้วปุ่มเปิดกลับมา' }],
  }, async ({ page, b }) => {
    await asCustomer(page, b);
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/book');
    await openChat(page);
    await expect.poll(async () => { const r = (await rect(page, 'chat-panel'))!; return [r.x, r.y, r.w, Math.round(r.h)]; }, { message: 'แผงคลุมทั้งจอ (หลังแอนิเมชัน 200ms)' }).toEqual([0, 0, 375, 812]);
    await expect(page.getByTestId('chat-open')).toBeHidden();
    const x = (await rect(page, 'chat-close'))!;
    expect(x.w).toBeGreaterThanOrEqual(44);
    expect(x.h).toBeGreaterThanOrEqual(44);
    for (const id of ['chat-input', 'chat-send', 'chat-close']) {
      const r = (await rect(page, id))!;
      expect(r.x >= 0 && r.r <= 375 && r.y >= 0 && r.b <= 812, `${id} อยู่ในจอ`).toBe(true);
    }
    expect(await scrollWidth(page)).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await expect(page.getByTestId('chat-panel')).toHaveAttribute('role', 'dialog');
    await page.getByTestId('chat-close').click();
    await expect(page.getByTestId('chat-open')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });
});

test.describe('แชท · บอกว่าเป็นบอท + คำถามด่วน', () => {
  for (const lang of ['th', 'en'] as const) {
    test(`ป้ายบอท ทำได้/ทำไม่ได้ และคำถามด่วน 4 ปุ่ม (${lang})`, {
      annotation: [{ type: 'expected', description: 'หัวแผงมี h2 "น้องบอล"/"Nong Ball" + ป้ายบอทนอก h2 + คำบรรยาย · ข้อความต้อนรับบอกว่าเป็นบอท + รายการทำได้/ทำไม่ได้ · ชิป 4 ปุ่ม · EN ไม่มีอักษรไทย' }],
    }, async ({ page, b, context }) => {
      await asCustomer(page, b);
      await context.addCookies([{ name: 'lang', value: lang, url: 'http://localhost:3000' }]);
      await open(page, '/');
      await openChat(page);
      const panel = page.getByTestId('chat-panel');
      const h2 = panel.locator('h2');
      await expect(h2).toHaveText(lang === 'th' ? 'น้องบอล' : 'Nong Ball');
      await expect(panel.locator('.chat-badge')).toHaveText(lang === 'th' ? 'บอท' : 'Bot');
      expect(await panel.locator('h2 .chat-badge').count(), 'ป้ายอยู่นอก h2').toBe(0);
      const welcome = page.getByTestId('chat-welcome');
      await expect(welcome).toContainText(lang === 'th' ? 'ไม่ใช่เจ้าหน้าที่' : 'not a staff member');
      await expect(welcome.locator('.chat-caps .yes li')).toHaveCount(3);
      await expect(welcome.locator('.chat-caps .no li')).toHaveCount(3);
      for (const id of ['price', 'avail', 'book', 'hours']) await expect(page.getByTestId(`chat-quick-${id}`)).toBeVisible();
      if (lang === 'en') expect(await panel.innerText(), 'EN ไม่มีอักษรไทย').not.toMatch(/[฀-๿]/);
    });

    test(`กดชิปคำถามด่วนแล้วส่งข้อความธรรมดาผ่านช่องทางเดิม (${lang})`, {
      annotation: [{ type: 'expected', description: 'กดชิป "ราคา" → มีข้อความผู้ใช้ 1 ข้อความ (คำถามที่กำหนด) + คำตอบบอท 1 ข้อความที่ถูกต้อง · ชิปย้ายเป็นแถบเหนือช่องพิมพ์ · chat-msg-user/bot ไม่เพิ่มจากตัวชิป' }],
    }, async ({ page, b, context }) => {
      await asCustomer(page, b);
      await context.addCookies([{ name: 'lang', value: lang, url: 'http://localhost:3000' }]);
      await open(page, '/');
      await openChat(page);
      const q = lang === 'th' ? 'ราคาสนามเท่าไร' : 'How much is a field?';
      await expect(page.getByTestId('chat-msg-user')).toHaveCount(0);
      await page.getByTestId('chat-quick-price').click();
      await expect(page.getByTestId('chat-msg-user')).toHaveText(q);
      await expect(page.getByTestId('chat-msg-bot')).toHaveCount(1, { timeout: 60_000 });
      await expect(page.getByTestId('chat-msg-bot')).toContainText(lang === 'th' ? '฿800' : 'THB 800');
      await expect(page.getByTestId('chat-welcome')).toHaveCount(0);
      await expect(page.locator('.chat-rail [data-testid^="chat-quick-"]')).toHaveCount(4);
      await page.getByTestId('chat-quick-hours').click();
      await expect(page.getByTestId('chat-msg-bot')).toHaveCount(2, { timeout: 60_000 });
      await expect(page.getByTestId('chat-msg-bot').last()).toContainText('08:00');
      await expect(page.getByTestId('chat-msg-user')).toHaveCount(2);
    });
  }
});

test('การ์ดราคาเป็นตั๋ว: ยอดรวม · จ่ายตอนนี้ | จ่ายหน้าสนาม', {
  annotation: [{ type: 'expected', description: 'ถาม "ศุกร์ 16 ต.ค. 16:00 สนาม A" → การ์ด quote เป็น .ticket มีรอยฉีก .perf และท่อน .stub · chat-quote-total 800 · chat-quote-pay-now 400 · ท่อน "จ่ายหน้าสนาม" 400 · อยู่พี่น้องเดียวกับ chat-msg-bot (wrapper เดิม)' }],
}, async ({ page, b }) => {
  await asCustomer(page, b);
  await open(page, '/');
  await openChat(page);
  await ask(page, 'ศุกร์ 16 ต.ค. 16:00 สนาม A');
  const card = page.getByTestId('chat-card-quote');
  await expect(card.locator('.ticket .perf')).toHaveCount(1);
  await expect(card.locator('.ticket .stub .now')).toBeVisible();
  await expect(card.getByTestId('chat-quote-total')).toHaveAttribute('data-value', '800');
  await expect(card.getByTestId('chat-quote-pay-now')).toHaveAttribute('data-value', '400');
  await expect(card.locator('.stub .later .v [data-value]')).toHaveAttribute('data-value', '400');
  await expect(card.locator('.stub .later')).toContainText('จ่ายหน้าสนาม');
  const sameWrapper = await page.getByTestId('chat-msg-bot').last().evaluate((m) => !!m.parentElement?.querySelector('[data-testid="chat-card-quote"]'));
  expect(sameWrapper, 'การ์ดอยู่ใน wrapper เดียวกับข้อความบอท').toBe(true);
  expect(await scrollWidth(page)).toBeLessThanOrEqual(1280);
});

test.describe('แชท · คีย์บอร์ดและการลดการเคลื่อนไหว', () => {
  test('เปิดแล้วโฟกัสเข้าแผง · Esc ปิดแล้วโฟกัสกลับที่ปุ่มเปิด · Tab ไปถึงทุกปุ่มสำคัญ', {
    annotation: [{ type: 'expected', description: '1280: กด Enter ที่ chat-open → โฟกัสที่ chat-input · Tab ถึงชิป/ส่ง/ปิดได้ · Esc ปิด · โฟกัสกลับ chat-open (aria-expanded=false)' }],
  }, async ({ page, b }) => {
    await asCustomer(page, b);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/');
    await page.getByTestId('chat-open').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    await expect(page.getByTestId('chat-input')).toBeFocused();
    const walk = async (key: string, n: number) => {
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) {
        await page.keyboard.press(key);
        const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
        if (id) seen.add(id);
      }
      return seen;
    };
    const back = await walk('Shift+Tab', 8);
    for (const id of ['chat-quick-hours', 'chat-quick-book', 'chat-quick-avail', 'chat-quick-price', 'chat-close']) expect(back.has(id), `Shift+Tab ถึง ${id}`).toBe(true);
    await page.getByTestId('chat-input').focus();
    expect((await walk('Tab', 1)).has('chat-open'), 'Tab จากช่องพิมพ์ไปที่ปุ่มเปิด/ปิดแชท').toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chat-panel')).toHaveCount(0);
    await expect(page.getByTestId('chat-open')).toBeFocused();
    await expect(page.getByTestId('chat-open')).toHaveAttribute('aria-expanded', 'false');
  });

  test('375: โฟกัสวนอยู่ในแผงเต็มจอ · Esc ปิด · โฟกัสกลับที่ปุ่มเปิด', {
    annotation: [{ type: 'expected', description: '375: เปิดแล้วโฟกัสที่แผง · กด Tab 25 ครั้งยังอยู่ในแผง · Shift+Tab จากแผงไปตัวสุดท้ายในแผง · Esc ปิดแล้ว chat-open ได้โฟกัส' }],
  }, async ({ page, b }) => {
    await asCustomer(page, b);
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/');
    await page.getByTestId('chat-open').click();
    await expect(page.getByTestId('chat-panel')).toBeFocused();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[data-testid="chat-panel"]'));
      expect(inside, `Tab ครั้งที่ ${i + 1} ออกนอกแผง`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chat-panel')).toHaveCount(0);
    await expect(page.getByTestId('chat-open')).toBeFocused();
  });

  test('prefers-reduced-motion: แผงไม่มีแอนิเมชัน', {
    annotation: [{ type: 'expected', description: 'ตั้ง reduced-motion แล้วเปิดแชท → ระยะเวลาแอนิเมชันของแผง ≤ 0.01 ms ; ปกติ = 200 ms' }],
  }, async ({ page, b }) => {
    await asCustomer(page, b);
    await page.setViewportSize({ width: 1280, height: 800 });
    const dur = async () => parseFloat(await page.getByTestId('chat-panel').evaluate((e) => getComputedStyle(e).animationDuration));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page, '/');
    await openChat(page);
    expect(await dur()).toBeGreaterThan(0.0001);
    await page.getByTestId('chat-close').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openChat(page);
    expect(await dur()).toBeLessThan(0.0001);
  });
});

for (const size of [{ w: 1280, h: 800 }, { w: 375, h: 812 }]) {
  test(`ปุ่มแชทไม่บังตัวที่โฟกัสด้วยคีย์บอร์ดขณะเลื่อนหน้า @${size.w}`, {
    annotation: [{ type: 'expected', description: 'กด Tab ไล่ทีละตัว (เบราว์เซอร์เลื่อนให้เห็นตัวที่โฟกัส) → ตัวที่โฟกัสไม่ซ้อนทับปุ่ม chat-open · หน้า /book/new และ /fields' }],
  }, async ({ page }) => {
    await page.setViewportSize({ width: size.w, height: size.h });
    for (const route of ['/fields', '/book/new?field=A&date=2026-10-14&start=17']) {
      await open(page, route);
      let n = 0;
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const r = await page.evaluate(async () => {
          await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); // ให้หน้าเลื่อนเสร็จก่อนวัด
          const a = document.activeElement as HTMLElement | null;
          const f = document.querySelector('[data-testid="chat-open"]')!;
          if (!a || a === document.body || a === f) return null;
          const x = a.getBoundingClientRect();
          const y = f.getBoundingClientRect();
          const ov = x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
          return { ov, what: `${a.tagName}[${a.getAttribute('data-testid') ?? ''}]` };
        });
        if (!r) continue;
        n++;
        expect(r.ov, `${route}: ${r.what} (Tab ครั้งที่ ${i + 1}) อยู่ใต้ปุ่มแชท`).toBe(false);
      }
      expect(n, 'มีตัวที่ Tab ถึงอย่างน้อย 10 ตัว').toBeGreaterThan(10);
    }
  });
}

test.describe('แชท · a11y (axe)', () => {
  for (const size of [{ w: 1280, h: 800 }, { w: 375, h: 812 }]) {
    test(`แผงแชทเปิด (ต้อนรับ + หลังส่งข้อความ + การ์ดตั๋ว) ไม่มี serious/critical @${size.w}`, {
      annotation: [{ type: 'expected', description: 'axe wcag2a/2aa/21aa: ไม่มี violation ระดับ serious หรือ critical ทั้งสถานะต้อนรับและหลังได้การ์ดราคา' }],
    }, async ({ page, b }) => {
      await asCustomer(page, b);
      await page.setViewportSize({ width: size.w, height: size.h });
      await open(page, '/');
      await openChat(page);
      await page.waitForTimeout(400); // รอแอนิเมชันเข้า 200ms
      const scan = async (label: string) => {
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), label).toEqual([]);
      };
      await scan('สถานะต้อนรับ');
      await ask(page, 'ศุกร์ 16 ต.ค. 16:00 สนาม A');
      await expect(page.getByTestId('chat-card-quote')).toBeVisible();
      await page.waitForTimeout(300);
      await scan('หลังได้การ์ดราคา');
    });
  }
});
