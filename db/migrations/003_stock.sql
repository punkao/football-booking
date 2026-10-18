-- 003 · stock (FR-37 – FR-41, BR-33 – BR-38 · ADR-18 · T-14, T-17, T-19)
-- * 6 tables: stock_items, stock_locations, stock_levels, stock_movements, counter_sales, counter_sale_items
-- * the item list (A-32) and the 2 places are reference data → inserted ON CONFLICT DO NOTHING
-- * on a v1 database the rental stock (rental_items.stock) becomes the COUNTER quantity of BIB / BALL,
--   where TEST-DATA keeps the rental items; the other items start at 0 until the shop receives them
-- * rental_items keeps its stock column so that 003 can be rolled back and v1 still works (ADR-18)
BEGIN;

CREATE TABLE IF NOT EXISTS stock_items (
  id text PRIMARY KEY CHECK (id IN ('BIB', 'BALL', 'WATER', 'ORS', 'TOWEL', 'CONE', 'NET', 'LAMP')),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('RENTAL', 'SALE', 'EQUIPMENT')),
  unit_price int CHECK (unit_price >= 0),
  reorder_point int CHECK (reorder_point >= 0)
);

CREATE TABLE IF NOT EXISTS stock_locations (
  id text PRIMARY KEY CHECK (id IN ('STORE', 'COUNTER')),
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_levels (
  item_id text NOT NULL REFERENCES stock_items(id),
  location_id text NOT NULL REFERENCES stock_locations(id),
  qty int NOT NULL DEFAULT 0 CHECK (qty >= 0),            -- BR-33: never below 0
  PRIMARY KEY (item_id, location_id)
);

CREATE TABLE IF NOT EXISTS counter_sales (
  id serial PRIMARY KEY,
  total_amount int NOT NULL CHECK (total_amount >= 0),
  method text NOT NULL CHECK (method IN ('CASH', 'PROMPTPAY')),
  staff_user_id int NOT NULL REFERENCES staff_users(id),
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS counter_sales_created_at ON counter_sales(created_at);

CREATE TABLE IF NOT EXISTS counter_sale_items (
  sale_id int NOT NULL REFERENCES counter_sales(id),
  item_id text NOT NULL REFERENCES stock_items(id),
  qty int NOT NULL CHECK (qty >= 1),
  unit_price int NOT NULL CHECK (unit_price >= 0),          -- price at the time of the sale
  PRIMARY KEY (sale_id, item_id)
);

-- T-14: qty is always positive; the direction is from_location_id (out) / to_location_id (in)
CREATE TABLE IF NOT EXISTS stock_movements (
  id serial PRIMARY KEY,
  item_id text NOT NULL REFERENCES stock_items(id),
  type text NOT NULL CHECK (type IN ('RECEIVE', 'SALE', 'TRANSFER', 'DAMAGE', 'ADJUST')),
  qty int NOT NULL CHECK (qty > 0),
  from_location_id text REFERENCES stock_locations(id),
  to_location_id text REFERENCES stock_locations(id),
  reason text,
  staff_user_id int NOT NULL REFERENCES staff_users(id),
  counter_sale_id int REFERENCES counter_sales(id),
  created_at timestamptz NOT NULL,
  CONSTRAINT stock_movements_direction CHECK (
    (type = 'RECEIVE' AND from_location_id IS NULL AND to_location_id IS NOT NULL) OR
    (type IN ('SALE', 'DAMAGE') AND from_location_id IS NOT NULL AND to_location_id IS NULL) OR
    (type = 'TRANSFER' AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL AND from_location_id <> to_location_id) OR
    (type = 'ADJUST' AND (from_location_id IS NULL) <> (to_location_id IS NULL))
  ),
  CONSTRAINT stock_movements_sale_from_counter CHECK (type <> 'SALE' OR (from_location_id = 'COUNTER' AND counter_sale_id IS NOT NULL)),
  CONSTRAINT stock_movements_sale_link CHECK (counter_sale_id IS NULL OR type = 'SALE'),
  CONSTRAINT stock_movements_reason CHECK (type NOT IN ('DAMAGE', 'ADJUST') OR btrim(coalesce(reason, '')) <> '')  -- BR-36
);
CREATE INDEX IF NOT EXISTS stock_movements_item_time ON stock_movements(item_id, created_at);

CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed (BR-42)', TG_TABLE_NAME, TG_OP;
END $$;
CREATE OR REPLACE TRIGGER stock_movements_readonly
  BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- reference data (A-32 · TEST-DATA section 4)
INSERT INTO stock_locations(id, name) VALUES ('STORE', 'ห้องเก็บของ'), ('COUNTER', 'เคาน์เตอร์')
ON CONFLICT (id) DO NOTHING;
INSERT INTO stock_items(id, name, category, unit_price, reorder_point) VALUES
  ('BIB',   'เสื้อเอี๊ยม (ชุด 10 ตัว)', 'RENTAL',    50,   NULL),
  ('BALL',  'ลูกบอล',               'RENTAL',    30,   NULL),
  ('WATER', 'น้ำดื่ม 600 มล.',        'SALE',      10,   48),
  ('ORS',   'เครื่องดื่มเกลือแร่',       'SALE',      20,   24),
  ('TOWEL', 'ผ้าเย็น',               'SALE',      10,   20),
  ('CONE',  'กรวยซ้อม',             'EQUIPMENT', NULL, 20),
  ('NET',   'ตาข่ายประตูสำรอง',       'EQUIPMENT', NULL, 2),
  ('LAMP',  'หลอดไฟสนามสำรอง',      'EQUIPMENT', NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- ADR-18: v1 rental stock → COUNTER (first run only; a second run finds the rows and does nothing)
INSERT INTO stock_levels(item_id, location_id, qty)
SELECT r.id, 'COUNTER', GREATEST(r.stock, 0) FROM rental_items r WHERE r.id IN ('BIB', 'BALL')
ON CONFLICT (item_id, location_id) DO NOTHING;
-- every item has a row in both places
INSERT INTO stock_levels(item_id, location_id, qty)
SELECT i.id, l.id, 0 FROM stock_items i CROSS JOIN stock_locations l
ON CONFLICT (item_id, location_id) DO NOTHING;

-- contract 1.4: RentalItem.id = StockItem.id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rental_items_stock_item_fk') THEN
    ALTER TABLE rental_items ADD CONSTRAINT rental_items_stock_item_fk FOREIGN KEY (id) REFERENCES stock_items(id);
  END IF;
END $$;

INSERT INTO schema_migrations(version, name) VALUES ('003', 'stock') ON CONFLICT (version) DO NOTHING;
COMMIT;
