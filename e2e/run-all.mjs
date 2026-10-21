// รันชุด test ทั้งหมดเป็น 2 ช่วงต่อกัน (ไม่ทับซ้อน):
//   1) รอบหลัก: setup → chromium / firefox / webkit (พร้อมกัน) → serial (ทีละข้อ)
//   2) perf (PERF=1, workers 1): TC-BOOK-02 / NFR-08 ทีละเบราว์เซอร์ หลังรอบหลักจบ → ไม่มี test อื่นรันพร้อมกัน
// ใช้: node run-all.mjs [--gif] [อาร์กิวเมนต์อื่นของ playwright test สำหรับรอบหลัก]
//   --gif → รอบหลักเฉพาะ chromium (+ serial) และ perf เฉพาะ perf-chromium (โหมด GIF ตั้งด้วย env GIF=1)
//   จบรอบเต็ม (ไม่มี --gif และไม่มีอาร์กิวเมนต์เพิ่ม) → รัน run-unit-proof.mjs แล้ว build-index.mjs ต่อให้เอง (โซ่หลักฐาน: unit ต้องมาก่อน index)
//   ไม่กระทบ exit code · build-index เขียน plan-cases.json ใหม่จาก docs/TEST-CASES.md (ต่างจากเดิมแค่ generatedAt ทุกครั้ง) → คืนไฟล์เดิมเสมอ (ไฟล์นี้เป็นเฉลยที่ห้ามแก้) และเตือนเฉพาะเมื่อเนื้อหาจริงต่างจากเดิม
// exit code = ไม่ใช่ 0 ถ้าช่วงใดช่วงหนึ่งล้ม
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';

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

if (!gif && extra.length === 0) {
  const node = (script) => spawnSync(process.execPath, [path.join(here, script)], { cwd: here, stdio: 'inherit' }).status ?? 1;
  const planPath = path.join(here, 'plan-cases.json');
  const planBefore = fs.existsSync(planPath) ? fs.readFileSync(planPath) : null;
  console.log('\n===== หลักฐาน: run-unit-proof.mjs → build-index.mjs =====');
  const proof = node('run-unit-proof.mjs'); // ต้องก่อน build-index (index อ่าน test-report/unit-proof.json)
  const index = node('build-index.mjs');
  if (planBefore) {
    const strip = (b) => b.toString('utf8').replace(/"generatedAt": "[^"]*"/, '"generatedAt": ""');
    const planAfter = fs.readFileSync(planPath);
    if (!planBefore.equals(planAfter)) {
      fs.writeFileSync(planPath, planBefore); // คืนไฟล์เดิมเสมอ (generatedAt เปลี่ยนทุกรอบ)
      if (strip(planBefore) !== strip(planAfter)) console.log('[run-all] เตือน: plan-cases.json ที่สร้างจาก docs/TEST-CASES.md ต่างจากไฟล์เดิม (ไม่ใช่แค่ generatedAt) → คืนไฟล์เดิมแล้ว ตรวจสองไฟล์ว่าตรงกัน');
    }
  }
  console.log(`สรุปหลักฐาน: unit-proof ${proof} · build-index ${index}`);
}
process.exit(main || perf);
