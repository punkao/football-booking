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
| v3 | 2026-10-11 | อาจารย์เขียนบท 04 ใหม่ (12 LAB + รูบริก 20 ข้อ) และเพิ่มบท 03 | อัปเกรด: TEST-DATA, ฟัง 3 ทาง + ป้ายที่มา, แผน 8 หัวข้อ, PLAN-REVIEW, BUG-HUNT, index.html, Docker แยก, บั๊กปริศนาใหม่ |
| v4 | 2026-10-18 | อาจารย์เพิ่มบท 05 (REA รับช่วงระบบเดิม) บท 06 (Change Request แบบงานรัฐ + EXAM.md) และ 00_setup/04_Skill_Setup | เพิ่มส่วนที่ 2: ใช้เว็บเราเป็นระบบเดิม → HANDOVER-CHECK, REA, golden master, mutant, CR 5 ฉบับแบบแดงก่อนแก้, migration + rollback, ORACLE-CHANGES, RELEASE-NOTES, UAT, smoke |
| v5 | 2026-10-18 | ผู้ใช้ยืนยันเป้าหมาย: ระบบ production 1 ตัว (หน้าบ้าน หลังบ้าน chatbot คลังข้อมูล การจัดการข้อมูล) ตามทุกบทของอาจารย์ | ส่วน A–E: ฟังร้านรอบ 2 → สร้าง v2 (chatbot mock + gateway Claude, คลังอุปกรณ์, แดชบอร์ด, รายงาน CSV, migration/backup) → ทดสอบแบบบท 03–04 + เทสต์แชทบอท → รับช่วง + CR แบบบท 05–06 |

## ▶️ จุดเริ่มทำต่อ — แผน v5 (2026-10-18 · หลังแกะ repo อาจารย์ทั้งหมด)

**ที่ push งาน (ผู้ใช้กำหนด 2026-10-18 · แก้แล้ว):** `https://github.com/punkao/football-booking.git` (origin เดิม) เท่านั้น · **ห้าม push ไป repo ของอาจารย์ (Teaching_CWN2026) และห้ามแตะ `punkao/Final-project-VLM-`** (ผู้ใช้ส่งลิงก์นั้นมาผิด) · ถามก่อน push ทุกครั้ง

**ข้อเท็จจริงของเครื่อง:** ไม่มีคำสั่ง `claude` (CLI) ใน PATH — gateway แชทบอทโหมด ai ต้องติดตั้ง Claude Code CLI + ผู้ใช้ล็อกอินเอง (🙋 ถามก่อน) · Playwright MCP ใช้ผ่าน `.mcp.json` + bridge ใน `tools/` (ทำงานแล้วตั้งแต่เฟส 0)

**เป้าหมายจริง (ผู้ใช้ยืนยัน):** เอาทุกที่อาจารย์สอนมาพัฒนา "ลูกหนัง อารีน่า" ให้เป็น **ระบบ production 1 ตัว**: หน้าบ้าน · หลังบ้าน · **chatbot** · **คลังข้อมูล/คลังอุปกรณ์** · **การจัดการข้อมูลเบื้องหลัง** — รายละเอียดและที่มาทุกข้อใน [`docs/11-INSTRUCTOR-MAP.md`](docs/11-INSTRUCTOR-MAP.md)

| ส่วน | ทำอะไร | ตามบทเรียน |
|---|---|---|
| **A · ฟังร้านรอบ 2** | สัมภาษณ์เพิ่ม (chatbot · คลังอุปกรณ์ที่ทีมเสนอ · แดชบอร์ด · รายงาน CSV · ติดตามการจอง) → US / FR / BR (ค่าขอบ 3 ค่า) / NFR · **TEST-DATA.md** · DESIGN (architecture db/web/mock-llm/gateway · ERD ใหม่ · flowchart · sequence ของแชท) · 🙋 ผู้ใช้ยืนยันในฐานะร้าน | บท 04 LAB 1–4 |
| **B · สร้าง v2** | `08-BUILD-PROMPT.md` v2 ฉบับเดียวจบ → subagent ผู้สร้าง (แบ่งงานแบบ Graph ถ้าใหญ่): Docker `db/` + `web/` + `mock-llm` (profile) · seed จาก TEST-DATA · migration + rollback · `EXCLUDE`/`CHECK` · หลังบ้าน (แดชบอร์ด, รายการจอง+ประวัติสถานะ, คลังอุปกรณ์+จุดสั่งซื้อซ้ำ, รายงาน+CSV) · **แชทบอท "น้องบอล"** (system prompt จาก DB · tag `[CHECK]` `[QUOTE]` `[BOOK]` · TH/EN · ปฏิเสธนอกเรื่อง · ประวัติใน DB · mock/ai) · **gateway** แบบ 05_API (🙋 ถามก่อนใช้บัญชี Claude ของผู้ใช้) · ASSETS (SVG) · บั๊กปริศนาใหม่ 3 ตัวที่ AI เลือกเอง · `check-testdata.mjs` | บท 04 LAB 5–6 · 00_setup 04.1, 04.2, 05 · บท 06 ข้อ 2, 5 |
| **C · ฟัง 3 ทาง → แผน → พิสูจน์** | tester ใหม่ (ไม่เห็นโค้ด): EXPLORATION A–F · TEST-PLAN 8 หัวข้อ + ที่มา · TEST-RUN-1 · PLAN-REVIEW · e2e 3 เบราว์เซอร์ + **เทสต์แชทบอทแบบอาจารย์** (ถามข้อเดียว + ถามต่อเนื่อง · "ต้องมี" + baseline + คำตอบจริง + GIF · ผ่านทั้ง mock และ ai) · index.html แยกเบราว์เซอร์ · BUG-HUNT | บท 03, 04 LAB 7–12 · 00_setup 04.1 ข้อ 4.3 |
| **C+ · Test case ผ่าน Playwright MCP (ผู้ใช้ขอเพิ่ม 2026-10-18 · อาจารย์กำหนด)** | ① **เชื่อม Playwright MCP ให้เห็นหลักฐาน**: `.mcp.json` ของโปรเจกต์ + ตรวจ `tools/list` ได้จริง + log การเรียกทุกครั้ง (`screenshots/mcp/trace.jsonl`) · ② **`docs/TEST-CASES.md` = ชุด test case + เฉลย** หลายข้อ (เป้า ≥ 100 ข้อ: หน้าบ้าน · หลังบ้าน · คลัง · รายงาน · chatbot ถามข้อเดียว + ถามต่อเนื่อง · สิทธิ์ · API) ทุกข้อมี ขั้นตอน · ข้อมูล · **ผลที่ถูก (เฉลย) พร้อมวิธีคิด** · ที่มา [D]/[R] · ระดับ · ③ **AI รัน test case ผ่าน MCP เหมือนคนใช้จริง** (คลิก กรอก อ่านผลบนหน้าเว็บ) ทีละข้อ → `docs/TEST-RUN-MCP.md`: เฉลย \| ผลจริง \| ✅/❌ \| ภาพหน้าจอ · ④ ทุกข้อแปลงเป็น Playwright test อัตโนมัติ + GIF/MP4 เพื่อรันซ้ำได้ · ⑤ หน้า Portal แสดงตาราง เฉลย ↔ ผลจริง ↔ หลักฐาน | 02_MCP · บท 04 LAB 9 (TEST-RUN-1) · 00_setup 04.1 ข้อ 4.3 (ต้องมี + baseline + คำตอบจริง) · บท 02 |
| **D · รับช่วง + Change Request** | ทีมใหม่รับมอบ v2: HANDOVER-CHECK · CODEBASE/SYSTEM-MAP (`file:line`) · REA (🙋 build `rea-lab` ~2.65 GB) · ตาข่าย golden + mutant · รั้ว CLAUDE.md/settings · **CR 5 ฉบับ** แดงก่อนแก้ · ORACLE-CHANGES · regression · RELEASE-NOTES · UAT · ซ้อมถอยกลับ · smoke | บท 05, 06 (+ แนวข้อสอบ) |
| **E · ปิดงาน** | รูบริก 4 ชุด (บท 03–06) · README / Portal / LINE · 🙋 push | – |
| ⭐ ทางเลือก | MCP server ของสนาม (02_MCP) · agent ลูกค้าจำลองแบบ Jev (03) · tester black-box 🅱️ | 02_MCP · 03_Jev · บท 03 Fast Track |

### ความคืบหน้าแผน v5 (อัปเดต 2026-10-18)
| ส่วน | สถานะ | commit |
|---|---|---|
| A ฟังร้านรอบ 2 | ✅ สัมภาษณ์รอบ 2 + A-29–A-40 · BA S45–S71 · US-35–52 · 04 (contract 23 entity · FR 48 · BR 45 · NFR 24 · T-01–T-24) · Graph N2∥N3∥N4 ขนานจริง → N5 ผ่าน · TEST-DATA ร้านยืนยัน · BUILD-PROMPT v2 | A0–A5, B0 |
| B สร้าง v2 | ✅ B1 ฐานระบบ · B2 ฟีเจอร์ · G4 `/code-review` 10 ข้อ + G5 `/security-review` → B3 แก้ครบ 12 ข้อ (ตรวจเอง: unit 88/88 · TEST-DATA 151/151 · ปลอม cookie OWNER ด้วย secret เก่า → 401 · v1 e2e 153/153) | B0–B3 |
| C ทดสอบ + C+ MCP | 🔄 ส่วน A: EXPLORATION ✅ · แผน 8 หัวข้อ ✅ · TEST-CASES 128 ข้อ + เฉลย ✅ · PLAN-REVIEW ✅ · A5 รัน MCP (≈ 92/128 ภาพ · 4,334 call) กำลังทำ → `TEST-RUN-MCP.md` | C-A checkpoint `6f68682` |
| C ส่วน B (แบ่งชิ้น กัน limit) | 🔄 B-1 ✅ (แชท 17/20 ทั้ง mock 3 เบราว์เซอร์ + ai ผ่าน mock-llm · ล้ม CHAT-14/15/16 = เว็บผิด FR-35 · CHATBOT-REPORT + GIF) · agent ใหม่ทุกชิ้น บริบทเล็ก · commit หลังจบแต่ละชิ้น: **B-1** e2e CHAT + รายงานแชทบอท (ต้องมี/baseline/คำตอบจริง/GIF · mock + mock-llm) → **B-2** e2e STOCK SALE DASH REPORT TRACK DATA ROLE + TC เดิมที่แผนแก้ → **B-3** `plan-cases.json` + `e2e/index.html` (คอลัมน์เฉลย + ภาพ MCP) → `npm test` 2 รอบ → `test:gif` → **B-4** BUG-HUNT ส่วน 1–2 → เปิด BUGS.md เทียบ → กลับ BUG_MODE=0 | – |
| D รับช่วง+CR / E ปิดงาน | ⏳ | – |

### ด่านคุณภาพทุกส่วน (เพิ่ม 2026-10-18 · ผ่านด่านก่อนไปส่วนถัดไป)

| ด่าน | เครื่องมือ | ใช้เมื่อ | ผ่านเมื่อ |
|---|---|---|---|
| G1 แผน | superpowers `writing-plans` / `brainstorming` (ลงแล้ว) | ต้นส่วน A–D | แผนเป็นขั้นมีไฟล์ · เกณฑ์ผ่าน · ผู้ใช้อนุมัติ |
| G2 เทสต์ก่อนโค้ด | superpowers `test-driven-development` · แนวบท 05–06 "แดงก่อน" | ทุกฟีเจอร์/CR ในส่วน B, D | มี commit เทสต์แดงก่อน commit แก้ |
| G3 ตรวจตัวเอง | `check-phase*` · selfcheck · `check-testdata` · e2e · เทสต์แชทบอท · unit · lint · tsc | ทุกครั้งที่แก้ | ผ่านครบ ตัวเลขรันซ้ำได้ |
| G4 รีวิวโค้ด | **`/code-review`** (มากับ Claude Code · 4 agent ขนาน) | จบส่วน B และทุก CR ในส่วน D | ไม่มีข้อค้างระดับ correctness · ข้อที่ไม่แก้มีเหตุผล |
| G5 ความปลอดภัย (อ่านโค้ด) | **`/security-review`** (มากับ Claude Code) ทุกส่วนที่แตะ login / เงิน / ข้อมูลส่วนบุคคล / แชทบอท (prompt injection, tag คำสั่งปลอม) / gateway (token) · ก่อนส่ง: **security-audit-skill** (ยังไม่ลง · ถามก่อนลง) | จบส่วน B, D | ไม่มีช่องโหว่ระดับสูงค้าง · secret scan สะอาด |
| G6 ความปลอดภัย (ยิงจริง · ทางเลือก) | strix (ยังไม่ลง · ชั้น B) | เฉพาะ localhost ของเราเอง + ผู้ใช้อนุญาตเป็นลายลักษณ์อักษร | – |
| G7 ยืนยันก่อนบอกว่าเสร็จ | superpowers `verification-before-completion` · session หลักรันซ้ำเอง | ทุกครั้งที่ subagent ส่งงาน | ตัวเลขที่รายงานตรงกับที่รันซ้ำ |

**git ให้เข้ากับแนวของอาจารย์ (บท 05–06 + EXAM):** 1 commit ต่อขั้น ข้อความมีรหัส (`A1:` … · `CR-0N-red:` → `CR-0N:`) · ค่าที่คาดหวังในชุดเดิมเปลี่ยนต้องมีแถวใน `ORACLE-CHANGES.md` · ห้ามลบ/skip เทสต์เดิม · ห้าม `down -v` ในไฟล์ที่ส่ง · `.gitignore` กัน `.env*`, `out/`, `*.har`, `rea/scratch/` · รั้ว `CLAUDE.md` + `.claude/settings.json` · ห้ามเปิด `_solution/` ของอาจารย์ · tag `v2-handover` · สำรองด้วย `git bundle` ได้

ตารางรายละเอียดเดิมด้านล่าง (แผน v4 ส่วนที่ 1 = ส่วน A–C · ส่วนที่ 2 = ส่วน D) ยังใช้เป็นรายการตรวจย่อยได้ · พรอมต์ `08d`/`09c` ต้องปรับเพิ่มฟีเจอร์ใหม่ก่อนใช้

### (รายละเอียด) แผน v4 (บันทึก 2026-10-18 หลัง pull ล่าสุด `5c00062`)

**ภาพรวมคอร์ส 00_tester ตอนนี้ (6 บท):** 01 ติดตั้ง → 02 ทดสอบตามแผน → 03 สำรวจแล้วเขียนแผนเอง → 04 สัมภาษณ์ → สร้างเว็บ → แผน → พิสูจน์ → **05 รับช่วงระบบเดิม (REA · characterization · แก้บั๊ก · CR)** → **06 ระบบเดิมแบบงานรัฐรับ Change Request + `EXAM.md` (สอบจริง 4 ชม. 100 คะแนน · ผ่าน ≥ 60)** · บท 01_Basic_AI_WORFLOW / 02_MCP / 03_Jev ไม่เปลี่ยน · `00_setup/04_Skill_Setup` (Vast.ai GPU, multi-agent หลายบัญชี) เป็นเรื่องเครื่อง/มีค่าใช้จ่าย ไม่ใช่งานส่ง

**แผน v4 = ส่วนที่ 1 (ตามบท 04 — ตารางด้านล่าง เดิมคือแผน v3) → ส่วนที่ 2 (ตามบท 05–06: ใช้เว็บสนามบอลของเราเป็น "ระบบเดิม" แล้วรับ Change Request)**

### ส่วนที่ 1 · ตามบท 04 (เดิมคือแผน v3 · บันทึก 2026-10-11)

**ทำไม:** อาจารย์เขียน `00_tester/04_sabai-spa-web-and-testplan-from-interview` ใหม่ทั้งบท (12 LAB + รูบริก 20 ข้อ) และเพิ่มบท 03 (สำรวจแล้วเขียนแผนเอง + Fast Track) · ประเมินงานเราตามรูบริกได้ราว 11–14/20 · ส่วนที่ขาดคือ TEST-DATA [D] · ฟัง 3 ทาง + ป้ายที่มา [D]/[R]/[A]/[O] · หัวข้อ 8 ของแผน · PLAN-REVIEW · BUG-HUNT ส่วน oracle · index.html แยกเบราว์เซอร์ · Docker db/web แยกโปรเจกต์ · บั๊กปริศนาที่ AI เลือกเอง

**ผู้ใช้ตัดสินแล้ว (2026-10-11):** ให้ AI ผู้สร้างเลือกบั๊กใหม่ 3 ตัว (ไม่มีใครรู้ รวมถึง session หลัก) · แยก Docker ตามบท 04 · tester v2 ใช้ test เดิมต่อยอดได้

**ตอนเช้าผู้ใช้พิมพ์แค่ "ลุย v2"** แล้ว session หลักทำตามลำดับนี้ (หยุดถามเฉพาะจุด 🙋)

| ขั้น | ใคร | ทำอะไร | ไฟล์ | ประมาณ |
|---|---|---|---|---|
| 0 | หลัก | **(บท 04 LAB 0)** เปิด Docker Desktop · `cd web && docker compose up -d` (ยังเป็น compose เดิม) · `/api/health` · เช็กเครื่องเป็นตาราง: docker / node / ffmpeg / Playwright MCP / พอร์ต 3000 และ **5433 ว่าง** | – | 5 นาที |
| 1a | หลัก | ✅ **ทำแล้ว:** ค่าขอบ BR ครบ 3 ค่า (ต่ำกว่า · ที่ขอบ · เกินขอบ) 26 ข้อ · check-phase3 ผ่าน (ยังไม่ commit) | `docs/04-REQUIREMENTS.md` | – |
| 1b | หลัก | **(LAB 1–2)** ตาราง **สมมติฐาน ⚠️** ท้าย 04 (ค่าที่ทีม/ผู้สร้างตั้งเอง เช่น รหัส LN-, ลิงก์หาร 2–30 คน, รูปแบบเบอร์, 1 ชั่วโมงฟรีต่อการจอง) โยงคำถาม · ตารางท้าย 04 **US \| FR \| BR \| ✅/❌** (ต้องไม่มี ❌) · NFR ทุกข้อมีคอลัมน์ "วิธีวัด" (ตรวจ) · หัวข้อ "คำถามที่ยังไม่ชัด" ท้าย `03-USER-STORIES.md` (อ้าง Q-01–Q-16 ใน 02-BA) | `03`, `04` | 20 นาที |
| 1c | หลัก | **(LAB 3)** DESIGN ที่ขาด: flowchart **จอง** + **ยกเลิก** (ใส่รหัส BR ทุกจุดตัดสินใจ) · ERD ระบุชนิดคอลัมน์เงิน · use case actor = บทบาท + ชื่อคนในบทสัมภาษณ์ · architecture แบบ db/web แยกโปรเจกต์ + network `football-net` + พอร์ต 5433 **พร้อมตาราง ชั้น \| อยู่ที่ไหน \| หน้าที่ \| ทดสอบด้วยอะไร** · หัวข้อ **"คำถามที่ได้จากการออกแบบ"** · render ด้วย `tools/render-mermaid.mjs` + check-phase3 | `06-SA.md`, `07-SAD.md` | 30 นาที |
| 1d | หลัก | **`docs/TEST-DATA.md`** [D]: วันล็อก `2026-10-09 10:00` (ศุกร์ · ตรง seed เดิม) · ผู้ใช้/บัญชีร้าน · สนาม/ราคา/วันหยุด/ของเช่า · การจองที่มีอยู่ (LN-900001–4) · ตารางค่าขอบ **E01…** ครบทุก BR พร้อมวิธีคิดเงิน · แถวที่ทำผ่านเว็บไม่ได้ระบุ "unit test" · ⚠️ ค่าที่ร้านยังไม่ยืนยัน — **ยึด seed เดิมให้มากที่สุด** เพื่อให้ e2e เดิมไม่พัง · **(LAB 4)** วันล็อกพร้อมเหตุผล · ผู้ใช้ครอบค่าขอบ (ชั่วโมงสะสม 9 / 10 · ไม่มา 1 ครั้ง / ถูกระงับ · มีเครดิต / ไม่มี · สมาชิก / ไม่สมัคร) · ทุกตารางมีคอลัมน์ "มาจาก BR/US ไหน" · ตารางสรุป หมวด \| จำนวนแถว | `docs/TEST-DATA.md` | 40 นาที |
| 1e | หลัก | **(LAB 5 · รูบริกบท 04 ข้อ 5)** เขียน **`docs/08-BUILD-PROMPT.md` v2 ฉบับเดียวจบ** (≤ 150 บรรทัด แบ่งขั้นมีเลข) ที่สร้างเว็บใหม่ได้จากศูนย์: อ้าง 04/06/07/TEST-DATA · Docker db/web แยก · seed ตาม TEST-DATA · **AI เลือกบั๊กเอง** (ห้ามบอก เขียนห้ามไว้ 2 ที่) · ขั้นสุดท้ายตรวจ "ผ่าน X/Y" · ฉบับเดิมย้ายเป็น `docs/08-BUILD-PROMPT-v1.md` (เป็นประวัติ — มีบั๊กชุดเก่าที่ผมกำหนด) · ตรวจว่าไม่ขัดกับ 04/06/07/TEST-DATA | `docs/08-BUILD-PROMPT.md` | 20 นาที |
| 🙋 | ผู้ใช้ | **ยืนยัน TEST-DATA ในฐานะร้าน** (ตอบ ⚠️ ที่เหลือ) | – | 5 นาที |
| 2 | subagent ผู้สร้าง (ตัวใหม่) | อ่าน `08-BUILD-PROMPT.md` v2 แล้วทำตาม **`docs/08d-REBUILD-PROMPT-v2.md`** (ปรับเว็บเดิม ไม่สร้างใหม่): Docker `db/` + `web/` · seed จาก TEST-DATA · ลบบั๊กเก่า เลือกบั๊กใหม่ 3 ตัวเอง (ไม่บอกใคร) · ASSETS.md (SVG — เครื่องไม่มี Codex) · `check-testdata.mjs` | `db/`, `web/` | 45–60 นาที |
| 2v | หลัก | ตรวจซ้ำ: 2 container healthy · check-testdata X/Y · selfcheck (**ไม่รัน `--expect-bugs` และไม่เปิด BUGS.md**) · `diff` ว่าไม่แตะ `e2e/`, `docs/` · รัน e2e ชุดเดิมใน BUG_MODE=0 (ควรผ่าน ยกเว้นที่ seed เปลี่ยนจริง) | – | 15 นาที |
| 3 | subagent tester (ใหม่) | **`docs/09c-TEST-PROMPT-v2.md` ส่วน A** (LAB 7–10): EXPLORATION A–F ฟัง 3 ทาง · TEST-PLAN v2 8 หัวข้อ + ที่มา + จังหวะตรวจ · TEST-RUN-1 · PLAN-REVIEW | `docs/EXPLORATION.md`, `exploration/`, `docs/09-TEST-PLAN.md`, `docs/TEST-RUN-1.md`, `docs/PLAN-REVIEW.md` | 60–90 นาที |
| 🙋 | ผู้ใช้ | ตอบคำถาม "ถามร้าน" จากส่วน F (ถ้ามี) → บันทึกเป็น A-29… | `01`, `04` | 10 นาที |
| 4 | subagent tester **ตัวใหม่** (บท 04: "เปิดเซสชันใหม่ทุก LAB · ไฟล์คือความจำ" — พิสูจน์ว่าไฟล์จากส่วน A พอ) | **ส่วน B** (LAB 11–12): e2e ครบแผน + `e2e/index.html` แยกเบราว์เซอร์ + triage · BUG_MODE=1 → `docs/BUG-HUNT.md` ส่วน 1–2 → เปิด BUGS.md เทียบ → กลับ 0 | `e2e/`, `docs/BUG-HUNT.md` | 90–120 นาที |
| 4v | หลัก | รัน `npm test` เองใน BUG_MODE=0 · ดู index.html · เช็ก GIF = MP4 = TC ที่เปิดเว็บ | – | 10 นาที |
| 5 | หลัก | `CLAUDE.md` ที่ราก (โครงสร้าง, คำสั่ง db/web/BUG_MODE, วิธีเขียน test) · README / Portal (`/project` บทเรียน → งาน: เพิ่มบท 03/04 ใหม่) / ข้อความ LINE · แก้ชื่อบทเก่า `03_sabai-spa…` → `04_sabai-spa-web-and-testplan-from-interview` (PLAN.md, 05-SRS.md) · trace `docs/trace/phase-v2.md` | หลายไฟล์ | 40 นาที |
| 5b | หลัก | **บท 02 LAB 9:** `CLAUDE.md` ให้เขียน test ใหม่จากประโยคภาษาไทยได้ (แบบ `TC-MY-xx` ใน `e2e/tests/11-my-tests.spec.ts`) แล้วสาธิต 2 ข้อ พร้อม GIF/MP4 เช่น "จอง C เสาร์ 18:00 2 ชั่วโมง ยอดต้อง ฿3,600 จ่ายเต็ม" | `CLAUDE.md`, `e2e/tests/11-my-tests.spec.ts` | 20 นาที |
| 5c | หลัก | ให้คะแนน**ทั้ง 2 รูบริก**: บท 03 (แผนทดสอบที่ดี 20 ข้อ) และบท 04 (งานทั้งบท 20 ข้อ) ลง `docs/RUBRIC-SELF-CHECK.md` | – | 15 นาที |
| ⭐ | ทางเลือก | **บท 03 Fast Track 🅱️ black-box:** tester อีกตัวที่ไม่อ่าน REQUIREMENTS/SPEC เลย (มีแค่ TEST-DATA) สำรวจแล้วเขียนแผน เทียบกับแบบบอกใบ้ · ทำถ้ามีเวลา (+2–3 ชั่วโมง) | `docs/EXPLORATION-blackbox.md` | – |
| 🙋 | ผู้ใช้ | อนุญาต commit + push (repo public: เฉลย BUGS.md ชุดใหม่จะขึ้นไปด้วย — ถามว่าโอเคไหม) | – | – |

### ส่วนที่ 2 · ตามบท 05–06: รับช่วงระบบเดิม + Change Request (เพิ่ม 2026-10-18)

ประโยคหลัก: บท 05 **"โค้ดบอก ≠ ระบบทำ ≠ ร้านต้องการ"** · บท 06 **"ทำตามที่ขอ ≠ ของเดิมไม่พัง ≠ ส่งมอบได้"** · ข้อสอบ **"อ่านก่อนแก้ · ล้อมรั้วก่อนแก้ · แก้ทีละเรื่อง · ทุกการเปลี่ยนต้องมีเทสต์ยืนยัน"**
เรื่องสมมติ: เว็บ v2 ที่ส่วนที่ 1 ทำเสร็จ = ระบบที่ "ผู้รับเหมาเดิม" ส่งมอบ (tag `v2-handover`) · ทีมใหม่ (subagent ที่ไม่เคยเห็นการสร้าง) รับช่วง · เจ้าของสนาม (ผู้ใช้) ส่งหนังสือ CR 5 ฉบับ · ใช้ปี พ.ศ. ในหนังสือ

| ขั้น | ใคร | ทำอะไร (อ้าง LAB) | ไฟล์ |
|---|---|---|---|
| L0 | หลัก | **(05/06 LAB 0)** เช็กเครื่อง + พอร์ตที่ Windows จอง (`netsh … excludedportrange`) · ExecutionPolicy · 🙋 ขออนุญาต build image **`rea-lab:6.4.0`** จาก `Teaching_CWN2026/00_tester/05_…/rea/` (~2.65 GB ดาวน์โหลดเยอะ) | – |
| L1 | หลัก | tag `v2-handover` · สร้าง **ฐาน "ใช้งานจริง"** (ข้อมูลมากกว่า seed: การจองหลายเดือน ลูกค้าหลายสิบคน) ด้วยสคริปต์ ใช้ทดสอบ migration | `tools/make-prod-like-data.mjs` |
| L2 | subagent ผู้รับช่วง | **(06 LAB 1–3 · 05 LAB 1–3)** `HANDOVER-CHECK.md` (คำอ้างใน README/SPEC ✅/❌/⚠️ จากคำสั่งที่รันจริง) · `CODEBASE-MAP.md` / `SYSTEM-MAP.md` ทุกแถว `file:line` · `REA-INVENTORY.md` (static / runtime / inference / unknown + `[E ev_…]`) · `API-INVENTORY.md` จาก HAR (ไม่มีรหัสผ่าน/cookie) · triangulation REA / source / DB · `SPEC-GAPS.md` เป็นคำถามถึงร้าน | `legacy/` |
| L3 | subagent ผู้รับช่วง | **(06 LAB 4 · 05 LAB 1)** `CLAUDE.md` สั้น (≤ 60 บรรทัด: วิธีรัน · ห้ามแตะ · กับดัก) + **`.claude/settings.json` รั้วกันแก้เทสต์เดิม** · ทดสอบว่ารั้วปฏิเสธจริงในเซสชันใหม่ | `CLAUDE.md`, `.claude/settings.json` |
| L4 | subagent ผู้รับช่วง | **(06 LAB 5 · 05 LAB 4)** ตาข่าย: รันชุดเดิม 3 เบราว์เซอร์ → `BASELINE.md` · **golden master** `POST /api/quote` (ป้าย `[E golden/…:sha8]` · รัน 2 รอบนิ่ง · ตัดฟิลด์ที่เปลี่ยนเองพร้อมเหตุผล) · known issue ล็อกคู่ (`test.fail`) · **mutant 3 ตัว** วัดรูของตาข่าย แล้วคืนไฟล์ครบ · seam ปิดได้เมื่อ `ALLOW_TEST_RESET=0` | `tests/golden/`, `legacy/BASELINE.md`, `legacy/MUTANTS.md` |
| 🙋 | ผู้ใช้ (ร้าน) | อนุมัติ **หนังสือ CR 5 ฉบับ** ที่ผมร่างตามชนิดงานบท 06 (แก้ได้): **CR-02 เปลี่ยนกฎมีวันมีผล** (เช่น ราคาเย็นสนาม 5 คน ฿1,300 ตั้งแต่ 1 พ.ย. 2569 · นัดเก่าไม่เปลี่ยนยอด) · **CR-03 แก้บั๊กจากเรื่องร้องเรียน** (ใช้บั๊กจริงที่ส่วนที่ 1 สำรวจเจอ ถ้าไม่มีใช้เรื่องร้องเรียนที่ทำซ้ำได้จริง) · **CR-04 migration บนฐานมีข้อมูล** (เช่น ปิดสนามซ่อมบำรุงเป็นช่วง/`field.active`) · **CR-01 ฟีเจอร์ใหม่** (เช่น ประวัติชั่วโมงสะสม/เครดิตของสมาชิก) · **CR-05 รายงานยอดเจ้าของ + CSV** (BOM ภาษาไทย) | `CHANGE-REQUESTS/CR-0N.md` |
| L5 | subagent ผู้รับช่วง | **(06 LAB 6–10 · 05 LAB 5–8)** ต่อ CR: คำถามถึงร้าน → อธิบายของเดิมด้วย `file:line` (`CR-0N-BEFORE`) → `docs/impact/CR-0N.md` (ไฟล์ × เทสต์ · DB · i18n · grep) **ก่อน diff** → commit **เทสต์แดง** `CR-0N-red:` → commit แก้ `CR-0N:` → regression · ค่าที่คาดหวังติด `[D:CR-0N]` หรือ `[E]` · ค่าที่เปลี่ยนในชุดเดิมต้องมีแถวใน **`ORACLE-CHANGES.md`** · migration **รันซ้ำได้ 2 ครั้ง + rollback** · ห้าม `down -v` | git commits, `docs/impact/`, `db/migrations/`, `ORACLE-CHANGES.md` |
| L6 | subagent ผู้รับช่วง | **(06 LAB 11 · 05 LAB 9)** regression เต็ม 3 เบราว์เซอร์ → `REGRESSION-REPORT.md` (ตัวเลขต้องตรงเมื่อรันซ้ำ) · hash ไฟล์ + **REA เทียบ v1↔v2** → ตาราง "CR × REA เห็นไหม" + สิ่งที่ REA มองไม่เห็นและเทสต์ที่พิสูจน์แทน · `TRACEABILITY.md` CR → BR → TC | `legacy/` |
| L7 | subagent ผู้รับช่วง | **(06 LAB 12)** `RELEASE-NOTES.md` ภาษาคน (มีเรื่องที่ยังไม่แก้) · `UAT-CHECKLIST.md` ต่อ CR มีช่องลงชื่อ · **ซ้อมถอยกลับจริง** (สำรอง → down → up ไม่ใช้ `-v`) ข้อมูลอยู่ครบ · `tests/smoke.mjs` อ่านอย่างเดียว (exit 1 ตอนเว็บหยุด / 0 ตอนปกติ) · runbook | – |
| L8 | หลัก | ตรวจซ้ำทุกตัวเลข · ให้คะแนน**รูบริกบท 05 และ 06** เพิ่มใน `RUBRIC-SELF-CHECK.md` (รวม 4 รูบริก 80 ข้อ) · อัปเดต README / Portal / ข้อความ LINE · 🙋 push | – |
| ⭐ | ทางเลือก | **ฝึกข้อสอบบท 06 ชุด A** (4 ชม. · 8 ข้อ) — ต้องได้ `sabai-legacy.zip` จากอาจารย์ก่อน · หรือทำ "ข้อสอบจำลอง" ของสนามบอลเอง 8 ข้อตามรูปแบบเดียวกัน (commit `EX0:`…`EX8:`, `git bundle`) | – |

**ส่วนที่ 2 ประมาณ 6–8 ชั่วโมง** (บท 05 รอบจริงของอาจารย์ ~109 นาที + บท 06 12 LAB) · ทำหลังส่วนที่ 1 เสร็จ เพราะต้องมี v2 เป็น "ระบบเดิม" ก่อน

**ไม่ทำ (นอกขอบเขตงาน):** บท 01 ติดตั้ง Playwright Extension ใน Chrome ตัวจริง (เป็นเรื่องเครื่อง ไม่ใช่งานส่ง) · `00_setup` multi-account container / Vast.ai GPU / multi-agent หลายบัญชี (เสียเงินจริง และต้องใช้หลายบัญชี — subagent ของเราทำหน้าที่เดียวกันแล้ว) · เว็บหลายภาษาเกิน TH/EN

**ส่วนที่ 1 ประมาณ 6–8 ชั่วโมง · รวมทั้งแผน v4 ประมาณ 12–16 ชั่วโมง (2 วันทำงาน)** (ส่วนใหญ่รอ subagent) · ระหว่างนี้เว็บถูก reset หลายรอบ — บัญชีที่สมัครเล่นจะหาย

**ข้อควรระวังที่รู้แล้ว**
- **ห้ามทุกคน (session หลักและ subagent) เปิด `Teaching_CWN2026/**/_solution/`** — เป็นเฉลยของอาจารย์ ใช้ได้แค่ README บทเรียน
- e2e ของเรากันข้อมูลชนด้วย "แต่ละเบราว์เซอร์ใช้วัน/สนามต่างกัน" แทนบท 04 ที่ใช้ `workers: 1` + reset ทุก test — เขียนเหตุผลไว้ในแผนหัวข้อ 6 (เร็วกว่า ~4 เท่า) ไม่ต้องเปลี่ยน
- session หลักต้อง**ไม่เปิด `web/BUGS.md`** และไม่รัน `--expect-bugs` จนกว่า tester ทำ BUG-HUNT ส่วน 2 เสร็จ
- e2e เดิมผูกกับ seed (ต้น เครดิต ฿1,200 / 7 ชม. · มิว 10 ชม. · โจ้ ไม่มา 1 · แนน ไม่สมัคร · LN-900001–4 · วันล็อก 9 ต.ค. 10:00) → TEST-DATA ต้องคงค่าเหล่านี้
- เครื่องไม่มี `gh` และไม่มี `codex` · Playwright browsers อยู่ `D:/ms-playwright` · IPv6 ใช้ไม่ได้ (`NODE_OPTIONS=--dns-result-order=ipv4first`)
- ไฟล์ `อธิบาย.txt` ที่ราก (untracked) ผู้ใช้สร้างเอง — ไม่แตะ

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
