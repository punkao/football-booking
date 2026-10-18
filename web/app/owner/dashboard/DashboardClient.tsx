"use client";

import Link from "next/link";
import { useState } from "react";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { fieldName, fmtDate, money, statusLabel, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Day = { date: string; bookingMoney: number; salesCash: number; salesPromptpay: number; salesMoney: number; total: number };
type Dash = {
  date: string;
  today: Day & { creditUsed: number };
  week: Day[];
  weekTotal: number;
  utilization: { fieldId: string; hours: number; percent: number }[];
  popularHours: { hour: number; count: number }[];
  bookingsByStatus: Record<string, number>;
  lowStockCount: number;
};

/** FR-42: 7-day money as SVG bars (no chart library) — every bar has data-value for tests */
function WeekChart({ lang, days, today }: { lang: Lang; days: Day[]; today: string }) {
  const W = 560;
  const H = 220;
  const pad = { l: 8, r: 8, t: 24, b: 40 };
  const max = Math.max(1, ...days.map((d) => d.total));
  const bw = (W - pad.l - pad.r) / days.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx(lang, "กราฟยอดเงิน 7 วันล่าสุด", "Money of the last 7 days")} data-testid="dash-chart">
      <title>{tx(lang, "ยอดเงิน 7 วันล่าสุด", "Money of the last 7 days")}</title>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#0B3D2E" strokeOpacity="0.3" />
      {days.map((d, i) => {
        const h = ((H - pad.t - pad.b) * d.total) / max;
        const x = pad.l + i * bw + bw * 0.18;
        const y = H - pad.b - h;
        return (
          <g key={d.date} data-testid={`dash-bar-${d.date}`} data-value={d.total}>
            <rect className={`bar${d.date === today ? " today" : ""}`} x={x} y={y} width={bw * 0.64} height={Math.max(h, d.total > 0 ? 2 : 0)} rx="4">
              <title>{`${fmtDate(lang, d.date)}: ${money(lang, d.total)}`}</title>
            </rect>
            <text x={x + bw * 0.32} y={y - 6} textAnchor="middle">
              {d.total > 0 ? d.total.toLocaleString("en-US") : "0"}
            </text>
            <text x={x + bw * 0.32} y={H - pad.b + 16} textAnchor="middle">
              {fmtDate(lang, d.date).split(" ").slice(0, 2).join(" ")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DashboardClient({ lang, role }: { lang: Lang; role: string }) {
  const [date, setDate] = useState("");
  const { data, error, busy } = useLoad<Dash>(lang, `/api/owner/dashboard${date ? `?date=${date}` : ""}`);
  const maxHour = Math.max(1, ...(data?.popularHours.map((h) => h.count) ?? [1]));
  return (
    <main className="page container">
      <Ready when={!busy && !!data} />
      <h1 className="page-title">{tx(lang, "แดชบอร์ด", "Dashboard")}</h1>
      <BackTabs lang={lang} role={role} />
      <div className="toolbar">
        <label className="fld" style={{ maxWidth: 200 }}>
          <span>{tx(lang, "วันที่", "Date")}</span>
          <input type="date" data-testid="dash-date" value={date || data?.date || ""} onChange={(e) => setDate(e.target.value)} />
        </label>
        {data && <span className="muted">{fmtDate(lang, data.date)}</span>}
      </div>
      <ErrorBox message={error} />
      {data && (
        <div className="stack">
          <div className="kpis">
            <div className="kpi">
              <div className="k">{tx(lang, "ยอดเงินวันนี้", "Money today")}</div>
              <div className="v">
                <Money lang={lang} value={data.today.total} testid="dash-today-total" />
              </div>
            </div>
            <div className="kpi">
              <div className="k">{tx(lang, "จากการจอง", "From bookings")}</div>
              <div className="v">
                <Money lang={lang} value={data.today.bookingMoney} testid="dash-today-booking-money" />
              </div>
            </div>
            <div className="kpi">
              <div className="k">{tx(lang, "ขายหน้าเคาน์เตอร์", "Counter sales")}</div>
              <div className="v">
                <Money lang={lang} value={data.today.salesMoney} testid="dash-today-sales" />
              </div>
            </div>
            <div className="kpi">
              <div className="k">{tx(lang, "หักเครดิต (ไม่ใช่รายได้)", "Credit used (not income)")}</div>
              <div className="v">
                <Money lang={lang} value={data.today.creditUsed} testid="dash-today-credit" />
              </div>
            </div>
            <div className="kpi">
              <div className="k">{tx(lang, "ของใกล้หมด", "Low stock")}</div>
              <div className="v" data-testid="dash-low-stock" data-value={data.lowStockCount}>
                {data.lowStockCount > 0 ? <Link href="/staff/stock" style={{ color: "inherit" }}>{data.lowStockCount}</Link> : 0}
              </div>
            </div>
          </div>

          <section className="card">
            <h2>
              {tx(lang, "ยอดเงิน 7 วัน", "Money, 7 days")} · <Money lang={lang} value={data.weekTotal} testid="dash-week-total" />
            </h2>
            <WeekChart lang={lang} days={data.week} today={data.date} />
          </section>

          <div className="cards">
            <section className="card">
              <h2>{tx(lang, "อัตราการใช้สนามวันนี้", "Field use today")}</h2>
              <ul className="list">
                {data.utilization.map((u) => (
                  <li key={u.fieldId}>
                    <div className="spread">
                      <span>{fieldName(lang, u.fieldId)}</span>
                      <b data-testid={`dash-util-${u.fieldId}`} data-value={u.percent}>
                        {u.percent}%
                      </b>
                    </div>
                    <div className="meter" aria-hidden="true">
                      <span style={{ width: `${u.percent}%` }} />
                    </div>
                    <span className="small muted">
                      {u.hours} / 16 {tx(lang, "ชั่วโมง", "hours")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2>{tx(lang, "ชั่วโมงที่จองมาก (7 วัน)", "Popular start hours (7 days)")}</h2>
              <ul className="list" data-testid="dash-hours">
                {data.popularHours.map((h) => (
                  <li key={h.hour} className="spread" data-testid={`dash-hour-${h.hour}`} data-value={h.count}>
                    <span style={{ width: 56 }}>{String(h.hour).padStart(2, "0")}:00</span>
                    <span className="meter" style={{ flex: 1, margin: "0 10px" }} aria-hidden="true">
                      <span style={{ width: `${(h.count / maxHour) * 100}%` }} />
                    </span>
                    <b>{h.count}</b>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2>{tx(lang, "การจองของวันนี้ (วันเตะ)", "Bookings played today")}</h2>
              <ul className="list" data-testid="dash-status">
                {Object.keys(data.bookingsByStatus).length === 0 && <li className="muted">{tx(lang, "ไม่มี", "None")}</li>}
                {Object.entries(data.bookingsByStatus).map(([s, n]) => (
                  <li key={s} className="spread" data-testid={`dash-status-${s}`} data-value={n}>
                    <span className={`status-tag ${s}`}>{statusLabel(lang, s)}</span> <b>{n}</b>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
