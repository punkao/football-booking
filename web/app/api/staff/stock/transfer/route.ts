export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { stockTransfer } from "@/lib/server/stock";

// FR-39 · BR-33 / BR-34
export const POST = route(async (ctx) => stockTransfer(ctx, await body(ctx.req)));
