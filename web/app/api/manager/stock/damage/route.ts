export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { stockDamage } from "@/lib/server/stock";

// FR-40 · BR-36 (MANAGER, OWNER)
export const POST = route(async (ctx) => stockDamage(ctx, await body(ctx.req)));
