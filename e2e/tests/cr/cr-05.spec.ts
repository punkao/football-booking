import type { APIRequestContext } from '@playwright/test';
import { test, expect, open, getJson, postJson } from '../fixtures';
import { BASE_URL } from '../constants';
import { ann } from '../v2-helpers';

/**
 * CR-05 ปรับราคาช่วงเย็นสนาม 5 คน ฿1,200 → ฿1,300 สำหรับรอบที่เตะตั้งแต่ 1 พ.ย. 2569 (CHANGE-REQUESTS/CR-05.md · impact docs/impact/CR-05.md)
 * ไฟล์นี้ = ข้อที่ไม่ต้องเลื่อนเวลา (วันนี้ = ศ 9 ต.ค. 2569 ตามที่ล็อก) · ข้อที่ต้องเลื่อนไปหลัง 1 พ.ย. อยู่ใน cr-05.serial.spec.ts
 * ค่าที่คาดหวัง: [D:CR-05] = CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05 · [CR-05] = หนังสือ · [สมมติฐาน Qn] = docs/impact/CR-05.md ข้อ 1.2
 * ไม่จอง ไม่ reset ไม่เลื่อนเวลา: อ่านราคาจาก availability / fields / หน้าเว็บ / แชท (ถามราคา) เท่านั้น
 */

const ANSWER = 'CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05';
const NEXT = { from: '2026-11-01', dayRate: 800, eveningRate: 1300 };

type Slot = { fieldId: string; hour: number; price: number };
async function priceOf(req: APIRequestContext, date: string, fieldId: string, hour: number) {
  const av = await getJson(req, `/api/availability?date=${date}`);
  expect(av.status, `availability ${date}`).toBe(200);
  const s = (av.body.slots as Slot[]).find((x) => x.fieldId === fieldId && x.hour === hour);
  expect(s, `${fieldId} ${date} ${hour}:00 ต้องอยู่ในตาราง`).toBeTruthy();
  return s!.price;
}

/** ห้องแชทใหม่ (cookie แยก) + IP ของตัวเอง (กันชนเพดานต่อ IP) */
async function chatRoom(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }, b: number) {
  const ip = `10.${230 + b}.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
  const send = async (text: string) => {
    const r = await postJson(ctx, '/api/chat', { text });
    expect(r.status, `POST /api/chat "${text}" → ${JSON.stringify(r.body)}`).toBe(200);
    return { reply: String(r.body.reply ?? ''), cards: (r.body.cards ?? []) as Record<string, any>[] };
  };
  return { ctx, send };
}

test.describe('CR-05 ราคาเย็นสนาม 5 คน ฿1,300 ตั้งแต่ 1 พ.ย. 2569', () => {
  test('CR-05-01 ตารางว่าง: สนาม A, B ช่วงเย็น/เสาร์ อาทิตย์ หลัง 1 พ.ย. = ฿1,300 · ก่อน 1 พ.ย. ฿1,200 · กลางวันและสนาม C ไม่เปลี่ยน', {
    tag: ['@CR-05', '@P1'],
    annotation: ann({
      tc: 'CR-05-01', level: 'P1', source: `[D:CR-05] ${ANSWER} ข้อ 1 "ดูวันเตะ" · CHANGE-REQUESTS/CR-05.md ตาราง · [สมมติฐาน Q6] เสาร์ 09:00 = ฿1,300`,
      expected: 'ส 31 ต.ค. A 19:00 ฿1,200 · อา 1 พ.ย. A 09:00 ฿1,300 · อา 1 พ.ย. B 19:00 ฿1,300 · อ 3 พ.ย. A/B 16:00 ฿800 · 17:00 ฿1,300 · C 16:00 ฿1,200 · 17:00 ฿1,800 · ส 7 พ.ย. A 09:00 ฿1,300 C 09:00 ฿1,800 · fields[] ของวันนั้น: อ 3 พ.ย. A eveningRate 1300 · ส 31 ต.ค. A eveningRate 1200',
    }),
  }, async ({ request }) => {
    await test.step('ส 31 ต.ค. (วันสุดท้ายก่อนวันมีผล) สนาม A 19:00 = ฿1,200 · เสาร์ 09:00 = ฿1,200', async () => {
      expect.soft(await priceOf(request, '2026-10-31', 'A', 19)).toBe(1200);
      expect.soft(await priceOf(request, '2026-10-31', 'A', 9)).toBe(1200);
    });
    await test.step('อา 1 พ.ย. (วันมีผล) A 09:00 และ B 19:00 = ฿1,300', async () => {
      expect.soft(await priceOf(request, '2026-11-01', 'A', 9)).toBe(1300);
      expect.soft(await priceOf(request, '2026-11-01', 'B', 19)).toBe(1300);
    });
    await test.step('อ 3 พ.ย. A/B 16:00 = ฿800 (ไม่เปลี่ยน) · 17:00 = ฿1,300', async () => {
      for (const f of ['A', 'B']) {
        expect.soft(await priceOf(request, '2026-11-03', f, 16), `${f} 16:00`).toBe(800);
        expect.soft(await priceOf(request, '2026-11-03', f, 17), `${f} 17:00`).toBe(1300);
      }
    });
    await test.step('สนาม C ไม่เปลี่ยน: อ 3 พ.ย. 16:00 ฿1,200 · 17:00 ฿1,800 · ส 7 พ.ย. 09:00 ฿1,800', async () => {
      expect.soft(await priceOf(request, '2026-11-03', 'C', 16)).toBe(1200);
      expect.soft(await priceOf(request, '2026-11-03', 'C', 17)).toBe(1800);
      expect.soft(await priceOf(request, '2026-11-07', 'C', 9)).toBe(1800);
      expect.soft(await priceOf(request, '2026-11-07', 'A', 9)).toBe(1300);
    });
    await test.step('ฟิลด์ราคาในผลตารางว่างเป็นราคา ณ วันที่ขอ (A เย็น: 3 พ.ย. 1300 · 31 ต.ค. 1200)', async () => {
      const nov = await getJson(request, '/api/availability?date=2026-11-03');
      const oct = await getJson(request, '/api/availability?date=2026-10-31');
      const a = (r: any) => r.body.fields.find((f: any) => f.id === 'A');
      expect.soft(a(nov).eveningRate).toBe(1300);
      expect.soft(a(nov).dayRate).toBe(800);
      expect.soft(a(oct).eveningRate).toBe(1200);
    });
  });

  test('CR-05-02 /api/fields + การ์ดหน้าแรก + หน้าสนาม บอกราคาเดียวกัน: ราคาปัจจุบัน ฿1,200 และ "฿1,300 ตั้งแต่ 1 พ.ย." (A, B) · C ไม่มี', {
    tag: ['@CR-05', '@P1'],
    annotation: ann({
      tc: 'CR-05-02', level: 'P1', source: `[D:CR-05] ${ANSWER} "หน้าเว็บ การ์ดสนาม แชทบอท ใบเสนอราคา ต้องบอกราคาเดียวกัน" (หนังสือ) · [สมมติฐาน Q9] แสดงคู่ · TC-API-01 / TC-HOME / TC-I18N เดิมต้องผ่านเหมือนเดิม`,
      expected: '/api/fields (วันนี้ 9 ต.ค.): A, B dayRate 800 eveningRate 1200 rateChanges [{from 2026-11-01, 800, 1300}] · C 1200/1800 rateChanges [] · หน้าแรก home-field-A/B-next-rate data-value 1300 data-from 2026-11-01 ข้อความมี ฿1,300 และ "1 พ.ย." · C ไม่มี · หน้าสนาม field-evening-rate-A ยัง ฿1,200 ตรงตัว + field-evening-rate-next-A data-value 1300 · EN: THB 1,300 + "1 Nov"',
    }),
  }, async ({ page, request }) => {
    await test.step('GET /api/fields → ราคา ณ วันนี้เดิม + rateChanges ของ A, B', async () => {
      const r = await getJson(request, '/api/fields');
      const by = Object.fromEntries(r.body.fields.map((f: any) => [f.id, f]));
      for (const id of ['A', 'B']) {
        expect.soft(by[id]).toMatchObject({ dayRate: 800, eveningRate: 1200 });
        expect.soft(by[id].rateChanges, `${id} rateChanges`).toEqual([NEXT]);
      }
      expect.soft(by.C).toMatchObject({ dayRate: 1200, eveningRate: 1800 });
      expect.soft(by.C.rateChanges, 'C rateChanges').toEqual([]);
    });
    await test.step('หน้าแรก: การ์ด A, B มี "฿1,300 ตั้งแต่ 1 พ.ย." · C ไม่มี · ค่าเท่ากับ /api/fields (SEED_FIELDS ไม่เพี้ยนจาก DB)', async () => {
      await open(page, '/');
      const api = (await getJson(request, '/api/fields')).body.fields as any[];
      for (const id of ['A', 'B']) {
        const next = page.getByTestId(`home-field-${id}-next-rate`);
        const step = api.find((f) => f.id === id).rateChanges[0];
        await expect.soft(next, `${id} การ์ดหน้าแรก`).toHaveAttribute('data-value', String(step.eveningRate));
        await expect.soft(next).toHaveAttribute('data-day-value', String(step.dayRate));
        await expect.soft(next).toHaveAttribute('data-from', step.from);
        await expect.soft(next).toHaveAttribute('data-value', '1300');
        await expect.soft(next).toContainText('฿1,300');
        await expect.soft(next).toContainText('1 พ.ย.');
        await expect.soft(page.getByTestId(`home-field-${id}`)).toContainText('฿1,200');
      }
      await expect.soft(page.getByTestId('home-field-C-next-rate')).toHaveCount(0);
      await expect.soft(page.getByTestId('home-field-C')).not.toContainText('1,300');
    });
    await test.step('หน้าสนาม: ราคาปัจจุบันเดิมตรงตัว (฿1,200) + แถว "ตั้งแต่ 1 พ.ย." ฿1,300 ใต้ราคาเย็นของ A, B', async () => {
      await open(page, '/fields');
      for (const id of ['A', 'B']) {
        await expect.soft(page.getByTestId(`field-evening-rate-${id}`)).toHaveText('฿1,200');
        await expect.soft(page.getByTestId(`field-evening-rate-${id}`)).toHaveAttribute('data-value', '1200');
        const next = page.getByTestId(`field-evening-rate-next-${id}`);
        await expect.soft(next, `${id} หน้าสนาม`).toHaveAttribute('data-value', '1300');
        await expect.soft(next).toHaveAttribute('data-from', '2026-11-01');
        await expect.soft(next).toContainText('฿1,300');
        await expect.soft(page.getByTestId(`field-day-rate-next-${id}`), 'ราคากลางวันไม่เปลี่ยน → ไม่มีแถวใหม่').toHaveCount(0);
      }
      await expect.soft(page.getByTestId('field-evening-rate-next-C')).toHaveCount(0);
      await expect.soft(page.getByTestId('field-evening-rate-C')).toHaveText('฿1,800');
    });
    await test.step('ภาษาอังกฤษ: THB 1,300 + from 1 Nov', async () => {
      await page.context().addCookies([{ name: 'lang', value: 'en', url: BASE_URL }]);
      await open(page, '/fields');
      await expect.soft(page.getByTestId('field-evening-rate-A')).toHaveText('THB 1,200');
      const next = page.getByTestId('field-evening-rate-next-A');
      await expect.soft(next).toContainText('THB 1,300');
      await expect.soft(next.locator('xpath=..'), 'แถวราคาล่วงหน้า (ป้ายวัน + ราคา)').toContainText('1 Nov');
      await open(page, '/');
      await expect.soft(page.getByTestId('home-field-A-next-rate')).toContainText('THB 1,300');
      await page.context().clearCookies({ name: 'lang' });
    });
  });

  test('CR-05-03 น้องบอลถามราคาทั่วไป: ราคาปัจจุบัน + บอกล่วงหน้า "฿1,300 ตั้งแต่ 1 พ.ย." (A, B) · ถามเจาะวันหลัง/ก่อน 1 พ.ย. ตอบตามวันนั้น · ไม่ถูก price guard ตัด', {
    tag: ['@CR-05', '@P1'],
    annotation: ann({
      tc: 'CR-05-03', level: 'P1', source: `[D:CR-05] ${ANSWER} + หนังสือ "แชทบอท … ต้องบอกราคาเดียวกัน" · [สมมติฐาน Q9/Q11] · BR-30 price guard`,
      expected: '"สนาม A ราคาเท่าไร" → มี ฿800 ฿1,200 ฿1,300 และ "1 พ.ย." · "สนาม C ราคาเท่าไร" → ฿1,200 ฿1,800 ไม่มี ฿1,300 · "สนาม A วันเสาร์ที่ 7 พ.ย. ราคาเท่าไร" → ฿1,300 ไม่มี ฿1,200 · "สนาม A วันเสาร์ที่ 31 ต.ค. ราคาเท่าไร" → ฿1,200 ไม่มี ฿1,300 · อังกฤษ: THB 1,300 + "1 Nov" · ไม่ใช่ข้อความ fallback',
    }),
  }, async ({ playwright, b }) => {
    const room = await chatRoom(playwright, b);
    await test.step('ถาม "สนาม A ราคาเท่าไร" → ราคาปัจจุบัน + ราคาที่จะมีผล 1 พ.ย.', async () => {
      const t = await room.send('สนาม A ราคาเท่าไร');
      for (const s of ['฿800', '฿1,200', '฿1,300', '1 พ.ย.']) expect.soft(t.reply, `คำตอบต้องมี ${s}`).toContain(s);
    });
    await test.step('ถาม "สนาม C ราคาเท่าไร" → ฿1,200 ฿1,800 ไม่มีราคาใหม่ของ A, B', async () => {
      const t = await (await chatRoom(playwright, b)).send('สนาม C ราคาเท่าไร');
      expect.soft(t.reply).toContain('฿1,800');
      expect.soft(t.reply).not.toContain('1,300');
    });
    await test.step('ถาม "สนาม A วันเสาร์ที่ 7 พ.ย. ราคาเท่าไร" → ฿1,300 (ราคาของวันนั้น)', async () => {
      const t = await (await chatRoom(playwright, b)).send('สนาม A วันเสาร์ที่ 7 พ.ย. ราคาเท่าไร');
      expect.soft(t.reply).toContain('฿1,300');
      expect.soft(t.reply).not.toContain('฿1,200');
    });
    await test.step('ถาม "สนาม A วันเสาร์ที่ 31 ต.ค. ราคาเท่าไร" → ฿1,200 (ก่อนวันมีผล)', async () => {
      const t = await (await chatRoom(playwright, b)).send('สนาม A วันเสาร์ที่ 31 ต.ค. ราคาเท่าไร');
      expect.soft(t.reply).toContain('฿1,200');
      expect.soft(t.reply).not.toContain('฿1,300');
    });
    await test.step('English: "How much is field A?" → THB 1,300 from 1 Nov', async () => {
      const t = await (await chatRoom(playwright, b)).send('How much is field A?');
      for (const s of ['THB 800', 'THB 1,200', 'THB 1,300', '1 Nov']) expect.soft(t.reply, `reply must have ${s}`).toContain(s);
    });
  });
});
