# TEST-PROMPT — วางแผนและเขียน test ให้เว็บ "ลูกหนัง อารีน่า" (เฟส 6–7)

คุณคือ tester อิสระ ไม่ได้สร้างเว็บนี้ และ**ไม่รู้ว่ามีบั๊กอะไร** อ้างอิงจากบทเรียน 00_tester/03 LAB 6–8
ทำทุกอย่างในโฟลเดอร์ `football-booking/` ตามขั้นที่มีเลขกำกับ · ขั้นไหนไม่ผ่านให้หยุดและรายงานสาเหตุจริง · ห้ามแต่งผล

## อ่านได้เฉพาะไฟล์นี้
- `docs/04-REQUIREMENTS.md` — **แหล่งความจริงเดียว** (FR, BR + ค่าขอบ, NFR, contract)
- `web/SPEC.md` — หน้าเว็บ, `data-testid`, ข้อความ error คำต่อคำ, API, seed, วิธี reset/ล็อกเวลา/BUG_MODE
- `docs/00-ENVIRONMENT.md` — ข้อเท็จจริงของเครื่อง (IPv6 ใช้ไม่ได้, เบราว์เซอร์อยู่ที่ `D:/ms-playwright`)
**ห้ามเปิด:** โค้ดใน `web/` (นอกจาก `SPEC.md`), `web/BUGS.md`, `web/selfcheck/`, `docs/08-BUILD-PROMPT.md`, `docs/trace/`, `docs/05b-EXPLORATION.md`, `tools/check-*`

**ถ้า `SPEC.md` ขัดกับ `04-REQUIREMENTS.md` ให้ยึด `04`** แล้วเขียน test ตาม `04` (test จะล้ม = ข้อบกพร่อง) และรายงานจุดที่ขัด · ห้ามเปลี่ยนผลที่คาดหวังให้ตรงกับ SPEC

## 1. เขียน `docs/09-TEST-PLAN.md` แบบ tester มืออาชีพ
1. ระบบที่ทดสอบ · ขอบเขต (ทดสอบ / ไม่ทดสอบ) เป็นตาราง
2. เทคนิคพร้อมตัวอย่างจากเว็บนี้: happy path, negative, boundary (ค่าขอบ), equivalence, state (รีโหลด/ทำซ้ำ), API, สิทธิ์
3. ระดับ: **P1** = เงินผิด / จองไม่ได้ / จองซ้อน / เวลากฎผิด · **P2** = ฟีเจอร์สำคัญ · **P3** = สวยงาม/เกิดไม่บ่อย
4. ตาราง test case **40–50 ข้อ**: `ID (TC-<โมดูล>-01)` | โมดูล | สิ่งที่ทดสอบ | FR/BR/NFR | ระดับ | ข้อมูลที่ใช้ | ผลที่คาดหวัง (ตัวเลข/ข้อความจริงจาก `04` และ `SPEC`)
   โมดูล: `HOME, BOOK, PRICE, PAY, CANCEL, CREDIT, SERIES, RENT, MEMBER, TEAM, STAFF, OWNER, I18N, MOB, API`
   ต้องมี: จองจนจ่ายจบ (E2E) · ค่าขอบทุก BR ที่สำคัญ (เช่น 14/15 วัน, 59/60 นาที, 24 ชั่วโมงพอดี, 7/8 สัปดาห์, ชุดที่ 7, ไม่มา 14/15 นาที) · จองซ้อน · จองพร้อมกัน (NFR-07) · ไม่เข้าสู่ระบบเรียก API หน้าร้าน → ถูกปฏิเสธ
5. ตาราง Traceability: FR/BR → TC (**ทุก FR และ BR ต้องมี TC อย่างน้อย 1 ข้อ**)
6. เกณฑ์เริ่ม: 2 container healthy + `/api/health` = `{ok:true, db:true}` · เกณฑ์ผ่าน: **P1 ผ่านหมด และผ่านรวม ≥ 95%**
7. หลักฐาน: ทุก test ที่เปิดหน้าเว็บต้องมี GIF และ MP4
ค่าที่ `04`/`SPEC` ไม่ได้บอก ให้เขียน "ต้องถาม" ห้ามเดา · ท้ายไฟล์สรุป: โมดูล | จำนวน TC | P1 | P2 | P3

## 2. สร้างโปรเจกต์ `e2e/` (Playwright TypeScript) — ห้ามแก้อะไรใน `web/`
1. `package.json`: `@playwright/test` **1.64.0 (ตรงรุ่นที่ลงเบราว์เซอร์ไว้)**, `cross-env`, `typescript` · scripts: `test`, `test:gif` (`cross-env GIF=1 ... --project=chromium`), `report` · ติดตั้งด้วย `NODE_OPTIONS=--dns-result-order=ipv4first`
2. `playwright.config.ts`: ตั้ง `process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:/ms-playwright'` **ก่อน** อะไรทั้งหมด (path ผู้ใช้มีช่องว่าง เปิด Chrome/Firefox ไม่ได้) · projects chromium / firefox / webkit · viewport 1280×800 · `locale: 'th-TH'` · `timezoneId: 'Asia/Bangkok'` · GIF=1 → อัดวิดีโอทุก test + `slowMo: 650` เฉพาะ chromium
3. `global-setup.ts`: เช็ก `/api/health` (ถ้าไม่พร้อม error ภาษาไทยบอกวิธีเปิด `cd web; docker compose up -d`) แล้ว `POST /api/test/reset` พร้อม `now` ที่ล็อกไว้ **ครั้งเดียว** (3 เบราว์เซอร์รันพร้อมกัน ห้าม reset ใน test ปกติ)
4. test ที่ต้องเลื่อนเวลา (`/api/test/clock`) เช่น หมด 15 นาที, ไม่มา 15 นาที, 24 ชั่วโมง, 30 วัน → แยกไว้ใน project/ไฟล์ที่**รันทีละข้อหลังจาก 3 เบราว์เซอร์จบ** (`*.serial.spec.ts`, chromium อย่างเดียว) และ reset กลับหลังแต่ละข้อ
5. `tests/fixtures.ts`: `open(page, path)` รอ `html[data-ready="true"]` · login ผ่าน API · สร้างลูกค้า/การจองด้วยเบอร์ไม่ซ้ำ · **แต่ละเบราว์เซอร์ใช้วัน/สนามต่างกัน** กันชนกัน · โหมด GIF: ป้ายชื่อ test มุมซ้ายล่าง + วงแดงตรงจุดคลิก + ค้างเฟรมสุดท้าย 2.5 วินาที
6. `reporters/tester-report.ts`: แปลงวิดีโอเป็น `test-report/gifs/<TC>.gif` และ `test-report/videos/<TC>.mp4` ด้วย ffmpeg · เขียน `test-report/TEST-REPORT.md` ภาษาไทยแบบ tester: สรุปผล + ผ่านเกณฑ์ไหม, ผลตามโมดูล, ผลราย TC ทุกเบราว์เซอร์พร้อมลิงก์ GIF/MP4, ข้อบกพร่อง DEF-001… (ระดับ, ขั้นตอนทำซ้ำ, ผลที่คาดหวัง, ผลจริงเป็นภาษาคน, หลักฐาน) และบอกโหมด BUG_MODE จาก `data-bug-mode`
7. ชื่อ test ขึ้นต้นด้วยรหัส TC · `tag: ['@<โมดูล>', '@P1|@P2|@P3']` · `annotation: { type: 'expected', description: '<ผลที่คาดหวัง>' }` · หา element ด้วย `getByTestId` ตาม SPEC เท่านั้น ห้ามเดา selector · test ที่ตรวจ console ให้กรอง "Failed to load resource" ของ 4xx ที่ตั้งใจออก

## 3. ลอง 2 test ก่อน
เขียน `TC-HOME-01` และ `TC-API-01` → `npx playwright test` ผ่านทั้ง 3 เบราว์เซอร์ → `npm run test:gif` ได้ทั้ง .gif และ .mp4 · ถ้าไม่ผ่านให้หยุดแก้ให้ได้ก่อน

## 4. เขียนครบทุก TC แล้วรันจริง
1. เขียนทุก TC ใน TEST-PLAN ลง `e2e/tests/` แยกไฟล์ตามโมดูล
2. รัน `npx playwright test` (3 เบราว์เซอร์ + serial) · ข้อที่ล้ม: ดูภาพ/trace ตอนล้มก่อน แล้วจัดเป็น **เว็บผิด** / **test เขียนผิด** / **กฎไม่ชัด** · แก้ได้เฉพาะ test ที่เขียนผิดจริง **ห้ามเปลี่ยนผลที่คาดหวังให้ผ่าน ห้ามแก้เว็บ**
3. รันซ้ำอีก 1 รอบ ถ้าผลไม่เหมือนเดิม ให้บอกข้อนั้นและสาเหตุ (flaky)
4. `npm run test:gif` แล้วตรวจว่าทุก test ที่เปิดหน้าเว็บมีทั้ง .gif และ .mp4

## 5. รายงานท้ายงาน (เป็นตาราง)
- TEST-PLAN: จำนวน TC ต่อโมดูล P1/P2/P3 · FR/BR ที่ไม่มี TC (ต้องเป็น 0) · รายการ "ต้องถาม"
- ผลรัน: เบราว์เซอร์ | ผ่าน | ล้ม | ข้าม · serial | ผ่าน | ล้ม · จำนวน GIF | MP4 · ผ่านเกณฑ์ไหม
- ทุกข้อที่ล้ม: TC | ระดับ | จัดเป็น (เว็บผิด / test ผิด / กฎไม่ชัด) | ผลที่คาดหวัง | ผลจริง | GIF
- จุดที่ SPEC ขัดกับ 04 · test ที่แก้เพราะเขียนผิด (บอกว่าแก้อะไร) · ผลรอบที่ 2 เหมือนรอบแรกไหม
