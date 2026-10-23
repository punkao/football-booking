# โครงสร้าง repo (จัดรากให้เรียบ) · ใครอ้างอะไร · ย้ายอะไรไปไหน

เป้าหมาย: คนเปิด GitHub ครั้งแรกเห็นรากสั้น ๆ เข้าใจได้ว่าอะไรคือ "เริ่มตรงนี้" โดย **ไม่ทำให้อะไรพัง** (เว็บ · Portal `/project` · test · เครื่องมือ · ลิงก์ในเอกสารยังทำงานเหมือนเดิม) · ตรวจลิงก์ได้ด้วย `node tools/check-links.mjs`

## 1) ก่อน → หลัง

| | ก่อน (รากมี 12 โฟลเดอร์ + 9 ไฟล์ .md) | หลัง |
|---|---|---|
| โฟลเดอร์ | CHANGE-REQUESTS · assets (ว่าง ไม่อยู่ใน git) · db · docs · e2e · exploration · legacy · screenshots · scripts · tests · tools · web | db · docs · e2e · exploration · legacy · scripts · tests · tools · web |
| ไฟล์ .md | CLAUDE · HANDOFF · KNOWN-ISSUES · NEXT-TASKS-PROMPT · ORACLE-CHANGES · PLAN · README · RELEASE-NOTES · UAT-CHECKLIST | CLAUDE · ORACLE-CHANGES · README |
| ไฟล์ใช้งาน | compose.yaml · start.sh · start.ps1 · .mcp.json · .gitignore · .gitattributes | เหมือนเดิม |

## 2) ย้ายอะไรไปไหน (`git mv` · ประวัติไฟล์ยังตามได้ด้วย `git log --follow`)

| เดิม (ราก) | ใหม่ | กลุ่ม |
|---|---|---|
| CHANGE-REQUESTS/ (หนังสือ CR-01…06 · REGISTER · answers/ · 00-HANDOVER-MEMO) | `docs/handover/CHANGE-REQUESTS/` | ส่งมอบ |
| RELEASE-NOTES.md | `docs/handover/RELEASE-NOTES.md` | ส่งมอบ |
| UAT-CHECKLIST.md | `docs/handover/UAT-CHECKLIST.md` | ส่งมอบ |
| KNOWN-ISSUES.md | `docs/handover/KNOWN-ISSUES.md` | ส่งมอบ |
| PLAN.md | `docs/process/PLAN.md` | วิธีทำงาน |
| HANDOFF.md | `docs/process/HANDOFF.md` | วิธีทำงาน (เริ่มทำต่อจากไฟล์นี้) |
| NEXT-TASKS-PROMPT.md | `docs/process/NEXT-TASKS-PROMPT.md` | วิธีทำงาน |
| screenshots/ (uat · mcp · phase5) | `docs/evidence/screenshots/` | หลักฐาน |

## 3) ใครอ้างถึงรายการที่ย้าย (ค้นทั้ง repo ที่ commit `f43c8fc` · ไม่นับ `tools/node_modules` และ `web/BUGS.md` ที่ห้ามเปิด) และแก้ที่ไหน

| รายการ | จำนวนไฟล์ที่อ้าง | ชนิดของผู้อ้าง | วิธีจัดการ |
|---|---|---|---|
| CHANGE-REQUESTS/ | 49 | ลิงก์/ข้อความใน docs ~24 · annotation ใน `e2e/tests/cr/*` (แก้ได้) · comment ใน `web/lib/**/*.test.ts` · `tools/check-phase3.mjs` (อ่านไฟล์จริง) · `web/compose.yaml` + `web/lib/server/project.ts` (Portal) · `web/selfcheck/portal-check.mjs` · **CLAUDE.md 1 บรรทัด (ห้ามแก้ → ดูข้อ 6)** · `e2e/test-report/results.json` (ผลรันที่สร้างเอง ไม่แก้) | แก้ทุกที่ที่แก้ได้ · Portal ใช้เลย์เอาต์เสมือนเดิม (ดูข้อ 4) |
| RELEASE-NOTES / UAT-CHECKLIST | 16 / 17 | docs · README · legacy/* · `web/compose.yaml` · `project.ts` · `portal-check.mjs` · `web/lib/rules/now.test.ts` · `e2e/tests/my/uat-walk.serial.spec.ts` (comment) | แก้หมด |
| KNOWN-ISSUES.md | 9 | docs · `e2e/tests/cr/wrong-type-inputs.serial.spec.ts` · `web/lib/rules/now.test.ts` (comment) | แก้หมด |
| PLAN.md | 59 (20 คือรายงานรันเก่าใน `e2e/test-report`, `e2e/normal-mode`, `e2e/index.html` — ส่วนใหญ่เป็นคำว่า TEST-PLAN.md ไม่ใช่ไฟล์นี้) | docs · README · HANDOFF · `docs/trace/dynamic/plan-*.json` | แก้หมดที่เป็นไฟล์นี้จริง |
| HANDOFF.md | 7 | README · docs/trace · legacy/* · NEXT-TASKS-PROMPT | แก้หมด · ตัว memory ของผู้ใช้ที่ชี้ football-booking/HANDOFF.md ต้องเปลี่ยนเป็น `football-booking/docs/process/HANDOFF.md` |
| NEXT-TASKS-PROMPT.md | 1 (ตัวเอง) | – | – |
| screenshots/ | 30 | `.mcp.json` (output-dir) · `.gitignore` · `tools/mcp-bridge.mjs` · `tools/mcp-client.mjs` · `e2e/tests/my/uat-walk.serial.spec.ts` (เขียนผล UAT) · docs (UAT-RUN, TEST-RUN-MCP …) · `docs/evidence/screenshots/uat/results-CR-0N.json` (path ภาพในตัวมันเอง) | แก้หมด · ภาพ UAT ใน Portal เห็นได้แล้ว (อยู่ใน mount `docs`) |

## 4) Portal `/project` และ Docker mount (ไม่เปลี่ยน URL)

- `web/compose.yaml` ยัง mount ไฟล์ส่งมอบ **ทีละไฟล์** ไปที่ `/app/project/handover/...` ในเลย์เอาต์เสมือนเดิม (`handover/RELEASE-NOTES.md` · `handover/CHANGE-REQUESTS/…` · `handover/legacy/…`) แต่ **ต้นทางเปลี่ยนเป็น `docs/handover/…`** → URL ของ Portal (`/project/handover/RELEASE-NOTES.md` ฯลฯ) ไม่เปลี่ยน
- `web/lib/server/project.ts` เพิ่ม `handoverRepoPath()` / `handoverVirtualPath()` (แปลง path เสมือน ↔ path จริงใน repo) และ `web/lib/server/markdown.ts` ใช้แปลงตอนแก้ลิงก์ในไฟล์ markdown ที่เปิดผ่าน Portal (ลิงก์สัมพัทธ์ในไฟล์ที่ย้ายจึงยังชี้ถูก)
- ผลข้างเคียงที่ตั้งใจรับ: `docs/handover/*` · `docs/process/*` · `docs/evidence/*` อยู่ใต้ `docs/` ซึ่ง Portal mount ทั้งโฟลเดอร์แบบอ่านอย่างเดียวอยู่แล้ว → เปิดตรงที่ `/project/docs/process/PLAN.md` ได้ (เดิมเข้าไม่ได้) · ไม่มีความลับในไฟล์เหล่านี้ (รหัสผ่านอยู่ใน `.env` ที่ไม่ได้ mount) · ถ้าไม่ต้องการ ให้ย้าย `docs/process/` ออกจาก docs หรือจำกัดที่ `safeResolve`
- `e2e/build-index.mjs` / `build-plan-cases.mjs` ไม่ต้องแก้ (ไม่ได้อ้างไฟล์ที่ย้าย)

## 5) อะไรอยู่ที่ราก และทำไม

| รายการ | อยู่ที่ราก เพราะ |
|---|---|
| README.md · CLAUDE.md · `.claude/` · `.mcp.json` · `.gitignore` · `.gitattributes` · `compose.yaml` · `start.sh` · `start.ps1` | ตามกติกาโปรเจกต์ (เครื่องมืออ่านที่รากเท่านั้น) |
| `web/` `db/` `e2e/` `tools/` `tests/` `scripts/` | โค้ด/เครื่องมือ ผู้อ้างคือ compose และ script จำนวนมาก (ไม่แตะ) |
| ORACLE-CHANGES.md | CLAUDE.md สั่ง "จดแถวใน ORACLE-CHANGES.md" + ชื่อนี้อยู่ในคอมเมนต์ของ test เดิมที่ห้ามแก้ (`e2e/tests/member.serial.spec.ts` · `staff.serial.spec.ts` · `member.spec.ts` · `owner.spec.ts` ฯลฯ) · เป็นบันทึกกติกาที่ต้องเปิดบ่อย |
| legacy/ | CLAUDE.md อ้าง 6 จุด (SYSTEM-MAP · HANDOVER-CHECK · SPEC-GAPS · BASELINE · MUTANTS) + 45 ไฟล์อ้าง + Portal mount `legacy/*` + `tools/record-har.mjs` + `web/lib/server/crypto.ts` → ย้ายแล้วเสี่ยงมากกว่าได้ |
| exploration/ | `e2e/plan-cases.json` (เฉลย ห้ามแก้) เก็บ path `exploration/mcp-run/TC-*.png` ของ 30 กว่า TC และ `e2e/build-plan-cases.mjs` สร้างไฟล์นั้นใหม่จาก `docs/TEST-RUN-MCP.md` ทุกรอบ → ถ้าจะย้ายต้องอนุมัติให้แก้ไฟล์เฉลย |
| docs/ | มีอยู่แล้ว (ตอนนี้มีกลุ่มย่อย `handover/` `process/` `evidence/` เพิ่ม) |

`assets/` เป็นโฟลเดอร์ว่าง ไม่ได้อยู่ใน git (GitHub ไม่เห็น) · `อธิบาย.txt` เป็นไฟล์ที่ยังไม่ได้ติดตามใน git (ไม่แตะ)

## 6) บรรทัดที่ผู้ใช้ต้องแก้เองใน CLAUDE.md (ห้ามเอเจนต์แก้)

บรรทัดเดียวที่อ้างของที่ย้าย (หัวข้อ "เขียน test จากประโยคภาษาไทย" ข้อ 2) — เปลี่ยนจาก

```text
annotation อ้างแหล่ง (`CHANGE-REQUESTS/CR-0N.md` · คำตอบร้าน `CHANGE-REQUESTS/answers/` · TC เดิม)
```

เป็น

```text
annotation อ้างแหล่ง (`docs/handover/CHANGE-REQUESTS/CR-0N.md` · คำตอบร้าน `docs/handover/CHANGE-REQUESTS/answers/` · TC เดิม)
```

ส่วน `ORACLE-CHANGES.md` และ `legacy/...` ใน CLAUDE.md **ไม่ต้องแก้** (ไม่ได้ย้าย)

## 7) ตรวจลิงก์ (`tools/check-links.mjs`)

```text
node tools/check-links.mjs            # exit 1 ถ้ามีลิงก์เสีย
node tools/check-links.mjs --verbose  # แสดงรายการที่ผ่อนปรน
```

ตรวจทุก markdown link แบบ relative และทุก path ใน backtick ของไฟล์ `*.md` (ข้าม `node_modules` `test-report` `normal-mode` `_solution`) · ถ้ายังมีใครอ้าง path รากแบบเดิมของรายการที่ย้าย (ข้อ 2) จะนับเป็นเสียเสมอ · ที่ผ่อนปรน (ไม่นับเป็นเสีย แต่แยกรายงาน): path ที่เขียนย่อตามบริบท (ท้าย path ตรงไฟล์จริง) · ชื่อไฟล์เปล่า · false positive ที่รู้แล้วรายไฟล์ (SAD รุ่นแรก · ชื่อชิ้นงานของอาจารย์ · ไฟล์ในระบบที่ build แล้ว ฯลฯ — เหตุผลเขียนไว้ใน `tools/check-links.mjs`)
