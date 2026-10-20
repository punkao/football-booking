-- 02-seed.sql · test data confirmed by the shop = docs/TEST-DATA.md (every value) · fixed dates (T-18)
-- Used twice, the same file: (1) once when the volume is created (after 01-schema.sql)
--                             (2) by POST /api/test/reset (only when ALLOW_TEST_RESET=1), which then locks the clock
-- It starts by emptying every business table, so (1) and (2) give exactly the same data.
-- Plain SQL only (no psql meta-commands) so the web can run it as one script.
-- History rows are written by the trigger of 002: each step sets app.actor / app.now first.

TRUNCATE booking_status_history, audit_logs, chat_messages, chat_sessions,
         stock_movements, counter_sale_items, counter_sales, stock_levels,
         booking_rentals, split_shares, challenges, payments, credit_entries, field_closures,
         bookings, recurring_series, customers, staff_users, holidays, rental_items, fields,
         stock_items, stock_locations
  RESTART IDENTITY CASCADE;

-- ---------- section 3: fields, holidays ----------
INSERT INTO fields(id, name, size, covered, day_rate, evening_rate, photo) VALUES
  ('A', 'สนาม A', 5, false, 800, 1200, 'svg:field-A'),
  ('B', 'สนาม B', 5, false, 800, 1200, 'svg:field-B'),
  ('C', 'สนาม C', 7, true, 1200, 1800, 'svg:field-C');

-- CR-05 (008): price change by play date — A and B evening rate 1,200 -> 1,300 from 2026-11-01 (day rate and field C unchanged)
-- guarded: a reset still works while 008 is rolled back (the table is then not there)
DO $$ BEGIN
  IF to_regclass('public.field_rates') IS NOT NULL THEN
    INSERT INTO field_rates(field_id, effective_from, day_rate, evening_rate) VALUES
      ('A', '2026-11-01', 800, 1300),
      ('B', '2026-11-01', 800, 1300);
  END IF;
END $$;

INSERT INTO holidays(date, name) VALUES
  ('2026-10-13', 'วันคล้ายวันสวรรคต รัชกาลที่ 9'),
  ('2026-10-23', 'วันปิยมหาราช'),
  ('2026-12-05', 'วันพ่อแห่งชาติ'),
  ('2026-12-10', 'วันรัฐธรรมนูญ'),
  ('2026-12-31', 'วันสิ้นปี');

-- ---------- section 4: stock (quantities are AFTER the 2 counter sales of 5.2) ----------
INSERT INTO stock_locations(id, name) VALUES ('STORE', 'ห้องเก็บของ'), ('COUNTER', 'เคาน์เตอร์');
INSERT INTO stock_items(id, name, category, unit_price, reorder_point) VALUES
  ('BIB',   'เสื้อเอี๊ยม (ชุด 10 ตัว)', 'RENTAL',    50,   NULL),
  ('BALL',  'ลูกบอล',               'RENTAL',    30,   NULL),
  ('WATER', 'น้ำดื่ม 600 มล.',        'SALE',      10,   48),
  ('ORS',   'เครื่องดื่มเกลือแร่',       'SALE',      20,   24),
  ('TOWEL', 'ผ้าเย็น',               'SALE',      10,   20),
  ('CONE',  'กรวยซ้อม',             'EQUIPMENT', NULL, 20),
  ('NET',   'ตาข่ายประตูสำรอง',       'EQUIPMENT', NULL, 2),
  ('LAMP',  'หลอดไฟสนามสำรอง',      'EQUIPMENT', NULL, 6);
INSERT INTO stock_levels(item_id, location_id, qty) VALUES
  ('BIB', 'STORE', 0),    ('BIB', 'COUNTER', 6),
  ('BALL', 'STORE', 0),   ('BALL', 'COUNTER', 10),
  ('WATER', 'STORE', 96), ('WATER', 'COUNTER', 24),
  ('ORS', 'STORE', 48),   ('ORS', 'COUNTER', 12),
  ('TOWEL', 'STORE', 50), ('TOWEL', 'COUNTER', 20),
  ('CONE', 'STORE', 40),  ('CONE', 'COUNTER', 0),
  ('NET', 'STORE', 4),    ('NET', 'COUNTER', 0),
  ('LAMP', 'STORE', 12),  ('LAMP', 'COUNTER', 0);
-- v1 rental table (kept for rollback, ADR-18 / T-17): same totals as the stock above
INSERT INTO rental_items(id, name, price, stock) VALUES ('BIB', 'เอี๊ยม', 50, 6), ('BALL', 'ลูกบอล', 30, 10);

-- ---------- section 2.1: shop users (scrypt hashes of Owner1234 / Manager1234 / Staff1234) ----------
INSERT INTO staff_users(id, name, username, password_hash, role) VALUES
  (1, 'คุณเอก', 'owner', 'scrypt$e77ef2576407451bc1e4727ea82bc470$05913e6651e043dc595b8c8fac5ec72ad18562f337df30784fb26f1cd58c4dd9', 'OWNER'),
  (2, 'คุณฝ้าย', 'manager', 'scrypt$9ff7bbcea140e7da8a6dbfc3873c4fec$0ded1de71424e0a2aa2fe8beb3500d9e0bd6de752f30c1d053b794de4e12a7ef', 'MANAGER'),
  (3, 'น้องบอล', 'staff', 'scrypt$4576e66445a267beb1dc2b13d680359a$f810acabce9734447fdfd97acbf97d3a0e5a3937dcfc1e7bdef09fcbbdf285ca', 'STAFF');

-- ---------- section 2.2: customers ----------
INSERT INTO customers(id, name, phone, password_hash, credit_balance, paid_hours, free_hours_used, banned_until) VALUES
  (1, 'ต้น', '0811111111', 'scrypt$37ec3e34e478b528bf89a2a47e242c15$ce0795385220e8081032558716dfe08cf9f4d5f124b94bcae42d78d8eafafa87', 1200, 7, 0, NULL),
  (2, 'มิว', '0822222222', 'scrypt$b7781d9ef5bf264357dc27d6e27fe585$4defffb0e1b921921cb17cd4054a30c1fe99b95948b62771ad842326a64bf978', 0, 10, 0, NULL),
  (3, 'โจ้', '0833333333', 'scrypt$56f53f646a91301d0980b6f906a3f916$2507c334ae03a5798140a73095de59216b497edf07027acfcd78545857cb2238', 0, 0, 0, NULL),
  (4, 'แนน', '0844444444', NULL, 0, 0, 0, NULL),
  (5, 'ฟ้า', '0855555555', 'scrypt$065aa21cd061e9adc0dc4083a78e577c$738d8e276edffb3ce5ef0f6b3b2572b5c36ba09a8838f225af89f6d53ec9cc47', 0, 9, 0, NULL),
  (6, 'บีม', '0866666666', 'scrypt$3f9fb2870c143e0faa4b6d65135a924e$1610d336ecbace1c4e9e8310403788e8fc35e3e37d4e55fde20e0dfbaa5eb098', 0, 0, 0, '2026-11-06 19:15:00+07'),
  (7, 'ทีมเก่า', '0877777777', NULL, 0, 0, 0, NULL);
-- ต้น: credit ฿1,200 from an earlier rain closure (RAIN +1,200)
INSERT INTO credit_entries(customer_id, amount, reason, booking_id, created_at) VALUES (1, 1200, 'RAIN', NULL, '2026-09-29 10:00:00+07');

-- ---------- section 5.1: bookings + payments + status history ----------
-- every booking: created by the customer (PENDING_PAYMENT) → paid 5 minutes later (CONFIRMED) → staff action if any
-- columns: field_price = rate × hours · total = field_price · pay_now by BR-11 · due_at_field = total − pay_now

-- LN-900001 · ต้น · A · Fri 9 Oct 19:00–21:00 · ฿1,200 × 2 = ฿2,400 · Fri ≥ 17:00 → FULL_100
SELECT set_config('app.actor', 'CUSTOMER', false), set_config('app.now', '2026-10-08 19:55:00+07', false);
INSERT INTO bookings(id, code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
  rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, created_at)
VALUES (1, 'LN-900001', 1, 'ต้น', 'A', '2026-10-09', 19, 2, 'PENDING_PAYMENT', 'FULL_100', 2400, 0, 0, 0, false, 2400, 2400, 0, 0,
  '2026-10-08 20:10:00+07', '2026-10-08 19:55:00+07', 0, '2026-10-08 19:55:00+07');
SELECT set_config('app.now', '2026-10-08 20:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (1, 2400, 'PROMPTPAY', '2026-10-08 20:00:00+07');
UPDATE bookings SET status = 'CONFIRMED', amount_paid = 2400 WHERE id = 1;

-- LN-900002 · โจ้ · C · Sat 10 Oct 18:00–19:00 · ฿1,800 · Sat ≥ 17:00 → FULL_100
SELECT set_config('app.actor', 'CUSTOMER', false), set_config('app.now', '2026-10-08 20:55:00+07', false);
INSERT INTO bookings(id, code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
  rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, created_at)
VALUES (2, 'LN-900002', 3, 'โจ้', 'C', '2026-10-10', 18, 1, 'PENDING_PAYMENT', 'FULL_100', 1800, 0, 0, 0, false, 1800, 1800, 0, 0,
  '2026-10-08 21:10:00+07', '2026-10-08 20:55:00+07', 0, '2026-10-08 20:55:00+07');
SELECT set_config('app.now', '2026-10-08 21:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (2, 1800, 'PROMPTPAY', '2026-10-08 21:00:00+07');
UPDATE bookings SET status = 'CONFIRMED', amount_paid = 1800 WHERE id = 2;

-- LN-900003 · โจ้ · B · Sun 4 Oct 19:00–20:00 · ฿1,200 · deposit 50% = ฿600 · NO_SHOW recorded 19:15 by staff
SELECT set_config('app.actor', 'CUSTOMER', false), set_config('app.now', '2026-10-03 11:55:00+07', false);
INSERT INTO bookings(id, code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
  rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, created_at)
VALUES (3, 'LN-900003', 3, 'โจ้', 'B', '2026-10-04', 19, 1, 'PENDING_PAYMENT', 'DEPOSIT_50', 1200, 0, 0, 0, false, 1200, 600, 0, 600,
  '2026-10-03 12:10:00+07', '2026-10-03 11:55:00+07', 0, '2026-10-03 11:55:00+07');
SELECT set_config('app.now', '2026-10-03 12:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (3, 600, 'PROMPTPAY', '2026-10-03 12:00:00+07');
UPDATE bookings SET status = 'CONFIRMED', amount_paid = 600 WHERE id = 3;
SELECT set_config('app.actor', 'staff', false), set_config('app.now', '2026-10-04 19:15:00+07', false);
UPDATE bookings SET status = 'NO_SHOW', no_show_at = '2026-10-04 19:15:00+07' WHERE id = 3;

-- LN-900004 · แนน · B · Sun 11 Oct 09:00–10:00 · ฿1,200 (Sunday) · deposit ฿600 · ฿600 still due at the field
SELECT set_config('app.actor', 'CUSTOMER', false), set_config('app.now', '2026-10-08 17:55:00+07', false);
INSERT INTO bookings(id, code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
  rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, created_at)
VALUES (4, 'LN-900004', 4, 'แนน', 'B', '2026-10-11', 9, 1, 'PENDING_PAYMENT', 'DEPOSIT_50', 1200, 0, 0, 0, false, 1200, 600, 0, 600,
  '2026-10-08 18:10:00+07', '2026-10-08 17:55:00+07', 0, '2026-10-08 17:55:00+07');
SELECT set_config('app.now', '2026-10-08 18:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (4, 600, 'PROMPTPAY', '2026-10-08 18:00:00+07');
UPDATE bookings SET status = 'CONFIRMED', amount_paid = 600 WHERE id = 4;

-- LN-900005 · ทีมเก่า · A · Sat 3 Oct 18:00–20:00 · ฿1,200 × 2 = ฿2,400 · FULL_100 · CHECKED_IN by staff
SELECT set_config('app.actor', 'CUSTOMER', false), set_config('app.now', '2026-10-02 18:55:00+07', false);
INSERT INTO bookings(id, code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
  rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, created_at)
VALUES (5, 'LN-900005', 7, 'ทีมเก่า', 'A', '2026-10-03', 18, 2, 'PENDING_PAYMENT', 'FULL_100', 2400, 0, 0, 0, false, 2400, 2400, 0, 0,
  '2026-10-02 19:10:00+07', '2026-10-02 18:55:00+07', 0, '2026-10-02 18:55:00+07');
SELECT set_config('app.now', '2026-10-02 19:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (5, 2400, 'PROMPTPAY', '2026-10-02 19:00:00+07');
UPDATE bookings SET status = 'CONFIRMED', amount_paid = 2400 WHERE id = 5;
SELECT set_config('app.actor', 'staff', false), set_config('app.now', '2026-10-03 18:00:00+07', false);
UPDATE bookings SET status = 'CHECKED_IN', checked_in_at = '2026-10-03 18:00:00+07' WHERE id = 5;

-- LN-900006 · ทีมเก่า · B · Tue 6 Oct 19:00–20:00 · ฿1,200 · deposit ฿600 · ฿600 cash at the field at check-in
SELECT set_config('app.actor', 'CUSTOMER', false), set_config('app.now', '2026-10-05 09:55:00+07', false);
INSERT INTO bookings(id, code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
  rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, created_at)
VALUES (6, 'LN-900006', 7, 'ทีมเก่า', 'B', '2026-10-06', 19, 1, 'PENDING_PAYMENT', 'DEPOSIT_50', 1200, 0, 0, 0, false, 1200, 600, 0, 600,
  '2026-10-05 10:10:00+07', '2026-10-05 09:55:00+07', 0, '2026-10-05 09:55:00+07');
SELECT set_config('app.now', '2026-10-05 10:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (6, 600, 'PROMPTPAY', '2026-10-05 10:00:00+07');
UPDATE bookings SET status = 'CONFIRMED', amount_paid = 600 WHERE id = 6;
SELECT set_config('app.actor', 'staff', false), set_config('app.now', '2026-10-06 19:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (6, 600, 'CASH_AT_FIELD', '2026-10-06 19:00:00+07');
UPDATE bookings SET status = 'CHECKED_IN', amount_paid = 1200, due_at_field = 0, checked_in_at = '2026-10-06 19:00:00+07' WHERE id = 6;

-- LN-900007 · บีม · C · Fri 25 Sep 18:00–19:00 · ฿1,800 · Fri ≥ 17:00 → FULL_100 · NO_SHOW recorded 18:15
SELECT set_config('app.actor', 'CUSTOMER', false), set_config('app.now', '2026-09-24 11:55:00+07', false);
INSERT INTO bookings(id, code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
  rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, created_at)
VALUES (7, 'LN-900007', 6, 'บีม', 'C', '2026-09-25', 18, 1, 'PENDING_PAYMENT', 'FULL_100', 1800, 0, 0, 0, false, 1800, 1800, 0, 0,
  '2026-09-24 12:10:00+07', '2026-09-24 11:55:00+07', 0, '2026-09-24 11:55:00+07');
SELECT set_config('app.now', '2026-09-24 12:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (7, 1800, 'PROMPTPAY', '2026-09-24 12:00:00+07');
UPDATE bookings SET status = 'CONFIRMED', amount_paid = 1800 WHERE id = 7;
SELECT set_config('app.actor', 'staff', false), set_config('app.now', '2026-09-25 18:15:00+07', false);
UPDATE bookings SET status = 'NO_SHOW', no_show_at = '2026-09-25 18:15:00+07' WHERE id = 7;

-- LN-900008 · บีม · A · Wed 7 Oct 19:00–20:00 · ฿1,200 · deposit ฿600 · NO_SHOW recorded 19:15
-- (2nd no-show 12 days after the 1st → banned until 7 Oct 19:15 + 30 days = 6 Nov 19:15, set on the customer above)
SELECT set_config('app.actor', 'CUSTOMER', false), set_config('app.now', '2026-10-06 11:55:00+07', false);
INSERT INTO bookings(id, code, customer_id, customer_name, field_id, date, start_hour, hours, status, payment_plan, field_price, discount,
  rental_price, credit_used, free_hour_used, total_price, pay_now, amount_paid, due_at_field, pay_deadline, consent_at, reschedule_count, created_at)
VALUES (8, 'LN-900008', 6, 'บีม', 'A', '2026-10-07', 19, 1, 'PENDING_PAYMENT', 'DEPOSIT_50', 1200, 0, 0, 0, false, 1200, 600, 0, 600,
  '2026-10-06 12:10:00+07', '2026-10-06 11:55:00+07', 0, '2026-10-06 11:55:00+07');
SELECT set_config('app.now', '2026-10-06 12:00:00+07', false);
INSERT INTO payments(booking_id, amount, method, paid_at) VALUES (8, 600, 'PROMPTPAY', '2026-10-06 12:00:00+07');
UPDATE bookings SET status = 'CONFIRMED', amount_paid = 600 WHERE id = 8;
SELECT set_config('app.actor', 'staff', false), set_config('app.now', '2026-10-07 19:15:00+07', false);
UPDATE bookings SET status = 'NO_SHOW', no_show_at = '2026-10-07 19:15:00+07' WHERE id = 8;

-- ---------- section 5.2: counter sales by staff (stock above is already after these) ----------
INSERT INTO counter_sales(id, total_amount, method, staff_user_id, created_at) VALUES
  (1, 60, 'PROMPTPAY', 3, '2026-10-08 20:30:00+07'),
  (2, 40, 'CASH', 3, '2026-10-09 09:00:00+07');
INSERT INTO counter_sale_items(sale_id, item_id, qty, unit_price) VALUES (1, 'ORS', 3, 20), (2, 'WATER', 4, 10);
INSERT INTO stock_movements(item_id, type, qty, from_location_id, to_location_id, reason, staff_user_id, counter_sale_id, created_at) VALUES
  ('ORS', 'SALE', 3, 'COUNTER', NULL, NULL, 3, 1, '2026-10-08 20:30:00+07'),
  ('WATER', 'SALE', 4, 'COUNTER', NULL, NULL, 3, 2, '2026-10-09 09:00:00+07');

-- ---------- section 5.3: one chat room (guest, Thai) ----------
INSERT INTO chat_sessions(id, lang, customer_id, created_at, last_message_at) VALUES
  ('5d7c1e0a-8b3f-4c2e-9a61-0f4b2d8e7c11', 'th', NULL, '2026-10-08 23:10:00+07', '2026-10-08 23:10:05+07');
INSERT INTO chat_messages(session_id, role, text, booking_code, created_at) VALUES
  ('5d7c1e0a-8b3f-4c2e-9a61-0f4b2d8e7c11', 'USER', 'เปิดกี่โมงครับ', NULL, '2026-10-08 23:10:00+07'),
  ('5d7c1e0a-8b3f-4c2e-9a61-0f4b2d8e7c11', 'BOT', 'เปิดทุกวัน 08:00–24:00 ครับ', NULL, '2026-10-08 23:10:05+07');

-- ---------- sequences: ids continue after the seed · booking codes start at LN-100001 (contract 1.4) ----------
SELECT setval(pg_get_serial_sequence('staff_users', 'id'), 3);
SELECT setval(pg_get_serial_sequence('customers', 'id'), 7);
SELECT setval(pg_get_serial_sequence('bookings', 'id'), 8);
SELECT setval(pg_get_serial_sequence('counter_sales', 'id'), 2);
SELECT setval('booking_code_seq', 100001, false);

-- the actor / time above were session settings: clear them so nothing later can change a booking without its own actor
SELECT set_config('app.actor', '', false), set_config('app.now', '', false);
