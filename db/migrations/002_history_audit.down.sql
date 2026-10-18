-- 002 down · removes the history / audit triggers and tables. Bookings are not touched.
-- The rows of booking_status_history and audit_logs are lost → take a backup first (docs/RUNBOOK.md).
BEGIN;
DROP TRIGGER IF EXISTS bookings_history_insert ON bookings;
DROP TRIGGER IF EXISTS bookings_history_update ON bookings;
DROP TABLE IF EXISTS booking_status_history;
DROP TABLE IF EXISTS audit_logs;
DROP FUNCTION IF EXISTS booking_history_log();
-- forbid_change() is shared with 003 / 004: dropped only when nothing uses it any more
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid WHERE p.proname = 'forbid_change') THEN
    DROP FUNCTION IF EXISTS forbid_change();
  END IF;
END $$;
DELETE FROM schema_migrations WHERE version = '002';
COMMIT;
