"use client";

import { useState } from "react";
import { ErrorBox } from "@/components/ui";
import { api } from "@/lib/client";
import { tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

/** FR-09: unlock a booking with booking code + phone number */
export function PhoneGate({ lang, code, onUnlocked, initialError }: { lang: Lang; code: string; onUnlocked: () => void; initialError?: string | null }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card form"
      style={{ maxWidth: 460 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await api(lang, `/api/bookings/${encodeURIComponent(code)}?phone=${encodeURIComponent(phone)}`);
        setBusy(false);
        if (r.ok) onUnlocked();
        else setError(r.error.message);
      }}
    >
      <h2>{tx(lang, "ยืนยันเบอร์โทรเพื่อดูการจอง", "Confirm your phone number to see this booking")}</h2>
      <p className="muted small" style={{ margin: 0 }}>
        {tx(lang, "รหัสการจอง", "Booking code")} <span className="code-pill">{code}</span>
      </p>
      <label className="fld">
        <span>{tx(lang, "เบอร์โทรที่ใช้จอง", "Phone number used for the booking")}</span>
        <input type="tel" data-testid="gate-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <ErrorBox message={error} />
      <button className="btn" type="submit" data-testid="gate-submit" disabled={busy}>
        {tx(lang, "ดูการจอง", "View booking")}
      </button>
    </form>
  );
}
