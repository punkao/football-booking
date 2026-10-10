#!/usr/bin/env node
// Phase 10: checks the /project portal (docs/08c-PORTAL-PROMPT.md "ตรวจเองก่อนส่ง" 3–4) with Playwright from ../tools.
//  - every portal page + every document in docs/ + every report in e2e/test-report: no console error, data-ready
//  - every ```mermaid block becomes an SVG · internal portal links answer (no 404) · 375 px: no horizontal scroll
//  - numbers on /project equal the numbers counted again here from the files · path traversal is refused · Range works
//  - screenshots selfcheck/screens/p10-*.png at 1280 and 375 px
//
//   node selfcheck/portal-check.mjs                    (BASE_URL defaults to http://localhost:3000)
//   NO_REPORT_URL=http://localhost:3001 node selfcheck/portal-check.mjs   (also checks a site started without test results)
import http from "node:http";
import path from "node:path";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "D:/ms-playwright";
const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(path.resolve(here, "../../tools/node_modules/@playwright/test/index.mjs")).href);
const BASE = process.env.BASE_URL || "http://localhost:3000";
const REPO = path.resolve(here, "../..");
const DOCS = path.join(REPO, "docs");
const REPORT = path.join(REPO, "e2e/test-report");
const OUT = path.join(here, "screens");
await mkdir(OUT, { recursive: true });

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok: !!ok, detail });
  if (!ok || process.env.VERBOSE) console.log(`${ok ? "PASS" : "FAIL"}  ${id}${ok ? "" : `  -> ${detail}`}`);
};
const ls = async (d) => (await readdir(d).catch(() => [])).sort((a, b) => a.localeCompare(b, "en"));
const read = (f) => readFile(f, "utf8").catch(() => null);

// ---------------------------------------------------------------- recount from the files (independent of the web code)
const docs = [...(await ls(DOCS)).filter((f) => f.endsWith(".md")), ...(await ls(path.join(DOCS, "trace"))).filter((f) => f.endsWith(".md")).map((f) => `trace/${f}`)];
const reports = (await ls(REPORT)).filter((f) => f.endsWith(".md"));
const rowsOf = (md) => md.split(/\r?\n/).filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
const req = await read(path.join(DOCS, "04-REQUIREMENTS.md"));
const us = await read(path.join(DOCS, "03-USER-STORIES.md"));
const plan = await read(path.join(DOCS, "09-TEST-PLAN.md"));
const first = (re) => new Set(rowsOf(req).map((r) => r[0]).filter((c) => re.test(c))).size;
const tcRows = rowsOf(plan).filter((r) => /^TC-[A-Z0-9]+-\d+/.test(r[0]) && /^P[123]$/.test(r[4] ?? ""));
const expected = {
  "project-count-us": new Set(us.match(/^###\s+US-\d+/gm)).size,
  "project-count-fr": first(/^FR-\d+$/),
  "project-count-br": first(/^BR-\d+$/),
  "project-count-nfr": first(/^NFR-\d+$/),
  "project-count-tc": tcRows.length,
  "project-count-p1": tcRows.filter((r) => r[4] === "P1").length,
  "project-count-p2": tcRows.filter((r) => r[4] === "P2").length,
  "project-count-p3": tcRows.filter((r) => r[4] === "P3").length,
};
const resultsJson = JSON.parse((await read(path.join(REPORT, "results.json"))) ?? "null");
if (resultsJson) {
  const rows = Object.entries(resultsJson.runs).filter(([k]) => k !== "setup").flatMap(([, v]) => v.rows);
  const passed = rows.filter((r) => r.status === "passed").length;
  const failed = rows.filter((r) => ["failed", "timedOut", "interrupted"].includes(r.status)).length;
  expected["project-run-passed"] = passed;
  expected["project-run-total"] = passed + failed;
  expected["project-run-p1-failed"] = rows.filter((r) => r.priority === "P1" && !["passed", "skipped"].includes(r.status)).length;
  const info = JSON.parse((await read(path.join(REPORT, "run-info.json"))) ?? "{}");
  expected["project-run-bugmode"] = String(info.bugModeFromHtml ?? info.bugModeFromReset ?? "");
}
const ten = await read(path.join(DOCS, "10-TEST-REPORT.md"));
const caught = ten?.match(/จับได้\s*\**\s*(\d+)\s*\/\s*(\d+)/);
if (caught) {
  expected["project-bugs-caught"] = Number(caught[1]);
  expected["project-bugs-planted"] = Number(caught[2]);
}
const mermaidIn = async (file) => ((await read(file)) ?? "").match(/^```mermaid\s*$/gm)?.length ?? 0;

// ---------------------------------------------------------------- browser pages
const pages = [
  { name: "overview", url: "/project" },
  { name: "docs", url: "/project/docs" },
  { name: "testcases", url: "/project/testcases" },
  { name: "traceability", url: "/project/traceability" },
  { name: "report", url: "/project/report", source: path.join(DOCS, "10-TEST-REPORT.md") },
  ...docs.map((d) => ({ name: `doc:${d}`, url: `/project/docs/${d}`, source: path.join(DOCS, d) })),
  ...reports.map((r) => ({ name: `report:${r}`, url: `/project/report/${r}`, source: path.join(REPORT, r) })),
];
const SHOTS = {
  overview: "p10-overview",
  docs: "p10-docs",
  testcases: "p10-testcases",
  traceability: "p10-traceability",
  report: "p10-report",
  "doc:04-REQUIREMENTS.md": "p10-doc-requirements",
  "doc:06-SA.md": "p10-doc-sa-mermaid",
  "report:TEST-REPORT.md": "p10-report-run",
};

const browser = await chromium.launch();
const links = new Set();
for (const width of [1280, 375]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 812 : 900 }, deviceScaleFactor: 1 });
  for (const pg of pages) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const res = await page.goto(BASE + pg.url, { waitUntil: "domcontentloaded" });
    check(`${pg.name}@${width}.status`, res?.status() === 200, `${res?.status()}`);
    const ready = await page
      .waitForSelector('html[data-ready="true"]', { state: "attached", timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    check(`${pg.name}@${width}.ready`, ready);
    if (pg.source) {
      const want = await mermaidIn(pg.source);
      const got = await page.evaluate(() => ({
        blocks: document.querySelectorAll("pre.mermaid").length,
        svgs: document.querySelectorAll('pre.mermaid[data-rendered="true"] > svg').length,
      }));
      if (want || got.blocks) check(`${pg.name}@${width}.mermaid`, got.blocks === want && got.svgs === want, `md ${want} · blocks ${got.blocks} · svg ${got.svgs}`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (width === 375) check(`${pg.name}@375.no-hscroll`, overflow <= 0, `${overflow}px`);
    const h1 = await page.locator("h1").count();
    check(`${pg.name}@${width}.has-h1`, h1 >= 1, `${h1}`);
    const noAlt = await page.evaluate(() => [...document.querySelectorAll("main img")].filter((i) => !i.getAttribute("alt")).length);
    check(`${pg.name}@${width}.img-alt`, noAlt === 0, `${noAlt} img without alt`);
    if (width === 1280) for (const h of await page.$$eval('a[href^="/project"]', (as) => as.map((a) => a.getAttribute("href")))) links.add(h.split("#")[0]);
    if (SHOTS[pg.name]) await page.screenshot({ path: path.join(OUT, `${SHOTS[pg.name]}-${width}.png`), fullPage: true });
    check(`${pg.name}@${width}.console`, errors.length === 0, errors.join(" | ").slice(0, 400));
    await page.close();
  }
  await ctx.close();
}

// ---------------------------------------------------------------- numbers on /project
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/project");
  for (const [id, want] of Object.entries(expected)) {
    const got = await page.getByTestId(id).getAttribute("data-value").catch(() => null);
    check(`numbers.${id}`, String(got) === String(want), `page ${got} · files ${want}`);
  }
  // testcases page: filter + GIF opens in the page
  await page.goto(BASE + "/project/testcases");
  await page.waitForSelector('html[data-ready="true"]', { state: "attached" });
  const all = Number(await page.getByTestId("project-tc-shown").getAttribute("data-value"));
  check("testcases.all-rows", all === expected["project-count-tc"], `${all}`);
  await page.getByTestId("project-tc-filter-priority").selectOption("P3");
  const p3 = Number(await page.getByTestId("project-tc-shown").getAttribute("data-value"));
  check("testcases.filter-P3", p3 === expected["project-count-p3"], `${p3}`);
  await page.getByTestId("project-tc-filter-priority").selectOption("");
  const skipped = await page.locator('[data-testid^="project-tc-skip-"]').count();
  check("testcases.skip-reason", skipped >= 1 || !resultsJson, `${skipped}`);
  const gifSummary = page.locator('[data-testid^="project-tc-gif-"]').first();
  if (await gifSummary.count()) {
    await gifSummary.click();
    const img = gifSummary.locator("xpath=..").locator("img");
    await img.waitFor();
    const ok = await img.evaluate((i) => new Promise((r) => (i.complete ? r(i.naturalWidth > 0) : (i.onload = () => r(i.naturalWidth > 0), i.onerror = () => r(false)))));
    check("testcases.gif-opens", ok);
  }
  await page.goto(BASE + "/project/traceability");
  const miss = await page.getByTestId("project-trace-missing").getAttribute("data-value");
  check("traceability.missing-0", miss === "0", miss);
  await ctx.close();
}
await browser.close();

// ---------------------------------------------------------------- internal links
for (const href of [...links].sort()) {
  const isFile = href.startsWith("/project/files/");
  const r = await fetch(BASE + href, { redirect: "manual", headers: isFile ? { range: "bytes=0-0" } : {} });
  await r.body?.cancel();
  check(`link ${href}`, isFile ? r.status === 206 || r.status === 200 : r.status === 200, `${r.status}`);
}
check("links.count", links.size > 50, `${links.size}`);

// ---------------------------------------------------------------- path traversal + Range (raw paths, no URL normalising)
const raw = (p, headers = {}) =>
  new Promise((resolve) => {
    const u = new URL(BASE);
    const req = http.request({ host: u.hostname, port: u.port, path: p, method: "GET", headers }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", (e) => resolve({ status: 0, body: String(e) }));
    req.end();
  });
const attacks = [
  "/project/files/docs/../../web/BUGS.md",
  "/project/files/docs/..%2F..%2Fweb%2FBUGS.md",
  "/project/files/docs/%2e%2e/%2e%2e/web/BUGS.md",
  "/project/files/docs/..%5C..%5Cweb%5CBUGS.md",
  "/project/files/test-report/../../../web/BUGS.md",
  "/project/files/test-report/gifs/_before-7.5b",
  "/project/files/docs/%2Fetc%2Fpasswd",
  "/project/files/docs/C:%5CWindows%5Cwin.ini",
  "/project/files/web/SPEC.md",
  "/project/files/docs/04-REQUIREMENTS.txt",
  "/project/files/docs/trace/phase3-n5-attempt1.txt",
  "/project/files/docs/diagrams",
  "/project/docs/..%2F..%2FPLAN.md",
  "/project/docs/%2e%2e/web/SPEC.md",
  "/project/report/..%2F..%2Fweb%2FBUGS.md",
];
for (const a of attacks) {
  const r = await raw(a);
  const leaked = /BUG_MODE=1|planted|root:x:|\[fonts\]/i.test(r.body) && r.status === 200;
  check(`traversal ${a}`, r.status !== 200 && !leaked, `${r.status}`);
}
const gif = (await ls(path.join(REPORT, "gifs"))).find((f) => f.endsWith(".gif"));
if (gif) {
  const r = await raw(`/project/files/test-report/gifs/${gif}`, { range: "bytes=10-109" });
  check("range.206", r.status === 206 && r.headers["content-range"]?.startsWith("bytes 10-109/") && r.headers["content-length"] === "100", `${r.status} ${r.headers["content-range"]}`);
  const bad = await raw(`/project/files/test-report/gifs/${gif}`, { range: "bytes=999999999-" });
  check("range.416", bad.status === 416, `${bad.status}`);
}

// ---------------------------------------------------------------- site without test results (optional)
if (process.env.NO_REPORT_URL) {
  for (const p of ["/project", "/project/testcases", "/project/report", "/project/traceability"]) {
    const r = await fetch(process.env.NO_REPORT_URL + p);
    const body = await r.text();
    check(`no-report ${p}`, r.status === 200 && (p === "/project/traceability" || body.includes('data-testid="project-no-report"')), `${r.status}`);
  }
}

const fail = results.filter((r) => !r.ok);
console.log(`\nportal-check: ${results.length} checks · pass ${results.length - fail.length} · fail ${fail.length} · pages ${pages.length} × 2 widths · links ${links.size}`);
process.exit(fail.length ? 1 : 0);
