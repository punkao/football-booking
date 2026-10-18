-- 001 down · the baseline is never dropped (it holds every booking). Only the bookkeeping row is removed,
-- so that "001" can be applied again. Run the later .down.sql files first (005 → 002).
BEGIN;
DELETE FROM schema_migrations WHERE version = '001';
COMMIT;
