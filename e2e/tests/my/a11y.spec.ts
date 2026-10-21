import * as fs from 'node:fs';
import * as path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, open, waitReady } from '../fixtures';
import { SEED } from '../constants';

/**
 * ตรวจการเข้าถึง (a11y) ด้วย axe-core ทุกหน้าหลัก ภาษาไทย ที่ 1280 และ 375 (docs/UI-REDESIGN.md §6 ชิ้น S0/S5)
 * กฎที่ใช้: wcag2a · wcag2aa · wcag21aa · อ่านอย่างเดียว (ไม่ reset ไม่สร้างข้อมูล ไม่แก้ข้อมูล) · รันเฉพาะ chromium
 *
 * ตอนนี้ (ก่อนรีดีไซน์ S0) = รายงานจำนวนเฉย ๆ ไม่ทำให้ล้ม · ชิ้น S5 เปิดเป็นประตู: A11Y_GATE=1 → ล้มถ้ามี serious/critical
 * บันทึกผลลง JSON: AXE_OUT=axe-before.json (เขียนที่ docs/ui/) เช่น
 *   cd e2e && AXE_OUT=axe-before.json npx playwright test tests/my/a11y.spec.ts --project=chromium --no-deps
 * ไม่ตั้ง AXE_OUT = ไม่เขียนไฟล์ (พิมพ์ตารางสรุป + แนบ annotation เท่านั้น)
 */

type Viol = { id: string; impact: string | null; help: string; helpUrl: string; nodes: number; samples: { target: string; html: string; data?: unknown }[] };
type Rec = { page: string; width: number; url: string; error?: string; counts: Record<string, number>; violations: Viol[] };

const DATE = '2026-10-14';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];
const SIZES = [{ w: 1280, h: 800 }, { w: 375, h: 812 }];
const OUT_DIR = path.resolve(__dirname, '..', '..', '..', 'docs', 'ui');

type Target = { name: string; route: string; role: 'anon' | 'member' | 'owner' | 'manager' | 'staff'; before?: (page: Page) => Promise<void> };
const TARGETS: Target[] = [
  { name: 'home', route: '/', role: 'anon' },
  { name: 'fields', route: '/fields', role: 'anon' },
  { name: 'book', route: '/book', role: 'anon' },
  { name: 'book-new', route: `/book/new?field=A&date=${DATE}&start=17`, role: 'anon' },
  { name: 'booking-gate', route: '/booking/LN-900004', role: 'anon' },
  {
    name: 'booking', route: '/booking/LN-900004', role: 'anon',
    before: async (page) => {
      await page.getByTestId('gate-phone').fill(SEED.nan.phone);
      await page.getByTestId('gate-phone').press('Enter');
      await expect(page.getByTestId('booking-code')).toBeVisible();
    },
  },
  { name: 'my-login', route: '/my', role: 'anon' },
  { name: 'my', route: '/my', role: 'member' },
  { name: 'challenges', route: '/challenges', role: 'anon' },
  { name: 'series', route: '/series', role: 'anon' },
  { name: 'staff-login', route: '/staff/login', role: 'anon' },
  { name: 'staff', route: '/staff', role: 'staff' },
  { name: 'staff-today', route: '/staff/today', role: 'manager' },
  { name: 'manager-stock', route: '/manager/stock', role: 'manager' },
  { name: 'owner', route: '/owner', role: 'owner' },
  { name: 'owner-dashboard', route: '/owner/dashboard', role: 'owner' },
  { name: 'owner-bookings', route: '/owner/bookings', role: 'owner' },
  { name: 'owner-reports', route: '/owner/reports', role: 'owner' },
];

async function loginAs(page: Page, role: Target['role']) {
  if (role === 'anon') return;
  const r = role === 'member'
    ? await page.request.post('/api/customers/login', { data: { phone: SEED.ton.phone, password: SEED.ton.password } })
    : await page.request.post('/api/staff/login', { data: { username: SEED[role].username, password: SEED[role].password } });
  expect(r.status(), `เข้าสู่ระบบ ${role}`).toBe(200);
}

function summarize(results: Awaited<ReturnType<AxeBuilder['analyze']>>): Pick<Rec, 'counts' | 'violations'> {
  const counts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, nodes: 0 };
  const violations: Viol[] = results.violations.map((v) => {
    const imp = v.impact ?? 'minor';
    counts[imp] = (counts[imp] ?? 0) + 1;
    counts.total += 1;
    counts.nodes += v.nodes.length;
    return {
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      samples: v.nodes.slice(0, 5).map((n) => ({
        target: n.target.join(' '),
        html: n.html.slice(0, 160),
        // color-contrast: เก็บสีหน้า/หลัง/อัตราส่วนไว้ให้เห็นว่าคู่ไหนไม่ผ่าน
        data: v.id === 'color-contrast' ? (n.any[0]?.data ?? undefined) : undefined,
      })),
    };
  });
  return { counts, violations };
}

test.describe('a11y (axe) — wcag2a/2aa/21aa', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe รันที่ chromium เท่านั้น');
  test.describe.configure({ timeout: 300_000 });

  test('สแกน axe ทุกหน้าหลัก ไทย 1280 และ 375 — รายงานจำนวน', {
    annotation: [
      { type: 'expected', description: 'ทุกหน้าโหลดได้และสแกนครบ · ก่อนรีดีไซน์: รายงานจำนวนเฉย ๆ (ไม่ล้ม) · ชิ้น S5: A11Y_GATE=1 ต้องไม่มี serious/critical' },
      { type: 'ที่มา', description: 'docs/UI-REDESIGN.md §6 S0/S5' },
    ],
  }, async ({ browser }) => {
    const all: Rec[] = [];
    for (const size of SIZES) {
      const contexts = new Map<string, Awaited<ReturnType<typeof browser.newContext>>>();
      for (const t of TARGETS) {
        const key = t.role;
        let ctx = contexts.get(key);
        if (!ctx) {
          ctx = await browser.newContext({
            baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
            viewport: { width: size.w, height: size.h },
            locale: 'th-TH',
            timezoneId: 'Asia/Bangkok',
          });
          await ctx.addCookies([{ name: 'lang', value: 'th', url: process.env.BASE_URL ?? 'http://localhost:3000' }]);
          contexts.set(key, ctx);
          const p0 = await ctx.newPage();
          await loginAs(p0, t.role);
          await p0.close();
        }
        const page = await ctx.newPage();
        const rec: Rec = { page: t.name, width: size.w, url: t.route, counts: {}, violations: [] };
        await test.step(`${t.name} @${size.w}`, async () => {
          try {
            await open(page, t.route);
            if (t.before) await t.before(page);
            await waitReady(page);
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
            const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
            Object.assign(rec, summarize(results));
          } catch (e) {
            rec.error = String((e as Error).message ?? e).split('\n')[0];
          }
        });
        all.push(rec);
        await page.close();
      }
      for (const c of contexts.values()) await c.close();
    }

    // ---- รายงาน
    const lines = ['หน้า | จอ | critical | serious | moderate | minor | node'];
    for (const r of all) {
      lines.push(`${r.page.padEnd(16)} | ${String(r.width).padEnd(4)} | ${r.error ? 'ERR ' + r.error : [r.counts.critical, r.counts.serious, r.counts.moderate, r.counts.minor, r.counts.nodes].join(' | ')}`);
    }
    const sum = (k: string) => all.reduce((s, r) => s + (r.counts[k] ?? 0), 0);
    const totals = { critical: sum('critical'), serious: sum('serious'), moderate: sum('moderate'), minor: sum('minor'), pages: all.length, errors: all.filter((r) => r.error).length };
    const ruleCounts = new Map<string, { impact: string | null; pages: number; nodes: number }>();
    for (const r of all) for (const v of r.violations) {
      const c = ruleCounts.get(v.id) ?? { impact: v.impact, pages: 0, nodes: 0 };
      c.pages += 1; c.nodes += v.nodes;
      ruleCounts.set(v.id, c);
    }
    const byRule = [...ruleCounts.entries()].sort((a, b) => b[1].nodes - a[1].nodes).map(([id, c]) => `${id} (${c.impact}) หน้า×จอ ${c.pages} · node ${c.nodes}`);
    // eslint-disable-next-line no-console
    console.log(`\n[a11y] ${JSON.stringify(totals)}\n${lines.join('\n')}\nกฎที่พบ:\n  ${byRule.join('\n  ')}\n`);
    test.info().annotations.push({ type: 'a11y-totals', description: JSON.stringify(totals) });

    if (process.env.AXE_OUT) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, process.env.AXE_OUT), JSON.stringify({ tags: TAGS, lang: 'th', totals, byRule: Object.fromEntries(ruleCounts), results: all }, null, 1));
    }

    expect(totals.errors, 'ทุกหน้าต้องสแกนได้ (ไม่มี ERR)').toBe(0);
    if (process.env.A11Y_GATE === '1') {
      expect(totals.critical + totals.serious, 'ประตู a11y: ห้ามมี serious/critical').toBe(0);
    }
  });
});
