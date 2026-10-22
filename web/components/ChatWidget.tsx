"use client";

// FR-32 – FR-35 · ADR-17: floating chat "น้องบอล" on every customer page (not on shop pages or /project).
// Replies are plain text (never HTML). A booking is made only from the confirmation card after the customer ticks
// the PDPA box (not ticked by default) and presses the button (A-34).
// UI redesign S2 (docs/UI-REDESIGN.md §4.1): side panel (desktop) / full screen (mobile), "bot" badge, quick-question chips,
// price/confirm cards drawn as the booking "ticket". Chips send plain text through the same submit() as the input box.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BotAvatar } from "@/components/Art";
import { Money } from "@/components/ui";
import { api } from "@/lib/client";
import { fieldName, fmtDate, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Card = {
  type: "check" | "quote" | "confirm" | "day";
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
  /** type "day": the free start hours of every field on `date` (evening = evening rate) */
  fields?: { fieldId: string; free: { hour: number; evening: boolean }[] }[];
};
type Item = { role: "USER" | "BOT"; text: string; cards?: Card[]; bookingCode?: string | null };

const HIDDEN = ["/staff", "/manager", "/owner", "/project"];
const MAX = 500;

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M4 4l8 8M12 4L4 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** quick questions: the chip shows `th/en` + a one-line hint, and sends `askTh/askEn` as an ordinary message */
const QUICK = [
  { id: "price", th: "ราคา", en: "Prices", dTh: "ราคาแต่ละสนาม", dEn: "Price of each field", askTh: "ราคาสนามเท่าไร", askEn: "How much is a field?" },
  { id: "avail", th: "รอบว่างวันนี้", en: "Free slots today", dTh: "ดูเวลาที่ยังจองได้", dEn: "Times you can still book", askTh: "วันนี้มีรอบว่างไหม", askEn: "Any free slots today?" },
  { id: "book", th: "จองสนาม", en: "Book a field", dTh: "ให้น้องบอลช่วยจอง", dEn: "Let Nong Ball help", askTh: "อยากจองสนาม", askEn: "I want to book a field" },
  { id: "hours", th: "เวลาเปิด", en: "Opening hours", dTh: "เปิด-ปิดกี่โมง", dEn: "When we open and close", askTh: "เปิดกี่โมง", askEn: "What time do you open?" },
] as const;

function Capabilities({ lang }: { lang: Lang }) {
  return (
    <div className="chat-caps">
      <div className="yes">
        <h3>{tx(lang, "น้องบอลทำได้", "Nong Ball can")}</h3>
        <ul>
          <li><IconCheck />{tx(lang, "บอกราคาและเวลาเปิด", "Tell you prices and opening hours")}</li>
          <li><IconCheck />{tx(lang, "ตรวจรอบว่างตามวันและเวลา", "Check free slots by day and time")}</li>
          <li><IconCheck />{tx(lang, "จองสนามพื้นฐาน (ไม่รวมของเช่าและเครดิต)", "Book a field (no rentals or credit)")}</li>
        </ul>
      </div>
      <div className="no">
        <h3>{tx(lang, "น้องบอลทำไม่ได้", "Nong Ball can't")}</h3>
        <ul>
          <li><IconX />{tx(lang, "ยกเลิกหรือเลื่อนการจอง (ทำเองที่หน้าการจองของฉัน)", "Cancel or move a booking (do it yourself on your booking page)")}</li>
          <li><IconX />{tx(lang, "คืนเงินหรือลดราคา", "Refund or discount")}</li>
          <li><IconX />{tx(lang, "ใช้เครดิตหรือจองประจำ ต้องทำที่หน้าเว็บ", "Use credit or recurring bookings (use the website)")}</li>
        </ul>
      </div>
    </div>
  );
}

/** the "pay now | pay at the field" stub of the ticket (CSS .perf + .stub from the design system) */
function Stub({ lang, plan, payNow, due, nowTestid, planTestid }: { lang: Lang; plan?: string; payNow: number; due: number; nowTestid: string; planTestid?: string }) {
  const planText = plan === "FULL_100" ? tx(lang, "จ่ายเต็ม", "full") : tx(lang, "มัดจำ 50%", "50% deposit");
  return (
    <>
      <div className="perf" aria-hidden="true" />
      <div className="stub">
        <div className="now">
          <span className="k">
            {tx(lang, "จ่ายตอนนี้", "Pay now")}{" "}
            <span data-testid={planTestid} data-value={planTestid ? plan : undefined}>
              ({planText})
            </span>
          </span>
          <span className="v">
            <Money lang={lang} value={payNow} testid={nowTestid} />
          </span>
        </div>
        <div className="later">
          <span className="k">{tx(lang, "จ่ายหน้าสนาม", "Pay at the field")}</span>
          <span className="v">
            <Money lang={lang} value={due} />
          </span>
        </div>
      </div>
    </>
  );
}

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
  const total = card.totalPrice ?? 0;
  const payNow = card.payNow ?? 0;
  return (
    <div className="chat-card" data-testid="chat-card-confirm">
      <div className="ticket">
        <div className="ticket-head">
          <div className="where">{tx(lang, "ยืนยันการจอง", "Confirm booking")}</div>
        </div>
        <dl className="rows">
          <div>
            <dt>{tx(lang, "สนาม", "Field")}</dt>
            <dd data-testid="chat-card-field">{fieldName(lang, card.fieldId)}</dd>
          </div>
          <div>
            <dt>{tx(lang, "วันเวลา", "When")}</dt>
            <dd data-testid="chat-card-when" data-value={`${card.date} ${card.startHour}-${card.hours}`}>
              {fmtDate(lang, card.date)} {timeRange(card.startHour, card.hours)}
            </dd>
          </div>
          <div>
            <dt>{tx(lang, "ชื่อ", "Name")}</dt>
            <dd data-testid="chat-card-name">{card.name}</dd>
          </div>
          <div>
            <dt>{tx(lang, "เบอร์", "Phone")}</dt>
            <dd data-testid="chat-card-phone">{card.phone}</dd>
          </div>
          <div className="sum">
            <dt>{tx(lang, "ราคารวม", "Total")}</dt>
            <dd>
              <Money lang={lang} value={total} testid="chat-card-total" />
            </dd>
          </div>
        </dl>
        <Stub lang={lang} plan={card.paymentPlan} payNow={payNow} due={card.dueAtField ?? Math.max(0, total - payNow)} nowTestid="chat-card-pay-now" planTestid="chat-card-plan" />
      </div>
      {done ? (
        <div className="chat-done">
          <p>
            {tx(lang, "รหัสการจอง", "Booking code")} <b className="chat-code" data-testid="chat-booking-code">{done.code}</b>
          </p>
          <Link href={`/pay/${done.code}`} className="btn block" data-testid="chat-pay-link">
            {tx(lang, "ไปชำระเงิน (ภายใน 15 นาที)", "Pay now (within 15 minutes)")}
          </Link>
        </div>
      ) : (
        <div className="chat-actions">
          <label className="check" htmlFor={id}>
            <input id={id} type="checkbox" data-testid="chat-card-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{tx(lang, "ยินยอมให้ร้านเก็บชื่อและเบอร์โทรเพื่อการจองนี้ (PDPA)", "I consent to the shop keeping my name and phone number for this booking (PDPA)")}</span>
          </label>
          {error && (
            <p className="field-error" role="alert" data-testid="chat-card-error">
              {error}
            </p>
          )}
          <button type="button" className="btn block" data-testid="chat-card-confirm-button" disabled={!consent || busy} onClick={confirm}>
            {tx(lang, "ยืนยันการจอง", "Confirm booking")}
          </button>
          <p className="chat-fine">
            {tx(lang, "ยังไม่มีการตัดเงิน ถ้าไม่จ่ายภายใน 15 นาที รอบนี้จะถูกปล่อยว่าง", "Nothing is charged yet. If you do not pay within 15 minutes the slot is released.")}
          </p>
        </div>
      )}
    </div>
  );
}

/** S2b: "รอบว่างวันนี้" — each field's free start hours as links into the booking form; evening-rate hours are a separate, labelled group */
function DayCard({ lang, card }: { lang: Lang; card: Card }) {
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const fields = card.fields ?? [];
  const none = fields.every((f) => f.free.length === 0);
  return (
    <div className="chat-card chat-day" data-testid="chat-card-day" data-date={card.date}>
      <div className="chat-day-head">
        <b>{tx(lang, "รอบที่ยังว่าง", "Free slots")} · {fmtDate(lang, card.date)}</b>
        <Link href={`/book?date=${card.date}`} data-testid="chat-day-all">
          {tx(lang, "ดูตารางทั้งหมด", "See the full table")}
        </Link>
      </div>
      {none && <p className="chat-reason">{tx(lang, "ไม่มีรอบว่างแล้ว ลองเลือกวันอื่นในตารางว่าง", "No free slots left. Try another day on the availability page.")}</p>}
      {fields.map((f) => {
        const normal = f.free.filter((s) => !s.evening);
        const evening = f.free.filter((s) => s.evening);
        const group = (label: string, list: typeof f.free, cls: string) =>
          list.length > 0 && (
            <div className={`chat-day-group ${cls}`}>
              <span className="chat-day-k">{label}</span>
              <div className="chat-day-hours">
                {list.map((s) => (
                  <Link key={s.hour} className="chat-hour" data-testid={`chat-day-slot-${f.fieldId}-${s.hour}`} href={`/book/new?field=${f.fieldId}&date=${card.date}&start=${s.hour}`}>
                    {hh(s.hour)}
                  </Link>
                ))}
              </div>
            </div>
          );
        return (
          <div key={f.fieldId} className="chat-day-field" data-testid={`chat-day-field-${f.fieldId}`}>
            <div className="chat-day-name">
              {fieldName(lang, f.fieldId)}
              {f.free.length === 0 && <span className="tag plain">{tx(lang, "เต็มแล้ว", "Full")}</span>}
            </div>
            {group(tx(lang, "ก่อน 17:00", "Before 17:00"), normal, "")}
            {group(tx(lang, "ราคาเย็น", "Evening rate"), evening, "evening")}
          </div>
        );
      })}
    </div>
  );
}

function InfoCard({ lang, card }: { lang: Lang; card: Card }) {
  if (card.type === "day") return <DayCard lang={lang} card={card} />;
  const head = (
    <>
      <div className="where">{fieldName(lang, card.fieldId)}</div>
      <div className="when">
        {fmtDate(lang, card.date)} {timeRange(card.startHour, card.hours)}
      </div>
    </>
  );
  if (card.type === "check") {
    return (
      <div className="chat-card" data-testid="chat-card-check" data-available={card.available ? "true" : "false"}>
        <div className="ticket">
          <div className="ticket-head">
            {head}
            <span className={`tag chat-avail${card.available ? "" : " bad"}`}>{card.available ? tx(lang, "ว่าง", "Available") : tx(lang, "ไม่ว่าง", "Not available")}</span>
            {card.reason ? <p className="chat-reason">{card.reason}</p> : null}
            {!card.available && card.alternatives && card.alternatives.length > 0 && (
              <p className="chat-reason">
                {tx(lang, "รอบที่ยังว่าง", "Free slots")}: {card.alternatives.map((a) => `${a.fieldId} ${String(a.startHour).padStart(2, "0")}:00`).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
  const total = card.totalPrice ?? 0;
  const payNow = card.payNow ?? 0;
  return (
    <div className="chat-card" data-testid="chat-card-quote" data-ok={card.ok ? "true" : "false"}>
      <div className="ticket">
        <div className="ticket-head">
          {head}
          {card.ok && card.available !== undefined && (
            <span className={`tag chat-avail${card.available ? "" : " bad"}`}>{card.available ? tx(lang, "รอบนี้ว่าง", "Slot is free") : tx(lang, "ไม่ว่าง", "Not available")}</span>
          )}
          {(!card.ok || card.available === false) && card.reason ? <p className="chat-reason">{card.reason}</p> : null}
        </div>
        {card.ok && (
          <>
            <dl className="rows">
              <div className="sum">
                <dt>{tx(lang, "ราคารวม", "Total")}</dt>
                <dd>
                  <Money lang={lang} value={total} testid="chat-quote-total" />
                </dd>
              </div>
            </dl>
            <Stub lang={lang} plan={card.paymentPlan} payNow={payNow} due={card.dueAtField ?? Math.max(0, total - payNow)} nowTestid="chat-quote-pay-now" />
          </>
        )}
      </div>
    </div>
  );
}

// open/closed state is shared by the launcher in the site header (ChatLauncher) and the panel (ChatWidget)
let chatOpen = false;
const chatSubs = new Set<() => void>();
const subscribeChat = (f: () => void) => {
  chatSubs.add(f);
  return () => void chatSubs.delete(f);
};
function setChatOpen(v: boolean) {
  if (v === chatOpen) return;
  chatOpen = v;
  chatSubs.forEach((f) => f());
}
const useChatOpen = () =>
  useSyncExternalStore(
    subscribeChat,
    () => chatOpen,
    () => false,
  );
const isHidden = (path: string) => HIDDEN.some((p) => path === p || path.startsWith(p + "/"));

/** the "chat with Nong Ball" button in the sticky site header (docs/UI-REDESIGN.md §4.1, S2b): always visible, never over content */
export function ChatLauncher({ lang }: { lang: Lang }) {
  const path = usePathname() ?? "/";
  const open = useChatOpen();
  if (isHidden(path)) return null;
  const closeText = tx(lang, "ปิดแชท", "Close chat");
  return (
    <button type="button" className="chat-launch" data-testid="chat-open" aria-expanded={open} aria-controls="chat-panel" onClick={() => setChatOpen(!chatOpen)}>
      {open ? (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <BotAvatar size={28} title="" />
      )}
      <span className="cl-long">{open ? closeText : tx(lang, "แชทกับน้องบอล", "Chat with Nong Ball")}</span>
      <span className="cl-short">{open ? closeText : tx(lang, "น้องบอล", "Nong Ball")}</span>
    </button>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function ChatWidget({ lang }: { lang: Lang }) {
  const path = usePathname() ?? "/";
  const hidden = isHidden(path);
  const open = useChatOpen();
  const setOpen = setChatOpen;
  const [narrow, setNarrow] = useState(false); // < 768px: full-screen dialog
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const navClosed = useRef(false);
  const shown = open && !hidden;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    void (async () => {
      const r = await api<{ messages: { role: "USER" | "BOT"; text: string; bookingCode: string | null }[] }>(lang, "/api/chat");
      // a quick chip may be pressed before the history arrives: never overwrite messages already on screen
      if (r.ok) setItems((x) => (x.length ? x : r.data.messages.map((m) => ({ role: m.role, text: m.text, bookingCode: m.bookingCode }))));
      setLoaded(true);
    })();
  }, [open, loaded, lang]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTo({ top: log.scrollHeight });
    // a long answer (a card with many rows): show it from its first line, not from its end
    const last = log.querySelectorAll<HTMLElement>('[data-testid="chat-msg-bot"]');
    const el = !waiting && items[items.length - 1]?.role === "BOT" ? last[last.length - 1] : null;
    if (el) {
      const top = el.getBoundingClientRect().top - log.getBoundingClientRect().top;
      if (top < 0) log.scrollTo({ top: log.scrollTop + top - 8 });
    }
  }, [items, waiting]);

  // while the panel is open: tell the page (html[data-chat="open"] moves the content left on wide screens) and
  // keep the panel just below the sticky site header
  useEffect(() => {
    if (!shown) return;
    const root = document.documentElement;
    root.dataset.chat = "open";
    const header = document.querySelector<HTMLElement>(".site-header");
    const place = () => widgetRef.current?.style.setProperty("--chat-top", `${header?.offsetHeight ?? 64}px`);
    place();
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      delete root.dataset.chat;
    };
  }, [shown]);

  // Esc closes the panel from anywhere inside it or from the header button
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const a = document.activeElement;
      if (panelRef.current?.contains(a) || (a instanceof HTMLElement && a.dataset.testid === "chat-open")) {
        e.preventDefault();
        setChatOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shown]);

  // focus: into the panel when it opens (the input on desktop; the dialog itself on a phone so the keyboard does not pop up),
  // back to the open button when it closes
  const focusStart = () => (narrow ? panelRef.current : inputRef.current)?.focus();
  useEffect(() => {
    if (shown) {
      wasOpen.current = true;
      (window.matchMedia("(max-width: 767px)").matches ? panelRef.current : inputRef.current)?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      if (!navClosed.current) document.querySelector<HTMLElement>('[data-testid="chat-open"]')?.focus();
      navClosed.current = false;
    }
  }, [shown]);

  // a full-screen panel would hide the page a card link just opened: close it on navigation (focus then stays with the new page)
  useEffect(() => {
    if (narrow && chatOpen) {
      navClosed.current = true;
      setChatOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a route change closes it
  }, [path]);

  if (hidden) return null;

  const submit = async (raw: string, fromInput: boolean) => {
    const t = raw.trim();
    if (!t || waiting) return;
    setError(null);
    setItems((x) => [...x, { role: "USER", text: t }]);
    if (fromInput) {
      setText("");
      inputRef.current?.focus(); // the send button is about to be disabled: keep the keyboard focus in the panel
    }
    setWaiting(true);
    const r = await api<{ reply: string; cards: Card[] }>(lang, "/api/chat", { body: { text: t } });
    setWaiting(false);
    if (r.ok) setItems((x) => [...x, { role: "BOT", text: r.data.reply, cards: r.data.cards }]);
    else setError(r.error.message);
  };
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    void submit(text, true);
  };
  const ask = (q: (typeof QUICK)[number]) => {
    void submit(tx(lang, q.askTh, q.askEn), false);
    focusStart();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    // full-screen dialog: Tab stays inside the panel
    if (e.key === "Tab" && narrow && panelRef.current) {
      const els = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const cur = document.activeElement;
      if (e.shiftKey && (cur === first || cur === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && cur === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const title = tx(lang, "น้องบอล ผู้ช่วยจองสนาม (บอท)", "Nong Ball, booking assistant (bot)");
  const started = items.length > 0;
  return (
    <div
      ref={widgetRef}
      className="chat-widget"
      data-testid="chat-widget"
      data-chat-state={waiting ? "waiting" : "idle"}
      onKeyDown={onKeyDown}
    >
      {open && (
        <section
          ref={panelRef}
          className="chat-panel"
          id="chat-panel"
          data-testid="chat-panel"
          aria-label={title}
          role={narrow ? "dialog" : undefined}
          aria-modal={narrow ? true : undefined}
          tabIndex={-1}
        >
          <div className="chat-head">
            <BotAvatar size={40} title={tx(lang, "รูปน้องบอล", "Nong Ball")} />
            <div className="chat-head-text">
              <div className="chat-head-title">
                <h2>{tx(lang, "น้องบอล", "Nong Ball")}</h2>
                <span className="chat-badge">{tx(lang, "บอท", "Bot")}</span>
              </div>
              <p>{tx(lang, "ผู้ช่วยจองสนาม ตอบเร็ว ไม่ใช่เจ้าหน้าที่", "Booking assistant, quick replies, not staff")}</p>
            </div>
            <button type="button" className="chat-x" data-testid="chat-close" onClick={() => setOpen(false)} aria-label={tx(lang, "ปิดแชท", "Close chat")}>
              <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="chat-log" role="log" aria-live="polite" data-testid="chat-log" ref={logRef}>
            {!started && (
              <>
                <div className="chat-msg bot chat-welcome" data-testid="chat-welcome">
                  <p className="chat-who">{tx(lang, "น้องบอล, บอทผู้ช่วย", "Nong Ball, assistant bot")}</p>
                  {tx(
                    lang,
                    "สวัสดีครับ ผมเป็นบอท ไม่ใช่เจ้าหน้าที่ ถามเรื่องราคาและรอบว่าง หรือให้ช่วยจองสนามได้ครับ",
                    "Hello! I am a bot, not a staff member. Ask me about prices and free slots, or let me book a field for you.",
                  )}
                  <Capabilities lang={lang} />
                </div>
                <div>
                  <p className="chat-who">{tx(lang, "เลือกคำถามด่วน หรือพิมพ์ถามได้เลย", "Pick a quick question, or just type")}</p>
                  <div className="chat-quick-grid">
                    {QUICK.map((q) => (
                      <button key={q.id} type="button" className="chat-chip" data-testid={`chat-quick-${q.id}`} disabled={waiting} onClick={() => ask(q)}>
                        <span>
                          {tx(lang, q.th, q.en)}
                          <small>{tx(lang, q.dTh, q.dEn)}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {started && (
              <details className="chat-caps-d">
                <summary>{tx(lang, "น้องบอลทำอะไรได้บ้าง", "What can Nong Ball do?")}</summary>
                <Capabilities lang={lang} />
              </details>
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
          <div className="chat-foot">
            {started && (
              <div className="chat-rail" role="group" aria-label={tx(lang, "คำถามด่วน", "Quick questions")}>
                {QUICK.map((q) => (
                  <button key={q.id} type="button" className="chat-chip" data-testid={`chat-quick-${q.id}`} disabled={waiting} onClick={() => ask(q)}>
                    {tx(lang, q.th, q.en)}
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p className="field-error" role="alert" data-testid="chat-error" style={{ margin: 0 }}>
                {error}
              </p>
            )}
            <form className="chat-form" onSubmit={send}>
              <label htmlFor="chat-input" className="sr-only">
                {tx(lang, "พิมพ์ข้อความถึงน้องบอล", "Message to Nong Ball")}
              </label>
              <input
                ref={inputRef}
                id="chat-input"
                data-testid="chat-input"
                value={text}
                maxLength={MAX}
                onChange={(e) => setText(e.target.value)}
                placeholder={tx(lang, "ถามรอบว่าง ราคา หรือจองสนาม", "Ask about free slots, prices or booking")}
                autoComplete="off"
              />
              <button type="submit" className="btn" data-testid="chat-send" disabled={waiting || !text.trim()}>
                {tx(lang, "ส่ง", "Send")}
              </button>
            </form>
            <div className="chat-note" data-testid="chat-count" data-value={[...text].length}>
              <span>
                {[...text].length}/{MAX}
              </span>
              <span>{tx(lang, "บอทนี้ยกเลิกหรือเลื่อนการจองไม่ได้", "This bot cannot cancel or reschedule a booking")}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
