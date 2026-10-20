-- 008 · CR-05 field price with an effective date (docs/impact/CR-05.md)
-- * field_rates: price CHANGES of a field — from effective_from (the date of PLAY, Asia/Bangkok) the field uses day_rate / evening_rate.
--   fields.day_rate / evening_rate stay the BASE price (used before the first change) → untouched by this migration,
--   the old web keeps pricing as before and bookings.field_price / total_price (stored when booked) are never touched.
-- * first change: A and B (5-a-side) evening rate 1,200 → 1,300 for play dates from 2026-11-01 (day rate = the field's own, unchanged); C unchanged
-- Everything IF NOT EXISTS / ON CONFLICT DO NOTHING → the file can run again · 008 down drops the table (no booking data involved)
SET client_min_messages = warning;
BEGIN;

CREATE TABLE IF NOT EXISTS field_rates (
  field_id text NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  day_rate int NOT NULL CHECK (day_rate >= 0),
  evening_rate int NOT NULL CHECK (evening_rate >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (field_id, effective_from)
);

INSERT INTO field_rates(field_id, effective_from, day_rate, evening_rate)
SELECT id, DATE '2026-11-01', day_rate, 1300 FROM fields WHERE id IN ('A', 'B')
ON CONFLICT (field_id, effective_from) DO NOTHING;

INSERT INTO schema_migrations(version, name) VALUES ('008', 'field_rates') ON CONFLICT (version) DO NOTHING;
COMMIT;
