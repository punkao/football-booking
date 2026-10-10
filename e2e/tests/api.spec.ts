import { test, expect, getJson, postJson, open, uniquePhone } from './fixtures';
import { SEED } from './constants';

test.describe('API', () => {
  test('TC-API-01 health check และข้อมูลสนาม', {
    tag: ['@API', '@P2'],
    annotation: { type: 'expected', description: 'GET /api/health → 200 {"ok":true,"db":true} · GET /api/fields → 3 สนาม A/B 800/1,200 C 1,200/1,800' },
  }, async ({ request }) => {
    await test.step('GET /api/health', async () => {
      const r = await getJson(request, '/api/health');
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true, db: true });
    });
    await test.step('GET /api/fields', async () => {
      const r = await getJson(request, '/api/fields');
      expect(r.status).toBe(200);
      const byId = Object.fromEntries((r.body.fields as any[]).map((f) => [f.id, f]));
      expect(Object.keys(byId).sort()).toEqual(['A', 'B', 'C']);
      expect(byId.A).toMatchObject({ size: 5, covered: false, dayRate: 800, eveningRate: 1200 });
      expect(byId.B).toMatchObject({ size: 5, covered: false, dayRate: 800, eveningRate: 1200 });
      expect(byId.C).toMatchObject({ size: 7, covered: true, dayRate: 1200, eveningRate: 1800 });
    });
  });

  test('TC-API-02 ไม่เข้าสู่ระบบ/บทบาทไม่พอ เรียก API และหน้าร้าน → ถูกปฏิเสธ', {
    tag: ['@API', '@P2'],
    annotation: { type: 'expected', description: 'ไม่มี cookie: /api/staff/bookings/LN-900001, /api/staff/today, POST /api/owner/holidays, POST checkin → 401 UNAUTHORIZED "กรุณาเข้าสู่ระบบ" · STAFF GET /api/staff/today → 403 FORBIDDEN_ROLE · MANAGER POST /api/owner/closures → 403 · เปิด /staff/today → /staff/login?next=%2Fstaff%2Ftoday + login-required' },
  }, async ({ page, anonApi, staffApi }) => {
    const anon = await anonApi();
    await test.step('ไม่เข้าสู่ระบบเรียก API หน้าร้าน 4 เส้น → 401', async () => {
      const calls = [
        await getJson(anon, '/api/staff/bookings/LN-900001'),
        await getJson(anon, '/api/staff/today'),
        await postJson(anon, '/api/owner/holidays', { date: '2026-11-20', name: 'ทดสอบ' }),
        await postJson(anon, '/api/staff/bookings/LN-900004/checkin', {}),
      ];
      for (const c of calls) {
        expect(c.status).toBe(401);
        expect(c.body?.error?.code).toBe('UNAUTHORIZED');
        expect(c.body?.error?.message).toBe('กรุณาเข้าสู่ระบบ');
      }
    });
    await test.step('STAFF เรียกภาพรวมวันนี้ → 403 FORBIDDEN_ROLE', async () => {
      const st = await staffApi('staff');
      const r = await getJson(st, '/api/staff/today');
      expect(r.status).toBe(403);
      expect(r.body?.error?.code).toBe('FORBIDDEN_ROLE');
      expect(r.body?.error?.message).toBe('บทบาทของคุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
    });
    await test.step('MANAGER สั่งปิดสนาม (เฉพาะ OWNER) → 403 FORBIDDEN_ROLE', async () => {
      const mg = await staffApi('manager');
      const r = await postJson(mg, '/api/owner/closures', { fieldId: 'A', date: '2026-11-20', fromHour: 8, toHour: 9 });
      expect(r.status).toBe(403);
      expect(r.body?.error?.code).toBe('FORBIDDEN_ROLE');
    });
    await test.step('ไม่เข้าสู่ระบบเปิด /staff/today → ถูกส่งไปหน้าเข้าสู่ระบบร้าน', async () => {
      await open(page, '/staff/today');
      await expect(page).toHaveURL(/\/staff\/login\?next=%2Fstaff%2Ftoday$/);
      await expect(page.getByTestId('login-required')).toBeVisible();
      await expect(page.getByTestId('today-grid')).toHaveCount(0);
    });
  });

  test('TC-API-03 ตรวจค่าที่ส่งเข้า API จอง (เวลาเริ่ม/จำนวนชั่วโมง/สนาม/วันที่)', {
    tag: ['@API', '@P1'],
    annotation: { type: 'expected', description: 'startHour 7/8.5/24 → 400 INVALID_START_HOUR · 23 → 200 · hours 0/1.5 → 400 INVALID_HOURS · สนาม D → INVALID_FIELD · 2026-10-08 → PAST_DATE · รูปแบบ {error:{code,message}}' },
  }, async ({ request }) => {
    // ใช้ C พ. 21 ต.ค. ซึ่งไม่มี test ไหนจอง (เดิมใช้ A 22 ต.ค. ชนกับ TC-BOOK-03 ที่จอง A 20–24)
    const q = (o: Record<string, unknown>) => postJson(request, '/api/quote', { fieldId: 'C', date: '2026-10-21', startHour: 9, hours: 1, ...o });
    await test.step('startHour 7 (= 08:00 − 1 ชม.), 8.5 (= 08:30), 24 → INVALID_START_HOUR', async () => {
      for (const h of [7, 8.5, 24]) {
        const r = await q({ startHour: h });
        expect(r.status, `startHour ${h}`).toBe(400);
        expect(r.body?.error?.code, `startHour ${h}`).toBe('INVALID_START_HOUR');
        expect(r.body?.error?.message).toBe('เวลาเริ่มต้องตรงชั่วโมง ระหว่าง 08:00 ถึง 23:00');
      }
    });
    await test.step('startHour 23 (รอบสุดท้าย) → 200', async () => {
      const r = await q({ startHour: 23 });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body?.quote?.fieldPrice).toBe(1800);
    });
    await test.step('hours 0 (= 1 − 1) และ 1.5 → INVALID_HOURS', async () => {
      for (const h of [0, 1.5]) {
        const r = await q({ hours: h });
        expect(r.status, `hours ${h}`).toBe(400);
        expect(r.body?.error?.code, `hours ${h}`).toBe('INVALID_HOURS');
        expect(r.body?.error?.message).toBe('จำนวนชั่วโมงต้องเป็นจำนวนเต็มอย่างน้อย 1 ชั่วโมง');
      }
    });
    await test.step('สนาม D → INVALID_FIELD · วันที่ผ่านมา → PAST_DATE', async () => {
      const f = await q({ fieldId: 'D' });
      expect(f.status).toBe(400);
      expect(f.body?.error?.code).toBe('INVALID_FIELD');
      const d = await q({ date: '2026-10-08' });
      expect(d.status).toBe(400);
      expect(d.body?.error?.code).toBe('PAST_DATE');
      expect(d.body?.error?.message).toBe('ไม่สามารถจองวันที่ผ่านมาแล้ว');
    });
  });

  test('TC-API-04 จองช่วงเดียวกันพร้อมกัน 2 คำขอ → สำเร็จ 1 รายการพอดี', {
    tag: ['@API', '@P1'],
    annotation: { type: 'expected', description: 'ส่ง POST /api/bookings ช่วงเดียวกันพร้อมกัน 2 คำขอ → 201 จำนวน 1 และ 409 SLOT_TAKEN "ช่วงเวลานี้ถูกจองแล้ว" จำนวน 1 · availability ช่วงนั้น booked' },
  }, async ({ anonApi, pick, b }) => {
    const hour = pick([20, 21, 22] as const);
    const date = '2026-10-17';
    const [c1, c2] = [await anonApi(), await anonApi()];
    const body = (phone: string, name: string) => ({ fieldId: 'C', date, startHour: hour, hours: 1, name, phone, consent: true });
    const results = await test.step(`ส่งจอง C ${date} ${hour}:00 พร้อมกัน 2 คำขอ (คนละเบอร์)`, async () => {
      return Promise.all([
        postJson(c1, '/api/bookings', body(uniquePhone(b), 'ทีมพร้อมกัน 1')),
        postJson(c2, '/api/bookings', body(uniquePhone(b), 'ทีมพร้อมกัน 2')),
      ]);
    });
    await test.step('สำเร็จ 1 ไม่สำเร็จ 1 (SLOT_TAKEN)', async () => {
      const statuses = results.map((r) => r.status).sort();
      expect(statuses, JSON.stringify(results.map((r) => r.body))).toEqual([201, 409]);
      const loser = results.find((r) => r.status === 409)!;
      expect(loser.body?.error?.code).toBe('SLOT_TAKEN');
      expect(loser.body?.error?.message).toBe('ช่วงเวลานี้ถูกจองแล้ว');
    });
    await test.step('ตารางว่างแสดงช่วงนั้นเป็น booked', async () => {
      const r = await getJson(c1, `/api/availability?date=${date}`);
      const slot = (r.body.slots as any[]).find((s) => s.fieldId === 'C' && s.hour === hour);
      expect(slot.status).toBe('booked');
    });
  });
});

void SEED;
