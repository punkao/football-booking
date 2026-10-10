import Link from "next/link";
import { TestcasesClient } from "./TestcasesClient";
import type { TcRow } from "./TestcasesClient";
import { latestRun, listReportDir, testPlan } from "@/lib/server/project";

const RESULT_PROJECTS = ["chromium", "firefox", "webkit", "serial", "perf-chromium", "perf-firefox", "perf-webkit"];

/** /project/testcases — every TC of 09-TEST-PLAN with the latest result per browser (results.json) and GIF/MP4 */
export default async function TestcasesPage() {
  const [plan, run, gifs, videos] = await Promise.all([testPlan(), latestRun(), listReportDir("gifs"), listReportDir("videos")]);
  const projects = run ? RESULT_PROJECTS.filter((p) => run.projects.includes(p)).concat(run.projects.filter((p) => !RESULT_PROJECTS.includes(p))) : [];
  const rows: TcRow[] = (plan?.cases ?? []).map((c) => {
    const results = (run?.rows ?? []).filter((r) => r.tc === c.id);
    const byProject: TcRow["byProject"] = {};
    for (const r of results) byProject[r.project] = { status: r.status, error: r.error ? r.error.split("\n")[0].slice(0, 300) : "" };
    const statuses = results.map((r) => r.status);
    const overall =
      statuses.length === 0
        ? "none"
        : statuses.some((s) => s === "failed" || s === "timedOut" || s === "interrupted")
          ? "failed"
          : statuses.every((s) => s === "skipped")
            ? "skipped"
            : "passed";
    const skipReason = results.map((r) => r.notes?.skip).find(Boolean) ?? (overall === "skipped" ? "ข้ามตามที่ระบุในแผน" : "");
    return {
      ...c,
      byProject,
      overall,
      skipReason,
      gif: gifs.includes(`${c.id}.gif`) ? `/project/files/test-report/gifs/${c.id}.gif` : null,
      mp4: videos.includes(`${c.id}.mp4`) ? `/project/files/test-report/videos/${c.id}.mp4` : null,
    };
  });
  return (
    <main className="page container">
      <h1 className="page-title">Test case + ผลรันล่าสุด</h1>
      <p className="muted">
        จาก <Link href="/project/docs/09-TEST-PLAN.md">09-TEST-PLAN.md</Link> ({rows.length} TC) และผลรันล่าสุดใน <code>e2e/test-report/results.json</code>
        {run && (
          <>
            {" "}
            · BUG_MODE ของรอบนี้ <b data-testid="project-tc-bugmode">{run.bugMode ?? "?"}</b>
            {run.bugMode === "1" && " (โหมดฝังบั๊ก — TC ที่ล้มคือบั๊กที่ฝังถูกจับได้)"}
          </>
        )}
      </p>
      {!run && (
        <p className="alert info" data-testid="project-no-report">
          ยังไม่มีผลทดสอบ — รัน <code>cd e2e &amp;&amp; npm test</code>
        </p>
      )}
      <TestcasesClient rows={rows} projects={projects} />
    </main>
  );
}
