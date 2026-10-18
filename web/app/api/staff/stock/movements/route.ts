export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { stockMovements } from "@/lib/server/stock";

// FR-37 / FR-40 · BR-42 (read only)
export const GET = route(async (ctx) => {
  const u = ctx.req.nextUrl.searchParams;
  return stockMovements(ctx, { itemId: u.get("itemId"), from: u.get("from"), to: u.get("to") });
});
