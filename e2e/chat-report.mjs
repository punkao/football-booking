// สร้าง e2e/test-report/CHATBOT-REPORT.md จากผลรันจริงของ test แชท (ไม่เขียนรายงานด้วยมือ)
//   ข้อมูลเข้า:
//   - docs/TEST-CASES.md ส่วน "## CHAT" → ลูกค้าพิมพ์ / ต้องมี / ห้ามมี / baseline / ระดับ / ที่มา (เฉลยมาจากแผนเท่านั้น)
//   - e2e/test-report/chat/<chatMode>/<project>/<TC>.json ← เขียนโดย tests/chat-helpers.ts ทุกครั้งที่ test แชทรัน
//     (คำตอบจริงของบอททุกข้อความ + การ์ด + ผลตรวจ ต้องมี/ห้ามมี รายข้อ + ผ่าน/ล้ม)
//   - e2e/triage.json (การจำแนกข้อที่ล้ม) · e2e/test-report/gifs/<TC>.gif (จาก GIF=1)
//   รูปแบบตาม Teaching_CWN2026/00_setup/04_Skill_Setup/01_VastAi_Skill ข้อ 4.3 (ตารางสรุป + รายละเอียดทีละเคส + GIF)
// ใช้: node chat-report.mjs
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'test-report');
const CHAT = path.join(OUT, 'chat');
const CASES = path.join(here, '..', 'docs', 'TEST-CASES.md');
const BROWSERS = ['chromium', 'firefox', 'webkit'];
/** เส้นทางที่รายงาน: mock = MODE=mock (ค่าเริ่มต้น) · ai = MODE=ai ผ่าน mock-llm (ไม่ใช่โมเดลจริง) */
const PATHS = [
  { key: 'mock', label: 'MODE=mock', browsers: BROWSERS },
  { key: 'ai', label: 'MODE=ai ผ่าน mock-llm', browsers: ['chromium'] },
];

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ').trim();
const clip = (s, n) => { const t = esc(s); return t.length > n ? `${t.slice(0, n)}…` : t; };
const strip = (s) => String(s ?? '').replace(/\*\*/g, '').trim();

// ---------------------------------------------------------------- 1) แผน: TEST-CASES ส่วน CHAT
function parseCases() {
  const md = fs.readFileSync(CASES, 'utf8');
  const start = md.indexOf('## CHAT');
  const end = md.indexOf('\n## ', start + 5);
  const sec = md.slice(start, end < 0 ? undefined : end);
  const blocks = sec.split(/\n### /).slice(1);
  const cases = {};
  for (const b of blocks) {
    const head = b.split('\n')[0];
    const tc = (head.match(/TC-CHAT-\d+/) ?? [])[0];
    if (!tc) continue;
    const title = head.replace(/^TC-CHAT-\d+\s*/, '').replace(/🆕v2\s*·?\s*/g, '').replace(/🕒\s*/g, '').trim();
    const row = b.split('\n').find((l) => l.startsWith(`| ${tc} |`)) ?? '';
    const cols = row.split('|').map((c) => c.trim());
    const chatLine = b.split('\n').find((l) => l.startsWith('**แชท')) ?? '';
    const answer = strip((b.match(/\*\*เฉลย \(ผลที่ถูก\):\*\*\s*(.+)/) ?? [])[1] ?? '');
    const data = strip((b.match(/\*\*ข้อมูลที่ใช้:\*\*\s*(.+)/) ?? [])[1] ?? '');
    let says = '', must = '', mustNot = '', baseline = '';
    if (chatLine) {
      const body = chatLine.replace(/^\*\*แชท[^*]*\*\*\s*/, '');
      says = strip((body.match(/ลูกค้าพิมพ์\s*(.+?)\s*→\s*\*\*ต้องมี/) ?? [])[1] ?? '');
      must = strip((body.match(/\*\*ต้องมี\*\*\s*(.+?)\s*(·\s*\*\*ห้ามมี|\|\s*\*\*baseline|$)/) ?? [])[1] ?? '');
      mustNot = strip((body.match(/\*\*ห้ามมี\*\*\s*(.+?)\s*(\|\s*\*\*baseline|$)/) ?? [])[1] ?? '');
      baseline = strip((body.match(/\*\*baseline\*\*\s*(.+)$/) ?? [])[1] ?? '');
    }
    if (!must) {
      // ข้อจำกัด/หลังบ้าน (TC-CHAT-19, 20) ไม่มีบรรทัดแชท → ใช้เฉลยทั้งก้อนเป็น "ต้องมี"
      must = answer;
      says = data;
    }
    cases[tc] = { tc, title, level: cols[2] ?? '', source: cols[4] ?? '', says, must, mustNot, baseline, answer };
  }
  return cases;
}

// ---------------------------------------------------------------- 2) ผลรัน
function loadResults() {
  const res = {}; // res[path][project][tc]
  for (const p of PATHS) {
    res[p.key] = {};
    for (const proj of [...BROWSERS, 'serial']) {
      const dir = path.join(CHAT, p.key, proj);
      if (!fs.existsSync(dir)) continue;
      res[p.key][proj] = {};
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
        const d = readJson(path.join(dir, f), null);
        if (d?.tc) res[p.key][proj][d.tc] = d;
      }
    }
  }
  return res;
}

/** ผลของ TC ในเบราว์เซอร์หนึ่ง · TC 🕒 (serial) นับผลเดียวกันให้ทุกเบราว์เซอร์ (แผนหัวข้อ 6) */
function resultOf(res, pathKey, browser, tc) {
  return res[pathKey]?.[browser]?.[tc] ?? res[pathKey]?.serial?.[tc] ?? null;
}

const mark = (r) => (!r ? '–' : r.status === 'passed' ? '✅' : '❌');

function botText(r) {
  if (!r) return '(ยังไม่ได้รัน)';
  return r.turns.map((t, i) => {
    const who = r.turns.length > 1 ? `(${i + 1}) ` : '';
    const card = Object.keys(t.cards ?? {}).length ? ` [การ์ด: ${Object.entries(t.cards).map(([k, v]) => `${k}=${v}`).join(' ; ')}]` : '';
    const err = t.error ? ` [chat-error: ${t.error}]` : '';
    return `${who}「${t.bot || '–'}」${card}${err}`;
  }).join(' → ');
}

function userText(r, fallback) {
  if (!r?.turns?.length) return fallback;
  const us = r.turns.map((t) => t.user);
  // TC-CHAT-19 ส่ง "เปิดกี่โมง" 21 ครั้ง → ย่อ
  const compact = [];
  for (const u of us) {
    const last = compact[compact.length - 1];
    if (last && last.u === u) last.n++;
    else compact.push({ u, n: 1 });
  }
  return compact.map((c) => `"${c.u}"${c.n > 1 ? ` × ${c.n}` : ''}`).join(' → ');
}

// ---------------------------------------------------------------- 3) เขียนรายงาน
const cases = parseCases();
const res = loadResults();
const triage = readJson(path.join(here, 'triage.json'), {});
const runInfo = readJson(path.join(OUT, 'run-info.json'), {});
const tcs = Object.keys(cases).sort((a, b) => Number(a.split('-')[2]) - Number(b.split('-')[2]));
const gif = (tc) => fs.existsSync(path.join(OUT, 'gifs', `${tc}.gif`));
const L = [];

L.push('# CHATBOT REPORT — แชทบอท "น้องบอล" (TC-CHAT-01…20)');
L.push('');
L.push(`สร้างอัตโนมัติโดย \`node e2e/chat-report.mjs\` เมื่อ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} จากผลรัน Playwright จริง (\`e2e/test-report/chat/**.json\`) · ห้ามแก้ไฟล์นี้ด้วยมือ`);
L.push('');
L.push('- เฉลย (ต้องมี / ห้ามมี / baseline) อ่านจาก [`docs/TEST-CASES.md`](../../docs/TEST-CASES.md) ส่วน CHAT เท่านั้น · **คำตอบจริงของบอท** = ข้อความที่ test อ่านจาก `chat-msg-bot` (+ การ์ด) ตอนรัน');
L.push('- test: [`e2e/tests/chat.spec.ts`](../tests/chat.spec.ts) (TC-CHAT-01–19, 3 เบราว์เซอร์) · [`e2e/tests/chat.serial.spec.ts`](../tests/chat.serial.spec.ts) (TC-CHAT-20 🕒 เลื่อนเวลา รันครั้งเดียวบน Chromium แล้วนับผลให้ทุกเบราว์เซอร์ ตามแผนหัวข้อ 6)');
L.push('- 2 เส้นทาง: **MODE=mock** (สมองตามกฎในโค้ด ค่าเริ่มต้น) และ **MODE=ai ผ่าน mock-llm** (`node tools/chat-mode.mjs ai` — เว็บเรียก LLM แบบ OpenAI ที่ container `mock-llm` ในเครื่อง ไม่ใช่โมเดลจริง) แล้วสลับกลับ `node tools/chat-mode.mjs mock` ทุกครั้ง');
L.push(`- BUG_MODE ตอนรันล่าสุด: ${runInfo.bugModeFromHtml ?? '?'} (จาก \`<html data-bug-mode>\`) · เวลาที่ล็อก ${runInfo.lockedNow ?? '-'}`);
L.push('');

// 3.1 สรุปต่อเส้นทาง × เบราว์เซอร์
L.push('## 1. สรุปผล (เส้นทาง × เบราว์เซอร์)');
L.push('');
L.push('| เส้นทาง | เบราว์เซอร์ | ผ่าน / ทั้งหมด | P1 ล้ม | TC ที่ล้ม | รันเมื่อ |');
L.push('|---|---|---|---|---|---|');
for (const p of PATHS) {
  for (const b of p.browsers) {
    const rs = tcs.map((tc) => resultOf(res, p.key, b, tc));
    const ran = rs.filter(Boolean);
    if (!ran.length) { L.push(`| ${p.label} | ${b} | (ยังไม่ได้รัน) | – | – | – |`); continue; }
    const pass = ran.filter((r) => r.status === 'passed').length;
    const fail = tcs.filter((tc, i) => rs[i] && rs[i].status !== 'passed');
    const p1 = fail.filter((tc) => cases[tc].level === 'P1');
    const missing = tcs.length - ran.length;
    const last = (ran.filter((r) => r.project !== 'serial').length ? ran.filter((r) => r.project !== 'serial') : ran).map((r) => r.finishedAt).sort().pop();
    L.push(`| ${p.label} | ${b} | **${pass} / ${tcs.length}**${missing ? ` (ไม่ได้รัน ${missing})` : ''} | ${p1.length} | ${fail.join(', ') || '–'} | ${last ? new Date(last).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '–'} |`);
  }
}
L.push('');
L.push('ไม่ได้รัน = นับไม่ผ่าน (แผนหัวข้อ 6) · TC-CHAT-20 (🕒) ผลมาจาก project `serial` และนับให้ทุกเบราว์เซอร์');
L.push('');

// 3.2 ตารางสรุปทีละเคส
L.push('## 2. ตารางสรุปทีละเคส');
L.push('');
L.push('คอลัมน์ผล: mock = Chromium / Firefox / WebKit · ai = เส้นทาง ai ผ่าน mock-llm (Chromium) · กด ▶ เพื่อดูรายละเอียด + GIF');
L.push('');
L.push('| รหัส | ระดับ | ลูกค้าพิมพ์ | ต้องมี | ห้ามมี | baseline | คำตอบจริงของบอท (mock, Chromium) | ผล mock (C/F/W) | ผล ai-via-mock-llm | GIF |');
L.push('|---|---|---|---|---|---|---|---|---|---|');
for (const tc of tcs) {
  const c = cases[tc];
  const rc = resultOf(res, 'mock', 'chromium', tc);
  const mockCells = BROWSERS.map((b) => mark(resultOf(res, 'mock', b, tc))).join(' ');
  const ai = resultOf(res, 'ai', 'chromium', tc);
  L.push(`| [${tc}](#${tc.toLowerCase()}) | ${c.level} | ${clip(userText(rc, c.says), 140)} | ${clip(c.must, 160)} | ${clip(c.mustNot || '–', 120)} | ${clip(c.baseline || '–', 120)} | ${clip(botText(rc), 220)} | ${mockCells} | ${mark(ai)} | ${gif(tc) ? `[▶ gif](gifs/${tc}.gif)` : '–'} |`);
}
L.push('');

// 3.3 ข้อที่ล้ม + การจำแนก
const failing = tcs.filter((tc) => PATHS.some((p) => p.browsers.some((b) => { const r = resultOf(res, p.key, b, tc); return r && r.status !== 'passed'; })));
L.push('## 3. ข้อที่ล้มและการจำแนก (จาก `e2e/triage.json`)');
L.push('');
if (!failing.length) L.push('ไม่มีข้อที่ล้ม');
else {
  L.push('| รหัส | ระดับ | ล้มที่ | ตรวจที่ไม่ผ่าน | จัดเป็น |');
  L.push('|---|---|---|---|---|');
  for (const tc of failing) {
    const where = PATHS.flatMap((p) => p.browsers.filter((b) => { const r = resultOf(res, p.key, b, tc); return r && r.status !== 'passed'; }).map((b) => `${p.key}/${b}`));
    const any = PATHS.flatMap((p) => p.browsers.map((b) => resultOf(res, p.key, b, tc))).find((r) => r && r.status !== 'passed');
    const bad = (any?.checks ?? []).filter((x) => !x.ok).map((x) => `${x.kind}: ${x.label}`);
    const errs = bad.length ? bad : (any?.errors ?? []);
    const t = triage[tc];
    L.push(`| ${tc} | ${cases[tc].level} | ${where.join(', ')} | ${clip(errs.join(' ; '), 300)} | ${t ? `**${esc(t.class)}** — ${clip(t.note ?? '', 300)}` : '(ยังไม่ได้วิเคราะห์)'} |`);
  }
}
L.push('');

// 3.4 รายละเอียดทีละเคส
L.push('## 4. รายละเอียดทีละเคส (เทียบ baseline กับคำตอบจริง)');
L.push('');
for (const tc of tcs) {
  const c = cases[tc];
  const rc = resultOf(res, 'mock', 'chromium', tc);
  const ai = resultOf(res, 'ai', 'chromium', tc);
  L.push(`<a id="${tc.toLowerCase()}"></a>`);
  L.push('');
  L.push(`### ${tc} · ${c.title}`);
  L.push('');
  L.push(`**ผล** mock: ${BROWSERS.map((b) => `${b} ${mark(resultOf(res, 'mock', b, tc))}`).join(' · ')} · ai-via-mock-llm: chromium ${mark(ai)}`);
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| ระดับ · ที่มา | ${esc(c.level)} · ${esc(c.source)} |`);
  L.push(`| 💬 ลูกค้าพิมพ์ | ${esc(userText(rc, c.says))} |`);
  L.push(`| ✔️ ต้องมี | ${esc(c.must)} |`);
  L.push(`| ⛔ ห้ามมี | ${esc(c.mustNot || '–')} |`);
  L.push(`| 🎯 baseline | ${esc(c.baseline || '–')} |`);
  L.push(`| 🤖 คำตอบจริง (MODE=mock, Chromium) | ${esc(botText(rc))} |`);
  L.push(`| 🤖 คำตอบจริง (MODE=ai ผ่าน mock-llm, Chromium) | ${esc(botText(ai))} |`);
  const checkCell = (r) => (r ? r.checks.map((x) => `${x.ok ? '✅' : '❌'} ${x.kind}: ${x.label}${!x.ok && x.actual ? ` (ได้จริง: ${x.actual})` : ''}`).join('<br>') : '–');
  L.push(`| ตรวจรายข้อ (mock, Chromium) | ${esc(checkCell(rc)).replace(/&lt;br&gt;/g, '<br>')} |`);
  for (const b of ['firefox', 'webkit']) {
    const r = resultOf(res, 'mock', b, tc);
    if (r && r.status !== 'passed') L.push(`| ตรวจที่ไม่ผ่าน (mock, ${b}) | ${esc(r.checks.filter((x) => !x.ok).map((x) => `${x.kind}: ${x.label}`).join(' ; ') || r.errors.join(' ; '))} |`);
  }
  if (ai && ai.status !== 'passed') L.push(`| ตรวจที่ไม่ผ่าน (ai) | ${esc(ai.checks.filter((x) => !x.ok).map((x) => `${x.kind}: ${x.label}`).join(' ; ') || ai.errors.join(' ; '))} |`);
  if (triage[tc]) L.push(`| จัดเป็น | **${esc(triage[tc].class)}** — ${esc(triage[tc].note ?? '')} |`);
  L.push('');
  if (gif(tc)) L.push(`<img src="gifs/${tc}.gif" width="720" alt="วิดีโอ ${tc}">`);
  else L.push('_(ยังไม่มี GIF — รัน `GIF=1` เพื่ออัด)_');
  L.push('');
}

fs.writeFileSync(path.join(OUT, 'CHATBOT-REPORT.md'), L.join('\n') + '\n');
console.log(`[chat-report] เขียน ${path.join(OUT, 'CHATBOT-REPORT.md')} (${tcs.length} เคส)`);
