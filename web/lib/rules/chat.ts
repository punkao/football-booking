// Chatbot rules (pure): BR-29 contacts / real discounts · BR-30 price guard · NFR-16 / NFR-17 / ADR-15 tags,
// length and rate limits · BR-45 retention and phone masking.
import { DAY_MS, isValidDateStr } from "./time.ts";
import type { RuleError } from "./schedule.ts";

/** BR-29: where to send questions the system has no data for */
export const SHOP_CONTACT = { phone: "02-345-6789", line: "@lookhnang" } as const;

/** BR-29: the only discounts that exist (BR-19 recurring 8+ weeks −10%, BR-23 member free hour per 10 hours) */
export const REAL_DISCOUNTS = [
  { id: "RECURRING_8_WEEKS", percent: 10, minWeeks: 8 },
  { id: "MEMBER_FREE_HOUR", everyHours: 10, freeHours: 1 },
] as const;

export const CHAT_MAX_CHARS = 500; // NFR-17 / T-11
export const CHAT_MAX_PER_MINUTE = 20; // NFR-17 / T-11 (per room)
export const CHAT_MAX_PER_MINUTE_PER_IP = 20; // R2: per client IP, whatever room
export const CHAT_MAX_ROOMS_PER_HOUR_PER_IP = 10; // R2: new rooms per client IP
export const CHAT_HISTORY_TO_MODEL = 20; // 07-SAD 9.6 (team proposal)
export const CHAT_RETENTION_DAYS = 90; // BR-45 / A-35
export const LLM_TIMEOUT_MS_DEFAULT = 60_000; // NFR-16

export function checkChatText(text: unknown): RuleError | null {
  if (typeof text !== "string" || text.trim() === "") return { code: "CHAT_EMPTY" };
  if ([...text].length > CHAT_MAX_CHARS) return { code: "CHAT_TOO_LONG", params: { max: CHAT_MAX_CHARS } };
  return null;
}

/** NFR-17: may one more message be sent? `previous` = times of this room's earlier customer messages */
export function chatRateOk(previous: Date[], now: Date): boolean {
  const recent = previous.filter((t) => now.getTime() - t.getTime() < 60_000).length;
  return recent < CHAT_MAX_PER_MINUTE;
}

/** R2: a client that throws its cookie away still meets the per-IP limits */
export function chatIpLimitOk(i: { roomsLastHour: number; messagesLastMinute: number; newRoom: boolean }): boolean {
  if (i.newRoom && i.roomsLastHour >= CHAT_MAX_ROOMS_PER_HOUR_PER_IP) return false;
  return i.messagesLastMinute < CHAT_MAX_PER_MINUTE_PER_IP;
}

export const TAG_NAMES = ["CHECK", "QUOTE", "BOOK", "DAY"] as const;
export type TagName = (typeof TAG_NAMES)[number];
export type RawTag = { name: string; args: Record<string, unknown> };

/** end index (exclusive) of the JSON object starting at `start` ("{"), or -1 when it never closes */
function jsonEnd(s: string, start: number): number {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * NFR-16 / ADR-15: split a bot reply into the text shown to people and the first command tag.
 * <think>…</think> and every [UPPERCASE]{json} part are removed; unknown or broken tags do nothing.
 */
export function parseBotReply(raw: string): { text: string; tag: RawTag | null } {
  let s = String(raw ?? "").replace(/<think>[\s\S]*?(<\/think>|$)/gi, "");
  let tag: RawTag | null = null;
  const re = /\[([A-Z_]{2,})\]/g;
  let out = "";
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out += s.slice(pos, m.index);
    let end = m.index + m[0].length;
    const after = s.slice(end);
    const lead = after.length - after.trimStart().length;
    let json: string | null = null;
    if (after.trimStart().startsWith("{")) {
      const start = end + lead;
      const close = jsonEnd(s, start);
      if (close < 0) end = s.length;
      else {
        json = s.slice(start, close);
        end = close;
      }
    }
    if (!tag && json && (TAG_NAMES as readonly string[]).includes(m[1])) {
      try {
        const args = JSON.parse(json);
        if (args && typeof args === "object" && !Array.isArray(args)) tag = { name: m[1], args };
      } catch {
        // broken JSON → no tag
      }
    }
    pos = end;
    re.lastIndex = end;
  }
  out += s.slice(pos);
  s = out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
  return { text: s, tag };
}

/** NFR-17: tags (and <think>) typed by a customer are made harmless before they are stored or sent to the model */
export function neutralizeUserText(text: string): string {
  return String(text)
    .replace(/\[(\s*)(CHECK|QUOTE|BOOK|DAY|RESULT)/gi, "［$1$2")
    .replace(/<(\/?)think/gi, "‹$1think");
}

export type ToolArgs = { fieldId: string; date: string; startHour: number; hours: number };
export type BookArgs = ToolArgs & { name: string; phone: string };
/** [DAY]{"date"}: the free start hours of every field on one day (S2b · the same availability() as the web) */
export type DayArgs = { date: string };

const FIELD_IDS = ["A", "B", "C"];

/** ADR-15: only the allowed keys, whole numbers in range, a real field and date — otherwise the tag is ignored */
export function validateTag(tag: RawTag | null): { name: TagName; args: ToolArgs | BookArgs | DayArgs } | null {
  if (!tag || !(TAG_NAMES as readonly string[]).includes(tag.name)) return null;
  const a = tag.args;
  if (tag.name === "DAY") {
    if (Object.keys(a).some((k) => k !== "date") || !isValidDateStr(a.date)) return null;
    return { name: "DAY", args: { date: a.date } };
  }
  const allowed = tag.name === "BOOK" ? ["fieldId", "date", "startHour", "hours", "name", "phone"] : ["fieldId", "date", "startHour", "hours"];
  if (Object.keys(a).some((k) => !allowed.includes(k))) return null;
  const hours = a.hours === undefined ? 1 : a.hours;
  if (typeof a.fieldId !== "string" || !FIELD_IDS.includes(a.fieldId)) return null;
  if (!isValidDateStr(a.date)) return null;
  if (typeof a.startHour !== "number" || !Number.isInteger(a.startHour) || a.startHour < 0 || a.startHour > 23) return null;
  if (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours > 24) return null;
  const base: ToolArgs = { fieldId: a.fieldId, date: a.date, startHour: a.startHour, hours };
  if (tag.name !== "BOOK") return { name: tag.name as TagName, args: base };
  const name = typeof a.name === "string" ? a.name.trim() : "";
  const phone = typeof a.phone === "string" ? a.phone.replace(/[\s-]/g, "") : "";
  if (!name || [...name].length > 60 || !/^0\d{9}$/.test(phone)) return null;
  return { name: "BOOK", args: { ...base, name, phone } };
}

/** money amounts written in a text: ฿1,200 · THB 1,200 · 1,200 บาท */
export function moneyAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(?:฿|THB)\s?(\d[\d,]*)|(\d[\d,]*)\s?(?:บาท|baht)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(Number((m[1] ?? m[2]).replace(/,/g, "")));
  return out;
}

/** BR-30: every amount in a bot answer must be one the functions produced (or a published rate) */
export function priceGuardOk(text: string, allowed: number[]): boolean {
  return moneyAmounts(text).every((n) => allowed.includes(n));
}

// ---------- BR-45 ----------
/** digits of a Thai phone written any way (+66 → 0) */
export function phoneDigits(phone: string): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.startsWith("66") && (d.length === 10 || d.length === 11) ? "0" + d.slice(2) : d;
}

/** back office shows 08x-xxx-1234 */
export function maskPhone(phone: string): string {
  const d = phoneDigits(phone);
  if (d.length < 6) return "x".repeat(d.length);
  return `${d.slice(0, 2)}x-xxx-${d.slice(-4)}`;
}

/** older than 90 days (89 and 90 days are kept) */
export function chatNeedsRedaction(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > CHAT_RETENTION_DAYS * DAY_MS;
}

/** R12: Thai numbers of 9–10 digits with - or spaces anywhere, or +66 instead of the leading 0 */
export const PHONE_IN_TEXT = /(?<![\d+])(?:\+66[\s-]?|0)\d(?:[\s-]?\d){7,8}(?!\d)/g;
const SHOP_PHONE_DIGITS = phoneDigits(SHOP_CONTACT.phone);
export const PHONES_REDACTED = "[ลบเบอร์แล้ว]";
export const NAME_REDACTED = "[ลบชื่อแล้ว]";

/** R5: shop words are never treated as a person's name */
export const SHOP_WORDS = ["สนาม", "บอล", "น้องบอล", "ลูกหนัง", "อารีน่า", "ลูกบอล"];
const LETTER = /[\u0E00-\u0E7FA-Za-z]/;

/** a phone number in a text that belongs to a customer (the shop's own number stays) */
export function isCustomerPhone(match: string): boolean {
  return phoneDigits(match) !== SHOP_PHONE_DIGITS;
}

/**
 * BR-45: remove phone numbers and the given names from a message (the rest is kept for statistics).
 * R5: a name is removed only as a whole word (no Thai / English letter right before or after it), ≥ 2 letters, not a shop word.
 */
export function redactText(text: string, names: string[]): string {
  let s = String(text).replace(PHONE_IN_TEXT, (m) => (isCustomerPhone(m) ? PHONES_REDACTED : m));
  const list = [...new Set(names.map((n) => n.trim()))]
    .filter((n) => [...n].length >= 2 && !SHOP_WORDS.includes(n))
    .sort((a, b) => b.length - a.length);
  for (const n of list) {
    let out = "";
    let from = 0;
    for (let i = s.indexOf(n); i >= 0; i = s.indexOf(n, i + 1)) {
      const before = i > 0 ? s[i - 1] : "";
      const after = s[i + n.length] ?? "";
      if (i < from || LETTER.test(before) || LETTER.test(after)) continue;
      out += s.slice(from, i) + NAME_REDACTED;
      from = i + n.length;
    }
    s = out + s.slice(from);
  }
  return s;
}

/** R3: the redaction job runs at most once an hour (app clock; a clock moved back runs again) */
export function redactionDue(lastRun: Date | null, now: Date): boolean {
  if (!lastRun) return true;
  const d = now.getTime() - lastRun.getTime();
  return d < 0 || d >= 60 * 60_000;
}
