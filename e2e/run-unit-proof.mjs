// รัน unit test ที่เป็น "หลักฐาน" ของ TC ที่พิสูจน์ผ่านหน้าเว็บไม่ได้ แล้วเขียนผลลง <out>/unit-proof.json
// build-index.mjs อ่านไฟล์นี้: TC ที่ browser ข้ามเอง (skipped) + unit ผ่านจริงรอบนี้ = นับ "ผ่านด้วย unit" (ไม่ใช่ข้าม)
// ใช้: node run-unit-proof.mjs [--out test-report]   (ต้องมี node 22+ ที่รัน .ts ตรงได้ · ไม่ต้องมี docker/เว็บ)
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.PROOF_ROOT ? path.resolve(process.env.PROOF_ROOT) : path.join(here, '..');
const argv = process.argv;
const OUT = path.resolve(here, argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'test-report');

// TC → unit test ที่พิสูจน์ (แถว TEST-DATA ที่เป็น unit) · เพิ่มได้เฉพาะ TC ที่แผนระบุว่า "ผ่านเว็บไม่ได้"
const PROOFS = {
  'TC-SERIES-04': {
    row: 'E75', file: 'web/lib/rules/rules.test.ts',
    name: 'BR-19 / A-24 discount with satang is rounded up',
    why: 'ราคาจริงทุกช่วงเป็นทวีคูณของ 10 → 10% ลงตัวเสมอ ไม่มีเศษให้ปัดผ่านเว็บ (SPEC 8 ข้อ 6)',
  },
};

const out = {};
for (const [tc, p] of Object.entries(PROOFS)) {
  const abs = path.join(ROOT, p.file);
  const src = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  const line = src.findIndex((l) => l.includes(`test("${p.name}"`)) + 1; // 0 = ไม่พบชื่อ test ในไฟล์ → ไม่นับ
  const re = '^' + p.name.replace(/[.*+?^${}()|[\]\\/]/g, (m) => '\\' + m) + '$';
  const cwd = path.join(ROOT, 'web');
  const r = spawnSync(process.execPath, ['--test', `--test-name-pattern=${re}`, path.relative(cwd, abs)], { cwd, encoding: 'utf8' });
  const txt = (r.stdout ?? '') + (r.stderr ?? '');
  const num = (k) => Number((txt.match(new RegExp(`^ℹ ${k} ([0-9]+)`, 'm')) ?? [])[1] ?? NaN);
  const pass = num('pass'), fail = num('fail');
  out[tc] = {
    status: line > 0 && r.status === 0 && pass === 1 && fail === 0 ? 'passed' : 'failed',
    row: p.row, file: p.file, line, name: p.name, why: p.why, pass, fail,
    cmd: `cd web && node --test --test-name-pattern="${p.name}" ${path.relative(cwd, abs).split(path.sep).join('/')}`,
    node: process.version, runAt: new Date().toISOString(),
  };
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'unit-proof.json'), JSON.stringify(out, null, 2));
for (const [tc, o] of Object.entries(out)) console.log(`[unit-proof] ${tc} ${o.row} ${o.status === 'passed' ? 'ผ่าน' : 'ไม่ผ่าน'} · ${o.file}:${o.line}`);
process.exit(Object.values(out).every((o) => o.status === 'passed') ? 0 : 1);
