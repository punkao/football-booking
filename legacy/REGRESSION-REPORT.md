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

## 4. สิ่งที่รายงานนี้ยังพิสูจน์ไม่ได้

- **ไม่ได้รันชุด regression บน `v2-handover` ซ้ำ** ตอนนี้ — ตัวเลข "ตอนรับมอบ" ยกจาก BASELINE (รันเมื่อ 20 ต.ค.) ไม่ใช่รอบใหม่ → ถ้าต้องการเทียบแบบรันคู่ ต้องสร้าง worktree ของ tag แล้วรันแยก (image ของ tag build ไว้แล้ว `football-web:v2-handover` ใช้ได้)
- rules-check / check-testdata / `npm test` **ไม่มีตัวเลขตอนรับมอบ** ใน BASELINE → เทียบเป็นตัวเลขไม่ได้ มีแต่ "ตอนนี้เขียวหมด"
- ทดสอบ `BUG_MODE=1` ไม่ได้ทำ (งาน CR ทำบน `BUG_MODE=0` เสมอ ตาม CLAUDE.md)
- firefox TC-MEMBER-06 flaky (§1.2) — รอบ 2 ไม่เขียวสนิท
- e2e ไม่ครอบคลุม: การเปลี่ยนวันที่ของเครื่องจริงหลัง 1 พ.ย. (CR-05 พิสูจน์ด้วยนาฬิกาจำลอง + golden quote-nov) · ไม่ได้ทดสอบกับ Postgres ตัวอื่นนอกจาก 16-alpine
