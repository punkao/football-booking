export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { chatsList } from "@/lib/server/backoffice";

// FR-36 · BR-44 / BR-45 (OWNER, MANAGER)
export const GET = route(async (ctx) => chatsList(ctx, ctx.req.nextUrl.searchParams.get("from"), ctx.req.nextUrl.searchParams.get("to")));
