# HANDOFF — ส่งต่องานให้ Claude session/บัญชีใหม่ (อ่านไฟล์นี้ก่อนทำอะไร)

> เขียน 21 ต.ค. 2569 โดย session หลัก (Opus) ก่อนผู้ใช้ย้ายบัญชี Claude · บทสนทนาเดิมไม่ตามมา ไฟล์นี้ + `docs/process/PLAN.md` + `CLAUDE.md` + memory คือความจำทั้งหมด
> ผู้ใช้พูดไทย · ตอบไทย สั้น ชัด · ผู้ใช้ทำหน้าที่ "เจ้าของสนาม" เวลาต้องตอบคำถามร้าน

## 1. งานคืออะไร
งานส่งอาจารย์ (repo อาจารย์ `../Teaching_CWN2026` · **ห้ามแก้ ห้าม push · ห้ามเปิด `_solution/`**): เอาทุกบทที่อาจารย์สอนมาทำระบบจองสนามบอล "ลูกหนัง อารีน่า" ให้เป็น production 1 ตัว (หน้าบ้าน · หลังบ้าน · แชทบอท · คลังของ · จัดการข้อมูลเบื้องหลัง) + test case พร้อมเฉลยผ่าน Playwright MCP · แผนเต็ม `docs/process/PLAN.md` ("แผน v5" ส่วน A–E) · แผนที่บทเรียน → งาน `docs/11-INSTRUCTOR-MAP.md`
push ได้ที่ `https://github.com/punkao/football-booking.git` (origin) เท่านั้น · **ถามผู้ใช้ก่อน push ทุกครั้ง** · ห้ามแตะ `punkao/Final-project-VLM-`

**หลักใหญ่ (ผู้ใช้ย้ำ 21 ต.ค.):** ทุกขั้นต้องยึดสิ่งที่ `Teaching_CWN2026` สอน — สอนอะไร · ให้เทสต์อะไร อย่างไร · ใช้เครื่องมืออะไร อย่างไร — แล้ว **ปรับให้เป็นของสนามบอลเรา** (ไม่ลอกตัวอย่าง petshop/สปา) · **ทำเพิ่มเกินบทเรียนได้ถ้าดีกว่าหรือเหมาะกว่า** โดยเขียนเหตุผลสั้น ๆ ว่าทำไม · ก่อนทำแต่ละขั้นให้เปิด README/LAB ของบทที่เกี่ยวข้องอ่านก่อน (ห้าม `_solution/`) · ตอนปิดงานตรวจครบทั้ง repo (00_tester 01–06 · 00_setup 04.1/04.2/05 · 01 Loop/Graph/Dynamic · 02 MCP · 03 Jev) แล้วอัปเดต `docs/11-INSTRUCTOR-MAP.md` + ระบุช่องว่างตรง ๆ

## 2. เสร็จแล้ว
| ส่วน | ผล | หลักฐาน |
|---|---|---|
| A ฟังร้าน | สัมภาษณ์ 2 รอบ · คำตอบร้าน A-01–A-50 · US 52 · FR 48 · BR 45 · NFR 24 · TEST-DATA | `docs/01`–`07`, `docs/TEST-DATA.md` |
| B สร้างเว็บ v2 | Next.js + PostgreSQL (Docker แยก db/web) · แชทบอท mock/ai · รีวิว G4/G5 แก้ 12 ข้อ | `web/`, `db/`, `docs/RUNBOOK.md` |
| C ทดสอบแบบอาจารย์ | TEST-CASES 128 ข้อ + เฉลย · MCP รัน 88 ข้อ · e2e 3 เบราว์เซอร์ · `e2e/index.html` · GIF/MP4 · BUG-HUNT จับบั๊กปริศนา 3/3 | `docs/TEST-CASES.md`, `docs/TEST-RUN-MCP.md`, `docs/BUG-HUNT.md` |
| D รับช่วง (บท 05–06) | HANDOVER-CHECK · SYSTEM-MAP · REA (image `rea-lab:6.4.0` build แล้ว) · golden master · mutant 3/3 · known-issue lock | `legacy/`, `tests/golden/`, `CLAUDE.md` |
| D CR-01…05 | ทุกฉบับ: คำถาม → ของเดิม file:line → impact → commit แดง → commit แก้ → regression | `docs/handover/CHANGE-REQUESTS/`, `docs/impact/CR-0N.md`, `ORACLE-CHANGES.md` |

คะแนน e2e: เริ่มส่วน D 117/128 → หลัง CR-04 **127/128 ทุกเบราว์เซอร์** (เหลือ SERIES-04 ข้ามตามแผน) · schemaVersion **009**

**อัปเดต 21 ต.ค. (session ใหม่):** ข้อ 1 ✅ ผู้ใช้อนุมัติ oracle CR-05 → `ea1c180` · ข้อ 3 ✅ CR-06 red `b119c1e` · fix `ac96761` · REGISTER `f845625` (migration 009 `payments.challenge_id` · regression 3 เบราว์เซอร์ 0 ล้ม · golden ไม่เปลี่ยน) · คำถามค้าง CR-06 Q4/Q6/Q7/Q9 ร้านมอบให้ทีมตัดสิน → `docs/impact/CR-06.md` 1.3 (Q7 = หน้าลูกค้าเห็นเฉพาะเงินตัวเอง · หลังบ้านมีป้าย "จากทีมรับคำท้า") red `9c7b4da` · fix `6ed7ec4` · กระทบยอดหลัง deploy `tools/reconcile-challenges.sql` (ต้องได้ 0 ทั้งคู่) · `009.down` ลบแถวเงินคำท้าทุกแถว (รวมที่เว็บใหม่เขียน) ขึ้นใหม่เติมกลับจากเครดิต → ใส่ใน RELEASE-NOTES · ข้อ 4 ✅ D-8 `c31a592` (REGRESSION-REPORT 2 รอบ · REA-COMPARE · ซ้อมถอยกลับ 009→006→009 ใน RUNBOOK ข้อ 9 · `tests/smoke.mjs`) + TRACEABILITY / UAT-CHECKLIST / RELEASE-NOTES · Q13 CR-05 ร้านมอบทีมตัดสิน: คง ศ–ส (หนังสือเขียน ศ–อา · impact CR-05 1.3 · ร้านยืนยันตอนเซ็น UAT) · `docs/04-REQUIREMENTS.md` ยังไม่อัปเดตตาม CR (ร่าง BR-46–51 ใน TRACEABILITY ข้อ 3) · UAT ยังไม่ได้เดินมือบนเว็บ · ข้อ 5 ✅ Opus รีวิว v2-handover..HEAD (โค้ด+ความปลอดภัย): แก้ 2 ข้อ REVIEW-1 `e7893ad` หน้าแรกอ่านราคาจาก DB · REVIEW-2 `ef8e0d3` ด่านกัน make-prod-like-data รันบนฐานจริง · ข้อสังเกตไม่แก้: ประวัติการจองโชว์ชื่อพนักงานตาม username ปัจจุบัน (ถ้า username ถูกใช้ซ้ำหลังลบบัญชี ชื่อจะผิด) → ใส่ RELEASE-NOTES ตอนข้อ 6 · REVIEW-1 commit `CLAUDE.md` 1 บรรทัด (กับดักราคา) โดย subagent · e2e flaky firefox TC-BOOK-01 / perf TC-BOOK-02 (rerun ผ่าน) · ข้อ 6 ส่วนใหญ่ ✅ README + Portal ส่วนส่งมอบ `1818a98` · RUBRIC 74.5/80 + INSTRUCTOR-MAP `1ed8db2` · รายงาน e2e รอบสุดท้าย 389/390 `fdb5673` · Portal testcases เคยโชว์ 0 TC แก้แล้ว `f96bf74` · ข้อความ LINE `docs/LINE-TO-INSTRUCTOR.md` · **ค้าง:** ทดสอบรั้วใน session ใหม่ที่ `football-booking` (legacy/FENCE-TEST.md) · ผู้ใช้ลบกฎ `Write(...)` 4 บรรทัดใน `.claude/settings.json` · 🙋 push · หมายเหตุ: `web/BUGS.md` อยู่ใน origin แล้วตั้งแต่ `f8f2395`

## 3. ค้างอยู่ตรงไหน — สถานะ: ผู้ใช้สั่ง **ส่ง main ตอนนี้** (main = ส่งได้) · HEAD ตรวจรอบเต็มที่ `733d0a7`

**ข้อ 1–6 เดิม + งานตรวจความสมบูรณ์/ช่องว่าง + งาน 4 (คำสั่งเดียว, `fd0e78d`, RUNBOOK ข้อ 10) เสร็จหมด** — ประวัติละเอียดดู `git log` และ `legacy/REGRESSION-REPORT.md` §3.2

**ผลรอบเต็มสุดท้ายบน main (commit `733d0a7` · `e2e/test-report/` + `e2e/index.html`):** 491 ผ่าน · 2 ล้ม (webkit `TC-BOOK-01`, `TC-STAFF-06` — flaky ที่รู้ รันซ้ำผ่าน) · index: chromium 128/128 (P1 74/74) ✅ · firefox 128/128 ✅ · webkit 126/128 ❌ (2 ข้อนั้น) · TC-SERIES-04 พิสูจน์ด้วย unit E75 · unit 159/159 · smoke 10/10 · axe serious/critical 0 ทุกหน้าหลัก · testid 904 คงเดิม

### 3.1 งาน 2 UX/UI — หยุดหลัง S2b ตามที่ผู้ใช้เลือก
- **อยู่บน main แล้ว:** S0 (testid snapshot + axe baseline) · S1 (ระบบสี night/turf/flood/mist, contrast serious 32→0, ปุ่ม/ฟอร์ม/โฟกัส, หัวเว็บแถวเดียว + ปุ่มเมนูบนมือถือ) · S2 (แชทแผงข้างเต็มสูง/เต็มจอมือถือ, ป้ายบอท, ชิปคำถามด่วน 4 ปุ่ม, การ์ดราคาแบบตั๋ว, คีย์บอร์ด/Esc) · S2b (ปุ่มแชทย้ายเข้าหัวเว็บ ไม่ทับเนื้อหา, "รอบว่างวันนี้" ตอบเป็นการ์ดจาก `availability()` ตัวเดียวกับเว็บ)
- **ไม่ได้ส่ง (จอดที่ branch `ui-final`):** S3 หน้าลูกค้า (แผงรอบว่างหน้าแรก, ตัวบอกขั้นจอง 4 ขั้น, ตั๋วที่ /booking /pay, แถบจ่ายติดล่าง) + S4 หลังบ้าน (เมนูข้าง, แดชบอร์ดใหม่, โซนอันตราย) — spec รับงานผ่าน 36/36 แต่รอบเต็มยังเหลือ 4 จุด: (1) เทสต์ใหม่จองชนกับเทสต์เดิม (2) keyboard บน webkit (3) แถบจ่ายติดล่างที่ 375 (4) login หลัง logout — commit `65a3f49` แก้ไว้แล้วแต่**ยังไม่ได้ตรวจ** · branch ต้นทาง: `ui-s3-wip`, `ui-s4`
- **ทำต่อ (ถ้าผู้ใช้ต้องการ):** `git checkout ui-final` → อ่าน message ของ `65a3f49` + `docs/ui/PROGRESS.md` → ตรวจ 4 จุดที่ `65a3f49` แก้ไว้ → รันชุดเต็ม 3 เบราว์เซอร์ + testid compare + axe → S5 (ภาพ after, review) → merge เข้า main · ไม่ทำก็ได้ main ส่งได้อยู่แล้ว (อาจารย์ตรวจการใช้บทเรียน ส่วนหน้าตาเป็นของเพิ่ม)
- **งาน 3 (จัดไฟล์ + README ใหม่): ยังไม่เริ่ม**

### 3.2 ที่ผู้ใช้ต้องทำเอง 🙋
1. `CLAUDE.md` 2 บรรทัด (ผู้ใช้แก้เอง · AI แก้ไม่ได้): กับดัก "mock อ่านข้อความล่าสุดข้อความเดียว (`mock.ts:244-258`)" ไม่จริงแล้วหลัง CR-04 · กับดัก "ปิด seam แล้วยังอ่านแถว `app_settings.clock`" ไม่จริงแล้วหลัง K3 (`0864208`)
2. ทดสอบรั้ว `.claude/settings.json` ในเซสชันใหม่ที่ `football-booking` (`legacy/FENCE-TEST.md`) แล้วลบกฎ `Write(...)` 4 บรรทัด
3. `claude /login` แล้วรัน `node tools/mcp-football/run-claude.mjs` (ด่าน MCP C3 ที่ติด 401)
4. พิจารณาเปลี่ยนรหัสผ่าน DB (หมุนรหัส)
5. ร้านเดิน `docs/handover/UAT-CHECKLIST.md` แล้วเซ็นลายเซ็น (UAT)
6. `web/BUGS.md` อยู่ใน git/origin ตั้งแต่ commit แรก — ผู้ใช้ตัดสินแล้ว (22 ต.ค.) ว่าไม่ต้องทำอะไร · คนเติม SYSTEM-MAP ส่วน N.2

### 3.3 สถานะ push
push ล่าสุดถึง `fd0e78d` (งาน 4) · หลังจากนั้นมี commit ในเครื่องรอ push (งาน 2 S0–S2b + รายงาน e2e `733d0a7` + เอกสารปิดงาน) — ตรวจ `git status -sb` ก่อนยืนยัน · push ได้เฉพาะ `origin` (`punkao/football-booking`) และ **ต้องถามผู้ใช้ก่อนทุกครั้ง**

## 4. วิธีทำงาน (ผู้ใช้กำหนด · โควตาจำกัด)
- **ตัวทำงาน (เขียนโค้ด/test/CR/เอกสาร) = subagent `model: "sonnet"`** · **ตัวรีวิวโค้ด = Opus** · session หลักตรวจผลเอง (รัน test ของ CR นั้น + `node tests/golden/check.mjs` + ดู git status) ก่อน commit/บอกว่าเสร็จ
- prompt ให้ subagent สั้น ชี้ไฟล์แทนอธิบายซ้ำ (เช่น "ทำ CR-06 ตาม `legacy/CR-PROMPT.md`")
- commit ทุกครั้งที่จบชิ้น (กัน limit) · ติด limit → พอ reset ให้สั่ง agent ตัวเดิมทำต่อ (SendMessage) อย่าเริ่มใหม่
- ห้ามรัน test/reset ตอนผู้ใช้กำลังใช้เว็บเอง (reset ลบบัญชีที่สมัครเล่น)

## 5. คำสั่งที่ใช้บ่อย (รายละเอียด `CLAUDE.md`, `docs/RUNBOOK.md`)
- เปิดระบบ: Docker Desktop → `docker compose -f db/compose.yaml up -d` → `docker compose -f web/compose.yaml up -d --build` → `curl localhost:3000/api/version` (ต้อง 009 / mock / bugMode 0)
- reset: `curl -X POST localhost:3000/api/test/reset -H "content-type: application/json" -d "{}"`
- test ไฟล์เดียว: `cd e2e && npx playwright test <file> --project=chromium --no-deps` · ทั้งชุด: `cd e2e && RUN_MIGRATION_TEST=1 node run-all.mjs` (~15 นาที) · รอบเต็มจบแล้ว `run-all.mjs` สร้าง `unit-proof.json` + `e2e/index.html` ให้เอง (รอบเต็มที่ต้องการเก็บ = commit ไฟล์เหล่านั้น · รอบทดลอง/รันซ้ำข้อเดียวเขียนทับ `results.json` → สำรองก่อน หรือ `git checkout -- e2e/test-report e2e/index.html` · อย่าลืมคืน `docs/evidence/screenshots/uat` กับ `web/selfcheck/screens` ที่ถูกเขียนทับด้วย `git checkout --`)
- golden: `node tests/golden/check.mjs`
- แชทโหมด ai (ผ่าน mock-llm ในเครื่อง): `node tools/chat-mode.mjs ai` · กลับ `node tools/chat-mode.mjs mock`

## 6. ห้ามเด็ดขาด
เปิด `web/BUGS.md` · เปิด `.env` หรือพิมพ์ค่าลับ · `docker compose down -v` / ลบ volume `football-pgdata` · `--expect-bugs` · แก้ test เดิม/ค่าที่คาดหวังโดยไม่มีแถว ORACLE-CHANGES ที่ผู้ใช้/lead อนุมัติ · push ไป repo อาจารย์ · แตะไฟล์ `อธิบาย.txt` (ของผู้ใช้)

## 7. ประโยคเริ่มงานสำหรับ session ใหม่
เปิด Claude Code ที่โฟลเดอร์แม่ **`D:\work (outside)\Chanwacnich_TA`** (memory ของงานนี้ผูกกับ path นี้ · เปิด `football-booking` ตรง ๆ จะไม่เห็น memory) แล้วพิมพ์:
> "อ่าน `football-booking/docs/process/HANDOFF.md` แล้วทำต่อจากข้อ 3 ในโฟลเดอร์ football-booking · ใช้ Sonnet ทำงาน · Opus รีวิว"

ทำงานในโฟลเดอร์ย่อย: ใช้ path เต็ม / `cd football-booking` ในคำสั่ง · subagent ให้ระบุ root `D:\work (outside)\Chanwacnich_TA\football-booking` · รั้ว `.claude/settings.json` ทำงานเฉพาะ session ที่เปิดที่ `football-booking` ตรง ๆ (ใช้ตอนทดสอบรั้วในส่วน E)
