"use client";

import Link from "next/link";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { METHOD_LABEL, fieldName, fmtDate, fmtDateTime, label, statusLabel, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Data = {
  booking: { code: string; fieldId: string; date: string; startHour: number; hours: number; status: string; totalPrice: number; amountPaid: number; dueAtField: number; customerName: string; phone: string };
  payments: { amount: number; method: string; paidAt: string }[];
  history: { fromStatus: string | null; toStatus: string; actor: string; actorLabel: string; at: string }[];
};

// FR-43 · BR-42: full status history (from → to · who · when) — read only
export function BookingHistoryClient({ lang, role, code }: { lang: Lang; role: string; code: string }) {
  const { data, error, busy } = useLoad<Data>(lang, `/api/owner/bookings/${encodeURIComponent(code)}/history`);
  const b = data?.booking;
  return (
    <main className="page container">
      <Ready when={!busy && (!!data || !!error)} />
      <h1 className="page-title">
        {tx(lang, "ประวัติการจอง", "Booking history")} <span className="code-pill">{code}</span>
      </h1>
      <BackTabs lang={lang} role={role} />
      <p>
        <Link href="/owner/bookings" data-testid="history-back">
          ← {tx(lang, "การจองทั้งหมด", "All bookings")}
        </Link>
      </p>
      <ErrorBox message={error} />
      {b && (
        <div className="stack">
          <section className="card">
            <div className="spread">
              <b>
                {fieldName(lang, b.fieldId)} · {fmtDate(lang, b.date)} {timeRange(b.startHour, b.hours)}
              </b>
              <span className={`status-tag ${b.status}`} data-testid="history-status" data-value={b.status}>
                {statusLabel(lang, b.status)}
              </span>
            </div>
            <p style={{ marginBottom: 0 }}>
              {b.customerName} · {b.phone} · {tx(lang, "ยอดรวม", "Total")} <Money lang={lang} value={b.totalPrice} testid="history-total" /> ·{" "}
              {tx(lang, "จ่ายแล้ว", "Paid")} <Money lang={lang} value={b.amountPaid} testid="history-paid" /> · {tx(lang, "ค้าง", "Due")}{" "}
              <Money lang={lang} value={b.dueAtField} testid="history-due" />
            </p>
          </section>
          <section className="card">
            <h2>{tx(lang, "ประวัติสถานะ", "Status history")}</h2>
            <div className="table-wrap">
              <table className="data-table" data-testid="history-table" data-count={data!.history.length}>
                <thead>
                  <tr>
                    <th>{tx(lang, "เวลา", "Time")}</th>
                    <th>{tx(lang, "จาก", "From")}</th>
                    <th>{tx(lang, "เป็น", "To")}</th>
                    <th>{tx(lang, "ผู้ทำ", "By")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.history.map((h, i) => (
                    <tr key={i} data-testid={`history-row-${i}`}>
                      <td data-testid={`history-at-${i}`} data-value={h.at}>
                        {fmtDateTime(lang, h.at)}
                      </td>
                      <td data-testid={`history-from-${i}`} data-value={h.fromStatus ?? ""}>
                        {h.fromStatus ? statusLabel(lang, h.fromStatus) : "–"}
                      </td>
                      <td data-testid={`history-to-${i}`} data-value={h.toStatus}>
                        {statusLabel(lang, h.toStatus)}
                      </td>
                      <td data-testid={`history-actor-${i}`} data-value={h.actor}>
                        {h.actorLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h2>{tx(lang, "การชำระเงิน", "Payments")}</h2>
            <ul className="list" data-testid="history-payments">
              {data!.payments.map((p, i) => (
                <li key={i} className="spread">
                  <span>
                    {fmtDateTime(lang, p.paidAt)} · {label(lang, METHOD_LABEL, p.method)}
                  </span>
                  <Money lang={lang} value={p.amount} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
