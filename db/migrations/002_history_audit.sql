-- 002 · BookingStatusHistory + AuditLog (FR-45, FR-47, BR-42 · ADR-14 · T-15, T-16)
-- * every INSERT of a booking and every change of its status / date / start hour writes one history row (trigger)
-- * the actor and the time come from the transaction: SET LOCAL app.actor / app.now (ADR-04). No actor = error.
-- * history and audit rows can never be UPDATEd or DELETEd (trigger) · TRUNCATE (test reset only) is allowed
-- * the bookings that already exist get one first row (NULL → current status, actor SYSTEM), once
BEGIN;

CREATE TABLE IF NOT EXISTS booking_status_history (
  id serial PRIMARY KEY,
  booking_id int NOT NULL REFERENCES bookings(id),
  from_status text,
  to_status text NOT NULL,
  actor text NOT NULL CHECK (btrim(actor) <> ''),
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_status_history_booking ON booking_status_history(booking_id, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id serial PRIMARY KEY,
  staff_user_id int NOT NULL REFERENCES staff_users(id),
  action text NOT NULL CHECK (action IN (
    'CHECKIN', 'NO_SHOW', 'RETURN_RENTALS', 'RAIN_CLOSE', 'HOLIDAY_ADD', 'HOLIDAY_REMOVE',
    'STOCK_RECEIVE', 'STOCK_SALE', 'STOCK_TRANSFER', 'STOCK_DAMAGE', 'STOCK_ADJUST', 'REORDER_POINT', 'REPORT_EXPORT')),
  target text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at ON audit_logs(created_at);

-- history row for every new booking / status change (T-15: a reschedule is CONFIRMED → CONFIRMED)
CREATE OR REPLACE FUNCTION booking_history_log() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_actor text := NULLIF(current_setting('app.actor', true), '');
  v_now timestamptz := COALESCE(NULLIF(current_setting('app.now', true), '')::timestamptz, now());
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'app.actor is not set: every booking change needs SET LOCAL app.actor (BR-42)';
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO booking_status_history(booking_id, from_status, to_status, actor, created_at)
    VALUES (NEW.id, NULL, NEW.status, v_actor, v_now);
  ELSE
    INSERT INTO booking_status_history(booking_id, from_status, to_status, actor, created_at)
    VALUES (NEW.id, OLD.status, NEW.status, v_actor, v_now);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE TRIGGER bookings_history_insert
  AFTER INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION booking_history_log();
CREATE OR REPLACE TRIGGER bookings_history_update
  AFTER UPDATE OF status, date, start_hour ON bookings FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.date IS DISTINCT FROM NEW.date OR OLD.start_hour IS DISTINCT FROM NEW.start_hour)
  EXECUTE FUNCTION booking_history_log();

-- append-only tables (BR-42): no UPDATE, no DELETE
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed (BR-42)', TG_TABLE_NAME, TG_OP;
END $$;

CREATE OR REPLACE TRIGGER booking_status_history_readonly
  BEFORE UPDATE OR DELETE ON booking_status_history FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE OR REPLACE TRIGGER audit_logs_readonly
  BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- T-15: the bookings that existed before v2 get their first history row (runs once per booking)
INSERT INTO booking_status_history(booking_id, from_status, to_status, actor, created_at)
SELECT b.id, NULL, b.status, 'SYSTEM', b.created_at
  FROM bookings b
 WHERE NOT EXISTS (SELECT 1 FROM booking_status_history h WHERE h.booking_id = b.id)
 ORDER BY b.id;

INSERT INTO schema_migrations(version, name) VALUES ('002', 'history_audit') ON CONFLICT (version) DO NOTHING;
COMMIT;
