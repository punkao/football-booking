import Link from "next/link";
import { Ready } from "@/components/ui";
import { listDocs, mdTitle, readMountText } from "@/lib/server/project";

type DocRow = { file: string; title: string };

function DocList({ items }: { items: DocRow[] }) {
  return (
    <ul className="list doc-list">
      {items.map((r) => (
        <li key={r.file} className="spread">
          <Link href={`/project/docs/${r.file}`} data-testid={`project-doc-${r.file}`}>
            {r.title}
          </Link>
          <code className="small muted">{r.file}</code>
        </li>
      ))}
    </ul>
  );
}

/** /project/docs — every document in docs/ (incl. trace/) sorted by file number */
export default async function DocsIndex() {
  const docs = await listDocs();
  const rows = await Promise.all(docs.map(async (d) => ({ file: d, title: mdTitle(await readMountText("docs", d), d) })));
  const top = rows.filter((r) => !r.file.startsWith("trace/"));
  const trace = rows.filter((r) => r.file.startsWith("trace/"));
  return (
    <main className="page container">
      <Ready />
      <h1 className="page-title">เอกสาร ({docs.length})</h1>
      {docs.length === 0 && <p className="muted">ไม่พบเอกสาร (ยังไม่ได้ mount <code>docs/</code>)</p>}
      <section className="card" aria-labelledby="h-main">
        <h2 id="h-main">เอกสารหลัก 00–10</h2>
        <DocList items={top} />
      </section>
      <section className="card" aria-labelledby="h-trace" style={{ marginTop: 16 }}>
        <h2 id="h-trace">บันทึกการทำงาน (trace/)</h2>
        <DocList items={trace} />
      </section>
    </main>
  );
}
