export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE, revokeSession, route } from "@/lib/server/core";

// CR-01: the cookie is ended on the server too (not only deleted in this browser)
export const POST = route(async (ctx) => {
  await revokeSession(CUSTOMER_COOKIE, ctx.req.cookies.get(CUSTOMER_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}, { expire: false });
