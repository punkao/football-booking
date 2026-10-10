import Link from "next/link";
import { Ready } from "@/components/ui";
import { requirementCounts, testPlan, usTitles, usTrace } from "@/lib/server/project";

const tcId = (s: string) => s.match(/TC-[A-Z0-9]+-\d+/)![0];

function Tc({ list }: { list: string[] }) {
  if (list.length === 0) return <b className="trace-miss">ไม่มี TC</b>;
  return (
    <>
      {list.map((t, i) => (
        <span key={t + i}>
          {i > 0 && ", "}
          <Link href={`/project/testcases#${tcId(t)}`}>{t}</Link>
        </span>
      ))}
    </>
  );
}

/** /project/traceability — US → FR/BR (04 section 5) → TC (09 section 6) · rows without a TC are highlighted */
export default async function TraceabilityPage() {
  const [trace, plan, titles, counts] = await Promise.all([usTrace(), testPlan(), usTitles(), requirementCounts()]);
  const fr = plan?.frToTc ?? new Map<string, string[]>();
  const br = plan?.brToTc ?? new Map<string, string[]>();
  const rows = (trace ?? []).map((t) => {
    const tcs = [...new Set([...t.fr.flatMap((x) => fr.get(x) ?? []), ...t.br.flatMap((x) => br.get(x) ?? [])].map(tcId))].sort();
    return { ...t, tcs };
  });
  const missing = rows.filter((r) => r.tcs.length === 0);
  const { frIds, brIds } = counts;
  const frMissing = frIds.filter((x) => !(fr.get(x)?.length));
  const brMissing = brIds.filter((x) => !(br.get(x)?.length));
  return (
    <main className="page container">
      <Ready />
      <h1 className="page-title">Traceability: US → FR/BR → TC</h1>
      <p className="muted">
        US → FR/BR จาก <Link href="/project/docs/04-REQUIREMENTS.md">04-REQUIREMENTS ส่วนที่ 5</Link> · FR/BR → TC จาก{" "}
        <Link href="/project/docs/09-TEST-PLAN.md">09-TEST-PLAN ส่วนที่ 6</Link>
      </p>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="k">US ที่ไม่มี TC (ต้องเป็น 0)</div>
          <div className={`v${missing.length ? " bad" : ""}`} data-testid="project-trace-missing" data-value={missing.length}>
            {missing.length} / {rows.length}
          </div>
        </div>
        <div className="kpi">
          <div className="k">FR ที่ไม่มี TC</div>
          <div className={`v${frMissing.length ? " bad" : ""}`} data-testid="project-trace-fr-missing" data-value={frMissing.length}>
            {frMissing.length} / {frIds.length}
          </div>
        </div>
        <div className="kpi">
          <div className="k">BR ที่ไม่มี TC</div>
          <div className={`v${brMissing.length ? " bad" : ""}`} data-testid="project-trace-br-missing" data-value={brMissing.length}>
            {brMissing.length} / {brIds.length}
          </div>
        </div>
      </div>
      {!trace && <p className="muted">ไม่พบ 04-REQUIREMENTS.md</p>}
      <div className="table-wrap">
        <table className="simple" data-testid="project-trace-table">
          <thead>
            <tr>
              <th scope="col">US</th>
              <th scope="col">FR</th>
              <th scope="col">BR</th>
              <th scope="col">TC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.us} data-testid={`project-trace-${r.us}`} data-tc-count={r.tcs.length} className={r.tcs.length ? "" : "trace-row-miss"}>
                <th scope="row">
                  {r.us}
                  {titles.get(r.us) && <div className="small muted">{titles.get(r.us)}</div>}
                </th>
                <td>{r.fr.join(", ") || "–"}</td>
                <td>{r.br.join(", ") || r.raw[2] || "–"}</td>
                <td className="small">
                  <Tc list={r.tcs} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <section className="card" aria-labelledby="h-fr">
          <h2 id="h-fr">FR → TC</h2>
          <div className="table-wrap">
            <table className="simple">
              <tbody>
                {frIds.map((x) => (
                  <tr key={x} className={fr.get(x)?.length ? "" : "trace-row-miss"}>
                    <th scope="row">{x}</th>
                    <td className="small">
                      <Tc list={fr.get(x) ?? []} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card" aria-labelledby="h-br">
          <h2 id="h-br">BR → TC</h2>
          <div className="table-wrap">
            <table className="simple">
              <tbody>
                {brIds.map((x) => (
                  <tr key={x} className={br.get(x)?.length ? "" : "trace-row-miss"}>
                    <th scope="row">{x}</th>
                    <td className="small">
                      <Tc list={br.get(x) ?? []} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
