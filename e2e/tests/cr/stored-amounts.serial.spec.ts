import { test, expect, open, uniquePhone, fillBookingForm, postJson, getBooking, payBooking, registerCustomer, resetData, setClock } from '../fixtures';
import { BASE_URL } from '../constants';
import { ann, sql, T } from '../v2-helpers';
import type { APIRequestContext } from '@playwright/test';

/**
 * ตาข่ายเสริม (ก): "ยอดที่เก็บลงฐานตอนสร้างการจอง = ยอดที่ลูกค้าเห็นบนใบเสนอราคา/หน้าจอ" ทุกช่อง
 * ช่องที่ตรวจ: ค่าสนาม (field_price) · ส่วนลด (discount) · ค่าเช่า (rental_price) · ยอดรวม (total_price) · จ่ายตอนนี้ (pay_now) · ค้างจ่ายหน้าสนาม (due_at_field) · จ่ายแล้ว (amount_paid = 0) · เครดิต (credit_used = 0)
 * 4 กรณี: (1) รอบปกติ (2) เย็นหลัง 1 พ.ย. = CR-05 (3) จองประจำคร่อม 1 พ.ย. (4) จองผ่านน้องบอล (mock)
 * ค่าที่คาดหวัง: "เท่ากับที่ใบเสนอราคาบอก" [D:BR-07/BR-11/BR-12 ยอดเดียวกันทุกช่องทาง · NFR-19] · ตัวเลขราคาจริงของ CR-05 [D:CR-05] docs/handover/CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05
 * project "serial" · นาฬิกา 25 ต.ค. 2569 10:00 เพื่อให้จองรอบหลัง 1 พ.ย. ได้ (หน้าต่างจอง 14 วัน) · reset ก่อนและหลังทุกข้อ
 * ห้ามแก้ test เดิม — ไฟล์นี้เป็นของใหม่ (CR-05 / ตาข่ายเสริม)
 */

test.beforeEach(async ({ request }) => { await resetData(request); await setClock(request, T('2026-10-25T10:00:00')); });
test.afterEach(async ({ request }) => { await resetData(request); });

const ANSWER = 'docs/handover/CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05';

type Stored = { fieldPrice: number; discount: number; rentalPrice: number; totalPrice: number; payNow: number; dueAtField: number; amountPaid: number; creditUsed: number };

/** [E sql] แถวที่เก็บจริงในตาราง bookings (อ่านอย่างเดียว) */
function storedRow(code: string): Stored {
  const r = sql(`select field_price||','||discount||','||rental_price||','||total_price||','||pay_now||','||due_at_field||','||amount_paid||','||credit_used from bookings where code='${code}'`);
  expect(r, `ไม่พบแถวการจอง ${code} ในฐาน`).not.toBe('');
  const [fieldPrice, discount, rentalPrice, totalPrice, payNow, dueAtField, amountPaid, creditUsed] = r.split(',').map(Number);
  return { fieldPrice, discount, rentalPrice, totalPrice, payNow, dueAtField, amountPaid, creditUsed };
}

/** ยอดตามใบเสนอราคา (รูปเดียวกับที่เก็บ) */
type Shown = { fieldPrice: number; discount: number; rentalPrice: number; totalPrice: number; payNow: number; dueAtField: number };
function expectStoredEqualsShown(label: string, code: string, shown: Shown) {
  const s = storedRow(code);
  expect.soft(s.fieldPrice, `${label} ค่าสนาม`).toBe(shown.fieldPrice);
  expect.soft(s.discount, `${label} ส่วนลด`).toBe(shown.discount);
  expect.soft(s.rentalPrice, `${label} ค่าเช่า`).toBe(shown.rentalPrice);
  expect.soft(s.totalPrice, `${label} ยอดรวม`).toBe(shown.totalPrice);
  expect.soft(s.payNow, `${label} จ่ายตอนนี้`).toBe(shown.payNow);
  expect.soft(s.dueAtField, `${label} ค้างจ่ายหน้าสนาม`).toBe(shown.dueAtField);
  expect.soft(s.amountPaid, `${label} จ่ายแล้ว (ยังไม่จ่าย = 0)`).toBe(0);
  expect.soft(s.creditUsed, `${label} เครดิตที่ใช้ (ไม่ใช้ = 0)`).toBe(0);
  // ยอดรวม = ค่าสนาม − ส่วนลด + ค่าเช่า · จ่ายตอนนี้ + หน้าสนาม = ยอดรวม (ไม่มีเงินหาย/งอก)
  expect.soft(s.totalPrice, `${label} total = field − discount + rental`).toBe(s.fieldPrice - s.discount + s.rentalPrice);
  expect.soft(s.payNow + s.dueAtField, `${label} payNow + dueAtField = total`).toBe(s.totalPrice);
}

/** อ่านตัวเลขจากแผงราคาบนหน้าจอ (data-value) หลังฟอร์มคำนวณเสร็จ */
async function readPricePanel(page: import('@playwright/test').Page): Promise<Shown & { plan: string }> {
  const v = async (id: string) => Number((await page.getByTestId(id).getAttribute('data-value')) ?? NaN);
  await expect(page.getByTestId('price-total')).toBeAttached();
  return {
    fieldPrice: await v('price-field'),
    discount: (await page.getByTestId('price-discount').count()) ? await v('price-discount') : 0,
    rentalPrice: (await page.getByTestId('price-rental').count()) ? await v('price-rental') : 0,
    totalPrice: await v('price-total'),
    payNow: await v('price-pay-now'),
    dueAtField: await v('price-due-at-field'),
    plan: (await page.getByTestId('price-plan').getAttribute('data-value')) ?? '',
  };
}

async function quoteApi(request: APIRequestContext, o: Record<string, unknown>): Promise<Shown> {
  const r = await postJson(request, '/api/quote', { hours: 1, ...o });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const q = r.body.quote;
  return { fieldPrice: q.fieldPrice, discount: q.discount, rentalPrice: q.rentalPrice, totalPrice: q.totalPrice, payNow: q.payNow, dueAtField: q.dueAtField };
}

test('STORED-01 รอบปกติ (A อ 27 ต.ค. 10:00 ×2 + เช่าเอี๊ยม): ยอดบนหน้าจอ = ใบเสนอราคา = ยอดที่เก็บลงฐาน ทุกช่อง', {
  tag: ['@STORED', '@P1'],
  annotation: ann({
    tc: 'STORED-01', level: 'P1', source: '[D] BR-07/BR-11/BR-12 (ค่าสนามกลางวัน มัดจำ 50%) · FR-05 ใบเสนอราคา · NFR-19 เงินเป็นจำนวนเต็มบาท · ตาข่ายเสริม (ก)',
    expected: 'A อ 27 ต.ค. 10:00 2 ชม. = ฿1,600 (800×2) + เช่าเอี๊ยม 2 ชุด · แผงราคา = /api/quote · กดจอง → bookings: field_price/discount/rental_price/total_price/pay_now/due_at_field ตรงกับที่แผงราคาเห็น · จ่ายตอนนี้ + หน้าสนาม = ยอดรวม · amount_paid 0 credit_used 0',
  }),
}, async ({ page, request }) => {
  const phone = uniquePhone(3);
  let shown!: Shown;
  await test.step('เปิดฟอร์มจอง A อ 27 ต.ค. 10:00 2 ชั่วโมง + เอี๊ยม 2 ชุด → อ่านแผงราคา', async () => {
    await open(page, '/book/new?field=A&date=2026-10-27&start=10');
    await fillBookingForm(page, { hours: 2, name: 'ตรวจยอดปกติ', phone, consent: true });
    await page.getByTestId('rental-BIB-qty').fill('2');
    await expect(page.getByTestId('price-rental')).not.toHaveAttribute('data-value', '0');
    await expect(page.getByTestId('price-field')).toHaveAttribute('data-value', '1600');
    shown = await readPricePanel(page);
    expect.soft(shown.fieldPrice).toBe(1600);
    expect.soft(shown.totalPrice).toBe(shown.fieldPrice - shown.discount + shown.rentalPrice);
  });
  await test.step('ใบเสนอราคา (API) ตัวเลขเดียวกับแผงราคาบนหน้าจอ', async () => {
    const q = await quoteApi(request, { fieldId: 'A', date: '2026-10-27', startHour: 10, hours: 2, rentals: { BIB: 2 } });
    expect.soft(q).toEqual({ fieldPrice: shown.fieldPrice, discount: shown.discount, rentalPrice: shown.rentalPrice, totalPrice: shown.totalPrice, payNow: shown.payNow, dueAtField: shown.dueAtField });
  });
  await test.step('กด "จอง" → ยอดที่เก็บลงฐานตรงกับแผงราคาทุกช่อง', async () => {
    await page.getByTestId('book-submit').click();
    await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
    const code = page.url().match(/LN-\d{6}/)![0];
    expectStoredEqualsShown('รอบปกติ', code, shown);
    const api = (await getBooking(request, code, phone)).body.booking;
    expect.soft(api.totalPrice, 'API อ่านกลับ total').toBe(shown.totalPrice);
    expect.soft(api.payNow, 'API อ่านกลับ payNow').toBe(shown.payNow);
    expect.soft(api.dueAtField, 'API อ่านกลับ dueAtField').toBe(shown.dueAtField);
  });
});

test('STORED-02 เย็นหลัง 1 พ.ย. (CR-05): A อ 3 พ.ย. 19:00 → จอง ฿1,300 มัดจำ ฿650 หน้าสนาม ฿650 ตรงกับแผงราคาและที่เก็บลงฐาน · ศ 6 พ.ย. จ่ายเต็ม ฿1,300', {
  tag: ['@STORED', '@CR-05', '@P1'],
  annotation: ann({
    tc: 'STORED-02', level: 'P1', source: `[D:CR-05] ${ANSWER} ข้อ 1–2 (เย็นสนาม A/B ฿1,300 ตั้งแต่ 1 พ.ย. · ใบที่สร้างหลังขึ้นระบบใช้ราคาใหม่ ยอดที่เก็บไม่เปลี่ยน) · BR-11 มัดจำ 50% · ศ/ส เย็นจ่ายเต็ม`,
    expected: 'A อ 3 พ.ย. 19:00: แผงราคา field 1300 total 1300 plan DEPOSIT_50 payNow 650 due 650 → bookings 1300/0/0/1300/650/650 amount_paid 0 · B ศ 6 พ.ย. 19:00 (API) 1300/1300/0 FULL_100 → bookings 1300/0/0/1300/1300/0',
  }),
}, async ({ page, request }) => {
  await test.step('A อ 3 พ.ย. 19:00 บนหน้าจอ: ฿1,300 มัดจำ ฿650 หน้าสนาม ฿650', async () => {
    const phone = uniquePhone(3);
    await open(page, '/book/new?field=A&date=2026-11-03&start=19');
    await fillBookingForm(page, { name: 'ตรวจยอดเย็น พ.ย.', phone, consent: true });
    await expect(page.getByTestId('price-field')).toHaveAttribute('data-value', '1300');
    const shown = await readPricePanel(page);
    expect.soft(shown).toMatchObject({ fieldPrice: 1300, totalPrice: 1300, plan: 'DEPOSIT_50', payNow: 650, dueAtField: 650 });
    const q = await quoteApi(request, { fieldId: 'A', date: '2026-11-03', startHour: 19 });
    expect.soft(q, 'ใบเสนอราคา API = แผงราคา').toEqual({ fieldPrice: shown.fieldPrice, discount: shown.discount, rentalPrice: shown.rentalPrice, totalPrice: shown.totalPrice, payNow: shown.payNow, dueAtField: shown.dueAtField });
    await page.getByTestId('book-submit').click();
    await expect(page).toHaveURL(/\/pay\/LN-\d{6}$/);
    expectStoredEqualsShown('A อ 3 พ.ย. 19:00', page.url().match(/LN-\d{6}/)![0], shown);
  });
  await test.step('B ศ 6 พ.ย. 19:00 (เย็นวันศุกร์จ่ายเต็ม): ใบเสนอราคา = ที่เก็บลงฐาน', async () => {
    const q = await quoteApi(request, { fieldId: 'B', date: '2026-11-06', startHour: 19 });
    expect.soft(q).toMatchObject({ fieldPrice: 1300, totalPrice: 1300, payNow: 1300, dueAtField: 0 });
    const r = await postJson(request, '/api/bookings', { fieldId: 'B', date: '2026-11-06', startHour: 19, hours: 1, name: 'ตรวจยอดศุกร์', phone: uniquePhone(3), consent: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expectStoredEqualsShown('B ศ 6 พ.ย. 19:00', r.body.booking.code, q);
    expect.soft(r.body.booking.payNow, 'คำตอบตอนสร้างบอกยอดเดียวกับที่เก็บ').toBe(q.payNow);
  });
});

test('STORED-03 จองประจำคร่อม 1 พ.ย. (4 สัปดาห์ พุธ 28 ต.ค.–18 พ.ย. 19:00): ทุกสัปดาห์ที่เก็บลงฐาน = ตัวอย่างราคา (preview) · 28 ต.ค. ฿1,200 · สัปดาห์หลัง ฿1,300', {
  tag: ['@STORED', '@CR-05', '@P1'],
  annotation: ann({
    tc: 'STORED-03', level: 'P1', source: `[D:CR-05] ${ANSWER} (แต่ละสัปดาห์คิดตามวันเล่น) · BR-18–BR-21 จองประจำ ส่วนลดตามจำนวนสัปดาห์ จ่ายรวม · FR-15/16`,
    expected: 'สมาชิก · preview 4 สัปดาห์: 28 ต.ค. fieldPrice 1200 · 4/11/18 พ.ย. fieldPrice 1300 · create → bookings 4 แถวใน series_id เดียวกัน field_price/discount/total_price/pay_now/due_at_field แต่ละสัปดาห์ตรง preview.weeks · ผลรวม pay_now = preview.totals.payNow = create.payNow',
  }),
}, async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  try {
    const phone = uniquePhone(3);
    await test.step('สมัครสมาชิก (ได้ cookie เข้าสู่ระบบ)', async () => {
      await registerCustomer(ctx, { name: 'สมาชิกจองประจำ', phone });
    });
    const body = { fieldId: 'A', startDate: '2026-10-28', startHour: 19, hours: 1, weeks: 4 };
    let preview!: any;
    await test.step('ตัวอย่างราคา: 28 ต.ค. ฿1,200 · สัปดาห์หลัง 1 พ.ย. ฿1,300', async () => {
      const r = await postJson(ctx, '/api/series/preview', body);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      preview = r.body.preview;
      const fp = preview.weeks.map((w: any) => w.fieldPrice);
      expect.soft(fp, 'ราคาค่าสนามรายสัปดาห์ (ก่อน/หลังวันมีผล)').toEqual([1200, 1300, 1300, 1300]);
      expect.soft(preview.weeksBooked).toBe(4);
    });
    let created!: any;
    await test.step('สร้างจองประจำ', async () => {
      const r = await postJson(ctx, '/api/series', { ...body, consent: true });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      created = r.body;
      expect(created.codes).toHaveLength(4);
    });
    await test.step('ทุกสัปดาห์: ยอดที่เก็บลงฐาน = ตัวอย่างราคา (ค่าสนาม ส่วนลด ยอดรวม จ่ายตอนนี้ หน้าสนาม)', async () => {
      for (const w of preview.weeks) {
        const code = sql(`select code from bookings where series_id=${created.seriesId} and date='${w.date}'`);
        expect(code, `สัปดาห์ ${w.date} ต้องมีการจองในซีรีส์`).not.toBe('');
        expectStoredEqualsShown(`สัปดาห์ ${w.date}`, code, { fieldPrice: w.fieldPrice, discount: w.discount, rentalPrice: 0, totalPrice: w.totalPrice, payNow: w.payNow, dueAtField: w.dueAtField });
      }
    });
    await test.step('ผลรวมจ่ายตอนนี้: ในฐาน = ตัวอย่าง (totals.payNow) = ที่ตอบตอนสร้าง · ส่วนลดรวมตรงกัน', async () => {
      const sumPayNow = Number(sql(`select sum(pay_now) from bookings where series_id=${created.seriesId}`));
      const sumDiscount = Number(sql(`select sum(discount) from bookings where series_id=${created.seriesId}`));
      expect.soft(sumPayNow, 'sum(pay_now) ในฐาน').toBe(preview.totals.payNow);
      expect.soft(created.payNow, 'create.payNow').toBe(preview.totals.payNow);
      expect.soft(sumDiscount, 'sum(discount) ในฐาน').toBe(preview.totals.discount);
    });
    await test.step('จ่ายรวมทั้งซีรีส์ → จำนวนที่จ่ายจริง = ตัวอย่างราคา (BR-20)', async () => {
      const paid = await payBooking(ctx, created.codes[0]);
      expect.soft(paid.amount, 'amount ที่จ่ายรวม').toBe(preview.totals.payNow);
      const sumPaid = Number(sql(`select sum(amount_paid) from bookings where series_id=${created.seriesId}`));
      expect.soft(sumPaid, 'sum(amount_paid) ในฐาน').toBe(preview.totals.payNow);
    });
  } finally {
    await ctx.dispose();
  }
});

test('STORED-04 จองผ่านน้องบอล (mock): การ์ดยืนยัน = ใบเสนอราคา (/api/quote) = ยอดที่เก็บลงฐาน · A อ 3 พ.ย. 19:00 ฿1,300 มัดจำ ฿650', {
  tag: ['@STORED', '@CR-05', '@P1'],
  annotation: ann({
    tc: 'STORED-04', level: 'P1', source: `[D:CR-05] ${ANSWER} + BR-30 (แชทบอกราคาเดียวกับเว็บ) · ADR-17 (จองผ่านแชทใช้ createBooking เดียวกัน ผู้ทำ BOT) · FR-34`,
    expected: 'ห้องแชทใหม่: จอง A 2026-11-03 19:00 1 ชม. → ชื่อ → เบอร์ → ยินยอม → การ์ดยืนยัน fieldPrice 1300 totalPrice 1300 payNow 650 dueAtField 650 = /api/quote · ยืนยัน (ติ๊กยินยอม) → bookings 1300/0/0/1300/650/650 amount_paid 0 · history ผู้ทำ BOT',
  }),
}, async ({ playwright, request }) => {
  const ip = `10.251.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  const room = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
  try {
    const phone = uniquePhone(3);
    const send = async (text: string) => {
      const r = await postJson(room, '/api/chat', { text });
      expect(r.status, `POST /api/chat "${text}" → ${JSON.stringify(r.body)}`).toBe(200);
      return { reply: String(r.body.reply ?? ''), cards: (r.body.cards ?? []) as Record<string, any>[] };
    };
    let card!: Record<string, any>;
    await test.step('คุยกับน้องบอล: จอง A 3 พ.ย. 19:00 → ชื่อ → เบอร์ → ยินยอม → ได้การ์ดยืนยัน', async () => {
      await send('อยากจองสนาม A วันที่ 2026-11-03 19:00 1 ชั่วโมง');
      await send('ชื่อ ตรวจยอดแชท');
      await send(`เบอร์ ${phone}`);
      const t = await send('ยินยอม');
      card = t.cards.find((c) => c.draftToken)!;
      expect(card, `ต้องได้การ์ดยืนยัน: ${t.reply}`).toBeTruthy();
    });
    await test.step('การ์ดบอก ฿1,300 มัดจำ ฿650 หน้าสนาม ฿650 = ใบเสนอราคาของเว็บ', async () => {
      expect.soft(card).toMatchObject({ fieldPrice: 1300, totalPrice: 1300, payNow: 650, dueAtField: 650, paymentPlan: 'DEPOSIT_50' });
      const q = await quoteApi(request, { fieldId: 'A', date: '2026-11-03', startHour: 19 });
      expect.soft({ fieldPrice: card.fieldPrice, totalPrice: card.totalPrice, payNow: card.payNow, dueAtField: card.dueAtField }, 'การ์ดแชท = /api/quote').toEqual({
        fieldPrice: q.fieldPrice, totalPrice: q.totalPrice, payNow: q.payNow, dueAtField: q.dueAtField,
      });
    });
    await test.step('กดยืนยันการจอง (ติ๊กยินยอม) → ยอดที่เก็บลงฐาน = ยอดบนการ์ด · ผู้ทำ BOT', async () => {
      const r = await postJson(room, '/api/chat/book', { draftToken: card.draftToken, consent: true });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect.soft(r.body.payNow, 'คำตอบตอนจองบอกยอดเดียวกับการ์ด').toBe(card.payNow);
      expectStoredEqualsShown('จองผ่านแชท', r.body.code, { fieldPrice: card.fieldPrice, discount: 0, rentalPrice: 0, totalPrice: card.totalPrice, payNow: card.payNow, dueAtField: card.dueAtField });
      const actor = sql(`select h.actor from booking_status_history h join bookings b on b.id=h.booking_id where b.code='${r.body.code}' order by h.id limit 1`);
      expect.soft(actor, 'ผู้ทำรายการแรกในประวัติ').toBe('BOT');
    });
  } finally {
    await room.dispose();
  }
});
