// GFM markdown → HTML for the /project portal. Raw HTML in the files is shown as text (never executed),
// links between files become portal routes, ```mermaid blocks become <pre class="mermaid"> (rendered in the browser
// by the local mermaid package — no CDN).
import path from "node:path";
import { Marked } from "marked";
import type { Tokens } from "marked";
import { ALLOWED_EXT, REPO_PATH } from "./project";
import type { MountRoot } from "./project";

export type TocItem = { id: string; text: string; depth: number };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/g, "")
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  return s || "section";
}

/** where a link written in a markdown file points to, as a portal URL (or null = not served by the portal) */
export function portalHref(href: string, from: { root: MountRoot; rel: string }): { url: string | null; external?: boolean } {
  if (/^(https?:|mailto:)/i.test(href)) return { url: href, external: true };
  if (href.startsWith("#")) return { url: href };
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/")) return { url: null }; // javascript:, file:, absolute paths
  const [rawPath, hash] = href.split("#");
  let p: string;
  try {
    p = decodeURI(rawPath);
  } catch {
    return { url: null };
  }
  const here = path.posix.dirname(`${REPO_PATH[from.root]}/${from.rel}`);
  const repo = path.posix.normalize(path.posix.join(here, p));
  if (repo.startsWith("..")) return { url: null };
  const suffix = hash ? `#${hash}` : "";
  const enc = (s: string) => s.split("/").map(encodeURIComponent).join("/");
  for (const root of ["docs", "test-report"] as MountRoot[]) {
    const prefix = REPO_PATH[root];
    if (repo === prefix || repo === prefix + "/") return { url: root === "docs" ? "/project/docs" : "/project/report" };
    if (!repo.startsWith(prefix + "/")) continue;
    const rest = repo.slice(prefix.length + 1);
    const ext = path.posix.extname(rest).toLowerCase();
    if (ext === ".md") return { url: (root === "docs" ? "/project/docs/" : "/project/report/") + enc(rest) + suffix };
    if (ALLOWED_EXT[ext]) return { url: `/project/files/${root}/${enc(rest)}` };
    return { url: null };
  }
  return { url: null };
}

export function renderMarkdown(md: string, from: { root: MountRoot; rel: string }): { html: string; toc: TocItem[]; mermaidBlocks: number } {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  let mermaidBlocks = 0;
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, { tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(text);
        const n = used.get(id) ?? 0;
        used.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth <= 3) toc.push({ id, text: inner.replace(/<[^>]*>/g, ""), depth });
        return `<h${depth} id="${esc(id)}">${inner}</h${depth}>\n`;
      },
      link(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, { href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const t = portalHref(href, from);
        if (!t.url) return `<span class="md-offsite" title="${esc(href)} (ไม่ได้เปิดผ่าน portal)">${inner}</span>`;
        const ext = t.external ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a href="${esc(t.url)}"${title ? ` title="${esc(title)}"` : ""}${ext}>${inner}</a>`;
      },
      image({ href, title, text }: Tokens.Image) {
        const t = portalHref(href, from);
        if (!t.url || t.external) return `<span class="md-offsite">[${esc(text || href)}]</span>`;
        return `<img src="${esc(t.url)}" alt="${esc(text || path.posix.basename(href))}"${title ? ` title="${esc(title)}"` : ""} loading="lazy">`;
      },
      code({ text, lang }: Tokens.Code) {
        if ((lang ?? "").trim().toLowerCase() === "mermaid") {
          mermaidBlocks++;
          return `<pre class="mermaid" data-testid="project-mermaid">${esc(text)}</pre>\n`;
        }
        return `<pre class="md-code"><code${lang ? ` data-lang="${esc(lang)}"` : ""}>${esc(text)}</code></pre>\n`;
      },
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return esc(text);
      },
    },
  });
  let html = marked.parse(md, { async: false }) as string;
  // wide tables scroll inside their own box (375 px, no page scroll)
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  return { html, toc, mermaidBlocks };
}
