"use client";

import { useState } from "react";
import { BackTabs } from "@/components/BackOffice";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { fmtDate, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Day = {
  date: string;
  bookingMoney: number;
  salesCash: number;
  salesPromptpay: number;
  salesMoney: number;
  total: number;
  creditUsed: number;
  bookings: number;
  noShow: number;
};
type Report = {
  from: string;
  to: string;
  days: Day[];
  totals: { bookingMoney: number; salesCash: number; salesPromptpay: number; salesMoney: number; total: number; creditUsed: number; bookings: number; noShow: number };
};

// FR-44 · BR-39 / BR-40 (OWNER only): money by the day it was received · bookings by the day of play · CSV for Excel
export function ReportsClient({ lang, role }: { lang: Lang; role: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<Report>(lang, `/api/owner/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (r.ok) setData(r.data);
    else {
      setData(null);
      setError(r.error.message);
    }
    setBusy(false);
  };

  return (
    <main className="page container">
      <Ready when={!busy} />
      <h1 className="page-title">{tx(lang, "รายงาน", "Reports")}</h1>
      <BackTabs lang={lang} role={role} />
      <form className="card form form-grid" onSubmit={submit} style={{ marginBottom: 16 }}>
        <label className="fld">
          <span>{tx(lang, "วันเริ่ม", "From")}</span>
          <input type="date" data-testid="report-from" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </label>
        <label className="fld">
          <span>{tx(lang, "วันสิ้นสุด", "To")}</span>
          <input type="date" data-testid="report-to" value={to} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <div style={{ alignSelf: "end" }}>
          <button type="submit" className="btn" data-testid="report-submit" disabled={busy}>
            {tx(lang, "ดูรายงาน", "Show report")}
          </button>
        </div>
        <p className="small muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
          {tx(
            lang,
            "ช่วงไม่เกิน 3 เดือน · ยอดเงินนับตามวันที่รับเงิน · จำนวนการจองนับตามวันเตะ · เครดิตที่ลูกค้าใช้ไม่นับเป็นรายได้",
            "At most 3 months · money by the day it was received · bookings by the day of play · credit used is not income",
          )}
        </p>
      </form>
      <ErrorBox message={error} testid="report-error" />
      {data && (
        <section className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>
              {fmtDate(lang, data.from)} – {fmtDate(lang, data.to)}
            </h2>
            <a className="btn ghost small" data-testid="report-csv" href={`/api/owner/reports.csv?from=${data.from}&to=${data.to}`} download>
              {tx(lang, "ดาวน์โหลด CSV (Excel)", "Download CSV (Excel)")}
            </a>
          </div>
          <div className="table-wrap">
            <table className="data-table" data-testid="report-table" data-count={data.days.length}>
              <thead>
                <tr>
                  <th>{tx(lang, "วันที่", "Date")}</th>
                  <th className="num">{tx(lang, "ยอดจอง", "Bookings money")}</th>
                  <th className="num">{tx(lang, "ขายเงินสด", "Sales cash")}</th>
                  <th className="num">{tx(lang, "ขายพร้อมเพย์", "Sales PromptPay")}</th>
                  <th className="num">{tx(lang, "รวมรับเงิน", "Total money")}</th>
                  <th className="num">{tx(lang, "หักเครดิต", "Credit used")}</th>
                  <th className="num">{tx(lang, "การจอง (วันเตะ)", "Bookings (played)")}</th>
                  <th className="num">{tx(lang, "ไม่มา", "No-show")}</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.date} data-testid={`report-row-${d.date}`}>
                    <td>{fmtDate(lang, d.date)}</td>
                    <td className="num"><Money lang={lang} value={d.bookingMoney} testid={`report-${d.date}-booking`} /></td>
                    <td className="num"><Money lang={lang} value={d.salesCash} testid={`report-${d.date}-cash`} /></td>
                    <td className="num"><Money lang={lang} value={d.salesPromptpay} testid={`report-${d.date}-promptpay`} /></td>
                    <td className="num"><b><Money lang={lang} value={d.total} testid={`report-${d.date}-total`} /></b></td>
                    <td className="num"><Money lang={lang} value={d.creditUsed} testid={`report-${d.date}-credit`} /></td>
                    <td className="num" data-testid={`report-${d.date}-bookings`} data-value={d.bookings}>{d.bookings}</td>
                    <td className="num" data-testid={`report-${d.date}-noshow`} data-value={d.noShow}>{d.noShow}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr data-testid="report-totals">
                  <td>{tx(lang, "รวม", "Total")}</td>
                  <td className="num"><Money lang={lang} value={data.totals.bookingMoney} testid="report-total-booking" /></td>
                  <td className="num"><Money lang={lang} value={data.totals.salesCash} testid="report-total-cash" /></td>
                  <td className="num"><Money lang={lang} value={data.totals.salesPromptpay} testid="report-total-promptpay" /></td>
                  <td className="num"><Money lang={lang} value={data.totals.total} testid="report-total-money" /></td>
                  <td className="num"><Money lang={lang} value={data.totals.creditUsed} testid="report-total-credit" /></td>
                  <td className="num" data-testid="report-total-bookings" data-value={data.totals.bookings}>{data.totals.bookings}</td>
                  <td className="num" data-testid="report-total-noshow" data-value={data.totals.noShow}>{data.totals.noShow}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
