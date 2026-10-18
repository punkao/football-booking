"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FieldArt } from "@/components/Art";
import { PhoneGate } from "@/components/PhoneGate";
import { ErrorBox, Money, OkBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { LEVEL_LABEL, fieldName, fmtDate, fmtDateTime, label, msg, rentalName, statusLabel, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { LAST_START_HOUR, OPEN_HOUR } from "@/lib/rules";

type Booking = {
  code: string;
  status: string;
  fieldId: string;
  date: string;
  startHour: number;
  hours: number;
  paymentPlan: string;
  fieldPrice: number;
  discount: number;
  freeHourValue: number;
  rentalPrice: number;
  creditUsed: number;
  totalPrice: number;
  netPrice: number;
  payNow: number;
  amountPaid: number;
  dueAtField: number;
  rescheduleCount: number;
  customerName: string;
  rentals: { itemId: string; qty: number; returnedQty: number }[];
  payments: { id: number; amount: number; method: string }[];
  challenge: { id: number; teamName: string; level: string; status: string; amount: number } | null;
  split: { token: string; shares: { id: number; memberName: string; amount: number; paid: boolean }[] } | null;
  series: { weeksRequested: number; weeksBooked: number; discountPercent: number; bookings: { code: string; date: string; status: string }[] } | null;
};
type Detail = {
  booking: Booking;
  /** FR-45: status steps from BookingStatusHistory (time only, no staff names) */
  history?: { toStatus: string; at: string }[];
  actions: {
    canPay: boolean;
    canCancel: boolean;
    cancelBlockedBy: string | null;
    cancelCreditNow: number;
    canReschedule: boolean;
    rescheduleBlockedBy: string | null;
    canChallenge: boolean;
    canSplit: boolean;
  };
};

export function BookingClient({ lang, code, done }: { lang: Lang; code: string; done: string | null }) {
  const [data, setData] = useState<Detail | null>(null);
  const [locked, setLocked] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(done === "paid" ? msg(lang, "OK_PAID") : done === "free" ? msg(lang, "OK_CONFIRMED_FREE") : null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState(9);
  const [splitNames, setSplitNames] = useState("");
  const [splitCount, setSplitCount] = useState("");
  const [team, setTeam] = useState("");
  const [level, setLevel] = useState("INTERMEDIATE");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Detail>(lang, `/api/bookings/${encodeURIComponent(code)}`);
    if (r.ok) {
      setData(r.data);
      setLocked(false);
      setNewDate((d) => d || r.data.booking.date);
      setNewStart((s) => (s === 9 ? r.data.booking.startHour : s));
    } else if (r.status === 403) setLocked(true);
    else setNotFound(r.error.message);
    setLoading(false);
  }, [lang, code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const act = async (path: string, body: unknown) => {
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await api<{ message?: string }>(lang, `/api/bookings/${encodeURIComponent(code)}/${path}`, { body });
    if (r.ok) setOk(r.data.message ?? null);
    else setError(r.error.message);
    setConfirmCancel(false);
    await load();
    setBusy(false);
  };

  const createChallenge = async () => {
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await api<{ message?: string }>(lang, "/api/challenges", { body: { code, teamName: team, level } });
    if (r.ok) setOk(r.data.message ?? null);
    else setError(r.error.message);
    await load();
    setBusy(false);
  };

  const b = data?.booking;
  const a = data?.actions;
  const hourOptions = [];
  for (let h = OPEN_HOUR; h <= LAST_START_HOUR; h++) hourOptions.push(h);
  const active = b && (b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT");

  return (
    <main className="page container">
      <Ready when={!loading && !busy} />
      <h1 className="page-title">{tx(lang, "การจองของคุณ", "Your booking")}</h1>
      {notFound && <ErrorBox message={notFound} />}
      {locked && <PhoneGate lang={lang} code={code} onUnlocked={load} />}
      {b && a && (
        <div className="two-col">
          <div className="stack">
            <section className="card">
              <div className="spread">
                <span className="code-pill" data-testid="booking-code">
                  {b.code}
                </span>
                <span className={`status-tag ${b.status}`} data-testid="booking-status" data-value={b.status}>
                  {statusLabel(lang, b.status)}
                </span>
              </div>
              <h2 style={{ marginTop: 14 }} data-testid="booking-field" data-value={b.fieldId}>
                {fieldName(lang, b.fieldId)}
              </h2>
              <p style={{ margin: 0 }}>
                <span data-testid="booking-date" data-value={b.date}>
                  {fmtDate(lang, b.date)}
                </span>{" "}
                ·{" "}
                <span data-testid="booking-time" data-value={`${b.startHour}-${b.hours}`}>
                  {timeRange(b.startHour, b.hours)}
                </span>
              </p>
              <p className="muted small" style={{ marginBottom: 0 }}>
                {tx(lang, "ผู้จอง", "Booked by")}: <span data-testid="booking-customer">{b.customerName}</span>
                {b.rescheduleCount > 0 && <> · {tx(lang, "เลื่อนแล้ว 1 ครั้ง", "Rescheduled once")}</>}
              </p>
              {a.canPay && (
                <Link href={`/pay/${b.code}`} className="btn yellow" style={{ marginTop: 12 }} data-testid="go-pay">
                  {tx(lang, "ไปหน้าชำระเงิน", "Go to payment")}
                </Link>
              )}
            </section>

            {data.history && data.history.length > 0 && (
              <section className="card" aria-labelledby="h-timeline">
                <h2 id="h-timeline">{tx(lang, "ขั้นตอนการจอง", "Booking progress")}</h2>
                <ol className="timeline" data-testid="booking-timeline" data-count={data.history.length}>
                  {data.history.map((h, i) => (
                    <li
                      key={i}
                      className={`timeline-step ${h.toStatus}${i === data.history!.length - 1 ? " current" : ""}`}
                      data-testid={`timeline-step-${i}`}
                      data-status={h.toStatus}
                      aria-current={i === data.history!.length - 1 ? "step" : undefined}
                    >
                      <span className="timeline-dot" aria-hidden="true" />
                      <span className="timeline-label">{statusLabel(lang, h.toStatus)}</span>
                      <time className="timeline-time" data-testid={`timeline-time-${i}`} dateTime={h.at}>
                        {fmtDateTime(lang, h.at)}
                      </time>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="card" aria-labelledby="h-actions">
              <h2 id="h-actions">{tx(lang, "จัดการการจอง", "Manage booking")}</h2>
              <OkBox message={ok} />
              <ErrorBox message={error} />

              {active && (
                <div className="stack" style={{ marginTop: 12 }}>
                  <div>
                    <h3>{tx(lang, "ยกเลิก", "Cancel")}</h3>
                    <p className="small muted" style={{ marginTop: 0 }}>
                      {tx(lang, "ยกเลิกก่อนเวลาเริ่ม ≥ 24 ชั่วโมง ได้เครดิตคืนเต็มจำนวน (ไม่คืนเงินสด)", "Cancel ≥ 24 hours before the start for full credit (no cash refunds)")}
                    </p>
                    {!confirmCancel ? (
                      <>
                        {/* F-02: always opens the same confirm step; when cancelling is not allowed the reason is shown here and in that step */}
                        <button
                          type="button"
                          className="btn ghost"
                          data-testid="cancel-booking"
                          aria-describedby={a.cancelBlockedBy ? "cancel-booking-hint" : undefined}
                          onClick={() => setConfirmCancel(true)}
                          disabled={busy}
                        >
                          {tx(lang, "ยกเลิกการจอง", "Cancel booking")}
                        </button>
                        {a.cancelBlockedBy && (
                          <p className="hint" id="cancel-booking-hint" data-testid="cancel-booking-hint" data-value={a.cancelBlockedBy}>
                            {msg(lang, a.cancelBlockedBy)}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="alert info">
                        <p style={{ marginTop: 0 }}>
                          {tx(lang, "ถ้ายกเลิกตอนนี้จะได้เครดิตคืน", "If you cancel now you get credit")}{" "}
                          <Money lang={lang} value={a.cancelCreditNow} testid="cancel-credit-preview" />
                        </p>
                        {a.cancelBlockedBy && (
                          <p className="hint" style={{ marginTop: 0 }} data-testid="cancel-confirm-reason" data-value={a.cancelBlockedBy}>
                            {msg(lang, a.cancelBlockedBy)}
                          </p>
                        )}
                        <div className="row">
                          <button type="button" className="btn danger small" data-testid="cancel-confirm" onClick={() => act("cancel", {})} disabled={busy}>
                            {tx(lang, "ยืนยันยกเลิก", "Confirm cancel")}
                          </button>
                          <button type="button" className="btn ghost small" data-testid="cancel-abort" onClick={() => setConfirmCancel(false)}>
                            {tx(lang, "ไม่ยกเลิก", "Keep booking")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {b.status === "CONFIRMED" && (
                    <div>
                      <h3>{tx(lang, "เลื่อนวัน/เวลา", "Reschedule")}</h3>
                      <p className="small muted" style={{ marginTop: 0 }}>
                        {tx(lang, "เลื่อนได้ 1 ครั้ง ก่อนเวลาเริ่มอย่างน้อย 24 ชั่วโมง · แพงขึ้นจ่ายส่วนต่าง ถูกลงได้ส่วนต่างเป็นเครดิต", "Once, at least 24 hours before the start · pay the difference if pricier, get credit if cheaper")}
                      </p>
                      <div className="form-grid">
                        <label className="fld">
                          <span>{tx(lang, "วันใหม่", "New date")}</span>
                          <input type="date" data-testid="reschedule-date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                        </label>
                        <label className="fld">
                          <span>{tx(lang, "เวลาเริ่มใหม่", "New start time")}</span>
                          <select data-testid="reschedule-start" value={newStart} onChange={(e) => setNewStart(Number(e.target.value))}>
                            {hourOptions.map((h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, "0")}:00
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button
                        type="button"
                        className="btn small"
                        style={{ marginTop: 10 }}
                        data-testid="reschedule-submit"
                        aria-describedby={a.rescheduleBlockedBy ? "reschedule-submit-hint" : undefined}
                        onClick={() => act("reschedule", { date: newDate, startHour: newStart })}
                        disabled={busy}
                      >
                        {tx(lang, "เลื่อนการจอง", "Reschedule")}
                      </button>
                      {a.rescheduleBlockedBy && (
                        <p className="hint" id="reschedule-submit-hint" data-testid="reschedule-submit-hint" data-value={a.rescheduleBlockedBy}>
                          {msg(lang, a.rescheduleBlockedBy)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(b.status === "CONFIRMED" || b.status === "CHECKED_IN") && (
                <div style={{ marginTop: 18 }}>
                  <h3>{tx(lang, "ลิงก์หารค่าสนาม", "Split link")}</h3>
                  {b.split ? (
                    <div>
                      <p style={{ marginTop: 0 }}>
                        <Link href={`/split/${b.split.token}`} data-testid="split-link">
                          {tx(lang, "เปิดลิงก์หารค่าสนาม", "Open split link")}
                        </Link>{" "}
                        · <span data-testid="split-link-people" data-value={b.split.shares.length}>{b.split.shares.length}</span> {tx(lang, "คน", "people")} ·{" "}
                        {tx(lang, "คนละ", "each")} <Money lang={lang} value={b.split.shares[0]?.amount ?? 0} testid="split-per-person" />
                      </p>
                      <p className="small muted" style={{ marginTop: 0 }} data-testid="split-existing-note">
                        {tx(lang, "1 การจองมีลิงก์หารได้ 1 ลิงก์ · ใช้ลิงก์นี้ส่งให้ลูกทีม", "One split link per booking · share this link with your team")}
                      </p>
                      <ul className="list">
                        {b.split.shares.map((s, i) => (
                          <li key={s.id} className="spread" data-testid={`split-share-${i + 1}`} data-paid={s.paid}>
                            <span>{s.memberName}</span>
                            <span className={`status-tag ${s.paid ? "CHECKED_IN" : "PENDING_PAYMENT"}`}>{s.paid ? tx(lang, "จ่ายแล้ว", "Paid") : tx(lang, "ยังไม่จ่าย", "Not paid")}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="form">
                      <label className="fld">
                        <span>{tx(lang, "ชื่อลูกทีม (บรรทัดละ 1 คน)", "Team members (one per line)")}</span>
                        <textarea data-testid="split-names" value={splitNames} onChange={(e) => setSplitNames(e.target.value)} />
                      </label>
                      <label className="fld">
                        <span>{tx(lang, "หรือจำนวนคน", "Or number of people")}</span>
                        <input type="number" min={2} data-testid="split-count" value={splitCount} onChange={(e) => setSplitCount(e.target.value)} />
                      </label>
                      <button
                        type="button"
                        className="btn small"
                        data-testid="split-create"
                        disabled={busy}
                        onClick={() =>
                          act("split", {
                            names: splitNames.split("\n").map((s) => s.trim()).filter(Boolean),
                            count: splitCount === "" ? undefined : Number(splitCount),
                          })
                        }
                      >
                        {tx(lang, "สร้างลิงก์หาร", "Create split link")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(b.status === "CONFIRMED" || b.challenge) && (
                <div style={{ marginTop: 18 }}>
                  <h3>{tx(lang, "ประกาศหาทีมคู่แข่ง", "Find an opponent")}</h3>
                  {b.challenge && b.challenge.status !== "CLOSED" ? (
                    <p data-testid="challenge-info">
                      {b.challenge.teamName} · {label(lang, LEVEL_LABEL, b.challenge.level)} ·{" "}
                      <span className={`status-tag ${b.challenge.status}`} data-testid="challenge-status" data-value={b.challenge.status}>
                        {statusLabel(lang, b.challenge.status)}
                      </span>{" "}
                      · {tx(lang, "ทีมรับจ่าย", "Opponent pays")} <Money lang={lang} value={b.challenge.amount} testid="challenge-amount" />
                    </p>
                  ) : (
                    <div className="form">
                      <label className="fld">
                        <span>{tx(lang, "ชื่อทีม", "Team name")}</span>
                        <input type="text" data-testid="challenge-team" value={team} onChange={(e) => setTeam(e.target.value)} />
                      </label>
                      <label className="fld">
                        <span>{tx(lang, "ระดับทีม", "Team level")}</span>
                        <select data-testid="challenge-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                          {Object.keys(LEVEL_LABEL).map((l) => (
                            <option key={l} value={l}>
                              {label(lang, LEVEL_LABEL, l)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="btn small"
                        data-testid="challenge-create"
                        aria-describedby={!a.canChallenge ? "challenge-create-hint" : undefined}
                        onClick={createChallenge}
                        disabled={busy}
                      >
                        {tx(lang, "ประกาศหาคู่แข่ง", "Post challenge")}
                      </button>
                      {!a.canChallenge && (
                        <p className="hint" id="challenge-create-hint" data-testid="challenge-create-hint">
                          {msg(lang, "CHALLENGE_NOT_ALLOWED")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {b.series && (
              <section className="card" data-testid="booking-series">
                <h2>{tx(lang, "จองประจำ", "Recurring booking")}</h2>
                <p className="small muted">
                  {tx(lang, "ขอ", "Requested")} {b.series.weeksRequested} · {tx(lang, "ได้จริง", "Booked")} {b.series.weeksBooked} · {tx(lang, "ส่วนลด", "Discount")}{" "}
                  {b.series.discountPercent}%
                </p>
                <ul className="list">
                  {b.series.bookings.map((s) => (
                    <li key={s.code} className="spread">
                      <Link href={`/booking/${s.code}`}>{s.code}</Link>
                      <span>{fmtDate(lang, s.date)}</span>
                      <span className={`status-tag ${s.status}`}>{statusLabel(lang, s.status)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="card">
            <FieldArt
              id={b.fieldId}
              size={b.fieldId === "C" ? 7 : 5}
              covered={b.fieldId === "C"}
              title={tx(lang, `ภาพวาด${fieldName(lang, b.fieldId)}`, `Drawing of ${fieldName(lang, b.fieldId)}`)}
            />
            <h2 style={{ marginTop: 14 }}>{tx(lang, "สรุปราคา", "Price summary")}</h2>
            <dl className="price-list">
              <div>
                <dt>{tx(lang, "ค่าสนาม", "Field price")}</dt>
                <dd>
                  <Money lang={lang} value={b.fieldPrice} testid="price-field" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "ส่วนลด", "Discount")}</dt>
                <dd>
                  <Money lang={lang} value={b.discount} testid="price-discount" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "ชั่วโมงฟรี", "Free hour")}</dt>
                <dd>
                  <Money lang={lang} value={b.freeHourValue} testid="price-free-hour" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "ของเช่า", "Rentals")}</dt>
                <dd>
                  <Money lang={lang} value={b.rentalPrice} testid="price-rental" />
                </dd>
              </div>
              <div className="total">
                <dt>{tx(lang, "ยอดรวม", "Total")}</dt>
                <dd>
                  <Money lang={lang} value={b.totalPrice} testid="price-total" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "เครดิตที่ใช้", "Credit used")}</dt>
                <dd>
                  <Money lang={lang} value={b.creditUsed} testid="price-credit" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "แผนการจ่าย", "Payment plan")}</dt>
                <dd data-testid="price-plan" data-value={b.paymentPlan}>
                  {b.paymentPlan === "FULL_100" ? tx(lang, "จ่ายเต็ม 100%", "Pay 100% now") : tx(lang, "มัดจำ 50%", "50% deposit")}
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "จ่ายตอนจอง", "Pay at booking")}</dt>
                <dd>
                  <Money lang={lang} value={b.payNow} testid="price-pay-now" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "จ่ายแล้ว", "Paid")}</dt>
                <dd>
                  <Money lang={lang} value={b.amountPaid} testid="amount-paid" />
                </dd>
              </div>
              <div className="paynow">
                <dt>{tx(lang, "เก็บหน้าสนาม", "Pay at the field")}</dt>
                <dd>
                  <Money lang={lang} value={b.dueAtField} testid="due-at-field" />
                </dd>
              </div>
            </dl>
            {b.rentals.length > 0 && (
              <>
                <h3 style={{ marginTop: 14 }}>{tx(lang, "ของเช่า", "Rentals")}</h3>
                <ul className="list">
                  {b.rentals.map((r) => (
                    <li key={r.itemId} data-testid={`booking-rental-${r.itemId}`} data-value={r.qty}>
                      {rentalName(lang, r.itemId)} × {r.qty}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
