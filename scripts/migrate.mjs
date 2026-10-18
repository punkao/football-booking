#!/usr/bin/env node
// FR-48 / BR-43 · ADR-11: apply the migrations of db/migrations inside the db container.
//
//   node scripts/migrate.mjs                    apply every NNN_*.sql in order (each file can run again safely)
//   node scripts/migrate.mjs --down 005         roll back one migration (run NNN_*.down.sql) — take a backup first
//   node scripts/migrate.mjs --status           show schema_migrations
//   options: --container football-db (default) · --db <name> (default POSTGRES_DB of db/.env)
//
// The bookings are counted before and after: the count must not change (BR-43).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DB_DIR, arg, log, psql } from "./_db.mjs";
import { planMigrations } from "../web/lib/rules/records.ts";

const container = arg("container", "football-db");
const db = arg("db", undefined);
const plan = planMigrations(readdirSync(join(DB_DIR, "migrations")));

const scalar = (sql) => psql(container, ["-At", "-c", sql], { db, quiet: true }).stdout.trim();
const bookings = () => Number(scalar("SELECT count(*) FROM bookings"));
const status = () => psql(container, ["-c", "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"], { db, quiet: true }).stdout;

if (arg("status")) {
  process.stdout.write(status());
  process.exit(0);
}

const down = arg("down");
const before = bookings();
log(`container ${container} · bookings before: ${before}`);
if (down) {
  const m = plan.find((x) => x.version === String(down).padStart(3, "0"));
  if (!m) throw new Error(`no migration ${down} (have ${plan.map((x) => x.version).join(", ")})`);
  log(`DOWN ${m.down}`);
  psql(container, ["-q", "-f", `/migrations/${m.down}`], { db });
} else {
  for (const m of plan) {
    log(`UP   ${m.up}`);
    psql(container, ["-q", "-f", `/migrations/${m.up}`], { db });
  }
}
const after = bookings();
log(`bookings after: ${after} ${after === before ? "(unchanged ✓)" : "(CHANGED ✗)"}`);
process.stdout.write(status());
if (after !== before) process.exit(1);
