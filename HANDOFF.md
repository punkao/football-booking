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

**อัปเดต 21 ต.ค. (session ใหม่):** ข้อ 1 ✅ ผู้ใช้อนุมัติ oracle CR-05 → `ea1c180` · ข้อ 3 ✅ CR-06 red `b119c1e` · fix `ac96761` · REGISTER `f845625` (migration 009 `payments.challenge_id` · regression 3 เบราว์เซอร์ 0 ล้ม · golden ไม่เปลี่ยน) · คำถามค้าง CR-06 Q4/Q6/Q7/Q9 ร้านมอบให้ทีมตัดสิน → `docs/impact/CR-06.md` 1.3 (Q7 = หน้าลูกค้าเห็นเฉพาะเงินตัวเอง · หลังบ้านมีป้าย "จากทีมรับคำท้า") red `9c7b4da` · fix `6ed7ec4` · กระทบยอดหลัง deploy `tools/reconcile-challenges.sql` (ต้องได้ 0 ทั้งคู่) · `009.down` ลบแถวเงินคำท้าทุกแถว (รวมที่เว็บใหม่เขียน) ขึ้นใหม่เติมกลับจากเครดิต → ใส่ใน RELEASE-NOTES · ข้อ 4 ✅ D-8 `c31a592` (REGRESSION-REPORT 2 รอบ · REA-COMPARE · ซ้อมถอยกลับ 009→006→009 ใน RUNBOOK ข้อ 9 · `tests/smoke.mjs`) + TRACEABILITY / UAT-CHECKLIST / RELEASE-NOTES · Q13 CR-05 ร้านมอบทีมตัดสิน: คง ศ–ส (หนังสือเขียน ศ–อา · impact CR-05 1.3 · ร้านยืนยันตอนเซ็น UAT) · `docs/04-REQUIREMENTS.md` ยังไม่อัปเดตตาม CR (ร่าง BR-46–51 ใน TRACEABILITY ข้อ 3) · UAT ยังไม่ได้เดินมือบนเว็บ · ข้อ 5 ✅ Opus รีวิว v2-handover..HEAD (โค้ด+ความปลอดภัย): แก้ 2 ข้อ REVIEW-1 `e7893ad` หน้าแรกอ่านราคาจาก DB · REVIEW-2 `ef8e0d3` ด่านกัน make-prod-like-data รันบนฐานจริง · ข้อสังเกตไม่แก้: ประวัติการจองโชว์ชื่อพนักงานตาม username ปัจจุบัน (ถ้า username ถูกใช้ซ้ำหลังลบบัญชี ชื่อจะผิด) → ใส่ RELEASE-NOTES ตอนข้อ 6 · REVIEW-1 commit `CLAUDE.md` 1 บรรทัด (กับดักราคา) โดย subagent · e2e flaky firefox TC-BOOK-01 / perf TC-BOOK-02 (rerun ผ่าน) · ข้อ 6 ส่วนใหญ่ ✅ README + Portal ส่วนส่งมอบ `1818a98` · RUBRIC 74.5/80 + INSTRUCTOR-MAP `1ed8db2` · รายงาน e2e รอบสุดท้าย 389/390 `fdb5673` · Portal testcases เคยโชว์ 0 TC แก้แล้ว `f96bf74` · ข้อความ LINE `docs/LINE-TO-INSTRUCTOR.md` · **ค้าง:** ทดสอบรั้วใน session ใหม่ที่ `football-booking` (legacy/FENCE-TEST.md) · ผู้ใช้ลบกฎ `Write(...)` 4 บรรทัดใน `.claude/settings.json` · 🙋 push · หมายเหตุ: `web/BUGS.md` อยู่ใน origin แล้วตั้งแต่ `f8f2395`

## 3. ค้างอยู่ตรงไหน (ทำต่อตามลำดับ) — สถานะ 22 ต.ค. 2569 · HEAD `a6ca022` + งานที่ยังไม่ commit

**ข้อ 1–6 เดิม (อนุมัติ ORACLE CR-05, CR-06, D-8, รีวิวโค้ด, README/RUBRIC/LINE) เสร็จหมดแล้ว** — ที่ค้างจริงตอนนี้คือรายการข้างล่าง

### 3.1 งานของ `NEXT-TASKS-PROMPT.md` ข้อ 1 (ตรวจความสมบูรณ์ + ปิดช่องว่าง) — เสร็จแล้ว
commit แล้ว (`git log --oneline 1ed8db2..HEAD`): fixture `setCheckedStable` รอ data-ready (ORACLE `6599208`) · TC-SERIES-04 นับผ่านด้วย unit E75 (`e2e/run-unit-proof.mjs` ต้องรันก่อน `build-index.mjs`) · K3 `getNow` ไม่อ่านแถว clock เมื่อปิด seam · id ผิดรูป/รหัสมี NUL → 404 แทน 500 · เทสต์ตาข่ายเสริม `e2e/tests/cr/{stored-amounts,wrong-type-inputs,reschedule-overlap}` · MCP server สนามบอล `tools/mcp-football` + Excalidraw `docs/mcp/` · เอกสาร (ERD, SYSTEM-MAP ป้าย + ส่วน N, KNOWN-ISSUES, IMPACT-TEMPLATE, `docs/trace/dynamic`)

**ยังไม่ commit (เซสชัน 22 ต.ค.) — ให้ lead ตรวจแล้ว commit:**
- `e2e/run-all.mjs` — จบรอบเต็ม (ไม่มี `--gif`/อาร์กิวเมนต์เพิ่ม) รัน `run-unit-proof.mjs` → `build-index.mjs` ให้เอง · คืน `e2e/plan-cases.json` เดิมเสมอ (build-index เขียนใหม่ต่างกันแค่ `generatedAt`) และเตือนถ้าเนื้อหาต่างจริง
- `e2e/build-index.mjs` — ตารางเทสต์ CR นับ RESCH-OVL / STORED / WT เพิ่ม (49 → 64 แถว)
- `e2e/triage.json` — เพิ่ม TC-BOOK-01 · อัปเดต TC-STAFF-06 (จาก "เว็บผิด" เก่า → flaky รอบนี้ ประวัติคงในช่อง note) · TC-PRICE-04 ผ่านครบรอบนี้
- รอบเต็มใหม่: `e2e/test-report/{results.json,run-info.json,TEST-REPORT.md,unit-proof.json,chat/**}` + `e2e/index.html` (ตั้งใจเก็บไว้ ไม่ `git checkout`)
- เอกสาร: `legacy/REGRESSION-REPORT.md` §3.2 · `docs/RUBRIC-SELF-CHECK.md` (ตรวจใหม่ **74/80** จาก 74.5) · `docs/11-INSTRUCTOR-MAP.md` (§1.2 Dynamic · §1.3 MCP · §2 · §5 ช่องว่าง 10 ข้อ) · `README.md` · `docs/LINE-TO-INSTRUCTOR.md` · `docs/09-TEST-PLAN.md` บรรทัดสรุปข้อ 6 (BR-46–51) · `HANDOFF.md`

**ผลรอบเต็ม 22 ต.ค. (HEAD a6ca022 · `legacy/REGRESSION-REPORT.md` §3.2):** chromium 110/0/1 · firefox 110/0/1 · webkit 108/**2**/1 · serial 86/0/1 · perf 3/3 · index: chromium 128/128 ✅ · firefox 128/128 ✅ · **webkit 126/128 ❌ (P1 73/74: TC-BOOK-01 + TC-STAFF-06)** = flaky (รันเดี่ยว 3/3 ผ่านทั้งคู่ + webkit ทั้งโปรเจกต์ 110/0) · golden 261/15/132 · unit 144/144 · Portal 1148/1148 · smoke 10/10 · MCP 13/13

### 3.2 งานถัดไป (ตาม NEXT-TASKS-PROMPT)
1. ~~งาน 4 — รันได้ด้วยคำสั่งเดียว~~ ✅ `fd0e78d` (RUNBOOK ข้อ 10) · **งาน 2 UX/UI กำลังทำ ← ทำต่อจากตรงนี้:** อ่าน `docs/ui/PROGRESS.md` (S0 ✅ `7b1f95f` · S1 ✅ `cdcc848` · ถัดไป S2 แชท → S3 หน้าแรก/จอง → S4 หลังบ้าน → S5 after+e2e 3 เบราว์เซอร์+GIF+review) · แผนที่ผู้ใช้อนุมัติ `docs/UI-REDESIGN.md` · หลัง S5 = งาน 3 (ทำตารางไฟล์แล้วหยุดรอผู้ใช้) · ยังไม่ push ตั้งแต่ `fd0e78d`
2. งาน 2 — ออกแบบ UX/UI ใหม่ (เริ่มด้วยแผน + ร่างให้ผู้ใช้ดูก่อนลงมือ) · งาน 3 — จัดไฟล์ + README ใหม่ (ทำสุดท้าย)
3. ช่องว่างที่ปิดเองได้ถูก ๆ (ดู `docs/RUBRIC-SELF-CHECK.md` ท้ายไฟล์): GIF/MP4 ของเทสต์ใหม่ 3 ไฟล์ (`npm run test:gif` เฉพาะ `tests/cr/` แล้ว `cd e2e && node build-index.mjs`) · ทำให้ webkit flaky นิ่ง (ต้องมีแถว ORACLE-CHANGES: ให้ `expectFree` พิมพ์รหัสการจองที่ชน, fixture รอ data-ready หลังเลือกชั่วโมง) · เทสต์ล็อกคู่ของ K1/K2/K4–K13 · เทสต์จองพร้อมกันสมาชิก+ไม่ล็อกอิน+แชท
4. **🙋 ผู้ใช้ต้องทำเอง:** ทดสอบรั้ว `.claude/settings.json` ในเซสชันใหม่ที่ `football-booking` (`legacy/FENCE-TEST.md`) + ลบกฎ `Write(...)` 4 บรรทัด · ให้ `claude -p` ล็อกอินใหม่ (MCP C3 ติด 401) · คนเติม SYSTEM-MAP ส่วน N.2 · ร้านเดิน `UAT-CHECKLIST.md` + เซ็น · ตัดสินเรื่อง `web/BUGS.md` อยู่ใน git ก่อน push · **ถามก่อน push ทุกครั้ง**

## 4. วิธีทำงาน (ผู้ใช้กำหนด · โควตาจำกัด)
- **ตัวทำงาน (เขียนโค้ด/test/CR/เอกสาร) = subagent `model: "sonnet"`** · **ตัวรีวิวโค้ด = Opus** · session หลักตรวจผลเอง (รัน test ของ CR นั้น + `node tests/golden/check.mjs` + ดู git status) ก่อน commit/บอกว่าเสร็จ
- prompt ให้ subagent สั้น ชี้ไฟล์แทนอธิบายซ้ำ (เช่น "ทำ CR-06 ตาม `legacy/CR-PROMPT.md`")
- commit ทุกครั้งที่จบชิ้น (กัน limit) · ติด limit → พอ reset ให้สั่ง agent ตัวเดิมทำต่อ (SendMessage) อย่าเริ่มใหม่
- ห้ามรัน test/reset ตอนผู้ใช้กำลังใช้เว็บเอง (reset ลบบัญชีที่สมัครเล่น)

## 5. คำสั่งที่ใช้บ่อย (รายละเอียด `CLAUDE.md`, `docs/RUNBOOK.md`)
- เปิดระบบ: Docker Desktop → `docker compose -f db/compose.yaml up -d` → `docker compose -f web/compose.yaml up -d --build` → `curl localhost:3000/api/version` (ต้อง 009 / mock / bugMode 0)
- reset: `curl -X POST localhost:3000/api/test/reset -H "content-type: application/json" -d "{}"`
- test ไฟล์เดียว: `cd e2e && npx playwright test <file> --project=chromium --no-deps` · ทั้งชุด: `cd e2e && RUN_MIGRATION_TEST=1 node run-all.mjs` (~15 นาที) · รอบเต็มจบแล้ว `run-all.mjs` สร้าง `unit-proof.json` + `e2e/index.html` ให้เอง (รอบเต็มที่ต้องการเก็บ = commit ไฟล์เหล่านั้น · รอบทดลอง/รันซ้ำข้อเดียวเขียนทับ `results.json` → สำรองก่อน หรือ `git checkout -- e2e/test-report e2e/index.html` · อย่าลืมคืน `screenshots/uat` กับ `web/selfcheck/screens` ที่ถูกเขียนทับด้วย `git checkout --`)
- golden: `node tests/golden/check.mjs`
- แชทโหมด ai (ผ่าน mock-llm ในเครื่อง): `node tools/chat-mode.mjs ai` · กลับ `node tools/chat-mode.mjs mock`

## 6. ห้ามเด็ดขาด
เปิด `web/BUGS.md` · เปิด `.env` หรือพิมพ์ค่าลับ · `docker compose down -v` / ลบ volume `football-pgdata` · `--expect-bugs` · แก้ test เดิม/ค่าที่คาดหวังโดยไม่มีแถว ORACLE-CHANGES ที่ผู้ใช้/lead อนุมัติ · push ไป repo อาจารย์ · แตะไฟล์ `อธิบาย.txt` (ของผู้ใช้)

## 7. ประโยคเริ่มงานสำหรับ session ใหม่
เปิด Claude Code ที่โฟลเดอร์แม่ **`D:\work (outside)\Chanwacnich_TA`** (memory ของงานนี้ผูกกับ path นี้ · เปิด `football-booking` ตรง ๆ จะไม่เห็น memory) แล้วพิมพ์:
> "อ่าน `football-booking/HANDOFF.md` แล้วทำต่อจากข้อ 3 ในโฟลเดอร์ football-booking · ใช้ Sonnet ทำงาน · Opus รีวิว"

ทำงานในโฟลเดอร์ย่อย: ใช้ path เต็ม / `cd football-booking` ในคำสั่ง · subagent ให้ระบุ root `D:\work (outside)\Chanwacnich_TA\football-booking` · รั้ว `.claude/settings.json` ทำงานเฉพาะ session ที่เปิดที่ `football-booking` ตรง ๆ (ใช้ตอนทดสอบรั้วในส่วน E)
