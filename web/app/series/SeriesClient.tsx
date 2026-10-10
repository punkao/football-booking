"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { fieldName, fmtDate, msg, timeRange, tx, weekdayName } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { LAST_START_HOUR, OPEN_HOUR, SERIES_MAX_WEEKS, SERIES_MIN_WEEKS, weekdayOf } from "@/lib/rules";

type Preview = {
  fieldId: string;
  startHour: number;
  hours: number;
  weekday: number;
  weeksRequested: number;
  weeksBooked: number;
  discountPercent: number;
  conflicts: string[];
  weeks: { week: number; date: string; status: string; reason: string | null; fieldPrice: number; discount: number; totalPrice: number; payNow: number; paymentPlan: string }[];
  totals: { fieldPrice: number; discount: number; totalPrice: number; payNow: number; dueAtField: number };
};

export function SeriesClient({ lang, isMember, memberName, defaultDate }: { lang: Lang; isMember: boolean; memberName: string; defaultDate: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ fieldId: "A", startDate: defaultDate, startHour: 19, hours: "2", weeks: "8" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const body = () => ({ ...form, hours: Number(form.hours), weeks: Number(form.weeks) });
  const doPreview = async () => {
    setBusy(true);
    setError(null);
    const r = await api<{ preview: Preview }>(lang, "/api/series/preview", { body: body() });
    if (r.ok) setPreview(r.data.preview);
    else {
      setPreview(null);
      setError(r.error.message);
    }
    setBusy(false);
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await api<{ next: string }>(lang, "/api/series", { body: { ...body(), consent, confirmPartial: !!preview && preview.conflicts.length > 0 } });
    if (r.ok) {
      router.push(r.data.next);
      return;
    }
    setError(r.error.message);
    setBusy(false);
  };
  const upd = (k: string, v: string | number) => {
    setForm({ ...form, [k]: v });
    setPreview(null);
  };
  const hourOptions = [];
  for (let h = OPEN_HOUR; h <= LAST_START_HOUR; h++) hourOptions.push(h);

  return (
    <main className="page container">
      <Ready when={!busy} />
      <h1 className="page-title">{tx(lang, "จองประจำรายสัปดาห์", "Weekly recurring booking")}</h1>
      <p className="muted">
        {tx(
          lang,
          `วันและเวลาเดิมทุกสัปดาห์ ${SERIES_MIN_WEEKS}–${SERIES_MAX_WEEKS} สัปดาห์ · จองได้จริงตั้งแต่ 8 สัปดาห์ลดค่าสนาม 10% · จ่ายทุกสัปดาห์ครั้งเดียวตอนจอง`,
          `Same day and time every week for ${SERIES_MIN_WEEKS}–${SERIES_MAX_WEEKS} weeks · 10% off the field price when 8+ weeks are booked · pay all weeks at once`,
        )}
      </p>
      {!isMember ? (
        <div className="card" data-testid="series-login-required">
          <p style={{ marginTop: 0 }}>{msg(lang, "MEMBER_REQUIRED")}</p>
          <Link href="/my" className="btn" data-testid="series-go-login">
            {tx(lang, "เข้าสู่ระบบ / สมัครสมาชิก", "Log in / register")}
          </Link>
        </div>
      ) : (
        <div className="two-col">
          <section className="card form">
            <p className="small muted" style={{ margin: 0 }}>
              {tx(lang, "สมาชิก", "Member")}: <b>{memberName}</b>
            </p>
            <div className="form-grid">
              <label className="fld wide">
                <span>{tx(lang, "สนาม", "Field")}</span>
                <select data-testid="series-field" value={form.fieldId} onChange={(e) => upd("fieldId", e.target.value)}>
                  {["A", "B", "C"].map((f) => (
                    <option key={f} value={f}>
                      {fieldName(lang, f)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld">
                <span>{tx(lang, "สัปดาห์แรก", "First week")}</span>
                <input type="date" data-testid="series-start-date" value={form.startDate} onChange={(e) => upd("startDate", e.target.value)} />
              </label>
              <label className="fld">
                <span>{tx(lang, "เวลาเริ่ม", "Start time")}</span>
                <select data-testid="series-start" value={form.startHour} onChange={(e) => upd("startHour", Number(e.target.value))}>
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld">
                <span>{tx(lang, "ชั่วโมง", "Hours")}</span>
                <input type="number" min={1} data-testid="series-hours" value={form.hours} onChange={(e) => upd("hours", e.target.value)} />
              </label>
              <label className="fld">
                <span>{tx(lang, "จำนวนสัปดาห์", "Weeks")}</span>
                <input type="number" min={SERIES_MIN_WEEKS} max={SERIES_MAX_WEEKS} data-testid="series-weeks" value={form.weeks} onChange={(e) => upd("weeks", e.target.value)} />
              </label>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {/^\d{4}-\d{2}-\d{2}$/.test(form.startDate) && (
                <>
                  {tx(lang, "ทุกวัน", "Every ")}
                  {weekdayName(lang, weekdayOf(form.startDate))} · {timeRange(form.startHour, Number(form.hours) || 1)}
                </>
              )}
            </p>
            <ErrorBox message={error} />
            <button type="button" className="btn" data-testid="series-preview" onClick={doPreview} disabled={busy}>
              {tx(lang, "ตรวจสัปดาห์และดูราคา", "Check weeks and price")}
            </button>
          </section>

          <aside className="card">
            <h2>{tx(lang, "ตัวอย่างราคา", "Price preview")}</h2>
            {!preview && <p className="muted">{tx(lang, "กด “ตรวจสัปดาห์และดูราคา”", "Press “Check weeks and price”")}</p>}
            {preview && (
              <>
                <ul className="list" data-testid="series-weeks-list">
                  {preview.weeks.map((w) => (
                    <li key={w.week} className="spread" data-testid={`series-week-${w.week}`} data-status={w.status} data-date={w.date}>
                      <span>
                        {tx(lang, "สัปดาห์", "Week")} {w.week} · {fmtDate(lang, w.date)}
                      </span>
                      {w.status === "free" ? (
                        <Money lang={lang} value={w.payNow} />
                      ) : (
                        <span className="status-tag CANCELLED">{w.reason === "FIELD_CLOSED" ? msg(lang, "FIELD_CLOSED") : msg(lang, "SLOT_TAKEN")}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {preview.conflicts.length > 0 && (
                  <div className="alert info" style={{ marginTop: 12 }} data-testid="series-conflicts" data-value={preview.conflicts.join(",")}>
                    {tx(lang, "สัปดาห์ที่ชน", "Taken weeks")}: {preview.conflicts.map((d) => fmtDate(lang, d)).join(", ")}
                  </div>
                )}
                <dl className="price-list" style={{ marginTop: 12 }}>
                  <div>
                    <dt>{tx(lang, "สัปดาห์ที่จองได้จริง", "Weeks booked")}</dt>
                    <dd data-testid="series-weeks-booked" data-value={preview.weeksBooked}>
                      {preview.weeksBooked} / {preview.weeksRequested}
                    </dd>
                  </div>
                  <div>
                    <dt>{tx(lang, "ค่าสนามรวม", "Field price total")}</dt>
                    <dd>
                      <Money lang={lang} value={preview.totals.fieldPrice} testid="series-field-price" />
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {tx(lang, "ส่วนลด", "Discount")} <span data-testid="series-discount-percent" data-value={preview.discountPercent}>{preview.discountPercent}%</span>
                    </dt>
                    <dd>
                      <Money lang={lang} value={preview.totals.discount} testid="series-discount" />
                    </dd>
                  </div>
                  <div className="total">
                    <dt>{tx(lang, "ยอดรวม", "Total")}</dt>
                    <dd>
                      <Money lang={lang} value={preview.totals.totalPrice} testid="series-total-price" />
                    </dd>
                  </div>
                  <div className="paynow">
                    <dt>{tx(lang, "จ่ายตอนนี้ (ทุกสัปดาห์)", "Pay now (all weeks)")}</dt>
                    <dd>
                      <Money lang={lang} value={preview.totals.payNow} testid="series-pay-now" />
                    </dd>
                  </div>
                  <div>
                    <dt>{tx(lang, "เก็บหน้าสนามรวม", "Due at the field (total)")}</dt>
                    <dd>
                      <Money lang={lang} value={preview.totals.dueAtField} testid="series-due-at-field" />
                    </dd>
                  </div>
                </dl>
                <label className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" data-testid="series-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>{tx(lang, "ยินยอมให้ร้านเก็บชื่อและเบอร์โทรเพื่อจัดการการจอง (PDPA)", "I agree that the shop may keep my name and phone number to manage these bookings (PDPA)")}</span>
                </label>
                <button type="button" className="btn yellow block" style={{ marginTop: 12 }} data-testid="series-submit" onClick={submit} disabled={busy || preview.weeksBooked === 0}>
                  {preview.conflicts.length > 0
                    ? tx(lang, `จองเฉพาะสัปดาห์ที่ว่าง (${preview.weeksBooked} สัปดาห์)`, `Book only the free weeks (${preview.weeksBooked})`)
                    : tx(lang, `จองทั้ง ${preview.weeksBooked} สัปดาห์`, `Book all ${preview.weeksBooked} weeks`)}
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
