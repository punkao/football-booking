#!/usr/bin/env node
// workflow-dag.mjs · วาดกราฟงาน (DAG) ของโครงการ จาก docs/workflow/tasks.json
//   node tools/workflow-dag.mjs            อ่าน tasks.json → คำนวณ rank + สายวิกฤต → เขียน workflow-dag.svg + .png
//   node tools/workflow-dag.mjs --costs    คำนวณ cost (ชม.) ของงานที่มาจาก git ใหม่ แล้วเขียนกลับ tasks.json ก่อนวาด
//   node tools/workflow-dag.mjs --no-png   ไม่ render PNG (ใช้เมื่อไม่มี Playwright)
// สูตร: rank(j) = c_j + max rank(k) เมื่อ k ∈ succ(j) · ไม่มีงานต่อ rank = c_j · สายวิกฤต = ทางที่ rank สูงสุด
// self-check: ถ้า rank ใดไม่เท่ากับ c + max(succ) (คำนวณซ้ำอีกวิธี) → exit 1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'docs', 'workflow');
const TASKS = path.join(DIR, 'tasks.json');
const SVG = path.join(DIR, 'workflow-dag.svg');
const PNG = path.join(DIR, 'workflow-dag.png');
const args = new Set(process.argv.slice(2));

const data = JSON.parse(fs.readFileSync(TASKS, 'utf8'));
const { meta, tasks } = data;
const r2 = (x) => Math.round(x * 100) / 100;
const fmt = (x) => String(r2(x));

// ---------- 1) cost จาก git (เฉพาะ --costs) ----------
if (args.has('--costs')) recomputeCosts();

function recomputeCosts() {
  const out = execFileSync('git', ['log', '--reverse', '--format=%h|%at'], { cwd: ROOT, encoding: 'utf8' });
  const commits = out.trim().split('\n').map((l) => { const [h, t] = l.split('|'); return { h, t: Number(t) }; });
  const cap = meta.gapCapHours, min = meta.minCostHours, step = meta.roundHours;
  const gapOf = new Map(); // hash -> ชั่วโมงจาก commit ก่อนหน้า (ถูก cap)
  commits.forEach((c, i) => gapOf.set(c.h, i === 0 ? 0 : Math.min(cap, Math.max(0, (c.t - commits[i - 1].t) / 3600))));
  const find = (p) => commits.find((c) => c.h.startsWith(p) || p.startsWith(c.h));
  const tz = (t) => new Date(t * 1000 + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ');
  for (const t of tasks) {
    if (t.estimated) continue;
    const cs = t.commits.map((p) => { const c = find(p); if (!c) throw new Error(`ไม่พบ commit ${p} (${t.id})`); return c; });
    const gaps = cs.map((c) => gapOf.get(c.h));
    const sum = gaps.reduce((a, b) => a + b, 0);
    t.cost = Math.max(min, Math.round(sum / step) * step);
    t.cost = r2(t.cost);
    t.gapsHours = gaps.map(r2);
    const ts = cs.map((c) => c.t);
    t.period = `${tz(Math.min(...ts))} → ${tz(Math.max(...ts))} (+07)`;
    t.costSource = 'git';
  }
  fs.writeFileSync(TASKS, JSON.stringify(data, null, 2) + '\n');
  console.log('คำนวณ cost จาก git แล้ว:');
  for (const t of tasks) console.log(`  ${t.id.padEnd(6)} ${String(t.cost).padStart(5)} ชม.  ${t.estimated ? '(ประมาณจากแผน)' : ''}`);
}

// ---------- 2) กราฟ · rank · สายวิกฤต ----------
const byId = new Map(tasks.map((t) => [t.id, t]));
if (byId.size !== tasks.length) fail('id ซ้ำ');
for (const t of tasks) {
  t.deps = t.deps || [];
  for (const d of t.deps) if (!byId.has(d)) fail(`${t.id} พึ่ง ${d} ที่ไม่มี`);
  if (!(t.cost > 0)) fail(`${t.id} cost ต้องมากกว่า 0 (รัน --costs ถ้าเป็นงานจาก git)`);
}
const succ = new Map(tasks.map((t) => [t.id, []]));
for (const t of tasks) for (const d of t.deps) succ.get(d).push(t.id);

// topological order (Kahn) · ตรวจวงจร
const indeg = new Map(tasks.map((t) => [t.id, t.deps.length]));
const topo = [];
const q = tasks.filter((t) => indeg.get(t.id) === 0).map((t) => t.id);
while (q.length) {
  const id = q.shift(); topo.push(id);
  for (const s of succ.get(id)) { indeg.set(s, indeg.get(s) - 1); if (indeg.get(s) === 0) q.push(s); }
}
if (topo.length !== tasks.length) fail('มีวงจรในกราฟ (ไม่ใช่ DAG)');

// rank วิธีที่ 1: ย้อนตาม topological order
const rank = new Map();
for (const id of [...topo].reverse()) {
  const s = succ.get(id).map((k) => rank.get(k));
  rank.set(id, byId.get(id).cost + (s.length ? Math.max(...s) : 0));
}
// layer = ความลึกจากต้นทาง (ใช้จัดคอลัมน์)
const layer = new Map();
for (const id of topo) layer.set(id, byId.get(id).deps.length ? 1 + Math.max(...byId.get(id).deps.map((d) => layer.get(d))) : 0);

// สายวิกฤต: เริ่มที่ต้นทางที่ rank สูงสุด แล้วตามงานต่อที่ rank สูงสุด
const sources = tasks.filter((t) => t.deps.length === 0);
let cur = sources.reduce((a, b) => (rank.get(b.id) > rank.get(a.id) ? b : a)).id;
const critical = [cur];
while (succ.get(cur).length) {
  cur = succ.get(cur).reduce((a, b) => (rank.get(b) > rank.get(a) ? b : a));
  critical.push(cur);
}
const critSet = new Set(critical);
const critEdge = new Set(critical.slice(1).map((id, i) => `${critical[i]}>${id}`));
const total = rank.get(critical[0]);

// ---------- 3) self-check (คำนวณ rank ซ้ำอีกวิธี: ค้นเส้นทางยาวสุดแบบ recursion ไม่ใช้ตารางที่คำนวณไว้) ----------
{
  const memo = new Map();
  const longest = (id) => {
    if (memo.has(id)) return memo.get(id);
    const nxt = succ.get(id);
    const v = byId.get(id).cost + (nxt.length ? Math.max(...nxt.map(longest)) : 0);
    memo.set(id, v); return v;
  };
  let bad = 0;
  for (const t of tasks) {
    const s = succ.get(t.id).map((k) => rank.get(k));
    const expect = t.cost + (s.length ? Math.max(...s) : 0);
    if (Math.abs(rank.get(t.id) - expect) > 1e-9 || Math.abs(rank.get(t.id) - longest(t.id)) > 1e-9) {
      console.error(`rank ผิด: ${t.id} rank=${rank.get(t.id)} คาด c+max(succ)=${expect} longest=${longest(t.id)}`); bad++;
    }
  }
  const pathSum = critical.reduce((a, id) => a + byId.get(id).cost, 0);
  if (Math.abs(pathSum - total) > 1e-9) { console.error(`ผลรวม cost บนสายวิกฤต ${pathSum} ≠ rank ต้นทาง ${total}`); bad++; }
  if (Math.abs(total - Math.max(...tasks.map((t) => rank.get(t.id)))) > 1e-9) { console.error('สายวิกฤตไม่ได้เริ่มที่ rank สูงสุด'); bad++; }
  if (bad) { console.error(`self-check ไม่ผ่าน ${bad} จุด`); process.exit(1); }
  console.log(`self-check ผ่าน: ${tasks.length} งาน · rank = c + max(succ) ทุกกล่อง · สายวิกฤต ${critical.length} งาน รวม ${fmt(total)} ชม.`);
}
function fail(m) { console.error('ผิดพลาด: ' + m); process.exit(1); }

// ---------- 4) layout ----------
const W = 160, H = 86, GAPX = 32, LM = 46, RM = 30, PITCH = 140, ARITH = 22, BAND_TITLE = 34, CHANNEL = 54;
const COLS = meta.colsPerBand;
const bandOf = (id) => Math.floor(layer.get(id) / COLS);
const colOf = (id) => layer.get(id) % COLS;
const nBands = Math.max(...tasks.map((t) => bandOf(t.id))) + 1;
const CANVAS_W = LM + COLS * W + (COLS - 1) * GAPX + RM + 16;
const HEADER_H = 218;
const bands = [];
let y = HEADER_H;
for (let b = 0; b < nBands; b++) {
  const ts = tasks.filter((t) => bandOf(t.id) === b);
  const lanes = ts.map((t) => t.lane || 0);
  const minL = Math.min(...lanes), maxL = Math.max(...lanes);
  const top = y;
  const firstBoxY = top + BAND_TITLE + ARITH;
  const bottom = firstBoxY + (maxL - minL) * PITCH + H + 22;
  bands.push({ top, bottom, minL, firstBoxY });
  y = bottom + CHANNEL;
}
const pos = new Map();
for (const t of tasks) {
  const bd = bands[bandOf(t.id)];
  const x = LM + colOf(t.id) * (W + GAPX);
  const by = bd.firstBoxY + ((t.lane || 0) - bd.minL) * PITCH;
  pos.set(t.id, { x, y: by, cx: x + W / 2, cy: by + H / 2, band: bandOf(t.id) });
}
const FOOT_Y = y - CHANNEL + 46;

// ---------- 5) วาด SVG ----------
const FONT = `'Sarabun','Noto Sans Thai','Leelawadee UI','Tahoma','Segoe UI',Arial,sans-serif`;
const COL = {
  opus: { bar: '#6d4cc2', fill: '#efeafc', name: 'Opus (หลัก: วางแผน · รีวิว · ตรวจซ้ำ)' },
  sonnet: { bar: '#0e8a7d', fill: '#e1f4f1', name: 'Sonnet (subagent: ลงมือทำ)' },
};
const ORANGE = '#ee6c0a', GREY = '#8a93a0', ROSE = '#c2347a', INK = '#1d2433';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const thaiLen = (s) => [...s].filter((ch) => !/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(ch)).length;
const text = (x, y2, s, o = {}) =>
  `<text x="${x}" y="${y2}" font-size="${o.size || 13}" fill="${o.fill || INK}"${o.bold ? ' font-weight="700"' : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;

function wrap(s, maxChars) { // ตัดบรรทัดคร่าว ๆ ตามจำนวนตัวอักษร (ไม่นับสระ/วรรณยุกต์ลอย)
  const words = s.split(/(?<=[ →])/);
  const lines = []; let line = '';
  for (const w of words) {
    if (thaiLen(line + w) > maxChars && line) { lines.push(line.trimEnd()); line = w; } else line += w;
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}

const parts = [];
const edgesBase = [], edgesCrit = [];
const busOffset = GAPX / 2;
for (const t of tasks) for (const d of t.deps) {
  const a = pos.get(d), b = pos.get(t.id);
  const sx = a.x + W, sy = a.cy, dx = b.x, dy = b.cy;
  let p;
  if (a.band === b.band) {
    if (sy === dy) p = `M${sx} ${sy} H${dx}`;
    else {
      const mx = b.x - a.x > W + GAPX + 1 ? dx - busOffset : sx + busOffset;
      p = `M${sx} ${sy} H${mx} V${dy} H${dx}`;
    }
  } else {
    const chY = bands[a.band].bottom + CHANNEL / 2 - 2;
    p = `M${sx} ${sy} H${sx + busOffset} V${chY} H${LM - 24} V${dy} H${dx}`;
  }
  (critEdge.has(`${d}>${t.id}`) ? edgesCrit : edgesBase).push(p);
}

const subtitleLines = [
  'วิธีหา cost (c): ชั่วโมงทำงานจริงจากเวลา commit ใน git — แต่ละ commit นับระยะห่างจาก commit ก่อนหน้า (ช่องที่ยาวกว่า 2 ชม. นับ 2 ชม.) รวมต่องาน · ขั้นต่ำ 0.25 ชม. · ปัดทีละ 0.05',
  'กล่องเส้นประ (≈) = เฟสก่อน 10 ต.ค. อยู่ใน commit เดียว (5dce699) ไม่มีเวลาแยก → ประมาณจากแผน/trace ของโครงการเอง · ไม่มีตัวเลข token ในรูปนี้',
];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="__H__" viewBox="0 0 ${CANVAS_W} __H__" font-family="${FONT}" role="img" aria-label="กราฟงาน DAG ของโครงการลูกหนัง อารีน่า พร้อม rank และสายวิกฤต">`);
parts.push(`<title>${esc(meta.title)}</title>`);
parts.push(`<defs>
<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${GREY}"/></marker>
<marker id="ahc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="13" markerHeight="13" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${ORANGE}"/></marker>
</defs>`);
parts.push(`<rect width="${CANVAS_W}" height="__H__" fill="#ffffff"/>`);

// หัว
parts.push(text(LM - 24, 36, meta.title, { size: 24, bold: true }));
parts.push(text(LM - 24, 62, 'กล่อง = งาน (รหัส · ชื่อย่อ · c ชม. · rank) · ลูกศร A → B = B ต้องรอ A เสร็จก่อน · เรียงซ้าย→ขวาตามความลึกของการพึ่งพา (ขึ้นแถวใหม่เมื่อครบ 6 คอลัมน์)', { size: 13, fill: '#454d5e' }));
parts.push(`<rect x="${LM - 24}" y="76" width="${CANVAS_W - 2 * (LM - 24)}" height="36" rx="6" fill="#fff4e8" stroke="${ORANGE}" stroke-width="1.2"/>`);
parts.push(text(LM - 10, 100, 'rank(j) = c_j + max rank(k) , k ∈ งานที่ต้องรอ j · ถ้าไม่มีงานต่อ rank(j) = c_j · rank ของงานแรกสุด = เวลาของสายวิกฤต', { size: 15, bold: true, fill: '#8a3d00' }));
subtitleLines.forEach((l, i) => parts.push(text(LM - 24, 134 + i * 19, l, { size: 12.5, fill: '#454d5e' })));
// legend
{
  let lx = LM - 24; const ly = 170;
  const chip = (c, label, dashed) => {
    parts.push(`<rect x="${lx}" y="${ly - 12}" width="20" height="14" rx="3" fill="${c.fill}" stroke="${c.bar}" stroke-width="1.4"${dashed ? ' stroke-dasharray="4 3"' : ''}/><rect x="${lx}" y="${ly - 12}" width="6" height="14" fill="${c.bar}"/>`);
    parts.push(text(lx + 26, ly, label, { size: 12 })); lx += 26 + thaiLen(label) * 6.2 + 16;
  };
  chip(COL.opus, COL.opus.name);
  chip(COL.sonnet, COL.sonnet.name);
  parts.push(`<circle cx="${lx + 8}" cy="${ly - 5}" r="8" fill="${ROSE}"/>` + `<text x="${lx + 8}" y="${ly - 1}" font-size="11" fill="#fff" text-anchor="middle" font-weight="700">✓</text>`);
  parts.push(text(lx + 22, ly, 'ผู้ใช้ (ร้าน/ผู้อนุมัติ) ตัดสิน', { size: 12 })); lx += 22 + 31 * 6.2 + 12;
  parts.push(`<rect x="${lx}" y="${ly - 12}" width="20" height="14" rx="3" fill="#fff" stroke="${GREY}" stroke-width="1.4" stroke-dasharray="4 3"/>`);
  parts.push(text(lx + 26, ly, 'ประมาณจากแผน', { size: 12 })); lx += 26 + 13 * 6.2 + 14;
  parts.push(`<line x1="${lx}" y1="${ly - 5}" x2="${lx + 26}" y2="${ly - 5}" stroke="${ORANGE}" stroke-width="4.5" marker-end="url(#ahc)"/>`);
  parts.push(text(lx + 36, ly, 'สายวิกฤต', { size: 12 }));
  parts.push(text(LM - 24, ly + 20, 'ผู้ตรวจ (evaluator) ของทุกกล่อง = เทสต์/สคริปต์ (unit · golden · e2e 3 เบราว์เซอร์ · MCP) แล้ว Opus รันซ้ำเองก่อนผ่านด่าน · หลายสี = ทำร่วมกัน (แถบสีซ้ายของกล่อง)', { size: 11.5, fill: '#5b6475' }));
}

// หัวแถบ
bands.forEach((bd, i) => {
  parts.push(`<line x1="${LM - 24}" y1="${bd.top}" x2="${CANVAS_W - RM + 8}" y2="${bd.top}" stroke="#d5dae2" stroke-width="1"/>`);
  parts.push(text(LM - 24, bd.top + 22, meta.bands[i] || `ช่วง ${i + 1}`, { size: 13.5, bold: true, fill: '#3b4357' }));
});

// เส้น
parts.push(`<g fill="none" stroke="${GREY}" stroke-width="1.6" stroke-linejoin="round">${edgesBase.map((p) => `<path d="${p}" marker-end="url(#ah)"/>`).join('')}</g>`);
parts.push(`<g fill="none" stroke="${ORANGE}" stroke-width="4.5" stroke-linejoin="round">${edgesCrit.map((p) => `<path d="${p}" marker-end="url(#ahc)"/>`).join('')}</g>`);

// กล่อง
for (const t of tasks) {
  const p = pos.get(t.id);
  const isC = critSet.has(t.id);
  const main = COL[t.who[0]];
  const lines = t.label.split('\n');
  for (const l of lines) if (thaiLen(l) > 21) console.warn(`คำเตือน: ป้าย "${l}" ของ ${t.id} ยาว ${thaiLen(l)} ตัว อาจล้นกล่อง`);
  const succRanks = succ.get(t.id).map((k) => rank.get(k));
  const arith = succRanks.length
    ? `${fmt(t.cost)} + ${succRanks.length > 1 ? `max(${succRanks.map(fmt).join(', ')})` : fmt(succRanks[0])} = ${fmt(rank.get(t.id))}`
    : `ไม่มีงานต่อ → rank = ${fmt(t.cost)}`;
  let arithLines = [arith];
  if (arith.length > 30 && arith.includes(', ')) { // ยาวเกินกล่อง → ตัดเป็น 2 บรรทัดที่ลูกน้ำกลาง ๆ
    const ps = arith.split(', '); const k = Math.ceil(ps.length / 2);
    arithLines = [ps.slice(0, k).join(', ') + ',', ps.slice(k).join(', ')];
  }
  arithLines.forEach((l, i) => parts.push(text(p.x, p.y - 7 - (arithLines.length - 1 - i) * 14, l, { size: 12, bold: isC, fill: isC ? '#8a3d00' : '#454d5e' })));
  const dash = t.estimated ? ' stroke-dasharray="6 4"' : '';
  parts.push(`<rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="8" fill="${main.fill}" stroke="${isC ? ORANGE : main.bar}" stroke-width="${isC ? 3.2 : 1.6}"${dash}/>`);
  t.who.forEach((w, i) => parts.push(`<rect x="${p.x + 1.5 + i * 6}" y="${p.y + 1.5}" width="6" height="${H - 3}" fill="${COL[w].bar}"${i === 0 ? ` rx="3"` : ''}/>`));
  const tx = p.x + 8 + t.who.length * 6;
  parts.push(text(tx, p.y + 19, t.id, { size: 14.5, bold: true }));
  parts.push(text(tx, p.y + 37, lines[0] || '', { size: 12.5 }));
  parts.push(text(tx, p.y + 52, lines[1] || '', { size: 12.5 }));
  parts.push(text(tx, p.y + 76, `${t.estimated ? 'c≈' : 'c='}${fmt(t.cost)} ชม.`, { size: 12 }));
  parts.push(`<text x="${p.x + W - 8}" y="${p.y + 76}" font-size="13" font-weight="700" fill="${isC ? '#c24d00' : INK}" text-anchor="end">rank ${fmt(rank.get(t.id))}</text>`);
  if (t.badges && t.badges.length) {
    parts.push(`<circle cx="${p.x + W - 3}" cy="${p.y + 3}" r="9" fill="${ROSE}" stroke="#fff" stroke-width="1.5"/><text x="${p.x + W - 3}" y="${p.y + 7}" font-size="12" fill="#fff" text-anchor="middle" font-weight="700">✓</text>`);
    t.badges.forEach((b, i) => parts.push(text(p.x, p.y + H + 14 + i * 13, '✓ ' + b, { size: 11, fill: ROSE })));
  }
}

// กล่องวิธีคิด cost (พื้นที่ว่างท้ายแถบสุดท้าย)
{
  const bd = bands[nBands - 1];
  const used = Math.max(...tasks.filter((t) => bandOf(t.id) === nBands - 1).map((t) => colOf(t.id))) + 1;
  const bx = LM + used * (W + GAPX), bw = CANVAS_W - RM - 16 - bx + 16;
  const lines = [
    ['รวมทั้งโครงการ', true],
    [`${tasks.length} งาน · ผลรวม c ทุกงาน = ${fmt(tasks.reduce((a, t) => a + t.cost, 0))} ชม.`, false],
    [`สายวิกฤต ${critical.length} งาน = ${fmt(total)} ชม. (rank ของ ${critical[0]})`, false],
    [`จาก git ${fmt(tasks.filter((t) => !t.estimated).reduce((a, t) => a + t.cost, 0))} ชม. · ประมาณจากแผน ${fmt(tasks.filter((t) => t.estimated).reduce((a, t) => a + t.cost, 0))} ชม.`, false],
    ['ปฏิทินจริง: เฟส 0–8 วันที่ 9–10 ต.ค. · แผน v5 18–23 ต.ค. 2569', false],
    ['cost = ค่าประมาณจาก git (อาจรวมเวลารอผู้ใช้/ข้ามคืน)', false],
  ];
  const bh = 18 + lines.length * 19;
  const by = bd.firstBoxY - 6;
  parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="#f6f7f9" stroke="#d5dae2"/>`);
  lines.forEach(([s, b], i) => parts.push(text(bx + 12, by + 22 + i * 19, s, { size: 12.5, bold: b, fill: i >= 4 ? '#5b6475' : INK })));
}

// ท้ายภาพ: สายวิกฤต
let fy = FOOT_Y;
parts.push(`<line x1="${LM - 24}" y1="${fy - 18}" x2="${CANVAS_W - RM + 8}" y2="${fy - 18}" stroke="#d5dae2"/>`);
const critText = `สายวิกฤต: ${critical.join(' → ')}`;
const cLines = wrap(critText, 132);
cLines.forEach((l, i) => { parts.push(text(LM - 24, fy + i * 22, l, { size: 15, bold: true, fill: '#8a3d00' })); });
fy += cLines.length * 22 + 2;
parts.push(text(LM - 24, fy, `รวม ${critical.map((id) => fmt(byId.get(id).cost)).join(' + ')} = ${fmt(total)} ชม.`, { size: 13.5, fill: '#8a3d00' }));
fy += 22;
parts.push(text(LM - 24, fy, 'ความหมาย: สายวิกฤตคือทางที่ยาวที่สุดจากงานแรกถึงงานสุดท้าย — งานบนสายนี้ช้า = โครงการช้าตาม · งานนอกสายขนานกันได้ (เช่น CR-01…05 หลัง D-1 · MCP กับ FIX หลัง T1)', { size: 12, fill: '#454d5e' }));
fy += 18;
parts.push(text(LM - 24, fy, 'ในการทำงานจริงมี agent ทำทีละเรื่อง จึงเดินเรียงกัน — เวลาตามนาฬิกาจริงเลยยาวกว่าสายวิกฤตได้ · สร้างจาก docs/workflow/tasks.json ด้วย node tools/workflow-dag.mjs', { size: 12, fill: '#454d5e' }));
fy += 20;

const H_TOTAL = Math.ceil(fy + 8);
const svg = parts.join('\n').replaceAll('__H__', String(H_TOTAL)) + '\n</svg>\n';
fs.writeFileSync(SVG, svg);
console.log(`เขียน ${path.relative(ROOT, SVG)} (${CANVAS_W}×${H_TOTAL})`);
console.log('สายวิกฤต: ' + critical.join(' → ') + ` = ${fmt(total)} ชม.`);

// ---------- 6) PNG ----------
if (!args.has('--no-png')) {
  try {
    process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'D:/ms-playwright';
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: CANVAS_W, height: H_TOTAL }, deviceScaleFactor: 1.5 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`);
    await page.screenshot({ path: PNG, clip: { x: 0, y: 0, width: CANVAS_W, height: H_TOTAL } });
    await browser.close();
    console.log(`เขียน ${path.relative(ROOT, PNG)}`);
  } catch (e) {
    console.warn('render PNG ไม่สำเร็จ (ข้าม): ' + e.message.split('\n')[0]);
  }
}
