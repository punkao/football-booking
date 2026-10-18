import { Pool, types } from "pg";
import type { PoolClient } from "pg";
import type { AuditAction } from "@/lib/rules";

// DATE columns come back as plain "YYYY-MM-DD" strings (no timezone shifting)
types.setTypeParser(1082, (v: string) => v);
// BIGINT (sums / counts) as numbers
types.setTypeParser(20, (v: string) => Number(v));

export type Db = Pick<PoolClient, "query">;

type G = { __lnPool?: Pool; __lnReady?: Promise<void> };
const g = globalThis as unknown as G;

export function pool(): Pool {
  if (!g.__lnPool) {
    g.__lnPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    g.__lnPool.on("error", (e) => console.error("[db] idle client error", e.message));
  }
  return g.__lnPool;
}

/**
 * v2 (ADR-11): the web no longer creates tables or seeds — db/init + db/migrations do.
 * This only waits (retrying) until the database answers; the db container may start after the web (ADR-10).
 */
export function ensureDb(): Promise<void> {
  if (!g.__lnReady) {
    g.__lnReady = (async () => {
      let lastErr: unknown;
      for (let i = 0; i < 30; i++) {
        try {
          await pool().query("SELECT 1");
          return;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      throw lastErr;
    })().catch((e) => {
      g.__lnReady = undefined;
      throw e;
    });
  }
  return g.__lnReady;
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureDb();
  const r = await pool().query(sql, params);
  return r.rows as T[];
}

/** who changes bookings in this transaction (BR-42 · ADR-14): CUSTOMER / BOT / SYSTEM / a staff username */
export type Actor = { actor: string; now: Date };

/**
 * One transaction. With `who`, the database trigger records every booking status change under that actor and the
 * application's "now" (ADR-04). A booking change without an actor is refused by the database.
 */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>, who?: Actor): Promise<T> {
  await ensureDb();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    if (who) await setActor(c, who);
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

/** SET LOCAL app.actor / app.now for the current transaction (read by the history trigger of migration 002) */
export async function setActor(c: Db, who: Actor): Promise<void> {
  await c.query("SELECT set_config('app.actor', $1, true), set_config('app.now', $2, true)", [who.actor, who.now.toISOString()]);
}

/** BR-42 / T-16: one AuditLog row, in the same transaction as the shop action it describes */
export async function audit(
  c: Db,
  staffUserId: number,
  action: AuditAction,
  target: string,
  detail: Record<string, unknown>,
  now: Date,
): Promise<void> {
  await c.query("INSERT INTO audit_logs(staff_user_id, action, target, detail, created_at) VALUES ($1, $2, $3, $4, $5)", [
    staffUserId,
    action,
    target,
    JSON.stringify(detail),
    now,
  ]);
}

/** ADR-02: serialise writers per key (e.g. field + date) inside a transaction */
export async function lockKey(c: Db, key: string): Promise<void> {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
}
