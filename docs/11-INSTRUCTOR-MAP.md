# 11 · แกะ repo อาจารย์ทั้งหมด → เอามาใช้กับ "ลูกหนัง อารีน่า" ระบบ production

อ่านจาก `Teaching_CWN2026` (commit `5c00062` · 17 ต.ค. 2569) · **ตรวจครบทั้ง repo และอัปเดตสถานะเมื่อ 21 ต.ค. 2569 ที่ `HEAD 99c09d7`** (ปิดงานส่วน E) · โจทย์จริงจากผู้ใช้: **เอาทุกที่อาจารย์สอนมาพัฒนาสนามบอลให้เป็นระบบ production 1 ตัว มีหน้าบ้าน หลังบ้าน chatbot คลังข้อมูล การจัดการข้อมูลเบื้องหลัง**
หลักที่ยึดตลอด (HANDOFF ข้อ 1): ทุกขั้นยึดสิ่งที่บทเรียนสอน — สอนอะไร · ให้เทสต์อะไรอย่างไร · ใช้เครื่องมืออะไร — แล้วปรับให้เป็นของสนามบอล · ทำเพิ่มเกินบทเรียนได้ถ้าดีกว่า โดยเขียนเหตุผลสั้น ๆ
ป้ายสถานะ: ✅ ทำแล้วตรงบทเรียน · 🔧 ทำแบบปรับให้เป็นของเรา · ➕ ทำเกินบทเรียน (บอกเหตุผล) · ❌ ช่องว่าง · ⏭ ตั้งใจไม่ทำ (บอกเหตุผล)
คะแนนรูบริก 4 บท (03/04/05/06): **74.5 / 80** → [`RUBRIC-SELF-CHECK.md`](RUBRIC-SELF-CHECK.md)

## 1. repo อาจารย์มีอะไรบ้าง → เราทำอะไร ที่ไหน

### 1.1 `00_setup` (เครื่องมือ + แชทบอท + API)

| บทเรียน | สอน · ให้เทสต์ · เครื่องมือ | ที่ทำในโปรเจกต์ (path) | สถานะ |
|---|---|---|---|
| `01_Docker_VSCode_Setup` · `02_Setup_Multi_Account` · `03_MultiAccount_Container` | container `multi-account-devtool` (SSH · Jupyter) · Claude Code + Codex หลายบัญชี `yolo1–5` / `cyolo1–5` | เราใช้ Docker Desktop + Claude Code บัญชีเดียว; subagent (Agent tool) ทำหน้าที่ "หลายบัญชี" แทน (แบ่งงาน `docs/trace/phase-v2-graph.md`) · ไม่ได้เปิด container นี้ | ⏭ เป็นเครื่องมือของคนเรียน ไม่ใช่ฟีเจอร์ · ไม่ต้องใช้หลายบัญชีจึงไม่เสียเงินเพิ่ม |
| `04_Skill_Setup/00_Setup_Skill` | ลากวาง skill `vastai` `yolo` `cyolo` ลง container | – | ⏭ ผูกกับ container ข้างบน |
| `04_Model_shell` | เรียก Claude/Codex จาก shell ครบทุกระดับ (Fable/Opus/Sonnet ฯลฯ) · เก็บคำตอบเป็นตัวแปร · ต่อโมเดลเป็น **Graph** (A∥B → C ตัดสิน · ร่าง → ตรวจ → สรุป) | Graph แบบเดียวกันทำด้วย subagent: N1 → N2∥N3∥N4 → N5 (`docs/trace/phase-v2-graph.md`, `docs/trace/phase3-graph.md`) · ตรวจจุดเชื่อมด้วย `tools/check-phase3.mjs` · ลองเรียก `claude.exe -p` แบบ headless แล้ว (ติด 401 ไม่มี login — `legacy/FENCE-TEST.md`) | 🔧 ใช้ Agent tool แทนคำสั่ง shell · ไม่มี `codex` ในเครื่อง |
| `04_Skill_Setup/01_VastAi_Skill` (**04.1**) | เช่า GPU Vast.ai · รัน Qwen 27B (NInfer) เป็น API แบบ OpenAI · **แชทบอทร้านนวด**: system prompt จาก DB · ตอบทีละคำ · จองผ่านแชท · `MODE=ai`/`mock` · **เทสต์ 26 เคส** (ถามข้อเดียว 18 + ถามต่อเนื่อง 8) แบบ "ต้องมี/ห้ามมี" + baseline + คำตอบจริง + GIF · ปิดเครื่องหลังใช้ | แชทบอท **"น้องบอล"**: `web/lib/chat/{engine,mock,prompt,templates}.ts` · system prompt จาก DB (migration `004_chat`, `006_chat_hardening`) · `MODE=mock` (ค่าเริ่ม) / `MODE=ai` ผ่าน `web/mock-llm/server.mjs` (`node tools/chat-mode.mjs ai`) · เทสต์ **TC-CHAT-01…20** (ข้อเดียว 13 + ต่อเนื่อง 3 [14–16] + ขอบ/สิทธิ์ 4) `e2e/tests/chat.spec.ts`, `chat.serial.spec.ts` · รายงาน "ต้องมี/ห้ามมี/baseline/คำตอบจริง/GIF" `e2e/test-report/CHATBOT-REPORT.md` (mock 20/20 ทั้ง 3 เบราว์เซอร์ · ai-ผ่าน-mock-llm 20/20) · unit `web/lib/chat/{chat,cr04,cr05}.test.ts` | 🔧 ปรับเป็นสนามบอล · ➕ รัน 2 เส้นทางด้วยชุดเดียวกัน + กันบอทแต่งราคา (price guard) + ปิดเบอร์ในประวัติ (BR-44/45) · ❌ **ไม่เคยเรียกโมเดลจริง** (ไม่ได้เช่า GPU) · ❌ ต่อเนื่องมี 3 ข้อ (บทมี 8) · ❌ CR-04 ยังไม่ครอบ "จองเลย" (`RELEASE-NOTES.md` K1) |
| `04_Skill_Setup/02_Multi_Agent_Orchestra` (**04.2**) | ตัวคุมวงแตกงานให้หลายบัญชีสร้าง **BuildMart** (`BUILDMART.md`): หน้าร้าน · เครื่องคำนวณ · ตะกร้า · ใบเสนอราคา · คำสั่งซื้อ+ติดตาม · **หลังร้าน**: สต็อกหลายสาขา + จุดสั่งซื้อซ้ำ + แดชบอร์ด + ประวัติสถานะ · **แชทบอท tag `[CALC]` `[ADD_TO_CART]` `[QUOTE]`** · compose 3 service (db · web · mock-llm) · เทสต์ W01–W13… ทุกข้อมี test + วิดีโอ→GIF · อัลกอริทึม EUBF เลือกบัญชี | หน้าบ้าน `web/app/{book,pay,booking,my,series,split,challenges,fields}` · หลังบ้าน `web/app/{staff,manager,owner}` (แดชบอร์ด `owner/dashboard` · รายการจอง+ประวัติสถานะ `owner/bookings/[code]` · รายงาน+CSV `owner/reports` · ประวัติแชท `owner/chats` · AuditLog `owner/audit`) · **คลังของ** `staff/stock`, `staff/stock/sale`, `staff/stock/transfer`, `manager/stock` (รับเข้า · ชำรุด · ปรับยอด · จุดสั่งซื้อซ้ำ + เตือน FR-41) · แชททำรายการจริงด้วย tag `[CHECK]` `[QUOTE]` `[BOOK]` (`docs/07-SAD.md` ข้อ 9.4 · ADR-15) · compose `db/compose.yaml` + `web/compose.yaml` (profile `mock` ของ mock-llm) · เทสต์ 128 TC ทุกข้อมี GIF+MP4 (`e2e/test-report/gifs|videos` 139) | 🔧 ปรับ BuildMart → สนามบอล · ✅ สต็อก+จุดสั่งซื้อซ้ำ+แดชบอร์ด+ประวัติสถานะ · ➕ db/web แยกเป็น 2 compose project (NFR-23, ADR-10) เพราะ `down` ฝั่งเว็บไม่แตะข้อมูล · ⏭ ตัวคุมวง/EUBF/หลายบัญชี (subagent แทน) · ❌ เทสต์ CR ใหม่ ~29 ข้อไม่มี GIF/MP4 |
| `05_API_MultiAccount_Server` (**05**) | FastAPI `/v1/chat/completions` แบบ OpenAI ที่เรียก Claude Code / Codex CLI · Bearer token · หน้าแชต `index.html` · ผลทดลองหลายรอบ | สมองแชท `MODE=ai` ใช้อินเทอร์เฟซ OpenAI-compatible เดียวกัน (`LLM_BASE_URL` `LLM_MODEL` `LLM_API_KEY` `LLM_TIMEOUT_MS` ใน `web/compose.yaml`) แต่ปลายทางตอนนี้คือ `web/mock-llm/server.mjs` (ทดสอบ `web/mock-llm/server.test.mjs`) · ล่ม/ช้า = ตอบขอโทษไม่ใช่ 500 (NFR-16) · ความลับไม่หลุด (`.env` ไม่ commit, `.env.example`, `SESSION_SECRET` ตรวจตอนเริ่ม `web/instrumentation.ts`) | ❌ **ยังไม่มี gateway ที่เรียก Claude Code จริง** (ไม่มี `claude` ใน PATH; ต้องผู้ใช้ล็อกอินเอง + ใช้โควตา) → ดู §3 · ✅ ฝั่งเว็บพร้อมรับเมื่อมี endpoint |

### 1.2 `01_Basic_AI_WORFLOW` (Loop · Graph · Dynamic — การเขียนพรอมต์เวิร์กโฟลว์)

| บทเรียน | สอน · ให้เทสต์ | ที่ทำในโปรเจกต์ | สถานะ |
|---|---|---|---|
| **Loop** (`labs/prompts/loop/loop-template.md`) | GENERATOR + CRITIC วนซ้ำ มีเกณฑ์หยุด (≤ 3 รอบ) · โจทย์ 1 จองห้องประชุม · 2 สัมภาษณ์เบิกค่าใช้จ่าย → FR/BR/NFR/ERD/Mockup | เฟส 2 BA + User Story: `docs/trace/phase2-loop.md` · เกณฑ์ C1–C3 เป็นสคริปต์ `tools/check-phase2.mjs` (ผ่านใน Iteration 2) → `docs/02-BA.md`, `docs/03-USER-STORIES.md` | 🔧 ➕ เกณฑ์ตรวจเป็นโค้ด (ไม่ใช่ตา) เพื่อให้ CRITIC ไม่เห็นด้วยตัวเอง |
| **Graph** (`lab-results/graph/…`) | แตกงานเป็น node ขนาน (∥) แล้ว node รวม (MERGER) ตรวจจุดเชื่อม | เฟส 3 และ v2-ส่วน A3–A4: N1 → N2 (SA) ∥ N3 (SAD) ∥ N4 (SRS) → N5 รวมตรวจ · ผล `docs/trace/phase3-graph.md`, `phase-v2-graph.md` (N5 ครั้งแรก C2 ล้ม 1 จุด → แก้ → ผ่านรอบสอง) · `tools/check-phase3.mjs` | ✅ 🔧 (v2 รอบนี้ N2–N4 เป็น subagent จริง ไม่ใช่จำลองบทบาทเหมือน v1) |
| **Dynamic** (`lab-results/dynamic/…`: plan-v1 → after-T1…T5 → plan-current + execution-table) | แผนเปลี่ยนระหว่างทางเมื่อมีเหตุ (CR กลางทาง) · เก็บเหตุผล/impact/reuse | แผนเปลี่ยนจริงหลายครั้ง: `PLAN.md` "Plan Version Log" (v1→v5) + CR 6 ฉบับที่แก้กลางงาน → `docs/impact/CR-0N.md` (reuse: ทำซ้ำเฉพาะที่กระทบ) · `legacy/CR-PROMPT.md` | 🔧 ❌ ไม่ได้ทำ artefact แบบบท (`plan-current.json`/`execution-table.md`) — ใช้ Plan Version Log + impact doc แทน |

### 1.3 `02_MCP` · `03_Jev_Application`

| บทเรียน | สอน · ให้เทสต์ · เครื่องมือ | ที่ทำในโปรเจกต์ | สถานะ |
|---|---|---|---|
| `02_MCP/01` | Host / Client / Server · Tools/Resources/Prompts · stdio vs Streamable HTTP · **เขียน MCP server ของตัวเอง** (Kokoro TTS · Whisper STT) | ใช้ฝั่ง client: `.mcp.json` (Playwright MCP `--isolated --browser chromium`) + `tools/mcp-bridge.mjs` ถือ session เดียวเปิดไว้ให้สั่งทีละขั้น + `tools/mcp-client.mjs` บันทึกทุก `tools/call` ที่ `screenshots/mcp/trace.jsonl` | ✅ ใช้ MCP · ❌ **ไม่ได้เขียน MCP server เอง** (เป็นทางเลือกในแผน: tools ดูรอบว่าง · คิดราคา · จอง) |
| `02_MCP/02` | ให้ AI ติดตั้ง Playwright / Excalidraw / Kokoro MCP (พรอมต์ S0–S6) · ตรวจว่าใช้ได้จริงด้วยเว็บสาธารณะ | Playwright MCP 0.0.83 ติดตั้งและใช้ตั้งแต่เฟส 0 (`docs/00-ENVIRONMENT.md`, `screenshots/mcp/phase0-after-click.png`) · เดิน 8 journey 163 tools/call (`docs/05b-EXPLORATION.md`) · รัน TC 88 ข้อ (`docs/TEST-RUN-MCP.md`, ภาพ `exploration/mcp-run/`) · BUG-HUNT ซ้ำด้วย MCP 79 call (`screenshots/mcp/bug-hunt/`) | ✅ ➕ ใช้ MCP เป็นตัวสำรวจ+ตัวรันเทสต์แบบคน (ไม่ใช่แค่ทดสอบติดตั้ง) · ⏭ Excalidraw/Kokoro/Whisper ไม่เกี่ยวกับงาน (ใช้ Mermaid + `tools/render-mermaid.mjs` แทน Excalidraw) |
| `02_MCP/03` | (ไฟล์ว่าง มีแต่ "# Test") | – | – |
| `03_Jev_Application` (`main_prompt.md`, `web_agent_prompt.md`, `clef/`) | agent เดินเว็บเป็นลูป: ถ่าย snapshot → แปลงเป็น state → ถาม Jev (ตัวเลือก `next` · `action` click/type/finished/stuck) → ทำ → ซ้ำ ≤ 12 ขั้น · ใช้ Playwright MCP + skill `typesafe-ai` · `clef/` = vision benchmark + server | วงเดินเว็บแบบเดียวกันทำด้วย Playwright MCP โดยตรง (snapshot → ตัดสินใจ → คลิก/กรอก) ใน `docs/05b-EXPLORATION.md` และ `docs/TEST-RUN-MCP.md` · **ไม่ได้ใช้ Jev/TypeSafe** | 🔧 ❌ ไม่ได้ทำ "agent ลูกค้าจำลองเดินเว็บเราด้วย web_agent_prompt" (ไม่มีโมเดล Jev/skill `typesafe-ai` ในเครื่อง) |

### 1.4 `00_tester` 01–06

| บท | สอน · ให้เทสต์ · เครื่องมือ | ที่ทำในโปรเจกต์ | สถานะ |
|---|---|---|---|
| `01_playwright-install` | ติดตั้ง Playwright (Windows/macOS) · เบราว์เซอร์ 3 ตัว · Extension ใน Chrome ตัวจริง · ค้นหา Google ผ่าน MCP | `@playwright/test` 1.64.0 + เบราว์เซอร์ที่ `D:/ms-playwright` (`docs/00-ENVIRONMENT.md`) · `e2e/playwright.config.ts` | ✅ ติดตั้ง · ⏭ Extension ใน Chrome ตัวจริง (เรื่องเครื่อง ไม่ใช่งานส่ง) |
| `02_petshop-test-from-plan` | เทสต์ตามแผน TEST-PLAN.md · 3 เบราว์เซอร์ · GIF/MP4 · รายงานแบบ tester (`reporters/tester-report.ts`) · BUG_MODE ฝึกจับบั๊ก · **LAB 9 เขียน test ใหม่จากประโยคภาษาคน** + `CLAUDE.md` | `e2e/` (`playwright.config.ts`, `reporters/tester-report.ts`, `run-all.mjs`, `build-index.mjs` → `e2e/index.html`) · `npm run test:gif` · `BUG_MODE` (`web/compose.yaml`) · LAB 9: CLAUDE.md หัวข้อ "เขียน test จากประโยคภาษาไทย" + เทสต์ `e2e/tests/cr/*.spec.ts` (1 ประโยคร้าน = 1 test · `test.step` ภาษาไทย) | ✅ 🔧 ➕ แยกวัน/สนาม/เบอร์ต่อเบราว์เซอร์แทน `workers:1` + reset ทุก test (เร็วกว่า ~4 เท่า — แผนข้อ 6) |
| `03_petshop-testplan-from-exploration` | สำรวจ (ห้ามอ่านโค้ด) → EXPLORATION → แผนเอง 8 หัวข้อ · ป้าย [D]/[R]/[O] · อบบั๊กในผลที่คาดหวัง · Fast Track (บอกใบ้ / black-box) · **รูบริก 20** | `docs/EXPLORATION.md`, `docs/09-TEST-PLAN.md`, `docs/PLAN-REVIEW.md`, `docs/TEST-CASES.md` (128 TC + เฉลย), `e2e/plan-cases.json` · **19.5/20** | ✅ 🔧 ➕ TC 128 ข้อ (บทมี ~50) · ทำ coverage matrix ฟีเจอร์ × เทคนิค · แผนเป็น 2 รอบ (v1 60 TC → v2 128) |
| `04_sabai-spa-web-and-testplan-from-interview` | สัมภาษณ์ → US → REQUIREMENTS (BR ค่าขอบ 3 ค่า) → DESIGN → TEST-DATA → BUILD-PROMPT → เว็บ db/web แยก → ฟัง 3 ทาง [D]/[A]/[O] → แผน → Playwright + index.html → บั๊กปริศนา + BUG-HUNT · **รูบริก 20** | `docs/01-INTERVIEW.md` (A-01–A-50) · `02-BA` · `03-USER-STORIES` (52 US) · `04-REQUIREMENTS` (FR 48 · BR 45 · NFR 24) · `05-SRS` · `06-SA` · `07-SAD` · `TEST-DATA.md` (E01–E148) · `08-BUILD-PROMPT.md` · `web/` + `db/` · `docs/EXPLORATION.md` · `docs/BUG-HUNT.md` (จับ 3/3) · **19/20** | ✅ ➕ สัมภาษณ์ 2 รอบ (รอบ 2 เพิ่มแชท/คลัง/แดชบอร์ด) · SRS+SAD แยกจาก SA · ❌ `docs/04-REQUIREMENTS.md` ไม่ได้อัปเดตตาม CR (BR-46–51 เป็นร่างใน `legacy/TRACEABILITY.md`) |
| `05_rea-reverse-engineer-legacy-petshop` | รับช่วงระบบเดิม: CODEBASE-MAP (`file:line`) · **REA** (`rea-lab:6.4.0`) ส่องของที่ build/รัน · HAR · ป้าย **[E]** · golden master · แก้บั๊กแดงก่อน · CR ฟีเจอร์ · พิสูจน์ด้วย hash + REA · **รูบริก 20** | `legacy/SYSTEM-MAP.md` (219 แถว) · `HANDOVER-CHECK.md` (48 คำอ้าง) · `REA-INVENTORY.md` (23+21 แถว `[E ev_…]`) · `API-INVENTORY.md` + `legacy/har/journey.stripped.har` · `tests/golden/` · `legacy/BASELINE.md` · `legacy/MUTANTS.md` · `legacy/REA-COMPARE.md` · `CLAUDE.md` + `.claude/settings.json` · **18/20** | ✅ 🔧 ใช้ v2 ของตัวเองเป็น "ระบบเดิม" (tag `v2-handover`) · ➕ ฐานข้อมูลเสมือนจริง 630 การจอง (`tools/make-prod-like-data.mjs`, `legacy/PROD-LIKE-DATA.md`) · ❌ รั้ว `.claude/settings.json` ยังไม่ทดสอบในเซสชันใหม่ |
| `06_sabai-spa-legacy-change-request` + `EXAM.md` | รับมอบ → รั้ว → ตาข่าย (golden + mutant) → **CR 5 ฉบับ** (กฎมีวันมีผล · บั๊กร้องเรียน · migration + rollback · ฟีเจอร์ · รายงาน+CSV) → regression + REA เทียบ → release notes · UAT · ซ้อมถอยกลับ · smoke · ข้อสอบ 4 ชม. 100 คะแนน · **รูบริก 20** | `CHANGE-REQUESTS/` (CR-01…06 + `REGISTER.md` + `answers/`) · `docs/impact/CR-0N.md` · commit `CR-0N-red:` → `CR-0N:` ครบ 6 ฉบับ · `ORACLE-CHANGES.md` (12 แถว) · `legacy/REGRESSION-REPORT.md` · `legacy/TRACEABILITY.md` · `RELEASE-NOTES.md` · `UAT-CHECKLIST.md` · `docs/RUNBOOK.md` ข้อ 9 (ซ้อมถอยกลับ 009→006→009) · `tests/smoke.mjs` · `legacy/CR-PROMPT.md` · **18/20** | ✅ ➕ CR-06 (เงินคำท้า) เป็นงานที่ทีมค้นพบเองระหว่าง CR-03 แล้วเสนอร้าน · ➕ regression 2 รอบ · CR ของเราคนละเรื่องกับสปา (ล็อกเอาต์, 5 จุด, รายงาน, แชทจำบทสนทนา, ราคามีวันมีผล, เงินคำท้า) · ❌ ไม่ได้ทำ `EXAM.md` ชุดจำลอง (ทางเลือก ⭐) · ❌ UAT ยังไม่ได้เดิน/เซ็น |

## 2. ระบบ production ที่ต้องได้ (สนามบอล) — โยงกลับบทเรียน (สถานะ ณ 21 ต.ค.)

| ส่วนของระบบ | สถานะ | ที่ไหน | แบบจาก |
|---|---|---|---|
| **หน้าบ้าน** ลูกค้า | ✅ ครบ v1 + ปุ่มแชทลอยทุกหน้า + timeline ติดตามการจอง · ราคาเย็น A/B ฿1,300 ตั้งแต่ 1 พ.ย. (CR-05) | `web/app/{book,pay,booking,my,series,split,challenges,fields}` · `web/components/ChatWidget.tsx` · EXPLORATION ส่วน A (28 หน้า) | BuildMart 3.6, 3.8 |
| **หลังบ้าน** พนักงาน / ผู้จัดการ / เจ้าของ | ✅ เช็กอินวันเตะ · ไม่มา · คืนของ · ภาพรวมวันนี้ · ปิดฝน · วันหยุด · **แดชบอร์ด** · **การจองทั้งหมด + ประวัติสถานะ (ชื่อพนักงาน)** · **รายงานช่วงวัน ≤ 3 เดือน + CSV (BOM) เฉพาะเจ้าของ แยกช่องทางเงิน + ชั่วโมงใช้สนาม + เงินคำท้า** | `web/app/{staff,manager,owner}/**` | BuildMart 3.7 · บท 06 CR-05 → CR-02/03/06 ของเรา |
| **คลังข้อมูล / คลังของ** | ✅ ของ × จุดเก็บ (8 แถว seed) · ขาย/ย้าย/รับเข้า/ชำรุด/ปรับยอด · **จุดสั่งซื้อซ้ำ + เตือนของต่ำ** · ประวัติเคลื่อนไหว (migration 003) | `web/app/staff/stock`, `manager/stock` · `db/migrations/003_stock.sql` · TC-STOCK/SALE | BuildMart stock หลายสาขา + reorder |
| **การจัดสรร** | 🔧 ตีความตามที่อาจารย์ทำ: ตัดสต็อกของเช่าตามช่วงเวลา (BR-22) · ย้ายของระหว่างจุดเก็บ (TC-STOCK) · จัดสนามอัตโนมัติ **ไม่ได้ทำ** (ผู้ใช้ไม่แน่ใจความหมาย — ข้อ 3) | `web/lib/rules/stock.ts` | BuildMart ตัดสต็อกสาขาที่เลือก |
| **Chatbot "น้องบอล"** | ✅ ทำรายการจริงด้วย tag · ตัด tag ก่อนแสดง · ห้ามแต่งราคา · ปฏิเสธนอกเรื่อง · TH/EN · ประวัติใน DB · mock + ai(mock-llm) · จำบทสนทนา (CR-04) · ล่ม = ขอโทษ ❌ ไม่เคยทดสอบกับโมเดลจริง | `web/lib/chat/**` · `web/mock-llm/` · TC-CHAT-01–20 | Vast LAB ex2 · BuildMart 4 |
| **เทสต์แชทบอท** | ✅ "ต้องมี/ห้ามมี" + baseline + คำตอบจริง + GIF · ผ่านทั้ง mock และ ai-ผ่าน-mock-llm | `e2e/test-report/CHATBOT-REPORT.md` | Vast LAB ex2 4.3 |
| **พร้อมใช้งานจริง** | ✅ db/web แยก 2 compose · `.env.example` ไม่มีความลับ · migration 001–009 รันซ้ำได้ + `.down.sql` · สำรอง/กู้คืน · smoke อ่านอย่างเดียว · release notes · UAT checklist · ซ้อมถอยกลับ · ห้าม `down -v` | `db/compose.yaml`, `web/compose.yaml`, `db/migrations/`, `scripts/{migrate,backup,restore}.mjs`, `tests/smoke.mjs`, `RELEASE-NOTES.md`, `UAT-CHECKLIST.md`, `docs/RUNBOOK.md` | บท 04, 06 |
| (ทางเลือก) MCP server ของสนาม | ❌ ไม่ได้ทำ | – | 02_MCP |

## 3. คำตอบผู้ใช้ (2026-10-18) และสถานะ

| เรื่อง | ตอบ | สถานะ |
|---|---|---|
| สมองแชทบอท | **`MODE=mock`** (ทดสอบฟรี ตอบแน่นอน) + **`MODE=ai` ผ่าน gateway แบบ `00_setup/05`** ที่เรียก Claude Code ของผู้ใช้ (ถามก่อนเปิดใช้) | mock ✅ · ai ผ่าน `mock-llm` ✅ · **gateway จริง ❌ ยังไม่ทำ** (ต้องติดตั้ง CLI + ผู้ใช้ล็อกอินเอง + ใช้โควตา) |
| คลังอุปกรณ์ | ทีมเสนอรายการ ผู้ใช้ยืนยัน | ✅ (`docs/TEST-DATA.md` ข้อ 4, A-32) |
| "จัดสรรข้อมูล" | ผู้ใช้ไม่แน่ใจ ให้ยึดจากที่อาจารย์ทำ → นิยามข้อ 4 | ✅ ใช้นิยามข้อ 4 |

## 4. "การจัดการข้อมูลเบื้องหลัง" ตามที่อาจารย์สอน (นิยามที่ใช้ + ที่อยู่ของจริง)

| หลัก | มาจาก | ในระบบสนามบอล (ไฟล์ที่มีจริง) | สถานะ |
|---|---|---|---|
| ข้อมูลตั้งต้นมีแหล่งเดียว | บท 04 TEST-DATA | `docs/TEST-DATA.md` → `db/init/02-seed.sql` · ตรวจ `web/selfcheck/check-testdata.mjs` 151/151 | ✅ |
| ฐานข้อมูลบังคับกฎเอง | บท 06 ข้อ 2 (`CHECK` · `EXCLUDE`) | `db/migrations/005_constraints.sql` (สนามเดียวกันห้ามซ้อนเวลา · จำนวน/เงินห้ามติดลบ) | ✅ |
| เปลี่ยน schema ด้วย migration แยกไฟล์ | บท 06 ข้อ 5 | `db/migrations/001–009` + `.down.sql` ทุกไฟล์ · `scripts/migrate.mjs` · `/api/version` · ข้อควรระวัง `--down N` ไม่บังคับลำดับ (CLAUDE.md) | ✅ ➕ ซ้อมบนฐาน 630 การจอง |
| สำรอง / กู้คืน / ซ้อมถอยกลับ | บท 06 LAB 12 · EXAM ข้อ 8 | `scripts/backup.mjs` · `scripts/restore.mjs` · `docs/RUNBOOK.md` ข้อ 3, 4, 9 | ✅ |
| ร่องรอยตรวจย้อนได้ | บท 06 ข้อ 6 · `order_status_history` | ประวัติสถานะการจอง (migration 002) · ประวัติเคลื่อนไหวสต็อก (003) · ประวัติแชท (004) · `owner/audit` | ✅ (ข้อสังเกต: ชื่อพนักงานในประวัติตาม username ปัจจุบัน — `RELEASE-NOTES.md` K12) |
| แยกสิทธิ์ตามบทบาท | NFR-05 · BuildMart `/admin` · CR-05 เฉพาะเจ้าของ | ลูกค้า/พนักงาน/ผู้จัดการ/เจ้าของ (TC-ROLE-01–04) · session ถอนสิทธิ์ได้ (CR-01, migration 007) | ✅ |
| ช่องทดสอบปิดได้ในโหมดจริง | บท 06 ข้อ 3 (seam) | `ALLOW_TEST_RESET=0` → `/api/test/*` 404 (`legacy/BASELINE.md` ข้อ 4) | 🔧 ปิดไม่หมด: "ตอนนี้" ยังอ่านแถว `app_settings.clock` (K3) |
| ความลับไม่หลุด | 00_setup 05 · BuildMart 5 | `.env` ไม่ commit · `db/.env.example` · `.gitignore` · HAR ตัด cookie เป็น `REDACTED` | ✅ ❌ DB role ของเว็บเป็น superuser (K2) |
| ข้อมูลส่วนบุคคล | NFR-04 (PDPA) | ยินยอม PDPA ก่อนจอง · ปิดเบอร์ในประกาศ/ประวัติแชท (BR-44/45) | ✅ |
| รายงานส่งออก | บท 06 CR-05 | `owner/reports` ≤ 3 เดือน · CSV BOM ภาษาไทย · เฉพาะเจ้าของ (CR-02/03/06) | ✅ |
| ค่าที่คาดหวังของรายงานมาจาก SQL ก่อนเขียนโค้ด | บท 06 รูบริกข้อ 16 | `[E sql:…]` ใน `docs/09-TEST-PLAN.md` 7.3 · `docs/impact/CR-03.md` ข้อ 2.2 | ✅ |
| กระทบยอดหลังขึ้นระบบ | (เกินบทเรียน) | `tools/reconcile-challenges.sql` ต้องได้ 0 ทั้งคู่ (CR-06) | ➕ เพราะ migration 009 เติมเงินย้อนหลัง — ตัวเลขผิดเงียบ ๆ ไม่มีเทสต์จับได้ |

## 5. ช่องว่างตรง ๆ (ณ 21 ต.ค. 2569)

รวม **12 ช่องว่างจริง** + **2 กลุ่มที่ตั้งใจไม่ทำ** (เรียงตามความสำคัญต่อการส่งงาน)

| # | ช่องว่าง | บทเรียน | ผลกระทบ / ทางปิด |
|---|---|---|---|
| 1 | **ไม่เคยทดสอบรั้ว `.claude/settings.json` ในเซสชันใหม่** + กฎ `Write(...)` 4 บรรทัดที่ไม่มีผลยังอยู่ | 05 LAB 1 · 06 LAB 4 | ทำ 6 ขั้นใน `legacy/FENCE-TEST.md` ในเซสชันใหม่ที่เปิดที่ `football-booking/` แล้วจดผล |
| 2 | **ไม่มี gateway เรียก Claude Code จริง / ไม่เคยทดสอบแชทกับโมเดลจริง** (มีแค่ `mock-llm`) | 00_setup 05 · 04.1 | แชทผ่านทุกเทสต์แต่เป็นสมอง mock — พฤติกรรมกับโมเดลจริงยังไม่รู้ (`legacy/TRACEABILITY.md` T8, `legacy/SYSTEM-MAP.md` K4) · ต้องผู้ใช้อนุญาต + ล็อกอิน |
| 3 | **หลักฐานสื่อของ e2e ยังไม่ครบหลัง CR** — `e2e/index.html` + `test-report/*` เป็นรอบเต็มล่าสุดแล้ว (21 ต.ค. 389/390, `fdb5673`) แต่เทสต์ CR (`e2e/tests/cr/*` ~49 test) ไม่มี GIF/MP4 (`gifs/` `videos/` ยังเป็นรอบ 20 ต.ค. 139/139) · `e2e/triage.json` ยังเป็นของ 20 ต.ค. ไม่มี TC-PRICE-04 (webkit flaky ที่ล้มรอบล่าสุด) | 04 LAB 11–12 | `npm run test:gif` เฉพาะ `tests/cr/` + เพิ่ม TC-PRICE-04 ใน `triage.json` แล้ว `node build-index.mjs` |
| 4 | **`docs/04-REQUIREMENTS.md` ไม่ได้อัปเดตตาม CR** (BR-07 ยัง ฿1,200 ฯลฯ) → ความจริงอยู่ที่ TRACEABILITY/impact | 04 · 06 LAB 11 | ใส่ BR-46–51 และแก้ BR-07/09/19/20/23/39/40/42 แล้วอัปเดต TC ที่อ้าง |
| 5 | **UAT ยังไม่ได้เดินมือ ไม่มีลายเซ็นร้าน** · REGISTER ยังไม่ขึ้น "รอตรวจรับ" | 06 LAB 12 | ผู้ใช้ (ในฐานะร้าน) เดิน `UAT-CHECKLIST.md` |
| 6 | **`web/BUGS.md` (เฉลยบั๊กที่ฝัง) อยู่ใน git** — push ไป repo สาธารณะจะเปิดเฉลย | 04 รูบริกข้อ 7 | ถามผู้ใช้ก่อน push (PLAN.md 🙋) — ย้ายออกหรือรับได้ |
| 7 | **TC-SERIES-04 (P1) ข้ามใน e2e** (พิสูจน์ผ่านหน้าเว็บไม่ได้ → unit E75) + firefox TC-MEMBER-06 flaky | 03/04 Exit | Exit ตามตัวอักษร (P1 74/74) ไม่ถึง · แก้: เขียนแผนให้ยอมรับ unit เป็นหลักฐานของ TC นี้ |
| 8 | **รูของตาข่ายบท 05–06**: ไม่มีหัวข้อ "ตรวจทานโดยคน" ใน SYSTEM-MAP · golden ไม่ครอบยอดที่บันทึกจริง/แชท/หน้าแรก · ไม่มีเทสต์ส่งชนิดข้อมูลผิดเข้า API ของ CR · impact CR-05 พลาดหน้าแรก (REVIEW-1) | 05 ข้อ 7, 14, 15 · 06 ข้อ 3 | ดู `RUBRIC-SELF-CHECK.md` |
| 9 | **ไม่มี CR ชนิด "เลื่อนนัด" และ "กดพร้อมกันหลายช่องทาง"** (มีแค่ TC ชุดเดิม) | 06 CR-01/CR-03 ของสปา | เพิ่มเทสต์เลื่อนทับเวลาเดิม + จองพร้อมกันสมาชิก/ไม่ล็อกอิน/แชท |
| 10 | **ไม่ได้เขียน MCP server ของสนามบอล** (tools: ดูรอบว่าง · คิดราคา · จอง) | 02_MCP/01 | ทางเลือก — ทำเมื่อต้องการให้ AI จองได้ |
| 11 | **ไม่ได้ทำ agent ลูกค้าจำลองด้วย `web_agent_prompt.md` (Jev)** | 03_Jev | ทางเลือก — ใช้ Playwright MCP ตรงแทน (ผลเทียบเท่าแต่ไม่ได้ลองวิธีของบท) |
| 12 | **Dynamic workflow ไม่มี artefact แบบบท** (`plan-current.json`, `execution-table.md`) + แชท "จองเลย" ไม่จำ (K1) + DB role superuser (K2) + seam ปิดไม่หมด (K3) | 01 Dynamic · 06 ข้อ 3 | ทั้งหมดเขียนไว้ใน `RELEASE-NOTES.md` ข้อ 3 แล้ว ยังไม่แก้ |
| – | ⏭ ตั้งใจไม่ทำ: `00_setup` 01–03 / 04.2 ตัวคุมวง + EUBF + หลายบัญชี / Vast.ai เช่า GPU | 00_setup | เสียเงินจริง/ต้องหลายบัญชี — subagent ทำหน้าที่แทน |
| – | ⏭ ตั้งใจไม่ทำ: Extension Playwright ใน Chrome ตัวจริง · ข้อสอบจำลอง `EXAM.md` (ชุด A 4 ชม.) | 00_tester/01, 06 | เรื่องเครื่อง / ต้องมี `sabai-legacy.zip` จากอาจารย์ |

**ข้อสังเกตเรื่องเอกสาร:** `legacy/TRACEABILITY.md` ช่องว่าง T13 ("ไม่มี `tests/smoke.mjs`") ล้าสมัยแล้ว — มีไฟล์นี้ตั้งแต่ `c31a592` · ไม่ได้แก้ในรอบนี้ (ไม่อยู่ในขอบเขต)
