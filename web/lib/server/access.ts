import type { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessCodesFrom, cookieOpts } from "./core";
import type { Ctx } from "./core";
import { sign } from "./crypto";

/** remembers (in a signed httpOnly cookie) the booking codes this browser created or unlocked with the phone number */
export function withAccess(res: NextResponse, ctx: Ctx, codes: string[]): NextResponse {
  const current = accessCodesFrom((n) => ctx.req.cookies.get(n)?.value);
  const next = [...codes, ...current.filter((c) => !codes.includes(c))].slice(0, 40);
  res.cookies.set(ACCESS_COOKIE, sign({ codes: next }), cookieOpts);
  return res;
}
