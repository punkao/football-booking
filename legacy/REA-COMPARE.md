# REA-COMPARE — เทียบ `v2-handover` ↔ HEAD ด้วย REA (แผน L6 · บท 05 LAB 9 · บท 06 LAB 11 ข้อ 2)

ทำเมื่อ 2026-10-21 · image `rea-lab:6.4.0` (เรียกด้วย `legacy/rea-out/rea.sh` ตามที่จดไว้ใน `legacy/REA-INVENTORY.md`) · ไฟล์ผลใหญ่ทั้งหมดอยู่ใน `legacy/rea-out/` (git-ignored) · อ่านผ่านตัวย่อ `rea-tools.mjs` ของบท 06 เท่านั้น (ไม่เปิดไฟล์ดิบ)
ป้ายแหล่ง `[E ev_…]` = evidence id ของผล REA ตัวนั้น · ฝั่ง "ก่อน" = **build จาก tag `v2-handover`** (`git archive v2-handover web` → `docker build` → image `football-web:v2-handover`) · ฝั่ง "หลัง" = image `football-web:v2` ที่รันอยู่ (HEAD `ea32d4d`)
> ประโยคหลักของบท: **"REA ไม่เห็น" ≠ "ไม่ได้เปลี่ยน"** · REA เห็นเฉพาะของที่ส่งถึงเบราว์เซอร์ + เส้นทางที่เดิน · กฎเงิน/กฎสิทธิ์/ฐานข้อมูลอยู่นอกสายตา

> ทำเพิ่มเกินบทเรียน (เหตุผล): (1) เทียบ sha256 **รายไฟล์** ของ `.next/static` และ `.next/server` ด้วยตัวเอง (หลังแทน BUILD_ID ให้เหมือนกัน) เพราะ `compare-application-versions` ตอบ `unchanged 0` ทั้งสองฝั่ง ชี้ไม่ได้ว่าไฟล์ไหนเปลี่ยนจริง ใช้เป็นเฉลยให้ตรวจ REA · (2) วิเคราะห์ฝั่ง server ด้วย (บทเรียนเน้นฝั่งเบราว์เซอร์) เพราะ CR ของเรา 4 ใน 6 อยู่ฝั่ง server

## 1. หลักฐานที่เก็บ (ทุกตัวรันรอบนี้)

| แหล่ง | คำสั่ง REA | evidence | ผลสั้น |
|---|---|---|---|
| static ก่อน (`handover/.next/static` 165 ไฟล์) | `analyze-javascript-application` | `[E ev_d9325e10]` | js 123 ไฟล์ · module 50 · unknown 176 · coverage partial |
| static หลัง (`head/.next/static` 165 ไฟล์) | เหมือนกัน | `[E ev_94854135]` | js 123 ไฟล์ · module 60 · unknown 164 · partial |
| server ก่อน / หลัง (`.next/server` 1,152 ไฟล์ทั้งคู่) | เหมือนกัน | `[E ev_5c316078]` / `[E ev_6ee957e3]` | partial |
| เทียบ static | `compare-application-versions` | `[E ev_eea528bb]` | **unchanged 0 · added 0 · removed 0 · changed 167 · unknown 265** (items 432) |
| เทียบ server | เหมือนกัน | `[E ev_55aa0da8]` | **unchanged 0 · added 0 · removed 0 · changed 927 · unknown 1,759** (items 2,686) |
| HAR เส้นทางหลัก 7 ขั้น ก่อน / หลัง | `inspect-web-network-capture` | `[E ev_69ac4dd7]` (20 ต.ค.) / `[E ev_ea27a8c4]` | 300 → 314 records · API 19 เส้นเท่ากัน |
| scenario จอง C ศ 9 ต.ค. 20:00 แล้วจ่าย ก่อน / หลัง | `capture-browser-scenario` | `[E ev_ddf5a3a5]` / `[E ev_22a11b07]` | 11/11 ทั้งคู่ |

หมายเหตุสำคัญ 3 ข้อก่อนอ่านตาราง:
1. **REA ให้ค่าไม่นิ่ง**: static ก่อนวิเคราะห์ 2 ครั้งจาก bytes ชุดเดียวกัน (ไฟล์ทุกไฟล์เหมือนกัน ยกเว้นโฟลเดอร์ BUILD_ID) ได้ module 53 / unknown 172 `[E ev_e53483aa]` (20 ต.ค.) กับ module 50 / unknown 176 `[E ev_d9325e10]` (วันนี้) — ชนเพดานทรัพยากร (`coverage.semantic truncated: true`) → ตัวนับ module/unknown เอามาเทียบละเอียดไม่ได้
2. build จาก tag ได้ chunk ชุดเดียวกับ build ตอนรับมอบ 20 ต.ค. ทุกไฟล์ (ต่างแค่โฟลเดอร์ BUILD_ID) → ฝั่ง "ก่อน" ของงานนี้ = ของที่ส่งมอบจริง
3. `compare-application-versions` ฝั่ง static: **ทั้ง 167 `changed` เป็นมิติ `properties`/`location` ทั้งหมด ไม่มีมิติ `content` เลยสักตัว** (ส่วนใหญ่เพราะ path ที่ฝัง BUILD_ID) → อ่านไม่ได้ว่าโค้ดหน้าไหนเปลี่ยน

## 2. เฉลยจาก sha256 รายไฟล์ (ตาข่ายสำรองที่ไม่ใช่ REA)

| ฝั่ง | ไฟล์ก่อน / หลัง | ชื่อไฟล์ต่าง | เนื้อหาต่าง (ชื่อเดิม · แทน BUILD_ID แล้ว) |
|---|---|---|---|
| `.next/static` (เบราว์เซอร์) | 165 / 165 | **7** = chunk โค้ดหน้า 4 + manifest ของ BUILD_ID 3 | 0 (chunk ใช้ชื่อตาม hash เนื้อหา → เปลี่ยนเนื้อหา = เปลี่ยนชื่อ) |
| `.next/server` (เซิร์ฟเวอร์) | 1,152 / 1,152 | 4 ↔ 4 (chunk `lib_*`) | **185** = loader route/page 94+34(.nft)+33+2 · manifest 3 · **chunk ที่มีโค้ดจริง 19** (`chunks` 12 + `chunks/ssr` 7) |

chunk ฝั่งเบราว์เซอร์ 4 ตัวที่เปลี่ยน (จับคู่จากข้อความในไฟล์ + `git diff v2-handover..HEAD`): `ReportsClient` (หน้ารายงาน · 7,692 → 10,081 ไบต์ · มี "เก็บหน้าสนาม" "จากทีมรับคำท้า") · `MyClient` (หน้า /my ค้นการจอง · 9,548 → 9,595) · `BookingHistoryClient` (ประวัติการจองหลังบ้าน · 5,341 → 5,642) · `i18n` (ข้อความ TH/EN · 38,735 → 39,152)
ฝั่ง server: `route.js` ส่วนใหญ่เป็นแค่ตัวโหลด chunk → **เปลี่ยนไฟล์เพราะ chunk ที่มันชี้เปลี่ยนชื่อ** ไม่ได้แปลว่า route นั้นถูกแก้ (เช่น `api/availability/route.js` ไม่มี CR แตะแต่ bytes ต่าง) · ตรงข้าม `api/customers/logout/route.js` (CR-01 แก้ `route.ts` จริง) **bytes เหมือนเดิมทุกตัว** เพราะโค้ดใหม่อยู่ใน chunk ที่ใช้ร่วม

## 3. ตาราง "CR × REA เห็นไหม"

อ่านคอลัมน์: ✅ เห็นและชี้ได้ · ⚠️ `changed` แต่ชี้ไม่ได้ว่าใช่ CR นี้ / เป็นเสียงรบกวน · ❌ ไม่เห็น (REA ว่า unchanged หรือไม่มีใน evidence) · "–" ไม่เกี่ยว

| CR | ที่ควรเปลี่ยนในของที่ส่งถึงผู้ใช้ | REA static (เบราว์เซอร์) | REA server compare | HAR / scenario ซ้ำบน HEAD | ถ้า REA ไม่เห็น เพราะอะไร | เทสต์ที่พิสูจน์แทน |
|---|---|---|---|---|---|---|
| **CR-01** ออกจากระบบแล้วใช้ cookie เดิมไม่ได้ | ไม่มี chunk หน้าเว็บเปลี่ยน (server ล้วน: `auth.ts` `crypto.ts` `core.ts` logout route + ตาราง `revoked_sessions`) | ❌ ไม่มี chunk ใดเปลี่ยน | ❌ `customers/logout/route.js` bytes เท่าเดิม · chunk `lib_server_auth_ts` อยู่ในกลุ่ม 16 chunk ที่ REA **ไม่** ขึ้นว่า content เปลี่ยน | ❌ `POST /api/customers/logout` 200 `{ok}` เหมือนเดิมทุกคีย์ `[E ev_ea27a8c4]` — เหมือนที่ HAR ตอนรับมอบ "ดูเหมือนออกจริง" แต่ server รับ cookie เดิมต่อ | HAR เห็นแค่ response ของ logout · "ส่ง cookie เก่าซ้ำ" ต้องทำเอง · สถานะ session อยู่ใน DB (REA ไม่อ่าน Postgres) | `e2e/tests/cr/cr-01.spec.ts` (4) + TC-ROLE-03 (ถอดจาก known-issue) + `web/lib/server/session.test.ts` · **ซ้อมถอยกลับ 21 ต.ค.: เว็บรุ่น `v2-handover` หลัง logout `GET /api/me` ได้ 200 · เว็บ HEAD ได้ 401** (`docs/RUNBOOK.md`) |
| **CR-02** แก้ 5 จุด (เช็กอินก่อนวันเตะ · ชื่อพนักงานในประวัติ · ขั้น "จบ" · ช่วงรายงาน · ค้นการจองไม่กรอก) | chunk หน้า /my (ข้อความ "กรอกทั้งสองช่อง") + chunk i18n · ที่เหลือ server (`features.ts` `reports.ts` `booking.ts` `records.ts`) | ⚠️ chunk `MyClient` + `i18n` เปลี่ยนจริง (จากชื่อไฟล์) แต่ compare บอกแค่ `changed` มิติ properties ชี้ไม่ได้ | ⚠️ `staff/bookings/[code]/checkin/route.js` ขึ้น content-changed — ปนกับอีก 60+ route ที่ขึ้นเพราะ chunk เปลี่ยนชื่อ · `app/my/page.js` ขึ้น **ไม่เปลี่ยน** (หน้าเป็นแค่ตัวห่อ) | ❌ เช็กอินวันเตะ 200 `{ok,collected,booking,actions…}` เหมือนเดิม (เส้นทาง HAR เช็กอิน "วันนี้" ซึ่งยังเช็กอินได้ → ไม่ได้ลองวันอื่น) | กฎ "เช็กอินได้เฉพาะวันเตะ" เป็น branch ใน server ที่ HAR ไม่เดินเข้า | `cr-02.spec.ts` (6) + `cr-02.serial.spec.ts` (3) + TC-STAFF-06 TC-REPORT-01 TC-TRACK-01 TC-DATA-01 TC-BOOK-11 + `rules/cr02.test.ts` |
| **CR-03** รายงานแยกพร้อมเพย์ / เก็บหน้าสนาม + ชั่วโมงใช้สนาม | chunk `ReportsClient` + API `GET /api/owner/reports` (+ `.csv`) | ⚠️ chunk `ReportsClient` เปลี่ยนจริง (ชื่อไฟล์) · compare ชี้ไม่ได้ | ⚠️ `owner/reports/route.js` + `reports.csv/route.js` ขึ้น content-changed · chunk `ReportsClient` ฝั่ง SSR **ไม่** ถูกขึ้น | ✅ **HAR เห็น**: `/api/owner/reports` response คีย์ `from,to,days,totals` → `+ fieldUse` `[E ev_69ac4dd7]` → `[E ev_ea27a8c4]` (เส้นอื่นอีก 18 เส้น status + คีย์เท่าเดิมทุกตัว) | – (HAR เห็นเพราะเส้นทางหลักเปิดรายงานพอดี · คอลัมน์ CSV ใหม่ HAR ไม่เก็บไฟล์ดาวน์โหลด) | `cr-03.spec.ts` (4) + TC-REPORT-04 + golden side 15/15 + `rules/cr03.test.ts` |
| **CR-04** น้องบอลจำเรื่องที่คุยไปแล้ว | server ล้วน (`chat/mock.ts` `engine.ts` `prompt.ts` — สมองแชท) | ❌ ไม่มี chunk เบราว์เซอร์เปลี่ยน (แชทเรียก `/api/chat` ผ่านตัวแปร) | ⚠️ `api/chat/route.js` ขึ้น content-changed ปนกับ route อื่น · โค้ดสมองแชทอยู่ใน chunk `lib_*` (REA ขึ้น content แค่ 3 จาก 19 chunk โค้ดที่เปลี่ยน ไม่ได้ตรวจรายตัวว่ามีตัวนี้ไหม) | ❌ `POST /api/chat` ถามคำถามเดียว `{sessionId,reply,cards,failed}` เหมือนเดิม — **ไม่ได้ถามต่อเนื่องในห้องเดียวกัน จึงเห็นการ "จำ" ไม่ได้** | พฤติกรรมเกิดเมื่อถามข้อความที่ 2 ขึ้นไป · HAR/scenario ถามข้อความเดียว | `cr-04.spec.ts` (4) + TC-CHAT-14/15/16 + `chat/cr04.test.ts` + `cr05.test.ts` (ฝั่งแชท) |
| **CR-05** ราคาเย็นสนาม A/B ฿1,300 ตั้งแต่ 1 พ.ย. | หน้าแรก `/` + หน้า `/fields` (server component อ่านราคาจาก DB) + `GET /api/fields` (`rateChanges`) + chunk i18n + migration 008 | ❌ หน้าพวกนี้ render ฝั่ง server ไม่อยู่ใน bundle เบราว์เซอร์ · เห็นเพียง chunk i18n (⚠️) | ✅ **`app/page.js` และ `app/fields/page.js` เป็น 2 หน้าเดียวที่ขึ้น content-changed** (ตรงกับที่ CR แก้จริง 2/2) + `api/fields/route.js` ✅ — แต่ REA บอกไม่ได้ว่าเปลี่ยน "ราคา" | ❌ scenario จอง C ศ 9 ต.ค. 20:00 ได้ ค่าสนาม ฿1,800 / เก็บหน้าสนาม ฿0 เท่าเดิม `[E ev_ddf5a3a5]` = `[E ev_22a11b07]` (**ถูกต้อง**: ก่อน 1 พ.ย. ราคาต้องไม่เปลี่ยน) · HAR ไม่เรียก `/api/fields` | ราคาตามวันเตะเป็นกฎ + ข้อมูลในตาราง `field_rates` (REA ไม่อ่าน DB) · HAR/scenario ใช้วัน 9 ต.ค. ไม่ข้าม 1 พ.ย. | `cr-05.spec.ts` (3) + `cr-05.serial.spec.ts` (7) + golden quote-nov 132/132 + golden quote 261/261 (ราคาเดิมไม่ขยับ) + `rules/cr05.test.ts` + E76/E77 |
| **CR-06** เงินคำท้าเป็นเงินร้าน (รายงาน + ป้าย "จากทีมรับคำท้า") | chunk `BookingHistoryClient` + `ReportsClient` + i18n · API `source` BOOKING/CHALLENGE · migration 009 | ⚠️ chunk `BookingHistoryClient`/`ReportsClient` เปลี่ยนจริง (ชื่อไฟล์) · ชี้ไม่ได้ | ⚠️ `challenges/[id]/pay/route.js` ขึ้น content-changed ปนกับ route อื่น · chunk SSR ของ `BookingHistoryClient` **ไม่** ถูกขึ้น | ❌ HAR ไม่มีคำท้า · ยอดรายงาน seed เท่าเดิม (ไม่มีคำท้า MATCHED ใน seed) | ต้องมีคำท้าที่จ่ายแล้วถึงเห็นผล · ข้อมูลนั้นอยู่ใน DB | `cr-06.serial.spec.ts` (7) + `tools/reconcile-challenges.sql` (0/0) + **ซ้อมถอยกลับบนข้อมูลเสมือนจริง 30 คำท้า: `009.down` ลบแถวเงิน 30 แถว ฿34,220 → ขึ้นใหม่กลับมาเท่าเดิมทุกคอลัมน์** |

สรุปตัวเลขของ REA: static เห็นครบ 4 chunk แค่ "ชื่อไฟล์ต่าง" (ไม่ใช่ผลของ `compare`) · server: content-changed 169 ไฟล์ = loader/manifest 166 (เสียงรบกวน) + chunk โค้ดจริง 3 จาก 19 → **ชี้ CR ได้ตรง ๆ แค่ CR-05 ที่แก้ page server component (2/2) และ CR-03 ที่ response HAR มีคีย์ใหม่** · อีก 4 CR ชี้ไม่ได้

## 4. เส้นทางเดิมซ้ำบน HEAD (HAR + scenario) — [E] ว่าของเดิมไม่ขยับ ไม่ใช่หลักฐานว่า CR ทำงาน

| เส้นทางเดิม | ก่อน (ตอนรับมอบ) | หลัง (HEAD) | ผล |
|---|---|---|---|
| HAR 7 ขั้น · API 19 เส้น (availability · quote · rentals · bookings · pay · login · me · logout · chat · staff login/checkin/logout · dashboard · reports …) | status 200/201 · `-1` เฉพาะ 3 คำขอที่สคริปต์ยกเลิกเอง (owner/holidays · owner/closures · staff/logout ครั้ง 2) `[E ev_69ac4dd7]` | status เท่ากันทุกเส้น (รวม `-1` 3 ตัวเดิม) · request/response คีย์เท่ากันทุกเส้น **ยกเว้น `/api/owner/reports` ได้ `fieldUse` เพิ่ม** (CR-03 ตั้งใจ) `[E ev_ea27a8c4]` | เหมือนเดิม + 1 คีย์ที่อนุญาต |
| scenario จองเดี่ยว C ศ 9 ต.ค. 20:00 → จ่าย | 11/11 · ค่าสนาม ฿1,800 · เก็บหน้าสนาม ฿0 · URL `/booking/LN-100001?done=paid` `[E ev_ddf5a3a5]` | 11/11 · ฿1,800 · ฿0 · `/booking/LN-100002?done=paid` `[E ev_22a11b07]` | เหมือนเดิม (รหัสนัดเป็น LN-100002 เพราะรันหลัง HAR ที่ใช้ LN-100001 · ภาพหน้าสุดท้ายไม่ได้เทียบทีละพิกเซล) |

## 5. สิ่งที่ REA มองไม่เห็น → เทสต์ไหนพิสูจน์แทน

| REA มองไม่เห็น | เพราะ | พิสูจน์ด้วย |
|---|---|---|
| กฎที่อยู่ฝั่ง server (เช็กอินวันเตะ · ช่วงรายงาน · คิดราคาตามวันเตะ · ความจำของแชท · เงินคำท้า) | อยู่ใน chunk `lib_*` ที่ REA ไม่ขึ้น content หรือเป็น `unknown` (coverage partial) · อ่านเป็น text ไม่รัน | e2e `tests/cr/*` + golden (quote 261 · side 15 · quote-nov 132) + unit `web/lib/**/*.test.ts` (137) + rules-check 191 |
| สถานะ session / การ revoke cookie | อยู่ในตาราง Postgres · HAR เห็นแค่ response ของ logout | `cr-01.spec.ts` · TC-ROLE-03 · smoke ข้อ S7 (หลังบ้านไม่ล็อกอิน 401) · ซ้อมถอยกลับ (เว็บเก่า 200 / เว็บใหม่ 401) |
| ข้อมูลและ migration (007 008 009 · constraint · trigger) | REA ไม่อ่าน Postgres | TC-DATA-03 · check-testdata E148 · `tools/reconcile-challenges.sql` · ซ้อมถอยกลับ (md5 รายตาราง 26 ตาราง ก่อน/หลัง) |
| หน้าที่ render ฝั่ง server (หน้าแรก · /fields) | ไม่อยู่ใน bundle เบราว์เซอร์ | `cr-05.spec.ts` อ่านหน้าจริงด้วย Playwright · smoke S3 S9 |
| เส้นทางที่ไม่ได้เดิน (HAR เดินแค่ 7 ขั้น) | HAR/scenario เห็นแค่ที่เดิน | e2e 128 TC × 3 เบราว์เซอร์ + serial |
| ไฟล์ดาวน์โหลด (CSV รายงาน) | HAR ไม่บันทึกไฟล์ | TC-REPORT-03/04 · golden side |
| ค่า env ตอนรัน (`BUG_MODE` · ช่องทดสอบ `/api/test/*`) | REA ไม่รู้ค่า env | smoke S2 (bugMode 0) S8 (GET /api/test/reset ไม่ใช่ 200) · baseline §4 ปิด seam |
| เส้นทางถอยกลับ (`*.down.sql` + สลับ image) | ไม่ใช่ของที่ส่งถึงเบราว์เซอร์ | ซ้อมถอยกลับจริง `docs/RUNBOOK.md` |

## 6. ข้อจำกัดของหลักฐานชุดนี้

- ตัวเลข unknown/module ของ REA ไม่นิ่ง (หมายเหตุ 1) → ใช้ชี้ทิศทางเท่านั้น
- ฝั่ง server บอก "เปลี่ยน" ได้กว้างเกินจริง (loader เปลี่ยนตาม chunk) และพลาดโค้ดจริง 16 จาก 19 chunk → **ห้ามใช้ `changed` ของ REA แทน `git diff`**
- HAR ซ้ำบนระบบ **reset ข้อมูลแล้วจองใหม่** → หลังรันข้อมูลในฐานเป็นของเส้นทางนั้น (ฐานถูก reset กลับ seed ปกติหลังงานนี้)
- ไม่ได้รัน REA กับ `v2-handover` ที่ขึ้นเป็น container จริงคู่กัน — ฝั่ง "ก่อน" ของ HAR/scenario เป็นหลักฐานของวันที่ 20 ต.ค. (ระบบ build จาก tag เดียวกัน ตรวจแล้วว่า chunk เหมือนกันทุกไฟล์)
