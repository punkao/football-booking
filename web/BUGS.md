# BUGS.md — เฉลยบั๊กที่ฝังไว้ (BUG_MODE=1)

> ไฟล์นี้สำหรับผู้สอน/ผู้ตรวจเท่านั้น — ผู้เขียน test ห้ามเปิด (07-SAD ส่วนที่ 7)
> เปิดด้วย `BUG_MODE=1 docker compose up -d` · ปิดด้วย `docker compose up -d` · `<html data-bug-mode="1">`
> ทั้งหน้าเว็บและ API ใช้ฟังก์ชันเดียวกันใน `lib/rules` ผลจึงเหมือนกันทั้งสองทาง · `BUG_MODE=0` ถูกต้องทุกข้อ

| # | BR | อาการใน BUG_MODE=1 | ที่อยู่ในโค้ด | ค่าขอบที่จับได้ |
|---|---|---|---|---|
| 1 | BR-11 | การจองวัน**เสาร์**ที่เริ่มตั้งแต่ 17:00 ได้แผน `DEPOSIT_50` (จ่าย 50%) — บังคับจ่ายเต็มเฉพาะวันศุกร์ | `lib/rules/pricing.ts` → `paymentPlanFor()` ใช้ `fullDays = bugMode ? [5] : [5, 6]` | เสาร์ 17 ต.ค. A 17:00 → ควรได้ `FULL_100` จ่าย ฿1,200 แต่ได้ `DEPOSIT_50` จ่าย ฿600 (`price-plan`, `price-pay-now`, `POST /api/quote`, `POST /api/bookings`) |
| 2 | BR-13 | ยกเลิกเมื่อเหลือ **24 ชั่วโมงพอดี** ไม่ได้เครดิต (ใช้ "มากกว่า" แทน "ตั้งแต่") | `lib/rules/booking.ts` → `cancelCredit()` ใช้ `remaining > limit` เมื่อ bugMode แทน `remaining >= limit` | จอง จ. 12 ต.ค. 19:00 จ่าย ฿600 · ล็อกเวลา 11 ต.ค. 19:00 แล้วยกเลิก → ควรได้เครดิต ฿600 แต่ได้ ฿0 (`cancel-credit-preview`, `creditReturned`, ข้อความ `OK_CANCEL_NO_CREDIT`) · 24 ชม. 1 นาที ยังได้ตามปกติ |
| 3 | BR-22 | เช่า**เอี๊ยม**ได้ถึง **7 ชุด**ในช่วงเวลาเดียวกัน (ตรวจสต็อกคลาดไป 1) | `lib/rules/extras.ts` → `maxRentable()` คืน `remaining + 1` สำหรับ `BIB` เมื่อ bugMode (ใช้ใน `checkRentalQty`) | จองพร้อมเอี๊ยม 7 → ควรได้ 409 `RENTAL_OUT_OF_STOCK` แต่สร้างได้ 201 · ช่อง `rental-BIB-qty` มี `max=7` · ลูกบอลยังถูกต้อง (11 ลูกไม่ได้) · `rental-BIB-remaining` ยังแสดง 6 |

ตรวจด้วยสคริปต์: `node selfcheck/rules-check.mjs --expect-bugs` (ต้องเห็น 3 ข้อนี้ FAIL และข้ออื่นผ่านทั้งหมด)
