import { Pool, types } from "pg";
import type { PoolClient } from "pg";
import { initDatabase } from "./schema";

// DATE columns come back as plain "YYYY-MM-DD" strings (no timezone shifting)
types.setTypeParser(1082, (v: string) => v);
// BIGINT (sums / counts) as numbers
types.setTypeParser(20, (v: string) => Number(v));

export type Db = Pick<PoolClient, "query">;

type G = { __lnPool?: Pool; __lnInit?: Promise<void> };
const g = globalThis as unknown as G;

export function pool(): Pool {
  if (!g.__lnPool) {
    g.__lnPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    g.__lnPool.on("error", (e) => console.error("[db] idle client error", e.message));
  }
  return g.__lnPool;
}

/** creates tables + seed once per process (idempotent, retried until the DB is reachable) */
export function ensureDb(): Promise<void> {
  if (!g.__lnInit) {
    g.__lnInit = (async () => {
      let lastErr: unknown;
      for (let i = 0; i < 30; i++) {
        try {
          await initDatabase(pool());
          return;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      throw lastErr;
    })().catch((e) => {
      g.__lnInit = undefined;
      throw e;
    });
  }
  return g.__lnInit;
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureDb();
  const r = await pool().query(sql, params);
  return r.rows as T[];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureDb();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

/** ADR-02: serialise writers per key (e.g. field + date) inside a transaction */
export async function lockKey(c: Db, key: string): Promise<void> {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
}
