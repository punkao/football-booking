# REBUILD-PROMPT v2 — ปรับเว็บ v1 ให้เป็นระบบตาม `08-BUILD-PROMPT.md` v2

คุณคือนักพัฒนาที่ดูแล `football-booking/web/` (v1 ทำงานได้แล้ว: FR-01–31 ผ่าน e2e 153/153) งานนี้คือ **ต่อยอดเว็บเดิมให้ครบตาม `docs/08-BUILD-PROMPT.md` v2** ไม่ใช่เขียนใหม่ทั้งหมด
ทำตามขั้นที่มีเลข · ขั้นไหนไม่ผ่านให้หยุดแล้วรายงานสาเหตุจริง · ห้ามแต่งผล

## อ่านได้ / ห้าม
- อ่านได้: `docs/08-BUILD-PROMPT.md` (สเปกเต็ม) · `docs/TEST-DATA.md` ([D] · seed ต้องตรงทุกค่า) · `docs/04-REQUIREMENTS.md` (รวมส่วนที่ 7.1 การตัดสินของทีม T-13–T-24) · `docs/06-SA.md` · `docs/07-SAD.md` (ADR-10–19) · `docs/01-INTERVIEW.md` (A-29–A-40) · ทุกอย่างใน `web/`
- **ห้ามเปิดหรือแก้** `e2e/` · `docs/trace/` · `tools/check-*` · `Teaching_CWN2026/**/_solution/` · ห้ามแก้ไฟล์ใน `docs/` (ยกเว้นสร้าง `docs/RUNBOOK.md`)
- ห้ามเปลี่ยนชื่อ `data-testid` · รหัส error · ข้อความ · API ของ v1 (เพิ่มได้) · e2e ชุดเดิมต้องยังผ่าน
- ห้าม `docker compose down -v` · ห้ามลบ volume `football-db-data` เดิม (T-24)
- **เทสต์ก่อนโค้ด:** กฎใหม่ทุกข้อ (BR-29–BR-45) เขียน unit test ใน `web/lib/rules` ที่แดงก่อน แล้วค่อยเขียนโค้ดให้เขียว

## รอบ B1 · ฐานระบบและข้อมูล (หยุดแล้วรายงานเมื่อจบรอบนี้)
1. Docker แยกตาม `08-BUILD-PROMPT` ขั้น 3 และ ADR-10: `db/compose.yaml` (`football-db`, `football-pgdata`, `5433:5432` ผูก 127.0.0.1, network `football-net`) · `web/compose.yaml` (`football-web`, external network, profile `mock` + `mock-llm` ว่างไว้ก่อนก็ได้) · ลบ `web/docker-compose.yml` เดิมหลังของใหม่ใช้ได้
2. ฐานข้อมูลตาม ADR-11/12/14: `db/init/01-schema.sql` + `db/migrations/NNN_*.sql` และ `NNN_*.down.sql` (รันซ้ำได้ · ตาราง `schema_migrations`) · 23 ตารางตาม contract · `EXCLUDE` กันจองทับ · `CHECK` · เงิน INTEGER · trigger บันทึก `BookingStatusHistory` และกัน UPDATE/DELETE ของ history/audit · web เลิกสร้างตารางเอง
3. `db/init/02-seed.sql` ตาม **TEST-DATA ทุกค่า** (วันที่ตายตัว T-18 · ผู้ใช้ 10 · คลัง 8×2 · การจอง LN-900001–8 พร้อม Payment และประวัติ · ขาย 2 · แชท 1) · `/api/test/reset` ใช้ SQL ชุดเดียวกัน · ไม่ส่ง `now` = ศ 9 ต.ค. 2569 10:00 · `ALLOW_TEST_RESET=0` → `/api/test/*` 404
4. `AuditLog` สำหรับการกระทำของร้านใน v1 (เช็กอิน ไม่มา คืนของ ปิดฝน วันหยุด) ตาม T-16 · `scripts/backup.mjs` + `scripts/restore.mjs` (ADR-13) + `docs/RUNBOOK.md`
5. ตรวจ: 2 container healthy · selfcheck v1 (`rules-check.mjs`) ปรับเฉพาะค่าที่ seed เปลี่ยนจริงแล้วผ่าน · migration รัน 2 ครั้งไม่ error · backup → ลบฐานทดลอง → restore แล้วจำนวนแถวเท่าเดิม · unit · lint · tsc
6. **รายงาน B1** (ตาราง: ขั้น | ผล | หลักฐาน · สิ่งที่ตัดสินใจเอง) แล้วหยุดรอ

## รอบ B2 · ฟีเจอร์ใหม่ (เริ่มเมื่อได้รับข้อความ "เริ่ม B2")
1. คลังของ + ขายหน้าเคาน์เตอร์ + ย้าย + รับเข้า/ชำรุด/ปรับยอด + เตือน (FR-37–41 · BR-33–38 · BR-44)
2. หลังบ้าน: แดชบอร์ด · การจองทั้งหมด + ประวัติ · รายงาน + CSV · ประวัติแชท · AuditLog (FR-42–44 · BR-39–41 · BR-44–45 · NFR-22)
3. ติดตามการจอง (FR-45)
4. แชทบอทตาม `08-BUILD-PROMPT` ขั้น 5.1 + ADR-15–17 · `mock-llm` จริง · การ์ดยืนยันก่อนจอง (A-34) · ลบเบอร์ในแชทเกิน 90 วัน (BR-45)
5. BUG_MODE ชุดใหม่ตาม `08-BUILD-PROMPT` ขั้น 7 (ลบบั๊ก v1 ทิ้งก่อน · เฉลยเขียนทับ `web/BUGS.md` · **ห้ามบอกใคร** · selfcheck `--expect-bugs` พิมพ์แค่จำนวน)
6. `web/SPEC.md` + `web/ASSETS.md` + `web/selfcheck/check-testdata.mjs` (E01–E148 ข้าม unit) + ภาพทุกหน้าใหม่ 1280/375
7. ตรวจตาม `08-BUILD-PROMPT` ขั้น 9 ทั้งหมด · จบที่ BUG_MODE=0 · `MODE=mock` · reset `{}`
8. **รายงาน B2** ตาม `08-BUILD-PROMPT` ขั้น 10 (ห้ามบอกว่าบั๊กอยู่ที่ไหน)
