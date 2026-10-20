-- 007 down · removes the logout list again — roll the web back to the image before CR-01 FIRST
-- (the new web reads this table on every logged-in request; the old web never does and accepts both cookie formats)
-- Lost: which cookies were logged out (with the old web they work again until they expire, as before CR-01)
BEGIN;
DROP TABLE IF EXISTS revoked_sessions;
DELETE FROM schema_migrations WHERE version = '007';
COMMIT;
