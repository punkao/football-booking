import type { APIRequestContext } from '@playwright/test';
import { test, expect, postJson } from '../fixtures';
import { BASE_URL, TODAY } from '../constants';
import { ann } from '../v2-helpers';

/**
 * CR-04 น้องบอลจำเรื่องที่คุยไปแล้ว (CHANGE-REQUESTS/CR-04.md · impact docs/impact/CR-04.md)
 *
 * ค่าที่คาดหวังมาจากคำตอบร้าน CHANGE-REQUESTS/answers/README.md หัวข้อ CR-04 = [D:CR-04]
 * - จำเฉพาะในห้องแชทเดียวกัน · เปิดห้องใหม่ = เริ่มใหม่
 * - ข้อความใหม่ไม่บอกวัน/เวลา/สนาม/ชั่วโมง → ใช้ค่าล่าสุดในห้อง · บอกค่าใหม่ → ใช้ค่าใหม่ · "it"/"สนามนั้น" = สนามล่าสุดที่คุย
 * - "ช่วงไหนถูกสุด" → ก่อน 17:00 จ–ศ พร้อมราคาต่อชั่วโมงของสนามที่คุยอยู่ (ไม่มี = สนาม 5 คน) · ถามต่อ "N ชั่วโมง" → คิดราคาจากช่วงนั้น
 * - ทำงานทั้ง TH/EN · เรื่องอื่นของน้องบอล (การ์ดยืนยัน PDPA · นอกเรื่อง · ปิดเบอร์ · ห้ามเดาราคา) เหมือนเดิม
 *
 * TC-CHAT-14/15/16 (chat.spec.ts) เป็นตัวตรวจ 3 กรณีหลักของหนังสือ · ไฟล์นี้เพิ่มกรณีที่คำตอบร้านระบุแต่ TC เดิมไม่ครอบ
 * ถามราคา (QUOTE) เท่านั้น ไม่ถามว่าง → ผลไม่ขึ้นกับการจองที่เทสต์อื่นสร้างระหว่างรัน (ราคาคงเดิมแม้รอบถูกจอง) · ไม่ reset / ไม่เลื่อนเวลา
 * วันล็อก: วันนี้ = ศ 9 ต.ค. 2569 → พรุ่งนี้ = ส 10 ต.ค. · จันทร์ถัดไป = 12 ต.ค. (13 ต.ค. วันหยุด)
 */

const ANSWER = 'CHANGE-REQUESTS/answers/README.md หัวข้อ CR-04';
const THAI = /[฀-๿]/;

/** ห้องแชทใหม่ (cookie แยก) + IP ของตัวเอง (กันชนเพดานต่อ IP) */
async function chatRoom(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }, b: number) {
  const ip = `10.${210 + b}.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'X-Forwarded-For': ip } });
  const send = async (text: string) => {
    const r = await postJson(ctx, '/api/chat', { text });
    expect(r.status, `POST /api/chat "${text}" → ${JSON.stringify(r.body)}`).toBe(200);
    return { reply: String(r.body.reply ?? ''), cards: (r.body.cards ?? []) as Record<string, any>[] };
  };
  return { ctx, send };
}

test.describe('CR-04 น้องบอลจำเรื่องที่คุยไปแล้ว', () => {
  test('CR-04-01 บอกค่าใหม่ → ใช้ค่าใหม่ ที่เหลือใช้ค่าเดิมของห้อง (สนาม → วัน → ชั่วโมง)', {
    tag: ['@CR-04', '@P2'],
    annotation: ann({
      tc: 'CR-04-01', level: 'P2', source: `[D:CR-04] ${ANSWER} ข้อ 2 · CHANGE-REQUESTS/CR-04.md ข้อ 1 · TC-CHAT-15`,
      expected: `ห้องเดียวกัน: "สนาม A พรุ่งนี้ 10:00 ราคาเท่าไร" ฿1,200 (เสาร์ = เรทเย็น) → "สนาม C ล่ะ" ฿1,800 (สนามใหม่ วัน/เวลาเดิม) → "วันจันทร์ล่ะ" ฿1,200 (จันทร์ 12 ต.ค. 10:00 = เรทก่อน 17:00 ของ C) → "ขอ 2 ชั่วโมง" ฿2,400 · ทุกคำตอบเป็นการ์ดราคา (quote) · ไม่มี "ไม่มีข้อมูล"`,
    }),
  }, async ({ playwright, b }) => {
    const room = await chatRoom(playwright, b);
    const replies: string[] = [];
    await test.step('พิมพ์ "สนาม A พรุ่งนี้ 10:00 ราคาเท่าไร" → ฿1,200 (A เสาร์ = เรทเย็น)', async () => {
      const t = await room.send('สนาม A พรุ่งนี้ 10:00 ราคาเท่าไร');
      replies.push(t.reply);
      expect.soft(t.reply).toContain('฿1,200');
      expect.soft(t.cards[0]?.type).toBe('quote');
    });
    await test.step('พิมพ์ "สนาม C ล่ะ" → สนาม C พรุ่งนี้ 10:00 ฿1,800', async () => {
      const t = await room.send('สนาม C ล่ะ');
      replies.push(t.reply);
      expect.soft(t.reply).toContain('สนาม C');
      expect.soft(t.reply).toContain('฿1,800');
      expect.soft(t.cards[0]?.fieldId).toBe('C');
      expect.soft(t.cards[0]?.date).toBe('2026-10-10');
      expect.soft(t.cards[0]?.startHour).toBe(10);
    });
    await test.step('พิมพ์ "วันจันทร์ล่ะ" → สนาม C จันทร์ 12 ต.ค. 10:00 ฿1,200 (ก่อนหน้านี้ ฿1,800 วันเสาร์)', async () => {
      const t = await room.send('วันจันทร์ล่ะ');
      replies.push(t.reply);
      expect.soft(t.cards[0]?.fieldId).toBe('C');
      expect.soft(t.cards[0]?.date).toBe('2026-10-12');
      expect.soft(t.cards[0]?.startHour).toBe(10);
      expect.soft(t.reply).toContain('฿1,200'); // จันทร์ 10:00 = เรทก่อน 17:00 ของ C
    });
    await test.step('พิมพ์ "ขอ 2 ชั่วโมง" → 2 × เรทเดิม', async () => {
      const t = await room.send('ขอ 2 ชั่วโมง');
      replies.push(t.reply);
      expect.soft(t.cards[0]?.hours).toBe(2);
      expect.soft(t.cards[0]?.date).toBe('2026-10-12');
      expect.soft(t.reply).toContain('฿2,400');
    });
    expect.soft(replies.join(' | ')).not.toContain('ไม่มีข้อมูล');
    await room.ctx.dispose();
  });

  test('CR-04-02 ภาษาอังกฤษ: ถามราคาสนาม B แล้ว "what about field C?" → ตอบสนาม C วัน/เวลาเดิม ไม่มีอักษรไทย', {
    tag: ['@CR-04', '@P2'],
    annotation: ann({
      tc: 'CR-04-02', level: 'P2', source: `[D:CR-04] ${ANSWER} ข้อ 2–3 · CHANGE-REQUESTS/CR-04.md ข้อ 3 · TC-CHAT-16`,
      expected: `"How much is field B on Saturday at 7pm?" → THB 1,200 · "what about field C?" → Field C THB 1,800 (เสาร์ 10 ต.ค. 19:00 จากข้อความก่อน) · "and 2 hours?" → THB 3,600 · ไม่มีอักษรไทยในคำตอบใด`,
    }),
  }, async ({ playwright, b }) => {
    const room = await chatRoom(playwright, b);
    const t1 = await room.send('How much is field B on Saturday at 7pm?');
    const t2 = await room.send('what about field C?');
    const t3 = await room.send('and 2 hours?');
    await test.step('ตรวจราคา 3 คำตอบ', async () => {
      expect.soft(t1.reply).toContain('THB 1,200');
      expect.soft(t2.reply).toContain('Field C');
      expect.soft(t2.reply).toContain('THB 1,800');
      expect.soft(t2.cards[0]?.startHour).toBe(19);
      expect.soft(t3.reply).toContain('THB 3,600');
      expect.soft(THAI.test(t1.reply + t2.reply + t3.reply), 'ไม่มีอักษรไทย').toBe(false);
      expect.soft(`${t1.reply} ${t2.reply} ${t3.reply}`).not.toMatch(/don't have that information/);
    });
    await room.ctx.dispose();
  });

  test('CR-04-03 "ช่วงไหนถูกสุด" ตามสนามที่คุยอยู่ (C = ฿1,200) · ไม่มีสนาม = สนาม 5 คน ฿800 · "N ชั่วโมง" คิดราคาช่วงนั้น (EN ก็ได้)', {
    tag: ['@CR-04', '@P2'],
    annotation: ann({
      tc: 'CR-04-03', level: 'P2', source: `[D:CR-04] ${ANSWER} ข้อ 4 · [D A-48] · CHANGE-REQUESTS/CR-04.md ข้อ 2 · TC-CHAT-14`,
      expected: 'ห้อง 1: "สนาม C มีหลังคาไหม" → "ช่วงไหนถูกสุด" ต้องมี ฿1,200 และ 17:00 และไม่มี ฿800 → "3 ชั่วโมง" ต้องมี ฿3,600 (การ์ดราคาสนาม C) · ห้อง 2 (EN): "which time is the cheapest?" THB 800 → "what about 3 hours?" THB 2,400 · ทั้งหมดต้องมาจากฟังก์ชันราคา (การ์ด quote) ไม่เดา',
    }),
  }, async ({ playwright, b }) => {
    const th = await chatRoom(playwright, b);
    await th.send('สนาม C มีหลังคาไหม');
    const a1 = await th.send('ช่วงไหนถูกสุด');
    const a2 = await th.send('3 ชั่วโมง');
    await test.step('ห้อง TH ตามสนาม C', async () => {
      expect.soft(a1.reply).toContain('฿1,200');
      expect.soft(a1.reply).toContain('17:00');
      expect.soft(a1.reply).not.toContain('฿800');
      expect.soft(a2.reply).toContain('฿3,600');
      expect.soft(a2.cards[0]?.type).toBe('quote');
      expect.soft(a2.cards[0]?.fieldId).toBe('C');
      expect.soft(a2.cards[0]?.totalPrice).toBe(3600);
    });
    const en = await chatRoom(playwright, b);
    const e1 = await en.send('which time is the cheapest?');
    const e2 = await en.send('what about 3 hours?');
    await test.step('ห้อง EN ไม่มีสนาม → สนาม 5 คน', async () => {
      expect.soft(e1.reply).toContain('THB 800');
      expect.soft(e2.reply).toContain('THB 2,400');
      expect.soft(e2.cards[0]?.totalPrice).toBe(2400);
      expect.soft(THAI.test(e1.reply + e2.reply), 'ไม่มีอักษรไทย').toBe(false);
    });
    await th.ctx.dispose();
    await en.ctx.dispose();
  });

  test('CR-04-04 เปิดห้องใหม่ = เริ่มใหม่ · และคำถามเรื่องอื่นไม่ถูกความจำแย่งตอบ', {
    tag: ['@CR-04', '@P2'],
    annotation: ann({
      tc: 'CR-04-04', level: 'P2', source: `[D:CR-04] ${ANSWER} ข้อ 1, 5 · BR-29 · BR-32 · CHANGE-REQUESTS/CR-04.md ข้อ 4`,
      expected: 'ห้อง 1 คุยเรื่อง สนาม C เสาร์ 19:00 แล้วถาม "เปิดกี่โมง" → 08:00 และ 24:00 · "ขอบคุณครับ" → ไม่มีข้อมูล + เบอร์ร้าน · "ผลบอลเมื่อคืนเป็นยังไง" → ปฏิเสธนอกเรื่อง · ไม่มีการ์ดใหม่เลยตั้งแต่คำถามที่ 2 · ห้อง 2 (ห้องใหม่) พิมพ์ "งั้นสนาม B ล่ะ" ข้อความเดียว → ไม่มีข้อมูล + เบอร์ร้าน (ไม่จำข้ามห้อง)',
    }),
  }, async ({ playwright, b }) => {
    const r1 = await chatRoom(playwright, b);
    await r1.send('สนาม C เสาร์ 19:00 ราคาเท่าไร');
    const hours = await r1.send('เปิดกี่โมง');
    const thanks = await r1.send('ขอบคุณครับ');
    const off = await r1.send('ผลบอลเมื่อคืนเป็นยังไง');
    await test.step('ห้อง 1: เรื่องอื่นไม่ถูกความจำแย่ง', async () => {
      expect.soft(hours.reply).toContain('08:00');
      expect.soft(hours.reply).toContain('24:00');
      expect.soft(thanks.reply).toContain('ไม่มีข้อมูล');
      expect.soft(thanks.reply).toContain('02-345-6789');
      expect.soft(off.reply).toContain('ตอบได้เฉพาะเรื่องสนาม');
      expect.soft([hours, thanks, off].flatMap((t) => t.cards).length, 'การ์ดหลังคำถามที่ 2').toBe(0);
    });
    const r2 = await chatRoom(playwright, b);
    const fresh = await r2.send('งั้นสนาม B ล่ะ');
    await test.step('ห้อง 2 (ใหม่): ไม่จำของห้อง 1', async () => {
      expect.soft(fresh.reply).toContain('ไม่มีข้อมูล');
      expect.soft(fresh.reply).toContain('02-345-6789');
      expect.soft(fresh.cards.length).toBe(0);
    });
    await r1.ctx.dispose();
    await r2.ctx.dispose();
    expect(TODAY).toBe('2026-10-09');
  });
});
