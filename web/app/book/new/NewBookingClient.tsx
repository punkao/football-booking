"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FieldArt } from "@/components/Art";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { fieldName, fmtDate, msg, rentalName, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { LAST_START_HOUR, OPEN_HOUR, checkPhone, isFreeHourSlot, normalizePhone } from "@/lib/rules";

type Quote = {
  fieldId: string;
  field: { id: string; size: number; covered: boolean };
  fieldPrice: number;
  discount: number;
  freeHourValue: number;
  rentalPrice: number;
  totalPrice: number;
  creditUsed: number;
  netPrice: number;
  paymentPlan: "DEPOSIT_50" | "FULL_100";
  payNow: number;
  dueAtField: number;
  hourly: { hour: number; rate: number }[];
  freeHourSlot: boolean;
  isHoliday: boolean;
};
type RentalInfo = { id: string; price: number; stock: number; remaining: number; maxQty: number };
type Member = { name: string; phone: string; creditBalance: number; freeHours: number; paidHours: number } | null;

export function NewBookingClient({ lang, member, initial }: { lang: Lang; member: Member; initial: { fieldId: string; date: string; startHour: number } }) {
  const router = useRouter();
  const [fieldId, setFieldId] = useState(initial.fieldId);
  const [date, setDate] = useState(initial.date);
  const [startHour, setStartHour] = useState(initial.startHour);
  const [hours, setHours] = useState("1");
  const [rent, setRent] = useState<Record<string, string>>({ BIB: "0", BALL: "0" });
  const [rentInfo, setRentInfo] = useState<RentalInfo[]>([]);
  const [useCredit, setUseCredit] = useState(false);
  const [useFreeHour, setUseFreeHour] = useState(false);
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [consent, setConsent] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  // F-02: reason from the last price check (slot taken / time rule …) shown under the submit button before clicking
  const [slotProblem, setSlotProblem] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const hoursNum = Number(hours);
  // BR-24 / Q-T5: the free-hour box is disabled (with the reason) when this slot or this member can't use it
  const freeHourBlockedBy = !member
    ? null
    : !isFreeHourSlot(date, startHour)
      ? "FREE_HOUR_NOT_ELIGIBLE"
      : member.freeHours <= 0
        ? "FREE_HOUR_NONE"
        : null;
  const freeHourOn = useFreeHour && freeHourBlockedBy === null;
  // F-03: after a submit, every wrong customer field shows its own error at the same time (same words as the API)
  const fieldErrors = triedSubmit
    ? {
        name: name.trim() ? null : msg(lang, "NAME_REQUIRED"),
        phone: checkPhone(normalizePhone(phone)) ? msg(lang, "INVALID_PHONE") : null,
        consent: consent ? null : msg(lang, "CONSENT_REQUIRED"),
      }
    : { name: null, phone: null, consent: null };
  const rentals = useMemo(
    () => Object.entries(rent).map(([itemId, q]) => ({ itemId, qty: q === "" ? 0 : Number(q) })),
    [rent],
  );

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the async quote below
    setQuoting(true);
    const t = setTimeout(async () => {
      const r = await api<{ quote: Quote }>(lang, "/api/quote", {
        body: { fieldId, date, startHour, hours: hoursNum, rentals, useCredit, useFreeHour: freeHourOn },
      });
      if (!alive) return;
      if (r.ok) {
        setQuote(r.data.quote);
        setError(null);
        setSlotProblem(null);
      } else {
        setQuote(null);
        setError(r.error.message);
        setSlotProblem(r.error.message);
      }
      const h = Number.isInteger(hoursNum) && hoursNum > 0 ? hoursNum : 1;
      const ra = await api<{ items: RentalInfo[] }>(lang, `/api/rentals/availability?date=${date}&startHour=${startHour}&hours=${h}`);
      if (!alive) return;
      setRentInfo(ra.ok ? ra.data.items : []);
      setQuoting(false);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [lang, fieldId, date, startHour, hoursNum, rentals, useCredit, freeHourOn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTriedSubmit(true);
    setError(null);
    const r = await api<{ booking: { code: string }; next: string }>(lang, "/api/bookings", {
      body: { fieldId, date, startHour, hours: hoursNum, rentals, useCredit, useFreeHour: freeHourOn, name, phone, consent },
    });
    if (r.ok) {
      router.push(r.data.next);
      return;
    }
    setError(r.error.message);
    setSubmitting(false);
  };

  const hourOptions = [];
  for (let h = OPEN_HOUR; h <= LAST_START_HOUR; h++) hourOptions.push(h);

  return (
    <main className="page container">
      <Ready when={!quoting && !submitting} />
      <p className="small">
        <Link href={`/book?date=${date}`} data-testid="back-to-availability">
          ← {tx(lang, "กลับไปตารางว่าง", "Back to availability")}
        </Link>
      </p>
      <h1 className="page-title">{tx(lang, "จองสนาม", "Book a field")}</h1>
      <p className="muted">
        {fieldName(lang, fieldId)} · {fmtDate(lang, date)} · {Number.isInteger(hoursNum) && hoursNum > 0 ? timeRange(startHour, hoursNum) : "-"}
      </p>

      <form className="two-col" onSubmit={submit} noValidate>
        <div className="stack">
          <section className="card form" aria-labelledby="h-slot">
            <h2 id="h-slot">{tx(lang, "1. รอบเวลา", "1. Time slot")}</h2>
            <div className="form-grid">
              <label className="fld wide">
                <span>{tx(lang, "สนาม", "Field")}</span>
                <select data-testid="book-field" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
                  {["A", "B", "C"].map((f) => (
                    <option key={f} value={f}>
                      {fieldName(lang, f)} ({f === "C" ? tx(lang, "7 คน มีหลังคา", "7-a-side, covered") : tx(lang, "5 คน กลางแจ้ง", "5-a-side, outdoor")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld">
                <span>{tx(lang, "วันที่", "Date")}</span>
                <input type="date" data-testid="book-date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="fld">
                <span>{tx(lang, "เวลาเริ่ม", "Start time")}</span>
                <select data-testid="book-start" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld">
                <span>{tx(lang, "จำนวนชั่วโมง", "Hours")}</span>
                <input type="number" inputMode="numeric" min={1} step={1} data-testid="book-hours" value={hours} onChange={(e) => setHours(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="card form" aria-labelledby="h-rent">
            <h2 id="h-rent">{tx(lang, "2. ของเช่า (คิดต่อการจอง)", "2. Rentals (per booking)")}</h2>
            <div className="form-grid">
              {["BIB", "BALL"].map((id) => {
                const info = rentInfo.find((r) => r.id === id);
                return (
                  <label key={id} className="fld">
                    <span>
                      {rentalName(lang, id)} ({id === "BIB" ? tx(lang, "฿50/ชุด", "THB 50 each") : tx(lang, "฿30/ลูก", "THB 30 each")})
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={info?.maxQty}
                      step={1}
                      inputMode="numeric"
                      data-testid={`rental-${id}-qty`}
                      value={rent[id]}
                      onChange={(e) => setRent({ ...rent, [id]: e.target.value })}
                    />
                    <span className="small muted">
                      {tx(lang, "คงเหลือช่วงนี้", "Left for this time")}:{" "}
                      <b data-testid={`rental-${id}-remaining`} data-value={info?.remaining ?? ""}>
                        {info ? info.remaining : "-"}
                      </b>{" "}
                      / {info?.stock ?? "-"}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {member && (
            <section className="card form" aria-labelledby="h-member">
              <h2 id="h-member">{tx(lang, "3. สิทธิ์สมาชิก", "3. Member benefits")}</h2>
              <label className="check">
                <input type="checkbox" data-testid="use-credit" checked={useCredit} disabled={member.creditBalance <= 0} onChange={(e) => setUseCredit(e.target.checked)} />
                <span>
                  {tx(lang, "ใช้เครดิต (มี ", "Use credit (balance ")}
                  <Money lang={lang} value={member.creditBalance} testid="member-credit-balance" />)
                </span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  data-testid="use-free-hour"
                  checked={freeHourOn}
                  disabled={freeHourBlockedBy !== null}
                  aria-describedby={freeHourBlockedBy ? "use-free-hour-reason" : undefined}
                  onChange={(e) => setUseFreeHour(e.target.checked)}
                />
                <span>
                  {tx(lang, "ใช้ชั่วโมงฟรี 1 ชั่วโมง (มีสิทธิ์ ", "Use 1 free hour (available: ")}
                  <b data-testid="member-free-hours" data-value={member.freeHours}>
                    {member.freeHours}
                  </b>
                  {tx(lang, " ชั่วโมง) · เฉพาะรอบเริ่มก่อน 17:00 จันทร์–ศุกร์", ") · slots starting before 17:00, Mon–Fri only")}
                </span>
              </label>
              {freeHourBlockedBy && (
                <p className="hint" id="use-free-hour-reason" data-testid="use-free-hour-reason" data-value={freeHourBlockedBy}>
                  {msg(lang, freeHourBlockedBy)}
                </p>
              )}
            </section>
          )}

          <section className="card form" aria-labelledby="h-cust">
            <h2 id="h-cust">{member ? tx(lang, "4. ข้อมูลผู้จอง", "4. Your details") : tx(lang, "3. ข้อมูลผู้จอง", "3. Your details")}</h2>
            {!member && (
              <p className="small muted" style={{ margin: 0 }}>
                {tx(lang, "ไม่ต้องสมัครสมาชิก · สมาชิก", "No sign-up needed · Members can")}{" "}
                <Link href="/my">{tx(lang, "เข้าสู่ระบบ", "log in")}</Link> {tx(lang, "เพื่อใช้เครดิตและชั่วโมงฟรี", "to use credit and free hours")}
              </p>
            )}
            <label className="fld">
              <span>{tx(lang, "ชื่อ", "Name")}</span>
              <input
                type="text"
                data-testid="customer-name"
                autoComplete="name"
                value={name}
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? "field-error-name" : undefined}
                onChange={(e) => setName(e.target.value)}
              />
              {fieldErrors.name && (
                <span className="field-error" id="field-error-name" data-testid="field-error-name">
                  {fieldErrors.name}
                </span>
              )}
            </label>
            <label className="fld">
              <span>{tx(lang, "เบอร์โทร (10 หลัก)", "Phone (10 digits)")}</span>
              <input
                type="tel"
                data-testid="customer-phone"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                aria-invalid={fieldErrors.phone ? true : undefined}
                aria-describedby={fieldErrors.phone ? "field-error-phone" : undefined}
                onChange={(e) => setPhone(e.target.value)}
              />
              {fieldErrors.phone && (
                <span className="field-error" id="field-error-phone" data-testid="field-error-phone">
                  {fieldErrors.phone}
                </span>
              )}
            </label>
            <label className="check">
              <input
                type="checkbox"
                data-testid="pdpa-consent"
                checked={consent}
                aria-invalid={fieldErrors.consent ? true : undefined}
                aria-describedby={fieldErrors.consent ? "field-error-consent" : undefined}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {tx(
                  lang,
                  "ยินยอมให้ร้านเก็บชื่อและเบอร์โทรเพื่อใช้จัดการการจองนี้ (PDPA)",
                  "I agree that the shop may keep my name and phone number to manage this booking (PDPA)",
                )}
              </span>
            </label>
            {fieldErrors.consent && (
              <span className="field-error" id="field-error-consent" data-testid="field-error-consent">
                {fieldErrors.consent}
              </span>
            )}
          </section>
        </div>

        <aside className="card" aria-labelledby="h-price" data-testid="price-panel" style={{ position: "sticky", top: 120 }}>
          <FieldArt
            id={fieldId}
            size={fieldId === "C" ? 7 : 5}
            covered={fieldId === "C"}
            title={tx(lang, `ภาพวาด${fieldName(lang, fieldId)}`, `Drawing of ${fieldName(lang, fieldId)}`)}
          />
          <h2 id="h-price" style={{ marginTop: 14 }}>
            {tx(lang, "สรุปราคา", "Price summary")}
          </h2>
          <ErrorBox message={error} />
          {quote && (
            <dl className="price-list">
              {quote.hourly.map((h) => (
                <div key={h.hour} className="small">
                  <dt>{timeRange(h.hour, 1)}</dt>
                  <dd data-testid={`price-hour-${h.hour}`} data-value={h.rate}>
                    <Money lang={lang} value={h.rate} />
                  </dd>
                </div>
              ))}
              <div>
                <dt>{tx(lang, "ค่าสนาม", "Field price")}</dt>
                <dd>
                  <Money lang={lang} value={quote.fieldPrice} testid="price-field" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "ส่วนลด", "Discount")}</dt>
                <dd>
                  <Money lang={lang} value={quote.discount} testid="price-discount" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "ชั่วโมงฟรี", "Free hour")}</dt>
                <dd>
                  <Money lang={lang} value={quote.freeHourValue} testid="price-free-hour" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "ของเช่า", "Rentals")}</dt>
                <dd>
                  <Money lang={lang} value={quote.rentalPrice} testid="price-rental" />
                </dd>
              </div>
              <div className="total">
                <dt>{tx(lang, "ยอดรวม", "Total")}</dt>
                <dd>
                  <Money lang={lang} value={quote.totalPrice} testid="price-total" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "เครดิตที่ใช้", "Credit used")}</dt>
                <dd>
                  <Money lang={lang} value={quote.creditUsed} testid="price-credit" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "ยอดสุทธิ", "Net")}</dt>
                <dd>
                  <Money lang={lang} value={quote.netPrice} testid="price-net" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "แผนการจ่าย", "Payment plan")}</dt>
                <dd data-testid="price-plan" data-value={quote.paymentPlan}>
                  {quote.paymentPlan === "FULL_100" ? tx(lang, "จ่ายเต็ม 100%", "Pay 100% now") : tx(lang, "มัดจำ 50%", "50% deposit")}
                </dd>
              </div>
              <div className="paynow">
                <dt>{tx(lang, "จ่ายตอนนี้", "Pay now")}</dt>
                <dd>
                  <Money lang={lang} value={quote.payNow} testid="price-pay-now" />
                </dd>
              </div>
              <div>
                <dt>{tx(lang, "เก็บหน้าสนาม", "Pay at the field")}</dt>
                <dd>
                  <Money lang={lang} value={quote.dueAtField} testid="price-due-at-field" />
                </dd>
              </div>
            </dl>
          )}
          <button
            type="submit"
            className="btn yellow block"
            style={{ marginTop: 16 }}
            data-testid="book-submit"
            aria-describedby={slotProblem ? "book-submit-hint" : undefined}
            disabled={submitting}
          >
            {submitting ? tx(lang, "กำลังจอง…", "Booking…") : tx(lang, "ยืนยันการจอง", "Confirm booking")}
          </button>
          {slotProblem && (
            <p className="hint" id="book-submit-hint" data-testid="book-submit-hint">
              {slotProblem}
            </p>
          )}
          <p className="small muted" style={{ marginBottom: 0 }}>
            {tx(lang, "ต้องชำระภายใน 15 นาทีหลังยืนยัน ไม่งั้นรอบจะถูกปล่อยว่าง", "Pay within 15 minutes after confirming or the slot is released")}
          </p>
        </aside>
      </form>
    </main>
  );
}
