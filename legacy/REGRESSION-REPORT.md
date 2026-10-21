# REGRESSION-REPORT — ตอนส่งมอบ (หลัง CR-01…06) เทียบตอนรับมอบ (แผน L6 · บท 06 LAB 11 · บท 05 LAB 9)

ทำเมื่อ 2026-10-21 · ผู้ทำ: ทีมดูแลระบบ (chunk D-8) · ไม่แก้โค้ดระบบ ไม่แก้เทสต์ ไม่แก้ค่าที่คาดหวัง
ตัวเลขทุกตัวในไฟล์นี้มาจากการรันรอบนี้ (log เก็บไว้ที่ scratchpad ของ session · ตัวเลขตอนรับมอบอ้างจาก `legacy/BASELINE.md`)
ขนานกับไฟล์นี้: **REA เทียบ `v2-handover` ↔ HEAD** → [`legacy/REA-COMPARE.md`](REA-COMPARE.md) · **ซ้อมถอยกลับ** → `docs/RUNBOOK.md` หัวข้อ "ถอยกลับ (ซ้อมแล้ว 2026-10-21)" · **smoke** → `tests/smoke.mjs`

> ทำเพิ่มเกินบทเรียน (เหตุผลสั้น ๆ): รัน e2e เต็ม **2 รอบ** (บทเรียนรอบเดียว) เพราะแผน L6 ขอ "ตัวเลขต้องตรงเมื่อรันซ้ำ" · เก็บ sha256 ของ migration/golden เพราะ "ตัวเลขเขียว" พิสูจน์ไม่ได้ว่าเทสต์รันบนไฟล์ชุดไหน

## 0. สิ่งที่ทดสอบ (ระบุตัวตนให้ตรวจย้อนได้)

| รายการ | ค่า |
|---|---|
| git commit ที่ทดสอบ | `ea32d4d57eebbc37fa07d679dded8480e057365b` (`ea32d4d` HANDOFF: CR-06 open questions decided) · working tree สะอาดนอกจากไฟล์เอกสารของ agent อื่น |
| ฐานเทียบ | tag `v2-handover` = `faa3f2e` (HEAD อยู่หลังมา 40 commit · `git diff --shortstat` ทั้ง repo 186 ไฟล์ · +77,692 −547 ซึ่งส่วนใหญ่เป็น golden/เทสต์/เอกสาร) |
| โค้ดเว็บที่รัน | image `football-web:v2` = `sha256:3080c434b1f3…` (สร้างหลัง commit สุดท้ายที่แตะ `web/` `db/` = `6ed7ec4`) · `BUG_MODE=0` · `MODE=mock` · `ALLOW_TEST_RESET=1` |
| ฐานข้อมูล | `/api/version` = `{"schemaVersion":"009","chatMode":"mock","bugMode":0}` · reset `{}` ก่อนรันทุกชุด · "ตอนนี้" ล็อก ศ 9 ต.ค. 2569 10:00 |
| เครื่องมือ | Node 24.20.0 · Playwright (ชุดใน `e2e/node_modules`) · Postgres 16-alpine |

### sha256 (16 ตัวแรก) ของไฟล์สำคัญ ณ commit ที่ทดสอบ

| ไฟล์ | sha256 |
|---|---|
| `db/migrations/001_v1_baseline.sql` / `.down` | `e02ee321fe5c415e` / `4dec7b0f2dde4755` |
| `db/migrations/002_history_audit.sql` / `.down` | `4953e9e27f8ac576` / `745ce4fd0cafe726` |
| `db/migrations/003_stock.sql` / `.down` | `f8fbc19fa148e38e` / `b6b50d87ceb9a057` |
| `db/migrations/004_chat.sql` / `.down` | `20939fe4ff295a9c` / `2a501db932b0b937` |
| `db/migrations/005_constraints.sql` / `.down` | `7baedc6a6f79b8ff` / `661df9e65db5f637` |
| `db/migrations/006_chat_hardening.sql` / `.down` | `9a0a9a18afae8ed1` / `7e5211b9e1b88380` |
| `db/migrations/007_session_revocation.sql` / `.down` | `5699583dd6021c47` / `627dbe88486c1fd8` |
| `db/migrations/008_field_rates.sql` / `.down` | `f68156a4e96fd85c` / `6034e0de98e7324c` |
| `db/migrations/009_challenge_payments.sql` / `.down` | `747e41d10bf11b58` / `9f94236a574a5fd7` |
| `db/init/01-schema.sql` · `db/init/02-seed.sql` | `a61aa7ea30198779` · `297e93721a3252d0` |
| `tests/golden/quote.golden.json` | `ac43f1178a886d17` (= `[E golden/quote:ac43f117]` เดียวกับ BASELINE §3 → **ไม่เปลี่ยนตั้งแต่รับมอบ**) |
| `tests/golden/side.golden.json` | `6e21c080ca7455fc` (ตอนรับมอบ `a7fba5c2` → เปลี่ยนโดยมีแถว ORACLE-CHANGES: CR-02 `5536d83` + CR-03 `0837cbe`) |
| `tests/golden/quote-nov.golden.json` | `85064ff4af4ef6ea` (ใหม่ใน CR-05 `4f5e8ae` ไม่มีตอนรับมอบ) |
| `tools/reconcile-challenges.sql` | `3586d87b7e44bd87` |
| `e2e/plan-cases.json` | `074ee196c253529b` |
| `web/package-lock.json` · `web/Dockerfile` | `9d3d433d7b381d38` · `96c892171176dfee` |

## 1. e2e เต็ม 3 เบราว์เซอร์ + serial + perf — รัน 2 รอบ เทียบตอนรับมอบ

คำสั่ง (Git Bash, จาก `e2e/`): `RUN_MIGRATION_TEST=1 node run-all.mjs` · รอบหลักเสร็จแล้วค่อยรอบ perf (ไม่ทับซ้อน) · ไม่มีใครใช้เว็บระหว่างรัน

| | รอบ 1 | รอบ 2 |
|---|---|---|
| เริ่ม–จบ (UTC) | 07:01:29 → 07:10:14 (8.7 นาที · Playwright "8.6m" + perf 8.8 วิ) | 07:11:12 → 07:19:50 (8.6 นาที · "8.5m" + perf 8.8 วิ) |
| exit code (รอบหลัก · perf) | **0** · 0 | **1** (ข้อเดียว ดู §1.2) · 0 |
| สรุป Playwright | 387 passed · 3 skipped | 386 passed · **1 failed** · 3 skipped |

### 1.1 ต่อ project (นับจาก log รายข้อ `ok` / `✘` / `-`)

ตอนรับมอบ = `legacy/BASELINE.md` §1–2 (ผลรัน chromium+serial เท่านั้น · firefox/webkit เท่ากับ chromium ตาม run-2 ของ B-3)

| project | ตอนรับมอบ ผ่าน/ล้ม/ข้าม (รวม) | รอบ 1 | รอบ 2 | หมายเหตุ |
|---|---|---|---|---|
| setup | 1 / 0 / 0 | 1 / 0 / 0 | 1 / 0 / 0 | reset ครั้งเดียว |
| chromium | 71 / **6** / 1 (78) | **106 / 0 / 1** (107) | **106 / 0 / 1** (107) | ข้ามเดียว = TC-SERIES-04 (ตามแผน 6.4 พิสูจน์ผ่านหน้าเว็บไม่ได้ → unit E75) |
| firefox | 71 / 6 / 1 (78) | **106 / 0 / 1** (107) | 105 / **1** / 1 (107) | ล้ม 1 ข้อรอบ 2 = flaky ที่รู้แล้ว §1.2 |
| webkit | 71 / 6 / 1 (78) | **106 / 0 / 1** (107) | **106 / 0 / 1** (107) | |
| serial (Chromium ทีละข้อ) | 45 / **4** / 0 (49) | **68 / 0 / 0** (68) | **68 / 0 / 0** (68) | |
| perf-chromium / -firefox / -webkit | 1 / 1 / 1 ผ่าน | 1 / 1 / 1 ผ่าน (1.1 · 2.4 · 2.0 วิ) | 1 / 1 / 1 ผ่าน (1.1 · 2.4 · 2.0 วิ) | TC-BOOK-02 ตารางโหลดเร็ว ตัวเลขเวลาเท่ากันทั้ง 2 รอบ |

**ต่อเบราว์เซอร์ (วิธีเดียวกับ `build-index.mjs`: เบราว์เซอร์ + serial + perf)**

| | ตอนรับมอบ | รอบ 1 | รอบ 2 |
|---|---|---|---|
| chromium | 71+45+1 = **117** ผ่าน · 10 ล้ม | 106+68+1 = **175** ผ่าน · 0 ล้ม | 106+68+1 = **175** · 0 ล้ม |
| firefox | 117 · 10 ล้ม | **175** · 0 ล้ม | 105+68+1 = **174** · 1 ล้ม |
| webkit | 117 · 10 ล้ม | **175** · 0 ล้ม | **175** · 0 ล้ม |
| ระดับ TC (128 ข้อของ `plan-cases.json`) | 117/128 | **127/128** (เหลือ SERIES-04 ข้ามตามแผน) | chromium/webkit 127/128 · firefox 126/128 (MEMBER-06 flaky) |

- จำนวนเทสต์ต่อเบราว์เซอร์ 78 → 107 (+29) และ serial 49 → 68 (+19) = เทสต์ของ CR (`e2e/tests/cr/*` 9 ไฟล์ · known-issues 10 ข้อที่ถอด `test.fail` แล้วกลายเป็นเทสต์ปกติ) + เทสต์เดิมที่ย้ายไป serial ตามแถว ORACLE-CHANGES · **ไม่มีเทสต์เดิมถูกลบ**
- ข้อที่ล้มตอนรับมอบ 10 ข้อ (BOOK-11 · ROLE-03 · CHAT-14/15/16 · STAFF-06 ในเบราว์เซอร์ · REPORT-01 · REPORT-04 · TRACK-01 · DATA-01 ใน serial) → **เขียวทั้งหมดทั้ง 2 รอบ** (CR-01 → ROLE-03 · CR-02 → BOOK-11 STAFF-06 REPORT-01 TRACK-01 DATA-01 · CR-03 → REPORT-04 · CR-04 → CHAT-14/15/16)
- **ไม่มีแดงใหม่ที่ตอนรับมอบไม่มี** ยกเว้นข้อ flaky ใน §1.2 (ตอนรับมอบก็บันทึกว่าเป็นข้อเดียวกัน)
- TC-DATA-03 (migration รันซ้ำ + ถอยกลับบนฐานจริง `RUN_MIGRATION_TEST=1`) ผ่านทั้ง 2 รอบ (12.3 วิ) · มันถอย/ขึ้น 005–006 บนฐานจริง จึงไม่ใช่การตรวจแบบอ่านอย่างเดียว

### 1.2 ตัวเลขซ้ำไหม — ซ้ำ ยกเว้น 1 ข้อ flaky

รอบ 1 กับรอบ 2: **ทุก project ตรงกันเป๊ะ ยกเว้น `firefox › TC-MEMBER-06` ล้มรอบ 2** (`page.reload: NS_BINDING_ABORTED` ที่ `e2e/tests/v2.spec.ts:246`) · เป็นข้อที่ BASELINE §1 ระบุไว้แล้วว่า flaky ของ Firefox driver (ไม่ใช่บั๊กเว็บ · "run-1 Firefox NS_BINDING_ABORTED")
พิสูจน์ว่าไม่ใช่บั๊กเว็บ: reset แล้วรันข้อเดียวบน firefox `--no-deps` **3 ครั้ง → ผ่าน 3/3** (7.7–7.8 วิ) · chromium และ webkit ผ่านทั้ง 2 รอบ · ไม่ได้รันรอบ 3 ทั้งชุด ตัวเลขที่รายงานจึงเป็นผลดิบของ 2 รอบ ไม่ได้เลือกรอบที่สวย

## 2. ชุดอื่นบนโค้ดเดียวกัน (reset `{}` ก่อน · ไม่ซ้อนกับ e2e)

| ชุด | คำสั่ง | ผ่าน/ทั้งหมด | เวลา | ตอนรับมอบ / หมายเหตุ |
|---|---|---|---|---|
| golden master | `node tests/golden/check.mjs` | quote **261/261** · side **15/15** · quote-nov **132/132** | 6 วิ | quote เท่าเดิมทุก byte `[E golden/quote:ac43f117]` · side เปลี่ยนตามแถว ORACLE-CHANGES (CR-02/03) · quote-nov ใหม่ (CR-05 ราคาวันที่ 1 พ.ย.) · รันซ้ำหลังซ้อมถอยกลับอีกรอบ = เท่ากันทั้ง 3 |
| unit เว็บ | `cd web && npm test` | **137/137** (fail 0) | 0.8 วิ | ไม่มีตัวเลขตอนรับมอบ · ไฟล์ unit ใหม่หลังรับมอบ 6 ไฟล์ (`rules/cr02` `cr03` `cr05.test.ts` · `chat/cr04` `cr05.test.ts` · `server/session.test.ts`) |
| rules-check | `cd web && node selfcheck/rules-check.mjs` | **191/191** | 13 วิ | `BUG_MODE=0` · ค่าที่คาดหวังเปลี่ยน 3 จุดตาม ORACLE-CHANGES ที่ผู้ใช้/lead อนุมัติ (CR-01 เลข schema · CR-02 เช็กอินล่วงหน้า · CR-05 ราคาข้าม 1 พ.ย.) |
| check-testdata | `cd web && node selfcheck/check-testdata.mjs` | **151/151** (แถว E 145/145 · ข้าม unit E75 E87 E88) | 23 วิ | E148 ถอย 005 แล้วขึ้นใหม่บนฐานจริง · E76/E77 ค่าใหม่ตามแถว ORACLE-CHANGES CR-05 |
| กระทบยอดเงินคำท้า | `docker exec -i football-db psql … < tools/reconcile-challenges.sql` | `a_matched_without_payment` **0** · `b_payment_not_matching_credit` **0** | < 1 วิ | วัด 3 ครั้ง: บน seed · บนข้อมูลเสมือนจริง (630 การจอง · 30 คำท้า MATCHED · ฿34,220) หลังขึ้น 009 · หลังซ้อมถอยกลับ + ขึ้นใหม่ → 0/0 ทุกครั้ง |
| smoke (อ่านอย่างเดียว) | `node tests/smoke.mjs` | **10/10** exit 0 · หยุดเว็บ → **0/10 exit 1** (`ECONNREFUSED`) → เปิดเว็บ **10/10 exit 0** | 0.4 วิ | ใหม่ (L7) |

## 3. ตอนรับมอบ → ตอนนี้ (สรุปการเปลี่ยน)

| หัวข้อ | ตอนรับมอบ (BASELINE) | ตอนนี้ |
|---|---|---|
| schema | 006 | **009** (007 revoked_sessions · 008 field_rates · 009 payments.challenge_id) |
| e2e ต่อเบราว์เซอร์ | 117 ผ่าน / 10 ล้ม | **175 ผ่าน / 0 ล้ม** (รอบ 2 firefox 174 / 1 flaky) |
| TC ที่ล้มจากบั๊กเว็บ | 10 | **0** |
| golden | 261 + 15 | 261 + 15 + 132 (ตัวแรกไม่เปลี่ยน) |
| known-issue ล็อกคู่ (`test.fail`) | 10 | 0 (ถอดครบเมื่อ CR แก้) |
| ค่าที่คาดหวังเดิมที่เปลี่ยน | – | ทุกจุดมีแถวใน `ORACLE-CHANGES.md` พร้อมผู้อนุมัติ (รวม 12 แถว: CR-01 3 · CR-02 4 · CR-05 5) |
| ของที่ยังไม่ได้แก้ (ไม่อยู่ใน regression นี้) | – | ดู `RELEASE-NOTES.md` หัวข้อ "เรื่องที่ยังไม่ได้แก้" (agent อื่นเขียน) |

## 3.1 รอบสุดท้าย 2026-10-21 (HEAD 1ed8db2)

รัน `RUN_MIGRATION_TEST=1 node run-all.mjs` เต็ม 1 ครั้ง (รอบหลัก ~11 นาที + perf) — รายงานที่ commit ใน `e2e/test-report/` และ `e2e/index.html` คือรอบนี้

| project | ผ่าน | ล้ม | ข้าม | รวม |
|---|---|---|---|---|
| chromium | 106 | 0 | 1 | 107 |
| firefox | 106 | 0 | 1 | 107 |
| webkit | 105 | **1** | 1 | 107 |
| serial | 69 | 0 | 0 | 69 |
| perf-chromium / firefox / webkit | 1 / 1 / 1 | 0 | 0 | 1 / 1 / 1 |

- รวมผ่าน **389/390 = 99.7%** · ระดับ TC (128 ข้อ): chromium 127 · firefox 127 · webkit 126 (ตัวรายงานตัดสิน "ไม่ผ่านเกณฑ์" เพราะ P1 ล้ม 1 ข้อ)
- NFR-08 เปิด /book จน data-ready: chromium 326 ms · firefox 975 ms · webkit 627 ms (เกณฑ์ ≤ 2,000 ms)
- **ที่ล้ม: `webkit › TC-PRICE-04` (P1)** — `setCheckedStable` timeout 15 วินาทีที่ `fixtures.ts:185` (เรียกจาก `price.spec.ts:85`) คลิก `use-credit` ไม่ได้ (รอ visible/enabled/stable) = จังหวะเวลาของการคลิก ไม่ใช่ค่าตัวเลขผิด
- **จัดเป็น webkit flaky:** รัน webkit แยกทั้งโปรเจกต์ 3 รอบผ่านหมด (71/71 ต่อรอบ) และ lead รัน `--no-deps -g "TC-PRICE-04" --project=webkit` แยก 5 รอบ ผ่าน 5/5 · โค้ด `web/app/book` + components ไม่เปลี่ยนตั้งแต่ v2-handover
- **รายการ flaky ที่รู้ ณ ตอนนี้:** firefox TC-MEMBER-06 · firefox TC-BOOK-01 · firefox perf TC-BOOK-02 · **webkit TC-PRICE-04 (เพิ่มรอบนี้)** — ข้อที่ไม่ใช่ flaky ที่ล้ม = 0
- ผลรอบนี้ไม่ได้ทำให้ตัวเลข §1 (รอบ 1/2 ก่อนหน้า) เปลี่ยน · (รายงานล่าสุดใน git ตอนนี้คือรอบ §3.2)

## 3.2 รอบสุดท้าย 2 (2026-10-21, HEAD a6ca022)

รัน `RUN_MIGRATION_TEST=1 node run-all.mjs` เต็ม 1 ครั้ง (รอบหลัก 10.4 นาที + perf 8.6 วินาที) บน `BUG_MODE=0` · schema 009 · mock · ตั้งแต่รอบนี้ `run-all.mjs` ต่อ `run-unit-proof.mjs` → `build-index.mjs` ให้เองตอนจบ (โซ่หลักฐาน: unit ก่อน index) · รายงานที่ commit ใน `e2e/test-report/*` + `e2e/index.html` + `e2e/test-report/unit-proof.json` คือรอบนี้ (ใช้แทนรอบ §3.1) · log ดิบ: `scratchpad` ของ session

ที่เพิ่มจาก §3.1 (HEAD 1ed8db2 → a6ca022): แก้ fixture `setCheckedStable` (ORACLE-CHANGES) · TC-SERIES-04 นับผ่านด้วย unit E75 · K3 (getNow ไม่อ่านแถว clock เมื่อปิด seam) · id ผิดรูป/รหัสมี NUL → 404 แทน 500 · เทสต์ใหม่ใน `e2e/tests/cr/` 3 ไฟล์ (`stored-amounts.serial` 4 ข้อ · `reschedule-overlap` 4 ข้อ · `wrong-type-inputs.serial` 7 ข้อ + 1 fixme)

| project | ผ่าน | ล้ม | ข้าม | รวม |
|---|---|---|---|---|
| setup | 1 | 0 | 0 | 1 |
| chromium | 110 | 0 | 1 | 111 |
| firefox | 110 | 0 | 1 | 111 |
| webkit | 108 | **2** | 1 | 111 |
| serial | 86 | 0 | 1 | 87 |
| perf-chromium / firefox / webkit | 1 / 1 / 1 | 0 | 0 | 1 / 1 / 1 |

- Playwright นับ: รอบหลัก 415 ผ่าน · 2 ล้ม · 4 ข้าม (= TC-SERIES-04 ×3 เบราว์เซอร์ + `WT-04-K14` fixme 1) · perf 3 ผ่าน → รวมผ่าน **418/424 = 98.6%** (นับ setup 1 ข้อ)
- NFR-08 เปิด /book จน data-ready: chromium 227 ms · firefox 465 ms · webkit 466 ms (เกณฑ์ ≤ 2,000 ms)
- **ตัดสินของ `e2e/index.html` ต่อเบราว์เซอร์ (กติกาแผน 6.4 · ต้องผ่าน ≥ 122/128 และ P1 74/74):**

| เบราว์เซอร์ | ระดับ TC | P1 | ตัดสิน |
|---|---|---|---|
| chromium | 128/128 | 74/74 (ในนี้ 1 = TC-SERIES-04 ผ่านด้วย unit) | **ผ่านเกณฑ์** |
| firefox | 128/128 | 74/74 (unit 1) | **ผ่านเกณฑ์** |
| webkit | 126/128 | 73/74 (unit 1) | **ไม่ผ่านเกณฑ์** (ล้ม `TC-BOOK-01` P1 + `TC-STAFF-06` P2) |

- **TC-SERIES-04** ไม่ใช่ข้ามเฉย ๆ อีกต่อไป: `unit-proof.json` — `web/lib/rules/rules.test.ts:221` (E75 "BR-19 / A-24 discount with satang is rounded up") ผ่านจริงในรอบนี้ (pass 1 / fail 0) → index นับ "ผ่านด้วย unit"
- **ที่ล้ม (ทั้งสองเฉพาะ WebKit):**
  1. `TC-BOOK-01` (P1) — หลังเลือก 2 ชั่วโมง รอ `price-hour-20` ไม่เจอ 10 วินาที (`book.spec.ts:25`) · ตัวเลขไม่ผิด หน้ายังไม่แสดงบรรทัดราคาที่สอง
  2. `TC-STAFF-06` (P2) — ล้มที่ 709 ms ใน `expectFree`: ช่อง A 2026-10-19 10:00–13:00 มีการจอง active ทับอยู่ 2 ใบก่อนเริ่ม ("ข้อมูลชนกับ test อื่น" `v2-helpers.ts:43`) · ยังระบุไม่ได้ว่า test ไหนจองไว้ (กลุ่ม serial รีเซ็ตฐานทีหลัง ดูย้อนหลังไม่ได้)
- **รันซ้ำเพื่อจำแนก (reset `{}` ก่อนทุกรอบ · `--project=webkit --no-deps`):** `TC-BOOK-01` ผ่าน **3/3** (4.5 · 4.1 · 3.6 วินาที) · `TC-STAFF-06` ผ่าน **3/3** (2.6 · 2.8 · 2.7 วินาที) · และรัน webkit ทั้งโปรเจกต์ 1 รอบ (`--no-deps` หลัง reset) = **110 ผ่าน · 1 ข้าม · 0 ล้ม** (2.7 นาที) → จัดเป็น **webkit flaky** (BOOK-01 = จังหวะเรนเดอร์ · STAFF-06 = ข้อมูลชนกันตอนรัน 3 เบราว์เซอร์พร้อมกัน) ไม่ใช่บั๊กเว็บ · บันทึกใน `e2e/triage.json` · ผลรันซ้ำไม่ถูกเขียนทับรายงานรอบเต็ม (เก็บสำเนารายงานก่อนรันซ้ำแล้วคืนหลังรัน)
- **ข้อควรรู้ตรง ๆ:** ตัว index ยังตัดสิน webkit ❌ ตามกติกา (ไม่ได้ปรับผลให้สวย) · `TC-PRICE-04` ที่ล้มใน §3.1 ผ่านครบ 3 เบราว์เซอร์รอบนี้ แต่ webkit มี flaky ใหม่ 2 ข้อ → รายการ flaky ที่รู้: firefox TC-MEMBER-06 · firefox TC-BOOK-01 (เก่า) · firefox perf TC-BOOK-02 · webkit TC-PRICE-04 (§3.1) · **webkit TC-BOOK-01 · webkit TC-STAFF-06 (รอบนี้)** — ข้อที่ไม่ใช่ flaky ที่ล้ม = 0 · ข้อเสนอที่ยังไม่ทำ (ห้ามแก้ test เดิมโดยไม่มีแถว ORACLE-CHANGES): ให้ `expectFree` พิมพ์รหัสการจองที่ชน และให้ fixture ของ webkit รอ data-ready หลังเลือกชั่วโมง

**ชุดอื่นบนโค้ดเดียวกัน (reset `{}` ก่อน · รันหลัง e2e จบ ไม่ซ้อนกัน):**

| ชุด | คำสั่ง | ผล |
|---|---|---|
| golden master | `node tests/golden/check.mjs` | quote **261/261** `[E golden/quote:ac43f117]` · side **15/15** `[E golden/side:6e21c080]` · quote-nov **132/132** `[E golden/quote-nov:85064ff4]` · exit 0 |
| unit เว็บ | `cd web && npm test` | **144/144** (fail 0 · skipped 0) — §2 เดิม 137 → เพิ่ม 7 |
| Portal | `node web/selfcheck/portal-check.mjs` | **1148/1148** (fail 0) · 68 หน้า × 2 ความกว้าง · ลิงก์ 348 (รันซ้ำท้ายงานหลังแก้เอกสาร — ดูหมายเหตุท้ายส่วนนี้) |
| smoke | `node tests/smoke.mjs` | **10/10** exit 0 |
| MCP สนามบอล | `node tools/mcp-football/test-client.mjs` | **13/13** · wire log 36 ข้อความ (`docs/mcp/football-wire.log` — ไฟล์ใน git คงฉบับเดิม) · จบแล้ว reset `{}` |

- ไม่ได้รันซ้ำรอบนี้: `rules-check` (191) · `check-testdata` (151) · กระทบยอดเงินคำท้า — ใช้ตัวเลข §2 (วัดที่ `ea32d4d`) · โค้ดฝั่ง `web/` เปลี่ยนตั้งแต่นั้น (404 แทน 500, K3) จึงควรรันซ้ำก่อนส่งจริง
- สถานะสุดท้ายหลังรอบ: `POST /api/test/reset {}` ok · `/api/version` = `009` · `mock` · bugMode 0

## 4. สิ่งที่รายงานนี้ยังพิสูจน์ไม่ได้

- **ไม่ได้รันชุด regression บน `v2-handover` ซ้ำ** ตอนนี้ — ตัวเลข "ตอนรับมอบ" ยกจาก BASELINE (รันเมื่อ 20 ต.ค.) ไม่ใช่รอบใหม่ → ถ้าต้องการเทียบแบบรันคู่ ต้องสร้าง worktree ของ tag แล้วรันแยก (image ของ tag build ไว้แล้ว `football-web:v2-handover` ใช้ได้)
- rules-check / check-testdata / `npm test` **ไม่มีตัวเลขตอนรับมอบ** ใน BASELINE → เทียบเป็นตัวเลขไม่ได้ มีแต่ "ตอนนี้เขียวหมด"
- ทดสอบ `BUG_MODE=1` ไม่ได้ทำ (งาน CR ทำบน `BUG_MODE=0` เสมอ ตาม CLAUDE.md)
- firefox TC-MEMBER-06 flaky (§1.2) — รอบ 2 ไม่เขียวสนิท
- e2e ไม่ครอบคลุม: การเปลี่ยนวันที่ของเครื่องจริงหลัง 1 พ.ย. (CR-05 พิสูจน์ด้วยนาฬิกาจำลอง + golden quote-nov) · ไม่ได้ทดสอบกับ Postgres ตัวอื่นนอกจาก 16-alpine
