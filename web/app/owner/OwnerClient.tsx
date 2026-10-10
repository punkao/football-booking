"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorBox, Money, OkBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { fieldName, fmtDate, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { FIELDS_RAIN_CLOSABLE } from "@/lib/rules";

type Holiday = { date: string; name: string };
type Closure = { id: number; fieldId: string; date: string; fromHour: number; toHour: number };

export function OwnerClient({ lang }: { lang: Lang }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [hForm, setHForm] = useState({ date: "", name: "" });
  const [cForm, setCForm] = useState({ fieldId: "A", date: "", fromHour: 17, toHour: 19 });
  const [result, setResult] = useState<{ code: string; credit: number; challengeCredit?: number }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const [h, c] = await Promise.all([api<{ holidays: Holiday[] }>(lang, "/api/owner/holidays"), api<{ closures: Closure[] }>(lang, "/api/owner/closures")]);
    if (h.ok) setHolidays(h.data.holidays);
    if (c.ok) setClosures(c.data.closures);
    if (!h.ok) setError(h.error.message);
    setBusy(false);
  }, [lang]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const run = async (path: string, method: string, body?: unknown, after?: (d: Record<string, unknown>) => void) => {
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await api<Record<string, unknown>>(lang, path, { method, body });
    if (r.ok) {
      setOk(String(r.data.message ?? ""));
      after?.(r.data);
    } else setError(r.error.message);
    await load();
  };

  const hours = Array.from({ length: 17 }, (_, i) => i + 8);
  return (
    <main className="page container">
      <Ready when={!busy} />
      <h1 className="page-title">{tx(lang, "เจ้าของร้าน", "Owner")}</h1>
      <OkBox message={ok} />
      <ErrorBox message={error} />
      <div className="cards" style={{ marginTop: 12 }}>
        <section className="card">
          <h2>{tx(lang, "วันหยุดนักขัตฤกษ์", "Public holidays")}</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            {tx(lang, "วันหยุดคิดราคาเย็นทุกรอบ (มีผลกับการจองใหม่)", "Holidays use the evening rate all day (applies to new bookings)")}
          </p>
          <ul className="list" data-testid="holiday-list">
            {holidays.map((h) => (
              <li key={h.date} className="spread" data-testid={`holiday-${h.date}`}>
                <span>
                  <b>{fmtDate(lang, h.date)}</b> · {h.name}
                </span>
                <button
                  type="button"
                  className="btn ghost small"
                  data-testid={`holiday-delete-${h.date}`}
                  aria-label={tx(lang, `ลบวันหยุด ${fmtDate(lang, h.date, false)}`, `Delete holiday ${fmtDate(lang, h.date, false)}`)}
                  onClick={() => run(`/api/owner/holidays?date=${h.date}`, "DELETE")}
                  disabled={busy}
                >
                  {tx(lang, "ลบ", "Delete")}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="form"
            style={{ marginTop: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              void run("/api/owner/holidays", "POST", hForm, () => setHForm({ date: "", name: "" }));
            }}
          >
            <div className="form-grid">
              <label className="fld">
                <span>{tx(lang, "วันที่", "Date")}</span>
                <input type="date" data-testid="holiday-date" value={hForm.date} onChange={(e) => setHForm({ ...hForm, date: e.target.value })} />
              </label>
              <label className="fld">
                <span>{tx(lang, "ชื่อวันหยุด", "Holiday name")}</span>
                <input type="text" data-testid="holiday-name" value={hForm.name} onChange={(e) => setHForm({ ...hForm, name: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="btn" data-testid="holiday-add" disabled={busy}>
              {tx(lang, "เพิ่มวันหยุด", "Add holiday")}
            </button>
          </form>
        </section>

        <section className="card">
          <h2>{tx(lang, "ปิดสนามเพราะฝน", "Close a field for rain")}</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            {tx(lang, "ปิดได้เฉพาะสนามกลางแจ้ง A, B · การจองที่ยืนยันแล้วในช่วงนี้ได้เครดิตคืนเต็มจำนวน", "Only outdoor fields A and B · confirmed bookings in the range get full credit back")}
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              setResult(null);
              void run("/api/owner/closures", "POST", cForm, (d) => setResult((d.affected as { code: string; credit: number; challengeCredit?: number }[]) ?? []));
            }}
          >
            <div className="form-grid">
              <label className="fld">
                <span>{tx(lang, "สนาม", "Field")}</span>
                <select data-testid="closure-field" value={cForm.fieldId} onChange={(e) => setCForm({ ...cForm, fieldId: e.target.value })}>
                  {FIELDS_RAIN_CLOSABLE.map((f) => (
                    <option key={f} value={f}>
                      {fieldName(lang, f)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld">
                <span>{tx(lang, "วันที่", "Date")}</span>
                <input type="date" data-testid="closure-date" value={cForm.date} onChange={(e) => setCForm({ ...cForm, date: e.target.value })} />
              </label>
              <label className="fld">
                <span>{tx(lang, "ตั้งแต่", "From")}</span>
                <select data-testid="closure-from" value={cForm.fromHour} onChange={(e) => setCForm({ ...cForm, fromHour: Number(e.target.value) })}>
                  {hours.slice(0, -1).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld">
                <span>{tx(lang, "ถึง", "Until")}</span>
                <select data-testid="closure-to" value={cForm.toHour} onChange={(e) => setCForm({ ...cForm, toHour: Number(e.target.value) })}>
                  {hours.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="btn danger" data-testid="closure-submit" disabled={busy}>
              {tx(lang, "ปิดสนามและคืนเครดิต", "Close field and return credit")}
            </button>
          </form>
          {result && (
            <ul className="list" style={{ marginTop: 12 }} data-testid="closure-result" data-count={result.length}>
              {result.length === 0 && <li className="muted">{tx(lang, "ไม่มีการจองที่ได้รับผลกระทบ", "No bookings affected")}</li>}
              {result.map((r) => (
                <li key={r.code} className="spread" data-testid={`closure-affected-${r.code}`}>
                  <span className="code-pill">{r.code}</span>
                  <span>
                    {tx(lang, "เครดิตคืน", "Credit")} <Money lang={lang} value={r.credit} testid={`closure-affected-${r.code}-credit`} />
                    {!!r.challengeCredit && (
                      <>
                        {" · "}
                        {tx(lang, "ทีมรับคำท้าได้คืน", "Opponent team gets")}{" "}
                        <Money lang={lang} value={r.challengeCredit} testid={`closure-affected-${r.code}-challenge`} />
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 style={{ marginTop: 16 }}>{tx(lang, "ประวัติการปิด", "Closures")}</h3>
          <ul className="list">
            {closures.map((c) => (
              <li key={c.id} data-testid={`closure-${c.id}`}>
                {fieldName(lang, c.fieldId)} · {fmtDate(lang, c.date)} · {timeRange(c.fromHour, c.toHour - c.fromHour)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
