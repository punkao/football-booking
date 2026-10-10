import * as fs from 'node:fs';
import * as path from 'node:path';
import { LOCKED_NOW, BASE_URL } from './tests/constants';

/**
 * เกณฑ์เริ่ม: /api/health = {ok:true, db:true} แล้ว reset + ล็อกเวลา "ครั้งเดียว"
 * (3 เบราว์เซอร์รันพร้อมกัน test ปกติห้าม reset เอง)
 */
export default async function globalSetup() {
  let health: any = null;
  try {
    const r = await fetch(`${BASE_URL}/api/health`);
    health = await r.json();
  } catch (e) {
    health = { error: String(e) };
  }
  if (!health || health.ok !== true || health.db !== true) {
    throw new Error(
      `เว็บยังไม่พร้อมทดสอบ: GET ${BASE_URL}/api/health ได้ ${JSON.stringify(health)} (ต้องเป็น {"ok":true,"db":true})\n` +
        `วิธีเปิดระบบ: cd web; docker compose up -d   แล้วรอจน football-web และ football-db เป็น healthy`,
    );
  }

  const r = await fetch(`${BASE_URL}/api/test/reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ now: LOCKED_NOW }),
  });
  const reset: any = await r.json().catch(() => ({}));
  if (r.status !== 200 || reset.ok !== true) {
    throw new Error(
      `reset ไม่สำเร็จ: POST /api/test/reset ได้ HTTP ${r.status} ${JSON.stringify(reset)} — ` +
        `ต้องเปิด ALLOW_TEST_RESET=1 ใน container web`,
    );
  }

  // อ่าน data-bug-mode จาก <html> ของหน้าแรก (NFR-09) เพื่อบอกในรายงาน
  const html = await (await fetch(`${BASE_URL}/`)).text();
  const m = html.match(/data-bug-mode="(\d)"/);
  const info = {
    startedAt: new Date().toISOString(),
    lockedNow: LOCKED_NOW,
    bugModeFromHtml: m ? m[1] : null,
    bugModeFromReset: reset.bugMode ?? null,
    gifMode: process.env.GIF === '1',
  };
  const dir = path.join(__dirname, 'test-report');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'run-info.json'), JSON.stringify(info, null, 2));
}
