-- 009 · CR-06 money paid by the team that accepts a challenge is booking money of the shop (docs/impact/CR-06.md)
-- * payments.challenge_id: the challenge this PromptPay payment came from (NULL = an ordinary booking payment). The row belongs to the
--   booking of the challenge owner, method PROMPTPAY, paid_at = when the accepting team paid → the report / dashboard (which read payments) count it.
-- * unique index: one challenge = one money row → running this file again, or the web writing the row after a backfill, never doubles it.
-- * backfill: every MATCHED challenge gets its row, amount and time taken from the owner's CHALLENGE credit entry (written at the same instant
--   by the old web, challenges has no paid-at column). credit_entries / customers / bookings are only read — the owner's credit is not touched.
-- Everything IF NOT EXISTS / ON CONFLICT DO NOTHING → the file can run again · 009 down removes the challenge payment rows and the column
SET client_min_messages = warning;
BEGIN;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS challenge_id int REFERENCES challenges(id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_challenge_once ON payments(challenge_id) WHERE challenge_id IS NOT NULL;

INSERT INTO payments(booking_id, amount, method, paid_at, challenge_id)
SELECT DISTINCT ON (ch.id) ch.booking_id, ce.amount, 'PROMPTPAY', ce.created_at, ch.id
  FROM challenges ch
  JOIN credit_entries ce ON ce.booking_id = ch.booking_id AND ce.reason = 'CHALLENGE' AND ce.amount = ch.amount
 WHERE ch.status = 'MATCHED' AND ce.amount > 0
 ORDER BY ch.id, ce.created_at, ce.id
ON CONFLICT (challenge_id) WHERE challenge_id IS NOT NULL DO NOTHING;

INSERT INTO schema_migrations(version, name) VALUES ('009', 'challenge_payments') ON CONFLICT (version) DO NOTHING;
COMMIT;
