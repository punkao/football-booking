import { spawnSync } from 'node:child_process';
import { test, expect, open, getJson, resetData } from '../fixtures';
import { ann } from '../v2-helpers';

/**
 * REVIEW-1 (CR-05): ราคาที่มีวันมีผลอยู่ใน DB ไม่ใช่ในโค้ด (CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05)
 * หน้าแรกต้องอ่านราคาจากตาราง field_rates เหมือน /api/fields — ร้านเพิ่มแถวราคาใหม่แล้วการ์ดหน้าแรกต้องตามทันทีโดยไม่ต้องแก้โค้ด
 * serial: แก้ข้อมูล field_rates ชั่วคราว (เพิ่มแถวแล้วลบเอง ทั้งในกรณีผ่านและล้ม)
 */

const FIELD = 'A';
const FROM = '2026-10-20'; // หลังวันล็อก (9 ต.ค.) ก่อน 1 พ.ย. → เป็น "ราคาที่จะเริ่มถัดไป" ของสนาม A
const DAY = 850;
const EVENING = 1250;

function psql(q: string) {
  const r = spawnSync('docker', ['exec', 'football-db', 'psql', '-U', 'football', '-d', 'football', '-v', 'ON_ERROR_STOP=1', '-At', '-c', q], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql ล้ม: ${r.stderr || r.error?.message}`);
}
const removeTemp = () => psql(`DELETE FROM field_rates WHERE field_id = '${FIELD}' AND effective_from = DATE '${FROM}'`);

test.beforeEach(async ({ request }) => { await resetData(request); removeTemp(); });
test.afterEach(async ({ request }) => { removeTemp(); await resetData(request); });

test('REVIEW-1 ร้านเพิ่มแถวราคาใน field_rates → การ์ดสนาม A หน้าแรกแสดงราคาใหม่เท่ากับ /api/fields (หน้าแรกไม่ใช้ราคาที่ฝังในโค้ด)', {
  tag: ['@CR-05', '@P1'],
  annotation: ann({
    tc: 'REVIEW-1', level: 'P1', source: '[D:CR-05] CHANGE-REQUESTS/answers/README.md หัวข้อ CR-05 "ราคาและวันมีผลอยู่ใน DB ไม่ใช่ในโค้ด" · CR-05-02 (หน้าแรก = /api/fields)',
    expected: `เพิ่ม field_rates(A, ${FROM}, ${DAY}, ${EVENING}) → /api/fields A rateChanges[0] = ${FROM} ${DAY}/${EVENING} · หน้าแรก home-field-A-next-rate data-from ${FROM} data-value ${EVENING} data-day-value ${DAY} · ลบแถว → หน้าแรกกลับเป็น 2026-11-01 / 1300`,
  }),
}, async ({ page, request }) => {
  await test.step(`เพิ่มแถวราคาใหม่ของสนาม A ตั้งแต่ ${FROM} (กลางวัน ฿${DAY} · เย็น ฿${EVENING}) ลงตาราง field_rates ตรง ๆ`, async () => {
    psql(`INSERT INTO field_rates(field_id, effective_from, day_rate, evening_rate) VALUES ('${FIELD}', DATE '${FROM}', ${DAY}, ${EVENING})`);
    const api = (await getJson(request, '/api/fields')).body.fields.find((f: any) => f.id === FIELD);
    expect(api.rateChanges[0], '/api/fields เห็นแถวใหม่').toEqual({ from: FROM, dayRate: DAY, eveningRate: EVENING });
  });
  await test.step('หน้าแรก: การ์ดสนาม A บอก "ราคาถัดไป" ตามแถวใหม่ ไม่ใช่ ฿1,300 จากโค้ด', async () => {
    await open(page, '/');
    const next = page.getByTestId(`home-field-${FIELD}-next-rate`);
    await expect.soft(next).toHaveAttribute('data-from', FROM);
    await expect.soft(next).toHaveAttribute('data-value', String(EVENING));
    await expect.soft(next).toHaveAttribute('data-day-value', String(DAY));
    await expect.soft(next).toContainText('฿1,250');
  });
  await test.step('ลบแถวชั่วคราว → หน้าแรกกลับเป็นราคาจริงของร้าน 1 พ.ย. ฿1,300', async () => {
    removeTemp();
    await open(page, '/');
    const next = page.getByTestId(`home-field-${FIELD}-next-rate`);
    await expect.soft(next).toHaveAttribute('data-from', '2026-11-01');
    await expect.soft(next).toHaveAttribute('data-value', '1300');
  });
});
