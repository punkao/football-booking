export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { route } from "@/lib/server/core";
import { authorizeBooking, bookingDetail, getBookingOr404 } from "@/lib/server/bookings";
import { withAccess } from "@/lib/server/access";

// FR-08, FR-09
export const GET = route<{ code: string }>(async (ctx, p) => {
  const b = await getBookingOr404(null, p.code);
  const phone = ctx.req.nextUrl.searchParams.get("phone") ?? undefined;
  await authorizeBooking(b, { phone, ctx });
  return withAccess(NextResponse.json(await bookingDetail(ctx, b)), ctx, [b.code]);
});
