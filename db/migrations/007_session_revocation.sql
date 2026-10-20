-- 007 · CR-01 logout really ends the session (docs/impact/CR-01.md)
-- * revoked_sessions: the login cookies that were logged out, as a SHA-256 hash of the signed cookie value
--   (never the cookie itself) until the time the cookie would have expired anyway — then the row can be deleted
-- * applied_at of this migration = when the update went live: cookies issued before it ({cid} / {sid} only) are
--   accepted until applied_at + their old lifetime (30 days / 12 hours) so nobody has to log in again
-- Everything IF NOT EXISTS → the file can run again · 007 down drops the table (no booking data involved)
SET client_min_messages = warning;
BEGIN;

CREATE TABLE IF NOT EXISTS revoked_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  kind text NOT NULL CHECK (kind IN ('CUSTOMER', 'STAFF')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS revoked_sessions_expires ON revoked_sessions(expires_at);

INSERT INTO schema_migrations(version, name) VALUES ('007', 'session_revocation') ON CONFLICT (version) DO NOTHING;
COMMIT;
