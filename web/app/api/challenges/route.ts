export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { challengeCreate, challengeList } from "@/lib/server/features";

// FR-20
export const GET = route(async (ctx) => challengeList(ctx, ctx.req.nextUrl.searchParams.get("level")));
export const POST = route(async (ctx) => challengeCreate(ctx, await body(ctx.req)));
