import { MarkdownBody } from "@/components/ProjectUi";
import { renderMarkdown } from "@/lib/server/markdown";
import type { MountRoot } from "@/lib/server/project";

/** server component: one markdown file with its table of contents (shared by /project/docs and /project/report) */
export function DocView({ root, rel, md, children }: { root: MountRoot; rel: string; md: string; children?: React.ReactNode }) {
  const { html, toc } = renderMarkdown(md, { root, rel });
  const label = root === "docs" ? `docs/${rel}` : `e2e/test-report/${rel}`;
  return (
    <main className="page container">
      <p className="small muted" style={{ margin: "0 0 8px" }}>
        <code data-testid="project-doc-title">{label}</code>
      </p>
      <div className="doc-layout">
        {toc.length > 1 && (
          <nav className="card doc-toc" aria-label="สารบัญ" data-testid="project-doc-toc">
            <h2 className="small">สารบัญ</h2>
            <ul>
              {toc.map((t) => (
                <li key={t.id} className={`d${t.depth}`}>
                  <a href={`#${t.id}`}>{t.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <article className="card prose">
          <MarkdownBody html={html} />
          {children}
        </article>
      </div>
    </main>
  );
}
