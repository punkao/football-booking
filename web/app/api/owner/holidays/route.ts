export const dynamic = "force-dynamic";
import { body, route, str } from "@/lib/server/core";
import { holidayAdd, holidayDelete, holidaysList } from "@/lib/server/features";

// FR-26
export const GET = route(async (ctx) => holidaysList(ctx));
export const POST = route(async (ctx) => holidayAdd(ctx, await body(ctx.req)));
export const DELETE = route(async (ctx) => {
  const fromQuery = ctx.req.nextUrl.searchParams.get("date");
  const date = fromQuery ?? str((await body(ctx.req)).date);
  return holidayDelete(ctx, date);
});
