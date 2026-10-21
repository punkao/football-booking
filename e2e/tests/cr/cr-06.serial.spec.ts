import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { test, expect, open, uniquePhone, createBooking, payBooking, getJson, postJson, resetData, setClock, waitReady, staffLoginPage } from '../fixtures';
import { ann, sql, sqlNum, T } from '../v2-helpers';

/**
 * CR-06 เงินจากทีมรับคำท้าไม่ขึ้นในรายงาน (CHANGE-REQUESTS/CR-06.md · impact docs/impact/CR-06.md)
 *
 * ค่าที่คาดหวังมาจากคำตอบร้าน CHANGE-REQUESTS/answers/README.md หัวข้อ CR-06 = [D:CR-06]
 * - เงินที่ทีมรับคำท้าโอน เข้าบัญชีพร้อมเพย์ของร้านจริง · รายงานนับในช่อง "จ่ายผ่านพร้อมเพย์" ตามวันที่รับเงิน (รวมใน "ยอดจอง" และ "รวมรับเงิน")
 * - คำท้าที่รับและจ่ายไปแล้วในอดีต: เติมบันทึกการรับเงินย้อนหลังด้วย migration (รันซ้ำได้ ถอยกลับได้ ไม่สร้างซ้ำ)
 * - เครดิตที่เจ้าของการจองได้ เหมือนเดิมทุกบาท
 *
 * *.serial: reset + เลื่อนเวลา (ตัวเลขรายวันต้องสะอาด — เงินที่ test อื่นจ่ายลงวันเดียวกันจะปนถ้ารันขนาน)
 * ตัวอย่างหลัก: เจ้าของจอง C ศ 16 ต.ค. 18:00 จ่ายเต็ม ฿1,800 · ประกาศหาคู่แข่ง → ทีมรับจ่าย ฿900 (ครึ่งหนึ่ง · BR-28)
 */

test.beforeEach(async ({ request }) => { await resetData(request); });
test.afterEach(async ({ request }, testInfo) => {
  // ข้อ CR-06-05 ถอย/ขึ้น migration — ล้มกลางทางต้องไม่ทิ้งฐานไว้ที่ schema เก่า
  if (process.env.RUN_MIGRATION_TEST === '1' && testInfo.title.startsWith('CR-06-05')) {
    spawnSync(process.execPath, ['scripts/migrate.mjs'], { cwd: path.resolve(__dirname, '..', '..', '..'), encoding: 'utf8' });
  }
  await resetData(request);
});

const ANSWER = 'CHANGE-REQUESTS/answers/README.md หัวข้อ CR-06';
const BOOK_DATE = '2026-10-16';
const TODAY = '2026-10-09';

type Day = { date: string; bookingMoney: number; bookingPromptpay: number; bookingCash: number; total: number; creditUsed: number };

async function dayReport(api: APIRequestContext, date: string): Promise<{ day: Day; totals: Record<string, number> }> {
  const r = await getJson(api, `/api/owner/reports?from=${date}&to=${date}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return { day: r.body.days[0] as Day, totals: r.body.totals };
}

/** เจ้าของจอง + จ่ายเต็ม → ประกาศหาคู่แข่ง → ทีมอื่นรับ (ยังไม่จ่าย) */
async function setup(api: APIRequestContext, b: number) {
  const ownerPhone = uniquePhone(b);
  const rivalPhone = uniquePhone(b);
  const bk = await createBooking(api, { fieldId: 'C', date: BOOK_DATE, startHour: 18, phone: ownerPhone, name: 'เจ้าของสนาม' });
  const paid = await payBooking(api, bk.code, ownerPhone);
  expect(paid.amount).toBe(1800);
  const c = await postJson(api, '/api/challenges', { code: bk.code, phone: ownerPhone, teamName: 'ทีมเจ้าบ้าน', level: 'INTERMEDIATE' });
  expect(c.status, JSON.stringify(c.body)).toBe(200);
  const id = c.body.challenge.id as number;
  expect(c.body.challenge.amount).toBe(900);
  const a = await postJson(api, `/api/challenges/${id}/accept`, { name: 'ทีมรับคำท้า', phone: rivalPhone, consent: true });
  expect(a.status, JSON.stringify(a.body)).toBe(200);
  return { code: bk.code as string, id, ownerPhone, rivalPhone };
}

/** เครดิตของเจ้าของการจอง: ยอดคงเหลือ + รายการทั้งหมด (ตรวจ "เหมือนเดิมทุกบาท") */
function creditSnapshot(phone: string) {
  return {
    balance: sqlNum(`select credit_balance from customers where phone='${phone}'`),
    entries: sql(`select e.amount||'|'||e.reason||'|'||e.booking_id||'|'||to_char(e.created_at at time zone 'Asia/Bangkok','YYYY-MM-DD HH24:MI:SS') from credit_entries e join customers c on c.id=e.customer_id where c.phone='${phone}' order by e.id`),
    sum: sqlNum(`select coalesce(sum(e.amount),0) from credit_entries e join customers c on c.id=e.customer_id where c.phone='${phone}'`),
  };
}

test('CR-06-01 ทีมรับคำท้าโอนเงินแล้ว เงินก้อนนั้นขึ้นในรายงานช่อง "จ่ายผ่านพร้อมเพย์" (รวมในยอดจองและรวมรับเงินด้วย)', {
  tag: ['@CR-06', '@P1'],
  annotation: ann({
    tc: 'CR-06-01', level: 'P1', source: `[D:CR-06] ${ANSWER} ข้อ 1–2 · CHANGE-REQUESTS/CR-06.md ข้อ 1 · docs/impact/CR-03.md ข้อ 5 · SPEC-GAPS G-15`,
    expected: '9 ต.ค.: เจ้าของจ่ายเต็ม ฿1,800 → รายงานพร้อมเพย์ ฿1,800 · ทีมรับคำท้ารับแล้วยังไม่จ่าย → ยังเท่าเดิม · ทีมรับจ่าย ฿900 → พร้อมเพย์ ฿2,700 · ยอดจอง ฿2,700 · รวมรับเงินเพิ่มขึ้น ฿900 · หน้าเว็บ report-total-booking-promptpay = 2700 · แถวเงินใหม่ผูกกับการจองของเจ้าของ (PROMPTPAY ฿900)',
  }),
}, async ({ page, staffApi, b }) => {
  const owner = await staffApi('owner');
  const { code, id, rivalPhone } = await setup(page.request, b);
  let before: Awaited<ReturnType<typeof dayReport>>;
  await test.step('ก่อนทีมรับจ่าย: รายงาน 9 ต.ค. มีแต่เงินที่เจ้าของจ่าย (พร้อมเพย์ ฿1,800 ของการจองนี้ + เงินอื่นของวัน)', async () => {
    before = await dayReport(owner, TODAY);
    expect(before.day.bookingPromptpay, 'พร้อมเพย์ของวัน = ฿1,800 ที่เจ้าของจ่าย [E seed ไม่มีเงินพร้อมเพย์วันที่ 9 ต.ค.]').toBe(1800);
  });
  await test.step('ทีมรับคำท้าโอนส่วนของทีม ฿900 → "ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย"', async () => {
    const r = await postJson(page.request, `/api/challenges/${id}/pay`, { phone: rivalPhone });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.challenge.status).toBe('MATCHED');
  });
  await test.step('รายงาน 9 ต.ค. (JSON): พร้อมเพย์ ฿2,700 · ยอดจอง ฿2,700 · รวมรับเงินเพิ่ม ฿900 · หน้าสนาม 0', async () => {
    const after = await dayReport(owner, TODAY);
    expect.soft(after.day.bookingPromptpay, 'พร้อมเพย์ = 1,800 + 900 [D:CR-06]').toBe(2700);
    expect.soft(after.day.bookingMoney, 'ยอดจอง = 2,700 [D:CR-06 "รวมอยู่ใน ยอดจอง"]').toBe(2700);
    expect.soft(after.day.total - before.day.total, 'รวมรับเงินเพิ่ม ฿900 [D:CR-06 "รวมอยู่ใน รวมรับเงิน"]').toBe(900);
    expect.soft(after.day.bookingCash, 'เงินสดหน้าสนามไม่เกี่ยว').toBe(0);
    expect.soft(after.totals.bookingPromptpay).toBe(2700);
  });
  await test.step('ร้านเปิดหน้ารายงาน 9 ต.ค. เห็นพร้อมเพย์ ฿2,700', async () => {
    await staffLoginPage(page, 'owner');
    await open(page, '/owner/reports');
    await page.getByTestId('report-from').fill(TODAY);
    await page.getByTestId('report-to').fill(TODAY);
    await page.getByTestId('report-submit').click();
    await waitReady(page);
    await expect.soft(page.getByTestId('report-total-booking-promptpay')).toHaveAttribute('data-value', '2700');
    await expect.soft(page.getByTestId('report-total-booking')).toHaveAttribute('data-value', '2700');
  });
  await test.step('เงินก้อนนี้เป็นแถวพร้อมเพย์ ฿900 ของการจองเจ้าของ (เจ้าของมีแถวเงิน ฿1,800 + ฿900)', async () => {
    const rows = sql(`select p.amount||'|'||p.method from payments p join bookings k on k.id=p.booking_id where k.code='${code}' order by p.id`).split('\n');
    expect(rows).toEqual(['1800|PROMPTPAY', '900|PROMPTPAY']);
  });
});

test('CR-06-02 นับตามวันที่รับเงิน: ทีมรับคำท้าจ่ายวันไหน เงินขึ้นในรายงานวันนั้น', {
  tag: ['@CR-06', '@P2'],
  annotation: ann({
    tc: 'CR-06-02', level: 'P2', source: `[D:CR-06] ${ANSWER} ข้อ 2 "ตามวันที่รับเงิน" · BR-40 / T-10`,
    expected: 'เจ้าของจองและจ่าย 9 ต.ค. · ทีมรับคำท้ารับและจ่ายวันที่ 12 ต.ค. → รายงาน 12 ต.ค. พร้อมเพย์ ฿900 · รายงาน 9 ต.ค. ยัง ฿1,800 ไม่เปลี่ยน',
  }),
}, async ({ page, staffApi, b }) => {
  const owner = await staffApi('owner');
  const ownerPhone = uniquePhone(b);
  const rivalPhone = uniquePhone(b);
  let id = 0;
  await test.step('9 ต.ค. เจ้าของจองและจ่ายเต็ม ฿1,800 แล้วประกาศหาคู่แข่ง', async () => {
    const bk = await createBooking(page.request, { fieldId: 'C', date: BOOK_DATE, startHour: 18, phone: ownerPhone, name: 'เจ้าของสนาม' });
    await payBooking(page.request, bk.code, ownerPhone);
    const c = await postJson(page.request, '/api/challenges', { code: bk.code, phone: ownerPhone, teamName: 'ทีมเจ้าบ้าน', level: 'BEGINNER' });
    expect(c.status).toBe(200);
    id = c.body.challenge.id;
  });
  await test.step('12 ต.ค. 10:00 ทีมรับคำท้ารับแล้วจ่าย ฿900 ทันที', async () => {
    await setClock(page.request, T('2026-10-12T10:00:00'));
    const a = await postJson(page.request, `/api/challenges/${id}/accept`, { name: 'ทีมรับคำท้า', phone: rivalPhone, consent: true });
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    const r = await postJson(page.request, `/api/challenges/${id}/pay`, { phone: rivalPhone });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  });
  await test.step('รายงาน 12 ต.ค. พร้อมเพย์ ฿900 · รายงาน 9 ต.ค. ยัง ฿1,800 (ไม่ย้อนไปนับ)', async () => {
    expect.soft((await dayReport(owner, '2026-10-12')).day.bookingPromptpay, '12 ต.ค. = 900 [D:CR-06]').toBe(900);
    expect.soft((await dayReport(owner, TODAY)).day.bookingPromptpay, '9 ต.ค. = 1,800 เท่าเดิม').toBe(1800);
  });
});

test('CR-06-03 เครดิตที่เจ้าของการจองได้ เหมือนเดิมทุกบาท (฿900 หนึ่งรายการ เหตุผลคำท้า · ไม่เพิ่ม ไม่ลด ไม่ซ้ำ)', {
  tag: ['@CR-06', '@P1'],
  annotation: ann({
    tc: 'CR-06-03', level: 'P1', source: `[D:CR-06] ${ANSWER} ข้อ 4 "เหมือนเดิมทุกบาท" · BR-28 / BR-15 · TC-TEAM-02`,
    expected: 'ก่อนทีมรับจ่าย: เครดิตเจ้าของ ฿0 ไม่มีรายการ · หลังจ่าย: ยอดเครดิต ฿900 · รายการเครดิตมี 1 แถว "900|CHALLENGE|<การจองนี้>|9 ต.ค. 10:00" ผลรวมรายการ ฿900 · ยอดชำระ/ค้างจ่ายของการจองไม่เปลี่ยน (จ่ายแล้ว ฿1,800 ค้าง ฿0)',
  }),
}, async ({ page, b }) => {
  const { code, id, ownerPhone, rivalPhone } = await setup(page.request, b);
  const before = creditSnapshot(ownerPhone);
  await test.step('ก่อนทีมรับจ่าย: เครดิตเจ้าของ ฿0 และไม่มีรายการเครดิต', async () => {
    expect(before).toEqual({ balance: 0, entries: '', sum: 0 });
  });
  await test.step('ทีมรับคำท้าจ่าย ฿900', async () => {
    const r = await postJson(page.request, `/api/challenges/${id}/pay`, { phone: rivalPhone });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  });
  await test.step('เครดิตเจ้าของ = ฿900 ตามเดิม · รายการเดียว เหตุผล CHALLENGE ของการจองนี้ · ผลรวมรายการ = ยอดคงเหลือ', async () => {
    const bookingId = sqlNum(`select id from bookings where code='${code}'`);
    const after = creditSnapshot(ownerPhone);
    expect.soft(after.balance, 'ยอดเครดิต').toBe(900);
    expect.soft(after.entries, 'รายการเครดิต (แถวเดียว ไม่ซ้ำ)').toBe(`900|CHALLENGE|${bookingId}|2026-10-09 10:00:00`);
    expect.soft(after.sum, 'ผลรวมรายการเครดิต').toBe(900);
    expect.soft(sqlNum(`select count(*) from credit_entries where reason='CHALLENGE'`), 'รายการเครดิตคำท้าทั้งระบบ').toBe(1);
  });
  await test.step('การจองของเจ้าของ: ยอดจ่ายแล้ว ฿1,800 ค้างจ่าย ฿0 สถานะยืนยัน (ไม่ถูกแตะ)', async () => {
    const row = sql(`select amount_paid||'|'||due_at_field||'|'||status||'|'||credit_used from bookings where code='${code}'`);
    expect(row).toBe('1800|0|CONFIRMED|0');
  });
});

test('CR-06-04 คำท้าที่ทีมรับแล้วแต่ยังไม่จ่าย หรือจ่ายไม่ทันเวลา ไม่ถูกนับเป็นเงินของร้าน', {
  tag: ['@CR-06', '@P2'],
  annotation: ann({
    tc: 'CR-06-04', level: 'P2', source: `[D:CR-06] ${ANSWER} ข้อ 1 "เงินที่ทีมรับคำท้าโอน" (ไม่โอน = ไม่มีเงิน) · BR-28 / A-23 จ่ายภายใน 15 นาที`,
    expected: 'รับแล้วยังไม่จ่าย → พร้อมเพย์ ฿1,800 เท่าเดิม · จ่ายตอน 15 นาที 1 วินาที → ถูกปฏิเสธ (CHALLENGE_PAYMENT_EXPIRED) · พร้อมเพย์ยัง ฿1,800 · เครดิตเจ้าของ ฿0',
  }),
}, async ({ page, staffApi, b }) => {
  const owner = await staffApi('owner');
  const { id, ownerPhone, rivalPhone } = await setup(page.request, b);
  await test.step('รับแล้วยังไม่จ่าย → พร้อมเพย์ 9 ต.ค. ยัง ฿1,800', async () => {
    expect((await dayReport(owner, TODAY)).day.bookingPromptpay).toBe(1800);
  });
  await test.step('จ่ายหลังเลย 15 นาที → ถูกปฏิเสธ · พร้อมเพย์และเครดิตเท่าเดิม', async () => {
    await setClock(page.request, T('2026-10-09T10:15:01'));
    const r = await postJson(page.request, `/api/challenges/${id}/pay`, { phone: rivalPhone });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.body?.error?.code).toBe('CHALLENGE_PAYMENT_EXPIRED');
    expect((await dayReport(owner, TODAY)).day.bookingPromptpay).toBe(1800);
    expect(creditSnapshot(ownerPhone).balance).toBe(0);
  });
});

// ---------------------------------------------------------------- รายงานเดือนก่อน ๆ (migration 009 · ซ้อมบนฐานจริง)
test('CR-06-05 คำท้าที่จ่ายไปแล้วในอดีต: migration 009 เติมบันทึกรับเงินย้อนหลัง รายงานวันเก่าถูก · รันซ้ำไม่ซ้ำ · ถอยกลับลบเฉพาะที่เติม · เครดิตเดิม', {
  tag: ['@CR-06', '@P1'],
  annotation: ann({
    tc: 'CR-06-05', level: 'P1', source: `[D:CR-06] ${ANSWER} ข้อ 3 (migration รันซ้ำได้ ถอยกลับได้ ไม่สร้างซ้ำ) · CR-PROMPT ขั้น 5 · BR-43`,
    expected: 'คำท้าที่จ่ายแล้ว 15 ก.ย. 20:30 (เครดิตเจ้าของ ฿900 ตามระบบเดิม ไม่มีแถวเงิน) → ก่อน migration รายงาน 15 ก.ย. พร้อมเพย์ ฿0 · migrate ขึ้น ×2 → ฿900 แถวเงินเพิ่ม 1 แถวเท่านั้น (ไม่ซ้ำ) · เครดิตเจ้าของเหมือนเดิมทุกบาท · ถอยกลับ 009 → แถวเงินกลับเท่าก่อนทุกแถว รายงาน ฿0 · ขึ้นใหม่ → ฿900 แถวเดียว · bookings 8+ ไม่เปลี่ยน',
  }),
}, async ({ page, staffApi, b }) => {
  test.skip(process.env.RUN_MIGRATION_TEST !== '1', 'ไม่ได้รัน: ต้องรัน migrate --down/ขึ้น ซึ่งแก้ schema · ตั้ง RUN_MIGRATION_TEST=1 เพื่อรัน (เหมือน TC-DATA-03)');
  const root = path.resolve(__dirname, '..', '..', '..');
  const migrate = (...args: string[]) => spawnSync(process.execPath, ['scripts/migrate.mjs', ...args], { cwd: root, encoding: 'utf8' });
  const exec = (q: string) => {
    const r = spawnSync('docker', ['exec', 'football-db', 'psql', '-U', 'football', '-d', 'football', '-v', 'ON_ERROR_STOP=1', '-At', '-c', q], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`psql ล้ม: ${r.stderr}`);
  };
  const owner = await staffApi('owner');
  const PAST = '2026-09-15';
  const paymentsSnap = () => sql(`select count(*)||'|'||coalesce(sum(amount),0) from payments`);
  const allPayments = () => sql(`select id||'|'||booking_id||'|'||amount||'|'||method||'|'||paid_at from payments order by id`);
  let ownerPhone = '';
  let creditBefore!: ReturnType<typeof creditSnapshot>;
  let paymentsBefore = '';
  let allBefore = '';
  await test.step('ถอย 009 ก่อน (ให้ฐานเป็นแบบเดิมก่อน CR-06) แล้วสร้างคำท้าที่ "จ่ายแล้วด้วยระบบเดิม" เมื่อ 15 ก.ย. (เครดิตเจ้าของ ฿900 · ไม่มีแถวเงิน)', async () => {
    const down = migrate('--down', '009');
    expect(down.status, `migrate --down 009: ${down.stdout}${down.stderr}`).toBe(0);
    const s = await setup(page.request, b);
    ownerPhone = s.ownerPhone;
    exec(
      `UPDATE challenges SET status='MATCHED' WHERE id=${s.id};` +
      ` INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) SELECT customer_id, 900, 'CHALLENGE', id, '${PAST} 20:30:00+07' FROM bookings WHERE code='${s.code}';` +
      ` UPDATE customers SET credit_balance = credit_balance + 900 WHERE phone='${s.ownerPhone}';`,
    );
    creditBefore = creditSnapshot(ownerPhone);
    paymentsBefore = paymentsSnap();
    allBefore = allPayments();
    expect(creditBefore.balance).toBe(900);
  });
  await test.step('ก่อน migration: รายงาน 15 ก.ย. พร้อมเพย์ ฿0 (บั๊กเดิม)', async () => {
    expect((await dayReport(owner, PAST)).day.bookingPromptpay).toBe(0);
  });
  await test.step('migrate ขึ้น ครั้งที่ 1 และ 2 → ไม่ error · แถวเงินเพิ่ม 1 แถว (฿900) ไม่ซ้ำ', async () => {
    for (let i = 1; i <= 2; i++) {
      const up = migrate();
      expect(up.status, `migrate ครั้งที่ ${i}: ${up.stdout}${up.stderr}`).toBe(0);
    }
    const [n0, s0] = paymentsBefore.split('|').map(Number);
    expect(paymentsSnap()).toBe(`${n0 + 1}|${s0 + 900}`);
    expect(sql(`select version from schema_migrations order by 1 desc limit 1`)).toBe('009');
  });
  await test.step('รายงาน 15 ก.ย. พร้อมเพย์ ฿900 ตามวันที่รับเงินเดิม · ยอดจอง ฿900', async () => {
    const r = await dayReport(owner, PAST);
    expect.soft(r.day.bookingPromptpay).toBe(900);
    expect.soft(r.day.bookingMoney).toBe(900);
  });
  await test.step('เครดิตเจ้าของเหมือนเดิมทุกบาท (ยอด · รายการ · ผลรวม)', async () => {
    expect(creditSnapshot(ownerPhone)).toEqual(creditBefore);
  });
  await test.step('ถอยกลับ 009 → แถวเงินกลับเท่าก่อน (แถวอื่นไม่ถูกแตะ) · รายงาน ฿0 · เครดิตเท่าเดิม', async () => {
    const down = migrate('--down', '009');
    expect(down.status, down.stdout + down.stderr).toBe(0);
    expect(paymentsSnap()).toBe(paymentsBefore);
    expect(allPayments(), 'แถวเงินเดิมทุกแถวอยู่ครบ ไม่ถูกแตะ').toBe(allBefore);
    expect((await dayReport(owner, PAST)).day.bookingPromptpay).toBe(0);
    expect(creditSnapshot(ownerPhone)).toEqual(creditBefore);
  });
  await test.step('ขึ้นใหม่ → ฿900 แถวเดียว', async () => {
    const up = migrate();
    expect(up.status, up.stdout + up.stderr).toBe(0);
    const [n0, s0] = paymentsBefore.split('|').map(Number);
    expect(paymentsSnap()).toBe(`${n0 + 1}|${s0 + 900}`);
    expect((await dayReport(owner, PAST)).day.bookingPromptpay).toBe(900);
  });
});
