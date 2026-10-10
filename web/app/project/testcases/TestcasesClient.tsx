"use client";

import { useMemo, useState } from "react";
import { Ready } from "@/components/ui";

export type TcRow = {
  id: string;
  marks: string;
  module: string;
  what: string;
  rules: string;
  priority: string;
  data: string;
  expected: string;
  byProject: Record<string, { status: string; error: string }>;
  overall: "passed" | "failed" | "skipped" | "none";
  skipReason: string;
  gif: string | null;
  mp4: string | null;
};

const RESULT_TEXT: Record<string, string> = { passed: "ผ่าน", failed: "ไม่ผ่าน", skipped: "ข้าม", none: "ไม่มีผล", timedOut: "หมดเวลา", interrupted: "ถูกขัด" };
const ICON: Record<string, string> = { passed: "✅", failed: "❌", skipped: "⏭", timedOut: "❌", interrupted: "❌" };

/** `code` spans and **bold** from the markdown table, as plain React (no HTML injection) */
function Inline({ text }: { text: string }) {
  const parts = text.replace(/\*\*/g, "").split("`");
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <code key={i}>{p}</code> : <span key={i}>{p}</span>))}
    </>
  );
}

export function TestcasesClient({ rows, projects }: { rows: TcRow[]; projects: string[] }) {
  const [mod, setMod] = useState("");
  const [prio, setPrio] = useState("");
  const [result, setResult] = useState("");
  const modules = useMemo(() => [...new Set(rows.map((r) => r.module))], [rows]);
  const shown = rows.filter((r) => (!mod || r.module === mod) && (!prio || r.priority === prio) && (!result || r.overall === result));
  const count = (k: string) => rows.filter((r) => r.overall === k).length;
  return (
    <>
      <Ready />
      <div className="toolbar" role="group" aria-label="กรอง test case">
        <label className="fld" style={{ maxWidth: 200 }}>
          <span>โมดูล</span>
          <select data-testid="project-tc-filter-module" value={mod} onChange={(e) => setMod(e.target.value)}>
            <option value="">ทุกโมดูล</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="fld" style={{ maxWidth: 160 }}>
          <span>ระดับ</span>
          <select data-testid="project-tc-filter-priority" value={prio} onChange={(e) => setPrio(e.target.value)}>
            <option value="">ทุกระดับ</option>
            {["P1", "P2", "P3"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="fld" style={{ maxWidth: 200 }}>
          <span>ผลล่าสุด</span>
          <select data-testid="project-tc-filter-result" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">ทุกผล</option>
            {(["passed", "failed", "skipped", "none"] as const).map((k) => (
              <option key={k} value={k}>
                {RESULT_TEXT[k]} ({count(k)})
              </option>
            ))}
          </select>
        </label>
        <p className="small muted" style={{ alignSelf: "end", margin: 0 }}>
          แสดง <b data-testid="project-tc-shown" data-value={shown.length}>{shown.length}</b> / {rows.length}
        </p>
      </div>
      <div className="table-wrap">
        <table className="simple tc-table" data-testid="project-tc-table">
          <thead>
            <tr>
              <th scope="col">รหัส</th>
              <th scope="col">โมดูล</th>
              <th scope="col">สิ่งที่ทดสอบ</th>
              <th scope="col">กฎ</th>
              <th scope="col">ระดับ</th>
              {projects.map((p) => (
                <th scope="col" key={p}>
                  {p}
                </th>
              ))}
              <th scope="col">หลักฐาน</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} id={r.id} data-testid={`project-tc-${r.id}`} data-result={r.overall} data-priority={r.priority} data-module={r.module} className={`res-${r.overall}`}>
                <th scope="row">
                  {r.id}
                  {r.marks && <div className="small muted">{r.marks}</div>}
                </th>
                <td>{r.module}</td>
                <td className="tc-what">
                  <Inline text={r.what} />
                  <details className="small">
                    <summary>ผลที่คาดหวัง</summary>
                    <Inline text={r.expected} />
                  </details>
                  {r.overall === "skipped" && (
                    <p className="hint" data-testid={`project-tc-skip-${r.id}`}>
                      ข้าม: {r.skipReason}
                    </p>
                  )}
                </td>
                <td className="small">{r.rules}</td>
                <td>{r.priority}</td>
                {projects.map((p) => {
                  const x = r.byProject[p];
                  return (
                    <td key={p} data-testid={`project-tc-${r.id}-${p}`} data-status={x?.status ?? ""} title={x?.error || undefined} className="tc-res">
                      {x ? `${ICON[x.status] ?? "•"} ${RESULT_TEXT[x.status] ?? x.status}` : <span className="muted">–</span>}
                    </td>
                  );
                })}
                <td className="tc-evidence">
                  {r.gif ? (
                    <details>
                      <summary data-testid={`project-tc-gif-${r.id}`}>GIF</summary>
                      {/* eslint-disable-next-line @next/next/no-img-element -- file from the read-only mount, loaded only when opened */}
                      <img src={r.gif} alt={`GIF การทดสอบ ${r.id}`} loading="lazy" />
                    </details>
                  ) : (
                    <span className="muted small">ไม่มี GIF</span>
                  )}
                  {r.mp4 && (
                    <a href={r.mp4} data-testid={`project-tc-mp4-${r.id}`} target="_blank" rel="noopener noreferrer">
                      MP4
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
