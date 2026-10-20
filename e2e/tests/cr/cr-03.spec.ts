import { test, expect, open, getJson, staffLoginPage, waitReady } from '../fixtures';
import { ann } from '../v2-helpers';

/**
 * CR-03 รายงานแยกช่องทางเงิน และชั่วโมงใช้สนาม (CHANGE-REQUESTS/CR-03.md · impact docs/impact/CR-03.md)
 *
 * ค่าที่คาดหวังมาจากคำตอบร้าน CHANGE-REQUESTS/answers/README.md หัวข้อ CR-03 = [D:CR-03] (+ A-41 / A-42 ใน docs/01-INTERVIEW.md)
 * - "จ่ายผ่านพร้อมเพย์" + "เก็บหน้าสนาม" = "ยอดจอง" เดิม · 3–9 ต.ค.: พร้อมเพย์ ฿6,600 · เก็บหน้าสนาม ฿600
 * - ชั่วโมงใช้สนาม A B C = ชั่วโมงของการจอง จ่ายแล้ว/เช็กอินแล้ว/ไม่มา ที่วันเตะอยู่ในช่วง · % = ชั่วโมง ÷ (16 × จำนวนวัน) ปัด 1 ตำแหน่ง
 * - CSV เพิ่มคอลัมน์ต่อท้ายเท่านั้น (สูตร Excel ของร้านอ้างตำแหน่ง) · UTF-8 มี BOM · ยอดอื่นเหมือนเดิมทุกตัว
 *
 * ไม่ reset / ไม่เลื่อนเวลา (รันพร้อม 3 เบราว์เซอร์): ใช้ช่วง 3–8 ต.ค. (อดีต · เงินที่จ่ายระหว่างเทสต์ลงวันนี้ 9 ต.ค. จึงไม่ปนช่วงนี้)
 * ค่า 3–9 ต.ค. เต็มช่วงตรวจใน TC-REPORT-04 (serial) · seed ใช้แบบอ่านอย่างเดียว
 * ช่วง 3–8 ต.ค. (6 วัน → ฐาน 96 ชม.): พร้อมเพย์ 6,600 · หน้าสนาม 600 · ยอดจอง 7,200 · A 3 ชม. (3.1%) · B 2 ชม. (2.1%) · C 0 ชม. (0%)
 */

const ANSWER = 'CHANGE-REQUESTS/answers/README.md หัวข้อ CR-03';
const FROM = '2026-10-03';
const TO = '2026-10-08';

// หัว CSV เดิม 21 คอลัมน์ [E golden/side:csv] — ห้ามเปลี่ยนชื่อ/ลำดับ ([D:CR-03] "ห้ามย้ายหรือเปลี่ยนชื่อคอลัมน์เดิม")
const OLD_HEADER = [
  'วันที่', 'ยอดจอง (บาท)', 'ขายเงินสด (บาท)', 'ขายพร้อมเพย์ (บาท)', 'ยอดขายรวม (บาท)', 'รวมรับเงิน (บาท)', 'หักเครดิต (บาท)', 'จำนวนการจอง (วันเตะ)',
  'สถานะ PENDING_PAYMENT', 'สถานะ CONFIRMED', 'สถานะ CHECKED_IN', 'สถานะ NO_SHOW', 'สถานะ CANCELLED', 'สถานะ EXPIRED', 'สถานะ RAIN_CLOSED',
  'ส่วนลด (บาท)', 'ค่าของเช่า (บาท)', 'ชั่วโมงฟรีที่ใช้',
];

type Day = Record<string, any> & { date: string };

async function ownerReport(request: Parameters<typeof getJson>[0]) {
  const r = await getJson(request, `/api/owner/reports?from=${FROM}&to=${TO}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as { days: Day[]; totals: Record<string, any>; fieldUse?: { fieldId: string; hours: number; percent: number }[] };
}

async function ownerCsv(request: Parameters<typeof getJson>[0]) {
  const r = await request.get(`/api/owner/reports.csv?from=${FROM}&to=${TO}`);
  expect(r.status()).toBe(200);
  const text = await r.text();
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split(','));
  return { text, head: rows[0], rows: rows.slice(1) };
}

test.describe('CR-03 รายงานแยกช่องทางเงิน + ชั่วโมงใช้สนาม', () => {
  test('CR-03-01 เจ้าของดูรายงาน: เงินค่าสนามแยก "มัดจำ/จ่ายผ่านพร้อมเพย์" กับ "เก็บหน้าสนาม" · รวมกันเท่ายอดจองเดิม', {
    tag: ['@CR-03', '@P2'],
    annotation: ann({
      tc: 'CR-03-01', level: 'P2', source: `[D:CR-03] ${ANSWER} ข้อ 1 · [D A-41] · CHANGE-REQUESTS/CR-03.md ข้อ 1 · TC-REPORT-04`,
      expected: 'owner รายงาน 3–8 ต.ค. หน้าเว็บ: report-total-booking-promptpay ฿6,600 · report-total-booking-cash ฿600 · ยอดจองเดิม ฿7,200 = สองช่องรวมกัน · 6 ต.ค. พร้อมเพย์ ฿600 + หน้าสนาม ฿600 · 8 ต.ค. พร้อมเพย์ ฿4,800 หน้าสนาม ฿0 · JSON ฟิลด์ bookingPromptpay / bookingCash ตรงกัน',
    }),
  }, async ({ page }) => {
    await staffLoginPage(page, 'owner');
    await test.step('ร้านเปิดหน้ารายงาน เลือก 3–8 ต.ค. แล้วกดดูรายงาน', async () => {
      await open(page, '/owner/reports');
      await page.getByTestId('report-from').fill(FROM);
      await page.getByTestId('report-to').fill(TO);
      await page.getByTestId('report-submit').click();
      await waitReady(page);
      await expect(page.getByTestId('report-table')).toHaveAttribute('data-count', '6');
    });
    await test.step('ยอดรวมของช่วง: พร้อมเพย์ ฿6,600 · เก็บหน้าสนาม ฿600 · ยอดจองเดิม ฿7,200', async () => {
      await expect.soft(page.getByTestId('report-total-booking-promptpay'), 'พร้อมเพย์฿6,600 [D:CR-03]').toHaveAttribute('data-value', '6600');
      await expect.soft(page.getByTestId('report-total-booking-cash'), 'เก็บหน้าสนาม ฿600 [D:CR-03]').toHaveAttribute('data-value', '600');
      await expect.soft(page.getByTestId('report-total-booking'), 'ยอดจองเดิมคงเดิม').toHaveAttribute('data-value', '7200');
    });
    await test.step('รายวัน: 6 ต.ค. พร้อมเพย์ ฿600 + หน้าสนาม ฿600 · 8 ต.ค. พร้อมเพย์ ฿4,800', async () => {
      await expect.soft(page.getByTestId('report-2026-10-06-booking-promptpay')).toHaveAttribute('data-value', '600');
      await expect.soft(page.getByTestId('report-2026-10-06-booking-cash')).toHaveAttribute('data-value', '600');
      await expect.soft(page.getByTestId('report-2026-10-06-booking')).toHaveAttribute('data-value', '1200');
      await expect.soft(page.getByTestId('report-2026-10-08-booking-promptpay')).toHaveAttribute('data-value', '4800');
      await expect.soft(page.getByTestId('report-2026-10-08-booking-cash')).toHaveAttribute('data-value', '0');
    });
    await test.step('API ตรงกับหน้าเว็บ และสองช่องรวมกัน = ยอดจองเดิมทุกวัน', async () => {
      const r = await ownerReport(page.request);
      expect.soft(r.totals.bookingPromptpay).toBe(6600);
      expect.soft(r.totals.bookingCash).toBe(600);
      for (const d of r.days) expect.soft((d.bookingPromptpay ?? NaN) + (d.bookingCash ?? NaN), `${d.date} พร้อมเพย์ + หน้าสนาม = ยอดจอง`).toBe(d.bookingMoney);
    });
  });

  test('CR-03-02 เจ้าของดูชั่วโมงที่ใช้ของสนาม A B C ในช่วงที่เลือก เป็นชั่วโมงและเปอร์เซ็นต์', {
    tag: ['@CR-03', '@P2'],
    annotation: ann({
      tc: 'CR-03-02', level: 'P2', source: `[D:CR-03] ${ANSWER} ข้อ 3 · [D A-42] · CHANGE-REQUESTS/CR-03.md ข้อ 2 · TC-REPORT-04`,
      expected: 'owner รายงาน 3–8 ต.ค. (6 วัน ฐาน 96 ชม.): A 3 ชม. 3.1% · B 2 ชม. 2.1% · C 0 ชม. 0% (นับ CONFIRMED / CHECKED_IN / NO_SHOW ตามวันเตะ · ปัด 1 ตำแหน่ง) · หน้าเว็บการ์ด report-field-<สนาม>-hours / -percent ตรงกับ JSON fieldUse',
    }),
  }, async ({ page }) => {
    await staffLoginPage(page, 'owner');
    const want = { A: { hours: 3, percent: 3.1 }, B: { hours: 2, percent: 2.1 }, C: { hours: 0, percent: 0 } } as const;
    await test.step('ร้านเปิดรายงาน 3–8 ต.ค. เห็นชั่วโมงและ % ของแต่ละสนาม', async () => {
      await open(page, '/owner/reports');
      await page.getByTestId('report-from').fill(FROM);
      await page.getByTestId('report-to').fill(TO);
      await page.getByTestId('report-submit').click();
      await waitReady(page);
      for (const f of ['A', 'B', 'C'] as const) {
        await expect.soft(page.getByTestId(`report-field-${f}-hours`), `สนาม ${f} ชั่วโมง`).toHaveAttribute('data-value', String(want[f].hours));
        await expect.soft(page.getByTestId(`report-field-${f}-percent`), `สนาม ${f} %`).toHaveAttribute('data-value', String(want[f].percent));
      }
    });
    await test.step('JSON fieldUse ตรงกัน · วันที่ 3 ต.ค. สนาม A เล่น 2 ชม. (LN-900005 18:00–20:00)', async () => {
      const r = await ownerReport(page.request);
      for (const f of ['A', 'B', 'C'] as const) expect.soft(r.fieldUse?.find((x) => x.fieldId === f), `fieldUse ${f}`).toEqual({ fieldId: f, ...want[f] });
      expect.soft(r.days.find((d) => d.date === FROM)?.fieldHours?.A).toBe(2);
    });
  });

  test('CR-03-03 ไฟล์ CSV: คอลัมน์เดิมคงที่ · คอลัมน์ใหม่ต่อท้ายเท่านั้น · UTF-8 มี BOM', {
    tag: ['@CR-03', '@P1'],
    annotation: ann({
      tc: 'CR-03-03', level: 'P1', source: `[D:CR-03] ${ANSWER} ข้อ 4 · CHANGE-REQUESTS/CR-03.md ข้อ 3 · SPEC-GAPS G-17 · [E golden/side:csv] หัวเดิม`,
      expected: 'owner GET reports.csv 3–8 ต.ค.: ขึ้นต้นด้วย BOM · 18 คอลัมน์แรกชื่อ/ลำดับเท่าเดิม · คอลัมน์ใหม่ต่อท้าย: "มัดจำ/จ่ายผ่านพร้อมเพย์" "เก็บหน้าสนาม" "ชั่วโมงใช้สนาม A/B/C" "ใช้สนาม A/B/C (%)" · แถวรวม: ยอดจองเดิม 7200 = พร้อมเพย์ 6600 + หน้าสนาม 600 · A 3 / 3.1 · B 2 / 2.1 · C 0 / 0 · แถว 3 ต.ค. A 2 ชม. 12.5% · ทุกแถวมีจำนวนเซลล์เท่าหัว',
    }),
  }, async ({ page }) => {
    await staffLoginPage(page, 'owner');
    const { text, head, rows } = await ownerCsv(page.request);
    await test.step('ไฟล์ยังเป็น UTF-8 มี BOM · ใช้ CRLF', async () => {
      expect.soft(text.charCodeAt(0)).toBe(0xfeff);
      expect.soft(text.includes('\r\n')).toBe(true);
    });
    await test.step('คอลัมน์เดิมทุกคอลัมน์ ชื่อและลำดับเท่าเดิม (สูตร Excel ของร้านไม่พัง)', async () => {
      expect.soft(head.slice(0, OLD_HEADER.length)).toEqual(OLD_HEADER);
    });
    const idx = (name: string) => head.indexOf(name);
    await test.step('คอลัมน์ใหม่อยู่ต่อท้ายทั้งหมด (หลังคอลัมน์เดิม)', async () => {
      const names = ['มัดจำ/จ่ายผ่านพร้อมเพย์ (บาท)', 'เก็บหน้าสนาม (บาท)', 'ชั่วโมงใช้สนาม A', 'ใช้สนาม A (%)', 'ชั่วโมงใช้สนาม B', 'ใช้สนาม B (%)', 'ชั่วโมงใช้สนาม C', 'ใช้สนาม C (%)'];
      expect.soft(head.slice(OLD_HEADER.length), 'คอลัมน์ใหม่ต่อท้ายตามลำดับ').toEqual(names);
    });
    const total = rows.find((r) => r[0] === 'รวม') ?? [];
    await test.step('แถวรวม: ยอดจองเดิม ฿7,200 = พร้อมเพย์ ฿6,600 + หน้าสนาม ฿600 · ชั่วโมง/% ต่อสนาม', async () => {
      expect.soft(Number(total[1]), 'ยอดจอง (บาท) เดิม').toBe(7200);
      expect.soft(Number(total[idx('มัดจำ/จ่ายผ่านพร้อมเพย์ (บาท)')])).toBe(6600);
      expect.soft(Number(total[idx('เก็บหน้าสนาม (บาท)')])).toBe(600);
      const want: Record<string, [number, number]> = { A: [3, 3.1], B: [2, 2.1], C: [0, 0] };
      for (const f of ['A', 'B', 'C']) {
        expect.soft(Number(total[idx(`ชั่วโมงใช้สนาม ${f}`)]), `ชั่วโมงสนาม ${f}`).toBe(want[f][0]);
        expect.soft(Number(total[idx(`ใช้สนาม ${f} (%)`)]), `% สนาม ${f}`).toBe(want[f][1]);
      }
    });
    await test.step('แถว 3 ต.ค.: สนาม A 2 ชม. = 12.5% ของ 16 ชม. · ทุกแถวมีจำนวนเซลล์เท่าหัว', async () => {
      const d3 = rows.find((r) => r[0] === FROM) ?? [];
      expect.soft(Number(d3[idx('ชั่วโมงใช้สนาม A')])).toBe(2);
      expect.soft(Number(d3[idx('ใช้สนาม A (%)')])).toBe(12.5);
      for (const r of rows) expect.soft(r.length, `แถว ${r[0]}`).toBe(head.length);
    });
  });

  test('CR-03-04 ยอดอื่นที่มีอยู่เหมือนเดิม: ขายหน้าเคาน์เตอร์ · หักเครดิต · รวมรับเงิน · จำนวนการจอง', {
    tag: ['@CR-03', '@P1'],
    annotation: ann({
      tc: 'CR-03-04', level: 'P1', source: `[D:CR-03] ${ANSWER} ข้อ 5 "ยอดอื่น … เหมือนเดิมทุกตัว" · [E golden/side:report] ยอดเดิม`,
      expected: 'owner รายงาน 3–8 ต.ค.: ยอดจอง ฿7,200 · รวมรับเงิน = ยอดจอง + ขายหน้าเคาน์เตอร์ · จำนวนการจอง 4 รายการ (วันเตะ) ไม่มา 2 · ค่า CSV แถวรวมเท่ากับ JSON totals ทุกตัวที่มีอยู่เดิม · และมีฟิลด์ใหม่ครบ (ไม่แทนที่ของเดิม)',
    }),
  }, async ({ page }) => {
    await staffLoginPage(page, 'owner');
    const r = await ownerReport(page.request);
    const t = r.totals;
    await test.step('ฟิลด์เดิมยังอยู่ครบ ค่าเดิม', async () => {
      expect.soft(t.bookingMoney).toBe(7200);
      expect.soft(t.total).toBe(t.bookingMoney + t.salesMoney);
      expect.soft(t.salesMoney).toBe(t.salesCash + t.salesPromptpay);
      expect.soft(t.creditUsed).toBe(0);
      expect.soft(t.bookings).toBe(4);
      expect.soft(t.noShow).toBe(2);
      for (const k of ['discount', 'rentalPrice', 'freeHours']) expect.soft(t[k], k).toBe(0);
    });
    await test.step('CSV แถวรวม (คอลัมน์เดิม) เท่ากับ JSON', async () => {
      const { rows } = await ownerCsv(page.request);
      const total = rows.find((x) => x[0] === 'รวม') ?? [];
      expect.soft(total.slice(1, 8).map(Number)).toEqual([t.bookingMoney, t.salesCash, t.salesPromptpay, t.salesMoney, t.total, t.creditUsed, t.bookings]);
    });
    await test.step('ฟิลด์ใหม่ (ช่องทางเงิน) มีอยู่ — ไม่ได้แทนที่ของเดิม', async () => {
      expect.soft(t.bookingPromptpay, 'totals.bookingPromptpay').toBeDefined();
      expect.soft(t.bookingCash, 'totals.bookingCash').toBeDefined();
    });
  });
});
