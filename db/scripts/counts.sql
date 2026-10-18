-- Row count of the 23 contract tables + money totals (NFR-20 drill: the numbers before backup and after restore must match)
-- docker exec football-db psql -U football -d football -At -F '|' -f /scripts/counts.sql
SELECT 'fields', count(*) FROM fields
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'bookings', count(*) FROM bookings
UNION ALL SELECT 'payments', count(*) FROM payments
UNION ALL SELECT 'credit_entries', count(*) FROM credit_entries
UNION ALL SELECT 'holidays', count(*) FROM holidays
UNION ALL SELECT 'field_closures', count(*) FROM field_closures
UNION ALL SELECT 'rental_items', count(*) FROM rental_items
UNION ALL SELECT 'booking_rentals', count(*) FROM booking_rentals
UNION ALL SELECT 'recurring_series', count(*) FROM recurring_series
UNION ALL SELECT 'split_shares', count(*) FROM split_shares
UNION ALL SELECT 'challenges', count(*) FROM challenges
UNION ALL SELECT 'staff_users', count(*) FROM staff_users
UNION ALL SELECT 'stock_items', count(*) FROM stock_items
UNION ALL SELECT 'stock_locations', count(*) FROM stock_locations
UNION ALL SELECT 'stock_levels', count(*) FROM stock_levels
UNION ALL SELECT 'stock_movements', count(*) FROM stock_movements
UNION ALL SELECT 'counter_sales', count(*) FROM counter_sales
UNION ALL SELECT 'counter_sale_items', count(*) FROM counter_sale_items
UNION ALL SELECT 'chat_sessions', count(*) FROM chat_sessions
UNION ALL SELECT 'chat_messages', count(*) FROM chat_messages
UNION ALL SELECT 'booking_status_history', count(*) FROM booking_status_history
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs
UNION ALL SELECT 'sum:payments.amount', coalesce(sum(amount), 0) FROM payments
UNION ALL SELECT 'sum:counter_sales.total_amount', coalesce(sum(total_amount), 0) FROM counter_sales
UNION ALL SELECT 'sum:customers.credit_balance', coalesce(sum(credit_balance), 0) FROM customers
UNION ALL SELECT 'sum:stock_levels.qty', coalesce(sum(qty), 0) FROM stock_levels
UNION ALL SELECT 'schema_migrations', count(*) FROM schema_migrations;
