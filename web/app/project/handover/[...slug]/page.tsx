import Link from "next/link";
import { notFound } from "next/navigation";
import { DocView } from "@/components/DocView";
import { HANDOVER_MD, readMountText, safeResolve } from "@/lib/server/project";

/** /project/handover/<repo path>.md — one handover file (part D: change requests, release notes, UAT, regression, traceability) */
export default async function HandoverDocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const segs = slug.map((s) => decodeURIComponent(s));
  const rel = segs.join("/");
  if (!HANDOVER_MD.test(rel)) notFound();
  const file = await safeResolve("handover", segs, [".md"]);
  if (!file) notFound();
  const md = (await readMountText("handover", rel)) ?? "";
  return (
    <DocView root="handover" rel={rel} md={md}>
      <nav className="doc-pager small" aria-label="กลับ">
        <Link href="/project#h-handover">← ส่วนส่งมอบ (CR-01…06) ในหน้าภาพรวม</Link>
        <span />
      </nav>
    </DocView>
  );
}
