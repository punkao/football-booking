export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { availability } from "@/lib/server/features";

// FR-01, FR-28
export const GET = route(async (ctx) => availability(ctx, ctx.req.nextUrl.searchParams.get("date")));
