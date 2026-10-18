-- 001 · v1 baseline (ADR-11, FR-48, BR-43)
-- The 13 tables of v1 exactly as the v1 web created them, plus the technical tables app_settings (locked clock, ADR-04)
-- and schema_migrations. Everything is IF NOT EXISTS: on a v1 database with data this changes nothing.
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text);

CREATE TABLE IF NOT EXISTS fields (
  id text PRIMARY KEY, name text NOT NULL, size int NOT NULL, covered boolean NOT NULL,
  day_rate int NOT NULL, evening_rate int NOT NULL, photo text NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY, name text NOT NULL, phone text NOT NULL UNIQUE, password_hash text,
  credit_balance int NOT NULL DEFAULT 0, paid_hours int NOT NULL DEFAULT 0, free_hours_used int NOT NULL DEFAULT 0,
  banned_until timestamptz
);
CREATE TABLE IF NOT EXISTS recurring_series (
  id serial PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id), field_id text NOT NULL REFERENCES fields(id),
  weekday int NOT NULL, start_hour int NOT NULL, hours int NOT NULL, weeks_requested int NOT NULL,
  weeks_booked int NOT NULL, discount_percent int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id serial PRIMARY KEY, code text NOT NULL UNIQUE, customer_id int NOT NULL REFERENCES customers(id),
  field_id text NOT NULL REFERENCES fields(id), date date NOT NULL, start_hour int NOT NULL, hours int NOT NULL,
  status text NOT NULL, payment_plan text NOT NULL, field_price int NOT NULL, discount int NOT NULL DEFAULT 0,
  rental_price int NOT NULL DEFAULT 0, credit_used int NOT NULL DEFAULT 0, free_hour_used boolean NOT NULL DEFAULT false,
  total_price int NOT NULL, pay_now int NOT NULL, amount_paid int NOT NULL DEFAULT 0, due_at_field int NOT NULL,
  pay_deadline timestamptz NOT NULL, consent_at timestamptz NOT NULL, reschedule_count int NOT NULL DEFAULT 0,
  series_id int REFERENCES recurring_series(id), created_at timestamptz NOT NULL,
  checked_in_at timestamptz, no_show_at timestamptz, split_token text UNIQUE
);
-- phase 7.5 of v1 (BR-26, A-20): the name typed for each booking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS bookings_field_date ON bookings(field_id, date);
CREATE INDEX IF NOT EXISTS bookings_customer ON bookings(customer_id);
CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY, booking_id int NOT NULL REFERENCES bookings(id), amount int NOT NULL,
  method text NOT NULL, paid_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS credit_entries (
  id serial PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id), amount int NOT NULL,
  reason text NOT NULL, booking_id int REFERENCES bookings(id), created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS holidays (date date PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS staff_users (
  id serial PRIMARY KEY, name text NOT NULL, username text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL
);
CREATE TABLE IF NOT EXISTS field_closures (
  id serial PRIMARY KEY, field_id text NOT NULL REFERENCES fields(id), date date NOT NULL, from_hour int NOT NULL,
  to_hour int NOT NULL, created_by int REFERENCES staff_users(id), created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS rental_items (id text PRIMARY KEY, name text NOT NULL, price int NOT NULL, stock int NOT NULL);
CREATE TABLE IF NOT EXISTS booking_rentals (
  booking_id int NOT NULL REFERENCES bookings(id), item_id text NOT NULL REFERENCES rental_items(id),
  qty int NOT NULL, returned_qty int NOT NULL DEFAULT 0, PRIMARY KEY (booking_id, item_id)
);
CREATE TABLE IF NOT EXISTS split_shares (
  id serial PRIMARY KEY, booking_id int NOT NULL REFERENCES bookings(id), member_name text NOT NULL,
  amount int NOT NULL, paid_at timestamptz
);
CREATE TABLE IF NOT EXISTS challenges (
  id serial PRIMARY KEY, booking_id int NOT NULL REFERENCES bookings(id), team_name text NOT NULL, level text NOT NULL,
  status text NOT NULL, accept_customer_id int REFERENCES customers(id), amount int NOT NULL, pay_deadline timestamptz,
  created_at timestamptz NOT NULL
);
CREATE SEQUENCE IF NOT EXISTS booking_code_seq START 100001;

INSERT INTO schema_migrations(version, name) VALUES ('001', 'v1_baseline') ON CONFLICT (version) DO NOTHING;
COMMIT;
