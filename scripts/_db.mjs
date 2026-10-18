// Shared helpers for scripts/*.mjs (no dependencies · works the same from PowerShell and Git Bash).
// docker is called with an argument array (no shell), so Git Bash never rewrites the container paths.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DB_DIR = join(ROOT, "db");

/** POSTGRES_USER / POSTGRES_DB from db/.env (the password is never needed: docker exec uses the local socket) */
export function dbEnv() {
  const env = { POSTGRES_USER: "football", POSTGRES_DB: "football" };
  try {
    for (const line of readFileSync(join(DB_DIR, ".env"), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && (m[1] === "POSTGRES_USER" || m[1] === "POSTGRES_DB")) env[m[1]] = m[2];
    }
  } catch {
    // no db/.env → defaults
  }
  return env;
}

export function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

export function docker(args, { allowFail = false, quiet = false } = {}) {
  const r = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail) {
    throw new Error(`docker ${args.slice(0, 4).join(" ")} … failed (${r.status})\n${r.stderr || r.stdout}`);
  }
  if (!quiet && r.stderr && r.status === 0) process.stderr.write(r.stderr);
  return r;
}

/** psql inside the db container */
export function psql(container, sqlArgs, opts = {}) {
  const { POSTGRES_USER, POSTGRES_DB } = dbEnv();
  const db = opts.db ?? POSTGRES_DB;
  return docker(["exec", container, "psql", "-U", POSTGRES_USER, "-d", db, "-v", "ON_ERROR_STOP=1", ...sqlArgs], opts);
}

/** NFR-20: row counts of the 23 tables + money totals (db/scripts/counts.sql) as { name: number } */
export function counts(container, db) {
  const r = psql(container, ["-At", "-F", "|", "-f", "/scripts/counts.sql"], { db, quiet: true });
  const out = {};
  for (const line of r.stdout.trim().split(/\r?\n/)) {
    const [k, v] = line.split("|");
    if (k) out[k] = Number(v);
  }
  return out;
}

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}
