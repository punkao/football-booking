"use client";

import { useState } from "react";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { ErrorBox, Money, OkBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { METHOD_LABEL, label, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { saleTotal } from "@/lib/rules";

type Item = { id: string; name: string; category: string; unitPrice: number | null; counter: number };

// FR-38 · BR-33 / BR-37: only SALE items, taken from the COUNTER · CASH or PROMPTPAY (recorded only, T-19)
export function SaleClient({ lang, role }: { lang: Lang; role: string }) {
  const ov = useLoad<{ items: Item[] }>(lang, "/api/staff/stock");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"CASH" | "PROMPTPAY" | "">("");
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = (ov.data?.items ?? []).filter((i) => i.category === "SALE");
  const lines = items.map((i) => ({ itemId: i.id, qty: Number(qty[i.id] || 0), unitPrice: i.unitPrice ?? 0 })).filter((l) => l.qty > 0);
  const total = saleTotal(lines);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(null);
    setError(null);
    const r = await api<{ message: string }>(lang, "/api/staff/stock/sale", {
      body: { items: lines.map((l) => ({ itemId: l.itemId, qty: l.qty })), method },
    });
    if (r.ok) {
      setOk(r.data.message);
      setQty({});
      setMethod("");
    } else setError(r.error.message);
    await ov.reload();
    setBusy(false);
  };

  return (
    <main className="page container">
      <Ready when={!ov.busy && !busy && !!ov.data} />
      <h1 className="page-title">{tx(lang, "ขายหน้าเคาน์เตอร์", "Counter sale")}</h1>
      <BackTabs lang={lang} role={role} />
      <OkBox message={ok} />
      <ErrorBox message={error ?? ov.error} />
      <form className="card form" onSubmit={submit} data-testid="sale-form">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx(lang, "ของขาย", "Item")}</th>
                <th className="num">{tx(lang, "ราคา", "Price")}</th>
                <th className="num">{tx(lang, "ที่เคาน์เตอร์", "At counter")}</th>
                <th className="num">{tx(lang, "จำนวน", "Qty")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <label htmlFor={`sale-qty-${i.id}`}>{i.name}</label>
                  </td>
                  <td className="num">
                    <Money lang={lang} value={i.unitPrice ?? 0} testid={`sale-price-${i.id}`} />
                  </td>
                  <td className="num" data-testid={`sale-available-${i.id}`} data-value={i.counter}>
                    {i.counter}
                  </td>
                  <td className="num">
                    <input
                      id={`sale-qty-${i.id}`}
                      data-testid={`sale-qty-${i.id}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      style={{ width: 80 }}
                      value={qty[i.id] ?? ""}
                      onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: "12px 0" }}>
          <legend>{tx(lang, "ช่องทางชำระ", "Payment method")}</legend>
          {(["CASH", "PROMPTPAY"] as const).map((m) => (
            <label key={m} className="check" style={{ marginRight: 16 }}>
              <input type="radio" name="method" data-testid={`sale-method-${m}`} checked={method === m} onChange={() => setMethod(m)} />
              <span>{label(lang, METHOD_LABEL, m)}</span>
            </label>
          ))}
        </fieldset>
        <p>
          {tx(lang, "ยอดรวม", "Total")} <b><Money lang={lang} value={total} testid="sale-total" /></b>
          {method === "PROMPTPAY" && <span className="small muted"> · {tx(lang, "พร้อมเพย์: บันทึกช่องทางเมื่อได้รับเงินแล้ว", "PromptPay: record after the money is received")}</span>}
        </p>
        <button type="submit" className="btn" data-testid="sale-submit" disabled={busy}>
          {tx(lang, "บันทึกการขาย", "Save sale")}
        </button>
      </form>
    </main>
  );
}
