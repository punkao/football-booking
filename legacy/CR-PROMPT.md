# CR-PROMPT — วิธีทำ Change Request 1 ฉบับ (ทีมดูแลระบบ · บท 05 LAB 5–8 · บท 06 LAB 6–10)

ประโยคหลัก: **"ทำตามที่ขอ ≠ ของเดิมไม่พัง ≠ ส่งมอบได้"** · **"อ่านก่อนแก้ · ล้อมรั้วก่อนแก้ · แก้ทีละเรื่อง · ทุกการเปลี่ยนต้องมีเทสต์ยืนยัน"**
อ่านก่อน: `CLAUDE.md` (กติกา + กับดัก) · `legacy/SYSTEM-MAP.md` หัวข้อ L (CR → file:line) · `legacy/SPEC-GAPS.md` แถวของ CR นี้ · `CHANGE-REQUESTS/CR-0N.md`
อ้างวิธีจาก README บทเรียน (ไม่เปิด `_solution/` เด็ดขาด): `Teaching_CWN2026/00_tester/06_sabai-spa-legacy-change-request/README.md` LAB 6–10

## ขั้นตอน (ห้ามข้ามขั้น · 1 commit ต่อขั้นที่มีป้าย)
1. **คำถามก่อน:** เขียน `docs/impact/CR-0N.md` หัวข้อ "คำถามถึงร้าน" (จากหนังสือ + SPEC-GAPS) **ก่อน** เปิด `CHANGE-REQUESTS/answers/README.md` · แล้วค่อยเปิดอ่านคำตอบหัวข้อ CR นี้ · คำถามที่ไม่มีคำตอบ → หัวข้อ "ถามร้าน (ยังไม่มีคำตอบ)" ใช้สมมติฐานที่ปลอดภัยที่สุดและเขียนไว้
2. **ของเดิมทำงานอย่างไร (CR-0N-BEFORE):** อธิบายพฤติกรรมเดิมด้วย `file:line` และหลักฐานที่รันจริง (curl / SQL อ่านอย่างเดียว / test) ใน `docs/impact/CR-0N.md`
3. **Impact ก่อน diff:** ตาราง ไฟล์ × เทสต์ที่กระทบ · DB (ต้องมี migration ไหม · ข้อมูลเดิม) · i18n TH/EN · แชทบอท · CSV/รายงาน · golden (`tests/golden`) ที่จะเปลี่ยน · grep ทุกที่ที่ต้องแก้ (กับดัก: ค่าซ้ำหลายที่)
4. **commit เทสต์แดง** `CR-0N-red: …` — test ใหม่ใน `e2e/tests/cr/cr-0N.spec.ts` (และ unit ใน `web/` ถ้าเหมาะ) ที่ล้มกับโค้ดเดิมเพราะเหตุผลที่ถูก (รันให้เห็นว่าแดง · จดผลใน impact) · ค่าที่คาดหวังติดที่มา `[D:CR-0N]` (หนังสือ/คำตอบร้าน) หรือ `[E …]` · ห้ามแก้เทสต์เดิมใน `e2e/tests/*.ts` (มีรั้ว) — ถ้าค่าที่คาดหวังในชุดเดิมต้องเปลี่ยนจริงตามคำขอ ให้เพิ่มแถวใน `ORACLE-CHANGES.md` (TC · ค่าเดิม · ค่าใหม่ · ที่มา CR) และรายงาน lead แทนการแก้เอง
5. **commit แก้** `CR-0N: …` — แก้น้อยที่สุดตาม impact · migration ใหม่ (ถ้ามี) เป็นเลขถัดไปพร้อม `.down.sql` · ต้องรันซ้ำ 2 ครั้งได้ + ถอยกลับ + กลับขึ้นได้ ทั้งบน seed และบนข้อมูลเสมือนจริง (`POST /api/test/reset {}` → `node tools/make-prod-like-data.mjs` → migrate/down/up → นับแถวตรง → reset `{}` กลับ) · rebuild: `docker compose -f web/compose.yaml up -d --build`
6. **ปลดล็อก known issue:** test ใน `e2e/tests/cr/known-issues.spec.ts` ที่ติดแท็ก CR นี้จะ "ผ่านโดยไม่คาด" → ลบ `test.fail` ของ CR นี้ออก (ไฟล์นี้แก้ได้) ให้กลายเป็น test ปกติที่ผ่าน
7. **regression:** `cd e2e && RUN_MIGRATION_TEST=1 node run-all.mjs` (3 เบราว์เซอร์) + `node tests/golden/check.mjs` · golden ต่างได้เฉพาะที่ CR สั่ง → อธิบายแต่ละกลุ่มที่ต่างใน impact แล้ว `--update` · unit/selfcheck ของ `web/` ตาม RUNBOOK · ผลเทียบ `legacy/BASELINE.md` (TC ที่ต้องเปลี่ยนจากล้ม → ผ่าน · ห้ามมี TC ที่เคยผ่านกลายเป็นล้ม)
8. อัปเดต `CHANGE-REQUESTS/REGISTER.md` แถว CR นี้: สถานะ "ทดสอบผ่าน" (หรือสถานะจริง) · commit (hash ของ red + fix) · ปิดท้าย impact ด้วยตารางผล regression

## กติกา
- ห้ามเปิด `web/BUGS.md` · `**/_solution/**` · `.env` (ห้ามพิมพ์ค่าลับ) · ห้าม `docker compose down -v` · ห้าม `--expect-bugs`
- แก้เฉพาะที่ CR นี้ต้องใช้ · ไม่ refactor เรื่องอื่น · ไม่แตะโค้ดที่ทำงานเฉพาะ `BUG_MODE=1` เว้นแต่ CR บังคับ (ถ้าต้องแตะ: บั๊กปริศนาเดิมต้องยังทำงานใน BUG_MODE=1 เหมือนเดิม)
- e2e reporter เขียนทับไฟล์ใน `e2e/test-report/` — ก่อน commit ให้ `git checkout -- e2e/test-report e2e/index.html` (ยกเว้น lead สั่ง) · ผลรันเก็บเป็นตัวเลขใน impact
- รันไฟล์เดี่ยวใช้ `npx playwright test <file> --project=chromium --no-deps`
- commit ได้ (ไม่ push) · author ตั้งไว้แล้ว · ข้อความ commit ลงท้าย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- จบที่: BUG_MODE=0 · MODE=mock · ALLOW_TEST_RESET=1 · reset `{}` · `/api/version` แสดง schemaVersion ล่าสุด · web healthy
- ติด usage limit: ไฟล์และ commit อยู่ครบ lead จะสั่งทำต่อ

## รายงานกลับ (สั้น)
คำถามที่มีคำตอบ / ยังไม่มี · พฤติกรรมเดิม (file:line) · impact สรุป · commit red + fix · test แดง → เขียว · migration (ถ้ามี) ผล 2 ครั้ง + ถอยกลับ บน seed และข้อมูลจริง · regression ต่อเบราว์เซอร์เทียบ baseline · golden ที่เปลี่ยน · ORACLE-CHANGES (ถ้ามี) · ที่ยังไม่ได้ทำ
