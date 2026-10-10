import Link from "next/link";
import { notFound } from "next/navigation";
import { DocView } from "@/components/DocView";
import { readMountText, safeResolve } from "@/lib/server/project";

/** /project/report/<file>.md — one report from e2e/test-report, rendered like the documents */
export default async function ReportFilePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const segs = slug.map((s) => decodeURIComponent(s));
  if (!(await safeResolve("test-report", segs, [".md"]))) notFound();
  const rel = segs.join("/");
  const md = (await readMountText("test-report", rel, 5_000_000)) ?? "";
  return (
    <DocView root="test-report" rel={rel} md={md}>
      <p className="small">
        <Link href="/project/report">← รายงานทั้งหมด</Link>
      </p>
    </DocView>
  );
}
