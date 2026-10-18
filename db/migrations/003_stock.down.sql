-- 003 down · removes the 6 stock tables. Bookings and rental_items (with its v1 stock column) stay → v1 keeps working.
-- Stock quantities, movements and counter sales are lost → take a backup first (docs/RUNBOOK.md).
BEGIN;
ALTER TABLE rental_items DROP CONSTRAINT IF EXISTS rental_items_stock_item_fk;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS counter_sale_items;
DROP TABLE IF EXISTS counter_sales;
DROP TABLE IF EXISTS stock_levels;
DROP TABLE IF EXISTS stock_locations;
DROP TABLE IF EXISTS stock_items;
DELETE FROM schema_migrations WHERE version = '003';
COMMIT;
