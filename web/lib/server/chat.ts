// Chatbot "น้องบอล" on the server (FR-32 – FR-36 · BR-29 – BR-32 · NFR-15 – NFR-17 · ADR-15 – ADR-17 · T-13).
// The tools call evaluateBooking / createBooking — the very functions behind /api/quote and /api/bookings (BR-30).
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  CHAT_HISTORY_TO_MODEL,
  LLM_TIMEOUT_MS_DEFAULT,
  addDays,
  chatIpLimitOk,
  chatRateOk,
  checkChatText,
  computePrice,
  fieldPriceFor,
  neutralizeUserText,
  paymentPlanFor,
  normalizePhone,
  todayOf,
} from "@/lib/rules";
import { msg } from "@/lib/i18n";
import { runTurn } from "@/lib/chat/engine";
import type { BookArgs, BookResult, ChatMsg, CheckResult, QuoteResult, ToolArgs, Tools } from "@/lib/chat/engine";
import { mockBrain } from "@/lib/chat/mock";
import { buildSystemPrompt, factsFrom } from "@/lib/chat/prompt";
import { detectLang } from "@/lib/chat/templates";
import { AppError, customerIdFrom, cookieOpts, fail, localizeParams } from "./core";
import type { Ctx } from "./core";
import { q } from "./db";
import { holidayDates, loadCustomerByPhone, loadFields, loadRentalItems } from "./data";
import { createBooking, evaluateBooking } from "./bookings";
import { availability } from "./features";
import { withAccess } from "./access";
import { ipRef, readDraft, signDraft } from "./crypto";
import { redactOldChats } from "./backoffice";

export const CHAT_COOKIE = "ln_chat";
const DRAFT_MINUTES = 15;

// ---------- draftToken (ADR-17 · R9): the same signed format as the cookies, kind "draft", bound to the room, 15 minutes
type Draft = { sid: string; a: BookArgs; exp: number };

// ---------- the model (ADR-16) ----------
async function callModel(messages: ChatMsg[]): Promise<string> {
  if (process.env.MODE !== "ai") return mockBrain(messages);
  const base = (process.env.LLM_BASE_URL || "").replace(/\/+$/, "");
  const timeout = Number(process.env.LLM_TIMEOUT_MS) || LLM_TIMEOUT_MS_DEFAULT;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY ?? ""}` },
    body: JSON.stringify({ model: process.env.LLM_MODEL || "claude", messages, temperature: 0 }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = j.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM reply without content");
  return content;
}

// ---------- tools = the web's functions ----------
function reasonFrom(e: unknown, lang: "th" | "en") {
  if (e instanceof AppError) return { reasonCode: e.code, reason: msg(lang, e.code, localizeParams(lang, e.params)) };
  throw e;
}

function toolsFor(ctx: Ctx, lang: "th" | "en", sid: string): Tools {
  const c = { ...ctx, lang };
  const evaluate = (a: ToolArgs, customer: Awaited<ReturnType<typeof loadCustomerByPhone>> = null) =>
    evaluateBooking(null, c, { fieldId: a.fieldId, date: a.date, startHour: a.startHour, hours: a.hours, rentals: [] }, customer, false);
  return {
    async check(a): Promise<CheckResult> {
      try {
        const ev = await evaluate(a);
        return { tag: "CHECK", ok: true, available: true, ...a, fieldPrice: ev.fieldPrice };
      } catch (e) {
        const r = reasonFrom(e, lang);
        // other free slots: other fields at the same hour, then the nearest free hours of this field
        const av = await availability(c, a.date);
        const free = av.slots.filter((s) => s.status === "free");
        const alternatives = [
          ...free.filter((s) => s.hour === a.startHour && s.fieldId !== a.fieldId),
          ...free.filter((s) => s.fieldId === a.fieldId).sort((x, y) => Math.abs(x.hour - a.startHour) - Math.abs(y.hour - a.startHour)).slice(0, 2),
        ].map((s) => ({ fieldId: s.fieldId, startHour: s.hour }));
        return { tag: "CHECK", ok: true, available: false, ...a, ...r, alternatives };
      }
    },
    async quote(a): Promise<QuoteResult> {
      try {
        const ev = await evaluate(a);
        return { tag: "QUOTE", ok: true, available: true, ...a, fieldPrice: ev.fieldPrice, totalPrice: ev.totalPrice, paymentPlan: ev.paymentPlan, payNow: ev.payNow, dueAtField: ev.dueAtField };
      } catch (e) {
        const r = reasonFrom(e, lang);
        // a price question about a taken / closed slot: the price still comes from the same rule functions (BR-07 – BR-12)
        if (r.reasonCode === "SLOT_TAKEN" || r.reasonCode === "FIELD_CLOSED") {
          const field = (await loadFields(null)).find((f) => f.id === a.fieldId)!;
          const fieldPrice = fieldPriceFor(field, a.date, a.startHour, a.hours, await holidayDates(null));
          const p = computePrice({ fieldPrice, paymentPlan: paymentPlanFor(a.date, a.startHour) });
          return { tag: "QUOTE", ok: true, available: false, ...a, ...r, fieldPrice, totalPrice: p.totalPrice, paymentPlan: p.paymentPlan, payNow: p.payNow, dueAtField: p.dueAtField };
        }
        return { tag: "QUOTE", ok: false, ...a, ...r };
      }
    },
    async book(a): Promise<BookResult> {
      try {
        const phone = normalizePhone(a.phone);
        const existing = await loadCustomerByPhone(null, phone);
        const ev = await evaluate(a, existing); // BR-16: a suspended phone can't book here either
        const draftToken = signDraft<Draft>({ sid, a: { ...a, phone }, exp: ctx.now.getTime() + DRAFT_MINUTES * 60_000 });
        return {
          tag: "BOOK", ok: true, ...a, phone, fieldPrice: ev.fieldPrice, totalPrice: ev.totalPrice, paymentPlan: ev.paymentPlan, payNow: ev.payNow,
          dueAtField: ev.dueAtField, draftToken,
        };
      } catch (e) {
        return { tag: "BOOK", ok: false, ...a, ...reasonFrom(e, lang) };
      }
    },
  };
}

async function systemPrompt(ctx: Ctx): Promise<string> {
  const today = todayOf(ctx.now);
  const fields = await loadFields(null);
  const holidays = (await holidayDates(null)).filter((d) => d >= today && d <= addDays(today, 14));
  const closures = await q<{ field_id: string; date: string; from_hour: number; to_hour: number }>(
    "SELECT field_id, date, from_hour, to_hour FROM field_closures WHERE date BETWEEN $1 AND $2 ORDER BY date, field_id",
    [today, addDays(today, 14)],
  );
  const rentals = (await loadRentalItems(null)).map((r) => ({ id: r.id, price: r.price }));
  return buildSystemPrompt(
    factsFrom({
      now: ctx.now,
      fields,
      holidays,
      closures: closures.map((c) => ({ fieldId: c.field_id, date: c.date, fromHour: c.from_hour, toHour: c.to_hour })),
      rentals,
    }),
  );
}

/** R2: first address of X-Forwarded-For (Next fills it with the socket address when the client sends none) */
function clientIp(ctx: Ctx): string {
  return (ctx.req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

function cookieSession(ctx: Ctx): string | null {
  const v = ctx.req.cookies.get(CHAT_COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

async function sessionRow(id: string | null) {
  if (!id) return null;
  return (await q<{ id: string; lang: string }>("SELECT id, lang FROM chat_sessions WHERE id = $1", [id]))[0] ?? null;
}

function withChatCookie(res: NextResponse, sid: string): NextResponse {
  res.cookies.set(CHAT_COOKIE, sid, { ...cookieOpts, maxAge: 60 * 60 * 24 * 90 });
  return res;
}

/** POST /api/chat {text, lang?} → {sessionId, reply, cards} (always HTTP 200 when the AI fails · NFR-16) */
export async function chatSend(ctx: Ctx, b: Record<string, unknown>) {
  fail(checkChatText(b.text));
  const text = String(b.text).trim();
  const lang = detectLang(text);
  await redactOldChats(ctx.now);
  let session = await sessionRow(cookieSession(ctx));
  // R2: limits per client IP too (a client that drops its cookie gets a new room each time) — all by the app clock
  const ipHash = ipRef(clientIp(ctx));
  const limits = (
    await q<{ rooms: number; msgs: number }>(
      `SELECT (SELECT count(*)::int FROM chat_sessions WHERE ip_hash = $1 AND created_at > $2) AS rooms,
              (SELECT count(*)::int FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
                WHERE s.ip_hash = $1 AND m.role = 'USER' AND m.created_at > $3) AS msgs`,
      [ipHash, new Date(ctx.now.getTime() - 3600_000), new Date(ctx.now.getTime() - 60_000)],
    )
  )[0];
  if (!chatIpLimitOk({ roomsLastHour: limits.rooms, messagesLastMinute: limits.msgs, newRoom: !session })) throw new AppError("CHAT_RATE_LIMIT");
  if (session) {
    // NFR-17: 20 customer messages per minute per room
    const recent = await q<{ created_at: Date }>(
      "SELECT created_at FROM chat_messages WHERE session_id = $1 AND role = 'USER' AND created_at > $2",
      [session.id, new Date(ctx.now.getTime() - 60_000)],
    );
    if (!chatRateOk(recent.map((r) => new Date(r.created_at)), ctx.now)) throw new AppError("CHAT_RATE_LIMIT");
  } else {
    // the room row is created only after every check passed
    const id = randomUUID();
    const customerId = customerIdFrom((n) => ctx.req.cookies.get(n)?.value);
    await q("INSERT INTO chat_sessions(id, lang, customer_id, created_at, last_message_at, ip_hash) VALUES ($1, $2, $3, $4, $4, $5)", [
      id, lang, customerId, ctx.now, ipHash,
    ]);
    session = { id, lang };
  }
  const history = await q<{ role: string; text: string }>(
    "SELECT role, text FROM (SELECT id, role, text FROM chat_messages WHERE session_id = $1 ORDER BY id DESC LIMIT $2) x ORDER BY id",
    [session.id, CHAT_HISTORY_TO_MODEL],
  );
  const stored = neutralizeUserText(text);
  await q("INSERT INTO chat_messages(session_id, role, text, created_at) VALUES ($1, 'USER', $2, $3)", [session.id, stored, ctx.now]);
  let out;
  try {
    out = await runTurn({
      system: await systemPrompt(ctx),
      history: history.map((h) => ({ role: h.role === "USER" ? "user" : "assistant", content: h.text })),
      userText: text,
      llm: callModel,
      tools: toolsFor(ctx, lang, session.id),
    });
  } catch (e) {
    console.error("[chat] turn failed:", (e as Error).message);
    throw e;
  }
  if (out.failed) console.error("[chat] AI did not answer (timeout or error) — apology sent");
  await q("INSERT INTO chat_messages(session_id, role, text, created_at) VALUES ($1, 'BOT', $2, $3)", [session.id, out.reply, ctx.now]);
  await q("UPDATE chat_sessions SET last_message_at = $2 WHERE id = $1", [session.id, ctx.now]);
  const res = NextResponse.json({ sessionId: session.id, reply: out.reply, cards: out.cards, failed: !!out.failed });
  return withChatCookie(res, session.id);
}

/** GET /api/chat (this browser's room) and GET /api/chat/{sessionId} (only the cookie's own room) */
export async function chatHistory(ctx: Ctx, sessionId?: string) {
  const own = cookieSession(ctx);
  if (sessionId !== undefined && sessionId !== own) throw new AppError("CHAT_SESSION_NOT_FOUND");
  const session = await sessionRow(own);
  if (!session) {
    if (sessionId !== undefined) throw new AppError("CHAT_SESSION_NOT_FOUND");
    return { sessionId: null, messages: [] };
  }
  await redactOldChats(ctx.now);
  const rows = await q<{ role: string; text: string; booking_code: string | null; created_at: Date }>(
    "SELECT role, text, booking_code, created_at FROM chat_messages WHERE session_id = $1 ORDER BY id",
    [session.id],
  );
  return { sessionId: session.id, messages: rows.map((r) => ({ role: r.role, text: r.text, bookingCode: r.booking_code, createdAt: r.created_at })) };
}

/** POST /api/chat/book {sessionId?, draftToken, consent:true} → the booking, made by createBooking with actor BOT (ADR-17) */
export async function chatBook(ctx: Ctx, b: Record<string, unknown>) {
  const own = cookieSession(ctx);
  if (!own || (b.sessionId !== undefined && b.sessionId !== own)) throw new AppError("CHAT_SESSION_NOT_FOUND");
  if (b.consent !== true) throw new AppError("CONSENT_REQUIRED");
  const d = readDraft<Draft>(b.draftToken);
  if (!d || d.sid !== own) throw new AppError("CHAT_DRAFT_INVALID");
  if (ctx.now.getTime() > d.exp) throw new AppError("CHAT_DRAFT_EXPIRED");
  const session = await sessionRow(own);
  if (!session) throw new AppError("CHAT_SESSION_NOT_FOUND");
  const lang = session.lang === "en" ? "en" : "th";
  const created = await createBooking(
    { ...ctx, lang },
    { fieldId: d.a.fieldId, date: d.a.date, startHour: d.a.startHour, hours: d.a.hours, name: d.a.name, phone: d.a.phone, consent: true },
    "BOT",
  );
  const bk = created.booking;
  const reply = msg(lang, "OK_CHAT_BOOKED", { code: bk.code });
  await q("INSERT INTO chat_messages(session_id, role, text, booking_code, created_at) VALUES ($1, 'BOT', $2, $3, $4)", [own, reply, bk.code, ctx.now]);
  await q("UPDATE chat_sessions SET last_message_at = $2 WHERE id = $1", [own, ctx.now]);
  const res = NextResponse.json(
    { ok: true, code: bk.code, status: bk.status, payNow: bk.payNow, payUrl: `/pay/${bk.code}`, payDeadline: bk.payDeadline, reply, message: reply },
    { status: 201 },
  );
  return withAccess(res, ctx, [bk.code]);
}

