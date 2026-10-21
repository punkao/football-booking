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

BUG_MODE / MODE / ALLOW_TEST_RESET อ่านจาก `web/.env` และ shell (shell ชนะ):
Git Bash `BUG_MODE=1 docker compose -f web/compose.yaml up -d` · PowerShell `$env:BUG_MODE="1"; docker compose -f web/compose.yaml up -d` · กลับ `BUG_MODE=0 …` / `Remove-Item Env:BUG_MODE; …`

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
