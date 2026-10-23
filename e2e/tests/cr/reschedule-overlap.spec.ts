import { test, expect, uniquePhone, createBooking, payBooking, postJson, getBooking } from '../fixtures';
import { RATE } from '../constants';
import { ann, sql, expectFree } from '../v2-helpers';

/**
 * ตาข่ายเสริม (ค): เลื่อนการจองไปช่วงที่ "ทับเวลาเดิมของตัวเอง" ได้ (โค้ดเรียก evaluateBooking ด้วย ignoreBookingId = ตัวมันเอง)
 * แต่ห้ามทับการจองของคนอื่น (BR-06 → 409 SLOT_TAKEN) และการปฏิเสธต้องไม่เปลี่ยนอะไรเลย
 * ที่มา: BR-25 "ช่วงใหม่ต้องผ่าน BR-02–BR-06" (ช่วงเดิมของตัวเองไม่นับว่าเป็นของคนอื่น) · BR-06 ต่อท้ายพอดีได้ ทับ 1 ชั่วโมงไม่ได้ · web/lib/server/bookings.ts rescheduleBooking → evaluateBooking(ignoreBookingId)
 * วันที่ใช้: จ 19 ต.ค. 2569 (วันล็อก 9 ต.ค. → เหลือ > 24 ชม. ตาม BR-25) · แยกสนามต่อเบราว์เซอร์ (A/B/C) · แต่ละข้อใช้ช่วงเวลาไม่ซ้อนกัน
 * ข้อมูลไม่ชนข้อมูลของ test อื่น (ตรวจ expectFree ก่อนเริ่ม) · ไม่ reset
 */

const DATE = '2026-10-19';
const REF = 'docs/handover/CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05 ข้อ 3 (คิดราคาใหม่ตามกฎเลื่อนเดิม) · docs/04-REQUIREMENTS.md BR-25, BR-06 · web/lib/server/bookings.ts rescheduleBooking (ignoreBookingId)';

/** สถานะที่เก็บจริงของการจองหนึ่งใบ [E sql] */
function row(code: string) {
  const [date, startHour, hours, total, paid, count, status] = sql(
    `select to_char(date,'YYYY-MM-DD')||','||start_hour||','||hours||','||total_price||','||amount_paid||','||reschedule_count||','||status from bookings where code='${code}'`,
  ).split(',');
  return { date, startHour: Number(startHour), hours: Number(hours), total: Number(total), paid: Number(paid), count: Number(count), status };
}
/** แถวการจองที่ยังกันสนามบนสนาม/วันนั้น: [startHour, hours] เรียงตามเวลา (ตรวจว่าไม่มีสองใบทับกัน) */
function occupancy(field: string) {
  return sql(`select start_hour||'-'||(start_hour+hours) from bookings where field_id='${field}' and date='${DATE}' and status in ('PENDING_PAYMENT','CONFIRMED','CHECKED_IN','NO_SHOW') order by start_hour`).split('\n').filter(Boolean);
}

async function paidBooking(request: Parameters<typeof createBooking>[0], field: 'A' | 'B' | 'C', startHour: number, hours: number, tag: string, b: number) {
  const phone = uniquePhone(b);
  const bk = await createBooking(request, { fieldId: field, date: DATE, startHour, hours, phone, name: tag });
  await payBooking(request, bk.code, phone);
  return { code: bk.code as string, phone, total: bk.totalPrice as number };
}

test.describe('เลื่อนการจอง: ทับเวลาเดิมของตัวเอง ได้ · ทับคนอื่น ไม่ได้', () => {
  test('RESCH-OVL-01 เลื่อนต่อไปอีก 1 ชั่วโมงทั้งที่ช่วงใหม่ทับช่วงเดิมของตัวเอง (08:00–10:00 → 09:00–11:00) → เลื่อนได้ ราคาเท่าเดิม ไม่มีส่วนต่าง', {
    tag: ['@RESCH', '@CR-05', '@P1'],
    annotation: ann({
      tc: 'RESCH-OVL-01', level: 'P1', source: REF,
      expected: 'จ่ายแล้ว 2 ชม. 08:00 (กลางวัน) → เลื่อนเป็น 09:00 → 200 oldTotal = newTotal extraPay 0 creditBack 0 · ฐาน: start_hour 9 hours 2 reschedule_count 1 สถานะ CONFIRMED amount_paid เท่าเดิม · ช่วงที่กันสนามมีแถวเดียว 9-11 (08:00 ว่างแล้ว)',
    }),
  }, async ({ request, pick, b }) => {
    const field = pick(['A', 'B', 'C'] as const);
    expectFree(field, DATE, 8, 11);
    const bk = await paidBooking(request, field, 8, 2, 'เลื่อนทับตัวเอง 1', b);
    const before = row(bk.code);
    await test.step('เลื่อนไป 09:00–11:00 (ทับ 09:00–10:00 ของตัวเอง) → สำเร็จ ไม่มีส่วนต่าง', async () => {
      const r = await postJson(request, `/api/bookings/${bk.code}/reschedule`, { date: DATE, startHour: 9, phone: bk.phone });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect.soft(r.body.newTotal).toBe(r.body.oldTotal);
      expect.soft(r.body.extraPay).toBe(0);
      expect.soft(r.body.creditBack).toBe(0);
      expect.soft(r.body.booking.startHour).toBe(9);
    });
    await test.step('ฐานข้อมูล: เวลาใหม่ 9 ชั่วโมงเท่าเดิม นับเลื่อน 1 ครั้ง ยอดเงินไม่เปลี่ยน', async () => {
      const after = row(bk.code);
      expect.soft(after).toEqual({ ...before, startHour: 9, count: 1 });
      expect.soft(occupancy(field).filter((o) => /^(8|9|10)-/.test(o)), 'สนามกันไว้ช่วงเดียว').toEqual(['9-11']);
    });
  });

  test('RESCH-OVL-02 เลื่อนขึ้นเวลาที่ทับช่วงเดิมของตัวเอง (12:00–14:00 → 11:00–13:00) → เลื่อนได้ · เลื่อนครั้งที่ 2 ยังโดนห้าม (ครบ 1 ครั้ง)', {
    tag: ['@RESCH', '@CR-05', '@P1'],
    annotation: ann({
      tc: 'RESCH-OVL-02', level: 'P1', source: `${REF} · BR-25 เลื่อนได้ 1 ครั้งต่อการจอง (RESCHEDULE_LIMIT 409)`,
      expected: '12:00–14:00 → 11:00–13:00 (ทับ 12:00–13:00 ของตัวเอง) 200 ไม่มีส่วนต่าง · ฐาน start_hour 11 · เลื่อนอีกครั้งไป 10:00 → 409 RESCHEDULE_LIMIT ฐานไม่เปลี่ยน',
    }),
  }, async ({ request, pick, b }) => {
    const field = pick(['A', 'B', 'C'] as const);
    expectFree(field, DATE, 11, 14);
    const bk = await paidBooking(request, field, 12, 2, 'เลื่อนทับตัวเอง 2', b);
    await test.step('เลื่อนไป 11:00–13:00 → สำเร็จ', async () => {
      const r = await postJson(request, `/api/bookings/${bk.code}/reschedule`, { date: DATE, startHour: 11, phone: bk.phone });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect.soft(r.body.extraPay + r.body.creditBack).toBe(0);
      expect.soft(row(bk.code)).toMatchObject({ startHour: 11, hours: 2, count: 1, status: 'CONFIRMED' });
    });
    await test.step('เลื่อนครั้งที่ 2 → 409 RESCHEDULE_LIMIT · ฐานไม่เปลี่ยน', async () => {
      const snap = row(bk.code);
      const r = await postJson(request, `/api/bookings/${bk.code}/reschedule`, { date: DATE, startHour: 10, phone: bk.phone });
      expect.soft(r.status).toBe(409);
      expect.soft(r.body?.error?.code).toBe('RESCHEDULE_LIMIT');
      expect.soft(row(bk.code)).toEqual(snap);
    });
  });

  test('RESCH-OVL-03 เย็น 3 ชั่วโมง (19:00–22:00 → 20:00–23:00 ทับ 2 ชม. ของตัวเอง) → เลื่อนได้ ราคาเย็นเท่าเดิม · เลื่อนไป "เท่าเดิมเป๊ะ" ยังโดน RESCHEDULE_SAME', {
    tag: ['@RESCH', '@CR-05', '@P1'],
    annotation: ann({
      tc: 'RESCH-OVL-03', level: 'P1', source: `${REF} · RESCHEDULE_SAME 400 (ต้องเลือกวัน/เวลาที่ต่างจากเดิม)`,
      expected: 'จอง 19:00 ×3 (เย็น ×3 = 3×เรทเย็น) · เลื่อนไป 19:00 เท่าเดิม → 400 RESCHEDULE_SAME ฐานไม่เปลี่ยน · เลื่อนไป 20:00–23:00 → 200 ส่วนต่าง 0 · ฐาน start_hour 20 total_price เท่าเดิม',
    }),
  }, async ({ request, pick, b }) => {
    const field = pick(['A', 'B', 'C'] as const);
    expectFree(field, DATE, 19, 23);
    const bk = await paidBooking(request, field, 19, 3, 'เลื่อนทับตัวเอง 3', b);
    expect(bk.total, 'ยอดเย็น 3 ชม. = 3 × เรทเย็น').toBe(3 * RATE[field].evening);
    await test.step('เลื่อนไปเวลาเดิมเป๊ะ → 400 RESCHEDULE_SAME ไม่เปลี่ยนอะไร', async () => {
      const snap = row(bk.code);
      const r = await postJson(request, `/api/bookings/${bk.code}/reschedule`, { date: DATE, startHour: 19, phone: bk.phone });
      expect.soft(r.status).toBe(400);
      expect.soft(r.body?.error?.code).toBe('RESCHEDULE_SAME');
      expect.soft(row(bk.code)).toEqual(snap);
    });
    await test.step('เลื่อนไป 20:00–23:00 (ทับ 20:00–22:00 ของตัวเอง) → สำเร็จ ราคาเท่าเดิม', async () => {
      const r = await postJson(request, `/api/bookings/${bk.code}/reschedule`, { date: DATE, startHour: 20, phone: bk.phone });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect.soft(r.body.extraPay + r.body.creditBack).toBe(0);
      expect.soft(row(bk.code)).toMatchObject({ startHour: 20, hours: 3, total: bk.total, count: 1 });
    });
  });

  test('RESCH-OVL-04 ทับการจองของคนอื่น → 409 SLOT_TAKEN และไม่เปลี่ยนอะไรเลย · ต่อท้ายคนอื่นพอดี (แม้ทับของตัวเอง) ได้', {
    tag: ['@RESCH', '@CR-05', '@P1'],
    annotation: ann({
      tc: 'RESCH-OVL-04', level: 'P1', source: `${REF} · BR-06 (A 19:00–21:00 มีแล้ว: เริ่ม 20:00 ไม่ได้ · ต่อท้าย/ก่อนหน้าพอดี ได้) · การจองที่รอจ่ายก็กันสนาม`,
      expected: 'ของฉัน 14:00–16:00 (จ่ายแล้ว) · ของคนอื่น 17:00–19:00 (ยังไม่จ่าย PENDING_PAYMENT) · เลื่อนฉันไป 16:00–18:00 (ทับของคนอื่น 17:00) → 409 SLOT_TAKEN ฐานไม่เปลี่ยน ไม่มีเงินเข้า/เครดิตคืน · เลื่อนไป 15:00–17:00 (ทับของตัวเอง 15:00 และต่อท้ายหน้าของคนอื่นพอดี) → 200 · ของคนอื่นไม่ถูกแตะ',
    }),
  }, async ({ request, pick, b }) => {
    const field = pick(['A', 'B', 'C'] as const);
    expectFree(field, DATE, 14, 19);
    const mine = await paidBooking(request, field, 14, 2, 'ของฉัน', b);
    const otherPhone = uniquePhone(b);
    const other = await createBooking(request, { fieldId: field, date: DATE, startHour: 17, hours: 2, phone: otherPhone, name: 'ของคนอื่น' });
    expect(other.status).toBe('PENDING_PAYMENT');
    const otherBefore = row(other.code);
    const paymentsBefore = () => sql(`select count(*)||','||coalesce(sum(amount),0) from payments where booking_id in (select id from bookings where code in ('${mine.code}','${other.code}'))`);
    const credit = () => sql(`select credit_balance from customers where phone='${mine.phone}'`);
    const creditBefore = credit();
    await test.step('เลื่อนไป 16:00–18:00 (ทับ 17:00–18:00 ของคนอื่น) → 409 SLOT_TAKEN', async () => {
      const snap = row(mine.code);
      const pay = paymentsBefore();
      const r = await postJson(request, `/api/bookings/${mine.code}/reschedule`, { date: DATE, startHour: 16, phone: mine.phone });
      expect.soft(r.status).toBe(409);
      expect.soft(r.body?.error?.code).toBe('SLOT_TAKEN');
      expect.soft(row(mine.code), 'การจองของฉันไม่เปลี่ยน').toEqual(snap);
      expect.soft(paymentsBefore(), 'ไม่มีเงินเข้า/ออก').toBe(pay);
      expect.soft(credit(), 'ไม่มีเครดิตคืน').toBe(creditBefore);
    });
    await test.step('เลื่อนไป 15:00–17:00 (ทับของตัวเองแต่จบตรงเวลาที่คนอื่นเริ่มพอดี) → สำเร็จ', async () => {
      const r = await postJson(request, `/api/bookings/${mine.code}/reschedule`, { date: DATE, startHour: 15, phone: mine.phone });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect.soft(r.body.extraPay + r.body.creditBack, 'กลางวัน 2 ชม. ทั้งคู่ ราคาเท่าเดิม').toBe(0);
      expect.soft(row(mine.code)).toMatchObject({ startHour: 15, hours: 2, count: 1, status: 'CONFIRMED' });
    });
    await test.step('การจองของคนอื่นไม่ถูกแตะ · สนามไม่มีสองใบทับกัน', async () => {
      expect.soft(row(other.code)).toEqual(otherBefore);
      const occ = occupancy(field).filter((o) => /^(14|15|16|17|18)-/.test(o));
      expect.soft(occ).toEqual(['15-17', '17-19']);
      const view = await getBooking(request, other.code, otherPhone);
      expect.soft(view.body.booking.status).toBe('PENDING_PAYMENT');
    });
  });
});
