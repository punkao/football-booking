-- 004 down · removes the chat tables (chat history is lost → take a backup first). Bookings are not touched.
BEGIN;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
DROP FUNCTION IF EXISTS chat_messages_guard();
DELETE FROM schema_migrations WHERE version = '004';
COMMIT;
