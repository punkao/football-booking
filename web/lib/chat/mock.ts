// MODE=mock brain of "น้องบอล" (NFR-15 · ADR-16): fixed keyword rules → fixed sentences + command tags.
// Same messages in → same reply out (no randomness, no clock: "today" comes from the FACTS line of the system prompt).
// Used in-process for MODE=mock and by the mock-llm container (OpenAI-compatible) for MODE=ai tests.
import { fmtDate } from "../i18n.ts";
import { isEveningPricedDay, ratesOn } from "../rules/pricing.ts";
import { addDays, weekdayOf } from "../rules/time.ts";
import { factsFromPrompt } from "./prompt.ts";
import type { Facts } from "./prompt.ts";
import { describeResult, detectLang } from "./templates.ts";
import type { Lang } from "./templates.ts";
import type { ChatMsg, ToolResult } from "./engine.ts";

const baht = (n: number, lang: Lang) => (lang === "en" ? `THB ${n.toLocaleString("en-US")}` : `฿${n.toLocaleString("en-US")}`);

// ---------- slot extraction (exported: the BR-45 redaction job reuses name / phone) ----------
export function extractPhone(text: string): string | null {
  const m = /0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}/.exec(text);
  if (!m) return null;
  const d = m[0].replace(/\D/g, "");
  return /^0\d{9}$/.test(d) ? d : null;
}

export function extractName(text: string): string | null {
  const th = /ชื่อ(?:ผู้จอง)?\s*[:：]?\s*(.+?)(?=\s*(?:เบอร์|โทร|,|，|ยินยอม|\d)|\s*$)/.exec(text);
  const en = /(?:my name is|name\s*[:：]|name is)\s*([A-Za-z][A-Za-z .'-]*?)(?=\s*(?:,|phone|tel|\d)|\s*$)/i.exec(text);
  const raw = (th?.[1] ?? en?.[1] ?? "").replace(/\s*(ครับ|ค่ะ|คะ|นะครับ|นะคะ|นะ)$/, "").trim();
  return raw && [...raw].length <= 60 ? raw : null;
}

function extractField(text: string): string | null {
  const m =
    /สนาม\s*([ABCabc])(?![A-Za-z])/.exec(text) ??
    /\bfield\s*([ABC])\b/i.exec(text) ??
    /\b[Pp]itch\s*([ABC])\b/.exec(text) ??
    /\b([ABC])\s*(?:field|[Pp]itch|สนาม)/.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/** "tonight" / "ช่วงเย็น" / "in the morning": the price band the customer means when no start hour is given */
function extractPeriod(text: string): "day" | "evening" | null {
  if (/เย็น|ค่ำ|กลางคืน|คืนนี้|\bnight\b|\bevening\b|\btonight\b/i.test(text)) return "evening";
  if (/เช้า|บ่าย|กลางวัน|\bmorning\b|\bafternoon\b|\bdaytime\b/i.test(text)) return "day";
  return null;
}

const MONTHS: [RegExp, number][] = [
  [/^(มค|มกรา|jan)/i, 1], [/^(กพ|กุมภา|feb)/i, 2], [/^(มีค|มีนา|mar)/i, 3], [/^(เมย|เมษา|apr)/i, 4],
  [/^(พค|พฤษภา|may)/i, 5], [/^(มิย|มิถุนา|jun)/i, 6], [/^(กค|กรกฎา|jul)/i, 7], [/^(สค|สิงหา|aug)/i, 8],
  [/^(กย|กันยา|sep)/i, 9], [/^(ตค|ตุลา|oct)/i, 10], [/^(พย|พฤศจิกา|nov)/i, 11], [/^(ธค|ธันวา|dec)/i, 12],
];
const TH_WEEKDAYS: [RegExp, number][] = [
  [/อาทิตย์/, 0], [/จันทร์/, 1], [/อังคาร/, 2], [/พุธ/, 3], [/พฤหัส/, 4], [/ศุกร์/, 5], [/เสาร์/, 6],
];
const EN_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function monthOf(token: string): number | null {
  const t = token.replace(/[.\s]/g, "");
  for (const [re, m] of MONTHS) if (re.test(t)) return m;
  return null;
}

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function withYear(facts: Facts, m: number, d: number): string {
  const y = Number(facts.today.slice(0, 4));
  const s = ymd(y, m, d);
  return s < addDays(facts.today, -180) ? ymd(y + 1, m, d) : s;
}

function extractDate(text: string, facts: Facts): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) return iso[0];
  const th = /(\d{1,2})\s*([ก-๙.]{2,}|[A-Za-z]{3,})/g;
  let m: RegExpExecArray | null;
  while ((m = th.exec(text))) {
    const mo = monthOf(m[2]);
    if (mo) return withYear(facts, mo, Number(m[1]));
  }
  const en = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i.exec(text);
  if (en) return withYear(facts, monthOf(en[1])!, Number(en[2]));
  if (/วันนี้|\btoday\b|\btonight\b|คืนนี้/i.test(text)) return facts.today;
  if (/มะรืน|day after tomorrow/i.test(text)) return addDays(facts.today, 2);
  if (/พรุ่งนี้|\btomorrow\b/i.test(text)) return addDays(facts.today, 1);
  let wd: number | null = null;
  for (const [re, w] of TH_WEEKDAYS) if (re.test(text)) wd = w;
  const enWd = EN_WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
  if (enWd >= 0) wd = enWd;
  if (wd !== null) {
    const diff = (wd - weekdayOf(facts.today) + 7) % 7;
    return addDays(facts.today, diff);
  }
  return null;
}

function extractHour(text: string): number | null {
  const hm = /(?<!\d)(\d{1,2}):(\d{2})(?!\d)/.exec(text);
  if (hm) return Number(hm[1]);
  const evening = /(\d{1,2})\s*โมงเย็น/.exec(text);
  if (evening) return Number(evening[1]) + 12;
  const thum = /(\d{1,2})\s*ทุ่ม/.exec(text);
  if (thum) return Number(thum[1]) + 18;
  const afternoon = /บ่าย\s*(\d{1,2})/.exec(text);
  if (afternoon) return Number(afternoon[1]) + 12;
  const mong = /(\d{1,2})\s*โมง(?!เย็น)/.exec(text);
  if (mong) return Number(mong[1]);
  const ampm = /\b(\d{1,2})\s*(am|pm)\b/i.exec(text);
  if (ampm) return (Number(ampm[1]) % 12) + (ampm[2].toLowerCase() === "pm" ? 12 : 0);
  return null;
}

function extractHours(text: string): number | null {
  const m = /(\d{1,2})\s*(?:ชั่วโมง|ชม\.?)/.exec(text) ?? /\b(\d{1,2})\s*(?:hours?|hrs?)\b/i.exec(text) ?? /[x×]\s*(\d{1,2})(?!\d|:)/.exec(text);
  return m ? Number(m[1]) : null;
}

function extractConsent(text: string): boolean | null {
  if (/ไม่ยินยอม|ไม่ตกลง|ไม่อนุญาต|ไม่ให้เก็บ|do not consent|don't consent|not consent|no consent|disagree/i.test(text)) return false;
  if (/ยินยอม|ตกลง|อนุญาต|\bconsent\b|\bi agree\b|\bagree\b/i.test(text)) return true;
  return null;
}

// ---------- intents ----------
const RE_CANCEL = /ยกเลิก|เลื่อน|คืนเงิน|คืนเครดิต|เปลี่ยนเวลา|\bcancel|\breschedul|\brefund|change my booking/i;
const RE_OVERRIDE = /ลดราคา|ลดให้|ลดเหลือ|ไม่ต้องสน|ข้ามกฎ|ignore (the |all |previous |your )?(rules|instructions)|give me a discount|make it \d+/i;
const RE_DISCOUNT = /ส่วนลด|โปร|discount|promotion|\bdeals?\b/i;
const RE_EXTRAS = /เอี๊ยม|ลูกบอล|เช่า|เครดิต|ชั่วโมงฟรี|ใช้สิทธิ์|จองประจำ|ทุกสัปดาห์|\bbibs?\b|\brent|\bcredit|free hour|recurring|every week/i;
const RE_BOOK = /จอง|\bbook(ing)?\b|\breserve/i;
const RE_AVAIL = /ว่าง|\bavailable\b|\bfree\b/i;
const RE_PRICE = /ราคา|เท่าไร|เท่าไหร่|กี่บาท|\bprice|how much|\bcost/i;
/** CR-04: "ช่วงไหนถูกสุด" is answered with the price band, never with a made-up slot */
const RE_CHEAPEST = /ถูกสุด|ถูกที่สุด|ต่ำสุด|\bcheapest\b|\blowest (?:price|rate)|\bleast expensive|\bbest (?:price|rate)/i;
const RE_HOURS =/กี่โมง|เปิด|ปิดกี่|เวลาทำการ|\bopen|\bclose|opening hours|what time/i;
const RE_FIELDS = /มีกี่สนาม|กี่คน|ขนาด|หลังคา|how many fields|field size|\bcovered\b|\broof/i;
const RE_CONTACT = /ติดต่อ|เบอร์ร้าน|โทรหา|ไลน์|\bline\b|contact/i;
const RE_GREETING = /^(สวัสดี|หวัดดี|hello|hi|hey)\b/i;
const RE_OFFTOPIC = /ผลบอล|บอลเมื่อคืน|ข่าว|การเมือง|หวย|อากาศ|ดูดวง|\bscores?\b|\bnews\b|weather|politic|lottery/i;

/** questions the brain asks while collecting a booking — a reply starting with one keeps the booking going */
const BOOKING_PROMPTS = ["เพื่อจองสนาม", "ขอชื่อผู้จอง", "ขอเบอร์โทรผู้จอง", "ร้านขอเก็บชื่อและเบอร์", "To book a field", "May I have your name", "May I have your phone", "We need to keep your name"];

function contactLine(f: Facts, lang: Lang) {
  return lang === "en" ? `please call ${f.contact.phone} or LINE ${f.contact.line}` : `สอบถามร้านได้ที่โทร ${f.contact.phone} หรือ LINE ${f.contact.line}`;
}

function rateLines(f: Facts, lang: Lang, only?: string | null) {
  return f.fields
    .filter((x) => !only || x.id === only)
    .map((x) =>
      (lang === "en"
        ? `Field ${x.id}: ${baht(x.dayRate, lang)}/h (starting before 17:00 Mon–Fri) and ${baht(x.eveningRate, lang)}/h (from 17:00, weekends and holidays)`
        : `สนาม ${x.id} ราคา ${baht(x.dayRate, lang)}/ชั่วโมง (เริ่มก่อน 17:00 จันทร์–ศุกร์) และ ${baht(x.eveningRate, lang)}/ชั่วโมง (ตั้งแต่ 17:00 เสาร์–อาทิตย์ และวันหยุด)`) + upcomingRatesText(x, lang),
    )
    .join(lang === "en" ? "; " : " · ");
}

/** CR-05: "from 1 Nov 2026 …THB 1,300/h" — a price that starts later, told in advance (only the rates that really change) */
function upcomingRatesText(x: Facts["fields"][number], lang: Lang) {
  return (x.rateChanges ?? [])
    .map((c) => {
      const since = fmtDate(lang, c.from, false);
      const parts: string[] = [];
      if (c.dayRate !== x.dayRate) parts.push(lang === "en" ? `before 17:00 ${baht(c.dayRate, lang)}/h` : `ก่อน 17:00 ${baht(c.dayRate, lang)}/ชั่วโมง`);
      if (c.eveningRate !== x.eveningRate) parts.push(lang === "en" ? `from 17:00, weekends and holidays ${baht(c.eveningRate, lang)}/h` : `ตั้งแต่ 17:00 เสาร์–อาทิตย์ และวันหยุด ${baht(c.eveningRate, lang)}/ชั่วโมง`);
      if (!parts.length) return "";
      return lang === "en" ? `; from ${since}: ${parts.join(", ")}` : ` · ตั้งแต่ ${since}: ${parts.join(" · ")}`;
    })
    .join("");
}

function discountsText(lang: Lang) {
  return lang === "en"
    ? "There are only 2 discounts: 1) recurring bookings of 8 weeks or more get 10% off the field price, 2) members get 1 free hour for every 10 paid hours (slots starting before 17:00 Mon–Fri). There are no other discounts."
    : "ส่วนลดที่มีจริงมี 2 อย่างครับ: 1) จองประจำตั้งแต่ 8 สัปดาห์ขึ้นไป ลด 10% ของค่าสนาม 2) สมาชิกสะสมครบทุก 10 ชั่วโมง ได้ฟรี 1 ชั่วโมง (ใช้กับรอบที่เริ่มก่อน 17:00 จันทร์–ศุกร์) ไม่มีส่วนลดอื่นครับ";
}

type Slots = { fieldId: string | null; date: string | null; startHour: number | null; hours: number | null; name: string | null; phone: string | null; consent: boolean | null };

function collect(texts: string[], facts: Facts): Slots {
  const s: Slots = { fieldId: null, date: null, startHour: null, hours: null, name: null, phone: null, consent: null };
  for (const t of texts) {
    s.fieldId = extractField(t) ?? s.fieldId;
    s.date = extractDate(t, facts) ?? s.date;
    s.startHour = extractHour(t) ?? s.startHour;
    s.hours = extractHours(t) ?? s.hours;
    s.name = extractName(t) ?? s.name;
    s.phone = extractPhone(t) ?? s.phone;
    const c = extractConsent(t);
    if (c !== null) s.consent = c;
  }
  return s;
}

// ---------- CR-04: what the room has already said (US-39 · FR-35) ----------
export type Memory = {
  fieldId: string | null;
  date: string | null;
  startHour: number | null;
  hours: number | null;
  period: "day" | "evening" | null;
  /** kind of the last availability / price question */
  ask: "avail" | "price" | null;
  /** "ช่วงไหนถูกสุด" was asked and no concrete date or start hour has been given since */
  cheapest: boolean;
};

/**
 * Latest value of each slot over the customer's messages of ONE room, oldest first (pure).
 * A new value overrides the old one; a missing one keeps it. Only what the customer typed counts ("it" = the last field
 * the customer named, not a field the bot offered). `touched` = the last message itself carries a slot or a question.
 */
export function mergeContext(texts: string[], facts: Facts): { mem: Memory; touched: boolean } {
  const mem: Memory = { fieldId: null, date: null, startHour: null, hours: null, period: null, ask: null, cheapest: false };
  let touched = false;
  for (const t of texts) {
    const field = extractField(t);
    const date = extractDate(t, facts);
    const hour = extractHour(t);
    const hours = extractHours(t);
    const period = extractPeriod(t);
    const ask = RE_AVAIL.test(t) ? "avail" : RE_PRICE.test(t) ? "price" : null;
    const cheap = RE_CHEAPEST.test(t);
    if (field) mem.fieldId = field;
    if (date) mem.date = date;
    if (hour !== null) {
      mem.startHour = hour;
      mem.period = null;
    }
    if (hours !== null) mem.hours = hours;
    if (period && hour === null) mem.period = period;
    if (ask) mem.ask = ask;
    if (date || hour !== null) mem.cheapest = false;
    if (cheap) mem.cheapest = true;
    touched = !!(field || date || hour !== null || hours !== null || period || ask || cheap);
  }
  return { mem, touched };
}

/** a message about something else (opening hours, roof, contact, hello, off-topic) is never a follow-up on a slot */
const isOtherIntent = (text: string) => RE_HOURS.test(text) || RE_FIELDS.test(text) || RE_CONTACT.test(text) || RE_GREETING.test(text.trim()) || RE_OFFTOPIC.test(text);

/** the cheapest band is "start before 17:00 Mon–Fri": a quote needs a real slot, so the first working day from tomorrow at opening time */
const BAND_HOURS_MAX = 9; // 08:00 + 9 h = 17:00
function bandQuoteArgs(facts: Facts, fieldId: string, hours: number) {
  let date = addDays(facts.today, 1);
  for (let i = 0; i < 30; i++, date = addDays(date, 1)) {
    if (!isEveningPricedDay(date, facts.holidays)) break;
  }
  return { fieldId, date, startHour: Number.parseInt(facts.open, 10) || 8, hours };
}

/** CR-04 [D]: the field being talked about, else the 5-a-side fields (cheapest day rate if the shop has none) */
function bandFields(facts: Facts, fieldId: string | null) {
  const own = facts.fields.filter((x) => x.id === fieldId);
  if (own.length) return own;
  const five = facts.fields.filter((x) => x.size === 5);
  if (five.length) return five;
  const min = Math.min(...facts.fields.map((x) => x.dayRate));
  return facts.fields.filter((x) => x.dayRate === min);
}

/** "สนาม A, B ฿800/ชั่วโมง" — fields with the same rate share one phrase */
function ratePhrase(fields: Facts["fields"], pick: (f: Facts["fields"][number]) => number, lang: Lang) {
  const groups = new Map<number, string[]>();
  for (const f of fields) groups.set(pick(f), [...(groups.get(pick(f)) ?? []), f.id]);
  return [...groups]
    .map(([rate, ids]) => (lang === "en" ? `Field ${ids.join(", ")} ${baht(rate, lang)}/hour` : `สนาม ${ids.join(", ")} ${baht(rate, lang)}/ชั่วโมง`))
    .join(lang === "en" ? "; " : " · ");
}

function cheapestReply(facts: Facts, fieldId: string | null, lang: Lang) {
  const phrase = ratePhrase(bandFields(facts, fieldId), (f) => f.dayRate, lang);
  return lang === "en"
    ? `The cheapest period is a slot starting before 17:00 Mon–Fri (not on holidays): ${phrase}. Tell me how many hours and I will work out the price.`
    : `ช่วงที่ราคาถูกสุดคือรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์ (ไม่รวมวันหยุด) ${phrase} ครับ บอกจำนวนชั่วโมงที่ต้องการ น้องบอลจะคิดราคาให้ครับ`;
}

function bandQuoteReply(r: { fieldId: string; hours: number; totalPrice?: number }, facts: Facts, lang: Lang) {
  const rate = facts.fields.find((x) => x.id === r.fieldId)?.dayRate ?? 0;
  const total = r.totalPrice ?? 0;
  const calc = total === rate * r.hours ? ` (${baht(rate, lang)} × ${r.hours})` : "";
  return lang === "en"
    ? `The cheapest period (starting before 17:00 Mon–Fri) for ${r.hours} hour${r.hours === 1 ? "" : "s"} on Field ${r.fieldId} costs ${baht(total, lang)}${calc}. Tell me the date and start time and I will check that the slot is free.`
    : `ช่วงที่ราคาถูกสุด (เริ่มก่อน 17:00 จันทร์–ศุกร์) สนาม ${r.fieldId} ${r.hours} ชั่วโมง ราคา ${baht(total, lang)}${calc} ครับ บอกวันและเวลาเริ่ม น้องบอลจะตรวจรอบว่างให้ครับ`;
}

/** price per hour of a field on a day (no start hour yet), from the shop's rates — the same BR-07 / BR-08 rule as the web */
function dayRateReply(facts: Facts, fieldId: string, date: string, period: Memory["period"], lang: Lang) {
  const field = facts.fields.find((x) => x.id === fieldId);
  if (!field) return null;
  const f = { ...field, ...ratesOn(field, date) }; // CR-05: the rates of THAT day (a day after a price change uses the new price)
  const day = lang === "en" ? `Field ${fieldId} on ${fmtDate(lang, date)}` : `สนาม ${fieldId} ${fmtDate(lang, date)}`;
  const ask = lang === "en" ? " Tell me the start time and how many hours and I will work out the price and check the slot." : " บอกเวลาเริ่มและจำนวนชั่วโมง น้องบอลจะคิดราคาและตรวจรอบให้ครับ";
  if (isEveningPricedDay(date, facts.holidays)) {
    return lang === "en"
      ? `${day}: ${baht(f.eveningRate, lang)}/hour (weekends and holidays use the evening rate all day).${ask}`
      : `${day} ราคา ${baht(f.eveningRate, lang)}/ชั่วโมง (เสาร์–อาทิตย์และวันหยุดคิดอัตราเย็นทั้งวัน)${ask}`;
  }
  const dayText = lang === "en" ? `${baht(f.dayRate, lang)}/hour for a slot starting before 17:00` : `${baht(f.dayRate, lang)}/ชั่วโมง สำหรับรอบที่เริ่มก่อน 17:00`;
  const eveText = lang === "en" ? `${baht(f.eveningRate, lang)}/hour from 17:00` : `${baht(f.eveningRate, lang)}/ชั่วโมง ตั้งแต่ 17:00`;
  const body = period === "evening" ? eveText : period === "day" ? dayText : lang === "en" ? `${dayText}, ${eveText}` : `${dayText} และ ${eveText}`;
  return lang === "en" ? `${day}: ${body}.${ask}` : `${day} ราคา ${body}${ask}`;
}

function bookingReply(s: Slots, lang: Lang): string {
  const missing: string[] = [];
  if (!s.fieldId) missing.push(lang === "en" ? "the field (A, B or C)" : "สนาม (A, B หรือ C)");
  if (!s.date) missing.push(lang === "en" ? "the date" : "วันที่");
  if (s.startHour === null) missing.push(lang === "en" ? "the start time" : "เวลาเริ่ม");
  if (s.hours === null) missing.push(lang === "en" ? "how many hours" : "จำนวนชั่วโมง");
  if (missing.length) {
    return lang === "en" ? `To book a field, please tell me ${missing.join(", ")}.` : `เพื่อจองสนาม ขอทราบ${missing.join(" ")}ด้วยครับ`;
  }
  if (!s.name) return lang === "en" ? "May I have your name for the booking?" : "ขอชื่อผู้จองด้วยครับ";
  if (!s.phone) return lang === "en" ? "May I have your phone number (10 digits) for the booking?" : "ขอเบอร์โทรผู้จอง 10 หลักด้วยครับ";
  if (s.consent === null) {
    return lang === "en"
      ? 'We need to keep your name and phone number for this booking (PDPA). Do you consent? Please answer "I consent" or "I do not consent".'
      : 'ร้านขอเก็บชื่อและเบอร์โทรเพื่อการจองนี้ (PDPA) ยินยอมไหมครับ พิมพ์ "ยินยอม" หรือ "ไม่ยินยอม" ครับ';
  }
  if (s.consent === false) {
    return lang === "en" ? "Understood. No booking was made and your details are not kept for a booking." : "รับทราบครับ ไม่สร้างการจอง และไม่เก็บข้อมูลเพื่อการจองนี้ครับ";
  }
  const tag = JSON.stringify({ fieldId: s.fieldId, date: s.date, startHour: s.startHour, hours: s.hours, name: s.name, phone: s.phone });
  return (lang === "en" ? "Let me check the slot and the price first. " : "ขอตรวจรอบและราคาให้ก่อนนะครับ ") + "[BOOK]" + tag;
}

export function mockBrain(messages: ChatMsg[]): string {
  const facts = factsFromPrompt(messages.find((m) => m.role === "system")?.content ?? "");
  if (!facts) return "ขออภัยครับ ระบบยังไม่พร้อม";
  const userMsgs = messages.map((m, i) => ({ ...m, i })).filter((m) => m.role === "user" && !m.content.startsWith("[RESULT]"));
  const current = userMsgs[userMsgs.length - 1];
  const text = current?.content ?? "";
  const lang = detectLang(text);
  // CR-04: what this room has said before (the server passes the last 20 messages) and whether this message follows up on it
  const { mem, touched } = mergeContext(userMsgs.map((m) => m.content), facts);
  const here = { field: extractField(text), date: extractDate(text, facts), hour: extractHour(text), hours: extractHours(text) };
  const asks = RE_AVAIL.test(text) || RE_PRICE.test(text) || RE_CHEAPEST.test(text) || (touched && !isOtherIntent(text));
  const band: "rate" | "quote" | null =
    !asks || !mem.cheapest ? null : RE_CHEAPEST.test(text) && here.hours === null ? "rate" : mem.hours !== null && mem.hours <= BAND_HOURS_MAX ? "quote" : "rate";
  const last = messages[messages.length - 1];
  if (last?.role === "user" && last.content.startsWith("[RESULT]")) {
    try {
      const result = JSON.parse(last.content.slice(8)) as ToolResult;
      if (band === "quote" && result.tag === "QUOTE" && result.ok) return bandQuoteReply(result, facts, lang);
      return describeResult(result, lang);
    } catch {
      return lang === "en" ? `Sorry, ${contactLine(facts, lang)}.` : `ขออภัยครับ ${contactLine(facts, lang)} ครับ`;
    }
  }

  // BR-32: no cancel / reschedule / refund / back-office tools
  if (RE_CANCEL.test(text)) {
    return lang === "en"
      ? `Nong Ball can't cancel, reschedule or refund bookings. You can do it yourself on the "My bookings" page (/my) with your booking code and phone number, or ${contactLine(facts, lang)}.`
      : `น้องบอลยกเลิก เลื่อน หรือคืนเครดิตให้ไม่ได้ครับ ทำได้เองที่หน้า "การจองของฉัน" (/my) ด้วยรหัสการจองและเบอร์โทร หรือ${contactLine(facts, lang)} ครับ`;
  }
  // BR-32: instructions to break the rules have no effect — prices stay BR-07
  if (RE_OVERRIDE.test(text)) {
    const only = extractField(text);
    return lang === "en"
      ? `Sorry, Nong Ball can't change prices or rules. ${rateLines(facts, lang, only)}. ${discountsText(lang)}`
      : `ขอโทษครับ น้องบอลลดราคาหรือเปลี่ยนกฎให้ไม่ได้ ${rateLines(facts, lang, only)} · ${discountsText(lang)}`;
  }
  if (RE_DISCOUNT.test(text) && !RE_BOOK.test(text)) return discountsText(lang);

  // booking: started by a booking word, or continuing after one of the brain's booking questions
  let start = -1;
  for (let k = userMsgs.length - 1; k >= 0; k--) {
    if (RE_BOOK.test(userMsgs[k].content)) {
      start = k;
      break;
    }
  }
  const prevBot = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const continuing = start >= 0 && BOOKING_PROMPTS.some((p) => prevBot.startsWith(p));
  const isBooking = RE_BOOK.test(text) || continuing;
  if (isBooking && RE_EXTRAS.test(userMsgs.slice(Math.max(0, start)).map((m) => m.content).join("\n"))) {
    return lang === "en"
      ? "Bookings with bibs or balls, credit, free hours or recurring weeks can only be made on the website (Book page). In chat I can book a basic field booking only."
      : "การจองที่มีเช่าเอี๊ยม/ลูกบอล ใช้เครดิต ชั่วโมงฟรี หรือจองประจำ ต้องจองที่หน้าเว็บครับ (เมนู ตารางว่าง) ในแชทน้องบอลจองได้เฉพาะการจองสนามพื้นฐานครับ";
  }
  if (isBooking) return bookingReply(collect(userMsgs.slice(Math.max(0, start)).map((m) => m.content), facts), lang);

  if (RE_EXTRAS.test(text)) {
    return lang === "en"
      ? `Bibs are ${baht(50, lang)} per set and balls ${baht(30, lang)} each, per booking. Please add them when you book on the website.`
      : `เช่าเอี๊ยมชุดละ ${baht(50, lang)} ลูกบอลลูกละ ${baht(30, lang)} ต่อการจอง เลือกได้ตอนจองที่หน้าเว็บครับ`;
  }

  // BR-30: availability / price questions go through the same functions as the web
  // CR-04: a field / date / hour / number of hours the message does not give is taken from the room (new values override)
  if (band === "rate") return cheapestReply(facts, mem.fieldId, lang);
  if (band === "quote") {
    const tag = JSON.stringify(bandQuoteArgs(facts, bandFields(facts, mem.fieldId)[0].id, mem.hours!));
    return (lang === "en" ? "Let me work out the price. " : "ขอคิดราคาให้นะครับ ") + "[QUOTE]" + tag;
  }
  const completeHere = !!(here.field && here.date && here.hour !== null);
  if (mem.fieldId && mem.date && mem.startHour !== null && (completeHere || asks)) {
    const tag = JSON.stringify({ fieldId: mem.fieldId, date: mem.date, startHour: mem.startHour, hours: mem.hours ?? 1 });
    // "ว่างไหม" → check · "ราคา" → quote · neither (e.g. "งั้นสนาม B ล่ะ") → the same kind as the room's last question
    if (RE_AVAIL.test(text) || (!RE_PRICE.test(text) && !completeHere && mem.ask === "avail")) return (lang === "en" ? "Let me check. " : "ขอตรวจรอบให้นะครับ ") + "[CHECK]" + tag;
    return (lang === "en" ? "Let me work out the price. " : "ขอคิดราคาให้นะครับ ") + "[QUOTE]" + tag;
  }
  // S2b: "วันนี้มีรอบว่างไหม" — free slots asked with no start hour → every field's free start hours of that day ([DAY], same availability() as the web)
  if (RE_AVAIL.test(text) && !RE_PRICE.test(text) && here.hour === null && mem.startHour === null) {
    const date = here.date ?? mem.date ?? facts.today;
    return (lang === "en" ? "Let me look at the free slots. " : "ขอดูรอบว่างให้นะครับ ") + "[DAY]" + JSON.stringify({ date });
  }
  if (RE_AVAIL.test(text) || RE_PRICE.test(text) || (touched && !isOtherIntent(text) && mem.ask !== null)) {
    const priceAsked = RE_PRICE.test(text) || (!RE_AVAIL.test(text) && mem.ask === "price");
    const byDay = priceAsked && mem.fieldId && mem.date ? dayRateReply(facts, mem.fieldId, mem.date, mem.period, lang) : null;
    if (byDay) return byDay;
    return lang === "en"
      ? `Please tell me the field, date and start time and I will check it for you. ${rateLines(facts, lang, mem.fieldId)}.`
      : `บอกสนาม วันที่ และเวลาเริ่มได้เลยครับ น้องบอลจะตรวจให้ ${rateLines(facts, lang, mem.fieldId)} ครับ`;
  }
  if (RE_HOURS.test(text)) return lang === "en" ? "We are open every day 08:00–24:00." : "เปิดทุกวัน 08:00–24:00 ครับ";
  if (RE_FIELDS.test(text)) {
    const list = facts.fields
      .map((x) => (lang === "en" ? `Field ${x.id}: ${x.size}-a-side, ${x.covered ? "covered" : "open-air"}` : `สนาม ${x.id} ${x.size} คน ${x.covered ? "มีหลังคา" : "กลางแจ้ง"}`))
      .join(lang === "en" ? "; " : " · ");
    return lang === "en" ? `We have 3 fields. ${list}.` : `มี 3 สนามครับ ${list} ครับ`;
  }
  if (RE_CONTACT.test(text)) return lang === "en" ? `You can call ${facts.contact.phone} or LINE ${facts.contact.line}.` : `ติดต่อร้านได้ที่โทร ${facts.contact.phone} หรือ LINE ${facts.contact.line} ครับ`;
  if (RE_GREETING.test(text.trim())) {
    return lang === "en"
      ? "Hello! I'm Nong Ball. I can tell you opening hours, prices and free slots, and book a field for you."
      : "สวัสดีครับ น้องบอลช่วยตอบเวลาเปิด ราคา รอบว่าง และจองสนามให้ได้ครับ";
  }
  if (RE_OFFTOPIC.test(text)) {
    return lang === "en"
      ? "Sorry, I can only help with Luknang Arena: free slots, prices and bookings. Which day would you like to play?"
      : "ขอโทษครับ น้องบอลตอบได้เฉพาะเรื่องสนามของลูกหนัง อารีน่า เช่น รอบว่าง ราคา และการจอง สนใจจองสนามวันไหนดีครับ";
  }
  // BR-29: no data → never make it up, give the contact
  return lang === "en" ? `Sorry, I don't have that information — ${contactLine(facts, lang)}.` : `ขอโทษครับ เรื่องนี้น้องบอลไม่มีข้อมูล ${contactLine(facts, lang)} ครับ`;
}
