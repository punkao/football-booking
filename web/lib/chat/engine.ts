// One chat turn of "น้องบอล" (07-SAD 9.1 · ADR-15 / ADR-16 / ADR-17). Pure orchestration: the model (`llm`) and the
// tools are passed in, so MODE=mock, MODE=ai and the unit tests all go through this same path.
//   model reply → first valid tag → the SAME function as the web (tools) → [RESULT] back to the model (≤ 2 rounds)
//   → <think> and tags removed → every ฿ amount checked against the functions' numbers (BR-30) → reply + cards
import { neutralizeUserText, parseBotReply, priceGuardOk, validateTag, SHOP_CONTACT } from "../rules/chat.ts";
import type { BookArgs, ToolArgs } from "../rules/chat.ts";
import { factsFromPrompt } from "./prompt.ts";
import { describeResult, detectLang } from "./templates.ts";

export type { BookArgs, ToolArgs };
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

type Base = ToolArgs & { reasonCode?: string; reason?: string };
export type CheckResult = Base & { tag: "CHECK"; ok: boolean; available: boolean; fieldPrice?: number; alternatives?: { fieldId: string; startHour: number }[] };
export type QuoteResult = Base & {
  tag: "QUOTE";
  ok: boolean;
  /** false = the price is right but the slot is taken / closed right now (reason says why) */
  available?: boolean;
  fieldPrice?: number;
  totalPrice?: number;
  paymentPlan?: "DEPOSIT_50" | "FULL_100";
  payNow?: number;
  dueAtField?: number;
};
export type BookResult = Omit<QuoteResult, "tag"> & { tag: "BOOK"; name: string; phone: string; draftToken?: string };
export type ToolResult = CheckResult | QuoteResult | BookResult;

export type Tools = {
  check(a: ToolArgs): Promise<CheckResult>;
  quote(a: ToolArgs): Promise<QuoteResult>;
  book(a: BookArgs): Promise<BookResult>;
};

export type Card = { type: "check" | "quote" | "confirm" } & Record<string, unknown>;

export const MAX_TOOL_ROUNDS = 2;

export function apology(lang: "th" | "en"): string {
  return lang === "en"
    ? `Sorry, Nong Ball can't answer right now. Please call ${SHOP_CONTACT.phone} or LINE ${SHOP_CONTACT.line}.`
    : `ขออภัยครับ ตอนนี้น้องบอลตอบไม่ได้ชั่วคราว กรุณาโทร ${SHOP_CONTACT.phone} หรือ LINE ${SHOP_CONTACT.line} ครับ`;
}

/** R7: only the money fields of a result are prices (a start hour 18 or 1 hour is not ฿18 / ฿1) */
const MONEY_FIELDS = ["fieldPrice", "totalPrice", "payNow", "dueAtField"] as const;
function moneyOf(r: ToolResult): number[] {
  const o = r as Record<string, unknown>;
  return MONEY_FIELDS.map((k) => o[k]).filter((v): v is number => typeof v === "number");
}

/** R8: Thai answers end with "ครับ" — looked for before trailing punctuation, emoji and links, never added twice */
export function withKrub(text: string): string {
  const core = text.replace(/(?:\s*(?:https?:\/\/\S+|[^\p{L}\p{M}\p{N}\s]+))+\s*$/u, "").trimEnd();
  return /ครับ$/.test(core) ? text : text.replace(/[\s.]+$/, "") + " ครับ";
}

export async function runTurn(input: {
  system: string;
  history: ChatMsg[];
  userText: string;
  llm: (messages: ChatMsg[]) => Promise<string>;
  tools: Tools;
}): Promise<{ reply: string; cards: Card[]; failed?: boolean; results: ToolResult[] }> {
  const lang = detectLang(input.userText);
  const facts = factsFromPrompt(input.system);
  const allowed = new Set<number>();
  for (const f of facts?.fields ?? []) allowed.add(f.dayRate).add(f.eveningRate);
  for (const r of facts?.rentals ?? []) allowed.add(r.price);
  const messages: ChatMsg[] = [{ role: "system", content: input.system }, ...input.history, { role: "user", content: neutralizeUserText(input.userText) }];
  const cards: Card[] = [];
  const results: ToolResult[] = [];
  let text = "";
  for (let round = 0; ; round++) {
    let raw: string;
    try {
      raw = await input.llm(messages);
    } catch {
      return { reply: apology(lang), cards, failed: true, results };
    }
    const parsed = parseBotReply(raw);
    const tag = round < MAX_TOOL_ROUNDS ? validateTag(parsed.tag) : null;
    if (!tag) {
      text = parsed.text;
      break;
    }
    let result: ToolResult;
    if (tag.name === "CHECK") result = await input.tools.check(tag.args as ToolArgs);
    else if (tag.name === "QUOTE") result = await input.tools.quote(tag.args as ToolArgs);
    else result = await input.tools.book(tag.args as BookArgs);
    results.push(result);
    for (const n of moneyOf(result)) allowed.add(n);
    if (result.tag === "BOOK") {
      if (result.ok && result.draftToken) cards.push({ ...result, type: "confirm" });
    } else cards.push({ ...result, type: result.tag === "CHECK" ? "check" : "quote" });
    messages.push({ role: "assistant", content: raw }, { role: "user", content: "[RESULT]" + JSON.stringify(result) });
  }
  const last = results[results.length - 1];
  // BR-30: a reply with an amount the functions did not produce is replaced by the template of the real result
  if (!text || !priceGuardOk(text, [...allowed])) text = last ? describeResult(last, lang) : apology(lang);
  if (lang === "th") text = withKrub(text);
  return { reply: text, cards, results };
}
