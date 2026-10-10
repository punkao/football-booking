"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { fieldName, fmtDate, money, tx, weekdayName } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { addDays, daysBetween, EVENING_START_HOUR } from "@/lib/rules";

type Slot = { fieldId: string; hour: number; price: number; status: string; available: boolean };
type Avail = {
  date: string;
  today: string;
  maxDate: string;
  isHoliday: boolean;
  holidayName: string | null;
  weekday: number;
  fields: { id: string; size: number; covered: boolean }[];
  slots: Slot[];
};

export function BookClient({ lang, initialDate }: { lang: Lang; initialDate: string | null }) {
  const [date, setDate] = useState<string | null>(initialDate);
  const [data, setData] = useState<Avail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [before17, setBefore17] = useState(false);
  const [sort, setSort] = useState<"time" | "price">("time");

  const load = useCallback(
    async (d: string | null) => {
      setLoading(true);
      const r = await api<Avail>(lang, `/api/availability${d ? `?date=${encodeURIComponent(d)}` : ""}`);
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else setError(r.error.message);
      setLoading(false);
    },
    [lang],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on date change
    void load(date);
  }, [date, load]);

  const chips = useMemo(() => {
    if (!data) return [];
    const n = daysBetween(data.today, data.maxDate);
    return Array.from({ length: n + 1 }, (_, i) => addDays(data.today, i));
  }, [data]);

  const visible = useMemo(() => {
    if (!data) return [];
    let s = data.slots;
    if (before17) s = s.filter((x) => x.hour < EVENING_START_HOUR);
    if (sort === "price") s = [...s].sort((a, b) => a.price - b.price || a.hour - b.hour || a.fieldId.localeCompare(b.fieldId));
    return s;
  }, [data, before17, sort]);

  const statusText = (s: Slot) => {
    if (s.status === "free") return tx(lang, "ว่าง", "Free");
    if (s.status === "booked") return tx(lang, "จองแล้ว", "Booked");
    if (s.status === "closed") return tx(lang, "ปิด", "Closed");
    if (s.status === "out-of-range") return tx(lang, "เกิน 14 วัน", "> 14 days");
    return tx(lang, "หมดเวลาจอง", "Too late");
  };

  const renderSlot = (s: Slot, withLabel: boolean) => {
    const cls = `slot ${s.status}${s.hour >= EVENING_START_HOUR || data?.isHoliday || data?.weekday === 0 || data?.weekday === 6 ? " evening" : ""}`;
    const label = `${fieldName(lang, s.fieldId)} ${String(s.hour).padStart(2, "0")}:00 · ${money(lang, s.price)} · ${statusText(s)}`;
    const inner = (
      <>
        {withLabel && (
          <span>
            {fieldName(lang, s.fieldId)} · {String(s.hour).padStart(2, "0")}:00
          </span>
        )}
        <strong data-testid={`slot-${s.fieldId}-${s.hour}-price`} data-value={s.price}>
          {money(lang, s.price)}
        </strong>
        <span className="small">{statusText(s)}</span>
      </>
    );
    if (s.available && data) {
      return (
        <Link
          key={`${s.fieldId}-${s.hour}`}
          href={`/book/new?field=${s.fieldId}&date=${data.date}&start=${s.hour}`}
          className={cls}
          data-testid={`slot-${s.fieldId}-${s.hour}`}
          data-status={s.status}
          data-price={s.price}
          aria-label={label}
        >
          {inner}
        </Link>
      );
    }
    return (
      <div key={`${s.fieldId}-${s.hour}`} className={cls} data-testid={`slot-${s.fieldId}-${s.hour}`} data-status={s.status} data-price={s.price} aria-label={label} role="note">
        {inner}
      </div>
    );
  };

  const hours = data ? [...new Set(visible.map((s) => s.hour))].sort((a, b) => a - b) : [];

  return (
    <main className="page container">
      <Ready when={!loading && !!data} />
      <h1 className="page-title">{tx(lang, "ตารางสนามว่าง", "Field availability")}</h1>
      <p className="muted" data-testid="availability-date">
        {data ? fmtDate(lang, data.date) : "…"}
        {data?.isHoliday && (
          <span className="badge warn" style={{ marginLeft: 8 }} data-testid="holiday-badge">
            {lang === "en" ? "Public holiday · evening rate all day" : `วันหยุด${data.holidayName ? ` (${data.holidayName})` : ""} · ราคาเย็นทั้งวัน`}
          </span>
        )}
      </p>
      <ErrorBox message={error} />

      <div className="date-chips" role="group" aria-label={tx(lang, "เลือกวัน", "Choose a day")}>
        {chips.map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            aria-pressed={data?.date === d}
            data-testid={`date-chip-${d}`}
            onClick={() => setDate(d)}
          >
            {d === data?.today ? tx(lang, "วันนี้", "Today") : weekdayName(lang, new Date(d + "T00:00:00Z").getUTCDay(), true)}
            <br />
            {Number(d.slice(8, 10))}/{Number(d.slice(5, 7))}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="fld" style={{ maxWidth: 200 }}>
          <span>{tx(lang, "วันที่", "Date")}</span>
          <input
            type="date"
            data-testid="book-date-input"
            value={data?.date ?? ""}
            min={data?.today}
            max={data?.maxDate}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label className="check" style={{ alignItems: "center" }}>
          <input type="checkbox" data-testid="filter-before-17" checked={before17} onChange={(e) => setBefore17(e.target.checked)} />
          {tx(lang, "เฉพาะรอบก่อน 17:00", "Only slots before 17:00")}
        </label>
        <label className="fld" style={{ maxWidth: 220 }}>
          <span>{tx(lang, "เรียงตาม", "Sort by")}</span>
          <select data-testid="sort-by" value={sort} onChange={(e) => setSort(e.target.value as "time" | "price")}>
            <option value="time">{tx(lang, "เวลา (ตาราง)", "Time (grid)")}</option>
            <option value="price">{tx(lang, "ราคา ถูก → แพง", "Price, low → high")}</option>
          </select>
        </label>
      </div>

      {data && sort === "time" && (
        <div className="slot-grid" data-testid="slot-grid">
          <div className="head" aria-hidden="true" />
          {data.fields.map((f) => (
            <div key={f.id} className="head" data-testid={`grid-head-${f.id}`}>
              {f.id}
              <div className="small muted" style={{ fontWeight: 400 }}>
                {tx(lang, `${f.size} คน`, `${f.size}-a-side`)}
                {f.covered ? tx(lang, " · หลังคา", " · roof") : ""}
              </div>
            </div>
          ))}
          {hours.map((h) => (
            <div key={h} style={{ display: "contents" }}>
              <div className="hour">{String(h).padStart(2, "0")}:00</div>
              {data.fields.map((f) => {
                const s = visible.find((x) => x.fieldId === f.id && x.hour === h);
                return s ? renderSlot(s, false) : <div key={f.id} />;
              })}
            </div>
          ))}
        </div>
      )}
      {data && sort === "price" && (
        <div className="slot-list" data-testid="slot-list">
          {visible.map((s) => renderSlot(s, true))}
        </div>
      )}

      <div className="legend" aria-hidden="true">
        <span>
          <i style={{ background: "#f1fbf5", borderColor: "#1F9D55" }} />
          {tx(lang, "ว่าง (ราคากลางวัน)", "Free (day rate)")}
        </span>
        <span>
          <i style={{ background: "#fff6cf", borderColor: "#c8a014" }} />
          {tx(lang, "ว่าง (ราคาเย็น)", "Free (evening rate)")}
        </span>
        <span>
          <i style={{ background: "#e3e8e5" }} />
          {tx(lang, "จองแล้ว", "Booked")}
        </span>
        <span>
          <i style={{ background: "rgba(229,72,77,.15)" }} />
          {tx(lang, "ปิด", "Closed")}
        </span>
      </div>
    </main>
  );
}
