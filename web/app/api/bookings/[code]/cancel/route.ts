export const dynamic = "force-dynamic";
import { body, route, str } from "@/lib/server/core";
import { cancelBooking } from "@/lib/server/bookings";

// FR-10
export const POST = route<{ code: string }>(async (ctx, p) => {
  const b = await body(ctx.req);
  return cancelBooking(ctx, p.code, str(b.phone) || undefined);
});
