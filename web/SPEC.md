# SPEC — เว็บ "ลูกหนัง อารีน่า" (สำหรับทีมทดสอบ)

ใช้คู่กับ `docs/04-REQUIREMENTS.md` (กฎ BR / FR / ค่าขอบ) เท่านั้น · ชื่อ entity / attribute / สถานะตรงกับ contract ใน 04 ส่วนที่ 1
เว็บ: `http://localhost:3000` · เวลาระบบ Asia/Bangkok

## 0. เริ่มระบบ

```bash
cd web
docker compose up -d --build        # สร้าง 2 container: football-db, football-web (รอจน healthy)
curl http://localhost:3000/api/health   # {"ok":true,"db":true}
```

- ข้อมูลอยู่ใน volume `football-db-data` (ปิดเปิด container ข้อมูลยังอยู่)
- web สร้างตารางและ seed เองตอนเริ่มครั้งแรก

### reset + ล็อกเวลา + BUG_MODE

**Git Bash**
```bash
curl -X POST http://localhost:3000/api/test/reset -H "content-type: application/json" -d '{"now":"2026-10-09T10:00:00+07:00"}'
curl -X POST http://localhost:3000/api/test/clock -H "content-type: application/json" -d '{"now":"2026-10-09T15:01:00+07:00"}'
BUG_MODE=1 docker compose up -d      # เปิดโหมดฝังบั๊ก (สร้าง container web ใหม่)
docker compose up -d                 # กลับเป็น BUG_MODE=0
```

**PowerShell**
```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/test/reset -ContentType "application/json" -Body '{"now":"2026-10-09T10:00:00+07:00"}'
Invoke-RestMethod -Method Post http://localhost:3000/api/test/clock -ContentType "application/json" -Body '{"now":"2026-10-09T15:01:00+07:00"}'
$env:BUG_MODE="1"; docker compose up -d
Remove-Item Env:BUG_MODE; docker compose up -d
```

- `POST /api/test/reset` body `{ "now": ISO }` → ล้างข้อมูลทั้งหมด สร้าง seed ใหม่ (วันที่คิดจาก `now`) และ **ล็อก "ตอนนี้"** ไว้ที่ `now` จนกว่าจะตั้งใหม่ · ไม่ส่ง `now` = seed ตามเวลาจริงและปลดล็อก
- `POST /api/test/clock` body `{ "now": ISO }` → เปลี่ยน "ตอนนี้" อย่างเดียว (ข้อมูลไม่เปลี่ยน) · `{ "now": null }` = กลับไปใช้เวลาจริง
- ทั้งสองตอบ `{ "ok": true, "now": "...Z", "locked": true, "bugMode": 0|1 }` · ตอบ **404** ถ้า `ALLOW_TEST_RESET` ไม่ใช่ `1`
- เวลาที่ล็อกไว้ "ค้าง" (ไม่เดิน) · กฎที่ใช้เวลาทุกข้อ (BR-04, 05, 10, 13, 16, 17, 25, 28) คิดจากค่านี้
- การจองที่สร้างหลัง reset ได้รหัส `LN-100001`, `LN-100002`, … เรียงต่อกัน
- `<html lang="th|en" data-ready="true|false" data-bug-mode="0|1">` · `data-ready="true"` เมื่อหน้าโหลดข้อมูลเสร็จ (ระหว่างกดปุ่มที่เรียก API จะเป็น `false` ชั่วคราว)

## 1. seed (หลัง reset ด้วย now = ศุกร์ 9 ต.ค. 2026 10:00)

| ประเภท | ข้อมูล |
|---|---|
| สนาม `Field` | A, B = 5 คน กลางแจ้ง `dayRate` 800 / `eveningRate` 1,200 · C = 7 คน มีหลังคา 1,200 / 1,800 |
| ของเช่า `RentalItem` | `BIB` เอี๊ยม ฿50 stock 6 · `BALL` ลูกบอล ฿30 stock 10 |
| วันหยุด `Holiday` | 2026-10-13, 2026-10-23, 2026-12-05, 2026-12-10, 2026-12-31 |
| ผู้ใช้ร้าน `StaffUser` | `owner` / `Owner1234` (OWNER, คุณเอก) · `manager` / `Manager1234` (MANAGER, คุณฝ้าย) · `staff` / `Staff1234` (STAFF, น้องบอล) |
| ลูกค้า `Customer` | ต้น `0811111111` / `Ton12345` สมาชิก `creditBalance` 1,200 (มีรายการเครดิต RAIN +1,200) `paidHours` 7 · มิว `0822222222` / `Mew12345` สมาชิก `paidHours` 10 · โจ้ `0833333333` / `Joe12345` สมาชิก มี NO_SHOW 1 ครั้ง (LN-900003) · แนน `0844444444` ไม่สมัคร (ไม่มีรหัสผ่าน) |
| การจอง | ดูตารางล่าง (วันที่นับจาก `now` ตอน reset · ราคาคิดด้วย `lib/rules`) |

| code | ลูกค้า | สนาม | วัน/เวลา | สถานะ | ราคา (กรณี now = 9 ต.ค.) |
|---|---|---|---|---|---|
| `LN-900001` | ต้น | A | วันนี้ 19:00–21:00 | CONFIRMED จ่ายตามกฎแล้ว | ศุกร์ ≥17:00 → FULL_100 · 2,400 จ่าย 2,400 ค้าง 0 |
| `LN-900002` | โจ้ | C | พรุ่งนี้ 18:00–19:00 | CONFIRMED | เสาร์ → FULL_100 · 1,800 จ่าย 1,800 |
| `LN-900003` | โจ้ | B | 5 วันก่อน 19:00–20:00 | NO_SHOW (บันทึกเวลาเริ่ม + 15 นาที) | อาทิตย์ → 1,200 มัดจำ 600 |
| `LN-900004` | แนน | B | มะรืนนี้ 09:00–10:00 | CONFIRMED จ่ายมัดจำแล้ว | อาทิตย์ → 1,200 จ่าย 600 ค้าง 600 |

## 2. หน้าเว็บ

| path | ผู้ใช้ | FR | หมายเหตุ |
|---|---|---|---|
| `/` | ทุกคน | FR-01, FR-30 | ปุ่ม `cta-today` → `/book` (ตารางวันนี้ 1 แตะ) |
| `/book` | ลูกค้า | FR-01, FR-28 | `?date=YYYY-MM-DD` เลือกวันได้ · ค่าเริ่มต้นวันนี้ |
| `/book/new` | ลูกค้า | FR-02–FR-05, FR-12, FR-17, FR-18 | `?field=A&date=2026-10-14&start=19` (มาจากการแตะช่องว่างใน `/book`) |
| `/pay/[code]` | ลูกค้า | FR-06, FR-07 | QR จำลอง + นับถอยหลัง 15 นาที + ปุ่มยืนยัน |
| `/booking/[code]` | ลูกค้า | FR-08–FR-11, FR-19, FR-20 | `?done=paid` แสดงข้อความจ่ายสำเร็จ |
| `/my` | ลูกค้า/สมาชิก | FR-09, FR-12, FR-13, FR-14, FR-18 | ยังไม่เข้าสู่ระบบ: ค้นรหัส+เบอร์ / เข้าสู่ระบบ / สมัคร |
| `/series` | สมาชิก | FR-15, FR-16 | ไม่ใช่สมาชิก → แสดง `series-login-required` |
| `/split/[token]` | ลูกทีม (มีลิงก์) | FR-19 | |
| `/challenges` | ทุกคน | FR-20, FR-21 | |
| `/fields` | ทุกคน | FR-30 | |
| `/staff/login` | ร้าน | FR-31 | `?next=/staff` |
| `/staff` | STAFF, MANAGER, OWNER | FR-23–FR-25 | `?code=LN-…` ค้นทันที |
| `/staff/today` | MANAGER, OWNER | FR-22 | STAFF → `forbidden-message` |
| `/owner` | OWNER | FR-26, FR-27 | STAFF/MANAGER → `forbidden-message` |
| `/project` | ทุกคน (อาจารย์) | – | **Portal เฟส 10**: ภาพรวม + ตัวเลขนับจากไฟล์ + เส้นทางเฟส + บทเรียน → งานนี้ · เมนูย่อย `/project/docs`, `/project/docs/<ไฟล์>.md`, `/project/testcases`, `/project/traceability`, `/project/report`, `/project/report/<ไฟล์>.md` · อ่าน `docs/` และ `e2e/test-report/` จาก mount อ่านอย่างเดียวตอนรัน (ADR-09) · `/project?doc=<ไฟล์>.md` (ลิงก์เดิม) → redirect ไป `/project/docs/<ไฟล์>.md` |

- หน้าร้านโดยไม่เข้าสู่ระบบ → redirect ไป `/staff/login?next=<path>` (NFR-05)
- ทุกหน้ามีปุ่มภาษา `lang-th` / `lang-en` (cookie `lang` = `th`|`en`, จำข้ามหน้า) · โหมด EN เงินแสดงเป็น `THB 1,200` (โหมด TH `฿1,200`) เพราะ `฿` เป็นอักษรในช่วง Unicode ภาษาไทย
- **ทุก element ที่แสดงจำนวนเงินมี `data-value="<ตัวเลขล้วน>"`** เช่น `<span data-testid="price-total" data-value="2400">฿2,400</span>`
- ข้อความ error ทุกหน้าแสดงใน `error-message` (มีได้ครั้งละ 1 กล่อง) · ข้อความสำเร็จใน `success-message`
- **ปุ่มที่ทำไม่ได้ในตอนนั้น (เฟส 7.5)**: ยังแสดงและกดได้ แต่มีเหตุผลใต้ปุ่มก่อนกดที่ `<testid ของปุ่ม>-hint` (ผูก `aria-describedby`) · กดแล้วได้ error เดียวกับ API ใน `error-message` (ปุ่มยกเลิกต้องผ่านขั้นยืนยันเดิมก่อน ดู `/booking/[code]`) · ยกเว้นช่องติ๊ก `use-free-hour` ที่ถูก disabled พร้อมเหตุผล `use-free-hour-reason`

## 3. data-testid ทุกตัว

### ส่วนกลาง (ทุกหน้า)
| testid | ความหมาย |
|---|---|
| `brand-home` | โลโก้+ชื่อร้าน ลิงก์หน้าแรก · `logo` = SVG โลโก้ |
| `lang-th`, `lang-en` | ปุ่มสลับภาษา (`aria-pressed="true"` = ภาษาปัจจุบัน) |
| `nav-home`, `nav-book`, `nav-fields`, `nav-challenges`, `nav-series`, `nav-my`, `nav-staff-login` | เมนู (ฝั่งร้านที่เข้าสู่ระบบแล้ว: `nav-staff`, `nav-staff-today` (MANAGER/OWNER), `nav-owner` (OWNER) แทน `nav-staff-login`) |
| `nav-project` | ลิงก์ `/project` ท้ายหน้า |
| `error-message` | ข้อความ error (role=alert) |
| `success-message` | ข้อความยืนยันสำเร็จ |
| `forbidden-message`, `forbidden-switch-user` | บทบาทไม่มีสิทธิ์เข้าหน้าร้านนี้ |
| `not-found` | หน้า 404 |

### `/` หน้าแรก
| testid | ความหมาย |
|---|---|
| `home-title` | หัวข้อ hero (h1, `aria-label` = "เตะใต้แสงไฟสนาม จองง่ายในไม่กี่แตะ" / "Kick off under the floodlights") |
| `cta-today` | ปุ่ม "ดูสนามว่างวันนี้" → `/book` |
| `cta-my` | ปุ่ม "ดูการจองของฉัน" → `/my` |
| `home-field-A` / `-B` / `-C` | การ์ดสนาม (มี `field-art-A` … ภาพ SVG มี `aria-label`) |
| `link-fields` | ลิงก์ `/fields` |

### `/book` ตารางว่าง
| testid | ความหมาย |
|---|---|
| `availability-date` | วันที่ที่แสดงอยู่ |
| `holiday-badge` | ป้ายวันหยุด (มีเมื่อวันนั้นอยู่ใน `Holiday`) |
| `date-chip-YYYY-MM-DD` | ปุ่มวัน วันนี้ ถึง วันนี้+14 (`aria-pressed="true"` = วันที่เลือก) |
| `book-date-input` | ช่องเลือกวันที่ |
| `filter-before-17` | checkbox แสดงเฉพาะรอบเริ่มก่อน 17:00 (FR-28) |
| `sort-by` | select `time` (ตาราง) / `price` (รายการเรียงราคาถูก→แพง แล้วเวลา แล้วสนาม) |
| `slot-grid` / `slot-list` | ตาราง (sort=time) / รายการ (sort=price) |
| `grid-head-A` … | หัวคอลัมน์สนาม |
| `slot-{สนาม}-{ชั่วโมง}` เช่น `slot-A-19` | ช่องรอบ 1 ชั่วโมง · `data-status` = `free` / `booked` / `closed` (ปิดเพราะฝน) / `past` (ผ่านไปแล้วหรือเหลือ < 1 ชั่วโมง) / `out-of-range` (เกิน 14 วัน) · `data-price` = ราคาชั่วโมงนั้น · ช่อง `free` เป็นลิงก์ไป `/book/new?field=&date=&start=` |
| `slot-A-19-price` | ราคาในช่อง (`data-value`) |

มีรอบ 08:00–23:00 (16 รอบ/สนาม) ไม่มี 07:00 / 08:30

### `/book/new` ฟอร์มจอง
| testid | ความหมาย |
|---|---|
| `book-field` | select สนาม `A`/`B`/`C` (กว้างเต็มแถว ข้อความไม่ถูกตัดที่ 375 px) |
| `book-date` | วันที่ (`YYYY-MM-DD`) |
| `book-start` | select เวลาเริ่ม ค่า `8`…`23` (แสดง 08:00…23:00) |
| `book-hours` | จำนวนชั่วโมง (ตัวเลข พิมพ์ได้อิสระ ตรวจที่ server) |
| `rental-BIB-qty`, `rental-BALL-qty` | จำนวนของเช่า |
| `rental-BIB-remaining`, `rental-BALL-remaining` | คงเหลือของช่วงเวลานั้น (BR-22) |
| `use-credit` | ใช้เครดิต (เฉพาะสมาชิกที่เข้าสู่ระบบ) — ใช้ได้สูงสุด min(เครดิตคงเหลือ, ยอดรวม) |
| `member-credit-balance` | เครดิตคงเหลือของสมาชิก |
| `use-free-hour` | ใช้ชั่วโมงฟรี 1 ชั่วโมง (เฉพาะสมาชิก) · `member-free-hours` = สิทธิ์คงเหลือ (`data-value`) · **disabled** เมื่อรอบที่เลือกใช้สิทธิ์ไม่ได้ (BR-24) หรือไม่มีสิทธิ์เหลือ |
| `use-free-hour-reason` | เหตุผลที่ช่องชั่วโมงฟรีปิด = ข้อความ `FREE_HOUR_NOT_ELIGIBLE` หรือ `FREE_HOUR_NONE` (`data-value` = รหัส) · ไม่มี element นี้เมื่อใช้ได้ |
| `customer-name`, `customer-phone` | ชื่อ / เบอร์ 10 หลักขึ้นต้น 0 (สมาชิกที่เข้าสู่ระบบจะเติมให้) · ชื่อที่กรอกเก็บเป็น `Booking.customerName` ของการจองนี้ (BR-26) |
| `pdpa-consent` | ช่องยินยอม PDPA (ไม่ติ๊กไว้ก่อน) |
| `field-error-name`, `field-error-phone`, `field-error-consent` | หลังกด `book-submit` แสดง error ใต้**ทุกช่องที่ผิดพร้อมกัน** (ข้อความเดียวกับ `NAME_REQUIRED` / `INVALID_PHONE` / `CONSENT_REQUIRED`, ช่องมี `aria-invalid="true"`) · หายเมื่อแก้ช่องนั้นถูก · `error-message` ยังแสดง error แรกตามลำดับเดิม |
| `price-panel` | กล่องสรุปราคา (คิดโดย server ผ่าน `/api/quote` ทุกครั้งที่เปลี่ยนค่า) |
| `price-hour-{ชั่วโมง}` | ราคารายชั่วโมง (BR-09) |
| `price-field` | ค่าสนาม |
| `price-discount` | ส่วนลด |
| `price-free-hour` | มูลค่าชั่วโมงฟรีที่หัก |
| `price-rental` | ค่าของเช่า |
| `price-total` | ยอดรวม |
| `price-credit` | เครดิตที่ใช้ |
| `price-net` | ยอดสุทธิ |
| `price-plan` | แผนจ่าย `data-value` = `DEPOSIT_50` / `FULL_100` |
| `price-pay-now` | จ่ายตอนนี้ |
| `price-due-at-field` | เก็บหน้าสนาม |
| `book-submit` | ยืนยันการจอง → ไป `/pay/{code}` (ถ้ายอดสุทธิ ฿0 → `/booking/{code}?done=free`) · กดได้เสมอ |
| `book-submit-hint` | เมื่อการคิดราคา (`/api/quote`) ตอบ error แล้ว (เช่น ช่วงถูกจอง ผิดกฎเวลา) แสดงข้อความ error นั้นใต้ปุ่ม · ไม่มี element นี้เมื่อราคาคิดได้ |
| `back-to-availability` | กลับไปตาราง |

### `/pay/[code]`
| testid | ความหมาย |
|---|---|
| `booking-code` | รหัสการจอง |
| `pay-qr` | QR พร้อมเพย์ตัวอย่าง (SVG) |
| `pay-now-amount` | ยอดที่ต้องจ่ายตอนนี้ (จองประจำ = รวมทุกสัปดาห์) |
| `pay-countdown` | เวลาที่เหลือ `mm:ss` (`data-value` = วินาที, นับจาก "ตอนนี้" ของ server แล้วเดินในเบราว์เซอร์) |
| `pay-confirm` | ปุ่มยืนยันการจ่าย → `/booking/{code}?done=paid` |
| `pay-expired` | แสดงเมื่อการจองเป็น `EXPIRED` · `pay-rebook` ลิงก์เลือกรอบใหม่ |
| `pay-already` / `pay-view-booking` | การจองนี้ไม่ต้องจ่ายแล้ว |
| `pay-field`, `pay-date`, `pay-time`, `pay-due-at-field`, `pay-series-count` | รายละเอียด |

### `/booking/[code]`
การเข้าถึง: เบราว์เซอร์ที่สร้างการจอง / เคยใส่เบอร์ถูก / สมาชิกเจ้าของที่เข้าสู่ระบบ · นอกนั้นแสดงฟอร์ม `gate-phone` + `gate-submit`

| testid | ความหมาย |
|---|---|
| `booking-code`, `booking-status` (`data-value` = สถานะ contract), `booking-field`, `booking-date`, `booking-time`, `booking-customer` | รายละเอียด |
| `go-pay` | ไปหน้าจ่าย (เฉพาะ `PENDING_PAYMENT`) |
| `price-field`, `price-discount`, `price-free-hour`, `price-rental`, `price-total`, `price-credit`, `price-plan`, `price-pay-now` | สรุปราคา |
| `amount-paid` | จ่ายแล้วรวม |
| `due-at-field` | ยอดเก็บหน้าสนาม |
| `booking-rental-BIB` / `-BALL` | ของเช่า (`data-value` = จำนวน) |
| `booking-customer` | ชื่อผู้จองที่กรอกตอนจอง**การจองนี้** (`Booking.customerName`, BR-26) |
| `cancel-booking` → `cancel-credit-preview` → `cancel-confirm` / `cancel-abort` | ยกเลิก (แสดงเมื่อ `CONFIRMED`/`PENDING_PAYMENT`) · preview = เครดิตที่จะได้ถ้ายกเลิกตอนนี้ · `cancel-booking` **เปิดขั้นยืนยันเดียวกันเสมอ** ทั้งกรณียกเลิกได้และไม่ได้ · กรณียกเลิกไม่ได้ (`actions.canCancel=false`) preview = ฿0 และมี `cancel-confirm-reason` · กด `cancel-confirm` แล้วเรียก API ได้ error ใน `error-message` |
| `cancel-confirm-reason` | ในขั้นยืนยัน เมื่อยกเลิกไม่ได้: เหตุผล (`data-value` = `actions.cancelBlockedBy`) ข้อความเดียวกับ error ของ API |
| `cancel-booking-hint` | เหตุผลที่ยกเลิกไม่ได้ (`data-value` = `actions.cancelBlockedBy`: `CHALLENGE_MATCHED` / `CANCEL_TOO_LATE`) ข้อความเดียวกับ error ของ API |
| `reschedule-date`, `reschedule-start`, `reschedule-submit` | เลื่อนวัน/เวลา (แสดงเมื่อ `CONFIRMED`, จำนวนชั่วโมงเท่าเดิม) |
| `reschedule-submit-hint` | เหตุผลที่เลื่อนไม่ได้ (`data-value` = `actions.rescheduleBlockedBy`: `CHALLENGE_MATCHED` / `CHALLENGE_PENDING` / `RESCHEDULE_LIMIT` / `RESCHEDULE_TOO_LATE`) |
| `split-names` (บรรทัดละคน) / `split-count`, `split-create` | สร้างลิงก์หาร (แสดงเมื่อ `CONFIRMED`/`CHECKED_IN`) |
| `split-link`, `split-link-people` (`data-value` = จำนวนคน), `split-per-person`, `split-share-{n}` (`data-paid`), `split-existing-note` | ลิงก์หารที่สร้างแล้ว — 1 การจองมี 1 ลิงก์ (BR-27) เมื่อมีแล้วไม่แสดงฟอร์มสร้างอีก |
| `challenge-team`, `challenge-level` (`BEGINNER` = มือใหม่ / `INTERMEDIATE` = กลาง / `ADVANCED` = เก่ง · EN Beginner / Intermediate / Advanced), `challenge-create` | ประกาศหาคู่แข่ง |
| `challenge-create-hint` | เมื่อประกาศไม่ได้ (`actions.canChallenge=false`) แสดงข้อความ `CHALLENGE_NOT_ALLOWED` |
| `challenge-info`, `challenge-status` (`data-value`), `challenge-amount` | ประกาศที่มีอยู่ |
| `booking-series` | รายการการจองในชุดจองประจำ |

### `/my`
| testid | ความหมาย |
|---|---|
| `lookup-code`, `lookup-phone`, `lookup-submit` | ค้นด้วยรหัสการจอง + เบอร์ → `/booking/{code}` · label ช่องเบอร์ "เบอร์โทรที่ใช้จอง" / "Phone used for the booking" |
| `login-phone`, `login-password`, `login-submit` | เข้าสู่ระบบสมาชิก · label ช่องเบอร์ "เบอร์โทรสมาชิก" / "Member phone" |
| `register-name`, `register-phone`, `register-password`, `register-consent`, `register-submit` | สมัคร (ตั้งรหัสผ่านให้เบอร์ ≥ 8 ตัว ต้องติ๊กยินยอม) · label ช่องเบอร์ "เบอร์โทรที่จะสมัคร" / "Phone to register" · 3 ฟอร์มมีชื่อ (`aria-labelledby` หัวข้อของฟอร์ม) |
| `my-name` | ชื่อสมาชิก · `logout` ออกจากระบบ |
| `credit-balance` | เครดิตคงเหลือ |
| `paid-hours` | ชั่วโมงสะสม (`data-value`) |
| `free-hours-available` | สิทธิ์ชั่วโมงฟรีคงเหลือ |
| `free-hours-next` | "อีก N ชั่วโมง ได้ฟรี 1 ชั่วโมง" (`data-value` = N) |
| `banned-notice`, `banned-until` | แจ้งถูกระงับ + วันเวลาที่จองได้อีกครั้ง (`data-value` = ISO) |
| `my-booking-{code}` | การจองของฉัน |
| `credit-history`, `credit-entry-{id}` | ประวัติเครดิต (`data-reason` = CANCEL/RAIN/CHALLENGE/RESCHEDULE/USED, `data-value` = +/− จำนวน) |
| `my-go-series` | ไปหน้าจองประจำ |

### `/series`
| testid | ความหมาย |
|---|---|
| `series-login-required`, `series-go-login` | ยังไม่ได้เข้าสู่ระบบสมาชิก |
| `series-field`, `series-start-date` (สัปดาห์แรก, วันในสัปดาห์ = วันของวันที่นี้), `series-start`, `series-hours`, `series-weeks` | ฟอร์ม |
| `series-preview` | ตรวจสัปดาห์+ราคา |
| `series-weeks-list`, `series-week-{n}` | สัปดาห์ที่ n (`data-status` = `free`/`conflict`, `data-date`) |
| `series-conflicts` | วันที่ที่ชน (`data-value` = วันที่คั่นด้วย `,`) |
| `series-weeks-booked` | จำนวนสัปดาห์ที่จองได้จริง (`data-value`) |
| `series-field-price`, `series-discount-percent` (`data-value` 0/10), `series-discount`, `series-total-price`, `series-pay-now`, `series-due-at-field` | ราคา |
| `series-consent`, `series-submit` | ยินยอม + ยืนยัน (ถ้ามีสัปดาห์ชน ปุ่มจะเป็น "จองเฉพาะสัปดาห์ที่ว่าง") → `/pay/{รหัสสัปดาห์แรก}` จ่ายรวมทุกสัปดาห์ |

### `/split/[token]`
`split-net`, `split-people` (`data-value` = จำนวนคน), `split-per-person`, `split-paid-count` (`data-value` = จำนวนที่จ่ายแล้ว), `split-share-{n}` (`data-paid`), `split-toggle-{n}` (สลับ จ่ายแล้ว/ยังไม่จ่าย)

### `/challenges`
| testid | ความหมาย |
|---|---|
| `challenge-filter-level` | กรองระดับ (`""` = ทุกระดับ · ตัวเลือก มือใหม่ / กลาง / เก่ง) |
| `challenge-{id}` | การ์ดประกาศ (`data-level`, `data-status`) · `challenge-team-{id}`, `challenge-amount-{id}` (ทีมรับต้องจ่าย) · "ผู้ประกาศ" = ชื่อผู้จองของการจองนั้น |
| `challenge-empty` | ไม่มีประกาศ |
| `challenge-accept-{id}` | เปิดฟอร์มรับคำท้า (เฉพาะ `OPEN`) |
| `accept-name`, `accept-phone`, `accept-consent`, `accept-submit` | ฟอร์มรับคำท้า |
| `challenge-pay-panel`, `challenge-pay-amount`, `challenge-pay-countdown`, `challenge-pay-confirm` | จ่ายจำลองหลังรับคำท้า |

หน้านี้ไม่แสดงเบอร์โทรใด ๆ (NFR-04)

### `/fields`
`field-card-{A|B|C}`, `field-art-{id}`, `field-size-{id}` (`data-value` 5/7), `field-covered-{id}` (`data-value` covered/outdoor), `field-day-rate-{id}`, `field-evening-rate-{id}`, `field-book-{id}`

### `/staff/login`
`staff-username`, `staff-password`, `staff-login-submit` · `login-required` (มาจากการถูก redirect) · `staff-current` + `staff-logout` (เข้าสู่ระบบอยู่แล้ว) · หลังเข้าสู่ระบบไป `next` หรือหน้าหลักของบทบาท (OWNER → `/owner`, MANAGER → `/staff/today`, STAFF → `/staff`)

### `/staff`
| testid | ความหมาย |
|---|---|
| `staff-whoami`, `staff-logout` | ผู้ใช้ปัจจุบัน |
| `staff-search-code`, `staff-search-submit` | ค้นรหัสการจอง |
| `staff-booking-code`, `staff-booking-status` (`data-value`), `staff-customer-name` | ผลค้นหา · `staff-customer-name` = ชื่อที่กรอกตอนจองการจองนี้ |
| `staff-due-at-field`, `staff-amount-paid` | ยอดเก็บหน้าสนาม / จ่ายแล้ว |
| `staff-checkin` | "เก็บเงินแล้ว / เช็กอิน" (กดได้เสมอ) |
| `staff-checkin-hint` | เมื่อเช็กอินไม่ได้ (`data-value` = `INVALID_STATUS`): สถานะ `CHECKED_IN` → "การจองนี้เช็กอินและเก็บเงินแล้ว" / "This booking is already checked in and paid" · สถานะอื่น → ข้อความ `INVALID_STATUS` |
| `staff-no-show` | "ไม่มา" (กดได้เสมอ) |
| `staff-no-show-hint` | เมื่อบันทึกไม่มาไม่ได้ (`data-value` = `NO_SHOW_TOO_EARLY` ก่อนเลยเวลาเริ่ม 15 นาที / `INVALID_STATUS`) ข้อความเดียวกับ API |
| `staff-return-BIB`, `staff-return-BALL` (จำนวนที่คืนแล้วทั้งหมด), `staff-return-submit`, `staff-returned-{item}` | คืนของเช่า · `staff-no-rentals` ไม่มีของเช่า |

### `/staff/today`
ชื่อในช่องการจอง = ชื่อที่กรอกตอนจองการจองนั้น · `today-date`, `today-total-bookings`, `today-total-paid`, `today-total-due`, `today-grid`, `today-slot-{สนาม}-{ชั่วโมง}` (`data-status` = สถานะการจอง / `FREE` / `CLOSED`), `today-rentals-{ชั่วโมง}`, `today-rental-{BIB|BALL}-{ชั่วโมง}` (คงเหลือ BR-22, `data-value`)

### `/owner`
| testid | ความหมาย |
|---|---|
| `holiday-list`, `holiday-{YYYY-MM-DD}`, `holiday-delete-{YYYY-MM-DD}` | รายการ/ลบวันหยุด · ปุ่มลบมีชื่อแยกกัน `aria-label` = "ลบวันหยุด 13 ต.ค. 2026" / "Delete holiday 13 Oct 2026" |
| `holiday-date`, `holiday-name`, `holiday-add` | เพิ่มวันหยุด |
| `closure-field` (มีเฉพาะ `A`, `B`), `closure-date`, `closure-from` (8–23), `closure-to` (9–24, ไม่รวมชั่วโมงสุดท้าย), `closure-submit` | ปิดสนามเพราะฝน |
| `closure-result` (`data-count` = จำนวนการจอง), `closure-affected-{code}` | การจองที่ถูกปิด+เครดิตคืน · `closure-affected-{code}-credit` = เครดิตเจ้าของ · `closure-affected-{code}-challenge` = เครดิตทีมรับคำท้า (มีเฉพาะคำท้า `MATCHED`, A-27) |
| `closure-{id}` | ประวัติการปิด |

### `/project` (Portal เฟส 10 — ภาษาไทย)
ทุกหน้า `/project/*` มีเมนูย่อย `project-nav` (`project-nav-overview`, `project-nav-docs`, `project-nav-testcases`, `project-nav-traceability`, `project-nav-report`, `aria-current="page"` = หน้าปัจจุบัน) · `nav-project` ท้ายหน้าเดิมยังอยู่ · `<html data-ready="true">` เมื่อโหลดเสร็จ (หน้าเอกสาร: หลัง Mermaid กลายเป็น SVG ครบ)

| หน้า | testid | ความหมาย |
|---|---|---|
| `/project` | `project-summary` | ร้าน/โจทย์ 2–3 บรรทัด |
| | `project-count-us`, `-fr`, `-br`, `-nfr`, `-tc`, `-p1`, `-p2`, `-p3` (`data-value`) | นับจาก `03` (หัวข้อ `### US-xx`), `04` (รหัสคอลัมน์แรกของตาราง), `09` ส่วนที่ 5 (แถว TC + คอลัมน์ระดับ) |
| | `project-run-passed`, `project-run-total`, `project-run-percent`, `project-run-p1-failed`, `project-run-criteria` (`pass`/`fail`), `project-run-bugmode`, `project-run-at` | ผลรันล่าสุดจาก `results.json` (ทุก project ยกเว้น `setup` · ข้ามไม่นับในตัวหาร · เกณฑ์ = P1 ผ่านหมด และ ≥ 95% ตาม 09 ส่วนที่ 7) + `run-info.json` |
| | `project-normal-run` | รอบ `BUG_MODE=0` ล่าสุดในตารางภาพรวมของ `10-TEST-REPORT.md` |
| | `project-bugs-caught`, `project-bugs-planted` | "จับได้ N/M" ใน `10-TEST-REPORT.md` |
| | `project-read-first`, `project-phases`, `project-phase-{0…8, 7.5}`, `project-lessons` | อ่านอะไรก่อน 5 ลิงก์ · เส้นทางเฟส 0–8 (ลิงก์เฉพาะไฟล์ที่มีจริง) · ตารางบทเรียน → งานนี้ |
| | `project-doc-{ไฟล์}`, `project-report-{ไฟล์}`, `project-no-report` | รายการเอกสาร / รายงาน (เดิม) · ไม่มีผลทดสอบ → "ยังไม่มีผลทดสอบ — รัน `cd e2e && npm test`" |
| `/project/docs` | `project-doc-{ไฟล์}` (รวม `project-doc-trace/…`) | เอกสารเรียงตามเลขไฟล์ แยกเอกสารหลัก / `trace/` |
| `/project/docs/<ไฟล์>.md` | `project-doc-title` (path), `project-doc-content`, `project-doc-toc`, `project-mermaid` | markdown แบบ GFM · HTML ดิบในไฟล์แสดงเป็นข้อความ · Mermaid render ในเบราว์เซอร์ด้วย package `mermaid` ในเว็บ (ไม่ใช้ CDN) · ลิงก์ `.md` → route ของ portal · ลิงก์/รูปไป `docs/` หรือ `e2e/test-report/` → `/project/files/...` · ลิงก์นอก mount แสดงเป็นข้อความ (เส้นประ) |
| `/project/testcases` | `project-tc-filter-module`, `project-tc-filter-priority`, `project-tc-filter-result` (`passed`/`failed`/`skipped`/`none`), `project-tc-shown` (`data-value`), `project-tc-table`, `project-tc-{TC}` (`data-result`, `data-priority`, `data-module`, `id` = รหัส TC), `project-tc-{TC}-{project}` (`data-status`), `project-tc-gif-{TC}` (เปิด GIF ในหน้า), `project-tc-mp4-{TC}`, `project-tc-skip-{TC}` (เหตุผลที่ข้าม), `project-tc-bugmode` | TC ทั้งหมดจาก `09` + ผลล่าสุดรายเบราว์เซอร์/project จาก `results.json` |
| `/project/traceability` | `project-trace-missing`, `project-trace-fr-missing`, `project-trace-br-missing` (`data-value` ต้องเป็น 0), `project-trace-table`, `project-trace-{US}` (`data-tc-count`) | US → FR/BR (04 ส่วนที่ 5) → TC (09 ส่วนที่ 6.1/6.2) · แถวที่ไม่มี TC เน้นสีแดง |
| `/project/report` | `project-doc-content` (10-TEST-REPORT), `project-report-{ไฟล์}`, `project-bugmode-shots` | รายงานรวม + รายงานทุกฉบับ `e2e/test-report/*.md` (`/project/report/<ไฟล์>.md`) + ภาพ `bugmode1/*.png` |

**ไฟล์จาก mount**: `GET /project/files/{docs|test-report}/<path>` (และ `HEAD`) · อนุญาตเฉพาะ `.md .png .svg .gif .mp4 .json` ภายใต้ราก `docs/` และ `test-report/` · segment ว่าง / `.` / `..` / มี `/` `\` `:` หลัง decode / ไฟล์ที่ realpath (ตาม symlink) ออกนอก mount / โฟลเดอร์ → 404 · ส่งแบบ stream รองรับ `Range` (206, `content-range`) · range ผิด → 416

## 4. ข้อความ error / ยืนยัน (คำต่อคำ)

API ตอบ error รูปแบบเดียว `{ "error": { "code": "...", "message": "...", "params"?: {...} } }` · ภาษาตาม cookie `lang` (ไม่มี = ไทย) · ค่าใน `{...}` ถูกแทนตอนแสดง: `{amount}` = เงิน (`฿600` / `THB 600`), `{date}` = วันเวลา (`8 พ.ย. 2026 12:15` / `8 Nov 2026 12:15`), `{item}` = เอี๊ยม/ลูกบอล (Bib/Ball), `{dates}` = วันที่ `YYYY-MM-DD` คั่นด้วย `, `
ข้อความเดียวกันนี้แสดงในหน้าเว็บที่ `error-message` / `success-message`

| code | HTTP | ไทย | English |
|---|---|---|---|
| `INVALID_INPUT` | 400 | ข้อมูลไม่ถูกต้อง | Invalid input |
| `INVALID_FIELD` | 400 | ไม่พบสนามที่เลือก | Field not found |
| `INVALID_DATE` | 400 | วันที่ไม่ถูกต้อง | Invalid date |
| `INVALID_START_HOUR` | 400 | เวลาเริ่มต้องตรงชั่วโมง ระหว่าง 08:00 ถึง 23:00 | Start time must be on the hour between 08:00 and 23:00 |
| `INVALID_HOURS` | 400 | จำนวนชั่วโมงต้องเป็นจำนวนเต็มอย่างน้อย 1 ชั่วโมง | Duration must be a whole number of at least 1 hour |
| `ENDS_AFTER_MIDNIGHT` | 400 | การจองต้องจบไม่เกิน 24:00 | Bookings must end by 24:00 |
| `PAST_DATE` | 400 | ไม่สามารถจองวันที่ผ่านมาแล้ว | You cannot book a date in the past |
| `TOO_FAR_AHEAD` | 400 | จองล่วงหน้าได้ไม่เกิน 14 วัน | You can book at most 14 days ahead |
| `TOO_SOON` | 400 | ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง | Bookings must start at least 1 hour from now |
| `SLOT_TAKEN` | 409 | ช่วงเวลานี้ถูกจองแล้ว | This time slot is already booked |
| `FIELD_CLOSED` | 409 | สนามปิดในช่วงเวลานี้ | The field is closed during this time |
| `CUSTOMER_BANNED` | 403 | เบอร์นี้ถูกระงับการจองออนไลน์ จองได้อีกครั้ง {date} | Online booking is suspended for this phone number. You can book again on {date} |
| `NAME_REQUIRED` | 400 | กรุณากรอกชื่อ | Please enter your name |
| `INVALID_PHONE` | 400 | เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0 | Phone number must be 10 digits starting with 0 |
| `CONSENT_REQUIRED` | 400 | กรุณายินยอมให้เก็บข้อมูลส่วนบุคคล (PDPA) ก่อนดำเนินการ | Please give PDPA consent before continuing |
| `INVALID_QTY` | 400 | จำนวนของเช่าไม่ถูกต้อง | Invalid rental quantity |
| `RENTAL_OUT_OF_STOCK` | 409 | ของเช่าไม่พอ ({item} เหลือ {remaining}) | Not enough rental items ({item}: {remaining} left) |
| `INVALID_CREDIT` | 400 | จำนวนเครดิตไม่ถูกต้อง | Invalid credit amount |
| `CREDIT_EXCEEDS_TOTAL` | 400 | ใช้เครดิตเกินยอดรวมไม่ได้ | Credit cannot exceed the total price |
| `CREDIT_INSUFFICIENT` | 400 | เครดิตไม่พอ | Not enough credit |
| `MEMBER_REQUIRED` | 401 | ต้องเข้าสู่ระบบสมาชิกก่อน | Please log in as a member first |
| `FREE_HOUR_NOT_ELIGIBLE` | 400 | ใช้ชั่วโมงฟรีได้เฉพาะรอบที่เริ่มก่อน 17:00 วันจันทร์–ศุกร์ | Free hours can only be used for slots starting before 17:00, Monday–Friday |
| `FREE_HOUR_NONE` | 400 | ยังไม่มีสิทธิ์ชั่วโมงฟรี | You have no free hours yet |
| `BOOKING_NOT_FOUND` | 404 | ไม่พบการจอง | Booking not found |
| `BOOKING_FORBIDDEN` | 403 | เบอร์โทรไม่ตรงกับการจองนี้ | The phone number does not match this booking |
| `INVALID_STATUS` | 409 | สถานะการจองนี้ทำรายการนี้ไม่ได้ | This action is not allowed for the booking's current status |
| `PAYMENT_EXPIRED` | 409 | หมดเวลาชำระเงิน รอบเวลานี้ว่างแล้ว | Payment time has expired. The slot is available again |
| `CANCEL_TOO_LATE` | 409 | ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น | Bookings can only be cancelled before the start time |
| `RESCHEDULE_LIMIT` | 409 | เลื่อนได้ 1 ครั้งต่อการจอง | A booking can be rescheduled only once |
| `RESCHEDULE_TOO_LATE` | 409 | เลื่อนได้เมื่อเหลือเวลาอย่างน้อย 24 ชั่วโมงก่อนเวลาเริ่ม | Rescheduling requires at least 24 hours before the start time |
| `RESCHEDULE_SAME` | 400 | กรุณาเลือกวันหรือเวลาใหม่ที่ต่างจากเดิม | Please choose a different date or time |
| `NO_SHOW_TOO_EARLY` | 409 | บันทึกไม่มาได้เมื่อเลยเวลาเริ่มอย่างน้อย 15 นาที | No-show can be recorded only 15 minutes after the start time |
| `SERIES_WEEKS_RANGE` | 400 | จองประจำได้ 4–12 สัปดาห์ | Recurring bookings must be 4–12 weeks |
| `SERIES_CONFLICT` | 409 | มีสัปดาห์ที่ชน: {dates} กรุณายืนยันจองเฉพาะสัปดาห์ที่ว่าง | Some weeks are taken: {dates}. Please confirm booking only the free weeks |
| `SERIES_NONE_AVAILABLE` | 409 | ไม่มีสัปดาห์ที่ว่างให้จอง | No free weeks to book |
| `RAIN_COVERED_FIELD` | 400 | สนาม {field} มีหลังคา ปิดเพราะฝนไม่ได้ | Field {field} is covered and cannot be closed for rain |
| `INVALID_RANGE` | 400 | ช่วงเวลาไม่ถูกต้อง | Invalid time range |
| `HOLIDAY_EXISTS` | 409 | มีวันหยุดวันนี้อยู่แล้ว | This holiday already exists |
| `HOLIDAY_NOT_FOUND` | 404 | ไม่พบวันหยุด | Holiday not found |
| `CHALLENGE_NOT_ALLOWED` | 409 | ประกาศหาคู่แข่งได้เฉพาะการจองที่ยืนยันแล้วและยังไม่ถึงเวลาเริ่ม | Only confirmed bookings that have not started can look for an opponent |
| `CHALLENGE_EXISTS` | 409 | การจองนี้ประกาศหาคู่แข่งแล้ว | This booking already has a challenge |
| `CHALLENGE_NOT_FOUND` | 404 | ไม่พบประกาศหาคู่แข่ง | Challenge not found |
| `CHALLENGE_NOT_OPEN` | 409 | ประกาศนี้ไม่เปิดรับแล้ว | This challenge is no longer open |
| `CHALLENGE_OWN` | 409 | รับคำท้าของตัวเองไม่ได้ | You cannot accept your own challenge |
| `CHALLENGE_PAYMENT_EXPIRED` | 409 | หมดเวลาชำระเงิน ประกาศกลับมาเปิดรับแล้ว | Payment time has expired. The challenge is open again |
| `CHALLENGE_MATCHED` | 409 | มีทีมรับคำท้าแล้ว ยกเลิกหรือเลื่อนการจองนี้ไม่ได้ | A team has accepted the challenge. This booking can't be cancelled or rescheduled |
| `CHALLENGE_PENDING` | 409 | มีทีมกำลังชำระเงินรับคำท้า เลื่อนการจองได้หลังชำระเสร็จหรือหมดเวลา 15 นาที | A team is paying for the challenge. You can reschedule after they pay or after 15 minutes |
| `CHALLENGE_WRONG_PHONE` | 403 | เบอร์โทรไม่ตรงกับทีมที่รับคำท้า | The phone number does not match the accepting team |
| `TEAM_REQUIRED` | 400 | กรุณากรอกชื่อทีม | Please enter a team name |
| `INVALID_LEVEL` | 400 | กรุณาเลือกระดับทีม | Please choose a team level |
| `SPLIT_COUNT` | 400 | จำนวนคนต้องอยู่ระหว่าง 2–30 คน | The number of people must be 2–30 |
| `SPLIT_NOT_FOUND` | 404 | ไม่พบลิงก์หารค่าสนาม | Split link not found |
| `RETURN_EXCEEDS` | 400 | จำนวนคืนเกินจำนวนที่เช่า | Returned quantity exceeds the rented quantity |
| `LOGIN_FAILED` | 401 | เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง | Incorrect phone number or password |
| `STAFF_LOGIN_FAILED` | 401 | ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง | Incorrect username or password |
| `ALREADY_REGISTERED` | 409 | เบอร์นี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ | This phone number is already registered. Please log in |
| `PASSWORD_TOO_SHORT` | 400 | รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร | Password must be at least 8 characters |
| `UNAUTHORIZED` | 401 | กรุณาเข้าสู่ระบบ | Please log in |
| `FORBIDDEN_ROLE` | 403 | บทบาทของคุณไม่มีสิทธิ์เข้าถึงส่วนนี้ | Your role is not allowed to access this |
| `NOT_FOUND` | 404 | ไม่พบข้อมูล | Not found |
| `INTERNAL` | 500 | เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ | Something went wrong. Please try again |
| `NETWORK` | 0 | เชื่อมต่อไม่ได้ กรุณาลองใหม่ | Connection failed. Please try again |
| `OK_PAID` | 200/201 | ชำระเงินสำเร็จ การจองได้รับการยืนยันแล้ว | Payment successful. Your booking is confirmed |
| `OK_CONFIRMED_FREE` | 200/201 | ยืนยันการจองแล้ว (ยอดที่ต้องจ่าย ฿0) | Booking confirmed (nothing to pay) |
| `OK_CANCEL_CREDIT` | 200/201 | ยกเลิกแล้ว ได้รับเครดิตคืน {amount} | Cancelled. {amount} credit returned |
| `OK_CANCEL_NO_CREDIT` | 200/201 | ยกเลิกแล้ว ไม่ได้รับเครดิตคืน เพราะเหลือเวลาน้อยกว่า 24 ชั่วโมง | Cancelled. No credit returned because less than 24 hours remained |
| `OK_CANCEL_PENDING` | 200/201 | ยกเลิกแล้ว | Cancelled |
| `OK_RESCHEDULED` | 200/201 | เลื่อนการจองแล้ว | Booking rescheduled |
| `OK_RESCHEDULED_PAY` | 200/201 | เลื่อนการจองแล้ว จ่ายส่วนต่าง {amount} เรียบร้อย | Booking rescheduled. Difference of {amount} paid |
| `OK_RESCHEDULED_CREDIT` | 200/201 | เลื่อนการจองแล้ว ได้รับส่วนต่างเป็นเครดิต {amount} | Booking rescheduled. Difference of {amount} returned as credit |
| `OK_SPLIT_CREATED` | 200/201 | สร้างลิงก์หารค่าสนามแล้ว | Split link created |
| `OK_SPLIT_EXISTS` | 200 | การจองนี้มีลิงก์หารค่าสนามแล้ว ใช้ลิงก์เดิม | This booking already has a split link. The existing link is used |
| `OK_CHALLENGE_CREATED` | 200/201 | ประกาศหาคู่แข่งแล้ว | Challenge posted |
| `OK_CHALLENGE_ACCEPTED` | 200/201 | รับคำท้าแล้ว กรุณาชำระเงินภายใน 15 นาที | Challenge accepted. Please pay within 15 minutes |
| `OK_CHALLENGE_MATCHED` | 200/201 | ชำระเงินสำเร็จ จับคู่แข่งเรียบร้อย | Payment successful. Match confirmed |
| `OK_CHECKED_IN` | 200/201 | เก็บเงินและเช็กอินแล้ว | Payment collected and checked in |
| `OK_NO_SHOW` | 200/201 | บันทึกไม่มาแล้ว | No-show recorded |
| `OK_NO_SHOW_BANNED` | 200/201 | บันทึกไม่มาแล้ว ลูกค้าถูกระงับการจองออนไลน์ถึง {date} | No-show recorded. The customer is suspended from online booking until {date} |
| `OK_RETURNED` | 200/201 | บันทึกคืนของเช่าแล้ว | Rental returns saved |
| `OK_HOLIDAY_ADDED` | 200/201 | เพิ่มวันหยุดแล้ว | Holiday added |
| `OK_HOLIDAY_DELETED` | 200/201 | ลบวันหยุดแล้ว | Holiday deleted |
| `OK_CLOSED` | 200/201 | ปิดสนามแล้ว คืนเครดิต {count} การจอง | Field closed. Credit returned for {count} booking(s) |
| `OK_REGISTERED` | 200/201 | สมัครสมาชิกสำเร็จ | Registration successful |
| `OK_SERIES_CREATED` | 200/201 | สร้างการจองประจำแล้ว กรุณาชำระเงินภายใน 15 นาที | Recurring booking created. Please pay within 15 minutes |

หมายเหตุ: `NETWORK` ใช้เฉพาะในเบราว์เซอร์เมื่อเรียก API ไม่ได้ · `OK_*` คือข้อความยืนยัน (ฟิลด์ `message` ในคำตอบสำเร็จ) · หน้า `/pay` แสดง `pay-expired` ด้วยข้อความ `PAYMENT_EXPIRED`

**ลำดับการตรวจตอนจอง (`POST /api/bookings`)**: สนาม/วันที่ → BR-02 → BR-03 → BR-04 → BR-05 → ปิดเพราะฝน (`FIELD_CLOSED`) → BR-06 → BR-22 → BR-16 → BR-24 → BR-15 → ชื่อ → เบอร์ → PDPA · error แรกที่เจอจะถูกตอบ

**BR-15 ขอใช้เครดิตโดยไม่ได้เข้าสู่ระบบ**: `/api/quote` หรือ `/api/bookings` ที่ส่ง `useCredit: true` หรือ `creditUsed` > 0 โดยไม่มี session สมาชิก**ของเบอร์นั้น** → `MEMBER_REQUIRED` 401 (ตำแหน่ง BR-15 ในลำดับข้างบน) · `creditUsed: 0` ไม่นับว่าขอใช้เครดิต

**ยกเลิก (`/cancel`)**: `INVALID_STATUS` → `CHALLENGE_MATCHED` → `CANCEL_TOO_LATE` (ยกเลิกได้ถึงก่อนเวลาเริ่ม 1 นาที · ถึงเวลาเริ่มพอดีหรือหลังจากนั้นไม่ได้) · **เลื่อน (`/reschedule`)**: `INVALID_STATUS` → `CHALLENGE_MATCHED` → `CHALLENGE_PENDING` (คำท้า `AWAITING_PAYMENT`, A-28) → `RESCHEDULE_LIMIT` → `RESCHEDULE_TOO_LATE` → BR-02–06

## 5. API

ทุกเส้นรับ/ตอบ JSON · เงินเป็นจำนวนเต็มบาท · เวลาเป็น ISO (UTC `Z`) · วันที่ `YYYY-MM-DD` · session เป็น cookie httpOnly (`ln_customer`, `ln_staff`, `ln_access` = รหัสการจองที่เบราว์เซอร์นี้สร้าง/ปลดล็อกด้วยเบอร์)

| method | path | body / query | ตอบ (ย่อ) | error หลัก |
|---|---|---|---|---|
| GET | `/api/health` | – | `{ "ok": true, "db": true }` (503 ถ้า DB ล่ม) | |
| GET | `/api/fields` | – | `{ fields: [{ id, name, size, covered, dayRate, eveningRate, photo }] }` | |
| GET | `/api/availability?date=` | date (ไม่ใส่ = วันนี้) | `{ date, today, maxDate, weekday, isHoliday, holidayName, fields, slots: [{ fieldId, hour, price, status, available }] }` status = free/booked/closed/past/out-of-range | |
| POST | `/api/quote` | `{ fieldId, date, startHour, hours, rentals?: { BIB, BALL }, useCredit?, creditUsed?, useFreeHour? }` | `{ quote: { fieldPrice, discount, freeHourValue, rentalPrice, totalPrice, creditUsed, netPrice, paymentPlan, payNow, dueAtField, hourly:[{hour,rate}], rentals, isHoliday, freeHourSlot } }` | ทุก error การจองยกเว้นชื่อ/เบอร์/PDPA |
| POST | `/api/bookings` | quote + `{ name, phone, consent: true }` | **201** `{ booking: {...Booking}, next: "/pay/LN-100001" }` | 400/403/409 ตามตารางข้อ 4 |
| GET | `/api/bookings/{code}?phone=` | phone (ไม่ต้องถ้าเป็นเจ้าของที่เข้าสู่ระบบหรือเบราว์เซอร์ที่สร้าง) | `{ booking: {..., customerName, phone, rentals, payments, challenge: { id, teamName, level, levelLabel, status, amount }, split, series}, secondsLeft, payTotal, actions: { canPay, canCancel, cancelBlockedBy, cancelCreditNow, canReschedule, rescheduleBlockedBy, canChallenge, canSplit } }` · `customerName` = ชื่อที่กรอกตอนจองนี้ · `*BlockedBy` = รหัส error ที่ API จะตอบ (หรือ `null`) · คำท้า `MATCHED` → `canCancel=false`, `canReschedule=false`, `rescheduleBlockedBy="CHALLENGE_MATCHED"` · คำท้า `AWAITING_PAYMENT` → `canReschedule=false`, `rescheduleBlockedBy="CHALLENGE_PENDING"` (ยกเลิกยังได้) · `cancelCreditNow` = 0 เมื่อยกเลิกไม่ได้ | `BOOKING_NOT_FOUND` 404, `BOOKING_FORBIDDEN` 403 |
| POST | `/api/bookings/{code}/pay` | `{ phone? }` | `{ ok, amount, bookings: [codes], message }` → CONFIRMED | `PAYMENT_EXPIRED` 409, `INVALID_STATUS` 409 |
| POST | `/api/bookings/{code}/cancel` | `{ phone? }` | `{ ok, status: "CANCELLED", creditReturned, message }` | `CHALLENGE_MATCHED` 409, `CANCEL_TOO_LATE`, `INVALID_STATUS` |
| POST | `/api/bookings/{code}/reschedule` | `{ date, startHour, phone? }` | `{ ok, booking, oldTotal, newTotal, extraPay, creditBack, message }` | `CHALLENGE_MATCHED` 409, `CHALLENGE_PENDING` 409, `RESCHEDULE_LIMIT`, `RESCHEDULE_TOO_LATE`, `RESCHEDULE_SAME`, BR-02–06 |
| POST | `/api/bookings/{code}/split` | `{ names?: string[], count?: number, phone? }` | `{ ok, existing, token, url: "/split/<token>", perPerson, people, netPrice, message }` · **1 การจอง 1 ลิงก์**: ครั้งถัดไปตอบลิงก์เดิม (`existing: true`, token / people / perPerson เดิม, ข้อความ `OK_SPLIT_EXISTS`) ไม่สร้างใหม่ ไม่ตรวจ `count`/`names` | `SPLIT_COUNT` (เฉพาะครั้งแรก), `INVALID_STATUS` |
| GET | `/api/split/{token}` | – | `{ booking: { code, fieldId, date, startHour, hours, netPrice, ownerName }, perPerson, people, paidCount, shares: [{ id, memberName, amount, paid }] }` (`ownerName` = ชื่อที่กรอกตอนจอง) | `SPLIT_NOT_FOUND` |
| POST | `/api/split/{token}/{shareId}/paid` | `{ paid: true|false }` | เหมือน GET | `SPLIT_NOT_FOUND` |
| POST | `/api/customers/register` | `{ name, phone, password, consent: true }` | **201** `{ ok, customerId, message }` + เข้าสู่ระบบให้ | `ALREADY_REGISTERED`, `PASSWORD_TOO_SHORT` |
| POST | `/api/customers/login` | `{ phone, password }` | `{ ok, customer: { id, name, phone } }` | `LOGIN_FAILED` 401 |
| POST | `/api/customers/logout` | – | `{ ok: true }` | |
| GET | `/api/me` | – | `{ customer: { name, phone, isMember, creditBalance, paidHours, freeHoursUsed, freeHoursAvailable, hoursToNextFree, bannedUntil, isBanned }, creditEntries: [...], bookings: [...] }` | `UNAUTHORIZED` 401 |
| POST | `/api/series/preview` | `{ fieldId, startDate, startHour, hours, weeks }` | `{ preview: { weeksRequested, weeksBooked, discountPercent, conflicts: [dates], weeks: [{ week, date, status, reason, fieldPrice, discount, totalPrice, payNow, paymentPlan }], totals: { fieldPrice, discount, totalPrice, payNow, dueAtField } } }` | `MEMBER_REQUIRED`, `SERIES_WEEKS_RANGE`, `TOO_SOON` |
| POST | `/api/series` | preview + `{ consent: true, confirmPartial?: true }` | **201** `{ ok, seriesId, codes, payNow, next, message }` (ทุกสัปดาห์ `PENDING_PAYMENT` จ่ายรวมที่ `/api/bookings/{codes[0]}/pay`) | `SERIES_CONFLICT` 409 (มีสัปดาห์ชนแต่ไม่ส่ง confirmPartial), `SERIES_NONE_AVAILABLE` |
| GET | `/api/rentals/availability?date=&startHour=&hours=` | | `{ items: [{ id, name, price, stock, remaining, maxQty }] }` | |
| GET | `/api/challenges?level=` | level ไม่ใส่ = ทั้งหมด | `{ challenges: [{ id, teamName, level, levelLabel, status, amount, fieldId, date, startHour, hours, ownerName }] }` (ไม่มีเบอร์ · `levelLabel` = มือใหม่/กลาง/เก่ง ตาม cookie `lang`) | |
| POST | `/api/challenges` | `{ code, teamName, level, phone? }` | `{ ok, challenge: { id, status: "OPEN", amount } }` | `CHALLENGE_NOT_ALLOWED`, `CHALLENGE_EXISTS`, `TEAM_REQUIRED`, `INVALID_LEVEL` |
| POST | `/api/challenges/{id}/accept` | `{ name, phone, consent: true }` | `{ ok, challenge: { status: "AWAITING_PAYMENT", amount, payDeadline }, secondsLeft }` | `CHALLENGE_NOT_OPEN`, `CHALLENGE_OWN` |
| POST | `/api/challenges/{id}/pay` | `{ phone }` | `{ ok, challenge: { status: "MATCHED", amount } }` เครดิตเข้าเจ้าของการจอง · จ่ายได้ถึงครบ 15 นาทีพอดีหลังรับ (15 นาที 1 วินาที = ไม่ทัน) | `CHALLENGE_PAYMENT_EXPIRED`, `CHALLENGE_WRONG_PHONE`, `CHALLENGE_NOT_OPEN` (รวมถึงเมื่อการจองถูกยกเลิก/ปิดฝน/ไม่มาไปแล้ว) |
| POST | `/api/staff/login` | `{ username, password }` | `{ ok, staff: { id, name, role }, next }` | `STAFF_LOGIN_FAILED` 401 |
| POST | `/api/staff/logout` · GET `/api/staff/me` | | | |
| GET | `/api/staff/bookings/{code}` | STAFF+ | `{ booking: {..., customerName, phone, rentals}, actions: { canCheckin, checkinBlockedBy, canNoShow, noShowBlockedBy } }` (`checkin` / `no-show` / `return-rentals` ตอบรูปเดียวกัน) | 401/403/404 |
| POST | `/api/staff/bookings/{code}/checkin` | STAFF+ | `{ ok, collected, booking }` → CHECKED_IN, Payment CASH_AT_FIELD, paidHours เพิ่ม | `INVALID_STATUS` |
| POST | `/api/staff/bookings/{code}/no-show` | STAFF+ | `{ ok, bannedUntil, booking }` → NO_SHOW | `NO_SHOW_TOO_EARLY`, `INVALID_STATUS` |
| POST | `/api/staff/bookings/{code}/return-rentals` | `{ items: [{ itemId, returnedQty }] }` (จำนวนคืนทั้งหมด) | `{ ok, booking }` | `RETURN_EXCEEDS`, `INVALID_QTY` |
| GET | `/api/staff/today?date=` | MANAGER, OWNER | `{ date, rows: [{ hour, cells: [{ fieldId, closed, booking }], rentals: { BIB, BALL } }], totals: { bookings, amountPaid, dueAtField } }` | 401/403 |
| GET / POST / DELETE | `/api/owner/holidays` | POST `{ date, name }` · DELETE `?date=` | `{ holidays: [...] }` | `HOLIDAY_EXISTS`, `HOLIDAY_NOT_FOUND` |
| GET / POST | `/api/owner/closures` | POST `{ fieldId, date, fromHour, toHour }` (ช่วง [from, to)) | `{ ok, closure, affected: [{ code, credit, customerId, challengeCredit, credits: [{ role: "OWNER" \| "CHALLENGER", customerId, amount }] }] }` · `credit` = เครดิตเจ้าของ · คำท้า `MATCHED` (A-27): ทีมรับได้ `challengeCredit` = ยอดที่จ่าย · เจ้าของได้ = จ่าย + เครดิตที่ใช้ − เครดิต CHALLENGE ที่ได้ไปแล้ว (ไม่ต่ำกว่า 0) · ทั้งสองเป็น `CreditEntry` reason `RAIN` ของการจองนั้น | `RAIN_COVERED_FIELD`, `INVALID_RANGE` |
| POST | `/api/test/reset` · `/api/test/clock` | `{ now }` | ดูข้อ 0 | 404 เมื่อปิด |

สิทธิ์: ไม่ได้เข้าสู่ระบบร้าน → 401 `UNAUTHORIZED` · บทบาทไม่พอ → 403 `FORBIDDEN_ROLE` · การจองของคนอื่น → 403 `BOOKING_FORBIDDEN`

## 6. พฤติกรรมที่ทีมออกแบบเพิ่ม (นอกเหนือ 04)

- เบอร์โทร = 10 หลักขึ้นต้น 0 (ช่องว่าง/ขีดถูกตัดออก) · รหัสผ่านสมาชิก ≥ 8 ตัว
- เครดิตและชั่วโมงฟรีใช้ได้เมื่อ **เข้าสู่ระบบสมาชิกของเบอร์นั้น** · ถูกหักตอนการจองเปลี่ยนเป็น `CONFIRMED` (จ่ายแล้ว หรือยอดสุทธิ ฿0)
- มูลค่าชั่วโมงฟรี = ราคาชั่วโมงแรกของการจอง · ยกเลิก ≥ 24 ชม. หรือปิดเพราะฝน คืนสิทธิ์ชั่วโมงฟรี
- ช่วงที่ปิดเพราะฝนจองใหม่ไม่ได้ (`FIELD_CLOSED`) · ปิดฝนเปลี่ยนเฉพาะ `CONFIRMED` ที่ทับช่วง · คำท้าของการจองนั้นทุกสถานะ (รวม `MATCHED` หลังคืนเครดิต) เป็น `CLOSED`
- ปิดฝนการจองที่คำท้า `MATCHED` (BR-14, A-27): ทีมรับได้เครดิตคืน = ยอดที่จ่าย เข้า `Customer` ของเบอร์ทีมนั้น (ใช้ได้เมื่อสมัครสมาชิกด้วยเบอร์นั้น A-17) · เจ้าของได้ = เงินที่จ่าย + เครดิตที่ใช้ − เครดิต CHALLENGE ที่ได้จากการจองนี้แล้ว (ไม่ต่ำกว่า 0) · ตัวอย่าง A ศุกร์ 18:00 จ่าย ฿1,200 ทีมรับจ่าย ฿600 → ทีม ฿600 เจ้าของ ฿600 · คำท้า `AWAITING_PAYMENT` ทีมยังไม่ได้จ่าย → ไม่ได้เครดิต เจ้าของได้เต็ม
- BR-16 นับ "ภายใน 30 วัน" จาก **วันที่ปฏิทิน** ที่บันทึกไม่มา (ห่าง ≤ 30 วัน → ระงับ) · ระงับถึง เวลาที่บันทึก + 30 วัน
- BR-22 คงเหลือของช่วงเวลา = stock − จำนวนที่เช่าใน**การจองที่ทับเวลา** (ทุกสนาม) − จำนวนที่**ยังไม่คืน**จากการจองที่จบไปแล้วก่อนช่วงนั้นในวันเดียวกัน · นับเฉพาะการจองสถานะ `PENDING_PAYMENT` / `CONFIRMED` / `CHECKED_IN` (แก้คำอธิบายเฟส 7.5 — เดิมเขียนผิดว่า "ทุกสนามในวันเดียวกัน" แต่เว็บทำแบบนี้มาตลอด)
- เลื่อนวัน: จำนวนชั่วโมงเท่าเดิม สนามเดิม · ส่วนต่างคิดจากยอดรวมใหม่ − ยอดรวมเดิม · ยอดเก็บหน้าสนามไม่เปลี่ยน · ถ้าใช้ชั่วโมงฟรี ช่วงใหม่ต้องเข้าเงื่อนไข BR-24 · คำท้าที่ยัง `OPEN` ย้ายตามการจองและคิดยอดทีมรับใหม่จากค่าสนามใหม่
- เช็กอินทำได้กับ `CONFIRMED` ทุกเวลา · เก็บ `dueAtField` ทั้งหมดเป็น `CASH_AT_FIELD`
- ลิงก์หาร 2–30 คน · ยอดสุทธิ = ยอดรวม − เครดิตที่ใช้
- รับคำท้าต้องติ๊กยินยอม PDPA · เจ้าของรับคำท้าของตัวเองไม่ได้ · จองประจำไม่มีของเช่า/เครดิต/ชั่วโมงฟรี
- หมดเวลาจ่าย (การจองและคำท้า) ตรวจแบบ lazy ทุกคำขอ: `pay_deadline < ตอนนี้` → EXPIRED / กลับเป็น OPEN

## 7. BR → ฟังก์ชันใน `web/lib/rules`

| BR | ฟังก์ชัน (ไฟล์) | เรียกจาก server |
|---|---|---|
| BR-01 | `checkRainClosable`, `FIELDS_RAIN_CLOSABLE` (booking.ts) | `closureCreate` |
| BR-02 | `checkStartHour`, `OPEN_HOUR`, `LAST_START_HOUR` (schedule.ts) | `validateBookingTime` |
| BR-03 | `checkHours` (schedule.ts) | `validateBookingTime` |
| BR-04 | `checkAdvanceWindow`, `maxBookableDate` (schedule.ts) | `validateBookingTime` |
| BR-05 | `checkLeadTime`, `slotTimeState` (schedule.ts) | `validateBookingTime`, availability |
| BR-06 | `checkNoOverlap`, `isBlocking`, `BLOCKING_STATUSES`, `overlaps`, `checkClosures` (schedule.ts) | `evaluateBooking` |
| BR-07, BR-08 | `hourlyRate`, `isEveningPricedDay`, `isWeekend`, `isHoliday` (pricing.ts) | availability, quote |
| BR-09 | `fieldPriceFor` (pricing.ts) | quote, bookings, series |
| BR-10 | `payDeadlineFrom`, `isPaymentInTime` (booking.ts) | create/pay, lazy expiry |
| BR-11 | `paymentPlanFor`, `planPercent` (pricing.ts) | quote, bookings, series |
| BR-12 | `computePrice`, `ceilBaht`, `rentalPriceFor` (pricing.ts) | quote, bookings |
| BR-13 | `checkCancel` (+ `challengeMatched`), `cancelCredit` (booking.ts) | `cancelBooking`, `bookingDetail` |
| BR-14 | `rainCredit`, `rainCreditSplit` (A-27), `checkRainClosable` (booking.ts) | `closureCreate` |
| BR-15 | `checkCredit`, `computePrice` (pricing.ts) | `evaluateBooking`, `confirmBooking` |
| BR-16 | `banAfterNoShow`, `isBanned` (booking.ts) | `staffNoShow`, `evaluateBooking` |
| BR-17 | `checkNoShow` (booking.ts) | `staffNoShow` |
| BR-18 | `checkSeriesWeeks`, `seriesDates` (extras.ts) + `checkLeadTime` | `seriesPlan` |
| BR-19 | `seriesDiscountPercent`, `discountAmount` (ปัดขึ้นเป็นบาทเต็ม) (extras.ts) | `seriesPlan` |
| BR-20 | `seriesQuote` (extras.ts) | `seriesPlan`, pay |
| BR-21 | `seriesQuote` + `checkNoOverlap`/`checkClosures` ต่อสัปดาห์ | `seriesPlan`, `seriesCreate` |
| BR-22 | `rentalRemaining`, `checkRentalQty`, `maxRentable` (extras.ts) | `rentalAvailability`, `evaluateBooking` |
| BR-23 | `freeHoursAvailable`, `hoursToNextFree`, `countedHours` (extras.ts) | `me`, `staffCheckin` |
| BR-24 | `checkFreeHour`, `isFreeHourSlot` (extras.ts) | `evaluateBooking`, reschedule |
| BR-25 | `checkReschedule` (+ `challengeMatched`, `challengePending`), `rescheduleDifference` (booking.ts) | `rescheduleBooking`, `bookingDetail` |
| BR-26 | `normalizePhone`, `checkPhone` (booking.ts) + `customers.phone UNIQUE` + `bookings.customer_name` | `upsertCustomer`, `createBooking`, `bookingCustomerName` |
| BR-27 | `splitPerPerson`, `checkSplitCount` (extras.ts) | `splitCreate` (ลิงก์เดิมถ้ามีแล้ว) |
| BR-28 | `checkChallengeCreate`, `challengeAmount`, `challengeDeadlineFrom`, `CHALLENGE_PAY_MINUTES` (extras.ts) · `checkCancel`/`checkReschedule` (`CHALLENGE_MATCHED`) | `challengeCreate/Accept/Pay`, `cancelBooking`, `rescheduleBooking` |

unit test: `cd web && npm test` (node --test `lib/rules/rules.test.ts`)

## 8. เปลี่ยนแปลงเฟส 7.5

ที่มา: `docs/08b-FIX-PROMPT.md` · คำตอบร้าน A-18–A-26 · Q-T1–Q-T10 (04 ส่วนที่ 6)

| # | อ้างอิง | พฤติกรรมใหม่ |
|---|---|---|
| 1 | BR-28, A-18, A-21 | การจองที่คำท้า `MATCHED`: ยกเลิก/เลื่อนไม่ได้ → `CHALLENGE_MATCHED` 409 · `actions.canCancel=false`, `canReschedule=false`, `cancelBlockedBy`/`rescheduleBlockedBy="CHALLENGE_MATCHED"` · หน้าเว็บแสดง `cancel-booking-hint` / `reschedule-submit-hint` · ยกเลิกระหว่างคำท้า `AWAITING_PAYMENT` → คำท้า `CLOSED` และการจ่ายของทีมรับหลังจากนั้นได้ `CHALLENGE_NOT_OPEN` (ไม่มีเครดิตเข้า) · ยกเลิกกับการจ่ายของทีมรับที่มาพร้อมกันถูกเรียงคิว (lock การจอง → คำท้า) ผ่านได้อย่างเดียว |
| 2 | BR-26, A-20 | `Booking.customerName` = ชื่อที่กรอกตอนจองนั้น (`booking-customer`, `staff-customer-name`, ภาพรวมวันนี้, ผู้ประกาศคำท้า, เจ้าของลิงก์หาร, API) · `Customer.name` เดิมไม่ถูกทับ |
| 3 | BR-28, A-19 | ระดับทีม มือใหม่ / กลาง / เก่ง (EN Beginner / Intermediate / Advanced) ทุกที่ · API มี `levelLabel` |
| 4 | BR-13, A-22 | ยกเลิกได้ถึงก่อนเวลาเริ่ม 1 นาที · ถึงเวลาเริ่มพอดี → `CANCEL_TOO_LATE` (`cancel-booking-hint`) |
| 5 | BR-28, A-23 | ทีมรับคำท้าจ่ายที่ครบ 15 นาทีพอดี = ทัน · 15 นาที 1 วินาที = `CHALLENGE_PAYMENT_EXPIRED` |
| 6 | BR-19, A-24 | ส่วนลดจองประจำมีเศษ → ปัดส่วนลดขึ้นเป็นบาทเต็ม (ราคาปัจจุบันหารลงตัวทุกกรณี) |
| 7 | BR-27, A-25 | 1 การจอง 1 ลิงก์หาร · สร้างซ้ำได้ลิงก์เดิม (`existing: true`, `OK_SPLIT_EXISTS`) สถานะจ่ายของลูกทีมไม่ถูกล้าง |
| 8 | BR-15, A-26 | ไม่ได้เข้าสู่ระบบสมาชิกของเบอร์นั้นแต่ส่ง `useCredit: true` / `creditUsed` > 0 → `MEMBER_REQUIRED` 401 ที่ตำแหน่ง BR-15 |
| 9 | BR-24, Q-T5 | `use-free-hour` disabled + `use-free-hour-reason` · API ยังตอบ `FREE_HOUR_NOT_ELIGIBLE` / `FREE_HOUR_NONE` ถ้าส่งมา |
| 10 | NFR-09, Q-T10 | `split-people`, `split-paid-count` มี `data-value` |
| 11 | NFR-03, Q-T4 | ไม่เปลี่ยน — โหมด EN ไม่แสดงชื่อวันหยุดในหน้าลูกค้า (ป้ายแสดง "Public holiday") · หน้าเจ้าของแสดงชื่อตามที่ร้านตั้ง |
| 12 | F-02 | `book-submit-hint`, `staff-no-show-hint`, `staff-checkin-hint`, `cancel-booking-hint`, `reschedule-submit-hint`, `challenge-create-hint` · API ร้านมี `actions` |
| 13 | F-03 | `field-error-name` / `-phone` / `-consent` แสดงพร้อมกัน · `error-message` ยังเป็น error แรกตามลำดับเดิม |
| 14 | F-05, NFR-13 | ปุ่มลบวันหยุดมีชื่อแยก · ช่องเบอร์ 3 ช่องใน `/my` คนละ label · h1 หน้าแรกมี `aria-label` |
| 15 | F-06, NFR-01 | `book-field`, `series-field` กว้างเต็มแถว ข้อความตัวเลือกไม่ถูกตัดที่ 375 px |
| 16 | NFR-08 | วัดด้วย `node selfcheck/nfr08.mjs` (เปิด `/book` จน `data-ready="true"`, 5 ครั้ง × chromium/firefox/webkit ทีละตัว) |
| 17 | SPEC | แก้คำอธิบายสต็อกของเช่า (ส่วนที่ 6) · เพิ่มรหัส error, testid และส่วนนี้ |
| 7.5 รอบ 2 · แก้ย้อน | contract เดิม | `cancel-booking` เปิดขั้นยืนยัน `cancel-credit-preview` → `cancel-confirm` / `cancel-abort` **เสมอ** (รอบแรกเคยข้ามขั้นยืนยันเมื่อยกเลิกไม่ได้ — ยกเลิกพฤติกรรมนั้นแล้ว) · กรณียกเลิกไม่ได้ preview ฿0 + `cancel-confirm-reason` |
| A-27 | BR-14, BR-15 | ปิดฝนการจองที่คำท้า `MATCHED`: ทีมรับได้คืนเท่าที่จ่าย · เจ้าของได้ จ่าย + เครดิตที่ใช้ − เครดิต CHALLENGE (≥ 0) · `affected` แสดงทั้ง 2 เครดิต |
| A-28 | BR-25 | คำท้า `AWAITING_PAYMENT` → เลื่อนไม่ได้ `CHALLENGE_PENDING` 409 · ครบ 15 นาทีพอดียังเลื่อนไม่ได้ · 15 นาที 1 วินาทีคำท้ากลับเป็น `OPEN` เลื่อนได้ (ยอดทีมรับคิดใหม่) |

ตรวจเอง: `node selfcheck/rules-check.mjs` (API, ข้อ `P75-*`) · `node selfcheck/screens-p75.mjs` (หน้าเว็บ + ภาพ `selfcheck/screens/p75-*.png`) · `node selfcheck/nfr08.mjs`
