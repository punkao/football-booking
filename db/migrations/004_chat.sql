-- 004 · chat history (FR-35, FR-36, BR-45 · T-13)
-- * ChatSession.id is a random UUID (T-13) · ChatMessage.text is the text that was shown (tags removed)
-- * chat_messages is append-only (BR-42) with one exception: BR-45 removes names / phone numbers from the text of
--   messages older than 90 days. That job sets SET LOCAL app.redact = 'on' and may change `text` only.
BEGIN;

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY,
  lang text NOT NULL CHECK (lang IN ('th', 'en')),
  customer_id int REFERENCES customers(id),
  created_at timestamptz NOT NULL,
  last_message_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_sessions_last_message_at ON chat_sessions(last_message_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES chat_sessions(id),
  role text NOT NULL CHECK (role IN ('USER', 'BOT')),
  text text NOT NULL,
  booking_code text REFERENCES bookings(code),
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_session ON chat_messages(session_id, id);

CREATE OR REPLACE FUNCTION chat_messages_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('app.redact', true) = 'on'
     AND NEW.id = OLD.id AND NEW.session_id = OLD.session_id AND NEW.role = OLD.role
     AND NEW.booking_code IS NOT DISTINCT FROM OLD.booking_code AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;  -- BR-45 redaction of the text only
  END IF;
  RAISE EXCEPTION 'chat_messages is append-only: % is not allowed (BR-42)', TG_OP;
END $$;
CREATE OR REPLACE TRIGGER chat_messages_readonly
  BEFORE UPDATE OR DELETE ON chat_messages FOR EACH ROW EXECUTE FUNCTION chat_messages_guard();

INSERT INTO schema_migrations(version, name) VALUES ('004', 'chat') ON CONFLICT (version) DO NOTHING;
COMMIT;
