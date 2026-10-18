export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { counterSale } from "@/lib/server/stock";

// FR-38 · BR-33 / BR-37
export const POST = route(async (ctx) => counterSale(ctx, await body(ctx.req)));
