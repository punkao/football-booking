export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { rescheduleBooking } from "@/lib/server/bookings";

// FR-11
export const POST = route<{ code: string }>(async (ctx, p) => rescheduleBooking(ctx, p.code, await body(ctx.req)));
