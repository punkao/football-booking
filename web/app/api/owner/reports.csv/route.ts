export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { reportCsv } from "@/lib/server/backoffice";

// FR-44 · NFR-22 · ADR-19 (OWNER only) · AuditLog REPORT_EXPORT
export const GET = route(async (ctx) => reportCsv(ctx, ctx.req.nextUrl.searchParams.get("from"), ctx.req.nextUrl.searchParams.get("to")));
