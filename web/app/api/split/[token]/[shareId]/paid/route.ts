export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { splitMarkPaid } from "@/lib/server/features";

// FR-19 / BR-27: status only, the shop never receives this money
export const POST = route<{ token: string; shareId: string }>(async (ctx, p) => {
  const b = await body(ctx.req);
  return splitMarkPaid(ctx, p.token, Number(p.shareId), b.paid !== false);
});
