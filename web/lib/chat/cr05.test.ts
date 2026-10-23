// CR-05 น้องบอลบอกราคาที่มีวันมีผล (node --test). Written from the shop's answers (docs/handover/CHANGE-REQUESTS/answers/README.md, CR-05 = [D:CR-05])
// and the letter: "แชทบอท ใบเสนอราคา ต้องบอกราคาเดียวกัน". The facts carry today's rates + the changes that start later;
// the mock brain tells both, a question about a date is answered with the rates of THAT date, and the BR-30 price guard
// must let a published future rate through (it is a number of the FACTS, not an invented price).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runTurn } from "./engine.ts";
import type { Tools } from "./engine.ts";
import { mockBrain } from "./mock.ts";
import { buildSystemPrompt, factsFrom, factsFromPrompt } from "./prompt.ts";

const NEXT = [{ from: "2026-11-01", dayRate: 800, eveningRate: 1300 }];
const FIELDS_BEFORE = [
  { id: "A", size: 5, covered: false, dayRate: 800, eveningRate: 1200, rateChanges: NEXT },
  { id: "B", size: 5, covered: false, dayRate: 800, eveningRate: 1200, rateChanges: NEXT },
  { id: "C", size: 7, covered: true, dayRate: 1200, eveningRate: 1800, rateChanges: [] },
];
const FIELDS_AFTER = [
  { id: "A", size: 5, covered: false, dayRate: 800, eveningRate: 1300, rateChanges: [] },
  { id: "B", size: 5, covered: false, dayRate: 800, eveningRate: 1300, rateChanges: [] },
  { id: "C", size: 7, covered: true, dayRate: 1200, eveningRate: 1800, rateChanges: [] },
];
const sys = (now: string, fields: typeof FIELDS_BEFORE) => buildSystemPrompt(factsFrom({ now: new Date(now), fields, holidays: [], closures: [] }));
const BEFORE = sys("2026-10-21T10:00:00+07:00", FIELDS_BEFORE);
const AFTER = sys("2026-11-02T10:00:00+07:00", FIELDS_AFTER);

const noTools: Tools = {
  async check() { throw new Error("a price question about no slot must not call tools"); },
  async quote() { throw new Error("a price question about no slot must not call tools"); },
  async book() { throw new Error("must never book"); },
};
async function ask(system: string, text: string, history: { role: "user" | "assistant"; content: string }[] = []) {
  return (await runTurn({ system, history, userText: text, llm: async (m) => mockBrain(m), tools: noTools })).reply;
}

test("CR-05 facts: today's rates + the price change that starts later survive the prompt round trip", () => {
  const f = factsFromPrompt(BEFORE)!;
  assert.equal(f.fields[0].eveningRate, 1200);
  assert.deepEqual(f.fields[0].rateChanges, NEXT);
  assert.deepEqual(f.fields[2].rateChanges, []);
  assert.match(BEFORE, /฿1,300\/ชม\./, "the prompt text tells the model the future rate");
});

test("CR-05 \"สนาม A ราคาเท่าไร\" before 1 Nov: ฿800 ฿1,200 and ฿1,300 from 1 Nov; field C has no new price [D:CR-05]", async () => {
  const a = await ask(BEFORE, "สนาม A ราคาเท่าไร");
  for (const s of ["฿800", "฿1,200", "฿1,300", "1 พ.ย."]) assert.ok(a.includes(s), `reply must have ${s}: ${a}`);
  const c = await ask(BEFORE, "สนาม C ราคาเท่าไร");
  assert.ok(c.includes("฿1,800") && !c.includes("1,300"), c);
});

test("CR-05 English: THB 1,300 from 1 Nov 2026", async () => {
  const a = await ask(BEFORE, "How much is field A?");
  for (const s of ["THB 800", "THB 1,200", "THB 1,300", "1 Nov"]) assert.ok(a.includes(s), `reply must have ${s}: ${a}`);
});

test("CR-05 a date in the question gets the rate of that date (7 Nov = ฿1,300 · 31 Oct = ฿1,200) [D:CR-05]", async () => {
  const nov = await ask(BEFORE, "สนาม A วันเสาร์ที่ 7 พ.ย. ราคาเท่าไร");
  assert.ok(nov.includes("฿1,300") && !nov.includes("฿1,200"), nov);
  const oct = await ask(BEFORE, "สนาม A วันเสาร์ที่ 31 ต.ค. ราคาเท่าไร");
  assert.ok(oct.includes("฿1,200") && !oct.includes("฿1,300"), oct);
  const day = await ask(BEFORE, "สนาม A วันอังคารที่ 3 พ.ย. ราคาเท่าไร");
  assert.ok(day.includes("฿800") && day.includes("฿1,300"), `3 Nov: ก่อน 17:00 ฿800 · ตั้งแต่ 17:00 ฿1,300: ${day}`);
});

test("CR-05 BR-30 price guard: a model that quotes the published future rate is not replaced; an invented price is", async () => {
  const honest = await runTurn({ system: BEFORE, history: [], userText: "ราคาสนาม A", tools: noTools, llm: async () => "ตั้งแต่ 1 พ.ย. สนาม A เย็นราคา ฿1,300 ต่อชั่วโมงครับ" });
  assert.ok(honest.reply.includes("฿1,300") && honest.reply.includes("1 พ.ย."), honest.reply);
  const lying = await runTurn({ system: BEFORE, history: [], userText: "ราคาสนาม A", tools: noTools, llm: async () => "ตั้งแต่ 1 พ.ย. สนาม A เย็นราคา ฿1,350 ต่อชั่วโมงครับ" });
  assert.ok(!lying.reply.includes("1,350"), lying.reply);
});

test("CR-05 after 1 Nov: ฿1,300 is simply the price — no \"from 1 Nov\" line, no ฿1,200 for A and B", async () => {
  const a = await ask(AFTER, "สนาม A ราคาเท่าไร");
  assert.ok(a.includes("฿1,300") && !a.includes("฿1,200") && !a.includes("ตั้งแต่ 1 พ.ย."), a);
});
