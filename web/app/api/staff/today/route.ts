export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { staffToday } from "@/lib/server/features";

// FR-22
export const GET = route(async (ctx) => staffToday(ctx, ctx.req.nextUrl.searchParams.get("date")));
