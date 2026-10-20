// สร้าง e2e/index.html หน้าเดียว (ดับเบิลคลิกเปิดได้ · file:// · ไม่ต้องมี server · ข้อมูลฝังในหน้า ไม่ใช้ fetch)
//   ข้อมูลเข้า:
//   - e2e/plan-cases.json ← สร้างใหม่จาก docs/TEST-CASES.md ทุกครั้ง (build-plan-cases.mjs) = รายการ TC + เฉลย
//   - <run>/results.json + <run>/run-info.json ← เขียนโดย reporters/tester-report.ts + global-setup.ts
//   - e2e/triage.json (การจำแนกข้อที่ล้ม) · test-report/gifs, test-report/videos (จาก npm run test:gif)
//   - web/SPEC.md, docs/RUNBOOK.md (เฉพาะบรรทัดที่อ้างผล selfcheck ของผู้สร้าง = [A])
//   ตัดสินผ่าน/ไม่ผ่านแยกทีละเบราว์เซอร์ตามแผนหัวข้อ 6.4:
//   P1 ผ่านครบ และผ่านรวม ≥ ⌈95% × 128⌉ · ไม่ได้รัน/ข้าม = ไม่ผ่าน · TC ที่รันใน serial (Chromium ครั้งเดียว) นับให้ทุกเบราว์เซอร์
// ใช้: node build-index.mjs [--run test-report] [--out index.html] [--compare test-report/run-1] [--label "รอบ 2"]
//      [--media test-report/bugmode2] (โฟลเดอร์ที่มี gifs/ videos/ · ค่าเริ่มต้น test-report) [--triage test-report/bugmode2/triage.json] (ค่าเริ่มต้น e2e/triage.json)
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlanCases } from './build-plan-cases.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const arg = (name, fb) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fb; };
const RUN_DIR = path.resolve(here, arg('--run', 'test-report'));
const OUT = path.resolve(here, arg('--out', 'index.html'));
const CMP_DIR = arg('--compare') ? path.resolve(here, arg('--compare')) : '';
const LABEL = arg('--label', '');
const OUT_DIR = path.dirname(OUT);
const REPORT = path.join(here, 'test-report');
const MEDIA = arg('--media') ? path.resolve(here, arg('--media')) : REPORT;
const TRIAGE = arg('--triage') ? path.resolve(here, arg('--triage')) : path.join(here, 'triage.json');
const BROWSERS = ['chromium', 'firefox', 'webkit'];

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
const link = (abs) => path.relative(OUT_DIR, abs).split(path.sep).join('/');
const FAIL = new Set(['failed', 'timedOut', 'interrupted']);

// ---------------------------------------------------------------- ผลต่อ TC ต่อเบราว์เซอร์ (กติกานับ 6.4)
function verdicts(store, cases) {
  const runs = store?.runs ?? {};
  const rowsOf = (project, tc) => (runs[project]?.rows ?? []).filter((r) => r.tc === tc);
  const combine = (rows) => {
    if (!rows.length) return null;
    if (rows.some((r) => FAIL.has(r.status))) return 'failed';
    if (rows.some((r) => r.status === 'skipped')) return 'skipped';
    return 'passed';
  };
  const out = {};
  for (const c of cases) {
    const per = {};
    for (const b of BROWSERS) {
      let src = b, rows = rowsOf(b, c.id);
      if (!rows.length) { src = 'serial'; rows = rowsOf('serial', c.id); }
      if (!rows.length) { src = `perf-${b}`; rows = rowsOf(`perf-${b}`, c.id); }
      const st = combine(rows);
      const err = rows.find((r) => FAIL.has(r.status))?.error ?? '';
      const ms = rows.find((r) => r.notes?.['load-ms'])?.notes['load-ms'];
      per[b] = st
        ? { status: st, src, error: err.replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 6).join('\n').slice(0, 700), ...(ms ? { loadMs: ms } : {}) }
        : { status: 'notrun', src: '' };
    }
    out[c.id] = per;
  }
  return out;
}

function summary(v, cases) {
  const need = Math.ceil(cases.length * 0.95);
  const p1 = cases.filter((c) => c.priority === 'P1');
  const res = {};
  for (const b of BROWSERS) {
    const pass = cases.filter((c) => v[c.id][b].status === 'passed').length;
    const p1pass = p1.filter((c) => v[c.id][b].status === 'passed').length;
    const notRun = cases.filter((c) => ['notrun', 'skipped'].includes(v[c.id][b].status)).map((c) => c.id);
    const failed = cases.filter((c) => v[c.id][b].status !== 'passed').map((c) => c.id);
    res[b] = { pass, total: cases.length, need, p1pass, p1total: p1.length, meets: p1pass === p1.length && pass >= need, notRun, failed };
  }
  return res;
}

// ---------------------------------------------------------------- คำอ้าง [A] ของผู้สร้าง (selfcheck)
function builderClaims() {
  const out = [];
  for (const rel of ['web/SPEC.md', 'docs/RUNBOOK.md']) {
    let txt = '';
    try { txt = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
    txt.split(/\r?\n/).forEach((line, i) => {
      if (/selfcheck\/[\w-]+\.mjs|rules-check|check-testdata/.test(line) && /\d+ ข้อ|ผ่าน X|E\d+–E\d+|\d+\/\d+/.test(line)) out.push({ file: rel, line: i + 1, text: line.replace(/^\|\s*|\s*\|$/g, '').replace(/\s*\|\s*/g, ' — ').replace(/`/g, '') });
    });
  }
  return out;
}

// ---------------------------------------------------------------- หลักฐานวิดีโอ
function media() {
  const list = (dir, ext) => { try { return fs.readdirSync(dir).filter((f) => f.endsWith(ext)); } catch { return []; } };
  const gifs = list(path.join(MEDIA, 'gifs'), '.gif');
  const mp4s = list(path.join(MEDIA, 'videos'), '.mp4');
  const of = (files, tc, dir) => files
    .filter((f) => f === `${tc}${path.extname(f)}` || new RegExp(`^${tc}-\\d+\\.`).test(f))
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .map((f) => link(path.join(MEDIA, dir, f)));
  return { gifs, mp4s, of };
}

// ---------------------------------------------------------------- main
const plan = buildPlanCases();
const cases = plan.cases;
const store = readJson(path.join(RUN_DIR, 'results.json'), { runs: {} });
const info = readJson(path.join(RUN_DIR, 'run-info.json'), {});
const triage = readJson(TRIAGE, {});
const v = verdicts(store, cases);
const sum = summary(v, cases);
let cmp = null;
if (CMP_DIR) {
  const cs = readJson(path.join(CMP_DIR, 'results.json'), null);
  if (cs) {
    const cv = verdicts(cs, cases);
    const flips = [];
    for (const c of cases) for (const b of BROWSERS) {
      const a = cv[c.id][b].status, z = v[c.id][b].status;
      if ((a === 'passed') !== (z === 'passed') && !(b !== 'chromium' && v[c.id][b].src === 'serial')) flips.push({ tc: c.id, browser: b, src: v[c.id][b].src, before: a, after: z });
    }
    cmp = { label: path.basename(CMP_DIR), summary: summary(cv, cases), flips, runAt: Object.values(cs.runs ?? {}).map((r) => r.runAt).sort()[0] ?? '' };
  }
}
const m = media();
const runAts = Object.entries(store.runs ?? {}).map(([p, r]) => ({ project: p, runAt: r.runAt, n: r.rows.length }));
const data = {
  builtAt: new Date().toISOString(),
  label: LABEL,
  info,
  runAts,
  summary: sum,
  compare: cmp,
  claims: builderClaims(),
  counts: { gif: m.gifs.length, mp4: m.mp4s.length },
  triageFile: path.relative(ROOT, TRIAGE).split(path.sep).join('/'),
  links: {
    // หน้าที่สร้างไว้ในโฟลเดอร์รอบ (test-report/run-N/index.html) ลิงก์ไปสำเนารายงานของรอบนั้นเอง
    chatbot: link(OUT_DIR === RUN_DIR && fs.existsSync(path.join(RUN_DIR, 'CHATBOT-REPORT.md')) ? path.join(RUN_DIR, 'CHATBOT-REPORT.md') : path.join(REPORT, 'CHATBOT-REPORT.md')),
    report: link(OUT_DIR === RUN_DIR && fs.existsSync(path.join(RUN_DIR, 'TEST-REPORT.md')) ? path.join(RUN_DIR, 'TEST-REPORT.md') : path.join(REPORT, 'TEST-REPORT.md')),
    html: link(path.join(REPORT, 'html', 'index.html')),
    plan: link(path.join(ROOT, 'docs', '09-TEST-PLAN.md')),
    cases: link(path.join(ROOT, 'docs', 'TEST-CASES.md')),
    mcp: link(path.join(ROOT, 'docs', 'TEST-RUN-MCP.md')),
  },
  rows: cases.map((c) => ({
    ...c,
    mcpImage: c.mcpImage ? link(path.join(ROOT, c.mcpImage)) : '',
    res: v[c.id],
    gifs: m.of(m.gifs, c.id, 'gifs'),
    mp4s: m.of(m.mp4s, c.id, 'videos'),
    triage: triage[c.id] ?? null,
  })),
};

const tpl = fs.readFileSync(path.join(here, 'index.template.html'), 'utf8');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, tpl.replace('/*__DATA__*/null', () => json).replace('__BUGMODE__', () => String(info.bugModeFromHtml ?? '?')));
console.log(`[build-index] ${path.relative(here, OUT)} · ผลจาก ${path.relative(here, RUN_DIR) || '.'} · bugMode ${info.bugModeFromHtml ?? '?'} · ` +
  BROWSERS.map((b) => `${b} ${sum[b].pass}/${sum[b].total} P1 ${sum[b].p1pass}/${sum[b].p1total} ${sum[b].meets ? 'ผ่าน' : 'ไม่ผ่าน'}`).join(' · ') +
  ` · GIF ${m.gifs.length} MP4 ${m.mp4s.length}` + (cmp ? ` · เทียบ ${cmp.label}: เปลี่ยน ${cmp.flips.length}` : ''));
