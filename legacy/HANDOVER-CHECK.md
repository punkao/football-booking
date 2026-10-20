# HANDOVER-CHECK — ตรวจคำอ้างของผู้รับเหมาเดิมกับผลที่รันจริง

ทำเมื่อ 2026-10-20 · ทีมดูแลระบบรายใหม่ (chunk D-1 · บท 06 LAB 1 + บท 05 LAB 1) · ฐาน: git tag `v2-handover` = `faa3f2e` · HEAD `95a5513` (เพิ่มแค่ `CHANGE-REQUESTS/` · `git diff --stat v2-handover HEAD` = 8 ไฟล์ใน CHANGE-REQUESTS) · `git status web db` สะอาด
หลัก: **โค้ดบอก ≠ ระบบทำ ≠ ร้านต้องการ** · บันทึกส่งมอบ / README / SPEC / RUNBOOK = คำอ้าง **[A]** จนกว่าจะรันเอง
ป้าย: ✅ ตรงกับผลที่รัน · ❌ ไม่ตรง · ⚠️ ตรงบางส่วน / ตรวจไม่ได้ในรอบนี้ (บอกวิธีตรวจ)

## 1. สภาพระบบที่รับมอบ

| รายการ | ผลจริง | คำสั่ง |
|---|---|---|
| container | `football-web` Up (healthy) `0.0.0.0:3000->3000` · `football-db` Up (healthy) `127.0.0.1:5433->5432` · (หยุดอยู่) `football-web-v1` `football-db-v1` `football-mock-llm` | `docker ps -a --format "{{.Names}} {{.Status}} {{.Ports}}"` |
| volume | `football-pgdata` (v2) · `football-db-data` (v1 เก็บไว้ T-24) | `docker volume ls` |
| เวอร์ชัน | Next.js **16.4.0** (`web/package.json`) · PostgreSQL **16.15** (`SELECT version()`) · Node ใน container **v24.22.0** · Node เครื่อง v24.20.0 | `docker exec football-web node -e "console.log(process.version)"` |
| health / version | `{"ok":true,"db":true}` · `{"schemaVersion":"006","chatMode":"mock","bugMode":0}` | `curl localhost:3000/api/health` · `/api/version` |
| ค่าตั้งใน container (ไม่พิมพ์ค่าลับ) | `ALLOW_TEST_RESET=1 MODE=mock BUG_MODE=0` · `SESSION_SECRET` ตั้งแล้ว ยาว 43 ตัว · log ไม่มีบรรทัด `[secret]` / `refusing to start` | `docker exec football-web sh -c 'echo …; echo ${#SESSION_SECRET}'` · `docker logs football-web \| grep -c "\[secret\]"` → 0 |
| ของที่รันอยู่ = source ใน repo ไหม | source 163 ไฟล์ (`app/ lib/ components/` *.ts/*.tsx) ใน `/app` ของ container **sha256 ตรงกับ `web/` ทุกไฟล์** (ตัด CR ก่อน hash) · BUILD_ID `TK4zvCp98igi-iwAU3Uzu` | `docker exec football-web sh -c 'find app lib components … \| sha256sum'` เทียบกับ `web/` → `diff` ว่าง |
| ผู้ใช้ฐานข้อมูลของเว็บ | เว็บต่อด้วย role `football` ซึ่งเป็น **superuser** (`rolsuper = t`) และเป็นเจ้าของตารางทุกตัว | `SELECT usename, client_addr FROM pg_stat_activity` (เว็บ 172.19.0.2) · `SELECT rolsuper FROM pg_roles WHERE rolname=current_user` |
| schema_migrations | 001–004 (2026-10-18) · **005 = 2026-10-20 17:49** · **006 = 2026-10-20 16:56** (005 ถูกถอยแล้วขึ้นใหม่หลัง 006 · เกิดจาก selfcheck E148 ที่ทีมรันเอง ดู H4) | `SELECT * FROM schema_migrations ORDER BY 1` |

## 2. ผลชุดตรวจที่ส่งมอบ (รันจริงวันนี้)

| ชุดตรวจ | คำอ้าง | ผลจริง | เวลา | คำสั่ง |
|---|---|---|---|---|
| unit (`node --test`) | 88/88 | **88 pass · 0 fail** | 2.5 วิ | `cd web && npm test` |
| ชุดตรวจกฎร้าน v1 | 191/191 | **191 pass · 0 fail** · `RESULT: OK — all checks pass` | 33 วิ | `node web/selfcheck/rules-check.mjs` |
| ตาม TEST-DATA | 151/151 | **ผ่าน 151 / 151 (แถว E: 145 / 145)** | 42 วิ | `node web/selfcheck/check-testdata.mjs` |
| e2e (ไม่รันซ้ำ · อ่านผลที่ส่งมอบ) | 117/128 ทุกเบราว์เซอร์ | ดู H10 | – | `e2e/test-report/run-1|run-2/results.json` · `e2e/index.html` |

> ⚠️ selfcheck **ไม่ใช่อ่านอย่างเดียว**: ทั้งสองชุด reset ข้อมูลทุกกลุ่ม และ `check-testdata.mjs` แถว E148 รัน `scripts/migrate.mjs` ×2 แล้ว **ถอย 005 กลับขึ้นใหม่บนฐานจริง** (`PASS E148 migrate ×2 then roll back 005 and up again: no error, still 8 bookings`) · ระหว่างนั้น EXCLUDE หายไปชั่วคราว → ห้ามรันบนฐานที่มีข้อมูลลูกค้า

e2e ที่ส่งมอบ (สรุปจาก `results.json` ด้วย node · ไม่ได้รันใหม่):

| รอบ | chromium | firefox | webkit | serial (Chrome เท่านั้น) | perf × 3 |
|---|---|---|---|---|---|
| run-1 (08:53Z) | 71 ผ่าน · 6 ล้ม · 1 ข้าม | **70** ผ่าน · 7 ล้ม (+TC-MEMBER-06) · 1 ข้าม | 71 · 6 · 1 | 45 ผ่าน · 4 ล้ม | 1 ผ่าน/ตัว |
| run-2 (09:02Z) = รอบที่หน้า index ใช้ | 71 · 6 · 1 | 71 · 6 · 1 | 71 · 6 · 1 | 45 · 4 | 1 |

`e2e/index.html` summary ทุกเบราว์เซอร์: `"pass":117,"total":128,"need":122,"p1pass":72,"p1total":74,"meets":false` · ข้อที่ไม่ผ่าน 11: TC-BOOK-11 · TC-SERIES-04 (ข้าม: ทดสอบผ่านหน้าเว็บไม่ได้) · TC-STAFF-06 · TC-CHAT-14/15/16 · TC-REPORT-01/04 · TC-TRACK-01 · TC-DATA-01 · TC-ROLE-03 · `triage.json` มี 14 ข้อ (เว็บผิด 10 · flaky 1 · ผ่านเมื่อรันแบบ admin 1 · …)

## 3. คำอ้าง vs ผลจริง

### 3.1 บันทึกส่งมอบ `CHANGE-REQUESTS/00-HANDOVER-MEMO.md` (H1–H20)

| # | คำอ้าง [A] (บรรทัด) | ผลจริง / หลักฐาน | ผล |
|---|---|---|---|
| H1 | เว็บ Next.js 16 + TypeScript · หน้าลูกค้า หลังบ้าน API แชทบอท (`:11`) | `next 16.4.0` · 32 หน้า `page.tsx` · 55 ไฟล์ `route.ts` (80 handler · 60 ใช้งานจริง + 20 ตัวที่ตอบ 404 ตั้งใจ) (ดู SYSTEM-MAP) | ✅ |
| H2 | PostgreSQL 16 (`:12`) | `PostgreSQL 16.15 on x86_64-pc-linux-musl` | ✅ |
| H3 | `migrations/001–006` มีไฟล์ถอยกลับ `.down.sql` ทุกตัว (`:12`) | มี 6 คู่ `NNN_*.sql` + `NNN_*.down.sql` · `planMigrations` บังคับให้มีคู่ (`web/lib/rules/records.ts:63-87`) · **แต่** `001.down` ลบแค่แถว `schema_migrations` (ไม่ลบตาราง · ตั้งใจ) และคอมเมนต์ใน `001_v1_baseline.down.sql:2` บอกลำดับ "005 → 002" ลืม 006 | ✅ (ไฟล์ครบ) |
| H4 | ถอยกลับได้ (นัยของ H3 + RUNBOOK §5) | ผมไม่ได้ซ้อมถอยทั้งชุดในรอบนี้ (ซ้อมจริงอยู่แผน L7) · หลักฐานที่มี: E148 ถอย 005 แล้วขึ้นใหม่ผ่าน · **`migrate.mjs --down N` ไม่บังคับลำดับ** (`scripts/migrate.mjs:31-35` เลือกไฟล์ตามเลขเดียว) → ถอย 005 ทั้งที่ 006 ยังอยู่ได้ (เกิดจริงตาม `applied_at` ข้างบน) · `/api/version` ยังตอบ `006` เพราะใช้ `max(version)` (`web/app/api/version/route.ts:12`) | ⚠️ ซ้อมใน L7 บนฐาน prod-like |
| H5 | สคริปต์ `migrate.mjs · backup.mjs · restore.mjs` (`:13`) | มีครบ · `migrate` รันจริงใน E148 ผ่าน · `db/backups/` มี 7 ชุด + `.counts.json` (ตรงกับ `--keep 7`) · backup/restore ไม่ได้รันในรอบนี้ (เขียนไฟล์ข้อมูลส่วนบุคคล) | ⚠️ (backup/restore ซ้อมใน L7) |
| H6 | `web/mock-llm/` LLM จำลองสำหรับ `MODE=ai` (`:14`) | unit `R10 token required … → 401 · right → 200` และ `R10 no MOCK_LLM_TOKEN configured → nothing is answered` ผ่าน · container `football-mock-llm` หยุดอยู่ (ไม่ได้เปิดเพราะต้องคง `MODE=mock`) | ✅ (ระดับ unit) |
| H7 | `web/SPEC.md` · `docs/RUNBOOK.md` "ฉบับปัจจุบัน ตรงกับระบบ" (`:15`) | ไม่ตรงอย่างน้อย 6 จุด: SPEC §0 "01-schema.sql (= migration 001–005)" แต่ `db/init/01-schema.sql:5-10` เรียก 001–**006** · RUNBOOK §8 "CHECK 46 ตัว" แต่ฐานมี **44** · RUNBOOK §5 ลำดับถอย "005 → … → 001" ไม่มี 006 · SPEC §6 "เช็กอินทำได้กับ CONFIRMED ทุกเวลา" ขัดคำตอบร้าน A-45 · SPEC §12 ช่วงรายงาน "วันสิ้นสุด < วันเริ่ม + 3 เดือน" ขัด A-46 · README ยังเป็นตัวเลข v1 (ข้อ R1–R3) | ❌ |
| H8 | ชุดตรวจกฎร้าน 191 เคส ผ่าน 191/191 (`:16`, `:26`) | `checks: 191 · pass: 191 · fail: 0` | ✅ |
| H9 | TEST-DATA 151 เคส ผ่าน 151/151 (`:16`, `:26`) | `ผ่าน 151 / 151 (แถว E: 145 / 145)` | ✅ |
| H10 | unit 88/88 (`:26`) | `ℹ tests 88 · pass 88 · fail 0` | ✅ |
| H11 | e2e 128 test case · 3 เบราว์เซอร์ · **117/128 ทุกเบราว์เซอร์** · ข้อไม่ผ่านอยู่ใน `triage.json` (`:17`, `:27`) | ตัวเลข 117/128 ตรงกับ run-2 · **แต่**: (1) run-1 Firefox ได้ 116 (TC-MEMBER-06 flaky) (2) 49 เคส serial รันบน Chrome อย่างเดียวแล้วนับเข้าทุกเบราว์เซอร์ (3) **ไม่ผ่านเกณฑ์ของชุดเอง** `need 122 · P1 72/74 · meets:false` — บันทึกส่งมอบไม่ได้บอก (4) P1 ที่ล้ม = TC-ROLE-03 (logout ไม่ตัด session) + TC-STAFF-06 | ⚠️ |
| H12 | ระบบกันการจองซ้อนที่ระดับฐานข้อมูล (`:28`) | `bookings_no_overlap EXCLUDE USING gist (field_id =, date =, int4range && ) WHERE status IN (PENDING_PAYMENT, CONFIRMED, CHECKED_IN, NO_SHOW)` · probe P1: INSERT A 9 ต.ค. 20–21 ทับ LN-900001 → `ERROR: conflicting key value violates exclusion constraint "bookings_no_overlap"` · ส่ง `POST /api/bookings` ช่องเดียวกันพร้อมกัน 2 คำขอ → **201 + 409 `SLOT_TAKEN`** (NFR-07) | ✅ |
| H13 | ยอดเงินเป็นจำนวนเต็มบาท (`:28`) | ทุกคอลัมน์เงินเป็น `int` + CHECK ≥ 0 (probe P9 `credit_balance = -1` → `customers_credit_balance_check`) · ⚠️ probe P11: `INSERT payments amount 10.5` → **ปัดเป็น 11 เงียบ ๆ** (ฐานไม่ปฏิเสธเศษ แค่ปัด) | ✅ (มีหมายเหตุ) |
| H14 | ประวัติสถานะและบันทึกการทำงาน **แก้ย้อนหลังไม่ได้** (`:28`) | trigger กัน UPDATE / DELETE ได้จริง (P4 `booking_status_history is append-only: UPDATE is not allowed` · P5 DELETE · P6 `audit_logs` DELETE) · เปลี่ยนสถานะโดยไม่ตั้งผู้ทำถูกปฏิเสธ (P3 `app.actor is not set`) · **แต่** P7 `TRUNCATE audit_logs, booking_status_history` สำเร็จ (row trigger ไม่ทำงานกับ TRUNCATE · reset ใช้ทางนี้ `web/lib/server/testing.ts:49-50`) และ P8 role ของเว็บเป็น superuser → `ALTER TABLE … DISABLE TRIGGER` แล้ว UPDATE ได้ (`actor='tampered'`) | ⚠️ กันได้เฉพาะทางปกติของแอป |
| H15 | เปิดระบบด้วย 2 คำสั่ง compose · เว็บ :3000 · ฐาน localhost:5433 (`:20-25`) | ระบบเปิดอยู่แล้ว healthy (ไม่ได้ปิดเปิดใหม่) · พอร์ตตรง · ฐานผูก 127.0.0.1 เท่านั้น | ✅ |
| H16 | ต้องตั้ง `SESSION_SECRET` ใน `web/.env` ก่อนเปิด (`:26`) | ตั้งแล้ว (ยาว 43) · ไม่ตั้ง → `instrumentation.ts:9-12` `process.exit(1)` (อ่านโค้ด) · unit `R1 missing / short / the old public value → refuse to start` ผ่าน | ✅ |
| H17 | reset ได้ที่ `POST /api/test/reset` · ใช้งานจริงให้ปิด `ALLOW_TEST_RESET=0` (`:27`) | reset ทำงาน (`{"ok":true,"now":"2026-10-09T03:00:00.000Z","locked":true,"bugMode":0}`) · ค่าเริ่มต้นใน `web/compose.yaml:18` = `0` · `testing.ts:23` → 404 เมื่อไม่ใช่ `1` · **ไม่ได้ทดลองปิดจริง** (ต้อง restart เว็บ) · method อื่นตอบ 404 แล้ว (`GET /api/test/reset` → 404) | ⚠️ (runtime ตอนปิด ตรวจในแผน L4 seam) |
| H18 | แชทบอทจองได้เฉพาะการจองพื้นฐาน · ของเช่า เครดิต ชั่วโมงฟรี จองประจำ → ให้จองหน้าเว็บ (`:32`) | `web/lib/chat/mock.ts:231-235` · check-testdata แชท E109–E120 ผ่าน | ✅ |
| H19 | ขีดจำกัดแชทต่อ IP เชื่อ `X-Forwarded-For` ตัวแรก (`:33`) | `web/lib/server/chat.ts:140-142` ใช้ค่าแรกของ header ตรง ๆ · check-testdata ตั้ง `x-forwarded-for` เองต่อ client แล้วผ่าน (= ปลอมได้) | ✅ (ข้อจำกัดจริง) |
| H20 | `BUG_MODE=1` ใช้ฝึกเท่านั้น (`:34`) | ตอนนี้ `bugMode 0` · โค้ดมีทางแยก bug (`reports.ts:57` `summarizeMoney(…, bug)` · `schedule.ts:44` · `stock.ts:35`) | ✅ |

### 3.2 README.md ที่ราก (R1–R8)

| # | คำอ้าง [A] | ผลจริง | ผล |
|---|---|---|---|
| R1 | `README.md:13` ผลรัน **153/153 ผ่าน (100%) · ผ่านเกณฑ์** | ชุดปัจจุบัน 128 TC · 117/128 · `meets:false` (ตัวเลข 153 เป็นของ v1) | ❌ |
| R2 | `README.md:12` Test case 60 ข้อ | e2e มี 128 TC (`e2e/index.html`) | ❌ (ล้าสมัย) |
| R3 | `README.md:10` US 34 · FR 31 · BR 28 · NFR 14 | `docs/04-REQUIREMENTS.md` นับได้ US 52 · FR 48 · BR 45 · NFR 24 (`grep -o "^\| FR-[0-9]+ "` ไม่ซ้ำ) | ❌ (ล้าสมัย) |
| R4 | `README.md:14` บั๊กที่ฝัง จับได้ 3/3 | ตรวจไม่ได้ในรอบนี้ (ต้องเปิด `BUG_MODE=1` ซึ่งห้ามในงานนี้ · `web/BUGS.md` ห้ามเปิด) · git log `faa3f2e` อ้างว่าจับได้ 3/3 | ⚠️ |
| R5 | `README.md:44` Portal `http://localhost:3000/project` | `GET /project` → 200 | ✅ |
| R6 | `README.md:58` `npm test` ใน e2e ใช้เวลา ~4 นาที | ไม่ได้รัน (หัวหน้าทีมบอก ~15 นาที) | ⚠️ |
| R7 | `README.md:34` Docker 2 โปรเจกต์ คุยผ่าน network `football-net` | `db/compose.yaml:32-34` สร้าง · `web/compose.yaml` `external: true` | ✅ |
| R8 | `README.md:81` "เฟส 9 Change Request ยังไม่ได้ทำ" | ตรง (CR-01..05 เพิ่งรับเรื่อง) | ✅ |

### 3.3 web/SPEC.md (S1–S12)

| # | คำอ้าง [A] | ผลจริง | ผล |
|---|---|---|---|
| S1 | §0 `/api/health` = `{"ok":true,"db":true}` ไม่เพิ่มช่อง | ตรงทุกตัวอักษร | ✅ |
| S2 | §0 `/api/version` = `{"schemaVersion":"006","chatMode":"mock","bugMode":0}` | ตรง | ✅ |
| S3 | §0 reset `{}` → seed + ล็อก ศ 9 ต.ค. 2026 10:00 | `now 2026-10-09T03:00:00.000Z locked true` · ตัวเลข seed ตรง (`counts.sql`: bookings 8 · payments 9 · ฿11,400 · history 21) | ✅ |
| S4 | §0 การจองหลัง reset ได้รหัส `LN-100001` ต่อกัน | probe จองแข่ง + HAR ได้ `LN-100001` | ✅ |
| S5 | §0 "`db/init/01-schema.sql` (= migration 001–005)" | ไฟล์เรียก 001–**006** (`01-schema.sql:5-10`) | ❌ |
| S6 | §0 test route ตอบ 404 ทุก method อื่น | `GET /api/test/reset` → 404 | ✅ |
| S7 | §12 ไม่มีเส้นทางแก้/ลบประวัติ / audit / แชท → 404 | `POST /api/owner/audit` → 404 · `DELETE /api/owner/bookings/LN-900001/history` → 404 | ✅ |
| S8 | §12 Origin ต่างจากเว็บ → 403 `FORBIDDEN_ORIGIN` | `POST /api/customers/logout -H "Origin: http://evil.example"` → 403 `FORBIDDEN_ORIGIN` | ✅ |
| S9 | §6 "เช็กอินทำได้กับ CONFIRMED ทุกเวลา" | ระบบทำแบบนั้นจริง: เช็กอิน LN-900004 (เตะ 11 ต.ค.) ตอน 9 ต.ค. → 200 `CHECKED_IN` · **ขัดคำตอบร้าน A-45** (= CR-02 ข้อ 1) | ✅ ตรงโค้ด / ส่ง SPEC-GAPS |
| S10 | §12/§14 รายงาน "วันสิ้นสุด < วันเริ่ม + 3 เดือน" | 30 พ.ย.–28 ก.พ. → 400 `REPORT_RANGE_TOO_LONG` · 30 พ.ย.–27 ก.พ. → 200 · **ขัด A-46** (= CR-02 ข้อ 4) | ✅ ตรงโค้ด / ส่ง SPEC-GAPS |
| S11 | §5 `POST /api/customers/logout` → `{ ok: true }` | ตอบ 200 `{ok:true}` แต่ **cookie เดิมยังใช้ได้**: `/api/me` ด้วย cookie เดิมหลัง logout → 200 (เครดิต 1200) · พนักงาน `GET /api/staff/bookings/LN-900004` ด้วย cookie เดิมหลัง logout → 200 (= CR-01) | ✅ ตรงสัญญา / ❗ ปัญหาความปลอดภัย |
| S12 | §13 `MODE=mock` ไม่ออก network | `chat.ts:43` `if (process.env.MODE !== "ai") return mockBrain(messages)` | ✅ |

### 3.4 docs/RUNBOOK.md (RB1–RB8)

| # | คำอ้าง [A] | ผลจริง | ผล |
|---|---|---|---|
| RB1 | §3 นับ 23 ตาราง + ยอดเงิน | `db/scripts/counts.sql` 23 ตาราง · ฐานมี 25 ตาราง (+ `app_settings`, `schema_migrations`) | ✅ |
| RB2 | §8 "trigger 6 ตัว + EXCLUDE + CHECK 46 ตัว" | trigger 6 ✅ · EXCLUDE 1 ✅ · **CHECK 44** (`SELECT contype, count(*) FROM pg_constraint … → c 44 · f 31 · p 25 · u 4 · x 1`) · นับจากไฟล์ migration ได้ 44 เท่ากัน (002: 2 · 003: 16 · 004: 2 · 005: 24) | ❌ (ตัวเลขในเอกสาร) |
| RB3 | §5 migrate รันซ้ำได้ · จำนวนการจองเท่าเดิม | E148 `migrate ×2 … still 8 bookings` PASS | ✅ |
| RB4 | §5 ถอยทีละขั้น "005 → 004 → … → 001" | ล้าสมัย (มี 006) และสคริปต์ไม่บังคับลำดับ (H4) | ⚠️ |
| RB5 | §5 เปลี่ยนสถานะต้องตั้ง `app.actor` ไม่งั้น trigger ปฏิเสธ | P3 `ERROR: app.actor is not set: every booking change needs SET LOCAL app.actor (BR-42)` | ✅ |
| RB6 | §3 เก็บไฟล์สำรอง 7 ชุดล่าสุด | `db/backups/` มี 7 `.dump` + 7 `.counts.json` | ✅ |
| RB7 | §6 volume v1 `football-db-data` และ container `-v1` ยังอยู่ | มีทั้งคู่ (หยุดอยู่) | ✅ |
| RB8 | §2 health / version ตามตัวอย่าง | ตรง (S1, S2) | ✅ |

## 4. สรุปนับ

| แหล่ง | ✅ | ❌ | ⚠️ | รวม |
|---|---:|---:|---:|---:|
| บันทึกส่งมอบ H1–H20 | 14 | 1 | 5 | 20 |
| README R1–R8 | 3 | 3 | 2 | 8 |
| SPEC S1–S12 | 11 | 1 | 0 | 12 |
| RUNBOOK RB1–RB8 | 6 | 1 | 1 | 8 |
| **รวม** | **34** | **6** | **8** | **48** |

❌ ทั้ง 6 ข้อเป็น "เอกสารไม่ตรงระบบ" ไม่ใช่ระบบเสีย: H7 (SPEC/RUNBOOK อ้างว่าตรงทุกข้อ) · R1–R3 (README ยังเป็นตัวเลข v1) · S5 (001–005 vs 001–006) · RB2 (CHECK 46 vs 44)
เรื่องที่ระบบทำแต่ร้านไม่ต้องการ (S9 S10 S11 + e2e ที่ triage ว่า "เว็บผิด") ไม่นับเป็น ❌ ของคำอ้าง แต่ส่งต่อเป็น CR / คำถามใน `SPEC-GAPS.md`

## 5. probe ที่รันเอง (ไฟล์ SQL / สคริปต์อยู่ใน scratch ไม่อยู่ใน repo · ผลย่อ)

ฐานข้อมูล (ทุกข้อห่อ `BEGIN … ROLLBACK` · หลังจบ `booking_status_history` = 21 เท่าเดิม):

```text
[P1] INSERT A 2026-10-09 20-21 (ทับ LN-900001)   → ERROR exclusion constraint "bookings_no_overlap"
[P2] ช่องเดียวกันแต่ CANCELLED                    → INSERT 0 1 (สถานะไม่กันสนาม = ได้ ตามสัญญา)
[P3] UPDATE bookings status ไม่ตั้ง app.actor      → ERROR app.actor is not set … (BR-42)
[P4] UPDATE booking_status_history                → ERROR … append-only: UPDATE is not allowed
[P5] DELETE booking_status_history                → ERROR … append-only: DELETE is not allowed
[P6] DELETE audit_logs                            → ERROR audit_logs is append-only: DELETE is not allowed
[P7] TRUNCATE audit_logs, booking_status_history  → TRUNCATE TABLE (สำเร็จ · history = 0)
[P8] ALTER TABLE … DISABLE TRIGGER + UPDATE       → UPDATE 1 (actor = tampered)
[P9] customers.credit_balance = -1                → ERROR customers_credit_balance_check
[P10] payments.method = 'CARD'                    → ERROR payments_method_check
[P11] payments.amount = 10.5                      → INSERT ได้ amount = 11
```

HTTP (`node probe-api.mjs` หลัง reset · รหัสผ่านบัญชีทดสอบส่งทาง env ไม่พิมพ์):

```text
[race]   2 POST /api/bookings B 2026-10-14 19:00 พร้อมกัน → 201 + 409 (LN-100001 · SLOT_TAKEN)
[cr01]   ลูกค้า login → me 200 → logout 200 → me ด้วย cookie เดิม → 200
[cr01]   staff login (Max-Age=43200) → logout → GET /api/staff/bookings/LN-900004 ด้วย cookie เดิม → 200
[cr02-5] GET /api/bookings/?phone= → 308 (หน้า /my กดค้นโดยไม่กรอก → เรียก URL นี้ · MyClient.tsx:77)
[cr02-4] reports 2026-11-30..2027-02-28 → 400 REPORT_RANGE_TOO_LONG · ..2027-02-27 → 200
[cr02-1] checkin LN-900004 (เตะ 11 ต.ค. · ตอนนี้ 9 ต.ค.) → 200 CHECKED_IN
[cr02-2] ประวัติแถวล่าสุด {"actor":"staff","actorLabel":"staff"} (username ไม่ใช่ชื่อ "น้องบอล")
[cr05]   quote A จ. 2 พ.ย. 19:00 → 400 TOO_FAR_AHEAD (จองล่วงหน้าได้ 14 วัน: ต้องเลื่อนนาฬิกาถึงจะทดสอบราคาหลัง 1 พ.ย.)
```

## 6. ส่งต่อ

- ข้อแตกต่างระหว่างเอกสารกับโค้ด → คำถามถึงร้านใน `legacy/SPEC-GAPS.md` (ห้ามตัดสินเองว่าฝั่งไหนถูก)
- H4 / H5 ถอยกลับ + backup/restore → ซ้อมจริงบนฐาน prod-like (`legacy/PROD-LIKE-DATA.md`) ในแผน L7
- H14 append-only: ถ้าร้านต้องการ "แก้ย้อนหลังไม่ได้" จริง ต้องแยก role ฐานข้อมูลของเว็บ (ไม่ใช่ superuser) → คำถาม G-36 ใน SPEC-GAPS
- ระบบถูก reset กลับ seed ปกติแล้ว: `/api/version` = `{"schemaVersion":"006","chatMode":"mock","bugMode":0}`
