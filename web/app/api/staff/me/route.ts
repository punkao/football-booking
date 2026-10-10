export const dynamic = "force-dynamic";
import { AppError, route, staffFrom } from "@/lib/server/core";

export const GET = route(async (ctx) => {
  const s = await staffFrom((n) => ctx.req.cookies.get(n)?.value);
  if (!s) throw new AppError("UNAUTHORIZED");
  return { staff: s };
}, { expire: false });
