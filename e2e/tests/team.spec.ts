import { test, expect, open, waitReady, uniquePhone, createBooking, payBooking, getBooking, getJson, postJson, registerCustomer, expectError, expectSuccess, clickStable } from './fixtures';

/** ข้อความคำต่อคำจาก SPEC ข้อ 4 */
const MSG_MATCHED = 'มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้';
const MSG_SPLIT_EXISTS = 'การจองนี้มีลิงก์หารค่าสนามแล้ว ใช้ลิงก์เดิม';

test.describe('TEAM', () => {
  test('TC-TEAM-01 ลิงก์หารค่าสนาม ยอดต่อคน (ปัดขึ้น) และสถานะจ่ายรายคน', {
    tag: ['@TEAM', '@P2'],
    annotation: { type: 'expected', description: '฿2,400 ÷ 12 คน → split-per-person 200 · /split/{token}: split-net 2,400 split-people 12 · สลับคนที่ 1 → data-paid true, split-paid-count 1 · 1 คน → "จำนวนคนต้องอยู่ระหว่าง 2–30 คน" · ฿1,200 ÷ 7 คน (ใส่ชื่อ) → 172 (ปัดขึ้นจาก 171.43)' },
  }, async ({ page, pick, b }) => {
    const [bStart, cStart] = pick([[19, 8], [21, 9], [17, 10]] as const);
    const date = '2026-10-14';
    const phone = uniquePhone(b);
    let code12 = '';
    let code7 = '';
    await test.step(`จองและจ่าย B ${bStart}:00 × 2 (฿2,400) และ C ${cStart}:00 × 1 (฿1,200) พ. 14 ต.ค.`, async () => {
      code12 = (await createBooking(page.request, { fieldId: 'B', date, startHour: bStart, hours: 2, phone, name: 'กัปตันทีม' })).code;
      await payBooking(page.request, code12);
      code7 = (await createBooking(page.request, { fieldId: 'C', date, startHour: cStart, hours: 1, phone, name: 'กัปตันทีม' })).code;
      await payBooking(page.request, code7);
    });
    let link = '';
    await test.step('สร้างลิงก์หาร 12 คน → คนละ ฿200', async () => {
      await open(page, `/booking/${code12}`);
      await page.getByTestId('split-count').fill('12');
      await page.getByTestId('split-create').click();
      await expectSuccess(page, 'สร้างลิงก์หารค่าสนามแล้ว');
      await expect(page.getByTestId('split-per-person')).toHaveAttribute('data-value', '200');
      link = (await page.getByTestId('split-link').getAttribute('href')) ?? '';
      expect(link).toMatch(/\/split\/\S+/);
    });
    await test.step('เปิดลิงก์หาร (ลูกทีม) แล้วกดว่าคนที่ 1 จ่ายแล้ว', async () => {
      await open(page, link);
      await expect(page.getByTestId('split-net')).toHaveAttribute('data-value', '2400');
      // split-people / split-paid-count เป็นจำนวนคน ไม่ใช่เงิน → SPEC ไม่ได้บอกว่ามี data-value จึงตรวจจากข้อความ
      await expect(page.getByTestId('split-people')).toHaveText(/^\D*12\D*$/);
      await expect(page.getByTestId('split-per-person')).toHaveAttribute('data-value', '200');
      await expect(page.getByTestId('split-paid-count')).toHaveText(/^\D*0\D*$/);
      await clickStable(page.getByTestId('split-toggle-1'));
      await expect(page.getByTestId('split-share-1')).toHaveAttribute('data-paid', 'true');
      await expect(page.getByTestId('split-paid-count')).toHaveText(/^\D*1\D*$/);
    });
    await test.step('การจอง ฿1,200: 1 คน (= 2 − 1) → ปฏิเสธ', async () => {
      await open(page, `/booking/${code7}`);
      await page.getByTestId('split-count').fill('1');
      await page.getByTestId('split-create').click();
      await expectError(page, 'จำนวนคนต้องอยู่ระหว่าง 2–30 คน');
    });
    await test.step('ใส่ชื่อลูกทีม 7 คน → ฿1,200 ÷ 7 = 171.43 ปัดขึ้น ฿172', async () => {
      await page.getByTestId('split-count').fill('');
      await page.getByTestId('split-names').fill(['เอ', 'บี', 'ซี', 'ดี', 'อี', 'เอฟ', 'จี'].join('\n'));
      await page.getByTestId('split-create').click();
      await expectSuccess(page, 'สร้างลิงก์หารค่าสนามแล้ว');
      await expect(page.getByTestId('split-per-person')).toHaveAttribute('data-value', '172');
      await expect(page.getByTestId('split-share-7')).toBeVisible();
    });
  });

  test('TC-TEAM-02 ประกาศหาคู่แข่ง → ทีมอื่นรับ จ่ายครึ่งค่าสนาม → เครดิตเข้าเจ้าของ และยกเลิกไม่ได้', {
    tag: ['@TEAM', '@P1'],
    annotation: { type: 'expected', description: 'การจองค้างจ่าย → "ประกาศหาคู่แข่งได้เฉพาะการจองที่ยืนยันแล้วและยังไม่ถึงเวลาเริ่ม" · C ศ. 18:00 ฿1,800 ประกาศ → "ประกาศหาคู่แข่งแล้ว" ทีมรับจ่าย 900 · /challenges ไม่มีเบอร์โทร · เจ้าของรับเอง → "รับคำท้าของตัวเองไม่ได้" · ทีมอื่นรับ → "รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที" จ่าย 900 → "ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย" MATCHED · เจ้าของเครดิต 900 (CHALLENGE) · เจ้าของยกเลิก → ถูกปฏิเสธ 409 CHALLENGE_MATCHED "มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้" (cancel-booking-hint / cancel-confirm-reason data-value CHALLENGE_MATCHED) สถานะยัง CONFIRMED เครดิตยัง 900' },
  }, async ({ page, newUserPage, pick, b }) => {
    const hour = pick([18, 19, 20] as const);
    const pendHour = pick([8, 9, 10] as const);
    const date = '2026-10-16';
    const ownerPhone = uniquePhone(b);
    let code = '';
    let pendCode = '';
    let id = 0;
    await test.step(`เจ้าของ (สมาชิกใหม่) จอง C ศ. 16 ต.ค. ${hour}:00 จ่ายเต็ม 1,800 และอีกการจองค้างจ่าย`, async () => {
      await registerCustomer(page.request, { name: 'เจ้าของสนาม', phone: ownerPhone });
      const bk = await createBooking(page.request, { fieldId: 'C', date, startHour: hour, phone: ownerPhone, name: 'เจ้าของสนาม' });
      code = bk.code;
      const paid = await payBooking(page.request, code);
      expect(paid.amount).toBe(1800);
      pendCode = (await createBooking(page.request, { fieldId: 'C', date, startHour: pendHour, phone: ownerPhone, name: 'เจ้าของสนาม' })).code;
    });
    await test.step('ประกาศจากการจองที่ยังไม่จ่าย → ปฏิเสธ', async () => {
      const r = await postJson(page.request, '/api/challenges', { code: pendCode, teamName: 'ทีมค้างจ่าย', level: 'BEGINNER' });
      expect(r.status).toBe(409);
      expect(r.body?.error?.code).toBe('CHALLENGE_NOT_ALLOWED');
      expect(r.body?.error?.message).toBe('ประกาศหาคู่แข่งได้เฉพาะการจองที่ยืนยันแล้วและยังไม่ถึงเวลาเริ่ม');
    });
    await test.step('ประกาศหาคู่แข่งระดับกลาง (INTERMEDIATE) → ทีมรับต้องจ่าย ฿900', async () => {
      await open(page, `/booking/${code}`);
      await page.getByTestId('challenge-team').fill(`ทีมเจ้าบ้าน${b}`);
      await page.getByTestId('challenge-level').selectOption('INTERMEDIATE');
      await page.getByTestId('challenge-create').click();
      await expectSuccess(page, 'ประกาศหาคู่แข่งแล้ว');
      await expect(page.getByTestId('challenge-status')).toHaveAttribute('data-value', 'OPEN');
      await expect(page.getByTestId('challenge-amount')).toHaveAttribute('data-value', '900');
      id = (await getBooking(page.request, code)).body.booking.challenge.id;
      expect(id).toBeTruthy();
    });
    await test.step('เจ้าของรับคำท้าของตัวเอง → ปฏิเสธ', async () => {
      const r = await postJson(page.request, `/api/challenges/${id}/accept`, { name: 'เจ้าของสนาม', phone: ownerPhone, consent: true });
      expect(r.status).toBe(409);
      expect(r.body?.error?.code).toBe('CHALLENGE_OWN');
      expect(r.body?.error?.message).toBe('รับคำท้าของตัวเองไม่ได้');
    });
    const rival = await newUserPage();
    const rivalPhone = uniquePhone(b);
    await test.step('ทีมอื่นเปิด /challenges: เห็นประกาศ ยอด 900 ไม่มีเบอร์โทรใด ๆ', async () => {
      await open(rival, '/challenges');
      const card = rival.getByTestId(`challenge-${id}`);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('data-level', 'INTERMEDIATE');
      await expect(rival.getByTestId(`challenge-amount-${id}`)).toHaveAttribute('data-value', '900');
      const text = await rival.locator('body').innerText();
      expect(text, 'หน้า /challenges ต้องไม่แสดงเบอร์โทร').not.toMatch(/0\d{9}/);
      expect(text).not.toContain(ownerPhone);
    });
    await test.step('ทีมอื่นกดรับคำท้า กรอกชื่อ/เบอร์/ยินยอม → รอจ่าย 900', async () => {
      await rival.getByTestId(`challenge-accept-${id}`).click();
      await rival.getByTestId('accept-name').fill('ทีมผู้ท้าชิง');
      await rival.getByTestId('accept-phone').fill(rivalPhone);
      await rival.getByTestId('accept-consent').check();
      await rival.getByTestId('accept-submit').click();
      await expectSuccess(rival, 'รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที');
      await expect(rival.getByTestId('challenge-pay-amount')).toHaveAttribute('data-value', '900');
    });
    await test.step('ทีมอื่นยืนยันจ่าย → MATCHED', async () => {
      await rival.getByTestId('challenge-pay-confirm').click();
      await expectSuccess(rival, 'ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย');
      await expect(rival.getByTestId(`challenge-${id}`)).toHaveAttribute('data-status', 'MATCHED');
    });
    await test.step('เจ้าของได้เครดิต ฿900 (CHALLENGE)', async () => {
      await open(page, '/my');
      await expect(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '900');
      await expect(page.getByTestId('credit-history').locator('[data-reason="CHALLENGE"]')).toHaveAttribute('data-value', /^\+?900$/);
    });
    await test.step('เจ้าของพยายามยกเลิกการจองที่ MATCHED → CHALLENGE_MATCHED (409) สถานะยัง CONFIRMED เครดิตยัง 900', async () => {
      await open(page, `/booking/${code}`);
      await expect(page.getByTestId('challenge-status')).toHaveAttribute('data-value', 'MATCHED');
      // SPEC 7.5: เหตุผลแสดงก่อนกด (cancel-booking-hint) · ปุ่มยังกดได้และเปิดขั้นยืนยันเสมอ
      await expect(page.getByTestId('cancel-booking-hint')).toHaveAttribute('data-value', 'CHALLENGE_MATCHED');
      await expect(page.getByTestId('cancel-booking-hint')).toContainText(MSG_MATCHED);
      await page.getByTestId('cancel-booking').click();
      await expect(page.getByTestId('cancel-credit-preview')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('cancel-confirm-reason')).toHaveAttribute('data-value', 'CHALLENGE_MATCHED');
      await page.getByTestId('cancel-confirm').click();
      await expect(page.locator('[data-testid="error-message"], [data-testid="success-message"]').first()).toBeVisible();
      const msg = await page.locator('[data-testid="success-message"]').count() ? await page.getByTestId('success-message').innerText() : '';
      expect((await getBooking(page.request, code)).body.booking.status, `หลัง MATCHED เจ้าของต้องยกเลิกไม่ได้ แต่ระบบตอบ "${msg}"`).toBe('CONFIRMED');
      await expectError(page, MSG_MATCHED);
      const r = await postJson(page.request, `/api/bookings/${code}/cancel`, {});
      expect(r.status, JSON.stringify(r.body)).toBe(409);
      expect(r.body?.error?.code).toBe('CHALLENGE_MATCHED');
      expect(r.body?.error?.message).toBe(MSG_MATCHED);
      const after = await getBooking(page.request, code);
      expect(after.body.booking.status, 'หลัง MATCHED เจ้าของต้องยกเลิกไม่ได้').toBe('CONFIRMED');
      expect((await getJson(page.request, '/api/me')).body.customer.creditBalance, 'เครดิตเจ้าของต้องยัง 900').toBe(900);
      await open(page, `/booking/${code}`);
      await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
    });
  });

  test('TC-TEAM-03 คำแสดงระดับทีม มือใหม่ / กลาง / เก่ง และกรองตามระดับ', {
    tag: ['@TEAM', '@P3'],
    annotation: { type: 'expected', description: 'ตัวเลือก challenge-level และ challenge-filter-level: BEGINNER = "มือใหม่", INTERMEDIATE = "กลาง", ADVANCED = "เก่ง" · การ์ด ADVANCED แสดง "เก่ง" · กรอง ADVANCED เห็นเฉพาะ data-level="ADVANCED"' },
  }, async ({ page, pick, b }) => {
    const hour = pick([14, 15, 16] as const);
    let code = '';
    let id = 0;
    const optionTexts = (testid: string) => page.getByTestId(testid).locator('option').evaluateAll((os) =>
      Object.fromEntries(os.map((o) => [(o as HTMLOptionElement).value, (o.textContent ?? '').trim()])));
    await test.step(`จองและจ่าย C พ. 14 ต.ค. ${hour}:00`, async () => {
      code = (await createBooking(page.request, { fieldId: 'C', date: '2026-10-14', startHour: hour, phone: uniquePhone(b), name: 'ทีมระดับ' })).code;
      await payBooking(page.request, code);
    });
    await test.step('ประกาศหาคู่แข่งระดับ ADVANCED', async () => {
      await open(page, `/booking/${code}`);
      await page.getByTestId('challenge-team').fill(`ทีมเทพ${b}`);
      await page.getByTestId('challenge-level').selectOption('ADVANCED');
      await page.getByTestId('challenge-create').click();
      await expectSuccess(page, 'ประกาศหาคู่แข่งแล้ว');
      id = (await getBooking(page.request, code)).body.booking.challenge.id;
    });
    await test.step('ตัวเลือกระดับในหน้าการจองใช้คำ มือใหม่ / กลาง / เก่ง', async () => {
      await open(page, `/booking/${code}`);
      const levels = await page.getByTestId('challenge-level').count() ? await optionTexts('challenge-level') : null;
      if (levels) {
        expect.soft({ BEGINNER: levels.BEGINNER, INTERMEDIATE: levels.INTERMEDIATE, ADVANCED: levels.ADVANCED }, 'คำในตัวเลือกระดับ (หน้าการจอง)')
          .toEqual({ BEGINNER: 'มือใหม่', INTERMEDIATE: 'กลาง', ADVANCED: 'เก่ง' });
      }
    });
    await test.step('หน้า /challenges กรอง ADVANCED เห็นเฉพาะระดับเก่ง', async () => {
      await open(page, '/challenges');
      await page.getByTestId('challenge-filter-level').selectOption('ADVANCED');
      await waitReady(page);
      await expect(page.getByTestId(`challenge-${id}`)).toBeVisible();
      const lv = await page.locator('[data-testid^="challenge-"][data-level]').evaluateAll((els) => els.map((e) => e.getAttribute('data-level')));
      expect(lv.length).toBeGreaterThan(0);
      expect(new Set(lv)).toEqual(new Set(['ADVANCED']));
    });
    await test.step('ตัวกรองและการ์ดใช้คำ มือใหม่ / กลาง / เก่ง', async () => {
      const f = await optionTexts('challenge-filter-level');
      expect.soft({ BEGINNER: f.BEGINNER, INTERMEDIATE: f.INTERMEDIATE, ADVANCED: f.ADVANCED }, 'คำในตัวกรองระดับ (/challenges)')
        .toEqual({ BEGINNER: 'มือใหม่', INTERMEDIATE: 'กลาง', ADVANCED: 'เก่ง' });
      const cardText = await page.getByTestId(`challenge-${id}`).innerText();
      expect.soft(cardText, 'การ์ด ADVANCED ต้องแสดงคำว่า "เก่ง"').toContain('เก่ง');
    });
    void getJson;
  });

  test('TC-TEAM-06 สร้างลิงก์หารซ้ำได้ลิงก์เดิม จำนวนคนเดิม สถานะจ่ายไม่ถูกล้าง (1 การจอง 1 ลิงก์)', {
    tag: ['@TEAM', '@P2'],
    annotation: { type: 'expected', description: 'C พฤ. 15 ต.ค. 1 ชม. ฿1,800 · สร้างลิงก์ 6 คน → "สร้างลิงก์หารค่าสนามแล้ว" คนละ ฿300 · หลังสร้างไม่มีฟอร์ม split-create · ลูกทีมคนที่ 1 จ่ายแล้ว · สร้างครั้งที่ 2 (= 1 + 1) ด้วย 9 คน → 200 existing=true token เดิม people 6 perPerson 300 "การจองนี้มีลิงก์หารค่าสนามแล้ว ใช้ลิงก์เดิม" · ครั้งที่ 3 ใส่ชื่อ 3 คน → ลิงก์เดิมเช่นกัน · ลิงก์ยังมี 6 ส่วน paidCount 1' },
  }, async ({ page, pick, b }) => {
    const hour = pick([19, 20, 21] as const);
    const date = '2026-10-15';
    let code = '';
    await test.step(`จองและจ่าย C ${date} ${hour}:00 × 1 (฿1,800 มัดจำ 900)`, async () => {
      code = (await createBooking(page.request, { fieldId: 'C', date, startHour: hour, phone: uniquePhone(b), name: 'กัปตันลิงก์เดิม' })).code;
      await payBooking(page.request, code);
    });
    let link = '';
    await test.step('สร้างลิงก์หารครั้งแรก 6 คน → คนละ ฿300', async () => {
      await open(page, `/booking/${code}`);
      await page.getByTestId('split-count').fill('6');
      await page.getByTestId('split-create').click();
      await expectSuccess(page, 'สร้างลิงก์หารค่าสนามแล้ว');
      await expect(page.getByTestId('split-per-person')).toHaveAttribute('data-value', '300');
      await expect(page.getByTestId('split-link-people')).toHaveAttribute('data-value', '6');
      link = (await page.getByTestId('split-link').getAttribute('href')) ?? '';
      expect(link).toMatch(/\/split\/\S+/);
    });
    await test.step('เปิดหน้าการจองใหม่: แสดงลิงก์เดิม ไม่มีฟอร์มสร้างอีก', async () => {
      await open(page, `/booking/${code}`);
      await expect(page.getByTestId('split-link')).toHaveAttribute('href', link);
      await expect(page.getByTestId('split-create')).toHaveCount(0);
    });
    await test.step('ลูกทีมคนที่ 1 กดว่าจ่ายแล้ว', async () => {
      await open(page, link);
      await clickStable(page.getByTestId('split-toggle-1'));
      await expect(page.getByTestId('split-share-1')).toHaveAttribute('data-paid', 'true');
    });
    const token = link.split('/split/')[1];
    await test.step('สร้างครั้งที่ 2 (API) ด้วย 9 คน → ได้ลิงก์เดิม 6 คน ฿300', async () => {
      const r = await postJson(page.request, `/api/bookings/${code}/split`, { count: 9 });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.existing).toBe(true);
      expect(r.body.token).toBe(token);
      expect(r.body.people).toBe(6);
      expect(r.body.perPerson).toBe(300);
      expect(r.body.message).toBe(MSG_SPLIT_EXISTS);
    });
    await test.step('สร้างครั้งที่ 3 (API) ใส่ชื่อ 3 คน → ลิงก์เดิมเช่นกัน', async () => {
      const r = await postJson(page.request, `/api/bookings/${code}/split`, { names: ['หนึ่ง', 'สอง', 'สาม'] });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.existing).toBe(true);
      expect(r.body.token).toBe(token);
      expect(r.body.people).toBe(6);
    });
    await test.step('ลิงก์ยังมี 6 ส่วน และสถานะจ่ายของคนที่ 1 ไม่ถูกล้าง', async () => {
      const r = await getJson(page.request, `/api/split/${token}`);
      expect(r.status).toBe(200);
      expect(r.body.people).toBe(6);
      expect(r.body.shares).toHaveLength(6);
      expect(r.body.paidCount).toBe(1);
      await open(page, link);
      await expect(page.getByTestId('split-share-1')).toHaveAttribute('data-paid', 'true');
      await expect(page.getByTestId('split-per-person')).toHaveAttribute('data-value', '300');
    });
  });

  test('TC-TEAM-07 หน้าลิงก์หาร split-people และ split-paid-count มี data-value เป็นจำนวน', {
    tag: ['@TEAM', '@P3'],
    annotation: { type: 'expected', description: 'C อา. 11 ต.ค. 1 ชม. ฿1,800 ลิงก์ 4 คน (คนละ ฿450) · /split/{token}: split-people data-value 4 · split-paid-count data-value 0 → กดจ่ายคนที่ 1, 2 → 2 → ยกเลิกคนที่ 1 → 1' },
  }, async ({ page, pick, b }) => {
    const hour = pick([8, 9, 10] as const);
    let link = '';
    await test.step(`จองและจ่าย C อา. 11 ต.ค. ${hour}:00 แล้วสร้างลิงก์หาร 4 คน`, async () => {
      const code = (await createBooking(page.request, { fieldId: 'C', date: '2026-10-11', startHour: hour, phone: uniquePhone(b), name: 'กัปตันนับคน' })).code;
      await payBooking(page.request, code);
      const r = await postJson(page.request, `/api/bookings/${code}/split`, { count: 4 });
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
      expect(r.body.perPerson).toBe(450);
      link = r.body.url;
    });
    await test.step('เปิดลิงก์: split-people = 4, split-paid-count = 0', async () => {
      await open(page, link);
      await expect(page.getByTestId('split-people')).toHaveAttribute('data-value', '4');
      await expect(page.getByTestId('split-paid-count')).toHaveAttribute('data-value', '0');
      await expect(page.getByTestId('split-per-person')).toHaveAttribute('data-value', '450');
    });
    await test.step('กดจ่ายคนที่ 1 และ 2 → split-paid-count = 2', async () => {
      await clickStable(page.getByTestId('split-toggle-1'));
      await expect(page.getByTestId('split-share-1')).toHaveAttribute('data-paid', 'true');
      await clickStable(page.getByTestId('split-toggle-2'));
      await expect(page.getByTestId('split-share-2')).toHaveAttribute('data-paid', 'true');
      await expect(page.getByTestId('split-paid-count')).toHaveAttribute('data-value', '2');
    });
    await test.step('ยกเลิกสถานะจ่ายคนที่ 1 → split-paid-count = 1', async () => {
      await clickStable(page.getByTestId('split-toggle-1'));
      await expect(page.getByTestId('split-share-1')).toHaveAttribute('data-paid', 'false');
      await expect(page.getByTestId('split-paid-count')).toHaveAttribute('data-value', '1');
    });
  });
});
