#!/usr/bin/env node
// ตรวจลิงก์ในเอกสาร: ทุก markdown link แบบ relative และทุก path ใน backtick ของไฟล์ *.md ต้องชี้ไปที่ไฟล์/โฟลเดอร์ที่มีอยู่จริง
//   node tools/check-links.mjs            ตรวจทั้ง repo (exit 1 ถ้ามีลิงก์เสีย)
//   node tools/check-links.mjs --verbose  แสดงรายการ false positive ที่รู้แล้ว + ชื่อไฟล์เปล่าที่ resolve ได้แค่ด้วยชื่อ
// ข้าม: node_modules .git .next _solution test-report (รายงานที่รันแล้วสร้างเอง) และ web/BUGS.md (ห้ามเปิด · ไม่อ่านเลย)
// วิธีอ่าน backtick: ถือเป็น path เมื่อไม่มีช่องว่าง/อักขระ placeholder และ (ลงท้ายด้วยนามสกุลที่รู้จัก หรือ ลงท้าย "/" และขึ้นต้นด้วยโฟลเดอร์ระดับราก)
//   ลองหาจากรากโปรเจกต์ก่อน แล้วลองจากโฟลเดอร์ของไฟล์ที่เขียน · ตัดท้าย :บรรทัด และ #หัวข้อ ออกก่อน
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '_solution', 'test-report', 'normal-mode']); // normal-mode = รายงานรอบรันเก่าที่ระบบสร้างเอง (เหมือน test-report)
const SKIP_FILES = new Set(['web/BUGS.md']);
const EXT = /\.(md|mjs|cjs|js|ts|tsx|json|ya?ml|sql|sh|ps1|png|jpe?g|gif|svg|mp4|html|css|har|txt|jsonl)$/i;

// false positive ที่รู้แล้ว: [ส่วนของ path ที่พบใน token, เหตุผล] — ไม่นับเป็นลิงก์เสีย แต่ยังพิมพ์รายงานแยก
const KNOWN_FALSE_POSITIVES = [
  ['Teaching_CWN2026', 'โฟลเดอร์ของอาจารย์ (repo อื่น อยู่นอกโปรเจกต์นี้)'],
  ['_solution', 'เฉลยของอาจารย์ (ห้ามเปิด · ไม่อยู่ใน repo)'],
  ['.env', 'ไฟล์รหัสผ่านเครื่อง (อยู่ใน .gitignore · มีแค่ .env.example)'],
  ['BUGS.md', 'เฉลยบั๊กที่ฝัง (ห้ามเปิด)'],
  ['playwright-report', 'ผลรัน e2e ที่สร้างตอนรัน (gitignore)'],
  ['test-results', 'ผลรัน e2e ที่สร้างตอนรัน (gitignore)'],
  ['.next/', 'ผล build ของเว็บ (gitignore)'],
  ['ms-playwright', 'browser cache นอกโปรเจกต์'],
];

// false positive ระดับไฟล์ (เฉพาะ path ใน backtick · markdown link ต้องถูกเสมอ): ไฟล์ที่พูดถึงของนอก repo / ชื่อย่อ / ไฟล์ชั่วคราวที่ไม่มีแล้ว
const KNOWN_FILE_FALSE_POSITIVES = [
  ['docs/07-SAD.md', 'เอกสารออกแบบรุ่นแรก: ชื่อย่อ/โครงสร้างที่วางแผนไว้ (spa/ · db/scripts/ · NNN_ชื่อ.sql) ไม่ใช่ path จริงของ repo นี้'],
  ['docs/08-BUILD-PROMPT-v1.md', 'prompt รุ่นเก่าอ้าง web/docker-compose.yml (ปัจจุบันคือ web/compose.yaml)'],
  ['docs/08d-REBUILD-PROMPT-v2.md', 'prompt รุ่นเก่าอ้าง web/docker-compose.yml (ปัจจุบันคือ web/compose.yaml)'],
  ['docs/11-INSTRUCTOR-MAP.md', 'ชี้ไฟล์ใน repo ของอาจารย์ (Teaching_CWN2026: BUILDMART.md · EXAM.md · main_prompt.md …)'],
  ['docs/RUBRIC-SELF-CHECK.md', 'ชื่อชิ้นงานตามเกณฑ์ของอาจารย์ (DESIGN.md · CODEBASE-MAP.md …) ที่ทีมไม่ได้สร้างเป็นไฟล์ชื่อนี้'],
  ['docs/process/PLAN.md', 'แผนเก่าอ้างชิ้นงานของอาจารย์/ไฟล์ที่ตั้งใจไว้แล้วเปลี่ยนชื่อ (EXAM.md · CODEBASE-MAP.md · 11-my-tests.spec.ts …)'],
  ['docs/BUG-HUNT.md', 'normal-mode/run-info.json: อ้างจากโฟลเดอร์ e2e/ (ไม่ใช่รากของเอกสาร)'],
  ['docs/UI-REDESIGN.md', 'ไฟล์ชั่วคราว/ที่วางแผนจะสร้าง (contrast.js · testids-before/after.json)'],
  ['docs/impact/CR-01.md', 'ชื่อไฟล์ของ Next.js (middleware.ts / proxy.ts) ที่พูดถึงเปรียบเทียบ ไม่ใช่ไฟล์ใน repo'],
  ['docs/impact/CR-06.md', '009.down.sql = ชื่อย่อของ db/migrations/009_*.down.sql'],
  ['docs/trace/dynamic/README.md', 'tools/check-phase2/3.mjs = เขียนย่อรวม 2 ไฟล์'],
  ['docs/trace/phase2-loop.md', 'docs/diagrams/02-BA-1.svg/.png = เขียนย่อรวม 2 ไฟล์'],
  ['docs/ui/PARALLEL-PLAN.md', 'ไฟล์ CSS ที่วางแผนไว้ในแผนขนาน'],
  ['legacy/FENCE-TEST.md', 'ไฟล์ probe ที่สร้างชั่วคราวตอนทดสอบรั้วแล้วลบทิ้ง'],
  ['legacy/REA-COMPARE.md', 'ไฟล์ในระบบที่ build แล้ว (route.js · page.js) ไม่ใช่ไฟล์ใน repo'],
  ['legacy/REA-INVENTORY.md', 'ไฟล์ในระบบที่ build แล้ว (route.js · page.js) หรือโฟลเดอร์ rea/ ของเครื่องมือสกัดกลับที่ไม่ได้เก็บใน repo'],
  ['legacy/SYSTEM-MAP.md', 'mig/NNN_*.sql = ชื่อย่อของ db/migrations/ ในระบบรับมอบ'],
  ['legacy/TRACEABILITY.md', '16.json = ชื่อย่อของไฟล์ผลลัพธ์รอบที่ 16'],
];
// false positive ระดับ token (เทียบเท่ากันทั้งสาย)
const KNOWN_TOKEN_FALSE_POSITIVES = [
  ['football-booking/docs/process/HANDOFF.md', 'path เขียนจากโฟลเดอร์แม่ของ repo (ข้อความสั่งเอเจนต์ที่เปิดจากโฟลเดอร์แม่)'],
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      const rel = path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/');
      if (!SKIP_FILES.has(rel)) out.push(rel);
    }
  }
  return out;
}

const mdFiles = walk(ROOT).sort();
const rootEntries = new Set(fs.readdirSync(ROOT));
// ชื่อไฟล์ทั้งหมด (ไว้บอกว่า "ชื่อเปล่า" ที่ไม่มีเครื่องหมาย / มีอยู่ที่ไหนสักแห่งไหม)
const byBase = new Map();
(function indexAll(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) && e.name !== 'test-report') continue;
      indexAll(path.join(dir, e.name));
    } else {
      const rel = path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/');
      if (!byBase.has(e.name)) byBase.set(e.name, []);
      byBase.get(e.name).push(rel);
    }
  }
})(ROOT);

const exists = (rel) => {
  try {
    fs.statSync(path.join(ROOT, rel));
    return true;
  } catch {
    return false;
  }
};

let ignoredCache = null;
function gitIgnored(rels) {
  if (!rels.length) return new Set();
  try {
    const out = execFileSync('git', ['check-ignore', '--stdin'], { cwd: ROOT, input: rels.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    return new Set(out.split(/\r?\n/).filter(Boolean));
  } catch (e) {
    // exit 1 = ไม่มีตัวไหนถูก ignore · อย่างอื่น (ไม่มี git) = ข้าม
    return new Set(String(e.stdout ?? '').split(/\r?\n/).filter(Boolean));
  }
}

const norm = (p) => path.posix.normalize(p).replace(/^\.\//, '');

// ตำแหน่งเดิมที่ย้ายไปแล้ว (docs/REPO-LAYOUT.md): ถ้ายังมีใครอ้าง path รากแบบเดิม = เสียเสมอ ห้ามผ่อนปรนด้วยการจับคู่ท้ายชื่อ
const MOVED_FROM_ROOT = /^(CHANGE-REQUESTS(\/|$)|(RELEASE-NOTES|UAT-CHECKLIST|KNOWN-ISSUES|PLAN|HANDOFF|NEXT-TASKS-PROMPT)\.md$|screenshots(\/|$))/;

// ทุกท้าย path ของไฟล์/โฟลเดอร์ใน repo → ไว้ผ่อนปรน token ที่เขียนแบบย่อตามบริบท (เช่น `lib/server/chat.ts` ในเอกสารที่พูดถึง web/)
const suffixes = new Set();
for (const list of byBase.values()) for (const rel of list) { const parts = rel.split('/'); for (let i = 0; i < parts.length; i++) { suffixes.add(parts.slice(i).join('/')); } }
for (const rel of [...suffixes]) { const parts = rel.split('/'); for (let i = 1; i < parts.length; i++) suffixes.add(parts.slice(0, i).join('/') + '/'); } // โฟลเดอร์กลางทาง

const results = { checked: 0, links: 0, ticks: 0, placeholders: 0, broken: [], known: [], bare: [], partial: [] };

for (const file of mdFiles) {
  const dir = path.posix.dirname(file);
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
  let fence = false;
  lines.forEach((raw, i) => {
    if (/^\s*(```|~~~)/.test(raw)) {
      fence = !fence;
      return;
    }
    if (fence) return;
    const lineNo = i + 1;
    // 1) markdown link / image: ](target)
    for (const m of raw.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const t = m[1];
      if (/^(https?:|mailto:|tel:|#|data:)/i.test(t)) continue;
      if (/[{}<>]|\$\{/.test(t)) {
        results.placeholders++;
        continue;
      }
      results.links++;
      let p = t.split('#')[0].split('?')[0];
      if (!p) continue;
      try {
        p = decodeURI(p);
      } catch {}
      const rel = norm(p.startsWith('/') ? p.slice(1) : path.posix.join(dir, p));
      if (rel.startsWith('..') || !exists(rel)) results.broken.push({ file, line: lineNo, kind: 'link', token: t, tried: [rel] });
    }
    // 2) backtick path
    for (const m of raw.replace(/!?\[[^\]]*\]\([^)]*\)/g, " ").matchAll(/`([^`\n]+)`/g)) {
      let t = m[1].trim();
      if (!t || /\s/.test(t) || /^(https?:|\/|-|\$|@|~|<|#)/.test(t)) continue;
      if (/[*?{}<>|$=(),;'"[\]\\]/.test(t)) {
        if (EXT.test(t.replace(/:\d+(-\d+)?$/, '')) || t.endsWith('/')) results.placeholders++;
        continue;
      }
      t = t.replace(/#.*$/, '').replace(/:\d+(-\d+)?$/, '');
      if (!t || /(\.\.\.|…|0N\b|\bNN\b|XX|<\w)/.test(t) || /^\.{3}/.test(t)) {
        if (t) results.placeholders++;
        continue;
      }
      const first = t.split('/')[0];
      const isDirTok = t.endsWith('/') && (rootEntries.has(first) || first === '..' || first === '.');
      const hasExt = EXT.test(t);
      if (!hasExt && !isDirTok) continue;
      // ข้ามชื่อที่ไม่ใช่ path ของ repo: ตัวแปร/ฟังก์ชัน/ที่อยู่ใน container ฯลฯ
      if (/^(app|usr|var|etc|srv|opt|tmp|home)\//.test(t)) continue;
      results.ticks++;
      const clean = t.replace(/\/$/, '');
      const cands = [];
      if (t.startsWith('./') || t.startsWith('../')) cands.push(norm(path.posix.join(dir, clean)));
      else {
        cands.push(norm(clean));
        cands.push(norm(path.posix.join(dir, clean)));
      }
      if (file !== 'docs/REPO-LAYOUT.md' && !t.startsWith('.') && MOVED_FROM_ROOT.test(clean) && !cands.some((c) => !c.startsWith('..') && exists(c))) {
        results.broken.push({ file, line: lineNo, kind: 'moved', token: t, tried: cands });
        continue;
      }
      if (cands.some((c) => !c.startsWith('..') && exists(c))) continue;
      if (/^\.[\w.]+$/.test(clean)) continue; // นามสกุลเปล่า เช่น .down.sql
      if (clean.includes('/') && (suffixes.has(clean.replace(/^(\.\.?\/)+/, '')) || suffixes.has(clean.replace(/^(\.\.?\/)+/, '') + '/'))) {
        results.partial.push({ file, line: lineNo, token: t });
        continue;
      }
      // ชื่อเปล่า (ไม่มี /) ที่มีอยู่ที่อื่นใน repo = อ้างอิงลอย ๆ เช่นพูดถึงไฟล์ในบริบท → รายงานเป็น bare
      if (!clean.includes('/') && byBase.has(clean)) {
        results.bare.push({ file, line: lineNo, token: t, matches: byBase.get(clean) });
        continue;
      }
      const fp = KNOWN_FALSE_POSITIVES.find(([k]) => t.includes(k)) ?? KNOWN_FILE_FALSE_POSITIVES.find(([f]) => f === file) ?? KNOWN_TOKEN_FALSE_POSITIVES.find(([k]) => k === t);
      if (fp) {
        results.known.push({ file, line: lineNo, token: t, why: fp[1] });
        continue;
      }
      results.broken.push({ file, line: lineNo, kind: 'tick', token: t, tried: cands });
    }
  });
}

// ตัวที่ .gitignore กัน (สร้างตอนรัน) ไม่ใช่ลิงก์เสีย
const ign = gitIgnored(results.broken.flatMap((b) => b.tried.filter((x) => !x.startsWith('..'))));
const stillBroken = [];
for (const b of results.broken) {
  if (b.tried.some((x) => ign.has(x))) results.known.push({ file: b.file, line: b.line, token: b.token, why: 'ถูก .gitignore (ไฟล์ที่สร้างตอนรัน/ของเครื่อง)' });
  else stillBroken.push(b);
}

console.log(`ตรวจ ${mdFiles.length} ไฟล์ .md · markdown link ${results.links} · path ใน backtick ${results.ticks} · placeholder ที่ข้าม ${results.placeholders}`);
for (const b of stillBroken) console.log(`BROKEN ${b.file}:${b.line}  [${b.kind}] ${b.token}${b.kind === 'tick' ? '' : ''}`);
if (results.known.length) {
  console.log(`false positive ที่รู้แล้ว (ไม่นับ): ${results.known.length}`);
  if (VERBOSE) for (const k of results.known) console.log(`  ${k.file}:${k.line}  ${k.token}  — ${k.why}`);
}
if (results.partial.length) {
  console.log(`path แบบย่อตามบริบท (ท้าย path ตรงไฟล์จริงใน repo · ไม่นับ): ${results.partial.length}`);
  if (VERBOSE) for (const k of results.partial) console.log(`  ${k.file}:${k.line}  ${k.token}`);
}
if (results.bare.length) {
  console.log(`ชื่อไฟล์เปล่าใน backtick ที่ resolve ได้แค่ด้วยชื่อ (ไม่นับ · อ้างในบริบท): ${results.bare.length}`);
  if (VERBOSE) for (const k of results.bare) console.log(`  ${k.file}:${k.line}  ${k.token} → ${k.matches.slice(0, 3).join(' | ')}${k.matches.length > 3 ? ' …' : ''}`);
}
console.log(stillBroken.length ? `FAIL: ลิงก์เสีย ${stillBroken.length}` : 'OK: 0 broken');
process.exit(stillBroken.length ? 1 : 0);
