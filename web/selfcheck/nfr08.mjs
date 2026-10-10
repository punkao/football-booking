#!/usr/bin/env node
// NFR-08: time from "open /book" until <html data-ready="true">, 5 runs per browser,
// browsers run one after another (never in parallel). Uses Playwright from ../tools.
//
//   node selfcheck/nfr08.mjs                 (BASE_URL defaults to http://localhost:3000)
//   node selfcheck/nfr08.mjs --runs 5 --browsers chromium,firefox,webkit
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The default browser path under the Windows user folder contains a space and breaks the launch.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "D:/ms-playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const pw = await import(pathToFileURL(path.resolve(here, "../../tools/node_modules/@playwright/test/index.mjs")).href);

const BASE = process.env.BASE_URL || "http://localhost:3000";
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
};
const RUNS = Number(arg("--runs", "5"));
const BROWSERS = arg("--browsers", "chromium,firefox,webkit").split(",");
const LIMIT_MS = 2000;

let allOk = true;
const summary = [];
for (const name of BROWSERS) {
  const browser = await pw[name].launch();
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const t0 = performance.now();
    await page.goto(BASE + "/book", { waitUntil: "commit" });
    await page.waitForSelector('html[data-ready="true"]', { state: "attached", timeout: 15000 });
    times.push(Math.round(performance.now() - t0));
    await ctx.close();
  }
  await browser.close();
  const max = Math.max(...times);
  const ok = max <= LIMIT_MS;
  allOk &&= ok;
  summary.push({ browser: name, times, max, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(9)} ms: ${times.join(", ")}  (max ${max}, limit ${LIMIT_MS})`);
}
console.log(allOk ? "RESULT: OK — every run ≤ 2 s" : "RESULT: NOT OK");
process.exit(allOk ? 0 : 1);
