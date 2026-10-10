// render-mermaid.mjs — prove every ```mermaid block really renders (not just "looks valid").
// Renders each block with the local mermaid package inside headless Chromium (offline),
// saves docs/diagrams/<file>-<n>.svg and exits 1 if any block fails.
//   node tools/render-mermaid.mjs docs/02-BA.md [more.md ...]
import fs from 'node:fs';
import path from 'node:path';

// Playwright reads this when the module loads, so set it BEFORE importing (no spaces: see docs/00-ENVIRONMENT.md)
process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\ms-playwright';
const { chromium } = await import('@playwright/test');
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'diagrams');
const mermaidJs = fs.readFileSync(path.join(import.meta.dirname, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'), 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const files = process.argv.slice(2);
if (!files.length) { console.log('usage: node tools/render-mermaid.mjs <file.md> ...'); process.exit(2); }

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: mermaidJs });
await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' }));

let failed = 0;
for (const file of files) {
  const text = fs.readFileSync(path.resolve(ROOT, file), 'utf8');
  const blocks = [...text.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
  const base = path.basename(file, '.md');
  for (const [i, code] of blocks.entries()) {
    const res = await page.evaluate(async ([c, id]) => {
      try { return { svg: (await window.mermaid.render(id, c)).svg }; } catch (e) { return { error: String(e?.message ?? e) }; }
    }, [code, `m${i}`]);
    const label = `${file} block ${i + 1}`;
    if (res.error) { failed++; console.log(`FAIL ${label}: ${res.error.split('\n')[0]}`); continue; }
    const svgFile = path.join(OUT, `${base}-${i + 1}.svg`);
    fs.writeFileSync(svgFile, res.svg);
    // PNG copy so a human (or the portal) can look at the actual rendered picture
    const shot = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await shot.setContent(`<body style="margin:16px;background:#fff">${res.svg}</body>`);
    await shot.locator('svg').first().screenshot({ path: svgFile.replace(/\.svg$/, '.png') });
    await shot.close();
    console.log(`OK   ${label} → ${path.relative(ROOT, svgFile)} (+ .png)`);
  }
  if (!blocks.length) console.log(`--   ${file}: no mermaid blocks`);
}
await browser.close();
console.log(failed ? `\n${failed} block(s) failed` : '\nall mermaid blocks rendered');
process.exitCode = failed ? 1 : 0;
