"use client";

import { useState } from "react";
import { BackTabs, useLoad } from "@/components/BackOffice";
import { ErrorBox, Ready } from "@/components/ui";
import { AUDIT_LABEL, fmtDateTime, label, tx } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

type Data = {
  actions: string[];
  staff: { id: number; username: string; name: string; role: string }[];
  entries: { id: number; action: string; target: string; detail: string; at: string; username: string; staffName: string }[];
};

// FR-47 · BR-42 (OWNER only): who did what, when — read only, no edit or delete anywhere
export function AuditClient({ lang, role }: { lang: Lang; role: string }) {
  const [f, setF] = useState({ from: "", to: "", staffUserId: "", action: "" });
  const [query, setQuery] = useState("");
  const { data, error, busy } = useLoad<Data>(lang, `/api/owner/audit${query}`);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    setQuery(p.size ? `?${p}` : "");
  };
  return (
    <main className="page container">
      <Ready when={!busy && !!data} />
      <h1 className="page-title">{tx(lang, "บันทึกการกระทำของร้าน", "Shop audit log")}</h1>
      <BackTabs lang={lang} role={role} />
      <form className="card form form-grid" onSubmit={submit} style={{ marginBottom: 16 }}>
        <label className="fld">
          <span>{tx(lang, "ตั้งแต่", "From")}</span>
          <input type="date" data-testid="audit-from" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </label>
        <label className="fld">
          <span>{tx(lang, "ถึง", "To")}</span>
          <input type="date" data-testid="audit-to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </label>
        <label className="fld">
          <span>{tx(lang, "ผู้ใช้", "User")}</span>
          <select data-testid="audit-staff" value={f.staffUserId} onChange={(e) => setF({ ...f, staffUserId: e.target.value })}>
            <option value="">{tx(lang, "ทั้งหมด", "All")}</option>
            {(data?.staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.username} ({s.name})
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>{tx(lang, "การกระทำ", "Action")}</span>
          <select data-testid="audit-action" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}>
            <option value="">{tx(lang, "ทั้งหมด", "All")}</option>
            {(data?.actions ?? []).map((a) => (
              <option key={a} value={a}>
                {label(lang, AUDIT_LABEL, a)}
              </option>
            ))}
          </select>
        </label>
        <div style={{ alignSelf: "end" }}>
          <button type="submit" className="btn" data-testid="audit-submit">
            {tx(lang, "กรอง", "Filter")}
          </button>
        </div>
      </form>
      <ErrorBox message={error} />
      {data && (
        <div className="table-wrap card">
          <table className="data-table" data-testid="audit-table" data-count={data.entries.length}>
            <thead>
              <tr>
                <th>{tx(lang, "เวลา", "Time")}</th>
                <th>{tx(lang, "ผู้ใช้", "User")}</th>
                <th>{tx(lang, "การกระทำ", "Action")}</th>
                <th>{tx(lang, "เป้าหมาย", "Target")}</th>
                <th>{tx(lang, "รายละเอียด", "Detail")}</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" data-testid="audit-empty">
                    {tx(lang, "ไม่มีรายการ", "No entries")}
                  </td>
                </tr>
              )}
              {data.entries.map((a) => (
                <tr key={a.id} data-testid={`audit-row-${a.id}`}>
                  <td data-testid={`audit-at-${a.id}`} data-value={a.at}>
                    {fmtDateTime(lang, a.at)}
                  </td>
                  <td data-testid={`audit-user-${a.id}`} data-value={a.username}>
                    {a.username}
                  </td>
                  <td data-testid={`audit-action-${a.id}`} data-value={a.action}>
                    {label(lang, AUDIT_LABEL, a.action)}
                  </td>
                  <td data-testid={`audit-target-${a.id}`}>{a.target}</td>
                  <td className="small mono-break">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
