# BASELINE — ผลของระบบที่รับมอบ "ก่อนแตะโค้ด" (chunk D-2 · แผน L4)

ทำเมื่อ 2026-10-20 · ระบบ `v2-handover` · `/api/version` = `{"schemaVersion":"006","chatMode":"mock","bugMode":0}` · "ตอนนี้" ของระบบล็อก ศ 9 ต.ค. 2569 10:00 (reset `{}`)
หลักการ (บท 05 LAB 4 · บท 06 LAB 5): **ล้อมรั้วก่อนแก้** — ไม่มีผล "ก่อน" จะแยกไม่ออกว่าข้อที่ล้มทีหลังพังเพราะเราหรือพังมาแต่แรก

## 1. ชุด e2e เดิม (ผล B-3 ที่รับมอบ)

ที่มา: `e2e/test-report/run-2/` (`run-info.json` startedAt 2026-10-20T09:02:10Z · BUG_MODE 0) และ `e2e/index.html` (summary ของ run-2 · compare run-1)

| project | ผ่าน | ล้ม | ข้าม | รวม |
|---|---:|---:|---:|---:|
| chromium | 71 | 6 | 1 | 78 |
| firefox | 71 | 6 | 1 | 78 |
| webkit | 71 | 6 | 1 | 78 |
| serial (Chromium · ทีละข้อ · หลัง 3 เบราว์เซอร์) | 45 | 4 | 0 | 49 |
| perf-chromium / -firefox / -webkit | 1 / 1 / 1 | 0 | 0 | 1 / 1 / 1 |

**ต่อเบราว์เซอร์ = 117/128** (เบราว์เซอร์ 78 + serial 49 + perf 1 · serial นับเข้าทุกเบราว์เซอร์ตามวิธีของ `build-index.mjs`) · เกณฑ์ ≥ 122 และ P1 ล้ม 0 → `meets:false` ทั้ง 3 เบราว์เซอร์ (P1 ผ่าน 72/74)

ข้อที่ไม่ผ่าน (เหมือนกันทั้ง 3 เบราว์เซอร์) + triage จาก `e2e/triage.json`:

| TC | project | ระดับ | triage | CR ที่จะแก้ |
|---|---|---|---|---|
| TC-ROLE-03 | เบราว์เซอร์ | P1 | เว็บผิด: logout แล้ว cookie เดิมยังได้ 200 | CR-01 |
| TC-BOOK-11 | เบราว์เซอร์ | P3 | เว็บผิด: ค้นโดยไม่กรอก → "เกิดข้อผิดพลาดในระบบ" (308 → 405) | CR-02 ข้อ 5 |
| TC-STAFF-06 | เบราว์เซอร์ | P2 | เว็บผิด: เช็กอินก่อนวันเตะได้ (A-45) | CR-02 ข้อ 1 |
| TC-CHAT-14 / 15 / 16 | เบราว์เซอร์ | P2 | เว็บผิด: บอทไม่ใช้บทสนทนาก่อนหน้า (FR-35) | CR-04 |
| TC-REPORT-01 | serial | P2 | เว็บผิด: 30 พ.ย. → 28 ก.พ. ถูกปฏิเสธ (A-46) | CR-02 ข้อ 4 |
| TC-REPORT-04 | serial | P2 | เว็บผิด: ไม่มีคอลัมน์ "เก็บหน้าสนาม" / ชั่วโมงต่อสนาม (A-41/42) | CR-03 |
| TC-TRACK-01 | serial | P3 | เว็บผิด: ไม่มีขั้น "จบ" (A-43) | CR-02 ข้อ 3 |
| TC-DATA-01 | serial | P2 | เว็บผิด: ประวัติแสดง username ไม่ใช่ชื่อพนักงาน (A-44) | CR-02 ข้อ 2 |
| TC-SERIES-04 | เบราว์เซอร์ (ข้าม) | P1 | ไม่ได้รัน: ส่วนลด 10% ลงตัวเสมอ พิสูจน์การปัดผ่านหน้าเว็บไม่ได้ (แผนให้เป็น unit E75) | – (นับไม่ผ่านตามแผน 6.4) |

flaky ที่รู้แล้ว (ไม่ใช่บั๊กเว็บ · Firefox driver): TC-BOOK-07 (`browserContext.close` Protocol error) · TC-MEMBER-06 (run-1 Firefox `NS_BINDING_ABORTED` → Firefox run-1 = 116)
ข้อ TC-DATA-03 ผ่านเพราะตั้ง `RUN_MIGRATION_TEST=1` — ข้อนี้รัน backup → migrate ×2 → `--down 006` → migrate กลับ **บนฐานจริง** (ไม่ตั้ง = ข้าม = นับไม่ผ่าน)

## 2. รันยืนยันซ้ำ (chromium + serial เท่านั้น)

คำสั่ง: `cd e2e && RUN_MIGRATION_TEST=1 npx playwright test --project=chromium --project=serial` (Git Bash) · เริ่ม 2026-10-20T13:44:52Z · ใช้เวลา 4.9 นาที · exit 1 (มีข้อล้มตามเดิม)

| project | ผ่าน | ล้ม | ข้าม | รวม | เทียบ run-2 |
|---|---:|---:|---:|---:|---|
| setup | 1 | 0 | 0 | 1 | – |
| chromium | 71 | 6 | 1 | 78 | **เท่ากัน** |
| serial | 45 | 4 | 0 | 49 | **เท่ากัน** |

ข้อที่ล้ม: chromium = TC-BOOK-11, TC-ROLE-03, TC-CHAT-14, TC-CHAT-15, TC-CHAT-16, TC-STAFF-06 · serial = TC-REPORT-01, TC-REPORT-04, TC-TRACK-01, TC-DATA-01 · ข้าม TC-SERIES-04 → **ชุดเดียวกับ run-2 ทุกตัว = baseline ไม่เปลี่ยน** (บรรทัดสรุป Playwright `10 failed · 1 skipped · 117 passed` รวม setup 1)
reporter เขียนทับ `e2e/test-report/results.json` `TEST-REPORT.md` `run-info.json` `chat/mock/*` → คืนด้วย `git checkout -- e2e/test-report` หลังรัน (ผล B-3 ใน repo ไม่ถูกแก้)

> ⚠️ คำสั่ง "ไฟล์เดียว" `npx playwright test <file> --project=chromium` **ลาก serial ทั้ง 49 ข้อมาด้วย** (project `setup` มี `teardown: 'serial'`) → ใช้ `--no-deps` เมื่อต้องการรันแค่ไฟล์นั้น (จดใน CLAUDE.md แล้ว)

## 3. ตาข่ายที่เพิ่มในรอบนี้

| ชั้น | ไฟล์ | ผล |
|---|---|---|
| golden `POST /api/quote` | `tests/golden/quote.golden.json` | 261 เคส · `[E golden/quote:ac43f117]` |
| golden availability + รายงาน JSON/CSV | `tests/golden/side.golden.json` | 15 เคส · `[E golden/side:a7fba5c2]` |
| known issue ล็อกคู่ | `e2e/tests/cr/known-issues.spec.ts` | 10 ข้อ `test.fail()` · chromium / firefox / webkit = expected-fail 10/10 ทุกเบราว์เซอร์ (บรรทัดสรุปเขียนว่า "passed") |

ความนิ่งของ golden: `--update` 1 ครั้ง → เทียบรอบที่ 1 = เท่ากัน 261/261 + 15/15 → รอบที่ 2 = เท่ากัน → หลัง mutant 3 ตัวคืนไฟล์และ rebuild แล้วเทียบอีกครั้ง = เท่ากัน (นิ่งข้าม rebuild ด้วย)

**ตัวเลขชุดเต็มหลังเพิ่ม known-issues:** ไฟล์ใน `e2e/tests/cr/` ถูกรวมใน project chromium/firefox/webkit (ไม่ใช่ `*.serial.spec.ts`) → แต่ละเบราว์เซอร์ 78 → **88 test** · Playwright นับ expected-fail รวมใน "passed" → นับแยกด้วย `--grep @known-issue` (10 ต่อเบราว์เซอร์) แล้วหักออกก่อนเทียบกับ 71 ผ่านเดิม · reporter ของทีมเดิมไม่จับรหัส TC จากชื่อ "KI TC-…" (regex `^TC-`) จึงไม่ทับแถว TC เดิม
นับ known-issue: `cd e2e && npx playwright test tests/cr/known-issues.spec.ts --project=chromium --no-deps` → `10 passed` (= 10 expected-fail) · วันที่ CR แก้ข้อใด ข้อนั้นขึ้น "unexpectedly passed" = แดง → CR ต้องถอด `test.fail` ข้อนั้น

## 4. seam ปิดได้ไหม (`ALLOW_TEST_RESET=0`)

คำสั่ง (Git Bash · shell ชนะ `web/.env`): `ALLOW_TEST_RESET=0 BUG_MODE=0 MODE=mock docker compose -f web/compose.yaml up -d --wait` (ไม่ build ใหม่ · `SESSION_SECRET` อยู่ใน `web/.env` แล้ว ไม่ได้เปิดดู)

| ตรวจ | ผล |
|---|---|
| env ใน container (`docker inspect`) | `ALLOW_TEST_RESET=0` · `BUG_MODE=0` · `MODE=mock` |
| `GET /api/health` · `/api/version` | `{"ok":true,"db":true}` · 006 / mock / 0 (เว็บขึ้นได้ปกติเมื่อปิด seam) |
| `POST /api/test/reset` | **404** `{"error":{"code":"NOT_FOUND","message":"Not found"}}` |
| `POST /api/test/clock {"now":"2026-10-12T09:00:00+07:00"}` | **404** เหมือนกัน · นาฬิกาไม่เลื่อน |
| `GET /api/test/reset` | 404 |
| คืน `ALLOW_TEST_RESET=1` แล้ว `up -d --wait` | env = 1 · reset `{}` → `{"ok":true,"now":"2026-10-09T03:00:00.000Z","locked":true,"bugMode":0}` |

> ⚠️ **ผู้ต้องสงสัย (seam ปิดไม่หมด):** ตอนปิด seam `/api/availability` ยังตอบ `now 2026-10-09T03:00:00Z` = "ตอนนี้" ยังถูกล็อกจากแถว `app_settings.clock` ที่ reset เขียนไว้ (`web/lib/server/core.ts:32-38` อ่านแถวนี้เสมอ ไม่ดู `ALLOW_TEST_RESET`) → เครื่องจริงที่เคยรัน reset จะมีนาฬิกาค้าง · ต้องลบแถว clock ก่อนใช้งานจริง (เสนอเพิ่มใน RUNBOOK / ถามร้าน · ยังไม่แก้ เพราะไม่มี CR)

## 5. สถานะตอนจบ chunk

BUG_MODE 0 · MODE mock · ALLOW_TEST_RESET 1 · reset `{}` แล้ว · `/api/version` 006 / 0 / mock · `git status web db` สะอาด · `e2e/test-report` คืนเป็นของ B-3
