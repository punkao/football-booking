"use client";

import { useState } from "react";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { ErrorBox, OkBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { LOCATION_LABEL, label, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Item = { id: string; name: string; store: number; counter: number; total: number };

// FR-39 · BR-34: the same amount leaves the source and arrives at the destination
export function TransferClient({ lang, role }: { lang: Lang; role: string }) {
  const ov = useLoad<{ items: Item[] }>(lang, "/api/staff/stock");
  const [f, setF] = useState({ itemId: "WATER", from: "STORE", to: "COUNTER", qty: "" });
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const item = ov.data?.items.find((i) => i.id === f.itemId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(null);
    setError(null);
    const r = await api<{ message: string }>(lang, "/api/staff/stock/transfer", {
      body: { itemId: f.itemId, qty: Number(f.qty), fromLocationId: f.from, toLocationId: f.to },
    });
    if (r.ok) setOk(r.data.message);
    else setError(r.error.message);
    await ov.reload();
    setBusy(false);
  };

  return (
    <main className="page container">
      <Ready when={!ov.busy && !busy && !!ov.data} />
      <h1 className="page-title">{tx(lang, "ย้ายของระหว่างที่เก็บ", "Move items between places")}</h1>
      <BackTabs lang={lang} role={role} />
      <OkBox message={ok} />
      <ErrorBox message={error ?? ov.error} />
      <form className="card form form-grid" onSubmit={submit} data-testid="transfer-form">
        <label className="fld">
          <span>{tx(lang, "ของ", "Item")}</span>
          <select data-testid="transfer-item" value={f.itemId} onChange={(e) => setF({ ...f, itemId: e.target.value })}>
            {(ov.data?.items ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>{tx(lang, "จาก", "From")}</span>
          <select data-testid="transfer-from" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>
            {["STORE", "COUNTER"].map((l) => (
              <option key={l} value={l}>
                {label(lang, LOCATION_LABEL, l)}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>{tx(lang, "ไป", "To")}</span>
          <select data-testid="transfer-to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>
            {["STORE", "COUNTER"].map((l) => (
              <option key={l} value={l}>
                {label(lang, LOCATION_LABEL, l)}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>{tx(lang, "จำนวน", "Quantity")}</span>
          <input data-testid="transfer-qty" type="number" min={1} step={1} inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
        </label>
        {item && (
          <p className="small muted" style={{ gridColumn: "1 / -1", margin: 0 }} data-testid="transfer-levels">
            {label(lang, LOCATION_LABEL, "STORE")} <b data-testid="transfer-store" data-value={item.store}>{item.store}</b> ·{" "}
            {label(lang, LOCATION_LABEL, "COUNTER")} <b data-testid="transfer-counter" data-value={item.counter}>{item.counter}</b> ·{" "}
            {tx(lang, "รวม", "Total")} <b data-testid="transfer-total" data-value={item.total}>{item.total}</b>
          </p>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className="btn" data-testid="transfer-submit" disabled={busy}>
            {tx(lang, "ย้ายของ", "Move")}
          </button>
        </div>
      </form>
    </main>
  );
}
