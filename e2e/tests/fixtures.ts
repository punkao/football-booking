import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
  type Locator,
  type TestInfo,
} from '@playwright/test';
import { BASE_URL, LOCKED_NOW, SEED } from './constants';

export { expect };
export const GIF = process.env.GIF === '1';

/** ลำดับเบราว์เซอร์ ใช้แยกวัน/สนามไม่ให้ชนกันตอนรันพร้อมกัน: chromium 0 · firefox 1 · webkit 2 · serial 3 */
export function browserIndex(projectName: string): number {
  return ({ chromium: 0, firefox: 1, webkit: 2, serial: 3 } as Record<string, number>)[projectName] ?? 0;
}

// ---------------------------------------------------------------- GIF overlay
/** ป้ายชื่อ test มุมซ้ายล่าง + วงแดงตรงจุดคลิก (ติดตั้งหลังหน้า hydrate แล้ว เพื่อไม่รบกวน React) */
function gifOverlay(title: string) {
  const install = () => {
    if (!document.documentElement || document.getElementById('__pw_label')) return;
    const l = document.createElement('div');
    l.id = '__pw_label';
    l.textContent = title;
    l.setAttribute('aria-hidden', 'true');
    Object.assign(l.style, {
      position: 'fixed', left: '8px', bottom: '8px', zIndex: '2147483647', maxWidth: '75vw',
      background: 'rgba(17,17,17,.82)', color: '#fff', font: '600 14px/1.35 system-ui, sans-serif',
      padding: '6px 10px', borderRadius: '6px', pointerEvents: 'none', boxShadow: '0 2px 6px rgba(0,0,0,.4)',
    } as CSSStyleDeclaration);
    document.documentElement.appendChild(l);
  };
  const whenReady = () => {
    if (document.documentElement?.getAttribute('data-ready') === 'true') { install(); return true; }
    return false;
  };
  const timer = setInterval(() => { whenReady(); }, 300);
  window.addEventListener('beforeunload', () => clearInterval(timer));
  document.addEventListener('pointerdown', (e) => {
    const c = document.createElement('div');
    Object.assign(c.style, {
      position: 'fixed', left: `${e.clientX - 18}px`, top: `${e.clientY - 18}px`, width: '36px', height: '36px',
      border: '4px solid #e00', borderRadius: '50%', background: 'rgba(255,0,0,.18)', zIndex: '2147483647',
      pointerEvents: 'none', transition: 'opacity .9s ease-out', opacity: '1',
    } as CSSStyleDeclaration);
    document.documentElement.appendChild(c);
    setTimeout(() => { c.style.opacity = '0'; }, 700);
    setTimeout(() => c.remove(), 1700);
  }, true);
}

async function installGif(page: Page, title: string) {
  await page.addInitScript(gifOverlay, title);
}

// ---------------------------------------------------------------- fixtures
type Fixtures = {
  /** ลำดับเบราว์เซอร์ 0/1/2 (serial = 3) */
  b: number;
  /** เลือกข้อมูลตามเบราว์เซอร์ [chromium, firefox, webkit] (serial ใช้ตัวแรก) */
  pick: <T>(v: readonly [T, T, T]) => T;
  /** console error ของหน้า (กรอง "Failed to load resource" 4xx ที่ตั้งใจให้เกิด) */
  consoleErrors: string[];
  /** เปิดเบราว์เซอร์อีกคน (context แยก cookie) เช่น ทีมคู่แข่ง — โหมด GIF อัดวิดีโอด้วย */
  newUserPage: () => Promise<Page>;
  /** API ที่เข้าสู่ระบบฝั่งร้านแล้ว (context แยก) */
  staffApi: (role: 'owner' | 'manager' | 'staff') => Promise<APIRequestContext>;
  /** API เปล่า (ไม่มี cookie) */
  anonApi: () => Promise<APIRequestContext>;
};

export const test = base.extend<Fixtures>({
  b: async ({}, use, testInfo) => {
    await use(browserIndex(testInfo.project.name));
  },
  pick: async ({ b }, use) => {
    await use(<T,>(v: readonly [T, T, T]) => v[b > 2 ? 0 : b]);
  },
  page: async ({ page }, use, testInfo) => {
    if (GIF) await installGif(page, testInfo.title);
    await use(page);
    if (GIF) await page.waitForTimeout(2500).catch(() => {}); // ค้างเฟรมสุดท้าย 2.5 วินาที
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const t = msg.text();
      if (/Failed to load resource/i.test(t) && /\b4\d\d\b/.test(t)) return; // 4xx ที่ตั้งใจ
      errors.push(t);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
  },
  newUserPage: async ({ browser }, use, testInfo) => {
    const made: Page[] = [];
    await use(async () => {
      const ctx = await browser.newContext({
        baseURL: BASE_URL,
        viewport: { width: 1280, height: 800 },
        locale: 'th-TH',
        timezoneId: 'Asia/Bangkok',
        ...(GIF ? { recordVideo: { dir: testInfo.outputPath('extra-videos'), size: { width: 1280, height: 800 } } } : {}),
      });
      const p = await ctx.newPage();
      if (GIF) await installGif(p, `${testInfo.title} (ผู้ใช้คนที่ ${made.length + 2})`);
      made.push(p);
      return p;
    });
    for (const p of made) {
      if (GIF) await p.waitForTimeout(2500).catch(() => {});
      const v = p.video();
      await p.context().close();
      if (v) testInfo.attachments.push({ name: 'video-extra', path: await v.path(), contentType: 'video/webm' });
    }
  },
  staffApi: async ({ playwright }, use) => {
    const made: APIRequestContext[] = [];
    await use(async (role) => {
      const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
      const r = await ctx.post('/api/staff/login', { data: { username: SEED[role].username, password: SEED[role].password } });
      expect(r.status(), `เข้าสู่ระบบร้านด้วย ${role} ไม่สำเร็จ`).toBe(200);
      made.push(ctx);
      return ctx;
    });
    for (const c of made) await c.dispose();
  },
  anonApi: async ({ playwright }, use) => {
    const made: APIRequestContext[] = [];
    await use(async () => {
      const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
      made.push(ctx);
      return ctx;
    });
    for (const c of made) await c.dispose();
  },
});

// ---------------------------------------------------------------- helpers: หน้าเว็บ
/** เปิด path แล้วรอ <html data-ready="true"> */
export async function open(page: Page, path: string) {
  try {
    await page.goto(path);
  } catch (e) {
    // หน้าเดิมยังเปลี่ยนเส้นทางค้างอยู่ (เช่น router.refresh หลังกดปุ่ม) Firefox/WebKit จะยกเลิก goto → ลองใหม่ 1 ครั้ง
    if (!/NS_BINDING_ABORTED|ERR_ABORTED|Frame load interrupted|interrupted by another navigation|Navigation .* is interrupted/i.test(String(e))) throw e;
    await page.waitForLoadState('load').catch(() => {});
    await page.goto(path);
  }
  await waitReady(page);
}

export async function waitReady(page: Page) {
  await page.locator('html[data-ready="true"]').waitFor({ state: 'attached', timeout: 20_000 });
}

/** ค่า data-value ของ element (ตัวเลขเงิน/สถานะ) */
export async function dv(loc: Locator): Promise<string | null> {
  return loc.getAttribute('data-value');
}

export function baht(n: number) {
  return `฿${n.toLocaleString('en-US')}`;
}

/** เติมฟอร์มจอง /book/new ที่เปิดอยู่ แล้วรอราคาคำนวณเสร็จ */
export async function fillBookingForm(page: Page, o: { name?: string; phone?: string; consent?: boolean; hours?: number }) {
  if (o.hours !== undefined) await page.getByTestId('book-hours').fill(String(o.hours));
  if (o.name !== undefined) await page.getByTestId('customer-name').fill(o.name);
  if (o.phone !== undefined) await page.getByTestId('customer-phone').fill(o.phone);
  if (o.consent !== undefined) await setCheckedStable(page.getByTestId('pdpa-consent'), o.consent);
}

/**
 * ติ๊ก/เอาติ๊กออกแบบรอให้ค่าติดจริง — ฟอร์มคำนวณราคาใหม่ (data-ready=false ชั่วคราว) ทุกครั้งที่เปลี่ยนค่า
 * ถ้ากดตรงช่วง re-render ค่าอาจเด้งกลับ จึงลองซ้ำจนกว่าสถานะจะเป็นตามที่ต้องการ
 * รอสัญญาณพร้อมจริง (data-ready=true) ก่อนกดทุกรอบ · ไม่ตั้งเวลา click สั้นเอง: WebKit ตอนเครื่องแน่น
 * ใช้เวลาหลายร้อย ms ต่อขั้น (resolve/visible/stable/scroll) รวมเกิน 2 วิได้ ทั้งที่ปุ่มพร้อมกดแล้ว (ดู ORACLE-CHANGES)
 */
export async function setCheckedStable(loc: Locator, checked: boolean) {
  await expect(async () => {
    await waitReady(loc.page());
    if ((await loc.isChecked()) !== checked) await loc.click({ timeout: 10_000 });
    if (checked) await expect(loc).toBeChecked({ timeout: 5000 });
    else await expect(loc).not.toBeChecked({ timeout: 5000 });
  }).toPass({ timeout: 30_000 });
}

/** กดปุ่มที่อาจถูก render ใหม่ระหว่างกด (ลองซ้ำจนกดได้) */
export async function clickStable(loc: Locator) {
  await expect(async () => { await loc.click({ timeout: 3000 }); }).toPass({ timeout: 20_000 });
}

// ---------------------------------------------------------------- helpers: ข้อมูล
let seq = 0;
/** เบอร์ไม่ซ้ำ 10 หลักขึ้นต้น 09 + ลำดับเบราว์เซอร์ */
export function uniquePhone(b: number): string {
  seq = (seq + 1) % 100;
  const rnd = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `09${b}${rnd}${seq.toString().padStart(2, '0')}`;
}

export type Json = Record<string, any>;

export async function postJson(req: APIRequestContext, url: string, data: Json = {}) {
  const r = await req.post(url, { data });
  let body: any = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status(), body };
}

export async function getJson(req: APIRequestContext, url: string) {
  const r = await req.get(url);
  let body: any = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status(), body };
}

export type NewBooking = {
  fieldId: 'A' | 'B' | 'C';
  date: string;
  startHour: number;
  hours?: number;
  name?: string;
  phone: string;
  rentals?: { BIB?: number; BALL?: number };
  useCredit?: boolean;
  creditUsed?: number;
  useFreeHour?: boolean;
};

/** สร้างการจองผ่าน API (ต้องได้ 201) */
export async function createBooking(req: APIRequestContext, o: NewBooking) {
  const res = await postJson(req, '/api/bookings', {
    fieldId: o.fieldId, date: o.date, startHour: o.startHour, hours: o.hours ?? 1,
    rentals: o.rentals, useCredit: o.useCredit, creditUsed: o.creditUsed, useFreeHour: o.useFreeHour,
    name: o.name ?? 'ผู้ทดสอบ', phone: o.phone, consent: true,
  });
  expect(res.status, `สร้างการจอง ${o.fieldId} ${o.date} ${o.startHour}:00 ไม่สำเร็จ: ${JSON.stringify(res.body)}`).toBe(201);
  return res.body.booking as Json;
}

export async function payBooking(req: APIRequestContext, code: string, phone?: string) {
  const res = await postJson(req, `/api/bookings/${code}/pay`, phone ? { phone } : {});
  expect(res.status, `จ่าย ${code} ไม่สำเร็จ: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body;
}

export async function getBooking(req: APIRequestContext, code: string, phone?: string) {
  return getJson(req, `/api/bookings/${code}${phone ? `?phone=${phone}` : ''}`);
}

export async function registerCustomer(req: APIRequestContext, o: { name: string; phone: string; password?: string }) {
  const res = await postJson(req, '/api/customers/register', { name: o.name, phone: o.phone, password: o.password ?? 'Test12345', consent: true });
  expect(res.status, `สมัครสมาชิก ${o.phone} ไม่สำเร็จ: ${JSON.stringify(res.body)}`).toBe(201);
  return res.body;
}

export async function loginCustomer(req: APIRequestContext, phone: string, password: string) {
  const res = await postJson(req, '/api/customers/login', { phone, password });
  expect(res.status, `เข้าสู่ระบบสมาชิก ${phone} ไม่สำเร็จ`).toBe(200);
  return res.body;
}

export async function staffLoginPage(page: Page, role: 'owner' | 'manager' | 'staff') {
  const res = await postJson(page.request, '/api/staff/login', { username: SEED[role].username, password: SEED[role].password });
  expect(res.status, `เข้าสู่ระบบร้านด้วย ${role} ไม่สำเร็จ`).toBe(200);
  return res.body;
}

// ---------------------------------------------------------------- helpers: เวลา (ใช้เฉพาะ *.serial.spec.ts)
export async function resetData(req: APIRequestContext, now: string = LOCKED_NOW) {
  const res = await postJson(req, '/api/test/reset', { now });
  expect(res.status, 'reset ไม่สำเร็จ').toBe(200);
  return res.body;
}

export async function setClock(req: APIRequestContext, now: string) {
  const res = await postJson(req, '/api/test/clock', { now });
  expect(res.status, `ตั้งเวลา ${now} ไม่สำเร็จ`).toBe(200);
  return res.body;
}

/** ข้อความ error ใน error-message (ตัดช่องว่างหัวท้าย) */
export async function expectError(page: Page, text: string) {
  await expect(page.getByTestId('error-message')).toBeVisible();
  await expect(page.getByTestId('error-message')).toContainText(text);
}

export async function expectSuccess(page: Page, text: string) {
  await expect(page.getByTestId('success-message')).toBeVisible();
  await expect(page.getByTestId('success-message')).toContainText(text);
}

export function tcTitle(info: TestInfo) {
  return info.title;
}
