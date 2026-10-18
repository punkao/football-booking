"use client";

import { useState } from "react";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { ErrorBox, OkBox, Ready } from "@/components/ui";
import { api } from "@/lib/client";
import { LOCATION_LABEL, fmtDateTime, label, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Item = { id: string; name: string; reorderPoint: number | null; store: number; counter: number; total: number };

function ItemSelect({ id, items, value, onChange, lang }: { id: string; items: Item[]; value: string; onChange: (v: string) => void; lang: Lang }) {
  return (
    <label className="fld">
      <span>{tx(lang, "ของ", "Item")}</span>
      <select data-testid={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function LocSelect({ id, value, onChange, lang }: { id: string; value: string; onChange: (v: string) => void; lang: Lang }) {
  return (
    <label className="fld">
      <span>{tx(lang, "ที่เก็บ", "Place")}</span>
      <select data-testid={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {["STORE", "COUNTER"].map((l) => (
          <option key={l} value={l}>
            {label(lang, LOCATION_LABEL, l)}
          </option>
        ))}
      </select>
    </label>
  );
}

// FR-40 · BR-36 / BR-38 (MANAGER, OWNER): receive · damaged (reason) · adjust after counting (reason) · reorder point
export function ManagerStockClient({ lang, role }: { lang: Lang; role: string }) {
  const ov = useLoad<{ items: Item[] }>(lang, "/api/staff/stock");
  const items = ov.data?.items ?? [];
  const [rcv, setRcv] = useState({ itemId: "WATER", locationId: "STORE", qty: "", reason: "" });
  const [dmg, setDmg] = useState({ itemId: "BIB", locationId: "COUNTER", qty: "", reason: "" });
  const [adj, setAdj] = useState({ itemId: "WATER", locationId: "STORE", countedQty: "", reason: "" });
  const [rp, setRp] = useState({ itemId: "WATER", value: "" });
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjusted, setAdjusted] = useState<{ delta: number; by: { username: string; name: string }; at: string } | null>(null);

  const run = async (path: string, body: Record<string, unknown>, method = "POST") => {
    setBusy(true);
    setOk(null);
    setError(null);
    const r = await api<{ message: string; delta?: number; by?: { username: string; name: string }; at?: string }>(lang, path, { method, body });
    if (r.ok) {
      setOk(r.data.message);
      if (r.data.delta !== undefined && r.data.by && r.data.at) setAdjusted({ delta: r.data.delta, by: r.data.by, at: r.data.at });
    } else setError(r.error.message);
    await ov.reload();
    setBusy(false);
  };
  const current = (id: string, loc?: string) => {
    const i = items.find((x) => x.id === id);
    if (!i) return "";
    return loc ? String(loc === "STORE" ? i.store : i.counter) : String(i.total);
  };

  return (
    <main className="page container">
      <Ready when={!ov.busy && !busy && !!ov.data} />
      <h1 className="page-title">{tx(lang, "รับเข้า · ชำรุด · ปรับยอด", "Receive · damage · adjust")}</h1>
      <BackTabs lang={lang} role={role} />
      <OkBox message={ok} />
      <ErrorBox message={error ?? ov.error} />
      <div className="cards">
        <form
          className="card form"
          data-testid="receive-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run("/api/manager/stock/receive", { itemId: rcv.itemId, locationId: rcv.locationId, qty: Number(rcv.qty), reason: rcv.reason });
          }}
        >
          <h2>{tx(lang, "รับของเข้า", "Receive")}</h2>
          <ItemSelect id="receive-item" items={items} value={rcv.itemId} onChange={(v) => setRcv({ ...rcv, itemId: v })} lang={lang} />
          <LocSelect id="receive-location" value={rcv.locationId} onChange={(v) => setRcv({ ...rcv, locationId: v })} lang={lang} />
          <label className="fld">
            <span>{tx(lang, "จำนวน", "Quantity")}</span>
            <input data-testid="receive-qty" type="number" min={1} step={1} value={rcv.qty} onChange={(e) => setRcv({ ...rcv, qty: e.target.value })} />
          </label>
          <label className="fld">
            <span>{tx(lang, "หมายเหตุ (ไม่บังคับ)", "Note (optional)")}</span>
            <input data-testid="receive-reason" value={rcv.reason} onChange={(e) => setRcv({ ...rcv, reason: e.target.value })} />
          </label>
          <button className="btn" type="submit" data-testid="receive-submit" disabled={busy}>
            {tx(lang, "บันทึกรับเข้า", "Save")}
          </button>
        </form>

        <form
          className="card form"
          data-testid="damage-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run("/api/manager/stock/damage", { itemId: dmg.itemId, locationId: dmg.locationId, qty: Number(dmg.qty), reason: dmg.reason });
          }}
        >
          <h2>{tx(lang, "บันทึกของชำรุด", "Damaged")}</h2>
          <ItemSelect id="damage-item" items={items} value={dmg.itemId} onChange={(v) => setDmg({ ...dmg, itemId: v })} lang={lang} />
          <LocSelect id="damage-location" value={dmg.locationId} onChange={(v) => setDmg({ ...dmg, locationId: v })} lang={lang} />
          <label className="fld">
            <span>{tx(lang, "จำนวน", "Quantity")}</span>
            <input data-testid="damage-qty" type="number" min={1} step={1} value={dmg.qty} onChange={(e) => setDmg({ ...dmg, qty: e.target.value })} />
          </label>
          <label className="fld">
            <span>{tx(lang, "เหตุผล (ต้องใส่)", "Reason (required)")}</span>
            <input data-testid="damage-reason" value={dmg.reason} onChange={(e) => setDmg({ ...dmg, reason: e.target.value })} />
          </label>
          <button className="btn" type="submit" data-testid="damage-submit" disabled={busy}>
            {tx(lang, "บันทึกชำรุด", "Save")}
          </button>
        </form>

        <form
          className="card form"
          data-testid="adjust-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run("/api/manager/stock/adjust", { itemId: adj.itemId, locationId: adj.locationId, countedQty: Number(adj.countedQty), reason: adj.reason });
          }}
        >
          <h2>{tx(lang, "ปรับยอดหลังนับจริง", "Adjust after counting")}</h2>
          <ItemSelect id="adjust-item" items={items} value={adj.itemId} onChange={(v) => setAdj({ ...adj, itemId: v })} lang={lang} />
          <LocSelect id="adjust-location" value={adj.locationId} onChange={(v) => setAdj({ ...adj, locationId: v })} lang={lang} />
          <p className="small muted" style={{ margin: 0 }}>
            {tx(lang, "ยอดในระบบ", "System quantity")} <b data-testid="adjust-current" data-value={current(adj.itemId, adj.locationId)}>{current(adj.itemId, adj.locationId)}</b>
          </p>
          <label className="fld">
            <span>{tx(lang, "นับได้จริง", "Counted")}</span>
            <input data-testid="adjust-counted" type="number" min={0} step={1} value={adj.countedQty} onChange={(e) => setAdj({ ...adj, countedQty: e.target.value })} />
          </label>
          <label className="fld">
            <span>{tx(lang, "เหตุผล (ต้องใส่)", "Reason (required)")}</span>
            <input data-testid="adjust-reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
          </label>
          <button className="btn" type="submit" data-testid="adjust-submit" disabled={busy}>
            {tx(lang, "บันทึกปรับยอด", "Save")}
          </button>
          {adjusted && (
            <p className="small" data-testid="adjust-result" data-value={adjusted.delta}>
              ADJUST {adjusted.delta > 0 ? `+${adjusted.delta}` : adjusted.delta} · {adjusted.by.name} ({adjusted.by.username}) · {fmtDateTime(lang, adjusted.at)}
            </p>
          )}
        </form>

        <form
          className="card form"
          data-testid="reorder-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(`/api/manager/stock/items/${rp.itemId}/reorder-point`, { reorderPoint: rp.value === "" ? null : Number(rp.value) }, "PUT");
          }}
        >
          <h2>{tx(lang, "จุดสั่งซื้อซ้ำ", "Reorder point")}</h2>
          <ItemSelect id="reorder-item" items={items} value={rp.itemId} onChange={(v) => setRp({ ...rp, itemId: v })} lang={lang} />
          <p className="small muted" style={{ margin: 0 }}>
            {tx(lang, "ตอนนี้", "Now")}: <b data-testid="reorder-current">{items.find((i) => i.id === rp.itemId)?.reorderPoint ?? "–"}</b> · {tx(lang, "รวมทุกที่", "total")}{" "}
            {current(rp.itemId)}
          </p>
          <label className="fld">
            <span>{tx(lang, "จุดใหม่ (เว้นว่าง = ไม่เตือน)", "New point (empty = no warning)")}</span>
            <input data-testid="reorder-value" type="number" min={0} step={1} value={rp.value} onChange={(e) => setRp({ ...rp, value: e.target.value })} />
          </label>
          <button className="btn" type="submit" data-testid="reorder-submit" disabled={busy}>
            {tx(lang, "บันทึก", "Save")}
          </button>
        </form>
      </div>
    </main>
  );
}
