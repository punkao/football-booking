export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { report } from "@/lib/server/backoffice";

// FR-44 · BR-39 / BR-40 (OWNER only)
export const GET = route(async (ctx) => report(ctx, ctx.req.nextUrl.searchParams.get("from"), ctx.req.nextUrl.searchParams.get("to")));
