import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, expect, open, GIF, type Json } from './fixtures';
import { BASE_URL } from './constants';
import type { Page, Locator, TestInfo } from '@playwright/test';

/**
 * ตัวช่วยของ test แชทบอท (TC-CHAT-01…20) — ใช้ร่วมกันระหว่าง chat.spec.ts และ chat.serial.spec.ts
 * - คุยในหน้าเว็บเหมือนลูกค้า (chat-open → chat-input → chat-send → รอ data-chat-state="idle")
 * - จดคำตอบจริงของบอททุกข้อความ + ผลการตรวจ "ต้องมี/ห้ามมี" ลง test-report/chat/<chatMode>/<project>/<TC>.json
 *   ให้ e2e/chat-report.mjs สร้าง test-report/CHATBOT-REPORT.md (ไม่เขียนรายงานด้วยมือ)
 */

const OUT = path.resolve(__dirname, '..', 'test-report', 'chat');

/** โหมดแชทของเว็บที่รันอยู่ (อ่านจาก GET /api/version → chatMode: mock | ai) */
let chatModeCache = '';
export async function chatMode(): Promise<string> {
  if (chatModeCache) return chatModeCache;
  try {
    const r = await fetch(`${BASE_URL}/api/version`);
    const v: any = await r.json();
    chatModeCache = String(v.chatMode ?? 'unknown');
  } catch {
    chatModeCache = 'unknown';
  }
  return chatModeCache;
}

/**
 * IP สมมติของลูกค้าแต่ละคน (X-Forwarded-For — SPEC: "IP = ตัวแรกของ X-Forwarded-For")
 * เหตุผล: เว็บจำกัด 20 ข้อความ/นาที/IP และห้องใหม่ 10 ห้อง/ชั่วโมง/IP (NFR-17) และนาฬิกาของแอปถูกล็อก "ค้าง"
 * ถ้าทุก test ใช้ IP เดียวกัน (localhost) จะชนเพดานกันเอง — ในชีวิตจริงลูกค้าแต่ละคนก็มี IP ของตัวเอง
 */
export function customerIp(b: number) {
  const r = () => Math.floor(Math.random() * 250) + 1;
  return `10.${50 + b}.${r()}.${r()}`;
}

export async function asCustomer(page: Page, b: number) {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': customerIp(b) });
}

export type Turn = { user: string; bot: string; cards: Record<string, string>; error?: string };
export type Check = { kind: 'ต้องมี' | 'ห้ามมี' | 'ตรวจ'; label: string; ok: boolean; actual?: string };

/** เก็บบทสนทนาและผลการตรวจของ test นี้ */
export class ChatLog {
  turns: Turn[] = [];
  checks: Check[] = [];
  notes: string[] = [];

  /**
   * ตรวจหนึ่งเงื่อนไข (expect.soft → ล้มแล้วยังตรวจข้ออื่นต่อ) และจดผลไว้ในรายงาน
   * @param kind ต้องมี / ห้ามมี / ตรวจ (ค่าในระบบ เช่น SQL หรือ data-value)
   */
  check(kind: Check['kind'], label: string, ok: boolean, actual?: string) {
    this.checks.push({ kind, label, ok, actual });
    expect.soft(ok, `${kind}: ${label}${actual !== undefined ? ` — ได้จริง: ${actual}` : ''}`).toBe(true);
  }
}

/** แผงแชทของหน้าหนึ่ง (= ห้องหนึ่ง เพราะห้องผูก cookie ของ browser context) */
export class ChatRoom {
  constructor(readonly page: Page, readonly log: ChatLog) {}

  widget(): Locator { return this.page.getByTestId('chat-widget'); }

  async open(pathname = '/') {
    await open(this.page, pathname);
    const btn = this.page.getByTestId('chat-open');
    await btn.click();
    await expect(this.page.getByTestId('chat-panel')).toBeVisible();
    await expect(this.page.getByTestId('chat-input')).toBeVisible();
  }

  /** ข้อความบอทล่าสุด + การ์ดที่แสดงคู่กับข้อความนั้น */
  async lastBot(): Promise<{ text: string; cards: Record<string, string> }> {
    const msg = this.page.getByTestId('chat-msg-bot').last();
    const text = ((await msg.innerText()) ?? '').trim();
    const cards: Record<string, string> = await msg.locator('xpath=..').evaluate((wrap) => {
      const out: Record<string, string> = {};
      wrap.querySelectorAll('[data-testid^="chat-card-"], [data-testid^="chat-quote-"], [data-testid="chat-booking-code"], [data-testid="chat-pay-link"]').forEach((el) => {
        const id = el.getAttribute('data-testid')!;
        const extra = ['data-value', 'data-ok', 'data-available'].map((a) => (el.hasAttribute(a) ? `${a}=${el.getAttribute(a)}` : '')).filter(Boolean).join(' ');
        const t = (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
        out[id] = [extra, t].filter(Boolean).join(' | ').slice(0, 300);
      });
      return out;
    });
    return { text, cards };
  }

  /** ข้อความที่ใช้ตรวจ "ต้องมี/ห้ามมี" = ข้อความบอท + ข้อความในการ์ด (ตาม TEST-CASES: "อ่าน chat-msg-bot ล่าสุด + การ์ด") */
  static fullText(t: Turn) {
    return [t.bot, ...Object.values(t.cards)].join(' \n ');
  }

  /** พิมพ์แล้วกดส่ง รอคำตอบใหม่ของบอทและ data-chat-state="idle" */
  async send(text: string, opts: { timeout?: number } = {}): Promise<Turn> {
    const bots = this.page.getByTestId('chat-msg-bot');
    const before = await bots.count();
    await this.page.getByTestId('chat-input').fill(text);
    await expect(this.page.getByTestId('chat-send')).toBeEnabled();
    await this.page.getByTestId('chat-send').click();
    await expect(bots).toHaveCount(before + 1, { timeout: opts.timeout ?? 90_000 });
    await expect(this.widget()).toHaveAttribute('data-chat-state', 'idle', { timeout: opts.timeout ?? 90_000 });
    const { text: bot, cards } = await this.lastBot();
    const turn: Turn = { user: text, bot, cards };
    this.log.turns.push(turn);
    return turn;
  }

  /** ส่งข้อความที่คาดว่าจะถูกปฏิเสธ (ไม่ได้คำตอบใหม่) → คืนข้อความ chat-error */
  async sendExpectError(text: string): Promise<Turn> {
    const bots = this.page.getByTestId('chat-msg-bot');
    const before = await bots.count();
    await this.page.getByTestId('chat-input').fill(text);
    await this.page.getByTestId('chat-send').click();
    const err = this.page.getByTestId('chat-error');
    await err.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
    await expect(this.widget()).toHaveAttribute('data-chat-state', 'idle', { timeout: 30_000 }).catch(() => {});
    const errorText = (await err.isVisible().catch(() => false)) ? (await err.innerText()).trim() : '';
    const after = await bots.count();
    const turn: Turn = { user: text, bot: after > before ? (await this.lastBot()).text : '', cards: {}, error: errorText };
    this.log.turns.push(turn);
    return turn;
  }

  /** การ์ดยืนยันในห้องนี้ (ทั้งห้อง) */
  confirmCards(): Locator { return this.page.getByTestId('chat-card-confirm'); }
}

// ---------------------------------------------------------------- SQL อ่านอย่างเดียว (แผนหัวข้อ 7.3 · [E sql])
/** SELECT อย่างเดียวผ่าน docker exec football-db psql (ห้ามเขียน) */
export function sql(q: string): string {
  if (!/^\s*select\b/i.test(q)) throw new Error(`ใช้ได้เฉพาะ SELECT: ${q}`);
  const r = spawnSync('docker', ['exec', 'football-db', 'psql', '-U', 'football', '-d', 'football', '-At', '-c', q], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql ล้ม: ${r.stderr || r.error?.message}`);
  return (r.stdout ?? '').trim();
}

export function sqlCount(q: string): number {
  return Number(sql(q).split('\n')[0] || '0');
}

/** จำนวนการจองที่ทับช่อง field/date/hour (ทุกสถานะ) */
export function bookingsAt(field: string, date: string, hour: number) {
  return sqlCount(`select count(*) from bookings where field_id='${field}' and date='${date}' and start_hour <= ${hour} and start_hour + hours > ${hour}`);
}

// ---------------------------------------------------------------- บันทึกผล
export type CaseMeta = { tc: string; source: string; level: string; expected: string; baseline?: string };

/** เขียนบทสนทนาจริง + ผลการตรวจของ test นี้ (เรียกใน afterEach) */
export async function saveChatResult(info: TestInfo, log: ChatLog) {
  const tc = (info.title.match(/^(TC-CHAT-\d+)/) ?? [])[1];
  if (!tc) return;
  const mode = await chatMode();
  const dir = path.join(OUT, GIF ? `${mode}-gif` : mode, info.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const failed = info.errors.length > 0 || (info.status !== 'passed' && info.status !== undefined);
  const data: Json = {
    tc,
    title: info.title,
    project: info.project.name,
    chatMode: mode,
    gifMode: GIF,
    status: failed ? (info.status === 'timedOut' ? 'timedOut' : 'failed') : 'passed',
    finishedAt: new Date().toISOString(),
    turns: log.turns,
    checks: log.checks,
    notes: log.notes,
    errors: info.errors.map((e) => (e.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 300)),
  };
  fs.writeFileSync(path.join(dir, `${tc}.json`), JSON.stringify(data, null, 2));
}

/** annotation มาตรฐานของ TC แชท: expected (= เฉลย ให้ reporter เดิม) + ที่มา + ระดับ + baseline */
export function chatAnnotations(m: CaseMeta) {
  const a = [
    { type: 'expected', description: m.expected },
    { type: 'เฉลย', description: m.expected },
    { type: 'ที่มา', description: m.source },
    { type: 'ระดับ', description: m.level },
  ];
  if (m.baseline) a.push({ type: 'baseline', description: m.baseline });
  return a;
}

/**
 * test ของแชท: fixture `chat` = บันทึกบทสนทนาของ test นี้ · ตั้ง IP ลูกค้าให้ page ก่อนเริ่ม · จบ test แล้วเขียนผลลง JSON
 * (ผล passed/failed อ่านจาก testInfo หลัง test จบ รวม expect.soft ที่ล้ม)
 */
export const chatTest = test.extend<{ chat: ChatLog }>({
  chat: async ({ page, b }, use, info) => {
    await asCustomer(page, b);
    const log = new ChatLog();
    await use(log);
    await saveChatResult(info, log);
  },
});

export { expect };
