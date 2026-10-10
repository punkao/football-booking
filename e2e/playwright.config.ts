// ต้องตั้งก่อนโหลด Playwright ทุกอย่าง: เครื่องที่ path ผู้ใช้มีช่องว่าง ("C:\Users\Windows 11\...") เปิด Chrome/Firefox ไม่ได้
// จึงเก็บเบราว์เซอร์ไว้ที่ D:/ms-playwright · เครื่องอื่นที่ไม่มีโฟลเดอร์นี้ใช้ที่เก็บปกติของ Playwright
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && require('node:fs').existsSync('D:/ms-playwright')) process.env.PLAYWRIGHT_BROWSERS_PATH = 'D:/ms-playwright';

// ใช้ require (ไม่ใช่ import) เพื่อให้บรรทัดบนทำงานก่อนจริง — import จะถูกยกขึ้นไปก่อนเสมอ
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { defineConfig, devices } = require('@playwright/test') as typeof import('@playwright/test');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const GIF = process.env.GIF === '1';
/**
 * PERF=1 → รันเฉพาะ test วัดความเร็ว (*.perf.spec.ts, NFR-08) ทีละข้อ ทั้ง 3 เบราว์เซอร์ (workers 1)
 * `npm test` (run-all.mjs) รันรอบหลักก่อน (3 เบราว์เซอร์ + serial) แล้วค่อยรัน PERF=1 แยกอีกครั้ง
 * → ตอนวัดไม่มี test อื่นรันพร้อมกันเลย (NFR-08 นิยามใหม่ ตอบ Q-T6)
 */
const PERF = process.env.PERF === '1';

const common = {
  viewport: { width: 1280, height: 800 },
  locale: 'th-TH',
  timezoneId: 'Asia/Bangkok',
};
const SERIAL = /\.serial\.spec\.ts$/;
const PERF_FILE = /\.perf\.spec\.ts$/;
const SETUP = /\.setup\.ts$/;

const mainProjects = [
  {
    // ตรวจระบบพร้อม (ไม่ reset) · teardown = serial → serial รันหลังทุกเบราว์เซอร์ที่พึ่ง setup จบ แม้มีข้อที่ล้ม
    // (ถ้าใช้ dependencies ตรง ๆ Playwright จะข้าม serial ทั้งหมดเมื่อมี test ในเบราว์เซอร์ล้ม)
    name: 'setup',
    testMatch: SETUP,
    teardown: 'serial',
  },
  {
    name: 'chromium',
    testIgnore: [SERIAL, SETUP, PERF_FILE],
    dependencies: ['setup'],
    use: { ...devices['Desktop Chrome'], ...common, launchOptions: GIF ? { slowMo: 650 } : {} },
  },
  { name: 'firefox', testIgnore: [SERIAL, SETUP, PERF_FILE], dependencies: ['setup'], use: { ...devices['Desktop Firefox'], ...common } },
  { name: 'webkit', testIgnore: [SERIAL, SETUP, PERF_FILE], dependencies: ['setup'], use: { ...devices['Desktop Safari'], ...common } },
  {
    // test ที่เลื่อนเวลา (/api/test/clock) — รันทีละข้อ หลัง 3 เบราว์เซอร์จบ, Chromium อย่างเดียว
    name: 'serial',
    testMatch: SERIAL,
    workers: 1,
    fullyParallel: false,
    use: { ...devices['Desktop Chrome'], ...common, launchOptions: GIF ? { slowMo: 650 } : {} },
  },
];

const perfProjects = [
  { name: 'perf-chromium', testMatch: PERF_FILE, use: { ...devices['Desktop Chrome'], ...common, launchOptions: GIF ? { slowMo: 650 } : {} } },
  { name: 'perf-firefox', testMatch: PERF_FILE, use: { ...devices['Desktop Firefox'], ...common } },
  { name: 'perf-webkit', testMatch: PERF_FILE, use: { ...devices['Desktop Safari'], ...common } },
];

export default defineConfig({
  testDir: './tests',
  outputDir: PERF ? './test-results-perf' : './test-results',
  globalSetup: require.resolve('./global-setup'),
  timeout: GIF ? 600_000 : 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: !PERF,
  retries: 0,
  // perf: ทีละ test ทีละเบราว์เซอร์ ไม่มีอะไรรันพร้อมกัน
  workers: PERF ? 1 : 6,
  reporter: [
    ['list'],
    ['html', { outputFolder: PERF ? 'test-report/html-perf' : 'test-report/html', open: 'never' }],
    ['./reporters/tester-report.ts'],
  ],
  use: {
    baseURL: BASE_URL,
    ...common,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: GIF ? { mode: 'on', size: { width: 1280, height: 800 } } : 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: PERF ? perfProjects : mainProjects,
});
