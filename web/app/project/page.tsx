import Link from "next/link";
import { redirect } from "next/navigation";
import { Ready } from "@/components/ui";
import { bugsCaught, crRegister, lastNormalRound, latestRun, listDocs, listReports, mountExists, regressionSummary, requirementCounts, testPlan } from "@/lib/server/project";

// Phase 10 portal — overview for the instructor. Every number is counted from docs/ and e2e/test-report/ at run time.

const PHASES: { no: string; name: string; files: string[] }[] = [
  { no: "0", name: "เตรียมเครื่อง + Playwright MCP", files: ["docs/00-ENVIRONMENT.md"] },
  { no: "1", name: "สัมภาษณ์เจ้าของสนาม + ลูกค้า", files: ["docs/01-INTERVIEW.md"] },
  { no: "2", name: "BA + User Story (Loop)", files: ["docs/02-BA.md", "docs/03-USER-STORIES.md", "docs/trace/phase2-loop.md"] },
  { no: "3", name: "REQUIREMENTS → SRS / SA / SAD (Graph)", files: ["docs/04-REQUIREMENTS.md", "docs/05-SRS.md", "docs/06-SA.md", "docs/07-SAD.md", "docs/trace/phase3-graph.md"] },
  { no: "4", name: "BUILD-PROMPT → สร้างเว็บ", files: ["docs/08-BUILD-PROMPT.md", "docs/trace/phase4-build.md"] },
  { no: "5", name: "Playwright MCP เดินเหมือนลูกค้าจริง", files: ["docs/05b-EXPLORATION.md"] },
  { no: "6", name: "TEST-PLAN", files: ["docs/09-TEST-PLAN.md", "docs/09a-TEST-PROMPT.md"] },
  { no: "7", name: "e2e 3 เบราว์เซอร์ + GIF/MP4", files: ["docs/trace/phase6-7-tests.md", "test-report/TEST-REPORT-subagentB.md"] },
  { no: "7.5", name: "แก้เว็บตาม requirement (Loop: แก้ ↔ test ชุดเดิมตรวจ)", files: ["docs/08b-FIX-PROMPT.md", "docs/09b-TEST-PROMPT-7.5.md", "docs/trace/phase7-5-fix.md", "test-report/TEST-REPORT-verify-main-7.5b.md"] },
  { no: "8", name: "BUG_MODE=1 จับบั๊กที่ฝัง", files: ["docs/10-TEST-REPORT.md", "test-report/TEST-REPORT-BUGMODE1.md"] },
];

const LESSONS: { lesson: string; topic: string; files: string[] }[] = [
  { lesson: "00_tester", topic: "LAB สัมภาษณ์", files: ["docs/01-INTERVIEW.md"] },
  { lesson: "00_tester", topic: "User Story", files: ["docs/03-USER-STORIES.md"] },
  { lesson: "00_tester", topic: "REQUIREMENTS (แหล่งความจริงเดียว)", files: ["docs/04-REQUIREMENTS.md"] },
  { lesson: "00_tester", topic: "BUILD-PROMPT", files: ["docs/08-BUILD-PROMPT.md"] },
  { lesson: "00_tester", topic: "TEST-PLAN", files: ["docs/09-TEST-PLAN.md"] },
  { lesson: "00_tester", topic: "Playwright (e2e + GIF/MP4)", files: ["test-report/TEST-REPORT.md", "page:/project/testcases"] },
  { lesson: "00_tester", topic: "BUG_MODE", files: ["docs/10-TEST-REPORT.md", "test-report/TEST-REPORT-BUGMODE1.md"] },
  { lesson: "01 Basic AI Workflow", topic: "Loop", files: ["docs/trace/phase2-loop.md", "docs/trace/phase7-5-fix.md"] },
  { lesson: "01 Basic AI Workflow", topic: "Graph", files: ["docs/trace/phase3-graph.md"] },
  { lesson: "02 MCP", topic: "ติดตั้ง/ใช้ Playwright MCP", files: ["docs/00-ENVIRONMENT.md"] },
  { lesson: "02 MCP", topic: "AI เดินเว็บเหมือนลูกค้า", files: ["docs/05b-EXPLORATION.md"] },
];

const READ_FIRST: { href: string; label: string; why: string }[] = [
  { href: "/project/docs/04-REQUIREMENTS.md", label: "04 · REQUIREMENTS", why: "แหล่งความจริงเดียว: FR / BR พร้อมค่าขอบ / NFR" },
  { href: "/project/docs/10-TEST-REPORT.md", label: "10 · TEST REPORT รวม", why: "ผลก่อน/หลังแก้ และ BUG_MODE เทียบเฉลย" },
  { href: "/project/testcases", label: "Test case + ผลรันล่าสุด", why: "ทุก TC พร้อมผลรายเบราว์เซอร์และ GIF/MP4" },
  { href: "/project/traceability", label: "Traceability", why: "US → FR/BR → TC ไม่มีแถวตกหล่น" },
  { href: "/project/docs/05b-EXPLORATION.md", label: "05b · Exploration (MCP)", why: "AI ใช้เว็บเหมือนลูกค้าจริงผ่าน Playwright MCP" },
];

// Part D (handover after CR-01…06): the files themselves are the source (docs/handover/CHANGE-REQUESTS/REGISTER.md, legacy/REGRESSION-REPORT.md), read through the "handover" mount.
const HANDOVER_LINKS: { href: string; label: string; why: string }[] = [
  { href: "/project/handover/CHANGE-REQUESTS/REGISTER.md", label: "ทะเบียน CR (REGISTER)", why: "สถานะ + commit ของ CR-01…06" },
  { href: "/project/handover/legacy/REGRESSION-REPORT.md", label: "REGRESSION-REPORT", why: "ผลทดสอบรวมตอนส่งมอบ เทียบตอนรับมอบ (2 รอบ)" },
  { href: "/project/handover/legacy/TRACEABILITY.md", label: "TRACEABILITY", why: "CR → คำตอบร้าน → BR → เทสต์ → commit" },
  { href: "/project/handover/legacy/REA-COMPARE.md", label: "REA-COMPARE", why: "เทียบระบบก่อน/หลังด้วยการสกัดกลับ (tag v2-handover ↔ HEAD)" },
  { href: "/project/handover/RELEASE-NOTES.md", label: "RELEASE-NOTES", why: "บันทึกส่งมอบภาษาร้าน + เรื่องที่ยังไม่ได้แก้ (K1…) + คำถามค้าง" },
  { href: "/project/handover/UAT-CHECKLIST.md", label: "UAT-CHECKLIST", why: "ใบตรวจรับรายเรื่อง ให้ร้านกดดูเองและลงชื่อ" },
  { href: "/project/handover/CHANGE-REQUESTS/00-HANDOVER-MEMO.md", label: "00-HANDOVER-MEMO", why: "บันทึกรับมอบระบบจากทีมเดิม" },
  { href: "/project/docs/RUNBOOK.md", label: "RUNBOOK", why: "รัน · สำรอง/กู้คืน · migration · ซ้อมถอยกลับ" },
];

/** "docs/x.md" → portal route (or null when the file is not there) */
async function fileLink(f: string): Promise<{ href: string; label: string } | null> {
  if (f.startsWith("page:")) return { href: f.slice(5), label: f.slice(5) };
  const [root, ...rest] = f.split("/");
  const rel = rest.join("/");
  if (!(await mountExists(root as "docs" | "test-report", rel))) return null;
  return { href: root === "docs" ? `/project/docs/${rel}` : `/project/report/${rel}`, label: root === "docs" ? rel : `e2e/test-report/${rel}` };
}

function Num({ id, value, label, sub }: { id: string; value: number | null; label: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="k">{label}</div>
      <div className="v" data-testid={id} data-value={value ?? ""}>
        {value ?? "–"}
      </div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );
}

export default async function ProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (sp.doc && /^[\w.-]+\.md$/.test(sp.doc)) redirect(`/project/docs/${encodeURIComponent(sp.doc)}`); // old /project?doc= links

  const [counts, plan, run, bugs, docs, reports, normal, crs, regression] = await Promise.all([
    requirementCounts(),
    testPlan(),
    latestRun(),
    bugsCaught(),
    listDocs(),
    listReports(),
    lastNormalRound(),
    crRegister(),
    regressionSummary(),
  ]);
  const pr = (p: string) => plan?.cases.filter((c) => c.priority === p).length ?? null;
  const phases = await Promise.all(PHASES.map(async (p) => ({ ...p, links: (await Promise.all(p.files.map(fileLink))).filter(Boolean) as { href: string; label: string }[] })));
  const lessons = await Promise.all(LESSONS.map(async (l) => ({ ...l, links: (await Promise.all(l.files.map(fileLink))).filter(Boolean) as { href: string; label: string }[] })));

  return (
    <main className="page container">
      <Ready />
      <h1 className="page-title">เอกสารโครงการ · ลูกหนัง อารีน่า</h1>
      <p className="lead-text" data-testid="project-summary">
        ร้านสนามฟุตบอลหญ้าเทียม 3 สนาม (A, B 5 คน กลางแจ้ง · C 7 คน มีหลังคา) เปลี่ยนจากรับจองทาง LINE และจดสมุดมาเป็นเว็บจองออนไลน์
        งานนี้ทำตามบทเรียน: สัมภาษณ์ความต้องการ → เขียน requirement → ให้ AI สร้างเว็บ → พิสูจน์ด้วย Playwright 3 เบราว์เซอร์ว่าทุก feature ทำงานจริง
        และจับบั๊กที่ฝังไว้ได้
      </p>

      <section className="card" aria-labelledby="h-numbers">
        <h2 id="h-numbers">ตัวเลขสำคัญ (นับจากไฟล์จริง)</h2>
        <div className="kpis">
          <Num id="project-count-us" value={counts.us} label="User Story" sub="03-USER-STORIES" />
          <Num id="project-count-fr" value={counts.fr} label="FR" sub="04-REQUIREMENTS" />
          <Num id="project-count-br" value={counts.br} label="BR (มีค่าขอบ)" sub="04-REQUIREMENTS" />
          <Num id="project-count-nfr" value={counts.nfr} label="NFR" sub="04-REQUIREMENTS" />
          <Num id="project-count-tc" value={plan?.cases.length ?? null} label="Test case" sub={`P1 ${pr("P1") ?? "–"} · P2 ${pr("P2") ?? "–"} · P3 ${pr("P3") ?? "–"}`} />
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          ระดับ TC:{" "}
          <span data-testid="project-count-p1" data-value={pr("P1") ?? ""}>
            P1 {pr("P1") ?? "–"}
          </span>{" "}
          ·{" "}
          <span data-testid="project-count-p2" data-value={pr("P2") ?? ""}>
            P2 {pr("P2") ?? "–"}
          </span>{" "}
          ·{" "}
          <span data-testid="project-count-p3" data-value={pr("P3") ?? ""}>
            P3 {pr("P3") ?? "–"}
          </span>{" "}
          (จาก 09-TEST-PLAN)
        </p>
      </section>

      <section className="card" aria-labelledby="h-run" style={{ marginTop: 16 }}>
        <h2 id="h-run">ผลรันล่าสุด (e2e/test-report)</h2>
        {!run ? (
          <p className="muted" data-testid="project-no-report">
            ยังไม่มีผลทดสอบ — รัน <code>cd e2e &amp;&amp; npm test</code>
          </p>
        ) : (
          <>
            <div className="kpis">
              <div className="kpi">
                <div className="k">ผ่าน / ทั้งหมด</div>
                <div className="v">
                  <span data-testid="project-run-passed" data-value={run.passed}>
                    {run.passed}
                  </span>
                  /
                  <span data-testid="project-run-total" data-value={run.total}>
                    {run.total}
                  </span>
                </div>
                <div className="small muted">
                  <span data-testid="project-run-percent" data-value={run.percent}>
                    {run.percent}%
                  </span>{" "}
                  · ข้าม {run.skipped} (ไม่นับในตัวหาร)
                </div>
              </div>
              <div className="kpi">
                <div className="k">P1 ไม่ผ่าน</div>
                <div className="v" data-testid="project-run-p1-failed" data-value={run.p1Failed}>
                  {run.p1Failed}
                </div>
              </div>
              <div className="kpi">
                <div className="k">ผ่านเกณฑ์ (P1 ผ่านหมด + ≥ 95%)</div>
                <div className="v" data-testid="project-run-criteria" data-value={run.meetsCriteria ? "pass" : "fail"}>
                  {run.meetsCriteria ? "✅ ผ่าน" : "❌ ไม่ผ่าน"}
                </div>
                <div className="small muted">
                  BUG_MODE ของรอบนี้:{" "}
                  <b data-testid="project-run-bugmode" data-value={run.bugMode ?? ""}>
                    {run.bugMode ?? "ไม่ทราบ"}
                  </b>
                  {run.bugMode === "1" && " — โหมดฝังบั๊ก ตั้งใจให้ล้ม (ต้องจับบั๊กได้)"}
                </div>
              </div>
              <div className="kpi">
                <div className="k">บั๊กที่ฝัง จับได้</div>
                <div className="v">
                  <span data-testid="project-bugs-caught" data-value={bugs?.caught ?? ""}>
                    {bugs?.caught ?? "–"}
                  </span>
                  /
                  <span data-testid="project-bugs-planted" data-value={bugs?.planted ?? ""}>
                    {bugs?.planted ?? "–"}
                  </span>
                </div>
                <div className="small muted">จาก 10-TEST-REPORT</div>
              </div>
            </div>
            {normal && (
              <p className="alert info" style={{ marginTop: 12 }} data-testid="project-normal-run">
                รอบโหมดปกติ (<code>BUG_MODE=0</code>) ล่าสุดตาม <Link href="/project/docs/10-TEST-REPORT.md">10-TEST-REPORT</Link>: <b>{normal.round}</b> · ผ่าน{" "}
                <b>{normal.passed}</b> · ผ่านเกณฑ์ <b>{normal.criteria}</b>
              </p>
            )}
            <p className="small muted" style={{ marginBottom: 0 }}>
              รันเมื่อ <span data-testid="project-run-at">{run.runAt ? new Date(run.runAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "–"}</span> ·
              project: {run.projects.join(", ")} · ผลแต่ละรอบ (ก่อน/หลังแก้, BUG_MODE=0/1) ดูที่ <Link href="/project/report">รายงานผลทดสอบ</Link>
            </p>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="h-handover" style={{ marginTop: 16 }} data-testid="project-handover">
        <h2 id="h-handover">ส่งมอบ: คำขอเปลี่ยนแปลง CR-01…06 (ส่วน D)</h2>
        <p className="small muted">
          หลังรับมอบระบบ (tag <code>v2-handover</code>) ทีมดูแลระบบทำ CR ทีละเรื่อง: ถามร้าน → อธิบายของเดิม → เทสต์แดง → แก้ → regression · อ่านจากไฟล์จริงตอนเปิดหน้า
        </p>
        {!crs ? (
          <p className="muted" data-testid="project-handover-missing">
            ไม่พบทะเบียน CR (ยังไม่ได้ mount <code>docs/handover/CHANGE-REQUESTS/</code>)
          </p>
        ) : (
          <div className="table-wrap">
            <table className="simple" data-testid="project-cr-table">
              <thead>
                <tr>
                  <th scope="col">CR</th>
                  <th scope="col">เรื่อง</th>
                  <th scope="col">ความเร่งด่วน</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col">commit</th>
                  <th scope="col">เอกสาร</th>
                </tr>
              </thead>
              <tbody>
                {crs.map((c) => (
                  <tr key={c.id} data-testid={`project-cr-${c.id}`}>
                    <td>
                      <b>{c.id}</b>
                      <div className="small muted">{c.received}</div>
                    </td>
                    <td>{c.title}</td>
                    <td className="small">{c.urgency}</td>
                    <td data-testid={`project-cr-status-${c.id}`}>{c.status}</td>
                    <td className="small">{c.commits}</td>
                    <td className="small">
                      <Link href={`/project/handover/CHANGE-REQUESTS/${c.id}.md`}>หนังสือ</Link> · <Link href={`/project/docs/impact/${c.id}.md`}>impact</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 style={{ marginTop: 16 }}>ผล regression ล่าสุด</h3>
        {!regression ? (
          <p className="muted" data-testid="project-regression-missing">
            ไม่พบ <code>legacy/REGRESSION-REPORT.md</code>
          </p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="simple" data-testid="project-regression-table">
                <thead>
                  <tr>
                    <th scope="col">หัวข้อ</th>
                    <th scope="col">ตอนรับมอบ</th>
                    <th scope="col">ตอนส่งมอบ</th>
                  </tr>
                </thead>
                <tbody>
                  {regression.rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>{r.before}</td>
                      <td>{r.now}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="simple" data-testid="project-regression-suites">
                <thead>
                  <tr>
                    <th scope="col">ชุดทดสอบอื่น</th>
                    <th scope="col">ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {regression.suites.map((s) => (
                    <tr key={s.suite}>
                      <td>{s.suite}</td>
                      <td>{s.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>
              ทดสอบที่ commit <code data-testid="project-regression-commit">{regression.commit ?? "–"}</code> · ตัวเลขทั้งหมดมาจาก{" "}
              <Link href="/project/handover/legacy/REGRESSION-REPORT.md">REGRESSION-REPORT</Link> (ส่วนที่ 0, 2, 3)
            </p>
          </>
        )}

        <h3 style={{ marginTop: 16 }}>เอกสารส่งมอบ</h3>
        <ul className="list" data-testid="project-handover-links">
          {HANDOVER_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href}>{l.label}</Link> <span className="small muted">— {l.why}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="two-col rev" style={{ marginTop: 16 }}>
        <section className="card" aria-labelledby="h-first">
          <h2 id="h-first">อ่านอะไรก่อน</h2>
          <ol className="read-first" data-testid="project-read-first">
            {READ_FIRST.map((r) => (
              <li key={r.href}>
                <Link href={r.href}>{r.label}</Link>
                <div className="small muted">{r.why}</div>
              </li>
            ))}
          </ol>
        </section>
        <section className="card" aria-labelledby="h-phases">
          <h2 id="h-phases">เส้นทางงาน เฟส 0–8</h2>
          <ol className="phase-path" data-testid="project-phases">
            {phases.map((p) => (
              <li key={p.no} data-testid={`project-phase-${p.no}`}>
                <span className="phase-no">{p.no}</span>
                <div>
                  <b>{p.name}</b>
                  <div className="small">
                    {p.links.length === 0 ? (
                      <span className="muted">ไม่พบไฟล์</span>
                    ) : (
                      p.links.map((l, i) => (
                        <span key={l.href}>
                          {i > 0 && " · "}
                          <Link href={l.href}>{l.label}</Link>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card" aria-labelledby="h-lessons" style={{ marginTop: 16 }}>
        <h2 id="h-lessons">บทเรียน → งานนี้</h2>
        <div className="table-wrap">
          <table className="simple" data-testid="project-lessons">
            <thead>
              <tr>
                <th scope="col">บทเรียน</th>
                <th scope="col">หัวข้อ</th>
                <th scope="col">หลักฐานในงานนี้</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.lesson + l.topic}>
                  <td>{l.lesson}</td>
                  <td>{l.topic}</td>
                  <td>
                    {l.links.length === 0
                      ? "–"
                      : l.links.map((x, i) => (
                          <span key={x.href}>
                            {i > 0 && " · "}
                            <Link href={x.href}>{x.label}</Link>
                          </span>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two-col" style={{ marginTop: 16 }}>
        <section className="card" aria-labelledby="h-docs">
          <h2 id="h-docs">เอกสารทั้งหมด ({docs.length})</h2>
          {docs.length === 0 && <p className="muted">ไม่พบเอกสาร (ยังไม่ได้ mount)</p>}
          <ul className="list">
            {docs.map((d) => (
              <li key={d}>
                <Link href={`/project/docs/${d}`} data-testid={`project-doc-${d}`}>
                  {d}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <aside className="card" aria-labelledby="h-reports">
          <h2 id="h-reports">ผลทดสอบล่าสุด</h2>
          {reports.length === 0 ? (
            <p className="muted" data-testid={run ? "project-no-report" : undefined}>
              ยังไม่มีผลทดสอบ — รัน <code>cd e2e &amp;&amp; npm test</code>
            </p>
          ) : (
            <ul className="list">
              {reports.map((r) => (
                <li key={r} data-testid={`project-report-${r}`}>
                  <Link href={`/project/report/${r}`}>{r}</Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
