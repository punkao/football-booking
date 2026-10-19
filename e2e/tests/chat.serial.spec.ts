import { open, resetData, setClock, staffLoginPage } from './fixtures';
import { chatTest as test, expect, ChatRoom, chatAnnotations, asCustomer } from './chat-helpers';
import type { Page } from '@playwright/test';

/**
 * CHAT 🕒 — test ที่เลื่อนเวลา (/api/test/clock) รันใน project serial (Chromium ทีละข้อ หลัง 3 เบราว์เซอร์จบ)
 * แผนหัวข้อ 6: TC 🕒 รันครั้งเดียวแล้วนับผลเดียวกันให้ทุกเบราว์เซอร์ · reset ก่อน/หลังได้ (ไม่มี test อื่นรันพร้อมกัน)
 */
test.beforeEach(async ({ request }) => { await resetData(request); });
test.afterEach(async ({ request }) => { await resetData(request); });

/** เปิดห้องในหลังบ้านจาก /owner/chats ด้วยข้อความแรกของห้อง แล้วคืนข้อความทั้งห้อง */
async function openRoomByText(page: Page, firstText: string): Promise<string> {
  await open(page, '/owner/chats');
  const row = page.locator('[data-testid^="chat-row-"]').filter({ hasText: firstText }).first();
  await expect(row).toBeVisible();
  const link = row.locator('[data-testid^="chat-link-"]').first();
  if (await link.count()) await link.click();
  else await row.click();
  await page.locator('html[data-ready="true"]').waitFor({ state: 'attached' });
  await expect(page.getByTestId('chat-detail')).toBeVisible();
  return (await page.getByTestId('chat-detail').innerText()).replace(/\s+/g, ' ');
}

test('TC-CHAT-20 หลังบ้านเห็นประวัติแชท (เบอร์ปิดบางส่วน) และลบชื่อ/เบอร์เมื่อเกิน 90 วัน', {
  tag: ['@CHAT', '@P2'],
  annotation: chatAnnotations({
    tc: 'TC-CHAT-20', level: 'P2', source: '[D] TEST-DATA 5.3, BR-45, A-35 · FR-36, BR-44',
    expected: 'รายการมีห้อง seed 8 ต.ค. 23:10 "เปิดกี่โมงครับ" → "เปิดทุกวัน 08:00–24:00 ครับ" · ห้องใหม่แสดงเบอร์ "08x-xxx-1234" · +89, +90 วัน ยังมีชื่อ "สมปอง" · +91 วัน → "[ลบชื่อแล้ว]" "[ลบเบอร์แล้ว]" · STAFF เปิด /owner/chats → forbidden',
  }),
}, async ({ page, chat, newUserPage }) => {
  const first = 'อยากจองสนาม B วันพุธ 14 ต.ค. 10:00 1 ชั่วโมง';
  await test.step('ลูกค้าแชท 9 ต.ค. 10:00: จอง B → "ชื่อ สมปอง" → "เบอร์ 0812341234"', async () => {
    const room = new ChatRoom(page, chat);
    await room.open();
    await room.send(first);
    await room.send('ชื่อ สมปอง');
    await room.send('เบอร์ 0812341234');
  });
  const owner = await newUserPage();
  await asCustomer(owner, 3);
  await staffLoginPage(owner, 'owner');
  await test.step('owner เปิด /owner/chats: มีห้อง seed 8 ต.ค. 23:10 + ห้องใหม่', async () => {
    await open(owner, '/owner/chats');
    const n = Number(await owner.getByTestId('chat-list').getAttribute('data-count'));
    chat.check('ตรวจ', 'รายการห้อง ≥ 2 (seed + ห้องใหม่)', n >= 2, String(n));
    const seedRow = owner.locator('[data-testid^="chat-row-"]').filter({ hasText: 'เปิดกี่โมงครับ' });
    const seedText = (await seedRow.first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    chat.check('ต้องมี', 'ห้อง seed "เปิดกี่โมงครับ" แสดงในรายการ', (await seedRow.count()) >= 1, seedText);
    chat.check('ต้องมี', 'ห้อง seed เวลา 8 ต.ค. 23:10', /23:10/.test(seedText) && /(^|\D)8\s?ต\.?ค|2026-10-08|(^|\D)8\/10/.test(seedText), seedText);
    const detail = await openRoomByText(owner, 'เปิดกี่โมงครับ');
    chat.check('ต้องมี', 'ห้อง seed: "เปิดกี่โมงครับ" → "เปิดทุกวัน 08:00–24:00 ครับ"', detail.includes('เปิดกี่โมงครับ') && detail.includes('เปิดทุกวัน 08:00–24:00 ครับ'), detail.slice(0, 200));
  });
  const readNewRoom = async (label: string) => {
    const d = await openRoomByText(owner, first);
    chat.turns.push({ user: `[หลังบ้าน ${label}] เปิดห้องใหม่`, bot: d.slice(0, 400), cards: {} });
    return d;
  };
  await test.step('ห้องใหม่ (วันเดียวกัน): ชื่อ "สมปอง" · เบอร์แสดง "08x-xxx-1234" ไม่เห็นเบอร์เต็ม', async () => {
    const d = await readNewRoom('วันที่ 0');
    chat.check('ต้องมี', 'ชื่อ "สมปอง"', d.includes('สมปอง'), d.slice(0, 200));
    chat.check('ต้องมี', 'เบอร์ปิดบางส่วน "08x-xxx-1234"', d.includes('08x-xxx-1234'), d.slice(0, 200));
    chat.check('ห้ามมี', 'เบอร์เต็ม 0812341234', !d.includes('0812341234'), d.slice(0, 200));
  });
  for (const [days, now, kept] of [[89, '2027-01-06T10:00:00+07:00', true], [90, '2027-01-07T10:00:00+07:00', true], [91, '2027-01-08T10:00:00+07:00', false]] as const) {
    await test.step(`เลื่อนเวลา +${days} วัน (${now}) → ${kept ? 'ยังมีชื่อ "สมปอง"' : '"[ลบชื่อแล้ว]" "[ลบเบอร์แล้ว]"'}`, async () => {
      await setClock(owner.request, now);
      const d = await readNewRoom(`+${days} วัน`);
      if (kept) {
        chat.check('ต้องมี', `+${days} วัน ยังมีชื่อ "สมปอง"`, d.includes('สมปอง'), d.slice(0, 200));
      } else {
        chat.check('ต้องมี', '+91 วัน "[ลบชื่อแล้ว]"', d.includes('[ลบชื่อแล้ว]'), d.slice(0, 200));
        chat.check('ต้องมี', '+91 วัน "[ลบเบอร์แล้ว]"', d.includes('[ลบเบอร์แล้ว]'), d.slice(0, 200));
        chat.check('ห้ามมี', '+91 วัน ยังเห็นชื่อ "สมปอง"', !d.includes('สมปอง'), d.slice(0, 200));
      }
    });
  }
  await test.step('STAFF เปิด /owner/chats → ไม่มีสิทธิ์ (ไม่เห็นรายการแชท)', async () => {
    const staff = await newUserPage();
    await staffLoginPage(staff, 'staff');
    await staff.goto('/owner/chats');
    await staff.locator('html[data-ready="true"]').waitFor({ state: 'attached' }).catch(() => {});
    const listCount = await staff.getByTestId('chat-list').count();
    const body = (await staff.locator('body').innerText()).replace(/\s+/g, ' ');
    chat.check('ห้ามมี', 'STAFF เห็นรายการแชท (chat-list)', listCount === 0, `chat-list ${listCount}`);
    chat.check('ต้องมี', 'STAFF ได้ข้อความไม่มีสิทธิ์ (forbidden)', /ไม่มีสิทธิ์|forbidden/i.test(body), body.slice(0, 160));
  });
});
