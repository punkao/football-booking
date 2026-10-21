# ลูกหนัง อารีน่า v2 · กติกาทีมดูแลระบบเดิม (ล้อมรั้วก่อนแก้)

ระบบจองสนามบอลที่รับมอบ (tag `v2-handover`) · แผนที่ระบบ: legacy/SYSTEM-MAP.md (ส่วน I กับดัก · ส่วน L CR → ไฟล์) · คำอ้างที่ตรวจแล้ว: legacy/HANDOVER-CHECK.md · คำถามค้างถึงร้าน: legacy/SPEC-GAPS.md · ตาข่าย: legacy/BASELINE.md, legacy/MUTANTS.md

## รันยังไง (จากโฟลเดอร์ `football-booking/`)
- เปิด: `docker compose -f db/compose.yaml up -d` (รอ healthy) → `docker compose -f web/compose.yaml up -d --build` · เว็บ http://localhost:3000 · ตรวจ `curl http://localhost:3000/api/version` = schemaVersion ล่าสุดใน `db/migrations` · bugMode 0 · chatMode mock
- `BUG_MODE` / `MODE` / `ALLOW_TEST_RESET` มาจาก `web/.env` หรือ shell (shell ชนะ): Git Bash `BUG_MODE=0 ALLOW_TEST_RESET=1 docker compose -f web/compose.yaml up -d` · PowerShell `$env:BUG_MODE="0"; docker compose …` แล้ว `Remove-Item Env:BUG_MODE`
- สมองแชท: `node tools/chat-mode.mjs mock` (ค่าเริ่ม ไม่ออก network) · `node tools/chat-mode.mjs ai` = ผ่าน mock-llm ในเครื่องเท่านั้น · จบงานต้องกลับ `mock`
- reset ข้อมูล + ล็อกเวลา ศ 9 ต.ค. 2569 10:00: `curl -X POST http://localhost:3000/api/test/reset -H "content-type: application/json" -d "{}"` · เลื่อนเวลา `POST /api/test/clock {"now":"<ISO>"}` (ทั้งคู่ 404 เมื่อ `ALLOW_TEST_RESET≠1`)
- e2e ทั้งชุด: `cd e2e && node run-all.mjs` (3 เบราว์เซอร์ + serial + perf · ~15 นาที รันแบบ background) · ไฟล์เดียว `cd e2e && npx playwright test <file> --project=chromium --no-deps` (ไม่ใส่ `--no-deps` = project `setup` ลาก teardown `serial` ทั้ง 49 ข้อมาด้วย) · ข้อเลื่อนเวลา/migration: `RUN_MIGRATION_TEST=1 npx playwright test --project=chromium --project=serial`
- golden master: `node tests/golden/check.mjs` (เทียบ · ต่าง = exit 1) · `--update` เฉพาะเมื่อ CR อนุญาตและอ่าน diff แล้ว
- รายงาน e2e เขียนทับ `e2e/test-report/results.json` `TEST-REPORT.md` `run-info.json` (ไฟล์ใน git) → รอบทดลองให้ `git checkout -- e2e/test-report` คืน
- งานนาน (build ครั้งแรก · e2e 3 เบราว์เซอร์) รัน background แล้วรอผลจริง ห้ามสั่งซ้ำระหว่างรอ

## ห้ามแตะ
- ห้ามเปิด/อ่าน `web/BUGS.md` (เฉลยบั๊กที่ฝัง) · `.env` ทุกไฟล์ (`web/.env` `db/.env` มีรหัส) · `_solution/` ของอาจารย์ — ทั้งเครื่องมืออ่านไฟล์และคำสั่ง shell
- ห้ามแก้ test เดิม `e2e/tests/*.ts` · `e2e/plan-cases.json` · `docs/TEST-CASES.md` และค่าที่คาดหวังเดิม (รวม `tests/golden/*.json`) — ถ้าจำเป็นต้องเปลี่ยน: หยุดถาม แล้วจดแถวใน `ORACLE-CHANGES.md` (วันที่ | ไฟล์ | เคส | ค่าเดิม → ใหม่ | CR | ผู้อนุมัติ)
- ห้าม `docker compose … down -v` และห้ามลบ volume `football-pgdata` · ห้ามแก้ `db/init/*` เพื่อ deploy (เปลี่ยน schema = migration ใหม่ใน `db/migrations/` + down + เติม `01-schema.sql`)
- `.claude/settings.json` กันได้แค่เครื่องมือ Read/Edit/Write — **ไม่กัน shell** (`sed` `Set-Content` `cat`) → ห้ามใช้ shell อ้อมรั้ว

## กับดัก (จาก legacy/)
- ราคาสนามอยู่หลายที่: ตาราง `fields.day_rate/evening_rate` · `SEED_FIELDS` `web/lib/server/schema.ts` (สำเนาสำรองของหน้าแรก ใช้เฉพาะเมื่อ DB ไม่ตอบใน 2 วิ · หน้าแรกอ่านราคา+วันมีผลจาก DB `field_rates` ผ่าน `pageFieldsOrSeed`) · seed SQL · prompt/mock แชท · price guard แชท → แก้ราคาต้องแก้ครบ
- สมองแชท mock อ่าน **ข้อความล่าสุดข้อความเดียว** สำหรับถามว่าง/ราคา (`web/lib/chat/mock.ts:244-258`) · เฉพาะการจองที่รวมหลายข้อความ (`collect`)
- `node scripts/migrate.mjs --down N` **ไม่บังคับลำดับ** (ถอย 005 ได้ทั้งที่ 006 ยังอยู่) · `/api/version` ใช้ `max(version)` จึงไม่เห็นรูตรงกลาง
- `web/selfcheck/check-testdata.mjs` แถว E148 **ถอย 005 แล้วขึ้นใหม่บนฐานจริง** + reset ทุกกลุ่ม → ไม่ใช่การตรวจแบบอ่านอย่างเดียว
- role DB ของเว็บเป็น **superuser** (ปิด trigger กันแก้ประวัติได้) · session ไม่มีสถานะฝั่ง server (logout แค่ลบ cookie = CR-01)
- e2e ผูก seed + วันล็อก 9 ต.ค. 10:00 · global-setup reset ครั้งเดียว แล้ว 3 เบราว์เซอร์รันพร้อมกัน → test ปกติห้าม reset/เลื่อนเวลาเอง
- ปิด seam (`ALLOW_TEST_RESET=0`) แล้ว `/api/test/*` = 404 แต่ "ตอนนี้" ยังอ่านแถว `app_settings.clock` ที่ล็อกไว้ (`web/lib/server/core.ts:32-38`) → เครื่องจริงต้องไม่มีแถวนี้
- test ที่เปิดดูตอน `BUG_MODE=1` จะเห็นบั๊กที่ฝัง · งาน CR ทำบน `BUG_MODE=0` เสมอ

## วิธีทำ CR (ทีละเรื่อง · ทุกการเปลี่ยนต้องมีเทสต์ยืนยัน)
1. คำถามถึงร้าน (ไม่เดา) → อธิบายของเดิมด้วย `file:line` → `docs/impact/CR-0N.md` (ไฟล์ × ผู้เรียก grep × เทสต์ × DB × i18n · "ค้นแล้วไม่เจอ")
2. commit เทสต์แดงก่อน `CR-0N-red: …` (ต้องแดงด้วยเหตุที่ถูก) → commit แก้ `CR-0N: …` (แก้ให้เล็กที่สุด)
3. ถอด `test.fail()` ของ CR นั้นใน `e2e/tests/cr/known-issues.spec.ts` (ล็อกคู่: แก้แล้วข้อนั้นจะ "ผ่านโดยไม่คาด" = แดง)
4. regression: golden + e2e chromium+serial (+ 3 เบราว์เซอร์ก่อนส่ง) · ตัวเลขเทียบ legacy/BASELINE.md · `git status web db` สะอาดนอกจากไฟล์ของ CR
- ค่าที่คาดหวังติดป้ายแหล่งเสมอ: `[D:CR-0N]` คำตอบร้าน · `[E golden/…:sha8]` หลักฐานระบบ (ใช้ล็อกของเดิมเท่านั้น) · `[E]` ขัด `[D]` = ผู้ต้องสงสัยบั๊ก รายงาน ห้ามใช้เป็นค่าคาดหวัง

## เขียน test จากประโยคภาษาไทย (บท 02 LAB 9)
- ไฟล์ใหม่ใน `e2e/tests/cr/` หรือ `e2e/tests/my/` เท่านั้น · import `test`/`expect`/helper จาก `../fixtures` และ `../constants` (ห้ามแก้ไฟล์ต้นทาง)
- ประโยคร้าน 1 ประโยค = 1 `test` · แต่ละขั้นเป็น `test.step('ภาษาไทยที่ร้านอ่านเข้าใจ', …)` · annotation อ้างแหล่ง (`CHANGE-REQUESTS/CR-0N.md` · คำตอบร้าน `CHANGE-REQUESTS/answers/` · TC เดิม)
- test ที่ต้องข้อมูลสะอาด/เลื่อนเวลา: ใช้ `resetData` / `setClock` จาก fixtures และตั้งชื่อ `*.serial.spec.ts` (รัน Chromium ทีละข้อหลัง 3 เบราว์เซอร์จบ) · นอกนั้นห้าม reset ใช้ข้อมูลไม่ชน (`uniquePhone(b)` · `pick` แยกช่องต่อเบราว์เซอร์)
- รันไฟล์เดียวให้เขียวบน chromium ก่อน แล้วค่อยรันทั้งชุด
