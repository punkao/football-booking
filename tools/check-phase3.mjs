// check-phase3.mjs — N5 (MERGER) evidence for phase 3 (criteria locked in docs/trace/phase3-graph.md)
//   C1: US→FR/BR coverage · FR/BR cite real sources · SRS/SAD cite only existing ids · every FR cited in SRS
//   C2: ERD entities == contract entities · entities/attributes used in sequence+state exist in ERD
//       · state diagrams use exactly the contract statuses and every state has an "อยู่กับ" note
//   C3: every BR has a boundary column · rule numbers in 04 come from the interview (or show "=")
//       (Mermaid rendering is checked separately with tools/render-mermaid.mjs)
// usage: node tools/check-phase3.mjs   (exit 1 when any check fails)
import fs from 'node:fs';
import path from 'node:path';

const DOCS = path.resolve(import.meta.dirname, '..', 'docs');
const read = (f) => fs.readFileSync(path.join(DOCS, f), 'utf8');
const [interview, ba, us, req, srs, sa, sad] =
  ['01-INTERVIEW.md', '02-BA.md', '03-USER-STORIES.md', '04-REQUIREMENTS.md', '05-SRS.md', '06-SA.md', '07-SAD.md'].map(read);
const out = { C1: [], C2: [], C3: [] };
const uniq = (a) => [...new Set(a)];
const section = (text, startRe, endRe = /^## /m) => {
  const from = text.search(startRe);
  if (from < 0) return '';
  const rest = text.slice(from + 1);
  const to = rest.search(endRe);
  return to < 0 ? rest : rest.slice(0, to);
};

// ---------- ids ----------
const usIds = uniq([...us.matchAll(/^### (US-\d{2})/gm)].map((m) => m[1]));
const sIds = new Set([...ba.matchAll(/^\|\s*(S\d{2})\s*\|/gm)].map((m) => m[1]));
const aIds = new Set([...interview.matchAll(/^\|\s*(A-\d{2})\s*\|/gm)].map((m) => m[1]));
const frRows = [...req.matchAll(/^\|\s*(FR-\d{2})\s*\|(.+)\|\s*([^|]*)\|\s*$/gm)].map((m) => ({ id: m[1], src: m[3] }));
const brRows = [...req.matchAll(/^\|\s*(BR-\d{2})\s*\|([^|]*)\|([^|]*)\|([^|]*)\|\s*$/gm)].map((m) => ({ id: m[1], rule: m[2], edge: m[3].trim(), src: m[4] }));
const nfrIds = new Set([...req.matchAll(/^\|\s*(NFR-\d{2})\s*\|/gm)].map((m) => m[1]));
const frIds = new Set(frRows.map((r) => r.id));
const brIds = new Set(brRows.map((r) => r.id));

// ---------- C1 ----------
const traceSec = section(req, /^## 5\. Traceability/m);
const traceRows = new Map([...traceSec.matchAll(/^\|\s*(US-\d{2})\s*\|([^|]*)\|([^|]*)\|/gm)].map((m) => [m[1], (m[2] + m[3]).match(/(FR|BR)-\d{2}/g) ?? []]));
for (const u of usIds) if (!(traceRows.get(u) ?? []).length) out.C1.push(`${u} ไม่มี FR/BR ในตาราง Traceability ของ 04`);
for (const [u, ids] of traceRows) for (const id of ids) if (!frIds.has(id) && !brIds.has(id)) out.C1.push(`Traceability ${u} อ้าง ${id} ที่ไม่มี`);
for (const r of frRows) {
  const refs = r.src.match(/US-\d{2}/g) ?? [];
  if (!refs.length) out.C1.push(`${r.id} ไม่มี US อ้างอิง`);
  for (const x of refs) if (!usIds.includes(x)) out.C1.push(`${r.id} อ้าง ${x} ที่ไม่มี`);
}
for (const r of brRows) {
  const refs = r.src.match(/S\d{2}(?:–S\d{2})?|A-\d{2}/g) ?? [];
  if (!refs.length) out.C1.push(`${r.id} ไม่มีที่มา S/A`);
  for (const x of refs) {
    const ids = x.includes('–') ? (() => { const [a, b] = x.split('–').map((y) => Number(y.slice(1))); return Array.from({ length: b - a + 1 }, (_, i) => `S${String(a + i).padStart(2, '0')}`); })() : [x];
    for (const id of ids) if (!(sIds.has(id) || aIds.has(id))) out.C1.push(`${r.id} อ้าง ${id} ที่ไม่มี`);
  }
}
for (const [name, text] of [['05-SRS', srs], ['07-SAD', sad]]) {
  for (const id of uniq(text.match(/\b(?:FR|BR|NFR)-\d{2}\b/g) ?? [])) {
    if (!(frIds.has(id) || brIds.has(id) || nfrIds.has(id))) out.C1.push(`${name} อ้าง ${id} ที่ไม่มีใน 04`);
  }
}
const srsFr = new Set(srs.match(/\bFR-\d{2}\b/g) ?? []);
for (const id of frIds) if (!srsFr.has(id)) out.C1.push(`05-SRS ไม่ได้อ้าง ${id}`);

// ---------- C2 ----------
const contractSec = section(req, /^### 1\.1/m, /^### /m);
// entity ของ contract = แถวตาราง 1.1 + รายการ "- `Name` (ตาราง `x_y` · migration …)" ที่ CR เพิ่ม (FieldRate, RevokedSession)
const contractEntities = new Set([...contractSec.matchAll(/^(?:\|\s*|-\s+)`(\w+)`\s*(?:\||\(ตาราง)/gm)].map((m) => m[1]));
const blocks = [...sa.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
const erd = blocks.find((b) => b.trimStart().startsWith('erDiagram')) ?? '';
const erdEntities = new Map([...erd.matchAll(/^\s*(\w+)\s*\{([\s\S]*?)\}/gm)].map((m) => [m[1], new Set([...m[2].matchAll(/^\s*\w+\s+(\w+)/gm)].map((a) => a[1]))]));
for (const e of contractEntities) if (!erdEntities.has(e)) out.C2.push(`entity ${e} อยู่ใน contract แต่ไม่มีใน ERD`);
for (const e of erdEntities.keys()) if (!contractEntities.has(e)) out.C2.push(`entity ${e} อยู่ใน ERD แต่ไม่มีใน contract`);
const flowBlocks = blocks.filter((b) => /^\s*(sequenceDiagram|stateDiagram)/.test(b));
for (const b of flowBlocks) {
  for (const m of b.matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+|Booking|Payment|Customer|Field|Holiday|Challenge)(?:\.(\w+))?\b/g)) {
    const [, ent, attr] = m;
    if (!erdEntities.has(ent)) { out.C2.push(`แผนภาพใช้ ${ent} ที่ไม่มีใน ERD`); continue; }
    if (attr && !erdEntities.get(ent).has(attr)) out.C2.push(`แผนภาพใช้ ${ent}.${attr} ที่ไม่มีใน ERD`);
  }
}
const statusTable = (re) => new Set([...section(req, re, /^### /m).matchAll(/^\|\s*`([A-Z_]+)`\s*\|/gm)].map((m) => m[1]));
const checkState = (label, expected, block) => {
  if (!block) { out.C2.push(`ไม่พบ state diagram ของ ${label}`); return; }
  const used = new Set([...block.matchAll(/\b([A-Z][A-Z_]{2,})\b/g)].map((m) => m[1]).filter((s) => !/^BR$/.test(s)));
  const noted = new Set([...block.matchAll(/note (?:right|left) of ([A-Z_]+):\s*อยู่กับ/g)].map((m) => m[1]));
  for (const s of expected) {
    if (!used.has(s)) out.C2.push(`${label}: สถานะ ${s} ใน contract ไม่มีใน state diagram`);
    if (!noted.has(s)) out.C2.push(`${label}: สถานะ ${s} ไม่มีโน้ต "อยู่กับ"`);
  }
  for (const s of used) if (!expected.has(s)) out.C2.push(`${label}: state diagram มีสถานะ ${s} ที่ไม่อยู่ใน contract`);
};
const states = blocks.filter((b) => b.trimStart().startsWith('stateDiagram'));
checkState('Booking', statusTable(/^### 1\.2/m), states.find((b) => b.includes('PENDING_PAYMENT')));
checkState('Challenge', statusTable(/^### 1\.3/m), states.find((b) => b.includes('AWAITING_PAYMENT')));

// ---------- C3 ----------
for (const r of brRows) if (!r.edge) out.C3.push(`${r.id} ไม่มีค่าขอบที่ต้องทดสอบ`);
const unit = '(?:ชั่วโมง|ชม\\.|นาที|วัน|สัปดาห์|ครั้ง|ชุด|ลูก|ตัว|คน|แตะ)';
const tokenRe = new RegExp(`฿[\\d,]+|\\b\\d{1,2}:\\d{2}\\b|\\d+%|\\d[\\d,]*\\s*${unit}`, 'g');
const norm = (t) => t.replace(/\s+/g, '').replace('ชม.', 'ชั่วโมง');
// numbers come from the interview (01-INTERVIEW) or, for rules changed after delivery, the shop's CR answers (docs/handover/CHANGE-REQUESTS/answers/README.md · [D:CR-0N])
const crAnswers = fs.readFileSync(path.resolve(DOCS, 'handover', 'CHANGE-REQUESTS', 'answers', 'README.md'), 'utf8');
const allowed = new Set([...(interview.match(tokenRe) ?? []), ...(crAnswers.match(tokenRe) ?? [])].map(norm));
const ruleText = section(req, /^## 2\./m, /^## 4\./m); // FR + BR (NFR targets are labelled "ทีมเสนอ")
for (const r of brRows) {
  for (const t of r.rule.match(tokenRe) ?? []) if (!allowed.has(norm(t))) out.C3.push(`${r.id} กฎมีค่า "${t}" ที่ไม่มีในบทสัมภาษณ์`);
  if (!/[=×÷]/.test(r.edge)) for (const t of r.edge.match(tokenRe) ?? []) if (!allowed.has(norm(t))) out.C3.push(`${r.id} ค่าขอบ "${t}" ไม่มีที่มาและไม่แสดง =`);
}
for (const line of ruleText.split('\n').filter((l) => /^\|\s*FR-/.test(l))) {
  for (const t of line.match(tokenRe) ?? []) if (!allowed.has(norm(t))) out.C3.push(`${line.slice(2, 7)} มีค่า "${t}" ที่ไม่มีในบทสัมภาษณ์`);
}

// ---------- report ----------
console.log(`US=${usIds.length} · FR=${frIds.size} · BR=${brIds.size} · NFR=${nfrIds.size} · contract entities=${contractEntities.size} · ERD entities=${erdEntities.size}`);
for (const k of ['C1', 'C2', 'C3']) {
  console.log(`\n${k}: ${out[k].length ? 'FAIL' : 'PASS'}`);
  out[k].forEach((x) => console.log('  - ' + x));
}
process.exitCode = Object.values(out).some((v) => v.length) ? 1 : 0;
