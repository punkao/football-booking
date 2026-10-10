"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SampleQr } from "@/components/Art";
import { PhoneGate } from "@/components/PhoneGate";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { api, mmss } from "@/lib/client";
import { fieldName, fmtDate, msg, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Detail = {
  booking: { code: string; status: string; fieldId: string; date: string; startHour: number; hours: number; payNow: number; dueAtField: number; series: { bookings: { code: string }[] } | null };
  secondsLeft: number;
  payTotal: number;
};

export function PayClient({ lang, code }: { lang: Lang; code: string }) {
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [left, setLeft] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Detail>(lang, `/api/bookings/${encodeURIComponent(code)}`);
    if (r.ok) {
      setData(r.data);
      setLeft(r.data.secondsLeft);
      setLocked(null);
    } else if (r.status === 403) setLocked(r.error.message);
    else setNotFound(r.error.message);
    setLoading(false);
  }, [lang, code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  useEffect(() => {
    if (!data || data.booking.status !== "PENDING_PAYMENT") return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [data]);

  const pay = async () => {
    setPaying(true);
    setError(null);
    const r = await api(lang, `/api/bookings/${encodeURIComponent(code)}/pay`, { body: {} });
    if (r.ok) {
      router.push(`/booking/${encodeURIComponent(code)}?done=paid`);
      return;
    }
    setError(r.error.message);
    setPaying(false);
    void load();
  };

  const b = data?.booking;
  return (
    <main className="page container">
      <Ready when={!loading && !paying} />
      <h1 className="page-title">{tx(lang, "ชำระเงินด้วยพร้อมเพย์", "Pay with PromptPay")}</h1>
      {notFound && <ErrorBox message={notFound} />}
      {locked && <PhoneGate lang={lang} code={code} onUnlocked={load} />}
      {b && (
        <div className="two-col">
          <section className="card" style={{ textAlign: "center" }}>
            <p className="muted" style={{ marginTop: 0 }}>
              {tx(lang, "รหัสการจอง", "Booking code")} <span className="code-pill" data-testid="booking-code">{b.code}</span>
            </p>
            {b.status === "PENDING_PAYMENT" ? (
              <>
                <div className="qr-box">
                  <SampleQr seed={b.code} title={tx(lang, "QR พร้อมเพย์ตัวอย่าง (จำลอง ไม่ใช่การจ่ายจริง)", "Sample PromptPay QR (simulation, not a real payment)")} />
                </div>
                <p className="small muted">{tx(lang, "QR ตัวอย่างสำหรับการจำลองเท่านั้น", "Sample QR for simulation only")}</p>
                <p style={{ margin: "6px 0" }}>{tx(lang, "ยอดที่ต้องจ่ายตอนนี้", "Amount to pay now")}</p>
                <div className="countdown" style={{ color: "var(--grass-2)" }}>
                  <Money lang={lang} value={data.payTotal} testid="pay-now-amount" />
                </div>
                <p style={{ margin: "12px 0 0" }}>{tx(lang, "เวลาที่เหลือ", "Time left")}</p>
                <div className={`countdown${left < 120 ? " low" : ""}`} data-testid="pay-countdown" data-value={left} aria-live="polite">
                  {mmss(left)}
                </div>
                <ErrorBox message={error} />
                <button type="button" className="btn yellow block" style={{ marginTop: 14 }} data-testid="pay-confirm" onClick={pay} disabled={paying}>
                  {paying ? tx(lang, "กำลังยืนยัน…", "Confirming…") : tx(lang, "ฉันโอนแล้ว ยืนยันการจ่าย", "I have paid — confirm payment")}
                </button>
              </>
            ) : b.status === "EXPIRED" ? (
              <>
                <div className="alert error" role="alert" data-testid="pay-expired">
                  {msg(lang, "PAYMENT_EXPIRED")}
                </div>
                <p>
                  <Link href={`/book?date=${b.date}`} className="btn" data-testid="pay-rebook">
                    {tx(lang, "เลือกรอบใหม่", "Choose another slot")}
                  </Link>
                </p>
              </>
            ) : (
              <>
                <div className="alert ok" data-testid="pay-already">
                  {tx(lang, "การจองนี้ไม่ต้องชำระเงินแล้ว", "This booking needs no payment now")}
                </div>
                <ErrorBox message={error} />
                <p>
                  <Link href={`/booking/${b.code}`} className="btn" data-testid="pay-view-booking">
                    {tx(lang, "ดูการจอง", "View booking")}
                  </Link>
                </p>
              </>
            )}
          </section>
          <aside className="card">
            <h2>{tx(lang, "รายละเอียด", "Details")}</h2>
            <ul className="list">
              <li data-testid="pay-field">{fieldName(lang, b.fieldId)}</li>
              <li data-testid="pay-date">{fmtDate(lang, b.date)}</li>
              <li data-testid="pay-time">{timeRange(b.startHour, b.hours)}</li>
              {b.series && (
                <li data-testid="pay-series-count">
                  {tx(lang, "จองประจำ", "Recurring")} · {b.series.bookings.length} {tx(lang, "สัปดาห์", "weeks")}
                </li>
              )}
              <li>
                {tx(lang, "เก็บหน้าสนาม", "Pay at the field")}: <Money lang={lang} value={b.dueAtField} testid="pay-due-at-field" />
              </li>
            </ul>
          </aside>
        </div>
      )}
    </main>
  );
}
