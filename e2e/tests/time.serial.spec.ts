/**
 * test ที่ต้องเลื่อนเวลา (/api/test/clock) — project "serial": รันทีละข้อหลัง 3 เบราว์เซอร์จบ (Chromium)
 * reset (now = ศ. 9 ต.ค. 2026 10:00) ก่อนและหลังทุกข้อ
 */
import { test, expect, open, waitReady, uniquePhone, createBooking, payBooking, getBooking, getJson, postJson, loginCustomer, registerCustomer, staffLoginPage, resetData, setClock, expectError, expectSuccess, fillBookingForm } from './fixtures';
import { SEED } from './constants';

const T = (local: string) => `${local}+07:00`;

/** ข้อความคำต่อคำจาก SPEC ข้อ 4 */
const MSG_TOO_LATE = 'ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น';
const MSG_PENDING = 'มีทีมกำลังชำระเงินรับคำท้า เลื่อนการจองได้หลังชำระเสร็จหรือหมดเวลา 15 นาที';

test.beforeEach(async ({ request }) => { await resetData(request); });
test.afterEach(async ({ request }) => { await resetData(request); });

test('TC-BOOK-05 จองวันนี้ต้องห่าง "ตอนนี้" อย่างน้อย 1 ชั่วโมง (15:00 → 16:00 ได้ / 15:01 ไม่ได้)', {
  tag: ['@BOOK', '@P1'],
  annotation: { type: 'expected', description: 'ตอนนี้ 15:00: slot-A-16 free และจองได้ → /pay · ตอนนี้ 15:01: slot-B-16 past และจอง B 16:00 → "ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง"' },
}, async ({ page, request }) => {
  await test.step('ตั้งเวลา 15:00 → รอบ 16:00 (ห่าง 60 นาที) ว่างและจองได้', async () => {
    await setClock(request, T('2026-10-09T15:00:00'));
    await open(page, '/book');
    await expect(page.getByTestId('slot-A-16')).toHaveAttribute('data-status', 'free');
    await open(page, '/book/new?field=A&date=2026-10-09&start=16');
    await fillBookingForm(page, { name: 'ทีมบ่ายสาม', phone: uniquePhone(3), consent: true });
    await page.getByTestId('book-submit').click();
    await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
  });
  await test.step('ตั้งเวลา 15:01 → รอบ 16:00 (ห่าง 59 นาที) เป็น past และจองไม่ได้', async () => {
    await setClock(request, T('2026-10-09T15:01:00'));
    await open(page, '/book');
    await expect(page.getByTestId('slot-B-16')).toHaveAttribute('data-status', 'past');
    await open(page, '/book/new?field=B&date=2026-10-09&start=16');
    await fillBookingForm(page, { name: 'ทีมสาย', phone: uniquePhone(3), consent: true });
    await page.getByTestId('book-submit').click();
    await expectError(page, 'ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง');
    await expect(page).toHaveURL(/\/book\/new/);
  });
});

test('TC-PAY-02 จ่ายภายใน 15 นาที (15:00 ทัน / 15:01 ไม่ทัน) และรอบกลับมาว่าง', {
  tag: ['@PAY', '@P1'],
  annotation: { type: 'expected', description: 'สร้าง 2 การจอง 10:00:00 · 10:15:00 จ่ายการจองที่ 1 → CONFIRMED · 10:15:01 เปิด /pay การจองที่ 2 → pay-expired "หมดเวลาชำระเงิน รอบเวลานี้ว่างแล้ว" สถานะ EXPIRED ช่องกลับเป็น free และจองใหม่ได้' },
}, async ({ page, request }) => {
  const phone = uniquePhone(3);
  let c1 = '';
  let c2 = '';
  await test.step('10:00:00 สร้างการจอง ส. 10 ต.ค. A 09:00 และ A 10:00 (ยังไม่จ่าย)', async () => {
    c1 = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-10', startHour: 9, phone, name: 'ทีมจ่ายช้า' })).code;
    c2 = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-10', startHour: 10, phone, name: 'ทีมจ่ายช้า' })).code;
  });
  await test.step('10:15:00 (ครบ 15 นาทีพอดี) จ่ายการจองที่ 1 → ทัน', async () => {
    await setClock(request, T('2026-10-09T10:15:00'));
    await open(page, `/pay/${c1}`);
    await page.getByTestId('pay-confirm').click();
    await expect(page).toHaveURL(new RegExp(`/booking/${c1}\\?done=paid`));
    await waitReady(page);
    await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
  });
  await test.step('10:15:01 (= 15 นาที + 1 วินาที) เปิดหน้าจ่ายการจองที่ 2 → หมดเวลา', async () => {
    await setClock(request, T('2026-10-09T10:15:01'));
    await open(page, `/pay/${c2}`);
    await expect(page.getByTestId('pay-expired')).toBeVisible();
    await expect(page.getByTestId('pay-expired')).toContainText('หมดเวลาชำระเงิน รอบเวลานี้ว่างแล้ว');
    await expect(page.getByTestId('pay-rebook')).toBeVisible();
    await expect(page.getByTestId('pay-confirm')).toHaveCount(0);
    const r = await getBooking(page.request, c2);
    expect(r.body.booking.status).toBe('EXPIRED');
  });
  await test.step('รอบ A 10:00 กลับมาว่าง และจองใหม่ได้', async () => {
    await open(page, '/book?date=2026-10-10');
    await expect(page.getByTestId('slot-A-10')).toHaveAttribute('data-status', 'free');
    await expect(page.getByTestId('slot-A-9')).toHaveAttribute('data-status', 'booked');
    await createBooking(page.request, { fieldId: 'A', date: '2026-10-10', startHour: 10, phone: uniquePhone(3), name: 'ทีมใหม่' });
  });
});

test('TC-CANCEL-01 ยกเลิกเมื่อเหลือ 24 ชั่วโมงพอดี ได้เครดิต = เงินที่จ่าย + เครดิตที่ใช้', {
  tag: ['@CANCEL', '@P1'],
  annotation: { type: 'expected', description: 'ต้น (เครดิต 1,200) จอง จ. 12 A 10:00 × 2 (฿1,600) ใช้เครดิต 1,200 จ่าย 200 · อา. 11 10:00 (เหลือ 24 ชม. พอดี) preview 1,400 → "ยกเลิกแล้ว ได้รับเครดิตคืน ฿1,400" CANCELLED · credit-balance 1,400 รายการ CANCEL +1,400' },
}, async ({ page, request }) => {
  let code = '';
  await test.step('ต้นเข้าสู่ระบบ จอง A จ. 12 ต.ค. 10:00 × 2 ใช้เครดิต 1,200 แล้วจ่าย 200', async () => {
    await loginCustomer(page.request, SEED.ton.phone, SEED.ton.password);
    const bk = await createBooking(page.request, { fieldId: 'A', date: '2026-10-12', startHour: 10, hours: 2, phone: SEED.ton.phone, name: SEED.ton.name, useCredit: true, creditUsed: 1200 });
    code = bk.code;
    expect(bk.creditUsed).toBe(1200);
    expect(bk.payNow).toBe(200);
    const paid = await payBooking(page.request, code);
    expect(paid.amount).toBe(200);
  });
  await test.step('ตั้งเวลา อา. 11 ต.ค. 10:00 (เหลือ 24:00 ชม. พอดี) แล้วยกเลิก', async () => {
    await setClock(request, T('2026-10-11T10:00:00'));
    await open(page, `/booking/${code}`);
    await page.getByTestId('cancel-booking').click();
    await expect(page.getByTestId('cancel-credit-preview')).toHaveAttribute('data-value', '1400');
    await page.getByTestId('cancel-confirm').click();
    await expectSuccess(page, 'ยกเลิกแล้ว ได้รับเครดิตคืน ฿1,400');
    await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CANCELLED');
  });
  await test.step('เครดิตของต้น = 1,200 − 1,200 + 1,400 = 1,400', async () => {
    await open(page, '/my');
    await expect(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '1400');
    await expect(page.getByTestId('credit-history').locator('[data-reason="CANCEL"]')).toHaveAttribute('data-value', /^\+?1400$/);
  });
});

test('TC-CANCEL-02 ยกเลิกเมื่อเหลือ 23:59 ชม. ไม่ได้เครดิต และยกเลิกหลังเวลาเริ่มไม่ได้', {
  tag: ['@CANCEL', '@P1'],
  annotation: { type: 'expected', description: 'อา. 11 10:01 (เหลือ 23:59) preview 0 → "ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง" CANCELLED ช่องกลับเป็น free · จ. 12 10:01 (เริ่มไปแล้ว 1 นาที) ยกเลิก → "ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น" ยัง CONFIRMED' },
}, async ({ page, request }) => {
  const phone = uniquePhone(3);
  let cA = '';
  let cB = '';
  await test.step('จองและจ่าย A และ B จ. 12 ต.ค. 10:00', async () => {
    cA = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-12', startHour: 10, phone, name: 'ทีมยกเลิกช้า' })).code;
    await payBooking(page.request, cA);
    cB = (await createBooking(page.request, { fieldId: 'B', date: '2026-10-12', startHour: 10, phone, name: 'ทีมยกเลิกช้า' })).code;
    await payBooking(page.request, cB);
  });
  await test.step('อา. 11 10:01 (เหลือ 23 ชม. 59 นาที) ยกเลิก A → ไม่ได้เครดิต', async () => {
    await setClock(request, T('2026-10-11T10:01:00'));
    await open(page, `/booking/${cA}`);
    await page.getByTestId('cancel-booking').click();
    await expect(page.getByTestId('cancel-credit-preview')).toHaveAttribute('data-value', '0');
    await page.getByTestId('cancel-confirm').click();
    await expectSuccess(page, 'ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง');
    await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CANCELLED');
    await open(page, '/book?date=2026-10-12');
    await expect(page.getByTestId('slot-A-10')).toHaveAttribute('data-status', 'free');
  });
  await test.step('จ. 12 10:01 (หลังเวลาเริ่ม) ยกเลิก B → ปฏิเสธ', async () => {
    await setClock(request, T('2026-10-12T10:01:00'));
    await open(page, `/booking/${cB}`);
    if (await page.getByTestId('cancel-booking').count()) {
      await page.getByTestId('cancel-booking').click();
      await page.getByTestId('cancel-confirm').click();
      await expectError(page, 'ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น');
    } else {
      const r = await postJson(page.request, `/api/bookings/${cB}/cancel`, {});
      expect(r.status).toBe(409);
      expect(r.body?.error?.message).toBe('ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น');
    }
    expect((await getBooking(page.request, cB)).body.booking.status).toBe('CONFIRMED');
  });
});

test('TC-CANCEL-04 เลื่อนวันได้เมื่อเหลืออย่างน้อย 24 ชั่วโมง (23:59 ไม่ได้ / 24:00 ได้)', {
  tag: ['@CANCEL', '@P1'],
  annotation: { type: 'expected', description: 'การจอง จ. 12 A 10:00 · อา. 11 10:01 เลื่อนไป 14:00 → "เลื่อนได้เมื่อเหลือเวลาอย่างน้อย 24 ชั่วโมงก่อนเวลาเริ่ม" · อา. 11 10:00 → "เลื่อนการจองแล้ว" booking-time 14:00' },
}, async ({ page, request }) => {
  let code = '';
  await test.step('จองและจ่าย A จ. 12 ต.ค. 10:00', async () => {
    code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-12', startHour: 10, phone: uniquePhone(3), name: 'ทีมเลื่อนช้า' })).code;
    await payBooking(page.request, code);
  });
  await test.step('อา. 11 10:01 (เหลือ 23:59) เลื่อนไป 14:00 → ปฏิเสธ', async () => {
    await setClock(request, T('2026-10-11T10:01:00'));
    await open(page, `/booking/${code}`);
    await page.getByTestId('reschedule-date').fill('2026-10-12');
    await page.getByTestId('reschedule-start').selectOption('14');
    await page.getByTestId('reschedule-submit').click();
    await expectError(page, 'เลื่อนได้เมื่อเหลือเวลาอย่างน้อย 24 ชั่วโมงก่อนเวลาเริ่ม');
    await expect(page.getByTestId('booking-time')).toHaveAttribute('data-value', '10-1');
  });
  await test.step('อา. 11 10:00 (เหลือ 24:00 พอดี) เลื่อนไป 14:00 → สำเร็จ', async () => {
    await setClock(request, T('2026-10-11T10:00:00'));
    await open(page, `/booking/${code}`);
    await page.getByTestId('reschedule-date').fill('2026-10-12');
    await page.getByTestId('reschedule-start').selectOption('14');
    await page.getByTestId('reschedule-submit').click();
    await expectSuccess(page, 'เลื่อนการจองแล้ว');
    await expect(page.getByTestId('booking-time')).toHaveAttribute('data-value', '14-1');
  });
});

test('TC-TEAM-04 ทีมรับคำท้าไม่จ่ายใน 15 นาที → ประกาศกลับเป็น OPEN', {
  tag: ['@TEAM', '@P2'],
  annotation: { type: 'expected', description: 'ทีมที่ 1 รับ 10:00 · 10:15:01 จ่าย → "หมดเวลาชำระเงิน ประกาศกลับมาเปิดรับแล้ว" ประกาศเป็น OPEN · ทีมที่ 2 รับ 10:15:01 จ่ายตอน 10:29:01 (14 นาที) → "ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย" MATCHED' },
}, async ({ page, request, newUserPage }) => {
  let id = 0;
  await test.step('ต้นประกาศหาคู่แข่งจาก LN-900001 (CONFIRMED วันนี้ 19:00)', async () => {
    await loginCustomer(page.request, SEED.ton.phone, SEED.ton.password);
    await open(page, '/booking/LN-900001');
    await page.getByTestId('challenge-team').fill('ทีมต้น');
    await page.getByTestId('challenge-level').selectOption('BEGINNER');
    await page.getByTestId('challenge-create').click();
    await expectSuccess(page, 'ประกาศหาคู่แข่งแล้ว');
    id = (await getBooking(page.request, 'LN-900001')).body.booking.challenge.id;
  });
  const team1 = await newUserPage();
  await test.step('10:00 ทีมที่ 1 รับคำท้า', async () => {
    await open(team1, '/challenges');
    await team1.getByTestId(`challenge-accept-${id}`).click();
    await team1.getByTestId('accept-name').fill('ทีมลืมจ่าย');
    await team1.getByTestId('accept-phone').fill(uniquePhone(3));
    await team1.getByTestId('accept-consent').check();
    await team1.getByTestId('accept-submit').click();
    await expectSuccess(team1, 'รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที');
  });
  await test.step('10:15:01 ทีมที่ 1 กดจ่าย → หมดเวลา ประกาศกลับเป็น OPEN', async () => {
    await setClock(request, T('2026-10-09T10:15:01'));
    await team1.getByTestId('challenge-pay-confirm').click();
    await expectError(team1, 'หมดเวลาชำระเงิน ประกาศกลับมาเปิดรับแล้ว');
    await open(team1, '/challenges');
    await expect(team1.getByTestId(`challenge-${id}`)).toHaveAttribute('data-status', 'OPEN');
  });
  const team2 = await newUserPage();
  await test.step('10:15:01 ทีมที่ 2 รับ แล้วจ่ายตอน 10:29:01 (14 นาที) → MATCHED', async () => {
    await open(team2, '/challenges');
    await team2.getByTestId(`challenge-accept-${id}`).click();
    await team2.getByTestId('accept-name').fill('ทีมจ่ายไว');
    await team2.getByTestId('accept-phone').fill(uniquePhone(3));
    await team2.getByTestId('accept-consent').check();
    await team2.getByTestId('accept-submit').click();
    await expectSuccess(team2, 'รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที');
    await setClock(request, T('2026-10-09T10:29:01'));
    await team2.getByTestId('challenge-pay-confirm').click();
    await expectSuccess(team2, 'ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย');
    await expect(team2.getByTestId(`challenge-${id}`)).toHaveAttribute('data-status', 'MATCHED');
  });
});

test('TC-STAFF-02 กด "ไม่มา" ได้เมื่อเลยเวลาเริ่ม ≥ 15 นาที (14 ไม่ได้ / 15 ได้) และไม่มาครั้งแรกยังจองได้', {
  tag: ['@STAFF', '@P1'],
  annotation: { type: 'expected', description: 'การจองวันนี้ A 11:00 · 11:14 กดไม่มา → "บันทึกไม่มาได้เมื่อเลยเวลาเริ่มอย่างน้อย 15 นาที" ยัง CONFIRMED · 11:15 → "บันทึกไม่มาแล้ว" NO_SHOW (ไม่ระงับ) · เบอร์เดิมจองใหม่ได้ 201' },
}, async ({ page, request, anonApi }) => {
  const phone = uniquePhone(3);
  let code = '';
  await test.step('ลูกค้าจองวันนี้ A 11:00 และจ่าย', async () => {
    code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-09', startHour: 11, phone, name: 'ทีมไม่มา' })).code;
    await payBooking(page.request, code);
    await staffLoginPage(page, 'staff');
  });
  await test.step('11:14 (เลย 14 นาที = 15 − 1) กด "ไม่มา" → ปฏิเสธ', async () => {
    await setClock(request, T('2026-10-09T11:14:00'));
    await open(page, `/staff?code=${code}`);
    await expect(page.getByTestId('staff-booking-code')).toHaveText(code);
    await page.getByTestId('staff-no-show').click();
    await expectError(page, 'บันทึกไม่มาได้เมื่อเลยเวลาเริ่มอย่างน้อย 15 นาที');
    await expect(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
  });
  await test.step('11:15 (เลย 15 นาที) กด "ไม่มา" → บันทึกได้', async () => {
    await setClock(request, T('2026-10-09T11:15:00'));
    await open(page, `/staff?code=${code}`);
    await page.getByTestId('staff-no-show').click();
    await expectSuccess(page, 'บันทึกไม่มาแล้ว');
    await expect(page.getByTestId('success-message')).not.toContainText('ระงับ');
    await expect(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'NO_SHOW');
  });
  await test.step('ไม่มาครั้งที่ 1 → เบอร์เดิมยังจองออนไลน์ได้', async () => {
    const r = await postJson(await anonApi(), '/api/bookings', { fieldId: 'B', date: '2026-10-10', startHour: 9, hours: 1, name: 'ทีมไม่มา', phone, consent: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
  });
});

test('TC-STAFF-03 ไม่มาครั้งที่ 2 ห่างครั้งแรก 30 วัน → ระงับ 30 วัน จองออนไลน์ไม่ได้', {
  tag: ['@STAFF', '@P1'],
  annotation: { type: 'expected', description: 'โจ้ไม่มาครั้งแรก 4 ต.ค. 19:15 · จอง 3 พ.ย. A 19:00 · 3 พ.ย. 19:15 กดไม่มา → "บันทึกไม่มาแล้ว ลูกค้าถูกระงับการจองออนไลน์ถึง 3 ธ.ค. 2026 19:15" · /my banned-notice, banned-until 2026-12-03T12:15:00Z · จองใหม่ → "เบอร์นี้ถูกระงับการจองออนไลน์ จองได้อีกครั้ง 3 ธ.ค. 2026 19:15"' },
}, async ({ page, request }) => {
  let code = '';
  await test.step('25 ต.ค. โจ้จอง A 3 พ.ย. 19:00 และจ่าย', async () => {
    await setClock(request, T('2026-10-25T10:00:00'));
    code = (await createBooking(page.request, { fieldId: 'A', date: '2026-11-03', startHour: 19, phone: SEED.joe.phone, name: SEED.joe.name })).code;
    await payBooking(page.request, code);
  });
  await test.step('3 พ.ย. 19:15 (ห่างครั้งแรก 30 วัน) พนักงานกด "ไม่มา" → ระงับถึง 3 ธ.ค. 19:15', async () => {
    await setClock(request, T('2026-11-03T19:15:00'));
    await staffLoginPage(page, 'staff');
    await open(page, `/staff?code=${code}`);
    await page.getByTestId('staff-no-show').click();
    await expectSuccess(page, 'บันทึกไม่มาแล้ว ลูกค้าถูกระงับการจองออนไลน์ถึง 3 ธ.ค. 2026 19:15');
  });
  await test.step('โจ้เข้าสู่ระบบ เห็นแจ้งระงับและวันที่จองได้อีกครั้ง', async () => {
    await loginCustomer(page.request, SEED.joe.phone, SEED.joe.password);
    await open(page, '/my');
    await expect(page.getByTestId('banned-notice')).toBeVisible();
    const until = await page.getByTestId('banned-until').getAttribute('data-value');
    expect(new Date(until ?? '').toISOString()).toBe('2026-12-03T12:15:00.000Z');
  });
  await test.step('โจ้จองออนไลน์ → ปฏิเสธ', async () => {
    await open(page, '/book/new?field=B&date=2026-11-05&start=10');
    await fillBookingForm(page, { name: SEED.joe.name, phone: SEED.joe.phone, consent: true });
    await page.getByTestId('book-submit').click();
    await expectError(page, 'เบอร์นี้ถูกระงับการจองออนไลน์ จองได้อีกครั้ง 3 ธ.ค. 2026 19:15');
    await expect(page).toHaveURL(/\/book\/new/);
  });
});

test('TC-STAFF-04 ไม่มาครั้งที่ 2 ห่างครั้งแรก 31 วัน → ไม่ระงับ', {
  tag: ['@STAFF', '@P1'],
  annotation: { type: 'expected', description: 'โจ้ไม่มาครั้งแรก 4 ต.ค. · จอง 4 พ.ย. A 19:00 · 4 พ.ย. 19:15 กดไม่มา → "บันทึกไม่มาแล้ว" (ไม่ระงับ) · /my ไม่มี banned-notice · โจ้จองใหม่ได้ → /pay' },
}, async ({ page, request }) => {
  let code = '';
  await test.step('25 ต.ค. โจ้จอง A 4 พ.ย. 19:00 และจ่าย', async () => {
    await setClock(request, T('2026-10-25T10:00:00'));
    code = (await createBooking(page.request, { fieldId: 'A', date: '2026-11-04', startHour: 19, phone: SEED.joe.phone, name: SEED.joe.name })).code;
    await payBooking(page.request, code);
  });
  await test.step('4 พ.ย. 19:15 (ห่างครั้งแรก 31 วัน) พนักงานกด "ไม่มา" → ไม่ระงับ', async () => {
    await setClock(request, T('2026-11-04T19:15:00'));
    await staffLoginPage(page, 'staff');
    await open(page, `/staff?code=${code}`);
    await page.getByTestId('staff-no-show').click();
    await expect(page.getByTestId('success-message')).toHaveText('บันทึกไม่มาแล้ว');
    await expect(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'NO_SHOW');
  });
  await test.step('โจ้เข้าสู่ระบบ ไม่มีแจ้งระงับ และจองใหม่ได้', async () => {
    await loginCustomer(page.request, SEED.joe.phone, SEED.joe.password);
    await open(page, '/my');
    await expect(page.getByTestId('my-name')).toBeVisible();
    await expect(page.getByTestId('banned-notice')).toHaveCount(0);
    await open(page, '/book/new?field=B&date=2026-11-06&start=10');
    await fillBookingForm(page, { name: SEED.joe.name, phone: SEED.joe.phone, consent: true });
    await page.getByTestId('book-submit').click();
    await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
  });
});

test('TC-CANCEL-05 ยกเลิกเมื่อเหลือ 1 นาที ได้แต่ไม่ได้เครดิต · เหลือ 0 นาที (ถึงเวลาเริ่ม) ยกเลิกไม่ได้ (A-22)', {
  tag: ['@CANCEL', '@P1'],
  annotation: { type: 'expected', description: 'การจองวันนี้ A และ B 12:00 จ่ายแล้ว · 11:59 (เหลือ 1 นาที) ยกเลิก A: ไม่มี cancel-booking-hint · preview 0 → "ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง" CANCELLED · 12:00 (เหลือ 0 นาที) B: cancel-booking-hint data-value CANCEL_TOO_LATE "ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น" · ขั้นยืนยัน preview 0 + cancel-confirm-reason CANCEL_TOO_LATE · ยืนยัน → error เดิม · API 409 CANCEL_TOO_LATE · ยัง CONFIRMED' },
}, async ({ page, request }) => {
  const phone = uniquePhone(3);
  let cA = '';
  let cB = '';
  await test.step('10:00 จองและจ่าย A และ B วันนี้ (ศ. 9 ต.ค.) 12:00', async () => {
    cA = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-09', startHour: 12, phone, name: 'ทีมนาทีสุดท้าย' })).code;
    await payBooking(page.request, cA);
    cB = (await createBooking(page.request, { fieldId: 'B', date: '2026-10-09', startHour: 12, phone, name: 'ทีมนาทีสุดท้าย' })).code;
    await payBooking(page.request, cB);
  });
  await test.step('11:59 (เหลือ 1 นาที) ยกเลิก A → ยกเลิกได้ ไม่ได้เครดิต', async () => {
    await setClock(request, T('2026-10-09T11:59:00'));
    await open(page, `/booking/${cA}`);
    await expect(page.getByTestId('cancel-booking-hint')).toHaveCount(0);
    await page.getByTestId('cancel-booking').click();
    await expect(page.getByTestId('cancel-credit-preview')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('cancel-confirm-reason')).toHaveCount(0);
    await page.getByTestId('cancel-confirm').click();
    await expectSuccess(page, 'ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง');
    await expect(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CANCELLED');
  });
  await test.step('12:00 (เหลือ 0 นาที = ถึงเวลาเริ่ม) B: เหตุผลแสดงก่อนกด และยกเลิกไม่ได้', async () => {
    await setClock(request, T('2026-10-09T12:00:00'));
    await open(page, `/booking/${cB}`);
    await expect(page.getByTestId('cancel-booking-hint')).toHaveAttribute('data-value', 'CANCEL_TOO_LATE');
    await expect(page.getByTestId('cancel-booking-hint')).toContainText(MSG_TOO_LATE);
    await page.getByTestId('cancel-booking').click();
    await expect(page.getByTestId('cancel-credit-preview')).toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('cancel-confirm-reason')).toHaveAttribute('data-value', 'CANCEL_TOO_LATE');
    await page.getByTestId('cancel-confirm').click();
    await expectError(page, MSG_TOO_LATE);
    expect((await getBooking(page.request, cB)).body.booking.status).toBe('CONFIRMED');
  });
  await test.step('API ยกเลิก B ตอน 12:00 → 409 CANCEL_TOO_LATE', async () => {
    const r = await postJson(page.request, `/api/bookings/${cB}/cancel`, {});
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect(r.body?.error?.code).toBe('CANCEL_TOO_LATE');
    expect(r.body?.error?.message).toBe(MSG_TOO_LATE);
    expect((await getBooking(page.request, cB)).body.booking.status).toBe('CONFIRMED');
  });
});

test('TC-CANCEL-07 เลื่อนระหว่างทีมรับคำท้ากำลังจ่าย → ปฏิเสธ · ครบ 15 นาทีพอดียังเลื่อนไม่ได้ · 15 นาที 1 วินาทีเลื่อนได้ (A-28)', {
  tag: ['@CANCEL', '@P1'],
  annotation: { type: 'expected', description: 'สมาชิกใหม่จอง A อา. 11 ต.ค. 09:00 (฿1,200 มัดจำ 600) ประกาศหาคู่แข่ง (ทีมรับจ่าย 600) · 10:00 ทีมอื่นกดรับ (AWAITING_PAYMENT) · reschedule-submit-hint data-value CHALLENGE_PENDING "มีทีมกำลังชำระเงินรับคำท้า เลื่อนการจองได้หลังชำระเสร็จหรือหมดเวลา 15 นาที" ไม่มี cancel-booking-hint · กดเลื่อนไป จ. 12 09:00 → error เดิม การจองไม่เปลี่ยน · 10:15:00 API เลื่อน → 409 CHALLENGE_PENDING · 10:15:01 คำท้ากลับเป็น OPEN → เลื่อนได้ "เลื่อนการจองแล้ว ได้รับส่วนต่างเป็นเครดิต ฿400" (฿800 − ฿1,200) · คำท้ายอดทีมรับใหม่ 400 (= 800 × 50%)' },
}, async ({ page, request, anonApi }) => {
  const ownerPhone = uniquePhone(3);
  let code = '';
  let id = 0;
  await test.step('10:00 สมาชิกใหม่จองและจ่าย A อา. 11 ต.ค. 09:00 แล้วประกาศหาคู่แข่ง', async () => {
    await registerCustomer(page.request, { name: 'เจ้าของรอทีมจ่าย', phone: ownerPhone });
    code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-11', startHour: 9, phone: ownerPhone, name: 'เจ้าของรอทีมจ่าย' })).code;
    const paid = await payBooking(page.request, code);
    expect(paid.amount).toBe(600);
    const c = await postJson(page.request, '/api/challenges', { code, teamName: 'ทีมรอจ่าย', level: 'BEGINNER' });
    expect(c.status, JSON.stringify(c.body)).toBeLessThan(300);
    expect(c.body.challenge.amount).toBe(600);
    id = c.body.challenge.id;
  });
  await test.step('10:00 ทีมอื่นกดรับคำท้า → AWAITING_PAYMENT (ยังไม่จ่าย)', async () => {
    const rival = await anonApi();
    const a = await postJson(rival, `/api/challenges/${id}/accept`, { name: 'ทีมจ่ายช้า', phone: uniquePhone(3), consent: true });
    expect(a.status, JSON.stringify(a.body)).toBeLessThan(300);
    expect(a.body.challenge.status).toBe('AWAITING_PAYMENT');
  });
  await test.step('หน้าเจ้าของ: เหตุผลเลื่อนไม่ได้ CHALLENGE_PENDING · ยกเลิกยังไม่ถูกปิด · กดเลื่อน → ปฏิเสธ', async () => {
    await open(page, `/booking/${code}`);
    await expect(page.getByTestId('challenge-status')).toHaveAttribute('data-value', 'AWAITING_PAYMENT');
    await expect(page.getByTestId('reschedule-submit-hint')).toHaveAttribute('data-value', 'CHALLENGE_PENDING');
    await expect(page.getByTestId('reschedule-submit-hint')).toContainText(MSG_PENDING);
    await expect(page.getByTestId('cancel-booking-hint')).toHaveCount(0);
    await page.getByTestId('reschedule-date').fill('2026-10-12');
    await page.getByTestId('reschedule-start').selectOption('9');
    await page.getByTestId('reschedule-submit').click();
    await expectError(page, MSG_PENDING);
    const bk = (await getBooking(page.request, code)).body.booking;
    expect(bk.date).toBe('2026-10-11');
    expect(bk.startHour).toBe(9);
  });
  await test.step('10:15:00 (ครบ 15 นาทีพอดี ทีมยังจ่ายทัน) API เลื่อน → 409 CHALLENGE_PENDING', async () => {
    await setClock(request, T('2026-10-09T10:15:00'));
    const r = await postJson(page.request, `/api/bookings/${code}/reschedule`, { date: '2026-10-12', startHour: 9 });
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect(r.body?.error?.code).toBe('CHALLENGE_PENDING');
    expect(r.body?.error?.message).toBe(MSG_PENDING);
  });
  await test.step('10:15:01 คำท้ากลับเป็น OPEN → เลื่อนไป จ. 12 09:00 ได้ คืนส่วนต่าง ฿400 · ยอดทีมรับใหม่ ฿400', async () => {
    await setClock(request, T('2026-10-09T10:15:01'));
    await open(page, `/booking/${code}`);
    await expect(page.getByTestId('challenge-status')).toHaveAttribute('data-value', 'OPEN');
    await expect(page.getByTestId('reschedule-submit-hint')).toHaveCount(0);
    await page.getByTestId('reschedule-date').fill('2026-10-12');
    await page.getByTestId('reschedule-start').selectOption('9');
    await page.getByTestId('reschedule-submit').click();
    await expectSuccess(page, 'เลื่อนการจองแล้ว ได้รับส่วนต่างเป็นเครดิต ฿400');
    const bk = (await getBooking(page.request, code)).body.booking;
    expect(bk.date).toBe('2026-10-12');
    expect(bk.startHour).toBe(9);
    expect(bk.challenge?.status).toBe('OPEN');
    expect(bk.challenge?.amount).toBe(400);
    await open(page, `/booking/${code}`);
    await expect(page.getByTestId('challenge-amount')).toHaveAttribute('data-value', '400');
  });
});

test('TC-TEAM-05 ทีมรับคำท้าจ่ายที่ครบ 15 นาทีพอดี → ทัน (MATCHED) · 15 นาที 1 วินาที → ไม่ทัน (A-23)', {
  tag: ['@TEAM', '@P1'],
  annotation: { type: 'expected', description: 'ต้นประกาศจาก LN-900001 (ทีมรับจ่าย ฿1,200 = ฿2,400 × 50%) · ทีมที่ 1 รับ 10:00:00 จ่าย 10:15:00 → "ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย" MATCHED · ต้นได้เครดิต CHALLENGE +1,200 (รวม 2,400) · ประกาศที่ 2 (B วันนี้ 19:00 ฿1,200 → ทีมรับ ฿600) ทีมที่ 2 รับ 10:15:00 จ่าย 10:30:01 → "หมดเวลาชำระเงิน ประกาศกลับมาเปิดรับแล้ว" ประกาศเป็น OPEN' },
}, async ({ page, request, newUserPage, anonApi }) => {
  let id1 = 0;
  let id2 = 0;
  let code2 = '';
  await test.step('ต้นประกาศหาคู่แข่งจาก LN-900001 → ทีมรับต้องจ่าย ฿1,200', async () => {
    await loginCustomer(page.request, SEED.ton.phone, SEED.ton.password);
    const c = await postJson(page.request, '/api/challenges', { code: 'LN-900001', teamName: 'ทีมต้น', level: 'BEGINNER' });
    expect(c.status, JSON.stringify(c.body)).toBeLessThan(300);
    expect(c.body.challenge.amount).toBe(1200);
    id1 = c.body.challenge.id;
  });
  const team1 = await newUserPage();
  await test.step('10:00:00 ทีมที่ 1 รับคำท้า', async () => {
    await open(team1, '/challenges');
    await team1.getByTestId(`challenge-accept-${id1}`).click();
    await team1.getByTestId('accept-name').fill('ทีมจ่ายนาทีสุดท้าย');
    await team1.getByTestId('accept-phone').fill(uniquePhone(3));
    await team1.getByTestId('accept-consent').check();
    await team1.getByTestId('accept-submit').click();
    await expectSuccess(team1, 'รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที');
    await expect(team1.getByTestId('challenge-pay-amount')).toHaveAttribute('data-value', '1200');
  });
  await test.step('10:15:00 (ครบ 15 นาทีพอดี) ทีมที่ 1 กดจ่าย → ทัน MATCHED', async () => {
    await setClock(request, T('2026-10-09T10:15:00'));
    await team1.getByTestId('challenge-pay-confirm').click();
    await expectSuccess(team1, 'ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย');
    await expect(team1.getByTestId(`challenge-${id1}`)).toHaveAttribute('data-status', 'MATCHED');
  });
  await test.step('ต้นได้เครดิต CHALLENGE +1,200 (เครดิตรวม 1,200 + 1,200 = 2,400)', async () => {
    const me = (await getJson(page.request, '/api/me')).body;
    expect(me.customer.creditBalance).toBe(2400);
    expect(me.creditEntries.filter((e: any) => e.reason === 'CHALLENGE').map((e: any) => e.amount)).toEqual([1200]);
  });
  await test.step('10:15:00 ลูกค้าอีกคนจองและจ่าย B วันนี้ 19:00 (฿1,200 จ่ายเต็ม) แล้วประกาศ → ทีมรับจ่าย ฿600', async () => {
    const owner2 = await anonApi();
    code2 = (await createBooking(owner2, { fieldId: 'B', date: '2026-10-09', startHour: 19, phone: uniquePhone(3), name: 'เจ้าของคนที่สอง' })).code;
    await payBooking(owner2, code2);
    const c = await postJson(owner2, '/api/challenges', { code: code2, teamName: 'ทีมสอง', level: 'ADVANCED' });
    expect(c.status, JSON.stringify(c.body)).toBeLessThan(300);
    expect(c.body.challenge.amount).toBe(600);
    id2 = c.body.challenge.id;
  });
  const team2 = await newUserPage();
  await test.step('10:15:00 ทีมที่ 2 รับคำท้า', async () => {
    await open(team2, '/challenges');
    await team2.getByTestId(`challenge-accept-${id2}`).click();
    await team2.getByTestId('accept-name').fill('ทีมจ่ายเกินเวลา');
    await team2.getByTestId('accept-phone').fill(uniquePhone(3));
    await team2.getByTestId('accept-consent').check();
    await team2.getByTestId('accept-submit').click();
    await expectSuccess(team2, 'รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที');
  });
  await test.step('10:30:01 (= 15 นาที + 1 วินาที) ทีมที่ 2 กดจ่าย → ไม่ทัน ประกาศกลับเป็น OPEN', async () => {
    await setClock(request, T('2026-10-09T10:30:01'));
    await team2.getByTestId('challenge-pay-confirm').click();
    await expectError(team2, 'หมดเวลาชำระเงิน ประกาศกลับมาเปิดรับแล้ว');
    await open(team2, '/challenges');
    await expect(team2.getByTestId(`challenge-${id2}`)).toHaveAttribute('data-status', 'OPEN');
    expect((await getJson(page.request, '/api/challenges')).body.challenges.find((c: any) => c.id === id2)?.status).toBe('OPEN');
  });
});

void getJson;
