"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorBox, Money, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { fieldName, fmtDate, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Split = {
  booking: { code: string; fieldId: string; date: string; startHour: number; hours: number; netPrice: number; ownerName: string };
  perPerson: number;
  people: number;
  paidCount: number;
  shares: { id: number; memberName: string; amount: number; paid: boolean }[];
};

export function SplitClient({ lang, token }: { lang: Lang; token: string }) {
  const [data, setData] = useState<Split | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await api<Split>(lang, `/api/split/${encodeURIComponent(token)}`);
    if (r.ok) setData(r.data);
    else setError(r.error.message);
    setBusy(false);
  }, [lang, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const toggle = async (id: number, paid: boolean) => {
    setBusy(true);
    const r = await api<Split>(lang, `/api/split/${encodeURIComponent(token)}/${id}/paid`, { body: { paid } });
    if (r.ok) setData(r.data);
    else setError(r.error.message);
    setBusy(false);
  };

  return (
    <main className="page container">
      <Ready when={!busy} />
      <h1 className="page-title">{tx(lang, "หารค่าสนาม", "Split the field fee")}</h1>
      <ErrorBox message={error} />
      {data && (
        <div className="two-col">
          <section className="card">
            <p className="muted" style={{ marginTop: 0 }}>
              {fieldName(lang, data.booking.fieldId)} · {fmtDate(lang, data.booking.date)} · {timeRange(data.booking.startHour, data.booking.hours)}
            </p>
            <p>
              {tx(lang, "ยอดสุทธิ", "Net total")} <Money lang={lang} value={data.booking.netPrice} testid="split-net" /> ÷ <b data-testid="split-people" data-value={data.people}>
                {data.people}
              </b>{" "}
              {tx(lang, "คน", "people")}
            </p>
            <div className="kpi" style={{ maxWidth: 260 }}>
              <div className="k">{tx(lang, "ยอดต่อคน", "Per person")}</div>
              <div className="v">
                <Money lang={lang} value={data.perPerson} testid="split-per-person" />
              </div>
            </div>
            <p className="small muted">
              {tx(
                lang,
                "ร้านแสดงสถานะเท่านั้น ไม่รับเงินจากลูกทีม · ลูกทีมโอนให้คนจองโดยตรง",
                "The shop only shows the status and does not collect money from team members · pay the organiser directly",
              )}
            </p>
          </section>
          <aside className="card">
            <h2>
              {tx(lang, "สถานะรายคน", "Status per person")} (<span data-testid="split-paid-count" data-value={data.paidCount}>
                {data.paidCount}
              </span>
              /{data.people})
            </h2>
            <ul className="list">
              {data.shares.map((s, i) => (
                <li key={s.id} className="spread" data-testid={`split-share-${i + 1}`} data-paid={s.paid}>
                  <span>{s.memberName}</span>
                  <Money lang={lang} value={s.amount} />
                  <button
                    type="button"
                    className={`btn small ${s.paid ? "ghost" : ""}`}
                    data-testid={`split-toggle-${i + 1}`}
                    onClick={() => toggle(s.id, !s.paid)}
                    disabled={busy}
                    aria-pressed={s.paid}
                  >
                    {s.paid ? tx(lang, "จ่ายแล้ว ✓", "Paid ✓") : tx(lang, "ยังไม่จ่าย · กดเมื่อจ่ายแล้ว", "Not paid · mark paid")}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </main>
  );
}
