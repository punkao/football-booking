// v2 (ADR-11): the database is created by db/ (migrations + seed); the web only checks that it can connect.
// Never runs during `next build` (no database access at build time).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;
  const { ensureDb } = await import("./lib/server/db");
  ensureDb().catch((e) => console.error("[init] database not reachable yet:", e?.message ?? e));
}
