-- CR-06 · ซ้อม migration 009 บนข้อมูลเสมือนจริง: สร้างคำท้า "ในอดีต" ตามที่ระบบก่อน CR-06 ทำ (เครดิตเข้าเจ้าของ · ไม่มีแถวเงิน)
-- ใช้หลัง  node tools/make-prod-like-data.mjs  และหลังถอย 009 (--down 009)  แล้วค่อยขึ้น 009 ดูว่าเติมแถวเงินครบ
-- ไม่แตะแถวเดิม: เพิ่ม challenges + credit_entries + บวก credit_balance เท่านั้น · deterministic (เรียงตามรหัสการจอง)
--   docker exec -i football-db psql -U football -d football -v ON_ERROR_STOP=1 < tools/cr06-old-challenges.sql
BEGIN;
CREATE TEMP TABLE pick AS
  SELECT b.id AS booking_id, b.customer_id AS owner_id, ceil((b.field_price - b.discount) * 0.5)::int AS amount,
         row_number() OVER (ORDER BY b.code) AS n,
         (SELECT min(p.paid_at) FROM payments p WHERE p.booking_id = b.id) + interval '37 minutes' AS paid_at
    FROM bookings b
   WHERE b.code LIKE 'LN-7%' AND b.status IN ('CONFIRMED', 'CHECKED_IN') AND b.field_price - b.discount > 0
     AND NOT EXISTS (SELECT 1 FROM challenges c WHERE c.booking_id = b.id);
-- 30 คำท้าที่ทีมรับจ่ายแล้ว (MATCHED) · 6 คำท้าปิด/รอ (ไม่ต้องมีแถวเงิน)
INSERT INTO challenges(booking_id, team_name, level, status, accept_customer_id, amount, pay_deadline, created_at)
SELECT booking_id, 'ทีมทดลอง ' || n,
       (ARRAY['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])[1 + n % 3],
       CASE WHEN n <= 30 THEN 'MATCHED' WHEN n <= 33 THEN 'CLOSED' WHEN n <= 35 THEN 'OPEN' ELSE 'AWAITING_PAYMENT' END,
       CASE WHEN n <= 30 OR n > 35 THEN (SELECT id FROM customers WHERE id <> owner_id ORDER BY id LIMIT 1 OFFSET (n % 5)) END,
       amount, paid_at, paid_at - interval '10 minutes'
  FROM pick WHERE n <= 36;
INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at)
SELECT owner_id, amount, 'CHALLENGE', booking_id, paid_at FROM pick WHERE n <= 30;
UPDATE customers c SET credit_balance = credit_balance + s.amt
  FROM (SELECT owner_id, sum(amount) AS amt FROM pick WHERE n <= 30 GROUP BY owner_id) s WHERE c.id = s.owner_id;
COMMIT;
