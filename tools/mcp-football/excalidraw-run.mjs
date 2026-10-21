#!/usr/bin/env node
// excalidraw-run.mjs · Lab 5 (บท 02_MCP/02 ch.5): วาดแผนภาพของ "ระบบเรา" ด้วย mcp-excalidraw-server ในบทบาท MCP client
//   (ไม่มี MCP tool ใน session นี้ จึงเรียก server ผ่าน SDK client เหมือน test-client.mjs แล้วบันทึกทุกการเรียกลง trace)
//
//   node tools/mcp-football/excalidraw-run.mjs [1|2|3|all] [--keep]
//     1 = สถาปัตยกรรม (+ รอบแก้ before/after) · 2 = ลำดับการจอง (มัดจำ/จ่ายที่สนาม) · 3 = N×M -> N+M
//     --keep = ไม่หยุด canvas ตอนจบ (ปกติหยุดเอง)
// canvas: พอร์ต 8892 (พอร์ต 3000 เป็นของเว็บ — ค่าเริ่มของ excalidraw ชนกัน!) · เปิดแท็บใน Chromium (Playwright) ก่อนวาด ตาม troubleshooting ของบท
// ผล: docs/mcp/excalidraw/*.png + *.excalidraw · trace: docs/mcp/excalidraw-trace.jsonl (ต่อท้ายทุกครั้งที่รัน)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { DIAGRAMS } from "./excalidraw-diagrams.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, "docs", "mcp", "excalidraw");
const TRACE = path.join(ROOT, "docs", "mcp", "excalidraw-trace.jsonl");
const CHECK = path.join(os.tmpdir(), "football-excalidraw-checks");
const PORT = process.env.EXCALIDRAW_PORT || "8892";
const URL_ = `http://127.0.0.1:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CHECK, { recursive: true });

const which = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "all";
const keep = process.argv.includes("--keep");
const RUN = new Date().toISOString();
let seq = 0;
let step = "";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(ROOT, "tools", "node_modules", "mcp-excalidraw-server", "dist", "bin.js")],
  env: { ...process.env, PORT, EXPRESS_SERVER_URL: URL_, EXCALIDRAW_EXPORT_DIR: OUT },
  stderr: "pipe",
});
const client = new Client({ name: "football-excalidraw-run", version: "1.0.0" });
await client.connect(transport);
transport.stderr?.on("data", (d) => process.stderr.write(`  [excalidraw-mcp] ${d}`));

/** เรียก tool + เขียน trace 1 บรรทัดต่อการเรียก (ภาพ base64 ถูกแทนด้วยขนาด) */
async function call(name, args = {}) {
  const t0 = Date.now();
  let res, err;
  try {
    res = await client.callTool({ name, arguments: args });
  } catch (e) {
    err = e;
  }
  const parts = res?.content ?? [];
  const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
  const images = parts.filter((p) => p.type === "image");
  const argsLog = JSON.stringify(args);
  fs.appendFileSync(
    TRACE,
    JSON.stringify({
      run: RUN, n: ++seq, step, tool: name,
      args: argsLog.length > 1500 ? { _truncated: `${argsLog.length} chars`, elements: args.elements?.length, head: argsLog.slice(0, 300) } : args,
      isError: !!(res?.isError || err), ms: Date.now() - t0,
      result: err ? String(err.message) : (text.length > 400 ? text.slice(0, 400) + "…" : text) + (images.length ? ` [image ${images.map((i) => Math.round((i.data.length * 3) / 4) + " bytes").join(",")}]` : ""),
    }) + "\n",
  );
  if (err || res.isError) throw new Error(`${name}: ${err ? err.message : text}`);
  return { text, images };
}

async function shot(label) {
  const { images } = await call("get_canvas_screenshot", { scale: 1, renderer: "browser" });
  const f = path.join(CHECK, `${label}.png`);
  if (images[0]) fs.writeFileSync(f, Buffer.from(images[0].data, "base64"));
  console.log(`  screenshot -> ${f}`);
  return f;
}

async function exportBoth(base) {
  await call("export_to_image", { format: "png", filePath: path.join(OUT, `${base}.png`), scale: 2, padding: 30, renderer: "browser" });
  await call("export_scene", { filePath: path.join(OUT, `${base}.excalidraw`) });
  console.log(`  exported ${base}.png + ${base}.excalidraw`);
}

// ---- เปิดแท็บ canvas ก่อนวาด (บทเรียน: canvas ต้องเปิดในเบราว์เซอร์ก่อน) ----
process.env.PLAYWRIGHT_BROWSERS_PATH ||= "D:/ms-playwright";
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
step = "open-canvas";
for (let i = 0; i < 20; i++) {
  try { if ((await fetch(`${URL_}/health`)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
await page.goto(URL_);
await page.waitForTimeout(1500);
fs.appendFileSync(TRACE, JSON.stringify({ run: RUN, n: ++seq, step, tool: "(playwright) page.goto", args: { url: URL_ }, isError: false, result: `title=${await page.title()}` }) + "\n");

try {
  step = "read-guide";
  const guide = await call("read_diagram_guide");
  console.log(`guide: ${guide.text.length} chars`);

  for (const d of DIAGRAMS) {
    if (which !== "all" && String(d.no) !== which) continue;
    console.log(`\n== diagram ${d.no}: ${d.name}`);
    step = `d${d.no}-draw`;
    await call("clear_canvas");
    await call("batch_create_elements", { elements: d.elements });
    await call("set_viewport", { scrollToContent: true }).catch(() => {}); // ตัวช่วยดูในแท็บ (ไม่จำเป็นต่อภาพที่ export)
    await call("describe_scene").then((r) => console.log("  " + r.text.split("\n")[0]));
    await shot(`${d.name}-1`);
    if (d.revise) {
      step = `d${d.no}-export-before`;
      await exportBoth(`${d.name}-before`);
      step = `d${d.no}-revise`;
      for (const op of d.revise) {
        if (op.update) for (const u of op.update) await call("update_element", u);
        if (op.create) await call("batch_create_elements", { elements: op.create });
        if (op.delete) for (const id of op.delete) await call("delete_element", { id });
      }
      await call("describe_scene").then((r) => console.log("  " + r.text.split("\n")[0]));
      await shot(`${d.name}-after`);
    }
    step = `d${d.no}-export`;
    await exportBoth(d.name);
    await page.screenshot({ path: path.join(CHECK, `${d.name}-browser-tab.png`) });
  }
} finally {
  await browser.close();
  await client.close();
  if (!keep) {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "node_modules", "mcp-excalidraw-server", "dist", "bin.js"), "stop"], { env: { ...process.env, EXPRESS_SERVER_URL: URL_ }, encoding: "utf8" });
    console.log("stop canvas:", (r.stdout || r.stderr || "").trim().slice(0, 120));
  }
}
console.log(`\ntrace: ${path.relative(ROOT, TRACE)} · checks: ${CHECK}`);
