"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ErrorBox, Money, OkBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { CREDIT_REASON_LABEL, fieldName, fmtDate, fmtDateTime, label, statusLabel, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Me = {
  customer: {
    name: string;
    phone: string;
    isMember: boolean;
    creditBalance: number;
    paidHours: number;
    freeHoursAvailable: number;
    hoursToNextFree: number;
    bannedUntil: string | null;
    isBanned: boolean;
  };
  creditEntries: { id: number; amount: number; reason: string; bookingCode: string | null; createdAt: string }[];
  bookings: { code: string; fieldId: string; date: string; startHour: number; hours: number; status: string; totalPrice: number; dueAtField: number }[];
};

export function MyClient({ lang, loggedIn }: { lang: Lang; loggedIn: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(loggedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [lp, setLp] = useState({ phone: "", password: "" });
  const [rg, setRg] = useState({ name: "", phone: "", password: "", consent: false });
  const [lk, setLk] = useState({ code: "", phone: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Me>(lang, "/api/me");
    setMe(r.ok ? r.data : null);
    setLoading(false);
  }, [lang]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    if (loggedIn) void load();
  }, [loggedIn, load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setOk(null);
    await fn();
    setBusy(false);
  };

  const login = () =>
    run(async () => {
      const r = await api(lang, "/api/customers/login", { body: lp });
      if (r.ok) {
        await load();
        router.refresh();
      } else setError(r.error.message);
    });
  const register = () =>
    run(async () => {
      const r = await api<{ message: string }>(lang, "/api/customers/register", { body: rg });
      if (r.ok) {
        setOk(r.data.message);
        await load();
        router.refresh();
      } else setError(r.error.message);
    });
  const lookup = () =>
    run(async () => {
      const r = await api(lang, `/api/bookings/${encodeURIComponent(lk.code.trim().toUpperCase())}?phone=${encodeURIComponent(lk.phone)}`);
      if (r.ok) router.push(`/booking/${encodeURIComponent(lk.code.trim().toUpperCase())}`);
      else setError(r.error.message);
    });
  const logout = () =>
    run(async () => {
      await api(lang, "/api/customers/logout", { body: {} });
      setMe(null);
      router.refresh();
    });

  const c = me?.customer;
  return (
    <main className="page container">
      <Ready when={!loading && !busy} />
      <h1 className="page-title">{tx(lang, "การจองของฉัน", "My bookings")}</h1>
      <OkBox message={ok} />
      <ErrorBox message={error} />

      {c ? (
        <div className="stack">
          <section className="card">
            <div className="spread">
              <h2 style={{ margin: 0 }}>
                {tx(lang, "สวัสดี", "Hello")} <span data-testid="my-name">{c.name}</span>
              </h2>
              <button type="button" className="btn ghost small" data-testid="logout" onClick={logout}>
                {tx(lang, "ออกจากระบบ", "Log out")}
              </button>
            </div>
            {c.isBanned && (
              <div className="alert error" style={{ marginTop: 12 }} data-testid="banned-notice">
                {tx(lang, "บัญชีถูกระงับการจองออนไลน์ จองได้อีกครั้ง", "Online booking is suspended. You can book again on")}{" "}
                <span data-testid="banned-until" data-value={c.bannedUntil ?? ""}>
                  {fmtDateTime(lang, c.bannedUntil)}
                </span>
              </div>
            )}
            <div className="kpis" style={{ marginTop: 14 }}>
              <div className="kpi">
                <div className="k">{tx(lang, "เครดิตคงเหลือ", "Credit balance")}</div>
                <div className="v">
                  <Money lang={lang} value={c.creditBalance} testid="credit-balance" />
                </div>
              </div>
              <div className="kpi">
                <div className="k">{tx(lang, "ชั่วโมงสะสม", "Paid hours")}</div>
                <div className="v" data-testid="paid-hours" data-value={c.paidHours}>
                  {c.paidHours}
                </div>
              </div>
              <div className="kpi">
                <div className="k">{tx(lang, "สิทธิ์ชั่วโมงฟรี", "Free hours")}</div>
                <div className="v" data-testid="free-hours-available" data-value={c.freeHoursAvailable}>
                  {c.freeHoursAvailable}
                </div>
              </div>
            </div>
            <p className="muted" data-testid="free-hours-next" data-value={c.hoursToNextFree}>
              {tx(lang, `อีก ${c.hoursToNextFree} ชั่วโมง ได้ฟรี 1 ชั่วโมง`, `${c.hoursToNextFree} more hours to the next free hour`)}
            </p>
          </section>

          <section className="card">
            <h2>{tx(lang, "การจอง", "Bookings")}</h2>
            {me.bookings.length === 0 && <p className="muted">{tx(lang, "ยังไม่มีการจอง", "No bookings yet")}</p>}
            <ul className="list">
              {me.bookings.map((b) => (
                <li key={b.code} className="spread" data-testid={`my-booking-${b.code}`}>
                  <Link href={`/booking/${b.code}`}>
                    <span className="code-pill">{b.code}</span>
                  </Link>
                  <span>
                    {fieldName(lang, b.fieldId)} · {fmtDate(lang, b.date)} · {timeRange(b.startHour, b.hours)}
                  </span>
                  <span className={`status-tag ${b.status}`}>{statusLabel(lang, b.status)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>{tx(lang, "ประวัติเครดิต", "Credit history")}</h2>
            {me.creditEntries.length === 0 && <p className="muted">{tx(lang, "ยังไม่มีรายการ", "No entries yet")}</p>}
            <ul className="list" data-testid="credit-history">
              {me.creditEntries.map((e) => (
                <li key={e.id} className="spread" data-testid={`credit-entry-${e.id}`} data-reason={e.reason} data-value={e.amount}>
                  <span>{label(lang, CREDIT_REASON_LABEL, e.reason)}</span>
                  <span className="small muted">
                    {fmtDateTime(lang, e.createdAt)}
                    {e.bookingCode ? ` · ${e.bookingCode}` : ""}
                  </span>
                  <b style={{ color: e.amount < 0 ? "var(--alert)" : "var(--grass-2)" }}>
                    {e.amount > 0 ? "+" : ""}
                    <Money lang={lang} value={e.amount} />
                  </b>
                </li>
              ))}
            </ul>
          </section>
          {c.isMember && (
            <p>
              <Link href="/series" className="btn" data-testid="my-go-series">
                {tx(lang, "จองประจำรายสัปดาห์", "Weekly recurring booking")}
              </Link>
            </p>
          )}
        </div>
      ) : (
        !loading && (
          <div className="cards">
            <form
              className="card form"
              aria-labelledby="h-lookup"
              onSubmit={(e) => {
                e.preventDefault();
                void lookup();
              }}
            >
              <h2 id="h-lookup">{tx(lang, "ค้นด้วยรหัสการจอง", "Find by booking code")}</h2>
              <label className="fld">
                <span>{tx(lang, "รหัสการจอง", "Booking code")}</span>
                <input type="text" data-testid="lookup-code" placeholder="LN-100001" value={lk.code} onChange={(e) => setLk({ ...lk, code: e.target.value })} />
              </label>
              <label className="fld">
                <span>{tx(lang, "เบอร์โทรที่ใช้จอง", "Phone used for the booking")}</span>
                <input type="tel" data-testid="lookup-phone" value={lk.phone} onChange={(e) => setLk({ ...lk, phone: e.target.value })} />
              </label>
              <button className="btn" type="submit" data-testid="lookup-submit" disabled={busy}>
                {tx(lang, "ดูการจอง", "View booking")}
              </button>
            </form>
            <form
              className="card form"
              aria-labelledby="h-login"
              onSubmit={(e) => {
                e.preventDefault();
                void login();
              }}
            >
              <h2 id="h-login">{tx(lang, "เข้าสู่ระบบสมาชิก", "Member login")}</h2>
              <label className="fld">
                <span>{tx(lang, "เบอร์โทรสมาชิก", "Member phone")}</span>
                <input type="tel" data-testid="login-phone" autoComplete="username" value={lp.phone} onChange={(e) => setLp({ ...lp, phone: e.target.value })} />
              </label>
              <label className="fld">
                <span>{tx(lang, "รหัสผ่าน", "Password")}</span>
                <input
                  type="password"
                  data-testid="login-password"
                  autoComplete="current-password"
                  value={lp.password}
                  onChange={(e) => setLp({ ...lp, password: e.target.value })}
                />
              </label>
              <button className="btn" type="submit" data-testid="login-submit" disabled={busy}>
                {tx(lang, "เข้าสู่ระบบ", "Log in")}
              </button>
            </form>
            <form
              className="card form"
              aria-labelledby="h-register"
              onSubmit={(e) => {
                e.preventDefault();
                void register();
              }}
            >
              <h2 id="h-register">{tx(lang, "สมัครสมาชิก", "Become a member")}</h2>
              <p className="small muted" style={{ margin: 0 }}>
                {tx(lang, "ตั้งรหัสผ่านให้เบอร์โทร ข้อมูลเครดิตและชั่วโมงสะสมเดิมของเบอร์นี้ยังอยู่", "Set a password for your phone number. Existing credit and hours stay with the number")}
              </p>
              <label className="fld">
                <span>{tx(lang, "ชื่อ", "Name")}</span>
                <input type="text" data-testid="register-name" value={rg.name} onChange={(e) => setRg({ ...rg, name: e.target.value })} />
              </label>
              <label className="fld">
                <span>{tx(lang, "เบอร์โทรที่จะสมัคร", "Phone to register")}</span>
                <input type="tel" data-testid="register-phone" value={rg.phone} onChange={(e) => setRg({ ...rg, phone: e.target.value })} />
              </label>
              <label className="fld">
                <span>{tx(lang, "รหัสผ่าน (อย่างน้อย 8 ตัว)", "Password (at least 8 characters)")}</span>
                <input
                  type="password"
                  data-testid="register-password"
                  autoComplete="new-password"
                  value={rg.password}
                  onChange={(e) => setRg({ ...rg, password: e.target.value })}
                />
              </label>
              <label className="check">
                <input type="checkbox" data-testid="register-consent" checked={rg.consent} onChange={(e) => setRg({ ...rg, consent: e.target.checked })} />
                <span>{tx(lang, "ยินยอมให้ร้านเก็บชื่อและเบอร์โทร (PDPA)", "I agree that the shop may keep my name and phone number (PDPA)")}</span>
              </label>
              <button className="btn yellow" type="submit" data-testid="register-submit" disabled={busy}>
                {tx(lang, "สมัครสมาชิก", "Register")}
              </button>
            </form>
          </div>
        )
      )}
    </main>
  );
}
