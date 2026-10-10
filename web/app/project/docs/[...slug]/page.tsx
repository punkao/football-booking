import Link from "next/link";
import { notFound } from "next/navigation";
import { DocView } from "@/components/DocView";
import { listDocs, readMountText, safeResolve } from "@/lib/server/project";

/** /project/docs/<file>.md — one document rendered (GFM + Mermaid + table of contents) */
export default async function DocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const segs = slug.map((s) => decodeURIComponent(s));
  const file = await safeResolve("docs", segs, [".md"]);
  if (!file) notFound();
  const rel = segs.join("/");
  const md = (await readMountText("docs", rel)) ?? "";
  const docs = await listDocs();
  const i = docs.indexOf(rel);
  return (
    <DocView root="docs" rel={rel} md={md}>
      <nav className="doc-pager small" aria-label="เอกสารก่อน/ถัดไป">
        {i > 0 ? <Link href={`/project/docs/${docs[i - 1]}`}>← {docs[i - 1]}</Link> : <span />}
        {i >= 0 && i < docs.length - 1 ? <Link href={`/project/docs/${docs[i + 1]}`}>{docs[i + 1]} →</Link> : <span />}
      </nav>
    </DocView>
  );
}
