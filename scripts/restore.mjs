#!/usr/bin/env node
// FR-46 / NFR-20 · ADR-13: restore a backup with one command, then compare the row counts with the backup's.
//
//   node scripts/restore.mjs latest                     restore the newest db/backups/football-*.dump
//   node scripts/restore.mjs football-20261018-1950.dump
//   options: --container football-db
//            --recreate   drop and create the database first (disaster drill / broken database)
//            --keep-web   do not stop / start the football-web container
//
// Steps: stop football-web → (recreate the database) → pg_restore --clean --if-exists --single-transaction →
// compare counts with <dump>.counts.json → start football-web. A failed restore changes nothing (single transaction).
// No step ever deletes a docker volume.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DB_DIR, arg, counts, dbEnv, docker, log, psql } from "./_db.mjs";

const container = arg("container", "football-db");
const recreate = !!arg("recreate", false);
const keepWeb = !!arg("keep-web", false);
const { POSTGRES_USER, POSTGRES_DB } = dbEnv();
const dir = join(DB_DIR, "backups");

let file = process.argv.slice(2).find((a) => !a.startsWith("--") && a !== container);
if (!file || file === "latest") {
  file = readdirSync(dir)
    .filter((f) => /^football-\d{8}-\d{6}\.dump$/.test(f))
    .sort()
    .pop();
}
if (!file || !existsSync(join(dir, file))) {
  console.error(`backup not found in db/backups: ${file ?? "(none)"}`);
  process.exit(2);
}

const webRunning = () => docker(["inspect", "-f", "{{.State.Running}}", "football-web"], { allowFail: true, quiet: true }).stdout.trim() === "true";
const stopWeb = !keepWeb && webRunning();
if (stopWeb) {
  log("stopping football-web (no writes during the restore)");
  docker(["stop", "football-web"], { quiet: true });
}
try {
  if (recreate) {
    log(`dropping and creating database ${POSTGRES_DB}`);
    psql(container, ["-c", `DROP DATABASE IF EXISTS "${POSTGRES_DB}" WITH (FORCE)`], { db: "postgres", quiet: true });
    psql(container, ["-c", `CREATE DATABASE "${POSTGRES_DB}"`], { db: "postgres", quiet: true });
  }
  log(`pg_restore db/backups/${file} → ${POSTGRES_DB}`);
  docker([
    "exec", container, "pg_restore", "-U", POSTGRES_USER, "-d", POSTGRES_DB,
    "--clean", "--if-exists", "--single-transaction", "--no-owner", `/backups/${file}`,
  ]);
} finally {
  if (stopWeb) {
    log("starting football-web");
    docker(["start", "football-web"], { quiet: true });
  }
}

const after = counts(container);
const countsFile = join(dir, file.replace(/\.dump$/, ".counts.json"));
if (!existsSync(countsFile)) {
  log("no .counts.json next to this dump: counts after restore:");
  console.log(after);
  process.exit(0);
}
const before = JSON.parse(readFileSync(countsFile, "utf8"));
const diff = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k]);
for (const k of Object.keys(before)) console.log(`${k.padEnd(32)} ${String(before[k]).padStart(8)} → ${String(after[k]).padStart(8)} ${before[k] === after[k] ? "✓" : "✗"}`);
if (diff.length) {
  log(`MISMATCH: ${diff.join(", ")}`);
  process.exit(1);
}
log("restore OK: every count matches the backup");
