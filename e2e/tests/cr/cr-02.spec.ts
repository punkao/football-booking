import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, open, uniquePhone, payBooking, getJson, postJson, registerCustomer, staffLoginPage } from '../fixtures';
import { ann, sql, sqlNum } from '../v2-helpers';

/**
 * CR-02 แก้ 5 จุดให้ตรงกับที่ร้านตอบไว้ (docs/handover/CHANGE-REQUESTS/CR-02.md · impact docs/impact/CR-02.md)
 *
 * ค่าที่คาดหวังมาจากคำตอบร้าน docs/handover/CHANGE-REQUESTS/answers/README.md หัวข้อ CR-02 = [D:CR-02] (+ A-43..A-46 ใน docs/01-INTERVIEW.md)
 * - (1) เช็กอินได้ทุกเวลาของวันเตะ (เวลาไทย) · วันอื่นปฏิเสธพร้อมข้อความว่าเช็กอินได้เฉพาะวันเตะ · ชั่วโมงสะสมนับตอนเช็กอิน
 * - (2) "ใครกด" = ชื่อที่แสดงของพนักงาน · ลูกค้า/ระบบเหมือนเดิม · ประวัติเก่าก็แสดงชื่อ (ห้ามแก้แถวประวัติเดิม)
 * - (3) ขั้น "จบ" เมื่อเช็กอินแล้วและเลยเวลาจบรอบ · เวลา = เวลาจบรอบ · ไม่มีสถานะใหม่ · ไม่มา/ยกเลิกไม่มี "จบ"
 * - (4) 30 พ.ย. → 28 ก.พ. ได้ · 30 พ.ย. → 1 มี.ค. ไม่ได้ · 1 ต.ค. → 31 ธ.ค. ได้ (เหมือนเดิม)
 * - (5) ค้นการจองโดยไม่กรอกรหัสหรือไม่กรอกเบอร์ → บอกให้กรอกให้ครบ (ไม่ใช่ข้อผิดพลาดระบบ)
 * ข้อที่ร้านยังไม่ตอบใช้สมมติฐานใน impact ข้อ 1.2 (ติดป้าย [สมมติฐาน Qn])
 *
 * ไม่ reset / ไม่เลื่อนเวลา (รันพร้อม 3 เบราว์เซอร์) · วันนี้ = ศ 9 ต.ค. 2569 10:00 · ข้อมูลใหม่ใช้ uniquePhone(b) + หาช่องว่างจริงก่อนจอง
 * ห้ามจองวันนี้ในไฟล์นี้ (TC-STAFF-05 / แชทนับการจองของวันนี้) → ข้อที่ต้องเช็กอินในวันเตะ / เลื่อนเวลา อยู่ใน cr-02.serial.spec.ts
 * seed ใช้แบบอ่านอย่างเดียว
 */

const ANSWER = 'docs/handover/CHANGE-REQUESTS/answers/README.md หัวข้อ CR-02';
const SYS = 'เกิดข้อผิดพลาดในระบบ';
const NOT_PLAY_DAY = 'เช็กอินได้เฉพาะวันเตะ'; // [D:CR-02] ข้อ 1 "ข้อความบอกว่าเช็กอินได้เฉพาะวันเตะ"

type Slot = { fieldId: string; hour: number; status: string };

/** จองช่องที่ยังว่างจริงในวันนั้น (สุ่มช่อง · ลองใหม่ถ้าชนกับเบราว์เซอร์อื่น) แล้วคืนการจอง */
async function bookFree(req: APIRequestContext, o: { date: string; phone: string; name: string; fields?: string[]; hours?: number[] }) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const av = await getJson(req, `/api/availability?date=${o.date}`);
    const free: Slot[] = (av.body?.slots ?? []).filter((s: Slot) => s.status === 'free' && (!o.fields || o.fields.includes(s.fieldId)) && (!o.hours || o.hours.includes(s.hour)));
    expect(free.length, `${o.date} ต้องมีช่องว่าง`).toBeGreaterThan(0);
    const s = free[Math.floor(Math.random() * free.length)];
    const r = await postJson(req, '/api/bookings', { fieldId: s.fieldId, date: o.date, startHour: s.hour, hours: 1, name: o.name, phone: o.phone, consent: true });
    if (r.status === 201) return r.body.booking as { code: string; fieldId: string; startHour: number; date: string };
    expect(r.status, `จอง ${s.fieldId} ${o.date} ${s.hour}:00 → ${JSON.stringify(r.body)}`).toBe(409);
  }
  throw new Error(`หาช่องว่าง ${o.date} ไม่ได้`);
}

/** ขั้นของ timeline ฝั่งลูกค้า */
const steps = (page: Page) =>
  page.locator('[data-testid^="timeline-step-"]').evaluateAll((es) =>
    es.map((e) => ({ status: e.getAttribute('data-status') ?? '', current: e.getAttribute('aria-current') ?? '', text: (e.textContent ?? '').replace(/\s+/g, ' ').trim() })),
  );

test.describe('CR-02 แก้ 5 จุดให้ตรงกับที่ร้านตอบไว้', () => {
  // ---------------------------------------------------------------- (1) เช็กอิน
  test('CR-02-01 พนักงานกดเช็กอินการจองที่ยังไม่ถึงวันเตะ → ปฏิเสธพร้อมบอกว่าเช็กอินได้เฉพาะวันเตะ · ชั่วโมงสะสมไม่ขึ้น', {
    tag: ['@CR-02', '@P2'],
    annotation: ann({
      tc: 'CR-02-01', level: 'P2', source: `[D:CR-02] ${ANSWER} ข้อ 1 · [D A-45] · docs/handover/CHANGE-REQUESTS/CR-02.md ข้อ 1 · TC-STAFF-06 · [สมมติฐาน Q4] ปุ่มยังกดได้ + บอกเหตุผลใต้ปุ่ม`,
      expected: 'วันนี้ 9 ต.ค. · สมาชิกใหม่จองสนาม C วันเตะ พ 21 ต.ค. (12:00–20:00 ช่องที่ว่าง) จ่ายแล้ว · /staff ก่อนกด: staff-checkin-hint data-value CHECKIN_NOT_PLAY_DAY "เช็กอินได้เฉพาะวันเตะ" · กด → error-message "เช็กอินได้เฉพาะวันเตะ" · สถานะ CONFIRMED · API 409 CHECKIN_NOT_PLAY_DAY · /my paid-hours 0 · [E sql] ไม่มีเงินหน้าสนาม ไม่มี checked_in_at',
    }),
  }, async ({ page, b, staffApi }) => {
    // สนาม C 21 ต.ค. ไม่มีเทสต์เดิมจองตายตัว (TC-API-03 ใช้แค่ quote 09:00 / 23:00 → เว้นไว้) · ห้ามจองวันนี้ (TC-STAFF-05 นับการจองวันนี้)
    const date = '2026-10-21';
    const phone = uniquePhone(b);
    let code = '';
    await test.step(`สมาชิกใหม่จองวันที่ ${date} (ยังไม่ถึงวันเตะ) แล้วจ่าย`, async () => {
      await registerCustomer(page.request, { name: 'สมาชิกมาก่อนวัน CR-02', phone });
      code = (await bookFree(page.request, { date, phone, name: 'สมาชิกมาก่อนวัน CR-02', fields: ['C'], hours: [12, 13, 14, 15, 16, 17, 18, 19, 20] })).code;
      await payBooking(page.request, code);
    });
    await test.step('พนักงานเปิดการจองนี้ → ใต้ปุ่มเช็กอินบอกเหตุผลก่อนกด (ปุ่มยังกดได้)', async () => {
      await staffLoginPage(page, 'staff');
      await open(page, `/staff?code=${code}`);
      await expect(page.getByTestId('staff-booking-code')).toHaveText(code);
      await expect(page.getByTestId('staff-checkin')).toBeEnabled();
      await expect.soft(page.getByTestId('staff-checkin-hint')).toHaveAttribute('data-value', 'CHECKIN_NOT_PLAY_DAY');
      await expect.soft(page.getByTestId('staff-checkin-hint')).toContainText(NOT_PLAY_DAY);
    });
    await test.step('กด "เก็บเงินแล้ว / เช็กอิน" → ข้อความเช็กอินได้เฉพาะวันเตะ · สถานะยังยืนยันแล้ว', async () => {
      await page.getByTestId('staff-checkin').click();
      await expect(page.getByTestId('error-message')).toBeVisible();
      await expect.soft(page.getByTestId('error-message')).toContainText(NOT_PLAY_DAY);
      await expect.soft(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
    });
    await test.step('ยิง API เช็กอินตรง ๆ ก็ถูกปฏิเสธ (409 CHECKIN_NOT_PLAY_DAY)', async () => {
      const r = await postJson(await staffApi('staff'), `/api/staff/bookings/${code}/checkin`, {});
      expect.soft(r.status, JSON.stringify(r.body)).toBe(409);
      expect.soft(r.body?.error?.code).toBe('CHECKIN_NOT_PLAY_DAY');
      expect.soft(String(r.body?.error?.message ?? '')).toContain(NOT_PLAY_DAY);
    });
    await test.step('ลูกค้าเปิด /my → ชั่วโมงสะสมยัง 0 · ฐานข้อมูลไม่มีการเก็บเงินหน้าสนาม', async () => {
      await open(page, '/my');
      await expect.soft(page.getByTestId('paid-hours')).toHaveAttribute('data-value', '0');
      expect.soft(sql(`select status || '|' || coalesce(checked_in_at::text, '-') from bookings where code='${code}'`), '[E sql] สถานะ|checked_in_at').toBe('CONFIRMED|-');
      expect.soft(sqlNum(`select count(*) from payments p join bookings b on b.id=p.booking_id where b.code='${code}' and p.method='CASH_AT_FIELD'`), '[E sql] เงินหน้าสนาม').toBe(0);
    });
  });

  // ---------------------------------------------------------------- (2) ประวัติ "ใครกด"
  test('CR-02-03 ประวัติสถานะ ช่อง "ใครกด" แสดงชื่อพนักงาน (รวมประวัติเก่า) · ค่าที่บันทึกในฐานข้อมูลไม่ถูกแก้', {
    tag: ['@CR-02', '@P2'],
    annotation: ann({
      tc: 'CR-02-03', level: 'P2', source: `[D:CR-02] ${ANSWER} ข้อ 2 · [D A-44] · BR-42 · TC-DATA-01 · seed LN-900008 / LN-900005 (staff = น้องบอล)`,
      expected: 'owner /owner/bookings/LN-900008 ผู้ทำ: ลูกค้า, ลูกค้า, น้องบอล (history-actor-2 data-value ยัง "staff") · LN-900005 แถวเช็กอิน = น้องบอล · ภาษาอังกฤษ: Customer, Customer, น้องบอล · [E sql] booking_status_history.actor LN-900008 = CUSTOMER, CUSTOMER, staff (ไม่ถูกแก้)',
    }),
  }, async ({ page }) => {
    const actors = async (code: string) => {
      await open(page, `/owner/bookings/${code}`);
      const n = Number(await page.getByTestId('history-table').getAttribute('data-count'));
      const out: { text: string; value: string }[] = [];
      for (let i = 0; i < n; i++) {
        const c = page.getByTestId(`history-actor-${i}`);
        out.push({ text: (await c.innerText()).trim(), value: (await c.getAttribute('data-value')) ?? '' });
      }
      return out;
    };
    await test.step('owner เปิดประวัติ LN-900008 (ประวัติเก่าจาก seed) → ลูกค้า, ลูกค้า, น้องบอล', async () => {
      await staffLoginPage(page, 'owner');
      const a = await actors('LN-900008');
      expect.soft(a.map((x) => x.text), 'ผู้ทำที่แสดง').toEqual(['ลูกค้า', 'ลูกค้า', 'น้องบอล']);
      expect.soft(a.map((x) => x.value), 'ค่าที่บันทึก (data-value) ไม่เปลี่ยน').toEqual(['CUSTOMER', 'CUSTOMER', 'staff']);
    });
    await test.step('LN-900005 แถวเช็กอินของพนักงาน → น้องบอล', async () => {
      const a = await actors('LN-900005');
      expect.soft(a.map((x) => x.text)).toEqual(['ลูกค้า', 'ลูกค้า', 'น้องบอล']);
    });
    await test.step('หน้าเว็บภาษาอังกฤษ → Customer, Customer, น้องบอล (ชื่อพนักงานมีชื่อเดียว)', async () => {
      await page.context().addCookies([{ name: 'lang', value: 'en', url: new URL('/', page.url()).toString() }]);
      const a = await actors('LN-900008');
      expect.soft(a.map((x) => x.text)).toEqual(['Customer', 'Customer', 'น้องบอล']);
      await page.context().addCookies([{ name: 'lang', value: 'th', url: new URL('/', page.url()).toString() }]);
    });
    await test.step('[E sql] แถวประวัติเดิมในฐานข้อมูลยังเป็น username (ไม่ถูกแก้ย้อนหลัง)', async () => {
      expect(sql(`select string_agg(h.actor, ',' order by h.created_at, h.id) from booking_status_history h join bookings b on b.id=h.booking_id where b.code='LN-900008'`)).toBe('CUSTOMER,CUSTOMER,staff');
    });
  });

  // ---------------------------------------------------------------- (3) ขั้น "จบ"
  test('CR-02-04 การจองที่เช็กอินแล้วและเลยเวลาจบรอบ → ขั้นสุดท้ายคือ "จบ" เวลา = เวลาจบรอบ · ไม่มีสถานะใหม่', {
    tag: ['@CR-02', '@P3'],
    annotation: ann({
      tc: 'CR-02-04', level: 'P3', source: `[D:CR-02] ${ANSWER} ข้อ 3 · [D A-43] · US-49 · TC-TRACK-01 · seed LN-900005 (CHECKED_IN ส 3 ต.ค. 18–20) · LN-900006 (CHECKED_IN อ 6 ต.ค. 19–20)`,
      expected: '/booking/LN-900005 (วันนี้ 9 ต.ค.) → 4 ขั้น: PENDING_PAYMENT, CONFIRMED, CHECKED_IN, "จบ" · ขั้น "จบ" aria-current=step เวลา "3 ต.ค. 2026 20:00" · booking-status ยัง CHECKED_IN · LN-900006 ขั้นสุดท้าย "จบ" เวลา "6 ต.ค. 2026 20:00" · [E sql] แถวประวัติยัง 3 แถว / สถานะ CHECKED_IN',
    }),
  }, async ({ page }) => {
    for (const [code, end] of [['LN-900005', '3 ต.ค. 2026 20:00'], ['LN-900006', '6 ต.ค. 2026 20:00']] as const) {
      await test.step(`ปลดล็อก ${code} ด้วยรหัส + เบอร์ (ทีมเก่า) แล้วเปิดหน้า → ขั้นสุดท้าย "จบ" เวลา ${end}`, async () => {
        const r = await page.request.get(`/api/bookings/${code}?phone=0877777777`);
        expect(r.status()).toBe(200);
        await open(page, `/booking/${code}`);
        const st = await steps(page);
        expect.soft(st.length, `ขั้นทั้งหมด ${JSON.stringify(st)}`).toBe(4);
        expect.soft(st.slice(0, 3).map((x) => x.status), 'ขั้นจากประวัติจริงไม่เปลี่ยน').toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN']);
        expect.soft(st[st.length - 1]?.text ?? '', 'ขั้นสุดท้ายคือ "จบ"').toMatch(/จบ/);
        expect.soft(st[st.length - 1]?.current, 'ขั้น "จบ" เป็นขั้นปัจจุบัน').toBe('step');
        await expect.soft(page.getByTestId(`timeline-time-${Math.max(0, st.length - 1)}`)).toContainText(end);
        await expect.soft(page.getByTestId('booking-status'), 'ไม่มีสถานะใหม่').toHaveAttribute('data-value', 'CHECKED_IN');
      });
    }
    await test.step('[E sql] ไม่มีแถวประวัติ / สถานะใหม่ในฐานข้อมูล', async () => {
      expect.soft(sqlNum(`select count(*) from booking_status_history h join bookings b on b.id=h.booking_id where b.code='LN-900005'`)).toBe(3);
      expect.soft(sql(`select status from bookings where code='LN-900005'`)).toBe('CHECKED_IN');
    });
  });

  test('CR-02-05 การจองที่ไม่มา ไม่มีขั้น "จบ" (แม้เลยเวลาแล้ว)', {
    tag: ['@CR-02', '@P3'],
    annotation: ann({
      tc: 'CR-02-05', level: 'P3', source: `[D:CR-02] ${ANSWER} ข้อ 3 "การจองที่ไม่มา/ยกเลิกไม่มีขั้น จบ" · seed LN-900003 (โจ้ NO_SHOW อา 4 ต.ค. 19–20)`,
      expected: '/booking/LN-900003 → ขั้นสุดท้าย NO_SHOW (aria-current) ไม่มีคำว่า "จบ" (รั้วกันแก้เกิน: ผ่านทั้งก่อนและหลังแก้)',
    }),
  }, async ({ page }) => {
    const r = await page.request.get('/api/bookings/LN-900003?phone=0833333333');
    expect(r.status()).toBe(200);
    await open(page, '/booking/LN-900003');
    const st = await steps(page);
    expect.soft(st[st.length - 1]?.status, JSON.stringify(st)).toBe('NO_SHOW');
    expect.soft(st.map((x) => x.text).join(' | ')).not.toMatch(/จบ/);
  });

  // ---------------------------------------------------------------- (4) ช่วงรายงาน
  test('CR-02-06 รายงาน 30 พ.ย. 2569 → 28 ก.พ. 2570 ดูได้และดาวน์โหลด CSV ได้ · 30 พ.ย. → 1 มี.ค. ไม่ได้ · 1 ต.ค. → 31 ธ.ค. ได้เหมือนเดิม', {
    tag: ['@CR-02', '@P2'],
    annotation: ann({
      tc: 'CR-02-06', level: 'P2', source: `[D:CR-02] ${ANSWER} ข้อ 4 · [D A-46] · BR-39 · TEST-DATA E140/E141 · TC-REPORT-01 · [สมมติฐาน Q11] 1 ต.ค. → 1 ม.ค. ยังไม่ได้ · [สมมติฐาน Q12] CSV กติกาเดียวกัน`,
      expected: 'owner หน้า /owner/reports 30 พ.ย. → 28 ก.พ. → report-table data-count 91 ไม่มี report-error · API 200 days 91 · CSV 200 · 31 ส.ค. → 30 พ.ย. 200 (เดือนปลายทางไม่มีวันที่ 31) · 30 พ.ย. → 1 มี.ค. 400 REPORT_RANGE_TOO_LONG "ดูรายงานได้ครั้งละไม่เกิน 3 เดือน" · 1 ต.ค. → 31 ธ.ค. 200 days 92 · 1 ต.ค. → 1 ม.ค. 400',
    }),
  }, async ({ page, staffApi }) => {
    await test.step('เจ้าของเลือก 30 พ.ย. 2569 ถึง 28 ก.พ. 2570 ในหน้ารายงาน → แสดง 91 วัน', async () => {
      await staffLoginPage(page, 'owner');
      await open(page, '/owner/reports');
      await page.getByTestId('report-from').fill('2026-11-30');
      await page.getByTestId('report-to').fill('2027-02-28');
      await page.getByTestId('report-submit').click();
      await expect(page.getByTestId('report-table').or(page.getByTestId('report-error')).first()).toBeVisible();
      const err = (await page.getByTestId('report-error').count()) ? (await page.getByTestId('report-error').innerText()).trim() : '';
      expect.soft(err, 'ต้องไม่มี error').toBe('');
      await expect.soft(page.getByTestId('report-table')).toHaveAttribute('data-count', '91');
    });
    const o = await staffApi('owner');
    const cases: [string, string, number, string | number][] = [
      ['2026-11-30', '2027-02-28', 200, 91],
      ['2026-08-31', '2026-11-30', 200, 92],
      ['2026-11-30', '2027-03-01', 400, 'REPORT_RANGE_TOO_LONG'],
      ['2026-10-01', '2026-12-31', 200, 92],
      ['2026-10-01', '2027-01-01', 400, 'REPORT_RANGE_TOO_LONG'],
    ];
    for (const [from, to, status, want] of cases) {
      await test.step(`API ${from} → ${to} → ${status} ${want}`, async () => {
        const r = await getJson(o, `/api/owner/reports?from=${from}&to=${to}`);
        expect.soft(r.status, JSON.stringify(r.body?.error ?? {})).toBe(status);
        if (status === 200) expect.soft((r.body?.days ?? []).length, 'จำนวนวัน').toBe(want);
        else {
          expect.soft(r.body?.error?.code).toBe(want);
          expect.soft(r.body?.error?.message).toBe('ดูรายงานได้ครั้งละไม่เกิน 3 เดือน');
        }
      });
    }
    await test.step('ดาวน์โหลด CSV 30 พ.ย. → 28 ก.พ. ได้ (กติกาเดียวกับหน้าเว็บ)', async () => {
      const r = await o.get('/api/owner/reports.csv?from=2026-11-30&to=2027-02-28');
      expect.soft(r.status()).toBe(200);
    });
  });

  // ---------------------------------------------------------------- (5) ค้นการจอง
  test('CR-02-07 ลูกค้ากดค้นการจองโดยไม่กรอกรหัสหรือไม่กรอกเบอร์ → บอกให้กรอกให้ครบ (ไม่ใช่ข้อผิดพลาดระบบ)', {
    tag: ['@CR-02', '@P3'],
    annotation: ann({
      tc: 'CR-02-07', level: 'P3', source: `[D:CR-02] ${ANSWER} ข้อ 5 · docs/handover/CHANGE-REQUESTS/CR-02.md ข้อ 5 · TC-BOOK-11 · [สมมติฐาน Q13] ข้อความเดียวใน error-message · [สมมติฐาน Q15] เว้นวรรค = ไม่กรอก`,
      expected: '/my กด lookup-submit: (ก) ว่างทั้งคู่ (ข) รหัส LN-900004 อย่างเดียว (ค) เบอร์อย่างเดียว (ง) เว้นวรรคทั้งคู่ → error-message มี "กรอก" และ "ครบ" ไม่มี "เกิดข้อผิดพลาดในระบบ" ไม่ไปหน้า /booking และไม่มีคำขอ /api/bookings · ภาษาอังกฤษ → "Please enter both …"',
    }),
  }, async ({ page }) => {
    const lookups: string[] = [];
    page.on('request', (r) => { if (/\/api\/bookings(\/|\?|$)/.test(new URL(r.url()).pathname + new URL(r.url()).search)) lookups.push(r.url()); });
    const cases: [string, string, string][] = [
      ['ไม่กรอกอะไรเลย', '', ''],
      ['กรอกแค่รหัส LN-900004', 'LN-900004', ''],
      ['กรอกแค่เบอร์', '', '0844444444'],
      ['พิมพ์แต่เว้นวรรค', '   ', '   '],
    ];
    for (const [name, code, phone] of cases) {
      await test.step(`${name} แล้วกดค้น → บอกให้กรอกให้ครบ`, async () => {
        await open(page, '/my');
        lookups.length = 0;
        if (code) await page.getByTestId('lookup-code').fill(code);
        if (phone) await page.getByTestId('lookup-phone').fill(phone);
        await page.getByTestId('lookup-submit').click();
        const msg = page.getByTestId('error-message');
        await expect(msg).toBeVisible();
        const t = (await msg.innerText()).trim();
        expect.soft(t, 'ไม่ใช่ error ระบบ').not.toContain(SYS);
        expect.soft(t, 'บอกให้กรอกให้ครบ').toMatch(/กรอก.*ครบ/);
        await expect.soft(page).not.toHaveURL(/\/booking\//);
        expect.soft(lookups, 'ไม่ต้องส่งคำขอค้นไป server').toEqual([]);
      });
    }
    await test.step('หน้าเว็บภาษาอังกฤษ ไม่กรอกอะไร → Please enter both …', async () => {
      await open(page, '/my');
      await page.getByTestId('lang-en').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await page.getByTestId('lookup-submit').click();
      await expect(page.getByTestId('error-message')).toBeVisible();
      await expect.soft(page.getByTestId('error-message')).toContainText(/please enter both/i);
      await page.getByTestId('lang-th').click();
    });
  });
});
