// รันชุด test ทั้งหมดเป็น 2 ช่วงต่อกัน (ไม่ทับซ้อน):
//   1) รอบหลัก: setup → chromium / firefox / webkit (พร้อมกัน) → serial (ทีละข้อ)
//   2) perf (PERF=1, workers 1): TC-BOOK-02 / NFR-08 ทีละเบราว์เซอร์ หลังรอบหลักจบ → ไม่มี test อื่นรันพร้อมกัน
// ใช้: node run-all.mjs [--gif] [อาร์กิวเมนต์อื่นของ playwright test สำหรับรอบหลัก]
//   --gif → รอบหลักเฉพาะ chromium (+ serial) และ perf เฉพาะ perf-chromium (โหมด GIF ตั้งด้วย env GIF=1)
// exit code = ไม่ใช่ 0 ถ้าช่วงใดช่วงหนึ่งล้ม
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, 'node_modules', '@playwright', 'test', 'cli.js');
const gif = process.argv.includes('--gif');
const extra = process.argv.slice(2).filter((a) => a !== '--gif');

function run(label, args, env) {
  console.log(`\n===== ${label}: playwright test ${args.join(' ')} =====\n`);
  const r = spawnSync(process.execPath, [cli, 'test', ...args], {
    cwd: here,
    stdio: 'inherit',
    env: { ...process.env, ...env }, // ที่เก็บเบราว์เซอร์ตั้งใน playwright.config.ts
  });
  return r.status ?? 1;
}

const main = run('รอบหลัก', gif ? ['--project=chromium', ...extra] : extra, { PERF: '' });
const perf = run('perf (NFR-08 รันเดี่ยว)', gif ? ['--project=perf-chromium'] : [], { PERF: '1' });
console.log(`\nสรุป exit code: รอบหลัก ${main} · perf ${perf}`);
process.exit(main || perf);
