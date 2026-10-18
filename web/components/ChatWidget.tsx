"use client";

// FR-32 – FR-35 · ADR-17: floating chat "น้องบอล" on every customer page (not on shop pages or /project).
// Replies are plain text (never HTML). A booking is made only from the confirmation card after the customer ticks
// the PDPA box (not ticked by default) and presses the button (A-34).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BotAvatar } from "@/components/Art";
import { Money } from "@/components/ui";
import { api } from "@/lib/client";
import { fieldName, fmtDate, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Card = {
  type: "check" | "quote" | "confirm";
  fieldId: string;
  date: string;
  startHour: number;
  hours: number;
  ok?: boolean;
  available?: boolean;
  reason?: string;
  alternatives?: { fieldId: string; startHour: number }[];
  fieldPrice?: number;
  totalPrice?: number;
  paymentPlan?: string;
  payNow?: number;
  dueAtField?: number;
  name?: string;
  phone?: string;
  draftToken?: string;
};
type Item = { role: "USER" | "BOT"; text: string; cards?: Card[]; bookingCode?: string | null };

const HIDDEN = ["/staff", "/manager", "/owner", "/project"];
const MAX = 500;

function ConfirmCard({ lang, card, onBooked }: { lang: Lang; card: Card; onBooked: (code: string, text: string) => void }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string } | null>(null);
  const id = `chat-consent-${card.draftToken?.slice(-8)}`;
  const confirm = async () => {
    setBusy(true);
    setError(null);
    const r = await api<{ code: string; reply: string }>(lang, "/api/chat/book", { body: { draftToken: card.draftToken, consent } });
    setBusy(false);
    if (r.ok) {
      setDone({ code: r.data.code });
      onBooked(r.data.code, r.data.reply);
    } else setError(r.error.message);
  };
  return (
    <div className="chat-card" data-testid="chat-card-confirm">
      <b>{tx(lang, "ยืนยันการจอง", "Confirm booking")}</b>
      <dl>
        <dt>{tx(lang, "สนาม", "Field")}</dt>
        <dd data-testid="chat-card-field">{fieldName(lang, card.fieldId)}</dd>
        <dt>{tx(lang, "วันเวลา", "When")}</dt>
        <dd data-testid="chat-card-when" data-value={`${card.date} ${card.startHour}-${card.hours}`}>
          {fmtDate(lang, card.date)} {timeRange(card.startHour, card.hours)}
        </dd>
        <dt>{tx(lang, "ชื่อ", "Name")}</dt>
        <dd data-testid="chat-card-name">{card.name}</dd>
        <dt>{tx(lang, "เบอร์", "Phone")}</dt>
        <dd data-testid="chat-card-phone">{card.phone}</dd>
        <dt>{tx(lang, "ราคา", "Price")}</dt>
        <dd>
          <Money lang={lang} value={card.totalPrice ?? 0} testid="chat-card-total" />
        </dd>
        <dt>{tx(lang, "จ่ายตอนนี้", "Pay now")}</dt>
        <dd>
          <Money lang={lang} value={card.payNow ?? 0} testid="chat-card-pay-now" />{" "}
          <span className="small muted" data-testid="chat-card-plan" data-value={card.paymentPlan}>
            ({card.paymentPlan === "FULL_100" ? tx(lang, "จ่ายเต็ม", "full") : tx(lang, "มัดจำ 50%", "50% deposit")})
          </span>
        </dd>
      </dl>
      {done ? (
        <p style={{ margin: 0 }}>
          {tx(lang, "รหัสการจอง", "Booking code")} <b data-testid="chat-booking-code">{done.code}</b> ·{" "}
          <Link href={`/pay/${done.code}`} data-testid="chat-pay-link">
            {tx(lang, "ไปชำระเงิน (ภายใน 15 นาที)", "Pay now (within 15 minutes)")}
          </Link>
        </p>
      ) : (
        <>
          <label className="check" htmlFor={id}>
            <input id={id} type="checkbox" data-testid="chat-card-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{tx(lang, "ยินยอมให้ร้านเก็บชื่อและเบอร์โทรเพื่อการจองนี้ (PDPA)", "I consent to the shop keeping my name and phone number for this booking (PDPA)")}</span>
          </label>
          {error && (
            <p className="field-error" role="alert" data-testid="chat-card-error">
              {error}
            </p>
          )}
          <button type="button" className="btn small" data-testid="chat-card-confirm-button" disabled={!consent || busy} onClick={confirm}>
            {tx(lang, "ยืนยันการจอง", "Confirm booking")}
          </button>
        </>
      )}
    </div>
  );
}

function InfoCard({ lang, card }: { lang: Lang; card: Card }) {
  const when = `${fieldName(lang, card.fieldId)} · ${fmtDate(lang, card.date)} ${timeRange(card.startHour, card.hours)}`;
  if (card.type === "check") {
    return (
      <div className="chat-card" data-testid="chat-card-check" data-available={card.available ? "true" : "false"}>
        <b>{when}</b>
        <div>
          {card.available ? tx(lang, "ว่าง", "Available") : tx(lang, "ไม่ว่าง", "Not available")}
          {card.reason ? ` · ${card.reason}` : ""}
        </div>
        {!card.available && card.alternatives && card.alternatives.length > 0 && (
          <div className="small">
            {tx(lang, "รอบที่ยังว่าง", "Free slots")}: {card.alternatives.map((a) => `${a.fieldId} ${String(a.startHour).padStart(2, "0")}:00`).join(", ")}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="chat-card" data-testid="chat-card-quote" data-ok={card.ok ? "true" : "false"}>
      <b>{when}</b>
      {card.ok ? (
        <div>
          <Money lang={lang} value={card.totalPrice ?? 0} testid="chat-quote-total" /> ·{" "}
          {card.paymentPlan === "FULL_100" ? tx(lang, "จ่ายเต็ม", "pay in full") : tx(lang, "มัดจำ 50%", "50% deposit")} · {tx(lang, "จ่ายตอนนี้", "pay now")}{" "}
          <Money lang={lang} value={card.payNow ?? 0} testid="chat-quote-pay-now" />
          {card.available === false && card.reason ? <div className="small">{card.reason}</div> : null}
        </div>
      ) : (
        <div>{card.reason}</div>
      )}
    </div>
  );
}

export function ChatWidget({ lang }: { lang: Lang }) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    void (async () => {
      const r = await api<{ messages: { role: "USER" | "BOT"; text: string; bookingCode: string | null }[] }>(lang, "/api/chat");
      if (r.ok) setItems(r.data.messages.map((m) => ({ role: m.role, text: m.text, bookingCode: m.bookingCode })));
      setLoaded(true);
    })();
  }, [open, loaded, lang]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [items, waiting]);

  if (HIDDEN.some((p) => path === p || path.startsWith(p + "/"))) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || waiting) return;
    setError(null);
    setItems((x) => [...x, { role: "USER", text: t }]);
    setText("");
    setWaiting(true);
    const r = await api<{ reply: string; cards: Card[] }>(lang, "/api/chat", { body: { text: t } });
    setWaiting(false);
    if (r.ok) setItems((x) => [...x, { role: "BOT", text: r.data.reply, cards: r.data.cards }]);
    else setError(r.error.message);
  };

  const title = tx(lang, "น้องบอล ผู้ช่วยจองสนาม", "Nong Ball, booking assistant");
  return (
    <div className="chat-widget" data-testid="chat-widget" data-chat-state={waiting ? "waiting" : "idle"}>
      {open && (
        <section className="chat-panel" id="chat-panel" data-testid="chat-panel" aria-label={title}>
          <div className="chat-head">
            <BotAvatar size={30} title={tx(lang, "รูปน้องบอล", "Nong Ball")} />
            <h2>{tx(lang, "น้องบอล", "Nong Ball")}</h2>
            <button type="button" data-testid="chat-close" onClick={() => setOpen(false)} aria-label={tx(lang, "ปิดแชท", "Close chat")}>
              ✕
            </button>
          </div>
          <div className="chat-log" role="log" aria-live="polite" data-testid="chat-log" ref={logRef}>
            {items.length === 0 && (
              <div className="chat-msg bot" data-testid="chat-welcome">
                {tx(
                  lang,
                  "สวัสดีครับ น้องบอลตอบเวลาเปิด ราคา รอบว่าง และจองสนามให้ได้ครับ",
                  "Hello! I can tell you opening hours, prices and free slots, and book a field for you.",
                )}
              </div>
            )}
            {items.map((m, i) => (
              <div key={i} style={{ display: "contents" }}>
                <div className={`chat-msg ${m.role === "USER" ? "user" : "bot"}`} data-testid={m.role === "USER" ? "chat-msg-user" : "chat-msg-bot"}>
                  {m.text}
                </div>
                {m.cards?.map((c, k) =>
                  c.type === "confirm" ? (
                    <ConfirmCard
                      key={k}
                      lang={lang}
                      card={c}
                      onBooked={(code, reply) => setItems((x) => [...x, { role: "BOT", text: reply, bookingCode: code }])}
                    />
                  ) : (
                    <InfoCard key={k} lang={lang} card={c} />
                  ),
                )}
              </div>
            ))}
            {waiting && (
              <div className="chat-msg bot muted" data-testid="chat-typing">
                {tx(lang, "น้องบอลกำลังพิมพ์…", "Nong Ball is typing…")}
              </div>
            )}
          </div>
          {error && (
            <p className="field-error" role="alert" data-testid="chat-error" style={{ margin: "0 12px" }}>
              {error}
            </p>
          )}
          <form className="chat-form" onSubmit={send}>
            <label htmlFor="chat-input" className="sr-only">
              {tx(lang, "พิมพ์ข้อความถึงน้องบอล", "Message to Nong Ball")}
            </label>
            <input
              id="chat-input"
              data-testid="chat-input"
              value={text}
              maxLength={MAX}
              onChange={(e) => setText(e.target.value)}
              placeholder={tx(lang, "ถามรอบว่าง ราคา หรือจองสนาม", "Ask about free slots, prices or booking")}
              autoComplete="off"
            />
            <button type="submit" className="btn small" data-testid="chat-send" disabled={waiting || !text.trim()}>
              {tx(lang, "ส่ง", "Send")}
            </button>
          </form>
          <div className="chat-note" data-testid="chat-count" data-value={[...text].length}>
            {[...text].length}/{MAX} · {tx(lang, "แชทบอทไม่ยกเลิกหรือเลื่อนการจอง", "The chatbot cannot cancel or reschedule")}
          </div>
        </section>
      )}
      <button
        type="button"
        className="chat-fab"
        data-testid="chat-open"
        aria-expanded={open}
        aria-controls="chat-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <BotAvatar size={30} title="" />
        <span>{open ? tx(lang, "ปิดแชท", "Close chat") : tx(lang, "แชทกับน้องบอล", "Chat with Nong Ball")}</span>
      </button>
    </div>
  );
}
