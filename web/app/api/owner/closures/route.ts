export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { closureCreate, closuresList } from "@/lib/server/features";

// FR-27
export const GET = route(async (ctx) => closuresList(ctx));
export const POST = route(async (ctx) => closureCreate(ctx, await body(ctx.req)));
