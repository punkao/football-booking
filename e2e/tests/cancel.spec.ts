import { test, expect, open, uniquePhone, createBooking, payBooking, getBooking, getJson, postJson, registerCustomer, expectError, expectSuccess } from './fixtures';

/** ข้อความคำต่อคำจาก SPEC ข้อ 4 */
const MSG_MATCHED = 'มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้';

test.describe('CANCEL', () => {
  test('TC-CANCEL-03 เลื่อนวัน/เวลา: แพงขึ้นจ่ายส่วนต่าง ถูกลงคืนเครดิต และเลื่อนได้ 1 ครั้ง', {
    tag: ['@CANCEL', '@P1'],
    annotation: { type: 'expected', description: 'A 09:00 (฿800) → A 17:00 (฿1,200): "เลื่อนการจองแล้ว จ่ายส่วนต่าง ฿400 เรียบร้อย" ยอดรวม 1,200 · เลื่อนครั้งที่ 2 → "เลื่อนได้ 1 ครั้งต่อการจอง" · B 17:00 → B 09:00: "เลื่อนการจองแล้ว ได้รับส่วนต่างเป็นเครดิต ฿400" ยอดรวม 800' },
  }, async ({ page, pick, b }) => {
    const [aFrom, aTo, again, bFrom, bTo] = pick([[9, 17, 14, 17, 9], [10, 18, 15, 18, 10], [11, 22, 16, 22, 11]] as const);
    const date = '2026-10-21';
    const phone = uniquePhone(b);
    let codeA = '';
    let codeB = '';
    await test.step(`สร้างและจ่ายการจอง A ${aFrom}:00 และ B ${bFrom}:00 (พ. 21 ต.ค.)`, async () => {
      codeA = (await createBooking(page.request, { fieldId: 'A', date, startHour: aFrom, phone, name: 'ทีมเลื่อน' })).code;
      await payBooking(page.request, codeA);
      codeB = (await createBooking(page.request, { fieldId: 'B', date, startHour: bFrom, phone, name: 'ทีมเลื่อน' })).code;
      await payBooking(page.request, codeB);
    });
    await test.step(`เลื่อน A ${aFrom}:00 (฿800) → ${aTo}:00 (฿1,200) จ่ายเพิ่ม ฿400`, async () => {
      await open(page, `/booking/${codeA}`);
      await page.getByTestId('reschedule-date').fill(date);
      await page.getByTestId('reschedule-start').selectOption(String(aTo));
      await page.getByTestId('reschedule-submit').click();
      await expectSuccess(page, 'เลื่อนการจองแล้ว จ่ายส่วนต่าง ฿400 เรียบร้อย');
      await expect(page.getByTestId('booking-time')).toHaveAttribute('data-value', `${aTo}-1`);
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '1200');
    });
    await test.step('เลื่อนครั้งที่ 2 (= 1 + 1) → ปฏิเสธ', async () => {
      await open(page, `/booking/${codeA}`);
      if (await page.getByTestId('reschedule-submit').count()) {
        await page.getByTestId('reschedule-start').selectOption(String(again));
        await page.getByTestId('reschedule-submit').click();
        await expectError(page, 'เลื่อนได้ 1 ครั้งต่อการจอง');
      } else {
        const r = await page.request.post(`/api/bookings/${codeA}/reschedule`, { data: { date, startHour: again } });
        expect(r.status()).toBe(409);
        expect((await r.json()).error.message).toBe('เลื่อนได้ 1 ครั้งต่อการจอง');
      }
      await expect(page.getByTestId('booking-time')).toHaveAttribute('data-value', `${aTo}-1`);
    });
    await test.step(`เลื่อน B ${bFrom}:00 (฿1,200) → ${bTo}:00 (฿800) ได้เครดิตคืน ฿400`, async () => {
      await open(page, `/booking/${codeB}`);
      await page.getByTestId('reschedule-date').fill(date);
      await page.getByTestId('reschedule-start').selectOption(String(bTo));
      await page.getByTestId('reschedule-submit').click();
      await expectSuccess(page, 'เลื่อนการจองแล้ว ได้รับส่วนต่างเป็นเครดิต ฿400');
      await expect(page.getByTestId('booking-time')).toHaveAttribute('data-value', `${bTo}-1`);
      await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', '800');
    });
  });

  test('TC-CANCEL-06 เลื่อนการจองที่คำท้า MATCHED ไม่ได้ (A-21)', {
    tag: ['@CANCEL', '@P1'],
    annotation: { type: 'expected', description: 'B พฤ. 15 ต.ค. 1 ชม. (฿800 มัดจำ 400) ประกาศหาคู่แข่ง ทีมอื่นรับและจ่าย ฿400 → MATCHED · หน้าเจ้าของ reschedule-submit-hint data-value CHALLENGE_MATCHED "มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้" · กดเลื่อนไปเวลาว่าง → error เดิม · API reschedule → 409 CHALLENGE_MATCHED · วัน/เวลาเดิม rescheduleCount 0 สถานะ CONFIRMED เครดิตเจ้าของ 400 (CHALLENGE อย่างเดียว) ช่องปลายทางยังว่าง' },
  }, async ({ page, pick, b, anonApi }) => {
    const [hour, target] = pick([[14, 21], [15, 22], [16, 23]] as const);
    const date = '2026-10-15';
    const ownerPhone = uniquePhone(b);
    let code = '';
    let id = 0;
    await test.step(`เจ้าของ (สมาชิกใหม่) จองและจ่าย B ${date} ${hour}:00 แล้วประกาศหาคู่แข่ง`, async () => {
      await registerCustomer(page.request, { name: 'เจ้าของเลื่อนไม่ได้', phone: ownerPhone });
      code = (await createBooking(page.request, { fieldId: 'B', date, startHour: hour, phone: ownerPhone, name: 'เจ้าของเลื่อนไม่ได้' })).code;
      await payBooking(page.request, code);
      const c = await postJson(page.request, '/api/challenges', { code, teamName: `ทีมเลื่อนไม่ได้${b}`, level: 'BEGINNER' });
      expect(c.status, JSON.stringify(c.body)).toBeLessThan(300);
      expect(c.body.challenge.amount).toBe(400);
      id = c.body.challenge.id;
    });
    await test.step('ทีมอื่นรับคำท้าและจ่าย ฿400 → MATCHED', async () => {
      const rival = await anonApi();
      const rivalPhone = uniquePhone(b);
      const a = await postJson(rival, `/api/challenges/${id}/accept`, { name: 'ทีมผู้ท้า', phone: rivalPhone, consent: true });
      expect(a.status, JSON.stringify(a.body)).toBeLessThan(300);
      const pay = await postJson(rival, `/api/challenges/${id}/pay`, { phone: rivalPhone });
      expect(pay.status, JSON.stringify(pay.body)).toBeLessThan(300);
      expect(pay.body.challenge.status).toBe('MATCHED');
    });
    await test.step('หน้าการจอง: เหตุผลที่เลื่อนไม่ได้แสดงก่อนกด', async () => {
      await open(page, `/booking/${code}`);
      await expect(page.getByTestId('challenge-status')).toHaveAttribute('data-value', 'MATCHED');
      await expect(page.getByTestId('reschedule-submit-hint')).toHaveAttribute('data-value', 'CHALLENGE_MATCHED');
      await expect(page.getByTestId('reschedule-submit-hint')).toContainText(MSG_MATCHED);
    });
    await test.step(`กดเลื่อนไป ${target}:00 (ช่วงว่าง) → ปฏิเสธ`, async () => {
      await page.getByTestId('reschedule-date').fill(date);
      await page.getByTestId('reschedule-start').selectOption(String(target));
      await page.getByTestId('reschedule-submit').click();
      await expectError(page, MSG_MATCHED);
      await expect(page.getByTestId('booking-time')).toHaveAttribute('data-value', `${hour}-1`);
    });
    await test.step('API เลื่อน → 409 CHALLENGE_MATCHED และการจองไม่เปลี่ยน', async () => {
      const r = await postJson(page.request, `/api/bookings/${code}/reschedule`, { date, startHour: target });
      expect(r.status, JSON.stringify(r.body)).toBe(409);
      expect(r.body?.error?.code).toBe('CHALLENGE_MATCHED');
      expect(r.body?.error?.message).toBe(MSG_MATCHED);
      const bk = (await getBooking(page.request, code)).body.booking;
      expect(bk.status).toBe('CONFIRMED');
      expect(bk.date).toBe(date);
      expect(bk.startHour).toBe(hour);
      expect(bk.rescheduleCount).toBe(0);
      const me = (await getJson(page.request, '/api/me')).body;
      expect(me.customer.creditBalance, 'เครดิตเจ้าของ = CHALLENGE ฿400 เท่านั้น').toBe(400);
      expect(me.creditEntries.filter((e: any) => e.reason === 'RESCHEDULE')).toHaveLength(0);
      const av = (await getJson(page.request, `/api/availability?date=${date}`)).body;
      expect(av.slots.find((x: any) => x.fieldId === 'B' && x.hour === target)?.status).toBe('free');
    });
  });
});
