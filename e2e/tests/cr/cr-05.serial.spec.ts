import type { APIRequestContext } from '@playwright/test';
import { test, expect, open, uniquePhone, createBooking, payBooking, getBooking, getJson, postJson, registerCustomer, loginCustomer, resetData, setClock } from '../fixtures';
import { BASE_URL, SEED } from '../constants';
import { ann, T } from '../v2-helpers';

/**
 * CR-05 ข้อที่ต้องเลื่อนเวลาไปใกล้/หลัง 1 พ.ย. 2569 (docs/handover/CHANGE-REQUESTS/CR-05.md · impact docs/impact/CR-05.md)
 * project "serial" (Chromium ทีละข้อ หลัง 3 เบราว์เซอร์จบ) · reset ก่อนและหลังทุกข้อ
 * หน้าต่างจอง 14 วันจากวันล็อก (9 ต.ค.) ไม่ถึง 1 พ.ย. → ตั้งนาฬิกา ส 25 ต.ค. 10:00 แล้วจอง 31 ต.ค. – 8 พ.ย. (จองประจำเริ่ม 28 ต.ค.)
 * ค่าที่คาดหวัง: [D:CR-05] = docs/handover/CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05 · [CR-05] = หนังสือ · [สมมติฐาน Qn] = docs/impact/CR-05.md ข้อ 1.2
 * วันที่ใช้: ส 31 ต.ค. · อา 1 พ.ย. (วันมีผล) · อ 3 พ.ย. · ศ 6 พ.ย. · ส 7 พ.ย. · พ 28 ต.ค. (จองประจำ)
 */

test.beforeEach(async ({ request }) => { await resetData(request); await setClock(request, T('2026-10-25T10:00:00')); });
test.afterEach(async ({ request }) => { await resetData(request); });

const ANSWER = 'docs/handover/CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05';

async function chatRoom(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }) {
  const ip = `10.250.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
  const send = async (text: string) => {
    const r = await postJson(ctx, '/api/chat', { text });
    expect(r.status, `POST /api/chat "${text}" → ${JSON.stringify(r.body)}`).toBe(200);
    return { reply: String(r.body.reply ?? ''), cards: (r.body.cards ?? []) as Record<string, any>[] };
  };
  return { send };
}

test('CR-05-S1 ใบเสนอราคา: รอบ 31 ต.ค. ฿1,200 · รอบ 1 พ.ย. ฿1,300 (มัดจำ ฿650) · คร่อม 17:00 คิดทีละชั่วโมง · กลางวันและสนาม C ไม่เปลี่ยน', {
  tag: ['@CR-05', '@P1'],
  annotation: ann({
    tc: 'CR-05-S1', level: 'P1', source: `[D:CR-05] ${ANSWER} ข้อ 1, 4 (คร่อม 17:00 · มัดจำ ฿650) · docs/handover/CHANGE-REQUESTS/CR-05.md ตาราง · [สมมติฐาน Q6] เสาร์ 09:00 หลัง 1 พ.ย. ฿1,300`,
    expected: 'วันนี้ 25 ต.ค. · A ส 31 ต.ค. 19:00 ฿1,200 (จ่ายเต็ม) · A อา 1 พ.ย. 19:00 ฿1,300 มัดจำ ฿650 หน้าสนาม ฿650 hourly[19]=1300 · A อ 3 พ.ย. 16:00 ×2 = ฿2,100 (hourly 800 + 1300) · A อ 3 พ.ย. 10:00 = ฿800 · B ส 7 พ.ย. 09:00 = ฿1,300 · ศ 6 พ.ย. A 19:00 ฿1,300 จ่ายเต็ม ฿1,300 · C อา 1 พ.ย. 19:00 ฿1,800 · C อ 3 พ.ย. 16:00 ฿1,200',
  }),
}, async ({ request }) => {
  const quote = async (o: Record<string, unknown>) => {
    const r = await postJson(request, '/api/quote', { hours: 1, ...o });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body.quote;
  };
  await test.step('A ส 31 ต.ค. 19:00 = ฿1,200 (ก่อนวันมีผล · เย็นวันเสาร์จ่ายเต็ม)', async () => {
    const q = await quote({ fieldId: 'A', date: '2026-10-31', startHour: 19 });
    expect.soft(q.fieldPrice).toBe(1200);
    expect.soft(q.payNow).toBe(1200);
  });
  await test.step('A อา 1 พ.ย. 19:00 = ฿1,300 · มัดจำ 50% = ฿650 · หน้าสนาม ฿650', async () => {
    const q = await quote({ fieldId: 'A', date: '2026-11-01', startHour: 19 });
    expect.soft(q.fieldPrice).toBe(1300);
    expect.soft(q.totalPrice).toBe(1300);
    expect.soft(q.paymentPlan).toBe('DEPOSIT_50');
    expect.soft(q.payNow).toBe(650);
    expect.soft(q.dueAtField).toBe(650);
    expect.soft(q.hourly).toEqual([{ hour: 19, rate: 1300 }]);
  });
  await test.step('A อ 3 พ.ย. 16:00 ×2 (คร่อม 17:00) = ฿2,100 = 800 + 1,300', async () => {
    const q = await quote({ fieldId: 'A', date: '2026-11-03', startHour: 16, hours: 2 });
    expect.soft(q.fieldPrice).toBe(2100);
    expect.soft(q.hourly).toEqual([{ hour: 16, rate: 800 }, { hour: 17, rate: 1300 }]);
  });
  await test.step('A อ 3 พ.ย. 10:00 = ฿800 (กลางวันไม่เปลี่ยน)', async () => {
    expect.soft((await quote({ fieldId: 'A', date: '2026-11-03', startHour: 10 })).fieldPrice).toBe(800);
  });
  await test.step('B ส 7 พ.ย. 09:00 = ฿1,300 (เสาร์ = ราคาเย็นทั้งวัน)', async () => {
    expect.soft((await quote({ fieldId: 'B', date: '2026-11-07', startHour: 9 })).fieldPrice).toBe(1300);
  });
  await test.step('A ศ 6 พ.ย. 19:00 = ฿1,300 จ่ายเต็ม ฿1,300 (เย็นวันศุกร์)', async () => {
    const q = await quote({ fieldId: 'A', date: '2026-11-06', startHour: 19 });
    expect.soft(q.fieldPrice).toBe(1300);
    expect.soft(q.paymentPlan).toBe('FULL_100');
    expect.soft(q.payNow).toBe(1300);
  });
  await test.step('สนาม C ไม่เปลี่ยน: อา 1 พ.ย. 19:00 ฿1,800 · อ 3 พ.ย. 16:00 ฿1,200', async () => {
    expect.soft((await quote({ fieldId: 'C', date: '2026-11-01', startHour: 19 })).fieldPrice).toBe(1800);
    expect.soft((await quote({ fieldId: 'C', date: '2026-11-03', startHour: 16 })).fieldPrice).toBe(1200);
  });
});

test('CR-05-S2 จองรอบหลัง 1 พ.ย. หลังขึ้นระบบ → เก็บยอดใหม่ ฿1,300 (มัดจำ ฿650 / จ่ายเต็ม ฿1,300) และยอดนั้นไม่เปลี่ยนเมื่อเวลาผ่าน 1 พ.ย. · การจองก่อน 1 พ.ย. ยัง ฿1,200 ทุกบาท', {
  tag: ['@CR-05', '@P1'],
  annotation: ann({
    tc: 'CR-05-S2', level: 'P1', source: `[D:CR-05] ${ANSWER} ข้อ 2 "การจองที่สร้างก่อนระบบใหม่ ยอดเดิมทุกบาท · ใบที่สร้างหลังขึ้นระบบใช้ราคาใหม่" · docs/handover/CHANGE-REQUESTS/CR-05.md "ห้ามเปลี่ยนยอด"`,
    expected: 'วันนี้ 25 ต.ค.: ก = A ส 31 ต.ค. 19:00 (฿1,200 จ่ายเต็ม) · ข = A อ 3 พ.ย. 19:00 (฿1,300 มัดจำ ฿650 หน้าสนาม ฿650) · ค = B ศ 6 พ.ย. 19:00 (฿1,300 จ่ายเต็ม) จ่ายทั้ง 3 · เลื่อนนาฬิกาเป็น 2 พ.ย. 10:00 → ก ยัง 1,200/1,200 · ข 1,300/650/650 · ค 1,300/1,300 (amountPaid เท่าเดิม)',
  }),
}, async ({ page, request }) => {
  const code: Record<string, string> = {};
  await test.step('ก = A ส 31 ต.ค. 19:00 → ฿1,200 (เก่า)', async () => {
    const phone = uniquePhone(0);
    const b = await createBooking(page.request, { fieldId: 'A', date: '2026-10-31', startHour: 19, phone, name: 'ก่อน 1 พ.ย.' });
    code.ก = b.code;
    expect.soft(b.fieldPrice).toBe(1200);
    expect.soft(b.totalPrice).toBe(1200);
    expect.soft(b.payNow).toBe(1200);
  });
  await test.step('ข = A อ 3 พ.ย. 19:00 → ฿1,300 มัดจำ ฿650', async () => {
    const b = await createBooking(page.request, { fieldId: 'A', date: '2026-11-03', startHour: 19, phone: uniquePhone(0), name: 'หลัง 1 พ.ย. มัดจำ' });
    code.ข = b.code;
    expect.soft(b.fieldPrice).toBe(1300);
    expect.soft(b.totalPrice).toBe(1300);
    expect.soft(b.payNow).toBe(650);
    expect.soft(b.dueAtField).toBe(650);
  });
  await test.step('ค = B ศ 6 พ.ย. 19:00 → ฿1,300 จ่ายเต็ม', async () => {
    const b = await createBooking(page.request, { fieldId: 'B', date: '2026-11-06', startHour: 19, phone: uniquePhone(0), name: 'หลัง 1 พ.ย. เต็ม' });
    code.ค = b.code;
    expect.soft(b.totalPrice).toBe(1300);
    expect.soft(b.payNow).toBe(1300);
  });
  const snapshot = async () => {
    const out: Record<string, [number, number, number]> = {};
    for (const k of ['ก', 'ข', 'ค']) {
      const bk = (await getBooking(page.request, code[k])).body.booking;
      out[k] = [bk.totalPrice, bk.amountPaid, bk.dueAtField];
    }
    return out;
  };
  await test.step('จ่ายทั้ง 3 ใบ', async () => {
    for (const k of ['ก', 'ข', 'ค']) await payBooking(page.request, code[k]);
    const s = await snapshot();
    expect.soft(s.ก).toEqual([1200, 1200, 0]);
    expect.soft(s.ข).toEqual([1300, 650, 650]);
    expect.soft(s.ค).toEqual([1300, 1300, 0]);
  });
  await test.step('นาฬิกาผ่าน 1 พ.ย. (2 พ.ย. 10:00) → ยอดที่เก็บไว้ไม่เปลี่ยนทุกบาท', async () => {
    await setClock(request, T('2026-11-02T10:00:00'));
    const s = await snapshot();
    expect.soft(s.ก, 'ก').toEqual([1200, 1200, 0]);
    expect.soft(s.ข, 'ข').toEqual([1300, 650, 650]);
    expect.soft(s.ค, 'ค').toEqual([1300, 1300, 0]);
  });
});

test('CR-05-S3 เลื่อนวัน: ใบเก่า ฿1,200 เลื่อนไปรอบหลัง 1 พ.ย. → คิดราคาใหม่ จ่ายส่วนต่าง ฿100 · ใบ ฿1,300 เลื่อนกลับมาก่อน 1 พ.ย. → ได้คืนเป็นเครดิต ฿100', {
  tag: ['@CR-05', '@P1'],
  annotation: ann({
    tc: 'CR-05-S3', level: 'P1', source: `[D:CR-05] ${ANSWER} ข้อ 3 "เลื่อนการจองเดิมไปรอบหลัง 1 พ.ย. → คิดราคาใหม่ตามกฎเลื่อนเดิม (แพงขึ้นจ่ายส่วนต่าง)" · [สมมติฐาน Q4] ขาลงคืนเครดิตตามกฎเดิม · BR-25 · A-06`,
    expected: 'วันนี้ 25 ต.ค. · ใบ A ส 31 ต.ค. 19:00 ฿1,200 จ่ายแล้ว → เลื่อนไป A อ 3 พ.ย. 19:00: oldTotal 1200 newTotal 1300 extraPay 100 creditBack 0 · ใบใหม่ A พ 4 พ.ย. 19:00 ฿1,300 จ่ายมัดจำ ฿650 → เลื่อนไป A พ 28 ต.ค. 19:00: newTotal 1200 extraPay 0 creditBack 100',
  }),
}, async ({ page }) => {
  await test.step('ใบเก่า ฿1,200 (31 ต.ค.) เลื่อนไป 3 พ.ย. → newTotal 1300 จ่ายเพิ่ม ฿100', async () => {
    const phone = uniquePhone(0);
    const b = await createBooking(page.request, { fieldId: 'A', date: '2026-10-31', startHour: 19, phone, name: 'เลื่อนขึ้น' });
    await payBooking(page.request, b.code);
    const r = await postJson(page.request, `/api/bookings/${b.code}/reschedule`, { date: '2026-11-03', startHour: 19 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect.soft(r.body.oldTotal).toBe(1200);
    expect.soft(r.body.newTotal).toBe(1300);
    expect.soft(r.body.extraPay).toBe(100);
    expect.soft(r.body.creditBack).toBe(0);
  });
  await test.step('ใบใหม่ ฿1,300 (4 พ.ย.) เลื่อนกลับ 28 ต.ค. → newTotal 1200 ได้คืนเครดิต ฿100', async () => {
    const phone = uniquePhone(0);
    const b = await createBooking(page.request, { fieldId: 'A', date: '2026-11-04', startHour: 19, phone, name: 'เลื่อนลง' });
    expect.soft(b.totalPrice).toBe(1300);
    await payBooking(page.request, b.code);
    const r = await postJson(page.request, `/api/bookings/${b.code}/reschedule`, { date: '2026-10-28', startHour: 19 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect.soft(r.body.oldTotal).toBe(1300);
    expect.soft(r.body.newTotal).toBe(1200);
    expect.soft(r.body.extraPay).toBe(0);
    expect.soft(r.body.creditBack).toBe(100);
  });
});

test('CR-05-S4 จองประจำข้าม 1 พ.ย.: แต่ละสัปดาห์คิดตามวันเตะ (28 ต.ค. ฿1,200 · หลังจากนั้น ฿1,300) · ลด 10% ของ ฿1,300 = ฿1,170', {
  tag: ['@CR-05', '@P1'],
  annotation: ann({
    tc: 'CR-05-S4', level: 'P1', source: `[D:CR-05] ${ANSWER} ข้อ 4 "จองประจำลด 10% = ฿1,170 ต่อชั่วโมงเย็น" · [สมมติฐาน Q3] ชุดใหม่คิดตามวันเตะของแต่ละสัปดาห์`,
    expected: 'สมาชิกใหม่ · พุธ A 19:00 ×1 ชม. 8 สัปดาห์ เริ่ม พ 28 ต.ค. → สัปดาห์ที่ 1 (28 ต.ค.) ค่าสนาม 1,200 ลด 120 = 1,080 · สัปดาห์ที่ 2–8 (4 พ.ย.–16 ธ.ค.) ค่าสนาม 1,300 ลด 130 = 1,170 · รวมค่าสนาม 10,300 ส่วนลด 1,030 ยอด 9,270 ลด 10% · สร้างจริง: การจองสัปดาห์ที่ 2 เก็บ 1,300/130/1,170 มัดจำ 585',
  }),
}, async ({ page }) => {
  const phone = uniquePhone(0);
  await registerCustomer(page.request, { name: 'สมาชิกจองประจำ CR-05', phone });
  const body = { fieldId: 'A', startDate: '2026-10-28', startHour: 19, hours: 1, weeks: 8 };
  await test.step('ดูตัวอย่างก่อนจอง: ราคาแต่ละสัปดาห์ตามวันเตะ + ส่วนลด 10%', async () => {
    const r = await postJson(page.request, '/api/series/preview', body);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const p = r.body.preview;
    expect.soft(p.discountPercent).toBe(10);
    expect.soft(p.weeks.map((w: any) => w.fieldPrice), 'ค่าสนามรายสัปดาห์').toEqual([1200, 1300, 1300, 1300, 1300, 1300, 1300, 1300]);
    expect.soft(p.weeks[0].discount).toBe(120);
    expect.soft(p.weeks[0].totalPrice).toBe(1080);
    expect.soft(p.weeks[1].discount).toBe(130);
    expect.soft(p.weeks[1].totalPrice, 'สัปดาห์หลัง 1 พ.ย. = 1,300 − 130').toBe(1170);
    expect.soft(p.weeks[1].payNow).toBe(585);
    expect.soft(p.totals).toMatchObject({ fieldPrice: 10300, discount: 1030, totalPrice: 9270 });
  });
  await test.step('สร้างชุดจริง → การจองสัปดาห์ที่ 2 (4 พ.ย.) เก็บยอด 1,300 / ลด 130 / 1,170', async () => {
    const r = await postJson(page.request, '/api/series', { ...body, consent: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const codes: string[] = r.body.codes;
    expect(codes).toHaveLength(8);
    const b0 = (await getBooking(page.request, codes[0])).body.booking;
    const b1 = (await getBooking(page.request, codes[1])).body.booking;
    expect.soft([b0.date, b0.fieldPrice, b0.discount, b0.totalPrice]).toEqual(['2026-10-28', 1200, 120, 1080]);
    expect.soft([b1.date, b1.fieldPrice, b1.discount, b1.totalPrice, b1.payNow]).toEqual(['2026-11-04', 1300, 130, 1170, 585]);
  });
});

test('CR-05-S5 ชั่วโมงฟรีใช้ก่อน 17:00 เท่านั้น: มูลค่า ฿800 ไม่เปลี่ยน · คร่อม 17:00 ใช้ชั่วโมงแรก → จ่าย ฿1,300', {
  tag: ['@CR-05', '@P2'],
  annotation: ann({
    tc: 'CR-05-S5', level: 'P2', source: `[D:CR-05] ${ANSWER} + docs/handover/CHANGE-REQUESTS/CR-05.md "ชั่วโมงฟรีใช้ก่อน 17:00 เท่านั้น" · BR-17 · มิว (seed) มีสิทธิ์ชั่วโมงฟรี`,
    expected: 'มิว: A อ 3 พ.ย. 16:00 ×2 ใช้ชั่วโมงฟรี → freeHourValue 800 ค่าสนาม 2,100 ยอด 1,300 · A อ 3 พ.ย. 17:00 ×1 ใช้ชั่วโมงฟรี → ปฏิเสธ FREE_HOUR_NOT_ELIGIBLE',
  }),
}, async ({ page }) => {
  await loginCustomer(page.request, SEED.mew.phone, SEED.mew.password);
  await test.step('A อ 3 พ.ย. 16:00 ×2 + ชั่วโมงฟรี → ฟรี ฿800 (ไม่ใช่ ฿1,300) ยอด ฿1,300', async () => {
    const r = await postJson(page.request, '/api/quote', { fieldId: 'A', date: '2026-11-03', startHour: 16, hours: 2, useFreeHour: true });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect.soft(r.body.quote.fieldPrice).toBe(2100);
    expect.soft(r.body.quote.freeHourValue).toBe(800);
    expect.soft(r.body.quote.totalPrice).toBe(1300);
  });
  await test.step('A อ 3 พ.ย. 17:00 + ชั่วโมงฟรี → ปฏิเสธ (หลัง 17:00 ใช้ไม่ได้)', async () => {
    const r = await postJson(page.request, '/api/quote', { fieldId: 'A', date: '2026-11-03', startHour: 17, hours: 1, useFreeHour: true });
    expect.soft(r.status).toBe(400);
    expect.soft(r.body?.error?.code).toBe('FREE_HOUR_NOT_ELIGIBLE');
  });
});

test('CR-05-S6 น้องบอลบอกราคาเดียวกับเว็บ: ถามราคา A 1 พ.ย. 19:00 → ใบเสนอราคา ฿1,300 มัดจำ ฿650 · ไม่ถูก price guard ตัด · ตรงกับ /api/quote', {
  tag: ['@CR-05', '@P1'],
  annotation: ann({
    tc: 'CR-05-S6', level: 'P1', source: `[D:CR-05] ${ANSWER} + หนังสือ "แชทบอท ใบเสนอราคา ต้องบอกราคาเดียวกัน" · BR-30`,
    expected: 'ห้องแชทใหม่: "สนาม A วันที่ 2026-11-01 19:00 1 ชั่วโมง ราคาเท่าไร" → การ์ด quote fieldPrice 1300 payNow 650 ข้อความมี ฿1,300 ฿650 · /api/quote วันเดียวกัน fieldPrice 1300 · "สนาม A ราคาเท่าไร" บอก ฿1,300 ตั้งแต่ 1 พ.ย.',
  }),
}, async ({ playwright, request }) => {
  const room = await chatRoom(playwright);
  await test.step('ถามราคาผ่านแชท → การ์ดราคา ฿1,300', async () => {
    const t = await room.send('สนาม A วันที่ 2026-11-01 19:00 1 ชั่วโมง ราคาเท่าไร');
    expect.soft(t.cards[0]?.type).toBe('quote');
    expect.soft(t.cards[0]?.fieldPrice).toBe(1300);
    expect.soft(t.cards[0]?.payNow).toBe(650);
    expect.soft(t.reply).toContain('฿1,300');
    expect.soft(t.reply).toContain('฿650');
  });
  await test.step('เว็บ (API ใบเสนอราคา) วันเดียวกันได้ ฿1,300 เหมือนกัน', async () => {
    const r = await postJson(request, '/api/quote', { fieldId: 'A', date: '2026-11-01', startHour: 19, hours: 1 });
    expect.soft(r.body.quote.fieldPrice).toBe(1300);
  });
  await test.step('ถามราคาทั่วไปวันนี้ (25 ต.ค.) → ปัจจุบัน ฿1,200 + บอกล่วงหน้า ฿1,300 ตั้งแต่ 1 พ.ย.', async () => {
    const t = await (await chatRoom(playwright)).send('สนาม A ราคาเท่าไร');
    for (const s of ['฿1,200', '฿1,300', '1 พ.ย.']) expect.soft(t.reply, `ต้องมี ${s}`).toContain(s);
  });
});

test('CR-05-S7 หลังวันมีผล (2 พ.ย.): /api/fields หน้าสนาม หน้าแรก แชท บอก ฿1,300 เป็นราคาปัจจุบัน · ไม่มีบรรทัด "ตั้งแต่ 1 พ.ย." แล้ว', {
  tag: ['@CR-05', '@P1'],
  annotation: ann({
    tc: 'CR-05-S7', level: 'P1', source: `[D:CR-05] ${ANSWER} ข้อ 1 · [สมมติฐาน Q9] หลัง 1 พ.ย. แสดง ฿1,300 อย่างเดียว`,
    expected: 'นาฬิกา 2 พ.ย. 10:00 · /api/fields A, B eveningRate 1300 rateChanges [] · C 1800 · /fields field-evening-rate-A "฿1,300" data-value 1300 ไม่มี field-evening-rate-next-A · หน้าแรก การ์ด A มี ฿1,300 และไม่มี home-field-A-next-rate · แชท "สนาม A ราคาเท่าไร" มี ฿1,300 ไม่มี ฿1,200 ไม่มี "ตั้งแต่ 1 พ.ย."',
  }),
}, async ({ page, request, playwright }) => {
  await setClock(request, T('2026-11-02T10:00:00'));
  await test.step('/api/fields: A, B เย็น ฿1,300 · ไม่มีราคาล่วงหน้าเหลือ', async () => {
    const r = await getJson(request, '/api/fields');
    const by = Object.fromEntries(r.body.fields.map((f: any) => [f.id, f]));
    for (const id of ['A', 'B']) {
      expect.soft(by[id]).toMatchObject({ dayRate: 800, eveningRate: 1300 });
      expect.soft(by[id].rateChanges).toEqual([]);
    }
    expect.soft(by.C).toMatchObject({ dayRate: 1200, eveningRate: 1800 });
  });
  await test.step('หน้าสนาม: ราคาเย็น A ฿1,300 ไม่มีแถวล่วงหน้า', async () => {
    await open(page, '/fields');
    await expect.soft(page.getByTestId('field-evening-rate-A')).toHaveText('฿1,300');
    await expect.soft(page.getByTestId('field-evening-rate-A')).toHaveAttribute('data-value', '1300');
    await expect.soft(page.getByTestId('field-evening-rate-next-A')).toHaveCount(0);
  });
  await test.step('หน้าแรก: การ์ด A มี ฿1,300 ไม่มีบรรทัดล่วงหน้า', async () => {
    await open(page, '/');
    await expect.soft(page.getByTestId('home-field-A')).toContainText('฿1,300');
    await expect.soft(page.getByTestId('home-field-A')).not.toContainText('฿1,200');
    await expect.soft(page.getByTestId('home-field-A-next-rate')).toHaveCount(0);
  });
  await test.step('แชทถามราคา → ฿1,300 อย่างเดียว', async () => {
    const t = await (await chatRoom(playwright)).send('สนาม A ราคาเท่าไร');
    expect.soft(t.reply).toContain('฿1,300');
    expect.soft(t.reply).not.toContain('฿1,200');
    expect.soft(t.reply).not.toContain('ตั้งแต่ 1 พ.ย.');
  });
});
