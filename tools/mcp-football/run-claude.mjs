#!/usr/bin/env node
// run-claude.mjs · Lab 7.3 (C3): ให้ Claude Code (host) ค้นพบและเรียก tool ของ server football ผ่าน `claude -p`
// อ่านอย่างเดียว: อนุญาตเฉพาะ check_availability กับ quote (ไม่อนุญาต book)
//
//   node tools/mcp-football/run-claude.mjs                     รัน 1 ครั้ง แล้วเขียน docs/mcp/football-claude-run.md (+ .jsonl)
//   node tools/mcp-football/run-claude.mjs --summarize f.jsonl สรุปผลจากไฟล์ stream-json ที่มีอยู่ (ไม่เรียก API)
//   CLAUDE_BIN=<path ของ claude> เมื่อ `claude` ไม่อยู่ใน PATH · PROMPT="..." เปลี่ยนคำถาม
// config: ดึงเฉพาะ entry "football" จาก .mcp.json (ไม่ปลุก playwright/excalidraw ที่ไม่เกี่ยว) แล้วใช้ --strict-mcp-config
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT_MD = path.join(ROOT, "docs", "mcp", "football-claude-run.md");
const OUT_JSONL = path.join(ROOT, "docs", "mcp", "football-claude-run.jsonl");
const PROMPT = process.env.PROMPT || "วันที่ 14 ตุลาคม 2026 ช่วง 19:00 สนามไหนว่างบ้าง และถ้าเล่น 1 ชั่วโมงที่สนาม B ราคาเท่าไหร่ ตอบเป็นภาษาไทยสั้น ๆ";
const ALLOWED = "mcp__football__check_availability,mcp__football__quote";
const CLAUDE = process.env.CLAUDE_BIN || "claude";

let raw;
const si = process.argv.indexOf("--summarize");
let cmdLine;
if (si >= 0) {
  raw = fs.readFileSync(process.argv[si + 1], "utf8");
  cmdLine = "(สรุปจากไฟล์ที่บันทึกไว้ ไม่ได้เรียกใหม่)";
} else {
  const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, ".mcp.json"), "utf8"));
  const cfg = path.join(os.tmpdir(), "football-only.mcp.json");
  fs.writeFileSync(cfg, JSON.stringify({ mcpServers: { football: mcp.mcpServers.football } }, null, 2));
  const args = ["-p", PROMPT, "--mcp-config", cfg, "--strict-mcp-config", "--allowedTools", ALLOWED, "--output-format", "stream-json", "--verbose", "--max-turns", "8"];
  cmdLine = `${CLAUDE} ${args.map((a) => (/[\s,]/.test(a) ? JSON.stringify(a) : a)).join(" ")}`;
  const r = spawnSync(CLAUDE, args, { cwd: ROOT, encoding: "utf8", timeout: 240_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) { console.error(`เรียก claude ไม่ได้: ${r.error.message} (ตั้ง CLAUDE_BIN)`); process.exit(2); }
  raw = r.stdout;
}

const events = raw.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
// เก็บเฉพาะเหตุการณ์ที่เป็นหลักฐาน (ตัด hook_response ที่ยาวและไม่เกี่ยว)
const keep = events.filter((e) => !(e.type === "system" && String(e.subtype).startsWith("hook_")));
fs.writeFileSync(OUT_JSONL, keep.map((e) => JSON.stringify(e)).join("\n") + "\n");

const init = events.find((e) => e.type === "system" && e.subtype === "init");
const calls = [];
const resultsById = {};
for (const e of events) {
  for (const c of e.message?.content ?? []) {
    if (c.type === "tool_use" && c.name?.startsWith("mcp__")) calls.push(c);
    if (c.type === "tool_result") resultsById[c.tool_use_id] = typeof c.content === "string" ? c.content : JSON.stringify(c.content);
  }
}
const final = events.find((e) => e.type === "result");
const retries = events.filter((e) => e.subtype === "api_retry");
const ok = calls.length > 0 && final && !final.is_error;

const md = [
  `# C3 · Claude Code เรียก tool ของ server football จริง (Lab 7.3)`,
  ``,
  `สถานะ: ${ok ? "✅ LLM เลือกและเรียก tool ได้จริง" : calls.length ? "⚠ เรียก tool แล้วแต่จบไม่สมบูรณ์" : "⚠ ยังไม่มีการเรียก tool โดย LLM (ดู 'ผลจริง')"}`,
  ``,
  `## Prompt`,
  "```text", PROMPT, "```",
  ``,
  `## คำสั่ง (อ่านอย่างเดียว: อนุญาตเฉพาะ 2 tool ไม่มี book)`,
  "```bash", cmdLine, "```",
  ``,
  `## ผลจริง`,
  `- Claude Code: ${init ? `model \`${init.model}\`` : "(ไม่พบ system/init)"} · mcp_servers = \`${JSON.stringify(init?.mcp_servers ?? [])}\``,
  `- tool ที่ host เห็นจาก server: ${(init?.tools ?? []).filter((t) => t.startsWith("mcp__football__")).map((t) => `\`${t}\``).join(", ") || "(ไม่มี)"}`,
  retries.length ? `- api_retry ${retries.length} ครั้ง: error_status=${retries[0].error_status} \`${retries[0].error}\`` : `- api_retry: 0`,
  `- tool ที่ LLM เรียก: ${calls.length}`,
  ...calls.map((c, i) => `  ${i + 1}. \`${c.name}\` args=\`${JSON.stringify(c.input)}\` -> ${(resultsById[c.id] ?? "(ไม่มีผล)").slice(0, 300).replace(/\n/g, " ")}`),
  `- คำตอบสุดท้าย (\`terminal_reason=${final?.terminal_reason ?? "?"}\`, is_error=${final?.is_error ?? "?"}):`,
  "```text", String(final?.result ?? "(ไม่มี)").trim(), "```",
  ``,
  `stream-json (ตัด hook ออก): \`docs/mcp/football-claude-run.jsonl\``,
  ``,
].join("\n");
fs.writeFileSync(OUT_MD, md);
console.log(md);
process.exit(ok ? 0 : 1);
