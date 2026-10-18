export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";

// v2 ops info (kept out of /api/health so its v1 shape never changes): latest migration, chat mode, bug mode.
// No secrets: only these three values are ever returned.
export async function GET() {
  const chatMode = process.env.MODE === "ai" ? "ai" : "mock";
  const bugMode = process.env.BUG_MODE === "1" ? 1 : 0;
  let schemaVersion: string | null = null;
  try {
    const r = await q<{ v: string | null }>("SELECT max(version) AS v FROM schema_migrations");
    schemaVersion = r[0]?.v ?? null;
  } catch {
    schemaVersion = null; // database down or not migrated
  }
  return NextResponse.json({ schemaVersion, chatMode, bugMode });
}
