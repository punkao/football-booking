-- 009 down · takes the challenge money rows out of payments again and drops the column — roll the web back to the image before CR-06 FIRST
-- (the new web writes payments.challenge_id when a team pays a challenge; the old web never does)
-- Lost: the payments rows that came from challenges (backfilled by 009 or written by the new web) → reports go back to not counting challenge money.
-- Nothing else is touched: ordinary booking payments, credit_entries, customers, bookings stay · going up again rebuilds the rows from the credit entries
SET client_min_messages = warning;
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'challenge_id') THEN
    DELETE FROM payments WHERE challenge_id IS NOT NULL;
  END IF;
END $$;
DROP INDEX IF EXISTS payments_challenge_once;
ALTER TABLE payments DROP COLUMN IF EXISTS challenge_id;
DELETE FROM schema_migrations WHERE version = '009';
COMMIT;
