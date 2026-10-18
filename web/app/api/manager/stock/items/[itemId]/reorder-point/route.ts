export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { stockReorderPoint } from "@/lib/server/stock";

// FR-40 / FR-41 · BR-35 / BR-36 (MANAGER, OWNER)
export const PUT = route<{ itemId: string }>(async (ctx, p) => stockReorderPoint(ctx, p.itemId, await body(ctx.req)));
