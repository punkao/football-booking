-- CR-06 · กระทบยอดเงินคำท้า (ฝ่ายปฏิบัติการ · อ่านอย่างเดียว: SELECT ล้วน ไม่แก้ข้อมูล)
-- รันหลังขึ้น migration 009 (และรันซ้ำหลัง deploy ได้เมื่อไรก็ได้):
--   docker exec -i football-db psql -U football -d football -v ON_ERROR_STOP=1 -At -F ' | ' < tools/reconcile-challenges.sql
-- ผล: 2 บรรทัด  ชื่อเช็ก | จำนวน  — ทั้งสองต้องเป็น 0 (ไม่ใช่ 0 = หยุดแล้วดูรายการด้วยคำสั่งในหมายเหตุท้ายไฟล์)
-- เหตุผลที่ไม่มีเช็ก "bookings.amount_paid = ผลรวม payments": ไม่เป็น invariant ในระบบเดิม (เลื่อนไปช่องที่ถูกกว่าลด amount_paid
--   แต่ไม่ลบแถว payments · docs/impact/CR-06.md ข้อ 1.3) จึงไม่ใส่ไว้ให้แดงทั้งที่ไม่ผิด
SELECT 'a_matched_without_payment' AS check_name, count(*) AS must_be_zero
  FROM challenges ch
 WHERE ch.status = 'MATCHED' AND ch.amount > 0
   AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.challenge_id = ch.id)
UNION ALL
-- แถวเงินคำท้าที่ ไม่ใช่คำท้า MATCHED · หรือการจองไม่ใช่ของคำท้านั้น · หรือไม่มีรายการเครดิต CHALLENGE ของเจ้าของที่ จำนวน + การจอง + เวลา ตรงกันพอดี
SELECT 'b_payment_not_matching_credit', count(*)
  FROM payments p
  JOIN challenges ch ON ch.id = p.challenge_id
 WHERE ch.status <> 'MATCHED'
    OR p.booking_id <> ch.booking_id
    OR NOT EXISTS (SELECT 1 FROM credit_entries ce
                    WHERE ce.reason = 'CHALLENGE' AND ce.booking_id = p.booking_id AND ce.amount = p.amount AND ce.created_at = p.paid_at);
-- รายการที่ผิด (ดูเมื่อเช็กไม่เป็น 0):
--   a:  SELECT ch.id, ch.booking_id, ch.amount FROM challenges ch WHERE ch.status='MATCHED' AND ch.amount>0 AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.challenge_id=ch.id);
--   b:  SELECT p.id, p.challenge_id, p.booking_id, p.amount, p.paid_at FROM payments p JOIN challenges ch ON ch.id=p.challenge_id WHERE ch.status<>'MATCHED' OR p.booking_id<>ch.booking_id OR NOT EXISTS (SELECT 1 FROM credit_entries ce WHERE ce.reason='CHALLENGE' AND ce.booking_id=p.booking_id AND ce.amount=p.amount AND ce.created_at=p.paid_at);
