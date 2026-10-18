"use client";

import { BackTabs, useLoad } from "@/components/BackOffice";
import { ErrorBox, Ready } from "@/components/ui";
import { CATEGORY_LABEL, LOCATION_LABEL, MOVEMENT_LABEL, fmtDateTime, label, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Item = { id: string; name: string; category: string; reorderPoint: number | null; store: number; counter: number; total: number; below?: boolean };
type Overview = { items: Item[]; alerts?: { id: string; name: string; total: number; reorderPoint: number }[] };
type Movement = {
  id: number;
  itemName: string;
  type: string;
  qty: number;
  delta: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  reason: string | null;
  username: string;
  createdAt: string;
};

// FR-37 / FR-41: stock per place + total · low-stock warning (MANAGER / OWNER, BR-44) · movements (read only)
export function StockClient({ lang, role }: { lang: Lang; role: string }) {
  const ov = useLoad<Overview>(lang, "/api/staff/stock");
  const mv = useLoad<{ movements: Movement[] }>(lang, "/api/staff/stock/movements");
  const loc = (l: string | null) => (l ? label(lang, LOCATION_LABEL, l) : "–");
  return (
    <main className="page container">
      <Ready when={!ov.busy && !mv.busy && !!ov.data} />
      <h1 className="page-title">{tx(lang, "คลังของ", "Stock")}</h1>
      <BackTabs lang={lang} role={role} />
      <ErrorBox message={ov.error ?? mv.error} />
      {ov.data?.alerts && (
        <section className="card" data-testid="stock-alerts" data-count={ov.data.alerts.length} style={{ marginBottom: 16 }}>
          <h2>{tx(lang, "ของใกล้หมด (ต่ำกว่าจุดสั่งซื้อซ้ำ)", "Low stock (below the reorder point)")}</h2>
          {ov.data.alerts.length === 0 ? (
            <p className="muted" data-testid="stock-alerts-empty" style={{ margin: 0 }}>
              {tx(lang, "ไม่มีของต่ำกว่าจุดสั่งซื้อซ้ำ", "Nothing is below its reorder point")}
            </p>
          ) : (
            <ul className="list">
              {ov.data.alerts.map((a) => (
                <li key={a.id} data-testid={`stock-alert-${a.id}`} data-value={a.total}>
                  <span className="warn-badge">!</span> {a.name}: {tx(lang, "เหลือรวม", "total")} <b>{a.total}</b> ({tx(lang, "จุดสั่งซื้อซ้ำ", "reorder point")} {a.reorderPoint})
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {ov.data && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2>{tx(lang, "คงเหลือ", "On hand")}</h2>
          <div className="table-wrap">
            <table className="data-table" data-testid="stock-table">
              <thead>
                <tr>
                  <th>{tx(lang, "ของ", "Item")}</th>
                  <th>{tx(lang, "หมวด", "Category")}</th>
                  <th className="num">{label(lang, LOCATION_LABEL, "STORE")}</th>
                  <th className="num">{label(lang, LOCATION_LABEL, "COUNTER")}</th>
                  <th className="num">{tx(lang, "รวม", "Total")}</th>
                  <th className="num">{tx(lang, "จุดสั่งซื้อซ้ำ", "Reorder point")}</th>
                </tr>
              </thead>
              <tbody>
                {ov.data.items.map((i) => (
                  <tr key={i.id} data-testid={`stock-row-${i.id}`} className={i.below ? "low" : undefined}>
                    <td>
                      {i.name}{" "}
                      {i.below && (
                        <span className="warn-badge" data-testid={`stock-${i.id}-low`}>
                          {tx(lang, "ใกล้หมด", "Low")}
                        </span>
                      )}
                    </td>
                    <td>{label(lang, CATEGORY_LABEL, i.category)}</td>
                    <td className="num" data-testid={`stock-${i.id}-store`} data-value={i.store}>
                      {i.store}
                    </td>
                    <td className="num" data-testid={`stock-${i.id}-counter`} data-value={i.counter}>
                      {i.counter}
                    </td>
                    <td className="num" data-testid={`stock-${i.id}-total`} data-value={i.total}>
                      <b>{i.total}</b>
                    </td>
                    <td className="num" data-testid={`stock-${i.id}-reorder`} data-value={i.reorderPoint ?? ""}>
                      {i.reorderPoint ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card">
        <h2>{tx(lang, "ประวัติของเข้า-ออก", "Stock movements")}</h2>
        <div className="table-wrap">
          <table className="data-table" data-testid="movement-table">
            <thead>
              <tr>
                <th>{tx(lang, "เวลา", "Time")}</th>
                <th>{tx(lang, "ของ", "Item")}</th>
                <th>{tx(lang, "ชนิด", "Type")}</th>
                <th className="num">{tx(lang, "จำนวน", "Qty")}</th>
                <th>{tx(lang, "จาก → ไป", "From → to")}</th>
                <th>{tx(lang, "เหตุผล", "Reason")}</th>
                <th>{tx(lang, "ผู้ทำ", "By")}</th>
              </tr>
            </thead>
            <tbody>
              {(mv.data?.movements ?? []).map((m) => (
                <tr key={m.id} data-testid={`movement-${m.id}`} data-type={m.type}>
                  <td>{fmtDateTime(lang, m.createdAt)}</td>
                  <td>{m.itemName}</td>
                  <td data-testid={`movement-type-${m.id}`}>{label(lang, MOVEMENT_LABEL, m.type)}</td>
                  <td className="num" data-testid={`movement-qty-${m.id}`} data-value={m.delta || m.qty}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta < 0 ? m.delta : m.qty}
                  </td>
                  <td>
                    {loc(m.fromLocationId)} → {loc(m.toLocationId)}
                  </td>
                  <td>{m.reason ?? ""}</td>
                  <td data-testid={`movement-user-${m.id}`}>{m.username}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
