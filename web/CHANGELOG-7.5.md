# CHANGELOG เฟส 7.5 — แก้เว็บตาม requirement หลังผลทดสอบ

ที่มา: `docs/08b-FIX-PROMPT.md` · แหล่งความจริง `docs/04-REQUIREMENTS.md` (BR-13, 15, 19, 24–28, NFR-03, 08, 09, 13, ส่วนที่ 6) · คำตอบร้าน A-18–A-26
ไม่ได้เปิดหรือแก้ `e2e/` · ไม่ได้แก้ `docs/` · seed, รหัส error, ข้อความ และ `data-testid` เดิมไม่เปลี่ยน (เพิ่มอย่างเดียว)

## ข้อ 1–17

| # | ผล | ไฟล์ที่แก้ | วิธีตรวจ |
|---|---|---|---|
| 1 | ทำแล้ว | `lib/rules/booking.ts` (`checkCancel`, `checkReschedule` + `challengeMatched`) · `lib/i18n.ts` (`CHALLENGE_MATCHED`) · `lib/server/bookings.ts` (`isChallengeMatched`, cancel/reschedule lock คำท้า, `actions.cancelBlockedBy`) · `lib/server/features.ts` (`challengePay` lock การจองก่อน + ตรวจสถานะการจอง) · `app/booking/[code]/BookingClient.tsx` | selfcheck `P75-1.*` (11 ข้อ รวมยิงพร้อมกัน 5 รอบ) · unit test · `screens-p75` `cancel-hint`, `reschedule-hint`, `cancel-click-error` |
| 2 | ทำแล้ว | `lib/server/schema.ts` (คอลัมน์ `bookings.customer_name` + ALTER สำหรับ DB เดิม, seed ใส่ชื่อ) · `lib/server/data.ts` (`customerName`, `bookingCustomerName`) · `bookings.ts` · `features.ts` (staff, today, series, split, challenges) | selfcheck `P75-2.*` (6 ข้อ: create / detail / staff / today / LN-900004 ยังเป็น "แนน" / `Customer.name` ไม่ถูกทับ) |
| 3 | ทำแล้ว | `lib/i18n.ts` (`LEVEL_LABEL` กลาง / เก่ง) · API `levelLabel` ใน `bookings.ts`, `features.ts` | selfcheck `P75-3.*` (TH, EN, filter) · `screens-p75` `levels-filter`, `level-word` |
| 4 | ทำแล้ว (กฎเดิมถูกอยู่แล้ว เพิ่มเหตุผลในหน้าเว็บ + ข้อตรวจ) | `lib/rules/booking.ts` (comment/ลำดับ) · `BookingClient.tsx` (`cancel-booking-hint`) | selfcheck `P75-4.minus-1min` (18:59 ได้ เครดิต 0) · `P75-4.at-start` (19:00 → `CANCEL_TOO_LATE`) · unit test |
| 5 | ทำแล้ว (เดิมทำงานถูก เพิ่ม `challengeDeadlineFrom` + ข้อตรวจค่าขอบ) | `lib/rules/extras.ts` · `features.ts` | selfcheck `P75-5.15m00s`, `P75-5.15m01s` · unit test |
| 6 | ทำแล้ว | `lib/rules/extras.ts` (`discountAmount` ใช้ `ceilBaht` แทน `Math.round`) | unit test 805 → 81, 801 → 81 · selfcheck `P75-6.ceil` (ผ่าน API ทำให้เกิดเศษไม่ได้ เพราะราคาปัจจุบันหารลงตัวทุกกรณี — A-24) |
| 7 | ทำแล้ว | `features.ts` (`splitCreate` ตอบลิงก์เดิม `existing: true`, ไม่ลบ share เดิม) · `i18n.ts` (`OK_SPLIT_EXISTS`) · `BookingClient.tsx` (`split-link-people`, `split-existing-note`) | selfcheck `P75-7.*` (token/คน/ยอดเดิม, สถานะจ่ายไม่ถูกล้าง) · `screens-p75` `booking-split-link` |
| 8 | ทำแล้ว (API เดิมตอบถูกอยู่แล้ว เพิ่มข้อตรวจครบค่าขอบ) | – | selfcheck `P75-8.*` (10 ข้อ: useCredit, creditUsed 1 / 0, เบอร์สมาชิกแต่ไม่ login, login คนละเบอร์, ลำดับ BR-06 ก่อน BR-15, BR-15 ก่อนชื่อ) |
| 9 | ทำแล้ว | `app/book/new/NewBookingClient.tsx` (disabled + `use-free-hour-reason`, ไม่ส่ง `useFreeHour` เมื่อปิด) | `screens-p75` `free-hour-disabled-17`, `free-hour-reason-17`, `free-hour-enabled-16`, `free-hour-none` · selfcheck `P75-9.*` (API ยังตอบ error เดิม) |
| 10 | ทำแล้ว | `app/split/[token]/SplitClient.tsx` | `screens-p75` `split-people-value` (12), `split-paid-count-value` (1) |
| 11 | ไม่ต้องแก้ (ตรวจแล้ว) | – | โหมด EN ป้ายวันหยุดแสดง "Public holiday · evening rate all day" ไม่แสดงชื่อ · หน้าเจ้าของแสดงชื่อตามที่ร้านตั้ง · `screens.mjs` ไม่พบข้อความไทยหลงในหน้าลูกค้าโหมด EN |
| 12 | ทำแล้ว | `NewBookingClient.tsx` (`book-submit-hint`) · `StaffClient.tsx` (`staff-checkin-hint`, `staff-no-show-hint`) · `features.ts` (`actions` ใน API ร้าน) · `BookingClient.tsx` (`cancel-booking-hint`, `reschedule-submit-hint`, `challenge-create-hint`) · `globals.css` | `screens-p75` `book-submit-hint`, `book-submit-error-same-as-api`, `no-show-hint`, `checkin-hint-after`, ปุ่มยัง enabled · selfcheck `P75-12.*` |
| 13 | ทำแล้ว | `NewBookingClient.tsx` (`field-error-*`, `aria-invalid`) | `screens-p75` `field-errors-all`, `first-error-name`, `three-field-errors`, `next-error-phone` |
| 14 | ทำแล้ว | `OwnerClient.tsx` (`aria-label` ลบวันหยุด) · `MyClient.tsx` (label เบอร์ 3 ช่องต่างกัน, ฟอร์มมี `aria-labelledby`) · `app/page.tsx` (h1 `aria-label`) | `screens-p75` `holiday-delete-names`, `my-phone-labels`, `home-h1-name` |
| 15 | ทำแล้ว | `NewBookingClient.tsx`, `SeriesClient.tsx` (`fld wide`) · `globals.css` | `screens-p75` `book-field-fits` (วัดความกว้างข้อความตัวเลือกยาวสุดเทียบช่อง) · ภาพ `p75-book-new-errors-*-375.png` |
| 16 | ทำแล้ว (ไม่เกิน 2 วินาที จึงไม่ต้องปรับความเร็ว) | `selfcheck/nfr08.mjs` (สคริปต์วัดใหม่) | ดูตาราง NFR-08 ด้านล่าง |
| 17 | ทำแล้ว | `SPEC.md` (ส่วนที่ 6 สต็อกของเช่า · testid · ข้อความ · API · ส่วนที่ 7 · ส่วนที่ 8 "เปลี่ยนแปลงเฟส 7.5") | อ่านทวน |

## ข้อ 1: สาเหตุจริงของเครดิตซ้อน และเส้นทางอื่นที่ตรวจ

**สาเหตุ:** `checkCancel()` ดูแค่สถานะการจองกับเวลา ไม่รู้จักคำท้าเลย และ `cancelBooking()` ปิดเฉพาะคำท้า `OPEN`/`AWAITING_PAYMENT` → การจองที่คำท้า `MATCHED` ยกเลิกได้ เจ้าของได้ BR-13 คืน ฿1,800 ทับเครดิต ฿900 ที่ได้จากทีมรับ (BR-28) = ฿2,700 จากที่จ่าย ฿1,800 · หน้าเว็บแสดงปุ่มยกเลิกทุกการจอง `CONFIRMED` · เลื่อนวันก็ไม่ตรวจเช่นกัน

| เส้นทาง | ผลก่อนแก้ | ผลหลังแก้ |
|---|---|---|
| เจ้าของยกเลิกหลัง `MATCHED` | ได้เครดิตซ้อน | `CHALLENGE_MATCHED` 409 |
| เจ้าของเลื่อนหลัง `MATCHED` | เลื่อนได้ (ทีมรับจ่ายมาสำหรับรอบเดิม) | `CHALLENGE_MATCHED` 409 |
| ยกเลิกระหว่าง `AWAITING_PAYMENT` แล้วทีมรับจ่ายทีหลัง | ไม่ซ้อน (คำท้าถูกปิดเป็น `CLOSED` แล้วการจ่ายได้ `CHALLENGE_NOT_OPEN`) | เหมือนเดิม + `challengePay` ตรวจสถานะการจองซ้ำ |
| ยกเลิกกับทีมรับจ่าย **พร้อมกัน** | เสี่ยง: cancel อ่านคำท้าก่อน pay commit แล้ว UPDATE ข้ามแถวที่เป็น MATCHED ไปแล้ว → ซ้อนได้ | lock ลำดับเดียวกัน (การจอง → คำท้า `FOR UPDATE`) ทั้ง cancel / reschedule / pay · selfcheck ยิงพร้อมกัน 5 รอบ ผ่าน 1 ฝั่งเสมอ |
| จ่ายคำท้าซ้ำ | ไม่ซ้อน (`MATCHED` → `CHALLENGE_NOT_OPEN`) | เหมือนเดิม |
| ไม่มา (`NO_SHOW`) | ไม่มีเครดิตคืน ไม่ซ้อน | เหมือนเดิม |
| เลื่อนการจองที่คำท้ายัง `OPEN` | ยอดทีมรับค้างตามราคาเดิม (ไม่ใช่เครดิตซ้อน แต่เงินไม่ตรง BR-28) | คิดยอดใหม่จากค่าสนามใหม่ (`P75-1.open-follows`) |
| **ปิดเพราะฝนการจองที่ `MATCHED`** | เจ้าของได้ BR-14 คืนเต็ม + เครดิตจากทีมรับที่ได้ไปแล้ว ทีมรับไม่ได้อะไรคืน | รอบ 1 เปิดเป็นคำถาม → ร้านตอบ A-27 → **แก้แล้วในรอบ 2** |
| เลื่อนระหว่างคำท้า `AWAITING_PAYMENT` | เลื่อนได้ ทีมรับจ่ายยอดเดิมสำหรับเวลาใหม่ | รอบ 1 เปิดเป็นคำถาม → ร้านตอบ A-28 → **แก้แล้วในรอบ 2** (`CHALLENGE_PENDING`) |

## selfcheck · unit test · NFR-08

| รายการ | ผล |
|---|---|
| `node selfcheck/rules-check.mjs` · `BUG_MODE=0` | 171 ข้อ ผ่าน 171 (เดิม 125 + ใหม่ `P75-*` 46) |
| `node selfcheck/rules-check.mjs --expect-bugs` · `BUG_MODE=1` | 171 ข้อ ผ่าน 168 ล้ม 3 = `BR-11.sat-17`, `BR-13.exact-24h`, `BR-22.bib-7` เท่านั้น ("RESULT: OK") |
| `node selfcheck/screens-p75.mjs` (หน้าเว็บ ข้อ 1, 3, 7, 9, 10, 12–15 + ภาพ 26 ไฟล์ `p75-*`) | `BUG_MODE=0` 119/119 · `BUG_MODE=1` 119/119 · ไม่มี console error ที่ไม่ได้ตั้งใจ · ไม่มีเลื่อนแนวนอนที่ 375 px · EN ไม่มีไทยหลง |
| `node selfcheck/screens.mjs` (หน้าหลักเดิม 33 ภาพ, regression) | OK |
| `npm test` (unit test `lib/rules`) | 24/24 (เดิม 20 + ใหม่ 4) |
| `npm run lint` · `tsc --noEmit` | ผ่าน ไม่มี error |

**NFR-08** — `node selfcheck/nfr08.mjs` เปิด `/book` จน `data-ready="true"` ครั้งละ 1 เบราว์เซอร์ 5 ครั้ง (context ใหม่ทุกครั้ง) หน่วย ms

| เบราว์เซอร์ | ก่อนแก้ | หลังแก้ | ≤ 2,000 ทุกครั้ง |
|---|---|---|---|
| chromium | 459, 193, 247, 247, 247 | 216, 243, 184, 174, 195 | ✅ |
| firefox | 443, 200, 216, 191, 183 | 402, 217, 220, 186, 184 | ✅ |
| webkit | 373, 405, 376, 290, 363 | 367, 373, 286, 357, 284 | ✅ |

ค่าที่เกินในรอบทดสอบเฟส 7 (2.1–2.9 วินาที) เกิดตอนรัน 6 worker พร้อมกัน — เมื่อวัดเดี่ยวตาม NFR-08/Q-T6 ไม่เกิน จึงไม่ได้ปรับโค้ดเพื่อความเร็ว

## สิ่งที่ตัดสินใจเองนอกเอกสาร

- เพิ่มฟิลด์ API: `actions.cancelBlockedBy` (หน้าการจอง), `actions` ของหน้าร้าน (`canCheckin`, `checkinBlockedBy`, `canNoShow`, `noShowBlockedBy`), `levelLabel`, `existing` ของลิงก์หาร
- ข้อความยืนยันใหม่ `OK_SPLIT_EXISTS` "การจองนี้มีลิงก์หารค่าสนามแล้ว ใช้ลิงก์เดิม" / "This booking already has a split link. The existing link is used" (HTTP 200) · สร้างซ้ำไม่ตรวจ `count`/`names` อีก
- ลำดับตรวจยกเลิก: `INVALID_STATUS` → `CHALLENGE_MATCHED` → `CANCEL_TOO_LATE` · เลื่อน: `INVALID_STATUS` → `CHALLENGE_MATCHED` → `RESCHEDULE_LIMIT` → `RESCHEDULE_TOO_LATE`
- ~~ปุ่มยกเลิกที่ทำไม่ได้: กดแล้วเรียก API ทันที (ไม่ผ่านกล่องยืนยัน)~~ — **ผิด แก้แล้วในรอบ 2** (ดูด้านล่าง)
- ข้อความ hint เช็กอินซ้ำ "การจองนี้เช็กอินและเก็บเงินแล้ว" / "This booking is already checked in and paid" (ไม่ใช่ข้อความ API) · hint อื่นใช้ข้อความ error เดิมของ API
- เพิ่ม `challenge-create-hint` (กติกา UI เดียวกัน แม้ไม่อยู่ในรายการข้อ 12)
- testid ใหม่ในหน้าการจอง `split-link-people` (ไม่ใช้ `split-people` ซ้ำ เพื่อไม่ชนกับหน้า `/split`), `split-existing-note`
- `Booking.customerName` ของการจองประจำ = ชื่อสมาชิก · ผู้ประกาศคำท้าและเจ้าของลิงก์หารแสดงชื่อของการจองนั้น · แถวเก่าที่ไม่มีชื่อ (สร้างก่อน 7.5) ใช้ `Customer.name` แทน
- เลื่อนการจองที่คำท้ายัง `OPEN`: คิดยอดทีมรับใหม่จากราคาใหม่ (BR-28) · คำท้า `AWAITING_PAYMENT` ไม่แตะ
- label ช่องเบอร์ใน `/my`: "เบอร์โทรที่ใช้จอง" / "เบอร์โทรสมาชิก" / "เบอร์โทรที่จะสมัคร" (ยังมีคำว่า "เบอร์โทร") · ปุ่มลบวันหยุดใช้รูปแบบวันที่เดิมของเว็บ (ค.ศ. เช่น "ลบวันหยุด 13 ต.ค. 2026")
- เพิ่มสคริปต์ `selfcheck/nfr08.mjs` และ `selfcheck/screens-p75.mjs` · การรัน `screens.mjs` เดิมเพื่อตรวจ regression เขียนทับภาพหน้าหลักเดิมใน `selfcheck/screens/` ด้วย (เป็นภาพของเว็บปัจจุบัน)

## คำถามเปิดจากรอบ 1 → ตอบแล้ว (A-27, A-28)

- ปิดเพราะฝนการจองที่คำท้า `MATCHED` → A-27 (BR-14, BR-15) ทำในรอบ 2
- เลื่อนการจองระหว่างคำท้า `AWAITING_PAYMENT` → A-28 (BR-25) ทำในรอบ 2

## รอบ 2 (แก้ย้อน + A-27 + A-28)

| # | ผล | ไฟล์ที่แก้ | วิธีตรวจ |
|---|---|---|---|
| R2-1 แก้ย้อน (regression ของรอบ 1) | ทำแล้ว · รอบ 1 เปลี่ยน flow ยกเลิกเดิมโดยข้ามขั้นยืนยันเมื่อ `canCancel=false` ซึ่งขัด contract เดิม `cancel-booking` → `cancel-credit-preview` → `cancel-confirm` / `cancel-abort` · คืนให้ `cancel-booking` เปิดขั้นยืนยันเดียวกันเสมอ · กรณียกเลิกไม่ได้: `cancel-booking-hint` ยังแสดงเหตุผล, ในขั้นยืนยัน preview = ฿0 (`actions.cancelCreditNow` = 0 เมื่อยกเลิกไม่ได้) + `cancel-confirm-reason` · กด `cancel-confirm` → API → error ใน `error-message` · แก้ SPEC ที่เคยเขียนเรื่องข้ามขั้นยืนยันแล้ว | `app/booking/[code]/BookingClient.tsx` · `lib/server/bookings.ts` · `SPEC.md` | `screens-p75`: `blocked-confirm-step`, `blocked-preview-0`, `blocked-confirm-reason`, `cancel-click-error` (กรณี MATCHED) · `allowed-no-hint`, `allowed-confirm-step` (preview ฿1,200), `allowed-abort` (กรณียกเลิกได้) |
| R2-2 A-27 | ทำแล้ว · ปิดฝนการจองที่คำท้า `MATCHED`: ทีมรับได้ `CreditEntry` RAIN = ยอดที่จ่าย (เข้า Customer ของเบอร์ทีม ใช้ได้หลังสมัคร A-17) · เจ้าของได้ = จ่าย + เครดิตที่ใช้ − เครดิต CHALLENGE ที่ได้ไปแล้ว (ไม่ต่ำกว่า 0) · `affected` มี `challengeCredit` และ `credits[]` (OWNER / CHALLENGER) · lock การจอง → คำท้า เหมือนเส้นทางอื่น · คำท้าเป็น `CLOSED` | `lib/rules/booking.ts` (`rainCreditSplit`) · `lib/server/features.ts` (`closureCreate`) · `app/owner/OwnerClient.tsx` · `SPEC.md` | selfcheck `A27.*` 12 ข้อ: ตัวอย่างใน 04 (ทีม ฿600 เจ้าของ ฿600), เจ้าของได้ 0 พอดี, OPEN ได้เต็ม, AWAITING ทีมไม่ได้ + จ่ายทีหลังได้ `CHALLENGE_NOT_OPEN`, ยอดรวมเจ้าของ, ทีมใช้เครดิตก่อนสมัครไม่ได้/หลังสมัครได้ · unit test 4 กรณี |
| R2-3 A-28 | ทำแล้ว · คำท้า `AWAITING_PAYMENT` → เลื่อนไม่ได้ `CHALLENGE_PENDING` 409 · `canReschedule=false`, `rescheduleBlockedBy="CHALLENGE_PENDING"`, `reschedule-submit-hint` · หมดเวลากลับเป็น `OPEN` เลื่อนได้และคิดยอดทีมรับใหม่ | `lib/rules/booking.ts` (`checkReschedule` + `challengePending`) · `lib/i18n.ts` · `lib/server/bookings.ts` (`challengeState`) · `SPEC.md` | selfcheck `A28.*` 7 ข้อ: OPEN เลื่อนได้, AWAITING → 409 + ข้อความ TH/EN คำต่อคำ, ครบ 15 นาทีพอดียังติด, 15 นาที 1 วินาทีเลื่อนได้ยอด 400 → 600 · unit test · `screens-p75` `pending-reschedule-hint` |

**ผลตรวจรอบ 2**

| รายการ | ผล |
|---|---|
| `rules-check.mjs` `BUG_MODE=0` | 190/190 ผ่าน (รอบ 1 171 + `A27.*` 12 + `A28.*` 7) |
| `rules-check.mjs --expect-bugs` `BUG_MODE=1` | 187/190 · ล้ม 3 = `BR-11.sat-17`, `BR-13.exact-24h`, `BR-22.bib-7` เท่านั้น ("RESULT: OK") |
| `screens-p75.mjs` | 149/149 ทั้ง `BUG_MODE=0` และ `1` · ภาพใหม่ `p75-booking-pending-*` |
| `screens.mjs` (regression) | OK |
| unit test · lint · `tsc` | 26/26 · ผ่าน · ผ่าน |

**ตัดสินใจเองในรอบ 2:** testid ใหม่ `cancel-confirm-reason`, `closure-affected-{code}-credit`, `closure-affected-{code}-challenge` · `actions.cancelCreditNow` = 0 เมื่อยกเลิกไม่ได้ · คำท้า `MATCHED` เปลี่ยนเป็น `CLOSED` หลังปิดฝน (contract 1.3) · ยอดที่ทีมจ่าย = `Challenge.amount` · เครดิต CHALLENGE ที่เจ้าของได้ไปแล้ว = ผลรวม `CreditEntry` reason CHALLENGE ของการจองนั้น · `affected[].credit` ยังเป็นเครดิตเจ้าของ (รูปเดิม) เพิ่มฟิลด์ใหม่แทนการเพิ่มแถว

## เฟส 10 Portal (`/project` สำหรับอาจารย์)

ที่มา: `docs/08c-PORTAL-PROMPT.md` · อ่านจาก mount อ่านอย่างเดียว `docs/` และ `e2e/test-report/` ตอนรัน (ADR-09) ไม่ hard-code ตัวเลขหรือผลทดสอบ · ไม่แก้ `docs/` `e2e/` · หน้าอื่น / seed / ข้อความ / testid เดิมไม่เปลี่ยน

| หน้า | ผล | วิธีตรวจ |
|---|---|---|
| `/project` ภาพรวม | ทำแล้ว · ตัวเลข US/FR/BR/NFR/TC/P1–P3 · ผลรันล่าสุด (ผ่าน/ทั้งหมด/%, P1 ล้ม, ผ่านเกณฑ์, BUG_MODE) · รอบ `BUG_MODE=0` ล่าสุดจาก 10 · บั๊กที่ฝังจับได้ · เส้นทางเฟส 0–8 · บทเรียน → งานนี้ · อ่านอะไรก่อน 5 ลิงก์ · testid เดิม `project-doc-*`, `project-report-*`, `project-no-report` ยังอยู่ · `/project?doc=` เดิม redirect | `portal-check` นับตัวเลขซ้ำจากไฟล์ 14 ค่า ตรงทุกค่า |
| `/project/docs`, `/project/docs/<ไฟล์>` | ทำแล้ว · GFM (ตาราง โค้ด) · Mermaid จาก package `mermaid@12.1.0` ในเว็บ (dynamic import ไม่ใช้ CDN) · ลิงก์ md → route portal · รูป/ลิงก์ไป `docs/` `e2e/test-report/` ใช้ได้ · สารบัญ · ก่อน/ถัดไป | 21 เอกสาร × 2 ขนาด: Mermaid ทุกบล็อกเป็น SVG (02: 1, 06: 7, 07: 1) · ไม่มี console error |
| `/project/testcases` | ทำแล้ว · 60 TC + ผลราย project (chromium/firefox/webkit/serial/perf-*) · กรองโมดูล/ระดับ/ผล · GIF เปิดในหน้า (`<details>` โหลดเมื่อเปิด) + MP4 · TC ที่ข้ามแสดงเหตุผลจาก `notes.skip` | กรอง P3 = 4 · GIF โหลดได้ · มีเหตุผลข้าม |
| `/project/traceability` | ทำแล้ว · US → FR/BR → TC + FR→TC, BR→TC · แถวไม่มี TC เน้นแดง | US ไม่มี TC = 0 (ตรวจใน portal-check) |
| `/project/report`, `/project/report/<ไฟล์>` | ทำแล้ว · 10-TEST-REPORT + รายงานทุกฉบับ (10 ไฟล์) + ภาพ `bugmode1/*.png` | เปิดทุกฉบับ × 2 ขนาด |
| `/project/files/...` | ทำแล้ว · เฉพาะ `.md .png .svg .gif .mp4 .json` ใต้ `docs/` `test-report/` · กัน `..` / encoded / backslash / drive letter / absolute / symlink (realpath) / โฟลเดอร์ / นามสกุลอื่น · stream + Range 206 / 416 | 15 แบบโจมตีได้ 404 ทั้งหมด · Range 206 ถูกต้อง · 416 |
| ไม่มีผลทดสอบ | ทำแล้ว · ไม่ error แสดง "ยังไม่มีผลทดสอบ — รัน `cd e2e && npm test`" | container ชั่วคราวพอร์ต 3001 mount โฟลเดอร์ว่างแทน test-report → `/project`, `/project/testcases`, `/project/report`, `/project/traceability` ตอบ 200 และมี `project-no-report` (หยุด container แล้ว) |
| 375 px / NFR-13 | ทำแล้ว · ตารางกว้างเลื่อนในกรอบ · มี h1 ทุกหน้า · รูปมี alt · select มี label | 36 หน้า ไม่มีเลื่อนแนวนอน |
| SPEC | ทำแล้ว · ส่วน 2 และส่วน 3 `/project` ใหม่ | อ่านทวน |

**ผลตรวจ**

| รายการ | ผล |
|---|---|
| `node selfcheck/portal-check.mjs` (+ `NO_REPORT_URL`) | **600/600** ผ่าน · 36 หน้า (5 หน้าหลัก + 21 เอกสาร + 10 รายงาน) × 1280/375 · ลิงก์ภายใน 157 ลิงก์ไม่มี 404 · ภาพ `selfcheck/screens/p10-*.png` 16 ไฟล์ |
| `rules-check.mjs` `BUG_MODE=0` | 190/190 (ไม่กระทบกฎ) |
| `screens.mjs`, `screens-p75.mjs` | OK · 149/149 |
| unit test · lint · tsc | 26/26 · ผ่าน · ผ่าน |

**ตัดสินใจเอง:** markdown ใช้ `marked@18.0.14` (GFM) render ฝั่ง server · HTML ดิบใน md แสดงเป็นข้อความ (ไม่ execute) · ลิงก์ที่ชี้นอก mount (เช่น `../web/SPEC.md`, `../test-results/...`) แสดงเป็นข้อความเส้นประพร้อม title ไม่เป็นลิงก์เสีย · เส้นทางเฟส/ตารางบทเรียน/อ่านอะไรก่อน เป็นรายการคงที่ (ชื่อเฟส + ไฟล์) แสดงลิงก์เฉพาะไฟล์ที่มีจริง เพราะ `PLAN.md` ไม่ได้ mount เข้า container · "ผลรันล่าสุด" = `results.json` ตามที่เป็น (รอบล่าสุดบนดิสก์คือ `BUG_MODE=1` จึงแสดง ❌ พร้อมอธิบาย) และเพิ่มบรรทัดรอบ `BUG_MODE=0` ล่าสุดที่อ่านจากตารางใน `10-TEST-REPORT.md` · URL ไฟล์ใช้ `/project/files/{docs|test-report}/…` · portal ภาษาไทยอย่างเดียว (ไม่แปลตามปุ่ม EN)

**ข้อจำกัด:** `mermaid@12.1.0` ออกเมื่อ 2026-10-02 (เวอร์ชันเดียวกับที่ `tools/` ใช้ render แผนภาพ) · build มี warning ของ Turbopack "Dynamic filesystem access causes tracing of the whole project" (อ่านไฟล์จาก path ที่ได้จาก env ตอนรัน — ไม่กระทบการทำงาน) · แผนภาพ Mermaid ที่ 375 px ย่อตามความกว้างจึงตัวเล็ก (เปิดไฟล์ SVG ใน `docs/diagrams` ผ่าน portal ได้) · ผลรันแสดงเฉพาะรอบล่าสุดใน `results.json` (รอบ GIF `gifRuns` ไม่แสดงแยก)
