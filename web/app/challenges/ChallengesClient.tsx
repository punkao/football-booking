"use client";

import { useCallback, useEffect, useState } from "react";
import { SampleQr } from "@/components/Art";
import { ErrorBox, Money, OkBox, Ready } from "@/components/ui";
import { api, mmss } from "@/lib/client";
import { LEVEL_LABEL, fieldName, fmtDate, label, statusLabel, timeRange, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Ch = { id: number; teamName: string; level: string; status: string; amount: number; fieldId: string; date: string; startHour: number; hours: number; ownerName: string };

export function ChallengesClient({ lang }: { lang: Lang }) {
  const [level, setLevel] = useState("");
  const [list, setList] = useState<Ch[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", consent: false });
  const [paying, setPaying] = useState<{ id: number; amount: number; phone: string } | null>(null);
  const [left, setLeft] = useState(0);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await api<{ challenges: Ch[] }>(lang, `/api/challenges${level ? `?level=${level}` : ""}`);
    if (r.ok) setList(r.data.challenges);
    else setError(r.error.message);
    setBusy(false);
  }, [lang, level]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
    void load();
  }, [load]);

  useEffect(() => {
    if (!paying) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [paying]);

  const accept = async (id: number) => {
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await api<{ message: string; challenge: { amount: number }; secondsLeft: number }>(lang, `/api/challenges/${id}/accept`, { body: form });
    if (r.ok) {
      setOk(r.data.message);
      setPaying({ id, amount: r.data.challenge.amount, phone: form.phone });
      setLeft(r.data.secondsLeft);
      setAccepting(null);
    } else setError(r.error.message);
    await load();
    setBusy(false);
  };

  const pay = async () => {
    if (!paying) return;
    setBusy(true);
    setError(null);
    setOk(null);
    const r = await api<{ message: string }>(lang, `/api/challenges/${paying.id}/pay`, { body: { phone: paying.phone } });
    if (r.ok) {
      setOk(r.data.message);
      setPaying(null);
    } else setError(r.error.message);
    await load();
    setBusy(false);
  };

  return (
    <main className="page container">
      <Ready when={!busy} />
      <h1 className="page-title">{tx(lang, "หาทีมคู่แข่ง", "Find a match")}</h1>
      <p className="muted">
        {tx(
          lang,
          "ทีมที่จองสนามแล้วประกาศหาคู่แข่ง · รับคำท้าโดยจ่ายครึ่งค่าสนามภายใน 15 นาที",
          "Teams with a booking looking for opponents · accept by paying half the field price within 15 minutes",
        )}
      </p>
      <div className="toolbar">
        <label className="fld" style={{ maxWidth: 240 }}>
          <span>{tx(lang, "กรองตามระดับ", "Filter by level")}</span>
          <select data-testid="challenge-filter-level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">{tx(lang, "ทุกระดับ", "All levels")}</option>
            {Object.keys(LEVEL_LABEL).map((l) => (
              <option key={l} value={l}>
                {label(lang, LEVEL_LABEL, l)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <OkBox message={ok} />
      <ErrorBox message={error} />

      {paying && (
        <section className="card" style={{ textAlign: "center", marginBottom: 16 }} data-testid="challenge-pay-panel">
          <h2>{tx(lang, "ชำระเงินรับคำท้า", "Pay to accept")}</h2>
          <div className="qr-box">
            <SampleQr seed={`CH-${paying.id}`} title={tx(lang, "QR พร้อมเพย์ตัวอย่าง (จำลอง)", "Sample PromptPay QR (simulation)")} />
          </div>
          <div className="countdown" style={{ color: "var(--grass-2)" }}>
            <Money lang={lang} value={paying.amount} testid="challenge-pay-amount" />
          </div>
          <div className={`countdown${left < 120 ? " low" : ""}`} data-testid="challenge-pay-countdown" data-value={left}>
            {mmss(left)}
          </div>
          <button type="button" className="btn yellow" data-testid="challenge-pay-confirm" onClick={pay} disabled={busy}>
            {tx(lang, "ฉันโอนแล้ว ยืนยันการจ่าย", "I have paid — confirm payment")}
          </button>
        </section>
      )}

      {list && list.length === 0 && <p className="muted" data-testid="challenge-empty">{tx(lang, "ยังไม่มีประกาศ", "No challenges yet")}</p>}
      <div className="cards">
        {list?.map((c) => (
          <article key={c.id} className="card hover" data-testid={`challenge-${c.id}`} data-level={c.level} data-status={c.status}>
            <div className="spread">
              <h2 style={{ margin: 0 }} data-testid={`challenge-team-${c.id}`}>
                {c.teamName}
              </h2>
              <span className={`status-tag ${c.status}`}>{statusLabel(lang, c.status)}</span>
            </div>
            <p style={{ margin: "8px 0" }}>
              <span className="badge gold">{label(lang, LEVEL_LABEL, c.level)}</span>
            </p>
            <p className="muted small" style={{ margin: 0 }}>
              {fieldName(lang, c.fieldId)} · {fmtDate(lang, c.date)} · {timeRange(c.startHour, c.hours)}
              <br />
              {tx(lang, "ผู้ประกาศ", "Posted by")}: {c.ownerName}
            </p>
            <p>
              {tx(lang, "ทีมที่รับจ่าย", "Opponent pays")} <Money lang={lang} value={c.amount} testid={`challenge-amount-${c.id}`} />
            </p>
            {c.status === "OPEN" &&
              (accepting === c.id ? (
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void accept(c.id);
                  }}
                >
                  <label className="fld">
                    <span>{tx(lang, "ชื่อทีม/ผู้ติดต่อ", "Team / contact name")}</span>
                    <input type="text" data-testid="accept-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label className="fld">
                    <span>{tx(lang, "เบอร์โทร", "Phone")}</span>
                    <input type="tel" data-testid="accept-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                  <label className="check">
                    <input type="checkbox" data-testid="accept-consent" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                    <span>{tx(lang, "ยินยอมให้ร้านเก็บชื่อและเบอร์โทร (PDPA)", "I agree that the shop may keep my name and phone number (PDPA)")}</span>
                  </label>
                  <button type="submit" className="btn" data-testid="accept-submit" disabled={busy}>
                    {tx(lang, "รับคำท้า", "Accept challenge")}
                  </button>
                </form>
              ) : (
                <button type="button" className="btn yellow" data-testid={`challenge-accept-${c.id}`} onClick={() => setAccepting(c.id)}>
                  {tx(lang, "รับคำท้า", "Accept challenge")}
                </button>
              ))}
          </article>
        ))}
      </div>
    </main>
  );
}
