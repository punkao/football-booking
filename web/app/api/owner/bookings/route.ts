export const dynamic = "force-dynamic";
import { route } from "@/lib/server/core";
import { bookingsSearch } from "@/lib/server/backoffice";

// FR-43 · BR-44 (OWNER, MANAGER)
export const GET = route(async (ctx) => {
  const u = ctx.req.nextUrl.searchParams;
  return bookingsSearch(ctx, { code: u.get("code"), phone: u.get("phone"), date: u.get("date") });
});
