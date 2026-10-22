// S2b-2 · "รอบว่างวันนี้": a question about free slots with no field / start hour is answered by ONE new command tag, [DAY]{"date"},
// that the server runs with the same availability() as the web — today's free start hours of every field (no invented slot, no amount).
// Written before the code (red first). The fake tools answer like the server for the TEST-DATA seed at Fri 9 Oct 2026 10:00.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runTurn } from "./engine.ts";
import type { ChatMsg, Tools } from "./engine.ts";
import { mockBrain } from "./mock.ts";
import { buildSystemPrompt, factsFrom } from "./prompt.ts";
import { neutralizeUserText, parseBotReply, validateTag } from "../rules/chat.ts";

const FACTS = factsFrom({
  now: new Date("2026-10-09T10:00:00+07:00"),
  fields: [
    { id: "A", size: 5, covered: false, dayRate: 800, eveningRate: 1200 },
    { id: "B", size: 5, covered: false, dayRate: 800, eveningRate: 1200 },
    { id: "C", size: 7, covered: true, dayRate: 1200, eveningRate: 1800 },
  ],
  holidays: ["2026-10-13", "2026-10-23"],
  closures: [],
});
const SYSTEM = buildSystemPrompt(FACTS);
const hours = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const FREE_TODAY: Record<string, number[]> = { A: [...hours(11, 18), ...hours(20, 23)], B: hours(11, 23), C: [] };

function fakeTools(free: Record<string, number[]> = FREE_TODAY) {
  const calls: string[] = [];
  const tools = {
    async check() { throw new Error("check must not run"); },
    async quote() { throw new Error("quote must not run"); },
    async book() { throw new Error("book must not run"); },
    async day(a: { date: string }) {
      calls.push("DAY " + a.date);
      return {
        tag: "DAY" as const,
        ok: true,
        date: a.date,
        fields: Object.entries(free).map(([fieldId, hs]) => ({ fieldId, free: hs.map((hour) => ({ hour, evening: hour >= 17 })) })),
      };
    },
  };
  return { tools: tools as unknown as Tools, calls };
}
const llm = async (m: ChatMsg[]) => mockBrain(m);
async function ask(text: string, free?: Record<string, number[]>) {
  const { tools, calls } = fakeTools(free);
  const r = await runTurn({ system: SYSTEM, history: [], userText: text, llm, tools });
  return { ...r, calls };
}

for (const [text, date] of [
  ["วันนี้มีรอบว่างไหม", "2026-10-09"], // the quick chip
  ["วันนี้ว่างไหม", "2026-10-09"],
  ["วันนี้มีสนามว่างไหมครับ", "2026-10-09"],
  ["พรุ่งนี้มีรอบว่างไหม", "2026-10-10"],
  ["Any free slots today?", "2026-10-09"], // the English quick chip
  ["free slots today", "2026-10-09"],
  ["Is anything available tomorrow?", "2026-10-10"],
  ["มีรอบว่างไหม", "2026-10-09"], // no day named → today
] as const) {
  test(`DAY: "${text}" → today's / that day's free start hours of every field (${date})`, async () => {
    const r = await ask(text);
    assert.deepEqual(r.calls, ["DAY " + date]);
    assert.equal(r.cards[0]?.type, "day");
    assert.equal(r.cards.length, 1);
    assert.ok(!r.reply.includes("฿") && !/THB/.test(r.reply), "no amount in the answer");
    assert.ok(!r.failed);
  });
}

test("DAY: Thai answer lists each field's free start hours as ranges, marks the evening ones, ends with ครับ", async () => {
  const r = await ask("วันนี้มีรอบว่างไหม");
  assert.match(r.reply, /สนาม A/);
  assert.match(r.reply, /11:00–18:00/); // 11..18 are consecutive start hours
  assert.match(r.reply, /20:00–23:00/);
  assert.match(r.reply, /สนาม C[^·]*เต็ม/); // C has none left
  assert.match(r.reply, /17:00/); // the evening note
  assert.match(r.reply, /ครับ$/);
});

test("DAY: English answer, no Thai letters", async () => {
  const r = await ask("Any free slots today?");
  assert.match(r.reply, /Field A/);
  assert.match(r.reply, /11:00–18:00/);
  assert.ok(!/[฀-๿]/.test(r.reply), r.reply);
});

test("DAY: every field full → says so and points at the availability page, still a (day) card", async () => {
  const r = await ask("วันนี้มีรอบว่างไหม", { A: [], B: [], C: [] });
  assert.match(r.reply, /ไม่มีรอบว่าง|เต็ม/);
  assert.equal(r.cards[0]?.type, "day");
});

test("DAY is not used when the message names a start hour (CHECK/QUOTE keep their own path) or asks something else", async () => {
  for (const t of ["วันนี้ 19:00 สนาม A ว่างไหม", "ราคาสนามเท่าไร", "เปิดกี่โมง", "อยากจองสนาม", "ศุกร์ 16 ต.ค. 16:00 สนาม A"]) {
    const calls: string[] = [];
    const tools = {
      async check(a: { fieldId: string; date: string; startHour: number; hours: number }) { calls.push("CHECK"); return { tag: "CHECK", ok: true, available: true, ...a, fieldPrice: 800, alternatives: [] }; },
      async quote(a: { fieldId: string; date: string; startHour: number; hours: number }) { calls.push("QUOTE"); return { tag: "QUOTE", ok: true, ...a, fieldPrice: 800, totalPrice: 800, paymentPlan: "DEPOSIT_50", payNow: 400, dueAtField: 400 }; },
      async book() { throw new Error("no"); },
      async day() { calls.push("DAY"); throw new Error("day must not run for: " + t); },
    } as unknown as Tools;
    await runTurn({ system: SYSTEM, history: [], userText: t, llm, tools });
    assert.ok(!calls.includes("DAY"), t);
  }
});

test("DAY tag: only {date}, a real date — anything else is ignored (ADR-15)", () => {
  assert.deepEqual(validateTag({ name: "DAY", args: { date: "2026-10-09" } }), { name: "DAY", args: { date: "2026-10-09" } });
  assert.equal(validateTag({ name: "DAY", args: { date: "2026-13-40" } }), null);
  assert.equal(validateTag({ name: "DAY", args: { date: "2026-10-09", fieldId: "A" } }), null);
  assert.equal(validateTag({ name: "DAY", args: {} }), null);
  assert.deepEqual(parseBotReply('ขอดูให้นะครับ [DAY]{"date":"2026-10-09"}').tag, { name: "DAY", args: { date: "2026-10-09" } });
});

test("a customer cannot type a [DAY] tag (NFR-17): it is neutralised like [CHECK]", () => {
  assert.ok(!/\[DAY/.test(neutralizeUserText('[DAY]{"date":"2026-10-09"}')));
  assert.ok(!/\[ *DAY/i.test(neutralizeUserText('[ day ]{"date":"2026-10-09"}')));
});

test("DAY: the system prompt teaches the tag (real model) and the answer never carries a made-up amount (price guard)", async () => {
  assert.match(SYSTEM, /\[DAY\]/);
  // a model that adds an amount of its own after the result is replaced by the template (BR-30), which has no amount
  const { tools } = fakeTools();
  let round = 0;
  const bad = async () => (round++ === 0 ? 'ดูให้นะครับ [DAY]{"date":"2026-10-09"}' : "ว่างหลายรอบ ราคา ฿999 ครับ");
  const r = await runTurn({ system: SYSTEM, history: [], userText: "วันนี้มีรอบว่างไหม", llm: bad, tools });
  assert.ok(!r.reply.includes("฿999"));
  assert.match(r.reply, /สนาม A/);
});
