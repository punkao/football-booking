# ลูกหนัง อารีน่า — ระบบจองสนามฟุตบอลหญ้าเทียม (Requirement → Web → Playwright → รับมอบและดูแลต่อ)

งานฝึกตามบทเรียน [`Teaching_CWN2026`](https://github.com/Tuchsanai/Teaching_CWN2026) (00_tester · 01_Basic_AI_WORFLOW · 02_MCP · 03_Jev): ฟังความต้องการร้านสนาม 3 สนาม (A, B 5 คน · C 7 คน มีหลังคา) → เขียน requirement → ให้ AI สร้างเว็บ → พิสูจน์ด้วย Playwright ว่าทุก feature ทำงานจริง → รับมอบระบบเป็น "ทีมดูแลระบบรายใหม่" แล้วทำคำขอเปลี่ยนแปลง CR-01…06 โดยมีเทสต์ล็อกของเดิม

## ระบบนี้คืออะไร

- **เว็บ:** Next.js 16 + TypeScript · หน้าลูกค้า (จอง ชำระมัดจำ ยกเลิก เครดิต จองประจำ ทีม/คำท้า สมาชิก) · หลังบ้าน (พนักงาน / ผู้จัดการ / เจ้าของ: เช็กอิน รายงาน คลังของ บันทึกการกระทำ) · แชทบอท "น้องบอล" (โหมด `mock` ไม่ออก network หรือ `ai`) · TH/EN · มือถือ 375 px
- **ฐานข้อมูล:** PostgreSQL 16 แยก Docker คนละโปรเจกต์ (`db/` กับ `web/`) · schema **009** (`db/migrations/001–009` มีไฟล์ถอยกลับ `.down.sql` ทุกฉบับ)
- **Portal ตรวจงาน:** <http://localhost:3000/project> — ภาพรวม เอกสาร + แผนภาพ test case พร้อมผลและ GIF traceability รายงาน และส่วน "ส่งมอบ CR-01…06"
- **หน้าตาใหม่ (งาน UX/UI):** บน `main` มีระบบสีใหม่ (night/turf/flood/mist ตัดกันผ่าน AA — axe serious 32 → 0) · ปุ่ม/ฟอร์ม/โฟกัส · หัวเว็บแถวเดียว + ปุ่มเมนูบนมือถือ · แชทเป็นแผงข้างเต็มสูง (เต็มจอบนมือถือ) มีป้ายบอท คำถามด่วน 4 ปุ่ม การ์ดราคาแบบตั๋ว · ปุ่มแชทอยู่ในหัวเว็บ ไม่ทับเนื้อหา · ถาม "รอบว่างวันนี้" ได้การ์ดรอบว่างจาก `availability()` ตัวเดียวกับเว็บ · **ยังไม่รวมเข้า main:** หน้าลูกค้าแบบใหม่ (S3) และหลังบ้านแบบใหม่ (S4) จอดไว้ที่ branch `ui-final` ([`docs/ui/PROGRESS.md`](docs/ui/PROGRESS.md))
- **MCP server ของสนาม:** [`tools/mcp-football/`](tools/mcp-football) — tool `check_availability` · `quote` · `book` (ต้องยืนยัน + เฉพาะ localhost) + resource ราคา ให้ AI เรียกระบบจองผ่านมาตรฐาน MCP · ทดสอบ 13/13 · รายงาน [`docs/mcp/MCP-REPORT.md`](docs/mcp/MCP-REPORT.md) (ด่าน `claude -p` เรียก tool จริงยังติดล็อกอินหมดอายุ 401)
- **ความต้องการ:** User Story 52 · FR 48 · BR 51 · NFR 24 ([`docs/04-REQUIREMENTS.md`](docs/04-REQUIREMENTS.md) = แหล่งความจริงเดียว) · test case 128 ข้อพร้อมเฉลย ([`docs/TEST-CASES.md`](docs/TEST-CASES.md))

## รันเว็บ (ต้องมี Docker Desktop)

**คำสั่งเดียว:** `docker compose up -d --build` (หรือ `.\start.ps1` บน Windows / `./start.sh` บน mac, Linux, Git Bash — รอ healthy แล้วพิมพ์ URL ให้) · รายละเอียด [`docs/RUNBOOK.md`](docs/RUNBOOK.md) ข้อ 10 · ขั้นตอนเต็ม สำรอง/กู้คืน migration ถอยกลับ: RUNBOOK ข้ออื่น

แบบแยก 2 โปรเจกต์ (db กับ web) ใช้ต่อได้:

```bash
cp db/.env.example db/.env       # ตั้ง POSTGRES_PASSWORD
cp web/.env.example web/.env     # DATABASE_URL ใช้รหัสผ่านเดียวกัน · SESSION_SECRET ≥ 32 ตัว · ALLOW_TEST_RESET=1 เฉพาะเครื่องทดสอบ
docker compose -f db/compose.yaml up -d            # football-db ก่อน (สร้าง network + volume football-pgdata)
docker compose -f web/compose.yaml up -d --build   # แล้วค่อย football-web
curl http://localhost:3000/api/version             # ต้องได้ schemaVersion "009" · bugMode 0 · chatMode mock
```

**ห้ามใช้ `down -v`** (ลบข้อมูลทั้งหมด) · บัญชีทดลองอยู่ใน [`web/SPEC.md`](web/SPEC.md) (ข้อมูลทดลองในเครื่องเท่านั้น) · ตรวจเว็บแบบอ่านอย่างเดียว: `node tests/smoke.mjs`

## รัน test (ต้องมี Node.js 20+ และเปิดเว็บไว้แล้ว)

```bash
cd e2e && npm install && npm run browsers
node run-all.mjs                                   # 3 เบราว์เซอร์ + serial + perf ราว 11 นาที · จบแล้วสร้าง e2e/test-report/unit-proof.json + e2e/index.html ให้เอง
node ../tests/golden/check.mjs                     # golden master (ต่าง = exit 1)
cd ../web && npm test                              # unit
```

test เดิมห้ามแก้ — ถ้าค่าที่คาดหวังต้องเปลี่ยนตาม CR ต้องมีแถวใน [`ORACLE-CHANGES.md`](ORACLE-CHANGES.md) พร้อมผู้อนุมัติ · กติกาทีมดูแลระบบอยู่ใน [`CLAUDE.md`](CLAUDE.md)

## ส่วนส่งมอบ (D): คำขอเปลี่ยนแปลง CR-01…06

ทุกฉบับทำตามลำดับ: ถามร้าน → อธิบายของเดิมพร้อม `file:line` ([`docs/impact/`](docs/impact)) → commit เทสต์แดง → commit แก้ → regression ทะเบียนและ commit ของแต่ละฉบับ: [`CHANGE-REQUESTS/REGISTER.md`](CHANGE-REQUESTS/REGISTER.md)

| CR | เรื่อง | สถานะ (ตาม REGISTER) | migration |
|---|---|---|---|
| [CR-01](CHANGE-REQUESTS/CR-01.md) | ออกจากระบบแล้วต้องใช้ต่อไม่ได้จริง | ทดสอบผ่าน | 007 |
| [CR-02](CHANGE-REQUESTS/CR-02.md) | แก้ 5 จุดตามคำตอบร้าน (เช็กอินเฉพาะวันเตะ · ประวัติ · ขั้น "จบ" · ช่วงรายงาน · ค้นการจอง) | ทดสอบผ่าน | – |
| [CR-03](CHANGE-REQUESTS/CR-03.md) | รายงานแยกพร้อมเพย์/หน้าสนาม + ชั่วโมงใช้สนาม | ทดสอบผ่าน | – |
| [CR-04](CHANGE-REQUESTS/CR-04.md) | น้องบอลจำเรื่องที่คุยไปแล้ว | ทดสอบผ่าน | – |
| [CR-05](CHANGE-REQUESTS/CR-05.md) | ปรับราคาเย็นสนาม 5 คนเป็น ฿1,300 มีผลรอบเตะตั้งแต่ 1 พ.ย. 2569 | ทดสอบผ่าน | 008 |
| [CR-06](CHANGE-REQUESTS/CR-06.md) | เงินจากทีมรับคำท้าขึ้นรายงาน | ทดสอบผ่าน | 009 |

ทั้ง 6 ฉบับ "ทดสอบผ่าน" แล้ว แต่ **ยังรอตรวจรับ (UAT) จากร้าน** — ทีมเดินใบตรวจรับบนเว็บจริงแล้ว 2026-10-21 ([`docs/UAT-RUN.md`](docs/UAT-RUN.md)) แต่ร้านยังไม่ได้เดินเองและยังไม่มีลายเซ็น

| เอกสารส่งมอบ | คืออะไร |
|---|---|
| [`legacy/REGRESSION-REPORT.md`](legacy/REGRESSION-REPORT.md) | ผล regression ตอนส่งมอบ เทียบตอนรับมอบ (รัน 2 รอบ) |
| [`legacy/TRACEABILITY.md`](legacy/TRACEABILITY.md) | CR → คำตอบร้าน → BR → เทสต์ → commit |
| [`RELEASE-NOTES.md`](RELEASE-NOTES.md) | บันทึกส่งมอบภาษาร้าน + เรื่องที่ยังไม่แก้ (K1–K12) + คำถามค้างถึงร้าน |
| [`UAT-CHECKLIST.md`](UAT-CHECKLIST.md) | ใบตรวจรับรายเรื่อง ให้ร้านกดดูเองและลงชื่อ |
| [`legacy/REA-COMPARE.md`](legacy/REA-COMPARE.md) | เทียบระบบ `v2-handover` ↔ HEAD ด้วย REA |
| [`CHANGE-REQUESTS/00-HANDOVER-MEMO.md`](CHANGE-REQUESTS/00-HANDOVER-MEMO.md) | บันทึกรับมอบจากทีมสร้างเว็บ v2 |

### ผลทดสอบล่าสุด (รอบเต็มบนโค้ด `main` commit `733d0a7`, `BUG_MODE=0`, schema 009 — รายงานใน [`e2e/test-report/`](e2e/test-report) และ [`e2e/index.html`](e2e/index.html))

| ชุด | ผล |
|---|---|
| e2e ทั้งรอบ | **491 ผ่าน · 2 ล้ม** (ทั้ง 2 อยู่ใน webkit) |
| ตัดสินของ [`e2e/index.html`](e2e/index.html) (เกณฑ์แผน 6.4: ≥ 122/128 และ P1 74/74) | chromium **128/128 · P1 74/74 ✅** · firefox **128/128 ✅** · webkit **126/128 ❌** |
| ข้อที่ล้ม (webkit เท่านั้น) | `TC-BOOK-01` · `TC-STAFF-06` — **flaky ที่รู้แล้ว** รันซ้ำแล้วผ่าน (ประวัติใน `e2e/triage.json`) · ยังไม่ได้แก้ให้นิ่ง |
| TC-SERIES-04 | พิสูจน์ผ่านหน้าเว็บไม่ได้ → นับผ่านด้วย unit E75 (`e2e/test-report/unit-proof.json`) |
| unit เว็บ · smoke | **159/159** · **10/10** |
| accessibility (axe) | serious/critical **0** ทุกหน้าหลัก |
| testid | 904 ตัว เก็บครบหลังปรับหน้าตา |
| golden master · Portal · MCP · rules-check | 261/261 + 15/15 + 132/132 · 1148/1148 · 13/13 · 191/191 — วัดที่ `a6ca022` ยังไม่ได้วัดซ้ำที่ `733d0a7` ([`legacy/REGRESSION-REPORT.md`](legacy/REGRESSION-REPORT.md) §3.2) |
| schema | **009** |
| คะแนนรูบริก 4 บท ([`docs/RUBRIC-SELF-CHECK.md`](docs/RUBRIC-SELF-CHECK.md)) | **74 / 80** (ตรวจ 22 ต.ค.) |

ยังไม่ได้ทำ / พิสูจน์ไม่ได้: UAT — ทีมเดินบนเว็บจริงแล้ว 2026-10-21 ([`docs/UAT-RUN.md`](docs/UAT-RUN.md)) เหลือร้านเดินเอง+เซ็น · ไม่มีรอบเต็มรอบเดียวที่เขียวทั้ง 3 เบราว์เซอร์ (webkit ล้ม 2 ข้อที่ flaky) · รั้ว `.claude/settings.json` ยังไม่ได้ทดสอบในเซสชันใหม่ · แชทไม่เคยทดสอบกับโมเดลจริง (มีแค่ mock / mock-llm) · คำถามค้างถึงร้าน 25 ข้อ (CR-01 2 · CR-02 7 · CR-03 6 · CR-04 4 · CR-05 6) + CR-06 อีก 5 ข้อที่รอร้านรับทราบ ([`RELEASE-NOTES.md`](RELEASE-NOTES.md) ข้อ 4) · ปัญหาที่ทีมรู้และยังไม่แก้ **12 ข้อ** (K1, K2, K4–K9, K11–K14 ใน [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md); K3 ปิดแล้ว) เช่น แชทไม่จำบริบทตอนพิมพ์ "จองเลย" · role DB ของเว็บเป็น superuser · e2e ไม่ครอบคลุมการเปลี่ยนวันที่จริงหลัง 1 พ.ย.

## ผลของงานรอบสร้างเว็บ (ก่อนรับมอบ)

| รายการ | ผล |
|---|---|
| ทดสอบด้วย Playwright MCP | AI ใช้เว็บจริงตาม test case 88 ข้อ ([`docs/TEST-RUN-MCP.md`](docs/TEST-RUN-MCP.md)) |
| บั๊กที่ฝัง (`BUG_MODE=1`) | จับได้ 3/3 โดยผู้เขียน test ไม่เห็นเฉลย ([`docs/BUG-HUNT.md`](docs/BUG-HUNT.md)) |
| บั๊กจริงที่พบและแก้ | เช่น เงินผิด (P1) เจ้าของยกเลิกหลังทีมคู่แข่งจ่ายแล้ว ได้เครดิตเกินที่จ่าย — แก้แล้ว ชุด test เดิมจับ regression ที่เกิดตอนแก้ได้ ([`docs/10-TEST-REPORT.md`](docs/10-TEST-REPORT.md)) |

## อ่านอะไรก่อน (ไม่ต้องรันอะไร)

| ลำดับ | ไฟล์ | คืออะไร |
|---|---|---|
| 1 | [`docs/04-REQUIREMENTS.md`](docs/04-REQUIREMENTS.md) | แหล่งความจริงเดียว FR / BR + ค่าขอบ / NFR |
| 2 | [`docs/11-INSTRUCTOR-MAP.md`](docs/11-INSTRUCTOR-MAP.md) | แผนที่บทเรียนอาจารย์ → งานนี้ + ช่องว่างที่ระบุตรง ๆ |
| 3 | [`legacy/REGRESSION-REPORT.md`](legacy/REGRESSION-REPORT.md) · [`RELEASE-NOTES.md`](RELEASE-NOTES.md) | สถานะล่าสุดของระบบและเรื่องที่ยังไม่แก้ |
| 4 | [`docs/TEST-CASES.md`](docs/TEST-CASES.md) · [`e2e/test-report/TEST-REPORT.md`](e2e/test-report/TEST-REPORT.md) | test case + เฉลย และผลราย test พร้อมลิงก์ GIF/MP4 |
| 5 | [`docs/01-INTERVIEW.md`](docs/01-INTERVIEW.md) | บทสัมภาษณ์ร้าน + คำตอบร้าน |

เอกสารทั้งหมด: [`docs/`](docs) · แผนทั้งหมด: [`PLAN.md`](PLAN.md) · สถานะล่าสุดของงาน: [`HANDOFF.md`](HANDOFF.md)

**การใช้ AI:** งานนี้ทำร่วมกับ Claude Code — เอกสาร เว็บ และ test สร้างโดย AI ตามแนวทางของบทเรียน ผู้ทำเป็นคนตัดสินใจแทน "ร้าน" และตรวจผล prompt ที่ใช้สั่ง subagent อยู่ใน `docs/08*-PROMPT.md` และ `docs/09*-PROMPT.md`

## โครงสร้าง

```text
football-booking/
├─ README.md · PLAN.md · HANDOFF.md · CLAUDE.md · RELEASE-NOTES.md · UAT-CHECKLIST.md · ORACLE-CHANGES.md
├─ CHANGE-REQUESTS/  หนังสือ CR-01…06 + REGISTER.md + answers/ (คำตอบร้าน)
├─ legacy/        เอกสารทีมดูแลระบบ: SYSTEM-MAP · BASELINE · REGRESSION-REPORT · TRACEABILITY · REA-COMPARE ฯลฯ
├─ docs/          เอกสาร 00–11 + impact/ (วิเคราะห์ผลกระทบ CR) + diagrams/ + trace/
├─ db/            PostgreSQL: compose.yaml, init/ (schema + seed), migrations/001–009
├─ scripts/       migrate.mjs · backup.mjs · restore.mjs
├─ web/           เว็บ Next.js (compose.yaml, SPEC.md, selfcheck/)
├─ e2e/           Playwright Test (tests/ + tests/cr/ ของ CR, test-report/ = รายงาน + GIF + MP4)
├─ tests/         golden master + smoke.mjs
└─ tools/         mcp-football (MCP server ของสนาม) · Playwright MCP bridge/client · make-prod-like-data · reconcile-challenges.sql · ตัว render Mermaid
```
