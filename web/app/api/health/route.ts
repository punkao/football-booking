export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { q } from "@/lib/server/db";

// NFR-12: exactly the v1 contract { ok, db } (tests compare with deep equality) · schema / chat mode → GET /api/version
export async function GET() {
  try {
    await q("SELECT 1");
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
