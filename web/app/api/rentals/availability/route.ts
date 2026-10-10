export const dynamic = "force-dynamic";
import { num, route } from "@/lib/server/core";
import { rentalsAvailability } from "@/lib/server/features";

// FR-17
export const GET = route(async (ctx) => {
  const sp = ctx.req.nextUrl.searchParams;
  return rentalsAvailability(ctx, sp.get("date") ?? "", num(sp.get("startHour")), num(sp.get("hours")));
});
