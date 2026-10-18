"use client";

import Link from "next/link";
import { useState } from "react";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { EmptyNet } from "@/components/Art";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { fieldName, fmtDate, statusLabel, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Row = { code: string; fieldId: string; date: string; startHour: number; hours: number; status: string; totalPrice: number; amountPaid: number; dueAtField: number; customerName: string; phone: string };

// FR-43: search every booking by code / phone / day of play
export function BookingsClient({ lang, role }: { lang: Lang; role: string }) {
  const [form, setForm] = useState({ code: "", phone: "", date: "" });
  const [query, setQuery] = useState("");
  const { data, error, busy } = useLoad<{ bookings: Row[] }>(lang, `/api/owner/bookings${query}`);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (form.code.trim()) p.set("code", form.code.trim());
    if (form.phone.trim()) p.set("phone", form.phone.trim());
    if (form.date) p.set("date", form.date);
    setQuery(p.size ? `?${p}` : "");
  };
  return (
    <main className="page container">
      <Ready when={!busy && !!data} />
      <h1 className="page-title">{tx(lang, "การจองทั้งหมด", "All bookings")}</h1>
      <BackTabs lang={lang} role={role} />
      <form className="card form form-grid" onSubmit={submit} style={{ marginBottom: 16 }}>
        <label className="fld">
          <span>{tx(lang, "รหัสการจอง", "Booking code")}</span>
          <input data-testid="bk-search-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="LN-…" />
        </label>
        <label className="fld">
          <span>{tx(lang, "เบอร์โทร", "Phone")}</span>
          <input data-testid="bk-search-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="fld">
          <span>{tx(lang, "วันเตะ", "Day of play")}</span>
          <input data-testid="bk-search-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <div style={{ alignSelf: "end" }}>
          <button className="btn" type="submit" data-testid="bk-search-submit">
            {tx(lang, "ค้นหา", "Search")}
          </button>
        </div>
      </form>
      <ErrorBox message={error} />
      {data && data.bookings.length === 0 && (
        <p className="muted" data-testid="bk-empty">
          <EmptyNet title={tx(lang, "ไม่พบการจอง", "No bookings")} /> {tx(lang, "ไม่พบการจอง", "No bookings found")}
        </p>
      )}
      {data && data.bookings.length > 0 && (
        <div className="table-wrap card">
          <table className="data-table" data-testid="bk-results" data-count={data.bookings.length}>
            <thead>
              <tr>
                <th>{tx(lang, "รหัส", "Code")}</th>
                <th>{tx(lang, "สนาม / วันเวลา", "Field / when")}</th>
                <th>{tx(lang, "ผู้จอง", "Customer")}</th>
                <th>{tx(lang, "สถานะ", "Status")}</th>
                <th className="num">{tx(lang, "ยอดรวม", "Total")}</th>
                <th className="num">{tx(lang, "จ่ายแล้ว", "Paid")}</th>
              </tr>
            </thead>
            <tbody>
              {data.bookings.map((b) => (
                <tr key={b.code} data-testid={`bk-row-${b.code}`}>
                  <td>
                    <Link href={`/owner/bookings/${b.code}`} data-testid={`bk-link-${b.code}`}>
                      {b.code}
                    </Link>
                  </td>
                  <td>
                    {fieldName(lang, b.fieldId)} · {fmtDate(lang, b.date)} {timeRange(b.startHour, b.hours)}
                  </td>
                  <td>
                    {b.customerName}
                    <div className="small muted">{b.phone}</div>
                  </td>
                  <td>
                    <span className={`status-tag ${b.status}`} data-testid={`bk-status-${b.code}`} data-value={b.status}>
                      {statusLabel(lang, b.status)}
                    </span>
                  </td>
                  <td className="num">
                    <Money lang={lang} value={b.totalPrice} />
                  </td>
                  <td className="num">
                    <Money lang={lang} value={b.amountPaid} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
