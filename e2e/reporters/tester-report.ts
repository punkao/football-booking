import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

/**
 * รายงานแบบ tester (ภาษาไทย)
 * - แปลงวิดีโอเป็น test-report/gifs/<TC>.gif และ test-report/videos/<TC>.mp4 ด้วย ffmpeg
 * - เก็บผลราย project ใน test-report/results.json (รันใหม่ทับเฉพาะ project ที่รัน) แล้วเขียน TEST-REPORT.md จากผลทุก project
 * - การจัดประเภทข้อที่ล้ม (เว็บผิด / test ผิด / กฎไม่ชัด) อ่านจาก e2e/triage.json ที่ tester กรอกหลังวิเคราะห์
 */

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'test-report');
const GIF_DIR = path.join(OUT, 'gifs');
const MP4_DIR = path.join(OUT, 'videos');
const PROJECTS = ['chromium', 'firefox', 'webkit', 'serial', 'perf-chromium', 'perf-firefox', 'perf-webkit'];
const MODULES = ['HOME', 'BOOK', 'PRICE', 'PAY', 'CANCEL', 'CREDIT', 'SERIES', 'RENT', 'MEMBER', 'TEAM', 'STAFF', 'OWNER', 'I18N', 'MOB', 'API', 'CHAT'];

type Row = {
  project: string;
  tc: string;
  title: string;
  file: string;
  module: string;
  priority: string;
  expected: string;
  status: string; // passed | failed | timedOut | skipped | interrupted
  durationMs: number;
  error: string;
  steps: string[];
  videos: string[];
  screenshots: string[];
  traces: string[];
  finishedAt: string;
  /** annotation อื่นนอกจาก expected เช่น load-ms ของ NFR-08 */
  notes?: Record<string, string>;
};

type Run = { runAt: string; gifMode: boolean; rows: Row[] };
/** runs = ผลรอบปกติ (ใช้ตัดสิน) · gifRuns = ผลรอบ `npm run test:gif` (slowMo, อัดวิดีโอ) เก็บแยก ไม่ทับผลรอบปกติ */
type Store = { runs: Record<string, Run>; gifRuns?: Record<string, Run> };

function stripAnsi(s: string) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

function tcOf(title: string) {
  const m = title.match(/^(TC-[A-Z0-9]+-\d+)/);
  return m ? m[1] : title.slice(0, 20);
}

function collectSteps(steps: TestStep[], out: string[], depth = 0) {
  for (const s of steps) {
    if (s.category === 'test.step') {
      out.push(`${'  '.repeat(depth)}${s.title}${s.error ? ' ❌' : ''}`);
      collectSteps(s.steps, out, depth + 1);
    }
  }
}

/** แปลง error ของ Playwright เป็นภาษาคน */
export function humanize(raw: string): string {
  const s = stripAnsi(raw || '').trim();
  if (!s) return '';
  const lines = s.split('\n').map((l) => l.trimEnd());
  const first = lines[0];
  const exp = lines.find((l) => /^\s*Expected( string| pattern| substring|: | value)?/.test(l));
  const rec = lines.find((l) => /^\s*Received( string| value|: )?/.test(l));
  const loc = lines.find((l) => /^\s*Locator: /.test(l));
  const custom = first.startsWith('Error: ') && !/expect\(/.test(first) ? first.replace(/^Error: /, '') : '';
  const parts: string[] = [];
  if (custom && !/^(expect|locator|page)\./.test(custom) && !/Timed out/.test(custom)) parts.push(custom);
  if (/Timed out .* waiting for/.test(s) || /waiting for/.test(first)) {
    const w = lines.find((l) => /waiting for/.test(l));
    if (!exp) parts.push(`รอแล้วไม่พบ/ไม่เป็นไปตามที่คาด: ${(w || first).trim()}`);
  }
  if (loc) parts.push(`ตรวจที่ ${loc.replace(/^\s*Locator: /, '').trim()}`);
  if (exp) parts.push(`คาดหวัง ${exp.replace(/^\s*Expected[^:]*:\s*/, '').trim()}`);
  if (rec) parts.push(`แต่ได้จริง ${rec.replace(/^\s*Received[^:]*:\s*/, '').trim()}`);
  if (!parts.length) parts.push(first);
  return parts.join(' · ').slice(0, 900);
}

function ffmpeg(args: string[]) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  return r.status === 0 ? '' : (r.stderr || r.error?.message || 'ffmpeg error');
}

function rel(p: string) {
  return path.relative(OUT, p).split(path.sep).join('/');
}

function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function esc(s: string) {
  return (s || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

const STATUS_TH: Record<string, string> = { passed: '✅ ผ่าน', failed: '❌ ล้ม', timedOut: '❌ ล้ม (หมดเวลา)', skipped: '⏭ ข้าม', interrupted: '⚠️ ถูกขัด' };

class TesterReport implements Reporter {
  private rows: Row[] = [];
  private projectsInRun = new Set<string>();
  private gifMode = process.env.GIF === '1';

  onBegin(_config: FullConfig, suite: Suite) {
    for (const t of suite.allTests()) {
      const p = t.parent.project()?.name;
      if (p) this.projectsInRun.add(p);
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const project = test.parent.project()?.name ?? '?';
    const tags = test.tags.map((t) => t.replace(/^@/, ''));
    const tc = tcOf(test.title);
    const module = tags.find((t) => MODULES.includes(t)) ?? tc.split('-')[1] ?? '?';
    const priority = tags.find((t) => /^P[123]$/.test(t)) ?? '?';
    const expected = test.annotations.find((a) => a.type === 'expected')?.description ?? '';
    const steps: string[] = [];
    collectSteps(result.steps, steps);
    const videos = result.attachments.filter((a) => (a.name === 'video' || a.name === 'video-extra') && a.path).map((a) => a.path!);
    // วิดีโอหลักของ page ก่อน แล้วค่อยวิดีโอผู้ใช้คนอื่น
    videos.sort((a, b) => Number(a.includes('extra-videos')) - Number(b.includes('extra-videos')));
    this.rows.push({
      project, tc, title: test.title, file: path.relative(ROOT, test.location.file).split(path.sep).join('/'),
      module, priority, expected,
      status: result.status, durationMs: result.duration,
      error: result.errors.map((e) => stripAnsi(e.message || e.value || '')).join('\n---\n'),
      steps,
      videos,
      screenshots: result.attachments.filter((a) => a.name === 'screenshot' && a.path).map((a) => a.path!),
      traces: result.attachments.filter((a) => a.name === 'trace' && a.path).map((a) => a.path!),
      finishedAt: new Date().toISOString(),
      notes: Object.fromEntries(test.annotations.concat(result.annotations ?? []).filter((a) => a.type !== 'expected' && a.description).map((a) => [a.type, a.description!])),
    });
  }

  async onEnd(result: FullResult) {
    if (!this.rows.length) return; // เช่น --list หรือ global-setup ล้ม: ไม่ทับผลเดิม
    fs.mkdirSync(GIF_DIR, { recursive: true });
    fs.mkdirSync(MP4_DIR, { recursive: true });

    // 1) วิดีโอ → GIF + MP4 (ตั้งชื่อตามรหัส TC; มีหลายคลิป = <TC>-2, <TC>-3)
    const conv: string[] = [];
    for (const r of this.rows) {
      r.videos = r.videos.filter((v) => fs.existsSync(v));
      r.videos.forEach((v, i) => {
        const name = i === 0 ? r.tc : `${r.tc}-${i + 1}`;
        const gif = path.join(GIF_DIR, `${name}.gif`);
        const mp4 = path.join(MP4_DIR, `${name}.mp4`);
        const e1 = ffmpeg(['-i', v, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', mp4]);
        const e2 = ffmpeg(['-i', v, '-vf', 'fps=6,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', gif]);
        if (e1 || e2) conv.push(`${name}: ${e1} ${e2}`.trim());
      });
    }
    if (conv.length) console.log(`[tester-report] แปลงวิดีโอไม่สำเร็จ ${conv.length} ไฟล์:\n${conv.join('\n')}`);

    // 2) รวมผลกับรอบก่อน (ทับเฉพาะ project ที่รันรอบนี้)
    const storePath = path.join(OUT, 'results.json');
    const store = readJson<Store>(storePath, { runs: {} });
    const now = new Date().toISOString();
    for (const p of this.projectsInRun) {
      const run = { runAt: now, gifMode: this.gifMode, rows: this.rows.filter((r) => r.project === p) };
      if (this.gifMode) (store.gifRuns ??= {})[p] = run;
      else store.runs[p] = run;
    }
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

    // 3) เขียน TEST-REPORT.md
    fs.writeFileSync(path.join(OUT, 'TEST-REPORT.md'), this.render(store, result));
    console.log(`[tester-report] เขียน ${path.join(OUT, 'TEST-REPORT.md')}`);
  }

  private render(store: Store, result: FullResult): string {
    const info = readJson<any>(path.join(OUT, 'run-info.json'), {});
    const triage = readJson<Record<string, { class: string; note?: string }>>(path.join(ROOT, 'triage.json'), {});
    const all: Row[] = PROJECTS.flatMap((p) => store.runs[p]?.rows ?? []);
    const isFail = (r: Row) => r.status === 'failed' || r.status === 'timedOut' || r.status === 'interrupted';
    const executed = all.filter((r) => r.status !== 'skipped');
    const passed = executed.filter((r) => r.status === 'passed').length;
    const rate = executed.length ? (passed * 100) / executed.length : 0;
    const p1Fail = all.filter((r) => r.priority === 'P1' && isFail(r));
    // แผน 6.4: ข้าม = ไม่ผ่าน (P1 ที่ข้ามต้องไม่เหลือ) ยกเว้น TC ที่ unit ตามแผนผ่านจริงรอบนี้ (test-report/unit-proof.json จาก run-unit-proof.mjs) — ตรงกับ build-index.mjs
    const unitProof = readJson<Record<string, { status: string }>>(path.join(OUT, 'unit-proof.json'), {});
    const p1Skipped = all.filter((r) => r.priority === 'P1' && r.status === 'skipped' && unitProof[r.tc]?.status !== 'passed');
    const meets = executed.length > 0 && p1Fail.length === 0 && p1Skipped.length === 0 && rate >= 95;
    const gif = (tc: string) => fs.existsSync(path.join(GIF_DIR, `${tc}.gif`));
    const mp4 = (tc: string) => fs.existsSync(path.join(MP4_DIR, `${tc}.mp4`));
    const L: string[] = [];

    L.push('# TEST REPORT — ลูกหนัง อารีน่า');
    L.push('');
    L.push(`สร้างเมื่อ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} · เวลาที่ล็อกในระบบ \`${info.lockedNow ?? '-'}\` · ` +
      `**BUG_MODE = ${info.bugModeFromHtml ?? '?'}** (อ่านจาก \`<html data-bug-mode>\`) · ผลรวมรอบล่าสุดของแต่ละ project (Playwright: ${result.status})`);
    L.push('');
    L.push('แผนทดสอบ: [`docs/09-TEST-PLAN.md`](../../docs/09-TEST-PLAN.md) · HTML report: `npm run report`');
    L.push('');
    L.push('## 1. สรุปผล');
    L.push('');
    L.push('| project | รันเมื่อ | ผ่าน | ล้ม | ข้าม | รวม |');
    L.push('|---|---|---|---|---|---|');
    for (const p of PROJECTS) {
      const run = store.runs[p];
      if (!run) { L.push(`| ${p} | (ยังไม่รัน) | – | – | – | – |`); continue; }
      const rs = run.rows;
      L.push(`| ${p}${run.gifMode ? ' (โหมด GIF)' : ''} | ${new Date(run.runAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} | ${rs.filter((r) => r.status === 'passed').length} | ${rs.filter(isFail).length} | ${rs.filter((r) => r.status === 'skipped').length} | ${rs.length} |`);
    }
    L.push('');
    const gifRuns = Object.entries(store.gifRuns ?? {});
    if (gifRuns.length) {
      L.push(`รอบอัดหลักฐาน (\`npm run test:gif\`, slowMo 650 ms — ไม่ใช้ตัดสินผล): ` + gifRuns.map(([p, run]) =>
        `${p} ผ่าน ${run.rows.filter((r) => r.status === 'passed').length} ล้ม ${run.rows.filter(isFail).length} ข้าม ${run.rows.filter((r) => r.status === 'skipped').length}`).join(' · '));
      L.push('');
    }
    L.push(`- ผ่านรวม **${passed}/${executed.length} = ${rate.toFixed(1)}%** (เกณฑ์ ≥ 95%, ไม่นับข้อที่ข้าม)`);
    L.push(`- P1 ที่ล้ม: **${p1Fail.length}** ผล (เกณฑ์ 0)${p1Fail.length ? ' → ' + [...new Set(p1Fail.map((r) => r.tc))].join(', ') : ''}`);
    L.push(`- P1 ที่ข้ามและไม่มี unit พิสูจน์: **${p1Skipped.length}** ผล (นับเป็นไม่ผ่าน)${p1Skipped.length ? ' → ' + [...new Set(p1Skipped.map((r) => r.tc))].join(', ') : ''}`);
    L.push(`- **ผ่านเกณฑ์: ${meets ? '✅ ผ่าน' : '❌ ไม่ผ่าน'}**`);
    const perfRows = all.filter((r) => r.project.startsWith('perf-'));
    if (perfRows.length) L.push(`- NFR-08 (TC-BOOK-02 รันเดี่ยว) เวลาเปิด /book จน data-ready: ` + perfRows.map((r) => `${r.project.replace('perf-', '')} ${r.notes?.['load-ms'] ?? '?'} ms`).join(' · ') + ' (เกณฑ์ ≤ 2,000 ms)');
    L.push('');

    L.push('## 2. ผลตามโมดูล');
    L.push('');
    L.push('| โมดูล | จำนวน TC | ผลที่รัน | ผ่าน | ล้ม | TC ที่ล้ม |');
    L.push('|---|---|---|---|---|---|');
    for (const m of MODULES) {
      const rs = all.filter((r) => r.module === m);
      if (!rs.length) continue;
      const tcs = [...new Set(rs.map((r) => r.tc))];
      const failTc = [...new Set(rs.filter(isFail).map((r) => r.tc))];
      L.push(`| ${m} | ${tcs.length} | ${rs.filter((r) => r.status !== 'skipped').length} | ${rs.filter((r) => r.status === 'passed').length} | ${rs.filter(isFail).length} | ${failTc.join(', ') || '–'} |`);
    }
    L.push('');

    L.push('## 3. ผลราย TC ทุกเบราว์เซอร์');
    L.push('');
    L.push('| TC | สิ่งที่ทดสอบ | ระดับ | chromium | firefox | webkit | serial | GIF | MP4 |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    const tcs = [...new Set(all.map((r) => r.tc))].sort((a, b) => {
      const ma = MODULES.indexOf(a.split('-')[1]), mb = MODULES.indexOf(b.split('-')[1]);
      return ma - mb || a.localeCompare(b);
    });
    for (const tc of tcs) {
      const rs = all.filter((r) => r.tc === tc);
      const cell = (p: string) => {
        const r = rs.find((x) => x.project === p);
        if (r) return STATUS_TH[r.status] ?? r.status;
        const pr = rs.find((x) => x.project === `perf-${p}`); // TC ที่รันใน perf แสดงในคอลัมน์เบราว์เซอร์นั้น
        return pr ? `${STATUS_TH[pr.status] ?? pr.status} (perf)` : '–';
      };
      const t = rs[0];
      const title = t.title.replace(/^TC-[A-Z0-9]+-\d+\s*/, '');
      L.push(`| ${tc} | ${esc(title)} | ${t.priority} | ${cell('chromium')} | ${cell('firefox')} | ${cell('webkit')} | ${cell('serial')} | ${gif(tc) ? `[gif](gifs/${tc}.gif)` : '–'} | ${mp4(tc) ? `[mp4](videos/${tc}.mp4)` : '–'} |`);
    }
    L.push('');
    const gifCount = fs.readdirSync(GIF_DIR).filter((f) => f.endsWith('.gif')).length;
    const mp4Count = fs.readdirSync(MP4_DIR).filter((f) => f.endsWith('.mp4')).length;
    const noVideo = tcs.filter((tc) => !gif(tc));
    L.push(`หลักฐาน: GIF ${gifCount} ไฟล์ · MP4 ${mp4Count} ไฟล์ (จาก \`npm run test:gif\` = Chromium + serial + perf-chromium) · ไม่มีวิดีโอ: ${noVideo.join(', ') || '–'} (เรียก API อย่างเดียว ไม่เปิดหน้าเว็บ หรือข้ามเพราะทดสอบไม่ได้)`);
    L.push('');

    L.push('## 4. ข้อบกพร่อง (Defects)');
    L.push('');
    const failedTcs = tcs.filter((tc) => all.some((r) => r.tc === tc && isFail(r)));
    if (!failedTcs.length) L.push('ไม่พบข้อบกพร่องในรอบนี้');
    failedTcs.forEach((tc, i) => {
      const rs = all.filter((r) => r.tc === tc && isFail(r));
      const t = rs[0];
      const tri = triage[tc];
      const id = `DEF-${String(i + 1).padStart(3, '0')}`;
      L.push(`### ${id} · ${tc} ${t.title.replace(/^TC-[A-Z0-9]+-\d+\s*/, '')}`);
      L.push('');
      L.push(`| หัวข้อ | รายละเอียด |`);
      L.push('|---|---|');
      L.push(`| ระดับ | **${t.priority}** |`);
      L.push(`| จัดเป็น | ${tri ? `**${tri.class}**${tri.note ? ' — ' + esc(tri.note) : ''}` : '(ยังไม่ได้วิเคราะห์)'} |`);
      L.push(`| เบราว์เซอร์ที่ล้ม | ${rs.map((r) => r.project).join(', ')} |`);
      L.push(`| ผลที่คาดหวัง | ${esc(t.expected)} |`);
      L.push(`| ผลจริง | ${esc(humanize(t.error))} |`);
      const ev: string[] = [];
      if (gif(tc)) ev.push(`[GIF](gifs/${tc}.gif)`);
      if (mp4(tc)) ev.push(`[MP4](videos/${tc}.mp4)`);
      for (const r of rs) {
        for (const s of r.screenshots) ev.push(`[screenshot ${r.project}](${rel(s)})`);
        for (const s of r.traces) ev.push(`[trace ${r.project}](${rel(s)})`);
      }
      L.push(`| หลักฐาน | ${ev.join(' · ') || '–'} |`);
      L.push(`| ไฟล์ test | \`${t.file}\` |`);
      L.push('');
      L.push('ขั้นตอนทำซ้ำ:');
      L.push('');
      const steps = t.steps.length ? t.steps : ['(ดูโค้ด test)'];
      steps.forEach((s, k) => L.push(`${s.startsWith(' ') ? '   ' : ''}${k + 1}. ${s.trim()}`));
      L.push('');
    });
    // บันทึกของ tester (เขียนมือหลังวิเคราะห์) ต่อท้ายรายงาน
    try { L.push(fs.readFileSync(path.join(ROOT, 'notes.md'), 'utf8')); } catch { /* ไม่มีก็ข้าม */ }
    return L.join('\n') + '\n';
  }

  printsToStdio() {
    return false;
  }
}

export default TesterReport;
