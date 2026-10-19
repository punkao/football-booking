// v2 (ADR-11): the database is created by db/ (migrations + seed); the web only checks that it can connect.
// R1: without a usable SESSION_SECRET the web refuses to start (cookies could be forged) — except on a test machine
// (ALLOW_TEST_RESET=1) where a random secret is used for this run. Never runs during `next build`.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { resolveSessionSecret, sessionSecret } = await import("./lib/server/secret");
  const r = resolveSessionSecret(process.env);
  if (!r.ok) {
    console.error(`[startup] refusing to start: ${r.message}`);
    process.exit(1);
  }
  sessionSecret(); // resolve once now (logs the warning for a temporary secret)
  if (!process.env.DATABASE_URL) return;
  const { ensureDb } = await import("./lib/server/db");
  ensureDb().catch((e) => console.error("[init] database not reachable yet:", e?.message ?? e));
}
