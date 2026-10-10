import { test, expect, open, uniquePhone, createBooking, payBooking, postJson } from './fixtures';

test.describe('MOB', () => {
  test('TC-MOB-01 มือถือกว้าง 375 px ไม่มีแถบเลื่อนแนวนอนทุกหน้าฝั่งลูกค้า', {
    tag: ['@MOB', '@P2'],
    annotation: { type: 'expected', description: 'viewport 375×812: /, /book, /book/new, /fields, /challenges, /my, /series, /pay/{code}, /booking/{code}, /split/{token} → scrollWidth ≤ clientWidth' },
  }, async ({ page, pick, b }) => {
    const hour = pick([10, 11, 12] as const);
    await page.setViewportSize({ width: 375, height: 812 });
    let code = '';
    let token = '';
    await test.step(`สร้างการจอง A จ. 12 ต.ค. ${hour}:00`, async () => {
      code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-12', startHour: hour, phone: uniquePhone(b), name: 'ทีมมือถือ' })).code;
    });
    const overflow: Record<string, string> = {};
    const check = async (path: string) => {
      await test.step(`เปิด ${path} ที่ 375 px`, async () => {
        await open(page, path);
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        if (m.sw > m.cw) overflow[path] = `scrollWidth ${m.sw} > ${m.cw}`;
      });
    };
    for (const p of ['/', '/book', '/book/new?field=A&date=2026-10-12&start=13', '/fields', '/challenges', '/my', '/series', `/pay/${code}`]) await check(p);
    await test.step('จ่ายและสร้างลิงก์หาร (เตรียมหน้า /booking และ /split)', async () => {
      await payBooking(page.request, code);
      const r = await postJson(page.request, `/api/bookings/${code}/split`, { count: 4 });
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
      token = r.body.token;
    });
    await check(`/booking/${code}`);
    await check(`/split/${token}`);
    expect(overflow, 'หน้าที่มีแถบเลื่อนแนวนอนที่ 375 px').toEqual({});
  });
});
