-- 008 down · removes the price-by-date table again — roll the web back to the image before CR-05 FIRST
-- (the new web reads this table every time it loads a field; the old web never does)
-- Lost: the price change of 1 Nov (fields.day_rate / evening_rate are the old base prices and were never changed) · no booking is touched
BEGIN;
DROP TABLE IF EXISTS field_rates;
DELETE FROM schema_migrations WHERE version = '008';
COMMIT;
