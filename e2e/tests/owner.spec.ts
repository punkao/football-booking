import { test, expect, open, uniquePhone, createBooking, payBooking, getBooking, getJson, postJson, registerCustomer, staffLoginPage, expectError, expectSuccess } from './fixtures';

test.describe('OWNER', () => {
  test('TC-OWNER-01 เจ้าของเพิ่ม/ลบวันหยุด มีผลกับราคา', {
    tag: ['@OWNER', '@P2'],
    annotation: { type: 'expected', description: 'เพิ่มวันหยุด → "เพิ่มวันหยุดแล้ว" รายการปรากฏ · ตารางวันนั้นมี holiday-badge และ A 09:00 = ฿1,300 [D:CR-05 · ORACLE-CHANGES 2026-10-21] · เพิ่มซ้ำ → "มีวันหยุดวันนี้อยู่แล้ว" · ลบ → "ลบวันหยุดแล้ว" ราคากลับเป็น ฿800' },
  }, async ({ page, pick }) => {
    const date = pick(['2026-11-05', '2026-11-09', '2026-11-10'] as const);
    await test.step('ก่อนเพิ่ม: วันธรรมดา A 09:00 = ฿800', async () => {
      await open(page, `/book?date=${date}`);
      await expect(page.getByTestId('slot-A-9')).toHaveAttribute('data-price', '800');
    });
    await test.step(`เจ้าของเพิ่มวันหยุด ${date}`, async () => {
      await staffLoginPage(page, 'owner');
      await open(page, '/owner');
      await page.getByTestId('holiday-date').fill(date);
      await page.getByTestId('holiday-name').fill('วันหยุดทดสอบ');
      await page.getByTestId('holiday-add').click();
      await expectSuccess(page, 'เพิ่มวันหยุดแล้ว');
      await expect(page.getByTestId(`holiday-${date}`)).toBeVisible();
    });
    await test.step('ตารางวันนั้นมีป้ายวันหยุด และ A 09:00 = ฿1,300', async () => {
      await open(page, `/book?date=${date}`);
      await expect(page.getByTestId('holiday-badge')).toBeVisible();
      // [D:CR-05] ORACLE-CHANGES 2026-10-21: วันหยุด พ.ย. (หลัง 1 พ.ย.) ใช้ราคาเย็นใหม่ ฿1,300 (เดิม 1200)
      await expect(page.getByTestId('slot-A-9')).toHaveAttribute('data-price', '1300');
    });
    await test.step('เพิ่มวันเดิมซ้ำ → ปฏิเสธ', async () => {
      await open(page, '/owner');
      await page.getByTestId('holiday-date').fill(date);
      await page.getByTestId('holiday-name').fill('วันหยุดซ้ำ');
      await page.getByTestId('holiday-add').click();
      await expectError(page, 'มีวันหยุดวันนี้อยู่แล้ว');
    });
    await test.step('ลบวันหยุด → ราคากลับเป็น ฿800', async () => {
      await page.getByTestId(`holiday-delete-${date}`).click();
      await expectSuccess(page, 'ลบวันหยุดแล้ว');
      await expect(page.getByTestId(`holiday-${date}`)).toHaveCount(0);
      await open(page, `/book?date=${date}`);
      await expect(page.getByTestId('holiday-badge')).toHaveCount(0);
      await expect(page.getByTestId('slot-A-9')).toHaveAttribute('data-price', '800');
    });
  });

  test('TC-OWNER-02 ปิดสนามเพราะฝน: เฉพาะ A/B · คืนเครดิต · ไม่แตะการจองนอกช่วง', {
    tag: ['@OWNER', '@P1'],
    annotation: { type: 'expected', description: 'closure-field มีแค่ A, B · API ปิด C → 400 "สนาม C มีหลังคา ปิดเพราะฝนไม่ได้" · ปิด A ช่วงที่จ่ายมา ฿1,200 → "ปิดสนามแล้ว คืนเครดิต 1 การจอง" closure-affected 1,200 · การจองเป็น RAIN_CLOSED ลูกค้าได้เครดิต 1,200 · การจอง 15:00 นอกช่วงยัง CONFIRMED · ช่องเป็น closed · จองช่วงที่ปิด → "สนามปิดในช่วงเวลานี้"' },
  }, async ({ page, pick, b, staffApi }) => {
    const [date, from, to] = pick([['2026-10-20', 19, 21], ['2026-10-18', 19, 21], ['2026-10-12', 21, 23]] as const);
    const phone = uniquePhone(b);
    let code = '';
    let outCode = '';
    await test.step(`ลูกค้า (สมาชิก) จอง A ${date} ${from}:00 × 2 จ่าย 1,200 และ A 15:00 (นอกช่วง)`, async () => {
      await registerCustomer(page.request, { name: 'ลูกค้าโดนฝน', phone });
      code = (await createBooking(page.request, { fieldId: 'A', date, startHour: from, hours: 2, phone, name: 'ลูกค้าโดนฝน' })).code;
      const paid = await payBooking(page.request, code);
      expect(paid.amount).toBe(1200);
      outCode = (await createBooking(page.request, { fieldId: 'A', date, startHour: 15, hours: 1, phone, name: 'ลูกค้าโดนฝน' })).code;
      await payBooking(page.request, outCode);
    });
    await test.step('API ปิดสนาม C (มีหลังคา) → ปฏิเสธ', async () => {
      const owner = await staffApi('owner');
      const r = await postJson(owner, '/api/owner/closures', { fieldId: 'C', date, fromHour: from, toHour: to });
      expect(r.status).toBe(400);
      expect(r.body?.error?.code).toBe('RAIN_COVERED_FIELD');
      expect(r.body?.error?.message).toBe('สนาม C มีหลังคา ปิดเพราะฝนไม่ได้');
    });
    await test.step(`เจ้าของปิด A ${date} ${from}:00–${to}:00 เพราะฝน`, async () => {
      await staffLoginPage(page, 'owner');
      await open(page, '/owner');
      const opts = await page.getByTestId('closure-field').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      expect(opts.sort()).toEqual(['A', 'B']);
      await page.getByTestId('closure-field').selectOption('A');
      await page.getByTestId('closure-date').fill(date);
      await page.getByTestId('closure-from').selectOption(String(from));
      await page.getByTestId('closure-to').selectOption(String(to));
      await page.getByTestId('closure-submit').click();
      await expectSuccess(page, 'ปิดสนามแล้ว คืนเครดิต 1 การจอง');
      await expect(page.getByTestId('closure-result')).toHaveAttribute('data-count', '1');
      await expect(page.getByTestId(`closure-affected-${code}`)).toContainText('฿1,200');
      await expect(page.getByTestId(`closure-affected-${outCode}`)).toHaveCount(0);
    });
    await test.step('การจองในช่วงเป็น RAIN_CLOSED ได้เครดิต 1,200 · นอกช่วงไม่ถูกแตะ', async () => {
      expect((await getBooking(page.request, code)).body.booking.status).toBe('RAIN_CLOSED');
      expect((await getBooking(page.request, outCode)).body.booking.status).toBe('CONFIRMED');
      const me = await getJson(page.request, '/api/me');
      expect(me.body.customer.creditBalance).toBe(1200);
    });
    await test.step('ตารางแสดงช่วงที่ปิดเป็น closed และจองช่วงนั้นไม่ได้', async () => {
      await open(page, `/book?date=${date}`);
      await expect(page.getByTestId(`slot-A-${from}`)).toHaveAttribute('data-status', 'closed');
      await expect(page.getByTestId(`slot-A-${from + 1}`)).toHaveAttribute('data-status', 'closed');
      const r = await postJson(page.request, '/api/quote', { fieldId: 'A', date, startHour: from, hours: 1 });
      expect(r.status).toBe(409);
      expect(r.body?.error?.code).toBe('FIELD_CLOSED');
      expect(r.body?.error?.message).toBe('สนามปิดในช่วงเวลานี้');
    });
  });

  test('TC-OWNER-03 ปิดเพราะฝนการจองที่คำท้า MATCHED: ทีมได้คืนเท่าที่จ่าย เจ้าของได้ จ่าย + เครดิตที่ใช้ − เครดิตจากคำท้า (A-27)', {
    tag: ['@OWNER', '@P1'],
    annotation: { type: 'expected', description: 'A ศ. 16 ต.ค. 1 ชม. (เริ่ม ≥ 17:00 → FULL_100) จ่าย ฿1,200 · ทีมรับจ่าย ฿600 (= ฿1,200 × 50%) → เจ้าของได้ CHALLENGE ฿600 · เจ้าของปิด A ช่วงนั้นเพราะฝน → "ปิดสนามแล้ว คืนเครดิต 1 การจอง" · closure-affected-{code}-credit = 600 (= ฿1,200 − ฿600) · closure-affected-{code}-challenge = 600 · การจอง RAIN_CLOSED คำท้า CLOSED · เจ้าของเครดิตรวม 1,200 (CHALLENGE +600, RAIN +600) · ทีมรับ (สมัครด้วยเบอร์นั้น) เครดิต 600 (RAIN +600)' },
  }, async ({ page, pick, b, anonApi }) => {
    const hour = pick([18, 19, 20] as const);
    const date = '2026-10-16';
    const ownerPhone = uniquePhone(b);
    const rivalPhone = uniquePhone(b);
    let code = '';
    let id = 0;
    await test.step(`เจ้าของ (สมาชิกใหม่) จอง A ศ. ${date} ${hour}:00 จ่ายเต็ม ฿1,200 แล้วประกาศหาคู่แข่ง`, async () => {
      await registerCustomer(page.request, { name: 'เจ้าของโดนฝน', phone: ownerPhone });
      const bk = await createBooking(page.request, { fieldId: 'A', date, startHour: hour, phone: ownerPhone, name: 'เจ้าของโดนฝน' });
      code = bk.code;
      expect(bk.paymentPlan).toBe('FULL_100');
      const paid = await payBooking(page.request, code);
      expect(paid.amount).toBe(1200);
      const c = await postJson(page.request, '/api/challenges', { code, teamName: `ทีมเจ้าบ้านฝน${b}`, level: 'INTERMEDIATE' });
      expect(c.status, JSON.stringify(c.body)).toBeLessThan(300);
      expect(c.body.challenge.amount).toBe(600);
      id = c.body.challenge.id;
    });
    await test.step('ทีมอื่นรับคำท้าและจ่าย ฿600 → MATCHED · เจ้าของได้เครดิต CHALLENGE ฿600', async () => {
      const rival = await anonApi();
      expect((await postJson(rival, `/api/challenges/${id}/accept`, { name: 'ทีมผู้ท้าโดนฝน', phone: rivalPhone, consent: true })).status).toBeLessThan(300);
      const pay = await postJson(rival, `/api/challenges/${id}/pay`, { phone: rivalPhone });
      expect(pay.status, JSON.stringify(pay.body)).toBeLessThan(300);
      expect(pay.body.challenge.status).toBe('MATCHED');
      expect((await getJson(page.request, '/api/me')).body.customer.creditBalance).toBe(600);
    });
    await test.step(`เจ้าของร้านปิด A ${date} ${hour}:00–${hour + 1}:00 เพราะฝน`, async () => {
      await staffLoginPage(page, 'owner');
      await open(page, '/owner');
      await page.getByTestId('closure-field').selectOption('A');
      await page.getByTestId('closure-date').fill(date);
      await page.getByTestId('closure-from').selectOption(String(hour));
      await page.getByTestId('closure-to').selectOption(String(hour + 1));
      await page.getByTestId('closure-submit').click();
      await expectSuccess(page, 'ปิดสนามแล้ว คืนเครดิต 1 การจอง');
      await expect(page.getByTestId('closure-result')).toHaveAttribute('data-count', '1');
      await expect(page.getByTestId(`closure-affected-${code}`)).toBeVisible();
      await expect(page.getByTestId(`closure-affected-${code}-credit`)).toHaveAttribute('data-value', '600');
      await expect(page.getByTestId(`closure-affected-${code}-challenge`)).toHaveAttribute('data-value', '600');
    });
    await test.step('การจอง RAIN_CLOSED คำท้า CLOSED · เจ้าของเครดิต 1,200 (CHALLENGE +600, RAIN +600)', async () => {
      const bk = (await getBooking(page.request, code)).body.booking;
      expect(bk.status).toBe('RAIN_CLOSED');
      expect(bk.challenge?.status).toBe('CLOSED');
      const me = (await getJson(page.request, '/api/me')).body;
      expect(me.customer.creditBalance, 'เจ้าของ = CHALLENGE 600 + RAIN (1,200 − 600)').toBe(1200);
      const rain = me.creditEntries.filter((e: any) => e.reason === 'RAIN');
      expect(rain.map((e: any) => e.amount)).toEqual([600]);
      await open(page, '/my');
      await expect(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '1200');
      await expect(page.getByTestId('credit-history').locator('[data-reason="RAIN"]')).toHaveAttribute('data-value', /^\+?600$/);
    });
    await test.step('ทีมรับคำท้าสมัครด้วยเบอร์ของทีม → เห็นเครดิตคืน ฿600 (RAIN)', async () => {
      const rival = await anonApi();
      await registerCustomer(rival, { name: 'ทีมผู้ท้าโดนฝน', phone: rivalPhone });
      const me = (await getJson(rival, '/api/me')).body;
      expect(me.customer.creditBalance).toBe(600);
      expect(me.creditEntries.filter((e: any) => e.reason === 'RAIN').map((e: any) => e.amount)).toEqual([600]);
    });
  });
});
