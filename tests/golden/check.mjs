#!/usr/bin/env node
// รัน golden ทั้ง 2 ชุดต่อกัน (ไม่ขนาน เพราะทั้งคู่ reset ฐาน) · exit 1 ถ้าชุดใดต่าง
//   node tests/golden/check.mjs [--update]
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { HERE } from "./lib.mjs";

let code = 0;
for (const s of ["quote-golden.mjs", "side-golden.mjs"]) {
  const r = spawnSync(process.execPath, [join(HERE, s), ...process.argv.slice(2)], { stdio: "inherit" });
  code = Math.max(code, r.status ?? 1);
}
process.exit(code);
