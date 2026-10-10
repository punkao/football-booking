// Phase 10 portal (/project): reads docs/ and e2e/test-report/ from the read-only mounts at run time (ADR-09).
// Nothing here is hard-coded: every number shown on the portal is counted from these files.
import { createReadStream } from "node:fs";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

export const PROJECT_ROOT = process.env.PROJECT_DIR || "/app/project";
export type MountRoot = "docs" | "test-report";
export const MOUNT_ROOTS: MountRoot[] = ["docs", "test-report"];
/** repo path of each mount (used to resolve links written in the markdown files) */
export const REPO_PATH: Record<MountRoot, string> = { docs: "docs", "test-report": "e2e/test-report" };

export const ALLOWED_EXT: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".json": "application/json; charset=utf-8",
};

/**
 * Safe path inside one mount. Rejects: unknown root, empty / "." / ".." segments, separators or drive letters inside
 * a segment, NUL, extensions outside the allow-list, and anything whose real path (symlinks followed) leaves the mount.
 * Returns null when the path is not allowed or does not exist.
 */
export async function safeResolve(root: string, segments: string[], exts: string[] = Object.keys(ALLOWED_EXT)): Promise<string | null> {
  if (!(MOUNT_ROOTS as string[]).includes(root) || segments.length === 0) return null;
  for (const s of segments) {
    if (!s || s === "." || s === ".." || /[\\/:\0]/.test(s) || s.startsWith("~")) return null;
  }
  const ext = path.extname(segments[segments.length - 1]).toLowerCase();
  if (!exts.includes(ext)) return null;
  const base = path.resolve(PROJECT_ROOT, root);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  try {
    const [realBase, realTarget] = await Promise.all([realpath(base), realpath(target)]);
    if (!realTarget.startsWith(realBase + path.sep)) return null;
    const st = await stat(realTarget);
    return st.isFile() ? realTarget : null;
  } catch {
    return null;
  }
}

export async function readMountText(root: MountRoot, rel: string, maxBytes = 2_000_000): Promise<string | null> {
  const file = await safeResolve(root, rel.split("/"), [".md", ".json"]);
  if (!file) return null;
  const st = await stat(file);
  if (st.size > maxBytes) return null;
  return readFile(file, "utf8");
}

export async function mountExists(root: MountRoot, rel: string): Promise<boolean> {
  return (await safeResolve(root, rel.split("/"))) !== null;
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort((a, b) => a.localeCompare(b, "en"));
  } catch {
    return [];
  }
}

/** docs/*.md then docs/trace/*.md, sorted by file name (= by the number in front) */
export async function listDocs(): Promise<string[]> {
  const base = path.join(PROJECT_ROOT, "docs");
  const top = (await listDir(base)).filter((f) => f.toLowerCase().endsWith(".md"));
  const trace = (await listDir(path.join(base, "trace"))).filter((f) => f.toLowerCase().endsWith(".md")).map((f) => `trace/${f}`);
  return [...top, ...trace];
}

/** e2e/test-report/*.md (TEST-REPORT.md first) */
export async function listReports(): Promise<string[]> {
  const files = (await listDir(path.join(PROJECT_ROOT, "test-report"))).filter((f) => f.toLowerCase().endsWith(".md"));
  return files.sort((a, b) => (a === "TEST-REPORT.md" ? -1 : b === "TEST-REPORT.md" ? 1 : a.localeCompare(b, "en")));
}

/** every file name in a test-report sub folder (gifs, videos, bugmode1) */
export async function listReportDir(sub: string): Promise<string[]> {
  if (!/^[\w.-]+$/.test(sub)) return [];
  return listDir(path.join(PROJECT_ROOT, "test-report", sub));
}

/** the first "# heading" of a markdown file */
export function mdTitle(md: string | null, fallback: string): string {
  const m = md?.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/[`*]/g, "").trim() : fallback;
}

export function streamFile(file: string, start?: number, end?: number) {
  return createReadStream(file, start === undefined ? undefined : { start, end });
}

// ---------------------------------------------------------------------------------------------------------------
// counts (overview)
// ---------------------------------------------------------------------------------------------------------------

/** rows of markdown tables: cells of every line that starts with "|" (header separators skipped) */
export function tableRows(md: string): string[][] {
  return md
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("|") && !/^\|\s*:?-{2,}/.test(l.trim()))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split(/(?<!\\)\|/)
        .map((c) => c.trim()),
    );
}

/** a section of a markdown file: from the heading that matches `start` to the next heading of the same or higher level */
export function section(md: string, start: RegExp): string {
  const lines = md.split(/\r?\n/);
  const i = lines.findIndex((l) => /^#{1,6}\s/.test(l) && start.test(l));
  if (i < 0) return "";
  const level = lines[i].match(/^#+/)![0].length;
  const out: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^(#+)\s/);
    if (m && m[1].length <= level) break;
    out.push(lines[j]);
  }
  return out.join("\n");
}

const uniqueIds = (rows: string[][], re: RegExp) => new Set(rows.map((r) => r[0]).filter((c) => re.test(c)));

export async function requirementCounts() {
  const us = await readMountText("docs", "03-USER-STORIES.md");
  const req = await readMountText("docs", "04-REQUIREMENTS.md");
  const usCount = us ? new Set(us.match(/^#{2,4}\s+US-\d+/gm)?.map((h) => h.replace(/^#+\s+/, "")) ?? []).size : null;
  const rows = req ? tableRows(req) : [];
  const ids = (re: RegExp) => [...uniqueIds(rows, re)].sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
  return {
    us: usCount,
    fr: req ? uniqueIds(rows, /^FR-\d+$/).size : null,
    br: req ? uniqueIds(rows, /^BR-\d+$/).size : null,
    nfr: req ? uniqueIds(rows, /^NFR-\d+$/).size : null,
    frIds: ids(/^FR-\d+$/),
    brIds: ids(/^BR-\d+$/),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// test plan (09) — test cases + traceability
// ---------------------------------------------------------------------------------------------------------------

export type TestCase = { id: string; marks: string; module: string; what: string; rules: string; priority: string; data: string; expected: string };

export async function testPlan(): Promise<{ cases: TestCase[]; frToTc: Map<string, string[]>; brToTc: Map<string, string[]>; nfrToTc: Map<string, string[]> } | null> {
  const md = await readMountText("docs", "09-TEST-PLAN.md");
  if (!md) return null;
  const cases: TestCase[] = [];
  for (const r of tableRows(md)) {
    const m = r[0]?.match(/^(TC-[A-Z0-9]+-\d+)\s*(.*)$/);
    if (!m || r.length < 7 || !/^P[123]$/.test(r[4])) continue;
    if (cases.some((c) => c.id === m[1])) continue;
    cases.push({ id: m[1], marks: m[2], module: r[1], what: r[2], rules: r[3], priority: r[4], data: r[5], expected: r[6] });
  }
  const map = (sec: string, re: RegExp) => {
    const out = new Map<string, string[]>();
    for (const r of tableRows(sec)) {
      for (let i = 0; i + 1 < r.length; i += 2) {
        const ids = r[i].match(re) ?? [];
        const tcs = r[i + 1].match(/TC-[A-Z0-9]+-\d+(?:\s*\(ข้าม[^)]*\))?/g) ?? [];
        for (const id of ids) out.set(id, [...(out.get(id) ?? []), ...tcs]);
      }
    }
    return out;
  };
  return {
    cases,
    frToTc: map(section(md, /FR\s*→\s*TC/), /FR-\d+/g),
    brToTc: map(section(md, /BR\s*→\s*TC/), /BR-\d+/g),
    nfrToTc: map(section(md, /NFR\s*→\s*TC/), /NFR-\d+/g),
  };
}

/** 04 section 5: US → FR / BR */
export async function usTrace(): Promise<{ us: string; fr: string[]; br: string[]; raw: string[] }[] | null> {
  const md = await readMountText("docs", "04-REQUIREMENTS.md");
  if (!md) return null;
  const sec = section(md, /Traceability/i);
  return tableRows(sec)
    .filter((r) => /^US-\d+$/.test(r[0]))
    .map((r) => ({ us: r[0], fr: r[1]?.match(/FR-\d+/g) ?? [], br: r[2]?.match(/BR-\d+/g) ?? [], raw: r }));
}

/** US titles from 03 ("### US-01 · title" or a "**…**" line after the heading) */
export async function usTitles(): Promise<Map<string, string>> {
  const md = (await readMountText("docs", "03-USER-STORIES.md")) ?? "";
  const out = new Map<string, string>();
  const re = /^#{2,4}\s+(US-\d+)\s*[·:—–-]?\s*(.*)$/gm;
  for (const m of md.matchAll(re)) out.set(m[1], m[2].replace(/[*`]/g, "").trim());
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// latest run (e2e/test-report/results.json + run-info.json)
// ---------------------------------------------------------------------------------------------------------------

export type RunRow = { project: string; tc: string; title: string; module: string; priority: string; status: string; error: string; notes?: Record<string, string>; durationMs: number };
export type LatestRun = {
  runAt: string | null;
  bugMode: string | null;
  projects: string[];
  rows: RunRow[];
  passed: number;
  failed: number;
  skipped: number;
  total: number; // passed + failed (skipped not in the denominator — 09 section 7)
  percent: number;
  p1Failed: number;
  meetsCriteria: boolean;
};

export async function latestRun(): Promise<LatestRun | null> {
  const txt = await readMountText("test-report", "results.json", 20_000_000);
  if (!txt) return null;
  let json: { runs?: Record<string, { runAt?: string; rows?: RunRow[] }> };
  try {
    json = JSON.parse(txt);
  } catch {
    return null;
  }
  const runs = json.runs ?? {};
  const projects = Object.keys(runs).filter((p) => p !== "setup");
  const rows = projects.flatMap((p) => (runs[p].rows ?? []).map((r) => ({ ...r, project: r.project ?? p })));
  if (rows.length === 0) return null;
  let info: { bugModeFromHtml?: string | number; bugModeFromReset?: string | number; startedAt?: string } = {};
  try {
    info = JSON.parse((await readMountText("test-report", "run-info.json")) ?? "{}");
  } catch {
    info = {};
  }
  const passed = rows.filter((r) => r.status === "passed").length;
  const failed = rows.filter((r) => r.status === "failed" || r.status === "timedOut" || r.status === "interrupted").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;
  const total = passed + failed;
  const percent = total ? Math.round((passed / total) * 1000) / 10 : 0;
  const p1Failed = rows.filter((r) => r.priority === "P1" && r.status !== "passed" && r.status !== "skipped").length;
  const runAt = projects.map((p) => runs[p].runAt).filter(Boolean).sort().pop() ?? info.startedAt ?? null;
  const bm = info.bugModeFromHtml ?? info.bugModeFromReset;
  return {
    runAt,
    bugMode: bm === undefined ? null : String(bm),
    projects,
    rows,
    passed,
    failed,
    skipped,
    total,
    percent,
    p1Failed,
    meetsCriteria: p1Failed === 0 && percent >= 95,
  };
}

/** 10-TEST-REPORT.md: "จับได้ N/M" of the planted bugs */
export async function bugsCaught(): Promise<{ caught: number; planted: number } | null> {
  const md = await readMountText("docs", "10-TEST-REPORT.md");
  const m = md?.match(/จับได้\s*\**\s*(\d+)\s*\/\s*(\d+)/);
  return m ? { caught: Number(m[1]), planted: Number(m[2]) } : null;
}

/** 10-TEST-REPORT.md section "ภาพรวม": the last round run with BUG_MODE=0 (normal mode) — label, passed, meets criteria */
export async function lastNormalRound(): Promise<{ round: string; passed: string; criteria: string } | null> {
  const md = await readMountText("docs", "10-TEST-REPORT.md");
  if (!md) return null;
  const rows = tableRows(section(md, /ภาพรวม/)).filter((r) => r.some((c) => /BUG_MODE=0/.test(c)));
  const r = rows.pop();
  if (!r || r.length < 6) return null;
  const clean = (c: string) => c.replace(/[*`]/g, "").trim();
  return { round: clean(r[0]), passed: clean(r[3]), criteria: clean(r[5]) };
}
