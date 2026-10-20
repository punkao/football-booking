import { test, expect, open, waitReady, uniquePhone, createBooking, payBooking, getBooking, getJson, postJson, registerCustomer, loginCustomer, resetData, setClock, expectError, expectSuccess, fillBookingForm, setCheckedStable, staffLoginPage, type Json } from './fixtures';
import { SEED } from './constants';
import { ann, sql, sqlNum, moneyByDay, softNum, num, staffLoginUi, memberLoginUi, outcome, T } from './v2-helpers';
import type { Locator, Page } from '@playwright/test';

/**
 * TC รอบ 2 ที่ต้อง reset — project "serial" (Chromium ทีละข้อ หลัง 3 เบราว์เซอร์จบ) · reset ก่อนและหลังทุกข้อ
 * อยู่ที่นี่เพราะ: (ก) 🕒 เลื่อนเวลา หรือ (ข) เฉลยเป็นตัวเลขจาก seed ตรง ๆ (คลัง/ขาย/แดชบอร์ด/รายงาน/เครดิตของต้น/ประวัติ seed)
 * ซึ่งถ้ารันพร้อม test อื่นจะถูกเปลี่ยนกลางทาง หรือ (ค) TC ที่ยิง API อย่างเดียว (TC-API-05, TC-DATA-02) — แผนหัวข้อ 6.4: รันครั้งเดียวนับให้ทุกเบราว์เซอร์
 * เฉลยมาจาก docs/TEST-CASES.md เท่านั้น (+ A-41–A-50 ที่แก้ลง TEST-CASES แล้ว) · SQL อ่านอย่างเดียวติดป้าย [E sql:<ชื่อ>]
 */
test.beforeEach(async ({ request }) => { await resetData(request); });
test.afterEach(async ({ request }) => { await resetData(request); });

const MOVE_OK = 'ย้ายของแล้ว';

/** เลือก option ที่ value หรือข้อความตรงกับคำใดคำหนึ่ง */
async function selectSmart(sel: Locator, ...want: string[]) {
  const opts = await sel.locator('option').evaluateAll((os) => os.map((o) => ({ v: (o as HTMLOptionElement).value, t: (o.textContent ?? '').trim() })));
  const hit = opts.find((o) => want.some((w) => o.v === w)) ?? opts.find((o) => want.some((w) => o.t.includes(w) || o.v.includes(w)));
  if (!hit) throw new Error(`ไม่มีตัวเลือก ${want.join('/')} ใน ${JSON.stringify(opts)}`);
  await sel.selectOption(hit.v);
}
const LOC = { STORE: ['STORE', 'ห้องเก็บของ'], COUNTER: ['COUNTER', 'เคาน์เตอร์'] } as const;

/** ฟอร์มย้าย/รับเข้า/ชำรุด (prefix = transfer | receive | damage) */
async function stockForm(page: Page, prefix: 'receive' | 'damage', o: { item: string; loc: 'STORE' | 'COUNTER'; qty: number; reason?: string }) {
  await selectSmart(page.getByTestId(`${prefix}-item`), o.item);
  await selectSmart(page.getByTestId(`${prefix}-location`), ...LOC[o.loc]);
  await page.getByTestId(`${prefix}-qty`).fill(String(o.qty));
  if (o.reason !== undefined) await page.getByTestId(`${prefix}-reason`).fill(o.reason);
  await page.getByTestId(`${prefix}-submit`).click();
}
async function transfer(page: Page, o: { item: string; from: 'STORE' | 'COUNTER'; to: 'STORE' | 'COUNTER'; qty: number }) {
  await open(page, '/staff/stock/transfer');
  await selectSmart(page.getByTestId('transfer-item'), o.item);
  await selectSmart(page.getByTestId('transfer-from'), ...LOC[o.from]);
  await selectSmart(page.getByTestId('transfer-to'), ...LOC[o.to]);
  await page.getByTestId('transfer-qty').fill(String(o.qty));
  await page.getByTestId('transfer-submit').click();
}
/** ขายหน้าเคาน์เตอร์ผ่านหน้าเว็บ · คืนยอด sale-total ก่อนกดบันทึก */
async function sell(page: Page, items: Record<string, number>, method?: 'CASH' | 'PROMPTPAY') {
  await open(page, '/staff/stock/sale');
  for (const [id, q] of Object.entries(items)) await page.getByTestId(`sale-qty-${id}`).fill(String(q));
  if (method) await page.getByTestId(`sale-method-${method}`).check();
  await waitReady(page);
  const total = await num(page.getByTestId('sale-total'));
  await page.getByTestId('sale-submit').click();
  return total;
}
/** คงเหลือบนหน้า /staff/stock */
async function levels(page: Page, id: string) {
  await open(page, '/staff/stock');
  return { store: await num(page.getByTestId(`stock-${id}-store`)), counter: await num(page.getByTestId(`stock-${id}-counter`)), total: await num(page.getByTestId(`stock-${id}-total`)) };
}
/** แถวประวัติคลังทั้งหมดบนหน้า /staff/stock */
async function movements(page: Page) {
  await open(page, '/staff/stock');
  return page.locator('[data-testid^="movement-"][data-type]').evaluateAll((rows) => rows.map((r) => {
    const id = (r.getAttribute('data-testid') ?? '').replace('movement-', '');
    const q = (s: string) => r.querySelector(`[data-testid="${s}-${id}"]`);
    return { id, type: r.getAttribute('data-type') ?? '', typeText: (q('movement-type')?.textContent ?? '').trim(), qty: q('movement-qty')?.getAttribute('data-value') ?? '', user: (q('movement-user')?.textContent ?? '').trim(), text: (r.textContent ?? '').replace(/\s+/g, ' ').trim() };
  }));
}
/** จองผ่านฟอร์มจนถึง /pay แล้วกดจ่าย · คืนรหัส */
async function bookAndPayUi(page: Page, o: { field: string; date: string; start: number; hours?: number; name: string; phone?: string; useCredit?: boolean; pay?: boolean }) {
  await open(page, `/book/new?field=${o.field}&date=${o.date}&start=${o.start}`);
  await fillBookingForm(page, { hours: o.hours, name: o.name, phone: o.phone, consent: true });
  if (o.useCredit) await setCheckedStable(page.getByTestId('use-credit'), true);
  await waitReady(page);
  await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', /\d/);
  await page.getByTestId('book-submit').click();
  await expect(page).toHaveURL(/\/(pay|booking)\/LN-\d{6}/);
  const code = page.url().match(/LN-\d{6}/)![0];
  if (o.pay !== false && /\/pay\//.test(page.url())) {
    await waitReady(page);
    await page.getByTestId('pay-confirm').click();
    await expect(page).toHaveURL(new RegExp(`/booking/${code}\\?done=paid`));
    await waitReady(page);
  }
  return code;
}
/** รอราคาในฟอร์มคิดเสร็จ */
async function priceReady(page: Page) {
  await waitReady(page);
  await expect(page.getByTestId('price-total')).toHaveAttribute('data-value', /\d/);
  await waitReady(page);
}
/** รายงานหลังบ้าน: กรอกช่วงแล้วกดดู */
async function report(page: Page, from: string, to: string) {
  await open(page, '/owner/reports');
  await page.getByTestId('report-from').fill(from);
  await page.getByTestId('report-to').fill(to);
  await page.getByTestId('report-submit').click();
  await waitReady(page);
}
/** แถว audit ทั้งหมดหลังกดค้น */
async function auditRows(page: Page) {
  await open(page, '/owner/audit');
  if (await page.getByTestId('audit-submit').count()) { await page.getByTestId('audit-submit').click(); await waitReady(page); }
  await expect(page.getByTestId('audit-table').or(page.getByTestId('audit-empty')).first()).toBeVisible();
  return page.locator('[data-testid^="audit-row-"]').evaluateAll((rows) => rows.map((r) => {
    const id = (r.getAttribute('data-testid') ?? '').replace('audit-row-', '');
    const q = (s: string) => r.querySelector(`[data-testid="${s}-${id}"]`);
    return { action: q('audit-action')?.getAttribute('data-value') ?? (q('audit-action')?.textContent ?? '').trim(), user: (q('audit-user')?.textContent ?? '').trim(), target: (q('audit-target')?.textContent ?? '').trim(), at: (q('audit-at')?.textContent ?? '').trim() };
  }));
}
/** CSV → แถว (รองรับ "…" ห่อ) */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); out.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); out.push(row); }
  return out.filter((r) => r.some((x) => x !== ''));
}

// ================================================================ BOOK / PRICE / PAY / CANCEL (🕒 และเครดิตของต้น)
test('TC-BOOK-10 ค่าขอบเวลาตาม TEST-DATA ทุกแถว E04–E21 (วันนี้ ศ 9 10:00)', {
  tag: ['@BOOK', '@P1'],
  annotation: ann({
    tc: 'TC-BOOK-10', level: 'P1', source: '[D] TEST-DATA E04–E21 · FR-03, BR-02–BR-06',
    expected: 'E04 ไม่มีรอบ 07 · E05/E06 มี · E07 08:30 ไม่มี (API INVALID_START_HOUR) · E08 INVALID_HOURS · E09 ฿800 · E10 ฿1,200 × 4 = ฿4,800 · E11 ENDS_AFTER_MIDNIGHT · E12 ฿800 · E13 ฿1,200 (23 ต.ค. วันหยุด) · E14 TOO_FAR_AHEAD · E15 ได้ ฿800 · E16 TOO_SOON "ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง" · E17 ได้ · E18 ได้ (ศุกร์ ≥17 FULL ฿1,200) · E19 SLOT_TAKEN "ช่วงเวลานี้ถูกจองแล้ว" · E20 ได้ · E21 ได้',
  }),
}, async ({ page, request }) => {
  const quote = (o: Json) => postJson(request, '/api/quote', { hours: 1, ...o });
  await test.step('E04–E07 ตาราง พ 14: ไม่มีรอบ 07 · มี 08, 23 · ไม่มี 24 · API 08:30 → INVALID_START_HOUR', async () => {
    await open(page, '/book?date=2026-10-14');
    await expect.soft(page.getByTestId('slot-A-7'), 'E04').toHaveCount(0);
    await expect.soft(page.getByTestId('slot-A-8'), 'E05').toHaveCount(1);
    await expect.soft(page.getByTestId('slot-A-23'), 'E06').toHaveCount(1);
    await expect.soft(page.getByTestId('slot-A-24')).toHaveCount(0);
    const r = await quote({ fieldId: 'A', date: '2026-10-14', startHour: 8.5 });
    expect.soft(r.status, 'E07 status').toBe(400);
    expect.soft(r.body?.error?.code, 'E07').toBe('INVALID_START_HOUR');
  });
  await test.step('E08–E11 ฟอร์ม A พ 14: 0 ชม. · 09×1 ฿800 · 20×4 ฿4,800 · 21×4 จบเกิน 24:00', async () => {
    const r0 = await quote({ fieldId: 'A', date: '2026-10-14', startHour: 9, hours: 0 });
    expect.soft(r0.body?.error?.code, 'E08').toBe('INVALID_HOURS');
    await open(page, '/book/new?field=A&date=2026-10-14&start=9');
    await fillBookingForm(page, { hours: 1 });
    await expect.soft(page.getByTestId('price-total'), 'E09').toHaveAttribute('data-value', '800');
    await open(page, '/book/new?field=A&date=2026-10-14&start=20');
    await fillBookingForm(page, { hours: 4 });
    await expect.soft(page.getByTestId('price-total'), 'E10').toHaveAttribute('data-value', '4800');
    await open(page, '/book/new?field=A&date=2026-10-14&start=21');
    await fillBookingForm(page, { hours: 4 });
    await expect.soft(page.getByTestId('book-submit-hint'), 'E11 hint').toContainText('การจองต้องจบไม่เกิน 24:00');
    const r = await quote({ fieldId: 'A', date: '2026-10-14', startHour: 21, hours: 4 });
    expect.soft(r.body?.error?.code, 'E11').toBe('ENDS_AFTER_MIDNIGHT');
  });
  await test.step('E12–E14 ฟอร์ม 22 / 23 (วันหยุด) / 24 ต.ค. 09:00', async () => {
    await open(page, '/book/new?field=A&date=2026-10-22&start=9');
    await expect.soft(page.getByTestId('price-total'), 'E12').toHaveAttribute('data-value', '800');
    await open(page, '/book/new?field=A&date=2026-10-23&start=9');
    await expect.soft(page.getByTestId('price-total'), 'E13').toHaveAttribute('data-value', '1200');
    const r = await quote({ fieldId: 'A', date: '2026-10-24', startHour: 9 });
    expect.soft(r.body?.error?.code, 'E14').toBe('TOO_FAR_AHEAD');
  });
  await test.step('E15–E21 ตารางวันนี้: A-10 past · A-11/12/18/21 free · A-19/20 booked · B-19 free · API ตามแถว', async () => {
    await open(page, '/book');
    for (const [s, st] of [['A-10', 'past'], ['A-11', 'free'], ['A-12', 'free'], ['A-18', 'free'], ['A-19', 'booked'], ['A-20', 'booked'], ['A-21', 'free'], ['B-19', 'free']] as const) {
      await expect.soft(page.getByTestId(`slot-${s}`), `slot-${s}`).toHaveAttribute('data-status', st);
    }
    const ok = async (row: string, o: Json, price: number, plan?: string) => {
      const r = await quote({ date: '2026-10-09', ...o });
      expect.soft(r.status, `${row} ${JSON.stringify(r.body?.error ?? '')}`).toBe(200);
      expect.soft(r.body?.quote?.totalPrice, `${row} ราคา`).toBe(price);
      if (plan) expect.soft(r.body?.quote?.paymentPlan, `${row} แผน`).toBe(plan);
    };
    await ok('E15', { fieldId: 'A', startHour: 11 }, 800);
    await ok('E17', { fieldId: 'A', startHour: 12 }, 800);
    await ok('E18', { fieldId: 'A', startHour: 18 }, 1200, 'FULL_100');
    await ok('E20', { fieldId: 'A', startHour: 21 }, 1200);
    await ok('E21', { fieldId: 'B', startHour: 19 }, 1200);
  });
  await test.step('E19 ฟอร์มวันนี้ A 20:00 กดยืนยัน → "ช่วงเวลานี้ถูกจองแล้ว"', async () => {
    await open(page, '/book/new?field=A&date=2026-10-09&start=20');
    await fillBookingForm(page, { name: 'ทีมชน', phone: uniquePhone(3), consent: true });
    await page.getByTestId('book-submit').click();
    await expectError(page, 'ช่วงเวลานี้ถูกจองแล้ว');
    const r = await quote({ fieldId: 'A', date: '2026-10-09', startHour: 20 });
    expect.soft(r.body?.error?.code, 'E19').toBe('SLOT_TAKEN');
  });
  await test.step('E16 clock 10:01 → ฟอร์มวันนี้ A 11:00 กดยืนยัน → TOO_SOON', async () => {
    await setClock(request, T('2026-10-09T10:01:00'));
    await open(page, '/book/new?field=A&date=2026-10-09&start=11');
    await fillBookingForm(page, { name: 'ทีมช้า', phone: uniquePhone(3), consent: true });
    await page.getByTestId('book-submit').click();
    await expectError(page, 'ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง');
    const r = await quote({ fieldId: 'A', date: '2026-10-09', startHour: 11 });
    expect.soft(r.body?.error?.code, 'E16').toBe('TOO_SOON');
  });
});

test('TC-PRICE-07 เครดิตของต้นกับยอด E45, E46 และขอบ ฿999/฿1,000/฿1,001 (E56–E58)', {
  tag: ['@PRICE', '@P1'],
  annotation: ann({
    tc: 'TC-PRICE-07', level: 'P1', source: '[D] TEST-DATA E45–E46, E56–E58 · E56 [D A-49] (เหลือ ฿1 รับได้ตามกฎปัดขึ้น) · FR-05, FR-12, BR-12, BR-15',
    expected: 'E45 price-credit 1,200 price-net 800 price-pay-now 400 price-due-at-field 400 · E56 creditUsed 999 → สุทธิ ฿1 จ่ายตอนนี้ ฿1 เก็บหน้าสนาม ฿0 · E57 1,000 → ฿0 · E58 1,001 → 400 CREDIT_EXCEEDS_TOTAL "ใช้เครดิตเกินยอดรวมไม่ได้" · E46 สุทธิ ฿0 → ยืนยัน → /booking/{code}?done=free "ยืนยันการจองแล้ว (ยอดที่ต้องจ่าย ฿0)" CONFIRMED เครดิตเหลือ 0',
  }),
}, async ({ page }) => {
  await test.step('ต้นเข้าสู่ระบบ /my', async () => { await memberLoginUi(page, SEED.ton.phone, SEED.ton.password); });
  await test.step('E45 ฟอร์ม A พ 14 16:00 × 2 ติ๊ก use-credit → เครดิต 1,200 สุทธิ 800 จ่าย 400 ค้าง 400', async () => {
    await open(page, '/book/new?field=A&date=2026-10-14&start=16');
    await fillBookingForm(page, { hours: 2 });
    await setCheckedStable(page.getByTestId('use-credit'), true);
    await waitReady(page);
    await expect.soft(page.getByTestId('price-total')).toHaveAttribute('data-value', '2000');
    await expect.soft(page.getByTestId('price-credit')).toHaveAttribute('data-value', /^-?1200$/);
    await expect.soft(page.getByTestId('price-net')).toHaveAttribute('data-value', '800');
    await expect.soft(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', '400');
    await expect.soft(page.getByTestId('price-due-at-field')).toHaveAttribute('data-value', '400');
  });
  // E56–E58 ทำก่อน E46 เพราะ E46 ใช้เครดิตของต้นหมด (TEST-CASES ขั้น 4 ก่อน 5 แต่ reset ครั้งเดียว — ถ้าทำตามลำดับ E56 จะไม่มีเครดิตให้ใช้)
  await test.step('E56–E58 API quote (cookie ต้น) A พ 14 09:00 + เอี๊ยม 4 (ยอด ฿1,000) creditUsed 999 / 1,000 / 1,001', async () => {
    const q = (c: number) => postJson(page.request, '/api/quote', { fieldId: 'A', date: '2026-10-14', startHour: 9, hours: 1, rentals: { BIB: 4 }, useCredit: true, creditUsed: c });
    const r1 = await q(999);
    expect.soft(r1.status, 'E56').toBe(200);
    expect.soft(r1.body?.quote?.totalPrice, 'E56 ยอดรวม').toBe(1000);
    expect.soft(r1.body?.quote?.netPrice, 'E56 สุทธิ').toBe(1);
    expect.soft(r1.body?.quote?.payNow, 'E56 จ่ายตอนนี้ (A-49)').toBe(1);
    expect.soft(r1.body?.quote?.dueAtField, 'E56 เก็บหน้าสนาม').toBe(0);
    const r2 = await q(1000);
    expect.soft(r2.status, 'E57').toBe(200);
    expect.soft(r2.body?.quote?.netPrice, 'E57 สุทธิ').toBe(0);
    const r3 = await q(1001);
    expect.soft(r3.status, 'E58').toBe(400);
    expect.soft(r3.body?.error?.code, 'E58').toBe('CREDIT_EXCEEDS_TOTAL');
    expect.soft(r3.body?.error?.message, 'E58').toBe('ใช้เครดิตเกินยอดรวมไม่ได้');
  });
  let code = '';
  await test.step('E46 ฟอร์ม A พ 14 17:00 × 1 ติ๊ก use-credit → สุทธิ ฿0 → ยืนยัน → done=free', async () => {
    await open(page, '/book/new?field=A&date=2026-10-14&start=17');
    await setCheckedStable(page.getByTestId('use-credit'), true);
    await setCheckedStable(page.getByTestId('pdpa-consent'), true);
    await waitReady(page);
    await expect.soft(page.getByTestId('price-net')).toHaveAttribute('data-value', '0');
    await expect.soft(page.getByTestId('price-pay-now')).toHaveAttribute('data-value', '0');
    await page.getByTestId('book-submit').click();
    await expect(page).toHaveURL(/\/booking\/LN-\d{6}\?done=free/);
    code = page.url().match(/LN-\d{6}/)![0];
    await waitReady(page);
    await expectSuccess(page, 'ยืนยันการจองแล้ว (ยอดที่ต้องจ่าย ฿0)');
    await expect.soft(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
  });
  await test.step('/my เครดิตเหลือ 0', async () => {
    await open(page, '/my');
    await expect.soft(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '0');
    expect(code).toMatch(/^LN-/);
  });
});

test('TC-PAY-04 จ่ายที่ 14 นาที 59 วินาที (E34) และ 15 นาที 0 วินาที (E35) ทัน', {
  tag: ['@PAY', '@P1'],
  annotation: ann({
    tc: 'TC-PAY-04', level: 'P1', source: '[D] TEST-DATA E34–E35, A-03 · FR-06, BR-10',
    expected: 'reset 10:00:00 จอง ส 10 A 09 และ A 10 ผ่านฟอร์ม · clock 10:14:59 จ่ายรายการ 1 → "ชำระเงินสำเร็จ การจองได้รับการยืนยันแล้ว" CONFIRMED · clock 10:15:00 จ่ายรายการ 2 → สำเร็จ CONFIRMED · ช่อง A-9, A-10 = booked',
  }),
}, async ({ page, request }) => {
  const phone = uniquePhone(3);
  let c1 = ''; let c2 = '';
  await test.step('10:00:00 จอง ส 10 A 09:00 และ A 10:00 ผ่านฟอร์ม (ยังไม่จ่าย)', async () => {
    c1 = await bookAndPayUi(page, { field: 'A', date: '2026-10-10', start: 9, name: 'ทีมนาทีสุดท้าย', phone, pay: false });
    c2 = await bookAndPayUi(page, { field: 'A', date: '2026-10-10', start: 10, name: 'ทีมนาทีสุดท้าย', phone, pay: false });
  });
  for (const [code, at, row] of [[() => c1, '10:14:59', 'E34'], [() => c2, '10:15:00', 'E35']] as const) {
    await test.step(`${row} clock ${at} เปิด /pay กดยืนยัน → สำเร็จ CONFIRMED`, async () => {
      await setClock(request, T(`2026-10-09T${at}`));
      await open(page, `/pay/${code()}`);
      await page.getByTestId('pay-confirm').click();
      await expect(page).toHaveURL(new RegExp(`/booking/${code()}\\?done=paid`));
      await waitReady(page);
      await expectSuccess(page, 'ชำระเงินสำเร็จ การจองได้รับการยืนยันแล้ว');
      await expect.soft(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CONFIRMED');
      await expect.soft(page.getByTestId('amount-paid'), 'ส 10 A ฿1,200 · เสาร์ก่อน 17:00 มัดจำ 50%').toHaveAttribute('data-value', '600');
    });
  }
  await test.step('ตาราง ส 10: A-9 และ A-10 booked', async () => {
    await open(page, '/book?date=2026-10-10');
    await expect.soft(page.getByTestId('slot-A-9')).toHaveAttribute('data-status', 'booked');
    await expect.soft(page.getByTestId('slot-A-10')).toHaveAttribute('data-status', 'booked');
  });
});

test('TC-CANCEL-08 ยกเลิกตามแถว TEST-DATA E47–E51 (การจอง A ส 10 10:00)', {
  tag: ['@CANCEL', '@P1'],
  annotation: ann({
    tc: 'TC-CANCEL-08', level: 'P1', source: '[D] TEST-DATA E47–E51, A-22 · FR-10, BR-13',
    expected: 'E47 09:59 preview ฿600 → "ยกเลิกแล้ว ได้รับเครดิตคืน ฿600" · E48 10:00 เหมือนกัน · E49 10:01 preview ฿0 → "ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง" · E50 ส 09:59 เหมือน E49 · E51 ส 10:00 cancel-booking-hint CANCEL_TOO_LATE → ยืนยัน → "ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น" ยัง CONFIRMED · E47/E48 /my credit-balance 600 + CANCEL +600 · E49–E51 เครดิต 0 ไม่มีรายการ CANCEL',
  }),
}, async ({ page, request }) => {
  const rows = [
    { row: 'E47', at: '2026-10-09T09:59:00', preview: '600', msg: 'ยกเลิกแล้ว ได้รับเครดิตคืน ฿600', credit: '600' },
    { row: 'E48', at: '2026-10-09T10:00:00', preview: '600', msg: 'ยกเลิกแล้ว ได้รับเครดิตคืน ฿600', credit: '600' },
    { row: 'E49', at: '2026-10-09T10:01:00', preview: '0', msg: 'ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง', credit: '0' },
    { row: 'E50', at: '2026-10-10T09:59:00', preview: '0', msg: 'ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง', credit: '0' },
    { row: 'E51', at: '2026-10-10T10:00:00', preview: '0', msg: '', credit: '0' },
  ];
  for (const r of rows) {
    await test.step(`${r.row}: reset 09:00 สมาชิกใหม่จอง A ส 10 10:00 จ่าย ฿600 → clock ${r.at.slice(5, 16)} ยกเลิก`, async () => {
      await resetData(request, T('2026-10-09T09:00:00'));
      await page.context().clearCookies();
      const phone = uniquePhone(3);
      await registerCustomer(page.request, { name: `ทีมยกเลิก ${r.row}`, phone });
      const code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-10', startHour: 10, phone, name: `ทีมยกเลิก ${r.row}` })).code;
      expect((await payBooking(page.request, code)).amount).toBe(600);
      await setClock(request, T(r.at));
      await open(page, `/booking/${code}`);
      if (r.row === 'E51') await expect.soft(page.getByTestId('cancel-booking-hint')).toHaveAttribute('data-value', 'CANCEL_TOO_LATE');
      await page.getByTestId('cancel-booking').click();
      await expect.soft(page.getByTestId('cancel-credit-preview'), `${r.row} preview`).toHaveAttribute('data-value', r.preview);
      await page.getByTestId('cancel-confirm').click();
      if (r.row === 'E51') {
        await expectError(page, 'ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น');
        expect.soft((await getBooking(page.request, code)).body.booking.status, 'E51 สถานะ').toBe('CONFIRMED');
      } else {
        await expectSuccess(page, r.msg);
        await expect.soft(page.getByTestId('booking-status')).toHaveAttribute('data-value', 'CANCELLED');
      }
      await open(page, '/my');
      await expect.soft(page.getByTestId('credit-balance'), `${r.row} credit-balance`).toHaveAttribute('data-value', r.credit);
      const cancels = page.getByTestId('credit-history').locator('[data-reason="CANCEL"]');
      if (r.credit === '600') await expect.soft(cancels.first(), `${r.row} รายการ CANCEL`).toHaveAttribute('data-value', /^\+?600$/);
      else await expect.soft(cancels, `${r.row} ไม่มีรายการ CANCEL`).toHaveCount(0);
    });
  }
});

test('TC-CANCEL-09 เลื่อนตามแถว E94–E97', {
  tag: ['@CANCEL', '@P1'],
  annotation: ann({
    tc: 'TC-CANCEL-09', level: 'P1', source: '[D] TEST-DATA E94–E97 · FR-11, BR-25',
    expected: 'การจอง A ส 10 10:00 (จ่าย ฿600) เลื่อนไป ส 10 14:00 · E94 09:59 "เลื่อนการจองแล้ว" booking-time 14:00 · E95 10:00 เหมือนกัน · E96 10:01 "เลื่อนได้เมื่อเหลือเวลาอย่างน้อย 24 ชั่วโมงก่อนเวลาเริ่ม" เวลาเดิม 10:00 · E97 หลัง E95 เลื่อนอีกครั้ง (15:00) → "เลื่อนได้ 1 ครั้งต่อการจอง"',
  }),
}, async ({ page, request }) => {
  const resched = async (code: string, hour: number) => {
    await open(page, `/booking/${code}`);
    await page.getByTestId('reschedule-date').fill('2026-10-10');
    await page.getByTestId('reschedule-start').selectOption(String(hour));
    await page.getByTestId('reschedule-submit').click();
  };
  for (const r of [{ row: 'E94', at: '09:59' }, { row: 'E95', at: '10:00' }, { row: 'E96', at: '10:01' }]) {
    await test.step(`${r.row}: reset 09:00 จอง+จ่าย → clock ${r.at} เลื่อนไป 14:00`, async () => {
      await resetData(request, T('2026-10-09T09:00:00'));
      await page.context().clearCookies();
      const phone = uniquePhone(3);
      const code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-10', startHour: 10, phone, name: `ทีมเลื่อน ${r.row}` })).code;
      expect((await payBooking(page.request, code)).amount).toBe(600);
      await setClock(request, T(`2026-10-09T${r.at}:00`));
      await resched(code, 14);
      if (r.row === 'E96') {
        await expectError(page, 'เลื่อนได้เมื่อเหลือเวลาอย่างน้อย 24 ชั่วโมงก่อนเวลาเริ่ม');
        await open(page, `/booking/${code}`);
        await expect.soft(page.getByTestId('booking-time'), 'E96 เวลาเดิม').toContainText('10:00');
      } else {
        await expectSuccess(page, 'เลื่อนการจองแล้ว');
        await open(page, `/booking/${code}`);
        await expect.soft(page.getByTestId('booking-time'), `${r.row} หลังรีโหลด`).toContainText('14:00');
        await expect.soft(page.getByTestId('price-total'), 'เสาร์ 10:00 กับ 14:00 ราคาเท่ากัน').toHaveAttribute('data-value', '1200');
        if (r.row === 'E95') {
          await resched(code, 15);
          await expectError(page, 'เลื่อนได้ 1 ครั้งต่อการจอง');
          await open(page, `/booking/${code}`);
          await expect.soft(page.getByTestId('booking-time'), 'E97 เวลายัง 14:00').toContainText('14:00');
        }
      }
    });
  }
});

// ---------------- PRICE-05/06 และ SERIES-05 อ่านอย่างเดียว แต่ฟอร์ม/ตัวอย่างราคาต้องการช่องที่ "ว่างตาม seed" (ช่องที่ถูกจองคิดราคาไม่ได้/สัปดาห์ชน)
// รอบรวมมี test อื่นจองช่องเดียวกันพร้อมกัน → ย้ายมา serial (reset ก่อนทุกข้อ ตรงกับขั้น reset ของ TEST-CASES)
test('TC-PRICE-05 ราคาทุกแถว E22–E33 (ขนาด/ช่วงเวลา/วันหยุด/คร่อม 17:00)', {
  tag: ['@PRICE', '@P1'],
  annotation: ann({
    tc: 'TC-PRICE-05', level: 'P1', source: '[D] TEST-DATA E22–E33 · BR-07–BR-09',
    expected: 'E22 ฿800 · E23 ฿1,200 · E24 ฿1,200 · E25 ฿1,200 · E26 ฿1,800 · E27 ฿800 · E28 ฿1,200 · E29 ฿800 · E30 ฿1,200 · E31 ฿1,600 · E32 ฿2,000 · E33 ฿2,400',
  }),
}, async ({ page }) => {
  const grid: [string, string, string, string][] = [
    // [แถว, วันที่, ช่อง, ราคา]
    ['E22', '2026-10-14', 'A-16', '800'], ['E23', '2026-10-14', 'A-17', '1200'], ['E24', '2026-10-14', 'A-18', '1200'],
    ['E25', '2026-10-14', 'C-16', '1200'], ['E26', '2026-10-14', 'C-17', '1800'], ['E29', '2026-10-14', 'A-9', '800'],
    ['E27', '2026-10-12', 'A-9', '800'], ['E28', '2026-10-13', 'A-9', '1200'], ['E30', '2026-10-10', 'A-9', '1200'],
  ];
  for (const date of ['2026-10-14', '2026-10-12', '2026-10-13', '2026-10-10']) {
    await test.step(`ตาราง ${date}: ${grid.filter((g) => g[1] === date).map((g) => `${g[0]} slot-${g[2]} ฿${g[3]}`).join(' · ')}`, async () => {
      await open(page, `/book?date=${date}`);
      for (const [row, , slot, price] of grid.filter((g) => g[1] === date)) {
        await expect.soft(page.getByTestId(`slot-${slot}`), `${row} slot-${slot}`).toHaveAttribute('data-price', price);
      }
    });
  }
  for (const [row, start, total] of [['E31', 15, '1600'], ['E32', 16, '2000'], ['E33', 17, '2400']] as const) {
    await test.step(`${row} ฟอร์ม A พ 14 ${start}:00 × 2 → price-field ฿${total}`, async () => {
      await open(page, `/book/new?field=A&date=2026-10-14&start=${start}`);
      await fillBookingForm(page, { hours: 2 });
      await waitReady(page);
      await expect.soft(page.getByTestId('price-field'), `${row} price-field`).toHaveAttribute('data-value', total);
      await expect.soft(page.getByTestId('price-total'), `${row} price-total (ไม่มีของเช่า/ส่วนลด)`).toHaveAttribute('data-value', total);
    });
  }
});

test('TC-PRICE-06 แผนจ่ายทุกแถว E37–E43', {
  tag: ['@PRICE', '@P1'],
  annotation: ann({
    tc: 'TC-PRICE-06', level: 'P1', source: '[D] TEST-DATA E37–E43, A-16 · BR-11',
    expected: 'E37 DEPOSIT_50 ฿400 · E38 FULL_100 ฿1,200 · E39 FULL_100 ฿1,200 · E40 FULL_100 ฿1,200 · E41 DEPOSIT_50 ฿600 · E42 DEPOSIT_50 ฿600 · E43 DEPOSIT_50 ฿600 (price-plan + price-pay-now + price-due-at-field: DEPOSIT เก็บหน้าสนามเท่าจ่ายตอนนี้ · FULL เก็บหน้าสนาม ฿0)',
  }),
}, async ({ page }) => {
  const rows = [
    { row: 'E37', date: '2026-10-16', start: 16, plan: 'DEPOSIT_50', now: '400', due: '400' },
    { row: 'E38', date: '2026-10-16', start: 17, plan: 'FULL_100', now: '1200', due: '0' },
    { row: 'E39', date: '2026-10-16', start: 18, plan: 'FULL_100', now: '1200', due: '0' },
    { row: 'E40', date: '2026-10-17', start: 17, plan: 'FULL_100', now: '1200', due: '0' },
    { row: 'E41', date: '2026-10-18', start: 17, plan: 'DEPOSIT_50', now: '600', due: '600' },
    { row: 'E42', date: '2026-10-15', start: 17, plan: 'DEPOSIT_50', now: '600', due: '600' },
    { row: 'E43', date: '2026-10-13', start: 17, plan: 'DEPOSIT_50', now: '600', due: '600' },
  ];
  for (const r of rows) {
    await test.step(`${r.row} A ${r.date} ${r.start}:00 × 1 → ${r.plan} จ่ายตอนนี้ ฿${r.now} เก็บหน้าสนาม ฿${r.due}`, async () => {
      await open(page, `/book/new?field=A&date=${r.date}&start=${r.start}`);
      await priceReady(page);
      await expect.soft(page.getByTestId('price-plan'), `${r.row} price-plan`).toHaveAttribute('data-value', r.plan);
      await expect.soft(page.getByTestId('price-pay-now'), `${r.row} price-pay-now`).toHaveAttribute('data-value', r.now);
      await expect.soft(page.getByTestId('price-due-at-field'), `${r.row} price-due-at-field`).toHaveAttribute('data-value', r.due);
    });
  }
});

test('TC-SERIES-05 จองประจำ E77 + สัปดาห์ที่ตรงวันหยุด (10, 31 ธ.ค. / 5 ธ.ค.)', {
  tag: ['@SERIES', '@P1'],
  annotation: ann({
    tc: 'TC-SERIES-05', level: 'P1', source: '[D] TEST-DATA E77, วันหยุดข้อ 3 · BR-08, BR-11, BR-19, BR-20',
    expected: 'E77 A ศ 17:00 4 สัปดาห์: series-total-price 4,800 series-discount-percent 0 series-pay-now 4,800 · C พฤ 10:00 12 สัปดาห์: series-field-price 15,600 ส่วนลด 1,560 รวม 14,040 จ่าย 7,020 · B ส 09:00 8 สัปดาห์: ค่าสนาม 9,600 ส่วนลด 960 รวม 8,640 จ่าย 4,320',
  }),
}, async ({ page }) => {
  const sets = [
    { label: 'E77 A ศ 16 ต.ค. 17:00 × 4 สัปดาห์', field: 'A', startDate: '2026-10-16', start: 17, weeks: 4, fieldPrice: 4800, pct: 0, disc: 0, total: 4800, now: 4800 },
    { label: 'C พฤ 15 ต.ค. 10:00 × 12 สัปดาห์ (10, 31 ธ.ค. วันหยุด)', field: 'C', startDate: '2026-10-15', start: 10, weeks: 12, fieldPrice: 15600, pct: 10, disc: 1560, total: 14040, now: 7020 },
    { label: 'B ส 17 ต.ค. 09:00 × 8 สัปดาห์ (5 ธ.ค. วันหยุดซ้อนเสาร์)', field: 'B', startDate: '2026-10-17', start: 9, weeks: 8, fieldPrice: 9600, pct: 10, disc: 960, total: 8640, now: 4320 },
  ];
  await test.step('สมัครสมาชิกใหม่ เปิด /series', async () => {
    await registerCustomer(page.request, { name: 'สมาชิกประจำ v2', phone: uniquePhone(3) });
    await open(page, '/series');
    await expect(page.getByTestId('series-preview')).toBeVisible();
  });
  for (const s of sets) {
    await test.step(`${s.label} → ค่าสนาม ${s.fieldPrice} ลด ${s.pct}% (${s.disc}) รวม ${s.total} จ่าย ${s.now}`, async () => {
      await page.getByTestId('series-field').selectOption(s.field);
      await page.getByTestId('series-start-date').fill(s.startDate);
      await page.getByTestId('series-start').selectOption(String(s.start));
      await page.getByTestId('series-hours').fill('1');
      await page.getByTestId('series-weeks').fill(String(s.weeks));
      await page.getByTestId('series-preview').click();
      await expect(page.getByTestId('series-weeks-booked')).toHaveAttribute('data-value', String(s.weeks));
      await waitReady(page);
      await softNum(page.getByTestId('series-field-price'), s.fieldPrice, 'series-field-price');
      await softNum(page.getByTestId('series-discount-percent'), s.pct, 'series-discount-percent');
      await softNum(page.getByTestId('series-discount'), s.disc, 'series-discount');
      await softNum(page.getByTestId('series-total-price'), s.total, 'series-total-price');
      await softNum(page.getByTestId('series-pay-now'), s.now, 'series-pay-now');
    });
  }
});

// ================================================================ MEMBER / TEAM / STAFF / OWNER
test('TC-MEMBER-08 สิทธิ์ฟรีที่ 19 และ 20 ชั่วโมง (E87, E88)', {
  tag: ['@MEMBER', '@P2'],
  annotation: ann({
    tc: 'TC-MEMBER-08', level: 'P2', source: '[D] TEST-DATA E87–E88 · FR-18, BR-23 · เช็กอินในวันเตะตาม [D A-45]',
    expected: 'สมาชิกใหม่ · C พ 21 08–23 (15 ชม.) + C พฤ 22 08–12 (4 ชม.) เช็กอินแล้ว → 19 ชม.: freeHoursAvailable 1 hoursToNextFree 1 · + C พฤ 22 12–13 เช็กอิน → 20 ชม.: 2 และ 10',
  }),
}, async ({ page, request, staffApi }) => {
  const phone = uniquePhone(3);
  const staff = await staffApi('staff');
  const checkin = async (code: string) => {
    const r = await postJson(staff, `/api/staff/bookings/${code}/checkin`, {});
    expect(r.status, `เช็กอิน ${code}: ${JSON.stringify(r.body?.error ?? '')}`).toBe(200);
  };
  let c1 = ''; let c2 = ''; let c3 = '';
  await test.step('สมัคร · จอง+จ่าย C พ 21 08:00 × 15 และ C พฤ 22 08:00 × 4', async () => {
    await registerCustomer(page.request, { name: 'สมาชิกสะสม', phone });
    c1 = (await createBooking(page.request, { fieldId: 'C', date: '2026-10-21', startHour: 8, hours: 15, phone, name: 'สมาชิกสะสม' })).code;
    await payBooking(page.request, c1);
    c2 = (await createBooking(page.request, { fieldId: 'C', date: '2026-10-22', startHour: 8, hours: 4, phone, name: 'สมาชิกสะสม' })).code;
    await payBooking(page.request, c2);
  });
  await test.step('วันเตะ: 21 ต.ค. 08:00 เช็กอินชุดแรก · 22 ต.ค. 08:00 เช็กอินชุดที่สอง', async () => {
    await setClock(request, T('2026-10-21T08:00:00'));
    await checkin(c1);
    await setClock(request, T('2026-10-22T08:00:00'));
    await checkin(c2);
  });
  await test.step('E87 19 ชั่วโมง → GET /api/me freeHoursAvailable 1 hoursToNextFree 1', async () => {
    const me = (await getJson(page.request, '/api/me')).body?.customer;
    expect.soft(me?.paidHours, 'paidHours').toBe(19);
    expect.soft(me?.freeHoursAvailable, 'E87 freeHoursAvailable').toBe(1);
    expect.soft(me?.hoursToNextFree, 'E87 hoursToNextFree').toBe(1);
  });
  await test.step('E88 จอง C พฤ 22 12:00 × 1 จ่าย เช็กอิน → 20 ชั่วโมง: 2 และ 10', async () => {
    c3 = (await createBooking(page.request, { fieldId: 'C', date: '2026-10-22', startHour: 12, hours: 1, phone, name: 'สมาชิกสะสม' })).code;
    await payBooking(page.request, c3);
    await checkin(c3);
    const me = (await getJson(page.request, '/api/me')).body?.customer;
    expect.soft(me?.paidHours, 'paidHours').toBe(20);
    expect.soft(me?.freeHoursAvailable, 'E88 freeHoursAvailable').toBe(2);
    expect.soft(me?.hoursToNextFree, 'E88 hoursToNextFree').toBe(10);
  });
});

test('TC-TEAM-08 ทีมรับคำท้าจ่ายที่ 14:59 (E105) และ 15:00 (E106) → MATCHED เจ้าของได้ ฿900', {
  tag: ['@TEAM', '@P1'],
  annotation: ann({
    tc: 'TC-TEAM-08', level: 'P1', source: '[D] TEST-DATA E104–E106 · FR-21, BR-28',
    expected: 'สมาชิกใหม่จอง C ศ 16 18:00 (฿1,800 FULL) ประกาศ · ทีมเบอร์ใหม่รับ 10:00:00 · clock 10:14:59 ทีมจ่าย challenge-pay-confirm → "ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย" · เจ้าของ /my เครดิต ฿900 รายการ CHALLENGE · (ชุดที่ 2 reset) 10:15:00 → สำเร็จเหมือนกัน',
  }),
}, async ({ page, request, newUserPage }) => {
  for (const [row, at] of [['E105', '10:14:59'], ['E106', '10:15:00']] as const) {
    await test.step(`${row}: reset 10:00 · เจ้าของสมัคร จอง C ศ 16 18:00 จ่าย ฿1,800 ประกาศบนหน้าการจอง`, async () => {
      await resetData(request);
      await page.context().clearCookies();
      const phone = uniquePhone(3);
      await registerCustomer(page.request, { name: 'เจ้าของคำท้า', phone });
      const code = await bookAndPayUi(page, { field: 'C', date: '2026-10-16', start: 18, name: 'เจ้าของคำท้า' });
      await expect.soft(page.getByTestId('amount-paid')).toHaveAttribute('data-value', '1800');
      await page.getByTestId('challenge-team').fill('ทีมเจ้าของ');
      await page.getByTestId('challenge-level').selectOption('INTERMEDIATE');
      await page.getByTestId('challenge-create').click();
      await expect(page.getByTestId('challenge-info')).toBeVisible();
      await expect.soft(page.getByTestId('challenge-amount')).toHaveAttribute('data-value', '900');
      const list = (await getJson(page.request, '/api/challenges')).body.challenges as any[];
      const ch = list.find((c) => c.fieldId === 'C' && c.date === '2026-10-16' && c.startHour === 18);
      expect(ch, `ประกาศของ ${code}`).toBeTruthy();
      const team = await newUserPage();
      await open(team, '/challenges');
      await team.getByTestId(`challenge-accept-${ch.id}`).click();
      await team.getByTestId('accept-name').fill(`ทีมรับ ${row}`);
      await team.getByTestId('accept-phone').fill(uniquePhone(3));
      await team.getByTestId('accept-consent').check();
      await team.getByTestId('accept-submit').click();
      await expectSuccess(team, 'รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที');
      await expect.soft(team.getByTestId('challenge-pay-amount')).toHaveAttribute('data-value', '900');
      await setClock(request, T(`2026-10-09T${at}`));
      await team.getByTestId('challenge-pay-confirm').click();
      await expectSuccess(team, 'ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย');
      await open(page, '/my');
      await expect.soft(page.getByTestId('credit-balance'), `${row} เครดิตเจ้าของ`).toHaveAttribute('data-value', '900');
      await expect.soft(page.getByTestId('credit-history').locator('[data-reason="CHALLENGE"]').first(), `${row} รายการ CHALLENGE`).toHaveAttribute('data-value', /^\+?900$/);
    });
  }
});

test('TC-STAFF-07 ไม่มาครั้งที่ 2 ห่าง 29 วัน (E60) ระงับ · กดไม่มาเลย 16 นาที (E66) ได้', {
  tag: ['@STAFF', '@P1'],
  annotation: ann({
    tc: 'TC-STAFF-07', level: 'P1', source: '[D] TEST-DATA E60, E66 · FR-24, BR-16, BR-17',
    expected: 'โจ้ (ไม่มาครั้งแรก 4 ต.ค. 19:15) · 25 ต.ค. จอง 2 พ.ย. A 19:00 · 2 พ.ย. 19:16 staff กด staff-no-show → "บันทึกไม่มาแล้ว ลูกค้าถูกระงับการจองออนไลน์ถึง 2 ธ.ค. 2026 19:16" · /my โจ้ banned-until = 2026-12-02T12:16:00.000Z · จองใหม่ → CUSTOMER_BANNED',
  }),
}, async ({ page, request }) => {
  let code = '';
  await test.step('reset now 25 ต.ค. 10:00 · โจ้เข้าสู่ระบบ จอง+จ่าย 2 พ.ย. A 19:00', async () => {
    await resetData(request, T('2026-10-25T10:00:00'));
    await loginCustomer(page.request, SEED.joe.phone, SEED.joe.password);
    code = (await createBooking(page.request, { fieldId: 'A', date: '2026-11-02', startHour: 19, phone: SEED.joe.phone, name: SEED.joe.name })).code;
    await payBooking(page.request, code);
  });
  await test.step('clock 2 พ.ย. 19:16 (เลย 16 นาที · ห่างครั้งแรก 29 วัน) staff ค้นรหัส กดไม่มา', async () => {
    await setClock(request, T('2026-11-02T19:16:00'));
    await staffLoginPage(page, 'staff');
    await open(page, '/staff');
    await page.getByTestId('staff-search-code').fill(code);
    await page.getByTestId('staff-search-submit').click();
    await expect(page.getByTestId('staff-booking-code')).toHaveText(code);
    await page.getByTestId('staff-no-show').click();
    await expectSuccess(page, 'บันทึกไม่มาแล้ว ลูกค้าถูกระงับการจองออนไลน์ถึง 2 ธ.ค. 2026 19:16');
    await expect.soft(page.getByTestId('staff-booking-status')).toHaveAttribute('data-value', 'NO_SHOW');
  });
  await test.step('โจ้ /my banned-until 2026-12-02T12:16:00.000Z · จองใหม่ → CUSTOMER_BANNED', async () => {
    await open(page, '/my');
    await expect.soft(page.getByTestId('banned-notice')).toBeVisible();
    const until = await page.getByTestId('banned-until').getAttribute('data-value');
    expect.soft(until ? new Date(until).toISOString() : '', 'banned-until').toBe('2026-12-02T12:16:00.000Z');
    const r = await postJson(page.request, '/api/bookings', { fieldId: 'B', date: '2026-11-05', startHour: 10, hours: 1, name: SEED.joe.name, phone: SEED.joe.phone, consent: true });
    expect.soft(r.status).toBe(403);
    expect.soft(r.body?.error?.code).toBe('CUSTOMER_BANNED');
  });
});

test('TC-OWNER-04 ปิดฝนตาม TEST-DATA: A 18–20 (LN-900001 ทับ) · B · A 17–19 · C', {
  tag: ['@OWNER', '@P1'],
  annotation: ann({
    tc: 'TC-OWNER-04', level: 'P1', source: '[D] TEST-DATA E01–E03, E52–E54 · FR-27, BR-01, BR-14',
    expected: 'E52 ปิด A 9 ต.ค. 18–20 → "ปิดสนามแล้ว คืนเครดิต 1 การจอง" closure-affected-LN-900001 ฿2,400 · LN-900001 RAIN_CLOSED · ต้น credit-balance 3,600 มีรายการ RAIN +2,400 เพิ่มจาก RAIN +1,200 เดิม · E02 ปิด B 18–20 ได้ (0 การจอง) · (reset) E53 ปิด A 17–19 → 0 การจอง LN-900001 ยัง CONFIRMED · E54 C ไม่มีในตัวเลือก + API → "สนาม C มีหลังคา ปิดเพราะฝนไม่ได้"',
  }),
}, async ({ page, request }) => {
  const close = async (field: 'A' | 'B', from: number, to: number) => {
    await open(page, '/owner');
    await page.getByTestId('closure-field').selectOption(field);
    await page.getByTestId('closure-date').fill('2026-10-09');
    await page.getByTestId('closure-from').selectOption(String(from));
    await page.getByTestId('closure-to').selectOption(String(to));
    await page.getByTestId('closure-submit').click();
  };
  await test.step('E52 owner ปิด A 9 ต.ค. 18:00–20:00 → คืนเครดิต LN-900001 ฿2,400', async () => {
    await staffLoginPage(page, 'owner');
    await close('A', 18, 20);
    await expectSuccess(page, 'ปิดสนามแล้ว คืนเครดิต 1 การจอง');
    await expect.soft(page.getByTestId('closure-result')).toHaveAttribute('data-count', '1');
    await expect.soft(page.getByTestId('closure-affected-LN-900001')).toContainText('฿2,400');
    expect.soft(sql(`select status from bookings where code='LN-900001'`)).toBe('RAIN_CLOSED');
  });
  await test.step('E02 ปิด B 18:00–20:00 ได้ (0 การจอง)', async () => {
    await close('B', 18, 20);
    await expect.soft(page.getByTestId('success-message')).toBeVisible();
    await expect.soft(page.getByTestId('closure-result')).toHaveAttribute('data-count', '0');
  });
  await test.step('ต้น /my เครดิต 3,600 · RAIN +2,400 และ RAIN +1,200', async () => {
    await memberLoginUi(page, SEED.ton.phone, SEED.ton.password);
    await expect.soft(page.getByTestId('credit-balance')).toHaveAttribute('data-value', '3600');
    const rain = await page.getByTestId('credit-history').locator('[data-reason="RAIN"]').evaluateAll((es) => es.map((e) => (e.getAttribute('data-value') ?? '').replace('+', '')).sort());
    expect.soft(rain, 'รายการ RAIN').toEqual(['1200', '2400']);
  });
  await test.step('E53 (reset) ปิด A 17:00–19:00 → 0 การจอง LN-900001 ยัง CONFIRMED', async () => {
    await resetData(request);
    await page.context().clearCookies();
    await staffLoginPage(page, 'owner');
    await close('A', 17, 19);
    await expect.soft(page.getByTestId('closure-result')).toHaveAttribute('data-count', '0');
    await expect.soft(page.getByTestId('closure-affected-LN-900001')).toHaveCount(0);
    expect.soft(sql(`select status from bookings where code='LN-900001'`)).toBe('CONFIRMED');
  });
  await test.step('E54 closure-field มีแค่ A, B · API ปิด C → "สนาม C มีหลังคา ปิดเพราะฝนไม่ได้"', async () => {
    await open(page, '/owner');
    const opts = await page.getByTestId('closure-field').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    expect.soft(opts.sort()).toEqual(['A', 'B']);
    const r = await postJson(page.request, '/api/owner/closures', { fieldId: 'C', date: '2026-10-09', fromHour: 18, toHour: 20 });
    expect.soft(r.status).toBe(400);
    expect.soft(r.body?.error?.message).toBe('สนาม C มีหลังคา ปิดเพราะฝนไม่ได้');
  });
});

// ================================================================ API (รันครั้งเดียว นับทุกเบราว์เซอร์)
test('TC-API-05 คำขอเปลี่ยนข้อมูลจาก Origin อื่น → 403', {
  tag: ['@API', '@P2'],
  annotation: ann({
    tc: 'TC-API-05', level: 'P2', source: '[R] กัน CSRF (คำขอข้ามเว็บต้องไม่ทำรายการแทนผู้ใช้) · NFR-05',
    expected: 'staff cookie · POST /api/staff/stock/sale น้ำ 1 พร้อม Origin: http://evil.example → 403 FORBIDDEN_ORIGIN คลังไม่เปลี่ยน (COUNTER 24) · ไม่มี Origin → 200 (COUNTER 23)',
  }),
}, async ({ staffApi }) => {
  // เข้าสู่ระบบตามปกติ (ไม่มี Origin) แล้วส่งคำขอขายพร้อม Origin ปลอม = จำลองเว็บอื่นใช้ cookie ของพนักงาน
  const s = await staffApi('staff');
  const water = async () => ((await getJson(s, '/api/staff/stock')).body.items as any[]).find((i) => i.id === 'WATER');
  const sale = { items: [{ itemId: 'WATER', qty: 1 }], method: 'CASH' };
  await test.step('Origin: http://evil.example → 403 FORBIDDEN_ORIGIN · COUNTER ยัง 24', async () => {
    const r = await s.post('/api/staff/stock/sale', { data: sale, headers: { Origin: 'http://evil.example' } });
    let body: any = null; try { body = await r.json(); } catch { /* */ }
    expect.soft(r.status()).toBe(403);
    expect.soft(body?.error?.code).toBe('FORBIDDEN_ORIGIN');
    expect.soft((await water()).counter, 'COUNTER หลังคำขอ Origin ปลอม').toBe(24);
  });
  await test.step('ไม่มี Origin → 200 · COUNTER 23', async () => {
    const r = await postJson(s, '/api/staff/stock/sale', sale);
    expect.soft(r.status).toBe(200);
    expect.soft((await water()).counter).toBe(23);
  });
});

// ================================================================ STOCK
test('TC-STOCK-01 คงเหลือ 8 รายการ แยก STORE / COUNTER / รวม + ประวัติขาย seed', {
  tag: ['@STOCK', '@P2'],
  annotation: ann({
    tc: 'TC-STOCK-01', level: 'P2', source: '[D] TEST-DATA 4, 5.2 · FR-37',
    expected: 'BIB 0/6/6 · BALL 0/10/10 · WATER 96/24/120 · ORS 48/12/60 · TOWEL 50/20/70 · CONE 40/0/40 · NET 4/0/4 · LAMP 12/0/12 · ประวัติ: ขาย น้ำดื่ม −4 (9 ต.ค. 09:00) · ขาย เกลือแร่ −3 (8 ต.ค. 20:30) โดย staff · STAFF ไม่เห็นกล่องเตือน',
  }),
}, async ({ page }) => {
  const want: Record<string, [number, number, number]> = { BIB: [0, 6, 6], BALL: [0, 10, 10], WATER: [96, 24, 120], ORS: [48, 12, 60], TOWEL: [50, 20, 70], CONE: [40, 0, 40], NET: [4, 0, 4], LAMP: [12, 0, 12] };
  await test.step('staff เข้าสู่ระบบ เปิด /staff/stock อ่านตาราง 8 รายการ', async () => {
    await staffLoginUi(page, 'staff');
    await open(page, '/staff/stock');
    for (const [id, [s, c, t]] of Object.entries(want)) {
      await softNum(page.getByTestId(`stock-${id}-store`), s, `${id} STORE`);
      await softNum(page.getByTestId(`stock-${id}-counter`), c, `${id} COUNTER`);
      await softNum(page.getByTestId(`stock-${id}-total`), t, `${id} รวม`);
    }
    await expect.soft(page.getByTestId('stock-alerts'), 'STAFF ไม่เห็นกล่องเตือน').toHaveCount(0);
  });
  await test.step('ประวัติ: ขาย น้ำดื่ม −4 (9 ต.ค. 09:00) · ขาย เกลือแร่ −3 (8 ต.ค. 20:30) โดย staff', async () => {
    await expect.soft(page.getByTestId('movement-table')).toBeVisible();
    const ms = await movements(page);
    const w = ms.find((m) => m.type === 'SALE' && Number(m.qty) === -4);
    const o = ms.find((m) => m.type === 'SALE' && Number(m.qty) === -3);
    expect.soft(w, `ขายน้ำ −4 ใน ${JSON.stringify(ms)}`).toBeTruthy();
    expect.soft(o, 'ขายเกลือแร่ −3').toBeTruthy();
    expect.soft(w?.text ?? '', 'น้ำดื่ม 9 ต.ค. 09:00').toMatch(/น้ำดื่ม[\s\S]*9 ต\.ค\. 2026 09:00|9 ต\.ค\. 2026 09:00[\s\S]*น้ำดื่ม/);
    expect.soft(o?.text ?? '', 'เกลือแร่ 8 ต.ค. 20:30').toMatch(/เกลือแร่[\s\S]*8 ต\.ค\. 2026 20:30|8 ต\.ค\. 2026 20:30[\s\S]*เกลือแร่/);
    expect.soft(`${w?.user} ${o?.user}`, 'ผู้ทำ staff').toMatch(/(staff|น้องบอล).*(staff|น้องบอล)/);
  });
});

test('TC-STOCK-02 ย้ายของ E124–E127', {
  tag: ['@STOCK', '@P1'],
  annotation: ann({
    tc: 'TC-STOCK-02', level: 'P1', source: '[D] TEST-DATA E124–E127, US-43 · FR-39, BR-34',
    expected: 'E124 ย้าย 24 STORE→COUNTER "ย้ายของแล้ว" → 72 / 48 / 120 · (reset) E125 ย้าย 96 → STORE 0 COUNTER 120 · (reset) E126 ย้าย 97 → "ของไม่พอ (น้ำดื่ม 600 มล. มี 96)" ไม่เปลี่ยน · E127 COUNTER→COUNTER → "ต้นทางและปลายทางต้องเป็นคนละที่"',
  }),
}, async ({ page, request }) => {
  const rows = [
    { row: 'E124', qty: 24, ok: true, lv: [72, 48, 120] },
    { row: 'E125', qty: 96, ok: true, lv: [0, 120, 120] },
    { row: 'E126', qty: 97, ok: false, lv: [96, 24, 120] },
  ];
  for (const r of rows) {
    await test.step(`${r.row} (reset) ย้ายน้ำดื่ม ${r.qty} STORE→COUNTER → ${r.lv.join(' / ')}`, async () => {
      await resetData(request);
      await page.context().clearCookies();
      await staffLoginUi(page, 'staff');
      await transfer(page, { item: 'WATER', from: 'STORE', to: 'COUNTER', qty: r.qty });
      if (r.ok) await expectSuccess(page, MOVE_OK);
      else await expectError(page, 'ของไม่พอ (น้ำดื่ม 600 มล. มี 96)');
      await expect.soft(page.getByTestId('transfer-store')).toHaveAttribute('data-value', String(r.lv[0]));
      await expect.soft(page.getByTestId('transfer-counter')).toHaveAttribute('data-value', String(r.lv[1]));
      await expect.soft(page.getByTestId('transfer-total')).toHaveAttribute('data-value', String(r.lv[2]));
      const l = await levels(page, 'WATER');
      expect.soft([l.store, l.counter, l.total], `${r.row} /staff/stock`).toEqual(r.lv);
    });
  }
  await test.step('E127 COUNTER→COUNTER → "ต้นทางและปลายทางต้องเป็นคนละที่"', async () => {
    await transfer(page, { item: 'WATER', from: 'COUNTER', to: 'COUNTER', qty: 1 });
    await expectError(page, 'ต้นทางและปลายทางต้องเป็นคนละที่');
    const l = await levels(page, 'WATER');
    expect.soft([l.store, l.counter, l.total]).toEqual([96, 24, 120]);
  });
});

test('TC-STOCK-03 เตือนของใกล้หมด E128–E131 + ตั้ง/ล้างจุดสั่งซื้อซ้ำ', {
  tag: ['@STOCK', '@P2'],
  annotation: ann({
    tc: 'TC-STOCK-03', level: 'P2', source: '[D] TEST-DATA E128–E131, US-44 · FR-40, FR-41, BR-35',
    expected: 'ชำรุดน้ำ STORE 71/72/73 (รวมเหลือ 49/48/47): 49 → stock-alerts count 0 · 48 → 0 · 47 → 1 stock-alert-WATER 47 + dash-low-stock 1 · เอี๊ยมรวม 0 → ไม่เตือน · ตั้งจุด −1 → "จุดสั่งซื้อซ้ำต้องเป็นจำนวนเต็มตั้งแต่ 0 หรือเว้นว่าง"',
  }),
}, async ({ page, request }) => {
  for (const [qty, left, alerts] of [[71, 49, '0'], [72, 48, '0'], [73, 47, '1']] as const) {
    await test.step(`(reset) manager ชำรุดน้ำ STORE ${qty} → รวม ${left} → stock-alerts ${alerts}`, async () => {
      await resetData(request);
      await page.context().clearCookies();
      await staffLoginUi(page, 'manager');
      await open(page, '/manager/stock');
      await stockForm(page, 'damage', { item: 'WATER', loc: 'STORE', qty, reason: 'ทดสอบ' });
      await expectSuccess(page, 'บันทึกของชำรุดแล้ว');
      await open(page, '/staff/stock');
      await softNum(page.getByTestId('stock-WATER-total'), left, 'น้ำรวม');
      await expect.soft(page.getByTestId('stock-alerts')).toHaveAttribute('data-count', alerts);
      if (alerts === '1') await expect.soft(page.getByTestId('stock-alert-WATER')).toHaveAttribute('data-value', '47');
      else await expect.soft(page.getByTestId('stock-alert-WATER')).toHaveCount(0);
    });
  }
  await test.step('แดชบอร์ด dash-low-stock 1', async () => {
    await open(page, '/owner/dashboard');
    await softNum(page.getByTestId('dash-low-stock'), 1, 'dash-low-stock');
  });
  await test.step('เอี๊ยมชำรุด 6 (รวม 0) → ไม่เตือนเอี๊ยม (ไม่มีจุดสั่งซื้อ)', async () => {
    await open(page, '/manager/stock');
    await stockForm(page, 'damage', { item: 'BIB', loc: 'COUNTER', qty: 6, reason: 'ทดสอบ' });
    await expectSuccess(page, 'บันทึกของชำรุดแล้ว');
    await open(page, '/staff/stock');
    await softNum(page.getByTestId('stock-BIB-total'), 0, 'เอี๊ยมรวม');
    await expect.soft(page.getByTestId('stock-alert-BIB')).toHaveCount(0);
    await expect.soft(page.getByTestId('stock-alerts')).toHaveAttribute('data-count', '1');
  });
  await test.step('ตั้งจุดสั่งซื้อซ้ำ −1 → ไม่บันทึก + บอกผู้ใช้ · API ตอบข้อความ INVALID_REORDER_POINT', async () => {
    await open(page, '/manager/stock');
    await selectSmart(page.getByTestId('reorder-item'), 'WATER');
    await page.getByTestId('reorder-value').fill('-1');
    await page.getByTestId('reorder-submit').click();
    // หน้าเว็บอาจกันด้วย min=0 ของเบราว์เซอร์ (ข้อความของเบราว์เซอร์) หรือส่งไป server แล้วแสดง error-message — ทั้ง 2 แบบ = ไม่บันทึก + บอกผู้ใช้
    const native = await page.getByTestId('reorder-value').evaluate((e) => (e as HTMLInputElement).validationMessage);
    if (!native) await expectError(page, 'จุดสั่งซื้อซ้ำต้องเป็นจำนวนเต็มตั้งแต่ 0 หรือเว้นว่าง');
    await open(page, '/staff/stock');
    await softNum(page.getByTestId('stock-WATER-reorder'), 48, 'จุดสั่งซื้อน้ำยัง 48');
    const r = await page.request.put('/api/manager/stock/items/WATER/reorder-point', { data: { reorderPoint: -1 } });
    const body = await r.json().catch(() => null);
    expect.soft(r.status()).toBe(400);
    expect.soft(body?.error?.message).toBe('จุดสั่งซื้อซ้ำต้องเป็นจำนวนเต็มตั้งแต่ 0 หรือเว้นว่าง');
  });
});

test('TC-STOCK-04 ปรับยอดต้องมีเหตุผล และบันทึกชื่อ+เวลา (E133–E134)', {
  tag: ['@STOCK', '@P2'],
  annotation: ann({
    tc: 'TC-STOCK-04', level: 'P2', source: '[D] TEST-DATA E133–E134, US-45 · FR-40, BR-36, BR-42',
    expected: 'manager ปรับ WATER STORE นับ 95 ไม่ใส่เหตุผล → "กรุณาใส่เหตุผล" ไม่บันทึก · เหตุผล "นับจริง" → "ปรับยอดแล้ว (-1)" adjust-result −1 · ประวัติ ปรับยอด −1 ผู้ทำ manager เวลา 9 ต.ค. 2026 10:00 · owner /owner/audit มี STOCK_ADJUST โดย manager',
  }),
}, async ({ page }) => {
  const fillAdjust = async (reason: string) => {
    await open(page, '/manager/stock');
    await selectSmart(page.getByTestId('adjust-item'), 'WATER');
    await selectSmart(page.getByTestId('adjust-location'), ...LOC.STORE);
    await softNum(page.getByTestId('adjust-current'), 96, 'adjust-current');
    await page.getByTestId('adjust-counted').fill('95');
    await page.getByTestId('adjust-reason').fill(reason);
    await page.getByTestId('adjust-submit').click();
  };
  await test.step('E133 ไม่ใส่เหตุผล → "กรุณาใส่เหตุผล" ไม่บันทึก', async () => {
    await staffLoginUi(page, 'manager');
    await fillAdjust('');
    await expectError(page, 'กรุณาใส่เหตุผล');
    const l = await levels(page, 'WATER');
    expect.soft(l.store, 'STORE ยัง 96').toBe(96);
  });
  await test.step('E134 เหตุผล "นับจริง" → "ปรับยอดแล้ว (-1)" adjust-result −1', async () => {
    await fillAdjust('นับจริง');
    await expectSuccess(page, 'ปรับยอดแล้ว (-1)');
    await expect.soft(page.getByTestId('adjust-result')).toHaveAttribute('data-value', '-1');
    const l = await levels(page, 'WATER');
    expect.soft([l.store, l.total]).toEqual([95, 119]);
  });
  await test.step('ประวัติ /staff/stock: ปรับยอด −1 ผู้ทำ manager เวลา 9 ต.ค. 2026 10:00', async () => {
    const m = (await movements(page)).find((x) => x.type === 'ADJUST');
    expect.soft(m, 'มีแถวปรับยอด').toBeTruthy();
    expect.soft(Number(m?.qty), 'จำนวน').toBe(-1);
    expect.soft(m?.user ?? '', 'ผู้ทำ').toMatch(/manager|คุณฝ้าย/);
    expect.soft(m?.text ?? '', 'เวลา').toContain('9 ต.ค. 2026 10:00');
  });
  await test.step('owner /owner/audit มี STOCK_ADJUST โดย manager', async () => {
    await staffLoginPage(page, 'owner');
    const rows = await auditRows(page);
    const a = rows.find((r) => r.action === 'STOCK_ADJUST');
    expect.soft(a, `audit ${JSON.stringify(rows)}`).toBeTruthy();
    expect.soft(a?.user ?? '').toMatch(/manager|คุณฝ้าย/);
  });
});

test('TC-STOCK-05 ชำรุด/รับเข้าเอี๊ยม เปลี่ยนจำนวนให้เช่า (E138–E139)', {
  tag: ['@STOCK', '@P1'],
  annotation: ann({
    tc: 'TC-STOCK-05', level: 'P1', source: '[D] TEST-DATA E138–E139, A-36 · FR-40, BR-38, BR-22',
    expected: 'ชำรุด BIB COUNTER 1 (เหตุผล "ขาด") → ฟอร์มจอง อ 20 B 08 rental-BIB-remaining 5 · ขอ 6 → "ของเช่าไม่พอ (เอี๊ยม เหลือ 5)" · รับเข้า 1 → คงเหลือ 6',
  }),
}, async ({ page, newUserPage }) => {
  const customer = await newUserPage();
  const form = '/book/new?field=B&date=2026-10-20&start=8';
  await test.step('manager บันทึกชำรุด BIB COUNTER 1 เหตุผล "ขาด"', async () => {
    await staffLoginUi(page, 'manager');
    await open(page, '/manager/stock');
    await stockForm(page, 'damage', { item: 'BIB', loc: 'COUNTER', qty: 1, reason: 'ขาด' });
    await expectSuccess(page, 'บันทึกของชำรุดแล้ว');
  });
  await test.step('ลูกค้าเปิดฟอร์มจอง อ 20 B 08:00 → เหลือ 5 · ขอ 6 → ของเช่าไม่พอ', async () => {
    await open(customer, form);
    await softNum(customer.getByTestId('rental-BIB-remaining'), 5, 'rental-BIB-remaining');
    await customer.getByTestId('rental-BIB-qty').fill('6');
    await fillBookingForm(customer, { name: 'ทีมเอี๊ยม', phone: uniquePhone(3), consent: true });
    await waitReady(customer);
    await customer.getByTestId('book-submit').click();
    await expectError(customer, 'ของเช่าไม่พอ (เอี๊ยม เหลือ 5)');
  });
  await test.step('manager รับเข้า BIB COUNTER 1 → ฟอร์มเหลือ 6', async () => {
    await open(page, '/manager/stock');
    await stockForm(page, 'receive', { item: 'BIB', loc: 'COUNTER', qty: 1, reason: 'ซ่อมแล้ว' });
    await expectSuccess(page, 'รับของเข้าแล้ว');
    await open(customer, form);
    await softNum(customer.getByTestId('rental-BIB-remaining'), 6, 'rental-BIB-remaining หลังรับเข้า');
  });
});

test('TC-STOCK-06 ลดของเช่าต่ำกว่าที่การจองค้างจองไว้ไม่ได้', {
  tag: ['@STOCK', '@P2'],
  annotation: ann({
    tc: 'TC-STOCK-06', level: 'P2', source: '[R] ถ้าลดได้ ลูกค้าที่จองแล้วจะไม่มีของ (ผลของ BR-22 + BR-38) · ข้อความ [A] STOCK_RESERVED',
    expected: 'จอง อ 20 C 19 เช่าเอี๊ยม 6 (จ่าย) · manager ชำรุดเอี๊ยม 1 → ถูกปฏิเสธ (ข้อความบอกว่าการจองที่ยังไม่จบจองไว้ 6 ชิ้น) · คลัง BIB ยัง 6',
  }),
}, async ({ page, anonApi }) => {
  await test.step('ลูกค้าจอง อ 20 C 19:00 เช่าเอี๊ยม 6 แล้วจ่าย', async () => {
    const c = await anonApi();
    const code = (await createBooking(c, { fieldId: 'C', date: '2026-10-20', startHour: 19, phone: uniquePhone(3), name: 'ทีมเอี๊ยมเต็ม', rentals: { BIB: 6 } })).code;
    await payBooking(c, code);
  });
  await test.step('manager ชำรุดเอี๊ยม COUNTER 1 → ปฏิเสธ · คลัง BIB ยัง 6', async () => {
    await staffLoginUi(page, 'manager');
    await open(page, '/manager/stock');
    await stockForm(page, 'damage', { item: 'BIB', loc: 'COUNTER', qty: 1, reason: 'ขาด' });
    const res = await outcome(page);
    expect.soft(res.kind, `ผล: ${res.text}`).toBe('error');
    expect.soft(res.text, 'ข้อความบอกว่าการจองที่ยังไม่จบจองไว้ 6 ชิ้น').toMatch(/จอง[\s\S]*6/);
    const l = await levels(page, 'BIB');
    expect.soft(l.total, 'BIB รวม').toBe(6);
  });
});

// ================================================================ SALE
test('TC-SALE-01 ขายหน้าเคาน์เตอร์ E135 และ US-42 (น้ำ 2 เงินสด)', {
  tag: ['@SALE', '@P1'],
  annotation: ann({
    tc: 'TC-SALE-01', level: 'P1', source: '[D] TEST-DATA E135, US-42 · FR-38, BR-37, BR-40',
    expected: 'E135 น้ำ 2 + เกลือแร่ 1 พร้อมเพย์: sale-total 40 ก่อนยืนยัน → "บันทึกการขายแล้ว ยอด ฿40" · COUNTER น้ำ 22 เกลือแร่ 11 · แดชบอร์ด dash-today-sales 80 (= 40 seed + 40) · US-42 (reset) น้ำ 2 เงินสด: ยอด ฿20 · น้ำ COUNTER 22 · ประวัติ "ขาย −2" ช่องทางเงินสด',
  }),
}, async ({ page, request }) => {
  await test.step('E135 staff ขายน้ำ 2 + เกลือแร่ 1 พร้อมเพย์ → ยอดก่อนยืนยัน 40', async () => {
    await staffLoginUi(page, 'staff');
    const total = await sell(page, { WATER: 2, ORS: 1 }, 'PROMPTPAY');
    expect.soft(total, 'sale-total ก่อนยืนยัน').toBe(40);
    await expectSuccess(page, 'บันทึกการขายแล้ว ยอด ฿40');
  });
  await test.step('/staff/stock COUNTER น้ำ 22 เกลือแร่ 11 (STORE ไม่เปลี่ยน)', async () => {
    const w = await levels(page, 'WATER');
    expect.soft([w.store, w.counter, w.total], 'น้ำ').toEqual([96, 22, 118]);
    const o = await levels(page, 'ORS');
    expect.soft([o.store, o.counter, o.total], 'เกลือแร่').toEqual([48, 11, 59]);
  });
  await test.step('owner แดชบอร์ด dash-today-sales 80 · รวมวันนี้ 80 · จอง 0', async () => {
    await staffLoginPage(page, 'owner');
    await open(page, '/owner/dashboard');
    await softNum(page.getByTestId('dash-today-sales'), 80, 'dash-today-sales');
    await softNum(page.getByTestId('dash-today-total'), 80, 'dash-today-total');
    await softNum(page.getByTestId('dash-today-booking-money'), 0, 'dash-today-booking-money');
  });
  await test.step('US-42 (reset) ขายน้ำ 2 เงินสด → ยอด ฿20 · COUNTER 22 · ประวัติ ขาย −2 เงินสด', async () => {
    await resetData(request);
    await page.context().clearCookies();
    await staffLoginUi(page, 'staff');
    const total = await sell(page, { WATER: 2 }, 'CASH');
    expect.soft(total, 'sale-total').toBe(20);
    await expectSuccess(page, 'บันทึกการขายแล้ว ยอด ฿20');
    const w = await levels(page, 'WATER');
    expect.soft(w.counter, 'น้ำ COUNTER').toBe(22);
    const m = (await movements(page)).find((x) => x.type === 'SALE' && Number(x.qty) === -2);
    expect.soft(m, 'ประวัติ ขาย −2').toBeTruthy();
    expect.soft(sql(`select method from counter_sales order by id desc limit 1`), '[E sql] ช่องทางการขายล่าสุด').toBe('CASH');
  });
});

test('TC-SALE-02 ขายน้ำ 23 / 24 / 25 ขวด (E121–E123)', {
  tag: ['@SALE', '@P1'],
  annotation: ann({
    tc: 'TC-SALE-02', level: 'P1', source: '[D] TEST-DATA E121–E123 · FR-38, BR-33',
    expected: 'น้ำ COUNTER 24 · reset ก่อนแต่ละค่า · 23 → ฿230 เหลือ 1 · 24 → ฿240 เหลือ 0 · 25 → sale-total 250 แต่ยืนยันแล้ว "ของไม่พอ (น้ำดื่ม 600 มล. มี 24)" คงเหลือ 24',
  }),
}, async ({ page, request }) => {
  for (const [qty, left, ok] of [[23, 1, true], [24, 0, true], [25, 24, false]] as const) {
    await test.step(`(reset) ขายน้ำ ${qty} → ยอด ${qty * 10} · ${ok ? 'สำเร็จ' : 'ของไม่พอ'} · เหลือ ${left}`, async () => {
      await resetData(request);
      await page.context().clearCookies();
      await staffLoginUi(page, 'staff');
      const total = await sell(page, { WATER: qty }, 'CASH');
      expect.soft(total, 'sale-total').toBe(qty * 10);
      if (ok) await expectSuccess(page, `บันทึกการขายแล้ว ยอด ฿${qty * 10}`);
      else await expectError(page, 'ของไม่พอ (น้ำดื่ม 600 มล. มี 24)');
      await open(page, '/staff/stock/sale');
      await softNum(page.getByTestId('sale-available-WATER'), left, 'sale-available-WATER');
    });
  }
});

test('TC-SALE-03 ขายได้เฉพาะของขาย (E136–E137) · ฟอร์มเปล่า / ไม่เลือกช่องทาง', {
  tag: ['@SALE', '@P2'],
  annotation: ann({
    tc: 'TC-SALE-03', level: 'P2', source: '[D] TEST-DATA E136–E137, A-30 · FR-38, BR-37',
    expected: 'หน้าขายมีแค่ WATER ORS TOWEL (ไม่มี sale-qty-CONE, sale-qty-BIB) · API ขาย CONE → "ขายได้เฉพาะของหมวดของขาย (กรวยซ้อม ขายไม่ได้)" · BIB → "(เอี๊ยม ขายไม่ได้)" · กดบันทึกเปล่า → "กรุณาเลือกของอย่างน้อย 1 รายการ" · ไม่เลือกช่องทาง → "กรุณาเลือกช่องทางชำระ เงินสด หรือ พร้อมเพย์"',
  }),
}, async ({ page, staffApi }) => {
  await test.step('หน้าขายมีแค่ของหมวดขาย WATER ORS TOWEL', async () => {
    await staffLoginUi(page, 'staff');
    await open(page, '/staff/stock/sale');
    const ids = await page.locator('[data-testid^="sale-qty-"]').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')!.replace('sale-qty-', '')).sort());
    expect.soft(ids).toEqual(['ORS', 'TOWEL', 'WATER']);
    for (const id of ['CONE', 'BIB', 'BALL', 'NET', 'LAMP']) await expect.soft(page.getByTestId(`sale-qty-${id}`)).toHaveCount(0);
  });
  await test.step('กดบันทึกเปล่า (เลือกเงินสด ไม่ใส่จำนวน) → "กรุณาเลือกของอย่างน้อย 1 รายการ"', async () => {
    await sell(page, {}, 'CASH');
    await expectError(page, 'กรุณาเลือกของอย่างน้อย 1 รายการ');
  });
  await test.step('ใส่น้ำ 1 ไม่เลือกช่องทาง → "กรุณาเลือกช่องทางชำระ เงินสด หรือ พร้อมเพย์"', async () => {
    await sell(page, { WATER: 1 });
    await expectError(page, 'กรุณาเลือกช่องทางชำระ เงินสด หรือ พร้อมเพย์');
    await softNum(page.getByTestId('sale-available-WATER'), 24, 'น้ำยัง 24');
  });
  await test.step('API ขาย CONE / BIB → STOCK_NOT_FOR_SALE · ไม่มี method → INVALID_METHOD', async () => {
    const s = await staffApi('staff');
    const cone = await postJson(s, '/api/staff/stock/sale', { items: [{ itemId: 'CONE', qty: 1 }], method: 'CASH' });
    expect.soft(cone.status).toBe(400);
    expect.soft(cone.body?.error?.message).toBe('ขายได้เฉพาะของหมวดของขาย (กรวยซ้อม ขายไม่ได้)');
    const bib = await postJson(s, '/api/staff/stock/sale', { items: [{ itemId: 'BIB', qty: 1 }], method: 'CASH' });
    expect.soft(bib.status).toBe(400);
    expect.soft(bib.body?.error?.message ?? '').toMatch(/^ขายได้เฉพาะของหมวดของขาย \(.*เอี๊ยม.* ขายไม่ได้\)$/);
    const nom = await postJson(s, '/api/staff/stock/sale', { items: [{ itemId: 'WATER', qty: 1 }] });
    expect.soft(nom.status).toBe(400);
    expect.soft(nom.body?.error?.code).toBe('INVALID_METHOD');
  });
});

// ================================================================ DASH
test('TC-DASH-01 แดชบอร์ดจาก seed (TEST-DATA 5.4) เทียบ SQL', {
  tag: ['@DASH', '@P1'],
  annotation: ann({
    tc: 'TC-DASH-01', level: 'P1', source: '[D] TEST-DATA 5.4, E145 + [E sql:money_by_day] [E sql:util_today] · FR-42, BR-40, BR-41, BR-35',
    expected: 'dash-today-total 40 (dash-today-booking-money 0 · dash-today-sales 40 · dash-today-credit 0) · dash-week-total 7,300 · แท่ง 3–9 ต.ค. = 600 / 0 / 600 / 1,200 / 0 / 4,860 / 40 · dash-util-A 13 · B 0 · C 0 · dash-low-stock 0 · ตรงกับ SQL ทุกค่า',
  }),
}, async ({ page }) => {
  const bars: Record<string, number> = { '2026-10-03': 600, '2026-10-04': 0, '2026-10-05': 600, '2026-10-06': 1200, '2026-10-07': 0, '2026-10-08': 4860, '2026-10-09': 40 };
  await test.step('owner เปิดแดชบอร์ดวันนี้ 9 ต.ค.', async () => {
    await staffLoginUi(page, 'owner');
    await open(page, '/owner/dashboard');
    await softNum(page.getByTestId('dash-today-total'), 40, 'dash-today-total');
    await softNum(page.getByTestId('dash-today-booking-money'), 0, 'dash-today-booking-money');
    await softNum(page.getByTestId('dash-today-sales'), 40, 'dash-today-sales');
    await softNum(page.getByTestId('dash-today-credit'), 0, 'dash-today-credit');
    await softNum(page.getByTestId('dash-week-total'), 7300, 'dash-week-total');
    for (const [d, v] of Object.entries(bars)) await softNum(page.getByTestId(`dash-bar-${d}`), v, `dash-bar-${d}`);
    await softNum(page.getByTestId('dash-util-A'), 13, 'dash-util-A');
    await softNum(page.getByTestId('dash-util-B'), 0, 'dash-util-B');
    await softNum(page.getByTestId('dash-util-C'), 0, 'dash-util-C');
    await softNum(page.getByTestId('dash-low-stock'), 0, 'dash-low-stock');
  });
  await test.step('[E sql:money_by_day] ทุกวัน 3–9 ต.ค. และ [E sql:util_today] A 2 ชม. → 13%', async () => {
    for (const [d, v] of Object.entries(bars)) expect.soft(moneyByDay(d), `[E sql:money_by_day] ${d}`).toBe(v);
    const util = sql(`select f || ':' || h || ':' || round(h/16.0*100) from (select field_id f, sum(hours) h from bookings where date='2026-10-09' and status in ('PENDING_PAYMENT','CONFIRMED','CHECKED_IN','NO_SHOW') group by field_id) x order by 1`);
    expect.soft(util, '[E sql:util_today]').toBe('A:2:13');
  });
});

test('TC-DASH-02 ยอดวันนี้อัปเดตหลังรับเงิน · เครดิตแสดงแยก ไม่นับเป็นรายได้ (A-37)', {
  tag: ['@DASH', '@P1'],
  annotation: ann({
    tc: 'TC-DASH-02', level: 'P1', source: '[D] BR-40, A-37 · FR-42 · [E sql:money_by_day]',
    expected: 'จอง A จ 12 09 จ่าย ฿400 · ต้นจอง A พ 14 16–18 ใช้เครดิต ฿1,200 จ่าย ฿400 · staff ขายน้ำ 2 เงินสด ฿20 → dash-today-booking-money 800 · dash-today-sales 60 · dash-today-total 860 · dash-today-credit 1,200 (แยก ไม่รวมใน 860) · แท่ง 9 ต.ค. 860 · dash-week-total 8,120 · รีโหลดแล้วเท่าเดิม · SQL 9 ต.ค. = 860',
  }),
}, async ({ page, newUserPage }) => {
  await test.step('ลูกค้าจอง A จ 12 09:00 ผ่านฟอร์ม จ่าย ฿400', async () => {
    const c = await newUserPage();
    const code = await bookAndPayUi(c, { field: 'A', date: '2026-10-12', start: 9, name: 'ทีมจันทร์', phone: uniquePhone(3) });
    await expect.soft(c.getByTestId('amount-paid'), code).toHaveAttribute('data-value', '400');
  });
  await test.step('ต้นจอง A พ 14 16:00 × 2 ใช้เครดิต ฿1,200 จ่าย ฿400', async () => {
    const t = await newUserPage();
    await memberLoginUi(t, SEED.ton.phone, SEED.ton.password);
    await bookAndPayUi(t, { field: 'A', date: '2026-10-14', start: 16, hours: 2, name: SEED.ton.name, useCredit: true });
    await expect.soft(t.getByTestId('amount-paid')).toHaveAttribute('data-value', '400');
  });
  await test.step('staff ขายน้ำ 2 เงินสด ฿20', async () => {
    const s = await newUserPage();
    await staffLoginUi(s, 'staff');
    expect.soft(await sell(s, { WATER: 2 }, 'CASH')).toBe(20);
    await expectSuccess(s, 'บันทึกการขายแล้ว ยอด ฿20');
  });
  await test.step('owner แดชบอร์ด อ่าน → รีโหลดอ่านซ้ำ', async () => {
    await staffLoginUi(page, 'owner');
    await open(page, '/owner/dashboard');
    for (const round of ['ครั้งแรก', 'หลังรีโหลด']) {
      if (round === 'หลังรีโหลด') { await page.reload(); await waitReady(page); }
      await softNum(page.getByTestId('dash-today-booking-money'), 800, `booking-money ${round}`);
      await softNum(page.getByTestId('dash-today-sales'), 60, `sales ${round}`);
      await softNum(page.getByTestId('dash-today-total'), 860, `total ${round}`);
      await softNum(page.getByTestId('dash-today-credit'), 1200, `credit ${round}`);
      await softNum(page.getByTestId('dash-bar-2026-10-09'), 860, `แท่ง 9 ต.ค. ${round}`);
      await softNum(page.getByTestId('dash-week-total'), 8120, `week ${round}`);
    }
    expect.soft(moneyByDay('2026-10-09'), '[E sql:money_by_day] 9 ต.ค.').toBe(860);
  });
});

test('TC-DASH-03 อัตราการใช้สนาม 25% (US-46) · ยกเลิกไม่นับ · ชั่วโมงยอดนิยม/สถานะ', {
  tag: ['@DASH', '@P2'],
  annotation: ann({
    tc: 'TC-DASH-03', level: 'P2', source: '[D] US-46, BR-41 · ชั่วโมงยอดนิยม = 04 T-21 · FR-42',
    expected: 'จองวันนี้ A 15–17 (2 ชม.) จ่าย → A รวม 4 ชม. · จองวันนี้ B 15 แล้วยกเลิก → dash-util-A 25 · dash-util-B 0 (ยกเลิกไม่นับ) · dash-hour-19 4 · dash-hour-18 1 · dash-status-CONFIRMED 2 · dash-status-CANCELLED 1',
  }),
}, async ({ page, anonApi }) => {
  await test.step('จองวันนี้ A 15:00 × 2 จ่าย · จอง B 15:00 จ่ายแล้วยกเลิก', async () => {
    const c = await anonApi();
    const a = (await createBooking(c, { fieldId: 'A', date: '2026-10-09', startHour: 15, hours: 2, phone: uniquePhone(3), name: 'ทีมบ่าย' })).code;
    await payBooking(c, a);
    const bk = (await createBooking(c, { fieldId: 'B', date: '2026-10-09', startHour: 15, phone: uniquePhone(3), name: 'ทีมยกเลิก' })).code;
    await payBooking(c, bk);
    const r = await postJson(c, `/api/bookings/${bk}/cancel`, {});
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  });
  await test.step('owner แดชบอร์ด', async () => {
    await staffLoginUi(page, 'owner');
    await open(page, '/owner/dashboard');
    await softNum(page.getByTestId('dash-util-A'), 25, 'dash-util-A');
    await softNum(page.getByTestId('dash-util-B'), 0, 'dash-util-B');
    await softNum(page.getByTestId('dash-util-C'), 0, 'dash-util-C');
    await softNum(page.getByTestId('dash-hour-19'), 4, 'dash-hour-19');
    await softNum(page.getByTestId('dash-hour-18'), 1, 'dash-hour-18');
    await softNum(page.getByTestId('dash-status-CONFIRMED'), 2, 'dash-status-CONFIRMED');
    await softNum(page.getByTestId('dash-status-CANCELLED'), 1, 'dash-status-CANCELLED');
  });
});

// ================================================================ REPORT
test('TC-REPORT-01 ช่วงวันรายงาน E140–E142 (+ 30 พ.ย. → 28 ก.พ. A-46)', {
  tag: ['@REPORT', '@P2'],
  annotation: ann({
    tc: 'TC-REPORT-01', level: 'P2', source: '[D] TEST-DATA E140–E142, A-36 T-09 · [D A-46] 30 พ.ย. → 28 ก.พ. ดูได้ · FR-44, BR-39',
    expected: 'E140 1 ต.ค.–31 ธ.ค. → report-table data-count 92 · E141 1 ต.ค.–1 ม.ค. → "ดูรายงานได้ครั้งละไม่เกิน 3 เดือน" · E142 10 → 9 ต.ค. → "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" · [A-46] 30 พ.ย. 2026 → 28 ก.พ. 2027 แสดงรายงาน 91 วัน',
  }),
}, async ({ page }) => {
  await staffLoginUi(page, 'owner');
  await test.step('E140 2026-10-01 → 2026-12-31 → 92 วัน', async () => {
    await report(page, '2026-10-01', '2026-12-31');
    await expect.soft(page.getByTestId('report-table')).toHaveAttribute('data-count', '92');
  });
  await test.step('E141 2026-10-01 → 2027-01-01 → เกิน 3 เดือน', async () => {
    await report(page, '2026-10-01', '2027-01-01');
    await expect.soft(page.getByTestId('report-error')).toContainText('ดูรายงานได้ครั้งละไม่เกิน 3 เดือน');
    await expect.soft(page.getByTestId('report-table')).toHaveCount(0);
  });
  await test.step('E142 2026-10-10 → 2026-10-09 → วันสิ้นสุดก่อนวันเริ่ม', async () => {
    await report(page, '2026-10-10', '2026-10-09');
    await expect.soft(page.getByTestId('report-error')).toContainText('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
  });
  await test.step('[A-46] 2026-11-30 → 2027-02-28 ดูได้ (91 วัน)', async () => {
    await report(page, '2026-11-30', '2027-02-28');
    const err = (await page.getByTestId('report-error').count()) ? (await page.getByTestId('report-error').innerText()).trim() : '';
    expect.soft(err, '30 พ.ย. → 28 ก.พ. ต้องไม่มี error (A-46)').toBe('');
    await expect.soft(page.getByTestId('report-table')).toHaveAttribute('data-count', '91');
  });
});

test('TC-REPORT-02 รายงาน 8–8 ต.ค. (E144) เทียบ SQL', {
  tag: ['@REPORT', '@P1'],
  annotation: ann({
    tc: 'TC-REPORT-02', level: 'P1', source: '[D] TEST-DATA E144, 5.4 + [E sql:money_by_day] · FR-44, BR-40',
    expected: 'report-2026-10-08-booking 4,800 · -cash 0 · -promptpay 60 · -total 4,860 · -credit 0 · -bookings 0 · -noshow 0 · SQL 8 ต.ค. = 4,860',
  }),
}, async ({ page }) => {
  await test.step('owner รายงาน 2026-10-08 → 2026-10-08', async () => {
    await staffLoginUi(page, 'owner');
    await report(page, '2026-10-08', '2026-10-08');
    await expect.soft(page.getByTestId('report-table')).toHaveAttribute('data-count', '1');
    const want: Record<string, number> = { booking: 4800, cash: 0, promptpay: 60, total: 4860, credit: 0, bookings: 0, noshow: 0 };
    for (const [k, v] of Object.entries(want)) await softNum(page.getByTestId(`report-2026-10-08-${k}`), v, `report-2026-10-08-${k}`);
    await softNum(page.getByTestId('report-total-money'), 4860, 'report-total-money');
  });
  await test.step('[E sql:money_by_day] 8 ต.ค. = 4,860', async () => {
    expect(moneyByDay('2026-10-08')).toBe(4860);
  });
});

test('TC-REPORT-03 CSV เปิด Excel ได้ (BOM · หัวไทย · ไม่มี ฿) และบันทึก REPORT_EXPORT', {
  tag: ['@REPORT', '@P2'],
  annotation: ann({
    tc: 'TC-REPORT-03', level: 'P2', source: '[D] NFR-22, BR-42 · FR-44',
    expected: 'owner 3–9 ต.ค. กด report-csv → ไฟล์ report-2026-10-03-2026-10-09.csv · 3 ไบต์แรก EF BB BF · หัวคอลัมน์ภาษาไทย (วันที่, ยอดจอง (บาท), …) · ไม่มีอักษร ฿ · 7 แถววัน + แถว "รวม" รวมรับเงิน 7300 · /owner/audit มี REPORT_EXPORT โดย owner',
  }),
}, async ({ page }) => {
  let buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  await test.step('owner รายงาน 3–9 ต.ค. กด report-csv → ดาวน์โหลดไฟล์', async () => {
    await staffLoginUi(page, 'owner');
    await report(page, '2026-10-03', '2026-10-09');
    const dl = page.waitForEvent('download');
    await page.getByTestId('report-csv').click();
    const d = await dl;
    expect.soft(d.suggestedFilename()).toBe('report-2026-10-03-2026-10-09.csv');
    const p = await d.path();
    buf = require("node:fs").readFileSync(p);
  });
  await test.step('BOM EF BB BF · หัวไทย · ไม่มี ฿ · 7 วัน + "รวม" รวมรับเงิน 7300', async () => {
    expect.soft([...buf.subarray(0, 3)].map((x) => x.toString(16)).join(' ')).toBe('ef bb bf');
    const text = buf.toString('utf8').replace(/^﻿/, '');
    expect.soft(text.includes('฿'), 'ไม่มีอักษร ฿').toBe(false);
    const rows = parseCsv(text);
    const head = rows[0] ?? [];
    expect.soft(head[0]).toBe('วันที่');
    expect.soft(head).toContain('ยอดจอง (บาท)');
    const days = rows.slice(1).filter((r) => /^2026-10-0[3-9]$/.test(r[0]));
    expect.soft(days.length, 'แถววัน').toBe(7);
    const sum = rows.find((r) => r[0] === 'รวม');
    expect.soft(sum, 'แถว "รวม"').toBeTruthy();
    const col = head.findIndex((h) => /รวมรับเงิน/.test(h));
    expect.soft(col, 'คอลัมน์รวมรับเงิน').toBeGreaterThan(0);
    expect.soft(Number(sum?.[col]), 'รวมรับเงิน 7 วัน').toBe(7300);
  });
  await test.step('/owner/audit มี REPORT_EXPORT โดย owner', async () => {
    const rows = await auditRows(page);
    const a = rows.find((r) => r.action === 'REPORT_EXPORT');
    expect.soft(a, JSON.stringify(rows)).toBeTruthy();
    expect.soft(a?.user ?? '').toMatch(/owner|คุณเอก/);
  });
});

test('TC-REPORT-04 หัวข้อที่ร้านขอในรายงาน: เงินแยก มัดจำพร้อมเพย์ / เก็บหน้าสนาม / หักเครดิต + ชั่วโมงต่อสนาม', {
  tag: ['@REPORT', '@P2'],
  annotation: ann({
    tc: 'TC-REPORT-04', level: 'P2', source: '[D] INTERVIEW รอบ 2 (คุณเอก "ในรายงานขอ…"), US-48 เกณฑ์ข้อ 2 · [D A-41] มัดจำพร้อมเพย์ / เก็บหน้าสนาม เป็น 2 คอลัมน์ · [D A-42] ชั่วโมงที่ใช้ต่อสนาม (ชั่วโมง + %) · [E sql:pay_split] [E sql:hours_by_field]',
    expected: 'รายงาน 3–9 ต.ค. (หน้าเว็บ + CSV) มีตัวเลขแยก: มัดจำพร้อมเพย์ของการจอง ฿6,600 · เก็บหน้าสนาม ฿600 (2 คอลัมน์ A-41) · หักเครดิต ฿0 · ชั่วโมงที่ใช้ของแต่ละสนาม ชั่วโมง + % (A-42 · ค่าตาม SQL) · จำนวนการจองแยกสถานะ · ส่วนลด · ชั่วโมงฟรี · ค่าของเช่า · ยอดขายหน้าเคาน์เตอร์ ฿100',
  }),
}, async ({ page }) => {
  let head: string[] = []; let sum: string[] = [];
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const val = (re: RegExp) => { const i = col(re); return i < 0 ? NaN : Number(sum[i]); };
  await test.step('[E sql:pay_split] PROMPTPAY ฿6,600 · CASH_AT_FIELD ฿600 (ยืนยันเฉลยกับฐานข้อมูล)', async () => {
    const split = sql(`select m || ':' || a from (select method m, sum(amount) a from payments where (paid_at at time zone 'Asia/Bangkok')::date between '2026-10-03' and '2026-10-09' group by method) x order by 1`);
    expect.soft(split.split('\n')).toEqual(['CASH_AT_FIELD:600', 'PROMPTPAY:6600']);
  });
  await test.step('owner รายงาน 3–9 ต.ค. บนหน้าเว็บ: มีคอลัมน์ "เก็บหน้าสนาม" แยกจากพร้อมเพย์ (A-41)', async () => {
    await staffLoginUi(page, 'owner');
    await report(page, '2026-10-03', '2026-10-09');
    const t = (await page.getByTestId('report-table').innerText()).replace(/\s+/g, ' ');
    expect.soft(t, 'หัวตารางมี "หน้าสนาม"').toMatch(/หน้าสนาม/);
    expect.soft(t, 'หัวตารางมี "พร้อมเพย์" ของการจอง/มัดจำ').toMatch(/(มัดจำ|จอง)[^|]{0,20}พร้อมเพย์|พร้อมเพย์[^|]{0,20}(มัดจำ|จอง)/);
  });
  await test.step('CSV: หัวข้อครบตามที่ร้านขอ + ค่าแถว "รวม"', async () => {
    const r = await page.request.get('/api/owner/reports.csv?from=2026-10-03&to=2026-10-09');
    const rows = parseCsv((await r.text()).replace(/^﻿/, ''));
    head = rows[0] ?? [];
    sum = rows.find((x) => x[0] === 'รวม') ?? [];
    expect.soft(val(/(มัดจำ|จอง).*พร้อมเพย์|พร้อมเพย์.*(มัดจำ|จอง)/), `มัดจำพร้อมเพย์ของการจอง ฿6,600 (A-41) · หัว: ${head.join(' | ')}`).toBe(6600);
    expect.soft(val(/หน้าสนาม/), 'เก็บหน้าสนาม ฿600 (A-41)').toBe(600);
    expect.soft(val(/เครดิต/), 'หักเครดิต ฿0').toBe(0);
    expect.soft(val(/ยอดขายรวม|ขายหน้าเคาน์เตอร์/), 'ยอดขายหน้าเคาน์เตอร์ ฿100').toBe(100);
    for (const re of [/ส่วนลด/, /ชั่วโมงฟรี/, /ของเช่า/]) expect.soft(col(re), `มีคอลัมน์ ${re}`).toBeGreaterThan(0);
    for (const s of ['CONFIRMED|ยืนยัน', 'CHECKED_IN|เช็กอิน', 'NO_SHOW|ไม่มา', 'CANCELLED|ยกเลิก']) expect.soft(col(new RegExp(s)), `มีคอลัมน์จำนวนการจองสถานะ ${s}`).toBeGreaterThan(0);
  });
  await test.step('[A-42] ชั่วโมงที่ใช้ต่อสนาม (ชั่วโมง + %) ตรงกับ [E sql:hours_by_field]', async () => {
    // ชั่วโมงที่ใช้ = การจองที่กันสนาม (กฎเดียวกับ util_today ในแผน 7.3) ตามวันเตะ 3–9 ต.ค. · % = ชั่วโมง ÷ (7 วัน × 16 ชม.)
    const rows = sql(`select id || ':' || h from (select f.id, coalesce(sum(b.hours),0) h from fields f left join bookings b on b.field_id=f.id and b.date between '2026-10-03' and '2026-10-09' and b.status in ('PENDING_PAYMENT','CONFIRMED','CHECKED_IN','NO_SHOW') group by f.id) x order by 1`).split('\n');
    const hours = Object.fromEntries(rows.map((x) => x.split(':')).map(([f, h]) => [f, Number(h)]));
    for (const f of ['A', 'B', 'C']) {
      const h = col(new RegExp(`(ชั่วโมง|ชม).*สนาม\\s*${f}|สนาม\\s*${f}.*(ชั่วโมง|ชม)`));
      expect.soft(h, `CSV มีคอลัมน์ชั่วโมงสนาม ${f}`).toBeGreaterThan(0);
      if (h > 0) expect.soft(Number(sum[h]), `ชั่วโมงสนาม ${f} = ${hours[f]}`).toBe(hours[f]);
      expect.soft(col(new RegExp(`%.*สนาม\\s*${f}|สนาม\\s*${f}.*%`)), `CSV มีคอลัมน์ % สนาม ${f}`).toBeGreaterThan(0);
    }
  });
});

test('TC-REPORT-05 เงินนับวันรับ · การจองนับวันเตะ (BR-40 "มัดจำวันที่ 9 การจองวันที่ 12")', {
  tag: ['@REPORT', '@P1'],
  annotation: ann({
    tc: 'TC-REPORT-05', level: 'P1', source: '[D] BR-40 ค่าขอบ, A-36 T-10 · FR-44',
    expected: 'จอง A จ 12 09:00 จ่ายมัดจำ ฿400 วันนี้ · owner รายงาน 9–12 ต.ค.: แถว 9 ต.ค. -booking 400 -bookings 1 (LN-900001) · แถว 12 ต.ค. -booking 0 -bookings 1 · แถว 10 ต.ค. bookings 1 (LN-900002) · 11 ต.ค. 1 (LN-900004)',
  }),
}, async ({ page, newUserPage }) => {
  await test.step('ลูกค้าจอง A จ 12 09:00 จ่ายมัดจำ ฿400', async () => {
    const c = await newUserPage();
    await bookAndPayUi(c, { field: 'A', date: '2026-10-12', start: 9, name: 'ทีมวันจันทร์', phone: uniquePhone(3) });
    await expect.soft(c.getByTestId('amount-paid')).toHaveAttribute('data-value', '400');
  });
  await test.step('owner รายงาน 9–12 ต.ค.', async () => {
    await staffLoginUi(page, 'owner');
    await report(page, '2026-10-09', '2026-10-12');
    await expect.soft(page.getByTestId('report-table')).toHaveAttribute('data-count', '4');
    await softNum(page.getByTestId('report-2026-10-09-booking'), 400, '9 ต.ค. ยอดจอง');
    await softNum(page.getByTestId('report-2026-10-09-bookings'), 1, '9 ต.ค. จำนวนการจอง (LN-900001)');
    await softNum(page.getByTestId('report-2026-10-10-bookings'), 1, '10 ต.ค. จำนวนการจอง (LN-900002)');
    await softNum(page.getByTestId('report-2026-10-11-bookings'), 1, '11 ต.ค. จำนวนการจอง (LN-900004)');
    await softNum(page.getByTestId('report-2026-10-12-booking'), 0, '12 ต.ค. ยอดจอง');
    await softNum(page.getByTestId('report-2026-10-12-bookings'), 1, '12 ต.ค. จำนวนการจอง');
  });
});

// ================================================================ TRACK
const steps = (page: Page) => page.locator('[data-testid^="timeline-step-"]').evaluateAll((es) => es.map((e) => ({ status: e.getAttribute('data-status') ?? '', current: e.getAttribute('aria-current') ?? '', text: (e.textContent ?? '').replace(/\s+/g, ' ').trim() })));

test('TC-TRACK-01 ขั้นสถานะการจองพร้อมเวลา: จองแล้ว → จ่ายแล้ว → เช็กอิน → จบ (A-43, A-45)', {
  tag: ['@TRACK', '@P3'],
  annotation: ann({
    tc: 'TC-TRACK-01', level: 'P3', source: '[D] US-49 · FR-45, BR-42 · [D A-43] ขั้น "จบ" หลังเวลาเล่นจบ เป็นขั้นสุดท้าย · [D A-45] เช็กอินในวันเตะ',
    expected: 'จอง จ 12 A 08 จ่าย: booking-timeline data-count 2 PENDING_PAYMENT, CONFIRMED เวลา "9 ต.ค. 2026 10:00" · วันเตะ 12 ต.ค. 07:50 staff เช็กอิน → 3 ขั้น ขั้นสุดท้าย CHECKED_IN aria-current="step" ไม่มีชื่อพนักงาน · 12 ต.ค. 09:00 (เล่นจบ) → ขั้นสุดท้าย "จบ" (aria-current) ต่อจากเช็กอิน',
  }),
}, async ({ page, request, staffApi }) => {
  let code = '';
  await test.step('จอง จ 12 A 08:00 จ่าย → 2 ขั้น เวลา 9 ต.ค. 2026 10:00', async () => {
    code = (await createBooking(page.request, { fieldId: 'A', date: '2026-10-12', startHour: 8, phone: uniquePhone(3), name: 'ทีมเช้า' })).code;
    await payBooking(page.request, code);
    await open(page, `/booking/${code}`);
    await expect.soft(page.getByTestId('booking-timeline')).toHaveAttribute('data-count', '2');
    const s = await steps(page);
    expect.soft(s.map((x) => x.status)).toEqual(['PENDING_PAYMENT', 'CONFIRMED']);
    await expect.soft(page.getByTestId('timeline-time-0')).toContainText('9 ต.ค. 2026 10:00');
    await expect.soft(page.getByTestId('timeline-time-1')).toContainText('9 ต.ค. 2026 10:00');
    expect.soft(s[s.length - 1]?.current).toBe('step');
  });
  await test.step('วันเตะ 12 ต.ค. 07:50 staff เช็กอิน → รีโหลด 3 ขั้น CHECKED_IN aria-current ไม่มีชื่อพนักงาน', async () => {
    await setClock(request, T('2026-10-12T07:50:00'));
    const s = await staffApi('staff');
    const r = await postJson(s, `/api/staff/bookings/${code}/checkin`, {});
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    await open(page, `/booking/${code}`);
    await expect.soft(page.getByTestId('booking-timeline')).toHaveAttribute('data-count', '3');
    const st = await steps(page);
    expect.soft(st.map((x) => x.status)).toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN']);
    expect.soft(st[2]?.current).toBe('step');
    await expect.soft(page.getByTestId('timeline-time-2')).toContainText('12 ต.ค. 2026 07:50');
    const t = await page.getByTestId('booking-timeline').innerText();
    expect.soft(t, 'ไม่มีชื่อ/username พนักงาน').not.toMatch(/staff|น้องบอล/);
  });
  await test.step('[A-43] 12 ต.ค. 09:00 เวลาเล่นจบแล้ว → ขั้นสุดท้าย "จบ"', async () => {
    await setClock(request, T('2026-10-12T09:00:00'));
    await open(page, `/booking/${code}`);
    const st = await steps(page);
    expect.soft(st.length, `ขั้นทั้งหมด ${JSON.stringify(st)}`).toBe(4);
    expect.soft(st[st.length - 1]?.text ?? '', 'ขั้นสุดท้ายคือ "จบ"').toMatch(/จบ/);
    expect.soft(st[st.length - 1]?.current, 'ขั้น "จบ" เป็นขั้นปัจจุบัน').toBe('step');
    expect.soft(st.slice(0, 3).map((x) => x.status)).toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN']);
  });
});

test('TC-TRACK-02 ขั้นสถานะเมื่อยกเลิก / หมดเวลาจ่าย', {
  tag: ['@TRACK', '@P3'],
  annotation: ann({
    tc: 'TC-TRACK-02', level: 'P3', source: '[D] FR-45, BR-42, BR-10',
    expected: 'ยกเลิก → 3 ขั้น PENDING_PAYMENT → CONFIRMED → CANCELLED · หมดเวลา (clock 10:15:01) → 2 ขั้น PENDING_PAYMENT → EXPIRED',
  }),
}, async ({ page, request }) => {
  await test.step('จอง จ่าย ยกเลิก → 3 ขั้น', async () => {
    const code = (await createBooking(page.request, { fieldId: 'B', date: '2026-10-12', startHour: 10, phone: uniquePhone(3), name: 'ทีมยกเลิก' })).code;
    await payBooking(page.request, code);
    await open(page, `/booking/${code}`);
    await page.getByTestId('cancel-booking').click();
    await page.getByTestId('cancel-confirm').click();
    await expect(page.getByTestId('success-message')).toBeVisible();
    await open(page, `/booking/${code}`);
    await expect.soft(page.getByTestId('booking-timeline')).toHaveAttribute('data-count', '3');
    const s = await steps(page);
    expect.soft(s.map((x) => x.status)).toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED']);
    expect.soft(s[2]?.current).toBe('step');
  });
  await test.step('จองไม่จ่าย → clock 10:15:01 → 2 ขั้น PENDING_PAYMENT → EXPIRED', async () => {
    const code = (await createBooking(page.request, { fieldId: 'B', date: '2026-10-12', startHour: 11, phone: uniquePhone(3), name: 'ทีมไม่จ่าย' })).code;
    await setClock(request, T('2026-10-09T10:15:01'));
    await open(page, `/booking/${code}`);
    await expect.soft(page.getByTestId('booking-timeline')).toHaveAttribute('data-count', '2');
    const s = await steps(page);
    expect.soft(s.map((x) => x.status)).toEqual(['PENDING_PAYMENT', 'EXPIRED']);
  });
});

// ================================================================ DATA
test('TC-DATA-01 staff กดไม่มา LN-900001 ตอน 19:15 → ประวัติ (ชื่อพนักงาน A-44) + AuditLog (E146)', {
  tag: ['@DATA', '@P2'],
  annotation: ann({
    tc: 'TC-DATA-01', level: 'P2', source: '[D] TEST-DATA E146, US-47, US-51 · [D A-44] ประวัติแสดงชื่อพนักงาน (ไม่ใช่ username) · FR-43, FR-47, BR-42',
    expected: 'clock 19:15 staff /staff?code=LN-900001 กดไม่มา → "บันทึกไม่มาแล้ว" · owner /owner/bookings/LN-900001 แถวล่าสุด ยืนยันแล้ว → ไม่มา ผู้ทำ "น้องบอล" (ชื่อพนักงาน A-44) เวลา 9 ต.ค. 2026 19:15 · /owner/audit NO_SHOW ผู้ใช้ staff target LN-900001 · LN-900008 มี 3 แถว (ลูกค้า, ลูกค้า, น้องบอล)',
  }),
}, async ({ page, request }) => {
  await test.step('clock 19:15 staff ค้น LN-900001 กดไม่มา', async () => {
    await setClock(request, T('2026-10-09T19:15:00'));
    await staffLoginUi(page, 'staff');
    await open(page, '/staff?code=LN-900001');
    await expect(page.getByTestId('staff-booking-code')).toHaveText('LN-900001');
    await page.getByTestId('staff-no-show').click();
    await expectSuccess(page, 'บันทึกไม่มาแล้ว');
  });
  await test.step('owner ประวัติ LN-900001: แถวล่าสุด CONFIRMED → NO_SHOW ผู้ทำ "น้องบอล" เวลา 9 ต.ค. 2026 19:15', async () => {
    await staffLoginUi(page, 'owner');
    await open(page, '/owner/bookings/LN-900001');
    const n = Number(await page.getByTestId('history-table').getAttribute('data-count'));
    const i = n - 1;
    await expect.soft(page.getByTestId(`history-from-${i}`)).toHaveAttribute('data-value', 'CONFIRMED');
    await expect.soft(page.getByTestId(`history-to-${i}`)).toHaveAttribute('data-value', 'NO_SHOW');
    await expect.soft(page.getByTestId(`history-at-${i}`)).toContainText('9 ต.ค. 2026 19:15');
    await expect.soft(page.getByTestId(`history-actor-${i}`), 'ผู้ทำ = ชื่อพนักงาน (A-44)').toHaveText('น้องบอล');
  });
  await test.step('/owner/audit มี NO_SHOW ของ staff target LN-900001', async () => {
    const rows = await auditRows(page);
    const a = rows.find((r) => r.action === 'NO_SHOW' && r.target.includes('LN-900001'));
    expect.soft(a, JSON.stringify(rows)).toBeTruthy();
    expect.soft(a?.user ?? '').toMatch(/staff|น้องบอล/);
  });
  await test.step('LN-900008 ประวัติ 3 แถว ผู้ทำ ลูกค้า, ลูกค้า, น้องบอล', async () => {
    await open(page, '/owner/bookings/LN-900008');
    await expect.soft(page.getByTestId('history-table')).toHaveAttribute('data-count', '3');
    const actors = [];
    for (let i = 0; i < 3; i++) actors.push((await page.getByTestId(`history-actor-${i}`).innerText()).trim());
    expect.soft(actors).toEqual(['ลูกค้า', 'ลูกค้า', 'น้องบอล']);
  });
});

test('TC-DATA-02 ไม่มีทางแก้/ลบประวัติสถานะและ AuditLog (E147)', {
  tag: ['@DATA', '@P2'],
  annotation: ann({
    tc: 'TC-DATA-02', level: 'P2', source: '[D] TEST-DATA E147 · FR-47, BR-42 · [E sql:history_of]',
    expected: 'PUT/PATCH/DELETE/POST /api/owner/bookings/LN-900008/history → 404 · PUT/DELETE/POST /api/owner/audit และ /api/owner/audit/1 → 404 · GET ประวัติยัง 3 แถว',
  }),
}, async ({ staffApi }) => {
  const o = await staffApi('owner');
  await test.step('ยิงทุก method ที่เขียน → 404', async () => {
    for (const m of ['put', 'patch', 'delete', 'post'] as const) {
      const r = await o[m]('/api/owner/bookings/LN-900008/history', { data: { toStatus: 'CONFIRMED' } });
      expect.soft(r.status(), `${m.toUpperCase()} history`).toBe(404);
    }
    for (const url of ['/api/owner/audit', '/api/owner/audit/1']) {
      for (const m of ['put', 'delete', 'post'] as const) {
        const r = await o[m](url, { data: {} });
        expect.soft(r.status(), `${m.toUpperCase()} ${url}`).toBe(404);
      }
    }
  });
  await test.step('GET ประวัติ LN-900008 ยัง 3 แถว (และ [E sql:history_of] = 3)', async () => {
    const r = await getJson(o, '/api/owner/bookings/LN-900008/history');
    expect.soft(r.status).toBe(200);
    expect.soft((r.body?.history ?? []).length).toBe(3);
    expect.soft(sqlNum(`select count(*) from booking_status_history h join bookings b on b.id=h.booking_id where b.code='LN-900008'`)).toBe(3);
  });
});

test('TC-DATA-03 migration รันซ้ำและถอยกลับโดยการจองเดิมอยู่ครบ (E148)', {
  tag: ['@DATA', '@P2'],
  annotation: ann({
    tc: 'TC-DATA-03', level: 'P2', source: '[D] TEST-DATA E148, US-52 · FR-46, FR-48, BR-43, NFR-20 · [E sql:migrations]',
    expected: 'backup → migrate × 2 ไม่ error · select count(*) from bookings = 8 ก่อน/หลัง · ไม่ซ้ำ · --down 006 แล้วการจองยัง 8 · migrate กลับ',
  }),
}, async () => {
  // สคริปต์ของผู้ดูแลระบบ (scripts/backup.mjs เขียนลง db/backups · migrate --down ลบข้อมูลตารางใหม่) — รอบนี้ห้ามแตะ db/
  // เปิดรันได้เมื่อผู้ดูแลอนุญาต: RUN_MIGRATION_TEST=1 · ไม่ได้รัน = นับไม่ผ่าน (แผนหัวข้อ 6.4)
  test.skip(process.env.RUN_MIGRATION_TEST !== '1', 'ไม่ได้รัน: ต้องรันสคริปต์ backup/migrate --down ซึ่งเขียน db/backups และแก้ schema (นอกสิทธิ์รอบนี้) · ตั้ง RUN_MIGRATION_TEST=1 เพื่อรัน');
  const { spawnSync } = require('node:child_process') as typeof import('node:child_process');
  const root = require('node:path').resolve(__dirname, '..', '..');
  const run = (...args: string[]) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  const count = () => sqlNum('select count(*) from bookings');
  // ORACLE-CHANGES (CR-01 · ผู้ใช้อนุมัติ 2026-10-20): รายการ migration ที่คาดหวัง = ไฟล์ขึ้น (ไม่ใช่ .down) ใน db/migrations
  const expectedVersions = require('node:fs').readdirSync(require('node:path').join(root, 'db', 'migrations'))
    .filter((f: string) => /^\d{3}_.*\.sql$/.test(f) && !f.endsWith('.down.sql'))
    .map((f: string) => f.slice(0, 3)).sort();
  await test.step(`ก่อน: bookings 8 · [E sql:migrations] 001–${expectedVersions.at(-1)}`, async () => {
    expect(count()).toBe(8);
    expect(sql('select version from schema_migrations order by 1').split('\n')).toEqual(expectedVersions);
  });
  await test.step('backup → migrate × 2 ไม่ error · bookings 8', async () => {
    expect(run('scripts/backup.mjs').status).toBe(0);
    for (let i = 0; i < 2; i++) expect(run('scripts/migrate.mjs').status, `migrate ครั้งที่ ${i + 1}`).toBe(0);
    expect(count()).toBe(8);
  });
  await test.step('--down 006 → bookings 8 · migrate กลับ → 8', async () => {
    expect(run('scripts/migrate.mjs', '--down', '006').status).toBe(0);
    expect(count()).toBe(8);
    expect(run('scripts/migrate.mjs').status).toBe(0);
    expect(count()).toBe(8);
  });
});

// ================================================================ ROLE (คลังเปลี่ยน → ต้อง reset)
test('TC-ROLE-02 สิทธิ์คลัง: staff ขาย/ย้ายได้ · รับเข้า/ชำรุด/ปรับยอด/จุดสั่งซื้อไม่ได้ (E132)', {
  tag: ['@ROLE', '@P1'],
  annotation: ann({
    tc: 'TC-ROLE-02', level: 'P1', source: '[D] TEST-DATA E132, A-29 · BR-36, FR-40',
    expected: 'staff /manager/stock → forbidden · API receive/damage/adjust/reorder-point → 403 FORBIDDEN_ROLE คลังไม่เปลี่ยน · ขายน้ำ 1 ("บันทึกการขายแล้ว ยอด ฿10") และย้าย 1 ("ย้ายของแล้ว") → สำเร็จ',
  }),
}, async ({ page, staffApi }) => {
  const s = await staffApi('staff');
  const snap = async () => JSON.stringify(((await getJson(s, '/api/staff/stock')).body.items as any[]).map((i) => [i.id, i.store, i.counter, i.reorderPoint]));
  await test.step('staff เปิด /manager/stock → forbidden', async () => {
    await staffLoginUi(page, 'staff');
    await open(page, '/manager/stock');
    await expect.soft(page.getByTestId('forbidden-message')).toBeVisible();
    await expect.soft(page.getByTestId('receive-submit')).toHaveCount(0);
  });
  await test.step('API 4 เส้นด้วย cookie staff → 403 FORBIDDEN_ROLE · คลังไม่เปลี่ยน', async () => {
    const before = await snap();
    const calls = [
      ['receive (E132)', await postJson(s, '/api/manager/stock/receive', { itemId: 'WATER', locationId: 'STORE', qty: 10, reason: 'ทดสอบ' })],
      ['damage', await postJson(s, '/api/manager/stock/damage', { itemId: 'WATER', locationId: 'STORE', qty: 1, reason: 'ทดสอบ' })],
      ['adjust', await postJson(s, '/api/manager/stock/adjust', { itemId: 'WATER', locationId: 'STORE', countedQty: 90, reason: 'ทดสอบ' })],
      ['reorder-point', await (async () => { const r = await s.put('/api/manager/stock/items/WATER/reorder-point', { data: { reorderPoint: 5 } }); let body: any = null; try { body = await r.json(); } catch { /* */ } return { status: r.status(), body }; })()],
    ] as const;
    for (const [name, r] of calls) {
      expect.soft(r.status, name).toBe(403);
      expect.soft(r.body?.error?.code, name).toBe('FORBIDDEN_ROLE');
    }
    expect.soft(await snap(), 'คลังไม่เปลี่ยน').toBe(before);
  });
  await test.step('staff ขายน้ำ 1 และย้าย 1 ผ่านหน้าเว็บ → สำเร็จ', async () => {
    expect.soft(await sell(page, { WATER: 1 }, 'CASH')).toBe(10);
    await expectSuccess(page, 'บันทึกการขายแล้ว ยอด ฿10');
    await transfer(page, { item: 'WATER', from: 'STORE', to: 'COUNTER', qty: 1 });
    await expectSuccess(page, MOVE_OK);
  });
});

