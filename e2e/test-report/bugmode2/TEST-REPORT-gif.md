# TEST REPORT — ลูกหนัง อารีน่า

สร้างเมื่อ 20/10/2569 17:04:04 · เวลาที่ล็อกในระบบ `2026-10-09T10:00:00+07:00` · **BUG_MODE = 1** (อ่านจาก `<html data-bug-mode>`) · ผลรวมรอบล่าสุดของแต่ละ project (Playwright: passed)

แผนทดสอบ: [`docs/09-TEST-PLAN.md`](../../docs/09-TEST-PLAN.md) · HTML report: `npm run report`

## 1. สรุปผล

| project | รันเมื่อ | ผ่าน | ล้ม | ข้าม | รวม |
|---|---|---|---|---|---|
| chromium | 20/10/2569 16:39:00 | 70 | 7 | 1 | 78 |
| firefox | 20/10/2569 16:39:00 | 69 | 8 | 1 | 78 |
| webkit | 20/10/2569 16:39:00 | 70 | 7 | 1 | 78 |
| serial | 20/10/2569 16:39:00 | 38 | 11 | 0 | 49 |
| perf-chromium | 20/10/2569 16:39:10 | 1 | 0 | 0 | 1 |
| perf-firefox | 20/10/2569 16:39:10 | 1 | 0 | 0 | 1 |
| perf-webkit | 20/10/2569 16:39:10 | 1 | 0 | 0 | 1 |

รอบอัดหลักฐาน (`npm run test:gif`, slowMo 650 ms — ไม่ใช้ตัดสินผล): setup ผ่าน 1 ล้ม 0 ข้าม 0 · chromium ผ่าน 70 ล้ม 7 ข้าม 1 · serial ผ่าน 38 ล้ม 11 ข้าม 0 · perf-chromium ผ่าน 1 ล้ม 0 ข้าม 0

- ผ่านรวม **250/283 = 88.3%** (เกณฑ์ ≥ 95%, ไม่นับข้อที่ข้าม)
- P1 ที่ล้ม: **12** ผล (เกณฑ์ 0) → TC-BOOK-04, TC-ROLE-03, TC-MEMBER-06, TC-BOOK-10, TC-SALE-01, TC-DASH-01, TC-DASH-02, TC-REPORT-02
- **ผ่านเกณฑ์: ❌ ไม่ผ่าน**
- NFR-08 (TC-BOOK-02 รันเดี่ยว) เวลาเปิด /book จน data-ready: chromium 231 ms · firefox 533 ms · webkit 447 ms (เกณฑ์ ≤ 2,000 ms)

## 2. ผลตามโมดูล

| โมดูล | จำนวน TC | ผลที่รัน | ผ่าน | ล้ม | TC ที่ล้ม |
|---|---|---|---|---|---|
| HOME | 2 | 6 | 6 | 0 | – |
| BOOK | 11 | 29 | 22 | 7 | TC-BOOK-04, TC-BOOK-11, TC-BOOK-10 |
| PRICE | 7 | 15 | 15 | 0 | – |
| PAY | 4 | 8 | 8 | 0 | – |
| CANCEL | 10 | 16 | 16 | 0 | – |
| CREDIT | 4 | 12 | 12 | 0 | – |
| SERIES | 5 | 10 | 10 | 0 | – |
| RENT | 3 | 9 | 9 | 0 | – |
| MEMBER | 8 | 22 | 21 | 1 | TC-MEMBER-06 |
| TEAM | 8 | 18 | 18 | 0 | – |
| STAFF | 7 | 13 | 10 | 3 | TC-STAFF-06 |
| OWNER | 4 | 10 | 10 | 0 | – |
| I18N | 2 | 6 | 6 | 0 | – |
| MOB | 2 | 6 | 6 | 0 | – |
| API | 5 | 13 | 13 | 0 | – |
| CHAT | 20 | 58 | 49 | 9 | TC-CHAT-14, TC-CHAT-15, TC-CHAT-16 |

## 3. ผลราย TC ทุกเบราว์เซอร์

| TC | สิ่งที่ทดสอบ | ระดับ | chromium | firefox | webkit | serial | GIF | MP4 |
|---|---|---|---|---|---|---|---|---|
| TC-DASH-01 | แดชบอร์ดจาก seed (TEST-DATA 5.4) เทียบ SQL | P1 | – | – | – | ❌ ล้ม | [gif](gifs/TC-DASH-01.gif) | [mp4](videos/TC-DASH-01.mp4) |
| TC-DASH-02 | ยอดวันนี้อัปเดตหลังรับเงิน · เครดิตแสดงแยก ไม่นับเป็นรายได้ (A-37) | P1 | – | – | – | ❌ ล้ม | [gif](gifs/TC-DASH-02.gif) | [mp4](videos/TC-DASH-02.mp4) |
| TC-DASH-03 | อัตราการใช้สนาม 25% (US-46) · ยกเลิกไม่นับ · ชั่วโมงยอดนิยม/สถานะ | P2 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-DASH-03.gif) | [mp4](videos/TC-DASH-03.mp4) |
| TC-DATA-01 | staff กดไม่มา LN-900001 ตอน 19:15 → ประวัติ (ชื่อพนักงาน A-44) + AuditLog (E146) | P2 | – | – | – | ❌ ล้ม | [gif](gifs/TC-DATA-01.gif) | [mp4](videos/TC-DATA-01.mp4) |
| TC-DATA-02 | ไม่มีทางแก้/ลบประวัติสถานะและ AuditLog (E147) | P2 | – | – | – | ✅ ผ่าน | – | – |
| TC-DATA-03 | migration รันซ้ำและถอยกลับโดยการจองเดิมอยู่ครบ (E148) | P2 | – | – | – | ✅ ผ่าน | – | – |
| TC-REPORT-01 | ช่วงวันรายงาน E140–E142 (+ 30 พ.ย. → 28 ก.พ. A-46) | P2 | – | – | – | ❌ ล้ม | [gif](gifs/TC-REPORT-01.gif) | [mp4](videos/TC-REPORT-01.mp4) |
| TC-REPORT-02 | รายงาน 8–8 ต.ค. (E144) เทียบ SQL | P1 | – | – | – | ❌ ล้ม | [gif](gifs/TC-REPORT-02.gif) | [mp4](videos/TC-REPORT-02.mp4) |
| TC-REPORT-03 | CSV เปิด Excel ได้ (BOM · หัวไทย · ไม่มี ฿) และบันทึก REPORT_EXPORT | P2 | – | – | – | ❌ ล้ม | [gif](gifs/TC-REPORT-03.gif) | [mp4](videos/TC-REPORT-03.mp4) |
| TC-REPORT-04 | หัวข้อที่ร้านขอในรายงาน: เงินแยก มัดจำพร้อมเพย์ / เก็บหน้าสนาม / หักเครดิต + ชั่วโมงต่อสนาม | P2 | – | – | – | ❌ ล้ม | [gif](gifs/TC-REPORT-04.gif) | [mp4](videos/TC-REPORT-04.mp4) |
| TC-REPORT-05 | เงินนับวันรับ · การจองนับวันเตะ (BR-40 "มัดจำวันที่ 9 การจองวันที่ 12") | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-REPORT-05.gif) | [mp4](videos/TC-REPORT-05.mp4) |
| TC-ROLE-01 | สิทธิ์หลังบ้านตามบทบาท (BR-44) + E143 | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-ROLE-01.gif) | [mp4](videos/TC-ROLE-01.mp4) |
| TC-ROLE-02 | สิทธิ์คลัง: staff ขาย/ย้ายได้ · รับเข้า/ชำรุด/ปรับยอด/จุดสั่งซื้อไม่ได้ (E132) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-ROLE-02.gif) | [mp4](videos/TC-ROLE-02.mp4) |
| TC-ROLE-03 | ออกจากระบบแล้ว cookie เดิมต้องใช้ไม่ได้ (สมาชิก + ร้าน) | P1 | ❌ ล้ม | ❌ ล้ม | ❌ ล้ม | – | [gif](gifs/TC-ROLE-03.gif) | [mp4](videos/TC-ROLE-03.mp4) |
| TC-ROLE-04 | ไม่เข้าสู่ระบบเปิดหน้าหลังบ้าน v2 → ไปหน้าเข้าสู่ระบบ | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-ROLE-04.gif) | [mp4](videos/TC-ROLE-04.mp4) |
| TC-SALE-01 | ขายหน้าเคาน์เตอร์ E135 และ US-42 (น้ำ 2 เงินสด) | P1 | – | – | – | ❌ ล้ม | [gif](gifs/TC-SALE-01.gif) | [mp4](videos/TC-SALE-01.mp4) |
| TC-SALE-02 | ขายน้ำ 23 / 24 / 25 ขวด (E121–E123) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-SALE-02.gif) | [mp4](videos/TC-SALE-02.mp4) |
| TC-SALE-03 | ขายได้เฉพาะของขาย (E136–E137) · ฟอร์มเปล่า / ไม่เลือกช่องทาง | P2 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-SALE-03.gif) | [mp4](videos/TC-SALE-03.mp4) |
| TC-STOCK-01 | คงเหลือ 8 รายการ แยก STORE / COUNTER / รวม + ประวัติขาย seed | P2 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STOCK-01.gif) | [mp4](videos/TC-STOCK-01.mp4) |
| TC-STOCK-02 | ย้ายของ E124–E127 | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STOCK-02.gif) | [mp4](videos/TC-STOCK-02.mp4) |
| TC-STOCK-03 | เตือนของใกล้หมด E128–E131 + ตั้ง/ล้างจุดสั่งซื้อซ้ำ | P2 | – | – | – | ❌ ล้ม | [gif](gifs/TC-STOCK-03.gif) | [mp4](videos/TC-STOCK-03.mp4) |
| TC-STOCK-04 | ปรับยอดต้องมีเหตุผล และบันทึกชื่อ+เวลา (E133–E134) | P2 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STOCK-04.gif) | [mp4](videos/TC-STOCK-04.mp4) |
| TC-STOCK-05 | ชำรุด/รับเข้าเอี๊ยม เปลี่ยนจำนวนให้เช่า (E138–E139) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STOCK-05.gif) | [mp4](videos/TC-STOCK-05.mp4) |
| TC-STOCK-06 | ลดของเช่าต่ำกว่าที่การจองค้างจองไว้ไม่ได้ | P2 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STOCK-06.gif) | [mp4](videos/TC-STOCK-06.mp4) |
| TC-TRACK-01 | ขั้นสถานะการจองพร้อมเวลา: จองแล้ว → จ่ายแล้ว → เช็กอิน → จบ (A-43, A-45) | P3 | – | – | – | ❌ ล้ม | [gif](gifs/TC-TRACK-01.gif) | [mp4](videos/TC-TRACK-01.mp4) |
| TC-TRACK-02 | ขั้นสถานะเมื่อยกเลิก / หมดเวลาจ่าย | P3 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-TRACK-02.gif) | [mp4](videos/TC-TRACK-02.mp4) |
| TC-HOME-01 | หน้าแรกพร้อมใช้ การ์ด 3 สนาม และไปตารางว่างวันนี้ใน 1 แตะ | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-HOME-01.gif) | [mp4](videos/TC-HOME-01.mp4) |
| TC-HOME-02 | หน้าข้อมูลสนาม: ขนาด หลังคา ราคา รูปมีคำอธิบาย | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-HOME-02.gif) | [mp4](videos/TC-HOME-02.mp4) |
| TC-BOOK-01 | E2E จองจนจ่ายจบผ่านหน้าเว็บ | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-BOOK-01.gif) | [mp4](videos/TC-BOOK-01.mp4) |
| TC-BOOK-02 | รอบเวลาเริ่มตรงชั่วโมง 08:00–23:00 และตารางโหลดเร็ว | P1 | ✅ ผ่าน (perf) | ✅ ผ่าน (perf) | ✅ ผ่าน (perf) | – | [gif](gifs/TC-BOOK-02.gif) | [mp4](videos/TC-BOOK-02.mp4) |
| TC-BOOK-03 | จำนวนชั่วโมงและเวลาจบไม่เกิน 24:00 | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-BOOK-03.gif) | [mp4](videos/TC-BOOK-03.mp4) |
| TC-BOOK-04 | จองล่วงหน้าได้ไม่เกิน 14 วัน (23 ต.ค. ได้ / 24 ต.ค. ไม่ได้) | P1 | ❌ ล้ม | ❌ ล้ม | ❌ ล้ม | – | [gif](gifs/TC-BOOK-04.gif) | [mp4](videos/TC-BOOK-04.mp4) |
| TC-BOOK-05 | จองวันนี้ต้องห่าง "ตอนนี้" อย่างน้อย 1 ชั่วโมง (15:00 → 16:00 ได้ / 15:01 ไม่ได้) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-BOOK-05.gif) | [mp4](videos/TC-BOOK-05.mp4) |
| TC-BOOK-06 | ห้ามจองทับเวลาในสนามเดียวกัน | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-BOOK-06.gif) | [mp4](videos/TC-BOOK-06.mp4) |
| TC-BOOK-07 | ฟอร์มลูกค้า: ชื่อ เบอร์ และช่องยินยอม PDPA | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-BOOK-07.gif) | [mp4](videos/TC-BOOK-07.mp4) |
| TC-BOOK-08 | กรองรอบก่อน 17:00 และเรียงราคาถูกไปแพง | P3 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-BOOK-08.gif) | [mp4](videos/TC-BOOK-08.mp4) |
| TC-BOOK-09 | กดยืนยันจอง 2 ครั้งติดกันจริง → การจอง 1 รายการ | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-BOOK-09.gif) | [mp4](videos/TC-BOOK-09.mp4) |
| TC-BOOK-10 | ค่าขอบเวลาตาม TEST-DATA ทุกแถว E04–E21 (วันนี้ ศ 9 10:00) | P1 | – | – | – | ❌ ล้ม | [gif](gifs/TC-BOOK-10.gif) | [mp4](videos/TC-BOOK-10.mp4) |
| TC-BOOK-11 | ค้นการจองโดยไม่กรอกอะไร / ไม่กรอกเบอร์ → ข้อความบอกให้กรอก (ไม่ใช่ error ระบบ) | P3 | ❌ ล้ม | ❌ ล้ม | ❌ ล้ม | – | [gif](gifs/TC-BOOK-11.gif) | [mp4](videos/TC-BOOK-11.mp4) |
| TC-PRICE-01 | ราคาต่อชั่วโมงตามขนาดและช่วงเวลา และจองคร่อม 17:00 | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-PRICE-01.gif) | [mp4](videos/TC-PRICE-01.mp4) |
| TC-PRICE-02 | เสาร์ อาทิตย์ และวันหยุด คิดราคาเย็นทุกรอบ | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-PRICE-02.gif) | [mp4](videos/TC-PRICE-02.mp4) |
| TC-PRICE-03 | แผนจ่าย มัดจำ 50% / จ่ายเต็ม 100% | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-PRICE-03.gif) | [mp4](videos/TC-PRICE-03.mp4) |
| TC-PRICE-04 | สูตรยอดรวม/สุทธิ/จ่ายตอนนี้ และใช้เครดิตไม่เกินยอดรวม | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-PRICE-04.gif) | [mp4](videos/TC-PRICE-04.mp4) |
| TC-PRICE-05 | ราคาทุกแถว E22–E33 (ขนาด/ช่วงเวลา/วันหยุด/คร่อม 17:00) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-PRICE-05.gif) | [mp4](videos/TC-PRICE-05.mp4) |
| TC-PRICE-06 | แผนจ่ายทุกแถว E37–E43 | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-PRICE-06.gif) | [mp4](videos/TC-PRICE-06.mp4) |
| TC-PRICE-07 | เครดิตของต้นกับยอด E45, E46 และขอบ ฿999/฿1,000/฿1,001 (E56–E58) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-PRICE-07.gif) | [mp4](videos/TC-PRICE-07.mp4) |
| TC-PAY-01 | หน้าจ่ายจำลอง PromptPay และสถานะหลังจ่าย (รีโหลด/จ่ายซ้ำ) | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-PAY-01.gif) | [mp4](videos/TC-PAY-01.mp4) |
| TC-PAY-02 | จ่ายภายใน 15 นาที (15:00 ทัน / 15:01 ไม่ทัน) และรอบกลับมาว่าง | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-PAY-02.gif) | [mp4](videos/TC-PAY-02.mp4) |
| TC-PAY-03 | กดยืนยันจ่าย 2 ครั้งติดกันจริง → Payment 1 แถว | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-PAY-03.gif) | [mp4](videos/TC-PAY-03.mp4) |
| TC-PAY-04 | จ่ายที่ 14 นาที 59 วินาที (E34) และ 15 นาที 0 วินาที (E35) ทัน | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-PAY-04.gif) | [mp4](videos/TC-PAY-04.mp4) |
| TC-CANCEL-01 | ยกเลิกเมื่อเหลือ 24 ชั่วโมงพอดี ได้เครดิต = เงินที่จ่าย + เครดิตที่ใช้ | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-CANCEL-01.gif) | [mp4](videos/TC-CANCEL-01.mp4) |
| TC-CANCEL-02 | ยกเลิกเมื่อเหลือ 23:59 ชม. ไม่ได้เครดิต และยกเลิกหลังเวลาเริ่มไม่ได้ | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-CANCEL-02.gif) | [mp4](videos/TC-CANCEL-02.mp4) |
| TC-CANCEL-03 | เลื่อนวัน/เวลา: แพงขึ้นจ่ายส่วนต่าง ถูกลงคืนเครดิต และเลื่อนได้ 1 ครั้ง | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CANCEL-03.gif) | [mp4](videos/TC-CANCEL-03.mp4) |
| TC-CANCEL-04 | เลื่อนวันได้เมื่อเหลืออย่างน้อย 24 ชั่วโมง (23:59 ไม่ได้ / 24:00 ได้) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-CANCEL-04.gif) | [mp4](videos/TC-CANCEL-04.mp4) |
| TC-CANCEL-05 | ยกเลิกเมื่อเหลือ 1 นาที ได้แต่ไม่ได้เครดิต · เหลือ 0 นาที (ถึงเวลาเริ่ม) ยกเลิกไม่ได้ (A-22) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-CANCEL-05.gif) | [mp4](videos/TC-CANCEL-05.mp4) |
| TC-CANCEL-06 | เลื่อนการจองที่คำท้า MATCHED ไม่ได้ (A-21) | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CANCEL-06.gif) | [mp4](videos/TC-CANCEL-06.mp4) |
| TC-CANCEL-07 | เลื่อนระหว่างทีมรับคำท้ากำลังจ่าย → ปฏิเสธ · ครบ 15 นาทีพอดียังเลื่อนไม่ได้ · 15 นาที 1 วินาทีเลื่อนได้ (A-28) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-CANCEL-07.gif) | [mp4](videos/TC-CANCEL-07.mp4) |
| TC-CANCEL-08 | ยกเลิกตามแถว TEST-DATA E47–E51 (การจอง A ส 10 10:00) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-CANCEL-08.gif) | [mp4](videos/TC-CANCEL-08.mp4) |
| TC-CANCEL-09 | เลื่อนตามแถว E94–E97 | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-CANCEL-09.gif) | [mp4](videos/TC-CANCEL-09.mp4) |
| TC-CANCEL-10 | เลื่อนไปช่วงถูกลง: เครดิตส่วนต่าง และยอดเก็บหน้าสนาม | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CANCEL-10.gif) | [mp4](videos/TC-CANCEL-10.mp4) |
| TC-CREDIT-01 | สมาชิกดูเครดิต ประวัติเครดิต และชั่วโมงสะสม | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CREDIT-01.gif) | [mp4](videos/TC-CREDIT-01.mp4) |
| TC-CREDIT-02 | เครดิตสะสมตามเบอร์ ใช้ได้หลังสมัครสมาชิกเท่านั้น | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CREDIT-02.gif) | [mp4](videos/TC-CREDIT-02.mp4) |
| TC-CREDIT-03 | ไม่ได้เข้าสู่ระบบสมาชิกของเบอร์นั้นแต่ขอใช้เครดิต → MEMBER_REQUIRED (A-26) | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CREDIT-03.gif) | [mp4](videos/TC-CREDIT-03.mp4) |
| TC-CREDIT-04 | แนน (ขาจร) ขอใช้เครดิต → MEMBER_REQUIRED · จองด้วยเบอร์เดิมเป็นลูกค้าคนเดิม | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CREDIT-04.gif) | [mp4](videos/TC-CREDIT-04.mp4) |
| TC-SERIES-01 | จองประจำ: ต้องเป็นสมาชิก · 4–12 สัปดาห์ · ไม่ติดเพดาน 14 วัน · สัปดาห์แรกผ่าน BR-05 | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-SERIES-01.gif) | [mp4](videos/TC-SERIES-01.mp4) |
| TC-SERIES-02 | ราคาจองประจำ ส่วนลด 10% เมื่อ ≥ 8 สัปดาห์ และยอดจ่ายรวม | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-SERIES-02.gif) | [mp4](videos/TC-SERIES-02.mp4) |
| TC-SERIES-03 | สัปดาห์ที่ชน: แสดงวันที่ จองเฉพาะสัปดาห์ว่าง ส่วนลดคิดจากที่จองได้จริง | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-SERIES-03.gif) | [mp4](videos/TC-SERIES-03.mp4) |
| TC-SERIES-04 | ส่วนลดจองประจำมีเศษ → ปัดส่วนลดขึ้นเป็นบาทเต็ม (A-24) | P1 | ⏭ ข้าม | ⏭ ข้าม | ⏭ ข้าม | – | [gif](gifs/TC-SERIES-04.gif) | [mp4](videos/TC-SERIES-04.mp4) |
| TC-SERIES-05 | จองประจำ E77 + สัปดาห์ที่ตรงวันหยุด (10, 31 ธ.ค. / 5 ธ.ค.) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-SERIES-05.gif) | [mp4](videos/TC-SERIES-05.mp4) |
| TC-RENT-01 | ราคาของเช่าและจำนวนคงเหลือ | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-RENT-01.gif) | [mp4](videos/TC-RENT-01.mp4) |
| TC-RENT-02 | เช่าเกินจำนวนไม่ได้ (เอี๊ยมชุดที่ 7, บอลลูกที่ 11) | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-RENT-02.gif) | [mp4](videos/TC-RENT-02.mp4) |
| TC-RENT-03 | ของที่ยังไม่คืนจากรอบก่อนหน้า และพนักงานบันทึกคืน | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-RENT-03.gif) | [mp4](videos/TC-RENT-03.mp4) |
| TC-MEMBER-01 | สมัครสมาชิกและเข้าสู่ระบบ | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-MEMBER-01.gif) | [mp4](videos/TC-MEMBER-01.mp4) |
| TC-MEMBER-02 | ดูการจองด้วยรหัส+เบอร์ · ข้อมูลผูกเบอร์ ชื่อเก็บต่อการจอง · เห็นเฉพาะของตัวเอง | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-MEMBER-02.gif) | [mp4](videos/TC-MEMBER-02.mp4) |
| TC-MEMBER-03 | ชั่วโมงสะสม 9/10 ได้สิทธิ์ฟรี และใช้สิทธิ์แล้วยอด ฿0 ยืนยันทันที | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-MEMBER-03.gif) | [mp4](videos/TC-MEMBER-03.mp4) |
| TC-MEMBER-04 | เงื่อนไขการใช้ชั่วโมงฟรี (จ.–ศ. ก่อน 17:00 เฉพาะสมาชิกที่มีสิทธิ์) | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-MEMBER-04.gif) | [mp4](videos/TC-MEMBER-04.mp4) |
| TC-MEMBER-05 | ช่องชั่วโมงฟรีปิด (disabled) พร้อมเหตุผล เมื่อรอบใช้สิทธิ์ไม่ได้หรือไม่มีสิทธิ์ (Q-T5) | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-MEMBER-05.gif) | [mp4](videos/TC-MEMBER-05.mp4) |
| TC-MEMBER-06 | ชั่วโมงสะสมของลูกค้าใน TEST-DATA: ต้น 7 · ฟ้า 9 · มิว 10 | P1 | ✅ ผ่าน | ❌ ล้ม | ✅ ผ่าน | – | [gif](gifs/TC-MEMBER-06.gif) | [mp4](videos/TC-MEMBER-06.mp4) |
| TC-MEMBER-07 | บีม (ถูกระงับถึง 6 พ.ย. 19:15) เห็นประกาศระงับ และจองออนไลน์ไม่ได้ | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-MEMBER-07.gif) | [mp4](videos/TC-MEMBER-07.mp4) |
| TC-MEMBER-08 | สิทธิ์ฟรีที่ 19 และ 20 ชั่วโมง (E87, E88) | P2 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-MEMBER-08.gif) | [mp4](videos/TC-MEMBER-08.mp4) |
| TC-TEAM-01 | ลิงก์หารค่าสนาม ยอดต่อคน (ปัดขึ้น) และสถานะจ่ายรายคน | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-TEAM-01.gif) | [mp4](videos/TC-TEAM-01.mp4) |
| TC-TEAM-02 | ประกาศหาคู่แข่ง → ทีมอื่นรับ จ่ายครึ่งค่าสนาม → เครดิตเข้าเจ้าของ และยกเลิกไม่ได้ | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-TEAM-02.gif) | [mp4](videos/TC-TEAM-02.mp4) |
| TC-TEAM-03 | คำแสดงระดับทีม มือใหม่ / กลาง / เก่ง และกรองตามระดับ | P3 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-TEAM-03.gif) | [mp4](videos/TC-TEAM-03.mp4) |
| TC-TEAM-04 | ทีมรับคำท้าไม่จ่ายใน 15 นาที → ประกาศกลับเป็น OPEN | P2 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-TEAM-04.gif) | [mp4](videos/TC-TEAM-04.mp4) |
| TC-TEAM-05 | ทีมรับคำท้าจ่ายที่ครบ 15 นาทีพอดี → ทัน (MATCHED) · 15 นาที 1 วินาที → ไม่ทัน (A-23) | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-TEAM-05.gif) | [mp4](videos/TC-TEAM-05.mp4) |
| TC-TEAM-06 | สร้างลิงก์หารซ้ำได้ลิงก์เดิม จำนวนคนเดิม สถานะจ่ายไม่ถูกล้าง (1 การจอง 1 ลิงก์) | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-TEAM-06.gif) | [mp4](videos/TC-TEAM-06.mp4) |
| TC-TEAM-07 | หน้าลิงก์หาร split-people และ split-paid-count มี data-value เป็นจำนวน | P3 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-TEAM-07.gif) | [mp4](videos/TC-TEAM-07.mp4) |
| TC-TEAM-08 | ทีมรับคำท้าจ่ายที่ 14:59 (E105) และ 15:00 (E106) → MATCHED เจ้าของได้ ฿900 | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-TEAM-08.gif) | [mp4](videos/TC-TEAM-08.mp4) |
| TC-STAFF-01 | พนักงานค้นรหัส เห็นยอดเก็บหน้าสนาม และกดเก็บเงิน/เช็กอิน | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-STAFF-01.gif) | [mp4](videos/TC-STAFF-01.mp4) |
| TC-STAFF-02 | กด "ไม่มา" ได้เมื่อเลยเวลาเริ่ม ≥ 15 นาที (14 ไม่ได้ / 15 ได้) และไม่มาครั้งแรกยังจองได้ | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STAFF-02.gif) | [mp4](videos/TC-STAFF-02.mp4) |
| TC-STAFF-03 | ไม่มาครั้งที่ 2 ห่างครั้งแรก 30 วัน → ระงับ 30 วัน จองออนไลน์ไม่ได้ | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STAFF-03.gif) | [mp4](videos/TC-STAFF-03.mp4) |
| TC-STAFF-04 | ไม่มาครั้งที่ 2 ห่างครั้งแรก 31 วัน → ไม่ระงับ | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STAFF-04.gif) | [mp4](videos/TC-STAFF-04.mp4) |
| TC-STAFF-05 | สิทธิ์ตามบทบาทฝั่งร้าน และภาพรวมวันนี้ของผู้จัดการ | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-STAFF-05.gif) | [mp4](videos/TC-STAFF-05.mp4) |
| TC-STAFF-06 | เช็กอินการจองที่ยังไม่ถึงวันเตะ → ไม่ได้ (A-45) | P2 | ❌ ล้ม | ❌ ล้ม | ❌ ล้ม | – | [gif](gifs/TC-STAFF-06.gif) | [mp4](videos/TC-STAFF-06.mp4) |
| TC-STAFF-07 | ไม่มาครั้งที่ 2 ห่าง 29 วัน (E60) ระงับ · กดไม่มาเลย 16 นาที (E66) ได้ | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-STAFF-07.gif) | [mp4](videos/TC-STAFF-07.mp4) |
| TC-OWNER-01 | เจ้าของเพิ่ม/ลบวันหยุด มีผลกับราคา | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-OWNER-01.gif) | [mp4](videos/TC-OWNER-01.mp4) |
| TC-OWNER-02 | ปิดสนามเพราะฝน: เฉพาะ A/B · คืนเครดิต · ไม่แตะการจองนอกช่วง | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-OWNER-02.gif) | [mp4](videos/TC-OWNER-02.mp4) |
| TC-OWNER-03 | ปิดเพราะฝนการจองที่คำท้า MATCHED: ทีมได้คืนเท่าที่จ่าย เจ้าของได้ จ่าย + เครดิตที่ใช้ − เครดิตจากคำท้า (A-27) | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-OWNER-03.gif) | [mp4](videos/TC-OWNER-03.mp4) |
| TC-OWNER-04 | ปิดฝนตาม TEST-DATA: A 18–20 (LN-900001 ทับ) · B · A 17–19 · C | P1 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-OWNER-04.gif) | [mp4](videos/TC-OWNER-04.mp4) |
| TC-I18N-01 | สลับภาษา ไทย/English และจำภาษาเมื่อเปลี่ยนหน้า | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-I18N-01.gif) | [mp4](videos/TC-I18N-01.mp4) |
| TC-I18N-02 | โหมด English หน้าฝั่งลูกค้าไม่มีภาษาไทยหลง | P3 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-I18N-02.gif) | [mp4](videos/TC-I18N-02.mp4) |
| TC-MOB-01 | มือถือกว้าง 375 px ไม่มีแถบเลื่อนแนวนอนทุกหน้าฝั่งลูกค้า | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-MOB-01.gif) | [mp4](videos/TC-MOB-01.mp4) |
| TC-MOB-02 | แชทบนจอ 375 px ใช้ได้ ไม่มีแถบเลื่อนแนวนอน | P3 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-MOB-02.gif) | [mp4](videos/TC-MOB-02.mp4) |
| TC-API-01 | health check และข้อมูลสนาม | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | – | – |
| TC-API-02 | ไม่เข้าสู่ระบบ/บทบาทไม่พอ เรียก API และหน้าร้าน → ถูกปฏิเสธ | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-API-02.gif) | [mp4](videos/TC-API-02.mp4) |
| TC-API-03 | ตรวจค่าที่ส่งเข้า API จอง (เวลาเริ่ม/จำนวนชั่วโมง/สนาม/วันที่) | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | – | – |
| TC-API-04 | จองช่วงเดียวกันพร้อมกัน 2 คำขอ → สำเร็จ 1 รายการพอดี | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | – | – |
| TC-API-05 | คำขอเปลี่ยนข้อมูลจาก Origin อื่น → 403 | P2 | – | – | – | ✅ ผ่าน | – | – |
| TC-CHAT-01 | E109 ถามเวลาเปิด (ห้องที่ 2 ถามคำเดิมได้คำตอบเดิม NFR-15) | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-01.gif) | [mp4](videos/TC-CHAT-01.mp4) |
| TC-CHAT-02 | E110 ถามสิ่งที่ไม่มีในระบบ (ห้องอาบน้ำ) | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-02.gif) | [mp4](videos/TC-CHAT-02.mp4) |
| TC-CHAT-03 | E111 ถามส่วนลด | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-03.gif) | [mp4](videos/TC-CHAT-03.mp4) |
| TC-CHAT-04 | E112 ราคา C เสาร์ 10 ต.ค. 18:00 (รอบถูกจองแล้ว) | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-04.gif) | [mp4](videos/TC-CHAT-04.mp4) |
| TC-CHAT-05 | E113 ราคา A ศุกร์ 16 ต.ค. 16:00 | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-05.gif) | [mp4](videos/TC-CHAT-05.mp4) |
| TC-CHAT-06 | E114 วันนี้ 19:00 สนาม A ว่างไหม → ไม่ว่าง + เสนอรอบที่ว่างจริง | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-06.gif) | [mp4](videos/TC-CHAT-06.mp4) |
| TC-CHAT-07 | E115 จองในแชทครบ 7 อย่าง → การ์ด → ติ๊กยินยอม → ยืนยัน → รหัส + ลิงก์จ่าย | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-07.gif) | [mp4](videos/TC-CHAT-07.mp4) |
| TC-CHAT-08 | E116 ข้อมูลไม่ครบ (ไม่ให้เบอร์) → ถามเบอร์ ไม่สร้างการจอง | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-08.gif) | [mp4](videos/TC-CHAT-08.mp4) |
| TC-CHAT-09 | E117 ข้อมูลครบแต่ไม่ยินยอม → ไม่สร้าง | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-09.gif) | [mp4](videos/TC-CHAT-09.mp4) |
| TC-CHAT-10 | การ์ดยืนยัน (A-34): ไม่ติ๊กกดไม่ได้ · ติ๊กแล้วกดยืนยัน 2 ครั้ง → การจอง 1 | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-10.gif) | [mp4](videos/TC-CHAT-10.mp4) |
| TC-CHAT-11 | E118 ขอให้บอทยกเลิก LN-900004 → แนะนำ "การจองของฉัน" ไม่ยกเลิกให้ | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-11.gif) | [mp4](videos/TC-CHAT-11.mp4) |
| TC-CHAT-12 | E119 ถามผลบอล (นอกเรื่อง) → ปฏิเสธสุภาพ ชวนกลับเรื่องสนาม | P3 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-12.gif) | [mp4](videos/TC-CHAT-12.mp4) |
| TC-CHAT-13 | E120 สั่งให้ข้ามกฎลดราคา C เหลือ 100 → ไม่ลด บอกราคาจริง | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-13.gif) | [mp4](videos/TC-CHAT-13.mp4) |
| TC-CHAT-14 | ถามต่อเนื่อง: "ช่วงไหนถูกสุด" → "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ" (US-39 น้องมิว) | P2 | ❌ ล้ม | ❌ ล้ม | ❌ ล้ม | – | [gif](gifs/TC-CHAT-14.gif) | [mp4](videos/TC-CHAT-14.mp4) |
| TC-CHAT-15 | ถามต่อเนื่อง: "วันนี้ 19:00 สนาม A ว่างไหม" → "งั้นสนาม B ล่ะ" | P2 | ❌ ล้ม | ❌ ล้ม | ❌ ล้ม | – | [gif](gifs/TC-CHAT-15.gif) | [mp4](videos/TC-CHAT-15.mp4) |
| TC-CHAT-16 | ถามต่อเนื่องภาษาอังกฤษ (Mr. Daniel): covered? → Saturday night price | P2 | ❌ ล้ม | ❌ ล้ม | ❌ ล้ม | – | [gif](gifs/TC-CHAT-16.gif) | [mp4](videos/TC-CHAT-16.mp4) |
| TC-CHAT-17 | ขอเช่าเอี๊ยม / ใช้เครดิตผ่านบอท → แนะนำหน้าเว็บ ไม่สร้างการจอง | P2 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-17.gif) | [mp4](videos/TC-CHAT-17.mp4) |
| TC-CHAT-18 | บีม (ถูกระงับ) จองผ่านบอท → ข้อความเดียวกับหน้าเว็บ ไม่สร้าง | P1 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-18.gif) | [mp4](videos/TC-CHAT-18.mp4) |
| TC-CHAT-19 | ข้อจำกัดข้อความ: ว่าง · 500 · 501 · เกิน 20 ข้อความ/นาที | P3 | ✅ ผ่าน | ✅ ผ่าน | ✅ ผ่าน | – | [gif](gifs/TC-CHAT-19.gif) | [mp4](videos/TC-CHAT-19.mp4) |
| TC-CHAT-20 | หลังบ้านเห็นประวัติแชท (เบอร์ปิดบางส่วน) และลบชื่อ/เบอร์เมื่อเกิน 90 วัน | P2 | – | – | – | ✅ ผ่าน | [gif](gifs/TC-CHAT-20.gif) | [mp4](videos/TC-CHAT-20.mp4) |

หลักฐาน: GIF 138 ไฟล์ · MP4 138 ไฟล์ (จาก `npm run test:gif` = Chromium + serial + perf-chromium) · ไม่มีวิดีโอ: TC-DATA-02, TC-DATA-03, TC-API-01, TC-API-03, TC-API-04, TC-API-05 (เรียก API อย่างเดียว ไม่เปิดหน้าเว็บ หรือข้ามเพราะทดสอบไม่ได้)

## 4. ข้อบกพร่อง (Defects)

### DEF-001 · TC-DASH-01 แดชบอร์ดจาก seed (TEST-DATA 5.4) เทียบ SQL

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P1** |
| จัดเป็น | (ยังไม่ได้วิเคราะห์) |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | dash-today-total 40 (dash-today-booking-money 0 · dash-today-sales 40 · dash-today-credit 0) · dash-week-total 7,300 · แท่ง 3–9 ต.ค. = 600 / 0 / 600 / 1,200 / 0 / 4,860 / 40 · dash-util-A 13 · B 0 · C 0 · dash-low-stock 0 · ตรงกับ SQL ทุกค่า |
| ผลจริง | dash-today-total ต้องเป็น 40 · คาดหวัง 40 · แต่ได้จริง 0 |
| หลักฐาน | [GIF](gifs/TC-DASH-01.gif) · [MP4](videos/TC-DASH-01.mp4) · [screenshot serial](../test-results/v2.serial-TC-DASH-01-แดชบอ-f599b-eed-TEST-DATA-5-4-เทียบ-SQL-serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-DASH-01-แดชบอ-f599b-eed-TEST-DATA-5-4-เทียบ-SQL-serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. owner เปิดแดชบอร์ดวันนี้ 9 ต.ค. ❌
2. [E sql:money_by_day] ทุกวัน 3–9 ต.ค. และ [E sql:util_today] A 2 ชม. → 13%

### DEF-002 · TC-DASH-02 ยอดวันนี้อัปเดตหลังรับเงิน · เครดิตแสดงแยก ไม่นับเป็นรายได้ (A-37)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P1** |
| จัดเป็น | (ยังไม่ได้วิเคราะห์) |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | จอง A จ 12 09 จ่าย ฿400 · ต้นจอง A พ 14 16–18 ใช้เครดิต ฿1,200 จ่าย ฿400 · staff ขายน้ำ 2 เงินสด ฿20 → dash-today-booking-money 800 · dash-today-sales 60 · dash-today-total 860 · dash-today-credit 1,200 (แยก ไม่รวมใน 860) · แท่ง 9 ต.ค. 860 · dash-week-total 8,120 · รีโหลดแล้วเท่าเดิม · SQL 9 ต.ค. = 860 |
| ผลจริง | sales ครั้งแรก ต้องเป็น 60 · คาดหวัง 60 · แต่ได้จริง 0 |
| หลักฐาน | [GIF](gifs/TC-DASH-02.gif) · [MP4](videos/TC-DASH-02.mp4) · [screenshot serial](../test-results/v2.serial-TC-DASH-02-ยอดวั-75157-งแยก-ไม่นับเป็นรายได้-A-37--serial/test-failed-2.png) · [screenshot serial](../test-results/v2.serial-TC-DASH-02-ยอดวั-75157-งแยก-ไม่นับเป็นรายได้-A-37--serial/test-failed-4.png) · [screenshot serial](../test-results/v2.serial-TC-DASH-02-ยอดวั-75157-งแยก-ไม่นับเป็นรายได้-A-37--serial/test-failed-1.png) · [screenshot serial](../test-results/v2.serial-TC-DASH-02-ยอดวั-75157-งแยก-ไม่นับเป็นรายได้-A-37--serial/test-failed-3.png) · [trace serial](../test-results/v2.serial-TC-DASH-02-ยอดวั-75157-งแยก-ไม่นับเป็นรายได้-A-37--serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. ลูกค้าจอง A จ 12 09:00 ผ่านฟอร์ม จ่าย ฿400
2. ต้นจอง A พ 14 16:00 × 2 ใช้เครดิต ฿1,200 จ่าย ฿400
3. staff ขายน้ำ 2 เงินสด ฿20
4. owner แดชบอร์ด อ่าน → รีโหลดอ่านซ้ำ ❌

### DEF-003 · TC-DATA-01 staff กดไม่มา LN-900001 ตอน 19:15 → ประวัติ (ชื่อพนักงาน A-44) + AuditLog (E146)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | **เว็บผิด** — ร้านตอบ A-44: ประวัติต้องแสดงชื่อพนักงาน "น้องบอล" — เว็บแสดง username "staff" (LN-900001 แถวล่าสุด และ LN-900008 แถวที่ 3) · ข้อความไม่มา เวลา 19:15 และ audit NO_SHOW ถูกต้อง |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | clock 19:15 staff /staff?code=LN-900001 กดไม่มา → "บันทึกไม่มาแล้ว" · owner /owner/bookings/LN-900001 แถวล่าสุด ยืนยันแล้ว → ไม่มา ผู้ทำ "น้องบอล" (ชื่อพนักงาน A-44) เวลา 9 ต.ค. 2026 19:15 · /owner/audit NO_SHOW ผู้ใช้ staff target LN-900001 · LN-900008 มี 3 แถว (ลูกค้า, ลูกค้า, น้องบอล) |
| ผลจริง | ผู้ทำ = ชื่อพนักงาน (A-44) · ตรวจที่ getByTestId('history-actor-2') · คาดหวัง "น้องบอล" · แต่ได้จริง "staff" |
| หลักฐาน | [GIF](gifs/TC-DATA-01.gif) · [MP4](videos/TC-DATA-01.mp4) · [screenshot serial](../test-results/v2.serial-TC-DATA-01-staff-f347a-พนักงาน-A-44-AuditLog-E146--serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-DATA-01-staff-f347a-พนักงาน-A-44-AuditLog-E146--serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. clock 19:15 staff ค้น LN-900001 กดไม่มา
2. owner ประวัติ LN-900001: แถวล่าสุด CONFIRMED → NO_SHOW ผู้ทำ "น้องบอล" เวลา 9 ต.ค. 2026 19:15 ❌
3. /owner/audit มี NO_SHOW ของ staff target LN-900001
4. LN-900008 ประวัติ 3 แถว ผู้ทำ ลูกค้า, ลูกค้า, น้องบอล ❌

### DEF-004 · TC-REPORT-01 ช่วงวันรายงาน E140–E142 (+ 30 พ.ย. → 28 ก.พ. A-46)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | **เว็บผิด** — E140–E142 ผ่าน แต่ร้านตอบ A-46: 30 พ.ย. → 28 ก.พ. ต้องดูได้ — เว็บตอบ "ดูรายงานได้ครั้งละไม่เกิน 3 เดือน" |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | E140 1 ต.ค.–31 ธ.ค. → report-table data-count 92 · E141 1 ต.ค.–1 ม.ค. → "ดูรายงานได้ครั้งละไม่เกิน 3 เดือน" · E142 10 → 9 ต.ค. → "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" · [A-46] 30 พ.ย. 2026 → 28 ก.พ. 2027 แสดงรายงาน 91 วัน |
| ผลจริง | 30 พ.ย. → 28 ก.พ. ต้องไม่มี error (A-46) · ตรวจที่ getByTestId('report-table') · คาดหวัง "" · แต่ได้จริง "ดูรายงานได้ครั้งละไม่เกิน 3 เดือน" |
| หลักฐาน | [GIF](gifs/TC-REPORT-01.gif) · [MP4](videos/TC-REPORT-01.mp4) · [screenshot serial](../test-results/v2.serial-TC-REPORT-01-ช่ว-4dd4b-–E142-30-พ-ย-→-28-ก-พ-A-46--serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-REPORT-01-ช่ว-4dd4b-–E142-30-พ-ย-→-28-ก-พ-A-46--serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. E140 2026-10-01 → 2026-12-31 → 92 วัน
2. E141 2026-10-01 → 2027-01-01 → เกิน 3 เดือน
3. E142 2026-10-10 → 2026-10-09 → วันสิ้นสุดก่อนวันเริ่ม
4. [A-46] 2026-11-30 → 2027-02-28 ดูได้ (91 วัน) ❌

### DEF-005 · TC-REPORT-02 รายงาน 8–8 ต.ค. (E144) เทียบ SQL

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P1** |
| จัดเป็น | (ยังไม่ได้วิเคราะห์) |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | report-2026-10-08-booking 4,800 · -cash 0 · -promptpay 60 · -total 4,860 · -credit 0 · -bookings 0 · -noshow 0 · SQL 8 ต.ค. = 4,860 |
| ผลจริง | report-2026-10-08-promptpay ต้องเป็น 60 · คาดหวัง 60 · แต่ได้จริง 0 |
| หลักฐาน | [GIF](gifs/TC-REPORT-02.gif) · [MP4](videos/TC-REPORT-02.mp4) · [screenshot serial](../test-results/v2.serial-TC-REPORT-02-รายงาน-8–8-ต-ค-E144-เทียบ-SQL-serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-REPORT-02-รายงาน-8–8-ต-ค-E144-เทียบ-SQL-serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. owner รายงาน 2026-10-08 → 2026-10-08 ❌
2. [E sql:money_by_day] 8 ต.ค. = 4,860

### DEF-006 · TC-REPORT-03 CSV เปิด Excel ได้ (BOM · หัวไทย · ไม่มี ฿) และบันทึก REPORT_EXPORT

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | (ยังไม่ได้วิเคราะห์) |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | owner 3–9 ต.ค. กด report-csv → ไฟล์ report-2026-10-03-2026-10-09.csv · 3 ไบต์แรก EF BB BF · หัวคอลัมน์ภาษาไทย (วันที่, ยอดจอง (บาท), …) · ไม่มีอักษร ฿ · 7 แถววัน + แถว "รวม" รวมรับเงิน 7300 · /owner/audit มี REPORT_EXPORT โดย owner |
| ผลจริง | รวมรับเงิน 7 วัน · คาดหวัง 7300 · แต่ได้จริง 7260 |
| หลักฐาน | [GIF](gifs/TC-REPORT-03.gif) · [MP4](videos/TC-REPORT-03.mp4) · [screenshot serial](../test-results/v2.serial-TC-REPORT-03-CSV-d735b-ี-฿-และบันทึก-REPORT-EXPORT-serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-REPORT-03-CSV-d735b-ี-฿-และบันทึก-REPORT-EXPORT-serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. owner รายงาน 3–9 ต.ค. กด report-csv → ดาวน์โหลดไฟล์
2. BOM EF BB BF · หัวไทย · ไม่มี ฿ · 7 วัน + "รวม" รวมรับเงิน 7300 ❌
3. /owner/audit มี REPORT_EXPORT โดย owner

### DEF-007 · TC-REPORT-04 หัวข้อที่ร้านขอในรายงาน: เงินแยก มัดจำพร้อมเพย์ / เก็บหน้าสนาม / หักเครดิต + ชั่วโมงต่อสนาม

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | **เว็บผิด** — ร้านตอบ A-41/A-42: รายงาน (หน้าเว็บ + CSV) ไม่มีคอลัมน์ "เก็บหน้าสนาม" แยกจากมัดจำพร้อมเพย์ (มีแค่ "ยอดจอง" ฿7,200 = 6,600 + 600 รวมกัน) และไม่มีชั่วโมง/% ต่อสนาม — ตรงกับ ⚠️ ใน TEST-RUN-1 · ส่วนอื่น (เครดิต 0, ขาย 100, ส่วนลด/ของเช่า/ชั่วโมงฟรี/สถานะ) มีครบ |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | รายงาน 3–9 ต.ค. (หน้าเว็บ + CSV) มีตัวเลขแยก: มัดจำพร้อมเพย์ของการจอง ฿6,600 · เก็บหน้าสนาม ฿600 (2 คอลัมน์ A-41) · หักเครดิต ฿0 · ชั่วโมงที่ใช้ของแต่ละสนาม ชั่วโมง + % (A-42 · ค่าตาม SQL) · จำนวนการจองแยกสถานะ · ส่วนลด · ชั่วโมงฟรี · ค่าของเช่า · ยอดขายหน้าเคาน์เตอร์ ฿100 |
| ผลจริง | หัวตารางมี "หน้าสนาม" · คาดหวัง /หน้าสนาม/ · แต่ได้จริง "วันที่ ยอดจอง ขายเงินสด ขายพร้อมเพย์ รวมรับเงิน หักเครดิต การจอง (วันเตะ) ไม่มา ส. 3 ต.ค. 2026 ฿600 ฿0 ฿0 ฿600 ฿0 1 0 อา. 4 ต.ค. 2026 ฿0 ฿0 ฿0 ฿0 ฿0 1 1 จ. 5 ต.ค. 2026 ฿600 ฿0 ฿0 ฿600 ฿0 0 0 อ. 6 ต.ค. 2026 ฿1,200 ฿0 ฿0 ฿1,200 ฿0 1 0 พ. 7 ต.ค. 2026 ฿0 ฿0 ฿0 ฿0 ฿0 1 1 พฤ. 8 ต.ค. 2026 ฿4,800 ฿0 ฿60 ฿4,860 ฿0 0 0 ศ. 9 ต.ค. 2026 ฿0 ฿0 ฿0 ฿0 ฿0 1 0 รวม ฿7,200 ฿0 ฿60 ฿7,260 ฿0 5 2" |
| หลักฐาน | [GIF](gifs/TC-REPORT-04.gif) · [MP4](videos/TC-REPORT-04.mp4) · [screenshot serial](../test-results/v2.serial-TC-REPORT-04-หัว-9c1e8-าม-หักเครดิต-ชั่วโมงต่อสนาม-serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-REPORT-04-หัว-9c1e8-าม-หักเครดิต-ชั่วโมงต่อสนาม-serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. [E sql:pay_split] PROMPTPAY ฿6,600 · CASH_AT_FIELD ฿600 (ยืนยันเฉลยกับฐานข้อมูล)
2. owner รายงาน 3–9 ต.ค. บนหน้าเว็บ: มีคอลัมน์ "เก็บหน้าสนาม" แยกจากพร้อมเพย์ (A-41) ❌
3. CSV: หัวข้อครบตามที่ร้านขอ + ค่าแถว "รวม" ❌
4. [A-42] ชั่วโมงที่ใช้ต่อสนาม (ชั่วโมง + %) ตรงกับ [E sql:hours_by_field] ❌

### DEF-008 · TC-ROLE-03 ออกจากระบบแล้ว cookie เดิมต้องใช้ไม่ได้ (สมาชิก + ร้าน)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P1** |
| จัดเป็น | **เว็บผิด** — กด logout / staff-logout บนหน้าเว็บแล้ว cookie เดิมยังได้ 200 ทั้ง /api/me และ /api/staff/bookings/LN-900004 (session ไม่ถูกยกเลิก) — ตรงกับ ⚠️ ใน TEST-RUN-MCP · P1 ความปลอดภัย |
| เบราว์เซอร์ที่ล้ม | chromium, firefox, webkit |
| ผลที่คาดหวัง | หลังกด logout / staff-logout แล้วใช้ cookie เดิมเรียก /api/me → 401 · /api/staff/bookings/LN-900004 → 401 |
| ผลจริง | cookie สมาชิกเดิมหลังออกจากระบบ GET /api/me · คาดหวัง 401 · แต่ได้จริง 200 |
| หลักฐาน | [GIF](gifs/TC-ROLE-03.gif) · [MP4](videos/TC-ROLE-03.mp4) · [screenshot chromium](../test-results/v2-ROLE-TC-ROLE-03-ออกจากร-5e6cf-มต้องใช้ไม่ได้-สมาชิก-ร้าน--chromium/test-failed-1.png) · [trace chromium](../test-results/v2-ROLE-TC-ROLE-03-ออกจากร-5e6cf-มต้องใช้ไม่ได้-สมาชิก-ร้าน--chromium/trace.zip) · [screenshot firefox](../test-results/v2-ROLE-TC-ROLE-03-ออกจากร-5e6cf-มต้องใช้ไม่ได้-สมาชิก-ร้าน--firefox/test-failed-1.png) · [trace firefox](../test-results/v2-ROLE-TC-ROLE-03-ออกจากร-5e6cf-มต้องใช้ไม่ได้-สมาชิก-ร้าน--firefox/trace.zip) · [screenshot webkit](../test-results/v2-ROLE-TC-ROLE-03-ออกจากร-5e6cf-มต้องใช้ไม่ได้-สมาชิก-ร้าน--webkit/test-failed-1.png) · [trace webkit](../test-results/v2-ROLE-TC-ROLE-03-ออกจากร-5e6cf-มต้องใช้ไม่ได้-สมาชิก-ร้าน--webkit/trace.zip) |
| ไฟล์ test | `tests/v2.spec.ts` |

ขั้นตอนทำซ้ำ:

1. สมาชิกเข้าสู่ระบบผ่านหน้าเว็บ เก็บ cookie แล้วกด logout
2. กด logout บน /my แล้วใช้ cookie เดิมเรียก /api/me → 401 ❌
3. staff เข้าสู่ระบบผ่านหน้าเว็บ เก็บ cookie กด staff-logout แล้วใช้ cookie เดิม → 401 ❌

### DEF-009 · TC-SALE-01 ขายหน้าเคาน์เตอร์ E135 และ US-42 (น้ำ 2 เงินสด)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P1** |
| จัดเป็น | (ยังไม่ได้วิเคราะห์) |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | E135 น้ำ 2 + เกลือแร่ 1 พร้อมเพย์: sale-total 40 ก่อนยืนยัน → "บันทึกการขายแล้ว ยอด ฿40" · COUNTER น้ำ 22 เกลือแร่ 11 · แดชบอร์ด dash-today-sales 80 (= 40 seed + 40) · US-42 (reset) น้ำ 2 เงินสด: ยอด ฿20 · น้ำ COUNTER 22 · ประวัติ "ขาย −2" ช่องทางเงินสด |
| ผลจริง | dash-today-sales ต้องเป็น 80 · คาดหวัง 80 · แต่ได้จริง 0 |
| หลักฐาน | [GIF](gifs/TC-SALE-01.gif) · [MP4](videos/TC-SALE-01.mp4) · [screenshot serial](../test-results/v2.serial-TC-SALE-01-ขายหน-231e3-135-และ-US-42-น้ำ-2-เงินสด--serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-SALE-01-ขายหน-231e3-135-และ-US-42-น้ำ-2-เงินสด--serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. E135 staff ขายน้ำ 2 + เกลือแร่ 1 พร้อมเพย์ → ยอดก่อนยืนยัน 40
2. /staff/stock COUNTER น้ำ 22 เกลือแร่ 11 (STORE ไม่เปลี่ยน)
3. owner แดชบอร์ด dash-today-sales 80 · รวมวันนี้ 80 · จอง 0 ❌
4. US-42 (reset) ขายน้ำ 2 เงินสด → ยอด ฿20 · COUNTER 22 · ประวัติ ขาย −2 เงินสด

### DEF-010 · TC-STOCK-03 เตือนของใกล้หมด E128–E131 + ตั้ง/ล้างจุดสั่งซื้อซ้ำ

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | (ยังไม่ได้วิเคราะห์) |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | ชำรุดน้ำ STORE 71/72/73 (รวมเหลือ 49/48/47): 49 → stock-alerts count 0 · 48 → 0 · 47 → 1 stock-alert-WATER 47 + dash-low-stock 1 · เอี๊ยมรวม 0 → ไม่เตือน · ตั้งจุด −1 → "จุดสั่งซื้อซ้ำต้องเป็นจำนวนเต็มตั้งแต่ 0 หรือเว้นว่าง" |
| ผลจริง | ตรวจที่ getByTestId('stock-alerts') · คาดหวัง "0" · แต่ได้จริง "1" |
| หลักฐาน | [GIF](gifs/TC-STOCK-03.gif) · [MP4](videos/TC-STOCK-03.mp4) · [screenshot serial](../test-results/v2.serial-TC-STOCK-03-เตือ-1b87a-131-ตั้ง-ล้างจุดสั่งซื้อซ้ำ-serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-STOCK-03-เตือ-1b87a-131-ตั้ง-ล้างจุดสั่งซื้อซ้ำ-serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. (reset) manager ชำรุดน้ำ STORE 71 → รวม 49 → stock-alerts 0
2. (reset) manager ชำรุดน้ำ STORE 72 → รวม 48 → stock-alerts 0 ❌
3. (reset) manager ชำรุดน้ำ STORE 73 → รวม 47 → stock-alerts 1
4. แดชบอร์ด dash-low-stock 1
5. เอี๊ยมชำรุด 6 (รวม 0) → ไม่เตือนเอี๊ยม (ไม่มีจุดสั่งซื้อ)
6. ตั้งจุดสั่งซื้อซ้ำ −1 → ไม่บันทึก + บอกผู้ใช้ · API ตอบข้อความ INVALID_REORDER_POINT

### DEF-011 · TC-TRACK-01 ขั้นสถานะการจองพร้อมเวลา: จองแล้ว → จ่ายแล้ว → เช็กอิน → จบ (A-43, A-45)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P3** |
| จัดเป็น | **เว็บผิด** — ร้านตอบ A-43: หลังเวลาเล่นจบต้องมีขั้น "จบ" เป็นขั้นสุดท้าย — 12 ต.ค. 09:00 timeline ยัง 3 ขั้น จบที่ CHECKED_IN · ขั้น 2 และ 3 ขั้นแรก (เวลา 9 ต.ค. 10:00 / 12 ต.ค. 07:50 ไม่มีชื่อพนักงาน) ถูกต้อง |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | จอง จ 12 A 08 จ่าย: booking-timeline data-count 2 PENDING_PAYMENT, CONFIRMED เวลา "9 ต.ค. 2026 10:00" · วันเตะ 12 ต.ค. 07:50 staff เช็กอิน → 3 ขั้น ขั้นสุดท้าย CHECKED_IN aria-current="step" ไม่มีชื่อพนักงาน · 12 ต.ค. 09:00 (เล่นจบ) → ขั้นสุดท้าย "จบ" (aria-current) ต่อจากเช็กอิน |
| ผลจริง | ขั้นทั้งหมด [{"status":"PENDING_PAYMENT","current":"","text":"รอชำระเงิน9 ต.ค. 2026 10:00"},{"status":"CONFIRMED","current":"","text":"ยืนยันแล้ว9 ต.ค. 2026 10:00"},{"status":"CHECKED_IN","current":"step","text":"เช็กอินแล้ว12 ต.ค. 2026 07:50"}] · คาดหวัง 4 · แต่ได้จริง 3 |
| หลักฐาน | [GIF](gifs/TC-TRACK-01.gif) · [MP4](videos/TC-TRACK-01.mp4) · [screenshot serial](../test-results/v2.serial-TC-TRACK-01-ขั้น-c546f-ว-→-เช็กอิน-→-จบ-A-43-A-45--serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-TRACK-01-ขั้น-c546f-ว-→-เช็กอิน-→-จบ-A-43-A-45--serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. จอง จ 12 A 08:00 จ่าย → 2 ขั้น เวลา 9 ต.ค. 2026 10:00
2. วันเตะ 12 ต.ค. 07:50 staff เช็กอิน → รีโหลด 3 ขั้น CHECKED_IN aria-current ไม่มีชื่อพนักงาน
3. [A-43] 12 ต.ค. 09:00 เวลาเล่นจบแล้ว → ขั้นสุดท้าย "จบ" ❌

### DEF-012 · TC-BOOK-04 จองล่วงหน้าได้ไม่เกิน 14 วัน (23 ต.ค. ได้ / 24 ต.ค. ไม่ได้)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P1** |
| จัดเป็น | (ยังไม่ได้วิเคราะห์) |
| เบราว์เซอร์ที่ล้ม | chromium, firefox, webkit |
| ผลที่คาดหวัง | มี date-chip-2026-10-23 ไม่มี date-chip-2026-10-24 · /book?date=2026-10-24 ช่อง out-of-range · ฟอร์ม 24 ต.ค. → "จองล่วงหน้าได้ไม่เกิน 14 วัน" · 23 ต.ค. (= 9 + 14) จองสำเร็จ → /pay |
| ผลจริง | ตรวจที่ getByTestId('date-chip-2026-10-24') · คาดหวัง 0 · แต่ได้จริง 1 |
| หลักฐาน | [GIF](gifs/TC-BOOK-04.gif) · [MP4](videos/TC-BOOK-04.mp4) · [screenshot chromium](../test-results/book-BOOK-TC-BOOK-04-จองล่-684b4-น-23-ต-ค-ได้-24-ต-ค-ไม่ได้--chromium/test-failed-1.png) · [trace chromium](../test-results/book-BOOK-TC-BOOK-04-จองล่-684b4-น-23-ต-ค-ได้-24-ต-ค-ไม่ได้--chromium/trace.zip) · [screenshot firefox](../test-results/book-BOOK-TC-BOOK-04-จองล่-684b4-น-23-ต-ค-ได้-24-ต-ค-ไม่ได้--firefox/test-failed-1.png) · [trace firefox](../test-results/book-BOOK-TC-BOOK-04-จองล่-684b4-น-23-ต-ค-ได้-24-ต-ค-ไม่ได้--firefox/trace.zip) · [screenshot webkit](../test-results/book-BOOK-TC-BOOK-04-จองล่-684b4-น-23-ต-ค-ได้-24-ต-ค-ไม่ได้--webkit/test-failed-1.png) · [trace webkit](../test-results/book-BOOK-TC-BOOK-04-จองล่-684b4-น-23-ต-ค-ได้-24-ต-ค-ไม่ได้--webkit/trace.zip) |
| ไฟล์ test | `tests/book.spec.ts` |

ขั้นตอนทำซ้ำ:

1. ปุ่มวันมีถึง 23 ต.ค. (วันนี้ + 14) ไม่มี 24 ต.ค. ❌

### DEF-013 · TC-BOOK-10 ค่าขอบเวลาตาม TEST-DATA ทุกแถว E04–E21 (วันนี้ ศ 9 10:00)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P1** |
| จัดเป็น | (ยังไม่ได้วิเคราะห์) |
| เบราว์เซอร์ที่ล้ม | serial |
| ผลที่คาดหวัง | E04 ไม่มีรอบ 07 · E05/E06 มี · E07 08:30 ไม่มี (API INVALID_START_HOUR) · E08 INVALID_HOURS · E09 ฿800 · E10 ฿1,200 × 4 = ฿4,800 · E11 ENDS_AFTER_MIDNIGHT · E12 ฿800 · E13 ฿1,200 (23 ต.ค. วันหยุด) · E14 TOO_FAR_AHEAD · E15 ได้ ฿800 · E16 TOO_SOON "ต้องจองก่อนเวลาเริ่มอย่างน้อย 1 ชั่วโมง" · E17 ได้ · E18 ได้ (ศุกร์ ≥17 FULL ฿1,200) · E19 SLOT_TAKEN "ช่วงเวลานี้ถูกจองแล้ว" · E20 ได้ · E21 ได้ |
| ผลจริง | E14 · คาดหวัง "TOO_FAR_AHEAD" · แต่ได้จริง undefined |
| หลักฐาน | [GIF](gifs/TC-BOOK-10.gif) · [MP4](videos/TC-BOOK-10.mp4) · [screenshot serial](../test-results/v2.serial-TC-BOOK-10-ค่าขอ-3db3f-ว-E04–E21-วันนี้-ศ-9-10-00--serial/test-failed-1.png) · [trace serial](../test-results/v2.serial-TC-BOOK-10-ค่าขอ-3db3f-ว-E04–E21-วันนี้-ศ-9-10-00--serial/trace.zip) |
| ไฟล์ test | `tests/v2.serial.spec.ts` |

ขั้นตอนทำซ้ำ:

1. E04–E07 ตาราง พ 14: ไม่มีรอบ 07 · มี 08, 23 · ไม่มี 24 · API 08:30 → INVALID_START_HOUR
2. E08–E11 ฟอร์ม A พ 14: 0 ชม. · 09×1 ฿800 · 20×4 ฿4,800 · 21×4 จบเกิน 24:00
3. E12–E14 ฟอร์ม 22 / 23 (วันหยุด) / 24 ต.ค. 09:00 ❌
4. E15–E21 ตารางวันนี้: A-10 past · A-11/12/18/21 free · A-19/20 booked · B-19 free · API ตามแถว
5. E19 ฟอร์มวันนี้ A 20:00 กดยืนยัน → "ช่วงเวลานี้ถูกจองแล้ว"
6. E16 clock 10:01 → ฟอร์มวันนี้ A 11:00 กดยืนยัน → TOO_SOON

### DEF-014 · TC-BOOK-11 ค้นการจองโดยไม่กรอกอะไร / ไม่กรอกเบอร์ → ข้อความบอกให้กรอก (ไม่ใช่ error ระบบ)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P3** |
| จัดเป็น | **เว็บผิด** — /my กด lookup-submit โดยไม่กรอก / กรอกแค่รหัส → "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่" แทนข้อความให้กรอก (หน้าเรียก /api/bookings/?phone= → 308 → 405) — ตรงกับ ⚠️ ใน TEST-RUN-1 · P3 |
| เบราว์เซอร์ที่ล้ม | chromium, firefox, webkit |
| ผลที่คาดหวัง | /my กด lookup-submit ทันที และใส่เฉพาะรหัส LN-900004 → error-message บอกให้กรอกรหัส/เบอร์ (ไม่ผูกคำ) · ไม่ใช่ "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่" |
| ผลจริง | ข้อความต้องบอกให้กรอก ไม่ใช่ error ระบบ · คาดหวัง not "เกิดข้อผิดพลาดในระบบ" · แต่ได้จริง "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่" |
| หลักฐาน | [GIF](gifs/TC-BOOK-11.gif) · [MP4](videos/TC-BOOK-11.mp4) · [screenshot chromium](../test-results/v2-BOOK-v2-TC-BOOK-11-ค้นก-491cf-กให้กรอก-ไม่ใช่-error-ระบบ--chromium/test-failed-1.png) · [trace chromium](../test-results/v2-BOOK-v2-TC-BOOK-11-ค้นก-491cf-กให้กรอก-ไม่ใช่-error-ระบบ--chromium/trace.zip) · [screenshot firefox](../test-results/v2-BOOK-v2-TC-BOOK-11-ค้นก-491cf-กให้กรอก-ไม่ใช่-error-ระบบ--firefox/test-failed-1.png) · [trace firefox](../test-results/v2-BOOK-v2-TC-BOOK-11-ค้นก-491cf-กให้กรอก-ไม่ใช่-error-ระบบ--firefox/trace.zip) · [screenshot webkit](../test-results/v2-BOOK-v2-TC-BOOK-11-ค้นก-491cf-กให้กรอก-ไม่ใช่-error-ระบบ--webkit/test-failed-1.png) · [trace webkit](../test-results/v2-BOOK-v2-TC-BOOK-11-ค้นก-491cf-กให้กรอก-ไม่ใช่-error-ระบบ--webkit/trace.zip) |
| ไฟล์ test | `tests/v2.spec.ts` |

ขั้นตอนทำซ้ำ:

1. เปิด /my กด lookup-submit ทันที (ช่องว่าง) ❌
2. ใส่เฉพาะรหัส LN-900004 (ไม่มีเบอร์) กด lookup-submit

### DEF-015 · TC-MEMBER-06 ชั่วโมงสะสมของลูกค้าใน TEST-DATA: ต้น 7 · ฟ้า 9 · มิว 10

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P1** |
| จัดเป็น | **flaky (ไม่ใช่บั๊กเว็บ)** — B-3 รอบ 1 ล้มเฉพาะ Firefox: ค่าของต้นรอบแรก (7/0/3) ตรงเฉลยทุกตัว แต่ page.reload() ได้ NS_BINDING_ABORTED (Firefox ยกเลิกการรีโหลดเพราะหน้ายังโหลด/นำทางหลังเข้าสู่ระบบค้างอยู่) ไม่มี expect ใดล้ม · รอบ 2 ผ่านทุกเบราว์เซอร์ · ไม่แก้ test ในรอบนี้ (ข้อเสนอ: รอ page.waitForLoadState("load") ก่อน reload) |
| เบราว์เซอร์ที่ล้ม | firefox |
| ผลที่คาดหวัง | ต้น paid-hours 7 free-hours-available 0 free-hours-next 3 · ฟ้า 9 / 0 / 1 · มิว 10 / 1 / 10 · รีโหลดแล้วเท่าเดิม |
| ผลจริง | Error: page.reload: NS_BINDING_ABORTED |
| หลักฐาน | [GIF](gifs/TC-MEMBER-06.gif) · [MP4](videos/TC-MEMBER-06.mp4) · [screenshot firefox](../test-results/v2-MEMBER-v2-TC-MEMBER-06--8f947-DATA-ต้น-7-·-ฟ้า-9-·-มิว-10-firefox/test-failed-1.png) · [trace firefox](../test-results/v2-MEMBER-v2-TC-MEMBER-06--8f947-DATA-ต้น-7-·-ฟ้า-9-·-มิว-10-firefox/trace.zip) |
| ไฟล์ test | `tests/v2.spec.ts` |

ขั้นตอนทำซ้ำ:

1. ต้น เข้าสู่ระบบ /my → 7 / 0 / 3 (และหลังรีโหลด)
2. ฟ้า เข้าสู่ระบบ /my → 9 / 0 / 1 (และหลังรีโหลด) ❌

### DEF-016 · TC-STAFF-06 เช็กอินการจองที่ยังไม่ถึงวันเตะ → ไม่ได้ (A-45)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | **เว็บผิด** — ร้านตอบ A-45 เช็กอินได้เฉพาะวันเตะ แต่เว็บให้เช็กอินการจอง 20 ต.ค. ได้ตั้งแต่ 9 ต.ค. ("เก็บเงินและเช็กอินแล้ว" CHECKED_IN) และ paid-hours เพิ่มเป็น 3 ก่อนเล่น — ตรงกับ ⚠️ ใน TEST-RUN-1 |
| เบราว์เซอร์ที่ล้ม | chromium, firefox, webkit |
| ผลที่คาดหวัง | วันนี้ ศ 9 · สมาชิกใหม่จอง อ 20 B 10–13 จ่าย · staff กด staff-checkin → ถูกปฏิเสธ (error-message) สถานะยัง CONFIRMED · /my paid-hours ยัง 0 (ไม่เพิ่ม 3) |
| ผลจริง | ผลการกดเช็กอินก่อนวันเตะ: "เก็บเงินและเช็กอินแล้ว" · ตรวจที่ getByTestId('staff-booking-status') · คาดหวัง "error" · แต่ได้จริง "success" |
| หลักฐาน | [GIF](gifs/TC-STAFF-06.gif) · [MP4](videos/TC-STAFF-06.mp4) · [screenshot chromium](../test-results/v2-STAFF-v2-TC-STAFF-06-เช-3c555-ไม่ถึงวันเตะ-→-ไม่ได้-A-45--chromium/test-failed-1.png) · [trace chromium](../test-results/v2-STAFF-v2-TC-STAFF-06-เช-3c555-ไม่ถึงวันเตะ-→-ไม่ได้-A-45--chromium/trace.zip) · [screenshot firefox](../test-results/v2-STAFF-v2-TC-STAFF-06-เช-3c555-ไม่ถึงวันเตะ-→-ไม่ได้-A-45--firefox/test-failed-1.png) · [trace firefox](../test-results/v2-STAFF-v2-TC-STAFF-06-เช-3c555-ไม่ถึงวันเตะ-→-ไม่ได้-A-45--firefox/trace.zip) · [screenshot webkit](../test-results/v2-STAFF-v2-TC-STAFF-06-เช-3c555-ไม่ถึงวันเตะ-→-ไม่ได้-A-45--webkit/test-failed-1.png) · [trace webkit](../test-results/v2-STAFF-v2-TC-STAFF-06-เช-3c555-ไม่ถึงวันเตะ-→-ไม่ได้-A-45--webkit/trace.zip) |
| ไฟล์ test | `tests/v2.spec.ts` |

ขั้นตอนทำซ้ำ:

1. สมาชิกใหม่จอง B 2026-10-20 10:00–13:00 แล้วจ่าย
2. staff ค้นรหัสแล้วกด staff-checkin (วันนี้ยังไม่ถึงวันเตะ) → ถูกปฏิเสธ ❌
3. สมาชิกเปิด /my → paid-hours ยัง 0 ❌

### DEF-017 · TC-CHAT-14 ถามต่อเนื่อง: "ช่วงไหนถูกสุด" → "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ" (US-39 น้องมิว)

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | **เว็บผิด** — บอทตอบ "ไม่มีข้อมูล" ทั้ง "ช่วงไหนถูกสุด" และ "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ" ไม่มี 800 / 1,600 ตามที่ร้านขอใน US-39 (FR-35 ใช้บทสนทนาเดิมในห้อง) — ตรงกับ ⚠️ ใน TEST-RUN-MCP |
| เบราว์เซอร์ที่ล้ม | chromium, firefox, webkit |
| ผลที่คาดหวัง | คำตอบ 1 ต้องมี "800" (5 คน ก่อน 17:00 จ–ศ) · คำตอบ 2 ต้องมี "1,600" · ห้ามมี: "ไม่มีข้อมูล" |
| ผลจริง | ต้องมี: คำตอบ 1 มี "800" — ได้จริง: ขอโทษครับ เรื่องนี้น้องบอลไม่มีข้อมูล สอบถามร้านได้ที่โทร 02-345-6789 หรือ LINE @lookhnang ครับ · คาดหวัง true · แต่ได้จริง false |
| หลักฐาน | [GIF](gifs/TC-CHAT-14.gif) · [MP4](videos/TC-CHAT-14.mp4) · [screenshot chromium](../test-results/chat-CHAT-TC-CHAT-14-ถามต่-b1ce0-2-ชั่วโมงล่ะ-US-39-น้องมิว--chromium/test-failed-1.png) · [trace chromium](../test-results/chat-CHAT-TC-CHAT-14-ถามต่-b1ce0-2-ชั่วโมงล่ะ-US-39-น้องมิว--chromium/trace.zip) · [screenshot firefox](../test-results/chat-CHAT-TC-CHAT-14-ถามต่-b1ce0-2-ชั่วโมงล่ะ-US-39-น้องมิว--firefox/test-failed-1.png) · [trace firefox](../test-results/chat-CHAT-TC-CHAT-14-ถามต่-b1ce0-2-ชั่วโมงล่ะ-US-39-น้องมิว--firefox/trace.zip) · [screenshot webkit](../test-results/chat-CHAT-TC-CHAT-14-ถามต่-b1ce0-2-ชั่วโมงล่ะ-US-39-น้องมิว--webkit/test-failed-1.png) · [trace webkit](../test-results/chat-CHAT-TC-CHAT-14-ถามต่-b1ce0-2-ชั่วโมงล่ะ-US-39-น้องมิว--webkit/trace.zip) |
| ไฟล์ test | `tests/chat.spec.ts` |

ขั้นตอนทำซ้ำ:

1. ห้องเดียวกัน: พิมพ์ "ช่วงไหนถูกสุด" แล้ว "ถ้าเอาช่วงนั้น 2 ชั่วโมงล่ะ"
2. ตรวจ คำตอบ 1 มี 800 · คำตอบ 2 มี 1,600 / ห้ามมี "ไม่มีข้อมูล" ❌

### DEF-018 · TC-CHAT-15 ถามต่อเนื่อง: "วันนี้ 19:00 สนาม A ว่างไหม" → "งั้นสนาม B ล่ะ"

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | **เว็บผิด** — ข้อความที่ 2 "งั้นสนาม B ล่ะ" ได้ "ไม่มีข้อมูล" — บอทไม่ใช้วัน/เวลา 19:00 จากข้อความแรก (FR-35) ทั้งที่ตาราง /book slot-B-19 = free — ตรงกับ ⚠️ ใน TEST-RUN-MCP |
| เบราว์เซอร์ที่ล้ม | chromium, firefox, webkit |
| ผลที่คาดหวัง | คำตอบ 1 ต้องมี "ไม่ว่าง" · คำตอบ 2 ต้องมี "สนาม B" และ "ว่าง" (B 19:00 วันนี้ free ตามตาราง) · ห้ามมี: "ไม่มีข้อมูล" |
| ผลจริง | ต้องมี: คำตอบ 2 มี "สนาม B" — ได้จริง: ขอโทษครับ เรื่องนี้น้องบอลไม่มีข้อมูล สอบถามร้านได้ที่โทร 02-345-6789 หรือ LINE @lookhnang ครับ · คาดหวัง true · แต่ได้จริง false |
| หลักฐาน | [GIF](gifs/TC-CHAT-15.gif) · [MP4](videos/TC-CHAT-15.mp4) · [screenshot chromium](../test-results/chat-CHAT-TC-CHAT-15-ถามต่-bba0f-A-ว่างไหม-→-งั้นสนาม-B-ล่ะ--chromium/test-failed-1.png) · [trace chromium](../test-results/chat-CHAT-TC-CHAT-15-ถามต่-bba0f-A-ว่างไหม-→-งั้นสนาม-B-ล่ะ--chromium/trace.zip) · [screenshot firefox](../test-results/chat-CHAT-TC-CHAT-15-ถามต่-bba0f-A-ว่างไหม-→-งั้นสนาม-B-ล่ะ--firefox/test-failed-1.png) · [trace firefox](../test-results/chat-CHAT-TC-CHAT-15-ถามต่-bba0f-A-ว่างไหม-→-งั้นสนาม-B-ล่ะ--firefox/trace.zip) · [screenshot webkit](../test-results/chat-CHAT-TC-CHAT-15-ถามต่-bba0f-A-ว่างไหม-→-งั้นสนาม-B-ล่ะ--webkit/test-failed-1.png) · [trace webkit](../test-results/chat-CHAT-TC-CHAT-15-ถามต่-bba0f-A-ว่างไหม-→-งั้นสนาม-B-ล่ะ--webkit/trace.zip) |
| ไฟล์ test | `tests/chat.spec.ts` |

ขั้นตอนทำซ้ำ:

1. ห้องเดียวกัน: พิมพ์ "วันนี้ 19:00 สนาม A ว่างไหม" แล้ว "งั้นสนาม B ล่ะ"
2. ตรวจ คำตอบ 1 "ไม่ว่าง" · คำตอบ 2 "สนาม B" + "ว่าง" / ห้ามมี "ไม่มีข้อมูล" ❌
3. เทียบกับตาราง /book วันนี้: slot-B-19 = free

### DEF-019 · TC-CHAT-16 ถามต่อเนื่องภาษาอังกฤษ (Mr. Daniel): covered? → Saturday night price

| หัวข้อ | รายละเอียด |
|---|---|
| ระดับ | **P2** |
| จัดเป็น | **เว็บผิด** — ตอบอังกฤษและบอก covered ถูก แต่ข้อความที่ 2 "How much is it on Saturday night?" ตอบราคาทุกสนาม (มี Field A/B) แทนสนาม C ที่คุยอยู่ — ไม่จำว่า "it" = สนาม C (FR-35) — ตรงกับ ⚠️ ใน TEST-RUN-MCP |
| เบราว์เซอร์ที่ล้ม | chromium, firefox, webkit |
| ผลที่คาดหวัง | คำตอบ 1 ต้องมี "covered" · คำตอบ 2 ต้องมี "1,800" และอ้างถึงสนาม C ("C") · ห้ามมี: ราคาของสนาม A/B ("Field A") เพราะคำถามอ้าง "it" = สนาม C (FR-35) · ทั้งสองไม่มีอักษรไทย |
| ผลจริง | ห้ามมี: คำตอบ 2 มี "Field A" (ตอบทุกสนามแทนสนามที่คุยอยู่) — ได้จริง: Please tell me the field, date and start time and I will check it for you. Field A: THB 800/h (starting before 17:00 Mon–Fri) and THB 1,200/h (from 17:00, weekends and holidays); Field B: THB 800/h (starting before 17:00 · คาดหวัง true · แต่ได้จริง false |
| หลักฐาน | [GIF](gifs/TC-CHAT-16.gif) · [MP4](videos/TC-CHAT-16.mp4) · [screenshot chromium](../test-results/chat-CHAT-TC-CHAT-16-ถามต่-2be3a-ered-→-Saturday-night-price-chromium/test-failed-1.png) · [trace chromium](../test-results/chat-CHAT-TC-CHAT-16-ถามต่-2be3a-ered-→-Saturday-night-price-chromium/trace.zip) · [screenshot firefox](../test-results/chat-CHAT-TC-CHAT-16-ถามต่-2be3a-ered-→-Saturday-night-price-firefox/test-failed-1.png) · [trace firefox](../test-results/chat-CHAT-TC-CHAT-16-ถามต่-2be3a-ered-→-Saturday-night-price-firefox/trace.zip) · [screenshot webkit](../test-results/chat-CHAT-TC-CHAT-16-ถามต่-2be3a-ered-→-Saturday-night-price-webkit/test-failed-1.png) · [trace webkit](../test-results/chat-CHAT-TC-CHAT-16-ถามต่-2be3a-ered-→-Saturday-night-price-webkit/trace.zip) |
| ไฟล์ test | `tests/chat.spec.ts` |

ขั้นตอนทำซ้ำ:

1. ห้องเดียวกัน: "Is pitch C covered?" แล้ว "How much is it on Saturday night?"
2. ตรวจ covered · 1,800 + C / ห้ามมี "Field A" และอักษรไทย ❌

## 4. บันทึกของ tester รอบ B-3 · แผน v2 128 TC (2026-10-20, BUG_MODE = 0, MODE = mock)

หน้าสรุปหลัก: [`e2e/index.html`](../index.html) (ดับเบิลคลิกเปิดได้ · สร้างด้วย `node build-index.mjs` หลังรัน) · เก็บแยกรอบ: [`run-1/`](run-1/) · [`run-2/`](run-2/) (results.json · run-info.json · TEST-REPORT.md · CHATBOT-REPORT.md · index.html) · ทั้ง 2 รอบตั้ง `RUN_MIGRATION_TEST=1` (หัวหน้าทีมอนุมัติ) → TC-DATA-03 ได้รัน

### 4.1 ผลตามเกณฑ์ Exit (แผน 6.4 · ตัดสินแยกทีละเบราว์เซอร์ · ไม่ได้รัน/ข้าม = ไม่ผ่าน · serial นับให้ทุกเบราว์เซอร์)

| รอบ | chromium ผ่าน · P1 | firefox ผ่าน · P1 | webkit ผ่าน · P1 | ผ่านเกณฑ์ (ต้อง P1 74/74 และ ≥ 122/128) |
|---|---|---|---|---|
| 1 | 117/128 · 72/74 | 116/128 · 71/74 | 117/128 · 72/74 | ❌ ทั้ง 3 เบราว์เซอร์ |
| 2 | 117/128 · 72/74 | 117/128 · 72/74 | 117/128 · 72/74 | ❌ ทั้ง 3 เบราว์เซอร์ |

ราย project (ผ่าน/ล้ม/ข้าม): รอบ 1 chromium 71/6/1 · firefox 70/7/1 · webkit 71/6/1 · serial 45/4/0 · perf 3/0/0 — รอบ 2 chromium 71/6/1 · firefox 71/6/1 · webkit 71/6/1 · serial 45/4/0 · perf 3/0/0

- ไม่ผ่านทุกเบราว์เซอร์ทั้ง 2 รอบ (11 TC): P1 = **TC-ROLE-03** (เว็บผิด · session ไม่ถูกยกเลิกหลัง logout) + **TC-SERIES-04** (ข้าม · ทดสอบผ่านเว็บไม่ได้ = นับไม่ผ่าน) · P2/P3 = TC-BOOK-11, TC-STAFF-06, TC-CHAT-14, TC-CHAT-15, TC-CHAT-16 (เปิดหน้าเว็บ ล้มเองทุกเบราว์เซอร์) และ TC-REPORT-01, TC-REPORT-04, TC-TRACK-01, TC-DATA-01 (serial · นับให้ทุกเบราว์เซอร์) — ทั้งหมดจำแนกเป็น "เว็บผิด" ใน `triage.json` ยกเว้น SERIES-04
- ผ่านรวม 117 ≥ 122 ไม่ถึง (ขาด 5) และ P1 ขาด 2 → **ไม่ผ่าน Exit** ตรงกับที่แผนคาดไว้ในหัวข้อ 6.4 "สถานะ ณ วันเขียนแผน"
- TC-DATA-03 (migration ซ้ำ + ถอยกลับ) **ผ่าน** ทั้ง 2 รอบ
- NFR-08 (TC-BOOK-02 รันเดี่ยว): รอบ 1 chromium 245 / firefox 526 / webkit 372 ms · รอบ 2 222 / 502 / 479 ms → ผ่าน ≤ 2,000 ms

### 4.2 ผลนิ่งไหม (รอบ 1 เทียบรอบ 2)

| TC | เบราว์เซอร์ | รอบ 1 | รอบ 2 | สาเหตุ |
|---|---|---|---|---|
| TC-MEMBER-06 (P1) | firefox | ❌ | ✅ | **flaky** — ค่าที่ตรวจตรงเฉลยทั้งหมด แต่ `page.reload()` ได้ `NS_BINDING_ABORTED` (Firefox ยกเลิกการรีโหลดเพราะการนำทางหลังเข้าสู่ระบบยังค้าง) ไม่มี expect ใดล้ม · ไม่ใช่บั๊กเว็บ · ไม่แก้ test รอบนี้ |

นอกจากข้อนี้ ผลทุก TC ทุกเบราว์เซอร์เหมือนกันทั้ง 2 รอบ

รอบ GIF (`npm run test:gif`, slowMo 650 ms, ไม่ใช้ตัดสิน · ตั้ง `RUN_MIGRATION_TEST=1` เช่นกัน): chromium + serial ผ่าน 117 ล้ม 10 ข้าม 1 · perf-chromium ผ่าน — ข้อที่ล้มชุดเดียวกับรอบปกติทุกข้อ · ได้ **GIF 138 / MP4 138** ไฟล์ ครอบ 122/128 TC (ที่ไม่มีวิดีโอ: TC-API-01, -03, -04, -05, TC-DATA-02 ยิง API อย่างเดียว · TC-DATA-03 รันสคริปต์ db) · ffmpeg แปลงครบ ไม่มีไฟล์ที่แปลงไม่สำเร็จ

### 4.3 สิ่งที่เปลี่ยนรอบนี้

- `docs/09-TEST-PLAN.md` 6.4 เพิ่มกติกานับ (หัวหน้าทีมตัดสิน): TC ที่ต้องใช้ข้อมูล seed ตรงตัว รันครั้งเดียวใน serial (Chromium) นับให้ทุกเบราว์เซอร์ — STOCK, SALE, DASH, REPORT, OWNER-04, PRICE-05/06/07, SERIES-05, ROLE-02
- `triage.json`: เพิ่ม TC-SERIES-04 (ไม่ได้รัน), TC-MEMBER-06 (flaky) · ปรับ TC-DATA-03 (รันเองในรอบเต็มแล้ว)
- ไม่ได้แก้ test หรือผลที่คาดหวังใด ๆ
- ใหม่: `plan-cases.json` (จาก `build-plan-cases.mjs`) · `index.html` (จาก `build-index.mjs` + `index.template.html`)


ตารางสรุปข้างบนคือผล **รอบที่ 2** ของ `npm test` (รอบหลัก + perf) · รอบ GIF เก็บแยก ไม่ใช้ตัดสิน · รายงานก่อนรอบนี้: [`TEST-REPORT-before-7.5b.md`](TEST-REPORT-before-7.5b.md) · รอบ 1: [`TEST-REPORT-7.5b-r1.md`](TEST-REPORT-7.5b-r1.md) · รอบ 2: [`TEST-REPORT-7.5b-r2.md`](TEST-REPORT-7.5b-r2.md)

### 5.1 ผลรัน 2 รอบ (`npm test` = รอบหลัก 3 เบราว์เซอร์ + serial แล้วตามด้วย perf รันเดี่ยว)

| รอบ | chromium ผ่าน/ล้ม/ข้าม | firefox | webkit | serial | perf (c/f/w) | ผ่านรวม | P1 ล้ม | ผ่านเกณฑ์ |
|---|---|---|---|---|---|---|---|---|
| 1 | 46 / 0 / 1 | 46 / 0 / 1 | 46 / 0 / 1 | 12 / 0 / 0 | 3 / 0 / 0 | 153/153 = 100% | 0 | ✅ |
| 2 | 46 / 0 / 1 | 45 / 1 / 1 | 46 / 0 / 1 | 12 / 0 / 0 | 3 / 0 / 0 | 152/153 = 99.3% | 0 | ✅ |

- ข้าม = TC-SERIES-04 ทุกเบราว์เซอร์ (A-24 ทดสอบผ่านหน้าเว็บไม่ได้: ราคาจริง 800/1,200/1,800 ทำให้ 10% ลงตัวเสมอ)
- ต่างกัน 1 ผล: TC-BOOK-07 Firefox รอบ 2 ล้มตอนปิด browser context (Protocol error ของ Firefox) หลังทุก step ผ่าน → **flaky** ไม่ใช่บั๊กเว็บ (อาการเดียวกับที่บันทึกใน 6.1)
- รอบ GIF (`npm run test:gif`, ไม่ใช้ตัดสิน): chromium 46 ผ่าน 1 ข้าม · perf-chromium ผ่าน · serial 11/12 — TC-STAFF-04 ทุก step ผ่านแต่ `afterEach` ที่ reset ข้อมูลได้ `read ECONNRESET` จากเว็บ 1 ครั้ง (เว็บยัง healthy, `/api/health` ok) → flaky ด้านการเชื่อมต่อ ไม่กระทบผลตัดสิน · ได้ GIF 62 / MP4 62 ไฟล์ ครบทุก TC ที่เปิดหน้าเว็บ (57 TC + คลิปผู้ใช้คนที่ 2–3 ของ TC-TEAM-02/04/05)
- NFR-08 (TC-BOOK-02 รันเดี่ยว): รอบ 1 chromium 338 / firefox 671 / webkit 493 ms · รอบ 2 chromium 242 / firefox 493 / webkit 377 ms → ผ่าน ≤ 2,000 ms ทุกเบราว์เซอร์ทั้ง 2 รอบ (รอบเฟส 7 ที่รันพร้อม 6 worker Firefox เคยได้ 2.1–2.9 วินาที)

### 5.2 test ที่แก้รอบ 7.5b

| TC | แก้อะไร | เหตุผล |
|---|---|---|
| TC-TEAM-02 | step สุดท้ายตรวจ `CHALLENGE_MATCHED` (hint, ขั้นยืนยัน, `error-message`, API 409) + เครดิตยัง 900 | ตาม SPEC 7.5 / Q-T1 (ผลที่คาดหวังเรื่องเงินและสถานะเท่าเดิม) — ไม่ใช่เพราะ test ผิด |
| TC-BOOK-02 | ย้ายจาก `book.spec.ts` ไป `book.perf.spec.ts` (project `perf-*`) โค้ด/เกณฑ์เดิม | NFR-08 นิยามใหม่ (Q-T6) |
| (config/runner) | เพิ่ม `run-all.mjs`, `PERF=1` projects, reporter แสดง perf + เวลาโหลด และเก็บผลรอบ GIF แยก | ให้ perf รันหลัง serial โดยไม่มี test อื่นพร้อมกัน · ใช้ teardown ต่อกันหลายชั้นไม่ได้ (Playwright จัดเฟสวนกัน) |

**test ที่แก้เพราะเขียนผิดในรอบนี้: ไม่มี** (TC ใหม่ 10 ข้อผ่านตั้งแต่รันครั้งแรก ไม่มีการเปลี่ยนผลที่คาดหวัง)

### 5.3 จุดที่ SPEC กับ 04

- 3 จุดเดิม (คำระดับทีม, คำอธิบายสต็อกของเช่า, code ยกเลิกเมื่อ MATCHED) SPEC 7.5 แก้ให้ตรง 04 แล้ว
- NFR-08: 04 ให้วัดใน test ที่รันเดี่ยว · SPEC 8 ข้อ 16 วัดด้วยสคริปต์ของผู้สร้าง 5 ครั้ง/เบราว์เซอร์ — ไม่ขัดตรง ๆ แต่ไม่บอกว่าตัดสินจากค่าใด (Q-T11)
- SPEC ส่วน 0 นับ BR-28 เป็นกฎที่ใช้เวลาล็อก (04 NFR-10 ไม่ระบุ) · SPEC 8 ข้อ 11 ไม่แสดงชื่อวันหยุดในโหมด EN (04 ยอมให้เป็นไทย) — SPEC ครอบคลุม/เข้มกว่า ไม่ขัด

### 5.4 ต้องถามใหม่

- **Q-T11** NFR-08 ใช้ผลวัดครั้งเดียว หรือค่าเฉลี่ย/ค่าสูงสุดของหลายครั้ง และนับการเปิดหน้าครั้งแรก (cold) ไหม — test วัดครั้งเดียว (ครั้งแรกของ context ใหม่)

## 6. บันทึกของ tester รอบก่อน 7.5b (ประวัติ — ผลในหัวข้อนี้เป็นของรอบเฟส 7 ไม่ใช่รอบนี้)

### 6.1 ผลรันซ้ำ (เทียบรอบ 1 กับรอบ 2, `npx playwright test` ครบ 3 เบราว์เซอร์ + serial)

| รอบ | chromium ผ่าน/ล้ม | firefox ผ่าน/ล้ม | webkit ผ่าน/ล้ม | serial ผ่าน/ล้ม | ผ่านรวม |
|---|---|---|---|---|---|
| 1 | 38 / 3 | 37 / 4 | 37 / 4 | 9 / 0 | 121/132 = 91.7% |
| 2 | 38 / 3 | 37 / 4 | 38 / 3 | 9 / 0 | 122/132 = 92.4% |

- ข้อที่ล้มทั้ง 2 รอบเหมือนกัน (ล้มจริงคงที่): TC-MEMBER-02, TC-TEAM-02, TC-TEAM-03 ทุกเบราว์เซอร์ · TC-BOOK-02 เฉพาะ Firefox
- ต่างกัน 1 ข้อ: TC-MEMBER-01 WebKit ล้มรอบ 1 เพราะ test (WebKit ตอบ `Frame load interrupted` ตอน goto หลังกดออกจากระบบ ซึ่ง helper `open()` ยังไม่รู้จักข้อความนี้) → แก้ test แล้วรอบ 2 ผ่าน
- flaky ที่พบระหว่างพัฒนา (ไม่ใช่บั๊กเว็บ): Firefox บางครั้ง `browserContext.close: Protocol error (Browser.removeBrowserContext)` ตอนปิด context และ `locator.fill` ค้างใต้โหลดสูง · TC-BOOK-02 (NFR-08) บน Firefox เวลาแกว่ง 1.9–2.9 วินาที และในโหมด GIF (slowMo 650 ms) Chromium ก็เกิน 2 วินาที จึงไม่ใช้ผลโหมด GIF ตัดสิน NFR-08

### 6.2 test ที่แก้เพราะเขียนผิด (ไม่ได้เปลี่ยนผลที่คาดหวัง)

| TC | ปัญหา | แก้อย่างไร |
|---|---|---|
| (config) | `serial` ใช้ `dependencies` → เมื่อมี test ในเบราว์เซอร์ล้ม Playwright ข้าม serial ทั้ง 9 ข้อ | เปลี่ยนเป็น project `setup` ที่มี `teardown: 'serial'` (serial ยังรันหลัง 3 เบราว์เซอร์จบ) |
| TC-API-03 | ใช้ A 22 ต.ค. 23:00 ซึ่ง TC-BOOK-03 จองไว้ (ข้อมูลชนกัน) → 409 | เปลี่ยนเป็น C 21 ต.ค. ที่ไม่มี test จอง · ราคา 23:00 ของ C = 1,800 ตาม BR-07 |
| TC-TEAM-01 | อ่าน `data-value` ของ `split-people` / `split-paid-count` ซึ่งเป็นจำนวนคน (SPEC บังคับ data-value เฉพาะเงิน) | ตรวจจากข้อความ 12 / 0 / 1 แทน · ค่าที่คาดหวังเท่าเดิม |
| TC-TEAM-02 | กดยกเลิกแล้วรอแค่ `error-message` → ข้อความล้มไม่บอกว่าเกิดอะไร | รอผล (error หรือ success) แล้วตรวจสถานะ ต้องเป็น CONFIRMED · ผลที่คาดหวังเท่าเดิม |
| TC-MEMBER-01 | กดออกจากระบบตอนที่ `/api/me` ที่ยิงก่อนหน้ายังไม่ตอบ หน้าเดิมแสดงชื่อค้าง | รอ `/api/customers/logout` ตอบ 200 แล้วเปิด `/my` ใหม่ ต้องเห็นฟอร์มเข้าสู่ระบบ (ข้อสังเกต: เป็น race ฝั่ง UI เล็กน้อย) |
| ทุกไฟล์ | `goto` ถูกยกเลิก (`NS_BINDING_ABORTED` / `Frame load interrupted`) และ checkbox เด้งกลับระหว่างฟอร์มคำนวณราคาใหม่ · ปุ่มใน `/split` ถูก render ใหม่ระหว่างกด | `open()` ลอง goto ซ้ำ 1 ครั้ง · `setCheckedStable()` / `clickStable()` ลองซ้ำจนสถานะติด |

### 6.3 จุดที่ SPEC ไม่ตรง/ไม่ครอบคลุม 04 (ยึด 04)

- BR-28 / A-19 กำหนดคำแสดงระดับ มือใหม่ / กลาง / เก่ง — SPEC ไม่ระบุคำ (เว็บใช้ ปานกลาง / มือโปร → DEF TC-TEAM-03)
- BR-28 / A-18 เจ้าของยกเลิกการจองที่ MATCHED ไม่ได้ — SPEC ไม่มี error code และ `cancel-booking` "แสดงเมื่อ CONFIRMED/PENDING_PAYMENT" (ไม่ยกเว้นกรณี MATCHED)
- BR-22 นับของเช่าจากการจองที่ทับเวลา + ที่ยังไม่คืนจากการจองที่จบไปแล้ว — SPEC ข้อ 6 เขียนว่านับ "ทุกสนามในวันเดียวกัน" ไม่พูดถึงเวลา (ผลจริงตรง 04: รอบ 18:00 ยังเหลือ 6)

