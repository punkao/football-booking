import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { pool, ensureDb } from "./db";
import { resetDatabase } from "./schema";

function parseNow(v: unknown): Date | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" && typeof v !== "number") return "invalid";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/** NFR-10: POST /api/test/reset and /api/test/clock — 404 unless ALLOW_TEST_RESET=1 */
export async function testEndpoint(req: NextRequest, kind: "reset" | "clock"): Promise<Response> {
  if (process.env.ALLOW_TEST_RESET !== "1") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }
  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) ?? {};
  } catch {
    b = {};
  }
  const now = parseNow(b.now);
  if (now === "invalid") {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "now must be an ISO date-time" } }, { status: 400 });
  }
  await ensureDb();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(424243)");
    if (kind === "reset") {
      await resetDatabase(c, now);
    } else {
      await c.query("DELETE FROM app_settings WHERE key = 'clock'");
      if (now) await c.query("INSERT INTO app_settings(key, value) VALUES ('clock', $1)", [now.toISOString()]);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    console.error("[test]", e);
    return NextResponse.json({ error: { code: "INTERNAL", message: String(e) } }, { status: 500 });
  } finally {
    c.release();
  }
  return NextResponse.json({ ok: true, now: (now ?? new Date()).toISOString(), locked: !!now, bugMode: process.env.BUG_MODE === "1" ? 1 : 0 });
}
