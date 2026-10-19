-- 006 · chat hardening (review round R2, R3)
-- * chat_messages.redacted_at: BR-45 redaction is done once per message (only rows still NULL are looked at)
-- * chat_sessions.ip_hash: HMAC of the client IP (never the IP itself, PDPA) for the per-IP limits of R2
-- Everything IF NOT EXISTS → the file can run again · 006 down removes both columns (no booking data involved)
BEGIN;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS redacted_at timestamptz;
CREATE INDEX IF NOT EXISTS chat_messages_to_redact ON chat_messages(created_at) WHERE redacted_at IS NULL;

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS ip_hash text;
CREATE INDEX IF NOT EXISTS chat_sessions_ip_created ON chat_sessions(ip_hash, created_at);

INSERT INTO schema_migrations(version, name) VALUES ('006', 'chat_hardening') ON CONFLICT (version) DO NOTHING;
COMMIT;
