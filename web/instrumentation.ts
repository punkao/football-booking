// Create tables + seed once when the server starts (idempotent). Never runs during `next build`.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;
  const { ensureDb } = await import("./lib/server/db");
  ensureDb().catch((e) => console.error("[init] database not ready yet:", e?.message ?? e));
}
