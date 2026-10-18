export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { stockReceive } from "@/lib/server/stock";

// FR-40 · BR-36 (MANAGER, OWNER)
export const POST = route(async (ctx) => stockReceive(ctx, await body(ctx.req)));
