import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseTestNow } from "@/lib/rules";
import { pool, ensureDb } from "./db";
import { forgetRedactionRun } from "./backoffice";

/**
 * NFR-10: the seed of /api/test/reset is the very file the database ran when it was created (db/init/02-seed.sql),
 * mounted read-only into the web container (web/compose.yaml) — one source for both (07-SAD 10.4).
 */
export function seedPath(): string {
  return process.env.SEED_SQL_PATH || "/app/db/02-seed.sql";
}

/** NFR-21: the test routes answer every other method with 404 too (no 405 that would reveal them) */
export function testNotFound(): Response {
  return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
}

/** POST /api/test/reset {now?} and /api/test/clock {now?} — 404 unless ALLOW_TEST_RESET=1 (NFR-21) */
export async function testEndpoint(req: NextRequest, kind: "reset" | "clock"): Promise<Response> {
  if (process.env.ALLOW_TEST_RESET !== "1") return testNotFound();
  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) ?? {};
  } catch {
    b = {};
  }
  // reset without now = Fri 9 Oct 2026 10:00 (TEST-DATA section 1) · clock without now = real time
  const now = parseTestNow(b.now, kind);
  if (now === "invalid") {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "now must be an ISO date-time" } }, { status: 400 });
  }
  let seedSql = "";
  if (kind === "reset") {
    try {
      seedSql = await readFile(/* turbopackIgnore: true */ seedPath(), "utf8");
    } catch (e) {
      console.error("[test] seed file not readable:", seedPath(), (e as Error).message);
      return NextResponse.json({ error: { code: "INTERNAL", message: "seed file not found" } }, { status: 500 });
    }
  }
  await ensureDb();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(424243)");
    // TRUNCATE inside the seed bypasses the append-only row triggers (ADR-14); reset is off in production (NFR-21)
    if (kind === "reset") await c.query(seedSql);
    await c.query("DELETE FROM app_settings WHERE key = 'clock'");
    if (now) await c.query("INSERT INTO app_settings(key, value) VALUES ('clock', $1)", [now.toISOString()]);
    await c.query("COMMIT");
    if (kind === "reset") forgetRedactionRun();
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    console.error("[test]", e);
    return NextResponse.json({ error: { code: "INTERNAL", message: String(e) } }, { status: 500 });
  } finally {
    c.release();
  }
  return NextResponse.json({ ok: true, now: (now ?? new Date()).toISOString(), locked: !!now, bugMode: process.env.BUG_MODE === "1" ? 1 : 0 });
}
