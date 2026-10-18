export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { dashboard } from "@/lib/server/backoffice";

// FR-42 · BR-40 / BR-41 / BR-44 (OWNER, MANAGER)
export const GET = route(async (ctx) => dashboard(ctx, ctx.req.nextUrl.searchParams.get("date")));
