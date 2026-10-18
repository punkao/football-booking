# REBUILD-PROMPT v2 — ปรับเว็บ "ลูกหนัง อารีน่า" ให้ตรงบท 04 ใหม่ของอาจารย์

อ้างอิง: `Teaching_CWN2026/00_tester/04_sabai-spa-web-and-testplan-from-interview` (LAB 5–6)
คุณคือนักพัฒนาที่ดูแล `football-booking/web/` งานนี้**ไม่ใช่สร้างเว็บใหม่** แต่ปรับโครง Docker, seed, รูป และบั๊กปริศนาให้ตรงบท 04

> **ห้ามเปิด** `Teaching_CWN2026/**/_solution/` (เฉลยของอาจารย์) ทุกกรณี

## อ่านได้
**`docs/08-BUILD-PROMPT.md` v2 (สเปกการสร้างฉบับเต็ม — ไฟล์นี้คือส่วนที่ต้องเปลี่ยนจากเว็บเดิม)** · `docs/04-REQUIREMENTS.md` (แหล่งความจริง) · **`docs/TEST-DATA.md` (ร้านยืนยันแล้ว = [D] · seed ต้องตรงทุกค่า)** · `docs/06-SA.md` · `docs/07-SAD.md` · `docs/08-BUILD-PROMPT.md` · ทุกอย่างใน `web/`
ลำดับเมื่อเอกสารขัดกัน: `TEST-DATA.md` > `04-REQUIREMENTS.md` > `06/07`
**ห้ามเปิดหรือแก้** `e2e/` · ห้ามแก้ `docs/` · ห้ามเปลี่ยน `data-testid` / รหัส error / ข้อความ / API เดิม (เพิ่มได้)

## 1. Docker แยก 2 โปรเจกต์ (แทน `web/docker-compose.yml` เดิม)
- `db/compose.yaml`: container `football-db` (`postgres:16-alpine`) · volume `football-pgdata` · พอร์ต `5433:5432` · healthcheck `pg_isready` · สร้าง network `football-net`
  - `db/init/01-schema.sql` ตาม ERD (`06-SA.md` ส่วน 2 + ตารางที่เว็บใช้จริง เช่น `app_settings`) · เงินใช้ `INTEGER` บาทเต็ม (ระบบไม่มีสตางค์ตาม BR-12) หรือ `NUMERIC` — ระบุใน SPEC
  - `db/init/02-seed.sql` ตาม `TEST-DATA.md` **ทุกค่า**
- `web/compose.yaml`: container `football-web` พอร์ต `3000` · `DATABASE_URL` ชี้ `football-db:5432` · ใช้ network `football-net` (external) · env เดิมทั้งหมด (`ALLOW_TEST_RESET=1`, `BUG_MODE=${BUG_MODE:-0}`, `TZ=Asia/Bangkok`, `HOSTNAME=0.0.0.0`) · mount `../docs` และ `../e2e/test-report` อ่านอย่างเดียวเหมือนเดิม (หน้า /project)
- เปิด db ก่อน รอ healthy แล้วค่อย web · ไม่มีไฟล์ .sh · `.gitattributes` LF · คำสั่งใช้ใน PowerShell และ Git Bash ได้
- `POST /api/test/reset` ต้อง reset กลับเป็น seed ชุดเดียวกับ `02-seed.sql` (ใช้ SQL ชุดเดียวกัน ไม่เขียน seed ซ้ำสองที่) และรับ `{now}` เหมือนเดิม · ไม่ส่ง `now` = ใช้วันล็อกใน `TEST-DATA.md`
- ลบ `web/docker-compose.yml` เดิมหลังของใหม่ใช้ได้ · ปิด/ลบ container และ volume เดิม `football-db-data` ได้ (ข้อมูลเดิมเป็นข้อมูลทดลองทั้งหมด)

## 2. รูปในเว็บ
เครื่องนี้**ไม่มี Codex CLI** → ห้ามใช้รูปจากเน็ต วาดเองเป็น SVG/CSS เก็บที่ `web/public/assets/` · เขียน `web/ASSETS.md`: ไฟล์ | ใช้ที่หน้าไหน | สร้างด้วยอะไร | alt

## 3. บั๊กปริศนาชุดใหม่ (BUG_MODE=1)
- **ลบบั๊ก 3 ตัวเดิมออกทั้งหมด** (เฉลยเดิมถูกเปิดไปแล้ว)
- เลือกบั๊กใหม่เอง 3 ตัวจาก BR ใน `04`: **เงิน 1 · การจอง 1 · ตัวเลขหรือสถานะที่ต้องอัปเดตหลังทำรายการ 1** · ทุกตัวต้องเป็นแบบที่ "ถ้าลอกค่าจากหน้าจอไปเป็นผลที่คาดหวัง จะจับไม่ได้" (หน้าจอ = API = ฐานข้อมูล ผิดตรงกัน ไม่มี error)
- เขียนเฉลยที่ `web/BUGS.md` เท่านั้น (เขียนทับของเดิม) · **ห้ามบอกในคำตอบ ห้ามเขียนใน SPEC / CHANGELOG / คอมเมนต์ที่เดาง่าย / ชื่อ selfcheck ที่พิมพ์ออกหน้าจอ**
- `selfcheck/rules-check.mjs --expect-bugs` ต้องพิมพ์แค่จำนวนข้อที่ล้ม ไม่พิมพ์ชื่อข้อหรือ BR · รายงานกลับแค่ "BUG_MODE=1 ล้ม N ข้อ"

## 4. ตรวจกฎตาม TEST-DATA
- สคริปต์ `web/selfcheck/check-testdata.mjs`: ยิง API ตามตารางค่าขอบทุกแถวใน `TEST-DATA.md` (ข้ามแถวที่ระบุ "unit test") → รายงาน "ผ่าน X / Y" · `BUG_MODE=0` ต้องผ่านทั้งหมด
- selfcheck เดิม (`rules-check`, `screens*`, `portal-check`) และ unit test / lint / tsc ยังผ่าน (ปรับค่าที่เปลี่ยนเพราะ seed ใหม่ได้ และบันทึกว่าเปลี่ยนอะไร)

## 5. เอกสาร
- `web/SPEC.md`: Docker 2 โปรเจกต์ (คำสั่งเปิด/ปิด/BUG_MODE ใน PowerShell และ Git Bash) · seed ใหม่ · อ้าง `TEST-DATA.md` · ชนิดข้อมูลเงิน · **ไม่พูดถึงบั๊ก**
- `web/CHANGELOG-7.5.md` เพิ่มส่วน "v2 ตามบท 04" (ไม่พูดถึงบั๊ก)

## 6. จบงาน
`docker compose` ของ db แล้ว web → healthy ทั้งคู่ · `/api/health` = `{ok:true, db:true}` · `BUG_MODE=0` · reset `{}`
ตอบกลับเป็นตาราง: ข้อ 1–5 ทำแล้ว/บางส่วน + ไฟล์ · ผล check-testdata X/Y · selfcheck ทั้งหมด · BUG_MODE=1 ล้มกี่ข้อ (ตัวเลขอย่างเดียว) · สิ่งที่ตัดสินใจเอง · **ห้ามบอกว่าเลือกบั๊กอะไร**
