// CR-04 น้องบอลจำเรื่องที่คุยไปแล้ว (node --test). Written before the code from the shop's answers
// (docs/handover/CHANGE-REQUESTS/answers/README.md, CR-04 = [D:CR-04]) and TC-CHAT-14 / 15 / 16.
// mergeContext is pure (texts of one room in → latest field / date / hour / hours out); the conversations go
// through runTurn like the real room does, so the BR-30 price guard is part of what is tested.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runTurn } from "./engine.ts";
import type { ChatMsg, Tools, ToolArgs } from "./engine.ts";
import { mergeContext, mockBrain } from "./mock.ts";
import { buildSystemPrompt, factsFrom, factsFromPrompt } from "./prompt.ts";

const FACTS = factsFrom({
  now: new Date("2026-10-09T10:00:00+07:00"),
  fields: [
    { id: "A", size: 5, covered: false, dayRate: 800, eveningRate: 1200 },
    { id: "B", size: 5, covered: false, dayRate: 800, eveningRate: 1200 },
    { id: "C", size: 7, covered: true, dayRate: 1200, eveningRate: 1800 },
  ],
  holidays: ["2026-10-13", "2026-10-23", "2026-12-05", "2026-12-10", "2026-12-31"],
  closures: [],
});
const SYSTEM = buildSystemPrompt(FACTS);
const F = factsFromPrompt(SYSTEM)!;

// fake web functions: same price rule as BR-07/08 (weekday before 17:00 = day rate, otherwise evening rate)
function priceOf(a: ToolArgs) {
  const f = FACTS.fields.find((x) => x.id === a.fieldId)!;
  const wd = new Date(a.date + "T00:00:00Z").getUTCDay();
  const day = wd >= 1 && wd <= 5 && !FACTS.holidays.includes(a.date) && a.startHour < 17;
  return (day ? f.dayRate : f.eveningRate) * a.hours;
}
const key = (a: ToolArgs) => `${a.fieldId}|${a.date}|${a.startHour}|${a.hours}`;

function fakeTools() {
  const calls: string[] = [];
  const tools: Tools = {
    async check(a) {
      calls.push("CHECK " + key(a));
      if (key(a) === "A|2026-10-09|19|1") {
        return { tag: "CHECK", ok: true, available: false, ...a, reasonCode: "SLOT_TAKEN", reason: "ช่วงเวลานี้ถูกจองแล้ว", alternatives: [{ fieldId: "B", startHour: 19 }] };
      }
      return { tag: "CHECK", ok: true, available: true, ...a, fieldPrice: priceOf(a), alternatives: [] };
    },
    async quote(a) {
      calls.push("QUOTE " + key(a));
      const p = priceOf(a);
      return { tag: "QUOTE", ok: true, available: true, ...a, fieldPrice: p, totalPrice: p, paymentPlan: "DEPOSIT_50", payNow: p / 2, dueAtField: p / 2 };
    },
    async book() {
      throw new Error("a memory question must never book");
    },
  };
  return { tools, calls };
}

/** one chat room: every turn sees the earlier turns (like the 20 messages the server passes to the brain) */
async function room(texts: string[]) {
  const history: ChatMsg[] = [];
  const replies: string[] = [];
  const allCalls: string[] = [];
  for (const t of texts) {
    const { tools, calls } = fakeTools();
    const r = await runTurn({ system: SYSTEM, history: [...history], userText: t, llm: async (m) => mockBrain(m), tools });
    allCalls.push(...calls);
    replies.push(r.reply);
    history.push({ role: "user", content: t }, { role: "assistant", content: r.reply });
  }
  return { replies, calls: allCalls };
}

// ---------- pure context merge ----------
test("CR-04 merge: a follow-up without field / date / hour takes the latest values of the room [D:CR-04]", () => {
  const { mem } = mergeContext(["วันนี้ 19:00 สนาม A ว่างไหม", "งั้นสนาม B ล่ะ"], F);
  assert.deepEqual([mem.fieldId, mem.date, mem.startHour, mem.hours], ["B", "2026-10-09", 19, null]);
  assert.equal(mem.ask, "avail");
});

test("CR-04 merge: a new value overrides the old one, the rest is kept [D:CR-04]", () => {
  const a = mergeContext(["สนาม A พรุ่งนี้ 19:00 ราคาเท่าไร", "เสาร์ล่ะ", "20:00 นะ", "2 ชั่วโมง"], F).mem;
  assert.deepEqual([a.fieldId, a.date, a.startHour, a.hours], ["A", "2026-10-10", 20, 2]);
  assert.equal(a.ask, "price");
});

test("CR-04 merge: 'it' / 'สนามนั้น' is the last field the CUSTOMER named, whatever the bot listed [D:CR-04]", () => {
  const { mem } = mergeContext(["Is pitch C covered?", "How much is it on Saturday night?"], F);
  assert.equal(mem.fieldId, "C");
  assert.equal(mem.date, "2026-10-10");
  assert.equal(mem.period, "evening");
});

test("CR-04 merge: 'ช่วงไหนถูกสุด' is remembered until a concrete date or start time is given", () => {
  assert.equal(mergeContext(["ช่วงไหนถูกสุด", "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ"], F).mem.cheapest, true);
  assert.equal(mergeContext(["ช่วงไหนถูกสุด", "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ"], F).mem.hours, 2);
  assert.equal(mergeContext(["ช่วงไหนถูกสุด", "พรุ่งนี้ 10:00 สนาม A"], F).mem.cheapest, false);
});

test("CR-04 merge: nothing in the room → nothing remembered (a new room starts again) [D:CR-04]", () => {
  const { mem, touched } = mergeContext(["สวัสดีครับ"], F);
  assert.deepEqual([mem.fieldId, mem.date, mem.startHour, mem.hours, mem.cheapest], [null, null, null, null, false]);
  assert.equal(touched, false);
});

// ---------- conversations ----------
test("TC-CHAT-15 'วันนี้ 19:00 สนาม A ว่างไหม' → 'งั้นสนาม B ล่ะ' checks B 19:00 today (same web function)", async () => {
  const r = await room(["วันนี้ 19:00 สนาม A ว่างไหม", "งั้นสนาม B ล่ะ"]);
  assert.deepEqual(r.calls, ["CHECK A|2026-10-09|19|1", "CHECK B|2026-10-09|19|1"]);
  assert.match(r.replies[0], /ไม่ว่าง/);
  assert.match(r.replies[1], /สนาม B/);
  assert.match(r.replies[1], /ว่างครับ/);
  assert.ok(!r.replies[1].includes("ไม่มีข้อมูล"));
});

test("TC-CHAT-14 'ช่วงไหนถูกสุด' → cheapest band ฿800/h · '2 ชั่วโมง' → ฿1,600 from the quote function (BR-30)", async () => {
  const r = await room(["ช่วงไหนถูกสุด", "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ"]);
  assert.match(r.replies[0], /฿800/);
  assert.match(r.replies[0], /17:00/);
  assert.match(r.replies[0], /จันทร์–ศุกร์/);
  assert.ok(!r.replies[0].includes("฿1,200") && !r.replies[0].includes("ไม่มีข้อมูล"));
  assert.deepEqual(r.calls, ["QUOTE A|2026-10-12|8|2"]); // first working day after today, before 17:00
  assert.match(r.replies[1], /฿1,600/);
  assert.ok(!r.replies[1].includes("ไม่มีข้อมูล"));
});

test("TC-CHAT-16 'Is pitch C covered?' → 'How much is it on Saturday night?' answers field C THB 1,800, English only", async () => {
  const r = await room(["Is pitch C covered?", "How much is it on Saturday night?"]);
  assert.match(r.replies[0], /covered/i);
  assert.match(r.replies[1], /THB 1,800/);
  assert.match(r.replies[1], /Field C/);
  assert.ok(!/Field A|Field B/.test(r.replies[1]), r.replies[1]);
  assert.ok(!/[฀-๿]/.test(r.replies[0] + r.replies[1]));
});

test("CR-04 the cheapest band follows the field being talked about; without a field it is the 5-a-side fields [D:CR-04]", async () => {
  const c = await room(["สนาม C ใหญ่ไหม", "ช่วงไหนถูกสุด"]);
  assert.match(c.replies[1], /สนาม C/);
  assert.match(c.replies[1], /฿1,200/);
  assert.ok(!c.replies[1].includes("฿800"));
  const en = await room(["which time is the cheapest?", "what about 3 hours?"]);
  assert.match(en.replies[0], /THB 800/);
  assert.match(en.replies[1], /THB 2,400/);
  assert.ok(!/[฀-๿]/.test(en.replies[0] + en.replies[1]));
});

test("CR-04 new values override: another field, another day, another hour, in the same room", async () => {
  const r = await room(["สนาม A พรุ่งนี้ 10:00 ราคาเท่าไร", "สนาม C ล่ะ", "วันจันทร์ล่ะ", "ขอ 2 ชั่วโมง"]);
  assert.deepEqual(r.calls, ["QUOTE A|2026-10-10|10|1", "QUOTE C|2026-10-10|10|1", "QUOTE C|2026-10-12|10|1", "QUOTE C|2026-10-12|10|2"]);
  assert.match(r.replies[0], /฿1,200/); // Sat = evening rate all day
  assert.match(r.replies[1], /฿1,800/);
  assert.match(r.replies[2], /฿1,200/); // Mon 10:00 = day rate of C
  assert.match(r.replies[3], /฿2,400/);
});

test("CR-04 a new room remembers nothing: the same follow-up alone still gets the shop contact (BR-29)", async () => {
  const r = await room(["งั้นสนาม B ล่ะ"]);
  assert.deepEqual(r.calls, []);
  assert.match(r.replies[0], /02-345-6789|@lookhnang/);
});

test("CR-04 other intents are not hijacked by memory (hours, covered, contact, thanks, off-topic, discount)", async () => {
  const r = await room(["สนาม A พรุ่งนี้ 19:00 ว่างไหม", "เปิดกี่โมง", "สนาม B มีหลังคาไหม", "ขอบคุณครับ", "ผลบอลเมื่อคืนเป็นยังไง", "มีส่วนลดอะไรบ้าง"]);
  assert.deepEqual(r.calls, ["CHECK A|2026-10-10|19|1"]);
  assert.match(r.replies[1], /08:00/);
  assert.match(r.replies[2], /มี 3 สนาม/);
  assert.match(r.replies[3], /ไม่มีข้อมูล/);
  assert.match(r.replies[4], /ตอบได้เฉพาะเรื่องสนาม/);
  assert.match(r.replies[5], /ไม่มีส่วนลดอื่น/);
});

test("CR-04 BR-30: a model's own number in a memory answer is still replaced by the functions' numbers", async () => {
  const { tools } = fakeTools();
  let n = 0;
  const lying = async () => (n++ === 0 ? '[QUOTE]{"fieldId":"A","date":"2026-10-12","startHour":8,"hours":2}' : "ช่วงนั้นเหลือ ฿100 ครับ");
  const r = await runTurn({
    system: SYSTEM,
    history: [{ role: "user", content: "ช่วงไหนถูกสุด" }, { role: "assistant", content: "…" }],
    userText: "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ",
    tools,
    llm: lying,
  });
  assert.ok(!r.reply.includes("฿100 "));
  assert.match(r.reply, /฿1,600/);
});

test("CR-04 booking flow is untouched: confirmation still needs name, phone and consent (no card without them)", async () => {
  const r = await room(["สนาม A พรุ่งนี้ 19:00 ว่างไหม", "อยากจองสนาม B วันจันทร์ 10:00 1 ชั่วโมง"]);
  assert.match(r.replies[1], /ขอชื่อผู้จอง/);
  assert.ok(!r.calls.some((c) => c.startsWith("BOOK")));
});
