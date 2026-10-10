// check-phase2.mjs — CRITIC evidence for phase 2 (criteria locked in docs/trace/phase2-loop.md)
//   C1: every S-xx in 02-BA.md is mapped to >=1 US in the S→US table, and every US cites existing S-xx
//   C2: every US has 1–3 acceptance criteria; criteria without a digit or "quote" are listed for manual review
//   C3: rule values (฿, HH:MM, %, number+unit) in 02/03 exist in 01-INTERVIEW.md, unless the line shows its
//       derivation (= × ÷) · also: summary-table priority counts match the US headings
// usage: node tools/check-phase2.mjs   (exit 1 when any check fails)
import fs from 'node:fs';
import path from 'node:path';

const DOCS = path.resolve(import.meta.dirname, '..', 'docs');
const read = (f) => fs.readFileSync(path.join(DOCS, f), 'utf8');
const interview = read('01-INTERVIEW.md');
const ba = read('02-BA.md');
const us = read('03-USER-STORIES.md');
const out = { C1: [], C2: [], C2_review: [], C3: [], summary: [] };

// ---------- C1 ----------
const sIds = [...ba.matchAll(/^\|\s*(S\d{2})\s*\|/gm)].map((m) => m[1]);
const traceRows = new Map(
  [...us.matchAll(/^\|\s*(S\d{2})\s*\|\s*([^|]+)\|/gm)].map((m) => [m[1], m[2].match(/US-\d{2}/g) ?? []]),
);
const stories = [...us.matchAll(/^### (US-\d{2}) · (.+?) \((Must|Should|Could)\)\s*$([\s\S]*?)(?=^### |^## |\Z)/gm)].map((m) => ({
  id: m[1], title: m[2], prio: m[3], body: m[4],
}));
const usIds = new Set(stories.map((s) => s.id));
for (const s of sIds) {
  const mapped = traceRows.get(s) ?? [];
  if (!mapped.length) out.C1.push(`${s} ไม่มี US รองรับในตาราง S→US`);
  for (const u of mapped) if (!usIds.has(u)) out.C1.push(`${s} อ้าง ${u} ที่ไม่มีอยู่`);
}
for (const st of stories) {
  const src = (st.body.match(/ที่มา:\s*(.+)/)?.[1] ?? '').match(/S\d{2}/g) ?? [];
  if (!src.length) out.C1.push(`${st.id} ไม่มีบรรทัด "ที่มา"`);
  for (const s of src) {
    if (!sIds.includes(s)) out.C1.push(`${st.id} อ้าง ${s} ที่ไม่มีใน 02-BA`);
    else if (!(traceRows.get(s) ?? []).includes(st.id)) out.C1.push(`${st.id} อ้าง ${s} แต่ตาราง S→US แถว ${s} ไม่มี ${st.id}`);
  }
}

// ---------- C2 ----------
for (const st of stories) {
  const acs = [...st.body.matchAll(/^\s+\d\.\s+(.+)$/gm)].map((m) => m[1]);
  if (acs.length < 1 || acs.length > 3) out.C2.push(`${st.id} มีเกณฑ์ยอมรับ ${acs.length} ข้อ (ต้อง 1–3)`);
  acs.forEach((a, i) => {
    if (!/\d/.test(a) && !/"[^"]+"/.test(a)) out.C2_review.push(`${st.id} ข้อ ${i + 1}: ${a}`);
  });
}

// ---------- C3 ----------
const unit = '(?:ชั่วโมง|ชม\\.|นาที|วัน|สัปดาห์|ครั้ง|ชุด|ลูก|ตัว|คน|แตะ)';
const tokenRe = new RegExp(`฿[\\d,]+|\\b\\d{1,2}:\\d{2}\\b|\\d+%|\\d[\\d,]*\\s*${unit}`, 'g');
const norm = (t) => t.replace(/\s+/g, '').replace('ชม.', 'ชั่วโมง');
const allowed = new Set((interview.match(tokenRe) ?? []).map(norm));
for (const [file, text] of [['02-BA.md', ba], ['03-USER-STORIES.md', us]]) {
  text.split('\n').forEach((line, i) => {
    if (/[=×÷]/.test(line)) return; // derivation shown on this line
    for (const t of line.match(tokenRe) ?? []) {
      if (!allowed.has(norm(t))) out.C3.push(`${file}:${i + 1} "${t}" ไม่มีในบทสัมภาษณ์ และบรรทัดไม่แสดงที่มา → ${line.trim().slice(0, 90)}`);
    }
  });
}

// ---------- summary table ----------
const count = (p) => stories.filter((s) => s.prio === p).length;
const total = us.match(/\*\*รวม (\d+)\*\*\s*\|\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*/);
const actual = [stories.length, count('Must'), count('Should'), count('Could')];
if (!total) out.summary.push('หาแถว "รวม" ในตารางสรุปไม่เจอ');
else if (total.slice(1).map(Number).join() !== actual.join())
  out.summary.push(`ตารางสรุปเขียน รวม/Must/Should/Could = ${total.slice(1).join('/')} แต่นับจริงได้ ${actual.join('/')}`);
for (const row of us.matchAll(/^\| [A-I]\. .+? \| (US-\d{2}) – (US-\d{2}) \| (\d+) \| (\d+) \| (\d+) \|/gm)) {
  const [from, to] = [row[1], row[2]].map((x) => Number(x.slice(3)));
  const group = stories.filter((s) => Number(s.id.slice(3)) >= from && Number(s.id.slice(3)) <= to);
  const real = ['Must', 'Should', 'Could'].map((p) => group.filter((s) => s.prio === p).length);
  if (real.join() !== row.slice(3, 6).join()) out.summary.push(`แถว ${row[1]}–${row[2]} เขียน ${row.slice(3, 6).join('/')} นับจริง ${real.join('/')}`);
}

// ---------- report ----------
const status = (k) => (out[k].length ? 'FAIL' : 'PASS');
console.log(`stories=${stories.length} · S-ids=${sIds.length} · Must/Should/Could=${actual.slice(1).join('/')}`);
for (const k of ['C1', 'C2', 'C3', 'summary']) {
  console.log(`\n${k}: ${status(k)}`);
  out[k].forEach((x) => console.log('  - ' + x));
}
console.log(`\nC2 ข้อที่ไม่มีตัวเลขหรือคำพูดในเครื่องหมาย (CRITIC อ่านเอง): ${out.C2_review.length}`);
out.C2_review.forEach((x) => console.log('  ? ' + x));
process.exitCode = ['C1', 'C2', 'C3', 'summary'].some((k) => out[k].length) ? 1 : 0;
