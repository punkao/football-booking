import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect, open, waitReady, uniquePhone, registerCustomer, createBooking, payBooking, postJson, getJson, resetData, setClock, fillBookingForm } from '../fixtures';
import { BASE_URL, SEED } from '../constants';
import { sql, staffLoginUi, memberLoginUi, T } from '../v2-helpers';
import { ChatLog, ChatRoom } from '../chat-helpers';

/**
 * เดินใบ UAT-CHECKLIST.md ทีละขั้นบนเว็บจริงเหมือนเจ้าของสนาม (บท 04 LAB 9 · docs/TEST-RUN-MCP.md)
 * ผลต่อขั้น (เห็นอะไร · ✅/❌ · ภาพ) เขียนที่ screenshots/uat/results-CR-0N.json แล้ว docs/UAT-RUN.md สร้างจากไฟล์เหล่านี้
 * ขั้น "ทีมทำ" ทำผ่าน /api/test/clock · docker exec psql (อ่านอย่างเดียว) ตามที่ใบกำหนด
 * รัน: cd e2e && npx playwright test tests/my/uat-walk.serial.spec.ts --project=serial --no-deps --reporter=list -g "CR-01"
 */

const OUT = path.resolve(__dirname, '..', '..', '..', 'screenshots', 'uat');
const TMP = process.env.UAT_TMP ?? path.resolve(__dirname, '..', '..', 'test-results', 'uat-tmp');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

type Row = { cr: string; step: string; status: 'ok' | 'fail' | 'skip' | 'partial'; saw: string[]; shots: string[]; notes: string[]; scriptError?: string };

class S {
  saw: string[] = [];
  notes: string[] = [];
  ok = true;
  shots: string[] = [];
  skipReason?: string;
  partial?: string;
  constructor(readonly cr: string, readonly step: string) {}
  say(t: string) { this.saw.push(t); }
  /** ข้อสังเกตเรื่องตัวใบ (ข้อความในใบไม่ตรง/ไม่ชัด) — ไม่นับเป็น ❌ ของระบบ */
  note(t: string) { this.notes.push(t); }
  check(label: string, cond: boolean, actual: string) {
    this.saw.push(`${cond ? '✓' : '✗'} ${label}: ${actual}`);
    if (!cond) this.ok = false;
  }
  /** เลื่อนให้ element อยู่ใต้เมนูบนสุดพอดี แล้วถ่าย */
  async shotTop(page: Page, suffix: string, target: Locator, offset = 110) {
    await target.evaluate((el, off) => { window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off); }, offset).catch(() => {});
    await this.shot(page, suffix);
  }
  async shot(page: Page, suffix = '', target?: Locator) {
    const name = `${this.cr}-${this.step}${suffix}.png`;
    try {
      if (target) await target.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });
      this.shots.push(`screenshots/uat/${name}`);
    } catch (e) {
      this.saw.push(`(ถ่ายภาพ ${name} ไม่ได้: ${String(e).slice(0, 80)})`);
    }
  }
}

const rows: Row[] = [];
function flush(cr: string) {
  fs.writeFileSync(path.join(OUT, `results-${cr}.json`), JSON.stringify(rows.filter((r) => r.cr === cr), null, 2));
}

async function rec(cr: string, step: string, fn: (s: S) => Promise<void>, lastPage?: () => Page | undefined) {
  const s = new S(cr, step);
  let scriptError: string | undefined;
  await test.step(`${cr} ขั้น ${step}`, async () => {
    try {
      await fn(s);
    } catch (e) {
      scriptError = String(e).split('\n').slice(0, 3).join(' ').slice(0, 400);
      s.ok = false;
      s.say(`⚠ สคริปต์สะดุด: ${scriptError}`);
      const p = lastPage?.();
      if (p) await s.shot(p, '-err');
    }
  });
  rows.push({ cr, step, status: s.skipReason ? 'skip' : s.partial ? 'partial' : s.ok ? 'ok' : 'fail', saw: s.skipReason ? [s.skipReason, ...s.saw] : s.partial ? [s.partial, ...s.saw] : s.saw, shots: s.shots, notes: s.notes, scriptError });
  flush(cr);
}

// ---------------------------------------------------------------- ตัวช่วยหน้าจอ
const ctxs: BrowserContext[] = [];
async function person(browser: Browser, withIp = false): Promise<Page> {
  const r = () => 1 + Math.floor(Math.random() * 250);
  const ctx = await browser.newContext({
    baseURL: BASE_URL, viewport: { width: 1280, height: 720 }, locale: 'th-TH', timezoneId: 'Asia/Bangkok',
    ...(withIp ? { extraHTTPHeaders: { 'X-Forwarded-For': `10.77.${r()}.${r()}` } } : {}),
  });
  ctxs.push(ctx);
  return ctx.newPage();
}
async function closeAll() {
  for (const c of ctxs.splice(0)) await c.close().catch(() => {});
}
const val = async (l: Locator) => Number(await l.getAttribute('data-value'));
const txt = async (l: Locator) => ((await l.innerText()) ?? '').replace(/\s+/g, ' ').trim();
const baht = (n: number) => `฿${n.toLocaleString('en-US')}`;

async function timelineSteps(page: Page) {
  return page.locator('[data-testid^="timeline-step-"]').evaluateAll((es) =>
    es.map((e) => ({ status: e.getAttribute('data-status') ?? '', current: e.getAttribute('aria-current') ?? '', text: (e.textContent ?? '').replace(/\s+/g, ' ').trim() })),
  );
}

async function ownerReport(page: Page, from: string, to: string) {
  await open(page, '/owner/reports');
  await page.getByTestId('report-from').fill(from);
  await page.getByTestId('report-to').fill(to);
  await page.getByTestId('report-submit').click();
  await expect(page.getByTestId('report-table').or(page.getByTestId('report-error')).first()).toBeVisible();
  await waitReady(page);
}

async function download(page: Page, name: string) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('report-csv').click()]);
  const p = path.join(TMP, name);
  await dl.saveAs(p);
  return { file: p, suggested: dl.suggestedFilename(), text: fs.readFileSync(p, 'utf8') };
}

async function registerUi(page: Page, name: string, phone: string, password = 'Test12345') {
  await open(page, '/my');
  await page.getByTestId('register-name').fill(name);
  await page.getByTestId('register-phone').fill(phone);
  await page.getByTestId('register-password').fill(password);
  await page.getByTestId('register-consent').check();
  await page.getByTestId('register-submit').click();
  await expect(page.getByTestId('my-name')).toBeVisible();
  await waitReady(page);
}

async function chat(page: Page) {
  const room = new ChatRoom(page, new ChatLog());
  await room.open('/');
  return room;
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(900_000);
test.afterEach(async ({ request }) => { await closeAll(); await resetData(request).catch(() => {}); });

// ================================================================= CR-01
test('CR-01 ออกจากระบบแล้วต้องใช้ต่อไม่ได้จริง', async ({ browser, request }) => {
  const CR = 'CR-01';
  await resetData(request);
  const A = await person(browser);
  const B = await person(browser);
  const SA = await person(browser);
  const SB = await person(browser);
  let cur: Page = A;

  await rec(CR, '1', async (s) => {
    for (const [n, p] of [['A', A], ['B', B]] as const) {
      cur = p;
      await memberLoginUi(p, SEED.ton.phone, SEED.ton.password);
      const name = await txt(p.getByTestId('my-name'));
      const credit = await val(p.getByTestId('credit-balance'));
      const hours = await val(p.getByTestId('paid-hours'));
      s.check(`เครื่อง ${n}`, name === 'ต้น' && credit === 1200 && hours === 7, `สวัสดี ${name} · เครดิต ${baht(credit)} · ชั่วโมงสะสม ${hours}`);
      await s.shot(p, `-${n}`);
    }
  }, () => cur);

  await rec(CR, '2', async (s) => {
    cur = A;
    await A.getByTestId('logout').click();
    await expect(A.getByTestId('login-phone')).toBeVisible();
    s.check('เครื่อง A หลังกดออกจากระบบ', (await A.getByTestId('my-name').count()) === 0 && (await A.getByTestId('credit-balance').count()) === 0,
      `เห็นฟอร์ม "เข้าสู่ระบบสมาชิก" (ช่องเบอร์โทร/รหัสผ่าน) · ไม่มีชื่อ/เครดิต (my-name=${await A.getByTestId('my-name').count()}, credit-balance=${await A.getByTestId('credit-balance').count()})`);
    await s.shot(A);
  }, () => cur);

  await rec(CR, '3', async (s) => {
    cur = A;
    await open(A, '/');
    await A.goBack();
    await waitReady(A).catch(() => {});
    const afterBack = (await A.getByTestId('login-phone').count()) === 1 && (await A.getByTestId('my-name').count()) === 0;
    s.check('กดย้อนกลับมา /my', afterBack, `URL ${new URL(A.url()).pathname} · ฟอร์มเข้าสู่ระบบ=${await A.getByTestId('login-phone').count()} · my-name=${await A.getByTestId('my-name').count()}`);
    await s.shot(A, '-back');
    await A.reload();
    await waitReady(A);
    const afterReload = (await A.getByTestId('login-phone').count()) === 1 && (await A.getByTestId('my-name').count()) === 0;
    s.check('รีเฟรช /my', afterReload, `ฟอร์มเข้าสู่ระบบ=${await A.getByTestId('login-phone').count()} · my-name=${await A.getByTestId('my-name').count()} · credit-balance=${await A.getByTestId('credit-balance').count()}`);
    await s.shot(A, '-reload');
  }, () => cur);

  await rec(CR, '4', async (s) => {
    cur = B;
    await B.reload();
    await waitReady(B);
    const name = (await B.getByTestId('my-name').count()) ? await txt(B.getByTestId('my-name')) : '(ไม่เห็น)';
    s.check('เครื่อง B รีเฟรช /my', name === 'ต้น', `สวัสดี ${name} · login-phone=${await B.getByTestId('login-phone').count()}`);
    await s.shot(B);
  }, () => cur);

  await rec(CR, '5', async (s) => {
    cur = A;
    await memberLoginUi(A, SEED.ton.phone, SEED.ton.password);
    const name = await txt(A.getByTestId('my-name'));
    s.check('เครื่อง A เข้าสู่ระบบใหม่', name === 'ต้น', `สวัสดี ${name} · เครดิต ${baht(await val(A.getByTestId('credit-balance')))}`);
    await s.shot(A);
  }, () => cur);

  await rec(CR, '6', async (s) => {
    cur = SA;
    await staffLoginUi(SA, 'staff');
    await staffLoginUi(SB, 'staff');
    await open(SA, '/staff');
    await SA.getByTestId('staff-logout').click();
    await expect(SA.getByTestId('staff-username')).toBeVisible();
    await open(SA, '/staff');
    const path = new URL(SA.url()).pathname;
    const msg = (await SA.getByTestId('login-required').count()) ? await txt(SA.getByTestId('login-required')) : '(ไม่มีข้อความ)';
    s.check('เครื่อง A เปิด /staff หลังออก', path === '/staff/login' && /กรุณาเข้าสู่ระบบก่อนเข้าหน้านี้/.test(msg), `ไปที่ ${path} · ข้อความ "${msg}"`);
    await s.shot(SA, '-A');
    cur = SB;
    await open(SB, '/staff');
    await SB.getByTestId('staff-search-code').fill('LN-900004');
    await SB.getByTestId('staff-search-submit').click();
    await expect(SB.getByTestId('staff-booking-code')).toBeVisible();
    const code = await txt(SB.getByTestId('staff-booking-code'));
    s.check('เครื่อง B ค้น LN-900004', code === 'LN-900004', `เห็นการจอง ${code} · ลูกค้า ${await txt(SB.getByTestId('staff-customer-name'))} · สถานะ ${await SB.getByTestId('staff-booking-status').getAttribute('data-value')}`);
    await s.shot(SB, '-B');
  }, () => cur);

  await rec(CR, '7', async (s) => {
    // ซ้อมบางส่วนเท่านั้น: ไม่มี build รุ่นก่อน CR-01 ให้ออก cookie แบบเก่า → ทำได้แค่ restart container แล้วดูว่าคนที่เข้าสู่ระบบอยู่ยังไม่หลุด
    const M = await person(browser);
    const W = await person(browser);
    cur = M;
    await memberLoginUi(M, SEED.ton.phone, SEED.ton.password);
    await staffLoginUi(W, 'staff');
    const r = spawnSync('docker', ['restart', 'football-web'], { encoding: 'utf8' });
    s.say(`docker restart football-web → exit ${r.status}`);
    for (let i = 0; i < 60; i++) {
      try { const h = await (await fetch(`${BASE_URL}/api/health`)).json(); if (h.ok === true && h.db === true) break; } catch { /* รอ */ }
      await new Promise((res) => setTimeout(res, 1000));
    }
    await M.reload(); await waitReady(M);
    cur = W;
    await W.reload(); await waitReady(W);
    const memberOk = (await M.getByTestId('my-name').count()) === 1;
    const staffOk = (await W.getByTestId('staff-logout').count()) === 1;
    s.check('หลัง restart: ลูกค้ายังเข้าสู่ระบบอยู่', memberOk, memberOk ? `สวัสดี ${await txt(M.getByTestId('my-name'))}` : 'หลุด');
    s.check('หลัง restart: พนักงานยังเข้าสู่ระบบอยู่', staffOk, staffOk ? await txt(W.getByTestId('staff-whoami')) : 'หลุด');
    await s.shot(M, '-member'); await s.shot(W, '-staff');
    s.partial = 'ทำบางส่วน: ขั้นนี้ของจริงต้องมี cookie รุ่นก่อนอัปเดต · ที่นี่ไม่มี build เก่า จึงทำได้แค่ restart container (ผลด้านล่าง) · ผลของจริงรอตอนขึ้นระบบ (docs/impact/CR-01.md ข้อ 5)';
    if (!(memberOk && staffOk)) s.ok = false;
  }, () => cur);
});

// ================================================================= CR-02
test('CR-02 แก้ 5 จุดตามที่ร้านตอบไว้', async ({ browser, request }) => {
  const CR = 'CR-02';
  await resetData(request);
  const staff = await person(browser);
  const member = await person(browser);
  const owner = await person(browser);
  const guest = await person(browser);
  let cur: Page = staff;

  // ทีมเตรียม: สมาชิกใหม่ 1 คน จอง+จ่าย สนาม C พ 21 ต.ค. สองรอบ (18:00 กับ 19:00)
  const phone = uniquePhone(3);
  const pw = 'Test12345';
  await registerCustomer(request, { name: 'ลูกค้าตรวจรับ', phone, password: pw });
  const b1 = (await createBooking(request, { fieldId: 'C', date: '2026-10-21', startHour: 18, phone, name: 'ลูกค้าตรวจรับ' })).code as string;
  await payBooking(request, b1);
  const b2 = (await createBooking(request, { fieldId: 'C', date: '2026-10-21', startHour: 19, phone, name: 'ลูกค้าตรวจรับ' })).code as string;
  await payBooking(request, b2);

  const searchStaff = async (p: Page, code: string) => {
    await open(p, '/staff');
    await p.getByTestId('staff-search-code').fill(code);
    await p.getByTestId('staff-search-submit').click();
    await expect(p.getByTestId('staff-booking-code')).toHaveText(code);
  };

  await rec(CR, '1', async (s) => {
    cur = staff;
    await staffLoginUi(staff, 'staff');
    await searchStaff(staff, b1);
    const hint = await txt(staff.getByTestId('staff-checkin-hint'));
    s.say(`การจองที่เตรียม: ${b1} (สนาม C พ 21 ต.ค. 18:00 จ่ายแล้ว) · วันนี้ของเครื่องทดสอบ = ศ 9 ต.ค.`);
    s.check('ข้อความใต้ปุ่ม "เก็บเงินแล้ว / เช็กอิน" ก่อนกด', hint.includes('เช็กอินได้เฉพาะวันเตะเท่านั้น'), `"${hint}"`);
    await s.shot(staff, '', staff.getByTestId('staff-checkin'));
  }, () => cur);

  await rec(CR, '2', async (s) => {
    cur = staff;
    await staff.getByTestId('staff-checkin').click();
    await expect(staff.getByTestId('error-message')).toBeVisible();
    const msg = await txt(staff.getByTestId('error-message'));
    const st = await staff.getByTestId('staff-booking-status').getAttribute('data-value');
    s.check('ข้อความหลังกดปุ่ม', msg.includes('เช็กอินได้เฉพาะวันเตะ'), `"${msg}"`);
    s.check('สถานะการจอง', st === 'CONFIRMED', st ?? '');
    await s.shot(staff, '-staff');
    cur = member;
    await memberLoginUi(member, phone, pw);
    const hours = await val(member.getByTestId('paid-hours'));
    s.check('ลูกค้าเปิด "การจองของฉัน" ชั่วโมงสะสม', hours === 0, `ชั่วโมงสะสม ${hours} (ก่อนกด = 0)`);
    await s.shot(member, '-customer');
  }, () => cur);

  await rec(CR, '3', async (s) => {
    cur = staff;
    await setClock(request, '2026-10-21T08:00:00+07:00');
    s.say('ทีมตั้งเวลาเครื่องทดสอบ = พ 21 ต.ค. 2026 08:00 (เช้าวันเตะ ก่อนรอบ 18:00)');
    await staffLoginUi(staff, 'staff');
    await searchStaff(staff, b1);
    await staff.getByTestId('staff-checkin').click();
    await expect(staff.getByTestId('success-message')).toBeVisible();
    const ok = await txt(staff.getByTestId('success-message'));
    const st = await staff.getByTestId('staff-booking-status').getAttribute('data-value');
    s.check('พนักงานกดเช็กอิน', st === 'CHECKED_IN', `ข้อความ "${ok}" · สถานะ ${st}`);
    await s.shot(staff, '-staff');
    cur = member;
    await open(member, '/my');
    if (await member.getByTestId('login-phone').count()) await memberLoginUi(member, phone, pw);
    const hours = await val(member.getByTestId('paid-hours'));
    s.check('ชั่วโมงสะสมของลูกค้า (จอง 1 ชม.)', hours === 1, `ชั่วโมงสะสม ${hours} (จาก 0 → ${hours})`);
    await s.shot(member, '-customer');
  }, () => cur);

  await rec(CR, '4', async (s) => {
    cur = staff;
    await setClock(request, '2026-10-22T00:00:00+07:00');
    s.say('ทีมตั้งเวลา = พฤ 22 ต.ค. 2026 00:00 (วันถัดจากวันเตะ) · เช็กอินการจอง ' + b2 + ' (C 19:00) ที่ลืมกดเมื่อวาน');
    await staffLoginUi(staff, 'staff');
    await searchStaff(staff, b2);
    await staff.getByTestId('staff-checkin').click();
    await expect(staff.getByTestId('error-message')).toBeVisible();
    const msg = await txt(staff.getByTestId('error-message'));
    const st = await staff.getByTestId('staff-booking-status').getAttribute('data-value');
    s.check('ถูกปฏิเสธ', msg.includes('เช็กอินได้เฉพาะวันเตะ'), `"${msg}"`);
    s.check('สถานะยังเป็น "ยืนยันแล้ว"', st === 'CONFIRMED', `${st} (${await txt(staff.getByTestId('staff-booking-status'))})`);
    await s.shot(staff);
  }, () => cur);

  await resetData(request); // เวลากลับ ศ 9 ต.ค. 10:00 + ข้อมูลตั้งต้น (ขั้น 5 เป็นต้นไปใช้ข้อมูล seed)

  await rec(CR, '5', async (s) => {
    cur = owner;
    await staffLoginUi(owner, 'owner');
    await open(owner, '/owner/bookings');
    await owner.getByTestId('bk-search-code').fill('LN-900008');
    await owner.getByTestId('bk-search-submit').click();
    await owner.getByTestId('bk-link-LN-900008').click();
    await expect(owner.getByTestId('history-table')).toBeVisible();
    await waitReady(owner);
    const n = Number(await owner.getByTestId('history-table').getAttribute('data-count'));
    const actors: string[] = [];
    for (let i = 0; i < n; i++) actors.push(await txt(owner.getByTestId(`history-actor-${i}`)));
    s.check('ตาราง "ประวัติสถานะ" คอลัมน์ "ผู้ทำ"', n === 3 && actors.join(',') === 'ลูกค้า,ลูกค้า,น้องบอล', `${n} แถว: ${actors.join(' · ')}`);
    await s.shot(owner, '', owner.getByTestId('history-table'));
  }, () => cur);

  await rec(CR, '6', async (s) => {
    cur = guest;
    await open(guest, '/my');
    await guest.getByTestId('lookup-code').fill('LN-900005');
    await guest.getByTestId('lookup-phone').fill('0877777777');
    await guest.getByTestId('lookup-submit').click();
    await expect(guest).toHaveURL(/\/booking\/LN-900005/);
    await waitReady(guest);
    const st = await timelineSteps(guest);
    const last = st[st.length - 1];
    const time = await txt(guest.getByTestId(`timeline-time-${st.length - 1}`));
    const status = await guest.getByTestId('booking-status').getAttribute('data-value');
    s.say('ขั้นตอนการจอง: ' + st.map((x) => x.text).join(' → '));
    s.check('จำนวนขั้น', st.length === 4, `${st.length} ขั้น`);
    s.check('ขั้นสุดท้าย', /จบ/.test(last?.text ?? ''), last?.text ?? '');
    s.check('เวลาของขั้น "จบ"', time.includes('3 ต.ค. 2026 20:00'), time);
    s.check('สถานะการจอง', status === 'CHECKED_IN', `${status} (${await txt(guest.getByTestId('booking-status'))})`);
    await s.shot(guest, '', guest.getByTestId('booking-timeline'));
  }, () => cur);

  await rec(CR, '7', async (s) => {
    cur = guest;
    await open(guest, '/my');
    await guest.getByTestId('lookup-code').fill('LN-900003');
    await guest.getByTestId('lookup-phone').fill('0833333333');
    await guest.getByTestId('lookup-submit').click();
    await expect(guest).toHaveURL(/\/booking\/LN-900003/);
    await waitReady(guest);
    const st = await timelineSteps(guest);
    s.say('ขั้นตอนการจอง: ' + st.map((x) => x.text).join(' → '));
    s.check('ขั้นสุดท้าย', st[st.length - 1]?.status === 'NO_SHOW', st[st.length - 1]?.text ?? '');
    s.check('ไม่มีขั้น "จบ"', !st.some((x) => /จบ/.test(x.text)), st.length + ' ขั้น');
    await s.shot(guest, '', guest.getByTestId('booking-timeline'));
  }, () => cur);

  await rec(CR, '8', async (s) => {
    cur = owner;
    await ownerReport(owner, '2026-11-30', '2027-02-28');
    const err = await owner.getByTestId('report-error').count();
    const days = await owner.getByTestId('report-table').getAttribute('data-count');
    s.check('ตารางรายงาน 30 พ.ย. 2026 → 28 ก.พ. 2027', err === 0 && days === '91', `${days} วัน · ข้อความเกิน 3 เดือน: ${err ? await txt(owner.getByTestId('report-error')) : 'ไม่ขึ้น'}`);
    await s.shot(owner, '-table');
    const d = await download(owner, 'cr02-8.csv');
    s.check('ดาวน์โหลด CSV (Excel)', d.text.length > 0 && d.text.charCodeAt(0) === 0xfeff, `ไฟล์ ${d.suggested} · ${d.text.length} ตัวอักษร · ขึ้นต้นด้วย BOM=${d.text.charCodeAt(0) === 0xfeff} · ${d.text.split(/\r?\n/).filter(Boolean).length - 2} แถววัน`);
    await s.shot(owner, '-csv', owner.getByTestId('report-csv'));
  }, () => cur);

  await rec(CR, '9', async (s) => {
    cur = owner;
    await ownerReport(owner, '2026-11-30', '2027-03-01');
    const e1 = (await owner.getByTestId('report-error').count()) ? await txt(owner.getByTestId('report-error')) : '(ไม่มีข้อความ)';
    s.check('ช่วง 30 พ.ย. → 1 มี.ค.', e1.includes('ดูรายงานได้ครั้งละไม่เกิน 3 เดือน'), `"${e1}"`);
    await s.shot(owner, '-a', owner.getByTestId('report-error'));
    await ownerReport(owner, '2026-10-01', '2026-12-31');
    const days = await owner.getByTestId('report-table').getAttribute('data-count');
    s.check('ช่วง 1 ต.ค. → 31 ธ.ค.', days === '92' && (await owner.getByTestId('report-error').count()) === 0, `${days} วัน`);
    await s.shot(owner, '-b');
  }, () => cur);

  await rec(CR, '10', async (s) => {
    cur = guest;
    const cases: [string, string, string, string][] = [['ก', 'ไม่กรอกอะไร', '', ''], ['ข', 'กรอกเฉพาะรหัส', 'LN-900004', ''], ['ค', 'กรอกเฉพาะเบอร์', '', '0844444444']];
    const asc: Record<string, string> = { ก: 'a', ข: 'b', ค: 'c' };
    for (const [k, name, code, ph] of cases) {
      await open(guest, '/my');
      if (code) await guest.getByTestId('lookup-code').fill(code);
      if (ph) await guest.getByTestId('lookup-phone').fill(ph);
      await guest.getByTestId('lookup-submit').click();
      await expect(guest.getByTestId('error-message')).toBeVisible();
      const m = await txt(guest.getByTestId('error-message'));
      s.check(`(${k}) ${name}`, m.includes('กรุณากรอกรหัสการจองและเบอร์โทรให้ครบ') && !m.includes('เกิดข้อผิดพลาดในระบบ'), `"${m}"`);
      await s.shot(guest, `-${asc[k]}`, guest.getByTestId('error-message'));
    }
  }, () => cur);
});

// ================================================================= CR-03
test('CR-03 รายงานแยกช่องทางเงิน + ชั่วโมงใช้สนาม', async ({ browser, request }) => {
  const CR = 'CR-03';
  await resetData(request);
  const owner = await person(browser);
  let cur = owner;
  await staffLoginUi(owner, 'owner');
  await ownerReport(owner, '2026-10-03', '2026-10-09');

  await rec(CR, '1', async (s) => {
    const head = await txt(owner.locator('[data-testid="report-table"] thead'));
    s.say('หัวตาราง: ' + head);
    s.check('มีคอลัมน์ "มัดจำ/จ่ายผ่านพร้อมเพย์" และ "เก็บหน้าสนาม" แยกกัน', head.includes('มัดจำ/จ่ายผ่านพร้อมเพย์') && head.includes('เก็บหน้าสนาม'), 'ดูหัวตาราง');
    const pp = await val(owner.getByTestId('report-total-booking-promptpay'));
    const cash = await val(owner.getByTestId('report-total-booking-cash'));
    s.check('แถว "รวม" พร้อมเพย์', pp === 6600, baht(pp));
    s.check('แถว "รวม" เก็บหน้าสนาม', cash === 600, baht(cash));
    await s.shotTop(owner, '-head', owner.getByTestId('report-table'));
    await s.shot(owner, '-total', owner.getByTestId('report-totals'));
  }, () => cur);

  await rec(CR, '2', async (s) => {
    const total = await val(owner.getByTestId('report-total-booking'));
    const pp = await val(owner.getByTestId('report-total-booking-promptpay'));
    const cash = await val(owner.getByTestId('report-total-booking-cash'));
    s.check('"ยอดจอง" แถวรวม', total === 7200 && pp + cash === total, `${baht(total)} = ${baht(pp)} + ${baht(cash)}`);
    await s.shot(owner, '', owner.getByTestId('report-totals'));
  }, () => cur);

  await rec(CR, '3', async (s) => {
    const g = async (d: string, k: string) => val(owner.getByTestId(`report-2026-10-${d}-${k}`));
    const v6 = [await g('06', 'booking-promptpay'), await g('06', 'booking-cash'), await g('06', 'booking')];
    const v8 = [await g('08', 'booking-promptpay'), await g('08', 'booking-cash')];
    s.check('6 ต.ค.', v6[0] === 600 && v6[1] === 600 && v6[2] === 1200, `พร้อมเพย์ ${baht(v6[0])} + เก็บหน้าสนาม ${baht(v6[1])} = ยอดจอง ${baht(v6[2])}`);
    s.check('8 ต.ค.', v8[0] === 4800 && v8[1] === 0, `พร้อมเพย์ ${baht(v8[0])} · เก็บหน้าสนาม ${baht(v8[1])}`);
    await s.shot(owner, '', owner.getByTestId('report-row-2026-10-08'));
  }, () => cur);

  await rec(CR, '4', async (s) => {
    const want = { A: [5, 4.5], B: [2, 1.8], C: [0, 0] } as const;
    for (const f of ['A', 'B', 'C'] as const) {
      const h = await val(owner.getByTestId(`report-field-${f}-hours`));
      const pTxt = await txt(owner.getByTestId(`report-field-${f}-percent`));
      const pc = Number((await owner.getByTestId(`report-field-${f}-percent`).getAttribute('data-value')) ?? NaN);
      s.check(`สนาม ${f}`, h === want[f][0] && pc === want[f][1], `${h} ชม. ${pTxt}`);
    }
    await s.shot(owner, '', owner.getByTestId('report-field-use'));
  }, () => cur);

  await rec(CR, '5', async (s) => {
    const d = await download(owner, 'cr03-5.csv');
    const lines = d.text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split(','));
    const head = lines[0];
    s.say(`ไฟล์ ${d.suggested} · BOM=${d.text.charCodeAt(0) === 0xfeff} · ${head.length} คอลัมน์ · ${lines.length - 1} แถว (รวมแถว "รวม")`);
    s.say('คอลัมน์ 1–18: ' + head.slice(0, 18).join(' | '));
    s.say('คอลัมน์ 19 เป็นต้นไป: ' + head.slice(18).join(' | '));
    const first = head[0] === 'วันที่' && head[17] === 'ชั่วโมงฟรีที่ใช้';
    s.check('18 คอลัมน์เดิมอยู่ที่เดิม (วันที่ → ชั่วโมงฟรีที่ใช้)', first, `คอลัมน์ 1 = "${head[0]}" · คอลัมน์ 18 = "${head[17]}"`);
    const newCols = ['มัดจำ/จ่ายผ่านพร้อมเพย์ (บาท)', 'เก็บหน้าสนาม (บาท)', 'ชั่วโมงใช้สนาม A', 'ใช้สนาม A (%)', 'ชั่วโมงใช้สนาม B', 'ใช้สนาม B (%)', 'ชั่วโมงใช้สนาม C', 'ใช้สนาม C (%)'];
    s.check('คอลัมน์ใหม่ต่อท้ายสุด', JSON.stringify(head.slice(18)) === JSON.stringify(newCols), head.slice(18).join(' | '));
    s.check('ภาษาไทยอ่านออก (UTF-8 + BOM)', d.text.charCodeAt(0) === 0xfeff && head[0] === 'วันที่', 'อ่านหัวคอลัมน์ไทยได้ครบ (ตรวจในสคริปต์ ไม่ได้เปิดด้วย Excel จริง)');
    s.say('หมายเหตุ: ไม่ได้เปิดด้วย Excel/สูตรของร้านจริง — ตรวจจากไฟล์ CSV (ตำแหน่ง/ชื่อคอลัมน์ ซึ่งเป็นสิ่งที่สูตรอ้างถึง)');
    await s.shot(owner, '', owner.getByTestId('report-csv'));
  }, () => cur);

  await rec(CR, '6', async (s) => {
    // "รายงานก่อนปรับระบบ" = golden master tests/golden/side.golden.json (case report/2026-10-03..2026-10-09) แทนไฟล์เดิมที่ร้านได้รับ
    const g = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'tests', 'golden', 'side.golden.json'), 'utf8')).cases.find((c: { id: string }) => c.id === 'report/2026-10-03..2026-10-09').body.totals;
    const items: [string, string, number][] = [['ขายหน้าเคาน์เตอร์ (เงินสด)', 'report-total-cash', g.salesCash], ['ขายหน้าเคาน์เตอร์ (พร้อมเพย์)', 'report-total-promptpay', g.salesPromptpay], ['รวมรับเงิน', 'report-total-money', g.total], ['หักเครดิต', 'report-total-credit', g.creditUsed], ['จำนวนการจอง', 'report-total-bookings', g.bookings], ['ไม่มา', 'report-total-noshow', g.noShow]];
    for (const [label, id, want] of items) {
      const v = await val(owner.getByTestId(id));
      s.check(label, v === want, `ตอนนี้ ${v} · ไฟล์เดิม (golden) ${want}`);
    }
    s.say('หมายเหตุ: ไม่มีไฟล์รายงานเดิมที่ทีมแนบให้ร้าน จึงเทียบกับ golden master tests/golden/side.golden.json (ค่าเดิมที่ล็อกไว้)');
    await s.shot(owner, '', owner.getByTestId('report-totals'));
  }, () => cur);
});

// ================================================================= CR-04
test('CR-04 น้องบอลจำเรื่องที่คุยไปแล้ว', async ({ browser, request }) => {
  const CR = 'CR-04';
  await resetData(request);
  let cur: Page | undefined;
  const room = async () => { const p = await person(browser, true); cur = p; return { p, r: await chat(p) }; };
  const ask = async (r: ChatRoom, t: string) => (await r.send(t));
  const full = (t: { bot: string; cards: Record<string, string> }) => ChatRoom.fullText(t as never);

  const r1 = await room();
  await rec(CR, '1', async (s) => {
    const t = await ask(r1.r, 'สนาม A พรุ่งนี้ 10:00 ราคาเท่าไร');
    s.say(`น้องบอล: "${t.bot}"`);
    s.say(`การ์ด: ${Object.entries(t.cards).map(([k, v]) => `${k}=${v}`).join(' ; ')}`);
    s.check('การ์ดราคา', full(t).includes('฿1,200'), full(t).includes('฿1,200') ? 'มี ฿1,200' : 'ไม่มี ฿1,200');
    await s.shot(r1.p);
  }, () => cur);
  await rec(CR, '2', async (s) => {
    const t = await ask(r1.r, 'สนาม C ล่ะ');
    s.say(`น้องบอล: "${t.bot}"`);
    s.say(`การ์ด: ${Object.entries(t.cards).map(([k, v]) => `${k}=${v}`).join(' ; ')}`);
    const f = full(t);
    s.check('สนาม C พรุ่งนี้ 10:00 = ฿1,800 ไม่ถามใหม่ ไม่ตอบ "ไม่มีข้อมูล"', f.includes('สนาม C') && f.includes('฿1,800') && !f.includes('ไม่มีข้อมูล') && !/วัน.*เวลา.*(อะไร|ไหน)/.test(t.bot), f.includes('฿1,800') ? 'ได้ ฿1,800' : 'ไม่เจอ ฿1,800');
    await s.shot(r1.p);
  }, () => cur);
  await rec(CR, '3', async (s) => {
    const t = await ask(r1.r, 'วันจันทร์ล่ะ');
    s.say(`น้องบอล: "${t.bot}"`);
    s.say(`การ์ด: ${Object.entries(t.cards).map(([k, v]) => `${k}=${v}`).join(' ; ')}`);
    const f = full(t);
    s.check('สนาม C จันทร์ 12 ต.ค. 10:00 = ฿1,200', f.includes('฿1,200') && /2026-10-12|12 ต\.ค\./.test(f + JSON.stringify(t.cards)), f.includes('฿1,200') ? 'มี ฿1,200' : 'ไม่มี ฿1,200');
    await s.shot(r1.p);
  }, () => cur);
  await rec(CR, '4', async (s) => {
    const t = await ask(r1.r, 'ขอ 2 ชั่วโมง');
    s.say(`น้องบอล: "${t.bot}"`);
    s.say(`การ์ด: ${Object.entries(t.cards).map(([k, v]) => `${k}=${v}`).join(' ; ')}`);
    s.check('2 ชั่วโมง = ฿2,400', full(t).includes('฿2,400'), full(t).includes('฿2,400') ? 'มี ฿2,400' : 'ไม่มี ฿2,400');
    await s.shot(r1.p);
  }, () => cur);

  await rec(CR, '5', async (s) => {
    const x = await room();
    await ask(x.r, 'สนาม C มีหลังคาไหม');
    const a = await ask(x.r, 'ช่วงไหนถูกสุด');
    s.say(`"ช่วงไหนถูกสุด" → "${a.bot}"`);
    const b = await ask(x.r, '3 ชั่วโมง');
    s.say(`"3 ชั่วโมง" → "${b.bot}"`);
    s.say(`การ์ด: ${Object.entries(b.cards).map(([k, v]) => `${k}=${v}`).join(' ; ')}`);
    s.check('ช่วงถูกสุดของสนาม C', full(a).includes('฿1,200') && full(a).includes('17:00') && !full(a).includes('฿800'), full(a).includes('฿800') ? 'พูดถึง ฿800' : 'มี ฿1,200 ไม่มี ฿800');
    s.check('3 ชั่วโมง', full(b).includes('฿3,600'), full(b).includes('฿3,600') ? 'มี ฿3,600' : 'ไม่มี ฿3,600');
    await s.shot(x.p);
  }, () => cur);

  await rec(CR, '6', async (s) => {
    const x = await room();
    const a = await ask(x.r, 'ช่วงไหนถูกสุด');
    s.say(`"ช่วงไหนถูกสุด" → "${a.bot}"`);
    const b = await ask(x.r, '2 ชั่วโมง');
    s.say(`"2 ชั่วโมง" → "${b.bot}"`);
    s.check('ช่วงถูกสุด (สนาม 5 คน)', full(a).includes('฿800') && full(a).includes('17:00'), full(a).includes('฿800') ? 'มี ฿800 และ 17:00' : 'ไม่มี ฿800');
    s.check('2 ชั่วโมง', full(b).includes('฿1,600'), full(b).includes('฿1,600') ? 'มี ฿1,600' : 'ไม่มี ฿1,600');
    await s.shot(x.p);
  }, () => cur);

  await rec(CR, '7', async (s) => {
    const x = await room();
    const a = await ask(x.r, 'How much is field B on Saturday at 7pm?');
    const b = await ask(x.r, 'what about field C?');
    const c = await ask(x.r, 'and 2 hours?');
    s.say(`1) "${a.bot}"`); s.say(`2) "${b.bot}"`); s.say(`3) "${c.bot}"`);
    s.check('คำตอบที่ 1', full(a).includes('THB 1,200'), full(a).includes('THB 1,200') ? 'THB 1,200' : 'ไม่เจอ');
    s.check('คำตอบที่ 2 (สนาม C เสาร์ 10 ต.ค. 19:00)', full(b).includes('THB 1,800'), full(b).includes('THB 1,800') ? 'THB 1,800' : 'ไม่เจอ');
    s.check('คำตอบที่ 3', full(c).includes('THB 3,600'), full(c).includes('THB 3,600') ? 'THB 3,600' : 'ไม่เจอ');
    const thai = /[฀-๿]/.test(a.bot + b.bot + c.bot);
    s.check('ไม่มีตัวอักษรไทยในคำตอบ', !thai, thai ? 'พบอักษรไทย' : 'ไม่พบ');
    await s.shot(x.p);
  }, () => cur);

  await rec(CR, '8', async (s) => {
    const x = await room();
    const a = await ask(x.r, 'งั้นสนาม B ล่ะ');
    s.say(`น้องบอล: "${a.bot}"`);
    s.check('ไม่จำข้ามห้อง → ไม่มีข้อมูล + เบอร์ร้าน', a.bot.includes('ไม่มีข้อมูล') && a.bot.includes('02-345-6789'), a.bot.includes('02-345-6789') ? 'ตอบไม่มีข้อมูล พร้อมเบอร์ร้าน' : 'ไม่ตรง');
    await s.shot(x.p);
  }, () => cur);

  await rec(CR, '9', async (s) => {
    const x = await room();
    const before = Number(sql(`select count(*) from bookings`));
    const a = await ask(x.r, 'จองสนาม A พรุ่งนี้ 19:00 1 ชั่วโมง ชื่อสมชาย เบอร์ 0812345678');
    s.say(`น้องบอล: "${a.bot}"`);
    const pdpa = await ask(x.r, 'ยินยอม');
    s.say(`พิมพ์ "ยินยอม" → น้องบอล: "${pdpa.bot}"`);
    s.note('ใบข้อ 9 ไม่ได้บอกว่าน้องบอลจะถาม PDPA เป็นข้อความก่อน และต้องพิมพ์ "ยินยอม" การ์ดยืนยันถึงจะขึ้น (ตรงกับ TC-CHAT-07) — ควรเติมในใบ: ... → น้องบอลถามยินยอม → พิมพ์ "ยินยอม" → ขึ้นการ์ด');
    const card = x.p.getByTestId('chat-card-confirm');
    const cardShown = (await card.count()) > 0;
    const consentChecked = cardShown ? await x.p.getByTestId('chat-card-consent').isChecked() : null;
    const after = Number(sql(`select count(*) from bookings`));
    s.check('การ์ด "ยืนยันการจอง" + ช่องยินยอม PDPA ยังไม่ติ๊ก', cardShown && consentChecked === false, `การ์ด=${cardShown} · ติ๊ก=${consentChecked} · ปุ่มยืนยันกดได้=${cardShown ? await x.p.getByTestId('chat-card-confirm-button').isEnabled() : '-'}`);
    s.check('ยังไม่จองจริง', before === after, `จำนวนการจองทั้งระบบ (SQL อ่านอย่างเดียว) ก่อน ${before} → หลัง ${after}`);
    await s.shot(x.p, '-card');
    const off = await ask(x.r, 'ผลบอลเมื่อคืนเป็นยังไง');
    s.say(`ถามผลบอล → "${off.bot}"`);
    s.check('ปฏิเสธนอกเรื่อง', off.bot.includes('ตอบได้เฉพาะเรื่องสนาม'), off.bot.includes('ตอบได้เฉพาะเรื่องสนาม') ? 'ตอบได้เฉพาะเรื่องสนาม…' : 'ไม่ตรง');
    await s.shot(x.p, '-off');
  }, () => cur);

  await rec(CR, '10', async (s) => {
    const x = await room();
    const a = await ask(x.r, 'พรุ่งนี้ 19:00 สนาม A ว่างไหม');
    s.say(`ถามรอบว่าง → "${a.bot}"`);
    const b = await ask(x.r, 'จองเลย');
    s.say(`"จองเลย" → "${b.bot}"`);
    const noCard = (await x.p.getByTestId('chat-card-confirm').count()) === 0;
    s.check('ยังถามสนาม/วัน/เวลาใหม่ (ตามที่แจ้งไว้ ไม่ใช่ความผิดพลาดใหม่)', noCard && /สนาม|วัน|เวลา/.test(b.bot), `ไม่มีการ์ดยืนยัน=${noCard}`);
    await s.shot(x.p);
  }, () => cur);
});

// ================================================================= CR-05
test('CR-05 ราคาเย็นสนาม A/B ฿1,300 ตั้งแต่ 1 พ.ย.', async ({ browser, request }) => {
  const CR = 'CR-05';
  await resetData(request);
  await setClock(request, T('2026-10-25T10:00:00'));
  const g = await person(browser);
  let cur: Page = g;
  const formPrice = async (p: Page) => ({
    total: await val(p.getByTestId('price-total')), plan: await p.getByTestId('price-plan').getAttribute('data-value'),
    payNow: await val(p.getByTestId('price-pay-now')), due: await val(p.getByTestId('price-due-at-field')),
  });
  const pickSlot = async (date: string, f: string, h: number) => {
    await open(g, `/book?date=${date}`);
    await g.getByTestId(`slot-${f}-${h}`).click();
    await expect(g).toHaveURL(/\/book\/new\?/);
    await waitReady(g);
  };

  await rec(CR, '1', async (s) => {
    cur = g;
    s.say('ทีมตั้งเวลาเครื่องทดสอบ = 25 ต.ค. 2026 10:00 (ใบเขียน "เสาร์ 25 ต.ค." แต่ 25 ต.ค. 2569 เป็นวันอาทิตย์ — ดูข้อสังเกตท้ายเอกสาร)');
    await open(g, '/');
    for (const f of ['A', 'B', 'C']) {
      const card = await txt(g.getByTestId(`home-field-${f}`));
      const nextN = await g.getByTestId(`home-field-${f}-next-rate`).count();
      const nextTxt = nextN ? await txt(g.getByTestId(`home-field-${f}-next-rate`)) : '(ไม่มี)';
      s.say(`การ์ดสนาม ${f}: ${card} · บรรทัดราคาใหม่: ${nextTxt}`);
      if (f === 'C') s.check('สนาม C ไม่มีบรรทัดราคาใหม่', nextN === 0 && card.includes('฿1,200') && card.includes('฿1,800'), 'ไม่มี');
      else s.check(`สนาม ${f}`, card.includes('฿800') && card.includes('฿1,200') && nextTxt.includes('฿1,300') && nextTxt.includes('1 พ.ย.'), nextTxt);
    }
    await s.shot(g, '', g.getByTestId('home-field-A'));
  }, () => cur);

  await rec(CR, '2', async (s) => {
    cur = g;
    await open(g, '/fields');
    const ev = await txt(g.getByTestId('field-evening-rate-A'));
    const next = await txt(g.getByTestId('field-evening-rate-next-A').locator('xpath=..'));
    s.check('หน้าสนาม A', ev === '฿1,200' && next.includes('฿1,300') && next.includes('1 พ.ย.'), `ราคาเย็น ${ev} · ข้อความล่วงหน้า "${next}"`);
    await s.shot(g, '', g.getByTestId('field-card-A'));
  }, () => cur);

  await rec(CR, '3', async (s) => {
    cur = g;
    await pickSlot('2026-10-31', 'A', 19);
    const f = await formPrice(g);
    s.check('A ส 31 ต.ค. 19:00', f.total === 1200 && f.payNow === 1200, `ค่าสนาม ${baht(f.total)} · แผน ${f.plan} · จ่ายตอนจอง ${baht(f.payNow)} · ค้างหน้าสนาม ${baht(f.due)}`);
    await s.shot(g, '', g.getByTestId('price-panel'));
  }, () => cur);

  await rec(CR, '4', async (s) => {
    cur = g;
    await pickSlot('2026-11-01', 'A', 19);
    let f = await formPrice(g);
    s.check('A อา 1 พ.ย. 19:00', f.total === 1300 && f.payNow === 650 && f.due === 650, `ค่าสนาม ${baht(f.total)} · แผน ${f.plan} · มัดจำ ${baht(f.payNow)} · ค้างหน้าสนาม ${baht(f.due)}`);
    await s.shot(g, '-A19', g.getByTestId('price-panel'));
    await pickSlot('2026-11-01', 'A', 9);
    f = await formPrice(g);
    s.check('A อา 1 พ.ย. 09:00', f.total === 1300, `ค่าสนาม ${baht(f.total)} · แผน ${f.plan} · จ่ายตอนจอง ${baht(f.payNow)}`);
    await s.shot(g, '-A09', g.getByTestId('price-panel'));
    await pickSlot('2026-11-01', 'B', 19);
    f = await formPrice(g);
    s.check('B อา 1 พ.ย. 19:00', f.total === 1300, `ค่าสนาม ${baht(f.total)} · แผน ${f.plan} · จ่ายตอนจอง ${baht(f.payNow)}`);
    await s.shot(g, '-B19', g.getByTestId('price-panel'));
    s.say('ช่อง "ร้านยืนยัน: เย็นวันอาทิตย์จ่ายมัดจำ 50%" เป็นของร้านติ๊กเอง — ทีมไม่ติ๊กแทน (ระบบให้มัดจำ 50% = ฿650 ตามที่ใบเขียน)');
  }, () => cur);

  await rec(CR, '5', async (s) => {
    cur = g;
    await pickSlot('2026-11-03', 'A', 16);
    await fillBookingForm(g, { hours: 2 });
    const h16 = await val(g.getByTestId('price-hour-16'));
    const h17 = await val(g.getByTestId('price-hour-17'));
    const f = await formPrice(g);
    s.check('A อ 3 พ.ย. 16:00 × 2 ชม.', h16 === 800 && h17 === 1300 && f.total === 2100, `16:00 ${baht(h16)} + 17:00 ${baht(h17)} = ${baht(f.total)}`);
    await s.shot(g, '-A', g.getByTestId('price-panel'));
    await open(g, '/book?date=2026-11-01');
    const c19 = Number(await g.getByTestId('slot-C-19').getAttribute('data-price'));
    await open(g, '/book?date=2026-11-03');
    const c16 = Number(await g.getByTestId('slot-C-16').getAttribute('data-price'));
    s.check('สนาม C ไม่เปลี่ยน', c19 === 1800 && c16 === 1200, `C อา 1 พ.ย. 19:00 ${baht(c19)} · C อ 3 พ.ย. 16:00 ${baht(c16)}`);
    await s.shot(g, '-C', g.getByTestId('slot-C-16'));
  }, () => cur);

  await rec(CR, '6', async (s) => {
    const p = await person(browser, true);
    cur = p;
    const r = await chat(p);
    const a = await r.send('สนาม A ราคาเท่าไร');
    const b = await r.send('สนาม A วันเสาร์ที่ 7 พ.ย. ราคาเท่าไร');
    const c = await r.send('สนาม A วันเสาร์ที่ 31 ต.ค. ราคาเท่าไร');
    s.say(`1) "${a.bot}"`); s.say(`2) "${b.bot}"`); s.say(`3) "${c.bot}"`);
    const F = (t: typeof a) => ChatRoom.fullText(t as never);
    s.check('คำตอบแรก', F(a).includes('฿800') && F(a).includes('฿1,200') && F(a).includes('฿1,300') && F(a).includes('1 พ.ย.'), '฿800 ฿1,200 และ ฿1,300 ตั้งแต่ 1 พ.ย.');
    s.check('คำตอบที่สอง (เสาร์ 7 พ.ย.)', F(b).includes('฿1,300') && !F(b).includes('฿1,200'), F(b).includes('฿1,300') ? '฿1,300' : 'ไม่เจอ ฿1,300');
    s.check('คำตอบที่สาม (เสาร์ 31 ต.ค.)', F(c).includes('฿1,200') && !F(c).includes('฿1,300'), F(c).includes('฿1,200') ? '฿1,200' : 'ไม่เจอ ฿1,200');
    await s.shot(p);
  }, () => cur);

  const ph = uniquePhone(3);
  const pw = 'Test12345';
  let code7 = '';
  let snap = { total: -1, paid: -1 };
  await rec(CR, '7', async (s) => {
    // ทีมเตรียม: สมาชิกใหม่ จอง A ส 31 ต.ค. 19:00 จ่ายแล้ว ฿1,200
    await registerCustomer(request, { name: 'ลูกค้าเลื่อนวัน', phone: ph, password: pw });
    code7 = (await createBooking(request, { fieldId: 'A', date: '2026-10-31', startHour: 19, phone: ph, name: 'ลูกค้าเลื่อนวัน' })).code;
    await payBooking(request, code7);
    const p = await person(browser);
    cur = p;
    await memberLoginUi(p, ph, pw);
    await open(p, `/booking/${code7}`);
    s.say(`การจองที่ทีมเตรียม: ${code7} (A ส 31 ต.ค. 19:00 จ่ายแล้ว ${baht(await val(p.getByTestId('amount-paid')))})`);
    await s.shot(p, '-before', p.getByTestId('price-total'));
    await p.getByTestId('reschedule-date').fill('2026-11-03');
    await p.getByTestId('reschedule-start').selectOption('19');
    await p.getByTestId('reschedule-submit').click();
    await expect(p.getByTestId('success-message').or(p.getByTestId('error-message')).first()).toBeVisible();
    const ok = (await p.getByTestId('success-message').count()) ? await txt(p.getByTestId('success-message')) : '';
    const er = (await p.getByTestId('error-message').count()) ? await txt(p.getByTestId('error-message')) : '';
    const total = await val(p.getByTestId('price-total'));
    const paid = await val(p.getByTestId('amount-paid'));
    snap = { total, paid };
    s.check('เลื่อนไป อ 3 พ.ย. 19:00', /฿100/.test(ok) && total === 1300, `ข้อความ "${ok || er}" · ยอดรวมใหม่ ${baht(total)} · จ่ายแล้ว ${baht(paid)}`);
    await s.shot(p, '-after');
    // เก็บคนนี้ไว้ดูใหม่ในขั้น 10
    cur = p;
  }, () => cur);

  await rec(CR, '8', async (s) => {
    const p = await person(browser);
    cur = p;
    await memberLoginUi(p, SEED.ton.phone, SEED.ton.password);
    await open(p, '/series');
    await p.getByTestId('series-field').selectOption('A');
    await p.getByTestId('series-start-date').fill('2026-10-28');
    await p.getByTestId('series-start').selectOption('19');
    await p.getByTestId('series-hours').fill('1');
    await p.getByTestId('series-weeks').fill('8');
    const pv = p.waitForResponse((r) => r.url().includes('/api/series/preview'));
    await p.getByTestId('series-preview').click();
    const pj = (await (await pv).json()).preview;
    await expect(p.getByTestId('series-weeks-booked')).toBeVisible();
    const weeks: string[] = [];
    for (let i = 1; i <= 8; i++) weeks.push(await txt(p.getByTestId(`series-week-${i}`)));
    weeks.forEach((w, i) => s.say(`สัปดาห์ ${i + 1}: ${w}`));
    const field = await val(p.getByTestId('series-field-price'));
    const disc = await val(p.getByTestId('series-discount'));
    const total = await val(p.getByTestId('series-total-price'));
    const pct = await val(p.getByTestId('series-discount-percent'));
    const fp: number[] = pj.weeks.map((w: { fieldPrice: number }) => w.fieldPrice);
    s.say('บนจอ รายสัปดาห์แสดงเฉพาะยอดจ่ายตอนจอง (สัปดาห์ 1 = ฿540 · สัปดาห์ 2–8 = ฿585) ไม่แสดงค่าสนามรายสัปดาห์ · ค่าสนามรายสัปดาห์ด้านล่างอ่านจากคำตอบของระบบที่หน้าจอเรียก (POST /api/series/preview) ซึ่งเป็นข้อมูลที่หน้าจอใช้วาด');
    s.note('ข้อ 8 ของใบเขียนให้เห็น "สัปดาห์ที่ 1 ฿1,200 · สัปดาห์ที่ 2–8 ฿1,300" แต่หน้าจอไม่ได้แสดงค่าสนามรายสัปดาห์ — แสดงเฉพาะยอดจ่ายตอนจองรายสัปดาห์ (฿540 / ฿585 = ครึ่งหนึ่งของ ฿1,080 / ฿1,170 หลังลด 10%) กับยอดรวมด้านล่าง · ควรแก้ใบเป็น "สัปดาห์ที่ 1 ฿540 · สัปดาห์ที่ 2–8 สัปดาห์ละ ฿585" แล้วคงยอดรวม ฿10,300 / ฿1,030 / ฿9,270');
    s.check('ค่าสนามสัปดาห์ที่ 1 (28 ต.ค.) ฿1,200', fp[0] === 1200, `${fp[0]} (จอแสดงจ่ายตอนจอง ${weeks[0].split(' ').pop()})`);
    s.check('ค่าสนามสัปดาห์ที่ 2–8 ฿1,300', fp.slice(1).every((x) => x === 1300) && fp.length === 8, fp.join(', '));
    s.check('ค่าสนามรวม / ส่วนลด / ยอดรวม', field === 10300 && disc === 1030 && total === 9270 && pct === 10, `ค่าสนามรวม ${baht(field)} · ส่วนลด ${pct}% = ${baht(disc)} · ยอดรวม ${baht(total)}`);
    const tp: number[] = pj.weeks.map((w: { totalPrice: number }) => w.totalPrice);
    s.check('คิดลดต่อชั่วโมงช่วง 1 พ.ย. เป็นต้นไป ฿1,170', tp.slice(1).every((x) => x === 1170) && tp[0] === 1080, `ยอดสัปดาห์ละหลังลด: ${tp.join(', ')} · จอแสดงยอดจ่ายตอนจอง ${weeks[1].split(' ').pop()} (= ครึ่งของ 1,170)`);
    await s.shotTop(p, '-weeks', p.getByTestId('series-weeks-list'));
    await s.shotTop(p, '-total', p.getByTestId('series-total-price'), 400);
  }, () => cur);

  await rec(CR, '9', async (s) => {
    s.skipReason = 'ข้าม: ขั้น "ทีมทำ ตอนขึ้นระบบจริง" ต้องมียอดจริงก่อน/หลังขึ้นระบบ — เครื่องทดสอบนี้ไม่มีข้อมูลจริงให้เทียบ · หลักฐานที่มี: ซ้อมบนข้อมูลจำลองเท่าจริง (638 การจอง) ใน docs/impact/CR-05.md ข้อ 5 และ e2e CR-05-S2';
  });

  await rec(CR, '10', async (s) => {
    await setClock(request, T('2026-11-02T10:00:00'));
    s.say('ทีมตั้งเวลา = จ 2 พ.ย. 2026 10:00');
    const p = await person(browser, true);
    cur = p;
    await open(p, '/');
    const card = await txt(p.getByTestId('home-field-A'));
    const nextN = await p.getByTestId('home-field-A-next-rate').count();
    s.check('หน้าแรก การ์ดสนาม A', card.includes('฿1,300') && !card.includes('฿1,200') && nextN === 0, `"${card}" · บรรทัด "ตั้งแต่ 1 พ.ย.": ${nextN ? 'ยังมี' : 'ไม่มี'}`);
    await s.shot(p, '-home', p.getByTestId('home-field-A'));
    await open(p, '/fields');
    const ev = await txt(p.getByTestId('field-evening-rate-A'));
    const nextF = await p.getByTestId('field-evening-rate-next-A').count();
    s.check('หน้าสนาม สนาม A', ev === '฿1,300' && nextF === 0, `ราคาเย็น ${ev} · บรรทัดล่วงหน้า: ${nextF ? 'ยังมี' : 'ไม่มี'}`);
    await s.shot(p, '-fields', p.getByTestId('field-card-A'));
    const r = await chat(p);
    const a = await r.send('สนาม A ราคาเท่าไร');
    s.say(`น้องบอล: "${a.bot}"`);
    s.check('น้องบอล', a.bot.includes('฿1,300') && !a.bot.includes('฿1,200') && !a.bot.includes('ตั้งแต่ 1 พ.ย.'), a.bot.includes('฿1,200') ? 'ยังพูดถึง ฿1,200' : 'บอก ฿1,300 อย่างเดียว');
    await s.shot(p, '-chat');
    const q = await person(browser);
    cur = q;
    await memberLoginUi(q, ph, pw);
    await open(q, `/booking/${code7}`);
    const total = await val(q.getByTestId('price-total'));
    const paid = await val(q.getByTestId('amount-paid'));
    s.check(`การจอง ${code7} จากขั้น 7 ยอดไม่เปลี่ยน`, total === snap.total && paid === snap.paid && total === 1300, `ยอดรวม ${baht(total)} จ่ายแล้ว ${baht(paid)} (ขั้น 7: ${baht(snap.total)} / ${baht(snap.paid)})`);
    await s.shot(q, '-booking', q.getByTestId('price-total'));
  }, () => cur);

  // ทดลองเสริมของใบ (ชั่วโมงฟรีของ "มิว") — ย้อนเวลากลับ 25 ต.ค.
  await rec(CR, 'extra', async (s) => {
    await setClock(request, T('2026-10-25T10:00:00'));
    const p = await person(browser);
    cur = p;
    await memberLoginUi(p, SEED.mew.phone, SEED.mew.password);
    s.say('ตั้งเวลากลับ 25 ต.ค. 10:00 เพื่อจองล่วงหน้า อ 3 พ.ย. ได้');
    await open(p, '/book?date=2026-11-03');
    await p.getByTestId('slot-A-16').click();
    await waitReady(p);
    await fillBookingForm(p, { hours: 2 });
    await p.getByTestId('use-free-hour').check();
    await expect.poll(async () => val(p.getByTestId('price-total')), { timeout: 8000 }).toBe(1300);
    const free = await val(p.getByTestId('price-free-hour'));
    const total = await val(p.getByTestId('price-total'));
    s.check('มิว A อ 3 พ.ย. 16:00 × 2 ชม. ใช้ชั่วโมงฟรี', free === 800 && total === 1300, `ลดฟรี ${baht(free)} · ยอดรวมเหลือจ่าย ${baht(total)}`);
    await s.shot(p, '-16', p.getByTestId('price-panel'));
    await open(p, '/book?date=2026-11-03');
    await p.getByTestId('slot-A-17').click();
    await waitReady(p);
    await p.getByTestId('use-free-hour').check({ force: true }).catch(() => {});
    const reason = (await p.getByTestId('use-free-hour-reason').count()) ? await txt(p.getByTestId('use-free-hour-reason')) : '(ไม่มีข้อความ)';
    const disabled = await p.getByTestId('use-free-hour').isDisabled().catch(() => false);
    const t2 = await val(p.getByTestId('price-total'));
    s.check('รอบ 17:00 ใช้ชั่วโมงฟรีไม่ได้', t2 === 1300 && (disabled || /17:00|ก่อน/.test(reason)), `ช่องติ๊กปิดอยู่=${disabled} · ข้อความ "${reason}" · ยอดรวม ${baht(t2)} (ไม่มีส่วนลดฟรี)`);
    await s.shot(p, '-17', p.getByTestId('price-panel'));
  }, () => cur);
});

// ================================================================= CR-06
test('CR-06 เงินจากทีมรับคำท้าต้องขึ้นในรายงาน', async ({ browser, request }) => {
  const CR = 'CR-06';
  await resetData(request);
  const A = await person(browser);
  const B = await person(browser);
  const own = await person(browser);
  let cur: Page = A;
  const phoneA = uniquePhone(3);
  const phoneB = uniquePhone(3);
  const pw = 'Test12345';
  let code = '';
  let chId = 0;
  let totalBefore = 0;
  const repDay = async (p: Page, d: string) => {
    await ownerReport(p, d, d);
    return { pp: await val(p.getByTestId('report-total-booking-promptpay')), book: await val(p.getByTestId('report-total-booking')), total: await val(p.getByTestId('report-total-money')) };
  };

  await rec(CR, '1', async (s) => {
    cur = A;
    await registerUi(A, 'ผู้จอง A', phoneA, pw);
    await registerUi(B, 'ทีมรับคำท้า B', phoneB, pw);
    await open(A, '/book?date=2026-10-16');
    await A.getByTestId('slot-C-18').click();
    await waitReady(A);
    await fillBookingForm(A, { name: 'ผู้จอง A', phone: phoneA, consent: true });
    await A.getByTestId('book-submit').click();
    await expect(A).toHaveURL(/\/pay\/LN-\d{6}$/);
    await waitReady(A);
    code = A.url().split('/pay/')[1];
    await A.getByTestId('pay-confirm').click();
    await expect(A).toHaveURL(new RegExp(`/booking/${code}\\?done=paid`));
    await waitReady(A);
    const paid = await val(A.getByTestId('amount-paid'));
    s.check(`จอง C ศ 16 ต.ค. 18:00 · รหัส ${code}`, paid === 1800, `จ่ายแล้ว ${baht(paid)} · ยอดรวม ${baht(await val(A.getByTestId('price-total')))} · สถานะ ${await A.getByTestId('booking-status').getAttribute('data-value')}`);
    await s.shot(A);
  }, () => cur);

  await rec(CR, '2', async (s) => {
    cur = own;
    await staffLoginUi(own, 'owner');
    const r = await repDay(own, '2026-10-09');
    totalBefore = r.total;
    s.check('รายงาน 9 ต.ค. ช่อง "มัดจำ/จ่ายผ่านพร้อมเพย์"', r.pp === 1800, `${baht(r.pp)} (ยอดจอง ${baht(r.book)} · รวมรับเงิน ${baht(r.total)})`);
    await s.shot(own, '', own.getByTestId('report-totals'));
  }, () => cur);

  await rec(CR, '3', async (s) => {
    cur = A;
    await A.getByTestId('challenge-team').fill('ทีมเจ้าบ้าน');
    await A.getByTestId('challenge-level').selectOption('INTERMEDIATE');
    await A.getByTestId('challenge-create').click();
    await expect(A.getByTestId('challenge-info')).toBeVisible();
    const info = await txt(A.getByTestId('challenge-info'));
    const amt = await val(A.getByTestId('challenge-amount'));
    s.check('หลัง "ประกาศหาคู่แข่ง"', amt === 900 && info.includes('ทีมรับจ่าย'), `"${info}"`);
    await s.shot(A, '', A.getByTestId('challenge-info'));
    chId = (await getJson(request, `/api/bookings/${code}?phone=${phoneA}`)).body.booking.challenge.id;
  }, () => cur);

  await rec(CR, '4', async (s) => {
    cur = B;
    await open(B, '/challenges');
    await B.getByTestId(`challenge-accept-${chId}`).click();
    await B.getByTestId('accept-name').fill('ทีมรับคำท้า B');
    await B.getByTestId('accept-phone').fill(phoneB);
    await B.getByTestId('accept-consent').check();
    await B.getByTestId('accept-submit').click();
    await expect(B.getByTestId('challenge-pay-panel')).toBeVisible();
    await s.shot(B, '-B', B.getByTestId('challenge-pay-panel'));
    const panel = await txt(B.getByTestId('challenge-pay-panel'));
    const r = await repDay(own, '2026-10-09');
    s.check('หน้า "ชำระเงินรับคำท้า" ขึ้น', true, `"${panel.slice(0, 120)}"`);
    s.check('รายงาน 9 ต.ค. ยัง ฿1,800 (ยังไม่ได้รับเงิน)', r.pp === 1800, `พร้อมเพย์ ${baht(r.pp)}`);
    await s.shot(own, '-owner', own.getByTestId('report-totals'));
  }, () => cur);

  await rec(CR, '5', async (s) => {
    cur = B;
    await B.getByTestId('challenge-pay-confirm').click();
    await expect(B.getByTestId('success-message').or(B.getByTestId(`challenge-${chId}`)).first()).toBeVisible();
    await waitReady(B);
    s.say('ทีม B กด "ฉันโอนแล้ว ยืนยันการจ่าย" → ' + ((await B.getByTestId('success-message').count()) ? await txt(B.getByTestId('success-message')) : '(ดูภาพ)'));
    await s.shot(B, '-B');
    const r = await repDay(own, '2026-10-09');
    s.check('พร้อมเพย์', r.pp === 2700, baht(r.pp));
    s.check('ยอดจอง', r.book === 2700, baht(r.book));
    s.check('รวมรับเงินเพิ่มขึ้น', r.total - totalBefore === 900, `${baht(totalBefore)} → ${baht(r.total)} (+${baht(r.total - totalBefore)})`);
    await s.shot(own, '-owner', own.getByTestId('report-totals'));
  }, () => cur);

  // ลำดับทำจริง: ขั้น 7–8 ใช้การจองชุดเดียวกับขั้น 1–5 จึงทำก่อนขั้น 6 (ขั้น 6 ต้อง reset ข้อมูล)
  await rec(CR, '7', async (s) => {
    cur = A;
    await open(A, '/my');
    const bal = await val(A.getByTestId('credit-balance'));
    const entries = await A.locator('[data-testid^="credit-entry-"]').evaluateAll((es) => es.map((e) => ({ reason: e.getAttribute('data-reason'), amount: e.getAttribute('data-value'), text: (e.textContent ?? '').replace(/\s+/g, ' ').trim() })));
    s.say('ประวัติเครดิต: ' + entries.map((e) => e.text).join(' | '));
    s.check('เครดิต', bal === 900 && entries.length === 1 && entries[0].reason === 'CHALLENGE' && entries[0].amount === '900', `ยอดเครดิต ${baht(bal)} · ${entries.length} รายการ เหตุผล ${entries[0]?.reason} ${entries[0]?.amount}`);
    await s.shot(A, '-credit', A.getByTestId('credit-history'));
    await open(A, `/booking/${code}`);
    const paid = await val(A.getByTestId('amount-paid'));
    const due = await val(A.getByTestId('due-at-field'));
    const page = await txt(A.locator('main').first());
    s.check('การจองใบนั้น', paid === 1800 && due === 0, `จ่ายแล้ว ${baht(paid)} · ค้างจ่าย ${baht(due)}`);
    const noSrc = (await A.locator('[data-testid^="history-payment"]').count()) === 0 && !page.includes('จากทีมรับคำท้า');
    const seg900 = (page.match(/.{0,12}฿900/g) ?? []).join(' | ');
    s.check('ไม่เห็นรายการเงิน ฿900 ของทีมอื่นในหน้าลูกค้า', noSrc, `ไม่มีรายการ/ป้าย "จากทีมรับคำท้า" บนหน้า · ข้อความที่มี 900 บนหน้า: "${seg900}" (คือจำนวนที่ประกาศ ไม่ใช่รายการเงิน)`);
    await s.shot(A, '-booking', A.getByTestId('amount-paid'));
  }, () => cur);

  await rec(CR, '8', async (s) => {
    cur = own;
    await open(own, '/owner/bookings');
    await own.getByTestId('bk-search-code').fill(code);
    await own.getByTestId('bk-search-submit').click();
    await own.getByTestId(`bk-link-${code}`).click();
    await expect(own.getByTestId('history-payments')).toBeVisible();
    await waitReady(own);
    const pay = await txt(own.getByTestId('history-payments'));
    const n = await own.locator('[data-testid^="history-payment-"]:not([data-testid*="source"])').count();
    s.say('ส่วน "การชำระเงิน": ' + pay);
    s.check('2 แถว: ฿1,800 (ไม่มีป้าย) และ ฿900 "จากทีมรับคำท้า"', /1,800/.test(pay) && /900/.test(pay) && /จากทีมรับคำท้า/.test(pay) && (pay.match(/จากทีมรับคำท้า/g) ?? []).length === 1, `${n} แถว · ป้ายพบ ${(pay.match(/จากทีมรับคำท้า/g) ?? []).length} ครั้ง`);
    await s.shot(own, '', own.getByTestId('history-payments'));
  }, () => cur);

  await rec(CR, '9', async (s) => {
    const sqlFile = path.resolve(__dirname, '..', '..', '..', 'tools', 'reconcile-challenges.sql');
    const r = spawnSync('docker', ['exec', '-i', 'football-db', 'psql', '-U', 'football', '-d', 'football', '-v', 'ON_ERROR_STOP=1', '-At', '-F', ' | '], { input: fs.readFileSync(sqlFile), encoding: 'utf8' });
    const out = (r.stdout ?? '').trim().split(/\r?\n/);
    s.say(`รัน tools/reconcile-challenges.sql บนข้อมูลหลังขั้น 5 (มีคำท้า MATCHED 1 ใบ) → exit ${r.status}`);
    out.forEach((l) => s.say(l));
    s.check('a_matched_without_payment', out.includes('a_matched_without_payment | 0'), out.find((l) => l.startsWith('a_')) ?? '-');
    s.check('b_payment_not_matching_credit', out.includes('b_payment_not_matching_credit | 0'), out.find((l) => l.startsWith('b_')) ?? '-');
    s.say('(ขั้นนี้เป็นคำสั่งบนเครื่อง ไม่มีหน้าเว็บให้ถ่ายภาพ — ผลคำสั่งอยู่ในคอลัมน์ "เห็นอะไร")');
    s.say('ข้อสังเกต: รันบนเครื่องทดสอบ ไม่ใช่ตอนขึ้นระบบจริง (ใบเขียน "หลังขึ้นระบบจริง") — ผลบนเครื่องจริงต้องรันซ้ำตอนนั้น');
  }, () => cur);

  await rec(CR, '6', async (s) => {
    // ทีมทำ: reset แล้วทำชุดที่ 2 (A จอง C ศ 16 ต.ค. 19:00 จ่าย ประกาศหาคู่แข่ง) แล้วเลื่อนเวลา 12 ต.ค. 10:00 ให้ B รับ+จ่าย
    await resetData(request);
    const pA = uniquePhone(3);
    const pB = uniquePhone(3);
    await registerCustomer(request, { name: 'ผู้จอง A2', phone: pA, password: pw });
    const bk = (await createBooking(request, { fieldId: 'C', date: '2026-10-16', startHour: 19, phone: pA, name: 'ผู้จอง A2' })).code as string;
    await payBooking(request, bk, pA);
    const c = await postJson(request, '/api/challenges', { code: bk, phone: pA, teamName: 'ทีมเจ้าบ้าน A2', level: 'INTERMEDIATE' });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    const id = c.body.challenge.id as number;
    await setClock(request, T('2026-10-12T10:00:00'));
    s.say(`ทีมเตรียม: รีเซ็ต · ${bk} (C ศ 16 ต.ค. 19:00 จ่าย ฿1,800 แล้วประกาศหาคู่แข่ง) · ตั้งเวลา = จ 12 ต.ค. 10:00`);
    const b2 = await person(browser);
    cur = b2;
    await open(b2, '/challenges');
    await b2.getByTestId(`challenge-accept-${id}`).click();
    await b2.getByTestId('accept-name').fill('ทีมรับคำท้า B2');
    await b2.getByTestId('accept-phone').fill(pB);
    await b2.getByTestId('accept-consent').check();
    await b2.getByTestId('accept-submit').click();
    await expect(b2.getByTestId('challenge-pay-panel')).toBeVisible();
    await b2.getByTestId('challenge-pay-confirm').click();
    await waitReady(b2);
    await s.shot(b2, '-B');
    const o = await person(browser);
    cur = o;
    await staffLoginUi(o, 'owner');
    const r12 = await repDay(o, '2026-10-12');
    await s.shot(o, '-12', o.getByTestId('report-totals'));
    const r9 = await repDay(o, '2026-10-09');
    await s.shot(o, '-09', o.getByTestId('report-totals'));
    s.check('รายงาน 12 ต.ค. (วันรับเงิน)', r12.pp === 900, `พร้อมเพย์ ${baht(r12.pp)} · ยอดจอง ${baht(r12.book)}`);
    s.check('รายงาน 9 ต.ค.', r9.pp === 1800, `พร้อมเพย์ ${baht(r9.pp)} (ไม่เปลี่ยน)`);
  }, () => cur);

  await rec(CR, '10', async (s) => {
    s.skipReason = 'ข้าม: ขั้น "ทีมทำ หลังขึ้นระบบจริง" ต้องมีเดือนที่เคยมีคำท้าที่จ่ายแล้ว (ข้อมูลจริงของร้าน) — เครื่องทดสอบ seed ไม่มีคำท้าในอดีต · หลักฐานที่มี: e2e CR-06-05 (ถอย/ขึ้น migration 009 บนข้อมูลจำลอง · RUN_MIGRATION_TEST=1) ใน docs/impact/CR-06.md';
  });
});
