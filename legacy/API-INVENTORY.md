# API-INVENTORY — API ที่เห็นตอนใช้งานจริง (HAR) · บท 05 LAB 3

ทำเมื่อ 2026-10-20 · ระบบ http://127.0.0.1:3000 (container `football-web`) หลัง `POST /api/test/reset {}` (ตอนนี้ของระบบ = ศ 9 ต.ค. 2569 10:00)
สคริปต์บันทึก `tools/record-har.mjs` (ของเราเอง · ใช้ Playwright `@playwright/test` ใน `tools/node_modules` · headless โปรไฟล์ใหม่ทุกครั้ง)
หลักฐาน: `legacy/har/journey.stripped.har` (ตัดความลับแล้ว · 300 entries · 5.4 MB) · `legacy/har/har-steps.json` · REA อ่าน HAR → `[E ev_69ac4dd7]` (ไฟล์ผล `legacy/rea-out/har.json` ไม่ขึ้น git)
ป้าย: 🟢 runtime (เห็นตอนรัน) · 🔵 static (เห็นใน bytes) · ⚪ ยังไม่รู้ · ทุกค่าในไฟล์นี้ = **[E]** "ระบบทำอยู่" ไม่ใช่ "ร้านต้องการ"

## เส้นทางที่เดิน (12.7 วิ ทั้งก้อน)

| ขั้น | ทำอะไร | ms | URL สุดท้าย |
|---|---|---:|---|
| 01 | ลูกค้าดูตารางวันนี้ | 330 | `/book?date=2026-10-09` |
| 02 | จองสนาม B 9 ต.ค. 18:00 (ชื่อ "ลูกค้า HAR" · เบอร์ทดสอบ 089…) | 678 | `/pay/LN-100001` |
| 03 | จ่าย (QR จำลอง) | 1,014 | `/booking/LN-100001?done=paid` |
| 04 | สมาชิก "ต้น" เข้าสู่ระบบ `/my` แล้วออก | 2,025 | `/my` |
| 05 | ถามน้องบอล "พรุ่งนี้ 19:00 สนาม A ว่างไหม" | 267 | `/` |
| 06 | พนักงาน `staff` เข้าสู่ระบบ → ค้น LN-100001 → เช็กอิน → ออก | 3,134 | `/staff/login` |
| 07 | เจ้าของ `owner` เข้าสู่ระบบ → แดชบอร์ด → รายงาน 1–9 ต.ค. → ปุ่ม CSV → ออก | 3,807 | `/staff/login` |

300 entries = document 8 · `_next/static` 67 · RSC (`?_rsc=`) 218 · **API 23 ครั้ง / 19 เส้น** (`node` นับจาก HAR) · REA ได้ 300 records · API 23 (`[E ev_69ac4dd7]`)

## A. API ที่เห็นตอนรันจริง

| # | method | path | status | request keys | response keys (ชั้นบน) | ค่าตัวอย่าง [E ev_69ac4dd7] | หน้าที่เรียก |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/availability?date=` | 200 | – | `date today maxDate now weekday isHoliday holidayName fields[] slots[]` | `maxDate 2026-10-23` · slot A 08:00 `past` ฿800 · 48 slots | `/book` |
| 2 | POST | `/api/quote` | 200 | `fieldId date startHour hours rentals[] useCredit useFreeHour` | `quote{fieldPrice … payNow dueAtField hourly …}` | B ศ 18:00 → ฿1,200 · `FULL_100` · payNow ฿1,200 · due ฿0 | `/book/new` |
| 3 | GET | `/api/rentals/availability?date&startHour&hours` | 200 | – | `date startHour hours items[]` | BIB stock 6 remaining 6 ฿50 | `/book/new` |
| 4 | POST | `/api/bookings` | 201 | `… name phone consent` | `booking{…} next` | `LN-100001` `PENDING_PAYMENT` total ฿1,200 · `next /pay/LN-100001` · Set-Cookie `ln_access` | `/book/new` |
| 5 | GET | `/api/bookings/{code}` (×2) | 200 | – | `booking{… payments challenge split series} history[] now secondsLeft payTotal actions{…}` | ก่อนจ่าย `history [PENDING_PAYMENT]` `secondsLeft 900` · หลังจ่าย `[PENDING_PAYMENT, CONFIRMED]` | `/pay/…` · `/booking/…` |
| 6 | POST | `/api/bookings/{code}/pay` | 200 | `{}` | `ok code amount bookings messageCode message` | `amount 1200` · `OK_PAID` | `/pay/…` |
| 7 | POST | `/api/customers/login` | 200 | `phone password` (REDACTED) | `ok customer{id name phone}` | ต้น id 1 · Set-Cookie `ln_customer` | `/my` |
| 8 | GET | `/api/me` (×2) | 200 | – | `customer{… creditBalance paidHours freeHours… bannedUntil isBanned} creditEntries[] bookings[]` | เครดิต ฿1,200 · `paidHours 7` · `hoursToNextFree 3` | `/my` |
| 9 | POST | `/api/customers/logout` | 200 | `{}` | `ok` | Set-Cookie `ln_customer=; Max-Age=0` | `/my` |
| 10 | GET | `/api/chat` | 200 | – | `sessionId messages` | `sessionId null` (ยังไม่มีห้อง) | widget |
| 11 | POST | `/api/chat` | 200 | `text` | `sessionId reply cards[] failed` | "สนาม A ส. 10 ต.ค. 2026 19:00–20:00 ว่างครับ ค่าสนาม ฿1,200…" · card `check available:true` · Set-Cookie `ln_chat` | widget |
| 12 | POST | `/api/staff/login` (×2) | 200 | `username password` (REDACTED) | `ok staff{id name role} next` | staff → `next /staff` · owner → `next /owner` · Set-Cookie `ln_staff` | `/staff/login` |
| 13 | GET | `/api/staff/bookings/{code}` | 200 | – | `booking{… phone rentals bannedUntil} actions{canCheckin checkinBlockedBy canNoShow noShowBlockedBy}` | `CONFIRMED` · `canCheckin true` | `/staff` |
| 14 | POST | `/api/staff/bookings/{code}/checkin` | 200 | `{}` | `ok collected booking{…} actions messageCode message` | `collected 0` · `CHECKED_IN` · amountPaid ฿1,200 | `/staff` |
| 15 | POST | `/api/staff/logout` (×2) | 200 · −1 | `{}` | `ok` | Set-Cookie `ln_staff=; Max-Age=0` · ครั้งที่ 2 ถูกยกเลิกตอนเปลี่ยนหน้า (−1) | `/staff` · `/staff/login` |
| 16 | GET | `/api/owner/holidays` | −1 | – | – | ถูกยกเลิก (หน้า `/owner` โหลดแล้วสคริปต์ไป `/owner/dashboard` ทันที) | `/owner` |
| 17 | GET | `/api/owner/closures` | −1 | – | – | เหมือน #16 | `/owner` |
| 18 | GET | `/api/owner/dashboard` | 200 | – | `date from today{…} week[] weekTotal utilization[] popularHours[] bookingsByStatus lowStockCount` | วันนี้ จอง ฿1,200 + ขายเงินสด ฿40 = ฿1,240 · `weekTotal 8500` · A 2 ชม. 13% | `/owner/dashboard` |
| 19 | GET | `/api/owner/reports?from&to` | 200 | – | `from to days[] totals{bookingMoney salesCash salesPromptpay salesMoney total creditUsed bookings noShow discount rentalPrice freeHours}` | 1–9 ต.ค.: `bookingMoney 10800` (= PROMPTPAY + CASH_AT_FIELD รวมกัน) · ขาย ฿100 · total ฿10,900 · การจอง 6 · ไม่มา 2 | `/owner/reports` |

ไม่มีใน HAR ทั้งที่กดจริง: `GET /api/owner/reports.csv` (ปุ่มเป็นลิงก์ดาวน์โหลด · Playwright บันทึกไฟล์ดาวน์โหลดแต่ HAR ไม่มี entry) → ตาที่สอง: probe `curl` ด้วย cookie owner ได้ 200 `text/csv` (ดูส่วน C)

## B. เติมช่องว่างจาก SYSTEM-MAP / REA static

| เรื่อง | ก่อน (static / อ่านโค้ด) | หลัง (runtime) | หลักฐาน |
|---|---|---|---|
| endpoint ของร้านใน bundle ฝั่งเบราว์เซอร์ | REA static เจอ endpoint 9 node **ไม่มี `/api/…` สักตัว** (เป็นชื่อ macro ของ katex / mermaid · `a` `b` `c`) ⚪ เพราะทุกหน้าเรียกผ่าน `api(lang, path)` ที่ส่ง path เป็นตัวแปร (`web/lib/client.ts:8`) | 🟢 19 เส้นที่เดินผ่าน | `[E ev_e53483aa]` · `[E ev_69ac4dd7]` |
| method ของแต่ละ API | 🔵 อ่าน route.ts (SYSTEM-MAP C) | 🟢 ตรงทุกเส้นที่เดิน | HAR |
| cookie ที่ใช้ | 🔵 `ln_customer` `ln_staff` `ln_access` `ln_chat` + `lang` (`server/core.ts:127-129` · `server/chat.ts:35`) | 🟢 `ln_access` Max-Age=2592000 (30 วัน) · `ln_customer` 30 วัน · `ln_chat` 7776000 (90 วัน) · `ln_staff` 43200 (12 ชม.) · ทุกตัว `HttpOnly; SameSite=lax` · **ไม่มี `Secure`** (http ในเครื่อง) · logout = `Max-Age=0` | Set-Cookie ใน HAR (ค่าถูกแทน REDACTED) |
| logout ตัด session ไหม | 🔵 logout แค่ตั้ง cookie ว่าง (`app/api/*/logout/route.ts:5-9`) | 🟢 ส่ง cookie เดิมหลัง logout: `/api/me` 200 · `/api/staff/bookings/LN-900004` 200 (probe HTTP · HANDOVER-CHECK ส่วน 5) | = CR-01 |
| localStorage / sessionStorage | ⚪ static ไม่เจอ storage | 🟢 ไม่มี key เลย (REA scenario `local_storage_keys: -` · `session_storage_keys: -` · cookies 1) | `[E ev_ddf5a3a5]` |
| เว็บที่รันอยู่ = source ใน repo | ⚪ | 🟢 source 163 ไฟล์ใน container ตรงกับ `web/` ทุกไฟล์ (sha256) · chunk ใน HAR 67 ตัวมาจาก `/_next/static/chunks/` ของ BUILD_ID `TK4zvCp98igi-iwAU3Uzu` | HANDOVER-CHECK ส่วน 1 |
| `ตอนนี้` ที่ระบบใช้ | 🔵 `app_settings.clock` | 🟢 `/api/availability` ตอบ `now 2026-10-09T03:00:00.000Z` · แต่ cookie `Expires` ใช้เวลาจริงของเครื่อง (19 พ.ย. 2026 = วันจริง + 30 วัน) | HAR |
| เวลาตอบของ API | ⚪ | 🟢 5–50 ms ทุกเส้น (login 46–50 ms เพราะ scrypt) | `entries[].time` |

## C. API ที่มีในโค้ดแต่ไม่เห็นในรอบนี้ (41 จาก 60)

ไม่เห็นใน HAR ≠ ไม่มี / ไม่ใช้ · HAR เห็นแค่เส้นทางที่เดิน

| กลุ่ม | เส้น (route ใน SYSTEM-MAP C) | ทำไมไม่เห็น | เก็บหลักฐานเพิ่มยังไง |
|---|---|---|---|
| ลูกค้า: ยกเลิก เลื่อน หาร คำท้า จองประจำ สมัคร | #6–15, #19–20 (`cancel` `reschedule` `split` `split/{token}` `paid` `challenges` ×4 `register` `series` ×2) | ไม่ได้เดินในเส้นทางนี้ | เพิ่มขั้นใน `tools/record-har.mjs` (ต้องเลื่อนนาฬิกาสำหรับบางกรณี) · e2e เดิมเดินครบแล้ว (`e2e/tests/*.spec.ts`) |
| แชทจองจากการ์ด | #25 `POST /api/chat/book` · #24 `GET /api/chat/{sessionId}` | ถามแค่ "ว่างไหม" · #24 ไม่มีหน้าเรียก (เฉพาะ e2e helper) | ถามจองในแชทจนได้การ์ดแล้วยืนยัน |
| พนักงาน: ไม่มา คืนของ ภาพรวมวันนี้ | #31–33 | เช็กอินอย่างเดียว · `/staff/today` ต้องเป็น MANAGER | เดินด้วย manager · เลื่อนนาฬิกาเลยเวลาเริ่ม 15 นาทีสำหรับไม่มา |
| คลัง | #34–42 | ไม่ได้เปิดหน้า stock · #42 `alerts` ไม่มีหน้าเรียก | เดิน `/staff/stock` → sale → transfer · manager รับ/ชำรุด/ปรับ |
| หลังบ้านอื่น | #44–45, #48–53, #54–55 | ไม่ได้เปิด (holidays/closures ถูกยกเลิกกลางทาง) | เปิดแต่ละหน้าแล้วรอ `data-ready="true"` ก่อนไปต่อ |
| CSV | #47 `reports.csv` | เป็นการดาวน์โหลด HAR ไม่บันทึก | probe ตรง: owner cookie → 200 `text/csv; charset=utf-8` (ทำแล้วบนข้อมูล prod-like 51 บรรทัด · `PROD-LIKE-DATA.md` ส่วน 5) |
| ไม่มีหน้าเรียก (ops / ทดสอบ) | #28 `staff/me` · #56 `fields` · #57 `health` · #58 `version` · #59–60 `test/*` | ไม่มี UI เรียก · `test/reset` ถูกเรียกด้วย `fetch` นอกเบราว์เซอร์ | `curl` ตรง (ทำแล้ว: health · version · reset · GET reset 404) · grep build ไม่เจอ path เหล่านี้ใน `_next/static` (REA-INVENTORY ส่วน B) |

## D. 3 วิธีที่ใช้วันนี้

| วิธี | ใครคุมเบราว์เซอร์ | กระทบข้อมูลไหม | หลักฐานบอกอะไร | บอกอะไรไม่ได้ |
|---|---|---|---|---|
| analyze build (REA static/server) | ไม่มีเบราว์เซอร์ (อ่าน bytes ที่ copy ออกจาก container) | ไม่ | ไฟล์ chunk 123 / server 1,145 · ชื่อ query key ที่ route อ่าน (`code` `phone` `date` `from` `to` `itemId` `staffUserId` `action`) · หน้า error HTML | path ของ API ที่ส่งผ่านตัวแปร · กฎฝั่ง server · ฐานข้อมูล |
| HAR (`tools/record-har.mjs`) | สคริปต์ Playwright ของเรา | **ใช่** (reset → สร้าง LN-100001 → จ่าย → เช็กอิน) | สัญญา API จริง (status · key · ค่า) · cookie flags · เวลาตอบ | เส้นที่ไม่ได้เดิน · ไฟล์ดาวน์โหลด · คำขอที่ถูกยกเลิก (−1) |
| REA scenario (`capture-browser-scenario`) | REA (Chromium ใน container ไปที่ `http://host.docker.internal:3000`) | **ใช่** (จอง C 20:00 แล้วจ่าย) | step 11/11 · ยอดใน accessibility tree "ยอดรวม = ฿1,800 · จ่ายตอนจอง = ฿1,800 · เก็บหน้าสนาม = ฿0" · storage ว่าง · `[E ev_ddf5a3a5]` | หลังบ้าน (ไม่ได้ login) · ความถูกต้องทางธุรกิจ |

หลังทุกวิธีที่เปลี่ยนข้อมูล → `POST /api/test/reset {}` แล้ว (ระบบกลับ seed)

## E. ขอบเขตที่ได้รับอนุญาต

- **ระบบที่ส่อง:** `http://127.0.0.1:3000` / `http://host.docker.internal:3000` = container `football-web` + `football-db` บนเครื่องทีมเอง (ไม่มีระบบภายนอก)
- **ใครอนุญาต:** ร้านลูกหนัง อารีน่า มอบระบบให้ทีมดูแลรายใหม่ (บันทึกส่งมอบ 20 ต.ค. 2569 · CR-01..05) · รันบนเครื่องเราเท่านั้น · บัญชีที่ใช้เป็นบัญชีทดสอบใน seed (`web/SPEC.md` ส่วน 1)
- **ข้อมูลลับที่เจอ:** รหัสผ่าน 3 บัญชี · ค่า cookie 4 ชนิด · `sessionId` ของแชท (= ค่า cookie `ln_chat`) · token ลิงก์หาร → `tools/record-har.mjs` แทนด้วย `REDACTED` ก่อนเขียนไฟล์ (652 จุด) และตรวจซ้ำ: HAR ที่ตัดแล้วมีรหัสผ่าน = **false** ทั้ง 3 · ค่า cookie หลุด = **false** · HAR ดิบ (มีรหัสจริง = true) อยู่นอก repo ในโฟลเดอร์ชั่วคราว และ `.gitignore` กัน `*.raw.har` · `legacy/rea-out/` ไว้แล้ว
- **ทำไม HAR ห้ามส่งต่อ:** HAR ดิบมีรหัสผ่านและ cookie ที่ใช้เข้าระบบแทนคนอื่นได้จริง (CR-01 ทำให้ cookie เดิมใช้ได้ต่อแม้ logout) และมีเบอร์โทร/ชื่อลูกค้า (PDPA) · ไฟล์ที่ตัดแล้วยังมีเบอร์ทดสอบของ seed เท่านั้น

## สรุป

| ส่วน | แถว | ยืนยันด้วย runtime | ยังไม่รู้ |
|---|---:|---:|---:|
| A API ที่เห็น | 19 | 17 (2 ถูกยกเลิก −1) | 0 |
| B เติมช่องว่าง | 7 | 7 | 0 |
| C ไม่เห็นในรอบนี้ | 7 กลุ่ม (41 เส้น) | 4 เส้นยืนยันด้วย curl (health · version · test/reset · reports.csv) | 37 เส้นรอเดินเพิ่ม |
| D วิธี | 3 | – | – |
