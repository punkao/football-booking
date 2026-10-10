export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { body, route } from "@/lib/server/core";
import { createBooking } from "@/lib/server/bookings";
import { withAccess } from "@/lib/server/access";

// FR-02 – FR-04
export const POST = route(async (ctx) => {
  const out = await createBooking(ctx, await body(ctx.req));
  return withAccess(NextResponse.json(out, { status: 201 }), ctx, [out.booking.code]);
});
