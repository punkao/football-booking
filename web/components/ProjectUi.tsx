"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Ready } from "@/components/ui";

const LINKS = [
  { href: "/project", id: "project-nav-overview", label: "ภาพรวม" },
  { href: "/project/docs", id: "project-nav-docs", label: "เอกสาร" },
  { href: "/project/testcases", id: "project-nav-testcases", label: "Test case + ผลรัน" },
  { href: "/project/traceability", id: "project-nav-traceability", label: "Traceability" },
  { href: "/project/report", id: "project-nav-report", label: "รายงานผลทดสอบ" },
];

/** sub-menu on every /project/* page */
export function ProjectNav() {
  const p = usePathname();
  return (
    <nav className="project-nav" aria-label="เมนูพอร์ทัลโครงการ" data-testid="project-nav">
      {LINKS.map((l) => {
        const active = l.href === "/project" ? p === "/project" : p.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} data-testid={l.id} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * rendered markdown (HTML made on the server). ```mermaid blocks are drawn here with the local mermaid package
 * (dynamic import, no CDN); data-ready becomes "true" only after every diagram is an SVG.
 */
export function MarkdownBody({ html, testid = "project-doc-content" }: { html: string; testid?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const blocks = ref.current?.querySelectorAll<HTMLElement>("pre.mermaid") ?? [];
      if (blocks.length) {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default", fontFamily: "inherit" });
        for (const [i, el] of [...blocks].entries()) {
          try {
            const { svg } = await mermaid.render(`mmd-${i}-${Math.random().toString(36).slice(2, 8)}`, el.textContent ?? "");
            el.innerHTML = svg;
            el.dataset.rendered = "true";
          } catch (e) {
            el.dataset.rendered = "error";
            el.title = String(e);
          }
        }
      }
      if (alive) setDone(true);
    })();
    return () => {
      alive = false;
    };
  }, [html]);
  return (
    <>
      <Ready when={done} />
      <div ref={ref} className="md" data-testid={testid} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
