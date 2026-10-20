// สร้าง e2e/plan-cases.json จาก docs/TEST-CASES.md (ฉบับอ่านง่ายของแผนหัวข้อ 5) + docs/TEST-RUN-MCP.md (ภาพ MCP)
//   1 รายการต่อ TC: รหัส · สิ่งที่ทดสอบ · ระดับ · เทคนิค · ที่มา · เฉลย (ผลที่คาดหวัง) · วิธีคิด · โมดูล · ภาพ MCP
//   เฉลยมาจากแผนเท่านั้น (ไม่อ่านจากผลรันหรือจากเว็บ)
// ใช้: node build-plan-cases.mjs   (build-index.mjs เรียกให้เองทุกครั้ง)
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const CASES = path.join(ROOT, 'docs', 'TEST-CASES.md');
const MCP = path.join(ROOT, 'docs', 'TEST-RUN-MCP.md');
const OUT = path.join(here, 'plan-cases.json');

const clean = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
const short = (s, n = 180) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** ค่าหลัง label ตัวหนา เช่น **เฉลย (ผลที่ถูก):** ... (ถึงบรรทัดว่าง) */
function field(block, label) {
  const i = block.indexOf(`**${label}`);
  if (i < 0) return '';
  const rest = block.slice(i).replace(/^\*\*[^*]*\*\*/, '');
  return rest.split(/\n\s*\n|\n(?=\*\*)/)[0].trim();
}

function parseMcp() {
  const map = {};
  if (!fs.existsSync(MCP)) return map;
  for (const line of fs.readFileSync(MCP, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\|\s*(TC-[A-Z0-9]+-\d+)\s*\|/);
    if (!m) continue;
    const cells = line.split('|').map((c) => c.trim());
    const img = (line.match(/\]\((\.\.\/exploration\/mcp-run\/[^)]+\.png)\)/) ?? [])[1];
    const verdict = cells.find((c) => c === '✅' || c.startsWith('⚠️')) ?? '';
    // ภาพจาก TEST-RUN-MCP อ้างจาก docs/ → เก็บเป็น path จากรากโปรเจกต์ exploration/mcp-run/<TC>.png
    const rel = img ? img.replace(/^\.\.\//, '') : '';
    if (!img) continue; // แถวสรุป/หมายเหตุที่ไม่มีภาพ ไม่ใช่แถวผลราย TC
    map[m[1]] = { mcpImage: rel && fs.existsSync(path.join(ROOT, rel)) ? rel : '', mcpVerdict: verdict };
  }
  return map;
}

export function buildPlanCases() {
  const md = fs.readFileSync(CASES, 'utf8').replace(/\r\n/g, '\n');
  const mcp = parseMcp();
  const cases = [];
  let module = '';
  for (const part of md.split(/\n(?=## |### )/)) {
    const mod = part.match(/^## ([A-Z0-9]+) /);
    if (mod) { module = mod[1]; continue; }
    const head = part.match(/^### (TC-[A-Z0-9]+-\d+)(.*)$/m);
    if (!head) continue;
    const id = head[1];
    const title = clean(head[2].replace(/🆕v2/g, '').replace(/^\s*·\s*/, ''));
    // แถวตาราง: | รหัส | ระดับ | เทคนิค | ที่มา | จังหวะตรวจ | วิธีพิสูจน์ | รันผ่าน MCP (A5) |
    const row = part.split('\n').find((l) => l.startsWith(`| ${id} |`));
    const c = row ? row.split('|').slice(1, -1).map((x) => x.trim()) : [];
    const expected = clean(field(part, 'เฉลย'));
    const chat = clean(field(part, 'แชท'));
    cases.push({
      id,
      title,
      module,
      priority: c[1] ?? '?',
      technique: clean(c[2]),
      source: clean(c[3]),
      timing: clean(c[4]),
      method: clean(c[5]),
      mcpA5: clean(c[6]),
      frs: clean(field(part, 'FR/BR/NFR')),
      expected,
      expectedShort: short(expected),
      reasoning: clean(field(part, 'วิธีคิด')),
      ...(chat ? { chat } : {}),
      mcpImage: mcp[id]?.mcpImage ?? '',
      mcpVerdict: mcp[id]?.mcpVerdict ?? '',
    });
  }
  const data = {
    generatedAt: new Date().toISOString(),
    source: 'docs/TEST-CASES.md + docs/TEST-RUN-MCP.md (สร้างโดย e2e/build-plan-cases.mjs)',
    count: cases.length,
    p1: cases.filter((x) => x.priority === 'P1').length,
    cases,
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const d = buildPlanCases();
  const byP = d.cases.reduce((a, x) => ((a[x.priority] = (a[x.priority] ?? 0) + 1), a), {});
  console.log(`plan-cases.json: ${d.count} TC · ${JSON.stringify(byP)} · ภาพ MCP ${d.cases.filter((x) => x.mcpImage).length}`);
}
