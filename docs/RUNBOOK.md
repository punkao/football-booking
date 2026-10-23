# RUNBOOK · ดูแลฐานข้อมูล ลูกหนัง อารีน่า (v2)

FR-46 · FR-48 · NFR-20 · BR-43 · ADR-10/11/13 · T-22 · T-24
ทุกคำสั่งรันจากโฟลเดอร์ `football-booking/` ใช้ได้ทั้ง PowerShell และ Git Bash (สคริปต์เป็น Node ไม่มีไฟล์ `.sh`)

> **ห้ามใช้ `docker compose ... down -v` ในทุกขั้นตอน** — `-v` ลบ volume `football-pgdata` = การจองทั้งหมดหาย
> `down` เฉย ๆ (ไม่มี `-v`) ปลอดภัย · volume เดิมของ v1 `football-db-data` ห้ามลบ (T-24)

## 1. ส่วนประกอบ

| อะไร | อยู่ที่ไหน | หมายเหตุ |
|---|---|---|
| ฐานข้อมูล | container `football-db` (โปรเจกต์ `db/compose.yaml`) · volume `football-pgdata` · พอร์ตเครื่อง `127.0.0.1:5433` | เปิดก่อนเสมอ (สร้าง network `football-net`) |
| เว็บ | container `football-web` (โปรเจกต์ `web/compose.yaml`) · พอร์ต 3000 | ไม่มี volume · build ใหม่ไม่แตะข้อมูล |
| ค่าลับ | `db/.env` · `web/.env` (ไม่ขึ้น git · ตัวอย่าง `*.env.example`) | รหัสผ่านใน `web/.env` (`DATABASE_URL`) ต้องตรงกับ `db/.env` |
| schema | `db/migrations/NNN_*.sql` + `NNN_*.down.sql` | `db/init/01-schema.sql` เรียก migration ทุกไฟล์ตามลำดับ (แหล่งเดียว) |
| ข้อมูลเริ่มต้น | `db/init/02-seed.sql` = `docs/TEST-DATA.md` | ใช้ตอนสร้าง volume ครั้งแรก และ `/api/test/reset` (เมื่อ `ALLOW_TEST_RESET=1`) |
| ไฟล์สำรอง | `db/backups/football-YYYYMMDD-HHMMSS.dump` + `.counts.json` | มีข้อมูลส่วนบุคคล · ไม่ขึ้น git · ไม่แนบในรายงาน |

## 2. เปิด / ปิด

### 2.0 ตั้งค่าลับก่อนเปิดครั้งแรก (R1 · NFR-18)

`web/.env` ต้องมี `SESSION_SECRET` ยาว **อย่างน้อย 32 ตัวอักษรแบบสุ่ม** (ใช้ลงลายเซ็น cookie เข้าสู่ระบบ การ์ดยืนยันจองในแชท และรหัสอ้างอิงห้องแชทในหลังบ้าน)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # คัดลอกผลไปใส่ SESSION_SECRET= ใน web/.env
docker compose -f web/compose.yaml up -d                                          # เริ่ม web ใหม่ให้อ่านค่า
```

- ไม่ตั้ง / สั้นกว่า 32 / เป็นค่าตัวอย่างที่เคยอยู่ในโค้ด → **web ไม่ยอมเริ่ม** container ไม่ healthy · `docker logs football-web` มีบรรทัด `[startup] refusing to start: …` บอกวิธีตั้ง
- ยกเว้นเครื่องทดสอบที่ตั้ง `ALLOW_TEST_RESET=1` แล้วเว้นว่าง: ใช้ค่าสุ่มชั่วคราวต่อการรัน (log เตือน `[secret] …`) ผู้ใช้ทุกคนหลุดจากระบบเมื่อ web เริ่มใหม่
- เปลี่ยน secret = ทุกคนต้องเข้าสู่ระบบใหม่ · การ์ดยืนยันในแชทที่ค้างอยู่ใช้ไม่ได้ · รหัสอ้างอิงห้องแชทในหลังบ้านเปลี่ยน (ข้อมูลไม่หาย)
- ห้าม commit `web/.env` · ถ้า secret หลุด ให้สุ่มใหม่แล้วเริ่ม web ใหม่ทันที
- `MOCK_LLM_TOKEN` (เฉพาะทดสอบ `mock-llm`): สุ่มแบบเดียวกัน แล้วใช้ค่าเดียวกันเป็น `LLM_API_KEY` เมื่อเปิด `MODE=ai`

```bash
docker compose -f db/compose.yaml up -d                # 1) ฐานข้อมูล รอ healthy
docker compose -f web/compose.yaml up -d --build       # 2) เว็บ
docker ps --format "{{.Names}} {{.Status}}"            # football-db / football-web ต้อง (healthy)
curl http://localhost:3000/api/health                  # {"ok":true,"db":true}  (สัญญาเดิมของ v1 ห้ามเพิ่มช่อง)
curl http://localhost:3000/api/version                 # {"schemaVersion":"006","chatMode":"mock","bugMode":0}

docker compose -f web/compose.yaml stop                # ปิดเว็บ
docker compose -f db/compose.yaml stop                 # ปิดฐานข้อมูล (ข้อมูลอยู่ใน volume)
```

**ทางลัด (เครื่องใหม่ มีแค่ Docker Desktop):** `docker compose up -d --build` หรือ `.\start.ps1` / `./start.sh` ที่ราก — ดูข้อ 10

BUG_MODE / MODE / ALLOW_TEST_RESET อ่านจาก `web/.env` และ shell (shell ชนะ):
Git Bash `BUG_MODE=1 docker compose -f web/compose.yaml up -d` · PowerShell `$env:BUG_MODE="1"; docker compose -f web/compose.yaml up -d` · กลับ `BUG_MODE=0 …` / `Remove-Item Env:BUG_MODE; …`

MCP server ของร้าน (`football` · ห่อ API ของเว็บ · `book` ใช้ได้เฉพาะ localhost + `confirm:true`): ทดสอบ `node tools/mcp-football/test-client.mjs` (เว็บต้องเปิดที่ `FOOTBALL_BASE_URL` ค่าเริ่ม http://localhost:3000 · seam เปิด · มี `POST /api/test/reset {}` ในตัว) · ลงทะเบียนใน `.mcp.json` ชื่อ `football` · รายละเอียด `docs/mcp/MCP-REPORT.md`

## 3. สำรอง (backup)

```bash
node scripts/backup.mjs
```

- รัน `pg_dump -Fc` **ใน** container เขียนลง `/backups` (= `db/backups/`) · ไม่ใช้ `>` ของ PowerShell 5.1 (เขียน UTF-16 ทำไฟล์เสีย)
- เก็บจำนวนแถว 23 ตาราง + ยอดเงินไว้ใน `<ไฟล์>.counts.json` สำหรับเทียบตอนกู้คืน
- เก็บ 7 ชุดล่าสุด ชุดเก่ากว่านั้นถูกลบอัตโนมัติ (`--keep 7` · T-22)
- **เมื่อไร:** ทุกวัน (ตั้ง Windows Task Scheduler ให้รัน `node scripts/backup.mjs` วันละครั้ง) · ก่อน migrate ทุกครั้ง · ก่อนส่งงาน
- **นอกเครื่อง:** การคัดลอก `db/backups/` ไปเก็บที่อื่น (ฮาร์ดดิสก์แยก / คลาวด์ของร้าน) เป็นหน้าที่ของร้าน (T-22)

## 4. กู้คืน (restore)

```bash
node scripts/restore.mjs latest                       # ไฟล์ล่าสุด
node scripts/restore.mjs football-20261018-195146.dump # ระบุไฟล์
node scripts/restore.mjs latest --recreate             # ฐานเสียทั้งก้อน: ลบฐานแล้วสร้างใหม่ก่อนกู้
```

ขั้นตอนในสคริปต์: หยุด `football-web` → (`--recreate`: `DROP DATABASE` + `CREATE DATABASE`) → `pg_restore --clean --if-exists --single-transaction` → เทียบจำนวนแถวกับ `.counts.json` → เปิด `football-web`
กู้ไม่สำเร็จ = ไม่มีอะไรเปลี่ยน (single transaction) · จำนวนไม่ตรง → สคริปต์จบด้วย exit 1 และพิมพ์ตารางที่ไม่ตรง

นับแถวเองได้ทุกเมื่อ:

```bash
docker exec football-db psql -U football -d football -At -F "|" -f /scripts/counts.sql
```

## 5. Migration (FR-48 · BR-43)

```bash
node scripts/backup.mjs                  # 1) สำรองก่อนเสมอ (.down.sql ลบข้อมูลในตารางใหม่ของ migration นั้น)
node scripts/migrate.mjs                 # 2) รันทุกไฟล์ตามลำดับ (รันซ้ำได้: IF NOT EXISTS / ON CONFLICT DO NOTHING / ตรวจ pg_constraint)
node scripts/migrate.mjs --status        # ดู schema_migrations
node scripts/migrate.mjs --down 005      # ถอยทีละขั้น จากเลขมากไปน้อย (005 → 004 → … → 001)
```

| ไฟล์ | ทำอะไร | ถอยกลับ |
|---|---|---|
| 001_v1_baseline | 13 ตาราง v1 + `app_settings` + `schema_migrations` (ฐาน v1 รันผ่านโดยไม่เปลี่ยนอะไร) | ไม่ลบตาราง (ลบแค่แถวใน `schema_migrations`) |
| 002_history_audit | `booking_status_history` + `audit_logs` + trigger ลงประวัติ + trigger ห้ามแก้/ลบ · เติมประวัติแถวแรกให้การจองเดิม (actor SYSTEM) | ลบ trigger + 2 ตาราง |
| 003_stock | 6 ตารางคลัง · รายการของ 8 ชิ้น 2 ที่เก็บ · ย้าย `rental_items.stock` ของ v1 ไปเป็นจำนวนที่ COUNTER | ลบตารางคลัง (`rental_items` ยังอยู่ → v1 ใช้ต่อได้) |
| 004_chat | `chat_sessions` + `chat_messages` (ห้ามแก้/ลบ ยกเว้นงานลบเบอร์ BR-45) | ลบ 2 ตาราง |
| 005_constraints | `btree_gist` + `EXCLUDE` กันจองทับ + `CHECK` ทุกตัว · ตรวจข้อมูลเดิมก่อน เจอแถวผิด → หยุดพร้อมรายการ ไม่แก้ข้อมูลเอง | `DROP CONSTRAINT IF EXISTS` |
| 006_chat_hardening | `chat_messages.redacted_at` (ลบชื่อ/เบอร์หลัง 90 วันครั้งเดียวต่อข้อความ) · `chat_sessions.ip_hash` (HMAC ของ IP สำหรับจำกัดจำนวนต่อ IP) | ลบ 2 คอลัมน์ (ข้อความและการจองไม่ถูกแตะ) |
| 007_session_revocation | CR-01: ตาราง `revoked_sessions` (SHA-256 ของ cookie เข้าสู่ระบบที่กดออก + เวลาหมดอายุ · เว็บลบแถวที่หมดอายุเองตอน logout) · `applied_at` ของ 007 = เวลาเริ่มนับ cookie แบบก่อน CR-01 (ใช้ได้อีก 30 วัน / 12 ชม.) · **deploy: migration ก่อน rebuild เว็บ** | ลบตาราง (รายการ logout หาย) · **ถอยเว็บกลับ image เดิม (`football-web:before-cr01`) ก่อน แล้วค่อย `--down 007`** · ขึ้น 007 ใหม่ = เริ่มนับ 30 วันของ cookie แบบเดิมใหม่ |
| 008_field_rates | CR-05: ตาราง `field_rates` (ราคาสนามพร้อมวันมีผล = วันเตะ) + แถว A, B `2026-11-01` เย็น ฿1,300 · `fields.day_rate/evening_rate` = ราคาฐาน **ไม่แก้** · ยอดที่เก็บในการจองไม่ถูกแตะ · **deploy: migration ก่อน rebuild เว็บ** | ลบตาราง (ราคากลับเป็นราคาฐาน ฿1,200) · ถอยเว็บกลับ image ก่อน CR-05 ก่อน แล้วค่อย `--down 008` |
| 009_challenge_payments | CR-06: คอลัมน์ `payments.challenge_id` + unique index (คำท้า 1 ก้อน = เงิน 1 แถว) · เติมแถว `payments` (PROMPTPAY · วัน/จำนวนตามรายการเครดิต `CHALLENGE`) ให้คำท้า `MATCHED` ในอดีตทุกรายการ → รายงานเดือนเก่านับเงินคำท้า · `credit_entries` / `customers` / `bookings` ไม่ถูกแตะ · รันซ้ำไม่ซ้ำ · **deploy: migration ก่อน rebuild เว็บ** | ลบแถวเงินคำท้า (ทุกแถวที่ผูก `challenge_id`) + คอลัมน์ + index (เงินจองปกติไม่แตะ · ขึ้นใหม่ = เติมกลับจากเครดิต) · ถอยเว็บกลับ image ก่อน CR-06 ก่อน แล้วค่อย `--down 009` |

สคริปต์นับ `bookings` ก่อน/หลังทุกครั้ง ต้องเท่าเดิม (ค่าขอบ BR-43) · ทุกไฟล์ห่อ `BEGIN … COMMIT`

**หลังขึ้น 009 (ขั้น deploy หลัง migration · CR-06): กระทบยอดเงินคำท้า** — อ่านอย่างเดียว ไม่แก้ข้อมูล

```bash
docker exec -i football-db psql -U football -d football -v ON_ERROR_STOP=1 -At -F " | " < tools/reconcile-challenges.sql
```

ผลต้องเป็น 2 บรรทัด **เลขหลัง | เป็น 0 ทั้งคู่** · `a_matched_without_payment` = คำท้า MATCHED ที่จ่ายแล้วแต่ไม่มีแถวเงินผูก (migration เติมไม่ครบ) · `b_payment_not_matching_credit` = แถวเงินคำท้าที่จำนวน / การจอง / วันที่ ไม่ตรงรายการเครดิต `CHALLENGE` ของเจ้าของ · ไม่ใช่ 0 = หยุด ไม่เปิดให้ใช้ ดูรายการที่ผิดจากคำสั่งท้ายไฟล์ `tools/reconcile-challenges.sql` · รันซ้ำหลังรอบใช้งานจริงได้เมื่อไรก็ได้ (ซ้อมแล้ว: seed 0/0 · ข้อมูลเสมือนจริง + คำท้าเก่า 30 รายการ 0/0 · ทดลองลบ/แก้แถวเงิน 1 แถวใน transaction ที่ ROLLBACK → เช็กขึ้น 1/1)

ผู้ทำทุกการเปลี่ยนสถานะการจองต้องตั้ง `app.actor` (และ `app.now`) ในทรานแซกชัน ไม่งั้น trigger ปฏิเสธ — แก้ข้อมูลด้วยมือผ่าน psql ก็ต้องตั้ง:

```sql
BEGIN;
SELECT set_config('app.actor', 'SYSTEM', true), set_config('app.now', now()::text, true);
UPDATE bookings SET status = 'CANCELLED' WHERE code = 'LN-…';
COMMIT;
```

## 6. ข้อมูลของ v1 (volume `football-db-data`)

- v2 ใช้ volume ใหม่ `football-pgdata` และ seed ตาม TEST-DATA · ข้อมูล v1 เป็นข้อมูลทดลอง **ไม่ย้าย** และ **ไม่ลบ** (T-24)
- container เดิมเปลี่ยนชื่อเป็น `football-db-v1` / `football-web-v1` (หยุดอยู่) เพื่อคืนชื่อ `football-db` / `football-web` ให้ v2 โดยไม่ลบอะไร
- ถ้าต้องการดู/ย้ายข้อมูล v1 ภายหลัง: `docker start football-db-v1` → `docker exec football-db-v1 pg_dump -U football -d football -Fc -f /tmp/v1.dump` → `docker cp` ออกมา → `docker stop football-db-v1` → กู้เข้า container ทดลองแล้ว `node scripts/migrate.mjs --container <ชื่อ>` (ซ้อมแล้ว ดูข้อ 8)

## 7. ปัญหาที่พบบ่อย

| อาการ | ทำอะไร |
|---|---|
| `football-web` ไม่ healthy · `/api/health` ได้ `db:false` | เปิด `db/` ก่อน · ตรวจรหัสผ่านใน `web/.env` ตรง `db/.env` · `docker logs football-web` |
| `network football-net declared as external, but could not be found` | ยังไม่ได้ `docker compose -f db/compose.yaml up -d` |
| เปลี่ยน `db/init/*` แล้วไม่มีผล | init รันครั้งเดียวตอนสร้าง volume · ใช้ migration (ข้อ 5) หรือ `/api/test/reset` บนเครื่องทดสอบ · **ไม่ใช้ `down -v`** |
| `app.actor is not set` | โค้ด/คำสั่งที่เปลี่ยนสถานะการจองไม่ได้ตั้งผู้ทำ (ข้อ 5) |
| `005_constraints stopped` | มีแถวที่ผิดกฎ (เช่นจองทับเวลา ยอดติดลบ) · แก้ข้อมูลตามรายการ (ตั้ง `app.actor`) แล้วรันใหม่ |

## 8. ผลซ้อมจริง (2026-10-18 · รอบ B1)

| ซ้อม | ผล |
|---|---|
| migrate 2 ครั้งบนฐาน v2 ที่มีข้อมูล seed | ไม่ error · จำนวนแถว 23 ตาราง + ยอดเงิน เท่าเดิมทุกตัว (bookings 8 → 8) |
| migrate 001–005 บนสำเนาข้อมูล v1 (4 การจอง) 2 ครั้ง | ไม่ error · bookings 4 → 4 · ประวัติแถวแรก 4 แถว (SYSTEM) ไม่ซ้ำ · BIB 6 / BALL 10 ที่ COUNTER |
| ถอย 005 → 001 บนสำเนา v1 แล้วรันขึ้นใหม่ | ทุกขั้น bookings 4 → 4 · เหลือ 13 ตาราง v1 + `app_settings` + `schema_migrations` · รันขึ้นใหม่ได้ |
| สำรอง → เพิ่มการจองหลังสำรอง → `restore --recreate` (ลบฐานทิ้งทั้งก้อน) | 28 ตัวเลขตรงกันทุกตัว (bookings 9 → 9 · payments ฿11,800 → ฿11,800) · การจองที่เพิ่มหลังสำรองหายตามคาด · trigger 6 ตัว + EXCLUDE + CHECK 46 ตัวกลับมาครบ |
| `restore latest` (ทับฐานเดิม ไม่ลบฐาน) | ตัวเลขตรงทุกตัว · เว็บกลับมา healthy |

## 9. ถอยกลับ (ซ้อมแล้ว 2026-10-21)

ซ้อมจริงบนฐาน `football` ที่มีข้อมูล (ไม่ใช้ `-v` ไม่แตะ volume `football-pgdata`) · ถอย schema **009 → 006 (= ตอนรับมอบ tag `v2-handover`)** พร้อมสลับเว็บเป็น image ที่ build จาก tag แล้วขึ้นกลับ 009 + เว็บ HEAD (`ea32d4d`) · ตาม LAB 12 บท 06 (หยุดเว็บให้ smoke จับ → ถอย DB → ตรวจ → ไปข้างหน้า) + ส่วนที่เพิ่ม: พิสูจน์ว่าไฟล์สำรองกู้ได้ และเทียบ md5 รายตาราง
คำสั่งเป็น Git Bash (PowerShell ใช้ `docker`/`node` ชุดเดียวกัน ต่างแค่ `for` กับ `$(...)`)

**ข้อมูลที่ใช้ซ้อม** (ไม่ใช่แค่ seed 8 การจอง): `POST /api/test/reset {}` → `node tools/make-prod-like-data.mjs --no-clock` (630 การจองเสมือนจริง) → `tools/cr06-old-challenges.sql` (30 คำท้า MATCHED แบบก่อน CR-06) → `node scripts/migrate.mjs` (009 เติมแถวเงินคำท้า 30 แถว ฿34,220) → จองใหม่ 1 นัดผ่าน API (`LN-100001`) → ลูกค้า "ต้น" login แล้ว logout (เพิ่มแถว `revoked_sessions`) · กระทบยอดเงินคำท้าก่อนเริ่ม = 0 / 0

### 9.1 เมื่อไรต้องถอย

`node tests/smoke.mjs` exit 1 หลังขึ้นระบบ · กระทบยอด (`tools/reconcile-challenges.sql`) ไม่เป็น 0 ทั้งคู่ · migration หยุดกลางทาง · UAT ไม่ผ่านข้อสำคัญ (`docs/handover/UAT-CHECKLIST.md`)

### 9.2 ก่อนขึ้นระบบ (ทำไว้ล่วงหน้า ไม่งั้นไม่มีของให้ถอย)

```bash
docker tag football-web:v2 football-web:before-deploy      # image เว็บที่รันอยู่ตอนนี้ (ถ้าเป็นการขึ้น CR ใหม่ ตั้งชื่อ before-crNN)
node scripts/backup.mjs --keep 14                           # สำรอง (ค่าเริ่ม keep 7 ลบชุดเก่า · ซ้อมใช้ 14 เพื่อไม่ลบของเดิม)
docker exec football-db psql -U football -d football -At -F ' | ' -c "select version, applied_at from schema_migrations where version in ('007','008','009')"   # จดไว้ (ดูข้อ 9.6)
```

ถ้าต้องถอยกลับถึงตอนรับมอบต้องมี image ของ tag: `git archive v2-handover web | tar -x -C <โฟลเดอร์ว่าง>` แล้ว `docker build -t football-web:v2-handover <โฟลเดอร์>/web` (ซ้อมนี้ใช้ 25 วิเพราะ layer cache · image ชื่อนี้ build ไว้แล้วในเครื่อง)

### 9.3 ขั้นตอนที่ซ้อม (ผลจริง 2026-10-21 · เวลาวัดจริง)

| ขั้น | คำสั่ง | ผล | เวลา |
|---|---|---|---|
| 1 สำรอง | `node scripts/backup.mjs --keep 14` | `db/backups/football-20261021-143314.dump` 168,186 ไบต์ (sha256 `5d28ff156c5ac0be…` · git-ignored `db/backups/*`) · bookings 639 · payments ฿1,232,790 | 1.0 วิ |
| 2 พิสูจน์ว่า dump กู้ได้ (ฐานชั่วคราว ไม่แตะฐานจริง) | `docker exec football-db psql -U football -d postgres -c "CREATE DATABASE football_restore_check"` → `docker exec football-db pg_restore -U football -d football_restore_check --no-owner --exit-on-error /backups/<ไฟล์>` → นับ/md5 → `DROP DATABASE football_restore_check` | กู้สำเร็จ · **md5 ทั้ง 26 ตาราง + ยอดรวม ตรงกับฐานจริงทุกตัว** (`bookings` 639 · `payments` 1,232,790 · คำท้าที่มี `challenge_id` 30 · `revoked_sessions` 562 · schema 001–009) · ฐานชั่วคราวถูกลบแล้ว | 1.5 วิ |
| 3 ถอยเว็บเป็นรุ่นตอนรับมอบ **ก่อน** | `docker tag football-web:v2 football-web:head-ea32d4d` · `docker tag football-web:v2-handover football-web:v2` · `docker compose -f web/compose.yaml up -d --no-build --force-recreate` | healthy · BUILD_ID `gR4P8HNc…` (รุ่น tag) · เว็บเก่าทำงานบน schema 009 ได้ (ยังไม่ถอย DB) | 7.6 วิ |
| 4a ถอย DB ทีละเลข **จากใหม่ไปเก่า** | `node scripts/migrate.mjs --down 009` | `/api/version` → 008 · bookings 639 → 639 ✓ | 1.5 วิ |
| 4b | `node scripts/migrate.mjs --down 008` | → 007 · bookings 639 ✓ | 1.1 วิ |
| 4c | `node scripts/migrate.mjs --down 007` | → **006** · bookings 639 ✓ · `--status` เหลือ 001–006 | 1.4 วิ |
| 5 ตรวจเว็บเก่าบน schema 006 | `EXPECT_SCHEMA=006 SMOKE_LEVEL=core node tests/smoke.mjs` (exit 0, 8/8 ข้อหลัก ข้าม 2 ข้อของ CR) · login ต้น/เจ้าของ ได้ · `GET /api/me` ได้ 200 · `GET /api/bookings/LN-100001?phone=…` เห็นนัดใหม่ · `owner/reports` ตอบ · `POST /api/quote` ตอบราคา · snapshot md5 (ผลในข้อ 9.4) | ผ่านทั้งหมด · **ลูกค้า logout แล้วใช้ cookie เดิม `GET /api/me` ยังได้ 200** (= พฤติกรรมก่อน CR-01 ตามคาด) | – |
| 6 ไปข้างหน้า: ขึ้น schema ก่อน | `node scripts/migrate.mjs` (รันทุกไฟล์ซ้ำได้) | UP 001…009 · bookings 639 → 639 ✓ · `tools/reconcile-challenges.sql` = **0 / 0** | 3.8 วิ |
| 7 คืนแถวที่ down ลบ (ต้องใช้ dump) | `docker exec football-db pg_restore -U football -d football --data-only --table=revoked_sessions --single-transaction --exit-on-error /backups/<ไฟล์>` · `UPDATE schema_migrations SET applied_at = <ค่าที่จดไว้> WHERE version IN ('007','008','009')` | `revoked_sessions` 562 แถวกลับมา · applied_at กลับเป็นค่าเดิม | 0.5 วิ |
| 8 เว็บ HEAD กลับ | `docker tag football-web:head-ea32d4d football-web:v2` · `docker compose -f web/compose.yaml up -d --no-build --force-recreate` | healthy · `node tests/smoke.mjs` **10/10 exit 0** · logout แล้วใช้ cookie เดิม `GET /api/me` → **401** (CR-01 กลับมา) | 7.0 วิ |
| 9 smoke จับเว็บล่ม | `docker compose -f web/compose.yaml stop` → `node tests/smoke.mjs` → `docker compose -f web/compose.yaml up -d` → smoke | หยุด: **0/10 exit 1** (`ECONNREFUSED`) · เปิด: healthy 5.9 วิ → **10/10 exit 0** | – |

เวลารวมขั้นที่เปลี่ยนระบบ (3, 4a–c, 6, 7, 8) ≈ **23 วิ** ไม่รวมสำรอง/ตรวจ · เว็บไม่พร้อมใช้ช่วงสลับ image ครั้งละ ~7 วิ

### 9.4 จำนวนแถว / md5 ก่อน · ที่ schema 006 · หลังขึ้นใหม่ (นับ `count(*)` + md5 ของแถวเรียงข้อความ ทุกตาราง · `payments` ไม่นับคอลัมน์ `id`)

| ตาราง | ก่อน (009) | หลังถอยเป็น 006 | หลังขึ้นใหม่ 009 + คืนจาก dump |
|---|---|---|---|
| bookings | 639 | 639 · md5 **เท่าเดิม** | 639 · md5 **เท่าเดิม** |
| booking_status_history / audit_logs / credit_entries / customers / challenges / counter_sales / stock_movements / ที่เหลือรวม 23 ตาราง | 1,832 / 596 / 56 / 48 / 36 / 55 / 140 / … | **md5 เท่าเดิมทุกตาราง** | **md5 เท่าเดิมทุกตาราง** |
| payments | 1,024 แถว · ฿1,232,790 (ในนี้เงินคำท้า 30 แถว ฿34,220) | **994** แถว · ฿1,198,570 (แถวเงินคำท้าถูกลบตามที่ `009.down` บอก) | 1,024 · ฿1,232,790 · md5 เท่าเดิมเมื่อไม่นับ `id` (`id` ของ 30 แถวนั้นเป็นเลขใหม่) |
| field_rates (008) | 2 แถว (A, B 1 พ.ย. เย็น ฿1,300) | **ตารางหาย** | 2 แถว เนื้อหาเท่าเดิม · `created_at` เป็นเวลาที่ขึ้นใหม่ (md5 ต่างเฉพาะคอลัมน์นี้) |
| revoked_sessions (007) | 562 | **ตารางหาย** (cookie ที่เคยกด logout ใช้ได้อีก — เว็บรุ่นเก่าไม่ตรวจอยู่แล้ว) | 562 (คืนจาก dump) · md5 เท่าเดิม |
| schema_migrations | 001–009 | 001–006 | 001–009 · `applied_at` ของ 007–009 คืนตามที่จดไว้ |
| กระทบยอดเงินคำท้า | 0 / 0 | – (009 ถูกถอยแล้ว) | **0 / 0** |
| golden master (หลังซ้อม + reset) | – | – | 261/261 · 15/15 · 132/132 |

สรุป: 26 ตาราง (นับตอน 009) → หลังขึ้นใหม่ **25 ตาราง md5 เท่าเดิมทุกตัว** + `field_rates` เท่าเดิมเมื่อไม่นับ `created_at`

### 9.5 ข้อมูลที่หายถ้าถอย (บอกร้านก่อนถอยทุกครั้ง)

| ถอยถึง | หาย | ผลต่อร้าน | กู้ได้ไหม |
|---|---|---|---|
| 009 | แถว `payments` ที่ `challenge_id` ไม่ว่าง (เงินคำท้า ทั้งที่ migration เติมและที่เว็บใหม่เขียน) | รายงาน/แดชบอร์ดกลับไปไม่นับเงินคำท้า (พฤติกรรมก่อน CR-06) · การจอง/เครดิตเจ้าของ/ลูกค้าไม่ถูกแตะ | ขึ้น 009 ใหม่ = เติมกลับจากรายการเครดิต `CHALLENGE` อัตโนมัติ (ซ้อมแล้ว เท่าเดิม ยกเว้น `id` ของแถว) |
| 008 | ตาราง `field_rates` (ราคาเย็น A/B ฿1,300 วันที่ 1 พ.ย.) | ราคากลับเป็น ฿1,200 ทุกวัน · ยอดที่เก็บในการจองไม่เปลี่ยน | migration 008 ใส่ 2 แถวคืนให้เอง (แถวที่ร้านเพิ่มเองภายหลัง ต้องกู้จาก dump) |
| 007 | ตาราง `revoked_sessions` (รายการ cookie ที่กดออกจากระบบ) | ผู้ที่เคยกด "ออกจากระบบ" แต่ cookie ยังไม่หมดอายุ กลับเข้าใช้ได้อีก (ความเสี่ยงเรื่องร้องเรียนของ CR-01 กลับมา) | กู้แถวจาก dump ได้ (ขั้น 7) |
| (ทุกเลข) | การจอง/เงิน/ผู้ใช้/สต็อก/แชท ที่เกิดหลังไฟล์สำรอง ถ้าต้อง **กู้ทั้งฐาน** (`node scripts/restore.mjs …`) | – | ไม่กู้ทั้งฐานถ้าไม่จำเป็น: การถอยด้วย `--down` เก็บการจองใหม่ไว้ครบ (ซ้อมแล้ว `LN-100001` อยู่ทุกขั้น) |

### 9.6 ข้อควรระวังที่เจอตอนซ้อม

- **`--down N` ไม่บังคับลำดับ** (ถอย 008 ได้ทั้งที่ 009 ยังอยู่ · `/api/version` ใช้ `max(version)` จึงไม่เห็นรูตรงกลาง) → ซ้อมนี้สั่งทีละเลข **009 → 008 → 007** แล้วตรวจ `--status` และ `/api/version` หลังทุกขั้น
- **ถอยเว็บก่อน ถอย DB ทีหลัง** (เว็บใหม่เขียน `payments.challenge_id` และอ่าน `field_rates`/`revoked_sessions` ตลอด · เว็บเก่าทำงานบน schema ใหม่ได้) · ขาขึ้นกลับกัน: **migration ก่อน แล้วค่อยเปลี่ยนเว็บ**
- `applied_at` ของ 007 คือเวลาเริ่มนับ cookie แบบก่อน CR-01 (`db/migrations/007_session_revocation.sql`) → ขึ้น 007 ใหม่แล้ว `applied_at` เป็นเวลาปัจจุบัน cookie เก่าจะได้เวลาผ่อนผันนานขึ้น → จดค่าเดิมไว้ก่อนถอย แล้ว `UPDATE` คืนหลังขึ้น (ขั้น 7)
- `node scripts/backup.mjs` ค่าเริ่ม `--keep 7` จะลบ dump เก่าเกิน 7 ชุด → ซ้อมใช้ `--keep 14`
- `docker compose up` ไม่มี `--build` ใช้ image ที่แท็กอยู่ (`football-web:v2`) → การสลับ image ทำได้ด้วย `docker tag` ตัวเดียวแล้ว `up -d --no-build --force-recreate` · build ใหม่ (`--build`) ใช้ตอนขึ้นระบบจริงครั้งแรก
- ถอยแบบ **ข้ามไปเก่ากว่า CR ที่เพิ่งขึ้น** (เช่นแค่ CR-06) ต้องมี image ก่อน CR นั้น (`football-web:before-crNN`) · ในเครื่องนี้มีเฉพาะ `before-cr01` `before-cr02` และ `v2-handover` (+ `head-ea32d4d`) → ถอยทีละ CR ที่ 03–06 ต้อง build image จาก commit ก่อนหน้าเอง (`git archive <commit> web | tar -x -C …`)
- ปลายซ้อม: `POST /api/test/reset {}` คืน seed ปกติ (ข้อมูลเสมือนจริงของการซ้อมถูกล้าง ตั้งใจ) · `BUG_MODE=0` · `MODE=mock` · schema 009 · healthy

## 10. เริ่มด้วยคำสั่งเดียว (ทดสอบแล้ว 2026-10-22)

เป้า: clone repo ใหม่ + มีแค่ Docker Desktop → คำสั่งเดียว → ฐานข้อมูล + seed + migration + เว็บ → เปิด http://localhost:3000

```bash
docker compose up -d --build        # หรือ  .\start.ps1 (Windows PowerShell 5.1+)  /  ./start.sh (mac, Linux, Git Bash)
```

`start.ps1` / `start.sh` = เช็กว่า Docker ทำงาน → `up -d --build` → รอ `football-web` healthy (หมดเวลา 420 วินาที ปรับด้วย `START_TIMEOUT`; หมดเวลาแล้วพิมพ์ log) → พิมพ์ URL และที่อยู่บัญชีทดลอง (`web/SPEC.md`) · สคริปต์ไม่รัน `down` ใด ๆ

### โครงสร้าง

| ไฟล์ | ทำอะไร |
|---|---|
| `compose.yaml` (ราก) | `include:` ของ `db/compose.yaml`+`db/compose.root.yaml` และ `web/compose.yaml`+`web/compose.root.yaml` · โปรเจกต์ compose ชื่อ `football` |
| `db/compose.root.yaml` | ค่าเดโมของ DB (`POSTGRES_*`) · บริการ **`migrate`** (one-shot) |
| `db/scripts/migrate-up.sh` | ลงเฉพาะ migration ขาขึ้นที่ยังไม่มีแถวใน `schema_migrations` · **ไม่แตะ `*.down.sql` เด็ดขาด** · ข้ามไฟล์ที่ลงแล้ว (จึงไม่แตะ `applied_at` ของ 007) · พลาดแล้วหยุด (`ON_ERROR_STOP`) → เว็บไม่ขึ้น |
| `web/compose.root.yaml` | `depends_on`: `db` healthy + `migrate` completed · `ALLOW_TEST_RESET` ค่าเดโม 1 · บริการ `smoke` (profile `test`) |
| `db/compose.yaml`, `web/compose.yaml` | ใช้เดี่ยว ๆ (`-f`) ได้เหมือนเดิมทุกคำสั่ง · เพิ่มแค่ตัวแปรชื่อ/พอร์ต และ `db/.env` เป็น optional |

ลำดับตอนขึ้น: `db` (healthy) → `migrate` (จบ exit 0) → `web` (healthy) · volume ใหม่: `db/init` ลง schema+seed ครบตอนสร้าง → `migrate` ข้ามทุกไฟล์ · volume เดิมที่ schema เก่ากว่า: `migrate` ลงเฉพาะเลขที่ขาด (ซ้อมแล้วด้านล่าง)

### ค่าเดโมที่ไม่ต้องมี `.env` (ถ้ามี `db/.env` / `web/.env` ค่าในไฟล์ชนะ · ค่าใน shell ชนะทั้งหมด)

| ค่า | เดโม | อยู่ที่ |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` / `POSTGRES_PASSWORD` | `football` / `football` / `football_demo` | `db/compose.root.yaml` |
| `DATABASE_URL` | `postgres://football:football_demo@<FB_NAME>-db:5432/football` | `web/compose.yaml` |
| `ALLOW_TEST_RESET` | `1` (เปิด `/api/test/reset` `/api/test/clock`) | `web/compose.root.yaml` |
| `BUG_MODE` / `MODE` | `0` / `mock` | `web/compose.yaml` |
| `SESSION_SECRET` | ว่าง → web สุ่มต่อการรัน (`web/lib/server/secret.ts` อนุญาตเฉพาะ `ALLOW_TEST_RESET=1`) → **ผู้ใช้หลุดออกจากระบบทุกครั้งที่ web เริ่มใหม่** | – |

> **เครื่องจริง (production) ต้องตั้งเองทุกค่า:** รหัสผ่าน DB ใหม่ใน `db/.env` + `DATABASE_URL` ที่ตรงกันใน `web/.env` · `SESSION_SECRET` สุ่ม ≥ 32 ตัว (ข้อ 2.0) · **`ALLOW_TEST_RESET=0`** (ค่าเดโมของ compose ที่ราก = 1 ถ้าไม่เขียนใน `web/.env` จะเปิดช่อง reset ทิ้งข้อมูล) · ไม่มีแถว `app_settings.clock` ในฐาน (CLAUDE.md) · รหัสผ่านเดโมอยู่ใน git จึงห้ามใช้กับข้อมูลจริง (พอร์ต DB ผูก 127.0.0.1 เท่านั้น)

### รันสำเนาที่สองบนเครื่องเดียวกัน (ไม่ชนของเดิม)

ตัวแปร (ค่าเริ่ม = ค่าปัจจุบันทุกตัว): `COMPOSE_PROJECT_NAME` (`football`) · `FB_NAME` (`football` → container `<FB_NAME>-db` / `-web` / `-mock-llm` และ image `<FB_NAME>-web:v2`) · `FB_PGDATA` (`football-pgdata`) · `FB_NETWORK` (`football-net`) · `WEB_PORT` (3000) · `DB_PORT` (5433)

```bash
COMPOSE_PROJECT_NAME=fbcheck FB_NAME=fbcheck FB_PGDATA=fbcheck-pgdata FB_NETWORK=fbcheck-net WEB_PORT=3100 DB_PORT=5434 docker compose up -d --build
```

> **ระวัง (เกิดขึ้นจริงตอนซ้อม):** ชื่อโปรเจกต์ของ `db/compose.yaml` คือ `football-db` และของ `web/compose.yaml` คือ `football-web` — ถ้าสั่ง `-f db/compose.yaml` พร้อมเปลี่ยน `FB_NAME` โดย **ไม่ใส่ `-p`** compose จะมองว่าเป็นโปรเจกต์เดิมและ **recreate container ของระบบที่ใช้อยู่** (ครั้งนั้นเว็บถูกแทนที่ ต้องกู้) · สำเนาที่สองใช้คำสั่งที่รากพร้อม `COMPOSE_PROJECT_NAME` หรือ `-p <ชื่อ>` เสมอ

### ย้ายระบบที่เปิดแยก (`db/` + `web/`) มาใช้คำสั่งเดียว

ชื่อ container เดียวกัน (`football-db` / `football-web`) แต่คนละโปรเจกต์ compose → เปิดพร้อมกันไม่ได้ · `start.ps1` / `start.sh` ตรวจเจอแล้วหยุดพร้อมบอกวิธี (ไม่ลบอะไรเอง) · ไม่ต้องย้ายก็ได้: คำสั่งเดิม (ข้อ 2) ใช้ต่อได้ · ถ้าจะย้าย: `docker compose -f web/compose.yaml down` → `docker compose -f db/compose.yaml down` (**ไม่มี `-v`**) → `docker compose up -d --build` · volume `football-pgdata` อยู่ต่อ (compose อาจเตือนว่า volume/network "carries the compose label … does not match" — เป็นแค่คำเตือน ซ้อมแล้วใช้งานได้ ข้อมูลครบ)

### profile เสริม

- `--profile mock`: `docker compose --profile mock up -d mock-llm` (เหมือน `-f web/compose.yaml --profile mock`)
- `--profile test`: `docker compose --profile test run --rm smoke` = `tests/smoke.mjs` ใน container `node:24-alpine` (ไม่ต้องมี Node ในเครื่อง · exit 0 = ผ่านทั้ง 10 ข้อ)
- **ไม่ทำ container Playwright รัน e2e:** เทสต์ e2e เรียก `docker exec football-db …` และ `node scripts/migrate.mjs` จากเครื่อง (ต้องมี docker CLI + socket ในตัวรัน) และเขียนทับ `e2e/test-report/` ที่อยู่ใน git → ไม่ใช่เรื่องง่าย จึงยังรัน e2e ตามเดิม (`cd e2e && node run-all.mjs`)

### ผลทดสอบ (2026-10-22 · Docker 29.8.0 · Compose v5.5.1 · Windows 11)

| # | ทำอะไร | ผล |
|---|---|---|
| 1 | `docker compose config -q` ที่ราก · `-f db/compose.yaml` · `-f web/compose.yaml` ใน clone ที่ **ไม่มี `.env` เลย** | ผ่านทั้ง 3 (exit 0) · `config --services` พร้อม profiles = db, migrate, web, mock-llm, smoke |
| 2 | `git clone` → คัดลอกไฟล์ใหม่ (ยังไม่ commit) ลง clone → `COMPOSE_PROJECT_NAME=fbcheck FB_NAME=fbcheck FB_PGDATA=fbcheck-pgdata FB_NETWORK=fbcheck-net WEB_PORT=3100 DB_PORT=5434 docker compose up -d --build` | 34 วินาที (image มี cache) · `fbcheck-db`/`fbcheck-web` healthy · `fbcheck-migrate-1` Exited (0) ข้ามทั้ง 9 ไฟล์ · `/api/health` `{"ok":true,"db":true}` · `/api/version` `{"schemaVersion":"009","chatMode":"mock","bugMode":0}` · log web: `[secret] … random secret for this run only` |
| 3 | `BASE_URL=http://localhost:3100 node tests/smoke.mjs` · `docker compose --profile test run --rm smoke` | **10/10 exit 0** ทั้งสองแบบ |
| 4 | **volume เดิมที่ schema เก่ากว่า:** `node scripts/migrate.mjs --container fbcheck-db --down 009` (→ 008, `/api/version` = 008) แล้ว `docker compose up -d` | `migrate` ลง **เฉพาะ 009** (`UP …/009_challenge_payments.sql`) ข้าม 001–008 · `applied_at` 001–008 ไม่เปลี่ยน · `/api/version` = 009 · smoke 10/10 |
| 5 | `start.sh` และ `powershell.exe -File start.ps1` (5.1) ด้วยตัวแปรชุด fbcheck | ทั้งคู่ exit 0 พิมพ์ URL `http://localhost:3100` · ไทยแสดงถูก |
| 6 | หยุด `fbcheck-web` แล้วรัน `START_TIMEOUT=1` ทั้งสองสคริปต์ | พิมพ์ข้อความหมดเวลา + log ท้าย แล้ว exit 1 |
| 7 | `start.sh` โดยไม่ตั้งตัวแปร fbcheck (ขณะ `football-db` ของระบบจริงรันอยู่) | ปฏิเสธ พิมพ์วิธีย้าย แล้ว exit 1 โดยไม่แตะอะไร |
| 8 | คำสั่งแบบเดิมแยกโปรเจกต์ (`-p fbold-db -f db/compose.yaml`, `-p fbold-web -f web/compose.yaml`) พร้อม `db/.env`+`web/.env` ใน clone | ขึ้น healthy · smoke 10/10 · `web/.env` มี `ALLOW_TEST_RESET=0` → `POST /api/test/reset` = 404 |
| 9 | คำสั่งที่รากทับ volume ที่สร้างด้วยวิธีแยกโปรเจกต์ (ข้อ 8) โดยมี `.env` อยู่ | ขึ้นได้ ข้อมูลเดิมอยู่ (bookings 8) · migrate ข้ามทั้งหมด · `web/.env` ชนะค่าเดโม (`/api/test/reset` = 404) · smoke 10/10 |
| 10 | เก็บกวาด: `down` (ไม่มี `-v`) → `docker volume rm fbcheck-pgdata fbold-pgdata` (ชื่อเต็ม) → `docker rmi fbcheck-web:v2 fbold-web:v2` | `docker volume ls` เหลือ `football-db-data`, `football-pgdata` · ไม่เหลือ network/container/image ของ fbcheck, fbold |
| 11 | ระบบเดิม (ท้ายการทดสอบ) | `football-web` / `football-db` healthy · `/api/version` 009 · `tests/smoke.mjs` :3000 10/10 exit 0 · volume `football-pgdata` ครบ · `docker compose -f db/compose.yaml config --hash db` = label `config-hash` ของ container `football-db` เดิม (ไฟล์ใหม่ไม่ทำให้ `up -d` recreate db) |

**เหตุการณ์ระหว่างซ้อม (ข้อ 8 รอบแรก):** ใช้ `-f db/compose.yaml` / `-f web/compose.yaml` กับ `FB_NAME=fbold` โดยไม่ใส่ `-p` → ชื่อโปรเจกต์ตรงกับของระบบจริง (`football-db` / `football-web`) compose จึง stop `football-db` และ recreate `football-web` เป็น `fbold-web` · volume `football-pgdata` ไม่ถูกแตะ · กู้แล้ว: `docker network connect --alias db football-net football-db` + `docker compose -f web/compose.yaml up -d --no-build` (image `football-web:v2` เดิม) → healthy · **ผลข้างเคียง:** `football-web` เป็น container ใหม่ และ `SESSION_SECRET` สุ่มใหม่ → ทุกคนต้องเข้าสู่ระบบใหม่ · เป็นที่มาของคำเตือน "ระวัง" ด้านบน
