export const dynamic = "force-dynamic";
import { body, route, str } from "@/lib/server/core";
import { payBooking } from "@/lib/server/bookings";

// FR-06
export const POST = route<{ code: string }>(async (ctx, p) => {
  const b = await body(ctx.req);
  return payBooking(ctx, p.code, str(b.phone) || undefined);
});
