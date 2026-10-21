import { createRequire } from "node:module";
const require = createRequire("D:/work (outside)/Chanwacnich_TA/football-booking/e2e/package.json");
process.env.PLAYWRIGHT_BROWSERS_PATH = "D:/ms-playwright";
const { chromium } = require("@playwright/test");
const OUT = "D:/work (outside)/Chanwacnich_TA/football-booking/docs/ui/mockups";
const jobs = JSON.parse(process.argv[2]); // [[file, hash, w, h, outname, fullPage]]
const browser = await chromium.launch();
for (const [file, hash, w, h, out, full, sy] of jobs) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto("file:///" + OUT.replace(/ /g, "%20") + "/" + file + (hash ? "#" + hash : ""));
  await p.waitForTimeout(400);
  if (sy) { await p.evaluate((y) => window.scrollTo(0, y), sy); await p.waitForTimeout(200); }
  await p.screenshot({ path: OUT + "/" + out, fullPage: !!full });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(out, "scrollWidth", sw, "(viewport", w + ")");
  await ctx.close();
}
await browser.close();
