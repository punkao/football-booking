import type { APIRequestContext, APIResponse } from '@playwright/test';
import { test, expect, uniquePhone, createBooking, payBooking, registerCustomer, postJson, resetData } from '../fixtures';
import { BASE_URL, SEED } from '../constants';
import { ann, sql } from '../v2-helpers';

/**
 * ตาข่ายเสริม (ข): ส่งข้อมูล "ผิดชนิด/ผิดรูป" ให้ API ที่ CR แตะ → ต้องได้ 400 (หรือ 401/403/404 ที่ตรงเหตุ) พร้อมรหัส error ตามที่เอกสารบอก
 * ห้ามได้ 500 และห้ามมีอะไรถูกเขียนลงฐาน (นับแถวทุกตารางที่เกี่ยว ก่อน/หลัง)
 * API ที่ตรวจ: ใบเสนอราคา /api/quote (+ สร้างจอง /api/bookings) · รายงาน /api/owner/reports(.csv) from/to · จ่ายคำท้า /api/challenges/:id/pay · เช็กอินหน้าร้าน /api/staff/bookings/:code/checkin · ออกจากระบบ /api/customers|staff/logout
 * รูปแบบ error ที่เอกสารกำหนด (07-SAD ADR error format): { error: { code, message } } · รหัส/สถานะอยู่ใน web/lib/i18n.ts (MESSAGES) · 500 = INTERNAL เป็นของที่ "ห้ามเกิดจากข้อมูลผิด" (NFR-19)
 * serial: นับแถวทั้งตารางต้องไม่มี test อื่นเขียนพร้อมกัน · reset ก่อนทุกข้อ
 * ข้อที่ขึ้นต้น WT-xx-RED = เจอบั๊กจริงตอนเขียนเทสต์ (500) → แก้แล้ว (รหัสแถวนอก int4 / ไบต์ว่างในรหัส = ไม่พบ) · WT-04-K14 = test.fixme (500 จากตัวจัดเส้นทางของ Next ก่อนถึงโค้ดเรา)
 */

test.beforeEach(async ({ request }) => { await resetData(request); });
test.afterAll(async ({ request }) => { await resetData(request); });

const SRC = 'docs/07-SAD.md รูปแบบ error เดียว { error: { code, message } } · web/lib/i18n.ts MESSAGES · NFR-19';

/** นับแถวของตารางที่ API เหล่านี้อาจเขียน (ก่อน/หลังต้องเท่ากัน) */
function snapshot(): string {
  return sql(
    `select (select count(*) from bookings)||','||(select count(*) from payments)||','||(select count(*) from credit_entries)||','||(select count(*) from customers)` +
    `||','||(select count(*) from challenges)||','||(select count(*) from audit_logs)||','||(select count(*) from booking_status_history)` +
    `||','||(select count(*) from revoked_sessions)||','||(select coalesce(sum(credit_balance),0) from customers)||','||(select count(*) from booking_rentals)`,
  );
}
const SNAPSHOT_KEYS = 'bookings,payments,credit_entries,customers,challenges,audit_logs,booking_status_history,revoked_sessions,Σcredit,booking_rentals';

async function readJson(r: APIResponse): Promise<any> {
  try { return await r.json(); } catch { return null; }
}

/** 4xx + รูปแบบ error ถูกต้อง + รหัสตามที่คาด (ห้าม 5xx) */
function expectClientError(label: string, status: number, body: any, want: { status: number; code: string }) {
  expect.soft(status, `${label}: สถานะ (ห้าม 5xx)`).toBeLessThan(500);
  expect.soft(status, `${label}: สถานะ`).toBe(want.status);
  expect.soft(body?.error?.code, `${label}: รหัส error · ได้ ${JSON.stringify(body)}`).toBe(want.code);
  expect.soft(typeof body?.error?.message, `${label}: มี message อ่านได้`).toBe('string');
}

async function ownerApi(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const r = await ctx.post('/api/staff/login', { data: { username: SEED.owner.username, password: SEED.owner.password } });
  expect(r.status(), 'เข้าสู่ระบบ owner').toBe(200);
  return ctx;
}

// ---------------------------------------------------------------- WT-01 ใบเสนอราคา + สร้างจอง
const GOOD = { fieldId: 'A', date: '2026-10-20', startHour: 12, hours: 1 };
type Case = { label: string; body: unknown; status: number; code: string };
const QUOTE_CASES: Case[] = [
  { label: 'fieldId เป็นตัวเลข', body: { ...GOOD, fieldId: 123 }, status: 400, code: 'INVALID_FIELD' },
  { label: 'fieldId เป็น object', body: { ...GOOD, fieldId: { a: 1 } }, status: 400, code: 'INVALID_FIELD' },
  { label: 'fieldId เป็น array', body: { ...GOOD, fieldId: ['A'] }, status: 400, code: 'INVALID_FIELD' },
  { label: 'date เป็นตัวเลข 20261020', body: { ...GOOD, date: 20261020 }, status: 400, code: 'INVALID_DATE' },
  { label: 'date เป็น array', body: { ...GOOD, date: ['2026-10-20'] }, status: 400, code: 'INVALID_DATE' },
  { label: 'date ไม่มีจริง 2026-02-30', body: { ...GOOD, date: '2026-02-30' }, status: 400, code: 'INVALID_DATE' },
  { label: 'date มีเวลาต่อท้าย', body: { ...GOOD, date: '2026-10-20T12:00' }, status: 400, code: 'INVALID_DATE' },
  { label: 'startHour เป็นข้อความ abc', body: { ...GOOD, startHour: 'abc' }, status: 400, code: 'INVALID_START_HOUR' },
  { label: 'startHour เป็น array [12]', body: { ...GOOD, startHour: [12] }, status: 400, code: 'INVALID_START_HOUR' },
  { label: 'startHour เป็นทศนิยม 12.5', body: { ...GOOD, startHour: 12.5 }, status: 400, code: 'INVALID_START_HOUR' },
  { label: 'startHour ติดลบ', body: { ...GOOD, startHour: -1 }, status: 400, code: 'INVALID_START_HOUR' },
  { label: 'startHour null', body: { ...GOOD, startHour: null }, status: 400, code: 'INVALID_START_HOUR' },
  { label: 'hours เป็นข้อความ x', body: { ...GOOD, hours: 'x' }, status: 400, code: 'INVALID_HOURS' },
  { label: 'hours เป็น null', body: { ...GOOD, hours: null }, status: 400, code: 'INVALID_HOURS' },
  { label: 'hours เป็นทศนิยม 1.5', body: { ...GOOD, hours: 1.5 }, status: 400, code: 'INVALID_HOURS' },
  { label: 'hours เป็น 0', body: { ...GOOD, hours: 0 }, status: 400, code: 'INVALID_HOURS' },
  { label: 'rentals เป็น [{itemId:{}, qty:"a"}]', body: { ...GOOD, rentals: [{ itemId: {}, qty: 'a' }] }, status: 400, code: 'INVALID_QTY' },
  { label: 'rentals เป็น {BIB:"abc"}', body: { ...GOOD, rentals: { BIB: 'abc' } }, status: 400, code: 'INVALID_QTY' },
  { label: 'rentals จำนวนติดลบ', body: { ...GOOD, rentals: [{ itemId: 'BIB', qty: -5 }] }, status: 400, code: 'INVALID_QTY' },
  { label: 'rentals จำนวนทศนิยม 1.5', body: { ...GOOD, rentals: { BIB: 1.5 } }, status: 400, code: 'INVALID_QTY' },
  { label: 'ตัว body เป็น array', body: [1, 2], status: 400, code: 'INVALID_FIELD' },
  { label: 'ตัว body เป็นข้อความ', body: 'str', status: 400, code: 'INVALID_FIELD' },
  { label: 'ตัว body ว่าง', body: undefined, status: 400, code: 'INVALID_FIELD' },
];
const BOOKING_CASES: Case[] = [
  { label: 'name เป็นตัวเลข', body: { ...GOOD, name: 123, phone: '0899990002', consent: true }, status: 400, code: 'NAME_REQUIRED' },
  { label: 'name เป็น object, phone null, consent 1', body: { ...GOOD, name: { a: 1 }, phone: null, consent: 1 }, status: 400, code: 'NAME_REQUIRED' },
  { label: 'phone เป็นตัวเลข', body: { ...GOOD, name: 'x', phone: 899990002, consent: true }, status: 400, code: 'INVALID_PHONE' },
  { label: 'phone เป็น array', body: { ...GOOD, name: 'x', phone: ['0899990002'], consent: true }, status: 400, code: 'INVALID_PHONE' },
  { label: 'consent เป็นข้อความ "true"', body: { ...GOOD, name: 'x', phone: '0899990002', consent: 'true' }, status: 400, code: 'CONSENT_REQUIRED' },
  { label: 'consent เป็นตัวเลข 1', body: { ...GOOD, name: 'x', phone: '0899990002', consent: 1 }, status: 400, code: 'CONSENT_REQUIRED' },
  { label: 'hours ใหญ่เกินวัน (1e9)', body: { ...GOOD, hours: 1e9, name: 'x', phone: '0899990002', consent: true }, status: 400, code: 'ENDS_AFTER_MIDNIGHT' },
  ...QUOTE_CASES.filter((c) => !/ตัว body/.test(c.label)).map((c) => ({ ...c, label: `จอง · ${c.label}`, body: { ...(c.body as object), name: 'x', phone: '0899990002', consent: true } })),
];

test('WT-01 ใบเสนอราคาและการสร้างจอง: ข้อมูลผิดชนิด → 400 พร้อมรหัสที่ถูก · ไม่มี 500 · ไม่มีอะไรถูกเขียนลงฐาน', {
  tag: ['@WRONG-TYPE', '@P1'],
  annotation: ann({
    tc: 'WT-01', level: 'P1', source: `${SRC} · FR-03/FR-05 ตรวจฝั่งเซิร์ฟเวอร์ทุกค่า · CR-05 (ใบเสนอราคาที่ CR แตะ)`,
    expected: `POST /api/quote ${QUOTE_CASES.length} กรณี และ POST /api/bookings ${BOOKING_CASES.length} กรณี (fieldId/date/startHour/hours/rentals/name/phone/consent ผิดชนิด) → 400 + รหัส INVALID_FIELD/INVALID_DATE/INVALID_START_HOUR/INVALID_HOURS/INVALID_QTY/NAME_REQUIRED/INVALID_PHONE/CONSENT_REQUIRED/ENDS_AFTER_MIDNIGHT · จำนวนแถวทุกตารางเท่าเดิม`,
  }),
}, async ({ request }) => {
  const before = snapshot();
  await test.step(`ใบเสนอราคา ${QUOTE_CASES.length} กรณีข้อมูลผิดชนิด → 400 รหัสถูก`, async () => {
    for (const c of QUOTE_CASES) {
      const r = c.body === undefined ? await request.post('/api/quote') : await request.post('/api/quote', { data: c.body as never });
      expectClientError(`quote · ${c.label}`, r.status(), await readJson(r), c);
    }
  });
  await test.step(`สร้างการจอง ${BOOKING_CASES.length} กรณีข้อมูลผิดชนิด → 400 รหัสถูก`, async () => {
    for (const c of BOOKING_CASES) {
      const r = await request.post('/api/bookings', { data: c.body as never });
      expectClientError(`bookings · ${c.label}`, r.status(), await readJson(r), c);
    }
  });
  await test.step('ใบเสนอราคาที่ค่าเสริมผิดชนิด (rentals ไม่ใช่ list/object · creditUsed เป็นข้อความ · useCredit เป็นข้อความ) → ถูกมองว่าไม่ได้ส่ง: 200 ราคาเดิม ไม่คิดค่าเช่า/เครดิตเพิ่ม', async () => {
    for (const extra of [{ rentals: 'x' }, { creditUsed: 'abc' }, { useCredit: 'yes' }, { useFreeHour: 'yes' }]) {
      const r = await postJson(request, '/api/quote', { ...GOOD, ...extra });
      expect.soft(r.status, `quote + ${JSON.stringify(extra)} ห้าม 5xx`).toBe(200);
      expect.soft(r.body?.quote, JSON.stringify(extra)).toMatchObject({ fieldPrice: 800, rentalPrice: 0, creditUsed: 0, freeHourValue: 0, totalPrice: 800 });
    }
  });
  await test.step('ไม่มีอะไรถูกเขียนลงฐาน (การจอง เงิน เครดิต ลูกค้า ประวัติ)', async () => {
    expect(snapshot(), `นับแถว ${SNAPSHOT_KEYS}`).toBe(before);
  });
});

// ---------------------------------------------------------------- WT-02 รายงาน from/to
const REPORT_CASES: { label: string; qs: string; status: number; code: string }[] = [
  { label: 'ไม่ส่ง from/to', qs: '', status: 400, code: 'INVALID_DATE' },
  { label: 'from/to เป็นข้อความ abc/def', qs: 'from=abc&to=def', status: 400, code: 'INVALID_DATE' },
  { label: 'เดือน 13 วัน 45', qs: 'from=2026-13-45&to=2026-10-10', status: 400, code: 'INVALID_DATE' },
  { label: 'วันที่ไม่มีจริง 2026-02-30', qs: 'from=2026-02-30&to=2026-10-01', status: 400, code: 'INVALID_DATE' },
  { label: 'from เป็น array (from[]=)', qs: 'from[]=2026-10-01&to=2026-10-10', status: 400, code: 'INVALID_DATE' },
  { label: 'from เป็นตัวเลข 20261001', qs: 'from=20261001&to=2026-10-10', status: 400, code: 'INVALID_DATE' },
  { label: 'from มีเวลาต่อท้าย', qs: 'from=2026-10-01T00:00&to=2026-10-02', status: 400, code: 'INVALID_DATE' },
  { label: 'to ว่าง', qs: 'from=2026-10-01&to=', status: 400, code: 'INVALID_DATE' },
  { label: 'ไบต์ผิด UTF-8 (%FF)', qs: 'from=%FF&to=2026-10-01', status: 400, code: 'INVALID_DATE' },
  { label: 'ตัวอักษรคำสั่ง SQL', qs: "from=2026-10-01';DROP TABLE bookings;--&to=2026-10-02", status: 400, code: 'INVALID_DATE' },
  { label: 'to ก่อน from', qs: 'from=2026-10-10&to=2026-10-01', status: 400, code: 'REPORT_RANGE_ORDER' },
  { label: 'ช่วงยาวเกิน 3 เดือน', qs: 'from=2026-10-01&to=2030-10-01', status: 400, code: 'REPORT_RANGE_TOO_LONG' },
];

test('WT-02 รายงานเจ้าของ (JSON และ CSV): from/to ผิดชนิดหรือผิดช่วง → 400 รหัสถูก · ไม่มี 500 · CSV ไม่ถูกบันทึกเป็นการส่งออก (AuditLog) · ไม่เขียนอะไร', {
  tag: ['@WRONG-TYPE', '@CR-03', '@P1'],
  annotation: ann({
    tc: 'WT-02', level: 'P1', source: `${SRC} · CR-03 (รายงาน) · FR-44 · BR-39/BR-40 · NFR-22 (ส่งออก CSV บันทึก REPORT_EXPORT เมื่อสำเร็จเท่านั้น)`,
    expected: `${REPORT_CASES.length} กรณี × (JSON, CSV): INVALID_DATE (ไม่ใช่ YYYY-MM-DD ที่มีจริง/ไม่ส่ง/array/SQL) · REPORT_RANGE_ORDER · REPORT_RANGE_TOO_LONG ทุกกรณีสถานะ 400 · ไม่มี audit_logs เพิ่ม`,
  }),
}, async ({ playwright }) => {
  const owner = await ownerApi(playwright);
  try {
    const before = snapshot();
    for (const [name, path] of [['JSON', '/api/owner/reports'], ['CSV', '/api/owner/reports.csv']] as const) {
      await test.step(`${name}: ${REPORT_CASES.length} กรณี from/to ผิด → 400 รหัสถูก`, async () => {
        for (const c of REPORT_CASES) {
          const r = await owner.get(`${path}${c.qs ? `?${c.qs}` : ''}`);
          expectClientError(`${name} · ${c.label}`, r.status(), await readJson(r), c);
        }
      });
    }
    await test.step('ไม่มีอะไรถูกเขียนลงฐาน (โดยเฉพาะ audit_logs ไม่มี REPORT_EXPORT จากคำขอที่ถูกปฏิเสธ)', async () => {
      expect(snapshot(), `นับแถว ${SNAPSHOT_KEYS}`).toBe(before);
    });
    await test.step('ไม่ได้เข้าสู่ระบบ → 401 UNAUTHORIZED (ไม่ใช่ 400/500) แม้ from/to ผิด', async () => {
      const anon = await playwright.request.newContext({ baseURL: BASE_URL });
      try {
        for (const path of ['/api/owner/reports?from=abc&to=def', '/api/owner/reports.csv?from=abc&to=def']) {
          const r = await anon.get(path);
          expectClientError(`ไม่ล็อกอิน ${path}`, r.status(), await readJson(r), { status: 401, code: 'UNAUTHORIZED' });
        }
      } finally { await anon.dispose(); }
    });
  } finally { await owner.dispose(); }
});

// ---------------------------------------------------------------- WT-03 จ่ายคำท้า
/** สร้างคำท้าที่ "รอทีมอื่นจ่าย" (AWAITING_PAYMENT): เจ้าของจองและจ่าย → ประกาศ → ทีมอื่นรับ */
async function awaitingChallenge(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }) {
  const ownerPhone = uniquePhone(3);
  const rivalPhone = uniquePhone(3);
  const own = await playwright.request.newContext({ baseURL: BASE_URL });
  const rival = await playwright.request.newContext({ baseURL: BASE_URL });
  await registerCustomer(own, { name: 'เจ้าของคำท้า', phone: ownerPhone });
  const bk = await createBooking(own, { fieldId: 'B', date: '2026-10-20', startHour: 14, phone: ownerPhone, name: 'เจ้าของคำท้า' });
  await payBooking(own, bk.code);
  const c = await postJson(own, '/api/challenges', { code: bk.code, teamName: 'ทีมเจ้าของ', level: 'BEGINNER' });
  expect(c.status, JSON.stringify(c.body)).toBe(200);
  const id = c.body.challenge.id as number;
  const a = await postJson(rival, `/api/challenges/${id}/accept`, { name: 'ทีมผู้ท้า', phone: rivalPhone, consent: true });
  expect(a.status, JSON.stringify(a.body)).toBe(200);
  return { id, rival, rivalPhone, ownerPhone, code: bk.code as string, dispose: async () => { await own.dispose(); await rival.dispose(); } };
}

test('WT-03 จ่ายคำท้า: เบอร์โทรผิดชนิด (ตัวเลข/object/array/null/ว่าง) → 403 CHALLENGE_WRONG_PHONE · คำท้ายังรอจ่าย ไม่มีเงิน/เครดิตเขียน · จ่ายด้วยเบอร์ที่ถูกยังจ่ายได้ ฿400 ครั้งเดียว', {
  tag: ['@WRONG-TYPE', '@CR-06', '@P1'],
  annotation: ann({
    tc: 'WT-03', level: 'P1', source: `${SRC} · CR-06 (เงินคำท้า payments.challenge_id) · BR-28 · FR-21 · MESSAGES CHALLENGE_WRONG_PHONE 403`,
    expected: 'B 20 ต.ค. 14:00 ฿800 → คำท้า ฿400 รับแล้วรอจ่าย · จ่ายด้วย phone = 12345 / {a:1} / ["0..."] / null / "" / true / body เป็น array → 403 CHALLENGE_WRONG_PHONE · challenges.status ยัง AWAITING_PAYMENT · payments/credit_entries ไม่เพิ่ม · จ่ายด้วยเบอร์ทีมที่รับ → 200 MATCHED · payments แถวคำท้า 1 แถว ฿400',
  }),
}, async ({ playwright }) => {
  const ch = await awaitingChallenge(playwright);
  try {
    const before = snapshot();
    await test.step('ส่งเบอร์ผิดชนิด 7 แบบ → 403 CHALLENGE_WRONG_PHONE ทุกแบบ', async () => {
      const bodies: [string, unknown][] = [
        ['phone เป็นตัวเลข', { phone: 12345 }],
        ['phone เป็น object', { phone: { a: 1 } }],
        ['phone เป็น array ของเบอร์ที่ถูก', { phone: [ch.rivalPhone] }],
        ['phone เป็น null', { phone: null }],
        ['phone เป็นข้อความว่าง', { phone: '' }],
        ['phone เป็น true', { phone: true }],
        ['ตัว body เป็น array', [ch.rivalPhone]],
      ];
      for (const [label, data] of bodies) {
        const r = await ch.rival.post(`/api/challenges/${ch.id}/pay`, { data: data as never });
        expectClientError(`จ่ายคำท้า · ${label}`, r.status(), await readJson(r), { status: 403, code: 'CHALLENGE_WRONG_PHONE' });
      }
    });
    await test.step('คำท้ายังรอจ่าย · ไม่มีเงิน เครดิต หรือแถวใหม่เขียนลงฐาน', async () => {
      expect(sql(`select status from challenges where id=${ch.id}`)).toBe('AWAITING_PAYMENT');
      expect(snapshot(), `นับแถว ${SNAPSHOT_KEYS}`).toBe(before);
    });
    await test.step('จ่ายด้วยเบอร์ที่ถูก → MATCHED · เงินคำท้าแถวเดียว ฿400', async () => {
      const r = await postJson(ch.rival, `/api/challenges/${ch.id}/pay`, { phone: ch.rivalPhone });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.challenge.status).toBe('MATCHED');
      expect(sql(`select count(*)||','||coalesce(sum(amount),0) from payments where challenge_id=${ch.id}`)).toBe('1,400');
    });
  } finally { await ch.dispose(); }
});

const BAD_IDS: [string, string][] = [
  ['ข้อความ abc', 'abc'],
  ['ทศนิยม 1.5', '1.5'],
  ['ตัวเลขใหญ่เกินช่วงฐานข้อมูล (99999999999)', '99999999999'],
  ['ตัวเลขใหญ่มาก (9223372036854775808)', '9223372036854775808'],
  ['ไบต์ว่าง %00', '%00'],
  ['ติดลบ -1', '-1'],
  ['ศูนย์ 0', '0'],
];

test('WT-03-RED จ่ายคำท้าด้วยรหัสคำท้าที่ไม่ใช่จำนวนเต็ม (abc · 1.5 · เลขใหญ่เกิน · %00) → 404 CHALLENGE_NOT_FOUND เหมือน -1 กับ 0 · ไม่ใช่ 500 (แก้แล้ว)', {
  tag: ['@WRONG-TYPE', '@CR-06', '@P1', '@BUG-FOUND'],
  annotation: ann({
    tc: 'WT-03-RED', level: 'P1', source: `${SRC} · NFR-19 "ข้อมูลผิดต้องไม่ทำให้ระบบ 500" · แก้ที่ web/lib/server/features.ts challengePay/challengeAccept (isDbId ใน web/lib/rules/records.ts) · ตัดสินโดย lead: รหัสที่ไม่ใช่ integer 4 ไบต์ = ไม่พบคำท้า`,
    expected: 'POST /api/challenges/{abc|1.5|99999999999|9223372036854775808|%00|-1|0}/pay และ /accept → 404 CHALLENGE_NOT_FOUND ทุกแบบ · ไม่มีแถวถูกเขียน · ก่อนแก้ abc/1.5/เลขใหญ่/%00 ได้ 500 INTERNAL',
  }),
}, async ({ request }) => {
  const before = snapshot();
  for (const action of ['pay', 'accept'] as const) {
    await test.step(`${action}: รหัสคำท้าผิดชนิด/ผิดช่วง → 404 CHALLENGE_NOT_FOUND (ไม่ใช่ 500)`, async () => {
      for (const [label, id] of BAD_IDS) {
        const r = await request.post(`/api/challenges/${id}/${action}`, { data: { phone: '0811111111', name: 'x', consent: true } });
        expectClientError(`${action} id ${label}`, r.status(), await readJson(r), { status: 404, code: 'CHALLENGE_NOT_FOUND' });
      }
    });
  }
  await test.step('ไม่มีอะไรถูกเขียนลงฐาน', async () => {
    expect(snapshot(), `นับแถว ${SNAPSHOT_KEYS}`).toBe(before);
  });
});

// ---------------------------------------------------------------- WT-04 เช็กอิน
const BAD_CODES: [string, string][] = [
  ['รหัสไม่มีอยู่ NOPE', 'NOPE'],
  ['ตัวเลขล้วน 0', '0'],
  ['มีเครื่องหมาย \' (SQL)', "LN-1%27"],
  ['มีช่องว่าง %20', '%20'],
  ['ยาว 3,000 ตัวอักษร', 'A'.repeat(3000)],
  ['จุดคู่ ..', '..%2F..'],
];

test('WT-04 เช็กอินหน้าร้าน: รหัสการจองผิดรูป → 404 BOOKING_NOT_FOUND · ไม่ล็อกอิน → 401 · ไม่มีการจ่าย/เปลี่ยนสถานะ/นับชั่วโมงเกิดขึ้น', {
  tag: ['@WRONG-TYPE', '@CR-02', '@P1'],
  annotation: ann({
    tc: 'WT-04', level: 'P1', source: `${SRC} · CR-02 (1) เช็กอินเฉพาะวันเล่น/CONFIRMED · FR-23 · BR-42 (ประวัติ/AuditLog)`,
    expected: `staff ล็อกอิน: POST /api/staff/bookings/{${BAD_CODES.map(([l]) => l).join(' · ')}}/checkin → 404 BOOKING_NOT_FOUND · ไม่ล็อกอิน → 401 UNAUTHORIZED · การจองจริงใบหนึ่ง (CONFIRMED) ยัง CONFIRMED จำนวนแถวทุกตารางเท่าเดิม`,
  }),
}, async ({ playwright, request }) => {
  const staff = await playwright.request.newContext({ baseURL: BASE_URL });
  try {
    const login = await staff.post('/api/staff/login', { data: { username: SEED.staff.username, password: SEED.staff.password } });
    expect(login.status()).toBe(200);
    const phone = uniquePhone(3);
    const bk = await createBooking(request, { fieldId: 'C', date: '2026-10-20', startHour: 10, phone, name: 'ตรวจเช็กอินผิดรูป' });
    await payBooking(request, bk.code, phone);
    const before = snapshot();
    await test.step('รหัสผิดรูป 6 แบบ (ล็อกอินแล้ว) → 404 BOOKING_NOT_FOUND', async () => {
      for (const [label, code] of BAD_CODES) {
        const r = await staff.post(`/api/staff/bookings/${code}/checkin`);
        expectClientError(`เช็กอิน · ${label}`, r.status(), await readJson(r), { status: 404, code: 'BOOKING_NOT_FOUND' });
      }
    });
    await test.step('ยังไม่ล็อกอิน → 401 UNAUTHORIZED ทุกแบบ (ก่อนดูรหัส)', async () => {
      const anon = await playwright.request.newContext({ baseURL: BASE_URL });
      try {
        for (const [label, code] of BAD_CODES) {
          const r = await anon.post(`/api/staff/bookings/${code}/checkin`);
          expectClientError(`ไม่ล็อกอิน · ${label}`, r.status(), await readJson(r), { status: 401, code: 'UNAUTHORIZED' });
        }
      } finally { await anon.dispose(); }
    });
    await test.step('การจองจริงยัง CONFIRMED · ไม่มีอะไรถูกเขียนลงฐาน', async () => {
      expect(sql(`select status from bookings where code='${bk.code}'`)).toBe('CONFIRMED');
      expect(snapshot(), `นับแถว ${SNAPSHOT_KEYS}`).toBe(before);
    });
  } finally { await staff.dispose(); }
});

test('WT-04-RED รหัสการจอง/โทเคนที่มีไบต์ว่าง (LN-%00) ในทุกเส้นทางที่รับรหัส → 404 ไม่พบ ไม่ใช่ 500 (แก้แล้ว)', {
  tag: ['@WRONG-TYPE', '@CR-02', '@P1', '@BUG-FOUND'],
  annotation: ann({
    tc: 'WT-04-RED', level: 'P1', source: `${SRC} · แก้ที่ web/lib/server/data.ts loadBookingByCode (hasNul) + features.ts splitGet/splitMarkPaid + backoffice.ts bookingHistory/bookingsSearch · ตัดสินโดย lead: รหัสมีไบต์ว่าง = ไม่พบ`,
    expected: 'staff/owner ล็อกอิน: รหัส LN-%00 → 404 BOOKING_NOT_FOUND ที่ เช็กอิน · no-show · คืนของเช่า · ดูการจอง(staff) · ประวัติ(owner) · และ GET/จ่าย/ยกเลิก/เลื่อน (ลูกค้า) · โทเคนแบ่งจ่าย tok%00 → 404 SPLIT_NOT_FOUND · ค้นหาการจอง ?code=%00 / ?phone=%00 → 200 ไม่มีผล · ก่อนแก้ทั้งหมดได้ 500 INTERNAL',
  }),
}, async ({ playwright }) => {
  const staff = await playwright.request.newContext({ baseURL: BASE_URL });
  const cust = await playwright.request.newContext({ baseURL: BASE_URL });
  try {
    const login = await staff.post('/api/staff/login', { data: { username: SEED.owner.username, password: SEED.owner.password } });
    expect(login.status()).toBe(200);
    const before = snapshot();
    await test.step('ฝั่งร้าน (owner): รหัส LN-%00 → 404 BOOKING_NOT_FOUND', async () => {
      const routes: [string, string][] = [
        ['POST', '/api/staff/bookings/LN-%00/checkin'],
        ['POST', '/api/staff/bookings/LN-%00/no-show'],
        ['POST', '/api/staff/bookings/LN-%00/return-rentals'],
        ['GET', '/api/staff/bookings/LN-%00'],
        ['GET', '/api/owner/bookings/LN-%00/history'],
      ];
      for (const [m, path] of routes) {
        const r = m === 'GET' ? await staff.get(path) : await staff.post(path, { data: {} });
        expectClientError(`${m} ${path}`, r.status(), await readJson(r), { status: 404, code: 'BOOKING_NOT_FOUND' });
      }
    });
    await test.step('ฝั่งลูกค้า: ดู/จ่าย/ยกเลิก/เลื่อน รหัส LN-%00 → 404 BOOKING_NOT_FOUND · โทเคนแบ่งจ่ายมีไบต์ว่าง → 404 SPLIT_NOT_FOUND', async () => {
      for (const [m, path] of [['GET', '/api/bookings/LN-%00'], ['POST', '/api/bookings/LN-%00/pay'], ['POST', '/api/bookings/LN-%00/cancel'], ['POST', '/api/bookings/LN-%00/reschedule']] as const) {
        const r = m === 'GET' ? await cust.get(path) : await cust.post(path, { data: { phone: '0811111111', date: '2026-10-20', startHour: 10 } });
        expectClientError(`${m} ${path}`, r.status(), await readJson(r), { status: 404, code: 'BOOKING_NOT_FOUND' });
      }
      const g = await cust.get('/api/split/tok%00');
      expectClientError('GET /api/split/tok%00', g.status(), await readJson(g), { status: 404, code: 'SPLIT_NOT_FOUND' });
      const p = await cust.post('/api/split/tok%00/1/paid', { data: {} });
      expectClientError('POST /api/split/tok%00/1/paid', p.status(), await readJson(p), { status: 404, code: 'SPLIT_NOT_FOUND' });
      const p2 = await cust.post('/api/split/tok/abc/paid', { data: {} });
      expectClientError('POST /api/split/tok/abc/paid', p2.status(), await readJson(p2), { status: 404, code: 'SPLIT_NOT_FOUND' });
    });
    await test.step('ค้นหาการจอง (owner) ด้วยไบต์ว่าง → 200 ไม่มีผลลัพธ์ ไม่ใช่ 500', async () => {
      for (const qs of ['code=%00', 'phone=%00']) {
        const r = await staff.get(`/api/owner/bookings?${qs}`);
        expect.soft(r.status(), `ค้นหา ${qs}: ห้าม 5xx`).toBe(200);
      }
    });
    await test.step('ไม่มีอะไรถูกเขียนลงฐาน', async () => {
      expect(snapshot(), `นับแถว ${SNAPSHOT_KEYS}`).toBe(before);
    });
  } finally { await staff.dispose(); await cust.dispose(); }
});

// K14 (KNOWN-ISSUES.md): เปอร์เซ็นต์เข้ารหัสเสียใน URL ถูกตัวจัดเส้นทางของ Next ตอบ 500 ข้อความล้วน "ก่อนถึงโค้ดเรา" — ไม่แก้ในโค้ดของเรา (ความเสี่ยงต่ำ ไม่มีอะไรถูกเขียน)
test.fixme('WT-04-K14 เปอร์เซ็นต์เสียใน URL (%E0%A4%A · %FF) → ควรเป็น 4xx แต่ Next ตอบ 500 ข้อความล้วนก่อนถึงโค้ดเรา (K14 · ยอมรับเป็นข้อจำกัด)', {
  tag: ['@WRONG-TYPE', '@K14'],
  annotation: ann({
    tc: 'WT-04-K14', level: 'P3', source: 'KNOWN-ISSUES.md K14 · ตัวจัดเส้นทางของ Next 16 (ไม่ใช่โค้ดเรา)',
    expected: 'POST /api/staff/bookings/{%E0%A4%A|%FF}/checkin (ล็อกอินแล้ว) → 4xx · วันนี้ 500 "Internal Server Error" ข้อความล้วน ไม่มีอะไรถูกเขียน',
  }),
}, async ({ playwright }) => {
  const staff = await playwright.request.newContext({ baseURL: BASE_URL });
  try {
    const login = await staff.post('/api/staff/login', { data: { username: SEED.staff.username, password: SEED.staff.password } });
    expect(login.status()).toBe(200);
    for (const code of ['%E0%A4%A', '%FF']) {
      const r = await staff.post(`/api/staff/bookings/${code}/checkin`);
      expect.soft(r.status(), `เช็กอิน ${code}`).toBeLessThan(500);
    }
  } finally { await staff.dispose(); }
});

// ---------------------------------------------------------------- WT-05 ออกจากระบบ
test('WT-05 ออกจากระบบ (ลูกค้าและร้าน): cookie ขยะ/ผิดชนิด/ของอีกฝั่ง/body ขยะ → 200 { ok: true } ล้าง cookie · ไม่เขียนรายการเพิกถอน (revoked_sessions) ใหม่ · ไม่ 500', {
  tag: ['@WRONG-TYPE', '@CR-01', '@P1'],
  annotation: ann({
    tc: 'WT-05', level: 'P1', source: `[D:CR-01] CHANGE-REQUESTS/answers/README.md หัวข้อ CR-01 (ออกจากระบบ = ยกเลิกเฉพาะ cookie ใบนั้นที่ฝั่งเซิร์ฟเวอร์) · ${SRC}`,
    expected: 'POST /api/customers/logout และ /api/staff/logout ด้วย: ไม่มี cookie · cookie = garbage · a.b.c · %FF · ยาว 4,000 ตัว · ว่าง · โทเคนของฝั่งตรงข้าม (ใช้ ln_staff ที่ถูกต้องใส่ช่อง ln_customer) · body เป็น array/ข้อความ → 200 {ok:true} + Set-Cookie ล้าง · revoked_sessions ไม่เพิ่ม · แล้วออกจากระบบด้วย cookie ถูกต้อง 1 ครั้ง → เพิ่มแถวเดียว (เทียบ: เทสต์ชุดนี้จับได้ถ้าทางที่ผิดเขียนแถวขยะ)',
  }),
}, async ({ playwright }) => {
  const staffLogin = await playwright.request.newContext({ baseURL: BASE_URL });
  let staffToken = '';
  try {
    const l = await staffLogin.post('/api/staff/login', { data: { username: SEED.staff.username, password: SEED.staff.password } });
    expect(l.status()).toBe(200);
    staffToken = (await staffLogin.storageState()).cookies.find((c) => c.name === 'ln_staff')?.value ?? '';
    expect(staffToken, 'ต้องได้ cookie ln_staff').not.toBe('');
  } finally { await staffLogin.dispose(); }

  const cookies: [string, string][] = [
    ['ไม่มี cookie', ''],
    ['cookie ขยะ', 'ln_customer=garbage; ln_staff=garbage'],
    ['รูป a.b.c และ %FF', 'ln_customer=a.b.c; ln_staff=%FF'],
    ['ยาว 4,000 ตัว', `ln_staff=${'x'.repeat(4000)}; ln_customer=${'y'.repeat(4000)}`],
    ['ค่าว่าง', 'ln_customer=; ln_staff='],
    ['โทเคนร้านใส่ช่องลูกค้า', `ln_customer=${staffToken}`],
  ];
  const anon = await playwright.request.newContext({ baseURL: BASE_URL });
  try {
    for (const path of ['/api/customers/logout', '/api/staff/logout']) {
      await test.step(`${path}: cookie/ body ขยะ ${cookies.length + 2} แบบ → 200 ok · ไม่เขียนแถวเพิกถอน`, async () => {
        const before = snapshot();
        for (const [label, ck] of cookies) {
          const r = await anon.post(path, { headers: { cookie: ck, 'content-type': 'application/json' }, data: '[1,2]' });
          const body = await readJson(r);
          expect.soft(r.status(), `${path} · ${label}: ห้าม 5xx`).toBe(200);
          expect.soft(body, `${path} · ${label}`).toEqual({ ok: true });
        }
        const t = await anon.post(path, { headers: { 'content-type': 'text/plain' }, data: 'not json' });
        expect.soft(t.status(), `${path} · body ไม่ใช่ JSON`).toBe(200);
        const [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9] = before.split(',').map(Number);
        const after = snapshot().split(',').map(Number);
        // ไม่มีแถวเพิกถอนเพิ่ม (แถวที่หมดอายุอาจถูกลบเอง จึงเทียบว่าไม่เพิ่ม) · ตารางอื่นเท่าเดิม
        expect.soft(after[7], `${path}: revoked_sessions ต้องไม่เพิ่ม`).toBeLessThanOrEqual(b7);
        expect.soft([after[0], after[1], after[2], after[3], after[4], after[5], after[6], after[8], after[9]], `${path}: ตารางอื่นเท่าเดิม`).toEqual([b0, b1, b2, b3, b4, b5, b6, b8, b9]);
      });
    }
  } finally { await anon.dispose(); }

  await test.step('เทียบ: ออกจากระบบร้านด้วย cookie ที่ถูกต้อง → เพิ่มแถวเพิกถอน 1 แถว (เทสต์จับของจริงได้)', async () => {
    const before = Number(sql('select count(*) from revoked_sessions'));
    const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
    try {
      const l = await ctx.post('/api/staff/login', { data: { username: SEED.staff.username, password: SEED.staff.password } });
      expect(l.status()).toBe(200);
      const r = await ctx.post('/api/staff/logout');
      expect(r.status()).toBe(200);
    } finally { await ctx.dispose(); }
    expect(Number(sql('select count(*) from revoked_sessions')), 'revoked_sessions เพิ่ม 1').toBe(before + 1);
  });
});
