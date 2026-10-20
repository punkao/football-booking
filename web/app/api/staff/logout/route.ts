export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { STAFF_COOKIE, revokeSession, route } from "@/lib/server/core";

// CR-01: the cookie is ended on the server too (not only deleted in this browser)
export const POST = route(async (ctx) => {
  await revokeSession(STAFF_COOKIE, ctx.req.cookies.get(STAFF_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}, { expire: false });
