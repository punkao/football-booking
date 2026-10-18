#!/usr/bin/env node
// FR-46 / NFR-20 · ADR-13: back up the database with one command.
//
//   node scripts/backup.mjs                     → db/backups/football-YYYYMMDD-HHMMSS.dump (+ .counts.json)
//   options: --container football-db · --keep 7 (T-22: keep the 7 newest dumps, older ones are removed)
//
// pg_dump -Fc runs INSIDE the container and writes to /backups (= db/backups on this machine), so PowerShell 5.1
// never touches the bytes (its `>` would write UTF-16 and break the dump). The row counts are saved next to the dump
// so a restore can be checked against them. db/backups is not in git (personal data).
import { readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DB_DIR, arg, counts, dbEnv, docker, log, stamp } from "./_db.mjs";

const container = arg("container", "football-db");
const keep = Number(arg("keep", 7));
const { POSTGRES_USER, POSTGRES_DB } = dbEnv();
const name = `football-${stamp()}.dump`;

const before = counts(container);
log(`pg_dump ${POSTGRES_DB} → db/backups/${name}`);
docker(["exec", container, "pg_dump", "-U", POSTGRES_USER, "-d", POSTGRES_DB, "-Fc", "-f", `/backups/${name}`]);
const dir = join(DB_DIR, "backups");
writeFileSync(join(dir, name.replace(/\.dump$/, ".counts.json")), JSON.stringify(before, null, 2) + "\n");
const size = statSync(join(dir, name)).size;
log(`done: ${name} (${size} bytes) · bookings ${before.bookings} · payments ฿${before["sum:payments.amount"]}`);

// T-22: keep the newest `keep` dumps
const dumps = readdirSync(dir)
  .filter((f) => /^football-\d{8}-\d{6}\.dump$/.test(f))
  .sort()
  .reverse();
for (const old of dumps.slice(keep)) {
  rmSync(join(dir, old), { force: true });
  rmSync(join(dir, old.replace(/\.dump$/, ".counts.json")), { force: true });
  log(`removed old backup ${old} (keeping ${keep})`);
}
console.log(name);
