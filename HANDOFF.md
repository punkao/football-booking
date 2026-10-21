# HANDOFF — ส่งต่องานให้ Claude session/บัญชีใหม่ (อ่านไฟล์นี้ก่อนทำอะไร)

> เขียน 21 ต.ค. 2569 โดย session หลัก (Opus) ก่อนผู้ใช้ย้ายบัญชี Claude · บทสนทนาเดิมไม่ตามมา ไฟล์นี้ + `PLAN.md` + `CLAUDE.md` + memory คือความจำทั้งหมด
> ผู้ใช้พูดไทย · ตอบไทย สั้น ชัด · ผู้ใช้ทำหน้าที่ "เจ้าของสนาม" เวลาต้องตอบคำถามร้าน

## 1. งานคืออะไร
งานส่งอาจารย์ (repo อาจารย์ `../Teaching_CWN2026` · **ห้ามแก้ ห้าม push · ห้ามเปิด `_solution/`**): เอาทุกบทที่อาจารย์สอนมาทำระบบจองสนามบอล "ลูกหนัง อารีน่า" ให้เป็น production 1 ตัว (หน้าบ้าน · หลังบ้าน · แชทบอท · คลังของ · จัดการข้อมูลเบื้องหลัง) + test case พร้อมเฉลยผ่าน Playwright MCP · แผนเต็ม `PLAN.md` ("แผน v5" ส่วน A–E) · แผนที่บทเรียน → งาน `docs/11-INSTRUCTOR-MAP.md`
push ได้ที่ `https://github.com/punkao/football-booking.git` (origin) เท่านั้น · **ถามผู้ใช้ก่อน push ทุกครั้ง** · ห้ามแตะ `punkao/Final-project-VLM-`

**หลักใหญ่ (ผู้ใช้ย้ำ 21 ต.ค.):** ทุกขั้นต้องยึดสิ่งที่ `Teaching_CWN2026` สอน — สอนอะไร · ให้เทสต์อะไร อย่างไร · ใช้เครื่องมืออะไร อย่างไร — แล้ว **ปรับให้เป็นของสนามบอลเรา** (ไม่ลอกตัวอย่าง petshop/สปา) · **ทำเพิ่มเกินบทเรียนได้ถ้าดีกว่าหรือเหมาะกว่า** โดยเขียนเหตุผลสั้น ๆ ว่าทำไม · ก่อนทำแต่ละขั้นให้เปิด README/LAB ของบทที่เกี่ยวข้องอ่านก่อน (ห้าม `_solution/`) · ตอนปิดงานตรวจครบทั้ง repo (00_tester 01–06 · 00_setup 04.1/04.2/05 · 01 Loop/Graph/Dynamic · 02 MCP · 03 Jev) แล้วอัปเดต `docs/11-INSTRUCTOR-MAP.md` + ระบุช่องว่างตรง ๆ

## 2. เสร็จแล้ว
| ส่วน | ผล | หลักฐาน |
|---|---|---|
| A ฟังร้าน | สัมภาษณ์ 2 รอบ · คำตอบร้าน A-01–A-50 · US 52 · FR 48 · BR 45 · NFR 24 · TEST-DATA | `docs/01`–`07`, `docs/TEST-DATA.md` |
| B สร้างเว็บ v2 | Next.js + PostgreSQL (Docker แยก db/web) · แชทบอท mock/ai · รีวิว G4/G5 แก้ 12 ข้อ | `web/`, `db/`, `docs/RUNBOOK.md` |
| C ทดสอบแบบอาจารย์ | TEST-CASES 128 ข้อ + เฉลย · MCP รัน 88 ข้อ · e2e 3 เบราว์เซอร์ · `e2e/index.html` · GIF/MP4 · BUG-HUNT จับบั๊กปริศนา 3/3 | `docs/TEST-CASES.md`, `docs/TEST-RUN-MCP.md`, `docs/BUG-HUNT.md` |
| D รับช่วง (บท 05–06) | HANDOVER-CHECK · SYSTEM-MAP · REA (image `rea-lab:6.4.0` build แล้ว) · golden master · mutant 3/3 · known-issue lock | `legacy/`, `tests/golden/`, `CLAUDE.md` |
| D CR-01…05 | ทุกฉบับ: คำถาม → ของเดิม file:line → impact → commit แดง → commit แก้ → regression | `CHANGE-REQUESTS/`, `docs/impact/CR-0N.md`, `ORACLE-CHANGES.md` |

คะแนน e2e: เริ่มส่วน D 117/128 → หลัง CR-04 **127/128 ทุกเบราว์เซอร์** (เหลือ SERIES-04 ข้ามตามแผน) · schemaVersion **009**

**อัปเดต 21 ต.ค. (session ใหม่):** ข้อ 1 ✅ ผู้ใช้อนุมัติ oracle CR-05 → `ea1c180` · ข้อ 3 ✅ CR-06 red `b119c1e` · fix `ac96761` · REGISTER `f845625` (migration 009 `payments.challenge_id` · regression 3 เบราว์เซอร์ 0 ล้ม · golden ไม่เปลี่ยน) · ค้างถามร้าน CR-06 Q4/Q6/Q7/Q9 (สมมติฐานใน `docs/impact/CR-06.md` 1.2) · `009.down` ลบแถวเงินคำท้าทุกแถว (รวมที่เว็บใหม่เขียน) ขึ้นใหม่เติมกลับจากเครดิต → ใส่ใน RELEASE-NOTES · **งานถัดไป = ข้อ 4**

## 3. ค้างอยู่ตรงไหน (ทำต่อตามลำดับ)
1. **🙋 รอผู้ใช้ (ในฐานะร้าน) อนุมัติ ORACLE-CHANGES 6 แถวของ CR-05** (แถววันที่ 2026-10-21 ใน `ORACLE-CHANGES.md`): ค่าที่คาดหวังเดิมที่วันเตะเลย 1 พ.ย. → ราคาใหม่ตามวันเตะ (TC-SERIES-02 ฿10,800 → ฿11,430 · TC-SERIES-05 ฿4,800 → ฿4,900 · TC-OWNER-01 วันหยุด พ.ย. 09:00 ฿1,200 → ฿1,300 · rules-check 3 ข้อ · check-testdata + `docs/TEST-DATA.md` E76/E77) · session เดิมแนะนำ "อนุมัติ" (หลักคิด: จองประจำคร่อม 1 พ.ย. คิดตามวันเตะแต่ละนัดแล้วลด 10%) · อนุมัติแล้ว: แก้ไฟล์ตามแถว (ห้ามเปลี่ยนตัวเลขอื่น) → รัน test ที่เกี่ยว → ทำเครื่องหมาย ✅ ในแถว → commit `CR-05-oracle:` → อัปเดต REGISTER แถว CR-05
2. ~~`CLAUDE.md` ยังไม่ commit~~ ✅ ผู้ใช้ commit + push เองแล้ว (`9317bb8`) · หมายเหตุ: AI commit `CLAUDE.md` / แก้ `.claude/settings.json` เองไม่ได้ (ตัวกันความปลอดภัย) → ให้ผู้ใช้ทำ
3. **CR-06** (ถ้าโควตาพอ): เงินจากทีมรับคำท้าไม่ขึ้นในรายงาน · หนังสือ `CHANGE-REQUESTS/CR-06.md` · คำตอบร้านมีแล้วใน `CHANGE-REQUESTS/answers/README.md` หัวข้อ CR-06 · ทำตาม `legacy/CR-PROMPT.md` (ต้องมี migration 009 เติมแถว payments ย้อนหลัง · รันซ้ำได้ ถอยกลับได้)
4. **D-8 (PLAN.md แถว L6–L7):** regression เต็ม 3 เบราว์เซอร์ → `legacy/REGRESSION-REPORT.md` · REA เทียบก่อน/หลัง (tag `v2-handover` vs HEAD) · `TRACEABILITY.md` CR → BR → TC · `RELEASE-NOTES.md` ภาษาคน (รวมเรื่องที่ยังไม่แก้: บอทยังไม่จำบริบทตอน "จองเลย" · CR-06 ถ้าไม่ได้ทำ · DB role เว็บเป็น superuser · seam/clock ตอนขึ้นจริงต้องลบแถว `app_settings.clock` · คำถามร้านที่ค้างใน impact ทุกฉบับ) · `UAT-CHECKLIST.md` ต่อ CR · ซ้อมถอยกลับจริง (backup → down → up ไม่ใช้ `-v`) · `tests/smoke.mjs` อ่านอย่างเดียว
5. **รีวิวโค้ด (ใช้ Opus เท่านั้น):** `/code-review` + `/security-review` บน diff `v2-handover..HEAD` (โฟกัส CR-01 session/revocation, CR-05 migration, แชท) → แก้ข้อที่ยืนยันแล้ว
6. **E ปิดงาน:** ทดสอบรั้ว `.claude/settings.json` ใน session ใหม่ตาม `legacy/FENCE-TEST.md` (ตอนเปิด session ใหม่นี่แหละ) · `docs/RUBRIC-SELF-CHECK.md` ให้คะแนนตัวเอง 4 รูบริก (บท 03, 04, 05, 06 · อ่านเกณฑ์จาก README บท ไม่เปิด `_solution/`) · อัปเดต `README.md` (ยังเป็นตัวเลข v1) · Portal `/project` · ข้อความ LINE ส่งอาจารย์ · 🙋 ถามก่อน push

## 4. วิธีทำงาน (ผู้ใช้กำหนด · โควตาจำกัด)
- **ตัวทำงาน (เขียนโค้ด/test/CR/เอกสาร) = subagent `model: "sonnet"`** · **ตัวรีวิวโค้ด = Opus** · session หลักตรวจผลเอง (รัน test ของ CR นั้น + `node tests/golden/check.mjs` + ดู git status) ก่อน commit/บอกว่าเสร็จ
- prompt ให้ subagent สั้น ชี้ไฟล์แทนอธิบายซ้ำ (เช่น "ทำ CR-06 ตาม `legacy/CR-PROMPT.md`")
- commit ทุกครั้งที่จบชิ้น (กัน limit) · ติด limit → พอ reset ให้สั่ง agent ตัวเดิมทำต่อ (SendMessage) อย่าเริ่มใหม่
- ห้ามรัน test/reset ตอนผู้ใช้กำลังใช้เว็บเอง (reset ลบบัญชีที่สมัครเล่น)

## 5. คำสั่งที่ใช้บ่อย (รายละเอียด `CLAUDE.md`, `docs/RUNBOOK.md`)
- เปิดระบบ: Docker Desktop → `docker compose -f db/compose.yaml up -d` → `docker compose -f web/compose.yaml up -d --build` → `curl localhost:3000/api/version` (ต้อง 008 / mock / bugMode 0)
- reset: `curl -X POST localhost:3000/api/test/reset -H "content-type: application/json" -d "{}"`
- test ไฟล์เดียว: `cd e2e && npx playwright test <file> --project=chromium --no-deps` · ทั้งชุด: `cd e2e && RUN_MIGRATION_TEST=1 node run-all.mjs` (~15 นาที) · ก่อน commit: `git checkout -- e2e/test-report e2e/index.html`
- golden: `node tests/golden/check.mjs`
- แชทโหมด ai (ผ่าน mock-llm ในเครื่อง): `node tools/chat-mode.mjs ai` · กลับ `node tools/chat-mode.mjs mock`

## 6. ห้ามเด็ดขาด
เปิด `web/BUGS.md` · เปิด `.env` หรือพิมพ์ค่าลับ · `docker compose down -v` / ลบ volume `football-pgdata` · `--expect-bugs` · แก้ test เดิม/ค่าที่คาดหวังโดยไม่มีแถว ORACLE-CHANGES ที่ผู้ใช้/lead อนุมัติ · push ไป repo อาจารย์ · แตะไฟล์ `อธิบาย.txt` (ของผู้ใช้)

## 7. ประโยคเริ่มงานสำหรับ session ใหม่
เปิด Claude Code ที่โฟลเดอร์แม่ **`D:\work (outside)\Chanwacnich_TA`** (memory ของงานนี้ผูกกับ path นี้ · เปิด `football-booking` ตรง ๆ จะไม่เห็น memory) แล้วพิมพ์:
> "อ่าน `football-booking/HANDOFF.md` แล้วทำต่อจากข้อ 3 ในโฟลเดอร์ football-booking · ใช้ Sonnet ทำงาน · Opus รีวิว"

ทำงานในโฟลเดอร์ย่อย: ใช้ path เต็ม / `cd football-booking` ในคำสั่ง · subagent ให้ระบุ root `D:\work (outside)\Chanwacnich_TA\football-booking` · รั้ว `.claude/settings.json` ทำงานเฉพาะ session ที่เปิดที่ `football-booking` ตรง ๆ (ใช้ตอนทดสอบรั้วในส่วน E)
