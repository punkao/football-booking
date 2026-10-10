# PLAN — ระบบจองสนามฟุตบอลหญ้าเทียม (Requirement → Web → Playwright)

โจทย์: ออกแบบ requirement จากความต้องการของลูกค้า → สร้างเว็บที่ใช้งานได้จริง → พิสูจน์ด้วย Playwright ว่าทุก feature ที่ออกแบบทำงานได้จริง
แบบอย่างหลัก: `Teaching_CWN2026/00_tester/03_sabai-spa-from-prompt` (+ แนวคิดจาก `01_Basic_AI_WORFLOW`, `02_MCP`)

## หลักที่ยึดตลอดงาน (ทุกข้อมาจากบทเรียน)

1. ทุก requirement ต้องโยงถึง test และทุก test บอกได้ว่ามาจาก FR/BR ข้อไหน (Traceability)
2. ห้ามแต่งตัวเลข/กฎ — ไม่ชัดให้เขียน "ต้องถาม"
3. ห้ามแก้ test ให้ผ่าน — test ล้ม = เว็บผิด / test ผิด / กฎไม่ชัด (ดู GIF ก่อนตัดสิน)
4. จบทุกเฟสมีหลักฐานเป็นไฟล์ และหยุดให้ผู้ใช้ตรวจก่อนไปต่อ
5. ห้ามอ้างว่า PASS ถ้าไม่ได้รันจริง

## ขอบเขต

- **แกนหลัก:** เฟส 0–8 (+7.5 แก้บั๊กจริง)
- **โบนัส:** เฟส 9–10 ทำเมื่อแกนหลักผ่านเกณฑ์แล้ว

## เครื่องมือ

| งาน | เครื่องมือ |
|---|---|
| AI ทดลองใช้เว็บเหมือนคนจริง (สำรวจ, reproduce บั๊ก) | **Playwright MCP** 0.0.83 (`--isolated`) · แชตนี้ใช้ผ่าน `tools/mcp-bridge.mjs` + `mcp-client.mjs` · เซสชันใหม่ใช้ `.mcp.json` |
| test อัตโนมัติ 3 เบราว์เซอร์ + GIF/MP4 + รายงาน | `@playwright/test` + ffmpeg |
| เว็บ | Next.js (App Router, TS) + PostgreSQL 16 (`pg`, ไม่ใช้ ORM) · docker compose 2 กล่อง |
| แผนภาพ | Mermaid (ต้อง render ได้จริง) |
| วินัยการทำงาน | superpowers (`verification-before-completion`, `systematic-debugging`) |

## การแยกบทบาท (subagent)

| บทบาท | ทำโดย | เห็นข้อมูลอะไร |
|---|---|---|
| BA/SA/ผู้วางแผน | session หลัก | ทุกอย่าง |
| ผู้สร้างเว็บ (เฟส 4) | subagent A (เริ่มจากศูนย์) | `docs/08-BUILD-PROMPT.md` + ไฟล์ที่ BUILD-PROMPT สั่งให้อ่าน (`04`, `06`, `07`) — แบบเดียวกับบทเรียนที่ BUILD-PROMPT สั่งให้อ่าน REQUIREMENTS · ไม่มีรูปให้ (วาด SVG เอง) |
| ผู้เขียน test (เฟส 6–7) | subagent B (เริ่มจากศูนย์) | `docs/04-REQUIREMENTS.md` + `web/SPEC.md` เท่านั้น — ไม่รู้ว่ามี `BUGS.md` |

## เฟสงาน

| เฟส | งาน | อ้างอิงบทเรียน | ได้ไฟล์ | workflow | ผ่านเมื่อ |
|---|---|---|---|---|---|
| 0 | ตรวจเครื่อง, ติดตั้ง Playwright + เบราว์เซอร์ + Playwright MCP, ทดสอบ MCP เปิดเว็บจริง | 00_tester/01 | `tools/`, `.mcp.json`, `docs/00-ENVIRONMENT.md` | — | MCP เรียก `browser_navigate` สำเร็จ + มีหลักฐาน |
| 1 | บทสัมภาษณ์เจ้าของสนาม + ลูกค้า 5–6 แบบ (กฎมีตัวเลข + ค่าขอบ) | 00_tester/03 LAB 1 | `docs/01-INTERVIEW.md` | — | ผู้ใช้อนุมัติ |
| 2 | BA + User Story | 01 โจทย์ 2–3, 00_tester/03 LAB 1 | `02-BA.md`, `03-USER-STORIES.md` | Loop ≤3 รอบ | C1 ทุกบรรทัดสัมภาษณ์มี US · C2 เกณฑ์ยอมรับตรวจได้ · C3 ไม่มีตัวเลขนอกสัมภาษณ์ |
| 3 | REQUIREMENTS → SRS, SA, SAD | 01 บท Graph | `04`–`07` | Graph (N1 contract → SA/SAD/SRS → N5 ตรวจสอดคล้อง) | C1 ทุก US มี FR/BR · C2 entity ใน sequence/state อยู่ใน ERD · C3 Mermaid render จริง |
| 4 | BUILD-PROMPT → subagent A สร้างเว็บ + เปิดดูผลงานเองผ่าน browser | 00_tester/03 LAB 3–4 | `08-BUILD-PROMPT.md`, `web/`, `web/SPEC.md`, `web/BUGS.md` | Loop | 2 กล่อง healthy · `/api/health` ok · ตรวจกฎผ่าน API ผ่าน |
| 5 | **Playwright MCP เดินเหมือนลูกค้าจริงทุก journey** → ภาพ + ตารางความเสี่ยง | 00_tester/03 LAB 5, 02 บท 6 | `screenshots/`, `docs/05b-EXPLORATION.md` | — | ครบทุกหน้า + console/network ไม่มี error ที่ไม่อธิบาย |
| 6 | TEST-PLAN 40–50 TC (subagent B) | 00_tester/02–03 LAB 6 | `09-TEST-PLAN.md` | — | ทุก FR/BR มี TC ≥ 1 |
| 7 | e2e (2 ข้อก่อน → ครบ) 3 เบราว์เซอร์ + รันซ้ำ (flaky) + GIF/MP4 (subagent B) | 00_tester/03 LAB 7–8 | `e2e/`, `e2e/test-report/` | Loop | P1 100% + รวม ≥ 95% หรือรายงานบั๊กจริง |
| 7.5 | ✅ แก้ 2 รอบ (รอบ 1 มี regression ขั้นยืนยันยกเลิก → ส่งกลับ) · คำตอบร้าน A-21–A-28 · tester เพิ่ม TC เป็น 60 · **ตรวจซ้ำเอง 153/153 = 100% P1 ล้ม 0 → ผ่านเกณฑ์** | `docs/08b-FIX-PROMPT.md`, `docs/09b-TEST-PROMPT-7.5.md`, `docs/trace/phase7-5-fix.md`, `web/CHANGELOG-7.5.md`, `e2e/test-report/` |
| 8 | ✅ `BUG_MODE=1` → 146/153 · DEF 3 ข้อ (TC-PRICE-03, TC-CANCEL-01, TC-RENT-02) ตรงเฉลย `BUGS.md` **3/3** ไม่มีผลบวกลวง · กลับ `BUG_MODE=0` แล้ว | `docs/10-TEST-REPORT.md`, `e2e/test-report/TEST-REPORT-BUGMODE1.md`, `e2e/test-report/bugmode1/` |
| 8 | BUG_MODE=1 → รายงาน DEF → เปิด BUGS.md เทียบ → กลับโหมดปกติ | 00_tester/02–03 LAB 8–9 | `10-TEST-REPORT.md` (ส่วน BUG_MODE) | — | จับบั๊กที่ฝังได้ครบ 3 |
| 9 ⭐ | Change Request กลางทาง → Plan v2 (เหตุผล/impact/reuse) | 01 บท Dynamic | PLAN v2 + เอกสาร/เว็บ/test ที่แก้ | Dynamic | ทำซ้ำเฉพาะที่กระทบ · test เดิมยังผ่าน |
| 10 ⭐ | หน้า `/project` (เอกสาร + traceability + ผลรันล่าสุด), axe, API contract, มือถือ | ไม่มีในบทเรียน | `web/`, `e2e/` | Loop | portal แสดงผลรันจริง |

⭐ = ข้อเสนอเกินจากบทเรียน

## ข้อกำหนดทางเทคนิคที่ต้องอยู่ใน BUILD-PROMPT (จากบทเรียน + บทวิเคราะห์แผน)

- `data-testid` ทุกปุ่ม/ช่อง/ข้อความ error · `<html data-ready data-bug-mode>`
- `GET /api/health` → `{ ok, db }` · `POST /api/test/reset` (เมื่อ `ALLOW_TEST_RESET=1`) รับ `{ now }` ล็อกวันที่
- `BUG_MODE=1` ฝังบั๊ก 3 ตัว เฉลยเฉพาะ `web/BUGS.md`
- ไม่ต่อ DB ตอน build · TZ=Asia/Bangkok · `.gitattributes` LF · ไม่มี .sh ที่ต้องรัน
- portal: compose mount `../docs` และ `../e2e/test-report` แบบ read-only แล้วอ่านตอน runtime

## เอกสาร (REQUIREMENTS เป็นแหล่งความจริงเดียว — เอกสารอื่นอ้างรหัส ไม่ copy ซ้ำ)

| ไฟล์ | เนื้อหา |
|---|---|
| `01-INTERVIEW.md` | บันทึกสัมภาษณ์ |
| `02-BA.md` | stakeholder, As-Is/To-Be, pain point, gap analysis, open issues |
| `03-USER-STORIES.md` | US + เกณฑ์ยอมรับ + Must/Should/Could + คำถามที่ยังไม่ชัด |
| `04-REQUIREMENTS.md` | FR / BR (+ ค่าขอบ) / NFR + traceability US→FR/BR |
| `05-SRS.md` | สเปกตาม ISO/IEC/IEEE 29148 แบบย่อ (อ้างรหัสจาก 04) |
| `06-SA.md` | use case, ERD, sequence, state, activity |
| `07-SAD.md` | สถาปัตยกรรม, deploy, API, data model, testability, ADR |
| `08-BUILD-PROMPT.md` | พรอมต์สร้างเว็บ |
| `09-TEST-PLAN.md` | TC + traceability FR/BR→TC + เกณฑ์เริ่ม/ผ่าน |
| `10-TEST-REPORT.md` | ผลรอบปกติ / หลังแก้ / BUG_MODE |

## ความเสี่ยงและวิธีกัน

| ความเสี่ยง | ที่มา | กันโดย |
|---|---|---|
| รุ่น Playwright ไม่ตรงกับเบราว์เซอร์ | 00_tester/03 LAB 7 | ล็อกรุ่นเดียวกันทั้ง `tools/` และ `e2e/` |
| ดาวน์โหลดเบราว์เซอร์ไม่ผ่าน (IPv6) | 00_tester/01 LAB 3 | ทดสอบ `curl -4/-6` ก่อน แล้วบังคับ IPv4 ถ้าจำเป็น |
| 3 เบราว์เซอร์จองช่องเดียวกัน (flaky) | 00_tester/03 | แต่ละเบราว์เซอร์ใช้วันต่างกัน · reset ครั้งเดียวใน global-setup |
| วันที่เปลี่ยนแล้ว test เปลี่ยน | 00_tester/03 | ล็อก "วันนี้" ผ่าน reset |
| build ต่อ DB | 00_tester/03 | หน้าใช้ DB เป็น dynamic |
| path มีช่องว่าง/วงเล็บ | วิเคราะห์แผน | ทดสอบในเฟส 0 |
| AI ตรวจเองแล้วอ้าง PASS | 01 | เปิดผลงานจริง เก็บหลักฐานเป็นไฟล์ |
| ความอิสระของคนเขียน test | 01 | subagent B ไม่เห็น BUGS.md / BUILD-PROMPT |

## Plan Version Log

| เวอร์ชัน | วันที่ | เหตุผล | สิ่งที่เปลี่ยน |
|---|---|---|---|
| v1 | 2026-10-09 | แผนแรกจากบทเรียน | 10 เฟส |
| v2 | 2026-10-09 | วิเคราะห์แผนกับความจริงของเครื่อง + ผู้ใช้เลือกใช้ subagent และ Playwright MCP | เพิ่มเฟส 7.5, portal mount docs, REQUIREMENTS เป็นแหล่งเดียว, subagent A/B, ใช้ Playwright MCP ในเฟส 0/4/5/7.5/8, แกนหลัก 0–8 |
| v2.1 | 2026-10-09 | ผลเฟส 0: ไม่มี `claude` CLI · path มีช่องว่างทำให้ chrome/firefox เปิดไม่ได้ · MCP แบบ HTTP เสีย state ข้ามคำสั่ง | ใช้ bridge (stdio) ในแชตนี้ · เบราว์เซอร์ที่ `D:\ms-playwright` + `PLAYWRIGHT_BROWSERS_PATH` ทุกที่ (รวม `e2e/` เฟส 7) · BUILD-PROMPT/e2e ต้องใช้ `@playwright/test` 1.64.0 |

## ▶️ จุดเริ่มทำต่อ (อัปเดต 2026-10-10 14:40)

- **แกนหลักเฟส 0–8 เสร็จ** · ผ่านเกณฑ์ใน `BUG_MODE=0` (153/153) · จับบั๊กที่ฝังได้ 3/3 · สรุปที่ `docs/10-TEST-REPORT.md`
- เหลือโบนัส: เฟส 9 (Change Request ด้วย Dynamic workflow) · เฟส 10 (หน้า /project portal, axe, API contract, มือถือ) — รอผู้ใช้เลือก
- ยังไม่มี git commit — ถามผู้ใช้

## สถานะ

| เฟส | สถานะ | หลักฐาน |
|---|---|---|
| 0 | ✅ เสร็จ | `docs/00-ENVIRONMENT.md`, `screenshots/mcp/trace.jsonl`, `screenshots/mcp/phase0-after-click.png` |
| 1 | ✅ ผู้ใช้อนุมัติ (v2) | `docs/01-INTERVIEW.md` |
| 2 | ✅ Loop ผ่านใน Iteration 2 · ผู้ใช้ยืนยันคำตอบ A-01–A-14 | `docs/02-BA.md`, `docs/03-USER-STORIES.md`, `docs/trace/phase2-loop.md`, `tools/check-phase2.mjs` |
| 3 | ✅ Graph: N5 ผ่านครั้งที่ 2 · ผู้ใช้ยืนยัน A-15, A-16 | `docs/04`–`07`, `docs/trace/phase3-graph.md`, `tools/check-phase3.mjs`, `docs/diagrams/` |
| 4 | ✅ subagent A สร้างเสร็จ (~48 นาที) · ตรวจซ้ำแล้ว: healthy, selfcheck 125/125 · รอยืนยัน D-14, D-20 | `docs/08-BUILD-PROMPT.md`, `web/`, `web/SPEC.md`, `docs/trace/phase4-build.md` |
| 5 | ✅ Playwright MCP เดิน 8 journey (163 tools/call) · findings F-01–F-07 · ร้านตอบ A-17–A-20 แล้ว (ยังไม่แก้เว็บ — รอให้ test จับได้ก่อน แล้วแก้ในเฟส 7.5) | `docs/05b-EXPLORATION.md`, `screenshots/mcp/` |
| 6–7 | ✅ subagent B: 50 TC · 3 เบราว์เซอร์ + serial · **ไม่ผ่านเกณฑ์** (121–122/132, P1 ล้ม) · เว็บผิด 3 (A-18 เงินผิด, A-19, A-20) · กฎไม่ชัด 1 (NFR-08) · flaky 1 · ตรวจซ้ำเองแล้ว | `docs/09-TEST-PLAN.md`, `e2e/`, `e2e/test-report/`, `docs/trace/phase6-7-tests.md` |
| 7.5 | 🔄 คำตอบร้าน A-21–A-26 (จาก Q-T1–Q-T10) · NFR-08 นิยามใหม่ · ส่งแก้ 17 ข้อ (`08b-FIX-PROMPT.md`) | `docs/01-INTERVIEW.md` v6, `docs/04-REQUIREMENTS.md`, `docs/08b-FIX-PROMPT.md`, `docs/09b-TEST-PROMPT-7.5.md` |
