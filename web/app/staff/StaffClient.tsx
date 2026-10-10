"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ErrorBox, Money, OkBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { fieldName, fmtDate, msg, rentalName, statusLabel, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type SB = {
  booking: {
    code: string;
    status: string;
    fieldId: string;
    date: string;
    startHour: number;
    hours: number;
    customerName: string;
    phone: string;
    totalPrice: number;
    amountPaid: number;
    dueAtField: number;
    creditUsed: number;
    rentals: { itemId: string; qty: number; returnedQty: number }[];
  };
  actions?: { canCheckin: boolean; checkinBlockedBy: string | null; canNoShow: boolean; noShowBlockedBy: string | null };
  message?: string;
};

export function StaffClient({ lang, staff, initialCode }: { lang: Lang; staff: { name: string; role: string }; initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [data, setData] = useState<SB | null>(null);
  const [ret, setRet] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = useCallback(
    async (c: string) => {
      setBusy(true);
      setError(null);
      setOk(null);
      const r = await api<SB>(lang, `/api/staff/bookings/${encodeURIComponent(c.trim().toUpperCase())}`);
      if (r.ok) {
        setData(r.data);
        setRet(Object.fromEntries(r.data.booking.rentals.map((x) => [x.itemId, String(x.qty)])));
      } else {
        setData(null);
        setError(r.error.message);
      }
      setBusy(false);
    },
    [lang],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- search a code given in the URL
    if (initialCode) void search(initialCode);
  }, [initialCode, search]);

  const act = async (path: string, body: unknown = {}) => {
    if (!data) return;
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await api<SB>(lang, `/api/staff/bookings/${encodeURIComponent(data.booking.code)}/${path}`, { body });
    if (r.ok) {
      setData(r.data);
      setOk(r.data.message ?? null);
    } else setError(r.error.message);
    setBusy(false);
  };

  const logout = async () => {
    await api(lang, "/api/staff/logout", { body: {} });
    router.push("/staff/login");
    router.refresh();
  };

  const b = data?.booking;
  const acts = data?.actions;
  // F-02: the reason is shown under the button before clicking; the button stays clickable (API gives the same error)
  const checkinHint =
    b && acts?.checkinBlockedBy
      ? b.status === "CHECKED_IN"
        ? tx(lang, "การจองนี้เช็กอินและเก็บเงินแล้ว", "This booking is already checked in and paid")
        : msg(lang, acts.checkinBlockedBy)
      : null;
  const noShowHint = acts?.noShowBlockedBy ? msg(lang, acts.noShowBlockedBy) : null;
  return (
    <main className="page container">
      <Ready when={!busy} />
      <div className="spread">
        <h1 className="page-title">{tx(lang, "หน้าสนาม", "Front desk")}</h1>
        <span className="small">
          <span data-testid="staff-whoami">
            {staff.name} · {staff.role}
          </span>{" "}
          <button type="button" className="btn ghost small" data-testid="staff-logout" onClick={logout}>
            {tx(lang, "ออกจากระบบ", "Log out")}
          </button>
        </span>
      </div>
      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          void search(code);
        }}
      >
        <label className="fld" style={{ flex: "1 1 200px" }}>
          <span>{tx(lang, "รหัสการจอง", "Booking code")}</span>
          <input type="text" data-testid="staff-search-code" placeholder="LN-100001" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button type="submit" className="btn" data-testid="staff-search-submit" disabled={busy} style={{ alignSelf: "end" }}>
          {tx(lang, "ค้นหา", "Search")}
        </button>
      </form>
      <div style={{ marginTop: 12 }}>
        <OkBox message={ok} />
        <ErrorBox message={error} />
      </div>
      {b && (
        <div className="two-col" style={{ marginTop: 12 }}>
          <section className="card">
            <div className="spread">
              <span className="code-pill" data-testid="staff-booking-code">
                {b.code}
              </span>
              <span className={`status-tag ${b.status}`} data-testid="staff-booking-status" data-value={b.status}>
                {statusLabel(lang, b.status)}
              </span>
            </div>
            <h2 style={{ marginTop: 12 }}>
              {fieldName(lang, b.fieldId)} · {timeRange(b.startHour, b.hours)}
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {fmtDate(lang, b.date)} · <span data-testid="staff-customer-name">{b.customerName}</span> · {b.phone}
            </p>
            <div className="kpis">
              <div className="kpi">
                <div className="k">{tx(lang, "ยอดเก็บหน้าสนาม", "Due at the field")}</div>
                <div className="v">
                  <Money lang={lang} value={b.dueAtField} testid="staff-due-at-field" />
                </div>
              </div>
              <div className="kpi">
                <div className="k">{tx(lang, "จ่ายแล้ว", "Paid")}</div>
                <div className="v">
                  <Money lang={lang} value={b.amountPaid} testid="staff-amount-paid" />
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 14, alignItems: "flex-start" }}>
              <div className="btn-with-hint">
                <button
                  type="button"
                  className="btn yellow"
                  data-testid="staff-checkin"
                  aria-describedby={checkinHint ? "staff-checkin-hint" : undefined}
                  onClick={() => act("checkin")}
                  disabled={busy}
                >
                  {tx(lang, "เก็บเงินแล้ว / เช็กอิน", "Collected / check in")}
                </button>
                {checkinHint && (
                  <p className="hint" id="staff-checkin-hint" data-testid="staff-checkin-hint" data-value={acts?.checkinBlockedBy ?? ""}>
                    {checkinHint}
                  </p>
                )}
              </div>
              <div className="btn-with-hint">
                <button
                  type="button"
                  className="btn danger"
                  data-testid="staff-no-show"
                  aria-describedby={noShowHint ? "staff-no-show-hint" : undefined}
                  onClick={() => act("no-show")}
                  disabled={busy}
                >
                  {tx(lang, "ไม่มา", "No-show")}
                </button>
                {noShowHint && (
                  <p className="hint" id="staff-no-show-hint" data-testid="staff-no-show-hint" data-value={acts?.noShowBlockedBy ?? ""}>
                    {noShowHint}
                  </p>
                )}
              </div>
            </div>
          </section>
          <aside className="card">
            <h2>{tx(lang, "คืนของเช่า", "Rental returns")}</h2>
            {b.rentals.length === 0 && <p className="muted" data-testid="staff-no-rentals">{tx(lang, "ไม่มีของเช่า", "No rentals")}</p>}
            {b.rentals.length > 0 && (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("return-rentals", { items: Object.entries(ret).map(([itemId, v]) => ({ itemId, returnedQty: Number(v) })) });
                }}
              >
                {b.rentals.map((r) => (
                  <label key={r.itemId} className="fld">
                    <span>
                      {rentalName(lang, r.itemId)} · {tx(lang, "เช่า", "rented")} {r.qty} · {tx(lang, "คืนแล้ว", "returned")}{" "}
                      <b data-testid={`staff-returned-${r.itemId}`} data-value={r.returnedQty}>
                        {r.returnedQty}
                      </b>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={r.qty}
                      data-testid={`staff-return-${r.itemId}`}
                      value={ret[r.itemId] ?? ""}
                      onChange={(e) => setRet({ ...ret, [r.itemId]: e.target.value })}
                    />
                  </label>
                ))}
                <button type="submit" className="btn" data-testid="staff-return-submit" disabled={busy}>
                  {tx(lang, "บันทึกคืนของ", "Save returns")}
                </button>
              </form>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
