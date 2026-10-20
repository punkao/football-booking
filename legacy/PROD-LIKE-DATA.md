# ฐานข้อมูล "เหมือนใช้งานจริง" สำหรับซ้อม migration (แผน L1)

ทำเมื่อ 2026-10-20 · git tag `v2-handover` (`faa3f2e`) · HEAD `95a5513` · สคริปต์ `tools/make-prod-like-data.mjs` · ทีมดูแลระบบรายใหม่ (chunk D-1)

> ทำไมต้องมี: seed ของ TEST-DATA มีการจองแค่ 8 รายการ ซ้อม migration บนนั้นไม่เห็นปัญหาจริง (บท 06 ข้อ 5 "เพิ่มได้ ห้ามล้าง")
> CR-05 ระบุว่า "ข้อมูลจริงในระบบมีการจองล่วงหน้าอยู่แล้ว ห้ามหาย ห้ามเปลี่ยนยอด" จึงต้องมีการจองหลัง 1 พ.ย. 2569 ไว้พิสูจน์

## 1. วิธีสร้าง / สร้างใหม่ / กลับ seed ปกติ

```bash
# เริ่มจาก seed ปกติก่อนเสมอ (สคริปต์เติมข้อมูลต่อจาก seed ไม่ลบของ seed)
curl -X POST http://localhost:3000/api/test/reset -H "content-type: application/json" -d '{}'
node tools/make-prod-like-data.mjs                 # เติมข้อมูล + ตั้งนาฬิกาแอปเป็น 2026-10-20 10:00 (+07)
node tools/make-prod-like-data.mjs --no-clock      # (ทางเลือก) ไม่แตะนาฬิกาแอป
node tools/make-prod-like-data.mjs --dry-run --sql x.sql   # ดู SQL ที่จะส่ง ไม่เขียนลงฐาน

# กลับ seed ปกติ (ต้องทำก่อนรัน e2e / selfcheck)
curl -X POST http://localhost:3000/api/test/reset -H "content-type: application/json" -d '{}'
```

PowerShell: `Invoke-RestMethod -Method Post http://localhost:3000/api/test/reset -ContentType "application/json" -Body '{}'`

## 2. กติกาของสคริปต์ (ตรวจแล้ว)

| ข้อ | ทำยังไง | หลักฐาน |
|---|---|---|
| deterministic | PRNG `mulberry32` seed `25691101` · วันที่ตายตัว (NOW = 2026-10-20 10:00 +07) · ตารางราคา ณ วันส่งมอบเขียนในไฟล์ (A/B 800/1,200 · C 1,200/1,800) ไม่อ่านจากโค้ดหรือตาราง `fields` → หลัง CR-05 รันซ้ำได้ยอดเดิม | `--dry-run` 2 ครั้งบน seed เดียวกัน ได้ SQL 6,210 บรรทัด **ไฟล์เหมือนกันทุกไบต์** (`cmp` → SAME · sha256 `36dab1cb0468ef40…`) |
| idempotent | marker = การจองรหัส `LN-7xxxxx` · มีแล้ว → ไม่ทำอะไร exit 0 | รันครั้งที่ 2: `มีชุดข้อมูล prod-like อยู่แล้ว (630 การจองรหัส LN-7xxxxx) — ไม่ทำซ้ำ` exit 0 |
| ทรานแซกชันเดียว | ทั้งก้อนใน `BEGIN … COMMIT` ส่งเข้า `docker exec -i football-db psql -v ON_ERROR_STOP=1` (ผิด 1 บรรทัด = ไม่มีอะไรเข้า) | สคริปต์ `psqlRun(..., { input: true })` |
| เคารพ constraint ทุกตัว ไม่ปิด trigger | ทุกการเปลี่ยนสถานะตั้ง `app.actor` / `app.now` ให้ trigger ของ 002 เขียนประวัติเอง · ช่องเวลาไม่ทับกัน (นับรวมการจองของ seed) · เงินเป็นจำนวนเต็ม ≥ 0 · stock ไม่ติดลบ · DAMAGE/ADJUST มีเหตุผล | COMMIT สำเร็จ ไม่มี error จาก EXCLUDE / CHECK / trigger |
| ไม่อ่านค่าลับ | ใช้ `dbEnv()` ของ `scripts/_db.mjs` (อ่านแค่ชื่อผู้ใช้/ฐาน) | – |
| ไม่ชนข้อมูลของ seed | ลูกค้าใหม่ใช้เบอร์ `090xxxxxxx` · การจองรหัส `LN-7xxxxx` (seed `LN-9000xx` · แอป `LN-100001+`) | – |

## 3. จำนวนแถว ก่อน / หลัง (รันจริง 2026-10-20 · 2,932 ms)

ก่อน = หลัง `POST /api/test/reset {}` · นับด้วย `db/scripts/counts.sql`

| ตาราง | ก่อน | หลัง | เพิ่ม |
|---|---:|---:|---:|
| customers | 7 | 47 | 40 |
| bookings | 8 | 638 | 630 |
| payments | 9 | 994 | 985 |
| credit_entries | 1 | 26 | 25 |
| holidays | 5 | 8 | 3 |
| booking_rentals | 0 | 119 | 119 |
| recurring_series | 0 | 2 | 2 |
| stock_movements | 2 | 140 | 138 |
| counter_sales | 2 | 55 | 53 |
| counter_sale_items | 2 | 107 | 105 |
| booking_status_history | 21 | 1,831 | 1,810 |
| audit_logs | 0 | 596 | 596 |
| fields · rental_items · staff_users · stock_items · stock_locations · stock_levels · field_closures · split_shares · challenges · chat_sessions · chat_messages | 3 · 2 · 3 · 8 · 2 · 16 · 0 · 0 · 0 · 1 · 2 | เท่าเดิม | 0 (stock_levels เปลี่ยนจำนวน ไม่เพิ่มแถว) |
| sum:payments.amount | 11,400 | 1,198,570 | 1,187,170 |
| sum:counter_sales.total_amount | 100 | 4,560 | 4,460 |
| sum:customers.credit_balance | 1,200 | 33,990 | 32,790 |
| sum:stock_levels.qty | 322 | 2,129 | 1,807 |
| schema_migrations | 6 | 6 | 0 |

หลัง reset กลับ: ทุกตัวเลขกลับเป็นค่า "ก่อน" (bookings 8 · payments 9 · history 21 · audit 0 · `LN-7%` = 0 · clock `2026-10-09T03:00:00Z`) · `/api/version` = `{"schemaVersion":"006","chatMode":"mock","bugMode":0}`

## 4. หน้าตาของข้อมูล

| เรื่อง | ค่า |
|---|---|
| ช่วงวันเตะ | 1 มิ.ย. 2569 → 19 ธ.ค. 2569 (จองเดี่ยวถึง 3 พ.ย. = NOW + 14 วันตาม BR-04 · จองประจำไปต่อถึง ธ.ค.) |
| สถานะการจอง LN-7 | CHECKED_IN 485 · CONFIRMED 51 · CANCELLED 40 · EXPIRED 29 · NO_SHOW 25 |
| การจองที่เตะตั้งแต่ 1 พ.ย. 2569 | **16** (CONFIRMED สนาม A/B ช่วงราคาเย็น **9** รายการ = กลุ่มที่ CR-05 ห้ามเปลี่ยนยอด) |
| จองประจำ | B อังคาร 19:00 × 8 สัปดาห์ (27 ต.ค. → 15 ธ.ค.) ลด 10% = ฿1,080/สัปดาห์ · C เสาร์ 18:00–20:00 × 10 สัปดาห์ (17 ต.ค. → 19 ธ.ค.) ลด 10% |
| ลูกค้า | 40 คน (สมาชิกมีรหัสผ่าน 16 คน · รหัสผ่านทดสอบอยู่ในหัวสคริปต์) · ขาประจำ 12 คนเล่นบ่อยกว่า |
| เงิน | มัดจำ/จ่ายเต็มผ่าน PROMPTPAY · ส่วนที่เหลือ CASH_AT_FIELD ตอนเช็กอิน · ยกเลิก ≥ 24 ชม. ได้เครดิต CANCEL (25 รายการ) |
| ของเช่า | 119 แถว (BIB / BALL) · ค่าของเช่าเข้า `rental_price` และยอดรวม |
| คลัง | รับของต้นเดือน (STORE) → ย้ายไปเคาน์เตอร์ → ขาย 53 บิล (CASH / PROMPTPAY) · ชำรุด BALL 1 · ปรับยอด 2 ครั้ง (มีเหตุผล) |
| ประวัติ / audit | ผู้ทำ: CUSTOMER 1,287 · staff 410 · manager 105 · SYSTEM 29 (หมดเวลาจ่าย) · audit CHECKIN / NO_SHOW / STOCK_* 596 แถว |
| วันหยุดเพิ่ม | 3 มิ.ย. · 28 ก.ค. · 12 ส.ค. 2569 (ราคาเย็นทั้งวันตาม BR-08) |
| ไม่มี | แชท (มีแค่ห้องของ seed) · คำท้า · ลิงก์หาร · ปิดฝน · ใช้เครดิต / ชั่วโมงฟรี · การระงับ BR-16 (สคริปต์เลี่ยงไม่ให้ใครไม่มา 2 ครั้งใน 40 วัน) |

## 5. ตรวจความสอดคล้องหลังเติม (SQL บนฐานที่เติมแล้ว)

| ตรวจ | ผล |
|---|---|
| `amount_paid` ของการจอง ≠ ผลรวม `payments` | 0 แถว |
| `credit_balance` ของลูกค้าใหม่ ≠ ผลรวม `credit_entries` | 0 แถว |
| การจองที่ไม่มีแถวประวัติ | 0 แถว |
| `paid_hours` ≠ ชั่วโมงที่ CHECKED_IN (BR-23) | 0 แถว |
| เว็บใช้กับข้อมูลชุดนี้ได้ | `GET /api/owner/reports?from=2026-06-01&to=2026-08-31` 200 (การจอง 379 · รับเงินจอง ฿738,655) · `/api/owner/dashboard` 200 (วันที่ 2026-10-20) · `/api/availability?date=2026-11-03` 200 · `reports.csv` 200 51 บรรทัด |

## 6. ข้อจำกัด / ข้อควรรู้

- ข้อมูลนี้ **ไม่ใช่** ข้อมูลลูกค้าจริง สร้างจาก PRNG · ห้ามใช้เป็นค่าที่คาดหวังของกฎธุรกิจ ([E] เท่านั้น)
- สคริปต์ตั้งนาฬิกาแอปเป็น 20 ต.ค. 2569 เพื่อให้ "ที่ผ่านมา / ล่วงหน้า" ตรงกับสถานะ · การจองของ seed (เช่น LN-900004 วันที่ 11 ต.ค. ยัง CONFIRMED) จะดูเป็นรายการค้างในอดีต
- ราคาในสคริปต์คือราคาก่อน CR-05 โดยตั้งใจ (ยอดเก่าห้ามเปลี่ยน) · ถ้าต้องการข้อมูลหลัง CR-05 ให้เพิ่มเป็นชุดใหม่ ไม่แก้ชุดนี้
- **ต้อง reset `{}` ทุกครั้งก่อนรัน e2e / selfcheck** (ชุดทดสอบผูกกับ seed และวันล็อก 9 ต.ค.)
