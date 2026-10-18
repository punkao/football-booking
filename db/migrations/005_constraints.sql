-- 005 · the database enforces the rules itself (NFR-19 · ADR-12)
-- * EXCLUDE: the same field cannot hold two field-blocking bookings at overlapping hours (BR-06, NFR-07)
-- * CHECK: money INTEGER >= 0 (credit_entries.amount is signed, <> 0) · statuses / methods / roles from the contract
-- * existing rows are checked first: if any row breaks a new constraint, nothing is changed and the migration stops
--   with the list (the data is never "fixed" by the migration)
-- * a constraint that already exists is skipped → the file can run again
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TEMP TABLE mig005_problems (problem text NOT NULL) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.add_check(tbl text, con text, expr text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = con) THEN RETURN; END IF;
  EXECUTE format('SELECT count(*) FROM %I WHERE NOT (%s)', tbl, expr) INTO n;
  IF n > 0 THEN
    INSERT INTO mig005_problems VALUES (format('%s: %s row(s) break %s CHECK (%s)', tbl, n, con, expr));
  ELSE
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s)', tbl, con, expr);
  END IF;
END $$;

-- fields
SELECT pg_temp.add_check('fields', 'fields_rates_check', 'day_rate >= 0 AND evening_rate >= 0');
SELECT pg_temp.add_check('fields', 'fields_size_check', 'size IN (5, 7)');
-- customers
SELECT pg_temp.add_check('customers', 'customers_credit_balance_check', 'credit_balance >= 0');
SELECT pg_temp.add_check('customers', 'customers_hours_check', 'paid_hours >= 0 AND free_hours_used >= 0');
-- bookings (contract 1.2 statuses · BR-02 / BR-03 hours · money)
SELECT pg_temp.add_check('bookings', 'bookings_status_check',
  $c$status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW', 'CANCELLED', 'EXPIRED', 'RAIN_CLOSED')$c$);
SELECT pg_temp.add_check('bookings', 'bookings_payment_plan_check', $c$payment_plan IN ('DEPOSIT_50', 'FULL_100')$c$);
SELECT pg_temp.add_check('bookings', 'bookings_hours_check', 'start_hour BETWEEN 8 AND 23 AND hours >= 1 AND start_hour + hours <= 24');
SELECT pg_temp.add_check('bookings', 'bookings_money_check',
  'field_price >= 0 AND discount >= 0 AND rental_price >= 0 AND credit_used >= 0 AND total_price >= 0 AND pay_now >= 0 AND amount_paid >= 0 AND due_at_field >= 0');
SELECT pg_temp.add_check('bookings', 'bookings_reschedule_count_check', 'reschedule_count >= 0');
-- payments
SELECT pg_temp.add_check('payments', 'payments_amount_check', 'amount > 0');
SELECT pg_temp.add_check('payments', 'payments_method_check', $c$method IN ('PROMPTPAY', 'CREDIT', 'CASH_AT_FIELD')$c$);
-- credit entries (+/− by contract)
SELECT pg_temp.add_check('credit_entries', 'credit_entries_amount_check', 'amount <> 0');
SELECT pg_temp.add_check('credit_entries', 'credit_entries_reason_check', $c$reason IN ('CANCEL', 'RAIN', 'CHALLENGE', 'RESCHEDULE', 'USED')$c$);
-- rain closures: only the open-air fields (BR-01, BR-14)
SELECT pg_temp.add_check('field_closures', 'field_closures_field_check', $c$field_id IN ('A', 'B')$c$);
SELECT pg_temp.add_check('field_closures', 'field_closures_range_check', 'from_hour >= 8 AND to_hour <= 24 AND from_hour < to_hour');
-- rentals
SELECT pg_temp.add_check('rental_items', 'rental_items_numbers_check', 'price >= 0 AND stock >= 0');
SELECT pg_temp.add_check('booking_rentals', 'booking_rentals_qty_check', 'qty >= 1 AND returned_qty >= 0 AND returned_qty <= qty');
-- recurring series (BR-18, BR-19)
SELECT pg_temp.add_check('recurring_series', 'recurring_series_weeks_check', 'weeks_requested BETWEEN 4 AND 12 AND weeks_booked >= 0 AND weeks_booked <= weeks_requested');
SELECT pg_temp.add_check('recurring_series', 'recurring_series_discount_check', 'discount_percent >= 0');
-- split / challenge / staff
SELECT pg_temp.add_check('split_shares', 'split_shares_amount_check', 'amount >= 0');
SELECT pg_temp.add_check('challenges', 'challenges_status_check', $c$status IN ('OPEN', 'AWAITING_PAYMENT', 'MATCHED', 'CLOSED')$c$);
SELECT pg_temp.add_check('challenges', 'challenges_level_check', $c$level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')$c$);
SELECT pg_temp.add_check('challenges', 'challenges_amount_check', 'amount >= 0');
SELECT pg_temp.add_check('staff_users', 'staff_users_role_check', $c$role IN ('OWNER', 'MANAGER', 'STAFF')$c$);

-- EXCLUDE (ADR-12): the 4 field-blocking statuses of contract 1.2 · [start, end) so 18–19 and 19–21 do not overlap
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN RETURN; END IF;
  FOR r IN
    SELECT a.code AS a_code, b.code AS b_code, a.field_id, a.date
      FROM bookings a JOIN bookings b
        ON a.id < b.id AND a.field_id = b.field_id AND a.date = b.date
       AND int4range(a.start_hour, a.start_hour + a.hours) && int4range(b.start_hour, b.start_hour + b.hours)
     WHERE a.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW')
       AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW')
  LOOP
    INSERT INTO mig005_problems VALUES (format('bookings: %s and %s overlap on field %s %s', r.a_code, r.b_code, r.field_id, r.date));
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM mig005_problems WHERE problem LIKE 'bookings: % overlap %') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
      field_id WITH =,
      date WITH =,
      int4range(start_hour, start_hour + hours) WITH &&
    ) WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW'));
  END IF;
END $$;

-- reports by the day money was received (BR-40)
CREATE INDEX IF NOT EXISTS payments_paid_at ON payments(paid_at);

DO $$
DECLARE msg text;
BEGIN
  SELECT string_agg(problem, E'\n' ORDER BY problem) INTO msg FROM mig005_problems;
  IF msg IS NOT NULL THEN
    RAISE EXCEPTION E'005_constraints stopped, nothing was changed. Fix these rows first:\n%', msg;
  END IF;
END $$;

INSERT INTO schema_migrations(version, name) VALUES ('005', 'constraints') ON CONFLICT (version) DO NOTHING;
COMMIT;
