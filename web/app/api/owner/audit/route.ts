export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { auditList } from "@/lib/server/backoffice";
import { testNotFound } from "@/lib/server/testing";

// FR-47 · BR-42 / BR-44 (OWNER only) — read only: no way to change or delete the AuditLog (E147 → 404)
export const GET = route(async (ctx) => {
  const u = ctx.req.nextUrl.searchParams;
  return auditList(ctx, { from: u.get("from"), to: u.get("to"), staffUserId: u.get("staffUserId"), action: u.get("action") });
});
export const POST = testNotFound;
export const PUT = testNotFound;
export const PATCH = testNotFound;
export const DELETE = testNotFound;
