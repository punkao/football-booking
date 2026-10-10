export const dynamic = "force-dynamic";
import { body, route } from "@/lib/server/core";
import { quote } from "@/lib/server/bookings";

// FR-05: price lines without creating a booking
export const POST = route(async (ctx) => quote(ctx, await body(ctx.req)));
