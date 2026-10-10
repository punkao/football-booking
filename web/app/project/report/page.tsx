import Link from "next/link";
import { DocView } from "@/components/DocView";
import { listReportDir, listReports, mdTitle, readMountText } from "@/lib/server/project";

/** /project/report — 10-TEST-REPORT.md + every e2e/test-report/*.md + BUG_MODE screenshots */
export default async function ReportPage() {
  const [md, reports, shots] = await Promise.all([readMountText("docs", "10-TEST-REPORT.md"), listReports(), listReportDir("bugmode1")]);
  const titled = await Promise.all(reports.map(async (r) => ({ file: r, title: mdTitle(await readMountText("test-report", r), r) })));
  const pngs = shots.filter((f) => f.toLowerCase().endsWith(".png"));
  return (
    <>
      <DocView root="docs" rel="10-TEST-REPORT.md" md={md ?? "# 10 · TEST REPORT\n\nยังไม่มีไฟล์ `docs/10-TEST-REPORT.md`"} />
      <div className="container" style={{ paddingBottom: 32 }}>
        <section className="card" aria-labelledby="h-runs">
          <h2 id="h-runs">รายงานทุกฉบับใน e2e/test-report ({reports.length})</h2>
          {reports.length === 0 ? (
            <p className="muted" data-testid="project-no-report">
              ยังไม่มีผลทดสอบ — รัน <code>cd e2e &amp;&amp; npm test</code>
            </p>
          ) : (
            <ul className="list doc-list">
              {titled.map((r) => (
                <li key={r.file} className="spread">
                  <Link href={`/project/report/${r.file}`} data-testid={`project-report-${r.file}`}>
                    {r.title}
                  </Link>
                  <code className="small muted">{r.file}</code>
                </li>
              ))}
            </ul>
          )}
        </section>
        {pngs.length > 0 && (
          <section className="card" aria-labelledby="h-bug" style={{ marginTop: 16 }}>
            <h2 id="h-bug">ภาพตอนจับบั๊กที่ฝัง (BUG_MODE=1)</h2>
            <div className="shot-grid" data-testid="project-bugmode-shots">
              {pngs.map((f) => (
                <figure key={f}>
                  <a href={`/project/files/test-report/bugmode1/${f}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- file from the read-only mount */}
                    <img src={`/project/files/test-report/bugmode1/${f}`} alt={`ภาพหน้าจอ BUG_MODE=1 ${f.replace(/\.png$/, "")}`} loading="lazy" />
                  </a>
                  <figcaption className="small">{f}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
