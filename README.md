# ลูกหนัง อารีน่า — ระบบจองสนามฟุตบอลหญ้าเทียม (Requirement → Web → Playwright)

งานฝึกตามบทเรียน [`Teaching_CWN2026`](https://github.com/Tuchsanai/Teaching_CWN2026) (00_tester · 01_Basic_AI_WORFLOW · 02_MCP):
**ฟังความต้องการลูกค้า → เขียน requirement → ให้ AI สร้างเว็บ → พิสูจน์ด้วย Playwright ว่าทุก feature ทำงานจริง → จับบั๊กที่ฝังไว้ได้**

## ผลลัพธ์

| รายการ | ผล |
|---|---|
| ความต้องการ | User Story 34 · FR 31 · BR 28 (ทุกข้อมีค่าขอบที่ต้องทดสอบ) · NFR 14 |
| เว็บ | Next.js 16 + PostgreSQL 16 · Docker 2 container · หน้าลูกค้า / พนักงาน / ผู้จัดการ / เจ้าของ · TH/EN · มือถือ 375 px |
| Test case | 60 ข้อ (P1 37 · P2 19 · P3 4) · ทุก FR/BR มี test อย่างน้อย 1 ข้อ |
| ผลรัน (`BUG_MODE=0`) | **153/153 ผ่าน (100%) · P1 ล้ม 0 · ผ่านเกณฑ์** บน Chromium, Firefox, WebKit · มี GIF + MP4 ทุก test ที่เปิดหน้าเว็บ |
| บั๊กที่ฝัง (`BUG_MODE=1`) | **จับได้ 3/3** โดยผู้เขียน test ไม่เห็นเฉลย · ไม่มีผลบวกลวง |
| บั๊กจริงที่พบและแก้ | เงินผิด (P1) เจ้าของยกเลิกหลังทีมคู่แข่งจ่ายแล้ว ได้เครดิต ฿2,700 จากที่จ่าย ฿1,800 → แก้แล้ว · ชื่อผู้จอง · คำระดับทีม · และ regression ที่เกิดตอนแก้ (ชุด test เดิมจับได้) |

สรุปผลทดสอบทุกรอบ: [`docs/10-TEST-REPORT.md`](docs/10-TEST-REPORT.md)

## อ่านอะไรก่อน (ไม่ต้องรันอะไร)

| ลำดับ | ไฟล์ | คืออะไร |
|---|---|---|
| 1 | [`docs/01-INTERVIEW.md`](docs/01-INTERVIEW.md) | บทสัมภาษณ์ร้าน + คำตอบร้าน A-01–A-28 (ทุกกฎมีที่มา) |
| 2 | [`docs/04-REQUIREMENTS.md`](docs/04-REQUIREMENTS.md) | **แหล่งความจริงเดียว** FR / BR + ค่าขอบ / NFR / contract |
| 3 | [`docs/09-TEST-PLAN.md`](docs/09-TEST-PLAN.md) | 60 test case + traceability |
| 4 | [`e2e/test-report/TEST-REPORT.md`](e2e/test-report/TEST-REPORT.md) | ผลราย test ทุกเบราว์เซอร์ พร้อมลิงก์ GIF/MP4 |
| 5 | [`docs/10-TEST-REPORT.md`](docs/10-TEST-REPORT.md) | ก่อน/หลังแก้ + BUG_MODE เทียบเฉลย |
| 6 | [`docs/trace/`](docs/trace) | บันทึกกระบวนการ: Loop (เฟส 2, 7.5), Graph (เฟส 3), การทำงานของ subagent |

เอกสารทั้งหมด: [`docs/`](docs) — 02 BA · 03 User Story · 05 SRS · 06 SA (Use case, ERD, Sequence, State, Activity) · 07 SAD · 08 BUILD-PROMPT · 05b การสำรวจเว็บด้วย Playwright MCP

## รันเว็บ (ต้องมี Docker Desktop)

```bash
cd web
docker compose up -d --build
```

เปิด <http://localhost:3000> · **หน้า Portal สำหรับตรวจงาน: <http://localhost:3000/project>** (ภาพรวม, เอกสาร + แผนภาพ, test case พร้อมผลและ GIF, traceability, รายงาน)
บัญชีทดลอง (เจ้าของ / ผู้จัดการ / พนักงาน / ลูกค้า) อยู่ในส่วน seed ของ [`web/SPEC.md`](web/SPEC.md) — เป็นข้อมูลทดลองในเครื่องเท่านั้น

โหมดฝังบั๊ก: `BUG_MODE=1 docker compose up -d` (PowerShell: `$env:BUG_MODE=1; docker compose up -d`) · กลับโหมดปกติ: `docker compose up -d` · เฉลยอยู่ที่ [`web/BUGS.md`](web/BUGS.md)

## รัน test (ต้องมี Node.js 20+ และเปิดเว็บไว้แล้ว)

```bash
cd e2e
npm install
npm run browsers
npm test
```

- `npm test` รัน 3 เบราว์เซอร์ → test ที่เลื่อนเวลาระบบ (serial) → test ความเร็ว NFR-08 แบบรันเดี่ยว · ใช้เวลาประมาณ 4 นาที · เขียน `e2e/test-report/TEST-REPORT.md`
- `npm run test:gif` อัด GIF + MP4 (ต้องมี `ffmpeg` ใน PATH)
- test reset ข้อมูลและล็อกเวลาของเว็บเอง (`/api/test/reset`) จึงรันซ้ำได้ผลเหมือนเดิม

## วิธีทำงาน (ตามบทเรียน)

| เฟส | ทำอะไร | บทเรียน |
|---|---|---|
| 0 | เตรียมเครื่อง + Playwright MCP | 02_MCP |
| 1–2 | สัมภาษณ์ → BA → User Story (Loop: สร้าง ↔ ตรวจ จนผ่านเกณฑ์) | 00_tester, 01 Loop |
| 3 | REQUIREMENTS → SRS / SA / SAD (Graph: แตกงานขนาน → รวม → ตรวจ) | 01 Graph |
| 4 | BUILD-PROMPT → AI สร้างเว็บ (subagent แยก ไม่เห็นบทสนทนา) | 00_tester |
| 5 | AI ใช้เว็บเหมือนลูกค้าจริงผ่าน Playwright MCP | 02_MCP |
| 6–7 | tester อิสระ (subagent แยก ห้ามเห็นโค้ดและเฉลย) เขียน TEST-PLAN + e2e | 00_tester |
| 7.5 | ผู้สร้างแก้ตาม requirement ↔ ชุด test เดิมตรวจซ้ำโดยไม่แก้ test (Loop) | 01 Loop |
| 8 | `BUG_MODE=1` → เทียบเฉลย | 00_tester |

แผนและสถานะทุกเฟส: [`PLAN.md`](PLAN.md) · สภาพเครื่องและปัญหาที่แก้: [`docs/00-ENVIRONMENT.md`](docs/00-ENVIRONMENT.md)

**การใช้ AI:** งานนี้ทำร่วมกับ Claude Code ทั้งหมด — เอกสาร เว็บ และ test สร้างโดย AI ตามแนวทางของบทเรียน ผู้ทำเป็นคนตัดสินใจแทน "ร้าน" (ตอบคำถามความต้องการ A-01–A-28) และตรวจผล ทุก prompt ที่ใช้สั่ง subagent อยู่ใน `docs/08*-PROMPT.md` และ `docs/09*-PROMPT.md`

## ที่ยังไม่ได้ทำ / ข้อจำกัด

- เฟส 9 (Change Request ด้วย Dynamic workflow) ยังไม่ได้ทำ
- TC-SERIES-04 (ปัดเศษส่วนลดจองประจำ) ทดสอบผ่านหน้าเว็บไม่ได้ เพราะราคาจริงหาร 10 ลงตัวทุกกรณี — ครอบคลุมด้วย unit test ของเว็บ
- test บางข้อ flaky ตอนเครื่องโหลดหนัก (รันเดี่ยวผ่าน) — รายการใน `docs/10-TEST-REPORT.md` ส่วนที่ 4
- `tools/` (bridge ของ Playwright MCP) ตั้งค่าไว้สำหรับเครื่อง Windows ที่ใช้ทำงาน (`D:/ms-playwright`)

## โครงสร้าง

```text
football-booking/
├─ README.md · PLAN.md · .mcp.json
├─ docs/          เอกสาร 00–10 + diagrams/ + trace/ (บันทึกกระบวนการ)
├─ web/           เว็บ Next.js + PostgreSQL (docker-compose.yml, SPEC.md, BUGS.md, selfcheck/)
├─ e2e/           Playwright Test (tests/, test-report/ = รายงาน + GIF + MP4)
├─ tools/         Playwright MCP bridge/client + ตัว render Mermaid + สคริปต์ตรวจเอกสาร
└─ screenshots/   หลักฐานตอน AI สำรวจเว็บผ่าน MCP
```
