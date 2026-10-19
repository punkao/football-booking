-- 006 down · removes the two chat columns again (redaction marks and IP hashes are lost; messages and bookings stay)
BEGIN;
DROP INDEX IF EXISTS chat_messages_to_redact;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS redacted_at;
DROP INDEX IF EXISTS chat_sessions_ip_created;
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS ip_hash;
DELETE FROM schema_migrations WHERE version = '006';
COMMIT;
