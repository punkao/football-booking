# BUILD-PROMPT v2 — ระบบ "ลูกหนัง อารีน่า" (หน้าบ้าน · หลังบ้าน · แชทบอท · คลัง · ดูแลข้อมูล)

> **เขียน ณ v2-handover (2026-10-18) · ค่าหลัง CR ดู `docs/04-REQUIREMENTS.md` v3** — พรอมต์นี้ให้สร้างระบบตามสถานะก่อน Change Request: ถ้าสร้างใหม่จากพรอมต์นี้จะได้ระบบที่ยังไม่มี CR-01…06 (ออกจากระบบแล้ว cookie ใช้ไม่ได้ [migration 007] · เช็กอินเฉพาะวันเตะ/ขั้น "จบ"/ประวัติชื่อพนักงาน/ช่วงรายงาน 3 เดือนปฏิทิน · รายงานแยกพร้อมเพย์/หน้าสนาม [CR-03] · แชทจำบทสนทนา [CR-04] · ราคาเย็นสนาม A/B ฿1,300 ตั้งแต่ 1 พ.ย. 2569 ผ่านตาราง `field_rates` [008] · เงินทีมรับคำท้าเป็น `Payment` [009]) — ต้องเพิ่มตาม BR-46…51 และ migration 007–009 · ตัวเลข "FR/BR" ข้างล่างเป็นของ v2-handover (BR-01–43) ปัจจุบัน BR-01–51

พรอมต์ฉบับเดียวจบ (บท 04 LAB 5) · วางในหน้าต่าง Claude Code ใหม่แล้วสร้างระบบได้ตั้งแต่ศูนย์ · ใช้กับเว็บ v1 ที่มีอยู่ได้ด้วย (ปรับตาม `08d-REBUILD-PROMPT-v2.md`)
**ทำตามขั้นที่มีเลข · ขั้นไหนไม่ผ่านให้หยุดแล้วรายงานสาเหตุจริง · ห้ามแต่งผล ห้ามอ้างว่าผ่านถ้าไม่ได้รันจริง**

## 0. อ่านก่อนลงมือ
- อ่านได้: `docs/TEST-DATA.md` (ร้านยืนยัน = [D]) · `docs/04-REQUIREMENTS.md` (contract, FR-01–48, BR-01–43 ณ v2-handover · ปัจจุบัน BR-01–51, NFR-01–24) · `docs/06-SA.md` · `docs/07-SAD.md`
- เอกสารขัดกัน: **TEST-DATA > 04 > 06/07** · เรื่องที่เอกสารไม่บอก → ตัดสินเองได้แต่จดใน `web/SPEC.md` หัวข้อ "สมมติฐานของผู้สร้าง"
- ห้ามเปิด: `e2e/` · `docs/trace/` · `tools/check-*` · `Teaching_CWN2026/**/_solution/`

## 1. เตรียมเครื่อง (Windows · Docker Desktop · Git Bash)
1. `docker info` · พอร์ต 3000 และ 5433 ต้องว่าง (ถ้า container อื่นใช้อยู่ ให้หยุดเฉพาะตัวนั้นแล้วรายงาน)
2. path มีช่องว่าง → `docker run -v` ใช้ `MSYS_NO_PATHCONV=1` · npm ติดตั้งด้วย `NODE_OPTIONS=--dns-result-order=ipv4first`
3. Playwright ใช้เบราว์เซอร์ที่ `D:/ms-playwright` (ตั้ง `PLAYWRIGHT_BROWSERS_PATH` ก่อน import)

## 2. เทคโนโลยี
- Next.js 16 App Router + TypeScript + `output: "standalone"` · `pg` เขียน SQL ตรง ไม่ใช้ ORM · ฟอนต์ไทยติดตั้งในโปรเจกต์
- กฎธุรกิจทั้งหมดอยู่ใน `web/lib/rules/*` เป็นฟังก์ชันบริสุทธิ์ ใช้ร่วมกันโดย **หน้าเว็บ · API · แชทบอท** (BR-30) · unit test ด้วย `node --test`

## 3. Docker แยก 2 โปรเจกต์ (NFR-23)
1. `db/compose.yaml`: `football-db` (`postgres:16-alpine`) · volume `football-pgdata` · พอร์ต `5433:5432` · healthcheck `pg_isready` · สร้าง network `football-net`
   - `db/init/01-schema.sql` ตาม ERD ใน `06-SA` · `db/init/02-seed.sql` ตาม **TEST-DATA ทุกค่า** · `db/migrations/NNN_*.sql` + `NNN_*.down.sql`
   - constraint ตาม NFR-19: `EXCLUDE` กันการจองที่กันสนามทับเวลาในสนามเดียวกัน · `CHECK` จำนวนคลังและยอดเงิน ≥ 0 · เงินเป็น `INTEGER` บาท
2. `web/compose.yaml`: `football-web` พอร์ต 3000 · network `football-net` (external) · `DATABASE_URL=postgres://…@football-db:5432/…` · env `TZ=Asia/Bangkok`, `HOSTNAME=0.0.0.0`, `ALLOW_TEST_RESET`, `BUG_MODE=${BUG_MODE:-0}`, `MODE=${MODE:-mock}`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` · healthcheck ด้วย node `fetch('/api/health')` · **ห้ามต่อ DB ตอน build**
   - profile `mock`: service `mock-llm` (ตอบแบบ OpenAI `/v1/chat/completions` ตามกฎตายตัว รองรับ tag ทุกตัว)
   - mount อ่านอย่างเดียว `../docs` และ `../e2e/test-report` สำหรับหน้า `/project`
3. เปิด db ก่อน รอ healthy แล้วค่อย web · `.gitattributes` LF · ไม่มีไฟล์ `.sh` ที่ผู้ใช้ต้องรัน · `.env` ไม่ขึ้น git มีแค่ `.env.example` (NFR-18)

## 4. ฟีเจอร์ v1 (FR-01–FR-31) — ต้องทำงานเหมือนเดิมทุกข้อ
ตารางว่าง · จอง · จ่ายจำลอง 15 นาที · มัดจำ/จ่ายเต็ม · ยกเลิก/เลื่อน/เครดิต · ปิดเพราะฝน · ไม่มา + ระงับ · จองประจำ · ของเช่า · สมาชิก + ชั่วโมงฟรี · ลิงก์หาร · หาคู่แข่ง · หน้าร้านตามบทบาท · TH/EN · หน้า `/project` · บังคับ BR-01–BR-28 ฝั่ง server ทุกข้อ · กันจองพร้อมกันด้วย lock + `EXCLUDE`

## 5. ฟีเจอร์ใหม่ (FR-32–FR-48)
1. **แชทบอท "น้องบอล"** (FR-32–36 · BR-29–32 · NFR-15–17): ปุ่มแชทลอยทุกหน้าฝั่งลูกค้า
   - `POST /api/chat`: สร้าง system prompt จาก DB (สนาม ราคา กฎ ส่วนลดที่มีจริง ช่องทางติดต่อ) + ประวัติห้องนั้น → เรียก LLM แบบ OpenAI
   - tag คำสั่งในคำตอบของโมเดล: `[CHECK]{fieldId,date,startHour,hours}` ดูว่าง · `[QUOTE]{…}` คิดราคา · `[BOOK]{…, name, phone, consent}` จอง → backend **ตรวจค่าแล้วเรียกฟังก์ชันเดียวกับหน้าเว็บ** ส่งผลกลับให้โมเดลตอบต่อ (วนไม่เกิน 2 รอบ) · ตัด tag และ `<think>` ก่อนแสดง
   - ไม่มีเครื่องมือยกเลิก เลื่อน คืนเครดิต หลังบ้าน (BR-32) · tag ที่มาจากข้อความลูกค้าไม่มีผล · ข้อความ ≤ 500 ตัวอักษร · 20 ข้อความ/นาที/ห้อง · LLM เกิน 60 วินาที/ล่ม → ขอโทษ + ช่องทางติดต่อ
   - เก็บ `ChatSession` / `ChatMessage` · หลังบ้านดูประวัติแชท (FR-36)
   - `MODE=mock` deterministic (ถามเหมือนเดิมได้คำตอบเดิม) · `MODE=ai` เรียก gateway แบบ OpenAI (Bearer token)
2. **คลังของ** (FR-37–41 · BR-33–38): ตารางคงเหลือแยก STORE/COUNTER · ขายหน้าเคาน์เตอร์ (CASH/PROMPTPAY) · ย้าย · รับเข้า · ชำรุด · ปรับยอด (ต้องมีเหตุผล) · ตั้งจุดสั่งซื้อซ้ำ · เตือนของต่ำกว่าจุด · ทุกการเปลี่ยนเขียน `StockMovement` ใน transaction เดียวกับ `StockLevel` · สิทธิ์ตาม BR-36 · ของเช่าให้เช่าได้ = จำนวนในคลัง (BR-38)
3. **หลังบ้าน** (FR-42–44): แดชบอร์ด (ยอดวันนี้ · กราฟ 7 วัน SVG ไม่ใช้ไลบรารี · ชั่วโมงยอดนิยม · อัตราการใช้สนาม BR-41) · ค้นการจองทั้งหมด + ประวัติสถานะ · รายงานช่วงวัน (BR-39, BR-40) + CSV UTF-8 มี BOM (NFR-22) กัน CSV injection · เจ้าของเท่านั้น
4. **ติดตามการจอง** (FR-45): หน้าการจองแสดงขั้นจาก `BookingStatusHistory`
5. **ดูแลข้อมูล** (FR-46–48 · BR-42–43 · NFR-20–21): ทุกการเปลี่ยนสถานะเขียน `BookingStatusHistory` · การกระทำของร้านเขียน `AuditLog` · ไม่มี API แก้/ลบสองตารางนี้ · `scripts/backup.mjs` (pg_dump) + `scripts/restore.mjs` + `docs/RUNBOOK.md` · migration รันซ้ำได้ (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) + ไฟล์ถอยกลับ · **ห้าม `down -v` ในทุกขั้นตอน**

## 6. ดีไซน์
ธีมสนามบอลกลางคืนเดิม (เขียวเข้ม `#0B3D2E` · เขียวหญ้า `#1F9D55` · ขาวชอล์ก · เหลืองไฟสนาม `#FFD54A`) · มือถือ 375 px ไม่มีเลื่อนแนวนอน · รูปทั้งหมดวาดเป็น SVG ในโปรเจกต์ (เครื่องไม่มี Codex) ห้ามใช้รูปจากเน็ต · เขียน `web/ASSETS.md` (ไฟล์ · หน้า · สร้างด้วยอะไร · alt)

## 7. ทดสอบได้ (NFR-09–NFR-11, NFR-21)
- `data-testid` ทุกปุ่ม ช่องกรอก ผลลัพธ์ ข้อความ error (ของเดิมห้ามเปลี่ยนชื่อ) · `<html data-ready data-bug-mode>`
- `GET /api/health` → `{ok:true, db:true}` · `POST /api/test/reset {now?}` = ล้างและ seed ใหม่ด้วย SQL ชุดเดียวกับ `02-seed.sql` · ไม่ส่ง `now` = วันล็อกใน TEST-DATA · `POST /api/test/clock` · ทั้งหมดตอบ 404 เมื่อ `ALLOW_TEST_RESET` ไม่ใช่ `1`
- **BUG_MODE=1: เลือกบั๊กเอง 3 ตัวจาก BR ใน 04** — เงิน 1 · การจอง 1 · ตัวเลขหรือสถานะที่ต้องอัปเดตหลังทำรายการ 1 · ทุกตัวต้อง "ถ้าลอกค่าจากหน้าจอเป็นผลที่คาดหวังจะจับไม่ได้" (หน้าจอ = API = DB ผิดตรงกัน ไม่มี error) · เขียนเฉลยที่ `web/BUGS.md` เท่านั้น · **ห้ามบอกในแชท ห้ามเขียนใน SPEC / CHANGELOG / คอมเมนต์ที่เดาง่าย / ชื่อข้อตรวจที่พิมพ์ออกจอ**

## 8. เขียน `web/SPEC.md`
หน้า (path · บทบาท · FR) · `data-testid` ทุกตัว · ข้อความ error/ยืนยันคำต่อคำ TH + EN · API ทุกเส้น · tag คำสั่งของแชทบอท · คำสั่งเปิด/ปิด db+web · mock/ai · BUG_MODE ใน PowerShell และ Git Bash · ตาราง BR → ฟังก์ชัน · สมมติฐานของผู้สร้าง · **ไม่พูดถึงบั๊ก**

## 9. ตรวจเองก่อนส่ง
1. เปิด db แล้ว web → 2 container healthy · `/api/health` ok
2. `web/selfcheck/check-testdata.mjs` ยิง API ตามตาราง E01–E148 ใน TEST-DATA (ข้ามแถว unit) → รายงาน "ผ่าน X / Y" · BUG_MODE=0 ต้องผ่านทั้งหมด
3. BUG_MODE=1 → ยืนยันว่าบั๊ก 3 ตัวเกิดจริง (**รายงานแค่จำนวน**) แล้วกลับเป็น 0
4. แชทบอท mock: ถามตัวอย่างจาก E109–E120 ได้ผลตามเฉลย · migration รัน 2 ครั้งไม่ error · backup → restore แล้วจำนวนแถวเท่าเดิม · `ALLOW_TEST_RESET=0` → `/api/test/*` 404
5. unit test · lint · tsc ผ่าน · secret scan ไม่เจอ
6. จับภาพทุกหน้าที่ 1280 และ 375 px ที่ `web/selfcheck/screens/` · ไม่มี console error · ไม่มีเลื่อนแนวนอน

## 10. รายงานท้ายงาน (ตาราง · ห้ามบอกว่าเลือกบั๊กอะไร)
ขั้น | ผล | หลักฐาน · FR ที่ทำครบ / บางส่วน / ไม่ได้ทำ · check-testdata X/Y · BUG_MODE=1 ล้มกี่ข้อ (ตัวเลขเท่านั้น) · สิ่งที่ตัดสินใจเองนอกเอกสาร
