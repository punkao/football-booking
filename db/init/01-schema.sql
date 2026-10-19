-- 01-schema.sql · runs once when the volume football-pgdata is created (docker-entrypoint-initdb.d).
-- ADR-11: the schema has one source only — the migration files, applied in number order.
-- /docker-entrypoint-initdb.d/../migrations = /migrations (mounted read-only by db/compose.yaml)
\set ON_ERROR_STOP on
\ir ../migrations/001_v1_baseline.sql
\ir ../migrations/002_history_audit.sql
\ir ../migrations/003_stock.sql
\ir ../migrations/004_chat.sql
\ir ../migrations/005_constraints.sql
\ir ../migrations/006_chat_hardening.sql
