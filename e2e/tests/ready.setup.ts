import { test as setup, expect } from '@playwright/test';

// project "setup": เกณฑ์เริ่มซ้ำอีกครั้งก่อนเบราว์เซอร์เริ่ม (global-setup reset ไปแล้ว ที่นี่ไม่ reset)
setup('เกณฑ์เริ่ม: /api/health = {ok:true, db:true}', async ({ request }) => {
  const r = await request.get('/api/health');
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ ok: true, db: true });
});
