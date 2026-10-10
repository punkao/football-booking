"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { fmtDate, rentalName, statusLabel, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Cell = { fieldId: string; closed: boolean; booking: { code: string; status: string; customerName: string; amountPaid: number; dueAtField: number; startHour: number; hours: number } | null };
type Today = {
  date: string;
  fields: { id: string }[];
  rows: { hour: number; cells: Cell[]; rentals: Record<string, number> }[];
  totals: { bookings: number; amountPaid: number; dueAtField: number };
};

export function TodayClient({ lang }: { lang: Lang }) {
  const [date, setDate] = useState<string | null>(null);
  const [data, setData] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(
    async (d: string | null) => {
      setBusy(true);
      const r = await api<Today>(lang, `/api/staff/today${d ? `?date=${d}` : ""}`);
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else setError(r.error.message);
      setBusy(false);
    },
    [lang],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on date change
    void load(date);
  }, [date, load]);

  return (
    <main className="page container">
      <Ready when={!busy && !!data} />
      <h1 className="page-title">{tx(lang, "ภาพรวมวันนี้", "Today's overview")}</h1>
      <div className="toolbar">
        <label className="fld" style={{ maxWidth: 200 }}>
          <span>{tx(lang, "วันที่", "Date")}</span>
          <input type="date" data-testid="today-date" value={data?.date ?? ""} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        {data && <span className="muted">{fmtDate(lang, data.date)}</span>}
      </div>
      <ErrorBox message={error} />
      {data && (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi">
              <div className="k">{tx(lang, "การจอง", "Bookings")}</div>
              <div className="v" data-testid="today-total-bookings" data-value={data.totals.bookings}>
                {data.totals.bookings}
              </div>
            </div>
            <div className="kpi">
              <div className="k">{tx(lang, "จ่ายแล้ว", "Paid")}</div>
              <div className="v">
                <Money lang={lang} value={data.totals.amountPaid} testid="today-total-paid" />
              </div>
            </div>
            <div className="kpi">
              <div className="k">{tx(lang, "ค้างเก็บหน้าสนาม", "Due at the field")}</div>
              <div className="v">
                <Money lang={lang} value={data.totals.dueAtField} testid="today-total-due" />
              </div>
            </div>
          </div>
          <div className="today-grid" data-testid="today-grid">
            <div />
            {data.fields.map((f) => (
              <div key={f.id} className="hour" style={{ alignItems: "center" }}>
                {f.id}
              </div>
            ))}
            {data.rows.map((r) => (
              <div key={r.hour} style={{ display: "contents" }}>
                <div className="hour">{String(r.hour).padStart(2, "0")}:00</div>
                {r.cells.map((c) => (
                  <div
                    key={c.fieldId}
                    className={`cell${c.booking ? " has" : ""}${c.closed ? " closed" : ""}`}
                    data-testid={`today-slot-${c.fieldId}-${r.hour}`}
                    data-status={c.booking?.status ?? (c.closed ? "CLOSED" : "FREE")}
                  >
                    {c.booking ? (
                      <>
                        <Link href={`/staff?code=${c.booking.code}`}>{c.booking.code}</Link>
                        <div>{c.booking.customerName}</div>
                        <div className={`status-tag ${c.booking.status}`} style={{ fontSize: "0.68rem" }}>
                          {statusLabel(lang, c.booking.status)}
                        </div>
                        {c.booking.startHour === r.hour && (
                          <div>
                            {tx(lang, "ค้าง", "Due")} <Money lang={lang} value={c.booking.dueAtField} />
                          </div>
                        )}
                      </>
                    ) : c.closed ? (
                      tx(lang, "ปิดเพราะฝน", "Rain closed")
                    ) : (
                      <span className="muted">{tx(lang, "ว่าง", "Free")}</span>
                    )}
                  </div>
                ))}
                <div className="rent" data-testid={`today-rentals-${r.hour}`}>
                  {Object.entries(r.rentals).map(([k, v]) => (
                    <span key={k} style={{ marginRight: 10 }}>
                      {rentalName(lang, k)} {tx(lang, "เหลือ", "left")}{" "}
                      <b data-testid={`today-rental-${k}-${r.hour}`} data-value={v}>
                        {v}
                      </b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
