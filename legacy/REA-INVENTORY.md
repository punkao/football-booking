# REA-INVENTORY — มองระบบที่ส่งมอบด้วย REA + triangulation (บท 05 LAB 2–3 · บท 06 LAB 2–3)

ทำเมื่อ 2026-10-20 · image `rea-lab:6.4.0` (REA 6.4.0 · `docker images rea-lab` = 3.77 GB) · mount รากโปรเจกต์เป็น `/work`
เรียก REA ด้วย `legacy/rea-out/rea.sh` (bash ของ `rea/rea.ps1` ในบทเรียน: `docker run --rm -v "<root>:/work" -w /work … rea <args>` · ผลเขียนโดย container จึงเป็น UTF-8 ไม่มี BOM · ทิ้งบรรทัด `rea_progress`)
ไฟล์ผล REA ใหญ่ 2–60 MB อยู่ใน `legacy/rea-out/` (ไม่ขึ้น git) · อ่านผ่านตัวย่อ `rea/rea-summarize.mjs` ของบทเรียนเท่านั้น (ไม่เปิดไฟล์ดิบ)
ป้าย: 🔵 static (เห็นใน bytes) · 🟢 runtime (เห็นตอนรัน) · 🟡 inference (อนุมาน · ชี้เป้าเท่านั้น) · ⚪ unknown (ไม่รู้ + เหตุผล) · **[E] = ระบบทำอยู่ ไม่ใช่ร้านต้องการ**

## 0. REA รันได้ไหม

ได้ทุกคำสั่ง · `rea doctor --filter-output healthy,checks` → `healthy: false` เพราะ `hopper` `ghidra` `ida-registration` `skill:identity` (เครื่องมือแกะไบนารี) · `node 24.20.0` ✅ `host ubuntu 24.04` ✅ → ไม่กระทบงานเว็บ (เหมือนผลในบทเรียน)

## 1. หลักฐาน (Evidence) ที่เก็บ

| แหล่ง | คำสั่ง | evidence | authority · confidence | digest (12) | ขนาด · เวลา | coverage |
|---|---|---|---|---|---|---|
| static bundle (ของที่ส่งถึงเบราว์เซอร์ · `docker cp football-web:/app/.next/static`) | `analyze-javascript-application /work/legacy/rea-out/v2/.next/static --json` | `ev_e53483aa` | shipped-artifact · derived | `b56c87a0cafa` | 57.8 MB · 1 นาที 26 วิ | partial |
| server bundle (`/app/.next/server`) | `analyze-javascript-application /work/legacy/rea-out/v2/.next/server --json` | `ev_da31c09c` | shipped-artifact · derived | `2d29e16a2735` | 59.6 MB · 1 นาที 19 วิ | partial |
| HAR (ตัดความลับแล้ว · `tools/record-har.mjs`) | `inspect-web-network-capture /work/legacy/har/journey.stripped.har har --json` | `ev_69ac4dd7` | historical-reference · observed | `6f3b6892eaad` | 5.7 MB · 3.7 วิ | เฉพาะเส้นทางที่เดิน |
| scenario ที่ REA ขับเอง (`legacy/rea-out/scenario-book-pay.json` → `http://host.docker.internal:3000`) | `capture-browser-scenario /work/legacy/rea-out/scenario-book-pay.json --json` | `ev_ddf5a3a5` | controlled-replay · observed | (ไม่มี artifact identity) | 2.0 MB · 5.1 วิ (scenario 2,192 ms) | incomplete (`missing: events`) |
| trace ฟีเจอร์ "staff/bookings" (ทิศ incoming บน server graph) | `rea-input.mjs trace … string staff/bookings incoming` → `trace-application-feature` | `ev_235b63cf` (ต้นทาง `ev_da31c09c`) | – | – | 0.96 MB · 18 วิ | partial |

ภาพสุดท้ายที่ REA ถ่ายเอง: `legacy/rea-scenario-final.png` (หน้า `/booking/LN-100001?done=paid`)

## 2. สิ่งที่ REA เห็น (23 ข้อ)

| # | ชั้น | สิ่งที่เห็น | หลักฐาน |
|---|---|---|---|
| S1 | 🔵 static | bundle เบราว์เซอร์ 123 ไฟล์ JS (parse ได้ทั้งหมด 0 parse failure) · module 53 · node 358 · edge 366 · findings 42 | `[E ev_e53483aa]` |
| S2 | 🔵 static | endpoint 9 node ใน bundle เบราว์เซอร์ **ไม่มี `/api/…` ของร้านเลย** — เป็นชื่อ macro ของ katex (`\df@tag`) · key ของ d3/mermaid (`fill` `stroke` `days` `hours` …) · `a` `b` `c` | `[E ev_e53483aa]` |
| S3 | 🔵 static | storage relation 0 (ไม่มี localStorage / sessionStorage) | `[E ev_e53483aa]` |
| S4 | 🔵 static | recovered_source_files 0 (bundle เบราว์เซอร์ไม่มี source map) | `[E ev_e53483aa]` |
| S5 | 🔵 static | bundle server 1,145 ไฟล์ · edge 2,725 · endpoint 95 node = header (`Cache-Control` `cookie` `authorization` `set-cookie` `user-agent`) · ภายใน Next (`next.route` `next.span_type`) · query key ที่ route อ่าน (`code` `phone` `date` `from` `to` `itemId` `staffUserId` `action` `startHour` `hours`) · cookie `lang` | `[E ev_da31c09c]` |
| S6 | 🔵 static | server มี source-map 38 node แต่ recovered_source_files **0** | `[E ev_da31c09c]` |
| S7 | 🔵 static | trace "staff/bookings": seed ตรง 32 · node 33 · edge 267 · ไปถึง `app/api/staff/bookings/[code]/route.js:default` และ `…/checkin/route.js:default` + manifest ของทุก route · observed 531 · inferred 4 | `[E ev_235b63cf]` |
| S8 | 🔵 static | ชนเพดานทรัพยากร: 70 ไฟล์ (static) · 394 ไฟล์ (server) เก็บ fact ไว้ที่ node ของไฟล์ ไม่แตกเป็น endpoint/storage | `[E ev_e53483aa]` · `[E ev_da31c09c]` |
| R1 | 🟢 runtime | HAR 300 records · API 23 ครั้ง / 19 เส้น · status 200/201 ยกเว้น 3 ครั้ง −1 | `[E ev_69ac4dd7]` |
| R2 | 🟢 runtime | สัญญา API (request/response keys) ของ 19 เส้น (ตารางเต็มใน `API-INVENTORY.md` ส่วน A) | `[E ev_69ac4dd7]` |
| R3 | 🟢 runtime | REA ปิด header/cookie ด้าน auth ที่รู้จักให้เองอีกชั้น (limitation: "Known authentication headers/cookies … are redacted") · body login เห็นเป็น `password: REDACTED` (เราตัดก่อนส่ง) | `[E ev_69ac4dd7]` |
| R4 | 🟢 runtime | scenario 11/11 step สำเร็จ · URL สุดท้าย `/booking/LN-100001?done=paid` | `[E ev_ddf5a3a5]` |
| R5 | 🟢 runtime | ยอดใน accessibility tree: "ค่าสนาม = ฿1,800 · ยอดรวม = ฿1,800 · จ่ายตอนจอง = ฿1,800 · จ่ายแล้ว = ฿1,800 · เก็บหน้าสนาม = ฿0" (สนาม C ศ 9 ต.ค. 20:00) | `[E ev_ddf5a3a5]` |
| R6 | 🟢 runtime | storage ตอนจบ: local_storage_keys `-` · session_storage_keys `-` · cookie 1 ตัว (`ln_access`) | `[E ev_ddf5a3a5]` |
| R7 | 🟢 runtime | network ของ scenario 7 คำขอ = `availability` → `quote` → `rentals/availability` → `POST bookings` 201 → `GET bookings/{code}` → `pay` → `GET bookings/{code}` (ลำดับเดียวกับ HAR ขั้น 01–03) | `[E ev_ddf5a3a5]` · `[E ev_69ac4dd7]` |
| I1 | 🟡 inference | node `electron-renderer` ×2 = `app/_global-error.html` และ `pages/500.html` (REA ตีความ HTML ของ Next · เว็บนี้ไม่ใช่ Electron) | `[E ev_da31c09c]` |
| I2 | 🟡 inference | endpoint `a` `b` `c` = ชื่อที่ถูก minify (`call:Uv.delete` / `e.get`) ไม่ใช่ API | `[E ev_e53483aa]` |
| I3 | 🟡 inference | trace มี inferred_facts 4 (ความสัมพันธ์ที่อนุมานจาก import) | `[E ev_235b63cf]` |
| I4 | 🟡 inference | endpoint `/` (`property:path`) ใน server = path ของ route Next ไม่ใช่ API จริง | `[E ev_da31c09c]` |
| U1 | ⚪ unknown | static coverage partial · semantic graph มี unknowns 11,645 · ถูกตัด (truncated) — path ที่ส่งผ่านตัวแปรหรือ template literal ไม่ถูก resolve | `[E ev_e53483aa]` |
| U2 | ⚪ unknown | scenario `completeness: incomplete (missing: events)` ทั้งที่ขอ `events: network, console, page-errors` → ไม่รู้ว่ามี console error ไหมจากหลักฐานนี้ (ต้องดูด้วย e2e / Playwright เอง) | `[E ev_ddf5a3a5]` |
| U3 | ⚪ unknown | HAR 3 คำขอ status −1 (`owner/holidays` `owner/closures` `staff/logout` ครั้งที่ 2) = ถูกยกเลิกเพราะสคริปต์เปลี่ยนหน้า ไม่ใช่ server ล้ม | `[E ev_69ac4dd7]` |
| U4 | ⚪ unknown | server coverage partial · กฎธุรกิจ (ราคา จองทับ สิทธิ์) อยู่ในโค้ด server ที่ REA อ่านเป็น text เฉื่อย ไม่ได้รัน | `[E ev_da31c09c]` |

นับตามชั้น: **static 8 · runtime 7 · inference 4 · unknown 4 = 23**

## 3. หน้า (route) ที่เห็นจากชื่อไฟล์ใน bundle server (grey-box `find`)

`server/app/**/page.js` 34 ไฟล์ = 32 หน้าใน source + `_global-error` + `_not-found` · `server/app/api/**/route.js` **55 ไฟล์ = `route.ts` 55 ไฟล์ใน source** (ตรงทุกตัว) · รายชื่อเต็มเหมือน SYSTEM-MAP ส่วน B/C

## 4. Triangulation: REA · source · DB · SPEC (21 แถว)

| # | เรื่อง | REA เห็น | source บอก | DB บอก | SPEC บอก | ตรงไหม | ถ้า REA ไม่เห็น เพราะอะไร |
|---|---|---|---|---|---|---|---|
| 1 | รายการ API ของร้าน | static: **0 จาก 60** `[E ev_e53483aa]` · runtime 19 `[E ev_69ac4dd7]` | 60 handler (SYSTEM-MAP C) | – | §5 + §12 ครบ | ⚠️ | ทุกหน้าเรียกผ่าน `api(lang, path)` (`web/lib/client.ts:8`) path เป็นตัวแปร → REA ไม่ตามค่าข้ามตัวแปร · grep build เอง (grey) เจอ path literal 23 ตัว + template 18 ตัวใน `_next/static` |
| 2 | จำนวน route | server bundle: `route.js` 55 · endpoint node ไม่ใช่ API `[E ev_da31c09c]` | `route.ts` 55 | – | – | ✅ (grey `find`) | REA จัด route เป็น artifact/manifest ไม่ใช่ endpoint |
| 3 | จำนวนหน้า | `page.js` 34 | `page.tsx` 32 | – | §2 + §9 | ✅ (+2 หน้าภายใน Next) | – |
| 4 | `POST /api/bookings` | runtime 201 + Set-Cookie `ln_access` `[E ev_69ac4dd7]` `[E ev_ddf5a3a5]` | `app/api/bookings/route.ts:8` → `server/bookings.ts:227` | INSERT + trigger ประวัติ `mig/002:49-50` | §5 201 | ✅ | static ไม่เห็น (ข้อ 1) |
| 5 | ราคา C ศุกร์ 20:00 | ฿1,800 `FULL_100` (a11y) `[E ev_ddf5a3a5]` | `rules/pricing.ts:28-47` | `fields` C 1200/1800 (`db/init/02-seed.sql:19`) | §1 C 1,200/1,800 · BR-11 ศุกร์ ≥ 17:00 จ่ายเต็ม | ✅ | – |
| 6 | cookie | ชื่อ cookie ใน server bundle: `ln_customer` `ln_staff` `ln_access` `ln_chat` (grep) · flags จาก HAR `[E ev_69ac4dd7]` | `server/core.ts:127-129` · `server/chat.ts:35` | – | §5 ระบุ 3 ตัว · §12 ระบุ `ln_chat` | ✅ | REA static ไม่มี "storage" สำหรับ cookie httpOnly (ตั้งจาก server) |
| 7 | localStorage | ไม่มี (S3 · R6) `[E ev_e53483aa]` `[E ev_ddf5a3a5]` | ไม่มีการใช้ใน `web/` (grep 0) | – | ไม่พูดถึง | ✅ | – |
| 8 | กันจองทับ | REA ไม่เห็น | `checkNoOverlap` `server/bookings.ts:126` + lock `:236` | `bookings_no_overlap` EXCLUDE `mig/005:77-81` · probe P1 ERROR | NFR-07 · §12 | ✅ (source + DB + probe 201/409) | กฎฝั่ง server + DB · REA ไม่อ่าน Postgres |
| 9 | ออกจากระบบ | HAR: logout → `Set-Cookie ln_customer=; Max-Age=0` ดูเหมือนออกจริง `[E ev_69ac4dd7]` | cookie = `sign({cid})` ไม่มีสถานะ server `server/crypto.ts:21-41` · logout ไม่บันทึกอะไร `app/api/customers/logout/route.ts:5-9` | ไม่มีตาราง session | §5 logout `{ ok:true }` | ❌ (เบราว์เซอร์ดูออกแล้ว แต่ server ยังรับ cookie เดิม · probe 200) | REA เห็นแค่สิ่งที่เบราว์เซอร์ได้รับ · ส่ง cookie เก่าซ้ำต้องทำเอง → **CR-01** |
| 10 | เช็กอินได้เมื่อไร | HAR เช็กอินการจองวันนี้ 200 `[E ev_69ac4dd7]` | `staffCheckin` ไม่ตรวจวัน `server/features.ts:441-459` · `checkinBlockedBy` ดูแค่สถานะ `:422` | – | §6 "ทุกเวลา" | ⚠️ source = SPEC แต่ขัด [D] A-45 "เฉพาะวันเตะ" | REA ไม่ได้ลองวันอื่น · probe เช็กอินล่วงหน้า 2 วันได้ 200 → **CR-02 (1)** |
| 11 | ผู้ทำในประวัติ | REA ไม่เห็น (หน้าลูกค้าไม่มีผู้ทำ · `history[]{toStatus,at}`) `[E ev_69ac4dd7]` | actor = username `server/features.ts:457` · label แปลแค่ CUSTOMER/BOT/SYSTEM `rules/records.ts:35-37` | `booking_status_history.actor` = `staff` | §12 `actorLabel` | ⚠️ ขัด [D] A-44 "ชื่อพนักงาน" | หลังบ้านไม่ได้เปิดในเส้นทาง HAR → **CR-02 (2)** |
| 12 | ยอดเงินจองในรายงาน | `bookingMoney 10800` ก้อนเดียว `[E ev_69ac4dd7]` | `summarizeMoney` รวมทุก method ยกเว้น CREDIT `rules/reports.ts:50-58` | `payments.method` แยก PROMPTPAY / CASH_AT_FIELD ได้อยู่แล้ว | §12 คอลัมน์ CSV "ยอดจอง" | ⚠️ ขัด [D] A-41 | – → **CR-03** |
| 13 | ช่วงรายงาน 3 เดือน | REA ไม่ได้ลอง | `to >= addMonths(from,3)` `rules/reports.ts:21-26` | – | §14 "วันสิ้นสุด < วันเริ่ม + 3 เดือน" | ⚠️ ขัด [D] A-46 (probe 30 พ.ย.–28 ก.พ. → 400) | → **CR-02 (4)** |
| 14 | แชทจำบทสนทนา | ตอบคำถามเดียวถูก `[E ev_69ac4dd7]` | ประวัติ 20 ข้อความถูกส่ง `server/chat.ts:193-205` แต่ mock ใช้ข้อความล่าสุดเท่านั้น `chat/mock.ts:244-258` | `chat_messages` เก็บครบ | §13 "ส่งประวัติ 20 ข้อความ" | ❌ ขัด FR-35 / US-39 (e2e TC-CHAT-14/15/16 แดง) | HAR ถามคำถามเดียว · ต้องถามต่อในห้องเดียวกันถึงจะเห็น → **CR-04** |
| 15 | ราคาบนหน้าแรก | REA ไม่เห็น (server component render เป็น HTML) | ค่าคงที่ `SEED_FIELDS` `server/schema.ts:5-9` · `app/page.tsx:67,85` | `fields` ค่าเดียวกันวันนี้ | §1 | ⚠️ ตรงวันนี้ แต่มี 2 แหล่ง | → เสี่ยง **CR-05** (แก้ DB แล้วหน้าแรกไม่เปลี่ยน) |
| 16 | ประวัติ/audit แก้ไม่ได้ | REA ไม่เห็น | ไม่มีเส้นแก้/ลบ (404) `app/api/owner/audit/route.ts:11-14` | trigger `mig/002:57-65` · แต่ TRUNCATE ได้ · role superuser ปิด trigger ได้ (probe P7 P8) | §12 "ฐานข้อมูลก็ห้ามด้วย trigger" | ⚠️ | REA ไม่อ่าน DB |
| 17 | ของที่รัน = source | digest static `b56c87a0cafa` · server `2d29e16a2735` (ผูกกับ build `TK4zvCp98igi-iwAU3Uzu`) | sha256 source 163 ไฟล์ใน container = `web/` | – | – | ✅ | – |
| 18 | ความลับใน bundle | static ไม่มี storage/secret finding `[E ev_e53483aa]` | `secret.ts` อ่าน env ฝั่ง server เท่านั้น | – | NFR-18 | ✅ (grep static: `DATABASE_URL` 0 · `SESSION_SECRET` 0 · `postgres://` 0 · `scrypt$` 0) | – |
| 19 | BUG_MODE | server bundle มีคำ `BUG_MODE` 9 ไฟล์ (grep) | `server/core.ts:27-29` + ทางแยกใน rules | – | §0 | ✅ ตอนนี้ปิด (`/api/version` bugMode 0) | REA ไม่รู้ค่า env ตอนรัน |
| 20 | เวอร์ชัน schema | runtime `/api/version` = 006 | `max(version)` `app/api/version/route.ts:12` | `schema_migrations` 001–006 · 005 applied หลัง 006 | §0 006 | ⚠️ ตัวเลขตรง แต่ถ้า 005 ถูกถอยค้าง ยังตอบ 006 | – |
| 21 | ช่องทดสอบ | HAR ไม่มี (สคริปต์เรียก reset นอกเบราว์เซอร์) | `server/testing.ts:22-23` | – | §0 404 เมื่อปิด · NFR-21 | ✅ (GET reset → 404 · compose ค่าเริ่ม 0) | ไม่ได้ผ่านเบราว์เซอร์ |

สรุป: ✅ 11 · ⚠️ 8 · ❌ 2 (รวม 21) · แถวที่ [E]/[source] ขัด [SPEC] หรือ [D] ส่งต่อเป็นคำถามใน `SPEC-GAPS.md` (ห้ามตัดสินเอง)

### จุดที่หลักฐานขัดกันมากที่สุด (เรียงตามผลกระทบ)

1. **logout (แถว 9)** — HAR บอกว่า cookie ถูกลบ · server รับ cookie เดิมต่อ (probe) · source ไม่มีสถานะ session → ดูจากเบราว์เซอร์อย่างเดียวจะสรุปผิดว่า "ออกได้แล้ว"
2. **รายการ API (แถว 1)** — REA static เห็น 0 จาก 60 เส้น ขณะที่ HAR เห็น 19 และ source มี 60 → ถ้าเชื่อ static อย่างเดียวจะสรุปผิดว่า "ไม่มี API"
3. **แชทจำบทสนทนา (แถว 14)** — SPEC บอกส่งประวัติ 20 ข้อความ (จริง) แต่สมอง mock ไม่ใช้ → "ส่งประวัติ" ≠ "จำได้"
4. **เช็กอิน / ช่วงรายงาน / ผู้ทำ / ยอดแยกช่องทาง (แถว 10–13)** — source กับ SPEC ตรงกัน แต่ขัดคำตอบร้าน A-41 A-44 A-45 A-46 → ตัวอย่าง "โค้ดบอก = เอกสารบอก ≠ ร้านต้องการ"
5. **append-only (แถว 16)** — SPEC/บันทึกส่งมอบบอกห้ามแก้ · DB กันแค่ UPDATE/DELETE รายแถว · superuser + TRUNCATE ผ่านได้

## 5. สิ่งที่ REA ไม่เห็น (ไม่พบในหลักฐานนี้ ≠ ระบบไม่มี)

| เรื่อง | ไม่พบในหลักฐานนี้ เพราะ… | ตาที่ใช้แทน |
|---|---|---|
| path `/api/…` ใน bundle เบราว์เซอร์ | ส่งผ่านตัวแปรของ `api()` / template literal · coverage partial · unknowns 11,645 | grep build · HAR · source |
| กฎราคา จองทับ สิทธิ์ บทบาท | อยู่ใน server · REA อ่านเป็น text ไม่รัน | source + selfcheck + probe |
| constraint / trigger | REA ไม่อ่าน Postgres | `psql` (`pg_constraint` · `pg_trigger`) |
| หน้าหลังบ้าน | scenario ไม่ได้ login (ไม่ส่งรหัสผ่านให้ REA) | HAR ขั้น 06–07 |
| console error ระหว่าง scenario | `completeness incomplete (missing: events)` | e2e / `selfcheck/screens-v2.mjs` |
| source เดิมจาก source map | recovered 0 ทั้งสองฝั่ง | มี source ใน repo อยู่แล้ว (skill ของ REA: "Skip REA for ordinary source-repository architecture analysis") |
| CSV ดาวน์โหลด | HAR ไม่บันทึกไฟล์ดาวน์โหลด | `curl` ด้วย cookie owner |
| เส้นที่ไม่ได้เดิน (41 เส้น) | HAR/scenario เห็นแค่เส้นทางที่เดิน | e2e เดิม 128 TC · เพิ่มขั้นใน `tools/record-har.mjs` |

## 6. คำถามที่ต้องไปหาคำตอบจากโค้ดหรือฐานข้อมูล (ตอบแล้วใน SYSTEM-MAP)

| คำถาม | คำตอบ (แหล่ง) |
|---|---|
| หน้าเว็บเรียก API ผ่านอะไร ทำไม REA ไม่เห็น path | `api(lang, path)` `web/lib/client.ts:8` · ทุก `*Client.tsx` (SYSTEM-MAP B) |
| session ถูกเก็บที่ไหน logout ล้างอะไร | cookie เซ็น HMAC ไม่มีสถานะ server `server/crypto.ts:21-41` · logout ลบแค่ cookie ฝั่งเบราว์เซอร์ |
| ใครกันจองทับ: แอปหรือ DB | ทั้งสอง: `checkNoOverlap` + advisory lock + EXCLUDE (SYSTEM-MAP E BR-06 · F1) |
| ราคาต่อชั่วโมงมาจากไหน มีวันมีผลไหม | คอลัมน์ `fields.day_rate/evening_rate` ไม่มีช่วงวัน (`mig/001:14-17`) + ค่าคงที่หน้าแรก (`server/schema.ts:5-9`) |
| ประวัติสถานะเก็บผู้ทำเป็นอะไร | username จาก `tx(…, { actor: staff.username })` (`server/features.ts:457`) |
| reset ล้างอะไร เอา seed จากไหน | TRUNCATE 23 ตารางแล้ว INSERT ตาม `db/init/02-seed.sql` (mount อ่านอย่างเดียว `web/compose.yaml`) · ไม่ล้าง `app_settings` นอกจาก `clock` (`server/testing.ts:49-52`) |
| แชทบอทได้ประวัติห้องไหม | ได้ 20 ข้อความ (`server/chat.ts:193-205`) · สมอง mock ไม่ใช้กับคำถามว่าง/ราคา (`chat/mock.ts:244-258`) |
| เว็บต่อ DB ด้วย role อะไร | `football` superuser (`pg_stat_activity` + `pg_roles`) |

## 7. ค่าที่ล็อกได้เป็น [E] (ระบบทำอยู่ · ใช้ล็อกพฤติกรรมเดิมก่อนแก้ · ไม่ใช่ค่าที่ร้านต้องการ)

| ค่า | [E] | หมายเหตุ |
|---|---|---|
| จอง C ศ 9 ต.ค. 20:00 1 ชม. → ค่าสนาม ฿1,800 · `FULL_100` · จ่ายตอนจอง ฿1,800 · เก็บหน้าสนาม ฿0 | `[E ev_ddf5a3a5]` | ตรง [D] BR-07/BR-11 ด้วย → ใช้เป็น golden ได้ |
| จอง B ศ 9 ต.ค. 18:00 → ฿1,200 `FULL_100` · `POST /api/bookings` 201 · รหัส `LN-100001` | `[E ev_69ac4dd7]` | ตรง [D] |
| `POST …/pay` → `{ok, code, amount:1200, bookings:[code], messageCode:"OK_PAID"}` | `[E ev_69ac4dd7]` | สัญญา API |
| เช็กอิน → `collected 0` · `CHECKED_IN` | `[E ev_69ac4dd7]` | **ห้ามล็อกว่า "เช็กอินได้ทุกวัน"** เพราะขัด [D] A-45 |
| รายงาน 1–9 ต.ค. → `bookingMoney 10800` · `salesCash 40` · `salesPromptpay 60` · `total 10900` · `bookings 6` · `noShow 2` | `[E ev_69ac4dd7]` | หลัง CR-03 คอลัมน์เดิมต้องคงอยู่ (ร้านมีสูตร Excel) · ยอด 10,800 รวมการจอง HAR LN-100001 ฿1,200 |
| แชท "พรุ่งนี้ 19:00 สนาม A ว่างไหม" → "สนาม A ส. 10 ต.ค. 2026 19:00–20:00 ว่างครับ ค่าสนาม ฿1,200 …" + การ์ด `check available:true` | `[E ev_69ac4dd7]` | CR-04 ต้องไม่ทำให้คำตอบนี้เปลี่ยน |
| cookie: `ln_customer` 30 วัน · `ln_staff` 12 ชม. · `ln_chat` 90 วัน · `ln_access` 30 วัน · HttpOnly · SameSite=lax | `[E ev_69ac4dd7]` | CR-01 จะเปลี่ยนกลไก ไม่ควรเปลี่ยนชื่อ/อายุโดยไม่มีเหตุ |
